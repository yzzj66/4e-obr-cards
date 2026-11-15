/* 4E NEXT 角色卡 · 后台逻辑（单文件「经典脚本」，没有任何 import / export）
 * ---------------------------------------------------------------------------
 * 这个文件不直接给浏览器加载：dev/build-background.mjs 会把它和
 * vendor/obr-sdk.js（去掉末尾 export{}）拼成 assets/background.bundle.js，
 * background.html 只加载那一个 <script src>（不带 type="module"）。
 *
 * 约定：外层作用域已经提供了 OBR（@owlbear-rodeo/sdk 的 default export）。
 *
 * 三个入口（任何一个活着就能打开面板）：
 *   1) manifest.action  → 房间左上角的扩展图标（由 manifest 提供，不依赖本文件）
 *   2) OBR.tool.create   → 左侧工具栏里的 4E 工具按钮
 *   3) OBR.popover.open  → 右下角浮动 4E 按钮（与参考实现 character-cards 相同写法）
 * 外加：右键 IMAGE token 的「绑定 4E NEXT 角色卡」（仅 GM）。
 *
 * 自诊断：每一步失败都 OBR.notification.show(..., "ERROR")，成功则在启动后汇总一条
 *        INFO 通知（可用 localStorage["4enext/diag"]="0" 关掉）。
 *        另外 background.html 里有一块页面内日志，直接打开 background.html 也能看到。
 * ------------------------------------------------------------------------- */

var NS = "com.4enext-owlbear";
var KEY_CARDS = NS + "/cards";
var KEY_BIND = NS + "/cardId";
var ID_BUTTON = NS + "/button";
var ID_INFO = NS + "/info";
var ID_PANEL = NS + "/panel";
var ID_BIND = NS + "/bind";
var TOOL_ID = NS + "/panel-tool";
var CH_HELLO = NS + "/diag-hello"; /* background → 各页面：我起来了 */
var CH_PING = NS + "/diag-ping";   /* 页面 → background：在吗 */
var CH_PONG = NS + "/diag-pong";   /* background → 页面：在，状态如下 */
var PLUGIN_VERSION = "1.2.0";
/* token 上的血量（与 assets/track.js 的 KEY_HP 必须一字不差）。 */
var KEY_HP = NS + "/hp";

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;
/* v1.2.0：速览弹窗里多了血量加减与资源追踪，宽高各放大一点。 */
var INFO_W = 400;
var INFO_H = 560;

/* ---------------------------------------------------------------------------
 * 0) 站点根地址
 *    参考实现（character-cards/src/background.ts 第 7~11 行）把 panel/info/bind
 *    的网址写成了绝对地址，而不是从 import.meta.url 推算。这里同样不依赖
 *    import.meta.url（它在 OBR 的 iframe 里未必是页面地址），改用背景页自己的
 *    location —— background.html 永远在插件根目录。
 * ------------------------------------------------------------------------- */
var BASE = (function () {
  try {
    var u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u.href;
  } catch (e) { /* 忽略 */ }
  try { return new URL("./", document.baseURI).href; } catch (e) { /* 忽略 */ }
  return "https://yzzj66.github.io/4e-obr-cards/";
})();

function pageUrl(name) { return BASE + name; }

var ICON_URL = pageUrl("icon.svg");
var TOOL_ICON_URL = pageUrl("icon-tool.svg");
var URL_PANEL = pageUrl("panel.html");
var URL_INFO = pageUrl("info.html");
var URL_BIND = pageUrl("bind.html");
var URL_BUTTON = pageUrl("button.html");

/* ---------------------------------------------------------------------------
 * 1) 自诊断小工具
 * ------------------------------------------------------------------------- */
function pageLog(kind, text) {
  var line = "[" + new Date().toISOString().slice(11, 19) + "] " + text;
  try {
    var box = document.getElementById("diag-log");
    if (box) {
      var li = document.createElement("li");
      li.className = "k-" + kind;
      li.textContent = line;
      box.appendChild(li);
    }
    var state = document.getElementById("diag-state");
    if (state) {
      if (kind === "err") {
        state.className = "bad";
        state.textContent = "最新错误：" + text;
      } else if (kind === "ok" && state.className !== "bad") {
        state.className = "good";
        state.textContent = "运行中：" + text;
      }
    }
  } catch (e) { /* 没有诊断 DOM 就算了 */ }
  try {
    if (kind === "err") console.error("[4enext]", line);
    else console.log("[4enext]", line);
  } catch (e) { /* 忽略 */ }
}

