# Catatan Rencana — Sistem Akses WiFi SMK Negeri 1 Susukan

> Dibuat: 26 Oktober 2026
> Revisi: backend dipindah dari PHP ke **Node.js** dan sudah selesai dibuat.
> Status: **backend selesai & teruji**, frontend sudah terhubung ke API,
> server Oracle belum dibuat. Data jaringan (AP/VLAN/online) masih simulasi
> karena belum ada akses router.

---

## 0. Ringkasan status

| Bagian | Status |
|---|---|
| Frontend (`user/`, `admin/`, `assets/`) | **Selesai** — semua halaman memanggil API; data jaringan masih simulasi |
| Backend (`api/`) | **Selesai**, uji lolos di SQLite dan MariaDB |
| Database | Skema MySQL + SQLite siap, seed data contoh siap |
| Server Oracle | Belum dibuat |
| Domain | Belum didaftarkan |
| Integrasi frontend → API | **Selesai** (lihat `STATUS-WEB.md`) |

---

## 1. Keputusan final

| Hal | Keputusan |
|---|---|
| Server | **Oracle Cloud Always Free** |
| OS | Ubuntu Server 24.04 LTS (aarch64) |
| Shape | `VM.Standard.A1.Flex` — 2 OCPU / 12 GB RAM |
| Region | **ap-singapore-1** |
| Web server | Nginx 1.24 |
| Backend | **Node.js 20+ (LTS) + Express 4** |
| Database | **MariaDB 10.11 / MySQL 8** (produksi), SQLite (uji lokal) |
| SSL | Let's Encrypt (certbot) |
| DNS | Cloudflare free |
| Domain sementara | `*.sslip.io` (instan) |
| Domain utama | `*.eu.org` (gratis, 1–30 hari) |
| Biaya | **Rp 0** (opsional `.my.id` ± Rp 20 rb/tahun) |

Catatan: Oracle memangkas ARM Always Free per 15 Juni 2026 dari 4 OCPU/24 GB → **2 OCPU/12 GB**.

---

## 2. Backend yang sudah jadi

### 2.1 Lokasi & struktur

```
api/
├── server.js                 # entry point (npm start)
├── package.json
├── .env                      # konfigurasi lokal (SQLite)
├── .env.example              # contoh produksi (MySQL)
├── README.md                 # panduan lengkap
├── src/
│   ├── app.js                # express, mount route, error handler
│   ├── config.js             # pembaca .env
│   ├── db.js                 # MySQL / SQLite
│   ├── session.js            # sesi di tabel sessions
│   ├── csrf.js
│   ├── auth.js
│   ├── passwords.js          # scrypt
│   ├── validation.js
│   ├── response.js
│   ├── helpers.js
│   ├── routes/               # auth, siswa, perangkat, keluhan, admin
│   └── models/               # user, device, ticket, log, setting, dll
├── database/
│   ├── schema.mysql.sql
│   ├── schema.sqlite.sql
│   ├── install.js
│   └── seed.js
└── storage/                  # database.sqlite + logs
```

Konfigurasi deploy:

```
deploy/nginx-wifi.conf        # contoh server block Nginx
deploy/wifi-api.service       # unit systemd
```

### 2.2 Fitur yang sudah berfungsi

- **Auth**: CSRF, register (pending), login (siswa & admin), logout, `me`.
- **Siswa**: profil, ganti No HP, ganti sandi, daftar/tambah perangkat (maks 3), kirim & lihat keluhan.
- **Admin**: dashboard, daftar siswa + filter status/pencarian, approve/reject/block, monitoring jaringan, semua keluhan, ubah status tiket, log aktivitas.
- **Keamanan**: scrypt, sesi DB (ID di-hash), CSRF, rate limit login, role check server-side, prepared statement.
- **Seed**: admin + 6 siswa + 4 perangkat + 3 tiket + statistik jaringan.

### 2.3 Akun contoh

| Peran | NIPD | Sandi |
|---|---|---|
| Admin | `admin` | `admin123` |
| Siswa (aktif) | `1234` | `siswa123` |
| Siswa (pending) | `1235` | `siswa123` |
| Siswa lain | `1236`–`1239` | `siswa123` |

> Ganti sandi ini sebelum dipakai sungguhan.

### 2.4 Cara menjalankan (lokal, SQLite)

```bash
cd api
npm install
npm run db:install
npm run db:seed
npm start
```

- API: `http://localhost:8090/api`
- Frontend: `http://localhost:8090/user/`
- Admin: `http://localhost:8090/admin/`

### 2.5 Hasil uji yang sudah lolos

- Login admin & siswa, sesi bertahan, logout menghapus sesi.
- Approve siswa pending → bisa login.
- Siswa mengirim keluhan → muncul di daftar & dashboard admin.
- Ganti No HP, tambah perangkat, batas 3 perangkat ditolak (422).
- Registrasi baru (201) dan duplikat NIPD/email ditolak (422).
- Mutasi tanpa CSRF → 419; siswa akses endpoint admin → 403; tanpa login → 401.
- Rate limit login: percobaan ke-6 → 429.
- JSON rusak → 400; endpoint tidak ada → 404.
- Jalur **MySQL/MariaDB** diuji dengan database terpisah: skema, seed, login, dashboard, keluhan — semua jalan.
- Halaman statis (`/user/`, `/admin/`) tersaji dari Node saat mode uji lokal.

