# 变更记录（4eNEXT to owlbear）

> 这份文件是历史更新记录。安装与使用请看 [README](README.md)。

**v1.8.3：先攻条 d20 按钮移到卡片下方**（2026-11-16）——
卡片下方那枚圆形 d20 原来上移 8px、压在卡片底边遮挡合计数字；现改为**卡片正下方的整宽长方形按钮**
（`margin-top: 1px`、`width: 100%`、`height: 16px`、`border-radius: 4px`），不再遮挡卡片内容；
`.strip-items` 的 `min-height` 96 → 104 兜底（卡片 80 + 下方按钮 17）。弹层 170/180/200 高度不变；点按钮掷骰逻辑不变。
另：**血条编辑窗底栏只留保存**（取消按钮与那行提示移除，保存按钮加宽；标题栏 ✕ 与 Esc 仍可关窗）。

**v1.8.2：先攻条交互修整**（2026-11-16）——
① **点先攻条卡片头像不再弹速览**：页面在 `OBR.player.select` 之前广播 `CH_GLANCE_SUPPRESS`，后台 1.5 秒内
`refreshInfo` 提前返回；玩家 / 非战斗点卡片仍然会选中 token（地图高亮保留），只是不弹窗；
GM 战斗中点卡片照旧设为当前回合。
② **先攻条卡片可直接手改掷出的 d20 点数**：卡片上那个大号数字在有权限时变成输入框（`data-init-d20`，
回车 / 失焦保存），**输入的是 d20 点数、不是合计**；保持左上角加值不变，合计自动 = 点数 + 加值 并按合计重排
（例：输入 20、加值 100 → 小字 `(20+100)`、合计 120）。`preparing` 且未掷 d20 时保持只读，玩家看别人的条目也保持只读。

**v1.8.1 合并收尾**（2026-11-16）——
① **修资源标记「点 A 把已用的 B 变回未使用」**：`assets/track.js` 的读-改-写竞态（OBR 元数据回声延迟导致覆盖）——
本页状态缓存 + `updatedAt` 单调递增 + `room.onMetadataChange` 同步，威能 / 专长 / 装备 / 每日威能 / 行动点 /
临时加值 / 长短休全部共用；`dev/test-track.mjs` 新增「回声延迟」回归（17 个威能、连点 3 次、两个页面交替取并集）。
② **修血条编辑窗「保存 / 关闭后自己又弹」**：同一 token 的窗口已开着就**复用**（不关掉重开），保存与手动 ✕ 后
不再对同一选中 token 自动弹；右键「编辑血条」仍然能开。
③ **重击口径 / 先攻 / 透明**：4E 重击只取满**伤害骰**（d20 与减法骰保持真实值）；先攻「下一回合 / 上一回合」改
**串行队列**（快速连点不丢、失败 ERROR）；`effect.html` / `dice-history.html` 补**内联透明三件套**
（inline `transparent !important` + `darkreader-lock` + `data-overlay-canvas`）。
④ **角色卡双写 + 速览对齐 4E NEXT**：房间数据 = 精简名单副本（跨场景 / 用于绑定）＋ 当前场景隐藏 item = 完整卡
（字段不丢，读时按 id 取并集）；速览补齐威能动作类型 / 攻击命中摘要、专长每日·遭遇标记、装备物品等级、
临时命中 / 伤害 / 四防 / 回复值、受伤治疗、短休、可用总数。

**v1.8.0：角色卡双写存储 + 误弹窗修复 + 发布卫生**（2026-11-16）——
① **角色卡改成双写**：**房间数据** `com.4enext-owlbear/cards` 存**精简名单副本**（`packCard` 短键；
全桌共享、跨场景还在，用于绑定与速览，受 14 KB 预算）＋ **当前场景的隐藏 item**
（`com.4enext-owlbear/card`；新文件 `assets/cards-scene.js`；`visible:false` / `locked:true` / `disableHit:true`，
metadata 只挂 `{ v:1, card }`，存**完整 Character（只去立绘）**，**没有 16 KB 总额限制、字段不丢**）。
两边都写不进（玩家身份 + 房间只读）才降级本机 `localStorage` + ERROR（不静默）。
读卡时把房间名单 / 场景完整卡 / 本机较新副本**按 id 取并集**，同 id 优先场景完整卡
（房间名单过期也不会让新卡「刷新后消失」）；后台 `getCards()` 也会读场景 item（token 绑定不会因降级失效）；
设置里的「清空角色卡」同时清房间 / 场景 / 本机三份。
② **名字兜底**：token 绑定的角色卡被删 / 不在本机时，按 token 名字找同名卡，修「选中 token 弹错窗
（弹出的是血条编辑窗而不是速览）」的剩余一半。③ **血条几何修正**：环厚 / 底环透明度 / 四防直径与
四角内缩按真机反馈重调（由另一名队员负责）。④ **发布卫生**：清掉 `docs/` 里 12 个旧拆分文档
（维护口径统一在 `docs/NOTES.md`）；全站 HTML 对 `assets/*.js` / `assets/*.css` 的引用统一带 `?v=1.8.0`
（含 `background.html` 的 bundle）；`effect.html` / `dice-history.html` 补内联透明三件套。
⑤ **资源标记不再互相覆盖**（v1.8.1）：`assets/track.js` 加「本页状态缓存 + `updatedAt` 取新 + `room.onMetadataChange` 同步」，
修真机「逐个点威能 / 专长 / 装备时，点 A 会把已用过的 B 改回未使用」的读-改-写竞态；
所有资源动作（威能 / 专长 / 装备 / 每日威能 / 行动点 / 临时加值 / 长短休）共用这一套。
自测：`dev/test-cards.mjs` 覆盖双写（房间名单 + 场景完整卡 + 本机兜底 + 场景 item 契约 + 清理三份）；`dev/test-track.mjs` 新增「回声延迟」回归（17 个威能全点、连点 3 次、专长/装备各 5 个、两个页面交替点击取并集）。

