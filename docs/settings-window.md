# v1.3.2：把工具栏入口补齐成「一排」+ 设置 / 关于窗口

> 一句话：v1.3.1 已经做到「一个功能一个独立窗口」；v1.3.2 补上**入口**（工具栏从 3 个图标变成 5 个：
> **速览 / 角色卡 / 先攻 / 骰子 / 设置**）和**一个设置 / 关于窗口**（左侧分栏 + 右侧内容）。
> 没有引入任何构建步骤，也没有改已有的数据键名。

## 1. 为什么要补入口（参考 FullPeople 的「一排按钮」）

v1.3.1 的四个窗口各有各的 popover id、可以同时打开，但工具栏上只有三个图标（角色卡 / 先攻 / 骰子）：

- **速览只能靠「选中 token 自动弹」**：玩家手动关掉它之后，再选中同一枚 token 不会重新弹出
  （后台仍以为它开着），除了右键 / 换选中以外没有办法把它叫回来；
- **没有地方放「设置 / 关于」**：版本、数据存在哪、怎么重置本机位置这些信息没有落点，
  只能去翻 README。

参考实现 FullPeople/obr-suite 的入口是**一排小按钮**（时停 / 同步视口 / 音乐 / 转场 / … / 设置），
每个按钮开自己的窗口；设置窗口是**左侧分栏 + 右侧内容**。v1.3.2 就照这个把入口和设置补齐。

| 块 | 入口 | 页面 | popover id |
| --- | --- | --- | --- |
| **速览** | 选中绑定的 token 自动弹；**工具栏「速览」（v1.3.2）** | `info.html` | `com.4enext-owlbear/info` |
| **角色卡 / 导入** | 左上角扩展图标、工具栏「角色卡」、右下角 4E 浮动按钮 | `panel.html` | `com.4enext-owlbear/panel` |
| **先攻** | 工具栏「先攻」（右键「加入先攻」只写数据） | `initiative.html` | `com.4enext-owlbear/initiative-window` |
| **骰子**（占位） | 工具栏「骰子」 | `dice.html` | `com.4enext-owlbear/dice-window` |
| **设置 / 关于**（v1.3.2） | 工具栏「设置」 | `settings.html` | `com.4enext-owlbear/settings-window` |

五个 id 互不相同 → 可以同时打开、互不嵌套。

## 2. 速览的工具栏入口（复用 /info，不进 WINS）

速览是个特殊块：它是 v1.2.2 的**可拖动小窗**，位置**按 token** 记在 `localStorage["4enext/info-pos"]`，
状态在后台是 `infoOpen / infoItemId / infoCardId / infoGeom` 这一套（第 6 节）。

所以工具栏「速览」**不**注册进 `WINS`（那是按窗口名记位置的另一套），而是复用它：

```js
async function openGlance(where) {
  var bind = await selectedBinding();      // 当前选中的唯一 token + 它绑定的卡
  if (!bind) { notify("速览：…先选中一枚已绑定角色卡的 token…", "WARNING"); return false; }
  await openInfo(bind.itemId, bind.cardId); // 与「选中即弹」同一个 popover、同一个 url
  return true;
}
```

- `selectedBinding()` 是从 v1.2.2 的 `refreshInfo()` 里抽出来的**同一份判定**
  （单选 + 有 `com.4enext-owlbear/cardId` + 卡还在房间里），两边不会对「算不算绑定」有分歧；
- 点一下就**一定有反馈**：没选中 / 没绑定 → WARNING 通知说明该先做什么；
- 因为是在**同一个 popover id、同一个 url** 上重新 `open`，Owlbear 只更新位置、不重载 iframe，
  所以「手动关掉之后再点速览」也会把它开回来（顺带补上了 v1.3.1 那个「关了就叫不回来」的小坑）。

## 3. 设置 / 关于窗口（settings.html + assets/settings-page.js）

外壳复用 `assets/window.js` 的 `createWindow({ name: "settings" })`，所以和先攻 / 骰子完全一致：

