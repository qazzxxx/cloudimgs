const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');
const sharp = require('sharp');
sharp.cache(false);
const config = require('../../config');
const imageRepository = require('../db/imageRepository');
const { requirePassword } = require('../middleware/auth');
const { safeJoin } = require('../utils/fileUtils');
const { formatImageResponse } = require('../utils/urlUtils');

const router = express.Router();
const STORAGE_PATH = config.storage.path;

const { isAlbumLocked, verifyAlbumPassword, getAllLockedDirectories } = require('../utils/albumUtils');

// 地图数据 (旧端点支持，现在仅返回 DB 中的所有图像？)
// 原始 updateMapCache 返回所有图像。
router.get('/map-data', requirePassword, async (req, res) => {
    // 返回所有带 GPS 数据的图像
    // 我们可以在 SQL 或 JS 中过滤。
    // 目前获取所有并返回所需字段。
    const lockedDirs = await getAllLockedDirectories();
    const images = imageRepository.getGpsImages();
    const mapData = images.filter(img => {
        if (lockedDirs.some(lockedDir => img.rel_path.startsWith(lockedDir + "/"))) return false;
        return true;
    }).map(img => {
        const formatted = formatImageResponse(req, img);
        return {
            filename: img.filename,
            relPath: img.rel_path,
            lat: img.lat,
            lng: img.lng,
            date: img.upload_time,
            thumbUrl: `${formatted.url}?w=200`,
            thumbhash: img.thumbhash,
            fullUrl: formatted.fullUrl,
            url: formatted.url
        };
    });
    res.json({ success: true, data: mapData });
});

// 目录列表
router.get('/directories', requirePassword, async (req, res) => {
    try {
        const { CACHE_DIR_NAME, CONFIG_DIR_NAME, TRASH_DIR_NAME } = require('../utils/fileUtils');

        // 扫描目录
        async function getDirectories(dir) {
            const absDir = safeJoin(STORAGE_PATH, dir);
            let results = [];
            try {
                const files = await fs.readdir(absDir);
                for (const file of files) {
                    if (file === CACHE_DIR_NAME || file === CONFIG_DIR_NAME || file === TRASH_DIR_NAME) continue;
                    if (file.startsWith('.')) continue; // 跳过隐藏文件

                    const filePath = path.join(absDir, file);
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) {
                        const relPath = path.join(dir, file).replace(/\\/g, "/");

                        // 从 DB 获取预览图和计数
                        // 注意：这会递归获取计数/预览，这通常是用户期望的“相册”封面
                        const isLocked = await isAlbumLocked(relPath);
                        let previews = [];
                        if (!isLocked) {
                            previews = imageRepository.getPreviews(relPath, 3).map(img =>
                                `/api/images/${img.rel_path.split("/").map(encodeURIComponent).join("/")}?w=400`
                            );
                        }
                        const count = imageRepository.countByDir(relPath);

                        results.push({
                            name: file,
                            path: relPath,
                            fullUrl: relPath, // alias
                            previews,
                            locked: isLocked, // 标记为锁定隐私状态
                            imageCount: count,
                            mtime: stats.mtime // 文件夹本身的最后修改时间
                        });

                        // 递归扫描子相册？
                        // 如果显示树形结构，我们需要子项。
                        // 但通常典型的“相册视图”是直接子文件夹的平铺列表。
                        // 之前的代码是递归的：`results = results.concat(children);`
                        // 如果保持递归，我们将获得所有扁平化的子文件夹。
                        // UI 是否期望这样？
                        // `AlbumManager` 使用 `allAlbums`。它似乎将它们显示为卡片。
                        // 如果我有 A/B/C，我会看到 A、B 和 C 吗？
                        // 如果我看到 A并在其中点击，通常会进入 A。
                        // UI `AlbumManager` 过滤？
                        // `const allAlbums = res.data.data || [];`
                        // `setAlbums([allImagesAlbum, ...allAlbums]);`
                        // 它配置网格。
                        // 如果 API 返回所有目录的扁平列表，那么是的，递归是可以的。
                        // 让我们保持递归结构原样。

                        const children = await getDirectories(relPath);
                        results = results.concat(children);
                    }
                }
            } catch (e) { }
            return results;
        }

        const directories = await getDirectories("");
        res.json({ success: true, data: directories });

    } catch (e) {
        console.error("List directories error:", e);
        res.status(500).json({ error: "Get directories failed" });
    }
});

