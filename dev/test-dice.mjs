// v1.5.0 骰子自测（无浏览器 / 无 OBR）：直接 import 纯函数模块。
// v1.7.0 扩充：独立记录窗口的「41 条 → 40 且删最旧」、动画布局 / 时间轴常量（fxBaseSize / fxBeat / fxLayout / fxQuery）、
//   以及「动画关掉时投掷**不调用** OBR.modal.open、开着时参数是 fullScreen + hideBackdrop + hidePaper +
//   disablePointerEvents」；4E 预设只剩攻击 / 伤害 / 技能（豁免、先攻已删）。
// v1.7.1 扩充：动画页**完全透明**之外，关闭有三条路 —— 播完 2600 ms 自己 OBR.modal.close、
//   3000 ms 兜底（FX_CLOSE_FALLBACK_MS）也会 close、按 ESC / 点击任意处立即 close；
//   且 finish 幂等（不会重复 close）。
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
//  16. 骰子窗口 320×620（v1.7.4）在 1366×768 下仍 ≤ 视口 − 2×16
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
/* v1.7.15：页面模块都 import common.js，而 common.js 现在还要 cards-core.js（房间数据预算）。 */
for (const f of ["cards-core.js", "dice-core.js", "dice-4e.js", "glance.js", "dice-fx.js"]) {
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

/* ---- v1.8.0：重击只对**伤害骰**取满；d20（攻击 / 豁免）与减法骰保持真实掷值 ---- */
console.log("== 3b 重击只取满伤害骰（v1.8.0）");
const critMix = D.rollParsed(D.parseExpr("1d20+2d6"), { crit: true, rand: () => 0.5 });
const critD20 = critMix.dice.filter((d) => d.type === "d20")[0];
const critDmg = critMix.dice.filter((d) => d.type === "d6");
if (critD20 && critD20.value === 11 && critDmg.length === 2 && critDmg.every((d) => d.value === 6) && critMix.total === 23)
  ok("重击 1d20+2d6：d20 保持真实掷值 11（不是 20）、2d6 都取 6、total = 23");
else bad("重击把 d20 也取满了 / 伤害骰不对：" + JSON.stringify(critMix.dice));
const critSub = D.rollParsed(D.parseExpr("-1d6+2d8"), { crit: true, rand: () => 0.5 });
const critSubDie = critSub.dice.filter((d) => d.subtract)[0];
const critPos = critSub.dice.filter((d) => !d.subtract);
if (critSubDie && critSubDie.value === 4 && critSubDie.subtract === true &&
  critPos.length === 2 && critPos.every((d) => d.value === 8) && critSub.total === 12)
  ok("重击 -1d6+2d8：减法骰保持真实值 4（不取满）、正伤害骰 8/8、total = 8+8-4 = 12");
else bad("重击把减法骰也取满了 / 总和不对：" + JSON.stringify(critSub));
const critNegOnly = D.rollParsed(D.parseExpr("-1d6"), { crit: true, rand: () => 0.5 });
if (critNegOnly.dice.length === 1 && critNegOnly.dice[0].value === 4 && critNegOnly.dice[0].subtract === true &&
  critNegOnly.total === -4 && critNegOnly.crit === false)
  ok("重击 -1d6：没有正伤害骰可取满 → 仍为真实的 -4，不谎报 crit");
else bad("重击纯减法骰不对：" + JSON.stringify(critNegOnly));
const critOnlyD20 = D.rollParsed(D.parseExpr("1d20"), { crit: true, rand: () => 0.5 });
if (critOnlyD20.crit === false && critOnlyD20.critRequested === true &&
  critOnlyD20.dice[0].value === 11 && critOnlyD20.critDegraded === false)
  ok("重击纯 d20（攻击 / 豁免）：d20 真实值 11，没有可取的伤害骰 → crit=false（不谎报「已取满」）");
else bad("纯 d20 重击的 crit 语义不对：" + JSON.stringify(critOnlyD20));

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
if (capped.length === 61 && capped[0].rollId === "new") ok("合并后封顶 100 条（v2.5.0：对齐 FS 100），且最新的排最前");
else bad("封顶 / 排序不对：" + capped.length + " 首条 " + capped[0].rollId);
const unsorted = D.mergeRollRows([{ rollId: "a", ts: 10 }, { rollId: "b", ts: 30 }], { rollId: "c", ts: 20 });
if (unsorted.map((r) => r.rollId).join(",") === "b,c,a") ok("按 ts 倒序排列");
else bad("没有按 ts 倒序：" + unsorted.map((r) => r.rollId).join(","));

/* 14. 容量 */
const sampleRows = [];
for (let i = 0; i < 20; i++) {
  const one = D.rollToPayload({
    parsed: D.parseExpr("2d6+1d8+9"), rand: () => 0.5,
    rollId: "size-" + i, ts: Date.now() + i, rollerName: "申比软软",
    label: "攻击 · 长剑 vs AC", mode: "attack"
  });
  sampleRows.push(one);
}
const bytes = JSON.stringify(sampleRows).length;
if (bytes < 6000) ok("20 条最坏样例 " + bytes + " 字符 < 6000（16 KB 的 37%，给角色卡 + 先攻留余量）");
else bad("20 条样例太大：" + bytes + " 字符");

/* ---------------------------------------------------------------------------
 * 7. 4E 预设
 * ------------------------------------------------------------------------- */
console.log("== 7 4E 预设");
const presets = P.presetsFor(CHAR);
const g = G.deriveGlance(CHAR);
const keys = presets.groups.map((x) => x.key).join(",");
if (presets.ok && keys === "attack,damage,skill") ok("presetsFor → 攻击 / 伤害 / 技能 三组（v1.7.0 删掉豁免 / 先攻）");
else bad("预设分组不对（该是 attack,damage,skill）：" + keys);
{
  const src4e = fs.readFileSync(path.join(ROOT, "assets", "dice-4e.js"), "utf8");
  const code4e = src4e.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  if (code4e.indexOf("豁免") < 0 && code4e.indexOf("先攻") < 0 && code4e.indexOf('key: "save"') < 0 &&
    code4e.indexOf('key: "init"') < 0 && code4e.indexOf("initiativeBonus") < 0)
    ok("dice-4e.js 里没有豁免 / 先攻预设（代码里连字样都没了）");
  else bad("dice-4e.js 里还留着豁免 / 先攻预设");
}
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
/* v2.5.0：loadState 返回 {state, scope} —— tempsFromLoaded 必须剥一层，否则联动恒为 0 */
{
  const loaded = { state: { atkTemp: 2, dmgTemp: 3 }, scope: "room" };
  const temps = P.tempsFromLoaded(loaded);
  const ps = P.presetsFor(CHAR, undefined, temps);
  const a = ps.groups[0].items[0];
  const dd = ps.groups[1].items[0];
  if (temps.atkTemp === 2 && temps.dmgTemp === 3 &&
    a.label.indexOf("（临时 +2）") >= 0 && a.expr === P.withModifier("1d20", g.attacks[0].total + 2) &&
    dd.label.indexOf("（临时 +3）") >= 0) {
    ok("v2.5.0：tempsFromLoaded({state:{atkTemp:2,dmgTemp:3}}) → 攻击「临时 +2」、伤害「临时 +3」，数值同步 +2/+3");
  } else bad("v2.5.0：tempsFromLoaded 没有正确剥离 state：" + JSON.stringify({ temps, a, dd }));
  const wrongShape = P.tempsFromLoaded({ atkTemp: 2, dmgTemp: 3 });
  if (wrongShape.atkTemp === 0 && wrongShape.dmgTemp === 0)
    ok("v2.5.0：未包 state 的旧错误形状 = 0（防止再直接读 loadState 返回值）");
  else bad("v2.5.0：tempsFromLoaded 把未包 state 的对象也当状态了：" + JSON.stringify(wrongShape));
}


{
  const g2 = g;
  const plus = P.presetsFor(CHAR, undefined, { atkTemp: 2, dmgTemp: 3 });
  const pAtk = plus.groups[0].items[0];
  const pDmg = plus.groups[1].items[0];
  const wantAtk = P.withModifier("1d20", g2.attacks[0].total + 2);
  const wantDmg = P.withModifier(g2.damages[0].dice || "1d8", g2.damages[0].total + 3);
  if (pAtk.expr === wantAtk && pAtk.label.indexOf("（临时 +2）") >= 0)
    ok("v2.5.0：atkTemp +2 → 攻击 expr " + pAtk.expr + "，标签「" + pAtk.label + "」");
  else bad("v2.5.0：atkTemp 没有进攻击预设：" + JSON.stringify(pAtk));
  if (pDmg.expr === wantDmg && pDmg.label.indexOf("（临时 +3）") >= 0)
    ok("v2.5.0：dmgTemp +3 → 伤害 expr " + pDmg.expr + "，标签带「（临时 +3）」");
  else bad("v2.5.0：dmgTemp 没有进伤害预设：" + JSON.stringify(pDmg));
  const zero = P.presetsFor(CHAR, undefined, { atkTemp: 0, dmgTemp: 0 });
  if (JSON.stringify(zero) === JSON.stringify(P.presetsFor(CHAR)))
    ok("v2.5.0：临时值为 0 时输出与旧调用完全一致（兼容）");
  else bad("v2.5.0：临时值 0 时输出变了");
  const neg = P.presetsFor(CHAR, undefined, { atkTemp: -3, dmgTemp: -2 });
  if (neg.groups[0].items[0].expr === P.withModifier("1d20", g2.attacks[0].total - 3) &&
    neg.groups[0].items[0].label.indexOf("（临时 -3）") >= 0 &&
    neg.groups[1].items[0].label.indexOf("（临时 -2）") >= 0)
    ok("v2.5.0：负临时值（-3 / -2）同样先加 total、标签写「临时 -3」");
  else bad("v2.5.0：负临时值处理不对：" + JSON.stringify(neg.groups[0].items[0]));
}
const skillItems = presets.groups[2].items;
const skillHit = skillItems.filter((s) => s.name === "侦查")[0];
const glanceSkill = (g.skills || []).filter((s) => s.name === "侦查")[0];
if (skillHit && glanceSkill && skillHit.expr === P.withModifier("1d20", glanceSkill.total))
  ok("技能预设 = 1d20 + glance.skills[].total（侦查 " + glanceSkill.total + "，共 " + skillItems.length + " 项）");
else bad("技能预设不对");
if (presets.groups.filter((x) => x.key === "save" || x.key === "init").length === 0)
  ok("豁免 / 先攻两组已从 presetsFor 里删掉（先攻由先攻条负责）");
else bad("presetsFor 里还有 save / init 组");
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
if (rowsCore === "100" && rowsCommon === "100" && D.ROLL_MAX_ROWS === 100)
  ok("ROLL_MAX_ROWS 三处都是 100（dice-core / common / background.core；对齐 FS）");
else bad("ROLL_MAX_ROWS 不一致：" + D.ROLL_MAX_ROWS + " / " + rowsCommon + " / " + rowsCore);
if (coreSrc.indexOf("function rollNorm(") >= 0 && coreSrc.indexOf("function rollMerge(") >= 0 &&
  coreSrc.indexOf("async function migrateRollsFromRoom(") >= 0 && coreSrc.indexOf("function diceHistRead(") >= 0 &&
  coreSrc.indexOf("roomWriteGuarded(KEY_ROLLS, box)") < 0)
  ok("后台不再写房间 rolls：只保留迁移（migrateRollsFromRoom）与本机历史 helper（rollNorm / rollMerge 复用）");
else bad("后台骰子历史改造不完整（仍写房间 / 缺迁移）");
if (commonSrc.indexOf('LS_DICE_HISTORY_PREFIX = "4enext/dice-history/"') >= 0 &&
  commonSrc.indexOf("export function diceHistoryRoomId(") >= 0 &&
  commonSrc.indexOf("export function readDiceHistoryRows(") >= 0 &&
  commonSrc.indexOf("export function appendDiceHistoryRow(") >= 0 &&
  commonSrc.indexOf("export function clearDiceHistory(") >= 0)
  ok("common.js：本机骰子历史 API 齐全（按房间 key / 读 / 追加 / 清空）");
else bad("common.js 缺少本机骰子历史 API");
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
  if (w === 320 && h === 620 && w <= 1334 && h <= 736)
    ok("骰子窗口 320×620（v1.7.4 收窄成窄竖条），在 1366×768 下 = " + w + "×" + h + "（≤ 视口 − 2×16）");
  else bad("窗口尺寸不对：" + w + "×" + h);
} else bad("WINS.dice 没找到（骰子窗口尺寸读不到）");

