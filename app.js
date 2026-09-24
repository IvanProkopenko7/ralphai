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
const uncertaintyMsg = document.getElementById('uncertaintyMsg');
const tooSmallMsg = document.getElementById('tooSmallMsg');
const errorMsg     = document.getElementById('errorMsg');
const cropperModal  = document.getElementById('cropperModal');
const cropperImg    = document.getElementById('cropperImg');
const btnCropConfirm = document.getElementById('btnCropConfirm');
const btnCropCancel  = document.getElementById('btnCropCancel');

/* ─── i18n ────────────────────────────────────────── */
const isPolish = (navigator.language || '').toLowerCase().startsWith('pl');
const MAX_IMAGES = 1;
// Server-side detection budget: 640px JPEG uploads match full-original
// accuracy (480px missed a real label in testing) at ~10x fewer bytes.
const DETECT_TIMEOUT_MS = 30000;
const DETECT_MAX_SIDE = 640;
const DETECT_UPLOAD_QUALITY = 0.82;
const DETECT_PNG_QUALITY = 0.9;
const DETECT_PNG_MIN_BYTES = 300 * 1024;
const DETECT_SCORE_MIN = 0.5;
const TOO_SMALL_MAX_SIDE = 48;

const i18n = {
  navLabels:       isPolish ? 'METKI'                                : 'LABELS',
  navAbout:        isPolish ? 'O NAS'                                : 'ABOUT',
  navContact:      isPolish ? 'KONTAKT'                              : 'CONTACT',
  subtitle:        isPolish ? 'Dodaj zdjęcie górnej metki'           : 'Add a photo of the neck label',
  collectNote: isPolish
    ? 'Zdjęcia bez wykrytej metki i wyniki o niskiej pewności mogą być anonimowo zapisywane, aby ulepszać model'
    : 'Photos with no detected label and low-confidence results may be anonymously stored to improve the model',
  notePrefix:      isPolish ? '*Na razie obsługiwane są tylko metki' : "*Currently, only",
  noteBold:        isPolish ? ' \u201ePolo by Ralph Lauren\u201d'    : " 'Polo by Ralph Lauren' labels are supported",
  chooseBtn:       isPolish ? 'Wybierz zdjęcie'                      : 'Choose photo',
  dropLine1:       isPolish ? 'lub upuść zdjęcia tutaj'              : 'or drop photos here',
  dropLine2:       isPolish ? 'albo wklej z Ctrl+V'                  : 'or paste with Ctrl+V',
  manualCrop:      isPolish ? 'Przytnij ręcznie'                     : 'Crop manually',
  homeCredibilityHeading: isPolish ? 'RalphAI w liczbach'            : 'RalphAI in numbers',
  homeMetricVisitors: isPolish ? 'Użytkownków'                       : 'Visitors',
  homeMetricPrecision: isPolish ? 'Ogólna precyzja'                  : 'Overall precision',
  homeMetricDatasetPhotos: isPolish ? 'Zdjęć metek w zbiorze danych' : 'Photos of tags in the dataset',
  extraChecksHeading: isPolish
    ? 'Jakie dodatkowe sprawdzenia mogę przeprowadzić?'
    : 'What additional checks can I do?',
  extraChecksIntro: isPolish
    ? 'Niestety nie ma zbyt wielu uniwersalnych sposobów na zweryfikowanie autentyczności ubrań Ralph Lauren. Metki, jeżdźce, metki pielęgnacyjne, jakość szwów i materiały różnią się znacznie w zależności od roku produkcji, kraju pochodzenia i kategorii produktu (metki na swetrach nie wyglądają tak samo jak te na krawatach), więc cechy pozwalające rozpoznać autentyczność są bardzo specyficzne. Są jednak 3 rzeczy, które możesz zrobić, aby zwiększyć swoje szanse:'
    : 'Unfortunately, there are not a lot of universal ways of authenticating Ralph Lauren clothes. The tags, ponies, care labels, stitching quality and materials are very different depending on the year of manufacturing, region and category of piece (tags on sweaters are not like the ones on ties), so the telltale signs are very specific. But there are 3 things that you can do to increase your chances:',
  extraChecksPoint1Title: isPolish
    ? 'Zeskanuj kod QR znajdujący się na górnej metce.'
    : 'Scan the QR code on the neck tag.',
  qrContinue: isPolish ? 'Kontynuuj…' : 'Continue…',
  extraChecksPoint1Body: isPolish
    ? 'Większość ubrań marki Ralph Lauren wyprodukowanych po listopadzie 2019 roku posiada kod QR na metce górnej metce. Zeskanuj go swoim telefonem. Kod QR powinien przekierować Cię na oficjalną stronę Ralph Lauren służącą do weryfikacji autentyczności danego ubrania. Jeśli link przekieruje Cię na stronę „Authentication Check. We need a closer look at your QR code”, najprawdopodobniej jest to podróbka, choć zdarzają się przypadki, gdy strona ta wyświetla się nawet w przypadku oryginalnych ubrań Ralph Lauren. Dzieje się tak w przypadku produktów, które są sample\'ami i/lub zostały wyprodukowane do użytku wewnętrznego merch\'e i prezenty dla pracowników, lub gdy kod QR został zeskanowany zbyt wiele razy. Jeśli kod QR nie skanuje się lub przekierowuje Cię na jakąkolwiek inną stronę, to z pewnością jest to podróbka. Ponadto, jeśli kod QR skanuje się poprawnie i przekierowuje Cię na właściwą stronę, nie oznacza to, że produkt jest na pewno autentyczny. Kody QR można skopiować, więc powinny one stanowić tylko jeden z elementów procesu weryfikacji autentyczności odzieży, a nie pewną odpowiedź. Niemniej jednak kod QR zapewnia ponad 99% skuteczności, więc jeśli to możliwe, zdecydowanie warto go zeskanować.'
    : 'Most Ralph Lauren clothes that were made after November 2019 have a QR code on the neck label. Scan it with your phone. The QR code should send you to the Ralph Lauren\'s official authentication page of the piece of clothing that you are authenticating. If the link sends you to the "Authentication Check. We need a closer look at your QR code" page, then it\'s most likely fake, though there are instances of that page showing even on legitimate Ralph Lauren clothes. It happens with products that are either samples and/or manufactured for internal use - employee merch/gifts or when the QR code is scanned too many times. If the QR code doesn\'t scan or sends you to any other page, then it\'s certainly fake. Also, if the QR code scans correctly and sends you to the right page, it doesn\'t mean that the piece is certainly legit. QR codes can be copied, so it should serve as one of the parts of clothes\' authentication process, not a certain answer. But still, QR code gives you about 99% accuracy, so if you can, you should certainly scan it.',
  extraChecksRealLabel: isPolish ? 'ORYGINAŁ' : 'REAL',
  extraChecksFakeLabel: isPolish ? 'PODRÓBKA' : 'FAKE',
  extraChecksPoint2Title: isPolish
    ? 'Znajdź podobne produkty u sprawdzonych sprzedawców w Internecie.'
    : 'Find similar pieces from trusted sellers online.',
  extraChecksPoint2Body: isPolish
    ? 'Spróbuj znaleźć identyczne ubrania w sieci, korzystając z Google Lens i wykorzystując zdjęcia całego ubrania, haftów, metek itp. Możesz też spróbować wyszukiwać je za pomocą słów kluczowych, na przykład „vintage 80s made in korea ralph lauren jacket”. Następnie porównaj je ze swoim oryginalnym egzemplarzem.'
    : 'Try finding same pieces online using the photos of the overall garment, embroidery, tags and so on via google lens. You can also try searching them with keywords like "vintage 80s made in korea ralph lauren jacket". After that, compare them to your original piece.',
  extraChecksPoint3Title: isPolish
    ? 'Opublikuj swoje zdjęcia na grupach Ralph Lauren.'
    : 'Post your photos on Ralph Lauren LC groups.',
  extraChecksPoint3BodyHtml: isPolish
    ? 'Opublikuj je na grupach Reddit, takich jak <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank" rel="noopener">r/ralphlaurenlegitcheck</a>, <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank" rel="noopener">r/PoloRalphLaurenLC</a> lub <a href="https://www.reddit.com/r/RLbigpony/" target="_blank" rel="noopener">RLbigpony</a>; grupach na Facebooku, takich jak <a href="https://www.facebook.com/groups/1175276173603525/" target="_blank" rel="noopener">Ralph Lauren Legit Check PL</a>, <a href="https://www.facebook.com/groups/1626396554863125/" target="_blank" rel="noopener">Polo Ralph Lauren Talk PL</a> oraz serwerach Discord, takich jak <a href="https://discord.com/invite/fashionreps#:~:text=FashionReps,JavaScript%20to%20run%20this%20app." target="_blank" rel="noopener">Fashion Reps</a> i podobnych. Pamiętaj, że nawet entuzjaści Polo Ralph Lauren popełniają błędy, więc im więcej opinii uzyskasz – tym lepiej.'
    : 'Post on Reddit groups like <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank" rel="noopener">r/ralphlaurenlegitcheck</a>, <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank" rel="noopener">r/PoloRalphLaurenLC</a> or <a href="https://www.reddit.com/r/RLbigpony/" target="_blank" rel="noopener">RLbigpony</a>; Facebook groups like <a href="https://www.facebook.com/groups/1595815894091573" target="_blank" rel="noopener">Polo Ralph Lauren Lifestyle</a> and discord servers like <a href="https://discord.com/invite/fashionreps#:~:text=FashionReps,JavaScript%20to%20run%20this%20app." target="_blank" rel="noopener">Fashion Reps</a> and similar. Be aware that even Polo Ralph Lauren enthusiasts make mistakes, so the more opinions you get - the better.',
  cropCancel:      isPolish ? 'Anuluj'                               : 'Cancel',
  cropConfirm:     isPolish ? 'Przytnij i użyj'                      : 'Crop and use',
  footerCreatedBy: isPolish ? 'Stworzone przez'                      : 'Created by',
  photo:           (n) => isPolish ? `Zdjęcie ${n}`                  : `Photo ${n}`,
  chipUnknown:     isPolish ? 'Nieznany'                             : 'Unknown',
  chipUncertain:   isPolish ? 'Nie pewien'                           : 'Uncertain',
  chipAuthentic:   isPolish ? 'Oryginał'                             : 'Authentic',
  chipFake:        'Fake',
  confidence:      (pct) => isPolish ? `pewność: ${pct}%`            : `confidence: ${pct}%`,
  errorCannotRead: isPolish ? 'Nie można odczytać pliku.'            : 'Cannot read file.',
  errorApi:        (st, d) => isPolish
    ? `Błąd API ${st}: ${d || 'nieznany błąd serwera.'}`
    : `API error ${st}: ${d || 'unknown server error.'}`,
  errorAnalysis:   isPolish ? 'Błąd podczas analizy. Spróbuj ponownie.' : 'Analysis error. Please try again.',
  wakingUp:        isPolish ? 'Model wybudza się po przerwie — potrwa to około minuty. Ponawiam automatycznie…' : 'Model is waking up after idle — this takes about a minute. Retrying automatically…',
  uncertaintyHtml: isPolish 
    ? 'Pewność klasyfikacji jest zbyt niska. Spróbuj przyciąć swoje zdjęcie dokładniej i sprawdź je ponownie. Jeśli wynik nadal jest niepewny, prześlij zdjęcie na <a href="mailto:kontakt@ralphai.tech">adres e-mail strony</a> w celu weryfikacji przez człowieka lub opublikuj je na grupach takich jak <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank">r/PoloRalphLaurenLC</a> lub <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank">r/ralphlaurenlegitcheck</a>.'
    : 'Classification confidence is too low. Please, try re-cropping your photo more closely and checking it again. If the result is still uncertain, then please send the photo to the <a href="mailto:contact@ralphai.tech">website\'s email</a> for a human legit check or post it on groups like <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank">r/PoloRalphLaurenLC</a> or <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank">r/ralphlaurenlegitcheck</a>.',
  tooSmallHtml: isPolish
    ? 'Etykieta na Twoim zdjęciu jest zbyt mała. Spróbuj zrobić zdjęcie bliżej metki i upewnij się, że metka jest wyraźnie widoczna.'
    : 'The label on your photo is too small. Try taking your photo closer to the label and make sure that the label is clearly visible.',
};

