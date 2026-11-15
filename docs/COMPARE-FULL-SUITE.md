# 与 Full Suite（obr-suite v1.3.34）逐项比对

> 本文回答用户的要求：「做完后先比对 Full Suite」。
> 对比对象：**FullPeople/obr-suite v1.3.34**（参考源码 `D:\deepseek\refs\obr-suite-main`）与本插件 **4eNEXT to owlbear v1.8.0**（本仓库）。
> 方法：逐项读两边源码（下文全部标 `文件:行号`），能离线验证的几何 / 纯函数用 `dev/test-geometry.mjs`、`dev/selftest.mjs` 复跑；本插件侧另有 `dev/test-initiative.mjs` / `test-dice.mjs` / `test-background.mjs` 等历史自测。
> 结论口径：**只写「行为是否可用」**，不把「实现不同」一律写成 bug。

## 0. 一句话结论

1. **三大功能（骰子 / 血条 / 先攻）都可用，且关键坑位采用了 Full Suite 验证过的做法**：透明内联三件套、`scene.local` 自绘 ATTACHMENT 血条、per-token 先攻数据思路、tiebreak 公式、骰子纯函数 + 广播、几何不越界、`?v=` 缓存穿透、16KB 规避。
2. **差异集中在「4E 专属规则」与「没有服务器 / 不引 React」**：重击口径（4E 取满 vs Full Suite 骰数翻倍）、血条形态（环 + 四角四防 vs 横胶囊 + AC 盾）、卡体存储（房间/场景 item vs 自建服务器）、先攻存储（房间一份 vs 每 token 一份）。
3. **没有照抄的大件都不影响三功能**：3D 骰子 shader、React 面板、服务器卡库、多语言、面板布局编辑器——它们是 Full Suite 的「全家桶」成本，不是这三个功能的必要条件。
4. **独立复核发现 4 处值得处理的问题**（详见 §5，均已按「只写报告、不改代码」处理）：① 房间卡列表过期时场景兜底卡读不到（会重现「导入后刷新卡消失」）；② 重击会把表达式里的 d20 也强制取满；③ 先攻「下一回合」快速连点会丢点击；④ `dice-history.html` / `effect.html` 的透明只用了样式表 `!important`，没有照抄内联 `style`。
5. **无真机验证**：本报告与所有自测都是离线（假 OBR / 假 DOM / 纯函数），真实枭熊房间、实体设备、暗色扩展下的成像仍未验收（与交接文件 §3 同一口径）。

---

## 1. 主表

图例：✅ 与 Full Suite 同一做法；🔶 同源但按 4E / 零服务器 / 无框架调整；❌ 明确不同（不影响可用性时注明）。

### 1.1 骰子

| 功能点 | Full Suite 做法（v1.3.34） | 本插件做法（v1.8.0） | 判定 | 差异原因 |
|---|---|---|---|---|
| 面板入口 | manifest `action.popover = dice-panel.html`（`public/manifest.json`，380×620）；其它界面 `OBR.action.open()`（`src/modules/dice/index.ts:258-259`） | 左侧工具栏 `OBR.tool.create` 开独立 popover；manifest **不加 action**（`manifest.json` 全文；交接文件 §4 明确「加 action 会加载失败」） | 🔶 | 真机约束：本插件的入口只能用工具栏；`dice.html` 为原生 DOM 单列窗 |
| 表达式语法 | `adv/dis/max/min/reset/resetmin/resetmax/same/burst/repeat`，全角括号逗号归一化（`dice/panel-page.ts:253-281`、`:321-327`） | 同一套 wrapper 名与归一化（`assets/dice-core.js:73-170`，`WRAPPER_RE` 在 `:119`），`repeat` 行为同（`:545-607`） | ✅ | 直接按同一语法实现 |
| 掷骰核心 | 纯函数在 `dice/panel-page.ts:329-929`（`parsePlain` / `parseExpr` / `rollPlainSet` / `applyValueClamp` / `rollExpr`） | 纯函数在 `assets/dice-core.js`（`parsePlain:172`、`parseExpr:272`、`rollPlainSet:400-416`、`applyValueClamp:419-434`、`rollSegment:446-509`、`rollParsed:545-607`），无 OBR 依赖 | ✅ | 同一套纯函数结构（可 Node 直测） |
| 优势 / 劣势 | `adv()/dis()` wrapper 掷 N+1 组取高/低，输家标 `loser`（`dice/panel-page.ts:849-881`） | wrapper 同（`dice-core.js:453-472`）；另加 4E「战斗优势 +2」可逆按钮（`assets/dice-page.js:164-175`、`:829`） | 🔶 | 4E 没有 5e 的 adv/dis 术语；表达式层仍兼容 `adv()` |
| 重击 | **骰数翻倍**，加值不变（5e 口径；`dice/panel-page.ts:2892 doubleDiceCounts`） | **4E 口径：所有伤害骰取满**（`dice-core.js:400-416 maximize`、`:545-560`）；带 wrapper 时退化为普通投掷并提示（`:557-560`、`:605`；提示文案 `:36`，按钮 title `dice-page.js:830`） | ❌ | **规则差异（有意）**：4E 重击=伤害骰取满，不是 5e 骰数翻倍 |
| 广播 | 频道 `com.obr-suite/dice-roll`，LOCAL+REMOTE 各发一次（`dice/index.ts:48`、`:1399-1494`） | 频道 `com.4enext-owlbear/roll`，LOCAL+REMOTE（`assets/dice-page.js:279-283`、`:393`；后台 `background.core.js:232`） | ✅ | 名称不同（不能与 Full Suite 抢频道），机制相同 |
| 投骰动画 | 每次 roll 开一个全屏 modal（`dice/index.ts:563-570`），模态参数 `fullScreen+hideBackdrop+hidePaper+disablePointerEvents`（`dice/effect-page.ts` 渲染） | 同样参数开 `effect.html`（`assets/dice-page.js:324-341`），动画为纯 CSS 关键帧 + 时间轴常量（`dice-core.js:780-806`、`:949 fxQuery`） | 🔶 | 不引 three.js / 不做 3D 骰模型；参数与「点击穿透」照抄 |
| 历史存储 | 每客户端 `localStorage`，key 带房间、上限 100（`dice/history-policy.ts:1-23`、`panel-page.ts:54-60`） | **房间数据一份**（`room.metadata[com.4enext-owlbear/rolls]`，≤20 条，GM 落库），超预算按半裁（`background.core.js:3233-3250`、`ROLL_MAX_ROWS` 见 `dice-core.js:25`） | ❌ | 无服务器下要「全桌共享」只能放房间数据；代价是 GM 不在线时不落库（见 §5） |
| 历史面板 | 独立 popover 320×218（`dice/index.ts:74-86`、`:356-406`） | 独立 popover（`dice-history.html` + `dice-page.js:456-592`），默认 4 条、可展开（`dice-history-page.js:96`、`:131`） | ✅ | 同样是「独立可拖动浮层」 |

