# Aloop — 在线研究实验入口

Aloop 是一个在线研究实验与工具平台。当前采用 **Vue 3 + Vite** 作为站点入口层，保留原有 H5 业务环境作为 `legacy.html`，由 Vue 外壳通过 iframe 承载。**`index.html` 是唯一生产入口**；`standalone.html` 只是历史单文件对照副本，不参与生产构建与路由。EasySci、Smart Brain、beLieve 的主体业务逻辑仍运行在旧版 JavaScript 环境中，并非已经全部重写为 Vue 组件。

> **研究与数据状态：原型阶段。** beLieve 的题目与证据文案承接自上一版 `lateral-reading-lab` 项目，仍需研究者/领域专家审核。网站未接入真实服务器端账号、数据存储、分组随机化或备份机制。会话数据只保存在参与者当前浏览器的本地存储中。请勿将当前版本直接用于正式招募或验证性数据收集；正式部署前还需完成伦理审批、知情同意审查、预注册、题库审核、数据保护与服务器端随机化。

## 本地运行

主站入口是 Vue/Vite 外壳。不要直接双击 `index.html`；开发和验收应通过 Vite 的 HTTP 服务访问。要求 Node.js 20.3 或更新版本（`wrangler 4.80.0` 的最低要求；CI 使用 Node 20，本地验收使用 24）。

从仓库根目录执行：

```bash
cd Aloop-iteration-2026-10-28-atlas/aloop-site
npm install
npm run dev
```

打开终端输出的本地地址，默认是 `http://localhost:5173`。Vue 外壳负责主导航、语言控件和顶层路由状态；`legacy.html?embed=1` 继续承载旧版实验、EasySci、Smart Brain 等功能，说明页以 `说明.html?embed=1&lang=<zh|en>` 嵌入。

`http://localhost:5173/standalone.html` 仅用于与历史单文件版本做功能/视觉对照，带 `X-Robots-Tag: noindex`，不会进入构建产物，也不被任何路由链接。

## 当前功能

- 深蓝全屏首页，以抽象地形纹理与真实的三维脑皮层表面网格为视觉主体，并提供滚动式实验入口。
- 固定深蓝半透明导航栏；实验快速选择菜单、登录/注册交互模型、中文/英文原位切换。
- beLieve 入口与实验运行时分离；进入后首先展示知情同意页面。
- 基于公开 GLB 解剖网格的可交互 3D 脑皮层：支持拖动旋转、缩放、点击区域高亮、键盘旋转、重置视角和可选自动旋转；模型、清单与 Draco 解码器随站点自托管于 `assets/models/atlas/`，模型缺失时显示错误状态及原始开源查看器链接。模型网格与查看器代码采用不同许可，具体见技术规范。
- Web Audio 合成的轻提示音和玻璃滑动声；本轮视觉与身份修改未改动音频模块，声音状态仍保存在本地，并在实验运行期间静音。
- beLieve 要求登录后进入。当前预留本地调试账号：邮箱/用户名 `1`，密码 `1`；登录状态保存在当前浏览器中，尚不属于真实账号系统。
- beLieve 保留训练、测试、反馈、结果说明和 JSON 导出流程；导出数据包含 `site`、`experiment_id` 和 `app_version` 元数据。
- 从部分旧 `llab_*` 本地键迁移语言与未完成会话，便于原型测试时续接此前进度。
- A/B/C 条件选择不作为公开首页内容；仅通过 `?qa=1&arm=A|B|C` 供开发质检使用。该客户端分组不是正式研究随机化。

## 目录结构

```text
aloop-site/
├── index.html                  # 唯一生产入口（Vue/Vite）
├── src/
│   ├── main.js                 # 创建 Vue 应用
│   ├── App.vue                 # 导航、顶层路由、iframe、语言同步
│   ├── App.test.js             # Vue 外壳、路由、语言与 About 回归测试
│   └── lib/supabase.js         # 未接线的 Supabase 客户端草稿（见下文）
├── legacy.html                 # 旧版 H5 运行环境入口（iframe 承载）
├── 说明.html                   # 说明/许可页面（?embed=1&lang=zh|en）
├── standalone.html             # 历史单文件对照副本（仅 dev，参考用）
├── assets/
│   ├── css/                    # 旧版样式与嵌入模式样式
│   ├── i18n/site.js            # 中英文文案
│   ├── js/                     # 路由、认证、EasySci、Smart Brain 与图形模块
│   └── models/atlas/           # 自托管 brain.glb、manifest、Draco、ATTRIBUTION
├── experiments/believe/        # beLieve 实验清单、样式与运行时
├── tests/
│   ├── entry-contract.test.js  # 单一入口、构建契约、资源路径、双语 About
│   ├── atlas_store.test.js
│   ├── i18n.test.js
│   ├── project-regression.test.js
│   ├── model-assets.test.js
│   └── e2e/vue-shell.e2e.js    # Chromium 浏览器验收（8 项）
├── docs/
│   ├── MIGRATION_AUDIT.md          # 迁移前审计
│   ├── FEATURE_MIGRATION_MATRIX.md # 功能迁移矩阵
│   ├── TECHNICAL_REQUIREMENTS.md   # 统一后的架构与验收要求
│   ├── ENGINEERING_PROGRESS.md     # 工程进度与风险登记
│   └── RELEASE_QA_REPORT.md        # 发布前验收结果
├── playwright.config.js
├── vite.config.js              # Vite 配置、旧运行时兼容层、构建产物契约
├── wrangler.jsonc              # Cloudflare Workers（静态资源 + SPA fallback）
├── package.json                # 含固定版本 wrangler，保证构建与部署使用同一 CLI
└── README.md
```

