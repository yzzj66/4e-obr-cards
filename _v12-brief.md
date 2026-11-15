# 任务：给 Owlbear 插件加「血条组件 + 威能/装备资源追踪」（v1.2.0）

## 现状（已上线可用 ✓）

- 插件目录 `D:\deepseek\4E-Patch\owlbear-plugin\`（v1.1.0，免构建，已部署 `https://yzzj66.github.io/4e-obr-cards/`）；
- 已能工作：右键 token → 绑定角色卡 → 选中 token 弹出**速览**卡（HP/血怒/回复值/回复力/行动点/AC/三防/六属性…）；
- 关键文件：`assets/background.bundle.js`（105 KB 单文件经典脚本，含 vendor SDK）、`assets/background.core.js`（源）、
  `assets/glance.js` + `glance.css`（速览渲染）、`assets/common.js`（房间数据 `com.4enext-owlbear/cards`、token 绑定 `…/cardId`）、
  `assets/info.js`（选中 token 弹的速览）、`assets/panel.js`（面板/导入）、`dev/build-background.mjs`（把 core 打成 bundle）；
- ⚠️ 改 `background.core.js` 后**必须**跑 `node dev/build-background.mjs` 重新生成 bundle（background.html 加载的是 bundle）✓；
- 房间数据写法：`OBR.room.setMetadata({ "com.4enext-owlbear/cards": {v,updatedAt,cards:[…]} })`（**需要 GM 权限**）；
  token 绑定：`OBR.scene.items.updateItems([...], items => items.map(i => i.metadata[KEY_BIND]=cardId))`；

## 用户新需求（原话）

1. **血条组件**：参考 FullPeople 的「血条组件」功能（右键 token 里的「添加血条组件」），但希望**集成在我们的浮动按钮/速览弹窗里**，
   即：在速览弹窗里能**加减 HP**，并把血条**显示在 token 上**（类似参考插件那样，玩家一眼看到血量）；
2. **资源追踪（威能/装备）**：类似 FullPeople 的"资源追踪"——**点一下威能变灰 = 已用**；装备/每日威能同理；
   4E NEXT 自己的速览页里也有这个功能（点击切换使用状态），请**按 4E NEXT 的语义**实现（见下）；

## 参考资料（必读，用 GitHub API 读源码）

- 血条组件实现：`https://github.com/FullPeople/character-cards`（`src/background.ts`、`src/controls.ts`、`src/info.ts`、`src/panel.ts`），
  尤其找 `添加血条组件` / `blood` / `hp` / `bar` 相关：它是在 token 上挂一个 item（RULER/CURVE/LINE？）还是在 token metadata 里存 + 用 `OBR.scene.items` 更新？
  另可看 `https://github.com/FullPeople/obr-suite` / `Full_initiative_tracker`（先攻条也是 token 上叠加 ✓ 看它怎么画）；
- 4E NEXT 的资源追踪语义：本地源码 `D:\deepseek\4E-Patch\archive\4E-NEXT-main\web\src\components\ReviewView.tsx`（速览页 ✓）
  与 `web/src/lib/character.ts` / `derive.ts`——找到「威能使用状态（已用/未用）」的字段与切换逻辑（`powerSlots`/`usedPowers`/`spent`/`hpNow` 等），照抄语义；
- 4E NEXT 的速览数据结构：`web/src/components/ReviewView.tsx` + 导出 JSON 的 `pages.character`（`Character` 类型）；

## 要做的

### A. 血条（HP）
1. 在速览弹窗（`info.html`/`info.js` + `glance.js`）里加**可交互 HP**：`-1/-5/-10/+1/+5/+10`、数值输入、「受伤/治疗」按钮（参考 4E NEXT 速览页的交互 ✓）；
2. HP 状态持久化：写在 **token 的 item metadata**（如 `com.4enext-owlbear/hp = {cur,max,temp,updatedAt}`）✓ 这样每个 token 独立、GM/玩家都能看到；
   —— 权限：若玩家无法写 item metadata，就用 GM 写 + 玩家只读（在 README 里说明）；
3. **token 上显示血条**：参考 FullPeople 的做法在 token 附近画血条（可能是挂一个 `RULER`/`CURVE`/`IMAGE` 子 item，或用 `OBR.scene.items` 更新 token 的 `text`/`metadata` 让 OBR 原生显示？）——**以参考实现的真实做法为准**，不要自创；
   若参考实现用的是"独立 item 跟随 token"(position 同步)，请同样实现并用 `OBR.scene.items.onChange` 做跟随/清理（token 删除时删除血条 item）；
4. 速览弹窗与 token 血条**双向同步**（改 HP → 血条立刻变；血条 item 被删 → 弹窗显示未绑定提示）。

### B. 威能 / 装备 资源追踪
5. 按 4E NEXT 速览页的语义，在速览弹窗里把**威能列表**渲染成可点击的 chip：点一下 = 切换"已用/未用"（已用显示为灰色 + 删除线 ✓）；
6. **每日威能计数**（如 `0/3`）、**回复力**（`8/8` 圆点 ✓ 点击消耗/恢复）、**行动点**（`1`）等也要能点；
7. 状态存哪：优先**房间 metadata**（`com.4enext-owlbear/state/<cardId>` ✓ 全房间共享）；写不进就退回 **localStorage**（每人自己的追踪 ✓ 在 README 说明差异）；
8. 装备/物品同理：点击切换已用/耗尽状态；

### C. 工程要求
9. 改完 `background.core.js` 必须跑 `node dev/build-background.mjs` 与 `node dev/check.mjs` / `dev/test-background.mjs`（如已存在）✓；
10. 面板（`panel.html`/`panel.js`）里的预览也要支持同样的点击追踪（或至少显示状态 ✓）；
11. 更新 README（新功能、权限差异、已知限制）+ `docs/` 下一份说明；版本号 → 1.2.0；
12. 自测（无浏览器）：`node --check` 各 JS、`dev/check.mjs`、bundle 与 core 同步（哈希/内容一致）、HTML 引用文件存在、JSON 合法；
13. 因为无法真机验证，请在 README 里写清"未真机测试"，并**尽量沿用参考实现验证过的 API 调用方式**。

## 硬性要求

- 只改 `D:\deepseek\4E-Patch\owlbear-plugin\` 内文件；不改 `data/program/tools/archive`（只读）；
- 不引入构建步骤（bundle 是手工拼接产物 ✓ 继续用现有 `dev/build-background.mjs`）；
- 不要破坏现有功能（右键绑定、速览弹窗、导入 JSON）✓ 所有新入口都要在出错时给 `OBR.notification.show(..., "ERROR")`。