/* Brutia Tango Fest 2027: display one rate per selected stay; no changes to booking submission. */
(() => {
  function start() {
    const section = document.querySelector('.stay-section');
    if (!section || section.dataset.hotelUxReady === '1') return;
    const dateChoices = Array.from(section.querySelectorAll('.stay-choice[data-nights]'));
    const stayChoices = Array.from(section.querySelectorAll('.stay-choice'));
    const rooms = Array.from(section.querySelectorAll('.room-cards .room-option'));
    if (dateChoices.length !== 3 || rooms.length !== 3) return;
    section.dataset.hotelUxReady = '1';

    const isEnglish = document.documentElement.lang === 'en';
    const earlyBirdEnd = Date.parse('2026-12-01T00:00:00+01:00');

    function displayRates() {
      const promo = Date.now() < earlyBirdEnd;
      const note = section.querySelector('#booking-promo-note');
      if (note) note.textContent = promo
        ? (isEnglish ? 'Hotel PROMO prices per person, valid through 30 November 2026.' : 'Prezzi hotel PROMO per persona, validi fino al 30 novembre 2026.')
        : (isEnglish ? 'Hotel prices per person. The promotion ended on 30 November 2026.' : 'Prezzi hotel per persona. La promozione è terminata il 30 novembre 2026.');
      section.querySelectorAll('.booking-option-price').forEach(price => {
        const amount = price.dataset[promo ? 'promo' : 'standard'];
        price.textContent = '€' + amount + (promo ? ' · PROMO' : '') + (isEnglish ? ' per person' : ' per persona');
      });
      const chosen = stayChoices.find(input => input.checked);
      const nights = chosen && chosen.dataset.nights === '3' ? 3 : 2;
      const activeHotel = Boolean(chosen && chosen.dataset.noRoom !== 'true');
      const earlyBird = Date.now() < earlyBirdEnd;
      const context = section.querySelector('.room-price-context');
      if (context) {
        context.textContent = activeHotel
          ? (isEnglish ? 'Per-person prices · ' + nights + '-night stay' : 'Prezzi per persona · soggiorno di ' + nights + ' notti')
          : (isEnglish ? 'Select your stay dates to book a hotel package.' : 'Seleziona le date per prenotare un pacchetto hotel.');
      }
      rooms.forEach(card => {
        const suffix = nights === 3 ? 'Three' : 'Two';
        const early = Number(card.dataset['early' + suffix]);
        const regular = Number(card.dataset['full' + suffix]);
        if (!Number.isFinite(early) || !Number.isFinite(regular)) return;
        const main = card.querySelector('.btf-current-price');
        const old = card.querySelector('.btf-old-price');
        const oldAmount = old && old.querySelector('s');
        const length = card.querySelector('.btf-nights-label');
        if (main) {
          main.textContent = '€' + (earlyBird ? early : regular);
          main.dataset.rateLabel = earlyBird ? 'PROMO' : (isEnglish ? 'PRICE' : 'PREZZO');
        }
        if (oldAmount) oldAmount.textContent = '€' + regular;
        if (old) old.hidden = !earlyBird;
        if (length) length.textContent = nights + (isEnglish ? ' nights' : ' notti');
      });
    }

    stayChoices.forEach(input => input.addEventListener('change', displayRates));
    section.querySelectorAll('input[name="camera"]').forEach(input => input.addEventListener('change', displayRates));
    section.addEventListener('change', displayRates);
    window.addEventListener('pageshow', displayRates);
    window.addEventListener('focus', displayRates);
    displayRates();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();