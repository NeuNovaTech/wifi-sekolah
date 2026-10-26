import { AppError } from './errors.js';
import { User } from './models/user.js';

export async function attachUser(req, res, next) {
  try {
    const id = Number(req.session?.userId ?? 0);

    if (id > 0) {
      const user = await User.find(id);

      if (user && user.status === 'aktif') {
        req.user = user;
      } else {
        req.session.userId = null;
        req.session.role = null;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(req, res, next) {
  if (!req.user) {
    next(new AppError('Sesi tidak ditemukan. Silakan masuk kembali.', 401));
    return;
  }

  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    next(new AppError('Sesi tidak ditemukan. Silakan masuk kembali.', 401));
    return;
  }

  if (req.user.role !== 'admin') {
    next(new AppError('Halaman ini hanya untuk admin.', 403));
    return;
  }

  next();
}
