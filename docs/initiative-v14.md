# 先攻条（v1.4.0）实现说明

> 规格来源：`docs/spec-initiative.md`（照抄 FullPeople/obr-suite 的先攻条）。
> 本文只写**这个插件里怎么落地的**、和规格的差异、以及自测覆盖。规格本身不改。

## 1. 一句话

v1.4.0 把「先攻」从一个大窗口改成了**屏幕顶部的横向先攻条**：折叠是 120×40 的小药丸，
展开是 720 宽、高度按战斗状态 129 / 139 / 159 三档；左端「战斗准备 / 突袭 / 一键清空」，
战斗态「上一回合 / 下一回合 / 结束战斗」，中间是 56×80 的头像卡（当前回合 100 高并高亮），
卡片可拖拽排序；GM 能推进任意回合，玩家「结束自己的回合」只发广播、不写数据。

v1.3.x 的**列表窗口还在**（`initiative.html?view=list`，popover id `/initiative-window`），
先攻条右侧的「≡」打开它 —— 重掷全部 / 同步加值 / 上移下移 / 删除 / 清空这些管理动作在那里。

## 2. 入口与 popover 参数

| 项 | 值 |
| --- | --- |
| 工具栏「先攻」 | 打开**先攻条**（`assets/background.core.js` 的 `openStrip()`） |
| 右键「加入先攻 / 隐形加入先攻」 | 写房间数据；先攻条没开着就顺手打开 |
| 先攻条上的「≡」 | 广播 `CH_STRIP_CMD {op:"list"}` → 后台打开列表窗口 |
| popover id | `com.4enext-owlbear/initiative-strip`（与列表窗口的 `/initiative-window` 不同，可同时开） |
| 页面 | `initiative.html`（同一张页面，`?view=list` 时显示列表外壳） |
| 锚点 | `anchorReference: "POSITION"` + `anchorOrigin / transformOrigin = CENTER / TOP` |
| 位置 | `anchorPosition = { left: 视口中线 + dx, top: 45 + dy }` —— **left 是中线**，不是左边缘 |
| 尺寸 | 折叠 120×40；展开 720×（129 idle / 139 preparing / 159 combat），最小 410，按视口 −32 夹紧 |
| 位置记忆 | `localStorage["4enext/strip-pos"] = { v:1, dx, dy }`（只存相对中线 / 相对 45 的偏移） |
| 拖动 | 拖动柄 ⠿ → 页面发 `CH_STRIP_DRAG {phase, dx, dy}` → 后台重开同一个 popover（只换 anchorPosition）；双击拖动柄回中 |
| 折叠状态 | `localStorage["4enext/strip-collapsed"]`（只在本机） |

宽度自适应照规格 §3.3：展开后量一次控制行 `.strip-ctl` 的 `scrollWidth`，宽度 = `max(410, 测量值+16)`，
再夹到视口 −32 与 720 之间；高度只由 phase 决定（`stripHeightFor()`）。

## 3. 数据结构（房间数据）

`room.metadata["com.4enext-owlbear/initiative"]`：

```json
{
  "v": 1, "updatedAt": 1730000000000,
  "phase": "idle|preparing|combat",
  "round": 1, "surprise": false,
  "activeId": "token-id",
  "entries": [
    { "tokenId": "t1", "name": "申比软软", "bonus": 25, "d20": 12, "init": 37,
      "tb": 0.2512, "hidden": false, "ownerId": "user-player", "updatedAt": 1730000000000 }
  ]
}
```

* **键名一个都没改**，只新增 `phase` / `surprise` / `d20` / `tb`；旧数据缺字段一律按默认值（`idle`、`d20: null`、`tb: null`），不报错。
* `init = d20 + bonus`，**掷的时候一次算好**；旧数据没有 `d20` 时卡片底部公式行退回 `(37)`。
* `init` 允许小数：拖拽排序写的是「两卡中点」，显示一律 `Math.round`（规格 §4 / §7.3）。
* `tb`（tiebreak）= `0.5 − bonus×0.01 + 随机×0.008`，夹在 `.001 ~ .999`：加值越高越靠前，同分时稳定。缺 `tb` 按 0.5 参与排序。
* **条目上限 60**（`INIT_MAX_ENTRIES`）：60 条约 11~13 KB，留出 `cards` 键的余量后仍在房间数据 16 KB 内。
  `normalizeInitiative` 直接截断、不抛错；写不进去时降级到本机 `localStorage["4enext/state/initiative"]` 并弹 WARNING
  （`writeInitiative` 不抛错，返回的状态带 `.local = true`）。

