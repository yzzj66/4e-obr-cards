// 渲染层自检：把 assets/glance.js 复制成 .mjs（改写 import 路径）后在 Node 里跑一遍。
// 用法：node dev/test-glance.mjs [卡片 JSON 路径]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const tmp = path.join(os.tmpdir(), "4enext-glance-test");
fs.mkdirSync(tmp, { recursive: true });

const rulesPath = pathToFileURL(path.join(ROOT, "data", "rules.js")).href;
let src = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
src = src.replace('from "../data/rules.js"', 'from ' + JSON.stringify(rulesPath));
const modPath = path.join(tmp, "glance.mjs");
fs.writeFileSync(modPath, src, "utf8");

const mod = await import(pathToFileURL(modPath).href);
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
