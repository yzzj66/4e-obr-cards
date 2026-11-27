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
//   · **重击 = 4E 版**：只把**伤害骰**取最大值（d6→6、d8→8），不是 5E 的骰数翻倍；
//     **d20（攻击 / 豁免）保持真实掷值**，**减法骰（subtract）也不取满**（取满会放大减法）；
//     公式里带 adv / dis / max / min / reset* / burst / repeat 等包裹时无法逐颗取满，
//     退化为普通投掷并给出提示（critDegraded / note）；
//   · 优势 / 劣势按钮、暗骰、示例框都不做（语法层仍保留，粘贴旧公式照样能掷）。

/** 窗口里显示的七颗骰子（顺序就是按钮顺序）。 */
export const DICE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
/** 常见面数（自定义面数用 sidesOf 解析，别查这张表：查表会把 d600 夹到 20）。 */
export const DIE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
/** 规格 §4.2 的尺寸系数（P4 动画才用得上，这里先留着，免得以后返工）。 */
export const DIE_SIZE_FACTOR = { d4: 0.78, d6: 0.85, d8: 0.9, d10: 0.93, d12: 0.96, d20: 1, d100: 1.06 };

/** 房间数据 com.4enext-owlbear/rolls 的 rows 上限（v1.8.0：40 → 20，≈4 KB；Full Suite 同类策略 slice(0,LIMIT)）。 */
export const ROLL_MAX_ROWS = 20;
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
  /* v2.4.19：repeat 的参数在前（repeat(N,inner)），其它 wrapper 保持 (inner,param)。 */
  if (w.kind === "repeat") return "repeat(" + p + "," + innerText + ")";
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

/** 平铺项掷一遍：正 count 正常骰，负 count 掷出来但标 subtract（总和减）。
 *  v1.8.0：ctx.maximize（重击）只对**伤害骰**取满 —— d20 是攻击 / 豁免骰，保持真实掷值；
 *  subtract 减法骰也不取满（取满会把减法放大，更错）。 */
