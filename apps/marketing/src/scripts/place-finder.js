import { REGIONS, optionFor } from '../lib/layover.mjs';

// Place directory: theme and time filters, plus a lazily loaded map.
const finder = document.querySelector('[data-place-finder]');
if (finder) {
  finder.hidden = false;
  const chips = [...finder.querySelectorAll('[data-theme]')];
  const select = finder.querySelector('[data-outside]');
  const status = finder.querySelector('[data-finder-status]');
  const empty = finder.querySelector('[data-finder-empty]');
  const cards = [...document.querySelectorAll('.place-region .place-card')];
  const sections = [...document.querySelectorAll('.place-region')];
  const mapNode = finder.querySelector('[data-place-map]');
  const mapPlaces = JSON.parse(mapNode.dataset.places);
  const comfortable = Object.fromEntries(REGIONS.map((region) => [region.key, region.comfortable]));
  const markers = new Map();
  let theme = '';
  let outside = 0;

  const params = new URLSearchParams(location.search);
  if (chips.some((chip) => chip.dataset.theme === params.get('theme'))) theme = params.get('theme');
  if (params.has('outside')) outside = optionFor(Number(params.get('outside')));
  select.value = String(outside);

  const matches = (themes, region) =>
    (!theme || themes.includes(theme)) && (outside === 0 || (outside > 1 && comfortable[region] <= outside));

  function apply(updateUrl) {
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.theme === theme)));
    let shown = 0;
    cards.forEach((card) => {
      const visible = matches(card.dataset.themes.split(' '), card.dataset.region);
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    sections.forEach((section) => { section.hidden = !section.querySelector('.place-card:not([hidden])'); });
    mapPlaces.forEach((place) => {
      const marker = markers.get(place.slug);
      if (marker) marker.getElement()?.classList.toggle('is-dimmed', !matches(place.themes, place.region));
    });
    empty.hidden = outside !== 1;
    status.textContent = outside === 1 ? '' : shown === cards.length ? `Showing all ${shown} places.` : `Showing ${shown} of ${cards.length} places.`;
    if (updateUrl) {
      const next = new URL(location.href);
      theme ? next.searchParams.set('theme', theme) : next.searchParams.delete('theme');
      next.searchParams.delete('outside');
      if (outside) next.searchParams.set('outside', String(outside === 1 ? 60 : outside));
      history.replaceState(null, '', next);
    }
  }

  chips.forEach((chip) => chip.addEventListener('click', () => { theme = chip.dataset.theme; apply(true); }));
  select.addEventListener('change', () => { outside = Number(select.value); apply(true); });
  apply(false);

  // Leaflet (and its tiles) only load once the map is about to scroll into view.
  const loadMap = async () => {
    const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
    const map = L.map(mapNode, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      zoomSnap: 0.25,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    const dot = (className, label) => L.divIcon({ className: `map-dot ${className}`, html: `<span aria-hidden="true">${label}</span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] });
    const bounds = [];
    mapPlaces.forEach((place) => {
      const popup = document.createElement('div');
      popup.className = 'map-popup';
      const small = document.createElement('small');
      small.textContent = place.area;
      const link = document.createElement('a');
      link.href = `/guides/${place.slug}`;
      link.textContent = place.name;
      const time = document.createElement('p');
      time.textContent = place.time;
      popup.append(small, link, time);
      const marker = L.marker([place.lat, place.lng], { icon: dot(place.region, ''), title: place.name, alt: place.name, riseOnHover: true }).bindPopup(popup).addTo(map);
      markers.set(place.slug, marker);
      bounds.push([place.lat, place.lng]);
    });
    const airport = [19.08861, 72.86806];
    L.marker(airport, { icon: L.divIcon({ className: 'map-dot airport', html: '<span>✈</span>', iconSize: [26, 26], iconAnchor: [13, 13] }), title: 'Mumbai airport (BOM), Terminals 1 and 2', alt: 'Mumbai airport' })
      .bindPopup('<div class="map-popup"><small>Chhatrapati Shivaji Maharaj International Airport</small><strong>BOM · Terminals 1 and 2</strong></div>')
      .addTo(map);
    bounds.push(airport);
    map.fitBounds(bounds, { padding: [24, 24] });
    apply(false);
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      loadMap().catch(() => { mapNode.closest('.place-map-wrap').hidden = true; });
    }
  }, { rootMargin: '300px' });
  observer.observe(mapNode);
}
