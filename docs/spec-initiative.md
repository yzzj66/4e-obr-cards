# 先攻条规格（复刻 FullPeople / obr-suite initiative）

> 目标读者：接手 v1.4.0「先攻条」的开发者。本文只写**怎么抄**，每个结论后面都给出源码出处（文件 + 行号 + 片段），可以直接照着敲。
> 采集时间：2026-11-15。参考实现取自 GitHub `main` 分支（云端读取，非本地缓存）：
> https://raw.githubusercontent.com/FullPeople/obr-suite/main/src/modules/initiative/
> 行号对应采集当日的 main；若上游改动，按函数名 / 常量名搜索即可（本文所有引用都带名字）。

---

## 0. 一句话结论

先攻条 = **一个 top-center 的 popover**（POSITION 锚点 + CENTER/TOP），内部两行：**控制行**（战斗准备 / 突袭 / 上一回合 / 下一回合 / 结束战斗 / 一键清空 / 拖动手柄）+ **横向卡片列表**（56×80 头像卡，当前回合卡高 80→100 向下凸出，左上角加值、底部合计、卡片下方三条掷骰按钮）。
状态存**共享数据**（参考实现放 token metadata + scene metadata；本项目放 room metadata + token metadata），
回合推进**只由 GM 客户端写**，玩家「结束我的回合」发广播请求。

---

## 1. 参考实现清单（含体量，用于估算工作量）

| 文件 | 大小 | 职责 |
|---|---|---|
| `src/modules/initiative/index.ts` | 37,962 B / 917 行 | 后台模块：打开 popover、注册右键菜单、回合变更通知、拖入自动加入、悬浮环清理 |
| `src/modules/initiative/panel-page.tsx` | 34,830 B / 820 行 | popover 页面：展开/收起、宽度自适应、滚轮+拖拽横向滚动、拖拽排序落位计算、回合高亮环、HP 条可见性 |
| `src/modules/initiative/hooks/useInitiative.ts` | 63,060 B / 1513 行 | 全部业务逻辑：数据刷新、排序、掷先攻、开始准备/战斗、回合推进串行队列、权限校验、广播收发 |
| `src/modules/initiative/components/InitiativeItem.tsx` | 11,766 B / 277 行 | 单张卡片（头像、加值、HP 条、合计、掷骰按钮、结束回合按钮） |
| `src/modules/initiative/components/InitiativeList.tsx` | 8,365 B / 218 行 | 列表 / 空状态 / 拖拽排序的槽位与遮挡层 |
| `src/modules/initiative/components/CombatControls.tsx` | 6,779 B / 213 行 | 三种状态的控制行（闲置 / 准备 / 战斗中）+ 二次确认清空按钮 |
| `src/modules/initiative/utils/metadata.ts` | 5,306 B | 元数据读写、tiebreak 生成、HP 字段桥接 |
| `src/modules/initiative/utils/constants.ts` | 2,522 B | 所有 metadata key / broadcast 频道名 |
| `src/modules/initiative/styles/initiative.css` | 28,720 B | 全部尺寸都在这里 |
| `src/modules/initiative/types.ts` | 2,214 B | 三个接口 |
| （独立插件）`Full_initiative_tracker/src/hooks/useInitiative.ts` | 25,372 B / 728 行 | **老版本**：逻辑更简单，可作为「最小可用」参照 |

> 参考实现的 `visualEffects.ts`（20 KB SKSL 着色器 + 环渲染）和 28 KB 样式**不要全搬**：v1.4.0 只需要卡片 + 条，环特效留到以后。

---

## 2. 参考实现的数据模型（逐字摘录）

`src/modules/initiative/utils/constants.ts:1-15` —— **所有键都在这里，照抄命名规则**：

```ts
export const PLUGIN_ID = "com.initiative-tracker";
export const METADATA_KEY = `${PLUGIN_ID}/data`;
export const OPTED_OUT_KEY = `${PLUGIN_ID}/opted-out`;
export const COMBAT_STATE_KEY = `${PLUGIN_ID}/combat`;
export const BROADCAST_COMBAT_START = `${PLUGIN_ID}/combat-start`;
export const BROADCAST_COMBAT_END = `${PLUGIN_ID}/combat-end`;
export const BROADCAST_COMBAT_PREPARE = `${PLUGIN_ID}/combat-prepare`;
export const BROADCAST_TURN_CHANGE = `${PLUGIN_ID}/turn-change`;
export const BROADCAST_END_TURN_REQUEST = `${PLUGIN_ID}/end-turn-request`;
```

`src/modules/initiative/types.ts:1-14` —— **每个 token 一条**，存在 `item.metadata["com.initiative-tracker/data"]`：

```ts
export interface InitiativeData {
  count: number;      // 原始 d20（不是总计！）
  active: boolean;    // 当前回合指针：全场景只能有一个 true
  rolled?: boolean;
  tiebreak?: number;  // [0,1) 稳定随机数，仅用于同分排序
  ownerId?: string;   // 加入时 token 的 createdUserId
  invisible?: boolean;
}
```

`src/modules/initiative/types.ts:16-39` —— 面板实际消费的视图模型（**多了 HP 三件套**）：

```ts
export interface InitiativeItem {
  id, name, count, modifier, active, rolled, visible, imageUrl, tiebreak, ownerId, invisible,
  hp: number; maxHp: number; bubblesLocked: boolean; bubblesHide: boolean;
}
```

`src/modules/initiative/types.ts:41-62` —— 战斗状态（存 **scene metadata**，不是 token）：

