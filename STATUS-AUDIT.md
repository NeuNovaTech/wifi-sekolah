# Audit Status — Sistem Akses WiFi SMK Negeri 1 Susukan

> **Dokumen historis.** Ini audit kondisi *sebelum* frontend disambungkan.
> Status terbaru ada di `STATUS-WEB.md` (semua halaman siswa dan admin sudah
> memakai API/database asli; yang masih simulasi hanya data jaringan).

> Tanggal: 26 Oktober 2026
> Metode: pembacaan kode langsung (`grep`/`sed` pada semua HTML & JS) + uji API di SQLite dan MariaDB.
> Kesimpulan singkat: **backend selesai; web belum bisa dipakai.** Dari 10 halaman, hanya login admin + penjaga sesi yang benar-benar berfungsi.

---

## 1. Ringkasan angka

| Lapisan | Selesai | Keterangan |
|---|---|---|
| Backend API (20 endpoint) | **100 %** | Diuji di SQLite & MariaDB, semua lolos |
| Database + seed | **100 %** | Skema MySQL & SQLite, data contoh |
| Halaman siswa (5) | **±10 %** | Tampilan jadi, tidak ada yang memanggil API |
| Halaman admin (6) | **±20 %** | Login & proteksi jalan, isi halaman hardcoded |
| Integrasi router/AP | **0 %** | Belum ada, dan tidak bisa dikerjakan dari web saja |

Artinya: kalau dibuka sekarang, aplikasi **tampak** lengkap tetapi semua angka, tabel, dan tombol adalah hiasan. Hanya login admin yang nyata.

---

## 2. Status per halaman

### 2.1 Halaman siswa

| Halaman | Yang benar-benar terjadi sekarang | Bisa dipakai? | Yang dibutuhkan |
|---|---|---|---|
| `user/index.html` (login) | Form ada, tapi **tidak ada handler submit**. Field `nama` & `kelas` wajib diisi padahal backend hanya butuh NIPD + sandi | ❌ | `login.js` + hapus field nama/kelas |
| `user/daftar.html` | Form + scroll Syarat & Ketentuan jalan, **submit tidak mengirim apa pun** | ❌ | `daftar.js` → `POST /auth/register` |
| `user/beranda.html` | Profil hardcoded; MAC `8A:3F:1C:9D:44:02`, IP `10.20.30.45`, sandi WiFi `TEFA-TJKT2-2026` ditulis di JS; timer sesi jalan sendiri; "uji kecepatan" pakai `Math.random()`; tiket dibaca dari `localStorage` | ❌ | Tulis ulang `beranda.js` → `GET /siswa/me` |
| `user/keluhan.html` | Submit hanya menyimpan ke `localStorage`, tidak pernah sampai ke admin | ❌ | `POST /keluhan`, buang field nama/kelas |
| `user/riwayat.html` | Membaca `localStorage`, ada tombol "Hapus semua" | ❌ | `GET /keluhan` |

### 2.2 Halaman admin

| Halaman | Yang benar-benar terjadi sekarang | Bisa dipakai? | Yang dibutuhkan |
|---|---|---|---|
| `admin/index.html` + `login.js` | **Login nyata ke API**, pesan error, redirect | ✅ | — |
| `admin/src/scripts/auth-guard.js` | **Cek sesi + role admin**, logout, redirect bila belum login | ✅ | — |
| `admin/dashboard.html` | Angka 320 / 12 / 145 / 5 ditulis mati di HTML; daftar pendaftar, tiket, VLAN, log juga statis | ❌ | `dashboard.js` → `GET /admin/dashboard` |
| `admin/siswa.html` | 11 baris tabel hardcoded; tombol Setujui/Tolak/Detail **tanpa aksi**; kotak cari & filter tidak tersambung | ❌ | `siswa.js` → `GET /admin/siswa`, `PATCH /admin/siswa/:id` |
| `admin/monitoring.html` | Kartu AP & tabel perangkat statis | ❌ | `monitoring.js` (sebagian datanya nanti butuh router) |
| `admin/keluhan.html` | 25 tiket contoh hardcoded; tab Semua/Baru/Diproses/Selesai tidak berfungsi | ❌ | `keluhan.js` → `GET/PATCH /admin/keluhan` |
| `admin/log.html` | Baris log statis | ❌ | `log.js` → `GET /admin/log` |

