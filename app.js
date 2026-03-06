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
const errorMsg     = document.getElementById('errorMsg');
const cropperModal  = document.getElementById('cropperModal');
const cropperImg    = document.getElementById('cropperImg');
const btnCropConfirm = document.getElementById('btnCropConfirm');
const btnCropCancel  = document.getElementById('btnCropCancel');
const ankietaModal   = document.getElementById('ankietaModal');
const btnAnkietaClose = document.getElementById('btnAnkietaClose');
const previewClearAll = document.getElementById('previewClearAll');
const previewClearAllContainer = document.getElementById('previewClearAllContainer');

/* ─── State ───────────────────────────────────────── */
let croppedImages   = [];
let cropQueue       = [];
let cropperInstance = null;

/* ─── Warmup ping ─────────────────────────────────── */
// Fires an empty POST on page load to wake Roboflow's inference server,
// so the model is warm by the time the user submits a photo.
fetch(API_URL, { method: 'POST', body: '' }).catch(() => {});
// Keep the model warm every 4 minutes while the page stays open.
setInterval(() => {
  fetch(API_URL, { method: 'POST', body: '' }).catch(() => {});
}, 4 * 60 * 1000);

/* ─── Ankieta modal ───────────────────────────────── */
document.querySelector('.nav-ankieta').addEventListener('click', (e) => {
  e.preventDefault();
  ankietaModal.hidden = false;
  document.body.style.overflow = 'hidden';
});

btnAnkietaClose.addEventListener('click', () => {
  ankietaModal.hidden = true;
  document.body.style.overflow = '';
});

ankietaModal.addEventListener('click', (e) => {
  if (e.target === ankietaModal) {
    ankietaModal.hidden = true;
    document.body.style.overflow = '';
  }
});

/* ─── Scroll to top after form submit ─────────────── */
const ankietaIframe = ankietaModal.querySelector('iframe');
const ankietaInner  = ankietaModal.querySelector('.ankieta-modal-inner');
let iframeLoaded = false;
ankietaIframe.addEventListener('load', () => {
  if (!iframeLoaded) { iframeLoaded = true; return; } // skip initial load
  ankietaInner.scrollTo({ top: 0, behavior: 'smooth' });
});

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
    return;
  }

  previewGrid.hidden = false;
  chooseBtn.hidden = true;
  dropText.hidden = true;
  btnAnalyze.hidden = false;
  previewClearAllContainer.hidden = false;
  const n = croppedImages.length;
  btnAnalyze.querySelector('span').textContent = n === 1 ? 'Sprawdź metkę' : `Sprawdź metki (${n})`;

  previewGrid.innerHTML = croppedImages.map((img, i) => `
    <div class="preview-card" data-card-index="${i}">
      <div class="preview-thumb">
        <img src="${img.dataUrl}" alt="Zdjęcie ${i + 1}" />
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
  btnAnalyze.querySelector('span').textContent = 'Analizowanie…';
  btnAnalyze.disabled = true;

  try {
    const results = await Promise.all(
      croppedImages.map(({ blob }) => toResizedBase64(blob).then(classifyImage))
    );
    displayResults(results);
  } catch (err) {
    showError(err.message || 'Błąd podczas analizy. Spróbuj ponownie.');
  } finally {
    btnAnalyze.classList.remove('loading');
    const n = croppedImages.length;
    btnAnalyze.querySelector('span').textContent = n === 1 ? 'Sprawdź metkę' : `Sprawdź metki (${n})`;
    btnAnalyze.disabled = false;
  }
});

/* ─── Image → resized JPEG base64 ────────────────── */
/**
 * Roboflow inference works best with JPEG images ≤ 640 px.
 * Sending raw base64 as application/x-www-form-urlencoded
 * requires encodeURIComponent so that '+' chars are not
 * decoded as spaces on the server side.
 */
function toResizedBase64(file, maxPx = 640, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Downscale if either dimension exceeds maxPx
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      // Get raw base64 from data-URL (strip prefix)
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nie można odczytać pliku.'));
    };

    img.src = url;
  });
}

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
    throw new Error(
      `Błąd API ${response.status}: ${detail || 'nieznany błąd serwera.'}`
    );
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
  let labelText  = 'Nieznany';

  if (predictedClass.includes('authentic') || predictedClass.includes('original') || predictedClass.includes('oryginal') || predictedClass.includes('prawdziwy') || predictedClass === 'real') {
    chipClass = 'result-chip--authentic';
    labelText = 'Oryginał';
  } else if (predictedClass.includes('fake') || predictedClass.includes('podróbka') || predictedClass.includes('replica') || predictedClass.includes('fals')) {
    chipClass = 'result-chip--fake';
    labelText = 'Fake';
  }

  return `<div class="result-chip ${chipClass}"><span class="result-chip-verdict">${labelText}</span><span class="result-chip-pct">pewność: ${pct}%</span></div>`;
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
