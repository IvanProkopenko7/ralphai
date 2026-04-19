(() => {
  const storedLang = localStorage.getItem('lang');
  const isPolish = storedLang ? storedLang === 'pl' : (navigator.language || '').toLowerCase().startsWith('pl');
  const EMAIL = isPolish ? 'kontakt@ralphai.tech' : 'contact@ralphai.tech';

  const i18n = {
    navLabels: isPolish ? 'METKI' : 'LABELS',
    navAbout: isPolish ? 'O NAS' : 'ABOUT',
    navContact: isPolish ? 'KONTAKT' : 'CONTACT',
    aboutTitle: isPolish ? 'O RalphAI' : 'About RalphAI',
    aboutP1: isPolish
      ? 'RalphAI to darmowy model AI do sprawdzania autentyczności ubrań Ralph Lauren. Użycie jest bardzo proste - wystarczy wrzucić zdjęcie górnej metki, przeciąć ją i kliknąć przycisk „Sprawdź metkę". Wynik otrzymujesz w kilka sekund.'
      : `RalphAI is a free AI model for verifying the authenticity of Ralph Lauren clothing. It's very easy to use - simply upload a photo of the neck label, crop it, and click the ‘Check label’ button. You’ll usually get the result in less than a second.`,
    aboutP2: isPolish
      ? 'Model rozpoznaje 43 rodzaje metek: od szalików i czapek po garnitury i kurtki, włącznie z naprawdę rzadkimi metkami vintage z lat 70. i 80. Był trenowany na realnych ofertach z Vinted i eBay, więc dobrze radzi sobie ze zdjęciami nie najlepszej jakości — słabe światło, zły kąt czy rozmycie nie są problemem. Jeżeli model nie jest pewien w wyborze, wyświetla się komunikat o niepewności.'
      : 'The model recognises 43 types of labels: from scarves and hats to suits and jackets, including truly rare vintage labels from the 70s and 80s. It was trained on real listings from Vinted and eBay, so it copes well with photos of less-than-ideal quality — poor lighting, bad angles or blurriness are no problem. If the model is uncertain in its choice, an uncertainty message is displayed.',
    aboutP3: isPolish
      ? 'Projekt jest stale rozwijany, ciągłe dodawane są nowe metki, zwiększana skuteczność modelu, strona staje się coraz bardziej rozbudowana. Kod jest dostępny wszystkim na GitHubie. Przesyłane zdjęcia nie są nigdzie zapisywane.'
      : 'The project is constantly being developed; new tags are continually being added, the model’s accuracy is being improved, and the website is becoming increasingly comprehensive. The code is available to everyone on GitHub. Uploaded photos are not stored anywhere.',
    metric0: isPolish ? 'Wizyt' : 'Visitors',
    metric1: isPolish ? 'Skuteczność ogólna' : 'Overall precision',
    metric2: isPolish ? 'Skuteczność przy pewności powyżej 78%' : 'Precision above 78% confidence',
    metric3: isPolish ? 'Liczba zdjęć w zbiorze danych' : 'Photos in the dataset',
    metric4: isPolish ? 'Liczba zdjęć po augmentacji' : 'Photos after augmentation',
    footerCreatedBy: isPolish ? 'Stworzone przez' : 'Created by'
  };

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof i18n[key] === 'string') el.textContent = i18n[key];
  });

  if (isPolish) {
    document.documentElement.lang = 'pl';
  }

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
})();
