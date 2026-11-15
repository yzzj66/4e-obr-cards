# 速览弹窗「可自由拖动」（v1.2.2）

> 目标：速览弹窗不再死死锚在 token 上方挡住地图，而是像桌面窗口一样**按住标题栏就能拖走**，
> 位置按 token 记住，随时可以点「⌖」回到 token 上方。
>
> **状态：未真机验证。** 开发环境起不了 Owlbear 房间，也没有浏览器自动化；能做的是静态检查 +
> 假 OBR 的后台冒烟测试（见文末）。下面的实现假设「同一个 popover id 重新 open 只更新位置、
> 不重载 iframe」——这条是 v1.1.0 浮动按钮同款写法，但**弹窗拖动这条路没有在真实房间里点过**。

## 一、为什么不是直接拖 DOM

Owlbear 的 popover 是宿主页面里的一个 iframe，位置由宿主（OBR）控制：

- 在弹窗自己的页面里改 CSS（`transform` / `margin`）只会让内容在 iframe 里偏移，
  iframe 本身还盖在原处 —— 地图照样被挡，点击也照样被 iframe 吃掉；
- SDK 的 `OBR.popover` **没有** `setPosition` / 拖动 API，只有 `open` / `close` /
  `getWidth` / `getHeight` / `setWidth` / `setHeight`。

所以这里的做法是：**在同一个 popover id 上重新 `open`，只改 `anchorPosition`**。
弹窗页面（`info.html`）的 URL 不变，OBR 复用同一个 iframe，只把它的位置挪过去。

## 二、实现结构

```text
info.html / info.js（弹窗页）                 background.core.js（后台）
─────────────────────────────────            ──────────────────────────────
pointerdown on #head（标题栏）
  ├─ pointermove：累计位移 dx/dy
  ├─ 节流 33ms（INFO_DRAG_THROTTLE_MS）
  └─ broadcast "com.4enext-owlbear/info-drag"
        { phase: "start" | "move" | "end" | "reset", dx, dy }
                                              onInfoDrag()
                                                ├─ start：记下弹窗当前左上角（base）
                                                ├─ move ：target = base + (dx, dy)
                                                │          再按视口夹取
                                                │          再 popover.open(同 id / 同 url,
                                                │             anchorPosition = target)
                                                ├─ end  ：写 localStorage（按 token id）
                                                └─ reset：清位置 + 重新按 token 上方摆
```

要点：

1. **坐标系**：弹窗一律按「左上角」定位 —— `anchorReference: "POSITION"`，
   `anchorOrigin` / `transformOrigin` 都是 `{ horizontal: "LEFT", vertical: "TOP" }`。
   于是 `anchorPosition:{left,top}` 就是弹窗左上角在 Owlbear 视口里的 CSS 像素坐标，
   后台只需记住一个点，拖动 = 起点 + 指针位移，不用反推 OBR 的锚点 / 变换规则。
   **位移必须用 `screenX/screenY`，不能用 `clientX/clientY`**：弹窗是跟着指针一起移动的，
   iframe 自己的坐标原点也在动，client 坐标的差值会被弹窗位移抵消（一帧走 10px、下一帧又回到 0），
   拖起来会来回抖。屏幕坐标不受 iframe 位置影响。
2. **节流 + 合并**：弹窗页 33ms 最多发一条消息；后台如果还有一次 `popover.open` 没完成，
   只保留**最后一个**目标位置，完成后立刻补发（`pumpInfoDrag`），不会堆消息、也不会越拖越偏
   （位移始终相对 `start` 那一刻的 base 计算）。
3. **视口夹取**：`clampInfoPos()` 把左上角夹在 `[16, 视口 - 弹窗 - 16]` 内。
   16 = `INFO_VIEW_MARGIN`，与 MUI Popover 默认 `marginThreshold` 对齐，减少贴边时
   OBR 又替我们挪几像素、拖动跟着跳一下的情况。弹窗宽高仍按 v1.2.1 的规则先按视口收缩。
4. **位置记忆**：拖动结束写 `localStorage["4enext/info-pos"]`，结构是
   `{ v: 1, pos: { "<tokenId>": { left, top } } }` —— **按 token 各记一份**，
   同一枚 token 下次打开回到上次位置，换一枚 token 不会串位置。最多记 40 枚（`INFO_POS_MAX`），
   超了丢最早写入的。读的时候会校验数字并重新按当前视口夹取，换窗口大小也不会跑到屏幕外。
5. **回到 token**：标题栏右侧 `⌖` 按钮发 `{ phase: "reset" }`，后台清掉这枚 token 的位置并
   重新按「token 正上方」摆。之后再拖动才会重新记位置。
6. **丢 pointerup 的兜底**：指针拖到视口边缘、弹窗被夹住时，指针可能跑到 iframe 外面而收不到
   `pointerup`。弹窗页监听 `pointerleave` 收尾（不用 `window.blur`：万一 OBR 重开弹窗时
   抢焦点，blur 会让拖动在第一帧就结束）；后台另有 1.5 秒
   （`INFO_DRAG_IDLE_MS`）无消息自动结束，并按最后位置记忆。

## 三、拖动区在哪

- **整个标题栏**（`.pop-head` / `#head`）都是拖动区：标题文字、左侧 ⠿ 图标都能按；
- 标题栏里的按钮（⌖ / ⤢ / ✕）**不触发拖动**：`pointerdown` 的 target 落在
  `button / a / input / select / textarea / label / .sp` 上时直接跳过；
- 正文（`.pop-body`）完全不参与拖动，血量加减、威能点击、滚动都照旧；
- 鼠标样式：标题栏 `cursor: move`，拖动中 `cursor: grabbing`（`body.dragging`），
  标题栏 `touch-action: none`（触屏拖动时不要触发页面滚动），`user-select: none`。

