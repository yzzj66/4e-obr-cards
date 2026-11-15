# 骰子规格（v1.5.0：复刻 Full Suite dice + 4E 化）

> **本文档用途**：让另一个开发者**照着就能写**。所有结论都来自真实源码，关键处标注 `文件:行号`；
> 布局给公式，交互给条件，数据给 JSON 结构与容量上限，最后给分阶段步骤与风险。
>
> **证据来源**：`https://github.com/FullPeople/obr-suite`（分支 `main`，2026-11-15 用 GitHub API / raw 抓取）。
> 行号对应该次抓取：`src/modules/dice/index.ts` 1495 行、`panel-page.ts` 3656 行、`effect-page.ts` 1877 行、
> `history-page.ts` 937 行、`dice-skins.ts` 464 行，以及 `types.ts` / `fixed-roll.ts` / `history-policy.ts` / `context-menu.ts`。
> 参考实现的 UI 在仓库根：`dice-panel.html`（43.8 KB）、`dice-effect.html`（13.9 KB）、`dice-history.html`（18.4 KB）。
> 参考实现的窗口尺寸在 `public/manifest.json` 的 `action`（380 × 620）。
>
> 本地插件证据：`assets/background.core.js`、`assets/common.js`、`assets/window.js`、`assets/glance.js`、
> `dice.html`、`assets/dice-page.js`、`manifest.json`、`assets/ui.css`。
>
> **本次任务边界**：只写本文件，**没有改任何代码**。

---

## 0. 一页结论（先看这个）

### 0.1 参考实现的真实架构：不是「一个面板」，而是 2.5 个半

| 半 | 文件 | 职责 | 源码证据 |
| --- | --- | --- | --- |
| 视觉半 | `src/modules/dice/effect-page.ts`（76.8 KB） | 全屏 modal 里画骰子抛掷、数字滚动、总和冲刺 | `index.ts:486-574` 打开 modal；`effect-page.ts` 是独立 iframe |
| 面板半 | `src/modules/dice/panel-page.ts`（146.6 KB） | 骰子按钮 / 表达式 / 组合 / 历史 / 皮肤 四个 tab + 投掷管线 | `dice-panel.html` 的 `.tabs` 与 `#diceRow` |
| 历史半（0.5） | `src/modules/dice/history-page.ts`（41 KB） | 右下角小 popover，收到广播就插一行 | `index.ts:356-414` 与 `HISTORY_W/H` |

数据通过 **broadcast 频道**在这三者之间流动；`index.ts` 是常驻背景模块，`panel/effect/history` 是 iframe 页面。
`index.ts` 顶部注释把这件事写得很明白（`index.ts:31-46`）：

```
//   1. Visual: BROADCAST_DICE_ROLL → fullscreen modal (effect-page.ts)
//   2. UI: A left-rail OBR Tool ("Dice") ... popover panel (dice-panel.html)
```

### 0.2 保留 / 删除 / 新增（本插件的决定）

| 类别 | 内容 | 依据 |
| --- | --- | --- |
| **保留并复刻** | d4/d6/d8/d10/d12/d20/d100；表达式（`2d6+1d20+5` 与全部 wrapper）；组合保存；历史；皮肤；**目标总数 TN**；**团队共享** | `_roadmap-v13.md:32-38` |
| **删除** | 优势 / 劣势按钮；暗骰 + 全局暗骰；示例框；`tags.ts` 的 5etools 标签与 `context-menu.ts` 的可点击 `.rollable` 菜单 | `_roadmap-v13.md:33` |
| **新增** | **「战斗优势 +2」按钮**（一次点击给公式 `+2`）；**4E 预设**（攻击 vs 四防 / 伤害 / 豁免 d20≥10 / 技能 / 先攻）；**命中判定 = total ≥ TN** | `_roadmap-v13.md:34-35` |
| **建议后置** | 全屏抛掷动画（P4）、皮肤（P4）、DM 固定结果（不做） | 见 §7 分阶段 |

> **重要判断**：表达式**语法层**保留 `adv(1d20[,N])` / `dis(...)` / `same(...)` / `burst(...)` / `max/min/reset*` / `repeat(N,...)` 全部实现，
> **只是不提供优势/劣势按钮**。理由：① 实现成本为零（照抄即可）② 玩家手敲或粘贴旧公式仍能用 ③ 以后加回按钮不用重写解析器。
> 证据：`panel-page.ts:253-281` 的语法注释与 `readWrapperHead` 实现。

---

## 1. 数据契约（照抄这一节就能互通）

### 1.1 广播频道

参考实现的频道常量（**逐字**抄，别改名，`index.ts:48-156`）：

| 常量 | 字面值 | 方向 | 用途 |
| --- | --- | --- | --- |
| `BROADCAST_DICE_ROLL` | `com.obr-suite/dice-roll` | LOCAL + REMOTE | 一次投掷（视觉 + 历史都听它） |
| `BC_DICE_FORCE_CLEAR` | `com.obr-suite/dice-force-clear` | LOCAL + REMOTE | 「强制结束」：关掉所有动画 modal |
| `BC_DICE_CLEAR_ALL` | `com.obr-suite/dice-clear-all` | LOCAL + REMOTE | 「清除」：只清本人掷的骰子 |
| `BC_DICE_FADE_START` | `com.obr-suite/dice-fade-start` | LOCAL | 动画到达高潮 → 面板解锁按钮 |
| `BC_QUICK_ROLL` | `com.obr-suite/dice-quick-roll` | LOCAL | 别处（卡/怪物）请求一次简单投掷 |
| `BC_PANEL_TOGGLE` | `com.obr-suite/dice-panel-toggle` | LOCAL | 打开面板并预填表达式 |
| `BC_DICE_PANEL_FILL` | `com.obr-suite/dice-panel-fill` | LOCAL | 二次预填（热 iframe） |
| `BC_DICE_HISTORY_STATE` | `com.obr-suite/dice-history-state` | LOCAL | 历史 popover 开/关状态 |
| `BC_DICE_HISTORY_DISMISS` | `com.obr-suite/dice-history-dismiss` | LOCAL | 手动关历史 |
| `BC_DICE_HISTORY_AUTO_CLOSE` | `com.obr-suite/dice-history-auto-close` | LOCAL | 历史自己请求关闭 |
| `BC_DICE_HISTORY_FILTER` | `com.obr-suite/dice-history-filter` | LOCAL | 点历史某行 → 面板按玩家过滤 |
| `BC_DICE_HISTORY_REVEAL` | `com.obr-suite/dice-history-reveal` | LOCAL | 动画飞进历史后「此刻才落库」 |
| `BC_DICE_REPLAY` | `com.obr-suite/dice-replay` | LOCAL + REMOTE | 重放某次投掷（气泡） |

**本插件要用的最小集**（命名空间换成 `com.4enext-owlbear`，见 `assets/common.js:4-55` 的 `NS` 约定）：

```js
// 建议追加在 assets/common.js 的常量区（与现有 CH_* 同风格）
export const CH_ROLL       = NS + "/roll";        // 一次投掷（LOCAL + REMOTE）
export const CH_ROLL_CLEAR = NS + "/roll-clear";  // GM 清空全桌历史（REMOTE）
export const CH_ROLL_SAVED = NS + "/roll-saved";  // GM 已写入房间数据（附 seq，用于对齐）
export const KEY_ROLLS     = NS + "/rolls";       // 房间数据：团队共享的投掷记录
```

### 1.2 投掷载荷（DiceRollPayload）

参考实现的字段（`index.ts:192-226`，**这些名字就是协议**）：

