/**
 * Dashboard admin: statistik, antrian pendaftar, tiket, VLAN, log, grafik.
 * Data jaringan (AP, bandwidth, sinyal) tidak dipalsukan; ditandai belum terhubung.
 */
(function () {
    'use strict';

    var UI = window.AdminUI || {};
    var data = null;

    function esc(v) { return UI.esc ? UI.esc(v) : String(v == null ? '' : v); }
    function teks(id, v) { if (UI.teks) UI.teks(id, v); }

    function siap(fn) {
        if (UI.siap) {
            UI.siap(fn);
        } else {
            fn();
        }
    }

    function hari(tanggal) {
        var d = new Date(String(tanggal) + 'T00:00:00');

        if (isNaN(d.getTime())) {
            return '—';
        }

        return d.toLocaleDateString('id-ID', { weekday: 'short' });
    }

    function renderRingkasan(d) {
        teks('stat-siswa', d.total_siswa);
        teks('stat-pending', d.pending);
        teks('stat-online', d.total_perangkat);
        teks('stat-keluhan', d.tiket_baru);

        var simulasi = d.jaringan_mode === 'simulasi';

        teks('sub-pending', 'perlu ditinjau');
        teks('sub-online', simulasi
            ? (Number(d.online) || 0) + ' online • simulasi'
            : 'terdaftar di akun siswa');
        teks('sub-keluhan', d.ringkasan_tiket && d.ringkasan_tiket.menunggu
            ? d.ringkasan_tiket.menunggu + ' menunggu'
            : 'tidak ada antrian');

        teks('jumlah-pending', d.pending);
        teks('jumlah-keluhan', d.tiket_baru);

        var rTiket = d.ringkasan_tiket || {};
        var menunggu = Number(rTiket.menunggu || 0);
        var diproses = Number(rTiket.diproses || 0);

        teks('ket-tiket', menunggu + ' menunggu • ' + diproses + ' diproses');

        var navSiswa = document.getElementById('nav-siswa');
        var navKeluhan = document.getElementById('nav-keluhan');

        if (navSiswa) navSiswa.textContent = String(d.total_siswa || 0);
        if (navKeluhan) navKeluhan.textContent = String(d.tiket_baru || 0);

        var tanggal = document.getElementById('tanggal');

        if (tanggal) {
            tanggal.textContent = new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        teks('ringkas-antrian', d.pending + ' siswa · ' + d.tiket_baru + ' tiket');

        var lonceng = document.getElementById('lonceng-jumlah');

        if (lonceng) {
            lonceng.textContent = String((d.pending || 0) + (d.tiket_baru || 0));
        }
    }

    function renderPending(daftar) {
        var kotak = document.getElementById('daftar-pending');

        if (!kotak) {
            return;
        }

        if (!daftar || !daftar.length) {
            kotak.innerHTML = '<div class="kosong-admin">Tidak ada pendaftar yang menunggu. Semua sudah ditinjau.</div>';
            return;
        }

        kotak.innerHTML = daftar.map(function (s) {
            return '<div class="baris-kerja" data-id="' + esc(s.id) + '">'
                + '<input type="checkbox" class="pilih-pending" aria-label="Pilih ' + esc(s.nama) + '" value="' + esc(s.id) + '">'
                + '<span class="avatar-kecil">' + esc(UI.inisial ? UI.inisial(s.nama) : '?') + '</span>'
                + '<div class="info-kerja"><b>' + esc(s.nama) + '</b>'
                + '<small>' + esc(s.nipd) + ' • ' + esc(s.kelas) + ' • ' + esc(UI.relatif ? UI.relatif(s.created_at) : '') + '</small></div>'
                + '<div class="aksi-kerja">'
                + '<button type="button" class="btn btn--ok" data-aksi="approve">Setujui</button>'
                + '<button type="button" class="btn btn--danger" data-aksi="reject">Tolak</button>'
                + '</div></div>';
        }).join('');

        kotak.querySelectorAll('[data-aksi]').forEach(function (tombol) {
            tombol.onclick = function () {
                var baris = tombol.closest('.baris-kerja');
                var id = baris.getAttribute('data-id');
                var aksi = tombol.getAttribute('data-aksi');

                ubahSiswa(id, aksi, tombol);
            };
        });
    }

    function ubahSiswa(id, aksi, tombol) {
        if (!window.confirm(aksi === 'approve'
            ? 'Setujui pendaftaran siswa ini?'
            : 'Tolak pendaftaran siswa ini?')) {
            return;
        }

        if (tombol) {
            tombol.disabled = true;
        }

        Api.patch('admin/siswa/' + id, { action: aksi }).then(function (response) {
            UI.toast(response.message || 'Status berhasil diubah.', 'ok');
            muat();
        }).catch(function (error) {
            if (tombol) {
                tombol.disabled = false;
            }

            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function pasangBulk() {
        var label = document.querySelector('.pilih-semua');

        if (!label) {
            return;
        }

        var semua = document.getElementById('pilih-semua');

        if (semua) {
            semua.onchange = function () {
                document.querySelectorAll('.pilih-pending').forEach(function (cb) {
                    cb.checked = semua.checked;
                });
            };
        }

        if (document.getElementById('setujui-terpilih')) {
            return;
        }

        var tombol = document.createElement('button');
        tombol.type = 'button';
        tombol.id = 'setujui-terpilih';
        tombol.className = 'btn btn--ok btn--sm';
        tombol.style.marginLeft = '8px';
        tombol.textContent = 'Setujui terpilih';
        label.parentElement.appendChild(tombol);

        tombol.onclick = function () {
            var dipilih = Array.prototype.slice.call(document.querySelectorAll('.pilih-pending:checked'))
                .map(function (cb) { return cb.value; });

            if (!dipilih.length) {
                UI.toast('Centang dulu pendaftar yang ingin disetujui.', 'warn');
                return;
            }

            if (!window.confirm('Setujui ' + dipilih.length + ' pendaftar sekaligus?')) {
                return;
            }

            tombol.disabled = true;

            var urutan = Promise.resolve();

            dipilih.forEach(function (id) {
                urutan = urutan.then(function () {
                    return Api.patch('admin/siswa/' + id, { action: 'approve' });
                });
            });

            urutan.then(function () {
                UI.toast(dipilih.length + ' pendaftar disetujui.', 'ok');
                muat();
            }).catch(function (error) {
                tombol.disabled = false;
                UI.toast(UI.pesanError(error), 'bad');
            });
        };
    }

    function renderTiket(daftar) {
        var kotak = document.getElementById('daftar-tiket');

        if (!kotak) {
            return;
        }

        if (!daftar || !daftar.length) {
            kotak.innerHTML = '<div class="kosong-admin">Tidak ada tiket baru. Kerja bagus!</div>';
            return;
        }

        kotak.innerHTML = daftar.map(function (t) {
            var status = t.status || 'menunggu';
            var kelasChip = {
                menunggu: 'chip--warn',
                diproses: 'chip--blue',
                selesai: 'chip--ok',
                ditolak: 'chip--bad'
            }[status] || 'chip--netral';

            var tombolAksi = '';

            if (status === 'menunggu') {
                tombolAksi = '<button type="button" class="btn btn--brand" data-aksi="proses">Proses</button>';
            } else if (status === 'diproses') {
                tombolAksi = '<button type="button" class="btn btn--ok" data-aksi="selesai">Selesai</button>';
            }

            tombolAksi += '<button type="button" class="btn btn--ghost" data-aksi="detail">Detail</button>';

            return '<div class="baris-kerja" data-id="' + esc(t.id) + '">'
                + '<span class="chip ' + kelasChip + '">'
                + esc(UI.labelTiket ? UI.labelTiket(status) : status) + '</span>'
                + '<div class="info-kerja"><b>' + esc(t.kode) + ' • ' + esc(t.nama || '-') + '</b>'
                + '<small>' + esc(UI.labelKategori ? UI.labelKategori(t.kategori) : t.kategori)
                + ' • ' + esc(UI.relatif ? UI.relatif(t.created_at) : '')
                + ' • ' + esc(String(t.isi || '').slice(0, 80)) + '</small></div>'
                + '<div class="aksi-kerja">' + tombolAksi + '</div></div>';
        }).join('');

        kotak.querySelectorAll('[data-aksi]').forEach(function (tombol) {
            tombol.onclick = function () {
                var id = tombol.closest('.baris-kerja').getAttribute('data-id');
                var aksi = tombol.getAttribute('data-aksi');

                if (aksi === 'proses') {
                    ubahTiket(id, 'diproses', tombol);
                } else if (aksi === 'selesai') {
                    ubahTiket(id, 'selesai', tombol);
                } else {
                    detailTiket(id);
                }
            };
        });
    }

    function ubahTiket(id, status, tombol) {
        if (tombol) {
            tombol.disabled = true;
        }

        Api.patch('admin/keluhan/' + id, { status: status }).then(function (response) {
            UI.toast(response.message || 'Status tiket diubah.', 'ok');
            muat();
        }).catch(function (error) {
            if (tombol) {
                tombol.disabled = false;
            }

            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function detailTiket(id) {
        Api.get('admin/keluhan').then(function (response) {
            var daftar = (response.data && response.data.keluhan) || [];
            var t = daftar.filter(function (x) { return String(x.id) === String(id); })[0];

            if (!t) {
                UI.toast('Tiket tidak ditemukan.', 'bad');
                return;
            }

            var aksi = [];

            if (t.status === 'menunggu') {
                aksi.push({
                    label: 'Proses',
                    kelas: 'btn--brand',
                    onClick: function () { ubahTiket(t.id, 'diproses'); }
                });
                aksi.push({
                    label: 'Tolak',
                    kelas: 'btn--danger',
                    onClick: function () {
                        if (window.confirm('Tolak tiket ' + t.kode + '?')) {
                            ubahTiket(t.id, 'ditolak');
                        }
                    }
                });
            } else if (t.status === 'diproses') {
                aksi.push({
                    label: 'Tandai Selesai',
                    kelas: 'btn--ok',
                    onClick: function () { ubahTiket(t.id, 'selesai'); }
                });
            }

            aksi.push({ label: 'Tutup', kelas: 'btn--ghost' });

            UI.bukaModal({
                judul: 'Tiket ' + t.kode,
                isi: '<div class="rincian">'
                    + '<span>Pelapor</span><b>' + esc(t.nama) + ' (' + esc(t.nipd) + ')</b>'
                    + '<span>Kelas</span><b>' + esc(t.kelas) + '</b>'
                    + '<span>Kategori</span><b>' + esc(UI.labelKategori ? UI.labelKategori(t.kategori) : t.kategori) + '</b>'
                    + '<span>Waktu</span><b>' + esc(UI.tanggal ? UI.tanggal(t.created_at) : t.created_at) + '</b>'
                    + '<span>Status</span><b>' + esc(UI.labelTiket ? UI.labelTiket(t.status) : t.status) + '</b>'
                    + '</div>'
                    + '<h4>Isi keluhan</h4>'
                    + '<p style="white-space:pre-wrap">' + esc(t.isi) + '</p>',
                aksi: aksi
            });
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function renderJaringan(d) {
        var j = d.jaringan || {};
        var simulasi = j.mode === 'simulasi' || d.jaringan_mode === 'simulasi';

        teks('ap-aktif', j.ap_aktif == null ? '—' : j.ap_aktif);
        teks('ap-down', j.ap_down == null ? '—' : j.ap_down);
        teks('total-vlan', j.pengguna_online == null ? (d.total_perangkat || 0) : j.pengguna_online);

        var chip = document.getElementById('status-jaringan');

        if (chip) {
            if (simulasi) {
                chip.textContent = 'Simulasi';
                chip.className = 'chip chip--blue';
            } else if (j.ap_aktif != null) {
                chip.textContent = Number(j.kapasitas_persen) >= 80 ? 'Padat' : 'Normal';
                chip.className = 'chip ' + (Number(j.kapasitas_persen) >= 80 ? 'chip--warn' : 'chip--ok');
            } else {
                chip.textContent = 'Belum terhubung';
                chip.className = 'chip chip--warn';
            }
        }

        var kotak = document.getElementById('daftar-vlan');

        if (kotak) {
            var vlan = d.vlan || [];
            var maks = Math.max.apply(null, [1].concat(vlan.map(function (v) { return Number(v.jumlah) || 0; })));

            kotak.innerHTML = vlan.length
                ? vlan.map(function (v) {
                    var jumlah = Number(v.jumlah) || 0;
                    var persen = Math.max(4, Math.round((jumlah / maks) * 100));

                    return '<div class="vlan">'
                        + '<div class="vlan-head"><span>VLAN ' + esc(v.vlan) + '</span><b>' + jumlah + ' perangkat</b></div>'
                        + '<div class="track"><div style="width:' + persen + '%"></div></div>'
                        + '</div>';
                }).join('')
                : '<div class="kosong-admin">Belum ada perangkat dengan VLAN.</div>';
        }

        var catatan = document.querySelector('.catatan-jaringan');

        if (catatan) {
            catatan.innerHTML = '<i class="bi bi-info-circle"></i> '
                + (simulasi
                    ? 'Mode simulasi: angka AP, klien, dan beban dibuat aplikasi karena router belum terhubung. '
                        + 'Perangkat di bawah tetap data pendaftaran siswa yang sebenarnya.'
                    : 'Jumlah perangkat berasal dari data yang didaftarkan siswa. '
                        + 'Status AP dan kapasitas jaringan asli butuh integrasi router.');
        }
    }

    function renderLog(daftar) {
        var kotak = document.getElementById('daftar-log');

        if (!kotak) {
            return;
        }

        var ikon = {
            login: 'box-arrow-in-right',
            logout: 'box-arrow-right',
            register: 'person-plus',
            tambah_siswa: 'person-plus',
            ubah_status_siswa: 'person-check',
            ubah_data_siswa: 'person-vcard',
            ubah_status_tiket: 'headset',
            kirim_keluhan: 'chat-left-text',
            ganti_nohp: 'telephone',
            ganti_sandi: 'key',
            tambah_perangkat: 'phone',
            hapus_perangkat: 'trash'
        };

        if (!daftar || !daftar.length) {
            kotak.innerHTML = '<div class="kosong-admin">Belum ada aktivitas.</div>';
            return;
        }

        kotak.innerHTML = daftar.map(function (l) {
            return '<div class="log-item">'
                + '<span class="log-ikon"><i class="bi bi-' + (ikon[l.aksi] || 'dot') + '"></i></span>'
                + '<div class="log-isi"><b>' + esc(l.detail || l.aksi) + '</b>'
                + '<small>' + esc(UI.jam ? UI.jam(l.created_at) : '') + '</small></div>'
                + '</div>';
        }).join('');
    }

    function renderGrafik(grafik) {
        var kotak = document.getElementById('grafik');

        if (!kotak) {
            return;
        }

        if (!grafik || !grafik.length) {
            kotak.innerHTML = '<div class="kosong-admin">Belum ada data.</div>';
            return;
        }

        var maks = 1;

        grafik.forEach(function (g) {
            maks = Math.max(maks, Number(g.pendaftar) || 0, Number(g.perangkat) || 0);
        });

        kotak.innerHTML = grafik.map(function (g) {
            var tinggiDaftar = Math.round(((Number(g.pendaftar) || 0) / maks) * 90);
            var tinggiOnline = Math.round(((Number(g.perangkat) || 0) / maks) * 90);

            return '<div class="hari">'
                + '<div class="batang-wrap">'
                + '<span class="batang batang--daftar" style="height:' + Math.max(2, tinggiDaftar) + '%"></span>'
                + '<span class="batang batang--online" style="height:' + Math.max(2, tinggiOnline) + '%"></span>'
                + '</div><small>' + esc(hari(g.tanggal)) + '</small></div>';
        }).join('');

        var totalDaftar = grafik.reduce(function (a, g) { return a + (Number(g.pendaftar) || 0); }, 0);
        var totalPerangkat = grafik.reduce(function (a, g) { return a + (Number(g.perangkat) || 0); }, 0);

        teks('ket-grafik', '7 hari terakhir: ' + totalDaftar + ' pendaftar baru, '
            + totalPerangkat + ' perangkat terdaftar.');
    }

    function renderJurusan(daftar) {
        var donat = document.getElementById('donut');
        var legend = document.getElementById('legend-jurusan');
        var total = (daftar || []).reduce(function (a, j) { return a + (Number(j.jumlah) || 0); }, 0);

        teks('donut-total', total);

        var warna = ['#2f55d4', '#12855c', '#b7791f', '#6b7a99', '#8e44ad', '#c0392b'];
        var mulai = 0;
        var bagian = [];

        if (!total) {
            if (donat) {
                donat.style.background = '#eef2f8';
            }

            if (legend) {
                legend.innerHTML = '<li class="kosong-admin">Belum ada siswa aktif.</li>';
            }

            return;
        }

        (daftar || []).forEach(function (j, index) {
            var persen = (Number(j.jumlah) / total) * 100;
            var akhir = mulai + persen;

            bagian.push(warna[index % warna.length] + ' ' + mulai.toFixed(1) + '% ' + akhir.toFixed(1) + '%');
            mulai = akhir;
        });

        if (donat) {
            donat.style.background = 'conic-gradient(' + bagian.join(', ') + ')';
        }

        if (legend) {
            legend.innerHTML = (daftar || []).map(function (j, index) {
                var jumlah = Number(j.jumlah) || 0;
                var persen = Math.round((jumlah / total) * 100);

                return '<li><span class="titik-warna" style="background:' + warna[index % warna.length] + '"></span>'
                    + '<span class="nama-jurusan">' + esc(j.jurusan) + '</span>'
                    + '<b>' + jumlah + '</b><small>' + persen + '%</small></li>';
            }).join('');
        }
    }

    function pasangAksiAtas() {
        var cari = document.getElementById('cari');

        if (cari) {
            cari.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    var q = cari.value.trim();
                    window.location.href = 'siswa.html' + (q ? '?q=' + encodeURIComponent(q) : '');
                }
            });
        }

        var lonceng = document.getElementById('lonceng');

        if (lonceng) {
            lonceng.onclick = function () {
                window.location.href = 'keluhan.html';
            };
        }
    }

    function muat() {
        return Api.get('admin/dashboard').then(function (response) {
            data = response.data || {};

            renderRingkasan(data);
            renderPending(data.pendaftar);
            renderTiket(data.tiket);
            renderJaringan(data);
            renderLog(data.log);
            renderGrafik(data.grafik);
            renderJurusan(data.per_jurusan);
            pasangBulk();
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    siap(function () {
        pasangAksiAtas();
        muat();
        window.setInterval(muat, 60000);
    });
})();