export function rollPlainSet(plain, ctx) {
  const c = ctx || {};
  const rand = c.rand || Math.random;
  const dice = [];
  for (const g of (plain && plain.groups) || []) {
    if (!g || !g.count) continue;
    const sides = sidesOf(g.type);
    if (!sides) continue;
    const n = Math.abs(g.count);
    const subtract = g.count < 0;
    const canMaximize = !!(c && c.maximize) && !subtract && sides !== 20;
    for (let i = 0; i < n; i++) {
      const one = { type: "d" + sides, value: canMaximize ? sides : rollDie(sides, rand) };
      if (subtract) one.subtract = true;
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
 *   crit=true：**只把伤害骰取满**（4E 重击）—— d20 保持真实掷值、subtract 减法骰不取满；
 *   返回值 crit 只在「真的取满了至少一颗伤害骰」时为 true。
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
    /* maximize 交给 rollPlainSet 判断：它只对非 d20、非 subtract 的伤害骰取满。 */
    else ctx.maximize = true;
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
  /* v1.8.0：只有真的把「伤害骰」取满才算重击生效 —— 纯 d20（攻击 / 豁免）公式没有可取的伤害骰，
   * 不显示「重击 · 已取满」；减法骰不参与。 */
  if (wantCrit && !wrapped) {
    critApplied = dice.some(function (d) { return d && !d.subtract && d.type !== "d20"; });
  }
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

/** GM 侧合并：**幂等**（同 rollId 不重复插）→ 按 ts 倒序 → 封顶 40。
 *  **超过 20 条时删掉最旧的那条**：倒序后 slice(0, 20) 砍掉的正是 ts 最小的尾巴。 */
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

/* ---------------------------------------------------------------------------
 * 6) 投骰动画（v1.7.0）：布局与时间轴公式（纯函数，node 可测）
 * ---------------------------------------------------------------------------
 * 公式全部照抄 docs/spec-dice.md §4.2 / §4.4（来源：FullPeople/obr-suite 的
 * src/modules/dice/effect-page.ts 与仓库根 dice-effect.html）：
 *
 *   BASE_SIZE = N <= 1 ? 128 : max(72, round(128 * 0.86^(N-1)))
 *   dieSize   = round(BASE_SIZE * DIE_SIZE_FACTOR[imgTypeFor(type)])
 *   gap       = round(BASE_SIZE * 0.16)；rowH = BASE_SIZE + gap；每行最多 4 颗
 *   居中      = cursor 从 -rowW/2 起；rowOy = (r - (rowCount-1)/2) * rowH
 *   附属元素  = runningTotal.top = -BASE_SIZE/2 - 64；
 *               modBox.top = lastRowOy + BASE_SIZE/2 + 28
 *
 *   时间轴    = FLIGHT 1200 → HOLD 500 → PUNCH 360 → HOLD2 220 → EXIT 320
 *               （合计 2600 ms，与参考实现「2.6 s 后自动关」一致）
 *   数字老虎机 = 每 55 ms 跳一格
 *   抛物线    = N_ARCS 4、r 0.55、H0 240、第 i 段高 H0*r^(2i)，
 *               位置 y + (-h * 4 * t * (1-t))；挤压 0.18 / 拉伸 0.08；总旋转 720°
 *
 * 为什么放在这个文件（而不是 effect-page.js）：
 *   · 这里不 import OBR、不碰 DOM，所以 dev/test-dice.mjs 能直接断言公式；
 *   · CSS 只负责「把同样的数字写成关键帧」，数字只有这一份，改公式不会两边不一致。
 * 动画页 effect.html + assets/effect-page.js 只是把这里的结果摆到屏幕上。
 * ------------------------------------------------------------------------- */
/** 一次动画里最多画多少颗骰（再多只画前 N 颗 + 「还有 N 颗」提示；总和仍按真实结果）。 */
export const FX_MAX_DICE = 20;
/** 基准尺寸：1 颗 128；每多一颗乘 0.86；最小 72（规格 §4.2）。 */
export const FX_BASE_MAX = 128;
export const FX_BASE_MIN = 72;
export const FX_BASE_DECAY = 0.86;
/** 行距 / 列距 = round(BASE_SIZE * 0.16)。 */
export const FX_GAP_RATIO = 0.16;
/** 每行最多几颗（超出换行）。 */
export const FX_PER_ROW = 4;
/** 时间轴（毫秒，规格 §4.4）。 */
export const FX_FLIGHT_MS = 1200;
export const FX_HOLD_MS = 500;
export const FX_PUNCH_MS = 360;
export const FX_HOLD2_MS = 220;
export const FX_EXIT_MS = 320;
export const FX_SLOT_MS = 55;
export const FX_TOTAL_MS = FX_FLIGHT_MS + FX_HOLD_MS + FX_PUNCH_MS + FX_HOLD2_MS + FX_EXIT_MS;
/** 抛物线参数（规格 §4.4）。 */
export const FX_N_ARCS = 4;
export const FX_ARC_RATIO = 0.55;
export const FX_ARC_H0 = 240;
export const FX_SQUASH = 0.18;
export const FX_STRETCH = 0.08;
export const FX_ROT_BASE = 720;
/** 赢家放大：1 → 1.18 → 1，峰值在 45%（effect-page.ts 的 getPunchScale）。 */
export const FX_PUNCH_SCALE = 1.18;
export const FX_PUNCH_PEAK = 0.45;

/** 基准尺寸：骰子越多越小，最小 72（规格 §4.2 公式，逐字）。 */
export function fxBaseSize(n) {
  const count = Math.max(1, Math.round(numOr(n, 1)));
  if (count <= 1) return FX_BASE_MAX;
  return Math.max(FX_BASE_MIN, Math.round(FX_BASE_MAX * Math.pow(FX_BASE_DECAY, count - 1)));
}

/** 类型 → 尺寸系数用的「图片类型」：自定义面数（d600 / d7）就近归到七种之一。 */
export function fxImageType(type) {
  const key = str(type).toLowerCase();
  if (DIE_SIZE_FACTOR[key] != null) return key;
  const sides = sidesOf(key);
  if (!sides) return "d20";
  if (sides <= 4) return "d4";
  if (sides <= 6) return "d6";
  if (sides <= 8) return "d8";
  if (sides <= 10) return "d10";
  if (sides <= 12) return "d12";
  if (sides <= 20) return "d20";
  return "d100";
}

/** 单颗骰子的像素尺寸 = round(BASE_SIZE * 系数)。 */
export function fxDieSize(baseSize, type) {
  const factor = DIE_SIZE_FACTOR[fxImageType(type)] || 1;
  return Math.max(24, Math.round(numOr(baseSize, FX_BASE_MAX) * factor));
}

/**
 * 抛物线四段：每段的起止比例与弧高（规格 §4.4）。
 * 段时长 t0*r^i，归一化后就是 [from, to]；弧高 H0*r^(2i)。
 */
export function fxArcProfile() {
  const r = FX_ARC_RATIO;
  const weights = [];
  let sum = 0;
  for (let i = 0; i < FX_N_ARCS; i++) {
    const w = Math.pow(r, i);
    weights.push(w);
    sum += w;
  }
  const out = [];
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    const from = acc / sum;
    acc += weights[i];
    out.push({
      index: i,
      from: Math.round(from * 10000) / 10000,
      to: Math.round((acc / sum) * 10000) / 10000,
      height: Math.round(FX_ARC_H0 * Math.pow(r, 2 * i) * 100) / 100
    });
  }
  return out;
}

/** 完整时间轴（effect-page.js 用它排 setTimeout，CSS 关键帧用同样的毫秒数）。 */
export function fxBeat() {
  return {
    flight: FX_FLIGHT_MS,
    hold: FX_HOLD_MS,
    punch: FX_PUNCH_MS,
    hold2: FX_HOLD2_MS,
    exit: FX_EXIT_MS,
    slot: FX_SLOT_MS,
    total: FX_TOTAL_MS,
    arcs: fxArcProfile(),
    punchScale: FX_PUNCH_SCALE,
    punchPeak: FX_PUNCH_PEAK,
    squash: FX_SQUASH,
    stretch: FX_STRETCH,
    rotBase: FX_ROT_BASE,
    perRow: FX_PER_ROW,
    maxDice: FX_MAX_DICE
  };
}

/**
 * 摆放：以 wrap 原点（token 顶部中心 = 世界坐标投影后的屏幕点）为 (0,0)。
 * dice = [{ type, value, ... }]，opts = { rowStarts }（repeat 的行起点，可选）。
 * 返回 { baseSize, gap, rowH, rowCount, slots:[{ index, ox, oy, size }], totalTop, modTop, hidden }
 *   hidden = 超过 FX_MAX_DICE 没画出来的颗数（总和仍按真实结果，不在这里算）。
 */
export function fxLayout(dice, opts) {
  const all = (dice || []).filter(Boolean);
  const list = all.slice(0, FX_MAX_DICE);
  const n = list.length;
  const baseSize = fxBaseSize(n);
  const gap = Math.round(baseSize * FX_GAP_RATIO);
  const rowH = baseSize + gap;

  const rows = [];
  const starts = opts && Array.isArray(opts.rowStarts) ? opts.rowStarts : [];
  if (starts.length > 1) {
    for (let i = 0; i < starts.length; i++) {
      const from = Math.max(0, Math.min(list.length, Math.round(numOr(starts[i], 0))));
      const to = i + 1 < starts.length ? Math.max(from, Math.min(list.length, Math.round(numOr(starts[i + 1], list.length)))) : list.length;
      rows.push(list.slice(from, to));
    }
  } else {
    for (let i = 0; i < list.length; i += FX_PER_ROW) rows.push(list.slice(i, i + FX_PER_ROW));
  }
  if (!rows.length) rows.push([]);

  const rowCount = Math.max(1, rows.length);
  const slots = [];
  let index = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let rowW = 0;
    for (const d of row) rowW += fxDieSize(baseSize, d.type);
    rowW += gap * Math.max(0, row.length - 1);
    let cursor = -rowW / 2;
    const rowOy = (r - (rowCount - 1) / 2) * rowH;
    for (const d of row) {
      const size = fxDieSize(baseSize, d.type);
      slots.push({
        index: index++,
        ox: Math.round(cursor + size / 2),
        oy: Math.round(rowOy),
        size: size
      });
      cursor += size + gap;
    }
  }

  const lastRowOy = ((rowCount - 1) - (rowCount - 1) / 2) * rowH;
  return {
    baseSize: baseSize,
    gap: gap,
    rowH: rowH,
    rowCount: rowCount,
    count: n,
    hidden: Math.max(0, all.length - n),
    slots: slots,
    totalTop: Math.round(-baseSize / 2 - 64),
    modTop: Math.round(lastRowOy + baseSize / 2 + 28)
  };
}

/** 动画页的 URL 查询串（effect.html 按这些参数画；全部是标量 / 逗号分隔，便于手查）。 */
export function fxQuery(row, origin) {
  const one = row || {};
  const dice = Array.isArray(one.dice) ? one.dice : [];
  const parts = [];
  const put = function (k, v) {
    const s = v == null ? "" : String(v);
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(s));
  };
  put("dtypes", dice.map(function (d) { return d.type; }).join(","));
  put("dvalues", dice.map(function (d) { return d.value; }).join(","));
  put("doriginals", dice.map(function (d) { return typeof d.originalValue === "number" ? d.originalValue : ""; }).join(","));
  put("dlosers", dice.map(function (d) { return d.loser ? 1 : 0; }).join(","));
  put("dsubtract", dice.map(function (d) { return d.subtract ? 1 : 0; }).join(","));
  put("total", numOr(one.total, 0));
  put("modifier", numOr(one.modifier, 0));
  put("label", str(one.label).slice(0, 40));
  put("rollId", str(one.rollId));
  put("color", colorOf(one.rollerColor));
  const rows = Array.isArray(one.rowStarts) ? one.rowStarts : [];
  if (rows.length > 1) put("rowStarts", rows.join(","));
  if (origin && typeof origin.x === "number" && typeof origin.y === "number") {
    put("wx", Math.round(origin.x * 100) / 100);
    put("wy", Math.round(origin.y * 100) / 100);
  }
  return parts.join("&");
}

