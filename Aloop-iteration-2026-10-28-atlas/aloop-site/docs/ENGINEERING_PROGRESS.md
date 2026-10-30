# 工程进度（ENGINEERING_PROGRESS）

记录每次迁移、修复、测试与提交。时间均为 Asia/Shanghai（UTC+8）。状态区分：**已完成**、**已实现未验证**、**进行中**、**未开始**、**风险**。

## 2026-10-30 — 分支与基线核查（已完成）

| 项 | 结果 |
|---|---|
| GitHub 默认分支 | `master` |
| PR #6 | **已合并**：`merged_at 2026-10-29T04:23:36Z`，merge commit `3bbb302516dc247c22e030562fff1dd377d031c9`，head `64e1351`，base `95f44d7` |
| 本地/远程 master | `3786e500c516773fb284e89408fa9bb5e34a0299`（"fix: self-host brain model assets"），工作区干净 |
| 结论 | 适用「情况 B」：从最新生产分支创建迁移分支，PR 目标为 `master` |
| 迁移分支 | `feature/standalone-to-vue-integration`（起点 `3786e50`） |
| 远程访问 | 本机 shell 无法直连 GitHub（TLS/代理受限），仓库状态与 PR 状态通过 GitHub API 读取核对 |

## 2026-10-30 — 阶段一：审计（已完成）

- 解析 `standalone.html`（1,820,140 B / 4,479 行）的 33 个内联分区，与 `assets/**`、`experiments/**` 同名文件逐段比对。
- 结论：standalone 是同仓库资源的单文件快照，**缺少** Smart Brain Atlas 的 6 个模块与 40 个 `atlas.*` 文案键；EasySci 432 条数据、beLieve runtime（34,290 字符）与绝大多数模块完全一致。
- 产出：`docs/MIGRATION_AUDIT.md`、`docs/FEATURE_MIGRATION_MATRIX.md`。

## 2026-10-30 — 阶段二：统一入口与构建契约（已完成）

- `vite.config.js`
  - 新增 `optimizeDeps: { entries: ['index.html'] }`，消除 dev 下 `three ... could not be resolved` 的依赖扫描错误。
  - dev 静态白名单加入 `/standalone.html`，附 `X-Robots-Tag: noindex, nofollow`。
  - 新增 `verifyProductionOutput` 构建插件：13 个必需产物缺失即失败，`dist/standalone.html` 存在即失败。
- `src/App.vue`
  - `iframe` 改为 `frameSrc` 响应式绑定，消除首屏 `net::ERR_ABORTED` 重复加载。
  - 语言改为读共享键 `aloop_lang_v1`，仅在文档语言不一致时点击旧控件，修复刷新后被强制改回中文的问题。
  - About 路由改为 `./说明.html?embed=1&lang=<zh|en>`。
- `说明.html`
  - 支持 `?embed=1`（隐藏自身顶栏）与 `?lang=zh|en`；补充完整英文版本；修正过时的「仓库缺少模型与锁文件」表述。

## 2026-10-30 — 阶段三：回归测试（已完成）

- 新增 `tests/entry-contract.test.js`（17 项）：入口唯一性、dev/构建契约、静态资源路径、Atlas 资源、双语 About、旧运行时脚本/样式完整性。
- `src/App.test.js` 新增 5 项：语言恢复与持久化、About embed、语言切换更新 About、返回旧运行时。
- `tests/e2e/vue-shell.e2e.js` 新增 5 项：首页皮层粒子 + 无控制台错误、EasySci 搜索、Smart Brain Atlas WebGL、双语 About 往返、standalone 仅 dev 参考。
- 更新 `tests/project-regression.test.js` 中与 iframe 绑定方式相关的断言（静态 `src` → `legacy.html?embed=1` 契约）。

## 2026-10-30 — 阶段四：测试与生产预览（已完成）

- `npm test`：6 个文件 / 47 项全部通过（详见 `docs/RELEASE_QA_REPORT.md`）。
- `npm run build`：通过，产物含 `index.html`、`legacy.html`、`说明.html`、`assets/**`、`experiments/**`，无 `standalone.html`。
- `npm run test:e2e`：8 项 Chromium 用例通过。
- `npm run preview` + Playwright：桌面/移动、首页粒子、EasySci、Atlas、beLieve、双语、深层链接、刷新、404 资源检查。

## 2026-10-30 — 阶段五：文档（已完成）

- 更新 `README.md`：入口、运行、构建、部署、已知限制。
- 新增/更新 `docs/`：`MIGRATION_AUDIT.md`、`FEATURE_MIGRATION_MATRIX.md`、`TECHNICAL_REQUIREMENTS.md`、`ENGINEERING_PROGRESS.md`、`RELEASE_QA_REPORT.md`。

## 2026-10-30 — 阶段六：Git 与 PR（已完成）

| 提交 | 说明 |
|---|---|
| `docs: add standalone migration audit and feature matrix` | 审计与矩阵 |
| `refactor: enforce single Vue entry and build output contract` | vite 配置 |
| `feat: unify shell language state and bilingual About page` | App.vue + 说明.html |
| `test: cover entry contract, atlas webgl and bilingual about` | 测试 |
| `docs: record migration progress and release QA` | 文档与 README |

- 推送：`origin feature/standalone-to-vue-integration`。
- PR：目标 `master`，Draft（人工验收项未全部完成）。

## 未完成 / 下一步（未开始）

1. Smart Brain WebGL 在目标桌面与移动真机上的 GPU 验收（自动化仅证明上下文可用与画布渲染）。
2. 移动端真机布局复核（当前仅 390×844 视口截图）。
3. 外部 CDN（jsDelivr Three.js）不可用时的恢复路径人工验收。
4. `standalone.html` 是否归档/删除的决策（须在验收后单独确认）。
5. Supabase 环境变量在 Cloudflare Pages 的配置确认；前后端认证与数据方案另行设计。

## 风险登记

| 风险 | 等级 | 说明 | 缓解 |
|---|---|---|---|
| SPA fallback 掩盖资源 404 | 中 | `wrangler.jsonc` 的 `single-page-application` 对所有未匹配请求返回 `index.html` | 已在构建期校验必需资源；是否改为 `404-page` 待部署负责人决定 |
| 首页粒子尺寸分叉（1.2 vs 10.2） | 低 | standalone 与模块化常量不同 | 保留 1.2，视觉改动需单独评审 |
| Three.js 依赖 CDN | 中 | import map 固定 `0.186.1`，无本地回退 | 记录为已知限制；升级/本地化需单独任务 |
| iframe 架构 | 中 | 旧顶栏 DOM 仍存在（被 CSS 隐藏），两套导航实现并存 | 已统一可见导航与语言；更深层重构需独立计划 |
| `brain-surface.js` 未接线 | 低 | 无文档引用，测试仅校验路径 | 文档标注；不删除 |
| 本地调试账号 `1/1` | 高（上线前） | 不是真实认证 | README 与文档多处标注，上线前必须移除 |
