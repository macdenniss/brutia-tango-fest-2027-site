/* Keep the native POST and its validated payload; guard only repeated submissions. */
(() => {
  const form = document.querySelector('form[name="brutia-iscrizione"]');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  const english = document.documentElement.lang === 'en';
  const label = button.textContent;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  button.insertAdjacentElement('afterend', notice);
  let pending = false;
  let timer;
  function reset() {
    if (!pending) return;
    pending = false;
    clearTimeout(timer);
    button.disabled = false;
    button.textContent = label;
    form.removeAttribute('aria-busy');
    notice.textContent = '';
  }
  document.addEventListener('submit', (event) => {
    if (event.target !== form) return;
    if (pending) { event.preventDefault(); return; }
    if (event.defaultPrevented) {
      document.dispatchEvent(new Event('btf:registration-validation-error'));
      return;
    }
    pending = true;
    button.disabled = true;
    button.textContent = english ? 'Sending…' : 'Invio in corso…';
    form.setAttribute('aria-busy', 'true');
    notice.textContent = english ? 'Please wait for the result.' : 'Attendi l’esito dell’invio.';
    document.dispatchEvent(new Event('btf:registration-submit'));
    timer = setTimeout(() => {
      reset();
      notice.textContent = english
        ? 'The result is uncertain. Keep your details and check with PeperTango before changing your request. Retrying identical details does not create another registration.'
        : 'Esito incerto. Conserva i dati e verifica con PeperTango prima di cambiare la richiesta. Riprovare con gli stessi dati non crea una nuova iscrizione.';
      window.dispatchEvent(new Event('btf:registration-status-unknown'));
    }, 30000);
  });
  window.addEventListener('pageshow', reset);
})();
