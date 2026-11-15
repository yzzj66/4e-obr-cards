// v1.5.0 骰子自测（无浏览器 / 无 OBR）：直接 import 纯函数模块。
// ---------------------------------------------------------------------------
// 覆盖规格 §8 的 16 条，外加用户拍板的三条（重击取满 / 战斗优势 +2 / 总和不含判定）：
//   1. parseExpr("1d20+12") 结构正确，formatExpr 幂等
//   2. adv(1d6)+adv(1d4) 是 2 个 segment（不是 1 个）
//   3. -1d4 的 count = -1，总和减掉点数
//   4. max(1d6,4) 每颗 ≥4 且保留 originalValue；loser 不参与 clamp
//   5. resetmin(1d20,2) 命中时重掷一次（注入 rand）
//   6. burst(1d6) 掷 6 追加一颗，链长 ≤5，burstParent 指向前一颗
//   7. repeat(3,1d6+2)：total = Σ3 + 2×3，每行各自 +2
//   8. computeTotal 三处一致（投掷端 / 广播端 / normalizeRoll 重算）
//   9. normalizeRoll 旧形状 rolls:[3,19] → 2 颗 d20；无 rollId → 丢弃
//  10. normalizeRoll 把 {type:"d600", value:601} 夹到 600（不是 20）
//  11. 4E 预设用 glance 的 total；dice-4e.js 里没有 "10 + half"
//  12. 没有命中判定：载荷里没有 target / hit，normalizeRoll 会把它们丢掉
//  13. 房间数据合并：重复 rollId 幂等、按 ts 倒序、封顶 40
//  14. 40 条样例 JSON < 12000 字符（16 KB 的 75%）
//  15. 频道常量 common.js ↔ background.core.js 逐字一致
//  16. 窗口 760×620 在 1366×768 下仍 ≤ 视口 − 2×16
//   + 重击：2d6+3 全取 6，total = 15；带 adv 包裹时退化为普通投掷并提示
//   + 战斗优势：+2 / −2 可逆，且直接进 modifier
//   + 总和不含判定：total 只由骰子 + 加值决定
// 用法：node dev/test-dice.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------------------
 * 把纯函数模块复制到临时目录（assets/*.js 没有 package.json，node 会当 CJS 解析）
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-dice-test");
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
fs.copyFileSync(path.join(ROOT, "data", "rules.js"), path.join(tmp, "data", "rules.js"));
for (const f of ["dice-core.js", "dice-4e.js", "glance.js"]) {
  fs.copyFileSync(path.join(ROOT, "assets", f), path.join(tmp, "assets", f));
}

const D = await import(pathToFileURL(path.join(tmp, "assets", "dice-core.js")).href);
const P = await import(pathToFileURL(path.join(tmp, "assets", "dice-4e.js")).href);
const G = await import(pathToFileURL(path.join(tmp, "assets", "glance.js")).href);

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-card.json"), "utf8"));
const CHAR = sample.pages && sample.pages.character ? sample.pages.character : sample.character;

/* ---------------------------------------------------------------------------
 * 1. 解析 / 规范化
 * ------------------------------------------------------------------------- */
console.log("== 1 表达式解析");
const p1 = D.parseExpr("1d20+12");
if (p1.segments.length === 0 && eq(p1.outerPlain.groups, [{ type: "d20", count: 1 }]) && p1.outerPlain.modifier === 12)
  ok("parseExpr(\"1d20+12\") → outerPlain = 1d20，modifier = 12");
else bad("parseExpr(\"1d20+12\") 结构不对：" + JSON.stringify(p1));
if (D.formatExpr(p1) === "1d20 + 12") ok("formatExpr → \"1d20 + 12\"");
else bad("formatExpr 输出不对：" + D.formatExpr(p1));

const p2 = D.parseExpr("2d6+1d20+5");
const f2 = D.formatExpr(p2);
if (f2 === "2d6 + 1d20 + 5") ok("formatExpr(2d6+1d20+5) = \"2d6 + 1d20 + 5\"");
else bad("formatExpr 输出不对：" + f2);
if (D.formatExpr(D.parseExpr(f2)) === f2) ok("formatExpr 幂等（再解析一次还是同一串）");
else bad("formatExpr 不幂等：" + D.formatExpr(D.parseExpr(f2)));

