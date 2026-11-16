// v2.1.0：传送门核心离线自测（node dev/test-portal.mjs）
// ---------------------------------------------------------------------------
// 直接加载 **assets/background.core.js 的真实源码**（vm + 浏览器外壳桩，不启动 boot），
// 从 window.__4ePortal 拿纯函数，断言：
//   ① 门 metadata 归一化 / item 构造参数（ATTACHMENT + locked + disableHit + KEY_PORTAL）
//   ② 同 tag 目的地列表
//   ③ 六边形螺旋落点不重叠
//   ④ 原生 WALL 线段避让（落点距离 ≥ token 半径 + 8）
//   ⑤ 多选 token 落点数量 / 互不重叠
//   ⑥ 700ms 传送抑制
//   ⑦ GM 才能建门 / 编辑
//   ⑧ 工具注册 / 预览 / 编辑窗静态接线
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "assets", "background.core.js");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const win = {
  addEventListener() {},
  visualViewport: null
};
const sandbox = {
  window: win,
  document: {
    baseURI: "https://example.invalid/4e-obr/",
    getElementById: () => null,
    createElement: () => ({ style: {}, className: "", textContent: "", appendChild() {} }),
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: "https://example.invalid/4e-obr/background.html" },
  navigator: { userAgent: "node" },
  OBR: { onReady() {}, isAvailable: false },
  URL,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};
vm.createContext(sandbox);
const coreSrc = fs.readFileSync(CORE, "utf8");
const svgV210 = fs.readFileSync(path.join(ROOT, "assets", "portal.svg"), "utf8");
const portalItemSrc = coreSrc.slice(coreSrc.indexOf("async function portalImageItem("), coreSrc.indexOf("async function portalPreviewStart("));
try {
  vm.runInContext(coreSrc, sandbox, { filename: "assets/background.core.js" });
} catch (e) {
  console.log("  FAIL background.core.js 在 vm 里加载失败：" + (e && e.message));
  process.exit(1);
}
const P = sandbox.window && sandbox.window.__4ePortal;
if (!P || typeof P.portalMeta !== "function") {
  console.log("  FAIL 没有 window.__4ePortal 调试钩子（传送门纯函数取不到）");
  process.exit(1);
}
ok("从真实源码拿到 window.__4ePortal（portalMeta / 螺旋 / 墙避让 / 抑制）");