### 1.2 血条（有卡 / 无卡 token 都支持）

| 功能点 | Full Suite 做法 | 本插件做法 | 判定 | 差异原因 |
|---|---|---|---|---|
| 画在哪 | **场景内本地 item**：`OBR.scene.local.addItems()`，`ATTACHMENT` layer + `attachedTo(token)`，每客户端自绘（`bubbles/index.ts:1325-1594`、`:2018-2050`） | 同：`barCommon()` 用 `layer("ATTACHMENT").attachedTo(token).locked(true).disableHit(true).disableAutoZIndex(true)`（`background.core.js:2420-2432`）；`addBar()` 走 `OBR.scene.local.addItems`（`:2464-2466`） | ✅ | 直接照抄机制（同步的 `scene.items` 会重复叠条） |
| 形态 | token 下方/上方横胶囊条 + AC 盾 + 临时血泡；zIndex 10000/20000/30000/15000（`bubbles/index.ts:1325-1594`） | token 上**环形**血量（`ring-bg 9500 / ring-fill 9800`）+ **四角四防**盾/圆（`shield 15000`）+ 环内数字（`bar-text 30000`）（`background.core.js:165-172`、`:2434-2463`） | 🔶 | 4E 的「四防（AC/强韧/反射/意志）」和环形血条是本插件原有产品形态 |
| 数据存储 | token `item.metadata["com.obr-suite/bubbles/data"]`（health / max health / temporary health / armor class / hide / locked），回退上游 bubbles key（`utils/statEdit.ts:22-23`、`hpBar/target.ts:21-27`） | token `item.metadata["com.4enext-owlbear/hp"] = { cur, max, temp, surges, surgesMax, defenses, locked }`（`track.js:28`、`:201-217`；读取 `background.core.js:2119-2148`） | 🔶 | 字段是 4E 的（回复力/四防），仍放 token item metadata（随场景复制、无 16KB 问题） |
| 无卡 token | 右键「添加血条组件」写 flag；已有 HP 自动启用；popover 手填（`hpBar/index.ts:282-340`、`:171-241`） | 右键「添加血条组件」/「编辑血条」写 `hp-bar/enabled` 并开 340×150 编辑窗（`background.core.js:1465-1487`、`:1488-1570`；`hp-edit-core.js:278-314`）；无卡 token 选中时按 `hasHpBarData` 自动弹编辑窗（`background.core.js:1999-2031`、`:2094-2110`） | ✅ | 同一个「flag + 手填」模型；编辑语法 `20` / `20/20` / `+5` / `-3` |
| 几何 | `getImageCenter`/`getRenderedSize`（`bubbles/index.ts:439-454`）+ 布局函数 `:1082-1256`；要求条不越出 token | `barLayout` 以 `getItemBounds` 的 center/min/max 为基准：`RO = 半短边 − 2s`、`T = 7s`、`Ri = RO − T`；四防内缩 `max(8s, 描边一半+0.5s)`；文字按内圆自动降字号（`background.core.js:2222-2351`） | 🔶 | 目标相同（不越界），形态不同；离线断言见 `dev/test-geometry.mjs`（30 组尺寸×HP×有/无四防） |
| 权限 / 锁定 | `locked` 默认 true（玩家只看到剪影），GM / token 创建者可编辑（`bubbles/index.ts:209-212`、`hpBar/target.ts:29-32`） | `hp.locked` 默认 true；`hpEditReadOnly`（GM 不受限）+ `mayEditToken`（GM 或 `createdUserId`），且 `updateItems` 回调内再校验一次（`hp-edit-core.js:257-268`、`:278-314`） | ✅ | 直接照抄权限模型（含「draft 延迟执行要二次校验」） |
| 血怒 bloodied | Full Suite **没有**血条血怒两段色（只有速览页重伤线，`bubbles` 无此概念） | token 条：`cur ≤ max/2` → 填充色 `COLOR_HP_BLOODIED`（`background.core.js:146-147`、`:2231-2232`、`:2347`；增量刷新 `:2485-2490`）；速览页另有「重伤/濒死」状态（`glance.js:540-544`、`:601-609`） | ➕ 我们多出 | 4E 规则需求；不改数据结构，只改颜色语义 |
| 更新时机 | `OBR.scene.items.onChange` 重算 + 几何/数值 diff（`bubbles/index.ts:2210`、`:1305-1316`） | `syncBars()` 遍历已开 flag 的 token，diff `barSig` 后 `patchBar`，roles 变了才重建（`background.core.js:2527-2599`、`barSig:2360-2370`）；`scene.local.onChange` 自愈（`:2640-2660`） | ✅ | 同一套 diff-增量刷新 |
| 上游兼容 | 兼容「Stat Bubbles for D&D」的 metadata key（`utils/statEdit.ts:22-23`、`:75-140`） | **不兼容**上游第三方 bubbles 插件（只用自有 key，避免写坏别人的 token） | ❌ | 独立产品边界；若用户同时装 bubbles 上游会看到两条（见 §5） |

