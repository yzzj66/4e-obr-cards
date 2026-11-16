// v1.7.0：骰子窗口的页面脚本（dice.html，**单列**）。
// v1.7.4（用户：窗口窄成 ≈320×620、字号小一号、本次结果固定底部）：布局与字号全在 assets/ui.css
//   （骰子 4+3 两排 / 按钮 2×2 换行 / .dice-result 是 flex:none 的固定底栏）。
// v1.7.6（用户第二次报「记录窗口还是打不开」+ 删提示小字）：
//   · 「记录窗口」按钮改成**本页直接 OBR.popover.open**（不再先发命令等后台），
//     打开后用 getWidth 确认存活、按钮变「关闭记录窗口」，失败 ERROR 通知 + 让后台关掉骰子窗再补开；
//   · 删掉 4E 预设区的「防御参考」整行与「… · 只填公式，不判定」、表达式 / 组合区的说明小字、
//     「本次结果」右上角的「投骰动画：开」、标题下的副标题（只留功能本身，错误提示保留）。
// ---------------------------------------------------------------------------
// 分工：
//   · 规则 / 解析 / 掷骰 / 归一化全在 assets/dice-core.js（纯函数，node 可测）；
//   · 4E 预设（攻击 / 伤害 / 技能）在 assets/dice-4e.js，**有绑定卡时才动态 import**
//     （它会拉进 glance.js + data/rules.js，约 190KB）；
//   · 动画的布局 / 时间轴常量也在 dice-core.js（fxBeat / fxLayout / fxQuery），本文件只负责
//     在**算完结果之后**打开动画页 effect.html；
//   · 本文件只管 DOM、广播、房间数据（落库回执）与本机存储。
//
// v1.7.0 的三处变化（用户要求）：
//   1) **记录搬去独立窗口**：本窗口不再渲染历史列表，只有一个「记录窗口」按钮，
//      发 CH_DICE_HIST_CMD 让后台开 / 关 /dice-history-window（两个窗口各自开关、可同时开）；
//   2) **投骰动画**：结果先算好 → 广播 → 若「设置」里动画开着，就 OBR.modal.open(effect.html)；
//      动画打不开 / 关掉时什么都不影响，本次结果照样显示在本窗口的「本次结果」里；
//   3) 预设去掉「豁免」「先攻」（4E 里前者就是一个 d20，后者先攻条自带）。
//
// v1.9.2：骰子历史改为**本机保存 + 广播**（不再写房间数据）：投掷 → 本机 append → CH_ROLL（LOCAL + REMOTE）→
// 其它端收到后各自追加到本机历史（后进房间看不到旧历史，与 Full Suite 一致）。
// 城主不在线：本机暂存 + 提示（玩家只读，清空只有城主能做）。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_DICE_HIST_CMD, CH_DICE_HIST_STATE, CH_ROLL, CH_ROLL_CLEAR,
  ID_DICE_HIST, ID_DICE_WIN, KEY_BIND, LS_DICE_COMBOS, LS_DICE_LAST, LS_DICE_LOCAL,
  NS, URL_DICE_HIST, URL_EFFECT,
  appendDiceHistoryRow, clearDiceHistory, esc, findCard, getCards, onReady, readDiceAnim
} from "./common.js";
import { closeSelf, createWindow, feedback } from "./window.js";
import {
  ROLL_CRIT_NOTE, adjustExprForType, adjustExprModifier, countDiceByType,
  formatExpr, fxQuery, makeRollId, parseExpr, parsedIsEmpty, rollParsed, rollToPayload,
  rowTotals, rowsFromRaw, sidesOf
} from "./dice-core.js";

/* v1.9.2：骰子入口改为 manifest action（左上角按钮，参照 Full Suite）——
 * action popover 模式与旧「工具栏 tool + popover」模式共用本页面：
 *   · 用 OBR.action.isOpen() 判断当前是不是 action 弹窗（异步；拿不到就当 false）；
 *   · action 模式：✕ → OBR.action.close()；位置由 OBR 固定，标题栏拖动不再绑定；
 *   · 尺寸由 manifest action 的 width/height（320×620）决定，页面自身 100% 铺满。 */
var ACTION_MODE = false;
async function actionModeNow() {
  try {
    if (!OBR.action || typeof OBR.action.isOpen !== "function") return false;
    return !!(await OBR.action.isOpen());
  } catch (e) { return false; }
}

// v1.9.2：新版只有 manifest action 入口（右侧工具栏不再有骰子图标），因此不再绑定标题栏拖动；
// 旧 popover 路径保留兼容（位置由后台 WINS 管，不依赖本页拖动）。
var win = createWindow({ name: "dice", head: null });

