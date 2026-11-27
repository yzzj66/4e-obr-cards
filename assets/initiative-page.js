// v1.4.0：先攻条（默认视图）与列表窗口（?view=list）的页面脚本。
// ---------------------------------------------------------------------------
// 先攻条（initiative.html，popover id = common.js 的 ID_STRIP）：
//   · 折叠 120×40 小药丸 / 展开 720×(170|180|200)，高度随 phase 三档（v1.7.10 加高）；
//     **v1.6.2：宽高是常量**（applySize 不量 DOM）；v1.7.11 回退 popover：页面报尺寸，后台重开换尺寸；
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
  CH_GLANCE_SUPPRESS, CH_HELLO, CH_INIT_REQUEST, CH_STRIP_CMD, CH_STRIP_DRAG, ID_INIT_WIN, ID_STRIP,
  STRIP_DRAG_THROTTLE_MS, getCards, onReady, pingBackground
} from "./common.js";
import { createWindow, feedback, closeSelf, safeInit } from "./window.js";
import {
  INIT_MAX_ENTRIES, LS_STRIP_COLLAPSED, advanceInitiative, bonusOfItem, canEditBonus, clearInitiative,
  currentEntry, endCombat, moveEntry, normalizeInitiative, readInitiative, removeEntry, renderInitiativeHTML,
  renderStripHTML, reorderEntry, rerollAll, rerollEntry, setActiveEntry, setEntryBonus, setEntryRoll,
  startCombat, startPreparation, startSurprise, stripSizeFor, syncInitBonuses, tokenInfoMap,
  writeInitiative
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
/** v1.8.0：写房间是异步的，用**串行队列**代替旧的「busy 时直接 return」——快速连点
 * 「下一回合 / 上一回合」不会再被静默丢掉一次。job 是状态或 (当前 state) → 新 state 的函数。 */
const saveQueue = [];
let saveRunning = false;
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

/* ---------------------------------------------------------------------------
 * v1.7.11：先攻条**回退 popover**（background.core.js 的 stripPopoverOptions）。
 *   v1.7.10 的 modal + disablePointerEvents 让整个 modal 层不接收指针 → 右键「加入先攻」、
 *   加值输入框、卡片下的 d20 全都点不动；popover 是独立 iframe、只占条本身，一定可交互。
 *   · 宽高仍走 initiative.js 的 stripSizeFor（720 / 120×40 / 170|180|200）；
 *   · 页面只把尺寸报给后台（{op:"size"}），后台用**同一个 popover id** 重新 open 换尺寸；
 *   · 位置 / 拖动由宿主负责：页面发 CH_STRIP_DRAG（纯指针位移），后台加起点偏移、夹紧后重开；
 *   · 页面铺满 iframe（100%），不再写 left/top。
 * ------------------------------------------------------------------------- */
let lastVp = { w: 0, h: 0 };

/** 页面只负责铺满 iframe；位置与尺寸都由宿主 popover 决定。 */
function layoutStrip() {
  if (!stripRoot) return;
  const el = stripRoot.querySelector(".strip");
  if (!el) return;
  el.style.width = "100%";
  el.style.height = "100%";
}

/**
 * 改条尺寸（v1.6.2：**不量内容**；v1.7.11：把尺寸报给后台，后台重开 popover 换尺寸）。
 *
 * 宽高全是常量：折叠 120×40 / 展开 720（仅视口太窄时缩）×(170|180|200)，
 * 内容再长由卡片区内部横向滚动。lastSize 判等保证「内容变化 → 尺寸没变 → 不重开窗口」。
 */
async function applySize() {
  if (VIEW !== "strip" || !stripRoot) return;
  let vw = 0, vh = 0;
  try { vw = await OBR.viewport.getWidth(); } catch (e) { vw = 0; }
  try { vh = await OBR.viewport.getHeight(); } catch (e) { vh = 0; }
  lastVp = { w: vw, h: vh };
  const phase = collapsed ? "idle" : initiative.phase;
  const size = stripSizeFor(phase, collapsed, vw);
  lastSize = { w: size.width, h: size.height };
  layoutStrip();
  /* 高度随 phase 变（170 / 180 / 200）时，后台会按这个尺寸重开同一个 popover。 */
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
      feedback("先攻目前只记在本机（房间数据写不进去，通常是超过 " + INIT_MAX_ENTRIES + " 条或城主没有写权限）", "WARNING");
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
    if (saveRunning) { scheduleReload(); return; }
    void loadInit(true);
  }, 120);
}

