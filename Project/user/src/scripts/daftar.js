/**
 * Pendaftaran akun siswa.
 * Mengirim data ke POST /auth/register lalu menunggu persetujuan admin.
 */
(function () {
    'use strict';

    var form = document.getElementById('form-daftar');

    if (!form) {
        return;
    }

    var kotak = document.getElementById('daftar-alert');
    var tombol = form.querySelector('button[type="submit"]');
    var selesai = false;

    var bidang = {
        nama: document.getElementById('nama'),
        nipd: document.getElementById('nipd'),
        email: document.getElementById('email'),
        no_hp: document.getElementById('no_hp'),
        kelas: document.getElementById('kelas'),
        sandi: document.getElementById('sandi')
    };

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
            ? '<i class="bi bi-arrow-repeat"></i> Mengirim pendaftaran...'
            : 'Daftar Akun WiFi';
    }

    function pesanError(error) {
        if (!error) {
            return 'Terjadi kesalahan. Coba lagi.';
        }

        if (error.status === 0) {
            return 'Tidak bisa menghubungi server. Pastikan server API berjalan dan halaman dibuka lewat http://localhost.';
        }

        if (error.status === 419) {
            return 'Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.';
        }

        if (error.status === 422 && error.errors) {
            var kunci = Object.keys(error.errors)[0];
            var isi = (error.errors[kunci] || [])[0];

            if (bidang[kunci] && bidang[kunci].focus) {
                bidang[kunci].focus();
            }

            return isi || error.message;
        }

        return error.message || 'Pendaftaran gagal. Coba lagi.';
    }

    function nilai(kunci) {
        return bidang[kunci] ? String(bidang[kunci].value).trim() : '';
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (selesai) {
            return;
        }

        sembunyi();

        var data = {
            nama: nilai('nama'),
            nipd: nilai('nipd'),
            email: nilai('email'),
            no_hp: nilai('no_hp'),
            kelas: nilai('kelas'),
            password: bidang.sandi ? bidang.sandi.value : ''
        };

        if (data.nama.length < 3) {
            tampil('Nama lengkap minimal 3 karakter.', 'merah');
            bidang.nama.focus();
            return;
        }

        if (!data.nipd) {
            tampil('NIPD wajib diisi.', 'merah');
            bidang.nipd.focus();
            return;
        }

        if (!data.email) {
            tampil('Email wajib diisi.', 'merah');
            bidang.email.focus();
            return;
        }

        if (!data.no_hp) {
            tampil('Nomor HP wajib diisi.', 'merah');
            bidang.no_hp.focus();
            return;
        }

        if (!data.kelas) {
            tampil('Pilih kelas kamu dulu.', 'merah');
            bidang.kelas.focus();
            return;
        }

        if (data.password.length < 6) {
            tampil('Kata sandi minimal 6 karakter.', 'merah');
            bidang.sandi.focus();
            return;
        }

        if (!window.Api) {
            tampil('Klien API tidak termuat. Periksa assets/js/api.js.', 'merah');
            return;
        }

        muat(true);

        Api.register(data).then(function (response) {
            selesai = true;
            form.reset();

            var pesan = response && response.message
                ? response.message
                : 'Pendaftaran berhasil. Tunggu persetujuan admin.';

            tampil(pesan + ' Halaman akan dialihkan ke menu masuk...', 'hijau');

            window.setTimeout(function () {
                window.location.replace('index.html?daftar=1');
            }, 2200);
        }).catch(function (error) {
            muat(false);
            tampil(pesanError(error), 'merah');
        });
    });
})();
