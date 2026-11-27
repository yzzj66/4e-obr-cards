// v2.4.30：血条编辑窗的页面脚本（hp-edit.html）—— 照 Full Suite 的 hp-bar 重做第一批（布局 + 字段）。
// ---------------------------------------------------------------------------
// 窗口 344×106：行1 名称 + 钉住 / 锁定 / 重绘 + ✕；行2 生命药丸（按 cur/max 比例填充）+ 临时生命；
// 行3 四防；行4 状态行。**去掉回复力字段**（surges 数据保留在 token 上，只读不写）。
//
// 谁写盘：页面自己写（OBR.scene.items.updateItems），不经过后台；后台只做三件事：
//   ① 开窗时广播 CH_HP_EDIT_TARGET（版本租约）；② 收到 CH_HP_EDIT_SAVED 后立即重画；
//   ③ 收到 CH_HP_REPAINT 后强制重算这张 token 的血条环 / 四防盾 / 资源徽记。
// 交互：聚焦全选；失焦 / Enter 提交；非法 / 半截输入回退；saving 时输入禁用；clamp 在 hp-edit-core.js。
// 钉住：localStorage["4enext/hp-edit/pinned"]（默认关）——钉住后选中变化 / 取消选中不自动关窗。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_HPEDIT_LOG, CH_HP_EDIT_ACK, CH_HP_EDIT_READY, CH_HP_EDIT_SAVED, CH_HP_EDIT_TARGET, CH_HP_REPAINT, ID_HP_EDIT, KEY_BIND,
  PLUGIN_VERSION, findCard, getCards, hpBarVisual, onReady
} from "./common.js";
import { closeSelf, createWindow, feedback } from "./window.js";
/* v2.4.30：血条窗里直接记先攻（照 Full Suite：一个数字写进先攻条）。 */
import {
  addEntry, entryFromItem, readInitiative, setEntryRoll, writeInitiative
} from "./initiative.js?v=2.4.30";
import {
  HPE_DEF_KEYS, buildHpEditPatch, createHpEditLease, curText, defText, hpEditReadOnly, hpEditView,
  hpPatchEqualsView, maxText, mayEditToken, tempText, writeHpEdit
} from "./hp-edit-core.js";

const HP_META_KEY = "com.4enext-owlbear/hp";
const PIN_KEY = "4enext/hp-edit/pinned";
function hpMetaOf(item) {
  return item && item.metadata ? item.metadata[HP_META_KEY] : null;
}
function readPin() {
  try { return localStorage.getItem(PIN_KEY) === "1"; } catch (e) { return false; }
}
function writePin(on) {
  try { localStorage.setItem(PIN_KEY, on ? "1" : "0"); } catch (e) { /* 忽略 */ }
}

var PARAMS = (function () {
  try { return new URLSearchParams(location.search); } catch (e) { return null; }
})();
var itemId = PARAMS ? String(PARAMS.get("item") || "") : "";
var session = PARAMS ? String(PARAMS.get("session") || "") : "";

var win = createWindow({ name: "hpEdit" });
var lease = createHpEditLease(session);

var els = {
  name: document.getElementById("hpe-name"),
  hpPill: document.getElementById("hpe-hp-pill"),
  hpTempNote: document.getElementById("hpe-hp-temp-note"),
  hpFill: document.getElementById("hpe-hp-fill"),
  cur: document.getElementById("hpe-cur"),
  max: document.getElementById("hpe-max"),
  temp: document.getElementById("hpe-temp"),
  init: document.getElementById("hpe-init"),
  hide: document.getElementById("hpe-hide"),
  pin: document.getElementById("hpe-pin"),
  lock: document.getElementById("hpe-lock"),
  lockOn: document.getElementById("hpe-lock-on"),
  lockOff: document.getElementById("hpe-lock-off"),
  repaint: document.getElementById("hpe-repaint"),
  flash: document.getElementById("win-flash"),
  close: document.getElementById("close"),
  off: document.getElementById("hpe-off")
};
for (var di = 0; di < HPE_DEF_KEYS.length; di++) {
  els["def_" + HPE_DEF_KEYS[di]] = document.getElementById("hpe-def-" + HPE_DEF_KEYS[di]);
}

