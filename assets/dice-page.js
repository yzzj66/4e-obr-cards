// v1.5.0：骰子独立窗口的页面脚本（dice.html 的两栏 UI）。
// ---------------------------------------------------------------------------
// 分工：
//   · 规则 / 解析 / 掷骰 / 归一化全在 assets/dice-core.js（纯函数，node 可测）；
//   · 4E 预设（攻击 / 伤害 / 豁免 / 技能 / 先攻）在 assets/dice-4e.js，**有绑定卡时才动态 import**
//     （它会拉进 glance.js + data/rules.js，约 190KB）；
//   · 本文件只管 DOM、广播、房间数据与本机存储。
//
// 用户拍板（覆盖规格 D1–D3）：
//   · 只显示点数：没有 TN 输入，没有命中 / 未命中 / 成功失败；
//   · 重击 = 4E 版：所有伤害骰取满（d6→6），结果面板标注「重击 · 已取满」；
//   · 没有优势 / 劣势按钮、没有暗骰、没有示例框。
//
// 团队共享（规格 §4）：投掷 → CH_ROLL（LOCAL + REMOTE）→ 城主客户端后台校验合并 →
// 写房间数据 com.4enext-owlbear/rolls → 广播 CH_ROLL_SAVED → 所有人重读右栏历史（40 条封顶）。
// 城主不在线：本机暂存 + 顶部黄条（玩家只读，清空只有城主能做）。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_ROLL, CH_ROLL_CLEAR, CH_ROLL_SAVED, ID_DICE_WIN, KEY_BIND, KEY_ROLLS,
  LS_DICE_COMBOS, LS_DICE_LAST, LS_DICE_LOCAL, ROLL_MAX_ROWS,
  esc, findCard, getCards, onReady
} from "./common.js";
import { closeSelf, createWindow, feedback } from "./window.js";
import {
  ROLL_CRIT_NOTE, adjustExprForType, adjustExprModifier, countDiceByType,
  formatExpr, makeRollId, mergeRollRows, parseExpr, parsedIsEmpty, rollParsed, rollToPayload,
  rowTotals, rowsFromRaw, sidesOf
} from "./dice-core.js";

var win = createWindow({ name: "dice" });

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
  presets: document.getElementById("presets"),
  presetMeta: document.getElementById("presetMeta"),
  defenseRef: document.getElementById("defenseRef"),
  combos: document.getElementById("combos"),
  comboName: document.getElementById("comboName"),
  result: document.getElementById("result"),
  list: document.getElementById("list"),
  shareWarn: document.getElementById("share-warn"),
  histMeta: document.getElementById("histMeta")
};

var MODE_LABEL = { attack: "攻击", damage: "伤害", save: "豁免", skill: "技能", init: "先攻", free: "投掷" };

