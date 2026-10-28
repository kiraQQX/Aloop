# GitHub Pages 部署

Aloop 使用相对资源路径和 hash 路由，可以部署在 GitHub Pages 的项目站点子路径下。当前站点不需要 Node.js 构建过程。

## 发布步骤

1. 在 GitHub 新建一个仓库，例如 `aloop`。
2. 将本目录中的文件和子目录提交到仓库根目录；不要只上传 `index.html`，`assets/` 与 `experiments/` 必须一并上传。
3. 打开仓库的 **Settings → Pages**。
4. 在 Build and deployment 中选择 **Deploy from a branch**，分支选择 `main`，目录选择 `/(root)`，然后保存。
5. 等待 GitHub Pages 发布完成，打开 Settings → Pages 显示的 URL。
6. 验证首页、中英文切换、快速选择菜单、账号弹窗、beLieve 同意页、训练/测试流程与 JSON 下载。可在测试后删除本地站点存储重新开始。

## 部署注意事项

- 通过 `#/`、`#/e/believe`、`#/e/believe/run` 进行前端路由，刷新时不会请求不存在的服务端路由。
- 动态加载实验运行时使用相对路径 `experiments/believe/runtime.js`。若修改部署结构或在反向代理路径下托管，应再次核对路径。
- GitHub Pages 是静态托管方案，不提供本项目需要的服务端账号、随机化、数据接收和访问控制。当前版本的数据保存在参与者浏览器内，不会自动汇总到研究者后台。
- 不要把真实参与者数据、凭据、私钥或其他敏感资料提交到 Git 仓库。
- 发布前应审查研究伦理、知情同意文案、题库证据与数据保留规则；原型 UI 可用不代表研究流程已经获批。
- 公开部署前建议使用无痕窗口或清理站点数据测试首次访问、重新进入、旧会话恢复与重新开始。
