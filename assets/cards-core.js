// v1.7.15：角色卡的「精简（打包）格式」+ 房间数据（room metadata）体积预算。
// ---------------------------------------------------------------------------
// 为什么要有这个文件：真机控制台报
//     Uncaught (in promise) Error: Unable to update metadata: over size limit of 16 kB
// 因为 v1.7.14 及以前把**导入的 4E NEXT 完整角色卡 JSON 原样**塞进 room.metadata，
// 单张 4E 卡就有 4~50 KB；整包（cards + initiative + rolls + state）远超 16 KB 之后，
// **之后所有** room.setMetadata（加入先攻 / 改加值 / 回合推进 / 骰子历史 / 资源）全部被拒，
// 而且失败是静默的（只有后台日志）。
//
// 这一版做三件事，全都在这个文件里（纯函数，不 import 任何东西）：
//   1) packCard / unpackCard：只把「渲染速览真正用到的字段」写进房间数据，
//      并把结构压成短键 + 数值数组（细节见 packCard 的注释）。
//      读出来时还原成 4E NEXT 导出的 Character 形状 → glance.js / track.js / initiative.js
//      一行都不用改（它们只认 char 的字段名）。
//   2) cardBytes / CARD_MAX_BYTES：单卡体积预算（目标 ≤ 2 KB）。
//   3) roomBytes / roomBudget / ROOM_MAX_BYTES：整份房间数据的体积预算（14 KB，
//      给 Owlbear 的 16 KB 硬上限留 2 KB 余量）。超了就不写 + ERROR 通知（见 common.js）。
//
// 约束：本文件是 ESM，浏览器页面直接 import；assets/background.core.js 是经典脚本，
// 不能 import —— 它在自己文件里有一份**同算法**的 roomBytes/roomBudget（常量与本文件
// 必须一字不差，dev/check.mjs 会逐项对比）。

/** 房间数据命名空间（与 assets/common.js 的 NS 同一个值）。 */
export const ROOM_NS = "com.4enext-owlbear";
/** 整份房间数据（只算本插件的键）的预算：14 KB。 */
export const ROOM_MAX_BYTES = 14 * 1024;
/** Owlbear 的硬上限（报错文案里的 16 kB）。 */
export const ROOM_HARD_BYTES = 16 * 1024;
/** 单张卡（打包后的 char）的目标体积。 */
export const CARD_MAX_BYTES = 2048;
/** 超限时给用户看的 **唯一** 文案（后台 / 页面 / 设置窗口共用，dev/check.mjs 逐字对比）。 */
export const ROOM_FULL_MESSAGE = "房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史";
/** 本机兜底：房间数据装不下角色卡时，卡片列表只存在这台机器上（与 background.core.js 一致）。 */
export const LS_CARDS = "4enext/cards-local";

const ABILITIES = ["str", "con", "dex", "int", "wis", "cha"];
const SKILL_KEYS = ["race", "other", "armor"];
const DEF_KEYS = ["ac", "fort", "ref", "will"];

const n0 = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const isNum = (v) => typeof v === "number" && isFinite(v);
const list = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? "" : String(v));

/** 去掉 0 / "" / null / 空数组 / 空对象 —— 房间数据按字节算钱，空值一个都不存。 */
function clean(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v == null || v === "" || v === 0 || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) continue;
    out[k] = v;
  }
  return out;
}

/** 自定义加值 [{label,value}] → [value…]（label 只在 4E NEXT 里显示，速览只求和）。 */
function valList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    const n = n0(x && typeof x === "object" ? x.value : x);
    if (n) out.push(n);
  }
  return out;
}

/** 自定义防御加值 {ac:[…],fort:[…]} → {ac:[v…]}。 */
function valMap(obj) {
  const out = {};
  for (const k of DEF_KEYS) {
    const v = valList((obj || {})[k]);
    if (v.length) out[k] = v;
  }
  return out;
}