/**
 * 写先攻：**只有失败 / 降级到本机才出声**（不允许静默）。写失败会自动降级并带 .local 标记。
 * v1.7.8：成功不再弹通知（条上的卡片 / 回合数当场就变了），第二个参数 message 只留作
 * 调用方的语义说明，不再进通知中心 —— 这样 40 多个调用点都不用改。
 *
 * v1.8.0：**串行队列**。旧版在 busy=true 时直接 return，快速连点「下一回合」会少推进一次
 * 且没有任何提示。现在每次请求都排队（不丢点击），前一次写完再执行下一次；
 * job 传函数时会在**轮到它执行时**基于刚写回的 initiative 计算 → 连点 3 次真的推进 3 次。
 * 写失败发 ERROR 通知；返回的 Promise 在**该次请求**处理完（成功或失败）后 resolve。
 */
function saveInit(next, message) {
  void message; /* v1.7.8：成功类提示已不再弹（见上） */
  return new Promise(function (resolve) {
    saveQueue.push({ job: next, done: resolve });
    void pumpSaveQueue();
  });
}

/** 队列消费者：一次只跑一个写请求，跑完立刻接着跑队列里的下一个（串行、不丢）。 */
async function pumpSaveQueue() {
  if (saveRunning) return;
  saveRunning = true;
  try {
    while (saveQueue.length) {
      const item = saveQueue.shift();
      try {
        const next = typeof item.job === "function" ? item.job(initiative) : item.job;
        const written = await writeInitiative(next);
        initiative = written;
        render();
        if (written.local) {
          feedback("先攻没能写进房间数据：已暂存在本机（先攻最多 " + INIT_MAX_ENTRIES + " 条）", "WARNING");
        }
      } catch (e) {
        console.error("[4enext] 写先攻失败", e);
        feedback("写不进房间数据：先攻通常只有城主能改（" + msgOf(e) + "）", "ERROR");
      } finally {
        item.done();
      }
    }
  } finally {
    saveRunning = false;
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
  /* 「—」只是折叠成 120×40 的小药丸：popover 仍开着，所以折叠态同样常驻。 */
  if (act === "collapse") { collapsed = true; writeCollapsed(true); render(); return; }
  if (act === "list") { sendCmd({ op: "list" }); return; }
  /* v1.7.3：右上角「✕」= 真正关闭（后台记「本次会话已关」，之后进房间不再自动弹）。 */
  if (act === "close") {
    sendCmd({ op: "close" });
    /* v1.7.8：「先攻条已关闭」不再弹（条当场消失就是反馈，要再开点工具栏「先攻」）。 */
    return;
  }
  if (act === "end") { await requestEndTurn(); return; }
  if (myRole !== "GM") {
    feedback("只有城主能操作先攻列表", "WARNING");
    return;
  }
  /* v1.7.3：卡片上的 ✕ —— 直接把这枚 token 移出先攻（不弹确认，点错了重新加入即可）。 */
  if (act === "remove") {
    if (!tokenId) return;
    const entry = entryOf(tokenId);
    if (!entry) {
      feedback("这枚 token 已经不在先攻列表里了", "WARNING");
      return;
    }
    return saveInit(removeEntry(initiative, tokenId), "已从先攻移出「" + entry.name + "」");
  }
  if (act === "prepare") return saveInit(function (st) { return startPreparation(st); }, "进入战斗准备：大家掷先攻");
  if (act === "surprise") return saveInit(function (st) { return startSurprise(st); }, "突袭轮开始（4E 突袭轮）");
  if (act === "start") return saveInit(function (st) { return startCombat(st); }, "战斗开始");
  if (act === "cancel") return saveInit(function (st) { return endCombat(st); }, "已取消准备，名单保留");
  if (act === "end-combat") return saveInit(function (st) { return endCombat(st); }, "战斗结束，名单保留");
  if (act === "prev") {
    return saveInit(function (st) { return advanceInitiative(st, -1); }, "已回到上一回合");
  }
  if (act === "next") {
    /* v1.8.0：传函数 —— 连点时第二次点击会在**第一次写回之后**才执行，基于最新 state 推进。 */
    return saveInit(function (st) { return advanceInitiative(st, 1); }, "已推进到下一回合");
  }
  if (act === "clear") {
    if (armClear()) return;
    return saveInit(clearInitiative(), "先攻已清空（token 与角色卡都不受影响）");
  }
  if (act === "active") {
    if (!tokenId) return;
    return saveInit(function (st) { return setActiveEntry(st, tokenId); }, "当前回合：「" + nameOf(tokenId) + "」");
  }
  feedback("未知操作：" + act, "WARNING");
}

/** 掷先攻（GM）：卡片下方**唯一**的 d20 按钮（v1.7.10：4E 没有优势 / 劣势）。 */
async function onRoll(mode, tokenId) {
  void mode;
  const entry = initiative.entries.filter(function (e) { return e.tokenId === tokenId; })[0];
  if (!entry) {
    feedback("这枚 token 已经不在先攻列表里了", "WARNING");
    return;
  }
  /* v2.4.34（照 Full Suite）：准备阶段玩家可以掷自己的条目；战斗阶段只有 GM 能重掷。 */
  const allowed = myRole === "GM" ||
    (initiative.phase === "preparing" && canEditBonus(entry, { role: myRole, playerId: playerId, items: itemsMap }));
  if (!allowed) {
    feedback(myRole === "GM" ? "掷先攻需要城主权限" : "战斗开始后只有城主能重掷先攻；准备阶段只能掷自己的条目", "WARNING");
    return;
  }
  /* v1.8.0：传函数，连点 d20 时每次都在最新的 state 上重掷（不会两次都基于同一个旧 state）。 */
  return saveInit(function (st) { return rerollEntry(st, tokenId, undefined, "normal"); },
    "「" + entry.name + "」重新掷先攻");
}

/* ---------------- v1.7.10：先攻加值可编辑（卡片左上角 + 状态行同一份写逻辑） ---------------- */

/** 把输入框里的文字变成整数加值：允许 "+5" / " 5 " / "−3"；非法返回 null。 */
function parseBonusText(raw) {
  const s = String(raw == null ? "" : raw).replace(/[+\s]/g, "").replace(/[−–—]/g, "-");
  if (!s) return null;
  const v = Number(s);
  if (!isFinite(v)) return null;
  return Math.max(-99, Math.min(999, Math.round(v)));
}

/**
 * 保存一条的先攻加值。卡片左上角（data-bonus-input）与状态行（data-bonus-row）都走这里：
 *   权限 → canEditBonus（GM 任意 / 玩家只自己 token）；写 entries[].bonus 并立即重排。
 * 输入没变 / 不合法 → 只是把输入框恢复成当前值，不写房间数据。
 */
async function commitBonus(el) {
  if (!el) return;
  /* 回车会先 commit 再 blur → focusout 会再进来一次；写过一次就直接忽略（避免重复写房间数据）。 */
  if (el.dataset && el.dataset.bonusCommitted === "1") return;
  const tokenId = el.getAttribute("data-bonus-input") || el.getAttribute("data-bonus-row") || "";
  const entry = entryOf(tokenId);
  if (!entry) return;
  const bonus = parseBonusText(el.value);
  if (bonus === null || bonus === entry.bonus) {
    el.value = String(entry.bonus);
    return;
  }
  if (!canEditBonus(entry, { role: myRole, playerId: playerId, items: itemsMap })) {
    el.value = String(entry.bonus);
    feedback("只有城主能改别人的先攻加值（自己的 token 可以自己改）", "WARNING");
    return;
  }
  if (el.dataset) el.dataset.bonusCommitted = "1";
  await saveInit(setEntryBonus(initiative, tokenId, bonus), "先攻加值：" + signed(bonus));
}

/* ---------------------------------------------------------------------------
 * v1.8.2：先攻条卡片可直接手填「掷出的点数（d20）」
 * ---------------------------------------------------------------------------
 * 用户原话：「我可以输入 20，左上角是 100，然后实际先攻是 20+100」——
 * 输入框里是 **d20**（不是合计），保持左上角加值不变；合计自动 = d20 + 加值 并重排。
 * 写回走 setEntryRoll（写 entries[].d20、重算 init、按「合计 DESC → tiebreak ASC」排序）。
 * 输入 0~99 的整数；空 / 非法 → 恢复原值、不写。preparing 且未掷（d20 为空）时后端不渲染输入框。
 */
function parseD20Text(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/[+\s]/g, "");
  if (!s) return null;
  const v = Number(s);
  if (!isFinite(v)) return null;
  return Math.max(0, Math.min(99, Math.round(v)));
}

