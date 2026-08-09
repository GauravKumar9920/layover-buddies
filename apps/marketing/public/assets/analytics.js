/* Consent-aware GA4 loader and a deliberately small, PII-free event contract. */
(function () {
  'use strict';
  var CONSENT_KEY = 'detour-analytics-consent';
  var measurementMeta = document.querySelector('meta[name="detour-ga-id"]');
  var measurementId = measurementMeta ? measurementMeta.getAttribute('content') : '';
  var banner = document.querySelector('[data-consent-banner]');
  var manageButton = document.querySelector('[data-consent-manage]');
  var consent;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (error) {}

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: consent === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  var loaded = false;
  function loadAnalytics() {
    if (loaded || !measurementId || consent !== 'granted') return;
    loaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(script);
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      page_location: location.origin + location.pathname,
      page_title: document.title,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  function setConsent(next) {
    if (next !== 'granted' && next !== 'denied') return;
    consent = next;
    try { localStorage.setItem(CONSENT_KEY, next); } catch (error) {}
    window.gtag('consent', 'update', { analytics_storage: next });
    if (banner) banner.hidden = true;
    if (manageButton) manageButton.hidden = false;
    if (next === 'granted') loadAnalytics();
    try { dispatchEvent(new CustomEvent('detour:analytics-consent', { detail: { status: next } })); } catch (error) {}
  }

  var allowedEvents = ['booking_form_open', 'form_start', 'generate_lead', 'cheat_sheet_download', 'app_store_click'];
  var allowedParameters = ['form_type', 'request_type', 'page_path', 'link_type', 'store'];
  function track(eventName, parameters) {
    if (allowedEvents.indexOf(eventName) === -1 || consent !== 'granted') return;
    var safe = {};
    allowedParameters.forEach(function (key) {
      if (parameters && typeof parameters[key] === 'string') safe[key] = parameters[key].slice(0, 120);
    });
    window.gtag('event', eventName, safe);
  }

  window.DetourAnalytics = { track: track, setConsent: setConsent, getConsent: function () { return consent; } };
  if (consent === 'granted') loadAnalytics();
  else if (consent !== 'denied' && banner) banner.hidden = false;
  if ((consent === 'granted' || consent === 'denied') && manageButton) manageButton.hidden = false;

  document.querySelectorAll('[data-consent-choice]').forEach(function (button) {
    button.addEventListener('click', function () { setConsent(button.getAttribute('data-consent-choice')); });
  });
  if (manageButton) manageButton.addEventListener('click', function () {
    if (banner) banner.hidden = false;
    manageButton.hidden = true;
  });

  document.querySelectorAll('form').forEach(function (form) {
    var started = false;
    form.addEventListener('input', function () {
      if (started) return;
      started = true;
      track('form_start', {
        form_type: form.id === 'booking-form' ? 'detour' : form.id === 'capture-form' ? 'cheat_sheet' : 'other',
        page_path: location.pathname,
      });
    });
  });

  addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!link) return;
    if (/mumbai-layover-cheat-sheet\.pdf(?:$|[?#])/i.test(link.href)) {
      track('cheat_sheet_download', { link_type: 'pdf', page_path: location.pathname });
    }
    if (link.matches('[data-app-store], [href*="apps.apple.com"], [href*="play.google.com/store"]')) {
      track('app_store_click', {
        store: link.href.indexOf('apple.com') >= 0 ? 'ios' : 'android',
        page_path: location.pathname,
      });
    }
  });
})();