### 1.3 先攻条

| 功能点 | Full Suite 做法 | 本插件做法 | 判定 | 差异原因 |
|---|---|---|---|---|
| 数据存哪儿 | **每个 CHARACTER token 的 `item.metadata["com.initiative-tracker/data"]`**（count=d20 原值 / active / rolled / tiebreak / ownerId / invisible，`initiative/utils/constants.ts:1-16`、`types.ts:1-14`）；战斗态 `{inCombat,preparing,round}` 在**场景 metadata**（`utils/metadata.ts:125-139`） | **房间数据一份**：`room.metadata["com.4enext-owlbear/initiative"] = { v, updatedAt, phase, round, surprise, activeId, entries:[{tokenId,name,bonus,d20,init,tb,hidden,ownerId,updatedAt}] }`（`initiative.js:1-40` 注释、`:163-199` 归一化）；上限 **40 条**（`initiative.js:44`） | ❌ | **零服务器 + 全桌共享**只有房间数据一条路；per-token 方案需要每个客户端都有写 token 权限（玩家默认没有）。代价是 40 条上限（见 §5） |
| 加值 | 另存 token metadata `dexMod`，显示/排序时 `total = count + modifier`（`utils/metadata.ts:49-50`、`initiative/index.ts:844-850` 注释） | 条目里同时存 `d20`（原值）与 `init`（=d20+bonus 一次算好）；改加值时若已掷过立刻重算 `init`（`initiative.js:128-137`、`:519-531`） | 🔶 | 数学等价；本插件把「最终值」落盘，旧数据/显示更简单 |
| 排序 | `total DESC → tiebreak ASC`（`hooks/useInitiative.ts:152-157`） | `init DESC → tb ASC → 名字/updatedAt`（`initiative.js:206-214`） | ✅ | 同两级排序，多一级稳定兜底 |
| tiebreak | `0.5 − mod×0.01 + random×0.008`，clamp (0.001,0.999)（`utils/metadata.ts:24-28`） | 同一公式（`initiative.js:151-156`；后台 classic 副本 `background.core.js:2731-2735`） | ✅ | 逐字照抄 |
| 加入 / 移除 | 右键菜单：IMAGE+CHARACTER 即可加（`initiative/index.ts:292-373`）；移除写 opted-out 防回夹（`:346-351`） | 右键菜单「加入先攻 / 隐形加入 / 移出先攻」（`background.core.js:1352-1370`、`:2800-2852`、`:2854-2872`）；token 删除后按「见过→消失」清理（`:2874-2895`） | ✅ | 同一套右键模型；本插件额外有「隐形加入」（4E 常用） |
| 无卡 token | 只要 `IMAGE + CHARACTER`，`dexMod` 缺失按 0（`initiative/index.ts:268-272`、`utils/metadata.ts:49-50`） | 右键任意 IMAGE token 都能加，加值取 token 上的 init 元数据/卡的先攻加值，缺省 0（`background.core.js:2800-2807`、`initiative.js:484-495`） | ✅ | 同样不要求角色卡 |
| 回合推进 | 串行 Promise 队列 + 乐观指针 + 写失败回滚；先写 active 再写 round（`hooks/useInitiative.ts:1305-1403`） | 读-改-写整份房间状态；`advanceInitiative`（`initiative.js:348-371`）与后台副本 `initAdvance`（`background.core.js:3026-3051`）逐行等价；先写指针再展示 | 🔶 | 结果一致；**没有** Full Suite 的串行队列，快速连点会丢（见 §5-F3） |
| 面板 / 条 | 常驻 popover，`120×40` 折叠 / `720×154` 展开，`hidePaper + disableClickAway`，top-center（`initiative/index.ts:189-258`；`panel-page.tsx:32-58`、`:299-336`） | 常驻 popover，`120×40` / `720×170|180|200`，`hidePaper + disableClickAway`，top-center 45px（`background.core.js:969-985`；常量 `initiative.js:60-75`） | ✅ | 尺寸照抄后按 4E 卡片高度调高 |
| 先攻条透明 | 内联三件套（`initiative-panel.html:2,9,11`） | 逐字照抄 + 首帧前脚本按 `?view=` 决定挂不挂（`initiative.html:22,28-55,57-61,68`） | ✅ | 一个文件两种形态（条/列表），多了条件判断 |
| 隐形 | `data.invisible` + 同时把 `item.visible=false`，玩家端由 OBR 原生隐藏（`initiative/index.ts:522-535`）；玩家面板过滤（`hooks/useInitiative.ts:192-215`） | `entry.hidden`，非 GM 不渲染该条目、当前回合显示「？？？」（`initiative.js:231-247`）；**不翻 token 的 visible** | 🔶 | 4E「DM 暗掷先攻」的语义；不隐藏棋子本身（见 §5-F6） |

