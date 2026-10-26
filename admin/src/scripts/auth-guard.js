/**
 * Gerbang autentikasi halaman admin.
 *
 * Cara pakai (letakkan di <head>, setelah memuat assets/js/api.js):
 *   <script src="../assets/js/api.js"></script>
 *   <script src="src/scripts/auth-guard.js"></script>
 *
 * - Belum login / bukan admin  -> dialihkan ke index.html (halaman login)
 * - Server API tidak terjangkau -> dialihkan ke index.html?error=server
 * - Dibuka lewat file://        -> halaman tetap tampil (mode pratinjau desain)
 */
(function () {
    'use strict';

    var root = document.documentElement;

    // Pratinjau desain dari file lokal tidak bisa memakai sesi API.
    if (window.location.protocol === 'file:') {
        return;
    }

    root.classList.add('auth-pending');

    function goToLogin(reason) {
        var target = 'index.html';

        if (reason) {
            target += '?error=' + encodeURIComponent(reason);
        }

        window.location.replace(target);
    }

    function reveal() {
        root.classList.remove('auth-pending');
    }

    function onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function applyUser(user) {
        onReady(function () {
            var name = document.querySelector('.akun b');
            var role = document.querySelector('.akun small');

            if (name && user.name) {
                name.textContent = user.name;
            }

            if (role) {
                role.textContent = 'Operator';
            }

            var keluar = document.querySelector('.keluar');

            if (!keluar) {
                return;
            }

            keluar.addEventListener('click', function (event) {
                event.preventDefault();

                var done = function () {
                    window.location.replace('index.html');
                };

                if (window.Api) {
                    Api.logout().then(done, done);
                } else {
                    done();
                }
            });
        });
    }

    if (!window.Api) {
        goToLogin('server');
        return;
    }

    // Jaring pengaman: jangan biarkan halaman tertutup selamanya.
    var timer = window.setTimeout(function () {
        goToLogin('server');
    }, 10000);

    Api.me().then(function (response) {
        window.clearTimeout(timer);

        var data = response && response.data ? response.data : {};

        if (data.authenticated && data.user && data.user.role === 'admin') {
            applyUser(data.user);
            reveal();
            return;
        }

        if (data.authenticated) {
            // Sedang login sebagai siswa: akhiri sesi agar tidak tertukar.
            Api.logout().then(
                function () { goToLogin('akses'); },
                function () { goToLogin('akses'); }
            );
            return;
        }

        goToLogin('');
    }).catch(function () {
        window.clearTimeout(timer);
        goToLogin('server');
    });
})();
