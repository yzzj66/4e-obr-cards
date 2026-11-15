# v1.3.1：把「三 tab 合并」拆回各自独立窗口

> 一句话：**每个功能是一块独立的窗口**（FullPeople/obr-suite 那样的「分块」），
> 不再是一个大面板里的三个 tab。顺带修掉「面板超出屏幕」和「按钮点了没反应」。

## 1. 为什么要拆（用户的明确决定）

v1.3.0 把速览 / 先攻 / 骰子塞进同一个面板的三个 tab。实际用起来有三个问题：

1. **不符合使用习惯**：参考实现（FullPeople 的 obr-suite）从来不是一个面板装全部功能，
   而是「一个功能 = 一个 popover」，各自有入口、各自能拖、可以同时开着；
2. **一开全开**：只想要一个先攻条，却必须先打开包含角色卡列表的大面板，再把面板挪开；
3. **尺寸失控**：面板按 980×720 打开，在 1366×768 的笔记本上底部直接被切掉（用户截图）。

所以 v1.3.1 **撤掉 tab**，回到「分块」：

| 块 | 入口 | 页面 | popover id |
| --- | --- | --- | --- |
| **速览** | 选中绑定的 token 自动弹 | `info.html` | `com.4enext-owlbear/info` |
| **角色卡 / 导入** | 左上角扩展图标（manifest action）、工具栏「角色卡」图标、右下角 4E 浮动按钮 | `panel.html` | `com.4enext-owlbear/panel` |
| **先攻** | 工具栏「先攻」图标（另有右键「加入先攻 / 隐形加入先攻」写数据） | `initiative.html` | `com.4enext-owlbear/initiative-window` |
| **骰子**（占位） | 工具栏「骰子」图标 | `dice.html` | `com.4enext-owlbear/dice-window` |

四个 id 互不相同 → **可以同时打开、互不嵌套**。

> 文件名说明：先攻的数据模型 / 掷骰 / 回合推进 / HTML 渲染早在 v1.3.0 就独立成了
> `assets/initiative.js`（自测直接 import 它）。为了不覆盖这个模块，独立窗口的**页面脚本**
> 叫 `assets/initiative-page.js` / `assets/dice-page.js`；逻辑与页面分开，改名不影响语义。

## 2. 入口怎么注册（参考 obr-suite 的写法）

`assets/background.core.js` 的 `registerTools()` 一次性注册**三个** `OBR.tool.create`：

```js
await registerOneTool({ id: TOOL_ID,        icons: [{ icon: TOOL_ICON_URL,        label: "…：角色卡 / 导入面板" }], onClick: … });
await registerOneTool({ id: TOOL_INIT_ID,   icons: [{ icon: TOOL_INIT_ICON_URL,   label: "…：先攻窗口" }],          onClick: … });
await registerOneTool({ id: TOOL_DICE_ID,   icons: [{ icon: TOOL_DICE_ICON_URL,   label: "…：骰子窗口" }],          onClick: … });
```

- `onClick` 返回 `false`：只执行回调，不把工具切成激活态（与 v1.1.0 的那个按钮一致）；
- 每个工具 id 独立，注销 / 重注册只影响自己（后台重载时先 `remove` 再 `create`）；
- 图标沿用 `icon-tool.svg` 的 24×24 线性风格，靠文件里的小徽标区分：
  `icon-tool.svg`（列表）/ `icon-tool-initiative.svg`（有序列表 + 箭头）/ `icon-tool-dice.svg`（骰点）；
- 左上角的 `manifest.action` 只负责「角色卡 / 导入」这一块的弹窗（Owlbear 只给一个 action 位），
  另外两块靠工具栏 —— 这也是参考实现的做法：action 是门户，具体面板各有自己的入口。

## 3. 每个窗口各自记位置 + 可以拖（沿用 v1.2.2 的机制）

- 拖动：页面（`assets/window.js`）只发「起点 + 累计位移」到
  `com.4enext-owlbear/win-drag`，后台在**同一个 popover id** 上重新 `open`（只换 `anchorPosition`），
  所以窗口跟着走、iframe 不重载；
- 位移用 `screenX / screenY`（client 坐标会被窗口自身的位移抵消，拖起来会抖）——
  这条坑在 v1.2.2 已经踩过，见 `docs/popover-drag.md`；
- 位置落在 `localStorage["4enext/win-pos"] = { v:1, pos: { panel: {left,top}, initiative: …, dice: … } }`，
  **按窗口名各记一份**；速览弹窗仍旧按 token 记在 `4enext/info-pos`（键名没改，老数据照旧能读）；
- 每个窗口标题栏上的 **⌖** 清掉自己记住的位置并回到默认点（水平居中、略微偏上）。

