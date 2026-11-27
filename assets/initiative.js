// 先攻（v1.4.0，v2.5 改存储）：数据模型、先攻条渲染、掷先攻、回合推进、拖拽排序。
// ---------------------------------------------------------------------------
// v2.5 起数据**不再是房间/场景一份整名单**，而是照 Full Suite 的做法：
//   · 每个 IMAGE token 的 metadata["com.4enext-owlbear/init"] = 一条先攻条目
//       { v:2, d20:number|null, bonus:number, init:number, tb:number|null,
//         hidden:boolean, ownerId:string, updatedAt:number }
//     （init = 合计；拖拽排序会写小数中点，所以必须原样落盘，不改成读时 d20+bonus）
//   · 战斗态 scene.metadata["com.4enext-owlbear/combat"] =
//       { v:1, phase, round, surprise, activeId, updatedAt, migratedAt? }
//   · 旧键 room/scene metadata["com.4enext-owlbear/initiative"]（v1.3 ~ v2.4 的整份名单）
//     只在迁移前**只读回退**；GM 首次启动 / 首次读先攻时迁移到 token metadata 后清空，
//     迁移前整份旧数据备份到 localStorage["4enext/init-backup/<roomId>"]。
//
// 内部 state 形状不变（{phase,round,surprise,activeId,entries[]}），渲染 / 操作逻辑一行不改。
// v1.4.0 在 v1.3.0 的结构上**只新增字段**，键名一个都没改：
//   · phase    "idle" | "preparing" | "combat"（缺省 idle —— 旧数据照旧能读，不报错）
//   · surprise 突袭轮标记（4E 的 surprise round，在正常第 1 轮之前）
//   · d20      原始点数，只用于卡片底部公式行 (12+25)；旧数据没有就退回 (37)
//   · tb       同分排序用的稳定随机数（genTiebreak），加值越高越靠前
//   · init     = d20 + bonus（掷的时候一次算好，**不要**改成显示时相加，否则旧数据全错位）
//   init 可以是小数：拖拽排序写「两卡中点」，显示一律 Math.round（规格 §4 / §7.3）。
//
// 条目上限 40（v1.8.0：60 → 40；v2.5 起 per-token 存储不再受房间 16 KB 约束，
// 但内部结构与 Full Suite 的口径保持 40 条上限，normalizeInitiative 里截断，不抛错）。
// writeInitiative 差异写 token / scene metadata；完全写不进时降级到本机
// localStorage["4enext/state/initiative"] 并弹 WARNING / ERROR（不允许静默）。
//
// 权限：
//   · GM：加入 / 隐形加入 / 掷先攻 / 拖拽排序 / 上下移动 / 设为当前 / 删除 / 清空 /
//         战斗准备 / 开始战斗 / 突袭 / 结束战斗 / 上一回合 / 下一回合（写所有 token + scene）；
//   · 玩家：只看到公开条目，「结束我的回合」不写 scene（broadcast 请求 GM 推进）；
//     玩家可以**直接写自己创建的 token**（加值 / 掷骰 / 加入先攻），scene 写不进时走现有请求通道；
//   · 隐形的条目对非 GM 完全不渲染，连名字都不发到 DOM（当前回合只显示「？？？」）。
//
// v1.7.3：① 卡片右上角加「✕」（GM 直接把人从先攻里移出，见 stripCard / 页面 onStripAct("remove")）；
//   ② 新增 missingEntryIds / pruneMissingEntries：token 被删掉后条目不跟随（元数据在 token 上），
//      后台按「见过 → 消失」校正当前回合指针（与 removeEntry 同一套规则）；
//   ③ 先攻条外壳透明 / 常驻是 CSS 与 background.core.js 的事，数据层不变。
//
// 本模块是 ESM，只在窗口页加载；background.core.js 是经典脚本，不能 import，
// 它有一份只服务于「右键加入先攻 / 响应玩家结束回合 / 打开先攻条 / 启动迁移」的精简实现，
// 常量与排序 / 回合推进公式由 dev/check.mjs 与 dev/test-initiative.mjs 对齐。

import OBR from "../vendor/obr-sdk.js";
import {
  INIT_META_V, KEY_BIND, KEY_COMBAT, KEY_INIT, KEY_INITIATIVE, NS, diceHistoryRoomId, esc, findCard, getCards, notify
} from "./common.js";
import { initiativeBonus } from "./glance.js";

/** 战斗态元数据版本（scene.metadata[KEY_COMBAT].v）。 */
export const COMBAT_META_V = 1;
/** 旧名单迁移前的本机备份键前缀：4enext/init-backup/<roomId>。 */
export const LS_INIT_BACKUP_PREFIX = "4enext/init-backup/";

/** 条目上限：内部结构上限 40（v1.8.0：60 → 40）。v2.5 起存储不再受房间 16 KB 约束，保留上限只为口径一致。 */
export const INIT_MAX_ENTRIES = 40;
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
/* v1.7.10：展开高度按**内容**算（用户截图：卡片下半截被裁掉）——
 * 控制行 36 + 卡片 80（当前回合 100）+ 卡片下方掷骰按钮行 24（上移 8 → 露出 16）+ 上下 padding 16。
 * 三档都 ≥ 170：idle 170 / preparing 180 / combat 200（当前回合卡多 20 高）。 */
