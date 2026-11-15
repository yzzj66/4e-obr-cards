// 先攻（v1.3.0）：数据模型、掷先攻、回合推进、面板渲染。
// ---------------------------------------------------------------------------
// 数据放在「房间数据」里，全桌共享（写权限通常只有 GM）：
//   room.metadata["com.4enext-owlbear/initiative"] = {
//     v: 1, updatedAt, round, activeId,
//     entries: [{ tokenId, name, init, bonus, hidden, ownerId, updatedAt }]
//   }
// 先攻加值不在这里算：绑定角色卡时已写进 token 的
//   item.metadata["com.4enext-owlbear/init"] = { bonus, cardId, updatedAt }
// 加值来源是 glance.js 的 initiativeBonus()（= 敏捷调整 + 半等级 + 自定义先攻），
// 与速览页显示的那个「先攻」是同一个函数，不会出现两个数。
//
// 权限：
//   · GM：加入 / 隐形加入 / 掷先攻 / 上下移动 / 设为当前 / 删除 / 上一回合 / 下一回合 / 清空；
//   · 玩家：只看到公开条目，可以点「结束我的回合」——不直接写房间数据，而是发
//     broadcast 请求给 GM 客户端（GM 的 background.core.js 校验 ownerId 后代写）。
//   · 隐形的条目对非 GM 完全不渲染，连名字都不发到 DOM（当前回合也只显示「？？？」）。
//
// 本模块是 ESM，只在面板页加载；background.core.js 是经典脚本，不能 import，
// 它有一份只服务于「右键加入先攻 / 响应玩家结束回合」的精简实现，常量由 dev/check.mjs 对齐。

import OBR from "../vendor/obr-sdk.js";
import { KEY_BIND, KEY_INIT, KEY_INITIATIVE, esc, getCards, findCard } from "./common.js";
import { initiativeBonus } from "./glance.js";

export const INIT_MAX_ENTRIES = 200;
export const INIT_NAME_MAX = 80;
const INIT_MIN = -99;
const INIT_MAX = 999;

const n = (v, d) => (typeof v === "number" && isFinite(v) ? Math.round(v) : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));

/** d20（可注入 rng，测试用）。 */
export function rollD20(rng) {
  const r = typeof rng === "function" ? rng() : Math.random();
  const x = typeof r === "number" && isFinite(r) ? r : 0;
  return Math.floor(Math.max(0, Math.min(0.999999999, x)) * 20) + 1;
}

/** 先攻合计 = d20 + 加值。 */
export function rollInitiative(bonus, rng) {
  return rollD20(rng) + n(bonus, 0);
}

/** 把房间数据里的先攻状态补成完整结构（坏数据一律丢弃，不抛错）。 */
export function normalizeInitiative(raw) {
  const out = { v: 1, updatedAt: 0, round: 1, activeId: "", entries: [] };
  if (!raw || typeof raw !== "object") return out;
  out.updatedAt = n(raw.updatedAt, 0);
  out.round = Math.max(1, n(raw.round, 1));
  const seen = {};
  const src = Array.isArray(raw.entries) ? raw.entries.slice(0, INIT_MAX_ENTRIES) : [];
  for (const e of src) {
    if (!e || typeof e !== "object") continue;
    const tokenId = String(e.tokenId == null ? "" : e.tokenId).trim();
    if (!tokenId || seen[tokenId]) continue;
    seen[tokenId] = true;
    const name = String(e.name == null ? "" : e.name).trim().slice(0, INIT_NAME_MAX) || "未命名";
    out.entries.push({
      tokenId: tokenId,
      name: name,
      init: clamp(n(e.init, 0), INIT_MIN, INIT_MAX),
      bonus: clamp(n(e.bonus, 0), INIT_MIN, INIT_MAX),
      hidden: !!e.hidden,
      ownerId: String(e.ownerId == null ? "" : e.ownerId),
      updatedAt: n(e.updatedAt, 0)
    });
  }
  const wanted = String(raw.activeId == null ? "" : raw.activeId);
  const hit = out.entries.filter((e) => e.tokenId === wanted)[0];
  out.activeId = hit ? hit.tokenId : (out.entries[0] ? out.entries[0].tokenId : "");
  if (!out.entries.length) out.round = 1;
  return out;
}

/** 按先攻从高到低排；同分看加值、名字、更新时间。只在加入 / 重掷时调用，手动上下移动不会被覆盖。 */
export function sortEntries(entries) {
  return (Array.isArray(entries) ? entries.slice() : []).sort(function (a, b) {
    return (b.init - a.init) ||
      (b.bonus - a.bonus) ||
      String(a.name).localeCompare(String(b.name), "zh-CN") ||
      (a.updatedAt - b.updatedAt);
  });
}

