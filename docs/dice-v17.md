# v1.7.0 骰子：独立记录窗口 + 投骰动画 + 去掉豁免 / 先攻预设

> 规格仍然是 [`docs/spec-dice.md`](spec-dice.md)（**没有改动**）：动画公式照它 §4.2 / §4.4，
> 布局 / 投影 / 时间轴 / 抛物线全部来自参考实现 `FullPeople/obr-suite` 的
> `src/modules/dice/effect-page.ts` 与仓库根 `dice-effect.html`。
> 本文写**实际落地**的东西：文件、窗口 id、参数、公式表、降级路径与自测。

## 0. 一句话

在 v1.6.2 基础上做三件事：**① 骰子记录从骰子窗口的右栏搬出来，变成独立可拖动的显示框**
（默认显示最近 4 条，可展开全部，与骰子窗口各自开关）；
**② 复刻参考实现的投骰动画**（大骰子飞入 → 落地读数 → 放大 ×1.18 → 淡出，约 2.6 秒，纯 CSS 关键帧，
不挡鼠标、可在设置里关掉）；**③ 去掉「豁免」「先攻」两个 4E 预设**。
顺带确认：**40 条封顶时删的是最旧的那条**（数据真删，不是只截断显示），并加了断言。

## 1. 文件与窗口

| 文件 / id | 作用 | 备注 |
| --- | --- | --- |
| `dice.html` + `assets/dice-page.js` | 骰子窗口（**单列，520×620**；**v1.7.4 起 320×620**，见 §7） | 只留骰子 / 表达式 / 战斗优势 +2 / 重击取满 / 本次结果 / 4E 预设 / 组合 |
| `dice-history.html` + `assets/dice-history-page.js` | **记录窗口**（独立 popover，380×380） | id `com.4enext-owlbear/dice-history-window`；默认最近 4 条；只读 |
| `effect.html` + `assets/effect-page.js` | **投骰动画页**（全屏 modal） | **不是** popover：透明 + `disablePointerEvents`，播完自己关 |
| `assets/dice-core.js` | 规则 + **动画布局 / 时间轴的纯函数** | `fxBaseSize` / `fxDieSize` / `fxArcProfile` / `fxBeat` / `fxLayout` / `fxQuery` |
| `assets/dice-4e.js` | 4E 预设：**攻击 / 伤害 / 技能** | 豁免、先攻已删（见 §5） |
| `assets/background.core.js` | 注册 `WINS.diceHistory`；处理记录窗口开关命令 | `CH_DICE_HIST_CMD` → `CH_DICE_HIST_STATE` |
| `assets/common.js` | 新 id / 页面地址 / 频道 / 本机开关键 | 与后台同名常量一字不差（`dev/check.mjs` 对比） |
| `assets/ui.css` | 动画关键帧（`.fx-*`）+ 记录窗口（`.dh-*`） | 末尾追加；数字与 `dice-core.js` 一一对应 |
| `settings.html` + `assets/settings-page.js` | 设置里新增「骰子」一栏 | **投骰动画 开 / 关**（默认开，只影响本机） |

窗口 id 一览（互不相同 → 可以同时开着）：

```text
com.4enext-owlbear/dice-window           骰子窗口（v1.7.4 起 320×620；v1.7.0 是 520×620）
com.4enext-owlbear/dice-history-window   记录窗口（380×380，可拖动、单独记位置）
effect.html                              动画页 —— 全屏 modal，id = com.4enext-owlbear/dice-effect-<rollId>
```

### 两个窗口怎么各自开关

```text
骰子窗口「记录窗口」按钮
   → broadcast CH_DICE_HIST_CMD { op: "toggle" }   (LOCAL)
   → 后台 onDiceHistCmd：开着就 closeWin("diceHistory")，没开就 openWin("diceHistory")
   → broadcast CH_DICE_HIST_STATE { open: bool }   (LOCAL + REMOTE)
   → 骰子窗口把按钮显示成「记录窗口 · 开」/「记录窗口」
记录窗口自己的 ✕ → closeSelf(ID_DICE_HIST)（只关它自己，骰子窗口不受影响）
```

