// v1.7.2：血条编辑小窗的页面脚本（hp-edit.html）。
// ---------------------------------------------------------------------------
// 为什么有这个窗口（用户真机反馈）：
//   右键「添加血条组件」过去只写 hp-bar/enabled = true —— 没绑定角色卡的怪物 / 杂兵
//   没有任何地方填血量与四防，血条永远是空的。参考 FullPeople/obr-suite 的
//   src/modules/hpBar/（选中 token → 弹一个可拖动的编辑面板）补上这个入口。
//
// 谁写盘：**页面自己写**（OBR.scene.items.updateItems），不经过后台。
//   理由：① 写 token 元数据本来就不需要后台（速览弹窗、骰子都是页面直写）；
//         ② 后台万一没起来，编辑窗仍然能保存；
//         ③ 权限按「城主 or token 创建者」判定（与速览 / 参考实现一致）。
//   后台只做两件事：开窗时广播 CH_HP_EDIT_TARGET（版本租约，规格 §2.2 的简化版），
//   收到 CH_HP_EDIT_SAVED 后立刻 scheduleBars()（不等 scene.items.onChange）。
//
// 窗口壳（拖动 / 位置记忆 / 后台检测 / 统一反馈）复用 assets/window.js。
// 语法解析 / 夹取 / 权限 / 写盘 / 租约全在 assets/hp-edit-core.js（纯函数，Node 可测）。
import OBR from "../vendor/obr-sdk.js";
import { CH_HP_EDIT_READY, CH_HP_EDIT_SAVED, CH_HP_EDIT_TARGET, ID_HP_EDIT, KEY_BIND, findCard, getCards, onReady } from "./common.js";
import { closeSelf, createWindow, feedback } from "./window.js";
import {
  HPE_DEF_KEYS, HPE_DEF_LABELS, buildHpEditPatch, createHpEditLease, defText,
  hpEditReadOnly, hpEditView, hpPatchEqualsView, hpText, mayEditToken, surgeText, writeHpEdit
} from "./hp-edit-core.js";

/** v1.7.7：token 上的 hp 元数据（锁 / 数值都在里面）。 */
const HP_META_KEY = "com.4enext-owlbear/hp";
function hpMetaOf(item) {
  return item && item.metadata ? item.metadata[HP_META_KEY] : null;
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
  hp: document.getElementById("hpe-hp"),
  surge: document.getElementById("hpe-surge"),
  note: document.getElementById("hpe-note"),
  close: document.getElementById("close"),
  off: document.getElementById("hpe-off")
};
for (var di = 0; di < HPE_DEF_KEYS.length; di++) {
  els["def_" + HPE_DEF_KEYS[di]] = document.getElementById("hpe-def-" + HPE_DEF_KEYS[di]);
}

var state = { item: null, view: null, editable: false, locked: false, busy: false, pending: false };

/* 后台在线状态：只在标题栏挂一个小标记（窗口只有 340×150，放不下整条 bg-strip）。
 * 注意保存**不依赖**后台（页面自己写 token 元数据），所以离线只是「血条不会立刻重画」。 */
win.onStatus(function (st) {
  if (els.off) els.off.hidden = st !== "bad";
});

/* ---------------------------------------------------------------------------
 * 小工具
 * ------------------------------------------------------------------------- */
function note(text, tone) {
  if (!els.note) return;
  els.note.textContent = text || "";
  els.note.className = "hpe-note" + (text && tone ? " " + String(tone) : "");
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
  return {
    hp: els.hp ? els.hp.value : "",
    surge: els.surge ? els.surge.value : "",
    defs: defsInput()
  };
}

function fillForm(view) {
  if (els.hp) els.hp.value = hpText(view);
  if (els.surge) els.surge.value = surgeText(view);
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var key = HPE_DEF_KEYS[i];
    var el = els["def_" + key];
    if (el) el.value = defText(view, key);
  }
}

function setEditable(on) {
  state.editable = !!on;
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var el = els["def_" + HPE_DEF_KEYS[i]];
    if (el) el.readOnly = !on;
  }
  if (els.hp) els.hp.readOnly = !on;
  if (els.surge) els.surge.readOnly = !on;
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

