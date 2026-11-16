// 各页面共用的小工具：命名空间、房间数据读写、导入解析。
import OBR from "../vendor/obr-sdk.js";
/* v1.7.15：房间数据体积预算 + 角色卡精简（打包）格式。
 * 这两个模块的分工：cards-core.js 是**纯函数**（无 import，Node 里可直接测），
 * 这里只负责「读最新房间数据 → 算体积 → 该写就写、超了就不写并通知」。 */
import {
  ROOM_NS, ROOM_MAX_BYTES, ROOM_HARD_BYTES, ROOM_FULL_MESSAGE, CARD_MAX_BYTES, LS_CARDS,
  packCard, unpackCard, cardBytes, cardsBytes, roomBytes, mergeRoom, roomBudget
} from "./cards-core.js";
/* v1.8.0：房间数据（16 KB 硬上限）装不下时，卡片改存**当前场景的隐藏 item**（全桌可见）。
 * 为什么不是只存本机：本机副本只有城主看得到，玩家侧绑定 / 速览全是空的（v1.7.15 的真事）。 */
import { CARD_ITEM_KEY, readSceneCards, writeSceneCards, clearSceneCards } from "./cards-scene.js";

export const NS = ROOM_NS;
/* 透出给页面 / 自测用（settings-page.js 只从 common.js 取，不自己碰 OBR 房间数据）。 */
export {
  ROOM_NS, ROOM_MAX_BYTES, ROOM_HARD_BYTES, ROOM_FULL_MESSAGE, CARD_MAX_BYTES, LS_CARDS,
  packCard, unpackCard, cardBytes, cardsBytes, roomBytes, mergeRoom, roomBudget,
  CARD_ITEM_KEY, readSceneCards, writeSceneCards, clearSceneCards
};
/** 房间数据键：全房间共享的角色卡列表（无需自建服务器）。 */
export const KEY_CARDS = NS + "/cards";
/** Token（item）身上的绑定键：值为卡片 id。 */
export const KEY_BIND = NS + "/cardId";
/** Token（item）上的血量（与 track.js / background.core.js 的 KEY_HP 逐字一致）。 */
export const KEY_HP = NS + "/hp";
/** Token（item）上的血条组件开关（false = 用户显式「移除血条组件」）。 */
export const KEY_HPBAR = NS + "/hp-bar/enabled";
/** Token（item）上的先攻加值（v1.3.0）：{ bonus, cardId, updatedAt }。 */
export const KEY_INIT = NS + "/init";
/** 房间数据里的先攻状态（v1.3.0）。 */
export const KEY_INITIATIVE = NS + "/initiative";
/** 面板与弹窗的 id。 */
export const ID_BUTTON = NS + "/button";
export const ID_INFO = NS + "/info";
export const ID_PANEL = NS + "/panel";
export const ID_BIND = NS + "/bind";
/* v1.3.1：先攻 / 骰子各自独立一个 popover 窗口。
 * id 与速览（/info）、角色卡面板（/panel）都不同 → 可以同时打开、互不嵌套。 */
export const ID_INIT_WIN = NS + "/initiative-window";
/* v1.4.0：先攻条。它是**另一个 popover**（top-center 的条），id 与上面那个列表窗口不同，
 * 所以「先攻条 + 列表窗口」可以同时开着。打开 / 关闭 / 拖动都在 assets/background.core.js。 */
export const ID_STRIP = NS + "/initiative-strip";
export const ID_DICE_WIN = NS + "/dice-window";
/* v1.7.0：骰子记录从骰子窗口的右栏搬出来，变成**第二个独立 popover**（可拖动 / 记位置）。
 * id 与骰子窗口不同 → 两个窗口可以同时打开、各自开关。 */
export const ID_DICE_HIST = NS + "/dice-history-window";
/* v1.3.2：设置 / 关于窗口（与 assets/background.core.js 的 ID_SETTINGS_WIN 必须一致）。 */
export const ID_SETTINGS_WIN = NS + "/settings-window";
/* v1.7.2：血条组件编辑小窗（右键「添加血条组件」→ 填生命 / 四防 / 回复力）。
 * id 与其它窗口都不同 → 可以和速览 / 先攻条同时开着；位置按窗口名 "hpEdit" 单独记。 */
export const ID_HP_EDIT = NS + "/hp-edit";

export const PLUGIN_VERSION = "2.0.1";

/**
 * 站点根地址。
 * 不再只依赖 import.meta.url：OBR 把页面放进 iframe 时，模块的 import.meta.url 不一定是
 * 页面地址，而 location 永远是本 page 的地址（所有页面都在插件根目录，所以 "./" 就是根）。
 * 参考实现 character-cards 干脆把手写死成绝对地址；我们保留一层相对兜底。
 */
export const URL_BASE = (function () {
  try {
    const u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u;
  } catch (e) { /* 忽略，走兜底 */ }
  return new URL("../", import.meta.url);
})();
export const URL_ORIGIN = URL_BASE.href;
export const URL_PANEL = new URL("panel.html", URL_BASE).href;
export const URL_INFO = new URL("info.html", URL_BASE).href;
export const URL_BIND = new URL("bind.html", URL_BASE).href;
/* v1.3.1：先攻 / 骰子各自独立的窗口页。 */
export const URL_INITIATIVE = new URL("initiative.html", URL_BASE).href;
export const URL_DICE = new URL("dice.html", URL_BASE).href;
/* v1.7.0：骰子记录窗口（独立 popover）+ 投骰动画页（全屏 modal，透明 + 不挡鼠标）。 */
export const URL_DICE_HIST = new URL("dice-history.html", URL_BASE).href;
export const URL_EFFECT = new URL("effect.html", URL_BASE).href;
/* v1.7.2：血条组件编辑小窗页（340×150，可拖动）。 */
export const URL_HP_EDIT = new URL("hp-edit.html", URL_BASE).href;
/* v1.3.2：设置 / 关于窗口页。 */
export const URL_SETTINGS = new URL("settings.html", URL_BASE).href;
export const URL_BUTTON = new URL("button.html", URL_BASE).href;
export const URL_INDEX = new URL("index.html", URL_BASE).href;
export const URL_ICON = new URL("icon.svg", URL_BASE).href;

/** 玩家「结束我的回合」请求频道（与 background.core.js 的 CH_INIT_REQUEST 必须一致）。 */
export const CH_INIT_REQUEST = NS + "/init-request";
/** v1.8.2：先攻条点卡片时先广播这个频道，后台 1.5 秒内不自动弹速览
 *  （选中 token 的后台副作用 —— 地图高亮保留，只是别弹窗）。与 background.core.js 常量必须一致。 */
