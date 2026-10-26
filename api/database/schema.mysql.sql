-- ============================================================
--  Skema database MySQL/MariaDB
--  Sistem Akses WiFi SMK Negeri 1 Susukan
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nipd VARCHAR(20) NOT NULL,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL,
  no_hp VARCHAR(20) NOT NULL,
  kelas VARCHAR(20) NOT NULL,
  jurusan VARCHAR(10) NOT NULL,
  role ENUM('siswa', 'admin') NOT NULL DEFAULT 'siswa',
  status ENUM('pending', 'aktif', 'ditolak', 'blokir') NOT NULL DEFAULT 'pending',
  password_hash VARCHAR(255) NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  last_login DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_nipd (nipd),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status (status),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_approved FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  nama VARCHAR(60) NOT NULL,
  tipe VARCHAR(80) NULL,
  mac VARCHAR(17) NOT NULL,
  ip VARCHAR(45) NULL,
  ssid VARCHAR(60) NULL,
  vlan SMALLINT NULL,
  status ENUM('aktif', 'nonaktif', 'diblokir') NOT NULL DEFAULT 'aktif',
  terdaftar_at DATETIME NOT NULL,
  last_seen DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_devices_mac (mac),
  KEY idx_devices_user (user_id),
  CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  data MEDIUMTEXT NOT NULL,
  last_activity DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_expires (expires_at),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode VARCHAR(12) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  kategori ENUM('koneksi', 'kecepatan', 'perangkat', 'akun', 'lain') NOT NULL DEFAULT 'lain',
  isi TEXT NOT NULL,
  status ENUM('menunggu', 'diproses', 'selesai', 'ditolak') NOT NULL DEFAULT 'menunggu',
  prioritas ENUM('rendah', 'normal', 'tinggi') NOT NULL DEFAULT 'normal',
  handled_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_kode (kode),
  KEY idx_tickets_user (user_id),
  KEY idx_tickets_status (status),
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_admin FOREIGN KEY (handled_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_replies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  isi TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_replies_ticket (ticket_id),
  CONSTRAINT fk_replies_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
  CONSTRAINT fk_replies_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  aksi VARCHAR(80) NOT NULL,
  detail TEXT NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_logs_user (user_id),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS network_stats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recorded_at DATETIME NOT NULL,
  ap_aktif SMALLINT NOT NULL DEFAULT 0,
  ap_down SMALLINT NOT NULL DEFAULT 0,
  total_perangkat INT NOT NULL DEFAULT 0,
  bandwidth_mbps DECIMAL(8, 2) NOT NULL DEFAULT 0,
  kapasitas_persen TINYINT NOT NULL DEFAULT 0,
  vlan_json JSON NULL,
  PRIMARY KEY (id),
  KEY idx_stats_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nipd VARCHAR(20) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  berhasil TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_attempt_lookup (nipd, ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(50) NOT NULL,
  setting_value TEXT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
