/* ─── CONFIG ──────────────────────────────────────── */
// API key is stored as a Cloudflare Worker secret — never exposed to the browser.
// Replace the URL below with your deployed Worker URL after running:
//   cd worker && npx wrangler deploy
const API_URL = 'https://ralph-ai-proxy.ivanprokopenkose7en.workers.dev';

/* ─── DOM refs ────────────────────────────────────── */
const dropZone     = document.getElementById('canvas');
const fileInput    = document.getElementById('fileInput');
const chooseBtn    = document.getElementById('chooseBtn');
const dropText     = document.getElementById('dropTextGroup');
const previewGrid  = document.getElementById('previewGrid');
const resultRow    = document.getElementById('resultRow');
const btnAnalyze   = document.getElementById('btnAnalyze');
const uncertaintyMsg = document.getElementById('uncertaintyMsg');
const errorMsg     = document.getElementById('errorMsg');
const cropperModal  = document.getElementById('cropperModal');
const cropperImg    = document.getElementById('cropperImg');
const btnCropConfirm = document.getElementById('btnCropConfirm');
const btnCropCancel  = document.getElementById('btnCropCancel');
const previewClearAll = document.getElementById('previewClearAll');
const previewClearAllContainer = document.getElementById('previewClearAllContainer');
const updateModalOverlay = document.getElementById('updateModalOverlay');
const updateModalClose = document.getElementById('updateModalClose');

/* ─── i18n ────────────────────────────────────────── */
const storedLang = localStorage.getItem('lang');
const isPolish = storedLang ? storedLang === 'pl' : (navigator.language || '').toLowerCase().startsWith('pl');

const i18n = {
  navLabels:       isPolish ? 'METKI'                                : 'LABELS',
  navContact:      isPolish ? 'KONTAKT'                              : 'CONTACT',
  subtitle:        isPolish ? 'Dodaj zdjęcie górnej metki'           : 'Add a photo of the label',
  supportedLabelsNote: isPolish
    ? '*Zobacz <a href="labels.html">listę wspieranych metek</a>'
    : '*See the <a href="labels.html">list of supported labels</a>',
  notePrefix:      isPolish ? '*Na razie obsługiwane są tylko metki' : "*Currently, only",
  noteBold:        isPolish ? ' \u201ePolo by Ralph Lauren\u201d'    : " 'Polo by Ralph Lauren' labels are supported",
  clearAll:        isPolish ? 'Wyczyść wszystko'                     : 'Clear all',
  chooseBtn:       isPolish ? 'Wybierz zdjęcie'                      : 'Choose photo',
  dropLine1:       isPolish ? 'lub upuść zdjęcia tutaj'              : 'or drop photos here',
  dropLine2:       isPolish ? 'albo wklej z Ctrl+V'                  : 'or paste with Ctrl+V',
  checkTag:        isPolish ? 'Sprawdź metkę'                        : 'Check label',
  checkTags:       (n) => isPolish ? `Sprawdź metki (${n})`          : `Check labels (${n})`,
  analyzing:       isPolish ? 'Analizowanie\u2026'                   : 'Analyzing\u2026',
  howTo:           isPolish ? 'Jak kadrować zdjęcia?'                : 'How to crop photos?',
  cropCancel:      isPolish ? 'Anuluj'                               : 'Cancel',
  cropConfirm:     isPolish ? 'Przytnij i użyj'                      : 'Crop and use',
  footerCreatedBy: isPolish ? 'Stworzone przez'                      : 'Created by',
  photo:           (n) => isPolish ? `Zdjęcie ${n}`                  : `Photo ${n}`,
  chipUnknown:     isPolish ? 'Nieznany'                             : 'Unknown',
  chipAuthentic:   isPolish ? 'Oryginał'                             : 'Authentic',
  chipFake:        'Fake',
  confidence:      (pct) => isPolish ? `pewność: ${pct}%`            : `confidence: ${pct}%`,
  errorCannotRead: isPolish ? 'Nie można odczytać pliku.'            : 'Cannot read file.',
  errorApi:        (st, d) => isPolish
    ? `Błąd API ${st}: ${d || 'nieznany błąd serwera.'}`
    : `API error ${st}: ${d || 'unknown server error.'}`,
  errorAnalysis:   isPolish ? 'Błąd podczas analizy. Spróbuj ponownie.' : 'Analysis error. Please try again.',
  uncertaintyHtml: isPolish 
    ? 'Niektóre wyniki są zbyt niepewne. Spróbuj ponownie zrobić zdjęcia i przyciąć je dokładniej. Jeśli wynik nadal jest niepewny, prześlij te zdjęcia na <a href="mailto:kontakt@ralphai.tech">adres e-mail strony</a> w celu weryfikacji przez człowieka lub opublikuj je na grupach takich jak <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank">r/PoloRalphLaurenLC</a> lub <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank">r/ralphlaurenlegitcheck</a>.'
    : 'Some of the results are too uncertain. Please, try re-cropping yellow photos more closely and checking them again. If the result is still uncertain, then please send those photos to the <a href="mailto:contact@ralphai.tech">website\'s email</a> for a human legit check or post it on groups like <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank">r/PoloRalphLaurenLC</a> or <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank">r/ralphlaurenlegitcheck</a>.',
};