> Catatan: `admin/login.html` ada tapi kosong/tidak dipakai — halaman login yang aktif adalah `admin/index.html`.

---

## 3. Backend: sudah siap

Sudah teruji (bukan klaim):

- Login/logout/register/`me`, sesi tersimpan di database.
- Approve siswa pending → langsung bisa login.
- Keluhan siswa → muncul di daftar admin.
- Batas 3 perangkat → `422`.
- Tanpa CSRF → `419`, siswa buka endpoint admin → `403`, tanpa login → `401`.
- Login gagal 5× → percobaan ke-6 `429`.
- JSON rusak → `400`, endpoint salah → `404`.
- Header keamanan terpasang; jalur SQLite **dan** MariaDB sama-sama lolos.

Jadi backend **tidak perlu dibongkar**; yang kurang hanya penghubung di frontend.

---

## 4. Fitur yang memang butuh konfigurasi server WiFi / router

Ini bagian yang **tidak bisa** diselesaikan hanya dengan membuat halaman web. Perlu akses ke RouterOS / controller AP / RADIUS.

| Fitur | Kenapa butuh perangkat | Alternatif teknis |
|---|---|---|
| Daftar perangkat yang benar-benar terhubung (MAC/IP) | Web tidak tahu siapa yang tersambung ke AP | DHCP lease / ARP / API controller (MikroTik, UniFi, Omada) |
| Status online & durasi sesi, "terakhir online" | Butuh accounting sesi | RADIUS accounting / controller API |
| Kekuatan sinyal (dBm), SSID/BSSID terpasang | Data hanya ada di AP | Controller API / SNMP |
| Uji kecepatan asli | `Math.random()` bukan pengukuran | Server LibreSpeed / iperf3 |
| Status AP hidup/mati | Web tidak memantau perangkat | SNMP / controller API |
| VLAN per pengguna | Harus diterapkan di switch/AP | RADIUS + VLAN assignment |
| Blokir perangkat di level jaringan | Web hanya bisa menandai di database | MAC filter / ACL / RADIUS |
| Ganti SSID & sandi otomatis | Sekarang hanya tersimpan di tabel `settings` | Controller API |
| Kuota, batas waktu, shaping bandwidth | Harus di router | RADIUS + queue/traffic shaping |
| Login WiFi (captive portal) | Login web **tidak** memberi akses internet | RADIUS + captive portal (CoovaChilli/pfSense) |

**Penting:** aplikasi ini sekarang adalah *sistem administrasi* (pendaftaran, persetujuan, keluhan, log), **bukan** pengendali WiFi. Siswa yang sudah login di web tetap tidak otomatis mendapat internet.

---

## 5. Fitur yang belum ada, tapi TIDAK butuh router

Bisa dikerjakan 100 % di web/backend:

- Admin tambah siswa manual (tombol "Tambah Siswa" sudah ada, endpoint belum).
- Edit / hapus siswa, reset sandi siswa.
- Hapus / ganti perangkat, blokir perangkat (tingkat aplikasi).
- Balasan tiket (tabel `ticket_replies` sudah ada, endpoint belum).
- Halaman pengaturan (SSID, jam akses) — simpan ke DB dulu.
- Lupa sandi / ganti sandi paksa saat login pertama.
- Profil admin, pagination, ekspor CSV.
- Notifikasi realtime (polling atau WebSocket).

---

## 6. Urutan kerja yang disarankan

1. **Sambungkan frontend** (tanpa ini aplikasi belum bisa dipakai):
   - `login.js`, `daftar.js`
   - tulis ulang `beranda.js`, `keluhan.js`, `riwayat.js`
   - `dashboard.js`, `siswa.js`, `monitoring.js`, `keluhan.js`, `log.js` (admin)
2. Uji end-to-end tiap halaman (login → approve → beranda → keluhan → admin).
3. Lengkapi fitur non-router (tambah siswa, balas tiket, pengaturan).
4. Deploy Oracle + domain + HTTPS.
5. Baru terakhir: integrasi router/AP/RADIUS (butuh merk & akses perangkat).

Perkiraan langkah 1–2: 10–14 file JS, bisa diselesaikan dalam satu sesi kerja.
