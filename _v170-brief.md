# 任务 v1.7.0：骰子记录独立可拖动 + 投骰动画 + 去豁免/先攻预设

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\` **v1.6.2**（骰子已可用 ✓ 团队共享历史 ✓ 40 条封顶 ✓）；
- 骰子实现：`assets/dice-core.js`（纯函数）+ `assets/dice-4e.js`（预设）+ `dice.html`/`assets/dice-page.js`（两栏 UI，**记录嵌在右栏** ✗）；
- 规格：`docs/spec-dice.md` ✓ 其中 **§5 动画/布局公式**（BASE_SIZE/FLIGHT/HOLD/PUNCH/EXIT/N_ARCS/世界→屏幕换算 ✓）来自参考实现 `effect-page.ts` ✓；
- 参考实现：`https://github.com/FullPeople/obr-suite` 的 `src/modules/dice/`（`effect-page.ts` 77 KB 动画页 ✓ `panel-page.ts` ✓ `history-page.ts` ✓）+ 仓库根 `dice-effect.html`；
- 工程：改 core 必须 `node dev/build-background.mjs`；`node dev/selftest.mjs` 必须 5/5 绿；

## 用户要求（2026-11-15）

### 1. 骰子历史：确认 40 条封顶时**删除最旧的** ✓
- 先确认现有 `rollMerge` 是「新的在前 + 超过 40 删最旧」✓（应是 ✓ 规格如此 ✓）；若只是截断显示而没删数据 ✗ → 补上删除逻辑 ✓；
- 在 `docs/dice-v15.md` 写清楚：**40 条封顶，超出自动删最旧** ✓。

### 2. 去掉两个预设
- **去掉「豁免」预设** ✗（用户在 4E 里不需要 ✓）；
- **去掉「先攻」预设** ✗（先攻条已有这功能 ✓ 重复了 ✗）；
- 保留：攻击 vs 四防 / 伤害 / 技能 ✓（其余按现有 ✓）。

### 3. 骰子记录改成「独立可拖动的显示框」（参考 FullPeople）
- 现在记录嵌在骰子窗口右栏 ✗ → 改成**独立 popover**（新窗口 ✓ 有自己的 id ✓ 可拖动 ✓ 记位置 ✓ 像其他窗口一样用 `window.js` 的 createWindow ✓）；
- 显示**最近 4 条**记录 ✓（多了可滚动 ✓ 或点击展开 ✓ 选一个 ✓）；
- 骰子窗口变窄（只留骰子+表达式+预设+组合 ✓ 记录搬走 ✓）；
- 两个窗口**独立开关** ✓ 可同时开 ✓；
- **拖动实现**照抄现有窗口的拖动机制（`window.js` ✓ 不要另造 ✗）。

### 4. 投骰动画（参考 FullPeople 的 effect-page）
- 复刻参考实现的投骰动画：**屏幕中央/鼠标附近弹出大骰子** → 飞行/落定/弹跳/消失 ✓；
- 按规格 §5 的公式实现（`BASE_SIZE=128*0.86^(N-1)` 最小 72 ✓ `FLIGHT 1200/HOLD 500/PUNCH 360/HOLD2 220/EXIT 320` ✓ 世界→屏幕 `sx=worldX*scale+vp.x` ✓ 等）；
- 实现方式：**新的 popover 页**（`effect.html` + `assets/effect-page.js` ✓ 透明背景 ✓ 无指针事件干扰地图 ✗ 用 `disableClickAway` + 让 OBR popover 不挡点击？✗ hmm: 参考实现用的是**全屏 modal + disablePointerEvents** ✓ —— 照抄参考实现的做法 ✓）；
- 动画用 CSS transition/keyframes ✓（不要引入库 ✗）；
- 骰子点数由真实投掷结果决定（动画只是呈现 ✓ 先算结果再播动画 ✓）；
- **降级**：动画播放失败/被禁用时，直接显示结果 ✓ 不影响投掷 ✓；
- 设置里加开关「投骰动画 开/关」（默认开 ✓ 放 `settings.html` ✓）。

## 工程与自测

- 新增 `effect.html` + `assets/effect-page.js` + CSS（`assets/ui.css` 末尾追加 ✓）；
- `dev/check.mjs`：新增 effect 页面存在、动画常量、modal 参数（disablePointerEvents ✓）、无外部库引用、豁免/先攻预设已删、记录窗口独立 id、40 条删除逻辑；
- `dev/test-dice.mjs`：新增「41 条 → 剩 40 且最旧的被删」「动画时间轴常量」「动画关闭时无 modal」断言 ✓；
- 版本 → **1.7.0**（manifest×2 / common.js / background.html ?v= / index.html / index.js）；
- `docs/dice-v15.md` 或新建 `docs/dice-v17.md` 写实现 + 常量表 + 降级说明 ✓；
- README 功能表加「独立记录窗 + 投骰动画」✓ 顶部「⭐ 安装地址」保留 ✓；
- **manifest 保持无 action** ✗、**不要改 `docs/spec-*.md`** ✗、不要改其它目录 ✗、不引入构建步骤 ✗、**禁止启动浏览器** ✗。

## 硬性要求

- 不破坏：速览/血条/四防一排/Boss/先攻条/设置/五入口/骰子已有功能 ✓；
- 动画**性能**：同时最多 N 个骰子（按参考实现 ✓），播放完自动清理 DOM ✓ 不累积 ✓。