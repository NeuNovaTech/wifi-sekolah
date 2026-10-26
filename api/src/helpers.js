export function pad(value) {
  return String(value).padStart(2, '0');
}

/** Waktu lokal server dalam format MySQL DATETIME: 2026-10-26 14:52:33 */
export function now() {
  const d = new Date();

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function nowPlus(seconds) {
  const d = new Date(Date.now() + Number(seconds) * 1000);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function maskNumber(value) {
  const digits = String(value ?? '').replace(/\D+/g, '');

  return '•••• •••• ' + digits.slice(-4);
}

export function isHttps(req) {
  return req.secure
    || String(req.headers['x-forwarded-proto'] ?? '').toLowerCase() === 'https';
}

export function parseCookies(header = '') {
  const out = {};

  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) {
      out[key] = decodeURIComponent(value);
    }
  }

  return out;
}

export function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');
}

export function pick(source, keys, fallback = null) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }

  return fallback;
}
