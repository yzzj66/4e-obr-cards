# 4eNEXT to owlbear · Owlbear Rodeo 插件

> 基于 4E NEXT 的 4E 跑团适配 mod：在枭熊里看角色卡速览、绑定 token、先攻条、骰子与血条。
> **当前版本 v2.5.1** · 纯静态（无需 npm / 无需构建）· 零服务器。
> 历史更新记录见 [CHANGELOG.md](CHANGELOG.md)。

## ⭐ 安装地址（复制这一行）

```
https://yzzj66.github.io/4e-obr-cards/manifest.json
```

**在 Owlbear Rodeo 里怎么加：**

1. 打开 `https://www.owlbear.rodeo/extensions`（或进房间 → 右上角 Extensions）
2. 点 **Add Extension** → 粘贴上面的地址 → 确认
3. **刷新房间** → 左上角出现 4E 图标 / 工具栏出现 4E 工具 / 右键地图 token 出现「绑定 4E NEXT 角色卡」

> 如果之前装过旧版本：先在扩展列表里 **REMOVE**，再重新 Add（Owlbear 会缓存旧的 manifest）
>
> **版本升级清单**：`manifest.json` / `manifest.relative.json` 的 `version` **和 `action.popover` 的 `?v=`**（action 弹窗不带版本参数会加载缓存的旧 dice.html）、`assets/common.js` + `assets/background.core.js` 的 `PLUGIN_VERSION`、`assets/index.js`、所有 HTML 的 `?v=`、`info.js` 两个 import `?v=`、`dev/check.mjs` 的 `VER`、`dev/test-initiative.mjs` 的版本字面量、README 顶部版本号。

---

