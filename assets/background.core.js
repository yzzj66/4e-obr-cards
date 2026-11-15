/* 4eNEXT to owlbear · 后台逻辑（单文件「经典脚本」，没有任何 import / export）
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
 * 外加：右键 IMAGE token 的「绑定 4E NEXT 角色卡」/「加入先攻」/「隐形加入先攻」（仅 GM），
 *       以及玩家「结束我的回合」请求（只由 GM 客户端落笔）。
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
var PLUGIN_VERSION = "1.3.0";
/* token 上的血量（与 assets/track.js 的 KEY_HP 必须一字不差）。 */
var KEY_HP = NS + "/hp";
/* v1.3.0：token 上的先攻加值 / 房间数据里的先攻状态 / 玩家结束回合请求频道
 * （与 assets/common.js、assets/initiative.js 里的同名常量必须一字不差）。 */
var KEY_INIT = NS + "/init";
var KEY_INITIATIVE = NS + "/initiative";
var CH_INIT_REQUEST = NS + "/init-request";

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;
/* v1.2.1：速览弹窗整体加宽（400 宽时 HP 行 / 数值行 / 属性三列都挤），并保证小屏不超出视口。 */
var INFO_W = 660;
var INFO_H = 700;
var INFO_MIN_W = 360;

/* v1.2.2：速览弹窗「可自由拖动」。手感 / 边界都在这几个常量里（说明：docs/popover-drag.md）。
 *   INFO_TOKEN_GAP     自动定位时，弹窗底边与 token 顶边的间距
 *   INFO_VIEW_MARGIN   拖动 / 夹取时离视口边缘的最小距离（取 16：与 MUI Popover 的默认
 *                      marginThreshold 对齐，避免贴边时 OBR 又替我们挪 8px、拖动跟着跳）
 *   INFO_DRAG_IDLE_MS  拖动中这么久没收到消息就当结束（兜住丢失的 pointerup）
 *   INFO_POS_MAX       最多记住多少枚 token 的弹窗位置
 * INFO_POS_KEY / CH_INFO_DRAG 与 assets/common.js 里的同名常量必须一字不差
 * （后台是经典脚本，不能 import）。
 */
var INFO_TOKEN_GAP = 8;
var INFO_VIEW_MARGIN = 16;
var INFO_DRAG_IDLE_MS = 1500;
var INFO_POS_MAX = 40;
var INFO_POS_KEY = "4enext/info-pos";
var CH_INFO_DRAG = NS + "/info-drag";

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
    icons: [{ icon: TOOL_ICON_URL, label: "4eNEXT to owlbear：打开面板" }],
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
async function createContextMenu(def) {
  try {
    await OBR.contextMenu.create(def);
  } catch (e) {
    // 后台重载后同 id 可能还在，先删再建
    await OBR.contextMenu.remove(def.id);
    await OBR.contextMenu.create(def);
  }
}

