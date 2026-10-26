# Backend API — Sistem Akses WiFi SMK Negeri 1 Susukan

Backend Node.js untuk frontend yang sudah ada di `user/`, `admin/`, dan `assets/`.
Semua respons JSON mengikuti kontrak `assets/js/api.js`.

Status: **berfungsi penuh** (diuji lokal dengan SQLite). Frontend di `user/` dan
`admin/` sudah terhubung ke API; ringkasan fitur ada di `STATUS-WEB.md` pada
root project.

---

## 1. Fitur yang sudah jadi

| Area | Fitur |
|---|---|
| Autentikasi | CSRF token, login, register, logout, `me`, sesi berbasis database |
| Keamanan | scrypt password, rate limit login, cookie HttpOnly/SameSite, cek role |
| Siswa | profil, ganti No HP, ganti kata sandi, perangkat (tambah/hapus, maks 3), keluhan |
| Admin | dashboard, daftar siswa + filter, tambah/edit siswa, approve/reject/block, reset sandi, monitoring, keluhan, log |
| Database | MySQL/MariaDB (produksi) dan SQLite (uji lokal) |
| Seed | akun admin + 6 siswa contoh + perangkat + tiket + statistik |

---

## 2. Struktur

```
api/
├── server.js               # entry point
├── src/
│   ├── app.js              # express app, mount route, error handler
│   ├── config.js           # baca .env
│   ├── db.js               # MySQL / SQLite
│   ├── session.js          # sesi di tabel sessions
│   ├── csrf.js             # token CSRF
│   ├── auth.js             # attachUser, requireUser, requireAdmin
│   ├── passwords.js        # scrypt
│   ├── validation.js
│   ├── response.js
│   ├── helpers.js
│   ├── routes/             # auth, siswa, perangkat, keluhan, admin
│   └── models/             # user, device, ticket, log, setting, dll
├── database/
│   ├── schema.mysql.sql
│   ├── schema.sqlite.sql
│   ├── install.js
│   └── seed.js
├── storage/                # database.sqlite (lokal) + logs
├── package.json
├── .env                    # konfigurasi lokal (sqlite)
└── .env.example            # contoh konfigurasi produksi (mysql)
```

---

## 3. Menjalankan lokal (SQLite, tanpa MySQL)

Prasyarat: Node.js **20 atau lebih baru**.

```bash
cd api
npm install
npm run db:install
npm run db:seed
npm start
```

Buka:

- API health: <http://localhost:8090/api/health>
- Frontend: <http://localhost:8090/user/>
- Admin: <http://localhost:8090/admin/>

`.env` bawaan sudah memakai SQLite, jadi tidak perlu menyiapkan database.

---

## 4. Menjalankan di server (MySQL/MariaDB)

### 4.1 Siapkan database

```sql
CREATE DATABASE wifi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wifi'@'localhost' IDENTIFIED BY 'SANDI_DATABASE_KUAT';
GRANT ALL PRIVILEGES ON wifi_db.* TO 'wifi'@'localhost';
FLUSH PRIVILEGES;
```

### 4.2 Konfigurasi

```bash
cd /var/www/wifi/api
cp .env.example .env
nano .env
```

Isi minimal:

```env
APP_DEBUG=false
SERVE_STATIC=false
TRUST_PROXY=true
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_DATABASE=wifi_db
DB_USERNAME=wifi
DB_PASSWORD=SANDI_DATABASE_KUAT
```

### 4.3 Pasang skema & data awal

```bash
npm install --omit=dev
npm run db:install
npm run db:seed
```

> **Ganti sandi `admin123` dan `siswa123` sebelum dipakai sungguhan.**

### 4.4 systemd

```bash
sudo cp /var/www/wifi/deploy/wifi-api.service /etc/systemd/system/
sudo useradd --system --home /var/www/wifi --shell /usr/sbin/nologin wifi || true
sudo chown -R wifi:wifi /var/www/wifi/api/storage
sudo systemctl daemon-reload
sudo systemctl enable --now wifi-api
sudo systemctl status wifi-api
```

