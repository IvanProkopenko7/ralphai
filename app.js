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
  navAbout:        isPolish ? 'O NAS'                                : 'ABOUT',
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
  howToGoodLabel:  isPolish ? 'DOBRZE'                               : 'GOOD',
  howToBadLabel:   isPolish ? 'ŹLE'                                  : 'BAD',
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
    ? 'Większość ubrań marki Ralph Lauren wyprodukowanych po listopadzie 2019 roku posiada kod QR na metce górnej metce. Zeskanuj go swoim telefonem. Kod QR powinien przekierować Cię na oficjalną stronę Ralph Lauren służącą do weryfikacji autentyczności danego ubrania. Jeśli link przekieruje Cię na stronę „Authentication Check. We need a closer look at your QR code”, najprawdopodobniej jest to podróbka, choć zdarzają się przypadki, gdy strona ta wyświetla się nawet w przypadku oryginalnych ubrań Ralph Lauren. Dzieje się tak w przypadku produktów, które są sample\'ami i/lub zostały wyprodukowane do użytku wewnętrznego merch\'e i prezenty dla pracowników, lub gdy kod QR został zeskanowany zbyt wiele razy. Jeśli kod QR nie skanuje się lub przekierowuje Cię na jakąkolwiek inną stronę, to z pewnością jest to podróbka. Ponadto, jeśli kod QR skanuje się poprawnie i przekierowuje Cię na właściwą stronę, nie oznacza to, że produkt jest na pewno autentyczny. Kody QR można skopiować, więc powinny one stanowić tylko jeden z elementów procesu weryfikacji autentyczności odzieży, a nie pewną odpowiedź. Niemniej jednak kod QR zapewnia ponad 98+% skuteczności, więc jeśli to możliwe, zdecydowanie warto go zeskanować.'
    : 'Most Ralph Lauren clothes that were made after November 2019 have a QR code on the neck label. Scan it with your phone. The QR code should send you to the Ralph Lauren\'s official authentication page of the piece of clothing that you are legit checking. If the link sends you to the "Authentication Check. We need a closer look at your QR code" page, then it\'s most likely fake, though there are instances of that page showing even on legitimate Ralph Lauren clothes. It happens with products that are either samples and/or manufactured for internal use - employee merch/gifts or when the QR code is scanned too many times. If the QR code doesn\'t scan or sends you to any other page, then it\'s certainly fake. Also, if the QR code scans correctly and sends you to the right page, it doesn\'t mean that the piece is certainly legit. QR codes can be copied, so it should serve as one of the parts of clothes\' authentication process, not a certain answer. But still, QR code gives you about 98+% accuracy, so if you can, you should certainly scan it.',
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
  updateModalTitle: isPolish ? '🎉 Pierwsze 100 wizyt!'               : '🎉 First 100 visitors!',
  updateModalSubtitle: isPolish ? 'Co nowego?'                        : "What's new:",
  updateFeatureAccuracyTitle: isPolish ? 'Lepsza skuteczność AI'      : 'AI accuracy has improved',
  updateFeatureAccuracyBody: isPolish
    ? 'Model AI został wytrenowany na <strong>4× większym zbiorze zdjęć</strong>.'
    : 'The AI model is now trained on <strong>4× more images</strong> than before.',
  updateFeatureVintageTitle: isPolish
    ? 'Dodaliśmy metki vintage „Polo By Ralph Lauren”'
    : 'Vintage "Polo By Ralph Lauren" tags have been added',
  updateFeaturePoloTitle: isPolish
    ? 'Dodaliśmy metki „Polo Ralph Lauren”'
    : '"Polo Ralph Lauren" tags have been added',
  updateFeatureDiversityTitle: isPolish ? 'Większa różnorodność metek' : 'Label diversity has been improved',
  updateFeatureDiversityBody: isPolish
    ? 'Teraz model obsługuje metki najróżniejszych kategorii: polo, koszule, kurtki, szorty, spodnie, czapki, szaliki, krawaty i inne.'
    : 'Labels of all kinds are now available: polos, shirts, jackets, shorts, trousers, caps, scarves, ties, and more.',
  updateFeatureCropTitle: isPolish
    ? 'Zwiększyliśmy obszar kadrowania, żeby łatwiej i precyzyjniej przycinać zdjęcia'
    : 'The cropping area has been increased to improve the cropping precision',
  updateFooterTitle: isPolish ? 'Dzięki, że korzystasz z RalphAI!'     : 'Thank you for checking out this website!',
  updateFooterSubtitle: isPolish ? 'Kolejne usprawnienia już w drodze.' : 'More improvements are coming soon.',
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
      }, { rootMargin: '120px 0px', threshold: 0.15 });
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
const SHOW_UPDATE_POPUP = false;
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
  // Keep the popup in code/DOM but disable showing it to users.
  if (SHOW_UPDATE_POPUP && !localStorage.getItem('updateModalShown')) {
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

function revokePreviewUrl(imageEntry) {
  if (imageEntry && imageEntry.previewUrl) {
    URL.revokeObjectURL(imageEntry.previewUrl);
  }
}

function cleanupAllPreviewUrls() {
  croppedImages.forEach(revokePreviewUrl);
}

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
function getResponsiveAutoCropArea() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Make the default crop box smaller on compact screens for easier framing.
  if (vw <= 480) return 0.77;
  if (vw <= 768) return 0.79;
  if (vw <= 1366 || vh <= 820) return 0.82;
  return 0.9;
}

