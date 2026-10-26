/**
 * Beranda siswa.
 * Semua data diambil dari API: profil, perangkat, tiket, aktivitas.
 * Fitur yang butuh perangkat jaringan (sinyal, AP, VLAN nyata) ditandai
 * "belum terhubung" dan tidak dipalsukan.
 */
(function () {
    'use strict';

    var data = null;
    var nilaiSensitif = {};
    var pwAsli = '';
    var timerSesi = null;
    var mulaiSesi = null;

    function $(id) {
        return document.getElementById(id);
    }

    function esc(nilai) {
        return String(nilai === null || nilai === undefined ? '' : nilai)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isi(id, teks) {
        var el = $(id);

        if (el) {
            el.textContent = teks;
        }
    }

    function statusLabel(status) {
        return {
            aktif: 'Aktif',
            pending: 'Menunggu',
            ditolak: 'Ditolak',
            blokir: 'Diblokir'
        }[status] || status || '—';
    }

    function statusTiket(status) {
        return {
            menunggu: 'Menunggu Operator',
            diproses: 'Sedang Diproses',
            selesai: 'Selesai',
            ditolak: 'Ditolak'
        }[status] || status;
    }

    function tanggalIndo(nilai, denganJam) {
        if (!nilai) {
            return '—';
        }

        var d = new Date(String(nilai).replace(' ', 'T'));

        if (isNaN(d.getTime())) {
            return String(nilai);
        }

        var teks = d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        if (denganJam !== false) {
            teks += ' ' + d.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        return teks;
    }

    function jamSaja(nilai) {
        if (!nilai) {
            return '—';
        }

        var d = new Date(String(nilai).replace(' ', 'T'));

        if (isNaN(d.getTime())) {
            return '—';
        }

        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function topengNomor(nomor) {
        var digit = String(nomor || '').replace(/\D+/g, '');

        return digit.length >= 4 ? '•••• •••• ' + digit.slice(-4) : '•••• ••••';
    }

    function topengMac(mac) {
        var bagian = String(mac || '').split(':');

        if (bagian.length !== 6) {
            return '••:••:••:••:••:••';
        }

        return ['••', '••', '••', '••', '••', bagian[5].toUpperCase()].join(':');
    }

    function inisial(nama) {
        return String(nama || '?')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(function (kata) { return kata.charAt(0).toUpperCase(); })
            .join('');
    }

    // ------------------------------------------------------------
    // Sesi
    // ------------------------------------------------------------
    function mulaiTimer(loginAt, serverNow) {
        if (timerSesi) {
            window.clearInterval(timerSesi);
        }

        var mulai = loginAt ? new Date(String(loginAt).replace(' ', 'T')) : null;
        var sekarang = serverNow ? new Date(String(serverNow).replace(' ', 'T')) : null;

        if (mulai && isNaN(mulai.getTime())) {
            mulai = null;
        }

        if (sekarang && isNaN(sekarang.getTime())) {
            sekarang = null;
        }

        if (mulai && sekarang) {
            // Selisih dua waktu server dipakai supaya timer tetap benar
            // walau zona waktu HP/laptop berbeda dengan server.
            var lewat = Math.max(0, Math.floor((sekarang.getTime() - mulai.getTime()) / 1000));
            mulaiSesi = new Date(Date.now() - (lewat * 1000));
        } else {
            mulaiSesi = mulai || new Date();
        }

        var gambar = function () {
            var detik = Math.max(0, Math.floor((Date.now() - mulaiSesi.getTime()) / 1000));
            var j = String(Math.floor(detik / 3600)).padStart(2, '0');
            var m = String(Math.floor((detik % 3600) / 60)).padStart(2, '0');
            var d = String(detik % 60).padStart(2, '0');

            isi('sesi-aktif', j + ':' + m + ':' + d);
        };

        gambar();
        timerSesi = window.setInterval(gambar, 1000);
    }

    // ------------------------------------------------------------
    // Render
    // ------------------------------------------------------------
    function renderProfil(user) {
        var status = user.status || 'pending';
        var lencana = $('lencana-akun');
        var statusEl = $('data-status');

        isi('nama-siswa', user.nama || 'Siswa');
        isi('status-siswa', 'Akun ' + statusLabel(status).toLowerCase() + ' • ' + (user.kelas || '—'));
        isi('data-nipd', user.nipd || '—');
        isi('data-kelas', user.kelas || '—');
        isi('data-jurusan', user.jurusan || '—');
        isi('data-status', statusLabel(status));

        if (lencana) {
            lencana.textContent = statusLabel(status);
            lencana.className = 'lencana'
                + (status === 'aktif' ? '' : (status === 'pending' ? ' kuning' : ' merah'));
        }

        if (statusEl) {
            statusEl.className = status === 'aktif'
                ? 'hijau'
                : (status === 'pending' ? 'kuning' : 'merah');
        }

        nilaiSensitif['nilai-nohp'] = user.no_hp || '';
        isi('nilai-nohp', user.no_hp ? topengNomor(user.no_hp) : '—');

        isi('stat-status', statusLabel(status));
        isi('sub-status', {
            aktif: 'akun terverifikasi',
            pending: 'menunggu persetujuan admin',
            ditolak: 'pendaftaran ditolak',
            blokir: 'akun diblokir'
        }[status] || 'status akun');
    }

    function renderPerangkat(perangkat) {
        var kotak = $('daftar-perangkat');
        var jumlah = perangkat.length;

        isi('stat-perangkat', String(jumlah));
        isi('sub-perangkat', jumlah === 0 ? 'belum ada' : jumlah + ' dari maksimal 3');
        isi('badge-perangkat', jumlah + ' Perangkat');

        if (!kotak) {
            return;
        }

        if (jumlah === 0) {
            kotak.innerHTML = '<div class="kosong">Belum ada perangkat terdaftar. Klik <b>Tambah Perangkat</b> untuk mendaftarkan HP kamu.</div>';
            isi('data-vlan', '—');
            return;
        }

        kotak.innerHTML = perangkat.map(function (p) {
            var status = {
                aktif: '<span class="badge">Aktif</span>',
                nonaktif: '<span class="badge badge-nonaktif">Nonaktif</span>',
                diblokir: '<span class="badge badge-diblokir">Diblokir</span>'
            }[p.status] || ('<span class="badge badge-nonaktif">' + esc(statusLabel(p.status)) + '</span>');

            return '<div class="perangkat-item">'
                + '<div class="perangkat-head"><b>' + esc(p.nama || 'Perangkat') + '</b>'
                + '<div class="perangkat-aksi">' + status
                + '<button type="button" class="btn-hapus-perangkat" data-id="' + esc(p.id) + '" data-nama="' + esc(p.nama || 'perangkat ini') + '" title="Hapus perangkat" aria-label="Hapus perangkat"><i class="bi bi-trash"></i></button>'
                + '</div></div>'
                + (p.tipe ? '<small>' + esc(p.tipe) + '</small>' : '')
                + '<div class="perangkat-detail">'
                + '<p><span>Alamat MAC</span><span class="sel"><b data-mac-teks="' + esc(p.mac) + '">' + esc(topengMac(p.mac)) + '</b>'
                + '<button type="button" class="btn-mata" data-mac="' + esc(p.mac) + '" title="Lihat atau sembunyikan MAC" aria-label="Lihat atau sembunyikan MAC"><i class="bi bi-eye"></i></button></span></p>'
                + '<p><span>Alamat IP</span>' + (p.ip ? '<b>' + esc(p.ip) + '</b>' : '<b class="belum">Belum terdeteksi</b>') + '</p>'
                + '<p><span>VLAN</span><b>' + esc(p.vlan || '—') + '</b></p>'
                + '<p><span>Terdaftar</span><b>' + esc(tanggalIndo(p.terdaftar_at, false)) + '</b></p>'
                + '</div></div>';
        }).join('');

        var pertama = perangkat[0];
        isi('data-vlan', pertama && pertama.vlan ? 'VLAN ' + pertama.vlan : '—');

        kotak.querySelectorAll('.btn-mata[data-mac]').forEach(function (tombol) {
            tombol.onclick = function () {
                var mac = tombol.getAttribute('data-mac');
                var teks = kotak.querySelector('[data-mac-teks="' + mac + '"]');
                var ikon = tombol.querySelector('i');
                var terbuka = tombol.getAttribute('data-terbuka') === '1';

                if (teks) {
                    teks.textContent = terbuka ? topengMac(mac) : mac;
                }

                tombol.setAttribute('data-terbuka', terbuka ? '0' : '1');

                if (ikon) {
                    ikon.className = terbuka ? 'bi bi-eye' : 'bi bi-eye-slash';
                }
            };
        });

        kotak.querySelectorAll('.btn-hapus-perangkat').forEach(function (tombol) {
            tombol.onclick = function () {
                var id = tombol.getAttribute('data-id');
                var nama = tombol.getAttribute('data-nama') || 'perangkat ini';

                if (!window.confirm('Hapus ' + nama + ' dari daftar perangkat? '
                    + 'Kamu bisa mendaftarkan perangkat lain setelahnya.')) {
                    return;
                }

                tombol.disabled = true;

                Api.del('siswa/perangkat/' + id).then(function (response) {
                    pesanPerangkat((response && response.message) || 'Perangkat berhasil dihapus.', 'hijau');
                    return muat();
                }).catch(function (error) {
                    tombol.disabled = false;
                    pesanPerangkat((error && error.message) || 'Gagal menghapus perangkat.', 'merah');
                });
            };
        });
    }

    function pesanPerangkat(teks, jenis) {
        var el = $('pesan-perangkat-utama');

        if (!el) {
            return;
        }

        el.textContent = teks;
        el.className = 'pesan' + (jenis ? ' ' + jenis : '');
    }

    function renderWifi(wifi) {
        if (!wifi || !wifi.ssid) {
            return;
        }

        var kotak = $('kotak-wifi');

        if (kotak) {
            kotak.hidden = false;
        }

        isi('ssid-wifi', wifi.ssid);
        pwAsli = wifi.password || '';
        isi('nilai-pwifi', pwAsli ? '••••••••' : '—');

        var tombol = $('lihat-pwifi');

        if (tombol) {
            tombol.onclick = function () {
                if (!pwAsli) {
                    return;
                }

                var terbuka = tombol.getAttribute('data-terbuka') === '1';
                var ikon = tombol.querySelector('i');

                isi('nilai-pwifi', terbuka ? '••••••••' : pwAsli);
                tombol.setAttribute('data-terbuka', terbuka ? '0' : '1');

                if (ikon) {
                    ikon.className = terbuka ? 'bi bi-eye' : 'bi bi-eye-slash';
                }
            };
        }
    }

    function renderTiket(tiket, statistik) {
        isi('stat-tiket', String(statistik.tiket_terbuka || 0));
        isi('stat-total-tiket', String(statistik.total_tiket || 0));

        var info = $('info-tiket');

        if (!info) {
            return;
        }

        if (!tiket || !tiket.length) {
            info.textContent = 'Belum ada tiket. WiFi lemot atau sering putus? Kirim keluhan lewat ikon headset di atas ya.';
            return;
        }

        var terakhir = tiket[0];

        info.innerHTML = 'Tiket terakhir <b>' + esc(terakhir.kode) + '</b> — '
            + esc(statusTiket(terakhir.status)) + ', dikirim ' + esc(tanggalIndo(terakhir.created_at)) + '. '
            + '<a href="riwayat.html">Lihat riwayat</a>';
    }

    var LABEL_AKTIVITAS = {
        login: 'Masuk ke aplikasi',
        logout: 'Keluar dari aplikasi',
        register: 'Pendaftaran akun',
        ganti_nohp: 'Mengganti nomor HP',
        ganti_sandi: 'Mengganti kata sandi',
        tambah_perangkat: 'Menambah perangkat',
        hapus_perangkat: 'Menghapus perangkat',
        kirim_keluhan: 'Mengirim keluhan',
        ubah_status_siswa: 'Status akun diperbarui admin',
        ubah_data_siswa: 'Data akun diperbarui admin'
    };

    var IKON_AKTIVITAS = {
        login: 'box-arrow-in-right',
        logout: 'box-arrow-right',
        register: 'person-plus',
        ganti_nohp: 'telephone',
        ganti_sandi: 'key',
        tambah_perangkat: 'phone',
        hapus_perangkat: 'trash',
        kirim_keluhan: 'headset',
        ubah_status_siswa: 'patch-check',
        ubah_data_siswa: 'person-vcard'
    };

    function renderAktivitas(aktivitas) {
        var kotak = $('daftar-aktivitas');

        if (!kotak) {
            return;
        }

        if (!aktivitas || !aktivitas.length) {
            kotak.innerHTML = '<div class="kosong">Belum ada aktivitas. Aktivitas akan muncul setelah kamu memakai aplikasi.</div>';
            return;
        }

        kotak.innerHTML = aktivitas.map(function (a) {
            var label = LABEL_AKTIVITAS[a.aksi] || a.aksi;
            var ikon = IKON_AKTIVITAS[a.aksi] || 'dot';

            return '<div class="aktivitas-item">'
                + '<i class="bi bi-' + ikon + '"></i>'
                + '<div><b>' + esc(label) + '</b><small>' + esc(tanggalIndo(a.created_at)) + '</small></div>'
                + '</div>';
        }).join('');
    }

    function renderStatusLayanan() {
        fetch(Api.baseUrl + 'health?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (payload) {
                var info = payload && payload.data ? payload.data : {};
                var detik = Number(info.uptime_detik || 0);
                var jam = Math.floor(detik / 3600);
                var menit = Math.floor((detik % 3600) / 60);

                isi('status-layanan', 'Online');
                isi('uptime-server', jam > 0 ? jam + ' jam ' + menit + ' menit' : menit + ' menit');
                isi('cek-terakhir', info.time
                    ? String(info.time).slice(11, 16).replace(':', '.')
                    : jamSaja(new Date().toISOString()));
                isi('status-integrasi', 'Belum terhubung');
            })
            .catch(function () {
                isi('status-layanan', 'Gangguan');
                isi('uptime-server', '—');
                isi('cek-terakhir', jamSaja(new Date().toISOString()));
            });
    }

    // ------------------------------------------------------------
    // Muat data
    // ------------------------------------------------------------
    function muat() {
        return Api.get('siswa/me').then(function (response) {
            data = response.data || {};

            renderProfil(data.user || {});
            renderPerangkat(data.perangkat || []);
            renderWifi(data.wifi || {});
            renderTiket(data.tiket_terbaru || [], data.statistik || {});
            renderAktivitas(data.aktivitas || []);
            mulaiTimer(
                data.sesi ? data.sesi.login_at : null,
                data.sesi ? data.sesi.server_now : null
            );

            return data;
        });
    }

    // ------------------------------------------------------------
    // Modal pengaturan
    // ------------------------------------------------------------
    var DAFTAR_MODAL = ['bantuan-box', 'kotak-nohp', 'kotak-sandi', 'kotak-perangkat'];

    function buka(id) {
        DAFTAR_MODAL.forEach(function (lain) {
            if (lain !== id) {
                tutup(lain);
            }
        });

        var kotak = $(id);

        if (kotak) {
            kotak.hidden = false;
        }
    }

    function tutup(id) {
        var kotak = $(id);

        if (kotak) {
            kotak.hidden = true;
        }
    }

    function modalAktif() {
        for (var i = 0; i < DAFTAR_MODAL.length; i += 1) {
            var kotak = $(DAFTAR_MODAL[i]);

            if (kotak && !kotak.hidden) {
                return kotak;
            }
        }

        return null;
    }

    function pasangTutupModal() {
        document.addEventListener('click', function (event) {
            var kotak = modalAktif();

            if (!kotak || kotak.contains(event.target)) {
                return;
            }

            // Tombol pembuka punya penanganannya sendiri di main.js/beranda.js.
            if (event.target.closest && event.target.closest('#bantuan, #ganti-nohp, #ganti-sandi, #tambah-perangkat')) {
                return;
            }

            tutup(kotak.id);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') {
                return;
            }

            var kotak = modalAktif();

            if (kotak) {
                tutup(kotak.id);
            }
        });

        var tombolBantuan = $('bantuan');

        if (tombolBantuan) {
            tombolBantuan.addEventListener('click', function () {
                ['kotak-nohp', 'kotak-sandi', 'kotak-perangkat'].forEach(tutup);
            });
        }
    }

    function pesan(id, teks, jenis) {
        var el = $(id);

        if (!el) {
            return;
        }

        el.textContent = teks;
        el.className = 'pesan' + (jenis ? ' ' + jenis : '');
    }

    function pesanError(error) {
        if (!error) {
            return 'Terjadi kesalahan. Coba lagi.';
        }

        if (error.status === 0) {
            return 'Server tidak bisa dihubungi.';
        }

        if (error.status === 422 && error.errors) {
            var kunci = Object.keys(error.errors)[0];
            return (error.errors[kunci] || [])[0] || error.message;
        }

        return error.message || 'Gagal menyimpan.';
    }

    function pasangAksi() {
        var btnNohp = $('ganti-nohp');
        var btnSandi = $('ganti-sandi');
        var btnPerangkat = $('tambah-perangkat');
        var keluar = $('keluar');

        if (btnNohp) {
            btnNohp.onclick = function () {
                if (data && data.user) {
                    $('input-nohp').value = data.user.no_hp || '';
                }

                pesan('pesan-nohp', '');
                buka('kotak-nohp');
            };
        }

        if ($('tutup-nohp')) {
            $('tutup-nohp').onclick = function () { tutup('kotak-nohp'); };
        }

        if ($('simpan-nohp')) {
            $('simpan-nohp').onclick = function () {
                var nilai = $('input-nohp').value.trim();

                if (!nilai) {
                    pesan('pesan-nohp', 'Nomor HP wajib diisi.', 'merah');
                    return;
                }

                var tombol = $('simpan-nohp');
                tombol.disabled = true;
                pesan('pesan-nohp', 'Menyimpan...');

                Api.patch('siswa/me', { no_hp: nilai }).then(function (response) {
                    pesan('pesan-nohp', response.message || 'Nomor HP tersimpan.', 'hijau');
                    tombol.disabled = false;

                    return muat().then(function () {
                        window.setTimeout(function () { tutup('kotak-nohp'); }, 900);
                    });
                }).catch(function (error) {
                    tombol.disabled = false;
                    pesan('pesan-nohp', pesanError(error), 'merah');
                });
            };
        }

        if (btnSandi) {
            btnSandi.onclick = function () {
                $('input-sandi').value = '';
                $('input-sandi2').value = '';
                pesan('pesan-sandi', '');
                buka('kotak-sandi');
            };
        }

        if ($('tutup-sandi')) {
            $('tutup-sandi').onclick = function () { tutup('kotak-sandi'); };
        }

        if ($('simpan-sandi')) {
            $('simpan-sandi').onclick = function () {
                var sandi = $('input-sandi').value;
                var ulangi = $('input-sandi2').value;

                if (sandi.length < 6) {
                    pesan('pesan-sandi', 'Kata sandi minimal 6 karakter.', 'merah');
                    return;
                }

                if (sandi !== ulangi) {
                    pesan('pesan-sandi', 'Ulangi kata sandi tidak sama.', 'merah');
                    return;
                }

                var tombol = $('simpan-sandi');
                tombol.disabled = true;
                pesan('pesan-sandi', 'Menyimpan...');

                Api.patch('siswa/me', {
                    password: sandi,
                    password_confirmation: ulangi
                }).then(function (response) {
                    pesan('pesan-sandi', response.message || 'Kata sandi tersimpan.', 'hijau');
                    tombol.disabled = false;
                    $('input-sandi').value = '';
                    $('input-sandi2').value = '';

                    window.setTimeout(function () { tutup('kotak-sandi'); }, 900);
                }).catch(function (error) {
                    tombol.disabled = false;
                    pesan('pesan-sandi', pesanError(error), 'merah');
                });
            };
        }

        if (btnPerangkat) {
            btnPerangkat.onclick = function () {
                if (data && data.statistik && data.statistik.jumlah_perangkat >= 3) {
                    window.alert('Maksimal 3 perangkat per akun. Hubungi admin untuk mengganti perangkat.');
                    return;
                }

                $('input-nama-perangkat').value = '';
                $('input-tipe-perangkat').value = '';
                $('input-mac-perangkat').value = '';
                $('input-vlan-perangkat').value = '';
                pesan('pesan-perangkat', '');
                buka('kotak-perangkat');
            };
        }

        if ($('tutup-perangkat')) {
            $('tutup-perangkat').onclick = function () { tutup('kotak-perangkat'); };
        }

        if ($('simpan-perangkat')) {
            $('simpan-perangkat').onclick = function () {
                var nama = $('input-nama-perangkat').value.trim();
                var tipe = $('input-tipe-perangkat').value.trim();
                var mac = $('input-mac-perangkat').value.trim().toUpperCase();
                var vlan = $('input-vlan-perangkat').value.trim();

                if (nama.length < 2) {
                    pesan('pesan-perangkat', 'Nama perangkat minimal 2 karakter.', 'merah');
                    return;
                }

                if (!/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(mac)) {
                    pesan('pesan-perangkat', 'Alamat MAC tidak valid. Contoh: 8A:3F:1C:9D:44:02', 'merah');
                    return;
                }

                var tombol = $('simpan-perangkat');
                tombol.disabled = true;
                pesan('pesan-perangkat', 'Menyimpan...');

                Api.post('siswa/perangkat', {
                    nama: nama,
                    tipe: tipe,
                    mac: mac,
                    vlan: vlan === '' ? null : Number(vlan)
                }).then(function (response) {
                    pesan('pesan-perangkat', response.message || 'Perangkat tersimpan.', 'hijau');
                    tombol.disabled = false;

                    return muat().then(function () {
                        window.setTimeout(function () { tutup('kotak-perangkat'); }, 900);
                    });
                }).catch(function (error) {
                    tombol.disabled = false;
                    pesan('pesan-perangkat', pesanError(error), 'merah');
                });
            };
        }

        if (keluar) {
            keluar.onclick = function () {
                keluar.disabled = true;
                Api.logout().catch(function () {
                    /* tetap keluar walau server tidak menjawab */
                }).then(function () {
                    window.location.replace('index.html?logout=1');
                });
            };
        }

        // Tombol mata untuk No HP (MAC ditangani saat render).
        document.querySelectorAll('.btn-mata[data-target="nilai-nohp"]').forEach(function (tombol) {
            tombol.onclick = function () {
                var el = $('nilai-nohp');
                var ikon = tombol.querySelector('i');
                var terbuka = tombol.getAttribute('data-terbuka') === '1';

                if (!el) {
                    return;
                }

                el.textContent = terbuka
                    ? topengNomor(nilaiSensitif['nilai-nohp'])
                    : (nilaiSensitif['nilai-nohp'] || '—');

                tombol.setAttribute('data-terbuka', terbuka ? '0' : '1');

                if (ikon) {
                    ikon.className = terbuka ? 'bi bi-eye' : 'bi bi-eye-slash';
                }
            };
        });
    }

    // ------------------------------------------------------------
    // Tes koneksi ke server aplikasi (bukan speed test WiFi)
    // ------------------------------------------------------------
    function pasangTesKoneksi() {
        var tombol = $('tombol-ujisinyal');

        if (!tombol) {
            return;
        }

        tombol.onclick = function () {
            var hasil = [];
            var selesai = 0;
            var gagal = 0;

            tombol.disabled = true;
            isi('status-ujisinyal', 'Mengukur…');
            isi('ket-ujisinyal', 'Mengirim 5 permintaan ke server aplikasi sekolah...');

            var satu = function () {
                var mulai = performance.now();

                return fetch(Api.baseUrl + 'health?t=' + Date.now(), {
                    cache: 'no-store',
                    credentials: 'same-origin'
                }).then(function (r) {
                    if (!r.ok) {
                        throw new Error('HTTP ' + r.status);
                    }

                    hasil.push(performance.now() - mulai);
                    selesai += 1;
                }).catch(function () {
                    gagal += 1;
                });
            };

            var urutan = Promise.resolve();

            for (var i = 0; i < 5; i += 1) {
                urutan = urutan.then(satu);
            }

            urutan.then(function () {
                tombol.disabled = false;

                if (!hasil.length) {
                    isi('status-ujisinyal', 'Gagal');
                    isi('angka-ujisinyal', '—');
                    isi('ping-ujisinyal', 'Offline');
                    isi('waktu-uji', jamSaja(new Date().toISOString()));
                    isi('ket-ujisinyal', 'Server aplikasi tidak merespons. Coba lagi beberapa saat.');
                    return;
                }

                var rata = hasil.reduce(function (a, b) { return a + b; }, 0) / hasil.length;
                var ms = Math.round(rata);

                isi('angka-ujisinyal', String(ms));
                isi('ping-ujisinyal', gagal === 0 ? 'Online' : 'Sebagian');
                isi('waktu-uji', jamSaja(new Date().toISOString()));
                isi('status-ujisinyal', ms < 200 ? 'Cepat' : ms < 600 ? 'Sedang' : 'Lambat');
                isi('ket-ujisinyal', 'Latensi ke server aplikasi ' + ms + ' ms dari 5 percobaan. '
                    + 'Ini bukan kecepatan WiFi, hanya respons server.');
            });
        };
    }

    // ------------------------------------------------------------
    // Mulai
    // ------------------------------------------------------------
    function mulai() {
        pasangAksi();
        pasangTutupModal();
        pasangTesKoneksi();
        renderStatusLayanan();

        muat().catch(function (error) {
            if (error && error.status === 401) {
                window.location.replace('index.html');
                return;
            }

            isi('status-siswa', 'Gagal memuat data');
            isi('info-tiket', pesanError(error));
        });
    }

    if (window.UserReady && typeof window.UserReady.then === 'function') {
        window.UserReady.then(function (user) {
            if (user) {
                mulai();
            }
        });
    } else {
        mulai();
    }
})();
