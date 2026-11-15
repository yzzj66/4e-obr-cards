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
import { NS } from "./common.js";

/** token 上的血量键。 */
export const KEY_HP = NS + "/hp";
/** 房间数据里每张卡一份的追踪状态键前缀。 */
export const KEY_STATE_PREFIX = NS + "/state/";
/** 本机兜底键前缀。 */
export const LS_STATE_PREFIX = "4enext/state/";

const AP_MAX = 5;
const COUNTER_MAX = 99;

const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const int = (v, d) => (typeof v === "number" && isFinite(v) ? Math.round(v) : d);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
    milestones: 0
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
    const meta = await OBR.room.getMetadata();
    const raw = meta[KEY_STATE_PREFIX + cardId];
    if (!raw || typeof raw !== "object") return null;
    return normalizeState(raw);
  } catch (e) {
    return null;
  }
}

// 本页里一旦确认「房间数据写不进去」，这张卡后续就走本机，避免每次点击都先失败一遍。
const scopeOverride = {};

/** 读当前有效状态：房间数据优先，本机更新的更晚就用本机。 */
export async function loadState(cardId) {
  const local = readLocal(cardId);
  const room = await readRoomState(cardId);
  const scope = scopeOverride[cardId] || "";
  if (scope === "local") return { state: local || defaultState(), scope: "local" };
  if (room && (!local || room.updatedAt >= local.updatedAt)) return { state: room, scope: "room" };
  if (local) return { state: local, scope: "local" };
  return { state: defaultState(), scope: "room" };
}

/** 读最新 → mutate → 写回。返回 { state, scope, message?, tone? }。 */
export async function commitState(cardId, mutate) {
  const key = KEY_STATE_PREFIX + cardId;
  const scope = scopeOverride[cardId] || "room";
  let base = null;
  if (scope === "room") base = await readRoomState(cardId);
  if (!base) base = readLocal(cardId);
  const next = normalizeState(mutate(clone(base || defaultState())));
  next.updatedAt = Date.now();
  try {
    await OBR.room.setMetadata({ [key]: next });
    scopeOverride[cardId] = "room";
    return { state: next, scope: "room" };
  } catch (e) {
    const ok = writeLocal(cardId, next);
    scopeOverride[cardId] = "local";
    return {
      state: next,
      scope: "local",
      message: ok
        ? "房间数据写不进去（通常只有城主能写），已改为只记在这台机器上"
        : "房间数据和本机存储都写不进去，这次改动只在当前画面有效",
      tone: "WARNING"
    };
  }
}

/* ---------------------------------------------------------------------------
 * 血量（token 元数据）
 * ------------------------------------------------------------------------- */

export function normalizeHp(raw) {
  const out = { cur: null, max: null, temp: 0, surges: null, updatedAt: 0 };
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.cur === "number" && isFinite(raw.cur)) out.cur = Math.round(raw.cur);
  if (typeof raw.max === "number" && isFinite(raw.max) && raw.max > 0) out.max = Math.round(raw.max);
  if (typeof raw.temp === "number" && isFinite(raw.temp)) out.temp = Math.max(0, Math.round(raw.temp));
  if (typeof raw.surges === "number" && isFinite(raw.surges)) out.surges = Math.max(0, Math.round(raw.surges));
  out.updatedAt = int(raw.updatedAt, 0);
  return out;
}

/** 把「存了的 / 没存的」补成可直接显示的四个数字。 */
export function hpView(raw, fallback) {
  const h = normalizeHp(raw);
  const fallbackMax = fallback && fallback.maxHp > 0 ? fallback.maxHp : 1;
  const max = typeof h.max === "number" ? h.max : fallbackMax;
  return {
    cur: typeof h.cur === "number" ? h.cur : max,
    max: max,
    temp: h.temp || 0,
    surges: typeof h.surges === "number" ? h.surges : (fallback && typeof fallback.surges === "number" ? fallback.surges : 0)
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
      return out;
    });
    let hp = null;
    if (ctx.itemId && ctx.canHp !== false) {
      hp = await writeTokenHp(ctx.itemId, function (prev) {
        const view = hpView(prev, ctx);
        return { cur: view.max, max: view.max, temp: 0, surges: ctx.surgesMax || view.surges, updatedAt: 0 };
      });
    }
    return { state: res.state, scope: res.scope, hp: hp, message: res.message || "长休完成：生命、回复力与全部消耗已恢复", tone: res.tone || "SUCCESS" };
  }

  // ---- 短休：只恢复遭遇威能（4E NEXT 还会挑「每次遭遇」的专长，离线拿不到专长正文，见 README）----
  if (act === "rest-short") {
    const res = await commitState(ctx.cardId, function (s) {
      const out = normalizeState(s);
      for (const k of Object.keys(out.powerUsed)) if (k.indexOf("encounter-") === 0) delete out.powerUsed[k];
      return out;
    });
    return { state: res.state, scope: res.scope, message: res.message || "短休完成：遭遇威能已恢复", tone: res.tone || "SUCCESS" };
  }

  // ---- 其余都是资源状态 ----
  const res = await commitState(ctx.cardId, function (s) {
    const out = normalizeState(s);
    switch (act) {
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
