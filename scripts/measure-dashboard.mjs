// Measure right-column heights at all three viewports + capture baseline.
// Uses raw CDP (no deps), same pattern as screenshot-polish.mjs.

import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHROME_PATH = '/Users/austinclifton/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = 'http://localhost:5173/dashboard';
const OUT_DIR = resolve(__dirname, '..', 'tmp', 'measure-screens');
const REMOTE_PORT = 9223;

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '900', width: 900, height: 1100 },
  { name: '420', width: 420, height: 900 },
];

function get(url) {
  return new Promise((resolveFn, rejectFn) => {
    const req = request(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolveFn({ status: res.statusCode, body: data }));
    });
    req.on('error', rejectFn);
    req.end();
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolveFn, rejectFn } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rejectFn(new Error(msg.error.message));
        else resolveFn(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolveFn, rejectFn) => {
      this.pending.set(id, { resolveFn, rejectFn });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--remote-debugging-port=${REMOTE_PORT}`,
    '--remote-allow-origins=*',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr.on('data', () => {});

  let info;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await get(`http://127.0.0.1:${REMOTE_PORT}/json/version`);
      if (res.status === 200) {
        info = JSON.parse(res.body);
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!info) {
    chrome.kill();
    throw new Error('CDP did not come up');
  }
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolveFn, rejectFn) => {
    ws.addEventListener('open', resolveFn, { once: true });
    ws.addEventListener('error', rejectFn, { once: true });
  });
  const cdp = new CDP(ws);

  let target;
  for (let i = 0; i < 30; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    target = targetInfos.find(t => t.type === 'page');
    if (target) break;
    await new Promise(r => setTimeout(r, 100));
  }
  if (!target) {
    chrome.kill();
    throw new Error('No page target');
  }
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });

  async function navigate(url) {
    await cdp.send('Page.navigate', { url }, sessionId);
    await new Promise(r => setTimeout(r, 1800));
  }
  async function evalJs(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId);
    if (exceptionDetails) {
      throw new Error(JSON.stringify(exceptionDetails));
    }
    return result.value;
  }
  async function screenshot(file) {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    }, sessionId);
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log(`Wrote ${file}`);
  }

  try {
    await navigate('http://localhost:5173/login');
    await cdp.send('Page.enable', {}, sessionId);
    const loginResult = await evalJs(`
      (async () => {
        const r = await fetch('/api/auth/demo-login', { method: 'POST', credentials: 'include' });
        return { status: r.status, body: await r.json() };
      })()
    `);
    if (loginResult.status !== 200) {
      throw new Error('Demo login failed: ' + JSON.stringify(loginResult));
    }

    for (const vp of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 600,
      }, sessionId);
      await navigate(URL);
      for (let i = 0; i < 30; i++) {
        const ok = await evalJs(`
          Boolean(document.querySelector('aside[aria-label="Hive picker"]'))
        `);
        if (ok) break;
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, 1500));

      // Measure right-column (selected panel) bounding boxes.
      const measurements = await evalJs(`
        (() => {
          const sel = document.querySelector('section[aria-label="Selected hive detail"]');
          const picker = document.querySelector('aside[aria-label="Hive picker"]');
          const grid = document.querySelector('section[aria-label="Selected hive detail"]')?.parentElement;
          const chart = document.querySelector('section[aria-label="Selected hive detail"] .min-h-\\\\[380px\\\\]');
          const r = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { top: b.top, bottom: b.bottom, height: b.height, width: b.width };
          };
          return {
            selected: r(sel),
            picker: r(picker),
            grid: r(grid),
            chart: r(chart),
            pickerRows: document.querySelectorAll('aside[aria-label="Hive picker"] li').length,
            gridComputed: grid ? getComputedStyle(grid).gridTemplateColumns : null,
            gridAlignItems: grid ? getComputedStyle(grid).alignItems : null,
          };
        })()
      `);
      console.log(`=== ${vp.name} ===`);
      console.log(JSON.stringify(measurements, null, 2));

      const file = resolve(OUT_DIR, `measure-${vp.name}.png`);
      await screenshot(file);
    }
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});