### 1.4 角色卡（4E NEXT JSON 导入）

| 功能点 | Full Suite 做法 | 本插件做法 | 判定 | 差异原因 |
|---|---|---|---|---|
| 卡体存哪儿 | **不落 OBR**：场景 metadata 只放「目录」（`com.character-cards/list`，`characterCards/index.ts:74-75`、`directory.ts:1-14`），卡 JSON 在作者自建服务器 `https://obr.dnd.center/characters/{room}/{cardId}/data.json`（`panel-page.ts:438-442`） | **三级回退**：房间数据（首选）→ **当前场景隐藏 item**（`com.4enext-owlbear/card`，`cards-scene.js:34-35`、`:107-167`）→ 本机 localStorage（`common.js:360-423`） | ❌ | **没有服务器**；按交接文件 §4 的结论改成「卡=场景 item」，绕开 16KB |
| 关卡体体积 | 服务器无上限；目录很小 | 每张卡 `packCard()` 后约 1.9–2.4KB；写房间前按 14KB 预算（`common.js:280-320`；classic 版 `background.core.js:69-108`） | 🔶 | 房间 metadata 硬上限 16KB（Full Suite 文档也写明：`docs/WORKBENCH_DEV_20260922.md:28`）；本插件自己留 2KB 余量 |
| 导入格式 | JSON / XLSX，上传到服务器（XLSX 先转 JSON；`panel-page.ts:554-606`、`:588-591`） | **4E NEXT 导出 JSON** 三种：单角色「导出存档」`pages.character`、全量备份 `data["4enext.cards.v1"]`（一次多张 + 私设包）、裸 Character/`{character}` 兼容（`assets/import4e.js:1-25`、`:158-175`；入口 `panel.js:275-312`、拖拽 `:461`、粘贴 `:424`） | ❌ | 本插件只服务 4E NEXT（无 XLSX 需求），支持的导出结构按 task-2 的 schema 笔记实现 |
| 卡列表界面 | React 五页查看器 + 卡库目录（`cc-panel.html`、`panel-page.ts`、`characterCards/fullscreen-page.tsx`） | 原生 HTML 面板 + 速览渲染（`panel.js`、`glance.js`；速览 660×700，`background.core.js:180-188`） | 🔶 | 不引 React；阅读体验保留（`glance.js:641` `renderGlanceHTML`；血怒/濒死状态 `:540-544`、`:601-609`） |
| 绑定 token | token metadata `com.character-cards/boundCardId`（`characterCards/index.ts:74`、`bind-page.ts:167-230`） | token metadata `com.4enext-owlbear/cardId`（`background.core.js:36`；绑定写 `:1953`、选中解析 `:1930-1945`）；**按名字兜底 + 自动修复绑定**（`:1903-1959`） | 🔶 | 键名独立（不与 Full Suite 抢）；多了「重导入后卡 id 变」的兜底 |
| 权限 / 可见性 | 卡目录 `visibility/locked` + token owner（`native-owner.ts:13-24`、`characterCards/index.ts:150-156`） | GM 能读全部；玩家速览只到「共享数据」开关控制（`hp.locked` 语义），绑定只有 GM 右键（`background.core.js:1488-1530`） | 🔶 | 4E 桌面习惯：卡是私人物品，玩家不需要看别人的速览 |
| 联动血条/先攻 | 卡刷新时回推 max HP/AC/dexMod（`characterCards/index.ts:425-475`） | 绑定/导入时把卡里的 maxHp / 四防 / 先攻加值写进 token（`track.js:285-300`、`:330-355`；`initiative.js:484-495`） | ✅ | 同一「卡→token 播种」思路 |

### 1.5 工程 / 部署

| 功能点 | Full Suite 做法 | 本插件做法 | 判定 |
|---|---|---|---|
| 构建 | Vite 8 + TS + React/preact，`tsc && vite build`，base `/suite/`（`package.json`、`vite.config.ts`） | **零构建**：原生 HTML/CSS/JS；`assets/background.core.js` 由 `dev/build-background.mjs` 与 `vendor/obr-sdk.js` 拼成 `background.bundle.js`（经典脚本，`background.html:42`） | 🔶（本插件刻意更轻） |
| 入口 | manifest `background_url` + `action.popover`；工具栏/右键由 background 注册（`src/background.ts`、`characterCards/index.ts:563-585`） | manifest 只有 `background_url`（**不加 action**，交接 §4）；入口 = 工具栏 ×5 + 右键 + 浮动按钮（`background.core.js:1488-1570`、`:3371-3372`） | 🔶 |
| 透明 | 内联三件套 + `hidePaper`；部分浮层用 `*-native.html` 构建别名（`initiative-panel.html:2,9,11`；`tools/native-canvas-plugin.mjs:1-10`） | 内联三件套照抄到先攻条（`initiative.html:22,38-46,57-61`）；记录窗/动画页只到 `darkreader-lock` + 样式表 `!important`（`dice-history.html:6-21`、`effect.html:6-18`） | 🔶（见 §5-F4） |
| 16KB 规避 | 自建服务器放卡；场景 metadata 只放目录 | 房间数据预算 14KB + 三级回退 + 显式 ERROR（`common.js:280-320`、`:360-423`） | ❌（路线不同，都可行） |
| 缓存穿透 | `assetUrl()` + 构建产物 hash（`src/asset-base.ts:20-24`） | 全站 `?v=1.8.0`（如 `initiative.html:56`、`dice.html:139`、`background.html:42`）+ `import4e.js?v=PLUGIN_VERSION`（`common.js:510-520`） | ✅（同一思路） |
| SDK | `@owlbear-rodeo/sdk ^3.1.0` npm 依赖 | 内联 `vendor/obr-sdk.js`（3.1.0），构建脚本把它剥 export 后拼进 bundle（`dev/build-background.mjs:24-56`） | 🔶 |
| 多语言 | 中/英 i18n 字典（`src/i18n.ts` 61KB） | 只中文（本插件用户群） | ❌（不需要） |

