// v2.4.17：传送门核心离线自测（node dev/test-portal.mjs）
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
import zlib from "node:zlib";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "assets", "background.core.js");
/* 读 PNG 四角 alpha：简易 RGBA/8-bit PNG 解码（只用于测试羽化边缘）。 */
function pngCornerAlphas(file) {
  const b = fs.readFileSync(file);
  let off = 8, idat = Buffer.alloc(0), w = 0, h = 0, bd = 0, ct = 0;
  while (off + 8 <= b.length) {
    const len = b.readUInt32BE(off);
    const type = b.slice(off + 4, off + 8).toString("ascii");
    const data = b.slice(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === "IDAT") idat = Buffer.concat([idat, data]);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bd !== 8 || ct !== 6 || !w || !h) return null;
  const raw = zlib.inflateSync(idat);
  const bpp = 4, stride = w * bpp;
  let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  const at = (x, y) => cur[y * bpp + 3];
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const bb = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += Math.floor((a + bb) / 2);
      else if (f === 4) {
        const p2 = a + bb - c, pa = Math.abs(p2 - a), pb = Math.abs(p2 - bb), pc = Math.abs(p2 - c);
        v += pa <= pb && pa <= pc ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
    prev = Buffer.from(cur);
  }
  /* 重新扫一遍取四角（上面的 at 依赖最后一行，改写直接计算） */
  const rows = [];
  prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const bb = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += Math.floor((a + bb) / 2);
      else if (f === 4) {
        const p2 = a + bb - c, pa = Math.abs(p2 - a), pb = Math.abs(p2 - bb), pc = Math.abs(p2 - c);
        v += pa <= pb && pa <= pc ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
    rows.push(cur);
    prev = cur;
  }
  return [rows[0][3], rows[0][stride - 1], rows[h - 1][3], rows[h - 1][stride - 1]];
}
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

