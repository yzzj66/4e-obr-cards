// v1.7.0：骰子记录窗口的页面脚本（dice-history.html）。
// ---------------------------------------------------------------------------
// 为什么单独一个页面（而不是骰子窗口里的一块）：
//   用户要「独立可拖动的显示框」——参考实现 FullPeople/obr-suite 的 history-page 也是独立 iframe。
//   于是它有自己的 popover id（com.4enext-owlbear/dice-history-window）、自己记位置、自己开关；
//   骰子窗口只发 CH_DICE_HIST_CMD 让后台开 / 关它。
//
// 数据来源（与 v1.5.0 完全相同，没有新协议）：
//   · 房间数据 com.4enext-owlbear/rolls（城主客户端落笔，rows 40 条封顶、超出删最旧）
//   · 本机暂存 4enext/dice/local（城主不在线时自己掷的那几条）
//   · 广播 CH_ROLL（本机乐观插入）/ CH_ROLL_SAVED（重读）/ CH_ROLL_CLEAR（清空）
// 显示：默认**最近 4 条**（.dh-list.compact 隐藏第 5 条起），点「展开全部」看全部（列表内滚动）。
// 这里**只读**：不写房间数据、不写 token（清空仍然只在骰子窗口里由城主做）。
import OBR from "../vendor/obr-sdk.js";
import { CH_DICE_HIST_CMD, CH_ROLL, CH_ROLL_CLEAR, CH_ROLL_SAVED, HIST_VISIBLE_ROWS, ID_DICE_HIST, KEY_ROLLS, LS_DICE_LOCAL, ROLL_MAX_ROWS, esc, onReady } from "./common.js";
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
  if (els.meta) els.meta.textContent = "共 " + rows.length + " / " + ROLL_MAX_ROWS + " 条";
  els.list.classList.toggle("compact", !expanded);
  paintToggle();
  if (!rows.length) {
    els.list.innerHTML = '<div class="hist-empty">还没有人掷过骰子。掷一次就会出现在这里（全桌共享）。</div>';
    return;
  }
  var html = "";
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var mode = r.mode && r.mode !== "free" ? MODE_LABEL[r.mode] || "" : "";
    var lab = [mode, r.label].filter(Boolean).join(" · ");
    html += '<div class="hist-row dh-row" title="' + esc(r.expression || "") + '">' +
      '<div class="hist-top">' +
      '<span class="hist-who" style="color:' + esc(r.rollerColor || "#5dade2") + '">' + esc(r.rollerName || "某人") + "</span>" +
      (lab ? '<span class="hist-lab">' + esc(lab) + "</span>" : "") +
      '<span class="hist-total">' + esc(String(r.total)) + "</span>" +
      '<span class="hist-time">' + esc(clockOf(r.ts)) + "</span>" +
      "</div>" +
      '<div class="hist-chips">' + chipsHTML(r) + "</div>" +
      "</div>";
  }
  els.list.innerHTML = html;
}

/** 房间数据 + 本机暂存合起来（同 rollId 只留一条，按 ts 倒序，40 封顶）。 */
function mergeLocal(remote) {
  var out = remote.slice();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var dup = false;
    for (var j = 0; j < out.length; j++) if (out[j].rollId === r.rollId) { dup = true; break; }
    if (!dup) out.push(r);
  }
  out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return out.slice(0, ROLL_MAX_ROWS);
}

async function readRows() {
  var remote = [];
  try {
    var meta = await OBR.room.getMetadata();
    remote = rowsFromRaw(meta ? meta[KEY_ROLLS] : null);
  } catch (e) { /* 读不到就只显示本机暂存 */ }
  rows = mergeLocal(remote);
  renderRows();
}

/** 启动时把本机暂存（城主离线时掷的）也显示出来，别让人以为丢了。 */
function loadLocalStash() {
  try {
    var raw = lsGet(LS_DICE_LOCAL);
    var list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list) || !list.length) return;
    rows = mergeLocal(rowsFromRaw(list));
    renderRows();
    showWarn("本机暂存了 " + list.length + " 条城主离线时的投掷（只在这台机器上）。", true);
  } catch (e) { /* 忽略 */ }
}

/** 关掉自己：**先告诉后台**（它要把 winOpen 里这条清掉并广播 open:false），
 *  再 closeSelf 兜底 —— 否则后台以为窗口还开着，骰子窗口的「记录窗口」按钮就点不开了。 */
function closeHistoryWindow() {
  try {
    var p = OBR.broadcast.sendMessage(CH_DICE_HIST_CMD, { op: "close", at: Date.now() }, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来 */ });
  } catch (e) { /* 忽略 */ }
  closeSelf(ID_DICE_HIST);
}

function wireEvents() {
  if (els.close) els.close.addEventListener("click", closeHistoryWindow);
  if (els.toggle) {
    els.toggle.addEventListener("click", function () {
      expanded = !expanded;
      renderRows();
    });
  }
}

onReady(function () {
  if (els.toggle) els.toggle.title = "在「最近 " + HIST_VISIBLE_ROWS + " 条」和全部记录之间切换";
  wireEvents();
  renderRows();

  (async function init() {
    await readRows();
    loadLocalStash();
  })();

  /* 有人投掷：本机立刻插一条（不等城主落库）；别的玩家靠 room.onMetadataChange 同步 */
  try {
    OBR.broadcast.onMessage(CH_ROLL, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      if (!data || !data.rollId) return;
      rows = mergeRollRows(rows, data, ROLL_MAX_ROWS);
      renderRows();
    });
  } catch (e) { /* 忽略 */ }

  try {
    OBR.broadcast.onMessage(CH_ROLL_SAVED, function () { void readRows(); });
  } catch (e2) { /* 忽略 */ }

  try {
    OBR.broadcast.onMessage(CH_ROLL_CLEAR, function () {
      rows = [];
      renderRows();
      showWarn("");
      feedback("全桌记录已被城主清空", "INFO");
    });
  } catch (e3) { /* 忽略 */ }

  try {
    OBR.room.onMetadataChange(function () { void readRows(); });
  } catch (e4) { /* 忽略 */ }

  win.onStatus(function (state) {
    if (state === "bad") showWarn("后台未连接：这里显示的是房间数据里的旧记录，新投掷要等后台恢复。");
    else if (state === "ok" && !warnSticky) showWarn("");
  });
});
