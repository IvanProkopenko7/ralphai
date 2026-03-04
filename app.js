/* ─── CONFIG ──────────────────────────────────────── */
// API key is stored as a Cloudflare Worker secret — never exposed to the browser.
// Replace the URL below with your deployed Worker URL after running:
//   cd worker && npx wrangler deploy
const API_URL = 'https://ralph-ai-proxy.ivanprokopenkose7en.workers.dev';

/* ─── DOM refs ────────────────────────────────────── */
const uploadArea   = document.getElementById('uploadArea');
const fileInput    = document.getElementById('fileInput');
const previewImg   = document.getElementById('previewImg');
const plusIcon     = document.getElementById('plusIcon');
const uploadLabel  = document.getElementById('uploadLabel');
const btnAnalyze   = document.getElementById('btnAnalyze');
const resultCard   = document.getElementById('resultCard');
const resultBody   = document.getElementById('resultBody');
const errorMsg     = document.getElementById('errorMsg');
const cropModal    = document.getElementById('cropModal');
const cropImage    = document.getElementById('cropImage');
const btnCropConfirm = document.getElementById('btnCropConfirm');
const btnCropCancel  = document.getElementById('btnCropCancel');

/* ─── State ───────────────────────────────────────── */
let selectedFile    = null;
let cropperInstance = null;

/* ─── Upload area interactions ────────────────────── */
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

/* Drag & drop */
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

['dragleave', 'dragend'].forEach(evt =>
  uploadArea.addEventListener(evt, () => uploadArea.classList.remove('drag-over'))
);

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

/* ─── File handler ────────────────────────────────── */
function handleFile(file) {
  hideError();
  hideResult();

  const reader = new FileReader();
  reader.onload = (ev) => {
    // Destroy any previous Cropper instance
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    cropImage.src = ev.target.result;
    cropModal.hidden = false;

    // Init Cropper after the image is laid out
    cropImage.onload = () => {
      cropperInstance = new Cropper(cropImage, {
        viewMode: 1,
        autoCropArea: 1,
        movable: true,
        zoomable: true,
        rotatable: false,
        scalable: false,
        responsive: true,
      });
    };
  };
  reader.readAsDataURL(file);
}

/* ─── Crop confirm ─────────────────────────────────── */
btnCropConfirm.addEventListener('click', () => {
  if (!cropperInstance) return;

  const canvas = cropperInstance.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 });
  canvas.toBlob((blob) => {
    selectedFile = blob;

    previewImg.src = canvas.toDataURL('image/jpeg');
    previewImg.hidden = false;
    plusIcon.style.display = 'none';
    uploadLabel.textContent = 'Zdjęcie przycięte';
    btnAnalyze.disabled = false;

    cropperInstance.destroy();
    cropperInstance = null;
    cropModal.hidden = true;
  }, 'image/jpeg', 0.92);
});

/* ─── Crop cancel ──────────────────────────────────── */
btnCropCancel.addEventListener('click', () => {
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  cropModal.hidden = true;
  fileInput.value = '';
});

/* ─── Analyze button ──────────────────────────────── */
btnAnalyze.addEventListener('click', async () => {
  if (!selectedFile) return;
  hideError();
  hideResult();

  btnAnalyze.classList.add('loading');
  btnAnalyze.textContent = 'Analizowanie';
  btnAnalyze.disabled = true;

  try {
    const base64 = await toResizedBase64(selectedFile);
    const result = await classifyImage(base64);
    displayResult(result);
  } catch (err) {
    showError(err.message || 'Błąd podczas analizy. Spróbuj ponownie.');
  } finally {
    btnAnalyze.classList.remove('loading');
    btnAnalyze.textContent = 'Sprawdź metkę';
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
function displayResult(data) {
  /*
    Actual Roboflow classification response:
    {
      "top": "fake",
      "confidence": 1.0,
      "predictions": [
        { "class": "fake", "class_id": 1, "confidence": 1.0 }
      ]
    }
  */
  const predictedClass = data.top || 'unknown';
  const topConf = data.confidence ?? 0;
  const pct = Math.round(topConf * 100);

  // predictions is an array — sort by confidence descending
  const sorted = (Array.isArray(data.predictions) ? data.predictions : [])
    .map(p => ({ name: p.class, confidence: p.confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  /* Badge type */
  const lcClass = predictedClass.toLowerCase();
  let badgeClass = 'unknown';
  let badgeText  = 'Nieznany';

  if (lcClass.includes('authentic') || lcClass.includes('oryginal') || lcClass.includes('original') || lcClass.includes('prawdziwy')) {
    badgeClass = 'authentic';
    badgeText  = 'Oryginał';
  } else if (lcClass.includes('fake') || lcClass.includes('podróbka') || lcClass.includes('replica') || lcClass.includes('fals')) {
    badgeClass = 'fake';
    badgeText  = 'Podróbka';
  }

  /* Build HTML */
  let html = `
    <div class="result-top">
      <span class="badge ${badgeClass}">${badgeText}</span>
      <span class="result-class">${escHtml(predictedClass)}</span>
    </div>
    <div class="confidence-row">
      <span class="confidence-label">Pewność</span>
      <div class="confidence-bar-wrap">
        <div class="confidence-bar" style="width:${pct}%"></div>
      </div>
      <span class="confidence-pct">${pct}%</span>
    </div>
  `;

  if (sorted.length > 1) {
    html += `<div class="top-predictions">`;
    sorted.slice(0, 5).forEach(({ name, confidence }) => {
      const p = Math.round(confidence * 100);
      html += `
        <div class="pred-row">
          <span class="pred-name">${escHtml(name)}</span>
          <div class="pred-bar-wrap">
            <div class="pred-bar" style="width:${p}%"></div>
          </div>
          <span class="pred-pct">${p}%</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  resultBody.innerHTML = html;
  resultCard.hidden = false;
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
  resultCard.hidden = true;
  resultBody.innerHTML = '';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
