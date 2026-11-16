/* 4eNEXT to owlbear · 后台逻辑（单文件「经典脚本」，没有 import / export）
 * ---------------------------------------------------------------------------
 * 本文件不直接被浏览器加载：dev/build-background.mjs 把它和 vendor/obr-sdk.js
 * （去掉末尾 export{}）拼成 assets/background.bundle.js，background.html 只加载那一个
 * <script src>。外层作用域已经提供了 OBR（SDK 的 default export）。
 *
 * 窗口（各自一个 popover id，可同时打开；尺寸都是常量，见 WINS / *_W / *_H）：
 *   /info 速览 · /panel 角色卡 · /initiative-window 先攻列表 · /initiative-strip 先攻条
 *   /dice-window 骰子 · /dice-history-window 记录 · /hp-edit 血条编辑 · /settings-window 设置
 * 入口：工具栏 ×5（速览 / 角色卡 / 先攻 / 骰子 / 设置）、右下浮动按钮、右键 IMAGE token
 *   （绑定角色卡 / 加入 · 移出先攻 / 添加 · 移除血条组件 / 编辑血条）。
 *
 * 房间数据（键前缀 com.4enext-owlbear/，宿主硬上限 16 KB）：
 *   · 一律经 roomWriteGuarded() 写：先按预算（14 KB）算体积，超了**不写** + ERROR 通知；
 *   · 角色卡写不下就降级本机（localStorage["4enext/cards-local"]），写入前同样查单卡 2 KB；
 *   · 键：cards（精简卡）/ initiative（≤40 条）/ rolls（≤20 条）/ 其余都是小设置。
 *
 * 几条不能改的约定（改了会破真机）：
 *   · manifest 不加 action；只改 owlbear-plugin/ 下的文件，不自造构建步骤；
 *   · 先攻条只用 popover（hidePaper + disableClickAway）；modal + disablePointerEvents
 *     会把整条交互打穿，永远不要再走那条路；
 *   · 透明靠页面 inline !important + <meta name="darkreader-lock">（照抄 FullPeople/obr-suite，
 *     类名 / 样式表 !important 压不住后加载样式表与暗色扩展）；
 *   · 频道名 / 本机键名 / 数据键名不改（旧存档不丢），与 assets/common.js 逐字一致；
 *   · 写入失败一律看得见（ERROR / WARNING），成功不弹通知（v1.7.8 起的口径）。
 *
 * 版本史见 CHANGELOG.md；常数在哪调、怎么重建 bundle 见 docs/NOTES.md。
 * ------------------------------------------------------------------------- */

var NS = "com.4enext-owlbear";
var KEY_CARDS = NS + "/cards";
/* v1.8.0：卡片也可以存在**当前场景的隐藏 item** 里（房间数据 16 KB 装不下时的全桌共享兜底）。
 * 与 assets/cards-scene.js 的 CARD_ITEM_KEY 必须一字不差（dev/check.mjs 会对比）。
 * item.metadata[KEY_CARD_ITEM] = { v: 1, card: { id, name, level, char, importedAt, exportedAt, updatedAt } } */
var KEY_CARD_ITEM = NS + "/card";
var KEY_BIND = NS + "/cardId";
var ID_BUTTON = NS + "/button";
var ID_INFO = NS + "/info";
var ID_PANEL = NS + "/panel";
var ID_BIND = NS + "/bind";

var ID_INIT_WIN = NS + "/initiative-window";
var ID_DICE_WIN = NS + "/dice-window";

var ID_DICE_HIST = NS + "/dice-history-window";

var ID_HP_EDIT = NS + "/hp-edit";

var ID_SETTINGS_WIN = NS + "/settings-window";

var ID_STRIP = NS + "/initiative-strip";
var TOOL_ID = NS + "/panel-tool";
var TOOL_INIT_ID = NS + "/initiative-tool";

var TOOL_GLANCE_ID = NS + "/glance-tool";
var TOOL_SETTINGS_ID = NS + "/settings-tool";
var CH_HELLO = NS + "/diag-hello";
var CH_PING = NS + "/diag-ping";
var CH_PONG = NS + "/diag-pong";
var PLUGIN_VERSION = "1.10.1";

var KEY_HP = NS + "/hp";

var KEY_HPBAR = NS + "/hp-bar/enabled";

var KEY_PLAYER_THRESHOLD = NS + "/settings.playerThreshold";

var ROOM_MAX_BYTES = 14 * 1024;
var ROOM_HARD_BYTES = 16 * 1024;
var ROOM_FULL_MESSAGE = "房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史";

var LS_CARDS = "4enext/cards-local";

/* ---- 0. 房间数据体积预算（超 14 KB 不写 → 降级本机 + ERROR） ---- */
function roomBytesOf(meta, patch) {
  var box = {};
  if (meta && typeof meta === "object") {
    for (var k in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, k) && k.indexOf(NS) === 0) box[k] = meta[k];
    }
  }
  if (patch && typeof patch === "object") {
    for (var k2 in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k2)) box[k2] = patch[k2];
    }
  }
  try {
    return JSON.stringify(box).length;
  } catch (e) {
    return 0;
  }
}

async function roomWriteGuarded(key, value) {
  var meta = {};
  try { meta = await OBR.room.getMetadata(); } catch (e) { meta = {}; }
  var patch = {};
  patch[key] = value;
  var bytes = roomBytesOf(meta, patch);
  if (bytes > ROOM_MAX_BYTES) return { ok: false, reason: "full", bytes: bytes };
  try {
    await OBR.room.setMetadata(patch);
    return { ok: true, reason: "", bytes: bytes };
  } catch (e2) {
    return { ok: false, reason: "error", bytes: bytes, error: e2 };
  }
}

function localCardsFallback() {
  try {
    var raw = localStorage.getItem(LS_CARDS);
    if (!raw) return null;
    var box = JSON.parse(raw);
    if (box && Array.isArray(box.cards) && box.cards.length) {
      return { cards: box.cards, updatedAt: typeof box.updatedAt === "number" ? box.updatedAt : 0 };
    }
  } catch (e) {  }
  return null;
}

/* v1.8.0 真机几何：四防从 30s 缩到 22s、贴角内缩从 4s 加到 8s，
 * 让「盾/圆 + 描边」整枚都落在 token 包围盒内（旧值会探出 token 外）。 */
var SHIELD_DIAMETER = 22;
var DEF_CIRCLE_DIAMETER = 22;

var DEF_CIRCLE_SEGMENTS = 24;

var SHIELD_INSET = 8;

var DEF_GAP = 6;

var DEF_AC_FILL_OPACITY = 0.18;
var DEF_AC_STROKE_OPACITY = 0.85;
var DEF_FILL_OPACITY = 0.9;
var DEF_STROKE_OPACITY = 0.45;

/* v1.8.0：环厚 10s → 7s（旧值太厚像黑盘子）、底环不透明度 0.55 → 0.35。 */
var HP_RING_THICK = 7;
var HP_RING_INSET = 2;
var HP_RING_SEGMENTS = 48;
var HP_RING_BG_OPACITY = 0.35;
var PLAYER_THRESHOLD_DEFAULT = 25;

var COLOR_HP_FILL = "#a52424";
/* 4E「血怒（bloodied）」：HP ≤ 上限一半时血量环换成这个更暗的红（只改颜色语义，不动数据）。 */
var COLOR_HP_BLOODIED = "#7f1416";

var COLOR_RING_BG = "#0b0f14";
var DEF_KEYS = ["ac", "fort", "reflex", "will"];

var DEF_ROW = ["fort", "reflex", "will", "ac"];

var DEF_CORNER = {
  fort: "left-top",
  reflex: "right-top",
  will: "left-bottom",
  ac: "right-bottom"
};

var DEF_DROP = ["will", "reflex", "fort"];

var DEF_COLORS = { ac: "#ffffff", fort: "#e3b341", reflex: "#56d364", will: "#a371f7" };

var BAR_Z = {
  "ring-bg": 9500,
  "ring-fill": 9800,
  "shield": 15000,
  "shield-text": 16000,
  "bar-text": 30000
};

var KEY_INIT = NS + "/init";

var INIT_MENU_ADD = NS + "/init-add";
var INIT_MENU_ADD_HIDDEN = NS + "/init-add-hidden";
var INIT_MENU_REMOVE = NS + "/init-remove";
var KEY_INITIATIVE = NS + "/initiative";
var CH_INIT_REQUEST = NS + "/init-request";

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;

var INFO_W = 660;
var INFO_H = 700;
var INFO_MIN_W = 360;

var INFO_TOKEN_GAP = 8;
var INFO_VIEW_MARGIN = 16;
var INFO_DRAG_IDLE_MS = 1500;
var INFO_POS_MAX = 40;
var INFO_POS_KEY = "4enext/info-pos";
var CH_INFO_DRAG = NS + "/info-drag";

var WIN_MARGIN = 16;
var WIN_DRAG_IDLE_MS = 1500;
var WIN_POS_KEY = "4enext/win-pos";
var CH_WIN_DRAG = NS + "/win-drag";

var CH_DICE_HIST_CMD = NS + "/dice-hist-cmd";
var CH_DICE_HIST_STATE = NS + "/dice-hist-state";

var CH_HP_EDIT_TARGET = NS + "/hp-edit-target";
var CH_HP_EDIT_READY = NS + "/hp-edit-ready";
var CH_HP_EDIT_SAVED = NS + "/hp-edit-saved";
/* v1.10.0：血条编辑窗「重绘」按钮 → 后台强制重算这张 token 的血条环 / 四防盾 / 资源徽记。 */
var CH_HP_REPAINT = NS + "/hp-repaint";
/* v1.8.9：信息窗单次挂载 —— 目标租约（换 token 只广播 target，不重开 popover）+ ready 握手。 */
var CH_INFO_TARGET = NS + "/info-target";
var CH_INFO_READY = NS + "/info-ready";
/* v1.9.0：页面刷新成功 ack —— 700ms 没收到就兜底关闭重开一次（极端情况下内容也能换过去）。 */
var CH_INFO_ACK = NS + "/info-ack";

var HPE_W = 344;
var HPE_H = 106;

var STRIP_COLLAPSED_W = 120;
var STRIP_COLLAPSED_H = 40;
var STRIP_EXPANDED_W = 720;
var STRIP_MIN_EXPANDED_W = 410;

var STRIP_H_IDLE = 170;
var STRIP_H_PREPARING = 180;
var STRIP_H_COMBAT = 200;
var STRIP_TOP_OFFSET = 45;
var STRIP_SIDE_MARGIN = 16;
var STRIP_POS_KEY = "4enext/strip-pos";

var STRIP_AUTOSTART_KEY = "4enext/strip-autostart";
var STRIP_CLOSED_KEY = "4enext/strip-closed-this-session";
/* v1.9.2：骰子记录窗口默认进入房间自动打开（可在设置关掉；本次会话 ✕ 后不再自动开）。 */
var DICE_HIST_AUTOSTART_KEY = "4enext/dice-hist-autostart";
var DICE_HIST_CLOSED_KEY = "4enext/dice-hist-closed";

var STRIP_COLLAPSED_KEY = "4enext/strip-collapsed";
var CH_STRIP_DRAG = NS + "/strip-drag";
var CH_STRIP_CMD = NS + "/strip-cmd";

var CH_WIN_CLOSE = NS + "/win-close";
/* v1.8.2：先攻条点卡片时页面先广播这个频道，后台 1.5s 内不自动弹速览（与 common.js 逐字一致）。 */
var CH_GLANCE_SUPPRESS = NS + "/glance-suppress";

var CH_ROLL = NS + "/roll";
var CH_ROLL_CLEAR = NS + "/roll-clear";
var CH_ROLL_SAVED = NS + "/roll-saved";
var KEY_ROLLS = NS + "/rolls";
var ROLL_MAX_ROWS = 20;
var ROLL_MAX_DICE = 30;
var ROLL_LABEL_MAX = 40;
var ROLL_EXPR_MAX = 200;
var ROLL_ROOM_BYTES = 12000;
var ROLL_COLOR_DEFAULT = "#5dade2";

var BASE = (function () {
  try {
    var u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u.href;
  } catch (e) {  }
  try { return new URL("./", document.baseURI).href; } catch (e) {  }
  return "https://yzzj66.github.io/4e-obr-cards/";
})();

function pageUrl(name) { return BASE + name; }

var ICON_URL = pageUrl("icon.svg");
var TOOL_ICON_URL = pageUrl("icon-tool.svg");

var TOOL_INIT_ICON_URL = pageUrl("icon-tool-initiative.svg");

var TOOL_GLANCE_ICON_URL = pageUrl("icon-tool-glance.svg");
var TOOL_SETTINGS_ICON_URL = pageUrl("icon-tool-settings.svg");
var URL_PANEL = pageUrl("panel.html");
var URL_INFO = pageUrl("info.html");

var URL_INITIATIVE = pageUrl("initiative.html");
var URL_DICE = pageUrl("dice.html");

var URL_DICE_HIST = pageUrl("dice-history.html");

var URL_HP_EDIT = pageUrl("hp-edit.html");

var URL_SETTINGS = pageUrl("settings.html");
var URL_BIND = pageUrl("bind.html");
var URL_BUTTON = pageUrl("button.html");

/* ---- 1. 日志 / 通知 / 失败上报（成功不打扰，失败必可见） ---- */
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
  } catch (e) {  }
  try {
    if (kind === "err") console.error("[4enext]", line);
    else console.log("[4enext]", line);
  } catch (e) {  }
}

function diagNotifyEnabled() {
  try { return localStorage.getItem("4enext/diag") !== "0"; } catch (e) { return true; }
}

function notify(msg, variant) {
  if (variant !== "ERROR" && variant !== "WARNING") {
    pageLog("info", msg);
    return null;
  }
  try {
    return OBR.notification.show(msg, variant);
  } catch (e) {
    pageLog("err", "OBR.notification.show 失败：" + (e && e.message ? e.message : e));
    return null;
  }
}

function errText(e) {
  if (!e) return "未知错误";
  return e.message || e.reason || String(e);
}

var seenErrors = {};
function stepFail(where, e) {
  var msg = where + " —— " + errText(e);
  pageLog("err", msg);
  if (seenErrors[msg]) return;
  seenErrors[msg] = true;
  notify("4E插件出错：" + msg, "ERROR");
}

function stepOk(text) { pageLog("ok", text); }

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

var WINS = {

  panel: { id: ID_PANEL, url: URL_PANEL, width: 960, height: 660 },

  initiative: { id: ID_INIT_WIN, url: URL_INITIATIVE + "?view=list", width: 880, height: 640 },

  dice: { id: ID_DICE_WIN, url: URL_DICE, width: 320, height: 620 },

  diceHistory: { id: ID_DICE_HIST, url: URL_DICE_HIST, width: 300, height: 240 },

  settings: { id: ID_SETTINGS_WIN, url: URL_SETTINGS, width: 860, height: 620 },

  hpEdit: { id: ID_HP_EDIT, url: URL_HP_EDIT, width: HPE_W, height: HPE_H }
};

var winOpen = {};

var winDragWanted = {};
var winDragBusy = false;

/* ---- 2. 独立窗口：WINS 注册 / 尺寸夹紧 / 位置记忆 / 拖动 ---- */
function winDef(name) {
  return WINS[name] || null;
}

function winSize(def, vp) {
  var availW = (vp && vp.width > 0 ? vp.width : def.width) - WIN_MARGIN * 2;
  var availH = (vp && vp.height > 0 ? vp.height : def.height) - WIN_MARGIN * 2;
  return {
    width: Math.round(Math.min(def.width, Math.max(240, availW))),
    height: Math.round(Math.min(def.height, Math.max(220, availH)))
  };
}

function winDefaultPos(name, size, vp) {
  var vw = vp && vp.width > 0 ? vp.width : size.width + WIN_MARGIN * 2;
  var vh = vp && vp.height > 0 ? vp.height : size.height + WIN_MARGIN * 2;
  var base = clampInfoPos(
    (vw - size.width) / 2,
    Math.max(WIN_MARGIN, (vh - size.height) * 0.35),
    size, vp
  );
  if (name !== "diceHistory") return base;
  var st = winOpen["dice"];
  var g = st && st.geom ? st.geom : null;
  if (!g) return base;
  var gap = 12;
  var spots = [
    { left: g.left + g.width + gap, top: g.top },
    { left: g.left - size.width - gap, top: g.top },
    { left: g.left, top: g.top + g.height + gap },
    { left: g.left, top: g.top - size.height - gap }
  ];
  for (var i = 0; i < spots.length; i++) {
    var one = spots[i];
    if (one.left < WIN_MARGIN || one.top < WIN_MARGIN) continue;
    if (one.left + size.width > vw - WIN_MARGIN || one.top + size.height > vh - WIN_MARGIN) continue;
    return { left: Math.round(one.left), top: Math.round(one.top) };
  }
  return base;
}