在枭熊（Owlbear Rodeo）里查看 4E NEXT 导出的角色卡「速览」；**右键 token 绑定角色卡，选中即弹出速览**。
v1.2.0 起：弹窗里能**加减血量**（token 上会自动画血条），威能 / 装备点一下变灰＝**已用**。
v1.2.1：速览弹窗加宽到 660×700，行动点与里程碑并成一排；专长改为纯展示、装备栏去掉每日威能计数。
v1.2.2：速览弹窗可以**按住标题栏拖走**（位置按 token 记住，⌖ 一键回到 token 上方），不再固定挡住地图。
**v1.3.0**：改名 **4eNEXT to owlbear**（当时的做法是把速览 / 先攻 / 骰子合成一个面板的三个 tab，
v1.3.1 已按用户要求拆掉，见下一条）；
右键新增**加入先攻 / 隐形加入先攻**，绑定角色卡后**先攻加值自动取卡里的「先攻」**（如 +25）；
GM 可推进任意回合，玩家可「结束我的回合」。
**v1.3.0 修复**：`background.core.js` 尾部被截断 → `background.bundle.js` 语法错误 →
后台整段不执行、面板显示「后台脚本没有响应」。已补齐启动入口（`OBR.onReady(boot)`）、
重新构建 bundle，并给 `dev/check.mjs` 与 `dev/test-background.mjs` 加上**心跳 ping/pong** 断言。
详见 [`docs/initiative-v13.md`](docs/initiative-v13.md) 第 9 节。
**v1.3.1：撤掉三 tab 合并，改回「分块」**——**速览 / 先攻 / 骰子（占位）/ 角色卡导入**各自
**独立窗口 + 独立入口**（左上角图标、左侧工具栏三个图标、右下角浮动按钮、右键菜单），
各自可拖动、各自记位置、可以同时打开；同时修好**面板超出屏幕**（打开前按 `OBR.viewport` 夹紧 +
内部滚动）与**按钮点了没反应**（统一反馈 + 后台离线置灰与「重试」）。背景与取舍见
[`docs/separate-windows-v131.md`](docs/separate-windows-v131.md)。
**v1.3.2：把工具栏入口补齐成一排**——速览 / 角色卡 / 先攻 / 骰子 / **设置** 五个图标（图标同一套细线风格），
并新增**设置 / 关于窗口**（左侧分栏：关于 / 使用说明 / 数据与权限 / 已知限制 / 重置本机设置 / 致谢，
右侧内容；同样可拖动 + 打开前按视口夹紧）。「重置本机设置」只清本机位置记忆与追踪降级数据，
**不碰房间数据与 token 数据**。细节见 [`docs/settings-window.md`](docs/settings-window.md)。
**v1.4.0：先攻条**——「先攻」从大窗口改成**屏幕顶部的横向先攻条**（按 `docs/spec-initiative.md` 实现）：
折叠 120×40 药丸 / 展开 720×(129 / 139 / 159 三档，随战斗状态切换)；**战斗准备 / 突袭 / 一键清空**（二次确认）、
56×80 头像卡（当前回合卡高 100 并高亮）、**拖拽排序**（合计降序 → tiebreak 升序）、GM **任意推进回合**、
玩家「结束我的回合」（只发广播，由城主客户端落笔）。隐形条目**只在先攻列表里对玩家隐藏**，地图上的 token 不动。
先攻条目上限 60（房间数据预算），写不进去时降级到本机并提示。细节见 [`docs/initiative-v14.md`](docs/initiative-v14.md)。
**v1.5.0：骰子**——独立窗口从 660×560 **加宽到 760×620**，两栏：左边组公式 / 右边结果 + 团队历史。
表达式（d4–d100、`2d6+5`、以及 `adv` / `dis` / `max` / `min` / `reset` / `burst` / `repeat` 包裹）、
**战斗优势 +2**、**重击 = 4E 伤害骰取满**（`d6`→6，标注「重击 · 已取满」）、**4E 预设**
（攻击 vs 四防 / 伤害 / 豁免 / 技能 / 先攻）、组合保存、**团队共享历史**（城主落笔，40 条封顶）。
**只显示点数**：不做命中 / 豁免判定、没有优势劣势按钮、没有暗骰、没有示例框。细节见 [`docs/dice-v15.md`](docs/dice-v15.md)。
**v1.6.0：血条扩展 + Boss 样式**——token 上画 **HP 红条（含临时生命 `+N`）+ 蓝色回复力条 + 四防**
（AC / 强韧 / 反射 / 意志）；右键新增 **「添加 / 移除血条组件」** 与 **「显示为 Boss / 隐藏 Boss 血条」**；
Boss 按规格**方案 A（token 附带）**：环形血条（48 段）+ 名牌 + 分段线 + 锁，并压制普通 HP 条。
细节（含**像素常数集中表**，真机微调只改一处）见 [`docs/hpbar-boss-v16.md`](docs/hpbar-boss-v16.md)。
**v1.6.1：四防从「四角」改成「一排」**（真机 v1.6.0 已跑通，本版只动四防的摆位与样式）——
**强韧 / 反射 / 意志 从左到右 + AC 最右**（AC 用**半透明白色图标**），整排贴在 **HP 红条上方**；
窄 token 退化时**优先保留 AC**。HP 文本 / 蓝条 / 环 / Boss / 锁的数值与位置一个字没动。
**v1.6.2：两处收尾修复**——① **速览弹窗删掉 HP 绿条下面那条「彩色四防箭头条」**
（用户原话「预览部分不需要显示，直接修改下面对应的数值栏位就行」；四防数值仍看下面那四张数值卡，
token 上的四防一排**不动**）；② **先攻条宽高改成常量**（折叠 120×40 / 展开 720×(129|139|159)），
不再按控制行内容测量 —— 修「投骰后整条变窄、右侧留大片空白」的 bug，卡片多了在条内横向滚动。
细节见 [`docs/ui-v162.md`](docs/ui-v162.md) 与 [`docs/initiative-v14.md`](docs/initiative-v14.md) §12。
**v1.7.0：骰子记录独立成窗 + 投骰动画**——① **记录**从骰子窗口的右栏搬出来，变成
**自己一个可拖动的窗口**（参考 FullPeople 的 history-page：独立 popover id、按住标题栏拖走、位置单独记住、
默认只显示**最近 4 条**、可「展开全部」，和骰子窗口**各自开关、可以同时开着**）；骰子窗口随之收窄到 **520×620**，
只留骰子 / 表达式 / 战斗优势 +2 / 重击取满 / 本次结果 / 4E 预设 / 组合。
② **复刻投骰动画**（照抄参考实现 effect-page 的布局与时间轴公式：大骰子飞入 → 落地读数 → 放大 ×1.18 → 淡出，
约 2.6 秒；**纯 CSS 关键帧**、全屏透明、**不挡鼠标**，在「设置 → 骰子」里可关，关掉只是不播动画、结果照常）。
③ 去掉「**豁免**」「**先攻**」两个 4E 预设（4E 豁免就是一个 d20；先攻条本来就自带投先攻）。
顺带把「**40 条封顶 = 超出自动删最旧**」写清楚并加了断言。细节见 [`docs/dice-v17.md`](docs/dice-v17.md)。
**v1.7.1：修「投骰动画黑屏」**——动画层现在是**完全透明**的：v1.7.0 只把 `body` 设成透明，
而 `ui.css` 顶部的 `html { background: var(--bg) }` 让 `html` 还留着一层不透明深色 `#0b0f14`，
于是全屏 modal 把地图整块盖死（用户截图「投掷怎么黑屏了」）。现在连 `html` 一起 transparent，
地图照常可见、骰子浮在上面；同时加了 **3000 ms 兜底关闭**与 **ESC / 点击任意处立即关**。
细节见 [`docs/dice-v17.md`](docs/dice-v17.md) §2.6。
**v1.7.2：血条组件编辑窗（HP / 四防 / 回复力）**——修「右键『添加血条组件』之后没地方填数值」：
现在右键**「添加血条组件」会先写开关、紧接着打开一个 340×150 的可拖动编辑小窗**（位置单独记住），
里面填 **生命**（`20` = 设上限 / `20/20` = 当前/上限 / `+5`、`-3` = 加减）、
**四防**（AC / 强韧 / 反射 / 意志，**留空 = 不画那枚盾**）与**回复力**（`3/3`）；
保存写进 token 的 `com.4enext-owlbear/hp`，血条立刻刷新。**没绑定角色卡的怪物 / 杂兵也能单独加血条与防御**
（绑了卡的先带入卡里的数值）；「移除血条组件」照旧写 `false`、**不删数据**，下次能恢复。
细节见 [`docs/hpbar-boss-v16.md`](docs/hpbar-boss-v16.md) §12。
**v1.7.3：先攻条「移出 / 自动清理 / 透明 / 常驻」**——① 右键菜单改成**动态**：token **已在先攻里 → 只显示
「移出先攻」**（点了从名单删掉、立刻刷新条、通知「已移出」），不在 → 才显示「加入先攻」「隐形加入先攻」；
② **token 被删除**时先攻条里的条目**自动清理**、当前回合的游标**顺移**到下一张（不会卡在一个不存在的单位上），
GM 的卡片右上角还多了 **✕** 可以直接移出；③ **先攻条外壳背景透明**——地图能透出来，只有卡片本身保留深色底，
右侧空列表区域不再铺深色（控制行留一层半透明底让字看得清）；④ **常驻显示**：进入房间就自动出现
（「设置 → 先攻」可关这行为，默认开）、**点地图不会关**，条上「—」最小化到 120×40 药丸（药丸也常驻）、
「✕」才是真正关闭（本次会话不再自动弹，重新打开即恢复）。细节见
[`docs/initiative-v14.md`](docs/initiative-v14.md) §13。
**v1.7.4：骰子窗口收窄成窄竖条 + 「本次结果」固定底部 + 修「记录窗口打不开」**——① 窗口从 520×620
收窄到 **320×620**（用户：「和 Players 面板差不多就行」，并明确否掉了宽版），因此**七颗骰子改成 4 + 3 两排**、
按钮 **2×2 换行**（投掷 / 上一次 / 保存组合 / 记录窗口），战斗优势 +2 / 重击 / 清空记录再 2+1 换行，
**字号整体小一号**；② **「本次结果」用一条分隔线固定在窗口底部**，上面的骰子 / 表达式 / 4E 预设 / 组合
自己滚动 —— 结果**不随滚动消失**；③ 修「**记录窗口**」按钮点了没有独立窗口出现：后台开窗失败会**重试 + ERROR 通知**、
toggle 前先确认窗口真的还开着（状态跟丢就重开）、记录窗口默认**贴着骰子窗口**开（不再正好被骰子窗口整块盖住）、
骰子窗口等不到回执时**自己** `OBR.popover.open` 兜底，记录窗口加载完再发 `ready` 握手。
细节见 [`docs/dice-v17.md`](docs/dice-v17.md) §7。
**v1.7.5：token 上四防一排改样式**（只动样式，位置 / 顺序 / 数值都不变）——**强韧 / 反射 / 意志 从盾形改成圆形**、
直径 **30s → 22s**、数字跟着小一号；**AC 仍是半透明白盾、直径 30s 不变**（与 v1.6.1 一致）。
整排仍**居中、贴在 HP 红条上方**，顺序仍是 强韧 → 反射 → 意志 → **AC 最右**；窄 token 的退化顺序不变
（先丢意志 → 反射 → 强韧，AC 优先保留），阈值按新的 22s 直径重算。
细节见 [`docs/hpbar-boss-v16.md`](docs/hpbar-boss-v16.md) §3 / §4。
**v1.7.6：删提示小字 + 记录窗口彻底修好 + 先攻条真透明 + 四防按参考图重排**——
① **记录窗口**：点按钮**直接** `OBR.popover.open`（不再先发命令等后台回执），开出来之后按钮文字变
**「关闭记录窗口」**（看得见的反馈）；打不开就弹 **ERROR 通知**「记录窗口打开失败：…」并请后台**先关掉骰子窗口再补开**；
记录窗口页面加载完还会自己 `getWidth` 确认存活。② **删掉 12 处说明 / 状态小字**（骰子窗口标题副标题、表达式区、
组合区「只存本机」、4E 预设区「只填公式，不判定」与整行「防御参考 …」、「投骰动画：开」、顶部状态条「后台已连接 v…」、
速览的「token：xxx」「检定已含半等级 +15」「点一下 = 已用 / 再用一次 = 恢复」「纯展示，不追踪使用」），
**错误提示一律保留**，状态条**只在后台未连接时出现**。③ **先攻条外壳真正透明**：除 html / body / .strip / .strip-items 外，
`#app` / `.win` / `.win-body` / `.strip-root` 也 `transparent !important`，**只留卡片与控制行的半透明底**（验证方法见文档 §14.1）。
④ **token 四防重排**（参考图 15）：四枚统一 **30s**（三防圆 22 → 30）、字放大到 **≈15s**、整排**左右铺满 token 并均分**
（左缘 +4s / 右缘 −4s，`gap = (可用宽 − 枚数×d)/(枚数−1)`），AC 半透明白盾仍在最右；退化顺序与阈值规则不变。
细节见 [`docs/dice-v17.md`](docs/dice-v17.md) §8、[`docs/initiative-v14.md`](docs/initiative-v14.md) §14、
[`docs/hpbar-boss-v16.md`](docs/hpbar-boss-v16.md) §0.7。
**v1.7.7：选中 token 直接弹血条编辑窗**（用户：改血量只能右键「添加血条组件」，太绕）——
① 「选中即弹」从「只有速览」拆成两支（**单选**才判断，多选 / 空选一律不弹）：**已绑定角色卡** → 速览（没变）；
**没绑定卡但有血条**（`com.4enext-owlbear/hp` 里有生命 / 四防 / 回复力等数值，或 `hp-bar/enabled === true`）
→ 直接弹出 **340×150 的血条编辑窗**（v1.7.2 那个窗，这回从选中直接进）；没卡也没血条 → 什么都不弹（没变）。
② **只自动弹一次**：记「已经为这枚 token 弹过」（`hpAutoPopped`），token 换了 / 取消选中就清；
用户把窗口关掉、保存血量引起的 scene 事件、缩放地图都不会把它弹回来。
③ 右键新增 **「编辑血条」**（血条开着的 token 上出现）：不看选中，直接开这枚 token 的编辑窗 —— 关掉之后要再改就点它。
④ **Boss 锁只读**：`hp.locked` 时非城主的编辑窗只读（藏「保存」+ 提示「已锁定」）；城主不受限制
（`locked` 默认就是 true、语义是「玩家端隐藏精确数字」，把城主也锁死的话点开就改不了）。
编辑窗仍会顺手确保 `hp-bar/enabled = true`，所以填完数值血条立刻画出来。
**v1.7.8：减少打扰 —— 只保留错误提示**（用户：绿底「已保存：50/100，四防已写入」这类提示太多，原话「这种提示太多了，不要吧」）——
① **成功 / 普通类 `OBR.notification.show` 全部去掉**：编辑窗保存、加入 / 移出先攻、token 删除后的自动清理、
「结束回合 → 第 N 轮」、绑定角色卡、导入 / 删除角色卡、绑定 token、骰子「记录窗口已打开 / 已关闭」「已保存组合」
「已请求清空全桌记录」「已填入 …」、先攻「已同步先攻加值」「已请求结束回合」「已取消」、设置「投骰动画已打开」
「已重置本机设置」、窗口「后台已恢复」「窗口已回到默认位置」、启动汇总「已加载 …」等 —— 都不再弹。
② **窗口内的状态行**（不是通知）同样清掉「已保存 …」这类成功回音（编辑窗改成只写「血量 x/y / 只读 / 已锁定」的状态行）；
**失败 / 只读 / 锁定**说明保留（写失败 ERROR、后台未连接 WARNING、「已锁定」「只读」提示照旧）。
③ 留下来的只有 **ERROR / WARNING**：断线、写盘失败（房间数据降级本机）、窗口打不开、权限不足、数据不合法、锁定提示。
④ 帮助函数再兜一道：`notify()` / `feedback()` 只放行 `ERROR` / `WARNING`，传别的 variant 只写控制台 / 页面日志，
以后有人手滑加回成功提示也不会真的弹出来；`dev/check.mjs` 新增断言「全仓库成功类通知调用数为 0」，
`dev/test-background.mjs` / `dev/test-dice.mjs` / `dev/test-initiative.mjs` 里「保存 / 开窗 / 移出后有通知」的断言
全部反向改成「**没有**通知」。