```ts
export interface CombatState { inCombat: boolean; preparing: boolean; round: number; }
export interface TurnChangePayload {
  activeOwnerId: string | null; activeName: string | null; activeInvisible: boolean;
  nextOwnerId: string | null; nextName: string | null; round: number;
}
```

**加值单独一个键**（`utils/metadata.ts:49-50`）—— 注意它和 `/data` 平级，不在 `/data` 里：

```ts
const modKey = "com.initiative-tracker/dexMod";
const mod = typeof item.metadata[modKey] === "number" ? item.metadata[modKey] as number : 0;
```

**HP 走 bubbles 的命名空间，双键回退**（`utils/metadata.ts:63-80`，注释写明了那次的 bug）：

```ts
const SUITE_BUBBLES_KEY = "com.obr-suite/bubbles/data";
const BUBBLES_KEY = "com.owlbear-rodeo-bubbles-extension/metadata";
const bm = meta[SUITE_BUBBLES_KEY] ?? meta[BUBBLES_KEY];
// health / "max health" / locked / hide
```

### 2.1 与本项目（v1.3.1）字段对照

本项目已有实现见 `docs/initiative-v13.md` 与 `assets/initiative.js`，**不要把数据搬到 token 上**（那会让你重写全部 v1.3.0 逻辑，见第 9.2 节的风险说明）。

| 参考实现 | 本项目（v1.3.0 已有） | v1.4.0 要加什么 |
|---|---|---|
| `item.metadata["com.initiative-tracker/data"]` | `room.metadata["com.4enext-owlbear/initiative"].entries[]` | — |
| `data.count`（原始 d20） | `entry.init`（**已含加值**，见 `assets/initiative.js:205` `init: rollInitiative(bonus, rng)`） | 新增 `d20`（原始点数，可选），保留 `init` 作为合计，兼容旧数据 |
| `metadata["com.initiative-tracker/dexMod"]` | `item.metadata["com.4enext-owlbear/init"].bonus` | — |
| `data.tiebreak` | 无（靠 `sortEntries` 的 `name` / `updatedAt` 兜底，`assets/initiative.js:79-86`） | 新增 `entry.tb` |
| `data.active` | `room…initiative.activeId` | — |
| `room…initiative.round` | 同 | — |
| `scene.metadata["com.initiative-tracker/combat"]` | 无 | 新增 `room…initiative.phase`（`"idle" / "preparing" / "combat"`），或独立键 `com.4enext-owlbear/init-phase` |

**归一化后的条目结构（v1.4.0 目标）**：

```json
{
  "v": 1, "updatedAt": 1730000000000, "round": 1,
  "phase": "combat",
  "activeId": "token-id",
  "entries": [
    { "tokenId": "t1", "name": "申比软软", "bonus": 25, "d20": 12, "init": 37,
      "tb": 0.2512, "hidden": false, "ownerId": "user-player", "updatedAt": 1730000000000 }
  ]
}
```

* `init = d20 + bonus`（掷的时候一次算好，和 v1.3.0 一致，**不要**改成显示时相加，否则旧数据会全部错位）；
* `d20` 只用于卡片底部公式行 `(12+25)`；旧数据没有 `d20` 时公式行退回 `(37)`；
* `tb` 缺失时按第 7.1 节公式现算并回写。

---

## 3. 先攻条的几何（**照抄这张表就够了**）

### 3.1 popover 常量

`src/modules/initiative/index.ts:189-197`：

```ts
const COLLAPSED_WIDTH = 120;
const COLLAPSED_HEIGHT = 40;
const EXPANDED_WIDTH = 720;
// Reduced 184 → 154 (-30 px) per user request …
const EXPANDED_HEIGHT = 154;
const TOP_OFFSET = 45;
```

`src/modules/initiative/panel-page.tsx:44-58` —— **实际高度按战斗状态分三档**（比后台那个 154 更准）：

```ts
const MIN_EXPANDED_WIDTH = 410;
const HEIGHT_IDLE = 129;      // 无按钮行
const HEIGHT_PREPARING = 139; // 每张卡下面有掷骰按钮
const HEIGHT_COMBAT = 159;    // 掷骰按钮 + 当前卡向下凸出 20px
function heightFor(state) {
  if (state.inCombat) return HEIGHT_COMBAT;
  if (state.preparing) return HEIGHT_PREPARING;
  return HEIGHT_IDLE;
}
```

### 3.2 打开方式（关键：CENTER/TOP + POSITION）

`src/modules/initiative/index.ts:233-258`：

```ts
async function openPanel(expanded: boolean) {
  const width = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  const height = expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
  const vw = await OBR.viewport.getWidth();
  const userOff = getPanelOffset(PANEL_IDS.initiative);   // 用户拖动偏移 dx/dy
  await OBR.popover.open({
    id: POPOVER_ID,                                        // "com.obr-suite/initiative-panel"
    url: `${PANEL_URL}?expanded=${expanded ? 1 : 0}`,
    width, height,
    anchorReference: "POSITION",
    anchorPosition: { left: Math.round(vw / 2) + userOff.dx, top: TOP_OFFSET + userOff.dy },
    anchorOrigin:      { horizontal: "CENTER", vertical: "TOP" },
    transformOrigin:   { horizontal: "CENTER", vertical: "TOP" },
    disableClickAway: true,
    hidePaper: true,
  });
}
```

**为什么是 CENTER + vw/2**：popover 宽度会在运行中被面板自己改（见 3.3），若用 LEFT 锚点，改宽时左边缘不动、整条会向右长；CENTER 锚点则始终以屏幕中线对称伸缩。本项目 `background.core.js:456-469` 的速览窗用的是 `LEFT/TOP`（因为它按 token 定位、只允许拖动），**先攻条不要复用那套**。

