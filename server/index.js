require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const sharp = require("sharp");
const mime = require("mime-types");
const mm = require("music-metadata");
const exifr = require("exifr");

const CACHE_DIR_NAME = ".cache";
const TRASH_DIR_NAME = ".trash";

const app = express();
const PORT = config.server.port;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 增加限制以支持大型 base64 数据
app.use(express.static(path.join(__dirname, "../client/build")));
app.enable("trust proxy");

function getProtocol(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  if (Array.isArray(proto)) return proto[0];
  return String(proto).split(",")[0].trim();
}
function getHost(req) {
  return req.headers["x-forwarded-host"] || req.get("host");
}
function getBaseUrl(req) {
  return `${getProtocol(req)}://${getHost(req)}`;
}

// 配置存储路径
const STORAGE_PATH = config.storage.path;

// 确保存储目录存在
fs.ensureDirSync(STORAGE_PATH);

// 密码验证中间件
function requirePassword(req, res, next) {
  if (!config.security.password.enabled) {
    return next();
  }

  const password =
    req.headers["x-access-password"] || req.body.password || req.query.password;

  if (!password) {
    return res.status(401).json({ error: "需要提供访问密码" });
  }

  if (password !== config.security.password.accessPassword) {
    return res.status(401).json({ error: "密码错误" });
  }

  next();
}

// 路径安全校验，防止目录穿越
function safeJoin(base, target) {
  const targetPath = path.resolve(base, target || "");
  if (!targetPath.startsWith(path.resolve(base))) {
    throw new Error("非法目录路径");
  }
  return targetPath;
}