async function registerContextMenu() {
  if (!OBR.contextMenu || typeof OBR.contextMenu.create !== "function") {
    throw new Error("SDK 没有 OBR.contextMenu.create");
  }

  /* 1) 绑定角色卡（v1.1.0 起就有，id 不变） */
  await createContextMenu({
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
  });

  /* 2) 加入先攻 / 隐形加入先攻（v1.3.0，Full Suite 同款命名）
   * 分开注册而不是塞进同一个 icons 数组：filter 不同（隐形只给 GM），
   * 回调也不用去猜 elementId 是第几个图标。 */
  await createContextMenu({
    id: NS + "/init-add",
    icons: [{
      icon: ICON_URL,
      label: "加入先攻",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: function (context) { return onInitMenuClick(context, false); }
  });
  await createContextMenu({
    id: NS + "/init-add-hidden",
    icons: [{
      icon: ICON_URL,
      label: "隐形加入先攻",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: function (context) { return onInitMenuClick(context, true); }
  });
}

/* ---------------------------------------------------------------------------
 * 6) 速览弹窗（选中绑定的 token 就弹）
 * ---------------------------------------------------------------------------
 * v1.2.2：弹窗可自由拖动
 *   · OBR 的 popover 没有拖动能力，但可以在同一个 id 上重新 open —— 只改
 *     anchorPosition，弹窗页面不会重载（与 v1.1.0 浮动按钮同一套字段写法）。
 *   · 拖动时统一按「左上角」定位：anchorOrigin / transformOrigin 都是 LEFT/TOP，
 *     anchorPosition 就是弹窗左上角在 Owlbear 视口里的坐标。这样后台只记一个点：
 *     拖动 = 起点 + 指针位移，不用反推 OBR 的锚点 / 变换规则。
 *   · 指针事件在 info.js（弹窗页）里收，经 broadcast 发到这里；这里负责节流合并、
 *     视口边界夹取、localStorage 位置记忆（按 token id 各记一份）。
 * ------------------------------------------------------------------------- */
var infoOpen = false;
var infoItemId = null;
var infoCardId = null;
/* 弹窗当前几何：{ left, top, width, height, url, vp: { width, height } } */
var infoGeom = null;
/* 拖动状态：infoDrag = { base:{left,top}, itemId, moved }；dragWanted 是待应用的最后位置。 */
var infoDrag = null;
var infoDragTimer = null;
var dragWanted = null;
var dragBusy = false;

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

/** 选中 token 在屏幕上的「上边中点」（Owlbear 视口坐标）。 */
async function anchorOf(itemId) {
  try {
    var bounds = await OBR.scene.items.getItemBounds([itemId]);
    var scale = await OBR.viewport.getScale();
    var p = await OBR.viewport.transformPoint(bounds.center);
    return { left: p.x, top: p.y - (bounds.height * scale) / 2 };
  } catch (e) {
    return null;
  }
}

async function infoViewport() {
  var vp = { width: 0, height: 0 };
  try { vp.width = await OBR.viewport.getWidth(); } catch (e) { vp.width = 0; }
  try { vp.height = await OBR.viewport.getHeight(); } catch (e) { vp.height = 0; }
  return vp;
}

/* 小屏（13 寸笔记本 1920×1080 / 缩窄的窗口）不能超出视口：宽高都按视口留边再夹一次。 */
function infoSize(vp) {
  return {
    width: Math.max(INFO_MIN_W, Math.min(INFO_W, (vp.width || INFO_W + 40) - 32)),
    height: Math.min(INFO_H, Math.max(260, (vp.height || INFO_H + 40) - 40))
  };
}

/** 把弹窗左上角夹进视口（视口未知时不夹）。 */
function clampInfoPos(left, top, size, vp) {
  var m = INFO_VIEW_MARGIN;
  var out = { left: Math.round(left), top: Math.round(top) };
  if (vp && vp.width > 0) out.left = Math.round(Math.min(Math.max(out.left, m), Math.max(m, vp.width - size.width - m)));
  if (vp && vp.height > 0) out.top = Math.round(Math.min(Math.max(out.top, m), Math.max(m, vp.height - size.height - m)));
  return out;
}

/* ---- 位置记忆 ------------------------------------------------------------
 * localStorage["4enext/info-pos"] = { v: 1, pos: { "<tokenId>": { left, top } } }
 * 按 token 记：同一枚 token 下次打开回到原处，换一枚 token 不会串位置。
 * 读的时候容忍旧格式 / 脏数据：坏了就整份忽略，退回「token 上方」。
 * ------------------------------------------------------------------------- */
function readInfoPosMap() {
  try {
    var raw = localStorage.getItem(INFO_POS_KEY);
    if (!raw) return {};
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return {};
    var src = box.pos && typeof box.pos === "object" ? box.pos : box;
    var out = {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var one = src[k];
      if (!one || typeof one !== "object") continue;
      if (typeof one.left !== "number" || typeof one.top !== "number") continue;
      if (!isFinite(one.left) || !isFinite(one.top)) continue;
      out[k] = { left: one.left, top: one.top };
    }
    return out;
  } catch (e) {
    return {};
  }
}

function readInfoPos(itemId) {
  if (!itemId) return null;
  return readInfoPosMap()[itemId] || null;
}

function writeInfoPos(itemId, pos) {
  if (!itemId || !pos) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId]; /* 先删再插 → 这枚 token 变成「最近使用」，裁剪时最后才轮到它 */
    map[itemId] = { left: Math.round(pos.left), top: Math.round(pos.top) };
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length - INFO_POS_MAX; i++) delete map[keys[i]];
    localStorage.setItem(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) { /* 隐私模式 / 空间满：记不住位置不影响用 */ }
}

/** 只清这一枚 token 的位置（不会误清别人的）。 */
function clearInfoPos(itemId) {
  if (!itemId) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    if (!Object.keys(map).length) localStorage.removeItem(INFO_POS_KEY);
    else localStorage.setItem(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) { /* 忽略 */ }
}

/** 弹窗参数：位置一律按「左上角」解释，拖动时只换 anchorPosition。 */
function infoPopoverOptions(pos, size, url) {
  return {
    id: ID_INFO,
    url: url,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",
    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true
  };
}

/** 打开 / 移动速览弹窗。url 不变时 OBR 只更新位置，不会重载弹窗页面。 */
async function showInfoAt(pos, size, url, itemId, cardId, vp) {
  await OBR.popover.open(infoPopoverOptions(pos, size, url));
  infoOpen = true;
  infoItemId = itemId;
  infoCardId = cardId;
  infoGeom = {
    left: pos.left,
    top: pos.top,
    width: size.width,
    height: size.height,
    url: url,
    vp: { width: vp.width, height: vp.height }
  };
}

/** 自动定位点：优先用这枚 token 记住的位置，否则摆在 token 正上方。 */
async function infoAutoPos(itemId, size, vp) {
  var saved = readInfoPos(itemId);
  if (saved) return clampInfoPos(saved.left, saved.top, size, vp);
  var anchor = await anchorOf(itemId);
  if (anchor) {
    return clampInfoPos(anchor.left - size.width / 2, anchor.top - INFO_TOKEN_GAP - size.height, size, vp);
  }
  /* 拿不到 token 包围盒（极少见）：落在视口左上角，至少还能拖走 */
  return clampInfoPos((vp.width || 0) / 2 - size.width / 2, INFO_VIEW_MARGIN, size, vp);
}

async function openInfo(itemId, cardId) {
  var vp = await infoViewport();
  var size = infoSize(vp);
  var pos = await infoAutoPos(itemId, size, vp);
  var url = URL_INFO + "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId);
  await showInfoAt(pos, size, url, itemId, cardId, vp);
}

async function closeInfo() {
  if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
  infoDrag = null;
  infoGeom = null;
  if (!infoOpen) return;
  try { await OBR.popover.close(ID_INFO); } catch (e) { /* 已关闭 */ }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
}

/* ---- 拖动：info.js 只发「起点 + 累计位移」，位置换算 / 夹取 / 记忆都在这里 ---- */

/** 把最新目标位置排进队列；上一帧还没 open 完就只留最后一个（节流合并）。 */
function queueInfoDrag(pos) {
  if (!infoGeom) return;
  dragWanted = {
    pos: { left: pos.left, top: pos.top },
    size: { width: infoGeom.width, height: infoGeom.height },
    url: infoGeom.url
  };
  void pumpInfoDrag();
}

async function pumpInfoDrag() {
  if (dragBusy) return;
  dragBusy = true;
  try {
    while (dragWanted) {
      var job = dragWanted;
      dragWanted = null;
      try {
        await OBR.popover.open(infoPopoverOptions(job.pos, job.size, job.url));
        if (infoGeom) {
          infoGeom.left = job.pos.left;
          infoGeom.top = job.pos.top;
        }
      } catch (e) {
        pageLog("err", "拖动速览弹窗失败：" + errText(e));
        break;
      }
    }
  } finally {
    dragBusy = false;
    /* 上一次 open 失败时可能刚好又排进一个新位置：补跑一次，别把最后一帧丢了。 */
    if (dragWanted) void pumpInfoDrag();
  }
}

/** 拖动中 1.5 秒没消息就当结束：兜住指针跑出 iframe、页面被重载导致的丢 pointerup。 */
function touchInfoDragTimer() {
  if (infoDragTimer) clearTimeout(infoDragTimer);
  infoDragTimer = setTimeout(function () {
    infoDragTimer = null;
    if (!infoDrag) return;
    if (infoDrag.moved && infoGeom) writeInfoPos(infoDrag.itemId, infoGeom);
    infoDrag = null;
    pageLog("info", "速览弹窗拖动超时，已按最后位置收尾");
  }, INFO_DRAG_IDLE_MS);
}

/** 频道：com.4enext-owlbear/info-drag，phase = start / move / end / reset。 */
function onInfoDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;

  if (data.phase === "reset") {
    clearInfoPos(infoItemId);
    infoDrag = null;
    if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
    void resetInfoToToken();
    return;
  }
  if (!infoOpen || !infoGeom) return;

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !infoDrag) {
    /* 起点 = 弹窗现在的位置；move 一律按「起点 + 累计位移」算，不会越拖越偏。 */
    infoDrag = { base: { left: infoGeom.left, top: infoGeom.top }, itemId: infoItemId, moved: false };
    touchInfoDragTimer();
    if (data.phase === "start") return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) infoDrag.moved = true;

  /* 只是点了一下标题栏（没真的移动）就什么也不做：避免多余的重开。 */
  if (!infoDrag.moved) {
    if (data.phase === "end") {
      if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
      infoDrag = null;
    }
    return;
  }

  var target = clampInfoPos(infoDrag.base.left + dx, infoDrag.base.top + dy, infoGeom, infoGeom.vp);
  queueInfoDrag(target);
  touchInfoDragTimer();

  if (data.phase === "end") {
    if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
    writeInfoPos(infoDrag.itemId, target);
    infoDrag = null;
  }
}

