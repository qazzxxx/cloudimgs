const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const imageRepository = require('../db/imageRepository');
const { getFileMetadata } = require('./metadataService');
const { CACHE_DIR_NAME, safeJoin } = require('../utils/fileUtils');

const STORAGE_PATH = config.storage.path;
const CONFIG_DIR_NAME = "config";
const TRASH_DIR_NAME = ".trash";
const LEGACY_CACHE_PATH = path.join(STORAGE_PATH, CACHE_DIR_NAME, "img_metadata.json");

async function migrateFromLegacyJson() {
    if (imageRepository.count() > 0) {
        console.log("Database not empty, skipping JSON migration.");
        return;
    }

    if (!await fs.pathExists(LEGACY_CACHE_PATH)) {
        console.log("No legacy metadata file found.");
        return;
    }

    console.log("Migrating from legacy img_metadata.json...");
    try {
        const rawData = await fs.readJson(LEGACY_CACHE_PATH);
        const imagesToInsert = [];

        // legacy data format: object where values are image objects
        // or array? The code said `Object.values(newCache)` so the file is likely a map: { "rel/path": { ... } }
        const items = Array.isArray(rawData) ? rawData : Object.values(rawData);

        for (const item of items) {
            // Adapt legacy fields to new Schema
            const metaJson = {};
            if (item.lat && item.lng) {
                metaJson.gps = { lat: item.lat, lng: item.lng };
            }
            if (item.date) {
                metaJson.date = item.date;
            }

            imagesToInsert.push({
                filename: item.filename,
                rel_path: item.relPath,
                size: 0, // Legacy might not have size, handled by sync later if needed, or we accept 0
                mtime: item.lastModified || 0,
                upload_time: item.date || new Date().toISOString(),
                width: null, // Legacy didn't store dimensions explicitly often
                height: null,
                orientation: item.orientation,
                thumbhash: item.thumbhash,
                meta_json: JSON.stringify(metaJson)
            });
        }

        if (imagesToInsert.length > 0) {
            imageRepository.insertMany(imagesToInsert);
            console.log(`Migrated ${imagesToInsert.length} images from JSON.`);
        }
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

async function getAllFiles(dir) {
    let results = [];
    const absDir = safeJoin(STORAGE_PATH, dir);
    try {
        // withFileTypes: 一次 readdir 同时拿到类型信息，避免对目录项额外 fs.stat 系统调用
        const entries = await fs.readdir(absDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === CACHE_DIR_NAME || entry.name === CONFIG_DIR_NAME || entry.name === TRASH_DIR_NAME) continue;

            const relPath = path.join(dir, entry.name).replace(/\\/g, "/");

            if (entry.isDirectory()) {
                results = results.concat(await getAllFiles(relPath));
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (config.upload.allowedExtensions.includes(ext)) {
                    const filePath = path.join(absDir, entry.name);
                    const stat = await fs.stat(filePath);
                    results.push({ relPath, filePath, stat });
                }
            }
        }
    } catch (e) {
        // ignore
    }
    return results;
}

// 有界并发池：并行处理 items，最多同时运行 limit 个，避免主线程长时间阻塞 / 压垮单核
async function mapPool(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const idx = cursor++;
            results[idx] = await fn(items[idx], idx);
        }
    });
    await Promise.all(workers);
    return results;
}

const SYNC_CONCURRENCY = 4; // 元数据抽取（sharp / exifr / thumbhash）并发数，留余量

async function syncFileSystem() {
    const t0 = Date.now();
    console.log("Starting file system sync...");
    const diskFiles = await getAllFiles("");
    const tScan = Date.now();
    const dbSyncEntries = imageRepository.getAllSyncEntries();

    const diskMap = new Map(diskFiles.map(f => [f.relPath, f]));
    const dbMap = new Map(dbSyncEntries.map(i => [i.rel_path, i]));

    // 收集需要新增 / 更新的文件（先比对，不立即写库）
    const pending = [];
    for (const file of diskFiles) {
        const dbEntry = dbMap.get(file.relPath);
        if (!dbEntry) {
            pending.push({ file, op: "add" });
        } else if (Math.abs(dbEntry.mtime - file.stat.mtime.getTime()) > 1000) { // 1 秒容差
            pending.push({ file, op: "update" });
        }
    }

    // 并发抽取元数据（CPU/IO 密集），用有界并发池并行 + 避免主线程长时间阻塞
    const toAdd = [];
    const toUpdate = [];
    await mapPool(pending, SYNC_CONCURRENCY, async ({ file, op }) => {
        try {
            const metadata = await getFileMetadata(file.filePath, file.relPath, file.stat);
            const row = { filename: path.basename(file.relPath), rel_path: file.relPath, ...metadata };
            if (op === "add") toAdd.push(row);
            else toUpdate.push(row);
        } catch (e) {
            console.error(`Failed to sync ${file.relPath}`, e);
        }
    });
    const tMeta = Date.now();

    // 批量写入：包成单次事务，把 N 次 fsync 降到约 1 次（NAS 网络存储关键优化）
    if (toAdd.length) imageRepository.insertMany(toAdd);
    if (toUpdate.length) {
        imageRepository.transaction((rows) => { for (const r of rows) imageRepository.update(r); })(toUpdate);
    }

    // 删除：DB 中存在但磁盘已不存在，同样包进事务
    const missing = dbSyncEntries.filter(img => !diskMap.has(img.rel_path));
    if (missing.length) {
        imageRepository.transaction((rows) => { for (const r of rows) imageRepository.delete(r.rel_path); })(missing);
    }
    const tWrite = Date.now();

    const fmt = (ms) => `${(ms / 1000).toFixed(2)}s`;
    console.log(`Sync completed. Added ${toAdd.length}, updated ${toUpdate.length}, removed ${missing.length}.`);
    console.log(`[sync timing] scan=${fmt(tScan - t0)}  metadata(concurrency=${SYNC_CONCURRENCY})=${fmt(tMeta - tScan)} \
    dbWrite=${fmt(tWrite - tMeta)}  total=${fmt(tWrite - t0)}  files=${diskFiles.length}`);
}

module.exports = {
    migrateFromLegacyJson,
    syncFileSystem
};
