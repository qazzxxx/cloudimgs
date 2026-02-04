const express = require('express');
const router = express.Router();
const shareRepository = require('../db/shareRepository');
const imageRepository = require('../db/imageRepository');
const { requirePassword } = require('../middleware/auth');
const { formatImageResponse } = require('../utils/urlUtils');
const path = require('path');

// List Share Links for a path
router.get('/list', requirePassword, (req, res) => {
    try {
        const { path: sharePath } = req.query;
        // if (!sharePath) return res.status(400).json({ error: "Missing path" }); 
        // Allow listing ALL if path missing? Logic in AlbumManager passes path.

        const shares = shareRepository.listByPath(sharePath || "");

        // Calculate status for each share
        const now = Date.now();
        const result = shares.map(s => {
            let status = 'active';
            if (s.is_revoked) status = 'revoked';
            else if (s.burn_after_reading && s.views > 0) status = 'burned';
            else if (s.expire_seconds > 0) {
                const expireTime = s.created_at + (s.expire_seconds * 1000);
                if (now > expireTime) status = 'expired';
            }
            return {
                token: s.token,
                signature: s.token, // Using token as signature for now
                path: s.path,
                createdAt: s.created_at,
                expireSeconds: s.expire_seconds,
                burnAfterReading: !!s.burn_after_reading,
                status,
                views: s.views
            };
        });

        res.json({ success: true, data: result });
    } catch (e) {
        console.error("List shares error:", e);
        res.status(500).json({ error: "Failed to list shares" });
    }
});

// Generate Share Link
router.post('/generate', requirePassword, (req, res) => {
    try {
        const { path, expireSeconds, burnAfterReading } = req.body;
        if (path === undefined) return res.status(400).json({ error: "Missing path" });

        const token = shareRepository.create({
            path,
            expireSeconds: expireSeconds || 0,
            burnAfterReading: !!burnAfterReading
        });

        res.json({ success: true, token });
    } catch (e) {
        console.error("Generate share error:", e);
        res.status(500).json({ error: "Failed to generate share" });
    }
});

// Revoke Share Link
router.post('/revoke', requirePassword, (req, res) => {
    try {
        const { signature } = req.body;
        if (!signature) return res.status(400).json({ error: "Missing signature" });

        shareRepository.revoke(signature);
        res.json({ success: true });
    } catch (e) {
        console.error("Revoke share error:", e);
        res.status(500).json({ error: "Failed to revoke share" });
    }
});

// Delete Share Link (History)
router.delete('/delete', requirePassword, (req, res) => {
    try {
        const { signature } = req.body; // or req.body.data if axios sends it there? Express req.body handles it if JSON middleware is on.
        // Wait, DELETE with body? Client sends `data: { ... }`. Express `req.body` should have it.

        if (!signature) return res.status(400).json({ error: "Missing signature" });

        shareRepository.delete(signature);
        res.json({ success: true });
    } catch (e) {
        console.error("Delete share error:", e);
        res.status(500).json({ error: "Failed to delete share" });
    }
});

// Access Shared Content (Public)
router.get('/access', (req, res) => {
    try {
        const { token, page = 1, pageSize = 20 } = req.query;
        if (!token) return res.status(400).json({ error: "Missing token" });

        const share = shareRepository.getByToken(token);
        if (!share) return res.status(404).json({ error: "Invalid link" });

        // Check verification (expiry, burn, revoked)
        if (share.is_revoked) return res.status(403).json({ error: "Link has been revoked" });

        const now = Date.now();
        if (share.expire_seconds > 0) {
            const expireTime = share.created_at + (share.expire_seconds * 1000);
            if (now > expireTime) return res.status(403).json({ error: "Link expired" });
        }

        if (share.burn_after_reading && share.views > 0) {
            return res.status(403).json({ error: "Link already used (Burned)" });
        }

        // Increment view count
        shareRepository.incrementView(token);

        // Get images
        let images = imageRepository.getByDir(share.path);

        // Pagination
        const p = parseInt(page);
        const ps = parseInt(pageSize);
        const total = images.length;
        const totalPages = Math.ceil(total / ps);
        const start = (p - 1) * ps;
        const end = start + ps;
        const sliced = images.slice(start, end); // Basic memory pagination. For huge sets, DB limit/offset is better but we use `LIKE` which is tricky for deep pagination without more logic.

        // Get dirname
        const dirName = share.path.split('/').pop() || (share.path === "" ? "全部图片" : share.path);

        res.json({
            success: true,
            data: sliced.map(img => formatImageResponse(req, img)),
            dirName,
            pagination: {
                current: p,
                pageSize: ps,
                total,
                totalPages
            }
        });

    } catch (e) {
        console.error("Share access error:", e);
        res.status(500).json({ error: "Failed to access share" });
    }
});

module.exports = router;
