import express from 'express';
import { config, PROJECT_ROOT } from './config.js';
import { sessionMiddleware } from './session.js';
import { csrfMiddleware } from './csrf.js';
import { attachUser } from './auth.js';
import { sendOk, sendError } from './response.js';
import { AppError } from './errors.js';
import { Log } from './models/log.js';
import { db } from './db.js';
import { now, isHttps } from './helpers.js';
import { authRouter } from './routes/auth.js';
import { siswaRouter } from './routes/siswa.js';
import { perangkatRouter } from './routes/perangkat.js';
import { keluhanRouter } from './routes/keluhan.js';
import { adminRouter } from './routes/admin.js';

export const app = express();

app.disable('x-powered-by');

if (config.app.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (isHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});

const api = express.Router();

api.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  next();
});

api.use(sessionMiddleware());
api.use(csrfMiddleware(['/auth/login', '/auth/register']));
api.use(attachUser);

api.get('/health', (req, res) => {
  sendOk(res, {
    time: now(),
    driver: db.driver,
    uptime_detik: Math.round(process.uptime()),
  });
});

api.use('/auth', authRouter);
api.use('/siswa/perangkat', perangkatRouter);
api.use('/siswa', siswaRouter);
api.use('/keluhan', keluhanRouter);
api.use('/admin', adminRouter);

app.use('/api', api);
app.use('/api', (req, res) => sendError(res, 'Endpoint tidak ditemukan.', 404));

if (config.app.serveStatic) {
  app.get('/', (req, res) => res.redirect('/user/'));

  app.use(express.static(PROJECT_ROOT, {
    index: 'index.html',
    dotfiles: 'ignore',
    extensions: ['html'],
  }));
}

app.use((req, res) => sendError(res, 'Halaman tidak ditemukan.', 404));

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    sendError(res, error.message, error.status, error.errors);
    return;
  }

  if (error?.type === 'entity.parse.failed') {
    sendError(res, 'Format JSON tidak valid.', 400);
    return;
  }

  Log.file(error);

  if (config.app.debug) {
    console.error(error);
  }

  sendError(
    res,
    config.app.debug ? error.message : 'Terjadi kesalahan pada server.',
    500,
  );
});
