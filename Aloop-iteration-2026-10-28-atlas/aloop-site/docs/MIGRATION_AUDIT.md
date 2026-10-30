# Standalone → Vue/Vite 迁移审计（MIGRATION_AUDIT）

- 审计基线：`origin/master` @ `3786e500c516773fb284e89408fa9bb5e34a0299`（"fix: self-host brain model assets"）
- 审计对象：`Aloop-iteration-2026-10-28-atlas/aloop-site/` 下的 `standalone.html`、`legacy.html`、`index.html`、`src/`、`assets/`、`experiments/`、`vite.config.js`、`docs/`
- 审计方式：逐段解析 `standalone.html` 中的 `/* ===== <path> ===== */` 分区标记，与仓库中同名文件做「去空白后逐字符」比对；再在真实 Chromium（Playwright 1.64.1，1365×900 与 390×844 两种视口）中运行两套实现，对照 DOM 状态、控制台错误、网络响应与截图。
- 审计结论：`standalone.html` 是同仓库模块化资源的**单文件快照**，并非功能更新的版本；它缺少模块化版本已有的 Smart Brain Atlas 交互层与 40 个 `atlas.*` 文案键。因此迁移方向是「以 Vue/Vite 工程为唯一生产实现，向 standalone 借回可复用细节」，而不是把 standalone 内联内容复制进 `src/`。

## 1. 文件与入口现状

| 文件 | 规模 | 角色（审计时） | 问题 |
|---|---|---|---|
| `index.html` | 477 B / 14 行 | Vite 入口，挂载 `#app`，加载 `/src/main.js` | 唯一生产入口，但没有任何构建期约束阻止出现第二个入口 |
| `src/main.js` | 120 B | `createApp(App).mount('#app')` | 正常 |
| `src/App.vue` | 6,926 B | Vue 外壳：顶栏、语言、hash 路由、`legacy.html` iframe | 语言状态每次加载被强制写回 `zh`；About 页以非 embed 模式加载，出现双顶栏 |
| `legacy.html` | 12,891 B | 模块化 H5 运行环境（26 个 script + 11 个 CSS） | 只能通过 iframe 访问，不能直接作为生产入口 |
| `standalone.html` | 1,820,140 B / 4,479 行 | 单文件历史演示副本 | 开发服务器不提供该文件；Vite 会把它当 HTML 入口尝试转换 |
| `说明.html` | 4,796 B | 说明/许可页面 | 仅中文，无 embed 模式，嵌入后出现第二个顶栏 |
| `dist/` | 构建产物 | `dist/index.html` + `assets/` + `experiments/` | 无 `dist/standalone.html`（符合预期，但没有自动化验证） |

`vite.config.js` 中已有两个插件：`serveLegacyRuntime`（dev 下以静态方式提供 `legacy.html`、`说明.html`、`/assets/*`、`/experiments/*`，避免 Vite 处理 import map）和 `copyLegacyRuntime`（build 时复制旧运行时到 `dist/`）。**这两个插件是本次迁移的关键兼容层，不得移除。**

## 2. standalone 与模块化工程的逐段比对

解析 `standalone.html` 得到 33 个内联分区。结论按一致性分三类：

### 2.1 完全一致（去空白后逐字符相同）

`assets/css/tokens.css`、`base.css`、`topbar.css`、`home.css`、`easysci.css`、`responsive.css`、`experiments/believe/believe.css`、`theme-blue.css`、`assets/js/core/env.js`、`store.js`、`audio.js`、`auth.js`、`perf.js`、`assets/js/gl/engine.js`、`assets/js/ui/quickmenu.js`、`authmodal.js`、`topbar.js`、`sections.js`、`assets/js/registry.js`、`assets/js/easysci/data.js`、`easysci.js`、`assets/js/smartbrain/lessons.js`、`narration.js`、`assets/js/ui/transition.js`。

其中 EasySci 数据完全一致：两套实现都注册 **432** 条工具记录（`assets/js/easysci/data.js`，1,409,887 B，单行压缩数组）。

### 2.2 内容一致但打包形式不同