/* ---- ① metadata 归一化 + item 构造参数 ---- */
{
  const m = P.portalMeta({ name: "  北门  ", tag: "  城北  ", radius: 2, showName: false, visible: false });
  if (m.name === "北门" && m.tag === "城北" && m.radius === 16 && m.showName === false && m.visible === false && m.locked === true)
    ok("① portalMeta：名称/标签 trim、半径 clamp ≥16、showName/visible/locked 缺省与 false 正确");
  else bad("① portalMeta 归一化不对：" + JSON.stringify(m));
  if (coreSrc.indexOf('var KEY_PORTAL = NS + "/portal";') >= 0 &&
    portalItemSrc.indexOf('.layer("PROP")') >= 0 && portalItemSrc.indexOf('.name("传送门")') >= 0 &&
    portalItemSrc.indexOf(".locked(true)") >= 0 && portalItemSrc.indexOf(".disableHit(true)") < 0 &&
    /\[KEY_PORTAL\]: portalMeta\(meta\)/.test(coreSrc) &&
    /async function portalPreviewStart\(/.test(coreSrc) && /async function portalPreviewUpdate\(/.test(coreSrc) &&
    /async function portalPreviewClear\(/.test(coreSrc) && /async function portalCreate\(/.test(coreSrc) &&
    coreSrc.indexOf("portalSceneDpi()") >= 0 && coreSrc.indexOf("portalScaleFor(radius, dpi)") >= 0)
    ok("① 传送门 item：layer=PROP + name + locked（无 disableHit）+ metadata[KEY_PORTAL]；预览/创建/scale 换算齐全");
  else bad("① 传送门 item 构造 / 预览 / 创建静态接线不完整");
  if (Math.abs(P.portalScaleFor(70, 150) - (2 * 70) / 150) < 1e-9 &&
    Math.abs(P.portalScaleFor(16, 100) - 0.32) < 1e-9)
    ok("① 尺寸换算：scale = 2r / sceneDpi（r=70 dpi=150 → " + P.portalScaleFor(70, 150).toFixed(4) + "；r=16 dpi=100 → 0.32）");
  else bad("① 尺寸换算不对：scale(70,150)=" + P.portalScaleFor(70, 150));
  if (svgV210.indexOf("<rect") < 0 && svgV210.indexOf('fill-opacity="0.32"') >= 0 &&
    svgV210.indexOf("stop-opacity=\"0.22\"") >= 0)
    ok("① portal.svg 中心半透明（core fill-opacity 0.32、无 rect / 不透明底）");
  else bad("① portal.svg 仍是黑盘 / 有矩形底");
}

/* ---- ①b 工具对齐 Full Suite：GM-only / tool→mode / activateMode / 双路径（v2.1.0 真机 bug 回归） ---- */
{
  const order = [];
  let toolDef = null, modeDef = null, role = "GM", notified = 0;
  let activeModeCalls = 0, activateToolCalls = 0;
  sandbox.OBR = {
    player: { getRole: async () => role },
    tool: {
      create: async (def) => { order.push("tool"); toolDef = def; },
      remove: async () => {},
      createMode: async (def) => { order.push("mode"); modeDef = def; },
      removeMode: async () => {},
      activateTool: async () => { activateToolCalls++; order.push("activateTool"); },
      getActiveTool: async () => P.CONSTANTS.TOOL_PORTAL_ID,
      getActiveToolMode: async () => P.CONSTANTS.TOOL_PORTAL_MODE_ID,
      activateMode: async (toolId, modeId) => {
        order.push("activateMode");
        if (toolId === P.CONSTANTS.TOOL_PORTAL_ID && modeId === P.CONSTANTS.TOOL_PORTAL_MODE_ID) activeModeCalls++;
      }
    },
    notification: { show: () => { notified++; return Promise.resolve(); } }
  };
  await P.registerPortalTool();
  if (order.indexOf("tool") >= 0 && order.indexOf("mode") >= 0 && order.indexOf("tool") < order.indexOf("mode"))
    ok("①b 注册顺序：**先 create tool 再 createMode**（mode 依赖 tool）");
  else bad("①b 注册顺序不对：" + JSON.stringify(order));
  if (toolDef && toolDef.defaultMode === P.CONSTANTS.TOOL_PORTAL_MODE_ID &&
    toolDef.icons[0].filter && toolDef.icons[0].filter.roles && toolDef.icons[0].filter.roles[0] === "GM" &&
    toolDef.icons[0].label)
    ok("①b tool：defaultMode 正确、icon filter.roles=[GM]、label 非空");
  else bad("①b tool 定义不对：" + JSON.stringify(toolDef));
  if (modeDef && !("preventDrag" in modeDef) &&
    modeDef.icons[0].filter && modeDef.icons[0].filter.activeTools &&
    modeDef.icons[0].filter.activeTools[0] === P.CONSTANTS.TOOL_PORTAL_ID &&
    modeDef.cursors[0].cursor === "crosshair" &&
    typeof modeDef.onToolDragStart === "function" && typeof modeDef.onToolDragMove === "function" &&
    typeof modeDef.onToolDragEnd === "function" && typeof modeDef.onToolDragCancel === "function" &&
    typeof modeDef.onDeactivate === "function" &&
    typeof modeDef.onToolDown === "function" && typeof modeDef.onToolMove === "function" && typeof modeDef.onToolUp === "function")
    ok("①b mode：无 preventDrag、icon filter.activeTools、crosshair、drag + down/move/up 双路径齐全");
  else bad("①b mode 定义不对：" + JSON.stringify(modeDef));
  if (activeModeCalls === 1 && order.indexOf("activateMode") > order.indexOf("mode"))
    ok("①b createMode 后 active tool 是传送门 → activateMode(TOOL_PORTAL_ID, TOOL_PORTAL_MODE_ID)");
  else bad("①b 注册后没有 activateMode 兜底：" + JSON.stringify({ activeModeCalls, order }));
  const gmRet = await toolDef.onClick();
  if (gmRet === false && activateToolCalls === 1)
    ok("①b GM 点击：先 activateTool(TOOL_ID) 再 return false（Full Suite 同款，不重复 SDK 激活）");
  else bad("①b GM 点击处理不对：" + JSON.stringify({ gmRet, activateToolCalls }));
  await new Promise((r) => setTimeout(r, 400));
  if (activeModeCalls === 2)
    ok("①b GM 点击后 80ms 兜底再 activateMode 一次（mode id 与 defaultMode 一致）");
  else bad("①b GM 点击后没有兜底 activateMode：" + activeModeCalls);
  if (coreSrc.indexOf("传送门 dragStart p=") >= 0 && coreSrc.indexOf("传送门 dragMove r=") >= 0 &&
    coreSrc.indexOf("传送门 dragEnd r=") >= 0 && coreSrc.indexOf("preview add ok") >= 0 &&
    coreSrc.indexOf("preview update ok") >= 0 && coreSrc.indexOf("preview remove ok") >= 0)
    ok("①b 诊断日志：dragStart/dragMove/dragEnd/preview add·update·remove 都存在");
  else bad("①b drag/preview 诊断日志不完整");
  /* 非 GM：完全不注册 tool / mode */
  const orderPlayer = [];
  sandbox.OBR = {
    player: { getRole: async () => "PLAYER" },
    tool: {
      create: async () => { orderPlayer.push("tool"); },
      remove: async () => {},
      createMode: async () => { orderPlayer.push("mode"); },
      removeMode: async () => {}
    }
  };
  await P.registerPortalTool();
  if (!orderPlayer.length)
    ok("①b 非 GM：不注册传送门 tool / mode（Full Suite 同款 GM-only）");
  else bad("①b 非 GM 也注册了传送门工具：" + JSON.stringify(orderPlayer));
}

/* ---- ①c GM 选中门自动打开编辑窗（空选中保持 / 切换 / 用户关闭后可重开） ---- */
{
  const mkPortal = (id) => ({
    id: id, type: "IMAGE", position: { x: 0, y: 0 }, width: 40, height: 40, scale: { x: 1, y: 1 },
    metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: id, tag: "城", radius: 70 } }
  });
  const plainItem = { id: "t-plain", type: "IMAGE", position: { x: 0, y: 0 }, width: 40, height: 40, metadata: {} };
  const portalsById = { "p-edit": mkPortal("p-edit"), "p-edit2": mkPortal("p-edit2") };
  let selection = ["p-edit"];
  let opens = 0, closes = 0, urls = [];
  sandbox.OBR = {
    player: {
      getRole: async () => "GM",
      getSelection: async () => selection.slice(),
      onChange: (cb) => { sandbox.OBR.player._cb = cb; }
    },
    scene: { items: { getItems: async (ids) => ids && portalsById[ids[0]] ? [portalsById[ids[0]]] : [plainItem] } },
    popover: {
      open: async (opt) => { opens++; urls.push(opt.url); },
      close: async () => { closes++; }
    }
  };
  await P.syncPortalEditFromSelection();
  if (opens === 1 && String(urls[0]).indexOf("portal-edit.html?item=p-edit") >= 0)
    ok("①c GM 选中单枚传送门 → 自动打开编辑窗（portal-edit.html?item=…）");
  else bad("①c 选中门没有自动开编辑窗：" + JSON.stringify({ opens, urls }));
  await P.syncPortalEditFromSelection();
  if (opens === 1)
    ok("①c 同一枚门重复触发 selection → 不重复打开（同 id 去重）");
  else bad("①c 同一门被重复打开：" + opens);
  selection = [];
  await P.syncPortalEditFromSelection();
  if (opens === 1 && closes === 0)
    ok("①c 打开 popover 后选区变空 → **保持编辑窗**（不再误关）");
  else bad("①c 空选中仍关窗：" + JSON.stringify({ opens, closes }));
  selection = ["t-plain"];
  await P.syncPortalEditFromSelection();
  if (closes === 0)
    ok("①c 选中单枚非门 → 保持编辑窗（不挡用户）");
  else bad("①c 选中非门仍关窗：" + closes);
  selection = ["p-edit2"];
  await P.syncPortalEditFromSelection();
  if (closes === 1 && opens === 2 && String(urls[1]).indexOf("item=p-edit2") >= 0)
    ok("①c 选中另一枚门 → 关闭旧窗 + 打开新 target（编辑窗切换）");
  else bad("①c 切换另一门失败：" + JSON.stringify({ opens, closes, urls }));
  await P.onPortalEditClosed({ data: { closedByUser: true } });
  if (closes === 2)
    ok("①c 用户关闭编辑窗 → 记录清空（closedByUser 频道）");
  else bad("①c 用户关闭没有处理：" + closes);
  selection = ["p-edit"];
  await P.syncPortalEditFromSelection();
  if (opens === 3)
    ok("①c 用户关闭后再次选中同一门 → 能重新打开");
  else bad("①c 用户关闭后同一门无法重开：" + opens);
  if (coreSrc.indexOf("portalEdit: { id: ID_PORTAL_EDIT") >= 0 &&
    coreSrc.indexOf('await openWin("portalEdit"') >= 0 &&
    fs.readFileSync(path.join(ROOT, "portal-edit.html"), "utf8").indexOf('class="win-head"') >= 0 &&
    fs.readFileSync(path.join(ROOT, "assets", "portal-page.js"), "utf8").indexOf("createWindow({ name: \"portalEdit\"") >= 0 &&
    fs.readFileSync(path.join(ROOT, "assets", "portal-page.js"), "utf8").indexOf("closedByUser: true") >= 0)
    ok("①c 编辑窗已接进窗口框架：WINS.portalEdit / openWin(\"portalEdit\") / 页面 createWindow({name:\"portalEdit\"}) / closedByUser 仍在");
  else bad("①c 编辑窗没有接进窗口框架");
  if (coreSrc.indexOf("传送门 编辑窗保持（选中 0 项）") >= 0 &&
    coreSrc.indexOf("传送门 编辑窗切换 ") >= 0 &&
    coreSrc.indexOf("传送门 编辑窗关闭（用户关闭）") >= 0)
    ok("①c 日志：空选中保持 / 切换 / 用户关闭 三条齐全");
  else bad("①c 编辑窗日志不完整");
}

/* ---- ①d 预览残留清理 / 同一手势只创建一次门 ---- */
{
  const TAG = P.CONSTANTS.PORTAL_PREVIEW_TAG;
  const previewItem = { id: "pv-1", metadata: { [TAG]: true } };
  const keepItem = { id: "keep-1", metadata: {} };
  let deleted = [];
  sandbox.OBR = {
    scene: { local: {
      getItems: async () => [previewItem, keepItem, { id: "pv-2", metadata: { [TAG]: true } }],
      deleteItems: async (ids) => { deleted = deleted.concat(ids); }
    } }
  };
  const n = await P.portalClearPreviewResidue("test");
  if (n === 2 && deleted.length === 2 && deleted.indexOf("pv-1") >= 0 && deleted.indexOf("pv-2") >= 0 && deleted.indexOf("keep-1") < 0)
    ok("①d 启动/预览前清扫：按 PORTAL_PREVIEW_TAG 删除 2 个残留 local 项（不碰普通项）");
  else bad("①d 预览残留清扫不对：" + JSON.stringify({ n, deleted }));

  let addCount = 0;
  let buildSeq = 0;
  const mkItem = () => ({ id: "built-" + (++buildSeq), metadata: {}, position: { x: 0, y: 0 } });
  const builder = {
    position() { return this; }, scale() { return this; }, layer() { return this; }, name() { return this; },
    locked() { return this; }, visible() { return this; }, metadata() { return this; }, build() { return mkItem(); }
  };
  sandbox.buildImage = () => builder;
  let localItems = [];
  sandbox.OBR = {
    player: { getRole: async () => "GM" },
    scene: {
      grid: { getDpi: async () => 150 },
      local: {
        getItems: async () => localItems.slice(),
        addItems: async (items) => { localItems = localItems.concat(items); },
        deleteItems: async (ids) => { localItems = localItems.filter((it) => ids.indexOf(it.id) < 0); }
      },
      items: { addItems: async () => { addCount++; } }
    }
  };
  await P.portalDragBegin({ pointerPosition: { x: 0, y: 0 } });
  await P.portalDragFinish({ pointerPosition: { x: 100, y: 0 } });
  await P.portalDragFinish({ pointerPosition: { x: 100, y: 0 } });
  if (addCount === 1)
    ok("①d 同一手势 dragEnd + toolUp/重复 finish 只创建 1 个门（portalFinishedGesture 去重）");
  else bad("①d 同一手势创建了 " + addCount + " 个门");
  if (localItems.length === 0)
    ok("①d 创建成功后再次清扫预览（local 预览项归零）");
  else bad("①d 创建后仍有预览残留：" + JSON.stringify(localItems.map((x) => x.id)));
  if (coreSrc.indexOf("preview 残留清理 ") >= 0 && coreSrc.indexOf("preview skip（已处理）") >= 0 &&
    coreSrc.indexOf("portal create gesture=") >= 0)
    ok("①d 诊断日志：preview 残留清理 / preview skip / portal create gesture 齐全");
  else bad("①d 预览/手势诊断日志缺失");
}

/* ---- ①e 创建验证 / 传送门生命周期诊断（v2.1.0 真机排障） ---- */
{
  if (coreSrc.indexOf("portal verify id=") >= 0 && coreSrc.indexOf("getItems([item.id])") >= 0 &&
    coreSrc.indexOf("portalLifecycleSync") >= 0 && coreSrc.indexOf("portal added id=") >= 0 &&
    coreSrc.indexOf("portal removed id=") >= 0 && coreSrc.indexOf("portal hidden id=") >= 0)
    ok("①e 创建后立即 getItems 验证 + onChange 生命周期日志（added/removed/hidden）");
  else bad("①e 传送门创建验证 / 生命周期诊断缺失");
  if (coreSrc.indexOf("scene.items.deleteItems") < 0 && coreSrc.indexOf("items.remove(") < 0)
    ok("①e 全仓后台没有删除 scene item 的代码（只有 scene.local 预览/血条清理）");
  else bad("①e 发现 scene item 删除代码，需要排查");
  /* 生命周期函数可调用、不抛错（seed → added → removed） */
  try {
    const portal = { id: "life-1", visible: true, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "生死门" } } };
    P.portalLifecycleSync([portal]);
    P.portalLifecycleSync([]);
    ok("①e portalLifecycleSync 可执行（seed / removed 路径不抛错）");
  } catch (e) {
    bad("①e portalLifecycleSync 抛错：" + (e && e.message));
  }
}

