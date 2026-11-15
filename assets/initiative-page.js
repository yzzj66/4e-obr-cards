// v1.4.0：先攻条（默认视图）与列表窗口（?view=list）的页面脚本。
// ---------------------------------------------------------------------------
// 先攻条（initiative.html，popover id = common.js 的 ID_STRIP）：
//   · 折叠 120×40 小药丸 / 展开 720×(129|139|159)，高度随 phase 三档（规格 §3.1）；
//     **v1.6.2：宽高是常量**（applySize 不量 DOM）；内容变化只重绘卡片，不再改 popover 尺寸；
//   · 控制行：战斗准备 / 突袭 / 一键清空（二次确认）、准备态「开始战斗 / 取消」、
//     战斗态「上一回合 / 下一回合 / 结束战斗」；
//   · 横向卡片：56×80 头像卡，当前回合 100 高，左上加值、底部合计 + 公式行 (d20+加值)；
//   · 拖拽排序（GM）：中点法写 init / tb（规格 §7.3），再按「合计 DESC → tb ASC」重排；
//   · 玩家：只看到公开条目；当前是隐形单位时显示「？？？」；「结束」只发广播、不写数据。
// 列表窗口（?view=list，popover id = ID_INIT_WIN）：v1.3.x 的管理视图，重掷全部 / 同步加值 /
//   上下移 / 删除 / 清空都在这里；先攻条上的「≡」打开它。
// 数据读写全部在 assets/initiative.js（与自测共用同一份）；窗口壳在 assets/window.js。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_HELLO, CH_INIT_REQUEST, CH_STRIP_CMD, CH_STRIP_DRAG, ID_INIT_WIN, ID_STRIP,
  STRIP_DRAG_THROTTLE_MS, getCards, onReady, pingBackground
} from "./common.js";
import { createWindow, feedback, closeSelf } from "./window.js";
import {
  INIT_MAX_ENTRIES, LS_STRIP_COLLAPSED, advanceInitiative, bonusOfItem, clearInitiative,
  currentEntry, endCombat, moveEntry, normalizeInitiative, readInitiative, removeEntry, renderInitiativeHTML,
  renderStripHTML, reorderEntry, rerollAll, rerollEntry, setActiveEntry, startCombat,
  startPreparation, startSurprise, stripSizeFor, syncInitBonuses, tokenInfoMap, writeInitiative
} from "./initiative.js";

const params = new URLSearchParams(location.search);
/** list = 列表窗口；strip = 先攻条（默认） */
const VIEW = params.get("view") === "list" ? "list" : "strip";

const stripRoot = document.getElementById("strip-root");
const bodyEl = document.getElementById("init-body");
const shellEl = document.getElementById("win-shell");

/** 窗口壳只在列表视图里建（先攻条没有标题栏，拖动走自己的 CH_STRIP_DRAG）。 */
const win = VIEW === "list" ? createWindow({ name: "initiative" }) : null;

let initiative = normalizeInitiative(null);
let myRole = "PLAYER";
let playerId = "";
/** tokenId → { img, hp, name }（头像 / 血条）；先攻条用，拿不到就退回名字首字。 */
let itemsMap = {};
let collapsed = readCollapsed();
let busy = false;
let bgReady = false;
/** 一键清空的二次确认（规格 §P1：二次确认，4 秒内有效）。 */
let confirmClear = false;
let confirmTimer = 0;
/** 拖拽排序时不要触发「点卡片」。 */
let suppressClick = false;
let lastActiveId = "";
let lastSize = { w: 0, h: 0 };
/** 「只记在本机」的提示只弹一次，别每次房间数据变化都刷屏。 */
let localWarned = false;

function msgOf(e) {
  return e && e.message ? e.message : String(e);
}

function readCollapsed() {
  try { return localStorage.getItem(LS_STRIP_COLLAPSED) === "1"; } catch (e) { return false; }
}

function writeCollapsed(v) {
  try { localStorage.setItem(LS_STRIP_COLLAPSED, v ? "1" : "0"); } catch (e) { /* 隐私模式：忽略 */ }
}

