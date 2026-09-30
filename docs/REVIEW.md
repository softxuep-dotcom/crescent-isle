# 月湾岛阶段验收记录

测试日期：2026-09-30。原版固定为 Tidewater `4811ba48d795197de5621985f404e765c0b7c0ef`；原仓库源码保持干净。月湾岛在独立目录和 `island/exploration` 分支开发。

## 加载与帧率

Windows，RTX 3060（驱动 32.0.15.6094），Chrome 154.0.8037.58，硬件 WebGPU/NVIDIA Ampere；本地 Vite 开发服务，1280×720，DPR 1，渲染比例 1。每次首次测试使用新建空浏览器配置，保留操作系统和显卡驱动缓存。加载从导航开始，到场景、着色器编译及加载过渡完成后出现可操作入口。

| 阶段 | 新配置加载（秒） | 同配置重载（秒） | 四视角 rAF FPS | GPU 毫秒/帧 | Git 回退点 |
|---|---:|---:|---:|---:|---|
| 原版基线 | 21.85 | 14.69 | 59.99–60.01 | 5.97–6.13 | `4811ba4` |
| 1 · 地形 | 16.83 | 15.65 | 60.00–60.00 | 5.97–6.13 | `crescent-stage1-terrain` |
| 2 · 建筑与植被 | 13.67 | 13.21 | 60.00–60.00 | 5.85–6.38 | `crescent-stage2-settlement` |
| 3 · 海水与光照 | 14.31 | 21.58 | 59.99–60.00 | 5.66–6.14 | `crescent-stage3-lighting` |

这些是本地单次样本，不是公网下载测速，也不是不同硬件上的保证。四阶段 rAF 接近 60 FPS，不能据此证明性能完全相同；GPU 时间提供额外比较依据。GPU 计时不等于显示帧率。最终阶段的重载比首次更慢（21.58 秒），保留该原始结果，不推断每次重载都会加速。Chrome 为独立无头实例，未操控用户浏览器；rAF 不代表物理显示器实测。

每视角预热 90 帧，GPU/连续提交测量 120 帧，rAF 测量 180 帧。原版和地形阶段测量时使用上游相机切换流程；发现静态天空残影后，截图工具在相机瞬移时清除 TAAU/云/雾历史。它不改变场景源码，后续阶段一致使用；原版和地形的截图已按修正流程重拍，首次加载与性能数据没有覆盖。`capture.json` 单独记录重拍条件。

## 固定视角截图与原始数据

比较相机固定在世界坐标：海滩 `[15,3,-58]`、鸟瞰 `[60,95,140]`、原村落 `[62,7,-62]`、原码头 `[75,4,-10]`。相机朝向、时间、种子和 64 帧静态收敛条件写在每个 JSON 的 `method` 中。原村落/原码头相机在新布局中不一定正对建筑，这是保留相同坐标比较的结果；最终另外提供新布局构图，二者不混用。

| 阶段 | 海滩 | 鸟瞰 | 原村落方向 | 原码头方向 | 测量 |
|---|---|---|---|---|---|
| 原版基线 | [beach](review/baseline/baseline-capture-reset-beach.png) | [aerial](review/baseline/baseline-capture-reset-aerial.png) | [village](review/baseline/baseline-capture-reset-village.png) | [pier](review/baseline/baseline-capture-reset-pier.png) | [JSON](review/baseline/performance.json) / [摘要](review/baseline/summary.md) |
| 1 · 地形 | [beach](review/stage1-terrain/stage1-capture-reset-beach.png) | [aerial](review/stage1-terrain/stage1-capture-reset-aerial.png) | [village](review/stage1-terrain/stage1-capture-reset-village.png) | [pier](review/stage1-terrain/stage1-capture-reset-pier.png) | [JSON](review/stage1-terrain/performance.json) / [摘要](review/stage1-terrain/summary.md) |
| 2 · 建筑与植被 | [beach](review/stage2-settlement/stage2-settlement-beach.png) | [aerial](review/stage2-settlement/stage2-settlement-aerial.png) | [village](review/stage2-settlement/stage2-settlement-village.png) | [pier](review/stage2-settlement/stage2-settlement-pier.png) | [JSON](review/stage2-settlement/performance.json) / [摘要](review/stage2-settlement/summary.md) |
| 3 · 海水与光照 | [beach](review/stage3-lighting/stage3-lighting-beach.png) | [aerial](review/stage3-lighting/stage3-lighting-aerial.png) | [village](review/stage3-lighting/stage3-lighting-village.png) | [pier](review/stage3-lighting/stage3-lighting-pier.png) | [JSON](review/stage3-lighting/performance.json) / [摘要](review/stage3-lighting/summary.md) |

