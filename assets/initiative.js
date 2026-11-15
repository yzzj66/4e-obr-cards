// 先攻（v1.4.0）：数据模型、先攻条渲染、掷先攻、回合推进、拖拽排序。
// ---------------------------------------------------------------------------
// 数据放在「房间数据」里，全桌共享（写权限通常只有 GM）：
//   room.metadata["com.4enext-owlbear/initiative"] = {
//     v: 1, updatedAt, phase, round, surprise, activeId,
//     entries: [{ tokenId, name, bonus, d20, init, tb, hidden, ownerId, updatedAt }]
//   }
//
// v1.4.0 在 v1.3.0 的结构上**只新增字段**，键名一个都没改：
//   · phase    "idle" | "preparing" | "combat"（缺省 idle —— 旧数据照旧能读，不报错）
//   · surprise 突袭轮标记（4E 的 surprise round，在正常第 1 轮之前）
//   · d20      原始点数，只用于卡片底部公式行 (12+25)；旧数据没有就退回 (37)
//   · tb       同分排序用的稳定随机数（genTiebreak），加值越高越靠前
//   · init     = d20 + bonus（掷的时候一次算好，**不要**改成显示时相加，否则旧数据全错位）
//   init 可以是小数：拖拽排序写「两卡中点」，显示一律 Math.round（规格 §4 / §7.3）。
//
// 条目上限 60（规格 §9.3）：60 条约 11~13 KB，留出 cards 键的余量仍在房间数据 16 KB 内。
// normalizeInitiative 里截断（不抛错）；writeInitiative 写不进去时降级到本机
// localStorage["4enext/state/initiative"] 并弹 WARNING（不允许静默）。
//
// 权限：
//   · GM：加入 / 隐形加入 / 掷先攻 / 拖拽排序 / 上下移动 / 设为当前 / 删除 / 清空 /
//         战斗准备 / 开始战斗 / 突袭 / 结束战斗 / 上一回合 / 下一回合；
//   · 玩家：只看到公开条目，「结束我的回合」不写房间数据，只 broadcast 请求
//     （GM 的 background.core.js 校验 ownerId 后代写，见规格 §5 的四道校验）；
//   · 隐形的条目对非 GM 完全不渲染，连名字都不发到 DOM（当前回合只显示「？？？」）。
//
// 本模块是 ESM，只在窗口页加载；background.core.js 是经典脚本，不能 import，
// 它有一份只服务于「右键加入先攻 / 响应玩家结束回合 / 打开先攻条」的精简实现，
// 常量与排序 / 回合推进公式由 dev/check.mjs 与 dev/test-initiative.mjs 对齐。

import OBR from "../vendor/obr-sdk.js";
import { KEY_BIND, KEY_INIT, KEY_INITIATIVE, NS, esc, getCards, findCard, notify } from "./common.js";
import { initiativeBonus } from "./glance.js";

/** 条目上限：房间数据约 16 KB，60 条是 v1.3.x 的 200 条按规格收紧后的值（规格 §9.3）。 */
export const INIT_MAX_ENTRIES = 60;
export const INIT_NAME_MAX = 80;
const INIT_MIN = -99;
const INIT_MAX = 999;

/* token 上的血量键：与 assets/track.js 的 KEY_HP 一字不差（这里不 import track.js，
 * 免得先攻窗口为了一个键把整份规则数据拉进来）。 */
const KEY_HP = NS + "/hp";

/* ---- 战斗状态（规格 §2 / §P3） ---- */
export const PHASE_IDLE = "idle";
export const PHASE_PREPARING = "preparing";
export const PHASE_COMBAT = "combat";
export const PHASES = [PHASE_IDLE, PHASE_PREPARING, PHASE_COMBAT];

/* ---- 先攻条几何（规格 §3.1；assets/background.core.js 里的同名常量必须一致） ---- */
export const STRIP_COLLAPSED_W = 120;
export const STRIP_COLLAPSED_H = 40;
export const STRIP_EXPANDED_W = 720;
export const STRIP_MIN_EXPANDED_W = 410;
export const STRIP_H_IDLE = 129;
export const STRIP_H_PREPARING = 139;
export const STRIP_H_COMBAT = 159;
export const STRIP_TOP_OFFSET = 45;
export const STRIP_SIDE_MARGIN = 16;
/* 卡片尺寸（规格 §3.5，ui.css 里必须一致） */
export const STRIP_CARD_W = 56;
export const STRIP_CARD_H = 80;
export const STRIP_CARD_ACTIVE_H = 100;

/** 本机降级键：房间数据写不进去时先记在这（settings 页的 4enext/state/* 白名单内）。 */
export const LS_INIT_FALLBACK = "4enext/state/initiative";
/** 先攻条折叠状态（只在本机）。 */
export const LS_STRIP_COLLAPSED = "4enext/strip-collapsed";