function nameOf(tokenId) {
  const hit = initiative.entries.filter(function (e) { return e.tokenId === tokenId; })[0];
  return hit ? hit.name : "?";
}

function sendCmd(cmd) {
  try {
    const p = OBR.broadcast.sendMessage(CH_STRIP_CMD, Object.assign({ at: Date.now() }, cmd), { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就算了 */ });
  } catch (e) { /* 不在枭熊里、直接打开本页时会走到这 */ }
}

function sendDrag(phase, dx, dy) {
  try {
    const p = OBR.broadcast.sendMessage(CH_STRIP_DRAG, { phase: phase, dx: dx, dy: dy, at: Date.now() }, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 忽略 */ });
  } catch (e) { /* 忽略 */ }
}

function online() {
  return VIEW === "list" ? !!(win && win.isOnline()) : bgReady;
}

/* ---------------- 渲染 ---------------- */

function render() {
  if (VIEW === "list") {
    if (!bodyEl) return;
    try {
      bodyEl.innerHTML = renderInitiativeHTML(initiative, {
        role: myRole,
        playerId: playerId,
        backgroundReady: win.state === "ok",
        backgroundState: win.state,
        inWindow: true
      });
    } catch (e) {
      bodyEl.innerHTML = '<div class="init-empty">渲染失败：' + msgOf(e) + "</div>";
    }
    win.refreshGates();
    return;
  }

  if (!stripRoot) return;
  const oldList = stripRoot.querySelector(".strip-items");
  const keepScroll = oldList ? oldList.scrollLeft : 0;
  try {
    stripRoot.innerHTML = renderStripHTML(initiative, {
      role: myRole,
      playerId: playerId,
      collapsed: collapsed,
      confirmClear: confirmClear,
      items: itemsMap,
      offline: !bgReady
    });
  } catch (e) {
    stripRoot.innerHTML = '<div class="strip-error">渲染失败：' + msgOf(e) + "</div>";
    return;
  }
  const list = stripRoot.querySelector(".strip-items");
  if (list) list.scrollLeft = keepScroll;
  if (initiative.activeId !== lastActiveId) {
    lastActiveId = initiative.activeId;
    scrollActiveIntoView();
  }
  requestAnimationFrame(function () { void applySize(); });
}

