// v1.5.0：骰子**纯函数核心**（表达式解析 / 掷骰 / 重击取满 / 载荷归一化 / 合并去重）。
// ---------------------------------------------------------------------------
// 为什么单独一个文件：
//   · 骰子窗口（dice.html + assets/dice-page.js）要有 UI，但**规则**必须能脱离浏览器测试；
//   · 这里不 import OBR、不碰 DOM、不读房间数据 → node dev/test-dice.mjs 直接 import 就能跑；
//   · GM 落库那一侧在 assets/background.core.js（经典脚本，不能 import），所以那边的
//     rollNorm / rollMerge 是这里的**同位实现**；dev/check.mjs 会断言两边的上限、频道名一字不差。
//
// 规格：docs/spec-dice.md（§1 协议 / §2 表达式 / §3.5 4E 预设 / §8 自测）。
// 用户拍板（覆盖规格 D1–D3）：
//   · **不做命中判定**：没有 TN 输入，载荷里没有 target / hit，只有每骰点数与总点数；
//   · **重击 = 4E 版**：所有伤害骰取最大值（d6→6、d8→8），不是 5E 的骰数翻倍；
//     公式里带 adv / dis / max / min / reset* / burst / repeat 等包裹时无法逐颗取满，
//     退化为普通投掷并给出提示（critDegraded / note）；
//   · 优势 / 劣势按钮、暗骰、示例框都不做（语法层仍保留，粘贴旧公式照样能掷）。

/** 窗口里显示的七颗骰子（顺序就是按钮顺序）。 */
export const DICE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
/** 常见面数（自定义面数用 sidesOf 解析，别查这张表：查表会把 d600 夹到 20）。 */
export const DIE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
/** 规格 §4.2 的尺寸系数（P4 动画才用得上，这里先留着，免得以后返工）。 */
export const DIE_SIZE_FACTOR = { d4: 0.78, d6: 0.85, d8: 0.9, d10: 0.93, d12: 0.96, d20: 1, d100: 1.06 };

/** 房间数据 com.4enext-owlbear/rolls 的 rows 上限（≈8~9 KB，给角色卡留一半空间）。 */
export const ROLL_MAX_ROWS = 40;
/** 单条记录里最多保留多少颗骰子（超出截断并标记 truncated）。 */
export const ROLL_MAX_DICE = 30;
/** 备注 / 公式在房间数据里的截断长度（规格 §1.6）。 */
export const ROLL_LABEL_MAX = 40;
export const ROLL_EXPR_MAX = 200;
/** 同一个 rollId 的去重窗口（收广播 / 落库都看它，规格 §1.4）。 */
export const ROLL_DEDUPE_MS = 30000;
/** 连点「投掷」的快速去重窗口（规格 §1.4 的 250ms）。 */
export const ROLL_QUICK_DEDUPE_MS = 250;
/** 重击遇到包裹表达式时的提示文案（UI 原样显示）。 */
export const ROLL_CRIT_NOTE = "重击只对平铺伤害骰生效：公式里的 adv / dis / max / min / reset / burst / repeat 无法逐颗取满，本次已按普通投掷。";

/* ---------------------------------------------------------------------------
 * 1) 小工具
 * ------------------------------------------------------------------------- */
function numOr(v, d) {
  return typeof v === "number" && isFinite(v) ? v : d;
}
function str(v) {
  return v == null ? "" : String(v);
}
function trunc(s, n) {
  const t = str(s);
  return t.length > n ? t.slice(0, n) : t;
}
function colorOf(v) {
  const s = str(v).trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : "#5dade2";
}

