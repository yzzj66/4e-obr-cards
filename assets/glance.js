// 4E NEXT「速览」渲染层：把导出的 Character 渲染成 HTML（只读 / 可交互两种形态）。
//
// 数值口径尽量对齐 4E NEXT 的 web/src/overview/derive.ts 与 sheet/defense.ts：
//   · 属性 = 基础值 + 种族加值
//   · 生命 = 职业起始HP + 体质 + 每级HP×(等级-1) + 额外生命；混职时两个职业相加后取整
//   · 防御 = 10 + 半等级 + 属性 + 职业/种族/护甲/盾牌/专长/自定义加值（含魔法物品增强）
//   · 技能 = 半等级 + 属性调整 + 受训5 + 技能巧手 + 种族 + 自定义 - 护甲检定减值
//   · 攻击 = 半等级 + 属性 + 职业 + 擅长 + 专长 + 增强 + 自定义；伤害 = 属性 + 专长 + 增强 + 自定义
// 少数依赖完整规则正文的加值（职业特性自动加值、专长逐条效果）无法离线还原，见 README「已知限制」。
//
// v1.2.0 起：渲染时可以带一份「实时状态」——
//   live.hp    = { cur, max, temp, surges }        ← token 元数据 com.4enext-owlbear/hp
//   live.state = { powerUsed, featUsed, equipmentUsed, itemDailyUsed, actionPoints, milestones }
//                                                 ← 房间数据 com.4enext-owlbear/state/<cardId>
// 带 live 时才会出现可点的按钮；不带 live（index.html 的示例、check-render）就是原来的只读形态。
// 交互语义照抄 4E NEXT：web/src/overview/GlanceVitals.tsx / GlanceResources.tsx。
//
// v1.2.1 的 UI 微调（数据键名一个都没动，旧数据照旧能读）：
//   · 弹窗整体加宽（尺寸在 background.core.js 的 INFO_W / INFO_H，这里管的是内部排版）；
//   · 「行动点」与「里程碑」固定并成一排（.gl4-resline，内部 nowrap）；
//   · 「专长」改为纯展示：chips 不再可点、不再显示「已用 x/y」；
//   · 装备栏去掉「每日威能」计数，装备 chip 的「已用 / 耗尽」追踪保留。
//
// v1.7.12：
//   · 「遭遇 / 每日 / 辅助 / 种族职业」四组威能 chips **全部可点**（点=已用、再点=恢复）；
//     随意威能（无限次）仍保持纯展示 —— 这是唯一不追踪的一组；
//   · 装备 / 魔法物品**每一行都可点**（data-act="equipment"），「已用 x / y」只数当前卡上真有的条目；
//   · 状态 key 改用**稳定 id**（装备：前缀:物品id:同类第几件），旧版按下标写的 key 一律忽略，
//     从没点过的卡不会再显示「已用 10/12」；
//   · 「玩家端隐藏数字」从 HP 区挪到顶部标题区右侧，改名「共享数据」
//     （开 = 共享 = 全桌可见精确数字；关 = 玩家端只看到量化比例）。

import { RULES } from "../data/rules.js";

/* v2.5.6：用户提供的矢量图标（钉住 / 锁定 / 解锁），内联 SVG 用 currentColor 跟随主题。 */
const SHARE_ICON_LOCK = '<svg viewBox="0 0 613 772" width="12" height="12" fill="currentColor" aria-hidden="true"><g transform="translate(0,771) scale(1,-1)"><path fill="currentColor" fill-rule="nonzero" d="M205.414 462.384 L102.297 462.384 L102.297 582.689 C102.297 608.876 107.48 633.29 117.848 655.931 C128.215 678.576 142.535 698.49 160.812 715.673 C179.09 732.861 200.641 746.365 225.465 756.185 C250.289 766.005 277.43 770.915 306.895 770.915 C333.082 770.915 358.316 766.005 382.594 756.185 C406.871 746.365 428.422 732.861 447.246 715.673 C466.066 698.49 481.07 678.576 492.258 655.931 C503.441 633.29 509.035 608.876 509.035 582.689 L509.035 462.384 L410.008 462.384 L410.008 559.775 C410.008 594.146 400.461 620.744 381.367 639.564 C362.27 658.388 336.355 667.798 303.621 667.798 C274.156 667.798 250.426 658.388 232.422 639.564 C214.414 620.744 205.414 594.146 205.414 559.775 Z M558.137 413.283 C572.867 413.283 585.551 407.962 596.191 397.326 C606.828 386.685 612.148 374.001 612.148 359.271 L612.148 105.572 C612.148 90.841 609.559 77.064 604.375 64.244 C599.191 51.423 592.098 40.236 583.098 30.689 C574.094 21.142 563.457 13.638 551.18 8.185 C538.902 2.728 525.402 0.001 510.672 0.001 L97.387 0.001 C82.656 0.001 69.289 2.728 57.285 8.185 C45.285 13.638 35.055 20.869 26.598 29.872 C18.141 38.872 11.594 49.376 6.957 61.38 C2.32 73.38 0 86.205 0 99.841 L0 359.271 C0 374.001 5.184 386.685 15.551 397.326 C25.914 407.962 38.465 413.283 53.195 413.283 Z M558.137 413.283"/></g></svg>';
const SHARE_ICON_UNLOCK = '<svg viewBox="0 0 814 769" width="12" height="12" fill="currentColor" aria-hidden="true"><g transform="translate(0,768) scale(1,-1)"><path fill="currentColor" fill-rule="nonzero" d="M611.758 767.949 C637.789 767.949 662.871 763.066 687.004 753.305 C711.141 743.543 732.562 730.121 751.273 713.039 C769.984 695.953 785.031 676.023 796.422 653.246 C807.812 630.465 813.504 606.062 813.504 580.031 L813.504 459.629 L715.07 459.629 L715.07 557.25 C715.07 591.418 705.445 617.992 686.191 636.977 C666.938 655.957 641.043 665.449 608.504 665.449 C579.215 665.449 555.625 655.957 537.727 636.977 C519.828 617.992 510.883 591.418 510.883 557.25 L510.883 458.004 L408.379 458.004 L408.379 580.031 C408.379 606.062 413.531 630.465 423.836 653.246 C434.141 676.023 448.379 695.953 466.547 713.039 C484.715 730.121 506.137 743.543 530.812 753.305 C555.488 763.066 582.469 767.949 611.758 767.949 Z M610.129 213.137 L610.129 104.941 C610.129 90.301 607.555 76.469 602.402 63.453 C597.25 50.437 590.199 39.32 581.25 30.102 C572.301 20.879 561.727 13.559 549.523 8.137 C537.32 2.711 523.898 0 509.254 0 L97.621 0 C82.977 0 69.691 2.574 57.758 7.727 C45.828 12.879 35.523 19.93 26.844 28.879 C18.168 37.828 11.523 48.269 6.914 60.199 C2.305 72.133 0 84.875 0 98.434 L0 357.129 C0 372.312 5.289 385.059 15.863 395.363 C26.438 405.668 38.777 410.82 52.879 410.82 L556.438 410.82 C571.625 410.82 584.367 405.668 594.672 395.363 C604.977 385.059 610.129 372.312 610.129 357.129 Z M610.129 213.137"/></g></svg>';

/* v1.8.6：速览增强索引（威能使用频率 / 动作类型）约 305KB，**不**做静态 import：
 * glance.js 也会被角色卡面板、先攻、骰子等页面用到（那里不需要动作标签），
 * 只在速览弹窗 / 面板预览打开时调用 loadCardIndex() 按需加载。
 * 加载失败 / 还没加载完时，动作标签自动不显示，数值与点击不受影响。
 * Node 自测可直接 import 后 setCardIndex(CARD_INDEX) 注入。 */