const n = (v, d) => (typeof v === "number" && isFinite(v) ? Math.round(v) : d);
/** 保留小数（init / tb 用：拖拽排序写的是中点）。 */
const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
const tbOf = (e) => (e && typeof e.tb === "number" && isFinite(e.tb) ? e.tb : 0.5);
const round6 = (v) => Math.round(v * 1e6) / 1e6;

export function normalizePhase(v) {
  const s = String(v == null ? "" : v);
  return PHASES.indexOf(s) >= 0 ? s : PHASE_IDLE;
}

/** 先攻条高度：按战斗状态三档（规格 §3.1，129 / 139 / 159）。 */
export function stripHeightFor(phase) {
  const p = normalizePhase(phase);
  if (p === PHASE_COMBAT) return STRIP_H_COMBAT;
  if (p === PHASE_PREPARING) return STRIP_H_PREPARING;
  return STRIP_H_IDLE;
}

/**
 * 先攻条尺寸（v1.6.2：**常量**，不再按内容测量）。
 *
 * 折叠 → 120×40；展开 → **固定 720**，只有视口太窄（视口 −32 < 720）时才跟着缩，
 * 下限 410；高度按 phase 三档（129 / 139 / 159）。
 * 投骰后点数 / 名字 / 状态文字变长变短都**不会**改变这两个数字 ——
 * 内容再长由 .strip-items 自己横向滚动（ui.css：overflow-x: auto）。
 *
 * 签名变化：v1.6.1 是 (phase, collapsed, clusterW, vw)，clusterW 来自「量控制行 scrollWidth」，
 * 正是「条随投骰变窄」的根因。v1.6.2 起第三个参数就是视口宽（vw），第三个以外的测量值一律丢弃；
 * 万一有页面还按老签名调 4 个参数，也按「第 4 个是视口宽、第 3 个测量值作废」处理。
 */
export function stripSizeFor(phase, collapsed, a, b) {
  if (collapsed) return { width: STRIP_COLLAPSED_W, height: STRIP_COLLAPSED_H };
  const vw = arguments.length >= 4 ? b : a;
  let width = STRIP_EXPANDED_W;
  if (typeof vw === "number" && vw > 0) width = Math.max(STRIP_MIN_EXPANDED_W, Math.min(width, vw - STRIP_SIDE_MARGIN * 2));
  return { width: Math.round(width), height: stripHeightFor(phase) };
}

/* ---------------------------------------------------------------------------
 * 掷骰
 * ------------------------------------------------------------------------- */

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

/** 三种掷法：normal 1d20 / adv 2d20 取高 / dis 2d20 取低（卡片下方三个按钮）。 */
export function rollD20Mode(mode, rng) {
  const a = rollD20(rng);
  if (mode !== "adv" && mode !== "dis") return a;
  const b = rollD20(rng);
  return mode === "adv" ? Math.max(a, b) : Math.min(a, b);
}

/**
 * tiebreak 生成（规格 §7.1）：0.5 − bonus × 0.01 + 抖动（< 0.01），夹在 (0.001, 0.999)。
 * 加值越高 → tb 越小 → 同分时排越前（等价于「敏捷高的先动」）。
 */
export function genTiebreak(bonus, rng) {
  const m = typeof bonus === "number" && isFinite(bonus) ? bonus : 0;
  const r = typeof rng === "function" ? rng() : Math.random();
  const x = typeof r === "number" && isFinite(r) ? Math.max(0, Math.min(0.999999999, r)) : 0;
  return round6(clamp(0.5 - m * 0.01 + x * 0.008, 0.001, 0.999));
}

/* ---------------------------------------------------------------------------
 * 归一化 / 排序
 * ------------------------------------------------------------------------- */

/** 把房间数据里的先攻状态补成完整结构（坏数据一律丢弃，不抛错）。 */
export function normalizeInitiative(raw) {
  const out = { v: 1, updatedAt: 0, phase: PHASE_IDLE, round: 1, surprise: false, activeId: "", entries: [] };
  if (!raw || typeof raw !== "object") return out;
  out.updatedAt = n(raw.updatedAt, 0);
  out.phase = normalizePhase(raw.phase);
  out.round = Math.max(1, n(raw.round, 1));
  out.surprise = out.phase === PHASE_COMBAT ? !!raw.surprise : false;
  const seen = {};
  const src = Array.isArray(raw.entries) ? raw.entries.slice(0, INIT_MAX_ENTRIES) : [];
  for (const e of src) {
    if (!e || typeof e !== "object") continue;
    const tokenId = String(e.tokenId == null ? "" : e.tokenId).trim();
    if (!tokenId || seen[tokenId]) continue;
    seen[tokenId] = true;
    const name = String(e.name == null ? "" : e.name).trim().slice(0, INIT_NAME_MAX) || "未命名";
    const bonus = clamp(n(e.bonus, 0), INIT_MIN, INIT_MAX);
    /* init 允许小数（拖拽排序的中点），但不能是 NaN / Infinity。 */
    const init = clamp(num(e.init, 0), INIT_MIN, INIT_MAX);
    const d20raw = num(e.d20, null);
    const tbraw = num(e.tb, null);
    out.entries.push({
      tokenId: tokenId,
      name: name,
      init: init,
      bonus: bonus,
      d20: d20raw === null ? null : clamp(Math.round(d20raw), 1, 20),
      tb: tbraw === null ? null : clamp(tbraw, 0.001, 0.999),
      hidden: !!e.hidden,
      ownerId: String(e.ownerId == null ? "" : e.ownerId),
      updatedAt: n(e.updatedAt, 0)
    });
  }
  const wanted = String(raw.activeId == null ? "" : raw.activeId);
  const hit = out.entries.filter((e) => e.tokenId === wanted)[0];
  out.activeId = hit ? hit.tokenId : (out.entries[0] ? out.entries[0].tokenId : "");
  return out;
}