| 分区 | standalone | 模块化 | 影响 | 决策 |
|---|---|---|---|---|
| `assets/css/revision3.css` | 把 `assets/img/contours.svg`（61,091 B）内联为 base64 `data:` URI | `url("../img/contours.svg")` | 仅资源引用方式不同，渲染结果一致 | 保留模块化形式（可缓存、可替换、体积更小） |
| `assets/js/gl/particle-cortex.js` | 硬编码 `new URL("assets/models/atlas/brain.glb", document.baseURI)` | 同样自托管，但保留说明注释 | 功能等价 | 保留模块化形式 |
| `experiments/believe/manifest.js` | `load: () => Promise.resolve()`（同一文件内已内联 runtime） | `load: () => Aloop.loadScript("experiments/believe/runtime.js")` | 加载方式不同 | 保留模块化形式（懒加载、可缓存） |
| `experiments/believe/runtime.js` | 内联，去空白后 34,290 字符 | `experiments/believe/runtime.js`，去空白后 34,290 字符 | **完全相同** | 保留外置文件 |
| `assets/i18n/site.js` | 106 个文案键 | 146 个文案键 | 模块化版本多出 40 个 `atlas.*` 键 | 保留模块化版本 |

### 2.3 模块化版本更新（standalone 缺少的功能）

| 能力 | standalone | 模块化（legacy + assets） | 迁移决策 |
|---|---|---|---|
| Smart Brain Atlas 交互 | 只有 `model-viewer.js`：单画布 + 点击选择 + 重置 | `atlas/{assets,data,store,cards,scene,sidebar}.js` + `assets/css/atlas.css`：图层过滤、搜索、单侧隔离、不透明度、讲解、深层链接 `#/smart-brain/atlas/<id>` | **保留模块化 Atlas**，不迁入 model-viewer |
| Smart Brain 路由 | `parseRoute()` 只识别 `#/smart-brain` 与 `#/smart-brain/learn` | 额外识别 `#/smart-brain/atlas` 与 `#/smart-brain/atlas/<bx_id>` | 保留模块化路由 |
| Learn 页 CTA | 指向内部 `#sbModelStage`（旧查看器） | 指向 `#/smart-brain/atlas`，并新增 Atlas 标签页 | 保留模块化 |
| 嵌入模式样式 | 无 `vue-embed.css` | `assets/css/vue-embed.css` 在 `?embed=1` 时隐藏旧顶栏 | 保留 |
| 首页粒子尺寸 | `uSize × 10.2` | `uSize × 1.2`（注释「restrained ~2px particle facets」） | **保留 1.2**：真实浏览器中 1.2 能稳定渲染可见皮层粒子；standalone 的 10.2 在同等 GPU 环境下画面异常（见第 5 节），无法作为基准 |

> 两个数值在同一提交（`95f44d7`）中就已分叉，无法从历史判断哪个是「最新」。因此本审计以**运行结果**判定，而不是文件时间或体积。

## 3. 功能模块对照表

