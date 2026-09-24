import { useEffect } from 'react';
import { useSettings } from './hooks';

/** Applies theme + accent from settings to <html>. */
export function ThemeSync() {
  const { theme, accent } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      if (accent === 'green') delete root.dataset.accent;
      else root.dataset.accent = accent;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F1115' : '#F7F8FA');
    };
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent]);
  return null;
}