const p3 = D.parseExpr("adv(1d6)+adv(1d4)");
if (p3.segments.length === 2 && p3.segments[0].wrappers.length === 1 && p3.segments[1].wrappers.length === 1)
  ok("adv(1d6)+adv(1d4) → 2 个独立 segment（各自掷两次，不是一起掷）");
else bad("adv(1d6)+adv(1d4) 解析成 " + p3.segments.length + " 个 segment");
const p4 = D.parseExpr("adv(1d6)+adv(1d4)-2");
if (p4.segments.length === 2 && p4.outerPlain.modifier === -2)
  ok("adv(1d6)+adv(1d4)-2：括号内 + 不切分，末尾 -2 落在 outerPlain.modifier");
else bad("-2 没有落在 outerPlain：" + JSON.stringify(p4.outerPlain));
const p5 = D.parseExpr("max(1d6+2,3)");
if (p5.segments.length === 1 && p5.segments[0].wrappers[0].kind === "max" && p5.segments[0].wrappers[0].param === 3 &&
  eq(p5.segments[0].plain.groups, [{ type: "d6", count: 1 }]) && p5.segments[0].plain.modifier === 2)
  ok("max(1d6+2,3)：X 取最后一个顶层逗号后的 3，inner = 1d6+2");
else bad("max(1d6+2,3) 解析不对：" + JSON.stringify(p5.segments));
const p6 = D.parseExpr("repeat(3,1d6+2)");
if (p6.segments.length === 1 && p6.segments[0].wrappers[0].kind === "repeat" && p6.segments[0].wrappers[0].param === 3)
  ok("repeat(3,1d6+2)：N 取第一个顶层逗号前的 3");
else bad("repeat(3,1d6+2) 解析不对：" + JSON.stringify(p6.segments));
if (D.parsedIsEmpty(D.parseExpr("")) && D.parsedIsEmpty(D.parseExpr("   ")) && !D.parsedIsEmpty(D.parseExpr("+3")))
  ok("parsedIsEmpty：空 / 空白算空，纯加值不算空（照样能掷）");
else bad("parsedIsEmpty 判断不对");

/* ---------------------------------------------------------------------------
 * 2. 掷骰：负数骰 / max / resetmin / burst / repeat
 * ------------------------------------------------------------------------- */
console.log("== 2 掷骰");
const neg = D.parseExpr("-1d4");
if (neg.outerPlain.groups[0].count === -1) ok("-1d4 的 count = -1（减骰）");
else bad("-1d4 的 count 不是 -1：" + JSON.stringify(neg.outerPlain.groups));
const negRoll = D.rollParsed(neg, { rand: () => 0 });
if (negRoll.total === -1 && negRoll.dice[0].subtract === true) ok("-1d4 掷出 1 → 总和 -1（不是 +1）");
else bad("-1d4 的总和不对：" + JSON.stringify(negRoll));

const maxRoll = D.rollParsed(D.parseExpr("max(1d6,4)"), { rand: () => 0 });
if (maxRoll.dice.length === 1 && maxRoll.dice[0].value === 4 && maxRoll.dice[0].originalValue === 1)
  ok("max(1d6,4)：掷出 1 → 抬到 4，originalValue 保留 1");
else bad("max(1d6,4) 结果不对：" + JSON.stringify(maxRoll.dice));
const manyMax = D.rollParsed(D.parseExpr("3d6"), { rand: () => 0.1 }); // 每颗 1
const clamped = manyMax.dice.map((d) => D.applyValueClamp(d, "max", 4, () => 0));
if (clamped.every((d) => d.value >= 4 && d.originalValue === 1)) ok("applyValueClamp(max) 每颗都 ≥4 且保留原值");
else bad("applyValueClamp(max) 不对：" + JSON.stringify(clamped));
const loserDie = { type: "d6", value: 1, loser: true };
const loserAfter = D.applyValueClamp(loserDie, "max", 4, () => 0);
if (loserAfter.value === 1 && loserAfter.originalValue === undefined) ok("loser 骰不参与 clamp（保持被丢弃时的原样）");
else bad("loser 骰被 clamp 了：" + JSON.stringify(loserAfter));

