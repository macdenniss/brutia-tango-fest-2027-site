/* Keep one immutable request until Google has verified its saved state. */
(() => {
  const form = document.querySelector('form[name="brutia-iscrizione"]');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !button) return;
  const english = document.documentElement.lang === 'en';
  const label = button.textContent;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  button.insertAdjacentElement('beforebegin', notice);
  const storageKey = 'btf-pending-registration';
  const payloadKey = 'btf-pending-registration-payload';
  const legacyKey = 'btf27-request-v1';
  const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
  let current = null, snapshot = null, pending = false, timer, postTimer, postController, cancelStatus;
  let generation = 0, connectionProblem = false;
  const copy = (it, en) => english ? en : it;
  function show(errors, title) {
    if (form.btfValidation) form.btfValidation.show(errors, title);
    else {
      notice.textContent = errors.map(error => error.message).join(' ');
      notice.setAttribute('role', 'alert');
      notice.setAttribute('tabindex', '-1');
      notice.focus?.();
    }
  }
  function busy(value) {
    pending = value;
    button.disabled = value;
    button.textContent = value ? copy('Invio in corso…', 'Sending…') : label;
    if (value) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }
  function remember() {
    form.dataset.btfPendingRequest = current ? 'true' : 'false';
    try {
      if (current) sessionStorage.setItem(storageKey, JSON.stringify(current));
      if (snapshot) sessionStorage.setItem(payloadKey, snapshot);
    } catch { /* The request remains available in memory if browser storage is unavailable. */ }
  }
  function forget() {
    current = null;
    snapshot = null;
    form.dataset.btfPendingRequest = 'false';
    try { [storageKey, payloadKey, legacyKey].forEach(key => sessionStorage.removeItem(key)); } catch {}
  }
  try {
    const restored = JSON.parse(sessionStorage.getItem(storageKey) || sessionStorage.getItem(legacyKey) || 'null');
    if (restored && uuid(restored.request_id) && uuid(restored.request_token)) {
      current = {request_id: restored.request_id, request_token: restored.request_token};
      const raw = sessionStorage.getItem(payloadKey) || (typeof restored.payload === 'string' ? restored.payload : null);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && !Array.isArray(data) && data.request_id === current.request_id && data.request_token === current.request_token) snapshot = raw;
      }
    }
  } catch { /* Invalid browser storage must never cause a second submission. */ }
  remember();
  function stop() {
    generation += 1;
    clearTimeout(timer);
    clearTimeout(postTimer);
    cancelStatus?.();
    cancelStatus = null;
    postController?.abort();
    postController = null;
  }
  function confirmed() {
    const verified = current;
    stop();
    busy(false);
    button.disabled = true;
    button.textContent = copy('Richiesta ricevuta', 'Request received');
    notice.textContent = button.textContent;
    try { sessionStorage.setItem('btf-verified-request', verified.request_id); } catch {}
    forget();
    const target = english ? '/en/grazie' : '/grazie';
    location.assign(target + '#' + new URLSearchParams(verified));
  }
  function uncertain() {
    stop();
    busy(false);
    notice.textContent = '';
    const message = !snapshot
      ? copy('Non possiamo ancora verificare la richiesta precedente. I dati originali non sono disponibili per un reinvio sicuro: riprova la verifica o contatta pepertango@gmail.com. Non inviare una nuova iscrizione.', 'We cannot yet verify the previous request. Its original details are unavailable for a safe retry: check again or contact pepertango@gmail.com. Do not submit a new registration.')
      : connectionProblem
        ? copy('Problema di connessione: non possiamo ancora verificare se la richiesta è stata salvata. I dati sono conservati. Premi Invia per verificarla e, solo se necessario, reinviare la stessa richiesta senza duplicati.', 'Connection problem: we cannot yet verify whether your request was saved. Your details are retained. Press Send to check it and, only if necessary, retry the same request without duplicates.')
        : copy('Esito ancora da verificare. I dati sono conservati. Premi Invia: controlleremo prima il salvataggio e reinvieremo la stessa richiesta soltanto se necessario, senza duplicati.', 'Result not yet verified. Your details are retained. Press Send: we will check whether it was saved before retrying the same request if needed, without duplicates.');
    show([{message}]);
    window.dispatchEvent(new Event('btf:registration-status-unknown'));
  }
  function serverErrors(result) {
    if (result.code === 'already_registered') return [{message: copy('Questa iscrizione risulta già registrata. Non è stata creata una nuova richiesta. Per assistenza scrivi a pepertango@gmail.com.', 'This registration is already on file. No new request was created. For assistance, email pepertango@gmail.com.')}];
    const text = String(result.error || '');
    if (/Campi obbligatori mancanti:/i.test(text)) {
      const labels = {nome:['nome','first name'],cognome:['cognome','last name'],data_nascita:['data di nascita','date of birth'],email:['email','email'],telefono:['telefono','phone number'],citta:['città','city'],genere:['genere','gender'],ruolo:['ruolo','dance role'],tipo_iscrizione:['tipologia di iscrizione','registration type'],privacy:['consenso privacy','privacy consent']};
      const errors = text.split(':').slice(1).join(':').split(',').map(name => name.trim()).filter(name => labels[name]).map(name => ({name,message:copy('Completa il campo ' + labels[name][0] + '.', 'Complete the ' + labels[name][1] + ' field.')}));
      if (errors.length) return errors;
    }
    const rules = [
      [/email/i, 'email', 'Inserisci un indirizzo email valido.', 'Enter a valid email address.'],
      [/telefon|phone/i, 'telefono', 'Inserisci un numero di telefono valido.', 'Enter a valid phone number.'],
      [/18 anni|18 years/i, 'data_nascita', 'Per iscriverti devi avere già compiuto 18 anni.', 'You must be at least 18 years old to register.'],
      [/nascita|birth/i, 'data_nascita', 'Inserisci una data di nascita completa, esistente e non futura.', 'Enter a complete, valid date of birth that is not in the future.'],
      [/privacy/i, 'privacy', 'Accetta l’informativa privacy per inviare la richiesta.', 'Accept the privacy notice to send your request.'],
      [/genere/i, 'genere', 'Seleziona il genere.', 'Select your gender.'],
      [/ruolo/i, 'ruolo', 'Seleziona il ruolo di ballo.', 'Select your dance role.'],
      [/tipologia/i, 'tipo_iscrizione', 'Scegli la tipologia di iscrizione.', 'Choose your registration type.'],
      [/Partner di ballo/i, 'partner_ballo', 'Controlla la tipologia di iscrizione e il partner di ballo.', 'Check the registration type and dance partner.'],
      [/sovrapp|overlap|già inclusi/i, 'pacchetto', 'Le attività selezionate sono incompatibili o già incluse: correggi la scelta di seminario e lezioni.', 'The selected activities conflict or are already included: correct your seminar and class choices.'],
      [/formula|lezione|seminario|seleziona almeno/i, 'pacchetto', 'Scegli un pass, il seminario o almeno una lezione valida.', 'Choose a pass, the seminar or at least one valid class.'],
      [/arrivo|partenza|soggiorno|notti/i, 'camera', 'Correggi il soggiorno: arrivo 19 febbraio e partenza 21 o 22 febbraio 2027.', 'Correct your stay: arrival February 19 and departure February 21 or 22, 2027.'],
      [/camera|condivisione/i, 'camera', 'Controlla la camera, la condivisione e i nomi dei compagni di camera.', 'Check the room, room-sharing option and roommate names.'],
      [/sicurezza|identificativo|dati diversi/i, null, 'Non è possibile riutilizzare questa richiesta con dati diversi. Ricarica la pagina e riprova la verifica; se il problema continua contatta pepertango@gmail.com.', 'This request cannot be reused with different details. Reload and check again; if the problem continues, contact pepertango@gmail.com.'],
    ];
    const match = rules.find(rule => rule[0].test(text));
    if (match) return [{name: match[1] || undefined, message: copy(match[2], match[3])}];
    return [{message: copy('Il servizio non ha accettato la richiesta. Controlla i dati prima di riprovare; se il problema continua scrivi a pepertango@gmail.com.', 'The service did not accept your request. Check your details before trying again. If the problem continues, email pepertango@gmail.com.')}];
  }
  function reject(result, checkedRequest, initialAttempt = false) {
    if (current !== checkedRequest || result?.ok !== false || result.definitive !== true) return;
    // Only these initial POST rejections prove refusal before a write; recovery can refer to an earlier write.
    if (!initialAttempt || !['invalid_registration', 'already_registered'].includes(result.code)) {
      uncertain();
      return;
    }
    stop();
    forget();
    busy(false);
    notice.textContent = '';
    show(serverErrors(result));
  }
  function post(initialAttempt = false) {
    const checkedRequest = current;
    const turn = generation;
    postController = new AbortController();
    postTimer = setTimeout(() => postController?.abort(), 45000);
    fetch(form.action, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      body: new URLSearchParams({payload: snapshot}), signal: postController.signal,
    }).then(response => {
      if (!response.ok) throw new Error('http');
      return response.json();
    }).then(result => {
      if (turn !== generation || current !== checkedRequest) return;
      if (result?.ok === true && result.saved === true && result.request_id === checkedRequest.request_id) confirmed();
      else reject(result, checkedRequest, initialAttempt);
    }).catch(() => {
      if (turn !== generation || current !== checkedRequest) return;
      connectionProblem = true;
      notice.textContent = copy('La risposta non è arrivata. Stiamo verificando il salvataggio; conserva questa pagina aperta.', 'The response did not arrive. We are checking whether the request was saved; keep this page open.');
    }).finally(() => {
      if (turn === generation) clearTimeout(postTimer);
    });
  }
  function check(attempt = 0, replayIfMissing = false) {
    if (!current) return;
    const checkedRequest = current;
    const turn = generation;
    const callback = 'btfStatus_' + crypto.randomUUID().replaceAll('-', '');
    const script = document.createElement('script');
    let settled = false;
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.remove();
      window[callback] = () => {};
      setTimeout(() => { delete window[callback]; }, 60000);
      if (turn !== generation || current !== checkedRequest) return;
      cancelStatus = null;
      if (result?.ok === true && result.saved === true) { confirmed(); return; }
      if (result?.ok === false && result.definitive === true) { reject(result, checkedRequest); return; }
      if (result?.ok === true && result.saved === false && replayIfMissing && snapshot) {
        notice.textContent = copy('Verifica completata: reinvio della stessa richiesta in corso…', 'Check completed: retrying the same request…');
        post();
        timer = setTimeout(() => check(), 2000);
        return;
      }
      if (!result || result.ok !== true || typeof result.saved !== 'boolean') connectionProblem = true;
      if (attempt < 3) { timer = setTimeout(() => check(attempt + 1, replayIfMissing), 3000); return; }
      uncertain();
    }
    cancelStatus = () => { settled = true; script.remove(); window[callback] = () => {}; setTimeout(() => { delete window[callback]; }, 60000); };
    window[callback] = finish;
    const url = new URL(form.action);
    url.search = new URLSearchParams({action: 'requestStatus', callback, request_id: current.request_id, request_token: current.request_token, protocol: '2'});
    script.crossOrigin = 'anonymous';
    script.src = url.href;
    script.referrerPolicy = 'no-referrer';
    script.onerror = () => finish(null);
    timer = setTimeout(() => finish(null), 15000);
    document.head.append(script);
  }
  function retry() {
    if (pending) return;
    form.btfValidation?.clear();
    connectionProblem = false;
    busy(true);
    notice.textContent = copy('Verifichiamo prima se la richiesta precedente è stata salvata…', 'First checking whether your previous request was saved…');
    check(0, true);
  }
  // A pending request is immutable: changed/empty visible fields must not replace it on recovery.
  form.addEventListener('submit', event => {
    if (!current) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    retry();
  }, true);
  document.addEventListener('submit', event => {
    if (event.target !== form) return;
    if (pending) { event.preventDefault(); return; }
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (form.btfValidation && !form.btfValidation.validate()) return;
    const payloadInput = form.querySelector('input[name="payload"]');
    let payload;
    try {
      payload = JSON.parse(payloadInput?.value || '');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload');
    } catch {
      show([{message: copy('Il modulo non ha preparato i dati per l’invio. I campi compilati sono conservati. Ricarica la pagina e riprova; se il problema continua scrivi a pepertango@gmail.com.', 'The form could not prepare your request. Your entered details are retained. Reload and try again; if the problem continues, email pepertango@gmail.com.')}]);
      return;
    }
    form.btfValidation?.clear();
    current = {request_id: crypto.randomUUID(), request_token: crypto.randomUUID()};
    Object.assign(payload, current);
    snapshot = JSON.stringify(payload);
    payloadInput.value = snapshot;
    remember();
    connectionProblem = false;
    busy(true);
    notice.textContent = copy('Invio in corso. Attendi la verifica del salvataggio.', 'Sending. Please wait while we verify that your request was saved.');
    document.dispatchEvent(new Event('btf:registration-submit'));
    timer = setTimeout(() => check(), 2000);
    post(true);
  });
  window.addEventListener('pageshow', () => {
    if (current && !pending) {
      busy(true);
      notice.textContent = copy('Verifica della richiesta precedente in corso…', 'Checking your previous request…');
      check();
    }
  });
})();