```ts
export interface DiceRollPayload {
  visibility?: DiceHistoryVisibility; // 'all'|'self'|'gm'|'players'（本插件删）
  itemId: string | null;   // 锚定的 token；null = 视口中心
  dice: DieResult[];       // 每一颗骰子的真实结果
  winnerIdx: number;       // -1 = 无特定「赢家」（面板投掷）；>=0 = 该索引放大
  modifier: number;        // 平铺加值
  label: string;           // 备注（"命中" / 武器名）
  expression?: string;     // 规范化后的公式文本，历史里原样显示
  total: number;           // 缓存的总和（见 §2.5 公式）
  rollerId: string;
  rollerName: string;
  rollerColor: string;     // 默认 '#5dade2'（index.ts:1425）
  rollId: string;          // 去重键 + modal id 后缀
  ts: number;
  hidden?: boolean;        // 本插件删（暗骰）
  autoDismiss?: boolean;   // 动画高潮后自动关（先攻用）
  rowStarts?: number[];    // repeat(N,...) 的行起点
  sameHighlight?: boolean; // same(...) 的重复值脉冲
  collectiveId?: string;   // 多目标一次投掷共享的组 id
}
```

单颗骰子（`types.ts`，**每个可选字段都影响动画/历史/总和**）：

```ts
export interface DieResult {
  type: DiceType | string;  // "d20" 或自定义 "d600"
  value: number;
  loser?: boolean;          // adv/dis 被丢弃：动画 0.3 透明度、总和跳过
  originalValue?: number;   // max/min/reset 替换前的原值 → 显示 "3(1)"
  burstParent?: number;     // burst 链：触发它的父骰在数组里的下标
  subtract?: boolean;       // "1d20-1d6" 的 d6：总和减、动画半透明 + "−"
}
```

**本插件 4E 扩展字段**（新增，向后兼容：没有就按旧行为）：

```json
{
  "v": 1,
  "target": 28,            // 目标总数 TN（攻击 vs AC、豁免 10、技能 DC…）；null = 无目标
  "hit": false,            // total >= target 的判定结果（有 target 时才写）
  "cardId": "c-xxxx",      // 若来自绑定的角色卡（复用 com.4enext-owlbear/cardId）
  "mode": "attack"         // attack | damage | save | skill | init | free
}
```

### 1.3 归一化（接收方必须做）

所有接收方都调 `normalizePayload()`（`index.ts:1321-1387`），它做了 4 件必须照做的事：

1. **兼容旧形状**：`dice[]` → 否则 `rolls: number[]` → 否则 `value: number`（都当 d20）；
2. **夹取数值**：`value = clamp(die.value, 1, sidesOf(die.type))` —— 注意用 `sidesOf()` 而不是 `DIE_SIDES[type]`，
   否则自定义 d7/d600 会被夹到 20（源码注释专门记录了这个 bug，`index.ts:1332-1335`）；
3. **没有 `rollId` 就丢弃**（`index.ts:1355`）—— 去重和 modal id 都靠它；
4. **`total` 缺失时按同一公式重算**，保证「广播端 / 动画端 / 历史端」永远一致（`index.ts:1361-1366`）。

```ts
const total = dice.filter(d => !d.loser)
                  .reduce((a, d) => a + (d.subtract ? -d.value : d.value), 0)
              + modifier;
```

### 1.4 去重（三个地方，别只做一个）

| 位置 | 键 | 窗口 | 源码 |
| --- | --- | --- | --- |
| 收广播 → 开动画 | `rollId` | 30 000 ms，模块级 Map（不是 setup 内），>400 条时清过期 | `index.ts:248-250`、`index.ts:704-712` |
| 快速投掷请求 | 表达式 / label / itemId / adv / crit / hidden / collectiveId 拼成一个串 | 250 ms | `index.ts:951-1002` |
| 历史落库 | `rollId` | 永久去重 + 按 `ts` 倒序 + 上限 100 | `history-policy.ts:21-31` |

> 为什么 dedupe 的 Map 必须在**模块作用域**：源码注释记录了「DM 端骰子播两次」的真实 bug ——
> `setupDice` 被调用两次时，函数内的 Map 各存一份，旧监听器还活着（`index.ts:241-250`）。

```ts
const seenRollsModuleScope = new Map<string, number>();
const ROLL_DEDUPE_MS = 30_000;
```

### 1.5 存储键一览

| 存储 | 键（参考实现） | 内容 | 源码 |
| --- | --- | --- | --- |
| localStorage | `obr-suite/dice/combos` | `{version:2, combos:[{id,name,expr,category?}], categoryOrder:[]}` | `panel-page.ts:107-127`、`203-237` |
| localStorage | `obr-suite/dice/history:<roomId>` | 投掷数组；**按房间隔离** | `panel-page.ts:50-58` |
| localStorage | `obr-suite/dice/last-expr` | 「上一次」按钮用的表达式 | `panel-page.ts:59`、`248-251` |
| localStorage | `obr-suite/dice/fixed-next` | DM 固定结果 `{value, armedAt}`（本插件不做） | `fixed-roll.ts:27-60` |
| player metadata | `com.obr-suite/dice/skins` | `Partial<Record<DiceType,{url,mime}>>` | `dice-skins.ts:27-39` |
| player metadata | `com.obr-suite/dice/skin-library` | `{v:2, libs, random, sets}` | `dice-skins.ts:28`、`41-52` |

为什么皮肤要 localStorage 双写：`OBR.player.setMetadata` 是**按房间**的，换房间就丢；
参考实现让 localStorage 当「本人」的真相源，OBR 当「队友看得见」的投影（`dice-skins.ts:119-137`）。

**本插件对应键**：

```js
export const LS_DICE_COMBOS = "4enext/dice/combos";   // {v:1, combos:[...]}
export const LS_DICE_LAST   = "4enext/dice/last";     // 上次表达式
export const LS_DICE_LOCAL  = "4enext/dice/local";    // GM 离线时的本机暂存（最多 20 条）
export const KEY_DICE_SKINS = NS + "/dice-skins";     // 玩家元数据（P4 才用）
```

### 1.6 团队共享：房间数据 com.4enext-owlbear/rolls

路线图要求「GM 汇总写房间数据 + 广播，玩家只读」（`_roadmap-v13.md:37`、`:51`）。
Owlbear 的房间数据**只有 GM 能写**（与先攻同一限制，见 `docs/initiative-v13.md` §4），所以：

```json
// room.metadata["com.4enext-owlbear/rolls"]
{
  "v": 1,
  "updatedAt": 1730000000000,
  "seq": 42,
  "rows": [
    {
      "rollId": "1730000000000-123456",
      "ts": 1730000000000,
      "rollerId": "user-abc",
      "rollerName": "申比软软",
      "rollerColor": "#7fe07f",
      "label": "攻击 · 长剑",
      "expression": "1d20+12",
      "dice": [{"type":"d20","value":14}],
      "modifier": 12,
      "total": 26,
      "target": 28,
      "hit": false,
      "mode": "attack",
      "cardId": "c-xxxx",
      "itemId": "token-id"
    }
  ]
}
```

**容量预算（必须算，超了会被 OBR 拒绝）**：房间数据上限 16 KB（与先攻文档同口径）。
一条裸投掷约 **150–190 字节**（1 颗骰子）/ **220–260 字节**（4 颗骰子 + 中文标签）。
→ **`rows` 封顶 40 条**（≈ 8–9 KB，留一半给卡片数据），按 `ts` 倒序裁剪；`label` 截断到 40 字，
`expression` 截断到 200 字，`dice` 超过 30 颗时只留前 30 + `truncated:true`。

**写入方**（与本插件先攻完全同构）：

| 动作 | 谁做 | 写哪儿 |
| --- | --- | --- |
| 投掷 | 任何人 | 广播 `CH_ROLL`（LOCAL + REMOTE），**自己不写房间数据** |
| 落库 | **GM 客户端**（后台或 GM 的骰子窗口） | `room.setMetadata({[KEY_ROLLS]: …})`，然后广播 `CH_ROLL_SAVED {seq}` |
| 清空 | GM | 写空 `rows` + 广播 `CH_ROLL_CLEAR` |
| GM 离线 | 玩家 | 追加到 `LS_DICE_LOCAL`，顶部提示「城主不在线，本次结果只在本机」 |