var state = {
  item: null,
  view: null,
  editable: false,
  role: "",
  locked: false,
  pinned: readPin(),
  busy: false,
  pending: false,
  dirty: false
};

/* 后台在线状态：只在标题栏挂一个小标记（窗口只有 344×106，放不下整条 bg-strip）。
 * 保存**不依赖**后台（页面自己写 token 元数据），离线只是「血条不会立刻重画」。 */
win.onStatus(function (st) {
  if (els.off) els.off.hidden = st !== "bad";
});

/* ---------------------------------------------------------------------------
 * 小工具
 * ------------------------------------------------------------------------- */
var flashTimer = 0;
/** v2.4.30：底部提示行已移除；保存/校验反馈统一走标题栏 #win-flash，1.5s 后消失。 */
function note(text, tone) {
  if (!els.flash) return;
  els.flash.textContent = text || "";
  els.flash.className = "win-flash" + (text ? " on" + (tone ? " " + String(tone) : "") : "");
  if (flashTimer) { clearTimeout(flashTimer); flashTimer = 0; }
  if (text) {
    flashTimer = setTimeout(function () {
      flashTimer = 0;
      if (!els.flash) return;
      els.flash.textContent = "";
      els.flash.className = "win-flash";
    }, 1500);
  }
}

function defsInput() {
  var out = {};
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var key = HPE_DEF_KEYS[i];
    var el = els["def_" + key];
    out[key] = el ? String(el.value == null ? "" : el.value) : "";
  }
  return out;
}

function formValues() {
  var cur = els.cur ? els.cur.value : "";
  var max = els.max ? els.max.value : "";
  /* v2.4.30：只填了当前或上限任一方时自动补齐另一方（4E：先填一个就能画出第一根血条）。 */
  if (max === "" && cur !== "") max = cur;
  if (cur === "" && max !== "") cur = max;
  return {
    cur: cur,
    max: max,
    temp: els.temp ? els.temp.value : "",
    hide: !!(els.hide && els.hide.checked),
    defs: defsInput()
  };
}

function paintRatio(view) {
  if (!els.hpPill) return;
  var vis = hpBarVisual(view || {});
  els.hpPill.style.setProperty("--hp-ratio", String(vis.ratio));
  els.hpPill.style.setProperty("--hp-color", vis.color);
  if (els.hpFill) els.hpFill.style.width = (vis.ratio * 100).toFixed(2) + "%";
  els.hpPill.classList.toggle("hp-healthy", vis.status.key === "healthy");
  els.hpPill.classList.toggle("hp-wounded", vis.status.key === "wounded");
  els.hpPill.classList.toggle("hp-critical", vis.status.key === "critical");
  els.hpPill.classList.toggle("low", vis.status.bloodied);
}

function fillForm(view) {
  var v = view || {};
  var skipped = [];
  function put(el, text) {
    if (!el) return;
    if (document.activeElement === el) { skipped.push(el.id); return; }
    el.value = text;
  }
  put(els.cur, curText(v));
  put(els.max, maxText(v));
  put(els.temp, tempText(v));
  if (els.hide && document.activeElement !== els.hide) els.hide.checked = !!v.hide;
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var key = HPE_DEF_KEYS[i];
    put(els["def_" + key], defText(v, key));
  }
  hlog("fillForm value-cur=" + JSON.stringify(els.cur ? els.cur.value : "") +
    " max=" + JSON.stringify(els.max ? els.max.value : "") +
    " temp=" + JSON.stringify(els.temp ? els.temp.value : "") +
    (skipped.length ? " skipped=" + skipped.join(",") : ""));
  paintRatio(v);
}

