// Vendor registry and detection. The preferences panel lists only the services that
// are really on the page: every script and iframe URL (including the ones the blocker
// neutralised into data-tc-src) and the text of inline snippets are matched against
// the host patterns below.
//
// Registry rows are compact to keep the bundle small:
//   [id, name, category, privacyUrl, hosts, cookies]
//   cookies: [[name, purpose, duration], …]
// A host pattern matches the hostname and its subdomains; with a path it also requires
// that path prefix (`googletagmanager.com/gtag` is Google Analytics, `…/gtm.js` is GTM).
//
// Per site, `window.TinyConsentVendors = [{ id, name, category, privacy, hosts, cookies }]`
// adds or overrides entries, and `data-tc-vendors="meta-pixel, hubspot"` on the script
// tag forces entries in even when nothing on the page matches (server-side tags).

import { matchPattern } from './blocker.js';

const GOOGLE = 'https://policies.google.com/privacy';
const MS = 'https://privacy.microsoft.com/privacystatement';

export const REGISTRY = [
  // essential
  ['tiny-consent', 'Tiny Consent', 'essential', '', [], [['tc_consent', 'Stores the cookie choices you make here.', '{days} days']]],

  // analytics
  ['google-analytics', 'Google Analytics', 'analytics', GOOGLE, ['google-analytics.com', 'analytics.google.com', 'googletagmanager.com/gtag'], [
    ['_ga', 'Tells visitors apart.', '2 years'],
    ['_ga_*', 'Keeps the session state.', '2 years'],
    ['_gid', 'Tells visitors apart.', '24 hours'],
  ]],
  ['google-tag-manager', 'Google Tag Manager', 'analytics', GOOGLE, ['googletagmanager.com/gtm.js', 'googletagmanager.com/ns.html'], []],
  ['hotjar', 'Hotjar', 'analytics', 'https://www.hotjar.com/legal/policies/privacy/', ['hotjar.com'], [
    ['_hjSessionUser_*', 'Identifies returning visitors.', '1 year'],
    ['_hjSession_*', 'Holds the current session.', '30 minutes'],
  ]],
  ['clarity', 'Microsoft Clarity', 'analytics', MS, ['clarity.ms'], [
    ['_clck', 'Persists the Clarity user id.', '1 year'],
    ['_clsk', 'Links page views into one session.', '1 day'],
  ]],
  ['mixpanel', 'Mixpanel', 'analytics', 'https://mixpanel.com/legal/privacy-policy', ['mixpanel.com'], [['mp_*_mixpanel', 'Tracks events and visitors.', '1 year']]],
  ['segment', 'Segment', 'analytics', 'https://segment.com/legal/privacy', ['segment.com', 'segment.io'], [
    ['ajs_anonymous_id', 'Anonymous visitor id.', '1 year'],
    ['ajs_user_id', 'Logged-in user id.', '1 year'],
  ]],
  ['amplitude', 'Amplitude', 'analytics', 'https://amplitude.com/privacy', ['amplitude.com'], [['AMP_*', 'Device and session ids.', '1 year']]],
  ['heap', 'Heap', 'analytics', 'https://www.heap.io/privacy', ['heapanalytics.com'], [['_hp2_id.*', 'Visitor id.', '13 months']]],
  ['fullstory', 'FullStory', 'analytics', 'https://www.fullstory.com/legal/privacy-policy', ['fullstory.com'], [['fs_uid', 'Session replay id.', '1 year']]],
  ['mouseflow', 'Mouseflow', 'analytics', 'https://mouseflow.com/legal/gdpr', ['mouseflow.com'], [
    ['mf_user', 'Marks returning visitors.', '90 days'],
    ['mf_*', 'Session recording id.', 'Session'],
  ]],
  ['matomo', 'Matomo', 'analytics', 'https://matomo.org/privacy-policy', ['matomo.cloud'], [
    ['_pk_id.*', 'Visitor id.', '13 months'],
    ['_pk_ses.*', 'Current session.', '30 minutes'],
  ]],
  ['plausible', 'Plausible', 'analytics', 'https://plausible.io/privacy', ['plausible.io'], []],
  ['fathom', 'Fathom', 'analytics', 'https://usefathom.com/privacy', ['usefathom.com'], []],
  ['posthog', 'PostHog', 'analytics', 'https://posthog.com/privacy', ['posthog.com'], [['ph_*_posthog', 'Visitor id and session.', '1 year']]],
  ['luckyorange', 'Lucky Orange', 'analytics', 'https://www.luckyorange.com/privacy.php', ['luckyorange.com'], [['_lo_uid', 'Visitor id.', '2 years']]],
  ['smartlook', 'Smartlook', 'analytics', 'https://www.smartlook.com/privacy-policy', ['smartlook.com'], [['SL_C_*', 'Visitor and session id.', '13 months']]],

  // marketing
  ['meta-pixel', 'Meta Pixel', 'marketing', 'https://www.facebook.com/privacy/policy/', ['connect.facebook.net', 'facebook.com/tr'], [
    ['_fbp', 'Identifies browsers for ad delivery and measurement.', '90 days'],
    ['_fbc', 'Stores the last ad click.', '90 days'],
  ]],
  ['google-ads', 'Google Ads', 'marketing', 'https://policies.google.com/technologies/ads', ['googleadservices.com', 'doubleclick.net', 'googlesyndication.com'], [
    ['_gcl_au', 'Conversion attribution.', '90 days'],
    ['IDE', 'Ad targeting across sites.', '13 months'],
    ['test_cookie', 'Checks whether cookies can be set.', '15 minutes'],
  ]],
  ['linkedin', 'LinkedIn Insight Tag', 'marketing', 'https://www.linkedin.com/legal/privacy-policy', ['ads.linkedin.com', 'snap.licdn.com'], [
    ['li_sugr', 'Browser id for ads.', '90 days'],
    ['bcookie', 'Browser id.', '1 year'],
    ['UserMatchHistory', 'Syncs ad ids.', '30 days'],
  ]],
  ['tiktok', 'TikTok Pixel', 'marketing', 'https://www.tiktok.com/legal/privacy-policy', ['analytics.tiktok.com'], [['_ttp', 'Ad measurement id.', '13 months']]],
  ['microsoft-ads', 'Microsoft Advertising', 'marketing', MS, ['bat.bing.com'], [
    ['_uetsid', 'Session id for ad measurement.', '1 day'],
    ['_uetvid', 'Visitor id for ad measurement.', '13 months'],
    ['MUID', 'Browser id across Microsoft sites.', '13 months'],
  ]],
  ['x-pixel', 'X Pixel', 'marketing', 'https://x.com/privacy', ['ads-twitter.com'], [
    ['muc_ads', 'Ad measurement.', '2 years'],
    ['personalization_id', 'Ad personalisation.', '2 years'],
  ]],
  ['pinterest', 'Pinterest Tag', 'marketing', 'https://policy.pinterest.com/privacy-policy', ['pinimg.com', 'pinterest.com'], [['_pin_unauth', 'Groups actions of visitors not logged in to Pinterest.', '1 year']]],
  ['hubspot', 'HubSpot', 'marketing', 'https://legal.hubspot.com/privacy-policy', ['hs-scripts.com', 'hs-analytics.net', 'hsforms.net'], [
    ['__hstc', 'Visitor and session tracking.', '6 months'],
    ['hubspotutk', 'Visitor identity for forms.', '6 months'],
    ['__hssc', 'Current session.', '30 minutes'],
    ['__hssrc', 'New session flag.', 'Session'],
  ]],
  ['snapchat', 'Snap Pixel', 'marketing', 'https://values.snap.com/privacy/privacy-policy', ['sc-static.net', 'tr.snapchat.com'], [['_scid', 'Visitor id.', '13 months']]],
  ['reddit', 'Reddit Pixel', 'marketing', 'https://www.reddit.com/policies/privacy-policy', ['redditstatic.com'], [['_rdt_uuid', 'Ad measurement id.', '90 days']]],
  ['adroll', 'AdRoll', 'marketing', 'https://www.nextroll.com/privacy', ['adroll.com'], [['__adroll', 'Visitor id for retargeting.', '1 year']]],
  ['criteo', 'Criteo', 'marketing', 'https://www.criteo.com/privacy/', ['criteo.com', 'criteo.net'], [['cto_bundle', 'Ad personalisation id.', '13 months']]],
  ['youtube', 'YouTube', 'marketing', GOOGLE, ['youtube.com', 'youtube-nocookie.com'], [
    ['VISITOR_INFO1_LIVE', 'Measures bandwidth and playback.', '6 months'],
    ['YSC', 'Session id for embedded videos.', 'Session'],
  ]],
  ['vimeo', 'Vimeo', 'marketing', 'https://vimeo.com/privacy', ['vimeo.com'], [['vuid', 'Playback statistics.', '2 years']]],
  ['google-maps', 'Google Maps', 'marketing', GOOGLE, ['maps.googleapis.com', 'maps.google.com', 'www.google.com/maps'], [['NID', 'Preferences and ad personalisation.', '6 months']]],

  // personalization
  ['intercom', 'Intercom', 'personalization', 'https://www.intercom.com/legal/privacy', ['intercom.io', 'intercomcdn.com'], [
    ['intercom-id-*', 'Anonymous visitor id.', '9 months'],
    ['intercom-session-*', 'Keeps the chat session.', '7 days'],
  ]],
  ['crisp', 'Crisp', 'personalization', 'https://crisp.chat/en/privacy/', ['crisp.chat'], [['crisp-client/*', 'Chat session.', '6 months']]],
  ['drift', 'Drift', 'personalization', 'https://www.drift.com/privacy-policy/', ['drift.com', 'driftt.com'], [
    ['driftt_aid', 'Anonymous visitor id.', '2 years'],
    ['drift_campaign_refresh', 'Campaign display timing.', '30 minutes'],
  ]],
  ['optimizely', 'Optimizely', 'personalization', 'https://www.optimizely.com/legal/privacy-policy/', ['optimizely.com'], [['optimizelyEndUserId', 'Experiment bucketing.', '6 months']]],
  ['vwo', 'VWO', 'personalization', 'https://vwo.com/privacy-policy/', ['visualwebsiteoptimizer.com'], [
    ['_vwo_uuid_v2', 'Experiment visitor id.', '1 year'],
    ['_vis_opt_s', 'Session count.', '100 days'],
  ]],
  ['tawk', 'Tawk.to', 'personalization', 'https://www.tawk.to/privacy-policy/', ['tawk.to'], [
    ['TawkConnectionTime', 'Chat connection.', 'Session'],
    ['twk_uuid_*', 'Visitor id.', '6 months'],
  ]],
];

