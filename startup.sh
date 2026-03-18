#!/bin/sh
set -eu

if [ -f node_modules.tar.gz ]; then
  echo "Extracting packaged node_modules..."
  rm -rf /node_modules
  mkdir -p /node_modules
  tar -xzf node_modules.tar.gz -C /node_modules
  rm -rf node_modules
  ln -sfn /node_modules ./node_modules
  export NODE_PATH="/node_modules:/usr/local/lib/node_modules:${NODE_PATH:-}"
  export PATH="/node_modules/.bin:$PATH"
elif [ ! -f .api-runtime-ready ]; then
  echo "Installing API runtime dependencies..."
  npm install --no-save --omit=dev --no-audit --no-fund \
    express@5.2.1 \
    cors@2.8.6 \
    dotenv@17.3.1 \
    jose@6.2.1 \
    mssql@12.2.0 \
    zod@4.3.6
  touch .api-runtime-ready
fi

exec node server/dist/index.js
