/**
 * Kirim keluhan siswa ke API (tersimpan di database, bukan localStorage).
 */
(function () {
    'use strict';

    var form = document.getElementById('form-keluhan');

    if (!form) {
        return;
    }

    var kotak = document.getElementById('keluhan-alert');
    var pelapor = document.getElementById('info-pelapor');
    var kategori = document.getElementById('kategori');
    var isi = document.getElementById('keluhan');
    var tombol = form.querySelector('button[type="submit"]');
    var terkirim = false;

    function tampil(pesan, jenis) {
        if (!kotak) {
            return;
        }

        kotak.textContent = pesan;
        kotak.hidden = false;
        kotak.className = 'notif' + (jenis ? ' ' + jenis : '');
    }

    function pesanError(error) {
        if (!error) {
            return 'Terjadi kesalahan. Coba lagi.';
        }

        if (error.status === 0) {
            return 'Server tidak bisa dihubungi. Coba lagi beberapa saat.';
        }

        if (error.status === 422 && error.errors) {
            var kunci = Object.keys(error.errors)[0];
            return (error.errors[kunci] || [])[0] || error.message;
        }

        return error.message || 'Keluhan gagal dikirim.';
    }

    function esc(nilai) {
        return String(nilai === null || nilai === undefined ? '' : nilai)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tampilkanPelapor(user) {
        if (!pelapor) {
            return;
        }

        pelapor.innerHTML = '<i class="bi bi-person-circle"></i>'
            + '<span>Mengirim sebagai <b>' + esc(user.nama || 'Siswa') + '</b>'
            + ' • NIPD ' + esc(user.nipd || '—')
            + ' • ' + esc(user.kelas || '—') + '</span>';
    }

    function muat(aktif) {
        if (!tombol) {
            return;
        }

        tombol.disabled = aktif;
        tombol.innerHTML = aktif
            ? '<i class="bi bi-arrow-repeat"></i> Mengirim...'
            : 'Kirim Keluhan';
    }

    if (window.UserReady && typeof window.UserReady.then === 'function') {
        window.UserReady.then(function (user) {
            if (user) {
                tampilkanPelapor(user);
            }
        });
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (terkirim) {
            return;
        }

        var nilaiKategori = kategori.value;
        var nilaiIsi = isi.value.trim();

        if (!nilaiKategori) {
            tampil('Pilih kategori keluhan dulu.', 'merah');
            kategori.focus();
            return;
        }

        if (nilaiIsi.length < 10) {
            tampil('Ceritakan keluhan minimal 10 karakter agar admin paham masalahnya.', 'merah');
            isi.focus();
            return;
        }

        muat(true);

        Api.post('keluhan', {
            kategori: nilaiKategori,
            isi: nilaiIsi
        }).then(function (response) {
            terkirim = true;
            muat(false);

            var kode = response && response.data ? response.data.kode : '';
            var pesan = response && response.message ? response.message : 'Keluhan terkirim.';

            tampil((kode ? 'Tiket ' + kode + ' terkirim. ' : '') + pesan, 'hijau');
            form.reset();

            window.setTimeout(function () {
                window.location.replace('riwayat.html?kirim=1');
            }, 1600);
        }).catch(function (error) {
            muat(false);
            tampil(pesanError(error), 'merah');
        });
    });
})();
