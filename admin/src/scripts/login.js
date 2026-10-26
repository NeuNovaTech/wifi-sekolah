/**
 * Proses masuk Panel Admin.
 * Memakai klien API di assets/js/api.js (cookie sesi + token CSRF otomatis).
 */
(function () {
    'use strict';

    var form = document.getElementById('form-admin-login');

    if (!form) {
        return;
    }

    var alertBox = document.getElementById('login-alert');
    var inputNipd = document.getElementById('nipd');
    var inputSandi = document.getElementById('sandi');
    var tombol = document.getElementById('tombol-masuk');
    var toggle = document.getElementById('lihat-sandi');

    function show(message) {
        if (!alertBox) {
            return;
        }

        alertBox.textContent = message;
        alertBox.classList.add('tampil');
    }

    function clear() {
        if (!alertBox) {
            return;
        }

        alertBox.textContent = '';
        alertBox.classList.remove('tampil');
    }

    function setLoading(aktif) {
        tombol.disabled = aktif;
        tombol.classList.toggle('memuat', aktif);

        if (aktif) {
            tombol.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Memproses...</span>';
        } else {
            tombol.innerHTML = '<span>Masuk</span><i class="bi bi-arrow-right"></i>';
        }
    }

    function firstError(error) {
        if (!error || !error.errors) {
            return null;
        }

        var keys = Object.keys(error.errors);

        if (!keys.length) {
            return null;
        }

        var messages = error.errors[keys[0]];

        return messages && messages.length ? messages[0] : null;
    }

    function messageFor(error) {
        if (!error) {
            return 'Terjadi kesalahan. Coba lagi.';
        }

        if (error.status === 0) {
            return 'Tidak bisa menghubungi server. Pastikan server Node.js berjalan dan halaman dibuka lewat http://localhost:8090, bukan file://.';
        }

        if (error.status === 500) {
            return error.message || 'Server sedang bermasalah. Coba lagi beberapa saat.';
        }

        if (error.status === 401) {
            return 'NIPD atau kata sandi salah.';
        }

        if (error.status === 422) {
            return firstError(error) || error.message;
        }

        if (error.status === 419) {
            return 'Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.';
        }

        return error.message || 'Gagal masuk. Coba lagi.';
    }

    // Pesan yang dikirim oleh auth-guard.js saat pengalihan.
    var kode = new URLSearchParams(window.location.search).get('error');

    if (kode === 'akses') {
        show('Akun yang sedang aktif bukan admin. Silakan masuk dengan akun admin.');
    } else if (kode === 'server') {
        show('Tidak bisa memeriksa sesi admin. Pastikan server API berjalan.');
    }

    // Bila sudah punya sesi admin aktif, langsung ke dashboard.
    if (window.Api) {
        Api.me().then(function (response) {
            var data = response && response.data ? response.data : {};

            if (data.authenticated && data.user && data.user.role === 'admin') {
                window.location.replace('dashboard.html');
            }
        }).catch(function () {
            /* Biarkan formulir tampil; kesalahan akan terlihat saat submit. */
        });
    }

    if (toggle) {
        toggle.addEventListener('click', function () {
            var tampil = inputSandi.type === 'password';

            inputSandi.type = tampil ? 'text' : 'password';
            toggle.innerHTML = '<i class="bi bi-eye' + (tampil ? '-slash' : '') + '"></i>';
            toggle.setAttribute('aria-label', tampil ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
            inputSandi.focus();
        });
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        clear();

        var nipd = inputNipd.value.trim();
        var sandi = inputSandi.value;

        if (!nipd) {
            show('NIPD wajib diisi.');
            inputNipd.focus();
            return;
        }

        if (!sandi) {
            show('Kata sandi wajib diisi.');
            inputSandi.focus();
            return;
        }

        if (!window.Api) {
            show('Klien API tidak termuat. Periksa file assets/js/api.js.');
            return;
        }

        setLoading(true);

        Api.login({ nipd: nipd, password: sandi }).then(function (response) {
            var user = response && response.data ? response.data.user : null;

            if (!user || user.role !== 'admin') {
                return Api.logout().catch(function () {
                    /* Sesi siswa tetap diakhiri walaupun permintaan logout gagal. */
                }).then(function () {
                    show('Akun ini bukan admin. Silakan masuk dengan akun admin.');
                    setLoading(false);
                    inputNipd.focus();
                });
            }

            window.location.replace('dashboard.html');
        }).catch(function (error) {
            show(messageFor(error));
            setLoading(false);

            if (error && error.status === 401) {
                inputSandi.select();
            }
        });
    });
})();