/* ---------------------------------------------------------------------------
 * 8.5 投骰动画（v1.7.0）：布局 / 时间轴 / URL 参数（纯函数，node 直接测）
 * ------------------------------------------------------------------------- */
console.log("== 8.5 投骰动画常量与布局");
const beat = D.fxBeat();
if (beat.flight === 1200 && beat.hold === 500 && beat.punch === 360 && beat.hold2 === 220 &&
  beat.exit === 320 && beat.slot === 55 && beat.total === 2600)
  ok("时间轴 = 1200 / 500 / 360 / 220 / 320（合计 2600 ms）+ 数字老虎机 55 ms（规格 §4.4）");
else bad("时间轴常量不对：" + JSON.stringify(beat));
const arcHeights = beat.arcs.map((a) => a.height).join(",");
if (beat.arcs.length === 4 && arcHeights === "240,72.6,21.96,6.64")
  ok("四段抛物线弧高 = 240 / 72.6 / 21.96 / 6.64（H0 * r^(2i)，H0 = 240、r = 0.55）");
else bad("弧高不对：" + arcHeights);
const arcEnds = beat.arcs.map((a) => a.to).join(",");
if (Math.abs(beat.arcs[0].to - 0.4953) < 0.001 && beat.arcs[3].to === 1)
  ok("四段时长占比累计到 100%（第一段 ≈ 49.53%，与 CSS 关键帧的 49.53% / 76.77% / 91.76% 对应）");
else bad("段时长占比不对：" + arcEnds);
const b1 = D.fxBaseSize(1), b2 = D.fxBaseSize(2), b5 = D.fxBaseSize(5), b20 = D.fxBaseSize(20);
if (b1 === 128 && b2 === 110 && b5 === 72 && b20 === 72)
  ok("fxBaseSize：1 颗 128 / 2 颗 110 / 5 颗起被 72 兜住（128 * 0.86^(N-1)，最小 72）");
