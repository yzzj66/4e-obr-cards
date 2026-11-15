# 任务 v1.7.1：修「投骰动画黑屏」

## 现象（用户真机截图）

- 投骰后整套界面**全屏变黑** ✗：中间大骰子「20」+ 总分「57」+「+37」显示正常 ✓，但**背景是不透明黑** ✗，地图被完全盖住 ✗；
- 用户原话：「投掷怎么黑屏了」→ 期望：**动画层透明** ✓ 地图正常可见 ✓ 骰子浮在上面 ✓；
- 可能还有：动画播完**没有自动关闭** ✗（截图上 modal 还开着 ✓ 需确认）；

## 现状实现

- `effect.html` + `assets/effect-page.js`（全屏 modal 动画页 ✓ 规格 §4.2/4.3/4.4 ✓）；
- 打开参数：`OBR.modal.open({url, fullScreen, hideBackdrop, hidePaper, disablePointerEvents})` ✓；
- `assets/background.core.js` 里触发 ✓；`dice-core.js` 的 `FX_*` 常量 + `ui.css` 末尾 `.fx-*` 关键帧 ✓；
- **全屏 modal 的黑色来自 `effect.html` 自己的 `html/body/background`** ✗（不是 OBR backdrop ✗ 因为已 hideBackdrop ✓）；

## 要做的

1. **动画层完全透明** ✓：
   - `effect.html` 的 `html, body, #app/.fx-root` 一律 `background: transparent` ✗ 不允许任何纯色背景 ✗；
   - 检查 CSS 里有没有 `background:#000`/`#0b0f14`/`#14161c` 等深色底 ✗ → 删掉或改 `transparent` ✓；
   - `pointer-events:none` 保留（不挡鼠标 ✓）；
2. **确认 modal 播完自动关** ✓：动画总时长（FLIGHT+HOLD+PUNCH+HOLD2+EXIT ≈ 2600ms ✓）后 `OBR.modal.close()` + 清理定时器/rAF ✓；
   加**兜底**：`setTimeout(3000)` 强制 close ✓（防止动画被打断卡住 ✗）；再按 ESC / 点击任意处也立即关 ✓；
3. **动画期间地图仍可见** ✓：确认`hideBackdrop`确实生效 ✓（若 OBR 不支持，就用 popover 代替 modal ✓ —— 参考实现里 effect 页本来就是 modal ✓ 但它们的背景是透明的 ✓）；
4. 顺带：`hidePaper` 确保没有白/黑纸张底 ✓；
5. 版本 → **1.7.1**（manifest×2 / common.js / background.html ?v= / index.html / index.js）；
6. 自测：`node dev/check.mjs` 加断言「effect.html/css 无深色纯色 background」「有 3000ms 兜底 close」；`dev/test-dice.mjs` 加断言「动画结束后调用 modal.close ✓」「兜底 close 存在 ✓」；`node dev/selftest.mjs` 全绿 ✓；
7. `docs/dice-v17.md` 补「透明背景 + 自动关闭」说明 ✓。

## 硬性要求

- **manifest 保持无 action** ✗；**不要改 `docs/spec-*.md`** ✗；只改 `owlbear-plugin\`；不引入构建步骤；
- **禁止启动浏览器** ✗；不破坏其它功能（骰子/记录窗/先攻条/速览/血条）✓。