/* ---- ①f 位置只传干净 {x,y}（带 gesture 的对象不能害 position 归零） ---- */
{
  let posArg = null;
  const builder = {
    position(p) { posArg = p; return this; }, scale() { return this; }, layer() { return this; },
    name() { return this; }, locked() { return this; }, visible() { return this; },
    metadata() { return this; }, build() { return { id: "img-1", metadata: {}, position: posArg }; }
  };
  sandbox.buildImage = () => builder;
  sandbox.OBR = { scene: { grid: { getDpi: async () => 150 } } };
  const item = await P.portalImageItem({ x: 12, y: 34, gesture: 9 }, 70, { visible: true }, false);
  if (posArg && posArg.x === 12 && posArg.y === 34 && !("gesture" in posArg) &&
    item.position.x === 12 && item.position.y === 34)
    ok("①f portalImageItem 只把 {x,y} 传给 position（带 gesture 的对象被剥掉，pos 不再归零）");
  else bad("①f position 仍不是干净 {x,y}：" + JSON.stringify({ posArg, itemPos: item.position }));
  if (coreSrc.indexOf("var center = { x: portalDragStart.x, y: portalDragStart.y };") >= 0 &&
    coreSrc.indexOf("position({ x: cx, y: cy })") >= 0 &&
    coreSrc.indexOf("center=") >= 0)
    ok("①f portalDragFinish 建 center 时从 gesture 对象剥出 x/y；创建日志带 center=<x>,<y>");
  else bad("①f center 剥离 / center 日志缺失");
}