function readWinPosMap() {
  try {
    var raw = localStorage.getItem(WIN_POS_KEY);
    if (!raw) return {};
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return {};
    var src = box.pos && typeof box.pos === "object" ? box.pos : box;
    var out = {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var one = src[k];
      if (!one || typeof one !== "object") continue;
      if (typeof one.left !== "number" || typeof one.top !== "number") continue;
      if (!isFinite(one.left) || !isFinite(one.top)) continue;
      out[k] = { left: one.left, top: one.top };
    }
    return out;
  } catch (e) {
    return {};
  }
}

function readWinPos(name) {
  if (!name) return null;
  return readWinPosMap()[name] || null;
}

function writeWinPos(name, pos) {
  if (!name || !pos) return;
  try {
    var map = readWinPosMap();
    map[name] = { left: Math.round(pos.left), top: Math.round(pos.top) };
    localStorage.setItem(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function clearWinPos(name) {
  if (!name) return;
  try {
    var map = readWinPosMap();
    delete map[name];
    if (!Object.keys(map).length) localStorage.removeItem(WIN_POS_KEY);
    else localStorage.setItem(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function winPopoverOptions(def, pos, size, url) {
  return {
    id: def.id,
    url: url,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",
    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true
  };
}

async function openWin(name, urlOverride) {
  var def = winDef(name);
  if (!def) throw new Error("未知窗口：" + name);
  var url = typeof urlOverride === "string" && urlOverride ? urlOverride : def.url;
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var saved = readWinPos(name);
  var pos = saved ? clampInfoPos(saved.left, saved.top, size, vp) : winDefaultPos(name, size, vp);
  await OBR.popover.open(winPopoverOptions(def, pos, size, url));
  winOpen[name] = {
    geom: {
      left: pos.left, top: pos.top, width: size.width, height: size.height,
      url: url, vp: { width: vp.width, height: vp.height }
    },
    drag: null,
    timer: null
  };
  return true;
}

async function closeWin(name) {
  var st = winOpen[name];
  if (st && st.timer) { clearTimeout(st.timer); st.timer = null; }
  delete winOpen[name];
  var def = winDef(name);
  if (!def) return;
  try { await OBR.popover.close(def.id); } catch (e) {  }
}

async function closeWinById(name) {
  var def = name === "info" ? { id: ID_INFO } : winDef(name);
  if (!def) return false;
  if (name === "info") {
    /* v1.8.5：用户手动 ✕ 关掉速览 → 记住这枚 token，选中不变之前不再自动弹回（修「莫名其妙跳出来」）。 */
    if (infoItemId) infoAutoPopped[infoItemId] = true;
    infoOpen = false;
    infoItemId = null;
    infoCardId = null;
    infoGeom = null;
    /* v1.8.9：关窗清掉目标租约，下次打开重新分配 session。 */
    resetInfoTarget();
  } else {
    var st = winOpen[name];
    if (st && st.timer) { clearTimeout(st.timer); st.timer = null; }
    delete winOpen[name];
    /* v1.8.1：手动 ✕ 关掉血条编辑窗后，别再对同一个选中 token 自动弹（要再改就右键「编辑血条」）。 */
    if (name === "hpEdit" && hpEditTarget.itemId) hpAutoPopped[hpEditTarget.itemId] = true;
    /* v1.9.2：用户 ✕ 关掉骰子记录窗口 → 本次会话不再自动打开。 */
    if (name === "diceHistory") markDiceHistClosed(true);
  }
  try { await OBR.popover.close(def.id); } catch (e) {  }
  try { if (OBR.modal && typeof OBR.modal.close === "function") await OBR.modal.close(def.id); } catch (e2) {  }
  pageLog("info", "窗口 ✕（后台兜底）：" + name);
  return true;
}

function onWinClose(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.op !== "close-win" || typeof data.name !== "string") return;
  void closeWinById(data.name);
}

async function resetWin(name) {
  if (!winOpen[name] || !winOpen[name].geom) return;
  var def = winDef(name);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var pos = winDefaultPos(name, size, vp);
  var url = winOpen[name].geom ? winOpen[name].geom.url : def.url;
  try {
    await OBR.popover.open(winPopoverOptions(def, pos, size, url));
    winOpen[name].geom = {
      left: pos.left, top: pos.top, width: size.width, height: size.height,
      url: url, vp: { width: vp.width, height: vp.height }
    };
    winOpen[name].drag = null;
    pageLog("info", "窗口 " + name + " 已回到默认位置");
  } catch (e) {
    stepFail("把窗口 " + name + " 移回默认位置", e);
  }
}

function queueWinDrag(name, pos) {
  var st = winOpen[name];
  if (!st || !st.geom) return;
  winDragWanted[name] = {
    pos: { left: pos.left, top: pos.top },
    size: { width: st.geom.width, height: st.geom.height },
    url: st.geom.url
  };
  void pumpWinDrag();
}

async function pumpWinDrag() {
  if (winDragBusy) return;
  winDragBusy = true;
  try {
    while (true) {
      var names = Object.keys(winDragWanted);
      if (!names.length) break;
      var name = names[0];
      var job = winDragWanted[name];
      delete winDragWanted[name];
      var def = winDef(name);
      var st = winOpen[name];
      if (!def || !st) continue;
      try {
        await OBR.popover.open(winPopoverOptions(def, job.pos, job.size, job.url));
        st.geom.left = job.pos.left;
        st.geom.top = job.pos.top;
      } catch (e) {
        pageLog("err", "拖动窗口 " + name + " 失败：" + errText(e));
      }
    }
  } finally {
    winDragBusy = false;
    if (Object.keys(winDragWanted).length) void pumpWinDrag();
  }
}

function touchWinDrag(name) {
  var st = winOpen[name];
  if (!st) return;
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(function () {
    st.timer = null;
    if (!st.drag) return;
    if (st.drag.moved && st.geom) writeWinPos(name, st.geom);
    st.drag = null;
  }, WIN_DRAG_IDLE_MS);
}

function endWinDrag(name) {
  var st = winOpen[name];
  if (!st) return;
  if (st.timer) { clearTimeout(st.timer); st.timer = null; }
  st.drag = null;
}

function onWinDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;
  var name = String(data.win == null ? "" : data.win);
  var st = winOpen[name];

  if (!st || !st.geom) return;

  if (data.phase === "reset") {
    clearWinPos(name);
    st.drag = null;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    void resetWin(name);
    return;
  }

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !st.drag) {

    st.drag = { base: { left: st.geom.left, top: st.geom.top }, moved: false };
    touchWinDrag(name);
    if (data.phase === "start") return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) st.drag.moved = true;

  if (!st.drag.moved) {
    if (data.phase === "end") endWinDrag(name);
    return;
  }

  var target = clampInfoPos(st.drag.base.left + dx, st.drag.base.top + dy, st.geom, st.geom.vp);
  queueWinDrag(name, target);
  touchWinDrag(name);

  if (data.phase === "end") {
    writeWinPos(name, target);
    endWinDrag(name);
  }
}

async function reclampWins() {
  var names = Object.keys(winOpen);
  if (!names.length) return;
  var vp = await infoViewport();
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var def = winDef(name);
    var st = winOpen[name];
    if (!def || !st || !st.geom) continue;
    var size = winSize(def, vp);
    var pos = clampInfoPos(st.geom.left, st.geom.top, size, vp);
    if (pos.left === st.geom.left && pos.top === st.geom.top &&
      size.width === st.geom.width && size.height === st.geom.height) continue;
    try {
      await OBR.popover.open(winPopoverOptions(def, pos, size, st.geom.url));
      st.geom = {
        left: pos.left, top: pos.top, width: size.width, height: size.height,
        url: st.geom.url, vp: { width: vp.width, height: vp.height }
      };
    } catch (e) {  }
  }
}

async function openPanel(where) {
  try {
    await openWin("panel");
    stepOk((where || "面板") + "：已打开（独立窗口）");
    return true;
  } catch (e) {
    stepFail("打开角色卡面板（" + (where || "入口") + "）", e);
    try {
      await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
      stepOk("面板窗口打不开，已改用全屏 modal");
      return true;
    } catch (e2) {
      stepFail("改用全屏 modal 也失败", e2);
      try {
        await OBR.action.open();
        stepOk("面板打开失败，已改用左上角 action 弹窗");
        return true;
      } catch (e3) {
        stepFail("改用 action 弹窗也失败", e3);
        return false;
      }
    }
  }
}

async function openWinOrNotify(name, where) {
  try {
    await openWin(name);
    stepOk((where || name) + "：已打开");
    return true;
  } catch (e) {
    stepFail("打开窗口（" + (where || name) + "）", e);
    return false;
  }
}

function diceHistoryIsOpen() {
  return !!winOpen["diceHistory"];
}

function markDiceHistoryAlive() {
  if (winOpen["diceHistory"]) return;
  winOpen["diceHistory"] = { geom: null, drag: null, timer: null, external: true };
}

async function diceHistoryAlive() {
  if (!diceHistoryIsOpen()) return false;
  var st = winOpen["diceHistory"];
  if (st && !st.geom) return true;
  try {
    if (OBR.popover && typeof OBR.popover.getWidth === "function") {
      await OBR.popover.getWidth(ID_DICE_HIST);
      return true;
    }
  } catch (e) {
    delete winOpen["diceHistory"];
    pageLog("info", "记录窗口已经不在（状态跟丢）→ 下次命令直接重开");
    return false;
  }
  return true;
}

function winWait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function rectOverlapRatio(a, b) {
  if (!a || !b) return 0;
  var x1 = Math.max(a.left, b.left);
  var y1 = Math.max(a.top, b.top);
  var x2 = Math.min(a.left + a.width, b.left + b.width);
  var y2 = Math.min(a.top + a.height, b.top + b.height);
  var iw = Math.max(0, x2 - x1);
  var ih = Math.max(0, y2 - y1);
  var area = Math.max(1, a.width * a.height);
  return (iw * ih) / area;
}

async function adoptDiceHistory(data) {
  var w = typeof data.width === "number" && data.width > 0 ? data.width : WINS.diceHistory.width;
  var h = typeof data.height === "number" && data.height > 0 ? data.height : WINS.diceHistory.height;
  var left = typeof data.left === "number" && isFinite(data.left) ? data.left : WIN_MARGIN;
  var top = typeof data.top === "number" && isFinite(data.top) ? data.top : WIN_MARGIN;
  var vp = await infoViewport();
  var size = { width: w, height: h };
  var rect = { left: left, top: top, width: w, height: h };
  /* v1.9.2：记录窗口「点了没反应」——如果和骰子窗口重叠超过 30%，挪到骰子窗口旁边再打开。 */
  var diceGeom = winOpen["dice"] && winOpen["dice"].geom ? winOpen["dice"].geom : null;
  var moved = false;
  if (diceGeom && rectOverlapRatio(rect, diceGeom) > 0.3) {
    var gap = 12;
    var candidates = [
      { left: diceGeom.left - w - gap, top: diceGeom.top },
      { left: diceGeom.left, top: diceGeom.top + diceGeom.height + gap },
      { left: diceGeom.left, top: diceGeom.top - h - gap },
      { left: WIN_MARGIN, top: WIN_MARGIN }
    ];
    for (var i = 0; i < candidates.length; i++) {
      var one = candidates[i];
      var clamped = clampInfoPos(one.left, one.top, size, vp);
      if (rectOverlapRatio({ left: clamped.left, top: clamped.top, width: w, height: h }, diceGeom) <= 0.3) {
        left = clamped.left;
        top = clamped.top;
        moved = true;
        break;
      }
      if (i === candidates.length - 1) {
        left = clamped.left;
        top = clamped.top;
        moved = true;
      }
    }
  }
  winOpen["diceHistory"] = {
    geom: {
      left: left, top: top, width: w, height: h,
      url: URL_DICE_HIST, vp: { width: vp.width, height: vp.height }
    },
    drag: null,
    timer: null,
    external: true
  };
  if (moved) {
    try {
      await OBR.popover.open(winPopoverOptions(WINS.diceHistory, { left: left, top: top }, size, URL_DICE_HIST));
    } catch (e) {
      pageLog("err", "记录窗口挪位后重开失败：" + errText(e));
    }
  }
  pageLog("info", "hist 直开 at " + Math.round(left) + "," + Math.round(top) + " " + w + "x" + h +
    (moved ? "（与骰子窗口重叠，已挪开）" : ""));
}

async function forceOpenDiceHistory() {
  pageLog("info", "记录窗口未能由骰子窗口打开 → 先关掉骰子窗口，再由后台开一次");
  if (winOpen["dice"]) {
    try {
      await closeWin("dice");
    } catch (e) {
      pageLog("err", "关掉骰子窗口失败：" + errText(e));
    }
  }
  await winWait(160);
  if (diceHistoryIsOpen()) return true;
  return openDiceHistory();
}

function broadcastDiceHistState() {
  var payload = { open: diceHistoryIsOpen(), at: Date.now() };
  try {
    var p1 = OBR.broadcast.sendMessage(CH_DICE_HIST_STATE, payload, { destination: "LOCAL" });
    if (p1 && typeof p1.catch === "function") p1.catch(function () {  });
  } catch (e) {  }
  try {
    var p2 = OBR.broadcast.sendMessage(CH_DICE_HIST_STATE, payload, { destination: "REMOTE" });
    if (p2 && typeof p2.catch === "function") p2.catch(function () {  });
  } catch (e2) {  }
}

async function openDiceHistory() {
  if (diceHistoryIsOpen()) return true;
  var lastErr = null;
  for (var tries = 0; tries < 2; tries++) {
    if (tries) await winWait(160);
    try {
      await openWin("diceHistory");
      stepOk("骰子记录窗口：已打开" + (tries ? "（重试成功）" : ""));
      return true;
    } catch (e) {
      lastErr = e;
    }
  }
  stepFail("打开骰子记录窗口（可以先关掉骰子窗口，再点一次「记录窗口」）", lastErr);
  return false;
}

async function closeDiceHistory() {
  if (!diceHistoryIsOpen()) return;
  try {
    await closeWin("diceHistory");
    stepOk("骰子记录窗口：已关闭");
  } catch (e) {
    stepFail("关闭骰子记录窗口", e);
  }
}

async function onDiceHistCmd(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var op = data && typeof data.op === "string" ? data.op : "toggle";
  try {
    if (op === "ready") {
      markDiceHistoryAlive();
      pageLog("ok", "骰子记录窗口：页面已就绪（握手）");
    } else if (op === "close") {
      await closeDiceHistory();
    } else if (op === "open") {
      await openDiceHistory();
    } else if (op === "adopt") {

      await adoptDiceHistory(data);
    } else if (op === "force-open") {

      await forceOpenDiceHistory();
    } else if (await diceHistoryAlive()) {
      await closeDiceHistory();
    } else {
      await openDiceHistory();
    }
  } catch (e) {
    pageLog("err", "骰子记录窗口命令失败：" + errText(e));
    stepFail("记录窗口命令（" + op + "）", e);
  }
  broadcastDiceHistState();
}

var hpEditSession = "";
var hpEditTarget = { session: "", version: 0, itemId: null, pending: false };

var hpAutoSel = null;
var hpAutoPopped = {};
/* v1.8.5：自动弹速览的「手动关过」记忆（与 hpAutoPopped 对称）。
 * 用户点 ✕ 关掉某 token 的速览后，选中不变之前任何 onChange 都不再自动弹回；
 * 选中变化（selId !== hpAutoSel）时清空，允许重新自动弹一次；工具栏 / 右键手动入口不受影响。 */
var infoAutoPopped = {};

function newHpEditSession() {
  try {
    if (typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function") {
      return String(crypto.randomUUID());
    }
  } catch (e) {  }
  return "hpe-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* ---- 3. 血条编辑窗：target / ready / saved 三个频道 + 版本租约 ---- */
function publishHpEditTarget(itemId, pending) {
  var id = typeof itemId === "string" && itemId ? itemId : null;
  var pend = !!pending;
  if (hpEditTarget.itemId === id && hpEditTarget.pending === pend) return Promise.resolve();
  if (!hpEditSession) hpEditSession = newHpEditSession();
  hpEditTarget = {
    session: hpEditSession,
    version: hpEditTarget.version + 1,
    itemId: id,
    pending: pend
  };
  return sendHello(CH_HP_EDIT_TARGET, hpEditTarget);
}

async function openHpEdit(itemId) {
  if (!itemId) {
    notify("没有读到要编辑的 token，右键请对着一个图片 token 再试", "WARNING");
    return false;
  }
  hpAutoPopped[itemId] = true;
  /* v1.8.1：窗口已经开着同一枚 token → 直接复用，不再关掉重开（重开会闪、也会被 onWinClose 当成手关）。 */
  if (winOpen["hpEdit"] && hpEditTarget.itemId === itemId && !hpEditTarget.pending) return true;
  if (!hpEditSession) hpEditSession = newHpEditSession();
  var url = URL_HP_EDIT + "?item=" + encodeURIComponent(itemId) +
    "&session=" + encodeURIComponent(hpEditSession);
  try {
    await publishHpEditTarget(itemId, true);
    await openWin("hpEdit", url);
    await publishHpEditTarget(itemId, false);
    stepOk("血条编辑窗已打开：" + itemId);
    return true;
  } catch (e) {

    stepFail("打开血条编辑窗", e);
    return false;
  }
}

function onHpEditReady(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var session = data && typeof data.session === "string" ? data.session : "";
  if (session && session !== hpEditSession) return;
  void sendHello(CH_HP_EDIT_TARGET, hpEditTarget);
}

function onHpEditSaved(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var itemId = data && typeof data.itemId === "string" ? data.itemId : "";
  if (!itemId) return;
  /* v1.8.1：保存完就不再对同一个选中 token 自动弹编辑窗（否则 items.onChange 会把窗关掉再弹一次）。 */
  hpAutoPopped[itemId] = true;
  scheduleBars();
  stepOk("血条编辑窗已保存：" + itemId);
}

/* v1.10.0：编辑窗「钉住」偏好（默认关）——钉住后选中变化 / 取消选中不自动关窗。 */
function hpEditPinned() {
  try { return localStorage.getItem("4enext/hp-edit/pinned") === "1"; } catch (e) { return false; }
}

/* v1.10.0：编辑窗「重绘」→ 丢掉这张 token 的血条缓存，下一次 scheduleBars 强制重建（环 / 盾 / 徽记）。 */
function onHpRepaint(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var itemId = data && typeof data.itemId === "string" ? data.itemId : "";
  if (!itemId) return;
  var entry = barEntries[itemId];
  if (entry) entry.force = true;
  scheduleBars();
  stepOk("血条已重绘：" + itemId);
}

var stripOpen = false;

var stripGeom = null;
var stripDragTimer = null;
var stripDragWanted = null;
var stripDragBusy = false;

/* ---- 4. 先攻条：三档高度 / 折叠药丸 / 拖动 / 命令频道 ---- */
function stripHeightFor(phase) {
  if (phase === "combat") return STRIP_H_COMBAT;
  if (phase === "preparing") return STRIP_H_PREPARING;
  return STRIP_H_IDLE;
}

function stripWidthFor(vp) {
  var avail = vp && vp.width > 0 ? vp.width - STRIP_SIDE_MARGIN * 2 : STRIP_EXPANDED_W;
  return Math.round(Math.max(STRIP_MIN_EXPANDED_W, Math.min(STRIP_EXPANDED_W, avail)));
}

var STRIP_H_ALLOWED = [STRIP_H_IDLE, STRIP_H_PREPARING, STRIP_H_COMBAT];
function snapStripSize(w, h) {
  if (w === STRIP_COLLAPSED_W && h === STRIP_COLLAPSED_H) {
    return { width: STRIP_COLLAPSED_W, height: STRIP_COLLAPSED_H };
  }
  var height = STRIP_H_ALLOWED.indexOf(h) >= 0 ? h : STRIP_H_IDLE;
  return { width: stripWidthFor(stripGeom ? stripGeom.vp : null), height: height };
}

function readStripOffset() {
  try {
    var raw = localStorage.getItem(STRIP_POS_KEY);
    if (!raw) return { dx: 0, dy: 0 };
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return { dx: 0, dy: 0 };
    return {
      dx: typeof box.dx === "number" && isFinite(box.dx) ? box.dx : 0,
      dy: typeof box.dy === "number" && isFinite(box.dy) ? box.dy : 0
    };
  } catch (e) {
    return { dx: 0, dy: 0 };
  }
}

function writeStripOffset(dx, dy) {
  try {
    localStorage.setItem(STRIP_POS_KEY, JSON.stringify({ v: 1, dx: Math.round(dx), dy: Math.round(dy) }));
  } catch (e) {  }
}

function clearStripOffset() {
  try { localStorage.removeItem(STRIP_POS_KEY); } catch (e) {  }
}

function stripPosFor(dx, dy, size, vp) {
  var vw = vp && vp.width > 0 ? vp.width : 0;
  var vh = vp && vp.height > 0 ? vp.height : 0;
  var cx = Math.round((vw > 0 ? vw : size.width + STRIP_SIDE_MARGIN * 2) / 2) + Math.round(dx);
  var top = STRIP_TOP_OFFSET + Math.round(dy);
  if (vw > 0) {
    var half = size.width / 2;
    cx = Math.min(Math.max(cx, Math.round(STRIP_SIDE_MARGIN + half)), Math.round(vw - STRIP_SIDE_MARGIN - half));
  }
  if (vh > 0) top = Math.min(Math.max(top, 0), Math.max(0, Math.round(vh - size.height - STRIP_SIDE_MARGIN)));
  return { left: cx, top: top };
}

function stripPopoverOptions(size, pos) {
  return {
    id: ID_STRIP,
    url: URL_INITIATIVE,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",

    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
    transformOrigin: { horizontal: "CENTER", vertical: "TOP" },

    disableClickAway: true,

    hidePaper: true
  };
}

function stripCollapsedPref() {
  try { return localStorage.getItem(STRIP_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
}

async function openStrip() {
  var vp = await infoViewport();

  var size = stripCollapsedPref()
    ? { width: STRIP_COLLAPSED_W, height: STRIP_COLLAPSED_H }
    : (stripOpen && stripGeom
      ? { width: stripGeom.width, height: stripGeom.height }
      : { width: stripWidthFor(vp), height: STRIP_H_IDLE });
  var offset = readStripOffset();
  var pos = stripPosFor(offset.dx, offset.dy, size, vp);

  stripGeom = {
    left: pos.left, top: pos.top, width: size.width, height: size.height,
    offset: { dx: pos.left - Math.round((vp.width || 0) / 2), dy: pos.top - STRIP_TOP_OFFSET },
    vp: { width: vp.width, height: vp.height }
  };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {
    stripGeom = null;
    throw e;
  }
  stripOpen = true;

  var pending = stripGeom && stripGeom.pendingSize ? stripGeom.pendingSize : null;
  if (stripGeom) stripGeom.pendingSize = null;
  if (pending && (pending.width !== size.width || pending.height !== size.height)) {
    void resizeStrip(pending.width, pending.height);
  }

  markStripClosed(false);
  return true;
}

async function openStripOrNotify(where) {
  try {
    await openStrip();
    stepOk((where || "先攻条") + "：已打开");
    return true;
  } catch (e) {
    stepFail("打开先攻条（" + (where || "入口") + "）", e);
    return false;
  }
}

async function closeStrip() {
  if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
  stripDragWanted = null;
  stripOpen = false;
  stripGeom = null;
  try { await OBR.popover.close(ID_STRIP); } catch (e) {  }
}

function stripAutostartOn() {
  try { return localStorage.getItem(STRIP_AUTOSTART_KEY) !== "0"; } catch (e) { return true; }
}

function stripClosedThisSession() {
  try { return localStorage.getItem(STRIP_CLOSED_KEY) === "1"; } catch (e) { return false; }
}

function markStripClosed(on) {
  try {
    if (on) localStorage.setItem(STRIP_CLOSED_KEY, "1");
    else localStorage.removeItem(STRIP_CLOSED_KEY);
  } catch (e) {  }
}

async function maybeAutoOpenStrip(where) {
  if (stripOpen) return false;
  if (!stripAutostartOn()) return false;
  if (stripClosedThisSession()) return false;
  if (!(await sceneReady())) return false;
  return openStripOrNotify(where || "进入房间自动打开先攻条");
}

/* v1.9.2：骰子记录窗口的自动打开（与先攻条同一套口径：偏好默认开、本次会话关过就不再开）。 */
function diceHistAutostartOn() {
  try { return localStorage.getItem(DICE_HIST_AUTOSTART_KEY) !== "0"; } catch (e) { return true; }
}
function diceHistClosedThisSession() {
  try { return localStorage.getItem(DICE_HIST_CLOSED_KEY) === "1"; } catch (e) { return false; }
}
function markDiceHistClosed(on) {
  try {
    if (on) localStorage.setItem(DICE_HIST_CLOSED_KEY, "1");
    else localStorage.removeItem(DICE_HIST_CLOSED_KEY);
  } catch (e) {  }
}
async function maybeAutoOpenDiceHistory() {
  if (diceHistoryIsOpen()) return false;
  if (!diceHistAutostartOn()) return false;
  if (diceHistClosedThisSession()) return false;
  if (!(await sceneReady())) return false;
  var ok = await openDiceHistory();
  if (ok) pageLog("info", "进入房间自动打开骰子记录窗口");
  return ok;
}

async function resetStrip() {
  if (!stripOpen || !stripGeom) return;
  clearStripOffset();
  var vp = await infoViewport();
  var size = { width: stripGeom.width, height: stripGeom.height };
  var pos = stripPosFor(0, 0, size, vp);
  stripGeom.left = pos.left;
  stripGeom.top = pos.top;
  stripGeom.vp = { width: vp.width, height: vp.height };
  stripGeom.offset = { dx: 0, dy: 0 };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {
    stepFail("先攻条回到顶部中间", e);
  }
  pageLog("info", "先攻条已回到顶部中间");
}

function queueStripDrag(want) {
  stripDragWanted = want;
  void pumpStripDrag();
}

async function pumpStripDrag() {
  if (stripDragBusy) return;
  stripDragBusy = true;
  try {
    while (stripDragWanted) {
      var job = stripDragWanted;
      stripDragWanted = null;
      if (!stripOpen || !stripGeom) break;
      var vp = await infoViewport();
      var size = { width: stripGeom.width, height: stripGeom.height };
      var pos = stripPosFor(job.dx, job.dy, size, vp);

      stripGeom.left = pos.left;
      stripGeom.top = pos.top;
      stripGeom.vp = { width: vp.width, height: vp.height };
      stripGeom.offset = {
        dx: pos.left - Math.round((vp.width || 0) / 2),
        dy: pos.top - STRIP_TOP_OFFSET
      };
      try {
        await OBR.popover.open(stripPopoverOptions(size, pos));
      } catch (e) {

      }
    }
  } finally {
    stripDragBusy = false;
    if (stripDragWanted) void pumpStripDrag();
  }
}

function touchStripDrag() {
  if (stripDragTimer) clearTimeout(stripDragTimer);
  stripDragTimer = setTimeout(function () {
    stripDragTimer = null;
    if (stripGeom && stripGeom.offset) writeStripOffset(stripGeom.offset.dx, stripGeom.offset.dy);
  }, WIN_DRAG_IDLE_MS);
}

function onStripDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;
  if (!stripOpen || !stripGeom) return;
  if (data.phase === "reset") {
    if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
    void resetStrip();
    return;
  }
  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;
  if (data.phase === "start") {
    stripGeom.base = stripGeom.offset || readStripOffset();
    touchStripDrag();
    return;
  }
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && data.phase !== "end") return;
  var base = stripGeom.base || stripGeom.offset || { dx: 0, dy: 0 };
  queueStripDrag({ dx: base.dx + dx, dy: base.dy + dy });
  touchStripDrag();
  if (data.phase === "end") {

    setTimeout(function () {
      if (!stripGeom || !stripGeom.offset) return;
      writeStripOffset(stripGeom.offset.dx, stripGeom.offset.dy);
      stripGeom.base = null;
      if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
    }, 60);
  }
}

async function reclampStrip() {
  if (!stripOpen || !stripGeom) return;
  var vp = await infoViewport();
  var size = { width: stripGeom.width, height: stripGeom.height };
  var off = stripGeom.offset || readStripOffset();
  var pos = stripPosFor(off.dx, off.dy, size, vp);
  if (pos.left === stripGeom.left && pos.top === stripGeom.top) return;

  stripGeom.left = pos.left;
  stripGeom.top = pos.top;
  stripGeom.vp = { width: vp.width, height: vp.height };
  stripGeom.offset = {
    dx: pos.left - Math.round((vp.width || 0) / 2),
    dy: pos.top - STRIP_TOP_OFFSET
  };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {

  }
}

async function resizeStrip(width, height) {
  if (!stripOpen || !stripGeom) return;
  var vp = await infoViewport();
  var off = stripGeom.offset || { dx: 0, dy: 0 };
  var size = { width: width, height: height };
  var pos = stripPosFor(off.dx, off.dy, size, vp);
  stripGeom.width = width;
  stripGeom.height = height;
  stripGeom.left = pos.left;
  stripGeom.top = pos.top;
  stripGeom.vp = { width: vp.width, height: vp.height };
  stripGeom.offset = {
    dx: pos.left - Math.round((vp.width || 0) / 2),
    dy: pos.top - STRIP_TOP_OFFSET
  };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {
    stepFail("先攻条改尺寸", e);
  }
}

function onStripCmd(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.op !== "string") return;
  if (data.op === "list") {
    void openWinOrNotify("initiative", "先攻列表");
    return;
  }

  if (data.op === "close") { markStripClosed(true); void closeStrip(); return; }
  if (data.op === "size") {
    if (!stripGeom) return;
    var w = typeof data.width === "number" && isFinite(data.width) ? Math.round(data.width) : stripGeom.width;
    var h = typeof data.height === "number" && isFinite(data.height) ? Math.round(data.height) : stripGeom.height;

    var snapped = snapStripSize(w, h);
    if (snapped.width === stripGeom.width && snapped.height === stripGeom.height) return;
    if (!stripOpen) {

      stripGeom.pendingSize = snapped;
      return;
    }
    void resizeStrip(snapped.width, snapped.height);
  }
}

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
  try { await OBR.popover.close(ID_BUTTON); } catch (e) {  }
  buttonOpen = false;
}

async function registerOneTool(def) {
  try {
    await OBR.tool.create(def);
  } catch (e) {

    await OBR.tool.remove(def.id);
    await OBR.tool.create(def);
  }
}

async function registerTools() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") {
    throw new Error("SDK 没有 OBR.tool.create");
  }

  await registerOneTool({
    id: TOOL_ID,
    icons: [{ icon: TOOL_ICON_URL, label: "4eNEXT to owlbear：角色卡 / 导入面板" }],
    onClick: function () {
      void openPanel("工具栏「角色卡」");
      return false;
    }
  });

  await registerOneTool({
    id: TOOL_INIT_ID,
    icons: [{ icon: TOOL_INIT_ICON_URL, label: "4eNEXT to owlbear：先攻条" }],
    onClick: function () {
      void openStripOrNotify("工具栏「先攻」");
      return false;
    }
  });
  await registerOneTool({
    id: TOOL_GLANCE_ID,
    icons: [{ icon: TOOL_GLANCE_ICON_URL, label: "4eNEXT to owlbear：速览（当前选中的 token）" }],
    onClick: function () {
      void openGlance("工具栏「速览」");
      return false;
    }
  });

  await registerOneTool({
    id: TOOL_SETTINGS_ID,
    icons: [{ icon: TOOL_SETTINGS_ICON_URL, label: "4eNEXT to owlbear：设置 / 关于" }],
    onClick: function () {
      void openWinOrNotify("settings", "工具栏「设置」");
      return false;
    }
  });
}

