// v1.7.2：血条编辑小窗的**纯逻辑**（没有 OBR、没有 DOM、没有任何 import）。
// ---------------------------------------------------------------------------
// 起因（用户真机）：右键「添加血条组件」只写开关、没有地方填血量与四防 →
// 没绑定角色卡的怪物 / 杂兵血条永远是空的。参考 FullPeople/obr-suite 的
// src/modules/hpBar/edit.ts（写盘夹取）+ target.ts（版本租约）做了这个简化版。
//
// 为什么单独一个文件：
//   · 语法解析 / 夹取 / 权限 / 租约都是**纯函数**，dev/test-background.mjs 把它复制成
//     .mjs 就能在 Node 里逐条断言（不需要浏览器、不需要 SDK）；
//   · assets/hp-edit-page.js 只负责 DOM（读表单 → buildHpEditPatch → writeHpEdit → 提示）。
//
// 数据键（与 assets/track.js、assets/background.core.js 一字不差）：
//   com.4enext-owlbear/hp               = { cur, max, temp, surges, surgesMax, defenses, boss, locked, updatedAt }
//   com.4enext-owlbear/hp-bar/enabled   = true / false（保存即确保开启）
// 输入语法（照参考实现 statEdit 的口径，规格 §2.6）：
//   "20"      → 设上限 20（当前值不高于上限；原来没有上限时 → 20/20）
//   "20/20"   → 当前 / 上限
//   "+5" "-3" → 在当前值上加减（没有上限时拒绝：先给一个上限）
//   "15+5"    → 算式（= 20，当前值）
//   "15-3"    → 算式（= 12，当前值）
//   其它      → ok:false + 中文提示，调用方保留原值（输入框不写盘）

/** token 上的血量键（与 track.js 的 KEY_HP、background.core.js 的 KEY_HP 一致）。 */
export const HPE_KEY_HP = "com.4enext-owlbear/hp";
/** 血条组件开关（独立键；保存时顺手写成 true，保证保存完立刻能看到）。 */
export const HPE_KEY_BAR = "com.4enext-owlbear/hp-bar/enabled";
/** 四防的四个键：顺序固定 AC / 强韧 / 反射 / 意志（与 token 渲染层一致）。 */
export const HPE_DEF_KEYS = ["ac", "fort", "reflex", "will"];
export const HPE_DEF_LABELS = { ac: "AC", fort: "强韧", reflex: "反射", will: "意志" };
/** 四防上限：4E 里再离谱也不会超过三位数，给 999 兜住手滑。 */
export const HPE_DEF_MAX = 999;
/** 生命上限上限（防止手滑输 99999999 把血条算糊）。 */
export const HPE_HP_MAX = 999999;
/** 临时生命上限（0~999，v2.4.32 新增；不做负数）。 */
export const HPE_TEMP_MAX = 999;

function numOrNull(v) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : null;
}