**v1.7.9：血条全部改成环形 + 去掉 Boss 模式 + 去掉回复力蓝条 + 四防回到四角**（用户 2026-11-15 定稿）——
① **血条 = 环形**（把原来只有 Boss 才有的环套到所有带血量的 token 上）：**环厚 10s、`Ro = 半短边 − 2s`、48 段**
（直接复用 `ringSectorPoints`），空余部分是暗色底环，血量按 `cur/max` 从 12 点顺时针填；
**直的 HP 条与蓝色回复力条不再画**（回复力仍可在速览 / 编辑窗里看、能改）。
② **HP 数字保留**：`12/20`（有临时生命时 `12/20 +3`）改放在**环内正中**，带描边压得住 token 图。
③ **去掉 Boss 模式**：右键「显示为 Boss」「隐藏 Boss 血条」两项、速览里的「显示为 Boss」开关、
以及 token 上的**名牌 / 分段线 / 锁**全部删除；`hp.boss` 字段只为旧数据兼容而留着（**不再读取、不再绘制**）。
④ **四防回到四角**（用户指定坐标）：**左上黄=强韧 / 右上绿=反射 / 左下紫=意志 / 右下=AC（半透明白盾）**，
直径都 **30s**、字 **15s**、贴 token 四角内侧 **4s**；窄 token 退化仍是「先丢意志 → 反射 → 强韧，**AC 最后才丢**」。
⑤ 环形的像素常数集中在 `barLayout()` 顶部（`RING_THICK` / `RING_INSET` / `RING_SEGMENTS`），真机微调只改那里；
`dev/check.mjs` 同步常数（环厚 10s / 直径 30s / 四角 inset 4s）并断言「没有 Boss 菜单 / 没有直条 / 没有蓝条」，
`dev/test-background.mjs` 改成断言环形段数（98 点 = 48 段）/ 圆心半径 / 四角圆心坐标 / 无 Boss 元素。

