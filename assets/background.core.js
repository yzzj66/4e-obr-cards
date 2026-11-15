/* 4E NEXT 角色卡 · 后台逻辑（单文件「经典脚本」，没有任何 import / export）
 * ---------------------------------------------------------------------------
 * 这个文件不直接给浏览器加载：dev/build-background.mjs 会把它和
 * vendor/obr-sdk.js（去掉末尾 export{}）拼成 assets/background.bundle.js，
 * background.html 只加载那一个 <script src>（不带 type="module"）。
 *
 * 约定：外层作用域已经提供了 OBR（@owlbear-rodeo/sdk 的 default export）。
 *
 * 三个入口（任何一个活着就能打开面板）：
 *   1) manifest.action  → 房间左上角的扩展图标（由 manifest 提供，不依赖本文件）
 *   2) OBR.tool.create   → 左侧工具栏里的 4E 工具按钮
 *   3) OBR.popover.open  → 右下角浮动 4E 按钮（与参考实现 character-cards 相同写法）
 * 外加：右键 IMAGE token 的「绑定 4E NEXT 角色卡」（仅 GM）。
 *
 * 自诊断：每一步失败都 OBR.notification.show(..., "ERROR")，成功则在启动后汇总一条
 *        INFO 通知（可用 localStorage["4enext/diag"]="0" 关掉）。
 *        另外 background.html 里有一块页面内日志，直接打开 background.html 也能看到。
 * ------------------------------------------------------------------------- */

var NS = "com.4enext-owlbear";
var KEY_CARDS = NS + "/cards";
var KEY_BIND = NS + "/cardId";
var ID_BUTTON = NS + "/button";
var ID_INFO = NS + "/info";
var ID_PANEL = NS + "/panel";
var ID_BIND = NS + "/bind";
var TOOL_ID = NS + "/panel-tool";
var CH_HELLO = NS + "/diag-hello"; /* background → 各页面：我起来了 */
var CH_PING = NS + "/diag-ping";   /* 页面 → background：在吗 */
var CH_PONG = NS + "/diag-pong";   /* background → 页面：在，状态如下 */
var PLUGIN_VERSION = "1.1.0";

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;
var INFO_W = 380;
var INFO_H = 470;

/* ---------------------------------------------------------------------------
 * 0) 站点根地址
 *    参考实现（character-cards/src/background.ts 第 7~11 行）把 panel/info/bind
 *    的网址写成了绝对地址，而不是从 import.meta.url 推算。这里同样不依赖
 *    import.meta.url（它在 OBR 的 iframe 里未必是页面地址），改用背景页自己的
 *    location —— background.html 永远在插件根目录。
 * ------------------------------------------------------------------------- */
var BASE = (function () {
  try {
    var u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u.href;
  } catch (e) { /* 忽略 */ }
  try { return new URL("./", document.baseURI).href; } catch (e) { /* 忽略 */ }
  return "https://yzzj66.github.io/4e-obr-cards/";
})();

function pageUrl(name) { return BASE + name; }

var ICON_URL = pageUrl("icon.svg");
var TOOL_ICON_URL = pageUrl("icon-tool.svg");
var URL_PANEL = pageUrl("panel.html");
var URL_INFO = pageUrl("info.html");
var URL_BIND = pageUrl("bind.html");
var URL_BUTTON = pageUrl("button.html");

/* ---------------------------------------------------------------------------
 * 1) 自诊断小工具
 * ------------------------------------------------------------------------- */
function pageLog(kind, text) {
  var line = "[" + new Date().toISOString().slice(11, 19) + "] " + text;
  try {
    var box = document.getElementById("diag-log");
    if (box) {
      var li = document.createElement("li");
      li.className = "k-" + kind;
      li.textContent = line;
      box.appendChild(li);
    }
    var state = document.getElementById("diag-state");
    if (state) {
      if (kind === "err") {
        state.className = "bad";
        state.textContent = "最新错误：" + text;
      } else if (kind === "ok" && state.className !== "bad") {
        state.className = "good";
        state.textContent = "运行中：" + text;
      }
    }
  } catch (e) { /* 没有诊断 DOM 就算了 */ }
  try {
    if (kind === "err") console.error("[4enext]", line);
    else console.log("[4enext]", line);
  } catch (e) { /* 忽略 */ }
}

function diagNotifyEnabled() {
  try { return localStorage.getItem("4enext/diag") !== "0"; } catch (e) { return true; }
}

