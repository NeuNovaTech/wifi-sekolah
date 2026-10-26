#!/bin/sh
# Entry point Docker: siapkan skema, isi data contoh bila database kosong,
# lalu jalankan API. Seed otomatis tidak menghapus data yang sudah ada.
set -e

cd "$(dirname "$0")"

node database/install.js
node database/seed.js || true

exec node server.js