let CARD_INDEX = null;
/** 注入 / 清空索引（info.js 加载完调用；Node 自测也用它）。 */
export function setCardIndex(index) {
  CARD_INDEX = index && typeof index === "object" ? index : null;
  return CARD_INDEX;
}
/** 当前已加载的索引（可能为 null）。 */
export function cardIndex() {
  return CARD_INDEX;
}
/** 威能 id → [使用频率, 动作类型]；索引未加载 / 没收录时返回 null。 */
function comboOf(id) {
  if (!CARD_INDEX || !CARD_INDEX.p || !CARD_INDEX.c) return null;
  const ci = CARD_INDEX.p[id];
  return typeof ci === "number" ? (CARD_INDEX.c[ci] || null) : null;
}
/** 按需加载 data/card-index.js；?v= 跟当前 glance.js 的版本查询串一致（缓存破坏）。 */
export async function loadCardIndex() {
  if (CARD_INDEX) return CARD_INDEX;
  try {
    let q = "";
    try {
      q = new URL(import.meta.url).searchParams.get("v") || "";
    } catch (e) { /* Node / 老环境 */ }
    const mod = await import("../data/card-index.js" + (q ? "?v=" + encodeURIComponent(q) : ""));
    setCardIndex(mod.CARD_INDEX || mod.default || null);
  } catch (e) {
    console.warn("[4enext] card-index 加载失败（动作类型标签将缺失）", e);
  }
  return CARD_INDEX;
}

const ABILITIES = ["str", "con", "dex", "int", "wis", "cha"];
const ABILITY_ZH = { str: "力量", con: "体质", dex: "敏捷", int: "智力", wis: "感知", cha: "魅力" };
const SKILL_TABLE = [
  { name: "运动", ability: "str" }, { name: "坚韧", ability: "con" }, { name: "杂技", ability: "dex" },
  { name: "隐秘", ability: "dex" }, { name: "盗术", ability: "dex" }, { name: "神秘", ability: "int" },
  { name: "历史", ability: "int" }, { name: "宗教", ability: "int" }, { name: "地城", ability: "wis" },
  { name: "医疗", ability: "wis" }, { name: "洞察", ability: "wis" }, { name: "自然", ability: "wis" },
  { name: "侦查", ability: "wis" }, { name: "唬骗", ability: "cha" }, { name: "交涉", ability: "cha" },
  { name: "威吓", ability: "cha" }, { name: "市井", ability: "cha" }
];
const ARMOR_PENALTY_SKILLS = ["运动", "坚韧", "杂技", "隐秘", "盗术"];
const EQUIPMENT_SLOTS = ["主手", "副手", "佩戴", "头部", "颈部", "护甲", "腰部", "臂部", "手部", "戒指", "戒指", "足部", "奇物"];
const POWER_GROUPS = [
  { key: "atWill", label: "随意威能", color: "#3fb950", track: false },
  { key: "encounter", label: "遭遇威能", color: "#e5534b", track: true },
  { key: "daily", label: "每日威能", color: "#a371f7", track: true },
  { key: "utility", label: "辅助威能", color: "#58a6ff", track: true },
  { key: "special", label: "种族/职业威能", color: "#d29922", track: true }
];
const POWER_KEYS = POWER_GROUPS.map((g) => g.key);
const WEAPON_GROUPS = ["硬头锤", "轻刃", "矛", "徒手", "杖", "重刃", "斧", "连枷", "锤", "镐", "长武器", "鞭", "绞索", "弩", "投石索", "弓", "吹箭筒"];
const DIFFICULTIES = ["简易", "军用", "优异"];
const WEAPON_TYPES = ["近战", "远程"];
const HANDEDNESS = ["单手", "双手"];
const EQUIP_USED_PREFIX = { fixed: "e", other: "o", consumable: "c", wondrous: "w", companion: "m" };
const QUICK_STEPS = [1, 5, 10];

/** v1.8.1：从实时状态里取临时加值（缺字段 = 0，向后兼容旧状态）。 */
function stateTemps(st) {
  st = st && typeof st === "object" ? st : {};
  const d = st.defTemp && typeof st.defTemp === "object" ? st.defTemp : {};
  return {
    atk: n0(st.atkTemp),
    dmg: n0(st.dmgTemp),
    surge: n0(st.surgeTemp),
    def: { ac: n0(d.ac), fort: n0(d.fort), ref: n0(d.ref), will: n0(d.will) }
  };
}

// ---------- 小工具 ----------
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
const n0 = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

/* v2.5.6：4E NEXT 新版导出 combatMods.damages[].dieUp —— 提高武器伤害骰。
 * 提升表（用户原话，单骰阶梯）：1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 2d8 → 2d10 → 2d12。
 * 武器原始骰本身就在阶梯里（含 2d6/2d8）→ 按阶梯继续升；不在阶梯里（非常规骰）→ 原样返回。
 * dieUp 为提升级数（缺省 / 0 = 不变；负值反向降级；超出范围取端点）。 */
const DAMAGE_DIE_LADDER = ["1d4", "1d6", "1d8", "1d10", "1d12", "2d6", "2d8", "2d10", "2d12"];
function upgradeDamageDie(dice, steps) {
  const raw = String(dice == null ? "" : dice).trim();
  if (!raw) return raw;
  const up = Math.round(n0(steps));
  if (!up) return dice; /* 缺省 / 0：逐字节保持旧输出 */
  const lower = raw.toLowerCase();
  const idx = DAMAGE_DIE_LADDER.indexOf(lower);
  if (idx < 0) return dice; /* 非常规骰（不在阶梯里）原样返回 */
  const next = Math.max(0, Math.min(DAMAGE_DIE_LADDER.length - 1, idx + up));
  return DAMAGE_DIE_LADDER[next];
}
const sum = (list) => (Array.isArray(list) ? list.reduce((s, x) => s + n0(x && x.value), 0) : 0);
const signed = (v) => (v >= 0 ? "+" + v : String(v));
const mod = (score) => Math.floor((n0(score) - 10) / 2);
const splitPipe = (s) => (s ? String(s).split("|").filter(Boolean) : []);
const itemLevels = (s) => String(s || "").split(/\s+/).map((x) => parseInt(x, 10)).filter((n) => !isNaN(n) && n >= 1 && n <= 30);
const enhForLevel = (lv) => (lv <= 5 ? 1 : lv <= 10 ? 2 : lv <= 15 ? 3 : lv <= 20 ? 4 : lv <= 25 ? 5 : 6);

/** 条目 id 是「中文 English」双语串：取中文部分显示，悬浮显示原文。 */
export function zhName(id) {
  const s = String(id == null ? "" : id).trim();
  if (!s) return "";
  const i = s.search(/[a-zA-Z]/);
  const cn = (i < 0 ? s : s.slice(0, i)).replace(/（[^（）]*）/g, "").replace(/^混职/, "").trim();
  return cn || s;
}
function prettyClass(id) {
  if (!id) return "";
  const src = String(id);
  const m = src.match(/^(.+?)（(.+)）/);
  if (m) return zhName(m[1]) + "·" + String(m[2]).replace(/^混职/, "").trim();
  return zhName(id);
}
function featBaseName(name) {
  return String(name || "").replace(/\s*<[^>]*>\s*$/, "").trim();
}

// ---------- 规则索引查询 ----------
function classRow(rules, id) { return id ? rules.classes[id] || null : null; }
function raceRow(rules, id) { return id ? rules.races[id] || null : null; }

function baseItem(rules, id) {
  if (!id || typeof id !== "string" || id.length < 3 || id[1] !== ":") return null;
  const kind = id[0];
  const name = id.slice(2);
  if (kind === "w") { const w = rules.weapons.find((x) => x.n === name); return w ? { kind: "weapon", ref: w } : null; }
  if (kind === "a") { const a = rules.armors.find((x) => x.n === name); return a ? { kind: "armor", ref: a } : null; }
  if (kind === "s") { const s = rules.shields.find((x) => x.n === name); return s ? { kind: "shield", ref: s } : null; }
  if (kind === "i") { const im = rules.implements.find((x) => x.n === name); return im ? { kind: "implement", ref: im } : null; }
  return null;
}

function findShield(rules, char) {
  const idxs = [1, 7];
  for (let i = 0; i < idxs.length; i++) {
    const b = baseItem(rules, (char.baseItems || {})[idxs[i]]);
    if (b && b.kind === "shield") return b;
  }
  return null;
}

