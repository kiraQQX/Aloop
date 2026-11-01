# Supabase 接入说明

状态日期：2026-11-02。分支：`chore/recovery-consolidation`（在 `master` 基础上整合 `feat/supabase-integration`）。

## 1. 架构

```text
index.html → src/main.js → App.vue（Vue 外壳）
                              ├─ src/lib/supabase.js   单一客户端（publishable key）
                              ├─ src/lib/auth.js       会话恢复 / 登录 / 注册 / 退出 / 重发验证 / 重置密码
                              ├─ src/lib/data.js       profiles / experiment_sessions / events
                              └─ iframe: legacy.html
                                    └─ assets/js/core/auth.js（统一认证接口）
                                         ├─ Shell 模式：调用 window.__ALOOP_AUTH__（Supabase SDK）
                                         └─ Standalone 模式：无桥时用 GoTrue REST + assets/js/core/config.js
```

设计取舍：

- 登录界面沿用旧版 `authmodal.js`（视觉与交互不变），认证实现由外壳或运行时按模式独占，避免两套登录状态并存。
- **Shell 模式**（生产网站）：`App.vue` 在 `isSupabaseConfigured` 为真时暴露 `window.__ALOOP_AUTH__`，会话由 `@supabase/supabase-js` 持久化（`persistSession` + `autoRefreshToken`，storageKey `aloop_supabase_auth`）；iframe 只委托，不读不写任何 token。
- **Standalone 模式**（`standalone.html`、直接打开 `legacy.html`，或未配置 `VITE_SUPABASE_*` 的嵌入页）：无桥可用，`assets/js/core/auth.js` 直接调用 GoTrue REST，会话保存在 `aloop_session_v2`，支持注册、登录、退出、token 刷新、邮箱验证、重发验证邮件与密码重置。
- 两种模式在一个文档内互斥：Shell 模式会清除残留的 standalone 会话，Standalone 模式完全不触碰外壳。
- iframe 的 `Aloop.authReady` 让旧路由在会话恢复完成后再渲染，避免已登录用户刷新 `#/e/<id>/run` 被弹回登录页。
- 生产构建缺少环境变量时**不会**退回调试账号：外壳不创建 bridge，iframe 以 Standalone 模式运行；若 `config.js` 也未配置，登录窗口显示“账号服务尚未配置”，页面底部显示配置错误条。仓库中不存在本地调试账号。

## 2. 环境变量

| 变量 | 用途 | 必需 |
|---|---|---|
| `VITE_SUPABASE_URL` | 形如 `https://<ref>.supabase.co` | 生产必需 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable（anon）密钥 | 生产必需 |

- 构建时通过 `import.meta.env` 注入；Cloudflare Workers 构建环境已声明配置。
- 前端只允许 publishable key；`service_role` / `sb_secret_` 会被 `validateSupabaseConfig` 拒绝并给出错误信息。
- 本地开发可在 `aloop-site/.env.local` 写入同名变量（已被 `.gitignore` 的 `.env.*` 覆盖）。

## 3. 数据库结构

迁移文件：`supabase/migrations/20261031090000_init_profiles_and_sessions.sql`（可重复执行）。

### profiles

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | 引用 `auth.users(id)`，级联删除 |
| `display_name` | text | 默认取用户 metadata 或邮箱前缀 |
| `created_at` / `updated_at` | timestamptz | `updated_at` 由触发器维护 |

`auth.users` 插入后由 `on_auth_user_created` 触发器自动建行（SECURITY DEFINER）。

### experiment_sessions

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | 客户端可提供的会话 ID |
| `user_id` | uuid FK → `auth.users` | 拥有者 |
| `experiment_id` | text | 例：`believe` |
| `arm` | text | `A` / `B` / `C` 或 null |
| `status` | text | `in_progress` / `completed` / `abandoned` |
| `phase` | text | 实验内部阶段标识 |
| `payload` | jsonb | 会话快照 |
| `started_at` / `updated_at` / `completed_at` | timestamptz | 时间字段 |

