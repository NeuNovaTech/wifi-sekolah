import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { asyncHandler, AppError } from '../errors.js';
import { requireAdmin } from '../auth.js';
import { validate, assertValid } from '../validation.js';
import { sendOk } from '../response.js';
import { now, nowPlus } from '../helpers.js';
import { User } from '../models/user.js';
import { Device } from '../models/device.js';
import { Ticket } from '../models/ticket.js';
import { NetworkStat } from '../models/network-stat.js';
import { Log } from '../models/log.js';
import { Setting } from '../models/setting.js';
import { verifyPassword } from '../passwords.js';
import { config } from '../config.js';
import { snapshot as jaringanSnapshot, riwayat as riwayatSimulasi, perangkatOnline, ipSimulasi } from '../network/simulator.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

function temporaryPassword() {
  return 'wifi-' + randomBytes(3).toString('hex');
}

adminRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const [
    counts, online, ticketCounts, pendaftar, tiketBaru, network, logs,
    totalPerangkat, vlan, perJurusan, seriesSiswa, seriesPerangkat,
  ] = await Promise.all([
    User.counts(),
    Device.onlineUsers(),
    Ticket.counts(),
    User.pending(6),
    Ticket.recent(5),
    NetworkStat.latest(),
    Log.recent(5),
    Device.total(),
    Device.byVlan(),
    User.byJurusan(),
    User.series(7),
    Device.series(7),
  ]);

  const grafik = seriesSiswa.map((row, index) => ({
    tanggal: row.tanggal,
    pendaftar: row.jumlah,
    perangkat: seriesPerangkat[index]?.jumlah ?? 0,
  }));

  const simulasi = config.network.source === 'simulasi';
  const jaringan = simulasi
    ? jaringanSnapshot({ totalDevices: totalPerangkat })
    : network
      ? {
        mode: 'router',
        ap_aktif: Number(network.ap_aktif),
        ap_down: Number(network.ap_down),
        pengguna_online: online,
        total_perangkat: Number(network.total_perangkat),
        bandwidth_mbps: Number(network.bandwidth_mbps),
        kapasitas_persen: Number(network.kapasitas_persen),
        recorded_at: network.recorded_at,
      }
      : null;

  sendOk(res, {
    total_siswa: counts.total,
    pending: counts.pending,
    online: jaringan?.pengguna_online ?? online,
    tiket_baru: ticketCounts.menunggu,
    total_perangkat: totalPerangkat,
    jaringan_mode: jaringan?.mode ?? null,
    ringkasan_siswa: counts,
    ringkasan_tiket: ticketCounts,
    pendaftar,
    tiket: tiketBaru,
    per_jurusan: perJurusan,
    vlan,
    grafik,
    jaringan,
    log: logs,
  });
}));

adminRouter.post('/siswa', asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const data = {
    nama: String(body.nama ?? '').trim(),
    nipd: String(body.nipd ?? '').trim(),
    email: String(body.email ?? '').trim().toLowerCase(),
    no_hp: String(body.no_hp ?? '').trim(),
    kelas: String(body.kelas ?? '').trim(),
    password: String(body.password ?? body.sandi ?? ''),
  };

  const errors = validate(data, {
    nama: 'required|min:3|max:100',
    nipd: 'required|min:3|max:20|regex:^[A-Za-z0-9.-]+$',
    email: 'required|email|max:120',
    no_hp: 'required|regex:^[0-9+\\s-]{8,20}$',
    kelas: 'required',
  });

  if (!errors.kelas && !User.KELAS.includes(data.kelas)) {
    errors.kelas = ['Kelas tidak valid.'];
  }

  if (!errors.nipd && await User.findByNipd(data.nipd)) {
    errors.nipd = ['NIPD sudah terdaftar.'];
  }

  if (!errors.email && await User.findByEmail(data.email)) {
    errors.email = ['Email sudah terdaftar.'];
  }

  assertValid(errors);

  if (data.password !== '' && data.password.length < 6) {
    throw new AppError('Validasi gagal.', 422, {
      password: ['Kata sandi minimal 6 karakter.'],
    });
  }

  const generated = data.password === '' ? temporaryPassword() : null;
  const id = await User.create({
    ...data,
    password: data.password || generated,
    role: 'siswa',
    status: 'aktif',
    approved_by: req.user.id,
    approved_at: now(),
  });

  await Log.add(req.user.id, 'tambah_siswa', `Menambah siswa ${data.nama} (${data.nipd})`, req);

  sendOk(res, {
    id,
    user: User.publicView(await User.find(id)),
    sandi_sementara: generated,
  }, 'Siswa berhasil ditambahkan.', 201);
}));