/* ---- ①b 工具对齐 Full Suite：GM-only / tool→mode / activateMode / 双路径（v2.4.17 真机 bug 回归） ---- */
{
  const order = [];
  let toolDef = null, modeDef = null, pairModeDef = null, role = "GM", notified = 0;
  let activeModeCalls = 0, activateToolCalls = 0;
  sandbox.OBR = {
    player: { getRole: async () => role },
    tool: {
      create: async (def) => { order.push("tool"); toolDef = def; },
      remove: async () => {},
      createMode: async (def) => {
        order.push("mode");
        if (def.id === P.CONSTANTS.TOOL_PORTAL_MODE_ID) modeDef = def;
        if (def.id === P.CONSTANTS.TOOL_PORTAL_PAIR_MODE_ID) pairModeDef = def;
      },
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
  if (pairModeDef && pairModeDef.icons[0].filter && pairModeDef.icons[0].filter.activeTools &&
    typeof pairModeDef.onToolClick === "function")
    ok("①b pair mode：icon filter.activeTools + onToolClick");
  else bad("①b pair mode 未注册");
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

/* ---- ①e 创建验证 / 传送门生命周期诊断（v2.4.17 真机排障） ---- */
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
  if (coreSrc.indexOf("var PORTAL_EDIT_H = 430;") >= 0 &&
    coreSrc.indexOf("portalEdit: { id: ID_PORTAL_EDIT, url: URL_PORTAL_EDIT, width: PORTAL_EDIT_W, height: PORTAL_EDIT_H }") >= 0)
    ok("①i 去掉半径后窗口高度 430（WINS.portalEdit 同步）");
  else bad("①i 窗口高度不是 430");
  if (/return \{[\s\S]{0,420}?name:/.test(pageSrc) && pageSrc.indexOf("radius: Math.max") < 0)
    ok("①i readForm 不再返回 radius（半径只来自 item.scale）");
  else bad("①i readForm 仍包含 radius");
}

/* ---- ①j 传送落点不重复触发 / 手动再次拖入正常触发（v2.4.17 收窄版） ---- */
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

/* ---- ①m 目的地窗布局不裁切 ---- */
{
  const destHtml = fs.readFileSync(path.join(ROOT, "portal-dest.html"), "utf8");
  if (coreSrc.indexOf("var PORTAL_DEST_H = 380;") >= 0 &&
    coreSrc.indexOf("height: PORTAL_DEST_H") >= 0)
    ok("①m WINS.portalDest 高度 380（宽 360 不变）");
  else bad("①m PORTAL_DEST_H 不是 380");
  if (destHtml.indexOf('class="dest-list"') >= 0 && destHtml.indexOf('class="dest-foot"') >= 0 &&
    /\.dest-list \{[^}]*overflow-y: auto/.test(destHtml) &&
    /\.dest-foot \{[^}]*flex: 0 0 auto/.test(destHtml) &&
    !/\.dest-foot \{[^}]*position: absolute/.test(destHtml))
    ok("①m 目的地窗布局：dest-list flex+overflow-y:auto，dest-foot 固定不绝对定位");
  else bad("①m 目的地窗布局仍有裁切风险");
  if (destHtml.indexOf("border: 0; background: transparent; border-radius: 0; box-shadow: none") >= 0 &&
    destHtml.indexOf("border-bottom: 1px solid var(--line)") >= 0 &&
    destHtml.indexOf("min-height: 72px") >= 0)
    ok("①m 目的地窗无内层框（透明列表/行分隔线），空列表最小高度 72px");
  else bad("①m 目的地窗仍有内层框 / 行样式不对");
  if (destHtml.indexOf('id="pd-close"') >= 0 && destHtml.indexOf("dest-empty") >= 0 &&
    destHtml.indexOf("同一标签的其它传送门会出现在这里") < 0)
    ok("①m 空状态 / 取消按钮齐全；底部提示整句已删除");
  else bad("①m 空状态/取消按钮缺失，或底部提示未删");
}

/* ---- ①n 目的地窗防重 / 清残留 ---- */
{
  let opens = 0, closes = 0;
  sandbox.OBR = {
    popover: { open: async () => { opens++; }, close: async () => { closes++; } }
  };
  const p1 = P.openDestinationPopover("p-one", ["t1"]);
  const p2 = P.openDestinationPopover("p-one", ["t1"]);
  const rs = await Promise.all([p1, p2]);
  if (opens === 1 && closes >= 1 && rs.filter(Boolean).length === 1)
    ok("①n openDestinationPopover 并发两次只打开一次，且打开前先 popover.close 清同 id 残留");
  else bad("①n 目的地窗并发/清残留不对：" + JSON.stringify({ opens, closes, rs }));
  if (coreSrc.indexOf("portalDestOpening") >= 0 && coreSrc.indexOf("portal dest skip（已开/并发）") >= 0 &&
    coreSrc.indexOf("portalOldDestId") >= 0 &&
    coreSrc.indexOf("清理旧传送门窗口残留（boot）") >= 0 &&
    coreSrc.indexOf("portal dest 清理残留") >= 0)
    ok("①n boot 清理旧 id + 打开并发锁 + 日志齐全");
  else bad("①n boot 清理/并发锁缺失");
  if (coreSrc.indexOf("portalDestLastKey") >= 0 && coreSrc.indexOf("portalDestLastAt") >= 0 &&
    coreSrc.indexOf("500ms 内重复触发") >= 0)
    ok("①n 检测触发 500ms 内同 portal+tokenIds 只触发一次");
  else bad("①n 检测触发没有 500ms 去重");
}

const NS_PREVIEW_GHOST = P.CONSTANTS.KEY_PORTAL + "-ghost";

/* ---- ①o v2.4.17 隐形门：入口跳过 / 目的地保留 / GM ghost ---- */
{
  const portals = [
    { itemId: "v1", name: "显形门", tag: "T", visible: true },
    { itemId: "h1", name: "隐藏门", tag: "T", visible: false }
  ];
  const ds = P.portalDestinations(portals, "v1");
  if (ds.length === 1 && ds[0].itemId === "h1")
    ok("①o 隐形门仍出现在目的地列表（同 tag，visible=false 不过滤）");
  else bad("①o 隐形门没有出现在目的地：" + JSON.stringify(ds));
  const item = { id: "h1", type: "IMAGE", position: { x: 100, y: 200 }, width: 40, height: 40, scale: { x: 0.9333, y: 0.9333 }, visible: false, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "隐藏门", tag: "T", radius: 70, visible: false } } };
  let localAdds = [], localDeletes = [];
  let builtOpacity = null;
  const builder = {
    position() { return this; }, scale() { return this; }, layer() { return this; }, locked() { return this; },
    disableHit() { return this; }, visible() { return this; }, opacity(v) { builtOpacity = v; return this; },
    metadata() { return this; }, build() { return { id: "ghost-" + localAdds.length, metadata: {} }; }
  };
  sandbox.buildImage = () => builder;
  sandbox.OBR = {
    player: { getRole: async () => "GM" },
    scene: {
      grid: { getDpi: async () => 150 },
      local: {
        getItems: async () => [{ id: "old-ghost", metadata: { [NS_PREVIEW_GHOST]: true } }],
        deleteItems: async (ids) => { localDeletes = localDeletes.concat(ids); },
        addItems: async (items) => { localAdds = localAdds.concat(items); }
      }
    }
  };
  await P.portalGhostSync([item]);
  if (localDeletes.indexOf("old-ghost") >= 0 && localAdds.length === 1 && builtOpacity === 0.45)
    ok("①o GM ghost：清旧 local ghost + 按隐形门重建（opacity 0.45）");
  else bad("①o GM ghost 重建不对：" + JSON.stringify({ localDeletes, n: localAdds.length, builtOpacity }));
  const addsBefore = localAdds.length;
  await P.portalGhostSync([item]);
  if (localAdds.length === addsBefore)
    ok("①o ghost 签名未变 → 不重复重建");
  else bad("①o ghost 重复重建");
  await P.portalGhostSync([Object.assign({}, item, { visible: true, metadata: { [P.CONSTANTS.KEY_PORTAL]: { name: "显形", tag: "T", radius: 70, visible: true } } })]);
  if (localAdds.length === addsBefore)
    ok("①o 门恢复可见 → ghost 被清理、不新增");
  else bad("①o 可见门仍生成 ghost");
}

/* ---- ①p 传送动画已整体移除 ---- */
{
  const fxPage = path.join(ROOT, "portal-fx.html");
  if (!fs.existsSync(fxPage) &&
    coreSrc.indexOf("portalPlayFx") < 0 && coreSrc.indexOf("CH_PORTAL_FX") < 0 &&
    coreSrc.indexOf("portalEffectFor") < 0 && coreSrc.indexOf("PORTAL_FX_MS") < 0 &&
    coreSrc.indexOf("prefers-reduced-motion") < 0)
    ok("①p 传送动画已整体移除（无 portal-fx.html / fx 函数 / CH_PORTAL_FX / effect 逻辑）");
  else bad("①p 传送动画仍有残留");
  const editHtml = fs.readFileSync(path.join(ROOT, "portal-edit.html"), "utf8");
  const pageJs = fs.readFileSync(path.join(ROOT, "assets", "portal-page.js"), "utf8");
  if (editHtml.indexOf("pe-effect") < 0 && editHtml.indexOf("传送效果") < 0 &&
    pageJs.indexOf("effect") < 0)
    ok("①p 编辑窗已删除传送效果下拉与 effect 字段");
  else bad("①p 编辑窗仍有 effect 残留");
  const m = P.portalMeta({ effect: "fade", name: "测试" });
  if (!("effect" in m)) ok("①p portalMeta 不再输出 effect（旧 metadata 的 effect 被忽略）");
  else bad("①p portalMeta 仍输出 effect");
}

/* ---- ①q v2.4.17 成对创建（两个同 tag 门） ---- */
{
  let added = [];
  const builder = {
    position() { return this; }, scale() { return this; }, layer() { return this; }, name() { return this; },
    locked() { return this; }, disableHit() { return this; }, visible() { return this; }, opacity() { return this; },
    metadata(m) { this._meta = m; return this; }, build() { return { id: "pair-" + added.length, metadata: this._meta || {} }; }
  };
  sandbox.buildImage = () => builder;
  sandbox.OBR = {
    player: { getRole: async () => "GM" },
    scene: {
      grid: { getDpi: async () => 150 },
      items: { addItems: async (items) => { added = added.concat(items); } },
      local: { addItems: async () => {}, updateItems: async () => {}, deleteItems: async () => {}, getItems: async () => [] }
    }
  };
  const pair = await P.portalPairCreate({ x: 100, y: 100 }, { x: 400, y: 100 });
  const tags = added.map((it) => it.metadata && it.metadata[P.CONSTANTS.KEY_PORTAL] && it.metadata[P.CONSTANTS.KEY_PORTAL].tag);
  if (added.length === 2 && tags[0] && tags[0] === tags[1])
    ok("①q pair create 两个门：同随机 tag（" + tags[0] + "）、名称 A/B");
  else bad("①q 成对创建不对：" + JSON.stringify({ n: added.length, tags }));
  if (coreSrc.indexOf("TOOL_PORTAL_PAIR_MODE_ID") >= 0 && coreSrc.indexOf("portal pair first=") >= 0 &&
    coreSrc.indexOf("portal pair create tag=") >= 0)
    ok("①q pair mode 注册 / 日志齐全");
  else bad("①q pair mode 缺失");
}

/* ---- ①r 已无 fx 播放入口 ---- */
{
  if (typeof P.portalPlayFx !== "function" && typeof P.onPortalFx !== "function" &&
    coreSrc.indexOf("portal fx play") < 0)
    ok("①r 调试钩子/日志也不再暴露 fx 播放（传送完全无动画）");
  else bad("①r 仍有 fx 播放入口");
}

/* ---- ①s v2.4.17 图标换成用户 PNG（150×150、尺寸仍=2r） ---- */
{
  const png = path.join(ROOT, "assets", "portal.png");
  if (!fs.existsSync(png)) bad("①s 缺少 assets/portal.png");
  else {
    const b = fs.readFileSync(png);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20), colorType = b[25];
    if (w === 150 && h === 150 && colorType === 6)
      ok("①s assets/portal.png 为 150×150 RGBA（colorType=6）");
    else bad("①s portal.png 尺寸/格式不对：" + JSON.stringify({ w, h, colorType }));
  }
  const corners = pngCornerAlphas(png);
  if (corners && corners.every((a) => a === 0))
    ok("①s portal.png 四角 alpha=0（边缘已羽化，无方形底）");
  else bad("①s portal.png 四角不是全透明：" + JSON.stringify(corners));
  if (coreSrc.indexOf('var PORTAL_ICON_URL = pageUrl("assets/portal.png") + "?v=" + PLUGIN_VERSION;') >= 0 &&
    coreSrc.indexOf('mime: "image/png"') >= 0 &&
    coreSrc.indexOf("{ width: 150, height: 150, url: PORTAL_ICON_URL") >= 0 &&
    coreSrc.indexOf("{ dpi: 150, offset: { x: 75, y: 75 } }") >= 0 &&
    coreSrc.indexOf("portalScaleFor(radius, dpi)") >= 0)
    ok("①s 传送门 item/预览/ghost 都用 portal.png（150/dpi150/offset75；scale 仍 2r/dpi）");
  else bad("①s 图标 URL / 150 参数 / scale 公式没接好");
  if (coreSrc.indexOf("portal.svg") >= 0 && fs.existsSync(path.join(ROOT, "assets", "portal.svg")))
    ok("①s portal.svg 保留（工具图标仍用 SVG）");
  else console.log("  ok   ①s portal.svg 已不存在（可接受，工具图标另有来源）");
}

