const db = require('./database');

const insertImage = db.prepare(`
  INSERT INTO images (filename, rel_path, size, mtime, upload_time, width, height, orientation, thumbhash, meta_json)
  VALUES (@filename, @rel_path, @size, @mtime, @upload_time, @width, @height, @orientation, @thumbhash, @meta_json)
`);

const updateImage = db.prepare(`
  UPDATE images 
  SET filename = @filename, size = @size, mtime = @mtime, upload_time = @upload_time, 
      width = @width, height = @height, orientation = @orientation, thumbhash = @thumbhash, meta_json = @meta_json
  WHERE rel_path = @rel_path
`);

const getImageByPath = db.prepare('SELECT * FROM images WHERE rel_path = ?');
const getAllImagesQuery = db.prepare('SELECT * FROM images ORDER BY upload_time DESC');
const deleteImageByPath = db.prepare('DELETE FROM images WHERE rel_path = ?');
const countImages = db.prepare('SELECT COUNT(*) as count FROM images');
const getImagesByDir = db.prepare("SELECT * FROM images WHERE rel_path LIKE ? || '/%' ORDER BY upload_time DESC");
const getPreviewsQuery = db.prepare("SELECT * FROM images WHERE rel_path LIKE ? || '/%' ORDER BY upload_time DESC LIMIT ?");
const countImagesByDirQuery = db.prepare("SELECT COUNT(*) as count FROM images WHERE rel_path LIKE ? || '/%'");

// 批量操作
const insertMany = db.transaction((images) => {
    for (const img of images) insertImage.run(img);
});

// 统计数据 SQL
const incrementViewQuery = db.prepare('UPDATE images SET views = views + 1, last_viewed = @now WHERE rel_path = @relPath');

const recordDailyUploadQuery = db.prepare(`
  INSERT INTO daily_stats (date, uploads_count, uploads_size)
  VALUES (@date, 1, @size)
  ON CONFLICT(date) DO UPDATE SET
  uploads_count = uploads_count + 1,
  uploads_size = uploads_size + @size
`);

const recordDailyViewQuery = db.prepare(`
  INSERT INTO daily_stats (date, views_count, views_size)
  VALUES (@date, 1, @size)
  ON CONFLICT(date) DO UPDATE SET
  views_count = views_count + 1,
  views_size = views_size + @size
`);

const getDailyStatsQuery = db.prepare('SELECT * FROM daily_stats ORDER BY date DESC LIMIT ?');
const getTopImagesQuery = db.prepare('SELECT * FROM images ORDER BY views DESC LIMIT ?');

module.exports = {
    add: (image) => {
        try {
            return insertImage.run(image);
        } catch (e) {
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                // 如果已存在，尝试更新
                // 目前仅记录日志或重新抛出，或者可以使用 INSERT OR REPLACE
                console.warn(`Image ${image.relPath} already exists in DB. Attempting update.`);
                return updateImage.run(image);
            }
            throw e;
        }
    },
    update: (image) => updateImage.run(image),
    getByPath: (relPath) => getImageByPath.get(relPath),
    getAll: () => getAllImagesQuery.all(),
    delete: (relPath) => deleteImageByPath.run(relPath),
    count: () => countImages.get().count,
    getByDir: (dir) => {
        // 处理根目录特殊情况，通常 dir 为空字符串表示根
        // 如果 dir 为空，返回所有？还是仅根目录项？
        // getAllImagesQuery 返回所有
        // 如果提供了 dir，使用 LIKE 匹配
        if (!dir) return getAllImagesQuery.all();
        return getImagesByDir.all(dir);
    },
    getPreviews: (dir, limit = 3) => getPreviewsQuery.all(dir, limit),
    countByDir: (dir) => countImagesByDirQuery.get(dir).count,
    insertMany,
    // 事务辅助函数
    transaction: (fn) => db.transaction(fn),

    // Stats Methods
    incrementViews: (relPath) => incrementViewQuery.run({ relPath, now: Date.now() }),
    recordUpload: (size) => {
        const date = new Date().toISOString().split('T')[0];
        recordDailyUploadQuery.run({ date, size });
    },
    recordView: (size) => {
        const date = new Date().toISOString().split('T')[0];
        recordDailyViewQuery.run({ date, size });
    },
    getDailyStats: (limit = 30) => getDailyStatsQuery.all(limit),
    getTopImages: (limit = 10) => getTopImagesQuery.all(limit),
};