/** 「回到 token」：清掉这枚 token 记住的位置，重新按 token 正上方摆。 */
async function resetInfoToToken() {
  if (!infoOpen || !infoItemId) return;
  var itemId = infoItemId;
  var cardId = infoCardId;
  var vp = await infoViewport();
  var size = infoSize(vp);
  var pos = await infoAutoPos(itemId, size, vp);
  var url = infoGeom ? infoGeom.url : URL_INFO + "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId || "");
  /* 算位置期间可能已经换了选中 token / 关了弹窗：别把过期的弹窗又开回来。 */
  if (!infoOpen || infoItemId !== itemId) return;
  try {
    await showInfoAt(pos, size, url, itemId, cardId, vp);
    pageLog("info", "速览弹窗已回到 token 上方");
  } catch (e) {
    stepFail("把速览弹窗移回 token", e);
  }
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
 * 7) token 血条（画在 token 上的图形层）
 * ---------------------------------------------------------------------------
 * 做法照抄参考实现 FullPeople/obr-suite 的 src/modules/bubbles/index.ts：
 *   · 不是「改 token 让 OBR 原生长血条」（OBR 没有这个能力），而是给 token 挂
 *     **本地图形子 item**（Curve 底条 + Curve 填充 + Text 数字），
 *     attachedTo = token id、layer = "ATTACHMENT"、disableHit、locked、固定 zIndex。
 *   · 用 OBR.scene.local.* 而不是 OBR.scene.items.* ：本地图形只在自己这台机器上画，
 *     不需要场景写权限 —— 玩家也能看到血条（场景写权限只有 GM 有）。
 *   · 尺寸/坐标全部按「已渲染」尺寸烘焙成世界坐标（参考实现 2026-05-10 的回退方案），
 *     并 disableAttachmentBehavior(["SCALE","ROTATION","LOCKED","COPY"])，
 *     避免 token 缩放时被二次放大；位移仍然跟着 token 走。
 *   · token 被删除时 OBR 会自动删掉挂在它上面的子 item；血条数据没了（解绑 / 手删）
 *     我们就主动清理自己的本地 item；本地 item 被外部删掉时会自动重建。
 * 数值来源：token 元数据 com.4enext-owlbear/hp = { cur, max, temp, updatedAt }，
 * 与速览弹窗是同一份数据，所以弹窗里加减血 → 血条立刻跟着变。
 * ------------------------------------------------------------------------- */
