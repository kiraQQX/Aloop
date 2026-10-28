# Aloop — 在线研究实验入口

Aloop 是一个零构建依赖的静态网站原型，用于展示研究团队的在线实验入口。当前内置的首个实验是 **beLieve**。界面采用纯 HTML、CSS 和经典 JavaScript，便于在本地检查，也可直接部署到 GitHub Pages 等静态托管服务。

> **研究与数据状态：原型阶段。** beLieve 的题目与证据文案承接自上一版 `lateral-reading-lab` 项目，仍需研究者/领域专家审核。网站未接入真实服务器端账号、数据存储、分组随机化或备份机制。会话数据只保存在参与者当前浏览器的本地存储中。请勿将当前版本直接用于正式招募或验证性数据收集；正式部署前还需完成伦理审批、知情同意审查、预注册、题库审核、数据保护与服务器端随机化。

## 本地运行

推荐通过本地 HTTP 服务运行，不要直接双击 `index.html`，因为实验运行时会按需加载 JavaScript 文件。

**Windows：** 双击 `start-local.bat`。脚本会在 `http://127.0.0.1:8080/` 启动 Python 静态服务器并打开浏览器。若端口被占用，请先关闭占用该端口的程序，或在脚本中更改端口号。

**macOS / Linux：** 在终端执行：

```bash
chmod +x start-local.sh
./start-local.sh
```

也可以在项目根目录手动运行：

```bash
python -m http.server 8080 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8080/`。

## 当前功能

- 深蓝全屏首页，以抽象地形纹理与真实的三维脑皮层表面网格为视觉主体，并提供滚动式实验入口。
- 固定深蓝半透明导航栏；实验快速选择菜单、登录/注册交互模型、中文/英文原位切换。
- beLieve 入口与实验运行时分离；进入后首先展示知情同意页面。
- 基于公开 GLB 解剖网格的可交互 3D 脑皮层：支持拖动旋转、缩放、点击区域高亮、键盘旋转、重置视角和可选自动旋转；模型或 CDN 加载失败时显示错误状态及原始开源查看器链接。模型网格与查看器代码采用不同许可，具体见技术规范。
- Web Audio 合成的轻提示音和玻璃滑动声；本轮视觉与身份修改未改动音频模块，声音状态仍保存在本地，并在实验运行期间静音。
- beLieve 要求登录后进入。当前预留本地调试账号：邮箱/用户名 `1`，密码 `1`；登录状态保存在当前浏览器中，尚不属于真实账号系统。
- beLieve 保留训练、测试、反馈、结果说明和 JSON 导出流程；导出数据包含 `site`、`experiment_id` 和 `app_version` 元数据。
- 从部分旧 `llab_*` 本地键迁移语言与未完成会话，便于原型测试时续接此前进度。
- A/B/C 条件选择不作为公开首页内容；仅通过 `?qa=1&arm=A|B|C` 供开发质检使用。该客户端分组不是正式研究随机化。

## 目录结构

```text
aloop-site/
├── index.html
├── assets/
│   ├── css/                  # tokens、基础样式、导航、首页、EasySci、响应式与蓝色主题
│   ├── i18n/site.js          # 网站中英文文案
│   ├── js/core/              # 环境检测、存储、音频、mock auth、路由与性能管理
│   ├── js/ui/                # 导航菜单、账号模态框、首页实验区块
│   ├── js/gl/engine.js       # beLieve 数据海粒子引擎
│   ├── js/gl/brain-surface.js# 三维脑皮层 GLB 加载、拾取与相机控制
│   └── js/registry.js        # 实验注册与按需加载
├── experiments/believe/      # beLieve 实验清单、样式、运行时
├── tests/                    # 静态检查与浏览器烟雾测试
├── design.md                 # Aloop 蓝色科研主题与可访问性规范
├── roadmap.md                # 提供的技术路线
├── standalone.html           # 内联资源的单文件版本
├── DEPLOY_GITHUB_PAGES.md
└── start-local.*
```


## Products and EasySci resource directory

The top navigation now exposes two sibling menus: **Experiments** and **Products**. Products contains **EasySci**, available directly at `#/easysci`; each tool also has a stable detail route at `#/easysci/<tool-id>`.

EasySci is a bilingual, editorially curated tool directory. Its primary capability taxonomy is **Skill / MCP**; users can further narrow results by task domain (literature/research, data analysis, experiments, design, creative work, and coding) and access model. Agent plugin packages or bundles appear in both Skill and MCP filters when they contain both capabilities. Legacy web tools remain visible under **All resources**, so the existing design, experiment, and research directory is preserved.

As of 2026-10-22, the directory contains **432 unique records** across eight task domains: research (52), data (50), experiment (57), design (55), image (50), assets (68), creative (50), and coding (50). Each category meets the minimum of 50 resources. The directory keeps its Skill / MCP / Agent Plugin capability facets alongside category and access-model filters; capability counts are intentionally overlapping for bundles. All catalogue results are searchable and sortable, while the initial view progressively renders 50 cards at a time to avoid placing all 432 entries in the DOM at once.

The expanded catalogue incorporates the supplied asset, design and experiment lists, the retained 148-entry directory, and an additional curated set across research, data, image editing, creative work and coding. Research sources and model/asset licences are recorded in `TECHNICAL_SPECIFICATIONS.md` and `docs/EASYSCI_CATALOGUE_RESEARCH.md`. Popularity is treated as a time-sensitive signal rather than proof of quality; this is a curated practical directory, not a definitive global ranking.

