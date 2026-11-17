// v1.3.1：「角色卡 / 导入」窗口（panel.html）的页面脚本。
// ---------------------------------------------------------------------------
// v1.3.0 这里是「一个大面板 + 速览 / 先攻 / 骰子 三个 tab」，用户明确不要。
// v1.3.1 起面板只做四件事：**导入 4E NEXT 导出 JSON、管理房间里的卡、预览速览、把卡绑到选中的 token**。
// 先攻在 initiative.html、骰子在 dice.html、速览在 info.html —— 各自独立窗口、独立入口，可以同时打开。
//
// 本轮另外两条硬要求（见 _v131-brief.md）：
//   · 每个按钮都要有反馈：**失败 / 警告**走 feedback()（ERROR / WARNING 才真的出声），
//     绝不允许「点了一下什么都没发生」；v1.7.8 起成功 / 普通提示不再弹（用户嫌提示太多），
//     成功的反馈就是界面本身（列表刷新 / 卡片消失 / 绑定值变了）；
//   · 后台在线检测：ping 不通就在顶部显示「后台未连接，点这里重试」，并把交互元素置灰
//     （data-bg 硬依赖 → 真 disabled；data-bg-soft 软依赖 → 只弱化外观，因为导入 / 绑定其实
//      只写房间数据与 token 元数据，不靠后台脚本）。
import OBR from "../vendor/obr-sdk.js";
import {
  ID_PANEL, getCardsInfo, writeCards, mergeImports, parseExport, loadSample,
  bindToken, selectedImageToken, esc, fmtTime, onReady, propagateCardStats
} from "./common.js";
import { renderGlanceHTML, cardMeta, deriveGlance, magicItemDailyUses, loadCardIndex } from "./glance.js";
import { applyAction, loadState, scopeText } from "./track.js";
import { createWindow, feedback, closeSelf } from "./window.js";

const listEl = document.getElementById("list");
const viewEl = document.getElementById("view");
const selEl = document.getElementById("sel");
const fileEl = document.getElementById("file");
const pasteWrap = document.getElementById("paste-wrap");
const pasteEl = document.getElementById("paste");
const overlay = document.getElementById("overlay");

/* 窗口外壳：拖动（popover 模式下由后台重开同一个 id 实现）+ 后台在线检测。 */
const win = createWindow({ name: "panel", head: document.getElementById("head") });

let cards = [];
let currentId = "";
let selectedToken = null;
/* v1.7.15：卡片这一份数据是存在「房间」（全桌）还是「本机」（房间数据装不下时的兜底）。
 * 工具栏上会明写「角色卡：本机 / 全桌」，不让用户猜为什么别人看不到这张卡。 */
let cardsScope = "room";
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

function renderList() {
  if (!listEl) return;
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
    "① 在 4E NEXT 里「导出存档（JSON）」；也可以用「导出全部数据」的备份文件一次导入多张卡；<br>" +
    "② 把文件拖进这个面板（或点左侧「导入 JSON」）；<br>" +
    "③ 回到地图右键一个 token →「绑定 4E NEXT 角色卡」，之后选中它就会弹出速览。</p>" +
    '<div style="display:flex;gap:8px"><button class="btn" id="v-sample">载入示例卡看看效果</button></div>' +
    "</div>";
}

/**
 * 「角色卡：…」来源标签（v1.8.0 三态）：
 *   room  → 全桌（房间）：存在房间数据里，全房间共享、切场景还在（正常情况）；
 *   scene → 本场景：房间数据 16 KB 装不下时自动改存当前场景的隐藏 item，本场景全桌可见；
 *   local → 本机：场景也写不进（玩家身份 / 场景未就绪）的最后兜底，只有这台机器看得到。
 */
function scopeBadge() {
  if (cardsScope === "scene") {
    return '<span title="' + esc("本场景完整卡：房间数据放不下全桌名单时，完整角色卡（不精简、字段不丢）存在当前场景的隐藏 item 里；换场景后看不到，需要重新导入或等卡库同步。") +
      '">角色卡：本场景</span>';
  }
  const tip = cardsScope === "local"
    ? "本机兜底：房间数据与场景都写不进时，卡片列表只记在这台机器上（其他玩家看不到）；先攻 / 骰子照旧能写。设置 →「清理房间数据」可以瘦身。"
    : "全桌名单（精简副本）：房间数据里存的是跨场景可见、玩家可见、用于绑定的精简名单；完整卡在当前场景的隐藏 item 里。";
  return '<span title="' + esc(tip) + '">角色卡：' + (cardsScope === "local" ? "本机" : "全桌") + (cardsScope === "room" ? "（房间）" : "") + "</span>";
}

