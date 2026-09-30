import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadPlaywright, browserPath, browserOptions, createFatalGuard } from './runtime.mjs';

// Small local capability page. No Tidewater assets or scene generation are loaded.
const output = resolve(process.argv[2] || 'output/review/gpu-probe');
await mkdir(output, { recursive: true });
const report = { capturedAt: new Date().toISOString() };
const server = http.createServer((_, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><title>Local WebGPU capability probe</title><p>Isolated local WebGPU capability probe.</p>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let context;
try {
  const playwright = await loadPlaywright(), executablePath = await browserPath();
  report.browserExecutable = executablePath;
  report.playwrightModule = playwright.path;
  context = await playwright.module.chromium.launchPersistentContext(join(output, `browser-profile-${Date.now()}`), { executablePath, ...browserOptions });
  const page = context.pages()[0] || await context.newPage();
  const fatal = createFatalGuard(30000);
  page.on('pageerror', fatal.abort);
  page.on('crash', () => fatal.abort('Probe browser crashed'));
  await fatal.run(page.goto(`http://127.0.0.1:${server.address().port}/`), 'Capability page');
  const cdp = await context.newCDPSession(page);
  report.browser = await cdp.send('Browser.getVersion');
  if (context.browser()) {
    const browserCDP = await context.browser().newBrowserCDPSession();
    try { report.browserGpu = (await browserCDP.send('SystemInfo.getInfo')).gpu; }
    catch (error) { report.browserGpuError = error.message; }
    await browserCDP.detach();
  }
  report.webgpu = await fatal.run(page.evaluate(async () => {
    if (!navigator.gpu) return { available: false };
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { available: true, adapter: null };
    const info = adapter.info;
    const want = {
      maxSampledTexturesPerShaderStage: 32,
      maxSamplersPerShaderStage: 16,
      maxStorageBuffersPerShaderStage: 10,
      maxStorageTexturesPerShaderStage: 8,
      maxComputeWorkgroupStorageSize: 32768,
      maxColorAttachmentBytesPerSample: 64,
      maxStorageBuffersInVertexStage: 4,
      maxStorageBuffersInFragmentStage: 8,
      maxStorageTexturesInFragmentStage: 4,
      maxBindingsPerBindGroup: 1000,
      maxBufferSize: 1024 * 1024 * 1024,
      maxStorageBufferBindingSize: 512 * 1024 * 1024,
    };
    const requested = {}, comparison = {};
    for (const [name, desired] of Object.entries(want)) {
      const supported = adapter.limits[name];
      comparison[name] = { desired, supported: supported ?? null, clamped: supported !== undefined && desired > supported };
      if (supported !== undefined) requested[name] = Math.min(desired, supported);
    }
    const optional = ['float32-filterable', 'timestamp-query', 'rg11b10ufloat-renderable', 'float32-blendable', 'shader-f16', 'clip-distances'];
    const features = optional.filter(feature => adapter.features.has(feature));
    const result = {
      available: true,
      adapter: { vendor: info?.vendor, architecture: info?.architecture, device: info?.device, description: info?.description, isFallbackAdapter: info?.isFallbackAdapter ?? adapter.isFallbackAdapter },
      canvasFormat: navigator.gpu.getPreferredCanvasFormat(),
      features: Array.from(adapter.features), requestedFeatures: features,
      limits: comparison, requestedLimits: requested,
    };
    try {
      const device = await adapter.requestDevice({ requiredFeatures: features, requiredLimits: requested });
      result.originalDeviceRequest = 'success';
      device.pushErrorScope('validation');
      const module = device.createShaderModule({ code: '@compute @workgroup_size(1) fn main() {}' });
      await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      result.minimalPipelineValidation = (await device.popErrorScope())?.message ?? 'success';
      device.destroy();
    } catch (error) { result.originalDeviceRequest = error.message; }
    return result;
  }), 'WebGPU adapter/device probe');
  report.success = report.webgpu.originalDeviceRequest === 'success' && report.webgpu.minimalPipelineValidation === 'success';
} catch (error) {
  report.success = false;
  report.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(join(output, 'probe.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, browser: report.browser?.product, gpuDevices: report.browserGpu?.devices, webgpu: report.webgpu, error: report.error, report: join(output, 'probe.json') }, null, 2));
}