var BAR_TAG = NS + "/bar"; /* 本地图形 item 的元数据：{ owner: tokenId, role: "bg"|"fill"|"text" } */

var barEntries = {};     /* tokenId -> { ids: [], sig: "" } */
var barTimer = null;
var barBusy = false;
var barAgain = false;
var barUnsupported = false;
var barSwept = false;
var cachedDpi = 0;

/* 这些构建器由 dev/build-background.mjs 从 SDK 的具名导出接到本作用域（buildCurve 等）。 */
function barBuildersOk() {
  return typeof buildCurve === "function" && typeof buildText === "function";
}

function readHpMeta(item) {
  var m = item && item.metadata ? item.metadata[KEY_HP] : null;
  if (!m || typeof m !== "object") return null;
  var cur = typeof m.cur === "number" && isFinite(m.cur) ? Math.round(m.cur) : null;
  var max = typeof m.max === "number" && isFinite(m.max) && m.max > 0 ? Math.round(m.max) : null;
  var temp = typeof m.temp === "number" && isFinite(m.temp) ? Math.max(0, Math.round(m.temp)) : 0;
  if (cur === null && max === null) return null;
  return { cur: cur, max: max, temp: temp };
}

async function sceneDpi() {
  if (cachedDpi > 0) return cachedDpi;
  try {
    if (OBR.scene.grid && typeof OBR.scene.grid.getDpi === "function") cachedDpi = await OBR.scene.grid.getDpi();
  } catch (e) {
    cachedDpi = 0;
  }
  if (!(cachedDpi > 0)) cachedDpi = 150;
  return cachedDpi;
}

/** 圆角矩形（锚点在左上角、y 向下，与参考实现的 roundedRectanglePoints 同构）。 */
function roundRectPoints(w, h, r, fill) {
  if (r * 2 > h) r = h / 2;
  if (r * 2 > w) r = w / 2;
  var seg = 6;
  function arc(cx, cy, from, to) {
    var out = [];
    if (r <= 0) {
      for (var k = 0; k <= seg; k++) out.push({ x: cx, y: cy });
      return out;
    }
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var a = from + (to - from) * t;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }
  var f = typeof fill === "number" ? Math.max(0.0001, Math.min(1, fill)) : 1;
  var filled = Math.max(0, Math.min(w, f * w));
  if (f >= 1) {
    return [].concat(
      arc(r, r, -Math.PI, -Math.PI / 2),
      arc(w - r, r, -Math.PI / 2, 0),
      arc(w - r, h - r, 0, Math.PI / 2),
      arc(r, h - r, Math.PI / 2, Math.PI)
    );
  }
  if (filled <= r) {
    return [].concat(
      arc(r, r, -Math.PI, -Math.PI / 2),
      [{ x: r, y: 0 }, { x: r, y: h }],
      arc(r, h - r, Math.PI / 2, Math.PI)
    );
  }
  return [].concat(
    arc(r, r, -Math.PI, -Math.PI / 2),
    [{ x: filled - r, y: 0 }],
    arc(filled - r, r, -Math.PI / 2, 0),
    arc(filled - r, h - r, 0, Math.PI / 2),
    [{ x: filled - r, y: h }],
    arc(r, h - r, Math.PI / 2, Math.PI)
  );
}