function toolbar(card) {
  const m = metaOf(card);
  const ident = [m.race, m.cls].filter(Boolean).join(" · ");
  const tokenText = selectedToken ? "绑定到「" + esc(selectedToken.name || "选中 token") + "」" : "绑定到选中 token";
  return '<div class="card-toolbar">' +
    '<div class="card-toolbar-meta">Lv' + esc(m.level) + (ident ? " · " + esc(ident) : "") +
    (card.updatedAt ? " · 导入于 " + esc(fmtTime(card.updatedAt)) : "") +
    " · " + scopeBadge() +
    ' · <span title="' + esc(scopeText(liveScope)) + '">资源：' + (liveScope === "local" ? "本机" : "全桌") + "</span>" +
    ' · <span title="血量写在 token 上，请选中 token 在速览弹窗里改">血量：见 token</span></div>' +
    '<div class="card-toolbar-acts">' +
    '<button class="btn small" id="v-bind" data-bg-soft' + (selectedToken ? "" : " disabled") + ">" + tokenText + "</button>" +
    '<button class="btn small" id="v-export" title="把这张卡导出成 4E NEXT 可导入的 JSON（换场景 / 备份用）">导出 JSON</button>' +
    '<button class="btn small danger" id="v-del" data-bg-soft>删除这张卡</button>' +
    "</div></div>";
}

async function renderView() {
  if (!viewEl) return;
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
  win.refreshGates();
  paintGates();
  const bindBtn = document.getElementById("v-bind");
  if (bindBtn) bindBtn.addEventListener("click", function () { void bindCurrent(); });
  const expBtn = document.getElementById("v-export");
  if (expBtn) expBtn.addEventListener("click", function () { exportCard(card); });
  const delBtn = document.getElementById("v-del");
  if (delBtn) delBtn.addEventListener("click", function () { void removeCard(card.id); });
}

/* 后台离线时把预览区工具栏按钮置灰（这些按钮是 renderView 动态插进来的，
   window.js 启动时扫描不到，所以每次重画后手动同步一次状态） */
function paintGates() {
  const bad = win.state === "bad";
  const bind = document.getElementById("v-bind");
  if (bind) bind.disabled = bad || !selectedToken;
  const del = document.getElementById("v-del");
  if (del) del.disabled = bad;
}

/* 预览里的资源追踪：点击 = 标记使用 / 恢复（与速览弹窗同一套语义） */
if (viewEl) {
  viewEl.addEventListener("click", async function (ev) {
    const el = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!el) return;
    const card = cards.filter(function (c) { return c.id === currentId; })[0];
    if (!card) {
      feedback("先选一张卡再改资源", "WARNING");
      return;
    }
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
      /* v1.7.8：成功不再弹「已更新资源标记」（点一下变灰 / 恢复就是反馈）；
       * 只有 applyAction 报的 WARNING（写不进房间数据 → 降级本机）才出声。 */
      if (res.message && res.tone === "WARNING") feedback(res.message, "WARNING");
      await renderView();
    } catch (e) {
      feedback("操作失败：" + (e && e.message ? e.message : e), "ERROR");
    }
  });
}

async function refreshSelection() {
  try {
    selectedToken = await selectedImageToken();
  } catch (e) {
    selectedToken = null;
  }
  if (selEl) {
    if (selectedToken) {
      selEl.style.display = "";
      selEl.innerHTML = "已选中 token：<b>" + esc(selectedToken.name || "未命名") + "</b>";
    } else {
      selEl.style.display = "none";
      selEl.innerHTML = "";
    }
  }
  void renderView();
}

/* ---------------- 数据操作 ---------------- */

// authoritative：刚写完房间数据时直接用本地结果，避免读到还没同步的旧值
async function refresh(preferId, authoritative) {
  try {
    if (authoritative) {
      cards = authoritative;
    } else {
      const info = await getCardsInfo();
      cards = info.cards;
      cardsScope = info.scope;
    }
  } catch (e) {
    cards = [];
    feedback("读取房间里的角色卡失败：" + (e && e.message ? e.message : e), "ERROR");
  }
  if (preferId && cards.some(function (c) { return c.id === preferId; })) currentId = preferId;
  else if (!cards.some(function (c) { return c.id === currentId; })) currentId = cards.length ? cards[0].id : "";
  renderList();
  void renderView();
}

/**
 * v1.7.15：写卡片列表。返回值 = { scope, saved } 或 null（写不进去且本机也存不下）。
 * 超预算 / OBR 拒写时 common.js 已经弹过 **ERROR** 通知（ROOM_FULL_MESSAGE 或具体原因），
 * 这里只把「角色卡：本机」这个状态带回界面。
 */
