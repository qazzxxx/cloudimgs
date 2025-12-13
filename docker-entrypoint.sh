#!/bin/sh
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-$PUID}"
UMASK="${UMASK:-002}"
APP_USER="${APP_USER:-appuser}"
APP_GROUP="${APP_GROUP:-appgroup}"

# timezone setup (optional)
if [ -n "$TZ" ]; then
  if [ -f "/usr/share/zoneinfo/$TZ" ]; then
    ln -sf "/usr/share/zoneinfo/$TZ" /etc/localtime || true
    echo "$TZ" > /etc/timezone || true
  else
    echo "Warning: TZ '$TZ' not found in /usr/share/zoneinfo, falling back to UTC" >&2
    ln -sf "/usr/share/zoneinfo/UTC" /etc/localtime || true
    echo "UTC" > /etc/timezone || true
  fi
fi

# ensure numeric
case "$PUID" in
  ''|*[!0-9]*) echo "Invalid PUID: $PUID" >&2; PUID=1000 ;;
esac
case "$PGID" in
  ''|*[!0-9]*) echo "Invalid PGID: $PGID" >&2; PGID="$PUID" ;;
esac

# create/update group
GROUP_EXISTS=$(grep -q "^${APP_GROUP}:" /etc/group && echo yes || echo no)
if [ "$GROUP_EXISTS" = "yes" ]; then
  CURRENT_GID=$(awk -F: -v g="$APP_GROUP" '$1==g{print $3}' /etc/group)
  if [ "$CURRENT_GID" != "$PGID" ]; then
    delgroup "$APP_GROUP" >/dev/null 2>&1 || true
    addgroup -g "$PGID" -S "$APP_GROUP" || addgroup -g "$PGID" "$APP_GROUP"
  fi
else
  addgroup -g "$PGID" -S "$APP_GROUP" || addgroup -g "$PGID" "$APP_GROUP"
fi

# create/update user
USER_EXISTS=$(id -u "$APP_USER" >/dev/null 2>&1 && echo yes || echo no)
if [ "$USER_EXISTS" = "yes" ]; then
  CURRENT_UID=$(id -u "$APP_USER")
  if [ "$CURRENT_UID" != "$PUID" ]; then
    deluser "$APP_USER" >/dev/null 2>&1 || true
    adduser -S -D -H -G "$APP_GROUP" -u "$PUID" "$APP_USER" || adduser -D -H -G "$APP_GROUP" -u "$PUID" "$APP_USER"
  fi
else
  adduser -S -D -H -G "$APP_GROUP" -u "$PUID" "$APP_USER" || adduser -D -H -G "$APP_GROUP" -u "$PUID" "$APP_USER"
fi

# ensure runtime dirs
mkdir -p /app/uploads /app/logs
chown -R "$APP_USER":"$APP_GROUP" /app/uploads /app/logs || true

# apply umask
umask "$UMASK"

# drop privileges and exec
if command -v su-exec >/dev/null 2>&1; then
  exec su-exec "$APP_USER":"$APP_GROUP" "$@"
elif command -v runuser >/dev/null 2>&1; then
  exec runuser -u "$APP_USER" -- "$@"
else
  exec su -s /bin/sh -c "$*" "$APP_USER"
fi