/** 非 GM 看不到隐形条目（数据仍在房间数据里，只是不渲染）。 */
export function visibleEntries(state, role) {
  const st = normalizeInitiative(state);
  if (role === "GM") return st.entries.slice();
  return st.entries.filter((e) => !e.hidden);
}

export function currentEntry(state) {
  const st = normalizeInitiative(state);
  return st.entries.filter((e) => e.tokenId === st.activeId)[0] || null;
}

export function entryName(entry, role) {
  if (!entry) return "";
  if (entry.hidden && role !== "GM") return "？？？";
  return entry.name;
}

export function signed(v) {
  const x = n(v, 0);
  return x >= 0 ? "+" + x : String(x);
}

/** 玩家能不能结束自己的回合：当前条目必须是他自己的 token。 */
export function canEndTurn(state, playerId) {
  const e = currentEntry(state);
  return !!(e && playerId && e.ownerId === playerId);
}

/** 推进 / 后退一回合；越过末尾时轮数 +1，越过开头时轮数 -1（最小 1）。 */
export function advanceInitiative(state, dir) {
  const out = normalizeInitiative(clone(state));
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
    return out;
  }
  const step = dir < 0 ? -1 : dir > 0 ? 1 : 0;
  if (!step) return out;
  let idx = out.entries.findIndex((e) => e.tokenId === out.activeId);
  if (idx < 0) idx = 0;
  let next = idx + step;
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

/** GM 手动上下移动：只换数组位置，activeId 不变。 */
export function moveEntry(state, tokenId, dir) {
  const out = normalizeInitiative(clone(state));
  const idx = out.entries.findIndex((e) => e.tokenId === tokenId);
  const step = dir < 0 ? -1 : 1;
  const to = idx + step;
  if (idx < 0 || to < 0 || to >= out.entries.length) return out;
  const tmp = out.entries[idx];
  out.entries[idx] = out.entries[to];
  out.entries[to] = tmp;
  out.updatedAt = Date.now();
  return out;
}

export function removeEntry(state, tokenId) {
  const out = normalizeInitiative(clone(state));
  const idx = out.entries.findIndex((e) => e.tokenId === tokenId);
  if (idx < 0) return out;
  const wasActive = out.entries[idx].tokenId === out.activeId;
  out.entries.splice(idx, 1);
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
  } else if (wasActive) {
    const next = out.entries[Math.min(idx, out.entries.length - 1)];
    out.activeId = next.tokenId;
  }
  out.updatedAt = Date.now();
  return out;
}

export function setActiveEntry(state, tokenId) {
  const out = normalizeInitiative(clone(state));
  if (!out.entries.some((e) => e.tokenId === tokenId)) return out;
  out.activeId = tokenId;
  out.updatedAt = Date.now();
  return out;
}

/** 从 token 上取加值：优先 init 元数据，其次按绑定卡现算（同一函数），都没有就 +0。 */
export function bonusOfItem(item, cards) {
  const m = item && item.metadata ? item.metadata[KEY_INIT] : null;
  if (m && typeof m === "object" && typeof m.bonus === "number" && isFinite(m.bonus)) {
    return clamp(Math.round(m.bonus), INIT_MIN, INIT_MAX);
  }
  const cardId = item && item.metadata ? item.metadata[KEY_BIND] : null;
  const card = typeof cardId === "string" ? findCard(cards || [], cardId) : null;
  if (card) {
    try { return clamp(initiativeBonus(card.char), INIT_MIN, INIT_MAX); } catch (e) { /* 忽略 */ }
  }
  return 0;
}

/** 右键「加入先攻」用：从 token 生成一条先攻条目（默认自动掷 d20+加值）。 */
export function entryFromItem(item, cards, hidden, rng) {
  const cardId = item && item.metadata ? item.metadata[KEY_BIND] : null;
  const card = typeof cardId === "string" ? findCard(cards || [], cardId) : null;
  const name = String((item && item.name) || (card && card.name) || "未命名").trim().slice(0, INIT_NAME_MAX) || "未命名";
  const bonus = bonusOfItem(item, cards);
  return {
    tokenId: String(item && item.id ? item.id : ""),
    name: name,
    bonus: bonus,
    init: rollInitiative(bonus, rng),
    hidden: !!hidden,
    ownerId: String((item && item.createdUserId) || ""),
    updatedAt: Date.now()
  };
}

