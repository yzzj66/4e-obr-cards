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
| `dice.html` + `assets/dice-page.js` | 骰子窗口（**单列，520×620**） | 只留骰子 / 表达式 / 战斗优势 +2 / 重击取满 / 本次结果 / 4E 预设 / 组合 |
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
com.4enext-owlbear/dice-window           骰子窗口（520×620）
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

## 3. 开关与降级

| 情况 | 行为 |
| --- | --- |
| 「设置 → 骰子 → 投骰动画」关掉 | `readDiceAnim()` 为 false → **根本不 `OBR.modal.open`**；投掷 / 结果 / 广播 / 落库一切照旧 |
| 动画页抛错（参数坏了 / 拿不到 DOM） | `onReady` 的 `try/catch` → `finish()` 收起并关掉自己；骰子窗口的结果面板不受影响 |
| `OBR.modal.open` 失败（旧 SDK / 被拦） | 骰子窗口 `playEffect` 捕获 → 状态行提示「投骰动画打不开（不影响结果）」 |
| 连续投掷 | 打开新动画前先 `OBR.modal.close` 上一个（`effectModalId`），不会叠一层又一层 |
| 动画期间点地图 | `disablePointerEvents: true` + `.fx-stage * { pointer-events: none }` → 点击穿透，能照常平移 / 选中 |
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

## 6. 已知限制

1. **没有真机联调**：动画的手感（抛物线高度、落地挤压）是按公式推的，真机上可能想再调
   —— 要调只改 `assets/dice-core.js` 的 `FX_*` 与 `assets/ui.css` 末尾那几个百分比 / px（两处一一对应）；
2. **镜头跟随是「每 4 帧一次」**而不是参考实现的每帧：省一半 Promise，肉眼无差别；
3. **动画不写历史**：它只呈现那一投，历史仍然只由 `CH_ROLL` → 城主落库那条链路写；
4. **动画页不显示皮肤**（皮肤仍未做）：骰面是 CSS 画的圆角方块 + 大数字 + 小类型标；
5. 记录窗口的「最近 4 条」是**条数**不是高度：展开后由列表自己滚动，不会把窗口撑出屏幕。
