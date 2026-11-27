// v1.3.2：设置 / 关于窗口的页面脚本（settings.html）。
// v1.7.0：新增「骰子」一栏——只有**一个开关**（投骰动画 开 / 关）。
// v1.7.3：新增「先攻」一栏——**进入房间自动显示先攻条** 开 / 关（写 common.js 的 LS_STRIP_AUTOSTART，
//   默认开）。读写同样全部走 common.js 的 readStripAutostart / writeStripAutostart，
//   这一页仍然不直接碰 localStorage（dev/check.mjs 会断言）。
//   读写都走 common.js 的 readDiceAnim / writeDiceAnim：这一页**仍然不直接写 localStorage**
//   （dev/check.mjs 断言这一页不直接写本机存储、也不碰房间数据 / token 元数据），
//   所以「重置本机设置」也不可能顺手改掉别的东西。
// ---------------------------------------------------------------------------
// 这个窗口只做两件事：
//   1) 展示静态说明（关于 / 使用说明 / 数据与权限 / 致谢）—— 内容写死在 HTML 里，
//      版本号从 common.js 的 PLUGIN_VERSION 取（HTML 里不写死版本），不做多语言；
//   2) 「重置本机设置」—— 只清**本机 localStorage** 里约定的那几组键：
//        · 4enext/win-pos      独立窗口位置
//        · 4enext/info-pos     速览小窗按 token 记的位置
//        · 4enext/state/*      追踪降级数据（房间数据写不进去时的本机副本）
//      **不碰房间数据、不碰 token 元数据、不碰角色卡**：
//      这一页里没有任何写房间 / 写 token 的调用（自测 dev/check.mjs 会断言这一点），
//      所以「重置」不可能误删全桌共享的东西。
// 窗口壳（拖动 / 位置记忆 / 后台在线检测 / 统一 feedback）与先攻、骰子共用 window.js。
import {
  ID_SETTINGS_WIN, PLUGIN_VERSION, onReady, readDiceAnim, readDiceHistAutostart, readStripAutostart,
  writeDiceAnim, writeDiceHistAutostart, writeStripAutostart,
  getRoomUsage, clearRoomRolls, clearRoomCards, readDiceSpeedPref, cycleDiceSpeedPref, readDiceAutoOpenPref, setDiceAutoOpenPref
} from "./common.js";
import { createWindow, feedback, closeSelf } from "./window.js";

/** 构建日期：改后台脚本 / 重新生成 bundle 时一起改，只用于「关于」里的展示。 */
const BUILD_DATE = "2026-11-15";

/* 重置范围：白名单。除了这里列出来的，别的键一律不动（尤其不碰房间数据 / token 元数据）。 */
const RESET_KEYS = ["4enext/win-pos", "4enext/info-pos"];
const RESET_PREFIX = "4enext/state/";
const RESET_PREFIXES = [RESET_PREFIX, "4enext/win-size/"];
/** 二次确认的有效期：第一次点击后这么久内没有再点，就自动回到普通状态。 */
const CONFIRM_MS = 5000;

const win = createWindow({ name: "settings" }); /* v2.4.35：窗口壳最先初始化，后续 init 抛错也能关窗 */
function safeInit(name, fn) {
  try { fn(); } catch (e) { console.error("[4enext][settings] init " + name + " 失败", e); }
}

function msgOf(e) {
  return e && e.message ? e.message : String(e);
}

/* ---------------- 版本 / 构建（都取自 common.js，不写死） ---------------- */
const verEl = document.getElementById("set-version");
if (verEl) verEl.textContent = "v" + PLUGIN_VERSION;

const buildEl = document.getElementById("set-build");
if (buildEl) {
  buildEl.textContent = BUILD_DATE + "（assets/background.bundle.js 由 node dev/build-background.mjs 生成）";
}

/* ---------------- 左侧分栏 ---------------- */
const navEl = document.getElementById("set-nav");
const mainEl = document.getElementById("set-main");
const tabs = navEl ? Array.prototype.slice.call(navEl.querySelectorAll(".set-tab")) : [];
const panes = mainEl ? Array.prototype.slice.call(mainEl.querySelectorAll(".set-pane")) : [];

