// Runs JavaScript inside the MacroTrack Android WebView over the DevTools protocol (debug builds).
// Setup: adb forward tcp:9333 localabstract:webview_devtools_remote_$(adb shell pidof nl.macrotrack.app)
// Usage: node scripts/android-cdp.mjs "await go('/settings'); return text().slice(0, 200);"
// Helpers available in the snippet: sleep, btn, click(name), setVal(el, v), q(selector), text(), go(path).
const port = process.env.CDP_PORT ?? '9333'; // WebView2 (Tauri desktop): launch with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224
const list = (await (await fetch(`http://localhost:${port}/json/list`)).json()).filter((t) => t.type === 'page');
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const expression = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (name) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText).trim() === name);
  const click = async (name) => { const b = btn(name); if (!b) throw new Error('no button ' + name); b.click(); await sleep(250); };
  const setVal = async (el, v) => { const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150); };
  const q = (s) => document.querySelector(s);
  const text = () => document.body.innerText.replace(/\\s+/g, ' ');
  const go = async (path) => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); await sleep(1200); };
  ${process.argv[2]}
})()`;
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
const msg = await new Promise((r) => ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id === 1) r(m); }));
console.log(JSON.stringify(msg.result?.result?.value ?? msg.result?.exceptionDetails?.exception?.description ?? msg, null, 0).slice(0, 1500));
ws.close();