---

## 2. 照抄了 Full Suite 哪些（逐条）

1. **透明三件套（最关键）**：`<html style="…background:transparent!important">` + `<meta name="darkreader-lock">` + `<style data-overlay-canvas>:root{color-scheme:normal!important;…}</style>` + `<body style="…">`（Full Suite：`initiative-panel.html:2,9,11`；本插件：`initiative.html:22,38-46,57-61,68`）。交接文件 §3.3 的「样式表压不住、只有内联 `!important`」就是从这里来的；打开端同时 `hidePaper: true`（`background.core.js:969-985` ↔ Full Suite `initiative/index.ts:239-253`）。
2. **血条用 `scene.local` 自绘**：本地 item + `ATTACHMENT` layer + `attachedTo(token)` + `disableAttachmentBehavior(["SCALE","ROTATION","LOCKED","COPY"])`（Full Suite：`bubbles/index.ts:1325-1594`、`:172-177`；本插件：`background.core.js:2420-2432`）。**为什么不能放 `scene.items`**：会同步给每个客户端、每人再画一份 = 叠条。
3. **血条几何「以 token 中心/渲染尺寸为基准，所有点不越界」**：Full Suite 用 `getImageCenter/getRenderedSize`（`bubbles/index.ts:439-454`）保证缩放/旋转/镜像后仍贴合；本插件用 `getItemBounds` 的 center/min/max + 环半径公式（`background.core.js:2222-2351`），并用 `dev/test-geometry.mjs` 30 组断言把「不越界 / 无 NaN」钉死（含 0.5 格、1×2、4×4、窄 token 降级）。
4. **HP 数据放 token item metadata + `locked` 默认 true + GM/创建者可改 + 回调内二次校验**：Full Suite（`utils/statEdit.ts:22-23`、`bubbles/index.ts:209-212`、`hpBar/target.ts:29-32`、`hpBar/edit.ts:18-36`）↔ 本插件（`track.js:28,201-217`、`hp-edit-core.js:257-268,278-314`）。
5. **先攻数据结构思路**：per-token 原始 d20 + 加值分开、`tiebreak = 0.5 − bonus×0.01 + jitter` 处理同分（Full Suite `types.ts:1-14`、`utils/metadata.ts:24-28,49-50`；本插件 `initiative.js:128-156,163-214`）。差别只在**存储位置**（见 §1.3），数学与排序规则一致。
6. **骰子「解析/掷骰是纯函数、广播只传数据、渲染端各自画」**：Full Suite（`dice/panel-page.ts:253-930`、`dice/index.ts:1399-1494`）↔ 本插件（`dice-core.js:73-509`、`dice-page.js:365-395`）；连「全屏 modal 参数 + `pointer-events:none`」也照抄（Full Suite `dice/index.ts:563-570`、`dice-effect.html:8-19`；本插件 `dice-page.js:324-341`、`effect.html`）。
7. **历史去重/上限/隐私策略**：Full Suite `history-policy.ts:1-23` 的「按 rollId 去重、按 ts 倒序、hidden 只有 GM/投掷者可见」在广播合并与落库两处都体现（本插件 `background.core.js:3200-3210,3233-3250`）。
8. **`?v=` 缓存穿透**：Full Suite 用构建 hash（`src/asset-base.ts:20-24`）；本插件用 `?v=1.8.0` + 模块级 `?v=PLUGIN_VERSION`（`common.js:510-520`），对应交接文件 §3.2 的「改完等于没改」教训。
9. **16KB 上限的处理原则**：Full Suite 文档明确「不要塞进房间 metadata（16 KB）」（`docs/WORKBENCH_DEV_20260922.md:28`），我们把它落成「预算 14KB + 超限不写 + 三级回退 + ERROR 不静默」（`common.js:280-320,360-423`）。
10. **先攻条 popover 参数**：`POSITION` + `CENTER/TOP` + `hidePaper` + `disableClickAway` + 顶部 45px（Full Suite `initiative/index.ts:189-258` ↔ 本插件 `background.core.js:969-985`、`initiative.js:60-75`）。交接文件 §4 的「不要用 modal+disablePointerEvents」也是这条的衍生结论。

---

## 3. 没照抄 / Full Suite 有而我们没有

