# Cara Deploy — Oracle Cloud Always Free + DuckDNS

> Hasil akhir: **https://nama.duckdns.org** — gratis, HTTPS otomatis, data permanen.
> Perkiraan waktu: 45–90 menit (pertama kali).
> Biaya: **Rp 0** selama tetap di batas Always Free.

---

## 0. Yang perlu disiapkan

- Akun **Oracle Cloud** (daftar di <https://cloud.oracle.com/free>; kartu hanya untuk verifikasi, Always Free tidak ditagih).
- Akun **DuckDNS** (<https://www.duckdns.org> — login pakai Google/GitHub).
- Folder project ini (dari Google Drive).
- Terminal di komputer (Linux/macOS) atau **PowerShell** di Windows (punya `ssh` & `scp`).

---

## 1. Buat VM di Oracle

1. Masuk **Oracle Cloud Console** → **Compute → Instances → Create instance**.
2. Isi:
   - **Name**: `wifi-sekolah`
   - **Image**: **Canonical Ubuntu 24.04** (atau 22.04)
   - **Shape**: **VM.Standard.A1.Flex** → **2 OCPU / 12 GB** (Always Free)
   - **Boot volume**: 100 GB
   - **Public IP**: pastikan **Assign a public IPv4 address** aktif
   - **SSH keys**: pilih **Generate a key pair** → **download private key** (`.key`)
3. Klik **Create**. Tunggu status **Running**.
4. Catat **Public IP address**.

> Kalau muncul **"Out of capacity"** untuk A1: coba **Availability Domain** lain (AD-2/AD-3), atau pakai **VM.Standard.E2.1.Micro** (AMD, 1 OCPU/1 GB) dengan image Ubuntu x86_64.

### Reservasi IP (disarankan)
**Networking → Reserved public IPs → Create**, lalu **Assign** ke instance. Supaya IP tidak berubah saat instance restart.

---

## 2. Buka port 80 & 443

### a. Di Oracle Console
**Networking → Virtual Cloud Networks → [VCN] → Security Lists → Default Security List → Add Ingress Rules**:

| Source | Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

Untuk SSH (22), sebaiknya **hanya IP kamu**, bukan `0.0.0.0/0`.

### b. Di dalam VM (iptables)
Setelah SSH masuk (langkah 3), jalankan:

```bash
sudo apt-get update
sudo apt-get install -y iptables-persistent
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 3. Masuk ke VM

Di komputer kamu:

```bash
chmod 600 ssh-key-....key
ssh -i ssh-key-....key ubuntu@IP_VM
```

> User default image Ubuntu Oracle adalah `ubuntu`.

---

## 4. Pasang Node.js 20, Caddy, SQLite

```bash
sudo apt-get update && sudo apt-get upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3 git build-essential python3
node -v    # harus v20.x

# Caddy (HTTPS otomatis)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

---

## 5. Unggah project

Dari komputer kamu (folder induk project):

```bash
ssh -i ssh-key-....key ubuntu@IP_VM \
  "sudo mkdir -p /var/www/wifi && sudo chown ubuntu:ubuntu /var/www/wifi"

rsync -av --exclude node_modules --exclude api/storage/database.sqlite* \
  ./ ubuntu@IP_VM:/var/www/wifi/
```

Kalau tidak punya `rsync`, gunakan `scp -r`:

```bash
scp -i ssh-key-....key -r ./ ubuntu@IP_VM:/var/www/wifi/
```

Alternatif: push ke GitHub, lalu di VM:

```bash
git clone https://github.com/USERNAME/wifi-sekolah.git /var/www/wifi
```

---

## 6. Konfigurasi & uji

```bash
cd /var/www/wifi/api

cp ../deploy/env.production.contoh .env
nano .env
```

Isi penting:

```env
APP_ENV=production
APP_DEBUG=false
APP_TIMEZONE=Asia/Jakarta

PORT=8090
HOST=127.0.0.1
SERVE_STATIC=true
TRUST_PROXY=true

DB_DRIVER=sqlite
DB_SQLITE_PATH=./storage/database.sqlite

SESSION_NAME=WIFI_SESSID
SESSION_LIFETIME=7200
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
```

Lalu:

```bash
mkdir -p storage
npm install --omit=dev
npm run db:install
npm run db:seed        # hanya sekali, membuat akun admin awal
npm start              # uji; tekan Ctrl+C setelah muncul "API : ..."
```

Di terminal lain:

```bash
curl http://127.0.0.1:8090/api/health
```

Harus muncul JSON `{"success":true,...}`.

---

## 7. Jalankan sebagai layanan (systemd)

```bash
# user khusus service
sudo groupadd --system wifi 2>/dev/null || true
sudo useradd --system --gid wifi --home /var/www/wifi \
  --shell /usr/sbin/nologin wifi 2>/dev/null || true

# izin baca kode & tulis storage
sudo chmod -R a+rX /var/www/wifi
sudo chown -R wifi:wifi /var/www/wifi/api/storage

# .env harus bisa dibaca user wifi, tapi tidak semua orang
sudo chown root:wifi /var/www/wifi/api/.env
sudo chmod 640 /var/www/wifi/api/.env

# pasang service
sudo cp /var/www/wifi/deploy/wifi-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wifi-api
sudo systemctl status wifi-api --no-pager
```

Cek log kalau gagal:

```bash
sudo journalctl -u wifi-api -n 50 --no-pager
```

---

## 8. DuckDNS

1. Login <https://www.duckdns.org>.
2. Buat subdomain, misal `wifi-smkn1` → jadi **`wifi-smkn1.duckdns.org`**.
3. Isi **current IP** dengan **Public IP VM Oracle**, klik **update ip**.
4. Cek dari VM:

```bash
dig +short wifi-smkn1.duckdns.org
```

Harus mengembalikan IP VM.

> Kalau IP VM berubah (tidak reservasi), pasang updater otomatis:
> ```bash
> mkdir -p ~/duckdns
> cat > ~/duckdns/duck.sh <<'EOF'
> echo url="https://www.duckdns.org/update?domains=wifi-smkn1&token=TOKEN_DUCKDNS&ip=" | curl -k -o ~/duckdns/duck.log -K -
> EOF
> chmod 700 ~/duckdns/duck.sh
> (crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
> ```

---

## 9. HTTPS dengan Caddy

Edit **`/etc/caddy/Caddyfile`**:

```bash
sudo nano /etc/caddy/Caddyfile
```

Isi:

```caddyfile
wifi-smkn1.duckdns.org {
    encode gzip

    header {
        X-Content-Type-Options nosniff
        Referrer-Policy no-referrer
        -Server
    }

    reverse_proxy 127.0.0.1:8090
}
```

Lalu:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy otomatis mengambil sertifikat Let's Encrypt. Cek:

```bash
curl -I https://wifi-smkn1.duckdns.org/api/health
```

Buka di browser:

- **https://wifi-smkn1.duckdns.org/user/**
- **https://wifi-smkn1.duckdns.org/admin/**

Login: `admin` / `admin123` → **segera ganti sandi** di menu Pengaturan.

---

## 10. Setelah online

### Ganti sandi & data demo
- Admin: **Pengaturan → Keamanan Akun Admin**.
- Siswa contoh `1234`/`siswa123`: ganti atau hapus.
- SSID/sandi WiFi di **Pengaturan** (baru berlaku setelah terhubung ke router).

### Backup harian
```bash
mkdir -p /home/ubuntu/backup
crontab -e
```

Tambahkan:

```cron
0 1 * * * sqlite3 /var/www/wifi/api/storage/database.sqlite "VACUUM INTO '/home/ubuntu/backup/wifi-$(date +\%F).sqlite'" && find /home/ubuntu/backup -name 'wifi-*.sqlite' -mtime +30 -delete
```

### Hardening SSH
```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
sudo apt-get install -y fail2ban
```

> Jangan aktifkan UFW dan iptables bersamaan. Panduan ini memakai iptables + Security List Oracle.

### Monitoring gratis
- **UptimeRobot** → HTTP check `https://domain/api/health` tiap 5 menit.
- **Oracle Alarms** → CPU/RAM/disk.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `502 Bad Gateway` | Service Node mati. `sudo journalctl -u wifi-api -n 50` |
| Sertifikat Caddy gagal | DNS belum mengarah ke IP. `dig +short domain`, cek port 80/443 |
| Login berhasil lalu logout sendiri | `TRUST_PROXY=true` belum aktif |
| `SQLITE_BUSY` | Ada dua proses Node. Hentikan `npm start` sebelum systemd |
| `EACCES` saat tulis database | `storage` belum milik `wifi`: `sudo chown -R wifi:wifi api/storage` |
| `better-sqlite3` gagal build | `sudo apt install -y build-essential python3` lalu `npm rebuild` |
| Halaman admin kosong | `/api` tidak diteruskan Caddy, atau service mati |
| VM ARM out of capacity | Coba AD lain atau shape `E2.1.Micro` |

---

## Checklist

- [ ] VM Running & Public IP dicatat
- [ ] Port 80/443 terbuka di Security List **dan** iptables
- [ ] `curl localhost:8090/api/health` sukses
- [ ] `systemctl status wifi-api` aktif
- [ ] DuckDNS mengarah ke IP VM
- [ ] HTTPS aktif (gembok)
- [ ] Sandi admin sudah diganti
- [ ] Backup harian dibuat
- [ ] SSH password login dimatikan
