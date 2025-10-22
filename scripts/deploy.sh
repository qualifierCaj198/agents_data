#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/var/www/policy-pulse

mkdir -p "$APP_DIR"
cd "$APP_DIR"
npm ci
pm2 startOrReload ecosystem.config.cjs || pm2 start server.js --name policy-pulse
pm2 save