| 模块 | standalone 实现 | Vue/Vite 实现 | 差异 | 迁移决策 |
|---|---|---|---|---|
| 首页 | `standalone.html` L522–545 `<main id="home">` | `legacy.html` L100–123 + `assets/css/home.css` / `revision3.css` / `home.js` 等价模块 | 无结构差异；粒子尺寸常量不同 | 保留模块化；Vue 只负责外壳 |
| 全局导航 | `standalone.html` L453–493 自带深蓝顶栏 | Vue `src/App.vue` `.vue-topbar`；旧顶栏在 embed 模式隐藏 | 生产环境始终显示 **两套导航 DOM**（旧顶栏被 CSS 隐藏） | 统一由 Vue 渲染可见导航；旧顶栏仅在非 embed 的历史文档中保留 |
| 中英文切换 | `data-lang-set` → `assets/i18n/site.js`（106 键） | 同模块 + Vue `data-shell-language`，通过点击旧控件同步 | Vue 每次加载强制 `zh`，会覆盖已保存的 `en` | **已修复**：Vue 读写共享键 `aloop_lang_v1`，仅在两侧不一致时点击 |
| EasySci | 内联 `easysci.js` + 432 条数据 | `assets/js/easysci/{data,easysci}.js`（同一内容） | 无 | 复用现有实现，不重复迁移 |
| Smart Brain | `model-viewer.js`（旧单画布） | `assets/js/smartbrain/{learn,lessons,narration}.js` + `atlas/*`（6 个模块） | 模块化多出 Atlas 全交互 | 复用 Atlas；**不得**用首页粒子脑替代 |
| beLieve | 内联 runtime（34,290 字符） | `experiments/believe/{manifest,runtime}.js` + `believe.css` | 完全相同 | 保留外置运行时 |
| 登录弹窗 | `standalone.html` L495–520 + `authmodal.js` | `legacy.html` L73–98 + `authmodal.js` | 无 | 保留；仅本地调试账号 `1/1`，不是真实认证 |
| 说明页面 | 无（链接到 `说明.html`） | `说明.html`，由 Vue iframe 加载 | 仅有中文，且未嵌入模式 → 双顶栏 | **已修复**：新增 `?embed=1` 与中英双语 |
| 路由与深层链接 | `core/router.js`（无 atlas 子路由） | 同模块（含 `#/smart-brain/atlas/<id>`） | Vue 外壳只透传 4 类 hash | 保留模块化路由；Vue 统一透传 `#/e/*`、`#/easysci/*`、`#/smart-brain/*`、`#/about` |
| 3D 模型与粒子 | `particle-cortex.js` + `model-viewer.js` | `particle-cortex.js` + `atlas/*` + 未被引用的 `brain-surface.js` | `brain-surface.js`（16,618 B）没有任何 HTML 引用，是死代码 | 保留文件（资源测试引用其路径），在文档中标注为未挂载 |
| 静态资源 | 单文件内联 CSS/JS，SVG base64 | `assets/**` + `experiments/**` + `assets/models/atlas/**` | 模块化依赖目录复制 | 保留 `copyLegacyRuntime` 并在构建期校验 |

## 4. 依赖与模型资源

| 项目 | 现状 | 结论 |
|---|---|---|
| Three.js | `legacy.html` / `standalone.html` 使用 import map，固定 `three@0.186.1`（jsDelivr）；**不在 `package.json` 依赖中** | 保持不变（升级需单独验证）；dev 必须避免 Vite 扫描该 import map |
| Draco | 自托管 `assets/models/atlas/draco/`（`draco_decoder.js`、`.wasm`、`draco_wasm_wrapper.js`） | 保留；构建期校验存在性 |
| 脑模型 | `assets/models/atlas/brain.glb`（4,650,816 B）+ `manifest.json`（232,455 B）+ `ATTRIBUTION.md` | 保留；首页与 Atlas 各自加载、各自销毁，互不共享材质状态 |
| beLieve | `experiments/believe/{manifest,runtime}.js`、`believe.css` | 保留 |
| Supabase | `@supabase/supabase-js@^2.118.0` 已安装；`src/lib/supabase.js` 在模块顶层 `throw`，且**没有被任何文件 import** | 只视为「客户端模块草稿」，不是已接入的认证/存储 |

## 5. 真实浏览器对照结果（审计时）

在 `http://127.0.0.1:5173` 上分别打开 Vue 外壳（`/`）与 `standalone.html`：

| 观察项 | Vue 外壳 + legacy | standalone.html |
|---|---|---|
| 首页粒子 | `#particleCortexStage[data-source="cortex-glb"]`、`is-ready`，可见皮层粒子 | 同样进入 `cortex-glb` / `is-ready`，但同等 GPU 下画面远弱于模块化版本 |
| 顶栏 | 仅 Vue 顶栏可见，旧顶栏 `display:none` | 旧深蓝顶栏可见（含「登录 / 注册」「产品」菜单） |
| 控制台 | 无 error（仅 WebGL 驱动的性能 warning） | 无 error |
| EasySci | 首屏 50 张卡片，搜索 `zotero` 后 3 张 | 同左（数据相同） |
| Smart Brain | `/atlas` 渲染 838×674 WebGL 画布，图层计数 128/44/30 | 无 Atlas 页面，只有单模型查看器 |

## 6. 审计发现的真实缺陷（本次迁移修复）

