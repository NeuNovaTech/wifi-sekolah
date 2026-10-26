import { db } from '../src/db.js';
import { User } from '../src/models/user.js';
import { Device } from '../src/models/device.js';
import { Ticket } from '../src/models/ticket.js';
import { Setting } from '../src/models/setting.js';
import { Log } from '../src/models/log.js';
import { nowPlus } from '../src/helpers.js';

// Tanpa --demo: hanya membuat pengaturan + akun admin.
// Dengan --demo (atau SEED_DEMO=true): menambahkan data contoh.
const force = process.argv.includes('--force');
const demo = process.argv.includes('--demo')
  || ['1', 'true', 'yes', 'on'].includes(String(process.env.SEED_DEMO ?? '').toLowerCase());
const existing = await User.count();

if (existing > 0 && !force) {
  console.log(`Database sudah berisi ${existing} akun.`);
  console.log('Gunakan "npm run db:seed -- --force" kalau memang ingin mengulang dari kosong.');
  await db.close?.();
  process.exit(1);
}

if (force) {
  console.log('Menghapus data lama...');

  for (const table of [
    'ticket_replies',
    'tickets',
    'devices',
    'sessions',
    'activity_logs',
    'login_attempts',
    'network_stats',
    'settings',
    'users',
  ]) {
    await db.run(`DELETE FROM ${table}`);
  }

  if (db.driver === 'sqlite') {
    try {
      await db.run('DELETE FROM sqlite_sequence');
    } catch {
      /* tabel sqlite_sequence belum ada */
    }
  }
}

function jamLalu(detik) {
  return nowPlus(-Number(detik));
}

// ------------------------------------------------------------
// Pengaturan jaringan
// ------------------------------------------------------------
await Setting.set('wifi_ssid', 'WIFI-SMKN1-SUSUKAN');
await Setting.set('wifi_password', 'TEFA-TJKT2-2026');
await Setting.set('kapasitas_jaringan', '55');
await Setting.set('jam_akses', '06:00-17:00');

// ------------------------------------------------------------
// Akun admin
// ------------------------------------------------------------
const adminId = await User.create({
  nipd: 'admin',
  nama: 'Administrator',
  email: 'admin@smkn1susukan.sch.id',
  no_hp: '081200000000',
  kelas: '-',
  jurusan: 'ADMIN',
  role: 'admin',
  status: 'aktif',
  password: 'admin123',
});

// ------------------------------------------------------------
// Mode default: berhenti di sini (hanya admin, tanpa data contoh)
// ------------------------------------------------------------
if (!demo) {
  console.log('');
  console.log('====================================================');
  console.log(' Database siap: pengaturan + akun admin saja');
  console.log('----------------------------------------------------');
  console.log(' Admin : NIPD "admin" / sandi "admin123"');
  console.log(' Data contoh (24 siswa, perangkat, tiket):');
  console.log('   npm run db:seed -- --demo');
  console.log('====================================================');
  console.log(' GANTI SANDI ADMIN SEBELUM DIPAKAI!');
  console.log('====================================================');

  await db.close?.();
  process.exit(0);
}

