/**
 * Monitoring jaringan.
 *
 * Saat NETWORK_SOURCE=simulasi (default), daftar AP dan angka klien dibuat
 * oleh backend agar alur sistem terlihat lengkap tanpa router. Data
 * perangkat tetap berasal dari pendaftaran siswa. Panel diberi label
 * "Simulasi" supaya tidak dianggap data jaringan asli.
 */
(function () {
    'use strict';

    var UI = window.AdminUI || {};
    var semua = [];
    var daftarVlan = [];

    function esc(v) { return UI.esc ? UI.esc(v) : String(v == null ? '' : v); }
    function teks(id, v) { if (UI.teks) UI.teks(id, v); }
    function ambil(id) { return document.getElementById(id); }

    function siap(fn) {
        if (UI.siap) {
            UI.siap(fn);
        } else {
            fn();
        }
    }

    function chipStatus(status) {
        if (status === 'diblokir') {
            return '<span class="chip chip--bad">Diblokir</span>';
        }

        return '<span class="chip chip--ok">Aktif</span>';
    }

    function renderRingkasan(ringkasan, mode) {
        var total = Number(ringkasan && ringkasan.total_perangkat) || semua.length;
        var vlanAktif = daftarVlan.filter(function (v) {
            return v.vlan !== null && v.vlan !== undefined;
        }).length;
        var simulasi = mode === 'simulasi';

        teks('stat-perangkat', total);
        teks('stat-vlan', vlanAktif);
        teks('stat-ap', ringkasan && ringkasan.ap_aktif != null ? ringkasan.ap_aktif : '—');
        teks('stat-ap-down', ringkasan && ringkasan.ap_down != null ? ringkasan.ap_down : '—');
        teks('sub-ap', simulasi ? 'mode simulasi' : 'butuh integrasi router');
        teks('sub-ap-down', simulasi ? 'mode simulasi' : 'belum dipantau');

        var online = Number(ringkasan && ringkasan.pengguna_online) || 0;
        var klien = ringkasan && ringkasan.total_klien != null ? Number(ringkasan.total_klien) : null;

        teks('ringkas-monitoring', total + ' perangkat terdaftar '
            + '• ' + vlanAktif + ' VLAN terpakai '
            + '• ' + online + ' perangkat siswa online '
            + (klien !== null ? '• ' + klien + ' klien aktif (simulasi)' : '• status AP belum terhubung'));

        var chip = ambil('chip-vlan');

        if (chip) {
            chip.textContent = vlanAktif + ' VLAN';
        }

        var bannerJudul = ambil('banner-jaringan-judul');
        var bannerTeks = ambil('banner-jaringan-teks');
        var chipAp = ambil('chip-ap');
        var subAp = ambil('sub-daftar-ap');

        if (simulasi) {
            if (bannerJudul) bannerJudul.textContent = 'Mode simulasi aktif';
            if (bannerTeks) {
                bannerTeks.textContent = 'Router/controller sekolah belum terhubung. Data Access Point, jumlah klien, beban, dan kapasitas di halaman ini dibuat oleh aplikasi agar alur sistem terlihat lengkap. Data perangkat di bawah tetap berasal dari pendaftaran siswa.';
            }
            if (chipAp) {
                chipAp.textContent = 'Simulasi';
                chipAp.className = 'chip chip--blue';
            }
            if (subAp) subAp.textContent = 'Data simulasi • ' + (klien || 0) + ' klien aktif';
        } else {
            if (bannerJudul) bannerJudul.textContent = 'Integrasi perangkat jaringan belum aktif';
            if (bannerTeks) {
                bannerTeks.textContent = 'Status AP, jumlah klien per AP, beban, dan kapasitas jaringan baru tampil setelah router/controller sekolah terhubung. Data perangkat di bawah berasal dari pendaftaran akun siswa.';
            }
            if (chipAp) {
                chipAp.textContent = 'Belum terhubung';
                chipAp.className = 'chip chip--abu';
            }
            if (subAp) subAp.textContent = 'Menunggu koneksi ke controller/router sekolah';
        }
    }

    function renderAp(daftar, mode) {
        var kotak = ambil('daftar-ap');

        if (!kotak) {
            return;
        }

        if (!daftar || !daftar.length) {
            kotak.innerHTML = '<div class="kosong-admin">Belum ada access point yang terhubung. '
                + 'Setelah integrasi SNMP/API router tersedia, daftar AP muncul di sini otomatis.</div>';
            return;
        }

        kotak.innerHTML = daftar.map(function (ap) {
            var beban = Math.max(0, Math.min(100, Number(ap.beban) || 0));
            var aktif = ap.status === 'aktif';

            return '<div class="ap-row">'
                + '<div class="ap-nama"><b>' + esc(ap.nama) + '</b>'
                + '<small>' + esc(ap.lokasi) + ' • VLAN ' + esc(ap.vlan) + '</small></div>'
                + '<div class="ap-beban">'
                + '<div class="track"><div style="width:' + Math.max(2, beban) + '%"></div></div>'
                + '<small>' + beban + '% beban</small></div>'
                + '<div class="ap-status"><b>' + (aktif ? ap.klien + ' klien' : '—') + '</b>'
                + (aktif
                    ? '<span class="chip chip--ok">Online</span>'
                    : '<span class="chip chip--bad">Down</span>')
                + '</div></div>';
        }).join('');

        if (mode !== 'simulasi') {
            teks('sub-daftar-ap', 'Dibaca dari controller/router');
        }
    }

    function filterAktif() {
        return {
            q: ((ambil('cari-tabel') && ambil('cari-tabel').value) || '').trim().toLowerCase(),
            vlan: (ambil('filter-vlan') && ambil('filter-vlan').value) || ''
        };
    }

    function cocok(p, filter) {
        if (filter.vlan !== '' && String(p.vlan === null || p.vlan === undefined ? '' : p.vlan) !== filter.vlan) {
            return false;
        }

        if (!filter.q) {
            return true;
        }

        var gabungan = [p.nama_perangkat, p.tipe, p.mac, p.nama_siswa, p.nipd, p.kelas]
            .join(' ')
            .toLowerCase();

        return gabungan.indexOf(filter.q) !== -1;
    }

    function renderTabel() {
        var tabel = ambil('tabel-perangkat');

        if (!tabel) {
            return;
        }

        var filter = filterAktif();
        var data = semua.filter(function (p) { return cocok(p, filter); });

        if (!data.length) {
            tabel.innerHTML = '<tr><td colspan="7"><div class="kosong-admin">'
                + (semua.length
                    ? 'Tidak ada perangkat yang cocok dengan pencarian/filter.'
                    : 'Belum ada perangkat yang didaftarkan siswa.')
                + '</div></td></tr>';
        } else {
            tabel.innerHTML = data.map(function (p) {
                var namaPerangkat = p.nama_perangkat || 'Perangkat';

                return '<tr>'
                    + '<td data-label="Perangkat"><div class="sel">'
                    + '<span class="avatar-kecil">' + esc(UI.inisial ? UI.inisial(namaPerangkat) : '?') + '</span>'
                    + '<div><b>' + esc(namaPerangkat) + '</b><small>' + esc(p.tipe || 'Tipe tidak diisi') + '</small></div>'
                    + '</div></td>'
                    + '<td data-label="Siswa"><div><b>' + esc(p.nama_siswa || '-') + '</b>'
                    + '<small>' + esc(p.nipd || '-') + ' • ' + esc(p.kelas || '-') + '</small></div></td>'
                    + '<td data-label="MAC"><span style="font-family:ui-monospace,monospace;font-size:12px">' + esc(p.mac) + '</span></td>'
                    + '<td data-label="VLAN">' + (p.vlan === null || p.vlan === undefined ? '<span style="color:#95a3b8">—</span>' : 'VLAN ' + esc(p.vlan)) + '</td>'
                    + '<td data-label="IP">' + (p.ip ? esc(p.ip) : '<span style="color:#95a3b8" title="Diisi otomatis setelah integrasi DHCP/router">—</span>') + '</td>'
                    + '<td data-label="Status">' + (p.online
                        ? '<span class="chip chip--ok">Online</span>'
                        : '<span class="chip chip--netral">Offline</span>') + '</td>'
                    + '<td data-label="Terdaftar">' + esc(UI.tanggal ? UI.tanggal(p.terdaftar_at, false) : '—') + '</td>'
                    + '</tr>';
            }).join('');
        }

        teks('ringkas-perangkat', 'Menampilkan ' + data.length + ' dari ' + semua.length + ' perangkat terdaftar');
    }

    function renderVlan() {
        var kotak = ambil('daftar-vlan');

        if (!kotak) {
            return;
        }

        var data = daftarVlan.filter(function (v) {
            return v.vlan !== null && v.vlan !== undefined;
        });

        if (!data.length) {
            kotak.innerHTML = '<div class="kosong-admin">Belum ada perangkat dengan VLAN. '
                + 'Siswa dapat mengisi VLAN saat menambah perangkat.</div>';
            return;
        }

        var maks = Math.max.apply(null, [1].concat(data.map(function (v) { return Number(v.jumlah) || 0; })));

        kotak.innerHTML = data.map(function (v) {
            var jumlah = Number(v.jumlah) || 0;
            var persen = Math.max(4, Math.round((jumlah / maks) * 100));

            return '<div class="vlan-row">'
                + '<div class="vlan-label"><b>VLAN ' + esc(v.vlan) + '</b><small>terdaftar</small></div>'
                + '<div class="track"><div style="width:' + persen + '%"></div></div>'
                + '<b class="vlan-val">' + jumlah + '</b>'
                + '</div>';
        }).join('');
    }

    function isiFilterVlan() {
        var pilih = ambil('filter-vlan');

        if (!pilih) {
            return;
        }

        var nilai = pilih.value;

        pilih.innerHTML = '<option value="">Semua VLAN</option>'
            + daftarVlan
                .filter(function (v) { return v.vlan !== null && v.vlan !== undefined; })
                .map(function (v) {
                    return '<option value="' + esc(v.vlan) + '">VLAN ' + esc(v.vlan) + ' (' + esc(v.jumlah) + ')</option>';
                })
                .join('');

        pilih.value = nilai;
    }

    function pasangFilter() {
        var cari = ambil('cari-tabel');
        var vlan = ambil('filter-vlan');

        if (cari) {
            var timer = null;

            cari.addEventListener('input', function () {
                window.clearTimeout(timer);
                timer = window.setTimeout(renderTabel, 200);
            });
        }

        if (vlan) {
            vlan.onchange = renderTabel;
        }
    }

    function muat() {
        return Api.get('admin/monitoring').then(function (response) {
            var d = response.data || {};

            semua = d.perangkat || [];
            daftarVlan = d.vlan || [];

            isiFilterVlan();
            renderRingkasan(d.ringkasan || {}, d.mode);
            renderAp(d.ap || [], d.mode);
            renderTabel();
            renderVlan();
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    siap(function () {
        pasangFilter();
        muat();
    });
})();
