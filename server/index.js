const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/build")));

// 配置存储路径
const STORAGE_PATH =
  process.env.STORAGE_PATH || path.join(__dirname, "../uploads");

// 确保存储目录存在
fs.ensureDirSync(STORAGE_PATH);

// 配置multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_PATH);
  },
  filename: (req, file, cb) => {
    // 保持原文件名
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);

    // 如果文件已存在，添加时间戳
    let finalName = originalName;
    let counter = 1;

    while (fs.existsSync(path.join(STORAGE_PATH, finalName))) {
      finalName = `${nameWithoutExt}_${Date.now()}_${counter}${ext}`;
      counter++;
    }

    cb(null, finalName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|svg/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("只支持图片文件格式"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
});

// API路由

// 1. 上传图片接口
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有选择文件" });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadTime: new Date().toISOString(),
      url: `/api/images/${req.file.filename}`,
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
});

// 2. 获取图片列表
app.get("/api/images", async (req, res) => {
  try {
    const files = await fs.readdir(STORAGE_PATH);
    const imageFiles = [];

    for (const file of files) {
      const filePath = path.join(STORAGE_PATH, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (
          [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].includes(
            ext
          )
        ) {
          imageFiles.push({
            filename: file,
            size: stats.size,
            uploadTime: stats.mtime.toISOString(),
            url: `/api/images/${file}`,
          });
        }
      }
    }

    // 按上传时间倒序排列
    imageFiles.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

    res.json({
      success: true,
      data: imageFiles,
    });
  } catch (error) {
    console.error("获取图片列表错误:", error);
    res.status(500).json({ error: "获取图片列表失败" });
  }
});

// 3. 获取随机图片
app.get("/api/random", async (req, res) => {
  try {
    const files = await fs.readdir(STORAGE_PATH);
    const imageFiles = [];

    for (const file of files) {
      const filePath = path.join(STORAGE_PATH, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (
          [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].includes(
            ext
          )
        ) {
          imageFiles.push({
            filename: file,
            url: `/api/images/${file}`,
          });
        }
      }
    }

    if (imageFiles.length === 0) {
      return res.status(404).json({ error: "没有找到图片" });
    }

    // 随机选择一张图片
    const randomImage =
      imageFiles[Math.floor(Math.random() * imageFiles.length)];

    res.json({
      success: true,
      data: randomImage,
    });
  } catch (error) {
    console.error("获取随机图片错误:", error);
    res.status(500).json({ error: "获取随机图片失败" });
  }
});

// 4. 获取指定图片
app.get("/api/images/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(STORAGE_PATH, filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "图片不存在" });
  }
});

// 5. 删除图片
app.delete("/api/images/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(STORAGE_PATH, filename);

    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      res.json({ success: true, message: "图片删除成功" });
    } else {
      res.status(404).json({ error: "图片不存在" });
    }
  } catch (error) {
    console.error("删除图片错误:", error);
    res.status(500).json({ error: "删除图片失败" });
  }
});

// 6. 获取存储统计信息
app.get("/api/stats", async (req, res) => {
  try {
    const files = await fs.readdir(STORAGE_PATH);
    let totalSize = 0;
    let imageCount = 0;

    for (const file of files) {
      const filePath = path.join(STORAGE_PATH, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (
          [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"].includes(
            ext
          )
        ) {
          totalSize += stats.size;
          imageCount++;
        }
      }
    }

    res.json({
      success: true,
      data: {
        totalImages: imageCount,
        totalSize: totalSize,
        storagePath: STORAGE_PATH,
      },
    });
  } catch (error) {
    console.error("获取统计信息错误:", error);
    res.status(500).json({ error: "获取统计信息失败" });
  }
});

// 处理React路由
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error("服务器错误:", error);
  res.status(500).json({ error: "服务器内部错误" });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`存储路径: ${STORAGE_PATH}`);
  console.log(`访问地址: http://localhost:${PORT}`);
});
