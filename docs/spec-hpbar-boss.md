# 规格：血条扩展 + Boss 显示（复刻 Full Suite hpBar / bossBar，4E 化）

> 目标读者：接手实现的开发者（不需要读参考仓库也能照着写）。
> 状态：**规格文档，不含实现**。本文件是本次任务唯一写入的文件；插件代码一行未改。
> 证据基准：2026-11-15 抓取的 `FullPeople/obr-suite@main` 源码 + 本机 `@owlbear-rodeo/sdk@3.1.0` 类型定义 + 本地插件 v1.3.0/v1.3.1 源码。
> 外部行号均指 2026-11-15 抓取时的 main 分支，仓库更新后可能漂移，定位请以「文件 + 符号名」为准。

---

## 0. 一页速览

| 要做的事 | 参考源码（照抄对象） | 本项目落点 | 数据键 |
| --- | --- | --- | --- |
| 把「临时生命 / 四防 / 回复力」显示出来 | `src/utils/statBanner.ts`（面板态）、`src/modules/bubbles/index.ts`（画在 token 上的图形） | `assets/background.core.js` 第 7 节 + `assets/glance.js` | `com.4enext-owlbear/hp` |
| 右键「添加 / 移除血条组件」 | `src/modules/hpBar/index.ts` | `assets/background.core.js` 的 `registerContextMenu()` | `com.4enext-owlbear/hp-bar/enabled`（建议新增） |
| 右键「显示为 Boss」 | `src/modules/bossBar/index.ts` + `model.ts` | 同上 | `com.4enext-owlbear/hp` 里的 `boss`（布尔或对象，见 §6.1） |
| Boss 的视觉（环形血条 / 名牌 / 盾牌 / 锁） | 几何抄 `bossBar/layout.ts` + `bubbles/index.ts` 的 `shieldPoints()` | `assets/background.core.js` | 同上（纯渲染，不额外存数据） |
| （可选）屏底全屏 Boss 条 | `src/modules/bossBar/page.ts` + `style.css` | 新增一个 `boss-bar.html` | 房间数据/广播（见 §4.3） |

**三个必须先建立的认知**（后面所有设计都建立在这三点上）：

1. **参考实现里，「血条面板」和「token 上的血条」不是一个模块。**
   `hpBar/index.ts` 只负责「选中 token → 弹一个可拖动的 popover 面板」；真正画在 token 上的血条/AC 盾在 `src/modules/bubbles/index.ts`（该文件 105 KB，`hpBar` 只是给它打了 `com.obr-suite/hp-bar/enabled` 这个开关）。
   → 所以本项目的「血条扩展」要动的是**本地已有的 token 图形层**（`assets/background.core.js` 第 7 节），面板只是编辑入口。
2. **OBR 没有「原生血条」。** 所有 token 上的条都是插件自己挂的 `ATTACHMENT` 子 item（`Curve` / `Shape` / `Text`），并用 `OBR.scene.local.*`（本地图形层）绘制，因此**玩家不需要场景写权限也能看到**，但也**不会出现在别人的场景导出里、没装插件的玩家看不到**。
3. **Boss 显示在参考实现里是「全屏透明 modal + 屏底居中的条」，不是 token 样式。** 用户要的「token 显示成 Boss 样式（环形血条/名牌）」在 obr-suite 里**没有对应实现**，属于本项目自创，只有几何公式和渲染手法能抄。这条差异必须在评审时明确（见 §7）。

本地现状（v1.3.0，`manifest.json` 的 `version: 1.3.0`）：

- token 血条已实现：`assets/background.core.js#barLayout()` / `#buildBarItems()` / `#patchBar()` / `#syncBars()`；
- 血量元数据 `com.4enext-owlbear/hp = { cur, max, temp, surges, updatedAt }` 已存在（`assets/track.js:27` 的 `KEY_HP`，`normalizeHp` 在 `assets/track.js:153` 附近）；
- 速览弹窗（`info.html` 660×700，`INFO_W/INFO_H` 在 `assets/background.core.js:57`）里已能加减血、点回复力圆点；
- 四防数值**已经算出来了**，只是没写进 token：`assets/glance.js:304-324` 的 `defenses` 数组（`ac/fort/ref/will`）。

---

## 1. 参考实现全景（谁负责什么）

| 模块 | 文件 | 职责 | 能否照抄 |
| --- | --- | --- | --- |
| hpBar | `src/modules/hpBar/index.ts`（20.8 KB） | 选中 token → 弹 popover；两个右键菜单；自动开启；pin | ✅ 协议/菜单/资格判定整体照抄 |
| hpBar | `src/modules/hpBar/target.ts`（4.2 KB） | 判定纯函数 + 版本租约 `HpTargetLease` | ✅ 直接照抄 |
| hpBar | `src/modules/hpBar/edit.ts`（2 KB） | 一次性写盘（校验 + 夹取 + 镜像外部命名空间） | ✅ 直接照抄 |
| hpBar 面板 | `src/hp-bar-page.ts`（12 KB）+ `hp-bar.html`（10.8 KB） | 面板 DOM/CSS/输入/锁/pin | ✅ 视觉与交互照抄 |
| 面板统计条 | `src/utils/statBanner.ts`（14.9 KB） | HP 药丸 + 临时生命圆 + AC 盾 + 锁 | ✅ CSS 可整段抄 |
| token 图形 | `src/modules/bubbles/index.ts`（105 KB） | 真正画在 token 上的血条 / AC 盾 / 临时生命气泡 | ⚠️ 只抄几何与构建参数（体量太大） |
| bossBar | `src/modules/bossBar/index.ts`（11.2 KB） | GM 菜单、状态广播、modal 开合、压制普通血条 | ⚠️ 协议照抄，渲染层按本项目改 |
| bossBar | `src/modules/bossBar/model.ts`（4.3 KB） | 配置/资格/公开投影/校验 | ✅ 直接照抄 |
| bossBar | `src/modules/bossBar/layout.ts`（1.3 KB） | 屏底居中 + 障碍物避让 | ✅ 公式照抄 |
| bossBar | `src/modules/bossBar/page.ts`（8.4 KB） | 行 DOM、涨落动画、回执 | ✅ 若做方案 B 则照抄 |
| bossBar | `src/modules/bossBar/style.css`（4.2 KB） | 金边框血条、分段、trail | ✅ 若做方案 B 则照抄（换色） |

---

## 2. hpBar 模块解剖（照抄部分）

### 2.1 常量与标识符

~~~ts
// src/modules/hpBar/index.ts
const PLUGIN_ID = "com.obr-suite/hp-bar";
const POPOVER_ID = ${PLUGIN_ID}/popover;
const POPOVER_W = 320;          // 250→320，为了 "150/250" 不截断
const POPOVER_H = 78;           // 56→78，为了名字行
const RIGHT_OFFSET = 20;        // 右上角锚定，距右 20
const TOP_OFFSET = 100;         // 距顶 100（躲开 bestiary 面板）
const CTX_ADD = "com.obr-suite/hp-bar-add";
const CTX_REMOVE = "com.obr-suite/hp-bar-remove";
~~~

~~~ts
// src/modules/hpBar/target.ts
export const HP_BAR_FLAG_KEY = "com.obr-suite/hp-bar/enabled";
export const HP_BAR_TARGET   = "com.obr-suite/hp-bar/target";
export const HP_BAR_READY    = "com.obr-suite/hp-bar/ready";
export const CC_BIND_KEY     = "com.character-cards/boundCardId";
export const BUBBLES_NAME_KEY= "com.owlbear-rodeo-bubbles-extension/name";
const BESTIARY_SLUG_KEY      = "com.bestiary/slug";
~~~

### 2.2 目标广播协议（面板与后台解耦的唯一通道）

后台只广播「现在该显示哪个 token」，面板只读、自己再去读场景。协议四字段：

~~~ts
export interface HpBarTarget {
  session: string;      // 每次 setup 新 UUID，面板靠它拒绝上一轮的残包
  version: number;      // 单调递增
  itemId: string | null;
  pending: boolean;     // true = 正在读，面板此时禁输入
}
~~~

~~~ts
function publishTarget(itemId: string | null, pending: boolean): void {
  if (target.itemId === itemId && target.pending === pending) return;  // 幂等
  target = { ...target, version: target.version + 1, itemId, pending };
  void sendTarget();
}
async function sendTarget(): Promise<void> {
  await OBR.broadcast.sendMessage(HP_BAR_TARGET, target, { destination: "LOCAL" });
}
~~~

面板侧用 `HpTargetLease` 拒绝乱序（含 A→B→A）：

~~~ts
accept(value: HpBarTarget): boolean {
  if (value.session !== this.state.session || !Number.isSafeInteger(value.version)
    || value.version <= this.state.version
    || (value.itemId !== null && typeof value.itemId !== "string")
    || typeof value.pending !== "boolean") return false;
  this.state = { ...value }; this.epoch++; this.request++; return true;
}
capture(): { itemId: string; current: () => boolean } | null {
  const { itemId, pending } = this.state;
  if (!itemId || pending) return null;
  const epoch = this.epoch;
  return { itemId, current: () => epoch === this.epoch && !this.state.pending };
}
~~~

**照抄要点**：`destination: "LOCAL"`（只发本机，不走其他人）；握手方向是「面板 ready → 后台补发 target」，因为面板 iframe 可能在第一次广播之后才加载完：

