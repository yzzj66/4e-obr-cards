# 开发笔记 / NOTES

> 这个目录放维护说明。**插件运行不需要它**，删掉也不影响功能。
> 完整的分版本实现细节在 `D:\deepseek\4E-Patch\_workfiles\docs\`（不随插件上传）。

## 文件结构

```
根目录    *.html（各窗口页面）+ manifest.json + icon*.svg + README.md
assets/   所有 JS/CSS（background.core.js 是后台源码，background.bundle.js 是它的打包产物）
data/     rules.js（离线规则索引，算 HP/防御/技能用）
vendor/   obr-sdk.js（Owlbear SDK 3.1.0，已打包，离线可用）
samples/  sample-card.json（示例角色卡）
dev/      开发自测脚本（不上传也能跑，node dev/selftest.mjs）
```

## 改代码的注意事项

1. **改了 `assets/background.core.js` 必须重建 bundle**：`node dev/build-background.mjs`，否则后台不生效。
2. 改完跑 `node dev/selftest.mjs`（**10 条自测**：check / test-background / test-initiative / test-track / test-dice /
   test-geometry / test-import / test-glance2 / test-portal / check-syntax）。
   `dev/check.mjs` 会额外 spawn `dev/test-info-click.mjs`（v1.7.13）与 `dev/test-cards.mjs`（v1.7.15），
   所以「10 条命令」仍然覆盖点击链路与角色卡双写存储。
3. **manifest.json 的 `description` ≤ 128 字符**（Owlbear 会校验，超了直接拒绝加载）。
4. **manifest 不要加 `action` 字段**（真机验证过：加了反而加载失败）。
5. GitHub Pages 必须在仓库根放 **`.nojekyll`**，否则 `{{...}}` 模板语法会让构建失败、线上一直是旧版本。
6. 数据键名不要改（`com.4enext-owlbear/hp`、`/state/<cardId>`、`/cardId` 等），改了旧存档会丢。
   先攻 v2.5 起改存 `token.metadata["com.4enext-owlbear/init"]`（每 token 一条 v2 条目）+
   `scene.metadata["com.4enext-owlbear/combat"]`（战斗态）；旧键 `room/scene.metadata[…/initiative]`
   只用于迁移前只读回退 / 迁移，不要往它写新名单（详见下面「先攻存储」）。

## 先攻存储（v2.5：per-token init + scene combat）

> 改 `assets/initiative.js` / `initiative-page.js` / `background.core.js` 的先攻段之前必读。
> 参考实现：[FullPeople/obr-suite](https://github.com/FullPeople/obr-suite) 的
> `src/modules/initiative/utils/metadata.ts`（per-item `com.obr-suite/init` + scene `combat`）。

**存哪儿**（内部 state 形状 `{ phase, round, surprise, activeId, entries[] }` 不变，只换落盘位置）：

| 数据 | 位置 | 形状 |
|---|---|---|
| 一条先攻条目 | `token.metadata["com.4enext-owlbear/init"]` | `{ v:2, d20, bonus, init, tb, hidden, ownerId, updatedAt }` |
| 战斗态 | `scene.metadata["com.4enext-owlbear/combat"]` | `{ v:1, phase, round, surprise, activeId, updatedAt, migratedAt? }` |
| 旧整份名单（只读过渡） | `room/scene.metadata["com.4enext-owlbear/initiative"]` | v1.3 ~ v2.4 的 `{ v, updatedAt, phase, …, entries:[…] }` |
| 迁移前备份 | `localStorage["4enext/init-backup/<roomId>"]` | `{ v:1, at, room, scene }`（只写第一份最完整的） |

- `init` = **合计**（正常掷骰 = d20 + bonus）。拖拽排序写的是两张卡的中点（可能是小数），
  **必须原样落盘**；读的时候不要改成 `d20 + bonus`，否则刷新后顺序回退（这是和 Full Suite 只存原始
  `count` 的唯一差别）。
- 只有 `metadata[…/init].v === 2` 才算名单成员：v1.3 的加值缓存是 `{ bonus, cardId }`、更老是数字，
  它们只当「先攻加值」读（`bonusOfItem` / 后台 `initBonusOf`），**不会**把绑了卡但没加入先攻的 token 误加进名单。
  绑定角色卡（`bindToken` / `propagateCardStats`）碰到 v2 条目时只更新 `bonus`，不碰 d20 / tb / hidden / ownerId。
- 读写：页面 `initiative.js` 的 `readInitiative / writeInitiative`，后台 `initRead / initWrite`
  （两份同算法，经典脚本不能 import）。**差异写**：只 `updateItems` 本页真正变了的 token、
  删掉已移出名单的 v2 元数据；`combat` 没变不写 scene。两名客户端改不同 token 各写各的；
  **同一枚 token 并发仍是后写覆盖**（已知风险，先攻是低冲突数据，可接受）。
- 权限：GM 写所有 token + scene；玩家写**自己创建的 token**（OBR 允许），scene 写不进（玩家常见）时
  `writeInitiative` 仍返回成功（不误报 `.local`），`activeId` 由读取端失效回退第一张；
  玩家「结束我的回合」仍走 `CH_INIT_REQUEST` 请城主落笔；玩家右键「加入先攻」若 token 元数据写不进，
  后台退回 `CH_INIT_JOIN` 请求 GM 代写（原有四道校验不变）。
- 右键菜单互斥：`initMenuFilter` 按 `metadata[…/init].v === 2` 判断（宿主 filter 支持嵌套 key 路径），
  **不再维护 `in-init` 镜像旗标**（旧旗标只留常量兼容，不再写）。
- 迁移（只做一次）：GM 启动（`boot`）/ 进场景 ready / 首次读先攻（页面 `readInitiative`）时，若旧整份名单存在
  且 `combat.migratedAt` 为空 → 旧 entries 逐条写进对应 token metadata + 写 scene combat（带 `migratedAt`）+
  本机备份后把旧房间 / 场景键清成空名单。**任一步失败保留旧数据并 WARNING**，下次启动重试；
  旧名单里「token 不在当前场景」的条目会跳过（留在本机备份 `4enext/init-backup/<roomId>` 里），
  这是跨场景名单迁移的已知限制。
- 自测：`dev/test-initiative.mjs` 覆盖「旧名单迁移（页面 + 后台）/ token 元数据读回 / 拖拽中点落盘 /
  差异写 / 玩家只写自己 token / scene combat 读写 / activeId 失效回退 / 旧数字与旧对象兼容」；
  `dev/check.mjs` 静态对比两边键名 / 结构 / 不再写 in-init / 迁移与差异写接线。改完跑 `node dev/selftest.mjs`。

## 关键常量在哪

| 要调什么 | 去哪改 |
|---|---|
| token 血条/四防的位置与尺寸 | `assets/background.core.js` 顶部 `HP_RING_*`（环厚 **7s** / `Ro = max(0, 半短边 − 2s)` / `Ri = Ro − 环厚` / 48 段）与 `DEF_*`（直径 **22s** / 四角内缩 **8s** / 橙绿紫+白盾），几何全在 `barLayout()`；v1.8.0 起 HP 数字按内圆拟合自动降字号（装不下整块隐藏、绝不裁切）；`COLOR_HP_BLOODIED`（#7f1416）是血怒色。v1.7.9 起**只有环形血条 + 四角四防**（直条 / 蓝条 / Boss 名牌 / 锁已删） |
| 骰子动画手感 | `assets/dice-core.js` 的 `FX_*` + `assets/ui.css` 末尾 `@keyframes fx-*` |
| 先攻条尺寸 / 外壳 | `assets/background.core.js` 的 `STRIP_H_ALLOWED` / `stripSizeFor`（折叠 120×40，展开 720×**170/180/200**）；v1.7.11 起先攻条**回退 popover**（`stripPopoverOptions`：POSITION + CENTER/TOP、`hidePaper:true`、`disableClickAway:true`），尺寸 / 位置由后台重新 `popover.open` 决定（页面只发 `{op:"size"}` 与指针位移） |
| 窗口默认尺寸 | `assets/background.core.js` 的 `WINS` |


## 房间数据为什么必须精简（v1.7.15，16 kB 上限）

> v1.8.0 起改为**双写**：房间数据里只放**精简名单副本**，完整卡放当前场景的隐藏 item
> （见下面「v1.8.x 维护口径 → 角色卡双写存储」）。这一节保留 v1.7.15 的来龙去脉。

真机控制台报 `Unable to update metadata: over size limit of 16 kB`。Owlbear 的 **room metadata 有 16 kB 上限**，
而 `setMetadata` 是**合并写**：合并之后整份文档超限，这一次写入就被拒（不是只拒这一个键）。
v1.7.14 及以前把导入的 4E NEXT 角色卡**整份 JSON** 存进 `com.4enext-owlbear/cards`，单张卡 4~50 KB，
于是整包（cards + initiative + rolls + state）一早超限 → **之后所有**写入（加入先攻 / 改加值 / 回合推进 /
骰子历史 / 资源标记）全部失败，而且只有后台日志，界面上「点了没反应」。

**现在的规矩（改之前先读这几条）：**

1. 卡片**只存渲染必需字段**，格式由 `assets/cards-core.js` 的 `packCard` 决定：
   速览 `deriveGlance / renderGlanceHTML / cardMeta / initiativeBonus` 真正读到的才留；
   立绘、`spellbook`、`backpack`、`creation`、xp / 性别 / 年龄 / 信仰这类不存。
   新增渲染字段时**必须同时改 packCard + unpackCard**，否则读出来是空值（`dev/test-cards.mjs` 会拿
   `deriveGlance` 与 `renderGlanceHTML` 做逐字节对比，漏了会红）。
2. **写房间数据一定要走预算**：页面用 `common.js` 的 `writeRoomKey(key, value)`，
   后台用 `background.core.js` 的 `roomWriteGuarded(key, value)`（经典脚本不能 import，两边同算法）。
   超过 `ROOM_MAX_BYTES = 14 * 1024` 就**不写**，并弹 `ROOM_FULL_MESSAGE`
   （`房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史`）—— 三处常量必须一字不差。
3. 角色卡超限 → 写 `localStorage["4enext/cards-local"]`（`LS_CARDS`），房间里的先攻 / 骰子照旧能写；
   读卡片时按 `updatedAt` **谁新用谁**；后台也读这份本机副本（同源 iframe 共用 localStorage）。
4. 用户侧的瘦身入口在设置窗口「数据与权限 → 清理房间数据」：`getRoomUsage / clearRoomRolls / clearRoomCards`
   都在 `common.js` 里；**设置页本身不许直接写房间数据 / token 元数据**（v1.3.2 的断言还在）。

**体积自测**：`node dev/test-cards.mjs` 会打印示例卡「完整 vs 精简」的字符 / 字节数，
并断言单卡 ≤ 2 KB、导入大卡后房间数据仍 ≤ 14 KB、超限时不写 + ERROR、降级本机读得回来、清理能腾出空间。

## 先攻条透明 / 交互怎么验证（v1.7.11）

- **可用性优先**：先攻条必须是 `OBR.popover.open` —— `OBR.modal.open + disablePointerEvents` 会让**整层不接收指针**，
  页内 `.strip{pointer-events:auto}` 在部分浏览器 / OBR 版本里救不回来（v1.7.10 实测：右键加入先攻、加值输入、卡片下 d20 全点不动）。
- 静态：`node dev/check.mjs` 断言 `stripPopoverOptions()` 带 `POSITION / CENTER / TOP / hidePaper:true / disableClickAway:true`，
  且**不再**有 `stripModalOptions` / `disablePointerEvents` 用于先攻条；页面把 html / body / #app / .win / .win-body /
  .strip-root / .strip / .strip-items 全设成 `transparent !important`。
- 页面单独打开：直接开 `initiative.html`（**不带** `?view=list`）→ 整页应当完全透出背景；
  DevTools 里那几层的 computed `background-color` 都是 `rgba(0, 0, 0, 0)`，只有 `.strip-ctl`（半透明）与
  `.initiative-item`（不透明卡片）有底色。
- 在 OBR 里：`popover` 的 `hidePaper` 若仍被宿主画成深色底 → **不要再用 modal**；按约定接受
  **半透明深色卡片**（`.strip.shell-card` / `rgba(15,20,28,.86)` + 12px 圆角），可用性第一。
- 尺寸：先攻条尺寸仍是 `stripSizeFor`（折叠 120×40 / 展开 720×170|180|200）；页面发 `{op:"size"}`，
  后台按同一 popover id 重新 open 换尺寸；拖动 = 页面发纯指针位移（`screenX/screenY`），后台加起点偏移、
  夹紧后重开同一个 popover，偏移落盘到 `4enext/strip-pos`。

## 先攻条背景为什么这么写（v1.7.14，照抄 FullPeople）

前三版全失败（v1.7.3 只透明 body / v1.7.6 六层 `transparent !important` / v1.7.10 换 modal），
根因不是「漏了哪一层」，而是**写法层级不够**。照抄 [FullPeople/obr-suite](https://github.com/FullPeople/obr-suite) 的
`initiative-panel-v131.html` 之后，规则就是下面三条，**不要再用别的写法**：

1. **inline `!important` 才是最强的一层**。他们把 `background:transparent!important` 写在
   `<html style="...">` / `<body style="...">` 的 **style 属性**里 —— CSS 级联中 inline `!important`
   高于**任何选择器** `!important`（含后加载样式表、含暗色扩展注入的规则）。我们用类名 + 样式表
   `!important` 写了三版，一直被这一层压住。本项目 `initiative.html` 在 `<head>` 里同步执行 10 行内联脚本，
   首帧之前把同样的声明写进 `html.style` / `body.style`（按 `?view=` 只给先攻条挂，列表窗口不挂）。
2. **`<meta name="darkreader-lock">`**：Dark Reader 之类的暗色扩展看到它就不处理本页。
   没有这条时，扩展注入的深色底会让「怎么改 CSS 都没用」。
3. **`:root { color-scheme: normal !important; background: transparent !important }`**：不让 Chromium
   给这个 iframe 画深色画布底；配合 `html, body, #root, .app-hbar, .hbar-cluster { background: transparent !important }`
   把容器链全部压平。类名映射到我们这边是 `#app / .win / .win-head / .win-body / .win-foot /
   .strip-root / .strip / .strip-items`（`ui.css` 里有一条同名规则做样式表版兜底）。