async function saveCards(next) {
  const prevCards = cards.slice();
  let res = null;
  try {
    res = await writeCards(next);
  } catch (e) {
    console.error("[4enext] 写入房间数据失败", e);
    feedback("保存失败：房间数据通常只有 GM 能改，请让城主导入（" + (e && e.message ? e.message : e) + "）", "ERROR");
    return null;
  }
  cardsScope = res.scope;
  if (res.scope === "local" && res.saved === false) {
    feedback("保存失败：房间数据写不进去，本机也存不下这张卡", "ERROR");
    return null;
  }
  /* v1.8.4（照 Full Suite propagateCardRefresh）：导入 / 更新卡片成功后，把新卡数据回推到已绑定的 token。
   * 只更新 max / 回复力上限 / 四防 / 先攻加值，cur / temp / locked 保留；只 GM 执行、同值不写。 */
  try {
    const prevChar = {};
    for (const c of prevCards) prevChar[c.id] = JSON.stringify(c.char || null);
    const updatedIds = (res.cards || next || []).filter(function (c) {
      return c && c.id && prevChar[c.id] !== JSON.stringify(c.char || null);
    }).map(function (c) { return c.id; });
    if (updatedIds.length) void propagateCardStats(res.cards || next, updatedIds);
  } catch (e) {
    console.warn("[4enext] 回推卡片统计失败（不影响导入）", e);
  }
  return res;
}

async function importText(text, label) {
  let imports;
  try {
    imports = await parseExport(text);
  } catch (e) {
    feedback("导入失败：" + (e && e.message ? e.message : e), "ERROR");
    return;
  }
  const res = mergeImports(cards, imports);
  const saved = await saveCards(res.cards);
  if (!saved) return;
  const last = imports[imports.length - 1];
  const lastName = String(last && last.char ? last.char.name : "").trim();
  const target = res.cards.filter(function (c) { return String(c.name).trim() === lastName; })[0];
  await refresh(target ? target.id : "", res.cards);
  /* v1.7.8：导入成功不再弹通知（卡片列表立刻刷新，就是反馈）。 */
}

async function importFiles(fileList) {
  const files = Array.prototype.slice.call(fileList || []);
  if (!files.length) {
    feedback("没有选中文件", "WARNING");
    return;
  }
  for (const f of files) {
    try {
      const text = await f.text();
      await importText(text, f.name);
    } catch (e) {
      feedback("读取 " + f.name + " 失败：" + (e && e.message ? e.message : e), "ERROR");
    }
  }
}

async function importSample() {
  try {
    const data = await loadSample();
    await importText(JSON.stringify(data), "示例卡");
  } catch (e) {
    feedback("示例卡加载失败：" + (e && e.message ? e.message : e), "ERROR");
  }
}

/**
 * 导出当前卡（v1.8.0）：生成结构同 4E NEXT「导出存档」的单角色 JSON，方便换场景 / 备份。
 * 卡片数据都在页面内存里（char 已被 unpackCard 还原成 4E NEXT Character），不需要后台脚本；
 * 4E NEXT 存卡时就丢了立绘 / 法术书 / 背景正文（cards-core.js 的精简格式），所以导出文件很小。
 */