export const CH_GLANCE_SUPPRESS = NS + "/glance-suppress";
/** v1.8.9：信息窗单次挂载 —— 后台广播「当前要给谁看」的目标租约（session + version）。 */
export const CH_INFO_TARGET = NS + "/info-target";
/** v1.8.9：信息窗页面 ready 握手 —— 后台收到后重发当前 target，防第一条广播早于 iframe 加载。 */
export const CH_INFO_READY = NS + "/info-ready";
/** v1.9.0：页面刷新成功的 ack（{session, version, itemId}）—— 后台 700ms 没收到就兜底重开一次。 */
export const CH_INFO_ACK = NS + "/info-ack";

/* ---- v1.5.0：骰子（团队共享）----
 * CH_ROLL        任何人 → 全桌：一次投掷（LOCAL + REMOTE；投掷者自己也听 LOCAL）
 * CH_ROLL_CLEAR  城主清空全桌历史（玩家点了只会收到 WARNING）
 * CH_ROLL_SAVED  城主客户端写完房间数据后广播 { seq, rollId }，页面据此清掉「未落库」计时器
 * KEY_ROLLS      房间数据：{ v, updatedAt, seq, rows } —— rows 上限 20（v1.8.0；≈4 KB，给角色卡留空间）
 * 前三个频道与 KEY_ROLLS / ROLL_MAX_ROWS 与 background.core.js 里的同名常量必须一字不差
 * （后台是经典脚本，不能 import，dev/check.mjs 会逐项对比）。
 * 本机键：组合 / 上次公式 / 城主离线时的暂存。 */
export const CH_ROLL = NS + "/roll";
export const CH_ROLL_CLEAR = NS + "/roll-clear";
export const CH_ROLL_SAVED = NS + "/roll-saved";
export const KEY_ROLLS = NS + "/rolls";
/** 与 dice-core.js 的 ROLL_MAX_ROWS 相同（房间数据容量预算，规格 §1.6；v1.8.0：40 → 20）。 */
export const ROLL_MAX_ROWS = 20;
export const LS_DICE_COMBOS = "4enext/dice/combos";
export const LS_DICE_LAST = "4enext/dice/last";
export const LS_DICE_LOCAL = "4enext/dice/local";
/* v1.9.2：骰子历史改为**本机**存储（按房间隔离，与 Full Suite 一致）。
 * 结构 { v:1, rows:[...] }，最多 ROLL_MAX_ROWS 条；房间数据不再保存历史（只留旧的迁移残留）。 */
export const LS_DICE_HISTORY_PREFIX = "4enext/dice-history/";

/** 当前房间 id（用于本机历史按房间隔离）；拿不到就用 default。 */
export function diceHistoryRoomId() {
  try {
    if (typeof OBR !== "undefined" && OBR.room && typeof OBR.room.id === "string" && OBR.room.id) return OBR.room.id;
  } catch (e) { /* 忽略 */ }
  try {
    const u = new URL(location.href);
    const q = u.searchParams.get("room") || u.searchParams.get("roomId");
    if (q) return q;
  } catch (e2) { /* 忽略 */ }
  return "default";
}

export function diceHistoryKey(roomId) {
  return LS_DICE_HISTORY_PREFIX + (roomId || "default");
}

/** 读本机骰子历史（容错：坏 JSON / 非数组 / 缺 rollId 都跳过；按 ts 倒序、MAX 条）。 */
export function readDiceHistoryRows(roomId) {
  try {
    const raw = localStorage.getItem(diceHistoryKey(roomId || diceHistoryRoomId()));
    if (!raw) return [];
    const box = JSON.parse(raw);
    const src = Array.isArray(box) ? box : box && Array.isArray(box.rows) ? box.rows : [];
    const out = [];
    const seen = {};
    for (let i = 0; i < src.length; i++) {
      const r = src[i];
      if (!r || typeof r !== "object") continue;
      const id = typeof r.rollId === "string" ? r.rollId : "";
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(r);
    }
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return out.slice(0, ROLL_MAX_ROWS);
  } catch (e) {
    return [];
  }
}

export function writeDiceHistoryRows(rows, roomId) {
  const list = (rows || []).slice(0, ROLL_MAX_ROWS);
  try { localStorage.setItem(diceHistoryKey(roomId || diceHistoryRoomId()), JSON.stringify({ v: 1, rows: list })); }
  catch (e) { /* 本机也存不下就算了 */ }
  return list;
}

/** 追加一条本机历史：同 rollId 幂等、按 ts 倒序、超 20 丢最旧。返回当前列表。 */
export function appendDiceHistoryRow(row, roomId) {
  const list = readDiceHistoryRows(roomId);
  const id = row && typeof row.rollId === "string" ? row.rollId : "";
  if (!id) return list;
  for (let i = 0; i < list.length; i++) if (list[i].rollId === id) return list;
  list.push(row);
  list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return writeDiceHistoryRows(list, roomId);
}

export function clearDiceHistory(roomId) {
  try { localStorage.removeItem(diceHistoryKey(roomId || diceHistoryRoomId())); } catch (e) { /* 忽略 */ }
}

/* ---- v1.7.0：独立记录窗口 + 投骰动画 ----
 * CH_DICE_HIST_CMD   骰子窗口 → 后台：{ op: "toggle" | "open" | "close" }（记录窗口开关）
 * CH_DICE_HIST_STATE 后台 → 页面：{ open: true/false }（按钮据此显示「开 / 关」）
 * 两个频道与 ID_DICE_HIST / URL_DICE_HIST 与 background.core.js 里的同名常量必须一字不差
 * （后台是经典脚本，不能 import，dev/check.mjs 会逐项对比）。
 * LS_DICE_ANIM = 投骰动画开关（"0" 关闭，缺省 / "1" 开启）；设置窗口里改它。 */
export const CH_DICE_HIST_CMD = NS + "/dice-hist-cmd";
export const CH_DICE_HIST_STATE = NS + "/dice-hist-state";

/* ---- v1.7.2：血条组件编辑小窗（与 background.core.js 的同名常量必须一字不差）----
 * CH_HP_EDIT_TARGET 后台 → 页面：{ session, version, itemId, pending }（版本租约，规格 §2.2 简化版）
 * CH_HP_EDIT_READY  页面 → 后台：{ session }（页面加载完要一次补发 target，防丢第一条广播）
 * CH_HP_EDIT_SAVED  页面 → 后台：{ itemId, hp }（保存成功后立刻重画血条，不等 items.onChange） */
