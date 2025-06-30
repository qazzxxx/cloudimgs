require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const config = require("../config");

// 日志配置
const LOG_DIR = process.env.LOG_DIR || "./logs";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// 确保日志目录存在
fs.ensureDirSync(LOG_DIR);

// 创建日志文件流
const logFile = path.join(LOG_DIR, "app.log");
const errorLogFile = path.join(LOG_DIR, "error.log");

// 日志函数
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  // 输出到控制台
  console.log(logEntry);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  // 输出到文件
  try {
    fs.appendFileSync(logFile, logEntry + "\n");
    if (data) {
      fs.appendFileSync(logFile, JSON.stringify(data, null, 2) + "\n");
    }
  } catch (error) {
    console.error("写入日志文件失败:", error.message);
  }
}

function errorLog(message, error = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [ERROR] ${message}`;

  // 输出到控制台
  console.error(logEntry);
  if (error) {
    console.error(error.stack || error.message);
  }

  // 输出到错误日志文件
  try {
    fs.appendFileSync(errorLogFile, logEntry + "\n");
    if (error) {
      fs.appendFileSync(errorLogFile, (error.stack || error.message) + "\n");
    }
  } catch (err) {
    console.error("写入错误日志文件失败:", err.message);
  }
}

// 重写console方法以支持文件日志
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  originalConsoleLog(...args);
  try {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] [INFO] ${message}\n`
    );
  } catch (error) {
    originalConsoleError("写入日志失败:", error.message);
  }
};

console.error = (...args) => {
  originalConsoleError(...args);
  try {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    fs.appendFileSync(
      errorLogFile,
      `[${new Date().toISOString()}] [ERROR] ${message}\n`
    );
  } catch (error) {
    originalConsoleError("写入错误日志失败:", error.message);
  }
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  try {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] [WARN] ${message}\n`
    );
  } catch (error) {
    originalConsoleError("写入警告日志失败:", error.message);
  }
};

const app = express();
const PORT = config.server.port;

// 启动日志
log("info", `CloudImgs 服务器启动中... 端口: ${PORT}`);
log("info", `日志目录: ${LOG_DIR}`);
log("info", `存储路径: ${config.storage.path}`);

// 中间件
app.use(cors());
app.use(express.json());
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
      if (config.storage.autoCreateDirs) {
        fs.ensureDirSync(dest);
      }
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

// 1. 上传图片接口
app.post(
  "/api/upload",
  requirePassword,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "没有选择文件" });
      }
      let dir = req.body.dir || req.query.dir || "";
      dir = dir.replace(/\\/g, "/");
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
      res.status(500).json({ error: "上传失败" });
    }
  }
);

// 2. 获取图片列表（支持dir参数，递归）
app.get("/api/images", requirePassword, async (req, res) => {
  try {
    let dir = req.query.dir || "";
    dir = dir.replace(/\\/g, "/");
    const images = await getAllImages(dir);
    // 按上传时间倒序排列
    images.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    res.json({
      success: true,
      data: images,
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
    res.json({
      success: true,
      data: randomImage,
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
      if (
        [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].includes(ext)
      ) {
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

// SVG转PNG API接口
app.post("/api/svg-to-png", requirePassword, async (req, res) => {
  try {
    const {
      svgCode,
      width = 800,
      height = 600,
      uploadToStorage = false,
      dir = "",
    } = req.body;

    log("info", "SVG转PNG请求开始", {
      width,
      height,
      uploadToStorage,
      dir,
      svgCodeLength: svgCode ? svgCode.length : 0,
    });

    if (!svgCode) {
      log("warn", "SVG转PNG请求缺少SVG代码");
      return res.status(400).json({ error: "请提供SVG代码" });
    }

    // 验证SVG代码
    if (!svgCode.includes("<svg") || !svgCode.includes("</svg>")) {
      log("warn", "SVG转PNG请求包含无效的SVG代码");
      return res.status(400).json({ error: "无效的SVG代码" });
    }

    log("info", "开始转换SVG为PNG", { width, height });

    // 使用sharp转换SVG为PNG
    const pngBuffer = await sharp(Buffer.from(svgCode))
      .resize(parseInt(width), parseInt(height), {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    log("info", "SVG转换完成", {
      pngSize: pngBuffer.length,
      originalWidth: width,
      originalHeight: height,
    });

    // 如果不需要上传到存储，直接返回PNG文件
    if (!uploadToStorage) {
      log("info", "返回PNG文件，不上传到存储");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", 'inline; filename="converted.png"');
      return res.send(pngBuffer);
    }

    // 上传到存储
    const filename = `svg-converted-${Date.now()}.png`;
    const targetDir = dir.replace(/\\/g, "/");
    const dest = safeJoin(STORAGE_PATH, targetDir);

    log("info", "准备上传到存储", { filename, targetDir, dest });

    // 确保目录存在
    if (config.storage.autoCreateDirs) {
      fs.ensureDirSync(dest);
      log("info", "创建目录", { dest });
    }

    const filePath = path.join(dest, filename);
    await fs.writeFile(filePath, pngBuffer);

    const relPath = path.join(targetDir, filename).replace(/\\/g, "/");
    const stats = await fs.stat(filePath);

    const fileInfo = {
      filename: filename,
      originalName: "converted.svg",
      size: stats.size,
      mimetype: "image/png",
      uploadTime: new Date().toISOString(),
      url: `/api/images/${encodeURIComponent(relPath)}`,
      relPath,
      originalSvgSize: {
        width: parseInt(width),
        height: parseInt(height),
      },
    };

    log("info", "SVG转换并上传成功", fileInfo);

    res.json({
      success: true,
      message: "SVG转换并上传成功",
      data: fileInfo,
    });
  } catch (error) {
    errorLog("SVG转PNG错误", error);
    res.status(500).json({ error: "SVG转换失败: " + error.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  log("info", `Server running on port ${PORT}`);
  log("info", "CloudImgs 服务器启动完成");
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

// 路由回退处理 - 所有非API路由都返回React应用
app.get("*", (req, res) => {
  // 如果是API路由，不处理
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API接口不存在" });
  }

  // 对于所有其他路由，返回React应用的index.html
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});