### 3.3 宽度自适应公式

`panel-page.tsx:449-466` —— 展开后量一次 DOM 再改宽：

```ts
const cluster = document.querySelector<HTMLElement>(".hbar-cluster");
const w = Math.max(MIN_EXPANDED_WIDTH, Math.ceil(cluster.offsetWidth) + 16); // 16 = 左右各 8px 内边距
OBR.popover.setWidth(POPOVER_ID, w);
```

* 依赖数组是 `[expanded, lang, displayMode, combatState.inCombat, combatState.preparing, combatState.round, items.length]`（`panel-page.tsx:466`）——**人数变了也要重量**，否则新卡被裁掉；
* `MIN_EXPANDED_WIDTH = 410`：少于 410 时控制行会被挤到换行（注释里写了这是实测值）。

### 3.4 折叠态（药丸）

`panel-page.tsx:670-687` + CSS：

```css
.app-pill { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 120px; height: 40px; display: flex; gap: 4px; }
```

折叠态里放：⚔ 图标按钮（点开）+ `R{round}` 或「准备中」徽标 + 拖动手柄（`panel-page.tsx:672-685`）。

### 3.5 卡片尺寸（CSS 原值，直接抄）

`styles/initiative.css`（选择器 → 关键声明）：

| 选择器 | 关键尺寸 |
|---|---|
| `.app-hbar` | `position:absolute; inset:0; display:flex; flex-direction:column; gap:2px; padding:4px 8px 4px; overflow:hidden` |
| `.hbar-row` | `display:flex; align-items:flex-start; gap:6px` |
| `.hbar-row-items` | `min-height:80px; flex:1 1 auto` |
| `.hbar-row-controls` | `padding:0 2px; min-height:30px` |
| `.hbar-cluster` | `display:flex; gap:6px; flex-wrap:nowrap` |
| `.initiative-list` | `display:flex; gap:0; align-items:flex-start; overflow-x:auto; overflow-y:hidden; padding:0 4px; scrollbar-width:none` |
| `.initiative-item` | `width:56px; height:80px; border-radius:6px; border:2px solid rgba(255,255,255,.08); isolation:isolate` |
| `.initiative-item.active` | `height:100px; z-index:2; box-shadow:0 3px 10px rgba(233,69,96,.4)` |
| `.item-img` | `position:absolute; top:0; left:0; right:0; height:80%` |
| `.item-img img` | `position:absolute; top:-12.5%; width:100%; height:125%; object-position:center`（裁掉上下各 10%，只留中间 80%） |
| `.item-img::after` | 底部 `height:30%` 黑色渐变，让合计数字读得清 |
| `.item-count` | `position:absolute; bottom:0; height:24%; border-top:1px solid rgba(255,255,255,.08)` |
| `.item-hp-track` | `position:absolute; left:0; right:0; bottom:24%; height:4px; z-index:2` |
| `.item-mod` | `position:absolute; top:2px; left:2px; padding:1px 4px; font-size:10px; z-index:3` |
| `.roll-buttons` | `position:absolute; top:100%; left:0; right:0; margin-top:-8px; z-index:-1`（**上移 8px 藏一半在卡下**） |
| `.roll-btn` | `flex:1 1 0; height:22px`（露出来 14px） |
| `end-turn-btn` | `position:absolute; top:100%; margin-top:3px; height:18px; font-size:10px; z-index:4` |
| `.drag-handle` | `width:18px; height:26px; border-radius:5px` |

高度账（可以验算）：`80(卡) + 8(按钮藏进去) + 22-8=14(露出的按钮) ≈ 102`，行高 80 起、`hbar-row-items` 至少 80，加上 controls 30 + gap 2 + padding 8 ⇒ 129 / 139 / 159 三档刚好不裁切。

### 3.6 本项目要额外做的夹紧

v1.3.1 brief 已要求「popover 不得超出视口」。先攻条固定贴顶，所以只需夹宽度：

```js
const vw = await OBR.viewport.getWidth();
const width = Math.min(wantWidth, Math.max(MIN_W, vw - 32)); // 左右各 16px
```

---

## 4. 卡片内容与显示公式

`components/InitiativeItem.tsx:99-123`：

```ts
const isActive = active && inCombat;
const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
const showRollButtons = (preparing && canEdit) || (inCombat && isGM && canShowDice);
const disableRoll = !isGM && preparing && diceRolling;
const showEndTurn = !!onEndTurn && isActive && !isGM && canEdit;
```

合计显示（`InitiativeItem.tsx:216-228`）——**"final" 模式**：

```tsx
<span className="count-display">{Math.round(count + modifier)}</span>
<span className="count-formula">({Math.round(count)}{modifier >= 0 ? "+" : ""}{modifier})</span>
```

* 大数字 = `round(count + modifier)`；小字 = `(count+mod)`；
* `count` 允许是小数（拖拽排序写中点），**显示必须 round，排序不能用 round 后的值**（`useInitiative.ts:144-151` 注释解释了原因）；
* 本项目：大数字 = `entry.init`，小字 = `(entry.d20+entry.bonus)`；无 `d20` 时小字只显示 `(init)`。

HP 条（`InitiativeItem.tsx:174-181`）：

```tsx
{hpRatio != null && (
  <div className="item-hp-track" aria-hidden="true">
    <div className="item-hp-fill" style={{ width: `${Math.max(0, Math.min(1, hpRatio)) * 100}%` }} />
  </div>
)}
```

`hpRatio` 的**完整可见性规则**在 `panel-page.tsx:157-180`（决定玩家能不能看到血条百分比，含量化公式）：

