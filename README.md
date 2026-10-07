# Tiny Consent for Webflow

A small first-party cookie consent kit for Webflow projects. One static script blocks trackers until the visitor agrees; one native Webflow component is the banner, styled in the Designer with your fonts, colors, and interactions.

- No server, no account, no per-site plan. Consent lives in a first-party cookie.
- Banner and preferences panel are regular Webflow elements. The script only reads `data-tc` attributes.
- Scripts, iframes, and images stay blocked until their category is allowed. Known tracker hosts are blocked even when you forget to tag them.
- Honors Global Privacy Control, supports opt-in (GDPR) and opt-out (CCPA) modes.

## Contents

- `src/` script source (`tiny-consent.js` entry, `consent.js`, `blocker.js`, `ui.js`, `blocklist.js`)
- `dist/` built bundle to host (`tiny-consent.js`, `tiny-consent.min.js`)
- `demo/` reference page with the exact component tree and a CSS-variable theme
- `test/` Vitest suite

```sh
npm install
npm run build   # dist/tiny-consent.js + dist/tiny-consent.min.js
npm run dev     # http://localhost:8787/demo/ with rebuild on change
npm test
```

## 1. Host the script once

Upload `dist/tiny-consent.min.js` to any static host (Cloudflare Pages, Netlify, S3, your own domain). Every Webflow site points at that one URL, so a fix ships to all projects at once. Add a long cache lifetime and bump the filename when you release.

## 2. Install on a Webflow site

Site settings → Custom code → **Head code**. Put this first, before any analytics or pixel snippet, with no `async` or `defer`:

```html
<script src="https://cdn.your-domain.com/tiny-consent.min.js"
        data-tc-mode="opt-in"
        data-tc-cookie-days="180"></script>
```

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-tc-mode` | `opt-in` | `opt-in`: nothing optional runs until the visitor accepts. `opt-out`: everything runs until the visitor rejects (CCPA style). |
| `data-tc-cookie-days` | `180` | Lifetime of the consent cookie. |
| `data-tc-block` | | Extra hosts to block, `host[:category]`, comma separated. `cdn.example.com:analytics, pixel.example.com`. Category defaults to `marketing`. Use `:essential` to let a host through the default list, e.g. `googletagmanager.com:essential`. |
| `data-tc-reload` | `true` | Reload the page when a category that was allowed becomes denied. Running scripts cannot be unloaded, so this is how they stop. Set `false` to skip. |
| `data-tc-cookie-name` | `tc_consent` | Cookie name. |

Then publish. Tags added under Webflow **Apps & Integrations** (the Google Analytics and Facebook Pixel fields) load before custom code and cannot be blocked. Paste those snippets into Head code instead.

## 3. Mark your trackers

Categories are `essential`, `analytics`, `marketing`, `personalization`. Essential always runs.

**Scripts** — set `type="text/plain"`, move `src` to `data-tc-src`, add the category:

```html
<!-- before -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments)} gtag('js', new Date()); gtag('config', 'G-XXXX');</script>

<!-- after -->
<script type="text/plain" data-tc-src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" data-tc-category="analytics"></script>
<script type="text/plain" data-tc-category="analytics">window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments)} gtag('js', new Date()); gtag('config', 'G-XXXX');</script>
```

A tag that lists several categories (`data-tc-category="analytics, marketing"`) runs only when all of them are allowed.

**Iframes and images** (YouTube, Vimeo, Google Maps, tracking pixels) — replace `src` with `data-tc-src` in a Code Embed:

```html
<iframe data-tc-src="https://www.youtube-nocookie.com/embed/VIDEO" data-tc-category="marketing" allowfullscreen></iframe>
```

**Placeholder** — any element with `data-tc-element="placeholder"` and a category is removed once that category is allowed. Put a message and an open-preferences button inside it, over the blocked embed.

**Automatic blocking** — scripts and iframes from hosts in `src/blocklist.js` (Google Analytics, GTM, Meta, Hotjar, LinkedIn, TikTok, HubSpot, YouTube, Intercom, …) are blocked even when they are not marked, including scripts injected later by other scripts. Scripts that already executed before Tiny Consent loaded, and tags Webflow injects ahead of custom code, cannot be caught. Add `data-tc-ignore` to a tag to exclude it from automatic blocking.

Remove `<noscript>` fallbacks from tracker snippets. They fire without consent.

## 4. Build the component in Webflow

Build it once on a library source site, then share it. The script finds elements by attribute, so names, classes, copy, order of buttons, and interactions are free.

```
Div                 data-tc="root"                 position fixed, inset 0, pointer-events none, z-index 9999
├─ Div              data-tc="banner"               pointer-events auto; absolute bottom-left (or any placement)
│  ├─ Image         optional logo
│  ├─ Heading       "We use cookies"
│  ├─ Paragraph     description + link to the privacy page
│  └─ Div           actions
│     ├─ Button     data-tc-action="reject-all"
│     ├─ Button     data-tc-action="open-preferences"
│     └─ Button     data-tc-action="accept-all"
└─ Div              data-tc="preferences"          pointer-events auto; absolute inset 0, centered
   ├─ Div           backdrop, data-tc-action="close"
   └─ Div           dialog
      ├─ Button     data-tc-action="close"         the X
      ├─ Heading / Paragraph
      ├─ Form Block (Webflow checkboxes need one)
      │  ├─ Checkbox field   data-tc-category="essential"        checked, disabled
      │  ├─ Checkbox field   data-tc-category="analytics"
      │  ├─ Checkbox field   data-tc-category="marketing"
      │  └─ Checkbox field   data-tc-category="personalization"
      └─ Div           actions
         ├─ Button     data-tc-action="reject-all"
         ├─ Button     data-tc-action="save"
         └─ Button     data-tc-action="accept-all"