var els = {
  head: document.getElementById("head"),
  close: document.getElementById("close"),
  diceRow: document.getElementById("diceRow"),
  exprInput: document.getElementById("exprInput"),
  btnModMinus: document.getElementById("btnModMinus"),
  btnModPlus: document.getElementById("btnModPlus"),
  btnRoll: document.getElementById("btnRoll"),
  btnLast: document.getElementById("btnLast"),
  btnSave: document.getElementById("btnSave"),
  btnClear: document.getElementById("btnClear"),
  btnAdvantage: document.getElementById("btnAdvantage"),
  btnCrit: document.getElementById("btnCrit"),
  btnHist: document.getElementById("btnHist"),
  presets: document.getElementById("presets"),
  combos: document.getElementById("combos"),
  comboName: document.getElementById("comboName"),
  result: document.getElementById("result")
};

var MODE_LABEL = { attack: "攻击", damage: "伤害", save: "豁免", skill: "技能", init: "先攻", free: "投掷" };

/* ---- 状态 ---- */
var exprParsed = parseExpr("1d20");
var advOn = false;
var critOn = false;
var myId = "";
var myName = "我";
var myColor = "#5dade2";
var isGM = false;
var busy = false;
var lastExpr = "";
var pendingMode = "free";
var pendingLabel = "";
var comboList = [];
var presetBusy = false;
var histOpen = false;
/** 当前开着的动画 modal id（换新投掷前先关掉上一个，避免叠一层又一层）。 */
var effectModalId = "";

/* ---------------------------------------------------------------------------
 * 0) 小工具
 * ------------------------------------------------------------------------- */
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
}
/** 窗口内状态行（与 window.js 的 feedback 同款外观，但**不发通知中心**：掷骰太频繁）。 */
var flashTimer = 0;
function flash(msg, tone) {
  var el = document.getElementById("win-flash");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "win-flash" + (msg ? " on" + (tone ? " " + String(tone).toLowerCase() : "") : "");
  if (flashTimer) clearTimeout(flashTimer);
  if (msg) {
    flashTimer = setTimeout(function () {
      flashTimer = 0;
      el.className = "win-flash";
      el.textContent = "";
    }, 7000);
  }
}
function shake(el) {
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(function () { el.classList.remove("shake"); }, 600);
}
/* ---------------------------------------------------------------------------
 * 1) 表达式框 / 骰子按钮 / 徽标
 * ------------------------------------------------------------------------- */
function applyParsed(parsed) {
  exprParsed = parsed;
  if (els.exprInput) els.exprInput.value = formatExpr(parsed);
  refreshBadges();
}

function readInput() {
  exprParsed = parseExpr(els.exprInput ? els.exprInput.value : "");
  refreshBadges();
}

function refreshBadges() {
  var counts = countDiceByType(exprParsed);
  var buttons = els.diceRow ? els.diceRow.querySelectorAll("[data-die]") : [];
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var type = btn.getAttribute("data-die");
    var n = counts[type] || 0;
    btn.setAttribute("data-count", String(n));
    btn.classList.toggle("on", n > 0);
    var badge = btn.querySelector(".badge");
    if (badge) badge.textContent = n < 0 ? "−" + Math.abs(n) : String(n);
    btn.title = type + "：左键 +1，右键 −1" + (n ? "（当前 " + n + "）" : "");
  }
}

function onDieClick(type, delta) {
  applyParsed(adjustExprForType(parseExpr(els.exprInput ? els.exprInput.value : ""), type, delta));
  pendingMode = "free";
  pendingLabel = "";
  /* v1.7.8：不再写「d6 +1 → 2d6」这类成功回音（公式框里当场就变了）。 */
}

function onModifierStep(delta) {
  applyParsed(adjustExprModifier(parseExpr(els.exprInput ? els.exprInput.value : ""), delta));
  pendingMode = "free";
  pendingLabel = "";
  /* v1.7.8：不再写「加值 +1 → …」这类成功回音（公式框里当场就变了）。 */
}

/** 4E「战斗优势」= 加值 +2（点一下加，再点一下撤回）。 */
function onAdvantage() {
  advOn = !advOn;
  applyParsed(adjustExprModifier(parseExpr(els.exprInput ? els.exprInput.value : ""), advOn ? 2 : -2));
  if (els.btnAdvantage) els.btnAdvantage.classList.toggle("on", advOn);
  /* v1.7.8：不再写「战斗优势：公式 +2」（按钮自己会亮 / 灭、公式自己 +2 / −2）。 */
}

function onCrit() {
  critOn = !critOn;
  if (els.btnCrit) els.btnCrit.classList.toggle("on", critOn);
  /* v1.7.8：不再写「重击：本次投掷所有伤害骰取满」（按钮亮 / 灭就是状态）。 */
}

/* ---------------------------------------------------------------------------
 * 2) 掷骰
 * ------------------------------------------------------------------------- */
function labelFor() {
  var mode = MODE_LABEL[pendingMode] || "";
  if (mode && pendingLabel) return mode + " · " + pendingLabel;
  if (pendingLabel) return pendingLabel;
  if (pendingMode && pendingMode !== "free") return mode;
  return "自由投掷";
}