### 入口与构建契约

1. `index.html` 挂载 `/src/main.js`，是 Vite 唯一 HTML 入口。
2. `legacy.html`、`说明.html`、`standalone.html` 都是经典 H5 文档，dev 下由 Vite 中间件原样直出，不经过 HTML 转换。
3. `vite build` 后由插件复制 `legacy.html`、`说明.html`、`assets/**`、`experiments/**` 到 `dist/`。
4. 构建结束会校验 13 个必需产物；缺失即失败，且禁止 `dist/standalone.html` 出现。
5. 语言状态通过共享键 `aloop_lang_v1` 在外壳与 iframe 之间同步，刷新后保持。


## Products and EasySci resource directory

The top navigation now exposes two sibling menus: **Experiments** and **Products**. Products contains **EasySci**, available directly at `#/easysci`; each tool also has a stable detail route at `#/easysci/<tool-id>`.

EasySci is a bilingual, editorially curated tool directory. Its primary capability taxonomy is **Skill / MCP**; users can further narrow results by task domain (literature/research, data analysis, experiments, design, creative work, and coding) and access model. Agent plugin packages or bundles appear in both Skill and MCP filters when they contain both capabilities. Legacy web tools remain visible under **All resources**, so the existing design, experiment, and research directory is preserved.

As of 2026-10-22, the directory contains **432 unique records** across eight task domains: research (52), data (50), experiment (57), design (55), image (50), assets (68), creative (50), and coding (50). Each category meets the minimum of 50 resources. The directory keeps its Skill / MCP / Agent Plugin capability facets alongside category and access-model filters; capability counts are intentionally overlapping for bundles. All catalogue results are searchable and sortable, while the initial view progressively renders 50 cards at a time to avoid placing all 432 entries in the DOM at once.

The expanded catalogue incorporates the supplied asset, design and experiment lists, the retained 148-entry directory, and an additional curated set across research, data, image editing, creative work and coding. Research sources and model/asset licences are recorded in `TECHNICAL_SPECIFICATIONS.md` and `docs/EASYSCI_CATALOGUE_RESEARCH.md`. Popularity is treated as a time-sensitive signal rather than proof of quality; this is a curated practical directory, not a definitive global ranking.

Access-model labels distinguish **Free**, **Freemium**, **Paid**, and **Open Source**. Open-source tools can have separate hosted-service, API, storage, and quota terms. Some packages use different installation or manifest conventions across Codex, Claude Code, Cursor, and other clients; the directory does not imply that a single plugin package is universally portable.

**Verification note:** every resource currently uses `lastVerifiedAt: null` unless individually updated after human verification. The records include source links and install guidance, but destination reachability, current package names, feature availability, pricing, account requirements, repository license, and each asset's reuse rights still require a final item-level check. Before formal research or commercial use, verify official docs and do not upload identifiable participant data to public tools without reviewing consent, institutional requirements, security, and data-processing terms. Review third-party Skills, MCP servers, and plugins like code dependencies: inspect permissions, file/network scope, scripts, authentication, and tool calls before enabling them.

The homepage brain is no longer the legacy schematic drawing. The shipping implementation is `assets/js/gl/particle-cortex.js`: it loads the open cortical-surface geometry from the `itayinbarr/brainproject` GLB, keeps meshes labelled `bx_cat=cortex`, samples their surface into instanced particle facets, and exposes pointer rotation, click diffusion, arrow-key rotation and drag/zoom gestures. Three.js is pinned to `0.186.1` through the import map; the source GLB, `manifest.json` and the Draco decoder are **self-hosted** under `assets/models/atlas/`, so the page no longer depends on `raw.githubusercontent.com` or `gstatic.com` (that host is reset in some regions, which previously made both the homepage and Smart Brain report a model load failure). If the local model is unavailable the page keeps the poster and reports a failure instead of fabricating a flat brain.

