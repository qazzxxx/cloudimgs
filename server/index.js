require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const config = require("../config"); // config.js is in root usually? checking old index.js: require("../config")
// Wait, index.js is in server/, so ../config is in root. Correct.

const uploadRoutes = require("./routes/uploadRoutes");
const imageRoutes = require("./routes/imageRoutes");
const manageRoutes = require("./routes/manageRoutes");
const systemRoutes = require("./routes/systemRoutes");
const shareRoutes = require("./routes/shareRoutes");
const { migrateFromLegacyJson, syncFileSystem } = require("./services/syncService");


const app = express();
const PORT = config.server.port || 5000; // fallback

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, "../client/build")));
app.enable("trust proxy");

// 路由
// 顺序很重要！
// /api/health 可能最先
app.use("/api", systemRoutes);

// 上传
app.use("/api", uploadRoutes); // /upload, /upload-base64

// 分享
app.use("/api/share", shareRoutes);

// 管理（密码、回收站、批量移动）
app.use("/api", manageRoutes); // /batch/move, /album/*, /images/* (DELETE)

// 图片 (GET) - 放在最后捕获 /images/*
app.use("/api", imageRoutes); // /images, /images/*, /files/*

// 数据库迁移和同步
(async () => {
  try {
    console.log("Initializing database...");
    await migrateFromLegacyJson();
    await syncFileSystem();
  } catch (e) {
    console.error("Initialization failed:", e);
  }
})();

// 回收站清理任务
const { TRASH_DIR_NAME, safeJoin } = require("./utils/fileUtils");
const STORAGE_PATH = config.storage.path;

async function cleanTrash() {
  const trashDir = path.join(STORAGE_PATH, TRASH_DIR_NAME);
  if (!(await fs.pathExists(trashDir))) return;

  try {
    const files = await fs.readdir(trashDir);
    const now = Date.now();
    const EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000; // 30 Days

    for (const file of files) {
      const filePath = path.join(trashDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > EXPIRE_TIME) {
          await fs.remove(filePath);
          console.log(`[Trash] Cleaned expired file: ${file}`);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    console.error("[Trash] Cleanup failed:", e);
  }
}

// 启动清理任务
cleanTrash();
setInterval(cleanTrash, 24 * 60 * 60 * 1000);


// 所有其他 GET 请求都返回 React 应用 (SPA 支持)
app.get('*', (req, res) => {
  // 避免 API 请求返回 HTML
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: "Not Found" });
  }
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
