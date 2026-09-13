const gallery = document.querySelector('.photo-browser');
if (gallery) {
  const track = gallery.querySelector('.slide-track');
  const slides = [...gallery.querySelectorAll('.photo-slide')];
  const dots = [...gallery.querySelectorAll('[data-slide]')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let paused = motion.matches;
  let hovered = false;
  let focused = false;
  let visible = false;
  let timer;

  function schedule() {
    clearTimeout(timer);
    if (!paused && !hovered && !focused && visible && !document.hidden) {
      timer = setTimeout(() => { show(current + 1); schedule(); }, 5000);
    }
  }
  function show(index, manual = false) {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    slides.forEach((slide, i) => {
      slide.setAttribute('aria-hidden', String(i !== current));
      slide.tabIndex = i === current ? 0 : -1;
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
    if (manual) gallery.querySelector('[data-announcement]').textContent = `Photo ${current + 1} of ${slides.length}`;
  }
  dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i, true); schedule(); }));
  gallery.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  gallery.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  gallery.addEventListener('focusin', () => { focused = true; schedule(); });
  gallery.addEventListener('focusout', () => { queueMicrotask(() => { focused = gallery.contains(document.activeElement); schedule(); }); });
  gallery.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1), true);
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { paused = motion.matches; schedule(); });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: 0.3 }).observe(gallery.querySelector('.slide-window'));
}
