// Renders the app icon SVG to the PNG sources used by `npx @capacitor/assets generate` (Android)
// and to the PWA manifest icons. Run: node scripts/render-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const BG = '#0F1115';
const svg = readFileSync('public/icon.svg', 'utf8');
// The mark without its rounded-square background, for adaptive-icon foregrounds.
const mark = svg.replace(/<rect[^>]*\/>/, '');

mkdirSync('assets', { recursive: true });
mkdirSync('public/icons', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(path, size, inner, { background = 'transparent', scale = 1 } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${background};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size * scale}px;height:${size * scale}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path, omitBackground: background === 'transparent' });
}

await render('assets/icon-only.png', 1024, svg, { background: BG, scale: 1 });
// Adaptive icons crop to a circle/squircle: keep the mark inside the 66% safe zone.
await render('assets/icon-foreground.png', 1024, mark, { scale: 0.9 });
await render('assets/icon-background.png', 1024, '<svg></svg>', { background: BG });
await render('assets/splash.png', 2732, mark, { background: BG, scale: 0.3 });
await render('assets/splash-dark.png', 2732, mark, { background: BG, scale: 0.3 });
for (const size of [192, 512]) await render(`public/icons/icon-${size}.png`, size, svg, { background: BG });
await render('public/icons/maskable-512.png', 512, mark, { background: BG, scale: 0.9 });

await browser.close();
console.log('Icons rendered to assets/ and public/icons/');
