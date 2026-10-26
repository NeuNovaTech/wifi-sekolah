/**
 * Halaman pengaturan: SSID, sandi WiFi, jam akses, kapasitas jaringan.
 */
(function () {
    'use strict';

    var UI = window.AdminUI || {};
    var form = document.getElementById('form-pengaturan');

    if (!form) {
        return;
    }

    var kotak = document.getElementById('pengaturan-alert');
    var tombol = document.getElementById('simpan-pengaturan');
    var lihatSandi = document.getElementById('lihat-sandi');

    var bidang = {
        wifi_ssid: document.getElementById('wifi_ssid'),
        wifi_password: document.getElementById('wifi_password'),
        jam_akses: document.getElementById('jam_akses'),
        kapasitas_jaringan: document.getElementById('kapasitas_jaringan')
    };

    function tampil(pesan, jenis) {
        if (!kotak) {
            return;
        }

        kotak.textContent = pesan;
        kotak.hidden = false;
        kotak.className = 'notif-pengaturan' + (jenis ? ' ' + jenis : '');
    }

    function sembunyi() {
        if (kotak) {
            kotak.hidden = true;
            kotak.textContent = '';
        }
    }

    function nilai(kunci) {
        return bidang[kunci] ? String(bidang[kunci].value).trim() : '';
    }

    function muat(aktif) {
        if (!tombol) {
            return;
        }

        tombol.disabled = aktif;
        tombol.innerHTML = aktif
            ? '<i class="bi bi-arrow-repeat"></i> Menyimpan...'
            : '<i class="bi bi-save"></i> Simpan Pengaturan';
    }

    function isi(data) {
        Object.keys(bidang).forEach(function (kunci) {
            if (bidang[kunci] && data[kunci] !== undefined && data[kunci] !== null) {
                bidang[kunci].value = String(data[kunci]);
            }
        });
    }

    function siap(fn) {
        if (UI.siap) {
            UI.siap(fn);
        } else {
            fn();
        }
    }

    if (lihatSandi && bidang.wifi_password) {
        lihatSandi.onclick = function () {
            var tampilSandi = bidang.wifi_password.type === 'password';

            bidang.wifi_password.type = tampilSandi ? 'text' : 'password';
            lihatSandi.innerHTML = '<i class="bi bi-eye' + (tampilSandi ? '-slash' : '') + '"></i>';
        };
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        sembunyi();

        var data = {
            wifi_ssid: nilai('wifi_ssid'),
            wifi_password: nilai('wifi_password'),
            jam_akses: nilai('jam_akses'),
            kapasitas_jaringan: nilai('kapasitas_jaringan')
        };

        if (!data.wifi_ssid) {
            tampil('SSID wajib diisi.', 'merah');
            bidang.wifi_ssid.focus();
            return;
        }

        if (data.wifi_password.length < 8) {
            tampil('Kata sandi WiFi minimal 8 karakter.', 'merah');
            bidang.wifi_password.focus();
            return;
        }

        if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(data.jam_akses)) {
            tampil('Format jam akses harus JJ:MM-JJ:MM, contoh 06:00-17:00.', 'merah');
            bidang.jam_akses.focus();
            return;
        }

        var kapasitas = Number(data.kapasitas_jaringan);

        if (!Number.isFinite(kapasitas) || kapasitas < 1 || kapasitas > 100) {
            tampil('Kapasitas jaringan harus angka 1 sampai 100.', 'merah');
            bidang.kapasitas_jaringan.focus();
            return;
        }

        data.kapasitas_jaringan = String(Math.round(kapasitas));

        muat(true);

        window.Api.patch('admin/pengaturan', data).then(function (response) {
            if (response && response.data && response.data.pengaturan) {
                isi(response.data.pengaturan);
            }

            var pesan = (response && response.message)
                || 'Pengaturan berhasil disimpan.';

            tampil(pesan, 'hijau');

            if (UI.toast) {
                UI.toast(pesan, 'ok');
            }
        }).catch(function (error) {
            tampil(UI.pesanError ? UI.pesanError(error) : 'Gagal menyimpan pengaturan.', 'merah');
        }).then(function () {
            muat(false);
        });
    });

    siap(function () {
        window.Api.get('admin/pengaturan').then(function (response) {
            var data = (response && response.data && response.data.pengaturan) || {};

            isi(data);

            var ringkas = document.getElementById('ringkas-pengaturan');

            if (ringkas) {
                ringkas.textContent = 'SSID ' + (data.wifi_ssid || '—')
                    + ' • jam akses ' + (data.jam_akses || '—');
            }
        }).catch(function (error) {
            tampil(UI.pesanError ? UI.pesanError(error) : 'Gagal memuat pengaturan.', 'merah');
        });
    });

    function pasangAkun() {
        var formAkun = document.getElementById('form-akun');

        if (!formAkun) {
            return;
        }

        var kotakAkun = document.getElementById('akun-alert');
        var tombolAkun = document.getElementById('simpan-akun');
        var lama = document.getElementById('password_lama');
        var baru = document.getElementById('password_baru');
        var ulangi = document.getElementById('password_baru2');

        function info(pesan, jenis) {
            if (!kotakAkun) {
                return;
            }

            kotakAkun.textContent = pesan;
            kotakAkun.hidden = false;
            kotakAkun.className = 'notif-pengaturan' + (jenis ? ' ' + jenis : '');
        }

        formAkun.addEventListener('submit', function (event) {
            event.preventDefault();

            if (kotakAkun) {
                kotakAkun.hidden = true;
            }

            if (!String(lama.value).trim()) {
                info('Kata sandi lama wajib diisi.', 'merah');
                lama.focus();
                return;
            }

            if (String(baru.value).length < 8) {
                info('Kata sandi baru minimal 8 karakter.', 'merah');
                baru.focus();
                return;
            }

            if (baru.value !== ulangi.value) {
                info('Ulangi kata sandi baru dengan benar.', 'merah');
                ulangi.focus();
                return;
            }

            tombolAkun.disabled = true;
            tombolAkun.innerHTML = '<i class="bi bi-arrow-repeat"></i> Menyimpan...';

            window.Api.patch('admin/akun', {
                password_lama: lama.value,
                password: baru.value,
                password_confirmation: ulangi.value
            }).then(function (response) {
                var pesan = (response && response.message) || 'Kata sandi berhasil diganti.';

                info(pesan, 'hijau');
                formAkun.reset();

                if (UI.toast) {
                    UI.toast(pesan, 'ok');
                }
            }).catch(function (error) {
                info(UI.pesanError ? UI.pesanError(error) : 'Gagal mengganti kata sandi.', 'merah');
            }).then(function () {
                tombolAkun.disabled = false;
                tombolAkun.innerHTML = '<i class="bi bi-shield-check"></i> Ganti Kata Sandi';
            });
        });
    }

    pasangAkun();
})();