function openCropper(src) {
  cropperImg.src = src;
  cropperModal.hidden = false;

  // Small delay so the image renders before Cropper initialises
  setTimeout(() => {
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(cropperImg, {
      viewMode:     1,
      autoCropArea: getResponsiveAutoCropArea(),
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
  btnCropConfirm.disabled = false;
  btnCropConfirm.classList.remove('is-processing');
  cropperImg.src = '';
  // Reset file input so the same file can be re-selected
  fileInput.value = '';
}

btnCropConfirm.addEventListener('click', () => {
  if (!cropperInstance || btnCropConfirm.disabled) return;

  btnCropConfirm.disabled = true;
  btnCropConfirm.classList.add('is-processing');

  // Yield one tick so the click feedback can paint before heavy canvas work.
  setTimeout(() => {
    if (!cropperInstance) {
      btnCropConfirm.disabled = false;
      btnCropConfirm.classList.remove('is-processing');
      return;
    }

    const canvas = cropperInstance.getCroppedCanvas({ maxWidth: 640, maxHeight: 640 });
    if (!canvas) {
      btnCropConfirm.disabled = false;
      btnCropConfirm.classList.remove('is-processing');
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        btnCropConfirm.disabled = false;
        btnCropConfirm.classList.remove('is-processing');
        showError(i18n.errorCannotRead);
        return;
      }

      const previewUrl = URL.createObjectURL(blob);
      croppedImages.push({ blob, previewUrl });

      closeCropper();
      btnCropConfirm.disabled = false;
      btnCropConfirm.classList.remove('is-processing');
      renderGrid();
      processNextCrop();
    }, 'image/jpeg', 0.88);
  }, 0);
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
        <img src="${img.previewUrl}" alt="${i18n.photo(i + 1)}" />
        <button class="preview-thumb-remove" data-index="${i}" aria-label="Usuń">&#x2715;</button>
      </div>
      ${img.chip ? img.chip : ''}
    </div>
  `).join('') + `<button class="preview-thumb preview-thumb-add" id="addMoreBtn">+</button>`;

  previewGrid.querySelectorAll('.preview-thumb-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      const removed = croppedImages.splice(idx, 1)[0];
      revokePreviewUrl(removed);
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
      resolve(parts[1]);
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
