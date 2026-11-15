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
/* v1.3.1：先攻 / 骰子各自独立一个 popover 窗口。
 * id 与速览（/info）、角色卡面板（/panel）都不同 → 可以同时打开、互不嵌套。 */
export const ID_INIT_WIN = NS + "/initiative-window";
/* v1.4.0：先攻条。它是**另一个 popover**（top-center 的条），id 与上面那个列表窗口不同，
 * 所以「先攻条 + 列表窗口」可以同时开着。打开 / 关闭 / 拖动都在 assets/background.core.js。 */
export const ID_STRIP = NS + "/initiative-strip";
export const ID_DICE_WIN = NS + "/dice-window";
/* v1.7.0：骰子记录从骰子窗口的右栏搬出来，变成**第二个独立 popover**（可拖动 / 记位置）。
 * id 与骰子窗口不同 → 两个窗口可以同时打开、各自开关。 */
export const ID_DICE_HIST = NS + "/dice-history-window";
/* v1.3.2：设置 / 关于窗口（与 assets/background.core.js 的 ID_SETTINGS_WIN 必须一致）。 */
export const ID_SETTINGS_WIN = NS + "/settings-window";
/* v1.7.2：血条组件编辑小窗（右键「添加血条组件」→ 填生命 / 四防 / 回复力）。
 * id 与其它窗口都不同 → 可以和速览 / 先攻条同时开着；位置按窗口名 "hpEdit" 单独记。 */
export const ID_HP_EDIT = NS + "/hp-edit";

export const PLUGIN_VERSION = "1.7.6";

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
/* v1.3.1：先攻 / 骰子各自独立的窗口页。 */
export const URL_INITIATIVE = new URL("initiative.html", URL_BASE).href;
export const URL_DICE = new URL("dice.html", URL_BASE).href;
/* v1.7.0：骰子记录窗口（独立 popover）+ 投骰动画页（全屏 modal，透明 + 不挡鼠标）。 */
export const URL_DICE_HIST = new URL("dice-history.html", URL_BASE).href;
export const URL_EFFECT = new URL("effect.html", URL_BASE).href;
/* v1.7.2：血条组件编辑小窗页（340×150，可拖动）。 */
export const URL_HP_EDIT = new URL("hp-edit.html", URL_BASE).href;
/* v1.3.2：设置 / 关于窗口页。 */
export const URL_SETTINGS = new URL("settings.html", URL_BASE).href;
export const URL_BUTTON = new URL("button.html", URL_BASE).href;
export const URL_INDEX = new URL("index.html", URL_BASE).href;
export const URL_ICON = new URL("icon.svg", URL_BASE).href;

/** 玩家「结束我的回合」请求频道（与 background.core.js 的 CH_INIT_REQUEST 必须一致）。 */
export const CH_INIT_REQUEST = NS + "/init-request";

/* ---- v1.5.0：骰子（团队共享）----
 * CH_ROLL        任何人 → 全桌：一次投掷（LOCAL + REMOTE；投掷者自己也听 LOCAL）
 * CH_ROLL_CLEAR  城主清空全桌历史（玩家点了只会收到 WARNING）
 * CH_ROLL_SAVED  城主客户端写完房间数据后广播 { seq, rollId }，页面据此清掉「未落库」计时器
 * KEY_ROLLS      房间数据：{ v, updatedAt, seq, rows } —— rows 上限 40（≈8~9 KB，给角色卡留空间）
 * 前三个频道与 KEY_ROLLS / ROLL_MAX_ROWS 与 background.core.js 里的同名常量必须一字不差
 * （后台是经典脚本，不能 import，dev/check.mjs 会逐项对比）。
 * 本机键：组合 / 上次公式 / 城主离线时的暂存。 */
export const CH_ROLL = NS + "/roll";
export const CH_ROLL_CLEAR = NS + "/roll-clear";
export const CH_ROLL_SAVED = NS + "/roll-saved";
export const KEY_ROLLS = NS + "/rolls";
/** 与 dice-core.js 的 ROLL_MAX_ROWS 相同（房间数据容量预算，规格 §1.6）。 */
export const ROLL_MAX_ROWS = 40;
export const LS_DICE_COMBOS = "4enext/dice/combos";
export const LS_DICE_LAST = "4enext/dice/last";
export const LS_DICE_LOCAL = "4enext/dice/local";

/* ---- v1.7.0：独立记录窗口 + 投骰动画 ----
 * CH_DICE_HIST_CMD   骰子窗口 → 后台：{ op: "toggle" | "open" | "close" }（记录窗口开关）
 * CH_DICE_HIST_STATE 后台 → 页面：{ open: true/false }（按钮据此显示「开 / 关」）
 * 两个频道与 ID_DICE_HIST / URL_DICE_HIST 与 background.core.js 里的同名常量必须一字不差
 * （后台是经典脚本，不能 import，dev/check.mjs 会逐项对比）。
 * LS_DICE_ANIM = 投骰动画开关（"0" 关闭，缺省 / "1" 开启）；设置窗口里改它。 */