/** 绑定角色卡的默认值：只取「算得出」的几项（上限 / 回复力 / 四防），拿不到就算了。 */
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
    return {
      max: d && d.maxHp > 0 ? d.maxHp : 0,
      surges: d && d.surges > 0 ? d.surges : 0,
      surgesMax: d && d.surgesMax > 0 ? d.surgesMax : 0,
      defenses: any ? defs : null,
      name: card.name || ""
    };
  } catch (e) {
    /* 卡片读不到 / 渲染层没加载起来：按「没有默认值」处理，不影响手动填 */
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
  var role = await roleOf();
  var pid = await playerIdOf();
  /* v1.7.7：Boss 锁（hp.locked）→ 编辑窗只读（藏保存 + 提示「已锁定」）。
   * 判定在 hp-edit-core.js 的 hpEditReadOnly：城主不受限（locked 默认 true，锁是给玩家看的）。 */
  var locked = hpEditReadOnly(hpMetaOf(item), role);
  state.locked = locked;
  var editable = mayEditToken(item, role, pid) && !locked;
  setEditable(editable);

  var card = await cardDefaults(item);
  var view = hpEditView(hpMetaOf(item), card);
  state.view = view;
  if (els.name) els.name.textContent = (item.name || "").trim() || "未命名";
  fillForm(view);
  refreshNote();
}

/**
 * 窗口内那一行提示（**不是**通知中心）。v1.7.8：只写「状态 / 只读 / 锁定」，
 * 「已保存 …」这类成功回音不再写 —— token 上的血条立刻重画就是反馈。
 */
function refreshNote() {
  var view = state.view || {};
  if (state.locked) {
    note("已锁定：这枚 token 的血量对玩家隐藏（城主解锁后才能改）", "warn");
  } else if (!state.editable) {
    note("只读：只有城主或这枚 token 的创建者能改血量与四防", "warn");
  } else if (view.fromCard) {
    note("已按绑定角色卡带入默认值；改动会自动保存", "ok");
  } else if (view.max === null) {
    note("填生命上限（比如 20）就能画出第一根血条", "warn");
  } else {
    note("血量 " + (view.cur === null ? "?" : view.cur) + "/" + view.max + "；留空的四防 = 不画那枚盾", "");
  }
}

function broadcast(channel, payload) {
  try {
    var p = OBR.broadcast.sendMessage(channel, payload, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就算了 */ });
  } catch (e) { /* 不在枭熊里打开本页时会走到这 */ }
}

/* ---------------------------------------------------------------------------
 * v1.8.5：自动保存（照 Full Suite 的「即改即生效」架构，没有保存按钮）
 * ---------------------------------------------------------------------------
 * input 防抖 500ms / change / blur / Enter 都会触发 commit()：
 *   · buildHpEditPatch 把表单换算成 patch；与 state.view 相同就不写、也不广播；
 *   · 非法 / 半截输入（如 "20/"）不写，失焦时恢复成当前值；
 *   · 写成功后更新 state.view、短暂提示「已保存：…」并广播 CH_HP_EDIT_SAVED（后台立刻重画）；
 *   · 写失败仍弹 ERROR（不静默）；只读（locked / 无权限）绝不写。
 */
var SAVE_DEBOUNCE_MS = 500;
var saveTimer = 0;
var noteTimer = 0;

function clearSaveTimer() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
}

function scheduleSave() {
  clearSaveTimer();
  saveTimer = setTimeout(function () { saveTimer = 0; void commit("debounce"); }, SAVE_DEBOUNCE_MS);
}

function defSummary(view) {
  var d = view && view.defenses ? view.defenses : null;
  if (!d) return "";
  var short = { ac: "AC", fort: "强", reflex: "反", will: "意" };
  var out = [];
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var k = HPE_DEF_KEYS[i];
    if (typeof d[k] === "number") out.push(short[k] + d[k]);
  }
  return out.length ? "四防 " + out.join(" ") : "";
}

/** 写成功后短暂显示「已保存 …」（1.6s 后回到常规提示；不弹通知中心）。 */
function showSaved(view) {
  var txt = hpText(view || {});
  var def = defSummary(view);
  if (noteTimer) clearTimeout(noteTimer);
  note("已保存" + (txt ? "：" + txt : "") + (def ? " · " + def : ""), "ok");
  noteTimer = setTimeout(function () {
    noteTimer = 0;
    refreshNote();
  }, 1600);
}

/** 只回填一个输入框（失焦 / Enter 提交后恢复规范值；不碰其它正在编辑的格子）。 */
function fillOne(el, view) {
  if (!el) return;
  var v = view || {};
  if (el === els.hp) { el.value = hpText(v); return; }
  if (el === els.surge) { el.value = surgeText(v); return; }
  for (var i = 0; i < HPE_DEF_KEYS.length; i++) {
    var key = HPE_DEF_KEYS[i];
    if (el === els["def_" + key]) { el.value = defText(v, key); return; }
  }
}

