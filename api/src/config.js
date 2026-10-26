import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT_ROOT = path.resolve(API_ROOT, '..');

function loadEnvFile(file) {
  const out = {};

  if (!fs.existsSync(file)) {
    return out;
  }

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (value.length >= 2) {
      const quote = value[0];
      if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
        value = value.slice(1, -1);
      }
    }

    out[key] = value;
  }

  return out;
}

const fileEnv = loadEnvFile(path.join(API_ROOT, '.env'));

export function env(key, fallback = null) {
  if (process.env[key] !== undefined && process.env[key] !== '') {
    return process.env[key];
  }

  if (fileEnv[key] !== undefined && fileEnv[key] !== '') {
    return fileEnv[key];
  }

  return fallback;
}

export function envBool(key, fallback = false) {
  const value = env(key);

  if (value === null) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

process.env.TZ = env('APP_TIMEZONE', 'Asia/Jakarta');

const sqlitePath = env('DB_SQLITE_PATH', './storage/database.sqlite');

export const config = {
  app: {
    name: 'Sistem Akses WiFi Sekolah',
    debug: envBool('APP_DEBUG', false),
    timezone: env('APP_TIMEZONE', 'Asia/Jakarta'),
    port: Number(env('PORT', '8090')),
    host: env('HOST', '127.0.0.1'),
    serveStatic: envBool('SERVE_STATIC', true),
    trustProxy: envBool('TRUST_PROXY', false),
  },
  db: {
    driver: String(env('DB_DRIVER', 'mysql')).toLowerCase(),
    host: env('DB_HOST', '127.0.0.1'),
    port: Number(env('DB_PORT', '3306')),
    database: env('DB_DATABASE', 'wifi_db'),
    username: env('DB_USERNAME', 'wifi'),
    password: env('DB_PASSWORD', ''),
    // Wajib untuk penyedia MySQL cloud (TiDB/Aiven) yang menolak koneksi
    // tanpa TLS.
    ssl: envBool('DB_SSL', false),
    sslInsecure: envBool('DB_SSL_INSECURE', false),
    sqlitePath: path.isAbsolute(sqlitePath) ? sqlitePath : path.join(API_ROOT, sqlitePath),
  },
  session: {
    name: env('SESSION_NAME', 'WIFI_SESSID'),
    lifetime: Number(env('SESSION_LIFETIME', '7200')),
  },
  security: {
    loginMaxAttempts: Number(env('LOGIN_MAX_ATTEMPTS', '5')),
    loginWindowMinutes: Number(env('LOGIN_WINDOW_MINUTES', '15')),
  },
  network: {
    // 'simulasi' = data jaringan dibuat oleh aplikasi (belum ada router).
    // 'router'   = baca dari perangkat asli (belum diimplementasikan).
    source: String(env('NETWORK_SOURCE', 'simulasi')).toLowerCase(),
  },
};
