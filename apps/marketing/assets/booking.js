/* Detour — shared guide-page behaviour: nav scroll, reveal, modal, FormSubmit.
   Mirrors the homepage logic so the booking modal works identically on /guides/. */
(function () {
  // Nav scroll behaviour
  var nav = document.getElementById('nav');
  if (nav) addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 20); });

  // Reveal-on-scroll
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(function (el, i) { el.style.transitionDelay = (i % 4 * 60) + 'ms'; io.observe(el); });

  // Modal helpers
  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var f = m.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]');
    if (f.length) f[0].focus();
  }
  function closeModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(function (m) { closeModal(m.id); });
  });
  document.querySelectorAll('.modal-overlay').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(m.id); });
  });
  document.querySelectorAll('.modal-close').forEach(function (b) {
    b.addEventListener('click', function () { closeModal(b.closest('.modal-overlay').id); });
  });
  document.querySelectorAll('.btn-trigger-booking').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openModal('booking-modal'); });
  });

  // Booking form → FormSubmit (free, no backend; same inbox as the homepage)
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/admin@detourtrips.com';
  var bookingForm = document.getElementById('booking-form');
  if (bookingForm) bookingForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!bookingForm.reportValidity()) return;
    var btn = document.getElementById('booking-submit');
    if (btn) { btn.setAttribute('disabled', ''); btn.firstChild.textContent = 'Sending… '; }
    var data = Object.fromEntries(new FormData(bookingForm).entries());
    data._subject = 'Detour request (from a guide page)';
    data._template = 'table';
    try {
      var res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('send failed');
      bookingForm.style.display = 'none';
      document.getElementById('booking-success').classList.add('show');
    } catch (err) {
      bookingForm.style.display = 'none';
      document.getElementById('booking-error').classList.add('show');
    }
  });

  // Cheat-sheet email capture → same FormSubmit inbox
  var captureForm = document.getElementById('capture-form');
  if (captureForm) captureForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!captureForm.reportValidity()) return;
    var data = Object.fromEntries(new FormData(captureForm).entries());
    data._subject = 'Cheat sheet request (from a guide page)';
    try {
      await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) { /* fall through — still show confirmation */ }
    captureForm.style.display = 'none';
    document.getElementById('capture-done').style.display = 'inline';
  });
})();

/* Theme toggle — light/dark, persisted (mirrors the homepage). The no-flash
   init lives inline in each page's <head>; this just wires the button. */
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('detour-theme', next); } catch (e) {}
  });
})();

/* Floating "Jump to" section nav — auto-built from the page's own h2[id]s, so
   every guide (and the hub) gets it with zero per-page markup. Mirrors the
   homepage FAB; fills the mobile gap where the sticky TOC is hidden. */
(function () {
  var seen = {};
  var heads = [];
  [].slice.call(document.querySelectorAll('.guide-body h2, main h2, [data-secnav] h2')).forEach(function (h) {
    var sec = h.closest('section[id]');
    var id = h.id || (sec && sec.id);          // id may sit on the heading (guides) or its section (hub)
    if (!id || seen[id]) return;
    seen[id] = 1;
    heads.push({ id: id, el: document.getElementById(id) || h, label: (h.textContent || '').trim() });
  });
  if (heads.length < 2) return;

  var fab = document.createElement('button');
  fab.className = 'secnav-fab';
  fab.id = 'secnav-fab';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'secnav-panel');
  fab.setAttribute('aria-label', 'Jump to a section');
  fab.innerHTML =
    '<svg class="ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' +
    '<svg class="ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '<span class="lbl">Jump to</span>';

  var scrim = document.createElement('div');
  scrim.className = 'secnav-scrim';
  scrim.id = 'secnav-scrim';

  var panel = document.createElement('div');
  panel.className = 'secnav-panel';
  panel.id = 'secnav-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Jump to a section');
  panel.setAttribute('aria-hidden', 'true');
  var html = '<div class="secnav-title">On this page</div>';
  heads.forEach(function (h) {
    html += '<a class="secnav-link" href="#' + h.id + '">' + h.label + '</a>';
  });
  panel.innerHTML = html;

  document.body.appendChild(scrim);
  document.body.appendChild(panel);
  document.body.appendChild(fab);

  function setPanel(open) {
    fab.classList.toggle('open', open);
    panel.classList.toggle('open', open);
    scrim.classList.toggle('show', open);
    fab.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  }
  fab.addEventListener('click', function () { setPanel(!panel.classList.contains('open')); });
  scrim.addEventListener('click', function () { setPanel(false); });
  panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setPanel(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') setPanel(false); });

  var toggleFab = function () { fab.classList.toggle('show', scrollY > 320); };
  addEventListener('scroll', toggleFab, { passive: true });
  toggleFab();

  var links = [].slice.call(panel.querySelectorAll('.secnav-link'));
  var spy = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        var id = e.target.getAttribute('id');
        links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + id); });
      }
    });
  }, { threshold: .1, rootMargin: '-80px 0px -55% 0px' });
  heads.forEach(function (h) { spy.observe(h.el); });
})();