function notify(msg, variant) {
  try {
    return OBR.notification.show(msg, variant || "DEFAULT");
  } catch (e) {
    pageLog("err", "OBR.notification.show 失败：" + (e && e.message ? e.message : e));
    return null;
  }
}

function errText(e) {
  if (!e) return "未知错误";
  return e.message || e.reason || String(e);
}

/** 记录失败：页面日志 + ERROR 通知（不会重复弹同一条）。 */
var seenErrors = {};
function stepFail(where, e) {
  var msg = where + " —— " + errText(e);
  pageLog("err", msg);
  if (seenErrors[msg]) return;
  seenErrors[msg] = true;
  notify("4E插件出错：" + msg, "ERROR");
}

function stepOk(text) { pageLog("ok", text); }

/** 包一层 try/catch：同步版。返回 true/false。 */
function attempt(where, fn) {
  try {
    var r = fn();
    if (r && typeof r.then === "function") {
      return r.then(function () { stepOk(where + " ✓"); return true; }, function (e) { stepFail(where, e); return false; });
    }
    stepOk(where + " ✓");
    return Promise.resolve(true);
  } catch (e) {
    stepFail(where, e);
    return Promise.resolve(false);
  }
}

/* ---------------------------------------------------------------------------
 * 2) 打开面板（唯一真正的目标动作）
 *    失败时依次兜底：manifest action popover → 通知用户。
 * ------------------------------------------------------------------------- */
async function openPanel(where) {
  try {
    await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
    stepOk((where || "面板") + "：已打开");
    return true;
  } catch (e) {
    stepFail("打开角色卡面板（" + (where || "入口") + "）", e);
    try {
      await OBR.action.open();
      stepOk("面板打开失败，已改用左上角 action 弹窗");
      return true;
    } catch (e2) {
      stepFail("改用 action 弹窗也失败", e2);
      return false;
    }
  }
}

/* ---------------------------------------------------------------------------
 * 3) 入口 A：右下角浮动按钮（照抄 character-cards 的 openPopover）
 * ------------------------------------------------------------------------- */
var buttonOpen = false;
async function openButton() {
  var w = 0, h = 0;
  if (!OBR.viewport || typeof OBR.viewport.getWidth !== "function") {
    throw new Error("SDK 没有 OBR.viewport.getWidth（SDK 版本不匹配？）");
  }
  w = await OBR.viewport.getWidth();
  h = await OBR.viewport.getHeight();
  await OBR.popover.open({
    id: ID_BUTTON,
    url: URL_BUTTON,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    anchorReference: "POSITION",
    anchorPosition: { left: w - RIGHT_OFFSET, top: h - BOTTOM_OFFSET },
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    hidePaper: true,
    disableClickAway: true
  });
  buttonOpen = true;
}

async function closeButton() {
  try { await OBR.popover.close(ID_BUTTON); } catch (e) { /* 没开就算了 */ }
  buttonOpen = false;
}

/* ---------------------------------------------------------------------------
 * 4) 入口 B：左侧工具栏（OBR.tool.create，第三种入口，不依赖 popover）
 * ------------------------------------------------------------------------- */
async function registerTool() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") {
    throw new Error("SDK 没有 OBR.tool.create");
  }
  var def = {
    id: TOOL_ID,
    icons: [{ icon: TOOL_ICON_URL, label: "4E NEXT 角色卡：打开面板" }],
    /* 返回 false = 不切换成激活状态，只执行我们的回调 */
    onClick: function () {
      void openPanel("工具栏按钮");
      return false;
    }
  };
  try {
    await OBR.tool.create(def);
  } catch (e) {
    // 后台被重新加载过（同 id 还在）时先删再建，避免把"重复注册"误报成错误
    await OBR.tool.remove(TOOL_ID);
    await OBR.tool.create(def);
  }
}

/* ---------------------------------------------------------------------------
 * 5) 右键菜单：GM + 单个 IMAGE token（与参考实现 background.ts 第 231~258 行一致）
 * ------------------------------------------------------------------------- */