在 [Owlbear Rodeo](https://www.owlbear.rodeo/)（枭熊）里查看 **4E NEXT** 导出的角色卡「速览」页。
核心是五件事：**右键 token 绑定角色卡**、**选中绑定的 token 就弹出速览**、
**在弹窗里加减血量（token 上会画血条）**、**把威能 / 装备点成「已用」**、
**右键加入先攻并按角色卡的先攻加值推进回合**。

- 纯静态：HTML + 原生 JS + CSS，**不需要 npm、不需要构建**，扔到任何静态托管就能用。
- 零服务器：角色卡**双写** —— **房间数据**存精简名单副本（全桌共享、跨场景还在，用于绑定与速览）；
  **当前场景的隐藏 item**（`com.4enext-owlbear/card`）存**完整卡**（字段不丢；换场景看不到，但数据还在那个场景里）；
  两边都写不进才降级本机 localStorage（`4enext/cards-local`）。追踪状态在房间数据，血量存在 **token 的 item metadata** 上。
- 不改卡：插件不碰角色卡本身（威能选择 / 属性 / 装备都不动），只记本场战斗的消耗。
- **入口分块**（v1.3.1，v1.3.2 补齐；v1.4.0 的「先攻」变成屏幕顶部的条）：左上角扩展图标（角色卡 / 导入面板）、
  左侧工具栏**四个**图标（速览 / 角色卡 / 先攻条 / 设置）、**左上角骰子按钮（manifest action）**、右下角浮动按钮、右键菜单。每个功能打开**自己的窗口 / 条**，互不嵌套；
  前两个不依赖后台脚本，所以"哪个入口出现"本身就能用来判断插件哪一层没加载 ——
  详见 [`docs/owlbear-debug.md`](docs/owlbear-debug.md)。

---

## 一、能做什么

| 功能 | 说明 |
| --- | --- |
| 速览面板 | 生命 / 血怒 / 回复值 / 回复力、AC 与三防、六属性、17 项技能、攻击与伤害、威能、专长、装备，外观贴近 4E NEXT 的速览页 |
| 右键绑定 | GM 右键地图上的 **IMAGE token** →「绑定 4E NEXT 角色卡」→ 选一张卡 |
| 选中即弹 | 任何人选中这枚 token，速览小面板就会从 token 上方弹出 |
| **弹窗可拖动** | 按住速览弹窗顶部标题栏（或左侧 ⠿）就能把弹窗拖到不挡地图的地方；位置按 token 记住，右上角 **⌖** 回到 token 上方 |
| **血量加减** | 弹窗里 `−1 / −5 / −10`、`＋1 / ＋5 / ＋10`，或填数字点「受伤 / 治疗」；临时生命 ±、回复力圆点、使用回复力 |
| **token 血条** | 第一次在弹窗里加减过血量后，token 上会自动画「当前 / 上限」血条（含临时生命），受伤 / 治疗立刻变（不需要像参考插件那样右键「添加血条组件」） |
| **token 血条（v1.6.0；v2.4.7 改用户样板布局）** | token 上画**样板布局**：**底部居中圆角横条**（宽 64% token 宽、高 10% 短边、底边距 4%、圆角=高/2，深红轨道 + 按 `cur/max` 左→右填充，≤50% 暗红 `#7f1416`、否则 `#b00000`），**条内居中显示 `12/20`（含临时生命 `+3`）**；**左侧竖排三圆**（上→下 强韧粉 / 反射黄 / 意志蓝，直径 16% 短边、左边距 6%、间距 4%）；**右下角 AC 盾**（宽 20% 短边、深灰蓝底 + 白描边）。数字都放在图形内、按尺寸自适应，装不下隐藏；玩家端只显示比例、不显示数字与四防。**不再用环形**。**右键「添加血条组件」** 显式开启（老 token 默认照旧画，关闭写 `false`，不会自己回来） |
| **v1.6.2 修复** | ① 速览弹窗**删掉 HP 绿条下面那条彩色四防箭头条**（蓝 / 黄 / 绿 / 紫四块盾形夹片），四防数值看下面 **AC / 强韧 / 反射 / 意志 四张数值卡**；token 上的四防 v1.6.1 是一排（**v1.7.9 起回到四角**）。② **先攻条宽高固定**：折叠 **120×40** / 展开 **720×(170\|180\|200)**（v1.7.10 加高，卡片不再被裁切），只在视口太窄时才缩；不再按内容测量 → **投骰后不会再变窄**，卡片区**内部横向滚动**，右侧空列表区域保持深色。见 [`docs/NOTES.md`](docs/NOTES.md) |
| **血条组件编辑窗（v1.7.2；v2.4.7 照 Full Suite 重做）** | 右键「添加血条组件」/ 选中已有血条的 token → **304×106 药丸编辑窗**（v2.4.7：**344×106**，可拖动、位置单独记）：生命药丸（当前 / 上限，背景按比例填充、≤50% 暗红）、**临时生命**、四防（AC / 强韧 / 反射 / 意志，留空 = 不画那枚盾）；顶部 **钉住 📌 / 锁定 🔒 / 重绘 ↻**；**已去掉回复力输入**（surges 数据只读不写）。聚焦全选、失焦 / Enter 提交、saving 时输入禁用；**改动自动保存**（无保存按钮）→ 血条立即刷新。只有城主或 token 创建者能编辑，写失败弹 ERROR 通知（不静默） |
| **移出先攻 / 自动清理 / 透明 / 常驻（v1.7.3）** | ① **右键「移出先攻」**：菜单随名单动态变（已在先攻里 → 只显示移出，不在 → 显示加入两项），点了立刻从条上消失；② **token 被删除 → 条目自动清理 + 游标顺移**，GM 的卡片右上角 **✕** 也能直接移出；③ **先攻条外壳透明**（卡片仍是不透明深色底，右侧空白区不铺深色）；④ **常驻**：进入房间按设置自动显示（默认开、点地图不消失、药丸折叠态同样常驻），「✕」关掉后本次会话不再自动弹。见 [`docs/NOTES.md`](docs/NOTES.md) §13 |
| **记录窗口直开 / 删小字 / 先攻条真透明 / 四防重排（v1.7.6）** | ① **记录窗口**：点按钮**直接**弹出（不再「先发命令等后台」），出来之后按钮变「关闭记录窗口」；打不开会弹 ERROR 通知并让后台关掉骰子窗口再补开。② **删掉 12 处说明小字**（标题副标题、表达式 / 组合 / 预设区右上、防御参考整行、「投骰动画：开」、速览的「token：xxx / 检定已含半等级 / 点一下=已用 / 纯展示」…），**错误提示保留**；顶部状态条**只在后台未连接时出现**。③ **先攻条外壳真正透明**：连 `#app` / `.win` / `.win-body` 也 `transparent !important`，只留卡片与控制行的半透明底。④ **token 四防重排**：四枚统一 **30s**、字放大到 **15s**、整排**左右铺满 token 并均分**（左缘 +4s / 右缘 −4s），AC 半透明白盾仍在最右。见 [`docs/NOTES.md`](docs/NOTES.md) §8、[`docs/NOTES.md`](docs/NOTES.md) §14、[`docs/NOTES.md`](docs/NOTES.md) §0.7 |
| **选中即弹血条编辑窗（v1.7.7）** | **选中**一枚 token 就会按它的状态弹对应的窗：**已绑定角色卡** → 速览（老行为）；**没绑定卡、但已经有血条**（有生命 / 临时生命 / 四防数据，或开着「血条组件」）→ 直接弹 **344×106 的血条编辑窗**，不用先右键。多选 / 没血条的 token 照旧不弹。**同一个 token 只自动弹一次**（关掉之后不会再被选中事件弹回来）；要再改就右键新增的「**编辑血条**」（只在血条开着的 token 上出现）。**Boss 锁**（玩家端隐藏精确数字）时非城主的编辑窗是**只读**的：输入框只读、动态提示「已锁定」（没有保存按钮）。见 [`docs/NOTES.md`](docs/NOTES.md) |
| **减少打扰：只保留错误提示（v1.7.8）** | 用户：「这种提示太多了，不要吧」→ **成功 / 普通提示全部去掉**，不再弹「已保存：50/100，四防已写入」「已加入先攻」「已移出先攻」「已复制」「记录窗口已打开 / 已关闭」「后台已恢复」「投骰已发送」「已保存组合」「已重置本机设置」这类通知（窗口内那一行「已保存 …」小字也一起去掉）；**只保留 `ERROR` / `WARNING`**——断线、写盘失败、窗口打不开、只读 / 锁定（`hp.locked`）这些必须让人知道的问题照旧提示。成功的反馈就是界面本身：血条当场重画、先攻卡片当场消失、按钮文字变「关闭记录窗口」，操作成功不弹窗也不会「没反应」。 |
| **血条全改环形 + 去掉 Boss 模式（v1.7.9）** | 用户定稿：① **去掉 Boss 模式** —— 右键「显示为 Boss」「隐藏 Boss 血条」、速览里的「显示为 Boss」开关、token 上的**名牌 / 分段线 / 锁**全部删除（`hp.boss` 字段只为旧数据兼容保留，不再读取 / 绘制）；② **所有血条改成环形**（复用原来 Boss 的环：48 段、环厚 10s、`Ro = 半短边 − 2s`），**直的 HP 条与蓝色回复力条不再画**；③ **四防回到四角**（左上强韧 / 右上反射 / 左下意志 / 右下 AC 盾）；④ HP 数字仍在（环内正中），编辑窗（改 HP / 四防 / 回复力）照旧 |
| **真透明先攻条 / 复刻 Full Suite / 加值可编辑（v1.7.10，先攻条部分已被 v1.7.11 回退）** | ① **先攻条换 OBR.modal.open 真透明**（`fullScreen + hideBackdrop + hidePaper + disablePointerEvents`，页面 html/body 透明、只画条本身，空白处鼠标透给地图）—— popover 的 `hidePaper` 在真机无效的问题彻底绕开；② **加高不裁切**：展开高度 **170 / 180 / 200**（控制行 36 + 卡片 80 + 卡片下 d20 行 24 + padding），卡片与按钮不再被切掉半截；③ **照抄 Full Suite 卡片**：56×80、当前回合 100、头像 80%、合计 24%、血条 4px（bottom 24%）、掷骰按钮 `top:100% + margin-top:-8`，但**只留一枚居中 d20**（4E 没有优势 / 劣势）；④ **无绑定卡的 token 也能加入先攻**（加值默认 0，不报错、不弹提示）；⑤ **卡片左上角加值可编辑**（有卡自动填卡值、无卡手填；回车 / 失焦写 `entries[].bonus` 并立即重排；GM 任意、玩家只自己 token）；⑥ **状态行**「阶段 · 名字 · 加值 [ ]」与卡片共用同一份写逻辑；⑦ **骰子记录窗**缩到 **300×240**、半透明外壳（`rgba(15,20,28,.86)` + 8px 模糊）、行高 26 / 字号 11、只显示 4 条，「展开全部」才变高；⑧ **所有窗口的 ✕** 统一 `OBR.popover.close(正确 id)` + `OBR.modal.close` + 后台 `{op:"close-win"}` 双保险（修好角色卡面板关不掉）。 |
| **紧急修复：先攻条回退 popover（v1.7.11）** | 用户实测 v1.7.10 的 `OBR.modal.open + disablePointerEvents` 让**整条先攻条不可交互**（右键「加入先攻」点不了、加值输入框改不了、卡片下的 d20 点不动）→ **回退 `OBR.popover.open`**（v1.7.4 的实现），并用 `hidePaper:true` + 页面 `html / body / #app / .win / .win-body / .strip-root / .strip / .strip-items` 全 `transparent !important` 保持透明。保留 v1.7.10 的**加高 170 / 180 / 200**、Full Suite 卡片几何、**单枚 d20**、**加值可编辑**、**无卡 token 也能加入先攻**；拖动改为「页面发纯指针位移 → 后台夹紧后重开同一个 popover」。**若真机上外壳仍是深色：受 OBR 限制，外壳为半透明卡片（`rgba(15,20,28,.86)` + 12px 圆角），不再用 modal。** 教训：`modal + disablePointerEvents` 不能用于需要交互的浮层。 |
| **资源追踪补全 + 共享数据（v1.7.12）** | 用户实测：遭遇 / 每日 / 辅助 / 种族职业四组威能有些 chip 点不动、装备行也点不动。本版：① **四组威能 chips 全部可点**（点 = 已用变灰 + 删除线、再点恢复；**随意威能**无限次，仍是纯展示）；② **装备 / 魔法物品每一行都可点**（耗尽 / 恢复）；③ **默认状态修正**：装备 key 改成稳定 id（`前缀:物品id:第几件`），旧版按下标写的 key 一律忽略 —— 从没点过的卡不会再显示「已用 10/12」，缺省 = 未用、计数 `已用 0 / N`；④ 原 HP 区「🔒 玩家端隐藏数字」挪到**顶部标题区右侧**并改名 **「共享数据」**（开 = 共享 = 全桌显示精确数字，关 = 玩家端只看量化比例；HP 区旧按钮删除）；⑤ 专长仍纯展示。自测：`dev/test-glance.mjs` 断言四组每个 chip 带 `data-act="power"`、每行装备带 `data-act="equipment"`、默认 0 / N、共享数据在顶部；`dev/test-track.mjs` 断言四组都能 toggle / 默认全未用。 |
| **速览「点不动」回归（v1.7.13）** | 用户实测 v1.7.12 后速览窗里**威能 chip / 装备行仍然完全点不动**（原话「一点没改啊」）。本版三层修复：① **全仓审计 pointer-events** —— 速览页（#app / .win / .win-body / .pop / .pop-body / .gl4-* / button）**一条 none 都没有**（运行代码里只剩两处装饰层的 none：投骰动画 .fx-stage、先攻条拖拽落位线 .drop-mark，都不在速览页）；另给速览页容器链与所有 [data-act] 显式写回 **pointer-events:auto** ——万一宿主 / 旧样式给祖先留了 none，后代仍能成为命中目标；② **事件委托从 #body 挪到 document 捕获阶段**（重画换 DOM、子元素 stopPropagation 都不会丢点击）；③ **缓存穿透**：info popover URL 与 info.html / info.js / glance.js / track.js / css 全带 **?v=1.7.13** ——旧缓存的 v1.7.11 渲染层里威能 chip 根本不是 button，这正是「一点没改」的来源。自测：新增 dev/test-info-click.mjs（假 DOM + 真 info.js，dispatchEvent(new MouseEvent("click")) → 断言 track.js 写入 powerUsed / equipmentUsed）；dev/check.mjs 静态扫描 pointer-events 并 spawn 该冒烟。 || **资源追踪** | 威能 / 装备点一下变灰＝已用，再点恢复；行动点与里程碑并成一排加减；短休 / 长休一键恢复（专长只展示，不追踪） |
| **房间数据超限真修复（v1.7.15）** | 真机控制台报 `Unable to update metadata: over size limit of 16 kB` → 之后**加入先攻 / 改加值 / 回合推进 / 骰子历史 / 资源标记全部写不进去**（而且静默）。根因：导入的角色卡 JSON 被**整份**塞进房间数据（单张 4E 卡 4~50 KB）。本版：① **只存渲染必需字段**（名字 / 等级 / 种族职业 / HP·四防 / 属性 / 技能 / 威能列表 / 专长 / 装备 / 先攻 / 被动·移动；**不存**立绘 / spellbook / backpack / 详情正文），单卡实测 **4945 → 1906 字符（5721 → 2436 字节，-57%）≤ 2 KB**；② **写前算体积**：超过 **14 KB**（16 kB 硬上限留余量）就**不写**，弹 **ERROR**「房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史」；③ **降级本机**：角色卡超限时改存 `localStorage`，房间里的先攻 / 骰子照旧能写，token 绑定仍在 item metadata，面板标 **「角色卡：本机」**；④ 设置 →「数据与权限」新增 **清理房间数据**（看用量 + 一键清骰子历史 / 清空角色卡，各两次确认）。自测：新增 `dev/test-cards.mjs` 断言「单卡 ≤ 2 KB」「导入大卡后房间数据仍 ≤ 14 KB」「超限不写 + ERROR」「降级本机」「设置里有清理按钮」。 |
| **场景兜底 + 修误弹窗（v1.8.0）** | ① **角色卡双写**：**房间数据** = 精简名单副本（跨场景 / 全桌可见、用于绑定与速览；受 14 KB 预算）＋ **当前场景隐藏 item** = 完整卡（`com.4enext-owlbear/card`，字段不丢、没有 16 KB 总额限制）→ 两边都写不进才降级本机 localStorage 并弹 ERROR。读的时候按 id 取并集、同 id 用场景里的完整卡（房间名单过期也不会让新卡「刷新后消失」）。② **名字兜底**：token 绑定的卡被删 / 不在本机时，按 token 名字找同名卡，不再误弹血条编辑窗。③ **血条几何修正**（环厚 / 底环透明度 / 四防直径与内缩按真机反馈重调，由另一名队员负责）。④ 全站静态资源带 `?v=1.8.0`；`effect.html` / `dice-history.html` 补内联透明三件套。 |
| **先攻条背景真透明（v1.7.14）** | 用户指出：前面三版（v1.7.3 透明 body / v1.7.6 六层 `transparent !important` / v1.7.10 换 `OBR.modal.open`）**全都没成**，而 FullPeople 的现成实现本来就是透明的 —— 于是**逐行照抄**它。抄的是 `initiative-panel-v131.html` 的三件套：① `<html>` / `<body>` 的 **`style` 属性**里写 `background:transparent!important`（inline `!important` 在级联里**高于任何选择器 `!important`**，后加载样式表与暗色扩展都压不过它，这正是前三版缺的那一层）；② `<meta name="darkreader-lock">`（Dark Reader 之类的扩展整页不处理）；③ `<style data-overlay-canvas>` 里 `:root{color-scheme:normal!important;background:transparent!important}` + `body,#root,.app-hbar,.hbar-cluster{background:transparent!important}`（类名映射成 `#app / .win / .win-head / .win-body / .win-foot / .strip-root / .strip / .strip-items`）。popover 参数也按他们的 `openPanel()` **原样原序**排：`POSITION` + `anchorPosition` + `anchorOrigin/transformOrigin = CENTER/TOP` + `disableClickAway:true` + `hidePaper:true`，**不再用 modal、不再有 disablePointerEvents**（v1.7.10 就是这么把整条交互打穿的）。仍然只有**两处底色**：控制行 `.strip-ctl`（`rgba(11,15,20,.72)`）与卡片 `.initiative-item`（`#141b23`）。列表窗口（`?view=list`）按 `?view=` 判断，保持不透明。自测：`dev/check.mjs` 断言 darkreader-lock / inline 透明 / `:root` 规则 / 参数顺序，`dev/test-initiative.mjs` 的交互断言（右键加入先攻 / 加值输入 / d20 / ✕ / 拖动）全部保留。 |
| **各自独立窗口** | 没有 tab（v1.3.1 拆掉了）：**速览**（选中 token 弹出的小窗）/ **先攻** / **骰子**（占位）/ **角色卡 · 导入** / **设置 · 关于**（v1.3.2）各自一个 popover，id 互不相同 → 可以同时打开、互不嵌套 |
| **各自入口 + 各自位置** | 角色卡：左上角图标 / 工具栏「角色卡」/ 右下角浮动按钮；**速览**（v1.3.2）：选中 token 自动弹 + 工具栏「速览」；先攻、设置：工具栏图标；**骰子（v1.9.2）**：manifest action = 房间左上角按钮，点开直接是骰子栏。每个窗口都能**按住标题栏拖走**，位置按窗口名记在 localStorage，⌖ 回默认点 |
| **设置 / 关于（v1.3.2）** | 工具栏「设置」打开：**左侧分栏**（关于 / 使用说明 / 数据与权限 / 已知限制 / 重置本机设置 / 致谢）+ **右侧内容**；版本号取自 `PLUGIN_VERSION`；「重置本机设置」**二次确认**，只清本机窗口位置与追踪降级数据（不动房间数据 / token 数据）。见 [`docs/NOTES.md`](docs/NOTES.md) |
| **先攻加值联动** | 绑定角色卡时把卡里的「先攻」写进 token 元数据（如 +25）；先攻合计 = d20 + 加值 |
| **先攻条（v1.4.0）** | 屏幕顶部（工具栏「先攻」打开）：折叠 120×40 / 展开 720×170\|180\|200（按战斗状态三档，v1.7.10 加高）；左端**战斗准备 / 突袭 / 一键清空**（要点两次）、战斗态「上一回合 / 下一回合 / 结束战斗」；中间 56×80 头像卡，**当前回合卡高 100 并高亮**；GM 可**拖拽排序**，也可点卡片直接设为当前 |
| **加入先攻** | GM 右键 token →「加入先攻」/「隐形加入先攻」（隐藏身份，只 GM 在列表里可见；地图上的 token 不动），先攻条会自动弹出 |
| **回合推进** | 先攻条：GM 可**任意**推进 / 回退（绕回第一张时轮数 +1）；玩家轮到自己时点卡片上的「结束」，只发广播、由城主客户端落笔。列表窗口（先攻条上的 **≡**）还有重掷全部 / 同步加值 / 上下移 / 删除 / 清空 |
| **骰子（v1.5.0；v1.7.4 窄版）** | 独立窗口 **320×620**（v1.7.4 收窄成窄竖条；打开前仍按视口夹紧），单列：骰子 d4–d100（**4 + 3 两排**）/ 表达式 / **战斗优势 +2** / **重击 · 伤害取满** / 4E 预设（攻击 · 伤害 · 技能）/ 组合；**「本次结果」是窗口底部的固定栏**（上边框分隔，上面的内容自己滚，结果不随滚动消失），按钮 **2×2 换行**、字号整体小一号。表达式支持 `2d6+5`、`-1d6`、`adv()`、`dis()`、`max()`、`min()`、`reset()`、`burst()`、`repeat()`。**只显示点数**：没有 TN 输入，不判定命中 / 豁免；重击是 4E 口径（**只把伤害骰取最大值；d20 与减法骰保持真实掷值**，不是骰数翻倍）。历史由**城主客户端**写进房间数据（**20 条封顶**），城主不在线时本次结果只在本机。见 [`docs/NOTES.md`](docs/NOTES.md) |
| **骰子记录窗口（v1.7.0；v1.7.4 修「打不开」）** | 从骰子窗口的「记录窗口」按钮打开（**独立 popover**，自己的 id、可拖动、位置单独记住，默认开在骰子窗口**右边**、不重叠）：默认显示**最近 4 条**，点「展开全部」看全部（**最多 20 条**，列表内滚动）。数据是**本机历史**（v1.9.2：`4enext/dice-history/<roomId>`，20 条封顶、按 rollId 去重、按房间隔离；不再写房间数据）；记录窗口**默认进入房间自动打开**（设置可关，✕ 后本次会话不再自动开）；两个窗口各自开关、可以同时开着。**v1.7.4**：按钮点下去先显示「打开中…」，后台开窗失败会重试并 **ERROR 通知**，等不到回执时骰子窗口**自己把窗口开出来**（不再「点了没反应」）。见 [`docs/NOTES.md`](docs/NOTES.md) §7 |
| **投骰动画（v1.7.0）** | 投掷后在选中 token 的头顶（没选中时屏幕中央）放大骰子：飞入 → 落地读数 → 放大 ×1.18 → 淡出，约 **2.6 秒**；点数就是本次真实结果（先算完再播）。**纯 CSS 关键帧、无外部库、全屏透明且不挡鼠标**（动画期间照样能平移 / 选中地图）；「设置 → 骰子」可关，关掉 / 打不开时只是不播动画，结果照常显示。见 [`docs/NOTES.md`](docs/NOTES.md) |
| 全屏面板 | 右下角绿色 **4E** 按钮打开：拖拽 / 选择文件 / 粘贴导入导出 JSON，管理房间里的卡，一键绑到当前选中的 token |
| 同名覆盖 | 重新导入同名卡会就地更新（升级、改装备后重新导出即可），已绑定的 token 不丢 |

---

## 二、三步傻瓜部署

插件就是本目录的全部文件。部署 = 找一个能放静态文件的地方，然后把 `manifest.json` 的网址填进 Owlbear。

### 方案 A：GitHub 仓库 + jsDelivr 直链（最快，不用开 Pages）

1. 在 GitHub 新建一个仓库（public），把本目录下的**所有文件**上传到仓库根目录
   （要包含 `manifest.json`、`background.html`、`assets/`、`data/`、`vendor/`、`samples/`）。
2. 拼出 manifest 地址（把 `<用户名>`、`<仓库名>`、分支名换成你自己的）：

   ```text
   https://cdn.jsdelivr.net/gh/<用户名>/<仓库名>@main/manifest.json
   ```

   例：仓库 `FullPeople/4e-owlbear`，分支 `main` →
   `https://cdn.jsdelivr.net/gh/FullPeople/4e-owlbear@main/manifest.json`
3. 把这个地址填进 Owlbear（见第三节）。jsDelivr 首次访问会拉取并缓存，改完文件后等几分钟再刷新。

> 注意：jsDelivr 只认**公开仓库**，且单文件 20 MB 以内（本插件最大的文件是 `data/rules.js`，约 190 KB）。

### 方案 B：GitHub Pages（推荐，长期稳定）

1. 同上，把整个目录上传到仓库根目录。
2. 仓库 **Settings → Pages** → Source 选 `Deploy from a branch` → Branch 选 `main`、目录选 `/ (root)` → Save。
3. 等 1 分钟左右，页面顶部会给出站点地址，形如：

   ```text
   https://<用户名>.github.io/<仓库名>/
   ```

   那么 manifest 地址就是：

   ```text
   https://<用户名>.github.io/<仓库名>/manifest.json
   ```

   浏览器直接打开这个地址能看到一段 JSON 就说明部署成功。

> GitHub Pages 的项目页是**子路径**（`/仓库名/`）。如果某个 Owlbear 版本把 manifest 里的相对路径当成了站点根目录，
> 添加扩展时会报找不到 `background.html` —— 这时改成用方案 A 的 jsDelivr 地址，或用 `index.html` 里生成的**绝对地址 manifest**。

### 方案 C：任意静态托管

Netlify / Vercel / Cloudflare Pages / 自己的 nginx 都行：把目录原样放上去，manifest 地址 = 站点地址 + `manifest.json`。
要求只有一条：服务器返回的 `.js` 是 `text/javascript`（绝大多数托管默认如此），并且支持 HTTPS。

### 路径对不上怎么办（重要）

`manifest.json` 里的路径写的是**绝对地址**（v1.1.0 起）：

```json
{
  "name": "4eNEXT to owlbear",
  "version": "1.6.2",
  "manifest_version": 1,
  "author": "4E NEXT 玩家自制",
  "description": "4eNEXT to owlbear：速览 / 先攻 / 骰子（占位）/ 角色卡导入各自独立窗口……",
  "icon": "https://yzzj66.github.io/4e-obr-cards/icon.svg",
  "action": {
    "title": "4eNEXT to owlbear",
    "icon": "https://yzzj66.github.io/4e-obr-cards/icon.svg",
    "popover": "https://yzzj66.github.io/4e-obr-cards/panel.html",
    "width": 960,
    "height": 660
  },
  "background_url": "https://yzzj66.github.io/4e-obr-cards/background.html"
}
```

**为什么改成绝对地址**：参考实现 `FullPeople/character-cards` 的 manifest 也是绝对路径，官方 Hello World 教程同样用 `/icon.svg`。
相对路径一旦被 Owlbear 按"站点根"解析（GitHub Pages 项目页是子路径 `/仓库名/`），`background.html` 就是 404 ——
表现是**扩展列表里有插件，但房间里没有按钮、也没有右键菜单**，而且不给任何提示。

如果换了托管地址（换仓库名 / 换域名 / 用 jsDelivr）：

1. 用浏览器打开**新地址**下的 `index.html`；
2. 顶部「自检」会告诉你 manifest 里的绝对地址是不是还指着旧站点；
3. 拉到「如果扩展加载失败」，把那里生成的**绝对地址版 manifest** 复制下来，覆盖托管上的 `manifest.json`；
4. 回 Owlbear **删掉扩展再重新添加**（Owlbear 会缓存 manifest）。

目录里另存了一份 `manifest.relative.json`（相对路径版），只在确认宿主能正确解析相对地址时用。

---

## 三、在 Owlbear Rodeo 里添加扩展

1. 打开 <https://www.owlbear.rodeo/extensions>（房间内也可以从右上角菜单进 **Extensions**）。
2. 点 **Add Extension**（或「+」），把上一节得到的 **manifest 地址**粘进去，确认。
3. 回到房间（v1.6.2 预期看到）：
   - 弹出一条 INFO 通知：`4eNEXT to owlbear v1.6.2 已加载：工具栏×5 ✓ · 右键✓ · 浮动按钮✓`（自诊断，可关）；
   - **左上角**扩展图标：打开**角色卡 / 导入**弹窗（由 manifest 的 `action` 渲染，不依赖后台脚本）；
   - **左侧工具栏四个图标**：**速览**（当前选中的 token）/ 角色卡（列表）/ **先攻** / **设置**；**骰子**改为**左上角 action 按钮**（v1.9.2），
     点哪个开哪个**独立窗口**；
   - **右下角**绿色 **4E** 浮动按钮：打开角色卡面板；
   - 右键地图上的图片 token（GM、单选），菜单里多出「**绑定 4E NEXT 角色卡**」「**加入先攻**」「**隐形加入先攻**」
     「**移出先攻**」（v1.7.3：已在先攻里才出现，另外两项同时隐藏）
     以及「**添加血条组件**」「**移除血条组件**」「**编辑血条**」（v1.7.9 起**没有**「显示为 Boss / 隐藏 Boss」两项了）；
   - 每个窗口都**可以同时开着**：按住标题栏能拖走，位置各记各的（右上角 **⌖** 回默认位置）；
     窗口打开前会按视口夹紧，**不会再超出屏幕**；后台没起来时窗口顶部会显示
     「后台未连接，点这里重试」并把相关按钮置灰。

   > 只看到一部分入口？说明对应那一层没加载成功 —— 打开插件根目录的 `background.html` 能看到逐步日志，
   > 面板左下角也会显示「后台已连接 / 后台脚本没有响应」。对照表见 [`docs/owlbear-debug.md`](docs/owlbear-debug.md)。
   > 血条与资源追踪的细节（字段、权限、已知限制）见 [`docs/hp-bar-and-tracking.md`](docs/hp-bar-and-tracking.md)；
   > v1.2.1 的界面微调见 [`docs/ui-tweaks-v121.md`](docs/ui-tweaks-v121.md)；
   > 弹窗拖动的实现、参数与已知限制见 [`docs/NOTES.md`](docs/NOTES.md)。

> 扩展是**每个玩家各自安装**的：你装了，别人也得装一次才能看到速览面板；
> 但**卡片的精简名单副本在房间数据里**，所以别人装好后不用再导入（完整数据在当前场景的隐藏 item 里，换场景需重新导入）。

---

## 四、使用流程

1. **导出**：4E NEXT → 打开角色卡 →「导出存档（JSON）」→ 得到一个 `.json` 文件。
2. **导入**：Owlbear 里点右下角 **4E** → 面板左侧：
   - 把 `.json` 文件**拖进窗口**，或点「导入 JSON」选文件，或点「粘贴」把 JSON 全文贴进去；
   - 导入成功会提示「新增 X 张，更新 Y 张」。
3. **绑定**：在地图上**右键**某个 token →「绑定 4E NEXT 角色卡」→ 在弹窗里点选一张卡（可以搜索）。
4. **看速览**：**选中**这枚 token，速览面板从 token 上方弹出；也可以点工具栏 **速览** 给当前选中的 token 开一次
   （没选中 / 没绑定时会提示先选一个，不会点了没反应）。按住弹窗顶部标题栏可以把它拖到不挡地图的位置，
   位置会按这枚 token 记住（右上角 **⌖** 回到 token 上方）；点右上角 **⤢** 打开完整面板。
   想解绑：右键 →「绑定」→ 点「解除绑定」。
5. **打起来**：在弹窗里点 `−5` 扣血 → token 上的血条立刻变短、数字跟着变；
   点威能 chip → 变灰加删除线（＝已用），再点恢复。打完了点「长休」一键还原。
6. **先攻**：v1.7.3 起先攻条**常驻在屏幕顶部**（进入房间自动出现、点地图不消失；「设置 → 先攻」可关这行为），
   要加人：右键 token →「加入先攻」（或「隐形加入先攻」）；要移出：右键「**移出先攻**」或点 GM 卡片右上角的 **✕**
   （也可以点左侧工具栏的**先攻图标**手动打开；它和角色卡面板、速览小窗互不遮挡，可以一起开）。
   加入时会自动掷 d20 + 角色卡的先攻加值；GM 点「战斗准备」让大家重掷，再点「开始战斗」；
   战斗中 GM 用「上一回合 / 下一回合」推进（**GM 可推进任意回合**），玩家轮到自己时点卡片上的「结束」
   （请求发给城主客户端落笔）。卡片可以**拖拽排序**，点卡片可以直接设为当前回合。
   先攻条的拖动柄 ⠿ 可以把它拖到别处（位置只记相对屏幕中线的偏移，双击 ⠿ 回中）；
   条上的 **≡** 打开列表窗口（重掷全部 / 同步加值 / 上下移 / 删除 / 清空）。
7. **骰子**：**房间左上角「骰子 / Dice」action 按钮**（v1.9.2，manifest action）打开 **320×620 的窄竖条，单列**；骰子 4+3 两排，「本次结果」固定在底部；记录在它自己的「记录窗口」里）。
   - 左边：点骰子按钮组公式（**左键 +1、右键 −1**，角标显示净数量）→ 点「投掷」；
     也可以直接输入 `2d6 + 5`、`adv(1d20)`、`max(1d6,4)` 这类表达式，回车即掷。
   - **战斗优势 +2**：点一下公式加值 +2，再点撤回；**重击 · 伤害取满**：打开后所有伤害骰按最大值算
     （`d6`→6），结果标「重击 · 已取满」。**只显示点数**：没有 TN，不判定命中 / 豁免。
   - **4E 预设**：选中一枚已绑定角色卡的 token，会列出攻击（vs 四防，四防数值另作「防御参考」显示）、
     伤害、豁免（1d20）、技能、先攻——点一下只是把公式填进表达式框。
   - 右边是**本次结果**与**团队共享历史**：城主客户端把每次投掷写进房间数据（20 条封顶），
     所有人刷新后还在；城主不在线时本次结果只在本机（顶部黄条提示）。「清空记录」只有城主能做（点两次确认）。
   - **组合**：填好公式 →「保存组合」（可留空名字），下次点组合名一键填回（只存本机）。
8. **设置 / 关于**：工具栏 **设置** 图标打开独立窗口：左侧分栏看版本 / 使用说明 / 数据与权限 / 已知限制 / 致谢；
   窗口位置不对了、或者「已用」标记只记在本机想清掉，用「**重置本机设置**」（要点两次确认，只清本机数据）。

面板里还有：

- 左侧列表点名字切换预览；每行右侧 **✕** 删除这张卡（同时删掉房间名单副本与当前场景里的完整卡 item，不动 4E NEXT）；
- 选中一枚 token 后，预览区右上角可「绑定到「XXX」」——不用右键也能绑；
- 没有卡时可以点「载入示例」看看渲染效果。

---

## 五、数据存在哪

| 位置 | 键 | 内容 |
| --- | --- | --- |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/cards` | 角色卡**精简名单副本**（v1.8.0 双写）：`{ v, updatedAt, cards: [{ id, name, level, char(精简格式), importedAt, exportedAt }] }`；跨场景 / 玩家侧可见，用于绑定与速览，受 14 KB 预算约束 |
| 当前场景 item `item.metadata` | `com.4enext-owlbear/card` | 角色卡**完整数据**（v1.8.0 双写）：`{ v: 1, card: { id, name, level, char(完整 Character，只去立绘), importedAt, exportedAt, updatedAt } }`；item 为 `visible:false` / `locked:true` / `disableHit:true`，**没有 16 KB 总额限制**；换场景后这张卡不在（数据仍在这个场景里） |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/state/<cardId>` | `{ powerUsed, featUsed, equipmentUsed, itemDailyUsed, actionPoints, milestones, updatedAt }`（v1.2.0 的键名；v1.2.1 起界面只写 powerUsed / equipmentUsed / actionPoints / milestones） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/cardId` | 卡片 id（字符串） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/hp` | `{ cur, max, temp, surges, updatedAt }`（v1.2.0，每枚 token 独立）；**v1.6.0 新增** `surgesMax` / `defenses: { ac, fort, reflex, will }` / `boss: boolean \| { enabled, segments, phase, exact, order }` / `locked`（默认 true） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/hp-bar/enabled` | v1.6.0：血条组件开关。`undefined` = 老 token 照旧画；`true` 画；`false` 不画（右键「移除血条组件」写 `false`，**不 delete**） |
| 场景元数据 `OBR.scene.metadata` | `com.4enext-owlbear/settings.playerThreshold` | v1.6.0：玩家端量化阈值（百分比，缺省 25；只影响本机画法，不是加密） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/init` | v2.5：这枚 token 在自己先攻名单里的那一条 = `{ v:2, d20, bonus, init, tb, hidden, ownerId, updatedAt }`（`init` = 合计，拖拽排序会写小数中点；没有 v:2 的旧值是 v1.3 的加值缓存 `{ bonus, cardId, updatedAt }` / 数字，只当加值读、不算名单成员）。读写见 `assets/initiative.js` 的 `entriesFromItems` / `writeInitiative` |
| 场景元数据 `OBR.scene.metadata` | `com.4enext-owlbear/combat` | v2.5：战斗态 `{ v:1, phase, round, surprise, activeId, updatedAt, migratedAt? }`（`migratedAt` = 旧名单已迁移的一次性标记）。`activeId` 失效时读取端回退第一张；玩家写不进场景时回合推进仍走 CH_INIT_REQUEST 请求城主 |
| 房间/场景旧键 `OBR.room/scene.metadata` | `com.4enext-owlbear/initiative` | **v1.3 ~ v2.4 的旧「整份先攻名单」**：`{ v, updatedAt, phase, round, surprise, activeId, entries: [...] }`。v2.5 起只用于**迁移前只读回退**；GM 首次启动 / 首次读先攻时迁移到 token metadata + scene combat，迁移前整份备份到 `localStorage["4enext/init-backup/<roomId>"]`，迁完把旧键清成空名单 |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/in-init` | v1.7.3 的右键菜单镜像旗标（`true` / `false`）；**v2.5 起不再写**（菜单 filter 直接按 `metadata[com.4enext-owlbear/init].v === 2` 判断），只留常量做旧存档兼容 |
| 浏览器 `localStorage` | `4enext/info-pos` | `{ v: 1, pos: { "<tokenId>": { left, top } } }`（v1.2.2：速览弹窗位置，按 token 记，最多 40 枚；只在本机） |
| 浏览器 `localStorage` | `4enext/win-pos` | `{ v: 1, pos: { "<窗口名（panel / initiative / dice / settings）>": { left, top } } }`（v1.3.1：独立窗口各自的位置；v1.3.2 加了 settings；只在本机） |
| 浏览器 `localStorage` | `4enext/state/<cardId>` | 追踪降级数据：房间数据写不进去时，威能 / 装备「已用」等只记在这台机器上（只在本机） |
| 浏览器 `localStorage` | `4enext/state/initiative` | 先攻降级副本：v2.5 起 token metadata / 场景 combat 完全写不进去时先记在这台机器上（只在本机） |
| 浏览器 `localStorage` | `4enext/init-backup/<roomId>` | v2.5：旧「整份先攻名单」迁移前的完整备份（`{ v, at, room, scene }`，只写第一份最完整的；迁移成功后旧房间键清空） |
| 浏览器 `localStorage` | `4enext/strip-pos` | `{ v: 1, dx, dy }`：先攻条相对屏幕中线的偏移（v1.4.0；只在本机） |
| 浏览器 `localStorage` | `4enext/strip-collapsed` | 先攻条是否折叠成 120×40 药丸（v1.4.0；只在本机） |
| 浏览器 `localStorage` | `4enext/strip-autostart` | v1.7.3：进入房间是否自动显示先攻条（`"0"` = 不自动显示；缺省 = 开；只在本机，设置窗口「先攻」栏改它） |
| 浏览器 `localStorage` | `4enext/strip-closed-this-session` | v1.7.3：本次会话是否手动关过先攻条（条上「✕」写 `"1"`，重新打开时清掉；只在本机） |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/rolls` | `{ v, updatedAt, seq, rows: [{ rollId, ts, rollerId, rollerName, rollerColor, label, expression, mode, dice: [{ type, value, loser?, subtract?, originalValue?, burstParent? }], modifier, total, crit }] }`（v1.5.0：骰子团队共享，**最多 20 条**；只有城主客户端能写） |
| 浏览器 `localStorage` | `4enext/dice/combos` | `{ v: 1, combos: [{ id, name, expr }] }`（v1.5.0：骰子组合，最多 30 条；只在本机） |
| 浏览器 `localStorage` | `4enext/dice/last` | 上一次掷过的规范化公式（v1.5.0；只在本机） |
| 浏览器 `localStorage` | `4enext/dice/local` | 城主离线时的骰子暂存（v1.5.0：最多 20 条；只在本机） |

- 房间数据对**同房间所有人**可见（包括玩家），所以玩家装好扩展就能看到速览；写操作通常需要 GM。
- 角色卡**双写**：房间名单副本会跑 `packCard` 精简（只留速览字段）；当前场景 item 里的完整卡**只去立绘**
  （原图 / 裁切 data URL 动辄几百 KB），其它字段原样保留。读的时候按 id 取并集、同 id 用场景里的完整卡。
- 卸载扩展不会删房间数据 / 场景 item；换房间需要重新导入，换场景后要看到完整数据也要重新导入。
- **血条本身不存数据**：后台页按 `hp` 元数据用 `OBR.scene.local`（本地图形层）画，
  每台机器各画一份 —— 不需要场景写权限，也不会进别人的场景导出。
- **v1.2.1 没有改键名**：`featUsed` / `itemDailyUsed` 仍留在数据里，旧状态照旧能读；
  只是界面不再产生这两类标记（长休会把它们清空）。
- **v1.3.2 的「重置本机设置」只清本机**：删 `4enext/win-pos`、`4enext/info-pos` 与所有 `4enext/state/*`，
  **不碰**房间数据（`com.4enext-owlbear/*`）、token 元数据（`cardId` / `hp` / `init`）和角色卡文件。
  设置页里没有任何写房间 / 写 token 的调用，`dev/check.mjs` 会断言这一点。

### 权限差异（v1.2.0，务必知道）

| 操作 | 谁能做 | 做不到时 |
| --- | --- | --- |
| 导入卡片 / 绑定 token | **城主**（房间数据权限） | 玩家点导入会提示保存失败 |
| 改某枚 token 的血量 | **城主**，或**这枚 token 的创建者**（Owlbear 的 item 权限） | 按钮还在，但点了会弹 ERROR 说明原因 |
| 标记威能 / 装备已用 | 优先写房间数据（通常只有城主）；失败则写**本机 localStorage** | 弹窗底部从「资源：全桌」变成「资源：本机」，并弹一条 WARNING |
| 加入先攻 / 隐形加入 / 推进回合 | **城主** | 玩家看得到先攻列表；「结束我的回合」会发给城主客户端，由城主代写 |
| 骰子历史落库 / 清空 | **城主**（写房间数据） | 玩家投掷只广播；城主不在线时本次结果只在本机（黄条提示 + 本机暂存） |
| 隐形条目 | **只有城主**能看见 | 非 GM 的客户端连名字都收不到（当前回合显示「？？？」） |

> 也就是说：**玩家自己标的「已用」不会同步给城主**（反过来，城主标的会同步给所有人）。
> 想全桌统一，让城主来标。实现细节见 [`docs/hp-bar-and-tracking.md`](docs/hp-bar-and-tracking.md)。

---

## 六、技术说明（为什么是「免构建」）

- **没有打包步骤**：所有页面都是普通 `.html` + `<script type="module">`，浏览器原生 ESM 直接跑。
- **SDK 本地化**：`vendor/obr-sdk.js` 是 `@owlbear-rodeo/sdk@3.1.0` 的 ESM 打包（由 esm.sh 生成、无外部 import）。放在本地，**断网也能加载**，不依赖 CDN。想换成 CDN 也可以，把 `assets/*.js` 里的 `../vendor/obr-sdk.js` 改成
  `https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm`——但那个地址还会去拉 `uuid`，离线不可用，**不推荐**。
- **规则数据离线化**：`data/rules.js` 是从 4E NEXT 的规则数据里裁出来的职业 / 种族 / 基础武器护甲 / 装备等级索引（约 190 KB），
  用来离线推导 HP、防御、技能、攻击等数值。生成脚本是 `dev/gen-rules.mjs`，成品已经提交，**跑插件不需要它**。
- **渲染层**：`assets/glance.js` 把导出的 `Character` 直接拼成 HTML 字符串（无框架、无虚拟 DOM）。
  带 `live` / `editable` 时才渲染成可点的按钮 —— 所以「弹窗」和「面板」用的是同一份渲染代码，语义不会分叉。
- **先攻条（v1.4.0）**：`assets/background.core.js` 的 `openStrip()` 用 `anchorReference: "POSITION"` +
  `anchorOrigin / transformOrigin = CENTER / TOP` + `top: 45` 打开 `initiative.html`（popover id `/initiative-strip`）；
  展开宽度 = max(410, 控制行测量值 + 16) 并按视口 −32 夹紧，高度按 `phase` 三档 129 / 139 / 159（`dev/check.mjs` 会对常量和 CSS 尺寸做断言）。
  页面侧量一次 DOM 后自己 `OBR.popover.setWidth/setHeight`，并把尺寸广播给后台（拖动 / 视口变化重新夹紧要用）。
  拖动只发「起点 + 累计位移」（`CH_STRIP_DRAG`），后台按「屏幕中线 + dx / 45 + dy」换算、夹紧，位置只记偏移。
  排序是「合计 DESC → tiebreak ASC」两级，拖拽用中点法写 `init`（允许小数）/ `tb`；玩家「结束我的回合」只发广播，
  GM 侧四道校验（activeId / owner / GM / 正在推进中）。规格见 `docs/NOTES.md`，落地说明见
  [`docs/NOTES.md`](docs/NOTES.md)。
- **骰子（v1.5.0）**：`assets/dice-core.js` 是纯函数（表达式解析 / 掷骰 / 重击取满 / 载荷归一化 / 合并去重），
  `assets/dice-page.js` 只管 DOM 与广播，`assets/dice-4e.js` 把 `glance.js` 的攻击 / 伤害 / 技能 / 先攻转成预设按钮。
  投掷广播 `CH_ROLL`（LOCAL + REMOTE）→ **城主客户端的后台**（`background.core.js` §7.5）校验归一化、
  幂等合并后写房间数据 `com.4enext-owlbear/rolls`（**20 条封顶**）→ 广播 `CH_ROLL_SAVED`。
  重击不是 5E 的骰数翻倍，而是**每颗伤害骰取满**（d20 攻击骰与减法骰保持真实掷值）；公式里带 `adv` / `max` 等包裹时无法逐颗取满，
  会退化为普通投掷并在结果面板提示。规格见 `docs/NOTES.md`，落地说明见 [`docs/NOTES.md`](docs/NOTES.md)。
- **先攻**：`assets/initiative.js` 管数据模型 / 掷骰 / 回合推进 / 先攻条渲染 / 排序数学；`glance.js` 的 `initiativeBonus()` 是唯一的加值口径，
  绑定角色卡时由 `common.js` 写进 token 元数据。右键菜单与玩家结束回合请求在 `background.core.js`（经典脚本，
  不能 import，所以那边只读元数据、不重算加值）。数据与权限见 [`docs/NOTES.md`](docs/NOTES.md)。
- **独立窗口（v1.3.1，v1.3.2 补齐入口）**：`background.core.js` 里的 `WINS` 注册表给每个功能一个 popover id
  （`/panel`、`/initiative-window`、`/dice-window`、`/settings-window`；速览仍是 `/info`），打开前统一用
  `OBR.viewport.getWidth()/getHeight()` 夹紧（宽高都 ≤ 视口 − 2×16），位置按窗口名记在
  `localStorage["4enext/win-pos"]`；页面侧（`assets/window.js`）只负责发「起点 + 累计位移」、
  后台在线检测、离线置灰与统一提示。为什么这么拆见 [`docs/NOTES.md`](docs/NOTES.md)。
- **入口（v1.9.2）**：`registerTools()` 注册速览 / 角色卡 / 先攻 / 设置**四个** `OBR.tool.create`；**骰子走 manifest `action`**（左上角按钮，popover=dice.html，320×620），右侧工具栏不再有骰子图标
  （旧三个 id 没改，新的两个是 `/glance-tool` 与 `/settings-tool`）。**速览不注册进 `WINS`**：它是
  按 token 记位置的小窗（`infoOpen / infoGeom` 那一套），工具栏入口只负责「给当前选中的 token 重开 `/info`」
  （没选中就给提示）。为什么这么分、设置窗口长什么样、「重置本机设置」的边界见
  [`docs/NOTES.md`](docs/NOTES.md)。
- **血量与资源追踪**：`assets/track.js` 是唯一的动作入口（`applyAction`）与读写层，
  语义照抄 4E NEXT 的速览页（`GlanceVitals.tsx` / `GlanceResources.tsx`）。
  页面里只挂一个 `[data-act]` 事件委托，点完重画。
- **token 血条**：画在 `assets/background.core.js` 里，用 `OBR.scene.local` 给 token 挂
  Curve + Text 子 item（`attachedTo`、`layer: "ATTACHMENT"`、固定 zIndex、关掉缩放继承）。
  做法照抄参考实现 `FullPeople/obr-suite` 的 `src/modules/bubbles/` 与 `src/modules/hpBar/`。
  为了能写 `buildCurve()` 这类调用，`dev/build-background.mjs` 会把 SDK 的**具名导出**
  （`buildCurve` / `buildShape` / `buildText`）一并接到 bundle 作用域 —— 仍然只有那一次构建。

### 文件结构

```text
manifest.json          扩展清单（Owlbear 加载的入口；绝对地址 + action 左上角入口）
manifest.relative.json 相对路径版清单（换宿主时备用，一般不用）
background.html        后台页：只有一个 <script>，并带页内自检日志
button.html            右下角 64×64 的 4E 浮动按钮
panel.html             角色卡 / 导入窗口：导入 / 列表 / 预览 / 绑定（v1.3.1 起没有 tab）
info.html              选中 token 时弹出的速览小面板（v1.2.2 的拖动小窗，未改）
initiative.html        先攻条（v1.4.0；入口 = 左侧工具栏「先攻」）+ 先攻列表窗口（?view=list，先攻条上的 ≡）
dice.html              骰子独立窗口（v1.7.4 单列 320×620：骰子 4+3 / 表达式 / 战斗优势+2 / 重击取满 / 4E 预设；「本次结果」固定在底部；入口 = 左上角 manifest action「骰子 / Dice」）
dice-history.html      骰子记录窗口（v1.7.0：独立 popover、可拖动、最近 4 条 / 展开全部；v1.9.2 读本机历史、默认自动打开）
effect.html            投骰动画页（v1.7.0：全屏 modal、透明、不挡鼠标；纯 CSS 关键帧，由骰子窗口在算完结果后打开）
settings.html          设置 / 关于窗口（v1.3.2 新增；左侧分栏 + 右侧内容；入口 = 左侧工具栏「设置」）
bind.html              右键「绑定」打开的选卡弹窗
index.html             说明页（顶部自检 + 部署提示 + 示例渲染），托管根目录的落地页
icon.svg               扩展图标（清单 / action / 右键菜单都用它）
icon-tool.svg          左侧工具栏「角色卡」图标（24×24 线性图标）
icon-tool-initiative.svg  左侧工具栏「先攻」图标（v1.3.1，同一套风格 + 有序列表徽标）
icon-tool-dice.svg        manifest action「骰子 / Dice」图标（左上角）（v1.3.1，同一套风格 + 骰点徽标）
icon-tool-glance.svg      左侧工具栏「速览」图标（v1.3.2，同一套风格 + 眼睛徽标）
icon-tool-settings.svg    左侧工具栏「设置」图标（v1.3.2，同一套风格 + 两根滑杆）
assets/
  background.core.js   后台逻辑（可读版：右键菜单 / 工具栏 / 浮动按钮 / 速览弹窗定位与拖动 / token 血条 / 自诊断 / 心跳）
  background.bundle.js 后台实际加载的**单文件经典脚本**（SDK + core，由 dev/build-background.mjs 生成）
  background.js        旧缓存兼容垫片（把上面那个 bundle 注入进来，避免旧 background.html 变哑巴）
  panel.js / info.js / bind.js / button.js / index.js
  initiative-page.js   先攻条 / 列表窗口的页面脚本（v1.4.0：折叠、按钮、拖拽排序、滚轮、结束回合）
  dice-page.js         骰子独立窗口的页面脚本（v1.7.0：单列 UI / 广播 / 结果面板 / 打开记录窗口与动画）
  dice-history-page.js 骰子记录窗口的页面脚本（v1.9.2：本机历史 → 最近 4 条，只读；订阅 CH_ROLL 实时累积）
  effect-page.js       投骰动画页的页面脚本（v1.7.0：读 URL 参数 → fxLayout 摆位 → 时间轴 → 自己关闭）
  dice-core.js         骰子纯函数核心（v1.5.0：解析 / 掷骰 / 重击取满 / 归一化 / 合并；v1.7.0 加动画布局 / 时间轴 fx*；无 OBR 依赖）
  dice-4e.js           骰子 4E 预设（v1.7.0：攻击 / 伤害 / 技能；读 glance 的攻击 / 伤害 / 技能与四防，只填公式不判定）
  settings-page.js     设置 / 关于窗口的页面脚本：分栏切换、版本号、重置本机设置（v1.3.2）
  window.js            独立窗口外壳：标题栏拖动、后台在线检测、离线置灰、统一 feedback（v1.3.1）
  common.js            房间数据读写、导入解析、公共小工具、后台心跳探测
  track.js             血量（token 元数据）+ 资源状态（房间数据 / 本机）的语义与读写（v1.2.0）
  initiative.js        先攻数据模型 / 掷骰 / 先攻条与列表渲染 / 排序与拖拽中点法 / 加值同步（v1.3.0，v1.4.0 扩）
  glance.js            速览推导 + HTML 渲染（核心；带 live/editable 时可交互）
  glance.css / ui.css  样式（glance.css 末尾是 v1.2.0 的交互层）
data/rules.js          离线规则索引（自动生成）
vendor/obr-sdk.js      @owlbear-rodeo/sdk 3.1.0（本地化，离线可用）
samples/sample-card.json  示例卡（30 级游侠，可删）
docs/NOTES.md          维护口径速查（v1.7.7 起 docs/ 只留这一个维护文档 + docs/_briefs/ 历史简报）
docs/owlbear-debug.md  排查记录：为什么没按钮、改了什么、怎么验证
docs/hp-bar-and-tracking.md  血条与资源追踪：字段、权限差异、实现取舍、已知限制（v1.2.0）
docs/ui-tweaks-v121.md  v1.2.1 的界面微调：弹窗尺寸、行动点/里程碑同排、去掉专长与每日威能追踪
docs/NOTES.md    v1.2.2 弹窗拖动：实现方式、拖动区、可调参数、已知限制
docs/NOTES.md  v1.3.0 先攻：数据结构、权限、渲染、自测清单
docs/NOTES.md  v1.3.1 为什么拆掉三 tab、四个窗口的入口 / 位置 / 夹紧 / 置灰
docs/NOTES.md  v1.3.2 工具栏入口补齐 + 设置 / 关于窗口（分栏、版本来源、重置边界）
docs/NOTES.md   v1.4.0 先攻条：数据结构、几何、卡片、排序 / 拖拽、回合推进、权限与自测
docs/NOTES.md        v1.5.0 骰子：表达式、重击取满、战斗优势、团队共享 / 落库、4E 预设、自测与限制
docs/NOTES.md  v1.6.0 血条扩展（临时生命 / 四防 / 蓝条）+ Boss 方案 A：数据、几何、**像素常数集中表**、自测；v1.6.1 四防改一排（§0.5）
docs/NOTES.md         v1.6.2：速览删掉彩色四防条 + 先攻条宽高改常量（修「随投骰变窄」）
docs/NOTES.md        v1.7.0：独立记录窗口 + 投骰动画（公式 / 常量表 / 参数 / 降级）+ 去豁免先攻预设 + 20 条删最旧
dev/                   开发期工具（普通用户用不到）
```

### 数值口径

尽量对齐 4E NEXT 的 `web/src/overview/derive.ts`、`sheet/defense.ts`、`sheet/character.ts`：

- 属性 = 基础值 + 种族加值（`raceAbility2Choice` 生效）
- 生命上限 = 职业起始 HP + 体质 + 每级 HP ×（等级 − 1）+ 额外生命；混职两个职业相加后取整
- 防御 = 10 + ½等级 + 属性 + 职业 / 种族 / 护甲 / 盾牌 / 专长 / 自定义 + 魔法物品增强（按「增强：」指向）
- 技能 = ½等级 + 属性 + 受训 5 + 技能巧手 + 种族 + 自定义 − 护甲检定减值
- 攻击 = ½等级 + 属性 + 职业 + 擅长（职业 / 种族 / 专长 token）+ 专长 + 增强 + 自定义
- 伤害 = 属性 + 专长 + 增强 + 自定义，伤害骰取主手 / 副手基础武器

---

## 七、已知限制（请先读这一节）

1. **卡片本身仍然只读**：插件不改角色卡（威能选择 / 属性 / 装备都不动）。v1.2.0 只是**另外**记两份运行时状态：
   token 上的血量、房间数据里的「已用」标记。升级 / 换装备仍然要回 4E NEXT 重新导出导入（同名卡覆盖，绑定与血量都不丢）。
2. **数值是离线推导的**：依赖规则正文才能算出的加值（职业特性自动加值，如信仰甲胄、蛮族机敏、剑法防卫；部分专长的逐条效果）**没有还原**，因此防御 / 攻击等可能与 4E NEXT 差 1~2 点甚至更多。**以 4E NEXT 为准**，面板底部也写了这句提示。
3. **房间数据通常只有 GM 能写**：玩家装好扩展能看速览、能看血条，但导入卡片 / 绑定 token 需要 GM。
   标记「已用」时玩家会退化成**只记在自己这台机器上**（弹窗底部会写「资源：本机」）。
   改 token 血量需要是**城主**或**这枚 token 的创建者**，否则点了会弹 ERROR 说明原因。
   细节见 [`docs/hp-bar-and-tracking.md`](docs/hp-bar-and-tracking.md)。
4. **右键菜单只对 IMAGE token 出现**，且只在**单个**选中时出现（多选不显示）；非 GM 看不到这个菜单项。
5. **先攻条（v1.4.0，v2.5 存储改造）**：横向条 + 卡片 + 拖拽排序都有了，但**没有镜头跟随**（轮到谁不会自动把镜头移过去）；
   掷骰按钮只给 GM（战斗阶段只有 GM 能重掷；准备阶段玩家可掷自己的 token）。玩家「结束我的回合」需要 **GM 客户端在线**
   （由 GM 的 background 落笔），GM 不在时请求不生效（按钮会给提示）。隐形**只隐藏先攻列表里的名字 / 点数**，
   不动地图上的 token；先攻数据 v2.5 起存在**每枚 token 的 metadata** 里（全桌可读，开发者工具仍能看到隐形条目的原始数据）。
   先攻条目上限 **40**；token / 场景 metadata 都写不进去时会降级到本机并提示。
   细节见 [`docs/NOTES.md`](docs/NOTES.md)。
6. **骰子（v1.5.0 / v1.7.0）不做判定**：没有 TN 输入框，不显示命中 / 未命中、豁免成功 / 失败，只显示每颗骰子的点数与总点数；
   重击只对平铺伤害骰生效（`adv(...)` / `max(...)` 等包裹会退化为普通投掷并提示）；
   记录由城主客户端落笔，城主不在线时本次结果只在本机（暂存最多 20 条，不会自动补交）；记录窗口只是把同一份
   房间数据画出来（**20 条封顶、超出删最旧**），删掉记录仍然只能在骰子窗口里由城主做；
   **动画没有皮肤**（骰面是 CSS 画的圆角方块 + 大数字），手感（抛物线高度 / 落地挤压）只在纸面上按参考实现的
   公式推过，真机想调只改 `assets/dice-core.js` 的 `FX_*` 与 `assets/ui.css` 末尾的关键帧（两处一一对应）。
   细节见 [`docs/NOTES.md`](docs/NOTES.md)、[`docs/NOTES.md`](docs/NOTES.md)。
7. **窗口可以拖，但不跟地图**：速览弹窗默认仍弹在 token 上方，位置按这枚 token 记；
   独立窗口（角色卡 / 先攻 / 骰子 / 设置）的位置按**窗口名**记，各自独立。都记在**本机** `localStorage`，
   平移 / 缩放地图不会跟着漂（避免每次拖动都闪一下），点 ⌖ 回默认位置。
   拖动依赖「同一个 popover id 重新 open 只更新位置、不重载页面」这一行为，**尚未真机验证**；
   细节见 [`docs/NOTES.md`](docs/NOTES.md) 与 [`docs/NOTES.md`](docs/NOTES.md)。
   另外：**左上角扩展图标打开的那份面板由 Owlbear 自己定位，拖不动**（拖动只对工具栏 / 浮动按钮打开的
   窗口生效）；想拖请用工具栏图标打开。
8. **数据跟着房间走**：房间数据不跨房间、不跨账号同步；删除扩展不会清空数据（想清空可在面板里逐张删除）。
9. **没有做真机联调**：开发环境无法启动 Owlbear 房间，也无法截取真实界面，所以**没有在真实房间中测试过**。
   已做的检查是：JSON 合法、HTML 引用的文件都存在、ESM 语法与 import 路径可解析、示例卡的渲染结果标签配平、CSS 括号配平，
   外加 **manifest/bundle 静态检查** 与 **假 OBR 的后台冒烟测试**（v1.2.0 起还断言血条三件套真的被
   `scene.local.addItems` 加进去、改血后走 `updateItems`、被删会重建、数据没了会清理；
   v1.2.1 起再断言弹窗宽高、行动点/里程碑同排样式，以及专长与每日威能不再生成可点元素；
   v1.2.2 起再断言弹窗按左上角定位、拖动位移 / 视口夹取 / localStorage 记忆 / 回到 token；
   v1.3.0 起再断言改名 / 版本、右键两项、init 键名一致，以及先攻的绑定 / 加入 / 权限分支；
   v1.3.1 起再断言「无三 tab 残留、四个独立页面、四个互不相同的 popover id、工具栏三个入口、
   打开前按视口夹紧、CSS 独立滚动容器、离线置灰 + 重试按钮」，并在后台冒烟里真的点三个工具
   打开三个窗口、拖动 → 夹取 → 记位置 → ⌖ 回默认；
   v1.3.2 起再断言「工具栏五个入口（速览 / 设置补齐）+ 两个新图标、设置窗口注册进 WINS 且 id 与其它四个不同、
   设置页六栏齐全、版本号只来自 PLUGIN_VERSION、重置本机设置只清白名单内的三个键（代码里没有
   setMetadata / updateItems / setItem / clear）」，并在后台冒烟里点「设置」开窗、点「速览」重开 /info；
   v1.4.0 起再断言「先攻条常量（与 background.core.js 逐项对比）、phase 三档高度、卡片 56×80 / 当前 100 /
   合计 34% / 血条 4px（v2.4.7 底部加高） / 掷骰按钮在卡片下方长方形的 CSS、五个控制按钮 + 三种掷骰、popover 锚点 CENTER/TOP + top 45、
   先攻条拖动只发位移、位置只记偏移」，并在先攻自测里覆盖数据层 / 排序 / 拖拽中点法 / 回合绕回 / 四道权限校验；
   v1.5.0 起再断言「七颗骰子 / 战斗优势+2 / 重击取满 / 没有优势劣势、暗骰、示例框、5etools、
   CH_ROLL 三个频道与 ROLL_MAX_ROWS=40 两端一致、城主落库链路、docs/NOTES.md」，
   并在骰子自测里覆盖解析 / 掷骰 / 重击 / 归一化 / 合并 / 4E 预设；
   v1.7.0 起再断言「骰子窗口单列（v1.7.4 起 **320×620**）、记录窗口是**独立 popover id**（与骰子窗口不同、可同时开、默认 4 条）、
   动画页存在且常量 / 时间轴与 CSS 关键帧一一对应、modal 参数 fullScreen + hideBackdrop + hidePaper +
   disablePointerEvents、没有任何外部库引用、豁免 / 先攻预设已删、20 条封顶时删最旧」，
   并在骰子自测里覆盖 fxBaseSize / fxDieSize / fxBeat / fxLayout / fxQuery、21 条 → 20 条删最旧、
   动画关掉时**不调用 OBR.modal.open**、预设只剩三组；
   并断言后台心跳链路：diag-hello / diag-ping / diag-pong 两端逐字一致、收到 ping 一定回 pong，
   core 与 bundle 都带 `OBR.onReady(boot)` 启动入口）。
   **拖动的手感与「重开 popover 是否重载 iframe」没有真机验证**，真机若不对，先看 `docs/NOTES.md` 的「已知限制」。
   **血条的像素级位置只在纸面上按参考实现的比例推过**，真机若偏了，改 `barLayout()` 里的常数即可。
   如果房间里加载不正常：先看 index.html 顶部「自检」、面板左下角的连接状态条，或直接打开 `background.html` 看逐步日志，
   都不行再把这三样截图贴出来（详见 `docs/owlbear-debug.md`）。
10. **SDK 版本**：使用的是 `@owlbear-rodeo/sdk@3.1.0`（与同作者插件 `character-cards` 相同）。Owlbear 若改动 API，需要更新 `vendor/obr-sdk.js`。
11. **专长只展示、不追踪（v1.2.1）**：4E NEXT 靠专长**正文**判断「每次遭遇 / 每日」，插件里没有专长正文，
   所以干脆不提供专长的「已用」标记（数据字段 `featUsed` 仍保留兼容），短休也因此只清遭遇威能。
12. **血条是本地图形**：不进场景导出、别的插件读不到；它跟着 `hp` 元数据走，换机器 / 重开页面会自动重画。
13. **v1.6.0 的 Boss 是「token 附带」方案 A**（规格 §7）：没有全屏屏底 Boss 条（方案 B 是 P4 可选，本版没做），
    也不限制 Boss 数量；环形 / 名牌的像素位置**只在纸面上按规格推过**（**v1.6.1 的四防一排已在真机跑通**），
    真机若偏了只改 `assets/background.core.js` 顶部常数区与 `barLayout()`（对照
    [`docs/NOTES.md`](docs/NOTES.md) §3 的像素常数集中表）。
    玩家端「锁」= 本机不画精确数字与四防，**metadata 仍对全桌可读**（不是加密）；旋转 token 上环 / 牌按包围盒重算位置，不会跟转。

---

## 八、自测 / 二次开发

需要 Node 18+（只是开发期用，跑插件不需要）：

```bash
# 一条命令跑完全部自测（8 步 = check + test-background + test-initiative + test-track + test-dice + test-geometry + test-import + test-glance2）
#   Windows PowerShell 不支持 &&，所以给了这个包装脚本；全部通过时 exit 0
node dev/selftest.mjs

# 本地起静态服务器预览（默认 http://127.0.0.1:8123/）
node dev/serve.mjs

# 静态自检：JSON / HTML 引用 / import 路径 / manifest 绝对地址 + action /
#   bundle 无 import-export 且能按经典脚本解析 / bundle 与 core 是否同步 /
#   v1.2.0：track.js 存在、KEY_HP 两边一致、bundle 里接入了 buildCurve 等具名导出
#   v1.2.1：弹窗尺寸 620~680 × 640~760、行动点/里程碑同排样式、专长与每日威能不再可点
#   v1.2.2：弹窗位置键 / 拖动频道两边一致、LEFT/TOP 定位、视口夹取、info.js 指针事件、ui.css 光标
#   v1.3.0：名字 / init / initiative / 请求频道键名一致、右键两项、先攻模块导出
#   v1.3.0 修复：diag-hello / diag-ping / diag-pong 两边逐字一致、后台订阅 ping 并回 pong、
#                core 与 bundle 里都有 OBR.onReady(boot) 启动入口（bundle 落后直接 FAIL）
#   v1.3.1：panel.html / panel.js / ui.css 里没有 tab 残留；四个独立页面与各自脚本都在；
#                四个 popover id 互不相同、WINS 注册了三个窗口；工具栏三个入口 + 三个图标；
#                打开前按视口夹紧（WIN_MARGIN / winSize / reclampWins）；CSS 有独立滚动容器；
#                离线时 [data-bg] 真 disabled + 「后台未连接，点这里重试」；标题统一「4eNEXT to owlbear」；
#                窗口拖动频道 / 位置键两端一致、老键 4enext/info-pos 没被改名
#   v1.3.2：工具栏补齐速览 / 设置两个入口 + 两个新图标；设置窗口注册进 WINS、id 唯一；
#                设置页六栏齐全、版本号取自 PLUGIN_VERSION（没有写死）；
#                「重置本机设置」只清 4enext/win-pos、4enext/info-pos、4enext/state/*，
#                代码里没有 setMetadata / updateItems / localStorage.setItem / clear
#   v1.4.0：先攻条尺寸常量与 background.core.js 逐项一致、phase 三档、卡片 CSS 尺寸、
#                战斗准备 / 突袭 / 一键清空 / 三档掷骰按钮、popover 锚点（POSITION + CENTER/TOP + top 45）、
#                先攻条频道 / 位置键两端一致、docs/NOTES.md 存在、docs/spec-*.md 未改
#   v1.5.0：dice-core / dice-4e 存在且不依赖 OBR、表达式 wrapper 齐全、重击取满 + 退化提示、
#                骰子窗口的元素 id、d4–d100 七颗、战斗优势+2 / 重击按钮、没有优势劣势 / 暗骰 / 示例框 / 5etools、
#                CH_ROLL / CH_ROLL_CLEAR / CH_ROLL_SAVED / KEY_ROLLS 两端一致、ROLL_MAX_ROWS = 40、
#                城主落库链路、docs/NOTES.md（v1.7.4 起窗口是 320×620 单列）
#   v1.7.4：骰子窗口 320×620、骰子 repeat(4) 4+3 两排、.dice-acts 两列 + .wide、
#                「本次结果」在 DOM 末尾且 .dice-result 是 flex:none + 上边框、.dice-left 独立滚动、
#                字号整体收一档；记录窗口五层加固（重试 + ERROR 通知 / getWidth 确认 / 贴着骰子窗开 /
#                骰子页 900 ms 没回执就自己开 / ready 握手）；版本 1.7.4 全链路
#   v1.6.0：hp-bar/enabled 独立键、hp 新字段（surgesMax / defenses / boss / locked）、
#                ref→reflex 只在 track.js 映射、像素常数（20/12/3/30/10/2/48/26/6）、
#                zIndex（盾 15000 / 填充 20000 / 数值 30000）、环 / 盾用 Curve 手绘（没有 buildShape）、
#                Boss 压制普通条、右键 4 项 + operator:"!=" + 关闭写 false、速览四防 / 蓝条 / 锁、
#                docs/NOTES.md、版本 1.6.2
#   v1.6.1：四防一排（DEF_ROW = fort/reflex/will/ac、DEF_GAP = 6、rowCY = hpTop − gap − d/2）、
#                退化规则「从右往左保留 → AC 最后才丢」、AC 半透明白（DEF_AC_FILL/STROKE_OPACITY）、
#                四角摆位（var spots）必须已删干净、版本身份 = 1.6.2
#   v1.6.2：速览里没有彩色四防条（gl4-def-row / data-act="defense" 已删、四防数值卡 .gl4-defs 还在）、
#                先攻条宽高是常量（stripSizeFor 不收测量值、页面没有 scrollWidth、全仓没有 measureWidth）、
#                后台 snapStripSize 兜住页面报上来的尺寸、docs/NOTES.md 存在
#   v1.7.0：dice-history.html / effect.html / 两个页面脚本都在；记录窗口有独立 id 且注册进 WINS；
#                动画常量（128 / 0.86 / 72 / 1200 / 500 / 360 / 220 / 320 / 55 / 4 段弧）与 CSS 关键帧一致；
#                modal 参数 fullScreen + hideBackdrop + hidePaper + disablePointerEvents；
#                动画页 / 记录页没有外部库引用（没有 http(s):// 脚本、没有 CDN）；豁免 / 先攻预设已删；
#                20 条封顶是「删最旧」；设置里有投骰动画开关；docs/NOTES.md 存在；版本 1.7.0
#   v1.7.1：effect.html 把 html + body 一起设成 background: transparent !important（不是只透明 body）；
#                effect.html / .fx-* 段**没有深色纯色 background**；html:has(body.fx-page) 也是 transparent；
#                3000 ms 兜底 close（FX_CLOSE_FALLBACK_MS = 3000）+ ESC / 点击立即关；版本 1.7.1
#   v1.7.2：hp-edit.html / assets/hp-edit-page.js / assets/hp-edit-core.js 都在；popover id 两端一致；
#                四防四个输入框（AC / 强韧 / 反射 / 意志）+ 语法解析函数 parseHpInput 存在；
#                保存写 com.4enext-owlbear/hp；右键「添加血条组件」改成 onHpBarAdd（写开关 + 开窗）；
#                版本 1.7.2；manifest 仍然没有 action
node dev/check.mjs

# 后台冒烟测试：假 OBR 跑一遍 background.core.js，断言入口 + 通知 + 心跳
#   + v1.2.0 的 token 血条（addItems / updateItems / 自愈 / 清理）
#   + v1.2.2 的弹窗拖动（打开 → 位移 → 夹取 → localStorage → 重开 → 回到 token）
#   + v1.3.0 修复：手动触发 diag-ping，断言后台立刻广播 diag-pong（频道名 / LOCAL 都对）
#   + v1.3.1：三个工具栏入口各开自己的窗口（id 互不相同）、尺寸 ≤ 视口 − 2×margin、
#                拖动 → 夹取 → 落盘 → ⌖ 回默认、小屏 800×600 也不溢出、视口变化后重新夹紧
#   + v1.3.2：工具栏五个入口都在且图标正确；点「设置」打开 settings.html（被夹进视口）；
#                点「速览」对当前选中且已绑定的 token 重开 /info
#   + v1.4.0：工具栏「先攻」打开先攻条（CENTER/TOP + top 45 + 720×129）；
#                拖动 → 夹紧 → 只记偏移 → ⌖ 回中；「≡」打开列表窗口（?view=list，880×640）
#   + v1.5.0：骰子落库（CH_ROLL → 校验归一化 → 同 rollId 幂等 → 写 rolls → 广播 CH_ROLL_SAVED；
#                20 条封顶、d600 夹到 600、玩家客户端不写房间数据、城主清空写空 rows）
#   + v1.6.0：带四防 + 回复力画 14 件（HP 3 + 蓝条 3 + 4 盾 + 4 数字）、文本 12/20 +3 与 5/6、
#                boss:true → 20 件（环 / 牌 / 锁）且压制 HP 条、segments=3 → 2 条分段 + 阶段文案、
#                解锁只改锁颜色、玩家端 0.6 → 0.75 阶梯且不画数字 / 四防、enabled=false 一件不留、
#                右键 4 项写盘（添加 true / 移除 false / Boss 开关 / 无血 WARNING）
#   + v1.6.1：四防一排——fort/reflex/will/ac 同一行（y 相同）、x 从左到右递增、AC 最右且半透明白
#                （fill #ffffff@0.18 + 白描边@0.85）、这一排在 HP 红条上方、Boss 环下仍是一排、
#                窄 token 退化：20×20 放 2 枚 → 剩 fort+ac（先丢意志、再丢反射）、14×40 只放 1 枚 → 只留 AC
#   + v1.7.2：hp-edit-core 的语法（20 / 20/20 / +5 / -3 / 15+5 / 看不懂就保留原值）、
#                跨字段夹取（cur ≤ max、回复力 ≤ 分母）、空四防 = 删键且一枚盾都不画、
#                权限分支（玩家改别人的 token → 拒绝 + 没写盘）、租约（旧 version / 换 session / A→B→A）、
#                右键「添加血条组件」→ 写 true + 打开 hp-edit.html（340×122），自动保存后立刻重画
node dev/test-background.mjs

# 先攻自测：绑定写 init / 右键两项 / 加入先攻写房间数据 /
#   GM 推进 / 玩家结束回合权限 / 隐形对非 GM 不可见
#   v1.4.0：d20 / tb / phase / round、上限 40 截断、旧数据兼容、两级排序、
#   绕回轮数 +1、突袭轮、拖拽中点法（同分只改 tb / 不同分取中点 / 最顶最底 ±1）、
#   写失败降级本机 + WARNING、四道权限校验（含「正在推进中」只推一格）
#   v1.7.3：右键菜单 filter 按 in-init 互斥（加入后写 true / 移出写回 false）、
#   「移出先攻」从 entries 删掉该 tokenId、卡片 ✕（GM 有 / 玩家没有）、
#   token 被删除后自动清理 + 当前条目被删时游标顺移、切场景不清名单、
#   先攻条自动显示三态（默认开 / 设置关 / 本次已关）+ onReadyChange 真实路径 + 折叠态仍 disableClickAway
node dev/test-initiative.mjs

# 血量 / 资源追踪的语义自测：逐条核对 4E NEXT 的规则
#   （先扣临时生命 / 负数先归零 / 回复力 / 已用标记 / 写不进去退本机）
node dev/test-track.mjs

# 骰子自测（纯函数，不需要浏览器 / 不需要 OBR）：
#   解析（adv / max / reset / burst / repeat 的写法）与 formatExpr 幂等、
#   负数骰 / max 抬值保留原值 / resetmin 重掷 / burst 链 / repeat 每行加值、
#   **重击 = 所有伤害骰取满**（带 adv 等包裹时退化为普通投掷并提示）、**战斗优势 +2 可逆**、
#   载荷归一化（旧 rolls[] 形状 / d600 夹到 600 / 无 rollId 丢弃）、**没有 target / hit**（不做命中判定）、
#   合并幂等 + 倒序 + 20 封顶、20 条样例 < 6000 字符、频道与上限三处一致、窗口尺寸
node dev/test-dice.mjs

# 改了 assets/background.core.js 之后重新生成 assets/background.bundle.js
node dev/build-background.mjs

# 渲染自检：用示例卡跑一遍推导，并检查渲染出的 HTML 标签配平与 CSS 括号
node dev/check-render.mjs

# 重新生成 data/rules.js（需要 4E NEXT 源码）
node dev/gen-rules.mjs

# 从本机 4E NEXT 存档重新生成示例卡
node dev/make-sample.mjs 1
```

> `dev/` 目录不参与运行，删掉也不影响插件。

---

## 九、许可与致谢

- 插件本体：可自由使用、修改、二次分发。
- `vendor/obr-sdk.js`：`@owlbear-rodeo/sdk`（MIT，Owlbear Rodeo 官方 SDK），由 esm.sh 打成的 ESM 单文件。
- 界面与数值口径参考了 4E NEXT（同作者的 4E 角色卡应用）与 `FullPeople/character-cards` 的结构。
- v1.2.0 的血条做法（子 item + `OBR.scene.local` + 烘焙已渲染尺寸）参考了 `FullPeople/obr-suite`
  的 `src/modules/bubbles/`、`src/modules/hpBar/`（GPL-3.0）。这里只借鉴其架构与 API 调用方式，
  代码是按本插件的「免构建 / 无框架」风格重写的；资源追踪的语义则照抄 4E NEXT 的速览页。
- 本项目与 Owlbear Rodeo、4E NEXT 均无隶属关系；角色卡数据只在你自己的房间和浏览器里流转。