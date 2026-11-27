# 变更记录（4eNEXT to owlbear）

> 这份文件是历史更新记录。安装与使用请看 [README](README.md)。

**v2.4.22：右键速览同 token 复用**（2026-11-27）—— 完整速览已打开且 token/模式一致时不再关闭重开，省一次 iframe 加载。

**v2.4.21：速览双模式排查修复**（2026-11-27）—— ①紧凑/完整两套宽度（400 / 660），右键完整速览不再被挤进 400；②窗口复用必须同模式，点 token 与右键速览不再互相串模式；③自动收高度后把高度同步回后台（CH_INFO_SIZE），拖动/重开不再弹回 700 空窗。

**v2.4.20：血怒/回复值/行动点/里程碑 两端对齐**（2026-11-27）—— 该排间距拉开到与四防同宽（378px），不再靠左挤在一起。

**v2.4.19：速览窗再收窄 + 四防/攻击撑满**（2026-11-27）—— 窗口宽 400；四防行两端对齐撑满整行；攻击每行名称/命中/伤害两端对齐；去掉「攻击与伤害」标题与底部「资源/血量」文字。

**v2.4.18：攻击行按用户定稿重排**（2026-11-27）—— 每行「名称 / 命中 数值 + 小号临时加值 / 伤害 数值 + 小号临时加值」，去掉单独表头；整卡内容高 344px。

**v2.4.17：行动点/里程碑小号加减**（2026-11-27）—— 改成和四防临时加值同款 14×16 小控件，整行高度降到 16px。

**v2.4.16：攻击表头对齐**（2026-11-27）—— 临时命中 / 临时伤害并进「命中 / 伤害」表头同一行，列宽与数据行一致；速览内容总高 374px。

**v2.4.15：速览窗高度真正按内容收 + 四防单行**（2026-11-27）—— 之前量的是 `.pop-body.scrollHeight`（flex 高度=窗口高度）所以 setHeight 永远等于没缩；改为量真实内容 `.gl4` 高度。四防/顶部属性改成单行「AC 21 强韧 18 反射 22 意志 15」，临时 ± 保留并缩小，不再折行。

**v2.4.14：修「扩展升级了但代码没换」的缓存问题**（2026-11-27）—— OBR 扩展列表版本更新后，background.html / bundle 仍可能命中浏览器 HTTP 缓存；现在 manifest 的 background_url / icon 带 `?v=<version>`，每次发版强制加载新后台与新页面。

**v2.4.13：血条窗去掉缩放/固定高度**（2026-11-27）—— 血条编辑窗是固定高度表单，拉高只会露出黑色空底：不再装右下角缩放手柄、后台忽略历史被拉高的尺寸、resize 事件也强制回 126px；窗口宽度仍可 400–560。

**v2.4.12：临时生命写入修复 + 对齐/空窗**（2026-11-27）—— 紧凑速览的临时生命输入不在 hp-pad 导致读值恒 0，改为直接读输入框并加单测；血怒/回复值/行动点/里程碑 水平对齐；完整速览也按内容收高度；去掉底部推导说明；速览 ack 兜底最多重开 2 次，避免加载失败时无限开关卡死宿主。

**v2.4.11：速览双模式 + 先攻预设同步**（2026-11-27）—— 点 token 自动弹紧凑速览（属性平铺、四防平铺、临时生命并入 HP 行、保留四防/攻击临时加值与受伤/治疗；去掉快捷 ±1/±5/±10、六维、短休长休）；右键「速览」/工具栏仍打开完整旧界面；角色卡去浅色卡片底、单层底；血条窗先攻预设改边打边存并同步先攻条。

**v2.4.10：角色卡紧凑重排 + 血条窗先攻预设**（2026-11-27）—— 速览窗 460 宽：顶部属性平铺、四防平铺、临时生命并入生命行、去掉 −1/−5/−10/＋1/＋5/＋10、六维、短休/长休与临时命中/伤害控件，单层底；血条窗先攻改为 token 上的备团预设（移出先攻不丢，加入先攻时自动使用），不再自动加入先攻。

**v2.4.9：照 Full Suite 修一版（速览窗 / 骰子动画 / 血条先攻 / 玩家先攻）**（2026-11-27）—— 速览窗宽 660→460、紧凑模式只留生命/四防/六维/攻击伤害并自动收紧高度；骰子动画改为每次直接开唯一 modal（不再排队/计数，修高频投掷丢动画）；血条编辑窗临时生命左移、右侧新增先攻输入（自动加入先攻并写先攻条）；准备阶段玩家可掷自己的先攻；血条窗改单层底。

**v2.4.8：骰子动画改用 PNG 素材**（2026-11-26）—— 骰子外观从自绘 SVG 换成用户提供的 512×512 透明 PNG（d4/d6/d8/d10/d12/d20/d100），出目改为白色文字居中显示；素材加载失败自动回退 SVG；暴击/大失败用素材外发光区分。

**v2.4.7：骰子面板全桌同步提示**（2026-11-20）——
「本次结果」标题下新增中文小字：「投掷会同步给房间内所有玩家（各自播放动画、同一点数）」，窄窗自动换行。