// 处理中文文件名，确保编码正确
function sanitizeFilename(filename) {
  try {
    // 如果文件名已经被编码，先解码
    if (filename.includes("%")) {
      filename = decodeURIComponent(filename);
    }
    // 处理可能的 Buffer 编码问题
    if (Buffer.isBuffer(filename)) {
      filename = filename.toString("utf8");
    }
    // 移除或替换不安全的字符，但保留中文字符
    if (config.storage.filename.sanitizeSpecialChars) {
      filename = filename.replace(
        /[<>:"/\\|?*]/g,
        config.storage.filename.specialCharReplacement
      );
    }
    return filename;
  } catch (error) {
    console.warn("文件名处理错误:", error);
    // 如果解码失败，使用原始文件名但清理不安全字符
    return filename.replace(
      /[<>:"/\\|?*]/g,
      config.storage.filename.specialCharReplacement
    );
  }
}

// 检查文件格式是否允许
function isAllowedFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedExt = config.upload.allowedExtensions.includes(ext);
  const isAllowedMime = config.upload.allowedMimeTypes.includes(file.mimetype);
  return isAllowedExt && isAllowedMime;
}

const FORBIDDEN_EXTENSIONS = [
  ".php",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".ts",
  ".sh",
  ".bat",
  ".exe",
  ".dll",
  ".com",
  ".cgi",
  ".pl",
  ".py",
  ".jar",
  ".apk",
  ".msi",
];
const FORBIDDEN_MIME_PREFIXES = [
  "text/html",
  "application/x-httpd-php",
  "application/javascript",
  "text/javascript",
  "application/x-sh",
  "application/x-msdownload",
  "application/vnd.android.package-archive",
];
function isForbiddenFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.includes(ext)) return true;
  const mime = (file.mimetype || "").toLowerCase();
  if (FORBIDDEN_MIME_PREFIXES.some((m) => mime.startsWith(m))) return true;
  return false;
}
// 配置multer，支持多层目录和中文文件名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 优先使用query参数，因为multer处理时body可能还没有解析
    let dir = req.query.dir || req.body.dir || "";
    dir = dir.replace(/\\/g, "/"); // 兼容windows
    const dest = safeJoin(STORAGE_PATH, dir);
    // 使用同步方式确保目录存在
    try {
      // 始终创建目录，不再依赖配置项
      fs.ensureDirSync(dest);
      cb(null, dest);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    let originalName = file.originalname;

    // 关键：latin1转utf8，彻底解决中文乱码
    // 修复：如果包含非 Latin1 字符 (> 255)，说明已经是 UTF-8，不需要转换
    if (!/[^\u0000-\u00ff]/.test(originalName)) {
      try {
        originalName = Buffer.from(originalName, "latin1").toString("utf8");
      } catch (e) {
        // ignore
      }
    }

    const sanitizedName = sanitizeFilename(originalName);
    const ext = path.extname(sanitizedName);
    const nameWithoutExt = path.basename(sanitizedName, ext);
    let finalName = sanitizedName;
    let counter = 1;

    let dir = req.query.dir || req.body.dir || "";
    dir = dir.replace(/\\/g, "/");
    const dest = safeJoin(STORAGE_PATH, dir);

    // 处理文件名冲突
    if (!config.upload.allowDuplicateNames) {
      while (fs.existsSync(path.join(dest, finalName))) {
        if (config.upload.duplicateStrategy === "timestamp") {
          finalName = `${nameWithoutExt}_${Date.now()}_${counter}${ext}`;
        } else if (config.upload.duplicateStrategy === "counter") {
          finalName = `${nameWithoutExt}_${counter}${ext}`;
        } else if (config.upload.duplicateStrategy === "overwrite") {
          break; // 直接覆盖
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
      return cb(null, true);
    } else {
      const allowedFormats = config.upload.allowedExtensions.join(", ");
      cb(new Error(`只支持以下图片格式: ${allowedFormats}`));
    }
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// 通用文件上传配置（支持任意文件类型）
const uploadAny = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (isForbiddenFile(file)) {
      return cb(new Error("不允许上传可执行或危险文件类型"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// ThumbHash Helpers
async function generateThumbHash(filePath) {
  try {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const cacheDir = path.join(dir, CACHE_DIR_NAME);
    const cacheFile = path.join(cacheDir, `${filename}.th`);

    // Ensure cache dir exists
    await fs.ensureDir(cacheDir);

    // Resize to 100x100 max, get raw RGBA
    const image = sharp(filePath).resize(100, 100, { fit: 'inside' });
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Dynamic import for ESM module
    const { rgbaToThumbHash } = await import("thumbhash");
    const binaryHash = rgbaToThumbHash(info.width, info.height, data);
    await fs.writeFile(cacheFile, Buffer.from(binaryHash));
    return Buffer.from(binaryHash).toString('base64');
  } catch (err) {
    console.error(`Failed to generate thumbhash for ${filePath}:`, err);
    return null;
  }
}

async function getThumbHash(filePath) {
   try {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const cacheFile = path.join(dir, CACHE_DIR_NAME, `${filename}.th`);
    
    if (await fs.pathExists(cacheFile)) {
      const buffer = await fs.readFile(cacheFile);
      return buffer.toString('base64');
    }
    return null;
   } catch (err) {
     return null;
   }
}

async function deleteThumbHash(filePath) {
    try {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);
        const cacheFile = path.join(dir, CACHE_DIR_NAME, `${filename}.th`);
        if (await fs.pathExists(cacheFile)) {
            await fs.remove(cacheFile);
        }
    } catch (e) {
        // ignore
    }
}

async function moveThumbHash(oldPath, newPath) {
    try {
        const oldDir = path.dirname(oldPath);
        const oldName = path.basename(oldPath);
        const oldCache = path.join(oldDir, CACHE_DIR_NAME, `${oldName}.th`);
        
        if (await fs.pathExists(oldCache)) {
             const newDir = path.dirname(newPath);
             const newName = path.basename(newPath);
             const newCacheDir = path.join(newDir, CACHE_DIR_NAME);
             await fs.ensureDir(newCacheDir);
             const newCache = path.join(newCacheDir, `${newName}.th`);
             await fs.rename(oldCache, newCache);
        }
    } catch (e) {
        // ignore
    }
}

// 递归获取图片文件
async function getAllImages(dir = "") {
  const absDir = safeJoin(STORAGE_PATH, dir);
  let results = [];
  const files = await fs.readdir(absDir);
  for (const file of files) {
    if (file === CACHE_DIR_NAME || file === CONFIG_DIR_NAME || file === TRASH_DIR_NAME) continue;
    const filePath = path.join(absDir, file);
    const relPath = path.join(dir, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      results = results.concat(await getAllImages(relPath));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (config.upload.allowedExtensions.includes(ext)) {
        // 确保文件名编码正确
        const safeFilename = sanitizeFilename(file);
        results.push({
          filename: safeFilename,
          relPath: relPath.replace(/\\/g, "/"),
          size: stats.size,
          uploadTime: stats.mtime.toISOString(),
          url: `/api/images/${relPath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/")}`,
        });
      }
    }
  }
  return results;
}

// 处理 multer 错误的中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // 处理 Multer 错误
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: `文件大小超过限制，最大允许 ${Math.round((config.upload.maxFileSize / (1024 * 1024)) * 100) / 100}MB`
      });
    }
    return res.status(400).json({ success: false, error: `上传错误: ${err.message}` });
  } else if (err) {
    // 处理其他错误
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
};

// 处理 base64 编码的图片
const handleBase64Image = async (base64Data, dir, originalName) => {
  // 提取 MIME 类型和实际数据
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('无效的 base64 图片格式');
  }

  const mimetype = matches[1];
  if (!/^image\//.test(mimetype)) {
    throw new Error('仅允许图片类型的 base64 上传');
  }
  const buffer = Buffer.from(matches[2], 'base64');
  
  // 生成文件名
  const ext = mimetype.split('/')[1] || 'png';
  const filename = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  
  // 确保目标目录存在
  const targetDir = dir ? path.join(STORAGE_PATH, dir) : STORAGE_PATH;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // 保存文件
  const filePath = path.join(targetDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  
  // Generate ThumbHash
  const thumbhash = await generateThumbHash(filePath);
  
  // 返回文件信息
  const relPath = path.join(dir, filename).replace(/\\/g, "/");
  const safeFilename = sanitizeFilename(filename);
  
  return {
    filename: safeFilename,
    originalName: originalName || safeFilename,
    size: buffer.length,
    mimetype,
    uploadTime: new Date().toISOString(),
    url: `/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
    relPath,
    thumbhash,
  };
};

// 1. 上传 base64 编码图片接口
app.post(
  "/api/upload-base64",
  requirePassword,
  async (req, res) => {
    try {
      let dir = req.body.dir || req.query.dir || "";
      dir = dir.replace(/\\/g, "/");
      
      // 检查是否提供了 base64 图片数据
      if (!req.body.base64Image) {
        return res.status(400).json({ success: false, error: "缺少 base64Image 参数" });
      }
      
      try {
        const fileInfo = await handleBase64Image(req.body.base64Image, dir, req.body.originalName);
        return res.json({
          success: true,
          message: "base64 图片上传成功",
          data: {
            ...fileInfo,
            fullUrl: `${getBaseUrl(req)}${fileInfo.url}`,
          },
        });
      } catch (error) {
        console.error("base64 上传错误:", error);
        return res.status(400).json({ success: false, error: error.message || "base64 图片处理失败" });
      }
    } catch (error) {
      console.error("上传错误:", error);
      res.status(500).json({ success: false, error: "上传失败，请稍后重试" });
    }
  }
);

// 1.1 上传图片接口 (常规文件上传)
app.post(
  "/api/upload",
  requirePassword,
  upload.single("image"),
  handleMulterError,
  async (req, res) => {
    try {
      let dir = req.body.dir || req.query.dir || "";
      dir = dir.replace(/\\/g, "/");
      
      // 处理常规文件上传
      if (!req.file) {
        return res.status(400).json({ success: false, error: "没有选择文件" });
      }
      
      // 创建目标目录（如果不存在）
      if (dir) {
        const targetDir = path.join(STORAGE_PATH, dir);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // 如果文件已上传但需要移动到指定目录
        const oldPath = req.file.path;
        const newPath = path.join(targetDir, req.file.filename);
        if (oldPath !== newPath && fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
      
      const relPath = path.join(dir, req.file.filename).replace(/\\/g, "/");

      // 这里要对 originalName 做转码
      let originalName = req.file.originalname;
      // 修复：如果包含非 Latin1 字符 (> 255)，说明已经是 UTF-8，不需要转换
      if (!/[^\u0000-\u00ff]/.test(originalName)) {
        try {
          originalName = Buffer.from(originalName, "latin1").toString("utf8");
        } catch (e) {}
      }

      const safeFilename = sanitizeFilename(req.file.filename);

      // Generate ThumbHash
      const finalFilePath = safeJoin(STORAGE_PATH, relPath);
      const thumbhash = await generateThumbHash(finalFilePath);

      const fileInfo = {
        filename: safeFilename,
        originalName: originalName, // 用转码后的
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadTime: new Date().toISOString(),
        url: `/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
        relPath,
        fullUrl: `${getBaseUrl(req)}/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`,
        thumbhash,
      };
      res.json({
        success: true,
        message: "图片上传成功",
        data: fileInfo,
      });
    } catch (error) {
      console.error("上传错误:", error);
      res.status(500).json({ success: false, error: "上传失败，请稍后重试" });
    }
  }
);