function scrollActiveIntoView() {
  const el = stripRoot ? stripRoot.querySelector(".initiative-item.active") : null;
  if (!el || typeof el.scrollIntoView !== "function") return;
  try { el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" }); } catch (e) { /* 老浏览器 */ }
}

/**
 * 改窗口尺寸（v1.6.2：**不再量内容**）。
 *
 * v1.6.1 及以前这里会取 .strip-ctl 的 scrollWidth 当「内容宽度」→ 投骰后点数 / 名字 / 状态文字
 * 一变长一缩短，整条就跟着变宽变窄（用户截图的 bug）。现在宽高全是常量：
 * 折叠 120×40 / 展开 720（仅视口太窄时缩）×(129|139|159)，内容再长由卡片区内部横向滚动。
 * 下面的 lastSize 判等也保证「内容变化 → 尺寸没变 → 不调 setWidth / setHeight」。
 */
async function applySize() {
  if (VIEW !== "strip" || !stripRoot) return;
  let vw = 0;
  try { vw = await OBR.viewport.getWidth(); } catch (e) { vw = 0; }
  const phase = collapsed ? "idle" : initiative.phase;
  const size = stripSizeFor(phase, collapsed, vw);
  if (size.width === lastSize.w && size.height === lastSize.h) return;
  lastSize = { w: size.width, h: size.height };
  try {
    if (OBR.popover && typeof OBR.popover.setWidth === "function") await OBR.popover.setWidth(ID_STRIP, size.width);
    if (OBR.popover && typeof OBR.popover.setHeight === "function") await OBR.popover.setHeight(ID_STRIP, size.height);
  } catch (e) { /* 不是 popover（比如直接打开本页）时忽略 */ }
  /* 把实际尺寸告诉后台：拖动 / 视口变化重新夹紧时要按这个尺寸算。 */
  sendCmd({ op: "size", width: size.width, height: size.height });
}

/* ---------------- 数据 ---------------- */

async function loadItems() {
  try {
    const items = await OBR.scene.items.getItems();
    itemsMap = tokenInfoMap(items);
  } catch (e) {
    itemsMap = {};
  }
}

async function loadInit(withItems) {
  try { myRole = await OBR.player.getRole(); } catch (e) { myRole = "PLAYER"; }
  try { playerId = (await OBR.player.getId()) || ""; } catch (e) { playerId = ""; }
  try {
    initiative = await readInitiative();
    if (initiative.local && !localWarned) {
      localWarned = true;
      feedback("先攻目前只记在本机（房间数据写不进去，通常是超过 60 条或城主没有写权限）", "WARNING");
    }
  } catch (e) {
    feedback("读取先攻失败：" + msgOf(e), "ERROR");
  }
  if (withItems) await loadItems();
  render();
}

let reloadTimer = null;
function scheduleReload() {
  if (reloadTimer) return;
  reloadTimer = setTimeout(function () {
    reloadTimer = null;
    if (busy) { scheduleReload(); return; }
    void loadInit(true);
  }, 120);
}

/** 写先攻：成功 / 失败都要有回音（不允许静默）。写失败会自动降级到本机并带 .local 标记。 */
async function saveInit(next, message) {
  if (busy) return;
  busy = true;
  try {
    const written = await writeInitiative(next);
    initiative = written;
    render();
    if (written.local) {
      feedback("先攻没能写进房间数据：已暂存在本机（先攻最多 " + INIT_MAX_ENTRIES + " 条）", "WARNING");
    } else if (message) {
      feedback(message, "SUCCESS");
    }
  } catch (e) {
    console.error("[4enext] 写先攻失败", e);
    feedback("写不进房间数据：先攻通常只有城主能改（" + msgOf(e) + "）", "ERROR");
  } finally {
    busy = false;
  }
}

/* ---------------- 先攻条：操作 ---------------- */

/** 一键清空的二次确认（第一次只预备，4 秒内再点才真清）。 */
function armClear() {
  if (!confirmClear) {
    confirmClear = true;
    render();
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(function () {
      confirmTimer = 0;
      confirmClear = false;
      render();
    }, 4000);
    feedback("再点一次「再点一次清空」才会清空（4 秒内有效）", "WARNING");
    return true;
  }
  confirmClear = false;
  if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = 0; }
  return false;
}

async function onStripAct(act, tokenId) {
  if (!act) return;
  if (act === "expand") { collapsed = false; writeCollapsed(false); render(); return; }
  if (act === "collapse") { collapsed = true; writeCollapsed(true); render(); return; }
  if (act === "list") { sendCmd({ op: "list" }); return; }
  if (act === "end") { await requestEndTurn(); return; }
  if (myRole !== "GM") {
    feedback("只有城主能操作先攻列表", "WARNING");
    return;
  }
  if (act === "prepare") return saveInit(startPreparation(initiative), "进入战斗准备：大家掷先攻");
  if (act === "surprise") return saveInit(startSurprise(initiative), "突袭轮开始（4E 突袭轮）");
  if (act === "start") return saveInit(startCombat(initiative), "战斗开始");
  if (act === "cancel") return saveInit(endCombat(initiative), "已取消准备，名单保留");
  if (act === "end-combat") return saveInit(endCombat(initiative), "战斗结束，名单保留");
  if (act === "prev") return saveInit(advanceInitiative(initiative, -1), "已回到上一回合");
  if (act === "next") {
    const before = initiative;
    const next = advanceInitiative(initiative, 1);
    const who = currentEntry(next);
    let msg = "已推进到下一回合";
    if (next.round !== before.round) msg = "第 " + next.round + " 轮开始";
    else if (next.surprise !== before.surprise) msg = "突袭轮结束，第 1 轮开始";
    if (who) msg += "：" + who.name;
    return saveInit(next, msg);
  }
  if (act === "clear") {
    if (armClear()) return;
    return saveInit(clearInitiative(), "先攻已清空（token 与角色卡都不受影响）");
  }
  if (act === "active") {
    if (!tokenId) return;
    return saveInit(setActiveEntry(initiative, tokenId), "当前回合：「" + nameOf(tokenId) + "」");
  }
  feedback("未知操作：" + act, "WARNING");
}