function classStats(rules, char) {
  const a = classRow(rules, char.classId);
  const b = char.hybrid ? classRow(rules, char.classId2) : null;
  const z = [0, 0, 0, 0, 0, 0, 0, "", "", ""];
  const x = a || z;
  if (!b) {
    return {
      baseHp: n0(x[0]), hpPerLevel: n0(x[1]), surges: n0(x[2]),
      fort: n0(x[3]), ref: n0(x[4]), will: n0(x[5]),
      versatile: !!x[6], trained: splitPipe(x[7]), prof: splitPipe(x[8])
    };
  }
  return {
    baseHp: Math.floor(n0(x[0]) + n0(b[0])),
    hpPerLevel: Math.floor(n0(x[1]) + n0(b[1])),
    surges: Math.floor(n0(x[2]) + n0(b[2])),
    fort: n0(x[3]) + n0(b[3]), ref: n0(x[4]) + n0(b[4]), will: n0(x[5]) + n0(b[5]),
    versatile: !!(x[6] || b[6]),
    trained: splitPipe(x[7]).concat(splitPipe(b[7])),
    prof: splitPipe(x[8]).concat(splitPipe(b[8]))
  };
}

function racialBonus(race, choice) {
  const out = {};
  if (!race) return out;
  const one = race[0];
  const two = splitPipe(race[1]);
  if (one) out[one] = (out[one] || 0) + 2;
  const picked = choice || two[0];
  if (picked) out[picked] = (out[picked] || 0) + 2;
  return out;
}

/** 装备槽位上的魔法物品增强加值（档位 × 物品等级）。 */
function enhanceOf(rules, char, slot) {
  const id = (char.equipmentSlots || [])[slot];
  if (!id) return 0;
  const e = rules.equips[id];
  if (!e) return 0;
  const levels = itemLevels(e[0]);
  if (!levels.length) return 0;
  const tier = Math.min(n0((char.equipmentEnhance || {})[slot]) || 1, levels.length);
  return enhForLevel(levels[tier - 1]);
}

/** 魔法物品提供的防御增强（只按「增强：」指向的防御计，与 defense.ts 同口径）。 */
function magicDefenseEnhance(rules, char) {
  const out = {};
  (char.equipmentSlots || []).forEach(function (id, slot) {
    if (!id) return;
    const e = rules.equips[id];
    if (!e || !e[1]) return;
    const target = e[1];
    let value = 0;
    const fixed = /^[+\+]?\s*(\d+)/.exec(target);
    if (fixed) {
      value = parseInt(fixed[1], 10);
    } else {
      const levels = itemLevels(e[0]);
      if (!levels.length) return;
      const tier = Math.min(n0((char.equipmentEnhance || {})[slot]) || 1, levels.length);
      value = enhForLevel(levels[tier - 1]);
    }
    if (value <= 0) return;
    if (target.indexOf("AC") >= 0) out.ac = (out.ac || 0) + value;
    if (target.indexOf("强韧") >= 0) out.fort = (out.fort || 0) + value;
    if (target.indexOf("反射") >= 0) out.ref = (out.ref || 0) + value;
    if (target.indexOf("意志") >= 0) out.will = (out.will || 0) + value;
  });
  return out;
}

function matchesToken(w, token) {
  if (!token) return false;
  const cn = String(w.n).split(/\s/)[0];
  const diff = DIFFICULTIES.filter((d) => token.indexOf(d) >= 0)[0];
  const type = WEAPON_TYPES.filter((t) => token.indexOf(t) >= 0)[0];
  const hand = HANDEDNESS.filter((h) => token.indexOf(h) >= 0)[0];
  let group;
  if (diff || type || hand) group = WEAPON_GROUPS.filter((g) => token.indexOf(g) >= 0)[0];
  else if (WEAPON_GROUPS.indexOf(token) >= 0) group = token;
  if (diff || type || hand || group) {
    if (diff && String(w.c).indexOf(diff) < 0) return false;
    if (type && String(w.c).indexOf(type) < 0) return false;
    if (hand && String(w.c).slice(-3) !== "·" + hand) return false;
    if (group && String(w.g).split(/[，,]/).indexOf(group) < 0) return false;
    return true;
  }
  return cn === token;
}

function proficiencyTokens(rules, char, cls) {
  const set = {};
  cls.prof.forEach((t) => { set[t] = true; });
  const race = raceRow(rules, char.raceId);
  splitPipe(race ? race[8] : "").forEach((t) => { set[t] = true; });
  const featNames = (char.featSlots || []).concat(char.classGrantedFeatIds || []);
  featNames.forEach(function (name) {
    const tokens = rules.featProf[featBaseName(name)];
    if (tokens) tokens.forEach((t) => { set[t] = true; });
  });
  Object.keys(char.featChoices || {}).forEach(function (k) {
    const first = String(char.featChoices[k] || "").split(/\s/)[0];
    if (first) set[first] = true;
  });
  return Object.keys(set);
}

// ---------- 推导 ----------
/**
 * 先攻加值（v1.3.0）：敏捷调整 + 半等级 + 自定义先攻加值。
 * 口径与 4E NEXT 的速览页一致，绑定角色卡时写进 token 的 com.4enext-owlbear/init。
 * 速览、面板、先攻 tab 都调用这一个函数，避免三处各算一遍算出不同结果。
 */
export function initiativeBonus(char, rules) {
  rules = rules || RULES;
  char = char || {};
  const level = Math.max(1, n0(char.level) || 1);
  const half = Math.floor(level / 2);
  const race = raceRow(rules, char.raceId);
  const bonus = racialBonus(race, char.raceAbility2Choice);
  const dex = n0((char.abilities || {}).dex) + n0(bonus.dex);
  return mod(dex) + half + sum((char.customBonuses || {}).init);
}

/**
 * 把导出的 Character 推成速览数值。
 * live（可选）：{ hp:{cur,max,temp,surges}, state:{powerUsed,featUsed,equipmentUsed,itemDailyUsed,actionPoints,milestones} }
 *   带 live 时用实时值覆盖导出快照里的对应字段；不带就是纯粹的只读推导（老行为）。
 */
/** v2.5.6：职业防御特性（目前只有野蛮人「蛮族机敏」；狂战士与未选天赋的混职野蛮人不享有）。 */
function classDefenseFeature(char, rules, level, heavy) {
  const out = { ac: 0, ref: 0, label: "" };
  if (heavy) return out; /* 蛮族机敏：未穿重甲才生效 */
  const ids = [char.classId];
  if (char.hybrid && char.classId2) ids.push(char.classId2);
  for (const raw of ids) {
    const id = String(raw || "");
    if (!/野蛮人|Barbarian/.test(id)) continue;
    if (/狂战士|Berserker/.test(id)) continue;
    const hybrid = char.hybrid || /混职|Hybrid/.test(id);
    if (hybrid) {
      /* 混职只有选了「野蛮人载甲机敏」类天赋才给；取不到选择就不给。 */
      const choices = JSON.stringify(char.classFeatureChoices || "");
      if (!/载甲机敏|Armored Agility|蛮族机敏|Barbarian Agility/.test(choices)) continue;
    }
    const bonus = level >= 21 ? 3 : level >= 11 ? 2 : 1;
    out.ac += bonus;
    out.ref += bonus;
    out.label = "蛮族机敏 +" + bonus;
    break;
  }
  return out;
}