| Full Suite 能力 | 是否影响三功能可用性 | 不照抄的理由 / 风险评估 |
|---|---|---|
| 3D 骰子动画 + SKSL shader（`dice/effect-page.ts` 77KB、`bubbles` 的 HP shimmer） | **不影响**（我们用纯 CSS 关键帧 + 时间轴常量，`dice-core.js:780-806`，视觉略朴素） | 体积/脆弱性；shader 在低端设备有兼容坑。风险：手感不如 Full Suite，属体验差异 |
| React / preact 面板（先攻、角色卡） | **不影响**（原生 DOM 渲染，`initiative-page.js`、`panel.js`、`glance.js`） | 零构建、零依赖是本插件卖点；函数量可控。风险：复杂交互（拖拽/长列表）不如 React 好维护，已有自测覆盖 |
| 自建服务器卡库（上传/刷新/多场景目录、`/upload` `/create-from-json`） | **不影响当前功能**（有替代：房间→场景 item→本机） | 需要域名/后端，用户要求零服务器。风险见 §4-①②：场景兜底卡不跨场景 |
| 多语言（中/英） | **不影响** | 用户群中文；i18n 61KB 成本高 |
| 面板拖拽布局系统 / layout-editor（`utils/panelLayout.ts` 等） | **不影响**（本插件用固定位置 + 本机位置记忆：`background.core.js:1666-1700`，拖动 `:1823-1865`） | 平台层几百行，收益低。风险：多显示器/超小视口下靠 `clampInfoPos` 兜底（`:1658-1664`） |
| Bubbles 上游插件兼容（Stat Bubbles 的 key 回退 / `patchBubbles` 镜像） | **不影响**（但两插件同装时一枚 token 上会有两条血条，见 §4-⑤） | 写别人 token 的 metadata 有风险；本插件只用自己的 key |
| 先攻的每-token 存储（per-item metadata + 场景战斗态） | **不影响**（单房间 40 人内可用；见 §4-②） | 玩家没有写 token 权限；房间数据一份才能全桌共享。风险：40 条上限、跨场景名单不跟随 token |
| 隐形先攻时把 `item.visible=false`（`initiative/index.ts:522-535`） | **不影响**（我们有 `hidden` 条目 + 玩家端「？？？」） | 隐藏棋子本身会影响战斗地图可见性；4E 暗掷只需隐藏先攻数值。风险：玩家仍能看到 token（预期行为，§5-F6 记录） |
| 卡库里「卡 vs token 权限矩阵」（`native-owner.ts`） | **不影响**（GM 才能绑定、玩家只看自己被共享的数据） | 4E 桌面习惯；实现成本高 |

### 我们比 Full Suite 多出的东西（4E 专属）

- **血怒（bloodied）两段色**：`cur ≤ max/2` 时环填充换成 `COLOR_HP_BLOODIED`（`background.core.js:146-147,2231-2232,2347,2485-2490`）；Full Suite 没有这个概念。
- **四防（AC / 强韧 / 反射 / 意志）** 四角显示 + 速览页四防推导（`glance.js:315-331`）；Full Suite 只有 AC。
- **4E 数值推导**：半等级、属性调整、HP/回复力、四防、技能、先攻（`glance.js:234-242,315-336,351`；`initiativeBonus`）。
- **先攻三种掷法（normal/adv/dis）** + 战斗优势 +2（`initiative.js:128-145`、`dice-page.js:164-175`）。
- **重击取满**（4E）而不是骰数翻倍。
- **4E NEXT 导出 JSON 直接导入**（单卡 / 全量备份 / 私设包；`import4e.js:1-25`）。

---

## 4. 已知限制与后续建议

1. **双写存储：完整卡只跟当前场景**：v1.8.0 起角色卡**双写** —— 房间数据里是**精简名单副本**（`packCard` 短键，跨场景 / 玩家侧可见、用于绑定与速览），当前场景的隐藏 item 里是**完整卡**（`cards-scene.js`，字段不丢但**跟当前场景走**）。换场景 / 新建场景后完整数据看不到（房间名单仍在，绑定 / 速览仍可用），要完整字段需重新导入（或等后续做「跨场景卡库同步」）。**建议**：README 已写明；后续可在设置页加「把场景卡搬回房间」入口（当前只有 `clearSceneCards`，`cards-scene.js:169-178`）。
2. **先攻存房间数据、40 条上限**（`initiative.js:44`）：好处是全桌共享、玩家不需要 token 写权限；坏处是超过 40 条要删条目，且换场景名单不跟随 token。**迁移成本**：改成 per-token 需要玩家能写 token（做不到）+ 场景战斗态迁移，收益不抵成本；**建议维持现状**并把上限写进 README。
3. **骰子历史只有 GM 能落库**（`background.core.js:3315-3322` 只处理 GM）：GM 不在线时「本次结果只在本机」（README:72 已写）。属零服务器架构的固有限制。
4. **房间数据总量**：房间名单副本 + 先攻 + 骰子历史共用 14 KB 预算（`common.js:280-320`）。**双写后卡多不会再「丢卡」**：完整卡在场景 item 里、读时按 id 取并集，房间名单写不进时仍能从场景读到；但名单副本仍占预算，满桌很多卡时先攻 / 骰子历史会更早触发降级。**建议**：后续可把骰子历史改成「只存最近 8 条」或落本机 + 广播。
5. **与上游 Bubbles 插件同装**：两套血条会同时画（本插件不读写上游 key，见 §1.2）。**建议**：README 提示「二选一」。
6. **无真机验证项**：真实枭熊房间的多人同步、暗色扩展下的浮层透明、实体手机尺寸、断网重连后的先攻/卡回退、`dice-history`/`effect` 浮层透明（见 F4）都只有离线证据。
7. **文档口径（已修正）**：README「骰子历史 40 条」与 `initiative-page.js` 的「超过 60 条」都已按真实常量改成 20 / 40（v1.8.0 收尾）。
8. **两套先攻实现并存**：`initiative.js:348-371`（窗口用）与 `background.core.js:3026-3051`（后台处理玩家「结束回合」用）逐行等价，但维护时容易只改一处。**建议**：加一条 `dev/test-initiative.mjs` 的「两侧结果对比」断言，或把公式集中到一处（classic/module 双份是现有架构约束）。