function chipsHTML(row) {
  var dice = (row && row.dice) || [];
  var html = "";
  for (var i = 0; i < dice.length; i++) {
    var d = dice[i];
    var sides = sidesOf(d.type);
    var cls = "die-chip";
    if (d.loser) cls += " loser";
    if (d.subtract) cls += " subtract";
    else if (d.value === sides) cls += " crit";
    else if (d.value === 1) cls += " fail";
    var val = (d.subtract ? "−" : "") + d.value;
    if (typeof d.originalValue === "number" && d.originalValue !== d.value) val += "(" + d.originalValue + ")";
    html += '<span class="' + cls + '"><b>' + esc(d.type) + "</b>" + esc(val) + "</span>";
  }
  var mod = Number(row && row.modifier) || 0;
  if (mod) html += '<span class="mod-chip">' + (mod > 0 ? "+" : "−") + Math.abs(mod) + "</span>";
  return html;
}

function renderResult(row) {
  if (!els.result || !row) return;
  var tags = "";
  var mode = row.mode && row.mode !== "free" ? MODE_LABEL[row.mode] || "" : "";
  if (mode) tags += '<span class="res-tag">' + esc(mode) + "</span>";
  if (row.crit) tags += '<span class="res-tag crit">重击 · 伤害取满</span>';
  if (row.label) tags += '<span class="res-tag">' + esc(row.label) + "</span>";

  var rowLine = "";
  var totals = rowTotals(row.dice || [], row.rowStarts, row.modifier);
  if (totals.length > 1) {
    rowLine = '<div class="res-rows">' + totals.map(function (t, i) {
      return '<span class="res-row">第 ' + (i + 1) + " 行 <b>" + t + "</b></span>";
    }).join("") + "</div>";
  }

  var note = "";
  if (row.critDegraded) note = '<p class="res-note">' + esc(ROLL_CRIT_NOTE) + "</p>";

  els.result.innerHTML =
    '<div class="res-main"><div class="res-total">' + row.total + "</div>" +
    '<div class="res-chips">' + chipsHTML(row) + "</div></div>" +
    (tags ? '<div class="res-tags">' + tags + "</div>" : "") +
    '<div class="res-formula mono">' + esc(row.expression || "") + "</div>" +
    rowLine + note;
}

async function broadcast(channel, data) {
  var sent = false;
  try {
    await OBR.broadcast.sendMessage(channel, data, { destination: "LOCAL" });
    sent = true;
  } catch (e) { /* 后台没起来 / 不在枭熊里 */ }
  try {
    await OBR.broadcast.sendMessage(channel, data, { destination: "REMOTE" });
    sent = true;
  } catch (e2) { /* 忽略：LOCAL 成功也算发出去了 */ }
  return sent;
}

/* ---------------------------------------------------------------------------
 * 2.5) 投骰动画（effect.html）
 * ---------------------------------------------------------------------------
 * 顺序（规格 §4.1）：**先把结果算完**（renderResult 已经画好）→ 广播 → 再开动画。
 * 动画只是「呈现」，播放失败 / 被关掉时本窗口的结果面板照样是真实点数。
 * 落点：选中单个 token 时用它的**顶部中心世界坐标**（wx/wy），动画页自己按
 * sx = worldX * scale + vp.x 换算并逐帧跟随；没选中就落到视口中心。
 * modal 参数逐字照抄参考实现：fullScreen + hideBackdrop + hidePaper + disablePointerEvents
 * （最后一项让整层点击穿透，动画期间照样能平移 / 选中地图）。
 * ------------------------------------------------------------------------- */
/** 选中 token 的顶部中心（世界坐标）；拿不到就返回 null（动画页用视口中心）。 */
async function effectOrigin() {
  try {
    var sel = await OBR.player.getSelection();
    if (!sel || sel.length !== 1) return null;
    var items = await OBR.scene.items.getItems([sel[0]]);
    var it = items && items[0];
    if (!it || it.type !== "IMAGE" || !it.position) return null;
    var sceneDpi = 150;
    try {
      var dpi = await OBR.scene.grid.getDpi();
      if (typeof dpi === "number" && dpi > 0) sceneDpi = dpi;
    } catch (e1) { /* 拿不到网格就用 150 */ }
    var imgH = it.image && typeof it.image.height === "number" ? it.image.height : 0;
    var itemDpi = it.grid && typeof it.grid.dpi === "number" && it.grid.dpi > 0 ? it.grid.dpi : sceneDpi;
    var scaleY = it.scale && typeof it.scale.y === "number" ? it.scale.y : 1;
    var halfH = imgH > 0 ? (imgH / itemDpi) * sceneDpi * scaleY / 2 : 75;
    if (!isFinite(halfH) || halfH <= 0) halfH = 75;
    return { x: it.position.x, y: it.position.y - halfH };
  } catch (e2) {
    return null;
  }
}