/* ---- ①g 页面模块语法 / 重名回归 ---- */
{
  const pageSrc = fs.readFileSync(path.join(ROOT, "assets", "portal-page.js"), "utf8");
  if (pageSrc.indexOf("function closeSelf(") < 0 &&
    pageSrc.indexOf("function closePortalEdit(") >= 0 &&
    pageSrc.indexOf('closeSelf(ID_PORTAL_EDIT, "portalEdit")') >= 0)
    ok("①g portal-page.js 没有本地 function closeSelf（不与 import 重名）；本地关闭函数叫 closePortalEdit");
  else bad("①g portal-page.js 仍存在 closeSelf 重名风险");
  if (fs.existsSync(path.join(ROOT, "dev", "check-syntax.mjs")) &&
    fs.readFileSync(path.join(ROOT, "dev", "selftest.mjs"), "utf8").indexOf("dev/check-syntax.mjs") >= 0)
    ok("①g selftest 已接入 dev/check-syntax.mjs（模块语法检查）");
  else bad("①g selftest 没有模块语法检查步骤");
}

/* ---- ①h 半径 ↔ 显示大小双向同步 ---- */
{
  if (P.portalRadiusFromScale({ x: 2, y: 2 }, 150) === 150 &&
    P.portalRadiusFromScale({ x: 0.32, y: 0.32 }, 100) === 16 &&
    P.portalRadiusFromScale({ x: 0.1, y: 0.1 }, 100) === 16 &&
    P.portalRadiusFromScale({ x: 2, y: 1 }, 150) === 75)
    ok("①h portalRadiusFromScale：dpi150/scale2→150、dpi100/scale0.32→16、小于最小半径 clamp；x/y 不一致取 min");
  else bad("①h portalRadiusFromScale 数值不对：" + JSON.stringify({
    a: P.portalRadiusFromScale({ x: 2, y: 2 }, 150), b: P.portalRadiusFromScale({ x: 0.32, y: 0.32 }, 100),
    c: P.portalRadiusFromScale({ x: 0.1, y: 0.1 }, 100), d: P.portalRadiusFromScale({ x: 2, y: 1 }, 150)
  }));

  let writes = 0;
  let lastDraft = null;
  sandbox.OBR = {
    player: { getRole: async () => "GM" },
    scene: {
      grid: { getDpi: async () => 150 },
      items: { updateItems: async (ids, fn) => { const d = { id: ids[0], metadata: {}, scale: { x: 1, y: 1 }, visible: true }; fn([d]); lastDraft = d; writes++; } }
    }
  };
  const portalScaled = { id: "p-scale", type: "IMAGE", position: { x: 0, y: 0 }, scale: { x: 2, y: 2 }, visible: true, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "大门", tag: "城", radius: 70 } } };
  await P.portalScaleRadiusSync([portalScaled]);
  const syncedR = lastDraft && lastDraft.metadata[P.CONSTANTS.KEY_PORTAL] && lastDraft.metadata[P.CONSTANTS.KEY_PORTAL].radius;
  if (writes === 1 && syncedR === 150)
    ok("①h onChange 缩放同步：scale=2@dpi150 → 写 metadata.radius=150（只写一次 updateItems）");
  else bad("①h 缩放手柄没有写回 radius：" + JSON.stringify({ writes, syncedR }));
  /* 模拟宿主已把 metadata.radius 写成 150（自己的写入）→ 再次 onChange 不应再写 */
  const portalSynced = { id: "p-scale", type: "IMAGE", position: { x: 0, y: 0 }, scale: { x: 2, y: 2 }, visible: true, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "大门", tag: "城", radius: 150 } } };
  const writesBefore = writes;
  await P.portalScaleRadiusSync([portalSynced]);
  if (writes === writesBefore)
    ok("①h 自己写入后的第二次 onChange 不再写（阈值/inflight 去重，不循环）");
  else bad("①h 缩放同步出现循环写入：" + writes);
  sandbox.OBR.player.getRole = async () => "PLAYER";
  const writesPlayer = writes;
  await P.portalScaleRadiusSync([portalScaled]);
  if (writes === writesPlayer)
    ok("①h 非 GM 不写 radius（玩家端只读）");
  else bad("①h 非 GM 也写了 radius");

  /* 编辑窗保存 → item.scale = 2r/dpi */
  let saveDraft = null;
  sandbox.OBR = {
    player: { getRole: async () => "GM" },
    scene: {
      grid: { getDpi: async () => 150 },
      items: { updateItems: async (ids, fn) => { const d = { id: ids[0], metadata: {}, scale: { x: 2, y: 2 }, visible: true }; fn([d]); saveDraft = d; } }
    },
    popover: { close: async () => {} }
  };
  /* 表单不再有半径；当前 item.scale=2@dpi150 → 实际半径 150，表单里即使带 999 也不能覆盖。 */
  await P.onPortalSave({ data: { itemId: "p-save", portal: { name: "南门", tag: "城", radius: 999 } } });
  if (saveDraft && saveDraft.scale && Math.abs(saveDraft.scale.x - 2) < 1e-9 && Math.abs(saveDraft.scale.y - 2) < 1e-9 &&
    saveDraft.metadata[P.CONSTANTS.KEY_PORTAL].radius === 150)
    ok("①h 编辑窗保存：radius 由 item.scale 反算（scale=2@dpi150 → 150），表单 radius 不再覆盖");
  else bad("①h 编辑窗保存没有保留 scale 反算的半径：" + JSON.stringify({ scale: saveDraft && saveDraft.scale, radius: saveDraft && saveDraft.metadata && saveDraft.metadata[P.CONSTANTS.KEY_PORTAL] && saveDraft.metadata[P.CONSTANTS.KEY_PORTAL].radius }));
}