adminRouter.get('/siswa', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status !== '' ? req.query.status : null;
  const q = typeof req.query.q === 'string' && req.query.q !== '' ? req.query.q : null;

  if (status && !['pending', 'aktif', 'ditolak', 'blokir'].includes(status)) {
    throw new AppError('Filter status tidak valid.', 422);
  }

  const [siswa, ringkasan] = await Promise.all([
    User.list({ status, q }),
    User.counts(),
  ]);

  sendOk(res, { siswa, ringkasan, filter: { status, q } });
}));

adminRouter.get('/siswa/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const siswa = await User.find(id);

  if (!siswa || siswa.role !== 'siswa') {
    throw new AppError('Siswa tidak ditemukan.', 404);
  }

  const [perangkat, tiket, aktivitas] = await Promise.all([
    Device.listForUser(id),
    Ticket.listForUser(id, 10),
    Log.recentForUser(id, 8),
  ]);

  sendOk(res, {
    siswa: User.publicView(siswa),
    perangkat,
    tiket,
    aktivitas,
  });
}));

adminRouter.patch('/siswa/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const action = String(req.body?.action ?? '').toLowerCase();

  const target = await User.find(id);

  if (!target) {
    throw new AppError('Siswa tidak ditemukan.', 404);
  }

  if (target.role === 'admin') {
    throw new AppError('Akun admin tidak dapat diubah dari halaman siswa.', 422);
  }

  if (action === 'reset_password' || action === 'reset' || action === 'reset_sandi') {
    const sandi = temporaryPassword();

    await User.updatePassword(id, sandi);
    await Log.add(req.user.id, 'reset_sandi', `Reset sandi ${target.nipd}`, req);

    sendOk(res, { id, nipd: target.nipd, sandi_baru: sandi }, 'Kata sandi siswa berhasil direset.');
    return;
  }

  if (action === 'edit' || action === 'ubah' || action === 'update') {
    const body = req.body ?? {};

    const data = {
      nama: String(body.nama ?? '').trim(),
      email: String(body.email ?? '').trim().toLowerCase(),
      no_hp: String(body.no_hp ?? '').trim(),
      kelas: String(body.kelas ?? '').trim(),
    };

    const errors = validate(data, {
      nama: 'required|min:3|max:100',
      email: 'required|email|max:120',
      no_hp: 'required|regex:^[0-9+\\s-]{8,20}$',
      kelas: 'required',
    });

    if (!errors.kelas && !User.KELAS.includes(data.kelas)) {
      errors.kelas = ['Kelas tidak valid.'];
    }

    if (!errors.email) {
      const pemilikEmail = await User.findByEmail(data.email);

      if (pemilikEmail && Number(pemilikEmail.id) !== id) {
        errors.email = ['Email sudah dipakai akun lain.'];
      }
    }

    assertValid(errors, 'Data siswa belum lengkap.');

    await User.updateByAdmin(id, data);
    await Log.add(req.user.id, 'ubah_data_siswa', `Mengubah data ${target.nipd}`, req);

    sendOk(res, { user: User.publicView(await User.find(id)) }, 'Data siswa berhasil diperbarui.');
    return;
  }

  const map = {
    approve: 'aktif',
    setujui: 'aktif',
    activate: 'aktif',
    aktifkan: 'aktif',
    reject: 'ditolak',
    tolak: 'ditolak',
    block: 'blokir',
    blokir: 'blokir',
  };

  if (!map[action]) {
    throw new AppError('Aksi tidak dikenal. Gunakan approve, reject, block, reset_password, atau activate.', 422, {
      action: ['Aksi tidak valid.'],
    });
  }

  const status = map[action];
  await User.setStatus(id, status, req.user.id);
  await Log.add(req.user.id, 'ubah_status_siswa', `${target.nipd} -> ${status}`, req);

  const pesan = {
    aktif: target.status === 'aktif'
      ? `Akun ${target.nama} sudah aktif.`
      : `Akun ${target.nama} disetujui. Siswa sudah bisa masuk memakai NIPD dan kata sandinya.`,
    ditolak: `Pendaftaran ${target.nama} ditolak. Siswa bisa memperbaiki data lalu mendaftar ulang.`,
    blokir: `Akun ${target.nama} diblokir. Siswa tidak bisa masuk sampai diaktifkan lagi.`,
  }[status];

  sendOk(res, {
    user: User.publicView(await User.find(id)),
  }, pesan);
}));

