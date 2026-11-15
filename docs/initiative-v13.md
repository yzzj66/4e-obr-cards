# 先攻（v1.3.0）

> 目标：绑定角色卡后，先攻加值自动取卡里的「先攻」；右键加入先攻；GM 推进任意回合，玩家结束自己的回合。
> 本版先做「简单列表」：名单 / 加值 / 合计 / 当前回合高亮 / 上下移动 / 删除 / 重掷。
> 头像条、拖拽排序、隐藏回合的镜头处理留给后续版本。
>
> **v1.3.1 起：先攻不再是「面板里的一个 tab」，而是独立窗口 `initiative.html`**
> （左侧工具栏「先攻」图标打开；拖动 / 位置记忆 / 后台在线检测见
> [`separate-windows-v131.md`](separate-windows-v131.md)）。本文里出现的「先攻 tab」
> 等价于现在的先攻窗口；数据结构、权限、渲染逻辑一行都没变。

## 1. 数据结构

### token 上的先攻加值

```json
// item.metadata["com.4enext-owlbear/init"]
{ "bonus": 25, "cardId": "c-xxxx", "updatedAt": 1730000000000 }
```

- 由 `assets/common.js` 的 `bindToken()` 在**绑定角色卡时**写入；解绑时删除。
- `bonus` 来自 `assets/glance.js` 的 `initiativeBonus(char)`：
  敏捷调整 + 半等级 + 自定义先攻加值（与速览页右上角的「先攻 +25」是同一个函数）。
- 旧版本（v1.2.2）绑过的 token 没有这个键：打开先攻 tab 时 GM 客户端会调用
  `syncInitBonuses()` 补写；「同步加值」按钮可以再手动跑一次。
- 后台是经典脚本，不重新推导加值，只读这个元数据；缺失时按 +0 加入，等面板同步。

### 房间数据里的先攻状态

```json
// room.metadata["com.4enext-owlbear/initiative"]
{
  "v": 1,
  "updatedAt": 1730000000000,
  "round": 1,
  "activeId": "token-id",
  "entries": [
    {
      "tokenId": "token-id",
      "name": "申比软软",
      "init": 37,
      "bonus": 25,
      "hidden": false,
      "ownerId": "user-player",
      "updatedAt": 1730000000000
    }
  ]
}
```

- `init` = d20 + `bonus`（「加入先攻」时自动掷一次，之后可单独重掷）。
- `hidden = true`：隐形加入，只有 GM 的客户端渲染它；非 GM 连名字都不会进 DOM。
- `ownerId` 取加入时 token 的 `createdUserId`，用于「玩家只能结束自己的回合」。
- `activeId` 是当前回合的 tokenId；`round` 是轮数，越过名单末尾时 +1。
- 数组顺序就是显示顺序：新加入 / 重掷后会按先攻从高到低排；GM 的上下移动会直接改数组顺序。
- 房间数据总上限 16KB，这张表按 200 条封顶，一条不到 200 字节。

### 没有改的键

`com.4enext-owlbear/hp`、`com.4enext-owlbear/state/<cardId>`、`com.4enext-owlbear/cardId`、
`com.4enext-owlbear/cards` 全部保持原样；v1.3.0 只**新增** `/init` 与 `/initiative` 两个键。

## 2. 三个 tab

- `panel.html` 现在是单面板三 section：`#tab-glance` / `#tab-init` / `#tab-dice`。
- 切换只改 `.tab-pane` 的 `on` class 和 `display`，**不重载页面**，导入的卡片、选中的 token、滚动位置都保留。
- ~~`manifest.action.popover` 指向 `panel.html?tab=init`：左上角 4E 图标打开时直接落在「先攻」~~
  → **v1.3.1 已改**：先攻是独立窗口 `initiative.html`，`action.popover` 只指向 `panel.html`
  （角色卡 / 导入面板），不再有 tab；
  工具栏 / 右下角浮动按钮 / 速览弹窗的 ⤢ 仍打开 `panel.html`（默认「速览」）。