/** 打开动画页；动画被关 / 打不开时返回 false（调用方什么都不用做）。 */
async function playEffect(row, origin) {
  if (!readDiceAnim()) return false;
  if (!OBR.modal || typeof OBR.modal.open !== "function") return false;
  try {
    if (effectModalId) {
      try { await OBR.modal.close(effectModalId); } catch (e0) { /* 已经自己关了 */ }
      effectModalId = "";
    }
    var id = NS + "/dice-effect-" + row.rollId;
    await OBR.modal.open({
      id: id,
      url: URL_EFFECT + "?" + fxQuery(row, origin),
      fullScreen: true,
      hideBackdrop: true,
      hidePaper: true,
      disablePointerEvents: true
    });
    effectModalId = id;
    return true;
  } catch (e) {
    /* 降级：动画打不开只提示一句，投掷本身早就完成了 */
    effectModalId = "";
    flash("投骰动画打不开（不影响结果）：" + (e && e.message ? e.message : e), "WARNING");
    return false;
  }
}

async function doRoll() {
  if (busy) {
    shake(els.btnRoll);
    feedback("上一次投掷还没结算完，稍等一下再掷", "WARNING");
    return;
  }
  var parsed = parseExpr(els.exprInput ? els.exprInput.value : "");
  if (parsedIsEmpty(parsed)) {
    shake(els.btnRoll);
    feedback("公式是空的（或看不懂）：点一颗骰子，或输入 2d6 + 5 这样的公式", "WARNING");
    return;
  }
  busy = true;
  try {
    var result = rollParsed(parsed, { crit: critOn });
    var payload = rollToPayload({
      parsed: parsed,
      result: result,
      rollId: makeRollId(),
      rollerId: myId,
      rollerName: myName,
      rollerColor: myColor,
      label: labelFor(),
      mode: pendingMode || "free",
      crit: critOn
    });
    if (!payload) {
      feedback("投掷结果不合法（内部错误），已丢弃", "ERROR");
      return;
    }
    lastExpr = formatExpr(parsed);
    lsSet(LS_DICE_LAST, lastExpr);

    renderResult(payload);

    if (payload.critDegraded) {
      flash("重击未生效：公式里有包裹（adv / max 等），本次按普通投掷", "WARNING");
    } else {
      flash((payload.crit ? "重击 · 伤害取满：" : "掷出：") + formatExpr(parsed) + " = " + payload.total +
        (result.rowCount > 1 ? "（" + result.rowCount + " 行）" : ""), "SUCCESS");
    }

    var sent = await broadcast(CH_ROLL, payload);
    if (!sent) flash("广播没发出去：本机记录已保存，但这次结果同步不到其它人。", "WARNING");
    /* v1.9.2：骰子历史改为本机保存 —— 投掷方自己先落一条（广播 LOCAL 不一定回环到自己）。 */
    appendDiceHistoryRow(payload);

    /* 结果已经算完 / 已经广播，最后才开动画（失败也不影响上面任何一步） */
    if (readDiceAnim()) {
      var origin = await effectOrigin();
      await playEffect(payload, origin);
    }
  } catch (e) {
    feedback("投掷失败：" + (e && e.message ? e.message : e), "ERROR");
  } finally {
    setTimeout(function () { busy = false; }, 260);
  }
}

/* ---------------------------------------------------------------------------
 * 3) 骰子历史（v1.9.2 起本机保存 + 广播同步；列表在记录窗口里画）
 * ------------------------------------------------------------------------- */
async function clearHistory() {
  if (els.btnClear && els.btnClear.getAttribute("data-armed") === "1") {
    els.btnClear.setAttribute("data-armed", "0");
    els.btnClear.textContent = "清空记录";
    clearDiceHistory();
    lsDel(LS_DICE_LOCAL);
    await broadcast(CH_ROLL_CLEAR, { by: myId, at: Date.now() });
    /* v1.7.8：「已请求清空全桌记录」不再弹（按钮当场回到「清空记录」，记录窗口也会清空）。 */
    return;
  }
  if (els.btnClear) {
    els.btnClear.setAttribute("data-armed", "1");
    els.btnClear.textContent = "再点一次清空";
    flash("再点一次「清空记录」确认（3 秒后自动取消）", "WARNING");
    setTimeout(function () {
      if (!els.btnClear) return;
      if (els.btnClear.getAttribute("data-armed") === "1") {
        els.btnClear.setAttribute("data-armed", "0");
        els.btnClear.textContent = "清空记录";
      }
    }, 3000);
  }
}