/** v2.4.19：把表达式包成 repeat(N, expr) 或替换已有 N（clamp 1..20；空表达式返回错误）。 */
export function repeatExpr(expr, n) {
  const raw = String(expr == null ? "" : expr).trim();
  if (!raw) return { ok: false, error: "empty", expr: raw, n: 0 };
  const count = Math.max(1, Math.min(20, Math.round(Number(n) || 1)));
  const m = /^repeat\s*\(\s*(\d+)\s*,\s*([\s\S]*)\)\s*$/i.exec(raw);
  const out = m ? "repeat(" + count + ", " + m[2].trim() + ")" : "repeat(" + count + ", " + raw + ")";
  return { ok: true, expr: out, n: count };
}

/** v2.4.19：repeat 每行展示文本：r<inner> = 骰面 + 修正 = 行总和；无 repeat 返回 []。 */
export function repeatRowLines(row) {
  if (!row) return [];
  const expr = String(row.expression || "");
  const m = /^repeat\s*\(\s*\d+\s*,\s*([\s\S]*)\)\s*$/i.exec(expr.trim());
  if (!m) return [];
  let inner = "";
  try { inner = formatExpr(parseExpr(m[1])) || m[1].trim(); } catch (e) { inner = m[1].trim(); }
  /* 单颗骰的内层表达式：左侧只写骰子（r1d20），修正放右侧；多颗保留完整内层。 */
  const diceTerms = (inner.match(/d\d+/gi) || []).length;
  const left = inner;
  const starts = Array.isArray(row.rowStarts) ? row.rowStarts : [];
  if (starts.length < 2) return [];
  const totals = rowTotals(row.dice || [], starts, row.modifier);
  const mod = Math.round(Number(row.modifier) || 0);
  const out = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i];
    const to = i + 1 < starts.length ? starts[i + 1] : (row.dice || []).length;
    const faces = (row.dice || []).slice(from, to).map(function (d) {
      const v = Math.round(Number(d.value) || 0);
      return (d.subtract ? "-" : "") + v;
    });
    let body = faces.join(" + ").replace(/\+ -/g, "- ");
    if (mod) body += (mod > 0 ? " + " : " - ") + Math.abs(mod);
    out.push("r" + left + " = " + body + " = " + totals[i]);
  }
  return out;
}

