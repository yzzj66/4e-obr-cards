// 全屏角色卡面板：导入 4E NEXT 导出 JSON、管理房间里的卡、预览速览、把卡绑到选中的 token。
import OBR from "../vendor/obr-sdk.js";
import {
  ID_PANEL, getCards, writeCards, mergeImports, parseExport, loadSample,
  bindToken, selectedImageToken, notify, esc, fmtTime, onReady,
  pingBackground, CH_HELLO, CH_INIT_REQUEST, PLUGIN_VERSION
} from "./common.js";
import { renderGlanceHTML, cardMeta, deriveGlance, magicItemDailyUses } from "./glance.js";
import { applyAction, loadState, scopeText } from "./track.js";
import {
  readInitiative, writeInitiative, renderInitiativeHTML, currentEntry,
  advanceInitiative, moveEntry, removeEntry, setActiveEntry, rerollEntry,
  rerollAll, syncInitBonuses, bonusOfItem, normalizeInitiative
} from "./initiative.js";

const listEl = document.getElementById("list");
const countEl = document.getElementById("count");
const viewEl = document.getElementById("view");
const selEl = document.getElementById("sel");
const fileEl = document.getElementById("file");
const pasteWrap = document.getElementById("paste-wrap");
const pasteEl = document.getElementById("paste");
const overlay = document.getElementById("overlay");
const initEl = document.getElementById("init-view");
const tabsEl = document.getElementById("tabs");

let cards = [];
let currentId = "";
let selectedToken = null;
/* v1.3.0：三 tab（速览 / 先攻 / 骰子）；tab 切换只切 display，不重载页面。 */
let activeTab = "glance";
let initiative = normalizeInitiative(null);
let myRole = "PLAYER";
let playerId = "";
let backgroundOk = false;
let initSynced = false;
// 当前预览这张卡的资源状态（威能 / 专长 / 装备的使用标记、行动点等）
let liveState = null;
let liveScope = "room";

/* ---------------- 渲染 ---------------- */

function metaOf(card) {
  try {
    return cardMeta(card.char);
  } catch (e) {
    return { level: card.level || 1, race: "", cls: "", hp: "?", maxHp: "?" };
  }
}

/* ---------------- 三 tab（v1.3.0） ---------------- */

const TAB_NAMES = { glance: 1, init: 1, dice: 1 };

function initialTab() {
  try {
    const t = new URLSearchParams(location.search).get("tab");
    return TAB_NAMES[t] ? t : "glance";
  } catch (e) {
    return "glance";
  }
}