async function commitD20(el) {
  if (!el) return;
  /* 回车先 commit 再 blur → focusout 再进来一次；写过就忽略（与 commitBonus 同一套防重复）。 */
  if (el.dataset && el.dataset.d20Committed === "1") return;
  const tokenId = el.getAttribute("data-init-d20") || "";
  const entry = entryOf(tokenId);
  if (!entry) return;
  const cur = entry.d20 === null || entry.d20 === undefined ? null : Math.round(Number(entry.d20));
  const d20 = parseD20Text(el.value);
  if (cur === null || d20 === null) {
    el.value = cur === null ? "" : String(cur);
    return;
  }
  if (d20 === cur) {
    el.value = String(cur);
    return;
  }
  if (!canEditBonus(entry, { role: myRole, playerId: playerId, items: itemsMap })) {
    el.value = String(cur);
    feedback("只有城主能改别人的先攻点数（自己的 token 可以自己改）", "WARNING");
    return;
  }
  if (el.dataset) el.dataset.d20Committed = "1";
  await saveInit(function (st) { return setEntryRoll(st, tokenId, d20); },
    "先攻点数：" + d20 + "+" + signed(entry.bonus) + " = " + (d20 + entry.bonus));
}

function signed(v) {
  const x = typeof v === "number" && isFinite(v) ? Math.round(v) : 0;
  return x >= 0 ? "+" + x : String(x);
}