// ------------------------------------------------------------
// Akun siswa contoh (24 siswa, 4 masih menunggu persetujuan)
// ------------------------------------------------------------
const daftarSiswa = [
  ['1234', 'Noval Hamdan', 'noval@example.com', '0857-4321-1234', 'X TJKT 2', 'aktif', 0],
  ['1235', 'Amar', 'amar@example.com', '0857-1111-2222', 'X TJKT 1', 'pending', 0],
  ['1236', 'Siti Nur Aisyah', 'siti@example.com', '0857-2222-3333', 'X TO 1', 'pending', 0],
  ['1237', 'Bagas Pratama', 'bagas@example.com', '0857-3333-4444', 'X DITF', 'aktif', 1],
  ['1238', 'Rina Wulandari', 'rina@example.com', '0857-4444-5555', 'XI KKBT', 'aktif', 1],
  ['1239', 'Yusuf Maulana', 'yusuf@example.com', '0857-5555-6666', 'XI TJKT 1', 'aktif', 2],
  ['1240', 'Alya Putri', 'alya@example.com', '0857-6666-7777', 'X TJKT 1', 'aktif', 2],
  ['1241', 'Dimas Saputra', 'dimas@example.com', '0857-7777-8888', 'X TJKT 2', 'aktif', 2],
  ['1242', 'Nabila Zahra', 'nabila@example.com', '0857-8888-9999', 'XI TJKT 2', 'aktif', 3],
  ['1243', 'Fajar Nugroho', 'fajar@example.com', '0857-9999-0000', 'X TO 2', 'aktif', 3],
  ['1244', 'Intan Permata', 'intan@example.com', '0812-1111-2222', 'X DITF', 'aktif', 3],
  ['1245', 'Rizky Ramadhan', 'rizky@example.com', '0812-2222-3333', 'XI TJKT 1', 'aktif', 4],
  ['1246', 'Dea Lestari', 'dea@example.com', '0812-3333-4444', 'XI KKBT', 'aktif', 4],
  ['1247', 'Arif Setiawan', 'arif@example.com', '0812-4444-5555', 'X TJKT 2', 'aktif', 4],
  ['1248', 'Putri Maharani', 'putri@example.com', '0812-5555-6666', 'XI TO 1', 'aktif', 5],
  ['1249', 'Hendra Wijaya', 'hendra@example.com', '0812-6666-7777', 'X TJKT 1', 'aktif', 5],
  ['1250', 'Maya Sari', 'maya@example.com', '0812-7777-8888', 'X TO 1', 'aktif', 5],
  ['1251', 'Bima Aditya', 'bima@example.com', '0812-8888-9999', 'XI DITF', 'aktif', 6],
  ['1252', 'Laras Ayu', 'laras@example.com', '0812-9999-0000', 'XI TJKT 2', 'aktif', 6],
  ['1253', 'Galih Prakoso', 'galih@example.com', '0858-1111-2222', 'X KKBT', 'aktif', 6],
  ['1254', 'Salsa Nabila', 'salsa@example.com', '0858-2222-3333', 'X TJKT 1', 'pending', 0],
  ['1255', 'Rangga Pratama', 'rangga@example.com', '0858-3333-4444', 'XI TO 2', 'aktif', 6],
  ['1256', 'Wulan Sari', 'wulan@example.com', '0858-4444-5555', 'X TO 2', 'pending', 0],
  ['1257', 'Tegar Firmansyah', 'tegar@example.com', '0858-5555-6666', 'XI TJKT 1', 'aktif', 6],
];

const siswaIds = {};

for (const [nipd, nama, email, noHp, kelas, status, hariLalu] of daftarSiswa) {
  const dibuat = jamLalu(Number(hariLalu) * 86400 + 3600 + (Number(nipd) % 7) * 900);

  const id = await User.create({
    nipd,
    nama,
    email,
    no_hp: noHp,
    kelas,
    status,
    role: 'siswa',
    password: 'siswa123',
    approved_by: status === 'aktif' ? adminId : null,
    approved_at: status === 'aktif' ? dibuat : null,
  });

  await db.run('UPDATE users SET created_at = ?, updated_at = ? WHERE id = ?', [dibuat, dibuat, id]);

  siswaIds[nipd] = id;
}

