// Demo page behaviour: status panel, event log, brand switcher. Not part of the kit.
(function () {
  const consentJson = document.getElementById('consent-json');
  const tagsBody = document.getElementById('tags');
  const log = document.getElementById('log');

  function time(date) {
    return date.toLocaleTimeString([], { hour12: false });
  }

  function describe(el) {
    const src = el.getAttribute('data-tc-src') || el.getAttribute('src') || '';
    if (src) return el.tagName.toLowerCase() + ' ' + src.replace(/^https?:\/\//, '');
    return el.tagName.toLowerCase() + ' (inline)';
  }

  function state(el) {
    if (el.hasAttribute('data-tc-activated')) return 'active';
    if (el.getAttribute('data-tc-element') === 'placeholder') return 'placeholder';
    return 'blocked';
  }

  function renderTags() {
    const rows = [];
    document.querySelectorAll('script[data-tc-category], iframe[data-tc-category], img[data-tc-category]').forEach((el) => {
      const s = state(el);
      rows.push(
        '<tr><td>' + describe(el) + (el.hasAttribute('data-tc-auto') ? ' <small>(auto)</small>' : '') + '</td>' +
          '<td>' + el.getAttribute('data-tc-category') + '</td>' +
          '<td><span class="demo-state demo-state--' + s + '">' + s + '</span></td></tr>',
      );
    });
    tagsBody.innerHTML = rows.join('');
  }

  function renderConsent() {
    consentJson.textContent = JSON.stringify(window.TinyConsent.getConsent(), null, 2);
  }

  function renderLog() {
    log.innerHTML = window.__demoEvents
      .map((e) => '<li><time>' + time(e.at) + '</time>' + e.message + '</li>')
      .join('');
    log.scrollTop = log.scrollHeight;
  }

  function refresh() {
    renderConsent();
    renderTags();
    renderLog();
  }

  document.addEventListener('tc:consent', (e) => {
    const c = e.detail;
    window.__demoLog(
      'tc:consent → analytics ' + c.analytics + ', marketing ' + c.marketing + ', personalization ' + c.personalization +
        (c.chosen ? '' : ' (no choice stored yet)'),
    );
    refresh();
  });
  document.addEventListener('tc:block', (e) => {
    window.__demoLog('Blocked by hostname: ' + describe(e.detail.element));
    refresh();
  });
  document.addEventListener('tc:activate', (e) => {
    window.__demoLog('Activated: ' + describe(e.detail.element));
    refresh();
  });
  document.addEventListener('demo:log', renderLog);

  document.getElementById('reset').addEventListener('click', () => {
    window.TinyConsent.reset();
    window.__demoLog('Consent reset. Reload the page to see trackers blocked again.');
  });

  document.getElementById('inject').addEventListener('click', () => {
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    window.__demoLog('Page tried to inject connect.facebook.net/en_US/fbevents.js');
    refresh();
  });

  document.querySelectorAll('[data-brand]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.documentElement.className = document.documentElement.className
        .split(/\s+/)
        .filter((c) => c && !c.startsWith('brand-'))
        .join(' ');
      if (chip.dataset.brand) document.documentElement.classList.add(chip.dataset.brand);
      document.querySelectorAll('[data-brand]').forEach((c) => c.classList.toggle('is-active', c === chip));
    });
  });

  refresh();
})();