/** 打包后的数值数组 → [{label:"", value}]（速览 / 面板只读 value，标签丢了不影响数值）。 */
function backList(arr) {
  const out = [];
  for (const v of list(arr)) if (isNum(v) && v) out.push({ label: "", value: v });
  return out;
}

/**
 * 完整 Character → 精简（打包）对象。幂等：已经是打包格式就原样返回。
 *
 * 只保留「速览 / 面板 / 先攻」真正读到的字段（glance.js 的 deriveGlance /
 * renderGlanceHTML / cardMeta / initiativeBonus 就是全部消费者）：
 *   名字 / 等级 / 六属性 / 种族 / 职业（含混职）/ 种族属性选择
 *   baseItems（武器 / 护甲 / 盾，攻防与技能惩罚要用）
 *   defenseMods / customBonuses / skillMods / combatMods（四防、技能、命中、伤害）
 *   hpBonus / surgeValueBonus / surgeBonus / tempHp / hpNow（生命 / 回复力）
 *   trainedSkills / classTrainedSkills（技能受训）
 *   featSlots / classGrantedFeatIds / featChoices（专长列表 + 专长给的擅长）
 *   equipmentSlots / equipmentEnhance / wondrous|other|consumable|companionSlots（装备与增强）
 *   powerSlots（威能列表；随意 / 遭遇 / 每日 / 辅助 / 种族职业）
 *   powerUsed / featUsed / equipmentUsed / itemDailyUsed（导出快照里的「已用」标记）
 *   actionPoints / milestones / powerPoints / languages / size / vision / speedMods
 * 不存：立绘（原图 / 裁切）、spellbook、backpack、creation 正文、xp / 性别 / 年龄 / 信仰等
 *       纯资料字段、以及 4E NEXT 的 pages.reserve / overview / background 三页。
 */
