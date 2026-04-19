(() => {
  const storedLang = localStorage.getItem('lang');
  const isPolish = storedLang ? storedLang === 'pl' : (navigator.language || '').toLowerCase().startsWith('pl');
  const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';

  const i18n = {
    navLabels: isPolish ? 'METKI' : 'LABELS',
    navAbout: isPolish ? 'O NAS' : 'ABOUT',
    supportedLabels: isPolish ? 'WSPIERANE METKI' : 'SUPPORTED LABELS',
    upcomingLabels: isPolish ? 'NADCHODZACE METKI' : 'UPCOMING LABELS',
    navContact: isPolish ? 'KONTAKT' : 'CONTACT',
    footerCreatedBy: isPolish ? 'Stworzone przez' : 'Created by',
    seeAll: isPolish ? 'Zobacz wszystkie' : 'See all'
  };

  const supportedPoloBy = [
    '2020s_yellow_QR_code_sweater_01020150-5.jpg',
    '2020s_sweater_1762255243.webp',
    '2020s_sleepwear_shirt_1773857029.jpg',
    '2020s_denim_jacket_s-l1600 (12).jpg',
    '2018_palace_pants_3s-l1600 (4).jpg',
    '2010s_lumberjack_shirt_1732463136.jpg',
    '2010s_kids_polo_1760466372.webp',
    '2010s_black_beanie.jpg',
    '2000s_neck_tie.jpg',
    '2000s_made_in_china_blazer.webp',
    '2000s-blazer.jpg',
    '1990s_t-shirt.webp',
    '1990s_made_in_usa_wool_coat_s-l1600 (12).jpg',
    '1990s_made_in_usa_silk_tie_s-l1600 (99).webp',
    '1990s_made_in_usa_jacket.jpg',
    '1990s_made_in_usa_flat_cap_s-l1600 (923).jpg',
    '1990s_made_in_usa_chinos.jpg',
    '1990s_made_in_taiwan_hat.jpg',
    '1990s_made_in_honduras_t-shirt_1760451379.jpg',
    '1990s_japanese_sweater_il_1588xN.6968401628_d2u8.jpg',
    '1990s_denim_made_in_usa_jacket_rl-polo-vintage-denim-full-zip-v0-pdpzxfeyzppg1.jpg',
    '1980s_made_in_usa_bullion patch_blazer_found-at-a-garage-sale-v0-9urj57alqbog1.jpg',
    '1980s_made_in_korea_shirt_anyone-seen-this-tag-before-v0-9fe1cvy5786f1.jpg',
    '1980s_made_in_hong_kong_sweater_BbvVd77qNaZB19VENdWw.jpg',
    '1970s_made_in_indonesia_shirt_614039665_122274818168034110_6614302298217007721_n.jpg'
  ];

  const supportedPolo = [
    '2020s_sleepwear_shirt_legit-check-plz-v0-4gkfrpelz8rg1.jpg',
    '2020s_made_in_egypt_jacket.jpg',
    '2020s_made_in_china_wool_hat_1773862739.jpg',
    '2020s_made_in_china_scarf.jpg',
    '2020s_made_in_china_performance_jacket.jpg',
    '2020s_made_in_china_cardigan_1765367939.jpg',
    '2020s_black_beanie_1774383455.jpg',
    '2010s_tweed_blazer_s-l116200 (10).jpg',
    '2010s_scarf_s-2l1600.jpg',
    '2010s_pants.webp',
    '2010s_kids_polo_1770790076 (1).jpg',
    '2010s_cap_1773955410.jpg',
    '2010s_blazer.jpg',
    '2000s_denim_military_jacket.jpg',
    '1990s_sportsman_shirt.jpg',
    '1990s_made_in_philippines_denim_jacket.jpg',
    '1980s_made_in_usa_chore_blanket_jacket_s-l16300 (7).jpg'
  ];

  const upcomingRalphLauren = [
    'big_vintagefashionguild_77034-1.jpg',
    'big_vintagefashionguild_88587-1.jpg',
    'big_vintagefashion-new_1202-1.jpg',
    'big_vintagefashion-new_23266-1.jpg',
    'big_vintagefashion-new_29075-1.jpg',
    'big_vintagefashion-new_29494-1.jpg',
    'big_vintagefashion-new_30076-1.jpg',
    'big_vintagefashion-new_33977-1.jpg',
    'big_vintagefashion-new_41008-1.jpg',
    'big_vintagefashion-new_42100-1.jpg'
  ];

  const upcomingOther = [
    'IMG_7770.jpg'
  ];

  const LCP_IMAGE_FILE = '2020s_yellow_QR_code_sweater_01020150-5.jpg';

  function encodePathSegment(segment) {
    return encodeURIComponent(segment).replace(/%2F/g, '/');
  }

  function buildCardHtml(baseDir, fileName) {
    const src = `${baseDir}/${encodePathSegment(fileName)}`;
    const label = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const isLcpCandidate = baseDir.includes('polo_by_ralph_lauren') && fileName === LCP_IMAGE_FILE;

    if (isLcpCandidate) {
      return `
        <article class="label-card" role="listitem">
          <div class="label-card-media">
            <img src="${src}" alt="${label}" loading="eager" decoding="async" fetchpriority="high" width="400" height="300" />
          </div>
        </article>
      `;
    }

    return `
      <article class="label-card" role="listitem">
        <div class="label-card-media">
          <img data-src="${src}" alt="${label}" loading="lazy" decoding="async" fetchpriority="low" width="400" height="300" />
        </div>
      </article>
    `;
  }

  function initLazyImages(scope) {
    const images = Array.from(scope.querySelectorAll('img[data-src]'));
    if (!images.length) return;

    const loadImage = (img) => {
      if (!img.dataset.src) return;
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    };

    if (!('IntersectionObserver' in window)) {
      images.forEach(loadImage);
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        loadImage(img);
        obs.unobserve(img);
      });
    }, { rootMargin: '300px 0px', threshold: 0.01 });

    images.forEach((img) => observer.observe(img));
  }

  function renderGrid(gridId, baseDir, fileNames) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const initialCount = 12;
    const initialFiles = fileNames.slice(0, initialCount);
    let html = initialFiles.map((fileName) => buildCardHtml(baseDir, fileName)).join('');

    if (fileNames.length > initialCount) {
      html += `
        <div class="labels-see-all-wrapper" style="grid-column: 1 / -1; display: flex; justify-content: center; margin-top: 10px;">
          <button class="labels-see-all-btn" style="padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; border: 2px solid #e5e7eb; border-radius: 999px; background: transparent; color: #111; transition: all 0.2s;">
            ${i18n.seeAll}
          </button>
        </div>
      `;
    }

    grid.innerHTML = html;
    initLazyImages(grid);

    const seeAllBtn = grid.querySelector('.labels-see-all-btn');
    if (seeAllBtn) {
      seeAllBtn.addEventListener('click', function() {
        const remainingFiles = fileNames.slice(initialCount);
        const remainingHtml = remainingFiles.map((fileName) => buildCardHtml(baseDir, fileName)).join('');
        this.parentElement.outerHTML = remainingHtml;
        initLazyImages(grid);
      });
      seeAllBtn.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#f3f4f6';
      });
      seeAllBtn.addEventListener('mouseout', function() {
        this.style.backgroundColor = 'transparent';
      });
    }
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof i18n[key] === 'string') el.textContent = i18n[key];
  });

  const langBtn = document.getElementById('langToggle');
  if (langBtn) {
    langBtn.textContent = isPolish ? 'EN' : 'PL';
    langBtn.addEventListener('click', () => {
      localStorage.setItem('lang', isPolish ? 'en' : 'pl');
      location.reload();
    });
  }

  const navContact = document.getElementById('navContactLink');
  if (navContact) navContact.href = `mailto:${EMAIL}`;

  const footerEmail = document.getElementById('footerEmailLink');
  if (footerEmail) {
    footerEmail.href = `mailto:${EMAIL}`;
    footerEmail.textContent = EMAIL;
  }

  renderGrid('grid-supported-polo-by', '/label_images/supported_labels/polo_by_ralph_lauren', supportedPoloBy);
  renderGrid('grid-supported-polo', '/label_images/supported_labels/polo_ralph_lauren', supportedPolo);
  renderGrid('grid-upcoming-ralph', '/label_images/upcoming_labels/ralph_lauren', upcomingRalphLauren);
  renderGrid('grid-upcoming-other', '/label_images/upcoming_labels/other', upcomingOther);
})();
