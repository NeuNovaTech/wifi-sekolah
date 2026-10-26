# Panduan Pasang Gratis — Web Sistem WiFi Sekolah

Aplikasi ini terdiri dari:

- **Node.js 20** (Express) yang melayani API **dan** file web sekaligus.
- **SQLite** sebagai database (satu file di `api/storage/database.sqlite`).
- Tidak butuh MySQL, tidak butuh router WiFi untuk berjalan.

Karena memakai SQLite, server harus punya **disk permanen**. Ini penting: kalau
disk-nya terhapus setiap deploy (seperti kebanyakan hosting gratis), semua data
siswa dan keluhan ikut hilang.

---

## Pilihan 1 — Oracle Cloud Always Free (disarankan, gratis permanen)

Oracle Cloud punya VM gratis selamanya (Always Free), disk permanen, dan cukup
untuk aplikasi ini. Ini pilihan paling aman untuk data sekolah.

### 1. Buat VM

1. Daftar di <https://cloud.oracle.com/free> (perlu kartu untuk verifikasi,
   tapi tidak ditagih selama memakai sumber daya Always Free).
2. Buat **Compute Instance**:
   - Image: **Ubuntu 22.04**
   - Shape: **VM.Standard.E2.1.Micro** (AMD, Always Free) atau
     **VM.Standard.A1.Flex** (ARM, 1 OCPU / 6 GB, Always Free).
3. Unduh SSH key saat membuat instance.
4. Catat **Public IP** VM.

### 2. Buka port 80 dan 443

Di Oracle: **Networking → Virtual Cloud Networks → Security Lists → Default
Security List → Add Ingress Rules**:

- Source `0.0.0.0/0`, protocol TCP, destination port **80**
- Source `0.0.0.0/0`, protocol TCP, destination port **443**

Di dalam VM:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3. Pasang Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3
node -v   # harus v20.x
```

### 4. Unggah aplikasi

Dari komputer lokal (folder induk project):

```bash
rsync -av --exclude node_modules --exclude api/storage/database.sqlite* \
  ./ ubuntu@IP_VM:/home/ubuntu/wifi/
```

Atau pakai `scp -r`, GitHub, atau Google Drive di VM.

Di VM:

```bash
cd /home/ubuntu/wifi/api
npm install --omit=dev
cp ../deploy/env.production.contoh .env
nano .env               # isi PORT, HOST, dan sesuaikan
npm run db:install
npm run db:seed         # hanya sekali, untuk akun admin awal
npm start               # uji dulu, tekan Ctrl+C setelah muncul "API : ..."
```

Buka `http://IP_VM:8090/api/health` dari browser. Kalau muncul JSON `success`,
lanjut.

### 5. Jalankan sebagai layanan (systemd)

```bash
sudo useradd --system --home /home/ubuntu/wifi --shell /usr/sbin/nologin wifi || true
sudo chown -R ubuntu:ubuntu /home/ubuntu/wifi
sudo cp /home/ubuntu/wifi/deploy/wifi-api.service /etc/systemd/system/
sudo nano /etc/systemd/system/wifi-api.service   # sesuaikan User, Group, WorkingDirectory
sudo systemctl daemon-reload
sudo systemctl enable --now wifi-api
sudo systemctl status wifi-api
```

### 6. Domain gratis + HTTPS

Pilih salah satu domain gratis:

| Layanan | Contoh | Catatan |
|---|---|---|
| DuckDNS | `wifismkn1.duckdns.org` | Paling mudah, gratis, bisa update IP otomatis |
| FreeDNS (afraid.org) | `nama.mooo.com` | Banyak pilihan domain |
| nic.eu.org | `nama.eu.org` | Domain gratis, proses manual beberapa hari |
| Cloudflare + domain murah | `wifi.sekolah.sch.id` | Domain .sch.id berbayar, DNS-nya gratis |

**DuckDNS (paling cepat):**

1. Login <https://www.duckdns.org>, buat subdomain, isi IP VM.
2. Pasang Caddy untuk HTTPS otomatis:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```caddyfile
wifismkn1.duckdns.org {
    encode gzip
    reverse_proxy 127.0.0.1:8090
}
```

