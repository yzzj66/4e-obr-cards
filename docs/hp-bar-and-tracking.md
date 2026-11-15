# 血条 + 威能/装备资源追踪（v1.2.0）

> 这份文档说明 v1.2.0 新增的两块功能：**token 上的血条 + 速览弹窗里加减血**，以及
> **威能 / 装备 / 行动点的「已用」追踪**。
> 内容包括：数据存在哪、权限差在哪、照抄的是谁的实现、以及为什么这么写。
> 部署与排查请回 README 与 docs/owlbear-debug.md。
>
> **v1.2.1 的两处界面变化**（纯 UI，数据键名未动）：专长改为纯展示、不再可点标记「已用」；
> 装备栏去掉「魔法物品每日威能」计数器。字段 featUsed / itemDailyUsed 仍保留在数据里兼容旧状态，
> 只是新版界面不再写它们。细节见 [ui-tweaks-v121.md](ui-tweaks-v121.md)。

---

## 一、一句话总结

| 功能 | 入口 | 数据存哪 | 谁能改 |
| --- | --- | --- | --- |
| 血量（当前 / 上限 / 临时 / 回复力） | 选中 token → 速览弹窗里的「−1 −5 −10 / ＋1 ＋5 ＋10 / 受伤 / 治疗 / 临时生命 / 回复力圆点」 | **token 的 item metadata**：com.4enext-owlbear/hp = { cur, max, temp, surges, updatedAt } | **城主**，或**这枚 token 的创建者**（Owlbear 的 item 权限） |
| token 血条 | 自动：token 上一旦有 hp 数据就画 | 不存数据，是**本地图形层**（OBR.scene.local），每台机器自己画 | 自动（跟着 metadata 变） |
| 威能 / 装备「已用」 | 速览弹窗 + 全屏面板：点一下变灰，再点恢复（专长只展示，不可点） | **房间数据**：com.4enext-owlbear/state/&lt;cardId&gt; | 通常只有**城主**能写房间数据；写不进去就退回**本机 localStorage**（弹窗底部会写「资源：本机」） |
| 行动点 / 里程碑 | 同上（并成一排的两个计数器 − ＋） | 同上 | 同上 |
| 短休 / 长休 | 速览弹窗底部两个按钮 | 同上 + token 的 hp | 同上 |

> 重要：**这两块都不会改角色卡本身**。威能选了哪几个、属性多少、装备什么，仍然只在 4E NEXT 里改。
> 插件只记「这一场打了多少、用掉了什么」。

---

## 二、血量：数据与语义

### 2.1 存储位置

写在 **token 的 item metadata**（不是房间数据、不是卡片数据）：

    {
      "com.4enext-owlbear/cardId": "c-xxxx",
      "com.4enext-owlbear/hp": { "cur": 24, "max": 38, "temp": 5, "surges": 6, "updatedAt": 1763000000000 }
    }

为什么选 token 而不是卡片：

- 同一张卡可能对应两枚 token（本体 + 坐骑 / 召唤物），血量必须各算各的；
- 写在 token 上，**血条和弹窗读的是同一份数据**，天然同步，不需要额外协议；
- 换卡重导入同名卡时，血量不会丢（它不在卡数据里）。

max 由卡片推导（职业起始 HP + 体质 + 每级 HP × (等级−1) + 额外生命），第一次改血时写进 metadata；
之后即使卡片被重新导入，弹窗仍以 metadata 里的 max 为准（避免战斗中血量莫名回满）。

### 2.2 语义（照抄 4E NEXT 速览页）

对应源码：4E-NEXT-main/web/src/overview/GlanceVitals.tsx

| 操作 | 规则 |
| --- | --- |
| 受伤 −N | **先扣临时生命**，剩余伤害再扣生命；生命最低到「−生命上限」（4E 里到负上限即死亡） |
| 治疗 +N | 生命为负时**先归零再加**，最高不超过上限 |
| 临时生命 ±1 / 直接填 | 不低于 0；受伤时优先消耗 |
| 回复力圆点 | 点第 N 颗 = 把剩余回复力设为 N |
| 使用回复力 | 回复力 −1，生命 + 回复值（不超过上限） |
| 长休 | 生命回满、临时生命清零、回复力回满、所有「已用」标记清空、行动点回到 1、里程碑清零 |
| 短休 | 只恢复**遭遇威能**（见已知限制） |

**生命上限、血怒线（半血）、回复值**仍然按插件原有的离线推导算；差异见 README 的「数值口径」。

---

## 三、token 血条是怎么画出来的

### 3.1 参考实现的做法（照抄，不自创）

OWLBEAR 的 token **没有**「原生血条」这个属性，也没有「在 token 旁边画个东西」的 API。
参考实现 FullPeople/obr-suite（右键菜单里的「添加血条组件」就是它）的做法是：

1. 给 token 挂**子 item**：一条背景 Curve（灰）+ 一条填充 Curve（红）+ 一个 Text（数字）；
2. 子 item 设 attachedTo = token id、layer = "ATTACHMENT"、locked、disableHit、
   disableAutoZIndex(true) + 固定 zIndex（10000 / 20000 / 30000）；