async function onCardClick(tokenId) {
  if (!tokenId || suppressClick) return;
  if (myRole === "GM" && initiative.phase === "combat") {
    await saveInit(function (st) { return setActiveEntry(st, tokenId); }, "当前回合：「" + nameOf(tokenId) + "」");
    return;
  }
  /* 非战斗 / 玩家：把选中切到这枚 token（地图高亮照旧），但**不弹速览**。
   * v1.8.2：先广播 CH_GLANCE_SUPPRESS 再 select —— 后台 refreshInfo 收到抑制信号，1.5s 内不弹窗。
   * v2.4.34：**必须 await 抑制广播送达后再 select**。之前 `void sendMessage` 直接 select，
   * 真机上偶尔 select 引发的 refreshInfo 比抑制消息先到 → 速览弹一次（竞态）。 */
  try {
    await OBR.broadcast.sendMessage(CH_GLANCE_SUPPRESS, { tokenId: tokenId, at: Date.now() }, { destination: "LOCAL" });
  } catch (e) { /* 广播失败也继续选中；最坏情况是后台没收到抑制（不会阻塞地图高亮） */ }
  try {
    await OBR.player.select([tokenId], true);
  } catch (e2) { /* 忽略 */ }
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
    /* v1.7.8：「已请求结束回合」不再弹（回合推进后条上会换人）。 */
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
  barDrag = {
    id: ev.pointerId, x0: ev.screenX, y0: ev.screenY,
    dx: 0, dy: 0, timer: 0
  };
  sendDrag("start", 0, 0);
  window.addEventListener("pointermove", onBarMove);
  window.addEventListener("pointerup", onBarUp);
  window.addEventListener("pointercancel", onBarUp);
  document.body.classList.add("dragging");
}

