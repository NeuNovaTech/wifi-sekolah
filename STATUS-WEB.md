# Status Web — Sistem Akses WiFi SMK Negeri 1 Susukan

> Diperbarui: 26 Oktober 2026
> Ringkasan: **web sudah bisa dipakai** untuk pendaftaran, persetujuan,
> keluhan, monitoring data perangkat, log, dan pengaturan. Integrasi ke
> router/AP belum ada (memang belum tersedia perangkatnya).

---

## 1. Yang sudah berfungsi

### Halaman siswa (`user/`)

| Halaman | Fungsi |
|---|---|
| `index.html` | Login dengan NIPD + kata sandi, cek sesi otomatis |
| `daftar.html` | Pendaftaran akun + syarat & ketentuan, status awal *pending* |
| `beranda.html` | Profil, perangkat (tambah/hapus), SSID/sandi WiFi dari database, aktivitas, tes koneksi ke server, ganti No HP / kata sandi |
| `keluhan.html` | Kirim tiket keluhan ke database |
| `riwayat.html` | Daftar tiket, status, balasan operator, dan balas percakapan |

### Halaman admin (`admin/`)

| Halaman | Fungsi |
|---|---|
| `index.html` | Login admin (role diperiksa) |
| `dashboard.html` | Statistik, pendaftar baru (setujui/tolak), tiket, VLAN, log, grafik |
| `siswa.html` | Cari/filter siswa, tambah siswa, edit data, detail, setujui/tolak/blokir, reset sandi |
| `monitoring.html` | Perangkat terdaftar, VLAN, status jaringan (data dari database) |
| `keluhan.html` | Filter tiket, ubah status, **balas percakapan**, ekspor CSV |
| `log.html` | Ringkasan aktivitas, cari/filter jenis & tanggal, ekspor CSV |
| `pengaturan.html` | SSID, sandi WiFi, jam akses, kapasitas jaringan, **ganti sandi admin** |

### Backend (`api/`)

- Autentikasi + sesi database, CSRF, rate limit login, scrypt.
- CRUD siswa (tambah, edit data, ubah status, reset sandi), perangkat
  (tambah/hapus), keluhan.
- **Balasan tiket** (`ticket_replies`) untuk siswa dan admin.
- **Pengaturan WiFi** tersimpan di tabel `settings`.
- **Ganti kata sandi admin** dengan verifikasi sandi lama.
- Log aktivitas otomatis untuk aksi penting.
- SQLite (lokal) dan MySQL/MariaDB (produksi).
- Ikon Bootstrap disimpan lokal di `assets/vendor/bootstrap-icons/`, jadi
  halaman tetap tampil rapi walau jaringan sekolah tidak punya internet.

---

## 2. Yang belum bisa dikerjakan tanpa perangkat WiFi

Ini bukan bug web, tetapi memang butuh akses router/controller:

- Daftar perangkat yang benar-benar terhubung, IP/MAC asli, status online,
  durasi sesi, kekuatan sinyal.
- Status AP hidup/mati dan jumlah pengguna online.
- Uji kecepatan internet asli (yang ada sekarang hanya tes respons server).
- Menerapkan SSID/sandi/jam akses ke jaringan.
- Blokir perangkat di level jaringan, VLAN, kuota, shaping bandwidth.
- Captive portal: login web **tidak** otomatis memberi akses internet.

Rencana integrasi nanti: MikroTik/controller AP + RADIUS + captive portal,
lalu endpoint webhook/API dari router ke aplikasi ini.

---

## 3. Menjalankan lokal

```bash
cd api
npm install
npm run db:install
npm run db:seed     # hanya sekali
npm start
```

Buka:

- Web siswa: <http://127.0.0.1:8090/user/>
- Panel admin: <http://127.0.0.1:8090/admin/>
- Health API: <http://127.0.0.1:8090/api/health>

Akun contoh:

- Admin: `admin` / `admin123`
- Siswa: `1234` / `siswa123`

> Ganti kata sandi bawaan sebelum dipakai sungguhan (menu **Pengaturan**).

---

## 4. Deploy gratis

Panduan lengkap: `deploy/PASANG-GRATIS.md`.

Ringkasnya:

- **Oracle Cloud Always Free** + **DuckDNS** + **Caddy** → gratis, disk
  permanen, HTTPS otomatis. Pilihan utama.
- **Render/Railway** → cepat untuk demo, tetapi disk gratis biasanya sementara
  (database bisa kembali kosong saat redeploy).
- File pendukung: `Dockerfile`, `deploy/env.production.contoh`,
  `deploy/Caddyfile`, `deploy/nginx-wifi.conf`, `deploy/wifi-api.service`.

---

## 5. Catatan pengujian

Diuji pada salinan lokal (SQLite) dengan browser headless:

1. Daftar akun baru → status pending → login ditolak dengan pesan jelas.
2. Admin menyetujui → siswa bisa login.
3. Siswa mengirim keluhan → muncul di panel admin.
4. Admin membalas → siswa melihat balasan dan bisa membalas lagi.
5. Admin mengubah pengaturan → tersimpan dan terbaca lagi.
6. Admin mengganti kata sandi → sandi lama ditolak, sandi baru bisa dipakai.
7. Admin mengedit data siswa (nama, email, No HP, kelas) → tersimpan dan
   langsung terlihat di daftar/detail; email milik akun lain ditolak.
8. Siswa menghapus perangkat → kuota 3 perangkat kembali longgar dan
   perangkat tidak bisa dihapus oleh akun lain.
9. Semua halaman admin/siswa dimuat tanpa error JavaScript.

Data uji di atas hanya ada di salinan lokal; database asli tidak diubah.