function diagNotifyEnabled() {
  try { return localStorage.getItem("4enext/diag") !== "0"; } catch (e) { return true; }
}

function notify(msg, variant) {
  try {
    return OBR.notification.show(msg, variant || "DEFAULT");
  } catch (e) {
    pageLog("err", "OBR.notification.show 失败：" + (e && e.message ? e.message : e));
    return null;
  }
}

function errText(e) {
  if (!e) return "未知错误";
  return e.message || e.reason || String(e);
}

/** 记录失败：页面日志 + ERROR 通知（不会重复弹同一条）。 */
var seenErrors = {};
function stepFail(where, e) {
  var msg = where + " —— " + errText(e);
  pageLog("err", msg);
  if (seenErrors[msg]) return;
  seenErrors[msg] = true;
  notify("4E插件出错：" + msg, "ERROR");
}

function stepOk(text) { pageLog("ok", text); }

/** 包一层 try/catch：同步版。返回 true/false。 */
function attempt(where, fn) {
  try {
    var r = fn();
    if (r && typeof r.then === "function") {
      return r.then(function () { stepOk(where + " ✓"); return true; }, function (e) { stepFail(where, e); return false; });
    }
    stepOk(where + " ✓");
    return Promise.resolve(true);
  } catch (e) {
    stepFail(where, e);
    return Promise.resolve(false);
  }
}

/* ---------------------------------------------------------------------------
 * 2) 打开面板（唯一真正的目标动作）
 *    失败时依次兜底：manifest action popover → 通知用户。
 * ------------------------------------------------------------------------- */
async function openPanel(where) {
  try {
    await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
    stepOk((where || "面板") + "：已打开");
    return true;
  } catch (e) {
    stepFail("打开角色卡面板（" + (where || "入口") + "）", e);
    try {
      await OBR.action.open();
      stepOk("面板打开失败，已改用左上角 action 弹窗");
      return true;
    } catch (e2) {
      stepFail("改用 action 弹窗也失败", e2);
      return false;
    }
  }
}

/* ---------------------------------------------------------------------------
 * 3) 入口 A：右下角浮动按钮（照抄 character-cards 的 openPopover）
 * ------------------------------------------------------------------------- */
var buttonOpen = false;
async function openButton() {
  var w = 0, h = 0;
  if (!OBR.viewport || typeof OBR.viewport.getWidth !== "function") {
    throw new Error("SDK 没有 OBR.viewport.getWidth（SDK 版本不匹配？）");
  }
  w = await OBR.viewport.getWidth();
  h = await OBR.viewport.getHeight();
  await OBR.popover.open({
    id: ID_BUTTON,
    url: URL_BUTTON,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    anchorReference: "POSITION",
    anchorPosition: { left: w - RIGHT_OFFSET, top: h - BOTTOM_OFFSET },
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    hidePaper: true,
    disableClickAway: true
  });
  buttonOpen = true;
}

async function closeButton() {
  try { await OBR.popover.close(ID_BUTTON); } catch (e) { /* 没开就算了 */ }
  buttonOpen = false;
}

/* ---------------------------------------------------------------------------
 * 4) 入口 B：左侧工具栏（OBR.tool.create，第三种入口，不依赖 popover）
 * ------------------------------------------------------------------------- */
async function registerTool() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") {
    throw new Error("SDK 没有 OBR.tool.create");
  }
  var def = {
    id: TOOL_ID,
    icons: [{ icon: TOOL_ICON_URL, label: "4E NEXT 角色卡：打开面板" }],
    /* 返回 false = 不切换成激活状态，只执行我们的回调 */
    onClick: function () {
      void openPanel("工具栏按钮");
      return false;
    }
  };
  try {
    await OBR.tool.create(def);
  } catch (e) {
    // 后台被重新加载过（同 id 还在）时先删再建，避免把"重复注册"误报成错误
    await OBR.tool.remove(TOOL_ID);
    await OBR.tool.create(def);
  }
}

