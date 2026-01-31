const express = require('express');
const imageRepository = require('../db/imageRepository');

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
                allowedExtensions: config.upload.allowedExtensions
            },
            storage: {
                filename: config.storage.filename
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

module.exports = router;