async function createContextMenu(def) {
  try {
    await OBR.contextMenu.create(def);
  } catch (e) {

    await OBR.contextMenu.remove(def.id);
    await OBR.contextMenu.create(def);
  }
}

var KEY_IN_INIT = NS + "/in-init";

var initFlagBusy = false;
var initFlagAgain = false;
var initFlagTimer = null;

/* ---- 5. 先攻菜单互斥：in-init 镜像 + token 删除自动清理 ---- */
function initEntryIdsOf(state) {
  var out = [];
  var list = state && Array.isArray(state.entries) ? state.entries : [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].tokenId) out.push(String(list[i].tokenId));
  }
  return out;
}

function initMenuFilter(mode) {
  var filter = { roles: ["GM"], every: [{ key: "type", value: "IMAGE" }], max: 1 };
  if (mode === "in") filter.every.push({ key: ["metadata", KEY_IN_INIT], value: true });
  else filter.every.push({ key: ["metadata", KEY_IN_INIT], operator: "!=", value: true });
  return filter;
}

async function registerInitMenus() {
  await createContextMenu({
    id: INIT_MENU_ADD,
    icons: [{ icon: ICON_URL, label: "加入先攻", filter: initMenuFilter("out") }],
    onClick: function (context) { return onInitMenuClick(context, false); }
  });
  await createContextMenu({
    id: INIT_MENU_ADD_HIDDEN,
    icons: [{ icon: ICON_URL, label: "隐形加入先攻", filter: initMenuFilter("out") }],
    onClick: function (context) { return onInitMenuClick(context, true); }
  });
  await createContextMenu({
    id: INIT_MENU_REMOVE,
    icons: [{ icon: ICON_URL, label: "移出先攻", filter: initMenuFilter("in") }],
    onClick: function (context) { return onInitRemoveClick(context); }
  });
}

