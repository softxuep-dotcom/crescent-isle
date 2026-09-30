# 月湾岛 · Crescent Isle

基于 [Tidewater](https://github.com/dgreenheck/tidewater) 的独立海岛探索原型。保留原生 WebGPU 海洋、天空、地形、行走、游泳与登船能力，重新设计月牙海岸、西侧码头、三间小屋和植被分区。此期聚焦漫游，不启用钓鱼、交易或升级系统。

## 本地运行

需要现代桌面浏览器和支持 WebGPU 的显卡。建议 Node.js 24；CPU 漫游测试使用 Node 22.15+ 的模块钩子。

```powershell
cd E:\test\3Dmodel\crescent-isle
npm ci
npm run dev
```

打开 http://127.0.0.1:5191/ 。点击“开始漫游”，WASD 行走，鼠标环顾，Shift 快走，Home 回到入口，Esc 释放鼠标，H 设置，F1 说明。

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5192
```

构建结果在 `dist/`；它需要通过 localhost 或 HTTPS 服务打开，不使用 file://。构建保留素材和许可证。未向公网发布。

## 验收与来源

- [设计与范围](docs/DESIGN.md)
- [三阶段固定截图、加载时间、帧率与 Git 回退点](docs/REVIEW.md)
- [资产与代码来源](docs/ASSET_SOURCES.md)
- [浏览器来源页](public/credits.html)
- [测试工具及条件](tools/review/README.md)

执行 `npm test` 验证上游引擎与保留游戏逻辑；`npm run test:walk` 验证新布局四条实际角色路线。图像与性能报告位于 `docs/review/`。

上游基线：`4811ba48d795197de5621985f404e765c0b7c0ef`。分支 `island/exploration`，阶段标签 `crescent-stage1-terrain`、`crescent-stage2-settlement`、`crescent-stage3-lighting`。

Tidewater 原作版权 `Copyright (c) 2026 DRG Software Solutions LLC`，遵循 [MIT LICENSE](LICENSE)。第三方素材保持各自许可证，见原始 [CREDITS.md](CREDITS.md) 与扩展来源说明。没有把上游已有系统和资产标为本项目原创。
