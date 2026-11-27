// v1.7.0：骰子记录窗口的页面脚本（dice-history.html）。
// ---------------------------------------------------------------------------
// 为什么单独一个页面（而不是骰子窗口里的一块）：
//   用户要「独立可拖动的显示框」——参考实现 FullPeople/obr-suite 的 history-page 也是独立 iframe。
//   于是它有自己的 popover id（com.4enext-owlbear/dice-history-window）、自己记位置、自己开关；
//   骰子窗口只发 CH_DICE_HIST_CMD 让后台开 / 关它。
//
// 数据来源（v1.9.2：全部来自本机）：
//   · localStorage 4enext/dice-history/<roomId>（按房间隔离，20 条封顶、按 rollId 去重）
//   · 旧版本机暂存 4enext/dice/local 启动时合并进来
//   · 广播 CH_ROLL（收到即追加）/ CH_ROLL_CLEAR（清空）
// 显示：默认**最近 4 条**（.dh-list.compact 隐藏第 5 条起），点「展开全部」看全部（列表内滚动）。
// 这里**只读**：不写房间数据、不写 token（清空仍然只在骰子窗口里由城主做）。
//
// v1.7.4：加载完先发一条 { op: "ready" } 握手给后台（CH_DICE_HIST_CMD）——
//   万一是骰子窗口自己 OBR.popover.open 开的，后台的 winOpen 里可能没有这一条；
//   握手一来就把「开着」补上，之后点「记录窗口」才是**关闭**（不会又开一遍）。
// v1.7.6：加载完还**自己**调 OBR.popover.getWidth(ID_DICE_HIST) 确认存活（见 confirmAlive）——
//   骰子窗口那侧已经直开 + getWidth 复核，这边再独立复核一次，窗口不在就黄条说明。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_DICE_HIST_CMD, CH_ROLL, CH_ROLL_CLEAR, HIST_VISIBLE_ROWS, ID_DICE_HIST, LS_DICE_LOCAL, ROLL_MAX_ROWS,
  appendDiceHistoryRow, clearDiceHistory, esc, onReady, readDiceHistoryRows, writeDiceHistoryRows
} from "./common.js";
import { repeatRowLines, rollLine } from "./dice-core.js?v=2.4.35";
import { closeSelf, createWindow, feedback } from "./window.js";
import { mergeRollRows, rowsFromRaw, sidesOf } from "./dice-core.js";

var win = createWindow({ name: "diceHistory" });

var els = {
  head: document.getElementById("head"),
  close: document.getElementById("close"),
  list: document.getElementById("dh-list"),
  meta: document.getElementById("dh-meta"),
  toggle: document.getElementById("dh-toggle"),
  warn: document.getElementById("dh-warn")
};

var MODE_LABEL = { attack: "攻击", damage: "伤害", save: "豁免", skill: "技能", init: "先攻", free: "投掷" };
/** v1.7.10：窗口默认 300×240（4 条 × 26 行高刚好放下）；「展开全部」才临时变高。 */
var HIST_H = 240;
var EXPANDED_H = 520;
var rows = [];
var expanded = false;
/** 本机暂存的提示是「常驻」的（后台恢复在线也不该把它盖掉）。 */
var warnSticky = false;

function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function clockOf(ts) {
  try {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
  } catch (e) {
    return "";
  }
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

function showWarn(msg, sticky) {
  if (!els.warn) return;
  warnSticky = !!sticky;
  if (!msg) { els.warn.hidden = true; els.warn.textContent = ""; return; }
  els.warn.hidden = false;
  els.warn.textContent = msg;
}

function paintToggle() {
  if (!els.toggle) return;
  var n = rows.length;
  if (n <= HIST_VISIBLE_ROWS) {
    els.toggle.hidden = true;
    return;
  }
  els.toggle.hidden = false;
  els.toggle.textContent = expanded ? "只看最近 " + HIST_VISIBLE_ROWS + " 条" : "展开全部（" + n + "）";
}

function renderRows() {
  if (!els.list) return;
  if (els.meta) els.meta.textContent = "本机共 " + rows.length + " / " + ROLL_MAX_ROWS + " 条";
  els.list.classList.toggle("compact", !expanded);
  paintToggle();
  if (!rows.length) {
    els.list.innerHTML = "";
    return;
  }
  var html = "";
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var mode = r.mode && r.mode !== "free" ? MODE_LABEL[r.mode] || "" : "";
    var lab = [mode, r.label].filter(Boolean).join(" · ");
    /* v1.7.10：紧凑行 —— 「名字 · 公式 + 点数 + 时间」，行高 26 / 字号 11（骰子明细收进 title）。 */
    var rowsHtml = "";
    var lines = repeatRowLines(r);
    if (!lines.length) {
      var eq = rollLine(r);
      if (eq) lines = [eq];
    }
    if (lines.length) {
      rowsHtml = '<div class="hist-rows">' + lines.map(function (t) {
        return '<div class="hist-line">' + esc(t) + "</div>";
      }).join("") + "</div>";
    }
    html += '<div class="hist-row dh-row" title="' + esc([lab, r.expression, chipsHTML(r).replace(/<[^>]+>/g, " ")].filter(Boolean).join(" · ")) + '">' +
      '<div class="hist-top">' +
      '<span class="hist-who" style="color:' + esc(r.rollerColor || "#5dade2") + '">' + esc(r.rollerName || "某人") + "</span>" +
      '<span class="hist-total">' + esc(String(r.total)) + "</span>" +
      '<span class="hist-time">' + esc(clockOf(r.ts)) + "</span>" +
      "</div>" +
      (chipsHTML(r) ? '<div class="hist-chips">' + chipsHTML(r) + "</div>" : "") + rowsHtml +
      "</div>";
  }
  els.list.innerHTML = html;
}