/** 面数：**必须**按字符串解析（d600 就是 600）；非法类型返回 0。 */
export function sidesOf(type) {
  const m = /^d(\d+)$/i.exec(str(type).trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : 0;
}

/** 每次投掷的唯一 id（也是去重键、历史行的 key）。 */
export function makeRollId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

/* ---------------------------------------------------------------------------
 * 2) 表达式：规范化 / 顶层切分 / wrapper 头 / 平铺解析
 * ------------------------------------------------------------------------- */
/** 全角括号 / 逗号 / 加减号统一成半角，并去掉所有空白（规格 §2.3 第 1 步）。 */
export function normalizeExpr(raw) {
  let s = str(raw);
  s = s.replace(/[（]/g, "(").replace(/[）]/g, ")");
  s = s.replace(/[，、]/g, ",");
  s = s.replace(/[＋]/g, "+").replace(/[－—–−]/g, "-");
  s = s.replace(/\s+/g, "");
  return s;
}

/** 按「深度 0 的 +/-」切成带符号的项（括号里的加减不算）。 */
export function splitTopLevel(src) {
  const s = str(src);
  const out = [];
  let depth = 0;
  let cur = "";
  let sign = 1;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === "(") { depth++; cur += ch; continue; }
    if (ch === ")") { depth--; cur += ch; continue; }
    if (depth === 0 && (ch === "+" || ch === "-")) {
      if (!cur) { sign = ch === "-" ? -1 : 1; continue; }
      out.push({ sign: sign, body: cur });
      cur = "";
      sign = ch === "-" ? -1 : 1;
      continue;
    }
    cur += ch;
  }
  if (cur) out.push({ sign: sign, body: cur });
  return out;
}

/** 深度 0 的逗号位置（max(1d6+2,3) 的 X 在最后一个逗号后）。 */
function topLevelCommas(s) {
  const out = [];
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) out.push(i);
  }
  return out;
}