export const STRIP_H_IDLE = 170;
export const STRIP_H_PREPARING = 180;
export const STRIP_H_COMBAT = 200;
export const STRIP_TOP_OFFSET = 45;
export const STRIP_SIDE_MARGIN = 16;
/* 卡片尺寸（规格 §3.5，ui.css 里必须一致） */
export const STRIP_CARD_W = 56;
export const STRIP_CARD_H = 80;
export const STRIP_CARD_ACTIVE_H = 100;

/** 本机降级键：token / 场景 metadata 写不进去时先记在这（settings 页的 4enext/state/* 白名单内）。 */
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

/** 先攻条高度：按战斗状态三档（v1.7.10 起 170 / 180 / 200，保证卡片与掷骰按钮不被裁切）。 */
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
 * 下限 410；高度按 phase 三档（170 / 180 / 200，v1.7.10 加高）。
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
      d20: d20raw === null ? null : clamp(Math.round(d20raw), 0, 99),
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

/**
 * v1.7.3：名单里 tokenId 已经不在 alive 里的那些（alive 是 id 数组或 { id: true } 这样的 map）。
 * 用法：token 被删掉后先算出缺哪些，再交给 pruneMissingEntries 一次清掉。
 */
export function missingEntryIds(state, alive) {
  const has = Object.create(null);
  if (Array.isArray(alive)) {
    for (const id of alive) has[String(id)] = true;
  } else if (alive && typeof alive === "object") {
    for (const k of Object.keys(alive)) if (alive[k]) has[String(k)] = true;
  }
  const st = normalizeInitiative(state);
  return st.entries.filter((e) => !has[e.tokenId]).map((e) => e.tokenId);
}

/**
 * v1.7.3：把「token 已经没了」的条目一次清掉（逐条走 removeEntry，游标自然顺移）：
 * 删掉当前回合那张 → 指向原位置的下一条（没有下一条就指最后一条），
 * 删空 → activeId = ""、round 回到 1。token 还在的条目一个字都不动。
 */
