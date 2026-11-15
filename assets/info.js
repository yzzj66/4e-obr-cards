// 选中绑定的 token 时弹出的「速览」小面板。
// v1.2.0：血量可直接加减（写回 token 元数据，token 上会跟着画血条），
//         威能 / 装备 / 行动点等消耗类资源可点击标记（写回房间数据，写不进去退回本机）。
// v1.2.1：弹窗整体加宽到 660×700（尺寸在 background.core.js 的 INFO_W / INFO_H，小屏自动夹到视口内）；
//         专长改为纯展示、装备栏去掉「每日威能」计数（数据键名不变，老状态照旧能读）。
// v1.2.2：顶部标题栏可以按住拖动整个弹窗（位置由后台重开 popover 实现，见 background.core.js），
//         右上角「⌖」回到 token 上方。位置按 token 记在 localStorage["4enext/info-pos"]。
// 交互语义照抄 4E NEXT 的速览页（GlanceVitals.tsx / GlanceResources.tsx）。
// v1.7.12：① 威能（遭遇 / 每日 / 辅助 / 种族职业）与装备每行都可点（同一套 [data-act] 事件委托，
//         不按容器 / 分类分组绑定）；② 「玩家端隐藏数字」改名「共享数据」并挪到卡片标题区右侧，
//         仍写同一个 hp.locked 字段（开 = 共享 = 显示精确数字）；③ 推导时带上实时 hp / state，
//         计数（里程碑→魔法物品每日威能上限等）跟着最新状态走。
// v1.7.13：真机「点不动」回归 —— ③ 事件委托从 #body 挪到 **document 捕获阶段**（重画换 DOM、
//         子元素 stopPropagation、甚至正文外层被包一层都不会丢点击）；④ 渲染层 / 读写层带 ?v=1.7.14，
//         避免浏览器 / 宿主继续用旧缓存的 glance.js（旧版威能 chip 根本不是 button）。
import OBR from "../vendor/obr-sdk.js";
import { CH_INFO_DRAG, ID_INFO, ID_PANEL, INFO_DRAG_THROTTLE_MS, URL_PANEL, KEY_BIND, getCards, findCard, esc, onReady, notify } from "./common.js";
/* v1.7.13：带版本查询串 —— 旧缓存的 glance.js / track.js 正是「chip 点不动」的另一种可能，
 * 更新后必须让浏览器重新取这两个文件（info.html 的入口也带了 ?v=）。 */
import { renderGlanceHTML, deriveGlance, magicItemDailyUses, loadCardIndex, cardIndex } from "./glance.js?v=1.8.3";
/* v1.7.10：✕ 统一走「OBR.popover.close(正确 id) + OBR.modal.close + 后台 {op:"close-win"}」双保险。 */
import { closeSelf } from "./window.js";
import { KEY_HP, applyAction, hpView, loadState, mayEditItem, readItem, scopeText, syncTokenStats } from "./track.js?v=1.8.3";

const params = new URLSearchParams(location.search);
let itemId = params.get("item") || "";
let cardId = params.get("card") || "";

const bodyEl = document.getElementById("body");
const titleEl = document.getElementById("title-text");
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

/* ---------------- 拖动弹窗（v1.2.2） ----------------
 * OBR 的 popover 不能直接拖：这里只负责收指针、算出「相对按下点的累计位移」发给后台；
 * 后台在同一个 id 上重新 open（只换 anchorPosition）→ 弹窗跟着走，页面不重载。
 * 位置换算 / 视口夹取 / localStorage 记忆 / 节流间隔都在 background.core.js 与 common.js。
 */
const headEl = document.getElementById("head");
const pinEl = document.getElementById("pin");
/* 位移用 screenX/screenY 算，**不能用 clientX/clientY**：
 * 弹窗会跟着指针一起移动，iframe 自己的坐标原点也在动，client 坐标的差值会被
 * 弹窗位移抵消（一帧走 10px、下一帧又回到 0），拖起来会来回抖。屏幕坐标不受 iframe 位置影响。 */
let drag = null; // { id, x0, y0, dx, dy, timer }