let seq = [0, 0.95];
const resetRoll = D.rollParsed(D.parseExpr("resetmin(1d20,2)"), { rand: () => (seq.length ? seq.shift() : 0.5) });
if (resetRoll.dice.length === 1 && resetRoll.dice[0].value === 20 && resetRoll.dice[0].originalValue === 1)
  ok("resetmin(1d20,2)：掷出 1（≤2）→ 重掷一次得到 20，originalValue 1");
else bad("resetmin 没有重掷一次：" + JSON.stringify(resetRoll.dice));

const burstRoll = D.rollParsed(D.parseExpr("burst(1d6)"), { rand: () => 0.999999 });
const chainOk = burstRoll.dice.length === 6 &&
  burstRoll.dice.slice(1).every((d, i) => d.burstParent === i && d.value === 6);
if (chainOk) ok("burst(1d6)：掷 6 连炸 5 次（共 6 颗），burstParent 依次指向前一颗");
else bad("burst 链不对：" + JSON.stringify(burstRoll.dice));

const rep = D.rollParsed(D.parseExpr("repeat(3,1d6+2)"), { rand: () => 0 });
const repTotals = D.rowTotals(rep.dice, rep.rowStarts, rep.modifier);
if (rep.rowCount === 3 && eq(rep.rowStarts, [0, 1, 2]) && rep.total === 9 && eq(repTotals, [3, 3, 3]))
  ok("repeat(3,1d6+2)：三行各 3，total = 3+3+3 = 9（每行都 +2）");
else bad("repeat 总和不对：" + JSON.stringify({ total: rep.total, rows: repTotals, starts: rep.rowStarts }));

/* ---------------------------------------------------------------------------
 * 3. 重击（4E：伤害骰取满）
 * ------------------------------------------------------------------------- */
console.log("== 3 重击 = 4E 伤害骰取满");
const critRoll = D.rollParsed(D.parseExpr("2d6+3"), { crit: true, rand: () => 0.5 });
if (critRoll.crit && critRoll.dice.every((d) => d.value === 6) && critRoll.total === 15)
  ok("重击：2d6+3 → 两颗都取 6，total = 12+3 = 15");
else bad("重击没有取满：" + JSON.stringify(critRoll));
const critDeg = D.rollParsed(D.parseExpr("adv(1d6)+2"), { crit: true, rand: () => 0 });
if (critDeg.crit === false && critDeg.critDegraded === true && critDeg.note === D.ROLL_CRIT_NOTE)
  ok("重击遇到 adv 包裹 → 退化为普通投掷，critDegraded + 提示文案");
else bad("包裹表达式没有退化：" + JSON.stringify(critDeg));
const critPlain = D.rollParsed(D.parseExpr("1d8+1d10"), { crit: true, rand: () => 0 });
if (critPlain.dice.map((d) => d.value).join(",") === "8,10" && critPlain.total === 18)
  ok("重击多类型：d8→8、d10→10（不是骰数翻倍）");
else bad("重击多类型不对：" + JSON.stringify(critPlain.dice));

/* ---------------------------------------------------------------------------
 * 4. 战斗优势 +2
 * ------------------------------------------------------------------------- */
console.log("== 4 战斗优势 +2");
const advBase = D.parseExpr("1d20+5");
const advPlus = D.adjustExprModifier(advBase, 2);
const advBack = D.adjustExprModifier(advPlus, -2);
if (D.formatExpr(advPlus) === "1d20 + 7" && D.formatExpr(advBack) === "1d20 + 5")
  ok("战斗优势 = adjustExprModifier(+2)：1d20+5 → 1d20+7，再点回到 1d20+5");
else bad("战斗优势 +2 不可逆：" + D.formatExpr(advPlus) + " / " + D.formatExpr(advBack));
const advRoll = D.rollParsed(advPlus, { rand: () => 0 });
if (advRoll.total === 8 && advRoll.modifier === 7) ok("战斗优势直接进 modifier：掷 1 + 7 = 8");
else bad("战斗优势没有进 modifier：" + JSON.stringify(advRoll));

