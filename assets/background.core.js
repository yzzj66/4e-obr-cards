/* 4eNEXT to owlbear · 后台逻辑（单文件「经典脚本」，没有 import / export）
 * ---------------------------------------------------------------------------
 * 本文件不直接被浏览器加载：dev/build-background.mjs 把它和 vendor/obr-sdk.js
 * （去掉末尾 export{}）拼成 assets/background.bundle.js，background.html 只加载那一个
 * <script src>。外层作用域已经提供了 OBR（SDK 的 default export）。
 *
 * 窗口（各自一个 popover id，可同时打开；尺寸都是常量，见 WINS / *_W / *_H）：
 *   /info 速览 · /panel 角色卡 · /initiative-window 先攻列表 · /initiative-strip 先攻条
 *   /dice-window 骰子 · /dice-history-window 记录 · /hp-edit 血条编辑 · /settings-window 设置
 * 入口：工具栏 ×3（角色卡 / 先攻 / 传送门）+ manifest action 骰子按钮、右下设置按钮、右键 IMAGE token（含速览）
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
var TOOL_DICE_ID = NS + "/dice-tool";

var TOOL_GLANCE_ID = NS + "/glance-tool";
var TOOL_SETTINGS_ID = NS + "/settings-tool";
var CH_HELLO = NS + "/diag-hello";
var CH_PING = NS + "/diag-ping";
var CH_PONG = NS + "/diag-pong";
var PLUGIN_VERSION = "2.4.35";
var localStorageQuotaWarned = false;
function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (e) {
    try {
      if (!localStorageQuotaWarned) {
        localStorageQuotaWarned = true;
        notify("本机存储已满，已改用临时内存（刷新后可能丢失）", "WARNING");
      }
    } catch (e2) { /* 忽略 */ }
    console.error("[4enext] localStorage 写入失败", e);
    return false;
  }
}

var KEY_HP = NS + "/hp";

var KEY_HPBAR = NS + "/hp-bar/enabled";

var KEY_PLAYER_THRESHOLD = NS + "/settings.playerThreshold";

var ROOM_MAX_BYTES = 14 * 1024;
var ROOM_WRITE_LIMIT = 15500;
var ROOM_HARD_BYTES = 16 * 1024;
var ROOM_FULL_MESSAGE = "房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史";

var LS_CARDS = "4enext/cards-local";

/* ---- 0. 房间数据体积预算（超 14 KB 不写 → 降级本机 + ERROR） ---- */
function roomByteLen(str) {
  try {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(String(str)).length;
    return unescape(encodeURIComponent(String(str))).length;
  } catch (e) { return String(str).length; }
}
function roomAuditStats(meta, patch) {
  var box = {};
  try {
    if (meta && typeof meta === "object") for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) box[k] = meta[k];
    if (patch && typeof patch === "object") for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) box[k2] = patch[k2];
  } catch (e) { /* 忽略 */ }
  var total = roomByteLen(JSON.stringify(box));
  var ours = 0, other = 0, rows = [];
  for (var key in box) {
    if (!Object.prototype.hasOwnProperty.call(box, key)) continue;
    var n = roomByteLen(JSON.stringify(box[key]));
    if (key.indexOf(NS) === 0) ours += n; else other += n;
    rows.push({ key: key, bytes: n });
  }
  rows.sort(function (x, y) { return y.bytes - x.bytes; });
  var top = rows.slice(0, 5).map(function (r) { return r.key + ":" + r.bytes; }).join(",");
  return { total: total, ours: ours, other: other, top: top, rows: rows };
}
function roomAuditLog(meta, patch) {
  try {
    var st = roomAuditStats(meta || {}, patch || {});
    pageLog("info", "room meta total=" + (st.total / 1024).toFixed(1) + "KB ours=" + (st.ours / 1024).toFixed(1) +
      "KB other=" + (st.other / 1024).toFixed(1) + "KB top=" + st.top);
    return st;
  } catch (e) { return null; }
}
function roomBytesOf(meta, patch) {
  var box = {};
  try {
    if (meta && typeof meta === "object") for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) box[k] = meta[k];
    if (patch && typeof patch === "object") for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) box[k2] = patch[k2];
    return roomByteLen(JSON.stringify(box));
  } catch (e) { return 0; }
}

async function sceneMetaGet() {
  try { return (await OBR.scene.getMetadata()) || {}; } catch (e) { return {}; }
}
function roomQuotaError(e) {
  return /quota|too large|exceed.{0,30}(size|limit)|metadata.{0,30}(size|limit)|16\s*k/i.test(errText(e));
}
/** v2.4.35：整包字节超 15500 或房间 quota 报错 → 写场景 metadata；场景也失败 → 本机兜底（由调用方做）。 */
async function roomWriteGuarded(key, value) {
  var meta = {};
  try { meta = (await OBR.room.getMetadata()) || {}; } catch (e) { meta = {}; }
  var next = {};
  try {
    for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) next[k] = meta[k];
    next[key] = value;
  } catch (eNext) { next = {}; next[key] = value; }
  var bytes = 0;
  try { bytes = new TextEncoder().encode(JSON.stringify(next)).length; } catch (eEnc) { bytes = roomByteLen(JSON.stringify(next)); }
  var st = roomAuditStats(next, {});
  var store = "room";
  var res = { ok: false, reason: "", bytes: bytes, limit: ROOM_WRITE_LIMIT, ours: st.ours, other: st.other, top: st.top, store: "" };
  if (bytes <= ROOM_WRITE_LIMIT) {
    try {
      await OBR.room.setMetadata({ [key]: value });
      res.ok = true; res.store = "room";
      pageLog("info", "room bytes total=" + bytes + " key=" + key + " → room");
      return res;
    } catch (eRoom) {
      if (!roomQuotaError(eRoom)) {
        res.reason = "error"; res.error = eRoom;
        pageLog("err", "room bytes total=" + bytes + " key=" + key + " → room 写入失败：" + errText(eRoom));
        return res;
      }
      pageLog("info", "room bytes total=" + bytes + " key=" + key + " → room 超限，回退 scene");
    }
  } else {
    pageLog("info", "room bytes total=" + bytes + " key=" + key + " → scene（≥" + ROOM_WRITE_LIMIT + "）");
  }
  store = "scene";
  try {
    await OBR.scene.setMetadata({ [key]: value });
    res.ok = true; res.store = "scene"; res.reason = "";
    pageLog("info", "room bytes total=" + bytes + " key=" + key + " → scene");
    return res;
  } catch (eScene) {
    res.reason = "full"; res.error = eScene; res.store = "local";
    pageLog("err", "room bytes total=" + bytes + " key=" + key + " → local（scene 也失败：" + errText(eScene) + "）");
    return res;
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
  "bar-bg": 9500,
  "bar-fill": 9800,
  "def": 15000,
  "def-text": 16000,
  "ac-shield": 15000,
  "ac-text": 16000,
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
/* v2.4.35：玩家右键「加入先攻」→ 请求 GM 代写（房间数据只有 GM 能写）。 */
var CH_INIT_JOIN = NS + "/init-join";
var CH_INIT_JOIN_ACK = NS + "/init-join-ack";
var initJoinLastAt = 0;
var initJoinTimer = null;

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;

/* v2.4.35：紧凑模式 400；右键「速览」的完整模式仍用老的 660，不能挤成一条。 */
var INFO_W_COMPACT = 460; /* v2.4.35：左右各放宽 30，保证所有行单行且左右对齐 */
var INFO_W_FULL = 660;
var INFO_W = 460; /* 兼容旧引用；完整模式用 INFO_W_FULL */
var INFO_H = 700;
var INFO_MIN_W = 360;

var INFO_TOKEN_GAP = 8;
var INFO_VIEW_MARGIN = 16;
var INFO_DRAG_IDLE_MS = 1500;
var INFO_POS_MAX = 40;
var INFO_POS_KEY = "4enext/info-pos";
var CH_INFO_DRAG = NS + "/info-drag";
var CH_INFO_SIZE = NS + "/info-size";
var CH_DICE_ROLL = NS + "/dice-roll";
var CH_DICE_CLEAR = NS + "/dice-clear";
var diceFxOpen = {}; /* rollId -> { id, timer } —— v2.4.35 照 Full Suite：不再排队/计数，每投直接开一个唯一 modal */
var diceFxSeen = {};
var DICE_ROLL_MIN_MS = 800;
var DICE_ROLL_MAX_BYTES = 6144;
var DICE_ROLL_MAX_DICE = 40;
var diceRollLastBy = {};
var DICE_MSG_TOO_FAST = "投掷太快了，请稍等片刻（每 0.8 秒只能投一次）";
var DICE_MSG_TOO_MANY = "骰子太多：一次最多 40 颗，请减少后再投";
var DICE_MSG_TOO_BIG = "本次投掷内容太大（超过 6KB），请减少骰子或缩短备注";
function diceRollRejectReason(d) {
  if (!d || typeof d !== "object") return "invalid";
  if (Array.isArray(d.dice) && d.dice.length > DICE_ROLL_MAX_DICE) return "too-many";
  try { if (JSON.stringify(d).length > DICE_ROLL_MAX_BYTES) return "too-big"; } catch (e) { return "invalid"; }
  if (typeof d.data === "string" && d.data.length > DICE_ROLL_MAX_BYTES) return "too-big";
  return "";
}
function diceRollSenderLocal(ev, d) {
  try {
    var my = OBR.player && typeof OBR.player.getId === "function" ? null : null;
    if (ev && ev.playerId && my) return ev.playerId === my;
    return false;
  } catch (e) { return false; }
}
async function isLocalRollSender(ev, d) {
  try {
    var my = await OBR.player.getId();
    if (ev && ev.playerId) return ev.playerId === my;
    return !!(d && d.rollerId && d.rollerId === my);
  } catch (e) { return false; }
}
function diceRollValid(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  if (typeof d.id !== "string" || !d.id || d.id.length > 120) return false;
  if (typeof d.rollerId !== "string" || d.rollerId.length > 120) return false;
  if (!Array.isArray(d.dice) || d.dice.length < 1 || d.dice.length > DICE_ROLL_MAX_DICE) return false;
  for (var i = 0; i < d.dice.length; i++) {
    var one = d.dice[i];
    if (!one || typeof one.type !== "string" || !/^d\d{1,4}$/i.test(one.type)) return false;
    if (typeof one.value !== "number" || !isFinite(one.value)) return false;
    var sides = parseInt(one.type.slice(1), 10);
    if (!(sides >= 2 && sides <= 1000)) return false;
    if (one.value < 1 || one.value > sides) return false;
  }
  if (typeof d.total !== "number" || !isFinite(d.total)) return false;
  if (d.modifier != null && (typeof d.modifier !== "number" || !isFinite(d.modifier))) return false;
  if (d.anchor != null && (typeof d.anchor !== "object" || !isFinite(d.anchor.x) || !isFinite(d.anchor.y))) return false;
  if (typeof d.data === "string" && d.data.length > DICE_ROLL_MAX_BYTES) return false;
  try { if (JSON.stringify(d).length > DICE_ROLL_MAX_BYTES) return false; } catch (e) { return false; }
  return true;
}

var WIN_MARGIN = 16;
var WIN_DRAG_IDLE_MS = 1500;
var WIN_POS_KEY = "4enext/win-pos";
var CH_WIN_DRAG = NS + "/win-drag";

var CH_DICE_HIST_CMD = NS + "/dice-hist-cmd";
var CH_DICE_HIST_STATE = NS + "/dice-hist-state";

var CH_HP_EDIT_TARGET = NS + "/hp-edit-target";
var CH_HP_EDIT_READY = NS + "/hp-edit-ready";
var CH_HP_EDIT_SAVED = NS + "/hp-edit-saved";
/* v2.4.35：页面切换/载入完成回 ack（单窗换目标确认；600ms 无 ack 兜底重开一次）。 */
var CH_HP_EDIT_ACK = NS + "/hp-edit-ack";
/* v2.4.35：血条编辑窗「重绘」按钮 → 后台强制重算这张 token 的血条环 / 四防盾 / 资源徽记。 */
var CH_HP_REPAINT = NS + "/hp-repaint";
var CH_HPEDIT_LOG = NS + "/hpedit-log";
/* v1.8.9：信息窗单次挂载 —— 目标租约（换 token 只广播 target，不重开 popover）+ ready 握手。 */
var CH_INFO_TARGET = NS + "/info-target";
var CH_INFO_READY = NS + "/info-ready";
/* v1.9.0：页面刷新成功 ack —— 700ms 没收到就兜底关闭重开一次（极端情况下内容也能换过去）。 */
var CH_INFO_ACK = NS + "/info-ack";

var HPE_W = 420;
var HPE_H = 126;

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
var DICE_AUTOSTART_KEY = "4enext/dice-autostart";
var DICE_CLOSED_KEY = "4enext/dice-closed-this-session";

var STRIP_COLLAPSED_KEY = "4enext/strip-collapsed";
var CH_STRIP_DRAG = NS + "/strip-drag";
var CH_STRIP_CMD = NS + "/strip-cmd";

var CH_WIN_CLOSE = NS + "/win-close";
var CH_WIN_RESIZE = NS + "/win-resize";
var WIN_SIZE_PREFIX = "4enext/win-size/";
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
var TOOL_DICE_ICON_URL = pageUrl("icon-tool-dice.svg");
var TOOL_ICON_URL = pageUrl("icon-tool.svg");

var TOOL_INIT_ICON_URL = pageUrl("icon-tool-initiative.svg");

var TOOL_GLANCE_ICON_URL = pageUrl("icon-tool-glance.svg");
var TOOL_SETTINGS_ICON_URL = pageUrl("icon-tool-settings.svg");
var URL_PANEL = pageUrl("panel.html");
var URL_INFO = pageUrl("info.html");

var URL_INITIATIVE = pageUrl("initiative.html");
var URL_DICE = pageUrl("dice.html");
var URL_EFFECT = pageUrl("effect.html");

var URL_DICE_HIST = pageUrl("dice-history.html");

var URL_HP_EDIT = pageUrl("hp-edit.html");

var URL_SETTINGS = pageUrl("settings.html");
var URL_BIND = pageUrl("bind.html");
var URL_BUTTON = pageUrl("button.html");

/* v2.4.35：传送门（核心）。 */
var KEY_PORTAL = NS + "/portal";
var TOOL_PORTAL_ID = NS + "/portal-tool";
var TOOL_PORTAL_MODE_ID = NS + "/portal-mode";
var TOOL_PORTAL_PAIR_MODE_ID = NS + "/portal-pair-mode";
var ID_PORTAL_EDIT = NS + "/portal-edit";
var ID_PORTAL_DEST = NS + "/portal-dest";
var CH_OPEN_SETTINGS = NS + "/open-settings";
var CH_PORTAL_SAVE = NS + "/portal-save";
var CH_PORTAL_EDIT_CLOSE = NS + "/portal-edit-close";
var CH_PORTAL_TELEPORT = NS + "/portal-teleport";
var URL_PORTAL_EDIT = pageUrl("portal-edit.html");
var URL_PORTAL_DEST = pageUrl("portal-dest.html");
var PORTAL_ICON_URL = pageUrl("assets/portal.png") + "?v=" + PLUGIN_VERSION;
var TOOL_PORTAL_ICON_URL = pageUrl("assets/portal.svg");
var PORTAL_MIN_RADIUS = 16;
var PORTAL_WALL_PADDING = 8;
var PORTAL_SUPPRESS_MS = 700;
var PORTAL_EDIT_W = 360;
var PORTAL_EDIT_H = 430;
var PORTAL_DEST_W = 360;
var PORTAL_DEST_H = 380;
var PORTAL_PREVIEW_TAG = NS + "/portal-preview";
var PORTAL_GHOST_TAG = NS + "/portal-ghost";
var PORTAL_PAIR_TAG = NS + "/portal-pair-preview";

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
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  if (e.reason) return e.reason;
  try { return JSON.stringify(e); } catch (e2) { return String(e); }
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

  hpEdit: { id: ID_HP_EDIT, url: URL_HP_EDIT, width: HPE_W, height: HPE_H },

  portalEdit: { id: ID_PORTAL_EDIT, url: URL_PORTAL_EDIT, width: PORTAL_EDIT_W, height: PORTAL_EDIT_H },

  portalDest: { id: ID_PORTAL_DEST, url: URL_PORTAL_DEST, width: PORTAL_DEST_W, height: PORTAL_DEST_H }
};

