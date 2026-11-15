// 选中绑定的 token 时弹出的「速览」小面板。
// v1.2.0：血量可直接加减（写回 token 元数据，token 上会跟着画血条），
//         威能 / 专长 / 装备 / 行动点等消耗类资源可点击标记（写回房间数据，写不进去退回本机）。
// 交互语义照抄 4E NEXT 的速览页（GlanceVitals.tsx / GlanceResources.tsx）。
import OBR from "../vendor/obr-sdk.js";
import { ID_INFO, ID_PANEL, URL_PANEL, KEY_BIND, getCards, findCard, esc, onReady, notify } from "./common.js";
import { renderGlanceHTML, deriveGlance, magicItemDailyUses } from "./glance.js";
import { KEY_HP, applyAction, hpView, loadState, mayEditItem, readItem, scopeText } from "./track.js";

const params = new URLSearchParams(location.search);
let itemId = params.get("item") || "";
let cardId = params.get("card") || "";

const bodyEl = document.getElementById("body");
const titleEl = document.getElementById("title-text");
const subEl = document.getElementById("sub");
const scopeEl = document.getElementById("scope");

let card = null;
let token = null;
let hp = { cur: 0, max: 0, temp: 0, surges: 0 };
let state = null;
let scope = "room";
let canHp = false;
let derived = null;
let lastSig = "";
let busy = false;

/* ---------------- 解析绑定 ---------------- */

async function resolveCard() {
  const cards = await getCards();
  let hit = findCard(cards, cardId);
  if (hit) return hit;
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
      hit = findCard(cards, bound);
    }
  } catch (e) {
    /* 场景未就绪 */
  }
  return hit;
}

function showEmpty(html) {
  titleEl.textContent = "4E NEXT 速览";
  subEl.textContent = "未绑定角色卡";
  bodyEl.innerHTML = '<div class="pop-empty">' + html + "</div>";
  if (scopeEl) scopeEl.textContent = "";
  lastSig = "empty:" + html;
}

/* ---------------- 渲染 ---------------- */

function paintScope() {
  if (!scopeEl) return;
  const parts = [];
  parts.push(scope === "local" ? "资源：本机" : "资源：全桌");
  parts.push(canHp ? "血量：可改" : "血量：只读");
  scopeEl.textContent = parts.join(" · ");
  scopeEl.title = scopeText(scope) + (canHp ? "；血量写在 token 上，全桌可见" : "；只有城主或这枚 token 的创建者能改血量");
}

function render() {
  if (!card) return;
  derived = deriveGlance(card.char);
  const sig = JSON.stringify([card.id, itemId, token ? 1 : 0, hp.cur, hp.max, hp.temp, hp.surges, state, scope, canHp]);
  if (sig === lastSig) return;
  lastSig = sig;
  try {
    bodyEl.innerHTML = renderGlanceHTML(card.char, {
      mode: "compact",
      live: { hp: hp, state: state },
      editable: { hp: canHp, track: true, rest: canHp }
    });
  } catch (e) {
    console.error("[4enext] 速览渲染失败", e);
    bodyEl.innerHTML = '<div class="pop-empty">渲染失败：' + esc(e && e.message ? e.message : e) + "</div>";
  }
  paintScope();
}

/* ---------------- 读数据 ---------------- */

async function refresh(force) {
  if (busy) return;
  busy = true;
  try {
    if (!itemId) {
      try {
        const sel = await OBR.player.getSelection();
        if (sel && sel.length === 1) itemId = sel[0];
      } catch (e) { /* 场景未就绪 */ }
    }
    card = await resolveCard();
    if (!card) {
      showEmpty("这枚 token 没有绑定角色卡。<br>右键 token 重新绑定，或在角色卡面板里重新导入。");
      return;
    }
    token = await readItem(itemId);
    const cardBound = token && token.metadata ? token.metadata[KEY_BIND] : null;
    if (token && typeof cardBound === "string" && cardBound && cardBound !== card.id) {
      card = findCard(await getCards(), cardBound) || card;
    }
    const d0 = deriveGlance(card.char);
    canHp = token ? await mayEditItem(token) : false;
    hp = hpView(token && token.metadata ? token.metadata[KEY_HP] : null, { maxHp: d0.hpMax, surges: d0.surges });
    const loaded = await loadState(card.id);
    state = loaded.state;
    scope = loaded.scope;
    if (force) lastSig = "";
    render();
    /* 标题 */
    const tokenName = token ? token.name || "" : "";
    titleEl.textContent = card.name;
    subEl.textContent = token
      ? (tokenName && tokenName !== card.name ? "token：" + tokenName : (canHp ? "点数值可改，改动写回这枚 token" : "血量只读 · 资源可点"))
      : "token 已不在场景里";
    if (!token && !bodyEl.querySelector(".gl4-warn")) {
      bodyEl.insertAdjacentHTML("afterbegin",
        '<div class="gl4-warn">这枚 token 已不在场景里（或血条被清掉了）：血条会自动重建；token 被删除时请重新绑定。</div>');
    }
  } catch (e) {
    console.error("[4enext] 刷新速览失败", e);
  } finally {
    busy = false;
  }
}

/* ---------------- 交互 ---------------- */

async function runAction(act, el) {
  if (!card || !act) return;
  if (!derived) derived = deriveGlance(card.char);
  try {
    const res = await applyAction(act, el, {
      cardId: card.id,
      itemId: token ? token.id : itemId || null,
      hp: hp,
      state: state,
      maxHp: derived.hpMax,
      surgesMax: derived.surges,
      surgeValue: derived.surgeValue,
      canHp: canHp,
      itemDailyMax: magicItemDailyUses(derived.level, derived.milestones)
    });
    if (res.hp) hp = hpView(res.hp, { maxHp: derived.hpMax, surges: derived.surges });
    if (res.state) state = res.state;
    if (res.scope) scope = res.scope;
    if (res.message) notify(res.message, res.tone || "INFO");
    render();
  } catch (e) {
    notify("操作失败：" + (e && e.message ? e.message : e), "ERROR");
  }
}

bodyEl.addEventListener("click", function (ev) {
  const el = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
  if (!el) return;
  ev.preventDefault();
  void runAction(el.getAttribute("data-act"), el);
});

bodyEl.addEventListener("change", function (ev) {
  const el = ev.target;
  if (!el || !el.getAttribute) return;
  if (el.getAttribute("data-role") === "temp") void runAction("temp-set", el);
});

/* ---------------- 事件 ---------------- */

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

let pending = null;
function schedule(force) {
  if (pending) return;
  pending = setTimeout(function () {
    pending = null;
    void refresh(force);
  }, 120);
}

onReady(function () {
  try {
    OBR.room.onMetadataChange(function () {
      schedule(false);
    });
    OBR.scene.items.onChange(function () {
      schedule(false);
    });
    OBR.player.onChange(function () {
      schedule(true);
    });
  } catch (e) {
    console.error(e);
  }
  void refresh(true);
});
