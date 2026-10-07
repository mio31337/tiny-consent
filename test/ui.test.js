// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindUI } from '../src/ui.js';
import { allConsent, createConsent, defaultConsent } from '../src/consent.js';

const MARKUP = `
<div data-tc="root">
  <div data-tc="banner">
    <button data-tc-action="accept-all">Accept all</button>
    <button data-tc-action="open-preferences">Preferences</button>
  </div>
  <div data-tc="preferences">
    <form>
      <div data-tc-category="essential" data-tc-element="accordion">
        <div data-tc-action="toggle" data-tc-element="chevron" role="button" tabindex="0"></div>
        <div data-tc-element="details">
          <div data-tc-element="accordion" id="vendor">
            <div data-tc-action="toggle" role="button" tabindex="0" id="vendor-toggle">
              <a href="https://example.com/privacy" id="policy">Privacy policy</a>
            </div>
            <div data-tc-element="details" id="vendor-details"></div>
          </div>
        </div>
      </div>
      <div data-tc-category="analytics" data-tc-element="accordion" id="analytics">
        <div data-tc-action="toggle" role="button" tabindex="0" id="analytics-toggle"></div>
        <label><input type="checkbox" /> Analytics</label>
        <div data-tc-element="details"></div>
      </div>
      <button data-tc-action="save">Save</button>
    </form>
  </div>
  <div data-tc="float" data-tc-action="open-preferences" role="button" tabindex="0">Preferences</div>
</div>`;

// Each test gets its own document: bindUI attaches listeners to the document it receives.
let doc;

function setup() {
  doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = MARKUP;
  const handlers = { acceptAll: vi.fn(), rejectAll: vi.fn(), save: vi.fn(), close: vi.fn() };
  const ui = bindUI(doc, handlers);
  return { ui, handlers };
}

const byId = (id) => doc.getElementById(id);

const visible = (el) => el.getAttribute('data-tc-visible') === 'true';
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

describe('float button', () => {
  it('stays hidden until a choice exists', () => {
    const { ui } = setup();
    ui.sync(defaultConsent({ mode: 'opt-in' }));
    ui.showBanner();
    expect(visible(ui.float)).toBe(false);
    expect(visible(ui.root)).toBe(true);
  });

  it('shows after a choice, hides while a panel is open', () => {
    const { ui } = setup();
    ui.sync(createConsent(defaultConsent({ mode: 'opt-in' }), allConsent(true)));
    ui.hideAll();
    expect(visible(ui.float)).toBe(true);
    expect(visible(ui.root)).toBe(true);

    click(ui.float);
    expect(visible(ui.prefs)).toBe(true);
    expect(visible(ui.float)).toBe(false);

    ui.hideAll();
    expect(visible(ui.float)).toBe(true);
  });

  it('is shown for returning visitors by sync alone', () => {
    const { ui } = setup();
    ui.sync(createConsent(defaultConsent({ mode: 'opt-in' }), { analytics: true }));
    expect(visible(ui.float)).toBe(true);
  });
});

describe('accordion', () => {
  it('toggles data-tc-open on the nearest accordion and aria-expanded on the toggle', () => {
    setup();
    const box = byId('analytics');
    const toggle = byId('analytics-toggle');
    click(toggle);
    expect(box.getAttribute('data-tc-open')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    click(toggle);
    expect(box.getAttribute('data-tc-open')).toBe('false');
  });

  it('nested toggles only affect their own accordion', () => {
    setup();
    click(byId('vendor-toggle'));
    expect(byId('vendor').getAttribute('data-tc-open')).toBe('true');
    expect(doc.querySelector('[data-tc-category="essential"]').hasAttribute('data-tc-open')).toBe(false);
  });

  it('lets a link inside a toggle header through', () => {
    setup();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    byId('policy').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(byId('vendor').hasAttribute('data-tc-open')).toBe(false);
  });

  it('activates role="button" divs with Enter and Space', () => {
    setup();
    const toggle = byId('analytics-toggle');
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(byId('analytics').getAttribute('data-tc-open')).toBe('true');
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    toggle.dispatchEvent(space);
    expect(byId('analytics').getAttribute('data-tc-open')).toBe('false');
    expect(space.defaultPrevented).toBe(true);
  });
});