**v2.4.6：代码审计修复**（2026-11-20）——
骰子广播 800ms 限流 + 6KB/40 颗载荷上限 + 非法 payload 拒绝；传送仅 GM 或目标 token 创建者；
导入文本 8MB 上限（中文错误）；dice/panel/info/initiative 初始化 safeInit 隔离；隐藏页面跳过 viewport 轮询；
localStorage 写入统一 try/catch + 每会话一次 quota 提示；先攻写前比较 updatedAt，冲突重读并提示。

**v2.4.5：2.4.4 修复的缓存版本（本轮验收版）**（2026-11-19）——
完整版本链 2.4.4 → 2.4.5，强制拉取新 JS/CSS/HTML。含 2.4.4 全部内容：repeat 表达式顺序、普通/repeat 可读等式、
去掉裸公式行并压紧行距、窗口 resizable（骰子面板 / 记录窗等通用手柄 + 尺寸记忆）、工具栏骰子、自动打开骰子面板等。

**v2.4.4：表达式区「重复」按钮**（2026-11-19）——
骰子面板表达式行下新增「次数 [2] + 重复 + ×2/×3/×5」：空表达式 flash 提示；已有 `repeat(N,…)` 只替换 N，
否则包一层 `repeat(N, expr)`；N clamp 1–20；光标移到末尾并写日志 `[4enext][dice] repeat apply n=… expr=…`。
结果沿用 `rowStarts` 每次一行：面板本次结果与全屏动画均按行展示各自总和。

**v2.4.3：进入房间自动打开骰子面板**（2026-11-19）——
场景就绪后自动 `openWin("dice")`（与先攻条同源时机，延迟 900ms 与记录窗错开）；本次会话用户手动 ✕ 后
不再自动重开（换场景/重进房间会再开）；设置页「骰子动画」分组新增「进入房间自动打开骰子」开关（默认开，每客户端）。
日志：`进入房间自动打开骰子：已打开 / 跳过（用户关闭过/设置关）`。

**v2.4.2：2.4.1 修复的缓存版本**（2026-11-19）——
完整版本链 2.4.1 → 2.4.2，强制拉取新 `settings-page.js` / 骰子工具 / effect 页面。
含 2.4.1 阶段一：骰子改工具栏按钮（无 manifest action/launcher）、d6 点数面、自适应布局、
节奏 900+180n、后台 fx 队列（最多 2）、鼠标落点兜底、设置页动画速度；并修设置页 `diceSpeedBtn` 未声明导致窗口关不掉。

**v2.4.1：破骰子 launcher/effect 缓存（本地测试版）**（2026-11-19）——
完整版本链 2.4.0 → 2.4.1（manifest×2、action.popover、所有 HTML ?v=、PLUGIN_VERSION、bundle、README）。
骰子入口改由后台驱动：订阅 `CH_DICE_ROLL` 直接开全屏透明 effect modal，rollId 5s 去重、3200ms 兜底关闭、
`CH_DICE_CLEAR` 清场；骰子页不再本地开 effect。launcher 增加全阶段日志；`infoViewport` 读数为 0 时用上次视口/1280×720 兜底。

**v2.4.0：骰子动画接近 Full Suite（第一批：A 视觉 + B 多端同步）**（2026-11-19）——
新增 `assets/dice-fx.js` 自绘 SVG 骰子（d4/d6/d8/d10/d12/d20/d100，深色面 + 描边，尺寸按类型）；
`effect.html` 每颗骰子独立飞入/旋转/老虎机滚数、落点按世界坐标换算、crit/大失败闪光；
投掷端广播 `CH_DICE_ROLL`（payload 含 rollId/rollerId/anchor/dice/total/modifier/crit/botch/skin/ts），
其它客户端按 rollId 去重后各自打开动画；`CH_DICE_CLEAR` 清场只关对应动画。
C 皮肤/音效、D 记录重播为第二批。

**v2.3.14：骰子 launcher 缓存修复 / 一键打开**（2026-11-19）——
`dice-entry.html` 的 `?v=` 随版本升到 2.3.14，破掉旧 launcher 缓存；launcher onReady 后延时 120ms
自动广播 `CH_OPEN_DICE`，再调 `OBR.action.close()` 关闭 action 弹层，300/800ms 兜底重试；
若 `action.close` 不可用/抛错则显示「打开骰子」按钮兜底（默认隐藏）。后台仍 `openWin("dice")` 开独立可拖动窗口。

**v2.3.13：补种族/职业固定防御加值（人类三防 +1、混职游荡者反射 +1 等）**（2026-11-19）——
`dev/gen-rules.mjs` 从数据原文解析「防御奖励 / 防御加值：+N 强韧/反射/意志」：人类三防各 +1；
混职游荡者反射 +1；混职督军「+1强韧或意志」属选择型，角色 JSON 无明确选择时默认不加。
`data/rules.js` 同步人类 1/1/1、混职游荡者 0/1/0、混职督军 0/0/0。
两份脱敏 fixture 回归：不死人 AC16/强韧19/反射13/意志12；费兹 AC21/强韧18/反射22/意志15。
**同版本 UI**：速览窗点地图 / 取消选中 / 选中非绑卡或多数时**保持不关闭**，切绑卡 token 只切 target；
血条编辑窗新增「隐藏」勾选（GM-only，立即写 `hp.hide`，玩家端不画该 token 血条）。

