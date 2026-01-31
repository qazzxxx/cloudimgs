const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');

// 确保数据库目录存在
const dbPath = path.resolve(config.storage.path, '.cache', 'cloudimgs.db');
fs.ensureDirSync(path.dirname(dbPath));

const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

// Load sqlite-vec extension if Magic Search is enabled
if (config.magicSearch.enabled) {
  try {
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
    console.log("sqlite-vec extension loaded successfully");
  } catch (err) {
    console.error("Failed to load sqlite-vec extension:", err);
  }
}

// 初始化 Schema
function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      rel_path TEXT NOT NULL UNIQUE,
      size INTEGER,
      mtime INTEGER,
      upload_time TEXT,
      width INTEGER,
      height INTEGER,
      orientation INTEGER,
      thumbhash TEXT,
      meta_json TEXT,
      views INTEGER DEFAULT 0,
      last_viewed INTEGER
    );
    
    CREATE INDEX IF NOT EXISTS idx_rel_path ON images(rel_path);
    CREATE INDEX IF NOT EXISTS idx_mtime ON images(mtime);
    CREATE INDEX IF NOT EXISTS idx_upload_time ON images(upload_time DESC);

    CREATE TABLE IF NOT EXISTS shares (
        token TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expire_seconds INTEGER,
        burn_after_reading INTEGER DEFAULT 0,
        is_revoked INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY, 
        uploads_count INTEGER DEFAULT 0,
        uploads_size INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        views_size INTEGER DEFAULT 0
    );
  `);

  if (config.magicSearch.enabled) {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_images USING vec0(
        image_id INTEGER PRIMARY KEY,
        embedding float[512]
      );
    `);
  }

  // Migration for existing tables
  try {
    const columns = db.prepare("PRAGMA table_info(images)").all();
    if (!columns.find(c => c.name === 'views')) {
      console.log("Migrating: Adding views column to images");
      db.prepare("ALTER TABLE images ADD COLUMN views INTEGER DEFAULT 0").run();
      db.prepare("ALTER TABLE images ADD COLUMN last_viewed INTEGER").run();
    }

    // Create index safely after ensuring columns exist
    db.prepare("CREATE INDEX IF NOT EXISTS idx_views ON images(views DESC)").run();

  } catch (e) {
    console.error("Migration failed:", e);
  }
}

init();

module.exports = db;
