#!/bin/sh
set -e

# 设置 umask
UMASK=${UMASK:-0022}
umask "$UMASK"

# 获取 PUID 和 PGID，默认为 1000
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# 处理用户组
GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
if [ -z "$GROUP_NAME" ]; then
    # GID 未被占用，创建新组 cloudimgs
    groupadd -g "$PGID" cloudimgs
    GROUP_NAME=cloudimgs
    echo "[INFO] Created new group 'cloudimgs' with GID $PGID"
fi

# 处理用户
USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)
if [ -z "$USER_NAME" ]; then
    # UID 未被占用，创建新用户 cloudimgs
    # -M 不创建主目录 (Debian)
    useradd -u "$PUID" -g "$GROUP_NAME" -M -d /app cloudimgs
    USER_NAME=cloudimgs
    echo "[INFO] Created new user 'cloudimgs' with UID $PUID"
fi

# 确保目录存在
mkdir -p "$STORAGE_PATH" logs

# 修正权限（如果使用 root 启动容器，则修正所有权）
if [ "$(id -u)" = "0" ]; then
    chown -R "$USER_NAME:$GROUP_NAME" "$STORAGE_PATH" logs /app
    
    # 使用 gosu 降权运行应用
    # 设置 HOME=/app
    exec gosu "$USER_NAME:$GROUP_NAME" env HOME=/app "$@"
else
    # 如果已经是普通用户，直接运行
    exec "$@"
fi