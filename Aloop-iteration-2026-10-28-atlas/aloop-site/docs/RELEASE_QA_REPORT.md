# 发布前验收报告（RELEASE_QA_REPORT）

- 报告时间：2026-10-30（Asia/Shanghai）
- 分支：`feature/standalone-to-vue-integration`，起点 `origin/master` @ `3786e50`
- 环境：Windows / Node.js v24.13.0 / npm 11 / Vite 6.4.5 / Vitest 2.1.9 / Playwright 1.64.1（自带 Chromium 1248）
- 视口：桌面 1365×900，移动 390×844
- 服务：开发 `http://127.0.0.1:5173`，生产预览 `http://127.0.0.1:4175`（`vite preview` 指向 `dist`）

> 说明：本次执行环境没有可用的 GitHub / npm registry 网络，`node_modules` 与 Playwright 浏览器为本地既有安装；因此未执行 `npm ci` 或重新安装依赖。

## 1. 自动化命令与结果

| 命令 | 结果 | 数量 | 备注 |
|---|---|---|---|
| `npm test` | ✅ 通过 | 6 个文件 / 47 项 | jsdom 环境；含 `src/App.test.js`、`tests/entry-contract.test.js` |
| `npm run build` | ✅ 通过 | 10 modules transformed | `dist/index.html` 0.58 kB、CSS 2.66 kB、JS 70.41 kB；旧运行时与模型由插件复制 |
| `npm run test:e2e` | ✅ 通过 | 8 / 8（10.9 s） | Chromium，开发服务器；每个用例断言 `console.error` 与 `pageerror` 为空 |
| 构建期产物校验 | ✅ 生效 | — | 临时移走 `manifest.json` 后构建按预期失败：`Production build is missing required files: assets/models/atlas/manifest.json`，随后已恢复 |

### 1.1 Vitest 明细（47 项）

| 文件 | 项数 | 覆盖 |
|---|---|---|
| `src/App.test.js` | 15 | iframe 挂载、导航、实验菜单、深层链接、语言持久化、About embed、P0 兼容断言 |
| `tests/entry-contract.test.js` | 17 | 单一入口、dev/构建契约、产物清单、静态资源路径、Atlas 资源、双语 About、文档存在性、旧运行时模块图 |
| `tests/project-regression.test.js` | 6 | 旧样式/脚本可解析、脚本顺序、EasySci 完整性、分离层次 |
| `tests/atlas_store.test.js` | 5 | Atlas store 状态机 |
| `tests/model-assets.test.js` | 3 | GLB/manifest/Draco/署名、禁用退役 CDN |
| `tests/i18n.test.js` | 1 | 双语字典完整性 |

### 1.2 Playwright 明细（8 项）

1. 说明页路由在 Vite dev 下可解析。
2. beLieve 受保护路由弹出登录，本地调试账号 `1/1` 可进入运行态。
3. 直接深层链接 `#/smart-brain/atlas` 与浏览器后退保持同步。
4. 首页渲染采样自 `brain.glb` 的皮层粒子（`data-source="cortex-glb"`、`is-ready`），旧顶栏在嵌入模式隐藏，无控制台错误。
5. EasySci 首屏列出目录，搜索 `zotero` 后结果收敛且包含 `Zotero`。
6. Smart Brain Atlas 挂载真实 WebGL 上下文（画布 838×674，`webgl2`/`webgl` 可用，图层计数可见）。
7. 说明页嵌入后无双顶栏，中英标题切换正确，可返回外壳首页。
8. `/standalone.html` 在 dev 返回 200 且带 `X-Robots-Tag: noindex`，外壳不链接该文件。

## 2. 生产预览人工/脚本验收

`vite preview`（端口 4175）+ Playwright 场景结果：