/**
 * 排序（规格 §7.2，只有两级）：合计 DESC → tiebreak ASC。
 * 再加名字 / 更新时间只为「完全同分同 tb」时稳定，不会影响前两级。
 * tb 缺失按 0.5 处理 —— 旧数据没有 tb 也能排，不报错。
 */
export function sortEntries(entries) {
  return (Array.isArray(entries) ? entries.slice() : []).sort(function (a, b) {
    const d = num(b.init, 0) - num(a.init, 0);
    if (d) return d;
    const t = tbOf(a) - tbOf(b);
    if (t) return t;
    return String(a.name).localeCompare(String(b.name), "zh-CN") || (n(a.updatedAt, 0) - n(b.updatedAt, 0));
  });
}

/**
 * 排序后的状态。
 * v1.4.0 起「数组顺序不再当权威」：读 / 写房间数据都过一遍这里，
 * 渲染前再排一次，于是拖拽 / 上下移 / 重掷三套操作共享同一套数学（规格 §7.4）。
 */
export function sortState(state) {
  const out = normalizeInitiative(state);
  out.entries = sortEntries(out.entries);
  return out;
}

/* ---------------------------------------------------------------------------
 * 视图辅助
 * ------------------------------------------------------------------------- */

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

/** 战斗状态的中文标签（先攻条 / 列表页共用）。 */
export function phaseLabel(state) {
  const st = normalizeInitiative(state);
  if (st.phase === PHASE_COMBAT) return st.surprise ? "突袭轮" : "战斗中 · 第 " + st.round + " 轮";
  if (st.phase === PHASE_PREPARING) return "战斗准备中";
  return st.entries.length ? "待命" : "空闲";
}

/** 折叠态 / 展开态都要显示的小徽标。 */
export function phaseBadge(state) {
  const st = normalizeInitiative(state);
  if (st.phase === PHASE_COMBAT) return st.surprise ? "突袭轮" : "R" + st.round;
  if (st.phase === PHASE_PREPARING) return "准备中";
  return "待命";
}

/* ---------------------------------------------------------------------------
 * 战斗流程（规格 §P3）
 * ------------------------------------------------------------------------- */

/** 战斗准备：清空所有 init / d20 / active，phase=preparing，round=1（显示「准备中」）。 */
export function startPreparation(state, rng) {
  const out = normalizeInitiative(clone(state));
  const now = Date.now();
  for (const e of out.entries) {
    e.init = 0;
    e.d20 = null;
    if (e.tb === null) e.tb = genTiebreak(e.bonus, rng);
    e.updatedAt = now;
  }
  out.entries = sortEntries(out.entries);
  out.phase = PHASE_PREPARING;
  out.round = 1;
  out.surprise = false;
  out.activeId = "";
  out.updatedAt = now;
  return out;
}

/** 开始战斗：没掷过的现掷（d20 + 加值），按排序取第一张为当前，phase=combat，round=1。 */
export function startCombat(state, rng, opts) {
  const surprise = !!(opts && opts.surprise);
  const out = normalizeInitiative(clone(state));
  const now = Date.now();
  for (const e of out.entries) {
    if (e.d20 === null) {
      const d = rollD20Mode("normal", rng);
      e.d20 = d;
      e.init = clamp(d + e.bonus, INIT_MIN, INIT_MAX);
    }
    if (e.tb === null) e.tb = genTiebreak(e.bonus, rng);
    e.updatedAt = now;
  }
  out.entries = sortEntries(out.entries);
  out.phase = PHASE_COMBAT;
  out.surprise = surprise;
  out.round = 1;
  out.activeId = out.entries.length ? out.entries[0].tokenId : "";
  out.updatedAt = now;
  return out;
}

/** 突袭：4E 的 surprise round（在当前的第 1 轮之前；绕回第一张时变回正常第 1 轮）。 */
export function startSurprise(state, rng) {
  return startCombat(state, rng, { surprise: true });
}

/** 结束战斗 / 取消准备：回到 idle，名单保留，指针清空（下次准备时重新掷）。 */
export function endCombat(state) {
  const out = normalizeInitiative(clone(state));
  out.phase = PHASE_IDLE;
  out.round = 1;
  out.surprise = false;
  out.activeId = "";
  out.updatedAt = Date.now();
  return out;
}

