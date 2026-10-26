# Panduan Aiven MySQL — dari daftar sampai data masuk

> Gratis selamanya, tanpa kartu kredit. Kapasitas 1 GB (cukup untuk
> ribuan siswa, tiket, dan log).
>
> Catatan 2026: paket Free **tidak bisa memilih region/cloud** — Aiven
> yang menentukan. Latency ke Indonesia bisa 100–250 ms; untuk aplikasi
> administrasi seperti ini masih nyaman.

---

## 1. Daftar akun

1. Buka <https://console.aiven.io/signup>.
2. Daftar pakai **Google**, **GitHub**, atau email + password.
3. Verifikasi email kalau diminta.
4. Saat diminta membuat **organization/project**, isi nama bebas,
   misalnya `wifi-sekolah`.

Tidak ada permintaan kartu kredit.

## 2. Buat database MySQL

1. Di console, klik **Create service**.
2. Pilih **MySQL**.
3. Pilih plan **Free** ($0/month).
4. **Service name**: `wifi-db` (bebas).
5. Klik **Create service**.
6. Tunggu 2–5 menit sampai status **Running** (ikon hijau).

> Kalau plan Free tidak muncul, pastikan kamu di project yang benar dan
> belum punya service MySQL Free lain (batas 1 per organisasi).

## 3. Izinkan Render terhubung

1. Buka service `wifi-db`.
2. Cari tab/menu **Allowed IP addresses** (kadang bernama **IP allowlist**
   atau ada di **Overview**).
3. Tambahkan `0.0.0.0/0` → **Save**.
   Ini perlu karena IP keluar Render berubah-ubah.

Kalau menu tersebut tidak ada, lewati saja — sebagian akun Free sudah
terbuka untuk koneksi publik.

## 4. Catat 4 nilai ini

Di halaman **Overview** service, buka **Connection information**
(atau **Quick connect**). Kamu akan melihat:

| Yang dicari | Contoh isi | Dipakai untuk |
|---|---|---|
| **Host** | `mysql-1a2b3c4d-wifi-db.a.aivencloud.com` | `DB_HOST` |
| **Port** | `12345` (bukan 3306) | `DB_PORT` |
| **User** | `avnadmin` | `DB_USERNAME` |
| **Password** | `AVNS_xxxxxxxxxxxx` | `DB_PASSWORD` |

Database yang dipakai: **`defaultdb`** (sudah otomatis ada, tidak perlu
dibuat). Kalau mau nama lain, buat di tab **Databases** lalu sesuaikan
`DB_DATABASE` di Render.

> Password hanya ditampilkan sekali. Kalau hilang, klik **Reset password**
> di halaman service.

## 5. Isi di Render

Saat membuat **Blueprint**, Render menanyakan:

| Key | Isi |
|---|---|
| `DB_HOST` | Host dari Aiven |
| `DB_PORT` | Port dari Aiven |
| `DB_USERNAME` | `avnadmin` |
| `DB_PASSWORD` | Password dari Aiven |

`DB_DATABASE` sudah diisi `defaultdb`, `DB_SSL` dan `DB_SSL_INSECURE`
sudah `true` di `render.yaml`. Tidak perlu diubah.

## 6. Deploy dan cek

1. Render → **Apply** → tunggu build 5–10 menit.
2. Buka `https://nama-service.onrender.com/api/health`.
   Harus muncul `"success": true` dan `"driver": "mysql"`.
3. Buka `/admin/` → login `admin` / `admin123`.
4. Ganti sandi admin di menu **Pengaturan**.

Kalau deploy gagal dengan pesan koneksi database:

- Pastikan **Allowed IP** berisi `0.0.0.0/0`.
- Pastikan `DB_PORT` memakai port dari Aiven, bukan 3306.
- Coba **Manual Deploy → Clear build cache & deploy**.
- Cek log Render pada bagian `install.js` (pembuatan tabel).

## 7. Setelah jalan

- Data sekarang **permanen**: akun, tiket, dan log tidak hilang saat
  Render restart/redeploy.
- Tetap lakukan backup berkala dari Aiven (menu **Backups**) atau
  `mysqldump` dari komputer sendiri.
- Render Free tetap tidur setelah 15 menit idle (±1 menit bangun).
- Service Aiven Free bisa **dimatikan otomatis** setelah lama tidak dipakai.
  Kalau aplikasi error koneksi database, buka console Aiven → service
  `wifi-db` → **Power on**.