function applySharedMetrics() {
  const metrics = window.RALPHAI_METRICS;
  if (!metrics) return;

  document.querySelectorAll('[data-metric-key]').forEach((el) => {
    const key = el.dataset.metricKey;
    if (!key) return;
    const value = metrics[key];
    if (value !== undefined && value !== null) {
      el.textContent = String(value);
    }
  });
}

const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';
const CONFIDENCE_THRESHOLD = 70;

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
  const navContact = document.getElementById('navContactLink');
  if (navContact) navContact.href = `mailto:${EMAIL}`;
  const footerEmail = document.getElementById('footerEmailLink');
  if (footerEmail) { footerEmail.href = `mailto:${EMAIL}`; footerEmail.textContent = EMAIL; }

  const uncertaintyMsgEl = document.getElementById('uncertaintyMsg');
  if (uncertaintyMsgEl) {
    uncertaintyMsgEl.innerHTML = i18n.uncertaintyHtml;
  }
  const tooSmallMsgEl = document.getElementById('tooSmallMsg');
  if (tooSmallMsgEl) {
    tooSmallMsgEl.innerHTML = i18n.tooSmallHtml;
  }

  applySharedMetrics();
}
applyTranslations();

/* ─── QR "Continue" collapse on phones (≤480px) ───────────────────── *
 * Shows only the text up to the split marker + a Continue button;    *
 * tapping restores the full paragraph. Desktop is unaffected.         *
 * ─────────────────────────────────────────────────────────────────── */
