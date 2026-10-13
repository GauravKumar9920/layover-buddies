import { planLayover, formatClock, formatDuration } from '../lib/layover.mjs';

const root = document.querySelector('[data-checker]');
if (root) {
  const form = root.querySelector('[data-checker-form]');
  const error = root.querySelector('[data-checker-error]');
  const result = root.querySelector('[data-checker-result]');
  const empty = root.querySelector('[data-result-empty]');
  const body = root.querySelector('[data-result-body]');
  const places = JSON.parse(root.dataset.places);
  const storageKey = 'detour-layover-check';
  const $ = (name) => root.querySelector(`[data-result-${name}]`);
  let checked = false;

  const verdicts = {
    visa: ['You’ll need a visa first.', 'Without an Indian visa or e-Visa, you stay airside, even for an hour. If there’s time before you fly, the e-Visa is applied for online, in advance. Here’s what your window would allow with one.'],
    stay: ['Stay airside this time.', (o) => `After immigration on the way out and the buffer on the way back, you’d have ${o} outside, and most of it would be spent in a car. Eat well, rest, and save Mumbai for a longer stop.`],
    night: ['Mumbai will mostly be asleep.', (o) => `You’d have ${o} outside, but almost all of it falls between 9 pm and 7 am, when most places are closed or dark. The overnight guide covers how to use a night layover well, including when to simply rest.`],
    tight: ['It’s tight: one stop close by, at most.', (o) => `You’d have about ${o} outside. That can work for one place near the airport if immigration is quick and your inbound flight lands on time. Set a “leave now” alarm before you go.`],
    'near-airport': ['Yes, somewhere close to the airport.', (o) => `About ${o} outside is enough for one place in the western suburbs: Juhu, Bandra or Mount Mary.`],
    central: ['Yes, as far as central Mumbai.', (o) => `About ${o} outside reaches Worli, Mahalaxmi and Prabhadevi, or a slower visit closer to the airport.`],
    south: ['Yes, the old city is within reach.', (o) => `About ${o} outside is enough for South Mumbai: the Gateway, Fort and Marine Drive. Pick one area and do it properly.`],
    further: ['Yes, even a long-layover trip.', (o) => `About ${o} outside leaves room for Elephanta or Kanheri with a generous buffer, or a full day in the city.`],
  };
  const fitLabel = { comfortable: 'Comfortable', tight: 'Tight', no: 'Not this time' };

  function values() {
    const data = new FormData(form);
    return {
      arrival: String(data.get('arrival') || ''),
      departure: String(data.get('departure') || ''),
      onward: data.get('onward'),
      bags: data.get('bags') === 'collect',
      visa: data.get('visa'),
    };
  }

  function item(list, text, className) {
    const li = document.createElement('li');
    if (className) li.className = className;
    if (typeof text === 'string') li.textContent = text; else li.append(...text);
    list.append(li);
    return li;
  }

  function link(href, text) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    return a;
  }

  function render(focus) {
    const input = values();
    const plan = planLayover(input);
    if (plan.error) {
      error.textContent = plan.error;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    empty.hidden = true;
    body.hidden = false;
    const outside = formatDuration(plan.outside);
    const [title, text] = verdicts[plan.verdict];
    $('title').textContent = title;
    $('text').textContent = typeof text === 'function' ? text(outside) : text;

    const timeline = $('timeline');
    timeline.replaceChildren();
    const row = (minutes, label, extra) => {
      const { day, time } = formatClock(minutes);
      const strong = document.createElement('strong');
      strong.textContent = time;
      const span = document.createElement('span');
      span.textContent = ` ${label}`;
      const small = document.createElement('small');
      small.textContent = extra || day;
      item(timeline, [strong, span, small]);
    };
    row(plan.leave - plan.exit, 'Land at BOM');
    row(plan.leave, 'Leave arrivals, roughly', `${formatDuration(plan.exit)} after landing`);
    if (plan.outside > 0) item(timeline, `${outside} outside the airport`, 'window');
    row(plan.returnBy, 'Back at the airport by', `${formatDuration(plan.back)} before you fly`);
    row(plan.returnBy + plan.back, 'Take off');

    const regions = $('regions');
    regions.replaceChildren();
    plan.regions.forEach((region) => {
      const name = document.createElement('span');
      name.textContent = region.label;
      const badge = document.createElement('b');
      badge.textContent = fitLabel[region.fit];
      item(regions, [name, badge], `fit-${region.fit}`);
    });

    const notes = $('notes');
    notes.replaceChildren();
    if (plan.visa === 'no') item(notes, [document.createTextNode('Start with the '), link('/guides/mumbai-layover-visa', 'visa guide'), document.createTextNode('. Rules and processing times differ by nationality.')]);
    if (plan.verdict !== 'night' && plan.outside > 0 && plan.daylight < plan.outside / 2) item(notes, [document.createTextNode('Much of your window falls between 9 pm and 7 am, when most places are closed or dark. See the '), link('/guides/overnight-layover-mumbai', 'overnight layover guide'), document.createTextNode('.')]);
    if (plan.monsoon) item(notes, [document.createTextNode('You land in monsoon season, when heavy rain can slow the roads. Keep a wider buffer; the '), link('/guides/monsoon-layover-mumbai', 'monsoon guide'), document.createTextNode(' has the details.')]);
    if (input.onward === 'domestic') item(notes, 'We’ve allowed 2 hours back at the airport for a flight within India. Check your airline’s advice, and allow extra time if you change terminals.');
    if (input.bags) item(notes, [document.createTextNode('Collecting bags adds time. The '), link('/guides/mumbai-airport-luggage-storage', 'luggage guide'), document.createTextNode(' covers the airport cloakroom.')]);
    notes.hidden = !notes.children.length;

    const fitting = plan.regions.filter((region) => region.fit === 'comfortable').map((region) => region.key);
    const pick = fitting.at(-1) || plan.regions.find((region) => region.fit === 'tight')?.key;
    const box = $('places');
    box.hidden = !pick;
    if (pick) {
      const list = box.querySelector('ul');
      list.replaceChildren();
      const picks = pick === 'further'
        ? [...places.filter((p) => p.region === 'further'), ...places.filter((p) => p.region === 'south')].slice(0, 3)
        : places.filter((p) => p.region === pick).slice(0, 3);
      picks.forEach((place) => {
        const small = document.createElement('small');
        small.textContent = place.time;
        item(list, [link(`/guides/${place.slug}`, place.name), small]);
      });
      $('all').href = `/guides/places?outside=${plan.effective}`;
    }

    const cta = $('cta');
    cta.hidden = ['visa', 'stay', 'night'].includes(plan.verdict);
    cta.href = `/?arrive=${encodeURIComponent(input.arrival)}&depart=${encodeURIComponent(input.departure)}#board`;
    const totalHours = plan.total / 60;
    const guide = plan.verdict === 'visa' ? ['/guides/mumbai-layover-visa', 'Read the visa guide →']
      : plan.outside > 0 && plan.daylight < plan.outside / 2 ? ['/guides/overnight-layover-mumbai', 'Read the overnight guide →']
      : totalHours < 7 ? ['/guides/short-layover-mumbai', 'Read the short-layover guide →']
      : totalHours < 10 ? ['/guides/8-hour-layover-mumbai', 'Read the 8-hour plan →']
      : totalHours < 16 ? ['/guides/12-hour-layover-mumbai', 'Read the 12-hour plan →']
      : ['/guides/complete-mumbai-layover-guide', 'Read the complete guide →'];
    $('guide').href = guide[0];
    $('guide').textContent = guide[1];

    try { sessionStorage.setItem(storageKey, JSON.stringify({ ...input, bags: input.bags ? 'collect' : 'through' })); } catch {}
    if (focus) {
      result.focus({ preventScroll: true });
      if (matchMedia('(max-width: 900px)').matches) result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      window.DetourAnalytics?.track('layover_check', { request_type: plan.verdict, page_path: location.pathname });
    }
  }

  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved) {
      for (const name of ['arrival', 'departure']) if (typeof saved[name] === 'string') form.elements[name].value = saved[name];
      for (const name of ['onward', 'bags', 'visa']) {
        const option = form.querySelector(`input[name="${name}"][value="${saved[name]}"]`);
        if (option) option.checked = true;
      }
      if (saved.arrival && saved.departure) { checked = true; render(false); }
    }
  } catch {}

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    checked = true;
    render(true);
  });
  form.addEventListener('change', () => { if (checked) render(false); });
}
