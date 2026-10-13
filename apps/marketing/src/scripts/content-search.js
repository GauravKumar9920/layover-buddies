/** Public content search. The index comes from the resolved release registry. */
export function normalizeSearch(value) {
  return String(value || '').normalize('NFKD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}

export function contentSearchScore(item, query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return 1;
  const heading = normalizeSearch(`${item.navigationTitle || ''} ${item.title || ''}`);
  const aliases = normalizeSearch((item.aliases || []).join(' '));
  const tags = normalizeSearch((item.tags || []).join(' '));
  const searchable = `${heading} ${aliases} ${tags} ${normalizeSearch(item.summary)} ${normalizeSearch(item.group)}`;
  const tokens = normalized.split(' ');
  if (!tokens.every(token => searchable.includes(token))) return 0;
  return (heading.includes(normalized) ? 30 : 0)
    + (aliases.includes(normalized) ? 20 : 0)
    + tokens.reduce((score, token) => score + (heading.includes(token) ? 5 : aliases.includes(token) ? 3 : tags.includes(token) ? 2 : 1), 0);
}

/** Galleries stay with their place, including when the photo type is selected. */
export function searchContent(items, { query = '', section = '', kind = '' } = {}) {
  const primary = items.filter(item => item.kind !== 'gallery');
  const galleries = items.filter(item => item.kind === 'gallery');
  return primary.map(item => {
    if (section && item.section !== section) return undefined;
    const children = galleries.filter(gallery => gallery.parentRoute === item.route);
    if (kind === 'gallery' && !children.length) return undefined;
    if (kind === 'walk' && item.group !== 'self-guided-walks') return undefined;
    if (kind === 'time-plan' && item.group !== 'by-time') return undefined;
    if (kind === 'service-answer' && !(item.section === 'detour' && item.kind === 'guide')) return undefined;
    if (kind && !['gallery', 'walk', 'time-plan', 'service-answer'].includes(kind) && item.kind !== kind) return undefined;
    const score = Math.max(contentSearchScore(item, query), ...children.map(child => contentSearchScore(child, query)));
    return score > 0 ? { route: item.route, score } : undefined;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

function initializeContentSearch() {
  const root = document.querySelector('[data-content-search]');
  if (!root) return;
  const indexNode = root.querySelector('[data-content-search-index]');
  let index;
  try { index = JSON.parse(indexNode?.textContent || '[]'); } catch { return; }
  if (!Array.isArray(index)) return;
  const form = root.querySelector('[data-search-form]');
  const query = root.querySelector('[data-search-query]');
  const section = root.querySelector('[data-search-section]');
  const kind = root.querySelector('[data-search-kind]');
  const results = root.querySelector('[data-search-results]');
  const status = root.querySelector('[data-search-status]');
  const empty = root.querySelector('[data-search-empty]');
  if (!form || !query || !section || !kind || !results || !status || !empty) return;
  const cards = new Map([...results.querySelectorAll('[data-search-route]')].map(card => [card.dataset.searchRoute, card]));
  const validValue = (control, value) => [...control.options].some(option => option.value === value) ? value : '';
  const readUrl = () => {
    const parameters = new URLSearchParams(location.search);
    query.value = (parameters.get('q') || '').slice(0, 250);
    section.value = validValue(section, parameters.get('section') || '');
    kind.value = validValue(kind, parameters.get('kind') || '');
  };
  const update = (persist = true) => {
    const matching = searchContent(index, { query: query.value, section: section.value, kind: kind.value });
    const matchingRoutes = new Set(matching.map(item => item.route));
    cards.forEach((card, route) => { card.hidden = !matchingRoutes.has(route); });
    // Move existing, safely rendered cards; no search or CMS text is parsed as HTML.
    matching.forEach(item => { const card = cards.get(item.route); if (card) results.append(card); });
    empty.hidden = matching.length > 0;
    results.hidden = !matching.length;
    const phrase = query.value.trim();
    const photoLabel = kind.value === 'gallery' ? ' place' : ' result';
    status.textContent = `${matching.length}${photoLabel}${matching.length === 1 ? '' : 's'}${phrase ? ` for “${phrase}”` : ''}${kind.value === 'gallery' ? ' with photographs' : ''}.${!kind.value ? ' Place photographs are grouped with their field note.' : ''}`;
    if (persist) {
      const url = new URL(location.href);
      ['q', 'section', 'kind'].forEach(key => url.searchParams.delete(key));
      if (phrase) url.searchParams.set('q', phrase);
      if (section.value) url.searchParams.set('section', section.value);
      if (kind.value) url.searchParams.set('kind', kind.value);
      history.replaceState(null, '', url);
    }
  };
  const clear = () => {
    query.value = ''; section.value = ''; kind.value = '';
    update(); query.focus();
  };
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  let timer;
  query.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 100); });
  [section, kind].forEach(control => control.addEventListener('change', () => update()));
  root.querySelector('[data-search-clear]')?.addEventListener('click', clear);
  root.querySelector('[data-search-reset]')?.addEventListener('click', clear);
  addEventListener('popstate', () => { readUrl(); update(false); });
  root.querySelector('[data-search-filters]').hidden = false;
  readUrl(); update(false);
}

if (typeof document !== 'undefined') initializeContentSearch();