async function commit(trigger, sourceEl) {
  if (state.busy) { state.pending = true; return; }
  if (!state.editable) return; /* 只读 / 锁定：绝不写 */
  /* 版本租约的安全网：后台已经把「当前编辑谁」换成别的 token 时，这个旧窗口不许再写。 */
  var leaseNow = lease.capture();
  if (leaseNow && leaseNow.itemId !== itemId) {
    note("这个窗口已经过期：请重新右键「编辑血条」", "error");
    feedback("窗口已过期：重新右键「编辑血条」再改", "WARNING");
    return;
  }
  var built = buildHpEditPatch(formValues(), state.view || {});
  if (!built.ok) {
    if (trigger === "blur" || trigger === "change" || trigger === "enter") {
      /* 半截 / 非法输入：只把这一格恢复成当前值，不写 token（别动其它正在编辑的格子） */
      fillOne(sourceEl, state.view || {});
      refreshNote();
    } else {
      note(built.message, "warn");
    }
    return;
  }
  if (hpPatchEqualsView(built.patch, state.view)) return; /* 同值不写、不广播（避免元数据抖动） */
  state.busy = true;
  var res = await writeHpEdit({
    getItems: function (ids) { return OBR.scene.items.getItems(ids); },
    updateItems: function (ids, fn) { return OBR.scene.items.updateItems(ids, fn); },
    getRole: roleOf,
    getId: playerIdOf
  }, itemId, built.patch);
  state.busy = false;
  if (state.pending) {
    state.pending = false;
    scheduleSave();
  }
  if (!res.ok) {
    /* 写失败绝不静默（用户明确要求）：通知中心 ERROR + 窗口内红字 */
    note(res.message, "error");
    feedback(res.message, "ERROR");
    return;
  }
  state.view = hpEditView(res.hp, null);
  /* 失焦 / Enter 提交成功时，把这一格回填成夹取后的规范值（如 171/20 → 20/20）；正在别的格子输入时不动它 */
  if (sourceEl) fillOne(sourceEl, state.view);
  showSaved(state.view);
  /* 让后台立刻重画（也兜住「后台没收到 scene.items.onChange」的情况） */
  broadcast(CH_HP_EDIT_SAVED, { itemId: itemId, hp: res.hp, at: Date.now() });
}

function closeWindow() {
  /* v1.7.10：✕ 双保险 —— popover.close(本窗 id) + 后台 {op:"close-win"}。 */
  closeSelf(ID_HP_EDIT, "hpEdit");
}

/* ---------------------------------------------------------------------------
 * 事件
 * ------------------------------------------------------------------------- */
if (els.close) els.close.addEventListener("click", closeWindow);

var inputs = [els.hp, els.surge];
for (var k = 0; k < HPE_DEF_KEYS.length; k++) inputs.push(els["def_" + HPE_DEF_KEYS[k]]);
for (var i = 0; i < inputs.length; i++) {
  var el = inputs[i];
  if (!el) continue;
  /* v1.8.5：自动保存接线 —— input 防抖 500ms；change / blur / Enter 立即提交（带上触发的那一格）。 */
  el.addEventListener("input", function () { scheduleSave(); });
  el.addEventListener("change", function () { void commit("change", el); });
  el.addEventListener("blur", function () { void commit("blur", el); });
  el.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); clearSaveTimer(); void commit("enter", el); }
    else if (ev.key === "Escape") { ev.preventDefault(); closeWindow(); }
  });
}
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Escape") closeWindow();
});

/* 后台的版本租约：ready → 后台补发 target（面板 iframe 可能比第一条广播晚加载） */
onReady(function () {
  try {
    OBR.broadcast.onMessage(CH_HP_EDIT_TARGET, function (ev) {
      var data = ev && ev.data !== undefined ? ev.data : ev;
      if (!lease.accept(data)) return;
      var now = lease.state;
      if (now.itemId && now.itemId !== itemId) {
        /* 同一个 popover id 又开了别的 token：直接跟过去（URL 一般已经换了，这里兜住缓存页） */
        itemId = now.itemId;
        void load();
      }
    });
  } catch (e) { /* 忽略：没有 broadcast 也能手动保存 */ }
  broadcast(CH_HP_EDIT_READY, { session: session, itemId: itemId, at: Date.now() });
  void load();
});

/* 直接打开本页（不在枭熊里）时 onReady 会兜底执行，上面那段已经处理了 */
