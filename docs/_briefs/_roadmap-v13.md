# v1.3.0+ 规划：4eNEXT to owlbear（用户需求汇总，2026-11-15）

## 0. 命名
- 扩展名改为 **「4eNEXT to owlbear」**（manifest.name ✓ icon 可保留 4E 风格 ✓）

## 1. 三 tab 单面板（推荐方案）
- 一个 panel.html，三个 section：**速览 / 先攻 / 骰子**，tab 切换只切 display ✓
- 共用标题栏（可拖动 ✓ + ⌖ 回到 token ✓ + ⤢ 放大 ✓）+ 位置记忆 ✓
- 选中 token → 打开「速览」tab；左上角 4E 图标 → 打开「先攻」tab（GM）；标题栏 🎲 或 tab 切「骰子」

## 2. 先攻（参考 FullPeople/Full_initiative_tracker）
- 顶部/悬浮先攻条：token 头像 + 名字 + 先攻值 + 当前回合高亮
- **绑定角色卡后，先攻加值自动取自卡里的「先攻」**（如 +25）→ 先攻 = d20 + 该值
- 右键菜单：**加入先攻** / **隐形加入先攻**（Full Suite 同款 ✓ 别漏）
- 回合推进：**GM 可推进任意回合；玩家可「结束自己的回合」**（待用户最终确认，默认按此）
- 先攻状态存 room metadata（GM 写 ✓）+ 玩家通过 token metadata 提交自己的加值 ✓

## 3. 骰子（参考 Full Suite，4E 化）
- 完整复刻：d4/d6/d8/d10/d12/d20/d100、表达式（`2d6+1d20+5`、keep/max/min 等）、组合保存、历史、皮肤、目标总数、团队共享
- **去掉**：优势 / 劣势按钮 ✗、暗骰 ✗、示例框 ✗
- **新增「战斗优势」按钮** → 点一下给公式 **+2**（`1d4+10` → `1d4+10+2`）✓（4E 战斗优势 = +2 攻击）
- 预设按钮按 4E：攻击 vs 四防（AC/强韧/反射/意志）、伤害、豁免（d20≥10）、技能、先攻；4E 加值 = 等级一半+属性+训练 ✓
- **整体宽度加宽** ✓；界面沿用现有深色+绿风格 ✓
- **结果团队共享** ✓（GM 汇总写房间数据 + 广播，玩家只读）

## 4. 血条 / Boss 显示（参考 Full Suite 截图）
需求（用户 2026-11-15 明确）：
1. 血条除了 HP 还要显示：
   - **虚假生命 / 临时生命**：`144/144 +7` 里 **+7** 那部分 ✓（红色 +N 显示在右侧）
   - **四防**（4E 有 4 种防御）：**AC / 强韧 / 反射 / 意志** —— 按参考图 3 的布局：token 左上/右上/左下/右下 四个小数字 ✓（例：28 / 25 / 26 / 25）
   - **回复力**：**蓝色条** `13/13`（参考图 3 底部 ✓ 用户 2026-11-15 再次强调：需要一条蓝色条表示回复力）✓
     布局：HP 红条在上一行、回复力蓝条在下一行（一条细蓝条 + 数字 `13/13`）✓
2. **「显示为 Boss」**：右键菜单项 ✓ → token 显示成 Boss 样式（参考图 1/2：环形血条 / 名牌 + HP + 防御盾牌图标 + 锁）
3. 右键菜单新增（Full Suite 同款）：**添加血条组件** / **显示为 Boss** / **加入先攻** / **隐形加入先攻**

## 5. 数据与权限
- token 相关：`com.4enext-owlbear/hp`（cur/max/temp/surges ✓ 已有）→ 追加 `defenses:{ac,fort,reflex,will}` ✓ + `boss:boolean` ✓ + `init:{bonus}` ✓
- 卡级状态：`com.4enext-owlbear/state/<cardId>`（威能/装备已用 ✓）
- 骰子结果：`com.4enext-owlbear/rolls`（保留最近 N 条 ✓ 团队可见）
- 写不进去时降级 localStorage 并提示 ✓（已有机制 ✓）

## 6. 版本节奏
- **v1.3.0**：改名 + 三 tab 骨架 + 先攻加值联动 + 右键四菜单（含 Boss/血条组件）
- **v1.4.0**：先攻追踪器（含隐形加入/回合推进）
- **v1.5.0**：骰子（4E 化核心 + 团队共享 + 历史）
- **v1.6.0**：血条扩展（临时生命/四防/回复力/Boss 样式）

## 7. 设计语言（用户要求沿用）
- 深色底 `#14161c`~`#1b1e26`、主色绿 `#7fe07f`、强调红/粉/蓝（HP/回复力/防御）
- 圆角卡片、紧凑网格、等宽数字、小图标；不要引入新风格 ✓
## 8. 参考实现源码位置（FullPeople/obr-suite，2026-11-15 查证）

| 功能 | 模块路径 | 关键文件 |
|---|---|---|
| **Boss 显示** | `src/modules/bossBar/` | `index.ts` 11 KB、`model.ts` 4 KB、`layout.ts` 1.3 KB、`page.ts` 8.4 KB、`style.css` 4.2 KB、`README.md` 5 KB、`selftest.mjs` 27 KB |
| **血条（含临时生命/四防/回复力蓝条）** | `src/modules/hpBar/` | `index.ts` 20.8 KB、`target.ts` 4.2 KB、`edit.ts` 2 KB、`selftest.mjs` 15 KB |
| **先攻** | `src/modules/initiative/` | `index.ts` 38 KB、`panel-page.tsx` 35 KB、`components/`、`hooks/`、`styles/`、`utils/`、`types.ts` |
| **骰子** | `src/modules/dice/` | `index.ts` 61 KB、`panel-page.ts` **147 KB**、`effect-page.ts` 77 KB、`history-page.ts` 41 KB、`dice-skins.ts` 18 KB、`tags.ts` 19 KB、`sfx*.ts`、`fixed-roll.ts`、`replay-page.ts` |
| **资源追踪（威能/装备已用）** | `src/modules/resourceTracker/` | `index.ts` 17 KB、`panel.ts` 57 KB、`storage.ts` 8.6 KB、`icons.ts` 12 KB、`edit-page.ts` 14 KB |

**结论**：血条/Boss 用 `hpBar/index.ts` + `bossBar/index.ts` 的实现方式照抄（几何布局看 `bossBar/layout.ts` ✓）；
骰子体量大（`panel-page.ts` 147 KB + `effect-page.ts` 77 KB ≈ 300 KB TS）→ **分阶段做**，不要一次全搬 ✓。

抓取方式（GitHub API）：`https://api.github.com/repos/FullPeople/obr-suite/contents/src/modules/<模块>`（base64 解码）。