function paintTools() {
  if (els.pin) {
    els.pin.classList.toggle("on", !!state.pinned);
    els.pin.title = state.pinned ? "已钉住：选中变化 / 取消选中不自动关窗（点击取消）" : "钉住：选中变化 / 取消选中时不自动关窗";
  }
  if (els.lock) {
    var locked = !!(state.view && state.view.locked);
    els.lock.classList.toggle("on", locked);
    /* v2.4.30：锁定状态切换 lock / unlock 两个内联 SVG（不用 innerHTML 重绘按钮）。 */
    if (els.lockOn) els.lockOn.hidden = !locked;
    if (els.lockOff) els.lockOff.hidden = locked;
    els.lock.title = locked ? "已锁定：玩家看不到精确数字（点击解锁）" : "锁定：玩家看不到精确数字（点击锁定）";
    els.lock.disabled = state.role !== "GM" || state.busy;
  }
  if (els.hide) els.hide.disabled = state.role !== "GM" || state.busy;
  if (els.repaint) els.repaint.disabled = state.busy;
}

function applyDisabled() {
  var dis = !state.editable || state.busy;
  try { console.log("[4enext][hpEdit] applyDisabled dis=" + dis + " editable=" + state.editable + " busy=" + state.busy); } catch (e) { /* 忽略 */ }
  var list = [els.cur, els.max, els.temp];
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) list.push(els["def_" + HPE_DEF_KEYS[i]]);
  for (var k = 0; k < list.length; k++) {
    if (!list[k]) continue;
    list[k].disabled = dis;
    list[k].readOnly = dis;
  }
  document.body.classList.toggle("hpe-readonly", dis);
  paintTools();
}

function setEditable(on) {
  state.editable = !!on;
  applyDisabled();
}

function setBusy(on) {
  state.busy = !!on;
  applyDisabled();
}

/* ---------------------------------------------------------------------------
 * 读 token / 角色卡默认值
 * ------------------------------------------------------------------------- */
async function readToken() {
  if (!itemId) return null;
  try {
    var list = await OBR.scene.items.getItems([itemId]);
    return list && list[0] ? list[0] : null;
  } catch (e) {
    return null;
  }
}

async function roleOf() {
  try { return await OBR.player.getRole(); } catch (e) { return ""; }
}

async function playerIdOf() {
  try { return await OBR.player.getId(); } catch (e) { return ""; }
}