async function initWantIds(ids) {
  var want = {};
  var list = null;
  if (Array.isArray(ids)) {
    list = ids;
  } else {
    var state = await initRead();
    list = initEntryIdsOf(state);
  }
  for (var i = 0; i < list.length; i++) if (list[i]) want[String(list[i])] = true;
  return want;
}

async function syncInitFlags(ids) {
  if (initFlagBusy) { initFlagAgain = true; return 0; }
  initFlagBusy = true;
  try {
    var role = "";
    try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
    if (role !== "GM") return 0;
    var want = await initWantIds(ids);
    var items = [];
    try { items = await OBR.scene.items.getItems(); } catch (e2) { return 0; }
    var update = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || it.type !== "IMAGE" || !it.id) continue;
      var cur = it.metadata ? it.metadata[KEY_IN_INIT] : null;
      var should = !!want[String(it.id)];
      if (should ? cur !== true : cur === true) update.push(it.id);
    }
    if (!update.length) return 0;
    await OBR.scene.items.updateItems(update, function (drafts) {
      for (var j = 0; j < drafts.length; j++) {
        var d = drafts[j];
        if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
        d.metadata[KEY_IN_INIT] = !!want[String(d.id)];
      }
    });
    stepOk("先攻菜单标记已同步（" + update.length + " 枚 token）");
    return update.length;
  } catch (e) {
    pageLog("err", "同步先攻菜单标记失败：" + errText(e));
    return 0;
  } finally {
    initFlagBusy = false;
    if (initFlagAgain) { initFlagAgain = false; scheduleInitFlagSync(); }
  }
}

function scheduleInitFlagSync() {
  if (initFlagTimer) return;
  initFlagTimer = setTimeout(function () {
    initFlagTimer = null;
    void syncInitFlags();
  }, 300);
}

var initSeenUpdatedAt = -1;
function onRoomMetaChanged(meta) {
  if (!meta || typeof meta !== "object") { scheduleInitFlagSync(); return; }
  var raw = meta[KEY_INITIATIVE];
  var at = raw && typeof raw.updatedAt === "number" && isFinite(raw.updatedAt) ? raw.updatedAt : 0;
  if (at === initSeenUpdatedAt) return;
  initSeenUpdatedAt = at;
  scheduleInitFlagSync();
}

async function writeHpBarFlag(context, on) {
  var src = context && context.items ? context.items : [];
  var ids = [];
  for (var i = 0; i < src.length; i++) {
    var it = src[i];
    if (!it || !it.id || it.type !== "IMAGE") continue;
    ids.push(it.id);
  }
  if (!ids.length) {
    notify("没有读到可用的 IMAGE token，右键请对着一个图片 token 再试", "WARNING");
    return [];
  }
  try {
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (var j = 0; j < drafts.length; j++) {
        var d = drafts[j];
        if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
        d.metadata[KEY_HPBAR] = !!on;
      }
    });
    scheduleBars();
    stepOk("血条组件：" + (on ? "已添加 " : "已移除 ") + ids.length + " 个 token");
    return ids;
  } catch (e) {
    notify("改不了血条组件开关：" + errText(e), "ERROR");
    return [];
  }
}

async function onHpBarAdd(context) {
  var ids = await writeHpBarFlag(context, true);
  if (!ids.length) return;
  if (ids.length > 1) {

    notify("一次只能编辑一枚 token，已为第一枚打开编辑窗", "WARNING");
  }
  await openHpEdit(ids[0]);
}

async function onHpBarEdit(context) {
  var item = context && context.items && context.items[0] ? context.items[0] : null;
  if (!item || !item.id) {
    notify("没有读到要编辑的 token，右键请对着一个图片 token 再试", "WARNING");
    return;
  }
  if (item.type !== "IMAGE") {
    notify("只有图片 token 能编辑血条", "WARNING");
    return;
  }
  await openHpEdit(item.id);
}

async function registerContextMenu() {
  if (!OBR.contextMenu || typeof OBR.contextMenu.create !== "function") {
    throw new Error("SDK 没有 OBR.contextMenu.create");
  }

  await createContextMenu({
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
  });

  await registerInitMenus();

  await createContextMenu({
    id: NS + "/hpbar-add",
    icons: [{
      icon: ICON_URL,
      label: "添加血条组件",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }],
        some: [{ key: ["metadata", KEY_HPBAR], operator: "!=", value: true }]
      }
    }],

    onClick: function (context) { return onHpBarAdd(context); }
  });
  await createContextMenu({
    id: NS + "/hpbar-remove",
    icons: [{
      icon: ICON_URL,
      label: "移除血条组件",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }],
        some: [{ key: ["metadata", KEY_HPBAR], value: true }]
      }
    }],
    onClick: function (context) { return writeHpBarFlag(context, false); }
  });

  await createContextMenu({
    id: NS + "/hpbar-edit",
    icons: [{
      icon: ICON_URL,
      label: "编辑血条",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }],
        some: [{ key: ["metadata", KEY_HPBAR], value: true }]
      }
    }],
    onClick: function (context) { return onHpBarEdit(context); }
  });
}

var infoOpen = false;
var infoItemId = null;
var infoCardId = null;

/* v1.8.9：信息窗目标租约（照 hpEditTarget / Full Suite characterCards 的 sendInfoTarget）。
 * 窗口只挂载一次：换 token 时 version+1 广播 CH_INFO_TARGET，页面收到后换 itemId/cardId 重渲染，
 * 不 reload iframe。session 内的 version 必须严格递增；页面 READY 时后台重发当前 target（防丢首条）。 */
var infoSession = "";
var infoTarget = { session: "", version: 0, itemId: null, cardId: null };
/* v1.9.0：target 广播后的 ack 兜底 —— 700ms 没收到页面 ack 就关闭重开一次（只记日志、不弹通知）。 */
var infoAckTimer = null;
var infoAckPending = null;

function newInfoSession() {
  try {
    if (typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function") {
      return String(crypto.randomUUID());
    }
  } catch (e) {  }
  return "info-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function clearInfoAckTimer() {
  if (infoAckTimer) { clearTimeout(infoAckTimer); infoAckTimer = null; }
  infoAckPending = null;
}

function publishInfoTarget(itemId, cardId, expectAck) {
  if (!infoSession) infoSession = newInfoSession();
  infoTarget = {
    session: infoSession,
    version: infoTarget.version + 1,
    itemId: typeof itemId === "string" ? itemId : (itemId || ""),
    cardId: typeof cardId === "string" ? cardId : (cardId || "")
  };
  var sent = sendHello(CH_INFO_TARGET, infoTarget);
  if (expectAck) {
    clearInfoAckTimer();
    infoAckPending = {
      session: infoSession,
      version: infoTarget.version,
      itemId: infoTarget.itemId,
      cardId: infoTarget.cardId
    };
    infoAckTimer = setTimeout(function () {
      infoAckTimer = null;
      var pend = infoAckPending;
      infoAckPending = null;
      if (!pend || !infoOpen) return;
      /* 只记日志不弹通知：极端情况下页面没刷新，主动关掉重开一次保证内容换过去。 */
      pageLog("err", "速览 target v=" + pend.version + " 700ms 无 ack → 兜底关闭重开一次");
      void (async function () {
        try {
          await closeInfo();
          await openInfo(pend.itemId, pend.cardId);
        } catch (e) {
          stepFail("兜底重开速览窗", e);
        }
      })();
    }, 700);
  }
  return sent;
}

function resetInfoTarget() {
  clearInfoAckTimer();
  infoSession = "";
  infoTarget = { session: "", version: 0, itemId: null, cardId: null };
}

function onInfoReady(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var session = data && typeof data.session === "string" ? data.session : "";
  if (session && infoSession && session !== infoSession) return;
  if (!infoSession) return;
  /* 页面刚挂载 / 拖动重开后会发 READY：重发当前 target（第一条广播可能在 iframe 加载前丢了）。 */
  void sendHello(CH_INFO_TARGET, infoTarget);
}

function onInfoAck(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data !== "object") return;
  var session = typeof data.session === "string" ? data.session : "";
  if (!session || session !== infoSession) return;
  var version = typeof data.version === "number" ? data.version : 0;
  if (infoAckPending && version >= infoAckPending.version) clearInfoAckTimer();
}

var infoGeom = null;

var infoDrag = null;
var infoDragTimer = null;
var dragWanted = null;
var dragBusy = false;

async function getCards() {
  var box = null;
  try {
    var meta = await OBR.room.getMetadata();
    box = meta[KEY_CARDS];
  } catch (e) {
    pageLog("err", "读取房间数据失败：" + errText(e));
  }

  /* v1.8.0：房间名单（精简副本）与场景 item（完整数据）是同一批卡的两层副本，按 id 取并集，
   * 同 id 优先用场景里的完整卡。只认房间列表会漏掉「房间名单过期但新卡写进场景」的卡（F1）。 */
  var roomCards = box && Array.isArray(box.cards) ? box.cards : [];
  var scene = await sceneCardsFallback();
  var byId = {};
  var i;
  for (i = 0; i < scene.length; i++) {
    if (scene[i] && scene[i].id) byId[scene[i].id] = scene[i];
  }
  var out = [];
  var seen = {};
  for (i = 0; i < roomCards.length; i++) {
    var w = roomCards[i];
    if (!w || typeof w.id !== "string" || !w.id || seen[w.id]) continue;
    seen[w.id] = 1;
    out.push(byId[w.id] || w);
  }
  for (i = 0; i < scene.length; i++) {
    var sc = scene[i];
    if (!sc || typeof sc.id !== "string" || !sc.id || seen[sc.id]) continue;
    seen[sc.id] = 1;
    out.push(sc);
  }
  if (out.length) return out;

  var local = localCardsFallback();
  if (local) return local.cards;
  return [];
}

/** 当前场景里挂在隐藏 item 上的卡片（精简格式，只用得上 id / name），没有就 []。 */
async function sceneCardsFallback() {
  try {
    var items = await OBR.scene.items.getItems(function (i) {
      return !!(i && i.metadata && i.metadata[KEY_CARD_ITEM]);
    });
    var out = [];
    if (!items || !items.length) return out;
    for (var i = 0; i < items.length; i++) {
      var box = items[i].metadata[KEY_CARD_ITEM];
      var wire = box && box.card;
      if (!wire || typeof wire !== "object") continue;
      if (typeof wire.id !== "string" || !wire.id) continue;
      out.push(wire);
    }
    out.sort(function (a, b) { return (a.importedAt || 0) - (b.importedAt || 0); });
    return out;
  } catch (e) {
    return [];
  }
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
    return { left: p.x, top: p.y - (bounds.height * scale) / 2 };
  } catch (e) {
    return null;
  }
}

async function infoViewport() {
  var vp = { width: 0, height: 0 };
  try { vp.width = await OBR.viewport.getWidth(); } catch (e) { vp.width = 0; }
  try { vp.height = await OBR.viewport.getHeight(); } catch (e) { vp.height = 0; }
  return vp;
}

/* ---- 6. 速览弹窗 /info：尺寸 / 位置记忆 / 拖动 ---- */
function infoSize(vp) {
  return {
    width: Math.max(INFO_MIN_W, Math.min(INFO_W, (vp.width || INFO_W + 40) - 32)),
    height: Math.min(INFO_H, Math.max(260, (vp.height || INFO_H + 40) - 40))
  };
}

function clampInfoPos(left, top, size, vp) {
  var m = INFO_VIEW_MARGIN;
  var out = { left: Math.round(left), top: Math.round(top) };
  if (vp && vp.width > 0) out.left = Math.round(Math.min(Math.max(out.left, m), Math.max(m, vp.width - size.width - m)));
  if (vp && vp.height > 0) out.top = Math.round(Math.min(Math.max(out.top, m), Math.max(m, vp.height - size.height - m)));
  return out;
}

function readInfoPosMap() {
  try {
    var raw = localStorage.getItem(INFO_POS_KEY);
    if (!raw) return {};
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return {};
    var src = box.pos && typeof box.pos === "object" ? box.pos : box;
    var out = {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var one = src[k];
      if (!one || typeof one !== "object") continue;
      if (typeof one.left !== "number" || typeof one.top !== "number") continue;
      if (!isFinite(one.left) || !isFinite(one.top)) continue;
      out[k] = { left: one.left, top: one.top };
    }
    return out;
  } catch (e) {
    return {};
  }
}

function readInfoPos(itemId) {
  if (!itemId) return null;
  return readInfoPosMap()[itemId] || null;
}

function writeInfoPos(itemId, pos) {
  if (!itemId || !pos) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    map[itemId] = { left: Math.round(pos.left), top: Math.round(pos.top) };
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length - INFO_POS_MAX; i++) delete map[keys[i]];
    localStorage.setItem(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function clearInfoPos(itemId) {
  if (!itemId) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    if (!Object.keys(map).length) localStorage.removeItem(INFO_POS_KEY);
    else localStorage.setItem(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function infoPopoverOptions(pos, size, url) {
  return {
    id: ID_INFO,
    url: url,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",
    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true
  };
}

async function showInfoAt(pos, size, url, itemId, cardId, vp) {
  await OBR.popover.open(infoPopoverOptions(pos, size, url));
  infoOpen = true;
  infoItemId = itemId;
  infoCardId = cardId;
  infoGeom = {
    left: pos.left,
    top: pos.top,
    width: size.width,
    height: size.height,
    url: url,
    vp: { width: vp.width, height: vp.height }
  };
}

async function infoAutoPos(itemId, size, vp) {
  var saved = readInfoPos(itemId);
  if (saved) return clampInfoPos(saved.left, saved.top, size, vp);
  var anchor = await anchorOf(itemId);
  if (anchor) {
    return clampInfoPos(anchor.left - size.width / 2, anchor.top - INFO_TOKEN_GAP - size.height, size, vp);
  }

  return clampInfoPos((vp.width || 0) / 2 - size.width / 2, INFO_VIEW_MARGIN, size, vp);
}

async function openInfo(itemId, cardId) {
  /* v1.8.9：**单窗挂载** —— 窗口已经开着同一枚 token 换 target 即可，绝不重开 iframe
   * （每次都新建 iframe 要重新下载 / 解析 ~430KB 脚本，是「切换 token 黑屏」的根因）。 */
  if (infoOpen) {
    infoItemId = itemId;
    infoCardId = cardId;
    /* 复用路径要 ack 兜底：700ms 内页面没刷新（无 ack）就关闭重开一次。 */
    await publishInfoTarget(itemId, cardId, true);
    return;
  }
  var vp = await infoViewport();
  var size = infoSize(vp);
  var pos = await infoAutoPos(itemId, size, vp);
  if (!infoSession) infoSession = newInfoSession();

  var url = URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION) +
    "&item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId) +
    "&session=" + encodeURIComponent(infoSession);
  await showInfoAt(pos, size, url, itemId, cardId, vp);
  /* 首次挂载后广播 target：页面若在 iframe 加载完成前就 READY，onInfoReady 会补发。 */
  await publishInfoTarget(itemId, cardId);
}

async function closeInfo() {
  if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
  infoDrag = null;
  infoGeom = null;
  if (!infoOpen) return;
  try { await OBR.popover.close(ID_INFO); } catch (e) {  }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
  resetInfoTarget();
}

function queueInfoDrag(pos) {
  if (!infoGeom) return;
  dragWanted = {
    pos: { left: pos.left, top: pos.top },
    size: { width: infoGeom.width, height: infoGeom.height },
    url: infoGeom.url
  };
  void pumpInfoDrag();
}

async function pumpInfoDrag() {
  if (dragBusy) return;
  dragBusy = true;
  try {
    while (dragWanted) {
      var job = dragWanted;
      dragWanted = null;
      try {
        await OBR.popover.open(infoPopoverOptions(job.pos, job.size, job.url));
        if (infoGeom) {
          infoGeom.left = job.pos.left;
          infoGeom.top = job.pos.top;
        }
      } catch (e) {
        pageLog("err", "拖动速览弹窗失败：" + errText(e));
        break;
      }
    }
  } finally {
    dragBusy = false;

    if (dragWanted) void pumpInfoDrag();
  }
}

function touchInfoDragTimer() {
  if (infoDragTimer) clearTimeout(infoDragTimer);
  infoDragTimer = setTimeout(function () {
    infoDragTimer = null;
    if (!infoDrag) return;
    if (infoDrag.moved && infoGeom) writeInfoPos(infoDrag.itemId, infoGeom);
    infoDrag = null;
    pageLog("info", "速览弹窗拖动超时，已按最后位置收尾");
  }, INFO_DRAG_IDLE_MS);
}

function onInfoDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;

  if (data.phase === "reset") {
    clearInfoPos(infoItemId);
    infoDrag = null;
    if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
    void resetInfoToToken();
    return;
  }
  if (!infoOpen || !infoGeom) return;

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !infoDrag) {

    infoDrag = { base: { left: infoGeom.left, top: infoGeom.top }, itemId: infoItemId, moved: false };
    touchInfoDragTimer();
    if (data.phase === "start") return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) infoDrag.moved = true;

  if (!infoDrag.moved) {
    if (data.phase === "end") {
      if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
      infoDrag = null;
    }
    return;
  }

  var target = clampInfoPos(infoDrag.base.left + dx, infoDrag.base.top + dy, infoGeom, infoGeom.vp);
  queueInfoDrag(target);
  touchInfoDragTimer();

  if (data.phase === "end") {
    if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
    writeInfoPos(infoDrag.itemId, target);
    infoDrag = null;
  }
}

