(() => {
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
    },
    {
      "folder": "polo_sport",
      "title": "polo sport",
      "baseDir": "/label_images/supported_labels/polo_sport",
      "files": [
        "1990s_made_in_china_sweatpants.jpg",
        "1990s_made_in_honduras_T-shirt.jpg",
        "1990s_made_in_peru_shirt.webp",
        "1990s_made_in_usa_cap.jpg",
        "sportswoman_1990s_sweater.jpg"
      ]
    }
  ],
  "upcoming": [
    {
      "folder": "polo_ralph_lauren_print_label",
      "title": "polo ralph lauren print label",
      "baseDir": "/label_images/upcoming_labels/polo_ralph_lauren_print_label",
      "files": [
        "2019_wimbledon_T-shirt.jpg",
        "2020s_made_in_turkey_T-shirt.jpg",
        "late_2010s_made_in_indonesia_performance_jacket.jpg"
      ]
    },
    {
      "folder": "ralph_lauren_purple_label",
      "title": "ralph lauren purple label",
      "baseDir": "/label_images/upcoming_labels/ralph_lauren_purple_label",
      "files": [
        "early_2000s_made_in_usa_collection_pants.jpg",
        "early_2020s_made_in_italy_T-shirt.jpg",
        "late_1990s_women's_jacket.jpg"
      ]
    },
    {
      "folder": "double_RL",
      "title": "double RL",
      "baseDir": "/label_images/upcoming_labels/double_RL",
      "files": [
        "late_2024_30th_anniversary_valero_jacket.png"
      ]
    }
  ]
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
        <li class="label-card">
          <div class="label-card__media label-card__media--loading">
            <img src="${src}" alt="Ralph Lauren label example: ${caption}" loading="eager" decoding="async" fetchpriority="high" width="400" height="300" />
          </div>
          <p class="label-card__caption">${caption}</p>
        </li>
      `;
    }

    return `
      <li class="label-card">
        <div class="label-card__media label-card__media--loading">
          <img data-src="${src}" alt="Ralph Lauren label example: ${caption}" loading="lazy" decoding="async" fetchpriority="low" width="400" height="300" />
        </div>
        <p class="label-card__caption">${caption}</p>
      </li>
    `;
  }

  function clearCardLoading(img) {
    const media = img.closest('.label-card__media');
    if (media) media.classList.remove('label-card__media--loading');
  }

  function wireCardLoaders(scope) {
    scope.querySelectorAll('.label-card__media img').forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        clearCardLoading(img);
        return;
      }
      img.addEventListener('load', () => clearCardLoading(img), { once: true });
      img.addEventListener('error', () => clearCardLoading(img), { once: true });
    });
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
        <li class="label-library__more">
          <button class="label-library__expand" aria-expanded="false">
            See all
          </button>
        </li>
      `;
    }

    grid.innerHTML = html;
    initLazyImages(grid);
    wireCardLoaders(grid);

    const seeAllBtn = grid.querySelector('.label-library__expand');
    if (seeAllBtn) {
      seeAllBtn.addEventListener('click', function() {
        const remainingFiles = fileNames.slice(initialCount);
        const remainingHtml = remainingFiles.map((fileName) => buildCardHtml(baseDir, fileName, false)).join('');
        this.parentElement.outerHTML = remainingHtml;
        initLazyImages(grid);
        wireCardLoaders(grid);
        const firstNewCard = grid.children[initialCount];
        firstNewCard.tabIndex = -1;
        firstNewCard.focus();
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
      subgroup.className = 'label-library__group';
      subgroup.innerHTML = `<h3 class="label-library__group-title">${title}</h3><ul id="${gridId}" class="label-library__grid" role="list"></ul>`;
      container.appendChild(subgroup);
      renderGrid(
        subgroup.querySelector('.label-library__grid'),
        group.baseDir,
        group.files || [],
        eagerFirstGroup && groupIndex === 0
      );
    });
  }

  function renderAll(manifest) {
    // Section headings come from the parent folder names (only "_" -> " ").
    // CSS .label-library__heading uppercases them for display.
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

  // Paint instantly from the bundled fallback so the page never flashes
  // empty; refresh in the background only if the manifest actually changed.
  renderAll(FALLBACK_MANIFEST);

  fetch('label_images/manifest.json', { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      return res.json();
    })
    .then((manifest) => {
      if (JSON.stringify(manifest) !== JSON.stringify(FALLBACK_MANIFEST)) {
        renderAll(manifest);
      }
    })
    .catch(() => {});
})();