/* ---- 状态 ---- */
var exprParsed = parseExpr("1d20");
var advOn = false;
var critOn = false;
var rows = [];
var myId = "";
var myName = "我";
var myColor = "#5dade2";
var isGM = false;
var busy = false;
var lastExpr = "";
var pendingMode = "free";
var pendingLabel = "";
var comboList = [];
var savedIds = {};
var pendingSaves = {};
var presetBusy = false;

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
function clockOf(ts) {
  try {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
  } catch (e) {
    return "";
  }
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
function showWarn(msg) {
  if (!els.shareWarn) return;
  els.shareWarn.hidden = false;
  els.shareWarn.textContent = msg;
}
function hideWarn() {
  if (els.shareWarn) els.shareWarn.hidden = true;
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
  flash(type + (delta > 0 ? " +1" : " −1") + " → " + formatExpr(exprParsed), "INFO");
}

function onModifierStep(delta) {
  applyParsed(adjustExprModifier(parseExpr(els.exprInput ? els.exprInput.value : ""), delta));
  pendingMode = "free";
  pendingLabel = "";
  flash("加值 " + (delta > 0 ? "+1" : "−1") + " → " + formatExpr(exprParsed), "INFO");
}

/** 4E「战斗优势」= 加值 +2（点一下加，再点一下撤回）。 */
function onAdvantage() {
  advOn = !advOn;
  applyParsed(adjustExprModifier(parseExpr(els.exprInput ? els.exprInput.value : ""), advOn ? 2 : -2));
  if (els.btnAdvantage) els.btnAdvantage.classList.toggle("on", advOn);
  flash(advOn ? "战斗优势：公式 +2" : "战斗优势已撤回（−2）", advOn ? "SUCCESS" : "INFO");
}

function onCrit() {
  critOn = !critOn;
  if (els.btnCrit) els.btnCrit.classList.toggle("on", critOn);
  flash(critOn ? "重击：本次投掷所有伤害骰取满（d6→6）" : "重击已关闭", critOn ? "SUCCESS" : "INFO");
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
  if (row.crit) tags += '<span class="res-tag crit">重击 · 已取满</span>';
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

function renderRows() {
  if (!els.list) return;
  if (els.histMeta) els.histMeta.textContent = "共 " + rows.length + " / " + ROLL_MAX_ROWS + " 条";
  if (!rows.length) {
    els.list.innerHTML = '<div class="hist-empty">还没有人掷过骰子。掷一次就会出现在这里（全桌共享）。</div>';
    return;
  }
  var html = "";
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var mode = r.mode && r.mode !== "free" ? MODE_LABEL[r.mode] || "" : "";
    var lab = [mode, r.label].filter(Boolean).join(" · ");
    html += '<div class="hist-row" title="' + esc(r.expression || "") + '">' +
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

function rollSaved(rollId) {
  return !!(rollId && savedIds[rollId]);
}

function markSaved(rollId) {
  if (!rollId) return;
  savedIds[rollId] = Date.now();
  if (pendingSaves[rollId]) {
    clearTimeout(pendingSaves[rollId]);
    delete pendingSaves[rollId];
  }
  hideWarn();
}

function stashLocal(row) {
  try {
    var raw = lsGet(LS_DICE_LOCAL);
    var list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list.unshift(row);
    lsSet(LS_DICE_LOCAL, JSON.stringify(list.slice(0, 20)));
  } catch (e) { /* 本机也存不下就算了，结果面板还在 */ }
}

/** 等 1.2 秒看有没有落库：没有就是城主不在线 / 后台没起来。 */
function watchSave(row) {
  if (pendingSaves[row.rollId]) clearTimeout(pendingSaves[row.rollId]);
  pendingSaves[row.rollId] = setTimeout(function () {
    delete pendingSaves[row.rollId];
    if (rollSaved(row.rollId)) return;
    if (win.state === "bad") {
      showWarn("后台未连接：这次结果没能写进房间数据（只有本机看得到）。");
    } else if (!isGM) {
      stashLocal(row);
      showWarn("城主不在线：本次结果只在本机（暂存最多 20 条），不会再同步给别人。");
    } else {
      showWarn("没能写进房间数据：这次结果只有本机看得到（房间数据可能已满）。");
    }
  }, 1200);
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
    rows = mergeRollRows(rows, payload, ROLL_MAX_ROWS);
    renderRows();

    if (payload.critDegraded) {
      flash("重击未生效：公式里有包裹（adv / max 等），本次按普通投掷", "WARNING");
    } else {
      flash((payload.crit ? "重击 · 已取满：" : "掷出：") + formatExpr(parsed) + " = " + payload.total +
        (result.rowCount > 1 ? "（" + result.rowCount + " 行）" : ""), "SUCCESS");
    }

    var sent = await broadcast(CH_ROLL, payload);
    if (!sent) showWarn("广播没发出去：后台未连接，这次结果只有本机看得到。");
    watchSave(payload);
  } catch (e) {
    feedback("投掷失败：" + (e && e.message ? e.message : e), "ERROR");
  } finally {
    setTimeout(function () { busy = false; }, 260);
  }
}

/* ---------------------------------------------------------------------------
 * 3) 房间数据（团队共享历史）
 * ------------------------------------------------------------------------- */
function mergeLocalRows(remote) {
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
    var box = meta ? meta[KEY_ROLLS] : null;
    remote = rowsFromRaw(box);
    for (var i = 0; i < remote.length; i++) markSaved(remote[i].rollId);
  } catch (e) {
    /* 读不到就只显示本机乐观结果 */
  }
  rows = mergeLocalRows(remote);
  renderRows();
}

/** 启动时把本机暂存（城主离线时掷的）一起显示出来，别让人以为丢了。 */
function loadLocalStash() {
  try {
    var raw = lsGet(LS_DICE_LOCAL);
    var list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list) || !list.length) return;
    rows = mergeLocalRows(rowsFromRaw(list));
    renderRows();
    showWarn("本机暂存了 " + list.length + " 条城主离线时的投掷（只在这台机器上）。");
  } catch (e) { /* 忽略 */ }
}

