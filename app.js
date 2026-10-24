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
const notDetectedMsg = document.getElementById('notDetectedMsg');
const errorMsg     = document.getElementById('errorMsg');
const cropperModal  = document.getElementById('cropperModal');
const cropperImg    = document.getElementById('cropperImg');
const btnCropConfirm = document.getElementById('btnCropConfirm');
const btnCropCancel  = document.getElementById('btnCropCancel');

/* ─── Image processing settings ────────────────────────────────────────── */

const MAX_IMAGES = 1;
// Server-side detection budget: 640px JPEG uploads match full-original
// accuracy (480px missed a real label in testing) at ~10x fewer bytes.
const DETECT_TIMEOUT_MS = 30000;
const DETECT_MAX_SIDE = 640;
const DETECT_UPLOAD_QUALITY = 0.85;
const DETECT_PNG_QUALITY = 0.9;
const DETECT_RETRY_WEBP_QUALITY = 0.85;
const DETECT_PNG_MIN_BYTES = 300 * 1024;
const DETECT_SCORE_MIN = 0.5;
const TOO_SMALL_MAX_SIDE = 48;

const messages = {
  manualCrop:      'Crop manually',
  qrContinue: 'Continue…',
  removePhoto: 'Remove photo',
  addPhoto: 'Add photo',
  photo:           (n) => `Photo ${n}`,
  chipUnknown:     'Unknown',
  chipUncertain:   'Uncertain',
  chipNotDetected: 'Not detected',
  chipTooSmall:    'Too small',
  chipAuthentic:   'Authentic',
  chipFake:        'Fake',
  errorCannotRead: 'Cannot read file.',
  errorApi:        (st, d) => `API error ${st}: ${d || 'unknown server error.'}`,
  errorAnalysis:   'Analysis error. Please try again.',
  wakingUp:        'Model is waking up after idle – this takes about a minute. Retrying automatically…',
  statusSending:   'Sending photo to the server…',
  statusAuthenticating: 'Authenticating…',
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

const CONFIDENCE_THRESHOLD = 70;

applySharedMetrics();

/* ─── QR "Continue" collapse on phones (≤480px) ───────────────────── *
 * Shows only the text up to the split marker + a Continue button;    *
 * tapping restores the full paragraph. Desktop is unaffected.         *
 * ─────────────────────────────────────────────────────────────────── */
(function setupQrContinue() {
  const body = document.getElementById('qrCheckPoint1Body');
  if (!body) return;
  if (!window.matchMedia('(max-width: 480px)').matches) return;
  const marker = 'on legitimate Ralph Lauren clothes.';
  const full = body.textContent;
  const cut = full.indexOf(marker);
  if (cut === -1) return;
  const head = full.slice(0, cut + marker.length);
  body.textContent = head + ' ';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'extra-checks__continue';
  btn.textContent = messages.qrContinue;
  btn.addEventListener('click', () => {
    body.textContent = full;
    body.tabIndex = -1;
    body.focus();
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
  btnCropConfirm.classList.toggle('crop-dialog__confirm--processing', isProcessing);
}

function buildPreviewCardMarkup(img, index) {
  const thumbClass = img.pending
    ? 'preview-card__thumbnail preview-card__thumbnail--pending'
    : img.notDetected
      ? 'preview-card__thumbnail preview-card__thumbnail--not-detected'
      : (['real', 'fake', 'unknown', 'too-small'].indexOf(img.verdict) !== -1
      ? `preview-card__thumbnail preview-card__thumbnail--${img.verdict}`
      : 'preview-card__thumbnail');
  const media = img.pending
    ? `<div class="preview-card__status">${img.status === 'authenticating' ? messages.statusAuthenticating : messages.statusSending}</div>`
    : `<img src="${img.previewUrl}" alt="${messages.photo(index + 1)}" />`;
  const manualBtn = (!img.pending && (img.result || img.tooSmall || img.notDetected))
    ? `<button class="preview-card__crop" data-index="${index}">${messages.manualCrop}</button>`
    : '';
  return `
    <div class="preview-card" data-card-index="${index}">
      ${img.chip ? img.chip : ''}
      <div class="${thumbClass}">
        ${media}
        <button class="preview-card__remove" data-index="${index}" aria-label="${messages.removePhoto}">&#x2715;</button>
      </div>
      ${manualBtn}
    </div>
  `;
}

function updatePreviewAreaMeta() {
  previewGrid.hidden = false;
  chooseBtn.hidden = true;
  dropText.hidden = true;

  const hasLowConfidence = croppedImages.some(img => !img.notDetected && img.chip && img.chip.includes('result-chip--unknown'));
  if (uncertaintyMsg) uncertaintyMsg.hidden = !hasLowConfidence;
  if (notDetectedMsg) notDetectedMsg.hidden = !croppedImages.some(img => img.notDetected);
  const hasTooSmall = croppedImages.some(img => img.tooSmall);
  if (tooSmallMsg) tooSmallMsg.hidden = !hasTooSmall;
}

function finalizeCrop(blob, tooSmall = false) {
  if (tooSmall) {
    // Manual crop too small for reliable classification: yellow chip +
    // banner, no inference call.
    pushTooSmallEntry(blob, activeCropSourceBlob);
    requestAnimationFrame(() => {
      renderGrid();
      if (cropQueue.length) {
        processNextCrop(true);
      } else {
        closeCropper();
      }
    });
    return;
  }
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
    status: 'sending',
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
      .catch(() => showError(messages.errorAnalysis))
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
    status: 'sending',
  };
  croppedImages.push(entry);
  // Rendered by the caller: grey spinner now, result card on settle.
  return entry;
}

function buildTooSmallChip() {
  return `<div class="result-chip result-chip--too-small"><span class="result-chip__verdict">${messages.chipTooSmall}</span></div>`;
}

function pushTooSmallEntry(cropBlob, originalBlob) {
  const previewUrl = URL.createObjectURL(cropBlob);
  const entry = {
    blob: cropBlob,
    previewUrl,
    originalBlob,
    savedToBucket: pendingMissSaved,
    reported: false,
    result: null,
    chip: buildTooSmallChip(),
    verdict: 'too-small',
    pending: false,
    tooSmall: true,
  };
  pendingMissSaved = false;
  croppedImages.push(entry);
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

    // Manual-crop counterpart of the sent-image 48px rule: a tiny crop
    // cannot classify reliably, so it becomes "too small" (no inference).
    const manualTooSmall = isCropRegionTooSmall(region);

    const canvas = canvasToSquare320(region);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCropConfirmProcessing(false);
        showError(messages.errorCannotRead);
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
        entry.tooSmall = false;
        entry.notDetected = false;
        if (manualTooSmall) {
          entry.chip = buildTooSmallChip();
          entry.verdict = 'too-small';
          entry.pending = false;
          entry.tooSmall = true;
          closeCropper();
          renderGrid();
          return;
        }
        entry.pending = true;
        entry.status = 'sending';
        closeCropper();
        renderGrid();
        classifyWithWakeRetry(entry)
          .catch(() => showError(messages.errorAnalysis))
          .finally(() => {
            entry.pending = false;
            renderGrid();
          });
        return;
      }

      finalizeCrop(blob, manualTooSmall);
    }, 'image/jpeg', SQUARE_JPEG_QUALITY);
  });
}

