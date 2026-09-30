import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadPlaywright, browserPath, browserOptions, createFatalGuard } from './runtime.mjs';

// This is browser mobile emulation on the host GPU, not a physical-phone FPS claim.
// CDP dispatchTouchEvent creates real trusted touchscreen events with persistent touch IDs.
const args = Object.fromEntries(process.argv.slice(2).map((value, i, all) =>
  value.startsWith('--') ? [value.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true] : null
).filter(Boolean));
const target = new URL(String(args.url || 'http://127.0.0.1:5191/'));
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !['5191', '5192'].includes(target.port)) throw new Error('Only the local dev/preview app is permitted');
target.searchParams.delete('bench');
target.searchParams.delete('touch'); // Automatic coarse-pointer detection is part of this test.
const output = resolve(String(args.out || 'output/review/mobile-smoke'));
const timeout = Number(args.timeout || 300000);
const only = args.only ? String(args.only).split(',') : ['mobile', 'desktop', 'unsupported'];
if (only.some(name => !['mobile', 'desktop', 'unsupported'].includes(name))) throw new Error('Invalid --only case');
await mkdir(output, { recursive: true });
const report = {
  capturedAt: new Date().toISOString(), url: target.href,
  method: 'Independent Chrome profiles. Phone UI emulation uses mobile viewport, DPR 2 and a coarse touchscreen; actual CDP touchStart/touchMove/touchEnd/touchCancel inputs test simultaneous movement/look. Application inputs and positions are read, never assigned. This does not measure real phone hardware performance.',
  cases: {},
};
// Selectors supplied by the mobile UI implementation owner.
const selectors = {
  root: '.island-mobile', stick: '.island-stick',
  settings: '.island-mobile-settings', help: '.island-mobile-help', home: '.island-mobile-home',
  settingsClose: '.tw-panel-actions button[aria-label="Collapse (H)"]', helpClose: '.tw-help-close',
  start: '.tw-start-cta', action: key => `.island-touch-action[data-key="${key}"]`,
};
const playwright = await loadPlaywright(args.playwright), executablePath = await browserPath(args.browser);
report.browserExecutable = executablePath;
report.playwrightModule = playwright.path;
const check = (part, name, pass, details = {}) => {
  part.checks.push({ name, status: pass ? 'pass' : 'fail', ...details });
  console.log(`[${part.name}] ${pass ? 'pass' : 'FAIL'}: ${name}`);
};
const distance = (a, b) => Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
const angleDifference = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function readState(page) {
  return page.evaluate(() => {
    const app = window.__app, ui = window.__ui, input = app?.input;
    const controls = ui?.mobileControls;
    const root = document.querySelector('.island-mobile'), canvas = app?.engine.canvas;
    const codeList = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC', 'KeyE'];
    return {
      position: app?.player ? [app.player.position.x, app.player.position.y, app.player.position.z] : null,
      yaw: app?.player.yaw, pitch: app?.player.pitch, mode: app?.player.mode,
      keys: Object.fromEntries(codeList.map(code => [code, Boolean(input?.down(code))])),
      frame: app?.engine.frame, inputEnabled: input?.enabled,
      controlsEnabled: controls?.enabled, controlsActive: controls?.active,
      controlsHidden: !root || root.hidden || getComputedStyle(root).display === 'none' || getComputedStyle(root).visibility === 'hidden',
      startOpen: ui?._start, panelOpen: ui?.panelOpen, helpOpen: ui?.helpOpen,
      coarse: matchMedia('(pointer: coarse)').matches, maxTouchPoints: navigator.maxTouchPoints,
      viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      canvas: canvas ? [canvas.width, canvas.height] : null,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}
async function waitFrames(page, fatal, count = 12) {
  const frame = await page.evaluate(() => window.__app.engine.frame);
  await fatal.run(page.waitForFunction(({ frame, count }) => window.__app.engine.frame >= frame + count, { frame, count }, { timeout: 20000 }), 'App frame progress');
}
async function centre(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No visible target: ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}
class Touchscreen {
  constructor(cdp) { this.cdp = cdp; this.points = new Map(); }
  async send(type) {
    const touchPoints = type === 'touchEnd' || type === 'touchCancel' ? [] : [...this.points].map(([id, point]) => ({ id, x: point.x, y: point.y, radiusX: 3, radiusY: 3, force: 1 }));
    await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  async start(points) {
    for (const [id, point] of points) this.points.set(id, point);
    await this.send('touchStart');
  }
  async move(points) {
    for (const [id, point] of points) this.points.set(id, point);
    await this.send('touchMove');
  }
  async end() { await this.send('touchEnd'); this.points.clear(); }
  async cancel() { await this.send('touchCancel'); this.points.clear(); }
  async tap(point, id = 9) {
    await this.start([[id, point]]);
    this.points.delete(id);
    // The active point list generates release for the removed finger while retaining the stick.
    if (this.points.size) await this.send('touchMove');
    else await this.end();
  }
}
async function runCase(name, mobile, fn, unsupported = false) {
  const part = report.cases[name] = { name, checks: [], console: [], pageErrors: [], httpErrors: [], requestFailures: [], screenshots: [] };
  const directory = join(output, name);
  await mkdir(directory, { recursive: true });
  let context, page;
  const fatal = createFatalGuard(timeout);
  try {
    context = await playwright.module.chromium.launchPersistentContext(join(directory, `browser-profile-${Date.now()}`), {
      executablePath, ...browserOptions,
      ...(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}),
    });
    await context.exposeBinding('__mobileSmokeFatal', (_, message) => fatal.abort(message));
    await context.addInitScript(({ unsupported }) => {
      if (unsupported) Object.defineProperty(navigator, 'gpu', { configurable: true, get: () => undefined });
      window.__touchEvidence = { maxSimultaneous: 0, trusted: 0, untrusted: 0, events: [] };
      const active = new Set();
      for (const kind of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(kind, event => {
        if (event.pointerType !== 'touch') return;
        if (kind === 'pointerdown') active.add(event.pointerId);
        if (kind === 'pointerup' || kind === 'pointercancel') active.delete(event.pointerId);
        const evidence = window.__touchEvidence;
        evidence.maxSimultaneous = Math.max(evidence.maxSimultaneous, active.size);
        evidence[event.isTrusted ? 'trusted' : 'untrusted']++;
        if (evidence.events.length < 120) evidence.events.push({ type: kind, pointerId: event.pointerId, isPrimary: event.isPrimary, target: event.target?.className, isTrusted: event.isTrusted, x: event.clientX, y: event.clientY });
      }, true);
      if (!unsupported) {
        let failed = false;
        new MutationObserver(() => {
          const error = document.querySelector('#loader.tw-error');
          if (error && !failed) {
            failed = true;
            window.__mobileSmokeFatal(error.querySelector('.loader-status')?.textContent || 'App loading error').catch(() => {});
          }
        }).observe(document, { subtree: true, childList: true, attributes: true });
      }
    }, { unsupported });
    page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => { part.pageErrors.push(String(error)); fatal.abort(error); });
    page.on('crash', () => fatal.abort('Renderer crashed'));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) part.console.push({ type: message.type(), text: message.text(), location: message.location() });
      if (/WebGPU device lost:|^WebGPU:/.test(message.text())) fatal.abort(message.text());
    });
    page.on('response', response => { if (response.status() >= 400) part.httpErrors.push({ status: response.status(), url: response.url() }); });
    page.on('requestfailed', request => part.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    const cdp = await context.newCDPSession(page);
    part.browser = await cdp.send('Browser.getVersion');
    const touch = new Touchscreen(cdp);
    const shot = async filename => {
      await fatal.run(page.screenshot({ path: join(directory, filename + '.png'), animations: 'disabled' }), `Screenshot ${filename}`);
      part.screenshots.push(filename + '.png');
    };
    console.log(`[${name}] Loading ${target.href}`);
    await fatal.run(page.goto(target.href, { waitUntil: 'domcontentloaded', timeout }), 'Navigation');
    await fn({ part, page, cdp, touch, fatal, shot });
    part.touchEvidence = await page.evaluate(() => window.__touchEvidence);
    part.success = part.checks.every(item => item.status === 'pass') && !part.pageErrors.length;
  } catch (error) {
    part.success = false;
    part.error = error.stack || String(error);
    console.error(`[${name}] ${part.error}`);
    try { part.failureState = await readState(page); part.touchEvidence = await page.evaluate(() => window.__touchEvidence); } catch {}
    try { if (page && !page.isClosed()) await page.screenshot({ path: join(directory, 'failure.png'), timeout: 5000 }); } catch {}
  } finally {
    if (context) await context.close();
    await writeFile(join(directory, 'report.json'), JSON.stringify(part, null, 2));
  }
}

if (only.includes('mobile')) await runCase('mobile', true, async ({ part, page, touch, fatal, shot }) => {
  await fatal.run(page.waitForFunction(() => window.__app?.ui && window.__ui?._start, null, { timeout }), 'Mobile start');
  await waitFrames(page, fatal, 25);
  const entry = await readState(page);
  check(part, 'Coarse pointer automatically enables touch controls', entry.coarse && entry.maxTouchPoints > 0 && entry.controlsEnabled === true, { state: entry });
  check(part, 'Movement controls hidden at entry overlay', entry.controlsHidden && !entry.controlsActive);
  await shot('01-portrait-start');
  await touch.tap(await centre(page, selectors.start));
  await fatal.run(page.waitForFunction(() => window.__ui.mobileControls.active, null, { timeout: 10000 }), 'Touch controls active');
  await waitFrames(page, fatal, 45);
  const running = await readState(page);
  check(part, 'Portrait active UI fits viewport', !running.controlsHidden && running.scrollWidth <= running.viewport[0] + 1, { state: running });
  await shot('02-portrait-running');
  const stick = await centre(page, selectors.stick);
  const look = { x: running.viewport[0] * 0.72, y: running.viewport[1] * 0.42 };
  const forward = { x: stick.x, y: stick.y - Math.min(38, stick.box.height * 0.32) };
  const before = await readState(page);
  await touch.start([[1, stick], [2, look]]);
  await touch.move([[1, forward], [2, { x: look.x + 24, y: look.y - 10 }]]);
  await waitFrames(page, fatal, 18);
  await touch.move([[2, { x: look.x + 46, y: look.y - 18 }]]);
  await waitFrames(page, fatal, 30);
  const during = await readState(page);
  check(part, 'Two fingers move player and turn view together', distance(before, during) > 0.3 && angleDifference(before.yaw, during.yaw) > 0.03 && during.keys.KeyW, { displacementMeters: distance(before, during), yawRadians: angleDifference(before.yaw, during.yaw), before, during });
  await shot('03-portrait-two-fingers');
  await touch.end();
  await waitFrames(page, fatal, 30);
  const released = await readState(page);
  await waitFrames(page, fatal, 25);
  const settled = await readState(page);
  check(part, 'Finger release clears movement and stops walking', released.controlsActive && !Object.values(released.keys).some(Boolean) && distance(released, settled) < 0.03, { released, settled, driftMeters: distance(released, settled) });
  // Action keys are held by real finger contact and released through the same input boundary.
  for (const [id, key] of [[3, 'Space'], [4, 'KeyC'], [5, 'KeyE']]) {
    await touch.start([[id, await centre(page, selectors.action(key))]]);
    await waitFrames(page, fatal, 3);
    const held = await readState(page);
    await touch.end();
    await waitFrames(page, fatal, 3);
    const up = await readState(page);
    check(part, `Touch action ${key} holds and releases`, held.keys[key] && !up.keys[key]);
  }
  // Cancellation does not rely on a normal pointerup.
  await touch.start([[1, stick]]);
  await touch.move([[1, forward]]);
  await waitFrames(page, fatal, 3);
  await touch.cancel();
  await waitFrames(page, fatal, 10);
  check(part, 'Touch cancel clears movement', !Object.values((await readState(page)).keys).some(Boolean));
  // Keep finger one down while finger two taps the menu button.
  await touch.start([[1, stick]]);
  await touch.move([[1, forward]]);
  await waitFrames(page, fatal, 3);
  await touch.tap(await centre(page, selectors.settings), 2);
  await fatal.run(page.waitForFunction(() => window.__ui.panelOpen, null, { timeout: 5000 }), 'Touch settings open');
  const menu = await readState(page);
  check(part, 'Opening settings cancels held movement', menu.controlsHidden && !menu.inputEnabled && !Object.values(menu.keys).some(Boolean), { state: menu });
  await touch.end();
  await waitFrames(page, fatal, 20);
  await shot('04-portrait-settings');
  await touch.tap(await centre(page, selectors.settingsClose));
  await fatal.run(page.waitForFunction(() => !window.__ui.panelOpen && window.__ui.mobileControls.active, null, { timeout: 5000 }), 'Touch settings close');
  const menuClosed = await readState(page);
  check(part, 'Closing settings does not restore a stale held key', menuClosed.inputEnabled && !Object.values(menuClosed.keys).some(Boolean), { state: menuClosed });
  await touch.tap(await centre(page, selectors.help));
  await fatal.run(page.waitForFunction(() => window.__ui.helpOpen, null, { timeout: 5000 }), 'Touch help open');
  await waitFrames(page, fatal, 20);
  await shot('05-portrait-guide');
  await touch.tap(await centre(page, selectors.helpClose));
  await fatal.run(page.waitForFunction(() => !window.__ui.helpOpen && window.__ui.mobileControls.active, null, { timeout: 5000 }), 'Touch help close');
  check(part, 'Touch help opens and closes', !(await readState(page)).helpOpen);
  // Resize while the stick is still held. Input must clear before finger release.
  await touch.start([[1, await centre(page, selectors.stick)]]);
  await touch.move([[1, forward]]);
  await waitFrames(page, fatal, 3);
  await page.setViewportSize({ width: 844, height: 390 });
  await waitFrames(page, fatal, 10);
  const rotated = await readState(page);
  check(part, 'Portrait to landscape resize cancels movement', rotated.inputEnabled && !Object.values(rotated.keys).some(Boolean), { state: rotated });
  await touch.end();
  await waitFrames(page, fatal, 30);
  await shot('06-landscape-running');
  check(part, 'Landscape controls fit viewport', rotated.viewport[0] === 844 && rotated.viewport[1] === 390 && rotated.scrollWidth <= 845 && !rotated.controlsHidden);
  const landscapeStick = await centre(page, selectors.stick);
  const landscapeLook = { x: 844 * 0.72, y: 390 * 0.40 };
  const landscapeBefore = await readState(page);
  await touch.start([[1, landscapeStick], [2, landscapeLook]]);
  await touch.move([[1, { x: landscapeStick.x, y: landscapeStick.y - 32 }], [2, { x: landscapeLook.x - 40, y: landscapeLook.y + 12 }]]);
  await waitFrames(page, fatal, 30);
  const landscapeAfter = await readState(page);
  check(part, 'Landscape simultaneous move and look', distance(landscapeBefore, landscapeAfter) > 0.2 && angleDifference(landscapeBefore.yaw, landscapeAfter.yaw) > 0.03, { before: landscapeBefore, after: landscapeAfter });
  await touch.end();
  await waitFrames(page, fatal, 15);
  await shot('07-landscape-after-move');
  await touch.tap(await centre(page, selectors.home));
  await waitFrames(page, fatal, 10);
  const home = await readState(page);
  check(part, 'Touch home returns to original entrance', distance(running, home) < 0.05 && !Object.values(home.keys).some(Boolean));
  const evidence = await page.evaluate(() => window.__touchEvidence);
  check(part, 'Inputs were trusted concurrent touchscreen events', evidence.maxSimultaneous >= 2 && evidence.trusted > 0 && evidence.untrusted === 0, { evidence });
});

if (only.includes('desktop')) await runCase('desktop', false, async ({ part, page, fatal, shot }) => {
  await fatal.run(page.waitForFunction(() => window.__app?.ui && window.__ui?._start, null, { timeout }), 'Desktop start');
  await page.locator(selectors.start).click();
  await waitFrames(page, fatal, 45);
  const state = await readState(page);
  check(part, 'Desktop touch controls hidden automatically', !state.coarse && !state.controlsEnabled && state.controlsHidden, { state });
  try { await page.keyboard.down('w'); await waitFrames(page, fatal, 35); }
  finally { await page.keyboard.up('w'); }
  await waitFrames(page, fatal, 8);
  const moved = await readState(page);
  check(part, 'Desktop W keyboard movement preserved', distance(state, moved) > 0.3, { displacementMeters: distance(state, moved) });
  await page.mouse.move(640, 330);
  await page.mouse.down();
  await page.mouse.move(680, 345, { steps: 5 });
  await page.mouse.up();
  await waitFrames(page, fatal, 5);
  const looked = await readState(page);
  check(part, 'Desktop drag mouse look preserved', angleDifference(moved.yaw, looked.yaw) > 0.03, { yawRadians: angleDifference(moved.yaw, looked.yaw) });
  await shot('desktop-controls');
});

if (only.includes('unsupported')) await runCase('unsupported', true, async ({ part, page, fatal, shot }) => {
  // An unavailable WebGPU API is simulated before any application module executes.
  await fatal.run(page.locator('#compatibility-message[role="alert"]').waitFor({ state: 'visible', timeout: 15000 }), 'Unsupported WebGPU message');
  const evidence = await page.evaluate(() => ({ text: document.querySelector('#compatibility-message').innerText, gpuUnavailable: navigator.gpu === undefined, appDeviceCreated: Boolean(window.__app?.gpu?.device), canvasCount: document.querySelectorAll('canvas').length, scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
  check(part, 'Unavailable WebGPU gives readable DOM fallback', evidence.gpuUnavailable && !evidence.appDeviceCreated && evidence.text.includes('WebGPU') && evidence.scrollWidth <= evidence.width + 1, { evidence });
  await shot('unsupported-webgpu');
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), page.locator('.compat-retry').click()]);
  await fatal.run(page.locator('#compatibility-message[role="alert"]').waitFor({ state: 'visible', timeout: 15000 }), 'Retry returns to compatibility message');
  check(part, 'DOM retry remains usable without WebGPU', await page.locator('.compat-retry').isVisible());
}, true);

report.success = Object.values(report.cases).every(part => part.success);
await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
await writeFile(join(output, 'summary.md'), ['# Mobile interaction smoke', '', `Success: ${report.success}.`, '', 'Mobile browser emulation on the host GPU; no physical-phone performance claim.', '', ...Object.values(report.cases).flatMap(part => [`## ${part.name}`, '', ...part.checks.map(item => `- ${item.status.toUpperCase()}: ${item.name}`), ...(part.error ? ['', part.error] : []), ''])].join('\n'));
if (!report.success) process.exitCode = 1;
console.log(`[mobile-smoke] Report: ${join(output, 'report.json')}`);
