# 任务 v1.5.0：骰子（按 docs/spec-dice.md 实现 P0–P3）

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\` **v1.4.0**（先攻条 ✓ 五入口 ✓ 四窗口 ✓ 设置 ✓ 夹紧 ✓ 反馈 ✓）；
- 骰子窗口已存在但只是占位：`dice.html` + `assets/dice-page.js`（`ID_DICE_WIN` ✓ 660×560 已按视口夹紧 ✓ `window.js` 壳 ✓）；
- **规格（必读）**：`docs/spec-dice.md`（900 行 ✓ 含协议/表达式/动画公式/4E 化决定/P0–P4/风险/自测建议 ✓）
  以及文件末尾「## 用户拍板」节 ✓（**以此为准** ✓）；
- 工程：改 `background.core.js` → `node dev/build-background.mjs`；`node dev/selftest.mjs` 必须 4/4 绿 ✓；

## 用户最终决定（覆盖规格里的 D1–D3）

- **不做命中判定** ✗（无 TN 输入、无命中/未命中/成功失败 ✓ 只显示点数 ✓）；
- **重击 = 4E 版**：所有伤害骰**取最大值** ✓（`d6`→6 ✓）结果面板标注「重击·已取满」✓；
- **去掉**：优势/劣势按钮 ✗、暗骰/全局暗骰 ✗、示例框 ✗、5etools 菜单 ✗；
- **新增「战斗优势」按钮**：点一下给公式 **+2** ✓（改 modifier ✓）；
- **整体加宽** ✓（现 660×560 → 按规格的 380×620 不合适 ✗ 我们保持宽版 ✓ 建议 760×620 或按视口夹紧 ✓）；
- **结果团队共享** ✓（广播 + GM 写 `com.4enext-owlbear/rolls` + 玩家只读 ✓ 规格 §4 的方案 ✓ 40 条封顶 ✓）；

## 要做的（按规格 P0→P3）

### P0 纯函数核心（`assets/dice-core.js`）
- 表达式解析/掷骰/总和/归一化 ✓（按规格 §3/§4 的 TERM_RE、wrapper、`adv/dis/max/min/reset/burst/repeat` ✓）；
- **重击模式**：伤害骰取满 ✓（实现「每骰 value=面数」✓ 结果标注 ✓）；
- 无 OBR 依赖 ✓ 可 `node` 直接测 ✓（`dev/test-dice.mjs` 覆盖 ✓）；

### P1 骰子窗口 UI
- `dice.html` 两栏：左骰子按钮区（d4–d100 + 战斗优势 + 重击 + 投掷）+ 右结果/历史 ✓；
- 表达式输入框 ✓ 投掷按钮 ✓ 结果面板（每骰点数 + 总点数 ✓ 重击标注 ✓）；
- 去掉示例框 ✓ 去掉优势劣势 ✓ 去掉暗骰 ✓；

### P2 团队共享 + 历史
- 广播 `CH_ROLL`（LOCAL+REMOTE ✓ 规格 §4 的频道 ✓）→ GM 校验合并 → `room.setMetadata(com.4enext-owlbear/rolls)` → 广播 `CH_ROLL_SAVED` ✓；
- 玩家只读 ✓ GM 离线时本机暂存 + 黄条提示 ✓；
- 历史 40 条封顶 + 去重（rollId 30s + 250ms ✓）；

### P3 4E 预设 + 组合
- 预设按钮（按 4E）：**攻击 vs 四防**（AC/强韧/反射/意志 ✓ 只显示点数 ✓ 不判定 ✗）、**伤害**（读 `glance.js` 的 damages ✓）、**豁免**（1d20+加值 ✓ 只显示点数 ✗ 不判定）、**技能**（读 glance 的 skills ✓）、**先攻**（1d20+先攻 ✓）；
- 组合保存/读取（本机 localStorage ✓ 房间共享可选 ✓）；
- **不做**动画/皮肤（P4 延后 ✓）。

## 工程与自测

- 新建 `dev/test-dice.mjs`：规格 §10 的 16 条断言 + 重击取满 + 战斗优势 +2 + 总和不含判定 ✓；
- `dev/check.mjs` 增加：dice-core 存在、无优势/劣势/暗骰/示例框、战斗优势按钮、重击按钮、加宽尺寸、CH_ROLL 频道两端一致、rolls 上限 40；
- `node dev/selftest.mjs` 加 test-dice（5/5 绿 ✓）；
- 版本 → **1.5.0**（manifest×2 / common.js / background.html ?v= / index.html / index.js ✓）；
- README：功能表加「骰子（表达式/战斗优势+2/重击取满/团队共享/历史）」✓ 顶部「⭐ 安装地址」保留 ✓；`docs/dice-v15.md` 写实现说明；
- **不要改 `docs/spec-*.md`** ✓。

## 硬性要求

- 只改 `owlbear-plugin\`；不动 data/program/tools/archive；不引入构建步骤；不改已有数据键名（可新增 ✓）；
- 不破坏 v1.4.0 已有功能 ✓（先攻条/五入口/设置/速览/血条/资源追踪/右键）✓；
- **禁止尝试启动浏览器/Edge**（沙箱会崩溃弹窗 ✗）：只做静态检查 + 假 OBR 冒烟 ✓。