/* ---- ①i 编辑窗不再有半径输入 ---- */
{
  const htmlSrc = fs.readFileSync(path.join(ROOT, "portal-edit.html"), "utf8");
  const pageSrc = fs.readFileSync(path.join(ROOT, "assets", "portal-page.js"), "utf8");
  if (htmlSrc.indexOf("pe-radius") < 0 && pageSrc.indexOf("els.radius") < 0 &&
    pageSrc.indexOf("pe-radius") < 0)
    ok("①i 编辑窗已去掉半径输入（HTML 无 pe-radius、页面无 els.radius）");
  else bad("①i 编辑窗仍有半径输入");
  if (coreSrc.indexOf("var PORTAL_EDIT_H = 390;") >= 0 &&
    coreSrc.indexOf("portalEdit: { id: ID_PORTAL_EDIT, url: URL_PORTAL_EDIT, width: PORTAL_EDIT_W, height: PORTAL_EDIT_H }") >= 0)
    ok("①i 去掉半径后窗口高度缩为 390（WINS.portalEdit 同步）");
  else bad("①i 窗口高度没有缩为 390");
  if (/return \{[\s\S]{0,420}?name:/.test(pageSrc) && pageSrc.indexOf("radius: Math.max") < 0)
    ok("①i readForm 不再返回 radius（半径只来自 item.scale）");
  else bad("①i readForm 仍包含 radius");
}

/* ---- ①j 传送落点不重复触发 / 手动再次拖入正常触发（v2.1.0 收窄版） ---- */
{
  let portalOpen = 0;
  const portal = { id: "p-door", type: "IMAGE", position: { x: 500, y: 500 }, width: 40, height: 40, scale: { x: 0.9333, y: 0.9333 }, visible: true, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "门", tag: "城", radius: 70 } } };
  const other = { id: "p-other", type: "IMAGE", position: { x: 1000, y: 500 }, width: 40, height: 40, scale: { x: 0.9333, y: 0.9333 }, visible: true, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "另一门", tag: "城", radius: 70 } } };
  const token = { id: "tok-1", type: "IMAGE", position: { x: 0, y: 0 }, width: 40, height: 40, scale: { x: 1, y: 1 }, createdUserId: "me", metadata: {} };
  sandbox.OBR = {
    player: { getRole: async () => "GM", getId: async () => "me", getSelection: async () => [] },
    scene: {
      grid: { getDpi: async () => 150 },
      items: {
        getItems: async () => [portal, other, token],
        updateItems: async (ids, fn) => {
          const d = JSON.parse(JSON.stringify(token));
          fn([d]);
          if (d.position) token.position = d.position;
        }
      }
    },
    popover: { open: async () => { portalOpen++; }, close: async () => {} }
  };
  await P.onPortalTeleport({ data: { destinationId: "p-door", tokenIds: ["tok-1"] } });
  const afterTeleport = { x: token.position.x, y: token.position.y };
  await P.portalDetectDragEnd();
  if (portalOpen === 0)
    ok("①j 传送写入 position 后的第一轮 onChange 不触发（portalWritingIds）");
  else bad("①j 传送写入后自己触发了一次：" + portalOpen);
  await new Promise((r) => setTimeout(r, 800));
  await P.portalDetectDragEnd();
  if (portalOpen === 0)
    ok("①j 700ms 后、位置没再变化 → 传送落点不重复触发（落地记录生效）");
  else bad("①j 冷却后落点又触发：" + portalOpen);
  token.position = { x: 450, y: 500 }; /* 手动拖到门内另一处（位置再次变化） */
  await P.portalDetectDragEnd();
  if (portalOpen === 1)
    ok("①j 手动再次拖入（位置变化）→ 正常触发目的地选择");
  else bad("①j 手动再次拖入没有触发：" + portalOpen);
  /* 再次传送 → 落点；700ms 内手动再拖不应触发 */
  await P.onPortalTeleport({ data: { destinationId: "p-door", tokenIds: ["tok-1"] } });
  token.position = { x: 520, y: 500 };
  await P.portalDetectDragEnd();
  if (portalOpen === 1)
    ok("①j 传送后 700ms 内位置变化 → 冷却期内不触发");
  else bad("①j 冷却期内触发了：" + portalOpen);
  if (coreSrc.indexOf("portalTeleportLanded") >= 0 && coreSrc.indexOf("portalWritingIds") >= 0 &&
    coreSrc.indexOf("portal skip（传送落点未再变化）") >= 0 && coreSrc.indexOf("portal skip（冷却）") >= 0 &&
    coreSrc.indexOf("portalInsideState") < 0)
    ok("①j 轻量落地记录 + writing 跳过；没有全局「必须先离开再进入」门控");
  else bad("①j 落地/冷却/写入跳过静态接线不对");

}