/** 一键清空：连名单一起清（token / 角色卡都不受影响）。 */
export function clearInitiative() {
  return normalizeInitiative({ v: 1, phase: PHASE_IDLE, round: 1, entries: [] });
}

/**
 * 推进 / 后退一回合（规格 §6）。
 * nextIndex = (cur + 1 + len) % len；绕回第一张时轮数 +1（突袭轮绕回则进入正常第 1 轮）。
 * 从第一张往回：轮数 −1，最小 1。
 */
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
    if (out.surprise) out.surprise = false;
    else out.round = Math.max(1, out.round + 1);
  } else if (next < 0) {
    next = out.entries.length - 1;
    if (out.round > 1) out.round -= 1;
  }
  out.activeId = out.entries[next].tokenId;
  out.updatedAt = Date.now();
  return out;
}

/* ---------------------------------------------------------------------------
 * 排序：拖拽 / 上下移 共用的中点数学（规格 §7.3）
 * ------------------------------------------------------------------------- */

/**
 * 把 tokenId 插到「排序后数组里第 insertIndex 位」——即插在去掉自己之后的第 insertIndex 张卡之前。
 *   · 上下两张都有、合计不同 → init 取中点（可以是 .5）
 *   · 上下两张同分 → init 不变，只把 tb 取中点（同分组内靠 tb 排）
 *   · 只有上面（拖到最底）→ init = above − 1；只有下面（拖到最顶）→ init = below + 1
 * 加值不动；显示仍然 Math.round（规格 §4）。
 */
export function reorderEntry(state, tokenId, insertIndex) {
  const out = normalizeInitiative(clone(state));
  const sorted = sortEntries(out.entries);
  const idx = sorted.findIndex((e) => e.tokenId === tokenId);
  if (idx < 0) return out;
  const me = sorted[idx];
  const others = sorted.filter((e) => e.tokenId !== tokenId);
  let k = n(insertIndex, 0);
  if (k < 0) k = 0;
  if (k > others.length) k = others.length;
  const above = k > 0 ? others[k - 1] : null;
  const below = k < others.length ? others[k] : null;
  if (!above && !below) return out; /* 只有一张卡，无处可放 */
  if (above && below) {
    if (num(above.init, 0) === num(below.init, 0)) {
      me.init = num(above.init, 0);
      me.tb = round6((tbOf(above) + tbOf(below)) / 2);
    } else {
      me.init = round6((num(above.init, 0) + num(below.init, 0)) / 2);
    }
  } else if (above) {
    me.init = round6(Math.max(INIT_MIN, num(above.init, 0) - 1));
  } else {
    me.init = round6(Math.min(INIT_MAX, num(below.init, 0) + 1));
  }
  me.updatedAt = Date.now();
  out.updatedAt = Date.now();
  out.entries = sortEntries(out.entries);
  return out;
}

/** GM 手动上移 / 下移：和拖拽同一套数学（写 init / tb，不搬数组）。 */
export function moveEntry(state, tokenId, dir) {
  const out = normalizeInitiative(clone(state));
  const sorted = sortEntries(out.entries);
  const idx = sorted.findIndex((e) => e.tokenId === tokenId);
  if (idx < 0) return out;
  const step = dir < 0 ? -1 : 1;
  const k = idx + step;
  if (k < 0 || k > sorted.length - 1) return out;
  return reorderEntry(out, tokenId, k);
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

/* ---------------------------------------------------------------------------
 * 加值 / 加入 / 重掷
 * ------------------------------------------------------------------------- */

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

/** 右键「加入先攻」用：从 token 生成一条先攻条目（默认自动掷 d20 + 加值）。 */
export function entryFromItem(item, cards, hidden, rng, mode) {
  const cardId = item && item.metadata ? item.metadata[KEY_BIND] : null;
  const card = typeof cardId === "string" ? findCard(cards || [], cardId) : null;
  const name = String((item && item.name) || (card && card.name) || "未命名").trim().slice(0, INIT_NAME_MAX) || "未命名";
  const bonus = bonusOfItem(item, cards);
  const d20 = rollD20Mode(mode || "normal", rng);
  return {
    tokenId: String(item && item.id ? item.id : ""),
    name: name,
    bonus: bonus,
    d20: d20,
    init: clamp(d20 + bonus, INIT_MIN, INIT_MAX),
    tb: genTiebreak(bonus, rng),
    hidden: !!hidden,
    ownerId: String((item && item.createdUserId) || ""),
    updatedAt: Date.now()
  };
}

/** 加入（已在先攻里就更新名字 / 加值 / 隐形标记，不重掷）。超过上限就原样返回。 */
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
      d20: old.d20,
      tb: old.tb,
      hidden: !!(old.hidden || entry.hidden),
      ownerId: String(entry.ownerId || old.ownerId || ""),
      updatedAt: Date.now()
    };
  } else {
    if (out.entries.length >= INIT_MAX_ENTRIES) return out;
    out.entries.push({
      tokenId: entry.tokenId,
      name: String(entry.name || "未命名").slice(0, INIT_NAME_MAX) || "未命名",
      init: clamp(num(entry.init, 0), INIT_MIN, INIT_MAX),
      bonus: clamp(n(entry.bonus, 0), INIT_MIN, INIT_MAX),
      d20: entry.d20 === null || entry.d20 === undefined ? null : clamp(n(entry.d20, 0), 1, 20),
      tb: entry.tb === null || entry.tb === undefined ? genTiebreak(entry.bonus) : clamp(num(entry.tb, 0.5), 0.001, 0.999),
      hidden: !!entry.hidden,
      ownerId: String(entry.ownerId || ""),
      updatedAt: n(entry.updatedAt, Date.now())
    });
    out.entries = sortEntries(out.entries);
  }
  if (!out.activeId && out.entries.length) out.activeId = out.entries[0].tokenId;
  out.updatedAt = Date.now();
  return out;
}