/* ---- ①t 传送门编辑窗控件与目的地窗统一 ---- */
{
  const uiShared = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const editHtml = fs.readFileSync(path.join(ROOT, "portal-edit.html"), "utf8");
  const destHtml = fs.readFileSync(path.join(ROOT, "portal-dest.html"), "utf8");
  if (uiShared.indexOf(".win-input") >= 0 && uiShared.indexOf(".win-check") >= 0 &&
    uiShared.indexOf(".win-btn") >= 0 && uiShared.indexOf(".win-label") >= 0 &&
    uiShared.indexOf(".win-note") >= 0)
    ok("①t ui.css 抽公共控件类 .win-input / .win-check / .win-btn / .win-label / .win-note");
  else bad("①t 公共控件样式缺失");
  if (editHtml.indexOf('class="win-input" id="pe-name"') >= 0 &&
    editHtml.indexOf('class="win-input" id="pe-tag"') >= 0 &&
    (editHtml.match(/class="win-check-row"/g) || []).length === 3 &&
    (editHtml.match(/class="win-check"/g) || []).length === 3 &&
    editHtml.indexOf('class="win-note"') >= 0 &&
    editHtml.indexOf('class="win-btn" id="pe-close"') >= 0 &&
    editHtml.indexOf('class="win-btn primary" id="pe-save"') >= 0 &&
    destHtml.indexOf('class="win-btn" id="pd-close"') >= 0)
    ok("①t 编辑窗名称/标签/三开关/说明/取消·保存 与目的地窗共用控件样式，保存为主按钮");
  else bad("①t 编辑窗控件未统一 / 字段缺失");
  if (coreSrc.indexOf("var PORTAL_EDIT_W = 360;") >= 0 && coreSrc.indexOf("var PORTAL_EDIT_H = 430;") >= 0)
    ok("①t 编辑窗 360×430（统一控件后加高）");
  else bad("①t 编辑窗尺寸常量不对");
  if (editHtml.indexOf("flex: 1 1 auto; min-height: 0; overflow-y: auto") >= 0 && editHtml.indexOf(".pe-body .foot { flex: 0 0 auto") >= 0)
    ok("①t 编辑窗 flex：内容可滚、按钮行固定、底部 12px 内边距，不裁切");
  else bad("①t 编辑窗 flex/内边距结构不对");
}