/** 绑定角色卡的默认值：只取「算得出」的几项（上限 / 四防，v2.4.30 不再带回复力）。 */
async function cardDefaults(item) {
  var cardId = item && item.metadata ? item.metadata[KEY_BIND] : null;
  if (typeof cardId !== "string" || !cardId) return null;
  try {
    var card = findCard(await getCards(), cardId);
    if (!card) return null;
    var glance = await import("./glance.js");
    var d = glance.deriveGlance(card.char);
    var defs = {};
    var any = false;
    var rows = d && Array.isArray(d.defenses) ? d.defenses : [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var key = row && row.key === "ref" ? "reflex" : (row && row.key);
      if (HPE_DEF_KEYS.indexOf(key) < 0) continue;
      if (typeof row.value !== "number" || !isFinite(row.value)) continue;
      defs[key] = Math.round(row.value);
      any = true;
    }
    return { max: d && d.maxHp > 0 ? d.maxHp : 0, defenses: any ? defs : null, name: card.name || "" };
  } catch (e) {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * 载入 / 保存 / 关闭
 * ------------------------------------------------------------------------- */
async function load() {
  if (!itemId) {
    note("这个窗口没有带 token 参数：请在 token 上右键「编辑血条」重新打开", "error");
    setEditable(false);
    return;
  }
  var item = await readToken();
  if (!item) {
    state.item = null;
    note("这枚 token 已经不在了（可能被删掉 / 换了场景）", "error");
    if (els.name) els.name.textContent = "未命名";
    setEditable(false);
    return;
  }
  state.item = item;
  state.role = await roleOf();
  var pid = await playerIdOf();
  var lockedForPlayer = hpEditReadOnly(hpMetaOf(item), state.role);
  var viewForGuard = hpEditView(hpMetaOf(item), await cardDefaults(item));
  if (state.role !== "GM" && (lockedForPlayer || viewForGuard.hide === true)) {
    note("这枚 token 的血条已隐藏", "warn");
    setTimeout(function () { try { closeSelf(ID_HP_EDIT, "hpEdit"); } catch (e) { /* 忽略 */ } }, 350);
    return;
  }
  state.locked = lockedForPlayer;
  var may = mayEditToken(item, state.role, pid);
  if (state.role === "GM") may = true; /* v2.4.30：GM 判定优先，绝不因 createdUserId 只读 */
  state.editable = may && !lockedForPlayer;
  try {
    console.log("[4enext][hpEdit] role=" + state.role + " pid=" + pid +
      " item.createdUserId=" + (item.createdUserId == null ? "(缺失)" : item.createdUserId) +
      " editable=" + state.editable + " locked=" + lockedForPlayer);
  } catch (e2) { /* 忽略 */ }

  var card = await cardDefaults(item);
  var view = hpEditView(hpMetaOf(item), card);
  state.view = view;
  if (els.name) els.name.textContent = (item.name || "").trim() || "未命名";
  if (state.dirty) {
    hlog("load skip fillForm (dirty)");
  } else {
    fillForm(view);
  }
  setEditable(state.editable);
  paintTools();
  /* v2.4.30：固定底部提示已删；这些状态用标题栏 flash 短暂提示一次。 */
  if (state.locked) note("已锁定：这枚 token 的血量对玩家隐藏（城主解锁后才能改）", "warn");
  else if (!state.editable) note("只读：只有城主或这枚 token 的创建者能改生命 / 临时生命 / 四防", "warn");
  else if (view.max === null) note("填生命上限（比如 20）就能画出第一根血条", "warn");
  refreshNote();
  void loadInitValue();
}

/** v2.4.30：不再有固定底部提示行；状态只用标题栏 flash 做短暂反馈。 */
function refreshNote() {
  /* 保留结构供旧检查；不写任何固定文案。 */
  if (state.locked) { return; }
}

function broadcast(channel, payload) {
  try {
    var p = OBR.broadcast.sendMessage(channel, payload, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就算了 */ });
  } catch (e) { /* 不在枭熊里打开本页时会走到这 */ }
}


/* ---------------- v2.4.30：先攻「备团预设」（写在 token 上，不在时也不丢） ----------------
 * 用户原话：血条窗的先攻是备团用的，移出先攻后预设不能变「—」。所以这里只写 token 元数据
 * com.4enext-owlbear/init-preset（合计值）；token 若当前在先攻里，顺带更新那一条。
 * 右键「加入先攻」时 background 的 initAdd 会读这个预设（见 initPresetOf）。 */
var INIT_PRESET_KEY = "com.4enext-owlbear/init-preset";
var initBusy = false;
function presetOfItem(item) {
  try {
    var raw = item && item.metadata ? item.metadata[INIT_PRESET_KEY] : null;
    var n = Math.round(Number(raw && raw.v != null ? raw.v : raw));
    return isFinite(n) && n >= 1 && n <= 99 ? n : null;
  } catch (e) { return null; }
}
async function loadInitValue() {
  if (!els.init) return;
  if (document.activeElement === els.init) return;
  try {
    var item = state.item || (await readToken());
    var preset = presetOfItem(item);
    if (preset != null) { els.init.value = String(preset); return; }
    var st = await readInitiative();
    var entry = st.entries.filter(function (e) { return e.tokenId === itemId; })[0];
    els.init.value = entry && isFinite(Number(entry.init)) ? String(Math.round(Number(entry.init))) : "";
  } catch (e) { /* 忽略 */ }
}
async function commitInit() {
  if (!els.init || initBusy) return;
  var raw = String(els.init.value == null ? "" : els.init.value).replace(/[+\s]/g, "");
  if (!raw) {
    /* 清空 = 擦掉预设（不写 0）。 */
    initBusy = true;
    try {
      await OBR.scene.items.updateItems([itemId], function (items) {
        for (var i = 0; i < items.length; i++) {
          if (items[i].metadata) delete items[i].metadata[INIT_PRESET_KEY];
        }
      });
      note("已清除先攻预设", "ok");
    } catch (e0) { note("清除预设失败", "error"); }
    finally { initBusy = false; }
    return;
  }
  var val = Number(raw);
  if (!isFinite(val)) { note("先攻要填数字", "warn"); return; }
  val = Math.max(1, Math.min(99, Math.round(val)));
  initBusy = true;
  try {
    await OBR.scene.items.updateItems([itemId], function (items) {
      for (var i = 0; i < items.length; i++) {
        items[i].metadata = items[i].metadata || {};
        items[i].metadata[INIT_PRESET_KEY] = { v: val, updatedAt: Date.now() };
      }
    });
    if (state.item && state.item.metadata) state.item.metadata[INIT_PRESET_KEY] = { v: val, updatedAt: Date.now() };
    els.init.value = String(val);
    /* token 已经在先攻里 → 顺带把那一条改掉；不在先攻里就只保存预设（不自动加入）。 */
    var synced = false;
    try {
      var st = await readInitiative();
      var entry = st.entries.filter(function (e) { return e.tokenId === itemId; })[0];
      if (entry) {
        var bonus = Math.round(Number(entry.bonus) || 0);
        var d20 = Math.max(1, Math.min(20, val - bonus));
        await writeInitiative(setEntryRoll(st, itemId, d20));
        synced = true;
      }
    } catch (e1) { /* 先攻写失败不影响预设 */ }
    note(synced ? "先攻预设 " + val + "（已同步先攻条）" : "先攻预设 " + val + "（加入先攻时使用）", "ok");
  } catch (e2) {
    note("先攻预设写入失败", "error");
  } finally {
    initBusy = false;
  }
}

/* ---------------------------------------------------------------------------
 * 自动保存（照 Full Suite「即改即生效」）：input 防抖 500ms；change / blur / Enter 立即提交。
 * 非法 / 半截输入不写，失焦时恢复成当前值；写成功更新 state.view 并广播 CH_HP_EDIT_SAVED。
 * saving 时输入 disabled（见 setBusy），失败绝不静默。
 * ------------------------------------------------------------------------- */
function hlog(msg) {
  try { console.log("[4enext][hpEdit] " + msg); } catch (e) { /* 忽略 */ }
  try {
    var b = OBR.broadcast.sendMessage(CH_HPEDIT_LOG, { msg: String(msg), at: Date.now() }, { destination: "LOCAL" });
    if (b && typeof b.catch === "function") b.catch(function () {});
  } catch (e2) { /* 广播失败不影响本页 */ }
}
var SAVE_DEBOUNCE_MS = 500;
var saveTimer = 0;
var noteTimer = 0;

function clearSaveTimer() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
}