```ts
if (item.maxHp <= 0) return null;
const ratio = Math.max(0, Math.min(1, item.hp / item.maxHp));
if (item.bubblesHide && !isGM) return null;                 // DM 标了 hide：谁都别想看到
if (isGM || ownsItem) return ratio;                          // GM / 本人：真实比例
if (item.bubblesLocked) {
  if (!(inCombat || preparing)) return null;                  // 锁 + 闲置：不显示
  const step = playerThreshold / 100;                         // scene metadata 里的阈值（默认 25）
  if (step >= 1) return ratio > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, Math.ceil(ratio / step) * step)); // 向上量化到档位
}
return ratio;
```

本项目 v1.6.0 才做血条，**v1.4.0 先留空槽**（`bottom:24%` 那条 4px 位置先不放元素），避免和 hpBar 任务撞车。

---

## 5. 权限矩阵（照抄，别自己发明）

`useInitiative.ts:869-899`（编辑权 + 二次校验）：

```ts
const canEdit = (item) => isGM ? true : (!!playerId && item.ownerId === playerId);

// updateEditableValue 里还会重新校验一次（SDK 回调前会重新取快照，归属可能已变）：
const allowed = (item) => {
  const data = item.metadata[METADATA_KEY];
  if (item.id !== itemId || !data) return false;
  const owner = item.createdUserId || data.ownerId || "";     // 活值优先！
  return (role === "GM" && isGMRef.current) || (!!pid && pid === owner);
};
```

> **`item.createdUserId` 优先于存下来的 `ownerId`**（`utils/metadata.ts:91-96` 的注释）：GM 用 Owlbear 的「Give Ownership to Player」改归属后，旧 `ownerId` 会失效，玩家会丢按钮。本项目同样要 `ownerId: item.createdUserId || entry.ownerId`。

| 操作 | 谁能点 | 谁写数据 |
|---|---|---|
| 加入 / 隐形加入 | GM | GM 的 background（v1.3.0 已有） |
| 掷先攻 / 重掷 / 上移下移 / 设为当前 / 删除 / 清空 / 上一回合 / 下一回合 / 战斗准备 / 开始战斗 / 结束战斗 | GM | 面板页直接写 room metadata（v1.3.0 已有） |
| 结束我的回合 | 玩家（且当前条目 ownerId == 自己） | **不写**，发 `com.4enext-owlbear/init-request`，GM 校验后代写 |
| 拖拽排序 | GM | 面板页写 `init`(可小数) + `tb` |
| 改加值 / 改合计 | GM 或该 token owner | 同左（v1.4.0 可先只给 GM，卡上点击编辑） |

玩家「结束回合」在 GM 侧的**四道校验**（参考实现踩过坑，`useInitiative.ts:766-790`）：

```ts
const reqActive = event.data?.activeId;
const curActive = allItemsRef.current.find((i) => i.active)?.id;
if (!reqActive || !curActive || reqActive !== curActive) return;   // 缺失 / 过期都拒绝
if (optimisticActiveIdRef.current && optimisticActiveIdRef.current !== curActive) return; // 正在推进中
advanceTurnRef.current(1);
```

注释里写明了老代码 `if (reqActive && curActive && reqActive !== curActive) return;` 是**写反的**，导致「缺失 id 时直接放行 → 推进两次 → 瞬间跳到无关角色」（bug 2026-05-21）。本项目 `background.core.js` 已有三条校验（`docs/initiative-v13.md:90-93`），v1.4.0 **补第 4 条（正在推进中忽略）**。

---

## 6. 回合推进算法（含竞态处理，最值得抄的一段）

`useInitiative.ts:1305-1335` —— 只看指针怎么算：

```ts
const visible = allItemsRef.current.filter((i) => i.visible || i.invisible);
if (visible.length === 0) return;
const currentId = optimisticActiveIdRef.current ?? visible.find((i) => i.active)?.id ?? null;
const currentIndex = currentId ? visible.findIndex((i) => i.id === currentId) : -1;
const len = visible.length;
const nextIndex = dir === 1
  ? (currentIndex + 1 + len) % len
  : (currentIndex <= 0 ? len - 1 : currentIndex - 1);
const nextId = visible[nextIndex].id;

let nextRound = null;
const round = combatStateRef.current.round;
if (dir === 1 && nextIndex === 0) nextRound = round + 1;                       // 绕回第一张 → 轮数 +1
if (dir === -1 && nextIndex === len - 1 && currentIndex === 0 && round > 1) nextRound = round - 1; // 从第一张往回 → 轮数 -1
optimisticActiveIdRef.current = nextId;   // 先把「下一次点击看到的指针」推上去
```

写入部分（`useInitiative.ts:1341-1403`）——**串行队列 + 先写指针后写轮数 + 失败回滚**：

```ts
turnWriteChainRef.current = turnWriteChainRef.current.then(async () => {
  autoActivateLocked.current = true;                     // 写期间禁止自动接管
  try {
    await setActiveItemFromIds(nextId, prev);
    lastWrittenActiveIdRef.current = nextId;
    if (nextRound !== null) await writeCombatState({ round: nextRound });  // 指针写成功才动轮数
    broadcastFocus(nextId).catch(() => {});
    void notifyTurnChange(visible, nextIndex, nextRound ?? round);
  } catch (e) {
    if (optimisticActiveIdRef.current === nextId) optimisticActiveIdRef.current = currentId; // 回滚
    OBR.notification.show("切换回合失败，已回退本地指针", "ERROR").catch(() => {});
  } finally {
    setTimeout(() => { autoActivateLocked.current = false; }, 350);       // 等 onChange 落定再解锁
  }
});
```

