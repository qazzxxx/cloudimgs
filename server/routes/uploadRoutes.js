const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { upload, uploadAny, handleMulterError } = require('../middleware/upload');
const { requirePassword } = require('../middleware/auth');
const { saveBase64Image, safeJoin, sanitizeFilename, generateThumbHash } = require('../utils/fileUtils');
const imageRepository = require('../db/imageRepository');
const { getFileMetadata, parseAudioDuration } = require('../services/metadataService');

const router = express.Router();
const STORAGE_PATH = config.storage.path;

function getBaseUrl(req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const protocol = Array.isArray(proto) ? proto[0] : String(proto).split(",")[0].trim();
    const host = req.headers["x-forwarded-host"] || req.get("host");
    return `${protocol}://${host}`;
}

// 1. Base64 上传
router.post('/upload-base64', requirePassword, async (req, res) => {
    try {
        let dir = req.body.dir || req.query.dir || "";
        dir = dir.replace(/\\/g, "/");

        if (!req.body.base64Image) {
            return res.status(400).json({ success: false, error: "缺少 base64Image 参数" });
        }

        const { filename, filePath, size, mimetype } = await saveBase64Image(req.body.base64Image, dir);
        const relPath = path.join(dir, filename).replace(/\\/g, "/");

        // 生成元数据和 DB 条目
        const metadata = await getFileMetadata(filePath, relPath);
        // Base64 上传通常没有原始名称，使用清理后的文件名或提供的名称
        const originalName = req.body.originalName || filename;

        const fileInfo = {
            filename: metadata.filename || filename, // metadata might not have filename set if constructed manually
            rel_path: relPath,
            ...metadata
        };

        // 确保文件名在 DB 对象中设置（getFileMetadata 返回带有 size, mtime 等的对象）
        // imageRepository 期望：filename, rel_path, ...metadata
        imageRepository.add({
            filename: sanitizeFilename(originalName),
            rel_path: relPath,
            ...metadata
        });

        // Record Upload Stats
        imageRepository.recordUpload(size);

        res.json({
            success: true,
            message: "base64 图片上传成功",
            data: {
                filename: fileInfo.filename,
                originalName: originalName,
                size: size,
                mimetype: mimetype,
                uploadTime: fileInfo.upload_time, // 注意：DB 使用下划线，API 通常期望驼峰式？旧 API 使用 uploadTime。
                url: `/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
                relPath,
                thumbhash: metadata.thumbhash,
                fullUrl: `${getBaseUrl(req)}/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
            }
        });
    } catch (error) {
        console.error("base64 上传错误:", error);
        return res.status(400).json({ success: false, error: error.message || "base64 图片处理失败" });
    }
});

// 1.1 上传图片 (Multer)
router.post('/upload', requirePassword, upload.any(), handleMulterError, async (req, res) => {
    try {
        let dir = req.body.dir || req.query.dir || "";
        dir = dir.replace(/\\/g, "/");

        if (req.files && req.files.length > 0) req.file = req.files[0];
        if (!req.file) return res.status(400).json({ success: false, error: "没有选择文件" });

        // 如果需要移动文件（multer storage 逻辑基本已处理，但需再次检查？）
        // 自定义 multer storage 已经将其放置在正确的目录和名称下。
        // 所以 req.file.path 是正确的。

        const relPath = path.join(dir, req.file.filename).replace(/\\/g, "/");

        // 元数据与数据库
        const metadata = await getFileMetadata(req.file.path, relPath);

        // 原始名称处理
        let originalName = req.file.originalname;
        if (!/[^\u0000-\u00ff]/.test(originalName)) {
            try { originalName = Buffer.from(originalName, "latin1").toString("utf8"); } catch (e) { }
        }

        imageRepository.add({
            filename: req.file.filename, // 这是磁盘上的保存文件名
            rel_path: relPath,
            ...metadata
        });

        // Record Upload Stats
        imageRepository.recordUpload(req.file.size);

        res.json({
            success: true,
            message: "图片上传成功",
            data: {
                filename: req.file.filename,
                originalName: originalName,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadTime: metadata.upload_time,
                url: `/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
                relPath,
                fullUrl: `${getBaseUrl(req)}/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
                thumbhash: metadata.thumbhash,
            }
        });

    } catch (error) {
        console.error("上传错误:", error);
        res.status(500).json({ success: false, error: "上传失败，请稍后重试" });
    }
});

