// 全屏角色卡面板：导入 4E NEXT 导出 JSON、管理房间里的卡、预览速览、把卡绑到选中的 token。
import OBR from "../vendor/obr-sdk.js";
import {
  ID_PANEL, getCards, writeCards, mergeImports, parseExport, loadSample,
  bindToken, selectedImageToken, notify, esc, fmtTime, onReady
} from "./common.js";
import { renderGlanceHTML, cardMeta } from "./glance.js";

const listEl = document.getElementById("list");
const countEl = document.getElementById("count");
const viewEl = document.getElementById("view");
const selEl = document.getElementById("sel");
const fileEl = document.getElementById("file");
const pasteWrap = document.getElementById("paste-wrap");
const pasteEl = document.getElementById("paste");
const overlay = document.getElementById("overlay");

let cards = [];
let currentId = "";
let selectedToken = null;

/* ---------------- 渲染 ---------------- */

function metaOf(card) {
  try {
    return cardMeta(card.char);
  } catch (e) {
    return { level: card.level || 1, race: "", cls: "", hp: "?", maxHp: "?" };
  }
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
      renderView();
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
    "<h2>4E NEXT 角色卡 · 速览</h2>" +
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
    (card.updatedAt ? " · 导入于 " + esc(fmtTime(card.updatedAt)) : "") + "</div>" +
    '<div style="margin-left:auto;display:flex;gap:6px">' +
    '<button class="btn small" id="v-bind"' + (selectedToken ? "" : " disabled") + ">" + tokenText + "</button>" +
    '<button class="btn small danger" id="v-del">删除这张卡</button>' +
    "</div></div>";
}

function renderView() {
  const card = cards.filter(function (c) { return c.id === currentId; })[0];
  if (!card) {
    viewEl.innerHTML = emptyViewHtml();
    const btn = document.getElementById("v-sample");
    if (btn) btn.addEventListener("click", function () { void importSample(); });
    return;
  }
  let html = "";
  try {
    html = renderGlanceHTML(card.char);
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

async function refreshSelection() {
  try {
    selectedToken = await selectedImageToken();
  } catch (e) {
    selectedToken = null;
  }
  selEl.innerHTML = selectedToken
    ? "已选中 token：<b>" + esc(selectedToken.name || "未命名") + "</b>"
    : "未选中 token（右键地图上的 token 可直接绑定）";
  renderView();
}

/* ---------------- 数据操作 ---------------- */

// authoritative：刚写完房间数据时直接用本地结果，避免读到还没同步的旧值
async function refresh(preferId, authoritative) {
  cards = authoritative || (await getCards());
  if (preferId && cards.some(function (c) { return c.id === preferId; })) currentId = preferId;
  else if (!cards.some(function (c) { return c.id === currentId; })) currentId = cards.length ? cards[0].id : "";
  renderList();
  renderView();
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
    notify("已把「" + card.name + "」绑定到该 token", "SUCCESS");
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
  OBR.modal.close(ID_PANEL).catch(function () { /* ignore */ });
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

onReady(function () {
  try {
    OBR.player.onChange(function () { void refreshSelection(); });
    OBR.room.onMetadataChange(function () { void refresh(); });
  } catch (e) {
    console.error(e);
  }
  void refresh().then(refreshSelection, function (e) { console.error(e); });
});