拖动 / 位置记忆 / 视口夹紧**全部复用** `assets/window.js` 的 `createWindow` +
`assets/background.core.js` 的 `WINS` / `winOpen` / `CH_WIN_DRAG`：
记录窗口的位置按窗口名 `diceHistory` 记在 `localStorage["4enext/win-pos"]`，没有另造一套拖动。

### 记录窗口显示什么

* 数据仍是房间数据 `com.4enext-owlbear/rolls`（城主客户端落笔）+ 本机暂存 `4enext/dice/local`；
* 默认 **最近 4 条**：CSS `.dh-list.compact .dh-row:nth-child(n + 5) { display: none; }`；
  点「展开全部（N）」看全部 —— 最多 40 条，在列表里滚动（`.dh-list` 是唯一的滚动容器）；
* 行内容与 v1.5.0 的历史行一样（掷骰者 / 备注 / 总点数 / 时间 / 每颗骰 chip）；
* **只读**：这里没有清空按钮（清空仍然只在骰子窗口、只有城主、要点两次）。

### 40 条封顶 = 超出删最旧

```js
// assets/dice-core.js mergeRollRows / background.core.js rollMerge（同一行为）
list.push(row);
list.sort((a, b) => (b.ts || 0) - (a.ts || 0));   // 新的在前
return list.slice(0, 40);                         // 砍掉 ts 最小的尾巴 = 最旧的那条
```

写进房间数据的 `rows` 本身就只剩 40 条（不是「只截断显示」）。`dev/test-dice.mjs` 用
「先放 40 条 → 再投第 41 条」断言：长度 40、新的一条在最前、**最旧的那条 `rollId` 不在了**。

## 2. 投骰动画

### 2.1 触发顺序（先算结果，再播动画）

```text
doRoll():
  1. 解析表达式 → rollParsed（真实点数，含重击取满 / 减骰 / repeat 行）
  2. rollToPayload → 画「本次结果」+ 广播 CH_ROLL（LOCAL + REMOTE）
  3. 若「设置 → 骰子」里动画开着：
       origin = 选中 token 的顶部中心（世界坐标；没选中用视口中心）
       OBR.modal.open({ id, url: effect.html + "?" + fxQuery(payload, origin),
                        fullScreen: true, hideBackdrop: true, hidePaper: true,
                        disablePointerEvents: true })
  4. 动画失败 / 被关掉：只 flash 一句「投骰动画打不开（不影响结果）」—— 结果早就画好了
```

### 2.2 布局公式（`fxLayout`，与规格 §4.2 逐条对应）

| 量 | 公式 | 常数 |
| --- | --- | --- |
| 基准尺寸 | `N <= 1 ? 128 : max(72, round(128 * 0.86^(N-1)))` | `FX_BASE_MAX 128` / `FX_BASE_MIN 72` / `FX_BASE_DECAY 0.86` |
| 单颗尺寸 | `round(BASE_SIZE * DIE_SIZE_FACTOR[imgTypeFor(type)])` | d4 .78 / d6 .85 / d8 .90 / d10 .93 / d12 .96 / d20 1.00 / d100 1.06 |
| 行距 / 列距 | `gap = round(BASE_SIZE * 0.16)`；`rowH = BASE_SIZE + gap` | `FX_GAP_RATIO 0.16` |
| 每行颗数 | 4（超出换行；`repeat` 按 `rowStarts` 分行） | `FX_PER_ROW 4` |
| 水平居中 | `cursor = -rowW / 2`，逐颗 `ox = cursor + size/2`，`cursor += size + gap` | — |
| 垂直居中 | `rowOy = (r - (rowCount-1)/2) * rowH` | — |
| 当前总和 | `top = -BASE_SIZE/2 - 64`（骰子行上方，水平居中） | — |
| 加值 / 备注 | `lastRowOy = (rowCount-1)/2 * rowH`；`top = lastRowOy + BASE_SIZE/2 + 28` | — |
| 一次最多画 | 20 颗（再多只画前 20 + 提示；**总和仍按真实结果**） | `FX_MAX_DICE 20` |