## 漫游检查

[阶段 2 路线报告](review/stage2-settlement/walk-check.json)使用实际 TerrainData、Village、植被、岩石、杂物碰撞体和 Player，以 1/60 秒固定步长，从入口连续行走到码头和三个小屋外，再分别返回。四条路线均通过：未卡住、未跌穿地面、无非有限坐标、没有误进入游泳。地基落地、出生点植物净空、码头道具和梯子位置检查通过。

该 CPU 回归的海水查询固定为 0 米，不等价于真实波浪/游泳/船舶测试，也不测鼠标锁定或 GPU。[开发版交互报告](review/final-smoke/report.json)与[生产构建交互报告](review/production-smoke/report.json)均通过：真实按键 W 行走约 2.97 米，F 切换自由相机，Home 回到入口，H 与 F1 开关面板，来源页可达。加载中 Home 和操舵状态下 Home 的回归也通过；后者明确以实际 `takeHelm()` 设置操舵状态，再用真实按键验证，不冒充完整登船流程。

无头浏览器拒绝鼠标 pointer lock，该项标为未验证；可见浏览器中的锁定与持续鼠标环顾需要现场确认。没有把这一项计为通过。生产版测试无失败请求、HTTP 错误、页面异常或 GPU 错误。

最终构图与界面：[入口](review/final-smoke/screenshots/01-start.png)、[朝向海面](review/final-smoke/compositions/final-composition-entranceSea.png)、[三间小屋](review/final-smoke/compositions/final-composition-threeCabins.png)、[漫游指南](review/final-smoke/screenshots/04-guide.png)。

`npm test`（原引擎与保留游戏逻辑）、新布局 CPU 路线检查及 `npm run build` 均通过。

## 日志与已知限制

- 所有阶段无未捕获页面异常或 WebGPU 验证错误，无场景素材请求失败。
- 原版至阶段 2 有 `/favicon.ico` 404；阶段 3 提供 SVG 图标后消除。
- Windows 忽略 WebGPU `powerPreference` 的提示仍在，但实际探测为 RTX 3060，非软件回退。
- 上游 `ShoreWaves.buildDirTexture` 记录改用 `terrainShoreSample` 的回退警告；原版与三个阶段一致，海岸波浪可渲染。
- Vite 构建保留上游 `LocalLights.js` 同时静态/动态导入的分包提示，构建成功。
- 场景保留山体、渲染器和程序化生成系统；这是在现有系统上设计的新海湾与聚落，不是从零创造整套引擎。小屋暂无室内玩法。

## 复现与回退

见 [测试工具说明](../tools/review/README.md)。先 `npm ci`、`npm run dev`，再 `npm run review -- --url http://127.0.0.1:5191/ --label review --out artifacts/review`。测试脚本寻找已安装的 Playwright，可通过 `REVIEW_PLAYWRIGHT`/`REVIEW_BROWSER` 显式指定。`npm run test:walk` 输出 CPU 漫游报告。

先保存当前修改，再用 `git switch --detach crescent-stage1-terrain` 或其他阶段标签查看历史；`git switch island/exploration` 返回最终场景。阶段 1、2 尚沿用上游入口外观，独立入口与来源页在阶段 3 接入。源码与测量证据在相应 Git 提交中。