function sendDrag(phase, dx, dy) {
  try {
    const p = OBR.broadcast.sendMessage(
      CH_INFO_DRAG,
      { phase: phase, dx: dx, dy: dy, at: Date.now() },
      { destination: "LOCAL" }
    );
    if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就算了 */ });
  } catch (e) { /* 不在枭熊里、直接打开本页时会走到这 */ }
}

/** 标题栏上的按钮 / 输入框不触发拖动；正文区完全不参与。 */
function draggableTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return !target.closest("button, a, input, select, textarea, label, [contenteditable='true'], .sp");
}

function endDrag() {
  if (!drag) return;
  if (drag.timer) { clearTimeout(drag.timer); drag.timer = 0; }
  sendDrag("end", Math.round(drag.dx), Math.round(drag.dy));
  try {
    if (headEl.hasPointerCapture && headEl.hasPointerCapture(drag.id)) headEl.releasePointerCapture(drag.id);
  } catch (e) { /* 忽略 */ }
  drag = null;
  document.body.classList.remove("dragging");
}

if (headEl) {
  headEl.addEventListener("pointerdown", function (ev) {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    if (!draggableTarget(ev.target)) return;
    ev.preventDefault();
    drag = { id: ev.pointerId, x0: ev.screenX, y0: ev.screenY, dx: 0, dy: 0, timer: 0 };
    try { headEl.setPointerCapture(ev.pointerId); } catch (e) { /* 老浏览器 */ }
    document.body.classList.add("dragging");
    sendDrag("start", 0, 0);
  });

  /* move / up 挂在 window 上：指针捕获生效时事件会重定向到标题栏再冒泡过来；
     万一捕获失败，指针滑到弹窗正文上也能继续收到 move（拖动不会中途断掉）。 */
  window.addEventListener("pointermove", function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    drag.dx = ev.screenX - drag.x0;
    drag.dy = ev.screenY - drag.y0;
    if (drag.timer) return; // 节流：一个间隔最多发一次，发的永远是最新位移
    drag.timer = setTimeout(function () {
      drag.timer = 0;
      if (!drag) return;
      sendDrag("move", Math.round(drag.dx), Math.round(drag.dy));
    }, INFO_DRAG_THROTTLE_MS);
  });

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  /* 指针跑出 iframe（弹窗被视口边界夹住）时可能收不到 pointerup：用 pointerleave 兜底；
     再往外的极端情况交给后台 1.5 秒没消息自动收尾（不用 window.blur：
     万一 OBR 重开弹窗时抢了焦点，blur 会把拖动在第一帧就结束掉）。 */
  document.addEventListener("pointerleave", endDrag);

  if (pinEl) {
    pinEl.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      sendDrag("reset", 0, 0);
    });
  }
}

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
  titleEl.textContent = "4eNEXT to owlbear · 速览";
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
  /* v1.7.12：带上实时 hp / state 推导 —— 共享开关、计数上限与画面用同一份数据。 */
  derived = deriveGlance(card.char, undefined, { hp: hp, state: state });
  /* v1.7.9：hp.boss 不再参与（Boss 模式已删，速览里没有那个开关了）。 */
  const sig = JSON.stringify([card.id, itemId, token ? 1 : 0, hp.cur, hp.max, hp.temp, hp.surges, hp.surgesMax,
    hp.defenses, hp.locked, state, scope, canHp]);
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
    /* v1.6.0：老 token 没有 surgesMax / 四防 → 趁打开速览写一次（只在真不一样时写），
     * 这样蓝色回复力条与四角盾第一次打开速览就能看见，不用城主动手加点。 */
    if (canHp && token) {
      try {
        const wrote = await syncTokenStats(token.id, hp, {
          maxHp: d0.hpMax, surgesMax: d0.surgesMax, defenses: d0.defenses
        });
        if (wrote) {
          token = await readItem(itemId);
          hp = hpView(token && token.metadata ? token.metadata[KEY_HP] : null, { maxHp: d0.hpMax, surges: d0.surges });
        }
      } catch (e) { /* 写不进去（玩家 / 只读 token）就算了，血条仍按已有字段画 */ }
    }
    const loaded = await loadState(card.id);
    state = loaded.state;
    scope = loaded.scope;
    if (force) lastSig = "";
    render();
    /* 标题：只留角色名（v1.7.6 删掉「token：xxx」这类副标题小字） */
    titleEl.textContent = card.name;
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
  derived = deriveGlance(card.char, undefined, { hp: hp, state: state });
  /* v1.8.1：临时回复值算进「使用回复力」；短休要清掉「遭遇」类专长的已用标记，
   * 专长频率来自按需加载的 card-index（没加载到就只清威能，功能降级不报错）。 */
  const liveState = state && typeof state === "object" ? state : {};
  const surgeTemp = typeof liveState.surgeTemp === "number" ? liveState.surgeTemp : 0;
  const idx = cardIndex();
  const encounterFeatKeys = (derived.feats || []).filter(function (f) {
    return !!(idx && idx.feats && idx.feats[f.id] === "e");
  }).map(function (f) { return f.key; });
  try {
    const res = await applyAction(act, el, {
      cardId: card.id,
      itemId: token ? token.id : itemId || null,
      hp: hp,
      state: state,
      maxHp: derived.hpMax,
      surgesMax: derived.surgesMax || derived.surges,
      defenses: derived.defenses,
      surgeValue: Math.max(0, derived.surgeValue + surgeTemp),
      encounterFeatKeys: encounterFeatKeys,
      canHp: canHp,
      itemDailyMax: magicItemDailyUses(derived.level, derived.milestones)
    });
    if (res.hp) hp = hpView(res.hp, { maxHp: derived.hpMax, surges: derived.surges });
    if (res.state) state = res.state;
    if (res.scope) scope = res.scope;
    /* v1.7.8：成功 / 普通提示不再弹；只有 applyAction 报的 WARNING（写不进房间数据 → 降级本机）才出声。 */
    if (res.message && res.tone === "WARNING") notify(res.message, "WARNING");
    render();
  } catch (e) {
    notify("操作失败：" + (e && e.message ? e.message : e), "ERROR");
  }
}

