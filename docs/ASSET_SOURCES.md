# 月湾岛（Crescent Isle）资产与代码来源

审计日期：2026-09-30。本文记录月湾岛从 Tidewater 继承的代码和资产，以及可在仓库中复核的许可依据。第一阶段是可步行漫游的海岛场景；停用钓鱼、交易或角色交互，不会改变仍随项目保留的文件的来源和许可证。

## 上游版本与署名

- 上游：[Dan Greenheck / Tidewater](https://github.com/dgreenheck/tidewater)。
- 固定基线：[`4811ba48d795197de5621985f404e765c0b7c0ef`](https://github.com/dgreenheck/tidewater/tree/4811ba48d795197de5621985f404e765c0b7c0ef)。月湾岛的后续修改以本仓库 Git 提交为准，不代表上游发布。
- 上游代码许可：[MIT，仓库内完整文本](../LICENSE)；[该基线的 LICENSE](https://github.com/dgreenheck/tidewater/blob/4811ba48d795197de5621985f404e765c0b7c0ef/LICENSE)。
- 保留的原始署名：`Copyright (c) 2026 DRG Software Solutions LLC`。
- 保留的总来源表：[CREDITS.md](../CREDITS.md)；[该基线的 CREDITS.md](https://github.com/dgreenheck/tidewater/blob/4811ba48d795197de5621985f404e765c0b7c0ef/CREDITS.md)。

MIT 代码随附原版权声明、许可全文与免责声明。第三方模型、录音和字体按各自的许可记录保留，不能把整包资源都标成 CC0。本文是来源索引，不替换原始 LICENSE、CREDITS 或字体许可文本。

## 随网页发布包保留的许可

[`public/licenses/`](../public/licenses/) 放置了以下完整文本副本，构建时随 `public/` 静态文件复制到 `dist/licenses/`。[来源与致谢页面](../public/credits.html)提供本地完整许可链接，因此发布 `dist/` 时无需依赖源码目录或外部网站才能读取这些文本。

| 发布文件 | 取得方式 |
|---|---|
| [Tidewater-LICENSE.txt](../public/licenses/Tidewater-LICENSE.txt) | 根目录 `LICENSE` 的逐字节副本，包含原版权声明、许可及免责声明 |
| [Tidewater-CREDITS.md](../public/licenses/Tidewater-CREDITS.md) | 根目录 `CREDITS.md` 的逐字节副本，原文不改写 |
| [LICENSE-PermanentMarker.txt](../public/licenses/LICENSE-PermanentMarker.txt) | `tools/props/fonts/LICENSE-PermanentMarker.txt` 的逐字节副本 |
| [OFL-CabinSketch.txt](../public/licenses/OFL-CabinSketch.txt) | `tools/props/fonts/OFL-CabinSketch.txt` 的逐字节副本 |
| [OFL-Oswald.txt](../public/licenses/OFL-Oswald.txt) | `tools/props/fonts/OFL-Oswald.txt` 的逐字节副本 |
| [three.js-LICENSE.txt](../public/licenses/three.js-LICENSE.txt) | 从 [three.js 官方 dev/LICENSE](https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE) 获取的完整原文 |
| [SMAA-LICENSE.txt](../public/licenses/SMAA-LICENSE.txt) | 从 [SMAA 官方 master/LICENSE.txt](https://raw.githubusercontent.com/iryoku/smaa/master/LICENSE.txt) 获取的完整原文 |
| [AMD-FSR2-LICENSE.txt](../public/licenses/AMD-FSR2-LICENSE.txt) | 从 [AMD 官方 v2.2.1/LICENSE.txt](https://raw.githubusercontent.com/GPUOpen-Effects/FidelityFX-FSR2/v2.2.1/LICENSE.txt) 获取的完整原文 |

[SOURCES.json](../public/licenses/SOURCES.json) 记录每份文件的源 URL、取得方式、字节数和 SHA-256；在线取得的文件另记录 UTC 时间和最终响应 URL。副本不改写原作者、版权年份或许可正文。three.js 的 `dev` 和 SMAA 的 `master` 是取回许可时的分支快照，不据此推断 Tidewater 所移植代码的精确版本；AMD URL 明确使用 `v2.2.1` 标签。原音频、模型和云目录中的 CREDITS / LICENSE / LICENSING 文件也继续位于 `public/`，随构建发布。

## 实际继承的 public 文件

从固定基线恢复了 **136 个文件，共 54,287,754 字节**（包括目录内的许可说明）。恢复时逐文件校验了 Git blob SHA-1，并与上游文件树中的对象 ID 一致。可用以下命令复核固定基线清单，文件是否在场景里显示不影响此清单：

```sh
git ls-tree -r 4811ba48d795197de5621985f404e765c0b7c0ef -- public
```

| 本地范围 | 基线文件数 | 来源和现有许可依据 | 加工/使用说明 |
|---|---:|---|---|
| [`public/audio/`](../public/audio/) | 44 | 43 个 Ogg 录音文件及 1 个来源表；上游逐项标为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。[逐文件作者、Freesound 原始链接和许可](../public/audio/CREDITS.md) | 原录音裁切、淡入淡出、响度调整及 Opus 编码；环境、脚步、水声与原游戏音效一起保留。顶层 CREDITS 的“42”与实际目录/逐项表的 43 不一致，本文按实际文件数记录。 |
| [`public/models/debris/`](../public/models/debris/) | 17 | Poly Haven，CC0 1.0；[完整来源与处理表](../public/models/debris/CREDITS.md) | 4 个扫描模型、12 张纹理及 1 个来源表；网格经过减面和 LOD 处理。 |
| [`public/models/props/`](../public/models/props/) | 61 | 模型与材质来自 Poly Haven，CC0 1.0；招牌字样另涉及 Apache 2.0 / OFL 字体。[完整来源表](../public/models/props/CREDITS.md) | 模型减面、纹理缩小；包含 `props.bin`、`props.json`、纹理与 `signs.png`。即使商店停用，文件及原来源表仍保留。 |
| [`public/models/characters/`](../public/models/characters/) | 3 | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox)，MIT，`Copyright (c) 2020 Microsoft`；[本地完整许可](../public/models/characters/LICENSE-Rocketbox.md) | `joe.glb` 对应 `Wood_Male_01`，`marta.glb` 对应 `Female_Adult_04`，带待机、交谈、挥手和耸肩动画；上游工具调整纹理并重定向、烘焙动画。 |
| [`public/models/whale/`](../public/models/whale/) | 4 | 上游 [CREDITS.md](../CREDITS.md) 声明为自身脚本生成的原创鲸鱼，侧面轮廓参考 NOAA Fisheries 公有领域插图 | `humpback.bin`、`humpback.json`、反照率与高度贴图。随上游 MIT 项目保留；没有单独的鲸鱼许可文件。上游未给出具体 NOAA 插图 URL；建模参考照片不随仓库分发。不能因此把全部鲸鱼文件称为 NOAA 或 CC0 素材。 |
| [`public/textures/smaa/`](../public/textures/smaa/) | 2 | three.js 的 SMAA area/search 查找纹理；上游声明来自 Jimenez 等人的 SMAA 参考实现，MIT。见 [three.js LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)、[SMAA LICENSE](https://github.com/iryoku/smaa/blob/master/LICENSE.txt) 及本地 [CREDITS.md](../CREDITS.md) | `area.png`、`search.png`；由 [AntiAlias.js](../src/post/AntiAlias.js) 加载。不是 CC0 贴图。 |
| [`public/clouds/`](../public/clouds/) | 3 | 上游随仓库提供 `baseShape64.bin`、`blueNoise.bin` 和 [LICENSING.md](../public/clouds/LICENSING.md) | 云噪声二进制由 [SkyProClouds.js](../src/sky/SkyProClouds.js) 加载。现有说明没有逐项列明这两个二进制的作者/单独许可，详见下面的证据边界。 |
| [`public/ui/`](../public/ui/) | 2 | 上游的 `keyart.jpg`、`keyart-720.jpg` | 原版加载页图片。固定基线没有给这两张图片提供独立作者、制作方法或单独许可说明；继承来源可确认，不补写“CC0”“AI 生成”或“本项目原创”。 |

上表中的 CC0 判断依据是**固定基线上游随附的逐项声明**，没有把每个 Freesound / Poly Haven 资源页重新独立核验。所有逐文件原始链接仍可从对应的 CREDITS 表访问。

### Poly Haven 项目明细

海滩杂物：[Dead Quiver Trunk](https://polyhaven.com/a/dead_quiver_trunk)、[Dead Quiver Branch 01](https://polyhaven.com/a/dead_quiver_branch_01)、[Dead Quiver Branch 02](https://polyhaven.com/a/dead_quiver_branch_02)、[Lambis Shell](https://polyhaven.com/a/lambis_shell)。

摊位材质：[Weathered Brown Planks](https://polyhaven.com/a/weathered_brown_planks)、[Weathered Planks](https://polyhaven.com/a/weathered_planks)、[Worn Corrugated Iron](https://polyhaven.com/a/worn_corrugated_iron)、[Weathered Peeling Timber](https://polyhaven.com/a/weathered_peeling_timber)。

摊位模型：[Wooden Crate 01](https://polyhaven.com/a/wooden_crate_01)、[Wooden Crate 02](https://polyhaven.com/a/wooden_crate_02)、[Wooden Bucket 01](https://polyhaven.com/a/wooden_bucket_01)、[Fish Knife](https://polyhaven.com/a/fish_knife)、[Wooden Cutting Board](https://polyhaven.com/a/wooden_cutting_board)、[Lifebuoy](https://polyhaven.com/a/lifebuoy)、[Wooden Lantern 01](https://polyhaven.com/a/wooden_lantern_01)、[Fisherman's Hat](https://polyhaven.com/a/fishermans_hat)、[Wooden Table 03](https://polyhaven.com/a/WoodenTable_03)、[Metal Jerrycan Green](https://polyhaven.com/a/metal_jerrycan_green)、[Plastic Jerrycan](https://polyhaven.com/a/plastic_jerrycan)、[Life Jacket](https://polyhaven.com/a/life_jacket)、[Metal Toolbox](https://polyhaven.com/a/metal_toolbox)、[Wooden Display Shelves 01](https://polyhaven.com/a/wooden_display_shelves_01)。具体文件前缀、三角形数、纹理尺寸以 [props/CREDITS.md](../public/models/props/CREDITS.md) 为准。

## 程序生成的地形、建筑和植被

以下是**继承 Tidewater 的程序生成系统，再修改月湾岛参数和布局**，不把已有生成器算作月湾岛从零编写，也不把它们描述为下载来的完整海岛模型。

| 内容 | 可核查源码 | 月湾岛中的继承关系 |
|---|---|---|
| 岛屿与海岸 | [TerrainData.js](../src/world/TerrainData.js)、[IslandShape.js](../src/world/terrain/IslandShape.js)、[Terrain.js](../src/world/Terrain.js)、[WorldLayout.js](../src/world/WorldLayout.js) | 通过形状控制、噪声、高度数据和地形网格生成岛屿。新的海岸线设计建立在原生成器上。 |
| 小屋和村落 | [Buildings.js](../src/world/village/Buildings.js)、[Village.js](../src/world/Village.js) | 原参数化建筑生成墙、屋顶等几何；月湾岛调整小屋分布和场景布局。 |
| 码头和栈道 | [Boardwalk.js](../src/world/village/Boardwalk.js)、[Village.js](../src/world/Village.js) | 原程序几何与碰撞系统继续使用，调整控制点和摆放。 |
| 植物形状与分布 | [PlantGeometry.js](../src/world/vegetation/PlantGeometry.js)、[Scatter.js](../src/world/vegetation/Scatter.js)、[Vegetation.js](../src/world/Vegetation.js) | 树干、叶片等由代码生成；在原散布及 LOD 系统中重新设计密度和区域。 |

这些源码遵循上游 MIT 许可。海滩扫描杂物、摊位小物件等仍按上一节的第三方素材来源单独归属；“程序生成植被”不意味着所有场景物体都由代码原创生成。

## 继承的海洋、天空与渲染代码

海洋系统沿用 [`src/ocean/`](../src/ocean/) 的 FFT 波浪、近岸波浪、水面材质、折射、泡沫、焦散与水下处理。天空沿用 [`src/sky/`](../src/sky/) 的大气、云、天空和环境光；本阶段的水色、光照或配置调整不改变原作者归属。

上游 CREDITS 明确声明云噪声、光照和采样方案改编自 **DRG Software Solutions 自有的 Sky Pro WebGPU**，由著作权人在 Tidewater 中按 MIT 发布。[SkyProClouds.js](../src/sky/SkyProClouds.js) 文件头也直接标注其来自 `sky-pro-webgpu`。这说明天空效果包含作者既有工程成果，不能标注为月湾岛原创。此声明不自动补全所有二进制贴图的独立来源记录。

渲染算法/移植代码还保留以下上游关系：

- [AntiAlias.js](../src/post/AntiAlias.js)：文件头说明 FXAA / SMAA 移植自 three.js，对应上面的 MIT 库和纹理来源。
- [TemporalUpscale.js](../src/post/TemporalUpscale.js)：文件头说明使用 AMD FSR2 2.2 的累积方案及 three.js TAAUNode 的部分处理；AMD 对应 [FSR2 2.2.1 MIT 许可](https://github.com/GPUOpen-Effects/FidelityFX-FSR2/blob/v2.2.1/LICENSE.txt)，版权为 `Copyright (c) 2022-2023 Advanced Micro Devices, Inc.`。
- FFT 海洋、Hillaire 大气、Nubis 云、海浪和后期等论文/技术参考，见上游 [CREDITS.md](../CREDITS.md) 的 Techniques and references 表。论文参考与实际复制或移植的软件代码分别记录。
- 本文仅确认固定基线中实际存在的海洋代码及其 MIT 发布方式；没有将整个海洋系统称为直接复制 Water Pro，也没有补写本次未核实的 Water Pro 许可关系。

## 字体

`signs.png` 是上游工具生成的招牌、粉笔价目表和秤盘图像，所用字体与 Poly Haven 模型的许可不同。

| 字体 | 来源/许可 | 本地许可文本或使用位置 |
|---|---|---|
| Permanent Marker | [Google Fonts](https://fonts.google.com/specimen/Permanent+Marker)，Apache 2.0 | [LICENSE-PermanentMarker.txt](../tools/props/fonts/LICENSE-PermanentMarker.txt)，字体文件在同目录；供 `tools/props/build.mjs` 制作招牌 |
| Cabin Sketch | [Google Fonts](https://fonts.google.com/specimen/Cabin+Sketch)，SIL OFL 1.1 | [OFL-CabinSketch.txt](../tools/props/fonts/OFL-CabinSketch.txt)；同目录保留字体文件 |
| Oswald | [Google Fonts](https://fonts.google.com/specimen/Oswald)，SIL OFL 1.1 | [OFL-Oswald.txt](../tools/props/fonts/OFL-Oswald.txt)；同目录保留字体文件 |
| Inter | [项目](https://github.com/rsms/inter)、[OFL 1.1](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt) | 原版 `index.html` 从 Google Fonts 请求，未包含在 `public/` |
| JetBrains Mono | [项目及 OFL 1.1](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt) | 原版 `index.html` 从 Google Fonts 请求，未包含在 `public/` |
| Caveat Brush | [Google Fonts OFL 1.1](https://github.com/google/fonts/blob/main/ofl/caveatbrush/OFL.txt) | 原版 `index.html` 的 Google Fonts 请求中包含；原总 CREDITS 未单列 |
| Kalam | [Google Fonts OFL 1.1](https://github.com/google/fonts/blob/main/ofl/kalam/OFL.txt) | 原版 `index.html` 的 Google Fonts 请求中包含；原总 CREDITS 未单列 |

后四种在线字体的官方许可文本于审计日核对，用于记录原作来源。月湾岛的新界面已移除原版 Google Fonts 请求，当前 `index.html` 不再请求 Inter、JetBrains Mono、Caveat Brush 或 Kalam 的在线字体；来源与致谢页也使用系统字体。原招牌字体的本地文件及许可继续保留，其中三份完整许可已复制到 `public/licenses/` 随网页构建发布。

## 证据边界与保留规则

1. `public/clouds/LICENSING.md` 是随上游一起继承的文本，列有 ambientCG Ground003/033/086、Poly Haven rocks_ground_09、NASA Tycho 星空和 AI cirrus 图。但这些目录/图片**不在固定基线的 public 文件清单里**。因此本文不把它们算为月湾岛已打包的素材，也不拿这份文件证明 `baseShape64.bin` 或 `blueNoise.bin` 是 CC0。
2. 云噪声二进制和两张 keyart 的获取来源已经定位到固定基线；上游缺少逐文件创作来源及单独许可说明，本文保留这个缺口，不自行推断。原 `LICENSING.md`、原 CREDITS 及 MIT LICENSE 继续随项目保留。
3. 鲸鱼的“原创程序模型”和 NOAA 参考关系来自上游声明；具体插图链接、参考照片及独立模型许可没有随固定基线给出。原声明保留，不能将其扩大成整个模型包都来自公有领域。
4. 上游没有在 `public/textures/smaa/` 另放完整许可文件；月湾岛已将 three.js / SMAA / AMD 的官方完整许可原文补充至 `public/licenses/`，保留获取源 URL 与校验值。本文不声称上游逐个移植文件的第三方版权头已经全部审计完整。
5. 未显示、未加载或暂时停用的角色、摊位、鲸鱼和游戏音效，仍保留其原始 LICENSE / CREDITS。若以后裁减文件，来源说明随实际分发清单更新；不用“未启用”来重新标注许可证。
6. 新增外部资源时，在此文和相应目录中记录具体作者、源 URL、取得版本、许可证及加工步骤；月湾岛生成器参数与布局的修改以阶段 Git 提交保存，继续保留上游作者署名。
