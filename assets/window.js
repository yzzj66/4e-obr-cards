// v1.3.1：先攻 / 骰子 / 角色卡面板三个「独立窗口」共用的外壳。
// ---------------------------------------------------------------------------
// 为什么要有这个文件：v1.3.0 把功能塞进一个面板的三个 tab，用户明确不要。
// v1.3.1 起每个功能是**独立窗口**（独立 popover、独立入口、可同时打开），
// 但窗口的「外壳行为」必须一致，所以抽到这里：
//
//   1) 标题栏拖动：只发「起点 + 累计位移」给后台（CH_WIN_DRAG），后台在同一个
//      popover id 上重新 open（只换 anchorPosition）→ 窗口跟着走、页面不重载。
//      位置换算 / 视口夹紧 / localStorage 记忆都在 assets/background.core.js。
//   2) 后台在线检测：ping 不通就在顶部显示「后台未连接，点这里重试」，
//      并把窗口里的交互元素置灰（硬依赖 data-bg → 真 disabled；软依赖
//      data-bg-soft → 只弱化外观，因为那些操作其实只写房间数据 / 场景，不靠后台）。
//      目的只有一个：**不允许点了没反应**。
//   3) 反馈：feedback() 同时发 OBR.notification.show 和窗口内的状态行，
//      成功 / 失败 / 警告都有回音。
import OBR from "../vendor/obr-sdk.js";
import {
  CH_HELLO, CH_WIN_DRAG, WIN_DRAG_THROTTLE_MS,
  notify, onReady, pingBackground
} from "./common.js";

/** 后台连接三态（与先攻渲染里的 backgroundState 同名）。 */
export const BG_CHECKING = "checking";
export const BG_OK = "ok";
export const BG_BAD = "bad";

const PING_RETRY = 2;
const PING_RETRY_DELAY_MS = 1200;
const PING_TIMEOUT_MS = 1800;

/** 窗口内的状态行：几秒后自动淡出，不长期占地方。 */
let flashTimer = 0;

function flashText(msg, tone) {
  const el = document.getElementById("win-flash");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "win-flash" + (msg ? " on" + (tone ? " " + String(tone).toLowerCase() : "") : "");
  if (flashTimer) clearTimeout(flashTimer);
  if (msg) {
    flashTimer = setTimeout(function () {
      flashTimer = 0;
      el.className = "win-flash";
      el.textContent = "";
    }, 7000);
  }
}

/**
 * 统一反馈：通知中心一条 + 窗口内状态行一条。
 * 所有按钮回调都应该走这里（成功 SUCCESS / 失败 ERROR / 提醒 WARNING / 普通 INFO），
 * 这样就不会再出现「点了一下什么都没有」。
 */
export function feedback(msg, tone) {
  if (!msg) return;
  flashText(msg, tone);
  notify(msg, tone || "INFO");
}

/** 标题栏上的按钮 / 输入框不触发拖动。 */
function draggableTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return !target.closest("button, a, input, select, textarea, label, [contenteditable='true'], .sp");
}

/**
 * 创建窗口外壳。
 * opts = { name, head?, text?, retry?, onStatus? }
 *   name   窗口名（initiative / dice / panel）—— 后台按它记位置
 *   head   拖动区元素（默认 #head）
 *   text   状态文字元素（默认 #bg-text）
 *   retry  重试按钮（默认 #bg-retry）
 *   onStatus(state, detail) 状态变化回调（页面可以据此重画）
 */