**三条硬要求**：

1. **指针写 + 轮数写是两个请求**（本项目是**一个** room metadata 写入，比参考实现更简单，直接用一次 `writeInitiative(state)` 原子完成，不用队列）；
2. `autoActivateLocked` 仍然是必需的：面板刷新时若看到「没有任何 active」，GM 会被自动接管逻辑抢走指针（`useInitiative.ts:403-441` 的 auto-activate）。本项目只需要在 `writeInitiative` 前后加 3 秒的 `writingRef` 抑制；
3. 视图高亮与镜头**等写入返回再动**（参考实现明确写了「No optimistic UI」，`useInitiative.ts:1297-1304`）。

**参考实现每次推进写全部条目**（`useInitiative.ts:1129-1145`，注释：只写 prev/next 两张会让残留的 `active=true` 变成「两个当前」bug）。本项目因为指针是 `activeId` 单字段，**天然只有一个**，这是本项目数据模型的优势，规格里要写清「不要为了抄而改成逐 token active 字段」。

镜头跟随（`useInitiative.ts:808-825`）：

```ts
const pos = targetItems[0].position;
OBR.viewport.animateTo({
  position: { x: -pos.x * currentScale + vpWidth / 2, y: -pos.y * currentScale + vpHeight / 2 },
  scale: currentScale,
});
```

（本项目 `background.core.js:364-374` 已有 `anchorOf()` / `transformPoint`，可直接复用换算。）

---

## 7. 排序与拖拽重排（公式都在这里）

### 7.1 tiebreak 生成公式

`utils/metadata.ts:5-28`（注释是一份完整的「为什么」）：

```ts
// tiebreak = 0.5 − modifier × 0.01 + jitter
export function genTiebreak(modifier: number = 0): number {
  const m = Number.isFinite(modifier) ? modifier : 0;
  const base = 0.5 - m * 0.01 + Math.random() * 0.008;
  return Math.max(0.001, Math.min(0.999, base));
}
```

要点：**加值越高 → tiebreak 越小 → 同分时排越前**（等价于「敏捷高的先动」），抖动 `< 0.01` 保证同加值的稳定随机；夹在 `(0.001, 0.999)`。
老版本（`Full_initiative_tracker:44-48`）是纯 `Math.random()` + 三层排序，**不要抄那个**。

### 7.2 排序比较函数

`useInitiative.ts:152-157`：

```ts
function sortInitiative(a, b) {
  const totalA = a.count + a.modifier, totalB = b.count + b.modifier;
  if (totalA !== totalB) return totalB - totalA;   // 合计降序
  return a.tiebreak - b.tiebreak;                  // 同分：tiebreak 升序
}
```

**只有两级**。老版本的三级（中间夹一层 `modifier DESC`）已被删掉，原因写在 `useInitiative.ts:140-151`：多一层会让「把卡拖到两张同分卡中间」永远落不准。

本项目对应写法（`entry.init` 已是合计）：

```js
entries.sort((a, b) => (b.init - a.init) || (a.tb - b.tb) || String(a.name).localeCompare(String(b.name), "zh-CN"));
```

### 7.3 拖到「两张卡之间」的落位公式

`panel-page.tsx:239-268`（**这段是核心，逐字抄**）：

```ts
const above = items[slotIndex - 1];    // 上面那张
const below = items[slotIndex];        // 下面那张
const aboveTotal = above ? above.count + above.modifier : null;
const belowTotal = below ? below.count + below.modifier : null;
let targetTotal, targetTiebreak = picked.tiebreak;
if (aboveTotal != null && belowTotal != null) {
  if (aboveTotal === belowTotal) {                  // 同分组内：靠 tiebreak 插到中间
    targetTotal = aboveTotal;
    targetTiebreak = (above.tiebreak + below.tiebreak) / 2;
  } else {
    targetTotal = (aboveTotal + belowTotal) / 2;    // 不同合计：取中点（可以是 .5）
  }
} else if (aboveTotal != null) {
  targetTotal = aboveTotal - 1;                     // 拖到最底
} else if (belowTotal != null) {
  targetTotal = belowTotal + 1;                     // 拖到最顶
} else {
  return;                                           // 只有一张卡，无处可放
}
void setSortKey(pickedId, targetTotal - picked.modifier, targetTiebreak);  // 加值不动
```

写回（`useInitiative.ts:908-919`，GM-only）：

```ts
await OBR.scene.items.updateItems([itemId], (drafts) => {
  for (const d of drafts) {
    const existing = d.metadata[METADATA_KEY];
    d.metadata[METADATA_KEY] = { ...existing, count, tiebreak };
  }
});
```

**两张卡互换**（`panel-page.tsx:273-285`）：各自取对方的 `total + tiebreak`，`count = 对方total − 自己modifier`。

**槽位交互**（`InitiativeList.tsx:147-205`）：槽位 `s` 在 `items[s-1]` 与 `items[s]` 之间；有卡被拿起时，**紧贴被拿卡的两个槽位是惰性的**——

```tsx
const adjacentToPicked = pickedIdx >= 0 && (index === pickedIdx || index === pickedIdx + 1);
const active = pickedIdx >= 0 && !adjacentToPicked;
```

槽位 CSS：`flex:0 0 5px; min-height:88px`，激活时 `:hover { flex-basis:18px }`；被拿起的卡 `outline:2px dashed #f5d76e; outline-offset:-2px`；光标跟随箭头 `position:fixed; z-index:9999; transform:translate(-4px,-4px)`。

### 7.4 本项目注意

