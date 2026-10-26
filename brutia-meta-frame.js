/* This document contains no form data, request capabilities, or incoming referrer. */
(() => {
  if (parent === window || location.search || location.hash || document.referrer) return;
  let initialized = false;
  window.addEventListener('message', event => {
    if (initialized || event.origin !== location.origin || event.source !== parent || event.data?.type !== 'btf-meta-grant') return;
    initialized = true;
    initialize();
  });
  function initialize() {
  const pixel = '1124515086624893';
  const fbq = window.fbq = function () {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  };
  window._fbq = fbq;
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  fbq('set', 'autoConfig', false, pixel);
  fbq('consent', 'grant');
  fbq('init', pixel);
  let viewed = false;
  const leads = new Set();
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'btf-meta-event') return;
    const {name,eventID} = event.data;
    if (name === 'PageView' && !viewed) { viewed = true; fbq('track', 'PageView'); }
    if (name === 'Lead' && /^btf-[a-f0-9]{64}$/.test(eventID || '') && !leads.has(eventID)) {
      leads.add(eventID);
      fbq('trackSingle', pixel, 'Lead', {}, {eventID});
    }
  });
  const script = document.createElement('script');
  script.async = true; script.referrerPolicy = 'no-referrer';
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onload = () => parent.postMessage({type:'btf-meta-ready'}, location.origin);
  document.head.append(script);
  }
})();
