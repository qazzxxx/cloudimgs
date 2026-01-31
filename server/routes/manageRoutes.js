const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { requirePassword } = require('../middleware/auth');
const imageRepository = require('../db/imageRepository');
const { syncFileSystem } = require('../services/syncService');
const { safeJoin, TRASH_DIR_NAME, CACHE_DIR_NAME } = require('../utils/fileUtils');

const router = express.Router();
const STORAGE_PATH = config.storage.path;

async function getAlbumPasswordPath(dirPath) {
    const absDir = safeJoin(STORAGE_PATH, dirPath);
    return path.join(absDir, "config", "album_password.json");
}

async function verifyAlbumPassword(dirPath, password) {
    try {
        const configPath = await getAlbumPasswordPath(dirPath);
        if (await fs.pathExists(configPath)) {
            const data = await fs.readJson(configPath);
            return data.password === password;
        }
        return true;
    } catch (e) {
        return false;
    }
}

// 0. 手动同步
router.post('/sync', requirePassword, async (req, res) => {
    try {
        await syncFileSystem();
        res.json({ success: true, message: "同步完成" });
    } catch (e) {
        console.error("Sync failed:", e);
        res.status(500).json({ success: false, error: "同步失败" });
    }
});

// 1. 相册密码管理
router.post('/album/password', requirePassword, async (req, res) => {
    try {
        const { dir, password } = req.body;
        if (dir === undefined) return res.status(400).json({ error: "Missing directory" });

        const configPath = await getAlbumPasswordPath(dir);

        if (!password) {
            if (await fs.pathExists(configPath)) {
                await fs.remove(configPath);
            }
            return res.json({ success: true, message: "密码已移除" });
        }

        await fs.ensureDir(path.dirname(configPath));
        await fs.writeJSON(configPath, { password });
        res.json({ success: true, message: "密码设置成功" });
    } catch (e) {
        console.error("Set album password error:", e);
        res.status(500).json({ error: "设置密码失败" });
    }
});

router.post('/album/verify', requirePassword, async (req, res) => {
    try {
        const { dir, password } = req.body;
        if (dir === undefined) return res.status(400).json({ error: "Missing directory" });

        const isValid = await verifyAlbumPassword(dir, password);
        if (isValid) {
            res.json({ success: true, message: "验证通过" });
        } else {
            res.status(401).json({ success: false, error: "密码错误" });
        }
    } catch (e) {
        res.status(500).json({ error: "验证失败" });
    }
});

// 2. 回收站逻辑
async function moveToTrash(filePath) {
    try {
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName);
        const nameWithoutExt = path.basename(fileName, ext);
        const timestamp = Date.now();
        const trashName = `${nameWithoutExt}_${timestamp}${ext}`;
        const trashPath = path.join(STORAGE_PATH, TRASH_DIR_NAME, trashName);

        await fs.ensureDir(path.dirname(trashPath));
        await fs.move(filePath, trashPath, { overwrite: true });
        return true;
    } catch (error) {
        console.error("[Trash] Move failed:", error);
        throw error;
    }
}

// 3. 删除图片
router.delete('/images/*', requirePassword, async (req, res) => {
    const relPath = decodeURIComponent(req.params[0]);
    try {
        const filePath = safeJoin(STORAGE_PATH, relPath);
        if (await fs.pathExists(filePath)) {
            await moveToTrash(filePath);

            // 移除 thumbhash
            const dir = path.dirname(filePath);
            const filename = path.basename(filePath);
            const cacheFile = path.join(dir, CACHE_DIR_NAME, `${filename}.th`);
            if (await fs.pathExists(cacheFile)) await fs.remove(cacheFile);

            // 从 DB 移除
            imageRepository.delete(relPath);

            res.json({ success: true });
        } else {
            // 如果不在磁盘上但在 DB 中？
            imageRepository.delete(relPath);
            res.status(404).json({ error: "图片不存在 (但在数据库中已清理)" });
        }
    } catch (e) {
        res.status(400).json({ error: "操作失败" });
    }
});