`assets/initiative.js:78-86` 现在的 `sortEntries` 用在**加入 / 重掷**时；手动上移下移直接改数组顺序。
v1.4.0 建议：**数组顺序不再当权威**，改成每次渲染 `sortEntries()`（先按 `init` 降序、`tb` 升序）；上移下移 = 写 `init` 中点（和拖拽同一套公式，只是槽位变成相邻一张）。这样「拖拽 / 上下移 / 重掷」三套操作共享一套数学。

---

## 8. 掷先攻

`useInitiative.ts:46-59`（本地掷）：

```ts
function localRoll(type) {
  const r1 = Math.floor(Math.random() * 20) + 1;
  if (type === "normal") return { rolls: [r1], winnerIdx: 0, finalValue: r1 };
  const r2 = Math.floor(Math.random() * 20) + 1;
  if (type === "advantage") {
    const winnerIdx = r1 >= r2 ? 0 : 1;
    return { rolls: [r1, r2], winnerIdx, finalValue: Math.max(r1, r2) };
  }
  const winnerIdx = r1 <= r2 ? 0 : 1;
  return { rolls: [r1, r2], winnerIdx, finalValue: Math.min(r1, r2) };
}
```

* 三种模式：`normal / advantage / disadvantage`，对应按钮 `roll-normal / roll-adv / roll-dis`；
* Dice+ 表达式映射（`useInitiative.ts:32-38`）：`1d20` / `2d20kh1` / `2d20kl1`；
* **存储的 count 永远是原始 d20**，加值只在显示 / 排序时加（注释 `useInitiative.ts:955-967`、`index.ts:844-850` 反复强调，写错就是「加值被算两次」）；
* 本项目 `assets/initiative.js:36-45` 已经是 `init = d20 + bonus`，**保持**；新增 `d20` 字段用于公式行即可。

暗骰 / 隐形单位（`useInitiative.ts:1046-1053`）：`hidden: isInvisible || isGlobalDarkRollEnabled()` —— 只发给 DM 本地，玩家连骰子动画都看不到。本项目 v1.4.0 若还没有骰子视觉，**至少别广播点数**（`init-request` 之外的广播都别带 `init`）。

---

## 9. 与本项目现有代码的接入点

### 9.1 文件分工（沿用 v1.3.1 的「分块窗口」）

| 文件 | 现状 | v1.4.0 改动 |
|---|---|---|
| `assets/initiative.js` | 数据模型 + 掷骰 + 回合推进 + `renderInitiativeHTML()`（竖列表） | **新增** `renderStripHTML()`（横向卡片条）+ `tb` / `advance` 增强；保留旧渲染给窄窗兜底 |
| `initiative.html`（v1.3.1 新建） | 独立窗口 | 顶部条容器 `#strip`，加载新的条渲染 + 拖动/滚轮脚本 |
| `assets/background.core.js` | 右键两菜单 + `init-request` 处理 + popover 打开 | 新增：`openStrip()` / `closeStrip()`、`OBR.popover.open` 条、拖动节流、位置记忆、视口变化重开 |
| `assets/common.js` | `KEY_INIT` / `KEY_INITIATIVE` / `CH_INIT_REQUEST` | 新增 `ID_STRIP` / `STRIP_POS_KEY` / `CH_STRIP_DRAG` |
| `assets/ui.css` / 新建 `strip.css` | — | 抄第 3.5 节尺寸表 |
| `dev/check.mjs` | 常量对齐 / 语法检查 | 新增断言：条常量、popover id、卡片尺寸、拖拽公式存在 |

### 9.2 **不要**把数据模型搬到 token metadata 上

参考实现把每条存在 token 上，是因为它要和「bubbles / bestiary / 角色卡绑定」共享同一批 token 元数据，且它没有房间数据预算问题。
本项目 v1.3.0 已经把权威数据放在 `room.metadata`，并且**玩家不写**（`docs/initiative-v13.md:82-93`）。
若为了照抄而改成 token metadata，会同时踩三个坑：
1. 玩家加入先攻需要写别人的 token（Owlbear 只允许 owner / GM 改），必须全改成「玩家发请求、GM 代写」，等于重写 v1.3.0 全部逻辑；
2. 每个 token 一条会带来「谁是当前」「轮数」两个全局状态无处安放，参考实现是用 scene metadata 兜的；本项目没有这个键；
3. 隐形条目在参考实现里靠 `item.visible=false` 隐藏，会**真的把 token 从玩家画布上抹掉**（`index.ts:522-535`），与用户明确要求「隐形加入不影响地图可见性」（`docs/initiative-v13.md:76`）冲突。

**结论：沿用 room metadata，只借参考实现的「卡片 UI + 排序数学 + 回合推进细节」。**

### 9.3 房间数据预算

`initiative.js:26-27` 已封顶 `INIT_MAX_ENTRIES = 200`、名字 80 字符。新增 `d20` / `tb` / `phase` 后单条约 180–220 B，200 条 ≈ 44 KB —— **超过 Owlbear 房间数据 16 KB 的常见上限**（v1.3.0 文档写的是「一条不到 200 字节，200 条封顶」，本来就是按 16 KB 估的）。
必须在本版**收紧**：`INIT_MAX_ENTRIES` 改 **60**（12 KB 以内），并在 `normalizeInitiative` 里截断 + 写不进去时降级本地并提示（沿用 README 的降级机制）。

---

## 10. 分阶段实现步骤（每阶段可独立验收）