**仍然只有两处底色**：控制行 `.strip-ctl`（`rgba(11,15,20,.72)`）与卡片 `.initiative-item`（`#141b23`）。
**popover 参数照他们的 `openPanel()` 原样原序**（`POSITION` + `CENTER/TOP` + `disableClickAway` + `hidePaper`），
**永远不要**改回 `OBR.modal.open + disablePointerEvents`（见下一节）。

验证（不启动浏览器）：`node dev/check.mjs` 断言 darkreader-lock / inline 透明 / `:root` 规则 / 参数顺序；
页面单独打开 `initiative.html`（不带 `?view=list`）→ DevTools 里 `html` / `body` / `.strip-root` / `.strip` 的
computed `background-color` 应是 `rgba(0, 0, 0, 0)`（`html` 的 **style 属性**里也能看到 `background: transparent !important`）。

## 教训：modal + disablePointerEvents 不能用于需要交互的浮层

v1.7.10 为了让先攻条「真透明」，把整条塞进 `OBR.modal.open({ fullScreen:true, hideBackdrop:true,
hidePaper:true, disablePointerEvents:true })`。结果 `disablePointerEvents` 作用在**整个 modal 层**上，
iframe 里的 `.strip { pointer-events:auto }` 无法把事件救回来：

- 右键「加入先攻」被全屏 modal 挡住；
- 先攻条里的加值输入框改不了；
- 卡片下方的 d20 按钮点不动。