export function packCard(char) {
  if (!char || typeof char !== "object") return { pz: 1, n: "未命名角色", l: 1 };
  if (char.pz === 1) return char;
  const out = { pz: 1 };
  out.n = str(char.name).trim() || "未命名角色";
  out.l = n0(char.level) || 1;
  const ab = {};
  let anyAb = false;
  const abArr = ABILITIES.map(function (k) {
    const v = n0((char.abilities || {})[k]);
    if (v) anyAb = true;
    return v;
  });
  if (anyAb) out.ab = abArr;
  if (char.raceId) out.ra = str(char.raceId);
  if (char.classId) out.cl = str(char.classId);
  if (char.classId2) out.c2 = str(char.classId2);
  if (char.hybrid) out.hy = 1;
  if (char.raceAbility2Choice) out.r2 = str(char.raceAbility2Choice);

  const bi = clean(char.baseItems);
  if (Object.keys(bi).length) out.bi = bi;

  const dm = {};
  for (const k of DEF_KEYS) {
    const m = clean((char.defenseMods || {})[k]);
    if (Object.keys(m).length) dm[k] = m;
  }
  if (Object.keys(dm).length) out.dm = dm;

  const cbIn = char.customBonuses || {};
  const cb = {};
  const cbInit = valList(cbIn.init);
  if (cbInit.length) cb.i = cbInit;
  const cbSpeed = valList(cbIn.speed);
  if (cbSpeed.length) cb.s = cbSpeed;
  const cbDef = valMap(cbIn.defense);
  if (Object.keys(cbDef).length) cb.d = cbDef;
  const cp = cbIn.perception || {};
  const pPer = valList(cp.passivePerception);
  const pIns = valList(cp.passiveInsight);
  if (pPer.length || pIns.length) cb.p = [pPer, pIns];
  const cbAtk = list(cbIn.attack).map(valList);
  if (cbAtk.some(function (x) { return x.length; })) cb.a = cbAtk;
  const cbDmg = list(cbIn.damage).map(valList);
  if (cbDmg.some(function (x) { return x.length; })) cb.g = cbDmg;
  const cbSkill = {};
  const skillBox = cbIn.skill || {};
  for (const k of Object.keys(skillBox)) {
    const v = valList(skillBox[k]);
    if (v.length) cbSkill[k] = v;
  }
  if (Object.keys(cbSkill).length) cb.k = cbSkill;
  if (Object.keys(cb).length) out.cb = cb;

  const sm = {};
  const smIn = char.skillMods || {};
  for (const k of Object.keys(smIn)) {
    const m = smIn[k] || {};
    const row = SKILL_KEYS.map(function (x) { return n0(m[x]); });
    if (row[0] || row[1] || row[2]) sm[k] = row;
  }
  if (Object.keys(sm).length) out.sm = sm;

  const cm = char.combatMods || {};
  const atk = list(cm.attacks).map(function (r) {
    r = r || {};
    return [
      r.ability || "str", n0(r.classBonus), n0(r.profBonus), n0(r.profSlot),
      r.profOverride ? 1 : 0, r.profImplement ? 1 : 0, n0(r.feat), n0(r.enhanceSlot),
      str(r.label).trim()
    ];
  });
  const dmg = list(cm.damages).map(function (r) {
    r = r || {};
    return [r.ability || "str", n0(r.feat), n0(r.enhanceSlot)];
  });
  if (atk.length || dmg.length) out.cm = { a: atk, d: dmg };

  if (n0(char.hpBonus)) out.hb = n0(char.hpBonus);
  if (n0(char.surgeValueBonus)) out.sv = n0(char.surgeValueBonus);
  if (n0(char.surgeBonus)) out.sb = n0(char.surgeBonus);
  if (n0(char.tempHp)) out.th = n0(char.tempHp);
  /* hpNow 里的 0 是**有意义的**（回复力用光 / 生命归零），不能像其它字段那样丢 0。 */
  const hnIn = char.hpNow;
  if (hnIn && typeof hnIn === "object") {
    const hn = {};
    for (const k of ["cur", "max", "surges", "surgeValue"]) if (isNum(hnIn[k])) hn[k] = hnIn[k];
    if (Object.keys(hn).length) out.hn = hn;
  }

  const ts = list(char.trainedSkills).filter(function (x) { return !!x; });
  if (ts.length) out.ts = ts;
  const cts = list(char.classTrainedSkills).filter(function (x) { return !!x; });
  if (cts.length) out.cts = cts;

  /* 列表里的 null **保留下标**：powerUsed / equipmentUsed 的 key 用下标 / 位置算，
   * 把中间的空位删掉会让「已用」标记错位。只砍结尾的空位。 */
  function keepSlots(src) {
    const arr = list(src).map(function (x) { return x || null; });
    while (arr.length && !arr[arr.length - 1]) arr.pop();
    return arr.some(function (x) { return !!x; }) ? arr : null;
  }
  const fs2 = keepSlots(char.featSlots);
  if (fs2) out.fs = fs2;
  const cgf = list(char.classGrantedFeatIds).filter(function (x) { return !!x; });
  if (cgf.length) out.cgf = cgf;
  const fc = char.featChoices;
  if (fc && typeof fc === "object") {
    const fcOut = clean(fc);
    if (Object.keys(fcOut).length) out.fc = fcOut;
  }

  const es = keepSlots(char.equipmentSlots);
  if (es) out.es = es;
  const ee = clean(char.equipmentEnhance);
  const eeOut = {};
  for (const k of Object.keys(ee)) if (ee[k] !== 1) eeOut[k] = ee[k];
  if (Object.keys(eeOut).length) out.ee = eeOut;
  for (const pair of [["ws", "wondrousSlots"], ["os", "otherSlots"], ["cs", "consumableSlots"], ["ms", "companionSlots"]]) {
    const v = list(char[pair[1]]).filter(function (x) { return !!x; });
    if (v.length) out[pair[0]] = v;
  }

  const psIn = char.powerSlots || {};
  const ps = {};
  for (const k of ["atWill", "encounter", "daily", "utility", "special"]) {
    const arr = keepSlots(psIn[k]);
    if (arr) ps[k] = arr;
  }
  if (Object.keys(ps).length) out.ps = ps;
  const pu = clean(char.powerUsed);
  if (Object.keys(pu).length) out.pu = pu;
  const fu = clean(char.featUsed);
  if (Object.keys(fu).length) out.fu = fu;
  const eu = clean(char.equipmentUsed);
  if (Object.keys(eu).length) out.eu = eu;
  if (n0((char.glance || {}).itemDailyUsed)) out.on = n0((char.glance || {}).itemDailyUsed);

  /* 行动点缺省就是 1（4E 每场遭遇 1 点），所以「1」不用存；0 / 2+ 才存。 */
  if (n0(char.actionPoints) !== 1) out.ap = n0(char.actionPoints);
  if (n0(char.milestones)) out.ml = n0(char.milestones);
  if (n0(char.powerPoints)) out.pp = n0(char.powerPoints);
  const lg = list(char.languages).filter(function (x) { return !!x; });
  if (lg.length) out.lg = lg;
  if (char.size) out.sz = str(char.size);
  if (char.vision) out.vi = str(char.vision);
  const sp = char.speedMods || {};
  const spRow = [n0(sp.power), n0(sp.feat), n0(sp.item)];
  if (spRow[0] || spRow[1] || spRow[2]) out.sp = spRow;
  return out;
}