async function clearHistory() {
  if (!isGM) {
    feedback("只有城主能清空全桌记录（房间数据只有城主能写）", "WARNING");
    return;
  }
  if (els.btnClear && els.btnClear.getAttribute("data-armed") === "1") {
    els.btnClear.setAttribute("data-armed", "0");
    els.btnClear.textContent = "清空记录";
    await broadcast(CH_ROLL_CLEAR, { by: myId, at: Date.now() });
    rows = [];
    lsDel(LS_DICE_LOCAL);
    renderRows();
    hideWarn();
    feedback("已请求清空全桌记录", "SUCCESS");
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
    els.presets.innerHTML = '<p class="muted small">选中一枚<b>已绑定角色卡</b>的 token，这里会出现攻击 / 伤害 / 豁免 / 技能 / 先攻预设（只填公式，不判定）。</p>';
    if (els.defenseRef) els.defenseRef.innerHTML = "";
    if (els.presetMeta) els.presetMeta.textContent = "未选中绑定卡";
    return;
  }
  if (els.presetMeta) els.presetMeta.textContent = (cardName || data.name) + " · 只填公式，不判定";

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

  if (els.defenseRef) {
    var defs = data.defenses || [];
    if (defs.length) {
      var ref = '<span class="def-lab">防御参考</span>';
      for (var k = 0; k < defs.length; k++) {
        ref += '<span class="def-chip">' + esc(defs[k].label) + " " + esc(String(defs[k].value)) + "</span>";
      }
      els.defenseRef.innerHTML = ref;
    } else {
      els.defenseRef.innerHTML = "";
    }
  }
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
    els.combos.innerHTML = '<p class="muted small">还没有组合。填好公式 → 点「保存组合」，下次一键填回来（只存本机）。</p>';
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
  feedback("已保存组合：" + name.slice(0, 24), "SUCCESS");
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
    feedback("组合已删除", "INFO");
    return;
  }
  var use = target.closest(".combo-use");
  if (!use) return;
  var cid = use.getAttribute("data-id");
  for (var i = 0; i < comboList.length; i++) {
    if (comboList[i].id !== cid) continue;
    applyParsed(parseExpr(comboList[i].expr));
    flash("已填入组合：" + comboList[i].name, "INFO");
    return;
  }
}

/* ---------------------------------------------------------------------------
 * 6) 事件绑定
 * ------------------------------------------------------------------------- */
function wireEvents() {
  if (els.close) els.close.addEventListener("click", function () { closeSelf(ID_DICE_WIN); });

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

  if (els.btnLast) {
    els.btnLast.addEventListener("click", function () {
      if (!lastExpr) {
        shake(els.btnLast);
        feedback("还没有掷过骰子：先掷一次，「上一次」会记住最后的公式", "WARNING");
        return;
      }
      applyParsed(parseExpr(lastExpr));
      flash("已填入上一次的公式：" + formatExpr(exprParsed), "INFO");
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
      flash("已填入：" + formatExpr(exprParsed) + "（只显示点数，不判定）", "INFO");
    });
  }

  if (els.combos) els.combos.addEventListener("click", onComboClick);
}

/* ---------------------------------------------------------------------------
 * 7) 启动
 * ------------------------------------------------------------------------- */
onReady(function () {
  wireEvents();

  var saved = lsGet(LS_DICE_LAST);
  if (saved) {
    els.exprInput.value = saved;
    readInput();
  } else {
    applyParsed(parseExpr("1d20"));
  }
  if (els.btnAdvantage) els.btnAdvantage.title = "4E 战斗优势：公式 +2（再点一下撤回）";
  if (els.btnCrit) els.btnCrit.title = "4E 重击：所有伤害骰取最大值（d6→6），不是骰数翻倍";
  loadCombos();
  renderRows();

  /* 身份：广播里的名字 / 颜色，以及「清空只有城主能做」 */
  (async function identify() {
    /* 每个字段各自 try：任意一个 API 不可用都不该把「是不是城主」一起带掉 */
    try { myId = (await OBR.player.getId()) || ""; } catch (e1) { myId = ""; }
    try { myName = (await OBR.player.getName()) || "我"; } catch (e2) { myName = "我"; }
    try { myColor = (await OBR.player.getColor()) || "#5dade2"; } catch (e3) { myColor = "#5dade2"; }
    try { isGM = (await OBR.player.getRole()) === "GM"; } catch (e4) { isGM = false; }
    if (els.btnClear) {
      els.btnClear.title = isGM ? "清空全桌记录（要点两次）" : "只有城主能清空全桌记录";
      els.btnClear.classList.toggle("ghost", !isGM);
    }
    await readRows();
    loadLocalStash();
    await refreshPresets();
  })();

  /* 房间数据变化 = 有人投掷 / 城主清空 → 重画右栏 */
  try {
    OBR.room.onMetadataChange(function () { void readRows(); });
  } catch (e) { /* 忽略 */ }

  /* 城主写完房间数据会广播 saved：清掉「未落库」计时器 */
  try {
    OBR.broadcast.onMessage(CH_ROLL_SAVED, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      if (data && data.rollId) markSaved(String(data.rollId));
      void readRows();
    });
  } catch (e2) { /* 忽略 */ }

  /* 选中不同的 token → 换预设 */
  try {
    OBR.player.onChange(function () {
      setTimeout(function () { void refreshPresets(); }, 120);
    });
  } catch (e3) { /* 忽略 */ }

  win.onStatus(function (state) {
    if (state === "bad") {
      showWarn("后台未连接：掷骰仍可用，但结果不会写进房间数据（别人看不到）。");
    } else if (state === "ok") {
      if (els.btnClear && !els.btnClear.getAttribute("data-armed")) hideWarn();
    }
  });
});
