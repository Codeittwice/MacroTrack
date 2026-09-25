import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';
import { ThemeSync } from './app/ThemeSync';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

const isNativeShell = 'Capacitor' in window && (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  || '__TAURI_INTERNALS__' in window;
if (isNativeShell) {
  // Clean up a worker registered by an earlier build so it can't pin an old bundle.
  void navigator.serviceWorker?.getRegistrations().then((regs) => regs.forEach((reg) => void reg.unregister()));
} else {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeSync />
    <RouterProvider router={router} />
  </StrictMode>,
);