function scheduleSave() {
  clearSaveTimer();
  saveTimer = setTimeout(function () {
    saveTimer = 0;
    var src = document.activeElement;
    void commit("debounce", src && src.classList && src.classList.contains("hpe-num") ? src : undefined);
  }, SAVE_DEBOUNCE_MS);
}

function showSaved(view) {
  var txt = (view && view.max !== null && view.max !== undefined)
    ? (view.cur === null || view.cur === undefined ? "?" : view.cur) + "/" + view.max
    : "";
  if (noteTimer) { clearTimeout(noteTimer); noteTimer = 0; }
  note("已保存" + (txt ? "：" + txt : "") + (view && view.temp ? " · 临时 " + view.temp : ""), "ok");
}

/** 回填单个输入框（失焦 / Enter 后恢复规范值；不碰其它正在编辑的格子）。 */
function fillOne(el, view) {
  if (!el) return;
  var v = view || {};
  if (el === els.cur) { el.value = curText(v); return; }
  if (el === els.max) { el.value = maxText(v); return; }
  if (el === els.temp) { el.value = tempText(v); return; }
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var key = HPE_DEF_KEYS[i];
    if (el === els["def_" + key]) { el.value = defText(v, key); return; }
  }
}

async function commit(trigger, sourceEl) {
  hlog("commit trigger=" + trigger + " id=" + (sourceEl && sourceEl.id) + " value=" + JSON.stringify(sourceEl ? sourceEl.value : ""));
  if (state.busy) { state.pending = true; return; }
  if (!state.editable) return;
  var leaseNow = lease.capture();
  if (leaseNow && leaseNow.itemId !== itemId) {
    note("这个窗口已经过期：请重新右键「编辑血条」", "error");
    feedback("窗口已过期：重新右键「编辑血条」再改", "WARNING");
    return;
  }
  var built = buildHpEditPatch(formValues(), state.view || {});
  hlog("commit result trigger=" + trigger + " ok=" + built.ok + " message=" + JSON.stringify(built.message || "") +
    " patch=" + JSON.stringify(built.patch || null));
  if (!built.ok) {
    /* v2.4.30：非法/半截输入保留用户原值，不清空、不回填（等用户继续输入或修正）。 */
    note(built.message, "warn");
    return;
  }
  state.dirty = false;
  if (hpPatchEqualsView(built.patch, state.view)) { paintRatio(state.view); return; }
  setBusy(true);
  note("保存中…", "warn");
  var res = await writeHpEdit({
    getItems: function (ids) { return OBR.scene.items.getItems(ids); },
    updateItems: function (ids, fn) { return OBR.scene.items.updateItems(ids, fn); },
    getRole: roleOf,
    getId: playerIdOf
  }, itemId, built.patch);
  setBusy(false);
  if (state.pending) {
    state.pending = false;
    scheduleSave();
  }
  if (!res.ok) {
    note(res.message, "error");
    feedback(res.message, "ERROR");
    return;
  }
  state.view = hpEditView(res.hp, null);
  var defsObj = {};
  var keepDefs = false;
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var key = HPE_DEF_KEYS[i];
    if (state.view.defenses && typeof state.view.defenses[key] === "number") {
      defsObj[key] = state.view.defenses[key];
      keepDefs = true;
    }
  }
  state.view.defenses = keepDefs ? defsObj : null;
  if (sourceEl) fillOne(sourceEl, state.view);
  paintRatio(state.view);
  paintTools();
  showSaved(state.view);
  broadcast(CH_HP_EDIT_SAVED, { itemId: itemId, hp: res.hp, at: Date.now() });
}

