import { accountClient, friendlyAuthError, safeNext } from '../lib/account-client.js';

const supabase = accountClient();
const params = new URLSearchParams(location.search);
const $ = (selector, root = document) => root.querySelector(selector);

function show(node, text, tone) {
  if (!node) return;
  node.textContent = text;
  node.dataset.tone = tone || 'info';
  node.hidden = !text;
}

function busy(form, on) {
  form.querySelectorAll('button, input').forEach((element) => { element.disabled = on; });
  form.setAttribute('aria-busy', String(on));
}

// Makes sure public.users exists for this login, exactly as the app does.
async function provision() {
  const { error } = await supabase.rpc('sync_current_auth_user');
  if (error) console.warn('[account] provisioning skipped', error.code || error.message);
}

async function saveRequestedPlace() {
  const slug = params.get('save');
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return;
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from('saved_places').upsert({ user_id: data.user.id, place_slug: slug }, { onConflict: 'user_id,place_slug', ignoreDuplicates: true });
}

/* ---------------------------------------------------------------- /login */
const auth = $('[data-auth]');
if (auth && supabase) {
  const message = $('[data-auth-message]', auth);
  const forms = Object.fromEntries([...auth.querySelectorAll('[data-auth-form]')].map((form) => [form.dataset.authForm, form]));
  const tabs = [...auth.querySelectorAll('[data-auth-tab]')];
  const next = safeNext(params.get('next'));

  function open(name, focus = true) {
    Object.entries(forms).forEach(([key, form]) => { form.hidden = key !== name; });
    tabs.forEach((tab) => {
      const selected = tab.dataset.authTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $('.auth-tabs', auth).hidden = name === 'reset';
    show(message, '');
    if (focus) forms[name].querySelector('input')?.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => open(tab.dataset.authTab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const target = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      target.focus();
      open(target.dataset.authTab, false);
    });
  });
  auth.querySelectorAll('[data-auth-show]').forEach((button) => button.addEventListener('click', () => open(button.dataset.authShow)));
  if (params.get('mode') === 'signup') open('signup', false);

  // Already signed in: go straight on.
  supabase.auth.getSession().then(({ data }) => { if (data.session) location.replace(next); });

  function valid(form) {
    for (const input of form.querySelectorAll('input')) {
      if (!input.checkValidity()) {
        input.focus();
        show(message, input.type === 'email' ? 'Enter a valid email address.' : input.type === 'password' ? 'Your password needs at least 8 characters.' : 'Please fill in your name.', 'error');
        return false;
      }
    }
    return true;
  }

  forms.signin.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!valid(forms.signin)) return;
    const data = new FormData(forms.signin);
    busy(forms.signin, true);
    const { error } = await supabase.auth.signInWithPassword({ email: String(data.get('email')).trim(), password: String(data.get('password')) });
    if (error) {
      busy(forms.signin, false);
      show(message, friendlyAuthError(error), 'error');
      return;
    }
    await provision();
    await saveRequestedPlace();
    window.DetourAnalytics?.track('login', { page_path: location.pathname });
    location.replace(next);
  });

  forms.signup.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!valid(forms.signup)) return;
    const data = new FormData(forms.signup);
    busy(forms.signup, true);
    const redirect = new URL('/account', location.origin);
    if (params.get('save')) redirect.searchParams.set('save', params.get('save'));
    const { data: result, error } = await supabase.auth.signUp({
      email: String(data.get('email')).trim(),
      password: String(data.get('password')),
      options: { data: { full_name: String(data.get('name')).trim() }, emailRedirectTo: redirect.toString() },
    });
    busy(forms.signup, false);
    if (error) {
      show(message, friendlyAuthError(error), 'error');
      return;
    }
    window.DetourAnalytics?.track('sign_up', { page_path: location.pathname });
    if (result.session) {
      await provision();
      await saveRequestedPlace();
      location.replace(next);
      return;
    }
    forms.signup.reset();
    show(message, 'Nearly there. We’ve sent you an email: open the link inside to confirm your address, and you’ll be signed in.', 'success');
  });

  forms.reset.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!valid(forms.reset)) return;
    busy(forms.reset, true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(new FormData(forms.reset).get('email')).trim(), {
      redirectTo: new URL('/account', location.origin).toString(),
    });
    busy(forms.reset, false);
    // Same reply whether or not the address has an account.
    if (error && !/rate limit|too many/i.test(error.message)) console.warn('[account] reset', error.message);
    show(message, error && /rate limit|too many/i.test(error.message) ? friendlyAuthError(error) : 'If there’s an account for that email, a reset link is on its way. It can take a minute or two.', error ? 'error' : 'success');
  });
}

