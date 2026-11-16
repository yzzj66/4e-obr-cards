// 渲染层自检：把 assets/glance.js 复制成 .mjs（改写 import 路径）后在 Node 里跑一遍。
// 用法：node dev/test-glance.mjs [卡片 JSON 路径]
//
// 本文件不在 selftest 里（selftest 跑 test-glance2），但单独跑必须绿。v1.8.6 口径：
//   · 速览主体区块（血量 / 四防 / 技能 / 威能分组 / 装备行）照常渲染；
//   · 遭遇 / 每日 / 辅助 / 种族职业 四组每个 chip 都是 <button data-act="power">（随意威能纯展示）；
//   · 装备 / 魔法物品每一行都是 <button data-act="equipment">；
//   · **威能动作类型标签**：先注入精简索引 data/card-index.js（v1.8.6 结构 {v,c,p}），
//     断言 chip 里有 标准动作 / 即时反应 / 移动动作 / 自由动作（≥10 处）；
//   · **专长区块整块不渲染**（v1.8.6 用户确认去掉）；**装备行没有物品等级档位（L…）**；
//   · tooltip 不再拼「攻击：… / 命中：…」；
//   · 默认状态（没有任何已用标记）计数是 0 / N，没有 used 样式；老下标 key 被忽略；
//   · 「共享数据」开关在顶部标题区、HP 区没有、开 = hp.locked:false = 显示精确数字。
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const tmp = path.join(os.tmpdir(), "4enext-glance-test");
fs.mkdirSync(tmp, { recursive: true });

let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };

const rulesPath = pathToFileURL(path.join(ROOT, "data", "rules.js")).href;
let src = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
src = src.replace('from "../data/rules.js"', "from " + JSON.stringify(rulesPath));
const modPath = path.join(tmp, "glance.mjs");
fs.writeFileSync(modPath, src, "utf8");

const mod = await import(pathToFileURL(modPath).href);

/* v1.8.6：动作类型标签来自精简索引；这里把仓库里的真索引拷成 .mjs 后注入（不测懒加载，只测渲染）。
 * 结构 { v:1, c:[[使用频率,动作类型]…], p:{威能id: 组合下标} }。 */
const idxPath = path.join(tmp, "card-index.mjs");
fs.copyFileSync(path.join(ROOT, "data", "card-index.js"), idxPath);
const idxMod = await import(pathToFileURL(idxPath).href);
const IDX = idxMod.CARD_INDEX || idxMod.default;
mod.setCardIndex(IDX);
if (mod.cardIndex() && IDX && IDX.v === 1 && Array.isArray(IDX.c) && IDX.p) ok("注入 v1.8.6 精简索引（" + Object.keys(IDX.p).length + " 个威能）");
else bad("精简索引注入失败（data/card-index.js 结构不是 {v,c,p}）");

const file = process.argv[2] || path.join(ROOT, "samples", "sample-card.json");
const save = JSON.parse(fs.readFileSync(file, "utf8"));
const char = save.pages.character;
const d = mod.deriveGlance(char);

