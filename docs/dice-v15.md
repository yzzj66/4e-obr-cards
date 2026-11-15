# v1.5.0 骰子：实现说明

> **v1.7.0 改了三处，详见 [`docs/dice-v17.md`](dice-v17.md)**：① 记录搬进**独立可拖动窗口**（最近 4 条，可展开全部）；
> ② **投骰动画**（CSS 关键帧，可开关）；③ 去掉「豁免」「先攻」两个预设。本文其它内容（表达式 / 重击 / 团队共享）仍然有效。

> 规格是 [`docs/spec-dice.md`](spec-dice.md)（**没有改动**，末尾的「## 用户拍板」是最终口径）。
> 本文写的是**实际落地**的东西：文件、数据流、语义、权限边界、自测与已知限制。

## 0. 一句话

在 v1.4.0 的基础上加一个**骰子窗口**：表达式引擎（d4–d100 + `adv` / `max` / `reset` / `burst` / `repeat` 等包裹）、
**战斗优势 +2**、**重击 = 4E 伤害骰取满**、**团队共享历史**（城主落笔，40 条封顶）、4E 预设（攻击 / 伤害 / 豁免 / 技能 / 先攻）。
**不做**命中判定、豁免成败、优势 / 劣势按钮、暗骰、示例框、5etools 菜单、P4 动画与皮肤。

## 1. 文件

| 文件 | 作用 | 备注 |
| --- | --- | --- |
| `assets/dice-core.js` | **纯函数核心**：解析 / 格式化 / 掷骰 / 重击 / 归一化 / 合并去重 / 房间数据形状 | 不 import OBR、不碰 DOM → `node dev/test-dice.mjs` 直接 import |
| `assets/dice-4e.js` | `presetsFor(char, rules)`：五组 4E 预设 | **只读 glance 的推导结果**，不重算公式；被 `dice-page.js` 动态 import |
| `assets/dice-page.js` | 骰子窗口的 DOM / 广播 / 房间数据 / 本机存储 | 规则一律调 `dice-core.js` |
| `dice.html` | 两栏布局（左组公式 / 右结果 + 团队历史） | 窗口 id 仍是 `com.4enext-owlbear/dice-window` |
| `assets/background.core.js` | **城主侧落库**：收 `CH_ROLL` → 校验归一化 → 幂等合并 → 写房间数据 → 广播 `CH_ROLL_SAVED` | 新增 §7.5；`WINS.dice` 加宽到 760×620 |
| `assets/common.js` | 频道 / 键 / 版本号（1.5.0） | 与后台同名常量逐字一致（`dev/check.mjs` 对比） |
| `assets/ui.css` | 骰子窗口样式（`.dice-cols` / `.dice-row` / `.die-chip` / `.hist-row` …） | 替换掉 v1.3.1 的占位样式 |
| `dev/test-dice.mjs` | 规格 §8 的 16 条 + 重击 / 战斗优势 / 不判定 | 5/5 里的第 5 条 |
| `dev/check.mjs` | 新增「v1.5.0 骰子」整节断言 | 版本、频道、上限、按钮、尺寸、文档 |

## 2. 表达式语法（`dice-core.js`）

```text
2d6 + 1d20 + 5        平铺和；-1d6 是「减骰」（真实掷出、总和减、chip 半透明）
adv(1d20[,N])         掷 N+1 组取最大；dis 取最小；被丢弃的骰标 loser（总和不算）
max(inner,X)          每颗抬到 ≥X；min(inner,X) 压到 ≤X
reset(inner,X)        == X 重掷一次；resetmin ≤X；resetmax ≥X
burst(inner)          掷出最大面就追加一颗同类型骰，最多 5 连（burstParent 记父下标）
same(inner)           纯视觉（重复点数脉冲），不改数值
repeat(N,inner)       跑 N 行，每行各自算总和；必须独占整条表达式
```

细节（与规格 §2.3 一致）：`normalizeExpr` 先把全角括号 / 逗号 / 加减号换成半角并去掉空白；
`splitTopLevel` 按**深度 0 的 +/-** 切项（`adv(1d6)+adv(1d4)-2` → 3 项、2 个 segment + `-2`）；
`readWrapperHead` 用**最后一个**顶层逗号取 `max/min/reset*` 的 X、用**第一个**取 `repeat` 的 N；
符号会穿透到 inner（`-adv(1d4)` 的骰数与加值一起取反）。
`formatExpr` 输出规范化字符串（历史 / 广播里的 `expression` 就是它），并且**幂等**。

**不提供的按钮**：优势 / 劣势（语法保留，粘贴旧公式照样能掷）、暗骰、DM 固定结果。

## 3. 重击 = 4E 口径

* 打开「重击 · 伤害取满」后，`rollParsed(..., { crit: true })` 让**每一颗**骰子直接等于面数（`d6`→6、`d8`→8、`d100`→100），
  结果面板标注 **「重击 · 已取满」**；**不是** 5E 的「骰数翻倍」。