**v1.7.10：真透明先攻条 + 复刻 Full Suite 卡片 + 加值可编辑（用户 2026-11-15 定稿）**——
① **先攻条改 `OBR.modal.open` 真透明**：`fullScreen + hideBackdrop + hidePaper + disablePointerEvents`，
页面 html/body 全透明、只画条本身（空白处鼠标透给地图）—— popover 的 `hidePaper` 在真机压不住宿主纸张底，彻底换方案。
② **加高不裁切**：展开高度 **170 / 180 / 200**（控制行 36 + 卡片 80 + 卡片下 d20 行 24 + padding 16），折叠 120×40 不变。
③ **照抄 Full Suite 卡片几何**：56×80 / 当前回合 100 / 头像 80% / 合计 24% / 血条 4px（bottom 24%）/
掷骰按钮 `top:100% + margin-top:-8`；4E 没有优势 / 劣势 → **卡片下只留一枚居中 d20**。
④ **无绑定卡的 token 也能加入先攻**：加值默认 0、不报错、不弹提示（名字取 token 名、无头像用首字占位、没 HP 不画条）。
⑤ **卡片左上角加值可编辑**（`data-bonus-input`）：有卡自动填卡值、无卡可手填；回车 / 失焦写 `entries[].bonus` 并立即重排；
GM 可改任意、玩家只能改自己 token 的条目。⑥ **状态行**「阶段 · 当前单位 · 加值 [ ]」（`data-bonus-row`）与卡片**共用同一份写逻辑**。
⑦ **骰子记录窗口**：380×380 → **300×240**，外壳透明 + 页面画半透明深色卡片（`rgba(15,20,28,.86)` + 8px 模糊），
行高 26 / 字号 11、只显示最近 4 条，「展开全部」才临时变高。
⑧ **修所有窗口的 ✕**：统一 `OBR.popover.close(正确的弹窗 id)` + `OBR.modal.close` + 后台 `{op:"close-win", name}` 双保险
（角色卡面板会退化成全屏 modal，只 popover.close 关不掉），先攻列表 / 骰子 / 记录 / 设置 / 血条编辑窗一并修。
`dev/check.mjs` 断言 modal 参数、170+ 高度、Full Suite 六个关键数值、单枚 d20、加值输入与 close-win；
`dev/test-initiative.mjs` / `dev/test-background.mjs` / `dev/test-dice.mjs` 同步。