**结论**：需要点击 / 输入 / 拖动的浮层只用 `OBR.popover.open`（它只占自己那块 iframe，不会挡住别处）；
`modal + disablePointerEvents` 只适合纯展示、不需要交互的层（例如投骰动画 effect.html）。
透明始终是第二优先级 —— **可用 > 透明**。


## 速览资源追踪 / 共享数据（v1.7.12）

- **威能**：遭遇 / 每日 / 辅助 / 种族职业四组（`POWER_GROUPS` 里 `track:true`）每个 chip 都是
  `<button data-act="power" data-k="<组>-<槽位>">`；**随意威能**是唯一 `track:false` 的组，保持纯展示。
- **装备 / 魔法物品**：每行都是 `<button data-act="equipment" data-k="<前缀>:<物品id>:<同类第几件>">`；
  `track.js` 同时接受老动作名 `item`。状态 key 用**物品 id**，不要改回按下标（`e-0`）—— 旧 key 读取时直接忽略，
  这是修「从没点过却显示已用 10/12」的关键。
- **共享数据**：速览标题区右侧的 `.gl4-share`（原 HP 区「玩家端隐藏数字」）。写同一个 token 字段
  `hp.locked`：**开 = `locked:false` = 全桌可见精确数字**；关（默认）= 玩家端只看 25% 阶梯比例。
  HP 区不要再放第二个开关。
