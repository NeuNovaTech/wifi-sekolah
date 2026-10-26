import { randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { now } from '../helpers.js';

export const KATEGORI = ['koneksi', 'kecepatan', 'perangkat', 'akun', 'lain'];
export const STATUS = ['menunggu', 'diproses', 'selesai', 'ditolak'];

export const Ticket = {
  KATEGORI,
  STATUS,

  async create({ userId, kategori, isi }) {
    const timestamp = now();
    const temporary = 'TMP-' + randomBytes(4).toString('hex');

    const result = await db.run(
      `INSERT INTO tickets
        (kode, user_id, kategori, isi, status, prioritas, handled_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'menunggu', 'normal', NULL, ?, ?)`,
      [temporary, Number(userId), kategori, isi, timestamp, timestamp],
    );

    const id = result.lastInsertId;
    const kode = 'T-' + String(id).padStart(4, '0');

    await db.run('UPDATE tickets SET kode = ? WHERE id = ?', [kode, id]);

    return { id, kode };
  },

  async listForUser(userId, limit = 50) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));

    return db.all(
      `SELECT t.*,
              (SELECT COUNT(*) FROM ticket_replies r WHERE r.ticket_id = t.id) AS jumlah_balasan,
              (SELECT r.isi FROM ticket_replies r WHERE r.ticket_id = t.id
               ORDER BY r.id DESC LIMIT 1) AS balasan_terakhir
       FROM tickets t WHERE t.user_id = ?
       ORDER BY t.created_at DESC, t.id DESC LIMIT ${safeLimit}`,
      [Number(userId)],
    );
  },

  async listAll({ status = null, q = null, limit = 200 } = {}) {
    let sql = `SELECT t.*, u.nama, u.nipd, u.kelas
               FROM tickets t
               JOIN users u ON u.id = t.user_id
               WHERE 1 = 1`;
    const params = [];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (q) {
      sql += ' AND (t.kode LIKE ? OR t.isi LIKE ? OR u.nama LIKE ? OR u.nipd LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    sql += ` ORDER BY t.created_at DESC, t.id DESC LIMIT ${safeLimit}`;

    return db.all(sql, params);
  },

  async find(id) {
    return db.get(
      `SELECT t.*, u.nama, u.nipd, u.kelas
       FROM tickets t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`,
      [Number(id)],
    );
  },

  async findForUser(id, userId) {
    return db.get(
      `SELECT t.*, u.nama, u.nipd, u.kelas
       FROM tickets t JOIN users u ON u.id = t.user_id
       WHERE t.id = ? AND t.user_id = ?`,
      [Number(id), Number(userId)],
    );
  },

  async replies(ticketId) {
    return db.all(
      `SELECT r.id, r.ticket_id, r.user_id, r.isi, r.created_at,
              u.nama, u.role
       FROM ticket_replies r
       JOIN users u ON u.id = r.user_id
       WHERE r.ticket_id = ?
       ORDER BY r.created_at ASC, r.id ASC`,
      [Number(ticketId)],
    );
  },

  async addReply(ticketId, userId, isi) {
    const timestamp = now();
    const result = await db.run(
      'INSERT INTO ticket_replies (ticket_id, user_id, isi, created_at) VALUES (?, ?, ?, ?)',
      [Number(ticketId), Number(userId), String(isi), timestamp],
    );

    await db.run('UPDATE tickets SET updated_at = ? WHERE id = ?', [timestamp, Number(ticketId)]);

    return { id: result.lastInsertId, created_at: timestamp };
  },

  async updateStatus(id, status, adminId) {
    await db.run(
      'UPDATE tickets SET status = ?, handled_by = ?, updated_at = ? WHERE id = ?',
      [status, Number(adminId), now(), Number(id)],
    );
  },

  async counts() {
    const rows = await db.all('SELECT status, COUNT(*) AS c FROM tickets GROUP BY status');
    const out = { total: 0, menunggu: 0, diproses: 0, selesai: 0, ditolak: 0 };

    for (const row of rows) {
      out[row.status] = Number(row.c);
      out.total += Number(row.c);
    }

    return out;
  },

  async openForUser(userId) {
    const row = await db.get(
      "SELECT COUNT(*) AS c FROM tickets WHERE user_id = ? AND status IN ('menunggu', 'diproses')",
      [Number(userId)],
    );

    return Number(row?.c ?? 0);
  },

  async countForUser(userId) {
    const row = await db.get(
      'SELECT COUNT(*) AS c FROM tickets WHERE user_id = ?',
      [Number(userId)],
    );

    return Number(row?.c ?? 0);
  },

  async recent(limit = 5) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 5));

    return db.all(
      `SELECT t.id, t.kode, t.kategori, t.isi, t.status, t.created_at, u.nama, u.nipd
       FROM tickets t JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC, t.id DESC LIMIT ${safeLimit}`,
    );
  },
};
