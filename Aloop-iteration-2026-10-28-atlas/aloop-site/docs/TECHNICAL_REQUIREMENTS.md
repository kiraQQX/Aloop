# Aloop 技术规范（统一入口版）

本文档取代此前分散在 `TECHNICAL_SPECIFICATIONS.md` 中的入口与构建说明；该文件仍保留历史设计与内容规范，两者冲突时以本文档与 `vite.config.js` 实际代码为准。

## 1. 架构总览

```text
浏览器
  └─ index.html                      唯一生产入口（Vite 入口，仅挂载 #app）
       └─ src/main.js                createApp(App)
            └─ src/App.vue           Vue 外壳：顶栏 / 语言 / hash 路由 / iframe 容器
                 └─ <iframe src="./legacy.html?embed=1#/<route>">
                      └─ legacy.html   模块化 H5 运行环境（26 script + 11 CSS，import map 加载 Three.js）
                           ├─ assets/js/core/*        路由、存储、认证、音频、性能
                           ├─ assets/js/ui/*          顶栏、菜单、登录弹窗、区块
                           ├─ assets/js/easysci/*     EasySci 目录（432 条）
                           ├─ assets/js/smartbrain/*  概览、学习、语音、Atlas
                           ├─ assets/js/gl/*          首页粒子脑、引擎
                           └─ experiments/believe/*   beLieve 运行时
                 └─ <iframe src="./说明.html?embed=1&lang=zh|en">  （#/about）
```

设计约束：

1. **只有一个生产入口。** `index.html` 是 Vite 的唯一 HTML 入口；`legacy.html`、`说明.html`、`standalone.html` 都不得包含 `/src/main.js`，也不得成为构建入口。
2. **Vue 只负责外壳。** 导航、语言、顶层 hash 路由、iframe 生命周期由 Vue 管理；业务模块继续使用既有原生 JS，不强制改写为 Vue 组件。
3. **旧运行时保持经典脚本语义。** `legacy.html` 依赖 import map 与 `defer` 脚本顺序，开发服务器必须原样直出，不能经过 Vite 的 HTML 转换。
4. **standalone.html 只是参考。** 它不出现在 `dist`，不被路由引用，dev 下以 `X-Robots-Tag: noindex` 提供。

## 2. 入口与路由契约

| 路由 | 外壳行为 | iframe 目标 |
|---|---|---|
| `#/` | 首页高亮 | `./legacy.html?embed=1#/` |
| `#/e/<id>` | 「实验」高亮 | `./legacy.html?embed=1#/e/<id>` |
| `#/e/<id>/run` | 「实验」高亮，保留完整 hash | `./legacy.html?embed=1#/e/<id>/run` |
| `#/easysci`、`#/easysci/<slug>` | `EasySci` 高亮 | `./legacy.html?embed=1#/easysci...` |
| `#/smart-brain`、`/learn`、`/atlas`、`/atlas/<id>` | `Smart Brain` 高亮 | `./legacy.html?embed=1#/smart-brain...` |
| `#/about` | `说明` 高亮 | `./说明.html?embed=1&lang=<zh|en>` |
| 其他 hash | 回退到首页状态 | `./legacy.html?embed=1#/` |

要求：

- 直接访问任一深层链接必须渲染对应状态，刷新后保持。
- 浏览器前进/后退必须让外壳高亮与 iframe 目标同步。
- iframe 内部 hash 变化通过 `hashchange` 监听回写外层 URL。
- 若访问 `#/e/<id>/run` 且未登录，旧路由会把 hash 降级为 `#/e/<id>` 并弹出登录框；这是既有产品行为，不是缺陷。

## 3. 语言契约

- 共享存储键：`aloop_lang_v1`，取值只能是 `zh` 或 `en`。
- 默认语言：`zh`（站点以 `lang="zh-CN"` 发布）。旧 i18n 在没有存储值时会跟随浏览器语言；外壳在 iframe 加载后按需点击旧语言控件，使两侧收敛到外壳状态。
- 外壳不得在每次加载时无条件重置语言；只在文档语言与外壳状态不一致时同步。
- About 页面通过 `?lang=` 接收语言，并用同一存储键记录切换。