/* ---------------------------------------------------------------------------
 * 3.5) 记录窗口（独立 popover；**v1.7.6 改成按钮在本页直接打开**）
 * ---------------------------------------------------------------------------
 * 用户第二次报「记录窗口还是打不开」。v1.7.4 的做法是「先发命令给后台、等后台回执，
 * 没回执才由本页兜底」—— 只要后台那一步慢一点 / 没订阅上，用户就得先干等 900 ms，
 * 看到的仍然是「点了没反应」。v1.7.6 按用户要求改成**最短链路**：
 *   ① 点按钮 → 本页**直接** OBR.popover.open({ id: 记录窗口 id, url: dice-history.html,
 *      300×240, anchorReference: "POSITION", 锚点左上角, hidePaper: true（v1.7.10 外壳透明）,
 *      disableClickAway: false })；
 *      不再先问后台（免得栽在「后台没回应」这条链路上）；
 *   ② 打开后立刻用 OBR.popover.getWidth(ID_DICE_HIST) 确认**真的活着**，
 *      按钮文字变成「关闭记录窗口」= 用户看得见的反馈；
 *   ③ open 抛错（OBR 同时开着的 popover 太多时会拒）→
 *      OBR.notification.show("记录窗口打开失败：…", "ERROR")，并请后台
 *      「**先关掉骰子窗口、再开记录窗口**」（后台是另一个页面，本窗被关掉它照样活着）；
 *   ④ 打开成功后把几何（left/top/width/height）发给后台（op:"adopt"），
 *      于是拖动 / 记住位置 / 视口变化重新夹紧仍然走 background.core.js 的 WINS 那一套。
 * 关闭：本页 OBR.popover.close + 通知后台清掉状态（op:"close"）。
 * 记录窗口页面加载完还会自己 OBR.popover.getWidth(自己) 确认存活（assets/dice-history-page.js）。
 * ------------------------------------------------------------------------- */
/** 直开失败后「等后台关掉骰子窗口再补开」的回执上限（只有这条兜底路才用到）。 */
var HIST_ACK_MS = 900;
/** v1.7.10：记录窗口缩小到 **300×240**（默认只放得下最近 4 条，行高 26 / 字号 11，不再占一大块）；
 *  「展开全部」时页面自己把高度临时调大（见 assets/dice-history-page.js 的 EXPANDED_H）。
 *  与 background.core.js 的 WINS.diceHistory 必须一致。 */
var HIST_W = 300;
var HIST_H = 240;
/** 开 / 关进行中（避免连点打架）。 */
var histBusy = false;
/** v1.9.2：最近一次成功打开记录窗口的时间 —— 900ms 内又点按钮视为「窗口不可见」兜底。 */
var lastHistOpenAt = 0;
var histRepeatWarned = false;
/** 等后台补齐的回执计时器。 */
var histTimer = 0;

function setHistButton(open) {
  histOpen = !!open;
  if (!els.btnHist) return;
  els.btnHist.classList.toggle("on", histOpen);
  /* 可见反馈：开着的时候按钮直接写着「关闭记录窗口」，不用猜窗口有没有出来。 */
  els.btnHist.textContent = histOpen ? "关闭记录窗口" : "记录窗口";
  els.btnHist.title = histOpen ? "关闭独立的骰子记录窗口" : "打开独立的骰子记录窗口（最近 4 条，可展开全部）";
}

/** 发一条记录窗口命令给后台（只负责「接管几何 / 关窗 / 失败兜底」，开窗是页面自己做的）。 */
function sendHistCmd(op, extra) {
  var payload = { op: op, at: Date.now() };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
  try {
    var p = OBR.broadcast.sendMessage(CH_DICE_HIST_CMD, payload, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来：开窗已经成功了，不影响 */ });
    return true;
  } catch (e) {
    return false;
  }
}

/** 收尾「等后台补齐」：清计时器 + 去掉按钮的 pending 外观。 */
function endHistPending() {
  if (histTimer) { clearTimeout(histTimer); histTimer = 0; }
  if (els.btnHist) els.btnHist.classList.remove("pending");
}

/** 记录窗口的落点：默认贴着视口右上（骰子窗口自己不知道宿主给的坐标，只能按视口算）。 */
async function histPlace() {
  var vw = 0;
  var vh = 0;
  try { vw = await OBR.viewport.getWidth(); } catch (e1) { vw = 0; }
  try { vh = await OBR.viewport.getHeight(); } catch (e2) { vh = 0; }
  var w = Math.round(Math.min(HIST_W, Math.max(240, (vw > 0 ? vw : HIST_W + 32) - 32)));
  var h = Math.round(Math.min(HIST_H, Math.max(220, (vh > 0 ? vh : HIST_H + 32) - 32)));
  var left = vw > 0 ? Math.max(16, vw - w - 24) : 16;
  var top = vh > 0 ? Math.round(Math.max(16, Math.min(96, vh - h - 16))) : 96;
  return { width: w, height: h, left: left, top: top };
}