- 「骰子」在 v1.3.0 是占位，写明「即将推出」，v1.5.0 实现。

## 3. 右键菜单

| 菜单项 | 谁能看到 | 行为 |
| --- | --- | --- |
| 绑定 4E NEXT 角色卡 | GM | v1.1.0 的绑定弹窗，同时写 init 元数据 |
| **加入先攻** | GM | 把 token 加入先攻，自动掷 d20 + 加值（公开） |
| **隐形加入先攻** | GM | 同上，但 `hidden=true`，只有 GM 看得到 |

- 两个菜单项都只对**单个 IMAGE token** 出现。
- 已经在先攻里再点「加入先攻」不会重掷，只更新名字 / 加值（隐形标记只增不减，避免误公开）。
- 「隐形加入」**不修改 token 在地图上的可见性**，只影响先攻列表的显示；需要藏 token 请用 Owlbear 自己的隐藏 / 迷雾。

## 4. 权限与回合推进

| 操作 | 谁做 | 写入方 |
| --- | --- | --- |
| 加入 / 隐形加入 | GM | GM 的 `background.core.js` 直接写房间数据 |
| 掷先攻 / 重掷全部 / 上下移动 / 设为当前 / 删除 / 清空 / 上一回合 / 下一回合 | GM | 面板页直接写房间数据 |
| 结束我的回合 | 玩家 | **玩家不写**：发 `com.4enext-owlbear/init-request` 广播，GM 客户端校验后写 |

为什么玩家不直接写：Owlbear 的房间数据通常只有 GM 能写（与 v1.2.0 的资源追踪同一个限制）。
玩家点「结束我的回合」后，面板提示「已请求结束回合，等待城主客户端推进」；GM 的 background 收到请求后：

1. 必须自己是 GM；
2. 请求里的 `activeId` 必须等于当前 `activeId`（防止回合已经变了还推进）；
3. 当前条目的 `ownerId` 必须等于请求的 `playerId`（只能结束自己的回合）。

三条都过才推进并通知；否则忽略 / 弹 WARNING。GM 面板自己的「下一回合」不走请求，直接写。

## 5. 渲染与隐私

- `visibleEntries(state, role)`：非 GM 过滤掉所有 `hidden` 条目。
- `entryName(entry, role)`：非 GM 看隐形条目只会得到「？？？」；当前回合是隐形时，状态栏也只显示「？？？」。
- `renderInitiativeHTML()` 直接拼字符串（与 glance.js 同风格），没有框架；所有名字都过 `esc()`。
- 当前回合加 `.init-row.on` 高亮；GM 的隐形条目加虚线和「隐形」徽章。

## 6. 后台与面板的分工

| 文件 | 职责 |
| --- | --- |
| `assets/common.js` | `KEY_INIT` / `KEY_INITIATIVE` / `CH_INIT_REQUEST`；`bindToken()` 写 init 元数据 |
| `assets/glance.js` | `initiativeBonus()`（唯一加值口径） |
| `assets/initiative.js` | 先攻数据模型、掷骰、回合推进、渲染、面板读写、`syncInitBonuses()` |
| `assets/panel.js` | 三 tab 切换；先攻 tab 事件委托；玩家结束回合广播 |
| `assets/background.core.js` | 右键加入 / 隐形加入；玩家结束回合请求；不能 import，常量与 ESM 侧由 `dev/check.mjs` 对齐 |
| `dev/test-initiative.mjs` | 无浏览器自测（见下） |

## 7. 自测清单（`node dev/test-initiative.mjs`）

