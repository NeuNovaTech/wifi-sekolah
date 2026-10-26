/**
 * Halaman Data Siswa: daftar, filter, setujui/tolak/blokir, detail,
 * tambah siswa, dan reset kata sandi.
 */
(function () {
    'use strict';

    var UI = window.AdminUI || {};
    var semua = [];
    var ringkasan = {};

    var KELAS = [
        'X TO 1', 'X TO 2', 'X TJKT 1', 'X TJKT 2', 'X DITF', 'X KKBT',
        'XI TO 1', 'XI TO 2', 'XI TJKT 1', 'XI TJKT 2', 'XI DITF', 'XI KKBT'
    ];

    function esc(v) { return UI.esc ? UI.esc(v) : String(v == null ? '' : v); }
    function teks(id, v) { if (UI.teks) UI.teks(id, v); }

    function siap(fn) {
        if (UI.siap) {
            UI.siap(fn);
        } else {
            fn();
        }
    }

    function ambil(id) {
        return document.getElementById(id);
    }

    function nilaiFilter() {
        return {
            q: (ambil('cari-siswa') && ambil('cari-siswa').value || '').trim().toLowerCase(),
            status: (ambil('filter-status') && ambil('filter-status').value) || '',
            jurusan: (ambil('filter-jurusan') && ambil('filter-jurusan').value) || ''
        };
    }

    function cocok(s, filter) {
        if (filter.status && s.status !== filter.status) {
            return false;
        }

        if (filter.jurusan && String(s.jurusan || '').toUpperCase() !== filter.jurusan) {
            return false;
        }

        if (!filter.q) {
            return true;
        }

        var gabungan = [s.nama, s.nipd, s.kelas, s.email].join(' ').toLowerCase();

        return gabungan.indexOf(filter.q) !== -1;
    }

    function renderRingkasan() {
        var total = Number(ringkasan.total || 0);
        var pending = Number(ringkasan.pending || 0);
        var aktif = Number(ringkasan.aktif || 0);
        var ditolak = Number(ringkasan.ditolak || 0) + Number(ringkasan.blokir || 0);

        teks('stat-total', total);
        teks('stat-pending', pending);
        teks('stat-aktif', aktif);
        teks('stat-ditolak', ditolak);
        teks('ringkas-siswa', total + ' siswa • ' + pending + ' pending • ' + aktif + ' aktif');

        var chip = ambil('chip-jumlah');

        if (chip) {
            chip.textContent = total + ' data';
        }

        var nav = document.querySelector('.sidebar nav a em');

        if (nav) {
            nav.textContent = String(total);
        }

        var banner = ambil('banner-pending');
        var bannerTeks = ambil('banner-pending-teks');

        if (banner) {
            banner.hidden = pending === 0;

            if (bannerTeks) {
                bannerTeks.textContent = pending === 1
                    ? '1 pendaftar menunggu persetujuan'
                    : pending + ' pendaftar menunggu persetujuan';
            }
        }
    }

    function aksiTombol(s) {
        var tombol = [];

        if (s.status === 'pending') {
            tombol.push('<button type="button" class="btn btn--ghost btn--sm" data-aksi="detail">Detail</button>');
            tombol.push('<button type="button" class="btn btn--ok btn--sm" data-aksi="approve">Setujui</button>');
            tombol.push('<button type="button" class="btn btn--danger btn--sm" data-aksi="reject">Tolak</button>');
        } else if (s.status === 'aktif') {
            tombol.push('<button type="button" class="btn btn--ghost btn--sm" data-aksi="detail">Detail</button>');
            tombol.push('<button type="button" class="btn btn--danger btn--sm" data-aksi="block">Blokir</button>');
        } else {
            tombol.push('<button type="button" class="btn btn--ghost btn--sm" data-aksi="detail">Detail</button>');
            tombol.push('<button type="button" class="btn btn--ok btn--sm" data-aksi="approve">Aktifkan</button>');
        }

        return tombol.join('');
    }

    function render() {
        var tabel = ambil('tabel-siswa');

        if (!tabel) {
            return;
        }

        var filter = nilaiFilter();
        var data = semua.filter(function (s) { return cocok(s, filter); });

        if (!data.length) {
            tabel.innerHTML = '<tr><td colspan="7"><div class="kosong-admin">'
                + (semua.length
                    ? 'Tidak ada siswa yang cocok dengan pencarian/filter.'
                    : 'Belum ada data siswa.')
                + '</div></td></tr>';
        } else {
            tabel.innerHTML = data.map(function (s) {
                return '<tr data-id="' + esc(s.id) + '"'
                    + (s.status === 'pending' ? ' class="baris-pending"' : '') + '>'
                    + '<td data-label="Siswa"><div class="sel"><span class="avatar-kecil">' + esc(UI.inisial ? UI.inisial(s.nama) : '?') + '</span>'
                    + '<div><b>' + esc(s.nama) + '</b><small>' + esc(s.email || '-') + '</small></div></div></td>'
                    + '<td data-label="NIPD">' + esc(s.nipd) + '</td>'
                    + '<td data-label="Jurusan / Kelas">' + esc(s.jurusan || '-') + ' • ' + esc(s.kelas) + '</td>'
                    + '<td data-label="Status">' + (UI.statusSiswa ? UI.statusSiswa(s.status) : esc(s.status)) + '</td>'
                    + '<td data-label="Perangkat">' + (Number(s.jumlah_perangkat) || 0) + '</td>'
                    + '<td data-label="Terakhir Online">' + (s.last_login ? esc(UI.relatif(s.last_login)) : '<span style="color:#95a3b8">Belum pernah</span>') + '</td>'
                    + '<td data-label="Aksi"><div class="aksi-tabel">' + aksiTombol(s) + '</div></td>'
                    + '</tr>';
            }).join('');
        }

        tabel.querySelectorAll('[data-aksi]').forEach(function (tombol) {
            tombol.onclick = function () {
                var id = tombol.closest('tr').getAttribute('data-id');
                var aksi = tombol.getAttribute('data-aksi');

                if (aksi === 'detail') {
                    detailSiswa(id);
                } else {
                    ubahStatus(id, aksi, tombol);
                }
            };
        });

        teks('ringkas-tabel', 'Menampilkan ' + data.length + ' dari ' + semua.length + ' siswa');
    }

    function ubahStatus(id, aksi, tombol) {
        if (aksi === 'reject' && !window.confirm('Tolak pendaftaran siswa ini?')) {
            return;
        }

        if (aksi === 'block' && !window.confirm('Blokir akun siswa ini? Siswa tidak bisa masuk sampai diaktifkan lagi.')) {
            return;
        }

        if (tombol) {
            tombol.disabled = true;
        }

        Api.patch('admin/siswa/' + id, { action: aksi }).then(function (response) {
            UI.toast(response.message || 'Status diperbarui.', 'ok');
            return muat();
        }).catch(function (error) {
            if (tombol) {
                tombol.disabled = false;
            }

            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function detailSiswa(id) {
        Api.get('admin/siswa/' + id).then(function (response) {
            var d = response.data || {};
            var s = d.siswa || {};
            var perangkat = d.perangkat || [];
            var tiket = d.tiket || [];
            var aktivitas = d.aktivitas || [];

            var isi = '<div class="rincian">'
                + '<span>Nama</span><b>' + esc(s.nama) + '</b>'
                + '<span>NIPD</span><b>' + esc(s.nipd) + '</b>'
                + '<span>Email</span><b>' + esc(s.email) + '</b>'
                + '<span>No HP</span><b>' + esc(s.no_hp) + '</b>'
                + '<span>Kelas</span><b>' + esc(s.kelas) + ' (' + esc(s.jurusan) + ')</b>'
                + '<span>Status</span><b>' + esc(s.status) + '</b>'
                + '<span>Login terakhir</span><b>' + (s.last_login ? esc(UI.tanggal(s.last_login)) : 'Belum pernah') + '</b>'
                + '</div>';

            isi += '<h4>Perangkat (' + perangkat.length + '/3)</h4>';

            isi += perangkat.length
                ? '<div class="rincian">' + perangkat.map(function (p) {
                    return '<span>' + esc(p.nama) + '</span><b>' + esc(p.mac)
                        + (p.vlan ? ' • VLAN ' + esc(p.vlan) : '') + '</b>';
                }).join('') + '</div>'
                : '<p style="color:#6a7a94">Belum ada perangkat terdaftar.</p>';

            isi += '<h4>Tiket keluhan (' + tiket.length + ')</h4>';

            isi += tiket.length
                ? tiket.slice(0, 5).map(function (t) {
                    return '<div class="rincian"><span>' + esc(t.kode) + '</span><b>'
                        + esc(UI.labelTiket ? UI.labelTiket(t.status) : t.status) + ' • '
                        + esc(String(t.isi).slice(0, 70)) + '</b></div>';
                }).join('')
                : '<p style="color:#6a7a94">Belum pernah mengirim keluhan.</p>';

            isi += '<h4>Aktivitas terakhir</h4>';

            isi += aktivitas.length
                ? aktivitas.slice(0, 4).map(function (a) {
                    return '<div class="rincian"><span>' + esc(UI.tanggal ? UI.tanggal(a.created_at) : '') + '</span><b>'
                        + esc(a.detail || a.aksi) + '</b></div>';
                }).join('')
                : '<p style="color:#6a7a94">Belum ada aktivitas.</p>';

            UI.bukaModal({
                judul: 'Detail Siswa — ' + s.nama,
                isi: isi,
                aksi: [
                    {
                        label: 'Edit Data',
                        kelas: 'btn--brand',
                        onClick: function () { formEdit(s); },
                        tutup: false
                    },
                    {
                        label: 'Reset Sandi',
                        kelas: 'btn--ghost',
                        onClick: function () { resetSandi(s.id, s.nama); },
                        tutup: false
                    },
                    {
                        label: s.status === 'aktif' ? 'Blokir' : 'Aktifkan',
                        kelas: s.status === 'aktif' ? 'btn--danger' : 'btn--ok',
                        onClick: function () {
                            ubahStatus(s.id, s.status === 'aktif' ? 'block' : 'approve');
                        }
                    },
                    {
                        label: 'Tutup',
                        kelas: 'btn--ghost'
                    }
                ]
            });
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function formEdit(s) {
        var opsiKelas = KELAS.map(function (k) {
            return '<option value="' + esc(k) + '"' + (k === s.kelas ? ' selected' : '') + '>' + esc(k) + '</option>';
        }).join('');

        UI.bukaModal({
            judul: 'Edit Data — ' + s.nama,
            isi: '<div class="form-baris"><label for="edit-nama">Nama lengkap</label>'
                + '<input id="edit-nama" type="text" maxlength="100" value="' + esc(s.nama) + '"></div>'
                + '<div class="form-baris"><label>NIPD (tidak dapat diubah)</label>'
                + '<input type="text" value="' + esc(s.nipd) + '" disabled></div>'
                + '<div class="form-baris"><label for="edit-email">Email</label>'
                + '<input id="edit-email" type="email" maxlength="120" value="' + esc(s.email) + '"></div>'
                + '<div class="form-baris"><label for="edit-hp">No HP</label>'
                + '<input id="edit-hp" type="tel" maxlength="20" value="' + esc(s.no_hp) + '"></div>'
                + '<div class="form-baris"><label for="edit-kelas">Kelas</label>'
                + '<select id="edit-kelas"><option value="">-- Pilih kelas --</option>' + opsiKelas + '</select></div>'
                + '<p class="pesan-form" id="edit-pesan"></p>',
            aksi: [
                {
                    label: 'Simpan Perubahan',
                    kelas: 'btn--brand',
                    onClick: function (layer, tombol) {
                        simpanEdit(s, layer, tombol);
                    },
                    tutup: false
                },
                {
                    label: 'Batal',
                    kelas: 'btn--ghost'
                }
            ]
        });
    }

    function simpanEdit(s, layer, tombol) {
        var pesan = layer.querySelector('#edit-pesan');

        function salah(teks) {
            if (pesan) {
                pesan.textContent = teks;
                pesan.className = 'pesan-form merah';
            }
        }

        var data = {
            nama: layer.querySelector('#edit-nama').value.trim(),
            email: layer.querySelector('#edit-email').value.trim(),
            no_hp: layer.querySelector('#edit-hp').value.trim(),
            kelas: layer.querySelector('#edit-kelas').value
        };

        if (data.nama.length < 3) {
            salah('Nama minimal 3 karakter.');
            return;
        }

        if (!data.email) {
            salah('Email wajib diisi.');
            return;
        }

        if (!data.no_hp) {
            salah('Nomor HP wajib diisi.');
            return;
        }

        if (!data.kelas) {
            salah('Pilih kelas siswa.');
            return;
        }

        tombol.disabled = true;
        tombol.textContent = 'Menyimpan...';

        Api.patch('admin/siswa/' + s.id, {
            action: 'edit',
            nama: data.nama,
            email: data.email,
            no_hp: data.no_hp,
            kelas: data.kelas
        }).then(function (response) {
            UI.tutupModal();
            UI.toast(response.message || 'Data siswa diperbarui.', 'ok');
            return muat();
        }).catch(function (error) {
            tombol.disabled = false;
            tombol.textContent = 'Simpan Perubahan';
            salah(UI.pesanError(error));
        });
    }

    function resetSandi(id, nama) {
        if (!window.confirm('Reset kata sandi ' + nama + '? Sandi lama tidak akan berlaku lagi.')) {
            return;
        }

        Api.patch('admin/siswa/' + id, { action: 'reset_password' }).then(function (response) {
            var sandi = response.data ? response.data.sandi_baru : '';

            UI.bukaModal({
                judul: 'Kata Sandi Baru',
                isi: '<p>Berikan kata sandi ini kepada <b>' + esc(nama) + '</b>. '
                    + 'Minta siswa segera menggantinya di Beranda.</p>'
                    + '<div class="rincian"><span>NIPD</span><b>' + esc(response.data.nipd) + '</b>'
                    + '<span>Sandi baru</span><b style="font-size:16px;letter-spacing:1px">' + esc(sandi) + '</b></div>',
                aksi: [
                    {
                        label: 'Salin Sandi',
                        kelas: 'btn--brand',
                        onClick: function () {
                            if (navigator.clipboard) {
                                navigator.clipboard.writeText(sandi).then(function () {
                                    UI.toast('Sandi disalin.', 'ok');
                                }).catch(function () {
                                    UI.toast('Gagal menyalin. Catat manual ya.', 'warn');
                                });
                            } else {
                                UI.toast('Salin manual: ' + sandi, 'warn');
                            }
                        },
                        tutup: false
                    },
                    {
                        label: 'Tutup',
                        kelas: 'btn--ghost'
                    }
                ]
            });
        }).catch(function (error) {
            UI.toast(UI.pesanError(error), 'bad');
        });
    }

    function formTambah() {
        var opsiKelas = KELAS.map(function (k) {
            return '<option value="' + k + '">' + k + '</option>';
        }).join('');

        UI.bukaModal({
            judul: 'Tambah Siswa',
            isi: '<div class="form-baris"><label for="tambah-nama">Nama lengkap</label>'
                + '<input id="tambah-nama" type="text" maxlength="100" placeholder="Nama siswa"></div>'
                + '<div class="form-baris"><label for="tambah-nipd">NIPD</label>'
                + '<input id="tambah-nipd" type="text" maxlength="20" placeholder="Contoh: 1244"></div>'
                + '<div class="form-baris"><label for="tambah-email">Email</label>'
                + '<input id="tambah-email" type="email" maxlength="120" placeholder="nama@sekolah.id"></div>'
                + '<div class="form-baris"><label for="tambah-hp">No HP</label>'
                + '<input id="tambah-hp" type="tel" maxlength="20" placeholder="0857..."></div>'
                + '<div class="form-baris"><label for="tambah-kelas">Kelas</label>'
                + '<select id="tambah-kelas"><option value="">-- Pilih kelas --</option>' + opsiKelas + '</select></div>'
                + '<div class="form-baris"><label for="tambah-sandi">Kata sandi (kosongkan untuk dibuat otomatis)</label>'
                + '<input id="tambah-sandi" type="text" maxlength="72" placeholder="Minimal 6 karakter"></div>'
                + '<p class="pesan-form" id="tambah-pesan"></p>',
            aksi: [
                {
                    label: 'Simpan',
                    kelas: 'btn--brand',
                    onClick: function (layer, tombol) {
                        simpanSiswa(layer, tombol);
                    },
                    tutup: false
                },
                {
                    label: 'Batal',
                    kelas: 'btn--ghost'
                }
            ]
        });
    }

    function simpanSiswa(layer, tombol) {
        var pesan = layer.querySelector('#tambah-pesan');

        function salah(teks) {
            if (pesan) {
                pesan.textContent = teks;
                pesan.className = 'pesan-form merah';
            }
        }

        var data = {
            nama: layer.querySelector('#tambah-nama').value.trim(),
            nipd: layer.querySelector('#tambah-nipd').value.trim(),
            email: layer.querySelector('#tambah-email').value.trim(),
            no_hp: layer.querySelector('#tambah-hp').value.trim(),
            kelas: layer.querySelector('#tambah-kelas').value,
            password: layer.querySelector('#tambah-sandi').value
        };

        if (data.nama.length < 3) {
            salah('Nama minimal 3 karakter.');
            return;
        }

        if (!data.nipd) {
            salah('NIPD wajib diisi.');
            return;
        }

        if (!data.email) {
            salah('Email wajib diisi.');
            return;
        }

        if (!data.no_hp) {
            salah('Nomor HP wajib diisi.');
            return;
        }

        if (!data.kelas) {
            salah('Pilih kelas siswa.');
            return;
        }

        tombol.disabled = true;
        tombol.textContent = 'Menyimpan...';

        Api.post('admin/siswa', data).then(function (response) {
            UI.tutupModal();
            UI.toast(response.message || 'Siswa ditambahkan.', 'ok');

            var sandi = response.data ? response.data.sandi_sementara : null;

            if (sandi) {
                UI.bukaModal({
                    judul: 'Siswa Ditambahkan',
                    isi: '<p>Akun <b>' + esc(data.nama) + '</b> sudah aktif. Berikan kata sandi sementara ini:</p>'
                        + '<div class="rincian"><span>NIPD</span><b>' + esc(data.nipd) + '</b>'
                        + '<span>Sandi</span><b style="font-size:16px;letter-spacing:1px">' + esc(sandi) + '</b></div>'
                        + '<p style="color:#6a7a94">Minta siswa mengganti sandi setelah masuk.</p>',
                    aksi: [{ label: 'Tutup', kelas: 'btn--ghost' }]
                });
            }

            muat();
        }).catch(function (error) {
            tombol.disabled = false;
            tombol.textContent = 'Simpan';
            salah(UI.pesanError(error));
        });
    }

    function pasangFilter() {
        var cari = ambil('cari-siswa');
        var status = ambil('filter-status');
        var jurusan = ambil('filter-jurusan');

        if (cari) {
            var timer = null;

            cari.addEventListener('input', function () {
                window.clearTimeout(timer);
                timer = window.setTimeout(render, 220);
            });
        }

        if (status) status.onchange = render;
        if (jurusan) jurusan.onchange = render;

        var tambah = ambil('btn-tambah-siswa');

        if (tambah) {
            tambah.onclick = formTambah;
        }

        var lihatPending = ambil('btn-lihat-pending');

        if (lihatPending) {
            lihatPending.onclick = function () {
                if (status) {
                    status.value = 'pending';
                }

                if (cari) {
                    cari.value = '';
                }

                if (jurusan) {
                    jurusan.value = '';
                }

                render();
            };
        }

        var q = new URLSearchParams(window.location.search).get('q');

        if (q && cari) {
            cari.value = q;
        }
    }

    function muat() {
        return Api.get('admin/siswa').then(function (response) {
            var d = response.data || {};

            semua = d.siswa || [];
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
