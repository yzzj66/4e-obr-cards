# 枭熊房间里没有按钮 / 没有右键菜单 —— 排查记录与修复说明（v1.1.0）

> 本文是 v1.1.0 的排查记录，里面的版本号、截图步骤都停留在当时。
> v1.2.0 新增的血条 / 资源追踪（以及它们的权限差异与已知限制）见
> [`hp-bar-and-tracking.md`](hp-bar-and-tracking.md)；
> v1.2.1 的界面微调（弹窗加宽 / 行动点与里程碑同排 / 去掉专长与每日威能追踪）见
> [`ui-tweaks-v121.md`](ui-tweaks-v121.md)。

> 现象：扩展列表里能看到「4E NEXT 角色卡 v1.0.0」，能开关；直接打开托管上的 \`index.html\` 也正常；
> 但进了枭熊房间后 **右下角没有 4E 按钮**，**右键 token 没有「绑定 4E NEXT 角色卡」**，用户也没提供控制台报错。
>
> 本文记录：对照参考实现的结论、改了哪些文件、为什么改，以及**用户怎么一步步验证**。

---

## 一、结论先说

这次同时处理三个假设，因为它们都会造成**同一个症状**（扩展能加载，但房间里一个入口都没有）：

| # | 假设 | 为什么可疑 | 这次怎么处理 |
| --- | --- | --- | --- |
| A | **manifest 里用的是相对路径**（\`"icon": "icon.svg"\`、\`"background_url": "background.html"\`），Owlbear 解析成站点根 \`https://yzzj66.github.io/background.html\` → 404 | 参考实现 \`character-cards/public/manifest.json\` 写的是 **\`/character-cards/...\` 绝对路径**；官方 Hello World 教程也是 \`/icon.svg\`。相对路径解析一旦偏了，后台页就是 404，**静默无提示**，和现象完全吻合 | \`manifest.json\` 改成绝对地址（按 \`https://yzzj66.github.io/4e-obr-cards/\`），另存一份 \`manifest.relative.json\` 备用 |
| B | **后台页的脚本压根没跑起来**（模块解析 / 运行时异常）→ 右键菜单和浮动按钮同时消失 | 这两个入口**全部**由 \`background.html\` 注册，一起消失说明脚本没执行到 | 后台改成**单个经典脚本** \`assets/background.bundle.js\`（无 \`type="module"\`、无 import/export、内联 SDK），并加自诊断通知与页内日志 |
| C | contextMenu / popover 的**参数写错** | 参考实现是唯一验证过能跑的样本 | 逐行核对后：**参数本来就一致**（见第二节），所以保留写法，只补 try/catch 与失败通知 |

另外一个**结构性补救**：以前所有入口都依赖后台脚本，等于把鸡蛋放在一个篮子里。
现在多了两个**不依赖后台脚本**的入口：

1. **左上角扩展图标**（manifest 的 \`action\`，Owlbear 自己渲染，**即使后台脚本全崩也照样出现**）；
2. **左侧工具栏的 4E 工具按钮**（\`OBR.tool.create\`）。

> 于是"有没有按钮"本身就变成了诊断信号：左上角有、右下角没有 ⇒ 后台脚本有问题；两个都没有 ⇒ manifest/托管地址有问题。

---

## 二、逐行对照参考实现 \`src/background.ts\`

参考实现：\`https://github.com/FullPeople/character-cards\` → \`src/background.ts\`（297 行，vite 打包、SDK 3.1.0）。

| 位置 | 参考实现怎么写 | 我们 v1.0.0 | 判定 |
| --- | --- | --- | --- |
| L7–L11 | \`const PANEL_URL = "https://obr.dnd.center/character-cards/panel.html"\` 等**全部写死绝对地址**，不从 \`import.meta.url\` 推 | \`URL_BASE = new URL("../", import.meta.url)\`，各页面再从它派生 | ⚠ 参考实现宁可写死也不推算 —— 说明在 OBR 的 iframe 里推算地址有坑。**已改**：后台用 \`location\` 推（background.html 永远在根目录），manifest 用绝对地址 |
| L35–L56 | \`OBR.popover.open({ anchorReference:"POSITION", anchorPosition:{left:w-12, top:h-160}, anchorOrigin:{RIGHT,BOTTOM}, transformOrigin:{RIGHT,BOTTOM}, hidePaper:true, disableClickAway:true })\` | 同款，只是 \`BOTTOM_OFFSET\` 用 92（按钮更靠下） | ✅ 一致，保留 |
| L58–L60 | 关 popover：\`try { OBR.popover.close(ID) } catch {}\` | 同 | ✅ |
| L112–L137 | 速览 popover：\`anchorReference:"POSITION"\` +\`anchorPosition\` | 我们多一层兜底：拿不到锚点就退回 \`anchorReference:"ELEMENT"\`+\`anchorElementId\` | ✅ 更稳，保留 |
| L201–L296 | \`OBR.onReady(async () => { ... })\`：先按场景就绪开 popover → \`OBR.scene.onReadyChange\` → \`OBR.contextMenu.create\`（**没有 await**）→ \`OBR.player.onChange\` → 初始 \`getSelection\` → 订阅 broadcast / metadata / items | 顺序是"先 contextMenu，后 popover"，其余相同；\`await\` 了 \`contextMenu.create\` | ✅ 等价（await 只是等 ack），保留 |
| L231–L258 | \`icons:[{ icon: ICON_URL, label:"绑定角色卡", filter:{ roles:["GM"], every:[{key:"type", value:"IMAGE"}], max:1 } }]\`；\`onClick\` 里 \`OBR.modal.open({ id, url, width:360, height:480 })\`，失败只 \`console.error\` | 完全同款，只是 \`height:600\`、文案不同 | ✅ **参数没错**，这是本次最重要的否证：问题不在 filter.roles / popover 参数 |
| 全文 | 参考实现**没有** \`OBR.tool\` / \`OBR.action\` 调用 | 我们也没有 | —— 但这次**新增** \`OBR.tool.create\` 作为第三入口（见第三节） |
| \`public/manifest.json\` | \`"icon": "/character-cards/icon.svg"\`、\`"background_url": "/character-cards/background.html"\` —— **绝对路径，且没有 action 字段** | \`"icon": "icon.svg"\`、\`"background_url": "background.html"\` | ❌ **改**：改绝对地址，并**新增 \`action\`** |
| \`vite.config.ts\` | vite 打包，产物是 \`assets/*.js\` 普通 module | 源码直跑：多文件 ESM + 相对 \`import\` | ⚠ 改：后台合并成**单文件经典脚本**（不引入构建步骤——成品已提交，见 \`dev/build-background.mjs\`） |

> 顺带核实了 OBR 官方文档（不是猜）：
> - Manifest：\`action\` = \`{ title, icon, popover, width, height }\`，"action 显示在房间**左上角**，点击弹出该 popover"；
> - Action API：\`OBR.action.open()/close()/setTitle()/setBadgeText()\`；
> - Notification：\`OBR.notification.show(message, variant)\`，variant 只有 \`DEFAULT/ERROR/INFO/SUCCESS/WARNING\`（**没有**"点击回调"，所以自诊断只能靠文字+日志）；
> - Context menu：\`ContextMenuIcon\` **没有** \`onClick\`，点击回调只能写在 \`ContextMenuItem.onClick(context, elementId)\` 里（所以没法用"第二个图标=打开面板"来区分，这也是我们改用 \`action\`+\`tool\` 的原因）。

---

## 三、改了哪些文件、为什么

### 1. \`manifest.json\`（关键改动）

- \`icon\` / \`background_url\` 改成 **绝对地址**：\`https://yzzj66.github.io/4e-obr-cards/...\`（对应参考实现第 1 行表格最后两行）。
- **新增 \`action\`**：左上角出现 4E 图标，点击弹出 \`panel.html\`（980×720）。这个入口由 Owlbear 渲染，**不经过我们的后台脚本**。
- \`version\` 从 \`1.0.0\` → **\`1.1.0\`**：扩展列表里能一眼看出加载的是不是新版本（旧 manifest 会被 Owlbear 缓存，必要时删掉扩展重新添加）。
- \`description\` 更新，提到三个入口。

另存 \`manifest.relative.json\`（相对路径版，只在确定宿主能正确解析相对地址时用）。

### 2. \`background.html\`

- 只加载**一个**脚本：\`<script src="assets/background.bundle.js">\`，**没有 \`type="module"\`**。
- 页面里有**自检日志**（\`#diag-log\` / \`#diag-state\`）：直接在浏览器打开 \`background.html\` 就能看到每一步是 ✓ 还是 ✗，以及失败原因——**不需要开控制台**。
- 给 \`<script>\` 加了 \`onerror\`：连 bundle 都 404 时会直接写红字。

### 3. \`assets/background.core.js\`（新增，后台逻辑的唯一真源，可读）

逻辑与 v1.0.0 相同（右键菜单 / 浮动按钮 / 选中即弹速览），外加：

- **自诊断**：每一步 \`attempt(说明, fn)\` 包 try/catch，失败 → \`OBR.notification.show("4E插件出错：" + 步骤 + " —— " + 原因, "ERROR")\`；启动完再汇总一条
  \`4E 角色卡 v1.1.0 已加载：工具栏✓ · 右键✓ · 浮动按钮✓\`（**一眼看出哪个入口没注册上**）。
  想关掉这条：\`localStorage.setItem("4enext/diag", "0")\`。
- **第三入口**：\`OBR.tool.create\` 在左侧工具栏加 4E 图标，点击 \`onClick\` 打开面板并 \`return false\`（不切换工具状态）。
- **面板打不开时的兜底**：\`OBR.action.open()\`（走 manifest 的 action 弹窗）。
- **心跳**：启动后 \`OBR.broadcast.sendMessage("com.4enext-owlbear/diag-hello", ...)\`（LOCAL），并回应面板的 \`diag-ping\` → \`diag-pong\`。这样**面板能自己判断后台是否活着**（见第 5 点）。
- 地址推导改成 \`new URL("./", location.href)\`（background.html 永远在插件根目录），不再依赖 \`import.meta.url\`。
- \`window.onerror\` / \`unhandledrejection\` 也会变成可见通知。

### 4. \`assets/background.bundle.js\`（新增，生成物，102 KB）

= \`vendor/obr-sdk.js\`（esm.sh 的 SDK 3.1.0，**剥掉末尾的 \`export{...}\`**，把 default 变量接成 \`OBR\`）+ \`assets/background.core.js\`，整体包在一个 IIFE 里，是**纯经典脚本**：

- 没有 \`type="module"\`、没有 \`import\`/\`export\`/\`import.meta\`，不依赖 CDN；
- 后台页因此只剩**一次脚本加载**，任何"多文件 ESM + 相对 import"的加载策略差异都不会再影响它；
- 由 \`dev/build-background.mjs\` 生成（开发期跑一次，**成品已提交**，部署时不需要 Node）。

> 关于第 5 条要求（"合并成单文件"）：没有用手工粘贴，而是写了个 30 行脚本做"剥 export + 拼接 + 断言 SDK 结构没变"，
> 这样换 SDK 版本时不会悄悄拼错。脚本只做拼接，不是必需的构建步骤。

### 5. \`assets/common.js\`、\`assets/panel.js\`、\`panel.html\`、\`ui.css\`

- \`URL_BASE\` 改成优先用 \`location\`（原来只用 \`import.meta.url\`）。
- 新增 \`pingBackground()\`：面板打开时向后台发 \`diag-ping\`，1.8 秒内没有 \`diag-hello/diag-pong\` 就在**面板底部显示红条**：
  「后台脚本没有响应：右键菜单和右下角 4E 按钮都会缺失」；有回应则显示绿条和版本/入口状态。
  → **玩家不用开控制台就能判断后台活没活**。
- 面板的 ✕ 现在同时尝试 \`OBR.modal.close\` 与 \`OBR.action.close\`（面板也可能以 action 弹窗打开）。

### 6. \`index.html\` / \`assets/index.js\`

顶部新增「自检」卡片，打开页面即自动检查并显示：

1. manifest 的实际地址；
2. manifest 能不能读到（版本号、manifest_version）；
3. **manifest 里的绝对地址是不是指向当前这个站点**（换了托管地址会报警）；
4. \`background.html\` 与 \`assets/background.bundle.js\` 能不能取到（HTTP 状态）；
5. \`vendor/obr-sdk.js\` 能否 \`import\` 成功、\`OBR.isAvailable\` 是多少；
6. 是否在枭熊房间里 / 是否已就绪。

底部写着：**"如果枭熊房间里看不到 4E 按钮，请把这一块截图给作者。"**

### 7. \`assets/background.js\`（保留为兼容垫片）

老版本 \`background.html\` 引用的是它。现在它只做一件事：把 \`assets/background.bundle.js\` 注入页面，
让**浏览器缓存了旧 background.html** 的情况也能自愈（避免"我更新了但还是没按钮"）。

### 8. 其他

- \`icon-tool.svg\`：给 \`OBR.tool.create\` 用的 24×24 线性图标（工具栏图标规格）。
- \`dev/build-background.mjs\`：生成 bundle。
- \`dev/test-background.mjs\`：**无浏览器的冒烟测试**——用假的 OBR 跑一遍 core，断言 tool/contextMenu/popover/通知/心跳都被调用。
- \`dev/check.mjs\`：新增检查（manifest 必须绝对地址 + 必须有 action；bundle 无 import/export 且能按经典脚本解析；bundle 与 core 是否同步；background.html 不得再出现 \`type="module"\`）。
- \`README.md\`：文件结构、入口说明、自测命令同步更新。

---

## 四、用户怎么验证（按顺序做，1 分钟）

1. **重新部署**：把本目录（\`manifest.json\`、\`background.html\`、\`icon-tool.svg\`、\`assets/\`、\`data/\`、\`vendor/\`、\`samples/\`）整个上传覆盖到 \`yzzj66/4e-obr-cards\`。
2. 先在浏览器打开 \`https://yzzj66.github.io/4e-obr-cards/manifest.json\`，确认 \`"version": "1.1.0"\` 且地址是 \`https://yzzj66.github.io/4e-obr-cards/...\`（**不是** \`icon.svg\` 这种相对写法）。
3. 打开 \`https://yzzj66.github.io/4e-obr-cards/index.html\`，看顶部「自检」：
   6 项应该全是绿字（"Owlbear 环境"显示"不在枭熊房间里"是正常的）。
   有红字就先解决红字，别急着进房间。
4. **删除旧扩展再重新添加**（Owlbear 会缓存 manifest）：Extensions → 删掉 4E NEXT 角色卡 → Add Extension → 粘 \`manifest.json\` 地址。
   列表里应显示 **v1.1.0**。
5. 进房间。预期依次看到：
   - 右上角弹出一条 **INFO 通知**：\`4E 角色卡 v1.1.0 已加载：工具栏✓ · 右键✓ · 浮动按钮✓\`（这是自诊断的关键一条）；
   - **左上角**出现 4E 图标；点它 → 弹出角色卡面板；
   - **左侧工具栏**出现 4E 工具图标；点它 → 打开面板；
   - **右下角**出现绿色 4E 浮动按钮；点它 → 打开面板；
   - **右键**一个图片 token → 多出「绑定 4E NEXT 角色卡」（仅 GM、单选）；
   - 打开面板 → 左下角显示 **绿条「后台已连接 v1.1.0 · 工具栏✓ · 右键菜单✓ · 浮动按钮✓」**。

6. **出问题时的对照表**：

| 看到什么 | 说明什么 | 怎么办 |
| --- | --- | --- |
| 左上角有图标、看不到加载通知/右下角按钮 | 后台脚本没跑起来 | 浏览器直接打开 \`.../background.html\`，截图里面的自检日志 |
| 左上角也没有图标 | manifest 没生效或被缓存（也可能是 action 字段没读到） | 删扩展重新添加；核对 manifest.json 内容与版本号 |
| 通知写着「工具栏✗ / 右键✗」 | 对应 API 调用失败，通知里有原因 | 把那条 ERROR 通知截图 |
| 面板底部红条「后台脚本没有响应」 | 后台 iframe 没加载/没就绪 | 同上，先看 background.html 日志 |
| index.html 自检里「清单里的绝对地址」是黄字 | manifest 指向的域名和你现在的托管不一致 | 用页面上生成的那份绝对 manifest 覆盖 |
| 有绿色通知，但右键菜单还是没有 | 不是 GM，或选中的不是 IMAGE token，或选了多个 | 用 GM 账号、单选一个图片 token |

7. 想临时关掉那条"已加载"通知（嫌吵）：在枭熊页面控制台执行
   \`localStorage.setItem("4enext/diag","0")\` 后刷新。

---

## 五、如果还是不行，请提供这三样

1. \`https://yzzj66.github.io/4e-obr-cards/index.html\` 顶部「自检」卡的**整屏截图**；
2. 直接打开 \`https://yzzj66.github.io/4e-obr-cards/background.html\` 的**整屏截图**（里面是逐步日志，会写明哪一步失败、失败原因）；
3. 房间内如果弹过红色 ERROR 通知，把**通知文字**抄下来。

有这三样就能定位到具体是哪一步（manifest / 后台加载 / SDK / 单个 API 调用）。

---

## 六、开发期自测（不需要浏览器）

\`\`\`bash
cd 4E-Patch/owlbear-plugin

node dev/check.mjs            # 静态检查：JSON / HTML 引用 / import 路径 / manifest 绝对地址 + action /
                              #   bundle 无 import-export 且能按经典脚本解析 / bundle 与 core 同步
node dev/test-background.mjs  # 冒烟测试：假 OBR 跑 background.core.js，断言三个入口 + 通知 + 心跳
node dev/check-render.mjs     # 渲染检查（原有）
node dev/build-background.mjs # 改了 background.core.js 后重新生成 bundle（唯一"手工步骤"）
\`\`\`

本次全部通过（\`check.mjs\` 全绿、\`test-background.mjs\` 全绿、\`node --check\` 对 bundle 通过）。

---

## 七、注意

- 只改了 \`4E-Patch/owlbear-plugin/\` 下的文件，\`data/\`、\`program/\`、\`tools/\`、\`archive/\` 未动。
- 没有引入构建步骤：仓库里的 \`manifest.json\` / \`background.html\` / \`assets/*.js\` 都是可直接静态托管的成品。
  \`dev/build-background.mjs\` 只在**修改后台逻辑**时需要跑一次。
- \`manifest.json\` 里的绝对地址写死为 \`https://yzzj66.github.io/4e-obr-cards/\`。
  **换域名/换仓库**时：打开新的 \`index.html\`，复制「如果扩展加载失败」里生成的那份绝对 manifest 覆盖即可
  （或者用 \`manifest.relative.json\`，但那条路依赖宿主正确解析相对地址，不推荐）。
- Owlbear 会缓存 manifest；改完必须**删扩展重新添加**，否则看到的还是旧版本。
