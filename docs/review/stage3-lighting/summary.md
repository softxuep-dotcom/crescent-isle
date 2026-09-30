# stage3-lighting local review

Success: true. Resolution: 1280 x 720, render scale 1.

New profile to first actionable: 14.31 s.
Warm reload to first actionable: 21.58 s.

| Fixed view | rAF FPS | Frame p95 (ms) | Uncapped wall (ms/frame) | GPU (ms/frame) |
|---|---:|---:|---:|---:|
| beach | 59.99 | 17.10 | 6.40 | 5.93 |
| aerial | 60.00 | 17.00 | 6.99 | 5.73 |
| village | 60.00 | 17.00 | 7.49 | 6.14 |
| pier | 60.00 | 17.00 | 6.70 | 5.66 |

Cold means an empty browser profile; operating-system and driver caches are not cleared. This measures the local development server, not public hosting or first-time Internet downloads. Headless rAF results are not physical monitor measurements. GPU/uncapped throughput must not be labelled displayed FPS.

GPU: {"vendor":"nvidia","architecture":"ampere","device":"","description":"","isFallbackAdapter":false,"timestampQuery":true,"format":"bgra8unorm","features":["float32-filterable","timestamp-query","rg11b10ufloat-renderable","float32-blendable","shader-f16","clip-distances"]}

Browser: Chrome/154.0.8037.58

Error: none
