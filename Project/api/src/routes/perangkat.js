import { Router } from 'express';
import { asyncHandler, AppError } from '../errors.js';
import { requireUser } from '../auth.js';
import { validate, assertValid } from '../validation.js';
import { sendOk } from '../response.js';
import { Device } from '../models/device.js';
import { Log } from '../models/log.js';

export const perangkatRouter = Router();

perangkatRouter.use(requireUser);

perangkatRouter.get('/', asyncHandler(async (req, res) => {
  const devices = await Device.listForUser(req.user.id);

  sendOk(res, { perangkat: devices, maksimal: 3 });
}));

perangkatRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const devices = await Device.listForUser(req.user.id);
  const target = devices.find((item) => Number(item.id) === id);

  if (!target) {
    throw new AppError('Perangkat tidak ditemukan.', 404);
  }

  await Device.remove(id, req.user.id);
  await Log.add(req.user.id, 'hapus_perangkat', `Menghapus perangkat ${target.nama} (${target.mac})`, req);

  sendOk(res, {
    perangkat: await Device.listForUser(req.user.id),
  }, 'Perangkat berhasil dihapus.');
}));

perangkatRouter.post('/', asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const data = {
    nama: String(body.nama ?? '').trim(),
    tipe: String(body.tipe ?? '').trim(),
    mac: String(body.mac ?? '').trim().toUpperCase(),
    ip: String(body.ip ?? '').trim(),
    vlan: body.vlan === undefined || body.vlan === '' ? null : Number(body.vlan),
  };

  assertValid(validate(data, {
    nama: 'required|min:2|max:60',
    tipe: 'max:80',
    mac: 'required|regex:^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$',
  }));

  if (data.vlan !== null && (!Number.isInteger(data.vlan) || data.vlan < 1 || data.vlan > 4094)) {
    throw new AppError('VLAN tidak valid. Gunakan angka 1 sampai 4094.', 422, {
      vlan: ['VLAN harus berupa angka 1 sampai 4094.'],
    });
  }

  const total = await Device.countForUser(req.user.id);

  if (total >= 3) {
    throw new AppError('Maksimal 3 perangkat per akun. Hubungi admin untuk mengganti perangkat.', 422, {
      perangkat: ['Batas 3 perangkat sudah tercapai.'],
    });
  }

  if (await Device.findByMac(data.mac)) {
    throw new AppError('Alamat MAC sudah terdaftar.', 422, {
      mac: ['Alamat MAC sudah terdaftar.'],
    });
  }

  const id = await Device.create({
    userId: req.user.id,
    nama: data.nama,
    tipe: data.tipe || null,
    mac: data.mac,
    ip: data.ip || null,
    ssid: null,
    vlan: Number.isFinite(data.vlan) ? data.vlan : null,
  });

  await Log.add(req.user.id, 'tambah_perangkat', `Menambah perangkat ${data.nama} (${data.mac})`, req);

  sendOk(res, {
    id,
    perangkat: await Device.listForUser(req.user.id),
  }, 'Perangkat berhasil didaftarkan.', 201);
}));