---

## 3. Spesifikasi VM Oracle

```
Tenancy        : Free Tier (Always Free)
Region         : ap-singapore-1
Availability   : AD-1 (kalau out of capacity → coba AD-2 / AD-3)
Image          : Canonical Ubuntu 24.04 (aarch64)
Shape          : VM.Standard.A1.Flex
  OCPU         : 2
  RAM          : 12 GB
Boot volume    : 100 GB (maks total 200 GB)
Jaringan       : VCN + public subnet + Reserved Public IP
Security List  : ingress 22 (IP sendiri), 80, 443
SSH            : key-only, password login dimatikan
Swap           : 2 GB
```

**Risiko:** instance Always Free bisa dianggap idle lalu dihentikan Oracle. Solusi: upgrade ke Pay As You Go tetapi tetap di dalam batas free (tagihan tetap 0).

---

## 4. Domain & DNS

| Pilihan | Contoh | Gratis | Aktif |
|---|---|---|---|
| sslip.io | `wifi.152-70-1-2.sslip.io` | ya | instan |
| **eu.org** | `wifi-smkn1susukan.eu.org` | ya | 1–30 hari |
| is-a.dev | `wifismk.is-a.dev` | ya | menit–hari |
| GitHub Student Pack | `namamu.me` | ya (1 tahun) | beberapa hari |
| `.my.id` | `wifismk.my.id` | ± Rp 20 rb/th | instan |

**Rencana:** `sslip.io` untuk uji coba → `eu.org` untuk permanen.

DNS Cloudflare setelah eu.org disetujui:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | IP Oracle | Proxied |
| A | `www` | IP Oracle | Proxied |
| CAA | `@` | `letsencrypt.org` | — |

> Saat menerbitkan sertifikat pertama, set **DNS only**; proxy dinyalakan setelah SSL jadi.

Kekurangan sslip.io: hanya DNS wildcard, tanpa SLA, terikat IP, tidak bisa atur record lain.

---

## 5. Arsitektur

```
Internet
  │ 80/443
  ▼
Nginx ──/──────────────► /var/www/wifi/            (HTML/CSS/JS statis)
  │    ──/assets/──────► /var/www/wifi/assets/
  │    ──/api/─────────► Node.js 127.0.0.1:8090 ──► MariaDB 10.11
  │
  └── redirect 80 → 443 + HSTS
SSH 22 hanya dari IP sendiri · 3306 tertutup
```

---

## 6. Stack lengkap

| Lapisan | Pilihan | Versi |
|---|---|---|
| Runtime | Node.js LTS | 20+ (uji: 20.19) |
| Framework | Express | 4.21 |
| DB driver | `mysql2` / `better-sqlite3` | 3.12 / 11 |
| Database | MariaDB | 10.11 |
| Hash sandi | `crypto.scrypt` (bawaan Node) | — |
| Web server | Nginx | 1.24 |
| SSL | Certbot | 2.x |
| Monitoring | UptimeRobot + Oracle Alarms | free |
| Backup | `mysqldump` + `rclone` | — |

---

## 7. Endpoint API

| Method | Path | Akses |
|---|---|---|
| GET | `/api/health` | publik |
| GET | `/api/auth/csrf` | publik |
| POST | `/api/auth/register` | publik |
| POST | `/api/auth/login` | publik |
| POST | `/api/auth/logout` | login |
| GET | `/api/auth/me` | publik |
| GET / PATCH | `/api/siswa/me` | siswa |
| GET / POST | `/api/siswa/perangkat` | siswa |
| GET / POST | `/api/keluhan` | siswa |
| GET | `/api/admin/dashboard` | admin |
| GET / PATCH | `/api/admin/siswa`, `/api/admin/siswa/:id` | admin |
| GET | `/api/admin/monitoring` | admin |
| GET / PATCH | `/api/admin/keluhan`, `/api/admin/keluhan/:id` | admin |
| GET | `/api/admin/log` | admin |

Format: `{ success, message, data }` / `{ success, message, errors }`.
Kode: 200, 201, 401, 403, 404, 419, 422, 429, 500.

---

## 8. Database

Tabel: `users`, `devices`, `sessions`, `tickets`, `ticket_replies`, `activity_logs`, `network_stats`, `login_attempts`, `settings`.

Perubahan dari rencana awal:
- `settings` memakai kolom `setting_key` / `setting_value` (menghindari kata kunci `key`).
- `sessions` menyimpan `data` (JSON sesi) + `expires_at`, bukan kolom `csrf_token` terpisah.
- `users.password_hash` berisi hash **scrypt**, bukan argon2id.
- Semua timestamp berupa `DATETIME` (MySQL) / `TEXT` (SQLite) dengan format `YYYY-MM-DD HH:MM:SS`.

File: `api/database/schema.mysql.sql`, `schema.sqlite.sql`, `install.js`, `seed.js`.

---

## 9. Keamanan yang sudah diterapkan

