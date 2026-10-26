/**
 * Proses masuk halaman siswa.
 * Memakai klien API (cookie sesi + token CSRF otomatis).
 */
(function () {
    'use strict';

    var form = document.getElementById('form-masuk');

    if (!form) {
        return;
    }

    var kotak = document.getElementById('login-alert');
    var nipd = document.getElementById('nipd');
    var sandi = document.getElementById('sandi');
    var tombol = form.querySelector('button[type="submit"]');

    function tampil(pesan, jenis) {
        if (!kotak) {
            return;
        }

        kotak.textContent = pesan;
        kotak.hidden = false;
        kotak.className = 'notif' + (jenis ? ' ' + jenis : '');
    }

    function sembunyi() {
        if (!kotak) {
            return;
        }

        kotak.hidden = true;
        kotak.textContent = '';
    }

    function muat(aktif) {
        if (!tombol) {
            return;
        }

        tombol.disabled = aktif;
        tombol.innerHTML = aktif
            ? '<i class="bi bi-arrow-repeat"></i> Memeriksa...'
            : 'Masuk';
    }

    function pesanError(error) {
        if (!error) {
            return 'Terjadi kesalahan. Coba lagi.';
        }

        if (error.status === 0) {
            return 'Tidak bisa menghubungi server. Pastikan server API berjalan dan halaman dibuka lewat http://localhost, bukan file://.';
        }

        if (error.status === 419) {
            return 'Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.';
        }

        if (error.status === 422 && error.errors) {
            var kunci = Object.keys(error.errors)[0];
            return (error.errors[kunci] || [])[0] || error.message;
        }

        return error.message || 'Gagal masuk. Coba lagi.';
    }

    var kode = new URLSearchParams(window.location.search);

    if (kode.get('daftar') === '1') {
        tampil('Pendaftaran berhasil. Akun menunggu persetujuan admin, lalu kamu bisa masuk.', 'hijau');
    } else if (kode.get('logout') === '1') {
        tampil('Kamu sudah keluar. Sampai jumpa.', 'hijau');
    } else if (kode.get('error') === 'server') {
        tampil('Tidak bisa memeriksa sesi. Pastikan server API berjalan.', 'merah');
    }

    // Bila sudah punya sesi aktif, langsung ke halaman yang sesuai.
    if (window.Api) {
        Api.me().then(function (response) {
            var data = response && response.data ? response.data : {};

            if (data.authenticated && data.user) {
                window.location.replace(data.user.role === 'admin' ? '../admin/dashboard.html' : 'beranda.html');
            }
        }).catch(function () {
            /* formulir tetap bisa dipakai */
        });
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        sembunyi();

        var nilaiNipd = nipd.value.trim();
        var nilaiSandi = sandi.value;

        if (!nilaiNipd) {
            tampil('NIPD wajib diisi.', 'merah');
            nipd.focus();
            return;
        }

        if (!nilaiSandi) {
            tampil('Kata sandi wajib diisi.', 'merah');
            sandi.focus();
            return;
        }

        if (!window.Api) {
            tampil('Klien API tidak termuat. Periksa assets/js/api.js.', 'merah');
            return;
        }

        muat(true);

        Api.login({ nipd: nilaiNipd, password: nilaiSandi }).then(function (response) {
            var user = response && response.data ? response.data.user : null;

            if (!user) {
                throw new Error('Data pengguna tidak diterima.');
            }

            window.location.replace(user.role === 'admin' ? '../admin/dashboard.html' : 'beranda.html');
        }).catch(function (error) {
            muat(false);
            tampil(pesanError(error), 'merah');

            if (error && error.status === 401) {
                sandi.select();
            }
        });
    });
})();