function paneExists(name) {
  if (!name) return false;
  return tabs.some(function (t) { return t.getAttribute("data-pane") === name; });
}

/** 切到某一栏：nav 高亮 + pane 显隐 + 内容回到顶部。 */
function showPane(name) {
  if (!paneExists(name)) return false;
  for (const t of tabs) {
    const on = t.getAttribute("data-pane") === name;
    t.classList.toggle("on", on);
    if (on) t.setAttribute("aria-current", "true");
    else t.removeAttribute("aria-current");
  }
  for (const p of panes) p.classList.toggle("on", p.id === "pane-" + name);
  if (mainEl) mainEl.scrollTop = 0;
  return true;
}

if (navEl) {
  navEl.addEventListener("click", function (ev) {
    const btn = ev.target && ev.target.closest ? ev.target.closest(".set-tab") : null;
    if (!btn) return;
    const name = btn.getAttribute("data-pane");
    if (showPane(name)) {
      /* 分享 / 回看时可以直接 settings.html#data 定位到某一栏 */
      try { history.replaceState(null, "", "#" + name); } catch (e) { /* 忽略 */ }
    }
  });
}

/* 允许 settings.html#data 这样的直接定位（也允许 #pane-data 这种写法）。 */
(function openFromHash() {
  let hash = "";
  try { hash = String(location.hash || "").replace(/^#/, ""); } catch (e) { hash = ""; }
  if (!hash) return;
  const name = hash.indexOf("pane-") === 0 ? hash.slice(5) : hash;
  if (!showPane(name)) showPane("about");
})();

/* ---------------- 骰子：投骰动画开关（v1.7.0） ----------------
 * 只改一个本机开关；骰子窗口每次投掷前都会重新读它，所以这里点完立刻生效。 */
const animToggle = document.getElementById("anim-toggle");
const animState = document.getElementById("anim-state");

function paintAnim() {
  const on = readDiceAnim();
  if (animState) animState.textContent = on ? "投骰动画：开" : "投骰动画：关";
  if (animToggle) {
    animToggle.textContent = on ? "关闭投骰动画" : "打开投骰动画";
    animToggle.classList.toggle("on", on);
  }
}

if (animToggle) {
  animToggle.addEventListener("click", function () {
    const next = !readDiceAnim();
    const saved = writeDiceAnim(next);
    paintAnim();
    if (!saved) {
      feedback("这台机器存不下这个设置（隐私模式 / 存储被禁用？），本次仍按原设置", "WARNING");
      return;
    }
    /* v1.7.8：不再弹「投骰动画已打开 / 已关闭」（这一行的开关状态当场就变了）。 */
  });
}

/* ---------------- 先攻：进入房间自动显示先攻条（v1.7.3） ----------------
 * 只改一个本机开关；后台在 scene ready / onReadyChange 时重新读它，所以这里点完下次进房间生效。 */
const stripToggle = document.getElementById("strip-auto-toggle");
const stripState = document.getElementById("strip-auto-state");

function paintStripAuto() {
  const on = readStripAutostart();
  if (stripState) stripState.textContent = on ? "进入房间自动显示：开" : "进入房间自动显示：关";
  if (stripToggle) {
    stripToggle.textContent = on ? "关闭自动显示先攻条" : "打开自动显示先攻条";
    stripToggle.classList.toggle("on", on);
  }
}

if (stripToggle) {
  stripToggle.addEventListener("click", function () {
    const next = !readStripAutostart();
    const saved = writeStripAutostart(next);
    paintStripAuto();
    if (!saved) {
      feedback("这台机器存不下这个设置（隐私模式 / 存储被禁用？），本次仍按原设置", "WARNING");
      return;
    }
    /* v1.7.8：不再弹「进入房间会自动显示先攻条…」（这一行的开关状态当场就变了）。 */
  });
}

/* ---------------- v1.9.2：骰子记录窗口进入房间自动打开（默认开，本机开关） ---------------- */
const diceHistToggle = document.getElementById("dice-hist-auto-toggle");
const diceHistState = document.getElementById("dice-hist-auto-state");

function paintDiceHistAuto() {
  const on = readDiceHistAutostart();
  if (diceHistState) diceHistState.textContent = on ? "进入房间自动打开：开" : "进入房间自动打开：关";
  if (diceHistToggle) {
    diceHistToggle.textContent = on ? "关闭自动打开记录窗口" : "打开自动打开记录窗口";
    diceHistToggle.classList.toggle("on", on);
  }
}

if (diceHistToggle) {
  diceHistToggle.addEventListener("click", function () {
    const next = !readDiceHistAutostart();
    const saved = writeDiceHistAutostart(next);
    paintDiceHistAuto();
    if (!saved) {
      feedback("这台机器存不下这个设置（隐私模式 / 存储被禁用？），本次仍按原设置", "WARNING");
    }
  });
}

/* ---------------- v1.7.15：清理房间数据 ----------------
 * 房间数据（room metadata）有 16 KB 上限，超了之后**所有**写入都会被拒（加入先攻 / 改加值 /
 * 回合推进 / 骰子历史 / 资源追踪），而且真机上以前是静默失败。这一栏给用户两个「一键瘦身」按钮：
 *   ① 清理骰子历史（v1.9.2 起历史在本机：清本机 + GM 顺带清房间旧残留）
 *   ② 清空角色卡（v1.8.0：房间装不下时先改存本场景的隐藏 item，再兜底本机）
 * 这一页仍然**不直接**写房间数据 / token 元数据：读写全部走 common.js 的
 * getRoomUsage / clearRoomRolls / clearRoomCards（dev/check.mjs 断言这一点没变）。 */
const roomUsageEl = document.getElementById("room-usage");
const roomCardsEl = document.getElementById("room-cards");
const roomRollsEl = document.getElementById("room-rolls");
const roomInitEl = document.getElementById("room-init");
const roomOtherEl = document.getElementById("room-other");
const roomTopEl = document.getElementById("room-top");
const roomSourcesEl = document.getElementById("room-sources");
const roomRefreshBtn = document.getElementById("room-refresh");
const roomCleanRollsBtn = document.getElementById("room-clean-rolls");
const roomCleanCardsBtn = document.getElementById("room-clean-cards");
const roomOutEl = document.getElementById("room-clean-out");

const kb = function (n) {
  return (n / 1024).toFixed(1) + " KB";
};

async function renderRoom() {
  if (!roomUsageEl) return;
  let info = null;
  try {
    info = await getRoomUsage();
  } catch (e) {
    roomUsageEl.textContent = "读不到房间数据：" + msgOf(e);
    return;
  }
  const pct = info.max > 0 ? Math.round((info.bytes / info.max) * 100) : 0;
  roomUsageEl.textContent = kb(info.bytes) + " / " + kb(info.max) + "（" + pct + "%）" +
    (info.bytes > info.max ? " · 已超预算，先攻 / 骰子会被拒绝写入"
      : info.bytes > 14 * 1024 ? " · 接近上限（其它插件也占房间数据）" : "");
  if (roomOtherEl) roomOtherEl.textContent = kb(info.otherBytes || 0);
  if (roomSourcesEl) {
    const src = info.sources || {};
    const label = (v) => v === "scene" ? "场景" : v === "local" ? "本机" : v === "room" ? "房间" : "—";
    roomSourcesEl.textContent = "卡 " + label(src.cards) + " · 先攻 " + label(src.initiative) +
      " · 骰子 " + label(src.rolls) + " · 状态 " + label(src.state);
  }
  if (roomTopEl) {
    const top = Array.isArray(info.top) ? info.top : [];
    roomTopEl.textContent = top.length
      ? top.map((r, i) => (i + 1) + ". " + r.key + " " + kb(r.bytes)).join("\n")
      : "—";
  }
  if (roomCardsEl) {
    /* v1.8.0 三态：room = 房间数据（全桌共享）；scene = 房间装不下后改存当前场景的隐藏 item
     * （同样全桌可见、切场景不跟随）；local = 场景也写不进时的本机兜底。 */
    const scopeText = info.cardScope === "scene" ? "本场景"
      : info.cardScope === "local" ? "本机" : "全桌（房间）";
    roomCardsEl.textContent = info.cards + " 张（" + scopeText + "）";
  }
  if (roomRollsEl) roomRollsEl.textContent = info.rows + " 条";
  if (roomInitEl) roomInitEl.textContent = info.entries + " 条";
}

/* v2.4.35：骰子动画速度（标准/快速/关闭），effect-page 读取同一个 localStorage。 */
const diceSpeedBtn = document.getElementById("set-dice-speed");
const diceAutoBtn = document.getElementById("set-dice-auto");
safeInit("diceSpeed", function initDiceSpeed() {
  if (!diceSpeedBtn) return;
  const read = readDiceSpeedPref;
  const paint = () => { const v = read(); diceSpeedBtn.textContent = "动画速度：" + (v === "fast" ? "快速" : v === "off" ? "关闭" : "标准"); };
  paint();
  diceSpeedBtn.addEventListener("click", function () {
    const next = cycleDiceSpeedPref();
    paint();
  });
});

/* v2.4.35：进入房间自动打开骰子（每客户端）。 */
safeInit("diceAuto", function () {
  if (!diceAutoBtn) return;
  const paint = () => { diceAutoBtn.textContent = "进入房间自动打开骰子：" + (readDiceAutoOpenPref() ? "开" : "关"); };
  paint();
  diceAutoBtn.addEventListener("click", function () {
    setDiceAutoOpenPref(!readDiceAutoOpenPref());
    paint();
  });
});

/* 两个清理按钮各自独立二次确认（与「重置本机设置」同一套：第一次只预备，5 秒后自动取消）。 */
function makeCleaner(btn, label, run) {
  if (!btn) return;
  let armed = false;
  let timer = 0;
  const reset = function () {
    armed = false;
    if (timer) { clearTimeout(timer); timer = 0; }
    btn.textContent = label;
    btn.classList.remove("armed");
  };
  btn.addEventListener("click", async function () {
    if (!armed) {
      armed = true;
      btn.textContent = "再点一次确认" + label;
      btn.classList.add("armed");
      if (roomOutEl) roomOutEl.textContent = "";
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, CONFIRM_MS);
      feedback(label + "：再点一次按钮确认", "WARNING");
      return;
    }
    reset();
    let res = null;
    try {
      res = await run();
    } catch (e) {
      if (roomOutEl) roomOutEl.textContent = label + "失败：" + msgOf(e);
      feedback(label + "失败：" + msgOf(e), "ERROR");
      return;
    }
    if (!res || !res.ok) {
      /* clearRoom* 自己已经弹了 ERROR；这里只补窗口内那一行。 */
      if (roomOutEl) roomOutEl.textContent = label + "失败：房间数据只有城主能改（详见通知）";
      return;
    }
    if (roomOutEl) roomOutEl.textContent = label + "完成。";
    await renderRoom();
  });
}

makeCleaner(roomCleanRollsBtn, "清理骰子历史", clearRoomRolls);
makeCleaner(roomCleanCardsBtn, "清空角色卡", clearRoomCards);
if (roomRefreshBtn) {
  roomRefreshBtn.addEventListener("click", function () {
    if (roomOutEl) roomOutEl.textContent = "";
    void renderRoom();
  });
}

/* ---------------- 重置本机设置 ---------------- */
const stateEl = document.getElementById("set-local-state");
const resetBtn = document.getElementById("reset-btn");
const outEl = document.getElementById("reset-out");

/** 扫一遍本机：返回 { keys, state, err }，只读，不改任何东西。 */
function scanLocal() {
  const found = [];
  let stateCount = 0;
  try {
    for (const key of RESET_KEYS) {
      if (localStorage.getItem(key) !== null) found.push(key);
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && RESET_PREFIXES.some(function (pre) { return key.indexOf(pre) === 0; })) { found.push(key); stateCount++; }
    }
  } catch (e) {
    return { keys: found, state: stateCount, err: e };
  }
  return { keys: found, state: stateCount };
}