**v2.3.12：补野蛮人蛮族机敏（AC/反射 +1/+2/+3）**（2026-11-19）——
`glance.js` 增加职业防御特性表：野蛮人（非狂战士）未穿重甲时 AC/反射 +1（11 级 +2、21 级 +3）；
狂战士不享有；混职野蛮人只有 `classFeatureChoices` 明确选了「载甲机敏 / Barbarian Agility」才给，
取不到天赋选择就不加。重甲按护甲槽 `重甲` 判断。用用户 3 级野蛮人卡回归：AC 16 / 反射 13 / 强韧 19 / 意志 12。

**v2.3.11：房间数据 16KB 治理 + 血条锁/隐藏策略**（2026-11-19）——
房间写入按**整包** `TextEncoder` 字节计算（阈值 15500）：能写房间就写房间，否则/遇 quota 错误改写**场景 metadata**，
场景也失败才落本机 + 通知；先攻/角色卡/骰子记录读取按 `updatedAt` 取 scene/room 较新者。先攻以房间 entries 为唯一真源，
写失败不再给 token 打标记；`syncInitFlags` 按房间 entries 反查清理旧标记。体检日志 `room meta total=… ours=… other=… top=…`，
设置页显示总量/其它插件占用/前 5 排行。血条锁：非 GM 非创建者 `locked` 时数字掩码、比例 25% 量化（silhouette），
空闲不显示；新增 `hide`；token 不可见时不再绘制血条。

**v2.3.10：传送绕过 Dynamic Fog / Smoke 的穿墙校验**（2026-11-18）——
Dynamic Fog 等插件会在 token 位置更新时把「穿墙」的位置挡回；它们的墙不在原生 WALL 里，所以读不到。
传送写位置改为 `moveTokensWithFogBypass`：快照并临时剥离 token 上雾效类 metadata（key 含 smoke/spectre/
battle-system/dynamic-fog，或值含 attenuationRadius/visionRange/lightRadius/wallBlocks 等），隐藏 token 与其
attachment，写位置后按原值逐字恢复（token visible → attachment visible → metadata）；无雾效痕迹时只写位置，
不改任何 visible。日志 `portal bypass ext=… att=… hidTokens=…`，失败只 warn、不丢传送。

**v2.3.9：传送落点禁跨墙 + 尺寸兜底**（2026-11-18）——
`portalPlanTeleport` 对候选点增加「门中心→落点线段不得穿墙」检测（`portalPathSafe`），token 不会再落到墙另一侧；
候选按离门中心由近到远排序，单 token 优先落在门中心附近；`portalTokenRadius` 改为按 `width*scale` 实际渲染尺寸，
缺尺寸时用场景 DPI/2（1 格半径）兜底，并 clamp 到 [0.5 格, 5 格]；找不到落点时日志 `portal plan fail tokens=… radius=… walls=…`。

**v2.3.7：血条编辑窗移除底部诊断注脚**（2026-11-17）——
删除 `#hpe-diag` 元素与 `paintDiag` 渲染，界面不再显示 `role=GM editable=1 dis=0 inputs=7 v…`；
保存状态提示保留（「保存中…」「已保存 20/20」）。`[4enext][hpEdit]` 控制台/转发诊断日志全部保留。

**v2.3.6：修血条编辑窗输入被回填覆盖**（2026-11-17）——
`fillForm` 跳过当前 `document.activeElement` 的输入框，不再覆盖正在编辑的格子；新增 `state.dirty`：
输入后置 true、commit/失焦清空，`load()` 期间 dirty 则跳过 fillForm（防止异步 load 把刚输入的值覆盖）。
窗口状态行新增**可见诊断** `role=GM editable=1 dis=0 inputs=7 v2.3.6`；页面加载打印
`[4enext][hpEdit] loaded v=2.3.6 url=…`，便于确认 iframe 是否新页面/缓存。hpEdit 日志同时通过 `CH_HPEDIT_LOG` 广播到后台打印（后台控制台一定能看到）。
另修输入消失根因：只填当前生命或上限任一格时自动补齐另一格（20 → 20/20）；非法/半截提交不再 `fillOne` 清空用户输入，改为保留原值 + 警告；debounce 提交带上当前焦点元素；commit 日志追加 ok/message/patch。

**v2.3.5：血条编辑窗输入诊断日志**（2026-11-17）——
只加日志、不改行为：`focus` / `key` / `key(capture)` / `input` / `beforeinput` / `commit trigger` /
`fillForm value-cur=…` / `page ready, inputs=…`，全部前缀 `[4enext][hpEdit]`，用于定位「输入框有 focus 但键入无变化」。

**v2.3.4：修复血条编辑窗在部分 token 上被误判只读**（2026-11-17）——
`mayEditToken` 改为 **GM 优先**（GM 永不因 createdUserId 只读）；非 GM 时若 token 的 `createdUserId` 缺失/为空
（老 token、导入 token 常见）放宽为可编辑，只有明确不匹配才只读；`lockedForPlayer` 仍只对非 GM 生效。
`hp-edit-page.js` 增加 `[4enext][hpEdit] role=… pid=… item.createdUserId=… editable=… locked=…` 与
`applyDisabled dis=…` 诊断日志，便于真机排查输入框为何禁用。

