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

    // Use 19-21 February as the initial comparison, matching the approved preview.
    // Never override a visitor's restored or explicitly selected stay.
    if (!stayChoices.some(input => input.checked)) {
      dateChoices[0].checked = true;
      dateChoices[0].dispatchEvent(new Event('change', { bubbles: true }));
    }

    stayChoices.forEach(input => input.addEventListener('change', displayRates));
    section.querySelectorAll('input[name="camera"]').forEach(input => input.addEventListener('change', displayRates));
    window.addEventListener('pageshow', displayRates);
    displayRates();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();