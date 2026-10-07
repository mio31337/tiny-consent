// Builds a Webflow clipboard payload (@webflow/XscpData) from the live component in
// preview.html and the class rules in tiny-consent-theme.css, so the Designer paste
// always matches the reference. Also builds a plain HTML embed as a fallback.
//
// Mapping (DOM -> Webflow element):
//   div / span            Block (div)
//   h1-h6                 Heading
//   p                     Paragraph
//   a                     Link (text link, or Button when it carries the tc-button class)
//   button                Link styled as Button
//   form                  Form Block (FormWrapper > FormForm + success/error messages)
//   label > input + span  Checkbox field (FormCheckboxWrapper > FormCheckboxInput + FormInlineLabel)
//   div[role=button]      Block with the role/tabindex attributes (chevrons, float button)
//   data-* / role / aria  Custom attributes
//
// CSS: one class per rule. var() resolves to the :root defaults, color-mix() becomes rgba,
// min()/calc() with px operands are evaluated. :hover becomes the Hover state and
// @media (max-width) becomes the matching Webflow breakpoint.

(function (global) {
  const DROP_PROPS = new Set(['accent-color', 'appearance', 'outline', 'outline-offset']);
  const KEEP_ATTRS = /^(data-|role$|tabindex$|aria-label$|aria-modal$|aria-hidden$)/;

  function uid() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- CSS ----------

  function parseDecls(text) {
    const out = {};
    text.split(';').forEach((part) => {
      const colon = part.indexOf(':');
      if (colon < 0) return;
      const prop = part.slice(0, colon).trim();
      const value = part.slice(colon + 1).trim();
      if (prop && value) out[prop] = value;
    });
    return out;
  }

  function breakpointFor(maxWidth) {
    if (maxWidth <= 478) return 'tiny';
    if (maxWidth <= 767) return 'small';
    return 'medium';
  }

  /** Returns { vars: {--x: value}, classes: { name: { base: {}, hover: {}, small: {} } } } */
  function parseCss(cssText) {
    const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    const result = { vars: {}, classes: {} };

    function handle(selector, decls, variant) {
      if (selector === ':root') {
        Object.assign(result.vars, decls);
        return;
      }
      const match = selector.match(/^\.([\w-]+)(?::(hover|focus-visible))?$/);
      if (!match || match[2] === 'focus-visible') return;
      const name = match[1];
      const key = match[2] === 'hover' ? (variant === 'base' ? 'hover' : variant + '_hover') : variant;
      const entry = (result.classes[name] = result.classes[name] || {});
      entry[key] = Object.assign(entry[key] || {}, decls);
    }

    function parseRules(text, variant) {
      const re = /([^{}]+)\{([^{}]*)\}/g;
      let m;
      while ((m = re.exec(text))) handle(m[1].trim(), parseDecls(m[2]), variant);
    }

    // Pull out @media blocks first (brace matching), then parse the remainder.
    let rest = '';
    let i = 0;
    while (i < css.length) {
      const at = css.indexOf('@media', i);
      if (at < 0) {
        rest += css.slice(i);
        break;
      }
      rest += css.slice(i, at);
      const open = css.indexOf('{', at);
      let depth = 1;
      let j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const query = css.slice(at, open);
      const inner = css.slice(open + 1, j - 1);
      const width = query.match(/max-width:\s*(\d+)px/);
      parseRules(inner, width ? breakpointFor(Number(width[1])) : 'base');
      i = j;
    }
    parseRules(rest, 'base');
    return result;
  }

  function hexToRgba(hex, alpha) {
    let h = hex.replace('#', '');
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
  }

  function round(n) {
    return Math.round(n * 10) / 10;
  }

  function resolveValue(value, vars) {
    let v = value;
    for (let guard = 0; guard < 10 && /var\(/.test(v); guard++) {
      v = v.replace(/var\((--[\w-]+)\)/g, (_, name) => vars[name] || '');
    }
    let prev;
    let guard = 0;
    do {
      prev = v;
      v = v.replace(/calc\(\s*([\d.]+)px\s*\*\s*([\d.]+)\s*\)/g, (_, a, b) => round(a * b) + 'px');
      v = v.replace(/min\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\)/g, (_, a, b) => Math.min(+a, +b) + 'px');
      v = v.replace(
        /color-mix\(in srgb,\s*(#[0-9a-fA-F]{3,8})\s+([\d.]+)%\s*,\s*transparent\s*\)/g,
        (_, hex, pct) => hexToRgba(hex, pct / 100),
      );
    } while (v !== prev && guard++ < 10);
    return v.trim();
  }

  function toStyleLess(decls, vars) {
    return Object.entries(decls || {})
      .filter(([prop]) => !DROP_PROPS.has(prop))
      .map(([prop, value]) => `${prop}: ${resolveValue(value, vars)};`)
      .join(' ');
  }

  // ---------- Nodes ----------

  function build({ root, css }) {
    const parsed = parseCss(css);
    const nodes = [];
    const styles = [];
    const styleIds = {};

    function styleFor(name, isCombo) {
      if (styleIds[name]) return styleIds[name];
      const rules = parsed.classes[name] || {};
      const variants = {};
      Object.keys(rules).forEach((key) => {
        if (key === 'base') return;
        variants[key] = { styleLess: toStyleLess(rules[key], parsed.vars) };
      });
      const style = {
        _id: uid(),
        fake: false,
        type: 'class',
        name,
        namespace: '',
        comb: isCombo ? '&' : '',
        styleLess: toStyleLess(rules.base, parsed.vars),
        variants,
        children: [],
        selector: null,
      };
      styles.push(style);
      styleIds[name] = style._id;
      return style._id;
    }

    function classIds(el) {
      const names = Array.from(el.classList);
      if (!names.length) return [];
      const baseId = styleFor(names[0], false);
      const ids = [baseId];
      names.slice(1).forEach((name) => {
        const comboId = styleFor(name, true);
        const base = styles.find((s) => s._id === baseId);
        if (!base.children.includes(comboId)) base.children.push(comboId);
        ids.push(comboId);
      });
      return ids;
    }

    function xattr(el) {
      return Array.from(el.attributes)
        .filter((a) => KEEP_ATTRS.test(a.name))
        .map((a) => ({ name: a.name, value: a.value }));
    }

    function textNode(value) {
      const node = { _id: uid(), text: true, v: value };
      nodes.push(node);
      return node._id;
    }

    function childIds(el, ctx) {
      const ids = [];
      el.childNodes.forEach((child) => {
        if (child.nodeType === 3) {
          const v = child.textContent.replace(/\s+/g, ' ').trim();
          if (v) ids.push(textNode(v));
        } else if (child.nodeType === 1) {
          ids.push(walk(child, ctx));
        }
      });
      return ids;
    }

    function push(node) {
      nodes.push(node);
      return node._id;
    }

    function block(type, tag, el, ctx, data) {
      const node = {
        _id: uid(),
        type,
        tag,
        classes: classIds(el),
        children: [],
        data: Object.assign({ tag }, data || {}),
      };
      const attrs = xattr(el);
      if (attrs.length) node.data.xattr = attrs;
      nodes.push(node);
      node.children = childIds(el, ctx);
      return node._id;
    }

    function formBlock(el, ctx) {
      const name = 'Cookie Preferences';
      const formNode = {
        _id: uid(),
        type: 'FormForm',
        tag: 'form',
        classes: classIds(el),
        children: [],
        data: {
          attr: { id: 'wf-form-Cookie-Preferences', name: 'wf-form-Cookie-Preferences', 'data-name': name, method: 'get' },
          form: { type: 'form', name },
          tag: 'form',
        },
      };
      nodes.push(formNode);
      formNode.children = childIds(el, Object.assign({}, ctx, { inForm: true }));

      const message = (type, formType, text) => {
        const inner = push({ _id: uid(), type: 'Block', tag: 'div', classes: [], children: [textNode(text)], data: { tag: 'div', text: true } });
        return push({ _id: uid(), type, tag: 'div', classes: [], children: [inner], data: { form: { type: formType }, tag: 'div' } });
      };
      const done = message('FormSuccessMessage', 'msg-done', 'Thank you! Your preferences were saved.');
      const fail = message('FormErrorMessage', 'msg-fail', 'Something went wrong. Please try again.');

      return push({
        _id: uid(),
        type: 'FormWrapper',
        tag: 'div',
        classes: [],
        children: [formNode._id, done, fail],
        data: { form: { type: 'wrapper' }, tag: 'div' },
      });
    }

    function walk(el, ctx) {
      const tag = el.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) return block('Heading', tag, el, ctx);
      if (tag === 'p') return block('Paragraph', 'p', el, ctx);
      if (tag === 'form') return formBlock(el, ctx);

      if (tag === 'a' || tag === 'button') {
        const isButton = tag === 'button' || el.classList.contains('tc-button');
        const data = { link: { mode: 'external', url: el.getAttribute('href') || '#' } };
        if (el.getAttribute('target') === '_blank') data.link.target = '_blank';
        if (isButton) data.button = true;
        return block('Link', 'a', el, ctx, data);
      }

      if (tag === 'label' && el.querySelector('input[type="checkbox"]')) {
        return block('FormCheckboxWrapper', 'label', el, Object.assign({}, ctx, { inCheckbox: true }), {
          form: { type: 'checkbox-wrapper' },
        });
      }

      if (tag === 'input' && el.type === 'checkbox') {
        const name = el.getAttribute('name') || 'Checkbox';
        const node = {
          _id: uid(),
          type: 'FormCheckboxInput',
          tag: 'input',
          classes: classIds(el),
          children: [],
          data: {
            attr: { type: 'checkbox', name, 'data-name': name, required: false, checked: el.hasAttribute('checked') },
            form: { type: 'checkbox-input', name },
            inputType: 'default',
            tag: 'input',
          },
        };
        const attrs = xattr(el);
        if (attrs.length) node.data.xattr = attrs;
        return push(node);
      }

      if (tag === 'span' && ctx.inCheckbox) {
        return block('FormInlineLabel', 'span', el, ctx, { form: { type: 'inline-label' } });
      }

      return block('Block', 'div', el, ctx);
    }

    walk(root, {});

    return {
      type: '@webflow/XscpData',
      payload: {
        nodes,
        styles,
        assets: [],
        ix1: [],
        ix2: { interactions: [], events: [], actionLists: [] },
      },
      meta: {
        unlinkedSymbolCount: 0,
        droppedLinks: 0,
        dynBindRemovedCount: 0,
        dynListBindRemovedCount: 0,
        paginationRemovedCount: 0,
        universalBindingsRemovedCount: 0,
        unlinkedVariantsCount: 0,
      },
    };
  }

  // ---------- HTML embed fallback ----------

  function buildEmbed({ root, css }) {
    const scoped = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\.brand-[\w-]+\s*\{[^}]*\}\s*/g, '')
      .replace(/:root\s*\{/, '.tc-root {')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const html = root.outerHTML.replace(/^\s+/gm, (m) => m.replace(/^ {2}/, ''));
    return `<style>\n${scoped}\n</style>\n${html}`;
  }

  // ---------- Sources and clipboard ----------

  async function loadSources(base) {
    const prefix = base || './';
    const [html, css] = await Promise.all([
      fetch(prefix + 'preview.html').then((r) => r.text()),
      fetch(prefix + 'tiny-consent-theme.css').then((r) => r.text()),
    ]);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('[data-tc="root"]');
    if (!root) throw new Error('preview.html has no [data-tc="root"] element');
    return { root, css };
  }

  /** Must run inside a user gesture: Webflow reads a JSON MIME type that only the copy event can set. */
  function writeWebflowClipboard(payload) {
    const json = JSON.stringify(payload);
    let ok = false;
    const onCopy = (event) => {
      event.preventDefault();
      event.clipboardData.setData('application/json', json);
      event.clipboardData.setData('text/plain', json);
      ok = true;
    };
    // execCommand('copy') needs a selection to fire the copy event. Select a scratch
    // textarea, then replace the clipboard contents in the handler.
    const scratch = document.createElement('textarea');
    scratch.value = 'tiny-consent';
    scratch.setAttribute('readonly', '');
    scratch.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(scratch);
    const active = document.activeElement;
    scratch.focus();
    scratch.select();
    document.addEventListener('copy', onCopy);
    try {
      document.execCommand('copy');
    } finally {
      document.removeEventListener('copy', onCopy);
      scratch.remove();
      if (active && active.focus) active.focus();
    }
    if (!ok) {
      // Without window focus Chrome disables execCommand. Leave the JSON on the clipboard as
      // text so nothing is lost, and tell the user how to get the real format.
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).catch(() => {});
      throw new Error(
        document.hasFocus()
          ? 'The browser blocked the copy. Click the button again.'
          : 'The browser window is not focused, so the copy was blocked. Click anywhere on this page, then press the button again.',
      );
    }
    return json.length;
  }

  global.TinyConsentPaste = { loadSources, build, buildEmbed, writeWebflowClipboard, parseCss, resolveValue };
})(window);