adminRouter.get('/monitoring', asyncHandler(async (req, res) => {
  const [daftar, riwayatDb, vlan, onlineDb] = await Promise.all([
    Device.listAllWithUser(200),
    NetworkStat.history(30),
    Device.byVlan(),
    Device.onlineUsers(),
  ]);

  const simulasi = config.network.source === 'simulasi';
  const snap = simulasi ? jaringanSnapshot({ totalDevices: daftar.length }) : null;
  const batasOnline = nowPlus(-300);

  const perangkat = daftar.map((row) => ({
    ...row,
    online: snap ? perangkatOnline(row.mac) : String(row.last_seen ?? '') >= batasOnline,
    ip: row.ip || (snap ? ipSimulasi(row.vlan, row.mac) : null),
  }));

  const latest = riwayatDb[0] ?? null;

  sendOk(res, {
    mode: snap ? 'simulasi' : 'router',
    perangkat,
    riwayat: snap ? riwayatSimulasi({ totalDevices: daftar.length }) : riwayatDb,
    vlan,
    ap: snap ? snap.ap : [],
    ringkasan: {
      total_perangkat: perangkat.length,
      pengguna_online: snap ? snap.pengguna_online : onlineDb,
      total_klien: snap ? snap.total_klien : null,
      ap_aktif: snap ? snap.ap_aktif : latest ? Number(latest.ap_aktif) : null,
      ap_down: snap ? snap.ap_down : latest ? Number(latest.ap_down) : null,
      bandwidth_mbps: snap ? snap.bandwidth_mbps : latest ? Number(latest.bandwidth_mbps) : null,
      kapasitas_persen: snap ? snap.kapasitas_persen : latest ? Number(latest.kapasitas_persen) : null,
      dicatat_pada: snap ? snap.dicatat_pada : latest ? latest.recorded_at : null,
    },
  });
}));

adminRouter.get('/keluhan', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' && req.query.status !== '' ? req.query.status : null;
  const q = typeof req.query.q === 'string' && req.query.q !== '' ? req.query.q : null;

  if (status && !Ticket.STATUS.includes(status)) {
    throw new AppError('Filter status tidak valid.', 422);
  }

  const [keluhan, ringkasan] = await Promise.all([
    Ticket.listAll({ status, q }),
    Ticket.counts(),
  ]);

  sendOk(res, { keluhan, ringkasan, filter: { status, q } });
}));

adminRouter.patch('/keluhan/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? '').toLowerCase();

  if (!Ticket.STATUS.includes(status)) {
    throw new AppError('Status tidak valid.', 422, {
      status: ['Gunakan menunggu, diproses, selesai, atau ditolak.'],
    });
  }

  const ticket = await Ticket.find(id);

  if (!ticket) {
    throw new AppError('Tiket tidak ditemukan.', 404);
  }

  await Ticket.updateStatus(id, status, req.user.id);
  await Log.add(req.user.id, 'ubah_status_tiket', `${ticket.kode} -> ${status}`, req);

  sendOk(res, { tiket: await Ticket.find(id) }, `Status tiket diubah menjadi ${status}.`);
}));

adminRouter.get('/keluhan/:id', asyncHandler(async (req, res) => {
  const tiket = await Ticket.find(req.params.id);

  if (!tiket) {
    throw new AppError('Tiket tidak ditemukan.', 404);
  }

  sendOk(res, {
    tiket,
    balasan: await Ticket.replies(tiket.id),
  });
}));