const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (typeof i18n[key] === 'string') el.textContent = i18n[key];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (typeof i18n[key] === 'string') el.innerHTML = i18n[key];
  });
  if (!isPolish) document.documentElement.lang = 'en';
  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.textContent = isPolish ? 'EN' : 'PL';
  const navContact = document.getElementById('navContactLink');
  if (navContact) navContact.href = `mailto:${EMAIL}`;
  const footerEmail = document.getElementById('footerEmailLink');
  if (footerEmail) { footerEmail.href = `mailto:${EMAIL}`; footerEmail.textContent = EMAIL; }

  const uncertaintyMsgEl = document.getElementById('uncertaintyMsg');
  if (uncertaintyMsgEl) {
    uncertaintyMsgEl.innerHTML = i18n.uncertaintyHtml;
  }
}
applyTranslations();

document.getElementById('langToggle').addEventListener('click', () => {
  localStorage.setItem('lang', isPolish ? 'en' : 'pl');
  location.reload();
});

/* ─── Update popup ───────────────────────────────── */
let previousBodyOverflow = '';

function openUpdateModal() {
  if (!updateModalOverlay) return;
  previousBodyOverflow = document.body.style.overflow;
  updateModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeUpdateModal() {
  if (!updateModalOverlay) return;
  updateModalOverlay.hidden = true;
  document.body.style.overflow = previousBodyOverflow || '';
}

if (updateModalOverlay && updateModalClose) {
  // Only show the modal if not already shown in this browser
  if (!localStorage.getItem('updateModalShown')) {
    openUpdateModal();
    localStorage.setItem('updateModalShown', '1');
  }

  updateModalClose.addEventListener('click', closeUpdateModal);

  updateModalOverlay.addEventListener('click', (e) => {
    if (e.target === updateModalOverlay) closeUpdateModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !updateModalOverlay.hidden) closeUpdateModal();
  });
}

/* ─── State ───────────────────────────────────────── */
let croppedImages   = [];
let cropQueue       = [];
let cropperInstance = null;

/* ─── Warmup ping ─────────────────────────────────── */
// Sends a real 1×1 JPEG so the Worker forwards it to Roboflow,
// forcing the model to load before the user submits a photo.
(function scheduleWarmup() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  c.getContext('2d').fillRect(0, 0, 1, 1);
  const base64 = c.toDataURL('image/jpeg', 0.5).split(',')[1];
  function ping() {
    fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    base64,
    }).catch(() => {});
  }
  ping();
  setInterval(ping, 4 * 60 * 1000);
})();

/* ─── Logo → reset to start ───────────────────────── */
document.querySelector('.nav-logo').addEventListener('click', (e) => {
  e.preventDefault();
  croppedImages = [];
  cropQueue = [];
  renderGrid();
  hideError();
  hideResult();
  fileInput.value = '';
});

/* ─── Upload area interactions ────────────────────── */
chooseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFiles(Array.from(e.target.files));
  fileInput.value = '';
});

/* Prevent browser from opening dropped/pasted files as a new page */
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop',     (e) => e.preventDefault());

/* Drag & drop */
let dragCounter = 0;

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragover', (e) => e.preventDefault());

['dragleave', 'dragend'].forEach(evt =>
  dropZone.addEventListener(evt, () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; dropZone.classList.remove('drag-over'); }
  })
);

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length) handleFiles(files);
});

/* Paste from clipboard */
document.addEventListener('paste', (e) => {
  e.preventDefault();
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const files = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length) handleFiles(files);
});

/* ─── File handler ────────────────────────────────── */
function handleFiles(files) {
  hideError();
  files.forEach(f => cropQueue.push(f));
  processNextCrop();
}

function processNextCrop() {
  if (!cropQueue.length) return;
  const file = cropQueue.shift();
  const reader = new FileReader();
  reader.onload = (ev) => openCropper(ev.target.result);
  reader.readAsDataURL(file);
}

/* ─── Cropper ─────────────────────────────────────── */
function openCropper(src) {
  cropperImg.src = src;
  cropperModal.hidden = false;

  // Small delay so the image renders before Cropper initialises
  setTimeout(() => {
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(cropperImg, {
      viewMode:     1,
      autoCropArea: 0.9,
      movable:      true,
      zoomable:     true,
      scalable:     false,
      rotatable:    false,
    });
  }, 50);
}

function closeCropper() {
  cropperModal.hidden = true;
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  cropperImg.src = '';
  // Reset file input so the same file can be re-selected
  fileInput.value = '';
}

btnCropConfirm.addEventListener('click', () => {
  if (!cropperInstance) return;

  const canvas = cropperInstance.getCroppedCanvas({ maxWidth: 640, maxHeight: 640 });
  if (!canvas) return;
  canvas.toBlob((blob) => {
    croppedImages.push({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.88) });
    closeCropper();
    renderGrid();
    processNextCrop();
  }, 'image/jpeg', 0.88);
});

