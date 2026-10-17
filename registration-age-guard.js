(() => {
  const form = document.querySelector('.booking-form');
  const birth = form?.querySelector('[name="data_nascita"]');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !birth || !button) return;
  let held = false;
  let previouslyDisabled = false;
  function adult() {
    if (!birth.value) return true;
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
    const birthday = String(Number(birth.value.slice(0, 4)) + 18).padStart(4, '0') + birth.value.slice(4);
    return birthday <= today;
  }
  function refresh() {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
    const year = Number(today.slice(0, 4)) - 18;
    let cutoff = String(year).padStart(4, '0') + today.slice(4);
    if (cutoff.endsWith('-02-29') && new Date(cutoff + 'T00:00:00Z').getUTCMonth() !== 1) cutoff = year + '-02-28';
    birth.max = cutoff;
    if (!adult()) {
      if (!held) previouslyDisabled = button.disabled;
      held = true;
      if (!button.disabled) button.disabled = true;
    } else if (held) {
      held = false;
      button.disabled = previouslyDisabled;
    }
  }
  birth.addEventListener('input', refresh);
  birth.addEventListener('change', refresh);
  birth.addEventListener('invalid', event => {
    if (!adult()) event.preventDefault();
  });
  form.addEventListener('submit', event => {
    refresh();
    if (!adult()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  new MutationObserver(refresh).observe(button, { attributes: true, attributeFilter: ['disabled'] });
  refresh();
})();
