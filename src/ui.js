// Binds the Webflow component to consent actions. Reads attributes only;
// classes, copy, and layout stay in the Designer.
//
//   [data-tc="root"]           wraps everything below
//   [data-tc="banner"]         first-visit banner
//   [data-tc="preferences"]    category panel
//   [data-tc-category="…"]     row (or input) for one category inside the panel
//   [data-tc-action="…"]       accept-all | reject-all | open-preferences | save | close
//   [data-tc-element="open-preferences"]  any element anywhere, e.g. a footer link

import { isAllowed } from './consent.js';

const FOCUSABLE = 'button, [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function bindUI(doc, handlers) {
  const root = doc.querySelector('[data-tc="root"]');
  const banner = root ? root.querySelector('[data-tc="banner"]') : null;
  const prefs = root ? root.querySelector('[data-tc="preferences"]') : null;
  let lastFocus = null;

  function isVisible(el) {
    return Boolean(el) && el.getAttribute('data-tc-visible') === 'true';
  }

  function setVisible(el, on) {
    if (!el) return;
    if (on) el.setAttribute('data-tc-visible', 'true');
    else el.removeAttribute('data-tc-visible');
  }

  function update() {
    setVisible(root, isVisible(banner) || isVisible(prefs));
  }

  function focusFirst(el) {
    const target = el && el.querySelector(FOCUSABLE);
    if (target) target.focus();
  }

  function showBanner() {
    setVisible(prefs, false);
    setVisible(banner, true);
    update();
  }

  function showPreferences() {
    if (!prefs) return;
    if (!lastFocus) lastFocus = doc.activeElement;
    setVisible(banner, false);
    setVisible(prefs, true);
    update();
    focusFirst(prefs);
  }

  function hideAll() {
    setVisible(banner, false);
    setVisible(prefs, false);
    update();
    if (lastFocus && typeof lastFocus.focus === 'function' && doc.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function rows() {
    if (!root) return [];
    const out = [];
    root.querySelectorAll('[data-tc-category]').forEach((row) => {
      const input = row.matches('input') ? row : row.querySelector('input[type="checkbox"]');
      if (input) out.push({ category: row.getAttribute('data-tc-category'), input });
    });
    return out;
  }

  /** Reflects consent into the checkboxes. Essential stays checked and disabled. */
  function sync(consent) {
    for (const { category, input } of rows()) {
      input.checked = isAllowed(consent, category);
      if (category === 'essential') {
        input.checked = true;
        input.disabled = true;
      }
    }
  }

  /** Reads the checkboxes into `{ analytics: bool, … }`. */
  function read() {
    const out = {};
    for (const { category, input } of rows()) {
      if (category !== 'essential') out[category] = input.checked;
    }
    return out;
  }

  doc.addEventListener('click', (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest('[data-tc-action], [data-tc-element="open-preferences"]')
      : null;
    if (!target) return;
    const action = target.getAttribute('data-tc-action') || 'open-preferences';
    if (target.tagName === 'A' || target.closest('form')) event.preventDefault();

    switch (action) {
      case 'accept-all':
        handlers.acceptAll();
        break;
      case 'reject-all':
        handlers.rejectAll();
        break;
      case 'save':
        handlers.save(read());
        break;
      case 'open-preferences':
        showPreferences();
        break;
      case 'close':
        handlers.close();
        break;
      default:
        break;
    }
  });

  // Webflow checkboxes live inside a Form Block. Keep it from submitting.
  doc.addEventListener('submit', (event) => {
    if (root && root.contains(event.target)) event.preventDefault();
  });

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isVisible(prefs)) handlers.close();
  });

  return { root, banner, prefs, hasUI: Boolean(root), showBanner, showPreferences, hideAll, sync, read };
}