/* -------------------------------------------------------------- /account */
const view = $('[data-account]');
const loading = $('[data-account-loading]');
if (view && !supabase && loading) loading.hidden = true;
if (view && supabase) {
  const places = JSON.parse(view.dataset.places);
  const bySlug = Object.fromEntries(places.map((place) => [place.slug, place]));
  const settingsMessage = $('[data-settings-message]', view);
  // Only timestamps with an explicit offset are converted; free text (the desktop
  // form's "14 Nov, 09:30") is already Mumbai time and is shown as written.
  const formatDate = (value) => {
    const date = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(String(value || '')) ? new Date(value) : new Date(NaN);
    return Number.isFinite(+date)
      ? date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
      : String(value || '').slice(0, 60);
  };
  const requestStatus = { new: 'Received', contacted: 'We’ve replied', qualified: 'Being planned', converted: 'Booked', closed: 'Closed' };
  const tripStatus = (status) => {
    if (['awaiting_deposits', 'awaiting_balance', 'late_fee_due'].includes(status)) return ['Payment due', 'due'];
    if (['confirmed', 'deposits_held', 'balance_paid', 'trip_ready'].includes(status)) return ['Confirmed', 'good'];
    if (status === 'in_progress') return ['Happening now', 'good'];
    if (['completed', 'awaiting_proofs', 'reconciling', 'rated'].includes(status)) return ['Completed', 'done'];
    if (status.startsWith('cancelled') || status.startsWith('no_show')) return ['Cancelled', 'muted'];
    if (status === 'disputed') return ['Under review', 'due'];
    return ['Being planned', 'info'];
  };

  function row(list, title, detail, badge, tone) {
    const li = document.createElement('li');
    const text = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('small');
    small.textContent = detail;
    text.append(strong, small);
    const b = document.createElement('b');
    b.textContent = badge;
    b.dataset.tone = tone;
    li.append(text, b);
    list.append(li);
  }

  async function loadRequests() {
    const list = $('[data-account-requests]', view);
    const { data, error } = await supabase.rpc('my_website_requests');
    list.replaceChildren();
    if (error) { $('[data-requests-empty]', view).hidden = false; return; }
    (data || []).forEach((request) => {
      const title = request.request_type === 'cheat_sheet' ? 'Layover cheat sheet' : 'Detour request';
      const detail = request.arrival ? `Landing ${formatDate(request.arrival)} · sent ${formatDate(request.created_at).split(',')[0]}` : `Sent ${formatDate(request.created_at)}`;
      row(list, title, detail, requestStatus[request.status] || 'Received', request.status === 'converted' ? 'good' : request.status === 'closed' ? 'muted' : 'info');
    });
    $('[data-requests-empty]', view).hidden = Boolean(data && data.length);
  }

  async function loadTrips(userId) {
    const list = $('[data-account-trips]', view);
    const { data, error } = await supabase
      .from('bookings')
      .select('id, status, arrival_time, itinerary:itineraries(title)')
      .eq('traveler_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    list.replaceChildren();
    (error ? [] : data || []).forEach((trip) => {
      const [label, tone] = tripStatus(trip.status);
      row(list, trip.itinerary?.title || 'Your Mumbai detour', trip.arrival_time ? `Landing ${formatDate(trip.arrival_time)}` : 'Dates to be confirmed', label, tone);
    });
    $('[data-trips-empty]', view).hidden = Boolean(!error && data && data.length);
  }

  async function loadSaved() {
    const grid = $('[data-account-saved]', view);
    const { data } = await supabase.from('saved_places').select('place_slug').order('created_at', { ascending: true });
    grid.replaceChildren();
    const saved = (data || []).map((row) => bySlug[row.place_slug]).filter(Boolean);
    saved.forEach((place) => {
      const card = document.createElement('div');
      card.className = 'place-card saved-card';
      const link = document.createElement('a');
      link.href = `/guides/${place.slug}`;
      const img = document.createElement('img');
      Object.assign(img, { src: place.thumb, alt: place.alt, loading: 'lazy', width: 480, height: 320 });
      img.style.objectPosition = place.focus;
      const small = document.createElement('small');
      small.textContent = place.area;
      const h3 = document.createElement('h3');
      h3.textContent = place.name;
      link.append(img, small, h3);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'auth-link';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${place.name} from saved places`);
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        const { error } = await supabase.from('saved_places').delete().eq('place_slug', place.slug);
        if (error) { remove.disabled = false; return; }
        card.remove();
        $('[data-saved-empty]', view).hidden = Boolean(grid.children.length);
      });
      card.append(link, remove);
      grid.append(card);
    });
    $('[data-saved-empty]', view).hidden = Boolean(saved.length);
  }

  function render(user) {
    const name = String(user.user_metadata?.full_name || '').trim();
    $('[data-account-name]', view).textContent = `${name.split(/\s+/)[0] || 'traveller'}.`;
    $('[data-account-email]', view).textContent = `Signed in as ${user.email}`;
    $('[data-account-name-form] input', view).value = name;
    loading.hidden = true;
    view.hidden = false;
    loadRequests();
    loadTrips(user.id);
    loadSaved();
  }

  let recovering = false;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      $('[data-new-password]', view).hidden = false;
      $('[data-new-password] input', view).focus();
    }
  });

  (async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      location.replace(`/login?next=${encodeURIComponent('/account')}`);
      return;
    }
    const user = data.session.user;
    // Arriving from a confirmation or reset email: tidy the URL and finish setup.
    if (location.hash.includes('access_token')) {
      history.replaceState(null, '', location.pathname);
      await provision();
      if (!recovering) window.DetourAnalytics?.track('login', { page_path: location.pathname });
    }
    await saveRequestedPlace();
    if (params.has('save')) history.replaceState(null, '', location.pathname);
    render(user);
  })();

  $('[data-new-password]', view).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const note = $('[data-new-password-message]', view);
    const input = form.querySelector('input');
    if (!input.checkValidity()) { show(note, 'Your password needs at least 8 characters.', 'error'); return; }
    busy(form, true);
    const { error } = await supabase.auth.updateUser({ password: input.value });
    busy(form, false);
    if (error) { show(note, friendlyAuthError(error), 'error'); return; }
    form.hidden = true;
    show(settingsMessage, 'Your new password is saved.', 'success');
  });

  $('[data-account-name-form]', view).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) { show(settingsMessage, 'Please fill in your name.', 'error'); return; }
    busy(form, true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    // Keep the app profile in step, through the same RPC the app uses.
    if (!error) await supabase.rpc('save_my_traveler_profile_tx', { p_patch: { full_name: name } });
    busy(form, false);
    if (error) { show(settingsMessage, friendlyAuthError(error), 'error'); return; }
    $('[data-account-name]', view).textContent = `${name.split(/\s+/)[0]}.`;
    show(settingsMessage, 'Your name is saved.', 'success');
  });

  $('[data-account-password-form]', view).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector('input');
    if (!input.checkValidity()) { show(settingsMessage, 'Your password needs at least 8 characters.', 'error'); return; }
    busy(form, true);
    const { error } = await supabase.auth.updateUser({ password: input.value });
    busy(form, false);
    if (error) { show(settingsMessage, friendlyAuthError(error), 'error'); return; }
    form.reset();
    show(settingsMessage, 'Your password is changed.', 'success');
  });

  $('[data-sign-out]', view).addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.replace('/');
  });

  $('[data-delete-account]', view).addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!confirm('Delete your Detour account permanently? This can’t be undone.')) return;
    button.disabled = true;
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
      button.disabled = false;
      let detail = '';
      try { detail = (await error.context?.json())?.error?.message || ''; } catch {}
      show(settingsMessage, detail || 'We couldn’t delete your account just now. If you have a trip in progress, finish or cancel it first, or email admin@detourtrips.com.', 'error');
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
    location.replace('/');
  });
}
