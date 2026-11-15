// 4E NEXT「速览」渲染层：把导出的 Character 渲染成纯 HTML（只读、无框架、无构建）。
//
// 数值口径尽量对齐 4E NEXT 的 web/src/overview/derive.ts 与 sheet/defense.ts：
//   · 属性 = 基础值 + 种族加值
//   · 生命 = 职业起始HP + 体质 + 每级HP×(等级-1) + 额外生命；混职时两个职业相加后取整
//   · 防御 = 10 + 半等级 + 属性 + 职业/种族/护甲/盾牌/专长/自定义加值（含魔法物品增强）
//   · 技能 = 半等级 + 属性调整 + 受训5 + 技能巧手 + 种族 + 自定义 - 护甲检定减值
//   · 攻击 = 半等级 + 属性 + 职业 + 擅长 + 专长 + 增强 + 自定义；伤害 = 属性 + 专长 + 增强 + 自定义
// 少数依赖完整规则正文的加值（职业特性自动加值、专长逐条效果）无法离线还原，见 README「已知限制」。

import { RULES } from "../data/rules.js";

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
const WEAPON_GROUPS = ["硬头锤", "轻刃", "矛", "徒手", "杖", "重刃", "斧", "连枷", "锤", "镐", "长武器", "鞭", "绞索", "弩", "投石索", "弓", "吹箭筒"];
const DIFFICULTIES = ["简易", "军用", "优异"];
const WEAPON_TYPES = ["近战", "远程"];
const HANDEDNESS = ["单手", "双手"];
const EQUIP_USED_PREFIX = { fixed: "e", other: "o", consumable: "c", wondrous: "w", companion: "m" };