1. **Vite dev 依赖扫描失败**：dev server 启动日志报 `three (imported by assets/js/gl/particle-cortex.js) could not be resolved`。原因：Vite 的依赖预构建扫描了 `legacy.html`，而 `three` 只存在于 import map。修复：`optimizeDeps.entries: ['index.html']`。
2. **standalone 在 dev 下不可访问**：中间件只放行 `/legacy.html`、`/说明.html`、`/assets/*`、`/experiments/*`；访问 `/standalone.html` 会落到 Vite 的 HTML 转换流程。修复：把 `standalone.html` 加入 dev 静态白名单，并加 `X-Robots-Tag: noindex, nofollow`。
3. **语言偏好被覆盖**：外壳 `language` 默认 `zh`，iframe `load` 后无条件点击「中」，把已保存的 `en` 改回 `zh`。修复：读写共享键 `aloop_lang_v1`，仅在文档语言与外壳不一致时点击。
4. **iframe 重复加载**：模板写死 `src="./legacy.html?embed=1"`，挂载后立即改写为带 hash 的 URL，产生一次 `net::ERR_ABORTED`。修复：改用 `frameSrc` 响应式绑定，只加载一次。
5. **说明页面双顶栏**：`#/about` 以普通文档加载 `说明.html`，旧页面自带固定顶栏，与外层 Vue 顶栏重复。修复：`?embed=1` + `html.vue-embedded` 隐藏自身顶栏。
6. **说明页面只有中文**：新增 `?lang=` 参数、双语内容块与语言按钮，并复用 `aloop_lang_v1`。
7. **构建没有产物契约**：构建成功但缺少某个资源时无人发现。修复：新增 `verify-production-output`，缺文件即失败，且禁止 `dist/standalone.html`。

## 7. 有意保留的历史资产

- `standalone.html`：保留为**功能对照与回滚参考**，dev 可访问、生产不产出、不参与路由。
- `legacy.html` + `assets/**` + `experiments/**`：当前生产运行环境，Vite 只做静态复制与 dev 直出。
- `assets/js/gl/brain-surface.js`：当前未被任何文档挂载，保留文件与测试引用，文档标注为「未接线」。
- `docs/`、`TECHNICAL_SPECIFICATIONS.md`、`IMPLEMENTATION_REPORT.md` 等既有文档：不删除，冲突处在本次文档中说明。

## 8. 未迁移 / 明确不做的事项

- 不把 `standalone.html` 的内联脚本复制进 `src/`，也不把历史 JS 改写为 Vue 组件。
- 不把 `model-viewer.js` 迁入生产：模块化 Atlas 是功能超集。
- 不升级 Three.js（保持 `0.186.1`），不把 CDN 依赖改为本地打包（需要单独评估体积与许可）。
- 不接入真实认证、数据库、RLS 或实验数据上传；`src/lib/supabase.js` 保持未接线状态。
- 不改动 Cloudflare Workers 的正式部署分支、构建命令或环境变量。

## 9. 每个模块的验证方法

| 模块 | 验证方式 | 位置 |
|---|---|---|
| 入口唯一性 / 产物契约 | Vitest 静态断言 + 构建期插件 | `tests/entry-contract.test.js`、`vite.config.js` |
| 外壳路由 / 语言 / About | Vitest（jsdom）+ Playwright | `src/App.test.js`、`tests/e2e/vue-shell.e2e.js` |
| 首页粒子 / 模型 | Playwright 断言 `data-source="cortex-glb"`、`is-ready`、画布可见 | `tests/e2e/vue-shell.e2e.js` |
| EasySci | Playwright：卡片数 > 0，搜索后收敛并含 `Zotero` | 同上 |
| Smart Brain Atlas | Playwright：`.atlas-canvas` 尺寸 + `getContext('webgl2'/'webgl')` + 图层文案 | 同上 |
| beLieve | Playwright：登录门槛 + 本地调试账号进入运行态 | 同上 |
| 说明页面 | Playwright：embed 隐藏顶栏、中英切换、返回首页 | 同上 |
| 静态资源 | Vitest 存在性/路径断言 + 构建插件 + `dist` 检查 | `tests/entry-contract.test.js`、`tests/model-assets.test.js` |
