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

const app = express();
const PORT = config.server.port;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 增加限制以支持大型 base64 数据
app.use(express.static(path.join(__dirname, "../client/build")));

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
    try {
      originalName = Buffer.from(originalName, "latin1").toString("utf8");
    } catch (e) {
      // ignore
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

    console.log("保存文件名:", finalName, "原始文件名:", file.originalname);
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
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// 递归获取图片文件
async function getAllImages(dir = "") {
  const absDir = safeJoin(STORAGE_PATH, dir);
  let results = [];
  const files = await fs.readdir(absDir);
  for (const file of files) {
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
          url: `/api/images/${encodeURIComponent(relPath.replace(/\\/g, "/"))}`,
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
  
  // 返回文件信息
  const relPath = path.join(dir, filename).replace(/\\/g, "/");
  const safeFilename = sanitizeFilename(filename);
  
  return {
    filename: safeFilename,
    originalName: originalName || safeFilename,
    size: buffer.length,
    mimetype,
    uploadTime: new Date().toISOString(),
    url: `/api/images/${encodeURIComponent(relPath)}`,
    relPath,
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
          data: fileInfo,
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
      try {
        originalName = Buffer.from(originalName, "latin1").toString("utf8");
      } catch (e) {}

      const safeFilename = sanitizeFilename(req.file.filename);

      const fileInfo = {
        filename: safeFilename,
        originalName: originalName, // 用转码后的
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadTime: new Date().toISOString(),
        url: `/api/images/${encodeURIComponent(relPath)}`,
        relPath,
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
        try {
          originalName = Buffer.from(originalName, "latin1").toString("utf8");
        } catch (e) {}
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
        url: `/api/files/${encodeURIComponent(relPath)}`,
        relPath,
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

// 4. 获取指定图片（支持多层目录）
app.get("/api/images/*", (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "图片不存在" });
    }
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

// 5. 删除图片（支持多层目录）
app.delete("/api/images/*", requirePassword, async (req, res) => {
  const relPath = decodeURIComponent(req.params[0]);
  try {
    const filePath = safeJoin(STORAGE_PATH, relPath);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
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
      await fs.remove(filePath);
      res.json({ success: true, message: "文件删除成功" });
    } else {
      res.status(404).json({ error: "文件不存在" });
    }
  } catch (e) {
    res.status(400).json({ error: "非法路径" });
  }
});

// 6. 获取目录列表
async function getDirectories(dir = "") {
  const absDir = safeJoin(STORAGE_PATH, dir);
  let directories = [];

  try {
    const files = await fs.readdir(absDir);
    for (const file of files) {
      const filePath = path.join(absDir, file);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        const relPath = path.join(dir, file).replace(/\\/g, "/");
        directories.push({
          name: file,
          path: relPath,
          fullPath: filePath,
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

// 7. 统计信息（递归统计所有目录）
async function getStats(dir = "") {
  const absDir = safeJoin(STORAGE_PATH, dir);
  let totalImages = 0;
  let totalSize = 0;
  let storagePath = absDir;
  const files = await fs.readdir(absDir);
  for (const file of files) {
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

      // 生成处理后的文件名
      const ext = path.extname(req.file.originalname);
      const nameWithoutExt = path.basename(req.file.originalname, ext);
      let processedFilename = `${nameWithoutExt}_processed_${width}x${height}.png`;
      
      // 处理中文文件名
      let originalName = req.file.originalname;
      try {
        originalName = Buffer.from(originalName, "latin1").toString("utf8");
      } catch (e) {}
      
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
        url: `/api/images/${encodeURIComponent(relPath)}`,
        relPath,
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
