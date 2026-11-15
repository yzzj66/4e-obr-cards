# 先攻（v1.3.0）

> 目标：绑定角色卡后，先攻加值自动取卡里的「先攻」；右键加入先攻；GM 推进任意回合，玩家结束自己的回合。
> 本版先做「简单列表」：名单 / 加值 / 合计 / 当前回合高亮 / 上下移动 / 删除 / 重掷。
> 头像条、拖拽排序、隐藏回合的镜头处理留给后续版本。

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
- `manifest.action.popover` 指向 `panel.html?tab=init`：左上角 4E 图标打开时直接落在「先攻」；
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
