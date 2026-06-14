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
