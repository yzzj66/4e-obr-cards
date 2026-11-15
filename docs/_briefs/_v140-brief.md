# 任务 v1.4.0：先攻条（按 docs/spec-initiative.md 实现）

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\` **v1.3.2**：5 个工具栏入口（角色卡/速览/先攻/骰子/设置 ✓）、四块独立窗口 ✓、视口夹紧 ✓、按钮反馈 ✓；
- 先攻相关已存在：`assets/initiative.js`（数据模型 + 渲染模块 ✓）、`initiative.html` + `assets/initiative-page.js`（窗口页 ✓）、
  右键菜单「加入先攻 / 隐形加入先攻」✓、token metadata `com.4enext-owlbear/init={bonus,cardId}`（绑定卡时写入 ✓）；
- **规格（必读）**：`docs/spec-initiative.md`（665 行，含几何/卡片/排序/回合/权限/风险/P0–P5 ✓ 全部带源码行号）✓；
- 工程：改 `background.core.js` → `node dev/build-background.mjs`；`node dev/selftest.mjs` 必须 4/4 绿；

## 要做的（按规格顺序）

### P0 数据层（先做，其他人可并行）
- 房间数据 `com.4enext-owlbear/initiative`：每条加 `d20`、`tb`（tiebreak ✓ 按规格公式）、`phase`（idle/preparing/combat ✓）、`round`；
- **条目上限 60**（房间数据 ~16 KB ✗）+ normalize 里截断 + 写失败降级（本机暂存 + 通知 ✓）；
- 旧数据兼容：缺字段补默认 ✓ 不报错 ✓。

### P1 先攻条窗口（几何照抄规格 §2/§3）
- `initiative.html` 改成**先攻条**形态：折叠 120×40 / 展开 720×(129/139/159 三档 ✓ 按 phase ✓)；
- 打开方式：`anchorReference:"POSITION"` + `anchorOrigin/transformOrigin` 按规格 ✓ + top 45 ✓；
- 左/右两端按钮：**「战斗准备」**（进入 preparing ✓）、**「突袭」**（4E 突袭轮 ✓）、**「一键清空」**（清空 ✓ 二次确认 ✓）；
- 中间 **卡片列表**（照抄规格 §4）：56×80 ✓ 当前回合 100 高 ✓ 头像 80% ✓ 先攻值/HP 条/(当前+加值) ✓；
- 排序：合计 DESC → tiebreak ASC ✓；拖拽用中点法 ✓（规格 §7）；
- 回合推进：`nextIndex=(cur+1+len)%len` + 绕回 round+1 ✓；**GM 可推进任意** ✓；**玩家「结束我的回合」只发广播、不写数据** ✓（规格 §6 的四道校验照抄 ✓）；
- 掷先攻：d20 + token 的 `init.bonus` ✓（绑定卡时已写入 ✓）。

### P2 与已有功能的衔接
- 右键「加入先攻 / 隐形加入先攻」→ 写入房间数据 ✓ 并刷新先攻条 ✓；
- **隐形**：按我们之前商定 → **只在先攻列表里对玩家隐藏** ✓（不要把 token 从玩家画布抹掉 ✗ 参考实现的做法与用户需求冲突 ✗）；
- 「速览」窗口里可见「本 token 的先攻值」✓（已有 ✓）。

## 工程与自测

- 改 core → 重建 bundle ✓；`node dev/selftest.mjs` 4/4 ✓；
- `dev/test-initiative.mjs` 增加：P0 数据层（d20/tb/phase/round/上限 60/降级）、排序（合计/tiebreak）、回合推进（绕回 round）、
  权限（GM 任意 / 玩家只能结束自己 ✓）、隐形对非 GM 不可见、房间数据超限截断 ✓；
- `dev/check.mjs` 增加：先攻条尺寸常量、phase 三档、卡片尺寸 CSS、战斗准备/突袭/清空按钮存在、popover 定位参数；
- 版本 → **1.4.0**（manifest×2 / common.js PLUGIN_VERSION / background.html ?v= / index.html / index.js ✓）；
- README：功能表加「先攻条（战斗准备/突袭/一键清空/回合推进）」；顶部「⭐ 安装地址」保留 ✓；`docs/initiative-v14.md` 写实现说明；
- **不要改 `docs/spec-*.md`** ✓。

## 硬性要求

- 只改 `owlbear-plugin\`；不动 data/program/tools/archive；不引入构建步骤；不改已有数据键名（可**新增**字段 ✓）；
- 不破坏 v1.3.2 已有：5 入口 / 四窗口 / 夹紧 / 按钮反馈 / 设置窗口 / 速览 / 血条 / 资源追踪 / 右键绑定 ✓。