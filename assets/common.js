// 各页面共用的小工具：命名空间、房间数据读写、导入解析。
import OBR from "../vendor/obr-sdk.js";

export const NS = "com.4enext-owlbear";
/** 房间数据键：全房间共享的角色卡列表（无需自建服务器）。 */
export const KEY_CARDS = NS + "/cards";
/** Token（item）身上的绑定键：值为卡片 id。 */
export const KEY_BIND = NS + "/cardId";
/** Token（item）上的先攻加值（v1.3.0）：{ bonus, cardId, updatedAt }。 */
export const KEY_INIT = NS + "/init";
/** 房间数据里的先攻状态（v1.3.0）。 */
export const KEY_INITIATIVE = NS + "/initiative";
/** 面板与弹窗的 id。 */
export const ID_BUTTON = NS + "/button";
export const ID_INFO = NS + "/info";
export const ID_PANEL = NS + "/panel";
export const ID_BIND = NS + "/bind";

export const PLUGIN_VERSION = "1.3.0";

/**
 * 站点根地址。
 * 不再只依赖 import.meta.url：OBR 把页面放进 iframe 时，模块的 import.meta.url 不一定是
 * 页面地址，而 location 永远是本 page 的地址（所有页面都在插件根目录，所以 "./" 就是根）。
 * 参考实现 character-cards 干脆把手写死成绝对地址；我们保留一层相对兜底。
 */
export const URL_BASE = (function () {
  try {
    const u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u;
  } catch (e) { /* 忽略，走兜底 */ }
  return new URL("../", import.meta.url);
})();
export const URL_ORIGIN = URL_BASE.href;
export const URL_PANEL = new URL("panel.html", URL_BASE).href;
export const URL_INFO = new URL("info.html", URL_BASE).href;
export const URL_BIND = new URL("bind.html", URL_BASE).href;
export const URL_BUTTON = new URL("button.html", URL_BASE).href;
export const URL_INDEX = new URL("index.html", URL_BASE).href;
export const URL_ICON = new URL("icon.svg", URL_BASE).href;

/** 玩家「结束我的回合」请求频道（与 background.core.js 的 CH_INIT_REQUEST 必须一致）。 */
export const CH_INIT_REQUEST = NS + "/init-request";

/** 后台心跳频道（与 assets/background.core.js 里的常量必须一致）。 */
export const CH_HELLO = NS + "/diag-hello"; // 后台 → 页面：我起来了
export const CH_PING = NS + "/diag-ping";   // 页面 → 后台：在吗
export const CH_PONG = NS + "/diag-pong";   // 后台 → 页面：在，状态如下

/* ---- v1.2.2：速览弹窗拖动 ---- */
/** 弹窗位置记忆的 localStorage 键（值是 { v:1, pos: { <tokenId>: {left,top} } }）。 */
export const INFO_POS_KEY = "4enext/info-pos";
/** 弹窗拖动的 broadcast 频道（与 assets/background.core.js 的 CH_INFO_DRAG 必须一致）。 */
export const CH_INFO_DRAG = NS + "/info-drag";
/** 拖动区 pointermove 的节流间隔（毫秒）：越小越跟手，越大越省。 */
export const INFO_DRAG_THROTTLE_MS = 33;

/**
 * 自检：问后台「在吗」。
 * 拿不到回应 = background.html 没跑起来（右键菜单和右下角按钮就会一起缺失）。
 * 返回后台自报的状态对象，或 null（带原因说明由调用方决定）。
 */
export function pingBackground(timeoutMs) {
  return new Promise(function (resolve) {
    let done = false;
    const offs = [];
    let timer = null;
    const finish = function (value) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      for (const off of offs) {
        try { if (typeof off === "function") off(); } catch (e) { /* ignore */ }
      }
      resolve(value);
    };
    const onMsg = function (ev) {
      const data = ev && ev.data !== undefined ? ev.data : ev;
      finish({ source: "event", data: data });
    };
    try {
      offs.push(OBR.broadcast.onMessage(CH_PONG, onMsg));
      offs.push(OBR.broadcast.onMessage(CH_HELLO, onMsg));
      timer = setTimeout(function () { finish(null); }, timeoutMs || 1600);
      OBR.broadcast.sendMessage(CH_PING, { at: Date.now(), from: location.href }, { destination: "LOCAL" })
        .catch(function () { /* 拿不到就等超时 */ });
    } catch (e) {
      finish(null);
    }
  });
}

// 房间数据越小越稳：立绘（原图 / 裁切图）一律不进房间数据，速览也用不到它。
export const MAX_PORTRAIT = 0;

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/** 等 OBR 就绪再干活；页面被直接打开（不在枭熊里）时 1.5 秒后兜底执行一次。 */
export function onReady(cb) {
  let done = false;
  const run = function () {
    if (done) return;
    done = true;
    try {
      cb();
    } catch (e) {
      console.error("[4enext] 初始化失败", e);
    }
  };
  try {
    OBR.onReady(run);
  } catch (e) {
    run();
    return;
  }
  setTimeout(run, 1500);
}

export function notify(msg, variant) {
  try {
    OBR.notification.show(msg, variant || "DEFAULT");
  } catch (e) {
    console.log("[4enext]", msg);
  }
}