/* 锁定切换：只有城主能点；写 hp.locked（true = 玩家看不到精确数字）。 */
async function toggleLock() {
  if (state.role !== "GM" || state.busy || !state.view) return;
  var next = !state.view.locked;
  setBusy(true);
  refreshNote();
  var res = await writeHpEdit({
    getItems: function (ids) { return OBR.scene.items.getItems(ids); },
    updateItems: function (ids, fn) { return OBR.scene.items.updateItems(ids, fn); },
    getRole: roleOf,
    getId: playerIdOf
  }, itemId, { locked: next });
  setBusy(false);
  if (!res.ok) {
    note(res.message, "error");
    feedback(res.message, "ERROR");
    return;
  }
  state.view.locked = next;
  paintTools();
  note(next ? "已锁定：玩家看不到精确数字" : "已解锁：玩家可以看到精确数字", "ok");
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(function () { noteTimer = 0; refreshNote(); }, 1600);
  broadcast(CH_HP_EDIT_SAVED, { itemId: itemId, hp: res.hp, at: Date.now() });
}

/* v2.4.30：对玩家隐藏血条（GM-only，立即写 hp.hide）。 */
async function toggleHide() {
  if (state.role !== "GM" || state.busy || !state.view) return;
  var next = !!(els.hide && els.hide.checked);
  setBusy(true);
  var res = await writeHpEdit({
    getItems: function (ids) { return OBR.scene.items.getItems(ids); },
    updateItems: function (ids, fn) { return OBR.scene.items.updateItems(ids, fn); },
    getRole: roleOf,
    getId: playerIdOf
  }, itemId, { hide: next });
  setBusy(false);
  if (!res.ok) {
    if (els.hide) els.hide.checked = !next;
    note(res.message, "error");
    feedback(res.message, "ERROR");
    return;
  }
  state.view.hide = next;
  paintTools();
  note(next ? "已对玩家隐藏血条（GM 仍可见）" : "已对玩家显示血条", "ok");
  broadcast(CH_HP_EDIT_SAVED, { itemId: itemId, hp: res.hp, at: Date.now() });
}