/** v2.4.19：普通投掷的可读等式：<表达式> = 骰面 + 修正 = 总和（repeat 用 repeatRowLines）。 */
export function rollLine(row) {
  if (!row) return "";
  const expr = String(row.expression || "");
  if (/^repeat\s*\(/i.test(expr.trim())) return "";
  let left = expr;
  try { left = formatExpr(parseExpr(expr)) || expr; } catch (e) { left = expr; }
  const dice = row.dice || [];
  if (!left || !dice.length) return "";
  const faces = dice.map(function (d) {
    const v = Math.round(Number(d.value) || 0);
    return (d.subtract ? "-" : "") + v;
  });
  const mod = Math.round(Number(row.modifier) || 0);
  let body = faces.join(" + ").replace(/\+ -/g, "- ");
  if (mod) body += (mod > 0 ? " + " : " - ") + Math.abs(mod);
  const total = Math.round(Number(row.total) || 0);
  return left + " = " + body + " = " + total;
}

/* v2.4.19：投掷限制（面板先校验；后台兜底同一套文案）。 */
export const DICE_ROLL_MAX_DICE = 40;
export const DICE_ROLL_MAX_BYTES = 6144;
export const DICE_ROLL_MIN_MS = 800;
export const DICE_MSG_TOO_FAST = "投掷太快了，请稍等片刻（每 0.8 秒只能投一次）";
export const DICE_MSG_TOO_MANY = "骰子太多：一次最多 40 颗，请减少后再投";
export const DICE_MSG_TOO_BIG = "本次投掷内容太大（超过 6KB），请减少骰子或缩短备注";