export function createWindow(opts) {
  opts = opts || {};
  const name = String(opts.name || "");
  const headEl = opts.head !== undefined ? opts.head : document.getElementById("head");
  const textEl = opts.text || document.getElementById("bg-text");
  const retryEl = opts.retry || document.getElementById("bg-retry");
  /* v1.7.6：整条状态条（.bg-strip）。没有异常时**整条隐藏**（用户：正常时那行
   * 「后台已连接 v1.7.5 · 工具栏✓ · 右键菜单✓」删掉，只留功能本身；错误提示必须保留）。 */
  const stripEl = opts.strip || document.getElementById("bg-strip");

  let state = BG_CHECKING;
  let detail = {};
  let seq = 0;
  const listeners = [];
  if (typeof opts.onStatus === "function") listeners.push(opts.onStatus);

  function markElement(el, off) {
    const isButton = el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
    if (off) {
      if (isButton) {
        /* 记住页面自己设的 disabled（比如「没选中 token 时绑定按钮不可点」），恢复时原样还回去 */
        if (el.dataset.bgWasDisabled === undefined) el.dataset.bgWasDisabled = el.disabled ? "1" : "0";
        el.disabled = true;
      } else {
        el.setAttribute("aria-disabled", "true");
      }
      el.classList.add("bg-off");
    } else {
      if (isButton) {
        el.disabled = el.dataset.bgWasDisabled === "1";
        delete el.dataset.bgWasDisabled;
      } else {
        el.removeAttribute("aria-disabled");
      }
      el.classList.remove("bg-off");
    }
  }

  function paint() {
    const bad = state === BG_BAD;
    try { document.body.classList.toggle("bg-off", bad); } catch (e) { /* 忽略 */ }
    const hard = document.querySelectorAll("[data-bg]");
    for (let i = 0; i < hard.length; i++) markElement(hard[i], bad);
    const soft = document.querySelectorAll("[data-bg-soft]");
    for (let i = 0; i < soft.length; i++) soft[i].classList.toggle("bg-soft-off", bad);
    if (retryEl) {
      retryEl.hidden = !bad;
      retryEl.textContent = "后台未连接，点这里重试";
    }
    /* v1.7.6：正常（ok）/ 检测中（checking）→ 状态条整条不显示、不留任何「已连接」小字；
     * 只有异常（bad）才出现，并且照旧带一句「哪个功能不会生效」。 */
    if (stripEl) stripEl.hidden = !bad;
    if (textEl) {
      if (state === BG_BAD) {
        textEl.textContent = "后台未连接：右键「加入先攻」、玩家「结束我的回合」都不会生效。";
        textEl.className = "bg-text bad";
      } else {
        textEl.textContent = "";
        textEl.className = "bg-text";
      }
    }
    for (const cb of listeners) {
      try { cb(state, detail); } catch (e) { console.error("[4enext] onStatus 回调失败", e); }
    }
  }

  function setState(next, payload) {
    state = next;
    detail = payload && payload.data !== undefined ? payload.data : (payload || {});
    paint();
  }

  /** 问后台「在吗」；最多问 3 次（后台要到 boot 最后一步才订阅 ping）。 */
  async function check(withFeedback) {
    const mySeq = ++seq;
    let res = null;
    for (let attempt = 0; attempt <= PING_RETRY; attempt++) {
      if (attempt > 0) await new Promise(function (r) { setTimeout(r, PING_RETRY_DELAY_MS); });
      try { res = await pingBackground(PING_TIMEOUT_MS); } catch (e) { res = null; }
      if (seq !== mySeq) return state; /* 又发起了新一轮 */
      if (res) break;
    }
    if (res) {
      setState(BG_OK, res);
      /* 只有用户「点重试」才回一句结果；不带版本号 / 工具栏打勾那一串（v1.7.6 删小字）。 */
      if (withFeedback) feedback("后台已恢复：可以继续操作了", "SUCCESS");
      return state;
    }
    setState(BG_BAD, {});
    if (withFeedback) feedback("后台还是没有响应：把扩展关掉再打开一次；仍然不行就打开插件根目录的 background.html 看自检日志", "ERROR");
    return state;
  }

  function markOk(payload) {
    /* 收到 diag-hello 就等于确认后台活着（不必再等 ping 的结果） */
    setState(BG_OK, payload);
  }

  /** 硬依赖后台的操作入口：离线时直接给出说明，不让点击变成「没反应」。 */
  function guard(label, fn) {
    if (state === BG_BAD) {
      feedback("后台未连接：先点顶部的「后台未连接，点这里重试」，再点一次（" + (label || "这个操作") + "要靠后台脚本）", "WARNING");
      return false;
    }
    try {
      const r = fn();
      if (r && typeof r.catch === "function") r.catch(function (e) { feedback("操作失败：" + (e && e.message ? e.message : e), "ERROR"); });
    } catch (e) {
      feedback("操作失败：" + (e && e.message ? e.message : e), "ERROR");
    }
    return true;
  }

  /* ---------------- 标题栏拖动 ---------------- */
  let drag = null;
  function send(phase, dx, dy) {
    try {
      const p = OBR.broadcast.sendMessage(
        CH_WIN_DRAG,
        { win: name, phase: phase, dx: dx, dy: dy, at: Date.now() },
        { destination: "LOCAL" }
      );
      if (p && typeof p.catch === "function") p.catch(function () { /* 后台没起来就算了 */ });
    } catch (e) { /* 不在枭熊里、直接打开本页时会走到这 */ }
  }

  function endDrag() {
    if (!drag) return;
    if (drag.timer) { clearTimeout(drag.timer); drag.timer = 0; }
    send("end", Math.round(drag.dx), Math.round(drag.dy));
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
      send("start", 0, 0);
    });
    window.addEventListener("pointermove", function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      drag.dx = ev.screenX - drag.x0;
      drag.dy = ev.screenY - drag.y0;
      if (drag.timer) return; /* 节流：一个间隔最多发一次，发的永远是最新位移 */
      drag.timer = setTimeout(function () {
        drag.timer = 0;
        if (!drag) return;
        send("move", Math.round(drag.dx), Math.round(drag.dy));
      }, WIN_DRAG_THROTTLE_MS);
    });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    document.addEventListener("pointerleave", endDrag);

    const pinEl = document.getElementById("pin");
    if (pinEl) {
      pinEl.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        send("reset", 0, 0);
        feedback("窗口已回到默认位置", "INFO");
      });
    }
  }

  if (retryEl) {
    retryEl.addEventListener("click", function (ev) {
      ev.preventDefault();
      setState(BG_CHECKING, {});
      void check(true);
    });
  }

  onReady(function () {
    try {
      OBR.broadcast.onMessage(CH_HELLO, markOk);
    } catch (e) { /* 忽略 */ }
    void check(false);
  });

  return {
    name: name,
    /** 当前状态：checking / ok / bad */
    get state() { return state; },
    isOnline: function () { return state === BG_OK; },
    /** 页面重新渲染了按钮之后，把当前的「离线置灰」再套一遍（新节点不会自动继承）。 */
    refreshGates: paint,
    check: check,
    markOk: markOk,
    guard: guard,
    /** 状态变化回调（返回取消函数） */
    onStatus: function (cb) {
      if (typeof cb !== "function") return function () {};
      listeners.push(cb);
      try { cb(state, detail); } catch (e) { /* 忽略 */ }
      return function () {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  };
}

/** 关闭本窗口（popover 页：能关就关，关不掉就忽略）。 */
export function closeSelf(popoverId) {
  try {
    const p = OBR.popover.close(popoverId);
    if (p && typeof p.catch === "function") p.catch(function () { /* 不是 popover 时忽略 */ });
  } catch (e) { /* 忽略 */ }
}