// ------------------------------------------------------------
// Perangkat contoh (22 perangkat, tersebar di 5 VLAN)
// ------------------------------------------------------------
const perangkat = [
  ['1234', 'Vivo Y22', 'Android 12, 2.4 GHz', '8A:3F:1C:9D:44:02', 20, 2],
  ['1234', 'Laptop Acer Aspire', 'Windows 11, 5 GHz', '3C:52:82:11:9A:01', 20, 35],
  ['1237', 'Redmi 9A', 'Android 11, 2.4 GHz', 'B2:11:7A:0C:55:19', 40, 15],
  ['1238', 'iPhone 11', 'iOS 17, 5 GHz', '9C:4E:20:AA:31:80', 30, 45],
  ['1239', 'Samsung A15', 'Android 14, 5 GHz', 'D8:3A:DD:44:10:77', 30, 7],
  ['1240', 'Oppo A58', 'Android 13, 2.4 GHz', '5C:1D:3A:7B:22:10', 20, 4],
  ['1241', 'Infinix Hot 30', 'Android 13, 2.4 GHz', 'A4:5E:60:11:8C:23', 20, 18],
  ['1242', 'Xiaomi 13T', 'Android 14, 5 GHz', 'F0:9F:FC:2A:33:41', 30, 3],
  ['1243', 'Realme C53', 'Android 13, 2.4 GHz', '4C:22:50:9D:71:08', 40, 26],
  ['1244', 'Laptop Lenovo IdeaPad', 'Windows 10, 5 GHz', 'E8:6A:64:10:52:77', 30, 52],
  ['1245', 'Vivo Y36', 'Android 13, 5 GHz', '74:23:44:B1:60:29', 20, 11],
  ['1246', 'iPhone 12', 'iOS 16, 5 GHz', 'AC:7B:A1:33:0D:64', 10, 30],
  ['1247', 'Samsung M14', 'Android 13, 2.4 GHz', '34:8A:12:6F:99:05', 20, 5],
  ['1248', 'Redmi Note 12', 'Android 13, 5 GHz', '90:2E:1C:47:AA:18', 40, 22],
  ['1249', 'Asus Zenfone 9', 'Android 13, 5 GHz', '08:3A:5C:71:3E:90', 20, 48],
  ['1250', 'Oppo Reno 8', 'Android 14, 5 GHz', '1C:64:60:2E:8B:47', 40, 9],
  ['1251', 'Laptop HP Pavilion', 'Windows 11, 5 GHz', 'B0:5A:DA:73:16:CC', 30, 70],
  ['1252', 'Realme 10', 'Android 12, 2.4 GHz', 'F4:8C:50:6A:2D:81', 30, 13],
  ['1253', 'Infinix Note 12', 'Android 12, 2.4 GHz', 'D4:9C:28:55:F0:36', 10, 38],
  ['1255', 'Xiaomi Redmi 12', 'Android 13, 2.4 GHz', 'A8:9C:ED:60:14:72', 40, 6],
  ['1257', 'Poco X5', 'Android 13, 5 GHz', '7C:5C:F8:33:91:0A', 20, 28],
  ['1242', 'Tablet Samsung Tab A8', 'Android 12, 5 GHz', 'C8:3A:35:9B:42:17', 30, 64],
];

for (const [nipd, nama, tipe, mac, vlan, menitLalu] of perangkat) {
  await Device.create({
    userId: siswaIds[nipd],
    nama,
    tipe,
    mac,
    ip: null,
    ssid: 'WIFI-SMKN1-SUSUKAN',
    vlan,
  });

  await db.run('UPDATE devices SET last_seen = ?, terdaftar_at = ? WHERE mac = ?', [
    jamLalu(menitLalu * 60),
    jamLalu((menitLalu + 600) * 60),
    mac,
  ]);
}

// ------------------------------------------------------------
// Tiket contoh + balasan
// ------------------------------------------------------------
const daftarTiket = [
  ['1234', 'koneksi', 'WiFi di lab TJKT lemot kalau dipakai 30 orang sekaligus.', 'diproses', 2],
  ['1235', 'kecepatan', 'Koneksi putus nyambung tiap 5 menit sejak pagi.', 'menunggu', 1],
  ['1238', 'perangkat', 'HP tidak dapat IP walaupun sudah daftar ulang.', 'diproses', 5],
  ['1240', 'akun', 'Akun sudah disetujui tetapi tidak bisa login di HP baru.', 'selesai', 26],
  ['1241', 'koneksi', 'Sinyal WiFi lemah di ruang X TJKT 2, sering hanya 1 bar.', 'menunggu', 3],
  ['1243', 'kecepatan', 'Download lambat saat jam istirahat, upload normal.', 'selesai', 30],
  ['1244', 'perangkat', 'Laptop tidak muncul di daftar perangkat saya.', 'menunggu', 4],
  ['1246', 'lain', 'Minta bantuan ganti nomor HP yang terdaftar.', 'selesai', 50],
  ['1247', 'koneksi', 'Tidak bisa membuka halaman sekolah dari WiFi.', 'menunggu', 2],
  ['1249', 'akun', 'Lupa kata sandi, mohon dibantu reset.', 'menunggu', 7],
  ['1251', 'kecepatan', 'Zoom putus-putus saat pembelajaran daring.', 'diproses', 8],
  ['1252', 'perangkat', 'Mau menambah perangkat ketiga, apakah boleh?', 'selesai', 55],
];