**v2.3.3：角色卡面板文案精简**（2026-11-17）——
删除面板底部整段帮助说明（双写 / 只读 / 先攻骰子独立窗口）、未选中 token 空状态提示、标题栏卡片计数（N 张卡）、
标题右侧「导入 / 列表 / 预览」副标题与底部窗口提示；导入区 / 卡片列表 / 预览区 / 按钮全部保留，未选中时隐藏空状态容器。
骰子记录窗口的空状态长文案（「这台机器还没有骰子记录…」）一并删除，空列表留白。

**v2.3.2：设置窗精简**（2026-11-17）——
移除左侧「已知限制」板块（导航项 + 内容页 + 相关文案），删除标题区版本副标题（`v… · 独立窗口 · 可拖动`）
与底部拖动提示行；其余设置页（关于 / 使用说明 / 骰子 / 先攻 / 数据与权限 / 重置本机设置 / 致谢）保留。

**v2.3.1：传送门图标边缘羽化**（2026-11-17）——
`assets/portal.png` 按半径做外缘羽化、去掉方形底雾、中心保留半透明暗核；四角 alpha=0，地图上不再有方块边；
尺寸仍按 `scale = 2r/sceneDpi` 渲染 = 2×半径。test-portal 增加四角 alpha=0 断言。

**v2.3.0：工具栏精简 + 右下浮动按钮改为设置入口**（2026-11-17）——
- 工具栏移除「速览」「设置」两个工具，只保留 **角色卡 / 先攻 / 传送门** 三个（角色卡仍打开 panel；骰子仍走 manifest action）。
- 右下角浮动按钮从「4E 角色卡」改为 **齿轮 + 设置**：点击广播 `CH_OPEN_SETTINGS`，后台复用 `openWinOrNotify("settings")` 打开设置窗（可拖动 / 记位置 / 视口夹紧）。
- 速览仍保留：选中绑卡 token 自动弹；另补右键「速览」入口（单枚 IMAGE，GM/玩家都可）。
- 启动日志工具数 ×5 → ×3；check / test-background 同步。

**v2.2.1：传送门图标换成用户 PNG**（2026-11-17）——
传送门 item / 成对预览 / 隐形门 GM ghost 统一改用用户提供的 `assets/portal.png`（150×150 RGBA、透明背景、无硬白边）；
buildImage 参数改为 width=150、dpi=150、offset=75，`scale = 2r / sceneDpi` 公式不变，**渲染直径仍 = 2×半径**；
PORTAL_ICON_URL 带 `?v=PLUGIN_VERSION` 防缓存。`assets/portal.svg` 保留给工具图标。

**v2.2.0：传送门进阶（隐形门 / 成对创建；传送动画已移除）**（2026-11-17）——
- **隐形门**：`visible=false` 的真门所有人都看不到；GM 端用 `scene.local` 生成半透明 ghost（opacity 0.45，标记「隐藏门」）跟随位置/半径/删除重建；
  进门检测只认可见门，但隐形门**仍出现在目的地列表**，可传送进去；编辑窗取消「玩家可见」即隐形。
- **成对创建**：传送门工具下第二个 mode（点两处）：第一处显示默认半径 70 的预览 + 连线，第二处创建两个同随机 tag（如 `P-3F9A`）的
  「传送门 A / 传送门 B」；ESC/取消清理预览。
- 传送动画已整体移除（不播任何全屏效果）；`dev/test-portal.mjs` 覆盖隐形门过滤/GM ghost/pair 创建，并断言动画相关页面/函数/频道不再存在；
  `check.mjs` 同步静态锁。

**v2.1.0：传送门（核心）**（2026-11-17）——
GM 用新工具**拖动画圆**建门（起点=门心、拖动距离=半径，实时预览，松手半径 ≥16 才创建）；门 item 用自绘 `assets/portal.svg`，
`ATTACHMENT` + `locked` + `disableHit`，metadata `com.4enext-owlbear/portal = { name, tag, radius, showName, visible, locked }`。
**同 tag 互联**：玩家拖动自己 token 进入可见门 → 弹目的地选择（同 tag 其它门）；选中后对当前选中 token（含拖动的那枚、多选一起）
执行传送，落点按**六边形螺旋**排布（间距 = 最大 token 直径 + 8），并读取原生 `WALL`（含 position/rotation/scale 变换）做**墙避让**
（距离 ≥ token 半径 + 8，搜索不到安全点则提示）；传送后 **700ms 抑制**重复触发。GM 可右键「编辑传送门」改名称/标签/半径/显示名字/
玩家可见/锁定（保存经广播回后台写 item）。隐形门仅保存字段（单向传送留 v2.2.0）。本版不做迷雾 / 动画 / 成对创建。