async function resetInfoToToken() {
  if (!infoOpen || !infoItemId) return;
  var itemId = infoItemId;
  var cardId = infoCardId;
  var vp = await infoViewport();
  var size = infoSize(vp);
  var pos = await infoAutoPos(itemId, size, vp);
  var url = infoGeom ? infoGeom.url : URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION) +
    "&item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId || "") +
    "&session=" + encodeURIComponent(infoSession);

  if (!infoOpen || infoItemId !== itemId) return;
  try {
    await showInfoAt(pos, size, url, itemId, cardId, vp);
    /* v1.8.9：重锚后页面会重新 READY 要 target —— 这里也主动重发一次（两边兜底）。 */
    await publishInfoTarget(itemId, cardId);
    pageLog("info", "速览弹窗已回到 token 上方");
  } catch (e) {
    stepFail("把速览弹窗移回 token", e);
  }
}

async function selectedItem() {
  var sel = null;
  try { sel = await OBR.player.getSelection(); } catch (e) { return null; }
  if (!sel || sel.length !== 1) return null;
  try {
    var items = await OBR.scene.items.getItems([sel[0]]);
    return items && items[0] ? items[0] : null;
  } catch (e) {
    return null;
  }
}

/** 比名字用的归一化：去括号备注（token 名常带「（玩家）」）、去空白、忽略大小写。 */
function normCardName(s) {
  return String(s == null ? "" : s).replace(/[（(][^)）]*[)）]/g, "").replace(/\s+/g, "").toLowerCase();
}

/**
 * 按 token 名字找卡（v1.8.0 的名字兜底）。
 * 场景：城主删掉了卡又重新导入（卡片 id 变了），token 上还挂着旧 id。
 * 没有这层兜底时，这种 token 会被当成「没有卡」，选中时会误弹血条编辑窗（v1.7.15 的真 bug）。
 */
function findCardByName(cards, name) {
  var key = normCardName(name);
  if (!key) return null;
  var i;
  for (i = 0; i < cards.length; i++) {
    if (normCardName(cards[i] && cards[i].name) === key) return cards[i];
  }
  var loose = null;
  for (i = 0; i < cards.length; i++) {
    var cn = normCardName(cards[i] && cards[i].name);
    if (!cn) continue;
    if (cn.indexOf(key) >= 0 || key.indexOf(cn) >= 0) {
      if (!loose) loose = cards[i];
    }
  }
  return loose;
}

/**
 * 解析 token 的绑定：先按 id，再按名字（并顺手把新 id 写回去修复旧绑定）。
 * 返回 { cardId, via: "id"|"name", stale } 或 null。
 */
async function resolveBinding(item) {
  if (!item || !item.metadata) return null;
  var cards = await getCards();
  var bound = item.metadata[KEY_BIND];
  if (typeof bound === "string" && bound && findCard(cards, bound)) {
    return { cardId: bound, via: "id", stale: false, cards: cards };
  }
  var byName = findCardByName(cards, item.name);
  if (!byName) return null;
  return {
    cardId: byName.id,
    via: "name",
    stale: typeof bound === "string" && !!bound,
    cards: cards
  };
}

/** 名字兜底命中后，把正确的卡片 id 写回 token（只修不伤；失败只记日志）。 */
async function healBinding(itemId, cardId) {
  try {
    await OBR.scene.items.updateItems([itemId], function (items) {
      for (var i = 0; i < items.length; i++) {
        if (!items[i].metadata || typeof items[i].metadata !== "object") items[i].metadata = {};
        items[i].metadata[KEY_BIND] = cardId;
      }
    });
    pageLog("ok", "按名字修复了 token " + itemId + " 的卡片绑定 → " + cardId);
  } catch (e) {
    pageLog("info", "修复卡片绑定失败（" + itemId + "）：" + errText(e));
  }
}

async function boundCardId(item) {
  var hit = await resolveBinding(item);
  if (!hit) return null;
  if (hit.via === "name" && hit.stale) void healBinding(item.id, hit.cardId);
  return hit.cardId;
}

async function selectedBinding() {
  var item = await selectedItem();
  if (!item) return null;
  var hit = await resolveBinding(item);
  if (!hit) return null;
  if (hit.via === "name" && hit.stale) void healBinding(item.id, hit.cardId);
  return { itemId: item.id, cardId: hit.cardId };
}

async function openGlance(where) {
  var label = where || "工具栏「速览」";
  var bind = await selectedBinding();
  if (!bind) {
    notify("速览：" + label + " 打开的是「当前选中的 token」。先选中一枚已绑定角色卡的 token" +
      "（右键 token 可「绑定 4E NEXT 角色卡」），再点一次。", "WARNING");
    pageLog("info", label + "：当前选中的不是「已绑定角色卡的单个 token」，已提示用户先选一个");
    return false;
  }
  try {
    await openInfo(bind.itemId, bind.cardId);
    stepOk(label + "：已打开速览（token " + bind.itemId + "）");
    return true;
  } catch (e) {
    stepFail("打开速览弹窗（" + label + "）", e);
    return false;
  }
}

var infoErrorShown = false;
/* v1.8.2：先攻条点卡片头像 → 页面先发 CH_GLANCE_SUPPRESS，1.5 秒内不自动弹速览
 * （token 仍会被选中 / 地图高亮，只是别弹窗；GM 战斗中点是设当前回合，不受影响）。 */
var suppressGlanceUntil = 0;

async function refreshInfo() {
  var item = await selectedItem();
  var selId = item && item.id ? item.id : null;
  if (selId !== hpAutoSel) {
    hpAutoSel = selId;
    hpAutoPopped = {};
    infoAutoPopped = {};
    /* v1.8.1 诊断：选中变化时才重置「自动弹过」记录。真机排查时看这行就知道是不是选择事件在抖。 */
    pageLog("info", "选中变化 → " + (selId || "无") + "（自动弹窗记录已重置）");
  }
  if (!item) {
    /* v1.10.0：未钉住时取消选中 → 自动关掉血条编辑窗（钉住则保留）。 */
    if (winOpen["hpEdit"] && !hpEditPinned()) await closeWin("hpEdit");
    return closeInfo();
  }
  /* v1.10.0：未钉住时跟随选中 —— 选到别的 token 就先关旧的编辑窗（新 token 需要时下面会再开）。 */
  if (winOpen["hpEdit"] && !hpEditPinned() && hpEditTarget.itemId !== item.id) {
    await closeWin("hpEdit");
  }
  /* v1.8.2：先攻条点卡片头像（页面先发 CH_GLANCE_SUPPRESS 再 select）→ 1.5 秒内不自动弹速览。
   * token 仍然被选中 / 地图高亮，只是不弹；不碰下面 hpAutoSel / hpAutoPopped / hasHpBarData 顺序。 */
  if (Date.now() < suppressGlanceUntil) return;

  var cardId = await boundCardId(item);
  if (cardId) {
    /* v1.8.5：用户手动 ✕ 关过这枚 token 的速览 → 选中不变之前不再自动弹回（先于「已开则返回」判断）。 */
    if (infoAutoPopped[item.id]) return;
    if (infoOpen && infoItemId === item.id && infoCardId === cardId) return;
    /* v1.8.9：窗口已开、但不是这枚 token → 不关重开，交给 openInfo 只广播 target 换内容。 */
    /* 打开之前先置位：即使 openInfo 抛错也不在后续 onChange 里重试刷屏。 */
    infoAutoPopped[item.id] = true;
    try {
      await openInfo(item.id, cardId);
    } catch (e) {
      if (!infoErrorShown) {
        infoErrorShown = true;
        stepFail("打开速览弹窗", e);
      }
    }
    return;
  }

  /* v1.8.1 说明：这里不写「窗口开着就 return」，否则「取消选中 → 再选回来」这类正常重弹会被误杀。
   * 防止「保存后关掉又自己弹」的护栏在 openHpEdit()：同一枚 token 的窗口已经开着时直接复用、不重开。 */
  await closeInfo();
  if (!hasHpBarData(item)) return;
  if (hpAutoPopped[item.id]) return;
  try {
    await openHpEdit(item.id);
  } catch (e) {
    stepFail("选中 token 打开血条编辑窗", e);
  }
}

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

var BAR_TAG = NS + "/bar";

var barEntries = {};
var barTimer = null;
var barBusy = false;
var barAgain = false;
var barUnsupported = false;
var barSwept = false;
var cachedDpi = 0;

var barThreshold = -1;
async function sceneViewer() {
  var out = { role: "", id: "", threshold: PLAYER_THRESHOLD_DEFAULT };
  try { out.role = await OBR.player.getRole(); } catch (e1) {  }
  try { out.id = await OBR.player.getId(); } catch (e2) {  }
  if (barThreshold >= 0) { out.threshold = barThreshold; return out; }
  try {
    if (OBR.scene && typeof OBR.scene.getMetadata === "function") {
      var meta = await OBR.scene.getMetadata();
      var raw = meta ? meta[KEY_PLAYER_THRESHOLD] : null;
      if (typeof raw === "number" && isFinite(raw) && raw >= 0 && raw <= 100) out.threshold = Math.round(raw);
    }
  } catch (e3) {  }
  barThreshold = out.threshold;
  return out;
}

function barBuildersOk() {
  return typeof buildCurve === "function" && typeof buildText === "function";
}

function readIntOrNull(v) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : null;
}

function readDefenses(raw) {
  if (!raw || typeof raw !== "object") return null;
  var out = null;
  for (var i = 0; i < DEF_KEYS.length; i++) {
    var k = DEF_KEYS[i];
    var n = readIntOrNull(raw[k]);
    if (n === null) continue;
    if (!out) out = {};
    out[k] = Math.max(0, n);
  }
  return out;
}

function hpBarEnabled(item) {
  var flag = item && item.metadata ? item.metadata[KEY_HPBAR] : undefined;
  return flag !== false;
}

function hasHpBarData(item) {
  /* v1.8.4：用户显式「移除血条组件」后（enabled === false），即使 hp 数据还留着也不再算「有血条」，
     否则选中 token 又会自动弹编辑窗（真机 bug）。右键「编辑血条」仍走 onHpBarEdit，不经过这里。 */
  if (!hpBarEnabled(item)) return false;
  if (!item || !item.metadata) return false;
  if (item.metadata[KEY_HPBAR] === true) return true;
  var m = item.metadata[KEY_HP];
  if (!m || typeof m !== "object") return false;
  if (readIntOrNull(m.cur) !== null) return true;
  if (typeof m.max === "number" && isFinite(m.max) && m.max > 0) return true;
  if (readIntOrNull(m.temp) !== null) return true;
  if (readIntOrNull(m.surges) !== null) return true;
  if (m.defenses && typeof m.defenses === "object" && Object.keys(m.defenses).length) return true;
  return false;
}

function quantiseRatio(ratio, thresholdPercent) {
  if (!(thresholdPercent > 0)) return ratio;
  var step = thresholdPercent / 100;
  if (step >= 1) return ratio > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, Math.ceil(ratio / step) * step));
}