function exportCard(card) {
  try {
    const char = (card && card.char) || {};
    const data = {
      app: "4enext",
      format: 1,
      exportedAt: new Date().toISOString(),
      pages: {
        character: char,
        reserve: { spellbook: char.spellbook || [], backpack: char.backpack || [] },
        overview: {},
        background: char.creation || {}
      }
    };
    const name = String(char.name || (card && card.name) || "角色").replace(/[\\/:*?"<>|]/g, "_");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name + ".json";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* 等下载真正开始再回收 ObjectURL（立刻 revoke 在部分浏览器会得到空文件）。 */
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  } catch (e) {
    feedback("导出失败：" + (e && e.message ? e.message : e), "ERROR");
  }
}

async function removeCard(id) {
  const card = cards.filter(function (c) { return c.id === id; })[0];
  if (!card) {
    feedback("这张卡已经不在了（可能被别人删了）", "WARNING");
    return;
  }
  if (!window.confirm("从房间删除「" + card.name + "」？已绑定它的 token 会显示为未绑定。")) {
    return; /* v1.7.8：取消不再弹「已取消」（窗口自己就关掉了） */
  }
  const next = cards.filter(function (c) { return c.id !== id; });
  const saved = await saveCards(next);
  if (!saved) return;
  await refresh("", next);
  /* v1.7.8：删除成功不再弹通知（这张卡立刻从列表里消失）。 */
}

async function bindCurrent() {
  if (!selectedToken) {
    feedback("先在地图上选中一个 token，再点「绑定到选中 token」", "WARNING");
    return;
  }
  const card = cards.filter(function (c) { return c.id === currentId; })[0];
  if (!card) {
    feedback("先在左边选一张卡", "WARNING");
    return;
  }
  try {
    await bindToken(selectedToken.id, card.id);
    /* v1.7.8：「已把…绑定到该 token」不再弹（token 上的绑定 / 先攻加值立刻生效）。 */
  } catch (e) {
    console.error(e);
    feedback("绑定失败：可能没有这个 token 的修改权限（" + (e && e.message ? e.message : e) + "）", "ERROR");
  }
}

/* ---------------- 事件 ---------------- */

const pickBtn = document.getElementById("pick");
if (pickBtn) {
  pickBtn.addEventListener("click", function () {
    if (!fileEl) return;
    try {
      fileEl.click();
    } catch (e) {
      feedback("打不开文件选择框：" + (e && e.message ? e.message : e), "ERROR");
    }
  });
}
if (fileEl) {
  fileEl.addEventListener("change", function () {
    void importFiles(fileEl.files);
    fileEl.value = "";
  });
}

const pasteToggle = document.getElementById("paste-toggle");
if (pasteToggle && pasteWrap) {
  pasteToggle.addEventListener("click", function () {
    pasteWrap.style.display = pasteWrap.style.display === "none" ? "block" : "none";
    if (pasteWrap.style.display === "block" && pasteEl) pasteEl.focus();
  });
}
const pasteOk = document.getElementById("paste-ok");
if (pasteOk) {
  pasteOk.addEventListener("click", function () {
    const text = String(pasteEl ? pasteEl.value : "").trim();
    if (!text) {
      feedback("先把 4E NEXT 导出的 JSON 全文粘贴到上面的文本框里", "WARNING");
      return;
    }
    void importText(text, "粘贴");
    if (pasteEl) pasteEl.value = "";
  });
}
const sampleBtn = document.getElementById("sample");
if (sampleBtn) sampleBtn.addEventListener("click", function () { void importSample(); });

const closeBtn = document.getElementById("close");
if (closeBtn) {
  closeBtn.addEventListener("click", function () {
    /* 面板可能以 popover 打开（工具栏 / 浮动按钮），也可能以 action 弹窗打开（左上角图标），
       两种都试一遍；关不掉也不影响（用户可以用 Esc / 再点一次图标）。 */
    /* v1.7.10：✕ 双保险 —— popover.close(正确的 panel id) + modal.close + 后台 {op:"close-win"}。 */
    closeSelf(ID_PANEL, "panel");
    try {
      const p = OBR.action.close();
      if (p && typeof p.catch === "function") p.catch(function () { /* 不是 action 弹窗时忽略 */ });
    } catch (e) { /* 忽略 */ }
  });
}

let dragDepth = 0;
document.addEventListener("dragenter", function (ev) {
  if (ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], "Files") >= 0) {
    dragDepth++;
    if (overlay) overlay.classList.add("on");
  }
});
document.addEventListener("dragover", function (ev) { ev.preventDefault(); });
document.addEventListener("dragleave", function () {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth && overlay) overlay.classList.remove("on");
});
document.addEventListener("drop", function (ev) {
  ev.preventDefault();
  dragDepth = 0;
  if (overlay) overlay.classList.remove("on");
  if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) void importFiles(ev.dataTransfer.files);
  else feedback("拖进来的不是文件：请把 .json 文件拖进窗口", "WARNING");
});

/* ---------------- 启动 ---------------- */

/* 后台状态变化 → 重新同步预览区按钮的置灰 */
win.onStatus(paintGates);

onReady(function () {
  try {
    OBR.player.onChange(function () { void refreshSelection(); });
    OBR.room.onMetadataChange(function () { void refresh(); });
  } catch (e) {
    console.error(e);
  }
  /* v1.8.6：首帧不阻塞 —— 先刷新列表 / 预览（此时没有动作标签），
   * 再异步加载精简索引（~305KB）→ 重绘一次补动作类型标签；加载失败静默。 */
  void refresh().then(refreshSelection, function (e) {
    feedback("读取角色卡失败：" + (e && e.message ? e.message : e), "ERROR");
  });
  void loadCardIndex().then(function () {
    void refresh();
  }, function () {
    /* 静默：首帧已经渲染，索引失败只是少动作标签 */
  });
});
