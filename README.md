# 4E NEXT 角色卡 · Owlbear Rodeo 插件

在 [Owlbear Rodeo](https://www.owlbear.rodeo/)（枭熊）里查看 **4E NEXT** 导出的角色卡「速览」页。
核心是两件事：**右键 token 绑定角色卡**，以及**选中绑定的 token 就弹出速览**。

- 纯静态：HTML + 原生 JS + CSS，**不需要 npm、不需要构建**，扔到任何静态托管就能用。
- 零服务器：卡片存在 Owlbear 的**房间数据（room metadata）**里，全房间共享。
- 只读：插件不改卡，改角色仍然在 4E NEXT 里做。
- **三个入口**（左上角扩展图标 / 左侧工具栏 4E 工具 / 右下角浮动按钮）+ 右键菜单；前两个不依赖后台脚本，
  所以"哪个入口出现"本身就能用来判断插件哪一层没加载 —— 详见 [`docs/owlbear-debug.md`](docs/owlbear-debug.md)。

---

## 一、能做什么

| 功能 | 说明 |
| --- | --- |
| 速览面板 | 生命 / 血怒 / 回复值 / 回复力、AC 与三防、六属性、17 项技能、攻击与伤害、威能、专长、装备，外观贴近 4E NEXT 的速览页 |
| 右键绑定 | GM 右键地图上的 **IMAGE token** →「绑定 4E NEXT 角色卡」→ 选一张卡 |
| 选中即弹 | 任何人选中这枚 token，速览小面板就会从 token 上方弹出（只读） |
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

`manifest.json` 里的路径现在写的是**绝对地址**（v1.1.0 起）：

```json
{
  "name": "4E NEXT 角色卡",
  "version": "1.1.0",
  "manifest_version": 1,
  "author": "4E NEXT 玩家自制",
  "description": "在枭熊房间查看 4E NEXT 角色卡速览……",
  "icon": "https://yzzj66.github.io/4e-obr-cards/icon.svg",
  "action": {
    "title": "4E NEXT 角色卡",
    "icon": "https://yzzj66.github.io/4e-obr-cards/icon.svg",
    "popover": "https://yzzj66.github.io/4e-obr-cards/panel.html",
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
3. 回到房间（v1.1.0 预期看到）：
   - 弹出一条 INFO 通知：`4E 角色卡 v1.1.0 已加载：工具栏✓ · 右键✓ · 浮动按钮✓`（自诊断，可关）；
   - **左上角**扩展图标：点开完整面板（由 manifest 的 `action` 渲染，不依赖后台脚本）；
   - **左侧工具栏**的 4E 工具图标：点开完整面板；
   - **右下角**绿色 **4E** 浮动按钮：点开完整面板；
   - 右键地图上的图片 token（GM、单选），菜单里多出「**绑定 4E NEXT 角色卡**」。

   > 只看到一部分入口？说明对应那一层没加载成功 —— 打开插件根目录的 `background.html` 能看到逐步日志，
   > 面板左下角也会显示「后台已连接 / 后台脚本没有响应」。对照表见 [`docs/owlbear-debug.md`](docs/owlbear-debug.md)。

> 扩展是**每个玩家各自安装**的：你装了，别人也得装一次才能看到速览面板；
> 但**卡片数据在房间数据里**，所以别人装好后不用再导入。

---

## 四、使用流程

1. **导出**：4E NEXT → 打开角色卡 →「导出存档（JSON）」→ 得到一个 `.json` 文件。
2. **导入**：Owlbear 里点右下角 **4E** → 面板左侧：
   - 把 `.json` 文件**拖进窗口**，或点「导入 JSON」选文件，或点「粘贴」把 JSON 全文贴进去；
   - 导入成功会提示「新增 X 张，更新 Y 张」。
3. **绑定**：在地图上**右键**某个 token →「绑定 4E NEXT 角色卡」→ 在弹窗里点选一张卡（可以搜索）。
4. **看速览**：**选中**这枚 token，速览面板从 token 上方弹出；点右上角 **⤢** 打开完整面板。
   想解绑：右键 →「绑定」→ 点「解除绑定」。

面板里还有：

- 左侧列表点名字切换预览；每行右侧 **✕** 删除这张卡（只删房间数据，不动 4E NEXT）；
- 选中一枚 token 后，预览区右上角可「绑定到「XXX」」——不用右键也能绑；
- 没有卡时可以点「载入示例」看看渲染效果。

---

## 五、数据存在哪

| 位置 | 键 | 内容 |
| --- | --- | --- |
| 房间数据 `OBR.room.metadata` | `com.4enext-owlbear/cards` | `{ v, updatedAt, cards: [{ id, name, level, char, importedAt, exportedAt }] }` |
| Token 元数据 `item.metadata` | `com.4enext-owlbear/cardId` | 卡片 id（字符串） |

- 房间数据对**同房间所有人**可见（包括玩家），所以玩家装好扩展就能看到速览；写操作需要 GM。
- 卡片里的立绘（原图 / 裁切图）会被丢弃——速览用不到它，房间数据越小越稳。
- 卸载扩展不会删除房间数据；换房间需要重新导入。

---

## 六、技术说明（为什么是「免构建」）

- **没有打包步骤**：所有页面都是普通 `.html` + `<script type="module">`，浏览器原生 ESM 直接跑。
- **SDK 本地化**：`vendor/obr-sdk.js` 是 `@owlbear-rodeo/sdk@3.1.0` 的 ESM 打包（由 esm.sh 生成、无外部 import）。放在本地，**断网也能加载**，不依赖 CDN。想换成 CDN 也可以，把 `assets/*.js` 里的 `../vendor/obr-sdk.js` 改成
  `https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm`——但那个地址还会去拉 `uuid`，离线不可用，**不推荐**。
- **规则数据离线化**：`data/rules.js` 是从 4E NEXT 的规则数据里裁出来的职业 / 种族 / 基础武器护甲 / 装备等级索引（约 190 KB），
  用来离线推导 HP、防御、技能、攻击等数值。生成脚本是 `dev/gen-rules.mjs`，成品已经提交，**跑插件不需要它**。
- **渲染层**：`assets/glance.js` 把导出的 `Character` 直接拼成 HTML 字符串（无框架、无虚拟 DOM）。

### 文件结构

```text
manifest.json          扩展清单（Owlbear 加载的入口；绝对地址 + action 左上角入口）
manifest.relative.json 相对路径版清单（换宿主时备用，一般不用）
background.html        后台页：只有一个 <script>，并带页内自检日志
button.html            右下角 64×64 的 4E 浮动按钮
panel.html             全屏面板：导入 / 列表 / 预览 / 绑定（也是左上角 action 的弹窗页）
info.html              选中 token 时弹出的速览小面板
bind.html              右键「绑定」打开的选卡弹窗
index.html             说明页（顶部自检 + 部署提示 + 示例渲染），托管根目录的落地页
icon.svg               扩展图标（清单 / action / 右键菜单都用它）
icon-tool.svg          左侧工具栏工具图标（24×24 线性图标）
assets/
  background.core.js   后台逻辑（可读版：右键菜单 / 工具栏 / 浮动按钮 / 自诊断 / 心跳）
  background.bundle.js 后台实际加载的**单文件经典脚本**（SDK + core，由 dev/build-background.mjs 生成）
  background.js        旧缓存兼容垫片（把上面那个 bundle 注入进来，避免旧 background.html 变哑巴）
  panel.js / info.js / bind.js / button.js / index.js
  common.js            房间数据读写、导入解析、公共小工具、后台心跳探测
  glance.js            速览推导 + HTML 渲染（核心）
  glance.css / ui.css  样式
data/rules.js          离线规则索引（自动生成）
vendor/obr-sdk.js      @owlbear-rodeo/sdk 3.1.0（本地化，离线可用）
samples/sample-card.json  示例卡（30 级游侠，可删）
docs/owlbear-debug.md  排查记录：为什么没按钮、改了什么、怎么验证
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

1. **只读、快照**：面板不能扣血、不能标威能。血量是**导出那一刻**的值；角色受伤 / 升级后要在 4E NEXT 重新导出、再导入（同名卡会覆盖，绑定不丢）。
2. **数值是离线推导的**：依赖规则正文才能算出的加值（职业特性自动加值，如信仰甲胄、蛮族机敏、剑法防卫；部分专长的逐条效果）**没有还原**，因此防御 / 攻击等可能与 4E NEXT 差 1~2 点甚至更多。**以 4E NEXT 为准**，面板底部也写了这句提示。
3. **房间数据只有 GM 能写**：玩家装好扩展能看速览，但导入卡片 / 绑定 token 需要 GM 操作。玩家点导入会提示保存失败。
4. **右键菜单只对 IMAGE token 出现**，且只在**单个**选中时出现（多选不显示）；非 GM 看不到这个菜单项。
5. **速览弹窗定位一次**：面板打开时锚在 token 上方，之后你平移地图它不会跟着漂（避免每次拖动都闪一下）；重新选中 token 会重新定位。
6. **数据跟着房间走**：房间数据不跨房间、不跨账号同步；删除扩展不会清空数据（想清空可在面板里逐张删除）。
7. **没有做真机联调**：开发环境无法启动 Owlbear 房间，也无法截取真实界面，所以**没有在真实房间中测试过**。
   已做的检查是：JSON 合法、HTML 引用的文件都存在、ESM 语法与 import 路径可解析、示例卡的渲染结果标签配平、CSS 括号配平，
   外加 v1.1.0 的 **manifest/bundle 静态检查** 与 **假 OBR 的后台冒烟测试**。
   如果房间里加载不正常：先看 index.html 顶部「自检」、面板左下角的连接状态条，或直接打开 `background.html` 看逐步日志，
   都不行再把这三样截图贴出来（详见 `docs/owlbear-debug.md`）。
8. **SDK 版本**：使用的是 `@owlbear-rodeo/sdk@3.1.0`（与同作者插件 `character-cards` 相同）。Owlbear 若改动 API，需要更新 `vendor/obr-sdk.js`。

---

## 八、自测 / 二次开发

需要 Node 18+（只是开发期用，跑插件不需要）：

```bash
# 本地起静态服务器预览（默认 http://127.0.0.1:8123/）
node dev/serve.mjs

# 静态自检：JSON / HTML 引用 / import 路径 / manifest 绝对地址 + action /
#   bundle 无 import-export 且能按经典脚本解析 / bundle 与 core 是否同步
node dev/check.mjs

# 后台冒烟测试：假 OBR 跑一遍 background.core.js，断言三个入口 + 通知 + 心跳
node dev/test-background.mjs

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
- 本项目与 Owlbear Rodeo、4E NEXT 均无隶属关系；角色卡数据只在你自己的房间和浏览器里流转。