### P0 — 数据层扩展（0.5 天）
1. `normalizeInitiative` 增加 `phase`（`"idle"` 默认）、条目 `d20` / `tb`（缺省不写，读时现算）；
2. `genTiebreak(bonus)` 抄 7.1 公式；`sortEntries` 改成两级（`init` 降序、`tb` 升序）；
3. `entryFromItem` / `rerollEntry` 同时写 `d20` 与 `tb`；
4. `INIT_MAX_ENTRIES` → 60。

**验收**：`node dev/test-initiative.mjs` 全绿 + 新增「同分同加值时 tiebreak 稳定」「旧数据无 tb 也能排」两条断言。

### P1 — 先攻条骨架（1 天）
1. `background.core.js` 加 `openStrip()`：popover id `com.4enext-owlbear/initiative-strip`，`width/height = 720/129`，CENTER/TOP + `top:45`，`disableClickAway:true`、`hidePaper:true`；
2. `initiative.html` 里放 `.strip` 容器：控制行（占位按钮）+ `.initiative-list`（先渲染空卡）；
3. 面板内 `OBR.popover.setWidth/setHeight` 按 state 三档（129/139/159），展开宽度 = `max(410, cluster.offsetWidth+16)`；
4. 位置记忆：`localStorage["4enext/strip-pos"] = {v:1, dx, dy}`（只存相对屏幕中线的偏移，不存绝对 left）。

**验收**：`node dev/check.mjs` 断言 popover 常量与 CSS 尺寸；房间内 1366×768 不溢出。

### P2 — 卡片渲染 + 掷先攻（1.5 天）
1. `renderStripHTML`：头像（`item.image.url`，取不到用名字首字）、左上加值、底部合计 + 公式行、当前卡 `.active`；
2. 三档高度随 phase 切换；当前卡 `scrollIntoView({behavior:"smooth", block:"nearest", inline:"nearest"})`（`InitiativeItem.tsx:77-81`）；
3. 卡片下方三个掷骰按钮（红/灰/绿，`-8px` 上移），点完重掷并重排；
4. 滚轮 → 横向滚动（`wheel` + `preventDefault`，clamp），拖拽 → `scrollLeft`，4px 死区、32px 过冲、220ms ease-out 回弹（`panel-page.tsx:492-612`）。

**验收**：20 张卡不裁切、滚轮 / 拖拽都能滚、点卡片能聚焦 token。

### P3 — 战斗流程与回合推进（1.5 天）
1. 控制行三态（闲置：战斗准备 + 突袭 + 一键清空；准备：开始战斗 + 取消；战斗：上一回合 / 下一回合 / 结束战斗 / 一键清空）；
2. `startPreparation`：清空所有 `init/d20/active`，`phase="preparing"`，`round=0`；`startCombat`：取排序后第一张设为 `activeId`，`phase="combat"`，`round=1`；
3. `advanceInitiative` 抄 6 节公式（绕回 +1 轮）；
4. 玩家「结束我的回合」：面板发 `CH_INIT_REQUEST {activeId, playerId}`；GM 侧四道校验（补「正在推进」一条）；
5. 镜头跟随（复用 `background.core.js` 的 `anchorOf` / `transformPoint` 或 `animateTo` 公式）。

**验收**：双客户端（GM + 玩家）轮流点，指针不跳、轮数不错；玩家点自己以外的人被拒并提示。

### P4 — 拖拽排序（1 天）
1. GM 打开「更改排序」后，列表进入 pick/place 模式（`.reorder-catch` 覆盖行内按钮）；
2. 槽位 + 中点公式（7.3）+ 两张卡互换；
3. 写回 `init`（允许小数）+ `tb`，显示仍 `Math.round`；
4. 退出排序 / 关闭窗口清空 `pickedId`。

**验收**：把最后一名拖到第一名正上方、拖进同分组内、拖到最底三种情况落位都正确；连续拖 5 次顺序不乱。

### P5 — 隐形 / 通知 / 收尾（1 天）
1. 隐形条目：GM 卡片 `is-invisible`（灰度 0.6 + 亮度 0.85），玩家不渲染、名字「？？？」，当前回合时也不广播名字；
2. 回合通知：`OBR.notification.show("你的回合：X","INFO")` / 「做好准备，即将轮到：X」（`index.ts:656-670`）；
3. 拖入自动加入（可选，`index.ts:762-903` 有完整实现：冷启动 guard、批量写、暗骰）；
4. 文档 + README 功能表 + `dev/selftest.mjs` 全绿。

**验收**：`node dev/selftest.mjs` exit 0；GM 离线时玩家点结束回合有明确提示（不能静默）。

---

## 11. 风险与对策