`assets/js/gl/brain-surface.js` (a mesh-surface viewer for `.brain-surface-canvas` stages) is still in the tree and covered by `tests/model-assets.test.js`, but **no shipping document mounts it**; it is not the current homepage renderer.

Smart Brain is a separate product module under `assets/js/smartbrain/`: `#/smart-brain` overview, `#/smart-brain/learn` lessons plus speech narration, and `#/smart-brain/atlas[/<id>]` for the anatomical atlas (`atlas/{assets,data,store,cards,scene,sidebar}.js`). It loads the same self-hosted GLB in its own scene and never shares homepage particle state or materials. The anatomy asset is licensed separately from the viewer code (CC BY-SA 4.0); checksums and attribution are in `assets/models/atlas/ATTRIBUTION.md`.

`standalone.html` is the historical single-file copy of the same assets. It is served in development only for comparison, is marked `noindex`, is never copied into `dist`, and must not be treated as the production homepage. See `docs/MIGRATION_AUDIT.md` for the section-by-section comparison and the remaining visual differences.

## 路由与 QA

- `#/`：首页顶部。
- `#/e/believe`：滚动到 beLieve 入口区块。
- `#/e/believe/run`：加载实验运行时并进入实验入口；未登录时会降级到 `#/e/believe` 并弹出登录框。
- `#/easysci`、`#/easysci/<slug>`：EasySci 目录与工具详情。
- `#/smart-brain`、`#/smart-brain/learn`、`#/smart-brain/atlas`、`#/smart-brain/atlas/<bx_id>`：Smart Brain 概览、学习与图谱。
- `#/about`：说明页，以外壳内嵌模式加载 `说明.html`。
- `?qa=1&arm=A`、`?qa=1&arm=B`、`?qa=1&arm=C`：仅用于本地开发质检。由于分组参数由客户端提供，不具备正式研究的随机化或防篡改属性。

语言选择保存在 `localStorage` 的 `aloop_lang_v1`，外壳、`legacy.html` 与说明页共享该键；刷新后保持。

清除当前浏览器对本地站点的存储，会同时清除该浏览器中保存的实验进度和事件日志。实验完成后建议使用界面中的 JSON 导出功能保存数据。

## 检查与测试

所有命令均在 `Aloop-iteration-2026-10-28-atlas/aloop-site` 目录中运行：

```bash
npm install
npm test
npm run build
npx playwright install chromium  # 首次运行浏览器测试时安装 Chromium
npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4175
```

`npm test` 使用 Vitest（6 个文件 / 47 项），覆盖入口唯一性、构建产物契约、路由、语言持久化、EasySci 数据、双语文案、模型资源与静态路径完整性；`npm run test:e2e` 使用 Playwright 启动真实 Chromium（8 项），覆盖 Vue 外壳、首页皮层粒子、EasySci 搜索、Smart Brain Atlas 的 WebGL 上下文、beLieve 本地调试登录、双语说明页、深层链接与浏览器后退。GitHub Actions 会运行单元测试、生产构建和 Chromium 浏览器验收。

`npm run build` 结束时会校验 13 个必需产物并拒绝 `dist/standalone.html`；缺少资源会让构建直接失败，而不是产出残缺站点。

这些自动化测试不等于完整的发布验收。Smart Brain 的 WebGL/GPU 表现、移动端真机布局、外部 CDN 或模型不可用时的恢复状态，仍应在目标浏览器与设备上单独检查；详细结果与未覆盖风险见 `docs/RELEASE_QA_REPORT.md`。

## 部署（Cloudflare Workers + 静态资源）

当前线上不是 Pages 项目，而是 **Cloudflare Workers 静态资源**（Worker 名 `aloop`，配置在 `wrangler.jsonc` 的 `assets` 段），由 **Workers Builds** 跟踪 GitHub 仓库。

