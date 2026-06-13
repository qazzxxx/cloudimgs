const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { upload, uploadAny, handleMulterError } = require('../middleware/upload');
const { requirePassword } = require('../middleware/auth');
const { saveBase64Image, safeJoin, sanitizeFilename, generateThumbHash, downloadFromUrl } = require('../utils/fileUtils');
const { formatImageResponse } = require('../utils/urlUtils');
const imageRepository = require('../db/imageRepository');
const { getFileMetadata, parseAudioDuration } = require('../services/metadataService');
const clipService = require('../services/clipService'); // 引入 ClipService
const sharp = require('sharp');

const router = express.Router();
const STORAGE_PATH = config.storage.path;

function queueForMagicSearch(dbResult, relPath, filename, priority) {
    try {
        let imageId = dbResult.lastInsertRowid;
        if (!imageId || imageId.toString() === '0') {
            const existing = imageRepository.getByPath(relPath);
            if (existing) imageId = existing.id;
        }
        if (imageId) {
            clipService.addToQueue({ id: imageId, rel_path: relPath, filename }, priority);
        }
    } catch (queueErr) {
        console.error("Queue error:", queueErr);
    }
}

function getBaseUrl(req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const protocol = Array.isArray(proto) ? proto[0] : String(proto).split(",")[0].trim();
    const host = req.headers["x-forwarded-host"] || req.get("host");
    return `${protocol}://${host}`;
}

// 1. Base64 上传
router.post('/upload-base64', requirePassword, express.json({ limit: '50mb' }), async (req, res) => {
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
        const dbResult = imageRepository.add({
            filename: sanitizeFilename(originalName),
            rel_path: relPath,
            ...metadata
        });

        // 添加到魔法搜图队列
        queueForMagicSearch(dbResult, relPath, fileInfo.filename);

        // 记录上传统计信息
        imageRepository.recordUpload(size);

        // 使用 helper 格式化
        const formatted = formatImageResponse(req, imageRepository.getByPath(relPath) || {
            filename: fileInfo.filename,
            rel_path: relPath,
            width: metadata.width,
            height: metadata.height,
            size: size,
            upload_time: fileInfo.upload_time,
            mime_type: mimetype,
            thumbhash: metadata.thumbhash
        });

        res.json({
            success: true,
            message: "base64 图片上传成功",
            data: {
                ...formatted,
                originalName: originalName,
                mimetype: mimetype
            }
        });
    } catch (error) {
        console.error("base64 上传错误:", error);
        return res.status(400).json({ success: false, error: error.message || "base64 图片处理失败" });
    }
});

// 1.0 URL 上传
router.post('/upload-url', requirePassword, express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: "缺少 url 参数" });
        }

        let dir = req.body.dir || "";
        dir = dir.replace(/\\/g, "/");

        // Download image from URL
        let imageData;
        try {
            imageData = await downloadFromUrl(url);
        } catch (downloadErr) {
            return res.status(400).json({ success: false, error: `下载图片失败: ${downloadErr.message}` });
        }

        // Convert to base64 and save
        const base64Data = `data:${imageData.mimetype};base64,${imageData.buffer.toString('base64')}`;
        const { filename, filePath, size, mimetype } = await saveBase64Image(base64Data, dir);
        const relPath = path.join(dir, filename).replace(/\\/g, "/");

        // Generate metadata
        const metadata = await getFileMetadata(filePath, relPath);

        // Extract original name from URL if possible
        const urlPathname = new URL(url).pathname;
        const urlFilename = decodeURIComponent(urlPathname.split('/').pop() || filename);
        const ext = path.extname(urlFilename);
        const nameWithoutExt = path.basename(urlFilename, ext);
        const originalName = ext ? `${nameWithoutExt}${ext}` : filename;

        const dbResult = imageRepository.add({
            filename: sanitizeFilename(originalName),
            rel_path: relPath,
            ...metadata
        });

        // Add to magic search queue
        queueForMagicSearch(dbResult, relPath, originalName);

        // Record upload stats
        imageRepository.recordUpload(size);

        const formatted = formatImageResponse(req, imageRepository.getByPath(relPath) || {
            filename: originalName,
            rel_path: relPath,
            width: metadata.width,
            height: metadata.height,
            size: size,
            upload_time: metadata.upload_time,
            mime_type: mimetype,
            thumbhash: metadata.thumbhash
        });

        res.json({
            success: true,
            message: "URL 图片上传成功",
            data: {
                ...formatted,
                originalName: originalName,
                mimetype: mimetype
            }
        });
    } catch (error) {
        console.error("URL 上传错误:", error);
        return res.status(500).json({ success: false, error: error.message || "URL 图片上传失败" });
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

        const dbResult = imageRepository.add({
            filename: req.file.filename, // 这是磁盘上的保存文件名
            rel_path: relPath,
            ...metadata
        });


        // 添加到魔法搜图队列
        queueForMagicSearch(dbResult, relPath, req.file.filename, 'high');

        // 记录上传统计信息
        imageRepository.recordUpload(req.file.size);

        // Helper
        const formatted = formatImageResponse(req, {
            filename: req.file.filename,
            rel_path: relPath,
            width: metadata.width,
            height: metadata.height,
            size: req.file.size,
            upload_time: metadata.upload_time,
            mime_type: req.file.mimetype,
            thumbhash: metadata.thumbhash
        });

        res.json({
            success: true,
            message: "图片上传成功",
            data: {
                ...formatted,
                originalName: originalName,
                mimetype: req.file.mimetype
            }
        });

    } catch (error) {
        console.error("上传错误:", error);
        res.status(500).json({ success: false, error: "上传失败，请稍后重试" });
    }
});