/* ---------------------------------------------------------------------------
 * 5) 右键菜单：GM + 单个 IMAGE token（与参考实现 background.ts 第 231~258 行一致）
 * ------------------------------------------------------------------------- */
async function registerContextMenu() {
  if (!OBR.contextMenu || typeof OBR.contextMenu.create !== "function") {
    throw new Error("SDK 没有 OBR.contextMenu.create");
  }
  var def = {
    id: NS + "/bind-menu",
    icons: [{
      icon: ICON_URL,
      label: "绑定 4E NEXT 角色卡",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: async function (context) {
      var id = context && context.items && context.items[0] ? context.items[0].id : "";
      if (!id) {
        notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
        return;
      }
      try {
        await OBR.modal.open({
          id: ID_BIND,
          url: URL_BIND + "?item=" + encodeURIComponent(id),
          width: 440,
          height: 600
        });
        stepOk("绑定弹窗已打开");
      } catch (e) {
        stepFail("打开绑定弹窗", e);
      }
    }
  };
  try {
    await OBR.contextMenu.create(def);
  } catch (e) {
    // 同上：后台重载后同 id 可能还在，先删再建
    await OBR.contextMenu.remove(def.id);
    await OBR.contextMenu.create(def);
  }
}

/* ---------------------------------------------------------------------------
 * 6) 速览弹窗（选中绑定的 token 就弹）
 * ------------------------------------------------------------------------- */
var infoOpen = false;
var infoItemId = null;
var infoCardId = null;

async function getCards() {
  try {
    var meta = await OBR.room.getMetadata();
    var box = meta[KEY_CARDS];
    if (box && Array.isArray(box.cards)) return box.cards;
  } catch (e) {
    pageLog("err", "读取房间数据失败：" + errText(e));
  }
  return [];
}

function findCard(cards, id) {
  if (!id) return null;
  for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
  return null;
}

async function anchorOf(itemId) {
  try {
    var bounds = await OBR.scene.items.getItemBounds([itemId]);
    var scale = await OBR.viewport.getScale();
    var p = await OBR.viewport.transformPoint(bounds.center);
    return { left: p.x, top: Math.max(8, p.y - (bounds.height * scale) / 2 - 8) };
  } catch (e) {
    return null;
  }
}

async function openInfo(itemId, cardId) {
  var params = "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId);
  var anchor = await anchorOf(itemId);
  var vh = 0;
  try { vh = await OBR.viewport.getHeight(); } catch (e) { vh = 0; }
  var opts = {
    id: ID_INFO,
    url: URL_INFO + params,
    width: INFO_W,
    height: Math.min(INFO_H, Math.max(260, (vh || INFO_H + 40) - 40)),
    anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
    hidePaper: true,
    disableClickAway: true
  };
  if (anchor) {
    opts.anchorReference = "POSITION";
    opts.anchorPosition = anchor;
  } else {
    opts.anchorReference = "ELEMENT";
    opts.anchorElementId = itemId;
  }
  await OBR.popover.open(opts);
  infoOpen = true;
  infoItemId = itemId;
  infoCardId = cardId;
}

async function closeInfo() {
  if (!infoOpen) return;
  try { await OBR.popover.close(ID_INFO); } catch (e) { /* 已关闭 */ }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
}

var infoErrorShown = false;
async function refreshInfo() {
  var sel = null;
  try { sel = await OBR.player.getSelection(); } catch (e) { return; }
  if (!sel || sel.length !== 1) return closeInfo();
  var item = null;
  try {
    var items = await OBR.scene.items.getItems([sel[0]]);
    item = items[0] || null;
  } catch (e) {
    return closeInfo();
  }
  if (!item || !item.metadata) return closeInfo();
  var cardId = item.metadata[KEY_BIND];
  if (typeof cardId !== "string" || !cardId) return closeInfo();
  var cards = await getCards();
  if (!findCard(cards, cardId)) return closeInfo();
  if (infoOpen && infoItemId === item.id && infoCardId === cardId) return;
  if (infoOpen) await closeInfo();
  try {
    await openInfo(item.id, cardId);
  } catch (e) {
    if (!infoErrorShown) {
      infoErrorShown = true;
      stepFail("打开速览弹窗", e);
    }
  }
}

/* 拖 token / 改选择会连续触发事件，合并成一次刷新。 */
var pendingRefresh = null;
function scheduleRefresh() {
  if (pendingRefresh) return;
  pendingRefresh = setTimeout(function () {
    pendingRefresh = null;
    void refreshInfo();
  }, 120);
}

async function sceneReady() {
  try { return await OBR.scene.isReady(); } catch (e) { return false; }
}

/* ---------------------------------------------------------------------------
 * 7) token 血条（画在 token 上的图形层）
 * ---------------------------------------------------------------------------
 * 做法照抄参考实现 FullPeople/obr-suite 的 src/modules/bubbles/index.ts：
 *   · 不是「改 token 让 OBR 原生长血条」（OBR 没有这个能力），而是给 token 挂
 *     **本地图形子 item**（Curve 底条 + Curve 填充 + Text 数字），
 *     attachedTo = token id、layer = "ATTACHMENT"、disableHit、locked、固定 zIndex。
 *   · 用 OBR.scene.local.* 而不是 OBR.scene.items.* ：本地图形只在自己这台机器上画，
 *     不需要场景写权限 —— 玩家也能看到血条（场景写权限只有 GM 有）。
 *   · 尺寸/坐标全部按「已渲染」尺寸烘焙成世界坐标（参考实现 2026-05-10 的回退方案），
 *     并 disableAttachmentBehavior(["SCALE","ROTATION","LOCKED","COPY"])，
 *     避免 token 缩放时被二次放大；位移仍然跟着 token 走。
 *   · token 被删除时 OBR 会自动删掉挂在它上面的子 item；血条数据没了（解绑 / 手删）
 *     我们就主动清理自己的本地 item；本地 item 被外部删掉时会自动重建。
 * 数值来源：token 元数据 com.4enext-owlbear/hp = { cur, max, temp, updatedAt }，
 * 与速览弹窗是同一份数据，所以弹窗里加减血 → 血条立刻跟着变。
 * ------------------------------------------------------------------------- */
var BAR_TAG = NS + "/bar"; /* 本地图形 item 的元数据：{ owner: tokenId, role: "bg"|"fill"|"text" } */

var barEntries = {};     /* tokenId -> { ids: [], sig: "" } */
var barTimer = null;
var barBusy = false;
var barAgain = false;
var barUnsupported = false;
var barSwept = false;
var cachedDpi = 0;

/* 这些构建器由 dev/build-background.mjs 从 SDK 的具名导出接到本作用域（buildCurve 等）。 */
function barBuildersOk() {
  return typeof buildCurve === "function" && typeof buildText === "function";
}

function readHpMeta(item) {
  var m = item && item.metadata ? item.metadata[KEY_HP] : null;
  if (!m || typeof m !== "object") return null;
  var cur = typeof m.cur === "number" && isFinite(m.cur) ? Math.round(m.cur) : null;
  var max = typeof m.max === "number" && isFinite(m.max) && m.max > 0 ? Math.round(m.max) : null;
  var temp = typeof m.temp === "number" && isFinite(m.temp) ? Math.max(0, Math.round(m.temp)) : 0;
  if (cur === null && max === null) return null;
  return { cur: cur, max: max, temp: temp };
}

async function sceneDpi() {
  if (cachedDpi > 0) return cachedDpi;
  try {
    if (OBR.scene.grid && typeof OBR.scene.grid.getDpi === "function") cachedDpi = await OBR.scene.grid.getDpi();
  } catch (e) {
    cachedDpi = 0;
  }
  if (!(cachedDpi > 0)) cachedDpi = 150;
  return cachedDpi;
}

/** 圆角矩形（锚点在左上角、y 向下，与参考实现的 roundedRectanglePoints 同构）。 */
function roundRectPoints(w, h, r, fill) {
  if (r * 2 > h) r = h / 2;
  if (r * 2 > w) r = w / 2;
  var seg = 6;
  function arc(cx, cy, from, to) {
    var out = [];
    if (r <= 0) {
      for (var k = 0; k <= seg; k++) out.push({ x: cx, y: cy });
      return out;
    }
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var a = from + (to - from) * t;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }
  var f = typeof fill === "number" ? Math.max(0.0001, Math.min(1, fill)) : 1;
  var filled = Math.max(0, Math.min(w, f * w));
  if (f >= 1) {
    return [].concat(
      arc(r, r, -Math.PI, -Math.PI / 2),
      arc(w - r, r, -Math.PI / 2, 0),
      arc(w - r, h - r, 0, Math.PI / 2),
      arc(r, h - r, Math.PI / 2, Math.PI)
    );
  }
  if (filled <= r) {
    return [].concat(
      arc(r, r, -Math.PI, -Math.PI / 2),
      [{ x: r, y: 0 }, { x: r, y: h }],
      arc(r, h - r, Math.PI / 2, Math.PI)
    );
  }
  return [].concat(
    arc(r, r, -Math.PI, -Math.PI / 2),
    [{ x: filled - r, y: 0 }],
    arc(filled - r, r, -Math.PI / 2, 0),
    arc(filled - r, h - r, 0, Math.PI / 2),
    [{ x: filled - r, y: h }],
    arc(r, h - r, Math.PI / 2, Math.PI)
  );
}

/** 由 token 的世界包围盒推出血条几何（与参考实现同一套比例）。 */
function barLayout(bounds, dpi, hp) {
  var max = hp.max > 0 ? hp.max : (hp.cur !== null ? Math.max(1, hp.cur) : 1);
  var cur = hp.cur === null ? max : hp.cur;
  var ratio = Math.max(0, Math.min(1, cur / max));
  var s = Math.min(bounds.width, bounds.height) / dpi;
  if (!isFinite(s) || s <= 0) s = 1;
  s = Math.max(0.2, Math.min(6, s));
  var h = 20 * s;
  var pad = 2 * s;
  var w = Math.max(h * 2, bounds.width - pad * 2);
  var radius = h / 2;
  var text = String(cur) + "/" + max + (hp.temp > 0 ? " +" + hp.temp : "");
  var fs = Math.min(h * 1.05, (w / Math.max(4, text.length)) * 1.5);
  fs = Math.max(6 * s, fs);
  return {
    left: bounds.center.x - w / 2,
    top: bounds.max.y - pad - h,
    w: w, h: h, radius: radius, ratio: ratio, text: text, fontSize: fs, scale: s
  };
}

function barMeta(tokenId, role) {
  var box = {};
  box[BAR_TAG] = { owner: tokenId, role: role };
  return box;
}

function barCommon(builder, tokenId, role, z) {
  return builder
    .position({ x: 0, y: 0 })
    .layer("ATTACHMENT")
    .attachedTo(tokenId)
    .locked(true)
    .disableHit(true)
    .visible(true)
    .disableAutoZIndex(true)
    .zIndex(z)
    .disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"])
    .metadata(barMeta(tokenId, role));
}

function buildBarItems(tokenId, L) {
  var items = [];
  var bgPoints = roundRectPoints(L.w, L.h, L.radius, 1);
  items.push(barCommon(buildCurve(), tokenId, "bg", 10000)
    .fillColor("#A4A4A4").fillOpacity(0.6)
    /* 参考实现的标准模式没有描边（顶部模式才有），这里保持一致 */
    .strokeColor("#000000").strokeOpacity(0).strokeWidth(0)
    .tension(0).closed(true).points(bgPoints)
    .position({ x: L.left, y: L.top })
    .build());
  items.push(barCommon(buildCurve(), tokenId, "fill", 20000)
    .fillColor("#a52424").fillOpacity(0.85)
    .strokeOpacity(0).strokeWidth(0)
    .tension(0).closed(true).points(roundRectPoints(L.w, L.h, L.radius, L.ratio))
    .position({ x: L.left, y: L.top })
    .build());
  if (typeof buildText === "function") {
    items.push(barCommon(buildText(), tokenId, "text", 30000)
      .plainText(L.text).textType("PLAIN")
      .textAlign("CENTER").textAlignVertical("MIDDLE")
      .fontFamily("Roboto, sans-serif").fontSize(L.fontSize).fontWeight(700)
      .fillColor("#ffffff").fillOpacity(1)
      .strokeColor("#000000").strokeOpacity(0.7).strokeWidth(Math.max(0.4, L.h * 0.075))
      .lineHeight(0.95).width(L.w).height(L.h)
      .position({ x: L.left, y: L.top })
      .build());
  }
  return items;
}

async function addBar(tokenId, L) {
  var items = buildBarItems(tokenId, L);
  await OBR.scene.local.addItems(items);
  var ids = [];
  for (var i = 0; i < items.length; i++) ids.push(items[i].id);
  return ids;
}

async function patchBar(entry, L) {
  await OBR.scene.local.updateItems(entry.ids, function (drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var tag = d.metadata && d.metadata[BAR_TAG] ? d.metadata[BAR_TAG] : null;
      var role = tag && tag.role ? tag.role : (tag ? "bg" : "");
      if (role === "bg") {
        d.position = { x: L.left, y: L.top };
        d.points = roundRectPoints(L.w, L.h, L.radius, 1);
        d.visible = true;
      } else if (role === "fill") {
        d.position = { x: L.left, y: L.top };
        d.points = roundRectPoints(L.w, L.h, L.radius, L.ratio);
        d.visible = L.ratio > 0;
      } else if (role === "text") {
        if (!d.text) continue;
        d.text.plainText = L.text;
        d.text.style.fontSize = L.fontSize;
        d.text.width = L.w;
        d.text.height = L.h;
        d.position = { x: L.left, y: L.top };
        d.visible = true;
      }
    }
  });
}

async function removeBar(tokenId) {
  var entry = barEntries[tokenId];
  if (!entry) return;
  delete barEntries[tokenId];
  try {
    await OBR.scene.local.deleteItems(entry.ids);
  } catch (e) { /* 已经没了就算了 */ }
}

async function clearBars() {
  var ids = Object.keys(barEntries);
  for (var i = 0; i < ids.length; i++) await removeBar(ids[i]);
}

function scheduleBars() {
  if (barTimer) return;
  barTimer = setTimeout(function () {
    barTimer = null;
    void syncBars();
  }, 90);
}

/**
 * 启动时清扫上一次后台实例留下的血条 item。
 * 本地图形 item 会一直留到整页刷新，而扩展关掉再打开只会重载 iframe ——
 * 不清的话会出现「两层一模一样的血条」（视觉上看不出来，但会一直叠着）。
 * 只做一次，且在建立任何 barEntries 之前，所以不会误删自己刚画的。
 */
async function sweepStaleBars() {
  if (barSwept) return;
  barSwept = true;
  try {
    if (!OBR.scene.local || typeof OBR.scene.local.getItems !== "function") return;
    var items = await OBR.scene.local.getItems();
    var stale = [];
    for (var i = 0; i < items.length; i++) {
      var tag = items[i].metadata ? items[i].metadata[BAR_TAG] : null;
      if (tag && !barEntries[items[i].id]) stale.push(items[i].id);
    }
    if (stale.length) {
      await OBR.scene.local.deleteItems(stale);
      pageLog("info", "清理了 " + stale.length + " 个上一次会话残留的血条 item");
    }
  } catch (e) { /* 拿不到本地 item 就算了 */ }
}

/** 把「场景里所有带 hp 元数据的 token」与本地血条 item 对齐。 */
async function syncBars() {
  if (barUnsupported) return;
  if (barBusy) { barAgain = true; return; }
  barBusy = true;
  try {
    if (!(await sceneReady())) { await clearBars(); return; }
    if (!barBuildersOk() || !OBR.scene.local || typeof OBR.scene.local.addItems !== "function") {
      barUnsupported = true;
      pageLog("err", "SDK 里没有 buildCurve / scene.local：token 血条不可用（其它功能不受影响）");
      return;
    }
    await sweepStaleBars();
    var items = await OBR.scene.items.getItems();
    var dpi = await sceneDpi();
    var want = {};
    var order = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type !== "IMAGE") continue;
      var hp = readHpMeta(it);
      if (!hp) continue;
      want[it.id] = hp;
      order.push(it.id);
    }
    var known = Object.keys(barEntries);
    for (var j = 0; j < known.length; j++) {
      if (!want[known[j]]) await removeBar(known[j]);
    }
    for (var k = 0; k < order.length; k++) {
      var id = order[k];
      var bounds = null;
      try {
        bounds = await OBR.scene.items.getItemBounds([id]);
      } catch (e) {
        continue;
      }
      if (!bounds || !bounds.center) continue;
      var L = barLayout(bounds, dpi, want[id]);
      var sig = [want[id].cur, want[id].max, want[id].temp,
        Math.round(L.w), Math.round(L.h), Math.round(L.left), Math.round(L.top)].join("|");
      var entry = barEntries[id];
      if (entry && entry.sig === sig && !entry.force) continue;
      if (entry && !entry.force) {
        try {
          await patchBar(entry, L);
          entry.sig = sig;
          continue;
        } catch (e) {
          await removeBar(id);
        }
      } else if (entry) {
        /* 本地图形被外部删掉了：删掉残留记录，下面按新几何重画 */
        await removeBar(id);
      }
      try {
        barEntries[id] = { ids: await addBar(id, L), sig: sig };
      } catch (e) {
        pageLog("err", "画血条失败（" + id + "）：" + errText(e));
      }
    }
  } catch (e) {
    pageLog("err", "同步 token 血条失败：" + errText(e));
  } finally {
    barBusy = false;
    if (barAgain) { barAgain = false; scheduleBars(); }
  }
}

