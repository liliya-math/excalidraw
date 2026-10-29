#!/bin/bash
# Adds permanent board storage to the lili.math collaboration server.
# Run on the server after collab-setup.sh.
set -e

BOARD_ORIGIN="https://liliya-math.github.io"
RAW="https://raw.githubusercontent.com/liliya-math/excalidraw/master/lili-server"

echo "== Определяю адрес сервера"
IP=$(curl -4 -s https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN="$(echo "$IP" | tr '.' '-').sslip.io"
echo "Адрес: https://$DOMAIN"

echo "== Ставлю хранилище досок"
mkdir -p /opt/lili-storage /var/lib/lili-storage
curl -fsSL "$RAW/storage.js" -o /opt/lili-storage/storage.js
curl -fsSL "$RAW/workspace.js" -o /opt/lili-storage/workspace.js
curl -fsSL "$RAW/relay-auth.js" -o /opt/lili-storage/relay-auth.js

cat > /etc/systemd/system/lili-storage.service <<EOF
[Unit]
Description=lili.math board storage
After=network.target

[Service]
WorkingDirectory=/opt/lili-storage
Environment=PORT=3003
Environment=CORS_ORIGIN=$BOARD_ORIGIN
Environment=DATA_DIR=/var/lib/lili-storage
ExecStart=/usr/bin/node /opt/lili-storage/storage.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now lili-storage
systemctl restart lili-storage

echo "== Направляю /storage в хранилище"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    handle /storage/* {
        reverse_proxy localhost:3003
    }
    handle {
        reverse_proxy localhost:3002
    }
}
EOF
systemctl restart caddy

echo "== Ежедневная резервная копия досок (хранятся 14 дней)"
cat > /etc/cron.daily/lili-storage-backup <<'EOF'
#!/bin/sh
mkdir -p /var/backups/lili-storage
tar -czf /var/backups/lili-storage/boards-$(date +%F).tar.gz -C /var/lib lili-storage
find /var/backups/lili-storage -name 'boards-*.tar.gz' -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/lili-storage-backup

curl -fsSL "$RAW/update-workspace.sh" -o /tmp/lili-workspace-update.sh
bash /tmp/lili-workspace-update.sh

sleep 5
echo
echo "============================================"
if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/storage/scenes/check" | grep -q 404 \
   && curl -s "https://$DOMAIN" | grep -q "server is up"; then
  echo "ГОТОВО. Хранилище досок работает."
else
  echo "Что-то пошло не так. Пришли Claude последние строки:"
  systemctl status lili-storage --no-pager | tail -5
fi
echo "============================================"
