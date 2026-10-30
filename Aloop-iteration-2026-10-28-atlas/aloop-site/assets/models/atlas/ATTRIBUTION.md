# 模型与解码器归属 / Attribution

本目录让站点脱离 `raw.githubusercontent.com` 与 `gstatic.com` 运行。模型与解码器
均为第三方资源，**不是**本项目的原创内容，各自的许可与上游作者如下。

## brain.glb

- 上游：<https://github.com/itayinbarr/brainproject>，路径 `brain-atlas/models/brain.glb`
- 几何来源：Z-Anatomy / BodyParts3D / DBCLS
- 许可：**CC BY-SA 4.0**（署名—相同方式共享）
- 抓取：2026-10-29，取自 `@main`
- 大小 4,650,816 字节
- SHA-256 `76A49EA4526A4880613AEC7A02756BD7301B0B9D0680D7CAE33E197B672C5453`
- 压缩：`KHR_draco_mesh_compression`（必需，故需下方 Draco 解码器）

注意：上游把**查看器代码**（Apache-2.0）与**解剖模型及其元数据**（CC BY-SA 4.0）分开
授权，两者不可互换。本项目只再分发模型数据，自己的 JS 代码仍按项目自身许可发布。

## manifest.json

- 上游：同上，`brain-atlas/models/manifest.json`
- 许可：随模型，CC BY-SA 4.0
- 抓取：2026-10-29
- 大小 232,455 字节
- SHA-256 `66C32355E02C3BA5FADF3B3BDB61B18C619162D6C5EE2083262E59BED4274D93`

## draco/（Draco 解码器 1.5.7）

- 上游：<https://www.gstatic.com/draco/versioned/decoders/1.5.7/>
- 项目：Google Draco，Apache-2.0
- 文件：`draco_decoder.js`、`draco_decoder.wasm`、`draco_wasm_wrapper.js`
- 抓取：2026-10-29
- SHA-256
  - `draco_decoder.js` `5656CCAF1F50300E3C318E15C3313430483F3866CD9C25F22FBF9D6F229E6728`
  - `draco_decoder.wasm` `2516A4E43526D71787BF2F678F951329F7F858F8F15F42D4BC9E370B31A0DA3A`
  - `draco_wasm_wrapper.js` `E8049906EF3F8F75D3456C22A3F31BFDFE5B5B5BD09CCDEC613B9E9A49D554D8`

## 再分发要求

模型以 CC BY-SA 4.0 发布，再分发时必须：

1. 保留署名（Z-Anatomy / BodyParts3D / DBCLS，经由 itayinbarr/brainproject）；
2. 指明许可并附许可全文链接 <https://creativecommons.org/licenses/by-sa/4.0/>；
3. 若修改了模型，说明修改内容，并以相同许可发布衍生模型。

站点页脚与「说明」页保留上游链接；如替换模型，请同步更新本文件的哈希。