## 4. 打开前用视口夹紧（修「面板超出屏幕」）

`openWin(name)` 的顺序是：取 `OBR.viewport.getWidth()/getHeight()` → 算尺寸 → 夹位置 → `OBR.popover.open`。

```js
var WIN_MARGIN = 16;                       // 离视口边缘至少 16px
width  = min(默认宽, 视口宽 - 2 × WIN_MARGIN)
height = min(默认高, 视口高 - 2 × WIN_MARGIN)
pos    = clampInfoPos(记住的位置或默认点, size, vp)   // 左上角夹进视口
```

- 页面这边不再做像素测量：`.win / .panel` 一律 `height: calc(100vh - 12px)` / `max-height: 100vh`
  （CSS clamp），**内部**用独立滚动容器：
  · `.win-body` —— 先攻列表 / 骰子内容；
  · `.panel-main` —— 角色卡预览；
  · `.card-list` —— 左侧卡片列表。
  头部 / 状态条 / 底部状态行固定不动，所以任何屏幕尺寸都能看全；
- 视口变小（合盖、转屏）时，`reclampWins()` 会把开着的窗口重新夹回视口内；
- `manifest.action` 的弹窗尺寸也调小了（960×660）—— 它由 Owlbear 自己定位，我们只能用更保守的尺寸。

## 5. 按钮必须有反馈；后台离线就置灰 + 重试（修「点了没反应」）

v1.3.0 的教训：后台脚本一挂，所有「发给后台」的按钮全部**静默失效**。v1.3.1 的做法：

1. **每个窗口顶部都有状态条**（`.bg-strip`）：
   - 正在确认 → 「正在确认后台脚本…」；
   - 通了 → 「后台已连接 v1.3.1 · 工具栏✓ · 右键菜单✓」；
   - 不通 → **「后台未连接，点这里重试」**（按钮，点了会重新 ping 三次）。
2. **交互元素按依赖等级置灰**：
   - `data-bg`（**硬依赖**后台，例如玩家的「结束我的回合」——请求要由城主客户端的后台落笔）：
     window.js 会真的设 `disabled`，并记住页面原本的 disabled 状态，恢复时原样还回去；
   - `data-bg-soft`（**软依赖**，例如导入 / 删除 / 绑定 / GM 推进回合 —— 这些其实只写房间数据与
     token 元数据，不靠后台）：默认只弱化外观（`body.bg-off [data-bg-soft] { opacity:.55 }`），仍然可点。
     刻意不一律禁用：后台挂了不代表这些操作不能用，禁掉反而更糟；
     **例外是角色卡面板**：它主动把自己的写操作按钮（绑定 / 删除 / 导入）也锁死
     （`paintGates()` 依 `win.state === "bad"` 设 `disabled`）—— 用户对这几个按钮「点了没反应」的印象最深，
     宁可先锁住、点重试通后再放开。
3. **统一反馈**：`assets/window.js` 的 `feedback(msg, tone)` 同时发
   `OBR.notification.show` 与窗口底部状态行（`#win-flash`），成功 / 失败 / 警告都有回音；
   所有按钮回调都走它，取消确认框也会提示「已取消：没有变化」（不再"点了像没点"）。

## 6. 自测覆盖（`node dev/selftest.mjs`）

- `dev/check.mjs`：无 tab 残留（panel.html / panel.js / ui.css 三处）、四个独立页面与各自脚本、
  四个互不相同的 popover id、WINS 注册表、三个工具栏入口 + 三个图标、action 指向 panel.html、
  `WIN_MARGIN` 与 `winSize` 的视口夹紧、`reclampWins`、CSS 滚动容器、`data-bg` 置灰与重试文案、
  标题「4eNEXT to owlbear」、窗口拖动频道 / 位置键两端一致、`4enext/info-pos` 没被改名；
- `dev/test-background.mjs`：假 OBR 跑一遍后台 —— 三个工具都注册了、点「先攻」按钮真的
  `popover.open` 出 `initiative.html`、尺寸 ≤ 视口 − 2×margin、拖动 → 夹取 → 落盘 → `⌖` 回默认；
- `dev/test-initiative.mjs`：先攻数据 / 权限分支不变，另断言窗口模式渲染与版本 1.3.1。

## 7. 已知限制

- `manifest.action` 打开的是 Owlbear 自己管的弹窗（同一个 panel.html），那里**拖不动**
  （拖动消息只对「我们自己开的 popover」生效，避免把另一个窗口挪走）；想拖请用工具栏图标打开。
- 「重开 popover 只移动、不重载 iframe」这一行为仍**没有真机验证**（与 v1.2.2 相同的假设）。
- 骰子窗口目前只有占位与本地预览的「掷 d20」，正式内容在 v1.5.0。
