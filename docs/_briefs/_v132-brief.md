# 任务 v1.3.2：入口按钮集合补齐 + 设置/关于窗口

## 现状

- `D:\deepseek\4E-Patch\owlbear-plugin\` 已到 **v1.3.1**（四个独立窗口：速览 / 角色卡导入 / 先攻 / 骰子 ✓；工具栏 3 个图标 ✓；视口夹紧 ✓；按钮反馈 ✓；名字改好 ✓）；
- 自测：`node dev/selftest.mjs` 4/4 全绿 ✓；bundle 150.8 KB ✓；
- 关键文件：`assets/background.core.js`（窗口注册 `WINS`/`openWin`/`winSize`/`WIN_MARGIN`/`reclampWins` + 工具栏 `OBR.tool.create` ✓）、
  `assets/window.js`（`createWindow`：拖动/ping 三态/置灰/feedback ✓）、`assets/panel.js`/`panel.html`、`assets/initiative-page.js`/`initiative.html`、
  `assets/dice-page.js`/`dice.html`、`assets/info.js`/`info.html`、`assets/common.js`（`PLUGIN_VERSION` ✓）、`assets/ui.css`（CSS 变量 ✓ 以它为准）、
  `dev/check.mjs`（断言）、`dev/selftest.mjs`；
- 设计参考：FullPeople 的入口是**一排小按钮**（时停/同步视口/音乐/转场/…/设置 ✓ 各自开窗 ✓）；设置窗口是**左侧分栏 + 右侧内容** ✓；
  参考 `https://github.com/FullPeople/obr-suite` 的 `src/background.ts`（入口注册）与设置/关于页（找 `Settings`/`About` 相关模块 ✓ 用 GitHub API 读）；

## 要做的

### 1. 入口补齐（参考 FullPeople 的「一排按钮」）
- 现有工具栏有：角色卡(panel) / 先攻 / 骰子 ✓；**补齐**：
  · **速览**（打开一个"当前选中 token 的速览"窗口 ✓ 复用 `info.html` 或让 `info` 也可从工具栏打开 ✓）；
  · **设置/关于**（新窗口 ✓ 见下）；
- 工具栏图标风格统一：现有 `icon-tool.svg` / `icon-tool-initiative.svg` / `icon-tool-dice.svg` ✓ 新增 `icon-tool-glance.svg`、`icon-tool-settings.svg` ✓（细线圆角 ✓ 同风格 ✓）；
- 每个按钮开各自窗口，互不嵌套 ✓ 可同时开 ✓。

### 2. 设置 / 关于窗口（新）
- `settings.html` + `assets/settings-page.js`（复用 `window.js` 的 createWindow ✓ 可拖动 ✓ 视口夹紧 ✓）；
- **左侧分栏**（列表）+ **右侧内容**（参考 Full Suite 的「设置 / 关于」）：
  · **关于**：插件名 `4eNEXT to owlbear`、版本号、构建/更新时间、作者、一句话说明；
  · **使用说明**：导入 JSON → 绑定 token → 各窗口入口/拖动的简要步骤；
  · **数据与权限**：说明数据存哪（房间数据 `com.4enext-owlbear/*` / token metadata / 本机 localStorage）+ 权限差异（GM/玩家）；
  · **已知限制**：未真机验证项、数值为离线推导、血量是快照、房间数据上限等（从 README 汇总 ✓）；
  · **重置本机设置**：清 `4enext/win-pos`、`4enext/info-pos`、追踪降级数据（需二次确认 ✓）；
  · **致谢**：参考 FullPeople 的开源实现（不写捐赠/联系方式 ✗）。
- 中文为主 ✓；内容**静态**（不需要多语言 ✓）。

### 3. 工程与自测
- 改 `background.core.js` 必须 `node dev/build-background.mjs`；
- `node dev/selftest.mjs` 4/4 全绿；`dev/check.mjs` 增加断言：
  · 设置/速览入口注册 ✓ 图标文件存在 ✓；
  · settings.html 存在且被 `WINS` 注册 ✓ 标题/版本取自 `PLUGIN_VERSION` ✓；
  · 「重置本机设置」只清约定的 localStorage 键（不碰房间数据/token 数据 ✓ 断言代码里没有 `setMetadata` 调用 ✓）；
- 版本 → **1.3.2**（manifest / relative / common.js / background.html ?v= / index.html / index.js 同步 ✓）；
- README：入口表加「速览」「设置」；顶部「⭐ 安装地址」保留 ✓；docs 新增 `docs/settings-window.md`。

## 硬性要求

- 只改 `D:\deepseek\4E-Patch\owlbear-plugin\`；不动 data/program/tools/archive；
- 不引入构建步骤；不改已有数据键名；不破坏 v1.3.1 已修好的东西（四个窗口/夹紧/按钮反馈/标题）✓；
- `docs/spec-*.md` 是别人的产出，**不要改** ✓。