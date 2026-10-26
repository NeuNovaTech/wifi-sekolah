-- ============================================================
--  Skema database SQLite (untuk uji lokal)
--  Sistem Akses WiFi SMK Negeri 1 Susukan
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nipd TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  no_hp TEXT NOT NULL,
  kelas TEXT NOT NULL,
  jurusan TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'siswa' CHECK (role IN ('siswa', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'aktif', 'ditolak', 'blokir')),
  password_hash TEXT NOT NULL,
  approved_by INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
  approved_at TEXT NULL,
  last_login TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  tipe TEXT NULL,
  mac TEXT NOT NULL UNIQUE,
  ip TEXT NULL,
  ssid TEXT NULL,
  vlan INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif', 'diblokir')),
  terdaftar_at TEXT NOT NULL,
  last_seen TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices (user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NULL REFERENCES users (id) ON DELETE CASCADE,
  ip TEXT NULL,
  user_agent TEXT NULL,
  data TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kategori TEXT NOT NULL DEFAULT 'lain' CHECK (kategori IN ('koneksi', 'kecepatan', 'perangkat', 'akun', 'lain')),
  isi TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'diproses', 'selesai', 'ditolak')),
  prioritas TEXT NOT NULL DEFAULT 'normal' CHECK (prioritas IN ('rendah', 'normal', 'tinggi')),
  handled_by INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  isi TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replies_ticket ON ticket_replies (ticket_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
  aksi TEXT NOT NULL,
  detail TEXT NULL,
  ip TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs (created_at);

CREATE TABLE IF NOT EXISTS network_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,
  ap_aktif INTEGER NOT NULL DEFAULT 0,
  ap_down INTEGER NOT NULL DEFAULT 0,
  total_perangkat INTEGER NOT NULL DEFAULT 0,
  bandwidth_mbps REAL NOT NULL DEFAULT 0,
  kapasitas_persen INTEGER NOT NULL DEFAULT 0,
  vlan_json TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_stats_recorded ON network_stats (recorded_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nipd TEXT NOT NULL,
  ip TEXT NOT NULL,
  berhasil INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempt_lookup ON login_attempts (nipd, ip, created_at);

CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TEXT NOT NULL
);