const ALWAYS = new Set(['tiny-consent']);

function cookieObject(cookie) {
  if (Array.isArray(cookie)) return { name: cookie[0], purpose: cookie[1] || '', duration: cookie[2] || '' };
  return { name: cookie.name, purpose: cookie.purpose || '', duration: cookie.duration || '' };
}

/** Accepts a registry row or an author-supplied object and returns the object form. */
export function normalizeVendor(entry) {
  const v = Array.isArray(entry)
    ? { id: entry[0], name: entry[1], category: entry[2], privacy: entry[3], hosts: entry[4], cookies: entry[5], always: ALWAYS.has(entry[0]) }
    : entry;
  return {
    id: String(v.id),
    name: v.name || v.id,
    category: v.category || 'marketing',
    privacy: v.privacy || '',
    hosts: Array.isArray(v.hosts) ? v.hosts.map((h) => String(h).toLowerCase()) : [],
    cookies: Array.isArray(v.cookies) ? v.cookies.map(cookieObject) : [],
    always: Boolean(v.always),
  };
}

/** Registry merged with per-site overrides (matched by id). */
export function mergeVendors(registry, extra) {
  const byId = new Map();
  registry.forEach((row) => {
    const v = normalizeVendor(row);
    byId.set(v.id, v);
  });
  (Array.isArray(extra) ? extra : []).forEach((row) => {
    if (!row || !row.id) return;
    const v = normalizeVendor(row);
    const current = byId.get(v.id);
    if (!current) {
      byId.set(v.id, v);
      return;
    }
    // Partial override: only the keys the author wrote replace the registry values.
    const patch = {};
    Object.keys(v).forEach((key) => {
      if (key in row) patch[key] = v[key];
    });
    byId.set(v.id, Object.assign({}, current, patch));
  });
  return Array.from(byId.values());
}