/**
 * 使用music-metadata库解析MP3文件时长
 */
async function parseMp3Duration(filePath) {
  try {
    // 使用music-metadata库解析音频文件
    const metadata = await mm.parseFile(filePath, {
      duration: true
    });
    
    // 获取时长（秒）
    return metadata.format.duration;
  } catch (error) {
    console.error('解析MP3时长失败:', error);
    throw new Error('Invalid MP3 file format');
  }
}

async function parseMp4Duration(filePath) {
  try {
    const metadata = await mm.parseFile(filePath, { duration: true });
    return metadata.format.duration;
  } catch (error) {
    console.error('解析MP4时长失败:', error);
    throw new Error('Invalid MP4 file format');
  }
}

// 1.1. 上传任意文件接口
app.post(
  "/api/upload-file",
  requirePassword,
  uploadAny.single("file"),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "没有选择文件" });
      }
      let dir = req.body.dir || req.query.dir || "";
      dir = dir.replace(/\\/g, "/");
      
      // 创建目标目录（如果不存在）
      if (dir) {
        const targetDir = path.join(STORAGE_PATH, dir);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      }
      
      // 检查是否传入了自定义文件名
      const customFilename = req.body.filename || req.query.filename;
      let finalFilename;
      let displayName;
      
      if (customFilename) {
        // 使用自定义文件名
        finalFilename = sanitizeFilename(customFilename);
        displayName = customFilename;
        
        // 重命名文件
        const oldPath = req.file.path;
        // 确保文件存储在指定目录
        const targetDir = dir ? path.join(STORAGE_PATH, dir) : path.dirname(oldPath);
        const newPath = path.join(targetDir, finalFilename);
        
        // 处理文件名冲突
        let counter = 1;
        let actualNewPath = newPath;
        const ext = path.extname(finalFilename);
        const nameWithoutExt = path.basename(finalFilename, ext);
        
        if (!config.upload.allowDuplicateNames) {
          while (fs.existsSync(actualNewPath)) {
            if (config.upload.duplicateStrategy === "timestamp") {
              const newName = `${nameWithoutExt}_${Date.now()}_${counter}${ext}`;
              actualNewPath = path.join(targetDir, newName);
              finalFilename = newName;
            } else if (config.upload.duplicateStrategy === "counter") {
              const newName = `${nameWithoutExt}_${counter}${ext}`;
              actualNewPath = path.join(targetDir, newName);
              finalFilename = newName;
            } else if (config.upload.duplicateStrategy === "overwrite") {
              break;
            }
            counter++;
          }
        }
        
        // 执行重命名和移动
        if (oldPath !== actualNewPath) {
          fs.renameSync(oldPath, actualNewPath);
        }
      } else {
        // 使用原有逻辑
        finalFilename = sanitizeFilename(req.file.filename);
        
        // 这里要对 originalName 做转码
        let originalName = req.file.originalname;
        // 修复：如果包含非 Latin1 字符 (> 255)，说明已经是 UTF-8，不需要转换
        if (!/[^\u0000-\u00ff]/.test(originalName)) {
          try {
            originalName = Buffer.from(originalName, "latin1").toString("utf8");
          } catch (e) {}
        }
        displayName = originalName;
        
        // 如果指定了目录，则移动文件到该目录
        if (dir) {
          const oldPath = req.file.path;
          const targetDir = path.join(STORAGE_PATH, dir);
          const newPath = path.join(targetDir, finalFilename);
          fs.renameSync(oldPath, newPath);
        }
      }
      
      const relPath = path.join(dir, finalFilename).replace(/\\/g, "/");
      
      // 计算MP3时长（如果适用）
      let duration = null;
      if (req.file.mimetype === 'audio/mpeg' || (customFilename && customFilename.toLowerCase().endsWith('.mp3'))) {
        try {
          const filePath = safeJoin(STORAGE_PATH, relPath);
          const rawDuration = await parseMp3Duration(filePath);
          
          // 精确到小数点后2位，根据小数点后第3位向上取整
          // 例如：9.114 -> 9.12, 9.125 -> 9.13, 9.199 -> 9.20
          
          // 将原始时长乘以1000并向上取整，然后除以100得到精确到小数点后2位的结果
          // Math.ceil 向上取整，确保第三位小数有值时会进位
          duration = Math.ceil(rawDuration * 1000) / 1000;
          
          // 格式化为保留2位小数
          duration = parseFloat(duration.toFixed(2));
        } catch (error) {
          console.error("MP3时长解析失败:", error);
          // 根据需求，不中断上传，但duration设为null
        }
      }

      if (duration === null && (req.file.mimetype === 'video/mp4' || (customFilename && customFilename.toLowerCase().endsWith('.mp4')))) {
        try {
          const filePath = safeJoin(STORAGE_PATH, relPath);
          const rawDuration = await parseMp4Duration(filePath);
          duration = Math.ceil(rawDuration * 1000) / 1000;
          duration = parseFloat(duration.toFixed(2));
        } catch (error) {
          console.error("MP4时长解析失败:", error);
        }
      }

      const fileInfo = {
        filename: finalFilename,
        originalName: displayName,
        customFilename: customFilename || null,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadTime: new Date().toISOString(),
        url: `/api/files/${relPath.split("/").map(encodeURIComponent).join("/")}`,
        relPath,
        fullUrl: `${getBaseUrl(req)}/api/files/${relPath.split("/").map(encodeURIComponent).join("/")}`,
        ...(duration !== null && { duration }), // 仅当计算成功时添加duration字段
      };
      res.json({
        success: true,
        message: "文件上传成功",
        data: fileInfo,
      });
    } catch (error) {
      console.error("文件上传错误:", error);
      res.status(500).json({ success: false, error: "文件上传失败，请稍后重试" });
    }
  }
);