export const CH_HP_EDIT_TARGET = NS + "/hp-edit-target";
export const CH_HP_EDIT_READY = NS + "/hp-edit-ready";
export const CH_HP_EDIT_SAVED = NS + "/hp-edit-saved";
/** v2.0.1：页面切换/载入完成回 ack，后台据此判断「单窗换目标」是否成功（600ms 无 ack 兜底重开一次）。 */
export const CH_HP_EDIT_ACK = NS + "/hp-edit-ack";
/** v2.0.1：编辑窗「重绘血条」按钮 → 后台强制重算这张 token 的血条环 / 四防盾 / 资源徽记。 */
export const CH_HP_REPAINT = NS + "/hp-repaint";
export const LS_DICE_ANIM = "4enext/dice/anim";
/** 记录窗口默认只显示最近几条（其余滚 / 点「展开全部」看）。 */
export const HIST_VISIBLE_ROWS = 4;

/** 投骰动画是否开启（默认开）。localStorage 不可用时也当「开」，不影响投掷。 */
export function readDiceAnim() {
  try { return localStorage.getItem(LS_DICE_ANIM) !== "0"; } catch (e) { return true; }
}
/** 写动画开关（设置窗口用；失败只影响记忆，不影响投掷）。 */
export function writeDiceAnim(on) {
  try { localStorage.setItem(LS_DICE_ANIM, on ? "1" : "0"); return true; } catch (e) { return false; }
}

/* ---- v1.4.0：先攻条（top-center 的条）----
 * STRIP_POS_KEY  只记「相对屏幕中线的偏移」{ v:1, dx, dy }，不记绝对 left（换屏幕 / 缩放后仍然贴顶居中）
 * CH_STRIP_DRAG  页面 → 后台：拖动先攻条（start / move / end / reset）
 * CH_STRIP_CMD   页面 → 后台：折叠 / 列表 / 尺寸同步等命令
 * 三个名字与 assets/background.core.js 里的同名常量必须一字不差。 */
export const STRIP_POS_KEY = "4enext/strip-pos";
export const CH_STRIP_DRAG = NS + "/strip-drag";
export const CH_STRIP_CMD = NS + "/strip-cmd";
/** 先攻条拖动时 pointermove 的节流间隔（毫秒）。 */
export const STRIP_DRAG_THROTTLE_MS = 33;

/* ---- v1.7.3：先攻条常驻（本机设置；与 background.core.js 的 STRIP_AUTOSTART_KEY /
 * STRIP_CLOSED_KEY 必须一字不差）----
 *   LS_STRIP_AUTOSTART  "0" = 进入房间不自动显示；缺省 / "1" = 自动显示（**默认开**）
 *   LS_STRIP_CLOSED     会话级「本次已经手动关掉」标记（条上的 ✕ 写它，重新打开时清掉）
 * 设置窗口（settings.html 的「先攻」栏）只调这里的读写函数，**不自己碰 localStorage**
 * （dev/check.mjs 断言这一页没有直接写本机存储）。 */
export const LS_STRIP_AUTOSTART = "4enext/strip-autostart";
export const LS_STRIP_CLOSED = "4enext/strip-closed-this-session";

/** 进入房间要不要自动显示先攻条（默认开；localStorage 不可用时也当开）。 */
export function readStripAutostart() {
  try { return localStorage.getItem(LS_STRIP_AUTOSTART) !== "0"; } catch (e) { return true; }
}
/** 写自动显示开关（设置窗口用；写失败只影响记忆，不影响打开条）。 */
export function writeStripAutostart(on) {
  try { localStorage.setItem(LS_STRIP_AUTOSTART, on ? "1" : "0"); return true; } catch (e) { return false; }
}

/* v1.9.2：骰子记录窗口「进入房间自动打开」本机偏好（默认开）+ 会话级「本次 ✕ 关过」标记。 */
export const LS_DICE_HIST_AUTOSTART = "4enext/dice-hist-autostart";
export const LS_DICE_HIST_CLOSED = "4enext/dice-hist-closed";

export function readDiceHistAutostart() {
  try { return localStorage.getItem(LS_DICE_HIST_AUTOSTART) !== "0"; } catch (e) { return true; }
}

export function writeDiceHistAutostart(on) {
  try { localStorage.setItem(LS_DICE_HIST_AUTOSTART, on ? "1" : "0"); return true; } catch (e) { return false; }
}

/** 后台心跳频道（与 assets/background.core.js 里的常量必须一致）。 */
export const CH_HELLO = NS + "/diag-hello"; // 后台 → 页面：我起来了
export const CH_PING = NS + "/diag-ping";   // 页面 → 后台：在吗
export const CH_PONG = NS + "/diag-pong";   // 后台 → 页面：在，状态如下

/* ---- v1.2.2：速览弹窗拖动 ---- */
/** 弹窗位置记忆的 localStorage 键（值是 { v:1, pos: { <tokenId>: {left,top} } }）。 */
export const INFO_POS_KEY = "4enext/info-pos";
/** 弹窗拖动的 broadcast 频道（与 assets/background.core.js 的 CH_INFO_DRAG 必须一致）。 */
export const CH_INFO_DRAG = NS + "/info-drag";
/** 拖动区 pointermove 的节流间隔（毫秒）：越小越跟手，越大越省。 */
export const INFO_DRAG_THROTTLE_MS = 33;

/* ---- v1.3.1：独立窗口（先攻 / 骰子 / 角色卡面板）的拖动与位置记忆 ----
 * 与速览弹窗的区别：速览按 token 记位置（INFO_POS_KEY），这三个窗口各记一份（WIN_POS_KEY）。
 * 频道与键名与 assets/background.core.js 里的同名常量必须一字不差。 */
export const WIN_POS_KEY = "4enext/win-pos";
export const CH_WIN_DRAG = NS + "/win-drag";
export const WIN_DRAG_THROTTLE_MS = 33;
/* v1.7.10：窗口 ✕ 的双保险频道（页面先 OBR.popover.close(自己的 id)，再发 {op:"close-win", name}）。
 * 后台按名字再关一次，并补 modal.close —— panel 退化成全屏 modal 时只 popover.close 关不掉。
 * 与 assets/background.core.js 的 CH_WIN_CLOSE 必须一字不差。 */