/** 重掷一条（GM）。mode: normal / adv / dis。 */
export function rerollEntry(state, tokenId, rng, mode) {
  const out = normalizeInitiative(clone(state));
  const e = out.entries.filter((x) => x.tokenId === tokenId)[0];
  if (!e) return out;
  const d20 = rollD20Mode(mode || "normal", rng);
  e.d20 = d20;
  e.init = clamp(d20 + e.bonus, INIT_MIN, INIT_MAX);
  e.tb = genTiebreak(e.bonus, rng);
  e.updatedAt = Date.now();
  out.entries = sortEntries(out.entries);
  out.updatedAt = Date.now();
  return out;
}

export function rerollAll(state, rng) {
  const out = normalizeInitiative(clone(state));
  for (const e of out.entries) {
    const d20 = rollD20Mode("normal", rng);
    e.d20 = d20;
    e.init = clamp(d20 + e.bonus, INIT_MIN, INIT_MAX);
    e.tb = genTiebreak(e.bonus, rng);
    e.updatedAt = Date.now();
  }
  out.entries = sortEntries(out.entries);
  out.activeId = out.entries[0] ? out.entries[0].tokenId : "";
  out.round = 1;
  out.surprise = false;
  out.updatedAt = Date.now();
  return out;
}

/* ---------------------------------------------------------------------------
 * 读写房间数据（写失败 → 本机降级）
 * ------------------------------------------------------------------------- */

function readLocalFallback() {
  try {
    const raw = localStorage.getItem(LS_INIT_FALLBACK);
    if (!raw) return null;
    const box = JSON.parse(raw);
    const st = box && box.state ? box.state : box;
    if (!st || typeof st !== "object") return null;
    const out = sortState(st);
    return out.entries.length ? out : null;
  } catch (e) {
    return null;
  }
}

function clearLocalFallback() {
  try { localStorage.removeItem(LS_INIT_FALLBACK); } catch (e) { /* 忽略 */ }
}

/** 把状态暂存到本机（房间数据写不进去时的兜底）。返回是否成功。 */
export function stashInitiative(state) {
  try {
    const st = sortState(state);
    localStorage.setItem(LS_INIT_FALLBACK, JSON.stringify({ v: 1, updatedAt: Date.now(), state: st }));
    return true;
  } catch (e) {
    return false;
  }
}

/** 读房间数据；房间数据里还没有时退回本机降级副本。 */
export async function readInitiative() {
  try {
    const meta = await OBR.room.getMetadata();
    const raw = meta ? meta[KEY_INITIATIVE] : null;
    if (raw) return sortState(raw);
    /* 房间数据里还没有：可能是上一次写失败留在了本机，先把它显示出来（并等着下次写入搬回房间）。 */
    const stashed = readLocalFallback();
    if (stashed) { stashed.local = true; return stashed; }
    return normalizeInitiative(null);
  } catch (e) {
    console.error("[4enext] 读取先攻失败", e);
    const stashed = readLocalFallback();
    if (stashed) stashed.local = true;
    return stashed || normalizeInitiative(null);
  }
}

/**
 * 写房间数据（通常只有 GM 能成功）。
 * 成功 → 清掉本机降级副本；失败 → 暂存本机 + WARNING 通知，返回的状态带 .local = true
 * （调用方据此在窗口里提示「只记在本机」）。**不抛错**，免得按钮变成点了没反应。
 */