**合并规则**（GM 侧，必须幂等）：

```js
function mergeRoll(rows, incoming) {
  if (!incoming || !incoming.rollId) return rows;
  if (rows.some(r => r.rollId === incoming.rollId)) return rows;       // 幂等
  return [incoming, ...rows].sort((a,b) => b.ts - a.ts).slice(0, 40);  // 倒序 + 封顶
}
```

> 参考实现的同款规则在 `history-policy.ts:21-31`：过滤坏行 → 按 `rollId` 去重（**隐藏→公开算进步，不倒退**）→
> 按 `ts` 倒序 → `slice(0, 100)`。本插件把 100 降到 40 是为了房间数据容量，不是行为差异。

## 2. 表达式语法（4E 只需要其中 6 个）

### 2.1 语法表

来源：`panel-page.ts:253-281` 的注释 + `readWrapperHead`（`panel-page.ts:414-473`）。

| 形式 | 语义 | 参数约束 | 4E 是否用 |
| --- | --- | --- | --- |
| `NdM` / `+5` / `-1d6` | 平铺和；**负数骰**表示「减骰」（真实掷出、总和减、动画半透明） | `2 ≤ M ≤ 1000`（`panel-page.ts:338`） | ✅ 核心 |
| `adv(inner[,N])` / `dis(inner[,N])` | 把 inner 掷 `N+1` 次，取和最大/最小的一组，其余标记 `loser` | 顶层最后一个逗号后的纯数字；`N>0` | ⚠️ 只留语法，不给按钮 |
| `max(inner,X)` / `min(inner,X)` | 每颗骰子抬到 ≥X / 压到 ≤X，原值写 `originalValue` | 顶层最后一个逗号后是整数（可负） | ✅（roadmap 要求 max/min） |
| `reset(inner,X)` / `resetmin` / `resetmax` | 命中条件时**重掷一次**；`reset` 是等于 X，`resetmin` 是 ≤X，`resetmax` 是 ≥X | 同上 | ✅ 建议保留（4E「重掷」威能常用） |
| `burst(inner)` | 每颗掷出最大面的骰子追加一颗同类型骰（**最多 5 连**） | 无参数 | ⭕ 可选 |
| `same(inner)` | 纯视觉：重复点数脉冲高亮，不改数值 | 无参数 | ⭕ 可选 |
| `repeat(N,inner)` | inner 跑 N 次，视觉上一行一次，各自算行总和 | `1 ≤ N ≤ 20`（`panel-page.ts:466`）；**必须是最外层且独占整条表达式** | ⭕ 可选 |

### 2.2 数据结构（照抄）

```ts
interface ExprGroup { type: string; count: number }          // count 可为负 = 减骰
interface PlainExpr  { groups: ExprGroup[]; modifier: number }
type WrapperKind = "adv"|"dis"|"max"|"min"|"reset"|"resetmin"|"resetmax"|"same"|"burst"|"repeat";
interface Wrapper    { kind: WrapperKind; param?: number }    // adv/dis: 组数；max/min/reset*: X；repeat: N
interface ParsedSegment { plain: PlainExpr; wrappers: Wrapper[] } // wrappers 内层在前
interface ParsedExpr {
  segments: ParsedSegment[];   // 每个被 wrapper 包住的独立子表达式
  outerPlain: PlainExpr;       // 所有 wrapper 外面的骰子 + 加值（只掷一次）
  plain: PlainExpr;            // 兼容旧调用（只有一个 segment 时等于它）
  wrappers: Wrapper[];
}
```

关键设计（**别自己发明**）：`adv(1d6)+adv(1d4)` 必须解析成**两个独立 segment**，
各自掷各自的两次，而不是把 d6 和 d4 一起掷两次（`panel-page.ts:297-300` 的注释）。

### 2.3 解析流水线（可直接翻译成 JS）

```ts
const TERM_RE = /([+\-]?)(?:(\d*)d(\d+)|(\d+))/gi;

parseExpr(raw):
  1. s = normalizeExpr(raw)     // 全角（）→ ()，全角，→ ,，去掉所有空白（panel-page.ts:321-327）
  2. return finalizeParse(parseExprInner(s))

parseExprInner(s):
  segments = []; outer = {groups:[], modifier:0}
  for term of splitTopLevel(s):            // 按「深度 0 的 +/-」切成带符号的项
     head = readWrapperHead(term.body)     // 项首是不是 FUNC( … ) ? 深度匹配右括号
     if head:
        inner = parseExprInner(head.inner)
        if inner.outerPlain 非空: segments.push({plain: sign*inner.outerPlain, wrappers:[head.wrapper]})
        for seg of inner.segments: segments.push({plain: sign*seg.plain, wrappers:[...seg.wrappers, head.wrapper]})
        if head.tail: outer += parsePlain(sign*head.tail)   // "adv(1d20)+5" 的 +5
     else:
        outer = merge(outer, parsePlain(sign + term.body))
  return {segments, outerPlain: outer}

finalizeParse: 丢掉空 segment；只有一个 segment 时回填 plain/wrappers，否则 plain 为空
```

三个必须照抄的细节：

1. `splitTopLevel` 是**深度感知**的（`panel-page.ts:384-407`）：`adv(1d6)+adv(1d4)-2` → 3 项，
   括号内的 `+` 不算；开头单独的 `-` 决定第一项的符号。
2. `readWrapperHead` 用 `topLevelLastComma` / `topLevelFirstComma` 找参数（`panel-page.ts:357-378`）：
   `max(1d6+2,3)` 的 X 是**最后一个顶层逗号**后的 `3`，前面的 `1d6+2` 是 inner；
   `repeat(3,1d6+2)` 的 N 是**第一个**顶层逗号前。
3. **符号要穿透**：`-adv(1d4)` 必须把 inner 的骰子数量和加值一起取反（`negatePlain`，`panel-page.ts:477-485`），
   否则 `-adv(1d4)` 会被当成正数。

### 2.4 掷骰算法（含 adv/dis、burst、clamp）

```ts
rollExpr(plain, wrappers):              // wrappers 内层在前
  if wrappers 空: return {dice: rollPlainSet(plain), winnerIdx: -1}
  outer = wrappers[last]; inner = wrappers[0..last-1]

  if outer.kind 是 adv/dis:
     sets = [rollExpr(plain, inner) 重复 (outer.param ?? 1) + 1 次]
     win  = argmax(sum) / argmin(sum)          // adv 取大、dis 取小；同分保留第一个
     把非 win 组的每颗骰子标 loser:true，按组顺序拼进 dice
     winnerIdx = 只有当 win 组只有 1 颗骰子时 = 前面各组骰子数之和，否则 -1
     return

  其余：先 r = rollExpr(plain, inner)，再按 outer.kind 变换：
     max/min/reset*/: dice = dice.map(d => applyValueClamp(d, kind, X))   // loser 不动
     burst:  对每颗非 loser 骰子，while (value === sides && chain < 5) 追加同类型新骰，burstParent = 父下标
             （burst 会插入新骰 → winnerIdx 归零为 -1）
     same:   纯视觉，不改
```

`applyValueClamp` 的 5 种语义（`panel-page.ts:821-843`）**务必按名字区分**，别把 max 当 min：

| kind | 触发 | 结果 |
| --- | --- | --- |
| `max(d,X)` | 总是 | `value = Math.max(value, X)`（**下限**） |
| `min(d,X)` | 总是 | `value = Math.min(value, X)`（**上限**） |
| `reset(d,X)` | `value === X` | 重掷一次，用新值 |
| `resetmin(d,X)` | `value <= X` | 重掷一次 |
| `resetmax(d,X)` | `value >= X` | 重掷一次 |

改过值就写 `originalValue: d.originalValue ?? d.value`（动画显示 `3(1)` 靠它）；
`loser` 的骰子**不参与**任何 clamp（保持被丢弃时的原样，`panel-page.ts:826`）。

### 2.5 总和公式（三处必须一致）

