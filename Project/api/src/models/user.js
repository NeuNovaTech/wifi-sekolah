import { db } from '../db.js';
import { now } from '../helpers.js';
import { hashPassword } from '../passwords.js';

export const KELAS = [
  'X TO 1', 'X TO 2', 'X TJKT 1', 'X TJKT 2', 'X DITF', 'X KKBT',
  'XI TO 1', 'XI TO 2', 'XI TJKT 1', 'XI TJKT 2', 'XI DITF', 'XI KKBT',
];

export function jurusanFromKelas(kelas) {
  const match = String(kelas ?? '').toUpperCase().match(/^(?:X|XI)\s+(TO|TJKT|DITF|KKBT)/);

  return match ? match[1] : 'LAIN';
}

export const User = {
  KELAS,
  jurusanFromKelas,

  async count() {
    const row = await db.get('SELECT COUNT(*) AS c FROM users');

    return Number(row?.c ?? 0);
  },

  async find(id) {
    return db.get('SELECT * FROM users WHERE id = ?', [Number(id)]);
  },

  async findByNipd(nipd) {
    return db.get('SELECT * FROM users WHERE nipd = ?', [String(nipd)]);
  },

  async findByEmail(email) {
    return db.get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase()]);
  },

  async create(data) {
    const passwordHash = await hashPassword(data.password);
    const timestamp = now();

    const result = await db.run(
      `INSERT INTO users
        (nipd, nama, email, no_hp, kelas, jurusan, role, status, password_hash,
         approved_by, approved_at, last_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nipd,
        data.nama,
        String(data.email).toLowerCase(),
        data.no_hp,
        data.kelas,
        data.jurusan ?? jurusanFromKelas(data.kelas),
        data.role ?? 'siswa',
        data.status ?? 'pending',
        passwordHash,
        data.approved_by ?? null,
        data.approved_at ?? null,
        null,
        timestamp,
        timestamp,
      ],
    );

    return result.lastInsertId;
  },

  async updateProfile(id, fields) {
    const sets = [];
    const params = [];

    if (fields.no_hp !== undefined) {
      sets.push('no_hp = ?');
      params.push(fields.no_hp);
    }

    if (fields.email !== undefined) {
      sets.push('email = ?');
      params.push(String(fields.email).toLowerCase());
    }

    if (sets.length === 0) {
      return;
    }

    sets.push('updated_at = ?');
    params.push(now(), Number(id));

    await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  /** Perubahan data siswa oleh admin (bukan sandi/status). */
  async updateByAdmin(id, fields) {
    const sets = [];
    const params = [];

    if (fields.nama !== undefined) {
      sets.push('nama = ?');
      params.push(String(fields.nama));
    }

    if (fields.email !== undefined) {
      sets.push('email = ?');
      params.push(String(fields.email).toLowerCase());
    }

    if (fields.no_hp !== undefined) {
      sets.push('no_hp = ?');
      params.push(String(fields.no_hp));
    }

    if (fields.kelas !== undefined) {
      sets.push('kelas = ?', 'jurusan = ?');
      params.push(String(fields.kelas), jurusanFromKelas(fields.kelas));
    }

    if (sets.length === 0) {
      return;
    }

    sets.push('updated_at = ?');
    params.push(now(), Number(id));

    await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  async updatePassword(id, password) {
    const passwordHash = await hashPassword(password);

    await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      passwordHash,
      now(),
      Number(id),
    ]);
  },

  async setStatus(id, status, adminId) {
    const timestamp = now();

    await db.run(
      'UPDATE users SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
      [status, Number(adminId), timestamp, timestamp, Number(id)],
    );
  },

  async touchLogin(id) {
    await db.run('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?', [
      now(),
      now(),
      Number(id),
    ]);
  },

  async list({ status = null, q = null, limit = 200 } = {}) {
    let sql = `SELECT u.id, u.nipd, u.nama, u.email, u.no_hp, u.kelas, u.jurusan,
                      u.role, u.status, u.approved_at, u.last_login, u.created_at,
                      (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id) AS jumlah_perangkat
               FROM users u
               WHERE u.role = ?`;
    const params = ['siswa'];

    if (status) {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    if (q) {
      sql += ' AND (u.nama LIKE ? OR u.nipd LIKE ? OR u.kelas LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    sql += ` ORDER BY CASE WHEN u.status = 'pending' THEN 0 ELSE 1 END,
                      u.created_at DESC, u.id DESC LIMIT ${safeLimit}`;

    return db.all(sql, params);
  },

  async counts() {
    const rows = await db.all(
      "SELECT status, COUNT(*) AS c FROM users WHERE role = 'siswa' GROUP BY status",
    );

    const out = { total: 0, pending: 0, aktif: 0, ditolak: 0, blokir: 0 };

    for (const row of rows) {
      out[row.status] = Number(row.c);
      out.total += Number(row.c);
    }

    return out;
  },

  async recent(limit = 6) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 6));

    return db.all(
      `SELECT id, nipd, nama, kelas, status, created_at
       FROM users WHERE role = 'siswa'
       ORDER BY created_at DESC, id DESC LIMIT ${safeLimit}`,
    );
  },

  async pending(limit = 6) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 6));

    return db.all(
      `SELECT id, nipd, nama, kelas, status, created_at
       FROM users WHERE role = 'siswa' AND status = 'pending'
       ORDER BY created_at ASC, id ASC LIMIT ${safeLimit}`,
    );
  },

  async byJurusan() {
    return db.all(
      `SELECT jurusan, COUNT(*) AS jumlah
       FROM users WHERE role = 'siswa' AND status = 'aktif'
       GROUP BY jurusan ORDER BY jumlah DESC`,
    );
  },

  /** Jumlah pendaftar siswa per hari selama N hari terakhir (termasuk hari ini). */
  async series(days = 7) {
    const safeDays = Math.max(1, Math.min(30, Number(days) || 7));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));

    const pad = (n) => String(n).padStart(2, '0');
    const since = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} 00:00:00`;

    const rows = await db.all(
      `SELECT substr(created_at, 1, 10) AS tanggal, COUNT(*) AS jumlah
       FROM users WHERE role = 'siswa' AND created_at >= ?
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

  publicView(user) {
    if (!user) {
      return null;
    }

    return {
      id: Number(user.id),
      nipd: user.nipd,
      nama: user.nama,
      name: user.nama,
      email: user.email,
      no_hp: user.no_hp,
      kelas: user.kelas,
      jurusan: user.jurusan,
      role: user.role,
      status: user.status,
      last_login: user.last_login,
      created_at: user.created_at,
    };
  },
};
