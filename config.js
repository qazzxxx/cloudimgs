// CloudImgs 配置文件
module.exports = {
  // 上传配置
  upload: {
    // 允许的文件格式（扩展名）
    allowedExtensions: process.env.ALLOWED_EXTENSIONS
      ? process.env.ALLOWED_EXTENSIONS.split(",")
      : [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"],

    // 允许的MIME类型
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/svg+xml",
    ],

    // 文件大小限制（字节）
    maxFileSize: process.env.MAX_FILE_SIZE
      ? parseInt(process.env.MAX_FILE_SIZE)
      : 10 * 1024 * 1024, // 10MB

    // 是否允许重复文件名
    allowDuplicateNames: process.env.ALLOW_DUPLICATE_NAMES === "true",

    // 文件名冲突时的处理策略: 'timestamp' | 'counter' | 'overwrite'
    duplicateStrategy: process.env.DUPLICATE_STRATEGY || "timestamp",
  },

  // 存储配置
  storage: {
    // 存储路径
    path: process.env.STORAGE_PATH || "./uploads",

    // 是否自动创建目录
    autoCreateDirs: process.env.AUTO_CREATE_DIRS !== "false",

    // 文件名处理
    filename: {
      // 是否保留原始文件名
      keepOriginalName: process.env.KEEP_ORIGINAL_NAME !== "false",

      // 是否处理特殊字符
      sanitizeSpecialChars: process.env.SANITIZE_SPECIAL_CHARS !== "false",

      // 特殊字符替换符
      specialCharReplacement: process.env.SPECIAL_CHAR_REPLACEMENT || "_",
    },
  },

  // 服务器配置
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || "0.0.0.0",
  },

  // 安全配置
  security: {
    // 是否启用路径安全检查
    enablePathValidation: process.env.ENABLE_PATH_VALIDATION !== "false",

    // 禁止的路径字符
    forbiddenPathChars: process.env.FORBIDDEN_PATH_CHARS
      ? process.env.FORBIDDEN_PATH_CHARS.split(",")
      : ["..", "\\"],

    // 最大目录深度
    maxDirectoryDepth: process.env.MAX_DIRECTORY_DEPTH
      ? parseInt(process.env.MAX_DIRECTORY_DEPTH)
      : 10,
  },
};
