import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadPlaywright, browserPath, browserOptions, createFatalGuard } from './runtime.mjs';
import { startCollector } from './collector.mjs';

// Real local UI inputs in a separate browser. Do not run concurrently with perf reviews.
const args = Object.fromEntries(process.argv.slice(2).map((value, i, all) =>
  value.startsWith('--') ? [value.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true] : null
).filter(Boolean));
const target = new URL(String(args.url || 'http://127.0.0.1:5191/'));
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !['5191', '5192'].includes(target.port)) {
  throw new Error('Exploration smoke accepts only the local fork dev/preview on port 5191 or 5192');
}
target.searchParams.delete('bench');
target.searchParams.set('scale', '1');
const output = resolve(String(args.out || 'output/review/explore-smoke'));
await mkdir(join(output, 'screenshots'), { recursive: true });
const timeout = Number(args.timeout || 300000);
const fatal = createFatalGuard(timeout);
const report = {
  capturedAt: new Date().toISOString(), url: target.href,
  method: 'New isolated headless Chrome profile; actual pointer and keyboard inputs drive the normal running app. State is read for assertions except a separately labelled helm-return regression that calls the real takeHelm() method directly (not a boarding test). Composition images at the end use separate explicit review cameras and are not stage-comparison images.',
  checks: [], console: [], pageErrors: [], httpErrors: [], requestsFailed: [], screenshots: [],
};
let context, page, collector;
const check = (name, passed, details = {}) => {
  const result = { name, status: passed ? 'pass' : 'fail', ...details };
  report.checks.push(result);
  console.log(`[smoke] ${result.status}: ${name}`);
  return passed;
};
const readState = () => page.evaluate(() => {
  const app = window.__app, ui = window.__ui, player = app?.player;
  const xyz = value => value ? [value.x, value.y, value.z] : null;
  return {
    playerPosition: xyz(player?.position), cameraPosition: xyz(app?.camera.position),
    yaw: player?.yaw, pitch: player?.pitch, mode: player?.mode, freeCam: app?.freeCam,
    frame: app?.engine.frame, pointerLocked: Boolean(document.pointerLockElement),
    inputLocked: app?.input.locked, uiBound: ui?.app === app, gamePresent: Boolean(app?.game),
    boatDriven: app?.boatCtl.driven, boatThrottle: app?.boatCtl.throttle,
    startOpen: Boolean(ui?._start), helpOpen: Boolean(ui?.helpOpen), panelOpen: Boolean(ui?.panelOpen),
  };
});
async function waitFrames(n = 20) {
  const start = await page.evaluate(() => window.__app.engine.frame);
  await fatal.run(page.waitForFunction(({ start, n }) => window.__app.engine.frame >= start + n, { start, n }, { timeout: 15000 }), 'Running app frames');
}
async function screenshot(name) {
  await fatal.run(page.screenshot({ path: join(output, 'screenshots', `${name}.png`), animations: 'disabled' }), `Screenshot ${name}`);
  report.screenshots.push(`screenshots/${name}.png`);
}
async function keyAndWait(key, predicate, description) {
  await page.keyboard.press(key);
  await fatal.run(page.waitForFunction(predicate, null, { timeout: 5000 }), description);
  await waitFrames(4);
}
try {
  const playwright = await loadPlaywright(args.playwright), executablePath = await browserPath(args.browser);
  report.browserExecutable = executablePath;
  report.playwrightModule = playwright.path;
  context = await playwright.module.chromium.launchPersistentContext(join(output, `browser-profile-${Date.now()}`), { executablePath, ...browserOptions });
  await context.exposeBinding('__reviewReportFatal', (_, message) => fatal.abort(message));
  await context.addInitScript(() => {
    const fail = () => {
      const error = document.querySelector('#loader.tw-error');
      if (error && !window.__smokeLoaderFailed) {
        window.__smokeLoaderFailed = true;
        window.__reviewReportFatal(error.querySelector('.loader-status')?.textContent || 'Loader error').catch(() => {});
      }
    };
    new MutationObserver(fail).observe(document, { subtree: true, childList: true, attributes: true });
    window.__smokePointerLockErrors = [];
    document.addEventListener('pointerlockerror', () => window.__smokePointerLockErrors.push({ ms: performance.now(), message: 'pointerlockerror' }));
    window.__smokeHomeEvents = [];
    window.addEventListener('keydown', event => {
      if (event.code === 'Home') window.__smokeHomeEvents.push({
        ms: performance.now(), hasUI: Boolean(window.__ui), hasPlayer: Boolean(window.__ui?.app?.player),
        appReady: Boolean(window.__app?.ui), loadingStatus: document.querySelector('.loader-status')?.textContent,
      });
    }, true);
  });
  page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) report.console.push({ type: message.type(), text: message.text(), location: message.location() });
    if (message.type() === 'error' && /WebGPU device lost:|^WebGPU:/.test(message.text())) fatal.abort(message.text());
  });
  page.on('pageerror', error => { report.pageErrors.push(String(error)); fatal.abort(error); });
  page.on('crash', () => fatal.abort('Renderer crashed'));
  page.on('requestfailed', request => report.requestsFailed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ url: response.url(), status: response.status() }); });
  console.log(`[smoke] Loading ${target.href}`);
  await fatal.run(page.goto(target.href, { waitUntil: 'domcontentloaded', timeout }), 'Load exploration scene');
  await fatal.run(page.waitForFunction(() => window.__ui && !window.__app?.ui, null, { timeout: 10000 }), 'UI created before app readiness');
  await page.keyboard.press('Home');
  report.homeDuringLoad = await page.evaluate(() => window.__smokeHomeEvents[0]);
  check('Home during initialization causes no exception', report.homeDuringLoad?.hasUI && !report.homeDuringLoad?.appReady && report.pageErrors.length === 0, { event: report.homeDuringLoad });
  await fatal.run(page.waitForFunction(() => window.__app?.ui && document.querySelector('.tw-start.is-on'), null, { timeout }), 'First actionable start overlay');
  await waitFrames(35);
  report.browser = await (await context.newCDPSession(page)).send('Browser.getVersion');
  report.initialState = await readState();
  const title = await page.locator('.tw-start-title').innerText();
  const startText = await page.locator('.tw-start-cta').innerText();
  check('Chinese start screen', title.includes('月湾岛') && startText.includes('开始漫游'), { title, startText });
  check('ExplorationUI bound to app', report.initialState.uiBound);
  check('Fishing/economy Game not constructed', !report.initialState.gamePresent);
  // Observe the actual initial spawn; works with both source dev and bundled production builds.
  report.worldStart = { position: [...report.initialState.playerPosition], yaw: report.initialState.yaw, source: 'Observed initial walking state before any movement' };
  await screenshot('01-start');

  await page.locator('.tw-start-cta').click();
  await fatal.run(page.waitForFunction(() => !window.__ui._start, null, { timeout: 5000 }), 'Start click');
  await waitFrames(45); // allow the start overlay's 700 ms exit transition to finish
  const started = await readState();
  check('Start click enters exploration', !started.startOpen && started.mode === 'walk');
  report.pointerLock = {
    acquired: started.pointerLocked && started.inputLocked,
    errors: await page.evaluate(() => window.__smokePointerLockErrors),
    note: started.pointerLocked ? 'Native pointer lock acquired from the real start-button click.' : 'Headless browser did not grant pointer lock; keyboard movement is still tested independently. Mouse-look lock remains unverified in a visible browser.',
  };
  report.checks.push({ name: 'Native pointer lock', status: report.pointerLock.acquired ? 'pass' : 'limited', ...report.pointerLock });
  const beforeWalk = await readState();
  try {
    await page.keyboard.down('w');
    await waitFrames(60);
  } finally { await page.keyboard.up('w'); }
  await waitFrames(8);
  const afterWalk = await readState();
  const displacement = Math.hypot(afterWalk.playerPosition[0] - beforeWalk.playerPosition[0], afterWalk.playerPosition[2] - beforeWalk.playerPosition[2]);
  check('W moves the walking player', displacement > 0.3 && displacement < 12 && !afterWalk.freeCam, { displacementMeters: displacement, before: beforeWalk, after: afterWalk });
  await screenshot('02-walking');

  await keyAndWait('f', () => window.__app.freeCam === true, 'F enters free camera');
  check('F enters free camera', (await readState()).freeCam);
  await keyAndWait('f', () => window.__app.freeCam === false, 'F returns to walking');
  check('F returns to walking', !(await readState()).freeCam);
  await page.keyboard.press('Home');
  await waitFrames(12);
  const reset = await readState();
  const resetDistance = Math.hypot(reset.playerPosition[0] - report.worldStart.position[0], reset.playerPosition[2] - report.worldStart.position[2]);
  check('Home restores entrance and heading', resetDistance < 0.05 && !reset.freeCam && reset.mode === 'walk' && Math.abs(reset.yaw - report.worldStart.yaw) < 0.001, { resetDistanceMeters: resetDistance, state: reset });

  const panelBefore = (await readState()).panelOpen;
  await page.keyboard.press('h');
  await fatal.run(page.waitForFunction(before => window.__ui.panelOpen !== before, panelBefore, { timeout: 5000 }), 'H opens settings');
  await waitFrames(20);
  check('H toggles settings open', (await readState()).panelOpen);
  await screenshot('03-settings');
  await keyAndWait('h', () => !window.__ui.panelOpen, 'H closes settings');
  check('H toggles settings closed', !(await readState()).panelOpen);

  await keyAndWait('F1', () => window.__ui.helpOpen, 'F1 opens guide');
  await waitFrames(18);
  const guide = await page.locator('.tw-help').innerText();
  check('F1 opens Chinese exploration guide', guide.includes('漫游指南') && guide.includes('Home') && guide.includes('作品与素材来源'));
  await screenshot('04-guide');
  // Credits are reached through the real link, including its target=_blank behavior.
  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  await page.locator('.tw-help-guide a[href$="credits.html"]').click();
  const credits = await popupPromise;
  await credits.waitForLoadState('domcontentloaded');
  const creditsText = await credits.locator('body').innerText();
  const creditsCheck = /credits\.html(?:$|[?#])/.test(credits.url()) && creditsText.includes('Tidewater') && creditsText.includes('MIT') && creditsText.includes('Poly Haven');
  check('Credits reachable from guide with attribution', creditsCheck, { url: credits.url(), title: await credits.title() });
  await credits.screenshot({ path: join(output, 'screenshots', '05-credits.png'), fullPage: true });
  report.screenshots.push('screenshots/05-credits.png');
  await credits.close();
  await page.bringToFront();
  await keyAndWait('F1', () => !window.__ui.helpOpen, 'F1 closes guide');
  check('F1 closes guide', !(await readState()).helpOpen);

  // Explicit state regression: actual takeHelm() entry, then real W/Home inputs.
  // This intentionally does not claim to have navigated to or boarded the boat.
  await page.evaluate(() => window.__app.player.takeHelm());
  try {
    await page.keyboard.down('w');
    await waitFrames(25);
  } finally { await page.keyboard.up('w'); }
  const helmBefore = await readState();
  await page.keyboard.press('Home');
  await waitFrames(10);
  const helmAfter = await readState();
  check('State regression: Home leaves helm and clears throttle', helmBefore.mode === 'boat' && helmBefore.boatDriven && helmBefore.boatThrottle > 0 && helmAfter.mode === 'walk' && !helmAfter.boatDriven && helmAfter.boatThrottle === 0, {
    setup: 'Called player.takeHelm() directly; this is not a real boarding/navigation test. W and Home were browser keyboard events.',
    before: helmBefore, after: helmAfter,
  });

  // Composition images deliberately have their own camera manifest and output folder.
  if (!args['skip-compositions'] && target.port !== '5192') {
    collector = await startCollector(join(output, 'compositions'));
    collector.setFormat(await page.evaluate(() => window.__app.gpu.format));
    report.compositionCameras = await fatal.run(page.evaluate(async ({ url }) => {
      const app = window.__app;
      app.engine.stop();
      const { Bench } = await import('/src/core/Bench.js');
      const { WORLD } = await import('/src/world/WorldLayout.js');
      const Vector3 = app.camera.position.constructor;
      const spawn = WORLD.start.position;
      const spawnY = Math.max(app.terrainData.heightAt(spawn.x, spawn.z), app.colliders.groundHeightAt(spawn.x, spawn.z, 50)) + 1.62;
      const cameras = {
        entranceSea: { p: [spawn.x, spawnY, spawn.z], yaw: WORLD.start.yaw, pitch: -0.05, time: app.settings.timeOfDay },
        threeCabins: { p: [-35, 45, -5], yaw: 0, pitch: -0.25, time: 15.5 },
      };
      const bench = new Bench(app), originalSize = bench.setSize.bind(bench);
      bench.setSize = () => originalSize(1280, 720);
      bench.pose = name => {
        const pose = cameras[name];
        app.settings.timeOfDay = pose.time;
        app.settings.timeSpeed = 0;
        app.setFreeCam(true);
        app.fly.setPose(new Vector3(...pose.p), pose.yaw, pose.pitch);
        app.fly.velocity.set(0, 0, 0);
        app.post._hasPrev = false;
        app.post.motionBlur._hasPrev = false;
        Object.assign(app.post.taau, { _needsRestart: true, _hasPrevInvVP: false, _nextPrev: null, _camPrev: null, _camMotion: 0, _jitterIndex: 0 });
        app.clouds?.resetHistory();
        if (app.haze) app.haze._histValid = false;
      };
      await bench.shots(Object.keys(cameras), { tag: 'final-composition', url, frames: 64, dt: 0 });
      return cameras;
    }, { url: collector.url }), 'Final composition images');
    report.compositions = collector.received;
    check('Separate final composition images saved', collector.received.length === 2);
  }
  report.finalState = await readState();
  report.success = report.checks.every(result => result.status !== 'fail') && report.pageErrors.length === 0;
} catch (error) {
  report.success = false;
  report.error = error.stack || String(error);
  process.exitCode = 1;
  console.error(report.error);
  if (page && !page.isClosed()) {
    try { await page.screenshot({ path: join(output, 'screenshots', 'failure.png'), timeout: 5000 }); } catch {}
  }
} finally {
  if (context) await context.close();
  if (collector) await collector.close();
  if (!report.success) process.exitCode = 1;
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  const lines = ['# Exploration smoke', '', `Success: ${Boolean(report.success)}.`, '', ...report.checks.map(item => `- ${item.status.toUpperCase()}: ${item.name}`), '', `Pointer lock: ${report.pointerLock?.note || 'not reached'}`, '', `Error: ${report.error || 'none'}`, ''];
  await writeFile(join(output, 'summary.md'), lines.join('\n'));
  console.log(`[smoke] Report: ${join(output, 'report.json')}`);
}
