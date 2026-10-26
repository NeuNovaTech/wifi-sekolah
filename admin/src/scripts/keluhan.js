/**
 * Halaman keluhan admin: daftar tiket, filter, ubah status, ekspor CSV.
 */
(function () {
    'use strict';

    var UI = window.AdminUI || {};
    var semua = [];
    var ringkasan = {};

    var KELAS_KARTU = {
        selesai: ' tiket-card--selesai',
        ditolak: ' tiket-card--selesai'
    };

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

    function nilaiCari() {
        var atas = ambil('cari-keluhan');
        var bawah = ambil('cari');

        return String((bawah && bawah.value) || (atas && atas.value) || '').trim().toLowerCase();
    }

    function filterAktif() {
        return {
            q: nilaiCari(),
            kategori: (ambil('filter-kategori') && ambil('filter-kategori').value) || '',
            status: (ambil('filter-status') && ambil('filter-status').value) || ''
        };
    }

    function cocok(t, filter) {
        if (filter.status && t.status !== filter.status) {
            return false;
        }

        if (filter.kategori && t.kategori !== filter.kategori) {
            return false;
        }

        if (!filter.q) {
            return true;
        }

        var gabungan = [t.kode, t.isi, t.nama, t.nipd, t.kelas].join(' ').toLowerCase();

        return gabungan.indexOf(filter.q) !== -1;
    }

    function renderRingkasan() {
        var baru = Number(ringkasan.menunggu || 0);
        var diproses = Number(ringkasan.diproses || 0);
        var selesai = Number(ringkasan.selesai || 0);
        var ditolak = Number(ringkasan.ditolak || 0);
        var total = Number(ringkasan.total || semua.length);

        teks('stat-baru', baru);
        teks('stat-diproses', diproses);
        teks('stat-selesai', selesai);
        teks('stat-ditolak', ditolak);
        teks('ringkas-keluhan-atas', baru + ' tiket baru • ' + diproses + ' diproses • ' + selesai + ' selesai');

        var lonceng = ambil('lonceng-jumlah');

        if (lonceng) {
            lonceng.textContent = String(baru);
        }

        var jumlah = {
            '': total,
            menunggu: baru,
            diproses: diproses,
            selesai: selesai,
            ditolak: ditolak
        };

        var tabs = ambil('tab-keluhan');

        if (tabs) {
            tabs.querySelectorAll('.tab').forEach(function (tab) {
                var angka = tab.querySelector('b');
                var status = tab.getAttribute('data-status') || '';

                if (angka) {
                    angka.textContent = String(jumlah[status] || 0);
                }
            });
        }
    }

    function aksiKartu(t) {
        var tombol = [];

        if (t.status === 'menunggu') {
            tombol.push('<button type="button" class="btn btn--brand" data-aksi="proses">Proses</button>');
            tombol.push('<button type="button" class="btn btn--danger" data-aksi="tolak">Tolak</button>');
        } else if (t.status === 'diproses') {
            tombol.push('<button type="button" class="btn btn--ok" data-aksi="selesai">Selesaikan</button>');
        } else if (t.status === 'ditolak') {
            tombol.push('<button type="button" class="btn btn--ghost" data-aksi="buka">Buka Kembali</button>');
        }

        tombol.push('<button type="button" class="btn btn--ghost" data-aksi="detail">Detail</button>');

        return tombol.join('');
    }

    function render() {
        var kotak = ambil('daftar-keluhan');

        if (!kotak) {
            return;
        }

        var filter = filterAktif();
        var data = semua.filter(function (t) { return cocok(t, filter); });

        if (!data.length) {
            kotak.innerHTML = '<div class="kosong-admin">'
                + (semua.length
                    ? 'Tidak ada tiket yang cocok dengan pencarian/filter.'
                    : 'Belum ada tiket masuk. Keluhan siswa akan muncul di sini.')
                + '</div>';
        } else {
            kotak.innerHTML = data.map(function (t) {
                var status = t.status || 'menunggu';

                return '<article class="kartu tiket-card' + (KELAS_KARTU[status] || '') + '" data-id="' + esc(t.id) + '">'
                    + '<div class="tiket-head">'
                    + '<div><span class="tiket-id">' + esc(t.kode) + '</span>' + (UI.statusTiket ? UI.statusTiket(status) : esc(status)) + '</div>'
                    + '<small>' + esc(UI.relatif ? UI.relatif(t.created_at) : '') + '</small>'
                    + '</div>'
                    + '<b class="tiket-judul">' + esc(UI.labelKategori ? UI.labelKategori(t.kategori) : t.kategori) + ' — '
                    + esc(String(t.isi || '').slice(0, 70)) + (String(t.isi || '').length > 70 ? '…' : '') + '</b>'
                    + '<p class="tiket-desc">' + esc(t.isi) + '</p>'
                    + '<div class="tiket-pelapor">'
                    + '<span class="avatar-kecil">' + esc(UI.inisial ? UI.inisial(t.nama) : '?') + '</span>'
                    + '<div><b>' + esc(t.nama || '-') + '</b><small>NIPD ' + esc(t.nipd || '-') + ' • ' + esc(t.kelas || '-') + '</small></div>'
                    + '</div>'
                    + '<div class="tiket-meta">'
                    + '<span><i class="bi bi-tag"></i>' + esc(UI.labelKategori ? UI.labelKategori(t.kategori) : t.kategori) + '</span>'
                    + '<span><i class="bi bi-clock"></i>' + esc(UI.tanggal ? UI.tanggal(t.created_at) : '') + '</span>'
                    + '</div>'
                    + '<div class="tiket-aksi">' + aksiKartu(t) + '</div>'
                    + '</article>';
            }).join('');
        }

        kotak.querySelectorAll('[data-aksi]').forEach(function (tombol) {
            tombol.onclick = function () {
                var id = tombol.closest('.tiket-card').getAttribute('data-id');
                var aksi = tombol.getAttribute('data-aksi');
                var tiket = semua.filter(function (x) { return String(x.id) === String(id); })[0];

                if (!tiket) {
                    return;
                }

                if (aksi === 'detail') {
                    detail(tiket);
                    return;
                }

                if (aksi === 'tolak' && !window.confirm('Tolak tiket ' + tiket.kode + '? Pastikan alasannya sudah jelas untuk siswa.')) {
                    return;
                }

                ubahStatus(tiket, aksi === 'proses' ? 'diproses'
                    : aksi === 'selesai' ? 'selesai'
                        : aksi === 'tolak' ? 'ditolak'
                            : 'menunggu', tombol);
            };
        });

        teks('ringkas-keluhan', 'Menampilkan ' + data.length + ' dari ' + semua.length + ' tiket');
    }

    function ubahStatus(tiket, status, tombol) {
        if (tombol) {
            tombol.disabled = true;
        }

        Api.patch('admin/keluhan/' + tiket.id, { status: status }).then(function (response) {
            UI.toast(response.message || 'Status tiket diperbarui.', 'ok');
            UI.tutupModal();
            return muat();
        }).catch(function (error) {
            if (tombol) {
                tombol.disabled = false;
            }

            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function detail(t) {
        Api.get('admin/keluhan/' + t.id).then(function (response) {
            var d = response.data || {};

            tampilDetail(d.tiket || t, d.balasan || []);
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function chatHtml(balasan) {
        if (!balasan || !balasan.length) {
            return '<div class="chat-kosong">Belum ada balasan. Tulis balasan pertama di bawah.</div>';
        }

        return '<div class="chat-list">' + balasan.map(function (b) {
            var admin = b.role === 'admin';

            return '<div class="chat-item' + (admin ? ' chat-item--admin' : '') + '">'
                + '<div class="chat-meta"><b>' + esc(admin ? 'Operator' : (b.nama || 'Siswa')) + '</b>'
                + '<span>' + esc(UI.tanggal ? UI.tanggal(b.created_at) : '') + '</span></div>'
                + '<div class="chat-isi">' + esc(b.isi) + '</div>'
                + '</div>';
        }).join('') + '</div>';
    }

    function tampilDetail(t, balasan) {
        var aktif = t.status !== 'selesai' && t.status !== 'ditolak';
        var isi = '<div class="rincian">'
            + '<span>Kode</span><b>' + esc(t.kode) + '</b>'
            + '<span>Pelapor</span><b>' + esc(t.nama) + ' (' + esc(t.nipd) + ')</b>'
            + '<span>Kelas</span><b>' + esc(t.kelas || '-') + '</b>'
            + '<span>Kategori</span><b>' + esc(UI.labelKategori ? UI.labelKategori(t.kategori) : t.kategori) + '</b>'
            + '<span>Dikirim</span><b>' + esc(UI.tanggal ? UI.tanggal(t.created_at) : '') + '</b>'
            + '<span>Diperbarui</span><b>' + esc(UI.tanggal ? UI.tanggal(t.updated_at) : '') + '</b>'
            + '<span>Status</span><b>' + esc(UI.labelTiket ? UI.labelTiket(t.status) : t.status) + '</b>'
            + '</div>'
            + '<h4>Isi keluhan</h4>'
            + '<p style="white-space:pre-wrap;line-height:1.6">' + esc(t.isi) + '</p>'
            + '<h4>Percakapan</h4>'
            + chatHtml(balasan)
            + (aktif
                ? '<div class="chat-form">'
                    + '<textarea id="balas-isi" maxlength="1000" rows="3" placeholder="Tulis balasan untuk siswa..."></textarea>'
                    + '<div class="chat-form-bawah">'
                    + '<small>Balasan tampil di halaman Riwayat siswa.</small>'
                    + '<button type="button" class="btn btn--brand" id="kirim-balasan"><i class="bi bi-send"></i> Kirim Balasan</button>'
                    + '</div></div>'
                : '<div class="chat-kosong">Tiket sudah ditutup. Buka kembali tiket bila perlu dibalas.</div>');

        var aksi = [];

        if (t.status === 'menunggu') {
            aksi.push({
                label: 'Proses',
                kelas: 'btn--brand',
                onClick: function () { ubahStatus(t, 'diproses'); }
            });
            aksi.push({
                label: 'Tolak',
                kelas: 'btn--danger',
                onClick: function () {
                    if (window.confirm('Tolak tiket ' + t.kode + '?')) {
                        ubahStatus(t, 'ditolak');
                    }
                }
            });
        } else if (t.status === 'diproses') {
            aksi.push({
                label: 'Tandai Selesai',
                kelas: 'btn--ok',
                onClick: function () { ubahStatus(t, 'selesai'); }
            });
        } else if (t.status === 'selesai' || t.status === 'ditolak') {
            aksi.push({
                label: 'Buka Kembali',
                kelas: 'btn--ghost',
                onClick: function () { ubahStatus(t, 'menunggu'); }
            });
        }

        aksi.push({ label: 'Tutup', kelas: 'btn--ghost' });

        var layer = UI.bukaModal({
            judul: 'Tiket ' + t.kode,
            isi: isi,
            aksi: aksi
        });

        var tombolKirim = layer.querySelector('#kirim-balasan');
        var kotakBalas = layer.querySelector('#balas-isi');

        if (tombolKirim && kotakBalas) {
            window.setTimeout(function () { kotakBalas.focus(); }, 60);

            tombolKirim.onclick = function () {
                var nilai = kotakBalas.value.trim();

                if (!nilai) {
                    UI.toast('Tulis balasan dulu.', 'warn');
                    kotakBalas.focus();
                    return;
                }

                tombolKirim.disabled = true;
                tombolKirim.innerHTML = '<i class="bi bi-arrow-repeat"></i> Mengirim...';

                Api.post('admin/keluhan/' + t.id + '/reply', { balasan: nilai }).then(function (response) {
                    UI.toast(response.message || 'Balasan terkirim.', 'ok');
                    UI.tutupModal();
                    return muat();
                }).catch(function (error) {
                    tombolKirim.disabled = false;
                    tombolKirim.innerHTML = '<i class="bi bi-send"></i> Kirim Balasan';
                    UI.toast(UI.pesanError(error), 'bad');
                });
            };
        }
    }

    function ekspor() {
        var data = semua.filter(function (t) { return cocok(t, filterAktif()); });

        if (!data.length) {
            UI.toast('Tidak ada tiket untuk diekspor.', 'warn');
            return;
        }

        var baris = [['Kode', 'Tanggal', 'Nama', 'NIPD', 'Kelas', 'Kategori', 'Status', 'Isi']];

        data.forEach(function (t) {
            baris.push([
                t.kode,
                t.created_at,
                t.nama,
                t.nipd,
                t.kelas,
                UI.labelKategori ? UI.labelKategori(t.kategori) : t.kategori,
                UI.labelTiket ? UI.labelTiket(t.status) : t.status,
                t.isi
            ]);
        });

        UI.unduhCsv('keluhan-' + new Date().toISOString().slice(0, 10) + '.csv', baris);
        UI.toast(data.length + ' tiket diekspor.', 'ok');
    }

    function pasangFilter() {
        var atas = ambil('cari-keluhan');
        var bawah = ambil('cari');
        var kategori = ambil('filter-kategori');
        var status = ambil('filter-status');
        var tabs = ambil('tab-keluhan');
        var timer = null;

        function tunda() {
            window.clearTimeout(timer);
            timer = window.setTimeout(render, 200);
        }

        function sinkron(nilai, sumber) {
            if (atas && atas !== sumber) atas.value = nilai;
            if (bawah && bawah !== sumber) bawah.value = nilai;
        }

        [atas, bawah].forEach(function (input) {
            if (!input) {
                return;
            }

            input.addEventListener('input', function () {
                sinkron(input.value, input);
                tunda();
            });
        });

        if (kategori) kategori.onchange = render;

        if (status) {
            status.onchange = function () {
                if (tabs) {
                    tabs.querySelectorAll('.tab').forEach(function (tab) {
                        tab.classList.toggle('aktif', (tab.getAttribute('data-status') || '') === status.value);
                    });
                }

                render();
            };
        }

        if (tabs) {
            tabs.querySelectorAll('.tab').forEach(function (tab) {
                tab.onclick = function () {
                    var nilai = tab.getAttribute('data-status') || '';

                    tabs.querySelectorAll('.tab').forEach(function (lain) {
                        lain.classList.toggle('aktif', lain === tab);
                    });

                    if (status) {
                        status.value = nilai;
                    }

                    render();
                };
            });
        }

        var tombolEkspor = ambil('ekspor-keluhan');

        if (tombolEkspor) {
            tombolEkspor.onclick = ekspor;
        }
    }

    function muat() {
        return Api.get('admin/keluhan').then(function (response) {
            var d = response.data || {};

            semua = d.keluhan || [];
            ringkasan = d.ringkasan || {};

            renderRingkasan();
            render();
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    siap(function () {
        pasangFilter();
        muat();
    });
})();
