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
2. 改完跑 `node dev/selftest.mjs`（5 条自测：check / test-background / test-initiative / test-track / test-dice）。
   `dev/check.mjs` 会额外 spawn `dev/test-info-click.mjs`（v1.7.13）与 `dev/test-cards.mjs`（v1.7.15），
   所以「5 条命令」仍然覆盖点击链路与房间数据体积预算。
3. **manifest.json 的 `description` ≤ 128 字符**（Owlbear 会校验，超了直接拒绝加载）。
4. **manifest 不要加 `action` 字段**（真机验证过：加了反而加载失败）。
5. GitHub Pages 必须在仓库根放 **`.nojekyll`**，否则 `{{...}}` 模板语法会让构建失败、线上一直是旧版本。
6. 数据键名不要改（`com.4enext-owlbear/hp`、`/state/<cardId>`、`/cardId`、`/initiative` 等），改了旧存档会丢。

## 关键常量在哪

| 要调什么 | 去哪改 |
|---|---|
| token 血条/四防的位置与尺寸 | `assets/background.core.js` 顶部 `HP_RING_*`（环厚 **10s** / `Ro = 半短边 − 2s` / 48 段）与 `DEF_*`（直径 **30s** / 四角内缩 **4s** / 橙绿紫+白盾），几何全在 `barLayout()`；v1.7.9 起**只有环形血条 + 四角四防**（直条 / 蓝条 / Boss 名牌 / 锁已删） |
| 骰子动画手感 | `assets/dice-core.js` 的 `FX_*` + `assets/ui.css` 末尾 `@keyframes fx-*` |
| 先攻条尺寸 / 外壳 | `assets/background.core.js` 的 `STRIP_H_ALLOWED` / `stripSizeFor`（折叠 120×40，展开 720×**170/180/200**）；v1.7.11 起先攻条**回退 popover**（`stripPopoverOptions`：POSITION + CENTER/TOP、`hidePaper:true`、`disableClickAway:true`），尺寸 / 位置由后台重新 `popover.open` 决定（页面只发 `{op:"size"}` 与指针位移） |
| 窗口默认尺寸 | `assets/background.core.js` 的 `WINS` |


## 房间数据为什么必须精简（v1.7.15，16 kB 上限）

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
  `node dev/test-track.mjs`（四组 toggle / 默认全未用 / equipment 动作），再跑 `node dev/selftest.mjs` 5/5。

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
  `node dev/selftest.mjs` 仍是 5 条命令、5/5。
- **排查提示**：真机再遇到「点不动」，先在速览窗里开 DevTools 看三件事：① 元素是不是 `<button data-act=...>`
  （不是 → 页面还是旧的，看 `?v=` / 清缓存）；② computed `pointer-events` 是不是 `auto`（不是 → 有别的样式在压容器链）；
  ③ 点一下有没有走到 `applyAction`（`OBR.room.setMetadata` 失败会弹 WARNING，不静默）。
