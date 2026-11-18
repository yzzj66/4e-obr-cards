// 生成 data/rules.js：把 4E NEXT 的规则数据裁剪成插件离线可用的紧凑索引。
//
// 这个脚本只是「开发时跑一次」的工具，插件运行完全不需要它（产物已提交在 data/ 里）。
// 输入：<4E-NEXT>/out/categories/{class,race,equipment}.json 与 web/src/lib/baseitems*.ts
// 输出：data/rules.js（ESM，直接 import，无需 fetch、无需构建）
//
// 用法：node dev/gen-rules.mjs
//   可用环境变量 FOUR_E_SRC 指定 4E NEXT 源码根目录（默认 ../../archive/4E-NEXT-main）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const SRC = process.env.FOUR_E_SRC || path.resolve(ROOT, "../archive/4E-NEXT-main");
const OUT = path.join(ROOT, "data", "rules.js");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---- 与 4E NEXT 相同的解析口径（web/src/sheet/character.ts）----
const num = (text, re) => {
  const m = text.match(re);
  return m ? parseFloat(m[1]) : 0;
};
function parseClassStats(text) {
  const out = {
    baseHp: num(text, /起始HP：[^0-9]*(\d+(?:\.\d+)?)/),
    hpPerLevel: num(text, /每级增加HP：[^0-9]*(\d+(?:\.\d+)?)/),
    surges: num(text, /每日回复力：[^0-9]*(\d+(?:\.\d+)?)/),
    fort: 0, ref: 0, will: 0
  };
  /* v2.4.5：只认「防御加值：+N强韧/反射/意志」，不要把正文里其它 +N 误当职业防御。
   * 带「或」的选择型（如混职督军 +1强韧或意志）按 4E NEXT 当前卡（费兹）取第一个。 */
  const line = /防御加值[：:]\s*''?\s*\+(\d+)\s*([^\n''"]+)/.exec(text);
  if (!line) return out;
  const n = parseInt(line[1], 10);
  const clause = line[2];
  /* 选择型（+1强韧或意志）：角色 JSON 没明确选择 → 默认不加。 */
  if (/或/.test(clause)) return out;
  for (const [k, zh] of [["fort", "强韧"], ["ref", "反射"], ["will", "意志"]]) {
    if (clause.indexOf(zh) >= 0) out[k] = n;
  }
  return out;
}
function parseBuiltinTrainedSkills(text) {
  const m = text.match(/受训技能：([^。\n]*)/);
  if (!m) return [];
  return m[1].replace(/''/g, "").split(/[、，，,]/).map((s) => s.trim()).filter(Boolean);
}
function parseRaceDefenses(text) {
  const out = {};
  /* v2.4.5：人类写作「人类防御奖励：你在强韧、反射和意志上获得+1种族加值」，需合并解析。 */
  const all = /(?:防御奖励|防御加值)[：:]?[^\n]{0,20}?你在([^\n。]{0,40}?)上获得\s*\+?(\d+)\s*种族加值/.exec(text);
  if (all) {
    const n = parseInt(all[2], 10);
    for (const [k, zh] of [["fort", "强韧"], ["ref", "反射"], ["will", "意志"]]) {
      if (all[1].indexOf(zh) >= 0) out[k] = n;
    }
    if (Object.keys(out).length) return out;
  }
  for (const [k, zh] of [["fort", "强韧"], ["ref", "反射"], ["will", "意志"]]) {
    const m = text.match(new RegExp("你在" + zh + "上获得\\+?(\\d+)种族加值"));
    if (m) out[k] = parseInt(m[1], 10);
  }
  return out;
}
function extractProficiencyTokens(value) {
  const v = value
    .replace(/^(你)?获得/, "")
    .replace(/的擅长\s*$/, "")
    .replace(/^所有/, "")
    .replace(/武器$/, "")
    .replace(/简易和军用/g, "简易，军用")
    .replace(/军用和优异/g, "军用，优异")
    .trim();
  return v.split(/[，,、和及与]+/).map((s) => s.trim()).filter(Boolean);
}
function weaponProfTokens(text) {
  const out = [];
  for (const m of text.matchAll(/^''?[\u4e00-\u9fff]*武器擅长[：:]\s*''?([^\n]+)/gm)) {
    const val = m[1].trim();
    if (!/[\u4e00-\u9fff]/.test(val)) continue;
    for (const t of extractProficiencyTokens(val)) if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
function implementGroups(text) {
  const m = text.match(/^''?法器[：:]\s*''?([^\n]+)/m);
  if (!m) return [];
  return m[1].split(/[，,、和及与]+/).map((s) => s.trim()).filter(Boolean);
}

// ---- 基础物品：从 TS 源码里取出数据数组（数组本身是纯 JS 字面量）----
const baseDataSrc = fs.readFileSync(path.join(SRC, "web/src/lib/baseitems-data.ts"), "utf8");
const baseSrc = fs.readFileSync(path.join(SRC, "web/src/lib/baseitems.ts"), "utf8");
function evalArrayAfter(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("找不到标记：" + marker);
  // 跳过类型注解里的 []（如 `BASE_WEAPONS: BaseWeapon[] = [`）
  const eq = src.indexOf("=", start);
  const open = src.indexOf("[", eq < 0 ? start : eq);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") { depth--; if (depth === 0) break; }
  }
  const literal = src.slice(open, i + 1);
  return new Function("return (" + literal + ");")();
}
const BASE_WEAPONS = evalArrayAfter(baseDataSrc, "BASE_WEAPONS");
const BASE_ARMORS = evalArrayAfter(baseDataSrc, "BASE_ARMORS");
const BASE_SHIELDS = evalArrayAfter(baseSrc, "BASE_SHIELDS");
const BASE_IMPLEMENTS = evalArrayAfter(baseSrc, "BASE_IMPLEMENTS");

// ---- 类别 / 种族 ----
const classes = readJson(path.join(SRC, "out/categories/class.json"));
const races = readJson(path.join(SRC, "out/categories/race.json"));
const equipment = readJson(path.join(SRC, "out/categories/equipment.json"));

const ABILITY_ZH = { 力量: "str", 体质: "con", 敏捷: "dex", 智力: "int", 感知: "wis", 魅力: "cha" };

const classMap = {};
for (const c of classes) {
  const s = parseClassStats(c.sourceText || "");
  classMap[c.id] = [
    s.baseHp, s.hpPerLevel, s.surges, s.fort, s.ref, s.will,
    /^!!\s*技能巧手 Skill Versatility/m.test(c.sourceText || "") ? 1 : 0,
    parseBuiltinTrainedSkills(c.sourceText || "").join("|"),
    weaponProfTokens(c.sourceText || "").join("|"),
    implementGroups(c.sourceText || "").join("|"),
  ];
}

const raceMap = {};
for (const r of races) {
  const d = parseRaceDefenses(r.sourceText || "");
  const one = ABILITY_ZH[String(r.abilityOne || "").trim()] || "";
  const two = String(r.abilityTwo || "").split("或").map((s) => ABILITY_ZH[s.trim()] || "").filter(Boolean);
  raceMap[r.id] = [
    one, two.join("|"), r.size || "", r.speed || "", r.vision || "",
    d.fort || 0, d.ref || 0, d.will || 0,
    weaponProfTokens(r.sourceText || "").join("|"),
    implementGroups(r.sourceText || "").join("|"),
  ];
}

// ---- 装备：id -> [等级列表, 增强指向]（增强指向用于防御增强加值，与 defense.ts 同口径）----
function enhanceTargetOf(text) {
  const clean = String(text || "")
    .replace(/<<[^>]*>>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, " ")
    .replace(/\s+/g, " ");
  const m = clean.match(/增强\s*[：:]\s*(.{0,20}?)(?=\s*(?:特性|威能|重击|特效|辅助威能|攻击威能|辅助|诅咒|$))/);
  return m ? m[1].trim().replace(/[。，、；;]+$/, "") : "";
}
const equipMap = {};
for (const e of equipment) {
  if (!e.id) continue;
  const lv = String(e.itemLevel || e.fields?.["item-level"] || "").trim();
  if (!lv) continue;
  const target = enhanceTargetOf(e.details || e.fields?.details || "");
  equipMap[e.id] = target ? [lv, target] : [lv];
}

// ---- 武器擅长白名单（同 web/src/sheet/proficiency.ts）----
const FEAT_PROFICIENCY = {
  "矮人武器特训": ["斧", "锤"],
  "牛头人武器才能": ["战斧", "手斧", "战锤", "飞锤"],
  "侏儒武器训练": ["简易锤", "军用锤", "简易镐", "军用镐"],
  "索离诺尔标志": ["军用锤", "军用斧", "军用镐"],
  "雅灵士兵": ["矛"],
  "收割者之镰": ["镰刀", "巨镰"],
  "月弓潜行者": ["短弓"],
  "致力月弓": ["短弓"],
  "长鞭训练": ["长鞭"],
  "塔兰塔武器特训": ["塔兰塔回旋镖", "塔兰塔长镰", "塔兰塔弯刀"],
  "图拉斯武器特训": ["寇派斯弯刀", "多头鞭", "镰刀", "巨镰", "弯刀", "弯刃大刀"],
  "瓦伦纳武器特训": ["弯刀", "双头弯刀", "弯刃大刀"],
  "瓦伦纳骑手训练": ["简易矛", "军用矛"],
  "希恩德瑞克武器特训": ["卓尔长刀", "希恩德瑞克回旋镖"],
  "螳螂人武器大师": ["双头尖矛", "三刃镖"],
  "水沫聚合战士": ["捕网"],
  "偷袭之杖": ["木棍"],
  "小刀精通": ["反曲刀", "拳匕"],
  "天国戟兵": ["长柄刀", "长戟"],
};

const pickWeapon = (w) => ({ n: w.name, p: w.prof, d: w.dice, c: w.category, g: w.group, r: w.range || "" });
const pickArmor = (a) => ({ n: a.name, ac: a.ac, c: a.category, k: a.check, s: a.speed, x: a.special || "" });

const out = {
  v: 1,
  generatedAt: new Date().toISOString(),
  source: "4E NEXT (archive/4E-NEXT-main) out/categories",
  abilityZh: ABILITY_ZH,
  classes: classMap,
  races: raceMap,
  weapons: BASE_WEAPONS.map(pickWeapon),
  armors: BASE_ARMORS.map(pickArmor),
  shields: BASE_SHIELDS.map((s) => ({ n: s.name, ac: s.ac })),
  implements: BASE_IMPLEMENTS.map((i) => ({ n: i.name, c: i.category, p: i.price, s: i.superior ? 1 : 0 })),
  equips: equipMap,
  featProf: FEAT_PROFICIENCY,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const body = "// 自动生成，请勿手改：node dev/gen-rules.mjs\n" +
  "// 数据来源：4E NEXT 导出的规则分类数据（class / race / equipment）与基础物品表\n" +
  "export const RULES = " + JSON.stringify(out) + ";\n" +
  "export default RULES;\n";
fs.writeFileSync(OUT, body, "utf8");
console.log("classes", Object.keys(classMap).length);
console.log("races", Object.keys(raceMap).length);
console.log("weapons", BASE_WEAPONS.length, "armors", BASE_ARMORS.length, "shields", BASE_SHIELDS.length, "implements", BASE_IMPLEMENTS.length);
console.log("equips", Object.keys(equipMap).length);
console.log("wrote", OUT, (fs.statSync(OUT).size / 1024).toFixed(1) + " KB");
