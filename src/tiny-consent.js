// Tiny Consent entry. Load synchronously as the first custom code in <head>:
//
//   <script src="https://your-host/tiny-consent.js"
//           data-tc-mode="opt-in"
//           data-tc-cookie-days="180"
//           data-tc-block="cdn.example.com:analytics"
//           data-tc-vendors="meta-pixel"></script>
//
// The preferences panel lists the vendors detected on the page (see vendors.js).
// `data-tc-vendors` forces registry entries in; `window.TinyConsentVendors` adds or
// overrides entries per site.

import {
  COOKIE_NAME,
  allConsent,
  categoriesAllowed,
  cookieString,
  createConsent,
  defaultConsent,
  isAllowed,
  isDowngrade,
  parseConsent,
  readCookie,
  serializeConsent,
} from './consent.js';
import { createBlocker, parseBlockAttr } from './blocker.js';
import defaultPatterns from './blocklist.js';
import { bindUI } from './ui.js';
import { detectVendors } from './vendors.js';

const VERSION = '0.1.0';

// Injected only when the script runs, so the Designer canvas shows everything.
const BOOT_CSS = [
  'html.tc-boot [data-tc="root"]:not([data-tc-visible="true"]),',
  'html.tc-boot [data-tc="banner"]:not([data-tc-visible="true"]),',
  'html.tc-boot [data-tc="preferences"]:not([data-tc-visible="true"]),',
  'html.tc-boot [data-tc="float"]:not([data-tc-visible="true"]),',
  'html.tc-boot [data-tc-element="accordion"]:not([data-tc-open="true"]) [data-tc-element="details"],',
  'html.tc-boot [data-tc="root"] [hidden]',
  '{display:none!important}',
  'html.tc-boot [data-tc-element="chevron"]{transition:transform 150ms ease}',
  'html.tc-boot [data-tc-element="accordion"][data-tc-open="true"]>[data-tc-element="chevron"],',
  'html.tc-boot [data-tc-element="accordion"][data-tc-open="true"]>:not([data-tc-element="details"]) [data-tc-element="chevron"]',
  '{transform:rotate(180deg)}',
].join('');

function readConfig(script) {
  const attr = (name, fallback) => {
    const value = script ? script.getAttribute(name) : null;
    return value === null || value === '' ? fallback : value;
  };
  return {
    mode: attr('data-tc-mode', 'opt-in') === 'opt-out' ? 'opt-out' : 'opt-in',
    cookieDays: Number(attr('data-tc-cookie-days', 180)) || 180,
    cookieName: attr('data-tc-cookie-name', COOKIE_NAME),
    reload: attr('data-tc-reload', 'true') !== 'false',
    block: attr('data-tc-block', ''),
    vendors: attr('data-tc-vendors', '')
      .split(/[\s,]+/)
      .filter(Boolean),
  };
}

(function init(win, doc) {
  if (win.TinyConsent && win.TinyConsent.__tc) return;

  const script = doc.currentScript || doc.querySelector('script[src*="tiny-consent"]');
  const config = readConfig(script);
  const gpc = Boolean(win.navigator && win.navigator.globalPrivacyControl === true);
  const patterns = parseBlockAttr(config.block).concat(defaultPatterns);
  const secure = Boolean(win.location && win.location.protocol === 'https:');

  let consent = parseConsent(readCookie(doc.cookie, config.cookieName)) || defaultConsent({ mode: config.mode, gpc });
  let ui = null;

  const emit = (name, detail) => doc.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  const getConsent = () => ({ ...consent });

  const blocker = createBlocker({
    doc,
    patterns,
    base: win.location ? win.location.href : undefined,
    isAllowed: (categories) => categoriesAllowed(consent, categories),
    onBlock: (el) => emit('tc:block', { element: el }),
    onActivate: (el) => emit('tc:activate', { element: el }),
  });
  blocker.start();

  const style = doc.createElement('style');
  style.setAttribute('data-tc', 'boot');
  style.textContent = BOOT_CSS;
  (doc.head || doc.documentElement).appendChild(style);
  doc.documentElement.classList.add('tc-boot');

  function persist() {
    doc.cookie = cookieString(config.cookieName, serializeConsent(consent), { days: config.cookieDays, secure });
  }

  function closePanels() {
    if (!ui) return;
    if (consent.chosen) ui.hideAll();
    else ui.showBanner();
  }

  function apply(changes) {
    const previous = consent;
    consent = createConsent(previous, changes);
    persist();
    if (ui) {
      ui.sync(consent);
      ui.hideAll();
    }
    blocker.activate();
    emit('tc:consent', getConsent());
    // Scripts that already ran cannot be unloaded. A reload is the only way to stop them.
    if (config.reload && isDowngrade(previous, consent)) win.location.reload();
  }

  function reset() {
    doc.cookie = cookieString(config.cookieName, '', { days: -1, secure });
    consent = defaultConsent({ mode: config.mode, gpc });
    if (ui) {
      ui.sync(consent);
      ui.showBanner();
    }
    emit('tc:consent', getConsent());
  }

  let vendors = [];

  /** Re-scans the page for tracker tags and rebuilds the vendor lists in the panel. */
  function refreshVendors() {
    vendors = detectVendors(doc, {
      extra: win.TinyConsentVendors,
      include: config.vendors,
      cookieDays: config.cookieDays,
      base: win.location ? win.location.href : undefined,
    });
    if (ui) ui.renderVendors(vendors);
    return vendors.map((v) => ({ ...v }));
  }

  function ready() {
    ui = bindUI(doc, {
      acceptAll: () => apply(allConsent(true)),
      rejectAll: () => apply(allConsent(false)),
      save: (changes) => apply(changes),
      close: closePanels,
      beforeOpen: refreshVendors,
    });
    refreshVendors();
    ui.sync(consent);
    blocker.activate();
    if (!consent.chosen) ui.showBanner();
    emit('tc:consent', getConsent());
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready);
  else ready();

  win.TinyConsent = {
    __tc: true,
    version: VERSION,
    config: { ...config, gpc },
    getConsent,
    isAllowed: (category) => isAllowed(consent, category),
    setConsent: apply,
    acceptAll: () => apply(allConsent(true)),
    rejectAll: () => apply(allConsent(false)),
    open: () => ui && ui.showPreferences(),
    close: closePanels,
    reset,
    vendors: refreshVendors,
  };
})(window, document);