// 2. 获取图片列表（支持dir参数、分页、搜索）
app.get("/api/images", requirePassword, async (req, res) => {
  try {
    let dir = req.query.dir || "";
    dir = dir.replace(/\\/g, "/");

    // 获取分页参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const search = req.query.search || "";

    // 获取所有图片
    let images = await getAllImages(dir);

    // 按上传时间倒序排列
    images.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

    // 搜索过滤
    if (search) {
      images = images.filter((image) =>
        image.filename.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 计算分页
    const total = images.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedImages = images.slice(startIndex, endIndex);

    // Attach ThumbHash
    for (const img of paginatedImages) {
        const filePath = safeJoin(STORAGE_PATH, img.relPath);
        img.thumbhash = await getThumbHash(filePath);
    }

    // 禁止缓存 API 响应
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json({
      success: true,
      data: paginatedImages,
      pagination: {
        current: page,
        pageSize: pageSize,
        total: total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取图片列表错误:", error);
    res.status(500).json({ error: "获取图片列表失败" });
  }
});

// 3. 获取随机图片（支持dir参数）
app.get("/api/random", requirePassword, async (req, res) => {
  try {
    let dir = req.query.dir || "";
    dir = dir.replace(/\\/g, "/");
    const images = await getAllImages(dir);
    if (images.length === 0) {
      return res.status(404).json({ error: "没有找到图片" });
    }
    const randomImage = images[Math.floor(Math.random() * images.length)];
    if (req.query.format === "json") {
      return res.json({
        success: true,
        data: randomImage,
      });
    }
    // 直接返回图片文件
    const filePath = safeJoin(STORAGE_PATH, randomImage.relPath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: "图片发送失败" });
      }
    });
  } catch (error) {
    console.error("获取随机图片错误:", error);
    res.status(500).json({ error: "获取随机图片失败" });
  }
});

// 4.2. 获取图片元信息（尺寸/格式/主色/EXIF等）- 必须优先于 /api/images/* 路由
app.get("/api/images/meta/*", requirePassword, async (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ success: false, error: "图片不存在" });
    }
    const fstats = await fs.stat(filePath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    let meta = {};
    let exif = {};
    try {
      const img = sharp(filePath);
      const m = await img.metadata();
      const s = await img.stats();
      meta = {
        width: m.width || null,
        height: m.height || null,
        format: m.format || null,
        channels: m.channels || null,
        hasAlpha: m.hasAlpha === true || m.channels === 4,
        orientation: m.orientation || null,
        space: m.space || null,
        dominant: s.dominant || null,
        exifPresent: !!m.exif,
      };
      // 解析EXIF详细信息
      try {
        const ex = await exifr.parse(filePath, {
          tiff: true,
          ifd0: true,
          exif: true,
          gps: true,
        });
        if (ex) {
          const latitude = ex.latitude ?? ex.GPSLatitude ?? null;
          const longitude = ex.longitude ?? ex.GPSLongitude ?? null;
          const date =
            ex.DateTimeOriginal || ex.CreateDate || ex.ModifyDate || null;
          exif = {
            make: ex.Make || null,
            model: ex.Model || null,
            lensModel: ex.LensModel || null,
            dateTimeOriginal: date ? new Date(date).toISOString() : null,
            iso: ex.ISO || ex.ISOSpeedRatings || null,
            exposureTime: ex.ExposureTime || null,
            fNumber: ex.FNumber || null,
            focalLength: ex.FocalLength || null,
            latitude,
            longitude,
            altitude: ex.GPSAltitude ?? null,
          };
        }
      } catch (e) {
        // EXIF解析失败不阻断
      }
    } catch (e) {
      meta = {};
    }
    return res.json({
      success: true,
      data: {
        filename: path.basename(relPath),
        relPath: relPath.replace(/\\/g, "/"),
        size: fstats.size,
        uploadTime: fstats.mtime.toISOString(),
        createTime: fstats.birthtime ? fstats.birthtime.toISOString() : null,
        mime: mimeType,
        ...meta,
        exif,
      },
    });
  } catch (e) {
    return res.status(400).json({ success: false, error: "非法路径" });
  }
});

// 4. 获取指定图片（支持多层目录、实时处理）
app.get("/api/images/*", async (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "图片不存在" });
    }

    // Trigger ThumbHash generation if missing (async, non-blocking)
    getThumbHash(filePath).then(hash => {
        if (!hash) generateThumbHash(filePath);
    });

    const w = req.query.w ? parseInt(req.query.w) : undefined;
    const h = req.query.h ? parseInt(req.query.h) : undefined;
    const qRaw = req.query.q ? parseInt(req.query.q) : undefined;
    const q = qRaw && qRaw > 0 && qRaw <= 100 ? qRaw : undefined;
    let fmt = (req.query.fmt || "").toLowerCase();
    if (fmt === "jpg") fmt = "jpeg";
    const hasTransform = w || h || q || fmt;
    if (!hasTransform) {
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      return res.sendFile(filePath);
    }
    let img = sharp(filePath);
    if (w || h) {
      img = img.resize({
        width: w,
        height: h,
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
    res.setHeader("Content-Type", outMime);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
  } catch (e) {
    res.status(400).json({ error: "非法路径" });
  }
});

// 4.1. 获取指定文件（支持多层目录）
app.get("/api/files/*", (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (fs.existsSync(filePath)) {
      // 设置正确的Content-Type
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "文件不存在" });
    }
  } catch (e) {
    res.status(400).json({ error: "非法路径" });
  }
});

 