3. 关掉缩放继承：disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"]) ——
   所有尺寸都按「已渲染尺寸」烘焙成世界坐标，缩放后由我们重算，避免被 token 缩放二次放大；
4. 用 **OBR.scene.local.addItems / updateItems / deleteItems**（本地图形层）而不是 scene.items.*：
   本地图形只在自己这台机器上画，**不需要场景写权限**，所以玩家也能看到血条；
5. token 删除 → OBR 自动删掉挂在它上面的子 item；血条数据被删 → 插件主动清理自己的本地 item。

对应源码：obr-suite/src/modules/bubbles/index.ts（buildBarBg / buildBarFill / buildBarText / patchGeometry）
与 src/modules/hpBar/index.ts。

### 3.2 我们这边的落地

实现在 assets/background.core.js 的「7) token 血条」一节（后台页常驻，因此每台机器都在画）：

- 几何：用 OBR.scene.items.getItemBounds([tokenId]) 取 token 的世界包围盒（已经含缩放/旋转），
  s = min(宽,高) / 场景 DPI，条高 20 × s、左右各留 2 × s，条贴在 token **底边内侧**
  （避免和 OBR 画在 token 下方的名字标签打架，与参考实现的默认位置一致）；
- 数字：「当前/上限」，有临时生命时是「当前/上限 +临时」，字号按条宽自动收缩；
- 刷新：scene.items.onChange 触发（90ms 合并），**几何/数值没变就什么都不做**，
  变了优先 scene.local.updateItems 就地改（不闪），只有新建/被删才走 add/delete；
- 自愈：scene.local.onChange 发现自己的 item 被外部删掉 → 自动重画；
- 清理：token 没了、或 hp 元数据被删掉 → 删掉对应的本地 item；
- 启动清扫：扩展关掉再打开时，上一次会话留下的本地 item 会先被清掉（否则血条会叠两层）。

与参考实现的一处差异：参考实现是**右键「添加血条组件」**给 token 打一个开关，
我们不需要这个开关 —— 只要这枚 token 有 hp 数据（第一次在弹窗里加减过血）就自动画。
少一步操作，也不会出现「忘了加组件所以没血条」。

因为血条是「每台机器自己画」，**没有装插件的玩家看不到血条**（他们本来也看不到速览弹窗）。

### 3.3 构建期的一处改动

血条要用 SDK 的**具名导出** buildCurve / buildShape / buildText，
而 background.bundle.js 一直是「把 SDK 的 default 导出接成 OBR」。
所以 dev/build-background.mjs 多了一小段：从 SDK 末尾的 export{...} 里
把这三个构建器也接成同作用域的变量，并在找不到时**直接报错**（换 SDK 版本时不会悄悄画不出血条）。
这不算新增构建步骤 —— 仍然是原来那一次 node dev/build-background.mjs。

---

## 四、资源追踪：数据与语义

### 4.1 存储位置

**房间数据**（全桌共享），每张卡一个键：

    {
      "com.4enext-owlbear/state/c-xxxx": {
        "v": 1, "updatedAt": 1763000000000,
        "powerUsed":     { "encounter-0": true, "daily-1": true },
        "featUsed":      { "0": true, "g-猛冲之力": true },
        "equipmentUsed": { "e-2": true, "w-0": true },
        "itemDailyUsed": 1,
        "actionPoints": 1,
        "milestones": 0
      }
    }

键名与 4E NEXT **完全一致**（这样导出的 JSON 里的标记可以被直接读懂、也方便对照）：

| 字段 | 键格式 | 含义 |
| --- | --- | --- |
| powerUsed | atWill-0 / encounter-1 / daily-0 / utility-2 / special-0 | 威能槽位（分类-下标）已用 |
| featUsed | 0 / 1 …（专长槽位下标）、g-&lt;专长id&gt; | 专长已用（g- 开头是职业赠送的专长）。**v1.2.1 起界面不写**，字段保留兼容 |
| equipmentUsed | e-0（装备槽）/ w-0（奇物）/ o-0（其他）/ c-0（消耗品）/ m-0（魔宠坐骑） | 魔法物品的「已用 / 耗尽」 |
| itemDailyUsed | 数字 | 今天已经用掉几次「魔法物品每日威能」。**v1.2.1 起界面不写**（计数器已移除），字段保留兼容 |
| actionPoints | 0–5 | 行动点 |
| milestones | 数字 | 里程碑 |

### 4.2 语义（照抄 4E NEXT 速览页的「资源追踪」）

对应源码：GlanceResources.tsx / OverviewView.tsx