索引：`(user_id, updated_at desc)`。

### experiment_events

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint identity PK | 追加日志 |
| `session_id` | uuid FK → `experiment_sessions` | 级联删除 |
| `user_id` | uuid FK → `auth.users` | 拥有者 |
| `kind` | text | 事件类型 |
| `payload` | jsonb | 事件体 |
| `created_at` | timestamptz | 时间 |

索引：`(session_id, created_at)`、`(user_id, created_at)`。

## 4. RLS 策略

三张表全部 `enable row level security`，策略统一限定 `auth.uid()`：

| 表 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` |
| experiment_sessions | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| experiment_events | `auth.uid() = user_id` | `auth.uid() = user_id` 且 session 属于本人 | 不开放 | `auth.uid() = user_id` |

因此用户 A 无法读取或修改用户 B 的行，删除同理。前端隐藏按钮不承担权限职责。

## 5. 前端数据接口

`src/lib/data.js`：

- `ensureProfile(user)` — 登录后 upsert `profiles`（失败只告警，不阻塞登录）。
- `listExperimentSessions()` / `saveExperimentSession(session)` / `deleteExperimentSession(id)`。
- `listExperimentEvents(sessionId)`。

所有函数在客户端未配置时返回 `{ ok: false, reason: 'not_configured' }` 或 `null`，不会伪装成成功数据。

## 6. 已接入 / 未接入

| 项 | 状态 |
|---|---|
| 邮箱 + 密码注册 | 已接入（含邮箱确认分支） |
| 登录 / 退出 | 已接入 |
| 会话恢复 | 已接入（页面刷新） |
| 登录状态跨 iframe 同步 | 已接入（bridge + applySession） |
| 错误提示（凭据错误 / 网络异常 / 未配置 / 邮箱未确认） | 已接入 |
| 未登录访问实验 | 保留既有登录门禁，基于真实会话判断 |
| 用户资料持久化 | 已接入（profiles） |
| beLieve 实验数据写入 Supabase | **未接入**：仍写 localStorage；需先完成研究协议与知情同意评审 |
| 密码重置 / 邮箱变更入口 | **未接入**：现有 UI 没有入口，列为后续任务 |
| 管理员 / 公共数据表 | 未设计（当前无对应业务） |

## 7. 本地与生产步骤

本地：

```bash
cd Aloop-iteration-2026-10-28-atlas/aloop-site
# .env.local 写入 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

未配置 `.env.local` 时：Shell 模式不可用，iframe 以 Standalone 模式读取 `assets/js/core/config.js`；两者都为空时登录窗口提示“账号服务尚未配置”，不会出现调试账号。

生产（需在 Supabase 控制台完成）：

1. 在 SQL Editor 执行 `supabase/migrations/20261031090000_init_profiles_and_sessions.sql`。
2. Authentication → Providers 启用 Email；按需关闭/开启 “Confirm email”。
3. Authentication → URL Configuration 里把站点域名加入 Site URL / Redirect URLs。
4. 确认 Cloudflare Workers 的构建变量包含上述两项且使用 publishable key。
5. 部署后用一个测试邮箱走一遍注册 → 确认邮件 → 登录 → 刷新。

## 8. 已知限制

- 仓库与本地环境没有 Supabase 项目凭据，**真实注册/登录未在线上验证**；当前验证为单元测试（mock SDK / mock GoTrue）与本地 e2e（mock `/auth/v1/**`）。接入真实项目后需补跑一次真实注册、验证邮件、登录、重置密码与 RLS 权限检查。
- 邮箱确认模板、速率限制、CAPTCHA 等使用 Supabase 默认设置，未自定义。
- 若生产未执行迁移，登录本身仍可用，但 `profiles` upsert 会失败并在控制台告警。
