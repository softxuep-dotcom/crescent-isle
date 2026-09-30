# Local reproducible review

This harness launches a separate headless Chromium process with an empty profile. It does not attach to, read, or control the user's browser. It reuses Tidewater's seeded world and `Bench.shots()` / `Bench.run()` APIs. The collector binds only to `127.0.0.1` and converts raw render output directly to PNG.

Run the original project on port 5189 and the fork on port 5191. Ensure required assets have finished downloading before testing. Run one review at a time, and avoid other GPU-intensive work while it runs.

```powershell
node tools/review/run.mjs --url http://127.0.0.1:5189/ --label baseline --out E:/test/3Dmodel/output/crescent-review/baseline
node tools/review/run.mjs --url http://127.0.0.1:5191/ --label stage1-terrain --out E:/test/3Dmodel/output/crescent-review/stage1-terrain
node tools/review/run.mjs --url http://127.0.0.1:5191/ --label stage2-settlement --out E:/test/3Dmodel/output/crescent-review/stage2-settlement
node tools/review/run.mjs --url http://127.0.0.1:5191/ --label stage3-lighting --out E:/test/3Dmodel/output/crescent-review/stage3-lighting
```

The script uses a project-installed `playwright-core` or `playwright`, or an existing Playwright installation registered in `%LOCALAPPDATA%/ms-playwright/.links`. It does not install packages. To select an installed runtime explicitly:

```powershell
$env:REVIEW_PLAYWRIGHT = 'C:/path/to/node_modules/playwright-core/index.mjs'
$env:REVIEW_BROWSER = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
```

Parameters: `--url`, `--label`, `--out`, optional `--playwright` and `--browser`, `--frames` (default 120 uncapped samples), `--warmup` (90), `--raf-frames` (180), `--timeout` (900000 ms). Standard reviews use the defaults. A fresh profile is created inside the output directory each run and retained so browser-cache isolation is auditable.

`--capture-only` creates screenshots and a separate supplementary report without repeating performance measurements or warm reload. `--views beach,pier` selects an ordered subset of the four fixed cameras. Use a new output directory when recapturing images so the original first-load measurements remain intact.

## What is measured

- New empty browser profile: navigation to the visible start overlay, after scene generation, shader compilation, warmup and the original loader fade. Every loader status is timestamped separately.
- Warm reload: normal reload in the same profile and process after the first review completes.
- Real application animation loop: `app.start()` drives `app.frame()` using `requestAnimationFrame`; mean FPS, median and p95 frame intervals are recorded for each fixed camera.
- Separate uncapped CPU/GPU frame throughput from original `Bench.run()` and GPU timestamp queries if supported. These values are not presented as displayed FPS. Without timestamp support, the same two-in-flight throughput pattern is measured and GPU fields remain null.
- Four fixed cameras at 1280 x 720, render scale 1, device scale factor 1; 64 static convergence frames, `dt = 0`, deterministic random seed. Camera positions and time of day are hardcoded in the harness and included in every report so project changes cannot silently move the comparison cameras.
- Every camera teleport resets the original temporal upscaler, previous-camera matrices, motion-blur camera history, clouds and atmospheric-shaft history before those 64 frames. Upstream `Bench.pose()` does not do this; its retained still-pixel history can otherwise leave silhouettes of the previous village view in the next view's sky. This reset is applied only in the review page and uses the engine's existing restart flags, without altering application source or disabling effects. `--keep-history` reproduces the original behavior for diagnosis.
- Browser version, adapter identity, failures, console warnings/errors and resource timing. Software rendering is rejected when identified.

Outputs: `report.json`, `summary.md`, and `screenshots/<label>-{beach,aerial,village,pier}.png`.

Fatal loader errors, uncaught page exceptions, GPU validation errors, lost devices and renderer crashes abort immediately and retain a failed report. They do not wait for the full application-readiness timeout. Each screenshot/benchmark operation also has a hard timeout.

To check the adapter and the original project's exact device-limit/feature request without loading the scene or its assets:

```powershell
node tools/review/probe.mjs E:/test/3Dmodel/output/crescent-review/gpu-probe
```

This creates a tiny localhost page with the same separate browser configuration. `probe.json` records requested, supported and clamped limits, device creation, and a minimal compute pipeline. It does not prove the complete scene's shaders compile.

The initial baseline and stage1 runs were captured before the camera-reset correction. Their original loading and performance reports remain unchanged; replacement comparison images are in the separate `baseline-capture-reset` and `stage1-capture-reset` review outputs. Subsequent normal runs include the reset automatically. The initially observed lone 404 console message was traced to `/favicon.ico`, not a missing scene asset.

The cold-profile figure is not an OS/driver cache reset and is not an Internet download benchmark. Headless Chromium may differ from the user's visible browser; do not claim these numbers describe physical monitor presentation or all hardware. A missing asset, failed request, or shader warning must be reviewed alongside the image; `success` only means the harness completed, not that the scene has no defects.