/* 重绘血条：广播 CH_HP_REPAINT，后台强制重算这张 token 的血条环 / 四防盾 / 资源徽记。 */
function repaintBars() {
  if (state.busy) return;
  broadcast(CH_HP_REPAINT, { itemId: itemId, at: Date.now() });
  note("已请求重绘这张 token 的血条（血条环 / 四防盾 / 资源徽记）", "ok");
}

async function closeWindow() {
  try { await commitInit(); } catch (e) { /* 忽略 */ }
  closeSelf(ID_HP_EDIT, "hpEdit");
}

/* ---------------------------------------------------------------------------
 * 事件
 * ------------------------------------------------------------------------- */
if (els.close) els.close.addEventListener("click", closeWindow);
if (els.pin) {
  els.pin.addEventListener("click", function () {
    state.pinned = !state.pinned;
    writePin(state.pinned);
    paintTools();
    note(state.pinned ? "已钉住：选中变化 / 取消选中不会自动关窗" : "已取消钉住：跟随选中（取消选中会关窗）", "ok");
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { noteTimer = 0; refreshNote(); }, 1600);
  });
}
if (els.lock) els.lock.addEventListener("click", function () { void toggleLock(); });
if (els.repaint) els.repaint.addEventListener("click", repaintBars);

var inputs = [els.cur, els.max, els.temp];
for (var k = 0; k < HPE_DEF_KEYS.length; k++) inputs.push(els["def_" + HPE_DEF_KEYS[k]]);
/* v2.4.30 bugfix：这里必须用 forEach 的形参 el 捕获每个输入框。
 * 之前用 `for (var el = inputs[i])` + 内部函数：var 是函数作用域共享，循环结束后 el 永远指向
 * 最后一个输入框（hpe-def-will）——任何框 focus 时 select() 都抢到「意志」，用户输入全写进意志。
 * 注意：isFieldEl 的 for (var i) 直接同步返回，不捕获闭包，保留没问题。 */