### 4.5 Nginx

```bash
sudo cp /var/www/wifi/deploy/nginx-wifi.conf /etc/nginx/sites-available/wifi
sudo ln -s /etc/nginx/sites-available/wifi /etc/nginx/sites-enabled/wifi
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d DOMAIN_KAMU
```

Frontend dilayani Nginx dari `/var/www/wifi`, sedangkan `/api/` diteruskan ke Node di `127.0.0.1:8090` (sesuaikan dengan `PORT` di `.env`).

---

## 5. Environment

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `8090` | port Node |
| `HOST` | `127.0.0.1` | pakai `0.0.0.0` hanya kalau tanpa Nginx |
| `SERVE_STATIC` | `true` | `false` di produksi (Nginx yang melayani file) |
| `TRUST_PROXY` | `false` | `true` di belakang Nginx/Cloudflare |
| `APP_DEBUG` | `false` | `true` hanya untuk pengembangan |
| `DB_DRIVER` | `mysql` | `mysql` atau `sqlite` |
| `DB_SQLITE_PATH` | `./storage/database.sqlite` | hanya untuk SQLite |
| `SESSION_NAME` | `WIFI_SESSID` | nama cookie sesi |
| `SESSION_LIFETIME` | `7200` | umur sesi (detik) |
| `LOGIN_MAX_ATTEMPTS` | `5` | batas gagal login |
| `LOGIN_WINDOW_MINUTES` | `15` | jendela waktu rate limit |

---

## 6. Akun contoh

| Peran | NIPD | Sandi | Status |
|---|---|---|---|
| Admin | `admin` | `admin123` | aktif |
| Siswa | `1234` | `siswa123` | aktif |
| Siswa | `1235` | `siswa123` | pending → aktif setelah di-approve |
| Siswa | `1236` | `siswa123` | pending |
| Siswa | `1237`–`1239` | `siswa123` | aktif |

---

## 7. Endpoint

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/health` | publik | cek server |
| GET | `/api/auth/csrf` | publik | ambil token CSRF |
| POST | `/api/auth/register` | publik | daftar siswa (pending) |
| POST | `/api/auth/login` | publik | masuk |
| POST | `/api/auth/logout` | login | keluar |
| GET | `/api/auth/me` | publik | cek sesi |
| GET | `/api/siswa/me` | siswa | profil + perangkat + keluhan |
| PATCH | `/api/siswa/me` | siswa | ganti No HP / sandi |
| GET | `/api/siswa/perangkat` | siswa | daftar perangkat |
| POST | `/api/siswa/perangkat` | siswa | tambah perangkat (maks 3) |
| DELETE | `/api/siswa/perangkat/:id` | siswa | hapus perangkat milik sendiri |
| GET | `/api/keluhan` | siswa | tiket milik sendiri |
| POST | `/api/keluhan` | siswa | kirim keluhan |
| GET | `/api/admin/dashboard` | admin | statistik ringkas |
| GET | `/api/admin/siswa` | admin | daftar siswa (`?status=&q=`) |
| PATCH | `/api/admin/siswa/:id` | admin | `edit` data, `approve`/`reject`/`block`, `reset_password` |
| GET | `/api/admin/monitoring` | admin | perangkat, VLAN, statistik |
| GET | `/api/admin/keluhan` | admin | semua tiket (`?status=&q=`) |
| PATCH | `/api/admin/keluhan/:id` | admin | ubah status tiket |
| GET | `/api/admin/log` | admin | log aktivitas (`?limit=`) |

Mutasi (POST/PATCH/DELETE) wajib mengirim header `X-CSRF-Token`, kecuali login dan register.

---

## 8. Format respons

```json
{ "success": true, "message": "OK", "data": {} }
```

```json
{
  "success": false,
  "message": "Validasi gagal.",
  "errors": { "nipd": ["NIPD sudah terdaftar."] }
}
```

Kode: `200`, `201`, `401`, `403`, `404`, `419` (CSRF), `422`, `429`, `500`.

---

## 9. Contoh uji dengan curl

```bash
BASE=http://localhost:8090
JAR=/tmp/wifi-cookie.txt

