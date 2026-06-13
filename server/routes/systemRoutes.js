const express = require('express');
const imageRepository = require('../db/imageRepository');
const db = require('../db/database');

const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).json({ status: "ok" });
});

router.get('/stats', (req, res) => {
    // 基本统计
    const count = imageRepository.count();
    res.json({
        success: true,
        data: {
            imageCount: count
        }
    });
});

router.get('/config', (req, res) => {
    // 返回安全公开配置
    const config = require('../../config');
    res.json({
        success: true,
        data: {
        upload: {
                maxFileSize: config.upload.maxFileSize,
                allowedExtensions: config.upload.allowedExtensions,
                thumbnailWidth: config.upload.thumbnailWidth,
            },
            storage: {
                filename: config.storage.filename
            },
            magicSearch: {
                enabled: config.magicSearch.enabled
            }
        }
    });
});

router.get('/auth/status', (req, res) => {
    const config = require('../../config');
    res.json({
        success: true,
        data: {
            enabled: config.security.password.enabled,
            // 此处不验证密码，仅返回状态
            // 前端调用此接口以检查是否需要提示输入密码
        }
    });
});

router.post('/auth/login', (req, res) => {
    const config = require('../../config');
    const { password } = req.body;
    if (!config.security.password.enabled) {
        return res.json({ success: true, message: "No password required" });
    }
    if (password === config.security.password.accessPassword) {
        return res.json({ success: true, message: "Login successful" });
    }
    res.status(401).json({ success: false, error: "Incorrect password" });
});

// 用户设置 API
router.get('/settings', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM user_settings').all();
        const settings = {};
        rows.forEach(row => {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch {
                settings[row.key] = row.value;
            }
        });
        res.json({ success: true, data: settings });
    } catch (e) {
        console.error("Get settings error:", e);
        res.status(500).json({ success: false, error: "获取设置失败" });
    }
});

router.put('/settings', (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) {
            return res.status(400).json({ success: false, error: "设置键不能为空" });
        }

        const valueStr = JSON.stringify(value);
        const now = Date.now();

        db.prepare(`
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (@key, @value, @updatedAt)
            ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updatedAt
        `).run({ key, value: valueStr, updatedAt: now });

        res.json({ success: true });
    } catch (e) {
        console.error("Save settings error:", e);
        res.status(500).json({ success: false, error: "保存设置失败" });
    }
});

router.put('/settings/batch', (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, error: "设置数据无效" });
        }

        const now = Date.now();
        const upsert = db.prepare(`
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (@key, @value, @updatedAt)
            ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updatedAt
        `);

        const transaction = db.transaction((items) => {
            for (const [key, value] of Object.entries(items)) {
                upsert.run({ key, value: JSON.stringify(value), updatedAt: now });
            }
        });

        transaction(settings);
        res.json({ success: true });
    } catch (e) {
        console.error("Batch save settings error:", e);
        res.status(500).json({ success: false, error: "批量保存设置失败" });
    }
});

module.exports = router;