**v1.7.11：紧急回归修复 —— 先攻条回退 popover（可用 > 透明）**——
① **根因**：v1.7.10 的 `OBR.modal.open({ fullScreen, hideBackdrop, hidePaper, disablePointerEvents: true })`
让**整个 modal 层不接收指针**，页内 `.strip { pointer-events:auto }` 在部分浏览器 / OBR 版本里救不回来：
右键「加入先攻」被全屏层挡住、加值输入框改不了、卡片下的 d20 点不动（用户实测）。
② **修法**：先攻条**回退成 `OBR.popover.open`**（v1.7.4 的实现），并用 `hidePaper: true` + 页面
`html / body / #app / .win / .win-body / .strip-root / .strip / .strip-items` 全 `transparent !important` 保持透明；
popover 只占条本身那块区域，按钮 / 输入框 / 右键菜单都不再被挡。
③ **保留 v1.7.10 的成果**：加高 **170 / 180 / 200**（不裁切）、Full Suite 卡片几何（56×80 / active 100）、
卡片下**只留一枚 d20**、加值可编辑（卡片左上角 + 状态行 + 列表窗口）、**无卡 token 也能加入先攻**。
④ **拖动协议修正**：页面只发**纯指针位移**（`screenX/screenY`），后台加起点偏移、夹紧后**重开同一个 popover**
（iframe 复用，不重载）—— 不再让页面自己写 left/top（那是 modal 时代的做法）。
⑤ **尺寸**：高度随 phase 变时，后台按 `{op:"size"}` 重开同一个 popover 换 170/180/200；折叠仍是 120×40。
⑥ **真机兜底**：若 popover 外壳仍被宿主画成深色，按约定**不再退回 modal**，接受**半透明深色卡片**
（`.strip.shell-card` / `rgba(15,20,28,.86)` + 12px 圆角）——「受 OBR 限制，外壳为半透明卡片」。
⑦ **自测**：新增「先攻条打开时右键『加入先攻』→ entries 仍然增加」的回归断言；所有窗口 ✕ / 拖动 / 加值输入
在 popover 版本下重跑；`node dev/selftest.mjs` 5/5，v1.7.8「成功类通知 = 0」保留；manifest 仍无 action。
教训写进 [docs/NOTES.md](docs/NOTES.md)：**modal + disablePointerEvents 不能用于需要交互的浮层**。

