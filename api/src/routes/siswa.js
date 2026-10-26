import { Router } from 'express';
import { asyncHandler } from '../errors.js';
import { requireUser } from '../auth.js';
import { validate, assertValid } from '../validation.js';
import { sendOk } from '../response.js';
import { pick, now } from '../helpers.js';
import { User } from '../models/user.js';
import { Device } from '../models/device.js';
import { Ticket } from '../models/ticket.js';
import { Setting } from '../models/setting.js';
import { NetworkStat } from '../models/network-stat.js';
import { Log } from '../models/log.js';

export const siswaRouter = Router();

siswaRouter.use(requireUser);

siswaRouter.get('/me', asyncHandler(async (req, res) => {
  const [settings, devices, tickets, openTickets, allTickets, network, activities] = await Promise.all([
    Setting.all(),
    Device.listForUser(req.user.id),
    Ticket.listForUser(req.user.id, 5),
    Ticket.openForUser(req.user.id),
    Ticket.countForUser(req.user.id),
    NetworkStat.latest(),
    Log.recentForUser(req.user.id, 6),
  ]);

  sendOk(res, {
    user: User.publicView(req.user),
    perangkat: devices,
    statistik: {
      jumlah_perangkat: devices.length,
      tiket_terbuka: openTickets,
      total_tiket: allTickets,
      total_online_jam: 0,
    },
    sesi: {
      login_at: req.session.loginAt ?? null,
      server_now: now(),
    },
    wifi: {
      ssid: settings.wifi_ssid ?? null,
      password: settings.wifi_password ?? null,
      vlan: devices[0]?.vlan ?? null,
    },
    jaringan: network
      ? {
        kapasitas_persen: Number(network.kapasitas_persen),
        bandwidth_mbps: Number(network.bandwidth_mbps),
        total_perangkat: Number(network.total_perangkat),
        ap_aktif: Number(network.ap_aktif),
        ap_down: Number(network.ap_down),
        recorded_at: network.recorded_at,
      }
      : null,
    tiket_terbaru: tickets,
    aktivitas: activities,
  });
}));

siswaRouter.patch('/me', asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const wantsPassword = body.password !== undefined || body.sandi !== undefined;

  if (wantsPassword) {
    const password = String(pick(body, ['password', 'sandi'], ''));
    const confirmation = String(pick(body, ['password_confirmation', 'sandi2', 'ulangi'], ''));

    assertValid(validate({ password, password_confirmation: confirmation }, {
      password: 'required|min:6|max:72',
      password_confirmation: 'required|same:password',
    }));

    await User.updatePassword(req.user.id, password);
    await Log.add(req.user.id, 'ganti_sandi', 'Mengganti kata sandi sendiri', req);

    const fresh = await User.find(req.user.id);
    sendOk(res, { user: User.publicView(fresh) }, 'Kata sandi berhasil diganti.');
    return;
  }

  const noHp = String(pick(body, ['no_hp', 'nohp'], '')).trim();

  assertValid(validate({ no_hp: noHp }, {
    no_hp: 'required|regex:^[0-9+\\s-]{8,20}$',
  }));

  await User.updateProfile(req.user.id, { no_hp: noHp });
  await Log.add(req.user.id, 'ganti_nohp', 'Mengganti nomor HP', req);

  const fresh = await User.find(req.user.id);
  sendOk(res, { user: User.publicView(fresh) }, 'Nomor HP berhasil diganti.');
}));
