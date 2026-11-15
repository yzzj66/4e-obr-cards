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