// ---------- 小工具 ----------
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
const n0 = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
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
export function deriveGlance(char, rules) {
  rules = rules || RULES;
  char = char || {};
  const level = Math.max(1, n0(char.level) || 1);
  const half = Math.floor(level / 2);
  const cls = classStats(rules, char);
  const race = raceRow(rules, char.raceId);
  const armor = baseItem(rules, (char.baseItems || {})[5]);
  const shield = findShield(rules, char);
  const heavy = !!(armor && armor.kind === "armor" && armor.ref.c === "重甲");

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
      key: "ac", label: "AC", value: 10 + half + acAbilityMod + dsum("ac"),
      parts: parts(10, [["半等级", half], [heavy ? "重甲" : "敏捷/智力", acAbilityMod]], dmods("ac"))
    },
    {
      key: "fort", label: "强韧",
      value: 10 + half + Math.max(mods.str, mods.con) + cls.fort + dsum("fort") + raceDef("fort"),
      parts: parts(10, [["半等级", half], ["力量/体质", Math.max(mods.str, mods.con)], ["职业", cls.fort], ["种族", raceDef("fort")]], dmods("fort"))
    },
    {
      key: "ref", label: "反射",
      value: 10 + half + Math.max(mods.dex, mods.int) + cls.ref + dsum("ref") + raceDef("ref"),
      parts: parts(10, [["半等级", half], ["敏捷/智力", Math.max(mods.dex, mods.int)], ["职业", cls.ref], ["种族", raceDef("ref")]], dmods("ref"))
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
  const hpCur = typeof hpNow.max === "number" ? hpNow.max : maxHp;
  const surgesCur = typeof hpNow.surges === "number" ? hpNow.surges : surges;

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
      dice: w && w.kind === "weapon" ? w.ref.d : "",
      total: mods[r.ability || "str"] + n0(r.feat) + enhanceOf(rules, char, slot) + sum(customDmg[i])
    };
  });

  const speedBase = parseInt(String(race ? race[3] : ""), 10);
  const speedMods = char.speedMods || {};
  const speed = (isNaN(speedBase) ? 0 : speedBase) + n0(speedMods.power) + n0(speedMods.feat) + n0(speedMods.item) +
    sum((char.customBonuses || {}).speed) + (armor && armor.kind === "armor" ? n0(armor.ref.s) : 0);

  const initiative = mods.dex + half + sum((char.customBonuses || {}).init);
  const perception = (char.customBonuses || {}).perception || {};

  const powers = POWER_GROUPS.map(function (g) {
    const list = ((char.powerSlots || {})[g.key] || []).map((id, i) => ({ id: id, i: i })).filter((x) => !!x.id);
    const used = list.filter((x) => (char.powerUsed || {})[g.key + "-" + x.i]).length;
    return { key: g.key, label: g.label, color: g.color, track: g.track, list: list, used: used };
  });

  const feats = (char.featSlots || []).map((id, i) => ({ id: id, key: String(i), granted: false }))
    .filter((x) => !!x.id)
    .concat((char.classGrantedFeatIds || []).map((id) => ({ id: id, key: "g-" + id, granted: true })));

  const equipRows = [];
  function pushEquips(slots, prefix, label) {
    (slots || []).forEach(function (id, i) {
      if (!id) return;
      equipRows.push({ id: id, key: prefix + "-" + i, slot: label || EQUIPMENT_SLOTS[i] || "装备", enh: prefix === "e" ? enhanceOf(rules, char, i) : 0 });
    });
  }
  pushEquips(char.equipmentSlots, "e", null);
  pushEquips(char.wondrousSlots, "w", "奇物");
  pushEquips(char.otherSlots, "o", "其他");
  pushEquips(char.consumableSlots, "c", "消耗品");
  pushEquips(char.companionSlots, "m", "魔宠/坐骑");

  return {
    level: level, half: half, cls: cls, race: race,
    abilities: abilities, mods: mods, defenses: defenses,
    maxHp: maxHp, bloodied: bloodied, surgeValue: surgeValue, surges: surges,
    hpCur: hpCur, surgesCur: surgesCur, hpTemp: n0(char.tempHp),
    skills: skills, attacks: attacks, damages: damages,
    initiative: initiative, speed: speed,
    passivePerception: 10 + skillOf("侦查") + sum(perception.passivePerception),
    passiveInsight: 10 + skillOf("洞察") + sum(perception.passiveInsight),
    powers: powers, feats: feats, equipRows: equipRows,
    known: { cls: !!classRow(rules, char.classId), race: !!race, armor: !!armor, shield: !!shield },
    actionPoints: n0(char.actionPoints), milestones: n0(char.milestones), powerPoints: n0(char.powerPoints),
    languages: (char.languages || []).join("、"),
    size: race ? race[2] : char.size || "",
    vision: race ? race[4] : char.vision || ""
  };
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

function renderPowerGroup(d, char) {
  const body = d.list.map(function (x) {
    const used = (char.powerUsed || {})[d.key + "-" + x.i] ? " used" : "";
    return '<span class="gl4-chip' + used + '" title="' + esc(x.id) + '">' + esc(zhName(x.id)) + "</span>";
  }).join("");
  const count = d.track ? d.list.length - d.used + " / " + d.list.length : "无限";
  return '<div class="gl4-pgroup"><div class="gl4-phead"><span class="gl4-dot" style="background:' + d.color +
    '"></span>' + esc(d.label) + '<span class="gl4-pcount">' + count + '</span></div><div class="gl4-chips">' + body + "</div></div>";
}

