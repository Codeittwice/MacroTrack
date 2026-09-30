/**
 * Android back button: closes the top open sheet first, then goes back a page, and only exits the
 * app from the dashboard after a second press. Sheets register themselves with `pushOverlay`.
 */
const overlays: { close: () => void }[] = [];

/** Registers an open overlay; the returned function removes it (call when it closes). */
export function pushOverlay(close: () => void): () => void {
  const entry = { close };
  overlays.push(entry);
  return () => {
    const i = overlays.indexOf(entry);
    if (i >= 0) overlays.splice(i, 1);
  };
}

/** Closes the top overlay. Returns false when none is open. */
export function closeTopOverlay(): boolean {
  const top = overlays[overlays.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function openOverlayCount(): number {
  return overlays.length;
}

const EXIT_WINDOW_MS = 2000;

export interface BackDeps {
  path: () => string;
  goBack: () => void;
  exit: () => void;
  toast: (message: string) => void;
  now?: () => number;
}

/** Builds the back-press handler. Kept free of Capacitor so it can be unit tested. */
export function createBackHandler(deps: BackDeps): () => void {
  let lastPress = -Infinity;
  const now = deps.now ?? Date.now;
  return () => {
    if (closeTopOverlay()) return;
    const path = deps.path();
    if (path !== '/' && path !== '/onboarding') {
      deps.goBack();
      return;
    }
    const t = now();
    if (t - lastPress < EXIT_WINDOW_MS) {
      deps.exit();
      return;
    }
    lastPress = t;
    deps.toast('Press back again to exit');
  };
}

function showToast(message: string) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = message;
  el.className = 'fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit rounded-full bg-surface-2 px-4 py-2 text-sm text-text shadow-lg';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), EXIT_WINDOW_MS);
}

/** Wires the handler to Capacitor's hardware back button. No-op outside the Android app. */
export async function installBackButton(): Promise<void> {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const { App } = await import('@capacitor/app');
  const handler = createBackHandler({
    path: () => window.location.pathname,
    goBack: () => window.history.back(),
    exit: () => void App.exitApp(),
    toast: showToast,
  });
  await App.addListener('backButton', handler);
}