var winOpen = {};
var winOpenedAt = {};

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
    safeLocalSet(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function clearWinPos(name) {
  if (!name) return;
  try {
    var map = readWinPosMap();
    delete map[name];
    if (!Object.keys(map).length) localStorage.removeItem(WIN_POS_KEY);
    else safeLocalSet(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
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

/** v2.4.35：窗口页 HTML 自身也带缓存，打开 URL 统一补 ?v=<PLUGIN_VERSION>（已有 v= 不重复）。 */
function withWindowVersion(url) {
  var u = String(url || "");
  if (/[?&]v=[^&]*/.test(u)) return u;
  return u + (u.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(PLUGIN_VERSION);
}
function b64urlEncode(str) {
  try {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) { return ""; }
}
function diceFxUrl(payload) {
  var data = b64urlEncode(JSON.stringify(payload));
  return withWindowVersion(URL_EFFECT + "?data=" + encodeURIComponent(data));
}
async function openDiceFx(payload) {
  if (!payload || !payload.id) return false;
  if (diceFxSeen[payload.id]) return false;
  diceFxSeen[payload.id] = Date.now();
  setTimeout(function () { delete diceFxSeen[payload.id]; }, 5000);
  return runDiceFx(payload);
}
/* v2.4.35（照 Full Suite dice/index.ts）：**不排队、不计数**，每次投掷直接开唯一 id 的 modal，
 * 由 effect 页自己关；这里只保留 6s 兜底 close，避免页面异常时留下透明层。
 * 旧实现「队列上限 2 + 3200ms 定时器 + active 计数」在高频投掷时会让动画排队/丢失。 */
async function runDiceFx(payload) {
  var id = NS + "/dice-fx-" + payload.id;
  var url = diceFxUrl(payload);
  try {
    if (!OBR.modal || typeof OBR.modal.open !== "function") return false;
    await OBR.modal.open({ id: id, url: url, fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true });
    diceFxOpen[payload.id] = { id: id, timer: setTimeout(function () {
      try { void OBR.modal.close(id); } catch (e) { /* 忽略 */ }
      delete diceFxOpen[payload.id];
    }, 6000) };
    pageLog("info", "dice fx open roll=" + payload.id + " total=" + payload.total);
    return true;
  } catch (e) {
    pageLog("err", "dice fx open 失败：" + errText(e));
    return false;
  }
}
function closeDiceFx(filter) {
  var f = filter || {};
  for (var rid in diceFxOpen) {
    if (!Object.prototype.hasOwnProperty.call(diceFxOpen, rid)) continue;
    if (f.rollId && rid !== f.rollId) continue;
    var rec = diceFxOpen[rid];
    if (rec.timer) clearTimeout(rec.timer);
    try { void OBR.modal.close(rec.id); } catch (e) { /* 忽略 */ }
    delete diceFxOpen[rid];
  }
}
function readWinSize(name) {
  try {
    var raw = localStorage.getItem(WIN_SIZE_PREFIX + name);
    if (!raw) return null;
    var o = JSON.parse(raw);
    var w = Math.round(Number(o && o.w)), h = Math.round(Number(o && o.h));
    if (w > 0 && h > 0) return { width: w, height: h };
  } catch (e) { /* 忽略 */ }
  return null;
}
function writeWinSize(name, w, h) {
  try { safeLocalSet(WIN_SIZE_PREFIX + name, JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (e) { /* 忽略 */ }
}
async function onWinResize(ev) {
  var d = ev && ev.data ? ev.data : ev;
  if (!d || d.name == null) return;
  var name = String(d.name);
  var st = winOpen[name];
  if (!st) return;
  var def = winDef(name);
  if (!def) return;
  var vp = await infoViewport();
  var minW = name === "diceHistory" ? 300 : 200;
  var minH = name === "diceHistory" ? 200 : 150;
  var maxW = Math.max(minW, Math.round(vp.width * 0.9));
  var maxH = Math.max(minH, Math.round(vp.height * 0.9));
  var w = Math.max(minW, Math.min(maxW, Math.round(Number(d.w) || def.width)));
  var h = Math.max(minH, Math.min(maxH, Math.round(Number(d.h) || def.height)));
  if (name === "hpEdit") {
    /* v2.4.35：血条编辑窗高度固定（内容只有 126px），拉高只会露出黑色空底。 */
    h = HPE_H;
    w = Math.max(400, Math.min(560, w));
  }
  var geom = st.geom || {};
  var left = geom.left != null ? geom.left : 12;
  var top = geom.top != null ? geom.top : 12;
  var pos = clampInfoPos(left, top, { width: w, height: h }, vp);
  try {
    await OBR.popover.open(winPopoverOptions(def, pos, { width: w, height: h }, geom.url || def.url));
  } catch (e) {
    pageLog("err", "win resize 重开失败：" + errText(e));
    return;
  }
  winOpen[name] = { geom: { left: pos.left, top: pos.top, width: w, height: h, url: geom.url || def.url, vp: { width: vp.width, height: vp.height } }, drag: null, timer: null };
  if (name !== "hpEdit") writeWinSize(name, w, h);
  pageLog("info", "win resize name=" + name + " w=" + w + " h=" + h);
}
async function openWin(name, urlOverride) {
  var def = winDef(name);
  if (!def) throw new Error("未知窗口：" + name);
  /* v2.4.35：内存状态可能过期（iframe 已关但 winOpen 还在）。先探测真实 popover。 */
  if (winOpen[name]) {
    var alive = true;
    if (OBR.popover && typeof OBR.popover.getWidth === "function") {
      try { var w = await OBR.popover.getWidth(def.id); alive = typeof w === "number" && w > 0; } catch (eProbe) { alive = false; }
    }
    if (!alive) {
      pageLog("info", "窗口状态过期，清理后重开：" + name);
      delete winOpen[name];
      try { await OBR.popover.close(def.id); } catch (eClr) { /* 忽略 */ }
    }
  }
  var url = withWindowVersion(typeof urlOverride === "string" && urlOverride ? urlOverride : def.url);
  pageLog("info", "openWin name=" + name + " fromWins=" + !!winOpen[name] + " url=" + url);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var mem = readWinSize(name);
  if (name === "hpEdit") {
    /* v2.4.35：血条窗高度固定，历史被拉高的尺寸不再沿用（否则一打开就是大片黑底）。 */
    mem = null;
    try { localStorage.removeItem("4enext/win-size/hpEdit"); } catch (eClr) { /* 忽略 */ }
  }
  if (mem) size = { width: Math.min(mem.width, Math.round(vp.width * 0.9)), height: Math.min(mem.height, Math.round(vp.height * 0.9)) };
  var saved = readWinPos(name);
  var pos = saved ? clampInfoPos(saved.left, saved.top, size, vp) : winDefaultPos(name, size, vp);
  if (!saved && name === "dice") pos = clampInfoPos(12, 96, size, vp);
  pageLog("info", "openWin pos=" + pos.left + "," + pos.top + " size=" + size.width + "x" + size.height + " vp=" + vp.width + "x" + vp.height);
  await OBR.popover.open(winPopoverOptions(def, pos, size, url));
  winOpenedAt[name] = Date.now();
  if (OBR.popover && typeof OBR.popover.getWidth === "function") {
    setTimeout(function () {
      try {
        var pw = OBR.popover.getWidth(def.id);
        if (pw && typeof pw.then === "function") pw.then(function (w) { pageLog("info", "openWin after name=" + name + " width=" + w); }).catch(function () { pageLog("info", "openWin after name=" + name + " width=err"); });
      } catch (eW) { pageLog("info", "openWin after name=" + name + " width=throw"); }
    }, 200);
  }
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
  pageLog("info", "closeWin name=" + name + " source=closeWin");
  var st = winOpen[name];
  if (st && st.timer) { clearTimeout(st.timer); st.timer = null; }
  delete winOpen[name];
  if (name === "portalDest") portalDestOpen = false;
  if (name === "portalEdit") portalEditItemId = "";
  var def = winDef(name);
  if (!def) return;
  try { await OBR.popover.close(def.id); } catch (e) {  }
}

async function closeWinById(name, source) {
  pageLog("info", "closeWinById name=" + name + " source=" + (source || "broadcast") + " winOpen=" + !!winOpen[name]);
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
    if (name === "dice") markDiceClosed(true);
  }
  try { await OBR.popover.close(def.id); } catch (e) {  }
  try { if (OBR.modal && typeof OBR.modal.close === "function") await OBR.modal.close(def.id); } catch (e2) {  }
  pageLog("info", "窗口 ✕（后台兜底）：" + name);
  return true;
}

function onWinClose(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.op !== "close-win" || typeof data.name !== "string") return;
  try {
    pageLog("info", "CH_WIN_CLOSE data=" + JSON.stringify(data) + " from=" +
      (ev && (ev.playerId || ev.connectionId || "?")) + " winOpen=" + Object.keys(winOpen).join(","));
  } catch (eLog) { /* 忽略 */ }
  /* v2.4.35：刚打开 1.5s 内忽略关闭广播（旧 iframe / launcher 收尾误发）；只有页面 ✕ 也在这之后才有效。 */
  var age = winOpenedAt[data.name] ? Date.now() - winOpenedAt[data.name] : Infinity;
  if (age < 1500) {
    pageLog("info", "win close ignore（刚打开）name=" + data.name + " age=" + age);
    return;
  }
  if (winOpenedAt[data.name] && typeof data.at === "number" && data.at < winOpenedAt[data.name]) {
    pageLog("info", "win close ignore（旧广播）name=" + data.name);
    return;
  }
  void closeWinById(data.name, "broadcast");
}

async function resetWin(name) {
  if (!winOpen[name] || !winOpen[name].geom) return;
  var def = winDef(name);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var mem = readWinSize(name);
  if (mem) size = { width: Math.min(mem.width, Math.round(vp.width * 0.9)), height: Math.min(mem.height, Math.round(vp.height * 0.9)) };
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

/* v2.4.35：拖动改用「start 时最新视口 + 本轮 base/size」模型（照 Full Suite panelDrag/panelLayout）。
 * 旧实现用 st.geom.vp（打开窗口时的快照）clamp，视口变大后向下拖会卡在旧下限。 */
async function beginWinDrag(name, st) {
  var vp = await infoViewport();
  if (!(vp.width > 0 && vp.height > 0)) vp = st.geom.vp && st.geom.vp.width > 0 ? st.geom.vp : lastVp;
  var size = { width: st.geom.width, height: st.geom.height };
  var pos = clampInfoPos(st.geom.left, st.geom.top, size, vp);
  st.geom.vp = { width: vp.width, height: vp.height };
  if (pos.left !== st.geom.left || pos.top !== st.geom.top) {
    st.geom.left = pos.left;
    st.geom.top = pos.top;
    try {
      var def = winDef(name);
      if (def) await OBR.popover.open(winPopoverOptions(def, pos, size, st.geom.url));
    } catch (e) {  }
  }
  st.drag = {
    base: { left: st.geom.left, top: st.geom.top },
    vp: { width: vp.width, height: vp.height },
    size: size,
    moved: false
  };
}

async function onWinDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;
  var name = String(data.win == null ? "" : data.win);
  var st = winOpen[name];

  if (!st || !st.geom) return;

  if (data.phase === "reset") {
    clearWinPos(name);
    st.drag = null;
    st._dragReady = null;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    void resetWin(name);
    return;
  }

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !st.drag) {
    st.drag = null;
    /* start 时只 await 一次最新视口（move 帧不再 await，避免卡顿）。 */
    var ready = beginWinDrag(name, st);
    st._dragReady = ready;
    try { await ready; } catch (e0) { st._dragReady = null; }
    st._dragReady = null;
    touchWinDrag(name);
    if (data.phase === "start") return;
    if (!st.drag) return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) st.drag.moved = true;

  if (!st.drag.moved) {
    if (data.phase === "end") endWinDrag(name);
    return;
  }

  var target = clampInfoPos(st.drag.base.left + dx, st.drag.base.top + dy, st.drag.size, st.drag.vp);
  queueWinDrag(name, target);
  touchWinDrag(name);

  if (data.phase === "end") {
    writeWinPos(name, target);
    /* end 时刷新一次视口，供下次拖动 / 后续 clamp 使用。 */
    try {
      var vpEnd = await infoViewport();
      if (vpEnd.width > 0 && vpEnd.height > 0) st.geom.vp = { width: vpEnd.width, height: vpEnd.height };
    } catch (e1) {  }
    endWinDrag(name);
  }
}
async function reclampWins(vpArg) {
  var names = Object.keys(winOpen);
  if (!names.length) return;
  var vp = vpArg && vpArg.width > 0 && vpArg.height > 0 ? vpArg : await infoViewport();
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

/* v2.4.35：单窗常驻的 ack 等待（照 info 的 700ms 模式，这里 600ms）。
 * 页面收到 target → commit 未保存输入 → load → 回 CH_HP_EDIT_ACK {session,version,itemId}。 */
var hpEditAckWait = null;
function waitHpEditAck(session, version, itemId, ms) {
  return new Promise(function (resolve) {
    if (hpEditAckWait) {
      clearTimeout(hpEditAckWait.timer);
      var old = hpEditAckWait.resolve;
      hpEditAckWait = null;
      if (old) old(false);
    }
    var waiter = { session: session, version: version, itemId: itemId, timer: 0, resolve: resolve };
    waiter.timer = setTimeout(function () {
      if (hpEditAckWait !== waiter) return;
      hpEditAckWait = null;
      resolve(false);
    }, ms);
    hpEditAckWait = waiter;
  });
}
function onHpEditAck(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var waiter = hpEditAckWait;
  if (!waiter) return;
  if (!data || data.session !== waiter.session || data.itemId !== waiter.itemId) return;
  if (typeof data.version !== "number" || data.version < waiter.version) return;
  clearTimeout(waiter.timer);
  hpEditAckWait = null;
  waiter.resolve(true);
}

async function openHpEdit(itemId) {
  if (!itemId) {
    notify("没有读到要编辑的 token，右键请对着一个图片 token 再试", "WARNING");
    return false;
  }
  hpAutoPopped[itemId] = true;
  if (winOpen["hpEdit"] && hpEditTarget.itemId === itemId && !hpEditTarget.pending) return true;
  if (!hpEditSession) hpEditSession = newHpEditSession();
  /* v2.4.35：窗口已挂载 → 不重开 iframe；广播 target 换目标，等页面 ack；600ms 没 ack 兜底重开一次。 */
  if (winOpen["hpEdit"]) {
    var expectVersion = hpEditTarget.version + 1;
    var ackP = waitHpEditAck(hpEditSession, expectVersion, itemId, 600);
    await publishHpEditTarget(itemId, true);
    var acked = await ackP;
    if (acked) {
      await publishHpEditTarget(itemId, false);
      pageLog("info", "血条编辑窗：切换目标（单窗常驻，不重开）→ " + itemId);
      return true;
    }
    pageLog("warn", "血条编辑窗切换目标 600ms 无 ack → 兜底关闭重开一次");
    try { await closeWin("hpEdit"); } catch (e0) { pageLog("err", "血条编辑窗兜底关闭失败：" + errText(e0)); }
  }
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

/* v2.4.35：编辑窗「钉住」偏好（默认关）——钉住后选中变化 / 取消选中不自动关窗。 */
function hpEditPinned() {
  try { return localStorage.getItem("4enext/hp-edit/pinned") === "1"; } catch (e) { return false; }
}

/* v2.4.35：编辑窗「重绘」→ 丢掉这张 token 的血条缓存，下一次 scheduleBars 强制重建（环 / 盾 / 徽记）。 */
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
    safeLocalSet(STRIP_POS_KEY, JSON.stringify({ v: 1, dx: Math.round(dx), dy: Math.round(dy) }));
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
    if (on) safeLocalSet(STRIP_CLOSED_KEY, "1");
    else localStorage.removeItem(STRIP_CLOSED_KEY);
  } catch (e) {  }
}

function diceAutostartOn() {
  try { return localStorage.getItem(DICE_AUTOSTART_KEY) !== "0"; } catch (e) { return true; }
}
function diceClosedThisSession() {
  try { return localStorage.getItem(DICE_CLOSED_KEY) === "1"; } catch (e) { return false; }
}
function markDiceClosed(on) {
  try {
    if (on) safeLocalSet(DICE_CLOSED_KEY, "1");
    else localStorage.removeItem(DICE_CLOSED_KEY);
  } catch (e) { /* 忽略 */ }
}
async function maybeAutoOpenDice(where) {
  if (winOpen["dice"]) return false;
  if (!diceAutostartOn()) { pageLog("info", "进入房间自动打开骰子：跳过（设置关）"); return false; }
  if (diceClosedThisSession()) { pageLog("info", "进入房间自动打开骰子：跳过（用户关闭过）"); return false; }
  if (!(await sceneReady())) return false;
  var ok = await openWinOrNotify("dice", where || "进入房间自动打开骰子");
  pageLog("info", "进入房间自动打开骰子：" + (ok ? "已打开" : "未打开"));
  return ok;
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
    if (on) safeLocalSet(DICE_HIST_CLOSED_KEY, "1");
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

async function reclampStrip(vpArg) {
  if (!stripOpen || !stripGeom) return;
  var vp = vpArg && vpArg.width > 0 && vpArg.height > 0 ? vpArg : await infoViewport();
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

/* v2.4.35：移植 Full Suite viewportAnchor —— OBR SDK **没有 viewport.onChange**，
 * 所以用后台 500ms 轮询 getWidth/getHeight；变化时回调（按钮重锚 + 窗口 reclamp）。
 * 只在有监听者时跑；读失败退避 2s；首读只记 baseline 不触发。 */
var vpAnchorTimer = null;
var vpAnchorListeners = [];
var vpAnchorVw = 0;
var vpAnchorVh = 0;
var vpAnchorBusy = false;
var vpAnchorFailUntil = 0;

async function readViewportSize() {
  if (!OBR.viewport || typeof OBR.viewport.getWidth !== "function" || typeof OBR.viewport.getHeight !== "function") return null;
  try {
    var arr = await Promise.allSettled([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    if (!arr[0] || arr[0].status !== "fulfilled" || !arr[1] || arr[1].status !== "fulfilled") return null;
    var w = arr[0].value, h = arr[1].value;
    if (!(typeof w === "number" && w > 0 && typeof h === "number" && h > 0)) return null;
    return { width: w, height: h };
  } catch (e) {
    return null;
  }
}

async function pollViewportAnchor() {
  if (typeof document !== "undefined" && document.hidden) return false; /* v2.4.35：后台标签页跳过 */
  if (vpAnchorBusy) return false;
  if (!vpAnchorListeners.length) {
    if (vpAnchorTimer) { clearInterval(vpAnchorTimer); vpAnchorTimer = null; }
    return false;
  }
  if (Date.now() < vpAnchorFailUntil) return false;
  vpAnchorBusy = true;
  try {
    var vp = await readViewportSize();
    if (!vp) { vpAnchorFailUntil = Date.now() + 2000; return false; }
    lastVp = { width: vp.width, height: vp.height };
    if (!(vpAnchorVw > 0 && vpAnchorVh > 0)) {
      vpAnchorVw = vp.width;
      vpAnchorVh = vp.height;
      return false;
    }
    if (vp.width === vpAnchorVw && vp.height === vpAnchorVh) return false;
    vpAnchorVw = vp.width;
    vpAnchorVh = vp.height;
    pageLog("info", "viewport " + vp.width + "×" + vp.height + " → 重锚按钮/窗口");
    for (var i = 0; i < vpAnchorListeners.length; i++) {
      try { await vpAnchorListeners[i](vp); } catch (e) { /* 单个监听者失败不影响其它 */ }
    }
    return true;
  } finally {
    vpAnchorBusy = false;
  }
}

function installViewportAnchor() {
  if (!vpAnchorTimer) {
    vpAnchorTimer = setInterval(function () { void pollViewportAnchor(); }, 500);
  }
  /* 后台 iframe 能拿到 window.resize / visualViewport.resize 的话再加一层即时触发（拿不到忽略）。 */
  try {
    if (typeof window !== "undefined" && typeof window.addEventListener === "function" && !window.__4eVpResizeBound) {
      window.__4eVpResizeBound = true;
      window.addEventListener("resize", function () { void pollViewportAnchor(); });
    }
    if (typeof window !== "undefined" && window.visualViewport && typeof window.visualViewport.addEventListener === "function" && !window.__4eVpVvBound) {
      window.__4eVpVvBound = true;
      window.visualViewport.addEventListener("resize", function () { void pollViewportAnchor(); });
    }
  } catch (e) { /* 忽略 */ }
}

function stopViewportAnchor() {
  if (vpAnchorTimer) { clearInterval(vpAnchorTimer); vpAnchorTimer = null; }
}

function addViewportAnchorListener(cb) {
  if (typeof cb !== "function") return function () {};
  vpAnchorListeners.push(cb);
  installViewportAnchor();
  return function () {
    var i = vpAnchorListeners.indexOf(cb);
    if (i >= 0) vpAnchorListeners.splice(i, 1);
    if (!vpAnchorListeners.length && vpAnchorTimer) {
      clearInterval(vpAnchorTimer);
      vpAnchorTimer = null;
    }
  };
}

/** 按给定视口把右下角 4E 浮动按钮重新 open 到右下角（同 id+同 url，OBR 原地更新）。 */
async function reanchorButton(vpArg) {
  if (!buttonOpen) return false;
  var w = vpArg && vpArg.width > 0 ? vpArg.width : 0;
  var h = vpArg && vpArg.height > 0 ? vpArg.height : 0;
  if (!(w > 0 && h > 0)) {
    var vp = await infoViewport();
    w = vp.width;
    h = vp.height;
  }
  if (!(w > 0 && h > 0)) return false;
  try {
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
    pageLog("info", "按钮重定位 " + w + "×" + h + " → " + (w - RIGHT_OFFSET) + "," + (h - BOTTOM_OFFSET));
    return true;
  } catch (e) {
    pageLog("err", "按钮重定位失败：" + errText(e));
    return false;
  }
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
  /* v2.4.35：传送门工具（GM 拖动画圆；玩家点工具给提示，不进入绘制模式）。 */
  await registerPortalTool();
  /* v2.4.35：骰子工具按钮 → 普通可拖动窗口（替代已删除的 manifest action / launcher）。 */
  await registerOneTool({
    id: TOOL_DICE_ID,
    icons: [{ icon: TOOL_DICE_ICON_URL, label: "4eNEXT to owlbear：骰子" }],
    onClick: async function () {
      await openWinOrNotify("dice", "骰子");
      return true;
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

function initMenuFilter(mode, gmOnly) {
  var filter = { every: [{ key: "type", value: "IMAGE" }], max: 1 };
  if (gmOnly !== false) filter.roles = ["GM"];
  if (mode === "in") filter.every.push({ key: ["metadata", KEY_IN_INIT], value: true });
  else filter.every.push({ key: ["metadata", KEY_IN_INIT], operator: "!=", value: true });
  return filter;
}

async function registerInitMenus() {
  await createContextMenu({
    id: INIT_MENU_ADD,
    icons: [{ icon: ICON_URL, label: "加入先攻", filter: initMenuFilter("out", false) }],
    onClick: function (context) { return onInitMenuClick(context, false); }
  });
  await createContextMenu({
    id: INIT_MENU_ADD_HIDDEN,
    icons: [{ icon: ICON_URL, label: "隐形加入先攻", filter: initMenuFilter("out", true) }],
    onClick: function (context) { return onInitMenuClick(context, true); }
  });
  await createContextMenu({
    id: INIT_MENU_REMOVE,
    icons: [{ icon: ICON_URL, label: "移出先攻", filter: initMenuFilter("in", true) }],
    onClick: function (context) { return onInitRemoveClick(context); }
  });
}

async function initWantIds(ids) {
  var want = {};
  /* v2.4.35：房间先攻 entries 是唯一真源；忽略调用方传入的临时 ids，避免"房间没写进去却打了标记"。 */
  var state = await initRead();
  var list = initEntryIdsOf(state);
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

  /* v2.4.35：速览右键入口（GM / 玩家都可；单枚 IMAGE）。 */
  await createContextMenu({
    id: NS + "/glance-menu",
    icons: [{
      icon: TOOL_GLANCE_ICON_URL,
      label: "速览",
      filter: { max: 1, every: [{ key: "type", value: "IMAGE" }] }
    }],
    onClick: function () { void openGlance("右键「速览」"); }
  });

  /* v2.4.35：GM 右键 → 编辑传送门。filter 不能按 metadata 值相等（值对象，永远不匹配），
   * 只在 onClick 里检查 metadata[KEY_PORTAL]；正常路径还有「GM 选中单枚门自动弹编辑窗」。 */
  await createContextMenu({
    id: NS + "/portal-edit",
    icons: [{
      icon: PORTAL_ICON_URL,
      label: "编辑传送门",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }]
      }
    }],
    onClick: function (context) {
      var it = context && context.items && context.items[0] ? context.items[0] : null;
      var isPortal = !!(it && it.metadata && it.metadata[KEY_PORTAL]);
      pageLog("info", "右键编辑 role=GM 是否门=" + (isPortal ? "是" : "否"));
      if (!isPortal) { notify("这枚不是传送门", "WARNING"); return; }
      return openPortalEdit(it.id);
    }
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
var infoMode = "compact"; /* v2.4.35：compact=点token自动弹；full=右键/工具栏速览 */
var infoAckRetries = 0;
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
      /* v2.4.35：最多兜底重开 2 次，避免页面加载失败时无限开关把宿主拖到卡死。 */
      if (infoAckRetries >= 2) {
        pageLog("err", "速览 target 连续 " + infoAckRetries + " 次无 ack，已停止兜底重开（页面可能加载失败）");
        return;
      }
      infoAckRetries++;
      /* 只记日志不弹通知：极端情况下页面没刷新，主动关掉重开一次保证内容换过去。 */
      pageLog("err", "速览 target v=" + pend.version + " 700ms 无 ack → 兜底关闭重开一次");
      void (async function () {
        try {
          await closeInfo();
          await new Promise(function (r) { setTimeout(r, 80); });
          await openInfo(pend.itemId, pend.cardId, pend.mode);
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

var infoReadyTimer = null;
function clearInfoReadyWatchdog() {
  if (infoReadyTimer) { clearTimeout(infoReadyTimer); infoReadyTimer = null; }
}
function armInfoReadyWatchdog() {
  clearInfoReadyWatchdog();
  infoReadyTimer = setTimeout(function () {
    infoReadyTimer = null;
    if (!infoOpen) return;
    pageLog("err", "速览页 5s 未 ready（加载失败 / 脚本报错），关闭窗口");
    try { notify("速览页加载失败（超时），已关闭，请重试", "ERROR"); } catch (eN) { /* 忽略 */ }
    void closeInfo();
  }, 5000);
}
function onInfoReady(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var session = data && typeof data.session === "string" ? data.session : "";
  if (session && infoSession && session !== infoSession) return;
  if (!infoSession) return;
  clearInfoReadyWatchdog();
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

/* v2.4.35：最近一次成功读到的视口尺寸（轮询 / infoViewport 都更新），供拖动 start / clamp 参考。 */
var lastVp = { width: 0, height: 0 };
async function infoViewport() {
  var vp = { width: 0, height: 0 };
  try { vp.width = await OBR.viewport.getWidth(); } catch (e) { vp.width = 0; }
  try { vp.height = await OBR.viewport.getHeight(); } catch (e) { vp.height = 0; }
  if (vp.width > 0 && vp.height > 0) {
    lastVp = { width: vp.width, height: vp.height };
  } else if (lastVp && lastVp.width > 0 && lastVp.height > 0) {
    vp = { width: lastVp.width, height: lastVp.height };
    pageLog("info", "viewport 读数为 0，使用上次视口 " + vp.width + "x" + vp.height);
  } else {
    vp = { width: 1280, height: 720 };
    pageLog("info", "viewport 读数为 0，使用兜底视口 1280x720");
  }
  return vp;
}

/* ---- 6. 速览弹窗 /info：尺寸 / 位置记忆 / 拖动 ---- */
function infoSize(vp, mode) {
  var wantW = mode === "full" ? INFO_W_FULL : INFO_W_COMPACT;
  /* v2.4.35：初始高度只给骨架大小（compact 200 / full 420），页面渲染后自己 setHeight 长高；
   * 以前一上来 700，页面若加载慢/失败就是一大片「加载中…」空窗。 */
  var initH = mode === "full" ? 420 : 200;
  var availH = (vp.height || 760) - 40;
  return {
    width: Math.max(INFO_MIN_W, Math.min(wantW, (vp.width || wantW + 40) - 32)),
    height: Math.max(160, Math.min(initH, availH, INFO_H))
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
    safeLocalSet(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function clearInfoPos(itemId) {
  if (!itemId) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    if (!Object.keys(map).length) localStorage.removeItem(INFO_POS_KEY);
    else safeLocalSet(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
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
  armInfoReadyWatchdog();
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

var INFO_MODE_AUTO = "compact";
/* v2.4.35：页面自动收高后同步给后台，拖动/重开用真实高度，否则会弹回 700 空窗。 */
function onInfoSize(ev) {
  var d = ev && ev.data !== undefined ? ev.data : ev;
  if (!d || !infoGeom) return;
  var h = Math.round(Number(d.height));
  if (isFinite(h) && h >= 200 && h <= 760) infoGeom.height = h;
  var w = Math.round(Number(d.width));
  if (isFinite(w) && w >= INFO_MIN_W && w <= 700) infoGeom.width = w;
}

async function openInfo(itemId, cardId, mode) {
  var wantMode = mode === "full" ? "full" : INFO_MODE_AUTO;
  /* v2.4.35 bugfix：复用单窗时必须确认**模式一致**。旧代码直接复用紧凑窗当完整窗用，
   * 右键「速览」会把完整界面挤进 400px；反过来完整窗开着时点 token 也不会回到紧凑。 */
  if (infoOpen && infoMode !== wantMode) {
    await closeInfo();
    await new Promise(function (r) { setTimeout(r, 80); });
  }
  infoMode = wantMode;
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
  var size = infoSize(vp, infoMode);
  var pos = await infoAutoPos(itemId, size, vp);
  if (!infoSession) infoSession = newInfoSession();

  var url = URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION) +
    "&item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId) +
    "&session=" + encodeURIComponent(infoSession) +
    "&mode=" + encodeURIComponent(infoMode);
  infoAckRetries = 0;
  await showInfoAt(pos, size, url, itemId, cardId, vp);
  /* 首次挂载后广播 target：页面若在 iframe 加载完成前就 READY，onInfoReady 会补发。 */
  await publishInfoTarget(itemId, cardId);
}

async function closeInfo() {
  clearInfoReadyWatchdog();
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
  /* v2.4.35 bugfix：重锚必须用**当前窗口真实尺寸**（紧凑 400 或完整 660、以及自动收高后的高度），
   * 旧代码用 infoSize(vp) 默认 compact+700，点了「回到 token 上方」会弹回大空窗。 */
  var size = infoGeom
    ? { width: infoGeom.width, height: infoGeom.height }
    : infoSize(vp, infoMode);
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
    /* v2.4.35：已经是「完整模式 + 同一枚 token」→ 直接复用，不再关掉重开（省一次 iframe 加载）。 */
    if (infoOpen && infoMode === "full" && infoItemId === bind.itemId && infoCardId === bind.cardId) {
      stepOk(label + "：完整速览已打开（复用）");
      return true;
    }
    /* 右键「速览」= 以前的完整界面；点 token 自动弹的才是紧凑版。 */
    if (infoOpen) {
      await closeInfo();
      await new Promise(function (r) { setTimeout(r, 80); });
    }
    await openInfo(bind.itemId, bind.cardId, "full");
    stepOk(label + "：已打开完整速览（token " + bind.itemId + "）");
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
    /* v2.4.35：点地图 / 取消选中 → 速览保持当前内容，不关窗；只关自动打开的血条编辑窗（钉住则保留）。 */
    if (winOpen["hpEdit"] && !hpEditPinned()) await closeWin("hpEdit");
    if (infoOpen) pageLog("info", "info keep（取消选中）");
    return;
  }
  /* v1.8.2：先攻条点卡片头像（页面先发 CH_GLANCE_SUPPRESS 再 select）→ 1.5 秒内不自动弹速览。
   * token 仍然被选中 / 地图高亮，只是不弹；不碰下面 hpAutoSel / hpAutoPopped / hasHpBarData 顺序。 */
  if (Date.now() < suppressGlanceUntil) return;

  var cardId = await boundCardId(item);
  if (cardId) {
    /* v2.4.35：选了绑定卡的 token → 速览接管；未钉住时关掉血条编辑窗（钉住则保持当前 token）。 */
    if (winOpen["hpEdit"] && !hpEditPinned() && hpEditTarget.itemId !== item.id) {
      await closeWin("hpEdit");
    }
    /* v1.8.5：用户手动 ✕ 关过这枚 token 的速览 → 选中不变之前不再自动弹回（先于「已开则返回」判断）。 */
    if (infoAutoPopped[item.id]) return;
    if (infoOpen && infoItemId === item.id && infoCardId === cardId) return;
    if (infoOpen) pageLog("info", "info switch target=" + item.id);
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

  /* v2.4.35：选中非绑卡 token / 多选 → 速览保持当前内容，不关闭。 */
  if (infoOpen) pageLog("info", "info keep（选中无卡）");
  /* v2.4.35：非 GM 不再自动弹血条编辑窗；locked/hide 对非 GM 一律不弹。 */
  var hpRole = "";
  var hpPid = "";
  try { hpRole = await OBR.player.getRole(); } catch (eRole) { hpRole = ""; }
  try { hpPid = await OBR.player.getId(); } catch (ePid) { hpPid = ""; }
  var hpMetaNow = item.metadata ? item.metadata[KEY_HP] : null;
  var hpLockedNow = !hpMetaNow || hpMetaNow.locked !== false;
  var hpHiddenNow = !!(hpMetaNow && hpMetaNow.hide === true);
  var isOwnerNow = !!(hpPid && item.createdUserId === hpPid);
  if (hpRole !== "GM" && (hpLockedNow || hpHiddenNow)) {
    if (winOpen["hpEdit"] && hpEditTarget.itemId === item.id) {
      try { await closeWin("hpEdit"); } catch (eClose) { /* 忽略 */ }
      try { notify("这枚 token 的血条已隐藏", "WARNING"); } catch (eNote) { /* 忽略 */ }
    }
    pageLog("info", "hpEdit skip（非GM/锁定/隐藏）token=" + item.id + " locked=" + hpLockedNow + " hide=" + hpHiddenNow);
    return;
  }
  if (hpRole !== "GM" && !isOwnerNow) {
    pageLog("info", "hpEdit skip（非GM/非owner）token=" + item.id);
    return;
  }
  /* v2.4.35：钉住时保持当前编辑的 token，不换 target。 */
  if (hpEditPinned() && winOpen["hpEdit"]) return;
  if (!hasHpBarData(item)) {
    if (winOpen["hpEdit"] && hpEditTarget.itemId !== item.id) await closeWin("hpEdit");
    return;
  }
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
    hide: m.hide === true,
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

/* v2.4.35：用户样板布局 —— 底部比例横条 + 左侧三圆（强/反/意）+ 右下 AC 盾，不再用环形。
 * 坐标全部相对 token 包围盒（宽 64%、高 10% 短边），s = min(w,h)/dpi 沿用旧缩放。 */

/** 圆角矩形多边形（以中心为原点，24 段近似；血条 / 填充都用它）。 */
function roundedRectPoints(W, H, R, segments) {
  var w = Math.max(0, W), h = Math.max(0, H);
  var r = Math.max(0, Math.min(R, Math.min(w, h) / 2));
  var perArc = Math.max(2, Math.round((segments || 24) / 4));
  var x0 = -w / 2, y0 = -h / 2;
  var pts = [];
  function arc(cx, cy, a0, a1) {
    for (var i = 0; i <= perArc; i++) {
      var a = a0 + (a1 - a0) * (i / perArc);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }
  arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  arc(x0 + w - r, y0 + r, -Math.PI / 2, 0);
  arc(x0 + w - r, y0 + h - r, 0, Math.PI / 2);
  arc(x0 + r, y0 + h - r, Math.PI / 2, Math.PI);
  return pts;
}

/* 四防颜色（样板）：强韧粉 / 反射黄 / 意志蓝；AC 盾深灰蓝。 */
var BAR_DEF_COLORS = { fort: "#f0a5ab", reflex: "#f5e884", will: "#8e9dd6" };
var BAR_DEF_ORDER = ["fort", "reflex", "will"];

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

function quantiseBarRatio(cur, max) {
  var r = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
  if (r <= 0) return 0;
  return Math.min(1, Math.ceil(r / 0.25) * 0.25);
}
function barLayout(bounds, dpi, hp, viewer) {
  var max = hp.max > 0 ? hp.max : (hp.cur !== null ? Math.max(1, hp.cur) : 1);
  var cur = hp.cur === null ? max : hp.cur;
  var ratio = Math.max(0, Math.min(1, cur / max));
  var bloodied = max > 0 ? cur <= max / 2 : false;
  var s = Math.min(bounds.width, bounds.height) / dpi;
  if (!isFinite(s) || s <= 0) s = 1;
  s = Math.max(0.2, Math.min(6, s));

  var exact = !viewer || viewer.exact !== false;
  var threshold = viewer && typeof viewer.threshold === "number" ? viewer.threshold : PLAYER_THRESHOLD_DEFAULT;
  var shownRatio = exact ? ratio : quantiseRatio(ratio, threshold);
  var short = Math.min(bounds.width, bounds.height);

  /* 底部血条：宽 64% token 宽、高 10% 短边、底边距 4% 短边、圆角 = 高/2。 */
  var barW = Math.max(4 * s, bounds.width * 0.64);
  var barH = Math.max(2 * s, short * 0.10);
  var gap = short * 0.04;
  var barCx = bounds.center.x;
  var barCy = bounds.max.y - gap - barH / 2;
  var bar = {
    cx: barCx, cy: barCy, left: barCx - barW / 2, top: barCy - barH / 2,
    width: barW, height: barH, radius: Math.min(barH / 2, barW / 2),
    ratio: shownRatio, fillW: Math.max(0, barW * shownRatio),
    color: bloodied ? COLOR_HP_BLOODIED : "#b00000",
    track: "#3a1414", trackOpacity: 0.8
  };

  /* 条内文字：精确时 cur/max（+temp 后缀）；按条宽 / 条高自适应，装不下就隐藏。 */
  var hpText = exact ? (String(cur) + "/" + max + (hp.temp > 0 ? " +" + hp.temp : "")) : "";
  var hpFont = 0, hpTextW = 0, hpTextH = 0, hpTextFits = false;
  if (hpText) {
    var tryFont = Math.max(3 * s, Math.min(barH * 0.78, 14 * s));
    var fontFloor = 3 * s;
    for (var fitTry = 0; fitTry < 48; fitTry++) {
      var needW = Math.max(4 * s, hpText.length * tryFont * 0.62);
      var needH = Math.max(3 * s, tryFont * 1.2);
      if (needW <= barW * 0.92 && needH <= barH * 0.98) {
        hpFont = tryFont; hpTextW = needW; hpTextH = needH; hpTextFits = true;
        break;
      }
      if (!(tryFont > fontFloor)) break;
      tryFont = Math.max(fontFloor, tryFont * 0.9);
    }
  }
  if (!hpTextFits) { hpText = ""; hpFont = 0; hpTextW = 0; hpTextH = 0; }
  var barText = {
    text: hpText, font: hpFont, width: hpTextW, height: hpTextH,
    x: barCx - hpTextW / 2, y: barCy - hpTextH / 2,
    fits: hpTextFits, visible: exact && hpTextFits && !!hpText
  };

  /* 左侧竖排三圆：直径 16% 短边、左边距 6%、间距 4%，从血条上方往上排（上 → 下 = 强/反/意）。 */
  var dDef = short * 0.16;
  var defMargin = short * 0.06;
  var defGap = short * 0.04;
  var defX = bounds.min.x + defMargin + dDef / 2;
  var yBottom = barCy - barH / 2 - gap - dDef / 2;
  var defs = [];
  var present = [];
  if (hp.defenses) {
    for (var di = 0; di < BAR_DEF_ORDER.length; di++) {
      var dk = BAR_DEF_ORDER[di];
      if (typeof hp.defenses[dk] === "number") present.push(dk);
    }
  }
  for (var dj = present.length - 1; dj >= 0; dj--) {
    var key = present[dj];
    var val = hp.defenses[key];
    var txt = String(val);
    defs.unshift({
      key: key, value: val, text: txt, d: dDef, x: defX, y: yBottom,
      color: BAR_DEF_COLORS[key],
      fontSize: Math.max(8 * s, dDef * (txt.length > 2 ? 0.42 : 0.5))
    });
    yBottom -= dDef + defGap;
  }
  /* 玩家（非精确）沿用旧 viewer 逻辑：不画四防图形、不显示数字。 */
  var showDefenses = exact && defs.length > 0;

  /* 右下角 AC 盾：宽 20% 短边、高按盾形比例 1.08，右下内缩 4%，白描边。 */
  var shield = null;
  if (exact && hp.defenses && typeof hp.defenses.ac === "number") {
    var sw = short * 0.20;
    var sh = sw * 1.08;
    var inset = short * 0.04;
    var acTxt = String(hp.defenses.ac);
    shield = {
      key: "ac", value: hp.defenses.ac, text: acTxt, w: sw, h: sh,
      cx: bounds.max.x - inset - sw / 2,
      cy: bounds.max.y - inset - sh / 2,
      strokeWidth: Math.max(1, 1.5 * s),
      fontSize: Math.max(8 * s, sw * (acTxt.length > 2 ? 0.42 : 0.5))
    };
  }

  return {
    scale: s, exact: exact,
    ratio: shownRatio, rawRatio: ratio,
    bloodied: bloodied,
    bar: bar, barText: barText,
    textVisible: barText.visible,
    hpText: hpText, hpFont: hpFont, hpTextW: hpTextW, hpTextH: hpTextH,
    hpTextX: barText.x, hpTextY: barText.y, hpTextFits: hpTextFits,
    colorFill: bar.color,
    showDefenses: showDefenses, defs: showDefenses ? defs : [],
    shield: shield,
    d: dDef, dDef: dDef, gap: gap
  };
}

function barRolesKey(L) {
  var defs = L.defs && L.defs.length ? "D" + L.defs.map(function (x) { return x.key; }).join("") : "";
  return defs + (L.shield ? "A" : "") + (L.textVisible ? "T" : "");
}

function barSig(hp, L) {
  var d = hp.defenses;
  var b = L.bar || {};
  return [
    hp.cur, hp.max, hp.temp,
    d ? [d.ac, d.fort, d.reflex, d.will].join(",") : "",
    hp.locked ? 1 : 0, L.exact ? 1 : 0,
    Math.round(b.width * 10), Math.round(b.height * 10),
    Math.round(L.ratio * 1000),
    Math.round(L.scale * 1000),
    L.defs ? L.defs.length : 0,
    L.shield ? 1 : 0
  ].join("|");
}
function barMeta(tokenId, role, extra) {
  var box = {};
  var tag = { owner: tokenId, role: role };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) tag[k] = extra[k];
  box[BAR_TAG] = tag;
  return box;
}
function findDef(L, key) {
  for (var i = 0; i < L.defs.length; i++) if (L.defs[i].key === key) return L.defs[i];
  return null;
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
  var bar = L.bar;
  var i;

  /* v2.4.35 底部圆角横条：深红轨道 + 按 cur/max 比例的左→右填充。 */
  items.push(barCurveItem(tokenId, "bar-bg",
    roundedRectPoints(bar.width, bar.height, bar.radius, 24), bar.cx, bar.cy,
    { fill: bar.track, fillOpacity: bar.trackOpacity }));
  items.push(barCurveItem(tokenId, "bar-fill",
    roundedRectPoints(bar.fillW, bar.height, Math.min(bar.radius, bar.fillW / 2), 16),
    bar.left + bar.fillW / 2, bar.cy,
    { fill: L.colorFill, fillOpacity: 0.95, visible: bar.ratio > 0 }));
  items.push(barTextItem(tokenId, "bar-text", L.barText.text, L.barText.font, "#ffffff",
    L.barText.x, L.barText.y, L.barText.width, L.barText.height,
    { strokeWidth: Math.max(0.4, L.barText.font * 0.09), visible: L.textVisible }));

  /* 左侧三圆：强韧 / 反射 / 意志。 */
  for (i = 0; i < L.defs.length; i++) {
    var cd = L.defs[i];
    items.push(barCurveItem(tokenId, "def", circlePoints(cd.d, DEF_CIRCLE_SEGMENTS),
      cd.x - cd.d / 2, cd.y - cd.d / 2,
      {
        fill: cd.color, fillOpacity: 1, stroke: "#1c2330", strokeOpacity: 1,
        strokeWidth: Math.max(0.8, cd.d * 0.035), extra: { key: cd.key }
      }));
    items.push(barTextItem(tokenId, "def-text", cd.text, cd.fontSize, "#ffffff",
      cd.x - cd.d / 2, cd.y - cd.d / 2, cd.d, cd.d,
      { strokeWidth: Math.max(0.4, cd.d * 0.02), extra: { key: cd.key } }));
  }

  /* 右下角 AC 盾。 */
  if (L.shield) {
    var sh = L.shield;
    items.push(barCurveItem(tokenId, "ac-shield",
      shieldPoints(sh.w, sh.h, 14), sh.cx - sh.w / 2, sh.cy - sh.h / 2,
      {
        fill: "#393e50", fillOpacity: 1, stroke: "#ffffff", strokeOpacity: 1,
        strokeWidth: sh.strokeWidth, extra: { key: "ac" }
      }));
    items.push(barTextItem(tokenId, "ac-text", sh.text, sh.fontSize, "#ffffff",
      sh.cx - sh.w / 2, sh.cy - sh.h / 2, sh.w, sh.h,
      { strokeWidth: Math.max(0.4, sh.w * 0.02), extra: { key: "ac" } }));
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
  var bar = L.bar;
  await OBR.scene.local.updateItems(entry.ids, function (drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var tag = d.metadata && d.metadata[BAR_TAG] ? d.metadata[BAR_TAG] : null;
      var role = tag && tag.role ? tag.role : "";
      switch (role) {
        case "bar-bg":
          d.position = { x: bar.cx, y: bar.cy };
          d.points = roundedRectPoints(bar.width, bar.height, bar.radius, 24);
          d.visible = true;
          break;
        case "bar-fill":
          d.position = { x: bar.left + bar.fillW / 2, y: bar.cy };
          d.points = roundedRectPoints(bar.fillW, bar.height, Math.min(bar.radius, bar.fillW / 2), 16);
          if (d.style) d.style.fillColor = L.colorFill;
          d.visible = bar.ratio > 0;
          break;
        case "bar-text":
          if (!d.text) break;
          d.text.plainText = L.barText.text;
          d.text.style.fontSize = L.barText.font;
          d.text.width = L.barText.width;
          d.text.height = L.barText.height;
          d.position = { x: L.barText.x, y: L.barText.y };
          d.visible = L.textVisible;
          break;
        case "def": {
          var cd = findDef(L, tag.key);
          if (!cd) { d.visible = false; break; }
          d.points = circlePoints(cd.d, DEF_CIRCLE_SEGMENTS);
          d.position = { x: cd.x - cd.d / 2, y: cd.y - cd.d / 2 };
          d.visible = true;
          break;
        }
        case "def-text": {
          var cdt = findDef(L, tag.key);
          if (!cdt || !d.text) { d.visible = false; break; }
          d.text.plainText = cdt.text;
          d.text.style.fontSize = cdt.fontSize;
          d.text.width = cdt.d;
          d.text.height = cdt.d;
          d.position = { x: cdt.x - cdt.d / 2, y: cdt.y - cdt.d / 2 };
          d.visible = true;
          break;
        }
        case "ac-shield": {
          var sh = L.shield;
          if (!sh) { d.visible = false; break; }
          d.points = shieldPoints(sh.w, sh.h, 14);
          d.position = { x: sh.cx - sh.w / 2, y: sh.cy - sh.h / 2 };
          d.visible = true;
          break;
        }
        case "ac-text": {
          var sht = L.shield;
          if (!sht || !d.text) { d.visible = false; break; }
          d.text.plainText = sht.text;
          d.text.style.fontSize = sht.fontSize;
          d.text.width = sht.w;
          d.text.height = sht.h;
          d.position = { x: sht.cx - sht.w / 2, y: sht.cy - sht.h / 2 };
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
      if (it.visible === false) continue; /* v2.4.35：隐藏 token 不画血条 */

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

      var isOwner = !!(viewer.id && rec.item.createdUserId === viewer.id);
      var hiddenForViewer = rec.hp.hide && viewer.role !== "GM";
      if (hiddenForViewer) { if (barEntries[id]) await removeBar(id); continue; }
      var exact = viewer.role === "GM" || isOwner || !rec.hp.locked;
      /* silhouette：非 GM / 非 owner 且 locked → 只画条，数字掩码，比例量化。 */
      var sil = !exact;
      var hpView = sil ? Object.assign({}, rec.hp, { cur: quantiseBarRatio(rec.hp.cur, rec.hp.max) * rec.hp.max }) : rec.hp;
      var L = barLayout(bounds, dpi, hpView, { exact: exact, threshold: viewer.threshold });
      if (sil && L.text) L.text = "?/??";
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
    var name = String(e.name == null ? "" : e.name).trim().slice(0, 40) || "未命名";
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
    var room = {};
    var scene = {};
    try { room = (await OBR.room.getMetadata()) || {}; } catch (eR) { room = {}; }
    try { scene = (await OBR.scene.getMetadata()) || {}; } catch (eS) { scene = {}; }
    var rawRoom = room ? room[KEY_INITIATIVE] : null;
    var rawScene = scene ? scene[KEY_INITIATIVE] : null;
    var atRoom = rawRoom && typeof rawRoom.updatedAt === "number" ? rawRoom.updatedAt : -1;
    var atScene = rawScene && typeof rawScene.updatedAt === "number" ? rawScene.updatedAt : -1;
    var raw = atScene > atRoom ? rawScene : rawRoom; /* v2.4.35：取 updatedAt 较新者，scene 优先于旧 room */
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
  var baseAt = state && typeof state.updatedAt === "number" ? state.updatedAt : 0;
  var latest = await initRead();
  if (latest && latest.updatedAt > baseAt) {
    notify("其他人刚修改先攻，已刷新", "WARNING");
    pageLog("info", "init write conflict → reload latest updatedAt=" + latest.updatedAt);
    return latest;
  }
  var next = initNorm(state);
  next.entries = initSortEntries(next.entries);
  next.updatedAt = Date.now();
  pageLog("info", "init state entries=" + next.entries.length + " bytes=" + roomByteLen(JSON.stringify(next)));
  next.store = "";
  var res = await roomWriteGuarded(KEY_INITIATIVE, next);
  if (res.ok) {
    next.store = res.store || "room";
    try { localStorage.removeItem(INIT_LS_FALLBACK); } catch (e2) {  }
    return next;
  }
  var msg = res.reason === "full" ? "房间数据已满（16KB）" : errText(res.error);
  try {
    safeLocalSet(INIT_LS_FALLBACK, JSON.stringify({ v: 1, updatedAt: Date.now(), state: next }));
  } catch (e3) {  }
  if (res.reason === "full") {
    var oursKb = res.ours != null ? (res.ours / 1024).toFixed(1) : "?";
    var otherKb = res.other != null ? (res.other / 1024).toFixed(1) : "?";
    notify("房间数据已满（本插件 " + oursKb + " KB，其它插件 " + otherKb + " KB）：已把先攻/骰子记录暂存本机，建议关闭其它写房间数据的插件或清理", "ERROR");
  } else {
    notify("先攻没能写进房间数据（" + msg + "）：已暂存在本机。先攻最多 " + INIT_MAX_ENTRIES + " 条。", "ERROR");
  }
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

/* v2.4.35：token 上「备团先攻预设」（血条编辑窗填写，合计值）；没有则 null。 */
var KEY_INIT_PRESET = NS + "/init-preset";
function initPresetOf(item) {
  try {
    var raw = item && item.metadata ? item.metadata[KEY_INIT_PRESET] : null;
    var n = Math.round(Number(raw && raw.v != null ? raw.v : raw));
    if (!isFinite(n) || n < 1 || n > 99) return null;
    return n;
  } catch (e) { return null; }
}

async function initAdd(item, hidden) {
  if (!item || !item.id) return null;
  var state = await initRead();
  var cards = await getCards();
  var cardId = item.metadata ? item.metadata[KEY_BIND] : null;
  var card = typeof cardId === "string" ? findCard(cards, cardId) : null;
  var name = String(item.name || (card && card.name) || "未命名").trim().slice(0, 40) || "未命名";
  var bonus = initBonusOf(item);
  var preset = initPresetOf(item); /* v2.4.35：血条窗里存的备团**先攻加值** */
  if (preset != null) bonus = preset;
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
      init: old.d20 == null ? old.init : Math.round(Number(old.d20)) + bonus,
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
  return { state: next, entry: entry, persisted: !next.local };
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

/* v2.4.35：GM 收到玩家的「加入先攻」请求 —— 校验 token 归属后代写。 */
async function onInitJoinRequest(ev) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") return;
    var d = ev && ev.data !== undefined ? ev.data : ev;
    var itemId = d && typeof d.itemId === "string" ? d.itemId : "";
    if (!itemId) return;
    var sender = ev && ev.playerId ? String(ev.playerId) : "";
    var item = null;
    try { item = (await OBR.scene.items.getItems([itemId]))[0] || null; } catch (eGet) { item = null; }
    if (!item) {
      sendInitJoinAck(sender, false, "这枚 token 已经不在了");
      return;
    }
    if (!sender || item.createdUserId !== sender) {
      sendInitJoinAck(sender, false, "只能加入自己创建的 token");
      return;
    }
    var state = await initRead();
    var exists = false;
    for (var i = 0; i < state.entries.length; i++) if (state.entries[i].tokenId === itemId) { exists = true; break; }
    if (exists) {
      sendInitJoinAck(sender, true, "已经在先攻里了");
      return;
    }
    var res = await initAdd(item, false);
    if (!res) {
      sendInitJoinAck(sender, false, "先攻已满或写入失败");
      return;
    }
    initKnownTokens[String(itemId)] = true;
    await syncInitFlags();
    sendInitJoinAck(sender, true, "已加入先攻：" + res.entry.name);
  } catch (e) {
    pageLog("err", "玩家请求加入先攻失败：" + errText(e));
  }
}

function sendInitJoinAck(toPlayerId, ok, message) {
  try {
    OBR.broadcast.sendMessage(CH_INIT_JOIN_ACK, { to: toPlayerId, ok: !!ok, message: message || "", at: Date.now() }, { destination: "ALL" });
  } catch (e) { /* 忽略 */ }
}

async function onInitJoinAck(ev) {
  try {
    var d = ev && ev.data !== undefined ? ev.data : ev;
    if (!d || typeof d !== "object" || !d.to) return;
    var myId = "";
    try { myId = await OBR.player.getId(); } catch (e) { myId = ""; }
    if (!myId || String(d.to) !== myId) return;
    if (initJoinTimer) { clearTimeout(initJoinTimer); initJoinTimer = null; }
    if (d.ok) pageLog("info", String(d.message || "已加入先攻"));
    else notify(String(d.message || "加入先攻失败"), "WARNING");
  } catch (e2) { /* 忽略 */ }
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
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }
    /* v2.4.35（照 Full Suite）：玩家也能右键「加入先攻」→ 广播给 GM 代写；
     * 只允许自己的 token（GM 端会按 createdUserId 再校验一次）。隐形加入仍 GM 专属。 */
    if (role !== "GM") {
      if (hidden) {
        notify("「隐形加入先攻」只有城主能操作", "WARNING");
        return;
      }
      var fresh0 = null;
      try { fresh0 = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e0) { fresh0 = null; }
      var myId0 = "";
      try { myId0 = await OBR.player.getId(); } catch (eId) { myId0 = ""; }
      if (!myId0 || !fresh0 || fresh0.createdUserId !== myId0) {
        notify("只能把自己创建的 token 加入先攻；别人的 token 请让城主加", "WARNING");
        return;
      }
      var nowJoin = Date.now();
      if (initJoinLastAt && nowJoin - initJoinLastAt < 3000) {
        pageLog("info", "玩家加入先攻请求节流（3s 内重复点击）");
        return;
      }
      initJoinLastAt = nowJoin;
      /* v2.4.35（对齐 Full Suite）：先**尝试玩家直接写**。Full Suite 不需要 GM 代步，
       * 是因为它把先攻放在 token 元数据里；我们放房间/场景数据，OBR 允许就直接成功，
       * 不允许（配额/权限）再退回「请求城主代写」。 */
      try {
        var freshP = null;
        try { freshP = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (eFP) { freshP = null; }
        var resP = await initAdd(freshP || picked, false);
        if (resP && resP.persisted) {
          initKnownTokens[String(picked.id)] = true;
          await syncInitFlags();
          pageLog("info", "玩家直接加入先攻成功 item=" + picked.id);
          return;
        }
      } catch (eDirect) {
        pageLog("err", "玩家直接加入先攻失败，回退请求城主：" + errText(eDirect));
      }
      try {
        OBR.broadcast.sendMessage(CH_INIT_JOIN, { itemId: picked.id, at: nowJoin }, { destination: "ALL" });
        pageLog("info", "已向城主请求加入先攻 item=" + picked.id);
      } catch (eJoin) {
        notify("加入先攻的请求发送失败：" + errText(eJoin), "ERROR");
        return;
      }
      /* v2.4.35：6 秒没收到 GM 回执 → 明确提示（GM 未更新插件 / 不在线 / 写入失败）。 */
      if (initJoinTimer) clearTimeout(initJoinTimer);
      initJoinTimer = setTimeout(function () {
        initJoinTimer = null;
        notify("加入先攻：城主没有响应（GM 可能不在线或插件未更新到 2.4.35）", "WARNING");
      }, 6000);
      return;
    }

    /* v2.4.35：GM 点「加入先攻」时，token 已经在先攻里就明确提示 ——
     * 旧代码会静默更新同一条（条上没变化），看起来就是「点了没反应」。 */
    try {
      var st0 = await initRead();
      for (var ei = 0; ei < st0.entries.length; ei++) {
        if (st0.entries[ei].tokenId === picked.id) {
          notify("「" + (st0.entries[ei].name || picked.name || "这枚 token") + "」已经在先攻里了", "WARNING");
          return;
        }
      }
    } catch (eCheck) { /* 检查失败则继续走添加 */ }

    var fresh = null;
    try { fresh = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e) { fresh = null; }
    var res = await initAdd(fresh || picked, hidden);
    if (!res) {
      /* initAdd 内部已弹过具体原因（格式 / 上限）；这里再兜底一次，避免「点了没反应」。 */
      notify("加入先攻失败：没有写入（详情看控制台 [4enext] 日志）", "WARNING");
      return;
    }
    stepOk("加入先攻：" + res.entry.name + (hidden ? "（隐形）" : "") +
      "（先攻 " + Math.round(res.entry.init) + "）");

    if (!res.persisted) {
      /* 房间 / 场景都没写成功：先攻只落本机，别人看不到 —— 必须明确告诉用户。 */
      notify("先攻只写到了本机（房间+场景数据都写不进去，可能已满）：其他人看不到这次加入", "WARNING");
      await syncInitFlags();
      return;
    }
    /* v2.4.35：写回后再核对一次，防止「函数返回成功但实际没进列表」的静默失败。 */
    try {
      var verify = await initRead();
      var inList = false;
      for (var vi = 0; vi < verify.entries.length; vi++) if (verify.entries[vi].tokenId === picked.id) { inList = true; break; }
      if (!inList) notify("加入先攻没有生效：请再点一次，仍不行把控制台 [4enext] 日志发给作者", "WARNING");
    } catch (eVerify) { /* 忽略 */ }
    initKnownTokens[String(picked.id)] = true;
    await syncInitFlags();

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
  try { safeLocalSet(diceHistKey(), JSON.stringify({ v: 1, rows: (rows || []).slice(0, ROLL_MAX_ROWS) })); }
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

/* =====================================================================
 * v2.4.35：传送门（核心）
 *   GM 拖动画圆建门 → 同 tag 互联；玩家拖动自己 token 进门 → 目的地选择 →
 *   六边形螺旋落点 + 原生 WALL 避让；传送后 700ms 抑制重复触发。
 * 数据：metadata com.4enext-owlbear/portal = { name, tag, radius, showName, visible, locked }
 * ===================================================================== */
function portalMeta(raw) {
  var m = raw && typeof raw === "object" ? raw : {};
  var radius = typeof m.radius === "number" && isFinite(m.radius) ? Math.round(m.radius) : 70;
  radius = Math.max(PORTAL_MIN_RADIUS, Math.min(4000, radius));
  var name = typeof m.name === "string" && m.name.trim() ? m.name.trim().slice(0, 40) : "传送门";
  var tag = typeof m.tag === "string" && m.tag.trim() ? m.tag.trim().slice(0, 40) : name;
  return {
    name: name,
    tag: tag,
    radius: radius,
    showName: m.showName !== false,
    visible: m.visible !== false,
    locked: m.locked !== false
  };
}
function portalOf(item) {
  if (!item || !item.metadata || !item.metadata[KEY_PORTAL]) return null;
  var p = portalMeta(item.metadata[KEY_PORTAL]);
  p.itemId = item.id;
  p.center = { x: item.position.x, y: item.position.y };
  return p;
}
function portalListOf(items) {
  var out = [];
  for (var i = 0; i < (items || []).length; i++) {
    var p = portalOf(items[i]);
    if (p) out.push(p);
  }
  return out;
}
function portalDestinations(portals, sourceId) {
  var src = null;
  for (var i = 0; i < portals.length; i++) if (portals[i].itemId === sourceId) src = portals[i];
  if (!src) return [];
  return portals.filter(function (p) { return p.itemId !== sourceId && p.tag === src.tag; });
}
function portalTokenRadius(item, sceneDpi) {
  var dpi = typeof sceneDpi === "number" && sceneDpi > 0 ? sceneDpi : 150;
  var w = item && typeof item.width === "number" && isFinite(item.width) && item.width > 0 ? item.width : 0;
  var h = item && typeof item.height === "number" && isFinite(item.height) && item.height > 0 ? item.height : 0;
  var sx = item && item.scale && typeof item.scale.x === "number" && isFinite(item.scale.x) ? Math.abs(item.scale.x) : 1;
  var sy = item && item.scale && typeof item.scale.y === "number" && isFinite(item.scale.y) ? Math.abs(item.scale.y) : 1;
  var r = (w > 0 || h > 0) ? Math.max(w * sx, h * sy) / 2 : dpi / 2; /* 1 格半径兜底 */
  /* clamp 到 [0.5 格, 5 格] */
  return Math.max(dpi / 2, Math.min(dpi * 5, r || dpi / 2));
}
function portalXfPoint(item, p) {
  var sx = item.scale && typeof item.scale.x === "number" ? item.scale.x : 1;
  var sy = item.scale && typeof item.scale.y === "number" ? item.scale.y : 1;
  var rot = typeof item.rotation === "number" ? item.rotation : 0;
  var x = p.x * sx, y = p.y * sy;
  var c = Math.cos(rot), sn = Math.sin(rot);
  return { x: (item.position ? item.position.x : 0) + x * c - y * sn, y: (item.position ? item.position.y : 0) + x * sn + y * c };
}
function portalWallSegments(items) {
  var segs = [];
  for (var i = 0; i < (items || []).length; i++) {
    var it = items[i];
    if (!it || it.type !== "WALL") continue;
    var pts = Array.isArray(it.points) ? it.points : null;
    if (pts && pts.length >= 2) {
      for (var j = 0; j < pts.length - 1; j++) segs.push({ a: portalXfPoint(it, pts[j]), b: portalXfPoint(it, pts[j + 1]) });
      if (it.closed && pts.length > 2) segs.push({ a: portalXfPoint(it, pts[pts.length - 1]), b: portalXfPoint(it, pts[0]) });
    } else if (it.startPosition && it.endPosition) {
      segs.push({ a: portalXfPoint(it, it.startPosition), b: portalXfPoint(it, it.endPosition) });
    }
  }
  return segs;
}
function portalPointSegDist(p, a, b) {
  var vx = b.x - a.x, vy = b.y - a.y;
  var wx = p.x - a.x, wy = p.y - a.y;
  var len2 = vx * vx + vy * vy;
  var t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  var dx = p.x - (a.x + vx * t), dy = p.y - (a.y + vy * t);
  return Math.sqrt(dx * dx + dy * dy);
}
function portalPointSafe(p, radius, walls) {
  for (var i = 0; i < walls.length; i++) {
    if (portalPointSegDist(p, walls[i].a, walls[i].b) < radius + PORTAL_WALL_PADDING) return false;
  }
  return true;
}
function portalSegIntersect(p1, p2, p3, p4) {
  var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  var den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return false;
  var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  /* 忽略门中心恰在墙上的起点相交（t≈0），否则门贴墙时永远找不到落点。 */
  return t > 1e-6 && t <= 1 && u >= 0 && u <= 1;
}
/** 从门中心到落点的路径不得穿墙（token 半径 + padding 容差由点安全负责，这里检测实际相交）。 */
function portalPathSafe(center, p, walls) {
  for (var i = 0; i < walls.length; i++) {
    if (portalSegIntersect(center, p, walls[i].a, walls[i].b)) return false;
  }
  return true;
}
/** 六边形螺旋（轴向坐标）：相邻落点距离 = spacing，保证多选 token 不重叠。 */
function portalHexSpiral(count, spacing) {
  var n = Math.max(0, Math.round(count));
  var sp = Math.max(1, spacing);
  if (!n) return [];
  var out = [];
  var maxRing = Math.ceil(Math.sqrt(n)) + 3;
  for (var ring = 0; ring <= maxRing && out.length < n; ring++) {
    for (var q = -ring; q <= ring && out.length < n; q++) {
      for (var r = Math.max(-ring, -q - ring); r <= Math.min(ring, -q + ring) && out.length < n; r++) {
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) !== ring) continue;
        out.push({ x: sp * (q + r / 2), y: sp * (r * Math.sqrt(3) / 2) });
      }
    }
  }
  return out.slice(0, n);
}
/**
 * 为多枚 token 在目的地中心附近找落点：六边形螺旋 + 墙避让（距离 ≥ token 半径 + 8）。
 * 返回 positions 数组（与 radii 同序）；找不到安全点返回 null。
 */
function portalPlanTeleport(center, radii, walls) {
  var list = Array.isArray(radii) && radii.length ? radii : [5];
  var maxR = 0;
  for (var i = 0; i < list.length; i++) maxR = Math.max(maxR, list[i]);
  var spacing = 2 * maxR + PORTAL_WALL_PADDING;
  var candidates = portalHexSpiral(Math.max(24, list.length * 12), spacing).slice();
  /* 先内圈后外圈（螺旋本身由近到远，这里再显式按距离排序兜底）。 */
  candidates.sort(function (a, b) { return (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y); });
  var positions = [];
  var used = {};
  var candLog = 0;
  for (var k = 0; k < list.length; k++) {
    var found = null;
    for (var c = 0; c < candidates.length; c++) {
      if (used[c]) continue;
      var p = { x: center.x + candidates[c].x, y: center.y + candidates[c].y };
      var reject = "";
      if (!portalPointSafe(p, list[k], walls)) reject = "wall-hit";
      else if (!portalPathSafe(center, p, walls)) reject = "wall-cross";
      if (candLog < 12) {
        pageLog("info", "portal cand i=" + candLog + " reject=" + (reject || "ok"));
        candLog++;
      }
      if (reject) continue;
      used[c] = true;
      found = p;
      candLog = 12; /* 首个合法点后不再刷候选日志 */
      break;
    }
    if (!found) return null;
    positions.push(found);
  }
  return positions;
}
function portalSuppressed(now, until) { return until > now; }

var portalPreviewId = null;
var portalDragStart = null;
var portalGestureSeq = 0;
var portalGestureId = 0;
var portalFinishedGesture = 0;
var portalDetectTimer = null;
var portalBaseline = {};
var portalBaselineReady = false;
var portalSuppressUntil = 0;
var portalDestOpen = false;
var portalDestOpening = false;
var portalDestLastKey = "";
var portalDestLastAt = 0;
var portalOldDestId = NS + "/portal-dest-pop";
var portalKnown = {};
var portalLifecycleReady = false;
var portalRadiusInflight = {};
var portalTeleportLanded = {};
var portalWritingIds = {};
var portalSkipLogAt = 0;
/** v2.4.35：GM 拖缩放手柄 → 把 item.scale 反算回 metadata.radius（只 GM 写，inflight 防自触发循环）。 */
async function portalScaleRadiusSync(all) {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") return 0;
  var dpi = await portalSceneDpi();
  var wrote = 0;
  for (var i = 0; i < (all || []).length; i++) {
    var it = all[i];
    if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) continue;
    var meta = portalMeta(it.metadata[KEY_PORTAL]);
    var expected = portalScaleFor(meta.radius, dpi);
    var sx = it.scale && typeof it.scale.x === "number" ? Math.abs(it.scale.x) : expected;
    var sy = it.scale && typeof it.scale.y === "number" ? Math.abs(it.scale.y) : sx;
    var denom = expected > 0 ? expected : 1;
    if (Math.abs(sx - expected) / denom <= 0.01 && Math.abs(sy - expected) / denom <= 0.01) continue;
    var newR = portalRadiusFromScale({ x: sx, y: sy }, dpi);
    if (newR === meta.radius) continue;
    if (portalRadiusInflight[it.id] === newR) continue;
    portalRadiusInflight[it.id] = newR;
    try {
      await OBR.scene.items.updateItems([it.id], function (drafts) {
        for (var d = 0; d < drafts.length; d++) {
          if (!drafts[d].metadata || typeof drafts[d].metadata !== "object") drafts[d].metadata = {};
          drafts[d].metadata[KEY_PORTAL] = portalMeta(Object.assign({}, meta, { radius: newR }));
        }
      });
      wrote++;
      pageLog("info", "portal radius sync scale=" + sx.toFixed(4) + "," + sy.toFixed(4) + " → r=" + newR + " dpi=" + dpi);
    } catch (e) {
      pageLog("err", "portal radius sync 失败：" + errText(e));
    } finally {
      setTimeout(function () { delete portalRadiusInflight[it.id]; }, 500);
    }
  }
  return wrote;
}

/** v2.4.35 诊断：对比已知传送门 id 集合，打印 added / removed / hidden，区分「被删」还是「没画出来」。 */
function portalLifecycleSync(all) {
  var current = {};
  var count = 0;
  for (var i = 0; i < (all || []).length; i++) {
    var it = all[i];
    if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) continue;
    current[it.id] = { visible: it.visible !== false, name: it.metadata[KEY_PORTAL].name || "" };
    count++;
  }
  if (!portalLifecycleReady) {
    portalLifecycleReady = true;
    portalKnown = current;
    pageLog("info", "portal lifecycle seed n=" + count);
    return;
  }
  for (var id in current) {
    if (!Object.prototype.hasOwnProperty.call(current, id)) continue;
    if (!portalKnown[id]) pageLog("info", "portal added id=" + id + " name=" + current[id].name);
    else if (portalKnown[id].visible && !current[id].visible) pageLog("info", "portal hidden id=" + id);
    else if (!portalKnown[id].visible && current[id].visible) pageLog("info", "portal shown id=" + id);
  }
  for (var oldId in portalKnown) {
    if (!Object.prototype.hasOwnProperty.call(portalKnown, oldId)) continue;
    if (!current[oldId]) pageLog("info", "portal removed id=" + oldId + " name=" + portalKnown[oldId].name);
  }
  portalKnown = current;
}

var portalDpiCache = 0;
async function portalSceneDpi() {
  if (portalDpiCache > 0) return portalDpiCache;
  var dpi = 150;
  try {
    if (OBR.scene && OBR.scene.grid && typeof OBR.scene.grid.getDpi === "function") {
      var got = await OBR.scene.grid.getDpi();
      if (typeof got === "number" && got > 0) dpi = got;
    }
  } catch (e) { dpi = 150; }
  portalDpiCache = dpi;
  return dpi;
}
/** 渲染直径 D = width × (sceneDpi / image.dpi) × scale；width=image.dpi=256 ⇒ scale = 2r / sceneDpi。 */
function portalScaleFor(radius, dpi) {
  var d = typeof dpi === "number" && dpi > 0 ? dpi : 150;
  return (2 * Math.max(PORTAL_MIN_RADIUS, radius)) / d;
}
/** 反向换算：sceneDpi × scale / 2；x/y 不一致时取 **min**（避免非等比缩放把触发范围放大），clamp 16..4000。 */
function portalRadiusFromScale(scale, dpi) {
  var d = typeof dpi === "number" && dpi > 0 ? dpi : 150;
  var sx = scale && typeof scale.x === "number" && isFinite(scale.x) ? Math.abs(scale.x) : 0;
  var sy = scale && typeof scale.y === "number" && isFinite(scale.y) ? Math.abs(scale.y) : sx;
  var sMin = sx > 0 && sy > 0 ? Math.min(sx, sy) : Math.max(sx, sy);
  if (!(sMin > 0)) return PORTAL_MIN_RADIUS;
  return Math.max(PORTAL_MIN_RADIUS, Math.min(4000, Math.round(d * sMin / 2)));
}
async function portalImageItem(center, radius, meta, isPreview) {
  var dpi = await portalSceneDpi();
  var cx = Number(center && center.x);
  var cy = Number(center && center.y);
  if (!isFinite(cx)) cx = 0;
  if (!isFinite(cy)) cy = 0;
  var scale = portalScaleFor(radius, dpi);
  var item = buildImage(
    { width: 150, height: 150, url: PORTAL_ICON_URL, mime: "image/png" },
    { dpi: 150, offset: { x: 75, y: 75 } }
  )
    .position({ x: cx, y: cy })
    .scale({ x: scale, y: scale })
    .layer("PROP")
    .name("传送门")
    .locked(true)
    .visible(meta ? meta.visible !== false : true)
    .metadata(isPreview ? { [PORTAL_PREVIEW_TAG]: true } : { [KEY_PORTAL]: portalMeta(meta) })
    .build();
  pageLog("info", "portal item dpi=" + dpi + " r=" + Math.round(radius) + " scale=" + scale.toFixed(4) + " center=" + cx + "," + cy);
  return item;
}
async function portalClearPreviewResidue(reason) {
  try {
    if (!OBR.scene || !OBR.scene.local || typeof OBR.scene.local.getItems !== "function") return 0;
    var items = await OBR.scene.local.getItems();
    var ids = [];
    for (var i = 0; i < (items || []).length; i++) {
      var it = items[i];
      if (it && it.metadata && it.metadata[PORTAL_PREVIEW_TAG]) ids.push(it.id);
    }
    if (!ids.length) return 0;
    await OBR.scene.local.deleteItems(ids);
    portalPreviewId = null;
    pageLog("info", "preview 残留清理 " + ids.length + " 项" + (reason ? "（" + reason + "）" : ""));
    return ids.length;
  } catch (e) {
    pageLog("err", "preview 残留清理失败：" + errText(e));
    return 0;
  }
}
async function portalPreviewStart(center) {
  center = { x: Number(center && center.x) || 0, y: Number(center && center.y) || 0 };
  try {
    if (!OBR.scene || !OBR.scene.local || typeof buildImage !== "function") return;
    await portalClearPreviewResidue("start");
    await portalPreviewClear();
    var item = await portalImageItem(center, PORTAL_MIN_RADIUS, { visible: true }, true);
    item.metadata = { [PORTAL_PREVIEW_TAG]: true };
    item.visible = true;
    await OBR.scene.local.addItems([item]);
    portalPreviewId = item.id;
    pageLog("info", "preview add ok");
  } catch (e) { pageLog("err", "preview add fail：" + errText(e)); }
}
async function portalPreviewUpdate(center, radius) {
  if (!portalPreviewId) return;
  center = { x: Number(center && center.x) || 0, y: Number(center && center.y) || 0 };
  try {
    var dpi = await portalSceneDpi();
    var scale = portalScaleFor(radius, dpi);
    await OBR.scene.local.updateItems([portalPreviewId], function (drafts) {
      for (var i = 0; i < drafts.length; i++) {
        drafts[i].position = { x: center.x, y: center.y };
        drafts[i].scale = { x: scale, y: scale };
      }
    });
    var now = Date.now();
    if (now - portalPreviewLogAt > 250) {
      portalPreviewLogAt = now;
      pageLog("info", "preview update ok r=" + Math.round(radius));
    }
  } catch (e) { pageLog("err", "preview update fail：" + errText(e)); }
}
async function portalPreviewClear() {
  if (!portalPreviewId) return;
  var id = portalPreviewId;
  portalPreviewId = null;
  try { await OBR.scene.local.deleteItems([id]); pageLog("info", "preview remove ok"); }
  catch (e) { pageLog("err", "preview remove fail：" + errText(e)); }
  await portalClearPreviewResidue("clear");
}
async function portalCreate(center, radius, opts) {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") { notify("只有城主能创建传送门", "WARNING"); return null; }
  var rr = Number(radius);
  if (!isFinite(rr) || rr < PORTAL_MIN_RADIUS) return null;
  var o = opts && typeof opts === "object" ? opts : {};
  var meta = portalMeta({
    name: o.name || "传送门", tag: o.tag || o.name || "传送门", radius: Math.round(rr),
    showName: true, visible: true, locked: false
  });
  var item = await portalImageItem(center, meta.radius, meta, false);
  try {
    await OBR.scene.items.addItems([item]);
    pageLog("info", "传送门已创建：" + item.id + " r=" + meta.radius);
    try {
      var now = await OBR.scene.items.getItems([item.id]);
      var got = now && now[0] ? now[0] : null;
      pageLog("info", "portal verify id=" + item.id + " exists=" + !!got +
        " visible=" + (got && got.visible) + " layer=" + (got && got.layer) +
        " scale=" + (got && got.scale ? JSON.stringify(got.scale) : "?") +
        " pos=" + (got && got.position ? (got.position.x + "," + got.position.y) : "?"));
    } catch (eVerify) {
      pageLog("err", "portal verify 失败：" + errText(eVerify));
    }
    return item;
  } catch (e) {
    stepFail("创建传送门", e);
    return null;
  }
}
var portalDragMoveLogAt = 0;
var portalPreviewLogAt = 0;

async function logPortalActiveState(where) {
  try {
    var t = typeof OBR.tool.getActiveTool === "function" ? await OBR.tool.getActiveTool() : "?";
    var m = typeof OBR.tool.getActiveToolMode === "function" ? await OBR.tool.getActiveToolMode() : "?";
    pageLog("info", "传送门 " + where + " getActiveTool=" + t + " getActiveToolMode=" + m);
  } catch (e) {
    pageLog("err", "传送门 " + where + " 读取 active 状态失败：" + errText(e));
  }
}

async function portalDragBegin(event) {
  var target = event && event.target;
  if (target && target.metadata && target.metadata[KEY_PORTAL]) { portalDragStart = null; return; }
  var p = event && event.pointerPosition;
  pageLog("info", "传送门 dragStart p=" + (p ? p.x + "," + p.y : "无") + " target=" + (target ? "有" : "无"));
  if (!p) return;
  portalGestureId = ++portalGestureSeq;
  portalDragStart = { x: p.x, y: p.y, gesture: portalGestureId };
  pageLog("info", "传送门 gesture=" + portalGestureId + " begin");
  await portalPreviewStart(portalDragStart);
}
async function portalDragUpdate(event) {
  if (!portalDragStart) return;
  var p = event && event.pointerPosition;
  if (!p) return;
  var r = Math.hypot(p.x - portalDragStart.x, p.y - portalDragStart.y);
  var now = Date.now();
  if (now - portalDragMoveLogAt > 250) {
    portalDragMoveLogAt = now;
    pageLog("info", "传送门 dragMove r=" + Math.round(r));
  }
  await portalPreviewUpdate(portalDragStart, r);
}
async function portalDragFinish(event) {
  if (!portalDragStart) { pageLog("info", "preview skip（已处理）"); return; }
  var gesture = portalDragStart.gesture || portalGestureId;
  if (gesture === portalFinishedGesture) { pageLog("info", "preview skip（已处理）"); return; }
  portalFinishedGesture = gesture;
  var center = { x: portalDragStart.x, y: portalDragStart.y };
  portalDragStart = null;
  var p = event && event.pointerPosition;
  await portalPreviewClear();
  if (!p) { pageLog("info", "传送门 dragEnd p=无 → 忽略"); return; }
  var radius = Math.hypot(p.x - center.x, p.y - center.y);
  if (radius < PORTAL_MIN_RADIUS) {
    pageLog("info", "传送门 dragEnd r=" + Math.round(radius) + " → 太小忽略（<" + PORTAL_MIN_RADIUS + "）");
    return;
  }
  pageLog("info", "传送门 dragEnd r=" + Math.round(radius) + " → create");
  var created = await portalCreate(center, radius);
  if (created) pageLog("info", "portal create gesture=" + gesture + " id=" + created.id);
  await portalClearPreviewResidue("create");
}
async function portalDragCancel() {
  portalDragStart = null;
  await portalPreviewClear();
}

async function registerPortalTool() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") return;
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  /* Full Suite 同款：tool / mode **只在 GM 时注册**；玩家只走拖动进门 + 目的地选择。 */
  if (role !== "GM") {
    pageLog("info", "传送门工具不注册：role=" + role + "（仅 GM）");
    return;
  }

  var portalMode = {
    id: TOOL_PORTAL_MODE_ID,
    icons: [{ icon: TOOL_PORTAL_ICON_URL, label: "画传送门（拖动定半径，松手创建）", filter: { activeTools: [TOOL_PORTAL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    onActivate: function () { pageLog("info", "传送门 mode 已激活"); },
    onToolDragStart: async function (_ctx, event) { await portalDragBegin(event); },
    onToolDragMove: async function (_ctx, event) { await portalDragUpdate(event); },
    onToolDragEnd: async function (_ctx, event) { await portalDragFinish(event); },
    onToolDragCancel: async function () { await portalDragCancel(); },
    onDeactivate: async function () { await portalDragCancel(); },
    /* 兜底：若宿主的 drag 事件不触发，用 down/move/up 走同一套（凭 portalDragStart 去重）。 */
    onToolDown: async function (_ctx, event) {
      pageLog("info", "传送门 toolDown");
      if (portalDragStart) return;
      await portalDragBegin(event);
    },
    onToolMove: async function (_ctx, event) {
      if (!portalDragStart) return;
      await portalDragUpdate(event);
    },
    onToolUp: async function (_ctx, event) {
      pageLog("info", "传送门 toolUp");
      await portalDragFinish(event);
    }
  };

  /* 顺序：先 tool（defaultMode 必须已存在才允许建 mode），再 mode。 */
  await registerOneTool({
    id: TOOL_PORTAL_ID,
    icons: [{ icon: TOOL_PORTAL_ICON_URL, label: "4eNEXT to owlbear：传送门（GM 拖动画圆）", filter: { roles: ["GM"] } }],
    defaultMode: TOOL_PORTAL_MODE_ID,
    onClick: async function () {
      pageLog("info", "传送门工具点击 role=GM → activateTool");
      try { await OBR.tool.activateTool(TOOL_PORTAL_ID); } catch (e) { pageLog("err", "传送门 activateTool 失败：" + errText(e)); }
      setTimeout(function () {
        try {
          var ret = OBR.tool.activateMode(TOOL_PORTAL_ID, TOOL_PORTAL_MODE_ID);
          if (ret && typeof ret.catch === "function") ret.catch(function (e2) { pageLog("err", "传送门 mode 激活失败：" + errText(e2)); });
          pageLog("info", "传送门 mode 激活 → " + TOOL_PORTAL_MODE_ID);
        } catch (e) { pageLog("err", "传送门 mode 激活失败：" + errText(e)); }
        setTimeout(function () { void logPortalActiveState("点击后"); }, 250);
      }, 80);
      return false;
    }
  });
  pageLog("info", "传送门 tool 创建 ✓");

  if (typeof OBR.tool.createMode !== "function") return;
  try {
    await OBR.tool.createMode(portalMode);
    pageLog("info", "传送门 mode 创建 ✓");
  } catch (e) {
    pageLog("err", "传送门 mode 创建失败：" + errText(e));
    try { await OBR.tool.removeMode(TOOL_PORTAL_MODE_ID); } catch (e2) {  }
    try { await OBR.tool.createMode(portalMode); pageLog("info", "传送门 mode 创建 ✓（重试）"); }
    catch (e3) { pageLog("err", "传送门 mode 创建失败（重试后）：" + errText(e3)); return; }
  }

  /* v2.4.35：成对创建 mode（tool 下第二个 mode）。 */
  try {
    await OBR.tool.createMode({
      id: TOOL_PORTAL_PAIR_MODE_ID,
      icons: [{ icon: TOOL_PORTAL_ICON_URL, label: "成对创建传送门（点两处）", filter: { activeTools: [TOOL_PORTAL_ID] } }],
      cursors: [{ cursor: "crosshair" }],
      onToolClick: async function (_ctx, event) {
        var p = event && event.pointerPosition;
        if (!p) return false;
        if (!portalPairFirst) {
          portalPairFirst = { x: p.x, y: p.y };
          pageLog("info", "portal pair first=" + p.x + "," + p.y);
          await portalPairPreview(portalPairFirst, portalPairFirst);
          return false;
        }
        var first = { x: portalPairFirst.x, y: portalPairFirst.y };
        portalPairFirst = null;
        await portalPairCreate(first, { x: p.x, y: p.y });
        return false;
      },
      onToolMove: async function (_ctx, event) {
        if (!portalPairFirst) return;
        var p = event && event.pointerPosition;
        if (p) await portalPairPreview(portalPairFirst, p);
      },
      onToolDragCancel: async function () { await portalPairClear(); },
      onDeactivate: async function () { await portalPairClear(); },
      onKeyDown: async function (_ctx, event) { if (event && event.key === "Escape") await portalPairClear(); }
    });
    pageLog("info", "传送门 pair mode 创建 ✓");
  } catch (ePair) {
    pageLog("err", "传送门 pair mode 创建失败：" + errText(ePair));
  }

  /* 已激活的 tool 可能还没切 mode：显式切一次并打印当前 active 状态。 */
  try {
    var active = typeof OBR.tool.getActiveTool === "function" ? await OBR.tool.getActiveTool() : "";
    if (active === TOOL_PORTAL_ID && typeof OBR.tool.activateMode === "function") {
      await OBR.tool.activateMode(TOOL_PORTAL_ID, TOOL_PORTAL_MODE_ID);
      pageLog("info", "传送门 mode 激活 → " + TOOL_PORTAL_MODE_ID);
    }
    void logPortalActiveState("注册后");
  } catch (e4) {
    pageLog("err", "传送门 mode 激活失败：" + errText(e4));
  }
}
var portalEditItemId = "";
async function syncPortalEditFromSelection() {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") return;
  var sel = [];
  try { sel = (await OBR.player.getSelection()) || []; } catch (e2) { sel = []; }

  /* v2.4.35 修复：打开 popover 后选区会变成「无」（焦点变化），不能当成取消选中去关窗，
   * 否则用户看到一闪。空选中 / 多选 / 选中非门 → 都保持现有编辑窗。 */
  if (sel.length === 0) {
    if (portalEditItemId) pageLog("info", "传送门 编辑窗保持（选中 0 项）");
    return;
  }
  if (sel.length > 1) {
    if (portalEditItemId) pageLog("info", "传送门 编辑窗保持（多选 " + sel.length + " 项）");
    return;
  }
  var id = sel[0];
  if (portalEditItemId === id) return; /* 同一枚已开 */
  var it = null;
  try {
    var items = await OBR.scene.items.getItems([id]);
    it = items && items[0] ? items[0] : null;
  } catch (e4) { it = null; }
  if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) {
    if (portalEditItemId) pageLog("info", "传送门 编辑窗保持（选中不是门）");
    return;
  }
  var old = portalEditItemId;
  portalEditItemId = id;
  if (old) {
    pageLog("info", "传送门 编辑窗切换 " + old + "→" + id);
    try { await OBR.popover.close(ID_PORTAL_EDIT); } catch (e5) {  }
  } else {
    pageLog("info", "传送门 选中 → 打开编辑 " + id);
  }
  await openPortalEdit(id);
}

/** 编辑窗自己关闭（取消 / ✕ / 保存）→ 清记录，允许下次再点同一门重开。 */
async function onPortalEditClosed(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.closedByUser !== true) return;
  portalEditItemId = "";
  pageLog("info", "传送门 编辑窗关闭（用户关闭）");
  try { await OBR.popover.close(ID_PORTAL_EDIT); } catch (e) {  }
}

async function openPortalEdit(itemId) {
  if (!itemId) return false;
  try {
    /* v2.4.35：编辑窗接进通用窗口框架（可拖动 / 位置记忆 / 视口 reclamp）。
     * URL 带 ?item=<id>；同一 popover id 重复打开会原地更新，不会重开。 */
    await openWin("portalEdit", URL_PORTAL_EDIT + "?item=" + encodeURIComponent(itemId));
    return true;
  } catch (e) {
    stepFail("打开传送门编辑窗", e);
    return false;
  }
}
async function onPortalSave(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var itemId = data && typeof data.itemId === "string" ? data.itemId : "";
  if (!itemId) return;
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") { notify("只有城主能编辑传送门", "WARNING"); return; }
  var meta = portalMeta(data.portal || data);
  try {
    var saveDpi = await portalSceneDpi();
    await OBR.scene.items.updateItems([itemId], function (drafts) {
      for (var i = 0; i < drafts.length; i++) {
        if (!drafts[i].metadata || typeof drafts[i].metadata !== "object") drafts[i].metadata = {};
        var oldMeta = drafts[i].metadata[KEY_PORTAL] ? portalMeta(drafts[i].metadata[KEY_PORTAL]) : null;
        /* v2.4.35：半径不再由表单决定 —— 以当前 item.scale 反算（scale 缺失才退回旧 metadata.radius）。 */
        var r = drafts[i].scale
          ? portalRadiusFromScale(drafts[i].scale, saveDpi)
          : (oldMeta ? oldMeta.radius : meta.radius);
        var finalMeta = portalMeta(Object.assign({}, meta, { radius: r }));
        drafts[i].metadata[KEY_PORTAL] = finalMeta;
        drafts[i].visible = finalMeta.visible !== false;
        drafts[i].scale = { x: portalScaleFor(r, saveDpi), y: portalScaleFor(r, saveDpi) };
      }
    });
    pageLog("info", "传送门已保存：" + itemId);
    portalEditItemId = "";
    try { await OBR.popover.close(ID_PORTAL_EDIT); } catch (e2) {  }
  } catch (e3) {
    notify("保存传送门失败：" + errText(e3), "ERROR");
  }
}
/** v2.4.35：传送时临时绕过 Dynamic Fog / Smoke 等插件的穿墙校验：
 * 快照并剥离 token 上的雾效 metadata、隐藏 token 与其 attachment，写位置后逐字恢复。失败不阻塞传送。 */
function portalFogMetaKey(key, val) {
  var k = String(key || "").toLowerCase();
  if (k.indexOf("smoke") >= 0 || k.indexOf("spectre") >= 0 || k.indexOf("specter") >= 0 ||
    k.indexOf("battle-system") >= 0 || k.indexOf("dynamic-fog") >= 0 || k.indexOf("dynamicfog") >= 0) return true;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    if ("attenuationRadius" in val || "sourceRadius" in val || "visionRange" in val ||
      "lightRadius" in val || "wallBlocks" in val) return true;
  }
  return false;
}
async function moveTokensWithFogBypass(tokens, byId) {
  var ids = (tokens || []).map(function (t) { return t.id; }).filter(Boolean);
  if (!ids.length) return { ext: 0, att: 0, hidTokens: 0 };
  var snapMeta = {}; /* tokenId -> {key:value} */
  var ext = 0;
  for (var i = 0; i < tokens.length; i++) {
    var tk = tokens[i];
    var removed = {};
    var md = tk.metadata && typeof tk.metadata === "object" ? tk.metadata : {};
    for (var key in md) {
      if (!Object.prototype.hasOwnProperty.call(md, key)) continue;
      if (portalFogMetaKey(key, md[key])) { removed[key] = md[key]; ext++; }
    }
    if (Object.keys(removed).length) snapMeta[tk.id] = removed;
  }
  var attSnap = []; /* {api,id,visible} */
  var attCount = 0;
  var apis = [];
  try { if (OBR.scene && OBR.scene.items && typeof OBR.scene.items.getItemAttachments === "function") apis.push(OBR.scene.items); } catch (eA) {  }
  try { if (OBR.scene && OBR.scene.local && typeof OBR.scene.local.getItemAttachments === "function") apis.push(OBR.scene.local); } catch (eB) {  }
  for (var ai = 0; ai < apis.length; ai++) {
    try {
      var atts = await apis[ai].getItemAttachments(ids);
      for (var aj = 0; aj < (atts || []).length; aj++) {
        var at = atts[aj];
        if (!at || !at.id) continue;
        attSnap.push({ api: apis[ai], id: at.id, visible: at.visible !== false });
        attCount++;
      }
    } catch (eAtt) { pageLog("info", "portal bypass warn attachment read：" + errText(eAtt)); }
  }
  var tokenVisible = {};
  for (var tv = 0; tv < tokens.length; tv++) tokenVisible[tokens[tv].id] = tokens[tv].visible !== false;

  if (!ext && !attCount) {
    /* 没有雾效插件痕迹：不隐藏任何东西，只写位置。 */
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (var d0 = 0; d0 < drafts.length; d0++) {
        var p0 = byId[drafts[d0].id];
        if (p0) drafts[d0].position = { x: p0.x, y: p0.y };
      }
    });
    pageLog("info", "portal bypass ext=0 att=0 hidTokens=0");
    return { ext: 0, att: 0, hidTokens: 0 };
  }

  try {
    /* 1) 删除雾效 metadata */
    if (ext) {
      await OBR.scene.items.updateItems(Object.keys(snapMeta), function (drafts) {
        for (var d1 = 0; d1 < drafts.length; d1++) {
          var rem = snapMeta[drafts[d1].id];
          if (!rem || !drafts[d1].metadata) continue;
          for (var rk in rem) if (Object.prototype.hasOwnProperty.call(rem, rk)) delete drafts[d1].metadata[rk];
        }
      });
    }
    /* 2) 隐藏 attachment */
    for (var ah = 0; ah < attSnap.length; ah++) {
      try {
        await attSnap[ah].api.updateItems([attSnap[ah].id], function (drafts) {
          for (var d2 = 0; d2 < drafts.length; d2++) drafts[d2].visible = false;
        });
      } catch (eHideAtt) { pageLog("info", "portal bypass warn attachment hide"); }
    }
    /* 3) 隐藏 token 自身 + 4) 写位置 */
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (var d3 = 0; d3 < drafts.length; d3++) {
        drafts[d3].visible = false;
        var p3 = byId[drafts[d3].id];
        if (p3) drafts[d3].position = { x: p3.x, y: p3.y };
      }
    });
  } catch (eMove) {
    pageLog("info", "portal bypass warn move：" + errText(eMove));
  } finally {
    /* 5) 恢复：token visible → attachment visible → metadata 原值 */
    try {
      await OBR.scene.items.updateItems(ids, function (drafts) {
        for (var d4 = 0; d4 < drafts.length; d4++) {
          if (Object.prototype.hasOwnProperty.call(tokenVisible, drafts[d4].id)) drafts[d4].visible = tokenVisible[drafts[d4].id];
        }
      });
    } catch (eRestoreT) { pageLog("info", "portal bypass warn restore token"); }
    for (var ar = 0; ar < attSnap.length; ar++) {
      try {
        var visVal = attSnap[ar].visible;
        await attSnap[ar].api.updateItems([attSnap[ar].id], function (drafts) {
          for (var d5 = 0; d5 < drafts.length; d5++) drafts[d5].visible = visVal;
        });
      } catch (eRestoreA) { pageLog("info", "portal bypass warn restore attachment"); }
    }
    try {
      await OBR.scene.items.updateItems(Object.keys(snapMeta), function (drafts) {
        for (var d6 = 0; d6 < drafts.length; d6++) {
          var back = snapMeta[drafts[d6].id];
          if (!back) continue;
          if (!drafts[d6].metadata || typeof drafts[d6].metadata !== "object") drafts[d6].metadata = {};
          for (var bk in back) if (Object.prototype.hasOwnProperty.call(back, bk)) drafts[d6].metadata[bk] = back[bk];
        }
      });
    } catch (eRestoreM) { pageLog("info", "portal bypass warn restore metadata"); }
  }
  pageLog("info", "portal bypass ext=" + ext + " att=" + attCount + " hidTokens=" + ids.length);
  return { ext: ext, att: attCount, hidTokens: ids.length };
}

async function onPortalTeleport(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var destId = data && typeof data.destinationId === "string" ? data.destinationId : "";
  var tokenIds = data && Array.isArray(data.tokenIds) ? data.tokenIds : [];
  if (!destId || !tokenIds.length) return;
  var now = Date.now();
  if (portalSuppressed(now, portalSuppressUntil)) return;
  try {
    var all = await OBR.scene.items.getItems();
    var dest = null;
    for (var i = 0; i < all.length; i++) if (all[i].id === destId) dest = portalOf(all[i]);
    if (!dest) return;
    var tokens = all.filter(function (it) { return tokenIds.indexOf(it.id) >= 0; });
    if (!tokens.length) return;
    /* v2.4.35：传送显式授权 —— 仅 GM 或所有目标 token 的创建者。 */
    var teleRole = "";
    var telePid = "";
    try { teleRole = await OBR.player.getRole(); } catch (eRole) { teleRole = ""; }
    try { telePid = await OBR.player.getId(); } catch (ePid) { telePid = ""; }
    var authorized = teleRole === "GM";
    if (!authorized) {
      authorized = tokens.every(function (it) { return !!(telePid && it.createdUserId === telePid); });
    }
    if (!authorized) {
      pageLog("info", "portal teleport denied role=" + teleRole + " pid=" + telePid + " tokens=" + tokens.length);
      return;
    }
    var dpiTele = await portalSceneDpi();
    var radii = tokens.map(function (it) { return portalTokenRadius(it, dpiTele); });
    var walls = portalWallSegments(all);
    var positions = portalPlanTeleport(dest.center, radii, walls);
    if (!positions) {
      pageLog("info", "portal plan fail tokens=" + tokens.length + " radius=" + radii.join(",") + " walls=" + walls.length);
      notify("传送失败：目的地附近没有能避开墙的位置，请城主把目的地挪开一点", "WARNING");
      return;
    }
    pageLog("info", "portal plan n=" + positions.length + " walls=" + walls.length +
      " dest=" + Math.round(dest.center.x) + "," + Math.round(dest.center.y) +
      " pos=" + positions.map(function (p) { return Math.round(p.x) + "," + Math.round(p.y); }).join(";"));
    if (!walls.length) pageLog("info", "portal plan warn：未检测到原生 WALL（可能是其它插件的墙/手绘线）");
    if (walls.length) pageLog("info", "portal plan walls[0] a=" + Math.round(walls[0].a.x) + "," + Math.round(walls[0].a.y) + " b=" + Math.round(walls[0].b.x) + "," + Math.round(walls[0].b.y));
    var byId = {};
    var allPortals = portalListOf(all);
    for (var t = 0; t < tokens.length; t++) {
      byId[tokens[t].id] = positions[t];
      portalWritingIds[tokens[t].id] = true;
      portalTeleportLanded[tokens[t].id] = { x: positions[t].x, y: positions[t].y };
    }
    /* 先关目的地窗（不挡 UI），再临时绕过雾效插件写位置。 */
    try { await closeWin("portalDest"); } catch (e2) {  }
    try {
      await moveTokensWithFogBypass(tokens, byId);
    } catch (eBypass) {
      pageLog("info", "portal bypass warn：" + errText(eBypass));
      try {
        await OBR.scene.items.updateItems(Object.keys(byId), function (drafts) {
          for (var d = 0; d < drafts.length; d++) {
            var pos = byId[drafts[d].id];
            if (pos) drafts[d].position = { x: pos.x, y: pos.y };
          }
        });
      } catch (eFallback) { stepFail("执行传送", eFallback); }
    }
    portalSuppressUntil = Date.now() + PORTAL_SUPPRESS_MS;
    portalDestOpen = false;
    setTimeout(function () {
      for (var w = 0; w < tokens.length; w++) delete portalWritingIds[tokens[w].id];
    }, 500);
    pageLog("info", "传送完成：" + tokens.length + " 枚 token → " + dest.name);
  } catch (e) {
    stepFail("执行传送", e);
  }
}
async function onPortalItemsChange() {
  if (portalDetectTimer) clearTimeout(portalDetectTimer);
  portalDetectTimer = setTimeout(function () {
    portalDetectTimer = null;
    void portalDetectDragEnd();
  }, 200);
}
/** v2.4.35：目的地选择窗接进通用窗口框架（可拖动 / 位置记忆 / reclamp）。 */
/* ---------- v2.4.35：隐形门 GM ghost ---------- */
var portalGhostSig = "";
async function portalGhostSync(all) {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (!OBR.scene || !OBR.scene.local) return;
  var invisible = [];
  for (var i = 0; i < (all || []).length; i++) {
    var it = all[i];
    if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) continue;
    var meta = portalMeta(it.metadata[KEY_PORTAL]);
    if (meta.visible === false) invisible.push({ item: it, meta: meta });
  }
  var sigParts = [];
  for (var g = 0; g < invisible.length; g++) {
    var ii = invisible[g].item, mm = invisible[g].meta;
    sigParts.push([ii.id, ii.position.x, ii.position.y, ii.scale && ii.scale.x, mm.radius, mm.name].join(":"));
  }
  var sig = (role === "GM" ? "GM|" : "PLAYER|") + sigParts.join("|");
  if (sig === portalGhostSig) return 0;
  portalGhostSig = sig;
  try {
    var locals = await OBR.scene.local.getItems();
    var old = [];
    for (var l = 0; l < (locals || []).length; l++) {
      if (locals[l] && locals[l].metadata && locals[l].metadata[PORTAL_GHOST_TAG]) old.push(locals[l].id);
    }
    if (old.length) await OBR.scene.local.deleteItems(old);
  } catch (e0) {  }
  if (role !== "GM" || !invisible.length) return 0;
  var dpi = await portalSceneDpi();
  var ghosts = [];
  for (var k = 0; k < invisible.length; k++) {
    var itG = invisible[k].item, metaG = invisible[k].meta;
    var scale = portalScaleFor(metaG.radius, dpi);
    var ghost = buildImage(
      { width: 150, height: 150, url: PORTAL_ICON_URL, mime: "image/png" },
      { dpi: 150, offset: { x: 75, y: 75 } }
    )
      .position({ x: Number(itG.position.x) || 0, y: Number(itG.position.y) || 0 })
      .scale({ x: scale, y: scale })
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .visible(true)
      .opacity(0.45)
      .metadata({ [PORTAL_GHOST_TAG]: itG.id, "名称": "隐藏门" })
      .build();
    ghosts.push(ghost);
  }
  try {
    if (ghosts.length) await OBR.scene.local.addItems(ghosts);
  } catch (e1) { pageLog("err", "portal ghost 创建失败：" + errText(e1)); }
  pageLog("info", "portal ghost 重建 n=" + ghosts.length);
  return ghosts.length;
}

/* ---------- v2.4.35：成对创建（第二个 mode） ---------- */
var portalPairFirst = null;
var portalPairPreviewId = null;
var portalPairLineId = null;
async function portalPairClear() {
  portalPairFirst = null;
  if (portalPairPreviewId) {
    var pid = portalPairPreviewId; portalPairPreviewId = null;
    try { await OBR.scene.local.deleteItems([pid]); } catch (e) {  }
  }
  if (portalPairLineId) {
    var lid = portalPairLineId; portalPairLineId = null;
    try { await OBR.scene.local.deleteItems([lid]); } catch (e2) {  }
  }
}
async function portalPairPreview(center, to) {
  try {
    var dpi = await portalSceneDpi();
    var scale = portalScaleFor(70, dpi);
    var item = buildImage(
      { width: 150, height: 150, url: PORTAL_ICON_URL, mime: "image/png" },
      { dpi: 150, offset: { x: 75, y: 75 } }
    ).position({ x: Number(center.x) || 0, y: Number(center.y) || 0 }).scale({ x: scale, y: scale })
      .layer("ATTACHMENT").locked(true).disableHit(true).visible(true).opacity(0.6)
      .metadata({ [PORTAL_PAIR_TAG]: true }).build();
    if (!portalPairPreviewId) {
      await OBR.scene.local.addItems([item]);
      portalPairPreviewId = item.id;
    } else {
      await OBR.scene.local.updateItems([portalPairPreviewId], function (drafts) {
        for (var i = 0; i < drafts.length; i++) drafts[i].position = { x: center.x, y: center.y };
      });
    }
    if (to && typeof buildLine === "function") {
      if (!portalPairLineId) {
        var line = buildLine().position({ x: 0, y: 0 }).startPosition(center).endPosition(to)
          .strokeColor("#58c7ff").strokeOpacity(0.9).strokeWidth(4).strokeDash([18, 12])
          .layer("CONTROL").locked(true).disableHit(true).visible(true)
          .metadata({ [PORTAL_PAIR_TAG]: true }).build();
        await OBR.scene.local.addItems([line]);
        portalPairLineId = line.id;
      } else {
        await OBR.scene.local.updateItems([portalPairLineId], function (drafts) {
          for (var j = 0; j < drafts.length; j++) {
            drafts[j].startPosition = { x: center.x, y: center.y };
            drafts[j].endPosition = { x: to.x, y: to.y };
          }
        });
      }
    }
  } catch (e3) { pageLog("err", "portal pair preview 失败：" + errText(e3)); }
}
async function portalPairCreate(first, second) {
  var tag = "P-" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  pageLog("info", "portal pair create tag=" + tag + " at=" + first.x + "," + first.y + " / " + second.x + "," + second.y);
  var a = await portalCreate(first, 70, { name: "传送门 A", tag: tag });
  var b = await portalCreate(second, 70, { name: "传送门 B", tag: tag });
  await portalPairClear();
  return [a, b];
}

async function openDestinationPopover(portalId, tokenIds) {
  if (portalDestOpening || portalDestOpen) {
    pageLog("info", "portal dest skip（已开/并发）");
    return false;
  }
  portalDestOpening = true;
  try {
    /* 打开前先清同 id（以及历史旧 id）残留，避免新旧两个目的地窗叠在一起。 */
    try { await OBR.popover.close(ID_PORTAL_DEST); } catch (e0) {  }
    try { await OBR.popover.close(portalOldDestId); } catch (e0b) {  }
    await openWin("portalDest", URL_PORTAL_DEST + "?portal=" + encodeURIComponent(portalId) +
      "&tokens=" + encodeURIComponent((tokenIds || []).join(",")));
    portalDestOpen = true;
    pageLog("info", "portal dest open（锁）");
    setTimeout(function () { portalDestOpen = false; }, 10000);
    return true;
  } catch (e) {
    pageLog("err", "打开传送目的地选择失败：" + errText(e));
    return false;
  } finally {
    portalDestOpening = false;
  }
}
async function portalDetectDragEnd() {
  var role = "";
  var myId = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  try { myId = await OBR.player.getId(); } catch (e2) { myId = ""; }
  var all = [];
  try { all = await OBR.scene.items.getItems(); } catch (e3) { return; }
  try { portalLifecycleSync(all); } catch (eLife) { /* 诊断失败不影响侦测 */ }
  try { await portalScaleRadiusSync(all); } catch (eScale) { /* 缩放同步失败不影响拖动侦测 */ }
  var allPortals = portalListOf(all);
  var portals = allPortals.filter(function (p) { return p.visible !== false; });
  try { await portalGhostSync(all); } catch (eGhost) { /* ghost 失败不影响检测 */ }
  if (!portals.length) return;
  var sel = [];
  try { sel = (await OBR.player.getSelection()) || []; } catch (e4) { sel = []; }
  var tokenMap = {};
  for (var i = 0; i < all.length; i++) {
    var it = all[i];
    if (!it || (it.type !== "IMAGE" && it.type !== "MOUNT")) continue;
    if (it.metadata && it.metadata[KEY_PORTAL]) continue;
    tokenMap[it.id] = it;
  }
  var moved = [];
  for (var id in tokenMap) {
    if (!Object.prototype.hasOwnProperty.call(tokenMap, id)) continue;
    var tok = tokenMap[id];
    var pos = { x: tok.position.x, y: tok.position.y };
    var prev = portalBaseline[id];
    if (prev && Math.hypot(pos.x - prev.x, pos.y - prev.y) > 1) moved.push(tok);
    portalBaseline[id] = pos;
  }
  portalBaselineReady = true;
  var suppress = Date.now() < portalSuppressUntil;
  var candidates = [];
  for (var m = 0; m < moved.length; m++) {
    var tokM = moved[m];
    var owns = role === "GM" || (myId && tokM.createdUserId === myId) || (myId && tokM.lastModifiedUserId === myId) || sel.indexOf(tokM.id) >= 0;
    if (!owns) continue;
    if (portalWritingIds[tokM.id]) { pageLog("info", "portal skip（自己写入）token=" + tokM.id); continue; }
    var landed = portalTeleportLanded[tokM.id];
    if (landed) {
      if (Math.hypot(tokM.position.x - landed.x, tokM.position.y - landed.y) <= 1) {
        pageLog("info", "portal skip（传送落点未再变化）token=" + tokM.id);
        continue;
      }
      delete portalTeleportLanded[tokM.id]; /* 用户又拖动了 → 恢复手动触发 */
    }
    if (suppress) { pageLog("info", "portal skip（冷却）token=" + tokM.id); continue; }
    if (portalDestOpen) { pageLog("info", "portal skip（目的地窗已开）token=" + tokM.id); continue; }
    for (var p2 = 0; p2 < portals.length; p2++) {
      var pp = portals[p2];
      if (Math.hypot(tokM.position.x - pp.center.x, tokM.position.y - pp.center.y) <= pp.radius) {
        candidates.push({ id: tokM.id, portal: pp });
        break;
      }
    }
  }
  if (suppress || portalDestOpen || !candidates.length) return;
  var origin = candidates[0];
  var dests = portalDestinations(allPortals, origin.portal.itemId);
  if (!dests.length) return;
  var tokenIds = [];
  for (var s2 = 0; s2 < sel.length; s2++) if (tokenMap[sel[s2]]) tokenIds.push(sel[s2]);
  for (var c2 = 0; c2 < candidates.length; c2++) if (tokenIds.indexOf(candidates[c2].id) < 0) tokenIds.push(candidates[c2].id);
  var triggerKey = origin.portal.itemId + "|" + tokenIds.slice().sort().join(",");
  var triggerNow = Date.now();
  if (triggerKey === portalDestLastKey && triggerNow - portalDestLastAt < 500) {
    pageLog("info", "portal dest skip（500ms 内重复触发）");
    return;
  }
  portalDestLastKey = triggerKey;
  portalDestLastAt = triggerNow;
  try {
    await openDestinationPopover(origin.portal.itemId, tokenIds);
  } catch (e5) {
    portalDestOpen = false;
    pageLog("err", "打开传送目的地选择失败：" + errText(e5));
  }
}

function resetPortalDestOpen() { portalDestOpen = false; }

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

/* ---- 10. 启动：工具栏 ×4 / 右键 / 浮动按钮 / 各频道订阅 ---- */
async function boot() {
  if (booted) return;
  booted = true;
  var t0 = Date.now();

  pageLog("info", "OBR.onReady 触发；插件 v" + PLUGIN_VERSION + "；BASE=" + BASE);
  try { roomAuditLog(await OBR.room.getMetadata(), {}); } catch (eAudit) { /* 忽略 */ }
  pageLog("info", "OBR.isAvailable=" + String(OBR.isAvailable) + "；isReady=" + String(OBR.isReady));

  bootStatus.tool = await attempt("注册工具栏按钮 (OBR.tool.create ×4)", registerTools);

  bootStatus.menu = await attempt("注册右键菜单 (OBR.contextMenu.create)", registerContextMenu);

  bootStatus.scene = await sceneReady();
  bootStatus.button = await syncSceneButton();
  if (bootStatus.button) stepOk("打开右下角浮动按钮 ✓");
  else if (!bootStatus.scene) stepOk("场景还没就绪，浮动按钮等进入地图后再开");

  markStripClosed(false);
  markDiceHistClosed(false);
  markDiceClosed(false);
  await refreshInitKnownTokens();

  await syncInitFlags();
  /* v1.9.2：延迟 800ms 自动开骰子记录窗口（别和 1.5s 的静态资源预热抢）。 */
  setTimeout(function () { void maybeAutoOpenDiceHistory(); }, 800);
  setTimeout(function () { void maybeAutoOpenDice(); }, 900);

  await attempt("订阅 scene.onReadyChange", function () {
    OBR.scene.onReadyChange(function (ready) {
      void syncSceneButton();
      scheduleBars();

      void refreshInitKnownTokens();
      if (ready !== false) {
        void syncInitFlags();
        void maybeAutoOpenStrip("进入房间自动显示先攻条");
        setTimeout(function () { void maybeAutoOpenDiceHistory(); }, 800);
        setTimeout(function () { void maybeAutoOpenDice("进入房间自动打开骰子（换场景）"); }, 900);
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
  await attempt("订阅 scene.onMetadataChange（场景兜底存储）", function () {
    if (!OBR.scene || typeof OBR.scene.onMetadataChange !== "function") return;
    OBR.scene.onMetadataChange(function (meta) {
      scheduleRefresh();
      onRoomMetaChanged(meta);
      scheduleBars();
    });
  });
  await attempt("订阅 " + CH_INFO_SIZE + "（速览窗自动高度）", function () {
    OBR.broadcast.onMessage(CH_INFO_SIZE, onInfoSize);
  });
  await attempt("订阅 " + CH_INFO_DRAG + "（速览弹窗拖动）", function () {
    OBR.broadcast.onMessage(CH_INFO_DRAG, onInfoDrag);
  });
  await attempt("订阅 " + CH_DICE_ROLL + "（所有客户端后台直接开全屏动画）", function () {
    OBR.broadcast.onMessage(CH_DICE_ROLL, async function (ev) {
      var d = ev && ev.data ? ev.data : null;
      var reason = diceRollRejectReason(d);
      if (!reason && !diceRollValid(d)) reason = "invalid";
      if (reason) {
        pageLog("info", "dice roll rejected reason=" + reason);
        if (await isLocalRollSender(ev, d)) notify(reason === "too-many" ? DICE_MSG_TOO_MANY : reason === "too-big" ? DICE_MSG_TOO_BIG : "本次投掷内容无效，已忽略", "WARNING");
        return;
      }
      var client = String((ev && (ev.connectionId || ev.playerId)) || d.rollerId || "?");
      var now = Date.now();
      if (diceRollLastBy[client] && now - diceRollLastBy[client] < DICE_ROLL_MIN_MS) {
        pageLog("info", "dice roll throttled client=" + client);
        if (await isLocalRollSender(ev, d)) notify(DICE_MSG_TOO_FAST, "WARNING");
        return;
      }
      diceRollLastBy[client] = now;
      void openDiceFx(d);
    });
  });
  await attempt("订阅 " + CH_DICE_CLEAR + "（清场关闭动画）", function () {
    OBR.broadcast.onMessage(CH_DICE_CLEAR, function (ev) {
      var d = ev && ev.data ? ev.data : {};
      closeDiceFx(d);
      pageLog("info", "dice fx clear roll=" + (d.rollId || "all"));
    });
  });
  await attempt("订阅 " + CH_INIT_JOIN + "（玩家请求加入先攻）", function () {
    OBR.broadcast.onMessage(CH_INIT_JOIN, onInitJoinRequest);
  });
  await attempt("订阅 " + CH_INIT_JOIN_ACK + "（加入先攻结果）", function () {
    OBR.broadcast.onMessage(CH_INIT_JOIN_ACK, onInitJoinAck);
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

  await attempt("订阅 " + CH_WIN_RESIZE + "（窗口调整大小）", function () {
    OBR.broadcast.onMessage(CH_WIN_RESIZE, onWinResize);
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
  await attempt("订阅 " + CH_HPEDIT_LOG + "（血条编辑窗日志）", function () {
    OBR.broadcast.onMessage(CH_HPEDIT_LOG, function (ev) {
      var d = ev && ev.data !== undefined ? ev.data : ev;
      if (!d || typeof d.msg !== "string") return;
      try { console.log("[4enext][hpEdit] " + d.msg); } catch (e) { /* 忽略 */ }
    });
  });
  await attempt("订阅 " + CH_HP_REPAINT + "（血条编辑窗重绘）", function () {
    OBR.broadcast.onMessage(CH_HP_REPAINT, onHpRepaint);
  });
  await attempt("订阅 " + CH_HP_EDIT_ACK + "（血条编辑窗切换 ack）", function () {
    OBR.broadcast.onMessage(CH_HP_EDIT_ACK, onHpEditAck);
  });
  /* v1.8.9：信息窗页面 ready → 重发当前 target（防第一条 target 在 iframe 加载前丢掉）。 */
  await attempt("订阅 " + CH_INFO_READY + "（速览页 ready 握手）", function () {
    OBR.broadcast.onMessage(CH_INFO_READY, onInfoReady);
  });
  /* v1.9.0：页面刷新成功的 ack（同一 session + version ≥ pending 才清兜底计时器）。 */
  await attempt("订阅 " + CH_INFO_ACK + "（速览页刷新 ack）", function () {
    OBR.broadcast.onMessage(CH_INFO_ACK, onInfoAck);
  });
  /* v2.4.35：OBR SDK 没有 viewport.onChange → 安装 500ms 轮询重锚。
   * 视口变化时：按钮重新 open 到右下角（同 id+url），各窗口 / 先攻条用新 vp reclamp。 */
  await attempt("重建传送门 ghost（启动）", async function () {
    try {
      if (await sceneReady()) {
        var allGhost = await OBR.scene.items.getItems();
        await portalGhostSync(allGhost);
      }
    } catch (eGhostBoot) { /* 场景没准备好就等 onChange 重建 */ }
    return true;
  });
  await attempt("清理旧传送门窗口残留（boot）", function () {
    try { void OBR.popover.close(ID_PORTAL_DEST); } catch (e1) {  }
    try { void OBR.popover.close(ID_PORTAL_EDIT); } catch (e2) {  }
    try { void OBR.popover.close(portalOldDestId); } catch (e3) {  }
    pageLog("info", "portal dest 清理残留");
    return true;
  });
  await attempt("安装视口轮询重锚（500ms）", function () {
    addViewportAnchorListener(function (vp) {
      return (async function () {
        await reanchorButton(vp);
        await reclampWins(vp);
        await reclampStrip(vp);
      })();
    });
    return true;
  });

  /* v2.4.35：传送门频道 + 拖动进门侦测。 */
  await attempt("订阅 " + CH_OPEN_SETTINGS + "（浮动按钮 → 设置）", function () {
    OBR.broadcast.onMessage(CH_OPEN_SETTINGS, function () { void openWinOrNotify("settings", "右下角设置按钮"); });
  });
  await attempt("订阅 " + CH_PORTAL_SAVE + "（传送门编辑保存）", function () {
    OBR.broadcast.onMessage(CH_PORTAL_SAVE, onPortalSave);
  });
  await attempt("订阅 " + CH_PORTAL_TELEPORT + "（传送门传送）", function () {
    OBR.broadcast.onMessage(CH_PORTAL_TELEPORT, onPortalTeleport);
  });
  await attempt("订阅 scene.items.onChange（传送门拖动侦测）", function () {
    OBR.scene.items.onChange(function () { void onPortalItemsChange(); });
  });
  await attempt("清理传送门预览残留（启动）", function () {
    void portalClearPreviewResidue("boot");
    return true;
  });
  await attempt("订阅 player.onChange（GM 选中传送门自动编辑）", function () {
    OBR.player.onChange(function () { void syncPortalEditFromSelection(); });
  });
  await attempt("订阅 " + CH_PORTAL_EDIT_CLOSE + "（编辑窗用户关闭）", function () {
    OBR.broadcast.onMessage(CH_PORTAL_EDIT_CLOSE, onPortalEditClosed);
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
  var okLine = "4eNEXT to owlbear v" + PLUGIN_VERSION + " 已加载：工具栏×4 " + mark(bootStatus.tool) +
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
    roundedRectPoints: roundedRectPoints,
    shieldPoints: shieldPoints,
    circlePoints: circlePoints,
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
  window.__4ePortal = {
    version: PLUGIN_VERSION,
    portalMeta: portalMeta,
    portalDestinations: portalDestinations,
    portalHexSpiral: portalHexSpiral,
    portalPlanTeleport: portalPlanTeleport,
    portalWallSegments: portalWallSegments,
    portalPointSafe: portalPointSafe,
    portalPathSafe: portalPathSafe,
    portalSegIntersect: portalSegIntersect,
    portalTokenRadius: portalTokenRadius,
    portalSuppressed: portalSuppressed,
    onPortalTeleport: onPortalTeleport,
    syncPortalEditFromSelection: syncPortalEditFromSelection,
    withWindowVersion: withWindowVersion,
    onPortalEditClosed: onPortalEditClosed,
    portalClearPreviewResidue: portalClearPreviewResidue,
    portalLifecycleSync: portalLifecycleSync,
    portalDragBegin: portalDragBegin,
    portalDragFinish: portalDragFinish,
    portalScaleFor: portalScaleFor,
    portalImageItem: portalImageItem,
    portalGhostSync: portalGhostSync,
    portalPairCreate: portalPairCreate,
    moveTokensWithFogBypass: moveTokensWithFogBypass,
    portalFogMetaKey: portalFogMetaKey,
    portalRadiusFromScale: portalRadiusFromScale,
    portalScaleRadiusSync: portalScaleRadiusSync,
    portalDetectDragEnd: portalDetectDragEnd,
    openDestinationPopover: openDestinationPopover,
    portalTeleportLanded: function () { return portalTeleportLanded; },
    onPortalSave: onPortalSave,
    portalSceneDpi: portalSceneDpi,
    registerPortalTool: registerPortalTool,
    CONSTANTS: {
      KEY_PORTAL: KEY_PORTAL,
      PORTAL_MIN_RADIUS: PORTAL_MIN_RADIUS,
      PORTAL_WALL_PADDING: PORTAL_WALL_PADDING,
      PORTAL_SUPPRESS_MS: PORTAL_SUPPRESS_MS,
      TOOL_PORTAL_ID: TOOL_PORTAL_ID,
      TOOL_PORTAL_MODE_ID: TOOL_PORTAL_MODE_ID,
      TOOL_PORTAL_PAIR_MODE_ID: TOOL_PORTAL_PAIR_MODE_ID,
      PORTAL_PREVIEW_TAG: PORTAL_PREVIEW_TAG
    }
  };
}