- 自测：`node dev/test-glance.mjs`（四组 chip / 每行装备 / 默认 0 / N / 共享数据在顶部）、
  `node dev/test-track.mjs`（四组 toggle / 默认全未用 / equipment 动作），再跑 `node dev/selftest.mjs` 8/8。

## 速览窗点击回归（v1.7.13）

- **结论先说**：仓库里**没有**任何 `pointer-events:none` 作用到速览页。`grep -n "pointer-events" owlbear-plugin/`
  运行代码里只剩两处**装饰层**的 none：`ui.css` 的 `.fx-stage`（投骰动画，纯展示、故意点穿地图）
  与 `.drop-mark`（先攻条拖拽落位指示线，3px 的线）。`info.html` / `assets/info.js` / `assets/glance.css` /
  `initiative.html` 里一条都没有（注释里的历史说明不算）。
- **兜底仍然写上**：`glance.css` 末尾给 `body.info-body` 的容器链（`.pop` / `.pop-head` / `.pop-body` / `.gl4`）与所有
  `[data-act]` / `button` / `input` 显式 `pointer-events: auto !important`。CSS 规范：祖先 `none` 时，后代写回 `auto`
  仍可成为命中目标 —— 这样即使宿主或以后的外壳给祖先留了一条 `none`，速览窗也不会「整窗点不动」。
  作用域只挂 `body.info-body`，**不碰先攻条**（它用 popover，本来是好的）与投骰动画（它就该点穿）。
