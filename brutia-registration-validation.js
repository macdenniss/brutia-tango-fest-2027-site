/* Accessible registration errors; business choices and totals remain in the site module. */
(() => {
  const form = document.querySelector('form[name="brutia-iscrizione"]');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !button) return;
  const en = document.documentElement.lang === 'en';
  const text = (it, english) => en ? english : it;
  const style = document.createElement('style');
  style.textContent = 'form[name="brutia-iscrizione"] [aria-invalid="true"]{outline:2px solid #9b1c31;outline-offset:3px}form[name="brutia-iscrizione"] label:has(>input[aria-invalid="true"]){border-color:#9b1c31}';
  document.head.append(style);
  const names = {
    nome: text('nome', 'first name'), cognome: text('cognome', 'last name'),
    data_nascita: text('data di nascita', 'date of birth'), email: 'email',
    telefono: text('telefono', 'phone number'), citta: text('città', 'city'),
    genere: text('genere', 'gender'), ruolo: text('ruolo di ballo', 'dance role'),
    tipo_iscrizione: text('iscrizione singola o in coppia', 'individual or couple registration'),
    partner_ballo: text('nome del partner di ballo', 'dance partner’s name'),
    condivisione: text('modalità di condivisione della camera', 'room sharing option'),
    partner_camera: text('nome del compagno di camera', 'roommate’s name'),
    partner_camera_2: text('nome del secondo compagno di camera', 'second roommate’s name')
  };
  const summary = document.createElement('div');
  summary.dataset.btfErrorSummary = '';
  summary.hidden = true;
  summary.tabIndex = -1;
  summary.setAttribute('role', 'alert');
  summary.setAttribute('aria-live', 'polite');
  summary.style.cssText = 'grid-column:1/-1;color:#9b1c31;border:1px solid currentColor;border-radius:8px;padding:16px;margin:12px 0;scroll-margin-top:120px';
  button.before(summary);
  let attempted = false;
  const fields = name => [...form.querySelectorAll('[name]')].filter(el => el.name === name);
  const value = name => fields(name).find(el => !el.disabled && (!['radio', 'checkbox'].includes(el.type) || el.checked))?.value.trim() || '';
  const checked = name => fields(name).filter(el => el.checked).map(el => el.value);
  const hostFor = el => ['radio', 'checkbox'].includes(el.type) && el.name !== 'privacy'
    ? el.closest('fieldset') : el.closest('label') || el.parentElement;
  function clear() {
    for (const el of form.querySelectorAll('[data-btf-field-error]')) {
      for (const input of fields(el.dataset.btfFieldError)) {
        input.removeAttribute('aria-invalid');
        const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== el.id);
        if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
        else input.removeAttribute('aria-describedby');
      }
      el.remove();
    }
    summary.hidden = true;
    summary.replaceChildren();
  }
  function show(errors, title, focus = true) {
    clear();
    if (!errors.length) return;
    const heading = document.createElement('strong');
    heading.textContent = title || text('Controlla questi dati prima di inviare:', 'Check these details before submitting:');
    const list = document.createElement('ul');
    list.style.cssText = 'margin:8px 0 0;padding-left:20px';
    let first;
    for (const [index, error] of errors.entries()) {
      const item = document.createElement('li');
      item.textContent = error.message;
      list.append(item);
      const inputs = error.name ? fields(error.name) : [];
      const input = inputs.find(el => !el.disabled && el.type !== 'hidden' && el.getClientRects().length && !el.closest('[hidden]'));
      if (!input) continue;
      const inline = document.createElement('small');
      inline.id = 'btf-field-error-' + index;
      inline.dataset.btfFieldError = error.name;
      inline.textContent = error.message;
      inline.style.cssText = 'display:block;color:#9b1c31;font-size:14px;line-height:1.4;margin-top:8px;font-weight:600';
      hostFor(input).append(inline);
      for (const el of inputs) {
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), inline.id].filter(Boolean).join(' '));
      }
      if (!first) first = input;
    }
    summary.append(heading, list);
    summary.hidden = false;
    if (focus) {
      (first || summary).focus({preventScroll: true});
      (first ? hostFor(first) : summary).scrollIntoView({block: 'center', behavior: 'auto'});
    }
  }
  function collect() {
    const errors = [];
    const add = (name, it, english) => { if (!errors.some(error => error.name === name)) errors.push({name, message: text(it, english)}); };
    const missing = name => add(name, 'Completa il campo: ' + (names[name] || name) + '.', 'Complete: ' + (names[name] || name) + '.');
    for (const name of Object.keys(names)) {
      const group = fields(name).filter(el => !el.disabled);
      if (group.some(el => el.required) && !value(name)) missing(name);
    }
    if (!fields('privacy').some(el => el.checked)) add('privacy', 'Accetta l’informativa privacy per inviare la richiesta.', 'Accept the privacy notice to submit your request.');
    if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) add('email', 'Inserisci un indirizzo email valido, ad esempio nome@dominio.it.', 'Enter a valid email address, for example name@example.com.');
    const phone = value('telefono');
    if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) add('telefono', 'Inserisci un numero di telefono valido, con prefisso e da 7 a 15 cifre.', 'Enter a valid phone number, including the country code and 7 to 15 digits.');
    const birth = value('data_nascita');
    if (birth) {
      const date = new Date(birth + 'T00:00:00Z');
      const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
      const part = kind => parts.find(p => p.type === kind).value;
      const today = part('year') + '-' + part('month') + '-' + part('day');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birth || birth > today) add('data_nascita', 'Inserisci una data di nascita valida, non futura.', 'Enter a valid date of birth that is not in the future.');
      else if ((String(Number(birth.slice(0, 4)) + 18) + birth.slice(4)) > today) add('data_nascita', 'L’iscrizione è riservata ai maggiorenni: verifica la data di nascita.', 'Registration is for adults only: check your date of birth.');
    }
    const room = value('camera');
    const hotel = !!room && room !== 'Nessuna richiesta';
    if (!hotel && !checked('pacchetto').length && !checked('lezioni').length) add('pacchetto', 'Seleziona un pacchetto hotel, il Full Pass Milonga, il seminario o almeno una lezione.', 'Select a hotel package, Full Pass Milonga, the seminar or at least one lesson.');
    if (value('tipo_iscrizione') === 'coppia' && !value('partner_ballo')) missing('partner_ballo');
    if (hotel) {
      const option = fields('camera').find(el => el.checked);
      const departure = option?.dataset.hotelNights === '3' ? '2027-02-22' : '2027-02-21';
      if (value('data_arrivo') !== '2027-02-19' || value('data_partenza') !== departure) add('camera', 'Le date non corrispondono al pacchetto hotel: seleziona nuovamente il pacchetto.', 'The dates do not match the hotel package: select your package again.');
      if (room === 'Doppia' || room === 'Tripla') {
        const sharing = value('condivisione');
        if (!sharing) missing('condivisione');
        if (sharing === 'Compagno/a di camera') {
          if (!value('partner_camera')) missing('partner_camera');
          if (room === 'Tripla' && !value('partner_camera_2')) missing('partner_camera_2');
        }
        if (sharing === 'Cerco compagno/a di camera' && (value('partner_camera') || value('partner_camera_2'))) add('condivisione', 'Scegli se cerchi un compagno di camera oppure indica i compagni già scelti.', 'Choose whether you need a roommate or enter the roommates you have already chosen.');
      }
    }
    return errors;
  }
  function validate(focus = true) {
    const errors = collect();
    show(errors, undefined, focus);
    return !errors.length;
  }
  form.btfValidation = {validate, show, clear};
  form.noValidate = true;
  form.addEventListener('submit', event => {
    if (form.dataset.btfPendingRequest === 'true') return;
    attempted = true;
    if (!validate()) {event.preventDefault(); event.stopImmediatePropagation();}
  }, true);
  for (const type of ['input', 'change']) form.addEventListener(type, () => {
    if (attempted && form.dataset.btfPendingRequest !== 'true') validate(false);
  });
})();
