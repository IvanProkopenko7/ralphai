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
const MAX_IMAGES = 4;

const i18n = {
  navLabels:       isPolish ? 'METKI'                                : 'LABELS',
  navAbout:        isPolish ? 'O NAS'                                : 'ABOUT',
  navContact:      isPolish ? 'KONTAKT'                              : 'CONTACT',
  subtitle:        isPolish ? 'Dodaj zdjęcie górnej metki'           : 'Add a photo of the neck label',
  supportedLabelsNote: isPolish
    ? '*Wspierane są tylko metki Polo Ralph Lauren'
    : '*Only Polo Ralph Lauren labels are supported',
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
  howToGoodLabel:  isPolish ? 'DOBRZE'                               : 'GOOD',
  howToBadLabel:   isPolish ? 'ŹLE'                                  : 'BAD',
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
  updateModalTitle: isPolish ? '🎉 Pierwsze 500 wizyt!'               : '🎉 First 500 visitors!',
  updateModalSubtitle: isPolish ? 'Co nowego?'                        : "What's new:",
  updateFeatureDatasetTitle: isPolish ? 'Większy zbiór danych'        : 'Bigger dataset',
  updateFeatureDatasetBody: isPolish
    ? 'Do zbioru danych dodano <strong>1240</strong> zdjęć górnych metek. Teraz cały zbiór zawiera aż <strong>6020</strong> zdjęć!'
    : '<strong>1240</strong> more photos of tags in the dataset. Now dataset contains <strong>6020</strong> photos in total!',
  updateFeatureAccuracyTitle: isPolish ? 'Wyższa precyzja modelu'   : 'Higher model precision',
  updateFeatureAccuracyBody: isPolish
    ? 'Precyzja modelu wzrosła z 96.0% do <strong>98.6%</strong>.'
    : 'The precision of the model has been improved from 96.0% to <strong>98.6%</strong> now.',
  updateFeatureCropTitle: isPolish ? 'Lepsze kadrowanie na telefonach' : 'Better cropping on phones',
  updateFeatureCropBody: isPolish
    ? 'Kadrowanie stało się znacznie przyjemniejsze. Zdjęcie nie może wychodzić poza granice i automatycznie centruje się po pomniejszeniu.'
    : 'Now cropping is much nicer. The photo can\'t go out of bounds and it centers automatically when zoomed out.',
  updateFooterTitle: isPolish ? 'Dzięki, że korzystasz z RalphAI!'     : 'Thank you for checking out this website!',
  updateFooterSubtitle: isPolish ? 'Kolejne aktualizacje już w drodze.' : 'More improvements are coming soon.',
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
  uncertaintyHtml: isPolish 
    ? 'Niektóre wyniki są zbyt niepewne. Spróbuj ponownie zrobić zdjęcia i przyciąć je dokładniej. Jeśli wynik nadal jest niepewny, prześlij te zdjęcia na <a href="mailto:kontakt@ralphai.tech">adres e-mail strony</a> w celu weryfikacji przez człowieka lub opublikuj je na grupach takich jak <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank">r/PoloRalphLaurenLC</a> lub <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank">r/ralphlaurenlegitcheck</a>.'
    : 'Some of the results are too uncertain. Please, try re-cropping yellow photos more closely and checking them again. If the result is still uncertain, then please send those photos to the <a href="mailto:contact@ralphai.tech">website\'s email</a> for a human legit check or post it on groups like <a href="https://www.reddit.com/r/PoloRalphLaurenLC/" target="_blank">r/PoloRalphLaurenLC</a> or <a href="https://www.reddit.com/r/ralphlaurenlegitcheck/" target="_blank">r/ralphlaurenlegitcheck</a>.',
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
const CONFIDENCE_THRESHOLD = 78;

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

  applySharedMetrics();
}
applyTranslations();

/* ─── Defer how-to video source load ───────────────── */
const howToVideo = document.getElementById('howToVideo');
if (howToVideo) {
  const sourceEl = howToVideo.querySelector('source[data-src]');
  const captionsTrack = howToVideo.querySelector('#howToVideoCaptions');

  if (captionsTrack) {
    captionsTrack.srclang = isPolish ? 'pl' : 'en';
    captionsTrack.label = isPolish ? 'Polski' : 'English';
    captionsTrack.src = isPolish ? 'captions/cropping.pl.vtt' : 'captions/cropping.en.vtt';
  }

  if (sourceEl) {
    const loadVideoSource = () => {
      if (sourceEl.src) return;
      sourceEl.src = sourceEl.dataset.src;
      howToVideo.preload = 'metadata';
      howToVideo.load();
    };

    const playVideo = () => {
      const playPromise = howToVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    };

    const syncVideoPlayback = (isVisible) => {
      if (isVisible) {
        loadVideoSource();
        playVideo();
      } else if (!howToVideo.paused) {
        howToVideo.pause();
      }
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          syncVideoPlayback(entry.isIntersecting);
        });
      }, { rootMargin: '8.5714rem 0rem', threshold: 0.15 });
      observer.observe(howToVideo);
    } else {
      loadVideoSource();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !howToVideo.paused) {
        howToVideo.pause();
      }
    });
  }
}

document.getElementById('langToggle').addEventListener('click', () => {
  localStorage.setItem('lang', isPolish ? 'en' : 'pl');
  location.reload();
});