/** 掷先攻（GM）：卡片下方的三个按钮（劣势 / 普通 / 优势）。 */
async function onRoll(mode, tokenId) {
  if (myRole !== "GM") {
    feedback("掷先攻需要城主权限（房间数据只有城主能写）", "WARNING");
    return;
  }
  const entry = initiative.entries.filter(function (e) { return e.tokenId === tokenId; })[0];
  if (!entry) {
    feedback("这枚 token 已经不在先攻列表里了", "WARNING");
    return;
  }
  const next = rerollEntry(initiative, tokenId, undefined, mode);
  const rolled = next.entries.filter(function (e) { return e.tokenId === tokenId; })[0];
  const label = mode === "adv" ? "优势" : mode === "dis" ? "劣势" : "";
  return saveInit(next, "「" + entry.name + "」" + label + "掷出 " + (rolled ? Math.round(rolled.init) : "?") +
    (rolled && rolled.d20 !== null ? "（d20 " + rolled.d20 + signed(rolled.bonus) + "）" : ""));
}

function signed(v) {
  const x = typeof v === "number" && isFinite(v) ? Math.round(v) : 0;
  return x >= 0 ? "+" + x : String(x);
}

async function onCardClick(tokenId) {
  if (!tokenId || suppressClick) return;
  if (myRole === "GM" && initiative.phase === "combat") {
    await saveInit(setActiveEntry(initiative, tokenId), "当前回合：「" + nameOf(tokenId) + "」");
    return;
  }
  /* 非战斗 / 玩家：把选中切到这枚 token（速览会跟着弹出，等于「聚焦」）。 */
  try { await OBR.player.select([tokenId], true); } catch (e) { /* 忽略 */ }
}

/** 玩家「结束我的回合」：只发广播，**不写房间数据**（规格 §5）。 */
async function requestEndTurn() {
  const active = currentEntry(initiative);
  if (!active) {
    feedback("先攻列表还是空的：让城主把你加入先攻", "WARNING");
    return;
  }
  if (!playerId || active.ownerId !== playerId) {
    feedback("现在不是你的回合", "WARNING");
    return;
  }
  if (initiative.phase !== "combat") {
    feedback("现在不在战斗回合里（等城主开始战斗）", "WARNING");
    return;
  }
  if (!online()) {
    feedback("后台未连接：结束回合的请求要由城主客户端的后台落笔，先点列表窗口顶部的「后台未连接，点这里重试」", "WARNING");
    return;
  }
  try {
    await OBR.broadcast.sendMessage(CH_INIT_REQUEST, {
      op: "end-turn",
      playerId: playerId,
      activeId: initiative.activeId,
      round: initiative.round,
      at: Date.now()
    }, { destination: "ALL" });
    feedback("已请求结束回合，等待城主客户端推进", "INFO");
  } catch (e) {
    feedback("发送结束回合请求失败：" + msgOf(e), "ERROR");
  }
}

/* ---------------- 先攻条：拖拽排序（规格 §7.3） ---------------- */

let sortDrag = null;
let dropMark = null;

function itemsEl() {
  return stripRoot ? stripRoot.querySelector(".strip-items") : null;
}

/** 指针在「去掉被拖这张之后」的第几个位置（0..n）。 */
function slotAt(clientX) {
  const list = itemsEl();
  if (!list || !sortDrag) return 0;
  const cards = Array.prototype.slice.call(list.querySelectorAll(".initiative-item[data-token]"))
    .filter(function (c) { return c.getAttribute("data-token") !== sortDrag.tokenId; });
  let k = 0;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (clientX > r.left + r.width / 2) k++;
  }
  return k;
}