btnCropCancel.addEventListener('click', () => {
  cropQueue = [];
  closeCropper();
});

/* ─── Clear all button ────────────────────────────── */
previewClearAll.addEventListener('click', () => {
  croppedImages = [];
  cropQueue = [];
  fileInput.value = '';
  hideError();
  hideResult();
  renderGrid();
});

/* ─── Preview grid ───────────────────────────────── */
function renderGrid() {
  if (croppedImages.length === 0) {
    previewGrid.hidden = true;
    previewGrid.innerHTML = '';
    chooseBtn.hidden = false;
    dropText.hidden = false;
    btnAnalyze.hidden = true;
    previewClearAllContainer.hidden = true;
    if (uncertaintyMsg) uncertaintyMsg.hidden = true;
    return;
  }

  let hasLowConfidence = false;
  croppedImages.forEach(img => {
    if (img.chip && img.chip.includes('result-chip--unknown')) {
      hasLowConfidence = true;
    }
  });
  if (uncertaintyMsg) uncertaintyMsg.hidden = !hasLowConfidence;

  previewGrid.hidden = false;
  chooseBtn.hidden = true;
  dropText.hidden = true;
  btnAnalyze.hidden = false;
  previewClearAllContainer.hidden = false;
  const n = croppedImages.length;
  btnAnalyze.querySelector('span').textContent = n === 1 ? i18n.checkTag : i18n.checkTags(n);

  previewGrid.innerHTML = croppedImages.map((img, i) => `
    <div class="preview-card" data-card-index="${i}">
      <div class="preview-thumb">
        <img src="${img.dataUrl}" alt="${i18n.photo(i + 1)}" />
        <button class="preview-thumb-remove" data-index="${i}" aria-label="Usuń">&#x2715;</button>
      </div>
      ${img.chip ? img.chip : ''}
    </div>
  `).join('') + `<button class="preview-thumb preview-thumb-add" id="addMoreBtn">+</button>`;

  previewGrid.querySelectorAll('.preview-thumb-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      croppedImages.splice(idx, 1);
      renderGrid();
    });
  });

  document.getElementById('addMoreBtn').addEventListener('click', () => fileInput.click());
}

/* ─── Analyze button ──────────────────────────────── */
btnAnalyze.addEventListener('click', async () => {
  if (!croppedImages.length) return;
  hideError();
  hideResult();

  btnAnalyze.classList.add('loading');
  btnAnalyze.querySelector('span').textContent = i18n.analyzing;
  btnAnalyze.disabled = true;

  try {
    // We already have the max-640px JPEG dataUrl from the Cropper.
    // Skip toResizedBase64 to prevent degrading the image with double-JPEG compression loss.
    const results = await Promise.all(
      croppedImages.map(({ dataUrl }) => classifyImage(dataUrl.split(',')[1]))
    );
    displayResults(results);
  } catch (err) {
    showError(err.message || i18n.errorAnalysis);
  } finally {
    btnAnalyze.classList.remove('loading');
    const n = croppedImages.length;
    btnAnalyze.querySelector('span').textContent = n === 1 ? i18n.checkTag : i18n.checkTags(n);
    btnAnalyze.disabled = false;
  }
});

/* ─── Roboflow API call ───────────────────────────── */
async function classifyImage(base64) {
  const response = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    base64,
  });

  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch (_) {}
    throw new Error(i18n.errorApi(response.status, detail));
  }

  return response.json();
}

/* ─── Display results ─────────────────────────────── */
function displayResults(dataArr) {
  dataArr.forEach((data, i) => {
    if (croppedImages[i]) {
      croppedImages[i].chip = buildResultChip(data);
    }
  });

  resultRow.hidden = true;
  renderGrid();
}

function buildResultChip(data) {
  const predictedClass = (data.top || 'unknown').toLowerCase();
  const pct = Math.round((data.confidence ?? 0) * 100);

  let chipClass  = 'result-chip--unknown';
  let labelText  = i18n.chipUnknown;

  if (predictedClass.includes('authentic') || predictedClass.includes('original') || predictedClass.includes('oryginal') || predictedClass.includes('prawdziwy') || predictedClass === 'real') {
    chipClass = 'result-chip--authentic';
    labelText = i18n.chipAuthentic;
  } else if (predictedClass.includes('fake') || predictedClass.includes('podróbka') || predictedClass.includes('replica') || predictedClass.includes('fals')) {
    chipClass = 'result-chip--fake';
    labelText = i18n.chipFake;
  }

  if (pct <= 80) {
    chipClass = 'result-chip--unknown';
  }

  return `<div class="result-chip ${chipClass}"><span class="result-chip-verdict">${labelText}</span><span class="result-chip-pct">${i18n.confidence(pct)}</span></div>`;
}

/* ─── Helpers ─────────────────────────────────────── */
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function hideError() {
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}

function hideResult() {
  resultRow.hidden = true;
  resultRow.innerHTML = '';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