const tiketIds = [];

for (const [nipd, kategori, isi, status, jamOffset] of daftarTiket) {
  const tiket = await Ticket.create({
    userId: siswaIds[nipd],
    kategori,
    isi,
  });

  const dibuat = jamLalu(jamOffset * 3600);

  await db.run('UPDATE tickets SET created_at = ?, updated_at = ? WHERE id = ?', [
    dibuat,
    dibuat,
    tiket.id,
  ]);

  if (status !== 'menunggu') {
    await Ticket.updateStatus(tiket.id, status, adminId);
  }

  tiketIds.push(tiket.id);
}

await Ticket.addReply(tiketIds[0], adminId, 'Terima kasih laporannya. Kami cek beban AP lab TJKT 1 sore ini.');
await Ticket.addReply(tiketIds[0], siswaIds['1234'], 'Baik pak, nanti saya coba lagi setelah pulang sekolah.');
await Ticket.addReply(tiketIds[2], adminId, 'Perangkat sudah kami daftarkan ulang. Silakan matikan lalu nyalakan WiFi HP.');
await Ticket.addReply(tiketIds[3], adminId, 'Akun sudah aktif. Coba login ulang dan hapus cache browser.');
await Ticket.addReply(tiketIds[5], adminId, 'Kami batasi unduhan besar saat jam istirahat. Coba lagi di luar jam itu.');

// ------------------------------------------------------------
// Riwayat statistik jaringan (12 jam terakhir, tiap 30 menit)
// ------------------------------------------------------------
for (let i = 23; i >= 0; i -= 1) {
  const gelombang = Math.sin((23 - i) / 3) * 6;

  await db.run(
    `INSERT INTO network_stats
      (recorded_at, ap_aktif, ap_down, total_perangkat, bandwidth_mbps, kapasitas_persen, vlan_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      jamLalu(i * 1800),
      13,
      i % 9 === 0 ? 1 : 0,
      Math.round(94 + gelombang),
      Number((205 + gelombang * 4.5).toFixed(1)),
      Math.round(58 + gelombang),
      JSON.stringify({ 10: 2, 20: 12, 30: 5, 40: 4, 50: 0 }),
    ],
  );
}

// ------------------------------------------------------------
// Log contoh
// ------------------------------------------------------------
await Log.add(adminId, 'seed', 'Data contoh berhasil dibuat', null);
await Log.add(adminId, 'ubah_status_tiket', `Tiket T-0001 diubah ke diproses`, null);
await Log.add(siswaIds['1234'], 'kirim_keluhan', 'Tiket T-0001 (koneksi)', null);
await Log.add(adminId, 'ubah_status_siswa', 'Menyetujui akun Bagas Pratama', null);
await Log.add(siswaIds['1240'], 'login', 'Login berhasil', null);
await Log.add(adminId, 'ubah_status_tiket', 'Tiket T-0004 ditandai selesai', null);
await Log.add(siswaIds['1252'], 'tambah_perangkat', 'Perangkat Realme 10 ditambahkan', null);

console.log('');
console.log('====================================================');
console.log(' Data contoh berhasil dibuat');
console.log('----------------------------------------------------');
console.log(' Admin  : NIPD "admin" / sandi "admin123"');
console.log(' Siswa  : NIPD "1234"  / sandi "siswa123" (aktif)');
console.log(' Siswa  : NIPD "1235"  / sandi "siswa123" (pending)');
console.log(` Isi    : ${daftarSiswa.length} siswa, ${perangkat.length} perangkat,`);
console.log(`          ${daftarTiket.length} tiket, 24 riwayat jaringan`);
console.log('====================================================');
console.log(' GANTI SANDI INI SEBELUM DIPAKAI DI SEKOLAH!');
console.log('====================================================');

await db.close?.();
