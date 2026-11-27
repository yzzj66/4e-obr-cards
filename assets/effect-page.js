// v1.7.0：投骰动画页（effect.html）——**只做呈现**，结果由骰子窗口先算好再传进来。
// ---------------------------------------------------------------------------
// 参数（由 assets/dice-core.js 的 fxQuery 生成，逗号分隔的并列数组）：
//   dtypes / dvalues / doriginals / dlosers / dsubtract
//   total / modifier / label / rollId / color / wx / wy / rowStarts
// 公式（docs/spec-dice.md §4.2 / §4.4，全部来自 dice-core.js 的纯函数）：
//   BASE_SIZE = N<=1 ? 128 : max(72, round(128*0.86^(N-1)))
//   dieSize   = round(BASE_SIZE * DIE_SIZE_FACTOR[type])；gap = round(BASE_SIZE*0.16)
//   每行 4 颗、水平居中；runningTotal.top = -BASE_SIZE/2-64；modBox.top = lastRowOy+BASE_SIZE/2+28
//   时间轴 FLIGHT 1200 → HOLD 500 → PUNCH 360 → HOLD2 220 → EXIT 320（合计 2600 ms，55 ms 跳数字）
//   四段抛物线（N_ARCS 4 / r 0.55 / H0 240）+ 720° 旋转，全部写成 CSS 关键帧（ui.css 末尾）
// 屏幕投影（§4.3）：sx = worldX * scale + vp.x，sy = worldY * scale + vp.y；
//   每 4 帧重读一次 OBR.viewport（丢帧时也不会堆请求），拖动镜头骰子跟着 token 走。
// 降级：任何异常都只影响这一层 —— 隐藏舞台并关闭 modal，绝不挡住 / 影响已经完成的那次投掷。
// v1.7.1（修「投骰后地图被全屏黑盖住」）：
//   · 透明由 effect.html 的内联样式 + ui.css 的 html:has(body.fx-page) 负责（连 html 一起透明）；
//   · 关闭有三级：动画播完 b.total（2600 ms）→ 兜底 FX_CLOSE_FALLBACK_MS（3000 ms）→ ESC / 点击任意处立即关。
//     finish() 幂等，先到的那个赢；关了之后清掉所有定时器与 rAF。
import OBR from "../vendor/obr-sdk.js";
import { NS, onReady } from "./common.js";
import { FX_MAX_DICE, fxBeat, fxLayout, sidesOf } from "./dice-core.js";
import { diceSvg, diceImage, diceLayout, diceFxDuration, diceSpeed } from "./dice-fx.js?v=2.4.34";

/** v1.7.1：兜底关闭时长（ms）。动画总时长是 2600 ms（fxBeat().total），这里再留 400 ms 余量：
 *  到点不管动画播到哪一步都强制 OBR.modal.close —— 页面被挂起 / rAF 挂掉 / 动画被打断时，
 *  屏幕上也不会留下这一层（它的背景已经透明，但绝不能挡住地图）。
 *  finish() 是幂等的：2600 与 3000 谁先到谁关，另一个到点只会空跑。 */
var FX_CLOSE_FALLBACK_MS = 3000;

