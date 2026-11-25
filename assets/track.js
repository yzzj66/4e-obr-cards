// 血量 + 资源追踪的读写与语义（v1.2.0）
// ---------------------------------------------------------------------------
// 两条数据线，跟 4E NEXT 的字段一一对应，但存放位置不同：
//
//   1) 血量  → token 的 item.metadata["com.4enext-owlbear/hp"]
//      { cur, max, temp, surges, updatedAt }
//      每个 token 独立：同一张卡可以有两枚 token（本体 / 坐骑），血量互不影响；
//      写在 token 上，全房间的人都能看到血条（谁有权限改见 mayEditHp）。
//      语义照抄 4E NEXT web/src/overview/GlanceVitals.tsx：
//        · 受伤：先扣临时生命，再扣生命，最低到 −生命上限
//        · 治疗：生命为负时先归零再加，最高到生命上限
//        · 使用回复力：回复力 −1，生命 + 回复值（不超过上限）
//
//   2) 消耗类资源 → 房间数据 room.metadata["com.4enext-owlbear/state/<cardId>"]
//      { powerUsed, featUsed, equipmentUsed, itemDailyUsed, actionPoints, milestones }
//      键名与 4E NEXT 完全一致（"encounter-0" / "e-3" / "g-<专长id>" …），
//      语义照抄 web/src/overview/GlanceResources.tsx + OverviewView.tsx。
//      房间数据写不进去（玩家一般没有 GM 权限）时退回 localStorage —— 只影响自己那台机器，
//      面板 / 弹窗上会明确标出「本机」还是「全桌」。
//
// 写操作一律走「读最新 → 改 → 写」，避免拿页面里过期的一份覆盖别人刚改的。

import OBR from "../vendor/obr-sdk.js";
/* v1.7.15：写房间数据前先过体积预算（超了就**不写** + ERROR 通知，再降级本机）。 */
import { NS, ROOM_FULL_MESSAGE, combineDefenses, notify, writeRoomKey } from "./common.js";

/** token 上的血量键。 */
export const KEY_HP = NS + "/hp";
/** v1.6.0：血条组件开关（独立键；flag === false 才不画，undefined 视为画）。 */
export const KEY_HPBAR = NS + "/hp-bar/enabled";
/** v1.6.0：玩家端量化阈值（场景元数据；缺省 25%）。 */
export const KEY_PLAYER_THRESHOLD = NS + "/settings.playerThreshold";
/** 房间数据里每张卡一份的追踪状态键前缀。 */
export const KEY_STATE_PREFIX = NS + "/state/";
/** 本机兜底键前缀。 */
export const LS_STATE_PREFIX = "4enext/state/";

const AP_MAX = 5;
const COUNTER_MAX = 99;
/* v1.8.1：临时加值的范围（与 4E NEXT 速览页一致：命中/伤害/防御 ±20，临时回复值 ±50）。 */
const TEMP_MAX = 20;
const TEMP_SURGE_MAX = 50;

