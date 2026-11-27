// v2.4.24：传送门编辑窗（GM）。读取 item metadata，保存时广播 CH_PORTAL_SAVE 回后台写 item。
import OBR from "../vendor/obr-sdk.js";
import { CH_PORTAL_EDIT_CLOSE, CH_PORTAL_SAVE, ID_PORTAL_EDIT, KEY_PORTAL, onReady } from "./common.js";
import { closeSelf, createWindow } from "./window.js";

var params = new URLSearchParams(location.search);
var itemId = params.get("item") || "";
var els = {
  name: document.getElementById("pe-name"),
  tag: document.getElementById("pe-tag"),
  showName: document.getElementById("pe-show-name"),
  visible: document.getElementById("pe-visible"),
  locked: document.getElementById("pe-locked"),
  save: document.getElementById("pe-save"),
  close: document.getElementById("pe-close")
};
var state = { portal: null, canEdit: false };

/* v2.4.24：标准窗口页（拖动标题栏 / 位置记忆 / 视口 reclamp 都走 assets/window.js）。 */
var win = createWindow({ name: "portalEdit", head: document.getElementById("head") });

function closePortalEdit() {
  try {
    var b = OBR.broadcast.sendMessage(CH_PORTAL_EDIT_CLOSE, { closedByUser: true, at: Date.now() }, { destination: "LOCAL" });
    if (b && typeof b.catch === "function") b.catch(function () {});
  } catch (e) { /* 忽略 */ }
  closeSelf(ID_PORTAL_EDIT, "portalEdit");
}

function fill(p) {
  var m = p || {};
  if (els.name) els.name.value = typeof m.name === "string" ? m.name : "传送门";
  if (els.tag) els.tag.value = typeof m.tag === "string" ? m.tag : "传送门";
  if (els.showName) els.showName.checked = m.showName !== false;
  if (els.visible) els.visible.checked = m.visible !== false;
  if (els.locked) els.locked.checked = m.locked !== false;
}

function readForm() {
  return {
    name: (els.name && els.name.value ? els.name.value : "").trim() || "传送门",
    tag: (els.tag && els.tag.value ? els.tag.value : "").trim() || "传送门",
    showName: !!(els.showName && els.showName.checked),
    visible: !!(els.visible && els.visible.checked),
    locked: !!(els.locked && els.locked.checked),

  };
}

async function load() {
  if (!itemId) return;
  try {
    var role = await OBR.player.getRole();
    state.canEdit = role === "GM";
    var items = await OBR.scene.items.getItems([itemId]);
    var item = items && items[0];
    if (!item) return;
    state.portal = item.metadata && item.metadata[KEY_PORTAL] ? item.metadata[KEY_PORTAL] : {};
    fill(state.portal);
    if (els.save) els.save.disabled = !state.canEdit;
  } catch (e) {
    console.error("[4enext][portal] 读取传送门失败", e);
  }
}

async function save() {
  if (!state.canEdit) return;
  var portal = readForm();
  try {
    var msg = OBR.broadcast.sendMessage(CH_PORTAL_SAVE, { itemId: itemId, portal: portal, at: Date.now() }, { destination: "LOCAL" });
    if (msg && typeof msg.then === "function") await msg;
  } catch (e) { /* 后台没起来：保存不了，保持窗口 */ }
  closePortalEdit();
}

onReady(function () {
  if (els.save) els.save.addEventListener("click", function () { void save(); });
  if (els.close) els.close.addEventListener("click", closePortalEdit);
  var closeX = document.getElementById("pe-close-x");
  if (closeX) closeX.addEventListener("click", closePortalEdit);
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closePortalEdit(); });
  void load();
});
