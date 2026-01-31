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
        const files = await fs.readdir(absDir);
        for (const file of files) {
            if (file === CACHE_DIR_NAME || file === CONFIG_DIR_NAME || file === TRASH_DIR_NAME) continue;

            const filePath = path.join(absDir, file);
            const relPath = path.join(dir, file).replace(/\\/g, "/");
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                results = results.concat(await getAllFiles(relPath));
            } else {
                const ext = path.extname(file).toLowerCase();
                if (config.upload.allowedExtensions.includes(ext)) {
                    results.push({
                        relPath,
                        filePath,
                        stat
                    });
                }
            }
        }
    } catch (e) {
        // ignore
    }
    return results;
}

async function syncFileSystem() {
    console.log("Starting file system sync...");
    const diskFiles = await getAllFiles("");
    const dbImages = imageRepository.getAll();

    const diskMap = new Map(diskFiles.map(f => [f.relPath, f]));
    const dbMap = new Map(dbImages.map(i => [i.rel_path, i]));

    // 1. 磁盘上的文件但不在 DB 中（新增）
    // 2. 磁盘上的文件在 DB 中（如果修改则更新）
    for (const file of diskFiles) {
        const dbEntry = dbMap.get(file.relPath);

        if (!dbEntry) {
            // 新文件
            try {
                const metadata = await getFileMetadata(file.filePath, file.relPath, file.stat);
                imageRepository.add({
                    filename: path.basename(file.relPath),
                    rel_path: file.relPath,
                    ...metadata
                });
                // console.log(`Synced new file: ${file.relPath}`);
            } catch (e) {
                console.error(`Failed to sync file ${file.relPath}`, e);
            }
        } else {
            // 现有文件，检查 mtime
            // 注意：dbEntry.mtime 来自 DB
            if (Math.abs(dbEntry.mtime - file.stat.mtime.getTime()) > 1000) { // 1 秒容差
                console.log(`Updating modified file: ${file.relPath}`);
                try {
                    const metadata = await getFileMetadata(file.filePath, file.relPath, file.stat);
                    imageRepository.update({
                        filename: path.basename(file.relPath),
                        rel_path: file.relPath,
                        ...metadata
                    });
                } catch (e) { console.error(`Failed to update ${file.relPath}`, e); }
            }
        }
    }

    // 3. 在 DB 中但不在磁盘上（删除）
    for (const img of dbImages) {
        if (!diskMap.has(img.rel_path)) {
            console.log(`Removing missing file from DB: ${img.rel_path}`);
            imageRepository.delete(img.rel_path);
        }
    }
    console.log("Sync completed.");
}

module.exports = {
    migrateFromLegacyJson,
    syncFileSystem
};