const WRAPPER_RE = /^(adv|dis|resetmin|resetmax|reset|max|min|same|burst|repeat)\(/i;

/**
 * 项首是不是 FUNC( … )？是就返回 { wrapper, inner, tail }。
 * adv/dis 的参数是**最后一个**顶层逗号后的组数；repeat 的参数是**第一个**顶层逗号前的次数。
 */
export function readWrapperHead(text) {
  const s = str(text);
  const m = WRAPPER_RE.exec(s);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  let depth = 0;
  let close = -1;
  for (let i = m[0].length - 1; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close < 0) return null;
  let inner = s.slice(m[0].length, close);
  const tail = s.slice(close + 1);
  const commas = topLevelCommas(inner);
  let param;
  if (kind === "repeat") {
    if (!commas.length) return null;
    const first = commas[0];
    const n = parseInt(inner.slice(0, first), 10);
    if (!(n >= 1)) return null;
    param = Math.max(1, Math.min(20, n));
    inner = inner.slice(first + 1);
  } else if (kind === "adv" || kind === "dis") {
    if (commas.length) {
      const last = commas[commas.length - 1];
      const n = parseInt(inner.slice(last + 1), 10);
      if (n >= 1) { param = n; inner = inner.slice(0, last); }
    }
  } else if (kind === "max" || kind === "min" || kind === "reset" || kind === "resetmin" || kind === "resetmax") {
    if (!commas.length) return null;
    const last = commas[commas.length - 1];
    const n = parseInt(inner.slice(last + 1), 10);
    if (isNaN(n)) return null;
    param = n;
    inner = inner.slice(0, last);
  }
  const wrapper = { kind: kind };
  if (param !== undefined) wrapper.param = param;
  return { wrapper: wrapper, inner: inner, tail: tail };
}

/** 「2d6+1d20+5」→ { groups:[{type,count}], modifier }；regex 与规格 §2.3 一致。 */
export function parsePlain(text) {
  const out = { groups: [], modifier: 0 };
  const s = str(text);
  const re = /([+\-]?)(?:(\d*)d(\d+)|(\d+))/gi;
  let m;
  while ((m = re.exec(s))) {
    const sign = m[1] === "-" ? -1 : 1;
    if (m[3] != null) {
      const count = (m[2] === "" ? 1 : parseInt(m[2], 10)) * sign;
      const sides = parseInt(m[3], 10);
      if (!(sides >= 1)) continue;
      out.groups.push({ type: "d" + sides, count: count });
    } else if (m[4] != null) {
      out.modifier += parseInt(m[4], 10) * sign;
    }
  }
  return out;
}

export function hasDice(plain) {
  const groups = (plain && plain.groups) || [];
  for (let i = 0; i < groups.length; i++) if (groups[i] && groups[i].count) return true;
  return false;
}

export function negatePlain(plain) {
  const out = { groups: [], modifier: -(plain && plain.modifier ? plain.modifier : 0) };
  for (const g of (plain && plain.groups) || []) out.groups.push({ type: g.type, count: -g.count });
  return out;
}

function scalePlain(plain, sign) {
  return sign < 0 ? negatePlain(plain) : { groups: (plain.groups || []).map(function (g) { return { type: g.type, count: g.count }; }), modifier: plain.modifier || 0 };
}

export function mergePlain(a, b) {
  const out = { groups: [], modifier: (a && a.modifier ? a.modifier : 0) + (b && b.modifier ? b.modifier : 0) };
  const idx = {};
  for (const g of ((a && a.groups) || []).concat((b && b.groups) || [])) {
    if (!g || !g.count) continue;
    if (idx[g.type] == null) { idx[g.type] = out.groups.length; out.groups.push({ type: g.type, count: g.count }); }
    else out.groups[idx[g.type]].count += g.count;
  }
  return out;
}

function plainEmpty(plain) {
  return !hasDice(plain) && !(plain && plain.modifier);
}

function parseExprInner(s) {
  const segments = [];
  let outer = { groups: [], modifier: 0 };
  for (const term of splitTopLevel(s)) {
    const body = term.body || "";
    if (!body) continue;
    const head = readWrapperHead(body);
    if (head) {
      const inner = parseExprInner(head.inner);
      if (!plainEmpty(inner.outerPlain)) {
        segments.push({ plain: scalePlain(inner.outerPlain, term.sign), wrappers: [head.wrapper] });
      }
      for (const seg of inner.segments) {
        segments.push({
          plain: scalePlain(seg.plain, term.sign),
          wrappers: seg.wrappers.concat([head.wrapper])
        });
      }
      if (head.tail) {
        /* 兜底：adv(1d20)5 这种脏输入，尾巴按平铺项算 */
        outer = mergePlain(outer, parsePlain((term.sign < 0 ? "-" : "+") + head.tail));
      }
    } else {
      outer = mergePlain(outer, parsePlain((term.sign < 0 ? "-" : "+") + body));
    }
  }
  return { segments: segments, outerPlain: outer };
}

/** 只有一个 segment 时回填 plain / wrappers（兼容旧调用）；顺便丢掉空 segment。 */
function finalizeParsed(p) {
  const segments = [];
  for (const seg of p.segments || []) {
    if (!seg || !seg.plain) continue;
    if (plainEmpty(seg.plain) && !(seg.wrappers || []).length) continue;
    segments.push({ plain: seg.plain, wrappers: (seg.wrappers || []).slice() });
  }
  const outerPlain = p.outerPlain || { groups: [], modifier: 0 };
  const out = { segments: segments, outerPlain: outerPlain };
  if (segments.length === 1) {
    out.plain = segments[0].plain;
    out.wrappers = segments[0].wrappers;
  } else {
    out.plain = { groups: [], modifier: 0 };
    out.wrappers = [];
  }
  return out;
}

/** 解析整条表达式。空 / 看不懂都返回空结构（UI 用 parsedIsEmpty 判断）。 */
export function parseExpr(raw) {
  const s = normalizeExpr(raw);
  return finalizeParsed(parseExprInner(s));
}

export function parsedIsEmpty(parsed) {
  const p = parsed || {};
  if ((p.segments || []).length) return false;
  return plainEmpty(p.outerPlain);
}

/** 结构 → 规范化字符串（历史 / 广播里的 expression 用的就是它，不是用户原始输入）。 */
export function formatPlain(plain) {
  const tokens = [];
  for (const g of (plain && plain.groups) || []) {
    if (!g || !g.count) continue;
    tokens.push({ sign: g.count < 0 ? "-" : "+", text: Math.abs(g.count) + g.type });
  }
  const mod = plain && plain.modifier ? plain.modifier : 0;
  if (mod) tokens.push({ sign: mod < 0 ? "-" : "+", text: String(Math.abs(mod)) });
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i === 0) out = (t.sign === "-" ? "-" : "") + t.text;
    else out += (t.sign === "-" ? " - " : " + ") + t.text;
  }
  return out;
}

function formatWrapper(w, innerText) {
  if (!w) return innerText;
  if (w.kind === "same" || w.kind === "burst") return w.kind + "(" + innerText + ")";
  if (w.kind === "adv" || w.kind === "dis") {
    return w.kind + "(" + innerText + (w.param != null ? "," + w.param : "") + ")";
  }
  const p = w.param != null ? w.param : 0;
  return w.kind + "(" + innerText + "," + p + ")";
}