function showDropMark(k) {
  const list = itemsEl();
  if (!list) return;
  if (!dropMark) {
    dropMark = document.createElement("div");
    dropMark.className = "drop-mark";
  }
  if (dropMark.parentNode !== list) list.appendChild(dropMark);
  const cards = Array.prototype.slice.call(list.querySelectorAll(".initiative-item[data-token]"))
    .filter(function (c) { return c.getAttribute("data-token") !== sortDrag.tokenId; });
  let x = 2;
  if (k <= 0) x = cards.length ? cards[0].offsetLeft - 3 : 2;
  else if (k >= cards.length) x = cards.length ? cards[cards.length - 1].offsetLeft + cards[cards.length - 1].offsetWidth + 1 : 2;
  else x = cards[k].offsetLeft - 3;
  dropMark.style.left = Math.max(0, x) + "px";
}

function onSortDown(ev) {
  if (VIEW !== "strip" || myRole !== "GM" || collapsed) return;
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  const t = ev.target;
  if (!t || !t.closest) return;
  if (t.closest("button, input, .roll-buttons, .end-turn-btn, [data-strip-drag]")) return;
  const card = t.closest(".initiative-item[data-token]");
  if (!card) return;
  /* 这里**不要** preventDefault：它会吞掉随后的 click（点卡片设为当前就用不了了）。
     拖动时不会选中文字，靠 CSS 的 user-select: none 与 touch-action: none。 */
  sortDrag = {
    id: ev.pointerId, tokenId: card.getAttribute("data-token"),
    x0: ev.screenX, y0: ev.screenY, moved: false, slot: 0, card: card
  };
  window.addEventListener("pointermove", onSortMove);
  window.addEventListener("pointerup", onSortUp);
  window.addEventListener("pointercancel", onSortUp);
}

function onSortMove(ev) {
  if (!sortDrag || ev.pointerId !== sortDrag.id) return;
  const dx = ev.screenX - sortDrag.x0;
  const dy = ev.screenY - sortDrag.y0;
  if (!sortDrag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return; /* 4px 死区（规格 §11 第 6 条） */
  sortDrag.moved = true;
  if (sortDrag.card) sortDrag.card.classList.add("dragging");
  document.body.classList.add("sorting");
  sortDrag.slot = slotAt(ev.clientX);
  showDropMark(sortDrag.slot);
}

function onSortUp() {
  window.removeEventListener("pointermove", onSortMove);
  window.removeEventListener("pointerup", onSortUp);
  window.removeEventListener("pointercancel", onSortUp);
  const d = sortDrag;
  sortDrag = null;
  document.body.classList.remove("sorting");
  if (dropMark && dropMark.parentNode) dropMark.parentNode.removeChild(dropMark);
  dropMark = null;
  if (!d) return;
  if (d.card) d.card.classList.remove("dragging");
  if (!d.moved) return; /* 没动 → 交给 click 当成「点卡片」 */
  suppressClick = true;
  setTimeout(function () { suppressClick = false; }, 60);
  const next = reorderEntry(initiative, d.tokenId, d.slot);
  void saveInit(next, "已调整「" + nameOf(d.tokenId) + "」的顺序");
}

/* ---------------- 先攻条：整条拖走（只发位移，后台换算 / 夹紧 / 落盘） ---------------- */

let barDrag = null;

function onBarDown(ev) {
  if (VIEW !== "strip") return;
  const t = ev.target;
  if (!t || !t.closest || !t.closest("[data-strip-drag]")) return;
  ev.preventDefault();
  ev.stopPropagation();
  barDrag = { id: ev.pointerId, x0: ev.screenX, y0: ev.screenY, dx: 0, dy: 0, timer: 0 };
  sendDrag("start", 0, 0);
  window.addEventListener("pointermove", onBarMove);
  window.addEventListener("pointerup", onBarUp);
  window.addEventListener("pointercancel", onBarUp);
  document.body.classList.add("dragging");
}

function onBarMove(ev) {
  if (!barDrag || ev.pointerId !== barDrag.id) return;
  barDrag.dx = ev.screenX - barDrag.x0;
  barDrag.dy = ev.screenY - barDrag.y0;
  if (barDrag.timer) return; /* 节流：发的永远是最新位移 */
  barDrag.timer = setTimeout(function () {
    if (!barDrag) return;
    barDrag.timer = 0;
    sendDrag("move", Math.round(barDrag.dx), Math.round(barDrag.dy));
  }, STRIP_DRAG_THROTTLE_MS);
}

function onBarUp() {
  window.removeEventListener("pointermove", onBarMove);
  window.removeEventListener("pointerup", onBarUp);
  window.removeEventListener("pointercancel", onBarUp);
  document.body.classList.remove("dragging");
  if (!barDrag) return;
  const d = barDrag;
  barDrag = null;
  if (d.timer) clearTimeout(d.timer);
  sendDrag("end", Math.round(d.dx), Math.round(d.dy));
}

/** 滚轮 → 横向滚动（卡片多了要能滚，规格 §P2.4）。 */
function onStripWheel(ev) {
  const list = itemsEl();
  if (!list || !ev.target || !ev.target.closest || !ev.target.closest(".strip-items")) return;
  if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
    ev.preventDefault();
    list.scrollLeft += ev.deltaY;
  }
}

