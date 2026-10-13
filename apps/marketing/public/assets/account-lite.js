/* Detour website accounts, the lightweight half. Loaded on every page when
   accounts are configured. It reads the session that /login stores (the
   supabase-js session format under "detour-auth"), refreshes it when needed,
   and talks to Supabase REST directly so ordinary pages never load supabase-js.
   Only the public anon key is used; row-level security does the rest. */
(function () {
  'use strict';
  var STORAGE_KEY = 'detour-auth';
  var urlMeta = document.querySelector('meta[name="detour-supabase-url"]');
  var keyMeta = document.querySelector('meta[name="detour-supabase-key"]');
  var base = urlMeta ? urlMeta.getAttribute('content') : '';
  var anonKey = keyMeta ? keyMeta.getAttribute('content') : '';
  if (!base || !anonKey) return;

  function read() {
    try {
      var session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return session && session.access_token && session.refresh_token && session.user ? session : null;
    } catch (error) { return null; }
  }

  var refreshing = null;
  function refresh(session) {
    if (!refreshing) {
      var invalidRefresh = false;
      function stillCurrent() {
        var current = read();
        return current && current.access_token === session.access_token && current.refresh_token === session.refresh_token;
      }
      refreshing = fetch(base + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }).then(function (response) {
        if (!response.ok) {
          invalidRefresh = response.status === 400 || response.status === 401 || response.status === 403;
          throw new Error('refresh failed');
        }
        return response.json();
      }).then(function (next) {
        // Another tab may have signed out or switched accounts while we waited.
        // Never restore or replace that tab's newer session with this response.
        if (!stillCurrent()) return null;
        if (!next || !next.access_token || !next.refresh_token || !next.user) throw new Error('invalid refresh response');
        if (!next.expires_at && next.expires_in) next.expires_at = Math.round(Date.now() / 1000) + next.expires_in;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (error) {}
        return next;
      }).catch(function () {
        // A network outage, rate limit or server error can be retried. Only a
        // rejected refresh token signs out the session that started this request.
        if (invalidRefresh && stillCurrent()) {
          try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
        }
        return null;
      }).then(function (result) { refreshing = null; return result; });
    }
    return refreshing;
  }

  // A session with at least a minute left, refreshed if necessary; null when signed out.
  function activeSession() {
    var session = read();
    if (!session) return Promise.resolve(null);
    if (session.expires_at && session.expires_at * 1000 > Date.now() + 60000) return Promise.resolve(session);
    return refresh(session);
  }

  function rest(path, options) {
    return activeSession().then(function (session) {
      if (!session) throw Object.assign(new Error('signed out'), { code: 'signed_out' });
      var headers = Object.assign({ apikey: anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, (options && options.headers) || {});
      return fetch(base + '/rest/v1/' + path, Object.assign({}, options, { headers: headers })).then(function (response) {
        if (!response.ok) throw Object.assign(new Error('request failed'), { code: 'request_failed', status: response.status });
        return response.status === 204 || response.status === 201 ? null : response.json();
      });
    });
  }

  var slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  window.DetourAccount = {
    signedIn: function () { return !!read(); },
    user: function () {
      var session = read();
      if (!session) return null;
      var meta = session.user.user_metadata || {};
      return { id: session.user.id, email: session.user.email || '', name: meta.full_name || '' };
    },
    accessToken: function () { return activeSession().then(function (session) { return session ? session.access_token : null; }); },
    savedPlaces: function () {
      return rest('saved_places?select=place_slug&order=created_at.asc').then(function (rows) {
        return (rows || []).map(function (row) { return row.place_slug; });
      });
    },
    savePlace: function (slug) {
      if (!slugPattern.test(slug)) return Promise.reject(new Error('invalid place'));
      var user = window.DetourAccount.user();
      if (!user) return Promise.reject(Object.assign(new Error('signed out'), { code: 'signed_out' }));
      return rest('saved_places?on_conflict=user_id,place_slug', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: user.id, place_slug: slug }),
      });
    },
    removePlace: function (slug) {
      if (!slugPattern.test(slug)) return Promise.reject(new Error('invalid place'));
      return rest('saved_places?place_slug=eq.' + encodeURIComponent(slug), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
  };

  // Navigation links: "Sign in" for visitors, "My account" once signed in.
  var signedIn = !!read();
  document.querySelectorAll('[data-account-link]').forEach(function (link) {
    link.hidden = false;
    if (signedIn) {
      link.textContent = 'My account';
      link.setAttribute('href', '/account');
    } else if (!/^\/(login|account)$/.test(location.pathname)) {
      link.setAttribute('href', '/login?next=' + encodeURIComponent(location.pathname));
    }
  });
  try { dispatchEvent(new CustomEvent('detour:account-ready', { detail: { signedIn: signedIn } })); } catch (error) {}
})();
