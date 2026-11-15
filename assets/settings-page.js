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
//   1) 展示静态说明（关于 / 使用说明 / 数据与权限 / 已知限制 / 致谢）—— 内容写死在 HTML 里，
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
  ID_SETTINGS_WIN, PLUGIN_VERSION, onReady, readDiceAnim, readStripAutostart, writeDiceAnim, writeStripAutostart
} from "./common.js";
import { createWindow, feedback, closeSelf } from "./window.js";

/** 构建日期：改后台脚本 / 重新生成 bundle 时一起改，只用于「关于」里的展示。 */
const BUILD_DATE = "2026-11-15";

/* 重置范围：白名单。除了这里列出来的，别的键一律不动（尤其不碰房间数据 / token 元数据）。 */
const RESET_KEYS = ["4enext/win-pos", "4enext/info-pos"];
const RESET_PREFIX = "4enext/state/";
/** 二次确认的有效期：第一次点击后这么久内没有再点，就自动回到普通状态。 */
const CONFIRM_MS = 5000;

const win = createWindow({ name: "settings" });

function msgOf(e) {
  return e && e.message ? e.message : String(e);
}

/* ---------------- 版本 / 构建（都取自 common.js，不写死） ---------------- */
const verEl = document.getElementById("set-version");
if (verEl) verEl.textContent = "v" + PLUGIN_VERSION;

const headSubEl = document.getElementById("set-head-sub");
if (headSubEl) headSubEl.textContent = "v" + PLUGIN_VERSION + " · 独立窗口 · 可拖动";

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
    feedback(next ? "投骰动画已打开" : "投骰动画已关闭（结果照常显示在骰子窗口里）", "SUCCESS");
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
    feedback(next ? "进入房间会自动显示先攻条（下次进房间 / 刷新后生效）" : "进入房间不再自动显示先攻条（工具栏「先攻」仍可打开）", "SUCCESS");
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
      if (key && key.indexOf(RESET_PREFIX) === 0) { found.push(key); stateCount++; }
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
      if (key && key.indexOf(RESET_PREFIX) === 0) stateKeys.push(key);
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
        feedback("重置已取消（5 秒内没有再次确认）", "INFO");
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
      if (outEl) outEl.textContent = "本机本来就没有可清的数据（什么都没改）。";
      feedback("重置本机设置：本机本来就没有可清的数据", "INFO");
    } else {
      if (outEl) outEl.textContent = "已清掉 " + res.keys.length + " 条：" + res.keys.join("、");
      feedback("已重置本机设置（清掉 " + res.keys.length + " 条本机记录；房间数据与 token 数据未动）", "SUCCESS");
    }
    renderLocal();
  });
}

const closeEl = document.getElementById("close");
if (closeEl) closeEl.addEventListener("click", function () { closeSelf(ID_SETTINGS_WIN); });

onReady(function () {
  renderLocal();
  paintAnim();
  paintStripAuto();
  /* 后台很慢时先把窗口状态画一次（状态条本身由 window.js 画） */
  win.onStatus(function () { /* 这里只留挂点 */ });
});