(function setupQrContinue() {
  const body = document.getElementById('qrCheckPoint1Body');
  if (!body) return;
  if (!window.matchMedia('(max-width: 480px)').matches) return;
  const marker = isPolish ? 'oryginalnych ubrań Ralph Lauren.' : 'on legitimate Ralph Lauren clothes.';
  const full = body.textContent;
  const cut = full.indexOf(marker);
  if (cut === -1) return;
  const head = full.slice(0, cut + marker.length);
  body.textContent = head + ' ';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'qr-continue-btn';
  btn.textContent = i18n.qrContinue;
  btn.addEventListener('click', () => {
    body.textContent = full;
  });
  body.appendChild(btn);
})();

/* ─── State ───────────────────────────────────────── */
let croppedImages   = [];
let cropQueue       = [];
let cropperInstance = null;
let lastCropConfirmTouchTs = 0;
let previousCropperBodyOverflow = '';
let activeCropSourceCleanup = null;
let activeCropSourceBlob = null;
// Set when a miss is reported so the later manual-crop entry is not saved twice.
let pendingMissSaved = false;
// Entry being manually re-cropped from an uncertain result (modal target).
let recropEntry = null;
// Bounded auto-retries while the Space wakes (reset on each terminal path).
let detectWakeTries = 0;

const ua = navigator.userAgent || '';
const isIOSDevice = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobileSafari = isIOSDevice && /AppleWebKit/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/i.test(ua);
const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
const ENABLE_TOUCH_SOURCE_DOWNSCALE = false;
const TOUCH_CROP_MAX_SOURCE_SIDE = isMobileSafari ? 1850 : 2048;
const TOUCH_CROP_REENCODE_QUALITY = isMobileSafari ? 0.84 : 0.88;

function revokePreviewUrl(imageEntry) {
  if (imageEntry && imageEntry.previewUrl) {
    URL.revokeObjectURL(imageEntry.previewUrl);
  }
}

function cleanupAllPreviewUrls() {
  croppedImages.forEach(revokePreviewUrl);
}

function releaseActiveCropSource() {
  if (typeof activeCropSourceCleanup === 'function') {
    activeCropSourceCleanup();
  }
  activeCropSourceCleanup = null;
}