/* ---------------------------------------------------------------------------
 * 5. 骰子按钮 +1 / −1（编辑器）
 * ------------------------------------------------------------------------- */
console.log("== 5 骰子按钮");
let ed = D.adjustExprForType(D.parseExpr(""), "d20", 1);
ed = D.adjustExprForType(ed, "d20", 1);
if (D.formatExpr(ed) === "2d20" && D.countDiceByType(ed).d20 === 2) ok("点两次 d20 → 2d20，角标 2");
else bad("点两次 d20 不对：" + D.formatExpr(ed));
let negEd = D.adjustExprForType(D.parseExpr(""), "d4", -1);
if (D.formatExpr(negEd) === "-1d4" && D.countDiceByType(negEd).d4 === -1) ok("右键 d4（无条目时）→ -1d4（负 count 的减骰）");
else bad("右键 d4 不对：" + D.formatExpr(negEd));
let zeroEd = D.adjustExprForType(D.parseExpr("1d6"), "d6", -1);
if (D.formatExpr(zeroEd) === "") ok("1d6 再点右键 −1 → count 归 0，条目被删掉");
else bad("count 归 0 没有删条目：" + D.formatExpr(zeroEd));

/* ---------------------------------------------------------------------------
 * 6. 载荷归一化 / 去重 / 合并
 * ------------------------------------------------------------------------- */
console.log("== 6 载荷与历史");
const oldShape = D.normalizeRoll({ rollId: "r-old", rolls: [3, 19], modifier: 2, ts: 1000 });
if (oldShape && oldShape.dice.length === 2 && oldShape.dice[0].type === "d20" && oldShape.dice[1].value === 19 &&
  oldShape.total === 24) ok("normalizeRoll({rolls:[3,19]}) → 2 颗 d20，total = 3+19+2");
else bad("旧形状兼容不对：" + JSON.stringify(oldShape));
if (D.normalizeRoll({ rolls: [3, 19] }) === null) ok("没有 rollId → 直接丢弃");
else bad("没有 rollId 的记录没有被丢弃");
const d600 = D.normalizeRoll({ rollId: "r-600", dice: [{ type: "d600", value: 601 }] });
if (d600 && d600.dice[0].value === 600 && d600.dice[0].type === "d600")
  ok("d600 的 601 被夹到 600（用 sidesOf，不是查表夹到 20）");
else bad("d600 夹取不对：" + JSON.stringify(d600));

const payload = D.rollToPayload({ parsed: D.parseExpr("2d6+5"), rand: () => 0, rollerName: "申比软软" });
const recomputed = D.normalizeRoll(payload);
if (payload && recomputed && payload.total === 1 + 1 + 5 && recomputed.total === payload.total)
  ok("computeTotal 三端一致：投掷端 / 载荷 / normalizeRoll 重算都是 " + payload.total);
else bad("总和三端不一致：" + JSON.stringify({ a: payload && payload.total, b: recomputed && recomputed.total }));

/* 12. 没有命中判定 */
const pjson = JSON.stringify(D.rollToPayload({ parsed: D.parseExpr("1d20+12"), rand: () => 0 }));
if (pjson.indexOf('"hit"') < 0 && pjson.indexOf('"target"') < 0) ok("载荷里没有 hit / target（不做命中判定）");
else bad("载荷里混进了 hit / target：" + pjson);
const withTn = D.normalizeRoll({ rollId: "r-tn", dice: [{ type: "d20", value: 14 }], target: 28, hit: false, modifier: 12 });
if (withTn && !("target" in withTn) && !("hit" in withTn) && withTn.total === 26)
  ok("就算别处塞了 target / hit，normalizeRoll 也会丢掉（total 只算骰子 + 加值）");
else bad("target / hit 没有被丢掉：" + JSON.stringify(withTn));