**v1.7.12：速览资源追踪补全 + 「共享数据」挪到顶部**——
① **四组威能 chips 全部可点**：遭遇 / 每日 / 辅助 / 种族职业（点 = 已用，灰 + 删除线；再点恢复）；
**随意威能**无限次，保持纯展示。
② **装备 / 魔法物品每行可点**（`data-act="equipment"`，耗尽 / 恢复）。
③ **默认状态修正**：装备 key 改为稳定 id（`前缀:物品id:同类第几件`），旧版按下标写的 `e-0` / `w-3` 读取时一律忽略；
缺省 = 未用，「已用 x / N」只数当前卡上真有的条目（修「从没点过却显示已用 10/12」）。
④ **「玩家端隐藏数字」→「共享数据」**：从 HP 区挪到速览**顶部标题区右侧**（与先攻 / 被动 / 移动同一排小卡片风格）；
开 = 共享 = 全桌可见精确数字（`hp.locked = false`），关 = 玩家端只看到量化比例（默认）；HP 区旧按钮删除。
⑤ 专长仍纯展示，不追踪。
自测：`dev/test-glance.mjs` 新增「四组每个 chip 带 data-act=\"power\" / 每行装备带 data-act=\"equipment\" /
默认 0 / N / 共享数据在顶部且方向正确」，`dev/test-track.mjs` 新增「四组威能都能 toggle / 默认全未用 / equipment 动作名」；
`node dev/selftest.mjs` 5/5，保留 v1.7.8「成功类通知 = 0」与 v1.7.11 先攻条 popover 回退；manifest 仍无 action。