Access-model labels distinguish **Free**, **Freemium**, **Paid**, and **Open Source**. Open-source tools can have separate hosted-service, API, storage, and quota terms. Some packages use different installation or manifest conventions across Codex, Claude Code, Cursor, and other clients; the directory does not imply that a single plugin package is universally portable.

**Verification note:** every resource currently uses `lastVerifiedAt: null` unless individually updated after human verification. The records include source links and install guidance, but destination reachability, current package names, feature availability, pricing, account requirements, repository license, and each asset's reuse rights still require a final item-level check. Before formal research or commercial use, verify official docs and do not upload identifiable participant data to public tools without reviewing consent, institutional requirements, security, and data-processing terms. Review third-party Skills, MCP servers, and plugins like code dependencies: inspect permissions, file/network scope, scripts, authentication, and tool calls before enabling them.

The homepage brain is no longer the legacy particle/schematic drawing. `assets/js/gl/brain-surface.js` loads the open cortical-surface geometry from the `itayinbarr/brainproject` GLB atlas, keeps meshes labelled `bx_cat=cortex`, applies region-aware surface materials, and exposes drag rotation, zoom, hit-testing, arrow-key rotation, reset and optional auto-rotation. Three.js is pinned to `0.186.1`; the source GLB and Draco decoder are external HTTPS dependencies. If the CDN/model is inaccessible, the page displays a recovery link to the open-source viewer instead of showing a fake flat fallback. The anatomy asset is licensed separately from the viewer code (CC BY-SA 4.0); see the source attribution details in the technical specification.

Regenerate the single-file demo after source edits with:

```bash
python tests/build_standalone.py
```

## 路由与 QA

- `#/`：首页顶部。
- `#/e/believe`：滚动到 beLieve 入口区块。
- `#/e/believe/run`：加载实验运行时并进入实验入口。
- `?qa=1&arm=A`、`?qa=1&arm=B`、`?qa=1&arm=C`：仅用于本地开发质检。由于分组参数由客户端提供，不具备正式研究的随机化或防篡改属性。

清除当前浏览器对本地站点的存储，会同时清除该浏览器中保存的实验进度和事件日志。实验完成后建议使用界面中的 JSON 导出功能保存数据。

## 检查与测试

静态检查：

```bash
python tests/static_smoke.py
```

浏览器烟雾测试（需要安装 Playwright 和可用的 Chromium）：

```bash
python tests/browser_smoke.py
```

性能核验建议按 `roadmap.md` 第 9 节使用 Chrome DevTools 录制帧时间、滚动、菜单打开与语言切换。静态检查通过不等于真实设备性能已经达标；正式发布前还应覆盖 Windows Chrome/Edge、macOS Safari、iOS Safari、Android Chrome 与不同屏幕尺寸。

## 重要边界

1. 当前登录仅为本地调试适配器，允许调试账号 `1` / `1` 并在浏览器本地保存登录状态，不提供真实身份验证，不可用于公开部署；上线前必须接入服务端认证并清除这组演示凭据。
2. 实验数据不上传到服务器，浏览器本地存储不等于可靠备份。
3. 当前题目与证据内容只适合作为原型材料，不能因界面已重建就视为经过学术验证。
4. `standalone.html` 是便于演示的静态单文件副本；发布主站仍建议使用分文件版本，以便维护与懒加载。
5. 不包含 dala 原始站点的商业字体文件或大型克隆资源；未获得许可时使用系统字体栈。
6. The standalone HTML embeds the project’s own CSS/JS but still requires network access for the pinned Three.js module, Draco decoder and open-source brain GLB. It is not an offline package.
7. All 432 EasySci records currently have `lastVerifiedAt: null` and `verificationStatus: "needs-manual-confirmation"`. Their access labels are editorial starting points; verify each destination, tier and licence before relying on the catalogue commercially or in a research workflow.

## Visual revision — 2026-10-14

The latest design iteration replaces the beLieve robot icon with a yellow data-ocean scene. The grid and geometric nodes follow a fixed wave formula; white monospaced data labels receive an upward glow and light rays, move rightward along fixed paths with slight vertical bobbing, and fade during a 10-second cycle. Text movement is tuned to be slower than the wave phase speed. The 2D canvas is limited to approximately 30 fps and pauses outside the viewport; reduced-motion mode draws a static frame. To keep rendering predictable, the label content is data-driven from the `labelPairs` array in `assets/js/gl/engine.js` and uses the same rendering template.

The homepage brain has been redrawn as a horizontally oriented lateral-view silhouette with denser cortical folds and larger outlined triangle/diamond/square sprites. Mouse/touch movement and click shockwaves are available in both WebGL and 2D fallback rendering. Pointer repulsion is limited to a 0.28 model radius and click impulse range to 0.60. In the beLieve section, only the explicit **Enter / 进入** pill links to the experiment; the title and decorative wave area are not click targets. The data sea spans the full viewport; wave motion is slowed by 20%, white labels have a stronger upward glow, Chinese/English labels switch in place, and the saved-session actions share the same aligned button treatment.


## Frontend migration workflow

The migration introduces Vue 3 and Vite as the application entry/build layer while preserving the existing H5 environment in `legacy.html` during the transition. This is a compatibility migration; legacy feature controllers have not all been rewritten as Vue components yet.

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
npm test
npm run build
```

Create a dedicated branch for each feature or fix; do not commit directly to `master`. Keep frontend migration and test migration in separate branches and pull requests. Run Vitest and the Vite production build before review.