| # | 风险 | 证据 / 原因 | 对策 |
|---|---|---|---|
| 1 | **房间数据 16 KB 上限** | v1.3.0 已按 200 条设计（`initiative.js:26`），新增字段后必然超 | 降到 60 条；`setMetadata` 抛错时降级 localStorage + 顶部提示；`normalizeInitiative` 截断不抛错 |
| 2 | **玩家写不了 room metadata** | `docs/initiative-v13.md:86` | 所有玩家动作走广播请求；GM 离线时按钮置灰 + 文案（`_v131-brief.md` 也要求「不允许静默无响应」） |
| 3 | **两个写者抢指针** | 参考实现为此专门做了串行队列（`useInitiative.ts:1297-1403`） | 本项目单键写入天然原子，但仍要 `writingRef` 3 秒抑制 + 玩家请求四道校验 |
| 4 | **popover 高度裁切** | 129/139/159 是三档实测值；按钮行被裁会点不到 | 用 `heightFor(state)` 而不是固定 154；`overflow:hidden` 在 `.app-hbar`，任何加内容都要重算高度 |
| 5 | **宽度自适应测不到** | 量 `.hbar-cluster` 需要 DOM 已布局 | `requestAnimationFrame` 里量 + `Math.max(410, …)`；依赖里带 `items.length` |
| 6 | **拖拽与点击冲突** | 卡片内还有输入框 / 按钮 | 4px 死区 + `target.closest("button, input, .item-mod, .item-count")` 直接跳过 |
| 7 | **隐形信息泄漏** | 参考实现为此写了两层（不广播名字 + 镜头改看 bbox） | v1.4.0 最低要求：玩家列表不渲染、当前回合显示「？？？」、广播不带名字；镜头方案可延后 |
| 8 | **旧数据兼容** | v1.2.2 绑定的 token 没有 `KEY_INIT`（`docs/initiative-v13.md:19-21`） | 保留 `syncInitBonuses()`；`tb`/`d20` 缺失走默认值，绝不 throw |
| 9 | **与并行任务冲突** | 骰子（v1.5）也要改 `background.core.js` / `common.js` | 先加常量、后加逻辑；`dev/check.mjs` 常量对齐断言必须同步加，否则 bundle 与 core 会静默分叉 |
| 10 | **无真机验证** | v1.3.0 已知限制第 4 条 | 每阶段都在真实房间验一次 popover 锚点 / 高度 / 右键菜单；`background.html` 记得改 `?v=` 缓存参数 |

补充说明（第 1 条的量级）：一条 `{tokenId(约 24 B), name(≤80 字符), bonus, d20, init, tb, hidden, ownerId(约 24 B), updatedAt}` 的 JSON 约 180–220 B。60 条 ≈ 11–13 KB，留出 `cards` 键的余量后仍在 16 KB 内；120 条就会顶到上限。

---

## 12. 验收自测清单（追加到 `dev/`）

1. `genTiebreak(10) < genTiebreak(0)`（加值高 → tb 小）且都在 `[0.001, 0.999]`；
2. `sortEntries` 两级排序：同 `init` 时 `tb` 小的在前；`tb` 缺失不报错；
3. `advanceInitiative` 越过末尾 `round+1`、从第一张往回 `round-1`（最小 1）；
4. 拖拽落位：`aboveTotal === belowTotal` 时只改 `tb`、不改 `init`；不同时 `init = (a+b)/2`；
5. 拖到最顶 / 最底：`±1`；
6. `INIT_MAX_ENTRIES = 60` 截断生效，`normalizeInitiative` 对坏数据不抛错；
7. 面板 popover 参数：id / width / height / anchorOrigin / transformOrigin 与规格一致；
8. CSS 存在 `.initiative-item{width:56px;height:80px}`、`.initiative-item.active{height:100px}`、`.item-count{bottom:0;height:24%}`；
9. 玩家渲染结果不含 `hidden` 条目的名字；
10. `node dev/selftest.mjs` 全绿（4/4，exit 0）。

---

## 13. 附录：证据索引（按文件）

**obr-suite `src/modules/initiative/`**
* `index.ts:117` popover id `com.obr-suite/initiative-panel`；`:189-197` 尺寸常量；`:233-258` `openPanel`；`:292-373` 加入/移出菜单（filter `{key:["metadata",METADATA_KEY], value:undefined}`）；`:455-537` 隐形切换（同时改 `d.visible`）；`:544-591` 隐形加入；`:642-678` 回合通知；`:762-903` 拖入自动加入。
* `hooks/useInitiative.ts:46-59` localRoll；`:152-157` sortInitiative；`:192-215` 玩家视角过滤；`:344-446` refreshItems（自动接管 tiebreak / auto-activate）；`:808-867` focus / broadcastFocus；`:869-899` canEdit + 二次校验；`:908-919` setSortKey；`:923-1064` rollInitiativeLocal（延迟写入 count）；`:1119-1148` setActiveItemFromIds（写全部）；`:1160-1276` 准备 / 开战；`:1305-1403` advanceTurn；`:1416-1429` requestEndTurn；`:1458-1474` clearAll。
* `utils/metadata.ts:24-28` genTiebreak；`:46-103` itemToInitiativeItem（含双键 HP）；`:105-139` 读写 + combat state。
* `panel-page.tsx:32-58` 尺寸；`:157-180` resolveHpRatio；`:239-285` 落位 / 互换；`:299-336` 展开收起；`:449-466` 宽度自适应；`:492-612` 滚轮 + 拖拽。
* `components/InitiativeItem.tsx:99-123` 按钮可见性；`:174-181` HP 条；`:216-228` 合计公式。
* `components/InitiativeList.tsx:147-205` 排序模式槽位。
* `styles/initiative.css` 全部尺寸见第 3.5 节表。

**Full_initiative_tracker（老版，仅作对照）**
* `src/hooks/useInitiative.ts:44-58` 纯随机 tiebreak + 三级排序；`:511-528` 只写 prev/next 两张；`:620-661` 先写轮数后写指针；`:674-683` 结束回合。

**本项目现有实现**
* `assets/initiative.js:36-45` `rollD20` / `rollInitiative`；`:48-76` `normalizeInitiative`；`:79-86` `sortEntries`；`:118-140` `advanceInitiative`；`:182-210` `bonusOfItem` / `entryFromItem`；`:274-290` 读写房间数据；`:340-408` `renderInitiativeHTML`。
* `assets/background.core.js:169-216` 打开面板 / 浮动按钮；`:246-322` 右键菜单；`:336-497` 速览窗拖动 + 位置记忆 + 夹紧（`clampInfoPos`）。
* `manifest.json` 的 `action.popover` 指向 `panel.html?tab=init`，v1.3.2 起应改为独立入口。