// 辅助函数：移动到回收站
async function moveToTrash(filePath) {
  try {
    const fileName = path.basename(filePath);
    // 使用时间戳避免重名冲突: filename_timestamp.ext
    const ext = path.extname(fileName);
    const nameWithoutExt = path.basename(fileName, ext);
    const timestamp = Date.now();
    const trashName = `${nameWithoutExt}_${timestamp}${ext}`;
    const trashPath = path.join(STORAGE_PATH, TRASH_DIR_NAME, trashName);

    // 确保回收站目录存在
    await fs.ensureDir(path.dirname(trashPath));
    // 移动文件
    await fs.move(filePath, trashPath, { overwrite: true });
    console.log(`[Trash] Moved to trash: ${trashName}`);
  } catch (error) {
    console.error("[Trash] Move failed:", error);
    // 如果移动失败，为了保证API行为一致性，可能需要回退或报错
    // 这里选择抛出错误，让上层处理
    throw error;
  }
}

// 辅助函数：清理回收站（保留30天）
async function cleanTrash() {
  const trashDir = path.join(STORAGE_PATH, TRASH_DIR_NAME);
  if (!(await fs.pathExists(trashDir))) return;

  try {
    const files = await fs.readdir(trashDir);
    const now = Date.now();
    const EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000; // 30天

    for (const file of files) {
      const filePath = path.join(trashDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > EXPIRE_TIME) {
          await fs.remove(filePath);
          console.log(`[Trash] Cleaned expired file: ${file}`);
        }
      } catch (e) {
        console.error(`[Trash] Failed to check/delete file: ${file}`, e);
      }
    }
  } catch (e) {
    console.error("[Trash] Cleanup failed:", e);
  }
}

// 初始化回收站清理任务
function initTrashCleanup() {
  console.log("[Trash] Initializing cleanup task...");
  // 立即执行一次
  cleanTrash();
  // 每24小时执行一次
  setInterval(cleanTrash, 24 * 60 * 60 * 1000);
}

// 5. 删除图片（支持多层目录）
app.delete("/api/images/*", requirePassword, async (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (await fs.pathExists(filePath)) {
      // await fs.remove(filePath); // 改为软删除
      await moveToTrash(filePath);
      await deleteThumbHash(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "图片不存在" });
    }
  } catch (e) {
    res.status(400).json({ error: "非法路径" });
  }
});

// 5.1. 删除文件（支持多层目录）
app.delete("/api/files/*", requirePassword, async (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (await fs.pathExists(filePath)) {
      // await fs.remove(filePath); // 改为软删除
      await moveToTrash(filePath);
      res.json({ success: true, message: "文件已移至回收站" });
    } else {
      res.status(404).json({ error: "文件不存在" });
    }
  } catch (e) {
    res.status(400).json({ error: "非法路径" });
  }
});

// 批量移动图片
app.post("/api/batch/move", requirePassword, async (req, res) => {
    try {
        const { files, targetDir } = req.body;
        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: "未选择文件" });
        }
        
        let newDir = targetDir || "";
        newDir = newDir.replace(/\\/g, "/").trim();
        const absTargetDir = safeJoin(STORAGE_PATH, newDir);
        await fs.ensureDir(absTargetDir);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const relPath of files) {
            try {
                const oldRelPath = decodeURIComponent(relPath).replace(/\\/g, "/");
                const oldFilePath = safeJoin(STORAGE_PATH, oldRelPath);
                
                if (await fs.pathExists(oldFilePath)) {
                    const filename = path.basename(oldFilePath);
                    let newRelPath = path.join(newDir, filename).replace(/\\/g, "/");
                    let newFilePath = safeJoin(STORAGE_PATH, newRelPath);
                    
                    // Handle duplicates
                    if (oldFilePath !== newFilePath) {
                         if (!config.upload.allowDuplicateNames && await fs.pathExists(newFilePath)) {
                            const ext = path.extname(filename);
                            const nameWithoutExt = path.basename(filename, ext);
                            let counter = 1;
                            let finalName = filename;
                            
                            while (await fs.pathExists(newFilePath)) {
                                if (config.upload.duplicateStrategy === "overwrite") break;
                                
                                if (config.upload.duplicateStrategy === "timestamp") {
                                    finalName = `${nameWithoutExt}_${Date.now()}_${counter}${ext}`;
                                } else {
                                    // counter
                                    finalName = `${nameWithoutExt}_${counter}${ext}`;
                                }
                                newRelPath = path.join(newDir, finalName).replace(/\\/g, "/");
                                newFilePath = safeJoin(STORAGE_PATH, newRelPath);
                                counter++;
                            }
                        }
                        
                        if (oldFilePath !== newFilePath) {
                            await fs.rename(oldFilePath, newFilePath);
                            await moveThumbHash(oldFilePath, newFilePath);
                            successCount++;
                        } else {
                            // Same file, technically success
                            successCount++;
                        }
                    } else {
                        successCount++;
                    }
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error(`Move failed for ${relPath}:`, e);
                failCount++;
            }
        }
        
        res.json({ 
            success: true, 
            message: `成功移动 ${successCount} 个文件` + (failCount > 0 ? `，失败 ${failCount} 个` : ""),
            data: { successCount, failCount }
        });
        
    } catch (e) {
        console.error("Batch move error:", e);
        res.status(500).json({ error: "批量移动失败" });
    }
});

