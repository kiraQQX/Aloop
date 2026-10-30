# 功能迁移矩阵（FEATURE_MIGRATION_MATRIX）

状态图例：**已迁移并验证** / **已实现未验证** / **保持原实现（通过兼容层复用）** / **未实现** / **风险**

基线：`origin/master` @ `3786e500c516773fb284e89408fa9bb5e34a0299`；迁移分支：`feature/standalone-to-vue-integration`。
“来源”列指该功能当前实际运行的代码位置；“standalone 对照”列指 `standalone.html` 中的等价实现。

## 1. 入口与工程架构

| 功能 | 来源（生产） | standalone 对照 | 状态 | 验收依据 | 风险 / 备注 |
|---|---|---|---|---|---|
| 生产首页入口 | `index.html`（只挂载 `/src/main.js`） | 无（standalone 自身是独立页面） | 已迁移并验证 | `tests/entry-contract.test.js`；`npm run build`；`dist/index.html` | 无 |
| 应用外壳 / 导航 / 语言 | `src/App.vue` | 旧顶栏 `standalone.html` L453–493 | 已迁移并验证 | `src/App.test.js`、Playwright 外壳用例 | 旧顶栏 DOM 仍随 `legacy.html` 加载，仅在 `?embed=1` 时隐藏 |
| 旧运行时承载 | `legacy.html` + `assets/**` + `experiments/**`（iframe） | 内联等价实现 | 保持原实现（通过兼容层复用） | Playwright 首页 / EasySci / Atlas / beLieve 用例 | iframe 方案带来独立文档上下文；跨文档语言同步依赖共享 `localStorage` |
| 开发静态直出 | `vite.config.js` `serveLegacyRuntime` | — | 已迁移并验证 | dev 下 `/legacy.html`、`/说明.html`、`/assets/*`、`/experiments/*`、`/standalone.html` 均 200 | 中间件必须在 `serve` 阶段生效，否则 import map 被打断 |
| 生产产物契约 | `vite.config.js` `verifyProductionOutput` | — | 已迁移并验证 | 构建成功；缺少任一必需文件会失败；`dist/standalone.html` 被禁止 | 新增必需文件时需同步更新 `requiredBuildOutput` |
| 历史单文件副本 | `standalone.html` | 自身 | 保持原实现（仅参考） | dev 访问返回 200 + `X-Robots-Tag: noindex`；构建产物中没有该文件 | 1.8 MB 文件留在仓库，长期会与模块化实现漂移 |

## 2. 业务模块

