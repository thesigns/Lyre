// Offline support and installation, see docs/Lyre.md 10.

const DEV_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// canActivate(): whether a waiting new version may take over now with a reload.
// It is only allowed at startup (start menu still open), never while playing.
export function registerServiceWorker({ canActivate }) {
  if (!('serviceWorker' in navigator)) return;
  // During development every reload should show the current files; add ?sw to test offline.
  if (DEV_HOSTS.includes(location.hostname) && !new URLSearchParams(location.search).has('sw')) return;
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      if (!reg.waiting || !navigator.serviceWorker.controller || !canActivate()) return;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      reg.waiting.postMessage('activate');
    })
    .catch(() => {
      // No offline support this time; the app still works online.
    });
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// "Install app" in the settings (10.3): a button where the browser supports it,
// instructions on iOS, nothing when installed or unsupported.
export function initInstall({ row, button, iosHint }) {
  if (isStandalone()) return;
  if (isIOS()) {
    iosHint.hidden = false;
    return;
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    row.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    const prompt = deferred;
    deferred = null; // the event can be used only once
    row.hidden = true;
    prompt.prompt();
    try {
      await prompt.userChoice;
    } catch (e) {
      // Ignored: the button comes back if the browser offers installation again.
    }
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    row.hidden = true;
  });
}