// 4. 删除文件
router.delete('/files/*', requirePassword, async (req, res) => {
    const relPath = decodeURIComponent(req.params[0]);
    try {
        const filePath = safeJoin(STORAGE_PATH, relPath);
        if (await fs.pathExists(filePath)) {
            await moveToTrash(filePath);
            // 如果存在则从 DB 移除（可能是通过 upload-file 上传的）
            imageRepository.delete(relPath);
            res.json({ success: true, message: "文件已移至回收站" });
        } else {
            res.status(404).json({ error: "文件不存在" });
        }
    } catch (e) {
        res.status(400).json({ error: "操作失败" });
    }
});

// 5. 批量移动
router.post('/batch/move', requirePassword, async (req, res) => {
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
                    if (await fs.pathExists(newFilePath)) {
                        let counter = 1;
                        const ext = path.extname(filename);
                        const nameBase = path.basename(filename, ext);
                        while (await fs.pathExists(newFilePath)) {
                            const newName = `${nameBase}_${Date.now()}_${counter}${ext}`;
                            newRelPath = path.join(newDir, newName).replace(/\\/g, "/");
                            newFilePath = safeJoin(STORAGE_PATH, newRelPath);
                            counter++;
                        }
                    }

                    await fs.move(oldFilePath, newFilePath);

                    // 更新 DB：删除旧的，添加新的（重新扫描元数据？或者只是更新路径？）
                    // 元数据应该不会改变太多，除非移动影响 mtime（通常在同一 FS 上不会）
                    // 但更新路径最简单。
                    // 但是，thumbhash 缓存文件也需要移动！

                    // 移动 thumbhash
                    const oldCachePath = path.join(path.dirname(oldFilePath), CACHE_DIR_NAME, `${filename}.th`);
                    if (await fs.pathExists(oldCachePath)) {
                        const newCacheDir = path.join(path.dirname(newFilePath), CACHE_DIR_NAME);
                        await fs.ensureDir(newCacheDir);
                        const newCachePath = path.join(newCacheDir, `${path.basename(newFilePath)}.th`);
                        await fs.move(oldCachePath, newCachePath);
                    }

                    // 更新 DB
                    const dbImage = imageRepository.getByPath(oldRelPath);
                    if (dbImage) {
                        dbImage.rel_path = newRelPath;
                        dbImage.filename = path.basename(newFilePath);
                        // 更新缓存中的 thumbhash 路径？不，DB 直接在 'thumbhash' 列中存储内容？
                        // 等等，Schema 中 'thumbhash' 是 TEXT (base64)。
                        // 所以我们不需要更新 DB thumbhash 内容，除非重新生成。
                        // 我们只需更新路径。
                        imageRepository.delete(oldRelPath);
                        imageRepository.add(dbImage);
                        // 或者在此处更新 rel_path = old... 但主键是 ID。
                        // rel_path 是唯一的。
                        // 其实 `imageRepository.update` 使用 rel_path 作为键。
                        // 所以我不能轻易用我写的 `update` 函数更改 rel_path。
                        // `updateImage` SQL: WHERE rel_path = @relPath。
                        // 所以我必须删除并添加。
                    }

                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error(`Move failed for ${relPath}:`, e);
                failCount++;
            }
        }
        res.json({ success: true, successCount, failCount });

    } catch (e) {
        res.status(500).json({ error: "批量移动失败" });
    }
});

// 6. 创建目录
router.post('/directories', requirePassword, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Missing directory name" });

        // Basic validation
        if (name.includes("..") || name.includes("\\") || name.startsWith("/")) {
            return res.status(400).json({ error: "Invalid directory name" });
        }

        const absDir = safeJoin(STORAGE_PATH, name);
        if (await fs.pathExists(absDir)) {
            return res.status(400).json({ error: "Directory already exists" });
        }

        await fs.ensureDir(absDir);
        res.json({ success: true, message: "目录创建成功" });
    } catch (e) {
        console.error("Create directory failed:", e);
        res.status(500).json({ error: "创建目录失败" });
    }
});

module.exports = router;