```ts
// 单次投掷（panel-page.ts:2325-2332 / index.ts:1448-1451 同口径）
kept   = dice.filter(d => !d.loser)
base   = kept.reduce((a,d) => a + (d.subtract ? -d.value : d.value), 0)
total  = base + modifier * (repeat 行数 > 0 ? 行数 : 1)   // repeat 的加值按行各算一次
// 每一行（repeat）：rowTotal = Σ(该行 kept，减骰取负) + modifier
```

### 2.6 编辑器的三个动作（按钮点一下就靠它们）

| 动作 | 实现 | 源码 |
| --- | --- | --- |
| 点某颗骰子 +1 / 右键 −1 | 改 `outerPlain` 里该类型的 `count`；count 归 0 就删组，负数保留（= 减骰） | `adjustExprForType` `panel-page.ts:1010-1037` |
| 加值 ±1 | `outerPlain.modifier += delta` | `adjustExprModifier` `panel-page.ts:1044-1058` |
| 徽标数字 | 遍历 segments + outerPlain 累加 count，写到按钮 `data-count`，CSS 用 `[data-count]:not([data-count="0"])` 显示 | `refreshBadges` `panel-page.ts:1082-1100` |

**4E「战斗优势 +2」按钮 = 直接复用 `adjustExprModifier(+2)`**：

```js
// 点一下 → 公式末尾 +2；再点一下 → −2（可逆，避免用户点错只能清空）
btnAdvantage.addEventListener("click", () => {
  adjustExprModifier(btnAdvantage.classList.toggle("on") ? +2 : -2);
  refreshBadges();
});
```

### 2.7 规范化输出（历史里显示的就是它）

`formatExpr`（`panel-page.ts:787-806`）把结构拼回字符串：segments 依序 + outerPlain，
用 ` + ` 或 ` - ` 连接；`formatPlain` 对负 count 输出 ` - 1d4`（不是 `+ -1d4`，
`panel-page.ts:735-752`）。**历史 / 广播里的 `expression` 用这个规范化结果**，不是用户原始输入。

---

## 3. UI：骰子窗口（dice.html + assets/dice-page.js）

### 3.1 窗口事实（本地已就绪，不要重造）

| 事实 | 值 | 证据 |
| --- | --- | --- |
| 窗口 id | `com.4enext-owlbear/dice-window` | `assets/common.js:21` |
| 窗口地址 | `dice.html` | `assets/common.js:44` |
| 默认尺寸 | **660 × 560**，且 `min(默认, 视口 − 2×16)` | `assets/background.core.js:208`、`220-228` |
| 打开方式 | 工具栏「骰子」→ `openWinOrNotify("dice", …)` | `assets/background.core.js:599`、`513-515` |
| 窗口壳 | `createWindow({name:"dice"})`：拖动 / 位置记忆 / 后台三态 / `feedback()` | `assets/window.js:75-279` |
| 关闭 | `closeSelf(ID_DICE_WIN)` | `assets/window.js:282-287` |
| 当前内容 | 占位「骰子（即将推出）」+ 一个本地 d20 预览 | `dice.html:24-37`、`assets/dice-page.js` |

**结论**：v1.5.0 不需要改 `background.core.js` 的窗口注册（除非要做 GM 落库，那也只是加一个 `OBR.room.setMetadata`），
工作集中在 `dice.html` 的 `.win-body` 与 `assets/dice-page.js`（+ 新的纯函数模块 `assets/dice-core.js`）。

### 3.2 版式（660 × 560，两栏，不用滚动也能看全）

参考实现是 380 × 620 的单列（`public/manifest.json` 的 `action`），本插件窗口更宽更矮，所以改成**左右两栏**：

```
┌───────────────────────────────────────────────────────────┐
│ 标题栏 ⠿  骰子 · 4eNEXT to owlbear   [⌖] [✕]              │  ← win-head（已存在）
├───────────────────────────────────────────────────────────┤
│ 后台状态条（已存在 #bg-strip）                              │
├──────────────────────────────┬────────────────────────────┤
│ 左栏 340px                    │ 右栏 1fr（可滚动）          │
│  ┌ 骰子（7 颗一排）────────┐  │ ┌ 结果（本次投掷）────────┐ │
│  │ d4 d6 d8 d10 d12 d20 d100│ │ │ 26  vs  28   未命中     │ │
│  └─────────────────────────┘  │ │ 1d20(14) + 12           │ │
│  ┌ 表达式 ─────────────────┐  │ └────────────────────────┘ │
│  │ [1d20+12        ] [−][＋]│  │ ┌ 记录（团队共享）───────┐ │
│  └─────────────────────────┘  │ │ 申比软软 攻击 26 未命中  │ │
│  [+2 战斗优势] [目标 28]      │ │ 阿花    伤害 17         │ │
│  [投掷] [上一次] [保存组合]    │ │ …（最多 40 条）         │ │
│  ┌ 4E 预设 ────────────────┐  │ └────────────────────────┘ │
│  │ 攻击 vs AC/强韧/反射/意志│  │                            │
│  │ 伤害 / 豁免 / 技能 / 先攻│  │                            │
│  └─────────────────────────┘  │                            │
├──────────────────────────────┴────────────────────────────┤
│ 状态行（已存在 .win-flash）                                 │
└───────────────────────────────────────────────────────────┘
```

CSS 公式（沿用 `assets/ui.css` 的变量，**不要引入新风格**）：

```css
/* 两栏：左固定、右自适应；容器自身不滚，两栏各自滚 */
.dice-cols { display:grid; grid-template-columns: 340px minmax(0,1fr); gap:12px;
             height:100%; min-height:0; }
.dice-left, .dice-right { min-height:0; overflow-y:auto; overflow-x:hidden; }

/* 七颗骰子一排：等宽格子，格子内是图 + 角标 */
.dice-row { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:6px; }
.dice-btn { position:relative; display:flex; flex-direction:column; align-items:center;
            justify-content:center; gap:2px; padding:8px 0 6px;
            background:var(--bg3); border:1px solid var(--line); border-radius:9px; }
.dice-btn img { width:30px; height:30px; }
.dice-btn .badge { position:absolute; top:3px; right:3px; min-width:16px; height:16px;
                   border-radius:8px; background:var(--red); font-size:10px; font-weight:800; }
/* 只有 count≠0 才显示（等价参考实现的 [data-count]:not([data-count="0"])） */
.dice-btn[data-count="0"] .badge, .dice-btn:not([data-count]) .badge { display:none; }
.dice-btn[data-count]:not([data-count="0"]) .badge { display:flex; }

/* 表达式行：输入框 40px + 两个 36px 的加减按钮 */
.expr-row { display:flex; gap:6px; }
.expr-input { flex:1; min-width:0; height:40px; font:700 15px/1 ui-monospace,Consolas,monospace; }
.expr-row .step { width:36px; height:40px; }
```

参考实现的对应数字（想抄原版时用）：`.dice-row{grid-template-columns:repeat(4,1fr);gap:6px}`、
`.dice-btn img{width:34px;height:34px}`、`.d20-box{grid-column:span 2}`、`.advdis-stack{flex:0 0 70px}`、
`.expr-input{height:46px;font-size:16px}`、`.expr-mod button{width:36px}`、`.body{padding:14px}`（`dice-panel.html` 的 `<style>`）。

### 3.3 骰子按钮交互（逐字复刻）

- **左键 +1，右键 −1**（`dice-panel.html` 的 `title="左键 +1，右键 −1"`；逻辑 `panel-page.ts:1010-1037`）；
- 右键在「没有该类型条目」时**也能加出 `-1dX`**（负 count 的减骰），这是 2026-05-10 的行为修正，
  注释写明了旧行为是「count ≤ 0 就静默丢弃」（`panel-page.ts:1016-1021`）；
- 角标显示**全表达式**里该类型的净数量（segments + outerPlain 累加，`panel-page.ts:1082-1100`）；
- 点骰子按钮**不会自动投掷**，只是改表达式 —— 4E 版保持「先组公式、再按投掷」的节奏。