/* v1.7.13：事件委托从 #body 挪到 **document 捕获阶段**。
 * v1.7.12 挂 #body 时自测全绿、真机仍报「威能 / 装备全点不动」——把命中范围放到整个文档，
 * 下面三种情况都还能收到点击：
 *   ① body.innerHTML 重画时子节点整批换掉（监听器挂在容器上本来没问题，但正文外层再包一层就漏）；
 *   ② 某个页面脚本 / 宿主脚本在冒泡路上 stopPropagation（捕获阶段先于目标，拦不住）；
 *   ③ 将来把速览内容挪到别的容器（#app / .pop / 新外壳）时不用再改监听器。
 * 仍然只认 [data-act]：页头 #pin / #panel / #close 走各自的监听，不会被误判。 */
function onActClick(ev) {
  const target = ev.target;
  const el = target && target.closest ? target.closest("[data-act]") : null;
  if (!el) return;
  ev.preventDefault();
  void runAction(el.getAttribute("data-act"), el);
}
function onActChange(ev) {
  const el = ev.target;
  if (!el || !el.getAttribute) return;
  if (el.getAttribute("data-role") === "temp") void runAction("temp-set", el);
}
document.addEventListener("click", onActClick, true);
document.addEventListener("change", onActChange, true);

/* ---------------- 事件 ---------------- */

document.getElementById("close").addEventListener("click", async function () {
  closeSelf(ID_INFO, "info");
});

document.getElementById("panel").addEventListener("click", async function () {
  closeSelf(ID_INFO, "info");
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
  /* v1.8.1：先按需加载速览增强索引（动作类型 / 攻击命中 / 专长频率，约 1.2MB，只在这个弹窗用），
   * 再首帧渲染；加载失败也照常渲染（少几个标签，数值与点击不受影响）。 */
  void loadCardIndex().then(function () {
    lastSig = "";
    return refresh(true);
  }, function () {
    lastSig = "";
    return refresh(true);
  });
});