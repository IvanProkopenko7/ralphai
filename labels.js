(() => {
  const storedLang = localStorage.getItem('lang');
  const isPolish = storedLang ? storedLang === 'pl' : (navigator.language || '').toLowerCase().startsWith('pl');
  const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';

  const i18n = {
    navLabels: isPolish ? 'METKI' : 'LABELS',
    supportedLabels: isPolish ? 'WSPIERANE METKI' : 'SUPPORTED LABELS',
    upcomingLabels: isPolish ? 'NADCHODZACE METKI' : 'UPCOMING LABELS',
    navContact: isPolish ? 'KONTAKT' : 'CONTACT',
    footerCreatedBy: isPolish ? 'Stworzone przez' : 'Created by'
  };

  const supportedPoloBy = [
    '01020150-5_cropped_processed_by_imagy_webp.rf.GgsdY9WmvIG1CWehHxqT.webp',
    '1732463136_cropped_processed_by_imagy_webp_webp_webp.rf.AKlfoq9YxYkjlGamSwUS.webp',
    '1760451379_cropped_processed_by_imagy_webp.rf.KAaWuLkM67LWbP7Wdypm.webp',
    '1760466372_webp_webp_webp.rf.Sv5zn2B7XB7hdTyDdQgr.webp',
    '1762255243_cropped_processed_by_imagy_webp_webp_webp.rf.NMfrUOi9AgHdXg6R1HoX.webp',
    '1773857029_cropped_processed_by_imagy_webp.rf.6sEE2TvA1ZNd0Zn6nUKl.webp',
    '3s-l1600 (4)_cropped_processed_by_imagy_webp.rf.NUTRF4mdIlD9m9qgrb3H.webp',
    '614039665_122274818168034110_6614302298217007721_n_cropped_processed_by_imagy_jpg.rf.3kXArsroDPRqwAjpT8mP.jpg',
    'anyone-seen-this-tag-before-v0-9fe1cvy5786f1_cropped_processed_by_imagy_webp.rf.FjE8TqjZf5Zi694pkthl.webp',
    'BbvVd77qNaZB19VENdWw_png_png_png.rf.v7uOLLPKKtVmpvc6k0z5.png',
    'screenshot_2026-03-26_011251_cropped_processed_by_imagy_webp.rf.RZVxrJA87nNRWh1kuhH1.webp',
    'found-at-a-garage-sale-v0-9urj57alqbog1_cropped_processed_by_imagy_webp.rf.l9qPoi8liGPHhBWp3Nje.webp',
    'found-at-a-garage-sale-v0-h9bwe7alqbog1_cropped_processed_by_imagy_webp.rf.YQOFW5Yy9v79K8eWQ1W0.webp',
    'fs-l1600_cropped_processed_by_imagy_webp.rf.zIeEeQZcwKLPFph9h1P7.webp',
    'gs-l1600 (12)_cropped_processed_by_imagy_webp.rf.oR2VFLTDbZMloFbEYWB8.webp',
    'il_1588xN-6968401628_d2u8_cropped_processed_by_imagy_jpg.rf.qJVCKfBR0XjLeL081Bq1.jpg',
    'rl-polo-vintage-denim-full-zip-v0-pdpzxfeyzppg1_cropped_processed_by_imagy_webp.rf.XnNhGZUwv7OzwWyavPIq.webp',
    's-l1600 - 2026-03-17T172046-883_cropped_processed_by_imagy_webp.rf.v7HYW3lO7ZhNiGEU5AYA.webp',
    's-l1600 - 2026-03-18T211414-066_cropped_processed_by_imagy_webp.rf.XBvcbiGmprwCIERYOaJ8.webp',
    's-l1600 - 2026-03-18T211705-669_cropped_processed_by_imagy_webp.rf.Lvsqh9eBRblvl6pm9z6D.webp',
    's-l1600 - 2026-03-19T131848-660_cropped_processed_by_imagy_webp.rf.ZJfx5c9cu74e0MaehagW.webp',
    's-l1600 - 2026-03-19T183804-739_cropped_processed_by_imagy_webp.rf.gQHzNZNeFwEEDlnF9bhr.webp',
    's-l1600 - 2026-03-19T184257-600_cropped_processed_by_imagy_webp.rf.CrjsSrm6SnNVJ3IBhx6q.webp',
    's-l1600 (12)_cropped_processed_by_imagy_webp.rf.mYN7iNTKc1X9de2jukjl.webp',
    's-l1600 (923)_cropped_processed_by_imagy_webp.rf.XuLYG7S15NRCL1O33Nmf.webp'
  ];

  const supportedPolo = [
    '1765367939_cropped_processed_by_imagy_webp_webp.rf.nNSO1I6BlMpjJRMv9JmI.webp',
    '1770790076 (1)_cropped_processed_by_imagy_webp_webp.rf.GdRxdmOzpUoVpVUPOMjE.webp',
    '1773862739_cropped_processed_by_imagy.webp',
    '1773955410_cropped_processed_by_imagy.webp',
    '1774383455_cropped_processed_by_imagy.webp',
    'legit-check-plz-v0-4gkfrpelz8rg1_cropped_processed_by_imagy.webp',
    's-2l1600_cropped_processed_by_imagy.webp',
    's-l116200 (10)_cropped_processed_by_imagy.webp',
    's-l1600 - 2026;-03-18T212007-045_cropped_processed_by_imagy_webp.rf.cVsgqKCJLpuWcnaFxqC1.webp',
    's-l1600 - 2026-03-16T160340-827_cropped_processed_by_imagy_webp.rf.tmqlrnjHdCJgLCTnlotB.webp',
    's-l1600 - 2026-03-16T160830-579_cropped_processed_by_imagy_webp.rf.1V3F3BaTrqcPXuyGHsjZ.webp',
    's-l1600 - 2026-03-19T145732-184_cropped_processed_by_imagy_webp.rf.MeBsYeZaZ60HgjMpeSZj.webp',
    's-l1600 - 2026-03-19T150302-531_cropped_processed_by_imagy_webp.rf.epOe7Av7IAnMkvX2fy0I.webp',
    's-l1600 - 2026-03-19T170406-768_cropped_processed_by_imagy_webp.rf.PDyMSUSGqomR9S9meIFO.webp',
    's-l1600 - 2026-03-19T170423-182_cropped_processed_by_imagy_webp.rf.J0ZWtPd3mNeiZgNGxAmm.webp',
    's-l1600 - 2026-03-26T165302.788_cropped_processed_by_imagy.webp'
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
    'IMG_7770.jpeg'
  ];

  function encodePathSegment(segment) {
    return encodeURIComponent(segment).replace(/%2F/g, '/');
  }

  function renderGrid(gridId, baseDir, fileNames) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = fileNames.map((fileName) => {
      const src = `${baseDir}/${encodePathSegment(fileName)}`;
      const label = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      return `
        <article class="label-card" role="listitem">
          <div class="label-card-media">
            <img src="${src}" alt="${label}" loading="lazy" />
          </div>
        </article>
      `;
    }).join('');
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

  renderGrid('grid-supported-polo-by', 'label_images/supported_labels/polo_by_ralph_lauren', supportedPoloBy);
  renderGrid('grid-supported-polo', 'label_images/supported_labels/polo_ralph_lauren', supportedPolo);
  renderGrid('grid-upcoming-ralph', 'label_images/upcoming_labels/ralph_lauren', upcomingRalphLauren);
  renderGrid('grid-upcoming-other', 'label_images/upcoming_labels/other', upcomingOther);
})();