function renderLocal() {
  if (!stateEl) return;
  const info = scanLocal();
  if (info.err) {
    stateEl.textContent = "读不到本机数据（隐私模式 / 存储被禁用？）：" + msgOf(info.err);
    return;
  }
  if (!info.keys.length) {
    stateEl.textContent = "本机现在是干净的：没有窗口位置记忆，也没有追踪降级数据。";
    return;
  }
  const parts = [];
  if (info.keys.indexOf(RESET_KEYS[0]) >= 0) parts.push("窗口位置 1 份");
  if (info.keys.indexOf(RESET_KEYS[1]) >= 0) parts.push("速览位置 1 份");
  if (info.state) parts.push("追踪降级数据 " + info.state + " 份");
  stateEl.textContent = "本机现在有：" + parts.join(" · ") + "（共 " + info.keys.length + " 条，点下面的按钮可以清掉）。";
}

/** 真的清：只删白名单里的键。返回 { keys, err }。 */
function clearLocal() {
  const removed = [];
  try {
    for (const key of RESET_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removed.push(key);
      }
    }
    /* 先把要删的键收集起来再删：边遍历边删会漏掉后面的键。 */
    const stateKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && RESET_PREFIXES.some(function (pre) { return key.indexOf(pre) === 0; })) stateKeys.push(key);
    }
    for (const key of stateKeys) {
      localStorage.removeItem(key);
      removed.push(key);
    }
  } catch (e) {
    return { keys: removed, err: e };
  }
  return { keys: removed };
}