- 标题栏按住可拖（页面只发「起点 + 累计位移」，后台在同一个 id 上重开）；
- 位置按窗口名记在 `localStorage["4enext/win-pos"]`，**⌖** 清掉并回默认点；
- 打开前由后台按 `OBR.viewport` 夹紧（宽 ≤ 视口宽 − 2×16，高 ≤ 视口高 − 2×16）；
- 顶部有「后台已连接 / 后台未连接，点这里重试」状态条。

**布局**（纯 CSS Grid，没有框架）：`.set-body` 两栏，左 `.set-nav`（178px，可滚动），右 `.set-main`（内容区，可滚动）；
窄屏（≤ 760px）自动变成上下列，分栏横向滚动。

**六栏内容**（全部静态，中文，不做多语言）：

| 分栏 | 写的是什么 |
| --- | --- |
| 关于 | 插件名、版本、构建时间、作者、一句话说明、这一版的入口一览 |
| 使用说明 | 导出 → 导入 → 绑定 → 看速览 → 打起来 → 先攻；窗口怎么拖 / ⌖ / 夹紧；入口一览表 |
| 数据与权限 | 房间数据键 / token 元数据键 / 本机 localStorage 键，以及 GM 与玩家的权限差异 |
| 已知限制 | 未真机验证、数值离线推导、血量是快照、房间数据上限、右键仅单个 IMAGE、先攻是简单列表、窗口不跟地图… |
| 重置本机设置 | 清什么 / 不清什么 + 二次确认按钮 |
| 致谢 | obr-suite / character-cards / 4E NEXT / Owlbear SDK（不写捐赠、不写联系方式） |

**版本号只有一个来源**：`assets/settings-page.js` 从 `assets/common.js` 的 `PLUGIN_VERSION` 取，
HTML 里不写死版本（`dev/check.mjs` 会断言 `settings-page.js` 里**没有** `1.x.y` 这样的字面量）。
构建时间是一个 `BUILD_DATE` 常量，改后台脚本重新生成 bundle 时一起改。

## 4. 「重置本机设置」清什么（这次唯一会删数据的地方）

原则：**只清这台电脑上的插件记忆**。白名单写在 `assets/settings-page.js` 顶部：

```js
const RESET_KEYS = ["4enext/win-pos", "4enext/info-pos"];
const RESET_PREFIX = "4enext/state/";   // 追踪降级数据（track.js 在房间数据写不进去时的本机副本）
```

| 清 | 不清 |
| --- | --- |
| `4enext/win-pos`：各独立窗口记住的位置 | 房间数据 `com.4enext-owlbear/cards` / `/state/*` / `/initiative` |
| `4enext/info-pos`：速览小窗按 token 记的位置 | token 元数据 `…/cardId` / `…/hp` / `…/init` |
| `4enext/state/<cardId>`：追踪降级数据 | 4E NEXT 导出的 `.json` 文件 |

守住这条线的办法（都是可自测的硬约束）：

1. `settings-page.js` 里**没有** `setMetadata` / `updateItems` / `localStorage.setItem`（只 `removeItem`）；
2. **没有** `localStorage.clear()`（那会连带清掉别人的 / 别的插件的键）；
3. `settings-page.js` 里出现的 `"4enext/…"` 字面量**只有**上面三个（自测会把它们抠出来比对白名单）；
4. `dev/check.mjs` 对这四条逐条断言 —— 以后谁想「顺手多清一点」会直接 FAIL。

**二次确认**：第一次点击只是「预备」（按钮变成「再点一次确认重置」，5 秒内不点第二次就自动取消并提示），
第二次点击才真的删。删完在按钮下方列出清掉的键数与键名，并把「本机现在有什么」重扫一遍。

## 5. 入口注册（`registerTools()` 现在注册五个）