### 2.3 时间轴（`fxBeat`，与规格 §4.4 一致）

| 阶段 | 时长 | 触发 |
| --- | --- | --- |
| 飞入（4 段抛物线 + 720° 旋转 + 数字老虎机） | `FLIGHT 1200 ms` | 0 |
| 落地读数（数字定住真实点数） | `HOLD 500 ms` | 1200 |
| 赢家放大 1 → 1.18 → 1（峰值 45%） | `PUNCH 360 ms` | 1700 |
| 二次停留 | `HOLD2 220 ms` | 2060 |
| 淡出（上浮 24px + 缩到 .92） | `EXIT 320 ms` | 2280 |
| 关掉 modal | 合计 `2600 ms` | 2600 |
| 数字老虎机步长 | `SLOT 55 ms` | 飞行期间 |

抛物线参数：`N_ARCS 4`、`r = 0.55`、`H0 = 240`，第 i 段弧高 `H0 * r^(2i)`（240 / 72.6 / 21.96 / 6.64 px），
段时长 `t0 * r^i` → 累计百分比 **49.53% / 76.77% / 91.76% / 100%**（峰值取两段中点 24.77 / 63.15 / 84.27 / 95.88）；
挤压 `SQUASH 0.18`（落地 `scale(1.18, .82)`）、拉伸 `STRETCH 0.08`（空中 `scale(1, 1.08)`）、总旋转 `ROT_BASE 720°`。
以上数字在 `assets/ui.css` 的 `@keyframes fx-flight / fx-squash / fx-punch / fx-exit` 里就是这套值。

### 2.4 屏幕投影（规格 §4.3）

```js
sx = worldX * scale + vp.x;        // --tx
sy = worldY * scale + vp.y;        // --ty
```

* `worldX/worldY` 是**选中 token 的顶部中心**：`y = position.y - halfHeight`，
  `halfHeight = (image.height / item.grid.dpi) * sceneDpi * scale.y / 2`（拿不到就按 75）；
* 骰子窗口把世界坐标放进 URL（`wx` / `wy`），动画页每 4 帧重读一次
  `OBR.viewport.getPosition()` / `getScale()` —— 拖镜头时骰子跟着 token 走，又不会每帧堆两个 Promise；
* 没选中 token（或读不到）→ 落在**视口中心**。

### 2.5 为什么全用 CSS

* 关键帧只做 `transform / opacity`（合成层，不触发重排），数字老虎机只改 `textContent`；
* 没有任何外部库 / 没有 `requestAnimationFrame` 里算位置（`rAF` 只负责 `--tx/--ty` 投影）；
* 播放完 `finish()` 清所有 `setTimeout` / `setInterval` / `rAF`，并把舞台 `.fx-done` 隐藏，
  DOM 随 modal 一起销毁 —— 不会累积。

### 2.6 v1.7.1：完全透明背景 + 三级关闭

**问题**：v1.7.0 投完骰整个屏幕变黑，地图被完全盖住（用户截图「投掷怎么黑屏了」）。

**原因**：黑底来自动画页自己的 `html`，**不是** OBR 的 backdrop（`hideBackdrop` 已生效）。
`assets/ui.css` 顶部有一条 `html, body { background: var(--bg) }`（`--bg = #0b0f14`），
v1.7.0 只给 `body.fx-page` 覆盖了 `background: transparent !important`，`html` 仍是**不透明深色**；
body 一透明，html 那层黑就从整个 iframe 透出来 —— 全屏 modal 于是成了一整块黑。

