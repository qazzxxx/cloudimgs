#!/bin/sh
set -e

# 设置 umask，默认为 0022 (也就是新文件权限 644，目录 755)
# 如果设置为 002，新文件权限为 664，目录 775 (允许组写入，适合 NAS 共享)
UMASK=${UMASK:-0022}
umask "$UMASK"

# 获取 PUID 和 PGID，默认为 1000
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# 处理用户组
# 检查 GID 是否已被占用
GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
if [ -z "$GROUP_NAME" ]; then
    # GID 未被占用，创建新组 cloudimgs
    addgroup -g "$PGID" cloudimgs
    GROUP_NAME=cloudimgs
    echo "[INFO] Created new group 'cloudimgs' with GID $PGID"
fi
# 如果 GID 已被占用，静默使用已有组（这是 NAS 上的正常情况）

# 处理用户
# 检查 UID 是否已被占用
USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)
if [ -z "$USER_NAME" ]; then
    # UID 未被占用，创建新用户 cloudimgs
    adduser -D -H -u "$PUID" -G "$GROUP_NAME" cloudimgs
    USER_NAME=cloudimgs
    echo "[INFO] Created new user 'cloudimgs' with UID $PUID"
fi
# 如果 UID 已被占用，静默使用已有用户（这是 NAS 上的正常情况）

# 确保目录存在
mkdir -p "$STORAGE_PATH" logs

# 修正权限（如果使用 root 启动容器，则修正所有权）
if [ "$(id -u)" = "0" ]; then
    chown -R "$USER_NAME:$GROUP_NAME" "$STORAGE_PATH" logs /app
    
    # 使用 su-exec 降权运行应用
    # 设置 HOME=/app 避免 npm 日志权限问题（NAS 映射用户可能没有主目录）
    exec su-exec "$USER_NAME:$GROUP_NAME" env HOME=/app "$@"
else
    # 如果已经是普通用户，直接运行
    exec "$@"
fi