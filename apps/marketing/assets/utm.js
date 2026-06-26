/* Detour — UTM attribution tracker.
   Captures campaign parameters the moment a visitor lands, remembers the
   first touch (forever) and the last touch (this session), forwards them to
   Google Analytics, and stamps them as hidden fields on every form so each
   FormSubmit lead email shows exactly where it came from.

   Loads on every page (index, careers, guides) so attribution is captured no
   matter which page a campaign link points at. Zero dependencies. */
(function () {
  'use strict';

  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'gclid', 'fbclid', 'msclkid'];
  var FIRST_KEY = 'detour_attr_first';   // localStorage  — first ever touch
  var LAST_KEY  = 'detour_attr_last';    // sessionStorage — most recent campaign

  function safeParse(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }
  function readStore(key, store) { try { return safeParse(store.getItem(key)); } catch (e) { return {}; } }
  function writeStore(key, obj, store) { try { store.setItem(key, JSON.stringify(obj)); } catch (e) {} }

  // 1. Read campaign params off the current URL.
  function readQuery() {
    var out = {};
    try {
      var sp = new URLSearchParams(location.search);
      PARAMS.forEach(function (k) {
        var v = sp.get(k);
        if (v) out[k] = v.slice(0, 256); // guard against junk-length values
      });
    } catch (e) {}
    return out;
  }

  var current = readQuery();
  var hasCampaign = Object.keys(current).length > 0;
  var nowISO = new Date().toISOString();
  var landing = location.pathname + location.search;
  var referrer = document.referrer || '(direct)';

  // 2. First touch — written once, never overwritten. Captures the very first
  //    arrival even if it was direct (no utm), so we always have an origin.
  var first = readStore(FIRST_KEY, window.localStorage);
  if (!first || !first.captured_at) {
    first = Object.assign({}, current, {
      captured_at: nowISO,
      landing_page: landing,
      referrer: referrer
    });
    writeStore(FIRST_KEY, first, window.localStorage);
  }

  // 3. Last touch — refreshed whenever a new campaign link is followed.
  var last = readStore(LAST_KEY, window.sessionStorage);
  if (hasCampaign || !last || !last.captured_at) {
    last = Object.assign({}, current, {
      captured_at: nowISO,
      landing_page: landing,
      referrer: referrer
    });
    writeStore(LAST_KEY, last, window.sessionStorage);
  }

  // 4. Effective attribution = last touch if it carries a campaign, else first.
  var effective = hasCampaign ? current : (lastHasCampaign(last) ? last : first);
  function lastHasCampaign(obj) {
    return PARAMS.some(function (k) { return obj && obj[k]; });
  }

  // 5. Forward to Google Analytics (GA4 also auto-captures utm on the landing
  //    page_view; this makes the persisted first/last touch explicit too).
  try {
    window.dataLayer = window.dataLayer || [];
    if (hasCampaign) {
      window.dataLayer.push(Object.assign({ event: 'utm_capture' }, current));
    }
    if (typeof window.gtag === 'function') {
      window.gtag('set', 'user_properties', {
        first_touch_source: first.utm_source || referrerSource(first.referrer),
        first_touch_campaign: first.utm_campaign || '(none)',
        last_touch_source: effective.utm_source || referrerSource(referrer)
      });
    }
  } catch (e) {}

  function referrerSource(ref) {
    if (!ref || ref === '(direct)') return '(direct)';
    try { return new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return '(referral)'; }
  }

  // 6. Stamp hidden fields onto every form so FormSubmit emails carry the
  //    attribution. Works with both the inline homepage handlers and
  //    assets/booking.js because both read the form via FormData at submit time.
  var fields = {
    utm_source:   effective.utm_source   || '',
    utm_medium:   effective.utm_medium   || '',
    utm_campaign: effective.utm_campaign || '',
    utm_term:     effective.utm_term     || '',
    utm_content:  effective.utm_content  || '',
    gclid:        effective.gclid        || '',
    fbclid:       effective.fbclid       || '',
    attribution_first_source: first.utm_source || referrerSource(first.referrer),
    attribution_first_seen:   first.captured_at || '',
    attribution_landing:      first.landing_page || landing,
    attribution_referrer:     first.referrer || referrer
  };

  function stampForms() {
    document.querySelectorAll('form').forEach(function (form) {
      Object.keys(fields).forEach(function (name) {
        var value = fields[name];
        if (!value) return;                                   // skip empties — keep emails tidy
        if (form.querySelector('[name="' + name + '"]')) return; // don't clobber existing
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', stampForms);
  } else {
    stampForms();
  }

  // 7. Expose a small read-only API for debugging / future use.
  window.DetourUTM = {
    current: current,
    first: first,
    last: last,
    effective: effective,
    fields: fields
  };
})();