function readHpMeta(item) {
  var m = item && item.metadata ? item.metadata[KEY_HP] : null;
  if (!m || typeof m !== "object") return null;
  var cur = readIntOrNull(m.cur);
  var max = typeof m.max === "number" && isFinite(m.max) && m.max > 0 ? Math.round(m.max) : null;
  var temp = typeof m.temp === "number" && isFinite(m.temp) ? Math.max(0, Math.round(m.temp)) : 0;
  if (cur === null && max === null) return null;
  var surges = typeof m.surges === "number" && isFinite(m.surges) ? Math.max(0, Math.round(m.surges)) : null;
  var surgesMax = typeof m.surgesMax === "number" && isFinite(m.surgesMax) && m.surgesMax > 0
    ? Math.round(m.surgesMax) : null;
  return {
    cur: cur, max: max, temp: temp,
    surges: surges, surgesMax: surgesMax,
    defenses: readDefenses(m.defenses),

    locked: m.locked !== false,
    name: item && typeof item.name === "string" ? item.name.trim().slice(0, 120) : ""
  };
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

function ringSectorPoints(radiusOuter, radiusInner, ratio, segments) {
  var n = Math.max(8, Math.round(segments || HP_RING_SEGMENTS));
  var sweep = Math.max(0.0001, Math.min(1, ratio)) * Math.PI * 2;
  var a0 = -Math.PI / 2;
  var pts = [];
  var i;
  for (i = 0; i <= n; i++) {
    var a = a0 + sweep * (i / n);
    pts.push({ x: Math.cos(a) * radiusOuter, y: Math.sin(a) * radiusOuter });
  }
  for (i = n; i >= 0; i--) {
    var b = a0 + sweep * (i / n);
    pts.push({ x: Math.cos(b) * radiusInner, y: Math.sin(b) * radiusInner });
  }
  return pts;
}

function shieldPoints(W, H, segments) {
  var seg = segments || 14;
  var pts = [];
  var cornerR = Math.min(W, H) * 0.18;
  var sideStraightBottom = H * 0.42;
  var i, t, a;

  for (i = 0; i <= seg; i++) {
    t = i / seg; a = -Math.PI + (Math.PI / 2) * t;
    pts.push({ x: cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }

  for (i = 0; i <= seg; i++) {
    t = i / seg; a = -Math.PI / 2 + (Math.PI / 2) * t;
    pts.push({ x: W - cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  pts.push({ x: W, y: sideStraightBottom });

  var segs2 = seg * 2;
  for (i = 1; i <= segs2; i++) {
    t = i / segs2;
    var u = 1 - t;
    pts.push({
      x: u * u * W + 2 * u * t * (W * 0.85) + t * t * (W / 2),
      y: u * u * sideStraightBottom + 2 * u * t * (H * 0.92) + t * t * H
    });
  }

  for (i = 1; i <= segs2; i++) {
    t = i / segs2;
    var v = 1 - t;
    pts.push({
      x: v * v * (W / 2) + 2 * v * t * (W * 0.15) + t * t * 0,
      y: v * v * H + 2 * v * t * (H * 0.92) + t * t * sideStraightBottom
    });
  }
  return pts;
}

function circlePoints(D, segments) {
  var n = Math.max(8, Math.round(segments || DEF_CIRCLE_SEGMENTS));
  var r = D / 2;
  var out = [];
  for (var i = 0; i < n; i++) {
    var a = -Math.PI / 2 + (Math.PI * 2) * (i / n);
    out.push({ x: r + Math.cos(a) * r, y: r + Math.sin(a) * r });
  }
  return out;
}

function defShapePoints(sh) {
  return sh.circle ? circlePoints(sh.d, DEF_CIRCLE_SEGMENTS) : shieldPoints(sh.d, sh.d);
}

/* ---- 7. token 血条：环形 48 段 + 环内数字 + 四角四防 ---- */
function barLayout(bounds, dpi, hp, viewer) {
  /* ---- v1.7.9 环形血条的像素常数（真机微调只改这里；s = min(宽,高)/dpi）---- */
  var RING_THICK = HP_RING_THICK;
  var RING_INSET = HP_RING_INSET;
  var RING_SEGMENTS = HP_RING_SEGMENTS;

  var max = hp.max > 0 ? hp.max : (hp.cur !== null ? Math.max(1, hp.cur) : 1);
  var cur = hp.cur === null ? max : hp.cur;
  var ratio = Math.max(0, Math.min(1, cur / max));
  /* v1.8.0 血怒（bloodied）：4E 口径 cur ≤ max/2。只影响颜色与返回值，不动数据结构。 */
  var bloodied = max > 0 ? cur <= max / 2 : false;
  var s = Math.min(bounds.width, bounds.height) / dpi;
  if (!isFinite(s) || s <= 0) s = 1;
  s = Math.max(0.2, Math.min(6, s));

  var exact = !viewer || viewer.exact !== false;
  var threshold = viewer && typeof viewer.threshold === "number" ? viewer.threshold : PLAYER_THRESHOLD_DEFAULT;
  var shownRatio = exact ? ratio : quantiseRatio(ratio, threshold);

  var halfShort = Math.min(bounds.width, bounds.height) / 2;
  /* v1.8.0：RO = 半短边 − inset·s（环的所有点半径 ≤ RO ⇒ 永远不超出包围盒）；
   * Ri = RO − T。不再用 max(3s, …) 把半径顶回去 —— 那会让极小 token 的环越界。 */
  var ringRo = Math.max(0, halfShort - RING_INSET * s);
  var ringT = Math.min(RING_THICK * s, ringRo * 0.9);
  if (!(ringT > 0) || !isFinite(ringT)) ringT = 0;
  var ringRi = Math.max(0, ringRo - ringT);
  if (!isFinite(ringRi)) ringRi = 0;
  var ring = {
    cx: bounds.center.x, cy: bounds.center.y,
    Ro: ringRo, Ri: ringRi, T: ringT,
    ratio: shownRatio, segments: RING_SEGMENTS
  };

  var hpText = exact ? (String(cur) + "/" + max + (hp.temp > 0 ? " +" + hp.temp : "")) : "";
  /* v1.8.0：HP 数字放环内且自动降字号 —— 文字框必须落在内圆 Ri 里（旧版固定 1.4·Ri 宽，
   * 长文本会被裁）。availR = Ri − 1.5s 是文字可用的半径；字宽按 0.66em/字符估
   * （≥ Roboto 数字实际宽度），装不下就 ×0.9 递减到 3s 下限；连下限都装不下
   * （极小 token）就整块隐藏，绝不裁切。 */
  var textDrop = 0.52;
  var availR = Math.max(0, ringRi - 1.5 * s);
  var hpFont = 0, hpTextW = 0, hpTextH = 0, hpTextFits = false;
  if (hpText && availR > 2 * s) {
    var tryFont = Math.max(4 * s, Math.min(ringRi * 0.62, availR * 0.9));
    var fontFloor = 3 * s;
    for (var fitTry = 0; fitTry < 64; fitTry++) {
      var needW = Math.max(6 * s, hpText.length * tryFont * 0.66);
      var needH = Math.max(4 * s, tryFont * 1.35);
      var yFar = textDrop * ringRi + needH / 2;
      var chord = yFar < availR ? Math.sqrt(availR * availR - yFar * yFar) : 0;
      if (needH / 2 <= availR && needW / 2 <= chord * 0.98) {
        hpFont = tryFont; hpTextW = needW; hpTextH = needH; hpTextFits = true;
        break;
      }
      if (!(tryFont > fontFloor)) break;
      tryFont = Math.max(fontFloor, tryFont * 0.9);
    }
  }
  if (!hpTextFits) { hpText = ""; hpFont = 0; hpTextW = 0; hpTextH = 0; }
  var hpTextX = bounds.center.x - hpTextW / 2;
  var hpTextY = bounds.center.y + ringRi * 0.52 - hpTextH / 2;

  var dAc = SHIELD_DIAMETER * s;
  var dDef = DEF_CIRCLE_DIAMETER * s;
  var dRow = Math.max(dAc, dDef);
  /* v1.8.0：贴角内缩至少留下「描边一半 + 0.5s」，保证整枚四防（含 strokeWidth）
   * 完全落在包围盒内。名义值 8s（SHIELD_INSET）远大于描边，这里只是兜底。 */
  var strokeHalf = Math.max(0.6, dRow * 0.04) / 2;
  var inset = Math.max(SHIELD_INSET * s, strokeHalf + 0.5 * s);
  var needTwo = 2 * dRow + inset * 2;
  var rowKeys = [];
  var i;
  if (hp.defenses) {
    for (i = 0; i < DEF_ROW.length; i++) {
      if (typeof hp.defenses[DEF_ROW[i]] === "number") rowKeys.push(DEF_ROW[i]);
    }
  }
  while (rowKeys.length > 1 && (needTwo > bounds.width || needTwo > bounds.height)) {
    var dropped = false;
    for (i = 0; i < DEF_DROP.length; i++) {
      var at = rowKeys.indexOf(DEF_DROP[i]);
      if (at < 0) continue;
      rowKeys.splice(at, 1);
      dropped = true;
      break;
    }
    if (!dropped) break;
  }
  var needOne = dRow + inset * 2;
  var showDefenses = !!hp.defenses && exact && rowKeys.length > 0 &&
    needOne <= bounds.width && needOne <= bounds.height;
  var shields = [];
  if (showDefenses) {

    for (i = 0; i < DEF_ROW.length; i++) {
      var k = DEF_ROW[i];
      if (rowKeys.indexOf(k) < 0) continue;
      var val = hp.defenses[k];
      var txt = String(val);

      var ghost = k === "ac";
      var dk = ghost ? dAc : dDef;
      var corner = DEF_CORNER[k] || "left-top";
      var onLeft = corner.indexOf("left") === 0;
      var onTop = corner.indexOf("top") >= 0;
      shields.push({
        key: k, value: val, text: txt, d: dk, corner: corner,
        x: onLeft ? bounds.min.x + inset + dk / 2 : bounds.max.x - inset - dk / 2,
        y: onTop ? bounds.min.y + inset + dk / 2 : bounds.max.y - inset - dk / 2,
        circle: !ghost,
        color: DEF_COLORS[k], ghost: ghost,
        fillOpacity: ghost ? DEF_AC_FILL_OPACITY : DEF_FILL_OPACITY,
        strokeOpacity: ghost ? DEF_AC_STROKE_OPACITY : DEF_STROKE_OPACITY,

        fontSize: Math.max(8 * s, dk * (txt.length > 2 ? 0.46 : 0.5))
      });
    }
  }

  return {
    scale: s, exact: exact,
    ratio: shownRatio, rawRatio: ratio,
    bloodied: bloodied,
    ring: ring,
    hpText: hpText, hpFont: hpFont, hpTextW: hpTextW, hpTextH: hpTextH,
    hpTextX: hpTextX, hpTextY: hpTextY, hpTextFits: hpTextFits,
    colorFill: bloodied ? COLOR_HP_BLOODIED : COLOR_HP_FILL,
    showDefenses: showDefenses, shields: shields, d: dRow, dAc: dAc, dDef: dDef,
    cornerInset: inset, textVisible: exact && hpTextFits && !!hpText
  };
}

function barRolesKey(L) {
  return [
    L.shields.length ? "D" + L.shields.map(function (x) { return x.key; }).join("") : "",
    L.textVisible ? "T" : ""
  ].join("");
}

function barSig(hp, L) {
  var d = hp.defenses;
  return [
    hp.cur, hp.max, hp.temp,
    d ? [d.ac, d.fort, d.reflex, d.will].join(",") : "",
    hp.locked ? 1 : 0, L.exact ? 1 : 0,
    Math.round(L.ring.Ro * 10), Math.round(L.ring.T * 10),
    Math.round(L.scale * 1000),
    L.shields.length ? Math.round(L.shields[0].d) : 0
  ].join("|");
}
function barMeta(tokenId, role, extra) {
  var box = {};
  var tag = { owner: tokenId, role: role };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) tag[k] = extra[k];
  box[BAR_TAG] = tag;
  return box;
}

function barCurveItem(tokenId, role, points, x, y, opt) {
  opt = opt || {};
  var b = barCommon(buildCurve(), tokenId, role, BAR_Z[role] || 10000)
    .fillColor(opt.fill || "#ffffff")
    .fillOpacity(typeof opt.fillOpacity === "number" ? opt.fillOpacity : 1)
    .strokeColor(opt.stroke || "#000000")
    .strokeOpacity(typeof opt.strokeOpacity === "number" ? opt.strokeOpacity : 0)
    .strokeWidth(typeof opt.strokeWidth === "number" ? opt.strokeWidth : 0)
    .tension(0)
    .closed(opt.closed !== false)
    .points(points)
    .position({ x: x, y: y })
    .visible(opt.visible !== false);
  if (opt.extra) b.metadata(barMeta(tokenId, role, opt.extra));
  return b.build();
}

function barTextItem(tokenId, role, text, font, color, x, y, w, h, opt) {
  opt = opt || {};
  var b = barCommon(buildText(), tokenId, role, BAR_Z[role] || 12400)
    .plainText(text).textType("PLAIN")
    .textAlign(opt.align || "CENTER").textAlignVertical("MIDDLE")
    .fontFamily("Roboto, sans-serif").fontSize(font)
    .fontWeight(opt.weight || 700)
    .fillColor(color || "#ffffff").fillOpacity(1)
    .strokeColor(opt.stroke || "#000000")
    .strokeOpacity(typeof opt.strokeOpacity === "number" ? opt.strokeOpacity : 0.7)
    .strokeWidth(Math.max(0.4, typeof opt.strokeWidth === "number" ? opt.strokeWidth : 0.5))
    .lineHeight(0.95).width(w).height(h)
    .position({ x: x, y: y })
    .visible(opt.visible !== false);

  if (opt.extra) b.metadata(barMeta(tokenId, role, opt.extra));
  return b.build();
}

function findShield(L, key) {
  for (var i = 0; i < L.shields.length; i++) if (L.shields[i].key === key) return L.shields[i];
  return null;
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
  var R = L.ring;
  var i;

  items.push(barCurveItem(tokenId, "ring-bg",
    ringSectorPoints(R.Ro, R.Ri, 1, R.segments), R.cx, R.cy,
    { fill: COLOR_RING_BG, fillOpacity: HP_RING_BG_OPACITY }));
  items.push(barCurveItem(tokenId, "ring-fill",
    ringSectorPoints(R.Ro, R.Ri, R.ratio, R.segments), R.cx, R.cy,
    { fill: L.colorFill, fillOpacity: 0.9, visible: R.ratio > 0 }));

  items.push(barTextItem(tokenId, "bar-text", L.hpText, L.hpFont, "#ffffff",
    L.hpTextX, L.hpTextY, L.hpTextW, L.hpTextH,
    { strokeWidth: Math.max(0.4, L.hpFont * 0.09), visible: L.textVisible }));

  for (i = 0; i < L.shields.length; i++) {
    var sh = L.shields[i];
    items.push(barCurveItem(tokenId, "shield", defShapePoints(sh), sh.x - sh.d / 2, sh.y - sh.d / 2,
      {
        fill: sh.color, fillOpacity: sh.fillOpacity, stroke: "#ffffff", strokeOpacity: sh.strokeOpacity,
        strokeWidth: Math.max(0.6, sh.d * 0.04), extra: { key: sh.key }
      }));
    items.push(barTextItem(tokenId, "shield-text", sh.text, sh.fontSize, "#ffffff",
      sh.x - sh.d / 2, sh.y - sh.d / 2, sh.d, sh.d,
      { strokeWidth: Math.max(0.4, sh.d * 0.02), strokeOpacity: sh.ghost ? 0.85 : 0.7, extra: { key: sh.key } }));
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
  var R = L.ring;
  await OBR.scene.local.updateItems(entry.ids, function (drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var tag = d.metadata && d.metadata[BAR_TAG] ? d.metadata[BAR_TAG] : null;
      var role = tag && tag.role ? tag.role : "";
      switch (role) {
        case "ring-bg":
          d.position = { x: R.cx, y: R.cy };
          d.points = ringSectorPoints(R.Ro, R.Ri, 1, R.segments);
          d.visible = true;
          break;
        case "ring-fill":
          d.position = { x: R.cx, y: R.cy };
          d.points = ringSectorPoints(R.Ro, R.Ri, R.ratio, R.segments);
          /* v1.8.0 血怒两段色：只改填充色，不重建 item（rolesKey 不变时走的就是这里）。 */
          if (d.style) d.style.fillColor = L.colorFill;
          d.visible = R.ratio > 0;
          break;
        case "bar-text":
          if (!d.text) break;
          d.text.plainText = L.hpText;
          d.text.style.fontSize = L.hpFont;
          d.text.width = L.hpTextW;
          d.text.height = L.hpTextH;
          d.position = { x: L.hpTextX, y: L.hpTextY };
          d.visible = L.textVisible;
          break;
        case "shield": {
          var sh = findShield(L, tag.key);
          if (!sh) { d.visible = false; break; }
          d.points = defShapePoints(sh);
          d.position = { x: sh.x - sh.d / 2, y: sh.y - sh.d / 2 };
          d.visible = true;
          break;
        }
        case "shield-text": {
          var shx = findShield(L, tag.key);
          if (!shx || !d.text) { d.visible = false; break; }
          d.text.plainText = shx.text;
          d.text.style.fontSize = shx.fontSize;
          d.text.width = shx.d;
          d.text.height = shx.d;
          d.position = { x: shx.x - shx.d / 2, y: shx.y - shx.d / 2 };
          d.visible = true;
          break;
        }
        default:
          break;
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
  } catch (e) {  }
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
  } catch (e) {  }
}

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
    var viewer = await sceneViewer();
    var items = await OBR.scene.items.getItems();
    var dpi = await sceneDpi();
    var want = {};
    var order = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type !== "IMAGE") continue;

      if (!hpBarEnabled(it)) continue;
      var hp = readHpMeta(it);
      if (!hp) continue;
      want[it.id] = { hp: hp, item: it };
      order.push(it.id);
    }
    var known = Object.keys(barEntries);
    for (var j = 0; j < known.length; j++) {
      if (!want[known[j]]) await removeBar(known[j]);
    }
    for (var k = 0; k < order.length; k++) {
      var id = order[k];
      var rec = want[id];
      var bounds = null;
      try {
        bounds = await OBR.scene.items.getItemBounds([id]);
      } catch (e) {
        continue;
      }
      if (!bounds || !bounds.center) continue;

      var exact = viewer.role === "GM" || !!(viewer.id && rec.item.createdUserId === viewer.id) || !rec.hp.locked;
      var L = barLayout(bounds, dpi, rec.hp, { exact: exact, threshold: viewer.threshold });
      var sig = barSig(rec.hp, L);
      var rolesKey = barRolesKey(L);
      var entry = barEntries[id];
      if (entry && entry.sig === sig && entry.rolesKey === rolesKey && !entry.force) continue;
      if (entry && entry.rolesKey === rolesKey && !entry.force) {
        try {
          await patchBar(entry, L);
          entry.sig = sig;
          continue;
        } catch (e2) {
          await removeBar(id);
        }
      } else if (entry) {

        await removeBar(id);
      }
      try {
        barEntries[id] = { ids: await addBar(id, L), sig: sig, rolesKey: rolesKey };
      } catch (e3) {
        pageLog("err", "画血条失败（" + id + "）：" + errText(e3));
      }
    }
  } catch (e) {
    pageLog("err", "同步 token 血条失败：" + errText(e));
  } finally {
    barBusy = false;
    if (barAgain) { barAgain = false; scheduleBars(); }
  }
}

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

var INIT_MAX_ENTRIES = 40;
var INIT_LS_FALLBACK = "4enext/state/initiative";

function initInt(v, d) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : d;
}
function initNum(v, d) {
  return typeof v === "number" && isFinite(v) ? v : d;
}
function initClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function initPhase(v) {
  var s = String(v == null ? "" : v);
  return s === "preparing" || s === "combat" ? s : "idle";
}
function initTbOf(e) {
  return e && typeof e.tb === "number" && isFinite(e.tb) ? e.tb : 0.5;
}
/* ---- 8. 先攻数据层：normalize / 上限 40 / 写失败降级本机 ---- */
function initNorm(raw) {
  var out = { v: 1, updatedAt: 0, phase: "idle", round: 1, surprise: false, activeId: "", entries: [] };
  if (!raw || typeof raw !== "object") return out;
  out.updatedAt = initInt(raw.updatedAt, 0);
  out.phase = initPhase(raw.phase);
  out.round = Math.max(1, initInt(raw.round, 1));
  out.surprise = out.phase === "combat" ? !!raw.surprise : false;
  var src = Array.isArray(raw.entries) ? raw.entries.slice(0, INIT_MAX_ENTRIES) : [];
  var seen = {};
  for (var i = 0; i < src.length; i++) {
    var e = src[i];
    if (!e || typeof e !== "object") continue;
    var tokenId = String(e.tokenId == null ? "" : e.tokenId).trim();
    if (!tokenId || seen[tokenId]) continue;
    seen[tokenId] = true;
    var name = String(e.name == null ? "" : e.name).trim().slice(0, 80) || "未命名";
    var d20raw = initNum(e.d20, null);
    var tbraw = initNum(e.tb, null);
    out.entries.push({
      tokenId: tokenId,
      name: name,

      init: initClamp(initNum(e.init, 0), -99, 999),
      bonus: initClamp(initInt(e.bonus, 0), -99, 999),
      d20: d20raw === null ? null : initClamp(Math.round(d20raw), 1, 20),
      tb: tbraw === null ? null : initClamp(tbraw, 0.001, 0.999),
      hidden: !!e.hidden,
      ownerId: String(e.ownerId == null ? "" : e.ownerId),
      updatedAt: initInt(e.updatedAt, 0)
    });
  }
  var wanted = String(raw.activeId == null ? "" : raw.activeId);
  var hit = null;
  for (var j = 0; j < out.entries.length; j++) if (out.entries[j].tokenId === wanted) hit = out.entries[j];
  out.activeId = hit ? hit.tokenId : (out.entries[0] ? out.entries[0].tokenId : "");
  if (!out.entries.length) out.round = 1;
  return out;
}

function initSortEntries(list) {
  return list.slice().sort(function (a, b) {
    var d = initNum(b.init, 0) - initNum(a.init, 0);
    if (d) return d;
    var t = initTbOf(a) - initTbOf(b);
    if (t) return t;
    return String(a.name).localeCompare(String(b.name), "zh-CN") || (initInt(a.updatedAt, 0) - initInt(b.updatedAt, 0));
  });
}

function initTiebreak(bonus) {
  var m = typeof bonus === "number" && isFinite(bonus) ? bonus : 0;
  var base = 0.5 - m * 0.01 + Math.random() * 0.008;
  return Math.round(Math.max(0.001, Math.min(0.999, base)) * 1e6) / 1e6;
}

function initLocalFallback() {
  try {
    var raw = localStorage.getItem(INIT_LS_FALLBACK);
    if (!raw) return null;
    var box = JSON.parse(raw);
    var st = box && box.state ? box.state : box;
    if (!st || typeof st !== "object") return null;
    var out = initNorm(st);
    out.entries = initSortEntries(out.entries);
    return out.entries.length ? out : null;
  } catch (e) {
    return null;
  }
}

async function initRead() {
  try {
    var meta = await OBR.room.getMetadata();
    var raw = meta ? meta[KEY_INITIATIVE] : null;
    if (raw) {
      var st = initNorm(raw);
      st.entries = initSortEntries(st.entries);
      return st;
    }
    return initLocalFallback() || initNorm(null);
  } catch (e) {
    pageLog("err", "读取先攻失败：" + errText(e));
    return initLocalFallback() || initNorm(null);
  }
}

async function initWrite(state) {
  var next = initNorm(state);
  next.entries = initSortEntries(next.entries);
  next.updatedAt = Date.now();
  var res = await roomWriteGuarded(KEY_INITIATIVE, next);
  if (res.ok) {
    try { localStorage.removeItem(INIT_LS_FALLBACK); } catch (e2) {  }
    return next;
  }
  var msg = res.reason === "full" ? "房间数据已满（16KB）" : errText(res.error);
  try {
    localStorage.setItem(INIT_LS_FALLBACK, JSON.stringify({ v: 1, updatedAt: Date.now(), state: next }));
  } catch (e3) {  }
  notify(res.reason === "full"
    ? ROOM_FULL_MESSAGE
    : "先攻没能写进房间数据（" + msg + "）：已暂存在本机。先攻最多 " + INIT_MAX_ENTRIES + " 条。", "ERROR");
  pageLog("err", "先攻写入失败（" + (res.reason || "error") + "，" + res.bytes + " 字符）：已暂存到本机");
  next.local = true;
  return next;
}
function initRollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function initBonusOf(item) {
  var m = item && item.metadata ? item.metadata[KEY_INIT] : null;
  if (m && typeof m === "object" && typeof m.bonus === "number" && isFinite(m.bonus)) {
    return initClamp(Math.round(m.bonus), -99, 999);
  }
  return 0;
}

async function initAdd(item, hidden) {
  if (!item || !item.id) return null;
  var state = await initRead();
  var cards = await getCards();
  var cardId = item.metadata ? item.metadata[KEY_BIND] : null;
  var card = typeof cardId === "string" ? findCard(cards, cardId) : null;
  var name = String(item.name || (card && card.name) || "未命名").trim().slice(0, 80) || "未命名";
  var bonus = initBonusOf(item);
  var ownerId = String(item.createdUserId || "");
  var idx = -1;
  for (var i = 0; i < state.entries.length; i++) {
    if (state.entries[i].tokenId === item.id) { idx = i; break; }
  }
  var entry = null;
  if (idx >= 0) {
    var old = state.entries[idx];
    entry = {
      tokenId: old.tokenId,
      name: name || old.name,
      init: old.init,
      bonus: bonus,
      d20: old.d20,
      tb: old.tb,
      hidden: !!(old.hidden || hidden),
      ownerId: ownerId || old.ownerId,
      updatedAt: Date.now()
    };
    state.entries[idx] = entry;
  } else {
    if (state.entries.length >= INIT_MAX_ENTRIES) {
      notify("先攻已经有 " + INIT_MAX_ENTRIES + " 条了（房间数据上限）：先清掉几个再加", "WARNING");
      return null;
    }

    var d20 = initRollD20();
    entry = {
      tokenId: item.id,
      name: name,
      init: d20 + bonus,
      bonus: bonus,
      d20: d20,
      tb: initTiebreak(bonus),
      hidden: !!hidden,
      ownerId: ownerId,
      updatedAt: Date.now()
    };
    state.entries.push(entry);
    state.entries = initSortEntries(state.entries);
  }
  if (!state.activeId && state.entries.length) state.activeId = state.entries[0].tokenId;
  var next = await initWrite(state);
  return { state: next, entry: entry };
}

function initRemove(state, tokenId) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  var id = String(tokenId == null ? "" : tokenId);
  var idx = -1;
  for (var i = 0; i < out.entries.length; i++) {
    if (out.entries[i].tokenId === id) { idx = i; break; }
  }
  if (idx < 0) return out;
  var wasActive = out.entries[idx].tokenId === out.activeId;
  out.entries.splice(idx, 1);
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
  } else if (wasActive) {
    out.activeId = out.entries[Math.min(idx, out.entries.length - 1)].tokenId;
  }
  out.updatedAt = Date.now();
  return out;
}

