/**
 * Simulator jaringan sekolah.
 *
 * Dipakai selama router/controller AP belum bisa diakses. Angka yang
 * dihasilkan masuk akal (mengikuti jam sekolah) dan stabil dalam satu
 * bucket waktu, sehingga halaman tidak "melompat" setiap request.
 *
 * Modul ini TIDAK menulis ke database. Saat integrasi router siap, cukup
 * ganti NETWORK_SOURCE=router lalu isi modul pembaca perangkat asli.
 */
import { createHash } from 'node:crypto';
import { pad } from '../helpers.js';

const BUCKET_MS = 5 * 60 * 1000;

/** Access point contoh khas SMK: lab, kelas, kantor, fasilitas umum. */
const DAFTAR_AP = [
  { nama: 'AP-Lab TJKT 1', lokasi: 'Lab TJKT 1', vlan: 20, bobot: 1.6 },
  { nama: 'AP-Lab TJKT 2', lokasi: 'Lab TJKT 2', vlan: 20, bobot: 1.4 },
  { nama: 'AP-Lab TO', lokasi: 'Lab TO', vlan: 40, bobot: 1.1 },
  { nama: 'AP-Kelas X TJKT 1', lokasi: 'Ruang X TJKT 1', vlan: 20, bobot: 1.0 },
  { nama: 'AP-Kelas X TJKT 2', lokasi: 'Ruang X TJKT 2', vlan: 20, bobot: 1.0 },
  { nama: 'AP-Kelas XI TJKT 1', lokasi: 'Ruang XI TJKT 1', vlan: 20, bobot: 0.9 },
  { nama: 'AP-Kelas XI TO 1', lokasi: 'Ruang XI TO 1', vlan: 40, bobot: 0.9 },
  { nama: 'AP-Kelas X DITF', lokasi: 'Ruang X DITF', vlan: 30, bobot: 0.8 },
  { nama: 'AP-Kelas XI KKBT', lokasi: 'Ruang XI KKBT', vlan: 10, bobot: 0.8 },
  { nama: 'AP-Perpustakaan', lokasi: 'Perpustakaan', vlan: 30, bobot: 0.7 },
  { nama: 'AP-Aula', lokasi: 'Aula', vlan: 30, bobot: 0.6 },
  { nama: 'AP-Kantor Guru', lokasi: 'Ruang Guru', vlan: 50, bobot: 0.7 },
  { nama: 'AP-Ruang TU', lokasi: 'Tata Usaha', vlan: 50, bobot: 0.5 },
  { nama: 'AP-Kantin', lokasi: 'Kantin', vlan: 30, bobot: 0.6 },
];

function hash32(text) {
  return createHash('sha256').update(String(text)).digest().readUInt32BE(0);
}

/** PRNG deterministik kecil (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;

  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bucketOf(when) {
  return Math.floor(when.getTime() / BUCKET_MS);
}

/** Kurva pemakaian WiFi sepanjang hari (0..1). */
function kurva(jam) {
  if (jam < 5) return 0.04;
  if (jam < 6) return 0.08;
  if (jam < 7) return 0.22;
  if (jam < 9) return 0.72;
  if (jam < 12) return 0.86;
  if (jam < 13) return 0.46;
  if (jam < 15) return 0.9;
  if (jam < 17) return 0.42;
  if (jam < 19) return 0.16;
  return 0.06;
}