```

Rules:

- Keep every element inside `data-tc="root"` and keep the attributes. Everything else is yours.
- Set attributes in Element settings → Custom attributes. For Webflow checkbox fields, put `data-tc-category` on the checkbox wrapper (the label); the script finds the input inside.
- Add `data-tc-element="open-preferences"` to a footer link so visitors can change their choice from any page.
- Use `button` elements (Button or Link Block with `type="button"`) inside the Form Block. The script also cancels form submission inside the component.
- Put the component in a symbol that already sits on every page (navbar or footer component). Webflow has no API that injects a component site-wide.
- Leave the banner visible in the Designer. On the published site the script hides it until it is needed, so there is no flash and you can still see it while designing. If you want to design the preferences panel, toggle its display in the Designer and set it back before publishing.

`demo/index.html` is the same tree in plain HTML. Use it as the reference when building the Webflow version.

### Visible names

Category labels are plain text. Rename "Analytics" to "Analytik" or "Statistics" in the Designer; the attribute value stays `analytics`.

## 5. Brand it per project

`demo/tiny-consent-theme.css` styles the component with seven custom properties:

```css
--tc-font       font family
--tc-bg         panel background
--tc-text       primary text
--tc-muted      secondary text
--tc-accent     primary button and checkbox color
--tc-on-accent  text on the accent color
--tc-radius     corner radius (panels cap at 28px so pill buttons stay sane)
```

In Webflow, create a variable collection with the same seven values and bind the component's colors, font, and radius to it. Two ways to use the component across sites:

1. **Shared Library, stay linked.** Share the source site as a Library, install it on a client site, and override the variables with the client's collection (or variable modes for multi-brand). Layout and copy follow the library; updates cascade.
2. **Install, unlink, restyle.** Install the Library, then uninstall it so the component becomes a local component. Now the whole Style panel is open: fonts, spacing, interactions, button order. This is the normal agency starter-kit workflow and the right choice when a client needs a different layout.

## Behavior

- First visit: banner shows. Nothing optional runs (opt-in) or everything runs (opt-out).
- Accept all / reject all / save: the choice is stored in `tc_consent` (`SameSite=Lax`, `Secure` on https) for `data-tc-cookie-days` days. Allowed tags run immediately. The panel closes and focus returns to the trigger.
- Returning visit: no banner. Allowed tags run as the page parses, blocked tags stay blocked.
- Downgrade (a category goes from allowed to denied): the page reloads so running trackers stop.
- Global Privacy Control (`navigator.globalPrivacyControl`): marketing is denied by default in opt-out mode.
- Escape closes the preferences panel. Closing without a stored choice returns to the banner.

### Public API and events

```js
TinyConsent.getConsent()           // { chosen, essential, analytics, marketing, personalization, t, v }
TinyConsent.isAllowed('analytics') // boolean
TinyConsent.setConsent({ analytics: true, marketing: false })
TinyConsent.acceptAll()
TinyConsent.rejectAll()
TinyConsent.open()                 // preferences panel
TinyConsent.close()
TinyConsent.reset()                // forget the choice, show the banner

document.addEventListener('tc:consent',  e => e.detail)          // on load and after every change
document.addEventListener('tc:block',    e => e.detail.element)  // a tag was auto-blocked by hostname
document.addEventListener('tc:activate', e => e.detail.element)  // a marked tag ran or was revealed
```

Use `tc:consent` to update Google Consent Mode or push to a GTM `dataLayer` if you run tags through a container.

## Cookie format

`tc_consent` holds URL-encoded JSON: `{"v":1,"t":"2026-10-07T10:34:58.928Z","a":1,"m":1,"p":1}`. `t` is the time of the decision; `a`, `m`, `p` are analytics, marketing, personalization. Essential is implicit. A different `v` is treated as no consent, so bumping `VERSION` in `src/consent.js` re-asks everyone.

## Scope

This kit covers the part of a consent tool that runs on the site. Scanning a site for trackers, consent-log storage and analytics, region-specific banners, AI tracker descriptions, and policy-page generation are separate products and are out of scope here. The kit does not provide legal advice; which categories you need and what your policy says is still your call.