function initMissingIds(state, alive) {
  var has = {};
  if (Array.isArray(alive)) {
    for (var i = 0; i < alive.length; i++) has[String(alive[i])] = true;
  } else if (alive && typeof alive === "object") {
    for (var k in alive) if (Object.prototype.hasOwnProperty.call(alive, k) && alive[k]) has[String(k)] = true;
  }
  var out = [];
  var list = state && Array.isArray(state.entries) ? state.entries : [];
  for (var j = 0; j < list.length; j++) {
    if (list[j] && list[j].tokenId && !has[String(list[j].tokenId)]) out.push(String(list[j].tokenId));
  }
  return out;
}

function initPrune(state, alive) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  var missing = initMissingIds(out, alive);
  for (var i = 0; i < missing.length; i++) out = initRemove(out, missing[i]);
  if (missing.length) out.updatedAt = Date.now();
  return out;
}

var initKnownTokens = {};
var initPruneBusy = false;
var initPruneTimer = null;
var initPruneMuteUntil = 0;

function initRememberItems(items) {
  var next = {};
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].id) next[String(items[i].id)] = true;
  }
  initKnownTokens = next;
  return next;
}

async function refreshInitKnownTokens() {
  initPruneMuteUntil = Date.now() + 1200;
  try {
    var items = await OBR.scene.items.getItems();
    initRememberItems(items || []);
  } catch (e) {  }
}

function scheduleInitPrune() {
  if (initPruneTimer) return;
  initPruneTimer = setTimeout(function () {
    initPruneTimer = null;
    void pruneMissingInitEntries();
  }, 400);
}

async function pruneMissingInitEntries() {
  if (initPruneBusy) return 0;
  if (Date.now() < initPruneMuteUntil) return 0;

  if (initBusy) return 0;
  initPruneBusy = true;
  try {
    var role = "";
    try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
    if (role !== "GM") return 0;
    var state = await initRead();
    if (!state.entries.length) return 0;
    var items = [];
    try { items = await OBR.scene.items.getItems(); } catch (e2) { return 0; }
    var alive = {};
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id) alive[String(items[i].id)] = true;
    }
    var missing = [];
    for (var j = 0; j < state.entries.length; j++) {
      var id = state.entries[j] && state.entries[j].tokenId;
      if (id && !alive[id] && initKnownTokens[id]) missing.push(id);
    }
    initKnownTokens = alive;
    if (!missing.length) return 0;
    var next = state;
    for (var k = 0; k < missing.length; k++) next = initRemove(next, missing[k]);
    await initWrite(next);
    stepOk("先攻自动清理：" + missing.join(" / "));

    await syncInitFlags(initEntryIdsOf(next));
    return missing.length;
  } finally {
    initPruneBusy = false;
  }
}

async function onInitRemoveClick(context) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") {
      notify("移出先攻需要城主权限（房间数据只有城主能写）", "WARNING");
      return;
    }
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked || !picked.id) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }
    var state = await initRead();
    var entry = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].tokenId === picked.id) { entry = state.entries[i]; break; }
    }
    if (!entry) {

      notify("「" + (picked.name || picked.id) + "」已经不在先攻里了", "WARNING");
      await syncInitFlags();
      return;
    }
    var next = initRemove(state, picked.id);
    await initWrite(next);
    stepOk("移出先攻：" + entry.name);

    await syncInitFlags(initEntryIdsOf(next));
  } catch (e) {
    stepFail("移出先攻", e);
  }
}

async function onInitMenuClick(context, hidden) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") {
      notify("加入先攻需要城主权限（房间数据只有城主能写）", "WARNING");
      return;
    }
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }

    var fresh = null;
    try { fresh = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e) { fresh = null; }
    var res = await initAdd(fresh || picked, hidden);
    if (!res) return;
    stepOk("加入先攻：" + res.entry.name + (hidden ? "（隐形）" : "") +
      "（先攻 " + Math.round(res.entry.init) + "）");

    initKnownTokens[String(picked.id)] = true;
    await syncInitFlags(initEntryIdsOf(res.state));

    if (!stripOpen) void openStripOrNotify("右键加入先攻");
  } catch (e) {
    stepFail("加入先攻", e);
  }
}

function initAdvance(state, dir) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
    return out;
  }
  var step = dir < 0 ? -1 : 1;
  var idx = -1;
  for (var i = 0; i < out.entries.length; i++) {
    if (out.entries[i].tokenId === out.activeId) { idx = i; break; }
  }
  if (idx < 0) idx = 0;
  var next = idx + step;
  if (next >= out.entries.length) {
    next = 0;
    if (out.surprise) out.surprise = false;
    else out.round = Math.max(1, out.round + 1);
  } else if (next < 0) {
    next = out.entries.length - 1;
    if (out.round > 1) out.round -= 1;
  }
  out.activeId = out.entries[next].tokenId;
  out.updatedAt = Date.now();
  return out;
}

var initBusy = false;

async function onInitRequest(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.op !== "end-turn") return;
  if (initBusy) {
    pageLog("info", "正在推进回合，忽略重复的结束回合请求");
    return;
  }
  initBusy = true;
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") return;
    var state = await initRead();
    if (state.phase !== "combat") {
      notify("现在不在战斗回合里，结束回合请求已忽略", "WARNING");
      return;
    }
    var active = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].tokenId === state.activeId) { active = state.entries[i]; break; }
    }
    if (!active) return;

    if (!data.activeId || data.activeId !== state.activeId) {
      notify("回合已经变了，结束回合请求已忽略", "WARNING");
      return;
    }

    var owner = active.ownerId;
    try {
      var items = await OBR.scene.items.getItems([active.tokenId]);
      var live = items && items[0] ? String(items[0].createdUserId || "") : "";
      if (live) owner = live;
    } catch (e2) {  }
    if (!data.playerId || owner !== data.playerId) {
      notify("只能结束自己的回合", "WARNING");
      return;
    }
    var next = initAdvance(state, 1);
    await initWrite(next);

  } catch (e) {
    pageLog("err", "处理结束回合请求失败：" + errText(e));
  } finally {

    initBusy = false;
  }
}

/* ---- 9. 骰子落库：归一化 / 幂等合并 / 上限 20 条 / 落到本机 ---- */
function rollSides(type) {
  var m = /^d(\d+)$/i.exec(String(type == null ? "" : type).trim());
  if (!m) return 0;
  var n = parseInt(m[1], 10);
  return n > 0 ? n : 0;
}
function rollInt(v, lo, hi, d) {
  var n = typeof v === "number" && isFinite(v) ? Math.round(v) : d;
  return Math.max(lo, Math.min(hi, n));
}
function rollColor(v) {
  var s = String(v == null ? "" : v).trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : ROLL_COLOR_DEFAULT;
}
function rollText(v, n) {
  var s = v == null ? "" : String(v);
  return s.length > n ? s.slice(0, n) : s;
}
function rollTs(v) {
  var n = typeof v === "number" && isFinite(v) ? Math.round(v) : Date.now();
  return n > 0 ? n : Date.now();
}
function rollDieNorm(raw) {
  if (!raw || typeof raw !== "object") return null;
  var sides = rollSides(String(raw.type || "d20").toLowerCase());
  if (!sides) return null;
  var out = { type: "d" + sides, value: rollInt(raw.value, 1, sides, 1) };
  if (raw.loser) out.loser = true;
  if (raw.subtract) out.subtract = true;
  if (typeof raw.originalValue === "number" && isFinite(raw.originalValue)) out.originalValue = Math.round(raw.originalValue);
  if (typeof raw.burstParent === "number" && isFinite(raw.burstParent)) out.burstParent = Math.max(0, Math.round(raw.burstParent));
  return out;
}

function rollNorm(raw) {
  if (!raw || typeof raw !== "object") return null;
  var rollId = rollText(raw.rollId == null ? "" : String(raw.rollId).trim(), 80);
  if (!rollId) return null;
  var dice = [];
  if (Array.isArray(raw.dice) && raw.dice.length) {
    for (var i = 0; i < raw.dice.length; i++) {
      var d = rollDieNorm(raw.dice[i]);
      if (d) dice.push(d);
    }
  } else if (Array.isArray(raw.rolls)) {
    for (var j = 0; j < raw.rolls.length; j++) {
      var one = rollDieNorm({ type: "d20", value: raw.rolls[j] });
      if (one) dice.push(one);
    }
  } else if (typeof raw.value === "number") {
    var solo = rollDieNorm({ type: "d20", value: raw.value });
    if (solo) dice.push(solo);
  }
  var truncated = false;
  if (dice.length > ROLL_MAX_DICE) {
    dice = dice.slice(0, ROLL_MAX_DICE);
    truncated = true;
  }
  var rowStarts = [];
  if (Array.isArray(raw.rowStarts)) {
    for (var k = 0; k < raw.rowStarts.length && rowStarts.length < 20; k++) {
      var n = raw.rowStarts[k];
      if (typeof n === "number" && isFinite(n) && n >= 0) rowStarts.push(Math.round(n));
    }
  }

  var modifier = typeof raw.modifier === "number" && isFinite(raw.modifier) ? Math.round(raw.modifier) : 0;
  var base = 0;
  for (var q = 0; q < dice.length; q++) {
    if (dice[q].loser) continue;
    base += dice[q].subtract ? -Math.abs(dice[q].value) : dice[q].value;
  }

  var rows = rowStarts.length > 1 ? rowStarts.length : 1;
  var out = {
    v: 1,
    rollId: rollId,
    ts: rollTs(raw.ts),
    rollerId: rollText(raw.rollerId, 80),
    rollerName: rollText(raw.rollerName, 40) || "某人",
    rollerColor: rollColor(raw.rollerColor),
    label: rollText(raw.label, ROLL_LABEL_MAX),
    expression: rollText(raw.expression, ROLL_EXPR_MAX),
    mode: rollText(raw.mode || "free", 16),
    dice: dice,
    modifier: modifier,
    total: base + modifier * rows,
    crit: !!raw.crit
  };
  if (rowStarts.length > 1) out.rowStarts = rowStarts;
  if (truncated) out.truncated = true;
  if (raw.critDegraded) out.critDegraded = true;
  if (raw.itemId) out.itemId = rollText(raw.itemId, 80);
  return out;
}