- **随意威能**不追踪（显示「无限」，点了没反应）——4E 规则里随意威能无限用；
- 遭遇 / 每日 / 辅助 / 种族职业威能：点一下 = powerUsed[key] = true（变灰 + 删除线），再点 = 恢复；
- 每组的「↺」= 恢复该组全部（对应 4E NEXT 的 resetCat）；
- 组标题右边的「可用 x / y」= (总数 − 已用) / 总数；
- 专长：**只展示**（v1.2.1 起不再可点）；职业赠送的专长仍标记为「赠送」；
- 装备：同样的开关，表示这件物品的「已用 / 耗尽」；
- ~~魔法物品每日威能计数器~~：v1.2.1 已从界面移除（magicItemDailyUses 函数与 itemDailyUsed 字段仍保留，供旧数据读取）；
- **行动点**：− ＋ 在 0–5 之间；**里程碑**：每 +1 同时 +1 行动点（与 4E NEXT 一致）；
  两个计数器固定并成一排（.gl4-resline），窄屏也不会各自折行；
- **长休**：全部标记清空、行动点回 1、里程碑清零、生命与回复力回满；
- **短休**：清空 encounter-* 的威能标记。

### 4.3 写不进去怎么办（权限差异，必读）

Owlbear 的**房间数据通常只有城主能写**（卡片导入也是同一个限制）。
所以 assets/track.js 的 commitState 是「先试房间数据，失败就写本机」：

| 场景 | 结果 | 弹窗底部显示 |
| --- | --- | --- |
| 城主点「已用」 | 写进房间数据，全桌同步 | 资源：全桌 |
| 玩家点「已用」且没有房间写权限 | 写进**自己浏览器的 localStorage**，只有自己看到 | 资源：本机（另弹一条 WARNING 通知） |

差异带来的实际影响：

- 玩家自己标的「已用」**不会**同步给城主和其他人；
- 城主标的会同步给所有人，但**玩家那边如果已经在本机标过**，会以「自己本机那份较新」为准
  （loadState 比 updatedAt）；
- 想全桌一致：让城主来标，或者（更省事）只把插件当「城主自己的战斗面板」用。

> 这是有意的降级，不是 bug：没有 GM 权限的写请求会被 OBR 直接拒绝，
> 与其点了没反应，不如明确告诉用户「这条只记在本机」。

### 4.4 并发

每次写都是「**读最新 → 改 → 写**」（commitState 里先 room.getMetadata()），
所以两个人几乎同时点不同的威能，不会互相覆盖整份状态。
极端情况下（同一毫秒点同一个按钮）仍然是后写覆盖先写 —— 没有做逐键合并。

---

## 五、界面上多出来的东西

速览弹窗（info.html，v1.2.1 起 660×700，小屏按视口自动夹小）与全屏面板（panel.html）用的是**同一个渲染函数**
assets/glance.js 的 renderGlanceHTML(char, { live, editable })：

- 带 live.hp 与 editable.hp 时，生命区多出「−1 −5 −10 / ＋1 ＋5 ＋10 / 数值 + 受伤 + 治疗 /
  临时生命 / 回复力圆点 / 使用回复力」；
- 带 editable.track 时，威能 / 装备变成可点的 chip（button data-act=…），
  行动点与里程碑变成并排的「− 值 ＋」计数器；专长仍是纯展示的 span，不产生 data-act=feat；
- 面板（panel.html）**不改 token 血量**（它不知道你指的是哪枚 token），只做资源追踪，
  预览顶部写着「血量：见 token」；
- 不带 live / editable 时（index.html 的示例、dev/check-render.mjs）就是原来的只读形态。

点击处理集中在两个地方：

- assets/track.js 的 applyAction(act, el, ctx) —— 唯一的动作分发点；
- assets/info.js / assets/panel.js 各挂一个**事件委托**（[data-act]），处理完重画。

这样「弹窗」和「面板」的语义不会分叉：改一处，两边一起变。

---

## 六、已知限制

1. **没有真机测试**：开发环境起不了 Owlbear 房间。已做的是：静态检查、假 OBR 的后台冒烟测试
   （断言血条三件套真的被 scene.local.addItems 加进去、改血后会 updateItems、被删会重建、数据没了会清理）、
   以及示例卡的渲染与标签配平检查。
2. **血条的像素级位置**：按参考实现的比例（条高 20×tokenScale、贴底边内侧 2px）估算，
   真机上可能需要微调 barLayout() 里的常数。
3. **专长只展示、不追踪（v1.2.1）**：4E NEXT 是靠专长**正文**识别「每次遭遇 / 每日」的，
   插件里没有专长正文（data/rules.js 只存了擅长/加值索引），所以干脆不提供专长的「已用」标记；
   短休也因此只清 encounter-* 威能。
4. **回复力在血量元数据里**：同一个 token 上，所以「同一张卡绑两个 token」时回复力是分开的（和血一样）。
5. **数值上限/下限按 4E NEXT**：生命最低到 −上限、行动点 0–5；
   想突破（房规）就改不了 —— 插件不做「忽略规则」模式。
6. **玩家可能改不了血**：只有城主或 token 创建者能改。玩家自己的 token（自己拖上桌的）可以改，
   城主放上去的就不行 —— 这时按钮会显示但点了会弹 ERROR 说明原因。
7. **本地图形层 ≠ 场景数据**：血条不会出现在别人的「场景导出」里，也不会被别的插件读到。
   换机器 / 重开页面会自动重画（因为数据在 token 上）。
