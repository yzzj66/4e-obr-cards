// v2.1.0：传送目的地选择（玩家 / GM）。列表 = 同 tag 的其它传送门；点选后广播 CH_PORTAL_TELEPORT。
import OBR from "../vendor/obr-sdk.js";
import { CH_PORTAL_TELEPORT, ID_PORTAL_DEST, KEY_PORTAL, onReady } from "./common.js";
import { closeSelf, createWindow } from "./window.js";

var params = new URLSearchParams(location.search);
var sourceId = params.get("portal") || "";
var tokenIds = (params.get("tokens") || "").split(",").filter(Boolean);
var listEl = document.getElementById("pd-list");
var hintEl = document.getElementById("pd-hint");
var closeEl = document.getElementById("pd-close");
var portals = [];

/* v2.1.0：标准窗口页（拖动标题栏 / 位置记忆 / reclamp 走 assets/window.js）。 */
var win = createWindow({ name: "portalDest", head: document.getElementById("head") });

function closePortalDest() {
  closeSelf(ID_PORTAL_DEST, "portalDest");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function render() {
  if (!listEl) return;
  var html = "";
  for (var i = 0; i < portals.length; i++) {
    var p = portals[i];
    html += '<button class="dest" type="button" data-dest="' + esc(p.itemId) + '">' +
      "<span>" + esc(p.name || "传送门") + "</span>" +
      '<span class="tag">' + esc(p.tag || "") + "</span></button>";
  }
  listEl.innerHTML = html;
  if (!portals.length && hintEl) hintEl.textContent = "没有同标签的其它传送门。";
}

async function load() {
  try {
    var items = await OBR.scene.items.getItems();
    var all = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.metadata || !it.metadata[KEY_PORTAL]) continue;
      var m = it.metadata[KEY_PORTAL];
      all.push({
        itemId: it.id,
        name: typeof m.name === "string" ? m.name : "传送门",
        tag: typeof m.tag === "string" ? m.tag : "传送门"
      });
    }
    var src = all.filter(function (p) { return p.itemId === sourceId; })[0] || null;
    portals = src ? all.filter(function (p) { return p.itemId !== sourceId && p.tag === src.tag; }) : [];
    render();
  } catch (e) {
    console.error("[4enext][portal] 读取目的地失败", e);
  }
}

function choose(destId) {
  if (!destId) return;
  try {
    var p = OBR.broadcast.sendMessage(CH_PORTAL_TELEPORT, { destinationId: destId, tokenIds: tokenIds, at: Date.now() }, { destination: "LOCAL" });
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就无法传送 */ });
  } catch (e) { /* 忽略 */ }
  closePortalDest();
}

onReady(function () {
  if (listEl) {
    listEl.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-dest]") : null;
      if (btn) choose(btn.getAttribute("data-dest"));
    });
  }
  if (closeEl) closeEl.addEventListener("click", closePortalDest);
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closePortalDest(); });
  var closeX = document.getElementById("pd-close-x");
  if (closeX) closeX.addEventListener("click", closePortalDest);
  void load();
});
