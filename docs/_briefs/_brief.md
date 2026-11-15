# 任务：开发「4E NEXT 角色卡 · Owlbear Rodeo 插件」（免构建版）

## 用户需求（已明确）

1. 在 **Owlbear Rodeo（枭熊，免费版）** 里显示 4E NEXT 的角色卡，**核心是「速览」页**（血量/AC/三防/六属性/技能/威能/专长/装备 那个总览界面）；
2. 数据来源：4E NEXT「导出存档（JSON）」= `{app:"4enext", format:1, exportedAt, pages:{character:<Character>, reserve:{spellbook,backpack}, overview:{}, background:{}}}`（源码 `web/src/App.tsx` 的 `exportSave()` 可核对）；
3. **Token 绑定是核心功能**：右键地图上的 IMAGE token → 绑定某个角色卡 → 之后任何人选中该 token 都会弹出这张卡的「速览」小面板；
4. 渲染：HTML（可交互，外观尽量接近 4E NEXT）；**不做改卡**（修改仍在 4E NEXT 里进行）；
5. **不能依赖 npm 构建**（用户不会用）：产物必须是**免构建的静态文件**（纯 HTML + JS + CSS），能直接放到静态托管上；

## 技术约束与资料

- Owlbear Rodeo 扩展规范：`manifest.json` + `background_url`（service worker 页面）+ 各 iframe 页面；
- SDK：`@owlbear-rodeo/sdk`（参考仓库 `FullPeople/character-cards` 用的 `^3.1.0`，vite + `base:"/character-cards/"`）；
- **参考实现**（同作者、同类功能，可借鉴结构与 UX）：
  · `https://github.com/FullPeople/character-cards`（角色卡插件：manifest / background / panel / info / bind / controls）
  · `https://github.com/FullPeople/obr-suite`（更大的整合套件）
  · 可用 GitHub API 读源码：`https://api.github.com/repos/FullPeople/character-cards/contents/<path>`（base64 解码）——参考 `src/background.ts`、`src/info.ts`、`src/bind.ts`、`src/panel.ts`、`public/manifest.json`；
- 4E NEXT 源码在本地：`D:\deepseek\4E-Patch\archive\4E-NEXT-main\web\src\`（可读 `App.tsx`、`components/ReviewView.tsx`（速览页）、`lib/storage.ts`、`styles.css` 等，用于了解字段与视觉）；
- 4E NEXT 的卡面样式：`web/src/styles.css` + 构建产物 `index-*.css`（可从安装目录的 `app.asar` 里取，或用源码里的样式），可**裁剪后复制**进插件；

## 要做的

在 `D:\deepseek\4E-Patch\owlbear-plugin\` 下产出**免构建、可直接托管**的插件：

1. `public/manifest.json`：name「4E NEXT 角色卡」、version、`background_url`；
2. `background.html`（+ 内联或同目录 JS）：初始化 OBR SDK；右键菜单（`obr.contextMenu.create`）对 IMAGE token 提供「绑定 4E 角色卡」；把卡片数据存到 **room metadata**（`obr.room.setMetadata`，保证全房间/所有玩家可见，**无需自建服务器**）；
3. `bind.html`：选择要绑定的角色卡（从已导入的卡列表里选）；把 `cardId` 写进该 token 的 **item metadata**；
4. `info.html`：选中绑定的 token 时弹出「速览」小面板（血量/AC/强韧/反射/意志/六属性/技能/威能列表/专长/装备，含 HP 条），只读；
5. `panel.html`：右下角浮动按钮打开的全屏面板，可**导入 4E NEXT 导出的 JSON**（拖拽/选择文件/粘贴），列出已导入角色卡并可预览（同样渲染速览）；
6. 渲染层：把 4E NEXT 的速览页做成**纯 HTML/CSS**（数据来自导出 JSON 的 `pages.character`）；外观尽量贴近（深色主题 + 绿色高亮），但**不要**依赖 React/构建；
7. **导入即用**：`index.html` 作为「安装说明页」（含 manifest URL 复制、如何加到 Owlbear 的图文步骤）；
8. 后端零依赖：全部静态文件；SDK 可用 CDN ESM（如 `https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/+esm`）或本地 `vendor/` 复制一份（**必须能离线/无构建运行**，请在 README 写明选择与风险）；
9. 文档：`README.md`（中文）：
   - 这是什么 / 能做什么（速览 + token 绑定）；
   - **三步傻瓜部署**（推荐 GitHub 仓库 + jsDelivr 直链，或 GitHub Pages）：给出具体 URL 拼法；
   - 在 Owlbear 里添加扩展：`https://www.owlbear.rodeo/extensions` → 输入 manifest URL → 添加；
   - 使用流程：4E NEXT 导出 JSON → 插件面板导入 → 右键 token 绑定 → 选中 token 看速览；
   - 已知限制（免费版 / 只读 / 数据存房间）。

## 交付要求

- 所有文件在 `D:\deepseek\4E-Patch\owlbear-plugin\`（含 `public/` 或扁平结构均可，但 manifest 里的路径必须自洽）；
- **不允许**留下必须 `npm install`/`npm run build` 才能出产物的步骤（若要构建请把**构建产物直接提交**在目录里）；
- 无法实际联调 OBR（本机无网、无法起 GUI）→ 请在 README 里如实写"未做真机测试"，并尽量用静态检查（JSON 合法、路径存在、HTML/JS 语法）保证可加载；
- 不要改 `D:\deepseek\4E-Patch\` 下其它文件（data/ program/ tools/ archive/ 只读）。

## 参考数据（供渲染样例）

- 用户存档只读：`C:\Users\秦书皓\AppData\Roaming\4enext-desktop\storage.json`（`4enext.cards.v1` 里是角色卡，字段可参考 `Character` 类型：`web/src/lib/` 里的类型定义）；
- 也可以用 4E NEXT 的「导出存档」逻辑手工构造一份样例 JSON（`pages.character` = Character）放在 `samples/` 里，方便打开 `panel.html` 时无数据也能看到效果。