export function deriveGlance(char, rules, live) {
  rules = rules || RULES;
  char = char || {};
  live = live || {};
  const liveHp = live.hp && typeof live.hp === "object" ? live.hp : null;
  const st = live.state && typeof live.state === "object" ? live.state : null;
  const level = Math.max(1, n0(char.level) || 1);
  const half = Math.floor(level / 2);
  const cls = classStats(rules, char);
  const race = raceRow(rules, char.raceId);
  const armor = baseItem(rules, (char.baseItems || {})[5]);
  const shield = findShield(rules, char);
  const heavy = !!(armor && armor.kind === "armor" && armor.ref.c === "重甲");
  const classDef = classDefenseFeature(char, rules, level, heavy);

  const bonus = racialBonus(race, char.raceAbility2Choice);
  const abilities = {};
  const mods = {};
  ABILITIES.forEach(function (k) {
    abilities[k] = n0((char.abilities || {})[k]) + n0(bonus[k]);
    mods[k] = mod(abilities[k]);
  });

  // 防御
  const dm = char.defenseMods || {};
  const autoArmor = {};
  const autoShield = {};
  if (armor && armor.kind === "armor") {
    autoArmor.ac = n0(armor.ref.ac);
    const m = /([+-]\d+)\s*(强韧|反射|意志)/.exec(String(armor.ref.x || ""));
    if (m) autoArmor[m[2] === "强韧" ? "fort" : m[2] === "反射" ? "ref" : "will"] = parseInt(m[1], 10);
  }
  if (shield) autoShield.ac = n0(shield.ref.ac);
  const mEnh = magicDefenseEnhance(rules, char);
  const customDef = (char.customBonuses || {}).defense || {};
  function dmods(k) {
    const m = dm[k] || {};
    return {
      feat: n0(m.feat),
      enhance: mEnh[k] != null ? mEnh[k] : n0(m.enhance),
      armor: autoArmor[k] != null ? autoArmor[k] : n0(m.armor),
      shield: autoShield[k] != null ? autoShield[k] : n0(m.shield),
      other: sum(customDef[k])
    };
  }
  function raceDef(k) {
    const idx = { fort: 5, ref: 6, will: 7 }[k];
    return race ? n0(race[idx]) : 0;
  }
  const acAbilityMod = heavy ? 0 : Math.max(mods.dex, mods.int);
  function dsum(k) {
    const m = dmods(k);
    return m.feat + m.enhance + m.armor + m.shield + m.other;
  }
  function parts(base, extra, m) {
    const out = [["基础", base]];
    extra.forEach((p) => out.push(p));
    if (m.enhance) out.push(["增强", m.enhance]);
    if (m.feat) out.push(["专长", m.feat]);
    if (m.armor) out.push(["护甲", m.armor]);
    if (m.shield) out.push(["盾牌", m.shield]);
    if (m.other) out.push(["其他", m.other]);
    return out;
  }
  const defenses = [
    {
      key: "ac", label: "AC", value: 10 + half + acAbilityMod + dsum("ac") + classDef.ac,
      parts: parts(10, [["半等级", half], [heavy ? "重甲" : "敏捷/智力", acAbilityMod]].concat(classDef.ac ? [["职业特性", classDef.ac]] : []), dmods("ac"))
    },
    {
      key: "fort", label: "强韧",
      value: 10 + half + Math.max(mods.str, mods.con) + cls.fort + dsum("fort") + raceDef("fort"),
      parts: parts(10, [["半等级", half], ["力量/体质", Math.max(mods.str, mods.con)], ["职业", cls.fort], ["种族", raceDef("fort")]], dmods("fort"))
    },
    {
      key: "ref", label: "反射",
      value: 10 + half + Math.max(mods.dex, mods.int) + cls.ref + dsum("ref") + raceDef("ref") + classDef.ref,
      parts: parts(10, [["半等级", half], ["敏捷/智力", Math.max(mods.dex, mods.int)], ["职业", cls.ref], ["种族", raceDef("ref")]].concat(classDef.ref ? [["职业特性", classDef.ref]] : []), dmods("ref"))
    },
    {
      key: "will", label: "意志",
      value: 10 + half + Math.max(mods.wis, mods.cha) + cls.will + dsum("will") + raceDef("will"),
      parts: parts(10, [["半等级", half], ["感知/魅力", Math.max(mods.wis, mods.cha)], ["职业", cls.will], ["种族", raceDef("will")]], dmods("will"))
    }
  ];

  // 生命
  const maxHp = cls.baseHp + abilities.con + cls.hpPerLevel * Math.max(0, level - 1) + n0(char.hpBonus);
  const bloodied = Math.floor(maxHp / 2);
  const surgeValueAuto = Math.floor(maxHp / 4) + n0(char.surgeValueBonus);
  const hpNow = char.hpNow || {};
  const surgeValue = typeof hpNow.surgeValue === "number" ? hpNow.surgeValue : surgeValueAuto;
  const surges = cls.surges + mods.con + n0(char.surgeBonus);
  // 生命：实时（token 元数据）> 导出快照（hpNow.max）> 自动上限
  const hpMax = liveHp && typeof liveHp.max === "number" && liveHp.max > 0 ? Math.floor(liveHp.max) : maxHp;
  const hpCur = liveHp && typeof liveHp.cur === "number"
    ? Math.floor(liveHp.cur)
    : (typeof hpNow.max === "number" ? hpNow.max : hpMax);
  const hpTemp = liveHp && typeof liveHp.temp === "number" ? Math.max(0, Math.floor(liveHp.temp)) : n0(char.tempHp);
  const surgesCur = liveHp && typeof liveHp.surges === "number"
    ? Math.max(0, Math.floor(liveHp.surges))
    : (typeof hpNow.surges === "number" ? hpNow.surges : surges);
  const bloodiedLine = Math.floor(hpMax / 2);
  const hpSurgeValue = typeof hpNow.surgeValue === "number" ? hpNow.surgeValue : (Math.floor(hpMax / 4) + n0(char.surgeValueBonus));
  /* v1.6.0：回复力分母优先用 token 上的 surgesMax（画布层的蓝条也用它），
   * 没有就回落到卡里推导的 surges —— 老数据 / 没打开过速览的 token 也能显示。 */
  const surgesMaxLive = liveHp && typeof liveHp.surgesMax === "number" && liveHp.surgesMax > 0
    ? Math.floor(liveHp.surgesMax) : surges;
  /* v1.6.0：GM 把 token 锁了 → 玩家端只看到阶梯比例（速览里那个「玩家端隐藏数字」按钮用）。
   * v1.7.9：Boss 模式整组删除，这里**不再读** hp.boss。 */
  const hpLocked = !(liveHp && liveHp.locked === false);

  // 技能
  const trainedSet = {};
  (char.trainedSkills || []).forEach((s) => { trainedSet[s] = true; });
  (char.classTrainedSkills || []).forEach((s) => { trainedSet[s] = true; });
  cls.trained.forEach((s) => { trainedSet[s] = true; });
  const armorPen = armor && armor.kind === "armor" ? Math.abs(n0(armor.ref.k)) : 0;
  const skills = SKILL_TABLE.map(function (s) {
    const trained = !!trainedSet[s.name];
    const sm = (char.skillMods || {})[s.name] || { race: 0, other: 0, armor: 0 };
    const custom = sum(((char.customBonuses || {}).skill || {})[s.name]);
    const pen = ARMOR_PENALTY_SKILLS.indexOf(s.name) >= 0 ? armorPen : 0;
    return {
      name: s.name, ability: s.ability, trained: trained,
      total: mods[s.ability] + half + (trained ? 5 : 0) + (cls.versatile && !trained ? 1 : 0) + n0(sm.race) + custom - pen
    };
  });
  function skillOf(name) {
    const hit = skills.filter((s) => s.name === name)[0];
    return hit ? hit.total : mods.wis + half;
  }

  // 攻击 / 伤害
  const tokens = proficiencyTokens(rules, char, cls);
  const cm = char.combatMods || {};
  const customAtk = (char.customBonuses || {}).attack || [];
  const customDmg = (char.customBonuses || {}).damage || [];
  const attacks = (cm.attacks || []).map(function (r, i) {
    const enhanceSlot = Math.max(0, n0(r.enhanceSlot));
    const profSlot = Math.max(0, n0(r.profSlot));
    const w = baseItem(rules, (char.baseItems || {})[profSlot]);
    let prof = 0;
    if (!r.profImplement) {
      if (r.profOverride) prof = w && w.kind === "weapon" ? n0(w.ref.p) : 0;
      else if (w && w.kind === "weapon" && tokens.some((t) => matchesToken(w.ref, t))) prof = n0(w.ref.p);
    }
    return {
      label: String(r.label || "").trim(),
      ability: r.ability || "str",
      total: half + mods[r.ability || "str"] + n0(r.classBonus) + prof + n0(r.feat) + enhanceOf(rules, char, enhanceSlot) + sum(customAtk[i])
    };
  });
  const damages = (cm.damages || []).map(function (r, i) {
    const slot = Math.max(0, n0(r.enhanceSlot));
    const w = baseItem(rules, (char.baseItems || {})[slot]);
    const atk = (cm.attacks || [])[i];
    return {
      label: String((atk && atk.label) || "").trim(),
      ability: r.ability || "str",
      dice: w && w.kind === "weapon" ? upgradeDamageDie(w.ref.d, n0(r.dieUp)) : "",
      total: mods[r.ability || "str"] + n0(r.feat) + enhanceOf(rules, char, slot) + sum(customDmg[i])
    };
  });

  const speedBase = parseInt(String(race ? race[3] : ""), 10);
  const speedMods = char.speedMods || {};
  const speed = (isNaN(speedBase) ? 0 : speedBase) + n0(speedMods.power) + n0(speedMods.feat) + n0(speedMods.item) +
    sum((char.customBonuses || {}).speed) + (armor && armor.kind === "armor" ? n0(armor.ref.s) : 0);

  const initiative = initiativeBonus(char, rules);
  const perception = (char.customBonuses || {}).perception || {};

  // 使用状态：实时（房间数据）> 导出快照。
  // v1.7.12：下面只把**当前卡上真有的 key** 收进 powerUsed / equipmentUsed ——
  // 换卡 / 老版本按别的规则写下的 key 一律忽略，不能算成「已用」（修「没点过却显示已用 10/12」）。
  const powerUsedRaw = (st && st.powerUsed) || char.powerUsed || {};
  const featUsed = (st && st.featUsed) || char.featUsed || {};
  const equipmentUsedRaw = (st && st.equipmentUsed) || char.equipmentUsed || {};
  const itemDailyUsed = st && typeof st.itemDailyUsed === "number"
    ? Math.max(0, Math.floor(st.itemDailyUsed))
    : n0((char.glance || {}).itemDailyUsed);

  const powerUsed = {};
  const powers = POWER_GROUPS.map(function (g) {
    const list = ((char.powerSlots || {})[g.key] || []).map((id, i) => ({ id: id, i: i })).filter((x) => !!x.id);
    list.forEach(function (x) {
      const key = g.key + "-" + x.i;
      if (powerUsedRaw[key]) powerUsed[key] = true;
    });
    const used = list.filter((x) => powerUsed[g.key + "-" + x.i]).length;
    return { key: g.key, label: g.label, color: g.color, track: g.track, list: list, used: used };
  });

  const feats = (char.featSlots || []).map((id, i) => ({ id: id, key: String(i), granted: false }))
    .filter((x) => !!x.id)
    .concat((char.classGrantedFeatIds || []).map((id) => ({ id: id, key: "g-" + id, granted: true })));

  const equipRows = [];
  const equipSeen = {};
  function pushEquips(slots, prefix, label) {
    (slots || []).forEach(function (id, i) {
      if (!id) return;
      /* v1.7.12：key = 前缀:物品id:同类第几件 —— 物品增删 / 换槽 / 列表过滤都不会改 key；
       * 老版本按下标写的 e-0 / w-3 对不上，读取时自然被忽略（不会误显示成已用）。 */
      const n = (equipSeen[id] = (equipSeen[id] || 0) + 1);
      equipRows.push({
        id: id, key: prefix + ":" + id + ":" + n,
        slot: label || EQUIPMENT_SLOTS[i] || "装备",
        enh: prefix === "e" ? enhanceOf(rules, char, i) : 0
      });
    });
  }
  pushEquips(char.equipmentSlots, "e", null);
  pushEquips(char.wondrousSlots, "w", "奇物");
  pushEquips(char.otherSlots, "o", "其他");
  pushEquips(char.consumableSlots, "c", "消耗品");
  pushEquips(char.companionSlots, "m", "魔宠/坐骑");

  const equipmentUsed = {};
  equipRows.forEach(function (r) { if (equipmentUsedRaw[r.key]) equipmentUsed[r.key] = true; });

  const milestones = st && typeof st.milestones === "number" ? Math.max(0, Math.floor(st.milestones)) : n0(char.milestones);
  const actionPoints = st && typeof st.actionPoints === "number" ? Math.max(0, Math.floor(st.actionPoints)) : n0(char.actionPoints);

  return {
    level: level, half: half, cls: cls, race: race,
    abilities: abilities, mods: mods, defenses: defenses,
    maxHp: maxHp, bloodied: bloodiedLine, surgeValue: hpSurgeValue,
    surges: surges, surgesMax: surgesMaxLive,
    hpMax: hpMax, hpCur: hpCur, hpTemp: hpTemp, surgesCur: surgesCur,
    locked: hpLocked,
    derivedSurgeValue: surgeValueAuto,
    skills: skills, attacks: attacks, damages: damages,
    initiative: initiative, speed: speed,
    passivePerception: 10 + skillOf("侦查") + sum(perception.passivePerception),
    passiveInsight: 10 + skillOf("洞察") + sum(perception.passiveInsight),
    powers: powers, feats: feats, equipRows: equipRows,
    powerUsed: powerUsed, featUsed: featUsed, equipmentUsed: equipmentUsed,
    itemDailyUsed: itemDailyUsed,
    known: { cls: !!classRow(rules, char.classId), race: !!race, armor: !!armor, shield: !!shield },
    actionPoints: actionPoints, milestones: milestones, powerPoints: n0(char.powerPoints),
    languages: (char.languages || []).join("、"),
    size: race ? race[2] : char.size || "",
    vision: race ? race[4] : char.vision || ""
  };
}

