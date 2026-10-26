/* Optional marketing measurement. Existing analytics consent is never marketing consent. */
(() => {
  const root = document.getElementById('btf-analytics-controls');
  if (!root || root.querySelector('[data-btf-marketing-consent]')) return;
  const en = document.documentElement.lang === 'en';
  const key = 'btf27_marketing_consent_v1';
  const banner = root.querySelector('[data-btf-consent-banner]');
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.btfMarketingConsent = '';
  label.append(checkbox, document.createTextNode(en
    ? 'Optional marketing cookies: Meta Pixel measures visits and completed registrations for advertising. No form details are shared. Leave unchecked to refuse.'
    : 'Cookie marketing facoltativi: Meta Pixel misura visite e iscrizioni salvate per la pubblicità. Nessun dato del modulo viene condiviso. Lascia deselezionato per rifiutare.'));
  (root.querySelector('.btf-consent-copy') || banner).append(label);
  let granted = false, frame = null, ready = false, loaded = false, pageViewed = false;
  let receipt = typeof window.btfVerifiedReceipt === 'string' ? window.btfVerifiedReceipt : '';
  const reported = new Set();
  function stored() { try { return localStorage.getItem(key) === 'yes'; } catch { return false; } }
  function send(name, eventID) {
    if (granted && ready && frame?.contentWindow) frame.contentWindow.postMessage({type:'btf-meta-event', name, eventID}, location.origin);
  }
  async function lead() {
    if (!granted || !ready || !/^[a-f0-9-]{36}$/i.test(receipt) || !navigator.locks || !crypto.subtle) return;
    const value = receipt;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    const marker = 'btf27_meta_lead_' + fingerprint;
    // Fail closed if durable deduplication is unavailable; never substitute a form event.
    await navigator.locks.request(marker, () => {
      if (!granted || !ready || receipt !== value || reported.has(marker)) return;
      try {
        if (localStorage.getItem(marker)) return;
        localStorage.setItem(marker, '1');
      } catch { return; }
      reported.add(marker);
      send('Lead', 'btf-' + fingerprint);
    });
  }
  function disable() {
    granted = false; ready = false;
    frame?.remove(); frame = null;
    // Remove Meta cookies at host and parent-domain scopes after revocation.
    for (const name of ['_fbp','_fbc']) {
      document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax';
      const parts = location.hostname.split('.');
      for (let i=0; i<parts.length-1; i++) document.cookie = name + '=; Max-Age=0; Path=/; Domain=.' + parts.slice(i).join('.') + '; SameSite=Lax';
    }
  }
  function enable() {
    if (!loaded || !granted || frame) return;
    // A clean, form-free document prevents URL capabilities, referrers and form PII
    // from entering the Pixel's automatic document context.
    frame = document.createElement('iframe');
    frame.dataset.btfMeta = '';
    frame.hidden = true;
    frame.title = en ? 'Optional marketing measurement' : 'Misurazione marketing facoltativa';
    frame.referrerPolicy = 'no-referrer';
    frame.onload = () => {
      if (granted && frame?.contentWindow) frame.contentWindow.postMessage({type:'btf-meta-grant'}, location.origin);
    };
    frame.src = '/brutia-meta-frame.html';
    document.body.append(frame);
  }
  function choose(yes) {
    checkbox.checked = yes;
    try { localStorage.setItem(key, yes ? 'yes' : 'no'); } catch {}
    if (yes) { granted = true; enable(); } else disable();
  }
  root.querySelector('[data-btf-consent-accept]').addEventListener('click', () => choose(checkbox.checked));
  root.querySelector('[data-btf-consent-reject]').addEventListener('click', () => choose(false));
  window.addEventListener('message', event => {
    if (!granted || !frame || event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'btf-meta-ready' || ready) return;
    ready = true;
    if (!pageViewed) { send('PageView'); pageViewed = true; }
    void lead();
  });
  window.addEventListener('btf:registration-confirmed', event => {
    if (typeof event.detail?.receipt !== 'string') return;
    receipt = event.detail.receipt;
    void lead();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    // Another tab can revoke, but cannot silently grant consent in this page.
    if (!stored()) { checkbox.checked = false; disable(); }
  });
  granted = stored(); checkbox.checked = granted;
  // Existing visitors see the new marketing choice even when GA was already accepted.
  function start() {
    loaded = true;
    try { if (localStorage.getItem(key) === null) { banner.hidden = false; root.querySelector('[data-btf-consent-manage]').hidden = true; } } catch {}
    enable();
  }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