- scrypt (N=16384, r=8, p=1) + salt acak per akun, `timingSafeEqual`.
- Sesi di database, ID di-hash SHA-256, cookie `HttpOnly` + `SameSite=Lax` + `Secure` saat HTTPS.
- CSRF 32 byte per sesi, header `X-CSRF-Token`, balas 419.
- Rate limit login 5 gagal / 15 menit per NIPD+IP → 429.
- Role dicek di setiap endpoint admin.
- Prepared statement di semua query.
- Validasi: email, NIPD, No HP, MAC, whitelist kelas/kategori.
- Header: nosniff, X-Frame-Options DENY, Referrer-Policy, CSP untuk API, HSTS saat HTTPS.
- Log aktivitas untuk login, perubahan status, keluhan, dan perubahan akun.

Yang masih perlu saat deploy:
- [ ] UFW default deny (22 dari IP sendiri, 80, 443)
- [ ] fail2ban (sshd, nginx-http-auth, nginx-limit-req)
- [ ] SSH key-only, `PermitRootLogin no`
- [ ] `.env` chmod 600, owner user `wifi`
- [ ] backup harian + monitoring

---

## 10. Operasional

```bash
# service
sudo systemctl enable --now wifi-api
sudo systemctl enable --now nginx mariadb
sudo systemctl enable --now certbot.timer

# backup
0 2 * * * mysqldump --single-transaction wifi_db | gzip > /var/backups/db-$(date +\%F).sql.gz
0 3 * * * rclone copy /var/backups oracle-wifi:backup/ --max-age 8d

# update mingguan
0 4 * * 0 apt-get update && apt-get -y upgrade
```

Monitoring gratis: UptimeRobot (HTTP check 5 menit), Oracle Alarms (CPU/RAM/disk), Netdata opsional.

---

## 11. Biaya

| Item | Biaya |
|---|---|
| Oracle VM 2 OCPU / 12 GB | Rp 0 |
| Object Storage 20 GB | Rp 0 |
| Cloudflare DNS | Rp 0 |
| Let's Encrypt | Rp 0 |
| Domain eu.org | Rp 0 |
| `.my.id` (opsional) | ± Rp 20 rb/tahun |
| **Total** | **Rp 0 – 20 rb/tahun** |

---

## 12. To-do

### Selesai
- [x] Pilih arsitektur & domain
- [x] Backend Node.js lengkap (auth, siswa, admin)
- [x] Skema database MySQL + SQLite
- [x] Seed data contoh
- [x] Uji alur utama + uji MySQL
- [x] Konfigurasi Nginx + systemd (contoh)
- [x] Hubungkan frontend ke API (semua halaman siswa & admin)
- [x] Edit data siswa, hapus perangkat, ikon lokal (tanpa CDN)

### Berikutnya
- [ ] Buat akun Oracle + VM + hardening
- [ ] Deploy backend & frontend ke `/var/www/wifi`
- [ ] Ganti sandi demo, isi data nyata
- [ ] Daftarkan `eu.org` + Cloudflare
- [ ] Backup otomatis + monitoring

---

## 13. Integrasi frontend (sudah selesai)

Catatan historis langkah yang sudah dikerjakan:

1. Tambahkan di setiap halaman:
   ```html
   <meta name="api-base" content="/api/">
   <script src="../assets/js/api.js"></script>
   ```
2. `user/index.html` + `login.js` → `POST auth/login`.
3. `user/daftar.html` + `daftar.js` → `POST auth/register`.
4. `user/beranda.html` → `GET siswa/me`, `PATCH siswa/me`.
5. `user/keluhan.html` → `POST keluhan`; `riwayat.html` → `GET keluhan`.
6. Admin: `dashboard.js`, `siswa.js`, `monitoring.js`, `keluhan.js`, `log.js`.
7. Ganti ikon Bootstrap dari CDN ke file lokal.
8. Hapus data dummy & `localStorage` dari JS lama.

---

## 14. Catatan / risiko

1. **Frontend sudah memakai API.** Password WiFi, MAC, IP, tiket, dan data
   siswa dibaca dari database, bukan ditulis di JS/localStorage.
2. Login dan pendaftaran sudah punya handler submit + penanganan error.
3. Tiket keluhan tersimpan di database dan bisa dibalas dua arah.
4. Semua halaman admin sudah memuat data nyata; data jaringan tetap ditandai
   "belum terhubung" sampai router terpasang.
5. Oracle bisa "out of capacity" saat membuat instance ARM → coba AD lain / ulangi beberapa hari.
6. Jangan pakai data siswa asli sebelum backend + HTTPS + backup selesai.
7. `api.js` memakai cookie + CSRF; jangan buka API dari domain berbeda (CORS tidak diaktifkan).

---

## 15. Perintah cepat

```bash
# lokal
cd api && npm install && npm run db:install && npm run db:seed && npm start

# reset data contoh
cd api && npm run db:seed -- --force

# produksi (MySQL)
cd /var/www/wifi/api
cp .env.example .env && nano .env
npm install --omit=dev
npm run db:install && npm run db:seed
sudo systemctl restart wifi-api
```