### 3.4 投掷管线（performRoll）

照抄 `panel-page.ts:2796-2883` 的顺序，**顺序本身是规格**：

```ts
1. if (isAnimating) { 摇按钮 + 提示"动画未结束"; return }        // 防连点
2. parsed = parseExpr(expression)
   if (exprIsEmpty(parsed)) { 摇按钮 + "公式为空/看不懂"; return }
3. targetTokens = 选中且 owned 的 token；空 → 提示"先选一个 token"
4. 记住 lastRolledExpression（"上一次"按钮的数据源），清空输入
5. 镜头先对准 token（广播之前完成）
6. collectiveId = "col-" + Date.now() + "-" + rand
   for (每个目标 token) { dice = 独立掷一次; emitOneRoll(...) }   // 多目标各自独立，不共享点数
7. sent > 0 → 锁按钮 ANIM_FALLBACK_MS = 6000 后自动解锁（动画挂了也不会永久卡住）
```

`emitOneRoll`（`panel-page.ts:2306-2380`）：算 total → 读 `OBR.player.getId/getName/getColor` →
组 payload → `hidden ? LOCAL : (LOCAL + REMOTE)`。**注意 LOCAL 也要发**，否则投掷者自己看不到
（`panel-page.ts:2371-2376`）。

补充：参考实现的 `getOwnedSelectedTokenIds()` 只认「选中 + IMAGE + CHARACTER/MOUNT 层 +
`createdUserId === 我`」的 token（`panel-page.ts:939-960`）。本插件可放宽成「选中的任意 IMAGE token」
（4E 团里常由 GM 代掷），但要给出明确提示。

### 3.5 4E 预设按钮（这是 4E 化最大的增量）

数据源**必须复用现有推导函数，不要重算公式**：

| 需要的数 | 现有函数/字段 | 证据 |
| --- | --- | --- |
| 半等级 | `deriveGlance(char, rules, live).half` | `assets/glance.js:440-458` |
| 四防数值 | `.defenses[]`，元素 `{key:"ac"/"fort"/"ref"/"will", label, value, parts}` | `assets/glance.js:304-324` |
| 攻击加值 | `.attacks[]`，元素 `{label, ability, total}`（已含半等级+属性+职业+擅长+专长+增强） | `assets/glance.js:371-385` |
| 伤害 | `.damages[]`，元素 `{label, ability, dice, total}`（`dice` 是武器骰如 `"2d6"`） | `assets/glance.js:386-396` |
| 技能 | `.skills[]`，元素 `{name, ability, trained, total}`（训练 +5 已含） | `assets/glance.js:351-360` |
| 先攻 | `initiativeBonus(char)` → `mod(dex) + half + custom` | `assets/glance.js:225-234` |
| 绑定卡 | `getItemBinding(itemId)` / token metadata `com.4enext-owlbear/cardId` | `assets/common.js:287-296`、`:8` |

**加值口径（4E = 半等级 + 属性调整 + 训练），源码就是这一行**（`assets/glance.js:358`）：

```js
total: mods[s.ability] + half + (trained ? 5 : 0)
       + (cls.versatile && !trained ? 1 : 0) + n0(sm.race) + custom - pen
```

攻击加值同口径，还额外叠加职业/擅长/专长/增强（`assets/glance.js:383`）：

```js
total: half + mods[r.ability || "str"] + n0(r.classBonus) + prof + n0(r.feat)
       + enhanceOf(rules, char, enhanceSlot) + sum(customAtk[i])
```

预设生成器（照这个写即可）：

```js
// 攻击：1d20 + 攻击加值；目标 = 四防里的一个
{ mode:"attack", label:"攻击 · " + (atk.label || "近战") + " vs " + def.label,
  expression:"1d20 + " + atk.total, target:def.value }

// 伤害：武器骰 + 伤害加值（4E 伤害不加半等级，glance 已经算对了）
{ mode:"damage", label:"伤害 · " + (dmg.label || "武器"),
  expression:(dmg.dice || "1d8") + " + " + dmg.total, target:null }

// 豁免：d20 ≥ 10 成功（4E 标准豁免，无加值）
{ mode:"save", label:"豁免", expression:"1d20", target:10 }

// 技能：1d20 + 技能总值
{ mode:"skill", label:"技能 · " + sk.name, expression:"1d20 + " + sk.total, target:null }

// 先攻：1d20 + 先攻加值（与先攻模块同一口径）
{ mode:"init", label:"先攻", expression:"1d20 + " + initiativeBonus(char), target:null }
```

**判定显示**：`hit = target != null && total >= target`。
`hit===false` 时结果区用 `--red`，`hit===true` 用 `--green`；豁免额外显示「成功 / 失败」（阈值固定 10）。
**不要**在骰子模块里重新推 `10 + half + …` —— 四防/攻击/技能的公式只在 `glance.js` 一处（先攻文档也是这个原则）。

### 3.6 组合（保存的公式）

数据结构与渲染照抄 `panel-page.ts:107-127`、`1107-1146`：

- `SavedCombo = {id, name, expr, category?}`；`categoryOrder[]` 决定分组顺序；
- 无分类的组合永远排最前（`UNCATEGORIZED_KEY = ""`）；
- 保存组合：默认名字 = 备注，否则 = 规范化表达式（`panel-page.ts:2978-2979`）；
- 组合卡片按钮：**投掷 / 编辑 / 删除**（参考实现还有「重击」，见 §9 决策 D3）。

本插件建议：`localStorage["4enext/dice/combos"] = {v:1, combos:[...]}`，
分组先不做 UI（只保留 `category` 字段），P3 再加排序。

### 3.7 历史（团队共享）

右栏列表直接渲染 `rolls`（房间数据），不照抄参考实现的「双写 localStorage + pending reveal」复杂度。
每行渲染公式（照抄 `chipsHtml` / `buildFormulaInner`，`panel-page.ts:1449-1493`）：

```html
<span class="die-chip crit|fail|loser|subtract">
  <img src="assets/dice/d20.png"><span>14</span>
</span>
<span class="mod">+12</span>
<span class="eq">=</span>
<span class="total">26</span>
```

- `crit`：`value === sidesOf(type)`；`fail`：`value === 1`（`panel-page.ts:1458-1461`）；
- 减骰 `subtract`：数值前缀 `−`，并加半透明类（`panel-page.ts:1462-1464`）；
- `repeat` 行显示 `+mod × N`（`panel-page.ts:1477-1483`）。

---

## 4. 视觉：全屏投掷动画（P4 可选，先记公式以免返工）

### 4.1 打开 modal（逐字）

```ts
await OBR.modal.open({
  id: "com.4enext-owlbear/dice-effect-" + rollId,
  url: EFFECT_URL + "?dtypes=…&dvalues=…&…",
  fullScreen: true,
  hideBackdrop: true,        // 不要黑底
  hidePaper: true,           // 不要白卡片
  disablePointerEvents: true // 骰子不挡鼠标：玩家仍可平移/选中
});
```

证据：`index.ts:559-573`。URL 参数表（`index.ts:535-557`）：

| 参数 | 含义 |
| --- | --- |
| `dtypes` / `dvalues` / `dlosers` / `doriginals` / `dparents` / `dsubtract` | 逗号分隔的并列数组（空串 = 无） |
| `winner` / `total` / `modifier` | 索引 / 总和 / 加值 |
| `label` / `rollId` / `rollerId` / `color` | 文本与身份 |
| `wx` / `wy` | **世界坐标**（不是屏幕坐标），页面每帧自己投影 |
| `hidden` / `autoDismiss` / `rowStarts` / `same` / `itemId` / `skins` | 见 §1.2 |

### 4.2 尺寸与行的布局公式（核心，必须照抄）

