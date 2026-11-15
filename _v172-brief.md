# 任务 v1.7.2：「添加血条组件」后能给该单位设置 HP / 四防（参考 FullPeople hpBar）

## 现象（用户真机）

- 右键菜单已有「添加血条组件」「移除血条组件」「显示为 Boss」✓（截图确认 ✓）；
- 但对**没有绑定角色卡的单位**（怪物/杂兵 token）用了「添加血条组件」后 ✗：**没有任何入口设置血量与四防** ✗ → 血条画不出来或只有空值 ✗；
- 现在改血量的唯一入口是「速览窗口」（要求 token 已绑定 4E 角色卡 ✗）；

## 参考实现（必读）

- `https://github.com/FullPeople/obr-suite` 的 `src/modules/hpBar/`（`index.ts` 20.8 KB + `edit.ts` + `target.ts`）✓；
- 规格 `docs/spec-hpbar-boss.md` §3 有要点：**popover 320×78**、输入语法 **`20 / +5 / -3 / 15+5`**、写盘两次校验、
  `HpBarTarget{session,version,itemId,pending}` + LOCAL 广播 + `HpTargetLease` 拒绝乱序 + ready 握手 ✓；
- 我们的数据键：token metadata `com.4enext-owlbear/hp = {cur,max,temp,surges,surgesMax,defenses:{ac,fort,reflex,will},updatedAt}` ✓（v1.6.0 已有 ✓）；

## 要做的

### 1. 「添加血条组件」→ 打开编辑小窗
- 右键「**添加血条组件**」改为：写 `hp-bar/enabled=true` ✓ **并且**打开一个新 popover（`hp-edit.html` + `assets/hp-edit-page.js` ✓ 约 **340×150**，可拖动 ✓ 用 `window.js` ✓）；
- 编辑窗内容：
  · 标题：token 名字（没有就「未命名」）✓；
  · **HP 输入**：一个文本框（支持 `20` 表示设上限 20 ✓ 或 `20/20` 同时设当前/上限 ✓ 支持 `+5`/`-3` 加减 ✓ 按参考语法 ✓）；
  · **四防输入**：4 个小文本框 **AC / 强韧 / 反射 / 意志** ✓（4E 四防 ✓ 可留空 ✓ 留空则不画那个盾 ✓）；
  · **回复力**：`当前/上限` 一个小输入 ✓（可选 ✓）；
  · 保存按钮 ✓ 取消 ✓；
- 保存 → 写 token metadata ✓ → 血条立即刷新 ✓（走现有 `patchBar`/重绘 ✓）；
- **同时**：如果 token 已绑定角色卡 ✓ → 优先显示卡里的数值作为默认值 ✓（方便只改一点 ✓）；

### 2. 移除时的行为
- 「移除血条组件」照旧写 `hp-bar/enabled=false` ✓（不删数据 ✓ 参考实现的坑 ✓）；
- 但**保留** hp 数据 ✓ 下次「添加血条组件」能恢复 ✓。

### 3. 权限
- 编辑窗只对 **GM 或 token 创建者** 可编辑 ✓（其他人只读 + 提示 ✓）；
- 写失败要 `OBR.notification.show(...,"ERROR")` ✓ 不静默 ✗。

## 工程

- 新增 `hp-edit.html` + `assets/hp-edit-page.js`（+ `assets/ui.css` 末尾追加 `.hpe-*` 样式 ✓ 沿用深色+绿 ✓）；
- `background.core.js`：新增 `ID_HP_EDIT`/`URL_HP_EDIT`/`WINS.hpEdit` + `openHpEdit(itemId)` + 右键菜单「添加血条组件」改为 openHpEdit ✓ + 频道（编辑窗 ↔ 后台 ✓ 参照 spec §3 的 target/lease 思路 ✓ 简化版即可 ✓）；
- 重建 bundle ✓；`node dev/selftest.mjs` 5/5 绿 ✓；
- `dev/check.mjs`：hp-edit 页存在 ✓ popover id ✓ 四防字段 ✓ 语法解析函数存在 ✓ 保存写 hp ✓ 无 action ✓；
- `dev/test-dice.mjs` 不涉及；新增 `dev/test-hpedit.mjs`（或并入 test-background ✓）：语法解析（`20`/`20/20`/`+5`/`-3`）✓ 写 metadata ✓ 权限分支 ✓ 空四防不画盾 ✓；
- 版本 → **1.7.2**（manifest×2 / common.js / background.html ?v= / index.html / index.js）；
- README 功能表加「血条组件编辑窗（HP/四防/回复力）」✓ 顶部「⭐ 安装地址」保留 ✓；`docs/hpbar-boss-v16.md` 补一节 ✓；
- **manifest 保持无 action** ✗、**不要改 `docs/spec-*.md`** ✗、不要改其它目录 ✗、不引入构建步骤 ✗、**禁止启动浏览器** ✗。

## 硬性要求

- 不破坏：速览/血条/四防一排/Boss/先攻条/骰子/记录窗/动画/设置/五入口 ✓；
- 编辑窗也要能拖动 + 记位置（复用 window.js ✓）。