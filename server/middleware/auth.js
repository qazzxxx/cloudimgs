const config = require('../../config');

function requirePassword(req, res, next) {
    if (!config.security.password.enabled) {
        return next();
    }

    const password =
        req.headers["x-access-password"] || req.body.password || req.query.password;

    if (!password) {
        return res.status(401).json({ error: "需要提供访问密码" });
    }

    if (password !== config.security.password.accessPassword) {
        return res.status(401).json({ error: "密码错误" });
    }

    next();
}

module.exports = { requirePassword };
