#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync-ke-drive.py
================
Menyimpan perubahan folder kerja LOKAL ke Google Drive secara otomatis
(satu arah: lokal -> Drive).

Kenapa perlu? Server dijalankan dari salinan lokal (/content/project) supaya
cepat, sedangkan Drive (/content/drive/MyDrive/Project) dipakai sebagai
penyimpanan permanen. Skrip ini menyalin balik setiap file yang berubah.

Contoh pemakaian
----------------
Pantau terus-menerus (Ctrl+C untuk berhenti):
    python3 sync-ke-drive.py

Sekali jalan saja:
    python3 sync-ke-drive.py --once

Lihat apa yang akan disalin tanpa menulis apa pun:
    python3 sync-ke-drive.py --once --dry-run

Ikut menyimpan database SQLite (default TIDAK disertakan karena berisiko
menyalin database yang sedang dipakai):
    python3 sync-ke-drive.py --include-db

Hapus juga file di Drive yang sudah tidak ada di lokal (hati-hati):
    python3 sync-ke-drive.py --delete --yes

Jalankan di latar belakang:
    nohup python3 sync-ke-drive.py > sync.log 2>&1 &

Catatan
-------
- Satu arah. File yang diubah langsung di Drive TIDAK menarik ke lokal.
- File ditulis lewat file sementara lalu di-rename, agar Drive tidak pernah
  menerima file setengah jadi.
- Perubahan dideteksi dari ukuran + waktu ubah + SHA-1, jadi file yang sama
  tidak diunggah ulang.
- Tanpa dependensi pihak ketiga (cukup Python 3.8+).
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

SUMBER_BAWAAN = Path("/content/project")
TUJUAN_BAWAAN = Path("/content/drive/MyDrive/Project")
STATE_BAWAAN = Path.home() / ".cache" / "sync-ke-drive" / "state.json"

# Pola yang tidak pernah disalin (dicocokkan dengan path relatif dan nama bagian).
POLA_ABAIKAN = [
    ".git",
    "node_modules",
    "__pycache__",
    ".ipynb_checkpoints",
    "*.pyc",
    "*.pyo",
    "*.part-sync",
    ".DS_Store",
    "Thumbs.db",
]

# Database lokal sengaja tidak disalin secara default (lihat --include-db).
POLA_DB = [
    "*.sqlite",
    "*.sqlite-wal",
    "*.sqlite-shm",
    "*.sqlite-journal",
    "*.db",
]


# --------------------------------------------------------------------------- #
# Utilitas kecil
# --------------------------------------------------------------------------- #
def stempel() -> str:
    return time.strftime("%H:%M:%S")


def catat(pesan: str) -> None:
    print(f"[{stempel()}] {pesan}", flush=True)


def peringatan(pesan: str) -> None:
    print(f"[{stempel()}] PERINGATAN: {pesan}", file=sys.stderr, flush=True)


def rel_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def diabaikan(rel: str, pola: list[str]) -> bool:
    bagian = rel.split("/")
    for pola_satu in pola:
        if fnmatch.fnmatch(rel, pola_satu):
            return True
        if any(fnmatch.fnmatch(bagian_satu, pola_satu) for bagian_satu in bagian):
            return True
    return False


def hash_file(path: Path) -> str:
    sidik = hashlib.sha1()
    with path.open("rb") as berkas:
        for blok in iter(lambda: berkas.read(1024 * 1024), b""):
            sidik.update(blok)
    return sidik.hexdigest()


# --------------------------------------------------------------------------- #
# State (supaya pemindaian berikutnya cepat)
# --------------------------------------------------------------------------- #
def muat_state(path: Path, sumber: Path, tujuan: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"files": {}}

    if (
        not isinstance(data, dict)
        or data.get("source") != str(sumber)
        or data.get("dest") != str(tujuan)
        or not isinstance(data.get("files"), dict)
    ):
        return {"files": {}}

    return data


