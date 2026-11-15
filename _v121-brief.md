# 任务：v1.2.1 UI 微调（弹窗加宽 / 行动点与里程碑同排 / 去掉专长与每日威能追踪）

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\` 已到 **v1.2.0**（血条 + 资源追踪可用 ✓，用户已在枭熊里验证成功 ✓）；
- 关键文件：`assets/glance.js`（速览渲染 ✓ 含 live/editable 模式）、`assets/glance.css`（样式 ✓）、`assets/info.js`（弹窗入口 ✓）、
  `assets/track.js`（追踪读写层 ✓）、`assets/background.core.js`（+ 必须 `node dev/build-background.mjs` 重新生成 `background.bundle.js`）、
  `assets/panel.js`（面板预览 ✓）；
- 弹窗尺寸在 `info.js` / `background.core.js` 的 `OBR.popover.open({width,height})` 里（当前 440×600 之类，请查实际值）；

## 用户要求（原话，逐条实现）

1. **弹窗整体更宽**：现在约 500px 宽，内容挤（HP 行、数值行、属性 3 列都紧）→ 加宽到 **620~680px**（高度也适当加，如 640~760），
   同时保证小屏（13 寸笔记本 ✓ 1920×1080 ✓）不超出视口；面板 `panel.html` 里的预览同理适度加宽 ✓；
2. **「行动点」和「里程碑」放同一排**（现在分两行 ✗）→ 并成一行：`行动点 [−] N [+] ｜ 里程碑 [−] N [+]` ✓；
3. **去掉「专长」的资源追踪**：专长 chips 不再可点、不再显示「已用 x/y」（保持纯展示 ✓）；
4. **去掉「每日威能」计数**（装备与魔法物品栏里的 `每日威能 − 0/3 +` 整个移除 ✗），装备 chips 的「已用/耗尽」追踪**保留** ✓；

## 要做的

- 改 `glance.js` / `glance.css` / `info.js`（+ 若弹窗尺寸在 background 则改 `background.core.js` 并重打包 bundle）；
- 确保不影响已有的：HP 控制、回复力、短休/长休、威能追踪、装备追踪、token 血条 ✓；
- 修改后跑：`node dev/build-background.mjs`（若改了 core）、`node dev/check.mjs`、`node dev/test-background.mjs`、`node dev/test-track.mjs`、`node dev/check-render.mjs`（若有）✓；
- 版本号 → **1.2.1**（manifest.json / manifest.relative.json / common.js / README 同步 ✓）；
- README 顶部**必须保留**「⭐ 安装地址（复制这一行）+ manifest URL」，并在功能说明里去掉"专长追踪/每日威能"字样 ✓；
- `docs/` 下补一条简短说明（这次改了什么）。

## 硬性要求

- 只改 `D:\deepseek\4E-Patch\owlbear-plugin\`；不动 data/program/tools/archive；
- 不引入构建步骤；bundle 必须与 core 同步；
- 不改动数据键名（`com.4enext-owlbear/state/<cardId>` 等）→ 用户已有状态不能丢 ✓。