import { createHash, randomBytes } from 'node:crypto';
import { db, driver } from './db.js';
import { config } from './config.js';
import { clientIp, isHttps, now, nowPlus, parseCookies } from './helpers.js';

function hashId(raw) {
  return createHash('sha256').update(String(raw)).digest('hex');
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(req),
    path: '/',
    maxAge: config.session.lifetime * 1000,
  };
}

async function read(raw) {
  const row = await db.get(
    'SELECT data FROM sessions WHERE id = ? AND expires_at > ?',
    [hashId(raw), now()],
  );

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

async function write(raw, data, req) {
  const id = hashId(raw);
  const payload = JSON.stringify(data ?? {});
  const userId = Number(data?.userId ?? 0) || null;
  const ip = clientIp(req);
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 255);
  const timestamp = now();
  const expires = nowPlus(config.session.lifetime);

  if (driver === 'mysql') {
    await db.run(
      `INSERT INTO sessions (id, user_id, ip, user_agent, data, last_activity, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), ip = VALUES(ip),
         user_agent = VALUES(user_agent), data = VALUES(data),
         last_activity = VALUES(last_activity), expires_at = VALUES(expires_at)`,
      [id, userId, ip, userAgent, payload, timestamp, expires],
    );
  } else {
    await db.run(
      `INSERT INTO sessions (id, user_id, ip, user_agent, data, last_activity, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, ip = excluded.ip,
         user_agent = excluded.user_agent, data = excluded.data,
         last_activity = excluded.last_activity, expires_at = excluded.expires_at`,
      [id, userId, ip, userAgent, payload, timestamp, expires],
    );
  }
}

export async function destroySession(req, res) {
  req.sessionDestroyed = true;

  await db.run('DELETE FROM sessions WHERE id = ?', [req.sessionHash]);
  res.clearCookie(config.session.name, { path: '/' });
  req.session = {};
}

export async function regenerateSession(req, res) {
  const oldHash = req.sessionHash;
  const raw = randomBytes(32).toString('hex');

  req.session = {};
  req.sessionRaw = raw;
  req.sessionHash = hashId(raw);
  req.sessionDestroyed = false;

  res.cookie(config.session.name, raw, cookieOptions(req));
  await db.run('DELETE FROM sessions WHERE id = ?', [oldHash]);
}

export function sessionMiddleware() {
  return async (req, res, next) => {
    try {
      const cookies = parseCookies(req.headers.cookie ?? '');
      let raw = cookies[config.session.name];
      let data = null;

      if (raw && /^[a-f0-9]{64}$/.test(raw)) {
        data = await read(raw);
      }

      if (!data) {
        raw = randomBytes(32).toString('hex');
        data = {};
        res.cookie(config.session.name, raw, cookieOptions(req));
      }

      req.session = data;
      req.sessionRaw = raw;
      req.sessionHash = hashId(raw);
      req.sessionDestroyed = false;

      // Bersihkan sesi kedaluwarsa sesekali (tanpa menahan request).
      if (Math.random() < 0.01) {
        db.run('DELETE FROM sessions WHERE expires_at < ?', [now()]).catch(() => {});
      }

      res.on('finish', () => {
        if (req.sessionDestroyed) {
          return;
        }

        write(req.sessionRaw, req.session, req).catch((error) => {
          console.error('[session] gagal menyimpan:', error.message);
        });
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}
