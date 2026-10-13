(() => {
  const header = document.querySelector('[data-site-header]');
  if (!header || header.hasAttribute('data-site-ready')) return;
  header.setAttribute('data-site-ready', '');
  const desktopMenus = Array.from(header.querySelectorAll('[data-site-menu]'));
  const mobileMenu = header.querySelector('[data-site-mobile-menu]');
  const mobileGroups = Array.from(header.querySelectorAll('[data-site-mobile-group]'));
  const disclosures = [...desktopMenus, mobileMenu, ...mobileGroups].filter(Boolean);
  const summary = details => details.querySelector(':scope > summary');
  const themeControls = Array.from(document.querySelectorAll('[data-site-theme]'));
  const theme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  function updateThemeControls() {
    themeControls.forEach(control => {
      control.textContent = theme() === 'dark' ? 'Use light appearance' : 'Use dark appearance';
    });
  }
  themeControls.forEach(control => control.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('detour-theme', next); } catch {}
    updateThemeControls();
  }));
  addEventListener('storage', event => {
    if (event.key !== 'detour-theme' || !['light', 'dark'].includes(event.newValue)) return;
    document.documentElement.setAttribute('data-theme', event.newValue);
    updateThemeControls();
  });
  updateThemeControls();

  function closeMenus({ returnFocus = false } = {}) {
    const active = mobileMenu?.open ? mobileMenu : desktopMenus.find(menu => menu.open);
    const focusedInside = active?.contains(document.activeElement);
    desktopMenus.forEach(menu => { menu.open = false; });
    if (mobileMenu) mobileMenu.open = false;
    if (active && (returnFocus || focusedInside)) {
      const trigger = summary(active);
      // Returning from a breakpoint change must not focus a now-hidden trigger.
      const visibleTrigger = trigger?.getClientRects().length ? trigger : header.querySelector('.site-search-link');
      visibleTrigger?.focus();
    }
  }

  disclosures.forEach(details => {
    const trigger = summary(details);
    trigger?.setAttribute('aria-expanded', String(details.open));
    details.addEventListener('toggle', () => {
      trigger?.setAttribute('aria-expanded', String(details.open));
      if (!details.open) return;
      const siblings = desktopMenus.includes(details) ? desktopMenus : mobileGroups.includes(details) ? mobileGroups : [];
      siblings.forEach(sibling => { if (sibling !== details) sibling.open = false; });
    });
  });

  // Native disclosures remain usable without JavaScript. Enhance dismissal and
  // keyboard movement without changing ordinary link behavior or page actions.
  header.addEventListener('click', event => {
    if (event.target.closest('[data-site-menu-close]')) closeMenus({ returnFocus: true });
    if (event.target.closest('a')) closeMenus();
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeMenus();
    const preferences = event.target.closest('[data-site-consent]');
    if (preferences) document.querySelector('[data-consent-manage]')?.click();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !desktopMenus.some(menu => menu.open) && !mobileMenu?.open) return;
    event.preventDefault();
    closeMenus({ returnFocus: true });
  });
  header.addEventListener('keydown', event => {
    const trigger = event.target.closest('.site-nav-trigger');
    if (!trigger) return;
    const menu = trigger.closest('[data-site-menu]');
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      desktopMenus.forEach(item => { item.open = item === menu; });
      menu.querySelector('.site-menu-panel a')?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = desktopMenus[(desktopMenus.indexOf(menu) + direction + desktopMenus.length) % desktopMenus.length];
      const wasOpen = menu.open;
      closeMenus();
      if (wasOpen) next.open = true;
      summary(next)?.focus();
    }
  });
  // Moving focus to another part of the document closes a dropdown after tabbing
  // through it. This leaves focus where the visitor moved it.
  document.addEventListener('focusin', event => {
    if (!header.contains(event.target)) closeMenus();
  });
  const desktopMode = matchMedia('(min-width: 1024px)');
  desktopMode.addEventListener('change', () => closeMenus());
})();
