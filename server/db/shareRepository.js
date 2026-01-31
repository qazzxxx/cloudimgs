const db = require('./database');
const crypto = require('crypto');

const createShare = db.prepare(`
    INSERT INTO shares (token, path, created_at, expire_seconds, burn_after_reading)
    VALUES (@token, @path, @createdAt, @expireSeconds, @burnAfterReading)
`);

const getShare = db.prepare('SELECT * FROM shares WHERE token = ?');

const getSharesByPath = db.prepare('SELECT * FROM shares WHERE path = ? ORDER BY created_at DESC');

const revokeShare = db.prepare('UPDATE shares SET is_revoked = 1 WHERE token = ?');

const deleteShare = db.prepare('DELETE FROM shares WHERE token = ?');

const incrementView = db.prepare('UPDATE shares SET views = views + 1 WHERE token = ?');

module.exports = {
    create: (data) => {
        const token = crypto.randomBytes(16).toString('hex');
        const info = {
            token,
            path: data.path,
            createdAt: Date.now(),
            expireSeconds: data.expireSeconds || 0,
            burnAfterReading: data.burnAfterReading ? 1 : 0
        };
        createShare.run(info);
        return token;
    },

    getByToken: (token) => {
        return getShare.get(token);
    },

    listByPath: (path) => {
        return getSharesByPath.all(path);
    },

    revoke: (token) => {
        return revokeShare.run(token);
    },

    delete: (token) => {
        return deleteShare.run(token);
    },

    incrementView: (token) => {
        return incrementView.run(token);
    }
};