adminRouter.post('/keluhan/:id/reply', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const tiket = await Ticket.find(id);

  if (!tiket) {
    throw new AppError('Tiket tidak ditemukan.', 404);
  }

  if (tiket.status === 'selesai' || tiket.status === 'ditolak') {
    throw new AppError('Tiket sudah ditutup. Buka kembali tiket bila perlu dibalas.', 422);
  }

  const data = {
    balasan: String(req.body?.balasan ?? '').trim(),
  };

  const errors = validate(data, {
    balasan: 'required|min:1|max:1000',
  });

  assertValid(errors, 'Balasan belum lengkap.');

  if (tiket.status === 'menunggu') {
    await Ticket.updateStatus(id, 'diproses', req.user.id);
  }

  await Ticket.addReply(id, req.user.id, data.balasan);
  await Log.add(req.user.id, 'balas_keluhan', `Membalas tiket ${tiket.kode}`, req);

  sendOk(res, {
    tiket: await Ticket.find(id),
    balasan: await Ticket.replies(id),
  }, 'Balasan terkirim ke siswa.');
}));

adminRouter.get('/pengaturan', asyncHandler(async (req, res) => {
  const pengaturan = await Setting.all();

  sendOk(res, {
    pengaturan: {
      wifi_ssid: pengaturan.wifi_ssid ?? '',
      wifi_password: pengaturan.wifi_password ?? '',
      jam_akses: pengaturan.jam_akses ?? '',
      kapasitas_jaringan: pengaturan.kapasitas_jaringan ?? '',
    },
  });
}));

adminRouter.patch('/pengaturan', asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const data = {
    wifi_ssid: String(body.wifi_ssid ?? '').trim(),
    wifi_password: String(body.wifi_password ?? '').trim(),
    jam_akses: String(body.jam_akses ?? '').trim(),
    kapasitas_jaringan: String(body.kapasitas_jaringan ?? '').trim(),
  };

  const errors = validate(data, {
    wifi_ssid: 'required|min:1|max:32',
    wifi_password: 'required|min:8|max:63',
    jam_akses: 'required',
    kapasitas_jaringan: 'required|numeric',
  });

  assertValid(errors, 'Pengaturan belum lengkap.');

  if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(data.jam_akses)) {
    throw new AppError('Format jam akses tidak valid.', 422, {
      jam_akses: ['Gunakan format JJ:MM-JJ:MM, contoh 06:00-17:00.'],
    });
  }

  const kapasitas = Number(data.kapasitas_jaringan);

  if (kapasitas < 1 || kapasitas > 100) {
    throw new AppError('Kapasitas jaringan harus antara 1 dan 100 persen.', 422, {
      kapasitas_jaringan: ['Kapasitas jaringan harus antara 1 dan 100.'],
    });
  }

  await Setting.set('wifi_ssid', data.wifi_ssid);
  await Setting.set('wifi_password', data.wifi_password);
  await Setting.set('jam_akses', data.jam_akses);
  await Setting.set('kapasitas_jaringan', String(kapasitas));
  await Log.add(req.user.id, 'ubah_pengaturan', 'Memperbarui pengaturan WiFi sekolah', req);

  sendOk(res, { pengaturan: data }, 'Pengaturan disimpan. Perubahan SSID/sandi baru berlaku setelah terhubung ke router.');
}));

adminRouter.patch('/akun', asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const data = {
    password_lama: String(body.password_lama ?? ''),
    password: String(body.password ?? ''),
    password_confirmation: String(body.password_confirmation ?? ''),
  };

  const errors = validate(data, {
    password_lama: 'required',
    password: 'required|min:8|max:72',
    password_confirmation: 'required|same:password',
  });

  assertValid(errors, 'Data kata sandi belum lengkap.');

  const akun = await User.find(req.user.id);
  const cocok = akun ? await verifyPassword(data.password_lama, akun.password_hash) : false;

  if (!cocok) {
    throw new AppError('Kata sandi lama salah.', 422, {
      password_lama: ['Kata sandi lama salah.'],
    });
  }

  await User.updatePassword(req.user.id, data.password);
  await Log.add(req.user.id, 'ganti_sandi', 'Mengganti kata sandi admin', req);

  sendOk(res, {}, 'Kata sandi admin berhasil diganti.');
}));

adminRouter.get('/log', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const logs = await Log.recent(limit);

  sendOk(res, { log: logs, jumlah: logs.length });
}));