**v2.0.2：修缩放/改窗口大小后的位置漂移**（2026-11-16）——
**移植 Full Suite viewportAnchor**：OBR SDK 没有 `viewport.onChange`，改为后台 **500ms 轮询** `getWidth/getHeight`（只在有监听者时跑，
首读记 baseline，失败退避 2s），变化时用同 id+url 重新 `popover.open` 把右下角浮动按钮锚回新右下角，并对所有窗口 / 先攻条用新视口 `reclamp`；
另监听 `window.resize` / `visualViewport.resize` 做即时触发（拿不到忽略）。
**拖动改「start 时最新视口 + 本轮 base/size」模型**：`beginWinDrag` 在 pointer start 重新 `infoViewport()` 并 clamp 当前位置，
move/end 用 start 抓的 `vp/size`（不再用打开窗口时的 `st.geom.vp` 快照）→ 视口变大后记录窗口 / 各窗口可正常向下拖到新下限。

**v2.0.1：适配 4E NEXT 新版导出**（2026-11-16）——
支持 `combatMods.damages[].dieUp`（武器伤害骰提升）：按 `1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 2d8 → 2d10 → 2d12`
（缺省 / 0 = 不变，负值反向降级，超出范围取端点；原始 2d6/2d8 也按阶梯继续升）提升武器伤害骰；旧导出（无 dieUp）输出逐项不变。
`glance.js` 新增内部 `upgradeDamageDie(dice, steps)`，damages 派生处使用；test-glance2 覆盖合成 dieUp 序列 / 旧 fixture 零变化，
test-import 覆盖真实新版导出可导入且第一项伤害骰 = 1d6。

**v2.0.0：攒批汇总发布（1.10.7～1.10.12 合并为一个大版本）**（2026-11-16）——
- **用户矢量图标**：血条编辑窗钉住 / 锁定、速览「共享数据」改用 `assets/icons/pin|lock|unlock.svg` 内联（currentColor，按状态切换 lock/unlock）。
- **先攻条卡片底部加高**：`.item-count` 24% → 34%、头像 72%、血条 bottom 34%（合计下方 `(骰+加值)` 公式不再被裁；有意偏离 Full Suite 原比例）。
- **地图血条改用户样板布局**：去掉环形，改为「底部 64% 宽圆角比例横条 + 左侧竖排三圆（强/反/意）+ 右下 AC 盾」，数字放图形内；玩家端只显示比例、不显示数字与四防。
- **先攻条点卡片偶发弹速览竞态**：先 `await CH_GLANCE_SUPPRESS` 送达再 `player.select`。
- **四防临时值联动 token**：速览 ± 把 `hp.defenses = 卡片基础 + defTemp` 写回绑定 token（地图圆/盾联动），短/长休清空并还原；**修 `syncTokenStats` 用基础值回写导致「变一下又变回去」**（`combineDefenses` 共用、info 传 `defTemp`）。
- **骰子 4E 预设联动临时命中/伤害**：读取 `track` 的 `atkTemp/dmgTemp`，攻击/伤害 total 相加并标注「（临时 +2）」；订阅房间/token 变化 200ms 防抖刷新；**修 `loadState` 少剥一层（`.state`）导致联动恒为 0**。
- **骰子 action 防缓存 + 诊断日志**：manifest `action.popover` 带 `?v=2.0.0`；控制台输出页面就绪 / 按钮 click / doRoll 分步日志（parse → payload → rendered → broadcast → history → anim → done）与 catch stack。
- 此前 1.10.x 的其它内容（1.10.0 血条编辑窗药丸布局/临时生命/锁定/钉住/重绘、1.10.1 输入可发现性、1.10.2 单窗常驻与焦点修复）一并包含；详见下方各 1.10.x 条目。

**v1.10.12：修骰子 4E 预设读状态少剥一层**（2026-11-16）——
`track.loadState(cardId)` 返回 `{ state, scope }`，但 `dice-page.refreshPresets` 之前直接读返回值（`st.atkTemp`），
导致临时命中/伤害恒为 0、4E 预设永远不带联动。修复：`dice-4e.js` 导出 `tempsFromLoaded(loaded)`（只从 `loaded.state`
读 `atkTemp/dmgTemp`，缺省 0），dice-page 改用它；test-dice 增集成断言 + 错误形状 = 0，check 加静态锁。

**v1.10.11：骰子投掷分步诊断日志（定位点击后无反应）**（2026-11-16）——
`doRoll()` 只加日志、不改行为：`step parse ok` / `busy-return` / `busy-set` / `payload` / `rendered`（含结果区子节点数 / 隐藏状态）/
`flash` / `broadcast sent=` / `history` / `anim-start|skip|done` / `catch` / `finally step done`；
`catch` 改为 `console.error("[4enext][dice] doRoll failed", e.stack)`（之前只 feedback，控制台看不到堆栈）。
manifest×2 的 action.popover 同步 `?v=1.10.11`。

**v1.10.10：骰子 action 页面防旧缓存 + 点击诊断**（2026-11-16）——
manifest×2 的 `action.popover` 改为带版本参数（`dice.html?v=<当前版本>`），以后每次升版本必须同步改（README 版本升级清单已写）；
骰子页启动在控制台打 `[4enext][dice] 页面就绪 v=… action=…`，投掷按钮 click 与 `doRoll` 入口各打一条诊断（便于区分「没触发」还是「触发后失败」）；
action 模式正文 / 滚动容器补 `pointer-events:auto`，旧标题栏隐藏后点击不被覆盖。

