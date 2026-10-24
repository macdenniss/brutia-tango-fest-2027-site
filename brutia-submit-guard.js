/* Registration transport: durable capability, iframe ACK and read-only reconciliation. */
(() => {
  const form = document.querySelector('form[name="brutia-iscrizione"]');
  if (!form || form.dataset.ackTransport) return;
  form.dataset.ackTransport = '1';
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  const english = document.documentElement.lang === 'en';
  const label = button.textContent;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  button.insertAdjacentElement('afterend', notice);
  const storageKey = 'btf27-request-v1';
  let pending = false, current, polling, started, posts = 0, frame, transport;
  function message(it, en) { notice.textContent = english ? en : it; }
  function finish(saved) {
    pending = false; clearTimeout(polling);
    if (saved) {
      const proof = new URLSearchParams({ request: current.request_id, token: current.request_token });
      window.location.assign((english ? '/en/grazie/' : '/grazie/') + '#' + proof);
      return;
    }
    button.disabled = false; button.textContent = label; form.removeAttribute('aria-busy');
    document.dispatchEvent(new Event('btf:registration-retry-ready'));
    message('Verifica temporaneamente non disponibile. I dati sono conservati: riprova lo stesso invio per verificarlo senza duplicati, oppure contatta pepertango@gmail.com.', 'Verification temporarily unavailable. Your details are preserved: retry the same submission to check it without duplicates, or contact pepertango@gmail.com.');
    window.dispatchEvent(new Event('btf:registration-status-unknown'));
  }
  function status() {
    return new Promise(resolve => {
      const callback = 'btfStatus_' + crypto.randomUUID().replaceAll('-', '');
      const script = document.createElement('script');
      const url = new URL(form.dataset.registrationEndpoint || form.action);
      const cleanup = value => { clearTimeout(timer); script.remove(); window[callback] = () => {}; resolve(value); };
      const timer = setTimeout(() => cleanup(null), 12000);
      window[callback] = result => cleanup(result);
      script.onerror = () => cleanup(null);
      url.search = new URLSearchParams({ action: 'requestStatus', request_id: current.request_id, request_token: current.request_token, callback }).toString();
      script.src = url.href; document.head.append(script);
    });
  }
  function post() {
    if (!frame) {
      frame = document.createElement('iframe'); frame.name = 'btf_ack_' + crypto.randomUUID(); frame.hidden = true;
      transport = document.createElement('form'); transport.hidden = true; transport.method = 'POST'; transport.target = frame.name;
      transport.action = form.dataset.registrationEndpoint || form.action;
      document.body.append(frame, transport);
    }
    transport.replaceChildren();
    for (const [name, value] of Object.entries({ browser_form: '1', receipt_nonce: current.nonce, return_path: english ? '/en/grazie' : '/grazie', payload: JSON.stringify(current.payload) })) {
      const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; transport.append(input);
    }
    posts++; HTMLFormElement.prototype.submit.call(transport);
  }
  async function reconcile() {
    if (!pending) return;
    const result = await status();
    if (!pending) return;
    if (result?.saved === true) { finish(true); return; }
    if (Date.now() - started > 180000) { finish(false); return; }
    // A replay carries the same capability and exact payload, including after a lost ACK.
    if (posts < 3 && Date.now() - started > posts * 45000) post();
    polling = setTimeout(reconcile, 4000);
  }
  async function begin(payload) {
    if (pending) return;
    pending = true; button.disabled = true; button.textContent = english ? 'Sending…' : 'Invio in corso…'; form.setAttribute('aria-busy', 'true');
    message('Invio e verifica iscrizione in corso… Attendi senza chiudere la pagina.', 'Sending and verifying registration… Please keep this page open.');
    try {
      delete payload.request_id; delete payload.request_token; delete payload.receipt_nonce;
      const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(Object.entries(payload).sort())))), x => x.toString(16).padStart(2, '0')).join('');
      let stored = current; try { stored = JSON.parse(sessionStorage.getItem(storageKey)) || stored; } catch {}
      if (stored && stored.fingerprint !== fingerprint) {
        pending = false; button.disabled = false; button.textContent = label; form.removeAttribute('aria-busy');
        document.dispatchEvent(new Event('btf:registration-retry-ready'));
        message('Un invio precedente è ancora da verificare. Ripristina gli stessi dati oppure contatta pepertango@gmail.com prima di modificarlo.', 'A previous submission still needs verification. Restore the same details or contact pepertango@gmail.com before changing it.'); return;
      }
      current = stored || { fingerprint, request_id: crypto.randomUUID(), request_token: crypto.randomUUID() };
      try { sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint: current.fingerprint, request_id: current.request_id, request_token: current.request_token })); } catch { /* In-memory capability still protects retries in this page. */ }
      current.payload = { ...payload, request_id: current.request_id, request_token: current.request_token };
      current.nonce = crypto.randomUUID().replaceAll('-', ''); started = Date.now(); posts = 0;
      document.dispatchEvent(new Event('btf:registration-submit'));
      // A recovered tab first checks its old request; it never invents a new identity.
      if (stored && (await status())?.saved === true) { finish(true); return; }
      post(); polling = setTimeout(reconcile, 4000);
    } catch { finish(false); }
  }
  window.addEventListener('message', event => {
    if (!pending || !current || !/^https:\/\/(?:[a-z0-9-]+[.-])?script\.googleusercontent\.com$/.test(event.origin)) return;
    if (event.data?.type !== 'btf-registration-result' || event.data.nonce !== current.nonce) return;
    if (event.data.ok === true) { finish(true); return; }
    if (event.data.definitive === true) {
      finish(false);
      if (event.data.code === 'already_registered') {
        message('Iscrizione già presente per questo partecipante. Contatta pepertango@gmail.com per verificarla.', 'This participant is already registered. Contact pepertango@gmail.com to check it.');
      } else {
        current = null; try { sessionStorage.removeItem(storageKey); } catch {}
        message('Iscrizione non salvata: verifica i dati del modulo e riprova.', 'Registration not saved: check the form details and try again.');
      }
    }
    // A negative response is reconciled: it cannot undo a durable commit.
  });
  document.addEventListener('btf:registration-ready', event => { void begin(event.detail); });
  document.addEventListener('submit', event => {
    if (event.target !== form) return;
    if (pending) { event.preventDefault(); return; }
    if (event.defaultPrevented) return;
    event.preventDefault();
    try { void begin(JSON.parse(form.querySelector('#registration-payload').value)); }
    catch { message('Dati non pronti: verifica il modulo.', 'Details not ready: check the form.'); }
  });
})();