**修法**（两处，双保险）：

| 位置 | 规则 |
| --- | --- |
| `effect.html`（内联 `<style>`，在 `ui.css` 之后） | `html, body.fx-page { background: transparent !important; color-scheme: normal !important; }`；`#app / .fx-root / .fx-stage / .fx-wrap` 也一律 transparent |
| `assets/ui.css`（`.fx-*` 段） | `html:has(body.fx-page) { background: transparent !important; }`；`body.fx-page` 也 transparent + `color-scheme: normal` |

* `color-scheme` 跟着退回 `normal`：深色 color-scheme 会让浏览器给透明 iframe 垫一层深色 canvas（同样是「黑屏」）；
* `.fx-*` 段里**没有任何纯色深色 background**：唯一的深色是每颗骰子自己的 `.fx-box` 径向渐变
  （那是骰面，不是页面底）—— `dev/check.mjs` 断言「effect.html / .fx-* 段没有深色纯色 background」；
* `pointer-events: none` 全保留：骰子不挡鼠标，动画期间照样能平移 / 选中地图；
* `hideBackdrop + hidePaper` 不变（backdrop / 纸张底都不出现）。

**关闭有三级**（`assets/effect-page.js`）：

| 触发 | 时机 | 实现 |
| --- | --- | --- |
| 播完 | `fxBeat().total = 2600 ms` | `later(finish, b.total)` |
| **兜底** | **3000 ms**（`FX_CLOSE_FALLBACK_MS`） | `later(finish, FX_CLOSE_FALLBACK_MS)` —— 动画被打断 / 定时器被挂起也一定收场 |
| ESC / 点击任意处 | 立即 | `window` 捕获阶段 `keydown`（`Escape` / `Esc` / 27）+ `click` → `finish()` |

`finish()` 幂等（`state.closed`）：清掉所有 `setTimeout` / `setInterval`、`cancelAnimationFrame`、
舞台加 `.fx-done`、`OBR.modal.close(id)`；先到的那个赢，后到的空跑，不会重复关 / 报错。

## 3. 开关与降级

| 情况 | 行为 |
| --- | --- |
| 「设置 → 骰子 → 投骰动画」关掉 | `readDiceAnim()` 为 false → **根本不 `OBR.modal.open`**；投掷 / 结果 / 广播 / 落库一切照旧 |
| 动画页抛错（参数坏了 / 拿不到 DOM） | `onReady` 的 `try/catch` → `finish()` 收起并关掉自己；骰子窗口的结果面板不受影响 |
| `OBR.modal.open` 失败（旧 SDK / 被拦） | 骰子窗口 `playEffect` 捕获 → 状态行提示「投骰动画打不开（不影响结果）」 |
| 连续投掷 | 打开新动画前先 `OBR.modal.close` 上一个（`effectModalId`），不会叠一层又一层 |
| 动画期间点地图 | `disablePointerEvents: true` + `.fx-stage * { pointer-events: none }` → 点击穿透，能照常平移 / 选中 |
| 动画被打断 / 定时器没跑到（v1.7.1） | **3000 ms 兜底** `finish()` 强制关闭；按 **ESC** / **点击任意处**也立即关（都不等播完） |
| 地图被黑色盖住（v1.7.1 修复） | 页面底 **html + body 全透明**（v1.7.0 只透明了 body，html 的 `#0b0f14` 会整块露出来） |
| 骰子超过 20 颗 | 只画前 20 颗（`FX_MAX_DICE`），总点数仍是真实总和 |

开关存在本机：`localStorage["4enext/dice/anim"]`，`"0"` = 关，缺省 / `"1"` = 开。
读写函数在 `assets/common.js`（`readDiceAnim` / `writeDiceAnim`）—— 设置页**不直接写 localStorage**
（`dev/check.mjs` 一直断言设置页里没有 `.setItem(` / `setMetadata` / `updateItems`）。