export function formatExpr(parsed) {
  const p = parsed || {};
  const parts = [];
  for (const seg of p.segments || []) {
    let text = formatPlain(seg.plain);
    for (const w of seg.wrappers || []) text = formatWrapper(w, text);
    if (text) parts.push(text);
  }
  const outerText = formatPlain(p.outerPlain);
  if (outerText) parts.push(outerText);
  let out = "";
  for (const t of parts) {
    if (!out) out = t;
    else if (t.charAt(0) === "-") out += " - " + t.slice(1);
    else out += " + " + t;
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 3) 编辑器动作（骰子按钮 +1 / 右键 −1、加值 ±1、徽标数字）
 * ------------------------------------------------------------------------- */
function cloneParsed(parsed) {
  const p = parsed || { segments: [], outerPlain: { groups: [], modifier: 0 } };
  const out = {
    segments: (p.segments || []).map(function (s) {
      return {
        plain: { groups: (s.plain.groups || []).map(function (g) { return { type: g.type, count: g.count }; }), modifier: s.plain.modifier || 0 },
        wrappers: (s.wrappers || []).map(function (w) { return Object.assign({}, w); })
      };
    }),
    outerPlain: {
      groups: ((p.outerPlain && p.outerPlain.groups) || []).map(function (g) { return { type: g.type, count: g.count }; }),
      modifier: (p.outerPlain && p.outerPlain.modifier) || 0
    }
  };
  return out;
}

/** 点某颗骰子 +1 / 右键 −1：只改 outerPlain；count 归 0 就删组，负数保留（＝减骰）。 */
export function adjustExprForType(parsed, type, delta) {
  const p = cloneParsed(parsed);
  const want = str(type).toLowerCase();
  const groups = p.outerPlain.groups;
  let idx = -1;
  for (let i = 0; i < groups.length; i++) if (groups[i].type === want) { idx = i; break; }
  if (idx < 0) {
    if (!delta) return finalizeParsed(p);
    p.outerPlain.groups.push({ type: want, count: delta });
  } else {
    groups[idx].count += delta;
    if (!groups[idx].count) groups.splice(idx, 1);
  }
  return finalizeParsed(p);
}

/** 加值 ±1；4E「战斗优势」就是 adjustExprModifier(parsed, +2)。 */
export function adjustExprModifier(parsed, delta) {
  const p = cloneParsed(parsed);
  p.outerPlain.modifier = (p.outerPlain.modifier || 0) + (delta || 0);
  return finalizeParsed(p);
}

/** 每种骰子在**整条表达式**里的净数量（含 segments 与 outerPlain，规格 §2.6）。 */
export function countDiceByType(parsed) {
  const out = {};
  const add = function (plain) {
    for (const g of (plain && plain.groups) || []) {
      if (!g || !g.count) continue;
      out[g.type] = (out[g.type] || 0) + g.count;
    }
  };
  for (const seg of (parsed && parsed.segments) || []) add(seg.plain);
  add(parsed && parsed.outerPlain);
  return out;
}

/* ---------------------------------------------------------------------------
 * 4) 掷骰：rollPlainSet / applyValueClamp / rollSegment / rollParsed
 * ------------------------------------------------------------------------- */
/** 单颗骰：1..sides（rand 注入是为了自测能断言）。 */
export function rollDie(sides, rand) {
  const n = sides > 0 ? sides : 20;
  const r = typeof rand === "function" ? rand() : Math.random();
  const v = Math.floor(Math.max(0, Math.min(0.999999999, numOr(r, 0))) * n) + 1;
  return Math.max(1, Math.min(n, v));
}

/** 平铺项掷一遍：正 count 正常骰，负 count 掷出来但标 subtract（总和减）。 */
export function rollPlainSet(plain, ctx) {
  const c = ctx || {};
  const rand = c.rand || Math.random;
  const dice = [];
  for (const g of (plain && plain.groups) || []) {
    if (!g || !g.count) continue;
    const sides = sidesOf(g.type);
    if (!sides) continue;
    const n = Math.abs(g.count);
    for (let i = 0; i < n; i++) {
      const one = { type: "d" + sides, value: c.maximize ? sides : rollDie(sides, rand) };
      if (g.count < 0) one.subtract = true;
      dice.push(one);
    }
  }
  return dice;
}

/** max 抬下限 / min 压上限 / reset* 命中重掷一次；loser 骰不参与（规格 §2.4）。 */
export function applyValueClamp(die, kind, x, rand) {
  if (!die || die.loser) return die;
  const sides = sidesOf(die.type) || 20;
  const value = numOr(die.value, 1);
  let next = value;
  if (kind === "max") next = Math.max(value, x);
  else if (kind === "min") next = Math.min(value, x);
  else if (kind === "reset" && value === x) next = rollDie(sides, rand);
  else if (kind === "resetmin" && value <= x) next = rollDie(sides, rand);
  else if (kind === "resetmax" && value >= x) next = rollDie(sides, rand);
  else return die;
  if (next === value) return die;
  const out = Object.assign({}, die, { value: next });
  if (typeof die.originalValue !== "number") out.originalValue = value;
  return out;
}

function sumDice(dice) {
  let sum = 0;
  for (const d of dice || []) {
    if (!d || d.loser) continue;
    sum += d.subtract ? -Math.abs(d.value) : d.value;
  }
  return sum;
}

/** 一个 segment 掷一遍（wrappers 内层在前，规格 §2.4）。 */
export function rollSegment(plain, wrappers, ctx) {
  const ws = wrappers || [];
  if (!ws.length) return { dice: rollPlainSet(plain, ctx), winnerIdx: -1 };
  const outer = ws[ws.length - 1];
  const inner = ws.slice(0, ws.length - 1);
  const rand = (ctx && ctx.rand) || Math.random;

  if (outer.kind === "adv" || outer.kind === "dis") {
    const n = Math.max(1, Math.min(10, numOr(outer.param, 1)));
    const sets = [];
    for (let i = 0; i < n + 1; i++) sets.push(rollSegment(plain, inner, ctx));
    const sums = sets.map(function (s) { return sumDice(s.dice); });
    let win = 0;
    for (let i = 1; i < sets.length; i++) {
      if (outer.kind === "adv" ? sums[i] > sums[win] : sums[i] < sums[win]) win = i;
    }
    const dice = [];
    let before = 0;
    for (let i = 0; i < sets.length; i++) {
      if (i === win) before = dice.length;
      for (const d of sets[i].dice) {
        dice.push(i === win ? d : Object.assign({}, d, { loser: true }));
      }
    }
    const winCount = sets[win].dice.length;
    return { dice: dice, winnerIdx: winCount === 1 ? before : -1 };
  }

  const base = rollSegment(plain, inner, ctx);

  if (outer.kind === "max" || outer.kind === "min" || outer.kind === "reset" || outer.kind === "resetmin" || outer.kind === "resetmax") {
    const x = numOr(outer.param, 0);
    return {
      dice: base.dice.map(function (d) { return applyValueClamp(d, outer.kind, x, rand); }),
      winnerIdx: base.winnerIdx
    };
  }

  if (outer.kind === "burst") {
    const dice = base.dice.slice();
    for (let i = 0; i < base.dice.length; i++) {
      const first = base.dice[i];
      if (!first || first.loser) continue;
      let parent = i;
      let chain = 0;
      let cur = first;
      while (cur && !cur.loser && cur.value >= sidesOf(cur.type) && chain < 5) {
        const nxt = {
          type: cur.type,
          value: rollDie(sidesOf(cur.type), rand),
          burstParent: parent
        };
        dice.push(nxt);
        parent = dice.length - 1;
        cur = nxt;
        chain++;
      }
    }
    return { dice: dice, winnerIdx: -1 };
  }

  /* same 纯视觉，不改数值 */
  return base;
}

/** 总和（三处必须一致：投掷端 / 广播端 / normalizeRoll 重算）。 */
export function computeTotal(dice, modifier, rowCount) {
  const rows = typeof rowCount === "number" && rowCount > 0 ? rowCount : 1;
  let base = 0;
  for (const d of dice || []) {
    if (!d || d.loser) continue;
    base += d.subtract ? -Math.abs(d.value) : d.value;
  }
  return base + numOr(modifier, 0) * rows;
}

/** repeat 每一行各自的总和（每行都加一次 modifier）。 */
export function rowTotals(dice, rowStarts, modifier) {
  const starts = Array.isArray(rowStarts) ? rowStarts : [];
  if (starts.length < 2) return [computeTotal(dice, modifier, 1)];
  const out = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1] : (dice || []).length;
    out.push(computeTotal((dice || []).slice(from, to), modifier, 1));
  }
  return out;
}

