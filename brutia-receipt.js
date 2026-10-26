/* Confirm only a durable backend commit; legacy receipt links remain supported. */
(() => {
  const root = document.querySelector('[data-registration-receipt]');
  if (!root) return;
  const en = root.dataset.lang === 'en';
  const proof = new URLSearchParams(location.hash.slice(1));
  const request = proof.get('request'), token = proof.get('token'), receipt = proof.get('receipt');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let attempt = 0;
  function complete(saved) {
    root.querySelector('h1').textContent = saved ? (en ? 'Request received.' : 'Richiesta ricevuta.') : (en ? 'Outcome unverified.' : 'Esito da verificare.');
    root.querySelector('[data-receipt-message]').textContent = saved ? (en ? 'Thank you for submitting your registration request. We will check availability and send you confirmation with payment instructions.' : 'Grazie per aver inviato la tua richiesta di iscrizione. Verificheremo la disponibilità e ti invieremo la conferma con le istruzioni per il pagamento.') : (en ? 'Verification is temporarily unavailable. Reload this page to check again, or contact pepertango@gmail.com before submitting again.' : 'Verifica temporaneamente non disponibile. Ricarica questa pagina per riprovare oppure contatta pepertango@gmail.com prima di un nuovo invio.');
    root.dataset.receiptStatus = saved ? 'confirmed' : 'unknown';
    if (saved) {
      try { sessionStorage.removeItem('btf27-request-v1'); } catch {}
      window.btfVerifiedReceipt = request || receipt;
      window.dispatchEvent(new CustomEvent('btf:registration-confirmed', { detail: { receipt: request || receipt } }));
    } else window.dispatchEvent(new Event('btf:registration-status-unknown'));
  }
  function check() {
    if (!(uuid.test(request || '') && uuid.test(token || '')) && !uuid.test(receipt || '')) { complete(false); return; }
    const modern = uuid.test(request || '') && uuid.test(token || '');
    const callback = (modern ? 'btfStatus_' : 'btfReceipt_') + crypto.randomUUID().replaceAll('-', '');
    const script = document.createElement('script');
    const url = new URL(root.dataset.receiptEndpoint);
    let done = false;
    function settle(result) {
      if (done) return; done = true; clearTimeout(timer); script.remove(); window[callback] = () => {};
      if (result?.ok === true && (!modern || result.saved === true)) complete(true);
      else if (++attempt < 3) setTimeout(check, 2000);
      else complete(false);
    }
    const timer = setTimeout(() => settle(null), 12000);
    window[callback] = settle; script.onerror = () => settle(null); script.referrerPolicy = 'no-referrer';
    url.search = new URLSearchParams(modern ? { action: 'requestStatus', request_id: request, request_token: token, callback } : { action: 'registrationReceipt', token: receipt, callback }).toString();
    script.src = url.href; document.head.append(script);
  }
  check();
})();