console.log("== 卡:", char.name, "Lv" + char.level, "|", char.raceId, "|", char.classId, char.hybrid ? "+" + char.classId2 : "");
console.log("职业数据:", JSON.stringify(d.cls));
console.log("属性:", JSON.stringify(d.abilities), "调整:", JSON.stringify(d.mods));
console.log("HP:", d.hpCur + "/" + d.maxHp, "血怒", d.bloodied, "回复值", d.surgeValue, "回复力", d.surgesCur + "/" + d.surges);
console.log("防御:", d.defenses.map((x) => x.label + " " + x.value).join("  "));
console.log("先攻", d.initiative, "被动侦查", d.passivePerception, "被动洞察", d.passiveInsight, "移动", d.speed);
console.log("技能:", d.skills.map((s) => s.name + (s.trained ? "*" : "") + " " + s.total).join(" "));
console.log("攻击:", d.attacks.map((a) => (a.label || "?") + " " + a.total).join(" | "));
console.log("伤害:", d.damages.map((a) => (a.dice || "-") + a.total).join(" | "));
console.log("威能组:", d.powers.filter((g) => g.list.length).map((g) => g.label + " " + g.list.length).join(" / "));
console.log("专长", d.feats.length, "装备", d.equipRows.length, JSON.stringify(d.equipRows.slice(0, 3)));
const html = mod.renderGlanceHTML(char);
fs.writeFileSync(path.join(tmp, "glance.html"), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="' + pathToFileURL(path.join(ROOT, "assets", "glance.css")).href + '">' + html, "utf8");
console.log("HTML 长度", html.length, "->", path.join(tmp, "glance.html"));
console.log("data 告警:", JSON.stringify(d.known));

/* =========================================================================
 * v1.7.12 断言
 * ========================================================================= */
console.log("\n== v1.7.12 威能 / 装备全部可点 + 共享数据");

const BASE_HP = { cur: 171, max: 171, temp: 0, surges: 8 };
const BASE_STATE = {
  powerUsed: {}, featUsed: {}, equipmentUsed: {},
  itemDailyUsed: 0, actionPoints: 1, milestones: 0
};
const liveOf = (state, hp) => ({ hp: hp || BASE_HP, state: state || BASE_STATE });
const render = (state, hp, editable) => mod.renderGlanceHTML(char, {
  mode: "compact",
  live: liveOf(state, hp),
  editable: editable || { hp: true, track: true, rest: true }
});
const section = (h, cls) => {
  const at = h.indexOf('<section class="gl4-card ' + cls + '">');
  if (at < 0) return "";
  const end = h.indexOf("</section>", at);
  return end < 0 ? h.slice(at) : h.slice(at, end);
};
const count = (s, re) => (s.match(re) || []).length;

const liveHtml = render();
const powersHtml = section(liveHtml, "gl4-powers");
const itemsHtml = section(liveHtml, "gl4-items");
const vitalsHtml = section(liveHtml, "gl4-vitals");
const headHtml = liveHtml.slice(liveHtml.indexOf('<header class="gl4-head">'), liveHtml.indexOf("</header>") + 9);

/* ---- 1) 威能：每个追踪组的每个 chip 都是 data-act="power" ---- */
const TORACKED = ["遭遇威能", "每日威能", "辅助威能", "种族/职业威能"];
const groups = powersHtml.split('<div class="gl4-pgroup">').slice(1).map(function (seg) {
  const m = /<\/span>([^<]+)<span class="gl4-pcount">([^<]*)<\/span>/.exec(seg);
  return { label: m ? m[1] : "", count: m ? m[2] : "", seg: seg };
});
const byLabel = {};
d.powers.forEach((g) => { byLabel[g.label] = g; });
if (groups.length === d.powers.filter((g) => g.list.length).length) ok("威能组渲染完整：" + groups.map((g) => g.label).join(" / "));
else bad("威能组数量不对：" + groups.length + "（应为 " + d.powers.filter((g) => g.list.length).length + "）");

for (const label of TORACKED) {
  const g = groups.filter((x) => x.label === label)[0];
  const spec = byLabel[label];
  if (!g || !spec) { bad("缺少威能组：" + label); continue; }
  const chip = count(g.seg, /class="gl4-chip(?: used)?"/g);
  const btn = count(g.seg, /data-act="power"/g);
  const used = count(g.seg, /class="gl4-chip used/g);
  if (chip === spec.list.length && btn === chip && used === 0) ok(label + "：" + chip + " / " + chip + " 个 chip 全部可点（data-act=\"power\"），默认未用");
  else bad(label + "：chip=" + chip + " button=" + btn + " used=" + used + "（应 chip=button=" + spec.list.length + "，used=0）");
}

const atWill = groups.filter((x) => x.label === "随意威能")[0];
if (atWill) {
  const chip = count(atWill.seg, /class="gl4-chip(?: used)?"/g);
  const btn = count(atWill.seg, /data-act="power"/g);
  if (chip > 0 && btn === 0 && atWill.count === "无限") ok("随意威能保持纯展示：" + chip + " 个 chip，0 个 data-act（不追踪）");
  else bad("随意威能不该可点：chip=" + chip + " button=" + btn + " count=" + atWill.count);
}

const allPowerKeys = [];
for (const m of powersHtml.matchAll(/data-k="([^"]+)"/g)) allPowerKeys.push(m[1]);
if (allPowerKeys.length && new Set(allPowerKeys).size === allPowerKeys.length) ok("威能 chip 的 data-k 唯一（" + allPowerKeys.length + " 个）");
else bad("威能 data-k 缺失或重复：" + JSON.stringify(allPowerKeys));

/* ---- 2) 装备：每一行都可点，默认 0 / N ---- */
const itemBtns = count(itemsHtml, /class="gl4-item(?: used)?" data-act="equipment"/g);
const itemRows = count(itemsHtml, /class="gl4-item(?: used)?"/g);
const itemKeys = Array.from(itemsHtml.matchAll(/data-k="([^"]+)"/g)).map((m) => m[1]);
if (itemBtns === d.equipRows.length && itemRows === d.equipRows.length) ok("装备/魔法物品：" + d.equipRows.length + " 行全部可点（data-act=\"equipment\"）");
else bad("装备可点行数不对：button=" + itemBtns + " row=" + itemRows + "（应 " + d.equipRows.length + "）");
if (itemKeys.length === d.equipRows.length && itemKeys.every((k) => k.indexOf(":") > 0)) ok("装备 data-k 用稳定 id（前缀:物品id:序号）");
else bad("装备 data-k 不是稳定 id：" + JSON.stringify(itemKeys.slice(0, 3)));
if (itemsHtml.indexOf("已用 0 / " + d.equipRows.length) >= 0 && count(itemsHtml, /gl4-item used/g) === 0)
  ok("默认状态：装备已用 0 / " + d.equipRows.length + "（没有 used 样式）");
else bad("默认装备计数不对（应为 已用 0 / " + d.equipRows.length + "）");

/* ---- 2b) v1.8.6：装备行没有物品等级档位（L2 7 12…） ---- */
if (itemsHtml.indexOf("gl4-lv") < 0 && !/<span class="gl4-lv">L\d/.test(itemsHtml))
  ok("装备行没有物品等级档位（只保留槽位 / 名称 / 增强 +N）");
else bad("装备行还有物品等级档位（L…）");

/* ---- 2c) v1.8.6：威能动作类型标签（需要注入精简索引后才有） ---- */
const actCount = count(liveHtml, /class="gl4-act"/g);
if (actCount >= 10) ok("威能动作类型标签 ≥10 处（实际 " + actCount + "）");
else bad("威能动作类型标签只有 " + actCount + " 处（应 ≥10）");
for (const act of ["标准动作", "即时反应", "移动动作", "自由动作"]) {
  if (liveHtml.indexOf(act) >= 0) ok("动作类型出现：" + act);
  else bad("渲染里没有动作类型：" + act);
}

/* ---- 2d) v1.8.6：tooltip 不再拼「攻击：… / 命中：…」 ---- */
if (liveHtml.indexOf("攻击：") < 0 && liveHtml.indexOf("命中：") < 0) ok("title 不再拼攻击 / 命中（tooltip 已去掉）");
else bad("tooltip 里还有攻击 / 命中文本");

/* ---- 3) v1.8.6：专长区块整块不渲染 ---- */
if (liveHtml.indexOf("gl4-feats") < 0 && liveHtml.indexOf('class="gl4-chip feat"') < 0 &&
  liveHtml.indexOf('class="gl4-tag"') < 0) {
  ok("专长区块整块不渲染（没有 gl4-feats / feat chip / 每日·赠送标记）");
} else bad("专长区块还在渲染");

/* ---- 4) 老 key 忽略 + 有效 key 只算一次 ---- */
const junkState = Object.assign({}, BASE_STATE, {
  powerUsed: { "utility-0": true, "bogus-9": true },
  equipmentUsed: { "e-0": true, "e-1": true, "w-3": true }
});
const junkHtml = render(junkState);
const junkItems = section(junkHtml, "gl4-items");
const junkPowers = section(junkHtml, "gl4-powers");
if (junkItems.indexOf("已用 0 / " + d.equipRows.length) >= 0)
  ok("旧版按下标写的装备 key（e-0 / e-1 / w-3）被忽略，不显示为已用");
else bad("旧装备 key 被当成已用了");
const utility = byLabel["辅助威能"];
if (junkPowers.indexOf(utility.list.length - 1 + " / " + utility.list.length) >= 0)
  ok("有效威能 key（utility-0）照常计入：辅助威能 " + (utility.list.length - 1) + " / " + utility.list.length);
else bad("有效威能 key 没有计入 / 计数不对");

const validKey = d.equipRows[0].key;
const oneState = Object.assign({}, BASE_STATE, { equipmentUsed: { [validKey]: true } });
const oneHtml = render(oneState);
const oneItems = section(oneHtml, "gl4-items");
if (oneItems.indexOf("已用 1 / " + d.equipRows.length) >= 0 && count(oneItems, /gl4-item used/g) === 1)
  ok("点一件装备 = 已用 1 / " + d.equipRows.length + "（稳定 key 命中）");
else bad("装备有效 key 没有命中 / 计数不对");

/* ---- 5) 共享数据：在顶部、不在 HP 区、开关方向正确 ---- */
if (headHtml.indexOf("gl4-share") >= 0 && headHtml.indexOf("共享数据") >= 0)
  ok("「共享数据」chip 在顶部标题区右侧");
else bad("顶部标题区没有「共享数据」chip");
if (vitalsHtml.indexOf("共享数据") < 0 && vitalsHtml.indexOf('data-act="lock"') < 0)
  ok("HP 区不再有「共享数据 / 玩家端隐藏数字」按钮");
else bad("HP 区还留着共享数据 / 锁按钮");

const offHtml = render(BASE_STATE, Object.assign({}, BASE_HP, { locked: true }));
const onHtml = render(BASE_STATE, Object.assign({}, BASE_HP, { locked: false }));
const offChip = /<button type="button" class="gl4-share[^"]*"[^>]*data-act="lock"[^>]*>([\s\S]*?)<\/button>/.exec(offHtml);
const onChip = /<button type="button" class="gl4-share[^"]*"[^>]*data-act="lock"[^>]*>([\s\S]*?)<\/button>/.exec(onHtml);
if (offChip && offChip[0].indexOf("gl4-share on") < 0 && offChip[0].indexOf('aria-pressed="false"') >= 0 &&
  offChip[0].indexOf("共享数据：关") >= 0 && offChip[1].indexOf("🔒") >= 0)
  ok("默认（hp.locked=true）：共享数据 = 关，🔒，不开精确数字");
else bad("默认共享数据状态不对：" + (offChip ? offChip[0].slice(0, 180) : "没渲染出来"));
if (onChip && onChip[0].indexOf("gl4-share on") >= 0 && onChip[0].indexOf('aria-pressed="true"') >= 0 &&
  onChip[0].indexOf("共享数据：开") >= 0 && onChip[1].indexOf("🔓") >= 0)
  ok("hp.locked=false：共享数据 = 开，🔓，全桌显示精确数字（方向正确）");
else bad("共享数据开启状态不对：" + (onChip ? onChip[0].slice(0, 180) : "没渲染出来"));

const readonly = render(BASE_STATE, BASE_HP, { hp: false, track: true, rest: false });
if (readonly.indexOf("gl4-share") < 0) ok("只读形态（改不了 token）不显示共享开关");
else bad("只读形态还显示共享开关");

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