/**
 * 精简对象 → 4E NEXT 导出的 Character 形状（缺的字段补空，**零值不补错**）。
 * 兼容旧数据：不是打包格式（v1.7.14 及以前直接存了完整卡）就原样返回一个浅拷贝。
 */
export function unpackCard(wire) {
  if (!wire || typeof wire !== "object") return {};
  if (wire.pz !== 1) return Object.assign({}, wire);
  const ab = list(wire.ab);
  const abilities = {};
  ABILITIES.forEach(function (k, i) { abilities[k] = n0(ab[i]); });
  const defenseMods = {};
  for (const k of DEF_KEYS) defenseMods[k] = Object.assign({}, (wire.dm || {})[k] || {});
  const cbIn = wire.cb || {};
  const cb = {
    init: backList(cbIn.i),
    speed: backList(cbIn.s),
    defense: {},
    perception: {
      passivePerception: backList((cbIn.p || [])[0]),
      passiveInsight: backList((cbIn.p || [])[1])
    },
    attack: list(cbIn.a).map(backList),
    damage: list(cbIn.g).map(backList),
    skill: {}
  };
  for (const k of DEF_KEYS) cb.defense[k] = backList((cbIn.d || {})[k]);
  const cbSkill = cbIn.k || {};
  for (const k of Object.keys(cbSkill)) cb.skill[k] = backList(cbSkill[k]);
  const skillMods = {};
  const smIn = wire.sm || {};
  for (const k of Object.keys(smIn)) {
    const row = list(smIn[k]);
    skillMods[k] = { race: n0(row[0]), other: n0(row[1]), armor: n0(row[2]) };
  }
  const cm = wire.cm || {};
  const attacks = list(cm.a).map(function (r) {
    r = list(r);
    return {
      ability: r[0] || "str", classBonus: n0(r[1]), profBonus: n0(r[2]), profSlot: n0(r[3]),
      profOverride: !!r[4], profImplement: !!r[5], feat: n0(r[6]), enhanceSlot: n0(r[7]),
      label: str(r[8])
    };
  });
  const damages = list(cm.d).map(function (r) {
    r = list(r);
    return { ability: r[0] || "str", feat: n0(r[1]), enhanceSlot: n0(r[2]) };
  });
  const powerSlots = {};
  for (const k of ["atWill", "encounter", "daily", "utility", "special"]) {
    powerSlots[k] = list((wire.ps || {})[k]).map(function (x) { return x || null; });
  }
  return {
    name: str(wire.n) || "未命名角色",
    level: n0(wire.l) || 1,
    abilities: abilities,
    raceId: str(wire.ra),
    classId: str(wire.cl),
    classId2: str(wire.c2),
    hybrid: !!wire.hy,
    raceAbility2Choice: str(wire.r2),
    baseItems: Object.assign({}, wire.bi || {}),
    defenseMods: defenseMods,
    customBonuses: cb,
    skillMods: skillMods,
    combatMods: { attacks: attacks, damages: damages },
    hpBonus: n0(wire.hb),
    surgeValueBonus: n0(wire.sv),
    surgeBonus: n0(wire.sb),
    tempHp: n0(wire.th),
    hpNow: Object.assign({}, wire.hn || {}),
    trainedSkills: list(wire.ts).slice(),
    classTrainedSkills: list(wire.cts).slice(),
    featSlots: list(wire.fs).map(function (x) { return x || null; }),
    classGrantedFeatIds: list(wire.cgf).slice(),
    featChoices: Object.assign({}, wire.fc || {}),
    equipmentSlots: list(wire.es).map(function (x) { return x || null; }),
    equipmentEnhance: Object.assign({}, wire.ee || {}),
    wondrousSlots: list(wire.ws).slice(),
    otherSlots: list(wire.os).slice(),
    consumableSlots: list(wire.cs).slice(),
    companionSlots: list(wire.ms).slice(),
    powerSlots: powerSlots,
    powerUsed: Object.assign({}, wire.pu || {}),
    featUsed: Object.assign({}, wire.fu || {}),
    equipmentUsed: Object.assign({}, wire.eu || {}),
    glance: { itemDailyUsed: n0(wire.on) },
    actionPoints: wire.ap == null ? 1 : n0(wire.ap),
    milestones: n0(wire.ml),
    powerPoints: n0(wire.pp),
    languages: list(wire.lg).slice(),
    size: str(wire.sz),
    vision: str(wire.vi),
    speedMods: { power: n0((wire.sp || [])[0]), feat: n0((wire.sp || [])[1]), item: n0((wire.sp || [])[2]) }
  };
}