function waktuLokal(when) {
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} `
    + `${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}`;
}

function ipUntuk(vlan, mac) {
  const vlanNum = Number(vlan) || 30;
  const host = (hash32(mac) % 200) + 20;

  return `10.20.${vlanNum}.${host}`;
}

/**
 * Snapshot kondisi jaringan pada waktu tertentu.
 *
 * @param {{ totalDevices?: number, when?: Date }} opsi
 */
export function snapshot({ totalDevices = 0, when = new Date() } = {}) {
  const bucket = bucketOf(when);
  const rand = rng(hash32(`jaringan-${bucket}`));
  const jam = when.getHours() + when.getMinutes() / 60;
  const rasio = Math.min(0.96, kurva(jam) * (0.9 + rand() * 0.2));

  // Klien aktif di seluruh jaringan (termasuk perangkat yang belum mendaftar).
  const totalKlien = Math.max(0, Math.round(150 * rasio * (0.9 + rand() * 0.2)));

  // Perangkat terdaftar yang sedang online (subset dari data siswa).
  const perangkatOnline = Math.min(
    Number(totalDevices) || 0,
    Math.round((Number(totalDevices) || 0) * rasio * 0.9),
  );

  // Sesekali satu AP bermasalah supaya panel "AP down" tidak selalu nol.
  const adaGangguan = rand() < 0.18;
  const apGangguan = adaGangguan ? Math.floor(rand() * DAFTAR_AP.length) : -1;

  const aktif = DAFTAR_AP
    .map((ap, index) => ({ ...ap, index }))
    .filter((ap) => ap.index !== apGangguan);

  const bobotTotal = aktif.reduce((total, ap) => total + ap.bobot, 0) || 1;

  const ap = DAFTAR_AP.map((item, index) => {
    if (index === apGangguan) {
      return {
        nama: item.nama,
        lokasi: item.lokasi,
        vlan: item.vlan,
        status: 'down',
        klien: 0,
        beban: 0,
        uptime_jam: 0,
        terakhir_online: waktuLokal(new Date(when.getTime() - (10 + Math.floor(rand() * 50)) * 60000)),
      };
    }

    const klien = Math.round((totalKlien * item.bobot) / bobotTotal);
    const beban = Math.min(99, Math.round((klien / 24) * 100));

    return {
      nama: item.nama,
      lokasi: item.lokasi,
      vlan: item.vlan,
      status: 'aktif',
      klien,
      beban,
      uptime_jam: 18 + (hash32(item.nama + bucket) % 460),
      terakhir_online: waktuLokal(when),
    };
  });

  const bandwidth = Number((totalKlien * (1.9 + rand() * 1.1)).toFixed(1));
  const kapasitas = Math.min(98, Math.round((totalKlien / 160) * 100));

  return {
    mode: 'simulasi',
    dicatat_pada: waktuLokal(when),
    ap_aktif: ap.filter((item) => item.status === 'aktif').length,
    ap_down: ap.filter((item) => item.status === 'down').length,
    total_klien: totalKlien,
    pengguna_online: perangkatOnline,
    total_perangkat: Number(totalDevices) || 0,
    bandwidth_mbps: bandwidth,
    kapasitas_persen: kapasitas,
    ap,
  };
}

/** Status online satu perangkat (deterministik per bucket 5 menit). */
export function perangkatOnline(mac, when = new Date()) {
  const jam = when.getHours() + when.getMinutes() / 60;
  const rand = rng(hash32(`perangkat-${String(mac)}-${bucketOf(when)}`));

  return rand() < Math.min(0.95, kurva(jam) * 0.95);
}

/** IP contoh untuk perangkat yang belum punya IP dari DHCP. */
export function ipSimulasi(vlan, mac) {
  return ipUntuk(vlan, mac);
}

/** Riwayat snapshot untuk grafik/riwayat monitoring. */
export function riwayat({ totalDevices = 0, jumlah = 24, langkahMenit = 5, when = new Date() } = {}) {
  const out = [];

  for (let i = jumlah - 1; i >= 0; i -= 1) {
    const waktu = new Date(when.getTime() - i * langkahMenit * 60000);
    const snap = snapshot({ totalDevices, when: waktu });

    out.push({
      recorded_at: snap.dicatat_pada,
      ap_aktif: snap.ap_aktif,
      ap_down: snap.ap_down,
      total_perangkat: snap.total_klien,
      bandwidth_mbps: snap.bandwidth_mbps,
      kapasitas_persen: snap.kapasitas_persen,
    });
  }

  return out.reverse();
}

export const jumlahAp = DAFTAR_AP.length;