**v1.10.9：修四防临时值联动被 syncTokenStats 回写基础值**（2026-11-16）——
真机现象：速览加四防临时值后，地图圆/盾数字「变一下又变回去」。根因：`track.syncTokenStats` 每次速览刷新用
**卡片基础四防**比较 token，发现 token 是 base+temp 就写回 base。修复：`common.js` 抽出 `combineDefenses(base, defTemp)`
（ref→reflex、round/clamp、卡片缺项保留 token 原值），`syncDefTempToTokens` 与 `syncTokenStats` 共用；
`info.js` 先 `loadState` 再把 `defTemp` 传给 `syncTokenStats`。短期清零 / 短长休后 defTemp=0，仍会写回基础值。

**v1.10.7：速览四防临时加值单向联动 token（地图圆/盾）+ 短/长休还原**（2026-11-16）——
只在速览里点「四防临时加值」的 ±；成功后 `common.syncDefTempToTokens(cardId, defTemp)` 把绑定该卡的 token
`hp.defenses` 写成「卡片基础四防 + defTemp」（只覆盖卡片有值的项，保留 cur/max/temp/locked/surges，同值不写，
无权限 token 跳过，写失败静默）。四防临时值清零 / 短休 / 长休后同样写回卡片基础值，地图左侧三圆与 AC 盾还原；
地图端只是显示，不可点。手动在血条编辑窗改的四防会被下一次临时加值联动覆盖（绑卡本来就会覆盖四防，已知取舍）。

**v1.10.8：骰子 4E 预设联动速览临时命中 / 临时伤害**（2026-11-16）——
速览里点「临时命中 / 临时伤害」的 ± 后，骰子窗的 4E 预设会读 `track.js` 的 `atkTemp` / `dmgTemp` 并即时刷新：
攻击组 `1d20 + total+atkTemp`、伤害组 `武器骰 + total+dmgTemp`（先加到 total 再 `withModifier`，表达式格式不变）；
临时值非 0 时标签追加「（临时 +2）」/「（临时 -3）」，为 0 时输出与旧版完全一致。骰子页订阅房间数据与 token 变化
（200ms 防抖），所以速览 ± 与短 / 长休后预设自动更新。

**v1.10.6：先攻条点卡片偶发弹速览（竞态修复）**（2026-11-16）——
根因：`initiative-page.js` 的 `onCardClick()` 里 `void OBR.broadcast.sendMessage(CH_GLANCE_SUPPRESS, …)` 后立刻
`await OBR.player.select(...)`，真机上偶尔 select 触发的后台 `refreshInfo` 比抑制消息先到 → 速览弹一次。
修复：**先 `await` 抑制广播送达，再 select**（广播失败也继续选中，不阻塞地图高亮）；后台 `suppressGlanceUntil`
早退兜底保持不变。数据 / 权限 / 广播频道均未动。

**v1.10.5：地图血条改为用户样板布局**（2026-11-16）——
**不再用环形**：底部居中**圆角比例横条**（宽 64% token 宽、高 10% 短边、底边距 4%、圆角 = 高/2；深红轨道 + 按 `cur/max`
左→右填充，≤50% 暗红 `#7f1416`、否则 `#b00000`），条内居中显示 `cur/max`（+temp 后缀）；**左侧竖排三圆**（上→下
强韧粉 / 反射黄 / 意志蓝，直径 16% 短边、左边距 6%、间距 4%）；**右下角 AC 盾**（宽 20% 短边、高 1.08 倍、深灰蓝底
+ 白描边）；数字都放在图形内自适应，玩家端只显示比例、不显示数字与四防。数据 / 广播 / 重绘频道 / 缓存路径均未动。

**v1.10.4：先攻条卡片底部加高（合计公式不再被裁）**（2026-11-16）——
卡片外框尺寸不变（56×80 / active 100），只重分内部比例：底部色带 `.item-count` 24% → **34%**、头像 `.item-img` 80% → **72%**、
血条 `.item-hp-track` bottom 24% → **34%**（贴在加高后的色带上沿）；合计 13px + `(骰+加值)` 公式 8px 现在放得下。
**这是有意偏离 Full Suite 原比例**（原 24% 只有约 19px，装不下两行），卡片与卡片下 d20 的位置/尺寸都不变。

**v1.10.3：用户矢量图标接入**（2026-11-16）——
血条编辑窗与速览的钉住 / 锁定 / 共享图标改用用户提供的矢量图标（`assets/icons/pin|lock|unlock.svg` 内联，
`fill="currentColor"` 跟随主题）：编辑窗钉住 📌、锁定 🔒/🔓 改为内联 SVG（锁定状态用 `hidden` 切 lock / unlock，重绘 ↻ 仍保留字符）；
速览「共享数据」按钮的锁 / 解锁 emoji 换成统一常量 `SHARE_ICON_LOCK` / `SHARE_ICON_UNLOCK`，文字「共享数据」保留。
只换图标，不改逻辑与窗口尺寸。

**v1.10.2：血条编辑窗单窗常驻**（2026-11-16）——
照速览窗（v1.8.9）同款：切换 token 时**不再关闭重开 iframe**，改为广播 `CH_HP_EDIT_TARGET` 换目标（pending 期输入禁用），
页面先 commit 未保存输入 → load → 回新频道 `CH_HP_EDIT_ACK`；600ms 没收到 ack 才兜底关闭重开一次（极端情况内容也能换过去）。
未钉住时跟随选中：新 token 有血条数据 → 同一窗口换 target（不闪）；无数据 / 取消选中 → 关窗。
**钉住时保持当前 token**：选中别的 token 不关窗、也不换 target（要换请取消钉住或重新右键打开）。
修复：血条编辑窗焦点被最后一个输入框（意志）抢占（`var` 闭包），导致临时生命 / 强韧 / 反射「改不动」、输入全写进意志。

