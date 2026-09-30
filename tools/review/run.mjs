import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { startCollector } from './collector.mjs';
import { loadPlaywright, browserPath, browserOptions, createFatalGuard } from './runtime.mjs';

// A dedicated local-development browser, never a connection to a user's browser.
const args = Object.fromEntries(process.argv.slice(2).map((argument, i, all) =>
  argument.startsWith('--') ? [argument.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true] : null
).filter(Boolean));
const url = new URL(String(args.url || 'http://127.0.0.1:5191/'));
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Review harness accepts only a local development URL');
url.searchParams.set('bench', '');
url.searchParams.set('scale', '1');
const label = String(args.label || 'review');
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Use a simple alphanumeric label');
const output = resolve(String(args.out || join('output', 'review', `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`)));
const WIDTH = 1280, HEIGHT = 720;
const measuredFrames = Number(args.frames || 120), warmupFrames = Number(args.warmup || 90), rafFrames = Number(args['raf-frames'] || 180);
for (const [name, n] of Object.entries({ measuredFrames, warmupFrames, rafFrames })) {
  if (!Number.isInteger(n) || n < 2 || n > 10000) throw new Error(`Invalid ${name}`);
}
const timeout = Number(args.timeout || 900000);
const captureOnly = Boolean(args['capture-only']);
const resetHistory = !args['keep-history'];
// Deliberately independent of later changes to the project's DebugViews.js.
const cameras = {
  beach: { p: [15, 3, -58], yaw: Math.PI, pitch: -0.08, time: 16.2 },
  aerial: { p: [60, 95, 140], yaw: Math.PI * 0.08, pitch: -0.55, time: 15 },
  village: { p: [62, 7, -62], yaw: 0.34, pitch: -0.12, time: 15.5 },
  pier: { p: [75, 4, -10], yaw: Math.PI * 1.15, pitch: -0.1, time: 15.5 },
};
const views = args.views ? String(args.views).split(',') : Object.keys(cameras);
if (!views.length || views.some(name => !cameras[name])) throw new Error('Unsupported fixed camera');
await mkdir(output, { recursive: true });

// Installed before app scripts; DOM observations preserve load-stage times from navigation.
function observeBoot() {
  const record = window.__reviewBoot = { stages: [], navigationStart: performance.timeOrigin };
  let status = '';
  const inspect = () => {
    const next = document.querySelector('.loader-status')?.textContent?.trim();
    if (next && next !== status) {
      status = next;
      record.stages.push({ status: next, ms: performance.now() });
      if (next === 'Ready' && record.appReadyMs === undefined) record.appReadyMs = performance.now();
    }
    const loader = document.querySelector('#loader');
    if (loader?.classList.contains('tw-error') && !record.error) {
      record.error = next || 'Application loader entered error state';
      window.__reviewReportFatal?.(record.error).catch(() => {});
    }
    if (loader?.classList.contains('tw-hidden') && record.loaderFadeStartMs === undefined) record.loaderFadeStartMs = performance.now();
    if (document.querySelector('.tw-start.is-on') && record.firstActionableMs === undefined) record.firstActionableMs = performance.now();
  };
  new MutationObserver(inspect).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  addEventListener('DOMContentLoaded', () => { record.domContentLoadedMs = performance.now(); inspect(); });
  addEventListener('load', () => { record.windowLoadMs = performance.now(); inspect(); });
}

