# v1.2.1 · 界面微调（弹窗加宽 / 行动点与里程碑同排 / 去掉专长与每日威能追踪）

> 一次纯 UI 的补丁：**不动数值推导、不动数据键名、不引入构建步骤**。
> 改的文件只有 `assets/glance.js`、`assets/glance.css`、`assets/info.js`、
> `assets/background.core.js`（弹窗尺寸在这里）和 `assets/ui.css`（面板预览宽度），
> 然后重新跑了一次 `node dev/build-background.mjs` 让 bundle 跟上 core。

---

## 一、改了哪四处

### 1）速览弹窗整体加宽

- `assets/background.core.js`：`INFO_W` 400 → **660**，`INFO_H` 560 → **700**
  （改之前弹窗只有 400px 宽，HP 行 / 数值行 / 属性三列都挤）。
- 同时按 `OBR.viewport.getWidth()` / `getHeight()` 各夹一次：
  小屏或缩窄的窗口里弹窗会缩小而不是超出视口（新常量 `INFO_MIN_W = 360` 兜底）；
- 弹窗是从 token 上方居中弹出的，所以贴近屏幕左右边缘时还会把**锚点拉回可视区**，
  660px 的宽度不会被裁掉；
- `assets/ui.css`：全屏面板里的预览 `.panel-main-inner` 从 `max-width: 980px` 放宽到 **1080px**；
- `assets/glance.css`：弹窗（compact）里的装备列表改成 `repeat(auto-fill, minmax(270px, 1fr))`，
  660px 宽时自动两列、窄屏自动退回一列，少滚动一屏。

### 2）「行动点」与「里程碑」并成一排

渲染时把两个计数器包进 `.gl4-resline`（`inline-flex` + `flex-wrap: nowrap`），中间一条 1px 竖线
`.gl4-sep`。外层 `.gl4-tags` 仍然可以折行，但这一排内部**永远不折**：

    行动点 [−] 2 [+] ｜ 里程碑 [−] 1 [+]

只读形态（index.html 示例 / `dev/check-render.mjs`）也走同一段代码，只是没有按钮。

### 3）「专长」改成纯展示

- 不再生成 `button[data-act="feat"]`：chips 不可点、没有 hover 反馈；
- 不再显示「已用 x / y」，标题右边只保留总数和「纯展示，不追踪使用」；
- 职业赠送的专长仍标「赠送」。

### 4）去掉装备栏的「每日威能」计数

- 装备区标题里的 `每日威能 − 0/3 ＋` 整个移除（`counter("每日威能", …)` 那段代码删掉）；
- 装备 chip 的「已用 / 耗尽」追踪（`equipmentUsed`）**保留不变**；
- `glance.js` 里的 `magicItemDailyUses()` 函数仍然导出（info.js / panel.js 还在用它的上限值传参），
  只是渲染层不再显示这个计数器。

---

## 二、没有动的（重要）

- **数据键名一个都没改**：房间数据 `com.4enext-owlbear/state/<cardId>` 里的
  `powerUsed / featUsed / equipmentUsed / itemDailyUsed / actionPoints / milestones` 原样保留，
  用户已经标好的状态不会丢；只是 v1.2.1 的界面不再写 `featUsed` 与 `itemDailyUsed`
  （长休照旧会把它们清空）。
- 血量 / 回复力 / 短休长休 / 威能追踪 / 装备追踪 / token 血条的行为都没变
  （`dev/test-track.mjs`、`dev/test-background.mjs` 逐条断言）。
- **仍然是免构建**：`assets/background.bundle.js` 依旧由 `node dev/build-background.mjs`
  把 SDK + `background.core.js` 拼成单文件，跑插件不需要任何构建工具。

---

## 三、自测（这次实际跑过的）

```bash
# 改了 background.core.js，必须重新生成 bundle
node dev/build-background.mjs

# 静态检查：bundle 与 core 同步、v1.2.1 的尺寸 / 样式断言、专长与每日威能不再生成可点元素
node dev/check.mjs

# 假 OBR 的后台冒烟测试：三个入口 + 通知 + 心跳 + token 血条
node dev/test-background.mjs

# 血量 / 资源追踪的语义自测（含专长与每日威能的数据层仍然可用）
node dev/test-track.mjs

# 渲染自检：四种形态的标签配平 + CSS 括号
node dev/check-render.mjs
```

四项全部通过。

---

## 四、版本号

`manifest.json` / `manifest.relative.json` / `assets/common.js` / `assets/background.core.js` /
`assets/index.js` / README 顶部与自检提示里的版本号统一到 **1.2.1**。
README 顶部的「⭐ 安装地址（复制这一行）」与 manifest URL 原样保留。
