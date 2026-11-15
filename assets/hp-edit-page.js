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
  HPE_DEF_KEYS, buildHpEditPatch, createHpEditLease, defText,
  hpEditView, hpText, mayEditToken, surgeText, writeHpEdit
} from "./hp-edit-core.js";

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
  save: document.getElementById("hpe-save"),
  cancel: document.getElementById("hpe-cancel"),
  close: document.getElementById("close"),
  off: document.getElementById("hpe-off")
};
for (var di = 0; di < HPE_DEF_KEYS.length; di++) {
  els["def_" + HPE_DEF_KEYS[di]] = document.getElementById("hpe-def-" + HPE_DEF_KEYS[di]);
}

var state = { item: null, view: null, editable: false, busy: false };

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
  if (els.save) els.save.hidden = !on;   /* 只读时只藏「保存」，「取消 / ✕ / Esc」照旧能关窗 */
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
    note("这个窗口没有带 token 参数：请在 token 上右键「添加血条组件」重新打开", "error");
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
  var editable = mayEditToken(item, role, pid);
  setEditable(editable);

  var card = await cardDefaults(item);
  var view = hpEditView(item.metadata ? item.metadata["com.4enext-owlbear/hp"] : null, card);
  state.view = view;
  if (els.name) els.name.textContent = (item.name || "").trim() || "未命名";
  fillForm(view);

  if (!editable) {
    note("只读：只有城主或这枚 token 的创建者能改血量与四防", "warn");
  } else if (view.fromCard) {
    note("已按绑定角色卡带入默认值，改完点保存", "ok");
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

async function save() {
  if (state.busy) return;
  if (!state.editable) {
    feedback("只读：只有城主或这枚 token 的创建者能改血量与四防", "WARNING");
    return;
  }
  /* 版本租约的安全网：后台已经把「当前编辑谁」换成别的 token 时，这个旧窗口不许再写
   * （正常路径下 target 一到就 load() 跟过去了，这里兜住极端时序）。 */
  var leaseNow = lease.capture();
  if (leaseNow && leaseNow.itemId !== itemId) {
    note("这个窗口已经过期：请重新右键「添加血条组件」", "error");
    feedback("窗口已过期：重新右键「添加血条组件」再改", "WARNING");
    return;
  }
  var built = buildHpEditPatch(formValues(), state.view || {});
  if (!built.ok) {
    note(built.message, "warn");
    feedback(built.message, "WARNING");
    var focusKey = built.field && built.field !== "hp" && built.field !== "surge" ? "def_" + built.field : built.field;
    var focusEl = focusKey ? els[focusKey] : null;
    if (focusEl && focusEl.focus) focusEl.focus();
    return;
  }
  state.busy = true;
  if (els.save) els.save.disabled = true;
  var res = await writeHpEdit({
    getItems: function (ids) { return OBR.scene.items.getItems(ids); },
    updateItems: function (ids, fn) { return OBR.scene.items.updateItems(ids, fn); },
    getRole: roleOf,
    getId: playerIdOf
  }, itemId, built.patch);
  state.busy = false;
  if (els.save) els.save.disabled = false;

  if (!res.ok) {
    /* 写失败绝不静默（用户明确要求）：通知中心 ERROR + 窗口内红字 */
    note(res.message, "error");
    feedback(res.message, "ERROR");
    return;
  }
  state.view = hpEditView(res.hp, null);
  fillForm(state.view);
  var hp = state.view;
  note("已保存 " + hp.cur + "/" + hp.max + (hp.surges !== null ? " · 回复力 " + hp.surges : "") +
    (built.hasDefenses ? "（含四防）" : "（四防留空 = 不画盾）"), "ok");
  feedback("已保存：" + hp.cur + "/" + hp.max + (built.hasDefenses ? "，四防已写入" : "，四防为空"), "SUCCESS");
  /* 让后台立刻重画（也兜住「后台没收到 scene.items.onChange」的情况） */
  broadcast(CH_HP_EDIT_SAVED, { itemId: itemId, hp: res.hp, at: Date.now() });
}

function closeWindow() {
  closeSelf(ID_HP_EDIT);
}

/* ---------------------------------------------------------------------------
 * 事件
 * ------------------------------------------------------------------------- */
if (els.close) els.close.addEventListener("click", closeWindow);
if (els.cancel) els.cancel.addEventListener("click", closeWindow);
if (els.save) els.save.addEventListener("click", function () { void save(); });

var inputs = [els.hp, els.surge];
for (var k = 0; k < HPE_DEF_KEYS.length; k++) inputs.push(els["def_" + HPE_DEF_KEYS[k]]);
for (var i = 0; i < inputs.length; i++) {
  var el = inputs[i];
  if (!el) continue;
  el.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); void save(); }
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
