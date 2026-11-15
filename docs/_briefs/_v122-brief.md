# 任务：v1.2.2 —— 速览弹窗「可自由拖动」（不遮挡地图）

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\`（v1.2.1：弹窗加宽 / 行动点里程碑同排 / 去掉专长与每日威能追踪）；
- 速览弹窗 = `OBR.popover.open({ id: ID_INFO, url: URL_INFO, anchorReference:"POSITION", anchorPosition:{left,top}, width, height, ... })`，
  位置固定在选中 token 上方 ✗ → 常常遮挡地图 ✗；
- 关键文件：`assets/info.js`（弹窗内容入口 ✓）、`assets/glance.js`/`glance.css`（渲染）、`assets/background.core.js`（popover 开关 ✓ 改后要 `node dev/build-background.mjs`）、`assets/common.js`；
- 参考：FullPeople 的插件（`github.com/FullPeople/character-cards` 的 `src/info.ts` / `obr-suite`）——用户希望在"可拖动"上对齐他们的体验；
  可读其 `src/info.ts` 看有没有 `drag` / `pointermove` / 重新 `popover.open` 的实现；

## 用户要求

**速览弹窗可以自由拖动**（像桌面窗口那样），拖到不挡地图的位置；位置最好能记住（同一 token 下次打开回到上次位置）。

## 实现方向（首选，若参考实现不同则以参考为准）

OBR 的 popover 本身**不能拖动**，但可以**重新打开**在同一 id 上更新锚点（不会重载页面 ✓）：
1. 在弹窗顶部加一条**拖动区**（标题栏 / 空白处，带 `cursor:move` 提示）；
2. `pointerdown` 记录起点 → `pointermove` 计算位移 → **节流**（16–50ms）调用：
   `OBR.popover.open({ id, url, anchorReference:"POSITION", anchorPosition:{ left: baseLeft + dx, top: baseTop + dy }, width, height, transformOrigin:"TOP_LEFT", anchorOrigin:"TOP_LEFT", ... })`
   （字段名以 v1.1.0 里已用的写法为准 ✓ 不要引入未验证的新字段）；
3. 拖动时**阻止**文本框/按钮的点击（`e.preventDefault()` + 只在拖动区生效 ✓ 内容区照常交互）；
4. 位置持久化：`localStorage["4enext/info-pos"]`（全局一份即可，或按 token id ✓ 取全局更简单）→ 下次打开用这个位置 ✓；
5. 加一个「回到 token」小按钮（可选，但推荐：点了恢复自动定位）；
6. 弹窗尺寸若超出视口，拖动位置要**夹在视口内**（简单边界判断 ✓）；

## 约束

- 只改 `owlbear-plugin\` 内文件；不动 data/program/tools/archive；
- 改 `background.core.js` 必须重跑 `node dev/build-background.mjs`；跑 `dev/check.mjs` / `dev/test-background.mjs` / `dev/test-track.mjs` / `dev/check-render.mjs`；
- 版本 → **1.2.2**；README 顶部**必须保留**「⭐ 安装地址（复制这一行）+ manifest URL」，并在功能列表加一条「弹窗可拖动」；
- 不破坏现有：HP 控制 / 回复力 / 短休长休 / 威能装备追踪 / token 血条 / 右键绑定 / 面板预览；
- 无浏览器环境 → 说明里写清"未真机验证"，并把关键常量/参数集中在一处便于微调。

## 交付

- 更新后的插件文件（版本 1.2.2）；
- `docs/popover-drag.md`：实现方式、拖动区在哪、如何微调、已知限制；
- README 功能表更新。