/* ---- ①v v2.4.17 传送落点禁跨墙 / 尺寸兜底 / 就近落点 ---- */
{
  const wallRight = { id: "w1", type: "WALL", position: { x: 50, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: [{ x: 0, y: -300 }, { x: 0, y: 300 }] };
  const segs = P.portalWallSegments([wallRight]);
  const pos = P.portalPlanTeleport({ x: 30, y: 0 }, [20], segs);
  if (pos && pos.length === 1 && pos[0].x < 50 && P.portalPathSafe({ x: 30, y: 0 }, pos[0], segs))
    ok("①v 墙在门右侧：落点不会跨到墙右边（x<50），路径不穿墙");
  else bad("①v 落点跨墙 / 路径穿墙：" + JSON.stringify(pos));
  if (P.portalTokenRadius({}, 150) === 75 && P.portalTokenRadius({ width: 40, height: 40, scale: { x: 1, y: 1 } }, 150) === 75 &&
    P.portalTokenRadius({ width: 300, height: 300, scale: { x: 2, y: 2 } }, 150) === 300)
    ok("①v portalTokenRadius：无尺寸按 DPI/2 兜底；小尺寸 clamp 到 0.5 格；按 width*scale 实际渲染尺寸");
  else bad("①v token 半径兜底不对：" + JSON.stringify({ a: P.portalTokenRadius({}, 150), b: P.portalTokenRadius({ width: 40, height: 40, scale: { x: 1, y: 1 } }, 150), c: P.portalTokenRadius({ width: 300, height: 300, scale: { x: 2, y: 2 } }, 150) }));
  const near = P.portalPlanTeleport({ x: 0, y: 0 }, [10], []);
  if (near && near.length === 1 && near[0].x === 0 && near[0].y === 0)
    ok("①v 单 token 无墙时落在门中心（由近到远先试内圈）");
  else bad("①v 单 token 没有就近落点：" + JSON.stringify(near));
  const multi = P.portalPlanTeleport({ x: 0, y: 0 }, [12, 8, 8], []);
  if (multi && multi.length === 3) {
    let min = Infinity, overlap = false;
    for (let i = 0; i < multi.length; i++) for (let j = i + 1; j < multi.length; j++) {
      const d = Math.hypot(multi[i].x - multi[j].x, multi[i].y - multi[j].y);
      min = Math.min(min, d);
      if (d < 2 * 12 + 8) overlap = true;
    }
    if (!overlap && min >= 32) ok("①v 多 token 不重叠（最小间距 " + min.toFixed(1) + "）");
    else bad("①v 多 token 重叠：" + min);
  } else bad("①v 多 token 落点数量不对：" + JSON.stringify(multi));
  if (coreSrc.indexOf("portalPathSafe") >= 0 && coreSrc.indexOf("portal plan fail tokens=") >= 0 &&
    coreSrc.indexOf("portalTokenRadius(it, dpiTele)") >= 0)
    ok("①v 传送路径检测 / plan fail 日志 / 实际 DPI 半径接入");
  else bad("①v 跨墙/日志/尺寸接入缺失");
}

/* ---- ①w v2.4.17 落点规划诊断 ---- */
{
  if (coreSrc.indexOf("portal plan n=") >= 0 && coreSrc.indexOf("portal plan warn：未检测到原生 WALL") >= 0 &&
    coreSrc.indexOf("portal plan walls[0] a=") >= 0 && coreSrc.indexOf("portal cand i=") >= 0 &&
    coreSrc.indexOf('reject=" + (reject') >= 0 && coreSrc.indexOf('"wall-cross"') >= 0 && coreSrc.indexOf('"wall-hit"') >= 0)
    ok("①w 诊断：plan n/pos、walls[0] 坐标、候选前 12 个 reject 原因日志齐全");
  else bad("①w 落点规划诊断缺失");
}

/* ---- ①y v2.4.17 传送绕过 Dynamic Fog / Smoke ---- */
{
  const att = { id: "att-1", visible: true };
  const token = { id: "tok-fog", visible: true, metadata: { "com.example/vision": { visionRange: 12, attenuationRadius: 5 }, "4enext-owlbear/bind": { cardId: "c" }, plain: 1 } };
  const originalVision = token.metadata["com.example/vision"];
  let attHidden = false, tokenHidden = false, metaDeleted = false, attRestored = null, tokenRestored = null;
  sandbox.OBR = {
    scene: {
      items: {
        getItemAttachments: async () => [att],
        updateItems: async (ids, fn) => {
          const drafts = ids.indexOf("att-1") >= 0 ? [Object.assign({}, att)] : [JSON.parse(JSON.stringify(token))];
          fn(drafts);
          for (const d of drafts) {
            if (d.id === "att-1") {
              att.visible = d.visible;
              if (d.visible === false) attHidden = true;
              else attRestored = d.visible;
            } else {
              if (!("com.example/vision" in d.metadata)) metaDeleted = true;
              if (d.visible === false) tokenHidden = true;
              else tokenRestored = d.visible;
              if (d.metadata) token.metadata = d.metadata;
            }
          }
        }
      },
      local: { getItemAttachments: async () => [] }
    }
  };
  const res = await P.moveTokensWithFogBypass([token], { "tok-fog": { x: 300, y: 400 } });
  if (token.metadata["com.example/vision"] === originalVision && token.metadata["4enext-owlbear/bind"] &&
    token.metadata.plain === 1 && att.visible === true && attHidden && tokenHidden && metaDeleted && tokenRestored === true)
    ok("①y 雾效 metadata 被临时剥离并原样恢复（引用一致），attachment/token visible 隐藏后恢复");
  else bad("①y fog bypass 恢复/隐藏不对：" + JSON.stringify({ meta: token.metadata, att: att.visible, attHidden, tokenHidden, metaDeleted, tokenRestored }));
  if (res.ext === 1 && res.att === 1 && res.hidTokens === 1) ok("①y 返回 ext/att/hidTokens 计数正确");
  else bad("①y bypass 计数不对：" + JSON.stringify(res));
  /* 无 fog 插件：不应改 visible / metadata，只写位置 */
  let updates = 0, visibleTouched = false;
  const plainTok = { id: "tok-plain", visible: true, metadata: { plain: 1 } };
  sandbox.OBR = {
    scene: { items: { getItemAttachments: async () => [], updateItems: async (ids, fn) => {
      updates++;
      const d = JSON.parse(JSON.stringify(plainTok)); fn([d]);
      if (d.visible === false) visibleTouched = true;
      plainTok.position = d.position;
    } }, local: { getItemAttachments: async () => [] } }
  };
  await P.moveTokensWithFogBypass([plainTok], { "tok-plain": { x: 10, y: 20 } });
  if (updates === 1 && !visibleTouched && plainTok.position.x === 10)
    ok("①y 无 fog metadata / attachment 时只写位置（0 次多余隐藏更新）");
  else bad("①y 无 fog 时仍改了 visible / 多余 update：" + JSON.stringify({ updates, visibleTouched, pos: plainTok.position }));
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
    player: { getRole: async () => "GM", getId: async () => "me" },
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