function setTab(name, announce) {
  activeTab = TAB_NAMES[name] ? name : "glance";
  if (tabsEl) {
    Array.prototype.forEach.call(tabsEl.querySelectorAll("[data-tab]"), function (btn) {
      const on = btn.getAttribute("data-tab") === activeTab;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tab-pane"), function (pane) {
    const on = pane.id === "tab-" + activeTab;
    pane.classList.toggle("on", on);
    pane.style.display = on ? "" : "none";
  });
  if (activeTab === "init") void enterInitTab(announce);
}

async function enterInitTab(announce) {
  await loadInit();
  if (myRole === "GM" && !initSynced) {
    initSynced = true;
    await syncInit(!!announce);
  }
}

if (tabsEl) {
  tabsEl.addEventListener("click", function (ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest("[data-tab]") : null;
    if (!el) return;
    ev.preventDefault();
    setTab(el.getAttribute("data-tab"), false);
  });
}

/* ---------------- 先攻（v1.3.0） ---------------- */

async function loadInit() {
  try { myRole = await OBR.player.getRole(); } catch (e) { myRole = "PLAYER"; }
  try { playerId = (await OBR.player.getId()) || ""; } catch (e) { playerId = ""; }
  initiative = await readInitiative();
  renderInit();
}

function renderInit() {
  if (!initEl) return;
  initEl.innerHTML = renderInitiativeHTML(initiative, {
    role: myRole,
    playerId: playerId,
    backgroundReady: backgroundOk
  });
}

let initReloadTimer = null;
function scheduleInitReload() {
  if (initReloadTimer) return;
  initReloadTimer = setTimeout(function () {
    initReloadTimer = null;
    if (activeTab !== "init") return;
    void loadInit();
  }, 120);
}

async function saveInit(next, message) {
  try {
    initiative = await writeInitiative(next);
    renderInit();
    if (message) notify(message, "SUCCESS");
  } catch (e) {
    console.error("[4enext] 写先攻失败", e);
    notify("写不进房间数据：先攻通常只有城主能改（" + (e && e.message ? e.message : e) + "）", "ERROR");
  }
}

async function syncInit(announce) {
  if (myRole !== "GM") return;
  let list = cards;
  if (!Array.isArray(list) || !list.length) list = await getCards();
  const count = await syncInitBonuses(list);
  let items = [];
  try { items = await OBR.scene.items.getItems(); } catch (e) { items = []; }
  const byId = {};
  for (const it of items) byId[it.id] = it;
  let changed = false;
  const next = JSON.parse(JSON.stringify(initiative));
  for (const e of next.entries) {
    const it = byId[e.tokenId];
    if (!it) continue;
    const b = bonusOfItem(it, list);
    if (b !== e.bonus) {
      e.bonus = b;
      changed = true;
    }
  }
  if (changed) {
    try {
      initiative = await writeInitiative(next);
      renderInit();
    } catch (e) { /* 写不进去时保留只读视图 */ }
  }
  if (announce) {
    notify(count ? "已同步 " + count + " 枚 token 的先攻加值" : "先攻加值已是最新", count ? "SUCCESS" : "INFO");
  }
}

async function requestEndTurn() {
  const active = currentEntry(initiative);
  if (!active) {
    notify("先攻列表还是空的", "WARNING");
    return;
  }
  if (!playerId || active.ownerId !== playerId) {
    notify("现在不是你的回合", "WARNING");
    return;
  }
  try {
    await OBR.broadcast.sendMessage(CH_INIT_REQUEST, {
      op: "end-turn",
      playerId: playerId,
      activeId: initiative.activeId,
      round: initiative.round,
      at: Date.now()
    }, { destination: "ALL" });
    notify("已请求结束回合，等待城主客户端推进", "INFO");
  } catch (e) {
    notify("发送结束回合请求失败：" + (e && e.message ? e.message : e), "ERROR");
  }
}

function entryOf(tokenId) {
  return initiative.entries.filter(function (e) { return e.tokenId === tokenId; })[0] || null;
}

async function onInitAction(act, tokenId) {
  if (!act) return;
  if (act === "end") {
    await requestEndTurn();
    return;
  }
  /* 除了「结束我的回合」，其余都是 GM 操作（玩家按钮根本不会被渲染）。 */
  if (myRole !== "GM") {
    notify("只有城主能操作先攻列表", "WARNING");
    return;
  }
  if (act === "next") return saveInit(advanceInitiative(initiative, 1), "已推进到下一回合");
  if (act === "prev") return saveInit(advanceInitiative(initiative, -1), "已回到上一回合");
  if (act === "roll-all") return saveInit(rerollAll(initiative), "所有人都重新掷了先攻");
  if (act === "clear") {
    if (!window.confirm("清空先攻？token 与角色卡都不受影响，只是把先攻列表清掉。")) return;
    return saveInit(normalizeInitiative({ v: 1, entries: [] }), "先攻已清空");
  }
  if (act === "sync") return syncInit(true);

  const entry = entryOf(tokenId);
  if (!entry) return;
  if (act === "roll") {
    const next = rerollEntry(initiative, tokenId);
    const rolled = next.entries.filter(function (e) { return e.tokenId === tokenId; })[0];
    return saveInit(next, "「" + entry.name + "」掷出 " + (rolled ? rolled.init : "?"));
  }
  if (act === "up") return saveInit(moveEntry(initiative, tokenId, -1));
  if (act === "down") return saveInit(moveEntry(initiative, tokenId, 1));
  if (act === "active") return saveInit(setActiveEntry(initiative, tokenId), "当前回合：「" + entry.name + "」");
  if (act === "remove") {
    if (!window.confirm("把「" + entry.name + "」从先攻里移除？")) return;
    return saveInit(removeEntry(initiative, tokenId), "已从先攻移除");
  }
}

if (initEl) {
  initEl.addEventListener("click", function (ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest("[data-init-act]") : null;
    if (!el) return;
    ev.preventDefault();
    void onInitAction(el.getAttribute("data-init-act"), el.getAttribute("data-token"));
  });
}

function renderList() {
  countEl.textContent = cards.length + " 张";
  if (!cards.length) {
    listEl.innerHTML = '<div class="empty-panel" style="padding:24px 12px"><p>还没有导入角色卡。<br>点上面的「导入 JSON」或把文件拖进来。</p></div>';
    return;
  }
  listEl.innerHTML = cards.map(function (c) {
    const m = metaOf(c);
    const ident = [m.race, m.cls].filter(Boolean).join(" · ");
    return '<div class="card-row' + (c.id === currentId ? " on" : "") + '" data-id="' + esc(c.id) + '" role="button" tabindex="0">' +
      '<span class="n">' + esc(c.name) +
      '<button class="del" title="从房间删除这张卡" data-del="' + esc(c.id) + '">✕</button></span>' +
      '<span class="m">Lv' + esc(m.level) + (ident ? " · " + esc(ident) : "") + " · HP " + esc(m.hp) + "/" + esc(m.maxHp) + "</span></div>";
  }).join("");
  Array.prototype.forEach.call(listEl.querySelectorAll(".card-row"), function (el) {
    el.addEventListener("click", function (ev) {
      if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-del")) return;
      currentId = el.getAttribute("data-id");
      renderList();
      void renderView();
    });
  });
  Array.prototype.forEach.call(listEl.querySelectorAll(".del"), function (el) {
    el.addEventListener("click", function (ev) {
      ev.stopPropagation();
      void removeCard(el.getAttribute("data-del"));
    });
  });
}

function emptyViewHtml() {
  return '<div class="empty-panel">' +
    "<h2>4eNEXT to owlbear · 速览</h2>" +
    "<p>三步开始：<br>" +
    "① 在 4E NEXT 里「导出存档（JSON）」；<br>" +
    "② 把文件拖进这个面板（或点左侧「导入 JSON」）；<br>" +
    "③ 回到地图右键一个 token →「绑定 4E NEXT 角色卡」，之后选中它就会弹出速览。</p>" +
    '<div style="display:flex;gap:8px"><button class="btn" id="v-sample">载入示例卡看看效果</button></div>' +
    "</div>";
}

function toolbar(card) {
  const m = metaOf(card);
  const ident = [m.race, m.cls].filter(Boolean).join(" · ");
  const tokenText = selectedToken ? "绑定到「" + esc(selectedToken.name || "选中 token") + "」" : "绑定到选中 token";
  return '<div class="card-toolbar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
    '<div style="font-size:12px;color:#93a1b0">Lv' + esc(m.level) + (ident ? " · " + esc(ident) : "") +
    (card.updatedAt ? " · 导入于 " + esc(fmtTime(card.updatedAt)) : "") +
    ' · <span title="' + esc(scopeText(liveScope)) + '">资源：' + (liveScope === "local" ? "本机" : "全桌") + "</span>" +
    ' · <span title="血量写在 token 上，请选中 token 在速览弹窗里改">血量：见 token</span></div>' +
    '<div style="margin-left:auto;display:flex;gap:6px">' +
    '<button class="btn small" id="v-bind"' + (selectedToken ? "" : " disabled") + ">" + tokenText + "</button>" +
    '<button class="btn small danger" id="v-del">删除这张卡</button>' +
    "</div></div>";
}

async function renderView() {
  const card = cards.filter(function (c) { return c.id === currentId; })[0];
  if (!card) {
    viewEl.innerHTML = emptyViewHtml();
    const btn = document.getElementById("v-sample");
    if (btn) btn.addEventListener("click", function () { void importSample(); });
    return;
  }
  // 资源状态挂在卡上（房间数据），预览里也要能点；血量挂在 token 上，面板不碰
  try {
    const loaded = await loadState(card.id);
    liveState = loaded.state;
    liveScope = loaded.scope;
  } catch (e) {
    liveState = null;
    liveScope = "room";
  }
  let html = "";
  try {
    html = renderGlanceHTML(card.char, { live: { state: liveState }, editable: { track: true } });
  } catch (e) {
    console.error("[4enext] 渲染失败", e);
    html = '<div class="empty-panel"><p>渲染失败：' + esc(e && e.message ? e.message : e) + "</p></div>";
  }
  viewEl.innerHTML = toolbar(card) + html;
  const bindBtn = document.getElementById("v-bind");
  if (bindBtn) bindBtn.addEventListener("click", function () { void bindCurrent(); });
  const delBtn = document.getElementById("v-del");
  if (delBtn) delBtn.addEventListener("click", function () { void removeCard(card.id); });
}

/* 预览里的资源追踪：点击 = 标记使用 / 恢复（与速览弹窗同一套语义） */
viewEl.addEventListener("click", async function (ev) {
  const el = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
  if (!el) return;
  const card = cards.filter(function (c) { return c.id === currentId; })[0];
  if (!card) return;
  ev.preventDefault();
  const act = el.getAttribute("data-act");
  let derived = null;
  try {
    derived = deriveGlance(card.char);
  } catch (e) { /* 推导失败时也只影响计数上限 */ }
  try {
    const res = await applyAction(act, el, {
      cardId: card.id,
      itemId: null,
      state: liveState,
      hp: null,
      canHp: false,
      maxHp: derived ? derived.hpMax : 0,
      surgesMax: derived ? derived.surges : 0,
      surgeValue: derived ? derived.surgeValue : 0,
      itemDailyMax: derived ? magicItemDailyUses(derived.level, derived.milestones) : 0
    });
    if (res.state) liveState = res.state;
    if (res.scope) liveScope = res.scope;
    if (res.message) notify(res.message, res.tone || "INFO");
    await renderView();
  } catch (e) {
    notify("操作失败：" + (e && e.message ? e.message : e), "ERROR");
  }
});

async function refreshSelection() {
  try {
    selectedToken = await selectedImageToken();
  } catch (e) {
    selectedToken = null;
  }
  selEl.innerHTML = selectedToken
    ? "已选中 token：<b>" + esc(selectedToken.name || "未命名") + "</b>"
    : "未选中 token（右键地图上的 token 可直接绑定）";
  void renderView();
}

/* ---------------- 数据操作 ---------------- */

// authoritative：刚写完房间数据时直接用本地结果，避免读到还没同步的旧值
async function refresh(preferId, authoritative) {
  cards = authoritative || (await getCards());
  if (preferId && cards.some(function (c) { return c.id === preferId; })) currentId = preferId;
  else if (!cards.some(function (c) { return c.id === currentId; })) currentId = cards.length ? cards[0].id : "";
  renderList();
  void renderView();
}

async function saveCards(next) {
  try {
    await writeCards(next);
  } catch (e) {
    console.error("[4enext] 写入房间数据失败", e);
    notify("保存失败：房间数据通常只有 GM 能改，请让城主导入", "ERROR");
    return false;
  }
  return true;
}

async function importText(text, label) {
  let imports;
  try {
    imports = parseExport(text);
  } catch (e) {
    notify("导入失败：" + (e && e.message ? e.message : e), "ERROR");
    return;
  }
  const res = mergeImports(cards, imports);
  if (!(await saveCards(res.cards))) return;
  const lastName = String(imports[imports.length - 1].char.name || "").trim();
  const target = res.cards.filter(function (c) { return String(c.name).trim() === lastName; })[0];
  await refresh(target ? target.id : "", res.cards);
  notify("导入成功：新增 " + res.added + " 张，更新 " + res.updated + " 张" + (label ? "（" + label + "）" : ""), "SUCCESS");
}

async function importFiles(fileList) {
  const files = Array.prototype.slice.call(fileList || []);
  for (const f of files) {
    try {
      const text = await f.text();
      await importText(text, f.name);
    } catch (e) {
      notify("读取 " + f.name + " 失败：" + (e && e.message ? e.message : e), "ERROR");
    }
  }
}

async function importSample() {
  try {
    const data = await loadSample();
    await importText(JSON.stringify(data), "示例卡");
  } catch (e) {
    notify("示例卡加载失败：" + (e && e.message ? e.message : e), "ERROR");
  }
}

async function removeCard(id) {
  const card = cards.filter(function (c) { return c.id === id; })[0];
  if (!card) return;
  if (!window.confirm("从房间删除「" + card.name + "」？已绑定它的 token 会显示为未绑定。")) return;
  const next = cards.filter(function (c) { return c.id !== id; });
  if (!(await saveCards(next))) return;
  await refresh("", next);
  notify("已删除", "SUCCESS");
}

async function bindCurrent() {
  if (!selectedToken) {
    notify("先在地图上选中一个 token", "INFO");
    return;
  }
  const card = cards.filter(function (c) { return c.id === currentId; })[0];
  if (!card) return;
  try {
    await bindToken(selectedToken.id, card.id);
    initSynced = false;
    notify("已把「" + card.name + "」绑定到该 token（先攻加值已同步）", "SUCCESS");
    if (activeTab === "init") void enterInitTab(false);
  } catch (e) {
    console.error(e);
    notify("绑定失败：可能没有这个 token 的修改权限", "ERROR");
  }
}

/* ---------------- 事件 ---------------- */

document.getElementById("pick").addEventListener("click", function () { fileEl.click(); });
fileEl.addEventListener("change", function () {
  void importFiles(fileEl.files);
  fileEl.value = "";
});

document.getElementById("paste-toggle").addEventListener("click", function () {
  pasteWrap.style.display = pasteWrap.style.display === "none" ? "block" : "none";
  if (pasteWrap.style.display === "block") pasteEl.focus();
});
document.getElementById("paste-ok").addEventListener("click", function () {
  const text = String(pasteEl.value || "").trim();
  if (!text) return;
  void importText(text, "粘贴");
  pasteEl.value = "";
});
document.getElementById("sample").addEventListener("click", function () { void importSample(); });
document.getElementById("close").addEventListener("click", function () {
  // 面板既可能以 modal 打开（右下角按钮 / 工具栏），也可能以 action 弹窗打开（左上角图标）
  OBR.modal.close(ID_PANEL).catch(function () { /* 不是 modal 时忽略 */ });
  try {
    OBR.action.close().catch(function () { /* 不是 action 弹窗时忽略 */ });
  } catch (e) { /* 忽略 */ }
});

let dragDepth = 0;
document.addEventListener("dragenter", function (ev) {
  if (ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], "Files") >= 0) {
    dragDepth++;
    overlay.classList.add("on");
  }
});
document.addEventListener("dragover", function (ev) { ev.preventDefault(); });
document.addEventListener("dragleave", function () {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) overlay.classList.remove("on");
});
document.addEventListener("drop", function (ev) {
  ev.preventDefault();
  dragDepth = 0;
  overlay.classList.remove("on");
  if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) void importFiles(ev.dataTransfer.files);
});