## 4. 卡片（规格 §3.5 / §4）

```
56×80 的卡：头像占 80%（上下各裁 10%）、左上加值、底部合计 + 公式行
当前回合：height 100、向下凸出、z-index 2、红色投影
底部 24%：合计 + 公式行 (12+25)；血条 4px 贴在 24% 上沿
卡片下方：掷骰按钮（劣势 / 普通 / 优势，上移 8px 藏在卡下，露出 14px）
玩家的当前回合：卡片下方「结束」按钮（18 高）
```

* 头像：`item.image.url`；拿不到时用名字首字（`.item-initial`）。
* 血条：token 上有 `com.4enext-owlbear/hp` 的 `{cur,max}` 就按比例画；没有就留一条空槽
  （规格说 v1.4.0 先留空槽，这里因为血量追踪 v1.2.0 就有了，有数据时直接画，不影响别的功能）。
* 公式行：`(d20+加值)`；准备阶段还没掷时合计显示「—」、公式行 `(?)`。
* 隐形条目：GM 卡片加 `.is-invisible`（灰度 + 右上角「隐」）；玩家**不渲染**，如果当前回合是隐形单位，
  只在列表最前面放一张虚线「？？？」占位卡（**名字 / 点数都不进 DOM**）。

## 5. 排序与拖拽（规格 §7）

* 排序恒为两级：`init` 降序 → `tb` 升序（再同分才用名字 / 更新时间稳定）。`sortEntries()` 是唯一实现。
* 「数组顺序不再当权威」：读房间数据、写房间数据、每次渲染都过一遍 `sortEntries`（`sortState()`）。
  于是拖拽 / 上移下移 / 重掷共用同一套数学。
* 拖拽（仅 GM、仅展开态）：4px 死区；指针位置决定「去掉自己之后的第 k 个位置」，落下时调 `reorderEntry(state, id, k)`：
  * 上下都有、合计不同 → `init = (above + below) / 2`；
  * 上下同分 → `init` 不变，`tb = (above.tb + below.tb) / 2`；
  * 只有上面（拖到最底）→ `above − 1`；只有下面（拖到最顶）→ `below + 1`。
* 上移 / 下移 = 槽位相邻的同一函数（不搬数组，避免下次排序把顺序吃掉）。
* 落位指示用 `.drop-mark`（绝对定位，不占布局，不会让卡片在拖动时抖动）。

## 6. 战斗流程与回合推进

| phase | 高度 | 控制行（GM） |
| --- | --- | --- |
| `idle` | 129 | 战斗准备 / 突袭 / 开始战斗 / 一键清空 |
| `preparing` | 139 | 开始战斗 / 取消准备 / 一键清空；每张卡下有掷骰按钮 |
| `combat` | 159 | ‹ 上一回合 / 下一回合 › / 结束战斗 / 一键清空；当前卡高 100 |

* **战斗准备**（`startPreparation`）：所有条目 `init=0, d20=null`、`activeId=""`、`phase=preparing`、`round=1`，
  显示「准备中」；卡片合计显示「—」。
* **开始战斗**（`startCombat`）：没掷过的自动 `d20 + bonus`，排序后第一张设为当前，`phase=combat, round=1`。
* **突袭**（`startSurprise`）：同上但 `surprise=true`，徽标显示「突袭轮」；绕回第一张时自动变回正常第 1 轮。
* **结束战斗 / 取消准备**（`endCombat`）：回 `idle`、清指针、保留名单。
* **一键清空**：连名单一起清，**要点两次**（第一次只把按钮变成「再点一次清空」，4 秒后自动取消）。
* **回合推进**：`nextIndex = (cur + 1 + len) % len`；从最后一张绕回第一张 → 轮数 +1；
  从第一张往回 → 轮数 −1（最小 1）。GM 的「上一回合 / 下一回合」不受归属限制（**GM 可推进任意回合**），
  点卡片也能直接把当前指针设过去（仅 `combat` 阶段）。
* 容器用 `overflow: hidden`，任何新加内容都要重新算三档高度（规格 §11 第 4 条）。

## 7. 权限（规格 §5）

| 操作 | 谁能做 | 谁写数据 |
| --- | --- | --- |
| 加入 / 隐形加入 | GM | GM 的 background |
| 掷先攻 / 重掷 / 排序 / 上移下移 / 设为当前 / 删除 / 清空 / 战斗准备 / 开始战斗 / 突袭 / 结束战斗 / 上一回合 / 下一回合 | GM | 先攻条或列表页直接写房间数据 |
| 结束我的回合 | 玩家，且当前条目的 owner 是自己 | **不写**，广播 `CH_INIT_REQUEST`，GM 客户端校验后代写 |