async function registerContextMenu() {
  if (!OBR.contextMenu || typeof OBR.contextMenu.create !== "function") {
    throw new Error("SDK 没有 OBR.contextMenu.create");
  }
  var def = {
    id: NS + "/bind-menu",
    icons: [{
      icon: ICON_URL,
      label: "绑定 4E NEXT 角色卡",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: async function (context) {
      var id = context && context.items && context.items[0] ? context.items[0].id : "";
      if (!id) {
        notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
        return;
      }
      try {
        await OBR.modal.open({
          id: ID_BIND,
          url: URL_BIND + "?item=" + encodeURIComponent(id),
          width: 440,
          height: 600
        });
        stepOk("绑定弹窗已打开");
      } catch (e) {
        stepFail("打开绑定弹窗", e);
      }
    }
  };
  try {
    await OBR.contextMenu.create(def);
  } catch (e) {
    // 同上：后台重载后同 id 可能还在，先删再建
    await OBR.contextMenu.remove(def.id);
    await OBR.contextMenu.create(def);
  }
}

/* ---------------------------------------------------------------------------
 * 6) 速览弹窗（选中绑定的 token 就弹）
 * ------------------------------------------------------------------------- */
var infoOpen = false;
var infoItemId = null;
var infoCardId = null;

async function getCards() {
  try {
    var meta = await OBR.room.getMetadata();
    var box = meta[KEY_CARDS];
    if (box && Array.isArray(box.cards)) return box.cards;
  } catch (e) {
    pageLog("err", "读取房间数据失败：" + errText(e));
  }
  return [];
}

function findCard(cards, id) {
  if (!id) return null;
  for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
  return null;
}

async function anchorOf(itemId) {
  try {
    var bounds = await OBR.scene.items.getItemBounds([itemId]);
    var scale = await OBR.viewport.getScale();
    var p = await OBR.viewport.transformPoint(bounds.center);
    return { left: p.x, top: Math.max(8, p.y - (bounds.height * scale) / 2 - 8) };
  } catch (e) {
    return null;
  }
}

async function openInfo(itemId, cardId) {
  var params = "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId);
  var anchor = await anchorOf(itemId);
  var vh = 0;
  try { vh = await OBR.viewport.getHeight(); } catch (e) { vh = 0; }
  var opts = {
    id: ID_INFO,
    url: URL_INFO + params,
    width: INFO_W,
    height: Math.min(INFO_H, Math.max(260, (vh || INFO_H + 40) - 40)),
    anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
    hidePaper: true,
    disableClickAway: true
  };
  if (anchor) {
    opts.anchorReference = "POSITION";
    opts.anchorPosition = anchor;
  } else {
    opts.anchorReference = "ELEMENT";
    opts.anchorElementId = itemId;
  }
  await OBR.popover.open(opts);
  infoOpen = true;
  infoItemId = itemId;
  infoCardId = cardId;
}

async function closeInfo() {
  if (!infoOpen) return;
  try { await OBR.popover.close(ID_INFO); } catch (e) { /* 已关闭 */ }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
}

var infoErrorShown = false;
async function refreshInfo() {
  var sel = null;
  try { sel = await OBR.player.getSelection(); } catch (e) { return; }
  if (!sel || sel.length !== 1) return closeInfo();
  var item = null;
  try {
    var items = await OBR.scene.items.getItems([sel[0]]);
    item = items[0] || null;
  } catch (e) {
    return closeInfo();
  }
  if (!item || !item.metadata) return closeInfo();
  var cardId = item.metadata[KEY_BIND];
  if (typeof cardId !== "string" || !cardId) return closeInfo();
  var cards = await getCards();
  if (!findCard(cards, cardId)) return closeInfo();
  if (infoOpen && infoItemId === item.id && infoCardId === cardId) return;
  if (infoOpen) await closeInfo();
  try {
    await openInfo(item.id, cardId);
  } catch (e) {
    if (!infoErrorShown) {
      infoErrorShown = true;
      stepFail("打开速览弹窗", e);
    }
  }
}

/* 拖 token / 改选择会连续触发事件，合并成一次刷新。 */
var pendingRefresh = null;
function scheduleRefresh() {
  if (pendingRefresh) return;
  pendingRefresh = setTimeout(function () {
    pendingRefresh = null;
    void refreshInfo();
  }, 120);
}

async function sceneReady() {
  try { return await OBR.scene.isReady(); } catch (e) { return false; }
}

/* ---------------------------------------------------------------------------
 * 7) 启动
 * ------------------------------------------------------------------------- */
var booted = false;
var bootStatus = { tool: false, menu: false, button: false, scene: false };

async function syncSceneButton() {
  if (!booted) return false;
  if (await sceneReady()) {
    bootStatus.scene = true;
    try {
      await openButton();
      return true;
    } catch (e) {
      if (!bootStatus.button) stepFail("打开右下角浮动按钮", e);
      return false;
    }
  }
  await closeButton();
  await closeInfo();
  return false;
}

async function sendHello(channel, payload) {
  try {
    await OBR.broadcast.sendMessage(channel, payload, { destination: "LOCAL" });
  } catch (e) {
    pageLog("err", "broadcast 失败：" + errText(e));
  }
}

async function boot() {
  if (booted) return;
  booted = true;
  var t0 = Date.now();

  pageLog("info", "OBR.onReady 触发；插件 v" + PLUGIN_VERSION + "；BASE=" + BASE);
  pageLog("info", "OBR.isAvailable=" + String(OBR.isAvailable) + "；isReady=" + String(OBR.isReady));

  /* 7.1 入口 B：工具栏 */
  bootStatus.tool = await attempt("注册工具栏按钮 (OBR.tool.create)", registerTool);

  /* 7.2 右键菜单 */
  bootStatus.menu = await attempt("注册右键菜单 (OBR.contextMenu.create)", registerContextMenu);

  /* 7.3 右下角浮动按钮（要等场景就绪） */
  bootStatus.scene = await sceneReady();
  bootStatus.button = await syncSceneButton();
  if (bootStatus.button) stepOk("打开右下角浮动按钮 ✓");
  else if (!bootStatus.scene) stepOk("场景还没就绪，浮动按钮等进入地图后再开");

  /* 7.4 事件订阅 */
  await attempt("订阅 scene.onReadyChange", function () {
    OBR.scene.onReadyChange(function () { void syncSceneButton(); });
  });
  await attempt("订阅 player.onChange", function () {
    OBR.player.onChange(scheduleRefresh);
  });
  await attempt("订阅 scene.items.onChange", function () {
    OBR.scene.items.onChange(scheduleRefresh);
  });
  await attempt("订阅 room.onMetadataChange", function () {
    OBR.room.onMetadataChange(scheduleRefresh);
  });
  await attempt("订阅 viewport.onChange", function () {
    if (!OBR.viewport || typeof OBR.viewport.onChange !== "function") return; /* 旧版 SDK 没有 */
    var timer = null;
    OBR.viewport.onChange(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        void syncSceneButton();
      }, 250);
    });
  });

  await refreshInfo().catch(function (e) { stepFail("初始化速览", e); });

  /* 7.5 汇总一条通知：一眼看出哪个入口没注册上 */
  var mark = function (v) { return v ? "✓" : "✗"; };
  var okLine = "4E 角色卡 v" + PLUGIN_VERSION + " 已加载：工具栏" + mark(bootStatus.tool) +
    " · 右键" + mark(bootStatus.menu) +
    " · 浮动按钮" + (bootStatus.scene ? mark(bootStatus.button) : "（等进地图）");
  var allOk = bootStatus.tool && bootStatus.menu;
  pageLog(allOk ? "ok" : "err", okLine + "；耗时 " + (Date.now() - t0) + "ms");
  if (diagNotifyEnabled()) notify(okLine, allOk ? "INFO" : "WARNING");

  /* 7.6 心跳：告诉面板「后台活着」，面板也会 ping 回来 */
  await sendHello(CH_HELLO, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
  try {
    OBR.broadcast.onMessage(CH_PING, function () {
      void sendHello(CH_PONG, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
    });
  } catch (e) {
    pageLog("err", "订阅 " + CH_PING + " 失败：" + errText(e));
  }
}

/* ---------------------------------------------------------------------------
 * 8) 启动保护：任何未捕获错误都变成可见通知（而不是静默死掉）
 * ------------------------------------------------------------------------- */
try {
  window.addEventListener("error", function (ev) {
    var msg = ev && ev.message ? ev.message : "脚本错误";
    pageLog("err", "未捕获错误：" + msg);
    if (booted) notify("4E插件出错（脚本异常）：" + msg, "ERROR");
  });
  window.addEventListener("unhandledrejection", function (ev) {
    var msg = errText(ev && ev.reason);
    pageLog("err", "未处理的 Promise 拒绝：" + msg);
    if (booted) notify("4E插件出错（异步异常）：" + msg, "ERROR");
  });
} catch (e) { /* 忽略 */ }

/* OBR 环境自检 */
if (typeof OBR === "undefined" || !OBR) {
  pageLog("err", "没有拿到 OBR 对象：vendor/obr-sdk.js 可能没加载成功");
} else if (OBR.isAvailable === false) {
  pageLog("err", "OBR.isAvailable=false：这个页面不是被 Owlbear 打开的（直接开 background.html 时会这样）");
} else {
  try {
    OBR.onReady(function () {
      Promise.resolve(boot()).catch(function (e) {
        stepFail("后台启动", e);
      });
    });
    pageLog("info", "已注册 OBR.onReady，等待房间握手…");
  } catch (e) {
    pageLog("err", "OBR.onReady 注册失败：" + errText(e));
  }
}