function onBarMove(ev) {
  if (!barDrag || ev.pointerId !== barDrag.id) return;
  /* v1.7.11：只发**纯指针位移**（屏幕坐标，避免 popover 跟着指针移动后 client 抖动）。
   * 起点偏移由后台按 CH_STRIP_DRAG{start} 记账，这里再加 base 会双重偏移。 */
  barDrag.dx = Math.round(ev.screenX - barDrag.x0);
  barDrag.dy = Math.round(ev.screenY - barDrag.y0);
  if (barDrag.timer) return; /* 节流：发的永远是最新位移 */
  barDrag.timer = setTimeout(function () {
    if (!barDrag) return;
    barDrag.timer = 0;
    sendDrag("move", barDrag.dx, barDrag.dy);
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
  /* 落盘由后台做（它知道夹紧后的最终偏移）；页面只把最后位移发过去。 */
  sendDrag("end", d.dx, d.dy);
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
  /* v1.7.10：加值输入框自己处理点击（别把点输入框当成「选中这张卡」）。 */
  if (t.closest("input, textarea, select")) return;
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
    /* v1.7.8：同步成功不再弹（加值就在卡片上）；announce 参数保留但不再有声。
     * 失败仍然 ERROR（下面那个 catch），不静默。 */
    void announce;
  } catch (e) {
    feedback("同步先攻加值失败：" + msgOf(e), "ERROR");
  }
}

function entryOf(tokenId) {
  return initiative.entries.filter(function (e) { return e.tokenId === tokenId; })[0] || null;
}

/** v1.7.10：列表窗口的加值保存（与先攻条 commitBonus 同一套规则 / 同一个 setEntryBonus）。 */
async function commitListBonus(el) {
  if (!el) return;
  if (el.dataset && el.dataset.bonusCommitted === "1") return;
  const tokenId = el.getAttribute("data-init-bonus") || "";
  const entry = entryOf(tokenId);
  if (!entry) return;
  const bonus = parseBonusText(el.value);
  if (bonus === null || bonus === entry.bonus) {
    el.value = String(entry.bonus);
    return;
  }
  if (!canEditBonus(entry, { role: myRole, playerId: playerId, items: {} })) {
    el.value = String(entry.bonus);
    feedback("只有城主能改别人的先攻加值（自己的 token 可以自己改）", "WARNING");
    return;
  }
  if (el.dataset) el.dataset.bonusCommitted = "1";
  await saveInit(setEntryBonus(initiative, tokenId, bonus), "先攻加值：" + signed(bonus));
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
  /* v1.8.0：列表窗口的 next / prev / roll-all / 单条重掷也走串行队列；
   * 传函数保证轮到执行时基于最新 state（连点不丢步、不重复基于旧 state）。 */
  if (act === "next") return saveInit(function (st) { return advanceInitiative(st, 1); }, "已推进到下一回合");
  if (act === "prev") return saveInit(function (st) { return advanceInitiative(st, -1); }, "已回到上一回合");
  if (act === "roll-all") return saveInit(function (st) { return rerollAll(st); }, "所有人都重新掷了先攻");
  if (act === "sync") return syncInit(true);
  if (act === "clear") {
    if (!window.confirm("清空先攻？token 与角色卡都不受影响，只是把先攻名单清掉。")) {
      return; /* v1.7.8：取消不再弹「已取消」 */
    }
    return saveInit(clearInitiative(), "先攻已清空");
  }
  const entry = entryOf(tokenId);
  if (!entry) {
    feedback("这枚 token 已经不在先攻列表里了", "WARNING");
    return;
  }
  if (act === "roll") {
    return saveInit(function (st) { return rerollEntry(st, tokenId); }, "「" + entry.name + "」重新掷先攻");
  }
  if (act === "up") return saveInit(function (st) { return moveEntry(st, tokenId, -1); });
  if (act === "down") return saveInit(function (st) { return moveEntry(st, tokenId, 1); });
  if (act === "active") return saveInit(function (st) { return setActiveEntry(st, tokenId); }, "当前回合：「" + entry.name + "」");
  if (act === "remove") {
    if (!window.confirm("把「" + entry.name + "」从先攻里移除？")) {
      return; /* v1.7.8：取消不再弹「已取消」 */
    }
    return saveInit(function (st) { return removeEntry(st, tokenId); }, "已从先攻移除");
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
  safeInit("render", render);
}

if (VIEW === "strip") {
  document.body.classList.remove("win-page");
  document.body.classList.add("strip-page");
  /* v1.7.3：先攻条外壳透明 —— ui.css 顶部有 html{background:var(--bg)}，
   * 只透明 body 的话 html 的深色会整块盖住地图（与 v1.7.1 动画页同一个坑），所以给 html 也挂个类。
   * 列表窗口（?view=list）不加：它仍然是不透明的独立窗口。 */
  document.documentElement.classList.add("strip-html");
  if (shellEl) shellEl.hidden = true;
  if (stripRoot) stripRoot.hidden = false;
  if (stripRoot) {
    stripRoot.addEventListener("click", onStripClick);
    stripRoot.addEventListener("pointerdown", onBarDown);
    stripRoot.addEventListener("pointerdown", onSortDown);
    stripRoot.addEventListener("wheel", onStripWheel, { passive: false });
    stripRoot.addEventListener("dblclick", function (ev) {
      const t = ev.target;
      if (!t || !t.closest || !t.closest("[data-strip-drag]")) return;
      /* v1.7.11：双击拖动柄 = 回到顶部中间（后台清偏移 + 重开 popover 贴顶居中）。 */
      sendDrag("reset", 0, 0);
    });
    /* v1.7.10：加值输入 —— 回车 / 失焦保存（卡片左上角与状态行共用 commitBonus）。
     * v1.8.2：卡片大号 d20 点数输入（data-init-d20）走 commitD20，同一批监听器。 */
    stripRoot.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      const el = ev.target;
      if (!el || !el.matches) return;
      const isBonus = el.matches("[data-bonus-input], [data-bonus-row]");
      const isD20 = el.matches("[data-init-d20]");
      if (!isBonus && !isD20) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (isD20) void commitD20(el);
      else void commitBonus(el);
      if (typeof el.blur === "function") el.blur();
    });
    stripRoot.addEventListener("focusout", function (ev) {
      const el = ev.target;
      if (!el || !el.matches) return;
      if (el.matches("[data-init-d20]")) { void commitD20(el); return; }
      if (!el.matches("[data-bonus-input], [data-bonus-row]")) return;
      void commitBonus(el);
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
    /* v1.7.10：列表窗口的加值输入（与先攻条共用 setEntryBonus / canEditBonus）。 */
    bodyEl.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      const el = ev.target && ev.target.matches ? ev.target : null;
      if (!el || !el.matches("[data-init-bonus]")) return;
      ev.preventDefault();
      void commitListBonus(el);
      if (typeof el.blur === "function") el.blur();
    });
    bodyEl.addEventListener("focusout", function (ev) {
      const el = ev.target && ev.target.matches ? ev.target : null;
      if (!el || !el.matches("[data-init-bonus]")) return;
      void commitListBonus(el);
    });
  }
  const closeEl = document.getElementById("close");
  /* v1.7.10：✕ = OBR.popover.close(本窗 id) + 后台 {op:"close-win"} 双保险。 */
  if (closeEl) closeEl.addEventListener("click", function () { closeSelf(ID_INIT_WIN, "initiative"); });
  win.onStatus(function () { render(); });
}

onReady(function () {
  try {
    OBR.room.onMetadataChange(scheduleReload);
    if (OBR.scene && typeof OBR.scene.onMetadataChange === "function") OBR.scene.onMetadataChange(scheduleReload);
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
    /* v1.7.11：popover 由宿主定位 —— 视口变了把新尺寸再报一次，后台会重新夹紧。 */
    try {
      if (OBR.viewport && typeof OBR.viewport.onChange === "function") {
        OBR.viewport.onChange(function () { void applySize(); });
      }
    } catch (e2) { /* 忽略 */ }
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