| 模块 | 生产实现 | standalone 对照 | 状态 | 验收依据 | 风险 / 备注 |
|---|---|---|---|---|---|
| 首页视觉与实验入口 | `legacy.html` L100–123、`assets/css/{home,revision3,theme-blue}.css`、`assets/js/ui/sections.js` | L522–545 | 保持原实现（通过兼容层复用） | Playwright 首页截图 + `#home` 可见 | 首页粒子亮度偏弱，属既有设计取舍，未改动 |
| 首页粒子脑 | `assets/js/gl/particle-cortex.js`（采样 `brain.glb` 皮层网格） | 同名内联段落，`uSize` 常量 10.2 | 保持原实现（通过兼容层复用） | Playwright：`data-source="cortex-glb"` + `is-ready` + 画布可见 | 两版 `uSize` 为 1.2 / 10.2，已判定保留 1.2；若后续要调整需视觉确认 |
| 全局导航 | `src/App.vue` `.vue-topbar` | 旧顶栏 | 已迁移并验证 | Vitest + Playwright（`aria-current`、实验菜单） | — |
| 中英文切换 | `src/App.vue` + `assets/i18n/site.js` | 同一 i18n 模块 | 已迁移并验证 | Vitest 语言持久化；Playwright 中英切换与刷新后保持 | 语言键 `aloop_lang_v1` 为双端共享契约 |
| EasySci 目录 | `assets/js/easysci/{data,easysci}.js` | 同名内联段落（432 条，完全一致） | 保持原实现（通过兼容层复用） | Playwright：首屏 50 卡片、搜索 `zotero` 收敛到 3 张 | 1.4 MB 数据文件单行压缩，编辑需工具 |
| Smart Brain 概览 / 学习 | `assets/js/smartbrain/{learn,lessons,narration}.js` | 同名内联段落（Learn 指向旧查看器） | 保持原实现（通过兼容层复用） | Playwright：三个标签页存在 | 语音讲解依赖浏览器 Web Speech API，未做自动化断言 |
| Smart Brain Atlas | `assets/js/smartbrain/atlas/*` + `assets/css/atlas.css` | **不存在**（只有 `model-viewer.js`） | 保持原实现（通过兼容层复用） | Playwright：WebGL 画布 ≥ 200×200、上下文可用、图层文案可见 | 模型 4.6 MB，首屏较慢；依赖 WebGL |
| beLieve 实验运行时 | `experiments/believe/{manifest,runtime}.js` | 内联 runtime（去空白后完全一致） | 保持原实现（通过兼容层复用） | Playwright：登录门槛 + 调试账号 `1/1` 进入运行态 | 不是真实认证；数据只存浏览器本地 |
| 登录弹窗 | `assets/js/ui/authmodal.js` + `assets/js/core/auth.js` | 同名内联段落 | 保持原实现（通过兼容层复用） | Playwright beLieve 用例 | 调试凭据上线前必须移除 |
| 说明页面 | `说明.html`（`?embed=1&lang=zh|en`） | 无（只链接到此页） | 已迁移并验证 | Playwright：embed 隐藏顶栏、中英标题、返回首页 | 双语内容为人工翻译，需内容负责人复核 |
| 路由与深层链接 | `assets/js/core/router.js` + `src/App.vue` | 旧 router（无 atlas 子路由） | 已迁移并验证 | Vitest 深层链接；Playwright 前进/后退 | 仅 hash 路由，无服务端路径路由 |
| 3D 模型与 Draco | `assets/models/atlas/**` | 同路径引用 | 保持原实现（通过兼容层复用） | `tests/model-assets.test.js` + 构建产物校验 + Playwright WebGL | 依赖 CDN 的 Three.js；模型与解码器已自托管 |
| 静态资源 | `assets/**`、`experiments/**`、`assets/models/**` | 内联 / base64 | 保持原实现（通过兼容层复用） | `tests/entry-contract.test.js` 存在性与相对路径断言 | 大小写敏感环境（Linux/Cloudflare）需保持现有大小写 |

## 3. 未实现 / 明确不做

| 项目 | 状态 | 说明 |
|---|---|---|
| 真实账号认证 | 未实现 | `src/lib/supabase.js` 只是未接线的客户端草稿；前端登录为本地调试适配器 |
| 数据库 / RLS / 实验数据上传 | 未实现 | 需要单独设计与安全评审，本次不实施 |
| `brain-surface.js` 首页挂载 | 未接线 | 该模块期望 `.brain-surface-canvas` 标记，当前文档未提供；保留文件与测试引用 |
| Three.js 本地打包 | 未实现 | 仍通过 import map 从 jsDelivr 加载固定版本 `0.186.1` |
| Cloudflare 部署配置变更 | 未执行 | `wrangler.jsonc` 未修改；`not_found_handling: single-page-application` 会掩盖缺失静态资源的 404，已记入风险 |

## 4. 验收覆盖对照

| 验收项 | 自动化 | 人工 |
|---|---|---|
| `index.html` 唯一入口 | ✅ Vitest + 构建插件 | ✅ 构建产物检查 |
| Vue/Vite 统一构建 | ✅ `npm run build` | — |
| EasySci | ✅ Playwright | ✅ 截图 |
| Smart Brain（含 Atlas） | ✅ Playwright WebGL | ✅ 截图（桌面 + 移动） |
| beLieve | ✅ Playwright | ✅ 截图 |
| 双语 | ✅ 外壳 + About | ✅ 截图（中/英） |
| 深层链接 / 刷新 / 后退 | ✅ Playwright | ✅ |
| 移动端布局 | ⚠️ 仅 390×844 无横向溢出断言 | ✅ 截图 |
| 资源 MIME / 404 | ✅ Playwright 响应断言 | — |
| 控制台错误 | ✅ 每个用例断言 `error` 为空 | ✅ |

## 5. 维护规则

1. 新增静态资源目录时，同步更新 `vite.config.js` 的 `requiredBuildOutput` 与 `serveLegacyRuntime` 白名单。
2. 修改 `standalone.html` 不再影响生产；若需要对照，请在 dev 打开 `/standalone.html`。
3. 任何把 `standalone.html` 复制进 `dist` 的改动都会被构建插件拒绝。
4. 修改语言键、路由 hash 或 iframe 参数时，必须同时更新 `src/App.test.js` 与 Playwright 用例。