export const CH_WIN_CLOSE = NS + "/win-close";

/**
 * 自检：问后台「在吗」。
 * 拿不到回应 = background.html 没跑起来（右键菜单和右下角按钮就会一起缺失）。
 * 返回后台自报的状态对象，或 null（带原因说明由调用方决定）。
 */
export function pingBackground(timeoutMs) {
  return new Promise(function (resolve) {
    let done = false;
    const offs = [];
    let timer = null;
    const finish = function (value) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      for (const off of offs) {
        try { if (typeof off === "function") off(); } catch (e) { /* ignore */ }
      }
      resolve(value);
    };
    const onMsg = function (ev) {
      const data = ev && ev.data !== undefined ? ev.data : ev;
      finish({ source: "event", data: data });
    };
    try {
      offs.push(OBR.broadcast.onMessage(CH_PONG, onMsg));
      offs.push(OBR.broadcast.onMessage(CH_HELLO, onMsg));
      timer = setTimeout(function () { finish(null); }, timeoutMs || 1600);
      OBR.broadcast.sendMessage(CH_PING, { at: Date.now(), from: location.href }, { destination: "LOCAL" })
        .catch(function () { /* 拿不到就等超时 */ });
    } catch (e) {
      finish(null);
    }
  });
}

// 房间数据越小越稳：立绘（原图 / 裁切图）一律不进房间数据，速览也用不到它。
export const MAX_PORTRAIT = 0;

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/** 等 OBR 就绪再干活；页面被直接打开（不在枭熊里）时 1.5 秒后兜底执行一次。 */
export function onReady(cb) {
  let done = false;
  const run = function () {
    if (done) return;
    done = true;
    try {
      cb();
    } catch (e) {
      console.error("[4enext] 初始化失败", e);
    }
  };
  try {
    OBR.onReady(run);
  } catch (e) {
    run();
    return;
  }
  setTimeout(run, 1500);
}

/**
 * 通知中心一条（v1.7.8：**只发 ERROR / WARNING**）。
 * 用户反馈「这种提示太多了，不要吧」→ 成功 / 普通提示一律不弹；断线、写盘失败、窗打不开、
 * 锁定这类错误照旧弹。传别的 variant（或干脆不传）只写一条控制台日志，不再打扰全桌。
 */
export function notify(msg, variant) {
  if (variant !== "ERROR" && variant !== "WARNING") {
    try { console.log("[4enext]", msg); } catch (e) { /* 忽略 */ }
    return null;
  }
  try {
    return OBR.notification.show(msg, variant);
  } catch (e) {
    console.log("[4enext]", msg);
    return null;
  }
}