else bad("fxBaseSize 不对：" + [b1, b2, b5, b20].join(","));
const sz20 = D.fxDieSize(b1, "d20"), sz4 = D.fxDieSize(b1, "d4"), sz100 = D.fxDieSize(b1, "d100");
if (sz20 === 128 && sz4 < sz20 && sz100 > sz20)
  ok("fxDieSize：d4 " + sz4 + " < d20 " + sz20 + " < d100 " + sz100 + "（类型系数生效）");
else bad("fxDieSize 不对：" + [sz4, sz20, sz100].join(","));
const lay3 = D.fxLayout([{ type: "d6" }, { type: "d6" }, { type: "d6" }]);
if (lay3.rowCount === 1 && lay3.slots.length === 3 && Math.abs(lay3.slots[0].ox + lay3.slots[2].ox) <= 2 &&
  lay3.gap === Math.round(lay3.baseSize * 0.16) && lay3.totalTop === Math.round(-lay3.baseSize / 2 - 64))
  ok("fxLayout：3 颗一行、左右居中（ox 对称）、gap = round(BASE*0.16)、totalTop = -BASE/2-64");
else bad("fxLayout（3 颗）不对：" + JSON.stringify(lay3));
const lay5 = D.fxLayout([{ type: "d6" }, { type: "d6" }, { type: "d6" }, { type: "d6" }, { type: "d6" }]);
if (lay5.rowCount === 2 && lay5.slots.length === 5 && lay5.modTop > 0)
  ok("fxLayout：5 颗换成 2 行（每行最多 4），modBox.top = lastRowOy + BASE/2 + 28");
else bad("fxLayout（5 颗）不对：" + JSON.stringify(lay5));
const lay21 = D.fxLayout(new Array(21).fill({ type: "d20" }));
if (lay21.count === 20 && lay21.hidden === 1)
  ok("一次最多画 20 颗（FX_MAX_DICE），多出来的计入 hidden（总点数仍按真实结果）");
else bad("FX_MAX_DICE 上限没生效：" + lay21.count + "/" + lay21.hidden);
const q = D.fxQuery({ rollId: "r-1", dice: [{ type: "d20", value: 14 }], total: 26, modifier: 12, label: "攻击" }, { x: 12.34, y: -5.6 });
const sp = new URLSearchParams(q);
if (sp.get("dtypes") === "d20" && sp.get("dvalues") === "14" && sp.get("total") === "26" &&
  sp.get("modifier") === "12" && sp.get("wx") === "12.34" && sp.get("wy") === "-5.6")
  ok("fxQuery：dtypes / dvalues / total / modifier / wx / wy 都能原样解析回来（动画页参数协议）");
else bad("fxQuery 参数不对：" + q);

/* 13b. 21 条 → 20 条（v1.8.0），被删的是最旧的一条 */
const twentyPlus = [];
for (let i = 1; i <= 20; i++) {
  twentyPlus.push({ rollId: "cap" + i, ts: 1000 + i, rollerName: "甲", expression: "1d20", dice: [{ type: "d20", value: 10 }], total: 10 });
}
const twentyOne = D.mergeRollRows(twentyPlus, {
  rollId: "cap21", ts: 1021, rollerName: "甲", expression: "1d20", dice: [{ type: "d20", value: 11 }], total: 11
});
const capIds = twentyOne.map((r) => r.rollId);
  if (twentyOne.length === 21 && capIds[0] === "cap21" && capIds.indexOf("cap1") >= 0)
    ok("21 条（上限 100）→ 全保留、最新排最前");
  else bad("21 条封顶排序不对：" + twentyOne.length + " 条，首条 " + capIds[0]);
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
const sentFx = [];
const sentCmds = [];
/* v1.7.10：窗口 ✕ 的后台兜底频道（closeSelf 发 {op:"close-win", name}）。 */
const sentCloseWins = [];
const modalOpens = [];
/* v1.7.4：记录窗口 —— 页面兜底会自己 OBR.popover.open，所以要记下来；
 * 还要能收到 CH_DICE_HIST_STATE（后台回执），以及看通知有没有真的弹出来。 */
const popoverOpens = [];
/* v1.7.6：记录窗口改成「本页直接 open」，还要能记 close 与 getWidth 的调用，
 * 以及「open 抛错」这种失败路径（用户要求：open 抛错必须弹 ERROR 通知）。 */