const report = {
  label, url: url.href, capturedAt: new Date().toISOString(),
  method: {
    viewport: [WIDTH, HEIGHT], renderScale: 1, deviceScaleFactor: 1,
    cameras, views, captureOnly, resetHistory, seed: 'original BenchSeed.js (?bench)', screenshotFrames: 64,
    screenshotDt: 0, screenshotSimulationTime: 1000,
    warmupFrames, measuredFrames, rafFrames,
    coldDefinition: 'New empty Chromium profile; OS file cache and GPU driver shader caches are not cleared.',
    warmDefinition: 'Same profile and process, normal reload after initial shots and measurements.',
    loadDefinition: 'Navigation to visible start overlay after initialization, shader compilation and loader fade; local dev server, not public Internet.',
    fpsDefinition: 'Animation-loop FPS: actual app.frame calls driven by requestAnimationFrame in headless Chromium. Bench throughput/GPU estimates are reported separately and are not displayed FPS.',
    rendering: 'Headless hardware WebGPU if available; adapter details recorded. Headless timing is not a physical monitor refresh measurement.',
  },
  loads: {}, console: [], pageErrors: [], requestsFailed: [], httpErrors: [],
};
let context, collector;
const fatal = createFatalGuard(timeout);
try {
  const playwright = await loadPlaywright(args.playwright), executablePath = await browserPath(args.browser);
  report.browserExecutable = executablePath || 'Playwright-managed Chromium';
  report.playwrightModule = playwright.path;
  // Must not silently reuse an earlier profile, even when an output directory was reused.
  const profile = join(output, `browser-profile-${Date.now()}`);
  report.profile = profile;
  collector = await startCollector(join(output, 'screenshots'));
  context = await playwright.module.chromium.launchPersistentContext(profile, {
    executablePath,
    ...browserOptions,
  });
  await context.exposeBinding('__reviewReportFatal', (_, message) => fatal.abort(`Application load failed: ${message}`));
  await context.addInitScript(observeBoot);
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(timeout);
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type()) && report.console.length < 200) report.console.push({ type: message.type(), text: message.text(), location: message.location() });
    if (message.type() === 'error' && /WebGPU device lost:|^WebGPU:/.test(message.text())) fatal.abort(message.text());
  });
  page.on('pageerror', error => { report.pageErrors.push(String(error)); fatal.abort(error); });
  page.on('crash', () => fatal.abort('Browser renderer crashed'));
  page.on('requestfailed', request => report.requestsFailed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ url: response.url(), status: response.status() }); });
  const cdp = await context.newCDPSession(page);
  report.browser = await cdp.send('Browser.getVersion');
  let latestStage = '';
  const logStages = setInterval(async () => {
    try {
      const stage = await page.locator('.loader-status').textContent({ timeout: 1000 });
      if (stage !== latestStage) { latestStage = stage; console.log(`[${label}] ${stage}`); }
    } catch {}
  }, 3000);
  async function waitForReady(name) {
    await fatal.run(page.waitForFunction(() => Boolean(window.__bench && document.querySelector('.tw-start.is-on')), null, { timeout }), 'Application ready');
    report.loads[name] = await page.evaluate(() => ({
      ...window.__reviewBoot,
      navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
      resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, duration: r.duration, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })),
    }));
    console.log(`[${label}] ${name}: first actionable ${(report.loads[name].firstActionableMs / 1000).toFixed(2)} s`);
  }
  try {
    console.log(`[${label}] Loading new isolated profile: ${url.href}`);
    await fatal.run(page.goto(url.href, { waitUntil: 'domcontentloaded', timeout }), 'Initial navigation');
    await waitForReady('coldProfile');
    report.gpu = await fatal.run(page.evaluate(() => {
      const gpu = window.__app.gpu, info = gpu.adapter.info;
      return {
        vendor: info?.vendor, architecture: info?.architecture, device: info?.device,
        description: info?.description, isFallbackAdapter: info?.isFallbackAdapter ?? gpu.adapter.isFallbackAdapter,
        timestampQuery: gpu.hasTimestamp, format: gpu.format, features: Array.from(gpu.features),
      };
    }), 'Read adapter');
    if (report.gpu.isFallbackAdapter || /swiftshader|llvmpipe|software|microsoft basic render/i.test(JSON.stringify(report.gpu))) {
      throw new Error(`Software adapter is unsuitable for RTX baseline: ${JSON.stringify(report.gpu)}`);
    }
    collector.setFormat(report.gpu.format);
    await fatal.run(page.evaluate(({ width, height, poses, resetHistory }) => {
      const app = window.__app, bench = window.__bench;
      app.engine.stop();
      app.setRenderScale(1);
      const resize = bench.setSize.bind(bench);
      bench.setSize = () => resize(width, height);
      bench.pose = name => {
        const pose = poses[name];
        app.settings.timeOfDay = pose.time;
        app.settings.timeSpeed = 0;
        app.setFreeCam(true);
        const Vector3 = app.camera.position.constructor;
        app.fly.setPose(new Vector3(...pose.p), pose.yaw, pose.pitch);
        app.fly.velocity.set(0, 0, 0);
        if (resetHistory) {
          // Camera teleports invalidate reprojected histories. Upstream Bench.pose does not
          // notify these passes, and TAAU's still-pixel locks can retain prior-view silhouettes.
          // These flags are the existing engine's resize/AA-change restart path, scoped here
          // to this isolated review page. No application source or render features are changed.
          app.post._hasPrev = false;
          app.post.motionBlur._hasPrev = false;
          const temporal = app.post.taau;
          temporal._needsRestart = true;
          temporal._hasPrevInvVP = false;
          temporal._nextPrev = null;
          temporal._camPrev = null;
          temporal._camMotion = 0;
          temporal._jitterIndex = 0;
          app.clouds?.resetHistory();
          if (app.haze) app.haze._histValid = false;
        }
      };
      bench.setSize();
    }, { width: WIDTH, height: HEIGHT, poses: cameras, resetHistory }), 'Set fixed cameras');
    console.log(`[${label}] Capturing ${views.join(', ')} at ${WIDTH} x ${HEIGHT}`);
    await fatal.run(page.evaluate(({ views, tag, collector }) => window.__bench.shots(views, { tag, url: collector, frames: 64, dt: 0 }), { views, tag: label, collector: collector.url }), 'Fixed screenshots');
    if (collector.received.length !== views.length) throw new Error(`Only ${collector.received.length}/${views.length} screenshots received`);
    report.screenshots = collector.received;
    if (!captureOnly) {
    console.log(`[${label}] Measuring uncapped frame throughput and GPU timestamps`);
    report.throughput = await fatal.run(page.evaluate(async ({ views, warm, frames }) => {
      const bench = window.__bench, app = window.__app;
      if (bench.enabled) return bench.run({ views, warm, frames });
      // Original Bench.run assumes timestamp-query support; keep CPU/GPU throughput meaningful without it.
      const output = {};
      for (const name of views) {
        bench.pose(name);
        const run = async n => {
          let pending;
          for (let i = 0; i < n; i++) {
            app.frame(1 / 60);
            const done = app.gpu.queue.onSubmittedWorkDone();
            if (pending) await pending;
            pending = done;
          }
          await pending;
        };
        await run(warm);
        const start = performance.now();
        await run(frames);
        output[name] = { wall: (performance.now() - start) / frames, gpu: null, gpuMedian: null, note: 'timestamp-query unavailable' };
      }
      return output;
    }, { views, warm: warmupFrames, frames: measuredFrames }), 'Frame throughput benchmark');
    console.log(`[${label}] Measuring real animation-frame loop`);
    report.animationFrameLoop = await fatal.run(page.evaluate(async ({ views, warm, frames }) => {
      const app = window.__app, bench = window.__bench, result = {};
      for (const name of views) {
        bench.pose(name);
        const original = app.frame;
        const timestamps = [];
        let count = 0, done;
        const completed = new Promise(resolve => { done = resolve; });
        app.frame = function(dt, time) {
          const now = performance.now();
          original.call(this, dt, time);
          if (count++ >= warm) timestamps.push(now);
          if (timestamps.length >= frames) done();
        };
        try {
          app.start();
          await completed;
          app.engine.stop();
          await app.gpu.queue.onSubmittedWorkDone();
          const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
          const sorted = [...intervals].sort((a, b) => a - b);
          const duration = timestamps.at(-1) - timestamps[0];
          result[name] = {
            renderedFrames: timestamps.length,
            intervalCount: intervals.length,
            durationMs: duration,
            fps: intervals.length * 1000 / duration,
            meanFrameMs: duration / intervals.length,
            medianFrameMs: sorted[Math.floor(sorted.length / 2)],
            p95FrameMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
            intervalsMs: intervals,
          };
        } finally { app.engine.stop(); app.frame = original; }
      }
      return result;
    }, { views, warm: warmupFrames, frames: rafFrames }), 'Animation frame loop benchmark');
    latestStage = '';
    await fatal.run(page.reload({ waitUntil: 'domcontentloaded', timeout }), 'Warm reload');
    await waitForReady('warmReload');
    }
    report.success = true;
  } finally { clearInterval(logStages); }
} catch (error) {
  report.success = false;
  report.error = error.stack || String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  if (collector) await collector.close();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  const lines = [
    `# ${label} local review`, '',
    `Success: ${Boolean(report.success)}. Resolution: ${WIDTH} x ${HEIGHT}, render scale 1.`, '',
    `New profile to first actionable: ${report.loads.coldProfile?.firstActionableMs ? (report.loads.coldProfile.firstActionableMs / 1000).toFixed(2) + ' s' : 'not measured'}.`,
    `Warm reload to first actionable: ${report.loads.warmReload?.firstActionableMs ? (report.loads.warmReload.firstActionableMs / 1000).toFixed(2) + ' s' : 'not measured'}.`, '',
    '| Fixed view | rAF FPS | Frame p95 (ms) | Uncapped wall (ms/frame) | GPU (ms/frame) |',
    '|---|---:|---:|---:|---:|',
  ];
  const fmt = v => typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : 'unavailable';
  for (const view of views) lines.push(`| ${view} | ${fmt(report.animationFrameLoop?.[view]?.fps)} | ${fmt(report.animationFrameLoop?.[view]?.p95FrameMs)} | ${fmt(report.throughput?.[view]?.wall)} | ${fmt(report.throughput?.[view]?.gpu)} |`);
  lines.push('', 'Cold means an empty browser profile; operating-system and driver caches are not cleared. This measures the local development server, not public hosting or first-time Internet downloads. Headless rAF results are not physical monitor measurements. GPU/uncapped throughput must not be labelled displayed FPS.', '', `GPU: ${JSON.stringify(report.gpu || {})}`, '', `Browser: ${report.browser?.product || 'unavailable'}`, '', `Error: ${report.error || 'none'}`, '');
  await writeFile(join(output, 'summary.md'), lines.join('\n'));
  console.log(`[${label}] Report: ${join(output, 'report.json')}`);
}