/** 魔法物品每日威能上限：英雄层 1 / 典范层 2 / 传奇层 3，每个里程碑 +1（sheet/powerpoints.ts）。 */
export function magicItemDailyUses(level, milestones) {
  const lv = n0(level) || 1;
  const tier = lv <= 10 ? 1 : lv <= 20 ? 2 : 3;
  return tier + Math.max(0, Math.floor(n0(milestones)));
}

// ---------- 渲染 ----------
function partsText(parts) {
  return parts.filter((p) => p[1]).map((p) => p[0] + " " + signed(p[1])).join("  ");
}

function renderSkill(s) {
  const title = ABILITY_ZH[s.ability] + (s.trained ? " · 已受训" : " · 未受训");
  return '<span class="gl4-skill' + (s.trained ? " trained" : "") + '" title="' + esc(title) + '"><b>' +
    esc(s.name) + "</b>" + signed(s.total) + "</span>";
}

function pips(cur, total, interactive) {
  const cls = "gl4-pips" + (interactive ? "" : " static") + (total >= 21 ? " many" : total >= 13 ? " mid" : "");
  const title = interactive ? "回复力：点第 N 颗 = 剩余 N 次" : "回复力：点亮 = 剩余（在 token 速览弹窗里可点）";
  let out = '<span class="' + cls + '" title="' + title + '">';
  for (let i = 1; i <= total; i++) {
    const on = i <= cur ? " on" : "";
    if (interactive) {
      out += '<button type="button" class="gl4-pip' + on + '" data-act="surge" data-n="' + i +
        '" aria-label="回复力设为 ' + i + '"></button>';
    } else {
      out += '<span class="gl4-pip' + on + '"></span>';
    }
  }
  return out + "</span>";
}

function counter(label, value, act, title) {
  return '<span class="gl4-counter" title="' + esc(title || "") + '"><i>' + esc(label) + "</i>" +
    '<button type="button" class="gl4-step" data-act="' + act + '" data-d="-1" aria-label="' + esc(label) + ' −1">−</button>' +
    "<b>" + esc(value) + "</b>" +
    '<button type="button" class="gl4-step" data-act="' + act + '" data-d="1" aria-label="' + esc(label) + ' ＋1">＋</button></span>';
}