/** 由 token 的世界包围盒推出血条几何（与参考实现同一套比例）。 */
function barLayout(bounds, dpi, hp) {
  var max = hp.max > 0 ? hp.max : (hp.cur !== null ? Math.max(1, hp.cur) : 1);
  var cur = hp.cur === null ? max : hp.cur;
  var ratio = Math.max(0, Math.min(1, cur / max));
  var s = Math.min(bounds.width, bounds.height) / dpi;
  if (!isFinite(s) || s <= 0) s = 1;
  s = Math.max(0.2, Math.min(6, s));
  var h = 20 * s;
  var pad = 2 * s;
  var w = Math.max(h * 2, bounds.width - pad * 2);
  var radius = h / 2;
  var text = String(cur) + "/" + max + (hp.temp > 0 ? " +" + hp.temp : "");
  var fs = Math.min(h * 1.05, (w / Math.max(4, text.length)) * 1.5);
  fs = Math.max(6 * s, fs);
  return {
    left: bounds.center.x - w / 2,
    top: bounds.max.y - pad - h,
    w: w, h: h, radius: radius, ratio: ratio, text: text, fontSize: fs, scale: s
  };
}

function barMeta(tokenId, role) {
  var box = {};
  box[BAR_TAG] = { owner: tokenId, role: role };
  return box;
}

function barCommon(builder, tokenId, role, z) {
  return builder
    .position({ x: 0, y: 0 })
    .layer("ATTACHMENT")
    .attachedTo(tokenId)
    .locked(true)
    .disableHit(true)
    .visible(true)
    .disableAutoZIndex(true)
    .zIndex(z)
    .disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"])
    .metadata(barMeta(tokenId, role));
}

function buildBarItems(tokenId, L) {
  var items = [];
  var bgPoints = roundRectPoints(L.w, L.h, L.radius, 1);
  items.push(barCommon(buildCurve(), tokenId, "bg", 10000)
    .fillColor("#A4A4A4").fillOpacity(0.6)
    /* 参考实现的标准模式没有描边（顶部模式才有），这里保持一致 */
    .strokeColor("#000000").strokeOpacity(0).strokeWidth(0)
    .tension(0).closed(true).points(bgPoints)
    .position({ x: L.left, y: L.top })
    .build());
  items.push(barCommon(buildCurve(), tokenId, "fill", 20000)
    .fillColor("#a52424").fillOpacity(0.85)
    .strokeOpacity(0).strokeWidth(0)
    .tension(0).closed(true).points(roundRectPoints(L.w, L.h, L.radius, L.ratio))
    .position({ x: L.left, y: L.top })
    .build());
  if (typeof buildText === "function") {
    items.push(barCommon(buildText(), tokenId, "text", 30000)
      .plainText(L.text).textType("PLAIN")
      .textAlign("CENTER").textAlignVertical("MIDDLE")
      .fontFamily("Roboto, sans-serif").fontSize(L.fontSize).fontWeight(700)
      .fillColor("#ffffff").fillOpacity(1)
      .strokeColor("#000000").strokeOpacity(0.7).strokeWidth(Math.max(0.4, L.h * 0.075))
      .lineHeight(0.95).width(L.w).height(L.h)
      .position({ x: L.left, y: L.top })
      .build());
  }
  return items;
}

async function addBar(tokenId, L) {
  var items = buildBarItems(tokenId, L);
  await OBR.scene.local.addItems(items);
  var ids = [];
  for (var i = 0; i < items.length; i++) ids.push(items[i].id);
  return ids;
}

async function patchBar(entry, L) {
  await OBR.scene.local.updateItems(entry.ids, function (drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var tag = d.metadata && d.metadata[BAR_TAG] ? d.metadata[BAR_TAG] : null;
      var role = tag && tag.role ? tag.role : (tag ? "bg" : "");
      if (role === "bg") {
        d.position = { x: L.left, y: L.top };
        d.points = roundRectPoints(L.w, L.h, L.radius, 1);
        d.visible = true;
      } else if (role === "fill") {
        d.position = { x: L.left, y: L.top };
        d.points = roundRectPoints(L.w, L.h, L.radius, L.ratio);
        d.visible = L.ratio > 0;
      } else if (role === "text") {
        if (!d.text) continue;
        d.text.plainText = L.text;
        d.text.style.fontSize = L.fontSize;
        d.text.width = L.w;
        d.text.height = L.h;
        d.position = { x: L.left, y: L.top };
        d.visible = true;
      }
    }
  });
}

async function removeBar(tokenId) {
  var entry = barEntries[tokenId];
  if (!entry) return;
  delete barEntries[tokenId];
  try {
    await OBR.scene.local.deleteItems(entry.ids);
  } catch (e) { /* 已经没了就算了 */ }
}