**v1.7.13：速览「威能 / 装备点不动」回归修复（pointer-events / 事件委托 / 缓存穿透）**——
用户实测 v1.7.12 后速览窗里四组威能 chip 与装备行**仍然完全点不动**（原话「一点没改啊」）。
① **pointer-events 全仓审计**：速览页链路（`info.html` / `assets/info.js` / `assets/glance.css` / 本页加载的 `ui.css`）
**没有任何 `pointer-events:none`** 作用到 `#app` / `.win` / `.win-body` / `.pop` / `.pop-body` / `.gl4-*` / `button`；
运行代码里只剩两处装饰层的 none：骰子动画 `.fx-stage`（纯展示、故意点穿地图）与先攻条拖拽落位线 `.drop-mark`，都不在速览页 —— 先攻条仍用 popover，未被改动。
另在 `glance.css` 给 `body.info-body` 的容器链与所有 `[data-act]` / `button` / `input` 显式写回 **`pointer-events:auto !important`**：
按 CSS 规范，祖先被宿主 / 旧样式设成 `none` 时，后代写回 `auto` 仍能成为命中目标。
② **事件委托改挂 `document` 捕获阶段**（原来只挂 `#body`）：`body.innerHTML` 重画换 DOM、子元素 `stopPropagation`、
正文外层再包一层都不会丢点击；仍然只认 `[data-act]`，页头按钮走自己的监听。
③ **缓存穿透**：info popover 的 URL 带 `?v=1.7.13`，`info.html` 的 `ui.css` / `glance.css` / `info.js` 与 `info.js`
里的 `glance.js` / `track.js` 也带 `?v=1.7.13`。旧缓存的 v1.7.11 渲染层里威能 chip 根本不是 `button` ——
「5/5 绿但真机一点没改」正是这一种：页面根本没换成 v1.7.12 的渲染。
④ **新增假 DOM 点击冒烟** `dev/test-info-click.mjs`：用真的 `info.js` + `track.js`，从渲染结果里取 `[data-act]` 元素，
`dispatchEvent(new MouseEvent("click"))` → 断言 `OBR.room.setMetadata` 写入 `powerUsed` / `equipmentUsed`、
重画成 `.used` + `aria-pressed=true`、再点恢复、装备计数 `已用 1 / 12`。
`dev/check.mjs` 增加静态扫描（速览页无 `pointer-events:none` / 委托在 document 捕获 / 资源带 `?v=`），
并 spawn 该冒烟（selftest 仍是 5 条命令，但点击链路不会漏测）。
自测：`node dev/test-info-click.mjs` 全绿、`node dev/selftest.mjs` 5/5，保留 v1.7.8「成功类通知 = 0」与 v1.7.11 先攻条 popover 回退；manifest 仍无 action。

**v1.7.14：先攻条背景真透明 —— 逐行照抄 FullPeople/obr-suite**——
用户原话：先攻条透明这件事「折腾了 3 版」全失败（v1.7.3 只透明 body / v1.7.6 六层 `transparent !important` /
v1.7.10 换 `OBR.modal.open`），而 **FullPeople 的现成代码本来就是透明的**，应该直接照抄。
读源码（`src/modules/initiative/index.ts` 37 KB、`panel-page.tsx` 35 KB、`styles/initiative.css` 28.7 KB、
`components/*`，以及真正的页面 `initiative-panel-v131.html`）后的结论：
① **透明根本不在 popover 参数里** —— 他们的 `openPanel()` 与我们的写法其实一致：
`id / url / width / height / anchorReference:"POSITION" / anchorPosition:{left:Math.round(vw/2)+dx, top:TOP_OFFSET+dy} /
anchorOrigin:{horizontal:"CENTER",vertical:"TOP"} / transformOrigin:{...同} / disableClickAway:true / hidePaper:true`；
② 透明的活儿全在**页面**，而且靠的是 `initiative-panel-v131.html` 头部的三件套：
`<html style="color-scheme:normal!important;background:transparent!important">`、
`<meta name="darkreader-lock" />`、
`<style data-overlay-canvas>:root{color-scheme:normal!important;background:transparent!important}body:not(.config),#root,#bossBars,.app-hbar,.hbar-cluster{background:transparent!important}</style>`、
`<body style="background:transparent!important">`；`styles/initiative.css` 里则**一次都没给容器铺过底**
（`html, body, #root { height:100%; background: transparent !important; }`、`.app-hbar { background: transparent !important; }`），
只有卡片 `.initiative-item`（`var(--bg-card)`）与各个 chip 自带底色。
③ 我们前三版缺的就是**写法层级**：类名 + 样式表 `!important` 压不住「后加载的样式表 / 暗色扩展注入的 `!important`」，
而 **inline `!important`** 在级联里高于任何选择器 `!important`。所以这一版：
- `initiative.html` 在 `<head>` 里同步执行 10 行内联脚本，**首帧之前**就把
  `background:transparent!important` / `color-scheme:normal!important` 写进 `<html>` 与 `<body>` 的 **style 属性**
  （声明与取值与 FullPeople 逐字一致；用 `?view=` 判断，列表窗口 `?view=list` 不挂、仍是不透明窗）；
- 加 `<meta name="darkreader-lock">`；
- 加 `<style data-overlay-canvas>`，把他们的 `:root` / `body,#root,.app-hbar,.hbar-cluster` 规则映射到
  `#app / .win / .win-head / .win-body / .win-foot / .strip-root / .strip / .strip-items`；