/* ---- ①k 目的地选择窗接进窗口框架 ---- */
{
  const destHtml = fs.readFileSync(path.join(ROOT, "portal-dest.html"), "utf8");
  const destJs = fs.readFileSync(path.join(ROOT, "assets", "portal-dest-page.js"), "utf8");
  if (coreSrc.indexOf("portalDest: { id: ID_PORTAL_DEST") >= 0 &&
    coreSrc.indexOf("async function openDestinationPopover(") >= 0 &&
    coreSrc.indexOf('openWin("portalDest"') >= 0 &&
    coreSrc.indexOf("openDestinationPopover(origin.portal.itemId, tokenIds)") >= 0)
    ok("①k WINS.portalDest + openDestinationPopover 走 openWin（可拖动/位置记忆/reclamp）");
  else bad("①k 目的地窗没有接进窗口框架");
  if (destHtml.indexOf('class="win-head"') >= 0 && destHtml.indexOf('id="head"') >= 0 &&
    destJs.indexOf('createWindow({ name: "portalDest"') >= 0 &&
    destJs.indexOf('closeSelf(ID_PORTAL_DEST, "portalDest")') >= 0)
    ok("①k 目的地页为标准窗口页（.win-head / createWindow portalDest / closeSelf）");
  else bad("①k 目的地页没有 windowize");
}

