const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { safeJoin, sanitizeFilename } = require('../utils/fileUtils');

const STORAGE_PATH = config.storage.path;

const isAllowedFile = (file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = config.upload.allowedExtensions.includes(ext);
    const isAllowedMime = config.upload.allowedMimeTypes.includes(file.mimetype);
    return isAllowedExt && isAllowedMime;
};

const FORBIDDEN_EXTENSIONS = [
    ".php", ".html", ".htm", ".js", ".mjs", ".ts", ".sh", ".bat", ".exe", ".dll",
    ".com", ".cgi", ".pl", ".py", ".jar", ".apk", ".msi"
];
const FORBIDDEN_MIME_PREFIXES = [
    "text/html", "application/x-httpd-php", "application/javascript",
    "text/javascript", "application/x-sh", "application/x-msdownload",
    "application/vnd.android.package-archive"
];

const isForbiddenFile = (file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) return true;
    const mime = (file.mimetype || "").toLowerCase();
    if (FORBIDDEN_MIME_PREFIXES.some((m) => mime.startsWith(m))) return true;
    return false;
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = req.query.dir || req.body.dir || "";
        dir = dir.replace(/\\/g, "/");
        const dest = safeJoin(STORAGE_PATH, dir);
        try {
            fs.ensureDirSync(dest);
            cb(null, dest);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        let originalName = file.originalname;
        if (!/[^\u0000-\u00ff]/.test(originalName)) {
            try {
                originalName = Buffer.from(originalName, "latin1").toString("utf8");
            } catch (e) { }
        }

        const sanitizedName = sanitizeFilename(originalName);
        const forceOverwrite =
            req.query.overwrite === "true" ||
            req.body?.overwrite === "true" ||
            req.query.overwrite === true ||
            req.body?.overwrite === true;

        if (forceOverwrite) {
            return cb(null, sanitizedName);
        }

        const ext = path.extname(sanitizedName);
        const nameWithoutExt = path.basename(sanitizedName, ext);
        let finalName = sanitizedName;
        let counter = 1;

        let dir = req.query.dir || req.body.dir || "";
        dir = dir.replace(/\\/g, "/");
        const dest = safeJoin(STORAGE_PATH, dir);

        if (!config.upload.allowDuplicateNames) {
            while (fs.existsSync(path.join(dest, finalName))) {
                if (config.upload.duplicateStrategy === "timestamp") {
                    finalName = `${nameWithoutExt}_${Date.now()}_${counter}${ext}`;
                } else if (config.upload.duplicateStrategy === "counter") {
                    finalName = `${nameWithoutExt}_${counter}${ext}`;
                } else if (config.upload.duplicateStrategy === "overwrite") {
                    break;
                }
                counter++;
            }
        }
        cb(null, finalName);
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (isAllowedFile(file)) {
            cb(null, true);
        } else {
            const allowedFormats = config.upload.allowedExtensions.join(", ");
            cb(new Error(`只支持以下图片格式: ${allowedFormats}`));
        }
    },
    limits: { fileSize: config.upload.maxFileSize },
});

const uploadAny = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (isForbiddenFile(file)) {
            return cb(new Error("不允许上传可执行或危险文件类型"));
        }
        cb(null, true);
    },
    limits: { fileSize: config.upload.maxFileSize },
});

const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: `文件大小超过限制，最大允许 ${Math.round((config.upload.maxFileSize / (1024 * 1024)) * 100) / 100}MB`
            });
        }
        return res.status(400).json({ success: false, error: `上传错误: ${err.message}` });
    } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
    next();
};

module.exports = {
    upload,
    uploadAny,
    handleMulterError
};
