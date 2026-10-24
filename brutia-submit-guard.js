/* Anonymous POST: preserve the filled form and verify persistence independently of the response. */
(() => {
  const form = document.querySelector('form[name="brutia-iscrizione"]');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !button) return;
  const english = document.documentElement.lang === 'en';
  const label = button.textContent;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  button.insertAdjacentElement('afterend', notice);
  const storageKey = 'btf-pending-registration';
  let current;
  try { current = JSON.parse(sessionStorage.getItem(storageKey) || sessionStorage.getItem('btf27-request-v1') || 'null'); } catch {}
  let pending = false;
  let timer;
  let snapshot;
  let retryAllowed = false;
  const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
  if (current && (!uuid(current.request_id) || !uuid(current.request_token))) current = null;
  function busy(value) {
    pending = value;
    button.disabled = value;
    button.textContent = value ? (english ? 'Checking…' : 'Verifica in corso…') : label;
    if (value) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }
  function confirmed() {
    clearTimeout(timer);
    try { sessionStorage.setItem('btf-verified-request', current.request_id); sessionStorage.removeItem(storageKey); sessionStorage.removeItem('btf27-request-v1'); } catch {}
    const target = document.documentElement.lang === 'en' ? '/en/grazie' : '/grazie';
    location.assign(target + '#' + new URLSearchParams({request_id: current.request_id, request_token: current.request_token}));
  }
  function check(attempt = 0) {
    if (!current) return;
    const checkedRequest = current;
    const callback = 'btfStatus_' + crypto.randomUUID().replaceAll('-', '');
    const script = document.createElement('script');
    let settled = false;
    function finish(saved) {
      if (settled) return;
      settled = true;
      if (current === checkedRequest) clearTimeout(timer);
      script.remove();
      // A late response from Google is harmless even after timeout.
      window[callback] = () => {};
      setTimeout(() => { delete window[callback]; }, 60000);
      if (current !== checkedRequest) return;
      if (saved) { confirmed(); return; }
      if (attempt < 3) { timer = setTimeout(() => check(attempt + 1), 3000); return; }
      busy(false);
      retryAllowed = !!snapshot;
      notice.textContent = english
        ? 'Result still unverified. Your details are retained. Press Send to retry the same request safely; no duplicate registration will be created.'
        : 'Esito ancora da verificare. I dati sono conservati. Premi Invia per riprovare la stessa richiesta: non verrà creata una doppia iscrizione.';
      window.dispatchEvent(new Event('btf:registration-status-unknown'));
    }
    window[callback] = result => finish(result?.ok === true && result?.saved === true);
    const url = new URL(form.action);
    url.search = new URLSearchParams({action:'requestStatus', callback, request_id:current.request_id, request_token:current.request_token, protocol:'2'});
    script.crossOrigin = 'anonymous';
    script.src = url.href;
    script.referrerPolicy = 'no-referrer';
    script.onerror = () => finish(false);
    timer = setTimeout(() => finish(false), 15000);
    document.head.append(script);
  }
  function reject(result, checkedRequest) {
    if (current !== checkedRequest || result?.ok !== false || result?.definitive !== true) return;
    clearTimeout(timer);
    current = null;
    snapshot = null;
    retryAllowed = false;
    try { sessionStorage.removeItem(storageKey); sessionStorage.removeItem('btf27-request-v1'); } catch {}
    busy(false);
    notice.textContent = result.error || (english ? 'Please check your details.' : 'Verifica i dati inseriti.');
  }
  function post() {
    const checkedRequest = current;
    // A simple URL-encoded request avoids preflight. Omitting cookies also avoids Google's multi-login routing.
    fetch(form.action, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      body: new URLSearchParams({payload: snapshot})
    }).then(response => response.json()).then(result => reject(result, checkedRequest)).catch(() => {});
    // A lost or unreadable response is not a failed save: polling remains authoritative.
  }
  document.addEventListener('submit', event => {
    if (event.target !== form) return;
    if (pending) { event.preventDefault(); return; }
    if (event.defaultPrevented) return;
    // A retry reuses the immutable payload and capability; edited fields cannot create a second request.
    if (current) {
      if (!retryAllowed || !snapshot) { event.preventDefault(); busy(true); check(); return; }
      event.preventDefault();
      form.querySelector('input[name="payload"]').value = snapshot;
      retryAllowed = false;
      busy(true);
      timer = setTimeout(() => check(), 2000);
      post();
      return;
    }
    const payloadInput = form.querySelector('input[name="payload"]');
    let payload;
    try { payload = JSON.parse(payloadInput.value); } catch { event.preventDefault(); return; }
    current = {request_id:crypto.randomUUID(), request_token:crypto.randomUUID()};
    Object.assign(payload, current);
    payloadInput.value = JSON.stringify(payload);
    snapshot = payloadInput.value;
    try { sessionStorage.setItem(storageKey, JSON.stringify(current)); } catch {}
    event.preventDefault();
    busy(true);
    notice.textContent = english ? 'Please wait for the saved request to be verified.' : 'Attendi la verifica della richiesta salvata.';
    document.dispatchEvent(new Event('btf:registration-submit'));

    timer = setTimeout(() => check(), 2000);
    post();
  });
  window.addEventListener('pageshow', () => {
    if (current && !pending) { busy(true); check(); }
  });
})();