/* ─── Update popup ───────────────────────────────── */
const SHOW_UPDATE_POPUP = true;
// Bump this version for each new release note so each update is shown once per browser.
const UPDATE_POPUP_VERSION = '2026-04-500-visitors';
const updatePopupSeenKey = `updatePopupSeen:${UPDATE_POPUP_VERSION}`;
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
  if (SHOW_UPDATE_POPUP && !localStorage.getItem(updatePopupSeenKey)) {
    openUpdateModal();
    localStorage.setItem(updatePopupSeenKey, '1');
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
let lastCropConfirmTouchTs = 0;
let previousCropperBodyOverflow = '';
let activeCropSourceCleanup = null;

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

function getCropExportOptions() {
  if (!isMobileSafari) {
    return { maxWidth: 640, maxHeight: 640, jpegQuality: 0.88 };
  }

  const isLowEndCpu = (navigator.hardwareConcurrency || 4) <= 2;
  if (isLowEndCpu) {
    return { maxWidth: 480, maxHeight: 480, jpegQuality: 0.78 };
  }

  return { maxWidth: 560, maxHeight: 560, jpegQuality: 0.82 };
}

function buildPreviewCardMarkup(img, index) {
  return `
    <div class="preview-card" data-card-index="${index}">
      <div class="preview-thumb">
        <img src="${img.previewUrl}" alt="${i18n.photo(index + 1)}" />
        <button class="preview-thumb-remove" data-index="${index}" aria-label="Usuń">&#x2715;</button>
      </div>
      ${img.chip ? img.chip : ''}
    </div>
  `;
}

function updatePreviewAreaMeta() {
  previewGrid.hidden = false;
  chooseBtn.hidden = true;
  dropText.hidden = true;
  btnAnalyze.hidden = false;
  previewClearAllContainer.hidden = false;

  const hasLowConfidence = croppedImages.some(img => img.chip && img.chip.includes('result-chip--unknown'));
  if (uncertaintyMsg) uncertaintyMsg.hidden = !hasLowConfidence;

  const n = croppedImages.length;
  btnAnalyze.querySelector('span').textContent = n === 1 ? i18n.checkTag : i18n.checkTags(n);
}

function appendLastPreviewCard() {
  if (!croppedImages.length) {
    renderGrid();
    return;
  }

  const addMoreBtn = previewGrid.querySelector('#addMoreBtn');
  if (previewGrid.hidden || !addMoreBtn) {
    renderGrid();
    return;
  }

  updatePreviewAreaMeta();

  const index = croppedImages.length - 1;
  const img = croppedImages[index];
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPreviewCardMarkup(img, index).trim();
  const card = wrapper.firstElementChild;
  if (!card) {
    renderGrid();
    return;
  }

  previewGrid.insertBefore(card, addMoreBtn);

  const canAddMore = croppedImages.length + cropQueue.length < MAX_IMAGES;
  if (!canAddMore) {
    addMoreBtn.remove();
  }
}

function finalizeCrop(blob) {
  const previewUrl = URL.createObjectURL(blob);
  croppedImages.push({ blob, previewUrl });

  // Keep the cropper open between queued images to avoid overlay close/reopen flicker.
  requestAnimationFrame(() => {
    appendLastPreviewCard();
    if (cropQueue.length) {
      processNextCrop(true);
      return;
    }
    closeCropper();
  });
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

    const { maxWidth, maxHeight, jpegQuality } = getCropExportOptions();
    const canvas = cropperInstance.getCroppedCanvas({ maxWidth, maxHeight });
    if (!canvas) {
      setCropConfirmProcessing(false);
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        setCropConfirmProcessing(false);
        showError(i18n.errorCannotRead);
        return;
      }

      finalizeCrop(blob);
    }, 'image/jpeg', jpegQuality);
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
    .then((source) => {
      releaseActiveCropSource();
      activeCropSourceCleanup = source.cleanup;
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
    cropperInstance = new Cropper(cropperImg, {
      viewMode:     1,
      autoCropArea: getResponsiveAutoCropArea(),
      dragMode:     isTouchDevice ? 'none' : 'crop',
      movable:      !isTouchDevice,
      zoomable:     true,
      zoomOnTouch:  true,
      scalable:     false,
      rotatable:    false,
      toggleDragModeOnDblclick: false,
    });
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
  closeCropper();
});

/* ─── Clear all button ────────────────────────────── */
previewClearAll.addEventListener('click', () => {
  cleanupAllPreviewUrls();
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
});

/* ─── Analyze button ──────────────────────────────── */
btnAnalyze.addEventListener('click', async () => {
  if (!croppedImages.length) return;
  hideError();
  hideResult();

  btnAnalyze.classList.add('loading');
  btnAnalyze.querySelector('span').textContent = i18n.analyzing;
  btnAnalyze.disabled = true;

  try {
    const results = await Promise.all(
      croppedImages.map(async ({ blob }) => classifyImage(await blobToBase64(blob)))
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
  const isLowConfidence = pct < CONFIDENCE_THRESHOLD;

  let chipClass  = 'result-chip--unknown';
  let labelText  = i18n.chipUnknown;

  if (predictedClass.includes('authentic') || predictedClass.includes('original') || predictedClass.includes('oryginal') || predictedClass.includes('prawdziwy') || predictedClass === 'real') {
    chipClass = 'result-chip--authentic';
    labelText = i18n.chipAuthentic;
  } else if (predictedClass.includes('fake') || predictedClass.includes('podróbka') || predictedClass.includes('replica') || predictedClass.includes('fals')) {
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