const popoverCloses = [];
let popoverOpenFails = false;
const histStateCbs = [];
const notesShown = [];
const readyCbs = [];
const fakeRoom = {};
const fakeOBR = {
  isAvailable: true,
  isReady: true,
  onReady(cb) { readyCbs.push(cb); },
  notification: {
    show(msg, variant) { notesShown.push({ msg, variant }); return Promise.resolve("n"); },
    close() {}
  },
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
    id: "room-test",
    getMetadata: async () => fakeRoom,
    setMetadata: async () => {},
    onMetadataChange() { return () => {}; }
  },
  broadcast: {
    sendMessage(channel, data) {
      const ch = String(channel);
      if (ch.slice(-10) === "/dice-roll") sentFx.push(data);
      else if (ch.slice(-5) === "/roll") sentRolls.push(data);
      else if (ch.slice(-11) === "/roll-clear") sentClears.push(data);
      else if (ch.slice(-14) === "/dice-hist-cmd") sentCmds.push(data);
    else if (ch.slice(-10) === "/win-close") sentCloseWins.push(data);
      return Promise.resolve();
    },
    onMessage(channel, cb) {
      /* v1.7.4：记录窗口的开 / 关状态回执 */
      if (String(channel).endsWith("/dice-hist-state")) histStateCbs.push(cb);
      return () => {};
    }
  },
  popover: {
    open: async (cfg) => {
      if (popoverOpenFails) throw new Error("popover.open 被宿主拒绝（同时开着的窗口太多）");
      popoverOpens.push(cfg);
    },
    close: async (id) => { popoverCloses.push(id); },
    /* v1.7.6：页面打开后用 getWidth 确认窗口真的活着（对已关掉的 popover 会 reject）。 */
    getWidth: async () => 380,
    getHeight: async () => 380
  },
  viewport: { getWidth: async () => 1200, getHeight: async () => 800, onChange() { return () => {}; } },
  tool: { create: async () => {}, remove: async () => {} },
  /* v1.7.0：记录动画 modal 的调用（断言「开关关掉时不调用」用） */
  modal: {
    opens: modalOpens,
    open: async (cfg) => { modalOpens.push(cfg); },
    close: async () => {},
    getId: () => "com.4enext-owlbear/dice-effect-test"
  },
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
for (const name of ["cards-scene.js", "common.js", "window.js", "dice-page.js"]) {
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
      /* v2.5.0：动画改由各客户端后台收到 CH_DICE_ROLL 打开；页面只负责广播。 */
      const fx = sentFx[0] || null;
      if (fx && fx.v === 1 && fx.id === fx.rollId && fx.anchor !== undefined &&
        Array.isArray(fx.dice) && fx.dice.length === 2 && fx.dice.every((d) => d.type === "d6") &&
        typeof fx.total === "number" && fx.rollerId)
        ok("默认开动画：页面广播 CH_DICE_ROLL（payload 含 id/anchor/dice/total），由后台开全屏 modal");
      else bad("CH_DICE_ROLL 广播不对：" + JSON.stringify(fx));

      /* 记录窗口按钮（v1.7.6 重写）：**点一下就该真的开出一个窗口** —— 不再先发命令等后台回执，
       * 而是本页直接 OBR.popover.open（openHistoryDirect），打开后 getWidth 确认存活，
       * 按钮文字变「关闭记录窗口」；open 抛错 → ERROR 通知 + 请后台 force-open。
       * 这里用一个假 OBR 把这条链路完整跑一遍（不启动浏览器）。 */
      const histClicks = (domMap.btnHist.listeners.click || []);
      if (!histClicks.length) bad("「记录窗口」按钮没有绑定 click");
      else {
        /* ① 直开：不需要任何后台回执，一次 popover.open + 一次 getWidth */
        const opensBefore = popoverOpens.length;
        const cmdsBefore = sentCmds.length;
        histClicks[0]({ preventDefault() {} });
        await sleep(60);
        const cfg = popoverOpens[popoverOpens.length - 1] || null;
        if (popoverOpens.length === opensBefore + 1 && cfg &&
          cfg.id === "com.4enext-owlbear/dice-history-window" &&
          String(cfg.url).indexOf("dice-history.html") >= 0 &&
          cfg.anchorReference === "POSITION" &&
          cfg.anchorPosition && typeof cfg.anchorPosition.left === "number" && typeof cfg.anchorPosition.top === "number" &&
          cfg.anchorOrigin && cfg.anchorOrigin.horizontal === "LEFT" && cfg.anchorOrigin.vertical === "TOP" &&
          cfg.transformOrigin && cfg.transformOrigin.horizontal === "LEFT" && cfg.transformOrigin.vertical === "TOP" &&
          cfg.hidePaper === true && cfg.disableClickAway === false &&
          cfg.width === 300 && cfg.height === 240)
          ok("点「记录窗口」→ **本页直接** OBR.popover.open(dice-history.html, 300×240, POSITION 左上角, hidePaper:true 透明外壳, disableClickAway:false)");
        else if (cfg && cfg.width === 300 && cfg.height === 240 && cfg.hidePaper !== true)
          bad("没有直接开记录窗口（hidePaper 应为 true）：" + JSON.stringify(cfg));
        else bad("没有直接开记录窗口：" + JSON.stringify(cfg));
        if (domMap.btnHist.textContent === "关闭记录窗口" && domMap.btnHist.classList.contains("on"))
          ok("开出来之后按钮文字变「关闭记录窗口」（用户看得见的反馈）");
        else bad("开窗后按钮没有变成「关闭记录窗口」：" + domMap.btnHist.textContent);
        /* [v1.7.8] 反向断言：开窗成功**不再**弹「记录窗口已打开」（窗口就在眼前、按钮文字也变了），
         * 通知中心里不该再出现 SUCCESS / INFO / DEFAULT 这类提示。 */
        const okNotes = notesShown.filter((n) => String(n.msg).indexOf("记录窗口已打开") >= 0);
        const softNotes = notesShown.filter((n) => n.variant !== "ERROR" && n.variant !== "WARNING");
        if (!okNotes.length && !softNotes.length)
          ok("开窗成功不弹通知（v1.7.8：成功类通知为 0，按钮变「关闭记录窗口」就是反馈）");
        else bad("开窗成功还在弹通知：" + JSON.stringify(notesShown.slice(-2)));
        const adopt = sentCmds.slice(cmdsBefore).filter((c) => c && c.op === "adopt");
        if (adopt.length === 1 && typeof adopt[0].left === "number" && adopt[0].width === 300)
          ok("开窗成功后把几何 { op:\"adopt\", left, top, width, height } 发给后台（拖动 / 记位置照旧）");
        else bad("开窗后没有 adopt 几何：" + JSON.stringify(sentCmds.slice(cmdsBefore)));

        /* ② 再点一下 = 关：popover.close + 按钮回到「记录窗口」+ 通知后台清状态 */
        const closesBefore = popoverCloses.length;
        const cmdsBefore2 = sentCmds.length;
        histClicks[0]({ preventDefault() {} });
        await sleep(60);
        if (popoverCloses.length === closesBefore + 1 && popoverCloses[popoverCloses.length - 1] === "com.4enext-owlbear/dice-history-window" &&
          domMap.btnHist.textContent === "记录窗口" && !domMap.btnHist.classList.contains("on"))
          ok("开着的状态下再点 → OBR.popover.close(记录窗口)，按钮回到「记录窗口」");
        else bad("关闭记录窗口失败：" + domMap.btnHist.textContent + " / closes+" + (popoverCloses.length - closesBefore));
        if (sentCloseWins.slice(-1).some((c) => c && c.op === "close-win" && c.name === "diceHistory"))
          ok("关闭时也通知后台（{ op:\"close-win\", name:\"diceHistory\" }）→ 后台的 winOpen / 状态不会跟丢");
        else bad("关闭时没有通知后台：" + JSON.stringify(sentCloseWins.slice(-2)));

        /* ③ 直开失败（宿主拒绝）→ ERROR 通知（用户要求「open 抛错必须看得见」）+ 请后台 force-open */
        const cmdsBefore3 = sentCmds.length;
        const notesBefore3 = notesShown.length;
        popoverOpenFails = true;
        histClicks[0]({ preventDefault() {} });
        await sleep(60);
        popoverOpenFails = false;
        const errNote = notesShown.slice(notesBefore3).filter((n) => String(n.msg).indexOf("记录窗口打开失败：") >= 0);
        if (errNote.length && errNote[errNote.length - 1].variant === "ERROR")
          ok("open 抛错 → ERROR 通知「记录窗口打开失败：<原因>」，按钮回到「记录窗口」");
        else bad("open 抛错没有 ERROR 通知：" + JSON.stringify(notesShown.slice(notesBefore3)));
        if (sentCmds.slice(cmdsBefore3).some((c) => c && c.op === "force-open"))
          ok("失败时请后台「先关掉骰子窗口、再开记录窗口」（{ op:\"force-open\" }）");
        else bad("失败时没有让后台补开");
        if (!domMap.btnHist.classList.contains("on") && domMap.btnHist.textContent === "记录窗口")
          ok("失败后按钮没有假装「开着」");
        else bad("失败后按钮状态不对：" + domMap.btnHist.textContent);

        /* ④ 后台回执仍然认（后台补开成功 → STATE{open:true} 会把按钮补成「关闭记录窗口」） */
        if (!histStateCbs.length) bad("骰子窗口没有订阅 CH_DICE_HIST_STATE（后台补开后状态回不来）");
        else {
          histStateCbs[0]({ data: { open: true } });
          await sleep(30);
          if (domMap.btnHist.textContent === "关闭记录窗口" && domMap.btnHist.classList.contains("on"))
            ok("收到 CH_DICE_HIST_STATE { open:true } → 按钮同步成「关闭记录窗口」");
          else bad("收到回执后按钮没变：" + domMap.btnHist.textContent);
        }
      }

      /* 关掉动画 → 不再打开 modal，但投掷本身照常 */
      lsStore["4enext/dice/anim"] = "0";
      const opensBefore = modalOpens.length;
      const rollsBefore = sentRolls.length;
      await sleep(900); /* 等第一投 busy 解锁 + 800ms 限流窗口过去 */
      clicks[0]({ preventDefault() {} });
      await sleep(80);
      if (modalOpens.length === opensBefore) ok("页面不再直接调用 OBR.modal.open（后台统一开动画）");
      else bad("动画关掉后仍然打开了 modal");
      if (sentRolls.length > rollsBefore) ok("关掉动画不影响投掷本身（CH_ROLL 仍然发出）");
      else bad("关掉动画后投掷没有广播");
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

/* ---------------------------------------------------------------------------
 * 10. 假 DOM 冒烟：动画页 / 记录页的脚本真的能跑起来（不启动浏览器）
 * ------------------------------------------------------------------------- */
console.log("== 10 动画页 / 记录页 假 DOM 冒烟");

function makeEl2(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(), id: "", className: "", textContent: "", innerHTML: "",
    hidden: false, dataset: {}, attrs: {}, children: [], listeners: {},
    style: {
      props: {},
      setProperty(k, v) { el.style.props[k] = String(v); },
      getPropertyValue(k) { return el.style.props[k] || ""; }
    },
    classList: makeClassList(),
    appendChild(c) { el.children.push(c); return c; },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return el.attrs[k] === undefined ? null : el.attrs[k]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    hasPointerCapture() { return false; },
    setPointerCapture() {},
    releasePointerCapture() {},
    offsetWidth: 10
  };
  return el;
}

