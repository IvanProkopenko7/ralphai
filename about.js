(() => {
  const isPolish = (navigator.language || '').toLowerCase().startsWith('pl');
  const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';

  const i18n = {
    navLabels: isPolish ? 'METKI' : 'LABELS',
    navAbout: isPolish ? 'O NAS' : 'ABOUT',
    navContact: isPolish ? 'KONTAKT' : 'CONTACT',
    aboutTitle: isPolish ? 'O RalphAI' : 'About RalphAI',
    aboutP1: isPolish
      ? 'RalphAI to darmowy model AI do sprawdzania autentyczności ubrań Ralph Lauren. Użycie jest bardzo proste - wystarczy wrzucić zdjęcie górnej metki i kliknąć przycisk „Sprawdź metkę". Wynik otrzymujesz w kilka sekund.'
      : `RalphAI is a free AI model for verifying the authenticity of Ralph Lauren clothing. It's very easy to use - simply upload a photo of the neck label and click the ‘Check label’ button. You’ll get the result in a few seconds.`,
    aboutP2: isPolish
      ? 'Model rozpoznaje over 50+ rodzajów metek: od szalików i czapek po garnitury i kurtki, włącznie z naprawdę rzadkimi metkami vintage z lat 70. i 80. Był trenowany na realnych ofertach z Vinted i eBay, więc dobrze działa ze zdjęciami nie najlepszej jakości — słabe światło, zły kąt czy rozmycie nie są problemem. Jeżeli model nie jest pewien w wyborze, wyświetla się komunikat o niepewności.'
      : 'The model recognises over 50+ types of labels: from scarves and hats to suits and jackets, including truly rare vintage labels from the 70s and 80s. It was trained on real listings from Vinted and eBay, so it copes well with photos of less-than-ideal quality — poor lighting, bad angles or blurriness are no problem. If the model is uncertain in its choice, an uncertainty message is displayed.',
    aboutP3: isPolish
      ? 'Projekt jest stale rozwijany: ciągle dodawane są nowe metki, zwiększana skuteczność modelu, a strona staje się coraz bardziej rozbudowana.'
      : 'The project is constantly being developed: new tags are continually being added, the model’s accuracy is being improved, and the website is becoming increasingly comprehensive.',
    metric0: isPolish ? 'Wizyt' : 'Visitors',
    metric1: isPolish ? 'Skuteczność ogólna' : 'Overall precision',
    metric2: isPolish ? 'Skuteczność przy pewności powyżej 78%' : 'Precision above 78% confidence',
    metric3: isPolish ? 'Liczba zdjęć metek w zbiorze danych' : 'Photos of tags in the dataset',
    footerCreatedBy: isPolish ? 'Stworzone przez' : 'Created by',
    collectNote: isPolish
      ? 'Zdjęcia bez wykrytej metki i wyniki o niskiej pewności mogą być anonimowo zapisywane, aby ulepszać model'
      : 'Photos with no detected label and low-confidence results may be anonymously stored to improve the model',
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

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof i18n[key] === 'string') el.textContent = i18n[key];
  });

  applySharedMetrics();

  if (isPolish) {
    document.documentElement.lang = 'pl';
  }

  const navContact = document.getElementById('navContactLink');
  if (navContact) navContact.href = `mailto:${EMAIL}`;

  const footerEmail = document.getElementById('footerEmailLink');
  if (footerEmail) {
    footerEmail.href = `mailto:${EMAIL}`;
    footerEmail.textContent = EMAIL;
  }
})();