/* ---- ①l 窗口页 HTML 防缓存：openWin 统一补 v= ---- */
{
  const vUrl = P.withWindowVersion("portal-dest.html?portal=p1&tokens=t1");
  const vUrl2 = P.withWindowVersion("portal-edit.html?item=p1");
  const withV = P.withWindowVersion("panel.html?v=9.9.9");
  if (vUrl.indexOf("portal=p1") >= 0 && vUrl.indexOf("&v=" + P.version) >= 0 &&
    vUrl2.indexOf("?item=p1") >= 0 && vUrl2.indexOf("&v=" + P.version) >= 0 &&
    withV === "panel.html?v=9.9.9")
    ok("①l 窗口 URL 统一补 v=<PLUGIN_VERSION>（已有 v= 不重复；目的地/编辑窗都覆盖）");
  else bad("①l 窗口 URL 版本参数不对：" + JSON.stringify({ vUrl, vUrl2, withV }));
  if (coreSrc.indexOf("function withWindowVersion(") >= 0 &&
    coreSrc.indexOf("var url = withWindowVersion(") >= 0)
    ok("①l openWin 统一经过 withWindowVersion（openDestinationPopover / openPortalEdit 自动带版本）");
  else bad("①l openWin 没有统一补版本参数");
}

/* ---- ② 同 tag 目的地 ---- */
{
  const portals = [
    { itemId: "p1", name: "北门", tag: "城" },
    { itemId: "p2", name: "南门", tag: "城" },
    { itemId: "p3", name: "密道", tag: "地牢" }
  ];
  const d = P.portalDestinations(portals, "p1");
  if (d.length === 1 && d[0].itemId === "p2")
    ok("② 同 tag 目的地：p1 只列 p2（排除自己、排除不同 tag）");
  else bad("② 目的地列表不对：" + JSON.stringify(d));
}

/* ---- ③ 六边形螺旋不重叠 ---- */
{
  const sp = 20;
  const pts = P.portalHexSpiral(13, sp);
  let minDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      minDist = Math.min(minDist, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    }
  }
  if (pts.length === 13 && near(pts[0].x, 0) && near(pts[0].y, 0) && minDist >= sp - 1e-6)
    ok("③ 六边形螺旋：13 个落点、首点在中心、任意两点距离 ≥ spacing（" + minDist.toFixed(2) + "）");
  else bad("③ 六边形螺旋重叠 / 数量不对：" + pts.length + " / min=" + minDist);
}

/* ---- ④ 原生 WALL 避让 ---- */
{
  const wall = {
    id: "wall-1", type: "WALL", position: { x: 100, y: 0 }, rotation: 0, scale: { x: 1, y: 1 },
    points: [{ x: 0, y: -200 }, { x: 0, y: 200 }]
  };
  const segs = P.portalWallSegments([wall]);
  if (segs.length === 1 && near(segs[0].a.x, 100) && near(segs[0].b.x, 100))
    ok("④ WALL 线段按 position/rotation/scale 变换（x=100 竖墙）");
  else bad("④ WALL 线段变换不对：" + JSON.stringify(segs));
  const pos = P.portalPlanTeleport({ x: 100, y: 0 }, [10, 10], segs);
  if (!pos || pos.length !== 2) bad("④ 墙避让没有给出 2 个落点");
  else {
    const dists = pos.map((p) => P.portalWallSegments([wall]).map((s) => {
      // 直接用点到线段距离（测试侧重算）
      const vx = s.b.x - s.a.x, vy = s.b.y - s.a.y;
      const wx = p.x - s.a.x, wy = p.y - s.a.y;
      const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
      return Math.hypot(p.x - (s.a.x + vx * t), p.y - (s.a.y + vy * t));
    })[0]);
    if (dists.every((d) => d >= 10 + 8 - 1e-6))
      ok("④ 墙避让：中心落在墙上时，多枚 token 落点均保持 token 半径 + 8 间隙（" + dists.map((x) => x.toFixed(1)).join(" / ") + "）");
    else bad("④ 落点离墙太近：" + JSON.stringify(dists));
  }
}

