/* Detour shared conversion and guide-page behaviour.
   Primary submissions go to submit-marketing-lead; FormSubmit remains a
   temporary delivery fallback until the new endpoint has been observed in production. */
(function () {
  'use strict';

  var FALLBACK_ENDPOINT = 'https://formsubmit.co/ajax/admin@detourtrips.com';
  var endpointMeta = document.querySelector('meta[name="detour-lead-endpoint"]');
  var primaryEndpoint = endpointMeta ? endpointMeta.getAttribute('content') : '';

  function track(eventName, parameters) {
    if (window.DetourAnalytics && typeof window.DetourAnalytics.track === 'function') {
      window.DetourAnalytics.track(eventName, parameters || {});
    }
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var focusable = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex="0"]');
    if (focusable.length) focusable[0].focus();
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.btn-trigger-booking').forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault();
      closeModal('route-modal');
      openModal('booking-modal');
      track('booking_form_open', { form_type: 'detour', page_path: location.pathname });
    });
  });
  document.querySelectorAll('.modal-close').forEach(function (button) {
    button.addEventListener('click', function () {
      var modal = button.closest('.modal-overlay');
      if (modal) closeModal(modal.id);
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(function (modal) {
    modal.addEventListener('click', function (event) { if (event.target === modal) closeModal(modal.id); });
  });
  addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(function (modal) { closeModal(modal.id); });
    }
  });

  function attribution(source) {
    if (!source || typeof source !== 'object') return undefined;
    var allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'captured_at', 'landing_page', 'referrer'];
    var result = {};
    allowed.forEach(function (key) {
      if (typeof source[key] === 'string' && source[key]) result[key] = source[key].slice(0, 2048);
    });
    return Object.keys(result).length ? result : undefined;
  }

  function buildPayload(form, requestType) {
    var fields = Object.fromEntries(new FormData(form).entries());
    var payload = {
      requestType: requestType,
      contact: {
        email: String(fields.email || '').trim(),
      },
      landingPage: location.pathname,
      firstAttribution: attribution(window.DetourUTM && window.DetourUTM.first),
      lastAttribution: attribution(window.DetourUTM && window.DetourUTM.last),
      honeypot: String(fields._honey || ''),
    };

    if (requestType === 'detour') {
      payload.contact.name = String(fields.name || '').trim();
      payload.layover = {
        arrival: String(fields.arrival || '').trim(),
        departure: String(fields.departure || '').trim(),
        flightNumbers: String(fields.flights || '').trim(),
        interests: String(fields.interests || '').trim(),
      };
    }
    return payload;
  }

  async function submitPrimary(payload) {
    if (!primaryEndpoint) {
      var missingEndpoint = new Error('primary endpoint is not configured');
      missingEndpoint.fallbackEligible = true;
      throw missingEndpoint;
    }
    var response;
    try {
      response = await fetch(primaryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      networkError.fallbackEligible = true;
      throw networkError;
    }
    var responseBody = await response.json().catch(function () { return null; });
    if (response.status === 202) return { accepted: true, synthetic: true };
    if (response.status >= 500) {
      var serverError = new Error('primary service unavailable');
      serverError.fallbackEligible = true;
      throw serverError;
    }
    if (!response.ok) {
      var requestError = new Error('primary submission rejected');
      requestError.fallbackEligible = false;
      throw requestError;
    }
    if (!response.ok || !responseBody || !responseBody.data || !responseBody.data.leadId || responseBody.error) {
      var contractError = new Error('primary submission returned an invalid response');
      contractError.fallbackEligible = false;
      throw contractError;
    }
    return { accepted: true, synthetic: false, leadId: responseBody.data.leadId };
  }

  async function submitFallback(form, requestType) {
    var fields = Object.fromEntries(new FormData(form).entries());
    fields._subject = requestType === 'detour' ? 'Detour request (temporary fallback)' : 'Cheat sheet request (temporary fallback)';
    fields._template = 'table';
    var response = await fetch(FALLBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!response.ok) throw new Error('fallback submission failed');
    return { accepted: true, fallback: true };
  }

  async function submitLead(form, requestType) {
    var payload = buildPayload(form, requestType);
    try {
      var result = await submitPrimary(payload);
      if (!result.synthetic) {
        track('generate_lead', { request_type: requestType, form_type: requestType, page_path: location.pathname });
      }
      return result;
    } catch (primaryError) {
      if (primaryError && primaryError.fallbackEligible === false) throw primaryError;
      return submitFallback(form, requestType);
    }
  }

  var bookingForm = document.getElementById('booking-form');
  if (bookingForm) bookingForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;
    var button = document.getElementById('booking-submit');
    if (button) { button.setAttribute('disabled', ''); button.setAttribute('aria-busy', 'true'); }
    try {
      await submitLead(bookingForm, 'detour');
      bookingForm.style.display = 'none';
      var success = document.getElementById('booking-success');
      if (success) success.classList.add('show');
    } catch (error) {
      bookingForm.style.display = 'none';
      var failure = document.getElementById('booking-error');
      if (failure) failure.classList.add('show');
    }
  });

  var captureForm = document.getElementById('capture-form');
  if (captureForm) captureForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!captureForm.reportValidity()) return;
    try {
      await submitLead(captureForm, 'cheat_sheet');
      captureForm.style.display = 'none';
      var done = document.getElementById('capture-done');
      if (done) done.style.display = 'inline';
    } catch (error) {
      var status = captureForm.querySelector('[data-form-error]');
      if (!status) {
        status = document.createElement('span');
        status.setAttribute('data-form-error', '');
        status.setAttribute('role', 'alert');
        captureForm.appendChild(status);
      }
      status.textContent = 'That did not send. Please try again or email admin@detourtrips.com.';
    }
  });

  // Shared guide-only behaviour. The homepage retains its richer route and menu interactions.
  if (document.querySelector('.guide-hero')) {
    var nav = document.getElementById('nav');
    if (nav) addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 20); }, { passive: true });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (element, index) {
      element.style.transitionDelay = ((index % 4) * 60) + 'ms';
      observer.observe(element);
    });

    var root = document.documentElement;
    var themeButton = document.getElementById('theme-toggle');
    if (themeButton) themeButton.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('detour-theme', next); } catch (error) {}
    });
  }

  if (!document.getElementById('route-rail')) {
    var seen = {};
    var headings = [];
    document.querySelectorAll('.guide-body h2, main h2, [data-secnav] h2').forEach(function (heading) {
      var section = heading.closest('section[id]');
      var id = heading.id || (section && section.id);
      if (!id || !/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(id)) {
        id = (heading.textContent || 'section').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-') || 'section';
        if (!/^[A-Za-z]/.test(id)) id = 'section-' + id;
        heading.id = id;
      }
      if (seen[id]) return;
      seen[id] = true;
      headings.push({ id: id, element: document.getElementById(id) || heading, label: (heading.textContent || '').trim() });
    });
    if (headings.length > 1) {
      var fab = document.createElement('button');
      fab.className = 'secnav-fab';
      fab.setAttribute('aria-expanded', 'false');
      fab.textContent = 'Jump to';
      var panel = document.createElement('div');
      panel.className = 'secnav-panel';
      panel.setAttribute('aria-hidden', 'true');
      var panelTitle = document.createElement('div');
      panelTitle.className = 'secnav-title';
      panelTitle.textContent = 'On this page';
      panel.appendChild(panelTitle);
      headings.forEach(function (heading) {
        var link = document.createElement('a');
        link.className = 'secnav-link';
        link.href = '#' + encodeURIComponent(heading.id);
        link.textContent = heading.label;
        panel.appendChild(link);
      });
      document.body.appendChild(panel);
      document.body.appendChild(fab);
      fab.addEventListener('click', function () {
        var open = !panel.classList.contains('open');
        panel.classList.toggle('open', open);
        fab.classList.toggle('open', open);
        fab.setAttribute('aria-expanded', String(open));
        panel.setAttribute('aria-hidden', String(!open));
      });
      panel.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', function () { panel.classList.remove('open'); }); });
      var toggleFab = function () { fab.classList.toggle('show', scrollY > 320); };
      addEventListener('scroll', toggleFab, { passive: true });
      toggleFab();
    }
  }
})();
