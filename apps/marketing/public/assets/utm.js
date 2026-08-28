/* Detour — consent-aware, first-party campaign attribution.
   Current-page campaign values stay in memory so a visitor can submit the
   request they asked for. Persistent first/last-touch storage is optional,
   starts only after analytics consent, expires, and excludes advertising
   click identifiers. */
(function () {
  'use strict';

  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var FIRST_KEY = 'detour_attr_first';
  var LAST_KEY = 'detour_attr_last';
  var FIRST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

  function safeParse(value) {
    try { return JSON.parse(value) || {}; } catch (error) { return {}; }
  }

  function removeStore(key, store) {
    try { store.removeItem(key); } catch (error) {}
  }

  function sanitizeTouch(value) {
    var clean = {};
    if (!value || typeof value !== 'object') return clean;
    PARAMS.forEach(function (key) {
      if (typeof value[key] === 'string' && value[key]) clean[key] = value[key].slice(0, 256);
    });
    ['captured_at', 'expires_at', 'landing_page', 'referrer'].forEach(function (key) {
      if (typeof value[key] === 'string' && value[key]) clean[key] = value[key].slice(0, 2048);
    });
    return clean;
  }

  function readStore(key, store) {
    try {
      var value = sanitizeTouch(safeParse(store.getItem(key)));
      var capturedTime = Date.parse(value.captured_at);
      if (!value.captured_at || !Number.isFinite(capturedTime)) {
        removeStore(key, store);
        return {};
      }
      if (!value.expires_at) value.expires_at = new Date(capturedTime + FIRST_TOUCH_TTL_MS).toISOString();
      if (Date.parse(value.expires_at) <= Date.now()) {
        removeStore(key, store);
        return {};
      }
      return value;
    } catch (error) {
      return {};
    }
  }

  function writeStore(key, value, store) {
    try { store.setItem(key, JSON.stringify(sanitizeTouch(value))); } catch (error) {}
  }

  function readQuery() {
    var out = {};
    try {
      var search = new URLSearchParams(location.search);
      PARAMS.forEach(function (key) {
        var value = search.get(key);
        if (value) out[key] = value.slice(0, 256);
      });
    } catch (error) {}
    return out;
  }

  function referrerOrigin(value) {
    if (!value) return '(direct)';
    try { return new URL(value).origin; } catch (error) { return '(referral)'; }
  }

  function referrerSource(value) {
    if (!value || value === '(direct)') return '(direct)';
    try { return new URL(value).hostname.replace(/^www\./, ''); } catch (error) { return '(referral)'; }
  }

  function hasCampaign(value) {
    return PARAMS.some(function (key) { return value && value[key]; });
  }

  function hasStorageConsent() {
    return Boolean(
      window.DetourAnalytics
      && typeof window.DetourAnalytics.getConsent === 'function'
      && window.DetourAnalytics.getConsent() === 'granted'
    );
  }

  var current = readQuery();
  var capturedAt = new Date().toISOString();
  var ephemeralTouch = Object.assign({}, current, {
    captured_at: capturedAt,
    expires_at: new Date(Date.now() + FIRST_TOUCH_TTL_MS).toISOString(),
    landing_page: location.pathname,
    referrer: referrerOrigin(document.referrer),
  });
  var first = ephemeralTouch;
  var last = ephemeralTouch;
  var effective = ephemeralTouch;
  var fields = {};

  function buildFields() {
    return {
      utm_source: effective.utm_source || '',
      utm_medium: effective.utm_medium || '',
      utm_campaign: effective.utm_campaign || '',
      utm_term: effective.utm_term || '',
      utm_content: effective.utm_content || '',
      attribution_first_source: first.utm_source || referrerSource(first.referrer),
      attribution_first_seen: first.captured_at || '',
      attribution_landing: first.landing_page || location.pathname,
      attribution_referrer: first.referrer || referrerOrigin(document.referrer),
    };
  }

  function stampForms() {
    document.querySelectorAll('form').forEach(function (form) {
      form.querySelectorAll('[data-detour-attribution]').forEach(function (input) { input.remove(); });
      Object.keys(fields).forEach(function (name) {
        if (!fields[name]) return;
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = fields[name];
        input.setAttribute('data-detour-attribution', '');
        form.appendChild(input);
      });
    });
  }

  function publish() {
    fields = buildFields();
    window.DetourUTM = {
      current: current,
      first: first,
      last: last,
      effective: effective,
      fields: fields,
    };
    stampForms();
  }

  function refreshAttribution() {
    if (!hasStorageConsent()) {
      removeStore(FIRST_KEY, window.localStorage);
      removeStore(LAST_KEY, window.sessionStorage);
      first = ephemeralTouch;
      last = ephemeralTouch;
      effective = ephemeralTouch;
      publish();
      return;
    }

    first = readStore(FIRST_KEY, window.localStorage);
    if (!first.captured_at) first = ephemeralTouch;

    last = readStore(LAST_KEY, window.sessionStorage);
    if (hasCampaign(current) || !last.captured_at) last = ephemeralTouch;

    // Rewrite sanitized values so older click identifiers are removed and the
    // expiration policy applies to data created by previous site versions.
    writeStore(FIRST_KEY, first, window.localStorage);
    writeStore(LAST_KEY, last, window.sessionStorage);
    effective = hasCampaign(current) ? ephemeralTouch : (hasCampaign(last) ? last : first);
    publish();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshAttribution, { once: true });
  } else {
    refreshAttribution();
  }
  addEventListener('detour:analytics-consent', refreshAttribution);
})();