/* ─── Logo → reset to start ───────────────────────── */
document.querySelector('.navbar__logo').addEventListener('click', (e) => {
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
  dropZone.classList.add('main-content--drag-over');
});

dropZone.addEventListener('dragover', (e) => e.preventDefault());

['dragleave', 'dragend'].forEach(evt =>
  dropZone.addEventListener(evt, () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; dropZone.classList.remove('main-content--drag-over'); }
  })
);

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropZone.classList.remove('main-content--drag-over');
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

  // Immediate grey spinner placeholder — render BEFORE any async work
  // (decode, downscale, or server detection) so the user sees feedback
  // the same frame the image is submitted.
  let placeholder = croppedImages.find((e) => e.placeholder && e.pending);
  if (!placeholder) {
    placeholder = {
      blob: null,
      previewUrl: '',
      originalBlob: null,
      savedToBucket: false,
      reported: false,
      result: null,
      chip: '',
      verdict: '',
      pending: true,
      placeholder: true,
      status: 'sending',
    };
    croppedImages.push(placeholder);
  }
  placeholder.status = 'sending';
  renderGrid();

  prepareCropSource(file)
    .then(async (source) => {
      // User removed the spinner while detection was in flight → abort.
      if (croppedImages.indexOf(placeholder) === -1) {
        try { source.cleanup(); } catch (_) {}
        processNextCrop(keepModalOpen);
        return;
      }
      releaseActiveCropSource();
      activeCropSourceCleanup = source.cleanup;
      activeCropSourceBlob = source.blob;
      pendingMissSaved = false;

      // Server-side detection on the downscaled upload (mapped back to the
      // original). Service failures are errors; only valid results can be misses.
      let hitBox = null;
      let tooSmallBox = false;
      let waking = false;
      let detectionFailed = false;
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
        detectionFailed = true;
        hitBox = null;
      }

      if (waking && !hitBox) {
        // Sleeping Space wakes in the background — keep the spinner
        // visible and retry the same file after a delay instead of
        // dropping to manual crop. Placeholder is reused by the retry.
        if (detectWakeTries < WAKE_MAX_RETRIES) {
          detectWakeTries += 1;
          cropQueue.unshift(file);
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          showError(messages.wakingUp);
          setTimeout(() => {
            hideError();
            processNextCrop(keepModalOpen);
          }, WAKE_RETRY_MS);
          return;
        }
      }

      // Detect phase for this file is over — reset for the next file.
      detectWakeTries = 0;

      if (croppedImages.indexOf(placeholder) === -1) {
        releaseActiveCropSource();
        activeCropSourceBlob = null;
        processNextCrop(false);
        return;
      }

      if (detectionFailed) {
        finishDetectionError(placeholder);
        return;
      }

      if (tooSmallBox && hitBox) {
        // Label found but too small in the sent image: skip classification
        // entirely and show the "too small" chip + banner (same look as uncertain).
        try {
          const cropBlob = await cropBoxFromOriginal(source.blob, hitBox);
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          fillPlaceholderAsTooSmall(placeholder, cropBlob, source.blob);
        } catch (_) {
          // Crop failed: still show the chip + banner with the original as preview.
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          fillPlaceholderAsTooSmall(placeholder, source.blob, source.blob);
        }
        renderGrid();
        processNextCrop(false);
        return;
      }

      if (hitBox) {
        // Label found: silently crop from the ORIGINAL full-res image and
        // classify — the cropper modal never opens on this path.
        // Reuse the immediate spinner placeholder (no second card).
        // Photo arrived at the server → flip from "sending" to "authenticating".
        try {
          const cropBlob = await cropBoxFromOriginal(source.blob, hitBox);
          releaseActiveCropSource();
          activeCropSourceBlob = null;
          if (croppedImages.indexOf(placeholder) === -1) {
            processNextCrop(false);
            return;
          }
          fillPlaceholderWithCrop(placeholder, cropBlob, source.blob);
          // Grey spinner thumb already visible; colored thumb + chip on settle.
          renderGrid();
          try {
            await classifyWithWakeRetry(placeholder);
          } catch (_) {
            showError(messages.errorAnalysis);
          } finally {
            placeholder.pending = false;
            placeholder.placeholder = false;
            renderGrid();
          }
          processNextCrop(false);
          return;
        } catch (_) {
          // A crop failure is a processing error, not a detection miss.
          finishDetectionError(placeholder);
          return;
        }
      }

      // Keep the original for retraining and let the user choose manual cropping.
      reportFail('miss', file, { detector: 'server' });
      fillPlaceholderWithCrop(placeholder, source.blob, source.blob);
      placeholder.savedToBucket = true;
      placeholder.pending = false;
      placeholder.notDetected = true;
      placeholder.verdict = 'unknown';
      placeholder.chip = `<div class="result-chip result-chip--unknown"><span class="result-chip__verdict">${messages.chipNotDetected}</span></div>`;
      releaseActiveCropSource();
      activeCropSourceBlob = null;
      renderGrid();
      processNextCrop(false);
    })
    .catch(() => {
      removePlaceholder(placeholder);
      showError(messages.errorCannotRead);
      processNextCrop(keepModalOpen);
    });
}