function clampInt(v, lo, hi) {
  const n = Math.round(v);
  if (!isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function normText(v) {
  return String(v == null ? "" : v).trim().replace(/[／∕]/g, "/").replace(/\s+/g, "");
}

/* ---------------------------------------------------------------------------
 * 1) 语法解析
 * ------------------------------------------------------------------------- */

/**
 * 解析生命输入。base = { cur, max }（当前值 / 上限，可以是 null）。
 * 返回 { ok:true, patch:{ cur, max? }, shape } 或 { ok:false, reason, message }。
 */
export function parseHpInput(text, base) {
  const raw = normText(text);
  const cur = numOrNull(base && base.cur);
  const max = numOrNull(base && base.max);
  if (!raw) {
    return { ok: false, reason: "empty", message: "先填一个生命值：20 / 20/20 / +5 / -3" };
  }
  let m = /^([+-])(\d+)$/.exec(raw);
  if (m) {
    if (!(max > 0)) {
      return { ok: false, reason: "no-max", message: "先设生命上限（比如 20），再用 " + raw };
    }
    const from = cur === null ? max : cur;
    const to = clampInt(from + (m[1] === "-" ? -1 : 1) * parseInt(m[2], 10), -max, max);
    return { ok: true, patch: { cur: to }, shape: "delta" };
  }
  m = /^(\d+)\/(\d+)$/.exec(raw);
  if (m) {
    const maxV = clampInt(parseInt(m[2], 10), 1, HPE_HP_MAX);
    const curV = clampInt(parseInt(m[1], 10), -maxV, maxV);
    return { ok: true, patch: { cur: curV, max: maxV }, shape: "pair" };
  }
  m = /^(\d+)([+-])(\d+)$/.exec(raw);
  if (m) {
    const left = parseInt(m[1], 10);
    const value = m[2] === "-" ? left - parseInt(m[3], 10) : left + parseInt(m[3], 10);
    const maxV = max === null ? clampInt(Math.max(value, 1), 1, HPE_HP_MAX) : max;
    return { ok: true, patch: { cur: clampInt(value, -maxV, maxV), max: maxV }, shape: "calc" };
  }
  m = /^(\d+)$/.exec(raw);
  if (m) {
    const maxV = clampInt(parseInt(m[1], 10), 1, HPE_HP_MAX);
    /* 20 → 上限 20：原来没有当前值时 = 满血 20/20；已有当前值时只夹到不超过上限。 */
    const curV = cur === null ? maxV : Math.min(cur, maxV);
    return { ok: true, patch: { cur: curV, max: maxV }, shape: "max" };
  }
  return {
    ok: false, reason: "syntax",
    message: "看不懂「" + raw + "」：可以填 20（上限）/ 20/20 / +5 / -3 / 15+5"
  };
}

/**
 * v2.4.32：编辑窗改成 Full Suite 药丸布局，字段拆成独立输入框。
 *   parseMaxInput("20")  → 上限（≥1，≤ HPE_HP_MAX）
 *   parseCurInput("20", {max}) → 当前值（0~上限）
 *   parseTempInput("5")  → 临时生命（0~999；空 = 0）
 * 返回 { ok:true, value } 或 { ok:false, message }。
 */
export function parseMaxInput(text) {
  const raw = normText(text);
  if (!raw) return { ok: false, reason: "empty", message: "生命上限至少填 1" };
  const m = /^(\d{1,7})$/.exec(raw);
  if (!m) return { ok: false, reason: "syntax", message: "生命上限只填数字（≥ 1）" };
  return { ok: true, value: clampInt(parseInt(m[1], 10), 1, HPE_HP_MAX) };
}

export function parseCurInput(text, base) {
  const raw = normText(text);
  if (!raw) return { ok: false, reason: "empty", message: "生命当前值要填 0 或以上" };
  const m = /^(-?\d{1,7})$/.exec(raw);
  if (!m) return { ok: false, reason: "syntax", message: "生命当前值只填数字" };
  const max = numOrNull(base && base.max);
  const hi = max && max > 0 ? max : HPE_HP_MAX;
  return { ok: true, value: clampInt(parseInt(m[1], 10), 0, hi) };
}

export function parseTempInput(text) {
  const raw = normText(text);
  if (!raw) return { ok: true, value: 0 };
  const m = /^(\d{1,3})$/.exec(raw);
  if (!m) return { ok: false, reason: "syntax", message: "临时生命填 0~999" };
  return { ok: true, value: clampInt(parseInt(m[1], 10), 0, HPE_TEMP_MAX) };
}

/**
 * 解析单个四防输入。**留空 = 不写这个字段 = 那枚盾不画**（规格 §6.1：缺字段 = 不画那枚盾）。
 * 返回 { ok:true, value: number|null } 或 { ok:false, message }。
 */
export function parseDefenseInput(text) {
  const raw = normText(text);
  if (!raw) return { ok: true, value: null };
  const m = /^(\d{1,4})$/.exec(raw);
  if (!m) return { ok: false, reason: "syntax", message: "只填数字（留空 = 不画这枚盾）" };
  return { ok: true, value: clampInt(parseInt(m[1], 10), 0, HPE_DEF_MAX) };
}

/* ---------------------------------------------------------------------------
 * 2) 表单 → 写盘 patch
 * ------------------------------------------------------------------------- */

/**
 * v2.4.32：把表单值换算成要写进 hp 的字段。form = { cur, max, temp, locked?, defs:{ac,fort,reflex,will} }。
 * base = 当前 view（hpEditView 的结果）。
 * 返回 { ok:true, patch:{ cur, max, temp, defenses, locked? } } 或 { ok:false, message }。
 * 注意 patch.defenses **总是**出现：四个框全空 = null = 把 defenses 从 metadata 里删掉（一枚盾都不画）。
 */
export function buildHpEditPatch(form, base) {
  const f = form || {};
  const b = base || {};
  const patch = {};
  const maxParsed = parseMaxInput(f.max);
  if (!maxParsed.ok) return { ok: false, field: "max", message: maxParsed.message };
  patch.max = maxParsed.value;
  const curParsed = parseCurInput(f.cur, { max: patch.max });
  if (!curParsed.ok) return { ok: false, field: "cur", message: curParsed.message };
  patch.cur = curParsed.value;
  const tempParsed = parseTempInput(f.temp);
  if (!tempParsed.ok) return { ok: false, field: "temp", message: tempParsed.message };
  patch.temp = tempParsed.value;
  if ("locked" in f) patch.locked = !!f.locked;
  if ("hide" in f) patch.hide = !!f.hide;
  const defs = {};
  let defAny = false;
  const src = f.defs || {};
  for (let i = 0; i < HPE_DEF_KEYS.length; i++) {
    const key = HPE_DEF_KEYS[i];
    const one = parseDefenseInput(src[key]);
    if (!one.ok) return { ok: false, field: key, message: HPE_DEF_LABELS[key] + "：" + one.message };
    if (one.value !== null) { defs[key] = one.value; defAny = true; }
  }
  patch.defenses = defAny ? defs : null;
  return { ok: true, patch: patch, hasDefenses: defAny };
}

/* ---------------------------------------------------------------------------
 * 3) 夹取 + 写盘（参考实现 edit.ts：跨字段夹取，每次都做）
 * ------------------------------------------------------------------------- */
/**
 * 把 patch 合进当前 metadata，返回新的 hp 对象（**不改入参**）。
 * 跨字段夹取：cur ≤ max（4E 到负上限即死亡，所以下限是 −max）、surges ≤ surgesMax；
 * 空值不落盘（defenses:null → 删掉键，而不是写 null）。
 */
export function applyHpEdit(rawMeta, patch, now) {
  const out = rawMeta && typeof rawMeta === "object" ? JSON.parse(JSON.stringify(rawMeta)) : {};
  const p = patch || {};
  if ("max" in p) out.max = clampInt(p.max, 1, HPE_HP_MAX);
  if ("cur" in p) out.cur = p.cur;
  if ("temp" in p) out.temp = clampInt(p.temp, 0, HPE_TEMP_MAX);
  /* v2.4.32：surges / surgesMax 数据**只读不写**（编辑窗已去掉回复力字段）。 */
  if ("locked" in p) out.locked = !!p.locked;
  if ("hide" in p) out.hide = !!p.hide;
  if ("defenses" in p) {
    if (p.defenses && typeof p.defenses === "object") {
      const def = {};
      let any = false;
      for (let i = 0; i < HPE_DEF_KEYS.length; i++) {
        const key = HPE_DEF_KEYS[i];
        const v = p.defenses[key];
        if (typeof v === "number" && isFinite(v)) { def[key] = Math.max(0, Math.round(v)); any = true; }
      }
      if (any) out.defenses = def;
      else delete out.defenses;
    } else {
      delete out.defenses;
    }
  }
  /* 跨字段夹取：v2.4.32 当前生命 0~上限（4E 负数血由其它 UI 处理，编辑窗不做）。 */
  if (typeof out.max === "number" && out.max > 0) {
    if (typeof out.cur === "number") out.cur = Math.max(0, Math.min(out.cur, out.max));
  }
  out.updatedAt = typeof now === "number" && isFinite(now) ? Math.round(now) : Date.now();
  return out;
}

/* ---------------------------------------------------------------------------
 * 2.5) v1.7.7：Boss 锁（hp.locked）→ 编辑窗只读
 * ---------------------------------------------------------------------------
 * locked 的语义（v1.6.0 起，规格 §6.8「玩家可见性」）：**玩家端**看不到精确数字与四防，
 * 默认 true。所以这里按「锁是给玩家看的」来判：
 *   · **城主不受这条限制** —— locked 默认就是 true，如果连城主都锁死，那「点开编辑窗改血量」
 *     对绝大多数 token 都是灰的（真机截图里那枚 Boss 就是锁着的），等于这次要的功能没做；
 *   · **其他玩家**：hp.locked === true → 只读（藏保存 + 提示「已锁定」）；
 *     只看**显式** true（undefined = 从没锁过），保住 v1.7.2「创建者能改自己放上桌的 token」。
 * 只读只管「输入 + 保存」：✕ / 取消 / Esc 照旧能关窗（见 hp-edit-page.js 的 setEditable）。
 */
export function hpEditReadOnly(meta, role) {
  if (!meta || typeof meta !== "object") return false;
  if (role === "GM") return false;
  return meta.locked === true;
}

/** 权限：城主能改一切；玩家只能改自己放上桌的 token（Owlbear 的 item 权限就是这样）。 */
export function mayEditToken(item, role, playerId) {
  if (!item || !item.id) return false;
  /* GM 优先：只要宿主给了 GM 判定，就不再看 createdUserId。 */
  if (role === "GM") return true;
  /* v2.4.32：老 token / 导入 token 常常没有 createdUserId；玩家端放宽为可编辑，
   * 避免「创建者缺失 → 永远只读、连自己放的怪都改不了」。 */
  if (item.createdUserId == null || item.createdUserId === "") return true;
  return !!(playerId && item.createdUserId === playerId);
}

/**
 * 写盘：读最新 → 权限 → updateItems（**回调里再校验一次**）→ 写 hp + 开关。
 * deps = { getItems(ids), updateItems(ids, fn), getRole(), getId(), now?() }（页面传 OBR 那一套，
 * 测试传假实现）；返回 { ok:true, hp } 或 { ok:false, message }。
 *
 * 为什么要在 updateItems 的回调里再校验：SDK 的 draft 是**延迟执行**的，
 * 期间 token 可能已被删掉 / 换了主人（参考实现 edit.ts 的两次校验，规格 §2.6）。
 */
export async function writeHpEdit(deps, itemId, patch) {
  if (!deps || typeof deps.getItems !== "function" || typeof deps.updateItems !== "function") {
    return { ok: false, message: "编辑窗没有拿到 OBR 接口" };
  }
  if (!itemId) return { ok: false, message: "没有选中 token" };
  let role = "";
  let playerId = "";
  try { role = await deps.getRole(); } catch (e) { role = ""; }
  try { playerId = await deps.getId(); } catch (e) { playerId = ""; }

  let list = [];
  try { list = (await deps.getItems([itemId])) || []; } catch (e) { list = []; }
  const item = list.filter(function (it) { return it && it.id === itemId; })[0] || null;
  if (!item) return { ok: false, message: "这枚 token 已经不在了（可能被删掉 / 换了场景）" };
  if (!mayEditToken(item, role, playerId)) {
    return { ok: false, message: "只有城主或这枚 token 的创建者能改血量与四防" };
  }

  let next = null;
  const stamp = typeof deps.now === "function" ? deps.now() : Date.now();
  try {
    await deps.updateItems([itemId], function (drafts) {
      for (let i = 0; i < (drafts || []).length; i++) {
        const it = drafts[i];
        if (!it || it.id !== itemId) continue;
        /* 第二次校验：这一份草稿是不是还归我改 */
        if (!mayEditToken(it, role, playerId)) {
          throw new Error("这枚 token 已经不能改了（创建者变了 / 权限变了）");
        }
        if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
        next = applyHpEdit(it.metadata[HPE_KEY_HP], patch, stamp);
        it.metadata[HPE_KEY_HP] = next;
        /* 保存即确保血条组件开着（移除写 false 只是不画，数据不删，这里再打开） */
        it.metadata[HPE_KEY_BAR] = true;
      }
    });
  } catch (e) {
    return { ok: false, message: "写不进去：" + (e && e.message ? e.message : e) };
  }
  if (!next) return { ok: false, message: "没写进去：这枚 token 没有返回草稿（可能刚被删掉）" };
  return { ok: true, hp: next };
}

/**
 * v1.8.5：自动保存去重 —— buildHpEditPatch 的结果与当前 view 相同就不写 token。
 * 只比较 patch 里出现的字段（cur / max / surges / surgesMax / defenses），
 * defenses 按四个盾逐个比（缺字段 = null）；返回 true 表示「无需写盘」。
 */
export function hpPatchEqualsView(patch, view) {
  const p = patch || {};
  const v = view || {};
  const pairs = [["cur", "cur"], ["max", "max"], ["temp", "temp"]];
  for (const pair of pairs) {
    const pk = pair[0];
    const vk = pair[1];
    if (!(pk in p)) continue;
    const a = p[pk] === null || p[pk] === undefined ? null : Math.round(p[pk]);
    const b = v[vk] === null || v[vk] === undefined ? null : Math.round(v[vk]);
    if (a !== b) return false;
  }
  if ("locked" in p && !!p.locked !== !!v.locked) return false;
  const pa = p.defenses || null;
  const va = v.defenses || null;
  if (!pa && !va) return true;
  if (!pa || !va) return false;
  for (let i = 0; i < HPE_DEF_KEYS.length; i++) {
    const key = HPE_DEF_KEYS[i];
    const a = pa[key] === null || pa[key] === undefined ? null : Math.round(pa[key]);
    const b = va[key] === null || va[key] === undefined ? null : Math.round(va[key]);
    if (a !== b) return false;
  }
  return true;
}

/* ---------------------------------------------------------------------------
 * 4) 表单默认值（token 优先，没有再看角色卡）
 * ------------------------------------------------------------------------- */

/**
 * 编辑窗打开时填进输入框的默认值。
 * meta = token 的 hp 元数据；card = 从绑定角色卡推导出来的 { max, surges, surgesMax, defenses }。
 * 规则：**token 上有值就用 token 的**（那才是真实状态，别把掉的血盖回去）；
 *       token 上没有的字段才用卡里的（这样「只改一点」不用重新填一遍）。
 */
export function hpEditView(meta, card) {
  const m = meta && typeof meta === "object" ? meta : {};
  const view = {
    cur: numOrNull(m.cur),
    max: numOrNull(m.max),
    temp: numOrNull(m.temp),
    locked: m.locked !== false,
    hide: m.hide === true,
    defenses: null,
    fromCard: false
  };
  if (view.temp === null) view.temp = 0;
  if (m.defenses && typeof m.defenses === "object") {
    const def = {};
    let any = false;
    for (let i = 0; i < HPE_DEF_KEYS.length; i++) {
      const key = HPE_DEF_KEYS[i];
      const v = numOrNull(m.defenses[key]);
      if (v !== null) { def[key] = Math.max(0, v); any = true; }
    }
    if (any) view.defenses = def;
  }
  const c = card && typeof card === "object" ? card : null;
  if (c) {
    if (view.max === null && typeof c.max === "number" && c.max > 0) {
      view.max = Math.round(c.max);
      view.fromCard = true;
    }
    if (view.cur === null && view.max !== null) view.cur = view.max;
    if (!view.defenses && c.defenses && typeof c.defenses === "object") {
      const def = {};
      let any = false;
      for (let i = 0; i < HPE_DEF_KEYS.length; i++) {
        const key = HPE_DEF_KEYS[i];
        const v = numOrNull(c.defenses[key]);
        if (v !== null) { def[key] = Math.max(0, v); any = true; }
      }
      if (any) { view.defenses = def; view.fromCard = true; }
    }
  }
  return view;
}

/** v2.4.32：药丸布局的独立输入框文字（当前 / 上限 / 临时生命）。 */
export function curText(view) {
  const v = view || {};
  return v.cur === null || v.cur === undefined ? "" : String(Math.round(v.cur));
}
export function maxText(view) {
  const v = view || {};
  return v.max === null || v.max === undefined ? "" : String(Math.round(v.max));
}
export function tempText(view) {
  const v = view || {};
  /* v2.4.32：0 也留空，让 placeholder「—」提示这里可以填；空值保存仍按 0 处理。 */
  return v.temp ? String(Math.round(v.temp)) : "";
}

/** 生命比例（0~1，给药丸背景填充用）；没有上限时按 0。 */
export function hpRatio(view) {
  const v = view || {};
  const max = typeof v.max === "number" && v.max > 0 ? v.max : 0;
  const cur = typeof v.cur === "number" ? v.cur : 0;
  if (!max) return 0;
  return Math.max(0, Math.min(1, cur / max));
}

/** 单个四防输入框里的文字（没有就留空 = 不画那枚盾）。 */
export function defText(view, key) {
  const d = view && view.defenses;
  if (!d || typeof d[key] !== "number") return "";
  return String(Math.round(d[key]));
}

/* ---------------------------------------------------------------------------
 * 5) 版本租约（规格 §2.2 的 HpTargetLease 简化版）
 * ---------------------------------------------------------------------------
 * 后台广播 { session, version, itemId, pending }；页面只接受
 * 「同一个 session + version 严格递增」的包，靠 epoch 拒绝乱序（含 A→B→A）。
 */
export function createHpEditLease(session) {
  let state = {
    session: typeof session === "string" ? session : "",
    version: 0,
    itemId: null,
    pending: true
  };
  let epoch = 0;
  let request = 0;
  return {
    get state() {
      return { session: state.session, version: state.version, itemId: state.itemId, pending: state.pending };
    },
    get epoch() { return epoch; },
    get request() { return request; },
    /** 收一个 target 包；乱序 / 换会话 / 字段不合法 → false（调用方什么都不做）。 */
    accept: function (value) {
      if (!value || typeof value !== "object") return false;
      if (value.session !== state.session) return false;
      if (typeof value.version !== "number" || !isFinite(value.version) ||
        Math.floor(value.version) !== value.version || value.version <= state.version) return false;
      if (value.itemId !== null && typeof value.itemId !== "string") return false;
      if (typeof value.pending !== "boolean") return false;
      state = {
        session: state.session,
        version: value.version,
        itemId: value.itemId,
        pending: value.pending
      };
      epoch++;
      request++;
      return true;
    },
    /** 拿「当前该编辑谁」；pending / 没有 itemId → null。current() 为 false 表示期间又换过 target。 */
    capture: function () {
      if (!state.itemId || state.pending) return null;
      const mine = epoch;
      return {
        itemId: state.itemId,
        current: function () { return mine === epoch && !state.pending; }
      };
    }
  };
}
