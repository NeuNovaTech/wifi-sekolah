# Mulai dari Nol — Deploy Gratis (Render + Aiven MySQL)

> Jalur yang dipakai: **Render** (server) + **Aiven MySQL** (database).
> Keduanya gratis, tanpa kartu kredit.
>
> Rincian Aiven ada di `deploy/AIVEN-LANGKAH.md`.

---

## Urutan kerja

1. Daftar **GitHub** → upload project.
2. Daftar **Aiven** → buat MySQL → catat Host/Port/User/Password.
3. Daftar **Render** → Blueprint → isi 4 nilai Aiven → Live.

Total ±20 menit (di luar waktu tunggu build).

---

## 1. Upload project ke GitHub

1. Buka <https://github.com/signup> → daftar → verifikasi email.
2. Buka <https://github.com/new> → nama repo `wifi-sekolah` → **Public**
   → **Create repository**.
3. Download + extract **`wifi-sekolah-siap-deploy.zip`** (ada di Google
   Drive, satu folder dengan `Project`).
4. Di repo → **Add file → Upload files**.
5. Buka folder hasil extract (`Project`), **blok semua isinya** (bukan
   foldernya), drag ke halaman GitHub.
6. **Commit changes**.

Pastikan di halaman utama repo terlihat `render.yaml`, `Dockerfile`,
folder `api/`, `admin/`, `user/`, `assets/`, `deploy/`.

> Jangan upload `api/node_modules`, `api/.env`, atau file `.sqlite`.
> Zip sudah dibersihkan.

## 2. Buat database Aiven

Ikuti `deploy/AIVEN-LANGKAH.md` bagian 1–4. Hasil akhir: kamu punya
**Host, Port, User, Password** dan database `defaultdb`.

## 3. Deploy di Render

1. Buka <https://dashboard.render.com> → login pakai **GitHub**.
2. **New + → Blueprint** → pilih repo `wifi-sekolah` → **Connect**.
3. Render membaca `render.yaml` dan menanyakan:
   - `DB_HOST` → Host Aiven
   - `DB_PORT` → Port Aiven (contoh `12345`)
   - `DB_USERNAME` → `avnadmin`
   - `DB_PASSWORD` → Password Aiven
4. Klik **Apply** → tunggu build 5–10 menit.
5. Setelah **Live**, buka:
   `https://wifi-smkn1-susukan.onrender.com`

## 4. Cek dan amankan

1. `/api/health` → harus `"success": true` dan `"driver": "mysql"`.
2. `/admin/` → login **admin / admin123** → ganti sandi di **Pengaturan**.
3. `/user/` → login **1234 / siswa123** untuk melihat sisi siswa.
4. Cek dashboard dan monitoring sudah terisi.

---

## Kalau Aiven bermasalah

Alternatif tanpa database eksternal:

1. Timpa `render.yaml` dengan isi `deploy/render-sqlite.yaml`.
2. Commit & push.
3. Deploy ulang.

Konsekuensinya: data kembali ke contoh setiap Render restart/redeploy.
Cocok hanya untuk demo.

---

## Catatan Render Free

- Tidur setelah 15 menit tanpa kunjungan; buka lagi tunggu ±1 menit.
- Build pertama paling lama (kompilasi `better-sqlite3`).
- Untuk jangka panjang: **Oracle Cloud Always Free** +
  `deploy/CARA-ORACLE-DUCKDNS.md`.