function runAfterTwoPaints(task) {
  requestAnimationFrame(() => {
    requestAnimationFrame(task);
  });
}

function setCropConfirmProcessing(isProcessing) {
  btnCropConfirm.disabled = isProcessing;
  btnCropConfirm.classList.toggle('is-processing', isProcessing);
}

function buildPreviewCardMarkup(img, index) {
  const thumbClass = img.pending
    ? 'preview-thumb preview-thumb--pending'
    : (['real', 'fake', 'unknown'].indexOf(img.verdict) !== -1
      ? `preview-thumb preview-thumb--${img.verdict}`
      : 'preview-thumb');
  const media = img.pending
    ? ''
    : `<img src="${img.previewUrl}" alt="${i18n.photo(index + 1)}" />`;
  const manualBtn = (!img.pending && img.result)
    ? `<button class="preview-manual-crop" data-index="${index}">${i18n.manualCrop}</button>`
    : '';
  return `
    <div class="preview-card" data-card-index="${index}">
      ${img.chip ? img.chip : ''}
      <div class="${thumbClass}">
        ${media}
        <button class="preview-thumb-remove" data-index="${index}" aria-label="Usuń">&#x2715;</button>
      </div>
      ${manualBtn}
    </div>
  `;
}

function updatePreviewAreaMeta() {
  previewGrid.hidden = false;
  chooseBtn.hidden = true;
  dropText.hidden = true;

  const hasLowConfidence = croppedImages.some(img => img.chip && img.chip.includes('result-chip--unknown'));
  if (uncertaintyMsg) uncertaintyMsg.hidden = !hasLowConfidence;
  const hasTooSmall = croppedImages.some(img => img.tooSmall);
  if (tooSmallMsg) tooSmallMsg.hidden = !hasTooSmall;
}

function finalizeCrop(blob) {
  const previewUrl = URL.createObjectURL(blob);
  const entry = {
    blob,
    previewUrl,
    originalBlob: activeCropSourceBlob,
    savedToBucket: pendingMissSaved,
    reported: false,
    result: null,
    chip: '',
    verdict: '',
    pending: true,
  };
  pendingMissSaved = false;
  croppedImages.push(entry);

  // Grey spinner card now; result card (colored thumb + chip) on settle.
  // Modal advances immediately — completion re-renders from entry state.
  requestAnimationFrame(() => {
    renderGrid();
    if (cropQueue.length) {
      processNextCrop(true);
    } else {
      closeCropper();
    }
    classifyWithWakeRetry(entry)
      .catch(() => showError(i18n.errorAnalysis))
      .finally(() => {
        entry.pending = false;
        renderGrid();
      });
  });
}

function pushSilentEntry(cropBlob, originalBlob) {
  const previewUrl = URL.createObjectURL(cropBlob);
  const entry = {
    blob: cropBlob,
    previewUrl,
    originalBlob,
    savedToBucket: false,
    reported: false,
    result: null,
    chip: '',
    verdict: '',
    pending: true,
  };
  croppedImages.push(entry);
  // Rendered by the caller: grey spinner now, result card on settle.
  return entry;
}

function handleCropConfirm() {
  if (!cropperInstance || btnCropConfirm.disabled) return;

  setCropConfirmProcessing(true);

  // Let pressed/processing visual state paint before heavy canvas work.
  runAfterTwoPaints(() => {
    if (!cropperInstance) {
      setCropConfirmProcessing(false);
      return;
    }

    // Full-resolution region first, then the same 320-square black-pad
    // the classifier was trained on (matches the detection hit path).
    const region = cropperInstance.getCroppedCanvas();
    if (!region) {
      setCropConfirmProcessing(false);
      return;
    }

    const canvas = canvasToSquare320(region);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCropConfirmProcessing(false);
        showError(i18n.errorCannotRead);
        return;
      }

      if (recropEntry) {
        // Manual re-crop of an uncertain result: replace the entry's crop
        // in place (original + bucket flag carry over, no double-save).
        const entry = recropEntry;
        recropEntry = null;
        revokePreviewUrl(entry);
        entry.previewUrl = URL.createObjectURL(blob);
        entry.blob = blob;
        entry.result = null;
        entry.chip = '';
        entry.verdict = '';
        entry.reported = false;
        entry.pending = true;
        closeCropper();
        renderGrid();
        classifyWithWakeRetry(entry)
          .catch(() => showError(i18n.errorAnalysis))
          .finally(() => {
            entry.pending = false;
            renderGrid();
          });
        return;
      }

      finalizeCrop(blob);
    }, 'image/jpeg', SQUARE_JPEG_QUALITY);
  });
}

/* ─── Warmup ping ─────────────────────────────────── */
// Sends an empty body so the frontend proxy wakes up.
// For Hugging Face Spaces, just hitting the Worker should be enough to stay warm or
// we can pass a special flag to wake up the HF space.
(function scheduleWarmup() {
  function ping() {
    fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    'ping',
    }).catch(() => {});
  }
  ping();
  setInterval(ping, 4 * 60 * 1000);
})();

/* ─── Logo → reset to start ───────────────────────── */
document.querySelector('.nav-logo').addEventListener('click', (e) => {
  e.preventDefault();
  cleanupAllPreviewUrls();
  croppedImages = [];
  cropQueue = [];
  recropEntry = null;
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
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const files = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length) {
    e.preventDefault();
    handleFiles(files);
  }
});