~~~ts
// 后台
unsubs.push(OBR.broadcast.onMessage(HP_BAR_READY, event => {
  if ((event.data as { session?: string } | undefined)?.session === target.session) void sendTarget();
}));
// 面板（hp-bar-page.ts）
await OBR.broadcast.sendMessage(HP_BAR_READY, { session: lease.state.session }, { destination: "LOCAL" });
~~~

**开/关面板必须串行**（`syncPanel()` 的单飞队列 + `panelRequested` 补跑），否则快速切换 token 会开出两个 iframe 或关掉刚开的：

~~~ts
function syncPanel(): Promise<void> {
  panelRequested = true;
  if (panelQueue) return panelQueue;
  panelQueue = (async () => { while (true) { panelRequested = false; /* …open/close… */ } })()
    .finally(() => { panelQueue = null; if (panelRequested) void syncPanel(); });
  return panelQueue;
}
~~~

### 2.3 资格判定与「自动开启」的坑

~~~ts
export function mayEditHp(item: Item | undefined, gm: boolean, playerId: string): boolean {
  return !!item && item.type === "IMAGE" && !bubblesFromItem(item).hide
    && (gm || (!!playerId && item.createdUserId === playerId));
}
export function hpEligibility(item, gm, playerId): "show" | "enable" | "none" {
  if (!mayEditHp(item, gm, playerId)) return "none";
  const meta = item!.metadata;
  if ([CC_BIND_KEY, BESTIARY_SLUG_KEY].some(key => typeof meta[key] === "string" && meta[key].length > 0)) return "none";
  const flag = meta[HP_BAR_FLAG_KEY];
  if (flag !== undefined) return flag ? "show" : "none";
  const stats = bubblesFromItem(item);
  return [stats.health, stats["max health"], stats["temporary health"], stats["armor class"]]
    .some(value => value != null) ? "enable" : "none";
}
~~~

三态语义：`show` 已显式开启 / `enable` 第一次见到且已有数据（自动开启，只发生一次）/ `none` 不显示。

**坑（必须照抄结论）**：右键「移除」要把 flag 写成 `false` 而不是 `delete`，否则自动开启会立刻把它加回来：

~~~ts
// hpBar/index.ts，CTX_REMOVE 的 onClick
// 2026-05-10 — write FALSE instead of delete. The handleSelection auto-add path
// uses === undefined to detect "first encounter" tokens, so explicit
// removal must persist a non-undefined value (false) to suppress the next auto-add.
(d.metadata as any)[HP_BAR_FLAG_KEY] = false;
~~~

对应的菜单过滤器也要用「不等于 true」，才能同时覆盖 `undefined` 和 `false`：

~~~ts
filter: {
  every: [{ key: "type", value: "IMAGE" }],
  some: [
    { key: "layer", value: "CHARACTER" },
    { key: ["metadata", HP_BAR_FLAG_KEY], operator: "!=", value: true },
  ],
}
~~~

### 2.4 右键菜单：支持多选、幂等

~~~ts
onClick: async (ctx) => {
  const ids = ctx.items
    .filter(it => it.layer === "CHARACTER" && (it.metadata as any)?.[HP_BAR_FLAG_KEY] !== true)
    .map(i => i.id);
  if (ids.length === 0) return;
  await OBR.scene.items.updateItems(ids, drafts => {
    for (const d of drafts) (d.metadata as any)[HP_BAR_FLAG_KEY] = true;
  });
  await handleSelection(selection);
}
~~~

注意 `some` 过滤里的多条件在同一数组里是「或」，在 `every` 里是「与」——参考实现用 `every:[type=IMAGE] + some:[layer=CHARACTER, flag!=true]` 实现「至少一个可加的血条 token 就显示菜单」。

### 2.5 popover 打开参数（几何部分可直接抄）

~~~ts
await OBR.popover.open({
  id: POPOVER_ID,
  url: ${POPOVER_URL}?session=${encodeURIComponent(session)},
  width: POPOVER_W, height: POPOVER_H,
  anchorReference: "POSITION",
  anchorPosition: anchor,
  anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
  transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
  hidePaper: true,
  disableClickAway: true,
});
~~~

锚点计算（右上角锚定 + 面板拖动偏移 + 视口夹取）：

~~~ts
const baseLeft = vw - POPOVER_W - RIGHT_OFFSET;
const baseTop = TOP_OFFSET;
const left = Math.min(Math.max(8, baseLeft + off.dx), vw - POPOVER_W - 8);
const top  = Math.min(Math.max(8, baseTop + off.dy), vh - POPOVER_H - 8);
~~~

### 2.6 面板内的编辑语义（statEdit）

输入语法（**四种**，面板与弹窗必须一致）：

~~~
"20"    → 绝对值
"+5"    → 当前 + 5
"-3"    → 当前 − 3
"15+5"  → 15 + 5 = 20（算式）
"15-3"  → 15 − 3 = 12
其他    → 返回 null，调用方保留原值（输入框回滚）
~~~

写盘夹取（跨字段，**每次都做**）：

~~~ts
const merged: BubblesData = { ...baseForClamp, ...patch };
if (typeof merged.health === "number" && typeof merged["max health"] === "number")
  merged.health = Math.min(merged.health, merged["max health"]);
if (typeof merged["temporary health"] === "number" && merged["temporary health"] < 0)
  merged["temporary health"] = 0;
~~~

逐字段边界（`clampStat`）：

~~~ts
if (field === "max health") return Math.max(1, Math.round(value));
if (field === "armor class") return Math.max(0, Math.round(value));
if (field === "temporary health") return Math.max(0, Math.round(value));
return Math.max(-999, Math.round(value));   // health 允许负数
~~~

**写盘必须两次校验**：第一次在调用前（`current()`），第二次在 `updateItems` 的 draft 回调里（因为 SDK 的 draft 是延迟执行的，期间目标 token 可能已被删除/解绑）：

~~~ts
await OBR.scene.items.updateItems([itemId], drafts => {
  if (!current()) return;
  for (const item of drafts) {
    if (item.id !== itemId) continue;
    if (!mayEditHp(item, role === "GM", playerId)) throw new Error("HP target is no longer editable");
    …
  }
});
~~~

---

## 3. 面板里的血条视觉（statBanner / hp-bar.html）

这一段是**可以直接整段搬进本项目面板**的 CSS 资产。三件套：

| 元素 | 形状 | 关键实现 | 尺寸（面板 320×78 基准） |
| --- | --- | --- | --- |
| HP 药丸 | 胶囊，红色填充按比例 | `--hp-ratio` + `::before { width: calc(var(--hp-ratio)*100%) }` | 高 32（statBanner 34），圆角 16–18，`min-width: 96px` |
| 临时生命 | **圆形**，粉红渐变 | `border-radius:50%` | 32×32（statBanner 36×36），字号 12–13 |
| AC 盾 | 盾形，蓝渐变 | `clip-path:polygon(0% 8%,100% 8%,100% 60%,50% 100%,0% 60%)` | 34×38（statBanner 38×42），`padding-bottom:8px` |
| 锁 | 圆角方块 + 挂锁 SVG | `data-locked` 控制红/透明两态 | 30×30（statBanner 28×28） |

HP 药丸核心：

