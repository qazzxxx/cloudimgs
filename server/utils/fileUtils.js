const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const config = require('../../config');

const CACHE_DIR_NAME = ".cache";

function safeJoin(base, target) {
    const targetPath = path.resolve(base, target || "");
    if (!targetPath.startsWith(path.resolve(base))) {
        throw new Error("非法目录路径");
    }
    return targetPath;
}

function sanitizeFilename(filename) {
    try {
        if (filename.includes("%")) {
            filename = decodeURIComponent(filename);
        }
        if (Buffer.isBuffer(filename)) {
            filename = filename.toString("utf8");
        }
        if (config.storage.filename.sanitizeSpecialChars) {
            filename = filename.replace(
                /[<>:"/\\|?*]/g,
                config.storage.filename.specialCharReplacement
            );
        }
        return filename;
    } catch (error) {
        console.warn("文件名处理错误:", error);
        return filename.replace(
            /[<>:"/\\|?*]/g,
            config.storage.filename.specialCharReplacement
        );
    }
}

async function generateThumbHash(filePath) {
    try {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);

        const ext = path.extname(filename).toLowerCase();
        if (['.mp4', '.webm'].includes(ext)) {
            return null;
        }

        const cacheDir = path.join(dir, CACHE_DIR_NAME);
        const cacheFile = path.join(cacheDir, `${filename}.th`);

        await fs.ensureDir(cacheDir);

        const image = sharp(filePath).resize(100, 100, { fit: 'inside' });
        const { data, info } = await image
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { rgbaToThumbHash } = await import("thumbhash");
        const binaryHash = rgbaToThumbHash(info.width, info.height, data);
        await fs.writeFile(cacheFile, Buffer.from(binaryHash));
        return Buffer.from(binaryHash).toString('base64');
    } catch (err) {
        console.error(`Failed to generate thumbhash for ${filePath}:`, err);
        return null;
    }
}

async function getThumbHash(filePath) {
    try {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);
        const cacheFile = path.join(dir, CACHE_DIR_NAME, `${filename}.th`);

        if (await fs.pathExists(cacheFile)) {
            const buffer = await fs.readFile(cacheFile);
            return buffer.toString('base64');
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function saveBase64Image(base64Data, dir) {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('无效的 base64 图片格式');
    }

    const mimetype = matches[1];
    if (!/^image\//.test(mimetype)) {
        throw new Error('仅允许图片类型的 base64 上传');
    }
    const buffer = Buffer.from(matches[2], 'base64');

    const ext = mimetype.split('/')[1] || 'png';
    const filename = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;

    const targetDir = safeJoin(config.storage.path, dir);
    await fs.ensureDir(targetDir);

    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    return {
        filename,
        filePath,
        size: buffer.length,
        mimetype
    };
}

async function downloadFromUrl(imageUrl) {
    return new Promise((resolve, reject) => {
        const protocol = imageUrl.startsWith('https') ? require('https') : require('http');
        const urlObj = new URL(imageUrl);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (imageUrl.startsWith('https') ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        };

        const req = protocol.request(options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                downloadFromUrl(res.headers.location).then(resolve).catch(reject);
                req.destroy();
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`下载失败: HTTP ${res.statusCode}`));
                return;
            }

            const contentType = res.headers['content-type'] || '';
            if (!contentType.startsWith('image/')) {
                reject(new Error('URL 不是图片类型'));
                return;
            }

            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    buffer,
                    mimetype: contentType
                });
            });
            res.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('下载超时'));
        });

        req.end();
    });
}

module.exports = {
    safeJoin,
    sanitizeFilename,
    generateThumbHash,
    getThumbHash,
    saveBase64Image,
    downloadFromUrl,
    CACHE_DIR_NAME,
    TRASH_DIR_NAME: ".trash",
    CONFIG_DIR_NAME: "config"
};