function lastKind(wrappers) {
  return wrappers && wrappers.length ? wrappers[wrappers.length - 1].kind : "";
}

/**
 * 掷整条表达式。
 * opts = { rand, crit }
 *   crit=true：**所有伤害骰取满**（4E 重击）。
 *   公式带任何 wrapper 时无法逐颗取满 → 退化为普通投掷，critDegraded=true 并给 note。
 */
export function rollParsed(parsed, opts) {
  const o = opts || {};
  const rand = o.rand || Math.random;
  const p = parsed || { segments: [], outerPlain: { groups: [], modifier: 0 } };
  const segments = p.segments || [];
  const outerPlain = p.outerPlain || { groups: [], modifier: 0 };
  const ctx = { rand: rand, maximize: false };

  const wrapped = segments.some(function (s) { return (s.wrappers || []).length > 0; });
  const wantCrit = !!o.crit;
  let critApplied = false;
  let critDegraded = false;
  if (wantCrit) {
    if (wrapped) critDegraded = true;
    else { ctx.maximize = true; critApplied = true; }
  }

  let rowCount = 1;
  let segPlain = null;
  let segWrappers = null;
  if (segments.length === 1 && lastKind(segments[0].wrappers) === "repeat" && plainEmpty(outerPlain)) {
    const w = (segments[0].wrappers || []).slice();
    const rp = w.pop();
    rowCount = Math.max(1, Math.min(20, numOr(rp.param, 1)));
    segPlain = segments[0].plain;
    segWrappers = w;
  }

  const dice = [];
  const rowStarts = [];
  if (rowCount > 1) {
    for (let i = 0; i < rowCount; i++) {
      rowStarts.push(dice.length);
      const r = rollSegment(segPlain, segWrappers, ctx);
      for (const d of r.dice) dice.push(d);
    }
  } else {
    for (const seg of segments) {
      const r = rollSegment(seg.plain, seg.wrappers, ctx);
      for (const d of r.dice) dice.push(d);
    }
    if (hasDice(outerPlain)) {
      const r = rollSegment(outerPlain, [], ctx);
      for (const d of r.dice) dice.push(d);
    }
  }

  /* repeat 的加值写在 inner 平铺项里（repeat(3,1d6+2) 的 +2 属于每一行），
   * 所以行数 > 1 时取 inner 的 modifier，计算总和时按行各加一次（规格 §2.5）。 */
  const modifier = rowCount > 1 && segPlain ? numOr(segPlain.modifier, 0) : numOr(outerPlain.modifier, 0);
  const total = computeTotal(dice, modifier, rowCount);
  return {
    dice: dice,
    modifier: modifier,
    total: total,
    rowCount: rowCount,
    rowStarts: rowStarts.length > 1 ? rowStarts : [],
    crit: critApplied && !critDegraded,
    critRequested: wantCrit,
    critDegraded: wantCrit && critDegraded,
    note: wantCrit && critDegraded ? ROLL_CRIT_NOTE : ""
  };
}