let armed = false;
let armTimer = 0;

function disarm() {
  armed = false;
  if (armTimer) { clearTimeout(armTimer); armTimer = 0; }
  if (resetBtn) {
    resetBtn.textContent = "重置本机设置";
    resetBtn.classList.remove("armed");
  }
}

if (resetBtn) {
  resetBtn.addEventListener("click", function () {
    /* 第一次点击只是「预备」：这个操作会改本机数据，不能一点就清。 */
    if (!armed) {
      armed = true;
      resetBtn.textContent = "再点一次确认重置";
      resetBtn.classList.add("armed");
      if (outEl) outEl.textContent = "";
      if (armTimer) clearTimeout(armTimer);
      armTimer = setTimeout(function () {
        armTimer = 0;
        disarm();
        /* v1.7.8：5 秒自动取消不再弹（按钮文字自己变回去）。 */
      }, CONFIRM_MS);
      feedback("重置本机设置：再点一次按钮确认（只清本机的窗口位置与追踪降级数据）", "WARNING");
      return;
    }

    const res = clearLocal();
    disarm();
    if (res.err) {
      if (outEl) outEl.textContent = "重置失败：" + msgOf(res.err);
      feedback("重置本机设置失败：" + msgOf(res.err), "ERROR");
      return;
    }
    if (!res.keys.length) {
      /* v1.7.8：结果只写窗口内这一行（成功类通知不再弹）。 */
      if (outEl) outEl.textContent = "本机本来就没有可清的数据（什么都没改）。";
    } else {
      if (outEl) outEl.textContent = "已清掉 " + res.keys.length + " 条：" + res.keys.join("、");
    }
    renderLocal();
  });
}

const closeEl = document.getElementById("close");
/* v1.7.10：✕ = OBR.popover.close(本窗 id) + 后台 {op:"close-win"} 双保险。 */
if (closeEl) closeEl.addEventListener("click", function () { closeSelf(ID_SETTINGS_WIN, "settings"); });

onReady(function () {
  renderLocal();
  paintAnim();
  paintStripAuto();
  paintDiceHistAuto();
  void renderRoom();
  /* 后台很慢时先把窗口状态画一次（状态条本身由 window.js 画） */
  win.onStatus(function () { /* 这里只留挂点 */ });
});
