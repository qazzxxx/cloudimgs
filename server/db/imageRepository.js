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
const getAllSyncEntriesQuery = db.prepare('SELECT rel_path, mtime FROM images');
const getPreviewsQuery = db.prepare("SELECT * FROM images WHERE rel_path LIKE ? || '/%' ORDER BY upload_time DESC LIMIT ?");
const countImagesByDirQuery = db.prepare("SELECT COUNT(*) as count FROM images WHERE rel_path LIKE ? || '/%'");
const getAllImagesByViewsQuery = db.prepare('SELECT * FROM images ORDER BY views DESC');

// 分页查询 (按目录 + 搜索)
const getPaginatedQuery = db.prepare(`
  SELECT * FROM images
  WHERE rel_path LIKE ? || '/%'
    AND (? = '' OR filename LIKE '%' || ? || '%')
  ORDER BY upload_time DESC
  LIMIT ? OFFSET ?
`);

const getPaginatedRootQuery = db.prepare(`
  SELECT * FROM images
  WHERE (? = '' OR filename LIKE '%' || ? || '%')
  ORDER BY upload_time DESC
  LIMIT ? OFFSET ?
`);

const countByDirFilteredQuery = db.prepare(`
  SELECT COUNT(*) as count FROM images
  WHERE rel_path LIKE ? || '/%'
    AND (? = '' OR filename LIKE '%' || ? || '%')
`);

const countRootFilteredQuery = db.prepare(`
  SELECT COUNT(*) as count FROM images
  WHERE (? = '' OR filename LIKE '%' || ? || '%')
`);

// 带目录分页 (分享页用)
const getPaginatedByDirQuery = db.prepare(`
  SELECT * FROM images WHERE rel_path LIKE ? || '/%' ORDER BY upload_time DESC LIMIT ? OFFSET ?
`);
const countByDirQuery = db.prepare("SELECT COUNT(*) as count FROM images WHERE rel_path LIKE ? || '/%'");

// 地图数据: 只查有 GPS 的图片 (避免全量加载)
const getGpsImagesQuery = db.prepare(`
  SELECT * FROM images WHERE meta_json LIKE '%gps%'
`);

// 随机图片: SQL 随机选取
const getRandomImageQuery = db.prepare(`
  SELECT * FROM images ORDER BY RANDOM() LIMIT 1
`);
const getRandomImageByDirQuery = db.prepare(`
  SELECT * FROM images WHERE rel_path LIKE ? || '/%' ORDER BY RANDOM() LIMIT 1
`);


// 排除锁定目录的查询 (动态 SQL，锁定目录通常很少)
function _buildExcludeClause(lockedDirs) {
    if (!lockedDirs || lockedDirs.length === 0) return { sql: '', params: [] };
    const clauses = lockedDirs.map(() => 'rel_path NOT LIKE ? || \'/%\'');
    return { sql: ' AND ' + clauses.join(' AND '), params: lockedDirs };
}

// Prepared statements are cached: SQL shape only varies with locked dir count
// (and search presence for paginated/count), so we key on those dimensions.
const _excludeStmtCache = Object.create(null);

const getTopImagesExcludeQuery = (lockedDirs, limit) => {
    // SQL shape only varies with locked dir count, so cache the compiled statement.
    const key = `top:${lockedDirs.length}`;
    let stmt = _excludeStmtCache[key];
    if (!stmt) {
        const { sql } = _buildExcludeClause(lockedDirs);
        stmt = _excludeStmtCache[key] = db.prepare(`SELECT * FROM images WHERE 1=1${sql} ORDER BY views DESC LIMIT ?`);
    }
    return stmt.all(...lockedDirs, limit);
};

const getRandomExcludeQuery = (lockedDirs) => {
    const key = `random:${lockedDirs.length}`;
    let stmt = _excludeStmtCache[key];
    if (!stmt) {
        const { sql } = _buildExcludeClause(lockedDirs);
        stmt = _excludeStmtCache[key] = db.prepare(`SELECT * FROM images WHERE 1=1${sql} ORDER BY RANDOM() LIMIT 1`);
    }
    return stmt.get(...lockedDirs);
};

