import { db } from '../db.js';
import { now } from '../helpers.js';

export const LoginAttempt = {
  async failures(nipd, ip, since) {
    const row = await db.get(
      `SELECT COUNT(*) AS c FROM login_attempts
       WHERE nipd = ? AND ip = ? AND berhasil = 0 AND created_at >= ?`,
      [String(nipd), String(ip), since],
    );

    return Number(row?.c ?? 0);
  },

  async record(nipd, ip, success) {
    await db.run(
      'INSERT INTO login_attempts (nipd, ip, berhasil, created_at) VALUES (?, ?, ?, ?)',
      [String(nipd), String(ip), success ? 1 : 0, now()],
    );
  },

  async cleanup(days = 7) {
    const cutoff = new Date(Date.now() - Number(days) * 86400 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const since = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())} `
      + `${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}:${pad(cutoff.getSeconds())}`;

    await db.run('DELETE FROM login_attempts WHERE created_at < ?', [since]);
  },
};