function renderHpBlock(d, ed, temps, compact) {
  temps = temps || stateTemps(null);
  const masked = !!d.hpMasked; /* v2.5.6：非 GM 且 locked → 数字掩码，条仍按比例 */
  const dying = d.hpCur <= 0;
  const bloodied = !dying && d.hpCur <= d.bloodied;
  const state = dying ? "濒死" : bloodied ? "重伤" : "健康";
  const cls = dying ? "dying" : bloodied ? "bloodied" : "ok";
  const pct = d.hpMax > 0 ? Math.max(0, Math.min(100, (d.hpCur / d.hpMax) * 100)) : 0;
  const shownCur = masked ? "?" : d.hpCur;
  const shownMax = masked ? "??" : d.hpMax;
  const bloodPct = d.hpMax > 0 ? Math.max(0, Math.min(100, (d.bloodied / d.hpMax) * 100)) : 50;
  const tempPct = d.hpMax > 0 ? Math.max(0, Math.min(100 - pct, (d.hpTemp / d.hpMax) * 100)) : 0;

  let pad = "";
  if (ed.hp) {
    /* v2.5.6：紧凑模式只保留「数值 + 受伤/治疗」；快捷 ±1/±5/±10 与重复的临时生命行都撤掉
     * （临时生命已并入 HP 行右侧，见 gl4-hp-temp）。 */
    pad = '<div class="gl4-hp-pad">' +
      (compact ? "" : '<div class="gl4-pad-row">' +
        QUICK_STEPS.map((n) => '<button type="button" class="gl4-pad-btn hurt" data-act="hurt" data-n="' + n + '" title="受到 ' + n + " 点伤害\">−" + n + "</button>").join("") +
        QUICK_STEPS.map((n) => '<button type="button" class="gl4-pad-btn heal" data-act="heal" data-n="' + n + '" title="回复 ' + n + " 点生命\">＋" + n + "</button>").join("") +
        "</div>") +
      '<div class="gl4-pad-row">' +
      '<input class="gl4-num" data-role="amount" type="number" min="0" inputmode="numeric" placeholder="数值" aria-label="自定义生命值增减">' +
      '<button type="button" class="gl4-pad-btn hurt wide" data-act="hurt-amount" title="按输入数值扣血">受伤</button>' +
      '<button type="button" class="gl4-pad-btn heal wide" data-act="heal-amount" title="按输入数值回血">治疗</button>' +
      "</div>" +
      (compact ? "" : '<div class="gl4-pad-row temp">' +
        '<span class="gl4-pad-label">临时生命</span>' +
        '<button type="button" class="gl4-step" data-act="temp" data-d="-1" aria-label="临时生命 −1">−</button>' +
        '<input class="gl4-num sm" data-role="temp" type="number" min="0" inputmode="numeric" value="' + esc(d.hpTemp) + '" aria-label="临时生命值">' +
        '<button type="button" class="gl4-step" data-act="temp" data-d="1" aria-label="临时生命 +1">＋</button>' +
        "</div>") +
      "</div>";
  }

  /* v1.6.0：回复力分母用 d.surgesMax（token 上优先），蓝条在圆点行上方（规格 §6.6-2）。 */
  const surgeMaxShow = d.surgesMax > 0 ? d.surgesMax : (d.surges > 0 ? d.surges : 1);
  const surgePct = Math.max(0, Math.min(100, (d.surgesCur / surgeMaxShow) * 100));
  /* v2.5.6（用户定稿）：去掉蓝色回复力条，改成蓝色小圆点，放在原蓝条位置、与血条左对齐。 */
  const surgePips = '<div class="gl4-surgepips" title="回复力 ' + esc(d.surgesCur) + " / " + esc(surgeMaxShow) + '">' +
    pips(d.surgesCur, surgeMaxShow, ed.hp) + "</div>";
  const surgeHeal = Math.max(0, d.surgeValue + temps.surge);
  /* v1.8.1：「使用回复力 +N」的 N 要把临时回复值算进去；旁边给 ± 控件改临时值。 */
  const surgeTempCtrl = ed.hp
    ? '<span class="gl4-surge-temp"><span class="gl4-pad-label">临时回复值</span>' +
      '<button type="button" class="gl4-step" data-act="surge-temp" data-d="-1" aria-label="临时回复值 −1">−</button>' +
      "<em>" + signed(temps.surge) + "</em>" +
      '<button type="button" class="gl4-step" data-act="surge-temp" data-d="1" aria-label="临时回复值 ＋1">＋</button></span>'
    : (temps.surge ? '<span class="gl4-surge-temp"><span class="gl4-pad-label">临时回复值</span><em>' + signed(temps.surge) + "</em></span>" : "");
  const surgeLine = '<div class="gl4-surge-line"><span class="gl4-pad-label">回复力</span>' +
    "<b>" + d.surgesCur + " / " + surgeMaxShow + "</b>" +
    (ed.hp ? '<button type="button" class="gl4-mini-btn" data-act="surge-use" title="消耗一次回复力：回复 ' + surgeHeal + ' 点生命">使用回复力 ＋' + surgeHeal + "</button>" : "") +
    surgeTempCtrl +
    "</div>";

  /* v1.6.2：删掉 HP 绿条下面那条「彩色四防箭头条」（.gl4-def-row / .gl4-def-chip）。
   * 用户原话：「图1在显示的预览部分不需要显示，直接修改下面对应的数值栏位就行」——
   * 四防数值改由下面「AC / 强韧 / 反射 / 意志」那四张数值卡（.gl4-defs）显示。
   * 注意：token 上的四防（v1.6.1 是一排，v1.7.9 起回到四角）不在这个文件里，别跟着删。 */

  /* v1.7.12：HP 区**不再放**「玩家端隐藏数字」按钮 —— 它已挪到顶部标题区右侧并改名「共享数据」。 */

  /* v1.2.1：行动点 + 里程碑并成一排；外层 .gl4-tags 可以折行，这一排内部不折。 */
  const milestoneBit = ed.track
    ? counter("里程碑", d.milestones, "milestone", "每达成一个里程碑：+1 行动点")
    : (d.milestones ? "<span><i>里程碑</i><b>" + d.milestones + "</b></span>" : "");
  const resourceLine = '<span class="gl4-resline">' +
    (ed.track ? counter("行动点", d.actionPoints, "ap", "每次遭遇可用 1 点；长休后回到 1 点")
      : "<span><i>行动点</i><b>" + d.actionPoints + "</b></span>") +
    (milestoneBit ? '<span class="gl4-sep" aria-hidden="true"></span>' + milestoneBit : "") +
    "</span>";

  return '<section class="gl4-card gl4-vitals">' +
    '<div class="gl4-hp-line"><span class="gl4-hp-cur">' + esc(shownCur) + "</span>" +
    '<span class="gl4-hp-max">/ ' + esc(shownMax) + "</span>" +
    '<span class="gl4-state ' + cls + '">' + state + "</span>" +
    (compact && ed.hp
      ? '<span class="gl4-hp-temp"><i>临时</i><input class="gl4-num sm" data-role="temp" type="number" min="0" inputmode="numeric" value="' + esc(d.hpTemp) + '" aria-label="临时生命值"></span>'
      : (d.hpTemp > 0 ? '<span class="gl4-temp">临时 +' + esc(d.hpTemp) + "</span>" : "")) +
    "</div>" +
    '<div class="gl4-hpbar" title="重伤线 ' + d.bloodied + '">' +
    '<div class="gl4-hpfill ' + cls + '" style="width:' + pct.toFixed(1) + '%"></div>' +
    (tempPct > 0 ? '<div class="gl4-hptempfill" style="width:' + tempPct.toFixed(1) + '%"></div>' : "") +
    '<div class="gl4-hpmark" style="left:' + bloodPct.toFixed(1) + '%"></div></div>' +
    surgePips +
    surgeLine +
    pad +
    '<div class="gl4-tags">' +
    "<span><i>血怒</i><b>" + d.bloodied + "</b></span>" +
    "<span><i>回复值</i><b>" + d.surgeValue + "</b></span>" +
    (d.powerPoints ? "<span><i>灵能点</i><b>" + d.powerPoints + "</b></span>" : "") +
    resourceLine +
    "</div></section>";
}

