#!/bin/bash
# Ставит сервер совместной работы для доски Excalidraw на чистый Ubuntu 22.04/24.04
set -e

BOARD_ORIGIN="https://liliya-math.github.io"

echo "== Определяю IP сервера"
IP=$(curl -4 -s https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN="$(echo "$IP" | tr '.' '-').sslip.io"
echo "IP: $IP  ->  адрес сервера: https://$DOMAIN"

echo "== Ставлю Node.js, git и Caddy"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nodejs npm git caddy

echo "== Скачиваю и собираю excalidraw-room"
rm -rf /opt/excalidraw-room
git clone --depth 1 https://github.com/excalidraw/excalidraw-room.git /opt/excalidraw-room
cd /opt/excalidraw-room
npm install --no-audit --no-fund
npx tsc

echo "== Запускаю как службу"
cat > /etc/systemd/system/excalidraw-room.service <<EOF
[Unit]
Description=Excalidraw collaboration server
After=network.target

[Service]
WorkingDirectory=/opt/excalidraw-room
Environment=PORT=3002
Environment=CORS_ORIGIN=$BOARD_ORIGIN
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now excalidraw-room

echo "== Настраиваю HTTPS"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    reverse_proxy localhost:3002
}
EOF
systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow 80,443/tcp
fi

sleep 15
echo
echo "============================================"
if curl -s "https://$DOMAIN" | grep -q "server is up"; then
  echo "ГОТОВО. Пришли Claude этот адрес:"
else
  echo "Сервер поставлен, но HTTPS ещё не ответил. Пришли Claude этот адрес и последние строки вывода:"
fi
echo "https://$DOMAIN"
echo "============================================"
