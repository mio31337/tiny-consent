(() => {
  // src/consent.js
  var COOKIE_NAME = "tc_consent";
  var VERSION = 1;
  var OPTIONAL_CATEGORIES = ["analytics", "marketing", "personalization"];
  function defaultConsent({ mode = "opt-in", gpc = false } = {}) {
    const allow = mode === "opt-out";
    return {
      v: VERSION,
      t: null,
      chosen: false,
      essential: true,
      analytics: allow,
      marketing: allow && !gpc,
      personalization: allow
    };
  }
  function createConsent(current, changes = {}, now = /* @__PURE__ */ new Date()) {
    const next = { ...current, v: VERSION, t: now.toISOString(), chosen: true, essential: true };
    for (const category of OPTIONAL_CATEGORIES) {
      if (category in changes) next[category] = Boolean(changes[category]);
    }
    return next;
  }
  function allConsent(value) {
    const out = {};
    for (const category of OPTIONAL_CATEGORIES) out[category] = Boolean(value);
    return out;
  }
  function serializeConsent(consent) {
    return encodeURIComponent(
      JSON.stringify({
        v: VERSION,
        t: consent.t,
        a: consent.analytics ? 1 : 0,
        m: consent.marketing ? 1 : 0,
        p: consent.personalization ? 1 : 0
      })
    );
  }
  function parseConsent(raw) {
    if (!raw) return null;
    try {
      const data = JSON.parse(decodeURIComponent(raw));
      if (!data || data.v !== VERSION || typeof data.t !== "string") return null;
      return {
        v: VERSION,
        t: data.t,
        chosen: true,
        essential: true,
        analytics: data.a === 1,
        marketing: data.m === 1,
        personalization: data.p === 1
      };
    } catch (e) {
      return null;
    }
  }
  function readCookie(cookieString2, name) {
    for (const part of String(cookieString2 || "").split(";")) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
    }
    return null;
  }
  function cookieString(name, value, { days = 180, secure = false } = {}) {
    const maxAge = Math.round(days * 86400);
    return `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
  function isAllowed(consent, category) {
    if (category === "essential") return true;
    return consent[category] === true;
  }
  function parseCategories(attr) {
    return String(attr || "").split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  function categoriesAllowed(consent, categories) {
    const list = Array.isArray(categories) ? categories : parseCategories(categories);
    if (list.length === 0) return false;
    return list.every((category) => isAllowed(consent, category));
  }
  function isDowngrade(previous, next) {
    return OPTIONAL_CATEGORIES.some((category) => previous[category] && !next[category]);
  }

  // src/blocker.js
  var rawSetAttribute = typeof Element !== "undefined" ? Element.prototype.setAttribute : null;
  function setAttr(el, name, value) {
    rawSetAttribute.call(el, name, value);
  }
  function parseBlockAttr(attr) {
    return String(attr || "").split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const colon = entry.lastIndexOf(":");
      if (colon < 0) return [entry.toLowerCase(), "marketing"];
      return [entry.slice(0, colon).toLowerCase(), entry.slice(colon + 1).toLowerCase() || "marketing"];
    });
  }
  function matchPattern(url, patterns, base) {
    let parsed;
    try {
      parsed = new URL(String(url), base || "http://tc.invalid/");
    } catch (e) {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host) return null;
    const path = parsed.pathname;
    for (const [pattern, category] of patterns) {
      const slash = pattern.indexOf("/");
      const patternHost = (slash < 0 ? pattern : pattern.slice(0, slash)).toLowerCase();
      const patternPath = slash < 0 ? "" : pattern.slice(slash);
      if (host !== patternHost && !host.endsWith("." + patternHost)) continue;
      if (patternPath && !path.startsWith(patternPath)) continue;
      return category;
    }
    return null;
  }
  var MARKED_SELECTOR = [
    'script[type="text/plain"][data-tc-category]',
    "script[data-tc-src][data-tc-category]",
    ":not(script)[data-tc-src][data-tc-category]",
    '[data-tc-element="placeholder"][data-tc-category]'
  ].join(", ");
  function createBlocker({ doc, patterns, isAllowed: isAllowed2, base, onBlock, onActivate }) {
    const createRaw = doc.createElement.bind(doc);
    let observer = null;
    function categoryFor(el, src) {
      if (el.hasAttribute("data-tc-category") || el.hasAttribute("data-tc-activated") || el.hasAttribute("data-tc-ignore")) {
        return null;
      }
      return matchPattern(src, patterns, base);
    }
    function needsBlock(category) {
      return Boolean(category) && !isAllowed2([category]);
    }
    function mark(el, src, category) {
      const tag = el.tagName;
      if (tag === "SCRIPT") {
        const type = el.getAttribute("type");
        if (type && type !== "text/plain") setAttr(el, "data-tc-type", type);
        setAttr(el, "type", "text/plain");
        el.removeAttribute("src");
      } else if (el.hasAttribute("src")) {
        setAttr(el, "src", "about:blank");
      }
      setAttr(el, "data-tc-src", src);
      setAttr(el, "data-tc-category", category);
      setAttr(el, "data-tc-auto", "");
      if (onBlock) onBlock(el);
    }
    function inspect(el) {
      const src = el.getAttribute("src");
      if (src) {
        const category = categoryFor(el, src);
        if (needsBlock(category)) mark(el, src, category);
        return;
      }
      if (el.hasAttribute("data-tc-category") && el.hasAttribute("data-tc-src")) activateOne(el);
    }
    function visit(node) {
      if (node.nodeType !== 1) return;
      const tag = node.tagName;
      if (tag === "SCRIPT" || tag === "IFRAME") inspect(node);
      if (node.querySelectorAll) {
        node.querySelectorAll("script[src], iframe[src]").forEach(inspect);
      }
    }
    function guard(el) {
      const proto = Object.getPrototypeOf(el);
      const descriptor = Object.getOwnPropertyDescriptor(proto, "src");
      const ownSetAttribute = el.setAttribute;
      el.setAttribute = function(name, value) {
        if (String(name).toLowerCase() === "src") {
          const category = categoryFor(el, value);
          if (needsBlock(category)) {
            mark(el, String(value), category);
            return;
          }
        }
        return ownSetAttribute.call(el, name, value);
      };
      if (descriptor && descriptor.set) {
        Object.defineProperty(el, "src", {
          configurable: true,
          get() {
            return descriptor.get.call(el);
          },
          set(value) {
            el.setAttribute("src", value);
          }
        });
      }
    }
    function start() {
      doc.createElement = function(tag, options) {
        const el = createRaw(tag, options);
        const name = String(tag).toLowerCase();
        if (name === "script" || name === "iframe") guard(el);
        return el;
      };
      if (typeof MutationObserver !== "undefined" && doc.documentElement) {
        observer = new MutationObserver((records) => {
          for (const record of records) record.addedNodes.forEach(visit);
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });
      }
    }
    function stop() {
      if (observer) observer.disconnect();
      observer = null;
      doc.createElement = createRaw;
    }
    function runScript(el) {
      const script = createRaw("script");
      for (const { name, value } of Array.from(el.attributes)) {
        if (name === "type" || name === "src" || name.startsWith("data-tc-")) continue;
        setAttr(script, name, value);
      }
      const type = el.getAttribute("data-tc-type");
      if (type) setAttr(script, "type", type);
      setAttr(script, "data-tc-activated", "");
      setAttr(script, "data-tc-category", el.getAttribute("data-tc-category"));
      const src = el.getAttribute("data-tc-src");
      if (src) {
        script.async = false;
        setAttr(script, "src", src);
      } else {
        script.textContent = el.textContent || "";
      }
      if (el.parentNode) el.parentNode.replaceChild(script, el);
      else (doc.head || doc.documentElement).appendChild(script);
      return script;
    }
    function activateOne(el) {
      if (el.hasAttribute("data-tc-activated")) return false;
      const categories = parseCategories(el.getAttribute("data-tc-category"));
      if (!isAllowed2(categories)) return false;
      let result = el;
      if (el.tagName === "SCRIPT") {
        result = runScript(el);
      } else if (el.getAttribute("data-tc-element") === "placeholder") {
        el.remove();
      } else {
        setAttr(el, "data-tc-activated", "");
        const src = el.getAttribute("data-tc-src");
        if (src) setAttr(el, "src", src);
      }
      if (onActivate) onActivate(result);
      return true;
    }
    function activate() {
      let count = 0;
      doc.querySelectorAll(MARKED_SELECTOR).forEach((el) => {
        if (activateOne(el)) count += 1;
      });
      return count;
    }
    return { start, stop, activate, activateOne, inspect: visit, createRaw };
  }

  // src/blocklist.js
  var blocklist_default = [
    // analytics
    ["google-analytics.com", "analytics"],
    ["analytics.google.com", "analytics"],
    ["googletagmanager.com", "analytics"],
    ["hotjar.com", "analytics"],
    ["clarity.ms", "analytics"],
    ["mixpanel.com", "analytics"],
    ["segment.com", "analytics"],
    ["segment.io", "analytics"],
    ["amplitude.com", "analytics"],
    ["heapanalytics.com", "analytics"],
    ["fullstory.com", "analytics"],
    ["mouseflow.com", "analytics"],
    ["matomo.cloud", "analytics"],
    ["plausible.io", "analytics"],
    ["usefathom.com", "analytics"],
    ["posthog.com", "analytics"],
    ["luckyorange.com", "analytics"],
    ["smartlook.com", "analytics"],
    // marketing
    ["connect.facebook.net", "marketing"],
    ["facebook.com", "marketing"],
    ["doubleclick.net", "marketing"],
    ["googleadservices.com", "marketing"],
    ["googlesyndication.com", "marketing"],
    ["ads.linkedin.com", "marketing"],
    ["snap.licdn.com", "marketing"],
    ["ads-twitter.com", "marketing"],
    ["analytics.tiktok.com", "marketing"],
    ["bat.bing.com", "marketing"],
    ["pinimg.com", "marketing"],
    ["pinterest.com", "marketing"],
    ["hs-scripts.com", "marketing"],
    ["hs-analytics.net", "marketing"],
    ["hsforms.net", "marketing"],
    ["sc-static.net", "marketing"],
    ["tr.snapchat.com", "marketing"],
    ["redditstatic.com", "marketing"],
    ["adroll.com", "marketing"],
    ["criteo.com", "marketing"],
    ["criteo.net", "marketing"],
    ["youtube.com", "marketing"],
    ["youtube-nocookie.com", "marketing"],
    ["vimeo.com", "marketing"],
    ["maps.googleapis.com", "marketing"],
    ["maps.google.com", "marketing"],
    ["www.google.com/maps", "marketing"],
    // personalization
    ["intercom.io", "personalization"],
    ["intercomcdn.com", "personalization"],
    ["crisp.chat", "personalization"],
    ["drift.com", "personalization"],
    ["driftt.com", "personalization"],
    ["optimizely.com", "personalization"],
    ["visualwebsiteoptimizer.com", "personalization"],
    ["tawk.to", "personalization"]
  ];

  // src/ui.js
  var FOCUSABLE = 'button, [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  var ACTIONABLE = '[data-tc-action], [data-tc-element="open-preferences"]';
  function bindUI(doc, handlers) {
    const root = doc.querySelector('[data-tc="root"]');
    const banner = root ? root.querySelector('[data-tc="banner"]') : null;
    const prefs = root ? root.querySelector('[data-tc="preferences"]') : null;
    const float = root ? root.querySelector('[data-tc="float"]') : null;
    let lastFocus = null;
    let chosen = false;
    function isVisible(el) {
      return Boolean(el) && el.getAttribute("data-tc-visible") === "true";
    }
    function setVisible(el, on) {
      if (!el) return;
      if (on) el.setAttribute("data-tc-visible", "true");
      else el.removeAttribute("data-tc-visible");
    }
    function update() {
      const panelsOpen = isVisible(banner) || isVisible(prefs);
      setVisible(float, chosen && !panelsOpen);
      setVisible(root, panelsOpen || isVisible(float));
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
      if (lastFocus && typeof lastFocus.focus === "function" && doc.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
    }
    function rows() {
      if (!root) return [];
      const out = [];
      root.querySelectorAll("[data-tc-category]").forEach((row) => {
        const input = row.matches("input") ? row : row.querySelector('input[type="checkbox"]');
        if (input) out.push({ category: row.getAttribute("data-tc-category"), input });
      });
      return out;
    }
    function sync(consent) {
      chosen = Boolean(consent && consent.chosen);
      for (const { category, input } of rows()) {
        input.checked = isAllowed(consent, category);
        if (category === "essential") {
          input.checked = true;
          input.disabled = true;
        }
      }
      update();
    }
    function read() {
      const out = {};
      for (const { category, input } of rows()) {
        if (category !== "essential") out[category] = input.checked;
      }
      return out;
    }
    function toggle(target) {
      const box = target.closest('[data-tc-element="accordion"]');
      if (!box) return;
      const open = box.getAttribute("data-tc-open") !== "true";
      box.setAttribute("data-tc-open", open ? "true" : "false");
      target.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function run(target, event) {
      const action = target.getAttribute("data-tc-action") || "open-preferences";
      if (target.tagName === "A" || target.closest("form")) event.preventDefault();
      switch (action) {
        case "accept-all":
          handlers.acceptAll();
          break;
        case "reject-all":
          handlers.rejectAll();
          break;
        case "save":
          handlers.save(read());
          break;
        case "open-preferences":
          showPreferences();
          break;
        case "close":
          handlers.close();
          break;
        case "toggle":
          toggle(target);
          break;
        default:
          break;
      }
    }
    doc.addEventListener("click", (event) => {
      const target = event.target && event.target.closest ? event.target.closest(ACTIONABLE) : null;
      if (!target) return;
      const link = event.target.closest("a[href]");
      if (link && link !== target && target.contains(link)) return;
      run(target, event);
    });
    doc.addEventListener("submit", (event) => {
      if (root && root.contains(event.target)) event.preventDefault();
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isVisible(prefs)) {
        handlers.close();
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && event.target && event.target.matches) {
        const target = event.target.matches(ACTIONABLE) && event.target.getAttribute("role") === "button" ? event.target : null;
        if (target && target.tagName !== "BUTTON" && target.tagName !== "A") run(target, event);
      }
    });
    return { root, banner, prefs, float, hasUI: Boolean(root), showBanner, showPreferences, hideAll, sync, read };
  }

  // src/tiny-consent.js
  var VERSION2 = "0.1.0";
  var BOOT_CSS = [
    'html.tc-boot [data-tc="root"]:not([data-tc-visible="true"]),',
    'html.tc-boot [data-tc="banner"]:not([data-tc-visible="true"]),',
    'html.tc-boot [data-tc="preferences"]:not([data-tc-visible="true"]),',
    'html.tc-boot [data-tc="float"]:not([data-tc-visible="true"]),',
    'html.tc-boot [data-tc-element="accordion"]:not([data-tc-open="true"]) [data-tc-element="details"]',
    "{display:none!important}",
    'html.tc-boot [data-tc-element="chevron"]{transition:transform 150ms ease}',
    'html.tc-boot [data-tc-element="accordion"][data-tc-open="true"]>[data-tc-element="chevron"],',
    'html.tc-boot [data-tc-element="accordion"][data-tc-open="true"]>:not([data-tc-element="details"]) [data-tc-element="chevron"]',
    "{transform:rotate(180deg)}"
  ].join("");
  function readConfig(script) {
    const attr = (name, fallback) => {
      const value = script ? script.getAttribute(name) : null;
      return value === null || value === "" ? fallback : value;
    };
    return {
      mode: attr("data-tc-mode", "opt-in") === "opt-out" ? "opt-out" : "opt-in",
      cookieDays: Number(attr("data-tc-cookie-days", 180)) || 180,
      cookieName: attr("data-tc-cookie-name", COOKIE_NAME),
      reload: attr("data-tc-reload", "true") !== "false",
      block: attr("data-tc-block", "")
    };
  }
  (function init(win, doc) {
    if (win.TinyConsent && win.TinyConsent.__tc) return;
    const script = doc.currentScript || doc.querySelector('script[src*="tiny-consent"]');
    const config = readConfig(script);
    const gpc = Boolean(win.navigator && win.navigator.globalPrivacyControl === true);
    const patterns = parseBlockAttr(config.block).concat(blocklist_default);
    const secure = Boolean(win.location && win.location.protocol === "https:");
    let consent = parseConsent(readCookie(doc.cookie, config.cookieName)) || defaultConsent({ mode: config.mode, gpc });
    let ui = null;
    const emit = (name, detail) => doc.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    const getConsent = () => ({ ...consent });
    const blocker = createBlocker({
      doc,
      patterns,
      base: win.location ? win.location.href : void 0,
      isAllowed: (categories) => categoriesAllowed(consent, categories),
      onBlock: (el) => emit("tc:block", { element: el }),
      onActivate: (el) => emit("tc:activate", { element: el })
    });
    blocker.start();
    const style = doc.createElement("style");
    style.setAttribute("data-tc", "boot");
    style.textContent = BOOT_CSS;
    (doc.head || doc.documentElement).appendChild(style);
    doc.documentElement.classList.add("tc-boot");
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
      emit("tc:consent", getConsent());
      if (config.reload && isDowngrade(previous, consent)) win.location.reload();
    }
    function reset() {
      doc.cookie = cookieString(config.cookieName, "", { days: -1, secure });
      consent = defaultConsent({ mode: config.mode, gpc });
      if (ui) {
        ui.sync(consent);
        ui.showBanner();
      }
      emit("tc:consent", getConsent());
    }
    function ready() {
      ui = bindUI(doc, {
        acceptAll: () => apply(allConsent(true)),
        rejectAll: () => apply(allConsent(false)),
        save: (changes) => apply(changes),
        close: closePanels
      });
      ui.sync(consent);
      blocker.activate();
      if (!consent.chosen) ui.showBanner();
      emit("tc:consent", getConsent());
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", ready);
    else ready();
    win.TinyConsent = {
      __tc: true,
      version: VERSION2,
      config: { ...config, gpc },
      getConsent,
      isAllowed: (category) => isAllowed(consent, category),
      setConsent: apply,
      acceptAll: () => apply(allConsent(true)),
      rejectAll: () => apply(allConsent(false)),
      open: () => ui && ui.showPreferences(),
      close: closePanels,
      reset
    };
  })(window, document);
})();
