/**
 * Halaman log admin: ringkasan, pencarian, filter jenis/tanggal, dan ekspor CSV.
 * Data diambil dari GET /admin/log (maks. 500 aktivitas terbaru).
 */
(function () {
    'use strict';

    var UI = window.AdminUI || {};
    var semua = [];

    var JENIS = {
        register: 'pendaftaran',
        tambah_siswa: 'pendaftaran',
        ubah_status_siswa: 'pendaftaran',
        ubah_data_siswa: 'pendaftaran',
        kirim_keluhan: 'keluhan',
        ubah_status_tiket: 'keluhan',
        ganti_nohp: 'akun',
        ganti_sandi: 'akun',
        reset_sandi: 'akun',
        tambah_perangkat: 'akun',
        hapus_perangkat: 'akun',
        login: 'sesi',
        logout: 'sesi'
    };

    var IKON = {
        login: 'box-arrow-in-right',
        logout: 'box-arrow-right',
        register: 'person-plus',
        tambah_siswa: 'person-plus',
        ubah_status_siswa: 'person-check',
        ubah_data_siswa: 'person-vcard',
        reset_sandi: 'key',
        ubah_status_tiket: 'headset',
        kirim_keluhan: 'chat-left-text',
        ganti_nohp: 'telephone',
        ganti_sandi: 'key',
        tambah_perangkat: 'phone',
        hapus_perangkat: 'trash'
    };

    var WARNA = {
        login: 'timeline-ikon--ok',
        logout: 'timeline-ikon--netral',
        register: 'timeline-ikon--ok',
        tambah_siswa: 'timeline-ikon--ok',
        ubah_status_siswa: 'timeline-ikon--ok',
        reset_sandi: 'timeline-ikon--warn',
        tambah_perangkat: 'timeline-ikon--netral',
        ganti_nohp: 'timeline-ikon--netral',
        ganti_sandi: 'timeline-ikon--warn',
        kirim_keluhan: 'timeline-ikon--warn',
        ubah_status_tiket: 'timeline-ikon--warn'
    };

    function esc(v) {
        return UI.esc ? UI.esc(v) : String(v === null || v === undefined ? '' : v);
    }

    function teks(id, v) {
        if (UI.teks) {
            UI.teks(id, v);
        }
    }

    function ambil(id) {
        return document.getElementById(id);
    }

    function siap(fn) {
        if (UI.siap) {
            UI.siap(fn);
        } else {
            fn();
        }
    }

    function keTanggal(nilai) {
        if (!nilai) {
            return null;
        }

        var d = new Date(String(nilai).replace(' ', 'T'));

        return isNaN(d.getTime()) ? null : d;
    }

    function kunciHari(d) {
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function labelHari(d) {
        var hariIni = new Date();
        var kemarin = new Date();

        kemarin.setDate(kemarin.getDate() - 1);

        if (kunciHari(d) === kunciHari(hariIni)) {
            return 'Hari ini';
        }

        if (kunciHari(d) === kunciHari(kemarin)) {
            return 'Kemarin';
        }

        return d.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function jam(d) {
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function nilaiCari() {
        var atas = ambil('cari-log-atas');
        var bawah = ambil('cari-log');

        return String((bawah && bawah.value) || (atas && atas.value) || '').trim().toLowerCase();
    }

    function termasukTanggal(d, pilihan) {
        if (!pilihan) {
            return true;
        }

        var sekarang = new Date();

        if (pilihan === 'hari-ini') {
            return kunciHari(d) === kunciHari(sekarang);
        }

        var hari = pilihan === '7-hari' ? 7 : 30;
        var batas = new Date(sekarang.getTime() - hari * 24 * 60 * 60 * 1000);

        return d >= batas;
    }

    function cocok(log, filter) {
        if (filter.jenis && (JENIS[log.aksi] || 'lain') !== filter.jenis) {
            return false;
        }

        var d = keTanggal(log.created_at);

        if (!d || !termasukTanggal(d, filter.tanggal)) {
            return false;
        }

        if (!filter.q) {
            return true;
        }

        var gabungan = [log.aksi, log.detail, log.nama, log.nipd, log.ip]
            .join(' ')
            .toLowerCase();

        return gabungan.indexOf(filter.q) !== -1;
    }

    function renderRingkasan() {
        var hariIni = 0;
        var pendaftaran = 0;
        var keluhan = 0;

        semua.forEach(function (log) {
            var d = keTanggal(log.created_at);
            var jenis = JENIS[log.aksi] || 'lain';

            if (d && kunciHari(d) === kunciHari(new Date())) {
                hariIni += 1;
            }

            if (jenis === 'pendaftaran') {
                pendaftaran += 1;
            } else if (jenis === 'keluhan') {
                keluhan += 1;
            }
        });

        teks('stat-hari-ini', hariIni);
        teks('stat-pendaftaran', pendaftaran);
        teks('stat-keluhan-log', keluhan);
        teks('stat-total-log', semua.length);
        teks('ringkas-log-atas', semua.length
            ? semua.length + ' aktivitas tercatat'
            : 'Belum ada aktivitas');
    }

    function itemLog(log) {
        var d = keTanggal(log.created_at);
        var ikon = IKON[log.aksi] || 'dot';
        var warna = WARNA[log.aksi] || 'timeline-ikon--netral';
        var siapa = [];

        if (log.nama) {
            siapa.push(log.nama);
        }

        if (log.nipd) {
            siapa.push(log.nipd);
        }

        if (log.ip && log.ip !== '::1' && log.ip !== '127.0.0.1') {
            siapa.push(log.ip);
        }

        return '<div class="timeline-item">'
            + '<span class="timeline-ikon ' + warna + '"><i class="bi bi-' + ikon + '"></i></span>'
            + '<div class="timeline-isi">'
            + '<div class="timeline-isi-top"><b>' + esc(log.detail || log.aksi) + '</b>'
            + '<span class="timeline-waktu">' + (d ? esc(jam(d)) : '—') + '</span></div>'
            + (siapa.length ? '<p>' + esc(siapa.join(' · ')) + '</p>' : '')
            + '</div></div>';
    }

    function render() {
        var kotak = ambil('daftar-log');

        if (!kotak) {
            return;
        }

        var filter = {
            q: nilaiCari(),
            jenis: (ambil('filter-jenis') && ambil('filter-jenis').value) || '',
            tanggal: (ambil('filter-tanggal') && ambil('filter-tanggal').value) || ''
        };

        var data = semua.filter(function (log) { return cocok(log, filter); });

        if (!data.length) {
            kotak.innerHTML = '<div class="kosong-admin">'
                + (semua.length
                    ? 'Tidak ada aktivitas yang cocok dengan pencarian/filter.'
                    : 'Belum ada aktivitas tercatat.')
                + '</div>';
        } else {
            var html = '';
            var hariTerakhir = '';

            data.forEach(function (log) {
                var d = keTanggal(log.created_at);

                if (!d) {
                    return;
                }

                var kunci = kunciHari(d);

                if (kunci !== hariTerakhir) {
                    if (hariTerakhir !== '') {
                        html += '</div>';
                    }

                    html += '<div class="log-hari"><b>' + esc(labelHari(d)) + '</b>'
                        + '<span>' + esc(d.toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        })) + '</span></div><div class="timeline">';

                    hariTerakhir = kunci;
                }

                html += itemLog(log);
            });

            if (hariTerakhir !== '') {
                html += '</div>';
            }

            kotak.innerHTML = html;
        }

        teks('ringkas-log', 'Menampilkan ' + data.length + ' dari ' + semua.length + ' aktivitas.');
    }

    function ekspor() {
        if (!semua.length) {
            if (UI.toast) {
                UI.toast('Belum ada log untuk diekspor.', 'merah');
            }

            return;
        }

        var baris = [['Waktu', 'Jenis', 'Aktivitas', 'Pengguna', 'NIPD', 'IP']];

        semua.forEach(function (log) {
            var d = keTanggal(log.created_at);

            baris.push([
                d ? d.toLocaleString('id-ID') : (log.created_at || ''),
                JENIS[log.aksi] || 'lain',
                log.detail || log.aksi,
                log.nama || '',
                log.nipd || '',
                log.ip || ''
            ]);
        });

        if (UI.unduhCsv) {
            UI.unduhCsv('log-aktivitas-' + new Date().toISOString().slice(0, 10) + '.csv', baris);
        }

        if (UI.toast) {
            UI.toast('Log berhasil diekspor.', 'hijau');
        }
    }

    function gagal(error) {
        var kotak = ambil('daftar-log');

        if (kotak) {
            kotak.innerHTML = '<div class="kosong-admin">'
                + esc(UI.pesanError ? UI.pesanError(error) : 'Gagal memuat log.')
                + '</div>';
        }

        teks('ringkas-log', 'Gagal memuat log.');

        if (UI.toast) {
            UI.toast(UI.pesanError ? UI.pesanError(error) : 'Gagal memuat log.', 'merah');
        }
    }

    function muat() {
        if (!window.Api) {
            gagal(new Error('Klien API tidak termuat.'));
            return;
        }

        Api.get('admin/log', { limit: 500 }).then(function (response) {
            semua = (response && response.data && response.data.log) || [];
            renderRingkasan();
            render();
        }).catch(gagal);
    }

    siap(function () {
        var cariBawah = ambil('cari-log');
        var cariAtas = ambil('cari-log-atas');
        var filterJenis = ambil('filter-jenis');
        var filterTanggal = ambil('filter-tanggal');

        function sinkron(asal, tujuan) {
            if (!asal || !tujuan) {
                return;
            }

            asal.addEventListener('input', function () {
                tujuan.value = asal.value;
                render();
            });
        }

        sinkron(cariBawah, cariAtas);
        sinkron(cariAtas, cariBawah);

        if (filterJenis) {
            filterJenis.addEventListener('change', render);
        }

        if (filterTanggal) {
            filterTanggal.addEventListener('change', render);
        }

        var tombolEkspor = ambil('ekspor-log');

        if (tombolEkspor) {
            tombolEkspor.addEventListener('click', ekspor);
        }

        muat();
    });
})();