玩家「结束我的回合」在 GM 侧的**四道校验**（`background.core.js` 的 `onInitRequest`）：

1. `data.activeId` 必须存在且等于当前 `activeId`（缺失 / 过期都拒绝 —— 老实现写反过，会连推两格）；
2. 当前条目 `owner` 必须是这个玩家（**优先 token 上的 `createdUserId` 活值**，其次存下来的 `ownerId`）；
3. 只有 GM 客户端处理（非 GM 直接 return，不写数据）；
4. 正在推进中（`initBusy`）时忽略重复请求 —— 防止两个广播同时读到同一个指针、各推一格。

另外：`phase !== "combat"` 时直接拒绝（准备阶段点「结束」没有意义）。

## 8. 与 v1.3.2 的关系（没有破坏的东西）

* 工具栏仍是**五个入口**，图标与顺序不变；只是「先攻」现在打开条。
* 列表窗口（重掷全部 / 同步加值 / 上移下移 / 删除 / 清空）保留，id 不变 → 老用户的操作习惯还在。
* 右键两项、token 上的 `init` 元数据、绑定卡写加值、速览 / 血条 / 资源追踪 / 设置窗口都没动。
* 旧先攻数据（v1.3.0 ~ v1.3.2）能直接读：缺 `phase` 当 `idle`、缺 `d20` 时公式行退回 `(合计)`、缺 `tb` 按 0.5 排。
* 房间数据键名、token 元数据键名、localStorage 里 v1.3.x 的键都没有改。

## 9. 隐形：只隐藏列表，不动地图

用户明确要求「隐形加入不影响地图可见性」。所以：

* **不**改 token 的 `visible`（参考实现会真的把 token 从玩家画布上抹掉，和需求冲突）；
* 隐形标记只写在先攻条目的 `hidden` 上：GM 看得到（灰度 + 「隐」），玩家连名字都不渲染；
* 当前回合是隐形单位时，玩家看到的是「？？？」，广播里也不带名字（`init-request` 只带 `activeId`）。

## 10. 已知限制

1. **没有镜头跟随**：轮到谁不会自动把镜头移过去（规格 §6 给了公式，v1.4.0 没做）。
2. **玩家不能自己掷先攻**：掷骰按钮只给 GM（房间数据只有 GM 能写），准备阶段由 GM 代掷；
   想自己掷的话后续可以照「结束回合」那样加广播请求。
3. **隐藏只是不渲染**：房间数据对全桌可读，玩家用开发者工具仍能翻到隐形条目的名字 / 点数。
   这是 v1.3.0 就有的限制（数据模型在房间数据里，无法做真正的服务端隐藏）。
4. **高度是硬编码的三档**：条里加任何新元素都要重算 129 / 139 / 159，否则会被 `overflow:hidden` 裁掉。
5. **拖动手感 / 重开 popover 是否重载 iframe 没有真机验证**（与 v1.3.1 的窗口拖动同一套机制）。
6. **血条只画已有 `hp` 元数据的 token**；没有血量的 token 只保留空槽。

## 11. 自测（`node dev/selftest.mjs`，4/4）

* `dev/test-initiative.mjs`：P0 数据层（d20 / tb / phase / round / 上限 60 / 截断 / 降级）、
  排序（合计 / tiebreak / 缺 tb）、回合推进（绕回 +1 轮、突袭轮变正常轮）、
  权限（GM 任意推进 / 玩家只能结束自己 / 非 GM 不写数据 / 重复请求只推一格）、
  隐形对非 GM 不可见、拖拽落位的三种情况（同分只改 tb / 不同分取中点 / 最顶最底 ±1）。
* `dev/check.mjs`：先攻条尺寸常量（与 background.core.js 逐项对比）、phase 三档、
  卡片 CSS 尺寸、五个控制按钮 + 三种掷骰按钮、popover 锚点参数（POSITION + CENTER/TOP + top 45）、
  频道 / 位置键两端一致、`docs/initiative-v14.md` 存在、`docs/spec-*.md` 未被改动。
* `dev/test-background.mjs`：工具栏「先攻」打开先攻条（CENTER/TOP + top 45 + 720×129），
  拖动 → 夹紧 → 记偏移 → 回中，先攻条上的「≡」打开列表窗口。