/** 本页**直接**打开记录窗口；成功返回 true（按钮已经变成「关闭记录窗口」）。 */
async function openHistoryDirect() {
  endHistPending();
  if (els.btnHist) {
    els.btnHist.classList.add("pending");
    els.btnHist.textContent = "记录窗口 · 打开中…";
  }
  var place = await histPlace();
  try {
    await OBR.popover.open({
      id: ID_DICE_HIST,
      url: URL_DICE_HIST,
      width: place.width,
      height: place.height,
      anchorReference: "POSITION",
      anchorPosition: { left: place.left, top: place.top },
      anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
      transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
      /* v1.7.10：外壳透明 —— hidePaper:true + 页面自己画「半透明深色圆角卡片」，
       * 与先攻条同一个视觉语言（浮层 = 半透明卡片，不整体实心）。 */
      hidePaper: true,
      disableClickAway: false
    });
    /* 「open 返回了」不等于「窗口还在」：再用 getWidth 确认一次（对已关掉的 popover 会 reject）。 */
    var w = 0;
    try { w = await OBR.popover.getWidth(ID_DICE_HIST); } catch (e0) { w = 0; }
    if (!(typeof w === "number" && w > 0)) throw new Error("窗口打开了但 getWidth 返回 " + w);
    if (els.btnHist) els.btnHist.classList.remove("pending");
    setHistButton(true);
    lastHistOpenAt = Date.now();
    histRepeatWarned = false;
    /* v1.7.8：不再弹「记录窗口已打开」（窗口就在眼前，按钮文字也变成「关闭记录窗口」）。 */
    /* 把几何告诉后台：拖动 / 记住位置 / 视口变化重新夹紧仍走 background.core.js 的 WINS 那一套。 */
    sendHistCmd("adopt", {
      left: place.left, top: place.top, width: place.width, height: place.height
    });
    return true;
  } catch (e) {
    if (els.btnHist) els.btnHist.classList.remove("pending");
    setHistButton(false);
    var why = e && e.message ? e.message : String(e);
    /* 用户要求：open 抛错必须看得见（ERROR 通知，不静默）。 */
    feedback("记录窗口打开失败：" + why + "（已请后台关掉骰子窗口后再开一次）", "ERROR");
    histTimer = setTimeout(onHistTimeout, HIST_ACK_MS);
    sendHistCmd("force-open");
    return false;
  }
}

/** 本页关闭记录窗口（再通知后台把「开着」的状态清掉）。 */
async function closeHistoryDirect() {
  endHistPending();
  /* v1.7.10：✕ 双保险 —— popover.close(记录窗口 id) + 后台 {op:"close-win", name:"diceHistory"}。 */
  closeSelf(ID_DICE_HIST, "diceHistory");
  setHistButton(false);
  /* v1.7.8：「记录窗口已关闭」不再弹（窗口关掉了就是反馈）。 */
}

/** 直开失败、后台也没能补开（没回执）时再补一条 ERROR：绝不让点击变成「没反应」。 */
function onHistTimeout() {
  histTimer = 0;
  if (histOpen) return;
  feedback("记录窗口打开失败：后台也没能打开（可以先点其它窗口的「✕」腾出 popover 名额，再点一次）", "ERROR");
}

/** 开 / 关都做完才放开 busy（不靠定时器：连点两下不会互相打架，也不会把第二下吞掉）。 */
async function toggleHistory() {
  if (histBusy) return;
  /* v1.9.2 兜底：刚打开 900ms 内用户又点 → 大概率窗口被挡住 / 落在不可见处。
   * 先关掉（不重复打开），并提示再点一次会换位置打开（只提醒一次）。 */
  if (histOpen && Date.now() - lastHistOpenAt < 900) {
    histBusy = true;
    try {
      await closeHistoryDirect();
      if (!histRepeatWarned) {
        histRepeatWarned = true;
        feedback("记录窗口可能被其它窗口挡住了，已关闭；再点一次会换位置打开", "WARNING");
      }
    } finally {
      histBusy = false;
    }
    return;
  }
  histBusy = true;
  try {
    if (histOpen) await closeHistoryDirect();
    else await openHistoryDirect();
  } finally {
    histBusy = false;
  }
}

/* ---------------------------------------------------------------------------
 * 4) 4E 预设（选中已绑定角色卡的 token 时出现）
 * ------------------------------------------------------------------------- */
async function refreshPresets() {
  if (presetBusy) return;
  presetBusy = true;
  try {
    var sel = await OBR.player.getSelection();
    if (!sel || sel.length !== 1) {
      renderPresets(null, "");
      return;
    }
    var items = await OBR.scene.items.getItems([sel[0]]);
    var meta = items && items[0] ? items[0].metadata || {} : {};
    var cardId = meta[KEY_BIND];
    if (!cardId) {
      renderPresets(null, "");
      return;
    }
    var cards = await getCards();
    var card = findCard(cards, cardId);
    if (!card || !card.char) {
      renderPresets(null, "");
      return;
    }
    var mod = await import("./dice-4e.js");
    renderPresets(mod.presetsFor(card.char), card.name || "");
  } catch (e) {
    renderPresets(null, "");
  } finally {
    presetBusy = false;
  }
}

function renderPresets(data, cardName) {
  if (!els.presets) return;
  if (!data || !data.ok) {
    els.presets.innerHTML = '<p class="muted small">选中一枚<b>已绑定角色卡</b>的 token。</p>';
    return;
  }

  var html = "";
  for (var i = 0; i < data.groups.length; i++) {
    var g = data.groups[i];
    var list = g.items || [];
    if (!list.length) continue;
    html += '<div class="preset-line"><span class="preset-lab">' + esc(g.label) + '</span><div class="preset-items">';
    for (var j = 0; j < list.length; j++) {
      var it = list[j];
      html += '<button class="preset-btn" data-expr="' + esc(it.expr) + '" data-mode="' + esc(it.mode) +
        '" data-name="' + esc(it.name || "") + '" title="' + esc(it.expr) + '">' + esc(it.label) + "</button>";
    }
    html += "</div></div>";
  }
  els.presets.innerHTML = html || '<p class="muted small">这张卡没有可用的攻击 / 伤害数据。</p>';
}