// 1.2 上传文件 (任意)
router.post('/upload-file', requirePassword, uploadAny.single("file"), handleMulterError, async (req, res) => {
    // 类似于 index.js 中的 upload-file，但需要添加到 DB 吗？
    // 用户要求“读取图片列表也扫描所有图片”，暗示 DB 用于图片。
    // 但是，如果我们上传非图片，它们应该在 DB 中吗？
    // Schema 有 `images` 表。
    // 以前的系统使用 `img_metadata.json`，似乎只跟踪...图片？
    // 辅助函数 `getAllImages` 按扩展名过滤。
    // 但可能需要 `getAllFiles`。
    // 现在假设我们只索引符合“允许的扩展名”的图片项，
    // 或者我们索引所有内容但表名为 'files'？
    // 提示文本：“读取图片列表也需要扫描所有图片”。
    // 我将表命名为 `images`。
    // 如果我上传一个 .txt 文件，并且用户想要列出“文件”，则使用了 `upload-file` 端点。
    // `getAllImages` 由 `config.upload.allowedExtensions` 过滤。
    // 所以 `upload-file` 可能会上传非图片内容。
    // 如果它们不是图片，也许我们暂不将它们索引到 `images` 表中？
    // 或者我们将 `images` 表扩展为 `files`。
    // 鉴于请求“升级后端...优化大文件处理...读取图片列表”，
    // 我将坚持索引配置中被视为“图片”的内容。
    // 如果 `upload-file` 上传 mp3，我们可能尚未将其索引到 `images` 表中，或者我们应该索引所有内容。
    // 让我们检查 `config.upload.allowedExtensions`。
    // 以前的 `getAllImages` 只返回 `allowedExtensions` 中的内容。
    // 所以如果我上传 MP3（可能不在 *images* 的 allowedExtensions 中？），它无论如何都不会显示在图片列表中。
    // 但等等，用户历史记录中有“parseMp3Duration”。
    // 如果 `upload-file` 用于 mp3，`getAllImages` 会返回吗？
    // 检查 `isAllowedFile`... `config.upload.allowedExtensions`。
    // 如果 mp3 在 allowedExtensions 中，它将被索引。
    // 我将假设严格遵循 `allowedExtensions` 进行索引。

    try {
        if (!req.file) return res.status(400).json({ success: false, error: "没有选择文件" });

        let dir = req.body.dir || req.query.dir || "";
        dir = dir.replace(/\\/g, "/");

        // ... (Renaming logic from original index.js) ...
        // I will implement the renaming logic here or just rely on multer?
        // Multer handled basic naming. `upload-file` had custom "manual rename" logic.
        // I need to port that logic manually.

        const customFilename = req.body.filename || req.query.filename;
        let finalFilename = req.file.filename;
        let displayName = req.file.originalname;

        if (customFilename) {
            // Logic for renaming...
            const safeCustom = sanitizeFilename(customFilename);
            const targetDir = safeJoin(STORAGE_PATH, dir);
            const oldPath = req.file.path;
            let newPath = path.join(targetDir, safeCustom);

            // Duplicate check
            let counter = 1;
            const ext = path.extname(safeCustom);
            const nameBase = path.basename(safeCustom, ext);

            if (!config.upload.allowDuplicateNames) {
                while (fs.existsSync(newPath)) {
                    if (config.upload.duplicateStrategy === 'timestamp') {
                        newPath = path.join(targetDir, `${nameBase}_${Date.now()}_${counter}${ext}`);
                    } else {
                        newPath = path.join(targetDir, `${nameBase}_${counter}${ext}`);
                    }
                    counter++;
                }
            }
            finalFilename = path.basename(newPath);
            displayName = customFilename;
            if (oldPath !== newPath) {
                fs.renameSync(oldPath, newPath);
            }
        }

        const relPath = path.join(dir, finalFilename).replace(/\\/g, "/");
        const filePath = safeJoin(STORAGE_PATH, relPath);

        // Check if we should index it
        const ext = path.extname(finalFilename).toLowerCase();
        // Only index if it matches allowable extensions for the "Image List"
        // If the user uploads a generic file that isn't 'allowed' for images, we just leave it on disk
        // but don't add to DB.
        if (config.upload.allowedExtensions.includes(ext)) {
            const metadata = await getFileMetadata(filePath, relPath);
            imageRepository.add({
                filename: finalFilename,
                rel_path: relPath,
                ...metadata
            });
        }

        // Duration logic
        let duration = null;
        if (req.file.mimetype === 'audio/mpeg' || (customFilename && customFilename.toLowerCase().endsWith('.mp3'))) {
            try {
                // We can use the logic from metadataService!
                const d = await parseAudioDuration(filePath);
                if (d) duration = parseFloat((Math.ceil(d * 1000) / 1000).toFixed(2));
            } catch (e) { }
        }

        // Record Upload Stats
        imageRepository.recordUpload(req.file.size);

        res.json({
            success: true,
            message: "文件上传成功",
            data: {
                filename: finalFilename,
                originalName: displayName,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadTime: new Date().toISOString(),
                url: `/api/files/${relPath.split("/").map(encodeURIComponent).join("/")}`,
                relPath,
                fullUrl: `${getBaseUrl(req)}/api/files/${relPath.split("/").map(encodeURIComponent).join("/")}`,
                ...(duration && { duration })
            }
        });

    } catch (error) {
        console.error("文件上传错误:", error);
        res.status(500).json({ success: false, error: "文件上传失败" });
    }
});

module.exports = router;