/* 13. 合并 */
const baseRows = [];
for (let i = 0; i < 3; i++) {
  baseRows.push({ rollId: "r" + i, ts: 1000 + i, dice: [{ type: "d20", value: 10 + i }], total: 10 + i });
}
const merged = D.mergeRollRows(baseRows, { rollId: "r1", ts: 1001, dice: [{ type: "d20", value: 20 }] });
if (merged.length === 3 && merged.filter((r) => r.rollId === "r1").length === 1)
  ok("同一 rollId 重复投递 → 幂等（不重复插）");
else bad("合并不幂等：" + JSON.stringify(merged.map((r) => r.rollId)));
const many = [];
for (let i = 0; i < 60; i++) {
  many.push({ rollId: "m" + i, ts: 1000 + i, rollerName: "甲", expression: "1d20", dice: [{ type: "d20", value: 10 }], modifier: 0, total: 10 });
}
const capped = D.mergeRollRows(many, { rollId: "new", ts: 9999, dice: [{ type: "d20", value: 1 }] });
if (capped.length === 40 && capped[0].rollId === "new") ok("合并后封顶 40 条，且最新的排最前");
else bad("封顶 / 排序不对：" + capped.length + " 首条 " + capped[0].rollId);
const unsorted = D.mergeRollRows([{ rollId: "a", ts: 10 }, { rollId: "b", ts: 30 }], { rollId: "c", ts: 20 });
if (unsorted.map((r) => r.rollId).join(",") === "b,c,a") ok("按 ts 倒序排列");
else bad("没有按 ts 倒序：" + unsorted.map((r) => r.rollId).join(","));

/* 14. 容量 */
const sampleRows = [];
for (let i = 0; i < 40; i++) {
  const one = D.rollToPayload({
    parsed: D.parseExpr("2d6+1d8+9"), rand: () => 0.5,
    rollId: "size-" + i, ts: Date.now() + i, rollerName: "申比软软",
    label: "攻击 · 长剑 vs AC", mode: "attack"
  });
  sampleRows.push(one);
}
const bytes = JSON.stringify(sampleRows).length;
if (bytes < 12000) ok("40 条最坏样例 " + bytes + " 字符 < 12000（16 KB 的 75%）");
else bad("40 条样例太大：" + bytes + " 字符");

/* ---------------------------------------------------------------------------
 * 7. 4E 预设
 * ------------------------------------------------------------------------- */
console.log("== 7 4E 预设");
const presets = P.presetsFor(CHAR);
const g = G.deriveGlance(CHAR);
const keys = presets.groups.map((x) => x.key).join(",");
if (presets.ok && keys === "attack,damage,save,skill,init") ok("presetsFor → 攻击 / 伤害 / 豁免 / 技能 / 先攻 五组");
else bad("预设分组不对：" + keys);
if (presets.defenses.length === 4 && presets.defenses.map((d) => d.key).join(",") === "ac,fort,ref,will")
  ok("防御参考 = AC / 强韧 / 反射 / 意志（只显示数值，不判定）");
else bad("防御参考不对：" + JSON.stringify(presets.defenses));
const atkItem = presets.groups[0].items[0];
if (atkItem && atkItem.expr === P.withModifier("1d20", g.attacks[0].total))
  ok("攻击预设 = 1d20 + glance.attacks[0].total（" + g.attacks[0].total + "）");
else bad("攻击预设没有用 glance 的 total：" + JSON.stringify(atkItem) + " vs " + (g.attacks && g.attacks[0] && g.attacks[0].total));
const dmgItem = presets.groups[1].items[0];
if (dmgItem && dmgItem.expr === P.withModifier(g.damages[0].dice || "1d8", g.damages[0].total))
  ok("伤害预设 = 武器骰 + glance.damages[0].total（" + g.damages[0].total + "）");
else bad("伤害预设不对：" + JSON.stringify(dmgItem));
const saveItem = presets.groups[2].items[0];
if (saveItem && saveItem.expr === "1d20" && presets.groups[2].items.length === 1)
  ok("豁免预设只有 1d20（4E 标准 ≥10，本插件不判定成败）");