1. `bindToken()` 写入 `com.4enext-owlbear/init`，`bonus` 等于 `initiativeBonus(char)`；
2. 解绑时同时删掉 `cardId` 与 `init`；
3. 后台注册了「加入先攻」「隐形加入先攻」两个右键项（GM + IMAGE）；
4. 加入先攻写入房间数据，条目含 `tokenId/name/init/bonus/hidden/ownerId`；
5. 隐形加入 `hidden=true`；
6. GM 推进：当前指针移动、越过末尾轮数 +1、上一回合回到开头时轮数 -1；
7. 玩家结束回合：owner 匹配才推进；不匹配忽略并 WARNING；非 GM 的后台不写；
8. 非 GM 渲染结果里不出现隐形条目的名字，当前回合显示「？？？」；
9. 骰子：`rollD20()` 边界 1 / 20，`rollInitiative(bonus)` = d20 + bonus；
10. 先攻状态归一化：坏数据不抛错、重复 tokenId 去重、activeId 失效时回到第一条。

## 8. 已知限制（v1.3.0）

- 先攻 tab 是**简单列表**：没有头像、血条、拖拽排序、横向先攻条、隐藏回合的镜头处理。
- 玩家「结束我的回合」依赖 **GM 客户端在线**（GM 的 background 在跑）；GM 不在线时请求不会生效。
- 房间数据写权限按 Owlbear 的规则：玩家加入先攻由 GM 代劳；菜单项因此只给 GM。
- 没有真机验证：所有交互都用假 OBR 跑过，但 popover / modal / 右键菜单的真实表现仍需在房间里确认。

## 9. 修复记录：v1.3.0「后台脚本没有响应」

### 现象

v1.3.0 上传后，房间左上角图标 / 三个 tab 都正常，但**先攻 tab 顶部红字**：

> **后台脚本没有响应**：右键加入先攻、玩家结束回合都会靠它。请把扩展关掉再打开一次。

也就是说：面板页活着、后台页没活着（面板发 `diag-ping`，收不到后台的 `diag-pong`）。
本地自测同时报三个看似无关的错：

| 命令 | 报错 |
| --- | --- |
| `node dev/check.mjs` | FAIL 经典脚本解析失败：`Unexpected token ')'` |
| `node dev/test-background.mjs` | `SyntaxError: Missing catch or finally after try` |
| `node dev/test-initiative.mjs` | 同上 |
| `node --check` 逐个文件 | **全部 OK**（误导性：它只查单个文件，不查拼接结果） |

### 根因

`assets/background.core.js` **被截断了**：文件最后一段「启动保护」只写到

```js
try {
  window.addEventListener("error", ...);
  window.addEventListener("unhandledrejection", ...);
  });
```

就没了 —— 少了收尾的 `} catch (e) { ... }`、`OBR` 环境自检和最终的
`OBR.onReady(boot)`。于是：

1. 核心文件本身语法不完整 → `new Function(core + "return ...")` 报 *Missing catch or finally after try*；
2. `dev/build-background.mjs` 照样能拼（它只做字符串拼接，不解析）→ 产出的
   `assets/background.bundle.js` 在同一个位置断掉，末尾还多出半句
   `if (typeof OBR === "undefined" || !OBR) {` + `})();` → 经典脚本解析失败
   （`Unexpected token ')'`）；
3. 浏览器加载 background.html 时脚本**整体解析失败、一行都不执行** →
   没注册 `OBR.tool.create` / 右键菜单 / 弹窗，也**没订阅 `diag-ping`**
   → 面板 ping 永远等不到 pong → 红字。

一句话：**不是后台逻辑写错了，是后台文件被截断 + 构建脚本不校验产物，
导致 bundle 语法错误，后台脚本整个没跑起来。**

### 修法

1. `assets/background.core.js` 补齐结尾（第 8 节之后）：
   - 关闭第 9 节「启动保护」的 `try`，补 `} catch (e) { /* 忽略 */ }`（注册监听失败也不能让后台停下）；
   - 第 10 节「OBR 环境自检」：拿不到 SDK 时 `pageLog` + `#diag-state` + `notify(..., "ERROR")`
     写明原因，**绝不静默 return**；
   - 最后 `OBR.onReady(boot)`：把 `boot` 直接交给 SDK（已就绪时同步调用、未就绪时回调）。
     `diag-ping` 的订阅在 `boot` 最后一步，boot 不跑就必然红字，所以这一行是「后台活着」的开关。