/* ---- ⑤ 多选 token：落点数量 / 互不重叠 ---- */
{
  const pos = P.portalPlanTeleport({ x: 0, y: 0 }, [12, 8, 8], []);
  if (pos && pos.length === 3) {
    let min = Infinity;
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      min = Math.min(min, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
    }
    if (min >= 2 * 12 + 8 - 1e-6) ok("⑤ 多选 3 枚 token：3 个落点，最小间距 ≥ 最大 token 直径 + 8（" + min.toFixed(1) + "）");
    else bad("⑤ 多选落点重叠：" + min);
  } else bad("⑤ 多选落点数量不对：" + JSON.stringify(pos));
}

/* ---- ⑤b 多选 token 真执行：假 OBR 记录 updateItems 位置 ---- */
{
  await new Promise((r) => setTimeout(r, 800)); /* 等 ①j 的 700ms 冷却过去 */
  const dest = {
    id: "p-dest", type: "IMAGE", position: { x: 500, y: 500 }, width: 40, height: 40, scale: { x: 1, y: 1 },
    metadata: { [sandbox.window.__4ePortal.CONSTANTS.KEY_PORTAL]: { name: "南门", tag: "城", radius: 80, visible: true } }
  };
  const tok1 = { id: "t1", type: "IMAGE", position: { x: 0, y: 0 }, width: 40, height: 40, scale: { x: 1, y: 1 }, metadata: {} };
  const tok2 = { id: "t2", type: "IMAGE", position: { x: 0, y: 0 }, width: 30, height: 30, scale: { x: 1, y: 1 }, metadata: {} };
  let updatedPos = null;
  sandbox.OBR = {
    notification: { show() { return Promise.resolve(); } },
    scene: {
      items: {
        getItems: async () => [dest, tok1, tok2],
        updateItems: async (ids, fn) => {
          const drafts = [tok1, tok2].filter((it) => ids.indexOf(it.id) >= 0).map((it) => JSON.parse(JSON.stringify(it)));
          fn(drafts);
          updatedPos = {};
          for (const d of drafts) updatedPos[d.id] = d.position;
        }
      }
    }
  };
  sandbox.setTimeout = setTimeout;
  await P.onPortalTeleport({ data: { destinationId: "p-dest", tokenIds: ["t1", "t2"] } });
  const d2 = updatedPos && updatedPos.t1 && updatedPos.t2
    ? Math.hypot(updatedPos.t2.x - updatedPos.t1.x, updatedPos.t2.y - updatedPos.t1.y) : 0;
  if (updatedPos && updatedPos.t1 && updatedPos.t2 &&
    Math.abs(updatedPos.t1.x - 500) <= 1 && Math.abs(updatedPos.t1.y - 500) <= 1 && d2 >= 40)
    ok("⑤b 多选传送执行：假 OBR 的 updateItems 收到 t1/t2 两个新位置（t1 在中心、间距 " + d2.toFixed(1) + "）");
  else bad("⑤b 多选传送没有写出两个位置：" + JSON.stringify(updatedPos));
}

/* ---- ⑥ 700ms 抑制 ---- */
{
  const now = 100000;
  if (P.CONSTANTS.PORTAL_SUPPRESS_MS === 700 &&
    P.portalSuppressed(now, now + 700) === true &&
    P.portalSuppressed(now + 700, now + 700) === false)
    ok("⑥ 传送后 700ms 抑制：窗口内为 true、到期后 false");
  else bad("⑥ 700ms 抑制逻辑不对");
}

/* ---- ⑦ 只有 GM 能建门 / 编辑 ---- */
{
  if (/只有城主能创建传送门/.test(coreSrc) && /role !== "GM"/.test(coreSrc) &&
    /只有城主能编辑传送门/.test(coreSrc) && /roles: \["GM"\]/.test(coreSrc))
    ok("⑦ 权限：portalCreate / onPortalSave 非 GM 拒绝；右键「编辑传送门」仅 GM");
  else bad("⑦ 传送门建门 / 编辑权限锁不完整");
}

/* ---- ⑧ 工具注册 / 编辑窗 ---- */
{
  if (coreSrc.indexOf("function registerPortalTool()") >= 0 &&
    coreSrc.indexOf("OBR.tool.createMode(") >= 0 && coreSrc.indexOf("onToolDragStart") >= 0 &&
    coreSrc.indexOf("onToolDragEnd") >= 0 && /defaultMode: TOOL_PORTAL_MODE_ID/.test(coreSrc) &&
    coreSrc.indexOf("function openPortalEdit(") >= 0 &&
    coreSrc.indexOf("URL_PORTAL_EDIT + \"?item=\"") >= 0 &&
    fs.existsSync(path.join(ROOT, "assets", "portal.svg")) &&
    fs.existsSync(path.join(ROOT, "portal-edit.html")) &&
    fs.existsSync(path.join(ROOT, "portal-dest.html")))
    ok("⑧ 工具注册（tool+mode、dragStart/Move/End）、编辑窗打开、portal.svg / portal-edit.html / portal-dest.html 都存在");
  else bad("⑧ 传送门工具 / 编辑窗 / 资源文件不完整");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过（传送门核心：30+ 条断言）");
process.exit(fail ? 1 : 0);
