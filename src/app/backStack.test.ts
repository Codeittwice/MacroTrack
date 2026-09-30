import { describe, expect, it, vi } from 'vitest';
import { createBackHandler, openOverlayCount, pushOverlay } from './backStack';

function deps(path: string, now = { t: 0 }) {
  return { path: () => path, goBack: vi.fn(), exit: vi.fn(), toast: vi.fn(), now: () => now.t };
}

describe('back button', () => {
  it('closes the top overlay first', () => {
    const d = deps('/log');
    const lower = vi.fn();
    const top = vi.fn();
    const removeLower = pushOverlay(lower);
    const removeTop = pushOverlay(top);
    createBackHandler(d)();
    expect(top).toHaveBeenCalledOnce();
    expect(lower).not.toHaveBeenCalled();
    expect(d.goBack).not.toHaveBeenCalled();
    removeTop();
    removeLower();
    expect(openOverlayCount()).toBe(0);
  });

  it('goes back a page when nothing is open', () => {
    const d = deps('/training');
    createBackHandler(d)();
    expect(d.goBack).toHaveBeenCalledOnce();
  });

  it('exits from the dashboard only on a second press within 2 s', () => {
    const now = { t: 1000 };
    const d = deps('/', now);
    const back = createBackHandler(d);
    back();
    expect(d.toast).toHaveBeenCalledOnce();
    expect(d.exit).not.toHaveBeenCalled();
    now.t = 4000;
    back();
    expect(d.exit).not.toHaveBeenCalled();
    now.t = 4500;
    back();
    expect(d.exit).toHaveBeenCalledOnce();
  });
});