/* ---------------------------------------------------------------------------
 * 5) 组合（本机 localStorage）
 * ------------------------------------------------------------------------- */
function loadCombos() {
  comboList = [];
  try {
    var box = JSON.parse(lsGet(LS_DICE_COMBOS) || "{}");
    var list = box && Array.isArray(box.combos) ? box.combos : [];
    for (var i = 0; i < list.length; i++) {
      var one = list[i];
      if (!one || !one.expr) continue;
      comboList.push({ id: String(one.id || "k" + i), name: String(one.name || one.expr).slice(0, 24), expr: String(one.expr) });
    }
  } catch (e) {
    comboList = [];
  }
  renderCombos();
}

function saveCombos() {
  lsSet(LS_DICE_COMBOS, JSON.stringify({ v: 1, combos: comboList }));
}

function renderCombos() {
  if (!els.combos) return;
  if (!comboList.length) {
    els.combos.innerHTML = '<p class="muted small">还没有组合：填好公式 → 点「保存组合」，下次一键点回来。</p>';
    return;
  }
  var html = "";
  for (var i = 0; i < comboList.length; i++) {
    var c = comboList[i];
    html += '<span class="combo-chip" data-id="' + esc(c.id) + '" title="' + esc(c.expr) + '">' +
      '<button class="combo-use" data-id="' + esc(c.id) + '">' + esc(c.name) + "</button>" +
      '<button class="combo-del" data-id="' + esc(c.id) + '" title="删除这个组合">✕</button>' +
      "</span>";
  }
  els.combos.innerHTML = html;
}

function onSaveCombo() {
  var parsed = parseExpr(els.exprInput ? els.exprInput.value : "");
  if (parsedIsEmpty(parsed)) {
    shake(els.btnSave);
    feedback("公式是空的，先点一颗骰子再保存", "WARNING");
    return;
  }
  var expr = formatExpr(parsed);
  var name = (els.comboName && els.comboName.value ? els.comboName.value : "").trim() || expr;
  for (var i = 0; i < comboList.length; i++) {
    if (comboList[i].expr === expr) {
      feedback("这个公式已经保存过了：" + comboList[i].name, "WARNING");
      return;
    }
  }
  comboList.unshift({ id: "k" + Date.now().toString(36), name: name.slice(0, 24), expr: expr });
  comboList = comboList.slice(0, 30);
  saveCombos();
  if (els.comboName) els.comboName.value = "";
  renderCombos();
  /* v1.7.8：「已保存组合」不再弹（组合列表里立刻多一条）。 */
}

function onComboClick(ev) {
  var target = ev.target;
  if (!target || typeof target.closest !== "function") return;
  var del = target.closest(".combo-del");
  if (del) {
    var id = del.getAttribute("data-id");
    comboList = comboList.filter(function (c) { return c.id !== id; });
    saveCombos();
    renderCombos();
    /* v1.7.8：「组合已删除」不再弹（列表里那条立刻消失）。 */
    return;
  }
  var use = target.closest(".combo-use");
  if (!use) return;
  var cid = use.getAttribute("data-id");
  for (var i = 0; i < comboList.length; i++) {
    if (comboList[i].id !== cid) continue;
    applyParsed(parseExpr(comboList[i].expr));
    /* v1.7.8：「已填入组合」不再弹（公式框里当场就填上了）。 */
    return;
  }
}

/* ---------------------------------------------------------------------------
 * 6) 事件绑定
 * ------------------------------------------------------------------------- */
