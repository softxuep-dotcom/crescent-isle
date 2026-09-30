# stage2-settlement local review

Success: true. Resolution: 1280 x 720, render scale 1.

New profile to first actionable: 13.67 s.
Warm reload to first actionable: 13.21 s.

| Fixed view | rAF FPS | Frame p95 (ms) | Uncapped wall (ms/frame) | GPU (ms/frame) |
|---|---:|---:|---:|---:|
| beach | 60.00 | 16.80 | 6.09 | 5.96 |
| aerial | 60.00 | 16.80 | 6.08 | 5.95 |
| village | 60.00 | 16.90 | 6.48 | 6.38 |
| pier | 60.00 | 16.80 | 5.99 | 5.85 |

Cold means an empty browser profile; operating-system and driver caches are not cleared. This measures the local development server, not public hosting or first-time Internet downloads. Headless rAF results are not physical monitor measurements. GPU/uncapped throughput must not be labelled displayed FPS.

GPU: {"vendor":"nvidia","architecture":"ampere","device":"","description":"","isFallbackAdapter":false,"timestampQuery":true,"format":"bgra8unorm","features":["float32-filterable","timestamp-query","rg11b10ufloat-renderable","float32-blendable","shader-f16","clip-distances"]}

Browser: Chrome/154.0.8037.58

Error: none
