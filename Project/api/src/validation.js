import { AppError } from './errors.js';

const LABELS = {
  nipd: 'NIPD',
  nama: 'Nama',
  email: 'Email',
  no_hp: 'Nomor HP',
  kelas: 'Kelas',
  password: 'Kata sandi',
  password_confirmation: 'Ulangi kata sandi',
  kategori: 'Kategori',
  isi: 'Isi keluhan',
  mac: 'Alamat MAC',
  tipe: 'Tipe perangkat',
  status: 'Status',
  action: 'Aksi',
  balasan: 'Balasan',
  wifi_ssid: 'SSID',
  wifi_password: 'Kata sandi WiFi',
  jam_akses: 'Jam akses',
  kapasitas_jaringan: 'Kapasitas jaringan',
  password_lama: 'Kata sandi lama',
};

function message(field, text) {
  const label = LABELS[field] ?? field;

  return `${label} ${text}`;
}

/**
 * Validasi sederhana.
 *
 *   validate(data, { nipd: 'required|min:3|max:20', email: 'required|email' })
 *
 * Mengembalikan objek error (kosong kalau lolos).
 */
export function validate(data, rules) {
  const errors = {};

  for (const [field, ruleString] of Object.entries(rules)) {
    const raw = data?.[field];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    const parts = String(ruleString).split('|');

    for (const part of parts) {
      const separator = part.indexOf(':');
      const rule = separator === -1 ? part : part.slice(0, separator);
      const arg = separator === -1 ? null : part.slice(separator + 1);
      const failed = (text) => {
        errors[field] = errors[field] ?? [];
        errors[field].push(message(field, text));
      };

      if (rule === 'required') {
        if (value === '') {
          failed('wajib diisi.');
          break;
        }
        continue;
      }

      if (value === '') {
        continue;
      }

      if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        failed('tidak valid.');
        break;
      }

      if (rule === 'min' && value.length < Number(arg)) {
        failed(`minimal ${arg} karakter.`);
        break;
      }

      if (rule === 'max' && value.length > Number(arg)) {
        failed(`maksimal ${arg} karakter.`);
        break;
      }

      if (rule === 'in' && !String(arg).split(',').includes(value)) {
        failed('tidak valid.');
        break;
      }

      if (rule === 'numeric' && !/^-?\d+$/.test(value)) {
        failed('harus berupa angka.');
        break;
      }

      if (rule === 'regex' && arg !== null) {
        try {
          if (!new RegExp(arg).test(value)) {
            failed('tidak valid.');
            break;
          }
        } catch {
          failed('tidak valid.');
          break;
        }
      }

      if (rule === 'same' && value !== String(data?.[arg] ?? '').trim()) {
        failed('tidak sama.');
        break;
      }
    }
  }

  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function assertValid(errors, text = 'Validasi gagal.') {
  if (hasErrors(errors)) {
    throw new AppError(text, 422, errors);
  }
}