* 公式里带任何 wrapper（`adv/dis/max/min/reset*/burst/repeat`）时无法逐颗取满：
  本次**退化为普通投掷**，面板给出红字提示（`critDegraded + ROLL_CRIT_NOTE`），不会假装已经取满。
* 负数骰（`-1d6`）同样取满 —— 减得更多，符合「伤害骰取最大」的字面语义。

## 4. 战斗优势 +2

按钮走 `adjustExprModifier(parsed, ±2)`：点一下公式加值 +2（`1d20 + 5` → `1d20 + 7`），
再点一下撤回；手动改表达式会清掉按钮的「on」状态（避免按钮与实际公式不一致）。
UI 只改 `modifier`，不碰骰子数量。

## 5. 结果面板：只显示点数

用户拍板覆盖规格 D1/D2：**没有 TN 输入框**，不显示命中 / 未命中、成功 / 失败。
面板显示：总点数（大号）、每颗骰子的 chip（`d20 14`，`crit` 金色 / `fail` 红色 / `loser` 删除线 / `subtract` 虚线 + `−`）、
平铺加值 chip、规范化公式；`repeat` 另外显示每行小计。
载荷里也**没有** `target` / `hit` 字段；`normalizeRoll` 会把别处塞进来的这两个字段丢掉（测试第 12 条钉死）。

## 6. 团队共享（房间数据）

```text
玩家 A 骰子窗口                城主客户端（后台 background.html）
  CH_ROLL(LOCAL+REMOTE)  ─────▶  校验形状/范围 → normalize → 幂等合并 → room.setMetadata(KEY_ROLLS)
  本机先乐观显示                 └─▶ CH_ROLL_SAVED { seq, rollId } (LOCAL+REMOTE)
  ◀───── room.onMetadataChange（所有人）─── 读 rolls → 重画右栏（≤40 条）
```

| 常量 / 键 | 值 | 端 |
| --- | --- | --- |
| `CH_ROLL` | `com.4enext-owlbear/roll` | common.js / background.core.js / dice-page.js |
| `CH_ROLL_CLEAR` | `com.4enext-owlbear/roll-clear` | 同上 |
| `CH_ROLL_SAVED` | `com.4enext-owlbear/roll-saved` | common.js / background.core.js / dice-page.js |
| `KEY_ROLLS` | `com.4enext-owlbear/rolls` | 房间数据：`{ v, updatedAt, seq, rows }` |
| `ROLL_MAX_ROWS` | 40 | dice-core.js / common.js / background.core.js 三处一致 |

* **只有城主能写房间数据**（Owlbear 的限制），所以玩家投掷只广播、不写；城主客户端的后台落笔后广播 `CH_ROLL_SAVED`。
* **合并幂等**：同 `rollId` 不重复插（重复广播只回一条 `CH_ROLL_SAVED`，不重复写房间数据）；按 `ts` 倒序；封顶 40。
* **40 条封顶 = 超出自动删最旧**（v1.7.0 明确写下并加了断言）：合并时先 `push` 新行、按 `ts` **倒序**排，
  再 `slice(0, 40)` —— 被切掉的就是 `ts` 最小的尾巴，也就是**最旧的那条**。
  `assets/dice-core.js` 的 `mergeRollRows`、`assets/background.core.js` 的 `rollMerge`、记录窗口的展示合并
  三处行为一致；`dev/test-dice.mjs` 用「41 条 → 剩 40 且最旧的那条没了」钉死。
  （不是「只截断显示、数据还留着」：写进房间数据的 `rows` 本身就只有 40 条。）
* **容量**：`label` 40 字、`expression` 200 字、单条最多 30 颗骰（超出截断并标 `truncated`）；
  写入前若 `JSON.stringify` 超过 12000 字符（16 KB 的 75%）就先砍一半旧行。
* **城主不在线**：1.2 秒内没等到落库 → 本机暂存（`4enext/dice/local`，最多 20 条）+ 顶部黄条
  「城主不在线：本次结果只在本机」；重新打开窗口会把暂存行一起显示出来。
* **清空**：只有城主能做（二次确认）；玩家点了给 WARNING，不静默。

## 7. 本机存储

| 键 | 内容 |
| --- | --- |
| `4enext/dice/combos` | `{ v:1, combos:[{ id, name, expr }] }`，最多 30 条，只存本机 |
| `4enext/dice/last` | 上一次掷过的规范化公式（「上一次」按钮） |
| `4enext/dice/local` | 城主离线时的本机暂存（最多 20 条） |

全部 `try/catch`（iframe 里 localStorage 可能被禁）；写失败只影响记忆，不影响掷骰。

## 8. 4E 预设（`dice-4e.js`）

数据全部来自 `glance.js` 的 `deriveGlance` / `initiativeBonus`：