async function clearBars() {
  var ids = Object.keys(barEntries);
  for (var i = 0; i < ids.length; i++) await removeBar(ids[i]);
}

function scheduleBars() {
  if (barTimer) return;
  barTimer = setTimeout(function () {
    barTimer = null;
    void syncBars();
  }, 90);
}

/**
 * 启动时清扫上一次后台实例留下的血条 item。
 * 本地图形 item 会一直留到整页刷新，而扩展关掉再打开只会重载 iframe ——
 * 不清的话会出现「两层一模一样的血条」（视觉上看不出来，但会一直叠着）。
 * 只做一次，且在建立任何 barEntries 之前，所以不会误删自己刚画的。
 */
async function sweepStaleBars() {
  if (barSwept) return;
  barSwept = true;
  try {
    if (!OBR.scene.local || typeof OBR.scene.local.getItems !== "function") return;
    var items = await OBR.scene.local.getItems();
    var stale = [];
    for (var i = 0; i < items.length; i++) {
      var tag = items[i].metadata ? items[i].metadata[BAR_TAG] : null;
      if (tag && !barEntries[items[i].id]) stale.push(items[i].id);
    }
    if (stale.length) {
      await OBR.scene.local.deleteItems(stale);
      pageLog("info", "清理了 " + stale.length + " 个上一次会话残留的血条 item");
    }
  } catch (e) { /* 拿不到本地 item 就算了 */ }
}

/** 把「场景里所有带 hp 元数据的 token」与本地血条 item 对齐。 */
async function syncBars() {
  if (barUnsupported) return;
  if (barBusy) { barAgain = true; return; }
  barBusy = true;
  try {
    if (!(await sceneReady())) { await clearBars(); return; }
    if (!barBuildersOk() || !OBR.scene.local || typeof OBR.scene.local.addItems !== "function") {
      barUnsupported = true;
      pageLog("err", "SDK 里没有 buildCurve / scene.local：token 血条不可用（其它功能不受影响）");
      return;
    }
    await sweepStaleBars();
    var items = await OBR.scene.items.getItems();
    var dpi = await sceneDpi();
    var want = {};
    var order = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type !== "IMAGE") continue;
      var hp = readHpMeta(it);
      if (!hp) continue;
      want[it.id] = hp;
      order.push(it.id);
    }
    var known = Object.keys(barEntries);
    for (var j = 0; j < known.length; j++) {
      if (!want[known[j]]) await removeBar(known[j]);
    }
    for (var k = 0; k < order.length; k++) {
      var id = order[k];
      var bounds = null;
      try {
        bounds = await OBR.scene.items.getItemBounds([id]);
      } catch (e) {
        continue;
      }
      if (!bounds || !bounds.center) continue;
      var L = barLayout(bounds, dpi, want[id]);
      var sig = [want[id].cur, want[id].max, want[id].temp,
        Math.round(L.w), Math.round(L.h), Math.round(L.left), Math.round(L.top)].join("|");
      var entry = barEntries[id];
      if (entry && entry.sig === sig && !entry.force) continue;
      if (entry && !entry.force) {
        try {
          await patchBar(entry, L);
          entry.sig = sig;
          continue;
        } catch (e) {
          await removeBar(id);
        }
      } else if (entry) {
        /* 本地图形被外部删掉了：删掉残留记录，下面按新几何重画 */
        await removeBar(id);
      }
      try {
        barEntries[id] = { ids: await addBar(id, L), sig: sig };
      } catch (e) {
        pageLog("err", "画血条失败（" + id + "）：" + errText(e));
      }
    }
  } catch (e) {
    pageLog("err", "同步 token 血条失败：" + errText(e));
  } finally {
    barBusy = false;
    if (barAgain) { barAgain = false; scheduleBars(); }
  }
}

/** 本地血条被别的插件 / 手滑删掉时自动补回来。 */
async function watchLocalBars() {
  if (!OBR.scene.local || typeof OBR.scene.local.onChange !== "function") return;
  await attempt("订阅 scene.local.onChange（血条自愈）", function () {
    OBR.scene.local.onChange(function (items) {
      if (barBusy) return;
      var seen = {};
      for (var i = 0; i < items.length; i++) seen[items[i].id] = true;
      var ids = Object.keys(barEntries);
      for (var j = 0; j < ids.length; j++) {
        var own = barEntries[ids[j]].ids;
        for (var k = 0; k < own.length; k++) {
          if (!seen[own[k]]) {
            barEntries[ids[j]].force = true;
            scheduleBars();
            return;
          }
        }
      }
    });
  });
}