## 4. 依赖与版本

| 依赖 | 版本 / 位置 | 说明 |
|---|---|---|
| Vue | `^3.5.13`（`package.json`） | 外壳运行时 |
| Vite | `^6.0.7`（实际解析 6.4.5） | 构建与 dev server |
| `@vitejs/plugin-vue` | `^5.2.1` | SFC 支持 |
| Vitest / jsdom | `^2.1.8` / `^25.0.1` | 单元测试（jsdom 环境） |
| Playwright | `1.64.1` | Chromium 端到端验收 |
| `wrangler` | `4.80.0`（精确版本，devDependency） | Cloudflare 构建/部署 CLI；要求 Node ≥ 20.3，保证构建环境与本地使用同一版本 |
| `@supabase/supabase-js` | `^2.118.0` | 仅安装，`src/lib/supabase.js` 未接线 |
| Three.js | `0.186.1`（import map，jsDelivr CDN） | 不写入 `package.json`；升级必须单独验证 GLTF/Draco 兼容性 |
| Draco | 自托管 `assets/models/atlas/draco/` | `draco_decoder.js`、`.wasm`、`draco_wasm_wrapper.js` |
| 脑模型 | `assets/models/atlas/brain.glb`、`manifest.json`、`ATTRIBUTION.md` | CC BY-SA 4.0，见 ATTRIBUTION |

禁止事项：

- 不得在 dev 让 Vite 预构建扫描旧文档（会尝试解析 `three` 并失败）。`optimizeDeps` 必须保留 `entries: ['index.html']`。
- 不得引入第二个 Three.js 版本或第二个 `WebGLRenderer` 生命周期管理体系。
- 不得把 `raw.githubusercontent.com` / `gstatic.com/draco` 重新写回模型与解码器路径。

## 5. 构建与产物契约

构建命令：`npm run build`（`vite build`），产物目录 `dist`。

`copyLegacyRuntime` 复制：`legacy.html`、`assets/**`、`experiments/**`、`说明.html`。
`verifyProductionOutput` 在 `closeBundle` 校验：

必需文件（缺一即构建失败）：

```text
index.html
legacy.html
说明.html
assets/js/core/router.js
assets/js/core/env.js
assets/i18n/site.js
assets/js/easysci/data.js
assets/js/smartbrain/atlas/scene.js
assets/models/atlas/brain.glb
assets/models/atlas/manifest.json
assets/models/atlas/draco/draco_decoder.wasm
experiments/believe/runtime.js
experiments/believe/believe.css
```

禁止文件：

```text
standalone.html   # 第二个生产首页
```

资源路径要求：

- 旧文档内一律使用相对路径（`assets/...`、`experiments/...`、`./说明.html`），不得使用以 `/` 开头的绝对路径。
- 模型与 Draco 通过 `new URL(..., document.baseURI)` 解析，保持相对文档定位。
- 新增静态目录时同步更新中间件白名单与产物契约。

## 6. 开发服务器行为

`serveLegacyRuntime`（`apply: 'serve'`）对以下路径直接读文件并返回，附正确 MIME、`Cache-Control: no-cache`：

- `/legacy.html`、`/说明.html`
- `/standalone.html`（附加 `X-Robots-Tag: noindex, nofollow`）
- `/assets/**`、`/experiments/**`

其余请求交给 Vite。这样可保证旧 import map、`defer` 顺序与相对路径行为与生产一致。

## 7. Supabase 认证与数据（已接入）

完整设计见 `docs/SUPABASE_INTEGRATION.md`。