else bad("豁免预设不对：" + JSON.stringify(saveItem));
const skillItems = presets.groups[3].items;
const skillHit = skillItems.filter((s) => s.name === "侦查")[0];
const glanceSkill = (g.skills || []).filter((s) => s.name === "侦查")[0];
if (skillHit && glanceSkill && skillHit.expr === P.withModifier("1d20", glanceSkill.total))
  ok("技能预设 = 1d20 + glance.skills[].total（侦查 " + glanceSkill.total + "，共 " + skillItems.length + " 项）");
else bad("技能预设不对");
const initItem = presets.groups[4].items[0];
if (initItem && initItem.expr === P.withModifier("1d20", G.initiativeBonus(CHAR)))
  ok("先攻预设 = 1d20 + initiativeBonus（" + G.initiativeBonus(CHAR) + "）");
else bad("先攻预设不对：" + JSON.stringify(initItem));
const dice4eSrc = fs.readFileSync(path.join(ROOT, "assets", "dice-4e.js"), "utf8");
if (dice4eSrc.indexOf("10 + half") < 0 && dice4eSrc.indexOf("half + mods") < 0)
  ok("dice-4e.js 里没有重算公式（不含 \"10 + half\"）");
else bad("dice-4e.js 里出现了自己重算的公式");

/* ---------------------------------------------------------------------------
 * 8. 常量 / 窗口 / 不依赖 OBR
 * ------------------------------------------------------------------------- */
console.log("== 8 常量与窗口");
const commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
const coreSrc = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
const chan = (src, kw, name) => {
  const m = new RegExp(kw + " " + name + ' = NS \\+ "([^"]+)";').exec(src);
  return m ? m[1] : "";
};
let chanBad = 0;
for (const name of ["CH_ROLL", "CH_ROLL_CLEAR", "CH_ROLL_SAVED", "KEY_ROLLS"]) {
  const a = chan(coreSrc, "var", name);
  const b = chan(commonSrc, "export const", name);
  if (!a || a !== b) { chanBad++; bad("频道不一致：" + name + " core=" + a + " common=" + b); }
}
if (!chanBad) ok("CH_ROLL / CH_ROLL_CLEAR / CH_ROLL_SAVED / KEY_ROLLS 两端逐字一致");
const rowsCore = (/(?:var|export const) ROLL_MAX_ROWS = (\d+);/.exec(coreSrc) || [])[1] || "";
const rowsCommon = (/(?:var|export const) ROLL_MAX_ROWS = (\d+);/.exec(commonSrc) || [])[1] || "";
if (rowsCore === "40" && rowsCommon === "40" && D.ROLL_MAX_ROWS === 40)
  ok("ROLL_MAX_ROWS 三处都是 40（dice-core / common / background.core）");
else bad("ROLL_MAX_ROWS 不一致：" + D.ROLL_MAX_ROWS + " / " + rowsCommon + " / " + rowsCore);
if (coreSrc.indexOf("function rollNorm(") >= 0 && coreSrc.indexOf("function rollMerge(") >= 0 &&
  coreSrc.indexOf("broadcast.onMessage(CH_ROLL,") >= 0)
  ok("后台有骰子落库（rollNorm / rollMerge / 订阅 CH_ROLL）");
else bad("后台缺少骰子落库");
const diceCoreSrc = fs.readFileSync(path.join(ROOT, "assets", "dice-core.js"), "utf8");
if (diceCoreSrc.indexOf("obr-sdk") < 0 && diceCoreSrc.indexOf("./common.js") < 0)
  ok("dice-core.js 不依赖 OBR / common（本文件能直接 import 就是证明）");
else bad("dice-core.js 依赖了 OBR");

const winMatch = /dice: \{ id: ID_DICE_WIN, url: URL_DICE, width: (\d+), height: (\d+) \}/.exec(coreSrc);
const vp = { width: 1366, height: 768 };
const margin = 16;
if (winMatch) {
  const w = Math.min(+winMatch[1], vp.width - margin * 2);
  const h = Math.min(+winMatch[2], vp.height - margin * 2);
  if (w === 760 && h === 620 && w <= 1334 && h <= 736)
    ok("骰子窗口 760×620，在 1366×768 下 = " + w + "×" + h + "（≤ 视口 − 2×16）");
  else bad("窗口尺寸不对：" + w + "×" + h);
} else bad("WINS.dice 没找到（骰子窗口尺寸读不到）");

