# 任务 v1.3.0：改名「4eNEXT to owlbear」+ 三 tab 骨架 + 先攻加值联动 + 先攻右键菜单

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\` **v1.2.2**（速览弹窗可拖动 ✓ 位置记忆 ✓ ⌖ 回 token ✓ 血条 ✓ 资源追踪 ✓）；
- 关键文件：`assets/background.core.js`（+ 改后必须 `node dev/build-background.mjs`）、`assets/common.js`（URL/频道/键名）、
  `assets/glance.js` + `glance.css`（速览渲染）、`assets/info.js`（弹窗）、`assets/panel.js`（面板）、`assets/track.js`、
  `manifest.json` / `manifest.relative.json` / `README.md` / `index.html` / `dev/*` 自测；
- 规划（务必先读）：`D:\deepseek\4E-Patch\owlbear-plugin\_roadmap-v13.md`（含参考实现模块位置、数据键、风格要求）；

## 用户已确认的决定

- 扩展名 → **「4eNEXT to owlbear」**；
- 三 tab 单面板（速览 / 先攻 / 骰子）；骰子 tab 在 v1.3.0 **先放占位**（"即将推出"），v1.5.0 实现；
- **先攻加值联动**：绑定角色卡后，先攻加值取卡里的「先攻」（如 `+25`）；
- **先攻推进**：**GM 可推进任意回合；玩家可「结束自己的回合」**；
- 设计语言沿用现有深色 + 绿（`#14161c` / `#7fe07f` / 圆角卡片 / 紧凑网格 ✓ 不引入新风格）。

## 要做的

### 1. 改名（manifest + 界面）
- `manifest.json`：`name` → `4eNEXT to owlbear`，`description` 更新（速览 + 先攻 + 骰子），`version` → **1.3.0**；
- `manifest.relative.json`、`common.js` 里版本号、`index.html`、`README.md`（顶部 ⭐ 安装地址必须保留）同步；
- 面板/弹窗标题文案改为 `4eNEXT to owlbear`（可保留副标题「4E NEXT 角色卡」）。

### 2. 三 tab 骨架（单面板）
- 把 `panel.html` 改成三 tab：**速览 / 先攻 / 骰子（占位）**；tab 切换只切 `display`，不重载；
- 选中 token → 打开面板并定位到「速览」tab（保持现有行为 ✓）；
- 左上角 4E action → 打开面板并定位到「先攻」tab；
- 保留现有 `info.html` 的「选中 token 弹速览」小窗逻辑 ✓（三 tab 面板是"大面板"，小窗仍按现行为；若实现成本高可让小窗只保留速览 ✓）；
- 拖动/位置记忆/⌖ 回到 token 对新面板继续有效 ✓。

### 3. 先攻加值联动（本版核心）
- 绑定角色卡时（`bind.js` / `panel.js` 的 bindToken 流程 ✓），把卡的先攻值写进 **token 的 item metadata**：
  `com.4enext-owlbear/init = { bonus: <number>, cardId, updatedAt }`；
- 先攻值来源：导出 JSON 的 `pages.character` 里速览用的那个「先攻」字段（参考 4E NEXT 源码 `web/src/components/ReviewView.tsx` / `derive.ts` 的先攻计算 ✓；
  插件侧 `glance.js` 已有渲染先攻的逻辑 → **复用同一个计算函数**，不要另算 ✗）；
- 先攻 tab 里显示清单（先用简单列表）：名字 / 先攻加值 / 合计（d20 + 加值可手动掷 ✓）；
- **右键菜单**（contextMenu）新增两项（Full Suite 同款命名）：
  · **加入先攻**（可见）
  · **隐形加入先攻**（隐藏身份，只 GM 可见）
  写入房间数据 `com.4enext-owlbear/initiative = {v,updatedAt,entries:[{tokenId,name,init,bonus,hidden,updatedAt}]}`；
- 回合推进：**GM 可点「下一回合」推进任意；玩家看到「结束我的回合」按钮**（权限判断用 `OBR.player.getRole()` ✓）；
- 先攻 tab UI：紧凑列表 + 当前回合高亮 + 上下移动（GM）+ 删除（GM）+ 掷先攻（d20+加值 ✓ 用 `glance.js` 的 roll 工具或简单 Math.random ✓）。

### 4. 工程与自测
- 改 `background.core.js` 后 `node dev/build-background.mjs`；
- 跑：`dev/check.mjs`、`dev/test-background.mjs`、`dev/test-track.mjs`、`dev/test-glance.mjs`、`dev/check-render.mjs`（全部 exit 0 ✓）；
- 新增 `dev/test-initiative.mjs`：用假 OBR 断言「绑定→写 init metadata」「右键两项注册」「加入先攻写房间数据」「GM 推进/玩家结束回合权限分支」「隐形不显示给非 GM」；
- `dev/check.mjs` 增加 v1.3.0 断言（名字、版本 1.3.0、三 tab 存在、骰子 tab 占位、右键两项、init 键名一致）；
- README：功能表加「先攻（加入/隐形加入/回合推进）」；已知限制更新（未真机验证 ✓ 先攻 tab 首版为简单列表 ✓）；
- `docs/initiative-v13.md`：实现说明 + 数据结构 + 权限 + 自测清单。

## 硬性要求

- 只改 `D:\deepseek\4E-Patch\owlbear-plugin\`；不动 data/program/tools/archive；
- 不引入构建步骤；bundle 必须与 core 同步；
- **不破坏现有功能**（速览/血条/资源追踪/拖动/右键绑定/导入 JSON）✓；
- **不改已有数据键名**（`/hp`、`/state/<cardId>`、`/cardId`）✓；
- README 顶部「⭐ 安装地址（复制这一行）+ manifest URL」必须保留 ✓。