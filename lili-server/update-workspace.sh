#!/bin/bash
# Updates storage and relay authentication. Board data and Caddy are kept.
set -euo pipefail
SOURCE="https://raw.githubusercontent.com/liliya-math/excalidraw/master/lili-server"
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT
for FILE in storage.js workspace.js relay-auth.js; do
  curl --fail --silent --show-error "$SOURCE/$FILE" -o "$STAGING/$FILE"
  node --check "$STAGING/$FILE"
done
mkdir -p /var/backups/lili-storage
BACKUP="/var/backups/lili-storage/before-workspace-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$BACKUP" -C /opt lili-storage
cp "$STAGING/storage.js" "$STAGING/workspace.js" "$STAGING/relay-auth.js" /opt/lili-storage/
DROPIN="/etc/systemd/system/excalidraw-room.service.d/lili-workspace.conf"
mkdir -p "$(dirname "$DROPIN")"
if [ -f "$DROPIN" ]; then cp "$DROPIN" "$STAGING/previous-relay.conf"; fi
cat > "$DROPIN" <<'CONFIG'
[Service]
Environment=LILI_RELAY_AUTH=1
Environment=LILI_DATA_DIR=/var/lib/lili-storage
Environment=NODE_OPTIONS=--require=/opt/lili-storage/relay-auth.js
CONFIG
systemctl daemon-reload
if ! systemctl restart excalidraw-room lili-storage || ! systemctl is-active --quiet excalidraw-room lili-storage || ! curl --fail --silent --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:3003/storage/capabilities; then
  tar -xzf "$BACKUP" -C /opt
  if [ -f "$STAGING/previous-relay.conf" ]; then cp "$STAGING/previous-relay.conf" "$DROPIN"; else rm -f "$DROPIN"; fi
  systemctl daemon-reload
  systemctl restart excalidraw-room lili-storage
  echo 'Обновление отменено. Предыдущая версия восстановлена.' >&2
  exit 1
fi
printf '\nПрава учителя и защищённые задания включены. Обнови страницу доски.\n'
