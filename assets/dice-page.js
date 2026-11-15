// v1.7.0：骰子窗口的页面脚本（dice.html，**单列**）。
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
// 团队共享（不变）：投掷 → CH_ROLL（LOCAL + REMOTE）→ 城主客户端后台校验合并 →
// 写房间数据 com.4enext-owlbear/rolls（40 条封顶，超出删最旧）→ 广播 CH_ROLL_SAVED。
// 城主不在线：本机暂存 + 提示（玩家只读，清空只有城主能做）。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_DICE_HIST_CMD, CH_DICE_HIST_STATE, CH_ROLL, CH_ROLL_CLEAR, CH_ROLL_SAVED,
  ID_DICE_WIN, KEY_BIND, KEY_ROLLS, LS_DICE_COMBOS, LS_DICE_LAST, LS_DICE_LOCAL,
  NS, URL_EFFECT,
  esc, findCard, getCards, onReady, readDiceAnim
} from "./common.js";
import { closeSelf, createWindow, feedback } from "./window.js";
import {
  ROLL_CRIT_NOTE, adjustExprForType, adjustExprModifier, countDiceByType,
  formatExpr, fxQuery, makeRollId, parseExpr, parsedIsEmpty, rollParsed, rollToPayload,
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
  btnHist: document.getElementById("btnHist"),
  presets: document.getElementById("presets"),
  presetMeta: document.getElementById("presetMeta"),
  defenseRef: document.getElementById("defenseRef"),
  combos: document.getElementById("combos"),
  comboName: document.getElementById("comboName"),
  result: document.getElementById("result"),
  animMeta: document.getElementById("animMeta")
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
var savedIds = {};
var pendingSaves = {};
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
function paintAnimMeta() {
  if (els.animMeta) els.animMeta.textContent = "投骰动画：" + (readDiceAnim() ? "开" : "关");
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
      flash("后台未连接：这次结果没能写进房间数据（只有本机看得到）。", "WARNING");
    } else if (!isGM) {
      stashLocal(row);
      flash("城主不在线：本次结果只在本机（暂存最多 20 条），不会再同步给别人。", "WARNING");
    } else {
      flash("没能写进房间数据：这次结果只有本机看得到（房间数据可能已满）。", "WARNING");
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
    paintAnimMeta();

    if (payload.critDegraded) {
      flash("重击未生效：公式里有包裹（adv / max 等），本次按普通投掷", "WARNING");
    } else {
      flash((payload.crit ? "重击 · 已取满：" : "掷出：") + formatExpr(parsed) + " = " + payload.total +
        (result.rowCount > 1 ? "（" + result.rowCount + " 行）" : ""), "SUCCESS");
    }

    var sent = await broadcast(CH_ROLL, payload);
    if (!sent) flash("广播没发出去：后台未连接，这次结果只有本机看得到。", "WARNING");
    watchSave(payload);

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
 * 3) 房间数据（只用来判断「我这条落库了没」+ 清空；列表在记录窗口里画）
 * ------------------------------------------------------------------------- */
async function readSavedFlags() {
  try {
    var meta = await OBR.room.getMetadata();
    var box = meta ? meta[KEY_ROLLS] : null;
    var remote = rowsFromRaw(box);
    for (var i = 0; i < remote.length; i++) markSaved(remote[i].rollId);
  } catch (e) {
    /* 读不到就算了：watchSave 会按「没落库」提示 */
  }
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
    lsDel(LS_DICE_LOCAL);
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
 * 3.5) 记录窗口（独立 popover，本窗口只管发开关命令 + 显示开 / 关）
 * ------------------------------------------------------------------------- */
function setHistButton(open) {
  histOpen = !!open;
  if (!els.btnHist) return;
  els.btnHist.classList.toggle("on", histOpen);
  els.btnHist.textContent = histOpen ? "记录窗口 · 开" : "记录窗口";
  els.btnHist.title = (histOpen ? "收起" : "打开") + "独立的骰子记录窗口（最近 4 条，可展开全部）";
}

function toggleHistory() {
  try {
    var p = OBR.broadcast.sendMessage(CH_DICE_HIST_CMD, { op: "toggle", at: Date.now() }, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来 */ });
  } catch (e) {
    feedback("记录窗口打不开：后台未连接（记录本身仍会写进房间数据）", "WARNING");
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
    els.presets.innerHTML = '<p class="muted small">选中一枚<b>已绑定角色卡</b>的 token，这里会出现攻击 / 伤害 / 技能预设（只填公式，不判定）。</p>';
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
  if (els.btnHist) els.btnHist.addEventListener("click", toggleHistory);

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
  paintAnimMeta();
  setHistButton(false);

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
    await readSavedFlags();
    await refreshPresets();
  })();

  /* 房间数据变化 = 有人投掷 / 城主清空 → 只更新「已落库」标记（列表在记录窗口里画） */
  try {
    OBR.room.onMetadataChange(function () { void readSavedFlags(); });
  } catch (e) { /* 忽略 */ }

  /* 城主写完房间数据会广播 saved：清掉「未落库」计时器 */
  try {
    OBR.broadcast.onMessage(CH_ROLL_SAVED, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      if (data && data.rollId) markSaved(String(data.rollId));
      void readSavedFlags();
    });
  } catch (e2) { /* 忽略 */ }

  /* 记录窗口的开 / 关状态（后台执行完命令后广播回来） */
  try {
    OBR.broadcast.onMessage(CH_DICE_HIST_STATE, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
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
