// 绑定弹窗：把某张角色卡绑到右键点到的那枚 token 上。
import OBR from "../vendor/obr-sdk.js";
import { NS, getCards, getItemBinding, bindToken, notify, esc, onReady } from "./common.js";
import { cardMeta } from "./glance.js";

const params = new URLSearchParams(location.search);
const itemId = params.get("item") || "";

const listEl = document.getElementById("list");
const subEl = document.getElementById("sub");
const unbindBtn = document.getElementById("unbind");
const searchEl = document.getElementById("q");

let cards = [];
let boundId = null;
let tokenName = "";

function closeSelf() {
  OBR.modal.close(NS + "/bind").catch(function () { /* ignore */ });
}

function rowHtml(card, on) {
  let m = null;
  try {
    m = cardMeta(card.char);
  } catch (e) {
    m = { level: card.level || 1, race: "", cls: "", hp: "?", maxHp: "?" };
  }
  const ident = [m.race, m.cls].filter(Boolean).join(" · ");
  return '<button class="bind-row' + (on ? " cur" : "") + '" data-id="' + esc(card.id) + '">' +
    '<span class="n">' + esc(card.name) + (on ? '<span class="pill green">当前绑定</span>' : "") + "</span>" +
    '<span class="m">Lv' + esc(m.level) + (ident ? " · " + esc(ident) : "") +
    " · HP " + esc(m.hp) + "/" + esc(m.maxHp) + "</span></button>";
}

function renderList() {
  const q = String(searchEl.value || "").trim().toLowerCase();
  const shown = cards.filter(function (c) {
    if (!q) return true;
    return (String(c.name) + " " + String(c.char && c.char.raceId) + " " + String(c.char && c.char.classId)).toLowerCase().indexOf(q) >= 0;
  });
  if (!cards.length) {
    listEl.innerHTML = '<div class="pop-empty">这个房间还没有角色卡。<br>先打开右下角的 4E 角色卡面板导入 JSON。</div>';
    return;
  }
  if (!shown.length) {
    listEl.innerHTML = '<div class="pop-empty">没有匹配的卡片。</div>';
    return;
  }
  listEl.innerHTML = shown.map(function (c) { return rowHtml(c, c.id === boundId); }).join("");
  Array.prototype.forEach.call(listEl.querySelectorAll(".bind-row"), function (el) {
    el.addEventListener("click", function () {
      void doBind(el.getAttribute("data-id"));
    });
  });
}

async function doBind(cardId) {
  try {
    await bindToken(itemId, cardId);
    /* v1.7.8：「已绑定角色卡 / 已解除绑定」不再弹（窗一关就能在速览 / 面板里看到结果）。 */
    closeSelf();
  } catch (e) {
    console.error("[4enext] 绑定失败", e);
    notify("绑定失败：可能没有这个 token 的修改权限", "ERROR");
  }
}

document.getElementById("cancel").addEventListener("click", closeSelf);
unbindBtn.addEventListener("click", function () { void doBind(null); });
searchEl.addEventListener("input", renderList);

async function init() {
  try {
    const items = await OBR.scene.items.getItems([itemId]);
    tokenName = items[0] ? items[0].name || "" : "";
  } catch (e) { /* ignore */ }
  cards = await getCards();
  boundId = await getItemBinding(itemId);
  subEl.textContent = (tokenName ? "token：" + tokenName : "未找到 token") + (boundId ? " · 已绑定" : " · 未绑定");
  if (!boundId) unbindBtn.style.display = "none";
  renderList();
  searchEl.focus();
}

onReady(function () {
  void init();
});
