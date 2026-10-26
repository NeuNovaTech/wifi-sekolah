import { db } from '../db.js';
import { now } from '../helpers.js';

export const NetworkStat = {
  async latest() {
    return db.get('SELECT * FROM network_stats ORDER BY recorded_at DESC, id DESC LIMIT 1');
  },

  async history(limit = 30) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 30));

    return db.all(
      `SELECT * FROM network_stats ORDER BY recorded_at DESC, id DESC LIMIT ${safeLimit}`,
    );
  },

  async create({ apAktif, apDown, totalPerangkat, bandwidthMbps, kapasitasPersen, vlan }) {
    await db.run(
      `INSERT INTO network_stats
        (recorded_at, ap_aktif, ap_down, total_perangkat, bandwidth_mbps, kapasitas_persen, vlan_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [now(), apAktif, apDown, totalPerangkat, bandwidthMbps, kapasitasPersen, JSON.stringify(vlan ?? {})],
    );
  },
};