export function hashId(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** 读房间里的全部角色卡（按导入顺序）。 */
export async function getCards() {
  try {
    const meta = await OBR.room.getMetadata();
    const box = meta[KEY_CARDS];
    if (box && Array.isArray(box.cards)) return box.cards;
  } catch (e) {
    console.error("[4enext] 读取房间数据失败", e);
  }
  return [];
}

export async function writeCards(cards) {
  const payload = { v: 1, updatedAt: Date.now(), cards: cards };
  await OBR.room.setMetadata({ [KEY_CARDS]: payload });
  return payload;
}

export function findCard(cards, id) {
  if (!id) return null;
  for (const c of cards) if (c.id === id) return c;
  return null;
}

/** 精简角色数据：去掉立绘原图与过大的裁切图，控制房间数据体积。 */
export function compactChar(char) {
  const copy = JSON.parse(JSON.stringify(char || {}));
  delete copy.portraitOriginal;
  if (MAX_PORTRAIT <= 0 || String(copy.portraitCropped || "").length > MAX_PORTRAIT) delete copy.portraitCropped;
  return copy;
}

/** 解析 4E NEXT 导出 JSON（也接受直接粘贴 Character）。返回 { char, exportedAt } 数组。 */
export function parseExport(text) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch (e) {
    throw new Error("不是合法的 JSON");
  }
  const list = Array.isArray(data) ? data : [data];
  const out = [];
  for (const item of list) {
    const char = pickCharacter(item);
    if (char) out.push({ char: char, exportedAt: item && item.exportedAt ? item.exportedAt : "" });
  }
  if (!out.length) throw new Error("没找到角色数据（需要 4E NEXT 的「导出存档」文件，含 pages.character）");
  return out;
}

function pickCharacter(item) {
  if (!item || typeof item !== "object") return null;
  if (item.pages && item.pages.character && typeof item.pages.character === "object") return item.pages.character;
  if (item.character && typeof item.character === "object" && item.character.level != null) return item.character;
  if (item.level != null && item.abilities && item.name != null) return item;
  return null;
}

/** 把解析结果合并进现有卡片列表：同名卡就地更新（绑定关系不丢），新卡追加。 */
export function mergeImports(cards, imports) {
  const next = cards.slice();
  let added = 0;
  let updated = 0;
  for (const imp of imports) {
    const char = compactChar(imp.char);
    const name = String(char.name || "").trim() || "未命名角色";
    char.name = name;
    const idx = next.findIndex((c) => String(c.name).trim() === name);
    if (idx >= 0) {
      next[idx] = Object.assign({}, next[idx], {
        name: name,
        level: char.level || 1,
        char: char,
        updatedAt: Date.now(),
        exportedAt: imp.exportedAt || next[idx].exportedAt || ""
      });
      updated++;
    } else {
      next.push({
        id: "c-" + hashId(name + "|" + Date.now()),
        name: name,
        level: char.level || 1,
        char: char,
        importedAt: Date.now(),
        exportedAt: imp.exportedAt || ""
      });
      added++;
    }
  }
  return { cards: next, added: added, updated: updated };
}

/** 读取示例卡（samples/sample-card.json），用于空面板一键体验。 */
export async function loadSample() {
  const res = await fetch(new URL("samples/sample-card.json", URL_BASE).href);
  if (!res.ok) throw new Error("示例卡加载失败（HTTP " + res.status + "）");
  return await res.json();
}

/**
 * 把卡片 id 写到 token 的 metadata 上；cardId 为空表示解绑。
 * v1.3.0：同时写 com.4enext-owlbear/init = { bonus, cardId, updatedAt }，
 * 先攻加值取自角色卡的「先攻」（与速览 / 面板共用 glance.js 的 initiativeBonus）。
 */
export async function bindToken(itemId, cardId) {
  let init = null;
  if (cardId) {
    let bonus = 0;
    try {
      const card = findCard(await getCards(), cardId);
      /* 动态 import：common.js 也被右下角 64×64 浮动按钮加载，静态拉进
       * glance.js + data/rules.js（约 190KB）只为算一个先攻加值不划算。 */
      if (card) {
        const glance = await import("./glance.js");
        bonus = glance.initiativeBonus(card.char);
      }
    } catch (e) {
      console.error("[4enext] 读取先攻加值失败，按 +0 处理", e);
    }
    init = { bonus: bonus, cardId: cardId, updatedAt: Date.now() };
  }
  await OBR.scene.items.updateItems([itemId], function (items) {
    for (const it of items) {
      if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
      if (cardId) it.metadata[KEY_BIND] = cardId;
      else delete it.metadata[KEY_BIND];
      if (init) it.metadata[KEY_INIT] = init;
      else delete it.metadata[KEY_INIT];
    }
  });
}

export async function getItemBinding(itemId) {
  try {
    const items = await OBR.scene.items.getItems([itemId]);
    const m = items[0] && items[0].metadata ? items[0].metadata[KEY_BIND] : null;
    return typeof m === "string" ? m : null;
  } catch (e) {
    return null;
  }
}

/** 当前选中的单个 IMAGE token（绑定按钮用）。 */
export async function selectedImageToken() {
  try {
    const sel = await OBR.player.getSelection();
    if (!sel || sel.length !== 1) return null;
    const items = await OBR.scene.items.getItems([sel[0]]);
    const it = items[0];
    if (!it) return null;
    return it.type === "IMAGE" ? it : null;
  } catch (e) {
    return null;
  }
}

/** 页面标题栏里的小提示：数据来源、只读说明。 */
export function fmtTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch (e) {
    return "";
  }
}