import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const PARAM = { N: 16384, r: 8, p: 1, keylen: 64 };

/**
 * Hash kata sandi dengan scrypt (bawaan Node, tanpa dependency native).
 * Format: scrypt$N$r$p$saltHex$keyHex
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(String(password), salt, PARAM.keylen, {
    N: PARAM.N,
    r: PARAM.r,
    p: PARAM.p,
  });

  return ['scrypt', PARAM.N, PARAM.r, PARAM.p, salt.toString('hex'), key.toString('hex')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, n, r, p, saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');

  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  const key = await scryptAsync(String(password), salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  return key.length === expected.length && timingSafeEqual(key, expected);
}
