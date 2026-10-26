FROM node:20-slim

# Alat build untuk better-sqlite3 bila binary prebuilt tidak tersedia.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    SERVE_STATIC=true \
    DB_DRIVER=sqlite \
    DB_SQLITE_PATH=./storage/database.sqlite

WORKDIR /app

COPY api/package*.json ./api/
RUN cd api && npm install --omit=dev --no-audit --no-fund

COPY . .
RUN chmod +x api/docker-entrypoint.sh && mkdir -p api/storage

WORKDIR /app/api
EXPOSE 8090

# PORT tidak di-set di sini: Render menyuntikkan PORT otomatis.
ENTRYPOINT ["./docker-entrypoint.sh"]
