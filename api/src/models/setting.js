import { db, driver } from '../db.js';
import { now } from '../helpers.js';

export const Setting = {
  async all() {
    const rows = await db.all('SELECT setting_key, setting_value FROM settings');
    const out = {};

    for (const row of rows) {
      out[row.setting_key] = row.setting_value;
    }

    return out;
  },

  async get(key, fallback = null) {
    const row = await db.get('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);

    return row ? row.setting_value : fallback;
  },

  async set(key, value) {
    if (driver === 'mysql') {
      await db.run(
        `INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)`,
        [key, String(value), now()],
      );
    } else {
      await db.run(
        `INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value,
           updated_at = excluded.updated_at`,
        [key, String(value), now()],
      );
    }
  },
};
