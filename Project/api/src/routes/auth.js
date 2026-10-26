import { Router } from 'express';
import { asyncHandler, AppError } from '../errors.js';
import { validate, assertValid } from '../validation.js';
import { verifyPassword } from '../passwords.js';
import { csrfToken, rotateCsrf } from '../csrf.js';
import { destroySession, regenerateSession } from '../session.js';
import { clientIp, now, nowPlus, pick } from '../helpers.js';
import { sendOk } from '../response.js';
import { config } from '../config.js';
import { User } from '../models/user.js';
import { Log } from '../models/log.js';
import { LoginAttempt } from '../models/login-attempt.js';

export const authRouter = Router();

authRouter.get('/csrf', (req, res) => {
  sendOk(res, { token: csrfToken(req) });
});

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const nipd = String(pick(body, ['nipd'], '')).trim();
  const password = String(pick(body, ['password', 'sandi'], ''));

  assertValid(validate({ nipd, password }, {
    nipd: 'required|max:20',
    password: 'required|max:72',
  }));

  const ip = clientIp(req);
  const windowStart = nowPlus(-config.security.loginWindowMinutes * 60);
  const failures = await LoginAttempt.failures(nipd, ip, windowStart);

  if (failures >= config.security.loginMaxAttempts) {
    throw new AppError(
      `Terlalu banyak percobaan masuk. Coba lagi dalam ${config.security.loginWindowMinutes} menit.`,
      429,
    );
  }

  const user = await User.findByNipd(nipd);
  const valid = user ? await verifyPassword(password, user.password_hash) : false;

  if (!user || !valid) {
    await LoginAttempt.record(nipd, ip, false);
    throw new AppError('NIPD atau kata sandi salah.', 401);
  }

  if (user.status !== 'aktif') {
    await LoginAttempt.record(nipd, ip, false);

    const messages = {
      pending: 'Akun masih menunggu persetujuan admin.',
      ditolak: 'Pendaftaran akun ditolak. Perbaiki data lalu daftar ulang.',
      blokir: 'Akun diblokir. Hubungi admin sekolah.',
    };

    throw new AppError(messages[user.status] ?? 'Akun tidak dapat digunakan.', 403);
  }

  await LoginAttempt.record(nipd, ip, true);
  await regenerateSession(req, res);

  req.session.userId = Number(user.id);
  req.session.role = user.role;
  req.session.loginAt = now();
  rotateCsrf(req);

  await User.touchLogin(user.id);
  await Log.add(user.id, 'login', `Login berhasil sebagai ${user.role}`, req);

  const fresh = await User.find(user.id);

  sendOk(res, {
    user: User.publicView(fresh),
    csrf_token: csrfToken(req),
  }, 'Berhasil masuk.');
}));

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const data = {
    nama: String(pick(body, ['nama'], '')).trim(),
    nipd: String(pick(body, ['nipd'], '')).trim(),
    email: String(pick(body, ['email'], '')).trim().toLowerCase(),
    no_hp: String(pick(body, ['no_hp', 'nohp'], '')).trim(),
    kelas: String(pick(body, ['kelas'], '')).trim(),
    password: String(pick(body, ['password', 'sandi'], '')),
  };

  const errors = validate(data, {
    nama: 'required|min:3|max:100',
    nipd: 'required|min:3|max:20|regex:^[A-Za-z0-9.-]+$',
    email: 'required|email|max:120',
    no_hp: 'required|regex:^[0-9+\\s-]{8,20}$',
    kelas: 'required',
    password: 'required|min:6|max:72',
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

  const id = await User.create({
    ...data,
    role: 'siswa',
    status: 'pending',
  });

  await Log.add(id, 'register', `Pendaftaran ${data.nipd} (${data.kelas})`, req);

  sendOk(res, { id, status: 'pending' }, 'Pendaftaran berhasil. Tunggu persetujuan admin.', 201);
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  if (req.user) {
    await Log.add(req.user.id, 'logout', 'Keluar dari aplikasi', req);
  }

  await destroySession(req, res);

  sendOk(res, null, 'Berhasil keluar.');
}));

authRouter.get('/me', (req, res) => {
  sendOk(res, {
    authenticated: Boolean(req.user),
    user: req.user ? User.publicView(req.user) : null,
    csrf_token: csrfToken(req),
  });
});