// 1.2 处理图片（缩放+居中合成到指定尺寸）
router.post('/process-image', requirePassword, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "没有选择图片文件" });
      }

      const width = parseInt(req.body.width || req.query.width);
      const height = parseInt(req.body.height || req.query.height);

      if (!width || !height || width <= 0 || height <= 0) {
        return res.status(400).json({ error: "请提供有效的宽度和高度参数" });
      }

      let dir = req.body.dir || req.query.dir || "";
      dir = dir.replace(/\\/g, "/");

      const inputBuffer = await fs.readFile(req.file.path);
      const metadata = await sharp(inputBuffer).metadata();

      const scaleX = width / metadata.width;
      const scaleY = height / metadata.height;
      const scale = Math.min(scaleX, scaleY);

      const scaledWidth = Math.round(metadata.width * scale);
      const scaledHeight = Math.round(metadata.height * scale);

      const left = Math.round((width - scaledWidth) / 2);
      const top = Math.round((height - scaledHeight) / 2);

      const processedBuffer = await sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([
          {
            input: await sharp(inputBuffer)
              .resize(scaledWidth, scaledHeight)
              .toBuffer(),
            left: left,
            top: top
          }
        ])
        .png()
        .toBuffer();

      let originalName = req.file.originalname;
      if (!/[^ -ÿ]/.test(originalName)) {
        try { originalName = Buffer.from(originalName, "latin1").toString("utf8"); } catch (e) { }
      }

      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      let processedFilename = `${nameWithoutExt}_processed_${width}x${height}.png`;
      processedFilename = sanitizeFilename(processedFilename);

      const dest = safeJoin(STORAGE_PATH, dir);
      await fs.ensureDir(dest);

      let finalFilename = processedFilename;
      let counter = 1;

      if (!config.upload.allowDuplicateNames) {
        while (fs.existsSync(path.join(dest, finalFilename))) {
          if (config.upload.duplicateStrategy === "timestamp") {
            finalFilename = `${nameWithoutExt}_processed_${width}x${height}_${Date.now()}_${counter}.png`;
          } else if (config.upload.duplicateStrategy === "counter") {
            finalFilename = `${nameWithoutExt}_processed_${width}x${height}_${counter}.png`;
          } else if (config.upload.duplicateStrategy === "overwrite") {
            break;
          }
          counter++;
        }
      }

      const processedFilePath = path.join(dest, finalFilename);
      await fs.writeFile(processedFilePath, processedBuffer);
      await fs.remove(req.file.path);

      const relPath = path.join(dir, finalFilename).replace(/\\/g, "/");

      // 入库
      try {
          const fileMetadata = await getFileMetadata(processedFilePath, relPath);
          imageRepository.add({
              filename: finalFilename,
              rel_path: relPath,
              ...fileMetadata
          });
      } catch (dbErr) {
          console.error("Failed to index processed image:", dbErr);
      }

      const fileInfo = {
        filename: finalFilename,
        originalName: originalName,
        processedSize: { width, height },
        originalSize: { width: metadata.width, height: metadata.height },
        size: processedBuffer.length,
        mimetype: "image/png",
        uploadTime: new Date().toISOString(),
        url: `/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
        relPath,
        fullUrl: `${getBaseUrl(req)}/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
      };

      res.json({
        success: true,
        message: "图片处理成功",
        data: fileInfo,
      });
    } catch (error) {
      console.error("图片处理错误:", error);
      if (req.file && req.file.path) {
        try { await fs.remove(req.file.path); } catch (cleanupError) { }
      }
      res.status(500).json({ error: "图片处理失败" });
    }
});