/** 本地血条被别的插件 / 手滑删掉时自动补回来。 */
async function watchLocalBars() {
  if (!OBR.scene.local || typeof OBR.scene.local.onChange !== "function") return;
  await attempt("订阅 scene.local.onChange（血条自愈）", function () {
    OBR.scene.local.onChange(function (items) {
      if (barBusy) return;
      var seen = {};
      for (var i = 0; i < items.length; i++) seen[items[i].id] = true;
      var ids = Object.keys(barEntries);
      for (var j = 0; j < ids.length; j++) {
        var own = barEntries[ids[j]].ids;
        for (var k = 0; k < own.length; k++) {
          if (!seen[own[k]]) {
            barEntries[ids[j]].force = true;
            scheduleBars();
            return;
          }
        }
      }
    });
  });
}

/* ---------------------------------------------------------------------------
 * 8) 启动
 * ------------------------------------------------------------------------- */
var booted = false;
var bootStatus = { tool: false, menu: false, button: false, scene: false };

async function syncSceneButton() {
  if (!booted) return false;
  if (await sceneReady()) {
    bootStatus.scene = true;
    try {
      await openButton();
      return true;
    } catch (e) {
      if (!bootStatus.button) stepFail("打开右下角浮动按钮", e);
      return false;
    }
  }
  await closeButton();
  await closeInfo();
  return false;
}