const savedTimers = {
  setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
  raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame
};
const fxTimers = [];
const fxIntervals = [];
const rafQueue = [];
globalThis.setTimeout = (fn, ms) => { fxTimers.push({ fn, ms }); return savedTimers.setTimeout(fn, ms); };
globalThis.setInterval = (fn, ms) => { fxIntervals.push({ fn, ms }); return savedTimers.setInterval(fn, ms); };
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};
/* v1.7.1：把窗口 / 文档上注册的监听器收集起来，「ESC / 点击立即关」才测得到 */
const windowListeners = {};
const docListeners = {};
const recordListener = (box) => (type, fn) => { (box[type] = box[type] || []).push(fn); };
globalThis.window = { innerWidth: 1200, innerHeight: 800, addEventListener: recordListener(windowListeners) };

/* ---- 10.1 effect.html：按 URL 参数摆骰子、落地定数、播完自己关 ---- */
const fxIds = ["fx-stage", "fx-flash", "fx-wrap", "fx-total", "fx-total-num", "fx-mod", "fx-mod-num", "fx-mod-label"];
const fxDom = {};
for (const id of fxIds) fxDom[id] = makeEl2("div");
const fxSrc = fs.readFileSync(path.join(ROOT, "assets", "effect-page.js"), "utf8");
globalThis.location = { href: "https://example.test/effect.html", protocol: "https:", search: "?dtypes=d20&dvalues=14&total=14&modifier=0&rollId=r-fx&wx=100&wy=200" };
globalThis.document = {
  getElementById: (id) => fxDom[id] || makeEl2("div"),
  querySelectorAll: () => [],
  addEventListener: recordListener(docListeners),
  createElement: (tag) => makeEl2(tag),
  body: makeEl2("body")
};
const closedModals = [];
fakeOBR.modal.close = async (id) => { closedModals.push(id); };
fakeOBR.viewport.getPosition = async () => ({ x: 0, y: 0 });
fakeOBR.viewport.getScale = async () => 2;

function copyPageWithStub(name) {
  let src = fs.readFileSync(path.join(ROOT, "assets", name), "utf8");
  src = src.replace('from "../vendor/obr-sdk.js"', 'from "../vendor/obr-stub.mjs"');
  fs.writeFileSync(path.join(tmp, "assets", name), src, "utf8");
}
copyPageWithStub("effect-page.js");
const readyBeforeFx = readyCbs.length;
let fxErr = null;
try {
  await import(pathToFileURL(path.join(tmp, "assets", "effect-page.js")).href + "?fx=1");
} catch (e) { fxErr = e; }
if (fxErr) bad("effect-page.js 加载就抛错：" + (fxErr && fxErr.message ? fxErr.message : fxErr));
else ok("effect-page.js 能在假 OBR + 假 DOM 下加载");
for (const cb of readyCbs.slice(readyBeforeFx)) cb();
await sleep(40);
const wrapEl = fxDom["fx-wrap"];
if (wrapEl.children.length === 1) ok("按 dtypes/dvalues 建出 1 颗骰子（DOM 挂到 .fx-wrap 上）");
else bad("动画页没有建出骰子：children=" + wrapEl.children.length);
const dieEl = wrapEl.children[0] || null;
if (dieEl && dieEl.style.width === "128px" && dieEl.style.props["--dice-size"] === "128px" &&
  dieEl.style.props["--fx-flight"] === "1200ms" && dieEl.style.left === "-64px" && dieEl.style.top === "-64px")
  ok("单颗骰子 128×128、飞行 1200ms、按 fxLayout 的槽位居中摆放（left/top = ox-64 / oy-64）");
else bad("骰子尺寸 / 位置不对：" + JSON.stringify(dieEl && { w: dieEl.style.width, p: dieEl.style.props, l: dieEl.style.left, t: dieEl.style.top }));
if (rafQueue.length) { rafQueue.shift()(); }
await sleep(30);
if (fxDom["fx-wrap"].style.props["--tx"] === "200px" && fxDom["fx-wrap"].style.props["--ty"] === "400px")
  ok("世界坐标投影：sx = 100*2 + 0 = 200px，sy = 200*2 + 0 = 400px（scale 来自 viewport）");
else bad("投影不对：" + fxDom["fx-wrap"].style.props["--tx"] + " / " + fxDom["fx-wrap"].style.props["--ty"]);
const settleTimer = fxTimers.filter((t) => t.ms === 1200).pop();
if (settleTimer) { settleTimer.fn(); }
const numEl = dieEl ? dieEl.children[0].children[1] : null;
if (numEl && numEl.textContent === "14" && numEl.classList.contains("snap"))
  ok("落地时数字定住真实点数（14）并加 .snap（老虎机停）");
else bad("落地数字不对：" + (numEl ? numEl.textContent : "没有 num 元素"));
const totalTimer = fxTimers.filter((t) => t.ms === 1450).pop(); /* flight + hold/2 */
if (totalTimer) totalTimer.fn();
if (fxDom["fx-total-num"].textContent === "14" && fxDom["fx-total"].classList.contains("on"))
  ok("当前总和显示本次总点数（14），并在 flight + hold/2 时淡入（.on）");
else bad("当前总和不对：" + fxDom["fx-total-num"].textContent);
/* v1.7.1：关闭有三级 —— 2600（播完）→ 3000（兜底）→ ESC / 点击（立即） */
if (fxSrc.indexOf("var FX_CLOSE_FALLBACK_MS = 3000;") >= 0)
  ok("effect-page.js 里有兜底常量 FX_CLOSE_FALLBACK_MS = 3000（比动画总时长 2600 ms 多留 400 ms）");
else bad("effect-page.js 里没有 FX_CLOSE_FALLBACK_MS = 3000");
const fallbackTimer = fxTimers.filter((t) => t.ms === 3000).pop();
if (fallbackTimer && typeof fallbackTimer.fn === "function")
  ok("动画页注册了 3000 ms 兜底 close（setTimeout(finish, FX_CLOSE_FALLBACK_MS)）");
