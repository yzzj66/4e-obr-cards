// 选中绑定的 token 时弹出的「速览」小面板（只读）。
import OBR from "../vendor/obr-sdk.js";
import { ID_INFO, ID_PANEL, URL_PANEL, KEY_BIND, getCards, findCard, esc, onReady } from "./common.js";
import { renderGlanceHTML } from "./glance.js";

const params = new URLSearchParams(location.search);
let itemId = params.get("item") || "";
let cardId = params.get("card") || "";

const bodyEl = document.getElementById("body");
const titleEl = document.getElementById("title-text");
const subEl = document.getElementById("sub");

async function resolveCard() {
  const cards = await getCards();
  let card = findCard(cards, cardId);
  if (card) return card;
  // 兜底：按当前选中 token 的绑定再找一次
  try {
    if (!itemId) {
      const sel = await OBR.player.getSelection();
      if (sel && sel.length === 1) itemId = sel[0];
    }
    const items = await OBR.scene.items.getItems([itemId]);
    const bound = items[0] && items[0].metadata ? items[0].metadata[KEY_BIND] : null;
    if (typeof bound === "string") {
      cardId = bound;
      card = findCard(cards, bound);
    }
  } catch (e) {
    /* 场景未就绪 */
  }
  return card;
}

async function render() {
  const card = await resolveCard();
  if (!card) {
    titleEl.textContent = "4E NEXT 速览";
    subEl.textContent = "未绑定角色卡";
    bodyEl.innerHTML = '<div class="pop-empty">这个 token 绑定的角色卡已被删除。<br>右键 token 重新绑定，或在角色卡面板里重新导入。</div>';
    return;
  }
  let tokenName = "";
  try {
    const items = await OBR.scene.items.getItems([itemId]);
    tokenName = items[0] ? items[0].name || "" : "";
  } catch (e) { /* ignore */ }
  titleEl.textContent = card.name;
  subEl.textContent = tokenName && tokenName !== card.name ? "token：" + tokenName : "导出时快照 · 只读";
  try {
    bodyEl.innerHTML = renderGlanceHTML(card.char, { mode: "compact" });
  } catch (e) {
    console.error("[4enext] 速览渲染失败", e);
    bodyEl.innerHTML = '<div class="pop-empty">渲染失败：' + esc(e && e.message ? e.message : e) + "</div>";
  }
}

document.getElementById("close").addEventListener("click", async function () {
  try {
    await OBR.popover.close(ID_INFO);
  } catch (e) { /* ignore */ }
});

document.getElementById("panel").addEventListener("click", async function () {
  try {
    await OBR.popover.close(ID_INFO);
  } catch (e) { /* ignore */ }
  try {
    await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
  } catch (e) {
    console.error("[4enext] 打开面板失败", e);
  }
});

onReady(function () {
  try {
    OBR.room.onMetadataChange(function () {
      void render();
    });
  } catch (e) {
    console.error(e);
  }
  void render();
});