/** 参数解析：全部走 URLSearchParams，坏值一律当空。 */
function b64urlDecode(str) {
  try {
    var b = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    var bin = atob(b);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}
function readParams() {
  var sp;
  try {
    sp = new URLSearchParams(location.search || "");
  } catch (e) {
    sp = { get: function () { return null; } };
  }
  var get = function (k) { var v = sp.get(k); return v == null ? "" : String(v); };
  var split = function (k) { var raw = get(k); return raw ? raw.split(",") : []; };
  var types = split("dtypes");
  var values = split("dvalues");
  var originals = split("doriginals");
  var losers = split("dlosers");
  var subtracts = split("dsubtract");
  var dice = [];
  for (var i = 0; i < types.length; i++) {
    var type = types[i] || "d20";
    var sides = sidesOf(type) || 20;
    var value = Math.round(Number(values[i]));
    if (!isFinite(value)) value = 1;
    var one = { type: "d" + sides, value: Math.max(1, Math.min(sides, value)) };
    if (losers[i] === "1") one.loser = true;
    if (subtracts[i] === "1") one.subtract = true;
    var orig = originals[i];
    if (orig !== "" && orig != null) {
      var o = Math.round(Number(orig));
      if (isFinite(o) && o !== one.value) one.originalValue = o;
    }
    dice.push(one);
  }
  var rowStarts = [];
  var rawRows = get("rowStarts");
  if (rawRows) {
    var parts = rawRows.split(",");
    for (var k = 0; k < parts.length; k++) {
      var n = Math.round(Number(parts[k]));
      if (isFinite(n) && n >= 0) rowStarts.push(n);
    }
  }
  var wx = Number(get("wx"));
  var wy = Number(get("wy"));
  var dataPayload = b64urlDecode(get("data"));
  if (dataPayload && Array.isArray(dataPayload.dice)) {
    var payoutDice = [];
    for (var pi = 0; pi < dataPayload.dice.length; pi++) {
      var pd = dataPayload.dice[pi] || {};
      payoutDice.push({ type: String(pd.type || "d20"), value: Math.max(1, Math.round(Number(pd.value) || 1)), loser: !!pd.loser, subtract: !!pd.subtract });
    }
    return {
      dice: payoutDice,
      total: Math.round(Number(dataPayload.total) || 0),
      modifier: Math.round(Number(dataPayload.modifier) || 0),
      label: String(dataPayload.label || "").slice(0, 40),
      rollId: String(dataPayload.id || dataPayload.rollId || ""),
      color: String(dataPayload.color || ""),
      rowStarts: [],
      world: dataPayload.anchor && isFinite(dataPayload.anchor.x) && isFinite(dataPayload.anchor.y)
        ? { x: Number(dataPayload.anchor.x), y: Number(dataPayload.anchor.y) } : null
    };
  }
  return {
    dice: dice,
    total: Math.round(Number(get("total")) || 0),
    modifier: Math.round(Number(get("modifier")) || 0),
    label: get("label").slice(0, 40),
    rollId: get("rollId"),
    color: get("color"),
    rowStarts: rowStarts,
    world: (isFinite(wx) && isFinite(wy) && get("wx") !== "" && get("wy") !== "") ? { x: wx, y: wy } : null
  };
}

var state = {
  closed: false,
  timers: [],
  raf: 0,
  slotTimer: 0,
  dice: [],
  nodes: [],
  layout: null,
  beat: null,
  vp: { x: 0, y: 0 },
  scale: 1,
  frame: 0
};

function later(fn, ms) {
  state.timers.push(setTimeout(fn, ms));
}

function clearTimers() {
  for (var i = 0; i < state.timers.length; i++) clearTimeout(state.timers[i]);
  state.timers = [];
  if (state.slotTimer) { clearInterval(state.slotTimer); state.slotTimer = 0; }
}

function modalId() {
  try {
    if (OBR.modal && typeof OBR.modal.getId === "function") {
      var id = OBR.modal.getId();
      if (id) return id;
    }
  } catch (e) { /* 旧版 SDK 没有 getId */ }
  return NS + "/dice-effect-" + (state.rollId || "");
}

/** 播放完 / 出错都走这里：清定时器、停 rAF、关掉自己（关不掉也不影响任何东西）。 */
async function finish() {
  if (state.closed) return;
  state.closed = true;
  clearTimers();
  if (state.raf) {
    try { cancelAnimationFrame(state.raf); } catch (e) { /* 忽略 */ }
    state.raf = 0;
  }
  var stage = document.getElementById("fx-stage");
  if (stage) stage.classList.add("fx-done");
  var id = modalId();
  try {
    if (OBR.modal && typeof OBR.modal.close === "function" && id) await OBR.modal.close(id);
  } catch (e2) { /* 已经被外面关掉了 */ }
}

function readViewport() {
  var jobs = [];
  try {
    if (OBR.viewport && typeof OBR.viewport.getPosition === "function") {
      jobs.push(OBR.viewport.getPosition().then(function (p) {
        if (p && isFinite(p.x) && isFinite(p.y)) state.vp = { x: p.x, y: p.y };
      }).catch(function () { /* 忽略 */ }));
    }
    if (OBR.viewport && typeof OBR.viewport.getScale === "function") {
      jobs.push(OBR.viewport.getScale().then(function (s) {
        if (typeof s === "number" && isFinite(s) && s > 0) state.scale = s;
      }).catch(function () { /* 忽略 */ }));
    }
  } catch (e) { /* 不在枭熊里 */ }
  return Promise.all(jobs);
}

/** 世界坐标 → 屏幕坐标（规格 §4.3）；没有坐标就落在视口中心。 */
function applyPosition() {
  var wrap = document.getElementById("fx-wrap");
  if (!wrap) return;
  var w = window.innerWidth || 800;
  var h = window.innerHeight || 600;
  var sx = w / 2;
  var sy = h / 2;
  if (state.world) {
    sx = state.world.x * state.scale + state.vp.x;
    sy = state.world.y * state.scale + state.vp.y;
  }
  var tx = Math.round(sx) + "px";
  var ty = Math.round(sy) + "px";
  wrap.style.setProperty("--tx", tx);
  wrap.style.setProperty("--ty", ty);
  wrap.style.setProperty("--vp-scale", String(state.scale));
  /* 暴击光圈是 #fx-stage 的子元素（不是 .fx-wrap 的），变量写在舞台上也给它一份 */
  var stage = document.getElementById("fx-stage");
  if (stage) {
    stage.style.setProperty("--tx", tx);
    stage.style.setProperty("--ty", ty);
  }
}

function frameLoop() {
  if (state.closed) return;
  state.frame++;
  /* 每 4 帧重读一次视口：拖动镜头时骰子跟着 token 走，又不至于每帧两个 Promise */
  if (state.frame % 4 === 1) void readViewport();
  applyPosition();
  try {
    state.raf = requestAnimationFrame(frameLoop);
  } catch (e) {
    state.raf = 0;
  }
}

function buildDice() {
  var wrap = document.getElementById("fx-wrap");
  if (!wrap || !state.layout) return;
  var slots = state.layout.slots || [];
  for (var i = 0; i < state.dice.length && i < slots.length && i < FX_MAX_DICE; i++) {
    var d = state.dice[i];
    var slot = slots[i];
    var el = document.createElement("div");
    el.className = "fx-die";
    var sides = sidesOf(d.type) || 20;
    if (d.loser) el.classList.add("is-loser");
    if (d.subtract) el.classList.add("is-subtract");
    if (!d.loser && !d.subtract && d.value === sides) el.classList.add("is-crit");
    else if (!d.loser && !d.subtract && d.value === 1) el.classList.add("is-fail");
    el.style.width = slot.size + "px";
    el.style.height = slot.size + "px";
    el.style.left = (slot.ox - slot.size / 2) + "px";
    el.style.top = (slot.oy - slot.size / 2) + "px";
    el.style.setProperty("--dice-size", slot.size + "px");
    el.style.setProperty("--fx-flight", state.beat.flight + "ms");
    /* 奇偶反向旋转：一排骰子不会像同一个模子刻出来的 */
    el.style.setProperty("--fx-rot", (i % 2 ? -1 : 1) * state.beat.rotBase + "deg");

    var box = document.createElement("div");
    box.className = "fx-box";
    /* v2.4.34：自绘骰子轮廓（d4/d6/d8/d10/d12/d20/d100），号码仍由 .fx-num 滚动/定格。 */
    var shape = document.createElement("span");
    shape.className = "fx-shape";
    /* v2.4.34：优先用用户提供的 PNG 骰子素材；加载失败时回退自绘 SVG。 */
    shape.innerHTML = diceImage(d.type);
    var art = shape.firstChild;
    if (art && art.tagName === "IMG") {
      art.addEventListener("error", function () {
        try { shape.innerHTML = diceSvg(d.type, d.value); } catch (e) { /* 忽略 */ }
      }, { once: true });
    }
    box.appendChild(shape);
    var num = document.createElement("span");
    num.className = "fx-num rolling";
    num.textContent = "?";
    var orig = document.createElement("span");
    orig.className = "fx-orig";
    if (typeof d.originalValue === "number") orig.textContent = "(" + d.originalValue + ")";
    box.appendChild(num);
    if (typeof d.originalValue === "number") box.appendChild(orig);
    el.appendChild(box);
    wrap.appendChild(el);
    state.nodes.push({ el: el, box: box, num: num, sides: sides, die: d });
  }
}

/** 数字老虎机：每 55 ms 换一个 1..sides 的数字，落地时定住真实点数。 */
function startSlot() {
  if (!state.beat) return;
  state.slotTimer = setInterval(function () {
    for (var i = 0; i < state.nodes.length; i++) {
      var one = state.nodes[i];
      one.num.textContent = String(1 + Math.floor(Math.random() * one.sides));
    }
  }, state.beat.slot);
}

function settleNumbers() {
  if (state.slotTimer) { clearInterval(state.slotTimer); state.slotTimer = 0; }
  for (var i = 0; i < state.nodes.length; i++) {
    var one = state.nodes[i];
    one.num.classList.remove("rolling");
    one.num.classList.add("snap");
    one.num.textContent = String(one.die.value);
    if (one.die.loser) one.el.classList.add("settled");
  }
}

function showTotal() {
  var totalEl = document.getElementById("fx-total");
  var numEl = document.getElementById("fx-total-num");
  if (totalEl) totalEl.classList.add("on");
  if (numEl) numEl.textContent = String(state.total);
  var modEl = document.getElementById("fx-mod");
  var modNum = document.getElementById("fx-mod-num");
  var modLab = document.getElementById("fx-mod-label");
  if (modNum) modNum.textContent = state.modifier ? (state.modifier > 0 ? "+" + state.modifier : "−" + Math.abs(state.modifier)) : "";
  if (modLab) modLab.textContent = state.label || "";
  if (modEl && (state.modifier || state.label)) modEl.classList.add("on");
}

function punch() {
  /* 与参考实现一致：只有「单个赢家」（这里 = 只有一颗骰）才放大 1.18；多颗时只闪光圈，
   * 不动点数排版，避免一排骰子同时弹一下的廉价感。 */
  var winner = state.dice.length === 1 ? 0 : -1;
  if (winner >= 0 && state.nodes[winner]) state.nodes[winner].num.classList.add("land");
  /* 暴击 / 大失败再补一圈光（不改变点数，只是提示） */
  var flash = document.getElementById("fx-flash");
  if (!flash) return;
  for (var k = 0; k < state.nodes.length; k++) {
    var one = state.nodes[k];
    if (one.el.classList.contains("is-crit")) { flash.className = "fx-flash fire crit"; return; }
    if (one.el.classList.contains("is-fail")) { flash.className = "fx-flash fire fail"; return; }
  }
}

function exitStage() {
  var wrap = document.getElementById("fx-wrap");
  if (wrap) wrap.classList.add("exit");
}

function layoutStage() {
  var wrap = document.getElementById("fx-wrap");
  var totalEl = document.getElementById("fx-total");
  var modEl = document.getElementById("fx-mod");
  if (!wrap || !state.layout) return;
  if (totalEl) totalEl.style.top = state.layout.totalTop + "px";
  if (modEl) modEl.style.top = state.layout.modTop + "px";
  wrap.style.setProperty("--fx-base", state.layout.baseSize + "px");
  wrap.style.setProperty("--fx-gap", state.layout.gap + "px");
}

function play() {
  var data = readParams();
  state.dice = data.dice;
  state.total = data.total;
  state.modifier = data.modifier;
  state.label = data.label;
  state.rollId = data.rollId;
  state.world = data.world;
  state.beat = fxBeat();
  state.layout = diceLayout(data.dice, (window.innerWidth || 1280), (window.innerHeight || 720), { rowStarts: data.rowStarts });

  layoutStage();
  buildDice();
  applyPosition();
  /* 先把视口读一次，避免第一帧落在 (0,0) 再跳过去 */
  void readViewport();
  frameLoop();
  startSlot();

  var b = state.beat;
  later(punch, b.flight + b.hold);
  later(exitStage, b.flight + b.hold + b.punch + b.hold2);
  var fxDur = diceFxDuration(state.dice.length, diceSpeed());
  later(settleNumbers, b.flight);
  later(showTotal, b.flight + Math.round(b.hold / 2));
  later(function () { void finish(); }, Math.max(b.total, fxDur));
  later(function () { void finish(); }, Math.max(FX_CLOSE_FALLBACK_MS, fxDur + 400));
}

/** v1.7.1：ESC 立即关（不用等动画播完）。 */
function onKeyDown(e) {
  if (!e) return;
  if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) void finish();
}

/** v1.7.1：点击任意处立即关。整层是 pointer-events:none（点击本来会穿透给地图），
 *  但万一某个 OBR 版本没吃 disablePointerEvents，这一层收到点击也立刻收场。 */
function onClick() {
  void finish();
}

onReady(function () {
  /* v1.7.1：ESC / 点击任意处立即关（关不掉也有 2600 / 3000 ms 的定时器兜底） */
  try {
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("click", onClick, true);
  } catch (e) { /* 忽略 */ }
  try {
    play();
  } catch (e2) {
    /* 降级：动画画不出来就安静地不挡路（骰子窗口里已经有结果） */
    void finish();
  }
});

/* 万一 modal 直接被关掉 / 页面要卸载，别留下定时器 */
try {
  window.addEventListener("pagehide", function () { clearTimers(); });
  window.addEventListener("error", function () { clearTimers(); });
} catch (e) { /* 忽略 */ }