**v1.10.1：血条编辑窗输入可发现性优化**（2026-11-16）——
只动样式 / 焦点，**无数据与权限变化**：生命药丸的当前 / 上限输入加 1px 边框 + 浅色底 + 6px 圆角（hover 提亮、focus 绿框更明显），
`cur/max` 加宽到 40/46；临时生命药丸 86 → 104px、输入加边框底色、空值显示「—」；
四防输入边框更明显、hover 提亮；生命 / 临时药丸与四防 label 可点击直接聚焦输入（原生 `<label for>`，不影响聚焦全选与自动保存）；
可编辑态药丸 / 四防整体 `cursor:text` + 轻微提亮，只读 / saving 时保持灰色不可点。窗口尺寸仍 **344×106**。

**v1.10.0：血条编辑窗照 Full Suite 重做（第一批：布局 + 字段）+ 骰子 action 收尾**（2026-11-16）——
① **血条编辑窗重做**（344×106）：药丸布局、生命按 `cur/max` 比例填充（≤50% 暗红 `#7f1416`、否则红色系）、
名称行 + `⣿` 拖动柄、右侧 **钉住 📌 / 锁定 🔒 / 重绘 ↻**；第二行生命药丸（当前 / 上限）+ **临时生命**药丸；
第三行四防（AC / 强韧 / 反射 / 意志，留空 = 不画那枚盾）；第四行状态行。**去掉「回复力」字段**（`surges` 数据只读不写，保留在 token 上）；
**新增 `temp` 字段**（0~999 clamp）。交互：聚焦全选、失焦 / Enter 提交、非法输入回退、saving 时输入禁用、clamp；
锁定按钮切 `hp.locked`（GM 才能点，玩家禁用）；钉住写 `localStorage["4enext/hp-edit/pinned"]`（钉住后选中变化 / 取消选中不自动关窗）；
重绘广播新频道 `CH_HP_REPAINT` → 后台强制重算血条环 / 四防盾 / 资源徽记。
② **骰子窗 action 收尾**：`manifest.action.height` 620 → **660**；action 模式（`OBR.action.isOpen()` 为真）**隐藏页面自己的标题栏**，
内容区顶到边、关闭靠左上角 action 按钮；普通 popover 模式保持原样。

**v1.9.2：骰子历史改本机 + 记录窗口修复 + 骰子 action 入口 / 自动打开**（2026-11-16）——
① **骰子历史从房间数据搬到本机 + 广播**（照 Full Suite）：`localStorage 4enext/dice-history/<roomId>`（`{v:1,rows}`，
按 rollId 去重、上限 20、按房间隔离）；投掷 / 收到 CH_ROLL 时各端自己追加，实时共享仍靠广播（后进房间看不到旧历史）；
GM 首次启动把房间旧 `KEY_ROLLS` 迁移进本机并清空房间键（释放 16KB 预算）；设置里的「清理骰子历史」改清本机（GM 顺带清房间残留）。
② **记录窗口「点了没反应」修复**：页面直开后把几何 adopt 给后台；后台发现与骰子窗口重叠 >30% 就挪到旁边重开；
页面在成功打开 900ms 内又被点时先关闭并提示「再点一次会换位置打开」（避免重复点击叠窗）。
③ **骰子入口改为 manifest `action`**（房间左上角按钮，参照 Full Suite）：icon/popover 全绝对 URL、320×620；
右侧工具栏移除骰子图标；action 模式下 ✕ 用 `OBR.action.close()`、标题栏不绑定拖动。
④ **骰子记录窗口默认进入房间自动打开**（延迟约 800ms；设置里可关；本次会话 ✕ 过后不再自动开，与先攻条同一套口径）。

**v1.9.1：移除临时性能日志**（2026-11-16）——
v1.8.7–v1.9.0 为定位「速览打开慢 / 黑屏」加的性能计时与诊断日志全部删除（含性能日志中转频道与相关订阅），
**功能不变**：信息窗单窗挂载（target 广播换目标）、READY / ACK 握手、700ms 无 ack 兜底重开、后台预热队列全部保留。
自测里对应的日志断言改为「不应存在性能日志」的静态锁。

**v1.9.0：修「信息窗单窗挂载后切换 token 没反应」+ ACK 兜底**（2026-11-16）——
真机：选中另一枚绑卡 token 时后台走「复用 + 广播 target」（bg open=1ms），但 info 页面没有新一轮渲染 →
内容没换过去。修复：
① **页面刷新不再被 busy 吞掉**：`info.js` 的 `refresh()` busy 时记 `pendingRefresh`，本轮结束自动补跑一次；
target 触发会清掉普通 schedule 防抖并直接刷新（target 优先）；busy 时 target 也不会丢。
② 诊断日志（v1.9.1 已移除）。
③ **ACK 兜底**：新增 `CH_INFO_ACK`；页面每次刷新成功回 `{session,version,itemId}`；后台广播 target 后 700ms 内没收到同
session 且 version ≥ pending 的 ack，就关闭重开一次（只记 WARNING 日志、**不弹通知**）；ack 及时则什么都不做。