- `ui.css` 同步加一条同名单（样式表版兜底）；**只有 `.strip-ctl`（半透明）与 `.initiative-item`（不透明）两处留底色**；
- `background.core.js` 的 `stripPopoverOptions()` 按 `openPanel()` 的**原样原序**重排（`disableClickAway` / `hidePaper` 放到最后），
  `hidePaper:true` 保留；**不引入 modal，不引入 disablePointerEvents**（v1.7.10 就是这么把右键 / 加值框 / d20 全打穿的）。
自测：`dev/check.mjs` 新增 v1.7.14 静态断言（darkreader-lock / html·body 的 inline 透明 / `:root{color-scheme:normal}` /
各层 `transparent !important` / popover 参数与 FullPeople 同序同值 / 无 modal）；
`dev/test-initiative.mjs` 的交互断言（右键加入先攻、卡片加值输入、d20、✕、拖动重开）**全部保留**；
`node dev/selftest.mjs` 5/5，保留 v1.7.8「成功类通知 = 0」与 v1.7.11 先攻条 popover 回退；manifest 仍无 action。

**v1.7.15：房间数据超限（16 kB）真修复 —— 角色卡精简 + 写前预算 + 本机降级 + 清理入口**——
真机控制台报 `Uncaught (in promise) Error: Unable to update metadata: over size limit of 16 kB`：
导入的角色卡 JSON 被**整份**塞进 `room.metadata`（单张 4E 卡 4~50 KB），整包 cards + initiative + rolls + state
远超 16 kB 之后，**之后所有** `OBR.room.setMetadata`（加入先攻 / 改加值 / 回合推进 / 骰子历史 / 资源标记）
全部被拒，而且失败是**静默**的 —— 这就是「加入先攻点不动、先攻条不更新」的真正根因（不是菜单、不是缓存）。
这一版四层修复：
① **角色卡精简（只存渲染必需字段）**：新增 `assets/cards-core.js`（纯函数，Node 里可直接测）的
`packCard / unpackCard`。房间数据里只留速览渲染真正读到的字段 —— 名字 / 等级 / 六属性 / 种族·职业 / 速览用的
HP·四防·技能 / 威能列表 / 专长 / 装备与增强 / 先攻与被动·移动；**不存**立绘、`spellbook`、`backpack`、
`creation` 正文、xp / 性别 / 年龄 / 信仰这类纯资料字段，也不存 `pages.reserve / overview / background`。
结构上再压一层短键 + 数值数组（`{label,value}` 只留 value，因为速览只求和），读出来（`unpackCard`）还原成
4E NEXT 的 Character 形状 → `glance.js / track.js / initiative.js` **一行都不用改**。
用 `samples/sample-card.json` 实测：**完整 `pages.character` 4945 字符 / 5721 字节 → 精简后 1906 字符 / 2436 字节**
（**-57%**，单卡 ≤ 2 KB）；`dev/test-cards.mjs` 还断言 pack → unpack 之后 `deriveGlance` / `renderGlanceHTML` /
`cardMeta` / `initiativeBonus` **逐字节一致**（修体积不能改数值）。
② **写前预算检查**：`ROOM_MAX_BYTES = 14 * 1024`（16 kB 硬上限留 2 KB 余量）。
页面的 `writeRoomKey()` 与后台的 `roomWriteGuarded()` 都是「先 `getMetadata` → 把这次要写的键合进去 →
算 `JSON.stringify(...).length` → 超了**根本不写**」。角色卡 / 先攻 / 骰子 / 资源四条写路径全部接上；
超限模板只有一条、三处一字不差：`房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史`，
一律 `ERROR` 通知（**不再静默**）。
③ **降级到本机**：角色卡超限（或 OBR 直接拒写）时写 `localStorage["4enext/cards-local"]`，
房间数据里那些键一个字节都不动 → **先攻 / 骰子 / 资源照旧能写**；token 绑定仍在 item metadata 上，
后台也读得到这份本机副本（同源 iframe 共用 localStorage），所以右键菜单 / 选中即弹不会失效。
读卡片时「**谁更新用谁**」（比较 `updatedAt`），面板工具栏明写 **「角色卡：本机 / 全桌」**。
④ **清理入口**：设置窗口「数据与权限」新增 **「清理房间数据」** 一栏 —— 显示 `当前用量 / 14 KB`、角色卡张数、
骰子历史条数、先攻条目数，两个按钮 **清理骰子历史** / **清空角色卡**（各自二次确认，5 秒自动取消）；
读写全部走 `common.js` 的 `getRoomUsage / clearRoomRolls / clearRoomCards`，**设置页本身仍然不直接写房间数据
或 token 元数据**（v1.3.2 的白名单断言保留）。
自测：新增 `dev/test-cards.mjs`（由 `dev/check.mjs` spawn，selftest 仍是 5 条命令），断言
「单卡 ≤ 2 KB」「导入大卡后房间数据仍 ≤ 14 KB」「超限时不写 + ERROR」「降级本机且读得回来」
「OBR 拒写也降级 + ERROR」「设置里有清理按钮且清理真的腾出空间」；
`node dev/selftest.mjs` 5/5 绿。保留 v1.7.13 / v1.7.14 的点击与透明改动（未回滚）；manifest 仍无 action。