```ts
// 1) 基准尺寸：骰子越多越小，最小 72px
BASE_SIZE = N_DICE <= 1 ? 128 : Math.max(72, Math.round(128 * Math.pow(0.86, N_DICE - 1)));
// 2) 每颗骰子按类型系数缩放
DIE_SIZE_FACTOR = { d4:0.78, d6:0.85, d8:0.90, d10:0.93, d12:0.96, d20:1.00, d100:1.06 };
dieSizeFor(type) = round(BASE_SIZE * DIE_SIZE_FACTOR[imgTypeFor(type)]);

// 3) 行距与列间距
gap   = Math.round(BASE_SIZE * 0.16);
rowH  = BASE_SIZE + gap;
PER_ROW = 4;                                   // 每行最多 4 颗（超出换行）

// 4) 居中摆放：以 wrap 原点（token 顶部中心）为 (0,0)
rowCount = max(1, ceil(N_VIS / PER_ROW));       // 或 repeat 的行数
rowW     = Σ 本行每颗 diceSize + gap * (本行颗数 - 1);
cursor   = -rowW / 2;                            // 左边缘（水平居中）
rowOy    = (r - (rowCount - 1) / 2) * rowH;      // 垂直居中
for 每颗: slot = { ox: cursor + size/2, oy: rowOy, size }; cursor += size + gap;
```

证据：`effect-page.ts:194-200`、`278-319`（`recomputeLayout`）；`types.ts` 的 `DIE_SIZE_FACTOR`。

**两个附属元素的定位公式**（`effect-page.ts:600-641`）：

```ts
// 冲刺中的「当前总和」：骰子行上方
runningTotal.top = -BASE_SIZE / 2 - 64;                       // left: 0（水平居中）
// 加值 + 备注盒：最后一行下方
lastRowOy = (rowCount - 1 - (rowCount - 1) / 2) * rowH;        // = (rowCount-1)/2 * rowH
modBox.top = lastRowOy + BASE_SIZE / 2 + 28;
```

### 4.3 屏幕投影（骰子粘在 token 头顶）

```ts
// 世界坐标 → 屏幕坐标；每帧重读 token 位置与 viewport，所以拖动镜头时骰子跟着走
sx = worldX * scale + vp.x;
sy = worldY * scale + vp.y;
root.style.setProperty("--tx", sx + "px");
root.style.setProperty("--ty", sy + "px");
root.style.setProperty("--vp-scale", String(scale));
// token 顶部中心（不是 token 中心）：包含图片高度 / 网格 dpi / scale.y 的换算
halfHeight = (img.height / item.grid.dpi) * sceneDpi * item.scale.y / 2;
worldY = item.position.y - halfHeight;                        // 默认 75
```

证据：`effect-page.ts:747-759`、`index.ts:448-469`。

### 4.4 时间轴（想复刻手感就照这个）

| 阶段 | 时长 | 常量 |
| --- | --- | --- |
| 飞行（4 段抛物线弹跳） | 1200 ms | `FLIGHT_MS` |
| 落地静止（让人读数） | 500 ms | `HOLD_BEFORE_PUNCH_MS` |
| 赢家放大（1 → 1.18 → 1，峰值 45%） | 360 ms | `PUNCH_MS`、`getPunchScale` |
| 二次停留 | 220 ms | `HOLD_AFTER_PUNCH_MS` |
| 淡出 | 320 ms | `EXIT_MS` |
| 数字老虎机 | 每 55 ms 跳一格 | `SLOT_INTERVAL_MS` |

抛物线参数：`N_ARCS = 4`、`r = 0.55`、`t0 = FLIGHT*(1-r)/(1-r^4)`、弧高 `H0 = 240`，
第 i 段高 `H0 * r^(2i)`，位置用 `y + (-h * 4 * t * (1-t))`；挤压/拉伸 `SQUASH 0.18 / STRETCH 0.08`；
总旋转 `ROT_BASE = 720`。证据：`effect-page.ts:355-396`、`652-705`。

**P4 简化方案（强烈建议先做这个）**：不逐帧跟随、不做抛物线，只做 CSS 关键帧：
`translateY(-240px) → 0`（600 ms，`cubic-bezier(.2,.8,.2,1)`）+ `rotate(720deg)` + 数字 55 ms 轮换 +
落地后 `scale(1.18)` 120 ms 回弹，2.6 s 后自动关。**先把结果算对、发对，再谈手感。**

---

## 5. 权限与数据流（一张图）

```
  玩家 A 的骰子窗口                 GM 客户端（后台 / 骰子窗口）
  ┌───────────────┐   CH_ROLL      ┌────────────────────────┐
  │ 掷骰 → payload │ ─────────────▶ │ 校验字段、合并去重       │
  │ 本机立即显示    │ ◀──────────── │ room.setMetadata(rolls) │
  └───────────────┘  CH_ROLL_SAVED └───────────┬────────────┘
                                               │ OBR.room.onMetadataChange
  玩家 B / C 的骰子窗口 ◀──────────────────────┘ 读 rolls → 渲染右栏历史
```

| 操作 | 谁能做 | 写入方 | 失败时 |
| --- | --- | --- | --- |
| 投掷 / 看自己的结果 | 所有人 | 只广播，不写 | 广播失败 → `feedback(..., "ERROR")` |
| 历史落库 | 只有 GM 能写房间数据 | GM 客户端 | GM 不在线 → 本机暂存 + 顶部黄条 |
| 清空历史 | GM | GM 写 + 广播 | 玩家点清空 → 置灰（`data-bg` 由 window.js 管） |
| 组合 / 皮肤（本机） | 所有人 | localStorage / 自己玩家元数据 | 写失败 → 忽略 + `feedback` |

安全边界（写清楚，别过度设计）：本插件假设**同桌玩家可信**；不校验骰值真伪，
只校验**形状与范围**（`type` 匹配 `^d\d+$`、`value` 在 1..sides、`total` 用 §2.5 公式重算、
`label` 截断 40 字、`rollId` 必填）。GM 落库时对不合法条目**丢弃并 console.warn**，不整批失败。

---

## 6. 与参考实现的差异映射表（写代码时对照）

| 参考实现 | 本插件 v1.5.0 | 原因 |
| --- | --- | --- |
| `OBR.action` popover 380 × 620 + 四 tab | 独立窗口 `dice.html` 660 × 560，左右两栏 | v1.3.1 用户要求「分块、各自独立窗口」 |
| `BROADCAST_DICE_ROLL` = `com.obr-suite/dice-roll` | `com.4enext-owlbear/roll` | 命名空间隔离 |
| 优势 / 劣势 / 重击 按钮 | **删优势劣势**；重击见决策 D3 | 4E 无优势骰，战斗优势 = +2 |
| 暗骰 + 全局暗骰（LOCAL only） | 删除（`hidden` 字段保留兼容，恒 `false`） | 路线图明确去掉 |
| 示例框（精灵之准 / 术法爆发） | 删除，换成 4E 预设按钮 | 路线图明确去掉示例框 |
| 历史 popover 右下角 320 × 218（独立 iframe） | 并入骰子窗口右栏 | 少一个 iframe、少一条同步链路 |
| 历史存 localStorage（按房间） | 存**房间数据**（团队共享）+ 本机兜底 | 路线图要求团队共享 |
| 皮肤（玩家元数据 + localStorage 双写） | 保留设计，P4 实现 | 路线图要求皮肤 |
| DM 固定结果（`fixed-roll.ts`） | **不做** | 与 4E 使用场景无关，且属于「暗箱」功能 |
| 5etools `.rollable` 标签 / 快速投掷弹窗 | 不做（骰子模块不碰别的面板） | 职责边界 |
| 音效 `sfx*.ts` | 不做 | 路线图未要求 |

---

## 7. 分阶段实现步骤（每步都能单独验收）

> 原则：**纯函数先行**、UI 在后；每阶段结束 `node dev/selftest.mjs` 必须 exit 0（本仓库既有习惯）。

### P0 数据 + 表达式引擎（0.5 天，无 UI）

**新增** `assets/dice-core.js`（ESM 纯函数，**不 import OBR**，方便 Node 直接测）：