## 四、参数都在哪（想改手感看这里）

| 常量 | 位置 | 默认 | 作用 |
| --- | --- | --- | --- |
| `INFO_DRAG_THROTTLE_MS` | `assets/common.js` | 33 | 拖动时 pointermove 的节流间隔（ms）。越小越跟手、消息越多；16~50 之间调 |
| `INFO_VIEW_MARGIN` | `assets/background.core.js` | 16 | 弹窗离视口边缘的最小距离（px），拖动夹取用 |
| `INFO_TOKEN_GAP` | `assets/background.core.js` | 8 | 自动定位时弹窗底边离 token 顶边的间距（px） |
| `INFO_DRAG_IDLE_MS` | `assets/background.core.js` | 1500 | 拖动中多久没消息就当结束（兜底丢 pointerup） |
| `INFO_POS_MAX` | `assets/background.core.js` | 40 | localStorage 里最多记多少枚 token 的位置 |
| `INFO_W` / `INFO_H` / `INFO_MIN_W` | `assets/background.core.js` | 660 / 700 / 360 | 弹窗尺寸（v1.2.1 起，未改） |

两个跨文件常量必须一字不差（后台是经典脚本，不能 `import`，只能各写一份）：

- `INFO_POS_KEY = "4enext/info-pos"`（`common.js` / `background.core.js`）
- `CH_INFO_DRAG = NS + "/info-drag"`（`common.js` / `background.core.js`）

`node dev/check.mjs` 会断言这两对字符串一致，改一边忘了另一边会直接报错。

## 五、已知限制

1. **没有真机验证**。核心假设是「同 id 重新 `popover.open` 只更新位置、不重载 iframe」。
   如果某个 OBR 版本在重开时把 iframe 重建了，表现会是：拖动第一下弹窗就跳过去、拖动中断
   （页面重载后仍可再拖；后台 1.5 秒后按最后位置记忆）。遇到这种情况请把 OBR 版本反馈回来。
2. **不跟地图**：拖动后的位置是**屏幕坐标**，平移 / 缩放地图不会让弹窗跟着 token 漂
   （这是有意的：位置记忆要的是「不挡地图的那块地方」）。要回到 token 就点 ⌖。
3. **视口尺寸在打开弹窗时记下**：拖动过程中如果改变窗口大小，夹取仍按旧视口算；
   关掉重开（或点 ⌖）会按新视口重算。
4. **指针跑出 iframe 会提前结束拖动**：弹窗被视口边界夹住后，指针继续往外走就不再属于弹窗
   页面了，拖动会在 `pointerleave` 处收尾。松手后再拖即可。
5. **位置只在本机**：`localStorage` 不跟着房间同步，换电脑 / 换浏览器要重新拖一次。
6. **直接打开 `info.html`**（不在 Owlbear 里）时没有后台，拖动消息无人接收；
   页面不会报错，只是拖不动 —— 与其它依赖 OBR 的功能一致。
7. 弹窗的方向键 / 键盘移动没有做；只用指针。
8. **浏览器缩放 / 高 DPI 未单独验证**：拖动位移用 `screenX/screenY`（按 CSS 像素，DPR 已包含缩放），
   理论上与 OBR 视口坐标一致，但只在 100% 缩放下推演过。真机若觉得拖动幅度不对，
   可以把 `info.js` 里的位移算法换成累加 `ev.movementX/movementY`（改动只在 pointermove 一处）。

## 六、自测

改完 `assets/background.core.js` 必须重新生成 bundle，然后跑全套：

```bash
node dev/build-background.mjs     # SDK + core → assets/background.bundle.js
node dev/check.mjs                # 含 v1.2.2：位置键 / 拖动频道两边一致、LEFT/TOP、夹取、info.js 事件、ui.css
node dev/test-background.mjs      # 假 OBR：打开弹窗 → 拖 100/50 → 夹取 → 记忆 → 重开 → 回到 token
node dev/test-track.mjs
node dev/check-render.mjs
```

`test-background.mjs` 里这一段是纯逻辑验证（没有真实浏览器）：

- 选中绑定 token → `popover.open` 用 `POSITION` + `LEFT/TOP`，初始被夹到 `16,16`；
- `{phase:"start"}` + `{phase:"move",dx:100,dy:50}` → 弹窗移到 `116,66`，URL / 尺寸不变；
- `dx/dy = 5000` → 夹到视口右下边界 `524,84`；
- `{phase:"end"}` → `localStorage["4enext/info-pos"].pos["tok-1"]` 记下 `524,84`；
- 取消选中再选回同一枚 token → 重新打开在 `524,84`；
- `{phase:"reset"}` → 位置被清掉，重新打开在 token 上方 `16,16`。

## 七、改动清单

| 文件 | 改了什么 |
| --- | --- |
| `assets/background.core.js` | 弹窗改为「左上角定位」；新增位置记忆 / 拖动频道 / 节流合并 / 视口夹取 / 回到 token；版本 1.2.2 |
| `assets/info.js` | 标题栏指针事件（pointerdown/move/up、节流、离开兜底）、⌖ 按钮 |
| `info.html` | 标题栏 `#head` + 拖动提示 + ⠿ 图标 + `#pin` 按钮 |
| `assets/ui.css` | 拖动区光标 / 选中态 / 拖动中 grabbing |
| `assets/common.js` | `INFO_POS_KEY` / `CH_INFO_DRAG` / `INFO_DRAG_THROTTLE_MS`；版本 1.2.2 |
| `dev/check.mjs` / `dev/test-background.mjs` | v1.2.2 的静态断言与拖动冒烟测试 |
| `README.md` / `index.html` / `manifest*.json` | 版本与功能说明 |
