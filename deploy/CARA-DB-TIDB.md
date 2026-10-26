# Database Gratis Tanpa Kartu — TiDB Cloud Starter

> Pengganti Aiven untuk aplikasi ini.
> MySQL-compatible, **tanpa kartu kredit**, kuota gratis **5 GiB**.
> Cocok dipasangkan dengan Render Free.

---

## Kenapa TiDB?

| | Aiven MySQL Free | TiDB Cloud Starter |
|---|---|---|
| Kartu kredit | tidak | tidak |
| Kuota | 1 GB | **5 GiB** |
| Protokol | MySQL asli | MySQL-compatible |
| Gratis selamanya | ✅ | ✅ (selama di kuota) |
| Cocok untuk kode ini | ✅ | ✅ |

Kode aplikasi **tidak perlu diubah** — cukup ganti env `DB_*` di Render.

---

## 1. Buat database

1. Daftar <https://tidbcloud.com> (tanpa kartu).
2. **Create Cluster → TiDB Cloud Starter / Serverless**.
3. Region: **Singapore** (kalau tersedia) atau terdekat.
4. Setelah cluster jadi, buka **Connect**.
5. Catat:
   - **Host** (contoh `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`)
   - **Port** (`4000`)
   - **User** (contoh `3AbC123.root`)
   - **Password**
6. Buat database (bisa lewat SQL Editor):

```sql
CREATE DATABASE wifi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

7. Di **Network Access / IP Allowlist**, izinkan `0.0.0.0/0` karena IP Render berubah-ubah.

---

## 2. Pasang di Render

`render.yaml` di root project **sudah diset untuk TiDB**. Saat membuat Blueprint,
Render akan meminta nilai `DB_HOST`, `DB_USERNAME`, dan `DB_PASSWORD`.
Isi dari dashboard TiDB:

```env
DB_DRIVER=mysql
DB_HOST=gateway01.xxx.prod.aws.tidbcloud.com
DB_PORT=4000
DB_DATABASE=wifi_db
DB_USERNAME=3AbC123.root
DB_PASSWORD=********
DB_SSL=true
DB_SSL_INSECURE=true
```

> `DB_SSL_INSECURE=true` dipakai kalau Node belum mengenali sertifikat CA TiDB.
> Koneksi tetap terenkripsi.

Deploy. Entry point otomatis menjalankan:

```sh
node database/install.js   # buat tabel
node database/seed.js      # isi akun demo (kalau kosong)
node server.js
```

---

## 3. Uji

- `https://nama-service.onrender.com/api/health`
- Login `/admin/` → `admin` / `admin123`
- Redeploy sekali → data harus tetap ada.

---

## Catatan TiDB

- TiDB bukan MySQL 100% identik, tetapi fitur yang dipakai aplikasi ini didukung:
  `AUTO_INCREMENT`, `ENUM`, `JSON`, `ON DUPLICATE KEY UPDATE`, `DATETIME`,
  dan **foreign key** (GA sejak TiDB 8.5).
- Cluster gratis bisa **scale-to-zero**; koneksi pertama bisa lambat beberapa detik.
- Backup: TiDB Starter belum tentu menyediakan backup otomatis di paket gratis.
  Untuk data sekolah, tetap ekspor berkala:
  ```bash
  mysqldump -h HOST -P 4000 -u USER -p --ssl-mode=REQUIRED wifi_db > backup.sql
  ```

---

## Alternatif lain (tanpa kartu)

| Layanan | Kuota | Protokol | Catatan |
|---|---|---|---|
| **TiDB Cloud Starter** | 5 GiB | MySQL | Paling pas |
| **Aiven Free** | 1 GB | MySQL | Paling standar |
| **db4free.net** | ±200 MB | MySQL | Hanya untuk uji, tanpa jaminan |
| **FreeMySQLHosting** | 5 MB | MySQL | Terlalu kecil |
| **Supabase** | 500 MB | PostgreSQL | Perlu ubah kode |
| **Neon** | 0.5 GB | PostgreSQL | Perlu ubah kode |
| **Turso** | ±9 GB | SQLite/libSQL | Perlu ubah lapisan DB |

---

## Kalau tidak mau database eksternal

- **Render + SQLite** → paling cepat, tapi data reset saat deploy/restart.
- **PC sekolah + SQLite** → permanen, tanpa cloud DB, tapi PC harus nyala.