/* ---------------- 先攻条：事件委托 ---------------- */

function onStripClick(ev) {
  const t = ev.target;
  if (!t || !t.closest) return;
  const actEl = t.closest("[data-strip-act]");
  if (actEl) {
    ev.preventDefault();
    ev.stopPropagation();
    void onStripAct(actEl.getAttribute("data-strip-act"), actEl.getAttribute("data-token"));
    return;
  }
  const rollEl = t.closest("[data-roll]");
  if (rollEl) {
    ev.preventDefault();
    ev.stopPropagation();
    void onRoll(rollEl.getAttribute("data-roll"), rollEl.getAttribute("data-token"));
    return;
  }
  const card = t.closest(".initiative-item[data-token]");
  if (card) void onCardClick(card.getAttribute("data-token"));
}

/* ---------------- 列表窗口（v1.3.x 的管理视图） ---------------- */

let initSynced = false;

async function syncInit(announce) {
  if (myRole !== "GM") return;
  let list = await getCards();
  try {
    const count = await syncInitBonuses(list);
    let items = [];
    try { items = await OBR.scene.items.getItems(); } catch (e) { items = []; }
    const byId = {};
    for (const it of items) byId[it.id] = it;
    let changed = false;
    const next = JSON.parse(JSON.stringify(initiative));
    for (const e of next.entries) {
      const it = byId[e.tokenId];
      if (!it) continue;
      const b = bonusOfItem(it, list);
      if (b !== e.bonus) { e.bonus = b; changed = true; }
    }
    if (changed) await saveInit(next, "");
    if (announce) {
      if (changed || count) feedback("已同步先攻加值（" + (changed ? "更新了列表里的加值" : "补写 " + count + " 枚 token") + "）", "SUCCESS");
      else feedback("先攻加值已是最新", "INFO");
    }
  } catch (e) {
    feedback("同步先攻加值失败：" + msgOf(e), "ERROR");
  }
}

function entryOf(tokenId) {
  return initiative.entries.filter(function (e) { return e.tokenId === tokenId; })[0] || null;
}