function finishDetectionError(placeholder) {
  releaseActiveCropSource();
  activeCropSourceBlob = null;
  removePlaceholder(placeholder);
  fileInput.value = '';
  showError(messages.errorAnalysis);
  processNextCrop(false);
}

function removePlaceholder(placeholder) {
  const idx = croppedImages.indexOf(placeholder);
  if (idx !== -1) croppedImages.splice(idx, 1);
  renderGrid();
}

function fillPlaceholderWithCrop(placeholder, cropBlob, originalBlob) {
  placeholder.blob = cropBlob;
  placeholder.previewUrl = URL.createObjectURL(cropBlob);
  placeholder.originalBlob = originalBlob;
  placeholder.savedToBucket = false;
  placeholder.reported = false;
  placeholder.result = null;
  placeholder.chip = '';
  placeholder.verdict = '';
  placeholder.pending = true;
  placeholder.placeholder = false;
  placeholder.status = 'authenticating';
}

function fillPlaceholderAsTooSmall(placeholder, cropBlob, originalBlob) {
  placeholder.blob = cropBlob;
  placeholder.previewUrl = URL.createObjectURL(cropBlob);
  placeholder.originalBlob = originalBlob;
  placeholder.savedToBucket = pendingMissSaved;
  pendingMissSaved = false;
  placeholder.reported = false;
  placeholder.result = null;
  placeholder.chip = buildTooSmallChip();
  placeholder.verdict = 'too-small';
  placeholder.pending = false;
  placeholder.placeholder = false;
  placeholder.tooSmall = true;
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
  if (!cropperModal.open) {
    previousCropperBodyOverflow = document.body.style.overflow;
    cropperModal.hidden = false;
    cropperModal.showModal();
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
  cropperModal.close();
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
  btnCropConfirm.classList.remove('crop-dialog__confirm--processing');
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

function cancelCropper() {
  cropQueue = [];
  recropEntry = null;
  closeCropper();
}

btnCropCancel.addEventListener('click', cancelCropper);
cropperModal.addEventListener('cancel', (event) => {
  event.preventDefault();
  cancelCropper();
});

/* ─── Preview grid ───────────────────────────────── */
function renderGrid() {
  const focused = document.activeElement;
  const focusClass = focused?.matches('.preview-card__remove, .preview-card__crop')
    ? (focused.classList.contains('preview-card__remove') ? 'preview-card__remove' : 'preview-card__crop') : null;
  const focusIndex = focused?.dataset.index;
  if (croppedImages.length === 0) {
    previewGrid.hidden = true;
    previewGrid.innerHTML = '';
    chooseBtn.hidden = false;
    dropText.hidden = false;
    if (uncertaintyMsg) uncertaintyMsg.hidden = true;
    if (tooSmallMsg) tooSmallMsg.hidden = true;
    if (notDetectedMsg) notDetectedMsg.hidden = true;
    if (focusClass) chooseBtn.focus();
    return;
  }

  updatePreviewAreaMeta();

  const canAddMore = croppedImages.length + cropQueue.length < MAX_IMAGES;
  previewGrid.innerHTML = croppedImages.map((img, i) => buildPreviewCardMarkup(img, i)).join('')
    + (canAddMore ? `<button class="preview-card__thumbnail preview-grid__add" id="addMoreBtn" aria-label="${messages.addPhoto}">+</button>` : '');
  if (focusClass) previewGrid.querySelector(`.${focusClass}[data-index="${focusIndex}"]`)?.focus();
}

previewGrid.addEventListener('click', (e) => {
  const removeButton = e.target.closest('.preview-card__remove');
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

  const manualButton = e.target.closest('.preview-card__crop');
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
    const err = new Error(messages.errorApi(response.status, detail));
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
        showError(messages.wakingUp);
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
        reject(new Error(messages.errorCannotRead));
        return;
      }

      const parts = result.split(',');
      if (parts.length < 2) {
        reject(new Error(messages.errorCannotRead));
        return;
      }
      resolve(`data:${blob.type};base64,${parts[1]}`);
    };
    reader.onerror = () => reject(new Error(messages.errorCannotRead));
    reader.readAsDataURL(blob);
  });
}

