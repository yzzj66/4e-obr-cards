# 4eNEXT to owlbear · Owlbear Rodeo 插件

> 在枭熊（Owlbear Rodeo）里查看 4E NEXT 导出的角色卡「速览」；**右键 token 绑定角色卡，选中即弹出速览**。
> v1.2.0 起：弹窗里能**加减血量**（token 上会自动画血条），威能 / 装备点一下变灰＝**已用**。
> v1.2.1：速览弹窗加宽到 660×700，行动点与里程碑并成一排；专长改为纯展示、装备栏去掉每日威能计数。
> v1.2.2：速览弹窗可以**按住标题栏拖走**（位置按 token 记住，⌖ 一键回到 token 上方），不再固定挡住地图。
> **v1.3.0**：改名 **4eNEXT to owlbear**；面板变成**速览 / 先攻 / 骰子**三个 tab（骰子先占位）；
> 右键新增**加入先攻 / 隐形加入先攻**，绑定角色卡后**先攻加值自动取卡里的「先攻」**（如 +25）；
> GM 可推进任意回合，玩家可「结束我的回合」。

## ⭐ 安装地址（复制这一行）

```
https://yzzj66.github.io/4e-obr-cards/manifest.json
```

**在 Owlbear Rodeo 里怎么加：**

1. 打开 `https://www.owlbear.rodeo/extensions`（或进房间 → 右上角 Extensions）
2. 点 **Add Extension** → 粘贴上面的地址 → 确认
3. **刷新房间** → 左上角出现 4E 图标 / 工具栏出现 4E 工具 / 右键地图 token 出现「绑定 4E NEXT 角色卡」

> 如果之前装过旧版本：先在扩展列表里 **REMOVE**，再重新 Add（Owlbear 会缓存旧的 manifest）

---