/* ─── File handler ────────────────────────────────── */
function handleFiles(files) {
  const imageFiles = files.filter((f) => f && f.type && f.type.startsWith('image/'));
  if (!imageFiles.length) return;
  hideError();

  const remainingSlots = Math.max(0, MAX_IMAGES - (croppedImages.length + cropQueue.length));
  if (remainingSlots === 0) return;

  const filesToQueue = imageFiles.slice(0, remainingSlots);
  filesToQueue.forEach(f => cropQueue.push(f));
  processNextCrop();
}

function processNextCrop(keepModalOpen = false) {
  if (!cropQueue.length) return;
  const file = cropQueue.shift();
  if (!file) return;

  prepareCropSource(file)
    .then(async (source) => {
      releaseActiveCropSource();
      activeCropSourceCleanup = source.cleanup;
      activeCropSourceBlob = source.blob;
      pendingMissSaved = false;

      // Server-side detection on the downscaled upload (mapped back to the
      // original); any failure → miss path, except a waking Space → retry.
      let hitBox = null;
      let tooSmallBox = false;
      let waking = false;
      try {
        const dims = await getImageDims(source.blob);
        const det = await detectServerSide(source.blob);
        const best = det && Array.isArray(det.boxes) ? det.boxes[0] : null;
        if (best && (best.confidence ?? 0) >= DETECT_SCORE_MIN && det.width > 0 && det.height > 0) {
          const sentW = best.x2 - best.x1;
          const sentH = best.y2 - best.y1;
          if (Number.isFinite(sentW) && Number.isFinite(sentH) && Math.max(sentW, sentH) < TOO_SMALL_MAX_SIDE) {
            tooSmallBox = true;
          }
          hitBox = mapBoxToOriginal(best, det.width, det.height, dims.w, dims.h);
        }
      } catch (e) {
        if (isWakingError(e)) waking = true;
        hitBox = null;
      }

      if (waking && !hitBox) {
        // Sleeping Space wakes in the background — re-queue and retry the
        // same file after a delay instead of dropping to manual crop.
        if (detectWakeTries < WAKE_MAX_RETRIES) {
          detectWakeTries += 1;
          cropQueue.unshift(file);
          showError(i18n.wakingUp);
          setTimeout(() => {
            hideError();
            processNextCrop(keepModalOpen);
          }, WAKE_RETRY_MS);
          return;
        }
      }

      // Detect phase for this file is over — reset for the next file.
      detectWakeTries = 0;

      if (tooSmallBox && hitBox) {
        // Label found but too small in the sent image: skip classification
        // entirely and show the "too small" banner (same look as uncertain).
        try {
          const cropBlob = await cropBoxFromOriginal(source.blob, hitBox);
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          const previewUrl = URL.createObjectURL(cropBlob);
          croppedImages.push({
            blob: cropBlob,
            previewUrl,
            originalBlob: source.blob,
            savedToBucket: false,
            reported: false,
            result: null,
            chip: '',
            verdict: '',
            pending: false,
            tooSmall: true,
          });
        } catch (_) {
          // Crop failed: still show the banner with the original as preview.
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          const previewUrl = URL.createObjectURL(source.blob);
          croppedImages.push({
            blob: source.blob,
            previewUrl,
            originalBlob: source.blob,
            savedToBucket: false,
            reported: false,
            result: null,
            chip: '',
            verdict: '',
            pending: false,
            tooSmall: true,
          });
        }
        renderGrid();
        processNextCrop(false);
        return;
      }

      if (hitBox) {
        // Label found: silently crop from the ORIGINAL full-res image and
        // classify — the cropper modal never opens on this path.
        try {
          const cropBlob = await cropBoxFromOriginal(source.blob, hitBox);
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          const entry = pushSilentEntry(cropBlob, source.blob);
          // Grey spinner thumb now; colored thumb + chip on settle.
          renderGrid();
          try {
            await classifyWithWakeRetry(entry);
          } catch (_) {
            showError(i18n.errorAnalysis);
          } finally {
            entry.pending = false;
            renderGrid();
          }
          processNextCrop(false);
          return;
        } catch (_) {
          // Silent-crop failure degrades to the miss path below.
        }
      }

      // Miss path: save the ORIGINAL for retraining, manual crop on original.
      pendingMissSaved = true;
      reportFail('miss', file, { detector: 'server' });
      openCropper(source.src, keepModalOpen);
    })
    .catch(() => {
      showError(i18n.errorCannotRead);
      processNextCrop(keepModalOpen);
    });
}

async function prepareCropSource(file) {
  const optimizedBlob = await maybeDownscaleImageForTouchCrop(file);
  const sourceBlob = optimizedBlob || file;
  const objectUrl = URL.createObjectURL(sourceBlob);

  return {
    src: objectUrl,
    blob: sourceBlob,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

async function maybeDownscaleImageForTouchCrop(file) {
  if (!ENABLE_TOUCH_SOURCE_DOWNSCALE) return null;
  if (!isTouchDevice || !(file instanceof Blob)) return null;
  if (!file.type || !file.type.startsWith('image/')) return null;

  const bitmapFactory = await getImageBitmapFactory(file);
  if (!bitmapFactory) return null;

  const { bitmap, close } = bitmapFactory;
  const maxSide = Math.max(bitmap.width, bitmap.height);
  if (maxSide <= TOUCH_CROP_MAX_SOURCE_SIDE) {
    close();
    return null;
  }

  const scale = TOUCH_CROP_MAX_SOURCE_SIDE / maxSide;
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    close();
    return null;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  close();

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', TOUCH_CROP_REENCODE_QUALITY);
  });

  return blob || null;
}

