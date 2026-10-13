// "Save this place" on a field note. Needs website accounts (account-lite.js);
// without them the button stays hidden. On phones the mobile shortlist does this job.
const button = document.querySelector('[data-save-place]');
if (button) {
  const slug = button.dataset.savePlace;
  const signIn = () => { location.href = `/login?next=${encodeURIComponent(location.pathname)}&save=${slug}`; };
  const init = () => {
    const account = window.DetourAccount;
    if (!account) return;
    let saved = false;
    const paint = () => {
      button.textContent = saved ? 'Saved to your account ✓' : account.signedIn() ? 'Save this place' : 'Sign in to save this place';
      button.setAttribute('aria-pressed', String(saved));
    };
    button.hidden = false;
    paint();
    if (account.signedIn()) account.savedPlaces().then((slugs) => { saved = slugs.includes(slug); paint(); }).catch(() => {});
    button.addEventListener('click', async () => {
      if (!account.signedIn()) return signIn();
      button.disabled = true;
      try {
        await (saved ? account.removePlace(slug) : account.savePlace(slug));
        saved = !saved;
        paint();
      } catch (error) {
        if (error.code === 'signed_out') return signIn();
        button.textContent = 'Couldn’t save just now. Try again';
      } finally {
        button.disabled = false;
      }
    });
  };
  if (window.DetourAccount) init();
  else addEventListener('detour:account-ready', init, { once: true });
}