/** 一张卡（打包后的 char）占多少字符（= JSON.stringify(...).length，与房间数据同口径）。 */
export function cardBytes(char) {
  try {
    return JSON.stringify(packCard(char)).length;
  } catch (e) {
    return 0;
  }
}

/** 整份卡片的字节数（含 id / name / 时间戳这些外壳字段）。 */
export function cardsBytes(cards) {
  try {
    return JSON.stringify((cards || []).map(function (c) {
      return Object.assign({}, c, { char: packCard(c && c.char) });
    })).length;
  } catch (e) {
    return 0;
  }
}

/** 只算本插件的键的房间数据体积（别的扩展的键不该算进我们的预算）。 */
export function roomBytes(meta, ns) {
  const prefix = ns || ROOM_NS;
  const box = {};
  if (meta && typeof meta === "object") {
    for (const k of Object.keys(meta)) if (k.indexOf(prefix) === 0) box[k] = meta[k];
  }
  try {
    return JSON.stringify(box).length;
  } catch (e) {
    return 0;
  }
}

/** 把「当前房间数据 + 这次要写的键」拼成写下去之后的整体（体积按它算）。 */
export function mergeRoom(meta, patch, ns) {
  const prefix = ns || ROOM_NS;
  const box = {};
  if (meta && typeof meta === "object") {
    for (const k of Object.keys(meta)) if (k.indexOf(prefix) === 0) box[k] = meta[k];
  }
  if (patch && typeof patch === "object") {
    for (const k of Object.keys(patch)) box[k] = patch[k];
  }
  return box;
}

/** 写之前的预算检查：{ ok, bytes, max }。超了调用方**不要写**（见 common.js 的 writeRoomKey）。 */
export function roomBudget(meta, patch, ns) {
  const bytes = roomBytes(mergeRoom(meta, patch, ns), ns);
  return { ok: bytes <= ROOM_MAX_BYTES, bytes: bytes, max: ROOM_MAX_BYTES };
}