async function getImageBitmapFactory(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        bitmap,
        close: () => {
          if (typeof bitmap.close === 'function') bitmap.close();
        },
      };
    } catch (_) {
      // Fallback to HTMLImageElement decode below.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = objectUrl;
    });

    return {
      bitmap: img,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (_) {
    URL.revokeObjectURL(objectUrl);
    return null;
  }
}

function preventCropperContextMenu(e) {
  if (!isTouchDevice || cropperModal.hidden) return;
  e.preventDefault();
}

cropperModal.addEventListener('contextmenu', preventCropperContextMenu, { capture: true });
cropperModal.addEventListener('dragstart', (e) => {
  if (!isTouchDevice) return;
  e.preventDefault();
}, { capture: true });

/* ─── Cropper ─────────────────────────────────────── */
function getResponsiveAutoCropArea() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Make the default crop box smaller on compact screens for easier framing.
  if (vw <= 480) return 0.77;
  if (vw <= 768) return 0.79;
  if (vw <= 1366 || vh <= 820) return 0.82;
  return 0.9;
}

function openCropper(src, keepModalOpen = false) {
  if (!keepModalOpen || cropperModal.hidden) {
    previousCropperBodyOverflow = document.body.style.overflow;
    cropperModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  let hasInitialized = false;
  let initAttempts = 0;
  const initCropper = () => {
    if (hasInitialized) return;

    const modalRect = cropperModal.getBoundingClientRect();
    const imgWrap = cropperImg.parentElement;
    const wrapRect = imgWrap ? imgWrap.getBoundingClientRect() : { width: 0, height: 0 };
    const layoutReady = modalRect.width > 1 && modalRect.height > 1 && wrapRect.width > 1 && wrapRect.height > 1;

    if (!layoutReady && initAttempts < 12) {
      initAttempts += 1;
      requestAnimationFrame(initCropper);
      return;
    }

    hasInitialized = true;
    cropperImg.onload = null;

    if (cropperInstance) cropperInstance.destroy();
    const cropperOptions = {
      viewMode:     1,
      dragMode:     isTouchDevice ? 'none' : 'crop',
      movable:      !isTouchDevice,
      zoomable:     true,
      zoomOnTouch:  true,
      scalable:     false,
      rotatable:    false,
      toggleDragModeOnDblclick: false,
    };
    // Manual crop only (server found no label) — default framing.
    cropperOptions.autoCropArea = getResponsiveAutoCropArea();
    cropperInstance = new Cropper(cropperImg, cropperOptions);
    setCropConfirmProcessing(false);
  };

  cropperImg.onload = () => runAfterTwoPaints(initCropper);
  cropperImg.src = src;

  // Object URLs can decode immediately on some browsers.
  if (cropperImg.complete && cropperImg.naturalWidth > 0) {
    runAfterTwoPaints(initCropper);
  }
}

function closeCropper() {
  cropperModal.hidden = true;
  document.body.style.overflow = previousCropperBodyOverflow || '';
  previousCropperBodyOverflow = '';
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  releaseActiveCropSource();
  activeCropSourceBlob = null;
  btnCropConfirm.disabled = false;
  btnCropConfirm.classList.remove('is-processing');
  cropperImg.src = '';
  // Reset file input so the same file can be re-selected
  fileInput.value = '';
}

btnCropConfirm.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

  lastCropConfirmTouchTs = performance.now();
  e.preventDefault();
  handleCropConfirm();
});

btnCropConfirm.addEventListener('click', () => {
  // Ignore synthetic click right after a touch/pen pointerup.
  if (performance.now() - lastCropConfirmTouchTs < 700) return;
  handleCropConfirm();
});

btnCropCancel.addEventListener('click', () => {
  cropQueue = [];
  recropEntry = null;
  closeCropper();
});

/* ─── Preview grid ───────────────────────────────── */
function renderGrid() {
  if (croppedImages.length === 0) {
    previewGrid.hidden = true;
    previewGrid.innerHTML = '';
    chooseBtn.hidden = false;
    dropText.hidden = false;
    if (uncertaintyMsg) uncertaintyMsg.hidden = true;
    if (tooSmallMsg) tooSmallMsg.hidden = true;
    return;
  }

  updatePreviewAreaMeta();

  const canAddMore = croppedImages.length + cropQueue.length < MAX_IMAGES;
  previewGrid.innerHTML = croppedImages.map((img, i) => buildPreviewCardMarkup(img, i)).join('')
    + (canAddMore ? `<button class="preview-thumb preview-thumb-add" id="addMoreBtn">+</button>` : '');
}

