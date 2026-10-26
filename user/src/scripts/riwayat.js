/**
 * Riwayat tiket siswa dari database, termasuk percakapan dengan operator.
 */
(function () {
    'use strict';

    var kotak = document.getElementById('daftar-riwayat');
    var filter = document.getElementById('filter-tiket');
    var alertBox = document.getElementById('riwayat-alert');

    var semua = [];
    var statusAktif = '';
    var bukaOtomatis = null;

    var LABEL_STATUS = {
        menunggu: 'Menunggu Operator',
        diproses: 'Sedang Diproses',
        selesai: 'Selesai',
        ditolak: 'Ditolak'
    };

    var KELAS_STATUS = {
        menunggu: 'status--menunggu',
        diproses: 'status--diproses',
        selesai: 'status--selesai',
        ditolak: 'status--ditolak'
    };

    var LABEL_KATEGORI = {
        koneksi: 'Koneksi',
        kecepatan: 'Kecepatan',
        perangkat: 'Perangkat',
        akun: 'Akun',
        lain: 'Lainnya'
    };

    function esc(nilai) {
        return String(nilai === null || nilai === undefined ? '' : nilai)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tanggal(nilai) {
        if (!nilai) {
            return '—';
        }

        var d = new Date(String(nilai).replace(' ', 'T'));

        if (isNaN(d.getTime())) {
            return String(nilai);
        }

        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }) + ' • ' + d.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function tampil(pesan, jenis) {
        if (!alertBox) {
            return;
        }

        alertBox.textContent = pesan;
        alertBox.hidden = false;
        alertBox.className = 'notif' + (jenis ? ' ' + jenis : '');

        window.setTimeout(function () {
            if (alertBox) {
                alertBox.hidden = true;
            }
        }, 5000);
    }

    function aktif(t) {
        return t.status === 'menunggu' || t.status === 'diproses';
    }

    function kartu(t) {
        var status = t.status || 'menunggu';
        var jumlah = Number(t.jumlah_balasan || 0);
        var bisaBalas = aktif(t);

        var html = '<div class="tiket-card" data-id="' + esc(t.id) + '">'
            + '<div class="tiket-head">'
            + '<b>' + esc(t.kode) + '</b>'
            + '<span class="status ' + (KELAS_STATUS[status] || '') + '">'
            + esc(LABEL_STATUS[status] || status) + '</span>'
            + '</div>'
            + '<small>' + esc(tanggal(t.created_at)) + '</small>'
            + '<span class="tiket-kategori">' + esc(LABEL_KATEGORI[t.kategori] || t.kategori || 'Lainnya') + '</span>'
            + '<p>' + esc(t.isi) + '</p>';

        if (jumlah > 0 && t.balasan_terakhir) {
            html += '<div class="balasan-preview">'
                + '<b><i class="bi bi-chat-left-text"></i> Balasan operator</b>'
                + '<span>' + esc(t.balasan_terakhir) + '</span>'
                + '</div>';
        }

        if (bisaBalas || jumlah > 0) {
            html += '<button type="button" class="btn-percakapan" data-id="' + esc(t.id) + '">'
                + '<i class="bi bi-chat-dots"></i> '
                + (bisaBalas ? 'Balas / Percakapan' : 'Lihat Percakapan')
                + (jumlah > 0 ? ' (' + jumlah + ')' : '')
                + '</button>';
        }

        html += '<div class="panel-balasan" data-panel="' + esc(t.id) + '" hidden></div></div>';

        return html;
    }

    function gambar() {
        if (!kotak) {
            return;
        }

        var data = statusAktif
            ? semua.filter(function (t) { return t.status === statusAktif; })
            : semua;

        if (!data.length) {
            kotak.innerHTML = '<div class="kosong">'
                + (semua.length
                    ? 'Tidak ada tiket dengan status ini.'
                    : 'Belum ada tiket. Kirim keluhan dulu ya.')
                + '</div>';
            return;
        }

        kotak.innerHTML = data.map(kartu).join('');

        kotak.querySelectorAll('.btn-percakapan').forEach(function (tombol) {
            tombol.onclick = function () {
                bukaPanel(tombol.getAttribute('data-id'));
            };
        });

        if (bukaOtomatis) {
            var id = bukaOtomatis;

            bukaOtomatis = null;

            var target = kotak.querySelector('.btn-percakapan[data-id="' + id + '"]');

            if (target) {
                bukaPanel(id);
            }
        }
    }

    function balasanHtml(balasan) {
        if (!balasan.length) {
            return '<div class="memuat">Belum ada balasan. Operator akan menjawab lewat halaman ini.</div>';
        }

        return '<div class="balasan-list">' + balasan.map(function (b) {
            var operator = b.role === 'admin';

            return '<div class="balasan-item' + (operator ? ' balasan-item--operator' : '') + '">'
                + '<div class="balasan-meta"><b>' + esc(operator ? 'Operator' : 'Kamu') + '</b>'
                + '<span>' + esc(tanggal(b.created_at)) + '</span></div>'
                + '<p>' + esc(b.isi) + '</p>'
                + '</div>';
        }).join('') + '</div>';
    }

    function isiPanel(panel, tiket, balasan) {
        var bisaBalas = aktif(tiket);

        panel.innerHTML = balasanHtml(balasan)
            + (bisaBalas
                ? '<form class="form-balasan">'
                    + '<textarea maxlength="1000" rows="2" placeholder="Tulis balasan untuk operator..." required></textarea>'
                    + '<button type="submit"><i class="bi bi-send"></i> Kirim</button>'
                    + '</form>'
                : '<div class="memuat">Tiket sudah ditutup. Buat tiket baru bila masih ada kendala.</div>');

        panel.setAttribute('data-terisi', '1');

        var form = panel.querySelector('.form-balasan');

        if (!form) {
            return;
        }

        form.onsubmit = function (event) {
            event.preventDefault();

            var area = form.querySelector('textarea');
            var tombol = form.querySelector('button');
            var nilai = String(area.value || '').trim();

            if (!nilai) {
                tampil('Tulis balasan dulu ya.', 'merah');
                area.focus();
                return;
            }

            tombol.disabled = true;
            tombol.innerHTML = '<i class="bi bi-arrow-repeat"></i> Mengirim...';

            window.Api.post('keluhan/' + tiket.id + '/reply', { balasan: nilai })
                .then(function (response) {
                    tampil(
                        (response && response.message) || 'Balasan terkirim ke operator.',
                        'hijau'
                    );

                    bukaOtomatis = String(tiket.id);
                    return muat();
                })
                .catch(function (error) {
                    tombol.disabled = false;
                    tombol.innerHTML = '<i class="bi bi-send"></i> Kirim';
                    tampil(
                        (error && error.message) || 'Gagal mengirim balasan.',
                        'merah'
                    );
                });
        };
    }

    function bukaPanel(id) {
        var panel = kotak.querySelector('.panel-balasan[data-panel="' + id + '"]');

        if (!panel) {
            return;
        }

        if (!panel.hidden) {
            panel.hidden = true;
            return;
        }

        panel.hidden = false;

        if (panel.getAttribute('data-terisi') === '1') {
            return;
        }

        panel.innerHTML = '<div class="memuat">Memuat percakapan…</div>';

        window.Api.get('keluhan/' + id).then(function (response) {
            var d = response.data || {};

            isiPanel(panel, d.tiket || {}, d.balasan || []);
        }).catch(function (error) {
            panel.innerHTML = '<div class="memuat">'
                + esc((error && error.message) || 'Gagal memuat percakapan.')
                + '</div>';
        });
    }

    function hitung() {
        if (!filter) {
            return;
        }

        var jumlah = { '': semua.length, menunggu: 0, diproses: 0, selesai: 0 };

        semua.forEach(function (t) {
            if (jumlah[t.status] !== undefined) {
                jumlah[t.status] += 1;
            }
        });

        filter.querySelectorAll('.tab-riwayat').forEach(function (tab) {
            var status = tab.getAttribute('data-status') || '';
            var angka = tab.querySelector('b');

            if (angka) {
                angka.textContent = String(jumlah[status] || 0);
            }
        });
    }

    function pasangFilter() {
        if (!filter) {
            return;
        }

        filter.querySelectorAll('.tab-riwayat').forEach(function (tab) {
            tab.onclick = function () {
                statusAktif = tab.getAttribute('data-status') || '';

                filter.querySelectorAll('.tab-riwayat').forEach(function (lain) {
                    lain.classList.toggle('aktif', lain === tab);
                });

                gambar();
            };
        });
    }

    function muat() {
        return window.Api.get('keluhan').then(function (response) {
            var data = response.data || {};
            semua = data.keluhan || [];

            hitung();
            gambar();
        }).catch(function (error) {
            if (error && error.status === 401) {
                window.location.replace('index.html');
                return;
            }

            if (kotak) {
                kotak.innerHTML = '<div class="kosong">Gagal memuat riwayat. '
                    + esc(error && error.message ? error.message : 'Coba muat ulang halaman.') + '</div>';
            }
        });
    }

    pasangFilter();

    if (new URLSearchParams(window.location.search).get('kirim') === '1') {
        tampil('Keluhan berhasil dikirim. Operator akan menindaklanjuti.', 'hijau');
    }

    if (window.UserReady && typeof window.UserReady.then === 'function') {
        window.UserReady.then(function (user) {
            if (user) {
                muat();
            }
        });
    } else {
        muat();
    }
})();