function rollMerge(rows, incoming) {
  var list = Array.isArray(rows) ? rows.slice() : [];
  var row = rollNorm(incoming);
  if (!row) return list.slice(0, ROLL_MAX_ROWS);
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].rollId === row.rollId) return list.slice(0, ROLL_MAX_ROWS);
  }
  list.push(row);
  list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return list.slice(0, ROLL_MAX_ROWS);
}
async function rollReadBox() {
  try {
    var meta = await OBR.room.getMetadata();
    return meta ? meta[KEY_ROLLS] || null : null;
  } catch (e) {
    return null;
  }
}
function rollRowsOf(box) {
  var src = Array.isArray(box) ? box : box && Array.isArray(box.rows) ? box.rows : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < src.length && out.length < ROLL_MAX_ROWS; i++) {
    var row = rollNorm(src[i]);
    if (!row || seen[row.rollId]) continue;
    seen[row.rollId] = true;
    out.push(row);
  }
  out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return out.slice(0, ROLL_MAX_ROWS);
}

/* v1.9.2：骰子历史改**本机 + 广播**，不再写房间数据。后台只保留两件收尾：
 *   ① GM 首次启动把房间残留 KEY_ROLLS 迁进本机并清空房间键（只减不增，不需预算检查）；
 *   ② 清空请求时 GM 顺带清房间残留（本机记录由各端页面自己清）。
 * 本机键 = 4enext/dice-history/<roomId>，结构 { v:1, rows:[...] }，与 dice-history 页面共用。 */
var LS_DICE_HISTORY_PREFIX = "4enext/dice-history/";

function diceHistRoomId() {
  try {
    if (OBR.room && typeof OBR.room.id === "string" && OBR.room.id) return OBR.room.id;
  } catch (e) {  }
  return "default";
}
function diceHistKey() { return LS_DICE_HISTORY_PREFIX + diceHistRoomId(); }
function diceHistRead() {
  try {
    var raw = localStorage.getItem(diceHistKey());
    if (!raw) return [];
    var box = JSON.parse(raw);
    var src = Array.isArray(box) ? box : box && Array.isArray(box.rows) ? box.rows : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < src.length; i++) {
      var row = rollNorm(src[i]);
      if (!row || seen[row.rollId]) continue;
      seen[row.rollId] = true;
      out.push(row);
    }
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return out.slice(0, ROLL_MAX_ROWS);
  } catch (e) { return []; }
}
function diceHistWrite(rows) {
  try { localStorage.setItem(diceHistKey(), JSON.stringify({ v: 1, rows: (rows || []).slice(0, ROLL_MAX_ROWS) })); }
  catch (e) { /* 本机也存不下就算了 */ }
}

async function rollRole() {
  try { return await OBR.player.getRole(); } catch (e) { return ""; }
}

async function migrateRollsFromRoom() {
  try {
    if ((await rollRole()) !== "GM") return;
    var box = await rollReadBox();
    var oldRows = rollRowsOf(box);
    if (!oldRows.length) return;
    var merged = diceHistRead();
    for (var i = 0; i < oldRows.length; i++) merged = rollMerge(merged, oldRows[i]);
    diceHistWrite(merged);
    var seq = box && typeof box.seq === "number" && isFinite(box.seq) ? Math.round(box.seq) : 0;
    try {
      await OBR.room.setMetadata({ [KEY_ROLLS]: { v: 1, updatedAt: Date.now(), seq: seq + 1, rows: [] } });
    } catch (e) {
      pageLog("err", "清空房间骰子残留失败：" + errText(e));
    }
    pageLog("info", "骰子历史已迁移到本机：" + oldRows.length + " 条（房间数据已清空，不再占 16KB 预算）");
  } catch (e2) {
    pageLog("err", "迁移房间骰子历史失败：" + errText(e2));
  }
}

async function onRollClear() {
  if ((await rollRole()) !== "GM") return;
  try {
    var box = await rollReadBox();
    var oldRows = rollRowsOf(box);
    if (!oldRows.length) return;
    var seq = box && typeof box.seq === "number" && isFinite(box.seq) ? Math.round(box.seq) : 0;
    await OBR.room.setMetadata({ [KEY_ROLLS]: { v: 1, updatedAt: Date.now(), seq: seq + 1, rows: [] } });
    pageLog("info", "房间里的旧骰子记录已清空（本机记录由各端自己清）");
  } catch (e) {
    pageLog("err", "清空房间骰子残留失败：" + errText(e));
  }
}

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

/* ---- 10. 启动：工具栏 ×5 / 右键 / 浮动按钮 / 各频道订阅 ---- */
async function boot() {
  if (booted) return;
  booted = true;
  var t0 = Date.now();

  pageLog("info", "OBR.onReady 触发；插件 v" + PLUGIN_VERSION + "；BASE=" + BASE);
  pageLog("info", "OBR.isAvailable=" + String(OBR.isAvailable) + "；isReady=" + String(OBR.isReady));

  bootStatus.tool = await attempt("注册工具栏按钮 (OBR.tool.create ×4)", registerTools);

  bootStatus.menu = await attempt("注册右键菜单 (OBR.contextMenu.create)", registerContextMenu);

  bootStatus.scene = await sceneReady();
  bootStatus.button = await syncSceneButton();
  if (bootStatus.button) stepOk("打开右下角浮动按钮 ✓");
  else if (!bootStatus.scene) stepOk("场景还没就绪，浮动按钮等进入地图后再开");

  markStripClosed(false);
  markDiceHistClosed(false);
  await refreshInitKnownTokens();

  await syncInitFlags();
  /* v1.9.2：延迟 800ms 自动开骰子记录窗口（别和 1.5s 的静态资源预热抢）。 */
  setTimeout(function () { void maybeAutoOpenDiceHistory(); }, 800);

  await attempt("订阅 scene.onReadyChange", function () {
    OBR.scene.onReadyChange(function (ready) {
      void syncSceneButton();
      scheduleBars();

      void refreshInitKnownTokens();
      if (ready !== false) {
        void syncInitFlags();
        void maybeAutoOpenStrip("进入房间自动显示先攻条");
        setTimeout(function () { void maybeAutoOpenDiceHistory(); }, 800);
      }
    });
  });
  await attempt("订阅 player.onChange", function () {
    OBR.player.onChange(scheduleRefresh);
  });
  await attempt("订阅 scene.items.onChange", function () {
    OBR.scene.items.onChange(function () {
      scheduleRefresh();
      scheduleBars();

      scheduleInitPrune();
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
    OBR.room.onMetadataChange(function (meta) {
      scheduleRefresh();

      onRoomMetaChanged(meta);
    });
  });
  await attempt("订阅 " + CH_INFO_DRAG + "（速览弹窗拖动）", function () {
    OBR.broadcast.onMessage(CH_INFO_DRAG, onInfoDrag);
  });
  await attempt("订阅 " + CH_INIT_REQUEST + "（玩家结束回合）", function () {
    OBR.broadcast.onMessage(CH_INIT_REQUEST, onInitRequest);
  });
  await attempt("订阅 " + CH_WIN_DRAG + "（独立窗口拖动）", function () {
    OBR.broadcast.onMessage(CH_WIN_DRAG, onWinDrag);
  });
  await attempt("订阅 " + CH_STRIP_DRAG + "（先攻条拖动）", function () {
    OBR.broadcast.onMessage(CH_STRIP_DRAG, onStripDrag);
  });
  await attempt("订阅 " + CH_STRIP_CMD + "（先攻条命令：列表 / 尺寸）", function () {
    OBR.broadcast.onMessage(CH_STRIP_CMD, onStripCmd);
  });

  await attempt("订阅 " + CH_WIN_CLOSE + "（窗口 ✕ 兜底）", function () {
    OBR.broadcast.onMessage(CH_WIN_CLOSE, onWinClose);
  });
  /* v1.8.2：先攻条点卡片头像时，页面先发这条 → 后台 1.5s 内不自动弹速览（token 仍会选中高亮）。 */
  await attempt("订阅 " + CH_GLANCE_SUPPRESS + "（先攻条点卡片：暂不弹速览）", function () {
    OBR.broadcast.onMessage(CH_GLANCE_SUPPRESS, function () {
      suppressGlanceUntil = Date.now() + 1500;
    });
  });
  /* v1.9.2：骰子历史不再落房间数据；GM 启动时把旧 KEY_ROLLS 迁移到本机并清空房间残留。 */
  await attempt("迁移房间旧骰子历史到本机（GM）", function () {
    return migrateRollsFromRoom();
  });
  await attempt("订阅 " + CH_ROLL_CLEAR + "（清空骰子记录）", function () {
    OBR.broadcast.onMessage(CH_ROLL_CLEAR, onRollClear);
  });
  await attempt("订阅 " + CH_DICE_HIST_CMD + "（记录窗口开关）", function () {
    OBR.broadcast.onMessage(CH_DICE_HIST_CMD, onDiceHistCmd);
  });
  await attempt("订阅 " + CH_HP_EDIT_READY + "（血条编辑窗握手）", function () {
    OBR.broadcast.onMessage(CH_HP_EDIT_READY, onHpEditReady);
  });
  await attempt("订阅 " + CH_HP_EDIT_SAVED + "（血条编辑窗保存）", function () {
    OBR.broadcast.onMessage(CH_HP_EDIT_SAVED, onHpEditSaved);
  });
  await attempt("订阅 " + CH_HP_REPAINT + "（血条编辑窗重绘）", function () {
    OBR.broadcast.onMessage(CH_HP_REPAINT, onHpRepaint);
  });
  /* v1.8.9：信息窗页面 ready → 重发当前 target（防第一条 target 在 iframe 加载前丢掉）。 */
  await attempt("订阅 " + CH_INFO_READY + "（速览页 ready 握手）", function () {
    OBR.broadcast.onMessage(CH_INFO_READY, onInfoReady);
  });
  /* v1.9.0：页面刷新成功的 ack（同一 session + version ≥ pending 才清兜底计时器）。 */
  await attempt("订阅 " + CH_INFO_ACK + "（速览页刷新 ack）", function () {
    OBR.broadcast.onMessage(CH_INFO_ACK, onInfoAck);
  });
  await attempt("订阅 viewport.onChange", function () {
    if (!OBR.viewport || typeof OBR.viewport.onChange !== "function") return;
    var timer = null;
    OBR.viewport.onChange(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        void syncSceneButton();

        void reclampWins();

        void reclampStrip();
      }, 250);
    });
  });

  void maybeAutoOpenStrip();

  await refreshInfo().catch(function (e) { stepFail("初始化速览", e); });

  await watchLocalBars();
  scheduleBars();

  /* v1.8.9：串行预热速览（info）会用到的静态资源，让首次 / 后续打开 iframe 直接命中 HTTP 缓存。
   * 启动 1500ms 后开始、不 await、失败静默（离线 / 网络慢不影响启动）；URL 带与页面一致的 ?v=。 */
  setTimeout(function () {
    var v = "?v=" + encodeURIComponent(PLUGIN_VERSION);
    var list = [
      pageUrl("info.html"),
      pageUrl("assets/ui.css") + v,
      pageUrl("assets/glance.css") + v,
      pageUrl("assets/info.js") + v,
      pageUrl("assets/common.js"),
      pageUrl("assets/window.js"),
      pageUrl("assets/glance.js") + v,
      pageUrl("assets/track.js") + v,
      pageUrl("vendor/obr-sdk.js"),
      pageUrl("data/rules.js"),
      pageUrl("data/card-index.js") + v
    ];
    var i = 0;
    function next() {
      if (i >= list.length) return;
      var url = list[i++];
      try {
        var p = fetch(url, { cache: "force-cache" });
        if (p && typeof p.then === "function") p.then(next, next);
        else next();
      } catch (e) { next(); }
    }
    try { next(); } catch (e) { /* 静默 */ }
  }, 1500);

  var mark = function (v) { return v ? "✓" : "✗"; };
  var okLine = "4eNEXT to owlbear v" + PLUGIN_VERSION + " 已加载：工具栏×5 " + mark(bootStatus.tool) +
    " · 右键" + mark(bootStatus.menu) +
    " · 浮动按钮" + (bootStatus.scene ? mark(bootStatus.button) : "（等进地图）");
  var allOk = bootStatus.tool && bootStatus.menu;
  pageLog(allOk ? "ok" : "err", okLine + "；耗时 " + (Date.now() - t0) + "ms");

  if (diagNotifyEnabled() && !allOk) notify(okLine, "WARNING");

  await sendHello(CH_HELLO, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
  try {
    OBR.broadcast.onMessage(CH_PING, function () {
      void sendHello(CH_PONG, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
    });
  } catch (e) {
    pageLog("err", "订阅 " + CH_PING + " 失败：" + errText(e));
  }
}

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
} catch (e) {  }

if (typeof OBR === "undefined" || !OBR || typeof OBR.onReady !== "function") {

  pageLog("err", "没有拿到 OBR 对象：vendor/obr-sdk.js 没拼进 bundle，或 SDK 加载失败");
  try {
    var stEl = document.getElementById("diag-state");
    if (stEl) { stEl.className = "bad"; stEl.textContent = "没有拿到 OBR 对象：右键菜单 / 先攻都不会工作"; }
  } catch (e2) {  }
  if (diagNotifyEnabled()) notify("4E 后台：没有拿到 OBR 对象，右键菜单 / 先攻都不会工作", "ERROR");
} else {

  try {
    OBR.onReady(boot);
  } catch (e3) {
    pageLog("err", "注册 OBR.onReady 失败：" + errText(e3));
    if (diagNotifyEnabled()) notify("4E 后台：注册 OBR.onReady 失败：" + errText(e3), "ERROR");
  }
}

/* ---- 只读调试钩子（v1.8.0）：
 * 暴露血条几何的纯函数与常数，供 dev/test-geometry.mjs 在 Node 里对**真实源码**做离线断言。
 * 只读：页面运行时没有任何代码会写这个对象；挂在 window 上也只是多一个引用。 */
if (typeof window !== "undefined") {
  window.__4eBar = {
    version: PLUGIN_VERSION,
    barLayout: barLayout,
    barSig: barSig,
    barRolesKey: barRolesKey,
    ringSectorPoints: ringSectorPoints,
    shieldPoints: shieldPoints,
    circlePoints: circlePoints,
    defShapePoints: defShapePoints,
    quantiseRatio: quantiseRatio,
    CONSTANTS: {
      SHIELD_DIAMETER: SHIELD_DIAMETER,
      DEF_CIRCLE_DIAMETER: DEF_CIRCLE_DIAMETER,
      DEF_CIRCLE_SEGMENTS: DEF_CIRCLE_SEGMENTS,
      SHIELD_INSET: SHIELD_INSET,
      DEF_GAP: DEF_GAP,
      HP_RING_THICK: HP_RING_THICK,
      HP_RING_INSET: HP_RING_INSET,
      HP_RING_SEGMENTS: HP_RING_SEGMENTS,
      HP_RING_BG_OPACITY: HP_RING_BG_OPACITY,
      COLOR_HP_FILL: COLOR_HP_FILL,
      COLOR_HP_BLOODIED: COLOR_HP_BLOODIED,
      COLOR_RING_BG: COLOR_RING_BG,
      DEF_CORNER: DEF_CORNER,
      DEF_COLORS: DEF_COLORS,
      DEF_ROW: DEF_ROW,
      DEF_DROP: DEF_DROP,
      BAR_Z: BAR_Z
    }
  };
}