| 组 | 表达式 | 来源 |
| --- | --- | --- |
| 攻击 | `1d20 + attacks[].total` | `glance.attacks`（已含半等级 + 属性 + 职业 + 擅长 + 专长 + 增强） |
| 伤害 | `damages[].dice + damages[].total` | `glance.damages`（武器骰 + 属性 + 专长 + 增强） |
| 豁免 | `1d20` | 4E 标准（≥10），**不判定**，所以不加任何值 |
| 技能 | `1d20 + skills[].total` | `glance.skills`（17 项，受训已含 +5） |
| 先攻 | `1d20 + initiativeBonus` | 与先攻条同一口径 |
| 防御参考 | AC / 强韧 / 反射 / 意志 | `glance.defenses`，**只显示数值**，不做命中判定 |

界面：选中一枚**已绑定角色卡**的 token 时才出现（动态 import `dice-4e.js`，无绑定卡不加载 190 KB 规则）；
点预设只是把公式填进表达式框，还是要点「投掷」。

## 9. 窗口尺寸

`WINS.dice = { width: 760, height: 620 }`（v1.4.0 是 660×560，两栏放不下）。
打开前仍走 `winSize()`：宽高 ≤ 视口 − 2×`WIN_MARGIN(16)`，所以 1366×768 的笔记本上就是 760×620，
更小的屏幕会按比例缩到视口内；窗口位置按窗口名记在 `4enext/win-pos`。

## 10. 自测

```bash
node dev/test-dice.mjs    # 骰子纯函数：解析 / 掷骰 / 重击 / 归一化 / 合并 / 预设 / 常量 / 尺寸
node dev/selftest.mjs     # 5/5：check + test-background + test-initiative + test-track + test-dice
node dev/check.mjs        # 静态断言：文件、id、频道、上限、无优势劣势/暗骰/示例框、760×620、文档
```

另外 `dev/test-background.mjs` 用假 OBR 跑真实后台：投两次同 `rollId` → 只落一条；`d600` 的 601 → 600；
45 次投掷 → 房间数据 40 条且最新在前；角色切成 PLAYER → 不写房间数据；城主清空 → `rows = []`。
而 `test-dice.mjs` 的第 9 节用**假 OBR + 假 DOM** 把 `dice-page.js` 真跑一遍（初始化、点投掷、战斗优势 +2），
所以页面脚本的「点了没反应」类错误也能在 `node` 里被抓住。

`test-dice.mjs` 覆盖（无浏览器、无 OBR、不启动任何 GUI）：

1. `parseExpr("1d20+12")` 结构 + `formatExpr` 幂等；
2. `adv(1d6)+adv(1d4)` → 2 个独立 segment；
3. `-1d4` 的 count = −1、总和取负；
4. `max(1d6,4)` 抬到 4 且保留 `originalValue`；loser 不参与 clamp；
5. `resetmin(1d20,2)` 命中重掷一次（注入 rand）；
6. `burst(1d6)` 掷 6 连炸 5 次、`burstParent` 链正确；
7. `repeat(3,1d6+2)` → 每行 3、total 9；
8. `computeTotal` 三端一致；
9. 旧形状 `rolls:[3,19]` → 2 颗 d20；无 `rollId` 丢弃；
10. `d600` 的 601 夹到 600（不是 20）；
11. 4E 预设五组都用 glance 的 total，`dice-4e.js` 不含 `10 + half`；
12. 载荷没有 `hit` / `target`（不做命中判定）；
13. 合并幂等 / 倒序 / 40 封顶；
14. 40 条最坏样例 11631 字符 < 12000；
15. `CH_ROLL` / `CH_ROLL_CLEAR` / `CH_ROLL_SAVED` / `KEY_ROLLS` 两端逐字一致、`ROLL_MAX_ROWS` 三处 40；
16. 窗口 760×620 在 1366×768 下 = 760×620（≤ 视口 − 32）；
    + 重击 `2d6+3` 全取 6、total 15；带 `adv` 时退化并提示；
    + 战斗优势 +2 / −2 可逆且进 modifier；
    + 总和不含判定（target / hit 被 normalizeRoll 丢掉）。

## 11. 已知限制

1. **没有真机联调**：开发环境无法启动 Owlbear 房间 / 浏览器（沙箱会崩），所以只做了纯函数自测 + 假 OBR 冒烟 +
   静态检查。UI 的观感（两栏滚动、chip 换行）需要真机确认。
2. **城主不在线时结果不共享**：本机暂存只是「别丢」，不会在城主回来时自动补交（要不要补交是 P4 的事）。
3. **重击与包裹表达式互斥**：`adv(...)` / `max(...)` 等无法逐颗取满，会退化为普通投掷并提示；
   想要「重击且取满」，请直接用平铺伤害公式（`2d6+9`），面板会标「重击 · 已取满」。
4. **没有皮肤**（P4 只做了一半）：`DIE_SIZE_FACTOR` 等常量在 `dice-core.js`。
   **动画**已在 v1.7.0 实现（见 [`docs/dice-v17.md`](dice-v17.md)），皮肤仍然不做。
5. **不做骰值真伪校验**：假设同桌可信，只校验形状与范围（类型 / 数值夹取 / 长度截断 / rollId 必填）。
6. **豁免不判定**：4E 的 ≥10 只是按钮文案里的「1d20」，插件不显示成功 / 失败（用户拍板）。
