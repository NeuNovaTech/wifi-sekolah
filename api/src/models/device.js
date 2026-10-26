import { db } from '../db.js';
import { now, nowPlus } from '../helpers.js';

export const Device = {
  async listForUser(userId) {
    return db.all(
      'SELECT * FROM devices WHERE user_id = ? ORDER BY terdaftar_at DESC, id DESC',
      [Number(userId)],
    );
  },

  async countForUser(userId) {
    const row = await db.get('SELECT COUNT(*) AS c FROM devices WHERE user_id = ?', [Number(userId)]);

    return Number(row?.c ?? 0);
  },

  async findByMac(mac) {
    return db.get('SELECT * FROM devices WHERE mac = ?', [String(mac)]);
  },

  async create({ userId, nama, tipe = null, mac, ip = null, ssid = null, vlan = null }) {
    const timestamp = now();

    const result = await db.run(
      `INSERT INTO devices
        (user_id, nama, tipe, mac, ip, ssid, vlan, status, terdaftar_at, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`,
      [Number(userId), nama, tipe, mac, ip, ssid, vlan, timestamp, timestamp],
    );

    return result.lastInsertId;
  },

  async remove(id, userId) {
    const result = await db.run('DELETE FROM devices WHERE id = ? AND user_id = ?', [
      Number(id),
      Number(userId),
    ]);

    return Number(result.changes || 0);
  },

  async listAllWithUser(limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));

    return db.all(
      `SELECT d.id, d.user_id, d.nama AS nama_perangkat, d.tipe, d.mac, d.ip, d.ssid,
              d.vlan, d.status, d.terdaftar_at, d.last_seen,
              u.nama AS nama_siswa, u.nipd, u.kelas
       FROM devices d
       JOIN users u ON u.id = d.user_id
       ORDER BY d.last_seen DESC, d.id DESC
       LIMIT ${safeLimit}`,
    );
  },

  async onlineUsers() {
    const row = await db.get(
      "SELECT COUNT(DISTINCT user_id) AS c FROM devices WHERE status = 'aktif' AND last_seen >= ?",
      [nowPlus(-300)],
    );

    return Number(row?.c ?? 0);
  },

  async total() {
    const row = await db.get('SELECT COUNT(*) AS c FROM devices');

    return Number(row?.c ?? 0);
  },

  async byVlan() {
    return db.all(
      'SELECT vlan, COUNT(*) AS jumlah FROM devices GROUP BY vlan ORDER BY vlan',
    );
  },

  /** Jumlah perangkat terdaftar per hari selama N hari terakhir. */
  async series(days = 7) {
    const safeDays = Math.max(1, Math.min(30, Number(days) || 7));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));

    const pad = (n) => String(n).padStart(2, '0');
    const since = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} 00:00:00`;

    const rows = await db.all(
      `SELECT substr(terdaftar_at, 1, 10) AS tanggal, COUNT(*) AS jumlah
       FROM devices WHERE terdaftar_at >= ?
       GROUP BY tanggal`,
      [since],
    );

    const map = {};
    for (const row of rows) {
      map[row.tanggal] = Number(row.jumlah);
    }

    const out = [];
    for (let i = 0; i < safeDays; i += 1) {
      const d = new Date(start.getTime());
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      out.push({ tanggal: key, jumlah: map[key] ?? 0 });
    }

    return out;
  },
};