- **事件委托**：`info.js` 从 `bodyEl.addEventListener("click", ...)` 改成
  `document.addEventListener("click", onActClick, true)`（捕获阶段），`change` 同理。重画换 DOM、
  冒泡被 `stopPropagation`、正文外层换容器都不会丢点击；仍只认 `[data-act]`。
- **缓存穿透**：info popover 的 URL 带 `?v=<版本>`（`background.core.js` 的 `openInfo` / `resetInfoToToken`），
  `info.html` 的 `ui.css` / `glance.css` / `info.js`、`info.js` 里的 `glance.js` / `track.js` 也都带 `?v=`。
  旧缓存（v1.7.11）里威能 chip 是 `<span>`、装备行不是 `button` —— 这就是「5/5 绿但真机一点没改」的典型形态。
  以后改速览渲染层**记得同步抬 `?v=`**（check 会断言它等于 `PLUGIN_VERSION`）。
- **自测**：`node dev/test-info-click.mjs`（假 DOM + 真 `info.js` / `track.js`，
  `dispatchEvent(new MouseEvent("click"))` → 断言房间数据写入 `powerUsed` / `equipmentUsed`、重画 `.used`、再点恢复）；
  `node dev/check.mjs` 静态扫描 pointer-events、委托位置、`?v=`，并 spawn 上面这条冒烟。
  `node dev/selftest.mjs` 仍是 8 条命令、8/8（v1.8.0 起加入 test-geometry / test-import / test-glance2）。