```js
await registerOneTool({ id: TOOL_GLANCE_ID,   icons: [{ icon: TOOL_GLANCE_ICON_URL,   label: "…：速览（当前选中的 token）" }], onClick: … });
await registerOneTool({ id: TOOL_ID,          icons: [{ icon: TOOL_ICON_URL,          label: "…：角色卡 / 导入面板" }],        onClick: … });
await registerOneTool({ id: TOOL_INIT_ID,     icons: [{ icon: TOOL_INIT_ICON_URL,     label: "…：先攻窗口" }],                onClick: … });
await registerOneTool({ id: TOOL_DICE_ID,     icons: [{ icon: TOOL_DICE_ICON_URL,     label: "…：骰子窗口" }],                onClick: … });
await registerOneTool({ id: TOOL_SETTINGS_ID, icons: [{ icon: TOOL_SETTINGS_ICON_URL, label: "…：设置 / 关于" }],              onClick: … });
```

- 旧的三个 id 一个都没改（老用户看到的图标位置不会跳），新 id 是 `/glance-tool` 与 `/settings-tool`；
- `onClick` 一律返回 `false`（只执行回调，不把工具切成激活态）；
- 图标仍是同一套 24×24 细线圆角风格，靠文件里的小徽标区分：
  `icon-tool.svg`（列表）/ `icon-tool-initiative.svg`（有序列表 + 箭头）/ `icon-tool-dice.svg`（骰点）/
  **`icon-tool-glance.svg`（眼睛）** / **`icon-tool-settings.svg`（两根滑杆）**。

## 6. 自测（v1.3.2 新增的断言）

`node dev/selftest.mjs` 仍然是一条命令跑完四条，全绿才算过。新增部分：

- `dev/check.mjs`
  - 速览 / 设置两个工具栏入口都注册了、两个图标文件都在、`background.core.js` 里确实 `pageUrl` 了它们；
  - 工具栏**五个**入口一个不少（旧的三个没被弄丢）；
  - `ID_SETTINGS_WIN` 两端（core / common）一致，五个窗口 id 互不相同；
  - `WINS` 注册了 `settings`（id + `URL_SETTINGS → settings.html` + 尺寸），「设置」入口走 `openWin`；
  - 速览入口复用 `/info`（`openGlance → openInfo`），没选中 / 没绑定时有 WARNING 提示；
  - `settings.html` 存在、标题含 `4eNEXT to owlbear`、有窗口外壳与离线重试按钮、六栏分栏齐全、`#set-version` 等在位；
  - `settings-page.js` 用 `createWindow` + `PLUGIN_VERSION`，且**没有写死版本号**；
  - 「重置本机设置」的四条硬约束（见第 4 节）与二次确认；
  - 版本号 `1.3.2`（绝对 / 相对 manifest、`common.js`、`background.core.js`、`background.html` 的 `?v=`）。
- `dev/test-background.mjs`（假 OBR 冒烟）
  - 五个工具栏入口都注册、图标是各自的绝对地址；
  - 点「设置」→ 打开 `settings.html`、尺寸 ≤ 视口 − 2×margin、被夹进视口内；
  - 点「速览」→ 对当前选中且已绑定的 token 重新开 `/info`（url 带 item / card）。
- `dev/test-initiative.mjs`：manifest 版本跟着到 1.3.2。

## 7. 已知限制（诚实清单）

- **没有真机验证**：开发环境起不了 Owlbear 房间；「拖窗口会不会重载 iframe」「设置窗口在 860×620 下排版是否刚好」
  这类只在纸面上推过。真机排版不对，改 `assets/ui.css` 里 `.set-*` 的几条即可。
- **速览入口依赖「选中的是单个已绑定的 token」**：多选或没绑定都会提示先选一个，这是刻意行为（不猜）。
- **重置不会动已经开着的窗口**：后台内存里还留着当前几何，下一次打开才回默认点。
  （不主动去关窗口是为了不打断正在用的人。）
- **构建时间是常量**：不是真正的文件时间戳（静态托管上取不到可靠的本机构建时间）。