| 导出 | 作用 |
| --- | --- |
| `DICE_TYPES` / `DIE_SIDES` / `DIE_SIZE_FACTOR` | 常量（照 `types.ts`） |
| `parseExpr(text)` / `formatExpr(parsed)` | §2.3 流水线 |
| `rollExpr(parsed)` / `rollPlainSet()` | §2.4 |
| `applyValueClamp()` / `computeTotal(dice, modifier, rows)` | §2.4 / §2.5 |
| `makeRollId()` / `normalizeRoll(raw)` | §1.3 |
| `rollToPayload({...})` | 组装 §1.2 载荷（含 4E 的 `target/hit/mode`） |

**验收**：
- `parseExpr("1d20+12")` → `outerPlain.groups=[{d20,1}], modifier=12`；
- `parseExpr("adv(1d6)+adv(1d4)-2")` → **2 个 segment**，各自 wrappers 长度 1，`outerPlain.modifier = −2`；
- `parseExpr("2d6+1d20+5")` 再 `formatExpr` 回来，字符串稳定（幂等）；
- `max(1d6,4)` 的结果每颗 ≥4 且 `originalValue` 存在；
- `1d20-1d6` 的总和 = d20 − d6（不是相加）；
- `repeat(3,1d6+2)` 的 total = 三行和 + 2×3。

### P1 骰子窗口基础面板（1 天）

**改** `dice.html`：删占位块，加 §3.2 的两栏骨架（`#diceRow` / `#exprInput` / `#btnRoll` / `#btnLast` / `#btnSave` / `#btnAdvantage` / `#tnInput` / `#result` / `#list`）。
**改** `assets/dice-page.js`：保留 `createWindow({name:"dice"})`；接 7 颗骰子按钮、表达式输入、+2、投掷。
**投掷**：先只做「本机结果」——算出 payload，渲染到 `#result`，并 `OBR.broadcast.sendMessage(CH_ROLL, payload, {destination:"LOCAL"})`。

**验收**：点 d20 两次 → 表达式 `1d20` 且角标 2；输入 `2d6+5` → 投掷显示两颗 d6 的点数与总和；
空公式 / 未选 token 时按钮抖动 + `feedback(..., "WARNING")`；660×560 下无横向滚动条。

### P2 团队共享 + 历史（1 天）

**改** `assets/background.core.js`（GM 侧）：订阅 `CH_ROLL` → 校验 → 合并 → `OBR.room.setMetadata({[KEY_ROLLS]: …})` → 广播 `CH_ROLL_SAVED`。
**改** `assets/dice-page.js`：右栏历史读 `OBR.room.getMetadata()[KEY_ROLLS]` + `onMetadataChange` 重渲染；
广播 `CH_ROLL` 改为 LOCAL + REMOTE；非 GM 时展示「城主不在线时结果只在本机」的黄条。
**常量**必须与后台**逐字一致**（本仓库用 `dev/check.mjs` 断言这件事，先攻的 `CH_INIT_REQUEST` 就是这么管的）。

**验收**：两个浏览器窗口（一个 GM）里 A 投掷 → B 立即看到结果、历史多一行；刷新 B → 历史还在；
GM 清空 → 两边都空；玩家点清空 → 按钮禁用 + 提示。

### P3 4E 预设 + 组合 + 战斗优势（1 天）

**新增** `assets/dice-4e.js`：`presetsFor(char, rules)` → §3.5 的 5 类预设（复用 `deriveGlance`/`initiativeBonus`）。
**改** `assets/dice-page.js`：选中已绑定卡的 token 时渲染预设按钮；点预设填表达式 + TN；`+2` 按钮；组合保存/删除/投掷。

**验收**：绑定一张 12 级卡 → 点「攻击 vs AC」得到 `1d20 + 22`（示例值以卡为准）且 TN = AC；
投出 25 vs AC 28 → 显示「未命中」为红色；点「+2」→ 表达式末尾 `+2`，再点回退；
保存组合 → 重启窗口后还在（localStorage）。

### P4 动画 / 皮肤（2 天，可延后）

**新增** `dice-effect.html` + `assets/dice-effect.js`：按 §4.2/§4.3 的公式做「简化动画版」；
皮肤读取（玩家元数据 `KEY_DICE_SKINS`）+ 皮肤选择（右键附件图片 → 设为我的皮肤，需 `OBR.contextMenu.create`）。
**改** `dice-page.js`：投掷后 `OBR.modal.open(...)`，动画结束广播 `BC_DICE_FADE_START` 语义的解锁消息。

**验收**：3 颗骰子横排居中、间距 = `round(BASE_SIZE*0.16)`；镜头缩放后骰子仍贴 token 顶部；
动画期间画布仍可拖动（`disablePointerEvents:true`）；6 s 后按钮自动解锁。

---

## 8. 自测清单（建议写进 dev/test-dice.mjs，无浏览器）

1. `parseExpr("1d20+12")` 结构正确；`formatExpr` 幂等；
2. `adv(1d6)+adv(1d4)` 解析成 2 个 segment（不是 1 个）；
3. `-1d4` 的 `count === -1`，`computeTotal` 减掉点数；
4. `max(1d6,4)`：所有值 ≥4 且 `originalValue` 保留；`loser` 骰不被 clamp；
5. `resetmin(1d20,2)` 命中时重掷一次（用注入的 `rand` 断言）；
6. `burst(1d6)`：掷出 6 时追加一颗，链长 ≤5，`burstParent` 指向前一颗；
7. `repeat(3,1d6+2)`：`total = Σ3 + 2*3`；每行总和各自 +2；
8. `computeTotal` 三处一致：投掷端、广播端、`normalizeRoll` 重算结果相同；
9. `normalizeRoll` 对 `rolls:[3,19]` 的旧形状 → 2 颗 d20；无 `rollId` → 丢弃；
10. `normalizeRoll` 把 `{type:"d600", value:601}` 夹到 600（不是 20）；
11. 4E 预设：`presetsFor` 的 5 个表达式都用 `glance` 的 `total`，没有重复实现公式（grep 断言：`10 + half` 不出现在 `dice-4e.js`）；
12. `hit = total >= target`；`target=null` 时 `hit` 不写；
13. 房间数据合并：重复 `rollId` 幂等、按 `ts` 倒序、封顶 40；
14. 载荷大小：40 条样例 `JSON.stringify(rows).length < 12000`（16 KB 的 75%）；
15. 频道常量一致：`common.js` 的 `CH_ROLL/KEY_ROLLS` 与 `background.core.js` 逐字相同（`dev/check.mjs` 风格）；
16. 窗口尺寸：`winSize` 在 1366×768 下返回 ≤ 1334×736（视口 − 2×16）。

---

## 9. 决策与风险

### 9.1 需要用户拍板的 3 个决策

| 编号 | 决策 | 默认方案（按此实现，除非用户另有指示） |
| --- | --- | --- |
| D1 | 「目标总数」的交互位置 | 表达式下面一个 TN 数字框 + 命中/未命中着色；不自动读四防（用户可能打别的东西） |
| D2 | 4E 豁免阈值 | 固定 10（4E 标准）；不做精英/独狼变体 |
| D3 | 「重击」按钮 | **P1 先不做**；做的话语义是「骰数翻倍」（照参考实现），但 4E 暴击应为「伤害取满」，需用户确认后再决定是否加 `max()` 变体 |

### 9.2 风险表

