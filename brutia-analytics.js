/* Brutia Tango Fest 2027: analytics only after explicit visitor consent. */
(() => {
  const root = document.getElementById('btf-analytics-controls');
  if (!root) return;
  const measurementId = root.dataset.measurementId || '';
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return;
  const storageKey = 'btf27_analytics_consent_v1';
  const banner = root.querySelector('[data-btf-consent-banner]');
  const manage = root.querySelector('[data-btf-consent-manage]');
  const yes = root.querySelector('[data-btf-consent-accept]');
  const no = root.querySelector('[data-btf-consent-reject]');
  let enabled = false;
  let verifiedReceipt = typeof window.btfVerifiedReceipt === 'string' ? window.btfVerifiedReceipt : '';
  const reported = new Set();
  function storedChoice() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }
  function remember(choice) {
    try { localStorage.setItem(storageKey, choice); } catch { /* consent only for this page */ }
  }
  function viewBanner(show) {
    banner.hidden = !show;
    manage.hidden = show;
  }
  function enableAnalytics() {
    if (enabled) return;
    enabled = true;
    window['ga-disable-' + measurementId] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    // Remove arbitrary URL parameters, including registration fields or personal data.
    // Keep only tightly validated UTM campaign labels to measure Facebook/Instagram traffic.
    const config = {
      page_location: location.origin + location.pathname,
      page_referrer: '',
      cookie_prefix: 'btf27',
      cookie_domain: 'none',
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    };
    const utms = new URLSearchParams(location.search);
    const campaignKeys = [
      ['utm_source', 'campaign_source'],
      ['utm_medium', 'campaign_medium'],
      ['utm_campaign', 'campaign_name']
    ];
    for (const [queryKey, configKey] of campaignKeys) {
      const value = utms.get(queryKey);
      if (value && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)) {
        config[configKey] = value;
      }
    }
    // The source domain can be used for attribution, without referrer query parameters.
    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (['https:', 'http:'].includes(referrer.protocol)) {
          config.page_referrer = referrer.origin;
        }
      } catch { /* ignore malformed referrer */ }
    }
    window.gtag('config', measurementId, config);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.append(script);
    reportVerifiedReceipt();
  }
  function event(name, values = {}) {
    if (enabled && typeof window.gtag === 'function') window.gtag('event', name, values);
  }
  function choose(choice) {
    remember(choice);
    viewBanner(false);
    if (choice === 'yes') enableAnalytics();
    else if (enabled) {
      enabled = false;
      window['ga-disable-' + measurementId] = true;
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      // Remove only Brutia-specific first-party GA cookies, never other PeperTango cookies.
      document.cookie.split(';').forEach((entry) => {
        const name = entry.trim().split('=')[0];
        if (/^btf27[_-]/.test(name)) {
          document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
        }
      });
      // Stop the previously loaded library; it is never injected without consent.
      window.location.reload();
    }
  }
  yes.addEventListener('click', () => choose('yes'));
  no.addEventListener('click', () => choose('no'));
  manage.addEventListener('click', () => viewBanner(true));
  const choice = storedChoice();
  if (choice === 'yes') { enableAnalytics(); viewBanner(false); }
  else viewBanner(choice !== 'no');
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    try {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.hash !== '#registration-form') return;
      event('registration_cta_click', {
        cta_position: link.closest('header') ? 'header' : link.closest('.hero') ? 'hero' : 'other'
      });
    } catch { /* ignore malformed or script URLs */ }
  });
  document.addEventListener('submit', (e) => {
    if (e.target && e.target.matches('form[name="brutia-iscrizione"]')) {
      event('registration_form_submit_attempt');
    }
  }, true);
  let started = false;
  document.addEventListener('input', (e) => {
    if (!started && e.target.closest && e.target.closest('form[name="brutia-iscrizione"]')) {
      started = true;
      event('registration_form_start');
    }
  });
  document.addEventListener('invalid', (e) => {
    if (e.target.closest && e.target.closest('form[name="brutia-iscrizione"]')) event('registration_validation_error');
  }, true);
  document.addEventListener('btf:registration-validation-error', () => event('registration_validation_error'));
  document.addEventListener('btf:registration-submit', () => event('registration_submit'));
  window.addEventListener('btf:registration-status-unknown', () => event('registration_status_unknown'));
  function reportVerifiedReceipt() {
    if (!enabled || !verifiedReceipt) return;
    const key = 'btf27_success_' + verifiedReceipt;
    if (reported.has(key)) return;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* deduplicate this page in memory */ }
    }
    reported.add(key);
    event('registration_success');
  }
  window.addEventListener('btf:registration-confirmed', (e) => {
    if (!e.detail || typeof e.detail.receipt !== 'string' || !e.detail.receipt) return;
    verifiedReceipt = e.detail.receipt;
    reportVerifiedReceipt();
  });
  if (/^\/(?:en\/)?grazie\/?$/.test(location.pathname)) {
    event('registration_thank_you_view');
  }
})();