/* ---------------------------------------------------------------------------
 * 7.5) 先攻（v1.3.0）
 * ---------------------------------------------------------------------------
 * 右键「加入先攻 / 隐形加入先攻」直接写房间数据：
 *   room.metadata["com.4enext-owlbear/initiative"] =
 *     { v:1, updatedAt, round, activeId, entries:[{tokenId,name,init,bonus,hidden,ownerId,updatedAt}] }
 * 先攻加值取 token 上的 com.4enext-owlbear/init（绑定角色卡时由 common.js 写入），
 * 后台是经典脚本，不能 import glance.js 的推导函数 —— 所以这里只读元数据，不重算。
 *
 * 面板里的 GM 操作由面板自己写房间数据（同一套 initiative.js 逻辑）。
 * 玩家点「结束我的回合」时不能写房间数据，改成 broadcast 请求；只有 GM 客户端
 * 收到后校验「当前条目确实是这个玩家的 token」才推进。
 * ------------------------------------------------------------------------- */
var INIT_MAX_ENTRIES = 200;

function initInt(v, d) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : d;
}
function initClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function initNorm(raw) {
  var out = { v: 1, updatedAt: 0, round: 1, activeId: "", entries: [] };
  if (!raw || typeof raw !== "object") return out;
  out.updatedAt = initInt(raw.updatedAt, 0);
  out.round = Math.max(1, initInt(raw.round, 1));
  var src = Array.isArray(raw.entries) ? raw.entries.slice(0, INIT_MAX_ENTRIES) : [];
  var seen = {};
  for (var i = 0; i < src.length; i++) {
    var e = src[i];
    if (!e || typeof e !== "object") continue;
    var tokenId = String(e.tokenId == null ? "" : e.tokenId).trim();
    if (!tokenId || seen[tokenId]) continue;
    seen[tokenId] = true;
    var name = String(e.name == null ? "" : e.name).trim().slice(0, 80) || "未命名";
    out.entries.push({
      tokenId: tokenId,
      name: name,
      init: initClamp(initInt(e.init, 0), -99, 999),
      bonus: initClamp(initInt(e.bonus, 0), -99, 999),
      hidden: !!e.hidden,
      ownerId: String(e.ownerId == null ? "" : e.ownerId),
      updatedAt: initInt(e.updatedAt, 0)
    });
  }
  var wanted = String(raw.activeId == null ? "" : raw.activeId);
  var hit = null;
  for (var j = 0; j < out.entries.length; j++) if (out.entries[j].tokenId === wanted) hit = out.entries[j];
  out.activeId = hit ? hit.tokenId : (out.entries[0] ? out.entries[0].tokenId : "");
  if (!out.entries.length) out.round = 1;
  return out;
}
function initSortEntries(list) {
  return list.slice().sort(function (a, b) {
    return (b.init - a.init) || (b.bonus - a.bonus) ||
      String(a.name).localeCompare(String(b.name), "zh-CN") || (a.updatedAt - b.updatedAt);
  });
}
async function initRead() {
  try {
    var meta = await OBR.room.getMetadata();
    return initNorm(meta ? meta[KEY_INITIATIVE] : null);
  } catch (e) {
    pageLog("err", "读取先攻失败：" + errText(e));
    return initNorm(null);
  }
}
async function initWrite(state) {
  var next = initNorm(state);
  next.updatedAt = Date.now();
  await OBR.room.setMetadata({ [KEY_INITIATIVE]: next });
  return next;
}
function initRollD20() {
  return Math.floor(Math.random() * 20) + 1;
}
/** 只读 token 元数据里的加值；缺失时 +0（面板打开先攻 tab 会补写）。 */
function initBonusOf(item) {
  var m = item && item.metadata ? item.metadata[KEY_INIT] : null;
  if (m && typeof m === "object" && typeof m.bonus === "number" && isFinite(m.bonus)) {
    return initClamp(Math.round(m.bonus), -99, 999);
  }
  return 0;
}
/** 加进先攻（已在列表里就只更新名字 / 加值 / 隐形标记，不重掷）。 */
async function initAdd(item, hidden) {
  if (!item || !item.id) return null;
  var state = await initRead();
  var cards = await getCards();
  var cardId = item.metadata ? item.metadata[KEY_BIND] : null;
  var card = typeof cardId === "string" ? findCard(cards, cardId) : null;
  var name = String(item.name || (card && card.name) || "未命名").trim().slice(0, 80) || "未命名";
  var bonus = initBonusOf(item);
  var ownerId = String(item.createdUserId || "");
  var idx = -1;
  for (var i = 0; i < state.entries.length; i++) {
    if (state.entries[i].tokenId === item.id) { idx = i; break; }
  }
  var entry = null;
  if (idx >= 0) {
    var old = state.entries[idx];
    entry = {
      tokenId: old.tokenId,
      name: name || old.name,
      init: old.init,
      bonus: bonus,
      hidden: !!(old.hidden || hidden),
      ownerId: ownerId || old.ownerId,
      updatedAt: Date.now()
    };
    state.entries[idx] = entry;
  } else {
    entry = {
      tokenId: item.id,
      name: name,
      init: initRollD20() + bonus,
      bonus: bonus,
      hidden: !!hidden,
      ownerId: ownerId,
      updatedAt: Date.now()
    };
    state.entries.push(entry);
    state.entries = initSortEntries(state.entries);
  }
  if (!state.activeId && state.entries.length) state.activeId = state.entries[0].tokenId;
  var next = await initWrite(state);
  return { state: next, entry: entry };
}

