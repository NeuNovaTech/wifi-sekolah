import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { clientIp, now } from '../helpers.js';
import { API_ROOT } from '../config.js';

export const Log = {
  async add(userId, aksi, detail = '', req = null) {
    const ip = req ? clientIp(req) : '';

    await db.run(
      'INSERT INTO activity_logs (user_id, aksi, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId ?? null, aksi, String(detail).slice(0, 2000), ip, now()],
    );
  },

  async recent(limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));

    return db.all(
      `SELECT l.id, l.aksi, l.detail, l.ip, l.created_at, u.nama, u.nipd
       FROM activity_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC, l.id DESC LIMIT ${safeLimit}`,
    );
  },

  async recentForUser(userId, limit = 10) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

    return db.all(
      `SELECT id, aksi, detail, created_at
       FROM activity_logs WHERE user_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ${safeLimit}`,
      [Number(userId)],
    );
  },

  file(error) {
    try {
      const dir = path.join(API_ROOT, 'storage', 'logs');

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const file = path.join(dir, `app-${new Date().toISOString().slice(0, 10)}.log`);
      const text = `[${new Date().toISOString()}] ${error?.stack ?? error?.message ?? String(error)}\n`;

      fs.appendFileSync(file, text);
    } catch {
      /* logging tidak boleh mematikan aplikasi */
    }
  },
};