~~~css
.hp-pill{
  position:relative; isolation:isolate; overflow:hidden;
  display:flex; align-items:center; justify-content:center; gap:2px;
  background:linear-gradient(135deg,#3a1a18,#4a221d);
  border:1px solid rgba(231,76,60,0.7); border-radius:16px;
  color:#fff; font-weight:800; font-size:14px;
  box-shadow:0 2px 6px rgba(231,76,60,0.32),0 0 0 1px rgba(0,0,0,0.18) inset;
}
.hp-pill::before{
  content:""; position:absolute; inset:0; z-index:0; pointer-events:none;
  background:linear-gradient(135deg,#c0392b,#e94560);
  width:calc(var(--hp-ratio, 1) * 100%);
  transition:width 0.18s ease-out;
}
.hp-pill > *{ position:relative; z-index:1 }
~~~

比例写入（唯一来源，别在别处再算一遍）：

~~~ts
hpPillEl.style.setProperty("--hp-ratio", String(max > 0 ? Math.max(0, Math.min(1, hp / max)) : 1));
~~~

> `max = 0` 时比例取 1（实心红），这是参考实现刻意的选择：宁愿显示「满」，也不要留一个空黑槽。

锁按钮的两态与文案（GM 点击切换 `locked`）：

~~~
已锁定：战斗外玩家看不到血条详情。点击解锁让所有人可见。
已解锁：所有人可见血条与 AC。点击锁定恢复战斗外隐藏。
~~~

---

## 4. bossBar 模块解剖

### 4.1 数据模型与常量

~~~ts
// src/modules/bossBar/model.ts
export const BOSS_KEY       = "com.obr-suite/boss-bar/config";
export const BOSS_STATE     = "com.obr-suite/boss-bar/state";
export const BOSS_READY     = "com.obr-suite/boss-bar/ready";
export const BOSS_PRESENTED = "com.obr-suite/boss-bar/presented";
export const MAX_BOSSES = 3;

export interface BossConfig { enabled: boolean; exact: boolean; phase: string; segments: number; order: number }
export interface PublicBoss { id: string; name: string; ratio: number; phase: string; segments: number; numbers?: { hp: number; max: number } }
export interface BossObstacle { left: number; top: number; width: number; height: number }
export interface BossState { session: string; version: number; bosses: PublicBoss[]; replay?: string; obstacles?: BossObstacle[] }
~~~

读取时全部做**类型收敛 + 范围夹取**（不要相信 metadata）：

~~~ts
export function bossConfig(item: Item): BossConfig {
  const value = item.metadata[BOSS_KEY] as Partial<BossConfig> | null;
  return { enabled: value?.enabled === true, exact: value?.exact === true,
    phase: typeof value?.phase === "string" ? value.phase.trim().slice(0, 48) : "",
    segments: typeof value?.segments === "number" && Number.isFinite(value.segments)
      ? Math.max(1, Math.min(5, Math.round(value.segments))) : 1,
    order: typeof value?.order === "number" && Number.isFinite(value.order) ? value.order : 0 };
}
export function eligibleBoss(item: Item): boolean {
  const stats = bossStats(item);
  return item.type === "IMAGE" && item.layer === "CHARACTER" && item.visible === true && !stats.hide
    && typeof stats.health === "number" && Number.isFinite(stats.health)
    && typeof stats["max health"] === "number" && Number.isFinite(stats["max health"]) && stats["max health"] > 0;
}
~~~

资格五条：`IMAGE` + `CHARACTER` 层 + `visible` + 未隐藏 + 有合法 当前/最大值。

### 4.2 公开投影与隐私（这一段是设计上的精髓）

~~~ts
export function publicBosses(items: Item[], viewer?: BossViewer): PublicBoss[] {
  return items.filter(item => bossConfig(item).enabled && eligibleBoss(item))
    .sort((a, b) => bossConfig(a).order - bossConfig(b).order || a.id.localeCompare(b.id))
    .slice(0, MAX_BOSSES).map(item => {
      const config = bossConfig(item), stats = bossStats(item);
      const hp = Math.max(0, stats.health!), max = stats["max health"]!;
      const named = item.metadata["com.owlbear-rodeo-bubbles-extension/name"];
      const name = (item.name?.trim() || (typeof named === "string" ? named.trim() : "")).slice(0, 120);
      const rawRatio = Math.max(0, Math.min(1, hp / max));
      const locked = stats.locked === undefined ? true : !!stats.locked;
      const quantised = viewer && viewer.role !== "GM" && locked && item.createdUserId !== viewer.playerId;
      const ratio = quantised ? quantiseRatio(rawRatio, viewer.threshold) : rawRatio;
      return { id: item.id, name, ratio, phase: config.phase, segments: config.segments,
        ...(config.exact ? { numbers: { hp, max } } : {}) };
    });
}
~~~

**两条硬规则，实现时必须保留：**

1. **投影里默认不出现绝对数值**——只有 DM 勾了 `exact` 才带 `numbers`。玩家端拿到的是 `ratio ∈ [0,1]`。
2. **玩家端比例按阈值向上取整量化**（锁定时），与普通血条完全同一套策略：

~~~ts
// src/modules/bubbles/display-policy.ts
export const DEFAULT_PLAYER_THRESHOLD = 25;
export function quantiseRatio(ratio: number, thresholdPercent: number): number {
  if (thresholdPercent <= 0) return ratio;
  const step = thresholdPercent / 100;
  if (step >= 1) return ratio > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, Math.ceil(ratio / step) * step));
}
~~~

阈值存在**场景元数据**（全桌同一份，不另开房间键）：`com.obr-suite/bubbles/settings.playerThreshold`，读不到时回落 25（`readScenePlayerThreshold()`）。

合法性校验（广播的接收端必须跑，防止脏包把 UI 打崩）：

~~~ts
export function validPublicBoss(value: unknown): value is PublicBoss {
  if (!value || typeof value !== "object") return false;
  const boss = value as PublicBoss;
  return typeof boss.id === "string" && typeof boss.name === "string" && boss.name.length <= 120
    && typeof boss.ratio === "number" && Number.isFinite(boss.ratio) && boss.ratio >= 0 && boss.ratio <= 1
    && typeof boss.phase === "string" && boss.phase.length <= 48
    && Number.isInteger(boss.segments) && boss.segments >= 1 && boss.segments <= 5
    && (!boss.numbers || (Number.isFinite(boss.numbers.hp) && Number.isFinite(boss.numbers.max) && boss.numbers.max > 0));
}
~~~

### 4.3 状态广播与回放协议

- 后台持有 `state = { session, version, bosses, obstacles }`，任何变化 `version++`，`broadcast.sendMessage(BOSS_STATE, state, { destination: "LOCAL" })`。
- 页面前插两层校验：**session 必须匹配**、**version 必须严格递增**（除非是本轮 `replay` 请求的应答）：

~~~ts
const replay = !!pendingReplay && message.replay === pendingReplay;
if ((pendingReplay && !replay) || message.session !== session || !Number.isSafeInteger(message.version)
  || (replay ? message.version < version : message.version <= version) || !Array.isArray(message.bosses)
  || message.bosses.length > MAX_BOSSES || !message.bosses.every(validPublicBoss)
  || new Set(message.bosses.map(boss => boss.id)).size !== message.bosses.length) return;
~~~

- 页面加载完主动请求回放（`requestReplay()` 发 `BOSS_READY {session, requestId}`，后台把 `replay: requestId` 塞回 state）。
- 相同内容不重复广播：`const next = JSON.stringify(bosses); if (next === signature) return;`（参考实现的自测里有「100 次相同快照 = 0 次视觉写入」用例）。

### 4.4 全屏透明 modal（关键 API，不能用 popover 替代）

~~~ts
await OBR.modal.open({
  id: PANEL,
  url: ${assetUrl("boss-bar-v131.html")}?session=${encodeURIComponent(opening)},
  fullScreen: true,
  hidePaper: true,
  hideBackdrop: true,
  disablePointerEvents: true,   // ← 唯一能让鼠标穿透到地图的开关
});
~~~

SDK 3.1.0 的类型定义（`types/Modal.d.ts`）确认这五个字段存在：

~~~ts
export interface Modal {
  id: string; url: string; width?: number; height?: number;
  fullScreen?: boolean; hideBackdrop?: boolean; hidePaper?: boolean;
  disablePointerEvents?: boolean;
}
~~~

而 `Popover` 只有 `hidePaper` / `disableClickAway`，**没有指针穿透**（`types/Popover.d.ts`）。这是参考实现 README 明确记录的结论：

> The display is a fullscreen transparent **host modal** with hidePaper:true, hideBackdrop:true and disablePointerEvents:true … It no longer uses a display popover, whose official API has no host pass-through option. CSS inside an iframe is not the mechanism claimed to forward host input.

页面侧还必须自己把 `body` 设成 `pointer-events:none`（双保险）：

~~~css
body.display { width: 100vw; height: 100vh; pointer-events: none; }
:root { color-scheme: normal !important; }   /* 否则暗色浏览器会把 iframe 刷成不透明 */
html, body { background: transparent !important; overflow: hidden; }
~~~

> `color-scheme: normal !important` 这条注释是踩出来的：强制定死 dark 时浏览器会给画布铺一层不透明底色，全屏模态就变成「全黑盖住地图」。

### 4.5 布局公式（`bossBar/layout.ts` 全文）

