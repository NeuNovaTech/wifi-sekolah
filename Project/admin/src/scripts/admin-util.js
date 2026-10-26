/**
 * Utilitas bersama halaman admin: format, status, modal, toast.
 */
(function (global) {
    'use strict';

    function esc(nilai) {
        return String(nilai === null || nilai === undefined ? '' : nilai)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function teks(id, nilai) {
        var el = document.getElementById(id);

        if (el) {
            el.textContent = nilai === null || nilai === undefined ? '—' : String(nilai);
        }
    }

    function inisial(nama) {
        return String(nama || '?')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(function (kata) { return kata.charAt(0).toUpperCase(); })
            .join('');
    }

    function keTanggal(nilai) {
        if (!nilai) {
            return null;
        }

        var d = new Date(String(nilai).replace(' ', 'T'));

        return isNaN(d.getTime()) ? null : d;
    }

    function tanggal(nilai, pakaiJam) {
        var d = keTanggal(nilai);

        if (!d) {
            return '—';
        }

        var hasil = d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        if (pakaiJam !== false) {
            hasil += ' ' + d.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        return hasil;
    }

    function jam(nilai) {
        var d = keTanggal(nilai);

        return d
            ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '—';
    }

    function relatif(nilai) {
        var d = keTanggal(nilai);

        if (!d) {
            return '—';
        }

        var detik = Math.floor((Date.now() - d.getTime()) / 1000);

        if (detik < 60) {
            return 'baru saja';
        }

        if (detik < 3600) {
            return Math.floor(detik / 60) + ' menit lalu';
        }

        if (detik < 86400) {
            return Math.floor(detik / 3600) + ' jam lalu';
        }

        if (detik < 604800) {
            return Math.floor(detik / 86400) + ' hari lalu';
        }

        return tanggal(nilai, false);
    }

    var STATUS_SISWA = {
        pending: { label: 'Pending', kelas: 'status--warn' },
        aktif: { label: 'Aktif', kelas: 'status--ok' },
        ditolak: { label: 'Ditolak', kelas: 'status--bad' },
        blokir: { label: 'Diblokir', kelas: 'status--bad' }
    };

    function statusSiswa(status) {
        var item = STATUS_SISWA[status] || { label: status || '—', kelas: 'status--netral' };

        return '<span class="status ' + item.kelas + '"><i></i>' + esc(item.label) + '</span>';
    }

    var STATUS_TIKET = {
        menunggu: { label: 'Baru', kelas: 'chip--warn' },
        diproses: { label: 'Diproses', kelas: 'chip--blue' },
        selesai: { label: 'Selesai', kelas: 'chip--ok' },
        ditolak: { label: 'Ditolak', kelas: 'chip--bad' }
    };

    function statusTiket(status) {
        var item = STATUS_TIKET[status] || { label: status || '—', kelas: 'chip--abu' };

        return '<span class="chip ' + item.kelas + '">' + esc(item.label) + '</span>';
    }

    function labelTiket(status) {
        return (STATUS_TIKET[status] || {}).label || status;
    }

    var KATEGORI = {
        koneksi: 'Koneksi',
        kecepatan: 'Kecepatan',
        perangkat: 'Perangkat',
        akun: 'Akun',
        lain: 'Lainnya'
    };

    function labelKategori(kategori) {
        return KATEGORI[kategori] || kategori || 'Lainnya';
    }

    var toastTimer = null;

    function toast(pesan, jenis) {
        var lama = document.querySelector('.toast-admin');

        if (lama) {
            lama.remove();
        }

        var el = document.createElement('div');
        el.className = 'toast-admin' + (jenis ? ' ' + jenis : '');
        el.textContent = pesan;
        document.body.appendChild(el);

        window.setTimeout(function () {
            el.classList.add('tampil');
        }, 10);

        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            el.classList.remove('tampil');
            window.setTimeout(function () { el.remove(); }, 220);
        }, 3200);
    }

    function tutupModal() {
        var lama = document.querySelector('.modal-lapisan');

        if (lama) {
            lama.remove();
        }
    }

    /**
     * bukaModal({ judul, isi, aksi: [{label, kelas, onClick, tutup}] })
     */
    function bukaModal(opsi) {
        tutupModal();

        var layer = document.createElement('div');
        layer.className = 'modal-lapisan';
        layer.innerHTML = '<div class="modal-kotak" role="dialog" aria-modal="true">'
            + '<div class="modal-head"><b>' + esc(opsi.judul || '') + '</b>'
            + '<button type="button" class="modal-tutup" aria-label="Tutup">&times;</button></div>'
            + '<div class="modal-isi">' + (opsi.isi || '') + '</div>'
            + '<div class="modal-aksi"></div>'
            + '</div>';

        var aksi = layer.querySelector('.modal-aksi');

        (opsi.aksi || []).forEach(function (item) {
            var tombol = document.createElement('button');
            tombol.type = 'button';
            tombol.className = 'btn ' + (item.kelas || 'btn--ghost');
            tombol.innerHTML = item.label;

            tombol.onclick = function () {
                if (typeof item.onClick === 'function') {
                    item.onClick(layer, tombol);
                }

                if (item.tutup !== false) {
                    tutupModal();
                }
            };

            aksi.appendChild(tombol);
        });

        layer.querySelector('.modal-tutup').onclick = tutupModal;

        layer.addEventListener('click', function (event) {
            if (event.target === layer) {
                tutupModal();
            }
        });

        document.body.appendChild(layer);

        var pertama = layer.querySelector('input, select, textarea');

        if (pertama) {
            window.setTimeout(function () { pertama.focus(); }, 50);
        }

        return layer;
    }

    function pesanError(error) {
        if (!error) {
            return 'Terjadi kesalahan. Coba lagi.';
        }

        if (error.status === 0) {
            return 'Server API tidak bisa dihubungi.';
        }

        if (error.status === 401) {
            return 'Sesi berakhir. Silakan masuk kembali.';
        }

        if (error.status === 419) {
            return 'Token keamanan kedaluwarsa. Muat ulang halaman.';
        }

        if (error.status === 422 && error.errors) {
            var kunci = Object.keys(error.errors)[0];
            return (error.errors[kunci] || [])[0] || error.message;
        }

        return error.message || 'Permintaan gagal.';
    }

    /** Isi angka pada sidebar, lonceng, dan tanggal dari dashboard admin. */
    var headerSekali = false;

    function muatHeader() {
        if (headerSekali || !window.Api) {
            return;
        }

        headerSekali = true;

        Api.get('admin/dashboard').then(function (response) {
            var d = response.data || {};

            var navSiswa = document.querySelector('.sidebar nav a[href="siswa.html"] em');
            var navKeluhan = document.querySelector('.sidebar nav a[href="keluhan.html"] em');

            if (navSiswa) {
                navSiswa.textContent = String(d.total_siswa || 0);
            }

            if (navKeluhan) {
                var baru = Number(d.tiket_baru || 0);

                navKeluhan.textContent = String(baru);
                navKeluhan.classList.toggle('merah', baru > 0);
            }

            var lonceng = document.querySelector('.lonceng');

            if (lonceng) {
                var jumlah = lonceng.querySelector('span');

                if (jumlah) {
                    jumlah.textContent = String((Number(d.pending) || 0) + (Number(d.tiket_baru) || 0));
                }

                lonceng.onclick = function () {
                    window.location.href = 'keluhan.html';
                };
            }
        }).catch(function () {
            /* header tetap tampil walau ringkasan gagal dimuat */
        });
    }

    /** Jalankan fn setelah auth-guard selesai memverifikasi sesi. */
    function siap(fn) {
        if (window.location.protocol === 'file:') {
            fn();
            return;
        }

        var root = document.documentElement;

        function jalan() {
            muatHeader();
            fn();
        }

        if (!root.classList.contains('auth-pending')) {
            jalan();
            return;
        }

        var pengamat = new MutationObserver(function () {
            if (!root.classList.contains('auth-pending')) {
                pengamat.disconnect();
                jalan();
            }
        });

        pengamat.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    function unduhCsv(nama, baris) {
        var isi = baris.map(function (kolom) {
            return kolom.map(function (nilai) {
                return '"' + String(nilai === null || nilai === undefined ? '' : nilai)
                    .replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\r\n');

        var blob = new Blob(['\ufeff' + isi], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');

        a.href = url;
        a.download = nama;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    global.AdminUI = {
        esc: esc,
        teks: teks,
        inisial: inisial,
        tanggal: tanggal,
        jam: jam,
        relatif: relatif,
        statusSiswa: statusSiswa,
        statusTiket: statusTiket,
        labelTiket: labelTiket,
        labelKategori: labelKategori,
        toast: toast,
        bukaModal: bukaModal,
        tutupModal: tutupModal,
        pesanError: pesanError,
        siap: siap,
        unduhCsv: unduhCsv
    };
})(window);