---

## 5. 独立复核（8 项）

> 方式：用 Full Suite 笔记（`notes/fullsuite-notes.md`）+ 直接读本插件源码 + 跑离线自测。**发现的问题只记录、不改代码**（收尾期间避免与其他队员撞车）。
>
> **v1.8.0 收尾状态**：复核发现的 F1–F5 已修（F1 卡列表按 id 取并集、F2 重击只取满伤害骰、F3 先攻串行队列、
> F4 `effect` / `dice-history` 内联透明三件套、F5 上限文案），另加修复 F6「资源标记读-改-写竞态」
> （`track.js` 缓存 + `onMetadataChange` 同步，`dev/test-track.mjs` 有回声延迟回归）。以下保留复盘记录。

### 复核项 1：血条几何 `barLayout` / `buildBarItems` / `patchBar`

- 查了什么：环半径 `RO = 半短边 − 2s`、`T = 7s`、`Ri = RO − T`；四防内缩 `max(8s, 描边一半+0.5s)`；文字按内圆拟合降字号（`background.core.js:2222-2351`）；构建与增量刷新共用 `defShapePoints`（`:2434-2463`、`:2501-2510`）。
- 结论：与 Full Suite「几何以 token 为基准、不越界」的原则一致；形态差异（环/四角 vs 胶囊/AC 盾）不影响。**离线证据**：`dev/test-geometry.mjs` 30 组（5 尺寸 × 3 HP × 有/无四防）环 5880 点、四防 2385 点、30 个文字框全部在包围盒内（±0.01），无 NaN；反向验证（把环厚改回 10、短路字号收缩）会失败。
- 发现：`patchBar` 只更新 points/position/visible（`:2472-2525`），四防颜色/底环不透明度是建 item 时写死的（`:2434-2451`）。当前这些是常量，所以**无 bug**；若将来让四防颜色随状态变会不刷新——记录为维护注意点。

### 复核项 2：血条数据 clamp / 权限

- 查了什么：`readHpMeta` 的夹取与 `locked` 默认 true（`background.core.js:2119-2148`）；编辑权限与回调内二次校验（`hp-edit-core.js:257-268`、`:278-314`）；写入时顺手把 `hp-bar/enabled=true`（`:308-312`）。
- 结论：与 Full Suite（`bubbles/index.ts:196-222`、`hpBar/edit.ts:18-36`）同口径。**无 bug**。

### 复核项 3：先攻 `advanceInitiative` 与双实现

- 查了什么：`initiative.js:348-371` 与 `background.core.js:3026-3051` 逐行比对：前绕 `surprise → round+1`、后绕 `round−1`（floor 1）一致；`initPage` 在「下一回合/上一回合」处调用（`initiative-page.js:297-300,659-660`）。
- 结论：逻辑与 Full Suite（`hooks/useInitiative.ts:1305-1403`）**结果一致**，但**没有**它的串行队列：`saveInit` 在写入中直接 `return`（`initiative-page.js:225-242` 的 `busy` 守卫）。→ **F3：快速连点「下一回合」会丢点击（轻微，真机可感知）**。另外两份实现建议加对比断言（§4-8）。

### 复核项 4：骰子重击口径（4E 取满 vs Full Suite 骰数翻倍）

- 查了什么：`maximize` 只在无 wrapper 时生效（`dice-core.js:557-560`），平铺项所有骰取满（`:400-416`）；结果标记/提示（`:596-606`）；UI 文案「所有伤害骰取最大值」（`dice-page.js:830`、`:214,226`）。
- 结论：**与 Full Suite 的 5e 口径不同是有意的**（Full Suite `dice/panel-page.ts:2892` 翻倍）。但发现：**F2：`maximize` 对表达式里所有骰生效，包括 d20**——若用户在重击状态写 `1d20+2d6`，d20 会被强制成 20；4E 重击只应最大化伤害骰。另外减法骰（`-1d6`）也会取满。建议：重击时跳过 d20（或文档约定「重击只用于伤害表达式」）。

### 复核项 5：骰子历史 / 广播 / 落库

- 查了什么：投掷广播 LOCAL+REMOTE（`dice-page.js:279-283,393`）；后台只 GM 落库（`background.core.js:3315-3322`）、按 rollId 去重（`:3200-3210`）、20 条 + 12KB 半裁（`:3233-3250`）；记录窗从房间读（`dice-history-page.js:137-138`）。
- 结论：**无 bug**（GM 不在线不落库是架构限制，已在 README 写明）；与 Full Suite 的 per-client 100 条是两条合理路线。`normalizeRoll` 的数值夹取重算（`dice-core.js:641-664`）保证三端一致，这点比 Full Suite 更严。

### 复核项 6：角色卡三级回退（`getCardsInfo` / `getCards`）

