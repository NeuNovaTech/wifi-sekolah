/**
 * Gerbang sesi halaman siswa.
 *
 * Letakkan di <head> setelah assets/js/api.js:
 *   <script src="../assets/js/api.js"></script>
 *   <script src="src/scripts/user-guard.js"></script>
 *
 * - Belum login        -> dialihkan ke index.html
 * - Login sebagai admin -> dialihkan ke panel admin
 * - Server mati        -> index.html?error=server
 *
 * Halaman bisa menunggu window.UserReady (Promise berisi data user).
 */
(function () {
    'use strict';

    if (window.location.protocol === 'file:') {
        window.UserReady = Promise.resolve(null);
        return;
    }

    var root = document.documentElement;
    root.classList.add('auth-pending');

    function toLogin(reason) {
        var target = 'index.html';

        if (reason) {
            target += '?error=' + encodeURIComponent(reason);
        }

        window.location.replace(target);
    }

    function reveal() {
        root.classList.remove('auth-pending');
    }

    if (!window.Api) {
        toLogin('server');
        window.UserReady = Promise.resolve(null);
        return;
    }

    var timer = window.setTimeout(function () {
        toLogin('server');
    }, 10000);

    window.UserReady = Api.me().then(function (response) {
        window.clearTimeout(timer);

        var data = response && response.data ? response.data : {};

        if (data.authenticated && data.user) {
            if (data.user.role === 'admin') {
                window.location.replace('../admin/dashboard.html');
                return null;
            }

            reveal();
            return data.user;
        }

        toLogin('');
        return null;
    }).catch(function () {
        window.clearTimeout(timer);
        toLogin('server');
        return null;
    });
})();
