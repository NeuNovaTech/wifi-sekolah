import { Router } from 'express';
import { asyncHandler, AppError } from '../errors.js';
import { requireUser } from '../auth.js';
import { validate, assertValid } from '../validation.js';
import { sendOk } from '../response.js';
import { Ticket } from '../models/ticket.js';
import { Log } from '../models/log.js';

export const keluhanRouter = Router();

keluhanRouter.use(requireUser);

keluhanRouter.get('/', asyncHandler(async (req, res) => {
  const tickets = await Ticket.listForUser(req.user.id, 100);

  sendOk(res, {
    keluhan: tickets,
    jumlah: tickets.length,
    terbuka: await Ticket.openForUser(req.user.id),
  });
}));

keluhanRouter.post('/', asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const data = {
    kategori: String(body.kategori ?? 'lain').trim().toLowerCase(),
    isi: String(body.isi ?? '').trim(),
  };

  const errors = validate(data, {
    kategori: 'required|in:koneksi,kecepatan,perangkat,akun,lain',
    isi: 'required|min:10|max:1000',
  });

  assertValid(errors, 'Keluhan belum lengkap.');

  const created = await Ticket.create({
    userId: req.user.id,
    kategori: data.kategori,
    isi: data.isi,
  });

  await Log.add(req.user.id, 'kirim_keluhan', `Tiket ${created.kode} (${data.kategori})`, req);

  sendOk(res, created, 'Keluhan terkirim. Operator akan menindaklanjuti.', 201);
}));

keluhanRouter.get('/:id', asyncHandler(async (req, res) => {
  const tiket = await Ticket.findForUser(req.params.id, req.user.id);

  if (!tiket) {
    throw new AppError('Tiket tidak ditemukan.', 404);
  }

  sendOk(res, {
    tiket,
    balasan: await Ticket.replies(tiket.id),
  });
}));

keluhanRouter.post('/:id/reply', asyncHandler(async (req, res) => {
  const tiket = await Ticket.findForUser(req.params.id, req.user.id);

  if (!tiket) {
    throw new AppError('Tiket tidak ditemukan.', 404);
  }

  if (tiket.status === 'selesai' || tiket.status === 'ditolak') {
    throw new AppError('Tiket sudah ditutup. Buat tiket baru bila masih ada kendala.', 422);
  }

  const data = {
    balasan: String(req.body?.balasan ?? '').trim(),
  };

  const errors = validate(data, {
    balasan: 'required|min:1|max:1000',
  });

  assertValid(errors, 'Balasan belum lengkap.');

  await Ticket.addReply(tiket.id, req.user.id, data.balasan);
  await Log.add(req.user.id, 'balas_keluhan', `Membalas tiket ${tiket.kode}`, req);

  sendOk(res, {
    balasan: await Ticket.replies(tiket.id),
  }, 'Balasan terkirim ke operator.');
}));
