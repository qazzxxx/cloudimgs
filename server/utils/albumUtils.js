const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const { safeJoin, CACHE_DIR_NAME, CONFIG_DIR_NAME, TRASH_DIR_NAME } = require('./fileUtils');

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

async function isAlbumLocked(dirPath) {
    try {
        const configPath = await getAlbumPasswordPath(dirPath);
        if (await fs.pathExists(configPath)) {
            const data = await fs.readJson(configPath);
            return !!data.password;
        }
    } catch (e) { }
    return false;
}

async function getAllLockedDirectories() {
    const lockedDirs = [];
    async function scan(dir) {
        const absDir = safeJoin(STORAGE_PATH, dir);
        try {
            const files = await fs.readdir(absDir);
            for (const file of files) {
                if (file === CACHE_DIR_NAME || file === CONFIG_DIR_NAME || file === TRASH_DIR_NAME) continue;
                if (file.startsWith('.')) continue;

                const filePath = path.join(absDir, file);
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) {
                    const relPath = path.join(dir, file).replace(/\\/g, "/");
                    if (await isAlbumLocked(relPath)) {
                        lockedDirs.push(relPath);
                    }
                    await scan(relPath);
                }
            }
        } catch (e) { }
    }
    await scan("");
    return lockedDirs;
}

module.exports = {
    getAlbumPasswordPath,
    verifyAlbumPassword,
    isAlbumLocked,
    getAllLockedDirectories
};