| 检查项目 | 通过标准 | 实测 | 结论 |
|---|---|---|---|
| 首页 | 正常加载 | HTTP 200，标题 `Aloop — Online Research Experiments`，`#particleCortexStage` 达到 `cortex-glb` / `is-ready`，画布可见 | ✅ |
| 导航 | 所有核心入口可用 | 首页 `#/`、EasySci `#/easysci`、Smart Brain `#/smart-brain`、说明 `#/about` 全部跳转正确 | ✅ |
| EasySci | 分类与核心交互正常 | 首屏 50 张卡片；搜索 `zotero` 后 3 张 | ✅ |
| Smart Brain | 模型可加载和交互 | Atlas 画布 838×674，WebGL 可用，图层计数（大脑皮层 128 等）渲染 | ✅（headless GPU） |
| beLieve | 实验入口和运行流程正常 | 未登录弹出登录；`1/1` 登录后进入实验壳，URL `#/e/believe/run` | ✅ |
| 双语 | 文本切换正常 | 外壳切 EN 后 iframe `lang="en"`、`localStorage.aloop_lang_v1=en`；刷新后仍为英文；切回中文正常 | ✅ |
| 说明页 | 独立入口、无双导航 | `.about-top` 隐藏；中文标题「说明」；英文「About」；返回首页 `#/` | ✅ |
| 深层链接 | 直接访问不报错 | `/ #/smart-brain/atlas` 直接打开：hash、iframe src、导航高亮一致 | ✅ |
| 刷新 | 页面状态与路由正常 | 刷新后 hash 保持 `#/smart-brain/atlas`，Atlas 画布重新挂载 | ✅ |
| 后退 | 历史与外壳同步 | Atlas → EasySci → 后退，hash 回到 `#/smart-brain/atlas` | ✅ |
| 移动端 | 布局无严重错位 | 390×844：首页与 Atlas 均无横向溢出（`scrollWidth <= innerWidth`） | ✅（仅视口模拟） |
| 资源加载 | 无关键资源 404 | `brain.glb` 4,650,816 B `model/gltf-binary`；`manifest.json` 232,455 B `application/json`；`draco_decoder.wasm` 285,948 B `application/wasm`；`router.js`、`runtime.js` 均 200 | ✅ |
| MIME | 类型正确 | glb / json / wasm / js / html 均符合预期 | ✅ |
| 控制台 | 无未处理的关键错误 | 全部场景 `console.error`、`pageerror`、`requestfailed` 均为空（仅有 WebGL 驱动的性能 warning） | ✅ |

### 2.1 构建产物

```text
dist/
├── index.html                576 B   （唯一入口，引用 /assets/index-*.js|css）
├── legacy.html            12,891 B
├── 说明.html              11,887 B
├── assets/                          （CSS / i18n / JS / img / models/atlas + draco）
├── experiments/believe/             （manifest.js / runtime.js / believe.css）
└── standalone.html                  不存在（构建插件强制）
```

## 3. Cloudflare 部署链路核查（2026-10-30 追加）

通过 GitHub check runs 与 PR 上的 Cloudflare 机器人评论核对（`App: cloudflare-workers-and-pages`，check 名称 `Workers Builds: aloop`）：

| 提交 | 角色 | 结论 | Version ID |
|---|---|---|---|
| `883c4d0` | `master` | ✅ success | 有 |
| `3786e50` | `master` | ✅ success | `e1a83cd0-f1c7-46d5-906a-22a451f881c9` |
| `9d73349` | 功能分支 | ❌ **failure** | 无 |
| `a461050` | 功能分支 | ❌ **failure** | 无 |

结论：

1. 线上是 **Cloudflare Workers 静态资源**（不是 Pages）；`master` 推送会自动构建并生成新 Version，即生产分支与仓库同步。
2. **非生产分支的预览构建目前失败**（两次，均无 Version ID）。构建日志需在 dashboard 查看（build `12b3a0d1-cf53-4991-91a6-35a6cbd2879a`、`277b05c9-ce3b-4a25-bd25-0c900d37b16d`），本地无 Cloudflare API token，未取得日志文本。
3. 由于预览构建不可用，PR 合并前无法用 Cloudflare 预览地址验收；当前以本地 `npm run build` + `vite preview` 与 GitHub Actions 为准。
4. 生产构建若失败，线上继续运行上一个成功 Version，不会白屏；可用 dashboard 回滚或 `git revert` 后重新推送。

**本次相关改动**：`wrangler` 由未声明改为 `devDependencies` 中的精确版本 `4.80.0`（要求 Node ≥ 20.3），使构建与部署使用同一 CLI，减少构建环境差异；`package-lock.json` 已同步，未改变任何既有依赖版本。

## 4. 验收中发现并已修复的问题