| 风险 | 影响 | 概率 | 对策 |
| --- | --- | --- | --- |
| 房间数据 16 KB 被卡片 + 投掷挤爆 | 写入失败 → 历史不更新 | 中 | 40 条封顶 + 字段截断 + 写入前 `JSON.stringify().length` 检查，超限先砍一半旧行再写 |
| 玩家投掷时 GM 不在线 | 结果不落库，别人刷新就没了 | **高** | 本机暂存 20 条 + 顶部黄条明确说明；GM 回来时把自己的暂存补交（重发 `CH_ROLL`） |
| 广播风暴 / 重复投掷 | 历史重复、动画播两次 | 中 | `rollId` 30 s 去重（§1.4）+ 250 ms 快速投掷去重 + 按钮 6 s 锁 |
| `localStorage` 在某些 iframe 环境不可写 | 组合/上次公式丢失 | 中 | 全部 `try/catch` + 内存兜底（参考实现每个键都包了 try，`panel-page.ts:203-251`） |
| 660×560 装不下两栏 | 内容被挤 / 双滚动条 | 中 | 两栏各自 `overflow-y:auto`、`min-height:0`；表达式与预设优先，历史可折叠 |
| 皮肤是 webm，体积大 / 跨域 | 卡顿、黑块 | 中 | P4 再做；先只支持静态图 + `mime` 校验；webm 只允许 `video/webm` |
| 动画 modal 挡住鼠标 | 玩家点不到画布 | 高（若做 P4） | `disablePointerEvents:true` + CSS 全局 `pointer-events:none`（参考 `dice-effect.html` 的 `*{pointer-events:none}`） |
| 与并行任务改同一批文件（`background.core.js` / `common.js`） | 冲突 | **高** | 本文档不改代码；P2 开工前确认先攻/窗口任务已合并，常量集中追加在 `common.js` 尾部 |
| 自测没有浏览器 | 只测到纯函数 | 高 | 把 §2 全部放进 `dice-core.js`（无 OBR 依赖），UI 用手工清单（§7 各阶段验收） |
| 误读 `adv(1d20)+adv(1d4)` 的语义 | 两段各自掷，不是一起 | 中 | §2.2 明确；自测第 2 条钉死 |

### 9.3 明确不做的事

- 不做暗骰 / 隐藏投掷（`hidden` 只是兼容字段，恒 `false`）；
- 不做 DM 固定结果（`fixed-roll.ts`）；
- 不做跨房间历史同步（房间数据本身就是隔离的）；
- 不改角色卡的攻击/伤害推导公式（只用 `glance.js` 的结果）；
- 不引入构建步骤（保持「无打包、直接 ESM」的现状）。

---

## 附录 A：源码证据索引（复核用）

| 结论 | 证据（参考实现） |
| --- | --- |
| 模块被拆成「视觉 / 面板 / 历史」三块 | `src/modules/dice/index.ts:31-46` |
| 频道字面值 | `index.ts:48-156` |
| 载荷字段 | `index.ts:192-226`；`types.ts` 的 `DieResult` |
| 骰子尺寸系数 | `types.ts` 的 `DIE_SIZE_FACTOR` |
| `sidesOf()` 支持自定义面数 | `types.ts` 末尾；`index.ts:1332-1335` |
| 30 s 去重 / 模块级 Map | `index.ts:248-250`、`704-712` |
| 归一化 | `index.ts:1321-1387` |
| 广播（LOCAL+REMOTE） | `index.ts:1399-1494` |
| 总和公式 | `index.ts:1448-1451`；`panel-page.ts:2319-2332` |
| modal 参数 | `index.ts:559-573` |
| URL 参数表 | `index.ts:503-557` |
| token 顶部世界坐标 | `index.ts:448-482` |
| 解析器（语法注释） | `panel-page.ts:253-281` |
| `TERM_RE` / `normalizeExpr` / `parsePlain` | `panel-page.ts:319-353` |
| 顶层切分 / 逗号查找 | `panel-page.ts:357-407` |
| wrapper 头解析 | `panel-page.ts:414-473` |
| `parseExprInner` / `finalizeParse` | `panel-page.ts:622-711` |
| `rollPlainSet` / `rollExpr` / `applyValueClamp` | `panel-page.ts:717-733`、`821-843`、`849-929` |
| 编辑器（+1/−1、加值、徽标） | `panel-page.ts:1010-1100` |
| 组合数据结构 / 分组 | `panel-page.ts:107-127`、`1107-1146` |
| 历史 chip / 公式渲染 | `panel-page.ts:1449-1548` |
| 投掷管线 | `panel-page.ts:2796-2883` |
| 组合投掷 | `panel-page.ts:2902-2973` |
| 动画布局公式 | `effect-page.ts:194-200`、`278-319` |
| 动画时间轴 / 抛物线 | `effect-page.ts:355-396` |
| 屏幕投影 / 逐帧跟随 | `effect-page.ts:747-759` |
| 赢家放大曲线 | `effect-page.ts:815-822` |
| 总和/加值盒定位 | `effect-page.ts:600-641` |
| 历史弹窗尺寸与锚点 | `index.ts:76-86`、`303-322`、`390-401` |
| 历史去重/上限/可见性 | `history-policy.ts:1-31` |
| 皮肤存储与双写 | `dice-skins.ts:27-52`、`119-176`、`286-300` |
| 固定结果（不做，仅参考） | `fixed-roll.ts` 全文 |
| 面板 CSS 数字 | `dice-panel.html` 的 `<style>` |
| 面板窗口尺寸 | `public/manifest.json` 的 `action`（380×620） |

## 附录 B：本地插件证据索引

| 结论 | 证据 |
| --- | --- |
| 命名空间 / 键 / 频道 / 窗口 id | `assets/common.js:4-55` |
| 骰子窗口 URL | `assets/common.js:44` |
| 窗口尺寸与夹紧 | `assets/background.core.js:204-228` |
| 打开窗口 | `assets/background.core.js:305-321` |
| 工具栏「骰子」入口 | `assets/background.core.js:556-599` |
| 窗口壳（拖动/状态/反馈） | `assets/window.js:75-287` |
| 卡片读取 / 绑定 | `assets/common.js:156-180`、`259-296` |
| 4E 推导（四防/攻击/伤害/技能/先攻） | `assets/glance.js:225-234`、`241-458` |
| 设计变量 | `assets/ui.css:2-15`（`--green #56d364`；路线图口述的 `#7fe07f` 可作为强调绿另取） |
| 骰子窗口占位 | `dice.html:24-37`、`assets/dice-page.js:1-35` |
| 骰子窗口默认尺寸 660×560 | `assets/background.core.js:208` |

---

_本文档只做规格，不含实现改动。若实现中发现与源码不一致，以 `src/modules/dice/*` 的实际行为为准，并回改本文档。_

---

## 用户拍板（2026-11-15，覆盖 §0.2 / §D1–D3）

| 问题 | 决定 | 实现要点 |
|---|---|---|
| **D1 命中 TN** | **不需要** ✗ | 骰子**只显示结果**（总点数/每骰点数），**不做命中/未命中判定** ✗ 不需要 TN 输入框 ✗ |
| **D2 豁免阈值** | **不需要** ✗ | 不做"成功/失败"判断 ✗；豁免按钮只掷 `1d20+加值` 并显示点数 ✓ |
| **D3 重击** | **做 4E 版** ✓ | 重击 = **所有伤害骰取最大值** ✓（不是 5E 的骰数翻倍 ✗）；实现：重击模式下每个伤害骰按最大值计（`d6`→6、`d8`→8 ✓），不支持对 `adv/dis/max/min` 套用（遇到就退化为普通计算并提示 ✓）|

### 因此 v1.5.0 的最终范围
- 表达式引擎（保留 adv/dis/max/min/burst/repeat ✓ 用户可粘贴旧公式 ✓）
- 骰子按钮 d4–d100 ✓、**战斗优势 +2** ✓（改 modifier ✓）
- **重击（4E）**：伤害骰取满 ✓（单独按钮 ✓ 切换状态 ✓ 结果面板标注「重击·已取满」✓）
- 结果面板：每骰点数 + 总点数 ✓（无命中判定 ✗）
- 历史（本地 ✓ + 团队共享 ✓ 房间数据 40 条封顶 ✓）
- **去掉**：优势/劣势 ✗、暗骰 ✗、示例框 ✗、5etools 菜单 ✗
- 分阶段按 §7 的 P0→P3 执行（P4 动画/皮肤可延后 ✓）