export async function writeInitiative(state) {
  const next = sortState(state);
  next.updatedAt = Date.now();
  try {
    await OBR.room.setMetadata({ [KEY_INITIATIVE]: next });
    clearLocalFallback();
    return next;
  } catch (e) {
    const err = e && e.message ? e.message : String(e);
    console.error("[4enext] 写先攻失败，已降级到本机", e);
    const ok = stashInitiative(next);
    try {
      notify("先攻没能写进房间数据（" + err + "）：" + (ok ? "已暂存在本机，只影响你这台机器" : "本机也存不下") +
        "。先攻最多 " + INIT_MAX_ENTRIES + " 条。", "WARNING");
    } catch (e2) { /* 忽略 */ }
    next.local = true;
    return next;
  }
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
 * token 附加信息（头像 / 血量条）：先攻条用，拿不到就退回名字首字
 * ------------------------------------------------------------------------- */

/** items → { <tokenId>: { img, hp: { cur, max } | null, name } }。 */
export function tokenInfoMap(items) {
  const map = {};
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || !it.id) continue;
    const img = it.image && typeof it.image.url === "string" ? it.image.url : "";
    let hp = null;
    const m = it.metadata ? it.metadata[KEY_HP] : null;
    if (m && typeof m === "object") {
      const cur = num(m.cur, null);
      const max = num(m.max, null);
      if (max !== null && max > 0 && cur !== null) hp = { cur: cur, max: max };
    }
    /* ownerId 用 token 上的**活值** createdUserId：GM 用「Give Ownership」改过归属后，
     * 存下来的 entry.ownerId 会过期，玩家就会丢「结束」按钮（规格 §5）。 */
    map[it.id] = { img: img, hp: hp, name: String(it.name || ""), ownerId: String(it.createdUserId || "") };
  }
  return map;
}

/* ---------------------------------------------------------------------------
 * 渲染：先攻条（v1.4.0，规格 §3.5 / §4）
 * ------------------------------------------------------------------------- */

function stripRollButtons(e, isGM, phase) {
  if (!isGM || (phase !== PHASE_PREPARING && phase !== PHASE_COMBAT)) return "";
  const t = esc(e.tokenId);
  const tip = esc("先攻 " + signed(e.bonus));
  return '<div class="roll-buttons">' +
    '<button class="roll-btn dis" data-roll="dis" data-token="' + t + '" title="劣势 2d20 取低 · ' + tip + '">−</button>' +
    '<button class="roll-btn normal" data-roll="normal" data-token="' + t + '" title="掷 d20 · ' + tip + '">d20</button>' +
    '<button class="roll-btn adv" data-roll="adv" data-token="' + t + '" title="优势 2d20 取高 · ' + tip + '">＋</button>' +
    "</div>";
}

function stripCard(e, st, opts) {
  const isGM = opts.role === "GM";
  const info = (opts.items || {})[e.tokenId] || null;
  const isActive = st.phase === PHASE_COMBAT && e.tokenId === st.activeId;
  const liveOwner = info && info.ownerId ? info.ownerId : "";
  const mine = !!(opts.playerId && (liveOwner ? liveOwner === opts.playerId : e.ownerId === opts.playerId));
  const cls = ["initiative-item"];
  if (isActive) cls.push("active");
  if (e.hidden) cls.push("is-invisible");
  if (mine) cls.push("is-mine");

  const preparing = st.phase === PHASE_PREPARING && (e.d20 === null || e.d20 === undefined);
  const total = preparing ? "—" : String(Math.round(num(e.init, 0)));
  const formula = (e.d20 === null || e.d20 === undefined)
    ? "(" + (preparing ? "?" : total) + ")"
    : "(" + Math.round(e.d20) + signed(e.bonus) + ")";

  const img = info && info.img
    ? '<img src="' + esc(info.img) + '" alt="" loading="lazy" draggable="false">'
    : '<span class="item-initial">' + esc(Array.from(e.name || "?")[0] || "?") + "</span>";

  let hpTrack = "";
  if (info && info.hp) {
    const ratio = clamp(info.hp.cur / info.hp.max, 0, 1);
    hpTrack = '<div class="item-hp-track"><div class="item-hp-fill" style="width:' +
      Math.round(ratio * 100) + '%"></div></div>';
  } else {
    /* v1.4.0 只留空槽（规格 §4）：token 上没有 hp 元数据时不画条，位置留给 v1.6 的血条。 */
    hpTrack = '<div class="item-hp-track slot"></div>';
  }

  const endBtn = (!isGM && isActive && st.phase === PHASE_COMBAT && mine)
    ? '<button class="end-turn-btn" data-strip-act="end" data-token="' + esc(e.tokenId) + '" title="结束自己的回合（请求发给城主客户端）">结束</button>'
    : "";

  const title = e.name + " · 先攻 " + (preparing ? "待掷" : total) + (e.hidden ? "（隐形）" : "");
  return '<div class="' + cls.join(" ") + '" data-token="' + esc(e.tokenId) + '" title="' + esc(title) + '">' +
    '<span class="item-mod" title="先攻加值">' + signed(e.bonus) + "</span>" +
    '<div class="item-img">' + img + "</div>" +
    hpTrack +
    '<div class="item-count"><b>' + total + '</b><small class="count-formula">' + formula + "</small></div>" +
    stripRollButtons(e, isGM, st.phase) +
    endBtn +
    "</div>";
}

