# 任务：给 Owlbear 插件加「自诊断 + 硬兜底」，定位为什么在房间里不出现

## 背景

- 插件已在 `D:\deepseek\4E-Patch\owlbear-plugin\`（免构建静态文件 ✓，已部署到 `https://yzzj66.github.io/4e-obr-cards/` ✓）
- 现状：manifest 能被 Owlbear 读到（扩展列表里显示「4E NEXT 角色卡 v1.0.0」，可开关 ✓），`index.html` 在浏览器里**正常显示** ✓，
  但在枭熊房间里：**右下角没有 4E 按钮**、**右键 token 没有「绑定 4E NEXT 角色卡」** ✗；用户没有提供控制台报错 ✗；
- 参考实现（已验证可在 OBR 跑）：`https://github.com/FullPeople/character-cards`（manifest/background/panel/info/bind，`@owlbear-rodeo/sdk` v3.1.0，vite 构建、`base:"/character-cards/"`）；
- 我们的 SDK：`vendor/obr-sdk.js`（esm.sh 打包的 ESM 单文件）✓，各页面用 `<script type="module">` + 相对 import ✓；
- 已知差异（可疑点，请逐一核实）：
  1. 参考插件用 **vite 构建产物**（`assets/*.js` 是打包后的普通 module），我们是**源码直接跑**（多文件 ESM + 相对 import）→ 某些 OBR iframe 的加载策略可能不接受 ✗；
  2. 参考插件的 manifest `icon` 是 **`/character-cards/icon.svg`**（绝对路径），我们写的是 `icon.svg`（相对）✗；
  3. 参考插件 background 的入口是 `background.html` ✓ 同我们；
  4. OBR contextMenu 的 `filter.roles` 可能不是 `["GM"]` 的正确写法 ✗（参考实现怎么写的？去读 `src/background.ts`）✓；
  5. popover 的 `anchorReference/anchorPosition` 参数可能写错 ✗（参考 `src/background.ts` 的 `OBR.popover.open` 用法）。

## 要做的

1. **先读参考实现的 `src/background.ts`（完整，约 9.6 KB）**：
   `https://api.github.com/repos/FullPeople/character-cards/contents/src/background.ts`（base64 解码）；
   逐项对照我们的 `assets/background.js` / `assets/common.js`，找出 API 用法差异（尤其：`contextMenu.create` 的 filter/roles/icons 写法、`popover.open` 参数、`OBR.onReady` 之外还做了什么、有没有 `OBR.actions`/`OBR.tool` 注册）；
2. **加"自诊断"**（让用户不打开控制台也能看到状态）：
   - background 在 `onReady` 成功后调用 `OBR.notification.show("4E NEXT 角色卡已加载", "INFO")`（临时诊断用，可在配置里关）；
   - 每个关键步骤（注册右键菜单 / 开按钮 / 读房间数据）失败时 `OBR.notification.show("4E插件出错: " + e.message, "ERROR")`；
   - 在 `index.html` 顶部加一块「**自检**」：显示 manifest 地址、SDK 版本、`OBR` 是否可用（打开页面时自动检测），并提示"如果房间里看不到按钮，请把本页截图给作者"；
3. **增加第二种入口**（不依赖 popover/按钮）：
   - 用 `OBR.actions`（或 `OBR.tool.create`，按参考实现里真实存在的 API）在**右上/底部工具栏**加一个可点入口 → 打开 panel；
   - 参考实现里"右下角按钮"具体用的是什么 API（`OBR.popover.open` with `anchorReference:"POSITION"`？还是 `OBR.tool.create`？）请照抄它的写法；
4. **修复可疑点**：`icon` 改绝对路径；`contextMenu` 的 `roles` 按参考改写；`popover` 参数对齐参考；
5. **降低加载风险**：把 `background.html` 改成**不带 module 的类型**（`<script src="assets/background.js" type="module">` 保留，但把 import 改成**单文件内联**？）—— 若判断多文件 ESM 是风险，可把 background 需要的代码**合并成一个 `assets/background.bundle.js`**（手工拼接 + 去掉 import/export，用全局对象），确保 background 只加载**一个脚本**；
6. 交付：更新 `D:\deepseek\4E-Patch\owlbear-plugin\` 下相关文件 + 简短 `docs\owlbear-debug.md`（改了什么、为什么、用户如何验证：刷新后应看到哪些提示）；
7. 自测（无浏览器）：JSON 合法、HTML 引用文件存在、JS 语法 `node --check`、`background.bundle.js` 无 import/export 残留。

## 硬性要求

- 不改 `D:\deepseek\4E-Patch\` 下其它目录（data/program/tools/archive 只读）；
- 不引入构建步骤（产物仍是可直接静态托管的文件）；
- 改动要**能解释原因**（对照参考实现的哪一行），不要盲改。