/* ---------------------------------------------------------------------------
 * 9. 假 OBR 冒烟：dice.html 的脚本能初始化、能掷一次并广播（不启动浏览器）
 * ------------------------------------------------------------------------- */
console.log("== 9 假 OBR 冒烟（窗口初始化 + 投掷）");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const htmlSrc = fs.readFileSync(path.join(ROOT, "dice.html"), "utf8");
const htmlIds = [];
{
  const re = /id="([^"]+)"/g;
  let m;
  while ((m = re.exec(htmlSrc))) htmlIds.push(m[1]);
}
function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    toggle: (c, on) => {
      if (on === undefined) { if (set.has(c)) set.delete(c); else set.add(c); }
      else if (on) set.add(c);
      else set.delete(c);
    },
    contains: (c) => set.has(c)
  };
}
function makeEl(id) {
  const el = {
    id: id, tagName: "DIV", className: "", innerHTML: "", textContent: "", hidden: false,
    disabled: false, value: "", title: "", offsetWidth: 10, dataset: {}, listeners: {},
    classList: makeClassList(), attrs: {},
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return el.attrs[k] === undefined ? null : el.attrs[k]; },
    querySelector(sel) { return sel === ".badge" ? makeEl(id + "-badge") : null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    appendChild() {},
    hasPointerCapture() { return false; },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  return el;
}
const diceButtons = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"].map((t) => {
  const b = makeEl("die-" + t);
  b.setAttribute("data-die", t);
  b.attrs["data-die"] = t;
  return b;
});
const domMap = {};
for (const id of htmlIds) domMap[id] = makeEl(id);
domMap.diceRow.querySelectorAll = (sel) => (sel === "[data-die]" ? diceButtons : []);

const sentRolls = [];
const sentClears = [];
const readyCbs = [];
const fakeRoom = {};
const fakeOBR = {
  isAvailable: true,
  isReady: true,
  onReady(cb) { readyCbs.push(cb); },
  notification: { show() { return Promise.resolve("n"); }, close() {} },
  player: {
    getId: async () => "user-p1",
    getName: async () => "申比软软",
    getColor: async () => "#7fe07f",
    getRole: async () => "GM",
    getSelection: async () => [],
    onChange() { return () => {}; }
  },
  party: {},
  scene: {
    isReady: async () => true,
    onReadyChange() { return () => {}; },
    items: { getItems: async () => [], onChange() { return () => {}; }, updateItems: async () => {} },
    grid: { getDpi: async () => 150, onChange() { return () => {}; } },
    local: { addItems: async () => {}, updateItems: async () => {}, deleteItems: async () => {}, onChange() { return () => {}; } }
  },
  room: {
    getMetadata: async () => fakeRoom,
    setMetadata: async () => {},
    onMetadataChange() { return () => {}; }
  },
  broadcast: {
    sendMessage(channel, data) {
      const ch = String(channel);
      if (ch.slice(-5) === "/roll") sentRolls.push(data);
      else if (ch.slice(-11) === "/roll-clear") sentClears.push(data);
      return Promise.resolve();
    },
    onMessage() { return () => {}; }
  },
  popover: { open: async () => {}, close: async () => {} },
  viewport: { getWidth: async () => 1200, getHeight: async () => 800, onChange() { return () => {}; } },
  tool: { create: async () => {}, remove: async () => {} },
  modal: { open: async () => {}, close: async () => {} },
  action: { open: async () => {}, close: async () => {} }
};

globalThis.__OBR__ = fakeOBR;
globalThis.location = { href: "https://example.test/dice.html", protocol: "https:" };
globalThis.document = {
  getElementById: (id) => domMap[id] || makeEl(id),
  querySelectorAll: () => [],
  addEventListener() {},
  createElement: () => makeEl("tmp"),
  body: makeEl("body")
};
globalThis.window = { addEventListener() {} };
const lsStore = {};
globalThis.localStorage = {
  getItem: (k) => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; }
};

