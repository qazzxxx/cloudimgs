const express = require('express');
const router = express.Router();
const clipService = require('../services/clipService');
const { formatImageResponse } = require('../utils/urlUtils');

// 语义搜索
router.post('/semantic', async (req, res) => {
    try {
        const { query, limit } = req.body;
        if (!query) return res.status(400).json({ success: false, error: "Query is required" });

        const results = await clipService.search(query, limit || 50);

        // 使用 formatImageResponse 标准化输出
        const finalResults = results.map(r => {
            const formatted = formatImageResponse(req, r);
            return {
                ...formatted,
                score: r.distance
            };
        });

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