export const CH_DICE_HIST_CMD = NS + "/dice-hist-cmd";
export const CH_DICE_HIST_STATE = NS + "/dice-hist-state";

/* ---- v1.7.2：血条组件编辑小窗（与 background.core.js 的同名常量必须一字不差）----
 * CH_HP_EDIT_TARGET 后台 → 页面：{ session, version, itemId, pending }（版本租约，规格 §2.2 简化版）
 * CH_HP_EDIT_READY  页面 → 后台：{ session }（页面加载完要一次补发 target，防丢第一条广播）
 * CH_HP_EDIT_SAVED  页面 → 后台：{ itemId, hp }（保存成功后立刻重画血条，不等 items.onChange） */
export const CH_HP_EDIT_TARGET = NS + "/hp-edit-target";
export const CH_HP_EDIT_READY = NS + "/hp-edit-ready";
export const CH_HP_EDIT_SAVED = NS + "/hp-edit-saved";
export const LS_DICE_ANIM = "4enext/dice/anim";
/** 记录窗口默认只显示最近几条（其余滚 / 点「展开全部」看）。 */
export const HIST_VISIBLE_ROWS = 4;

/** 投骰动画是否开启（默认开）。localStorage 不可用时也当「开」，不影响投掷。 */
export function readDiceAnim() {
  try { return localStorage.getItem(LS_DICE_ANIM) !== "0"; } catch (e) { return true; }
}
/** 写动画开关（设置窗口用；失败只影响记忆，不影响投掷）。 */
export function writeDiceAnim(on) {
  try { localStorage.setItem(LS_DICE_ANIM, on ? "1" : "0"); return true; } catch (e) { return false; }
}

/* ---- v1.4.0：先攻条（top-center 的条）----
 * STRIP_POS_KEY  只记「相对屏幕中线的偏移」{ v:1, dx, dy }，不记绝对 left（换屏幕 / 缩放后仍然贴顶居中）
 * CH_STRIP_DRAG  页面 → 后台：拖动先攻条（start / move / end / reset）
 * CH_STRIP_CMD   页面 → 后台：折叠 / 列表 / 尺寸同步等命令
 * 三个名字与 assets/background.core.js 里的同名常量必须一字不差。 */
export const STRIP_POS_KEY = "4enext/strip-pos";
export const CH_STRIP_DRAG = NS + "/strip-drag";
export const CH_STRIP_CMD = NS + "/strip-cmd";
/** 先攻条拖动时 pointermove 的节流间隔（毫秒）。 */
export const STRIP_DRAG_THROTTLE_MS = 33;

/* ---- v1.7.3：先攻条常驻（本机设置；与 background.core.js 的 STRIP_AUTOSTART_KEY /
 * STRIP_CLOSED_KEY 必须一字不差）----
 *   LS_STRIP_AUTOSTART  "0" = 进入房间不自动显示；缺省 / "1" = 自动显示（**默认开**）
 *   LS_STRIP_CLOSED     会话级「本次已经手动关掉」标记（条上的 ✕ 写它，重新打开时清掉）
 * 设置窗口（settings.html 的「先攻」栏）只调这里的读写函数，**不自己碰 localStorage**
 * （dev/check.mjs 断言这一页没有直接写本机存储）。 */
export const LS_STRIP_AUTOSTART = "4enext/strip-autostart";
export const LS_STRIP_CLOSED = "4enext/strip-closed-this-session";

/** 进入房间要不要自动显示先攻条（默认开；localStorage 不可用时也当开）。 */
export function readStripAutostart() {
  try { return localStorage.getItem(LS_STRIP_AUTOSTART) !== "0"; } catch (e) { return true; }
}
/** 写自动显示开关（设置窗口用；写失败只影响记忆，不影响打开条）。 */
export function writeStripAutostart(on) {
  try { localStorage.setItem(LS_STRIP_AUTOSTART, on ? "1" : "0"); return true; } catch (e) { return false; }
}

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

/* ---- v1.3.1：独立窗口（先攻 / 骰子 / 角色卡面板）的拖动与位置记忆 ----
 * 与速览弹窗的区别：速览按 token 记位置（INFO_POS_KEY），这三个窗口各记一份（WIN_POS_KEY）。
 * 频道与键名与 assets/background.core.js 里的同名常量必须一字不差。 */
export const WIN_POS_KEY = "4enext/win-pos";
export const CH_WIN_DRAG = NS + "/win-drag";
export const WIN_DRAG_THROTTLE_MS = 33;

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