previewGrid.addEventListener('click', (e) => {
  const removeButton = e.target.closest('.preview-thumb-remove');
  if (removeButton) {
    const idx = parseInt(removeButton.dataset.index, 10);
    if (!Number.isNaN(idx)) {
      const removed = croppedImages.splice(idx, 1)[0];
      revokePreviewUrl(removed);
      renderGrid();
    }
    return;
  }

  if (e.target.closest('#addMoreBtn')) {
    fileInput.click();
  }

  const manualButton = e.target.closest('.preview-manual-crop');
  if (manualButton) {
    const idx = parseInt(manualButton.dataset.index, 10);
    const entry = croppedImages[idx];
    if (entry && entry.originalBlob && !entry.pending) {
      recropEntry = entry;
      releaseActiveCropSource();
      const url = URL.createObjectURL(entry.originalBlob);
      activeCropSourceCleanup = () => URL.revokeObjectURL(url);
      openCropper(url, false);
    }
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
    const err = new Error(i18n.errorApi(response.status, detail));
    if (isWakingResponse(response.status, detail)) err.code = 'space_waking';
    throw err;
  }

  return response.json();
}

/* ─── Space waking (free-tier sleep recovery) ─────────────────────── *
 * The Worker answers 503 {error:'space_waking'} while it wakes the    *
 * sleeping HF Space in the background (~30–90s). Callers show a notice *
 * and retry the same request after WAKE_RETRY_MS, bounded by           *
 * WAKE_MAX_RETRIES — then degrade to the usual miss/error paths.       *
 * ──────────────────────────────────────────────────────────────────── */
const WAKE_RETRY_MS = 45000;
const WAKE_MAX_RETRIES = 2;

function isWakingResponse(status, detail) {
  if (status === 503) return true;
  try {
    return !!detail && JSON.parse(detail).error === 'space_waking';
  } catch (_) {
    return false;
  }
}

function isWakingError(e) {
  return !!e && e.code === 'space_waking';
}

function markWakingError(e) {
  const err = e instanceof Error ? e : new Error('space_waking');
  err.code = 'space_waking';
  return err;
}

async function classifyWithWakeRetry(entry) {
  entry._wakeTries = entry._wakeTries || 0;
  for (;;) {
    try {
      return await classifyEntry(entry);
    } catch (e) {
      if (isWakingError(e) && entry._wakeTries < WAKE_MAX_RETRIES) {
        entry._wakeTries += 1;
        showError(i18n.wakingUp);
        await new Promise((r) => setTimeout(r, WAKE_RETRY_MS));
        hideError();
        continue;
      }
      throw e;
    }
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(i18n.errorCannotRead));
        return;
      }

      const parts = result.split(',');
      if (parts.length < 2) {
        reject(new Error(i18n.errorCannotRead));
        return;
      }
      resolve(`data:${blob.type};base64,${parts[1]}`);
    };
    reader.onerror = () => reject(new Error(i18n.errorCannotRead));
    reader.readAsDataURL(blob);
  });
}

/* ─── Server-side detection (640px upload → boxes) ─────────────── *
 * Detection runs entirely on the HF Space via the Worker (it letter-  *
 * boxes to 480 internally, same as training). The upload is downscaled *
 * to 640px JPEG first: 480px missed a real label, full originals waste *
 * ~10x bytes (e.g. pasted PNGs) with no accuracy gain. Any failure      *
 * (timeout after DETECT_TIMEOUT_MS, error, no box ≥ 0.5) returns null   *
 * and the caller falls back to manual crop — never throws outward.     *
 * ──────────────────────────────────────────────────────────────────── */
async function makeDetectDownscale(blob) {
  try {
    const img = await decodeImage(blob);
    const longSide = Math.max(img.naturalWidth, img.naturalHeight);
    const isBigPng = blob.type === 'image/png' && blob.size > DETECT_PNG_MIN_BYTES;
    if (longSide <= DETECT_MAX_SIDE && !isBigPng) return blob;
    const scale = Math.min(1, DETECT_MAX_SIDE / longSide);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', scale < 1 ? DETECT_UPLOAD_QUALITY : DETECT_PNG_QUALITY));
    return out || blob;
  } catch (_) {
    return blob;
  }
}

function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(i18n.errorCannotRead));
    };
    img.src = url;
  });
}

async function getImageDims(blob) {
  const img = await decodeImage(blob);
  const dims = { w: img.naturalWidth, h: img.naturalHeight };
  return dims;
}

async function detectServerSide(originalBlob) {
  const body = await blobToBase64(await makeDetectDownscale(originalBlob));
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    init.signal = AbortSignal.timeout(DETECT_TIMEOUT_MS);
  }
  const response = await fetch(`${API_URL}/detect`, init);
  if (!response.ok) {
    // Sleeping Space: Worker wakes it in the background — throw a coded
    // error so the caller can notice + retry instead of manual-cropping.
    if (response.status === 503) {
      let detail = '';
      try { detail = await response.text(); } catch (_) {}
      if (isWakingResponse(response.status, detail)) throw markWakingError();
    }
    return null;
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.boxes)) return null;
  return data;
}

function mapBoxToOriginal(box, sentW, sentH, origW, origH) {
  const sx = origW / sentW;
  const sy = origH / sentH;
  const x = Math.max(0, box.x1 * sx);
  const y = Math.max(0, box.y1 * sy);
  const w = Math.min(origW - x, Math.max(1, (box.x2 - box.x1) * sx));
  const h = Math.min(origH - y, Math.max(1, (box.y2 - box.y1) * sy));
  return { x, y, width: w, height: h };
}

/* ─── label-to-square (mirrors detection/label-to-square.py) ───────── *
 * Fit inside a 320x320 canvas, centered, remaining area padded black.  *
 * Matches training preprocessing (fit long side, integer centering,    *
 * JPEG default quality) so inference sees the same distribution the    *
 * classifier was trained on. Used by BOTH the detected-box path and    *
 * the manual-crop path. Canvas is always exactly 320².                 *
 * ──────────────────────────────────────────────────────────────────── */