async function onInitMenuClick(context, hidden) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") {
      notify("加入先攻需要城主权限（房间数据只有城主能写）", "WARNING");
      return;
    }
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }
    /* context 里的 item 可能是右键那一刻的快照：重新取一次，保证 init 元数据是最新的。 */
    var fresh = null;
    try { fresh = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e) { fresh = null; }
    var res = await initAdd(fresh || picked, hidden);
    if (!res) return;
    stepOk("加入先攻：" + res.entry.name + (hidden ? "（隐形）" : ""));
    notify("「" + res.entry.name + "」" + (hidden ? "已隐形加入先攻" : "已加入先攻") +
      "（先攻 " + res.entry.init + "）", "SUCCESS");
  } catch (e) {
    stepFail("加入先攻", e);
  }
}

function initAdvance(state, dir) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
    return out;
  }
  var step = dir < 0 ? -1 : 1;
  var idx = -1;
  for (var i = 0; i < out.entries.length; i++) {
    if (out.entries[i].tokenId === out.activeId) { idx = i; break; }
  }
  if (idx < 0) idx = 0;
  var next = idx + step;
  if (next >= out.entries.length) {
    next = 0;
    out.round = Math.max(1, out.round + 1);
  } else if (next < 0) {
    next = out.entries.length - 1;
    out.round = Math.max(1, out.round - 1);
  }
  out.activeId = out.entries[next].tokenId;
  out.updatedAt = Date.now();
  return out;
}

/** 玩家「结束我的回合」：广播到所有客户端，只有 GM 客户端会真正写入。 */
async function onInitRequest(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.op !== "end-turn") return;
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") return;
    var state = await initRead();
    var active = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].tokenId === state.activeId) { active = state.entries[i]; break; }
    }
    if (!active) return;
    if (data.activeId && data.activeId !== state.activeId) {
      notify("回合已经变了，结束回合请求已忽略", "WARNING");
      return;
    }
    if (!data.playerId || active.ownerId !== data.playerId) {
      notify("只能结束自己的回合", "WARNING");
      return;
    }
    var next = initAdvance(state, 1);
    await initWrite(next);
    notify("「" + active.name + "」结束回合 → 第 " + next.round + " 轮", "INFO");
  } catch (e) {
    pageLog("err", "处理结束回合请求失败：" + errText(e));
  }
}

/* ---------------------------------------------------------------------------
 * 8) 启动
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
    OBR.scene.onReadyChange(function () {
      void syncSceneButton();
      scheduleBars();
    });
  });
  await attempt("订阅 player.onChange", function () {
    OBR.player.onChange(scheduleRefresh);
  });
  await attempt("订阅 scene.items.onChange", function () {
    OBR.scene.items.onChange(function () {
      scheduleRefresh();
      scheduleBars();
    });
  });
  await attempt("订阅 scene.grid.onChange（血条尺寸）", function () {
    if (!OBR.scene.grid || typeof OBR.scene.grid.onChange !== "function") return;
    OBR.scene.grid.onChange(function () {
      cachedDpi = 0;
      scheduleBars();
    });
  });
  await attempt("订阅 room.onMetadataChange", function () {
    OBR.room.onMetadataChange(scheduleRefresh);
  });
  await attempt("订阅 " + CH_INFO_DRAG + "（速览弹窗拖动）", function () {
    OBR.broadcast.onMessage(CH_INFO_DRAG, onInfoDrag);
  });
  await attempt("订阅 " + CH_INIT_REQUEST + "（玩家结束回合）", function () {
    OBR.broadcast.onMessage(CH_INIT_REQUEST, onInitRequest);
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

  /* 7.5 token 血条：先挂自愈监听，再把现有 token 画一遍 */
  await watchLocalBars();
  scheduleBars();

  /* 7.6 汇总一条通知：一眼看出哪个入口没注册上 */
  var mark = function (v) { return v ? "✓" : "✗"; };
  var okLine = "4eNEXT to owlbear v" + PLUGIN_VERSION + " 已加载：工具栏" + mark(bootStatus.tool) +
    " · 右键" + mark(bootStatus.menu) +
    " · 浮动按钮" + (bootStatus.scene ? mark(bootStatus.button) : "（等进地图）");
  var allOk = bootStatus.tool && bootStatus.menu;
  pageLog(allOk ? "ok" : "err", okLine + "；耗时 " + (Date.now() - t0) + "ms");
  if (diagNotifyEnabled()) notify(okLine, allOk ? "INFO" : "WARNING");

  /* 7.7 心跳：告诉面板「后台活着」，面板也会 ping 回来 */
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