- **排查提示**：真机再遇到「点不动」，先在速览窗里开 DevTools 看三件事：① 元素是不是 `<button data-act=...>`
  （不是 → 页面还是旧的，看 `?v=` / 清缓存）；② computed `pointer-events` 是不是 `auto`（不是 → 有别的样式在压容器链）；
  ③ 点一下有没有走到 `applyAction`（`OBR.room.setMetadata` 失败会弹 WARNING，不静默）。

## v1.8.x 维护口径

> 自测命令：v1.8.0 起从 **7 条自测** 扩到 **8 条自测**（新增 `dev/test-glance2.mjs`，速览对齐 4E NEXT）；
> 完整步骤见本文开头「改代码的注意事项」。check.mjs 会 spawn test-info-click / test-cards，实际覆盖更多。

### 角色卡双写存储（房间名单 + 场景完整卡 + 本机兜底）

v1.7.15 及以前只有两级（房间 → 本机）；房间 16 KB 塞不下卡时只存城主本机，**别的玩家看不到卡**。
v1.8.0 起 `assets/common.js` 的 `writeCards()` / `getCardsInfo()` 是唯一入口，改成**双写**：

1. **房间数据** `com.4enext-owlbear/cards` = **精简名单副本**（`packCard` 短键；全桌共享、跨场景还在，
   用于绑定与速览；受 14 KB 预算约束）。
2. **当前场景的隐藏 item** = **完整卡**：新文件 `assets/cards-scene.js`；每张卡一个 item，metadata 键
   `KEY_CARD_ITEM = "com.4enext-owlbear/card"`，值 `{ v:1, card:{ id,name,level,char,importedAt,exportedAt,updatedAt } }`
   （`char` 是**完整 Character，只去立绘**，不再跑 `packCard` 精简）；item 必须
   `visible:false` / `locked:true` / `disableHit:true`，显示名 `4E卡：<角色名>`。
   这一层**全桌可见、没有 16 KB 总额限制、字段不丢**；代价是**跟当前场景走**（换场景看不到）。
3. **本机** `localStorage["4enext/cards-local"]`：两边都写不进（玩家身份 + 房间只读）时的最后兜底，弹 ERROR。

- 读：`getCardsInfo()` 把 **房间名单 + 场景完整卡 + 本机较新副本按 id 取并集**；
  同 id 优先场景完整卡 → 本机较新副本 → 房间精简副本，场景独有新卡追加；返回
  `scope: "room"|"scene"|"local"` 与 `roomCards` / `sceneCards`。后台 `background.core.js` 的
  `getCards()` 也读「房间 → 场景 item → 本机」，token 绑定不会因为降级失效。
- 写：先写场景（完整卡）再写房间（精简名单）；任一成功即清本机副本；都失败才落本机 + ERROR。
- 清：`clearRoomCards()` 同时清房间 / 场景 item / 本机三处（设置窗口「清空角色卡」）。
- 已知限制：换场景后完整数据看不到（房间名单仍在，绑定 / 速览仍可用），要完整字段需重新导入，或等后续「卡库同步」。
- 自测：`node dev/test-cards.mjs`（房间 / 场景 / 本机 + 场景 item 契约 + 增删 + 清理；`dev/check.mjs` 会 spawn 它）。

### 资源标记「读-改-写」竞态（v1.8.1）