| # | 问题 | 证据 | 修复 |
|---|---|---|---|
| 1 | dev 依赖扫描尝试解析 import map 中的 `three` | dev 日志：`three (imported by assets/js/gl/particle-cortex.js) could not be resolved` | `optimizeDeps.entries: ['index.html']` |
| 2 | `/standalone.html` 在 dev 下不可访问 | 请求落入 Vite HTML 转换 | 中间件白名单 + `noindex` 响应头 |
| 3 | 刷新后语言被强制改回中文 | iframe `load` 无条件点击「中」 | 读写 `aloop_lang_v1`，仅在语言不一致时同步 |
| 4 | iframe 首屏重复加载 | `net::ERR_ABORTED` on `/legacy.html?embed=1` | 改为 `frameSrc` 响应式绑定，单次加载 |
| 5 | 说明页在外壳内出现双顶栏 | 截图：Vue 顶栏 + 页面自带固定顶栏 | `?embed=1` + `html.vue-embedded` 隐藏自身顶栏 |
| 6 | 说明页仅中文 | 页面无语言开关 | `?lang=` + 双语内容 + 语言按钮 + 共享存储键 |
| 7 | 构建无产物契约 | 缺少资源时仍构建成功 | `verify-production-output` 插件（正向与反向均验证） |

## 5. 未覆盖 / 未完成的风险

| 风险 | 严重度 | 说明 | 建议 |
|---|---|---|---|
| 真机 GPU 渲染 | 中 | 自动化只能证明 WebGL 上下文可用与 headless 渲染；未在真实 GPU、Safari/iOS、Android 上验收 | 发布前在目标设备人工确认首页粒子与 Atlas 帧率 |
| 移动端真机布局 | 中 | 仅 390×844 视口模拟，无真机触控/安全区验证 | 人工真机走查 |
| 外部 CDN 不可用 | 中 | Three.js 通过 import map 从 jsDelivr 加载 `0.186.1`；断网时首页保留海报图并提示失败，Atlas 显示 `atlas.modelFail` | 在弱网/断网下人工确认提示与恢复路径 |
| SPA fallback 掩盖 404 | 中 | 预览与 Cloudflare `single-page-application` 会对不存在的资源返回 `index.html`（实测 `/assets/models/atlas/does-not-exist.glb` 与 `/standalone.html` 均 200 + HTML 576 B） | 建议部署负责人评估把 `wrangler.jsonc` 改为 `not_found_handling: "404-page"`（当前路由全为 hash，不需要 SPA fallback） |
| 分支预览构建失败 | 中高 | Cloudflare `Workers Builds: aloop` 对 `9d73349`、`a461050` 均为 failure 且无 Version ID；`master` 的 `883c4d0`、`3786e50` 为 success | 打开 dashboard 构建日志定位（root dir / 预览分支设置 / wrangler 可用性），修复前合并只能依赖本地与 GitHub Actions |
| Cloudflare 构建设置未核对 | 中 | Root directory、Build/Deploy command、Node 版本、环境变量都只能在控制台确认，本次未取得 | 部署负责人核对一次；`wrangler` 已固定为 `4.80.0`（Node ≥ 20.3） |
| 首页粒子视觉与 standalone 不一致 | 低 | 生产为 `uSize×1.2`（颗粒极细），standalone 为 `uSize×10.2`（明显的三角面脑），桌面观感差异明显；10.2 在 390px 视口会与「Aloop」字标重叠 | 保持 1.2（不改动既有视觉）；是否放大需设计负责人决定 |
| 首页就绪提示常驻 | 低 | `粒子模型已就绪。` 文本渲染在署名下，standalone 同样存在 | 属既有行为，未改动 |
| `brain-surface.js` 未接线 | 低 | 无文档引用，测试只校验路径 | 文档标注；后续决定删除或接线 |
| iframe 双套导航 DOM | 低 | 旧顶栏仍随 `legacy.html` 加载，仅被 CSS 隐藏 | 深层重构需独立计划 |
| Supabase 配置 | 中 | `src/lib/supabase.js` 未被任何入口 import；Cloudflare 是否配置 `VITE_SUPABASE_*` 未验证 | 由部署负责人在控制台确认；不要提交 secret/service_role |
| 本地调试账号 | 高（上线前） | `1/1` 可进入实验 | 正式招募前必须移除并接入真实认证 |

## 6. 复现方式

```bash
cd Aloop-iteration-2026-10-28-atlas/aloop-site
npm test
npm run build
npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4175
```

预览打开后按第 2 节表格逐项检查；`/standalone.html` 仅用于与历史单文件版本对照，不应作为生产入口。
