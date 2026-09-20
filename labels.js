(() => {
  const isPolish = (navigator.language || '').toLowerCase().startsWith('pl');
  const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';

  const i18n = {
    navLabels: isPolish ? 'METKI' : 'LABELS',
    navAbout: isPolish ? 'O NAS' : 'ABOUT',
    navContact: isPolish ? 'KONTAKT' : 'CONTACT',
    footerCreatedBy: isPolish ? 'Stworzone przez' : 'Created by',
    collectNote: isPolish
      ? 'Zdjęcia bez wykrytej metki i wyniki o niskiej pewności mogą być anonimowo zapisywane, aby ulepszać model'
      : 'Photos with no detected label and low-confidence results may be anonymously stored to improve the model',
    seeAll: isPolish ? 'Zobacz wszystkie' : 'See all'
  };

  // Fallback when manifest.json can't be fetched (e.g. file://).
  // Regenerate with: node generate-labels-manifest.js
  const FALLBACK_MANIFEST = {
  "sections": {
    "supported": "supported labels",
    "upcoming": "upcoming labels"
  },
  "supported": [
    {
      "folder": "polo_by_ralph_lauren",
      "title": "polo by ralph lauren",
      "baseDir": "/label_images/supported_labels/polo_by_ralph_lauren",
      "files": [
        "1970s_made_in_indonesia_shirt.jpg",
        "1980s_made_in_hong_kong_sweater.jpg",
        "1980s_made_in_korea_shirt.jpg",
        "1980s_made_in_usa_bullion patch_blazer.jpg",
        "1990s_denim_made_in_usa_jacket.jpg",
        "1990s_japanese_sweater.jpg",
        "1990s_made_in_honduras.jpg",
        "1990s_made_in_taiwan_hat.jpg",
        "1990s_made_in_usa_chinos.jpg",
        "1990s_made_in_usa_flat_cap.jpg",
        "1990s_made_in_usa_jacket.jpg",
        "1990s_made_in_usa_silk_tie.webp",
        "1990s_made_in_usa_wool_coat.jpg",
        "1990s_T-shirt.webp",
        "2000s_made_in_china_blazer.webp",
        "2000s_neck_tie.jpg",
        "2000s-blazer.jpg",
        "2010s_black_beanie.jpg",
        "2010s_kids_polo.webp",
        "2010s_lumberjack_shirt.jpg",
        "2018_palace_pants.jpg",
        "2020s_denim_jacket.jpg",
        "2020s_sleepwear_shirt.jpg",
        "2020s_sweater.webp",
        "2020s_yellow_QR_code_sweater.jpg"
      ]
    },
    {
      "folder": "polo_ralph_lauren",
      "title": "polo ralph lauren",
      "baseDir": "/label_images/supported_labels/polo_ralph_lauren",
      "files": [
        "1980s_made_in_usa_chore_blanket_jacket.jpg",
        "1990s_made_in_philippines_denim_jacket.jpg",
        "1990s_sportsman_shirt.jpg",
        "2000s_denim_military_jacket.jpg",
        "2010s_blazer.jpg",
        "2010s_cap.jpg",
        "2010s_kids_polo.jpg",
        "2010s_pants.webp",
        "2010s_scarf.jpg",
        "2010s_tweed_blazer.jpg",
        "2020s_black_beanie.jpg",
        "2020s_made_in_china_cardigan.jpg",
        "2020s_made_in_china_performance_jacket.jpg",
        "2020s_made_in_china_scarf.jpg",
        "2020s_made_in_china_wool_hat.jpg",
        "2020s_made_in_egypt_jacket.jpg",
        "2020s_sleepwear_shirt.jpg"
      ]
    },
    {
      "folder": "ralph_lauren",
      "title": "ralph lauren",
      "baseDir": "/label_images/supported_labels/ralph_lauren",
      "files": [
        "1970s_jacket.jpg",
        "1979_women's_blazer.jpg",
        "1980s_cardigan.jpg",
        "1980s_denim_vest.jpg",
        "late_1970s_blazer.jpg",
        "late_1970s_tweed_suit.jpg",
        "late_1980s_denim_jacket.jpg",
        "mid_1980s_dress_2.jpg",
        "mid_1980s_dress.jpg",
        "pair_of_1990s_boots.jpg"
      ]
    }
  ],
  "upcoming": []
};;

  // Folder name -> section title. Only "_" becomes " " — dashes,
  // apostrophes and other symbols are preserved.
  function folderToTitle(folder) {
    return String(folder || '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // File name -> caption. Only "_" becomes " " — e.g. "2000s-blazer.jpg"
  // keeps its dash, "1979_women's_blazer.jpg" keeps its apostrophe.
  function fileToCaption(fileName) {
    return String(fileName || '')
      .replace(/\.[^/.]+$/, '')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function encodePathSegment(segment) {
    return encodeURIComponent(segment).replace(/%2F/g, '/');
  }

  function slugify(folder) {
    return String(folder || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function buildCardHtml(baseDir, fileName, eager) {
    const src = `${baseDir}/${encodePathSegment(fileName)}`;
    const caption = escapeHtml(fileToCaption(fileName));

    if (eager) {
      return `
        <article class="label-card" role="listitem">
          <div class="label-card-media">
            <img src="${src}" alt="${caption}" loading="eager" decoding="async" fetchpriority="high" width="400" height="300" />
          </div>
          <p class="label-card-caption">${caption}</p>
        </article>
      `;
    }

    return `
      <article class="label-card" role="listitem">
        <div class="label-card-media">
          <img data-src="${src}" alt="${caption}" loading="lazy" decoding="async" fetchpriority="low" width="400" height="300" />
        </div>
        <p class="label-card-caption">${caption}</p>
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

  function renderGrid(grid, baseDir, fileNames, eagerFirst) {
    // Show only 2 rows before "See all" (4 cols desktop / 3 cols mobile).
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 4;
    const initialCount = cols * 2;
    const initialFiles = fileNames.slice(0, initialCount);
    let html = initialFiles
      .map((fileName, i) => buildCardHtml(baseDir, fileName, eagerFirst && i === 0))
      .join('');

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
        const remainingHtml = remainingFiles.map((fileName) => buildCardHtml(baseDir, fileName, false)).join('');
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

  function renderGroups(containerId, groups, eagerFirstGroup) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    groups.forEach((group, groupIndex) => {
      const title = escapeHtml(group.title || folderToTitle(group.folder));
      const gridId = `grid-${slugify(group.folder)}`;
      const subgroup = document.createElement('div');
      subgroup.className = 'labels-subgroup';
      subgroup.innerHTML = `<h3 class="labels-subgroup-title">${title}</h3><div id="${gridId}" class="labels-grid" role="list"></div>`;
      container.appendChild(subgroup);
      renderGrid(
        subgroup.querySelector('.labels-grid'),
        group.baseDir,
        group.files || [],
        eagerFirstGroup && groupIndex === 0
      );
    });
  }

  function renderAll(manifest) {
    // Section headings come from the parent folder names (only "_" -> " ").
    // CSS .labels-section-title uppercases them for display.
    if (manifest.sections) {
      const supportedHeading = document.getElementById('supported-labels-heading');
      if (supportedHeading && manifest.sections.supported) {
        supportedHeading.textContent = manifest.sections.supported;
      }
      const upcomingHeading = document.getElementById('upcoming-labels-heading');
      if (upcomingHeading && manifest.sections.upcoming) {
        upcomingHeading.textContent = manifest.sections.upcoming;
      }
    }
    renderGroups('supported-groups', manifest.supported || [], true);
    renderGroups('upcoming-groups', manifest.upcoming || [], false);
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof i18n[key] === 'string') el.textContent = i18n[key];
  });

  const navContact = document.getElementById('navContactLink');
  if (navContact) navContact.href = `mailto:${EMAIL}`;

  const footerEmail = document.getElementById('footerEmailLink');
  if (footerEmail) {
    footerEmail.href = `mailto:${EMAIL}`;
    footerEmail.textContent = EMAIL;
  }

  fetch('label_images/manifest.json', { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      return res.json();
    })
    .then(renderAll)
    .catch(() => renderAll(FALLBACK_MANIFEST));
})();