/* ---------------------------------------------------------------------------
 * 5) 载荷：rollToPayload / normalizeRoll / mergeRollRows
 * ------------------------------------------------------------------------- */
function normDie(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = str(raw.type || "d20").toLowerCase();
  const sides = sidesOf(type);
  if (!sides) return null;
  const out = {
    type: "d" + sides,
    /* 夹取用 sidesOf，**不是** DIE_SIDES 查表（否则 d600 会被夹到 20） */
    value: Math.max(1, Math.min(sides, Math.round(numOr(raw.value, 1))))
  };
  if (raw.loser) out.loser = true;
  if (raw.subtract) out.subtract = true;
  if (typeof raw.originalValue === "number" && isFinite(raw.originalValue)) {
    out.originalValue = Math.round(raw.originalValue);
  }
  if (typeof raw.burstParent === "number" && isFinite(raw.burstParent)) {
    out.burstParent = Math.max(0, Math.round(raw.burstParent));
  }
  return out;
}

/**
 * 归一化一条记录（收广播 / 读房间数据都要过这里，规格 §1.3）：
 *   · 兼容旧形状 dice[] / rolls[] / value；
 *   · 数值按 sidesOf 夹取；
 *   · 没有 rollId 直接丢弃（去重和 history key 都靠它）；
 *   · total **按同一公式重算**，保证三端永远一致；
 *   · 4E 的 target / hit **一律丢掉**（用户拍板：不做命中判定）。
 */