## 4. 4E 预设：删掉「豁免」与「先攻」

| 组 | v1.6.2 | v1.7.0 |
| --- | --- | --- |
| 攻击（vs 四防，附「防御参考」） | ✓ | ✓ |
| 伤害（武器骰 + 加值） | ✓ | ✓ |
| 技能（1d20 + 技能总值） | ✓ | ✓ |
| **豁免**（1d20，≥10） | ✓ | **删掉**（4E 里就是一个 d20，点一下骰子按钮即可） |
| **先攻**（1d20 + 先攻加值） | ✓ | **删掉**（先攻条 v1.4.0 已经自带「投先攻」，这里重复） |

数值口径没变：仍然只读 `glance.js` 的 `deriveGlance` 结果，不重算任何公式。

## 5. 自测

```bash
node dev/test-dice.mjs     # 纯函数：表达式 / 掷骰 / 合并 / 预设 / 动画常量 / 假 OBR 冒烟
node dev/check.mjs         # 静态：effect 页 / 常量 / modal 参数 / 无外部库 / 独立窗口 id / 40 条删最旧
node dev/selftest.mjs      # 5/5
```

v1.7.0 新加的断言（不启动浏览器，全部是纯函数 / 假 OBR / 假 DOM）：

1. `fxBaseSize`：1 颗 128、2 颗 110、3 颗 95、4 颗 81、5 颗起被 72 兜住；永远不会低于 72；
2. `fxDieSize`：d4 比 d20 小、d100 比 d20 大（系数表生效）；
3. `fxBeat()`：1200 / 500 / 360 / 220 / 320、合计 2600、slot 55、4 段弧、弧高 240 / 72.6 / 21.96 / 6.64；
4. `fxLayout`：3 颗骰子一行、水平居中（`sum(ox) ≈ 0`）、间距 = `round(base*0.16)`、
   `totalTop = -base/2-64`、5 颗时换行成 2 行；
5. `fxQuery`：`dtypes / dvalues / total / wx / wy` 都在，且能被 `URLSearchParams` 解回来；
6. 合并：**41 条 → 40 条，最旧的那条被删**（`mergeRollRows`）；
7. 设置关掉动画时投掷**不调用 `OBR.modal.open`**；开着时调用，且参数里有
   `fullScreen / hideBackdrop / hidePaper / disablePointerEvents: true` 与 `effect.html`；
8. 预设只剩 attack / damage / skill，`dice-4e.js` 里不再出现「豁免」「先攻」。
9. （v1.7.1）动画页**完全透明**：`effect.html` 显式把 `html` 一起设成 `transparent`、
   `effect.html` 与 `.fx-*` 段都没有深色纯色 `background`；`3000 ms` 兜底 `close` 真的会调用
   `OBR.modal.close`，ESC / 点击也能立即关（假 DOM + 假 OBR，不启动浏览器）。

## 6. 已知限制

1. **没有真机联调**：动画的手感（抛物线高度、落地挤压）是按公式推的，真机上可能想再调
   —— 要调只改 `assets/dice-core.js` 的 `FX_*` 与 `assets/ui.css` 末尾那几个百分比 / px（两处一一对应）；
2. **镜头跟随是「每 4 帧一次」**而不是参考实现的每帧：省一半 Promise，肉眼无差别；
3. **动画不写历史**：它只呈现那一投，历史仍然只由 `CH_ROLL` → 城主落库那条链路写；
4. **动画页不显示皮肤**（皮肤仍未做）：骰面是 CSS 画的圆角方块 + 大数字 + 小类型标；
5. 记录窗口的「最近 4 条」是**条数**不是高度：展开后由列表自己滚动，不会把窗口撑出屏幕。

## 7. v1.7.4：骰子窗口收窄（≈320×620）+ 本次结果固定底部 + 「记录窗口」打不开修复