/* ---------------- 后台自检条（不需要控制台） ---------------- */

const diagEl = document.getElementById("diag-strip");

function showDiag(cls, html) {
  if (!diagEl) return;
  diagEl.className = "diag-strip" + (cls ? " " + cls : "");
  diagEl.innerHTML = html;
}

function applyBackgroundStatus(payload) {
  const d = payload && payload.data !== undefined ? payload.data : payload;
  if (!d) return;
  backgroundOk = true;
  const st = d.status || {};
  const mark = (v) => (v ? "✓" : "✗");
  showDiag("good", "<b>后台已连接</b> v" + esc(d.version || PLUGIN_VERSION) +
    " · 工具栏" + mark(st.tool) + " · 右键菜单" + mark(st.menu) +
    " · 浮动按钮" + (st.scene ? mark(st.button) : "等进地图"));
}

async function checkBackground() {
  if (!diagEl) return;
  let res = null;
  try {
    res = await pingBackground(1800);
  } catch (e) {
    res = null;
  }
  if (res) {
    applyBackgroundStatus(res);
    if (activeTab === "init") renderInit();
    return;
  }
  backgroundOk = false;
  if (activeTab === "init") renderInit();
  showDiag("bad", "<b>后台脚本没有响应</b>：右键菜单和右下角 4E 按钮都会缺失。" +
    '<span class="hint">处理办法：扩展列表里关掉再打开本扩展；仍然不行就打开插件根目录的 background.html 看自检日志（那里会写明哪一步失败）。</span>');
}

onReady(function () {
  try {
    OBR.player.onChange(function () {
      void refreshSelection();
      scheduleInitReload();
    });
    OBR.room.onMetadataChange(function () {
      void refresh();
      scheduleInitReload();
    });
    OBR.scene.items.onChange(function () {
      if (activeTab === "init") scheduleInitReload();
    });
    OBR.broadcast.onMessage(CH_HELLO, applyBackgroundStatus);
  } catch (e) {
    console.error(e);
  }
  void checkBackground();
  setTab(initialTab(), false);
  void refresh().then(refreshSelection, function (e) { console.error(e); });
});