/** 加入（已在先攻里就更新名字 / 加值 / 隐形标记，不重掷）。 */
export function addEntry(state, entry) {
  const out = normalizeInitiative(clone(state));
  if (!entry || !entry.tokenId) return out;
  const idx = out.entries.findIndex((e) => e.tokenId === entry.tokenId);
  if (idx >= 0) {
    const old = out.entries[idx];
    out.entries[idx] = {
      tokenId: old.tokenId,
      name: String(entry.name || old.name).slice(0, INIT_NAME_MAX) || old.name,
      init: old.init,
      bonus: n(entry.bonus, old.bonus),
      hidden: !!(old.hidden || entry.hidden),
      ownerId: String(entry.ownerId || old.ownerId || ""),
      updatedAt: Date.now()
    };
  } else {
    out.entries.push({
      tokenId: entry.tokenId,
      name: String(entry.name || "未命名").slice(0, INIT_NAME_MAX) || "未命名",
      init: n(entry.init, 0),
      bonus: n(entry.bonus, 0),
      hidden: !!entry.hidden,
      ownerId: String(entry.ownerId || ""),
      updatedAt: n(entry.updatedAt, Date.now())
    });
    out.entries = sortEntries(out.entries);
  }
  if (!out.activeId) out.activeId = out.entries[0].tokenId;
  out.updatedAt = Date.now();
  return out;
}

/** 重掷一条（GM）。 */
export function rerollEntry(state, tokenId, rng) {
  const out = normalizeInitiative(clone(state));
  const e = out.entries.filter((x) => x.tokenId === tokenId)[0];
  if (!e) return out;
  e.init = rollInitiative(e.bonus, rng);
  e.updatedAt = Date.now();
  out.entries = sortEntries(out.entries);
  out.updatedAt = Date.now();
  return out;
}

export function rerollAll(state, rng) {
  const out = normalizeInitiative(clone(state));
  for (const e of out.entries) {
    e.init = rollInitiative(e.bonus, rng);
    e.updatedAt = Date.now();
  }
  out.entries = sortEntries(out.entries);
  out.activeId = out.entries[0] ? out.entries[0].tokenId : "";
  out.round = 1;
  out.updatedAt = Date.now();
  return out;
}

/* ---------------------------------------------------------------------------
 * 读写房间数据
 * ------------------------------------------------------------------------- */

export async function readInitiative() {
  try {
    const meta = await OBR.room.getMetadata();
    return normalizeInitiative(meta ? meta[KEY_INITIATIVE] : null);
  } catch (e) {
    console.error("[4enext] 读取先攻失败", e);
    return normalizeInitiative(null);
  }
}

/** 写房间数据（通常只有 GM 能成功）。返回写进去的对象。 */
export async function writeInitiative(state) {
  const next = normalizeInitiative(state);
  next.updatedAt = Date.now();
  await OBR.room.setMetadata({ [KEY_INITIATIVE]: next });
  return next;
}

/**
 * 把「已绑定角色卡、但 init 元数据缺失或过期」的 token 补一遍。
 * v1.2.2 升级上来的老 token 没有 init；重新导入同名卡后加值也可能变。
 * 只有 GM 能批量改别人的 token，所以调用方先判 role。
 */
export async function syncInitBonuses(cards) {
  let list = cards;
  if (!Array.isArray(list)) list = await getCards();
  let items = [];
  try {
    items = await OBR.scene.items.getItems();
  } catch (e) {
    return 0;
  }
  const want = {};
  for (const it of items) {
    if (!it || it.type !== "IMAGE" || !it.metadata) continue;
    const cardId = it.metadata[KEY_BIND];
    if (typeof cardId !== "string" || !cardId) continue;
    const card = findCard(list, cardId);
    if (!card) continue;
    let bonus = 0;
    try { bonus = initiativeBonus(card.char); } catch (e) { continue; }
    const cur = it.metadata[KEY_INIT];
    if (cur && typeof cur === "object" && cur.bonus === bonus && cur.cardId === cardId) continue;
    want[it.id] = { bonus: bonus, cardId: cardId, updatedAt: Date.now() };
  }
  const ids = Object.keys(want);
  if (!ids.length) return 0;
  try {
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (const d of drafts) {
        if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
        d.metadata[KEY_INIT] = want[d.id];
      }
    });
  } catch (e) {
    console.error("[4enext] 同步先攻加值失败", e);
    return 0;
  }
  return ids.length;
}

/* ---------------------------------------------------------------------------
 * 渲染
 * ------------------------------------------------------------------------- */