function stripControls(st, opts) {
  const isGM = opts.role === "GM";
  const a = function (act, label, extraClass, title) {
    return '<button class="strip-btn' + (extraClass ? " " + extraClass : "") + '" data-strip-act="' + act +
      '" title="' + esc(title || label) + '">' + label + "</button>";
  };
  let left = "";
  if (isGM) {
    if (st.phase === PHASE_PREPARING) {
      left = a("start", "开始战斗", "primary", "把当前名单定下来，从排第一的开始") +
        a("cancel", "取消准备", "", "回到待命，名单保留");
    } else if (st.phase === PHASE_COMBAT) {
      left = a("prev", "‹", "", "上一回合") +
        a("next", "下一回合 ›", "primary", "推进到下一回合（绕回第一张时轮数 +1）") +
        a("end-combat", "结束战斗", "", "回到待命，名单保留，下次重新掷");
    } else {
      left = a("prepare", "战斗准备", "", "清空先攻点数，等大家掷骰") +
        a("surprise", "突袭", "", "4E 突袭轮：只有部分单位行动的那一轮") +
        a("start", "开始战斗", "primary", "直接开打（没掷过的自动掷 d20 + 加值）");
    }
  }
  const clearBtn = isGM
    ? a("clear", opts.confirmClear ? "再点一次清空" : "一键清空", "danger" + (opts.confirmClear ? " armed" : ""),
      "清空先攻名单（token 与角色卡都不受影响；要点两次）")
    : "";
  const status = esc(phaseLabel(st));
  const active = currentEntry(st);
  const who = active ? entryName(active, opts.role) : "";
  const right = '<span class="strip-status" title="' +
    esc(st.entries.length + " 个条目 · 上限 " + INIT_MAX_ENTRIES) + '">' + status +
    (who ? ' · <b>' + esc(who) + "</b>" : "") + "</span>" +
    '<button class="strip-btn icon" data-strip-act="list" title="打开列表窗口（管理 / 重掷 / 同步加值）">≡</button>' +
    '<button class="strip-btn icon" data-strip-act="collapse" title="折叠成小药丸">−</button>' +
    '<span class="strip-grip" data-strip-drag title="按住拖走先攻条">⠿</span>';
  return '<div class="strip-ctl">' +
    '<div class="sc-left">' + left + clearBtn + "</div>" +
    '<div class="sc-right">' + right + "</div>" +
    "</div>";
}

/**
 * 先攻条 HTML。
 * opts = { role, playerId, collapsed, confirmClear, items, offline }
 * 折叠态是 120×40 的小药丸（⚔ + 轮数徽标 + 拖动柄），展开态是控制行 + 横向卡片。
 */
export function renderStripHTML(state, opts) {
  opts = opts || {};
  const isGM = opts.role === "GM";
  const st = normalizeInitiative(state);
  const collapsed = !!opts.collapsed;

  if (collapsed) {
    return '<div class="strip collapsed phase-' + st.phase + (opts.offline ? " offline" : "") + '" id="strip">' +
      '<button class="strip-open" data-strip-act="expand" title="展开先攻条">⚔</button>' +
      '<span class="strip-badge">' + esc(phaseBadge(st)) + "</span>" +
      '<span class="strip-grip" data-strip-drag title="按住拖走先攻条">⠿</span>' +
      "</div>";
  }

  const rows = sortEntries(visibleEntries(st, isGM ? "GM" : "PLAYER"));
  const active = currentEntry(st);
  const veil = (!isGM && active && active.hidden)
    ? '<div class="initiative-item active veil" title="有隐形单位正在行动"><div class="item-veil">？？？</div></div>'
    : "";

  const cards = rows.map(function (e) { return stripCard(e, st, opts); }).join("");
  const empty = rows.length
    ? ""
    : '<div class="strip-empty">' + (isGM
      ? "右键地图上的 token →「加入先攻」，或直接点「开始战斗」。"
      : "城主还没有把任何人加入先攻。") + "</div>";

  return '<div class="strip expanded phase-' + st.phase + (opts.offline ? " offline" : "") + '" id="strip">' +
    stripControls(st, opts) +
    '<div class="strip-items">' + veil + cards + empty + "</div>" +
    "</div>";
}

/* ---------------------------------------------------------------------------
 * 渲染：列表（v1.3.x 的管理视图，v1.4.0 仍保留给「≡ 列表」窗口）
 * ------------------------------------------------------------------------- */