// 图片重命名（支持多层目录）
app.put("/api/images/*", requirePassword, async (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const oldFilePath = safeJoin(STORAGE_PATH, relPath);
    if (!(await fs.pathExists(oldFilePath))) {
      return res.status(404).json({ success: false, error: "图片不存在" });
    }
    // 支持重命名与移动目录
    let newName = req.body.newName || req.query.newName || null;
    let newDir = req.body.newDir || req.query.newDir || null;

    const currentDir = path.dirname(relPath).replace(/\\/g, "/");
    const origExt = path.extname(relPath);
    const origBase = path.basename(relPath);

    // 处理新名称
    if (typeof newName === "string") {
      newName = sanitizeFilename(newName.trim());
      if (!path.extname(newName)) {
        newName = `${path.basename(newName)}${origExt}`;
      }
    } else {
      newName = origBase;
    }

    // 处理新目录
    if (typeof newDir === "string") {
      newDir = newDir.replace(/\\/g, "/").trim();
    } else {
      newDir = currentDir;
    }

    // 目标路径
    const targetDir = safeJoin(STORAGE_PATH, newDir);
    await fs.ensureDir(targetDir);
    let newRelPath = path.join(newDir, newName).replace(/\\/g, "/");
    let newFilePath = safeJoin(STORAGE_PATH, newRelPath);
    // 处理重复策略
    if (!config.upload.allowDuplicateNames && oldFilePath !== newFilePath) {
      const nameWithoutExt = path.basename(newName, path.extname(newName));
      const extension = path.extname(newName);
      let finalName = newName;
      let counter = 1;
      while (await fs.pathExists(newFilePath)) {
        if (config.upload.duplicateStrategy === "timestamp") {
          finalName = `${nameWithoutExt}_${Date.now()}_${counter}${extension}`;
        } else if (config.upload.duplicateStrategy === "counter") {
          finalName = `${nameWithoutExt}_${counter}${extension}`;
        } else if (config.upload.duplicateStrategy === "overwrite") {
          break;
        }
        newRelPath = path.join(newDir, finalName).replace(/\\/g, "/");
        newFilePath = safeJoin(STORAGE_PATH, newRelPath);
        counter++;
      }
    }
    // 执行重命名
    await fs.rename(oldFilePath, newFilePath);
    await moveThumbHash(oldFilePath, newFilePath);
    const stats = await fs.stat(newFilePath);
    const updated = {
      filename: path.basename(newRelPath),
      relPath: newRelPath,
      size: stats.size,
      uploadTime: stats.mtime.toISOString(),
      url: `/api/images/${encodeURIComponent(newRelPath)}`,
    };
    return res.json({ success: true, message: "更新成功", data: updated });
  } catch (e) {
    console.error("图片重命名错误:", e);
    return res.status(400).json({ success: false, error: e.message || "重命名失败" });
  }
});

const crypto = require("crypto");

const CONFIG_DIR_NAME = "config";

// Get or create persistent share secret
const getShareSecret = () => {
    if (process.env.SHARE_SECRET) {
        return process.env.SHARE_SECRET;
    }
    
    // Store secret in config dir to persist across restarts
    const configDir = path.join(STORAGE_PATH, CONFIG_DIR_NAME);
    const secretPath = path.join(configDir, ".share_secret");
    
    try {
        fs.ensureDirSync(configDir);
        
        // Migration: check if old secret exists in root and move it
        const oldSecretPath = path.join(STORAGE_PATH, ".share_secret");
        if (fs.existsSync(oldSecretPath) && !fs.existsSync(secretPath)) {
            try {
                fs.renameSync(oldSecretPath, secretPath);
                return fs.readFileSync(secretPath, 'utf8').trim();
            } catch (e) {
                console.error("Migration of share secret failed:", e);
                // Continue to create new or read existing
            }
        }

        if (fs.existsSync(secretPath)) {
            return fs.readFileSync(secretPath, 'utf8').trim();
        } else {
            const newSecret = uuidv4();
            fs.writeFileSync(secretPath, newSecret);
            return newSecret;
        }
    } catch (e) {
        console.error("Failed to manage share secret:", e);
        return uuidv4(); // Fallback to memory-only if FS fails
    }
};

const SHARE_SECRET = getShareSecret();
const SHARES_FILE_NAME = "burned_tokens.json"; // Keep filename as requested by user, but content will be shares

// Helper to get share config path
const getShareConfigPath = (dirPath) => {
    const absDir = safeJoin(STORAGE_PATH, dirPath);
    return path.join(absDir, CONFIG_DIR_NAME, SHARES_FILE_NAME);
};

// Helper to read shares
const readShares = async (dirPath) => {
    try {
        const filePath = getShareConfigPath(dirPath);
        if (await fs.pathExists(filePath)) {
            return await fs.readJSON(filePath);
        }
    } catch (e) {}
    return [];
};

// Helper to write shares
const writeShares = async (dirPath, shares) => {
    try {
        const filePath = getShareConfigPath(dirPath);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeJSON(filePath, shares, { spaces: 2 });
    } catch (e) {
        console.error("Write shares failed:", e);
    }
};

// Helper to get previews
async function getPreviewImages(dir, limit = 3) {
  const absDir = safeJoin(STORAGE_PATH, dir);
  const previews = [];
  try {
    const files = await fs.readdir(absDir);
    // Sort by recent? Or just random? Let's try to get recent ones if possible, but stats are slow.
    // Let's just take first 3 images for performance, maybe sort by name.
    // To do it right: stat all, sort by mtime, take 3.
    // Optimization: limit the stat calls if directory is huge?
    // For now, let's just grab the first few images we find.
    for (const file of files) {
        if (previews.length >= limit) break;
        if (file === CACHE_DIR_NAME) continue;
        const filePath = path.join(absDir, file);
        const ext = path.extname(file).toLowerCase();
        if (config.upload.allowedExtensions.includes(ext)) {
            // Check if it's a file
            try {
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    const relPath = path.join(dir, file).replace(/\\/g, "/");
                    previews.push(`/api/images/${relPath.split("/").map(encodeURIComponent).join("/")}`);
                }
            } catch (e) {}
        }
    }
  } catch (e) {}
  return previews;
}

// 6. 获取目录列表 (Modified to include previews)
async function getDirectories(dir = "") {
  const absDir = safeJoin(STORAGE_PATH, dir);
  let directories = [];

  try {
    const files = await fs.readdir(absDir);
    for (const file of files) {
      if (file === CACHE_DIR_NAME || file === CONFIG_DIR_NAME || file === TRASH_DIR_NAME) continue;
      const filePath = path.join(absDir, file);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        const relPath = path.join(dir, file).replace(/\\/g, "/");
        const previews = await getPreviewImages(relPath, 3);
        directories.push({
          name: file,
          path: relPath,
          fullPath: filePath,
          previews: previews,
          imageCount: previews.length, // Rough indicator
          mtime: stats.mtime
        });
      }
    }
    // 按目录名排序
    directories.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  } catch (error) {
    console.error("读取目录失败:", error);
  }

  return directories;
}