/** 先攻 tab 的 HTML。opts = { role, playerId, backgroundReady }。 */
export function renderInitiativeHTML(state, opts) {
  opts = opts || {};
  const role = opts.role === "GM" ? "GM" : "PLAYER";
  const isGM = role === "GM";
  const playerId = String(opts.playerId || "");
  const st = normalizeInitiative(state);
  const rows = visibleEntries(st, role);
  const active = currentEntry(st);
  const activeName = active ? entryName(active, role) : "";
  const canEnd = canEndTurn(st, playerId);

  const status = !st.entries.length
    ? "还没有人加入先攻"
    : "当前：" + (activeName || "—") + (active && active.hidden && isGM ? "（隐形）" : "");

  const gmButtons = isGM
    ? '<button class="btn small" data-init-act="prev" title="回到上一回合">‹ 上一回合</button>' +
      '<button class="btn small primary" data-init-act="next" title="推进到下一回合">下一回合 ›</button>' +
      '<button class="btn small" data-init-act="roll-all" title="让所有人重新掷 d20 + 先攻加值">重掷全部</button>' +
      '<button class="btn small" data-init-act="sync" title="按绑定角色卡重新同步先攻加值">同步加值</button>' +
      '<button class="btn small danger" data-init-act="clear" title="清空先攻（不影响 token 与角色卡）">清空</button>'
    : '<button class="btn small primary" data-init-act="end"' + (canEnd ? "" : " disabled") +
      ' title="' + (canEnd ? "结束自己的回合，交给城主推进" : "现在不是你的回合") + '">结束我的回合</button>';

  const rowsHtml = rows.length ? rows.map(function (e, i) {
    const on = e.tokenId === st.activeId ? " on" : "";
    const hid = e.hidden ? " hidden" : "";
    const name = e.name;
    const owner = e.ownerId && e.ownerId === playerId ? '<em class="init-mine">我的</em>' : "";
    const badge = e.hidden ? '<em class="init-badge">隐形</em>' : "";
    const cur = on ? '<em class="init-cur">当前</em>' : "";
    const acts = isGM
      ? '<button class="init-act" data-init-act="roll" data-token="' + esc(e.tokenId) + '" title="掷先攻：d20 ' + signed(e.bonus) + '">🎲</button>' +
        '<button class="init-act" data-init-act="up" data-token="' + esc(e.tokenId) + '" title="上移">↑</button>' +
        '<button class="init-act" data-init-act="down" data-token="' + esc(e.tokenId) + '" title="下移">↓</button>' +
        '<button class="init-act" data-init-act="active" data-token="' + esc(e.tokenId) + '" title="设为当前回合">◎</button>' +
        '<button class="init-act danger" data-init-act="remove" data-token="' + esc(e.tokenId) + '" title="从先攻里移除">✕</button>'
      : "";
    return '<div class="init-row' + on + hid + '" data-token="' + esc(e.tokenId) + '">' +
      '<span class="init-idx">' + (i + 1) + "</span>" +
      '<span class="init-name">' + esc(name) + badge + owner + cur + "</span>" +
      '<span class="init-bonus" title="先攻加值">' + signed(e.bonus) + "</span>" +
      '<span class="init-total" title="先攻合计">' + esc(e.init) + "</span>" +
      '<span class="init-acts">' + acts + "</span></div>";
  }).join("") : '<div class="init-empty">' +
    (isGM
      ? "还没有人加入先攻。<br>右键地图上的 token →「加入先攻」或「隐形加入先攻」。"
      : "城主还没有把任何人加入先攻。") +
    "</div>";

  const hint = !opts.backgroundReady
    ? '<p class="init-warn">后台脚本没有响应：右键加入先攻、玩家结束回合都要靠它。请把扩展关掉再打开一次。</p>'
    : (isGM
      ? '<p class="init-hint">先攻加值来自绑定角色卡的「先攻」（如 +25），绑定 / 重新导入后可在本页点「同步加值」刷新。隐形条目只有 GM 看得到。</p>'
      : '<p class="init-hint">你只能看到公开条目。轮到你时点「结束我的回合」，由城主客户端推进。</p>');

  return '<div class="init-wrap">' +
    '<div class="init-head">' +
    '<div><div class="init-title">先攻</div><div class="init-status">' + esc(status) + "</div></div>" +
    '<span class="init-round">第 ' + st.round + " 轮</span>" +
    '<div class="init-actions">' + gmButtons + "</div>" +
    "</div>" +
    '<div class="init-list-head"><span>#</span><span>名字</span><span>加值</span><span>合计</span><span></span></div>' +
    '<div class="init-list">' + rowsHtml + "</div>" +
    hint +
    "</div>";
}