/** 先攻列表 HTML。opts = { role, playerId, backgroundReady, backgroundState, inWindow }。 */
export function renderInitiativeHTML(state, opts) {
  opts = opts || {};
  const role = opts.role === "GM" ? "GM" : "PLAYER";
  const isGM = role === "GM";
  const playerId = String(opts.playerId || "");
  const st = normalizeInitiative(state);
  const rows = sortEntries(visibleEntries(st, role));
  const active = currentEntry(st);
  const activeName = active ? entryName(active, role) : "";
  const canEnd = canEndTurn(st, playerId);

  const status = !st.entries.length
    ? "还没有人加入先攻"
    : "当前：" + (activeName || "—") + (active && active.hidden && isGM ? "（隐形）" : "");

  /* data-bg-soft：GM 的回合操作由本页直接写房间数据，不依赖后台脚本 —— 后台离线时只弱化外观；
     data-bg：玩家的「结束我的回合」必须后台在线（请求由城主客户端的后台落笔），离线时真 disabled。
     见 assets/window.js 的 markElement()。 */
  const gmButtons = isGM
    ? '<button class="btn small" data-bg-soft data-init-act="prev" title="回到上一回合">‹ 上一回合</button>' +
      '<button class="btn small primary" data-bg-soft data-init-act="next" title="推进到下一回合">下一回合 ›</button>' +
      '<button class="btn small" data-bg-soft data-init-act="roll-all" title="让所有人重新掷 d20 + 先攻加值">重掷全部</button>' +
      '<button class="btn small" data-bg-soft data-init-act="sync" title="按绑定角色卡重新同步先攻加值">同步加值</button>' +
      '<button class="btn small danger" data-bg-soft data-init-act="clear" title="清空先攻（不影响 token 与角色卡）">清空</button>'
    : '<button class="btn small primary" data-bg data-init-act="end"' + (canEnd ? "" : " disabled") +
      ' title="' + (canEnd ? "结束自己的回合，交给城主推进" : "现在不是你的回合") + '">结束我的回合</button>';

  const rowsHtml = rows.length ? rows.map(function (e, i) {
    const on = e.tokenId === st.activeId ? " on" : "";
    const hid = e.hidden ? " hidden" : "";
    const owner = e.ownerId && e.ownerId === playerId ? '<em class="init-mine">我的</em>' : "";
    const badge = e.hidden ? '<em class="init-badge">隐形</em>' : "";
    const cur = on ? '<em class="init-cur">当前</em>' : "";
    const total = Math.round(num(e.init, 0));
    const acts = isGM
      ? '<button class="init-act" data-init-act="roll" data-token="' + esc(e.tokenId) + '" title="掷先攻：d20 ' + signed(e.bonus) + '">🎲</button>' +
        '<button class="init-act" data-init-act="up" data-token="' + esc(e.tokenId) + '" title="上移">↑</button>' +
        '<button class="init-act" data-init-act="down" data-token="' + esc(e.tokenId) + '" title="下移">↓</button>' +
        '<button class="init-act" data-init-act="active" data-token="' + esc(e.tokenId) + '" title="设为当前回合">◎</button>' +
        '<button class="init-act danger" data-init-act="remove" data-token="' + esc(e.tokenId) + '" title="从先攻里移除">✕</button>'
      : "";
    return '<div class="init-row' + on + hid + '" data-token="' + esc(e.tokenId) + '">' +
      '<span class="init-idx">' + (i + 1) + "</span>" +
      '<span class="init-name">' + esc(e.name) + badge + owner + cur + "</span>" +
      '<span class="init-bonus" title="先攻加值">' + signed(e.bonus) + "</span>" +
      '<span class="init-total" title="先攻合计">' + total + "</span>" +
      '<span class="init-acts">' + acts + "</span></div>";
  }).join("") : '<div class="init-empty">' +
    (isGM
      ? "还没有人加入先攻。<br>右键地图上的 token →「加入先攻」或「隐形加入先攻」。"
      : "城主还没有把任何人加入先攻。") +
    "</div>";

  /* 三态：checking（面板刚打开、还在 ping）不吓人；只有确认没回音才显示红字。 */
  const hint = opts.backgroundState === "checking"
    ? '<p class="init-hint">正在确认后台脚本…（右键加入先攻、玩家结束回合都要靠它，通常 1~2 秒）</p>'
    : !opts.backgroundReady
    ? '<p class="init-warn">后台脚本没有响应：右键加入先攻、玩家结束回合都要靠它。请把扩展关掉再打开一次。</p>'
    : (isGM
      ? '<p class="init-hint">先攻条在屏幕顶部（工具栏「先攻」打开）：战斗准备 / 突袭 / 一键清空 + 卡片拖拽排序。<br>' +
        "先攻加值来自绑定角色卡的「先攻」（如 +25），绑定 / 重新导入后可在本页点「同步加值」刷新。隐形条目只有 GM 看得到。</p>"
      : '<p class="init-hint">你只能看到公开条目。轮到你时在先攻条的卡片上点「结束」，由城主客户端推进。</p>');

  /* inWindow：v1.3.1 的独立窗口已经有标题栏写「先攻」，内容区不再重复一个大标题。 */
  const titleHtml = opts.inWindow ? "" : '<div class="init-title">先攻</div>';
  const badgeText = st.phase === PHASE_COMBAT
    ? (st.surprise ? "突袭轮" : "第 " + st.round + " 轮")
    : st.phase === PHASE_PREPARING ? "准备中" : "待命";

  return '<div class="init-wrap">' +
    '<div class="init-head">' +
    '<div>' + titleHtml + '<div class="init-status">' + esc(status) + "</div></div>" +
    '<span class="init-round">' + esc(badgeText) + "</span>" +
    '<div class="init-actions">' + gmButtons + "</div>" +
    "</div>" +
    '<div class="init-list-head"><span>#</span><span>名字</span><span>加值</span><span>合计</span><span></span></div>' +
    '<div class="init-list">' + rowsHtml + "</div>" +
    hint +
    "</div>";
}
