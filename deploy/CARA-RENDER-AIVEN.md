# Deploy Tanpa Kartu Kredit — Render + Aiven MySQL

> Cocok kalau kamu **tidak punya kartu kredit**.
> Hasil: server gratis di Render + database permanen di Aiven.
> Biaya: **Rp 0**.

---

## Kenapa bukan Oracle/Google?

| Layanan | Butuh kartu? | Catatan |
|---|---|---|
| Oracle Cloud Always Free | ✅ ya (verifikasi) | Tidak ditagih, tapi tetap minta kartu |
| Google Cloud e2-micro | ✅ ya | Sama |
| **Render Free** | ❌ tidak | Server + domain `*.onrender.com` |
| **Aiven MySQL Free** | ❌ tidak | Database 1 GB, gratis selamanya |
| **Cloudflare Tunnel + PC** | ❌ tidak | Butuh PC nyala 24 jam |

---

# Pilihan A — Render + SQLite (paling cepat, untuk demo)

Cocok untuk **melihat sistem jalan**. Kekurangan: database SQLite **hilang saat deploy/restart**.

## 1. Upload ke GitHub
1. Buat akun GitHub (gratis, tanpa kartu).
2. Buat repository baru, misal `wifi-sekolah`.
3. Upload folder project (minimal: `api/`, `user/`, `admin/`, `assets/`, `deploy/`, `Dockerfile`, `render.yaml`, `.dockerignore`).

Cara command line:

```bash
cd Project
git init
git add .
git commit -m "Siap deploy Render"
git branch -M main
git remote add origin https://github.com/USERNAME/wifi-sekolah.git
git push -u origin main
```

## 2. Deploy di Render
1. Login <https://render.com> pakai GitHub (tanpa kartu).
2. **New + → Blueprint**.
3. Pilih repo `wifi-sekolah`.
4. Render membaca `render.yaml` → klik **Apply**.
5. Tunggu build 3–6 menit.
6. Link jadi: `https://wifi-smkn1-susukan.onrender.com`

## 3. Login
- Admin: `/admin/` → `admin` / `admin123`
- Siswa: `/user/` → `1234` / `siswa123`

> Free tier Render tidur setelah 15 menit idle. Request pertama bisa lambat 30–60 detik.

---

# Pilihan B — Render + Aiven MySQL (disarankan, data permanen)

Ini yang membuat data **tidak hilang** saat Render redeploy/restart.

## 1. Buat database Aiven (tanpa kartu)
1. Daftar <https://aiven.io> (tanpa kartu).
2. **Create service → MySQL → Free plan**.
3. Pilih region **Singapore** (dekat Indonesia).
4. Setelah jadi, catat:
   - **Host**
   - **Port** (bukan 3306, misal `12345`)
   - **User** (biasanya `avnadmin`)
   - **Password**
   - **Database** (biasanya `defaultdb`)
5. Di Aiven → service → **IP allowlist / Firewall** → izinkan `0.0.0.0/0` (karena IP keluar Render dinamis). Keamanan tetap dijaga TLS + sandi kuat.

> Aiven Free: 1 GB storage, 1 GB RAM, gratis selamanya, tanpa kartu.

## 2. Siapkan repo GitHub
Sama seperti Pilihan A: upload project ke GitHub.

## 3. Ganti konfigurasi Render ke MySQL
Di repo, **ganti isi `render.yaml`** dengan `deploy/render-aiven.yaml`, lalu commit & push.

Saat membuat Blueprint, Render akan meminta nilai rahasia (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`). Isi dari Aiven.

## 4. Deploy
Render menjalankan `api/docker-entrypoint.sh`:

```sh
node database/install.js   # buat tabel di MySQL
node database/seed.js      # isi akun demo (hanya kalau kosong)
node server.js             # jalankan API
```

Kalau berhasil, buka:

- `https://nama-service.onrender.com/api/health`
- `https://nama-service.onrender.com/user/`
- `https://nama-service.onrender.com/admin/`

## 5. Kalau koneksi MySQL gagal
Biasanya karena sertifikat Aiven belum dikenali Node. Set:

```env
DB_SSL=true
DB_SSL_INSECURE=true
```

Lalu redeploy. Koneksi tetap terenkripsi, hanya verifikasi CA yang dilewati.

---

# Pilihan C — Cloudflare Tunnel + PC sekolah (tanpa kartu, data permanen)

Kalau ada PC/laptop yang bisa nyala 24 jam.

## 1. Jalankan aplikasi di PC
```bash
cd api
npm install
npm run db:install
npm run db:seed
npm start
```
Aplikasi jalan di `http://localhost:8090`.

## 2. Pasang Cloudflare Tunnel
1. Daftar <https://cloudflare.com> (tanpa kartu).
2. Install `cloudflared` sesuai OS.
3. Untuk uji cepat:
   ```bash
   cloudflared tunnel --url http://localhost:8090
   ```
   Akan muncul URL acak `https://....trycloudflare.com` (berubah setiap restart).
4. Untuk permanen, buat **named tunnel** dan arahkan ke domain yang kamu punya (mis. `nama.eu.org` atau domain murah).

**Kelebihan:** data di disk sendiri, tidak tidur, gratis.
**Kekurangan:** PC harus nyala, internet stabil, dan listrik.

---

# Perbandingan

| | Render + SQLite | Render + Aiven | Cloudflare + PC |
|---|---|---|---|
| Kartu kredit | tidak | tidak | tidak |
| Biaya | Rp0 | Rp0 | Rp0 + listrik |
| Data permanen | ❌ | ✅ | ✅ |
| Server tidur | ✅ ya | ✅ ya | ❌ tidak |
| Setup | 10 menit | 20 menit | 30 menit |
| Cocok | demo | produksi kecil | produksi lokal |

---

# Checklist Render

- [ ] Repo GitHub berisi project
- [ ] `render.yaml` sesuai pilihan (SQLite/Aiven)
- [ ] Blueprint dibuat di Render
- [ ] Build sukses
- [ ] `/api/health` = `success: true`
- [ ] Login admin berhasil
- [ ] Sandi admin diganti
- [ ] Kalau pakai Aiven: data tetap ada setelah redeploy

---

# Troubleshooting

| Gejala | Solusi |
|---|---|
| Build gagal `better-sqlite3` | Dockerfile sudah memasang `python3 make g++`; cek log build |
| Deploy sukses tapi 502 | Cek log Render; pastikan app listen di `$PORT` (Render menyuntikkan otomatis) |
| Data hilang setelah redeploy | Wajar di SQLite; pindah ke Aiven |
| `ER_ACCESS_DENIED` | Cek user/password/port Aiven |
| `SSL` error | `DB_SSL=true`, `DB_SSL_INSECURE=true` |
| MySQL tidak connect | IP allowlist Aiven belum `0.0.0.0/0` |
| Halaman 404 | Pakai trailing slash: `/user/`, `/admin/` |
| Login lalu logout | `TRUST_PROXY=true` |