export function renderGlanceHTML(char, opts) {
  opts = opts || {};
  const d = deriveGlance(char, opts.rules);
  const compact = opts.mode === "compact";
  const classNames = [prettyClass(char.classId)];
  if (char.hybrid && char.classId2) classNames.push(prettyClass(char.classId2));
  const classText = classNames.filter(Boolean).join(" / ");
  const sub = ["Lv" + d.level, zhName(char.raceId) || d.size, char.hybrid && classText ? "混职：" + classText : classText]
    .filter(Boolean).join(" · ");

  const pct = d.maxHp > 0 ? Math.max(0, Math.min(100, (d.hpCur / d.maxHp) * 100)) : 0;
  const bloodPct = d.maxHp > 0 ? Math.max(0, Math.min(100, (d.bloodied / d.maxHp) * 100)) : 50;
  const state = d.hpCur <= 0 ? ["dying", "濒死"] : d.hpCur <= d.bloodied ? ["bloodied", "重伤"] : ["ok", "健康"];

  const hpBlock = '<section class="gl4-card gl4-vitals">' +
    '<div class="gl4-hp-line"><span class="gl4-hp-cur">' + esc(d.hpCur) + '</span>' +
    '<span class="gl4-hp-max">/ ' + esc(d.maxHp) + '</span>' +
    '<span class="gl4-state ' + state[0] + '">' + state[1] + "</span>" +
    (d.hpTemp > 0 ? '<span class="gl4-temp">临时 +' + esc(d.hpTemp) + "</span>" : "") +
    "</div>" +
    '<div class="gl4-hpbar" title="重伤线 ' + d.bloodied + '">' +
    '<div class="gl4-hpfill ' + state[0] + '" style="width:' + pct.toFixed(1) + '%"></div>' +
    '<div class="gl4-hpmark" style="left:' + bloodPct.toFixed(1) + '%"></div></div>' +
    '<div class="gl4-tags">' +
    "<span><i>血怒</i><b>" + d.bloodied + "</b></span>" +
    "<span><i>回复值</i><b>" + d.surgeValue + "</b></span>" +
    "<span><i>回复力</i><b>" + d.surgesCur + " / " + d.surges + "</b></span>" +
    "<span><i>行动点</i><b>" + d.actionPoints + "</b></span>" +
    (d.milestones ? "<span><i>里程碑</i><b>" + d.milestones + "</b></span>" : "") +
    (d.powerPoints ? "<span><i>灵能点</i><b>" + d.powerPoints + "</b></span>" : "") +
    "</div></section>";

  const quick = '<div class="gl4-quick">' +
    '<span class="gl4-q"><i>先攻</i><b>' + signed(d.initiative) + "</b></span>" +
    '<span class="gl4-q"><i>被动侦查</i><b>' + d.passivePerception + "</b></span>" +
    '<span class="gl4-q"><i>被动洞察</i><b>' + d.passiveInsight + "</b></span>" +
    '<span class="gl4-q"><i>移动</i><b>' + (d.speed ? d.speed + " 格" : "—") + "</b></span></div>";

  const defGrid = '<section class="gl4-card gl4-defs">' + d.defenses.map(function (x) {
    return '<div class="gl4-def" title="' + esc(partsText(x.parts)) + '"><span class="gl4-def-name">' +
      esc(x.label) + '</span><span class="gl4-def-val">' + x.value + "</span></div>";
  }).join("") + "</section>";

  const abiGrid = '<section class="gl4-card gl4-abis">' + ABILITIES.map(function (k) {
    return '<div class="gl4-abi" title="' + ABILITY_ZH[k] + " " + d.abilities[k] + '">' +
      '<span class="gl4-abi-name">' + ABILITY_ZH[k] + '</span>' +
      '<span class="gl4-abi-mod">' + signed(d.mods[k]) + '</span>' +
      '<span class="gl4-abi-sub">' + d.abilities[k] + " · 检定 " + signed(d.mods[k] + d.half) + "</span></div>";
  }).join("") + "</section>";

  const skills = '<section class="gl4-card gl4-skills"><h3 class="gl4-h">技能 <em>检定已含半等级 +' + d.half +
    '</em></h3><div class="gl4-chips">' + d.skills.map(renderSkill).join("") + "</div></section>";

  const attacks = (function () {
    const rows = Math.max(d.attacks.length, d.damages.length);
    if (!rows) return '<section class="gl4-card"><h3 class="gl4-h">攻击与伤害</h3><p class="gl4-empty">攻击面板没有可用行。</p></section>';
    let html = '<section class="gl4-card gl4-atks"><h3 class="gl4-h">攻击与伤害</h3>' +
      '<div class="gl4-atk-head"><span>命中</span><span>伤害</span></div>';
    for (let i = 0; i < rows; i++) {
      const a = d.attacks[i];
      const dm = d.damages[i];
      const label = (a && a.label) || (dm && dm.label) || "";
      html += '<div class="gl4-atk-row"><span class="gl4-atk-name">' + esc(label || "第 " + (i + 1) + " 行") + "</span>" +
        '<span class="gl4-atk-hit">' + (a ? signed(a.total) : "—") + "</span>" +
        '<span class="gl4-atk-dmg">' + (dm ? esc(dm.dice || "—") + signed(dm.total) : "—") + "</span></div>";
    }
    return html + "</section>";
  })();

  const powers = (function () {
    const groups = d.powers.filter((g) => g.list.length > 0);
    if (!groups.length) return '<section class="gl4-card"><h3 class="gl4-h">威能</h3><p class="gl4-empty">这张卡还没有选威能。</p></section>';
    return '<section class="gl4-card gl4-powers"><h3 class="gl4-h">威能 <em>灰色 = 导出时已标记使用</em></h3>' +
      groups.map((g) => renderPowerGroup(g, char)).join("") + "</section>";
  })();

  const feats = (function () {
    if (!d.feats.length) return '<section class="gl4-card"><h3 class="gl4-h">专长</h3><p class="gl4-empty">这张卡还没有选专长。</p></section>';
    return '<section class="gl4-card gl4-feats"><h3 class="gl4-h">专长 <span class="gl4-count">' + d.feats.length + '</span></h3><div class="gl4-chips">' +
      d.feats.map(function (f) {
        const used = (char.featUsed || {})[f.key] ? " used" : "";
        return '<span class="gl4-chip feat' + used + '" title="' + esc(f.id) + '">' + esc(zhName(f.id)) +
          (f.granted ? '<em class="gl4-tag">赠送</em>' : "") + "</span>";
      }).join("") + "</div></section>";
  })();

  const equips = (function () {
    if (!d.equipRows.length) return '<section class="gl4-card"><h3 class="gl4-h">装备与魔法物品</h3><p class="gl4-empty">这张卡还没有装备物品。</p></section>';
    return '<section class="gl4-card gl4-items"><h3 class="gl4-h">装备与魔法物品 <span class="gl4-count">' + d.equipRows.length +
      '</span></h3><div class="gl4-item-list">' + d.equipRows.map(function (r) {
        const used = (char.equipmentUsed || {})[r.key] ? " used" : "";
        return '<div class="gl4-item' + used + '" title="' + esc(r.id) + '">' +
          '<span class="gl4-item-slot">' + esc(r.slot) + "</span>" +
          '<span class="gl4-item-name">' + esc(zhName(r.id)) + "</span>" +
          (r.enh ? '<span class="gl4-item-enh">增强 +' + r.enh + "</span>" : "") + "</div>";
      }).join("") + "</div></section>";
  })();

  const note = compact ? "" : '<p class="gl4-note">数值由插件离线推导；职业特性自动加值与部分专长效果无法离线还原，可能与 4E NEXT 差 1~2 点，以 4E NEXT 为准。面板只读，改卡请回 4E NEXT。</p>';

  return '<div class="gl4 ' + (compact ? "gl4-compact" : "gl4-full") + '">' +
    '<header class="gl4-head"><div class="gl4-id"><div class="gl4-name">' + esc(char.name || "未命名角色") +
    '</div><div class="gl4-sub">' + esc(sub) + "</div></div>" + quick + "</header>" +
    hpBlock +
    '<div class="gl4-grid2">' + defGrid + abiGrid + "</div>" +
    skills +
    attacks +
    powers +
    feats +
    equips +
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