/**
 * Cookie name patterns of every known vendor in the given categories, used to delete
 * what a tracker left behind once its category is denied.
 * @param {string[]} categories
 * @param {Array} [extra] per-site vendors (window.TinyConsentVendors)
 */
export function cookiePatternsFor(categories, extra) {
  const wanted = new Set(categories || []);
  const patterns = new Set();
  mergeVendors(REGISTRY, extra).forEach((v) => {
    if (!wanted.has(v.category)) return;
    v.cookies.forEach((c) => patterns.add(c.name));
  });
  return Array.from(patterns);
}

/** URLs and inline text worth matching against vendor hosts. */
export function collectSources(doc) {
  const urls = [];
  let text = '';
  doc.querySelectorAll('script, iframe').forEach((el) => {
    const src = el.getAttribute('data-tc-src') || el.getAttribute('src');
    if (src && !/^(about:|data:|blob:)/.test(src)) urls.push(src);
    if (el.tagName === 'SCRIPT' && !src) text += '\n' + (el.textContent || '');
  });
  doc.querySelectorAll('noscript').forEach((el) => {
    text += '\n' + (el.textContent || '');
  });
  return { urls, text: text.toLowerCase() };
}

/**
 * @param {Document} doc
 * @param {object} [options]
 * @param {Array} [options.registry]  defaults to REGISTRY
 * @param {Array} [options.extra]     per-site additions/overrides (window.TinyConsentVendors)
 * @param {string[]} [options.include] vendor ids to list even when nothing on the page matches
 * @param {number} [options.cookieDays] fills `{days}` in cookie durations
 * @param {string} [options.base]     URL for resolving relative sources
 * @returns {Array<{id,name,category,privacy,cookies}>} sorted by name within category order
 */
export function detectVendors(doc, options) {
  const opts = options || {};
  const vendors = mergeVendors(opts.registry || REGISTRY, opts.extra);
  const include = new Set((opts.include || []).map((id) => String(id).trim()).filter(Boolean));
  const { urls, text } = collectSources(doc);

  const patterns = [];
  vendors.forEach((v) => v.hosts.forEach((host) => patterns.push([host, v.id])));
  const found = new Set();
  urls.forEach((url) => {
    const id = matchPattern(url, patterns, opts.base);
    if (id) found.add(id);
  });
  if (text) {
    vendors.forEach((v) => {
      if (v.hosts.some((host) => text.includes(host))) found.add(v.id);
    });
  }

  const days = String(opts.cookieDays || 180);
  return vendors
    .filter((v) => v.always || include.has(v.id) || found.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      privacy: v.privacy,
      cookies: v.cookies.map((c) => ({ name: c.name, purpose: c.purpose, duration: c.duration.replace('{days}', days) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