/* ─── Server-side detection (640px upload → boxes) ─────────────── *
 * Detection runs entirely on the HF Space via the Worker (it letter-  *
 * boxes to 480 internally, same as training). The upload is downscaled *
 * to 640px JPEG first: 480px missed a real label, full originals waste *
 * ~10x bytes (e.g. pasted PNGs) with no accuracy gain. JPEG artifacts  *
 * alone can erase a detection, so a clean miss retries sharper: WebP   *
 * q0.85 next (PNG-level accuracy at ~8x fewer bytes), pixel-exact PNG  *
 * last. First non-empty boxes win; hits stay cheap, only real misses   *
 * pay extra uploads. Service failures throw; valid results without a *
 * box ≥ 0.5 show Not detected and offer manual cropping.              *
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

/* Sharper retries for the JPEG-miss case, sharpest last: the same
 * 640px canvas as WebP q0.85, then pixel-exact PNG. Each is only tried
 * when every previous attempt came back clean-empty (never on timeout
 * or HTTP errors), so the common hit path costs nothing extra. */
async function makeDetectRetryCanvas(blob) {
  const img = await decodeImage(blob);
  const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function makeDetectWebpBlob(blob) {
  const canvas = await makeDetectRetryCanvas(blob);
  // toBlob resolves null (never rejects) for unsupported types/modes.
  return new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/webp', DETECT_RETRY_WEBP_QUALITY));
}

async function makeDetectPngBlob(blob) {
  const canvas = await makeDetectRetryCanvas(blob);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error(messages.errorCannotRead))),
      'image/png',
    );
  });
}

function decodeImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(messages.errorCannotRead));
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
  const postDetect = async (blob) => {
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: await blobToBase64(blob),
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
      throw new Error(messages.errorAnalysis);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.boxes) || !(data.width > 0) || !(data.height > 0)) {
      throw new Error(messages.errorAnalysis);
    }
    return data;
  };

  const first = await postDetect(await makeDetectDownscale(originalBlob));
  // Continue sharper only on a clean empty result (HTTP 200, no boxes).
  // Transport failures throw so they cannot be reported as detector misses.
  if (first.boxes.length > 0) return first;
  // JPEG artifacts can erase a detection a sharper encoding still sees —
  // retry WebP, then pixel-exact PNG, before showing Not detected.
  // A null WebP (browser can't encode it, e.g. old Safari) skips straight
  // to PNG. Request errors, including a waking Space, propagate to the caller.
  const retries = [makeDetectWebpBlob, makeDetectPngBlob];
  for (const makeRetryBlob of retries) {
    let retryBlob = null;
    try {
      retryBlob = await makeRetryBlob(originalBlob);
    } catch (_) {}
    if (!retryBlob) continue;
    const retry = await postDetect(retryBlob);
    if (retry.boxes.length > 0) return retry;
  }
  return first;
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

// Manual-crop counterpart of the sent-image 48px rule: the cropper region
// is in source-image px, so scale it to sent-image px the same way
// makeDetectDownscale does before comparing against TOO_SMALL_MAX_SIDE.
function isCropRegionTooSmall(region) {
  const srcW = (cropperImg && cropperImg.naturalWidth) || region.width;
  const srcH = (cropperImg && cropperImg.naturalHeight) || region.height;
  const sentScale = Math.min(1, DETECT_MAX_SIDE / Math.max(srcW, srcH));
  return Math.max(region.width, region.height) * sentScale < TOO_SMALL_MAX_SIDE;
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
  if (!out) throw new Error(messages.errorCannotRead);
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
  if (entry.status !== 'authenticating') {
    entry.status = 'sending';
    renderGrid();
  }
  const body = await blobToBase64(entry.blob);
  const request = classifyImage(body);
  // Upload dispatched, photo on the server → flip to "authenticating".
  entry.status = 'authenticating';
  renderGrid();
  const data = await request;
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
      if (typeof reader.result !== 'string') reject(new Error(messages.errorCannotRead));
      else resolve(reader.result);
    };
    reader.onerror = () => reject(new Error(messages.errorCannotRead));
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
  let labelText  = messages.chipUnknown;

  if (predictedClass === 'real') {
    chipClass = 'result-chip--authentic';
    labelText = messages.chipAuthentic;
  } else if (predictedClass === 'fake') {
    chipClass = 'result-chip--fake';
    labelText = messages.chipFake;
  }

  if (isLowConfidence) {
    chipClass = 'result-chip--unknown';
    labelText = messages.chipUncertain;
  }

  return `<div class="result-chip ${chipClass}"><span class="result-chip__verdict">${labelText}</span></div>`;
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