~~~ts
export function validObstacle(value: unknown): value is BossObstacle {
  if (!value || typeof value !== "object") return false;
  const box = value as BossObstacle;
  return [box.left, box.top, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0;
}

/** Bottom-center placement against actual open host rectangles. A rectangle
 * with no free vertical room suppresses artwork rather than covering controls. */
export function bossPlacement(width, height, barHeight, inset, obstacles) {
  const w = Math.max(0, Math.min(600, width - 32));           // 最宽 600，两侧各留 16
  const left = (width - w) / 2;                                // 水平居中
  let bottom = Math.max(88, Math.min(inset, height - barHeight - 12));
  for (let pass = 0; pass <= obstacles.length; pass++) {
    const top = height - bottom - barHeight;
    const hits = obstacles.filter(validObstacle).filter(box =>
      box.left < left + w + 8 && box.left + box.width > left - 8 &&
      box.top < top + barHeight + 8 && box.top + box.height > top - 8);   // 8px 外扩
    if (!hits.length) return { left, top, width: w, visible: w >= 128 && top >= 12 };
    bottom = Math.max(bottom, ...hits.map(box => height - box.top + 12));  // 抬到障碍物上沿 +12
  }
  return { left, top: 0, width: w, visible: false };            // 无空位 → 整块隐藏
}
~~~

调用方传的 `barHeight` 是「当前 Boss 行数对应的高度」，**写死在 page.ts**：

~~~ts
const placement = bossPlacement(innerWidth, innerHeight,
  latest.length === 1 ? 60 : latest.length === 2 ? 102 : 144,
  getBossPreferences().bottomInset, obstacles);
~~~

对应 CSS：单条 `.boss:first-child:last-child { height:56px; padding-top:4px }`，多条 `.boss { height:42px }` → 实测取 60/102/144，属于**经验值，需要真机确认**（见 §9）。

### 4.6 行 DOM 与视觉

页面用模板字符串一次性建行，之后只改节点文本/宽度（不重建）：

~~~ts
node.innerHTML = '<div class="bossHeader"><h2 class="bossName"></h2><span class="bossPhase"></span></div>'
  + '<div class="track" role="progressbar"><div class="well"><div class="trail"></div><div class="fill"></div>'
  + '<div class="dividers"></div></div><span class="numbers"></span></div>';
~~~

关键样式（数值都是可直接复用的）：

~~~css
.boss { height:42px; filter: drop-shadow(0 2px 3px #000a); }
.bossHeader { display:flex; align-items:baseline; justify-content:center; gap:9px; height:21px; }
.bossName { font-family:Georgia,"Microsoft YaHei",serif; font-weight:600; font-size:15px; letter-spacing:.08em;
            color:#fff0d3; text-shadow:0 1px 3px #000,0 0 4px #000; max-width:80%; }
.track { position:relative; height:13px; margin:2px 5px 0; padding:2px;
         background:#1c1215ee; border:1px solid #d6af6d; border-radius:2px; }
.well { position:relative; height:7px; overflow:hidden; }
.fill  { background:linear-gradient(90deg,#762632,#c03e43 55%,#e16250); transition:width 140ms ease-out; }
.trail { background:#f0bd70; transition:width 420ms ease-out; }      /* 掉血残影 */
.divider { position:absolute; top:0; bottom:0; width:2px; background:#281719d9; box-shadow:1px 0 #f1cf793b; }
.numbers { position:absolute; inset:-1px 0; text-align:center; font-size:10px; font-weight:700; line-height:13px; }
.defeated .fill { background:#4c4242; }
~~~

- 分段：`mark.style.left = (i * 100 / boss.segments) + "%"`（**只做视觉，不改血量**，README 明确写着这段免责）。
- 掉血残影：占比下降时把 `trail` 先撑到旧值，180ms 后收回到新值；`reducedMotion` 时直接跳过。
- 无障碍：`role="progressbar"` + `aria-valuemin=0/aria-valuemax=100/aria-valuenow=round(ratio*100)` + `aria-label=名字`。
- 名字空 → `t("emptyName")`（无名首领）；ratio=0 → 加 `.defeated` 类并把阶段文案换成「已击败」。

### 4.7 压制普通血条（Boss 与 token 血条不叠两层）

关键设计：**「谁正在被 Boss 面板呈现」是每台机器自己的临时状态，绝不写进 metadata、绝不广播给别的客户端**。

~~~ts
// src/modules/bossBar/suppression.ts
let shown = new Set<string>();
let revision = 0;
const listeners = new Set<() => void>();
export function bossReplacesHealthBar(id: string): boolean { return shown.has(id); }
export function setPresentedBosses(ids: readonly string[]): void {
  const next = new Set(ids);
  if (next.size === shown.size && [...next].every(id => shown.has(id))) return;
  shown = next; revision++;
  for (const listener of listeners) listener();
}
~~~

闭环四步：
1. 后台 `publish()` 里 `setPresentedBosses(bosses.filter(b => bossReplacesHealthBar(b.id)).map(b => b.id))`；
2. 页面渲染成功（拿到可见位置）后回执 `BOSS_PRESENTED { session, version, ids }`；
3. 后台校验 `ids` 必须是当前 `state.bosses` 的子集，再 `setPresentedBosses(ids)`；关闭/场景退出/teardown 一律 `setPresentedBosses([])`；
4. 普通血条渲染层订阅 `onPresentedBossesChange`，对命中 id **只隐藏 HP 背景/填充/数字，保留 AC 盾**。

**为什么必须回执**：页面可能因为障碍物把某条 Boss 藏了（`visible:false`），此时普通血条要恢复，否则这枚 token 两条血都不见了。

### 4.8 偏好（本机，不进房间数据）

~~~ts
export interface BossPreferences { hidden: boolean; reducedMotion: boolean; bottomInset: number }
// localStorage "obr-suite/boss-bar/preferences"
// bottomInset 默认 104，夹在 [88, 360]
// reducedMotion 未设置时跟随 matchMedia("(prefers-reduced-motion: reduce)")
// 变更后 LOCAL 广播 "com.obr-suite/boss-bar/preferences-changed"
~~~

### 4.9 GM-only 菜单 + 配置 popover

~~~ts
const filter = { roles: ["GM"], min: 1, max: 1,
  every: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }] };
// 三个菜单同一套 filter，只在末尾追加 metadata 条件：
// 显示为 Boss：every:[…, { key:["metadata",BOSS_KEY,"enabled"], operator:"!=", value:true }]
// 隐藏 Boss  ：every:[…, { key:["metadata",BOSS_KEY,"enabled"], value:true }]
// Boss 显示选项：同上（enabled 才有）
~~~

开启前要挡两个错误（用 `OBR.notification.show(..., "WARNING")`）：

~~~ts
if (!token || !eligibleBoss(token)) { await OBR.notification.show(t("needHp"), "WARNING"); return; }
if (!bossConfig(token).enabled && items.filter(i => bossConfig(i).enabled && eligibleBoss(i)).length >= MAX_BOSSES)
  { await OBR.notification.show(t("limit"), "WARNING"); return; }
~~~

`order` 的写法有个巧劲：首次开启时用时间戳，保证新 Boss 排在已有之后，之后不再动。

~~~ts
item.metadata[BOSS_KEY] = { ...config, enabled, order: config.order || Date.now() };
~~~

---

## 5. token 上的图形层（本项目真正要改的那一层）

### 5.1 参考常量（`bubbles/index.ts:116-130`）

~~~ts
const BAR_HEIGHT = 20;          // 未缩放高度
const BAR_PADDING = 2;          // 左右内缩
const BAR_CORNER_RADIUS = BAR_HEIGHT / 2;
const BG_OPACITY = 0.6;
const FILL_OPACITY = 0.85;
const BAR_FONT_SIZE = 22;
const DIAMETER = 30;            // 状态气泡/盾牌直径
const BUBBLE_FONT_SIZE = DIAMETER - 8;        // 22，1–2 位数
const BUBBLE_FONT_SIZE_TIGHT = DIAMETER - 15; // 15，3 位数
const TEXT_VERTICAL_OFFSET = -0.3;            // OBR 文字渲染微调
~~~

### 5.2 缩放因子 `s`（整套几何的唯一尺度）

~~~ts
const tokenScale = Math.max(0.05, Math.min(renderedWidth, renderedHeight) / sceneDpi);
const s = tokenScale * userScale;      // 参考实现还有用户倍率；本项目可固定 1
~~~

本项目已有等价实现（`assets/background.core.js:779-781`）：

~~~js
var s = Math.min(bounds.width, bounds.height) / dpi;
if (!isFinite(s) || s <= 0) s = 1;
s = Math.max(0.2, Math.min(6, s));
~~~

> 上界 6 很重要：巨型 Boss 图（4×4 格）不加夹取会把条画到屏幕外。

### 5.3 坐标公式

**标准模式（条在 token 下方）**：

~~~ts
origin = { x: centerX, y: centerY + renderedHeight / 2 + effectiveVerticalOffset };
barOrigin = { x: origin.x - barWidth / 2, y: origin.y - barHeight - 2 * s };
// 注意：OBR 的 position 是「左上角」，所以 y 要再减一个条高
~~~

**头顶模式（本项目更值得抄的思路，条在 token 上方）**：

~~~ts
const overheadGap = 6 * s;
const topOfToken = centerY - renderedHeight / 2;
const barTopY = topOfToken - overheadGap - barHeight + verticalOffset;
origin = { x: centerX, y: topOfToken };
barOrigin = { x: centerX - barWidth / 2, y: barTopY };   // 以 token 中心对齐，而不是以 totalSpan 对齐
~~~

本项目 v1.3.0 用的是「贴底边内侧」（`assets/background.core.js:791`）：`top = bounds.max.y - pad - h`。**扩展时必须保持这个锚点**，否则会和 OBR 画在 token 下方的名字标签打架（`docs/hp-bar-and-tracking.md` §3.2 已记录该结论）。

**盾牌贴边（参考实现顶部模式的巧劲）**：盾牌圆心**落在条的右端点上**，一半压条、一半探出：

~~~ts
const inlineY = barOrigin.y + barHeight / 2;
const barRightX = barOrigin.x + barWidth;
if (data.ac != null) acCenter = { x: barRightX, y: inlineY };
~~~

### 5.4 盾牌多边形（`shieldPoints`，完整可抄）

~~~ts
function shieldPoints(W: number, H: number, segments = 14): Vector2[] {
  const pts: Vector2[] = [];
  const cornerR = Math.min(W, H) * 0.18;
  const sideStraightBottom = H * 0.42;
  // 左上圆角
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, a = -Math.PI + (Math.PI / 2) * t;
    pts.push({ x: cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  // 右上圆角
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, a = -Math.PI / 2 + (Math.PI / 2) * t;
    pts.push({ x: W - cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  pts.push({ x: W, y: sideStraightBottom });
  // 右半下摆：二次贝塞尔 (W,sb) → (W*0.85,H*0.92) → (W/2,H)
  const segs2 = segments * 2;
  for (let i = 1; i <= segs2; i++) {
    const t = i / segs2, u = 1 - t;
    const p0 = { x: W, y: sideStraightBottom }, p1 = { x: W * 0.85, y: H * 0.92 }, p2 = { x: W / 2, y: H };
    pts.push({ x: u*u*p0.x + 2*u*t*p1.x + t*t*p2.x, y: u*u*p0.y + 2*u*t*p1.y + t*t*p2.y });
  }
  // 左半下摆镜像回来 → (0, sideStraightBottom)
  …
  return pts;
}
~~~

盾牌用 `buildCurve()` 画（不是 Shape）：

~~~ts
buildCurve()
  .fillColor(color)
  .fillOpacity(L.overheadMode ? 1.0 : BG_OPACITY)
  .strokeColor("#ffffff").strokeOpacity(0.45)
  .strokeWidth(Math.max(0.6, L.diameter * 0.04))
  .tension(0).closed(true)
  .points(shieldPoints(W, H))
  .position({ x: center.x - W / 2, y: center.y - H / 2 })   // Curve 的 position 也是左上角
  .layer("ATTACHMENT").attachedTo(tokenId)
  .locked(true).disableHit(true).visible(visible)
  .disableAutoZIndex(true).zIndex(15000)
  .disableAttachmentBehavior(DISABLE_INHERIT)
  .metadata(bubbleMeta(tokenId, "ac-shield"))
  .build();
~~~

**为什么不用 `buildShape()`**：SDK 3.1.0 的 `ShapeType` 只有四种——

~~~ts
export declare type ShapeType = "RECTANGLE" | "CIRCLE" | "TRIANGLE" | "HEXAGON";
~~~

**没有 RING、没有盾牌、没有多边形**。所有异形（盾牌、环形、名牌、锁）都必须用 `buildCurve().points()` 自绘。这条是本次规格里最容易踩的实现级结论，务必写进评审。

### 5.5 图层 / 叠序 / 附着行为

| 字段 | 参考实现取值 | 本项目现状 | 结论 |
| --- | --- | --- | --- |
| layer | 条与盾 `ATTACHMENT`，数字 `TEXT` | 全部 `ATTACHMENT` | 跟现状走（同为 ATTACHMENT 时 zIndex 才统一比较） |
| zIndex | 盾 15000（顶部模式 26000）、条字 30000、填充 20000 | bg 10000 / fill 20000 / text 30000 | 直接沿用并向下加密（见 §6.3） |
| attachedTo | token id | 是 | 必需，否则不跟随拖动 |
| disableHit | true | 是 | 必需，否则挡住 token 点击 |
| locked | true | 是 | 必需，防止误拖 |
| disableAutoZIndex | true | 是 | 必需，否则每帧重排 |
| disableAttachmentBehavior | `["SCALE","ROTATION","LOCKED","COPY"]` | 同 | 必需，否则 token 缩放会把条二次放大 |

### 5.6 文本格式与字号拟合

~~~ts
const text = (data.hp + "/" + data.maxHp) + (data.tempHp > 0 ? (" +" + data.tempHp) : "");
const strokeWidth = Math.max(0.4, L.barHeight * 0.075);   // 描边跟着条高走，小体型不会糊成黑块
~~~

本项目已有的拟合公式（`assets/background.core.js:787`），**扩展时沿用**：

~~~js
var fs = Math.min(h * 1.05, (w / Math.max(4, text.length)) * 1.5);
fs = Math.max(6 * s, fs);
~~~

> 没有文本测量 API（`Text` 只有 `width/height/plainText`），只能用「字符数 × 经验系数」估。中英混排时偏保守取 0.62em/字。

### 5.7 本地图形层 API 与自愈

~~~js
await OBR.scene.local.addItems(items);      // 只在本机渲染，不需要场景写权限
await OBR.scene.local.updateItems(ids, drafts => { … });   // 就地改，不闪
await OBR.scene.local.deleteItems(ids);
OBR.scene.local.onChange(items => { … });   // 被外部删掉时自愈
~~~

本项目已实现三件套 + 自愈 + 启动清扫（`assets/background.core.js:846/854/881/909/997`），扩展时**不要重写这套生命周期**，只加 role 与几何。

---

## 6. 4E 化：本项目的数据与渲染设计

### 6.1 元数据 schema

继续用 `com.4enext-owlbear/hp`（**不新建键，避免双份真相**），只做**新增字段**：

~~~ts
interface HpMetaV2 {
  cur: number | null;          // 现有
  max: number | null;          // 现有
  temp: number;                // 现有
  surges: number | null;       // 现有：剩余回复力
  updatedAt: number;           // 现有

  surgesMax?: number;          // 新增：回复力上限（写一次即可，用于画 "13/13" 的分母）
  defenses?: {                 // 新增：四防
    ac?: number; fort?: number; reflex?: number; will?: number;
  };
  boss?: boolean | {           // 新增：Boss 开关（布尔或对象都接受）
    enabled: boolean; segments?: number; phase?: string; exact?: boolean; order?: number;
  };
  locked?: boolean;            // 新增：玩家端隐藏精确数值（默认 true）
}
~~~

**读取时必须把布尔归一化**（这样 roadmap 里的 `boss:boolean` 与后续配置对象可以共存，不用二次迁移）：

~~~js
function readBoss(v) {
  if (typeof v === "boolean") return { enabled: v, segments: 1, phase: "", exact: false, order: 0 };
  if (!v || typeof v !== "object") return { enabled: false, segments: 1, phase: "", exact: false, order: 0 };
  return {
    enabled: v.enabled === true,
    segments: Number.isFinite(v.segments) ? Math.max(1, Math.min(5, Math.round(v.segments))) : 1,
    phase: typeof v.phase === "string" ? v.phase.slice(0, 48) : "",
    exact: v.exact === true,
    order: Number.isFinite(v.order) ? v.order : 0
  };
}
~~~

**字段级规则**（照抄 `clampStat` 的口径，别自创）：

| 字段 | 下限 | 上限 | 说明 |
| --- | --- | --- | --- |
| cur | −max（4E 到负上限即死亡） | max | 现有规则 |
| max | 1 | — | `max<=0` 时比例按 1 显示 |
| temp | 0 | — | 受伤先扣 |
| surges | 0 | surgesMax | 点圆点直接设 |
| surgesMax | 1 | — | 第一次写盘时补 |
| defenses.* | 0 | — | 缺字段 = 不画那枚盾 |
| locked | 布尔 | — | 只有 GM 能改（面板按钮隐藏给玩家） |

**向后兼容**：老 token 没有 `surgesMax` → 分母回落到「卡片推导值」只在有卡片上下文时可用（`assets/glance.js:332`）；画布层拿不到卡片，分母回落到 `max(surges, 1)` 并把条画满、只显示一个数字。**不要**为了这个去读房间数据（画布层是每台机器高频调用，禁止跨页请求）。

### 6.2 卡字段 → token 字段映射

| 4E 卡（`assets/glance.js`） | 键 | 本项目 token 键 | 备注 |
| --- | --- | --- | --- |
| `defenses[0]` | `ac` | `defenses.ac` | 卡里就叫 `ac` |
| `defenses[1]` | `fort` | `defenses.fort` | 名字一致 |
| `defenses[2]` | `ref` | **`defenses.reflex`** | ⚠️ 键名不同，必须显式映射 |
| `defenses[3]` | `will` | `defenses.will` | 名字一致 |
| `d.surges`（派生上限，`assets/glance.js:332`） | — | `surgesMax` | 卡里 `cls.surges + mods.con + surgeBonus` |
| `d.surgeValue`（`:329-331`） | — | 不落盘 | 用回复力时才需要，留在弹窗算 |
| `d.hpCur/hpMax/hpTemp` | — | `cur/max/temp` | 已有 |

`ref` → `reflex` 的换算位置只有一处（`readHpMeta` / 写盘 helper），**不要在渲染层做两套命名**。

### 6.3 渲染对象清单（role 表）

在现有 `bg / fill / text` 三种 role 上扩到 14 种，全部打 `metadata[BAR_TAG] = { owner: tokenId, role }`，`patchBar` 按 role 分发：

| role | layer | zIndex | 内容 | 何时存在 |
| --- | --- | --- | --- | --- |
| `ring-bg` | ATTACHMENT | 9500 | 环形底（暗） | boss 模式 |
| `ring-fill` | ATTACHMENT | 9800 | 环形血量弧 | boss 模式 |
| `bar-bg` | ATTACHMENT | 10000 | HP 胶囊底 | 有 hp |
| `surge-bg` | ATTACHMENT | 10500 | 回复力蓝条底 | 有 surges |
| `plate` | ATTACHMENT | 12000 | 名牌圆角底 | boss 模式 |
| `plate-text` | ATTACHMENT | 12400 | Boss 名字 | boss 模式 |
| `shield` | ATTACHMENT | 15000 | 四防盾（×4） | 有 defenses |
| `shield-text` | ATTACHMENT | 16000 | 四防数字（×4） | 有 defenses |
| `bar-fill` | ATTACHMENT | 20000 | HP 填充 | 有 hp |
| `surge-fill` | ATTACHMENT | 20500 | 回复力填充 | 有 surges |
| `divider` | ATTACHMENT | 22000 | 分段线（≤4） | boss 且 segments>1 |
| `bar-text` | ATTACHMENT | 30000 | `cur/max +temp` | 有 hp |
| `surge-text` | ATTACHMENT | 30500 | `s/max` | 有 surges |
| `lock` | ATTACHMENT | 31000 | 锁（body+shackle 两件） | boss 模式 |

单 token item 数：普通 3 → +3（回复力）= 6；有四项防御 +8 = 14；Boss 模式再 +2(环)+2(牌)+2(锁)+最多 4(分段) ≈ 22。**20 枚带防御的 token = 两百多个本地 item**，属于可接受范围，但必须遵守两条：只在有数据时创建、`sig` 没变就一次写都不发。

### 6.4 几何公式（本项目定稿）

约定：`s` 同 §5.2；`b` = `getItemBounds([tokenId])`（含旋转缩放）；`pad = 2s`。

**A. 两行条（HP 在上，回复力在下，符合 roadmap 第 4 节）**

~~~
hHp    = 20 * s
hSurge = 12 * s
gap    = 3  * s
w      = max(2*hHp, b.width - 2*pad)          // 现有公式
left   = b.center.x - w/2

surgeTop = b.max.y - pad - hSurge
hpTop    = surgeTop - gap - hHp
~~~

即：**底边内侧先放蓝条，蓝条上方 gap 再放红条**。两者共用 `left/w`，视觉上是一组「血条卡片」。
文字：

~~~
hpText    = cur + "/" + max + (temp > 0 ? " +" + temp : "")
surgeText = surges + "/" + surgesMax          // 缺分母时只写 surges
fontHp    = clamp(min(hHp*1.05, (w/max(4,len))*1.5), 6*s, hHp*1.05)
fontSurge = max(5*s, min(hSurge*0.95, (w/max(3,len))*1.4))
~~~

**B. 四防四角盾**

~~~
d       = 30 * s                              // 盾牌直径，照抄 DIAMETER
inset   = 4  * s
xL      = b.min.x + inset + d/2
xR      = b.max.x - inset - d/2
yT      = b.min.y + inset + d/2
yB      = hpTop - gap - d/2                   // ← 关键：底排让位给血条
ac      = (xL, yT)      fort = (xR, yT)
reflex  = (xL, yB)      will = (xR, yB)
~~~

退化规则（必须写死，否则小 token 上会糊成一团）：

~~~
if (b.width < 2*d + 4*inset || yB <= yT) → 不画四角盾，改为「面板内显示」（P2 阶段先这样）
~~~

**C. Boss 环形血条**

用**环形扇区多边形**（不是描边圆，理由：要能按比例填充、且 SDK 没有 RING）：

~~~
cx, cy = b.center
Ro = min(b.width, b.height)/2 - 2*s           // 内缩，避免压到相邻 token
T  = clamp(10*s, 6*s, Ro*0.30)                // 环厚
Ri = Ro - T
a0 = -90deg                                   // 12 点方向
sweep = ratio * 360deg
point(t) = angle = a0 + t*sweep
           外弧: (cx + cos*Ro, cy + sin*Ro)    t: 0 → 1（N=48 段）
           内弧: (cx + cos*Ri, cy + sin*Ri)    t: 1 → 0
closed = true, tension = 0
~~~

- `ratio = 1` 时首尾在 12 点重合，接缝宽度为 0，视觉上是完整环；
- 底环 `ring-bg` 用同一函数 `sweep = 360°`、颜色 `#0b0f14` + 0.55 透明度；
- 环段数与点数：`N = 48`，每环 96 点 ×2 条 = 192 点/token；**不要用 128 段**（脏矩形重绘成本翻倍）。

**D. 名牌 + 阶段 + 分段 + 锁**

~~~
plateH = 26 * s
plateY = b.min.y - 6*s - plateH                 // token 上方 6s
plateW = min(w, max(140*s, 0.62*14*s*len(name)))
plateX = b.center.x - plateW/2
nameFont = 14*s（粗体，白色，描边 strokeWidth = max(0.4, 0.9*s)）
phase 显示在名字右侧，font 10*s，色 #e3b341
divider: x = left + w*i/segments (i=1..segments-1)，width 2*s，色 #281719 @0.85
lock: body = roundRect(10*s, 8*s, r=2*s)，shackle = 半径 3.2*s 的半圆弧
      位置 = (plateX + plateW - 8*s - 5*s, plateY + plateH/2)
      颜色：locked → #f85149；unlocked → #93a1b0（透明度 0.8）
~~~

**E. 全部数值表（s = 1 时，便于对照真机截图）**

| 物件 | 尺寸/位置 | 颜色 |
| --- | --- | --- |
| HP 条 | 20 高，圆角 10 | 底 `#A4A4A4` @0.6；填充 `#a52424` @0.85 |
| 回复力条 | 12 高，圆角 6，与 HP 间距 3 | 底 `#1a222c` @0.85；填充 `#58a6ff` @0.9 |
| 四防盾 | 直径 30 | ac `#3498db`／fort `#e3b341`／reflex `#56d364`／will `#a371f7`（各 0.9） |
| 盾文字 | 字号 22（≤2 位）／15（3 位） | 白，描边 `#000` @0.7，宽 0.4–0.5 |
| 环 | Ro = 半短边−2，厚 10 | 底 `#0b0f14` @0.55；填充同 HP 红 |
| 名牌 | 26 高，距 token 顶 6 | 底 `#0b0f14` @0.78，描边 `#253040`，字 `#e6edf3` |

> 颜色一律取 `assets/ui.css` 的 `:root`（`--blue:#58a6ff`、`--green:#56d364`、`--red:#f85149`、`--orange:#e3b341`、`--line:#253040`、`--bg:#0b0f14`）。roadmap 里写的 `#14161c` / `#7fe07f` 是早先的近似描述，**当前代码实际值是上表**，新代码必须与现有界面同色系，不要引入第二套色板。

### 6.5 状态签名与增量更新

现有 `sig` 只含 `cur/max/temp + 几何`（`assets/background.core.js:966`）。扩展为：

~~~js
var sig = [
  hp.cur, hp.max, hp.temp, hp.surges, hp.surgesMax,
  d ? [d.ac, d.fort, d.reflex, d.will].join(",") : "",
  boss.enabled ? 1 : 0, boss.segments, boss.phase, hp.locked ? 1 : 0,
  Math.round(L.w), Math.round(L.h), Math.round(L.left), Math.round(L.hpTop),
  Math.round(L.surgeTop), Math.round(L.plateTop)
].join("|");
~~~

**`sig` 里不要放 `bounds` 的全部字段**（旋转/位移每帧都变，会导致每条血条每帧重写）；几何只取 5 个整数就够了——这也是参考实现 `hpViewSignature` 刻意排除 `position/rotation` 的原因：

~~~ts
/** No position, rotation or unrelated metadata: dragging does not repaint inputs. */
export function hpViewSignature(item: Item | undefined): string { … }
~~~

`patchBar` 按 role 分发（新增代码，别把 if 写成一条长链）：

~~~js
switch (role) {
  case "bar-bg":   d.position = { x: L.left, y: L.hpTop }; d.points = roundRect(L.w, L.hHp, L.hHp/2, 1); break;
  case "bar-fill": d.position = { x: L.left, y: L.hpTop }; d.points = roundRect(L.w, L.hHp, L.hHp/2, L.ratio); d.visible = L.ratio > 0; break;
  case "surge-bg": d.position = { x: L.left, y: L.surgeTop }; d.points = roundRect(L.w, L.hSurge, L.hSurge/2, 1); break;
  case "surge-fill": …; break;
  case "shield":   d.points = shieldPoints(L.d, L.d); d.position = { x: c.x - L.d/2, y: c.y - L.d/2 }; break;
  case "bar-text": d.text.plainText = L.hpText; … break;
  …
}
~~~

### 6.6 面板 UI 扩展（速览弹窗）

位置：`assets/glance.js` 的生命区（`gl4-hp-line` / `gl4-hpbar` / `gl4-surge-line`，见 `assets/glance.js:548-557`）。

改动清单（全部是「在现有结构里加」，不改数据流）：

1. **四防一排**：在 HP 条下方插入 `gl4-def-row`，四个 `button data-act="defense" data-key="ac|fort|reflex|will"` 小盾（复用 `.gl4-pip` 的尺寸节奏，盾形用 `clip-path`，与 token 上盾牌同一形状语言）；
2. **回复力条**：把现有 `gl4-surge-line` 的圆点行**上方**加一条细蓝条 `gl4-surgebar`（高 6px，`width = surges/surgesMax`），圆点保留（点选更精准）；
3. **锁按钮**：仅在 `editable.hp` 且是 GM 时显示，写 `hp.locked`；
4. **Boss 开关**：速览弹窗里也放一个「显示为 Boss」（与右键菜单写同一个字段，两个入口不能有两套逻辑）。

渲染可以只读 `live.hp`，但**写盘必须走 `assets/track.js` 的 `applyAction`**（唯一动作分发点，`docs/hp-bar-and-tracking.md` §5 已定）。新增两个 act：`"defense"`、`"boss"`。

### 6.7 右键菜单设计（本项目）

在 `registerContextMenu()`（`assets/background.core.js:256`）里追加，**不改现有 3 项**：

| 菜单 id | 文案 | filter | onClick |
| --- | --- | --- | --- |
| `NS + "/hpbar-add"` | 添加血条组件 | GM + IMAGE + `max:1` + flag != true | 写 `hp-bar/enabled = true` |
| `NS + "/hpbar-remove"` | 移除血条组件 | 同上，flag == true | 写 `hp-bar/enabled = false` |
| `NS + "/boss-show"` | 显示为 Boss | GM + IMAGE + CHARACTER + `metadata.hp.boss.enabled != true` | 校验资格 → 写 `boss:{enabled:true,order:Date.now()}` |
| `NS + "/boss-hide"` | 隐藏 Boss 血条 | 同上，条件反过来 | 写 `boss:{...,enabled:false}` |
| `NS + "/boss-options"` | Boss 显示选项 | 已开启 | 打开配置 popover（320×302） |

⚠️ **每个 `icons` 数组只放一个图标、每个菜单只注册一次**：参考实现早期把多个 icon 塞进一个 `create()`，回调里靠 `elementId` 区分，很容易错位；本项目现有代码也是「一个 icon 一个 create」（见 `background.core.js:262`、`:296`）。

⚠️ 血条开关建议**新增独立键** `com.4enext-owlbear/hp-bar/enabled`，不要塞进 `hp`。理由：`hp` 是数值容器，写开关会误触发 `readHpMeta()` 判空逻辑；而且未来「有数据但不想显示」是合理需求（参考实现就是这个键名，迁移时能直接对齐）。

**自动开启**：本项目 v1.3.0 是「有 hp 就画」，没有开关。加开关后要决定默认值。建议照参考实现：`flag === undefined`（老 token）时**继续画**（向后兼容，不许升级后血条集体消失）；`flag === false` 才真正不画；`flag === true` 画。等价于把现有行为当默认 `true`。

### 6.8 玩家可见性与 `locked`

| 角色 | 看到什么 |
| --- | --- |
| GM | 一切（精确数字、四防、环、锁图标） |
| token 创建者本人 | 同上（`item.createdUserId === playerId`） |
| 其他玩家 + `locked`（默认） | HP **按 25% 阶梯向上取整**的比例条；**不显示** `cur/max` 数字；四防盾显示为「?」或不画 |
| 其他玩家 + 未 locked | 完整数字 |

量化函数与阈值直接抄 §4.2 的 `quantiseRatio` / `readScenePlayerThreshold`，阈值放场景元数据 `com.4enext-owlbear/settings.playerThreshold`（本项目自有命名空间，缺省 25）。

> 实现注意：玩家端**拿不到**精确数字靠的是「本地渲染时决定不画文字」，不是「数据里没有」。token metadata 对全桌可读，真要藏数字只能不画。这一点必须在文档和 UI 里说清，别让 DM 误以为「锁了 = 数据加密」。

---

## 7. Boss 显示：两套方案对比与选型

### 方案 A（推荐，贴合用户原话「token 显示成 Boss 样式」）

token 附带的本机图形（环形 + 名牌 + 分段 + 锁），几何见 §6.4 C/D。

- 优点：无需新页面；不遮挡地图交互（没有 iframe）；与血条共用同一套 `syncBars` 生命周期；玩家装了插件就能看到。
- 缺点：**obr-suite 没有对应实现，全是自创**，真机观感必须迭代；环形/名牌在旋转 token 上会跟着转（OBR 子 item 旋转继承可关，但位置仍是世界坐标，需要按 bounds 重算）。
- 多 Boss：不需要限制（每枚 token 自己一套），比参考实现的 3 个上限更自由。

### 方案 B（可选，照抄 bossBar）

全屏 `disablePointerEvents` modal + 屏底居中条（§4.4–4.7）。

- 优点：视觉冲击强、统一管理（一个条列出全部 Boss）、有掉血残影/分段/障碍物避让；**协议与样式可以几乎 1:1 抄**。
- 缺点：`Modal` 全屏会盖住整个画面一个 iframe 层（透明但仍是独立渲染层，低端机会掉帧）；障碍物坐标要由后台主动喂（`setBossBarObstacles`），本项目面板位置管理还没统一，容易和速览弹窗打架；指针穿透必须真机验证。
- 结论：**P4 再做，且默认关闭**（设置里开关）。P3 先交付方案 A。

| 维度 | 方案 A（token 附带） | 方案 B（屏底 modal） |
| --- | --- | --- |
| 遮挡地图 | 无 | 全屏透明层（穿透靠 API） |
| 实现量 | 中（几何 + 分层） | 大（新页面 + 协议 + 障碍物） |
| 参考代码可抄度 | 只抄公式 | 几乎全抄 |
| 多 Boss | 无上限 | 上限 3 |
| 真机风险 | 中（观感/旋转） | 高（穿透/焦点/掉帧） |
| 建议 | **P3 交付** | P4 可选 |

---

## 8. 分阶段实现步骤

> 每阶段都可独立发布、独立回滚；任何阶段都不改 `data/rules.js`、不改卡片格式。

### P0 — 数据层与读取器（0.5 天，v1.3.0 内）

| 项 | 内容 |
| --- | --- |
| 改动 | `assets/background.core.js`：`readHpMeta()` 扩字段；`assets/track.js`：`normalizeHp()` 扩字段、写盘时补 `surgesMax`；新增 `readBoss()`/`readDefenses()` |
| 关键 | 只新增字段，不改 `cur/max/temp/surges` 语义；`ref`→`reflex` 映射只在一处 |
| 验收 | `node dev/test-background.mjs` 全过；手工给 token 写 `defenses` 后弹窗能读到 |
| 回滚 | 无副作用（老数据只是多几个可选字段） |

代码骨架：

~~~js
function readHpMeta(item) {
  var m = item && item.metadata ? item.metadata[KEY_HP] : null;
  if (!m || typeof m !== "object") return null;
  var hp = { cur: numOrNull(m.cur), max: posOrNull(m.max), temp: max0(m.temp), surges: numOrNull(m.surges),
             surgesMax: posOrNull(m.surgesMax), defenses: readDefenses(m.defenses),
             boss: readBoss(m.boss), locked: m.locked !== false };
  if (hp.cur === null && hp.max === null) return null;
  return hp;
}
~~~

### P1 — 右键菜单与开关（0.5 天，v1.3.0 内）

| 项 | 内容 |
| --- | --- |
| 改动 | `registerContextMenu()` 追加 4 个菜单；`KEY_HPBAR` 常量；GM 校验；写 `false` 抑制自动开启 |
| 关键 | 「移除」写 `false` 不写 `delete`；菜单 filter 用 `operator:"!="`；一个 icon 一个 create |
| 验收 | 假 OBR 测：点菜单后 `updateItems` 被调用且 metadata 值正确；多选时所有选中 token 都被写 |
| 回滚 | 删菜单注册即可 |

### P2 — 血条扩展渲染（1.5 天，v1.3.1 / v1.6.0）

| 项 | 内容 |
| --- | --- |
| 改动 | `barLayout()` 返回新几何（`hpTop/surgeTop/hSurge/shields[]`）；`buildBarItems()` 加 role；`patchBar()` 加 switch；`sig` 扩展；`sweepStaleBars()` 不受影响（按 tag 清） |
| 关键 | 回复力蓝条在下、HP 在上；四角盾在窄 token 上退化；`sig` 变化只写不重建 |
| 验收 | 假 OBR：带 `defenses+surges` 的 token 应 `addItems` 出 14 件；改血后只 `updateItems`（不 add）；删本地 item 后自愈；删 hp 后清理 |
| 真机 | 截图对照：条高、盾牌位置、数字不溢出 |
| 回滚 | 关掉一个常量 `SHOW_DEFENSES=false` 即退回 3 件套 |

### P3 — Boss 样式（方案 A，1.5 天，v1.6.0）

| 项 | 内容 |
| --- | --- |
| 改动 | 环形扇区函数 `ringSectorPoints()`；名牌 `plate/plate-text`；`divider`；`lock`；`boss` 开关读取；Boss 菜单已在 P1 完成 |
| 关键 | 环点数 N=48；名牌宽度用估算；分段只做视觉；锁的颜色随 `locked` |
| 验收 | 假 OBR：boss=true 的 token addItems 出 22 件；segments=3 有 2 条 divider；locked 切换只改颜色不重建 |
| 真机 | 巨型/小型 token 各一张截图；旋转 45° 的 token 位置正确 |
| 回滚 | `boss.enabled=false` 立即回到普通样式（不需要删数据） |

### P4 —（可选）屏底全屏条（2–3 天，v1.7.0 之后）

| 项 | 内容 |
| --- | --- |
| 改动 | 新页 `boss-bar.html` + `assets/boss-bar-page.js`；后台 `bossOverlay` 模块（state/version/replay）；`bossPlacement()`；偏好（bottomInset 88–360，默认 104） |
| 关键 | 只能 `OBR.modal.open({fullScreen,hidePaper,hideBackdrop,disablePointerEvents:true})`；`color-scheme:normal`；`body.pointer-events:none`；压制普通血条要回执 |
| 验收 | 假 OBR：状态广播 version 递增、相同内容不广播、replay 生效、teardown 关 modal |
| 真机 | 必须验证：鼠标能点到地图、滚轮能缩放、面板打开时条会自动上移、关闭后普通血条恢复 |
| 回滚 | 默认关闭的开关；出问题直接不注册菜单 |

### P5 — 玩家可见性（0.5 天，可与 P3 同期）

`quantiseRatio` + 阈值读场景元数据 + 玩家端不画数字。验收：用两个浏览器（GM/玩家）对照同一 token 的读数。

---

## 9. 风险与对策

| # | 风险 | 证据 | 对策 |
| --- | --- | --- | --- |
| R1 | **SDK 没有环形/多边形图元** | `types/items/Shape.d.ts`：`ShapeType = "RECTANGLE"｜"CIRCLE"｜"TRIANGLE"｜"HEXAGON"` | 全部用 `buildCurve().points()`；环用环形扇区多边形；点数控制 N≤48 |
| R2 | popover **没有指针穿透** | `types/Popover.d.ts` 无 `disablePointerEvents`；`Modal.d.ts` 有 | 要全屏条只能上 `Modal`；方案 A 完全不用 iframe，风险最低 |
| R3 | 全屏 modal 盖住地图/抢焦点 | 参考 README 自述「host modal coexistence/focus 仍需真机验证」 | P4 默认关闭；提供设置里的关闭入口；真机验收清单必过 |
| R4 | 本地图形层**不被其他客户端/导出看到** | `OBR.scene.local` 语义（`assets/background.core.js:683-684` 注释） | 文档明写「没装插件的玩家看不到血条」；数值仍在 token metadata（全桌可读） |
| R5 | 写权限：玩家写不进 token metadata | 现有 `docs/hp-bar-and-tracking.md` §4.3 | 写盘失败 → `OBR.notification.show(...,"ERROR")`；Boss 菜单 GM-only |
| R6 | item 数爆炸（≈22/枚） | `assets/background.core.js` 现状 3 件 | 有数据才建；`sig` 未变不发写；盾牌在窄 token 退化不画；四防可设开关 |
| R7 | 文本宽度无测量 API，名牌/数字溢出 | SDK 无 measure；参考实现用 `fitBarFontSize()` 估 | 保守系数 0.62em；字号封顶 `h*1.05`；名字截断（参考实现 `slice(0,120)`/CSS ellipsis） |
| R8 | 旋转/缩放 token 上位置漂移 | 参考实现踩过（README 的 Reset 按钮就是修漂移用的） | 关 `SCALE/ROTATION` 继承 + 每次 `getItemBounds` 重算 + 本地层删了会自愈 |
| R9 | 与 OBR 原生名字标签重叠 | `docs/hp-bar-and-tracking.md` §3.2 已记录 | 条贴底边**内侧**；名牌放 token 上方 6s；不做「条在 token 下方」 |
| R10 | 数据双写漂移（面板改了画布没变） | 参考实现靠 `items.onChange` 单一数据源 | 只认 token metadata 一个真相；所有写入走 `track.js#applyAction`；渲染只订阅 `onChange` |
| R11 | `ref`/`reflex` 命名分叉 | `assets/glance.js:315` 用 `ref`，roadmap 用 `reflex` | 映射只在 `readHpMeta`/写盘一处做；测试里断言两个名字不能同时出现 |
| R12 | 玩家端「锁」被误解为加密 | metadata 全桌可读 | UI 文案写「玩家端不显示数字」，不写「隐藏数据」 |
| R13 | 无真机环境（仓库现状） | `docs/hp-bar-and-tracking.md` §6.1 | 假 OBR 冒烟 + 手动写 metadata 的验证脚本；真机清单（§10）交给有房间的人 |
| R14 | 颜色/设计语言漂移 | roadmap 写 `#14161c/#7fe07f`，`assets/ui.css` 实为 `#0b0f14/#56d364` | 以 `ui.css` 的 CSS 变量为准；新颜色只允许从变量取值，不新增十六进制 |

---

## 10. 验收清单

### 10.1 开发环境（假 OBR，`node dev/test-background.mjs`）

- [ ] 老 token（只有 `{cur,max,temp}`）升级后**血条照旧**（不消失）；
- [ ] 带 `defenses` 的 token：`local.addItems` 收到 4×盾 + 4×数字，位置符合 §6.4 B；
- [ ] 带 `surges/surgesMax` 的 token：蓝条在 HP 条下方，间距 3s；
- [ ] 改 `cur`：只 `updateItems`（不 `addItems`），文本变成新值；
- [ ] 改 `defenses.ac`：只改那枚盾+数字，其余不动；
- [ ] 本地 item 被外部删除：自动重建（现有自愈用例保持通过）；
- [ ] `hp` 元数据被删：本地 item 被清理；
- [ ] 右键「移除血条组件」后刷新/重选，血条**不自动回来**（写 `false` 生效）；
- [ ] 右键「显示为 Boss」：`boss.enabled=true`、`order` 有值；第 4 个 Boss 被拒并弹 WARNING；
- [ ] `boss.enabled=false` 后 item 数回到 14（环/牌/锁被删）；
- [ ] 启动时清扫仍清掉上次会话残留（tag 复用同一个 `BAR_TAG`）。

### 10.2 真机（有 Owlbear 房间时）

- [ ] 1×1 / 2×2 / 4×4 三种 token 的血条高度、盾牌不重叠；
- [ ] token 旋转 45°/90° 后条与盾仍在正确位置（不跟转、不漂移）；
- [ ] 缩放 token（滚轮）后条高不变（禁用 SCALE 继承生效）；
- [ ] GM 端看到数字；玩家端（另开窗口）看到阶梯比例且无数字；
- [ ] 面板改血 → 画布 1 帧内跟随（90ms 合并窗）；
- [ ] 4 个 Boss 同时开（第 4 个被拒）；
- [ ] （若做 P4）全屏条下鼠标能点地图、滚轮能缩放、面板打开时条上移、关闭后普通血条恢复。

---

## 11. 附录 A：参考源码索引

| 文件 | 大小 | 用途 |
| --- | --- | --- |
| https://github.com/FullPeople/obr-suite/blob/main/src/modules/hpBar/index.ts | 20.8 KB | 面板生命周期、菜单、pin、popover 参数 |
| .../src/modules/hpBar/target.ts | 4.2 KB | 资格判定、签名、租约 |
| .../src/modules/hpBar/edit.ts | 2.0 KB | 单次写盘 |
| .../src/hp-bar-page.ts | 12.2 KB | 面板逻辑（输入/blur/锁/pin/ready 握手） |
| .../hp-bar.html | 10.8 KB | 面板 DOM + CSS（三件套视觉） |
| .../src/utils/statBanner.ts | 14.9 KB | 可复用统计条组件（含完整 CSS） |
| .../src/utils/statEdit.ts | 6.7 KB | 输入语法、夹取、双命名空间合并 |
| .../src/modules/bubbles/index.ts | 105.8 KB | token 图形几何、盾牌多边形、文本拟合、zIndex |
| .../src/modules/bubbles/display-policy.ts | 0.9 KB | 阈值 + 比例量化 |
| .../src/modules/bossBar/index.ts | 11.2 KB | 菜单、状态广播、modal 开关、压制 |
| .../src/modules/bossBar/model.ts | 4.3 KB | 数据模型、公开投影、校验 |
| .../src/modules/bossBar/layout.ts | 1.3 KB | 屏底居中 + 障碍物避让公式 |
| .../src/modules/bossBar/page.ts | 8.4 KB | 行 DOM、动画、回执、replay |
| .../src/modules/bossBar/style.css | 4.2 KB | 金框血条样式 |
| .../src/modules/bossBar/suppression.ts | 0.8 KB | 本地呈现所有权 |
| .../src/modules/bossBar/preferences.ts | 1.6 KB | bottomInset 88–360 / 默认 104 |
| .../src/modules/bossBar/config-page.ts | 5.5 KB | 配置 popover（exact/phase/segments） |
| .../boss-bar-v131.html | 1.5 KB | 全屏页 DOM |
| .../src/modules/bossBar/README.md | 5.0 KB | 设计取舍自述（modal vs popover、压制、真机缺口） |
| https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/lib/types/Modal.d.ts | 0.2 KB | `disablePointerEvents` 等字段证据 |
| .../lib/types/items/Shape.d.ts | 0.5 KB | 只有 4 种 `ShapeType` 的证据 |
| .../lib/types/Popover.d.ts | 0.6 KB | popover 无穿透的证据 |
| .../lib/types/items/Item.d.ts | 0.9 KB | `Layer` / `AttachmentBehavior` 全集 |

本项目相关落点：

| 文件 | 现有符号（行号按 2026-11-15 工作副本） |
| --- | --- |
| `assets/background.core.js` | `KEY_HP:34`、`registerContextMenu:256`、第 7 节血条 `676-1010`、`barLayout:775`、`buildBarItems:816`、`patchBar:854`、`sweepStaleBars:909`、`syncBars:928`、`watchLocalBars:997` |
| `assets/track.js` | `KEY_HP:27`、`normalizeHp:153`、`hpView`、`applyAction` |
| `assets/glance.js` | `defenses:304-324`、`surges:332`、`surgeValue:329`、SVG 部分 `481-560` |
| `assets/ui.css` | `:root` 变量 `2-15` |
| `dev/test-background.mjs` | 假 OBR harness（`ok/bad`、`record`、`scene.local` 记录） |

---

## 12. 附录 B：给实现者的「先做这 6 件小事」

1. 在 `background.core.js` 顶部加常量 `KEY_HPBAR = NS + "/hp-bar/enabled"`，以及 `readBoss()`、`readDefenses()` 两个纯函数。
2. 把 `barLayout()` 的返回值从「一个条」升级成「一组几何」，**函数签名不变**（`(bounds, dpi, hp)`），只加字段——这样 `syncBars()` 一行都不用改。
3. 把 `buildBarItems()` 拆成 `buildHpRow / buildSurgeRow / buildShields / buildBossRing / buildPlate`，每个返回 `Item[]`，最后 `concat`。
4. `patchBar` 用 `switch (role)`，未知 role 直接 `continue`（老 item 兼容）。
5. `sig` 增加 §6.5 的字段；**只在 sig 变化时写**。
6. 菜单里「移除」写 `false`，`filter` 用 `operator:"!= true"`——这两条能省掉你三个小时的「血条删不干净」调试。

---

## 13. 附录 C：本文未覆盖 / 需真机确认

1. `bossPlacement` 的 `barHeight` 经验值（60/102/144）在非中文系统字体下的实际行高；
2. 全屏 modal 与速览 popover 同时打开时的焦点/层级表现；
3. 环形 + 名牌在 4×4 巨型 token 上是否超出视口（需要按 `OBR.viewport` 做二次夹取，参考实现没做，因为它只画屏底）；
4. 玩家端 `quantiseRatio` 的阶梯在「重伤线 50%」视觉提示上是否够用（可能需要额外的半血刻度，参考实现没有）；
5. iOS/Safari 下 `drop-shadow` / `backdrop-filter` 对 canvas 子层的性能影响（方案 A 不用 CSS，影响面小）。