用户 2026-11-15 的三条要求（外加一次明确更正）：

1. **「记录窗口」按钮点了打不开** —— 按钮在，点下去没有独立窗口出现；
2. **窗口要窄** —— 最初说「和 Players 面板差不多」，中途给了一张 790 宽的效果图
   （7 颗骰子一行 + 结果在底部），**随后又明确否掉宽版**：仍然要 **≈320 宽 / 620 高**的竖条；
3. **字号整体小一号 +「本次结果」固定在窗口底部**（用分隔线隔开、上部独立滚动、结果不随滚动消失）。

### 7.1 布局（`dice.html` + `assets/ui.css`）

```text
┌─ .win（320×620，后台 WINS.dice，仍按视口夹紧）──────────────┐
│ 标题栏（可拖动）/ 后台状态条                                  │
│ ┌─ .dice-cols（flex 竖排）────────────────────────────────┐ │
│ │ .dice-left（flex:1 + overflow-y:auto）＝独立滚动区        │ │
│ │   ① 骰子：4 + 3 两排（.dice-row = repeat(4)，第 2 行 3 颗）│ │
│ │   ② 表达式：− [输入框 13px] ＋                             │ │
│ │      投掷 / 上一次                                        │ │
│ │      保存组合 / 记录窗口      （2×2）                      │ │
│ │      战斗优势 +2 / 重击·伤害取满                           │ │
│ │      清空记录（.wide 独占一行）                            │ │
│ │   ③ 4E 预设（未选中绑定卡 → 提示文字）                     │ │
│ │   ④ 组合                                                  │ │
│ ├─ .dice-result（flex:0 0 auto + 上边框）＝固定底栏 ────────┤ │
│ │   本次结果 · 投骰动画：开                                  │ │
│ │   大号总点数 + 每骰 chip + 备注 / 标签 + 公式（#result）    │ │
│ └──────────────────────────────────────────────────────────┘ │
│ 底部状态行                                                    │
└──────────────────────────────────────────────────────────────┘
```

* **结果固定底部**：`.dice-result` 是 `.dice-cols` 的第二个 flex 子项（`flex: 0 0 auto`），
  `.dice-left` 才是唯一的滚动容器（`flex: 1 1 auto; overflow-y: auto`）→ 上面的内容怎么滚，
  结果都在底部不动；`.res-box` 自己再限高 146px 滚动（掷 20 颗骰子也不会把窗口撑开）。
* **为什么不再是一排 7 颗**：320 宽扣掉内边距只剩 ≈276px，7 颗每颗不到 40px（挤成一条缝），
  所以改用四列栅格 → 自动 4 + 3；每颗约 64×42。
* **字号整体小一号**：表达式输入 15→**13px**、分区说明 10.5→**10px**、按钮 13→**12px**、
  骰面 11.5→**10.5px**、总点数 34→**26px**、chip 11.5→**10.5px**。

### 7.2 「记录窗口」打不开：五层加固

链路上**每一环本来都在**（`CH_DICE_HIST_CMD` 两端一致 → 后台 `onDiceHistCmd` → `WINS.diceHistory`
→ `openWin("diceHistory")` → `CH_DICE_HIST_STATE`），但**任何一环没走通，用户看到的就是「点了没反应」**。
所以 v1.7.4 把这条链改成「怎么都得开出来 / 开不出来必须吵」：

