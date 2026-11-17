// 一条命令跑完 v1.6.1 的五条自测：node dev/selftest.mjs
// ---------------------------------------------------------------------------
// 顺序固定：静态自检 → 后台冒烟 → 先攻 → 资源追踪 → 骰子。
// v1.3.1 的断言分别落在 check（无三 tab / 三个独立页面 / 入口按钮 / 视口夹紧 / 滚动容器 /
// 离线置灰）与 test-background（三个工具栏入口各开自己的窗口、拖动 / 位置记忆 / 视口夹紧）。
// v1.3.2 再补：工具栏五个入口（速览 / 设置 + 两个新图标）、设置窗口注册进 WINS、
// 设置页六栏与版本来源、「重置本机设置」的边界（只清白名单内的本机键，不碰房间 / token 数据）。
// v1.4.0 再补：先攻条（尺寸 / 三档高度 / 卡片 CSS / 五个控制按钮 / popover CENTER/TOP + top 45）、
// 先攻数据层（d20 / tb / phase / 上限 60 / 降级 / 旧数据兼容 / 拖拽中点法 / 四道权限校验）。
// v1.5.0 再补：骰子（表达式解析 / 掷骰 / 重击=伤害骰取满 / 战斗优势+2 / 载荷归一化 / 合并去重 40 条 /
// 4E 预设只读 glance / 频道与上限两端一致 / 760×620 窗口）。
// v1.6.0 再补：血条扩展（临时生命 +N / 蓝色回复力条 / 四防盾）+ Boss 方案 A（环形 / 名牌 / 分段 / 锁，
// 压制普通 HP 条）+ 独立开关键 hp-bar/enabled（关闭写 false 不 delete）+ 右键 4 项 + 玩家端量化。
// v1.6.1 再补：四防从四角改**一排**（强韧 / 反射 / 意志 从左到右 + AC 最右半透明白，整排在 HP 条上方；
// 窄 token 优先保留 AC）；只动四防摆位与样式，HP 文本 / 蓝条 / 环 / Boss / 锁的数值与位置不变。
// v1.6.2 再补：① 速览弹窗删掉 HP 绿条下面那条**彩色四防箭头条**（.gl4-def-row / data-act="defense"），
// 四防数值仍看下面四张数值卡（.gl4-defs）；token 上的四防一排不动。
// ② 先攻条**宽高改常量**（120×40 / 720×(129|139|159)）：页面不再量控制行、后台 snapStripSize() 兜底，
// 投骰 / 内容变化后 popover 的 width/height 不再变（check 断言「无 measureWidth / 无 scrollWidth 测量」，
// test-initiative 断言「尺寸不随内容变」）。
// v1.7.0 再补：① 骰子记录搬进**独立可拖动窗口**（dice-history.html，自己的 popover id、默认最近 4 条、
// 与骰子窗口各自开关、40 条封顶删最旧）；② **投骰动画**（effect.html + 纯 CSS 关键帧，布局 / 时间轴公式在
// dice-core.js 的 fx*；modal 参数 fullScreen + hideBackdrop + hidePaper + disablePointerEvents；可开关、可降级）；
// ③ 去掉「豁免」「先攻」两个 4E 预设（先攻条自带投先攻）。
// v1.7.1 再补：投骰动画**整页完全透明**（v1.7.0 只透明了 body，ui.css 的 html{background:var(--bg)}
// 仍是深色 → 全屏 modal 把地图整块盖住）；现在连 html 一起 transparent，并给关闭加了三级：
// 播完 2600 ms → 兜底 3000 ms（FX_CLOSE_FALLBACK_MS）→ ESC / 点击任意处立即关。
// check 断言「无深色纯色 background / 有兜底 close」，test-dice 断言「播完 modal.close / 兜底 close / ESC 立即关」。
// v1.7.2 再补：**血条组件编辑小窗**（hp-edit.html + assets/hp-edit-page.js + assets/hp-edit-core.js）——
// 右键「添加血条组件」改成「写开关 + 打开 340×150 编辑窗」，窗里填生命（20 / 20/20 / +5 / -3 / 15+5）、
// 四防（AC / 强韧 / 反射 / 意志，留空 = 不画那枚盾）与回复力（3/3），保存写 token metadata
// com.4enext-owlbear/hp；权限 = 城主 or token 创建者，写失败 ERROR 通知；编辑窗 ↔ 后台用
// target / ready / saved 三个频道（规格 §2.2 的版本租约简化版）。
// 为了保持「5 条独立进程」，hp-edit 的断言**并进 dev/test-background.mjs**（check 断言静态接线）。
// v1.7.3 再补：先攻的三件事 + 一条样式 ——
//   ① 右键菜单动态互斥（已在先攻里只显示「移出先攻」；ContextMenuIconFilter 没有 none，
//      所以靠 token 元数据 in-init 镜像 + filter 的 metadata 条件，见 background.core.js 5.1）；
//   ② token 被删除 → 条目自动清理 + 游标顺移（「见过 → 消失」才算删除，切场景不清名单），
//      先攻条卡片上 GM 还有 ✕ 直接移出；
//   ③ 先攻条外壳透明（html / .strip / .strip-items 透明，卡片仍不透明，控制行半透明）+
//      常驻（进入房间按 4enext/strip-autostart 自动开、disableClickAway、「✕」记会话级关闭）。
// test-initiative 断言行为（菜单 filter / 移出 / 清理 / 自动显示三态），check 断言静态接线与 CSS。
// v1.7.6 再补：① **删掉 12 处提示 / 状态小字**（骰子窗口副标题 / 表达式 / 组合 / 预设区、「防御参考」整行、
// 「投骰动画：开」、顶部「后台已连接 …」条、速览的 token 副标题 / 技能 / 威能 / 专长说明）—— 错误提示一律保留；
// check 断言这 12 条在运行代码里都不存在（先剥注释），且 #bg-strip 默认 hidden、只在 bad 时出现；
// ② **记录窗口改成按钮直接 popover.open**（不再等后台回执）+ getWidth 复核 + 按钮变「关闭记录窗口」+
// 失败 ERROR 通知 + 后台 force-open / adopt；test-dice 断言整条链路（含 open 抛错）；
// ③ **先攻条外壳真透明**（#app / .win / .win-body / .strip-root 也 transparent !important），check 与
// dev/check-render.mjs 都断言；④ **四防重排**：四枚统一 30s、字号 15s、铺满 token 并均分，
// test-background 断言「左缘 4 / 右缘 146 / 间距相等 / 退化不变」。
// v1.7.11 再补：先攻条**回退 popover**（v1.7.10 的 modal + disablePointerEvents 会让整条不可交互）——
// check 断言 stripPopoverOptions（POSITION + CENTER/TOP + hidePaper + disableClickAway）且没有 stripModalOptions；
// test-initiative 断言「先攻条打开时右键『加入先攻』→ entries 增加」、拖动重开同一个 popover、✕ 走 popover.close；
// test-background 断言拖动夹紧 / 回中重开 / ✕ 关掉 popover。
// v1.7.12 再补：速览资源追踪 —— 四组威能（遭遇 / 每日 / 辅助 / 种族职业）每个 chip 都带 data-act="power"、
// 每行装备都带 data-act="equipment"、默认全未用 + 计数 0 / N；「玩家端隐藏数字」改名「共享数据」并挪到顶部标题区
// （开 = 共享 = 显示精确数字）。行为断言在 dev/test-track.mjs，渲染断言在 dev/test-glance.mjs（单跑），
// check 里做静态接线 + 版本 + 文档断言。
// v1.7.13 再补：速览「威能 / 装备点不动」回归 —— check 静态扫描 pointer-events（速览页不得有 none）、
// info.js 的委托必须在 document 捕获阶段、info 入口与 glance/track 模块带 ?v=<版本>；
// check 末尾 spawn dev/test-info-click.mjs（假 DOM + 真 info.js，dispatchEvent(new MouseEvent("click"))
// → 断言 track.js 写入 powerUsed / equipmentUsed）。**selftest 仍是 5 条命令**，点击冒烟并进 check。
// 每条都是独立进程（stdio 直接继承，不经管道，避免某些环境禁止子进程管道）。
// 任何一条非 0 就整体返回 1，并在最后打印汇总表。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEPS = [
  "dev/check.mjs",
  "dev/test-background.mjs",
  "dev/test-initiative.mjs",
  "dev/test-track.mjs",
  "dev/test-dice.mjs",
  "dev/test-geometry.mjs",
  /* v1.8.0：4E NEXT 导入（单角色导出 / 导出全部数据备份）+ 真实卡数值回归。 */
  "dev/test-import.mjs",
  /* v1.8.0：速览对齐 4E NEXT（动作类型标签 / 专长每日 / 装备等级 / 临时值 / 短休）。 */
  "dev/test-glance2.mjs",
  /* v2.3.7：传送门核心（纯函数几何 / 墙避让 / 多选 / 抑制 / 权限）。 */
  "dev/test-portal.mjs",
  /* v2.3.7：assets/*.js 逐个按 ESM 解析（抓重复声明 / 语法错误，防编辑窗白屏回归）。 */
  "dev/check-syntax.mjs"
];

const results = [];
let failed = 0;

for (const step of STEPS) {
  console.log("\n=== node " + step + " ===");
  const r = spawnSync(process.execPath, [path.join(ROOT, step)], { cwd: ROOT, stdio: "inherit" });
  const code = typeof r.status === "number" ? r.status : 1;
  results.push([step, code]);
  if (code !== 0) failed++;
}

console.log("\n=== 自测汇总 ===");
for (const [step, code] of results) {
  console.log((code === 0 ? "  ok   " : "  FAIL ") + step + "（exit " + code + "）");
}
console.log(failed ? failed + " 条自测失败" : "全部通过（" + STEPS.length + "/" + STEPS.length + "，exit 0）");
process.exit(failed ? 1 : 0);