export function normalizeRoll(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rollId = trunc(str(raw.rollId).trim(), 80);
  if (!rollId) return null;

  let dice = [];
  let truncated = false;
  if (Array.isArray(raw.dice) && raw.dice.length) {
    dice = raw.dice.map(normDie).filter(Boolean);
  } else if (Array.isArray(raw.rolls)) {
    dice = raw.rolls.map(function (v) { return normDie({ type: "d20", value: v }); }).filter(Boolean);
  } else if (typeof raw.value === "number") {
    dice = [normDie({ type: "d20", value: raw.value })].filter(Boolean);
  }
  if (dice.length > ROLL_MAX_DICE) {
    dice = dice.slice(0, ROLL_MAX_DICE);
    truncated = true;
  }

  const rowStarts = Array.isArray(raw.rowStarts)
    ? raw.rowStarts.filter(function (n) { return typeof n === "number" && isFinite(n) && n >= 0; }).slice(0, 20)
    : [];
  const out = {
    v: 1,
    rollId: rollId,
    ts: Math.round(numOr(raw.ts, Date.now())),
    rollerId: trunc(str(raw.rollerId), 80),
    rollerName: trunc(str(raw.rollerName) || "某人", 40),
    rollerColor: colorOf(raw.rollerColor),
    label: trunc(str(raw.label), ROLL_LABEL_MAX),
    expression: trunc(str(raw.expression), ROLL_EXPR_MAX),
    mode: trunc(str(raw.mode) || "free", 16),
    dice: dice,
    modifier: Math.round(numOr(raw.modifier, 0)),
    total: computeTotal(dice, Math.round(numOr(raw.modifier, 0)), rowStarts.length > 1 ? rowStarts.length : 1),
    crit: !!raw.crit
  };
  if (rowStarts.length > 1) out.rowStarts = rowStarts;
  if (truncated) out.truncated = true;
  if (raw.critDegraded) out.critDegraded = true;
  if (raw.itemId) out.itemId = trunc(str(raw.itemId), 80);
  return out;
}

/**
 * 组装一条广播载荷（含 4E 的 mode / crit），最后仍走 normalizeRoll 兜底。
 * opts = { parsed, expression, result, rollId, ts, rollerId, rollerName, rollerColor,
 *          label, mode, crit, itemId, rand }
 */
export function rollToPayload(opts) {
  const o = opts || {};
  const parsed = o.parsed || parseExpr(o.expression || "");
  const res = o.result || rollParsed(parsed, { crit: o.crit, rand: o.rand });
  const raw = {
    v: 1,
    rollId: o.rollId || makeRollId(),
    ts: typeof o.ts === "number" ? o.ts : Date.now(),
    rollerId: o.rollerId,
    rollerName: o.rollerName,
    rollerColor: o.rollerColor,
    label: o.label,
    expression: formatExpr(parsed) || str(o.expression),
    mode: o.mode || "free",
    dice: res.dice,
    modifier: res.modifier,
    total: res.total,
    crit: !!res.crit,
    critDegraded: !!res.critDegraded,
    rowStarts: res.rowStarts,
    itemId: o.itemId
  };
  return normalizeRoll(raw);
}

/** 房间数据里的盒子里取出 rows（老数据只有数组也认）。 */
export function rowsFromRaw(raw) {
  const src = Array.isArray(raw) ? raw : raw && Array.isArray(raw.rows) ? raw.rows : [];
  const out = [];
  const seen = {};
  for (const one of src) {
    const row = normalizeRoll(one);
    if (!row || seen[row.rollId]) continue;
    seen[row.rollId] = true;
    out.push(row);
  }
  out.sort(function (a, b) { return numOr(b.ts, 0) - numOr(a.ts, 0); });
  return out.slice(0, ROLL_MAX_ROWS);
}

/** GM 侧合并：**幂等**（同 rollId 不重复插）→ 按 ts 倒序 → 封顶 40。 */
export function mergeRollRows(rows, incoming, cap) {
  const limit = Math.max(1, Math.min(200, typeof cap === "number" ? cap : ROLL_MAX_ROWS));
  const list = Array.isArray(rows) ? rows.slice() : [];
  const row = normalizeRoll(incoming);
  if (!row) return list.slice(0, limit);
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].rollId === row.rollId) return list.slice(0, limit);
  }
  list.push(row);
  list.sort(function (a, b) { return numOr(b.ts, 0) - numOr(a.ts, 0); });
  return list.slice(0, limit);
}

/** 房间数据盒子的整体形状（GM 写、所有人读）。 */
export function rollsBox(rows, seq) {
  return {
    v: 1,
    updatedAt: Date.now(),
    seq: Math.max(0, Math.round(numOr(seq, 0))),
    rows: (rows || []).slice(0, ROLL_MAX_ROWS)
  };
}