function renderPowerGroup(d, powerUsed, ed) {
  /* v1.7.12：**所有要追踪的威能组**（遭遇 / 每日 / 辅助 / 种族职业）都渲染成可点按钮；
     随意威能（POWER_GROUPS 里 track:false，无限次）保持纯展示 —— 它是唯一不追踪的一组。 */
  const body = d.list.map(function (x) {
    const key = d.key + "-" + x.i;
    const isUsed = !!powerUsed[key];
    const name = esc(zhName(x.id));
    /* v1.8.6：动作类型来自 data/card-index.js（4E NEXT 的角色卡里只有 id）；
     * 用户确认去掉攻击 / 命中 tooltip，title 只保留「点击标记已使用」这类提示。 */
    const combo = comboOf(x.id);
    const act = combo && combo[1] ? String(combo[1]) : "";
    const label = '<span class="gl4-chip-name">' + name + "</span>" +
      (act ? '<em class="gl4-act">' + esc(act) + "</em>" : "");
    const title = d.track
      ? (isUsed ? "点击恢复：" : "点击标记已使用：") + x.id
      : "随意威能，无需追踪消耗";
    if (ed.track && d.track) {
      return '<button type="button" class="gl4-chip' + (isUsed ? " used" : "") + '" data-act="power" data-k="' + esc(key) +
        '" aria-pressed="' + (isUsed ? "true" : "false") + '" title="' + esc(title) + '">' + label + "</button>";
    }
    return '<span class="gl4-chip" title="' + esc(title) + '">' + label + "</span>";
  }).join("");
  const count = d.track ? d.list.length - d.used + " / " + d.list.length : "无限";
  const reset = (ed.track && d.track && d.used > 0)
    ? '<button type="button" class="gl4-mini-btn" data-act="power-reset" data-cat="' + d.key + '" title="恢复全部' + esc(d.label) + '">↺</button>'
    : "";
  return '<div class="gl4-pgroup"><div class="gl4-phead"><span class="gl4-dot" style="background:' + d.color +
    '"></span>' + esc(d.label) + '<span class="gl4-pcount">' + count + "</span>" + reset + "</div>" +
    '<div class="gl4-chips">' + body + "</div></div>";
}