| # | 位置 | 做法 |
| --- | --- | --- |
| ① | `assets/background.core.js` | `openDiceHistory()` 失败**重试一次**（宿主偶尔会在关窗动画没结束时拒绝 `popover.open`）；仍失败 → `stepFail`（**ERROR 通知**，并提示「先关掉骰子窗口再点一次」） |
| ② | `assets/background.core.js` | toggle 前先用 `OBR.popover.getWidth(ID_DICE_HIST)` 确认窗口**真的还开着**；reject = 状态跟丢 → 清掉 `winOpen` 并**重开**（否则会点成「关闭」，还是没反应） |
| ③ | `assets/background.core.js` | 记录窗口默认位置改成**贴着骰子窗口**开（右 → 左 → 下 → 上，见 `winDefaultPos(name, size, vp)`）。原来两个窗口都「水平居中 + 偏上」，380×380 的记录窗会被 320×620 的骰子窗**整块盖住** = 看起来像没打开 |
| ④ | `assets/dice-page.js` | 骰子窗口发命令后开 **900 ms 回执计时器**：等不到 `CH_DICE_HIST_STATE` 就**自己** `OBR.popover.open` 同一个 id / 同一个页面（位置放视口右上）+ WARNING 通知；连这个也失败 → **ERROR 通知** |
| ⑤ | `assets/dice-history-page.js` | 页面加载完发 `{ op: "ready" }` 握手 → 后台把「开着」补上（万一是骰子页兜底开的，下次点「记录窗口」才是关闭，不会又开一遍） |

按钮状态也跟着变：点下去先显示「记录窗口 · 打开中…」→ 回执到 → 「记录窗口 · 开 / 记录窗口」；
不再有「点了什么都没发生」这条路径。

### 7.3 改动清单

| 文件 | 改了什么 |
| --- | --- |
| `dice.html` | 结构改成「上部滚动区 + 底部固定结果」；结果块移到 DOM 末尾；按钮分两组（2×2 / 2+1） |
| `assets/ui.css` | `.dice-cols` 改 flex 竖排、`.dice-row` 四列、`.dice-acts` 两列 + `.wide`、新增 `.dice-result`、字号整体收一档 |
| `assets/dice-page.js` | 记录窗口：回执计时器 + 本页兜底 `openHistoryDirect` + ERROR 通知（布局逻辑没动） |
| `assets/dice-history-page.js` | 加载完 `{ op: "ready" }` 握手 |
| `assets/background.core.js` | `WINS.dice` → **320×620**；`openDiceHistory` 重试 + ERROR；`diceHistoryAlive()`；`ready` 握手；`winDefaultPos(name, …)` 让记录窗口贴着骰子窗口开 |
| 版本 | **1.7.4**（manifest×2 / common.js / background.core.js / background.html `?v=` / index.html / index.js）+ bundle 重建 |

### 7.4 自测（不启动浏览器）

```bash
node dev/check.mjs          # 320×620 / repeat(4) / .dice-result 在 DOM 末尾 + flex:none + 上边框 /
                            # .dice-left 独立滚动 / 字号 / 记录窗口五层加固 / 版本 1.7.4 全链路
node dev/test-dice.mjs      # 点「记录窗口」→ 发 toggle；回执 → 按钮变「开」且不再兜底；
                            # 没回执 → 本页真的 OBR.popover.open(dice-history.html) + 通知
node dev/test-background.mjs# toggle → popover.open(dice-history.html)（380×380，贴在骰子窗口右边，
                            # 不重叠）+ STATE{open:true}；再 toggle → close + STATE{open:false}；
                            # ready 握手补状态；开窗失败重试 1 次 + ERROR 通知
node dev/selftest.mjs       # 5/5
```

### 7.5 已知限制

1. 仍然**没有真机联调**（开发环境不能起浏览器）：记录窗口的加固是按「哪一环可能断」逐条补的，
   真机上如果还有一条路径没覆盖，`background.html` 的自检日志里会留下
   「骰子记录窗口：已打开 / 打开骰子记录窗口（可以先关掉骰子窗口，再点一次…）」这样的行；
2. ④ 的兜底开窗**不经过后台**，所以那个窗口**拖不动、也不记位置**（后台的 `winOpen` 里没有几何信息）；
   它自己的 ✕ 仍然能关（会广播 `open:false`），下一次正常链路打开后又恢复拖动。

