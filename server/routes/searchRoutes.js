const express = require('express');
const router = express.Router();
const clipService = require('../services/clipService');

// 语义搜索
router.post('/semantic', async (req, res) => {
    try {
        const { query, limit } = req.body;
        if (!query) return res.status(400).json({ success: false, error: "Query is required" });

        const results = await clipService.search(query, limit || 50);

        // 如果需要，映射结果以匹配标准图片对象结构，
        // 但来自联接的 `i.*` 应该足够了。
        // 我们可能想要构建完整的 URL。
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const finalResults = results.map(r => ({
            ...r,
            uploadTime: r.upload_time, // 映射 snake_case 到 camelCase 以供前端使用
            url: `/api/images/${r.rel_path.split("/").map(encodeURIComponent).join("/")}`,
            fullUrl: `${baseUrl}/api/images/${r.rel_path.split("/").map(encodeURIComponent).join("/")}`,
            score: r.distance
        }));

        res.json({ success: true, data: finalResults });
    } catch (error) {
        console.error("Semantic search error:", error);
        res.status(500).json({ success: false, error: "Search failed" });
    }
});

// 触发全量扫描
router.post('/scan', async (req, res) => {
    try {
        const result = await clipService.scanAll();
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 重新索引所有图片 (清除 DB 并重新扫描)
router.post('/reindex', async (req, res) => {
    try {
        const result = await clipService.reindex();
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 状态
router.get('/status', (req, res) => {
    res.json({
        success: true,
        queueLength: clipService.queue.length,
        processing: clipService.processing
    });
});

module.exports = router;