async function onListAction(act, tokenId) {
  if (!act) return;
  if (act === "end") {
    win.guard("结束我的回合", requestEndTurn);
    return;
  }
  if (myRole !== "GM") {
    feedback("只有城主能操作先攻列表", "WARNING");
    return;
  }
  if (act === "next") return saveInit(advanceInitiative(initiative, 1), "已推进到下一回合");
  if (act === "prev") return saveInit(advanceInitiative(initiative, -1), "已回到上一回合");
  if (act === "roll-all") return saveInit(rerollAll(initiative), "所有人都重新掷了先攻");
  if (act === "sync") return syncInit(true);
  if (act === "clear") {
    if (!window.confirm("清空先攻？token 与角色卡都不受影响，只是把先攻名单清掉。")) {
      feedback("已取消：先攻没有变化", "INFO");
      return;
    }
    return saveInit(clearInitiative(), "先攻已清空");
  }
  const entry = entryOf(tokenId);
  if (!entry) {
    feedback("这枚 token 已经不在先攻列表里了", "WARNING");
    return;
  }
  if (act === "roll") {
    const next = rerollEntry(initiative, tokenId);
    const rolled = next.entries.filter(function (e) { return e.tokenId === tokenId; })[0];
    return saveInit(next, "「" + entry.name + "」掷出 " + (rolled ? Math.round(rolled.init) : "?"));
  }
  if (act === "up") return saveInit(moveEntry(initiative, tokenId, -1));
  if (act === "down") return saveInit(moveEntry(initiative, tokenId, 1));
  if (act === "active") return saveInit(setActiveEntry(initiative, tokenId), "当前回合：「" + entry.name + "」");
  if (act === "remove") {
    if (!window.confirm("把「" + entry.name + "」从先攻里移除？")) {
      feedback("已取消：先攻列表没有变化", "INFO");
      return;
    }
    return saveInit(removeEntry(initiative, tokenId), "已从先攻移除");
  }
  feedback("未知操作：" + act, "WARNING");
}

/* ---------------- 启动 ---------------- */

async function checkBg() {
  try {
    const res = await pingBackground(1600);
    bgReady = !!res;
  } catch (e) {
    bgReady = false;
  }
  render();
}

if (VIEW === "strip") {
  document.body.classList.remove("win-page");
  document.body.classList.add("strip-page");
  if (shellEl) shellEl.hidden = true;
  if (stripRoot) stripRoot.hidden = false;
  if (stripRoot) {
    stripRoot.addEventListener("click", onStripClick);
    stripRoot.addEventListener("pointerdown", onBarDown);
    stripRoot.addEventListener("pointerdown", onSortDown);
    stripRoot.addEventListener("wheel", onStripWheel, { passive: false });
    stripRoot.addEventListener("dblclick", function (ev) {
      const t = ev.target;
      if (t && t.closest && t.closest("[data-strip-drag]")) { sendDrag("reset", 0, 0); feedback("先攻条已回到顶部中间", "INFO"); }
    });
  }
} else {
  document.body.classList.add("win-page");
  document.body.classList.remove("strip-page");
  if (stripRoot) stripRoot.hidden = true;
  if (shellEl) shellEl.hidden = false;
  if (bodyEl) {
    bodyEl.addEventListener("click", function (ev) {
      const el = ev.target && ev.target.closest ? ev.target.closest("[data-init-act]") : null;
      if (!el) return;
      ev.preventDefault();
      void onListAction(el.getAttribute("data-init-act"), el.getAttribute("data-token"));
    });
  }
  const closeEl = document.getElementById("close");
  if (closeEl) closeEl.addEventListener("click", function () { closeSelf(ID_INIT_WIN); });
  win.onStatus(function () { render(); });
}

onReady(function () {
  try {
    OBR.room.onMetadataChange(scheduleReload);
    OBR.scene.items.onChange(scheduleReload);
    OBR.player.onChange(scheduleReload);
  } catch (e) {
    console.error(e);
  }
  if (VIEW === "strip") {
    try {
      OBR.broadcast.onMessage(CH_HELLO, function () {
        if (!bgReady) { bgReady = true; render(); }
      });
    } catch (e) { /* 忽略 */ }
    void checkBg();
    void loadInit(true);
    return;
  }
  void loadInit(false).then(async function () {
    if (myRole === "GM" && !initSynced) {
      initSynced = true;
      await syncInit(false);
    }
  }, function (e) {
    feedback("读取先攻失败：" + msgOf(e), "ERROR");
  });
});