// Create Directory
app.post("/api/directories", requirePassword, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Missing name" });

        // Allow multi-level directory creation
        // Split by / or \ to handle path separators
        const parts = name.split(/[/\\]/);
        // Sanitize each part to ensure valid folder names
        const safeParts = parts.map(p => sanitizeFilename(p)).filter(p => p.length > 0);
        
        if (safeParts.length === 0) {
             return res.status(400).json({ error: "Invalid directory name" });
        }

        const relativePath = safeParts.join("/");
        const dirPath = safeJoin(STORAGE_PATH, relativePath);

        if (await fs.pathExists(dirPath)) {
            return res.status(400).json({ error: "目录已存在" });
        }

        await fs.ensureDir(dirPath);
        
        // Return the created directory info
        res.json({ 
            success: true, 
            message: "创建成功",
            data: {
                name: safeParts[safeParts.length - 1],
                path: relativePath,
                fullPath: dirPath
            }
        });
    } catch (e) {
        console.error("Create dir error:", e);
        res.status(500).json({ error: "创建目录失败" });
    }
});

app.get("/api/directories", requirePassword, async (req, res) => {
  try {
    let dir = req.query.dir || "";
    dir = dir.replace(/\\/g, "/");
    const directories = await getDirectories(dir);
    res.json({
      success: true,
      data: directories,
    });
  } catch (error) {
    console.error("获取目录列表错误:", error);
    res.status(500).json({ error: "获取目录列表失败" });
  }
});

// Share API
app.post("/api/share/generate", requirePassword, async (req, res) => {
    try {
        const { path: sharePath, expireSeconds, burnAfterReading } = req.body;
        if (sharePath === undefined) return res.status(400).json({ error: "Missing path" });

        const payload = {
            p: sharePath,
            e: expireSeconds ? Date.now() + expireSeconds * 1000 : null,
            b: !!burnAfterReading,
            n: uuidv4() // Nonce
        };
        
        const dataStr = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", SHARE_SECRET).update(dataStr).digest("hex");
        const token = Buffer.from(JSON.stringify({ d: payload, s: signature })).toString("base64");
        
        // Save to local config
        const shares = await readShares(sharePath);
        shares.push({
            token,
            signature, // Used for quick lookup
            createdAt: Date.now(),
            expireSeconds,
            burnAfterReading: !!burnAfterReading,
            status: "active"
        });
        await writeShares(sharePath, shares);

        res.json({ success: true, token });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Generate share link failed" });
    }
});

// List shares
app.get("/api/share/list", requirePassword, async (req, res) => {
    try {
        const { path: sharePath } = req.query;
        if (sharePath === undefined) return res.status(400).json({ error: "Missing path" });
        
        const shares = await readShares(sharePath);
        // Filter out expired or revoked? Maybe show all but indicate status
        // Check expiry dynamically
        const now = Date.now();
        const result = shares.map(s => {
            let status = s.status;
            if (status === "active" && s.expireSeconds && (s.createdAt + s.expireSeconds * 1000 < now)) {
                status = "expired";
            }
            return { ...s, status };
        });
        
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ error: "List shares failed" });
    }
});

// Delete share
app.delete("/api/share/delete", requirePassword, async (req, res) => {
    try {
        const { path: sharePath, signature } = req.body;
        if (sharePath === undefined || !signature) return res.status(400).json({ error: "Missing params" });

        const shares = await readShares(sharePath);
        const newShares = shares.filter(s => s.signature !== signature);
        
        if (shares.length === newShares.length) {
            return res.status(404).json({ error: "Share not found" });
        }
        
        await writeShares(sharePath, newShares);
        res.json({ success: true });
    } catch (e) {
        console.error("Delete share failed:", e);
        res.status(500).json({ error: "Delete share failed" });
    }
});

// Revoke share
app.post("/api/share/revoke", requirePassword, async (req, res) => {
    try {
        const { path: sharePath, signature } = req.body;
        // Allow empty string for root path
        if (sharePath === undefined || !signature) return res.status(400).json({ error: "Missing params" });

        const shares = await readShares(sharePath);
        const index = shares.findIndex(s => s.signature === signature);
        if (index !== -1) {
            shares[index].status = "revoked";
            await writeShares(sharePath, shares);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Share not found" });
        }
    } catch (e) {
        res.status(500).json({ error: "Revoke failed" });
    }
});

app.get("/api/share/access", async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Missing token" });

        let decoded;
        try {
            const jsonStr = Buffer.from(token, "base64").toString("utf8");
            decoded = JSON.parse(jsonStr);
        } catch (e) {
            return res.status(400).json({ error: "Invalid token format" });
        }

        const { d: payload, s: signature } = decoded;
        const expectedSig = crypto.createHmac("sha256", SHARE_SECRET).update(JSON.stringify(payload)).digest("hex");

        if (signature !== expectedSig) {
            return res.status(403).json({ error: "Invalid signature" });
        }

        // Check local config
        const dir = payload.p;
        const shares = await readShares(dir);
        const shareRecord = shares.find(s => s.signature === signature);
        
        if (!shareRecord) {
             // If not found in local config (maybe old token or deleted), fallback to payload validation only?
             // But user wants "manual revoke", so we MUST check record.
             // If record missing, treat as invalid or revoked.
             return res.status(403).json({ error: "分享记录不存在或已失效" });
        }

        if (shareRecord.status === "revoked") {
            return res.status(410).json({ error: "链接已失效" });
        }
        
        if (shareRecord.status === "burned") {
             return res.status(410).json({ error: "链接已失效（阅后即焚）" });
        }

        // Check expiry
        // Priority: Record > Payload (though they should match)
        if (payload.e && Date.now() > payload.e) {
            return res.status(410).json({ error: "链接已过期" });
        }
        
        // Also check creation time based expiry from record just in case
        if (shareRecord.expireSeconds && (shareRecord.createdAt + shareRecord.expireSeconds * 1000 < Date.now())) {
             return res.status(410).json({ error: "链接已过期" });
        }

        if (payload.b) {
            // Burn after reading
            // Update status to burned
            shareRecord.status = "burned";
            // Update in array
            const index = shares.findIndex(s => s.signature === signature);
            if (index !== -1) shares[index] = shareRecord;
            await writeShares(dir, shares);
        }

        // Token valid, return content
        let images = await getAllImages(dir);
        
        // Sort
        images.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const total = images.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedImages = images.slice(startIndex, endIndex);
        
        // ThumbHash
        for (const img of paginatedImages) {
             const filePath = safeJoin(STORAGE_PATH, img.relPath);
             img.thumbhash = await getThumbHash(filePath);
        }

        res.json({
            success: true,
            data: paginatedImages,
            dirName: path.basename(dir),
            pagination: {
                current: page,
                pageSize: pageSize,
                total: total,
                totalPages: Math.ceil(total / pageSize),
            }
        });

    } catch (e) {
        console.error("Share access error:", e);
        res.status(500).json({ error: "Share access failed" });
    }
});