export function hashId(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/* ---------------------------------------------------------------------------
 * v1.7.15：房间数据预算（room metadata 上限 16 kB）
 * ---------------------------------------------------------------------------
 * 真机报错：Unable to update metadata: over size limit of 16 kB。
 * 根因是角色卡整份 JSON 塞进房间数据。现在：
 *   · 写任何房间键之前都先 getMetadata → 把「这份键」合进去 → 算 JSON 体积；
 *   · 超过 ROOM_MAX_BYTES（14 KB，留 2 KB 余量）就**不写**，由调用方决定怎么降级；
 *   · 角色卡超限时改存本机 localStorage（LS_CARDS），并弹 **ERROR**（不静默）。
 * ------------------------------------------------------------------------- */

function msgOf(e) {
  return e && e.message ? e.message : String(e);
}

async function readRoomMeta() {
  try {
    const meta = await OBR.room.getMetadata();
    return meta && typeof meta === "object" ? meta : {};
  } catch (e) {
    console.error("[4enext] 读取房间数据失败", e);
    return {};
  }
}

/**
 * 受预算保护的房间数据写入。
 * 返回 { ok, reason, bytes, error }：reason = "full"（超预算，**没写**）/ "error"（OBR 拒写）。
 * 调用方拿到 !ok 必须做降级 + 通知，不允许静默。
 */
export async function writeRoomKey(key, value) {
  const meta = await readRoomMeta();
  const patch = {};
  patch[key] = value;
  const budget = roomBudget(meta, patch);
  if (!budget.ok) return { ok: false, reason: "full", bytes: budget.bytes, max: budget.max };
  try {
    await OBR.room.setMetadata(patch);
    return { ok: true, reason: "", bytes: budget.bytes, max: budget.max };
  } catch (e) {
    return { ok: false, reason: "error", bytes: budget.bytes, max: budget.max, error: e };
  }
}

/** 本机兜底的角色卡列表（房间数据装不下时的那一份）：{ cards, updatedAt } | null。 */
function readLocalCards() {
  try {
    const raw = localStorage.getItem(LS_CARDS);
    if (!raw) return null;
    const box = JSON.parse(raw);
    if (box && Array.isArray(box.cards)) {
      return { cards: box.cards, updatedAt: typeof box.updatedAt === "number" ? box.updatedAt : 0 };
    }
  } catch (e) {
    console.error("[4enext] 读取本机角色卡失败", e);
  }
  return null;
}

function saveLocalCards(cards) {
  try {
    localStorage.setItem(LS_CARDS, JSON.stringify({ v: 1, updatedAt: Date.now(), cards: cards }));
    return true;
  } catch (e) {
    console.error("[4enext] 本机角色卡也存不下", e);
    return false;
  }
}

/** 清掉本机兜底副本（房间数据写得进去之后调）。 */
export function clearLocalCards() {
  try { localStorage.removeItem(LS_CARDS); } catch (e) { /* 忽略 */ }
}

function hydrateCard(card) {
  if (!card || typeof card !== "object") return card;
  /* 房间 / 本机里存的是精简格式；读出来还原成 4E NEXT 的 Character 形状，
   * 这样 glance.js / track.js / initiative.js 一行都不用改。 */
  return Object.assign({}, card, { char: unpackCard(card.char) });
}

/**
 * 读角色卡（v1.8.0 双写）：房间数据里是**精简名单副本**（跨场景 / 玩家可见 / 用于绑定），
 * 当前场景的隐藏 item 里是**完整卡**（不精简、字段不丢）。两份按卡 id 取并集：
 * 返回 { cards, scope: "room"|"scene"|"local", bytes }。
 */
export async function getCardsInfo() {
  const meta = await readRoomMeta();
  const box = meta[KEY_CARDS];
  const bytes = roomBytes(meta);
  const local = readLocalCards();
  const roomCards = box && Array.isArray(box.cards) ? box.cards : null;
  const roomAt = box && typeof box.updatedAt === "number" ? box.updatedAt : 0;
  const scene = await readSceneCards();
  const sceneById = new Map(scene.map(function (c) { return [c.id, c]; }));
  const localNewer = !!local && local.updatedAt > roomAt;
  const localById = new Map((localNewer ? local.cards : []).map(function (c) { return [c.id, c]; }));
  /* v1.8.0（F1 修复）：房间列表和场景 item 是**同一批卡的两层副本**（房间=精简名单，场景=完整数据）。
   * 以前是「房间非空就只用房间」，结果房间名单过期时新导入、只写进场景的卡会被挡住
   * （真机表现：刷新后新卡消失、绑定它的 token 误弹血条编辑窗）。现在按 id 取并集：
   *   同 id 优先用场景里的完整卡 → 没有就用本机较新的副本 → 再没有就用房间里的精简副本；
   *   场景里独有的新卡一律追加。 */
  const merged = [];
  const seen = new Set();
  const push = function (card) {
    if (!card || !card.id || seen.has(card.id)) return;
    seen.add(card.id);
    merged.push(card);
  };
  for (const w of (roomCards || [])) {
    if (!w || !w.id) continue;
    const full = sceneById.get(w.id);
    if (full) { push(full); continue; }
    if (localNewer && localById.has(w.id)) { push(hydrateCard(localById.get(w.id))); continue; }
    push(hydrateCard(w));
  }
  if (!roomCards && local) for (const c of local.cards) push(hydrateCard(c));
  if (localNewer) for (const c of local.cards) push(hydrateCard(c));
  for (const c of scene) push(c);
  let scope = "room";
  if (roomCards && roomCards.length) scope = "room";
  else if (scene.length) scope = "scene";
  else if (local && local.cards.length) scope = "local";
  return { cards: merged, scope: scope, bytes: bytes, roomCards: roomCards ? roomCards.length : 0, sceneCards: scene.length };
}

/** 读房间里的全部角色卡（按导入顺序）。 */
export async function getCards() {
  return (await getCardsInfo()).cards;
}

/**
 * 写角色卡列表（导入 / 删除卡都走这里）。
 * v1.8.0 起**双写**：
 *   · 当前场景的隐藏 item ← **完整数据**（只去立绘；场景 item 没有 16 KB 总额限制，任何字段都不丢）；
 *   · 房间数据 ← **精简名单副本**（packCard 短键，够速览用；换场景 / 玩家侧仍能看到这些卡并绑定 token）；
 *   两边都写不进（玩家身份 + 房间只读）→ 本机副本 + **ERROR** 通知（最后一道兜底，不静默）。
 * 返回 { payload, scope: "room"|"scene"|"local", fullInScene, bytes, saved?, error? }。
 */
export async function writeCards(cards) {
  const list = cards || [];
  const wire = list.map(function (c) {
    return Object.assign({}, c, { char: packCard(c && c.char) });
  });
  const payload = { v: 1, updatedAt: Date.now(), cards: wire };
  const scene = await writeSceneCards(list);
  const room = await writeRoomKey(KEY_CARDS, payload);
  if (scene.ok || room.ok) {
    clearLocalCards();
    return {
      payload: payload,
      /* scope 说明这份卡片列表的「主来源」：房间写得进就是全桌名单（跨场景可见），否则是本场景。 */
      scope: room.ok ? "room" : "scene",
      fullInScene: !!scene.ok,
      bytes: room.bytes
    };
  }
  const saved = saveLocalCards(wire);
  if (room.reason === "full") {
    notify(ROOM_FULL_MESSAGE, "ERROR");
  } else {
    notify("角色卡没能写进房间数据（" + msgOf(room.error) + "）：" +
      (saved ? "已改为只记在这台机器上（房间数据通常只有城主能写）" : "本机也存不下，这次导入没有保存"), "ERROR");
  }
  return { payload: payload, scope: "local", fullInScene: false, bytes: room.bytes, saved: saved, error: room.error || null };
}

/** 设置窗口用：看一眼房间数据现在多满 / 有几张卡 / 几条骰子记录 / 几条先攻。 */
export async function getRoomUsage() {
  const meta = await readRoomMeta();
  const cardsBox = meta[KEY_CARDS];
  const initBox = meta[KEY_INITIATIVE];
  const local = readLocalCards();
  const roomCards = cardsBox && Array.isArray(cardsBox.cards) ? cardsBox.cards : null;
  let sceneCards = [];
  try { sceneCards = await readSceneCards(); } catch (e) { sceneCards = []; }
  /* 卡片张数 = 房间名单 ∪ 场景 item ∪ 本机副本的并集（同一张卡只算一次）。 */
  const ids = new Set();
  for (const c of (roomCards || [])) if (c && c.id) ids.add(c.id);
  for (const c of sceneCards) if (c && c.id) ids.add(c.id);
  for (const c of (local ? local.cards : [])) if (c && c.id) ids.add(c.id);
  let cardScope = "room";
  if (roomCards && roomCards.length) cardScope = "room";
  else if (sceneCards.length) cardScope = "scene";
  else if (local && local.cards.length) cardScope = "local";
  return {
    bytes: roomBytes(meta),
    max: ROOM_MAX_BYTES,
    hard: ROOM_HARD_BYTES,
    cards: ids.size,
    roomCards: roomCards ? roomCards.length : 0,
    sceneCards: sceneCards.length,
    localCards: local ? local.cards.length : 0,
    cardScope: cardScope,
    rows: readDiceHistoryRows().length,
    entries: initBox && Array.isArray(initBox.entries) ? initBox.entries.length : 0
  };
}

/** 清空骰子历史（v1.9.2 起：清**本机**历史；GM 顺带清房间里的旧残留）。
 *  只减不增，所以**不需要**体积预算检查。 */
export async function clearRoomRolls() {
  clearDiceHistory();
  try {
    const meta = await readRoomMeta();
    const box = meta[KEY_ROLLS];
    if (box && Array.isArray(box.rows) && box.rows.length) {
      const seq = typeof box.seq === "number" && isFinite(box.seq) ? Math.round(box.seq) : 0;
      await OBR.room.setMetadata({ [KEY_ROLLS]: { v: 1, updatedAt: Date.now(), seq: seq + 1, rows: [] } });
    }
  } catch (e) {
    notify("清理房间里的旧骰子记录失败：" + msgOf(e) + "（不影响本机记录）", "WARNING");
  }
  return { ok: true };
}

/** 清空角色卡（房间数据里的那一份 + 场景兜底副本 + 本机副本）。同理只减不增，不做预算检查。 */
export async function clearRoomCards() {
  let ok = true;
  try {
    await OBR.room.setMetadata({ [KEY_CARDS]: { v: 1, updatedAt: Date.now(), cards: [] } });
  } catch (e) {
    ok = false;
    notify("清空角色卡失败：" + msgOf(e) + "（房间数据通常只有城主能改）", "ERROR");
  }
  try { await clearSceneCards(); } catch (e) { /* 场景里本来就没有 */ }
  clearLocalCards();
  return { ok: ok };
}

export function findCard(cards, id) {
  if (!id) return null;
  for (const c of cards) if (c.id === id) return c;
  return null;
}

/** 精简角色数据：去掉立绘原图与过大的裁切图，控制房间数据体积。 */
export function compactChar(char) {
  const copy = JSON.parse(JSON.stringify(char || {}));
  delete copy.portraitOriginal;
  if (MAX_PORTRAIT <= 0 || String(copy.portraitCropped || "").length > MAX_PORTRAIT) delete copy.portraitCropped;
  return copy;
}

/**
 * 解析 4E NEXT 导出文件（v1.8.0）。
 * 支持：单角色「导出存档」（pages.character）、全量「导出全部数据」（data 里 SavedCard[]，
 * 一次导入多张卡，含私设资源包）、以及旧行为兼容的裸 Character / {character} / 数组。
 * 解析逻辑集中在 assets/import4e.js（纯函数，Node 可测），这里只做动态 import + 取 imports。
 *
 * 为什么用动态 import：common.js 会被多个页面和 Node 自测（test-track / test-cards /
 * test-initiative）复制加载，静态 import 会让这些自测多拷一个模块；而解析只在真正导入时发生。
 * 返回 { char, exportedAt, id?, name? } 数组（id/name 只有全量备份里的 SavedCard 才有）。
 */
export async function parseExport(text) {
  /* ?v= 缓存破坏：与页面脚本同一套约定（版本变了必须重新取模块，否则玩家会吃到旧缓存）。 */
  const mod = await import("./import4e.js?v=" + encodeURIComponent(PLUGIN_VERSION));
  return mod.parse4eFile(text).imports;
}

/** 同 parseExport，但保留完整解析结果（format / homebrew），给面板做「导入了几张 / 含私设」提示用。 */
export async function parseExportFile(text) {
  const mod = await import("./import4e.js?v=" + encodeURIComponent(PLUGIN_VERSION));
  return mod.parse4eFile(text);
}

/**
 * 把解析结果合并进现有卡片列表：同名卡就地更新（绑定关系不丢），新卡追加。
 * 全量备份里的 SavedCard 自带稳定 id（4E NEXT 的卡片 id），没有撞车就沿用；
 * 单角色导出没有 id，沿用旧逻辑按名字 + 时间生成（导入同一张卡走「同名更新」分支，旧 id 保留）。
 */
export function mergeImports(cards, imports) {
  const next = cards.slice();
  let added = 0;
  let updated = 0;
  for (const imp of imports) {
    const char = compactChar(imp.char);
    const name = String(char.name || imp.name || "").trim() || "未命名角色";
    char.name = name;
    const idx = next.findIndex((c) => String(c.name).trim() === name);
    if (idx >= 0) {
      next[idx] = Object.assign({}, next[idx], {
        name: name,
        level: char.level || 1,
        char: char,
        updatedAt: Date.now(),
        exportedAt: imp.exportedAt || next[idx].exportedAt || ""
      });
      updated++;
    } else {
      const given = typeof imp.id === "string" ? imp.id.trim() : "";
      const id = given && !next.some((c) => c.id === given) ? given : "c-" + hashId(name + "|" + Date.now());
      next.push({
        id: id,
        name: name,
        level: char.level || 1,
        char: char,
        importedAt: Date.now(),
        exportedAt: imp.exportedAt || ""
      });
      added++;
    }
  }
  return { cards: next, added: added, updated: updated };
}

/** 读取示例卡（samples/sample-card.json），用于空面板一键体验。 */
export async function loadSample() {
  const res = await fetch(new URL("samples/sample-card.json", URL_BASE).href);
  if (!res.ok) throw new Error("示例卡加载失败（HTTP " + res.status + "）");
  return await res.json();
}

/** 卡里算出来的四防 [{key,value}] → token 字段 { ac, fort, reflex, will }（与 track.js 的换算一致）。 */
function defensesFromDerived(list) {
  const map = { ac: "ac", fort: "fort", ref: "reflex", reflex: "reflex", will: "will" };
  const out = {};
  let any = false;
  const take = (k, v) => {
    const key = map[String(k)];
    if (!key) return;
    if (typeof v === "number" && isFinite(v)) { out[key] = Math.max(0, Math.round(v)); any = true; }
  };
  if (Array.isArray(list)) {
    for (const row of list) if (row && typeof row === "object") take(row.key, row.value);
  } else if (list && typeof list === "object") {
    for (const k of Object.keys(list)) take(k, list[k]);
  }
  return any ? out : null;
}

/**
 * 把卡片 id 写到 token 的 metadata 上；cardId 为空表示解绑。
 * v1.3.0：同时写 com.4enext-owlbear/init = { bonus, cardId, updatedAt }，
 * 先攻加值取自角色卡的「先攻」（与速览 / 面板共用 glance.js 的 initiativeBonus）。
 * v1.8.4：顺带把卡里的 HP / 回复力 / 四防**播种**到 token（只补缺，不覆盖已有血量）——
 *   修复「绑了卡、速览能开，但地图上 token 没有血条环」；用户显式移除过血条组件的 token 不播种。
 */
export async function bindToken(itemId, cardId) {
  let init = null;
  let seed = null;
  if (cardId) {
    let bonus = 0;
    try {
      const card = findCard(await getCards(), cardId);
      /* 动态 import：common.js 也被右下角 64×64 浮动按钮加载，静态拉进
       * glance.js + data/rules.js（约 190KB）只为算一个先攻加值不划算。 */
      if (card) {
        const glance = await import("./glance.js");
        bonus = glance.initiativeBonus(card.char);
        const d = glance.deriveGlance(card.char);
        const hpMax = d && typeof d.hpMax === "number" && isFinite(d.hpMax) && d.hpMax > 0 ? Math.round(d.hpMax) : null;
        if (hpMax) {
          seed = {
            hpMax: hpMax,
            surgesMax: d && typeof d.surgesMax === "number" && isFinite(d.surgesMax) && d.surgesMax > 0
              ? Math.round(d.surgesMax) : null,
            defenses: defensesFromDerived(d && d.defenses)
          };
        }
      }
    } catch (e) {
      console.error("[4enext] 读取先攻加值失败，按 +0 处理", e);
    }
    init = { bonus: bonus, cardId: cardId, updatedAt: Date.now() };
  }
  await OBR.scene.items.updateItems([itemId], function (items) {
    for (const it of items) {
      if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
      if (cardId) it.metadata[KEY_BIND] = cardId;
      else delete it.metadata[KEY_BIND];
      if (init) it.metadata[KEY_INIT] = init;
      else delete it.metadata[KEY_INIT];
      /* v1.8.4（与 Full Suite 一致）：**卡数据优先** —— 绑卡即用卡的血量覆盖 token 的
       * 当前 / 上限 / 回复力 / 四防（cur = max = 卡上限，surges = surgesMax）。
       * 只保留 token 自己的 temp（临时生命）与 locked（玩家端锁定）；其它 hp 字段（如 legacy boss）原样带过。
       * 同时删除 hp-bar/enabled（回到默认开启）→ 绑卡后血条立刻出现（即使之前显式移除过组件）。
       * 先攻加值仍照旧写 KEY_INIT；以上都在同一个 updateItems 里原子写。 */
      if (cardId) delete it.metadata[KEY_HPBAR];
      if (cardId && seed) {
        const prev = it.metadata[KEY_HP] && typeof it.metadata[KEY_HP] === "object" ? it.metadata[KEY_HP] : {};
        const max = seed.hpMax;
        const out = Object.assign({}, prev);
        out.cur = max;
        out.max = max;
        out.temp = typeof prev.temp === "number" && isFinite(prev.temp) && prev.temp > 0 ? Math.round(prev.temp) : 0;
        out.surges = seed.surgesMax;
        if (seed.surgesMax != null) out.surgesMax = seed.surgesMax;
        else delete out.surgesMax;
        if (seed.defenses) out.defenses = seed.defenses;
        else delete out.defenses;
        out.locked = prev.locked !== false;
        it.metadata[KEY_HP] = out;
      }
    }
  });
}

/** 四防比较（缺字段 = 0）：用于回推时避免元数据抖动。 */
function sameDefenses(a, b) {
  const keys = ["ac", "fort", "reflex", "will"];
  const na = a && typeof a === "object" ? a : {};
  const nb = b && typeof b === "object" ? b : {};
  for (const k of keys) {
    if (Math.round(Number(na[k]) || 0) !== Math.round(Number(nb[k]) || 0)) return false;
  }
  return true;
}

/**
 * v1.8.4（照 Full Suite propagateCardRefresh）：面板导入 / 更新卡片成功后，把新卡数据回推到
 * 所有绑定该卡的 token —— 只更新 **max / surgesMax / defenses / 先攻加值**，
 * **cur / temp / locked 一律保留**（保留当前 HP，Full Suite 明确 preserve CURRENT HP）。
 * 与现有值相同就不写（避免元数据抖动）；只 GM 执行；失败只 console.warn，不影响导入。
 * 返回实际更新过的 token 数。
 */
export async function propagateCardStats(cards, updatedIds) {
  let role = "";
  try { role = await OBR.player.getRole(); } catch (e) { return 0; }
  if (role !== "GM") return 0;
  const ids = Array.isArray(updatedIds) ? updatedIds.filter(Boolean) : [];
  if (!ids.length) return 0;
  const byId = {};
  for (const c of cards || []) if (c && c.id) byId[c.id] = c;
  const stats = {};
  try {
    const glance = await import("./glance.js");
    for (const id of ids) {
      const c = byId[id];
      if (!c || !c.char) continue;
      const d = glance.deriveGlance(c.char);
      if (!d) continue;
      stats[id] = {
        hpMax: typeof d.hpMax === "number" && isFinite(d.hpMax) && d.hpMax > 0 ? Math.round(d.hpMax) : null,
        surgesMax: typeof d.surgesMax === "number" && isFinite(d.surgesMax) && d.surgesMax > 0 ? Math.round(d.surgesMax) : null,
        defenses: defensesFromDerived(d.defenses),
        bonus: glance.initiativeBonus(c.char)
      };
    }
  } catch (e) {
    console.warn("[4enext] 回推卡片统计失败（跳过）", e);
    return 0;
  }
  if (!Object.keys(stats).length) return 0;
  let items = [];
  try { items = await OBR.scene.items.getItems(); } catch (e) {
    console.warn("[4enext] 回推卡片统计：读场景 token 失败（跳过）", e);
    return 0;
  }
  const plan = [];
  for (const it of items || []) {
    if (!it || !it.metadata) continue;
    const bind = it.metadata[KEY_BIND];
    const st = typeof bind === "string" ? stats[bind] : null;
    if (!st) continue;
    const prevHp = it.metadata[KEY_HP] && typeof it.metadata[KEY_HP] === "object" ? it.metadata[KEY_HP] : {};
    const hpChanged =
      (st.hpMax != null && prevHp.max !== st.hpMax) ||
      (st.surgesMax != null && prevHp.surgesMax !== st.surgesMax) ||
      (!!st.defenses && !sameDefenses(prevHp.defenses, st.defenses));
    const prevInit = it.metadata[KEY_INIT] && typeof it.metadata[KEY_INIT] === "object" ? it.metadata[KEY_INIT] : null;
    const initChanged = !prevInit || prevInit.bonus !== st.bonus || prevInit.cardId !== bind;
    if (!hpChanged && !initChanged) continue;
    plan.push({ id: it.id, st: st, hpChanged: hpChanged, initChanged: initChanged, bind: bind });
  }
  if (!plan.length) return 0;
  const byItem = {};
  for (const p of plan) byItem[p.id] = p;
  await OBR.scene.items.updateItems(plan.map(function (p) { return p.id; }), function (drafts) {
    for (const it of drafts) {
      const p = byItem[it.id];
      if (!p) continue;
      if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
      if (p.hpChanged) {
        const prev = it.metadata[KEY_HP] && typeof it.metadata[KEY_HP] === "object" ? it.metadata[KEY_HP] : {};
        const out = Object.assign({}, prev);
        if (p.st.hpMax != null) out.max = p.st.hpMax;
        if (p.st.surgesMax != null) out.surgesMax = p.st.surgesMax;
        if (p.st.defenses) out.defenses = p.st.defenses;
        it.metadata[KEY_HP] = out;
      }
      if (p.initChanged) {
        it.metadata[KEY_INIT] = { bonus: p.st.bonus, cardId: p.bind, updatedAt: Date.now() };
      }
    }
  });
  return plan.length;
}

/**
 * v2.0.1：把「卡片基础四防 + 速览临时四防」合并成 token 该有的 defenses。
 * base 用 token 侧键名（ac/fort/reflex/will）；defTemp 用 track state 键名（ac/fort/ref/reflex/will）。
 * 只覆盖 base 里存在的项（卡片没有的项 = 不返回 → 调用方保留 token 原值）；round + clamp 到 ≥0。
 * syncDefTempToTokens（写 token）与 track.syncTokenStats（比较是否回写）**必须共用这一套**，
 * 否则会出现「临时值写进去 → 速览刷新又按基础值写回」的抖动（v2.0.1 bug）。
 */
export function combineDefenses(base, defTemp) {
  /* 只用 track state 的键名（ac / fort / ref / will）逐项取临时值；base 侧键名是 ac/fort/reflex/will。
   * 注意不能同时遍历 ref 与 reflex（会互相覆盖），reflex 仅作为 dt.ref 缺省时的兼容回退。 */
  const pairs = [["ac", "ac"], ["fort", "fort"], ["ref", "reflex"], ["will", "will"]];
  const src = base && typeof base === "object" ? base : null;
  if (!src) return null;
  const dt = defTemp && typeof defTemp === "object" ? defTemp : {};
  const out = {};
  let any = false;
  for (const [srcKey, dstKey] of pairs) {
    if (typeof src[dstKey] !== "number" || !isFinite(src[dstKey])) continue;
    let raw = dt[srcKey];
    if (srcKey === "ref" && (typeof raw !== "number" || !isFinite(raw)) && typeof dt.reflex === "number" && isFinite(dt.reflex)) {
      raw = dt.reflex;
    }
    const add = typeof raw === "number" && isFinite(raw) ? Math.round(raw) : 0;
    out[dstKey] = Math.max(0, Math.round(src[dstKey]) + add);
    any = true;
  }
  return any ? out : null;
}

/**
 * v2.0.1：速览「四防临时加值」→ 绑定该卡 token 的 hp.defenses（单向联动，地图血条只显示）。
 * 目标值 = 卡片基础四防 + defTemp（只覆盖卡片有值的项；卡片没有的项保持 token 原值）。
 * 保留 cur / max / temp / locked / surges；值没变不写；无权限（非 GM 且非创建者）的 token 跳过；
 * 写失败静默（血条下次重算）。
 * 注意：手动在血条编辑窗改的四防，会被下一次临时加值联动覆盖（绑卡本来就会覆盖四防，已知取舍）。
 * defTemp 用 track.js 的键名（ac/fort/ref/will），合并规则见 combineDefenses()。
 */
export async function syncDefTempToTokens(cardId, defTemp) {
  if (!cardId) return 0;
  let card = null;
  try { card = findCard(await getCards(), cardId); } catch (e) { return 0; }
  if (!card || !card.char) return 0;
  let base = null;
  try {
    const glance = await import("./glance.js");
    const d = glance.deriveGlance(card.char);
    base = defensesFromDerived(d && d.defenses);
  } catch (e2) {
    return 0;
  }
  if (!base) return 0;
  const combined = combineDefenses(base, defTemp);
  if (!combined) return 0;
  let role = "";
  let pid = "";
  try { role = await OBR.player.getRole(); } catch (e3) { role = ""; }
  try { pid = await OBR.player.getId(); } catch (e4) { pid = ""; }
  let items = [];
  try { items = await OBR.scene.items.getItems(); } catch (e5) { return 0; }
  const plan = [];
  for (const it of items || []) {
    if (!it || !it.metadata || it.metadata[KEY_BIND] !== cardId) continue;
    if (role !== "GM" && !(pid && it.createdUserId === pid)) continue;
    const prevHp = it.metadata[KEY_HP] && typeof it.metadata[KEY_HP] === "object" ? it.metadata[KEY_HP] : {};
    /* 先保留 token 已有项，再用「卡片项 + 临时值」覆盖 → 卡片没有的项保持原值。 */
    const out = Object.assign({}, prevHp.defenses && typeof prevHp.defenses === "object" ? prevHp.defenses : {}, combined);
    if (sameDefenses(prevHp.defenses, out)) continue;
    plan.push({ id: it.id, defenses: out });
  }
  if (!plan.length) return 0;
  const byItem = {};
  for (const p of plan) byItem[p.id] = p;
  try {
    await OBR.scene.items.updateItems(plan.map(function (p) { return p.id; }), function (drafts) {
      for (const it of drafts) {
        const p = byItem[it.id];
        if (!p) continue;
        if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
        const prev = it.metadata[KEY_HP] && typeof it.metadata[KEY_HP] === "object" ? it.metadata[KEY_HP] : {};
        /* 只改 defenses，其余 hp 字段原样保留（cur/max/temp/locked/surges）。 */
        it.metadata[KEY_HP] = Object.assign({}, prev, { defenses: p.defenses });
      }
    });
  } catch (e6) {
    return 0; /* 写失败静默：血条下次会重算 */
  }
  return plan.length;
}

export async function getItemBinding(itemId) {
  try {
    const items = await OBR.scene.items.getItems([itemId]);
    const m = items[0] && items[0].metadata ? items[0].metadata[KEY_BIND] : null;
    return typeof m === "string" ? m : null;
  } catch (e) {
    return null;
  }
}

/** 当前选中的单个 IMAGE token（绑定按钮用）。 */
export async function selectedImageToken() {
  try {
    const sel = await OBR.player.getSelection();
    if (!sel || sel.length !== 1) return null;
    const items = await OBR.scene.items.getItems([sel[0]]);
    const it = items[0];
    if (!it) return null;
    return it.type === "IMAGE" ? it : null;
  } catch (e) {
    return null;
  }
}

/** 页面标题栏里的小提示：数据来源、只读说明。 */
export function fmtTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch (e) {
    return "";
  }
}