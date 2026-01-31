const express = require('express');
const router = express.Router();
const imageRepository = require('../db/imageRepository');
const { requirePassword } = require('../middleware/auth');

// 获取每日流量统计
router.get('/traffic', requirePassword, async (req, res) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 30;
        const stats = imageRepository.getDailyStats(days);
        // Ensure chronological order for charts (DB returns DESC)
        const sorted = stats.reverse();
        res.json({ success: true, data: sorted });
    } catch (e) {
        console.error("Fetch traffic stats error:", e);
        res.status(500).json({ error: "获取流量数据失败" });
    }
});

// 获取热门图片
router.get('/top', requirePassword, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const topImages = imageRepository.getTopImages(limit);

        // Map to standard response format if needed, or just return DB rows
        const data = topImages.map(img => ({
            filename: img.filename,
            relPath: img.rel_path,
            views: img.views,
            size: img.size,
            uploadTime: img.upload_time,
            url: `/api/images/${img.rel_path.split("/").map(encodeURIComponent).join("/")}?w=200`
        }));

        res.json({ success: true, data });
    } catch (e) {
        console.error("Fetch top images error:", e);
        res.status(500).json({ error: "获取热门图片失败" });
    }
});

module.exports = router;