// 7. 统计信息（递归统计所有目录）
async function getStats(dir = "") {
  const absDir = safeJoin(STORAGE_PATH, dir);
  let totalImages = 0;
  let totalSize = 0;
  let storagePath = absDir;
  const files = await fs.readdir(absDir);
  for (const file of files) {
    if (file === CACHE_DIR_NAME || file === CONFIG_DIR_NAME) continue;
    const filePath = path.join(absDir, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      const subStats = await getStats(path.join(dir, file));
      totalImages += subStats.totalImages;
      totalSize += subStats.totalSize;
    } else {
      const ext = path.extname(file).toLowerCase();
      if (config.upload.allowedExtensions.includes(ext)) {
        totalImages++;
        totalSize += stats.size;
      }
    }
  }
  return { totalImages, totalSize, storagePath };
}

app.get("/api/stats", requirePassword, async (req, res) => {
  try {
    let dir = req.query.dir || "";
    dir = dir.replace(/\\/g, "/");
    const stats = await getStats(dir);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("获取统计信息错误:", error);
    res.status(500).json({ error: "获取统计信息失败" });
  }
});

// 启动服务
// 启动回收站清理任务
initTrashCleanup();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 认证相关接口
// 1. 检查是否需要密码保护
app.get("/api/auth/status", (req, res) => {
  res.json({
    requiresPassword: config.security.password.enabled,
  });
});

// 2. 验证密码
app.post("/api/auth/verify", (req, res) => {
  const { password } = req.body;

  if (!config.security.password.enabled) {
    return res.json({ success: true, message: "无需密码保护" });
  }

  if (!password) {
    return res.status(400).json({ error: "请提供密码" });
  }

  if (password !== config.security.password.accessPassword) {
    return res.status(401).json({ error: "密码错误" });
  }

  res.json({ success: true, message: "密码验证成功" });
});

// 配置API接口
app.get("/api/config", (req, res) => {
  try {
    // 返回前端需要的配置信息
    const frontendConfig = {
      upload: {
        allowedExtensions: config.upload.allowedExtensions,
        maxFileSize: config.upload.maxFileSize,
        maxFileSizeMB:
          Math.round((config.upload.maxFileSize / (1024 * 1024)) * 100) / 100,
        allowedFormats: config.upload.allowedExtensions
          .map((ext) => ext.replace(".", ""))
          .join(", ")
          .toUpperCase(),
      },
      storage: {
        path: config.storage.path,
      },
    };

    res.json({
      success: true,
      data: frontendConfig,
    });
  } catch (error) {
    console.error("获取配置错误:", error);
    res.status(500).json({ error: "获取配置失败" });
  }
});

// 图片处理接口
app.post(
  "/api/process-image",
  requirePassword,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "没有选择图片文件" });
      }

      // 获取目标尺寸参数
      const width = parseInt(req.body.width || req.query.width);
      const height = parseInt(req.body.height || req.query.height);
      
      if (!width || !height || width <= 0 || height <= 0) {
        return res.status(400).json({ error: "请提供有效的宽度和高度参数" });
      }

      // 获取目录参数
      let dir = req.body.dir || req.query.dir || "";
      dir = dir.replace(/\\/g, "/");

      // 读取上传的图片
      const inputBuffer = await fs.readFile(req.file.path);
      
      // 获取原图片信息
      const metadata = await sharp(inputBuffer).metadata();
      
      // 计算缩放比例，保持纵横比
      const scaleX = width / metadata.width;
      const scaleY = height / metadata.height;
      const scale = Math.min(scaleX, scaleY);
      
      // 计算缩放后的尺寸
      const scaledWidth = Math.round(metadata.width * scale);
      const scaledHeight = Math.round(metadata.height * scale);
      
      // 计算居中位置
      const left = Math.round((width - scaledWidth) / 2);
      const top = Math.round((height - scaledHeight) / 2);

      // 创建透明背景并合成图片
      const processedBuffer = await sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
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

      // 处理中文文件名
      let originalName = req.file.originalname;
      // 修复：如果包含非 Latin1 字符 (> 255)，说明已经是 UTF-8，不需要转换
      if (!/[^\u0000-\u00ff]/.test(originalName)) {
        try {
          originalName = Buffer.from(originalName, "latin1").toString("utf8");
        } catch (e) {}
      }

      // 生成处理后的文件名
      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      let processedFilename = `${nameWithoutExt}_processed_${width}x${height}.png`;
      
      processedFilename = sanitizeFilename(processedFilename);
      
      // 处理文件名冲突
      const dest = safeJoin(STORAGE_PATH, dir);
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
      
      // 保存处理后的图片
      const processedFilePath = path.join(dest, finalFilename);
      await fs.writeFile(processedFilePath, processedBuffer);
      
      // 删除临时上传文件
      await fs.remove(req.file.path);
      
      const relPath = path.join(dir, finalFilename).replace(/\\/g, "/");
      
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
      
      // 清理临时文件
      if (req.file && req.file.path) {
        try {
          await fs.remove(req.file.path);
        } catch (cleanupError) {
          console.error("清理临时文件失败:", cleanupError);
        }
      }
      
      res.status(500).json({ error: "图片处理失败" });
    }
  }
);

// SVG转PNG接口
app.post("/api/svg2png", requirePassword, async (req, res) => {
  try {
    const { svgCode } = req.body;
    if (!svgCode) {
      return res.status(400).json({ error: "缺少svgCode参数" });
    }
    // 转为png buffer
    const pngBuffer = await sharp(Buffer.from(svgCode)).png().toBuffer();
    res.set("Content-Type", "image/png");
    res.send(pngBuffer);
  } catch (err) {
    res.status(500).json({ error: "SVG转PNG失败", detail: err.message });
  }
});

// 路由回退处理 - 所有非API路由都返回React应用
app.get("*", (req, res) => {
  // 如果是API路由，不处理
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API接口不存在" });
  }

  // 对于所有其他路由，返回React应用的index.html
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});
