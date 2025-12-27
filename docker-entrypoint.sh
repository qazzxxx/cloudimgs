#!/bin/sh
set -e

# 设置 umask，默认为 0022 (也就是新文件权限 644，目录 755)
# 如果设置为 002，新文件权限为 664，目录 775 (允许组写入，适合 NAS 共享)
UMASK=${UMASK:-0022}
umask "$UMASK"

# 获取 PUID 和 PGID，默认为 1000
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# 创建用户组（如果不存在）
if ! getent group cloudimgs > /dev/null 2>&1; then
    addgroup -g "$PGID" cloudimgs
fi

# 创建用户（如果不存在）
if ! id -u cloudimgs > /dev/null 2>&1; then
    adduser -D -H -u "$PUID" -G cloudimgs cloudimgs
fi

# 确保目录存在
mkdir -p "$STORAGE_PATH" logs

# 修正权限（如果使用 root 启动容器，则修正所有权）
if [ "$(id -u)" = "0" ]; then
    chown -R cloudimgs:cloudimgs "$STORAGE_PATH" logs /app
    # 使用 su-exec 降权运行应用
    exec su-exec cloudimgs:cloudimgs "$@"
else
    # 如果已经是普通用户，直接运行
    exec "$@"
fi