fs.mkdirSync(path.join(tmp, "vendor"), { recursive: true });
fs.writeFileSync(path.join(tmp, "vendor", "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
for (const name of ["common.js", "window.js", "dice-page.js"]) {
  let src = fs.readFileSync(path.join(ROOT, "assets", name), "utf8");
  src = src.replace('from "../vendor/obr-sdk.js"', 'from "../vendor/obr-stub.mjs"');
  fs.writeFileSync(path.join(tmp, "assets", name), src, "utf8");
}

let pageErr = null;
try {
  await import(pathToFileURL(path.join(tmp, "assets", "dice-page.js")).href);
} catch (e) {
  pageErr = e;
}
if (pageErr) bad("dice-page.js 初始化就抛错：" + (pageErr && pageErr.message ? pageErr.message : pageErr));
else ok("dice-page.js 能在假 OBR + 假 DOM 下加载（没有初始化异常）");

if (!readyCbs.length) bad("dice-page.js 没有把初始化交给 OBR.onReady / onReady()");
else {
  let initErr = null;
  /* 两个 onReady 回调：第一个来自 window.js（后台在线检测），第二个是页面自己的初始化 */
  for (const cb of readyCbs) {
    try { cb(); } catch (e) { initErr = e; }
  }
  await sleep(60);
  if (initErr) bad("初始化回调抛错：" + (initErr && initErr.message ? initErr.message : initErr));
  else ok("窗口初始化完成（骰子按钮 / 表达式 / 预设 / 历史都挂上了）");
  if (domMap.exprInput.value === "1d20") ok("默认表达式是 1d20（没存过上次公式时）");
  else bad("默认表达式不对：" + domMap.exprInput.value);
  const badge = diceButtons.filter((b) => b.getAttribute("data-count") === "1");
  if (badge.length === 1 && badge[0].getAttribute("data-die") === "d20") ok("角标：d20 显示 1（其余 0）");
  else bad("角标没有按表达式刷新");

  domMap.exprInput.value = "2d6 + 3";
  const clicks = domMap.btnRoll.listeners.click || [];
  if (!clicks.length) bad("「投掷」按钮没有绑定 click");
  else {
    try {
      clicks[0]({ preventDefault() {} });
      await sleep(80);
      const sent = sentRolls[0] || null;
      if (sent && sent.dice.length === 2 && sent.dice.every((d) => d.type === "d6") && sent.modifier === 3 &&
        sent.expression === "2d6 + 3" && sent.total >= 5 && !("hit" in sent) && !("target" in sent)) {
        ok("点「投掷」→ 2 颗 d6 + 3，广播 CH_ROLL（expression 规范化成 \"2d6 + 3\"，没有 hit / target）");
      } else bad("投掷广播不对：" + JSON.stringify(sent));
      if (domMap.result.innerHTML.indexOf("res-total") >= 0) ok("结果面板画出了总点数");
      else bad("结果面板没有渲染");
      if (domMap.list.innerHTML.indexOf("hist-row") >= 0) ok("右栏历史插入了本次投掷（乐观显示）");
      else bad("右栏历史没有更新");
    } catch (e2) {
      bad("投掷流程抛错：" + (e2 && e2.message ? e2.message : e2));
    }
  }

  // 战斗优势：点一下按钮 → 表达式 +2（再点撤回）
  const advClicks = domMap.btnAdvantage.listeners.click || [];
  if (!advClicks.length) bad("「战斗优势 +2」按钮没有绑定 click");
  else {
    domMap.exprInput.value = "1d20 + 5";
    advClicks[0]({ preventDefault() {} });
    const after = domMap.exprInput.value;
    advClicks[0]({ preventDefault() {} });
    if (after === "1d20 + 7" && domMap.exprInput.value === "1d20 + 5") ok("「战斗优势 +2」：1d20+5 → 1d20+7 → 再点回 1d20+5");
    else bad("战斗优势按钮不对：" + after + " / " + domMap.exprInput.value);
  }
}

// 顺带确认「不启动浏览器」：本测试只用纯函数 + 假 OBR + 假 DOM，没有任何 GUI
console.log("\n  info 未启动浏览器（沙箱环境禁止），以上全部为纯函数 / 假 OBR / 假 DOM 断言");

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