- 查了什么：页面侧 `common.js:360-384`（房间→场景→本机，房间 vs 本机按 `updatedAt` 比新旧）；后台 classic 侧 `background.core.js:1583-1602`（房间→场景→本机，**不比较时间戳**）；写路径 `common.js:398-423`（房间失败→场景→本机）；场景写 `cards-scene.js:107-167`。
- 结论：**F1（真实 bug 候选）**：房间里的卡列表**非空但已过期**时，场景兜底的新卡永远读不到。复现路径：房间已有 5–6 张卡占满预算 → 导入新卡时 `writeRoomKey` 返回 `full`（房间旧列表仍在）→ 新卡写进场景 item → 之后 `getCards()`/`getCardsInfo()` 因「房间有卡」直接返回旧列表 → 刷新后新卡消失，且绑定它的 token 找不到卡（会误弹血条编辑窗）。另外后台与页面两套读取规则不一致（页面会比本机时间戳，后台不会），同一时刻两边可能显示不同卡。**建议**：读取时把 room/scene/local 三份都取出来、按 `updatedAt`（场景卡需要补时间戳）取最新/合并；或房间写失败时明确清空房间旧列表。

### 复核项 7：透明三件套覆盖面

- 查了什么：先攻条完整三件套（`initiative.html:22,28-55,57-61,68`）；记录窗（`dice-history.html:6-21`）与动画页（`effect.html:6-18`）只有 `darkreader-lock` + 样式表 `!important`，**没有 html/body 内联 `style`**。
- 结论：**F4**：交接文件 §3.3 的根因就是「样式表 `!important` 压不住扩展/注入的 `!important`」，而 Full Suite 的透明浮层全部用内联写法（`initiative-panel.html:2,9,11`；`boss-bar.html:2,8`）。这两个浮层目前靠 `darkreader-lock` 挡住了 Dark Reader，但 OBR/其他扩展再注入一层就仍可能变深底。**建议**：给这两页补 `style="…transparent!important"`（或改用 Full Suite v1.3.34 的 `*-native.html` 首帧前置脚本方案，`tools/native-canvas-plugin.mjs:1-10`），并在真机暗色扩展下复验。

### 复核项 8：入口 / 权限 / 选中弹窗分支

- 查了什么：`refreshInfo` 的分支顺序「先卡 → 无卡有血条 → 不弹」（`background.core.js:1999-2031`）对应交接文件 §3.5 的修复；右键菜单注册与 GM/类型 filter（`:1488-1570`）；工具栏/浮动按钮注册（`boot()` 内 `registerTools`，`:3371-3372`）。
- 结论：**分支顺序正确**（先 `boundCardId` 后 `hasHpBarData`），交接文件里「选中无卡 token 误弹血条窗」的旧 bug 已修复；绑定失效时还有名字兜底（`:1903-1945`）。**无 bug**。

### 复核发现汇总

| 编号 | 位置 | 描述 | 严重度 | 影响 | 建议 |
|---|---|---|---|---|---|
| F1 | `common.js:360-384,398-423`；`background.core.js:1583-1602`；`cards-scene.js:107-167` | 房间卡列表非空但过期时，场景兜底的新卡读不到；两套读取优先级不一致 | **中**（会重现「导入后刷新卡消失」） | 6+ 张卡满桌时 | 三份按 `updatedAt` 取最新/合并；或房间写失败时清空旧列表 |
| F2 | `dice-core.js:400-416,545-560`；`dice-page.js:830` | 重击会把表达式里的 d20 也取满（4E 只应取满伤害骰）；减法骰也取满 | 低-中（口径） | 重击时表达式含 d20 才会触发 | 重击时跳过 d20；或 README 约定重击只用于伤害式 |
| F3 | `initiative-page.js:225-242` | 写房间期间「下一回合/上一回合」点击被 `busy` 静默丢弃（Full Suite 是串行队列不丢） | 低 | 快速连点少推进一回合 | 队列化（`saveInit` 链式排队）或按钮 loading 态 |
| F4 | `dice-history.html:6-21`；`effect.html:6-18` | 两个浮层没有内联 `transparent!important`（未照抄 Full Suite 三件套） | 低（待真机） | 暗色扩展/注入样式下可能变深底 | 补内联 style 或改 native 别名 |
| F5 | `initiative-page.js:201` | 提示写「超过 60 条」，实际上限 40（`initiative.js:44`） | 极低（文案） | 误导 | 随版本收尾改文案 |
| F6 | `initiative.js:231-247` | 隐形先攻只隐藏条目，不翻 token `visible`（Full Suite 两者都做） | 极低（口径） | 玩家仍能看到棋子 | 若需要「完全隐形」再加开关；当前按 4E 暗掷语义保留 |

> 说明：F1 涉及 Lead 正在改的角色卡读取函数（`getCards` / `sceneCardsFallback` / `resolveBinding`），本报告只记录、未改动代码。

---

## 6. 交付结论

- **三功能可用性**：骰子（表达式/战斗优势/4E 重击/共享历史/动画）、血条（有卡 + 无卡 token、四防、血怒、编辑窗、权限）、先攻条（加入/隐形/三种掷法/回合推进/常驻透明）在离线自测下全部通过；几何有 30 组越界断言兜底。
- **与 Full Suite 的关系**：把 Full Suite 里「真机验证过」的**机制**（透明、scene.local、per-token 思路、tiebreak、纯函数+广播、几何基准、16KB 纪律）都吸收了过来；把它的**成本项**（3D/shader、React、服务器、多语言、布局系统）明确排除，换成 4E 专属与零服务器方案。
- **仍需处理**：F1（卡读取优先级）建议在本版收尾前修；F2–F4 建议至少补文档或真机验证；F5/F6 记录即可。
- **未验证**：真实房间多人、暗色扩展、实体设备、断网重连——这些和交接文件 §3 一样仍待真机验收，本报告不把离线自测当作真机通过。