inputs.forEach(function (el) {
  if (!el) return;
  el.addEventListener("focus", function () {
    hlog("focus id=" + el.id);
    try { el.select(); } catch (e) { /* 忽略 */ }
  });
  el.addEventListener("beforeinput", function (ev) {
    hlog("beforeinput id=" + el.id + " data=" + (ev && ev.data == null ? "null" : ev.data));
  });
  el.addEventListener("input", function () {
    state.dirty = true;
    hlog("input id=" + el.id + " value=" + JSON.stringify(el.value) + " dirty=1");
    scheduleSave();
  });
  el.addEventListener("change", function () { void commit("change", el); });
  el.addEventListener("blur", function () { void commit("blur", el); });
  el.addEventListener("keydown", function (ev) {
    hlog("key=" + (ev.key || "") + " id=" + (ev.target && ev.target.id) + " prevented=" + !!ev.defaultPrevented);
    if (ev.key === "Enter") { ev.preventDefault(); clearSaveTimer(); void commit("enter", el); }
    else if (ev.key === "Escape") { ev.preventDefault(); closeWindow(); }
  });
});
/* v2.4.30：先攻输入单独提交（不参与血条 patch）。
 * 注意：这里用 getElementById 而不是 els.init —— dev/test-background.mjs 会把这段代码
 * 截出来在 Function 里跑（只传 inputs，不传 els），引用 els 会 ReferenceError。 */
var initEl = document.getElementById("hpe-init");
if (initEl && typeof initEl.addEventListener === "function") {
  initEl.addEventListener("focus", function () { try { initEl.select(); } catch (e) { /* 忽略 */ } });
  initEl.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); initEl.blur(); }
    else if (ev.key === "Escape") { ev.preventDefault(); closeWindow(); }
  });
  initEl.addEventListener("blur", function () { void commitInit(); });
  /* v2.4.30：边打边存（防抖 450ms）——用户填完直接关窗/点地图也不丢预设。 */
  var initTimer = 0;
  initEl.addEventListener("input", function () {
    if (initTimer) clearTimeout(initTimer);
    initTimer = setTimeout(function () { initTimer = 0; void commitInit(); }, 450);
  });
}
document.addEventListener("keydown", function (ev) {
  hlog("key(capture)=" + (ev.key || "") + " id=" + (ev.target && ev.target.id) + " prevented=" + !!ev.defaultPrevented);
  if (ev.key === "Escape") closeWindow();
}, true);

/* v2.4.30：单窗常驻 —— 后台换 target 时页面自己 commit 未保存输入再 load（不重建 iframe）。 */
function isFieldEl(el) {
  if (!el) return false;
  for (var i = 0; i < inputs.length; i++) if (inputs[i] === el) return true;
  return false;
}
function ackTarget(version) {
  broadcast(CH_HP_EDIT_ACK, { session: session, version: version, itemId: itemId, at: Date.now() });
}
async function handleHpTarget(data) {
  if (!data || typeof data !== "object") return;
  var nextId = typeof data.itemId === "string" ? data.itemId : "";
  /* 切到别的 token 前先把当前输入提交掉（否则会被 load 直接覆盖）。 */
  if (nextId && nextId !== itemId && state.editable && isFieldEl(document.activeElement)) {
    await commit("switch", document.activeElement);
  }
  if (nextId && nextId !== itemId && document.activeElement === els.init) {
    await commitInit();
  }
  if (!lease.accept(data)) return;
  var now = lease.state;
  if (!now || !now.itemId) return;
  if (now.itemId !== itemId) {
    itemId = now.itemId;
    setBusy(true);
    refreshNote();
    await load();
    setBusy(false);
  }
  if (!now.pending) paintTools();
  ackTarget(now.version);
}

/* 后台版本租约：ready → 后台补发 target（iframe 可能比第一条广播晚加载）。 */
try { console.log("[4enext][hpEdit] loaded v=" + PLUGIN_VERSION + " url=" + location.href); } catch (e0) { /* 忽略 */ }
onReady(function () {
  hlog("page ready, inputs=" + inputs.filter(Boolean).length);
  try {
    OBR.broadcast.onMessage(CH_HP_EDIT_TARGET, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      void handleHpTarget(data);
    });
  } catch (e) { /* 忽略：没有 broadcast 也能手动保存 */ }
  broadcast(CH_HP_EDIT_READY, { session: session, itemId: itemId, at: Date.now() });
  paintTools();
  void load().then(function () {
    if (lease.state && lease.state.version) ackTarget(lease.state.version);
  });
});
