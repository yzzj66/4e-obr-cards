# 任务 v1.7.3：先攻条「移除」问题（右键菜单缺移出 + 删除 token 不清理）

## 现象（用户真机截图）

- 右键菜单只有「加入先攻」「隐形加入先攻」✗ **没有「移出先攻」** ✗；
- 用户原话：「移除先攻后不会从先攻条上去除」→ 即：**没法把已加入的单位从先攻条上移除** ✗；
- 另外推测：**token 被删除后**先攻条里的条目也应该自动清理 ✓（需确认/实现 ✓）；

## 现状

- 先攻数据：房间数据 `com.4enext-owlbear/initiative = {v,updatedAt,phase,surprise,round,curId,entries:[…]}` ✓；
- 右键菜单在 `assets/background.core.js`（`OBR.contextMenu.create` ✓ 已有两项 ✓）；
- 先攻条页 `initiative.html` + `assets/initiative-page.js` ✓ 列表窗口 `?view=list` ✓；

## 要做的

1. **右键菜单加/改**：
   - 检测该 token 是否**已在先攻里**（按 `tokenId` ✓）：
     · 不在 → 显示「**加入先攻**」「**隐形加入先攻**」✓；
     · 已在 → 显示「**移出先攻**」✓（点击 = 从 entries 删除该 tokenId ✓ + 刷新条 ✓ + 通知「已移出」✓）；
   - 实现方式：OBR `contextMenu.create` 的菜单项在**打开时求值** ✗（静态 ✗）→ 用 `filter`/两个菜单项互斥 ✓ 或每次数据变化时 `contextMenu.create` 重建 ✓（OBR 支持 `update`? ✓ 若无则 `destroy`+`create` ✓ —— 以 SDK 3.1.0 实际 API 为准 ✓）✓；
2. **token 删除自动清理**：
   - 订阅 `OBR.scene.items.onChange` ✓；检测先攻 entries 里 tokenId 已不存在的 ✓ → 自动从 entries 删除 ✓（写房间数据 ✓）+ 若 curId 被删 → 游标顺移 ✓；
   - 先攻条里**卡片**也要能直接删（GM ✓ 已有？✓ 若无则加 ✓ 卡片上 ✕ 按钮 ✓）；
3. **与隐藏项的关系**：隐形条目对玩家不可见 ✓ 但 GM 能看到并移除 ✓；
4. 写失败降级照旧 ✓（房间数据 ✗ 写不进 → 提示 ✓ 不静默 ✗）。

## 工程

- 改 `assets/background.core.js`（菜单 + items.onChange 清理）+ `assets/initiative.js`（`removeEntry`/清理函数）+ `assets/initiative-page.js`（卡片 ✕ ✓）；
- 重建 bundle ✓；`node dev/selftest.mjs` 5/5 绿 ✓；
- `dev/test-initiative.mjs` 新增：菜单动态（在/不在 ✓）、移出后 entries 无该 tokenId ✓、token 删除后自动清理 ✓、curId 被删游标顺移 ✓；
- 版本 → **1.7.3**（manifest×2 / common.js / background.html ?v= / index.html / index.js）；
- README 功能表加「移出先攻/自动清理」✓ 顶部「⭐ 安装地址」保留 ✓；docs 补一条 ✓；
- **manifest 保持无 action** ✗、**不要改 `docs/spec-*.md`** ✗、只改 `owlbear-plugin\` ✗、不引入构建步骤 ✗、**禁止启动浏览器** ✗。

## 注意

- 等 v1.7.2（血条编辑窗）**完成后再动** ✓（改同一批文件 ✗ 避免冲突 ✓）；
- 不破坏：速览/血条/四防一排/Boss/骰子/记录窗/动画/设置/五入口 ✓。
## 追加需求（用户 2026-11-15）：「先攻条背景设置成透明的」

- 现在先攻条（展开 720×129/139/159）是**不透明深色底** ✗ → 会挡住地图 ✓；
- 要求：**条的外壳背景透明** ✓（地图能透出来 ✓），只有**卡片本身**保留深色底 ✓（卡片不能透明 ✗ 否则看不清 ✓）；
- 具体：
  · `initiative.html` / `ui.css` 里先攻条根容器（`.strip`/`.strip-box`/popover body ✓ 按实际类名 ✓）`background: transparent !important` ✓；
  · 控制行（战斗准备/突袭/清空 那排按钮）可以保留**半透明**底（`rgba(11,15,20,.72)` ✓）以便文字可读 ✓ 或透明 ✓ 由你判断 ✓；
  · 卡片 `.initiative-item` 保持不透明深色 ✓；
  · 折叠态药丸（120×40）也透明 ✓（只剩图标+数字 ✓ 可给一层轻微阴影 ✓）；
  · 右侧空列表区域**不要再铺深色** ✗（现在是 `#10161d` ✗ → 改透明 ✓）；
- 自测：`dev/check.mjs` 加断言「先攻条根容器 background 为 transparent / rgba 半透明 ✓」「卡片仍不透明 ✓」「.strip-items 无深色纯色底 ✓」。
## 追加需求（用户 2026-11-15）：「先攻条能常驻显示，不要点了才显示」

- 现状：先攻条是 popover ✗，点开、点地图就会被关 ✗；
- 要求：**常驻显示** ✓ 进入房间就自动出现 ✓ 点地图不消失 ✓；
- 做法：
  1. **`disableClickAway: true`** ✓（打开参数里加 ✓ 已在 v1.4.0 用过 ✓ 确认保留）；
  2. **进入房间自动打开** ✓：`OBR.scene.onReadyChange` → 若本机设置 `4enext/strip-autostart != "0"` → `openStrip()` ✓（默认开 ✓）；
  3. **本机开关**：设置窗口「先攻」分栏加「进入房间自动显示先攻条 开/关」✓（写 `4enext/strip-autostart` ✓ 默认 `"1"` ✓）；
  4. **关掉入口**：先攻条右上加「—」最小化到折叠态 ✓ + 「✕」真正关闭 ✓（关闭后本房间不再自动弹 ✗ 除非重新开 ✓ 用 `4enext/strip-closed-this-session` ✓ 会话级 ✓）；
  5. 折叠态（120×40 药丸）也要**常驻** ✓ 并且**不被地图点击关掉** ✓；
  6. 与 v1.3.1「popover 重开只移动不重载」假设一致 ✓（拖动仍可用 ✓）；
- 自测：`dev/test-initiative.mjs` 加断言「modal/popover 参数含 disableClickAway ✓」「onReadyChange 时按设置自动开 ✓」「设置为 0 不自动开 ✓」「折叠态也 disableClickAway ✓」；
- `dev/check.mjs` 加断言设置项存在 ✓ 本机键名两端一致 ✓。