```bash
sudo systemctl reload caddy
```

Caddy akan mengurus sertifikat HTTPS otomatis. Buka
`https://wifismkn1.duckdns.org/user/`.

> Kalau memakai Nginx + Certbot, contoh konfigurasi sudah tersedia di
> `deploy/nginx-wifi.conf`. Ingat: dengan Nginx, set `SERVE_STATIC=false` dan
> arahkan root ke folder project, lalu proxy `/api/` ke `127.0.0.1:8090`.
> Dengan Caddy, biarkan `SERVE_STATIC=true` agar Express melayani semuanya.

### 7. Backup database (penting)

Buat cron harian:

```bash
mkdir -p /home/ubuntu/backup
crontab -e
```

Tambahkan:

```cron
0 1 * * * sqlite3 /home/ubuntu/wifi/api/storage/database.sqlite "VACUUM INTO '/home/ubuntu/backup/wifi-$(date +\%F).sqlite'" && find /home/ubuntu/backup -name 'wifi-*.sqlite' -mtime +30 -delete
```

Simpan salinan backup ke Google Drive / komputer lain minimal seminggu sekali.

---

## Pilihan 2 — Render / Railway (untuk demo cepat)

Kelebihan: tidak perlu mengurus server. Kekurangan: **disk gratis biasanya
sementara**, jadi database SQLite bisa kembali ke kondisi awal setiap deploy
atau saat layanan tidur.

Cocok untuk **mencoba tampilan**, bukan untuk data sungguhan.

Langkah singkat di Render:

1. Push project ke GitHub.
2. Render → **New → Web Service** → pilih repo.
3. Runtime: **Docker** (pakai `Dockerfile` di root project).
4. Environment:
   - `PORT=8090`
   - `HOST=0.0.0.0`
   - `SERVE_STATIC=true`
   - `APP_DEBUG=false`
   - `TRUST_PROXY=true`
   - `DB_DRIVER=sqlite`
   - `DB_SQLITE_PATH=./storage/database.sqlite`
5. Setelah deploy, buka Shell dan jalankan:

```bash
cd api && npm run db:install && npm run db:seed
```

6. Domain gratis otomatis: `nama-app.onrender.com`.

Kalau ingin data permanen di Render, tambahkan **Persistent Disk** (berbayar)
dan mount ke `/app/api/storage`, atau pindah database ke layanan seperti Turso
(perlu penyesuaian kode).

---

## Checklist sebelum dipakai sungguhan

- [ ] Ganti sandi admin bawaan `admin123` di **Pengaturan → Keamanan Akun Admin**.
- [ ] Ganti sandi siswa contoh (`1234`/`siswa123`, dst.) atau hapus data seed.
- [ ] `APP_DEBUG=false` di `.env`.
- [ ] `TRUST_PROXY=true` bila di belakang Nginx/Caddy.
- [ ] HTTPS aktif (gembok di browser).
- [ ] Backup otomatis berjalan dan pernah diuji restore.
- [ ] `storage/` tidak bisa diakses langsung dari browser (sudah dicegah oleh
      Express, tetapi pastikan Nginx tidak menyajikan folder itu).
- [ ] Ubah SSID/sandi WiFi di halaman **Pengaturan** (baru berlaku setelah
      terhubung ke router, lihat bagian berikut).

---

## Yang belum bisa dilakukan tanpa router

Aplikasi ini adalah **sistem administrasi** (pendaftaran, persetujuan,
keluhan, monitoring data perangkat, log). Login di web **tidak** otomatis
memberi akses internet ke HP siswa.

Supaya benar-benar mengatur akses WiFi, nanti perlu:

- Router MikroTik / controller AP / RADIUS (mis. FreeRADIUS).
- Captive portal (CoovaChilli / pfSense) atau integrasi API router.
- Webhook/API dari router ke aplikasi ini.

Sampai tahap itu, web tetap berguna untuk pendataan, persetujuan akun, dan
penanganan keluhan.