const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const int = (v, d) => (typeof v === "number" && isFinite(v) ? Math.round(v) : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 四防临时加值对象（缺字段 = 0；键名与 glance.js 的 d.defenses 一致：ac / fort / ref / will）。 */
function normDefTemp(v) {
  const out = { ac: 0, fort: 0, ref: 0, will: 0 };
  if (v && typeof v === "object") {
    for (const k of ["ac", "fort", "ref", "will"]) out[k] = clamp(int(v[k], 0), -TEMP_MAX, TEMP_MAX);
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 状态（消耗类资源）
 * ------------------------------------------------------------------------- */

export function defaultState() {
  return {
    v: 1,
    updatedAt: 0,
    powerUsed: {},
    featUsed: {},
    equipmentUsed: {},
    itemDailyUsed: 0,
    actionPoints: 1,
    milestones: 0,
    /* v1.8.1：速览页的临时加值（不改角色卡，只记在房间 / 本机的追踪状态里）。
     * 缺字段 = 0，旧状态直接兼容；四个数字合计约 90 字节 / 卡。 */
    atkTemp: 0,
    dmgTemp: 0,
    surgeTemp: 0,
    defTemp: { ac: 0, fort: 0, ref: 0, will: 0 }
  };
}

export function normalizeState(raw) {
  const out = defaultState();
  if (!raw || typeof raw !== "object") return out;
  out.updatedAt = int(raw.updatedAt, 0);
  out.powerUsed = plainMap(raw.powerUsed);
  out.featUsed = plainMap(raw.featUsed);
  out.equipmentUsed = plainMap(raw.equipmentUsed);
  out.itemDailyUsed = clamp(int(raw.itemDailyUsed, 0), 0, COUNTER_MAX);
  out.actionPoints = clamp(int(raw.actionPoints, 1), 0, AP_MAX);
  out.milestones = clamp(int(raw.milestones, 0), 0, COUNTER_MAX);
  out.atkTemp = clamp(int(raw.atkTemp, 0), -TEMP_MAX, TEMP_MAX);
  out.dmgTemp = clamp(int(raw.dmgTemp, 0), -TEMP_MAX, TEMP_MAX);
  out.surgeTemp = clamp(int(raw.surgeTemp, 0), -TEMP_SURGE_MAX, TEMP_SURGE_MAX);
  out.defTemp = normDefTemp(raw.defTemp);
  return out;
}

function plainMap(v) {
  const out = {};
  if (!v || typeof v !== "object") return out;
  for (const k of Object.keys(v)) if (v[k]) out[k] = true;
  return out;
}

function readLocal(cardId) {
  try {
    const raw = localStorage.getItem(LS_STATE_PREFIX + cardId);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

function writeLocal(cardId, state) {
  try {
    localStorage.setItem(LS_STATE_PREFIX + cardId, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

async function readRoomState(cardId) {
  try {
    let room = {}, scene = {};
    try { room = (await OBR.room.getMetadata()) || {}; } catch (e) { room = {}; }
    try { scene = (await OBR.scene.getMetadata()) || {}; } catch (e2) { scene = {}; }
    const rawRoom = room[KEY_STATE_PREFIX + cardId];
    const rawScene = scene[KEY_STATE_PREFIX + cardId];
    const a = rawRoom && typeof rawRoom === "object" ? normalizeState(rawRoom) : null;
    const b = rawScene && typeof rawScene === "object" ? normalizeState(rawScene) : null;
    if (a && b) return b.updatedAt > a.updatedAt ? b : a; /* v2.4.8：scene/room 取新 */
    return a || b;
  } catch (e) {
    return null;
  }
}

// 本页里一旦确认「房间数据写不进去」，这张卡后续就走本机，避免每次点击都先失败一遍。
const scopeOverride = {};

/* ---------------------------------------------------------------------------
 * v1.8.1：资源标记「读-改-写」竞态修复
 * ---------------------------------------------------------------------------
 * 真机 bug：速览页把威能逐个点成「已用」，点多了前面的会自己回到未使用（点 A 把 B 覆盖掉）。
 * 根因：OBR 的 room.getMetadata() 有同步延迟（回声延迟）——setMetadata 刚写完，下一次
 * getMetadata 仍可能返回写之前的旧快照；commitState 每次「读 → 改 → 写」如果拿旧快照当 base，
 * 上一次写进去的 powerUsed / featUsed / equipmentUsed 键就被整份覆盖丢失。
 *
 * 修法（不改变 state 结构）：
 *   1) 本页内存缓存 stateCache[cardId] = { state, scope }：loadState / commitState 都更新它；
 *   2) commitState 以「缓存（含刚写成功的乐观状态）vs 房间读数 vs 本机」中 updatedAt 最新者为 base；
 *      本页写入的 updatedAt 强制单调递增，连续快速点击不会因为同一毫秒而判错新旧；
 *   3) 订阅 room.onMetadataChange：把别的页面（info 弹窗 / panel 面板）写进房间的状态同步进缓存，
 *      两个页面交替点同一张卡时按并集累积，而不是各自用旧快照互相覆盖；
 *   4) 降级本机与 ERROR 通知的既有行为保留。
 * 所有资源动作（power / feat / equipment / item-daily / 行动点 / 临时加值 / 长短休）都走 commitState。
 * ------------------------------------------------------------------------- */
const stateCache = {}; /* cardId -> { state, scope } */

function cacheGet(cardId) {
  return stateCache[cardId] ? stateCache[cardId].state : null;
}

/** 写入缓存；旧状态（事件乱序 / 回声迟到）不允许覆盖新状态。返回最终缓存里的 state。 */
function cachePut(cardId, state, scope) {
  const st = normalizeState(state);
  const cur = stateCache[cardId];
  if (cur && cur.state.updatedAt > st.updatedAt) return cur.state;
  stateCache[cardId] = { state: st, scope: scope || "room" };
  return st;
}

let metaWatcherRegistered = false;
/** 懒注册 room.onMetadataChange（首次 loadState / commitState 时调用；失败下次重试）。 */
function watchRoomMeta() {
  if (metaWatcherRegistered) return;
  try {
    if (!OBR.room || typeof OBR.room.onMetadataChange !== "function") return;
    OBR.room.onMetadataChange(function (meta) {
      if (!meta || typeof meta !== "object") return;
      for (const k of Object.keys(meta)) {
        if (k.indexOf(KEY_STATE_PREFIX) !== 0) continue;
        const cardId = k.slice(KEY_STATE_PREFIX.length);
        if (!cardId) continue;
        const st = normalizeState(meta[k]);
        const cur = stateCache[cardId];
        if (!cur || st.updatedAt > cur.state.updatedAt) stateCache[cardId] = { state: st, scope: "room" };
      }
    });
    if (OBR.scene && typeof OBR.scene.onMetadataChange === "function") {
      OBR.scene.onMetadataChange(function (meta) {
        if (!meta || typeof meta !== "object") return;
        for (const k of Object.keys(meta)) {
          if (k.indexOf(KEY_STATE_PREFIX) !== 0) continue;
          const cardId = k.slice(KEY_STATE_PREFIX.length);
          if (!cardId) continue;
          const st = normalizeState(meta[k]);
          const cur = stateCache[cardId];
          if (!cur || st.updatedAt > cur.state.updatedAt) stateCache[cardId] = { state: st, scope: "scene" };
        }
      });
    }
    metaWatcherRegistered = true;
  } catch (e) {
    /* OBR 未就绪 / 老 SDK 没有 onMetadataChange：下次再试，不影响读写 */
  }
}

/** 读当前有效状态：房间数据优先，本机更新的更晚就用本机；本页缓存里刚写但房间还没回声的更新。 */
export async function loadState(cardId) {
  watchRoomMeta();
  const local = readLocal(cardId);
  const stored = await readRoomState(cardId);
  let picked = stored || defaultState();
  let pickedScope = stored ? (scopeOverride[cardId] === "scene" ? "scene" : "room") : "room";
  /* v2.4.8：本机兜底若更新更晚则恢复本机（下次打开不回到旧状态）。 */
  if (local && (!stored || local.updatedAt > stored.updatedAt)) {
    picked = local;
    pickedScope = "local";
  }
  /* 缓存可能比房间读数新（刚写完、回声还没回来）→ 用缓存；否则把房间 / 本机结果同步进缓存。
   * 注意严格大于：updatedAt 相等时以房间 / 本机读数为准（外部写入可能和本页写在同一毫秒）。 */
  const cached = cacheGet(cardId);
  if (cached && cached.updatedAt > picked.updatedAt) {
    return { state: clone(cached), scope: (stateCache[cardId] && stateCache[cardId].scope) || pickedScope };
  }
  return { state: clone(cachePut(cardId, picked, pickedScope)), scope: pickedScope };
}

/** 读最新 → mutate → 写回。返回 { state, scope, message?, tone? }。
 *  v1.7.15：写之前先算房间数据体积 —— 超预算时**不写**、弹 ERROR（ROOM_FULL_MESSAGE），
 *  再降级到本机（tone 仍是 WARNING，面板里那一行小字照旧）。
 *  v1.8.1：base 不再只信 room 读数 —— 缓存里有本页刚写、房间还没回声的更新时以缓存为准。 */
export async function commitState(cardId, mutate) {
  watchRoomMeta();
  const key = KEY_STATE_PREFIX + cardId;
  const scope = scopeOverride[cardId] || "room";
  const local = readLocal(cardId);
  let room = null;
  if (scope === "room") room = await readRoomState(cardId);
  let base = room;
  if (!base) base = local;
  const cached = cacheGet(cardId);
  /* 严格大于：相等时信房间读数（外部写入可能和本页写入落在同一毫秒）。 */
  if (cached && (!base || cached.updatedAt > base.updatedAt)) base = cached;
  else if (room) cachePut(cardId, room, "room");
  else if (local) cachePut(cardId, local, "local");
  const next = normalizeState(mutate(clone(base || defaultState())));
  /* updatedAt 强制单调递增：同一毫秒内连点也不会让「谁更新」判断失效。 */
  next.updatedAt = Math.max(Date.now(), (base && base.updatedAt ? base.updatedAt : 0) + 1);
  const res = await writeRoomKey(key, next);
  if (res.ok) {
    const store = res.store === "scene" ? "scene" : "room";
    scopeOverride[cardId] = store;
    cachePut(cardId, next, store);
    return { state: clone(next), scope: store };
  }
  if (res.reason === "full") {
    notify(ROOM_FULL_MESSAGE, "ERROR");
  } else {
    /* v1.7.15：写失败一律 ERROR 通知（以前只有面板里一行小字，用户以为「点了没反应」）。 */
    notify("资源标记没能写进房间数据（" + (res.error && res.error.message ? res.error.message : String(res.error)) +
      "）：已改为只记在这台机器上", "ERROR");
  }
  const ok = writeLocal(cardId, next);
  scopeOverride[cardId] = "local";
  cachePut(cardId, next, "local");
  return {
    state: clone(next),
    scope: "local",
    message: res.reason === "full"
      ? "房间数据已满（16KB），这次只记在这台机器上（设置 →「清理房间数据」可以瘦身）"
      : ok
        ? "房间数据写不进去（通常只有城主能写），已改为只记在这台机器上"
        : "房间数据和本机存储都写不进去，这次改动只在当前画面有效",
    tone: "WARNING"
  };
}

/* ---------------------------------------------------------------------------
 * 血量（token 元数据）
 * ------------------------------------------------------------------------- */

/** v1.6.0：四防。只收 ac / fort / reflex / will 四个数字，一个都没有 → null（= 不画盾）。 */
export function readDefenses(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  let any = false;
  for (const k of ["ac", "fort", "reflex", "will"]) {
    if (typeof raw[k] === "number" && isFinite(raw[k])) {
      out[k] = Math.max(0, Math.round(raw[k]));
      any = true;
    }
  }
  return any ? out : null;
}

/** 卡里的四防（glance.js 的 d.defenses: [{ key, value }]）→ token 字段。
 *  **ref → reflex 的换算只在这里做一处**（规格 §6.2 / 风险 R11）；渲染层只认 reflex。 */
export function defensesFromDerived(list) {
  if (!list) return null;
  const map = { ac: "ac", fort: "fort", ref: "reflex", reflex: "reflex", will: "will" };
  const out = {};
  let any = false;
  const take = (k, v) => {
    const key = map[String(k)];
    if (!key) return;
    if (typeof v === "number" && isFinite(v)) { out[key] = Math.max(0, Math.round(v)); any = true; }
  };
  if (Array.isArray(list)) {
    for (const row of list) if (row && typeof row === "object") take(row.key, row.value);
  } else if (typeof list === "object") {
    for (const k of Object.keys(list)) take(k, list[k]);
  }
  return any ? out : null;
}

export function normalizeHp(raw) {
  const out = {
    cur: null, max: null, temp: 0, surges: null, surgesMax: null,
    defenses: null, boss: null, locked: true, updatedAt: 0
  };
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.cur === "number" && isFinite(raw.cur)) out.cur = Math.round(raw.cur);
  if (typeof raw.max === "number" && isFinite(raw.max) && raw.max > 0) out.max = Math.round(raw.max);
  if (typeof raw.temp === "number" && isFinite(raw.temp)) out.temp = Math.max(0, Math.round(raw.temp));
  if (typeof raw.surges === "number" && isFinite(raw.surges)) out.surges = Math.max(0, Math.round(raw.surges));
  if (typeof raw.surgesMax === "number" && isFinite(raw.surgesMax) && raw.surgesMax > 0) {
    out.surgesMax = Math.round(raw.surgesMax);
  }
  out.defenses = readDefenses(raw.defenses);
  /* v1.8.0：hp.boss 只为旧数据兼容原样带过（不解释、不参与任何分支）。 */
  out.boss = raw.boss == null ? null : raw.boss;
  out.locked = raw.locked !== false;
  out.updatedAt = int(raw.updatedAt, 0);
  return out;
}

/** 把「存了的 / 没存的」补成可直接显示的数字（v1.6.0 追加 surgesMax / 四防 / boss / locked）。 */
export function hpView(raw, fallback) {
  const h = normalizeHp(raw);
  const fallbackMax = fallback && fallback.maxHp > 0 ? fallback.maxHp : 1;
  const max = typeof h.max === "number" ? h.max : fallbackMax;
  return {
    cur: typeof h.cur === "number" ? h.cur : max,
    max: max,
    temp: h.temp || 0,
    surges: typeof h.surges === "number" ? h.surges : (fallback && typeof fallback.surges === "number" ? fallback.surges : 0),
    surgesMax: h.surgesMax,
    defenses: h.defenses,
    boss: h.boss,
    locked: h.locked
  };
}

export async function readItem(itemId) {
  if (!itemId) return null;
  try {
    const items = await OBR.scene.items.getItems([itemId]);
    return items[0] || null;
  } catch (e) {
    return null;
  }
}

/** GM 能改一切；玩家只能改自己放上桌的 token（OBR 的 item 权限就是这样）。 */
export async function mayEditItem(item) {
  try {
    const role = await OBR.player.getRole();
    if (role === "GM") return true;
    const id = await OBR.player.getId();
    return !!(item && id && item.createdUserId === id);
  } catch (e) {
    return false;
  }
}

/** 读最新 → mutate → 写回 token 元数据。返回写进去的那个对象。 */
export async function writeTokenHp(itemId, mutate) {
  let out = null;
  try {
    await OBR.scene.items.updateItems([itemId], function (items) {
      for (const it of items) {
        if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
        const next = mutate(normalizeHp(it.metadata[KEY_HP]));
        /* 空值不落盘：boss:null / defenses:null / surgesMax:null 只是读取层的默认，
         * 写进 metadata 会把每枚 token 都撑大一圈（房间数据 / 场景同步都有预算）。 */
        if (next.defenses == null) delete next.defenses;
        if (next.boss == null) delete next.boss;
        if (next.surgesMax == null) delete next.surgesMax;
        next.updatedAt = Date.now();
        it.metadata[KEY_HP] = next;
        out = next;
      }
    });
  } catch (e) {
    throw new Error("改不了这枚 token 的血量：只有城主或这枚 token 的创建者能改（" + (e && e.message ? e.message : e) + "）");
  }
  return out;
}

/** v1.6.0：把卡里算出来的 surgesMax / 四防同步进 token（只在真的不一样时写一次）。
 *  速览弹窗刷新时调用 —— 老 token 第一次打开速览就会长出蓝色回复力条与四角盾，
 *  不用城主动手再加一次。没有权限 / 没有值 / 已经一致 → 什么都不做。
 *  v1.8.4：token 还没有 HP 上限（没 hp 或 max 非正）时，用卡里的 maxHp 播种 cur = max，
 *  否则「绑卡 + 打开速览」后地图上仍然没有血条环；已有 max 的 token 一律不动。
 *  用户显式「移除血条组件」（enabled === false）时不播种（与 hasHpBarData 修复一致）。
 *  返回 true 表示这次真的写了一次（页面据此重画）。 */
export async function syncTokenStats(itemId, hp, ctx) {
  if (!itemId || !hp || !ctx) return false;
  const wantMax = typeof ctx.maxHp === "number" && isFinite(ctx.maxHp) && ctx.maxHp > 0 ? Math.round(ctx.maxHp) : null;
  const raw = await readItem(itemId);
  const rawMeta = raw && raw.metadata ? raw.metadata : {};
  const rawHp = normalizeHp(rawMeta[KEY_HP]);
  const barOff = rawMeta[KEY_HPBAR] === false;
  /* 用户显式移除血条组件：不播种、也不补数据（反正不画；重新「添加」后下次打开速览再补）。 */
  if (barOff) return false;
  const needHp = !!wantMax && !barOff && !(typeof rawHp.max === "number" && rawHp.max > 0);
  const wantSurge = ctx.surgesMax > 0 ? Math.round(ctx.surgesMax) : null;
  /* v2.4.8：wantDef 必须包含速览临时四防，否则 base+temp 会被误判成「与卡片基础不一致」
   * 又写回基础值，真机表现为「地图数字变一下又变回去」。合并规则与 syncDefTempToTokens 共用 combineDefenses。 */
  const wantDef = combineDefenses(defensesFromDerived(ctx.defenses), ctx.defTemp);
  const curDef = hp.defenses || null;
  const sameSurge = !wantSurge || hp.surgesMax === wantSurge;
  const sameDef = !wantDef || !!curDef &&
    ["ac", "fort", "reflex", "will"].every((k) => curDef[k] === wantDef[k]);
  if (!needHp && sameSurge && sameDef) return false;
  await writeTokenHp(itemId, function (prev) {
    const out = clone(prev);
    if (needHp) {
      out.cur = wantMax;
      out.max = wantMax;
    }
    if (wantSurge) out.surgesMax = wantSurge;
    if (wantDef) out.defenses = wantDef;
    return out;
  });
  return true;
}

/* ---------------------------------------------------------------------------
 * 动作分发：页面只管把点击丢进来，这里负责读写 + 语义
 * ------------------------------------------------------------------------- */

function amountFrom(el, role) {
  const box = el && el.closest ? el.closest(".gl4-hp-pad") : null;
  const input = box ? box.querySelector('[data-role="' + (role || "amount") + '"]') : null;
  const n = input ? parseInt(String(input.value || "0"), 10) : 0;
  return isNaN(n) ? 0 : Math.max(0, n);
}

function clearAmount(el) {
  const box = el && el.closest ? el.closest(".gl4-hp-pad") : null;
  const input = box ? box.querySelector('[data-role="amount"]') : null;
  if (input) input.value = "";
}

function hpResult(hp, message, tone) {
  return { hp: hp, message: message || "", tone: tone || "INFO" };
}

/**
 * 处理一次点击。ctx：
 *   { cardId, itemId, hp, state, maxHp, surgesMax, surgeValue, canHp, itemDailyMax }
 * 返回 { hp?, state?, scope?, message?, tone? }，页面按返回值重画即可。
 */
export async function applyAction(act, el, ctx) {
  const d = el && el.dataset ? el.dataset : {};
  const step = parseInt(String(d.n || d.d || "0"), 10) || 0;
  const key = String(d.k || "");
  const cat = String(d.cat || "");

  // ---- v1.6.0：四防 / 共享数据开关（都写 token 元数据，不碰房间数据） ----
  if (act === "defense" || act === "lock") {
    if (!ctx.itemId) throw new Error("这里没有绑定 token，改不了血量");
    if (ctx.canHp === false) throw new Error("只有城主或这枚 token 的创建者能改血量");
    const next = await writeTokenHp(ctx.itemId, function (prev) {
      const out = clone(prev);
      if (act === "defense") {
        const def = defensesFromDerived(ctx.defenses);
        if (def) out.defenses = def;
        if (ctx.surgesMax > 0) out.surgesMax = Math.round(ctx.surgesMax);
      } else {
        out.locked = prev.locked === false; /* 取反：默认 true（玩家端不显示数字） */
      }
      return out;
    });
    return hpResult(next);
  }

  // ---- 血量 ----
  if (act === "hurt" || act === "heal" || act === "hurt-amount" || act === "heal-amount" ||
    act === "temp" || act === "temp-set" || act === "surge" || act === "surge-use") {
    if (!ctx.itemId) throw new Error("这里没有绑定 token，改不了血量");
    if (ctx.canHp === false) throw new Error("只有城主或这枚 token 的创建者能改血量");
    let n = 0;
    if (act === "hurt-amount" || act === "heal-amount") {
      n = amountFrom(el, "amount");
      if (n <= 0) return hpResult(null, "先填一个大于 0 的数值", "WARNING");
    } else if (act === "hurt" || act === "heal") {
      n = step;
      if (n <= 0) return hpResult(null, "没有读到数值", "WARNING");
    } else if (act === "temp-set") {
      n = amountFrom(el, "temp");
    }
    if (act === "surge-use" && ctx.hp && ctx.hp.surges <= 0) {
      return hpResult(null, "回复力已经用完了，先长休或让队友治疗", "WARNING");
    }
    const next = await writeTokenHp(ctx.itemId, function (prev) {
      const view = hpView(prev, ctx);
      const out = clone(prev);
      out.cur = view.cur;
      out.max = view.max;
      out.temp = view.temp;
      out.surges = view.surges;
      if (act === "hurt" || act === "hurt-amount") {
        const absorbed = Math.min(out.temp, n);
        out.temp = out.temp - absorbed;
        out.cur = Math.max(-view.max, view.cur - (n - absorbed));
      } else if (act === "heal" || act === "heal-amount") {
        out.cur = Math.min(view.max, Math.max(0, view.cur) + n);
      } else if (act === "temp") {
        out.temp = Math.max(0, view.temp + step);
      } else if (act === "temp-set") {
        out.temp = Math.max(0, n);
      } else if (act === "surge") {
        out.surges = clamp(step, 0, ctx.surgesMax || 0);
      } else if (act === "surge-use") {
        if (view.surges <= 0) return clone(prev);
        out.surges = view.surges - 1;
        out.cur = Math.min(view.max, Math.max(0, view.cur) + (ctx.surgeValue || 0));
      }
      /* v1.6.0：顺手把「分母 + 四防」同步到 token（老 token 就是在这一步长出蓝条与四角盾的）。 */
      if (ctx.surgesMax > 0) out.surgesMax = Math.round(ctx.surgesMax);
      const defNow = defensesFromDerived(ctx.defenses);
      if (defNow) out.defenses = defNow;
      return out;
    });
    if (act === "hurt-amount" || act === "heal-amount") clearAmount(el);
    return hpResult(next);
  }

  // ---- 长休：一次性把资源与血量都恢复 ----
  if (act === "rest-long") {
    const res = await commitState(ctx.cardId, function (s) {
      const out = normalizeState(s);
      out.powerUsed = {};
      out.featUsed = {};
      out.equipmentUsed = {};
      out.itemDailyUsed = 0;
      out.actionPoints = 1;
      out.milestones = 0;
      /* v1.8.1：长休也清空速览页的临时加值 */
      out.atkTemp = 0;
      out.dmgTemp = 0;
      out.surgeTemp = 0;
      out.defTemp = { ac: 0, fort: 0, ref: 0, will: 0 };
      return out;
    });
    let hp = null;
    if (ctx.itemId && ctx.canHp !== false) {
      hp = await writeTokenHp(ctx.itemId, function (prev) {
        const view = hpView(prev, ctx);
        const out = clone(prev);
        out.cur = view.max;
        out.max = view.max;
        out.temp = 0;
        out.surges = ctx.surgesMax || view.surges;
        /* 长休不能把 v1.6.0 的新字段（四防 / boss / locked / surgesMax）洗掉 */
        if (ctx.surgesMax > 0) out.surgesMax = Math.round(ctx.surgesMax);
        const defRest = defensesFromDerived(ctx.defenses);
        if (defRest) out.defenses = defRest;
        return out;
      });
    }
    return { state: res.state, scope: res.scope, hp: hp, message: res.message || "长休完成：生命、回复力与全部消耗已恢复", tone: res.tone || "SUCCESS" };
  }

  // ---- 短休：恢复遭遇威能（4E NEXT 还会挑「每次遭遇」的专长）与遭遇级临时加值 ----
  if (act === "rest-short") {
    const res = await commitState(ctx.cardId, function (s) {
      const out = normalizeState(s);
      for (const k of Object.keys(out.powerUsed)) if (k.indexOf("encounter-") === 0) delete out.powerUsed[k];
      /* v1.8.1：短休会结束「遭遇级」效果 —— 临时命中/伤害/四防/回复值清零；
       * 遭遇类专长的已用标记也清掉（键清单由 info.js 从 card-index 里算好传进来）。 */
      out.atkTemp = 0;
      out.dmgTemp = 0;
      out.surgeTemp = 0;
      out.defTemp = { ac: 0, fort: 0, ref: 0, will: 0 };
      if (Array.isArray(ctx.encounterFeatKeys)) {
        for (const k of ctx.encounterFeatKeys) delete out.featUsed[k];
      }
      return out;
    });
    return { state: res.state, scope: res.scope, message: res.message || "短休完成：遭遇威能 / 遭遇专长已恢复，临时加值已清空", tone: res.tone || "SUCCESS" };
  }

  // ---- 其余都是资源状态 ----
  const res = await commitState(ctx.cardId, function (s) {
    const out = normalizeState(s);
    switch (act) {
      /* v1.7.12：**所有可追踪的威能组**（遭遇 / 每日 / 辅助 / 种族职业）都走这一支，
       * 不按 key 前缀早退；随意威能本来就不渲染按钮。 */
      case "power":
        if (out.powerUsed[key]) delete out.powerUsed[key];
        else out.powerUsed[key] = true;
        break;
      case "power-reset":
        for (const k of Object.keys(out.powerUsed)) if (cat && k.indexOf(cat + "-") === 0) delete out.powerUsed[k];
        break;
      case "feat":
        if (out.featUsed[key]) delete out.featUsed[key];
        else out.featUsed[key] = true;
        break;
      /* v1.7.12：装备 / 魔法物品统一用 equipment（与速览渲染的 data-act 一致）；
       * item 是 v1.2.0 的老动作名，保留兼容（老页面 / 老缓存照旧能点）。 */
      case "equipment":
      case "item":
        if (out.equipmentUsed[key]) delete out.equipmentUsed[key];
        else out.equipmentUsed[key] = true;
        break;
      case "ap":
        out.actionPoints = clamp(out.actionPoints + step, 0, AP_MAX);
        break;
      case "milestone": {
        const before = out.milestones;
        out.milestones = clamp(out.milestones + step, 0, COUNTER_MAX);
        if (out.milestones !== before) out.actionPoints = clamp(out.actionPoints + step, 0, AP_MAX);
        break;
      }
      case "item-daily": {
        const max = ctx.itemDailyMax > 0 ? ctx.itemDailyMax : 0;
        out.itemDailyUsed = clamp(out.itemDailyUsed + step, 0, max > 0 ? max : COUNTER_MAX);
        break;
      }
      /* v1.8.1：速览页的临时加值（命中 / 伤害 / 四防 / 回复值）。只改追踪状态，不改角色卡。 */
      case "atk-temp":
        out.atkTemp = clamp(int(out.atkTemp, 0) + step, -TEMP_MAX, TEMP_MAX);
        break;
      case "dmg-temp":
        out.dmgTemp = clamp(int(out.dmgTemp, 0) + step, -TEMP_MAX, TEMP_MAX);
        break;
      case "surge-temp":
        out.surgeTemp = clamp(int(out.surgeTemp, 0) + step, -TEMP_SURGE_MAX, TEMP_SURGE_MAX);
        break;
      case "def-temp": {
        out.defTemp = normDefTemp(out.defTemp);
        const dk = ["ac", "fort", "ref", "will"].indexOf(key) >= 0 ? key : "";
        if (dk) out.defTemp[dk] = clamp(out.defTemp[dk] + step, -TEMP_MAX, TEMP_MAX);
        break;
      }
      default:
        break;
    }
    return out;
  });
  return { state: res.state, scope: res.scope, message: res.message || "", tone: res.tone || "INFO" };
}

/** 存的是「全桌」还是「本机」，给 UI 用。 */
export function scopeText(scope) {
  return scope === "local" ? "本机记录（未同步到房间）" : "全桌同步";
}

/* v2.4.8：血条/HP 显示策略（地图条、速览、先攻共用同一语义；background 有同实现副本）。 */
export function computeViewMode(opts) {
  const o = opts || {};
  const role = o.role || "";
  const isOwner = !!(o.isOwner || (o.playerId && o.createdUserId && o.playerId === o.createdUserId));
  if (o.hide) return role === "GM" ? "full" : "hidden";
  if (role === "GM" || isOwner) return "full";
  if (!o.locked) return "full";
  return o.phase && o.phase !== "idle" ? "silhouette" : "hidden";
}
export function quantiseRatio(ratio) {
  const r = typeof ratio === "number" && isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  if (r <= 0) return 0;
  return Math.min(1, Math.ceil(r / 0.25) * 0.25);
}