/** v1.9.2：历史全部来自**本机**（localStorage，按房间隔离）；不再读房间数据。 */
function readRows() {
  rows = rowsFromRaw(readDiceHistoryRows());
  renderRows();
}

/** 把旧版「城主离线时本机暂存」(LS_DICE_LOCAL) 并进新本机历史，然后删掉旧键。 */
function migrateLegacyLocal() {
  try {
    var raw = lsGet(LS_DICE_LOCAL);
    if (!raw) return;
    var list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) { localStorage.removeItem(LS_DICE_LOCAL); return; }
    var merged = rows.slice();
    var legacy = rowsFromRaw(list);
    for (var i = 0; i < legacy.length; i++) merged = mergeRollRows(merged, legacy[i], ROLL_MAX_ROWS);
    rows = merged;
    writeDiceHistoryRows(rows);
    localStorage.removeItem(LS_DICE_LOCAL);
    if (legacy.length) showWarn("已把旧版本机暂存的 " + legacy.length + " 条记录并入本机历史。", false);
  } catch (e) { /* 忽略 */ }
}

/** v1.7.6：记录窗口页面加载完**自己**确认「真的活着」——
 *  OBR.popover.getWidth(自己的 id) 对已经关掉的 popover 会 reject / 返回 0；
 *  拿不到就说明这个 iframe 已经不在宿主里了（比如被别的窗口顶掉），在黄条里说清楚，
 *  别让用户对着一个空列表猜。 */
async function confirmAlive() {
  var w = 0;
  try {
    w = await OBR.popover.getWidth(ID_DICE_HIST);
  } catch (e) {
    w = 0;
  }
  if (typeof w === "number" && w > 0) return true;
  showWarn("这个记录窗口已经不在宿主里了（可能被其它窗口顶掉）：请从骰子窗口的「记录窗口」重新打开。", true);
  return false;
}

/** v1.7.4：告诉后台「记录窗口的页面起来了」（握手，见文件头的说明）。 */
function sayReady() {
  try {
    var p = OBR.broadcast.sendMessage(CH_DICE_HIST_CMD, { op: "ready", at: Date.now() }, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就算了 */ });
  } catch (e) { /* 忽略 */ }
}

/** 关掉自己：**先告诉后台**（它要把 winOpen 里这条清掉并广播 open:false），
 *  再 closeSelf 兜底 —— 否则后台以为窗口还开着，骰子窗口的「记录窗口」按钮就点不开了。 */
function closeHistoryWindow() {
  try {
    var p = OBR.broadcast.sendMessage(CH_DICE_HIST_CMD, { op: "close", at: Date.now() }, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来 */ });
  } catch (e) { /* 忽略 */ }
  /* v1.7.10：再走一次「popover.close(正确 id) + 后台 {op:"close-win"}」双保险。 */
  closeSelf(ID_DICE_HIST, "diceHistory");
}

function wireEvents() {
  if (els.close) els.close.addEventListener("click", closeHistoryWindow);
  if (els.toggle) {
    els.toggle.addEventListener("click", function () {
      expanded = !expanded;
      renderRows();
      /* v1.7.10：默认 240 高只显示 4 条；「展开全部」才临时变高（最多 20 条，列表内滚动）。 */
      try {
        var p = OBR.popover.setHeight(ID_DICE_HIST, expanded ? EXPANDED_H : HIST_H);
        if (p && typeof p.catch === "function") p.catch(function () { /* 不是 popover 时忽略 */ });
      } catch (e) { /* 忽略 */ }
    });
  }
}

onReady(function () {
  if (els.toggle) els.toggle.title = "在「最近 " + HIST_VISIBLE_ROWS + " 条」和全部记录之间切换";
  wireEvents();
  sayReady();
  void confirmAlive();   /* v1.7.6：自己确认窗口还在（getWidth 不报错 / > 0） */
  renderRows();

  (function init() {
    readRows();
    migrateLegacyLocal();
    readRows();
  })();

  /* 有人投掷（含自己的 LOCAL 回声 / 别人的 REMOTE）：写进本机历史并重画。 */
  try {
    OBR.broadcast.onMessage(CH_ROLL, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      if (!data || !data.rollId) return;
      var one = rowsFromRaw([data])[0];
      if (!one) return;
      rows = rowsFromRaw(appendDiceHistoryRow(one));
      renderRows();
    });
  } catch (e) { /* 忽略 */ }

  try {
    OBR.broadcast.onMessage(CH_ROLL_CLEAR, function () {
      clearDiceHistory();
      rows = [];
      renderRows();
      showWarn("");
      /* v1.7.8：「全桌记录已被城主清空」不再弹（列表当场清空，看得见）。 */
    });
  } catch (e3) { /* 忽略 */ }

  win.onStatus(function (state) {
    if (state === "bad") showWarn("后台未连接：本机记录仍可查看；新投掷可能同步不到其它人。");
    else if (state === "ok" && !warnSticky) showWarn("");
  });
});