2. 重新 `node dev/build-background.mjs` 生成 bundle（136.7 KB，1432 行，能按经典脚本 `vm.Script` 解析）。
3. `dev/check.mjs` 新增「后台心跳」检查：
   - `CH_HELLO` / `CH_PING` / `CH_PONG` 在 `background.core.js` 与 `assets/common.js` 里**逐字一致**；
   - 后台确实 `broadcast.onMessage(CH_PING, ...)` 且 `sendHello(CH_PONG, ...)`；
   - core 与 bundle 里都有 `OBR.onReady(boot)` 启动入口（bundle 落后会直接 FAIL）。
4. `dev/test-background.mjs` 新增**行为**断言：拿 `diag-ping` 的订阅回调手动触发一次，
   断言后台随即广播 `com.4enext-owlbear/diag-pong`（destination = LOCAL）。
   这样「频道名写歪」或「忘了回 pong」都会在自测里立刻暴露，而不是等真机红字。
5. `assets/panel.js` 的 `checkBackground()` 改成最多问 3 次（每次等 1.8s，重试间隔 1.2s，
   最坏约 7.8s 才下结论）：后台页与面板页可能同时启动，后台要到 boot 末尾才订阅 ping，
   只问一次容易撞上这个窗口、误报「后台脚本没有响应」。
   同时把状态拆成三档 **checking / ok / bad**（`bgState`）：
   - checking（面板刚打开）：先攻 tab 显示「正在确认后台脚本…」，**不闪红字**；
   - ok：收到 pong / hello，显示「后台已连接」；
   - bad：三次都没回音，才显示红条。
   红条出现后，后台真正起来时仍会被 `diag-hello` 广播纠正（面板一直监听 `CH_HELLO`），
   等待期间若先收到 hello 也不会再被红条覆盖。
6. 新增 `dev/selftest.mjs`：一条命令跑完全部四条自测。

> 关于频道名：面板问的是 `com.4enext-owlbear/diag-ping`，后台回的是
> `com.4enext-owlbear/diag-pong`（后台启动完成时还会主动广播
> `com.4enext-owlbear/diag-hello`）。面板三个都听（`pingBackground()` 监听 pong + hello），
> 所以**不需要**让后台回 `diag-hello`；要保证的是 ping→pong 这条链路，现在有静态 + 行为两道断言。

### 自测（交付前实跑，全部 exit 0）

```bash
node dev/selftest.mjs
# 等价于依次跑：
node dev/check.mjs && node dev/test-background.mjs && node dev/test-initiative.mjs && node dev/test-track.mjs
```

修复后输出（PowerShell 不支持 `&&`，所以用 `dev/selftest.mjs`）：

```text
=== 自测汇总 ===
  ok   dev/check.mjs（exit 0）
  ok   dev/test-background.mjs（exit 0）
  ok   dev/test-initiative.mjs（exit 0）
  ok   dev/test-track.mjs（exit 0）
全部通过（4/4，exit 0）
```

### 给真机的排查顺序

1. 扩展列表 REMOVE 再 Add（Owlbear 会缓存 manifest 与脚本）；
2. 刷新房间；若行为还像旧版，在 `background.html` 上按 **Ctrl+F5** 强制刷新
   （`background.html` 引用脚本时带了 `?v=1.3.0` 缓存破坏参数，以后升版本记得一起改）；
   控制台若还有报错，先看 `background.html` 的页面内日志（每一步都写了 ✓/✗）；
3. 面板左下角状态条：`后台已连接 v1.3.0` 才是真的通了；红条仍然出现时，
   打开 `https://yzzj66.github.io/4e-obr-cards/background.html` 直接看自检日志。