export function pruneMissingEntries(state, alive) {
  let out = normalizeInitiative(state);
  const missing = missingEntryIds(out, alive);
  for (const id of missing) out = removeEntry(out, id);
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

/* ---------------------------------------------------------------------------
 * 加值 / 加入 / 重掷
 * ------------------------------------------------------------------------- */

/** 从 token 上取加值：优先 init 元数据（v2 条目 / 旧版加值缓存都行），其次按绑定卡现算，都没有就 +0。
 *  v2.5 兼容：v1.2 时代 token 上的 init 是**一个数字**（加值），按加值读，不报错。 */
export function bonusOfItem(item, cards) {
  const m = item && item.metadata ? item.metadata[KEY_INIT] : null;
  if (typeof m === "number" && isFinite(m)) return clamp(Math.round(m), INIT_MIN, INIT_MAX);
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

/**
 * v1.7.10：谁能改这条的先攻加值 —— GM 任意；玩家只能改**自己 token** 的条目。
 * 归属优先用 token 上的活值（itemsMap[tokenId].ownerId，GM 用 Give Ownership 改过也跟得上），
 * 拿不到时退回条目里存的 ownerId。
 */
export function canEditBonus(entry, opts) {
  if (!entry) return false;
  opts = opts || {};
  if (opts.role === "GM") return true;
  const pid = String(opts.playerId || "");
  if (!pid) return false;
  const info = (opts.items || {})[entry.tokenId] || null;
  const owner = info && info.ownerId ? String(info.ownerId) : String(entry.ownerId || "");
  return owner === pid;
}

/**
 * v1.7.10：改一条的先攻加值（卡片左上角的输入框与状态行的「加值」共用这一个函数）。
 *   · 合计 = d20 + 加值（已经掷过的条目立刻重算；没掷过的保持 init，只影响下次掷）；
 *   · 改完按「合计 DESC → tiebreak ASC」重排（与拖拽 / 重掷同一套）；
 *   · 加值范围与 normalizeInitiative 一致（-99 … 999），不抛错。
 */
export function setEntryBonus(state, tokenId, bonus) {
  const out = normalizeInitiative(clone(state));
  const e = out.entries.filter((x) => x.tokenId === tokenId)[0];
  if (!e) return out;
  const b = clamp(n(bonus, 0), INIT_MIN, INIT_MAX);
  if (b === e.bonus) return out;
  e.bonus = b;
  if (e.d20 !== null && e.d20 !== undefined) e.init = clamp(e.d20 + b, INIT_MIN, INIT_MAX);
  e.updatedAt = Date.now();
  out.entries = sortEntries(out.entries);
  out.updatedAt = Date.now();
  return out;
}

/**
 * v1.8.2：直接改「掷出的点数（d20）」——用户要手填点数，保持左上角加值不变，
 * 合计自动 = d20 + 加值，并按「合计 DESC → tiebreak ASC」重排（与 setEntryBonus 同一套）。
 * 范围 0~99（与 normalizeInitiative 同一口径；正常投骰仍是 1~20）。
 */
export function setEntryRoll(state, tokenId, d20) {
  const out = normalizeInitiative(clone(state));
  const e = out.entries.filter((x) => x.tokenId === tokenId)[0];
  if (!e) return out;
  const roll = clamp(Math.round(num(d20, 0)), 0, 99);
  if (roll === e.d20) return out;
  e.d20 = roll;
  e.init = clamp(roll + n(e.bonus, 0), INIT_MIN, INIT_MAX);
  e.updatedAt = Date.now();
  out.entries = sortEntries(out.entries);
  out.updatedAt = Date.now();
  return out;
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
      d20: entry.d20 === null || entry.d20 === undefined ? null : clamp(n(entry.d20, 0), 0, 99),
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
 * token / scene 存储层（v2.5：照 Full Suite 的 per-token 做法）
 * -------------------------------------------------------------------------
 * 内部 state 形状**完全不变**（{phase,round,surprise,activeId,entries[]}），只换落盘位置：
 *   · 每个 IMAGE token 的 metadata[KEY_INIT] = 一条先攻条目
 *       { v:2, d20:number|null, bonus:number, init:number, tb:number|null, hidden:boolean, ownerId:string, updatedAt:number }
 *     `init` 是合计（正常掷骰 = d20+bonus；拖拽排序写的是两张卡的中点，必须原样落盘，
 *     否则一刷新顺序就回退 —— 这是它和 Full Suite 只存原始 d20 的唯一差别）。
 *   · 战斗态 scene.metadata[KEY_COMBAT] = { v:1, phase, round, surprise, activeId, updatedAt, migratedAt? }
 *     —— 全桌共享；GM 写，玩家写不进时回合推进仍走现有 CH_INIT_REQUEST（不静默失败）。
 *   · 旧版「房间/场景整份名单」KEY_INITIATIVE 只在**迁移前**只读回退：没有任何 token 带 v2 时用它。
 * 迁移（GM 首次启动 / 首次读先攻）：旧 entries 逐条写进 token metadata + 写 combat + 本机备份后清旧键；
 * 见 migrateLegacyInitiative()。失败保留旧数据并 WARNING（不静默）。
 * 权限：GM 写所有 token + scene；玩家写自己创建的 token（OBR 允许），diff 写只碰本页真正变了的 token。
 * ------------------------------------------------------------------------- */

/** 旧「整份名单」清空后写的空状态（用于迁移成功后清房间/场景旧键；键名不变，旧客户端读到空名单不报错）。 */
function emptyLegacyInitiative() {
  return { v: 1, updatedAt: Date.now(), phase: PHASE_IDLE, round: 1, surprise: false, activeId: "", entries: [] };
}

/** 本机备份键：迁移前把旧房间/场景名单整份存在这台机器上（只写一次，保留第一份最完整的）。 */
export function initBackupKey() {
  return LS_INIT_BACKUP_PREFIX + diceHistoryRoomId();
}

/** 内部 entry → token metadata（v2）。 */
export function initMetaFromEntry(entry, updatedAt) {
  return {
    v: INIT_META_V,
    d20: entry.d20 === null || entry.d20 === undefined ? null : clamp(n(entry.d20, 0), 0, 99),
    bonus: clamp(n(entry.bonus, 0), INIT_MIN, INIT_MAX),
    init: clamp(num(entry.init, 0), INIT_MIN, INIT_MAX),
    tb: entry.tb === null || entry.tb === undefined ? null : clamp(num(entry.tb, 0.5), 0.001, 0.999),
    hidden: !!entry.hidden,
    ownerId: String(entry.ownerId == null ? "" : entry.ownerId),
    updatedAt: n(updatedAt, Date.now())
  };
}

/** 这个 metadata 是不是 v2 先攻条目（旧版数字 / {bonus,cardId} 都不算，不会被当成名单成员）。 */
export function isInitMeta(m) {
  return !!m && typeof m === "object" && m.v === INIT_META_V;
}

/** token metadata（v2）→ 内部 entry。名字 / owner 用 token 的**活值**（GM 用 Give Ownership 改过也跟得上）。 */
function entryFromInitMeta(item, meta) {
  const bonus = clamp(n(meta.bonus, 0), INIT_MIN, INIT_MAX);
  const d20raw = num(meta.d20, null);
  const d20 = d20raw === null ? null : clamp(Math.round(d20raw), 0, 99);
  const initRaw = num(meta.init, null);
  const init = initRaw === null ? clamp((d20 === null ? 0 : d20) + bonus, INIT_MIN, INIT_MAX) : clamp(initRaw, INIT_MIN, INIT_MAX);
  const tbraw = num(meta.tb, null);
  return {
    tokenId: String(item && item.id ? item.id : ""),
    name: String((item && item.name) || "未命名").trim().slice(0, INIT_NAME_MAX) || "未命名",
    init: init,
    bonus: bonus,
    d20: d20,
    tb: tbraw === null ? null : clamp(tbraw, 0.001, 0.999),
    hidden: !!meta.hidden,
    ownerId: String((item && item.createdUserId) || meta.ownerId || ""),
    updatedAt: n(meta.updatedAt, 0)
  };
}

/** 场景 items → 条目数组（只认 IMAGE + v2 元数据），按现有 sortEntries 排序、上限 40。 */
export function entriesFromItems(items) {
  const out = [];
  const seen = Object.create(null);
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || it.type !== "IMAGE" || !it.id) continue;
    if (seen[it.id]) continue;
    const m = it.metadata ? it.metadata[KEY_INIT] : null;
    if (!isInitMeta(m)) continue;
    seen[it.id] = true;
    out.push(entryFromInitMeta(it, m));
  }
  return sortEntries(out).slice(0, INIT_MAX_ENTRIES);
}

/** 战斗态归一化（缺字段按 idle / 第 1 轮；surprise 只在 combat 阶段有意义）。 */
export function combatFromRaw(raw) {
  const phase = normalizePhase(raw && raw.phase);
  return {
    v: COMBAT_META_V,
    phase: phase,
    round: Math.max(1, n(raw && raw.round, 1)),
    surprise: phase === PHASE_COMBAT ? !!(raw && raw.surprise) : false,
    activeId: String(raw && raw.activeId ? raw.activeId : ""),
    updatedAt: n(raw && raw.updatedAt, 0),
    migratedAt: n(raw && raw.migratedAt, 0)
  };
}

/** 读场景战斗态（scene metadata[KEY_COMBAT]）；读不到 → 默认 idle / 第 1 轮。 */
export async function readCombatState() {
  try {
    let scene = {};
    try { scene = (await OBR.scene.getMetadata()) || {}; } catch (eS) { scene = {}; }
    return combatFromRaw(scene ? scene[KEY_COMBAT] : null);
  } catch (e) {
    return combatFromRaw(null);
  }
}

/** 迁移前过渡读取：旧版「房间/场景整份名单」（按 updatedAt 取新；没有 entries 视为没有）。 */
async function readLegacyInitiative() {
  let room = {}, scene = {};
  try { room = (await OBR.room.getMetadata()) || {}; } catch (eR) { room = {}; }
  try { scene = (await OBR.scene.getMetadata()) || {}; } catch (eS) { scene = {}; }
  const rawRoom = room ? room[KEY_INITIATIVE] : null;
  const rawScene = scene ? scene[KEY_INITIATIVE] : null;
  const atR = rawRoom && typeof rawRoom.updatedAt === "number" ? rawRoom.updatedAt : -1;
  const atS = rawScene && typeof rawScene.updatedAt === "number" ? rawScene.updatedAt : -1;
  const raw = atS > atR ? rawScene : rawRoom;
  if (!raw || !Array.isArray(raw.entries) || !raw.entries.length) return null;
  return { raw: raw, room: rawRoom, scene: rawScene };
}

/** token 元数据 + 场景战斗态 → 内部 state（activeId 失效由 normalizeInitiative 回退第一张）。 */
function stateFromStorage(entries, combat) {
  const st = normalizeInitiative({
    v: 1,
    updatedAt: combat.updatedAt,
    phase: combat.phase,
    round: combat.round,
    surprise: combat.surprise,
    activeId: combat.activeId,
    entries: entries
  });
  st.entries = sortEntries(st.entries);
  return st;
}

/** 迁移前过渡：旧整份名单 + 场景战斗态（若写过）。只读展示，任何写入都会按新存储落盘。 */
function stateFromLegacy(raw, combat) {
  const merged = Object.assign({}, raw);
  if (combatHasData(combat)) {
    merged.phase = combat.phase;
    merged.round = combat.round;
    merged.surprise = combat.surprise;
    if (combat.activeId) merged.activeId = combat.activeId;
    if (n(combat.updatedAt, 0) > n(raw.updatedAt, 0)) merged.updatedAt = combat.updatedAt;
  }
  const st = normalizeInitiative(merged);
  st.entries = sortEntries(st.entries);
  st.legacy = true;
  return st;
}

function combatHasData(c) {
  return !!(c && (c.migratedAt > 0 || c.updatedAt > 0 || c.activeId || c.phase !== PHASE_IDLE || c.round > 1 || c.surprise));
}

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

/** 把状态暂存到本机（新存储完全写不进去时的兜底）。返回是否成功。 */
export function stashInitiative(state) {
  try {
    const st = sortState(state);
    localStorage.setItem(LS_INIT_FALLBACK, JSON.stringify({ v: 1, updatedAt: Date.now(), state: st }));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 读先攻（v2.5）。
 *   ① 聚合所有 IMAGE token 的 v2 init 元数据 → entries；战斗态读 scene metadata[KEY_COMBAT]；
 *   ② 一条 v2 都没有时才回退读旧房间/场景整份名单（只读过渡，供迁移前 / 迁移失败的场合）；
 *   ③ 再没有就退回本机降级副本（.local = true），最后才是空 idle。
 * GM 在这里顺手做一次迁移（幂等；后台 boot 也会做）。
 */
export async function readInitiative() {
  try {
    let items = [];
    try { items = await OBR.scene.items.getItems(); } catch (eItems) { items = []; }
    let entries = entriesFromItems(items);
    let combat = await readCombatState();
    if (!entries.length) {
      const legacy = await readLegacyInitiative();
      if (legacy) {
        let role = "";
        try { role = await OBR.player.getRole(); } catch (eRole) { role = ""; }
        if (role === "GM" && !combat.migratedAt) {
          const mig = await migrateLegacyInitiative(legacy.raw, { room: legacy.room, scene: legacy.scene, items: items, combat: combat });
          if (mig && mig.ok) {
            try { items = await OBR.scene.items.getItems(); } catch (e2) { items = []; }
            entries = entriesFromItems(items);
            combat = await readCombatState();
          }
        }
        if (!entries.length) return stateFromLegacy(legacy.raw, combat);
      }
      /* 新存储里没有名单：可能是上一次写失败留在了本机，先把它显示出来（等下次写入成功再并回）。 */
      const stashed = readLocalFallback();
      if (stashed) { stashed.local = true; return stashed; }
      return stateFromStorage([], combat);
    }
    return stateFromStorage(entries, combat);
  } catch (e) {
    console.error("[4enext] 读取先攻失败", e);
    const stashed = readLocalFallback();
    if (stashed) stashed.local = true;
    return stashed || stateFromStorage([], combatFromRaw(null));
  }
}

function errMsg(e) {
  return e && e.message ? e.message : String(e);
}

function sameNullable(a, b) {
  const na = a === null || a === undefined ? null : a;
  const nb = b === null || b === undefined ? null : b;
  return na === nb;
}

/** 元数据是否与目标一致（忽略 updatedAt —— 不能每次写都刷新全部 token）。 */
function initMetaEqual(cur, want) {
  if (!isInitMeta(cur)) return false;
  return sameNullable(cur.d20, want.d20) && n(cur.bonus, 0) === n(want.bonus, 0) &&
    num(cur.init, 0) === num(want.init, 0) && sameNullable(cur.tb, want.tb) &&
    !!cur.hidden === !!want.hidden && String(cur.ownerId || "") === String(want.ownerId || "");
}

function combatEqual(cur, want) {
  return cur.phase === want.phase && n(cur.round, 1) === n(want.round, 1) &&
    !!cur.surprise === !!want.surprise && String(cur.activeId || "") === String(want.activeId || "");
}

/**
 * 一次差异写：只 update 真正变了的 token、删掉已移出名单的 token 元数据、combat 变了才写 scene。
 * 两客户端同时改不同 token 时各写各的（这是 per-token 存储的主要收益）；同一 token 并发仍是后写覆盖。
 */
async function persistInitiativeOnce(next, items) {
  const byId = Object.create(null);
  for (const it of Array.isArray(items) ? items : []) {
    if (it && it.id && it.type === "IMAGE") byId[String(it.id)] = it;
  }
  const want = Object.create(null);
  for (const e of next.entries) {
    if (!e || !e.tokenId || !byId[e.tokenId]) continue; /* token 不在当前场景（旧名单过渡 / 换场景）：没法写 */
    want[e.tokenId] = initMetaFromEntry(e, next.updatedAt);
  }
  const upserts = [];
  for (const id of Object.keys(want)) {
    const cur = byId[id].metadata ? byId[id].metadata[KEY_INIT] : null;
    if (!initMetaEqual(cur, want[id])) upserts.push(id);
  }
  const deletes = [];
  for (const id of Object.keys(byId)) {
    const cur = byId[id].metadata ? byId[id].metadata[KEY_INIT] : null;
    if (isInitMeta(cur) && !want[id]) deletes.push(id);
  }
  let entriesOk = true, tokenError = null;
  const changed = upserts.concat(deletes);
  if (changed.length) {
    try {
      await OBR.scene.items.updateItems(changed, function (drafts) {
        for (const d of drafts) {
          if (!d || !d.id) continue;
          if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
          const id = String(d.id);
          if (want[id]) d.metadata[KEY_INIT] = want[id];
          else delete d.metadata[KEY_INIT];
        }
      });
    } catch (eTok) {
      entriesOk = false;
      tokenError = eTok;
    }
  }
  /* 战斗态：只在 phase / round / surprise / activeId 真的变了才写 scene。
     玩家改自己加值时不会碰 scene —— 也就不会因为「玩家没有场景写权限」误报失败。 */
  const curCombat = await readCombatState();
  const nextCombat = {
    v: COMBAT_META_V,
    phase: next.phase,
    round: next.round,
    surprise: next.surprise,
    activeId: next.activeId,
    updatedAt: next.updatedAt,
    migratedAt: curCombat.migratedAt
  };
  let combatOk = true, combatError = null;
  if (!combatEqual(curCombat, nextCombat)) {
    try {
      await OBR.scene.setMetadata({ [KEY_COMBAT]: nextCombat });
    } catch (eCombat) {
      combatOk = false;
      combatError = eCombat;
    }
  }
  return {
    entriesOk: entriesOk,
    combatOk: combatOk,
    tokenError: tokenError,
    combatError: combatError,
    wrote: changed.length,
    skipped: next.entries.length - Object.keys(want).length
  };
}

/**
 * 写先攻（v2.5：差异写 token metadata + 场景 combat）。
 * 成功 → 清掉本机降级副本；token 元数据一条都写不进 → 暂存本机 + **ERROR** 通知，返回状态带 .local = true
 * （调用方据此提示「只记在本机」）。**不抛错**，免得按钮点了没反应。
 * GM：写所有 token + scene；玩家：只写自己创建的 token（diff 写只会碰真正变化的 token）。
 * 场景 combat 写不进但 token 写成功：名单已共享，只 WARNING（GM）—— 读取端 activeId 失效会回退第一张。
 */
export async function writeInitiative(state) {
  const next = sortState(state);
  next.updatedAt = Date.now();
  let role = "";
  try { role = await OBR.player.getRole(); } catch (eRole) { role = ""; }
  let items = null;
  try { items = await OBR.scene.items.getItems(); } catch (eItems) { items = null; }
  let res = items ? await persistInitiativeOnce(next, items) : null;
  if (res && !res.entriesOk) {
    /* 并发：token 刚好被删 / 换场景 → 重读一次再写；仍失败才降级本机。 */
    try { items = await OBR.scene.items.getItems(); } catch (eItems2) { items = null; }
    if (items) res = await persistInitiativeOnce(next, items);
  }
  if (res && res.entriesOk) {
    clearLocalFallback();
    if (!res.combatOk && role === "GM") {
      notify("先攻条目已保存，但战斗状态（场景数据）没写进去：" + errMsg(res.combatError) +
        "。回合指针可能不同步，请检查场景写权限", "WARNING");
    }
    if (res.skipped > 0) {
      console.warn("[4enext] 先攻写入：有 " + res.skipped + " 条旧名单条目的 token 不在当前场景，没有落盘（迁移前过渡）");
    }
    return next;
  }
  const err = res && res.tokenError ? errMsg(res.tokenError) : "场景 items 读不到";
  console.error("[4enext] 写先攻失败，已降级到本机", err);
  const ok = stashInitiative(next);
  try {
    notify("先攻没能写进 token / 场景数据（" + err + "）：" + (ok ? "已暂存在本机，只影响你这台机器" : "本机也存不下") +
      (role === "GM" ? "" : "；只有城主能改别人的 token") + "。", "ERROR");
  } catch (e2) { /* 忽略 */ }
  next.local = true;
  return next;
}

/* ---------------------------------------------------------------------------
 * 迁移：旧「房间/场景整份名单」→ 每 token 一条 + scene combat（v2.5，只做一次）
 * ------------------------------------------------------------------------- */

function backupLegacyOnce(roomRaw, sceneRaw) {
  try {
    const key = initBackupKey();
    if (localStorage.getItem(key)) return true; /* 第一次那份最完整，别被后续覆盖 */
    localStorage.setItem(key, JSON.stringify({ v: 1, at: Date.now(), room: roomRaw || null, scene: sceneRaw || null }));
    return true;
  } catch (e) {
    console.error("[4enext] 备份旧先攻名单失败（不影响迁移）", e);
    return false;
  }
}

/**
 * 把旧整份名单迁到 token metadata / 场景 combat，并在 localStorage 备份后清空旧房间 / 场景键。
 * 幂等：只 GM 执行；已迁移（combat.migratedAt）或旧名单为空时直接 skipped。失败**保留旧数据**并 WARNING。
 * 返回 { ok, migrated, skipped, reason }。
 */
export async function migrateLegacyInitiative(rawArg, opts) {
  opts = opts || {};
  let raw = rawArg || null;
  let roomRaw = opts.room || null;
  let sceneRaw = opts.scene || null;
  if (!raw) {
    const found = await readLegacyInitiative();
    if (!found) return { ok: false, skipped: true, migrated: 0, reason: "empty" };
    raw = found.raw;
    roomRaw = found.room;
    sceneRaw = found.scene;
  }
  let role = "";
  try { role = await OBR.player.getRole(); } catch (eRole) { role = ""; }
  if (role !== "GM") return { ok: false, skipped: true, migrated: 0, reason: "role" };
  const legacyState = normalizeInitiative(raw);
  if (!legacyState.entries.length) return { ok: false, skipped: true, migrated: 0, reason: "empty" };
  let items = opts.items;
  if (!items) {
    try { items = await OBR.scene.items.getItems(); } catch (eItems) { items = []; }
  }
  const byId = Object.create(null);
  for (const it of Array.isArray(items) ? items : []) {
    if (it && it.type === "IMAGE" && it.id) byId[String(it.id)] = it;
  }
  backupLegacyOnce(roomRaw, sceneRaw);
  const want = Object.create(null);
  let skipped = 0;
  const stamp = legacyState.updatedAt > 0 ? legacyState.updatedAt : Date.now();
  for (const e of legacyState.entries) {
    if (!byId[e.tokenId]) { skipped++; continue; } /* 那枚 token 不在当前场景：留在本机备份里 */
    want[e.tokenId] = initMetaFromEntry(e, stamp);
  }
  const ids = Object.keys(want);
  if (!ids.length) {
    notify("先攻数据迁移：旧名单里的 token 都不在当前场景，已备份到本机（" + initBackupKey() + "），旧名单保留", "WARNING");
    return { ok: false, migrated: 0, skipped: skipped, reason: "no-token" };
  }
  try {
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (const d of drafts) {
        if (!d || !d.id) continue;
        const meta = want[String(d.id)];
        if (!meta) continue;
        if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
        d.metadata[KEY_INIT] = meta;
      }
    });
  } catch (eTok) {
    notify("先攻数据迁移失败（token 元数据写不进去，旧名单保留未动）：" + errMsg(eTok), "WARNING");
    return { ok: false, migrated: 0, skipped: skipped, reason: "token-write", error: eTok };
  }
  const migratedAt = Date.now();
  try {
    await OBR.scene.setMetadata({
      [KEY_COMBAT]: {
        v: COMBAT_META_V,
        phase: legacyState.phase,
        round: legacyState.round,
        surprise: legacyState.surprise,
        activeId: legacyState.activeId,
        updatedAt: migratedAt,
        migratedAt: migratedAt
      }
    });
  } catch (eCombat) {
    /* token 已写进去，但战斗态没写成：不清旧名单，下次启动重试（migratedAt 也没写） */
    notify("先攻数据迁移失败（场景战斗状态写不进去，旧名单保留未动）：" + errMsg(eCombat), "WARNING");
    return { ok: false, migrated: ids.length, skipped: skipped, reason: "combat-write", error: eCombat };
  }
  /* 迁移成功 → 旧房间 / 场景名单清成空（已备份；清空失败只提示，下次启动再试）。 */
  let cleared = true;
  try {
    await OBR.room.setMetadata({ [KEY_INITIATIVE]: emptyLegacyInitiative() });
  } catch (eClear) {
    cleared = false;
    console.warn("[4enext] 清理旧房间先攻名单失败", eClear);
  }
  if (sceneRaw) {
    try { await OBR.scene.setMetadata({ [KEY_INITIATIVE]: emptyLegacyInitiative() }); }
    catch (eClear2) { /* 场景里那份只是兜底副本，token 已是真源，清不掉不影响读取 */ }
  }
  if (!cleared) notify("先攻已迁移到 token metadata，但旧房间名单没清掉（下次启动会再试）", "WARNING");
  console.info("[4enext] 先攻迁移完成：token " + ids.length + " 条" +
    (skipped ? "，跳过 " + skipped + " 条（不在当前场景）" : "") +
    "；旧数据备份在 localStorage[" + initBackupKey() + "]");
  return { ok: true, migrated: ids.length, skipped: skipped };
}

/**
 * 把「已绑定角色卡、但 init 元数据缺失或过期」的 token 补一遍。
 * v1.2.2 升级上来的老 token 没有 init；重新导入同名卡后加值也可能变。
 * v2.5：v2 条目只更新加值（并重算 init = d20+加值），**不碰** d20 / tb / hidden / ownerId；
 * 旧版加值缓存（{bonus,cardId}）仍按老形状补写（后台右键「加入先攻」靠它取卡里的加值）。
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
    if (cur && typeof cur === "object") {
      const v2 = cur.v === INIT_META_V;
      if (cur.bonus === bonus && (v2 || cur.cardId === cardId)) continue;
      if (v2) {
        const meta = Object.assign({}, cur, { bonus: bonus, updatedAt: Date.now() });
        if (cur.d20 !== null && cur.d20 !== undefined && isFinite(Number(cur.d20))) {
          meta.init = clamp(Math.round(Number(cur.d20)) + bonus, INIT_MIN, INIT_MAX);
        }
        want[it.id] = meta;
      } else {
        want[it.id] = { bonus: bonus, cardId: cardId, updatedAt: Date.now() };
      }
    } else {
      want[it.id] = { bonus: bonus, cardId: cardId, updatedAt: Date.now() };
    }
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

/** v1.7.10：卡片下方只留**一枚**居中 d20 —— 4E 没有优势 / 劣势（删掉 − / ＋ 两枚）。
 *  几何照抄 Full Suite：.roll-buttons { top:100%; margin-top:-8 }，按钮上沿压在卡片下沿 8px。 */
function stripRollButtons(e, isGM, phase, opts) {
  /* v2.5.5（照 Full Suite InitiativeItem）：准备阶段 GM 或「自己的条目」都能掷；
   * 战斗阶段只有 GM。玩家掷骰直接写**自己 token 的 metadata**（OBR 允许），不再走 GM 代写通道。 */
  const canRoll = isGM
    ? (phase === PHASE_PREPARING || phase === PHASE_COMBAT)
    : (phase === PHASE_PREPARING && canEditBonus(e, opts || {}));
  if (!canRoll) return "";
  return '<div class="roll-buttons">' +
    '<button class="roll-btn normal" data-roll="normal" data-token="' + esc(e.tokenId) +
    '" title="掷先攻 d20 · 先攻 ' + esc(signed(e.bonus)) + '">d20</button>' +
    "</div>";
}

/**
 * v1.7.10：卡片左上角的先攻加值 —— **可编辑输入框**（与状态行「加值」共用 onBonusCommit）。
 *   · 有绑定角色卡 / 无卡都显示输入框：值就是 entries[].bonus（有卡在加入时已自动填卡值，无卡默认 0）；
 *   · 只有 GM 或「自己的 token」才渲染 input，别人的条目是只读数字（权限见 canEditBonus）；
 *   · 回车 / 失焦保存，页面再按合计重排（不进角色卡，只写 token metadata 的 bonus / init）。
 */
function stripBonusField(e, opts) {
  if (!canEditBonus(e, opts)) {
    return '<span class="item-mod" title="先攻加值 ' + esc(signed(e.bonus)) + '">' + signed(e.bonus) + "</span>";
  }
  return '<input class="item-mod item-mod-input" data-bonus-input="' + esc(e.tokenId) +
    '" value="' + esc(String(n(e.bonus, 0))) + '" inputmode="numeric" autocomplete="off" spellcheck="false"' +
    ' title="先攻加值：回车 / 点别处保存（现在 ' + esc(signed(e.bonus)) + '）">';
}

/**
 * v1.8.2：卡片底部大号数字 —— 有权限时直接渲染「掷出的点数（d20）」输入框。
 *   · 用户原话：「输入 20，左上角是 100，然后实际先攻是 20+100」→ 输入框里是 **d20**，
 *     合计（大字位置）会随它 = d20 + 加值（下面小字公式仍是 `(d20+加值)` 由 stripCard 传进来）；
 *   · 只在「战斗 / 准备中且已掷 d20」时给输入框；`preparing` 未掷（显示「—」）保持只读 <b>；
 *   · 权限复用 canEditBonus（GM 任意 / 玩家只自己 token）；别人的条目仍是只读 <b>；
 *   · 页面 commitD20 会解析输入并走 setEntryRoll（写 entries[].d20、重算 init、按合计重排）。
 */
function stripRollField(e, st, opts, total) {
  const rolled = e.d20 !== null && e.d20 !== undefined;
  const editable = rolled &&
    (st.phase === PHASE_COMBAT || st.phase === PHASE_PREPARING) &&
    canEditBonus(e, opts);
  /* v2.5.5：小字不再显示 (d20+加值) 公式，改为直接显示合计（解决「7+6」不好读）。 */
  if (!editable) {
    return "<b>" + esc(total) + "</b>";
  }
  const rollText = String(Math.round(num(e.d20, 0)));
  return '<input class="item-count-input" data-init-d20="' + esc(e.tokenId) +
    '" value="' + esc(rollText) + '" inputmode="numeric" autocomplete="off" spellcheck="false"' +
    ' title="输入先攻点数（d20）：回车 / 点别处保存；合计 = 点数 + 加值（当前 ' + esc(rollText) +
    esc(signed(e.bonus)) + '）">' +
    '<small class="count-formula">' + esc(total) + "</small>";
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
    stripBonusField(e, opts) +
    '<div class="item-img">' + img + "</div>" +
    hpTrack +
    '<div class="item-count">' + stripRollField(e, st, opts, total) + "</div>" +
    stripRollButtons(e, isGM, st.phase, opts) +
    /* v1.7.3：GM 的卡片上放一个 ✕ —— 不用开列表窗口，点一下就把这枚 token 移出先攻。
       玩家没有（房间数据只有城主能写）。 */
    (isGM ? '<button class="item-del" data-strip-act="remove" data-token="' + esc(e.tokenId) +
      '" title="把「' + esc(e.name) + '」移出先攻">✕</button>' : "") +
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
  /* v1.7.10：状态行 = 「阶段 · 当前单位名 · 加值 [输入框]」。
     输入框与卡片左上角**共用同一份写逻辑**（页面 commitBonus），回车 / 失焦写 entries[].bonus 并重排；
     没绑定卡的条目同样能填（默认 0）。玩家只在自己的 token 上看到输入框。 */
  const bonusSlot = active
    ? '<span class="strip-bonus-wrap" title="当前单位的先攻加值（回车 / 失焦保存，改完立即重排）">' +
      '<span class="strip-bonus-lab">加值</span>' +
      (canEditBonus(active, opts)
        ? '<input class="strip-bonus" data-bonus-row="' + esc(active.tokenId) + '" value="' +
          esc(String(n(active.bonus, 0))) + '" inputmode="numeric" autocomplete="off" spellcheck="false">'
        : '<span class="strip-bonus static">' + signed(active.bonus) + "</span>") +
      "</span>"
    : "";
  const right = '<span class="strip-status" title="' +
    esc(st.entries.length + " 个条目 · 上限 " + INIT_MAX_ENTRIES) + '">' + status +
    (who ? ' · <b>' + esc(who) + "</b>" : "") + "</span>" + bonusSlot +
    '<button class="strip-btn icon" data-strip-act="list" title="打开列表窗口（管理 / 重掷 / 同步加值）">≡</button>' +
    /* v1.7.3：「—」只最小化（折叠成 120×40 药丸，popover 仍开着 → 依旧常驻）；「✕」才是真关掉。 */
    '<button class="strip-btn icon" data-strip-act="collapse" title="最小化（折叠成 120×40 小药丸，仍然常驻）">−</button>' +
    '<button class="strip-btn icon strip-close" data-strip-act="close" title="关闭先攻条（本次会话不再自动显示，工具栏「先攻」可再打开）">✕</button>' +
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
    /* v1.7.10：列表窗口的加值也可改（与卡片 / 状态行同一份 setEntryBonus；GM 任意、玩家只自己 token）。
     * 这样即使先攻条的外壳被宿主限制成只能看，改加值仍有一个入口。 */
    const canB = canEditBonus(e, { role: role, playerId: playerId });
    const bonusCell = canB
      ? '<input class="init-bonus init-bonus-input" data-init-bonus="' + esc(e.tokenId) + '" value="' +
        esc(String(n(e.bonus, 0))) + '" inputmode="numeric" autocomplete="off" spellcheck="false"' +
        ' title="先攻加值：回车 / 失焦保存（现在 ' + esc(signed(e.bonus)) + '）">'
      : '<span class="init-bonus" title="先攻加值">' + signed(e.bonus) + "</span>";
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
      bonusCell +
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
