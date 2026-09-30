import { access, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function exists(file) { try { await access(file); return true; } catch { return false; } }
export async function loadPlaywright(explicit = process.env.REVIEW_PLAYWRIGHT) {
  if (explicit) return { module: await import(pathToFileURL(resolve(String(explicit))).href), path: resolve(String(explicit)) };
  try { return { module: await import('playwright-core'), path: 'playwright-core' }; } catch {}
  try { return { module: await import('playwright'), path: 'playwright' }; } catch {}
  const links = join(process.env.LOCALAPPDATA || '', 'ms-playwright', '.links');
  if (await exists(links)) {
    for (const file of (await readdir(links)).sort()) {
      const location = (await readFile(join(links, file), 'utf8')).trim();
      const entry = join(location, 'index.mjs');
      if (await exists(entry)) return { module: await import(pathToFileURL(entry).href), path: entry };
    }
  }
  throw new Error('Set REVIEW_PLAYWRIGHT to an installed playwright-core/index.mjs; no dependency was installed automatically');
}
export async function browserPath(explicit = process.env.REVIEW_BROWSER) {
  if (explicit) return resolve(String(explicit));
  for (const file of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ]) if (await exists(file)) return file;
  return undefined;
}
export const browserOptions = {
  headless: true,
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  args: ['--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
};

export function createFatalGuard(timeout) {
  let failure, rejectFailure;
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  // A failure may arrive between guarded operations; retain it without unhandled rejection noise.
  failed.catch(() => {});
  const abort = reason => {
    if (failure) return;
    failure = reason instanceof Error ? reason : new Error(String(reason));
    rejectFailure(failure);
  };
  return {
    abort,
    async run(operation, description = 'Browser operation') {
      if (failure) throw failure;
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${description} exceeded ${timeout} ms`)), timeout);
      });
      try { return await Promise.race([operation, failed, deadline]); }
      finally { clearTimeout(timer); }
    },
  };
}