| 配置项 | 值 |
|---|---|
| 服务类型 | Worker（`wrangler.jsonc` → `assets.directory = ./dist`） |
| 生产分支 | `master`（GitHub 默认分支） |
| Root directory | `Aloop-iteration-2026-10-28-atlas/aloop-site` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy`（`wrangler` 已固定为 `devDependencies` 中的 `4.80.0`） |
| Node | 20.3+（`wrangler 4.80.0` 的最低要求；本地使用 24，CI 使用 20） |
| 环境变量 | `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`（仅在真正 import `src/lib/supabase.js` 后才需要） |

行为：

- 推送到 `master` → 触发生产构建；成功后自动生成新的 Worker Version 并上线。构建失败时线上继续运行上一个成功版本。
- 推送到其他分支 / PR → 尝试生成预览构建；截至 2026-10-30，**分支预览构建失败**（`master` 构建成功），详见 `docs/RELEASE_QA_REPORT.md` 的 Cloudflare 一节。预览构建修好前，以本地 `npm run build` + `npm run preview` 和 GitHub Actions 作为合并前验证。

`dist/index.html` 是唯一入口；`dist/legacy.html`、`dist/说明.html` 与 `dist/assets/**` 由构建插件复制。合并到生产分支前必须完成本地生产预览与必要的人工验收。

## 重要边界

1. 当前登录仅为本地调试适配器，允许调试账号 `1` / `1` 并在浏览器本地保存登录状态，不提供真实身份验证，不可用于公开部署；上线前必须接入服务端认证并清除这组演示凭据。
2. 实验数据不上传到服务器，浏览器本地存储不等于可靠备份。
3. 当前题目与证据内容只适合作为原型材料，不能因界面已重建就视为经过学术验证。
4. `standalone.html` 仅是历史单文件对照副本：dev 下可访问、带 `noindex`，不进入 `dist`，不被任何路由链接。归档或删除需在验收后单独确认。
5. 不包含 dala 原始站点的商业字体文件或大型克隆资源；未获得许可时使用系统字体栈。
6. Three.js 仍通过 import map 从 jsDelivr 加载固定版本 `0.186.1`；模型与 Draco 解码器已自托管，但页面整体不是离线包。CDN 不可用时首页保留海报并提示失败，Smart Brain Atlas 显示模型加载失败状态。
7. All 432 EasySci records currently use `lastVerifiedAt: null` and `verificationStatus: "needs-manual-confirmation"`. Their access labels are editorial starting points; verify each destination, tier and licence before relying on the catalogue commercially or in a research workflow.
8. Supabase 尚未接线：`src/lib/supabase.js` 只有在被 import 时才读取 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`，缺失会抛错；当前没有任何入口 import 它。不得把 service_role 或 secret key 写入前端或仓库。
9. `wrangler.jsonc` 的 `not_found_handling: "single-page-application"` 会把缺失的静态资源请求返回 `index.html`（HTTP 200），从而掩盖 404。当前路由全部是 hash 路由，技术上不需要该 fallback；是否改为 `404-page` 需部署负责人确认。
10. 分支预览构建当前失败（`master` 成功）。合并前请以本地 `vite preview` + GitHub Actions 为准，并在 Cloudflare dashboard 查看分支构建日志确认原因。

## Visual revision — 2026-10-14

The latest design iteration replaces the beLieve robot icon with a yellow data-ocean scene. The grid and geometric nodes follow a fixed wave formula; white monospaced data labels receive an upward glow and light rays, move rightward along fixed paths with slight vertical bobbing, and fade during a 10-second cycle. Text movement is tuned to be slower than the wave phase speed. The 2D canvas is limited to approximately 30 fps and pauses outside the viewport; reduced-motion mode draws a static frame. To keep rendering predictable, the label content is data-driven from the `labelPairs` array in `assets/js/gl/engine.js` and uses the same rendering template.

The homepage brain has been redrawn as a horizontally oriented lateral-view silhouette with denser cortical folds and larger outlined triangle/diamond/square sprites. Mouse/touch movement and click shockwaves are available in both WebGL and 2D fallback rendering. Pointer repulsion is limited to a 0.28 model radius and click impulse range to 0.60. In the beLieve section, only the explicit **Enter / 进入** pill links to the experiment; the title and decorative wave area are not click targets. The data sea spans the full viewport; wave motion is slowed by 20%, white labels have a stronger upward glow, Chinese/English labels switch in place, and the saved-session actions share the same aligned button treatment.

> Superseded（2026-10-28）：the homepage no longer draws a procedural silhouette. It samples instanced particle facets from the self-hosted cortical GLB (`assets/js/gl/particle-cortex.js`); the silhouette description above is kept as design history. Facet scale is `TUNING.particlePixelScale` — `10.2` on desktop (matching the standalone reference) and `5.2` at `≤700px` so the model does not overlap the wordmark. The model credit and interaction hint were removed from the stage; attribution stays in `说明.html` and `assets/models/atlas/ATTRIBUTION.md`.

## Frontend migration workflow

Vue 3 + Vite is the application entry/build layer; the existing H5 environment stays in `legacy.html` behind an iframe. Reading order for contributors:

1. `docs/MIGRATION_AUDIT.md` — what the standalone snapshot contains and what was found missing.
2. `docs/FEATURE_MIGRATION_MATRIX.md` — where each feature lives and how it is verified.
3. `docs/TECHNICAL_REQUIREMENTS.md` — entry, routing, language, asset and build contracts.
4. `docs/RELEASE_QA_REPORT.md` — current verification status and open risks.

Requirements: Node.js 20.3 or newer (`wrangler 4.80.0`).

```bash
npm install
npm run dev
npm test
npm run build
```

Create a dedicated branch for each feature or fix; do not commit directly to `master`. Keep frontend migration and test migration in separate branches and pull requests. Run Vitest, the Vite production build and the Playwright suite before review.