在 [Owlbear Rodeo](https://www.owlbear.rodeo/)（枭熊）里查看 **4E NEXT** 导出的角色卡「速览」页。
核心是五件事：**右键 token 绑定角色卡**、**选中绑定的 token 就弹出速览**、
**在弹窗里加减血量（token 上会画血条）**、**把威能 / 装备点成「已用」**、
**右键加入先攻并按角色卡的先攻加值推进回合**。

- 纯静态：HTML + 原生 JS + CSS，**不需要 npm、不需要构建**，扔到任何静态托管就能用。
- 零服务器：卡片与追踪状态存在 Owlbear 的**房间数据（room metadata）**里，全房间共享；
  血量存在**token 的 item metadata** 上。
- 不改卡：插件不碰角色卡本身（威能选择 / 属性 / 装备都不动），只记本场战斗的消耗。
- **三个入口**（左上角扩展图标 / 左侧工具栏 4E 工具 / 右下角浮动按钮）+ 右键菜单；前两个不依赖后台脚本，
  所以"哪个入口出现"本身就能用来判断插件哪一层没加载 —— 详见 [`docs/owlbear-debug.md`](docs/owlbear-debug.md)。

---

## 一、能做什么

| 功能 | 说明 |
| --- | --- |
| 速览面板 | 生命 / 血怒 / 回复值 / 回复力、AC 与三防、六属性、17 项技能、攻击与伤害、威能、专长、装备，外观贴近 4E NEXT 的速览页 |
| 右键绑定 | GM 右键地图上的 **IMAGE token** →「绑定 4E NEXT 角色卡」→ 选一张卡 |
| 选中即弹 | 任何人选中这枚 token，速览小面板就会从 token 上方弹出 |
| **弹窗可拖动** | 按住速览弹窗顶部标题栏（或左侧 ⠿）就能把弹窗拖到不挡地图的地方；位置按 token 记住，右上角 **⌖** 回到 token 上方 |
| **血量加减** | 弹窗里 `−1 / −5 / −10`、`＋1 / ＋5 / ＋10`，或填数字点「受伤 / 治疗」；临时生命 ±、回复力圆点、使用回复力 |
| **token 血条** | 第一次在弹窗里加减过血量后，token 上会自动画「当前 / 上限」血条（含临时生命），受伤 / 治疗立刻变（不需要像参考插件那样右键「添加血条组件」） |
| **资源追踪** | 威能 / 装备点一下变灰＝已用，再点恢复；行动点与里程碑并成一排加减；短休 / 长休一键恢复（专长只展示，不追踪） |
| **三 tab 面板** | 左上角 / 工具栏 / 右下角打开同一个面板：**速览 / 先攻 / 骰子**；tab 切换只切显示，不重载页面。左上角 4E 图标直接落在「先攻」 |
| **先攻加值联动** | 绑定角色卡时把卡里的「先攻」写进 token 元数据（如 +25）；先攻合计 = d20 + 加值 |
| **加入先攻** | GM 右键 token →「加入先攻」/「隐形加入先攻」（隐藏身份，只 GM 可见） |
| **回合推进** | 先攻 tab：当前回合高亮；GM 可上一回合 / 下一回合 / 重掷 / 上下移动 / 删除 / 清空；玩家可「结束我的回合」 |
| **骰子（占位）** | v1.3.0 只放 tab 与「即将推出」，v1.5.0 实现 4E 化骰子 |
| 全屏面板 | 右下角绿色 **4E** 按钮打开：拖拽 / 选择文件 / 粘贴导入导出 JSON，管理房间里的卡，一键绑到当前选中的 token |
| 同名覆盖 | 重新导入同名卡会就地更新（升级、改装备后重新导出即可），已绑定的 token 不丢 |

---

## 二、三步傻瓜部署

插件就是本目录的全部文件。部署 = 找一个能放静态文件的地方，然后把 `manifest.json` 的网址填进 Owlbear。

### 方案 A：GitHub 仓库 + jsDelivr 直链（最快，不用开 Pages）

1. 在 GitHub 新建一个仓库（public），把本目录下的**所有文件**上传到仓库根目录
   （要包含 `manifest.json`、`background.html`、`assets/`、`data/`、`vendor/`、`samples/`）。
2. 拼出 manifest 地址（把 `<用户名>`、`<仓库名>`、分支名换成你自己的）：

   ```text
   https://cdn.jsdelivr.net/gh/<用户名>/<仓库名>@main/manifest.json
   ```

   例：仓库 `FullPeople/4e-owlbear`，分支 `main` →
   `https://cdn.jsdelivr.net/gh/FullPeople/4e-owlbear@main/manifest.json`
3. 把这个地址填进 Owlbear（见第三节）。jsDelivr 首次访问会拉取并缓存，改完文件后等几分钟再刷新。

> 注意：jsDelivr 只认**公开仓库**，且单文件 20 MB 以内（本插件最大的文件是 `data/rules.js`，约 190 KB）。

### 方案 B：GitHub Pages（推荐，长期稳定）

1. 同上，把整个目录上传到仓库根目录。
2. 仓库 **Settings → Pages** → Source 选 `Deploy from a branch` → Branch 选 `main`、目录选 `/ (root)` → Save。
3. 等 1 分钟左右，页面顶部会给出站点地址，形如：

   ```text
   https://<用户名>.github.io/<仓库名>/
   ```

   那么 manifest 地址就是：

   ```text
   https://<用户名>.github.io/<仓库名>/manifest.json
   ```

   浏览器直接打开这个地址能看到一段 JSON 就说明部署成功。

> GitHub Pages 的项目页是**子路径**（`/仓库名/`）。如果某个 Owlbear 版本把 manifest 里的相对路径当成了站点根目录，
> 添加扩展时会报找不到 `background.html` —— 这时改成用方案 A 的 jsDelivr 地址，或用 `index.html` 里生成的**绝对地址 manifest**。

### 方案 C：任意静态托管

Netlify / Vercel / Cloudflare Pages / 自己的 nginx 都行：把目录原样放上去，manifest 地址 = 站点地址 + `manifest.json`。
要求只有一条：服务器返回的 `.js` 是 `text/javascript`（绝大多数托管默认如此），并且支持 HTTPS。

### 路径对不上怎么办（重要）

`manifest.json` 里的路径写的是**绝对地址**（v1.1.0 起）：

```json
{
  "name": "4eNEXT to owlbear",
  "version": "1.3.0",
  "manifest_version": 1,
  "author": "4E NEXT 玩家自制",
  "description": "4eNEXT to owlbear：速览 / 先攻 / 骰子（占位）……",
  "icon": "https://yzzj66.github.io/4e-obr-cards/icon.svg",
  "action": {
    "title": "4eNEXT to owlbear",
    "icon": "https://yzzj66.github.io/4e-obr-cards/icon.svg",
    "popover": "https://yzzj66.github.io/4e-obr-cards/panel.html?tab=init",
    "width": 980,
    "height": 720
  },
  "background_url": "https://yzzj66.github.io/4e-obr-cards/background.html"
}
```

**为什么改成绝对地址**：参考实现 `FullPeople/character-cards` 的 manifest 也是绝对路径，官方 Hello World 教程同样用 `/icon.svg`。
相对路径一旦被 Owlbear 按"站点根"解析（GitHub Pages 项目页是子路径 `/仓库名/`），`background.html` 就是 404 ——
表现是**扩展列表里有插件，但房间里没有按钮、也没有右键菜单**，而且不给任何提示。

如果换了托管地址（换仓库名 / 换域名 / 用 jsDelivr）：

1. 用浏览器打开**新地址**下的 `index.html`；
2. 顶部「自检」会告诉你 manifest 里的绝对地址是不是还指着旧站点；
3. 拉到「如果扩展加载失败」，把那里生成的**绝对地址版 manifest** 复制下来，覆盖托管上的 `manifest.json`；
4. 回 Owlbear **删掉扩展再重新添加**（Owlbear 会缓存 manifest）。

目录里另存了一份 `manifest.relative.json`（相对路径版），只在确认宿主能正确解析相对地址时用。

---

## 三、在 Owlbear Rodeo 里添加扩展

1. 打开 <https://www.owlbear.rodeo/extensions>（房间内也可以从右上角菜单进 **Extensions**）。
2. 点 **Add Extension**（或「+」），把上一节得到的 **manifest 地址**粘进去，确认。
3. 回到房间（v1.3.0 预期看到）：
   - 弹出一条 INFO 通知：`4eNEXT to owlbear v1.3.0 已加载：工具栏✓ · 右键✓ · 浮动按钮✓`（自诊断，可关）；
   - **左上角**扩展图标：点开完整面板并落在「先攻」tab（由 manifest 的 `action` 渲染，不依赖后台脚本）；
   - **左侧工具栏**的 4E 工具图标：点开完整面板（默认「速览」）；
   - **右下角**绿色 **4E** 浮动按钮：点开完整面板（默认「速览」）；
   - 右键地图上的图片 token（GM、单选），菜单里多出「**绑定 4E NEXT 角色卡**」「**加入先攻**」「**隐形加入先攻**」。

   > 只看到一部分入口？说明对应那一层没加载成功 —— 打开插件根目录的 `background.html` 能看到逐步日志，
   > 面板左下角也会显示「后台已连接 / 后台脚本没有响应」。对照表见 [`docs/owlbear-debug.md`](docs/owlbear-debug.md)。
   > 血条与资源追踪的细节（字段、权限、已知限制）见 [`docs/hp-bar-and-tracking.md`](docs/hp-bar-and-tracking.md)；
   > v1.2.1 的界面微调见 [`docs/ui-tweaks-v121.md`](docs/ui-tweaks-v121.md)；
   > 弹窗拖动的实现、参数与已知限制见 [`docs/popover-drag.md`](docs/popover-drag.md)。

> 扩展是**每个玩家各自安装**的：你装了，别人也得装一次才能看到速览面板；
> 但**卡片数据在房间数据里**，所以别人装好后不用再导入。

---

## 四、使用流程

1. **导出**：4E NEXT → 打开角色卡 →「导出存档（JSON）」→ 得到一个 `.json` 文件。
2. **导入**：Owlbear 里点右下角 **4E** → 面板左侧：
   - 把 `.json` 文件**拖进窗口**，或点「导入 JSON」选文件，或点「粘贴」把 JSON 全文贴进去；
   - 导入成功会提示「新增 X 张，更新 Y 张」。
3. **绑定**：在地图上**右键**某个 token →「绑定 4E NEXT 角色卡」→ 在弹窗里点选一张卡（可以搜索）。
4. **看速览**：**选中**这枚 token，速览面板从 token 上方弹出；按住弹窗顶部标题栏可以把它拖到不挡地图的位置，
   位置会按这枚 token 记住（右上角 **⌖** 回到 token 上方）；点右上角 **⤢** 打开完整面板。
   想解绑：右键 →「绑定」→ 点「解除绑定」。
5. **打起来**：在弹窗里点 `−5` 扣血 → token 上的血条立刻变短、数字跟着变；
   点威能 chip → 变灰加删除线（＝已用），再点恢复。打完了点「长休」一键还原。
6. **先攻**：右键 token →「加入先攻」（或「隐形加入先攻」）→ 面板「先攻」tab。
   加入时会自动掷 d20 + 角色卡的先攻加值；GM 用「上一回合 / 下一回合」推进，
   玩家轮到自己时点「结束我的回合」（请求发给城主客户端落笔）。

面板里还有：

- 左侧列表点名字切换预览；每行右侧 **✕** 删除这张卡（只删房间数据，不动 4E NEXT）；
- 选中一枚 token 后，预览区右上角可「绑定到「XXX」」——不用右键也能绑；
- 没有卡时可以点「载入示例」看看渲染效果。

---

## 五、数据存在哪

| 位置 | 键 | 内容 |
| --- | --- | --- |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/cards` | `{ v, updatedAt, cards: [{ id, name, level, char, importedAt, exportedAt }] }` |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/state/<cardId>` | `{ powerUsed, featUsed, equipmentUsed, itemDailyUsed, actionPoints, milestones, updatedAt }`（v1.2.0 的键名；v1.2.1 起界面只写 powerUsed / equipmentUsed / actionPoints / milestones） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/cardId` | 卡片 id（字符串） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/hp` | `{ cur, max, temp, surges, updatedAt }`（v1.2.0，每枚 token 独立） |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/init` | `{ bonus, cardId, updatedAt }`（v1.3.0：先攻加值，绑定角色卡时写入） |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/initiative` | `{ v, updatedAt, round, activeId, entries: [{ tokenId, name, init, bonus, hidden, ownerId, updatedAt }] }`（v1.3.0） |
| 浏览器 `localStorage` | `4enext/info-pos` | `{ v: 1, pos: { "<tokenId>": { left, top } } }`（v1.2.2：速览弹窗位置，按 token 记，最多 40 枚；只在本机） |

- 房间数据对**同房间所有人**可见（包括玩家），所以玩家装好扩展就能看到速览；写操作通常需要 GM。
- 卡片里的立绘（原图 / 裁切图）会被丢弃——速览用不到它，房间数据越小越稳。
- 卸载扩展不会删除房间数据；换房间需要重新导入。
- **血条本身不存数据**：后台页按 `hp` 元数据用 `OBR.scene.local`（本地图形层）画，
  每台机器各画一份 —— 不需要场景写权限，也不会进别人的场景导出。
- **v1.2.1 没有改键名**：`featUsed` / `itemDailyUsed` 仍留在数据里，旧状态照旧能读；
  只是界面不再产生这两类标记（长休会把它们清空）。

### 权限差异（v1.2.0，务必知道）

| 操作 | 谁能做 | 做不到时 |
| --- | --- | --- |
| 导入卡片 / 绑定 token | **城主**（房间数据权限） | 玩家点导入会提示保存失败 |
| 改某枚 token 的血量 | **城主**，或**这枚 token 的创建者**（Owlbear 的 item 权限） | 按钮还在，但点了会弹 ERROR 说明原因 |
| 标记威能 / 装备已用 | 优先写房间数据（通常只有城主）；失败则写**本机 localStorage** | 弹窗底部从「资源：全桌」变成「资源：本机」，并弹一条 WARNING |
| 加入先攻 / 隐形加入 / 推进回合 | **城主** | 玩家看得到先攻列表；「结束我的回合」会发给城主客户端，由城主代写 |
| 隐形条目 | **只有城主**能看见 | 非 GM 的客户端连名字都收不到（当前回合显示「？？？」） |

> 也就是说：**玩家自己标的「已用」不会同步给城主**（反过来，城主标的会同步给所有人）。
> 想全桌统一，让城主来标。实现细节见 [`docs/hp-bar-and-tracking.md`](docs/hp-bar-and-tracking.md)。

---

## 六、技术说明（为什么是「免构建」）

- **没有打包步骤**：所有页面都是普通 `.html` + `<script type="module">`，浏览器原生 ESM 直接跑。
- **SDK 本地化**：`vendor/obr-sdk.js` 是 `@owlbear-rodeo/sdk@3.1.0` 的 ESM 打包（由 esm.sh 生成、无外部 import）。放在本地，**断网也能加载**，不依赖 CDN。想换成 CDN 也可以，把 `assets/*.js` 里的 `../vendor/obr-sdk.js` 改成
  `https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm`——但那个地址还会去拉 `uuid`，离线不可用，**不推荐**。
- **规则数据离线化**：`data/rules.js` 是从 4E NEXT 的规则数据里裁出来的职业 / 种族 / 基础武器护甲 / 装备等级索引（约 190 KB），
  用来离线推导 HP、防御、技能、攻击等数值。生成脚本是 `dev/gen-rules.mjs`，成品已经提交，**跑插件不需要它**。
- **渲染层**：`assets/glance.js` 把导出的 `Character` 直接拼成 HTML 字符串（无框架、无虚拟 DOM）。
  带 `live` / `editable` 时才渲染成可点的按钮 —— 所以「弹窗」和「面板」用的是同一份渲染代码，语义不会分叉。
- **先攻**：`assets/initiative.js` 管数据模型 / 掷骰 / 回合推进 / 渲染；`glance.js` 的 `initiativeBonus()` 是唯一的加值口径，
  绑定角色卡时由 `common.js` 写进 token 元数据。右键菜单与玩家结束回合请求在 `background.core.js`（经典脚本，
  不能 import，所以那边只读元数据、不重算加值）。数据与权限见 [`docs/initiative-v13.md`](docs/initiative-v13.md)。
- **血量与资源追踪**：`assets/track.js` 是唯一的动作入口（`applyAction`）与读写层，
  语义照抄 4E NEXT 的速览页（`GlanceVitals.tsx` / `GlanceResources.tsx`）。
  页面里只挂一个 `[data-act]` 事件委托，点完重画。
- **token 血条**：画在 `assets/background.core.js` 里，用 `OBR.scene.local` 给 token 挂
  Curve + Text 子 item（`attachedTo`、`layer: "ATTACHMENT"`、固定 zIndex、关掉缩放继承）。
  做法照抄参考实现 `FullPeople/obr-suite` 的 `src/modules/bubbles/` 与 `src/modules/hpBar/`。
  为了能写 `buildCurve()` 这类调用，`dev/build-background.mjs` 会把 SDK 的**具名导出**
  （`buildCurve` / `buildShape` / `buildText`）一并接到 bundle 作用域 —— 仍然只有那一次构建。

### 文件结构

```text
manifest.json          扩展清单（Owlbear 加载的入口；绝对地址 + action 左上角入口）
manifest.relative.json 相对路径版清单（换宿主时备用，一般不用）
background.html        后台页：只有一个 <script>，并带页内自检日志
button.html            右下角 64×64 的 4E 浮动按钮
panel.html             全屏三 tab 面板：速览（导入 / 列表 / 预览 / 绑定）/ 先攻 / 骰子（占位）
info.html              选中 token 时弹出的速览小面板
bind.html              右键「绑定」打开的选卡弹窗
index.html             说明页（顶部自检 + 部署提示 + 示例渲染），托管根目录的落地页
icon.svg               扩展图标（清单 / action / 右键菜单都用它）
icon-tool.svg          左侧工具栏工具图标（24×24 线性图标）
assets/
  background.core.js   后台逻辑（可读版：右键菜单 / 工具栏 / 浮动按钮 / 速览弹窗定位与拖动 / token 血条 / 自诊断 / 心跳）
  background.bundle.js 后台实际加载的**单文件经典脚本**（SDK + core，由 dev/build-background.mjs 生成）
  background.js        旧缓存兼容垫片（把上面那个 bundle 注入进来，避免旧 background.html 变哑巴）
  panel.js / info.js / bind.js / button.js / index.js
  common.js            房间数据读写、导入解析、公共小工具、后台心跳探测
  track.js             血量（token 元数据）+ 资源状态（房间数据 / 本机）的语义与读写（v1.2.0）
  initiative.js        先攻数据模型 / 掷骰 / 回合推进 / 渲染 / 加值同步（v1.3.0）
  glance.js            速览推导 + HTML 渲染（核心；带 live/editable 时可交互）
  glance.css / ui.css  样式（glance.css 末尾是 v1.2.0 的交互层）
data/rules.js          离线规则索引（自动生成）
vendor/obr-sdk.js      @owlbear-rodeo/sdk 3.1.0（本地化，离线可用）
samples/sample-card.json  示例卡（30 级游侠，可删）
docs/owlbear-debug.md  排查记录：为什么没按钮、改了什么、怎么验证
docs/hp-bar-and-tracking.md  血条与资源追踪：字段、权限差异、实现取舍、已知限制（v1.2.0）
docs/ui-tweaks-v121.md  v1.2.1 的界面微调：弹窗尺寸、行动点/里程碑同排、去掉专长与每日威能追踪
docs/popover-drag.md    v1.2.2 弹窗拖动：实现方式、拖动区、可调参数、已知限制
docs/initiative-v13.md  v1.3.0 先攻：数据结构、权限、渲染、自测清单（新增）
dev/                   开发期工具（普通用户用不到）
```

### 数值口径

尽量对齐 4E NEXT 的 `web/src/overview/derive.ts`、`sheet/defense.ts`、`sheet/character.ts`：

- 属性 = 基础值 + 种族加值（`raceAbility2Choice` 生效）
- 生命上限 = 职业起始 HP + 体质 + 每级 HP ×（等级 − 1）+ 额外生命；混职两个职业相加后取整
- 防御 = 10 + ½等级 + 属性 + 职业 / 种族 / 护甲 / 盾牌 / 专长 / 自定义 + 魔法物品增强（按「增强：」指向）
- 技能 = ½等级 + 属性 + 受训 5 + 技能巧手 + 种族 + 自定义 − 护甲检定减值
- 攻击 = ½等级 + 属性 + 职业 + 擅长（职业 / 种族 / 专长 token）+ 专长 + 增强 + 自定义
- 伤害 = 属性 + 专长 + 增强 + 自定义，伤害骰取主手 / 副手基础武器

---

## 七、已知限制（请先读这一节）

1. **卡片本身仍然只读**：插件不改角色卡（威能选择 / 属性 / 装备都不动）。v1.2.0 只是**另外**记两份运行时状态：
   token 上的血量、房间数据里的「已用」标记。升级 / 换装备仍然要回 4E NEXT 重新导出导入（同名卡覆盖，绑定与血量都不丢）。
2. **数值是离线推导的**：依赖规则正文才能算出的加值（职业特性自动加值，如信仰甲胄、蛮族机敏、剑法防卫；部分专长的逐条效果）**没有还原**，因此防御 / 攻击等可能与 4E NEXT 差 1~2 点甚至更多。**以 4E NEXT 为准**，面板底部也写了这句提示。
3. **房间数据通常只有 GM 能写**：玩家装好扩展能看速览、能看血条，但导入卡片 / 绑定 token 需要 GM。
   标记「已用」时玩家会退化成**只记在自己这台机器上**（弹窗底部会写「资源：本机」）。
   改 token 血量需要是**城主**或**这枚 token 的创建者**，否则点了会弹 ERROR 说明原因。
   细节见 [`docs/hp-bar-and-tracking.md`](docs/hp-bar-and-tracking.md)。
4. **右键菜单只对 IMAGE token 出现**，且只在**单个**选中时出现（多选不显示）；非 GM 看不到这个菜单项。
5. **先攻首版是简单列表**：没有头像条、拖拽排序、横向先攻条与隐藏回合的镜头处理；只有名单 / 加值 / 合计 / 回合推进。
   玩家「结束我的回合」需要 **GM 客户端在线**（由 GM 的 background 落笔），GM 不在时请求不会生效。
   隐形加入只影响先攻列表，不隐藏地图上的 token。细节见 [`docs/initiative-v13.md`](docs/initiative-v13.md)。
6. **速览弹窗可以拖，但不跟地图**：默认仍弹在 token 上方；按住标题栏拖走后，位置按这枚 token 记在**本机**
   `localStorage`，平移 / 缩放地图不会跟着漂（避免每次拖动都闪一下）；点 ⌖ 回到 token 上方。
   拖动依赖「同一个 popover id 重新 open 只更新位置、不重载页面」这一行为，**尚未真机验证**；
   细节、可调参数与已知限制见 [`docs/popover-drag.md`](docs/popover-drag.md)。
7. **数据跟着房间走**：房间数据不跨房间、不跨账号同步；删除扩展不会清空数据（想清空可在面板里逐张删除）。
8. **没有做真机联调**：开发环境无法启动 Owlbear 房间，也无法截取真实界面，所以**没有在真实房间中测试过**。
   已做的检查是：JSON 合法、HTML 引用的文件都存在、ESM 语法与 import 路径可解析、示例卡的渲染结果标签配平、CSS 括号配平，
   外加 **manifest/bundle 静态检查** 与 **假 OBR 的后台冒烟测试**（v1.2.0 起还断言血条三件套真的被
   `scene.local.addItems` 加进去、改血后走 `updateItems`、被删会重建、数据没了会清理；
   v1.2.1 起再断言弹窗宽高、行动点/里程碑同排样式，以及专长与每日威能不再生成可点元素；
   v1.2.2 起再断言弹窗按左上角定位、拖动位移 / 视口夹取 / localStorage 记忆 / 回到 token；
   v1.3.0 起再断言改名 / 版本、三 tab、骰子占位、右键两项、init 键名一致，以及先攻的绑定 / 加入 / 权限分支）。
   **拖动的手感与「重开 popover 是否重载 iframe」没有真机验证**，真机若不对，先看 `docs/popover-drag.md` 的「已知限制」。
   **血条的像素级位置只在纸面上按参考实现的比例推过**，真机若偏了，改 `barLayout()` 里的常数即可。
   如果房间里加载不正常：先看 index.html 顶部「自检」、面板左下角的连接状态条，或直接打开 `background.html` 看逐步日志，
   都不行再把这三样截图贴出来（详见 `docs/owlbear-debug.md`）。
9. **SDK 版本**：使用的是 `@owlbear-rodeo/sdk@3.1.0`（与同作者插件 `character-cards` 相同）。Owlbear 若改动 API，需要更新 `vendor/obr-sdk.js`。
10. **专长只展示、不追踪（v1.2.1）**：4E NEXT 靠专长**正文**判断「每次遭遇 / 每日」，插件里没有专长正文，
   所以干脆不提供专长的「已用」标记（数据字段 `featUsed` 仍保留兼容），短休也因此只清遭遇威能。
11. **血条是本地图形**：不进场景导出、别的插件读不到；它跟着 `hp` 元数据走，换机器 / 重开页面会自动重画。

---

## 八、自测 / 二次开发

需要 Node 18+（只是开发期用，跑插件不需要）：

```bash
# 本地起静态服务器预览（默认 http://127.0.0.1:8123/）
node dev/serve.mjs

# 静态自检：JSON / HTML 引用 / import 路径 / manifest 绝对地址 + action /
#   bundle 无 import-export 且能按经典脚本解析 / bundle 与 core 是否同步 /
#   v1.2.0：track.js 存在、KEY_HP 两边一致、bundle 里接入了 buildCurve 等具名导出
#   v1.2.1：弹窗尺寸 620~680 × 640~760、行动点/里程碑同排样式、专长与每日威能不再可点
#   v1.2.2：弹窗位置键 / 拖动频道两边一致、LEFT/TOP 定位、视口夹取、info.js 指针事件、ui.css 光标
#   v1.3.0：名字 / 1.3.0、三 tab + 骰子占位、?tab=init、init / initiative / 请求频道键名一致、右键两项
node dev/check.mjs

# 后台冒烟测试：假 OBR 跑一遍 background.core.js，断言三个入口 + 通知 + 心跳
#   + v1.2.0 的 token 血条（addItems / updateItems / 自愈 / 清理）
#   + v1.2.2 的弹窗拖动（打开 → 位移 → 夹取 → localStorage → 重开 → 回到 token）
node dev/test-background.mjs

# 先攻 v1.3.0 自测：绑定写 init / 右键两项 / 加入先攻写房间数据 /
#   GM 推进 / 玩家结束回合权限 / 隐形对非 GM 不可见
node dev/test-initiative.mjs

# 血量 / 资源追踪的语义自测：逐条核对 4E NEXT 的规则
#   （先扣临时生命 / 负数先归零 / 回复力 / 已用标记 / 写不进去退本机）
node dev/test-track.mjs

# 改了 assets/background.core.js 之后重新生成 assets/background.bundle.js
node dev/build-background.mjs

# 渲染自检：用示例卡跑一遍推导，并检查渲染出的 HTML 标签配平与 CSS 括号
node dev/check-render.mjs

# 重新生成 data/rules.js（需要 4E NEXT 源码）
node dev/gen-rules.mjs

# 从本机 4E NEXT 存档重新生成示例卡
node dev/make-sample.mjs 1
```

> `dev/` 目录不参与运行，删掉也不影响插件。

---

## 九、许可与致谢

- 插件本体：可自由使用、修改、二次分发。
- `vendor/obr-sdk.js`：`@owlbear-rodeo/sdk`（MIT，Owlbear Rodeo 官方 SDK），由 esm.sh 打成的 ESM 单文件。
- 界面与数值口径参考了 4E NEXT（同作者的 4E 角色卡应用）与 `FullPeople/character-cards` 的结构。
- v1.2.0 的血条做法（子 item + `OBR.scene.local` + 烘焙已渲染尺寸）参考了 `FullPeople/obr-suite`
  的 `src/modules/bubbles/`、`src/modules/hpBar/`（GPL-3.0）。这里只借鉴其架构与 API 调用方式，
  代码是按本插件的「免构建 / 无框架」风格重写的；资源追踪的语义则照抄 4E NEXT 的速览页。
- 本项目与 Owlbear Rodeo、4E NEXT 均无隶属关系；角色卡数据只在你自己的房间和浏览器里流转。