**v1.8.9：信息窗单次挂载 + 广播换目标（切换 token 不再重建 iframe/黑屏）**（2026-11-16）——
真机数据确认内容渲染只要 ~7ms，慢在「每次打开都新建 iframe 并重新下载/解析 ~430KB 脚本」+ 索引下载慢。本版照 Full Suite
`characterCards` 改成**单窗挂载**：`info` popover 只开一次，之后切换 token 只通过 `CH_INFO_TARGET` 广播（session +
version 递增租约）让页面换 `itemId/cardId` 后重渲染（**不 reload**）；页面 `onReady` 发 `CH_INFO_READY` 握手，后台重发当前 target
防丢首条；拖动 / pin 重锚仍会重开 popover，重开后同样补发 target。新增后台**串行预热**：启动 1.5s 后
`fetch(cache:"force-cache")` 依次预热 `info.html`、`ui.css`/`glance.css`、`info.js`/`common.js`/`window.js`/`glance.js`/`track.js`、
`vendor/obr-sdk.js`、`data/rules.js`、`data/card-index.js`（失败静默）。v1.8.8 的临时日志保留（v1.9.1 已移除）；
关闭 / 手动 ✕ / `infoAutoPopped` 行为不变。

**v1.8.8：性能日志改为后台中转 + 细分 info 阶段**（2026-11-16）——
v1.8.7 的用户只能看到后台日志；本版让 info iframe 的计时经后台中转打印，并细分阶段。该临时日志已在 **v1.9.1 移除**。

**v1.8.7：临时性能日志（速览打开耗时定位）**（2026-11-16）——
只加 `console.log`、无行为改动、不弹通知，用于真机定位「慢 / 黑屏」卡在哪一段；该日志已在 **v1.9.1 移除**。

**v1.8.6：速览首屏提速（不再等 1.25MB 索引）**（2026-11-16）——
真机反馈「速览弹窗打开后长时间停在『加载中…』」：根因是 `info.js` 先 `await loadCardIndex()`（旧索引 1.25MB）
再首帧渲染，GitHub Pages 冷缓存时首屏被下载 + 解析阻塞。修复：
① **首帧不阻塞**：`info.js` / `panel.js` 先立刻渲染内容（此时无动作标签），索引加载完再二次渲染补标签；
② **索引瘦身**：`data/card-index.js` 只保留威能「使用频率 + 动作类型」（组合表 + 下标的短键结构），
体积 1.25MB → **约 305KB**；去掉攻击 / 命中正文与专长频率（用户确认 tooltip 与专长区块都不要）；
③ **去掉专长区块与装备物品等级档位**（只保留槽位 / 名称 / 增强 +N）；
④ **后台预热**：`background.core.js` 在启动后延迟 2s 用 `fetch(..., {cache:"force-cache"})` 预热索引，
info iframe 首次 import 直接命中 HTTP 缓存（失败静默、不影响启动）。

**v1.8.5：速览弹窗不再「莫名其妙跳出来」**（2026-11-16）——
用户手动 ✕ 关掉某枚 token 的速览后，后台记住它（`infoAutoPopped`，与血条编辑窗的「只自动弹一次」对称）：
选中不变之前，场景 / 房间数据 / 选中事件的任何 onChange 都不再自动弹回；选中换到别的 token 再换回来会重新允许自动弹一次；
工具栏「速览」与右键手动入口不受影响（照常能打开）。
另：**血条编辑窗改为「即改即存」**（照 Full Suite 架构）：去掉保存按钮与底栏，输入（防抖 500ms）/ 失焦 / Enter
自动写 token，同值不写、非法输入不写；写成功后短暂提示「已保存：…」并广播后台重画；Esc / ✕ 关闭；窗口 340×122。

**v1.8.4：修「移除血条组件后选中仍自动弹编辑窗」**（2026-11-16）——
给 token「移除血条组件」只是把 `com.4enext-owlbear/hp-bar/enabled` 写成 `false`（hp 数据按设计保留），
但后台 `hasHpBarData()` 没看这个开关 → 移除后选中/点击 token 仍会弹出血条编辑窗（真机 bug）。
修复：`hasHpBarData()` 开头加 `if (!hpBarEnabled(item)) return false;` —— 显式移除后不再自动弹；
从没点过「移除」的老 token（开关未写、默认开）行为不变；右键「编辑血条」入口/行为不变。
另：**绑卡即用卡片数据覆盖 token 血量**（当前 / 上限 = 卡的满血，回复力 = 上限，四防 = 卡值；临时值 / locked 保留，
并删掉 `hp-bar/enabled` 让血条立即显示；与 Full Suite 一致）；**面板更新卡片后自动回推上限 / 四防 / 先攻，
保留当前 HP**（`propagateCardStats`，只 GM、同值不写）；**速览打开时也会补 HP 上限**
（`syncTokenStats` 在 token 没有 max 时用卡片上限播种 cur = max，老 token 第一次打开速览就长出血条）。

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