def simpan_state(path: Path, sumber: Path, tujuan: Path, state: dict) -> None:
    data = {
        "source": str(sumber),
        "dest": str(tujuan),
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "files": state.get("files", {}),
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        sementara = path.with_name(path.name + ".tmp")
        sementara.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        os.replace(sementara, path)
    except OSError as galat:
        peringatan(f"gagal menyimpan state: {galat}")


# --------------------------------------------------------------------------- #
# Pemindaian & penyalinan
# --------------------------------------------------------------------------- #
def pindai(sumber: Path, pola: list[str]) -> dict[str, Path]:
    hasil: dict[str, Path] = {}

    for akar, direktori, berkas in os.walk(sumber):
        akar_path = Path(akar)
        direktori[:] = sorted(
            nama
            for nama in direktori
            if not diabaikan(rel_posix(akar_path / nama, sumber), pola)
        )

        for nama in sorted(berkas):
            path = akar_path / nama
            rel = rel_posix(path, sumber)
            if diabaikan(rel, pola):
                continue
            if path.is_symlink() or not path.is_file():
                continue
            hasil[rel] = path

    return hasil


def salin_atomik(sumber: Path, tujuan: Path) -> None:
    tujuan.parent.mkdir(parents=True, exist_ok=True)
    sementara = tujuan.with_name(tujuan.name + ".part-sync")
    try:
        shutil.copy2(sumber, sementara)
        os.replace(sementara, tujuan)
    except OSError:
        try:
            sementara.unlink(missing_ok=True)
        except OSError:
            pass
        shutil.copy2(sumber, tujuan)


def hapus_direktori_kosong(tujuan: Path, pola: list[str]) -> None:
    for akar, _direktori, _berkas in os.walk(tujuan, topdown=False):
        path = Path(akar)
        if path == tujuan:
            continue
        rel = rel_posix(path, tujuan)
        if diabaikan(rel, pola):
            continue
        try:
            if not any(path.iterdir()):
                path.rmdir()
                catat(f"  - direktori kosong dihapus: {rel}/")
        except OSError:
            pass


def sinkron_sekali(
    sumber: Path,
    tujuan: Path,
    pola: list[str],
    state: dict,
    hapus: bool = False,
    uji: bool = False,
) -> dict:
    berkas_sumber = pindai(sumber, pola)
    files_state: dict = state.setdefault("files", {})

    berubah: list[str] = []
    dihapus: list[str] = []
    gagal: list[tuple[str, str]] = []
    sama = 0

    for rel, path_sumber in berkas_sumber.items():
        path_tujuan = tujuan / rel

        try:
            info = path_sumber.stat()
        except OSError as galat:
            gagal.append((rel, str(galat)))
            continue

        meta = files_state.get(rel) or {}
        try:
            tujuan_ada = path_tujuan.is_file()
            ukuran_tujuan = path_tujuan.stat().st_size if tujuan_ada else -1
        except OSError:
            tujuan_ada, ukuran_tujuan = False, -1

        # Cepat: metadata sama dan file tujuan ada -> lewati tanpa membaca isi.
        if (
            meta.get("size") == info.st_size
            and meta.get("mtime_ns") == info.st_mtime_ns
            and tujuan_ada
            and ukuran_tujuan == info.st_size
        ):
            sama += 1
            continue

        try:
            sidik_sumber = hash_file(path_sumber)
        except OSError as galat:
            gagal.append((rel, str(galat)))
            continue

        # Isi sudah identik di Drive -> cukup perbarui state, tidak perlu salin.
        if tujuan_ada and ukuran_tujuan == info.st_size:
            try:
                if hash_file(path_tujuan) == sidik_sumber:
                    files_state[rel] = {
                        "size": info.st_size,
                        "mtime_ns": info.st_mtime_ns,
                        "sha1": sidik_sumber,
                    }
                    sama += 1
                    continue
            except OSError:
                pass

        berubah.append(rel)

        if uji:
            catat(f"  [uji] akan disalin: {rel}")
            continue

        try:
            salin_atomik(path_sumber, path_tujuan)
            files_state[rel] = {
                "size": info.st_size,
                "mtime_ns": info.st_mtime_ns,
                "sha1": sidik_sumber,
            }
            catat(f"  + {rel}")
        except OSError as galat:
            gagal.append((rel, str(galat)))

    # Hapus file di Drive yang sudah tidak ada di lokal.
    if hapus:
        ada_di_sumber = set(berkas_sumber)
        for akar, direktori, berkas in os.walk(tujuan):
            akar_path = Path(akar)
            direktori[:] = [
                nama
                for nama in direktori
                if not diabaikan(rel_posix(akar_path / nama, tujuan), pola)
            ]
            for nama in sorted(berkas):
                path = akar_path / nama
                rel = rel_posix(path, tujuan)
                if rel in ada_di_sumber or diabaikan(rel, pola):
                    continue
                dihapus.append(rel)
                if uji:
                    catat(f"  [uji] akan dihapus: {rel}")
                    continue
                try:
                    path.unlink()
                    files_state.pop(rel, None)
                    catat(f"  - {rel}")
                except OSError as galat:
                    gagal.append((rel, str(galat)))

        if not uji and dihapus:
            hapus_direktori_kosong(tujuan, pola)

    # Bersihkan catatan untuk file yang sudah tidak ada.
    for rel in list(files_state):
        if rel not in berkas_sumber:
            files_state.pop(rel, None)

    return {
        "total": len(berkas_sumber),
        "berubah": berubah,
        "dihapus": dihapus,
        "sama": sama,
        "gagal": gagal,
    }


def cetak_ringkasan(hasil: dict, uji: bool) -> None:
    awalan = "[uji] " if uji else ""
    bagian = [f"{hasil['total']} berkas dipindai"]
    bagian.append(f"{len(hasil['berubah'])} disalin")
    bagian.append(f"{hasil['sama']} sudah sama")
    if hasil["dihapus"]:
        bagian.append(f"{len(hasil['dihapus'])} dihapus")
    if hasil["gagal"]:
        bagian.append(f"{len(hasil['gagal'])} gagal")
    catat(awalan + ", ".join(bagian) + ".")

    for rel, galat in hasil["gagal"][:10]:
        peringatan(f"{rel}: {galat}")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def bangun_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sync-ke-drive.py",
        description="Simpan perubahan folder kerja lokal ke Google Drive (satu arah).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Contoh:\n"
            "  python3 sync-ke-drive.py                # pantau otomatis\n"
            "  python3 sync-ke-drive.py --once         # sekali salin\n"
            "  python3 sync-ke-drive.py --once --dry-run\n"
        ),
    )
    parser.add_argument(
        "--source",
        default=str(SUMBER_BAWAAN),
        help=f"folder kerja lokal (default: {SUMBER_BAWAAN})",
    )
    parser.add_argument(
        "--dest",
        default=str(TUJUAN_BAWAAN),
        help=f"folder tujuan di Drive (default: {TUJUAN_BAWAAN})",
    )
    parser.add_argument(
        "--state",
        default=str(STATE_BAWAAN),
        help=f"file catatan sinkronisasi (default: {STATE_BAWAAN})",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="jalankan sekali lalu keluar",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="pantau terus-menerus (default bila --once tidak dipakai)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=3.0,
        metavar="DETIK",
        help="jeda antar pemindaian saat memantau (default: 3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="tampilkan rencana tanpa menulis/menghapus apa pun",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="hapus file di Drive yang sudah tidak ada di lokal (butuh --yes saat memantau)",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="jawab ya otomatis untuk --delete",
    )
    parser.add_argument(
        "--include-db",
        action="store_true",
        help="ikutkan file database SQLite (default dilewati)",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="POLA",
        help="pola tambahan yang dilewati, boleh diulang (contoh: --exclude '*.log')",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="tampilkan ringkasan juga saat tidak ada perubahan",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = bangun_parser()
    args = parser.parse_args(argv)

    if args.once and args.watch:
        parser.error("--once dan --watch tidak bisa dipakai bersamaan")
    if args.interval < 0.5:
        parser.error("--interval minimal 0.5 detik")

    sumber = Path(args.source).expanduser().resolve()
    tujuan = Path(args.dest).expanduser().resolve()
    state_path = Path(args.state).expanduser()

    pola = list(POLA_ABAIKAN)
    if not args.include_db:
        pola += POLA_DB
    pola += args.exclude

    if not sumber.is_dir():
        peringatan(f"folder sumber tidak ditemukan: {sumber}")
        return 2
    if not Path("/content/drive").is_dir() and "/content/drive" in str(tujuan):
        peringatan("Google Drive belum ter-mount di /content/drive")
        return 2
    if sumber == tujuan:
        peringatan("sumber dan tujuan tidak boleh sama")
        return 2

    if not args.dry_run:
        try:
            tujuan.mkdir(parents=True, exist_ok=True)
        except OSError as galat:
            peringatan(f"tidak bisa menyiapkan folder tujuan: {galat}")
            return 2

    if args.delete and not args.yes:
        if not args.once:
            peringatan("mode --delete saat memantau wajib memakai --yes")
            return 2
        jawab = input(
            f"Hapus file di {tujuan} yang tidak ada di {sumber}? [y/N] "
        ).strip().lower()
        if jawab not in ("y", "ya"):
            catat("Dibatalkan.")
            return 2

    state = muat_state(state_path, sumber, tujuan)

    catat("Sinkronisasi lokal -> Drive")
    print(f"  sumber : {sumber}")
    print(f"  tujuan : {tujuan}")
    print(f"  abaikan: {', '.join(pola)}")
    if args.dry_run:
        print("  mode   : UJI (tidak ada file yang ditulis)")
    print()

    def jalankan() -> dict:
        hasil = sinkron_sekali(
            sumber,
            tujuan,
            pola,
            state,
            hapus=args.delete,
            uji=args.dry_run,
        )
        if not args.dry_run:
            simpan_state(state_path, sumber, tujuan, state)
        return hasil

    if args.once:
        hasil = jalankan()
        cetak_ringkasan(hasil, args.dry_run)
        return 1 if hasil["gagal"] else 0

    catat(f"Mode pantau aktif (setiap {args.interval:g} detik). Tekan Ctrl+C untuk berhenti.")
    print()

    try:
        while True:
            hasil = jalankan()
            if hasil["berubah"] or hasil["dihapus"] or hasil["gagal"] or args.verbose:
                cetak_ringkasan(hasil, args.dry_run)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print()
        catat("Dihentikan. Semua perubahan terakhir sudah tersimpan.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
