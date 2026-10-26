const tBtn = document.getElementById('lihat-sandi');
if (tBtn) tBtn.onclick = () => {
  const s = document.getElementById('sandi');
  s.type = s.type === 'password' ? 'text' : 'password';
};

const bBtn = document.getElementById('bantuan');
const bBox = document.getElementById('bantuan-box');
if (bBtn && bBox) bBtn.onclick = () => { bBox.hidden = !bBox.hidden; };

const cBtn = document.getElementById('tutup-bantuan');
if (cBtn && bBox) cBtn.onclick = () => { bBox.hidden = true; };

const skOverlay = document.getElementById('sk-overlay');
const skCheck = document.getElementById('setujui');
const skTutup = document.getElementById('tutup-sk');
const skSetuju = document.getElementById('setuju-sk');
const skTolak = document.getElementById('tolak-sk');
const skLink = document.getElementById('buka-sk');
const skIsi = document.querySelector('.sk-isi');
const skAksi = document.querySelector('.sk-aksi');

const pasangTinggi = () => {
  document.documentElement.style.setProperty('--skvh', (window.innerHeight * 0.01) + 'px');
};
pasangTinggi();
window.addEventListener('resize', pasangTinggi);
window.addEventListener('orientationchange', pasangTinggi);

let aksiSiap = false;

const cekSkrol = () => {
  if (!skIsi || !skAksi || aksiSiap) return;
  if (skIsi.scrollHeight - skIsi.scrollTop - skIsi.clientHeight <= 8) {
    aksiSiap = true;
    skAksi.hidden = false;
  }
};

if (skIsi) skIsi.addEventListener('scroll', cekSkrol);
window.addEventListener('resize', cekSkrol);

const bukaSk = () => {
  pasangTinggi();
  skOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  aksiSiap = false;
  if (skAksi) skAksi.hidden = true;
  if (skIsi) skIsi.scrollTop = 0;
  cekSkrol();
};

const tutupSk = () => {
  skOverlay.hidden = true;
  document.body.style.overflow = '';
};

if (skOverlay && skCheck) {
  skCheck.onchange = () => {
    if (skCheck.checked) bukaSk();
  };
}

if (skOverlay && skLink) skLink.onclick = bukaSk;
if (skOverlay && skTutup) skTutup.onclick = tutupSk;
if (skOverlay && skSetuju) skSetuju.onclick = tutupSk;
if (skOverlay && skTolak) skTolak.onclick = () => {
  if (skCheck) skCheck.checked = false;
  tutupSk();
};