# 1. token CSRF
TOKEN=$(curl -s -c $JAR -b $JAR $BASE/api/auth/csrf | jq -r .data.token)

# 2. login admin
curl -s -c $JAR -b $JAR -H 'Content-Type: application/json' \
  -d '{"nipd":"admin","password":"admin123"}' $BASE/api/auth/login | jq

# 3. dashboard admin
curl -s -b $JAR $BASE/api/admin/dashboard | jq '.data | {total_siswa, pending, online}'

# 4. approve siswa (id 3)
curl -s -b $JAR -X PATCH \
  -H "X-CSRF-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"approve"}' $BASE/api/admin/siswa/3 | jq

# 5. login siswa
curl -s -c $JAR -b $JAR -H 'Content-Type: application/json' \
  -d '{"nipd":"1235","password":"siswa123"}' $BASE/api/auth/login | jq

# 6. profil siswa
curl -s -b $JAR $BASE/api/siswa/me | jq '.data.user | {nama, kelas, status}'

# 7. kirim keluhan
curl -s -b $JAR -X POST \
  -H "X-CSRF-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"kategori":"koneksi","isi":"WiFi putus nyambung di lab TJKT."}' \
  $BASE/api/keluhan | jq
```

---

## 10. Keamanan yang sudah diterapkan

- Kata sandi: **scrypt** (N=16384, r=8, p=1) + salt acak per akun, perbandingan `timingSafeEqual`.
- Sesi disimpan di tabel `sessions` dengan **ID di-hash SHA-256**; cookie asli tidak disimpan di database.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` otomatis saat HTTPS.
- CSRF: token 32 byte per sesi, dibandingkan dengan `timingSafeEqual`, balas `419`.
- Rate limit login: 5 gagal / 15 menit per NIPD+IP → `429`.
- Role dicek di server (`requireAdmin`), bukan hanya di frontend.
- Query memakai **prepared statement** (`?`), tanpa konkatenasi input.
- Validasi panjang, format email, NIPD, No HP, MAC, dan whitelist kelas/kategori.
- Header keamanan: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP.
- Log aktivitas untuk login, perubahan status, keluhan, dan perubahan akun.

---

## 11. Yang belum dikerjakan

Frontend sudah terhubung ke API (login, daftar, beranda, keluhan, riwayat,
dashboard, data siswa, monitoring, log, pengaturan). Ikon Bootstrap juga sudah
lokal sehingga tidak butuh CDN.

Yang masih menunggu:

1. Integrasi router/controller AP untuk data jaringan nyata (AP, VLAN aktif,
   perangkat online, sinyal, bandwidth, captive portal).
2. Deploy ke server produksi (Oracle/Nginx/HTTPS) dan ganti sandi demo.
3. Backup otomatis dan monitoring server.

---

## 12. Troubleshooting

| Masalah | Solusi |
|---|---|
| `EADDRINUSE` | port dipakai proses lain; ubah `PORT` di `.env` |
| `SQLITE_BUSY` | jangan jalankan dua proses Node pada database yang sama |
| `ER_ACCESS_DENIED_ERROR` | cek `DB_USERNAME` / `DB_PASSWORD` |
| Login berhasil tapi langsung logout | cookie `Secure` aktif di HTTP; pastikan `X-Forwarded-Proto` diteruskan Nginx |
| `419` terus | frontend belum mengirim `X-CSRF-Token` atau token kedaluwarsa |
| Halaman admin kosong | `auth-guard.js` mengalihkan karena `Api.me()` gagal; cek `/api` di Nginx |