export function renderGlanceHTML(char, opts) {
  opts = opts || {};
  const live = opts.live || null;
  const d = deriveGlance(char, opts.rules, live);
  d.hpMasked = !!opts.maskHp;
  if (d.hpMasked) {
    /* v2.5.6：非 GM + locked/hide → HP 与四防（含 AC）全部掩码，仅保留条形比例。 */
    d.defenses = (d.defenses || []).map(function (x) {
      return Object.assign({}, x, { value: "?", parts: [], masked: true });
    });
  }
  /* v1.8.1：临时加值存在 track.js 的 state 里（缺字段 = 0），渲染层只读、不写卡。 */
  const st = live && live.state ? live.state : null;
  const temps = stateTemps(st);
  const ed = {
    hp: !!(opts.editable && opts.editable.hp),
    track: !!(opts.editable && opts.editable.track),
    rest: !!(opts.editable && opts.editable.rest)
  };
  const compact = opts.mode === "compact";
  const classNames = [prettyClass(char.classId)];
  if (char.hybrid && char.classId2) classNames.push(prettyClass(char.classId2));
  const classText = classNames.filter(Boolean).join(" / ");
  const sub = ["Lv" + d.level, zhName(char.raceId) || d.size, char.hybrid && classText ? "混职：" + classText : classText]
    .filter(Boolean).join(" · ");

  /* v2.5.6：紧凑模式顶部属性用短标签，保证和左侧名字同一行。 */
  const quick = '<div class="gl4-quick' + (compact ? " flat" : "") + '">' +
    '<span class="gl4-q"><i>先攻</i><b>' + signed(d.initiative) + "</b></span>" +
    '<span class="gl4-q"><i>被动侦查</i><b>' + d.passivePerception + "</b></span>" +
    '<span class="gl4-q"><i>被动洞察</i><b>' + d.passiveInsight + "</b></span>" +
    '<span class="gl4-q"><i>移动</i><b>' + (d.speed ? d.speed + " 格" : "—") + "</b></span></div>";

  const defGrid = '<section class="gl4-card gl4-defs">' + d.defenses.map(function (x) {
    const t = temps.def[x.key] || 0;
    const val = x.masked ? "?" : x.value + t;
    const delta = x.masked ? "" : ed.hp
      ? '<span class="gl4-def-temp"><button type="button" class="gl4-step" data-act="def-temp" data-k="' + esc(x.key) +
        '" data-d="-1" aria-label="' + esc(x.label) + ' 临时 −1">−</button><em>' + signed(t) +
        '</em><button type="button" class="gl4-step" data-act="def-temp" data-k="' + esc(x.key) +
        '" data-d="1" aria-label="' + esc(x.label) + ' 临时 ＋1">＋</button></span>'
      : (t ? '<em class="gl4-def-delta">' + signed(t) + "</em>" : "");
    const tip = x.masked ? "已隐藏" : partsText(x.parts) + (t ? "  临时 " + signed(t) : "");
    /* v2.5.6：紧凑模式按图例做成**单行**「AC 21 强韧 18 …」，标签和数字同一行；
     * 完整模式保留原来的竖排卡片。 */
    if (compact) {
      return '<span class="gl4-def-i" title="' + esc(tip) + '"><i>' + esc(x.label) + '</i><b class="gl4-def-val">' + val + "</b>" + delta + "</span>";
    }
    return '<div class="gl4-def" title="' + esc(tip) + '"><span class="gl4-def-name">' +
      esc(x.label) + '</span><span class="gl4-def-val">' + val + "</span>" + delta + "</div>";
  }).join("") + "</section>";

  const abiGrid = '<section class="gl4-card gl4-abis">' + ABILITIES.map(function (k) {
    return '<div class="gl4-abi" title="' + ABILITY_ZH[k] + " " + d.abilities[k] + '">' +
      '<span class="gl4-abi-name">' + ABILITY_ZH[k] + '</span>' +
      '<span class="gl4-abi-mod">' + signed(d.mods[k]) + '</span>' +
      '<span class="gl4-abi-sub">' + d.abilities[k] + " · 检定 " + signed(d.mods[k] + d.half) + "</span></div>";
  }).join("") + "</section>";

  /* v1.7.6：删掉标题右边的「检定已含半等级 +15」小字（用户：只留功能本身）。 */
  const skills = '<section class="gl4-card gl4-skills"><h3 class="gl4-h">技能</h3><div class="gl4-chips">' +
    d.skills.map(renderSkill).join("") + "</div></section>";

  const attacks = (function () {
    const rows = Math.max(d.attacks.length, d.damages.length);
    if (!rows) return '<section class="gl4-card"><h3 class="gl4-h">攻击与伤害</h3><p class="gl4-empty">攻击面板没有可用行。</p></section>';
    if (compact) {
      /* v2.5.6：紧凑模式每行一条 —— 名称 / 命中 数值 + 小号临时加值 / 伤害 数值 + 小号临时加值，无表头。 */
      let html = '<section class="gl4-card gl4-atks">';
      for (let i = 0; i < rows; i++) {
        const a = d.attacks[i];
        const dm = d.damages[i];
        const label = (a && a.label) || (dm && dm.label) || "";
        const hit = a ? a.total + temps.atk : null;
        const dmg = dm ? dm.total + temps.dmg : null;
        const ctlAtk = ed.hp ? counter("", temps.atk, "atk-temp", "临时命中（所有攻击行共用）") : "";
        const ctlDmg = ed.hp ? counter("", temps.dmg, "dmg-temp", "临时伤害（所有伤害行共用）") : "";
        html += '<div class="gl4-atk-row">' +
          '<span class="gl4-atk-name">' + esc(label || "第 " + (i + 1) + " 行") + "</span>" +
          '<span class="gl4-atk-hit"><i>命中</i><b>' + (a ? signed(hit) : "—") + "</b>" + ctlAtk + "</span>" +
          '<span class="gl4-atk-dmg"><i>伤害</i><b>' + (dm ? esc(dm.dice || "—") + signed(dmg) : "—") + "</b>" + ctlDmg + "</span></div>";
      }
      return html + "</section>";
    }
    /* v2.5.6：完整模式（右键速览）保持旧版表头 + 三列排版。 */
    const ctl = ed.hp
      ? '<div class="gl4-atk-temp">' + counter("临时命中", temps.atk, "atk-temp", "所有攻击行共用的临时命中加值") +
        counter("临时伤害", temps.dmg, "dmg-temp", "所有伤害行共用的临时伤害加值") + "</div>"
      : (temps.atk || temps.dmg ? '<div class="gl4-atk-temp"><span class="gl4-pad-label">临时命中 ' + signed(temps.atk) +
        " · 临时伤害 " + signed(temps.dmg) + "</span></div>" : "");
    let html = '<section class="gl4-card gl4-atks"><h3 class="gl4-h">攻击与伤害</h3>' + ctl +
      '<div class="gl4-atk-head"><span>命中</span><span>伤害</span></div>';
    for (let i = 0; i < rows; i++) {
      const a = d.attacks[i];
      const dm = d.damages[i];
      const label = (a && a.label) || (dm && dm.label) || "";
      const hit = a ? a.total + temps.atk : null;
      const dmg = dm ? dm.total + temps.dmg : null;
      html += '<div class="gl4-atk-row"><span class="gl4-atk-name">' + esc(label || "第 " + (i + 1) + " 行") + "</span>" +
        '<span class="gl4-atk-hit">' + (a ? signed(hit) : "—") + "</span>" +
        '<span class="gl4-atk-dmg">' + (dm ? esc(dm.dice || "—") + signed(dmg) : "—") + "</span></div>";
    }
    return html + "</section>";
  })();

  const powers = (function () {
    const groups = d.powers.filter((g) => g.list.length > 0);
    if (!groups.length) return '<section class="gl4-card"><h3 class="gl4-h">威能</h3><p class="gl4-empty">这张卡还没有选威能。</p></section>';
    /* v1.8.1：最外层「可用 N/N」= 所有可追踪威能（遭遇/每日/辅助/种族职业）的剩余/总数，
     * 与 4E NEXT 速览页一致；随意威能不参与（无限次）。 */
    let total = 0;
    let used = 0;
    d.powers.forEach(function (g) {
      if (!g.track) return;
      total += g.list.length;
      used += g.used;
    });
    const avail = total > 0 ? '<em class="gl4-avail">可用 ' + (total - used) + "/" + total + "</em>" : "";
    /* v1.7.6：删掉标题右边的「点一下 = 已用 / 再用一次 = 恢复」小字（点一下就懂，不用写）。 */
    return '<section class="gl4-card gl4-powers"><h3 class="gl4-h">威能' + avail + "</h3>" +
      groups.map((g) => renderPowerGroup(g, d.powerUsed, ed)).join("") + "</section>";
  })();

  /* v1.8.6：**专长区块整块不渲染**（用户确认：名称与「每日/赠送」都不要）。
   * deriveGlance 仍然返回 d.feats（info.js 的短休按 encounterFeatKeys 清理时可用），只是界面上不输出。 */

  const equips = (function () {
    if (!d.equipRows.length) return '<section class="gl4-card"><h3 class="gl4-h">装备与魔法物品</h3><p class="gl4-empty">这张卡还没有装备物品。</p></section>';
    const used = d.equipRows.filter((r) => d.equipmentUsed[r.key]).length;
    const rows = d.equipRows.map(function (r) {
      const isUsed = !!d.equipmentUsed[r.key];
      const name = esc(zhName(r.id));
      /* v1.8.6：去掉物品等级档位（L2 7 12…），保留槽位 / 名称 / 增强 +N。 */
      const inner = '<span class="gl4-item-slot">' + esc(r.slot) + "</span>" +
        '<span class="gl4-item-name">' + name + "</span>" +
        (r.enh ? '<span class="gl4-item-enh">增强 +' + r.enh + "</span>" : "");
      if (ed.track) {
        /* v1.7.12：动作名改成 equipment（测试断言用这个名字）；track.js 仍兼容老的 item。 */
        return '<button type="button" class="gl4-item' + (isUsed ? " used" : "") + '" data-act="equipment" data-k="' + esc(r.key) +
          '" aria-pressed="' + (isUsed ? "true" : "false") + '" title="' +
          esc((isUsed ? "点击恢复：" : "点击标记已用：") + r.id) + '">' + inner + "</button>";
      }
      return '<div class="gl4-item" title="' + esc(r.id) + '">' + inner + "</div>";
    }).join("");
    /* v1.2.1：去掉「每日威能 − N ＋」计数器；装备 chip 的「已用 / 耗尽」标记保留。 */
    const head = ed.track
      ? '<h3 class="gl4-h">装备与魔法物品 <span class="gl4-count">' + d.equipRows.length + "</span>" +
        '<em>已用 ' + used + " / " + d.equipRows.length + "</em></h3>"
      : '<h3 class="gl4-h">装备与魔法物品 <span class="gl4-count">' + d.equipRows.length + "</span></h3>";
    return '<section class="gl4-card gl4-items">' + head + '<div class="gl4-item-list">' + rows + "</div></section>";
  })();

  const rest = ed.rest
    ? '<div class="gl4-rest"><button type="button" class="gl4-rest-btn" data-act="rest-short" title="短休：恢复遭遇威能 / 遭遇专长，并清空临时命中·伤害·四防·回复值；回复力不自动恢复（要手动使用）">短休</button>' +
      '<button type="button" class="gl4-rest-btn strong" data-act="rest-long" title="生命、回复力、威能、物品标记全部恢复；行动点回到 1">长休</button>' +
      '</div>'
    : "";

  /* v2.5.6：底部「数值由插件离线推导…」整段删掉（用户早就要求去掉，完整模式也不要）。 */
  const note = "";

  /* v1.7.12：共享数据开关 —— 原「玩家端隐藏数字」，从 HP 区挪到顶部标题区右侧。
   * 语义：开（.on）= 共享 = 全桌可见精确数字与四防（hp.locked = false）；
   *       关 = 玩家端只看到 25% 阶梯比例（hp.locked = true，默认）。 */
  const share = ed.hp
    ? '<button type="button" class="gl4-share' + (d.locked ? "" : " on") + '" data-act="lock" aria-pressed="' +
      (d.locked ? "false" : "true") + '" title="' + esc(d.locked
        ? "共享数据：关 —— 玩家端只看到 25% 阶梯比例，不显示精确数字与四防（metadata 仍对全桌可读，不是加密）。点击开启。"
        : "共享数据：开 —— 全桌都能看到精确数字与四防。点击关闭。") +
      '">' + (d.locked ? SHARE_ICON_LOCK : SHARE_ICON_UNLOCK) + " 共享数据</button>"
    : "";

  return '<div class="gl4 ' + (compact ? "gl4-compact" : "gl4-full") + '">' +
    '<header class="gl4-head"><div class="gl4-id"><div class="gl4-name">' + esc(char.name || "未命名角色") +
    '</div><div class="gl4-sub">' + esc(sub) + "</div></div>" +
    '<div class="gl4-head-right">' + quick + share + "</div></header>" +
    renderHpBlock(d, ed, temps, compact) +
    (compact ? defGrid : '<div class="gl4-grid2">' + defGrid + abiGrid + "</div>") +
    skills +
    attacks +
    powers +
    equips +
    rest +
    note +
    "</div>";
}

/** 列表行用的轻量元信息（不渲染整张卡）。 */
export function cardMeta(char, rules) {
  const d = deriveGlance(char, rules || RULES);
  return {
    name: char.name || "未命名角色",
    level: d.level,
    race: zhName(char.raceId),
    cls: prettyClass(char.classId),
    hp: d.hpCur,
    maxHp: d.maxHp,
    known: d.known
  };
}