else bad("动画页没有注册 3000 ms 兜底 close");
const closeTimer = fxTimers.filter((t) => t.ms === 2600).pop();
if (closeTimer) { closeTimer.fn(); }
await sleep(20);
if (closedModals.length === 1 && closedModals[0] && String(closedModals[0]).indexOf("dice-effect") >= 0 &&
  fxDom["fx-stage"].classList.contains("fx-done"))
  ok("播完 2600 ms 自己 OBR.modal.close（关的就是本次动画 modal）并把舞台标成 .fx-done（DOM 不累积）");
else bad("播完没有关闭 / 没有隐藏：closed=" + closedModals.length + " done=" + fxDom["fx-stage"].classList.contains("fx-done"));
if (fallbackTimer) fallbackTimer.fn();
await sleep(10);
if (closedModals.length === 1) ok("2600 ms 关过之后 3000 ms 兜底再触发也不会重复 close（finish 幂等）");
else bad("finish 不幂等：OBR.modal.close 被调了 " + closedModals.length + " 次");

/* 每个用例单独 import 一份新实例（query 不同 = 模块状态是新的） */
async function fxFresh(tag) {
  copyPageWithStub("effect-page.js");
  const before = readyCbs.length;
  let err = null;
  try {
    await import(pathToFileURL(path.join(tmp, "assets", "effect-page.js")).href + "?" + tag);
  } catch (e) { err = e; }
  for (const cb of readyCbs.slice(before)) cb();
  await sleep(30);
  return err;
}

{
  /* 10.1b：兜底 3000 ms —— 2600 的定时器没跑到（动画被打断 / 页面被挂起）时强制关 */
  const mark = closedModals.length;
  const err = await fxFresh("fx-fb");
  const fb = fxTimers.filter((t) => t.ms === 3000).pop();
  if (fb) fb.fn();
  await sleep(20);
  if (!err && fb && closedModals.length === mark + 1 && String(closedModals[closedModals.length - 1]).indexOf("dice-effect") >= 0)
    ok("兜底：3000 ms 到点强制 OBR.modal.close（动画被打断也不会留一层在屏幕上）");
  else bad("3000 ms 兜底没有 close：closed +" + (closedModals.length - mark) + (err ? " err=" + err.message : ""));
}

{
  /* 10.1c：ESC 立即关 */
  const mark = closedModals.length;
  const err = await fxFresh("fx-esc");
  const keys = windowListeners.keydown || [];
  const escFn = keys[keys.length - 1];
  if (escFn) escFn({ key: "Escape" });
  await sleep(20);
  if (!err && escFn && closedModals.length === mark + 1) ok("按 ESC 立即关闭（不用等 2600 / 3000 ms）");
  else bad("ESC 没有立即关闭：closed +" + (closedModals.length - mark) + (err ? " err=" + err.message : ""));
}

{
  /* 10.1d：点击任意处立即关 */
  const mark = closedModals.length;
  const err = await fxFresh("fx-click");
  const clicks = windowListeners.click || [];
  const clickFn = clicks[clicks.length - 1];
  if (clickFn) clickFn({});
  await sleep(20);
  if (!err && clickFn && closedModals.length === mark + 1) ok("点击任意处立即关闭");
  else bad("点击没有立即关闭：closed +" + (closedModals.length - mark) + (err ? " err=" + err.message : ""));
}

/* ---- 10.2 dice-history.html：读房间数据 → 默认最近 4 条 → 可展开 ---- */
const histDom = {};
for (const id of ["head", "pin", "close", "dh-list", "dh-meta", "dh-toggle", "dh-warn", "bg-text", "bg-retry", "win-flash"]) histDom[id] = makeEl2("div");
globalThis.location = { href: "https://example.test/dice-history.html", protocol: "https:", search: "" };
globalThis.document = {
  getElementById: (id) => histDom[id] || fxDom[id] || makeEl2("div"),
  querySelectorAll: () => [],
  addEventListener() {},
  createElement: (tag) => makeEl2(tag),
  body: makeEl2("body")
};
const histRows = [];
for (let i = 1; i <= 6; i++) {
  histRows.push({ rollId: "h" + i, ts: 1000 + i, rollerId: "u1", rollerName: "甲" + i, rollerColor: "#7fe07f",
    label: "攻击", expression: "1d20 + 5", dice: [{ type: "d20", value: 10 + i }], modifier: 5, total: 15 + i });
}
lsStore["4enext/dice-history/" + (fakeOBR.room && fakeOBR.room.id ? fakeOBR.room.id : "default")] =
  JSON.stringify({ v: 1, rows: histRows });
copyPageWithStub("dice-history-page.js");
const readyBeforeHist = readyCbs.length;
let histErr = null;
try {
  await import(pathToFileURL(path.join(tmp, "assets", "dice-history-page.js")).href + "?h=1");
} catch (e) { histErr = e; }
if (histErr) bad("dice-history-page.js 加载就抛错：" + (histErr && histErr.message ? histErr.message : histErr));
else ok("dice-history-page.js 能在假 OBR + 假 DOM 下加载");
for (const cb of readyCbs.slice(readyBeforeHist)) cb();
await sleep(50);
const listEl = histDom["dh-list"];
if (listEl.innerHTML.indexOf("hist-row") >= 0 && listEl.innerHTML.indexOf("甲6") >= 0 && listEl.innerHTML.indexOf("21") >= 0)
  ok("记录窗口把**本机历史**画成了历史行（掷骰者 / 总点数都在）");
else bad("记录窗口没有画出历史行：" + listEl.innerHTML.slice(0, 160));
if (listEl.classList.contains("compact")) ok("默认是 compact（只显示最近 4 条）");
else bad("记录窗口默认不是 compact");
if (histDom["dh-meta"].textContent.indexOf("6") >= 0 && histDom["dh-meta"].textContent.indexOf("本机") >= 0) ok("顶部计数：本机共 6 / 20 条");
else bad("计数不对：" + histDom["dh-meta"].textContent);
const toggleFn = (histDom["dh-toggle"].listeners.click || [])[0];
if (!toggleFn) bad("展开按钮没有绑定 click");
else {
  toggleFn({ preventDefault() {} });
  if (!listEl.classList.contains("compact")) ok("点「展开全部」去掉 compact（看全部记录）");
  else bad("展开后仍然是 compact");
}

