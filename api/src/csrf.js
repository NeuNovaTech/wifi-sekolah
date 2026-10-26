import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

export function csrfToken(req) {
  if (!req.session.csrf) {
    req.session.csrf = randomBytes(32).toString('hex');
  }

  return req.session.csrf;
}

export function rotateCsrf(req) {
  req.session.csrf = randomBytes(32).toString('hex');

  return req.session.csrf;
}

/**
 * Validasi token CSRF untuk request yang mengubah data.
 * Login & daftar dikecualikan karena mengikuti kontrak assets/js/api.js.
 */
export function csrfMiddleware(exemptPaths = []) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || exemptPaths.includes(req.path)) {
      next();
      return;
    }

    const sent = String(req.get('x-csrf-token') ?? req.body?._csrf ?? '');
    const token = String(req.session.csrf ?? '');

    const a = Buffer.from(sent);
    const b = Buffer.from(token);

    if (token === '' || a.length !== b.length || !timingSafeEqual(a, b)) {
      next(new AppError('Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.', 419));
      return;
    }

    next();
  };
}
