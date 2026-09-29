/**
 * Keeps the focused field visible above the on-screen keyboard. Android resizes the WebView
 * (adjustResize + interactive-widget=resizes-content), but a field that was near the bottom stays
 * where it was, so scroll it into the middle once the keyboard has opened.
 */
export function keepFocusedFieldVisible(): void {
  const isField = (el: EventTarget | null): el is HTMLElement =>
    el instanceof HTMLElement && (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select') || el.isContentEditable);

  const reveal = (el: HTMLElement) => {
    if (document.activeElement !== el) return;
    const vv = window.visualViewport;
    const rect = el.getBoundingClientRect();
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    if (rect.bottom > visibleBottom - 16 || rect.top < 0) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  document.addEventListener('focusin', (e) => {
    if (!isField(e.target)) return;
    const el = e.target;
    // The keyboard animates in over ~250 ms; check once it has settled, and again on resize.
    window.setTimeout(() => reveal(el), 300);
    const onResize = () => reveal(el);
    window.visualViewport?.addEventListener('resize', onResize);
    el.addEventListener('blur', () => window.visualViewport?.removeEventListener('resize', onResize), { once: true });
  });
}