function wireEvents() {
  /* v1.7.10：✕ = OBR.popover.close(本窗 id) + 后台 {op:"close-win"} 双保险。 */
  if (els.close) els.close.addEventListener("click", function () {
    void (async function () {
      var action = await actionModeNow();
      if (action) {
        try { OBR.action.close(); return; } catch (e) { /* 降级走旧逻辑 */ }
      }
      closeSelf(ID_DICE_WIN, "dice");
    })();
  });

  if (els.diceRow) {
    els.diceRow.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-die]") : null;
      if (!btn) return;
      ev.preventDefault();
      onDieClick(btn.getAttribute("data-die"), 1);
    });
    els.diceRow.addEventListener("contextmenu", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-die]") : null;
      if (!btn) return;
      ev.preventDefault();
      onDieClick(btn.getAttribute("data-die"), -1);
    });
  }

  if (els.btnModMinus) els.btnModMinus.addEventListener("click", function () { onModifierStep(-1); });
  if (els.btnModPlus) els.btnModPlus.addEventListener("click", function () { onModifierStep(1); });
  if (els.btnAdvantage) els.btnAdvantage.addEventListener("click", onAdvantage);
  if (els.btnCrit) els.btnCrit.addEventListener("click", onCrit);
  if (els.btnRoll) els.btnRoll.addEventListener("click", function () { void doRoll(); });
  if (els.btnSave) els.btnSave.addEventListener("click", onSaveCombo);
  if (els.btnClear) els.btnClear.addEventListener("click", function () { void clearHistory(); });
  if (els.btnHist) els.btnHist.addEventListener("click", function () { void toggleHistory(); });

  if (els.btnLast) {
    els.btnLast.addEventListener("click", function () {
      if (!lastExpr) {
        shake(els.btnLast);
        feedback("还没有掷过骰子：先掷一次，「上一次」会记住最后的公式", "WARNING");
        return;
      }
      applyParsed(parseExpr(lastExpr));
      /* v1.7.8：「已填入上一次的公式」不再弹（公式框里当场就填上了）。 */
    });
  }

  if (els.exprInput) {
    els.exprInput.addEventListener("input", function () {
      if (advOn) {
        advOn = false;
        if (els.btnAdvantage) els.btnAdvantage.classList.remove("on");
      }
      pendingMode = "free";
      pendingLabel = "";
      readInput();
    });
    els.exprInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void doRoll();
      }
    });
  }

  if (els.presets) {
    els.presets.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".preset-btn") : null;
      if (!btn) return;
      applyParsed(parseExpr(btn.getAttribute("data-expr") || ""));
      pendingMode = btn.getAttribute("data-mode") || "free";
      pendingLabel = btn.getAttribute("data-name") || "";
      /* v1.7.8：「已填入：…」不再弹（公式框里当场就填上了）。 */
    });
  }

  if (els.combos) els.combos.addEventListener("click", onComboClick);
}

/* ---------------------------------------------------------------------------
 * 7) 启动
 * ------------------------------------------------------------------------- */
onReady(function () {
  wireEvents();
  /* v1.9.2：异步确认是不是 action 弹窗（用于 CSS / ✕ 行为；拿不到就当 false）。 */
  void actionModeNow().then(function (open) {
    ACTION_MODE = !!open;
    if (ACTION_MODE) document.body.classList.add("dice-action");
  }, function () { /* 忽略 */ });

  var saved = lsGet(LS_DICE_LAST);
  if (saved) {
    els.exprInput.value = saved;
    readInput();
  } else {
    applyParsed(parseExpr("1d20"));
  }
  if (els.btnAdvantage) els.btnAdvantage.title = "4E 战斗优势：公式 +2（再点一下撤回）";
  /* v1.8.0：重击只取满**伤害骰** —— d20（攻击 / 豁免）与减法骰保持真实值。 */
  if (els.btnCrit) els.btnCrit.title = "4E 重击：伤害骰取最大值（d6→6），d20 与减法骰不取满；不是骰数翻倍";
  loadCombos();
  setHistButton(false);

  /* 身份：广播里的名字 / 颜色，以及「清空只有城主能做」 */
  (async function identify() {
    /* 每个字段各自 try：任意一个 API 不可用都不该把「是不是城主」一起带掉 */
    try { myId = (await OBR.player.getId()) || ""; } catch (e1) { myId = ""; }
    try { myName = (await OBR.player.getName()) || "我"; } catch (e2) { myName = "我"; }
    try { myColor = (await OBR.player.getColor()) || "#5dade2"; } catch (e3) { myColor = "#5dade2"; }
    try { isGM = (await OBR.player.getRole()) === "GM"; } catch (e4) { isGM = false; }
    if (els.btnClear) {
      els.btnClear.title = "清空本机骰子记录（并通知其它人清空）";
      els.btnClear.classList.remove("ghost");
    }
    await refreshPresets();
  })();

  /* v1.9.2：别人掷的骰子（REMOTE / LOCAL）也落进本机历史，记录窗口随后打开就能看到。 */
  try {
    OBR.broadcast.onMessage(CH_ROLL, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      if (data && data.rollId) appendDiceHistoryRow(data);
    });
  } catch (e) { /* 忽略 */ }

  /* 记录窗口的开 / 关状态（后台执行完命令后广播回来）—— v1.7.4：回执一到就收掉计时器，
   * 不会再多此一举地「本页兜底开一次」。 */
  try {
    OBR.broadcast.onMessage(CH_DICE_HIST_STATE, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      endHistPending();
      setHistButton(!!(data && data.open));
    });
  } catch (e4) { /* 忽略 */ }

  /* 选中不同的 token → 换预设 */
  try {
    OBR.player.onChange(function () {
      setTimeout(function () { void refreshPresets(); }, 120);
    });
  } catch (e3) { /* 忽略 */ }

  win.onStatus(function (state) {
    if (state === "bad") {
      flash("后台未连接：掷骰仍可用，但结果不会写进房间数据（别人看不到）。", "WARNING");
    }
  });
});