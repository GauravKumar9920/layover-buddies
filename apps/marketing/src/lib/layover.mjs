// Layover timing rules shared by the layover checker and the place directory filter.
// They mirror the allowances in the guides (short-layover, 8-hour and complete guides):
// 45–90 minutes to leave arrivals, around 3 hours back before an international departure,
// and 20–45 / 30–60 / 45–75 minute drives each way to the three city regions.

export const EXIT_MINUTES = { carryOn: 60, bags: 90 };
export const RETURN_MINUTES = { international: 180, domestic: 120 };

// comfortable: time outside the airport (leaving arrivals → back at departures) that
// covers cautious road times plus a real visit. tight: only with quick immigration,
// kind traffic and one stop. Long-layover trips are never "tight".
export const REGIONS = [
  { key: 'near-airport', label: 'Close to the airport', drive: '20–45 min each way', comfortable: 150, tight: 105 },
  { key: 'central', label: 'Central Mumbai', drive: '30–60 min each way', comfortable: 180, tight: 135 },
  { key: 'south', label: 'South Mumbai', drive: '45–75 min each way, or the Aqua Line', comfortable: 240, tight: 180 },
  { key: 'further', label: 'Elephanta and Kanheri', drive: 'a ferry or a forest road on top of the drive', comfortable: 420, tight: null },
];

// Directory filter options: the value is the minimum time outside (minutes) the option stands for.
export const OUTSIDE_OPTIONS = [
  { value: 0, label: 'Any amount of time' },
  { value: 1, label: 'Under 2½ hours' },
  { value: 150, label: '2½–3 hours' },
  { value: 180, label: '3–4 hours' },
  { value: 240, label: '4–7 hours' },
  { value: 420, label: '7 hours or more' },
];

export function regionFit(region, outsideMinutes) {
  if (outsideMinutes >= region.comfortable) return 'comfortable';
  if (region.tight !== null && outsideMinutes >= region.tight) return 'tight';
  return 'no';
}

// Largest option that the given time outside satisfies (used for ?outside= links).
export function optionFor(outsideMinutes) {
  if (!(outsideMinutes > 0)) return 0;
  return OUTSIDE_OPTIONS.filter((option) => option.value > 0 && option.value <= outsideMinutes).at(-1)?.value ?? 1;
}

// Parse a datetime-local value ("2026-10-14T09:30") as Mumbai time, in minutes since the epoch.
export function mumbaiMinutes(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return NaN;
  const [, y, mo, d, h, mi] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60000 - 330;
}

export function planLayover({ arrival, departure, bags, onward, visa }) {
  const land = mumbaiMinutes(arrival);
  const fly = mumbaiMinutes(departure);
  if (!Number.isFinite(land) || !Number.isFinite(fly)) return { error: 'Add both times to see your window.' };
  const total = fly - land;
  if (total <= 0) return { error: 'Your departure needs to be after your arrival. Check the date for an overnight layover.' };
  if (total > 72 * 60) return { error: 'That’s more than three days. For a stay this long, you have time to plan the city properly; start with the complete guide.' };
  const exit = bags ? EXIT_MINUTES.bags : EXIT_MINUTES.carryOn;
  const back = onward === 'domestic' ? RETURN_MINUTES.domestic : RETURN_MINUTES.international;
  const leave = land + exit;
  const returnBy = fly - back;
  const outside = Math.max(0, returnBy - leave);
  // Places are best between 07:00 and 21:00. When most of the window is at night, only the
  // daytime part plus one drive counts; ferry and forest trips need daylight throughout.
  const daylight = daylightMinutes(leave, returnBy);
  const night = outside > 0 && daylight < 60;
  const effective = night ? 0 : daylight < outside / 2 ? Math.min(outside, daylight + 90) : outside;
  const regions = REGIONS.map((region) => ({ ...region, fit: regionFit(region, region.key === 'further' ? Math.min(effective, daylight) : effective) }));
  const best = regions.filter((region) => region.fit === 'comfortable').at(-1) || regions.find((region) => region.fit === 'tight');
  return {
    total, exit, back, leave, returnBy, outside, effective, daylight, regions, visa,
    verdict: visa === 'no' ? 'visa' : night ? 'night' : !best ? 'stay' : best.fit === 'tight' ? 'tight' : best.key,
    monsoon: [6, 7, 8, 9].includes(new Date((land + 330) * 60000).getUTCMonth() + 1),
  };
}

// Minutes of the outside window that fall between 07:00 and 21:00 Mumbai time.
export function daylightMinutes(start, end) {
  let total = 0;
  for (let t = start; t < end; t += 15) {
    const hour = new Date((t + 330) * 60000).getUTCHours();
    if (hour >= 7 && hour < 21) total += Math.min(15, end - t);
  }
  return total;
}

export function formatClock(minutes) {
  const date = new Date((minutes + 330) * 60000);
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return { day, time };
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
