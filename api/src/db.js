import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let impl;

if (config.db.driver === 'sqlite') {
  const { default: Database } = await import('better-sqlite3');

  const dir = path.dirname(config.db.sqlitePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(config.db.sqlitePath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');

  impl = {
    driver: 'sqlite',
    async all(sql, params = []) {
      return sqlite.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async run(sql, params = []) {
      const info = sqlite.prepare(sql).run(...params);

      return {
        changes: info.changes,
        lastInsertId: Number(info.lastInsertRowid),
      };
    },
    async close() {
      sqlite.close();
    },
  };
} else {
  const mysql = await import('mysql2/promise');

  const poolOptions = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    dateStrings: true,
  };

  if (config.db.ssl) {
    poolOptions.ssl = {
      minVersion: 'TLSv1.2',
      // DB_SSL_INSECURE=true hanya kalau sertifikat server tidak dikenali
      // Node (mis. CA privat). Koneksi tetap terenkripsi.
      rejectUnauthorized: !config.db.sslInsecure,
    };
  }

  const pool = mysql.createPool(poolOptions);

  impl = {
    driver: 'mysql',
    async all(sql, params = []) {
      const [rows] = await pool.execute(sql, params);
      return rows;
    },
    async get(sql, params = []) {
      const rows = await impl.all(sql, params);
      return rows[0] ?? null;
    },
    async run(sql, params = []) {
      const [result] = await pool.execute(sql, params);

      return {
        changes: result.affectedRows ?? 0,
        lastInsertId: Number(result.insertId ?? 0),
      };
    },
    async close() {
      await pool.end();
    },
  };
}

export const db = impl;
export const driver = impl.driver;