const getPaginatedExcludeQuery = (lockedDirs, search, page, pageSize) => {
    // Shape varies with (locked dir count, search presence); cache accordingly.
    const hasSearch = !!search;
    const key = `paginated:${lockedDirs.length}:${hasSearch ? 1 : 0}`;
    let stmt = _excludeStmtCache[key];
    if (!stmt) {
        const { sql } = _buildExcludeClause(lockedDirs);
        const searchClause = hasSearch ? " AND filename LIKE '%' || ? || '%'" : '';
        stmt = _excludeStmtCache[key] = db.prepare(`SELECT * FROM images WHERE 1=1${sql}${searchClause} ORDER BY upload_time DESC LIMIT ? OFFSET ?`);
    }
    const offset = (page - 1) * pageSize;
    const params = [...lockedDirs, ...(hasSearch ? [search] : []), pageSize, offset];
    return stmt.all(...params);
};

const countExcludeQuery = (lockedDirs, search) => {
    const hasSearch = !!search;
    const key = `count:${lockedDirs.length}:${hasSearch ? 1 : 0}`;
    let stmt = _excludeStmtCache[key];
    if (!stmt) {
        const { sql } = _buildExcludeClause(lockedDirs);
        const searchClause = hasSearch ? " AND filename LIKE '%' || ? || '%'" : '';
        stmt = _excludeStmtCache[key] = db.prepare(`SELECT COUNT(*) as count FROM images WHERE 1=1${sql}${searchClause}`);
    }
    const params = [...lockedDirs, ...(hasSearch ? [search] : [])];
    return stmt.get(...params).count;
};

// 批量操作
const insertMany = db.transaction((images) => {
    for (const img of images) insertImage.run(img);
});

// 重命名（原子替换路径）
const renameImage = db.transaction((oldRelPath, newRelPath, newFilename) => {
    const existing = getImageByPath.get(oldRelPath);
    if (!existing) return null;
    deleteImageByPath.run(oldRelPath);
    existing.rel_path = newRelPath;
    existing.filename = newFilename;
    insertImage.run(existing);
    return existing;
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
    rename: (oldRelPath, newRelPath, newFilename) => renameImage(oldRelPath, newRelPath, newFilename),
    getByPath: (relPath) => getImageByPath.get(relPath),
    getAll: () => getAllImagesQuery.all(),
    getAllSyncEntries: () => getAllSyncEntriesQuery.all(),
    getAllByViews: () => getAllImagesByViewsQuery.all(),
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
    // 分页查询
    getPaginated: (dir, page, pageSize, search = "") => {
        const offset = (page - 1) * pageSize;
        if (dir) {
            return getPaginatedQuery.all(dir + "/", search, search, pageSize, offset);
        }
        return getPaginatedRootQuery.all(search, search, pageSize, offset);
    },
    countPaginated: (dir, search = "") => {
        if (dir) {
            return countByDirFilteredQuery.get(dir + "/", search, search).count;
        }
        return countRootFilteredQuery.get(search, search).count;
    },
    // 分享页分页
    getPaginatedByDir: (dir, page, pageSize) => {
        const offset = (page - 1) * pageSize;
        return getPaginatedByDirQuery.all(dir + "/", pageSize, offset);
    },
    countPaginatedByDir: (dir) => countByDirQuery.get(dir + "/").count,
    // 地图 & 随机
    getGpsImages: () => getGpsImagesQuery.all(),
    getTopExclude: (lockedDirs, limit) => getTopImagesExcludeQuery(lockedDirs, limit),
    getRandomExclude: (lockedDirs) => getRandomExcludeQuery(lockedDirs),
    getPaginatedExclude: (lockedDirs, search, page, pageSize) => getPaginatedExcludeQuery(lockedDirs, search, page, pageSize),
    countExclude: (lockedDirs, search) => countExcludeQuery(lockedDirs, search),
    getRandom: () => getRandomImageQuery.get(),
    getRandomByDir: (dir) => getRandomImageByDirQuery.get(dir + "/"),
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