- 客户端：`src/lib/supabase.js` 单例，读取 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`；缺失或 URL 非法时**不抛错**，而是导出 `supabaseConfigError` 由 UI 展示；检测到 `service_role` / `sb_secret_` 直接拒绝。
- 认证：`src/lib/auth.js` 负责会话恢复（`getSession`）、登录（`signInWithPassword`）、注册（`signUp`，含邮箱确认分支）、退出与 `onAuthStateChange` 订阅；`initAuth` 幂等，不会重复订阅。
- 旧运行时：`assets/js/core/auth.js` 在嵌入模式下调用外壳的 `window.__ALOOP_AUTH__`；无外壳（`standalone.html` 或直接打开 `legacy.html`）时保留 `1/1` 本地调试适配器。`Aloop.authReady` 让旧路由在会话恢复后再渲染。
- 数据：`src/lib/data.js` 封装 `profiles`、`experiment_sessions`、`experiment_events`；未配置时返回 `not_configured`，不伪造数据。
- 数据库：`supabase/migrations/20261031090000_init_profiles_and_sessions.sql`，三张表全部启用 RLS，策略限定 `auth.uid()`。
- 边界：beLieve 运行时仍写 localStorage，实验数据上传**未接入**；密码重置/邮箱变更入口**未接入**（现有 UI 无入口）。
- 真实注册/登录尚未在线上验证（仓库无 Supabase 项目凭据）；测试为 mock SDK 单元测试 + 本地调试适配器 e2e。
- 不得把 `service_role` / secret key 写入前端或仓库。

## 8. 部署（Cloudflare Workers + 静态资源）

线上不是 Pages 项目，而是 **Cloudflare Workers 静态资源**（Worker 名 `aloop`），由 **Workers Builds** 跟踪 GitHub 仓库。`wrangler.jsonc` 的 `assets.directory = ./dist`、`not_found_handling = single-page-application`。

| 项 | 值 |
|---|---|
| 服务类型 | Worker（静态资源模式） |
| 生产分支 | `master`（GitHub 默认分支） |
| Root directory | `Aloop-iteration-2026-10-28-atlas/aloop-site` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy`（`wrangler` 固定为 `devDependencies` 的 `4.80.0`，要求 Node ≥ 20.3） |
| 环境变量 | `VITE_SUPABASE_*`（仅在 import `src/lib/supabase.js` 后需要） |

行为与已验证事实（2026-10-30）：

- `master` 推送 → Workers Builds 构建成功并生成 Version（`883c4d0`、`3786e50` 均有 Version ID），即 **生产分支的推送会自动上线**。
- 非生产分支 / PR → 预览构建目前**失败**（`9d73349`、`a461050` 的 `Workers Builds: aloop` 结论为 failure，且无 Version ID）。失败原因需在 dashboard 构建日志确认；在修复前，分支无法提供 Cloudflare 预览地址，合并前验证以本地 `npm run build` + `npm run preview` 和 GitHub Actions 为准。
- 生产构建失败时，线上继续运行上一个成功版本，不会白屏。

**风险**：SPA fallback 会把缺失的静态资源请求也返回 `index.html`（HTTP 200），从而掩盖资源 404。当前路由全部是 hash 路由，理论上不需要 SPA fallback；如需改为 `404-page`，必须先经部署负责人确认，因为这会改变所有未知路径的行为。

## 9. 分支与发布纪律

1. 生产分支 `master` 只接受 PR。
2. 功能分支命名 `feature/*`、`fix/*`、`integration/*`。
3. 合并前必须通过：`npm test`、`npm run build`、`npm run test:e2e`。
4. PR 必须列出人工验收项与回滚方式。
5. 未经确认不得合并 PR、删除历史分支或修改生产部署配置。

## 10. 验收环境

- Node.js 20.3+（`wrangler 4.80.0` 的最低要求；本次验收使用 Node 24.13.0，CI 使用 Node 20）。
- Chromium（Playwright 1.64.1 自带构建）。
- 桌面 1365×900、移动 390×844。
- 真实 WebGL：headless Chromium（SwiftShader）可创建上下文；仍需在目标设备上人工确认 GPU 渲染与移动端布局。