真机 bug：速览页逐个点威能 / 专长 / 装备时，**点 A 会把已经点过的 B 改回未使用**。
根因：OBR 的 `room.getMetadata()` 有同步延迟（回声延迟）——`setMetadata` 刚写完，下一次
`getMetadata` 仍可能返回写之前的旧快照；`track.js` 的 `commitState` 每次「读 → 改 → 写」若拿旧快照当 base，
上一次写进去的 `powerUsed` / `featUsed` / `equipmentUsed` 键就被整份覆盖。

维护口径（改 `track.js` 必读）：
- `stateCache[cardId]` 记录本页最后一次已知状态（含刚写成功的乐观状态）；`commitState` 以
  「缓存 vs 房间读数 vs 本机」中 `updatedAt` **严格更大**者为 base（相等时信房间读数 —— 外部写入可能同毫秒）；
- 本页每次写入把 `updatedAt` 强制 +1 单调递增（同一毫秒连点也不会判错新旧）；
- 懒注册 `OBR.room.onMetadataChange`：把别的页面（info 弹窗 / panel 面板）写进房间的状态同步进缓存，
  两个页面交替点同一张卡时按并集累积；
- **所有资源动作必须走 `commitState`**（威能 / 专长 / 装备 / 每日威能 / 行动点 / 临时加值 / 长短休），
  不要自己读写房间 state 键，否则又会绕过缓存产生覆盖；
- 回归：`dev/test-track.mjs` 的 §13「回声延迟」（17 个威能全点、连点 3 次、专长/装备各 5 个、
  两个页面实例交替点 → 并集）；假 OBR 的 `echoDelay=true` 会模拟「下一次 getMetadata 仍是旧快照」。

### 血条几何常数（v1.8.0 真机微调）

`assets/background.core.js` 顶部：`HP_RING_THICK=7`（环厚，旧 10）、`HP_RING_INSET=2`、
`HP_RING_SEGMENTS=48`、`HP_RING_BG_OPACITY=0.35`（旧 0.55）；`SHIELD_DIAMETER=DEF_CIRCLE_DIAMETER=22`（旧 30）、
`SHIELD_INSET=8`（旧 4）。`barLayout()` 里 `Ro = max(0, 半短边 − 2s)`、`T = min(7s, 0.9·Ro)`、`Ri = Ro − T`；
HP 数字按内圆拟合自动降字号（ultra 小 token 整块隐藏，绝不裁切）；`COLOR_HP_BLOODIED=#7f1416` 是血怒（`cur ≤ max/2`）环色。
改完全套自测：`node dev/test-geometry.mjs`（纯函数离线断言）+ `node dev/test-background.mjs`（假 OBR 冒烟）。

### 调试钩子 `window.__4eBar`

`background.core.js` 末尾（v1.8.0）把血条几何的纯函数与常数挂到 `window.__4eBar`
（`barLayout / barSig / barRolesKey / ringSectorPoints / shieldPoints / circlePoints / defShapePoints /
quantiseRatio / CONSTANTS`）。**只读**：运行时没有任何代码会写它；`dev/test-geometry.mjs` 用它在 Node 里
对真实源码做离线断言（四种 token 尺寸 × 不越界 / 文字不裁切）。真机排查时也可以在 `background.html` 的
DevTools 控制台里直接 `__4eBar.barLayout(...)` 看几何。

### 本地 HTTPS 真机验证（不用先部署）

`Owlbear Rodeo` 是 https 站点，本地 `http://localhost` 会被当混合内容拦掉，所以用自签 HTTPS：

```powershell
node dev/serve-https.mjs            # 默认 https://localhost:8443（证书在 dev/certs/，10 年有效）
# 首次：浏览器打开 https://localhost:8443/manifest.json → 接受自签证书
#       → 枭熊 Extension → Add → 粘贴 https://localhost:8443/manifest.json
```

服务器会按请求的 `Host` 动态改写 `manifest.json` 里的绝对地址（线上域名 → 当前 Host），
所以本地和线上共用同一份 manifest 源文件；改完文件 Ctrl+Shift+R 强刷房间即可（服务端 no-cache）。