/* ---- 10.3 v1.9.2：本机骰子历史原语（按房间隔离 / 去重 / 上限 20 / 容错） ---- */
{
  const C = await import(pathToFileURL(path.join(tmp, "assets", "common.js")).href);
  const RA = "room-A", RB = "room-B";
  C.clearDiceHistory(RA); C.clearDiceHistory(RB);
  const rowOf = (id, ts) => ({ rollId: id, ts: ts, rollerName: "甲", dice: [{ type: "d20", value: 10 }], total: 10 });
  C.appendDiceHistoryRow(rowOf("x1", 1), RA);
  C.appendDiceHistoryRow(rowOf("x2", 2), RA);
  C.appendDiceHistoryRow(rowOf("x1", 1), RA); /* 同 rollId 幂等 */
  const listA = C.readDiceHistoryRows(RA);
  if (listA.length === 2 && listA[0].rollId === "x2" && listA[1].rollId === "x1")
    ok("v1.9.2：appendDiceHistoryRow 去重 + 按 ts 倒序（同 rollId 不重复插）");
  else bad("appendDiceHistoryRow 去重 / 排序不对：" + JSON.stringify(listA.map((r) => r.rollId)));
  for (let i = 1; i <= 25; i++) C.appendDiceHistoryRow(rowOf("cap" + i, 100 + i), RA);
  const capped = C.readDiceHistoryRows(RA);
  if (capped.length === 27 && capped[0].rollId === "cap25" && capped.some(function (r) { return r.rollId === "cap1"; }))
    ok("v2.5.0：本机历史上限 100（对齐 FS），按 ts 倒序保留早期记录");
  else bad("本机历史上限不对：" + capped.length + " / " + (capped[0] && capped[0].rollId));
  if (C.readDiceHistoryRows(RB).length === 0)
    ok("v1.9.2：本机历史按房间 key 隔离（room-B 看不到 room-A 的记录）");
  else bad("本机历史没有按房间隔离");
  lsStore[C.diceHistoryKey(RA)] = "{坏的 JSON";
  if (C.readDiceHistoryRows(RA).length === 0)
    ok("v1.9.2：本机历史 JSON 损坏时容错为空列表（不抛错）");
  else bad("本机历史坏 JSON 没有容错");
  C.clearDiceHistory(RA);
  if (C.readDiceHistoryRows(RA).length === 0) ok("v1.9.2：clearDiceHistory 清空本机历史");
  else bad("clearDiceHistory 没清空");
}

globalThis.setTimeout = savedTimers.setTimeout;
globalThis.setInterval = savedTimers.setInterval;
globalThis.requestAnimationFrame = savedTimers.raf;
globalThis.cancelAnimationFrame = savedTimers.caf;

// 顺带确认「不启动浏览器」：本测试只用纯函数 + 假 OBR + 假 DOM，没有任何 GUI
console.log("\n  info 未启动浏览器（沙箱环境禁止），以上全部为纯函数 / 假 OBR / 假 DOM 断言");

/* ---- v2.5.0 骰子动画 SVG / 多端同步 ---- */
{
  const fx = fs.readFileSync(path.join(ROOT, "assets", "dice-fx.js"), "utf8");
  const eff = fs.readFileSync(path.join(ROOT, "assets", "effect-page.js"), "utf8");
  const page = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const common = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  if (fx.indexOf("export function diceSvg") >= 0 && ["d4","d6","d8","d10","d12","d20","d100"].every(t => fx.indexOf(t + ":") >= 0) &&
    eff.indexOf("diceSvg(d.type, d.value)") >= 0 && eff.indexOf("fx-shape") >= 0)
    ok("v2.5.0：自绘 SVG 骰子 d4/d6/d8/d10/d12/d20/d100，动画页按类型渲染");
  else bad("v2.5.0：SVG 骰子缺失/映射不对");
  if (common.indexOf("CH_DICE_ROLL") >= 0 && common.indexOf("CH_DICE_CLEAR") >= 0 &&
    page.indexOf("broadcast(CH_DICE_ROLL, fxMsg)") >= 0 && page.indexOf("seenFxRolls[d.id]") >= 0 &&
    page.indexOf("CH_DICE_CLEAR") >= 0)
    ok("v2.5.0：投掷广播 CH_DICE_ROLL（含 anchor/rollId），按 rollId 去重；清场广播 CH_DICE_CLEAR");
  else bad("v2.5.0：多端同步/去重缺失");
}

/* ---- v2.5.0 阶段一：布局 / 节奏 / 队列 ---- */
{
  const FX = await import(pathToFileURL(path.join(tmp, "assets", "dice-fx.js")).href);
  const makes = (n) => Array.from({ length: n }, (_, i) => ({ type: i % 2 ? "d6" : "d20" }));
  const l1 = FX.diceLayout(makes(1), 1280, 720);
  const l5 = FX.diceLayout(makes(5), 1280, 720);
  const l10 = FX.diceLayout(makes(10), 1280, 720);
  const l20 = FX.diceLayout(makes(20), 1280, 720);
  const maxRight = (L) => Math.max(...L.slots.map((s) => Math.abs(s.ox) + s.size / 2));
  const maxBottom = (L) => Math.max(...L.slots.map((s) => Math.abs(s.oy) + s.size / 2));
  if (l1.slots.length === 1 && l5.slots.length === 5 && l10.slots.length === 10 && l20.slots.length === 20 &&
    maxRight(l10) <= 1280 * 0.5 && maxRight(l20) <= 1280 * 0.5 && l20.baseSize < l5.baseSize)
    ok("v2.5.0：自适应布局 1/5/10/20 颗数量正确，尺寸随数量缩小且不超界");
  else bad("v2.5.0：自适应布局不对");
  const d1 = FX.diceFxDuration(1, "standard");
  const d10 = FX.diceFxDuration(10, "standard");
  const fast = FX.diceFxDuration(10, "fast");
  const off = FX.diceFxDuration(10, "off");
  if (d1 >= 1200 && d10 === 2700 && fast === 1620 && off === 500)
    ok("v2.5.0：节奏 900+180n（1→1200 / 10→2700）；快速×0.6；关闭=500ms");
  else bad("v2.5.0：节奏计算不对：" + JSON.stringify({ d1, d10, fast, off }));
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (bg.indexOf("diceFxQueue") < 0 && bg.indexOf("DICE_FX_MAX") < 0 &&
    bg.indexOf("async function runDiceFx") >= 0 && bg.indexOf("OBR.modal.open({ id: id") >= 0)
    ok("v2.5.0：后台每投直接开唯一 modal（不排队，照 Full Suite），避免高频丢动画");
  else bad("v2.5.0：后台直开 modal 缺失");
}

/* ---- v2.5.0：重复按钮 ---- */
{
  if (D.repeatExpr) {
    const w = D.repeatExpr("1d20 + 5", 2);
    const r = D.repeatExpr("repeat(3, 1d6+2)", 5);
    const same = D.repeatExpr("repeat(3, 1d6+2)", 3);
    const lo = D.repeatExpr("1d20", 0);
    const hi = D.repeatExpr("1d20", 99);
    const empty = D.repeatExpr("   ", 2);
    if (w.ok && w.expr === "repeat(2, 1d20 + 5)" && r.ok && r.expr === "repeat(5, 1d6+2)" &&
      same.expr === "repeat(3, 1d6+2)" && lo.n === 1 && hi.n === 20 && !empty.ok)
      ok("v2.5.0：repeat 包一层/替换 N/幂等/clamp 1–20/空表达式报错");
    else bad("v2.5.0：repeatExpr 行为不对：" + JSON.stringify({ w, r, same, lo, hi, empty }));
  } else bad("v2.5.0：repeatExpr 未导出");
  const html = fs.readFileSync(path.join(ROOT, "dice.html"), "utf8");
  const page = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  if (html.indexOf('id="repeat-n"') >= 0 && html.indexOf('id="repeat-apply"') >= 0 &&
    html.indexOf('data-repeat="2"') >= 0 && page.indexOf("repeat apply n=") >= 0)
    ok("v2.5.0：面板有 #repeat-n / #repeat-apply / ×2×3×5，apply 有日志");
  else bad("v2.5.0：repeat UI 缺失");
  const parsed = D.rollParsed(D.parseExpr("repeat(3, 1d6+2)"), {});
  if (parsed && Array.isArray(parsed.rowStarts) && parsed.rowStarts.length === 3)
    ok("v2.5.0：repeat(3,1d6+2) 产生 3 行 rowStarts");
  else bad("v2.5.0：repeat rowStarts 不对：" + JSON.stringify(parsed && parsed.rowStarts));
}