const SQUARE_SIZE = 320;
const SQUARE_JPEG_QUALITY = 0.75;

function canvasToSquare320(src) {
  const ratio = src.width / src.height;
  let dw;
  let dh;
  if (src.width >= src.height) {
    dw = SQUARE_SIZE;
    dh = Math.max(1, Math.round(SQUARE_SIZE / ratio));
  } else {
    dh = SQUARE_SIZE;
    dw = Math.max(1, Math.round(SQUARE_SIZE * ratio));
  }
  const canvas = document.createElement('canvas');
  canvas.width = SQUARE_SIZE;
  canvas.height = SQUARE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SQUARE_SIZE, SQUARE_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, src.width, src.height,
    Math.floor((SQUARE_SIZE - dw) / 2), Math.floor((SQUARE_SIZE - dh) / 2), dw, dh);
  return canvas;
}

async function canvasToSquare320Blob(src) {
  const out = await new Promise((resolve) =>
    canvasToSquare320(src).toBlob(resolve, 'image/jpeg', SQUARE_JPEG_QUALITY));
  if (!out) throw new Error(i18n.errorCannotRead);
  return out;
}

async function cropBoxFromOriginal(blob, box) {
  const img = await decodeImage(blob);
  try {
    const sx = Math.max(0, Math.min(box.x, img.naturalWidth - 1));
    const sy = Math.max(0, Math.min(box.y, img.naturalHeight - 1));
    const sw = Math.max(1, Math.min(box.width, img.naturalWidth - sx));
    const sh = Math.max(1, Math.min(box.height, img.naturalHeight - sy));
    const region = document.createElement('canvas');
    region.width = sw;
    region.height = sh;
    region.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return await canvasToSquare320Blob(region);
  } finally {
    if (img.close) img.close();
  }
}

/* ─── Auto-classify (one entry) ─────────────────────────────────── */
async function classifyEntry(entry) {
  if (!entry || entry.result) return entry ? entry.result : null;
  const data = await classifyImage(await blobToBase64(entry.blob));
  entry.result = data;
  applyResultToEntry(entry, data);
  return data;
}

function verdictOf(data) {
  const predictedClass = (data.top || 'unknown').toLowerCase();
  const pct = Math.round((data.confidence ?? 0) * 100);
  if (pct < CONFIDENCE_THRESHOLD) return 'unknown';
  if (predictedClass === 'real' || predictedClass === 'fake') return predictedClass;
  return 'unknown';
}

function applyResultToEntry(entry, data) {
  entry.chip = buildResultChip(data);
  entry.verdict = verdictOf(data);
  entry.pending = false;
  if (!entry.reported && (data.confidence ?? 0) < CONFIDENCE_THRESHOLD / 100) {
    entry.reported = true;
    // Low-confidence label — save the ORIGINAL once (miss path may have already sent it).
    if (!entry.savedToBucket) {
      entry.savedToBucket = true;
      reportFail('lowconf', entry.originalBlob || entry.blob, {
        top: data.top || 'unknown',
        confidence: data.confidence ?? 0,
      });
    }
  }
  renderGrid();
}

/* ─── Fail harvest (miss / low-confidence ORIGINALS → R2) ───────── *
 * Fire-and-forget: never blocks UI, never shows errors. The Worker    *
 * enforces a hard 500/day cap and size caps, so this is safe to call   *
 * for every miss / low-confidence case (free-tier safe).               *
 * ──────────────────────────────────────────────────────────────────── */
const COLLECT_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function blobToOriginalDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob || COLLECT_ALLOWED_MIME.indexOf(blob.type) === -1) {
      reject(new Error('unsupported type'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') reject(new Error(i18n.errorCannotRead));
      else resolve(reader.result);
    };
    reader.onerror = () => reject(new Error(i18n.errorCannotRead));
    reader.readAsDataURL(blob);
  });
}
function reportFail(kind, blob, meta) {
  if (!blob) return;
  // Misses and low-confidence cases send the ORIGINAL image bytes as-is.
  blobToOriginalDataUrl(blob)
    .then((dataUrl) => fetch(`${API_URL}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, image: dataUrl, meta: meta || {} }),
    }))
    .catch(() => {});
}

/* ─── Display results ─────────────────────────────── */

function buildResultChip(data) {
  // Worker returns only 'fake' | 'real' | 'unknown' — never fine-grained classes.
  const predictedClass = (data.top || 'unknown').toLowerCase();
  const pct = Math.round((data.confidence ?? 0) * 100);
  const isLowConfidence = pct < CONFIDENCE_THRESHOLD;

  let chipClass  = 'result-chip--unknown';
  let labelText  = i18n.chipUnknown;

  if (predictedClass === 'real') {
    chipClass = 'result-chip--authentic';
    labelText = i18n.chipAuthentic;
  } else if (predictedClass === 'fake') {
    chipClass = 'result-chip--fake';
    labelText = i18n.chipFake;
  }

  if (isLowConfidence) {
    chipClass = 'result-chip--unknown';
    labelText = i18n.chipUncertain;
  }

  return `<div class="result-chip ${chipClass}"><span class="result-chip-verdict">${labelText}</span></div>`;
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