async function sendHello(channel, payload) {
  try {
    await OBR.broadcast.sendMessage(channel, payload, { destination: "LOCAL" });
  } catch (e) {
    pageLog("err", "broadcast 失败：" + errText(e));
  }
}

async function boot() {
  if (booted) return;
  booted = true;
  var t0 = Date.now();

  pageLog("info", "OBR.onReady 触发；插件 v" + PLUGIN_VERSION + "；BASE=" + BASE);
  pageLog("info", "OBR.isAvailable=" + String(OBR.isAvailable) + "；isReady=" + String(OBR.isReady));

  /* 7.1 入口 B：工具栏 */
  bootStatus.tool = await attempt("注册工具栏按钮 (OBR.tool.create)", registerTool);

  /* 7.2 右键菜单 */
  bootStatus.menu = await attempt("注册右键菜单 (OBR.contextMenu.create)", registerContextMenu);

  /* 7.3 右下角浮动按钮（要等场景就绪） */
  bootStatus.scene = await sceneReady();
  bootStatus.button = await syncSceneButton();
  if (bootStatus.button) stepOk("打开右下角浮动按钮 ✓");
  else if (!bootStatus.scene) stepOk("场景还没就绪，浮动按钮等进入地图后再开");

  /* 7.4 事件订阅 */
  await attempt("订阅 scene.onReadyChange", function () {
    OBR.scene.onReadyChange(function () {
      void syncSceneButton();
      scheduleBars();
    });
  });
  await attempt("订阅 player.onChange", function () {
    OBR.player.onChange(scheduleRefresh);
  });
  await attempt("订阅 scene.items.onChange", function () {
    OBR.scene.items.onChange(function () {
      scheduleRefresh();
      scheduleBars();
    });
  });
  await attempt("订阅 scene.grid.onChange（血条尺寸）", function () {
    if (!OBR.scene.grid || typeof OBR.scene.grid.onChange !== "function") return;
    OBR.scene.grid.onChange(function () {
      cachedDpi = 0;
      scheduleBars();
    });
  });
  await attempt("订阅 room.onMetadataChange", function () {
    OBR.room.onMetadataChange(scheduleRefresh);
  });
  await attempt("订阅 viewport.onChange", function () {
    if (!OBR.viewport || typeof OBR.viewport.onChange !== "function") return; /* 旧版 SDK 没有 */
    var timer = null;
    OBR.viewport.onChange(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        void syncSceneButton();
      }, 250);
    });
  });

  await refreshInfo().catch(function (e) { stepFail("初始化速览", e); });

  /* 7.5 token 血条：先挂自愈监听，再把现有 token 画一遍 */
  await watchLocalBars();
  scheduleBars();

  /* 7.6 汇总一条通知：一眼看出哪个入口没注册上 */
  var mark = function (v) { return v ? "✓" : "✗"; };
  var okLine = "4E 角色卡 v" + PLUGIN_VERSION + " 已加载：工具栏" + mark(bootStatus.tool) +
    " · 右键" + mark(bootStatus.menu) +
    " · 浮动按钮" + (bootStatus.scene ? mark(bootStatus.button) : "（等进地图）");
  var allOk = bootStatus.tool && bootStatus.menu;
  pageLog(allOk ? "ok" : "err", okLine + "；耗时 " + (Date.now() - t0) + "ms");
  if (diagNotifyEnabled()) notify(okLine, allOk ? "INFO" : "WARNING");

  /* 7.7 心跳：告诉面板「后台活着」，面板也会 ping 回来 */
  await sendHello(CH_HELLO, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
  try {
    OBR.broadcast.onMessage(CH_PING, function () {
      void sendHello(CH_PONG, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
    });
  } catch (e) {
    pageLog("err", "订阅 " + CH_PING + " 失败：" + errText(e));
  }
}

/* ---------------------------------------------------------------------------
 * 8) 启动保护：任何未捕获错误都变成可见通知（而不是静默死掉）
 * ------------------------------------------------------------------------- */
try {
  window.addEventListener("error", function (ev) {
    var msg = ev && ev.message ? ev.message : "脚本错误";
    pageLog("err", "未捕获错误：" + msg);
    if (booted) notify("4E插件出错（脚本异常）：" + msg, "ERROR");
  });
  window.addEventListener("unhandledrejection", function (ev) {
    var msg = errText(ev && ev.reason);
    pageLog("err", "未处理的 Promise 拒绝：" + msg);
    if (booted) notify("4E插件出错（异步异常）：" + msg, "ERROR");
  });
} catch (e) { /* 忽略 */ }

/* OBR 环境自检 */
if (typeof OBR === "undefined" || !OBR) {
  pageLog("err", "没有拿到 OBR 对象：vendor/obr-sdk.js 可能没加载成功");
} else if (OBR.isAvailable === false) {
  pageLog("err", "OBR.isAvailable=false：这个页面不是被 Owlbear 打开的（直接开 background.html 时会这样）");
} else {
  try {
    OBR.onReady(function () {
      Promise.resolve(boot()).catch(function (e) {
        stepFail("后台启动", e);
      });
    });
    pageLog("info", "已注册 OBR.onReady，等待房间握手…");
  } catch (e) {
    pageLog("err", "OBR.onReady 注册失败：" + errText(e));
  }
}