/* ---- v2.5.0 修正：repeat 顺序 / 历史换行分行 ---- */
{
  const parsed = D.parseExpr("repeat(2, 1d20+5)");
  const text = D.formatExpr(parsed);
  const again = D.parseExpr(text);
  if (/^repeat\(2,/.test(text) && text.indexOf("1d20") > 0 && D.formatExpr(again) === text)
    ok("v2.5.0：repeat 规范表达式顺序为 repeat(2, inner)，format→parse 往返一致");
  else bad("v2.5.0：repeat 表达式顺序/往返不对：" + text);
  const css = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const page = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  if (page.indexOf("res-formula") < 0 && /res-rows \{[^}]*gap: 0/.test(css))
    ok("v2.5.0：本次结果删除裸公式行，等式行紧凑（gap 0）");
  else bad("v2.5.0：结果裸公式行/行距未清理");
  const hist = fs.readFileSync(path.join(ROOT, "assets", "dice-history-page.js"), "utf8");
  if (css.indexOf("body.dh-page .hist-expr") < 0 && /body\.dh-page \.hist-line[^}]*line-height: 1\.25/.test(css) &&
    hist.indexOf("hist-chips") >= 0 && hist.indexOf("hist-rows") >= 0 && hist.indexOf("repeatRowLines(r)") >= 0)
    ok("v2.5.0：历史不再有裸公式行；chip 行 + 逐行等式，允许换行");
  else bad("v2.5.0：历史换行/分行渲染缺失");
}

/* ---- v2.5.0 逐行格式 ---- */
{
  const mk = (expr, vals, mod) => ({ expression: expr, modifier: mod, rowStarts: vals.map((_, i) => i), dice: vals.map(v => ({ type: "d20", value: v })) });
  const lines = D.repeatRowLines ? D.repeatRowLines(mk("repeat(5, 1d20+5)", [3, 2, 12, 18, 10], 5)) : [];
  if (lines.length === 5 && lines[0] === "r1d20 + 5 = 3 + 5 = 8" && lines[1] === "r1d20 + 5 = 2 + 5 = 7" && lines[4] === "r1d20 + 5 = 10 + 5 = 15")
    ok("v2.5.0：逐行格式 r1d20 = 骰面 + 修正 = 行总和（示例 3/2/12/18/10）");
  else bad("v2.5.0：逐行格式不对：" + JSON.stringify(lines));
  const multi = D.repeatRowLines({ expression: "repeat(2, 2d6+1d20+5)", modifier: 5, rowStarts: [0, 3],
    dice: [{ type: "d6", value: 3 }, { type: "d6", value: 4 }, { type: "d20", value: 12 }, { type: "d6", value: 1 }, { type: "d6", value: 2 }, { type: "d20", value: 10 }] });
  if (multi.length === 2 && multi[0].indexOf("r2d6 + 1d20 + 5 = 3 + 4 + 12 + 5 = 24") >= 0)
    ok("v2.5.0：多骰多修正行格式正确（2d6+1d20+5 = 3 + 4 + 12 + 5 = 24）");
  else bad("v2.5.0：多骰行格式不对：" + JSON.stringify(multi));
  if (D.repeatRowLines({ expression: "1d20 + 5", rowStarts: [], dice: [{ type: "d20", value: 3 }] }).length === 0)
    ok("v2.5.0：无 repeat 不产生 r 前缀行");
  else bad("v2.5.0：无 repeat 仍生成 r 行");
  const one = D.rollLine ? D.rollLine({ expression: "1d20+5", modifier: 5, total: 8, dice: [{ type: "d20", value: 3 }] }) : "";
  const many = D.rollLine ? D.rollLine({ expression: "2d6+1d20+5", modifier: 5, total: 24,
    dice: [{ type: "d6", value: 3 }, { type: "d6", value: 4 }, { type: "d20", value: 12 }] }) : "";
  if (one === "1d20 + 5 = 3 + 5 = 8" && many === "2d6 + 1d20 + 5 = 3 + 4 + 12 + 5 = 24" &&
    D.rollLine({ expression: "repeat(2,1d20)", dice: [{ type: "d20", value: 1 }], total: 1 }) === "")
    ok("v2.5.0：普通单骰/多骰等式正确，repeat 不产生普通行");
  else bad("v2.5.0：普通等式格式不对：" + JSON.stringify({ one, many }));
  const hist = fs.readFileSync(path.join(ROOT, "assets", "dice-history-page.js"), "utf8");
  if (hist.indexOf("repeatRowLines(r)") >= 0 && hist.indexOf("rollLine(r)") >= 0 && hist.indexOf("hist-line") >= 0)
    ok("v2.5.0：历史记录按逐行文本渲染");
  else bad("v2.5.0：历史逐行渲染缺失");
}

/* ---- v2.5.0：骰子广播限流与载荷校验 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (bg.indexOf("DICE_ROLL_MIN_MS = 800") >= 0 && bg.indexOf("DICE_ROLL_MAX_BYTES = 6144") >= 0 &&
    bg.indexOf("DICE_ROLL_MAX_DICE = 40") >= 0 && bg.indexOf("dice roll throttled") >= 0 &&
    bg.indexOf("function diceRollValid") >= 0 && bg.indexOf("dice roll rejected") >= 0)
    ok("v2.5.0：CH_DICE_ROLL 800ms 限流 + 6KB/40 颗上限 + 非法 payload 拒绝");
  else bad("v2.5.0：骰子广播限流/校验缺失");
}

/* ---- v2.5.0 投掷限制中文提示 ---- */
{
  const page = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (page.indexOf("DICE_MSG_TOO_FAST") >= 0 && page.indexOf("DICE_MSG_TOO_MANY") >= 0 &&
    page.indexOf("DICE_MSG_TOO_BIG") >= 0 && page.indexOf("lastRollSentAt") >= 0 &&
    page.indexOf("if ((payload.dice || []).length > DICE_ROLL_MAX_DICE)") >= 0 &&
    page.indexOf("rollBytes > DICE_ROLL_MAX_BYTES") >= 0)
    ok("v2.5.0：面板 <0.8s / >40 颗 / >6KB 先校验并 flash，不广播");
  else bad("v2.5.0：面板限流/上限校验缺失");
  if (bg.indexOf("dice roll throttled") >= 0 && bg.indexOf("dice roll rejected reason=") >= 0 &&
    bg.indexOf("DICE_MSG_TOO_FAST") >= 0 && bg.indexOf("notify(reason === \"too-many\"") >= 0)
    ok("v2.5.0：后台兜底：限流/拒绝时给本机发送者中文 WARNING");
  else bad("v2.5.0：后台拒绝文案缺失");
}

/* ---- v2.5.0 常驻限制提示 ---- */
{
  const html = fs.readFileSync(path.join(ROOT, "dice.html"), "utf8");
  if (html.indexOf("单次最多 40 颗骰子；投掷间隔 0.8 秒") >= 0 && html.indexOf('class="sync-hint"') >= 0)
    ok("v2.5.0：骰子面板常驻提示单次最多 40 颗 / 间隔 0.8 秒");
  else bad("v2.5.0：全桌同步提示缺失");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