// 1.3 上传文件 (任意)
router.post('/upload-file', requirePassword, uploadAny.single("file"), handleMulterError, async (req, res) => {

    try {
        if (!req.file) return res.status(400).json({ success: false, error: "没有选择文件" });

        let dir = req.body.dir || req.query.dir || "";
        dir = dir.replace(/\\/g, "/");

        // ... (来自原始 index.js 的重命名逻辑) ...
        // 我将在此处实现重命名逻辑，还是仅依赖 multer？
        // Multer 处理了基本命名。`upload-file` 具有自定义的“手动重命名”逻辑。
        // 我需要手动移植该逻辑。

        const customFilename = req.body.filename || req.query.filename;
        let finalFilename = req.file.filename;
        let displayName = req.file.originalname;

        if (customFilename) {
            const safeCustom = sanitizeFilename(path.basename(customFilename));
            const targetDir = safeJoin(STORAGE_PATH, dir);
            const oldPath = req.file.path;
            const newPath = path.join(targetDir, safeCustom);

            if (oldPath !== newPath) {
                await fs.ensureDir(targetDir);
                let counter = 1;
                const ext = path.extname(safeCustom);
                const nameBase = path.basename(safeCustom, ext);
                let targetPath = newPath;

                if (!config.upload.allowDuplicateNames) {
                    while (await fs.pathExists(targetPath)) {
                        if (config.upload.duplicateStrategy === 'timestamp') {
                            safeCustom = `${nameBase}_${Date.now()}_${counter}${ext}`;
                        } else {
                            safeCustom = `${nameBase}_${counter}${ext}`;
                        }
                        targetPath = path.join(targetDir, safeCustom);
                        counter++;
                    }
                }

                finalFilename = safeCustom;
                displayName = customFilename;
                await fs.move(oldPath, targetPath);
            } else {
                finalFilename = safeCustom;
                displayName = customFilename;
            }
        }

        const relPath = path.join(dir, finalFilename).replace(/\\/g, "/");
        const filePath = safeJoin(STORAGE_PATH, relPath);

        // 检查我们是否应该索引它
        const ext = path.extname(finalFilename).toLowerCase();
        // 仅在匹配“图片列表”的允许扩展名时索引
        // 如果用户上传了允许图片之外的通用文件，我们将其保留在磁盘上
        // 但不添加到 DB。
        if (config.upload.allowedExtensions.includes(ext)) {
            const metadata = await getFileMetadata(filePath, relPath);
            imageRepository.add({
                filename: finalFilename,
                rel_path: relPath,
                ...metadata
            });
        }

        // 时长逻辑
        let duration = null;
        if (req.file.mimetype === 'audio/mpeg' || (customFilename && customFilename.toLowerCase().endsWith('.mp3'))) {
            try {
                // 我们可以使用 metadataService 中的逻辑！
                const d = await parseAudioDuration(filePath);
                if (d) duration = parseFloat((Math.ceil(d * 1000) / 1000).toFixed(2));
            } catch (e) { }
        }

        // 记录上传统计信息
        imageRepository.recordUpload(req.file.size);

        const isImage = config.upload.allowedExtensions.includes(path.extname(finalFilename).toLowerCase());
        const relPathStr = relPath.split("/").map(encodeURIComponent).join("/");
        const endpoint = isImage ? 'images' : 'files';
        const url = `/api/${endpoint}/${relPathStr}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${url}`;

        res.json({
            success: true,
            message: "文件上传成功",
            data: {
                filename: finalFilename,
                originalName: displayName,
                size: req.file.size,
                mimetype: req.file.mimetype,
                uploadTime: new Date().toISOString(),
                url: url,
                relPath,
                fullUrl: fullUrl, // Standardized field
                ...(duration && { duration })
            }
        });

    } catch (error) {
        console.error("文件上传错误:", error.message);
        res.status(500).json({ success: false, error: "文件上传失败: " + error.message });
    }
});

module.exports = router;