// 图片列表
router.get('/images', requirePassword, async (req, res) => {
    try {
        let dir = req.query.dir || "";
        dir = dir.replace(/\\/g, "/");
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const search = req.query.search || "";

        const albumPassword = req.headers["x-album-password"];
        if (dir && await isAlbumLocked(dir)) {
            if (!albumPassword || !(await verifyAlbumPassword(dir, albumPassword))) {
                return res.status(403).json({ success: false, error: "需要访问密码", locked: true });
            }
        }

        // 使用 SQL 分页，避免全量加载
        // 无目录时需过滤锁定相册（通常很少，退回内存过滤）
        if (!dir) {
            const lockedDirs = await getAllLockedDirectories();
            if (lockedDirs.length > 0) {
                const total = imageRepository.countExclude(lockedDirs, search);
                const paginated = imageRepository.getPaginatedExclude(lockedDirs, search, page, pageSize);
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                return res.json({
                    success: true, data: paginated.map(img => formatImageResponse(req, img)),
                    pagination: { current: page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
                });
            }
        }

        const total = imageRepository.countPaginated(dir, search);
        const paginated = imageRepository.getPaginated(dir, page, pageSize, search);

        const result = paginated.map(img => formatImageResponse(req, img));

        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.json({
            success: true,
            data: result,
            pagination: {
                current: page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });

    } catch (e) {
        console.error("List images error:", e);
        res.status(500).json({ error: "获取图片列表失败" });
    }
});

// 提取图片元数据
router.get('/images/meta/*', requirePassword, async (req, res) => {
    const relPath = decodeURIComponent(req.params[0]);
    const dbImage = imageRepository.getByPath(relPath);

    if (!dbImage) {
        // 回退到 FS 检查？
        if (!await fs.pathExists(safeJoin(STORAGE_PATH, relPath))) {
            return res.status(404).json({ success: false, error: "图片不存在" });
        }
        // 如果存在于 FS 但不在 DB 中，也许同步服务丢失了它？返回基本信息
    }

    // DB lookup first
    let fileInfo = {};
    if (dbImage) {
        fileInfo = {
            width: dbImage.width,
            height: dbImage.height,
            orientation: dbImage.orientation,
            ...JSON.parse(dbImage.meta_json || '{}')
        };
    }

    try {
        const filePath = safeJoin(STORAGE_PATH, relPath);
        const fstats = await fs.stat(filePath);
        const mimeType = mime.lookup(filePath) || "application/octet-stream";

        if (!fileInfo.space || !fileInfo.width) {
            const { getFileMetadata } = require('../services/metadataService');
            const freshMeta = await getFileMetadata(filePath, relPath, fstats);

            // Merge fresh meta
            const freshJson = JSON.parse(freshMeta.meta_json);
            fileInfo = {
                ...fileInfo,
                width: freshMeta.width,
                height: freshMeta.height,
                orientation: freshMeta.orientation,
                ...freshJson
            };

            // Optionally update DB here? Maybe too heavy for a GET request. 
            // Let's just return it for now.
        }

        const rawInfo = {
            filename: path.basename(relPath),
            rel_path: relPath, // helper expects rel_path
            size: fstats.size,
            upload_time: fstats.mtime.toISOString(), // helper expects upload_time
            mime_type: mimeType,
            width: fileInfo.width,
            height: fileInfo.height,
            meta_json: fileInfo // helper can take object
        };

        res.json({
            success: true,
            data: formatImageResponse(req, rawInfo)
        });

    } catch (e) {
        console.error("Meta error:", e);
        res.status(400).json({ success: false, error: "Error fetching metadata" });
    }
});

// 辅助函数：处理并发送图片
async function serveImage(req, res, relPath) {
    try {
        const filePath = safeJoin(STORAGE_PATH, relPath);
        if (!await fs.pathExists(filePath)) return res.status(404).json({ error: "Not found" });

        const { w, h, q, fmt, rows, cols, idx } = req.query;

        // 对 GIF 文件且无任何处理参数时，直接返回原始文件（保留动画）
        const fileMime = (mime.lookup(filePath) || "").toLowerCase();
        const isGif = fileMime.includes("gif");
        if (isGif && !w && !h && !q && !fmt && !rows && !cols) {
            try {
                const stats = await fs.stat(filePath);
                imageRepository.recordView(stats.size);
                imageRepository.incrementViews(relPath);
            } catch (e) { }
            res.setHeader("Content-Type", "image/gif");
            res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
            return res.sendFile(filePath);
        }

        // Sharp 逻辑
        try {
            // GIF 缩略图：明确只取第一帧（animated: false 是 sharp 默认行为，此处显式声明）
            let img = isGif
                ? sharp(filePath, { animated: false }).rotate()
                : sharp(filePath).rotate();

            // 2. 处理网格切分 (Slicing)
            if (rows && cols && idx !== undefined) {
                const r = parseInt(rows);
                const c = parseInt(cols);
                const i = parseInt(idx);

                if (r > 0 && c > 0 && i >= 0 && i < r * c) {
                    const meta = await img.metadata();
                    const width = meta.width;
                    const height = meta.height;

                    const subW = Math.floor(width / c);
                    const subH = Math.floor(height / r);

                    const row = Math.floor(i / c);
                    const col = i % c;

                    const left = col * subW;
                    const top = row * subH;

                    // 防止舍入误差导致溢出
                    const extractW = Math.min(subW, width - left);
                    const extractH = Math.min(subH, height - top);

                    img.extract({ left, top, width: extractW, height: extractH });

                }
            }

            // 3. 处理缩放 (Resize) - 针对切分后的图（或者原图）
            if (w || h) {
                img = img.resize({
                    width: w ? parseInt(w) : null,
                    height: h ? parseInt(h) : null,
                    fit: "cover",
                    position: "center",
                    withoutEnlargement: true,
                });
            }

            let outMime = mime.lookup(filePath) || "application/octet-stream";
            if (fmt === "webp") {
                img = img.webp({ quality: q ?? 80 });
                outMime = "image/webp";
            } else if (fmt === "jpeg") {
                img = img.jpeg({ quality: q ?? 80 });
                outMime = "image/jpeg";
            } else if (fmt === "png") {
                img = img.png();
                outMime = "image/png";
            } else if (fmt === "avif") {
                img = img.avif({ quality: q ?? 50 });
                outMime = "image/avif";
            } else if (q) {
                const orig = (mime.lookup(filePath) || "").toLowerCase();
                if (orig.includes("jpeg") || orig.includes("jpg")) {
                    img = img.jpeg({ quality: q });
                    outMime = "image/jpeg";
                } else if (orig.includes("webp")) {
                    img = img.webp({ quality: q });
                    outMime = "image/webp";
                } else if (orig.includes("avif")) {
                    img = img.avif({ quality: q });
                    outMime = "image/avif";
                } else {
                    img = img.png();
                    outMime = "image/png";
                }
            }

            const buffer = await img.toBuffer();

            // Record Stats (Fire and forget)
            try {
                imageRepository.recordView(buffer.length);
                imageRepository.incrementViews(relPath);
            } catch (e) {
                console.error("Stats error", e);
            }

            res.setHeader("Content-Type", outMime);
            res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
            res.send(buffer);
        } catch (e) {
            // 对非图像文件或 sharp 错误的回退
            if (!w && !h && !q && !fmt) {
                // Record Stats for raw file
                try {
                    const stats = await fs.stat(filePath);
                    imageRepository.recordView(stats.size);
                    imageRepository.incrementViews(relPath);
                } catch (e) { }

                res.setHeader("Content-Type", mime.lookup(filePath) || 'application/octet-stream');
                return res.sendFile(filePath);
            }
            res.status(500).json({ error: "Image processing failed" });
        }

    } catch (e) {
        res.status(400).json({ error: "Error" });
    }
}

// 随机图片 (GET)
// 支持 ?dir=xxx 参数来限定目录
router.get('/random', async (req, res) => {
    try {
        let dir = req.query.dir || "";
        dir = dir.replace(/\\/g, "/");

        // 使用 SQL 随机选取，避免全量加载
        if (!dir) {
            const lockedDirs = await getAllLockedDirectories();
            if (lockedDirs.length > 0) {
                const randomImage = imageRepository.getRandomExclude(lockedDirs);
                if (!randomImage) return res.status(404).json({ error: "Not Found" });
                if (req.query.format === 'json') return res.json(formatImageResponse(req, randomImage));
                return await serveImage(req, res, randomImage.rel_path);
            }
        }

        const randomImage = dir ? imageRepository.getRandomByDir(dir) : imageRepository.getRandom();
        if (!randomImage) return res.status(404).json({ error: "Not Found" });

        if (req.query.format === 'json') {
            return res.json(formatImageResponse(req, randomImage));
        }

        await serveImage(req, res, randomImage.rel_path);

    } catch (e) {
        console.error("Random image error:", e);
        res.status(500).json({ error: "Failed to get random image" });
    }
});

// 服务图片内容
router.get('/images/*', async (req, res) => {
    const relPath = decodeURIComponent(req.params[0]);
    await serveImage(req, res, relPath);
});

// 服务原始文件（无处理）
router.get('/files/*', (req, res) => {
    const relPath = decodeURIComponent(req.params[0]);
    try {
        const filePath = safeJoin(STORAGE_PATH, relPath);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: "Not found" });
        }
    } catch (e) {
        res.status(400).json({ error: "Error" });
    }
});

module.exports = router;
