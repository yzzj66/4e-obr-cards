// 生成 data/card-index.js：速览页要用的「轻量词条索引」（v1.8.1）。
// ---------------------------------------------------------------------------
// 为什么单独建索引：
//   4E NEXT 的速览页里，威能 chip 会显示动作类型（标准动作 / 即时反应 / …）、
//   hover 能看到攻击与命中；专长会标「每日 / 遭遇」。这些字段在 4E NEXT 导出的角色卡里
//   **没有**（卡里只有词条 id），必须查词条库。完整 power.json 19MB / feat.json 4MB 太大，
//   这里只裁出速览实际用到的几列，产物约 1MB，由 assets/glance.js 在打开速览时按需加载。
//
// 输入：<4E-NEXT>/out/categories/power.json 与 feat.json（装备物品等级用现有 data/rules.js，不用重导）。
// 用法：node dev/gen-card-index.mjs
//       FOUR_E_SRC=<4E-NEXT-main 目录> node dev/gen-card-index.mjs
// 产物：data/card-index.js（ESM，`export const CARD_INDEX`；已提交进仓库，运行时不依赖 4E NEXT 源码）
//
// 结构：
//   powers: { 威能id: [使用频率, 动作类型, 攻击行(≤90字), 命中行(≤90字)] }
//   feats:  { 专长id: "d" | "e" }   // d = 每日，e = 遭遇；都没有就不收录
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const OUT = path.join(ROOT, "data", "card-index.js");

/** 找 4E NEXT 源码根目录：环境变量优先，其次是本仓库常见的相对位置。 */
function findSource() {
  const candidates = [];
  if (process.env.FOUR_E_SRC) candidates.push(path.resolve(process.env.FOUR_E_SRC));
  candidates.push(path.resolve(ROOT, "..", "..", "4E-Patch", "archive", "4E-NEXT-main"));
  candidates.push(path.resolve(ROOT, "..", "4E-NEXT-main"));
  candidates.push(path.resolve(ROOT, "..", "..", "4E-NEXT-main"));
  for (const dir of candidates) {
    try {
      if (fs.statSync(path.join(dir, "out", "categories", "power.json")).isFile()) return dir;
    } catch (e) { /* 试下一个 */ }
  }
  throw new Error(
    "找不到 4E NEXT 源码里的 out/categories/power.json。\n" +
    "请设置 FOUR_E_SRC 指向 4E-NEXT-main 目录，例如：\n" +
    "  PowerShell: $env:FOUR_E_SRC='D:\\path\\to\\4E-NEXT-main'; node dev/gen-card-index.mjs\n" +
    "  bash:       FOUR_E_SRC=/path/to/4E-NEXT-main node dev/gen-card-index.mjs"
  );
}

const SRC = findSource();
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/* ---- HTML 行提取（与 notes/4enext-schema.md §6.3 的口径一致） ---- */
function stripHtml(s) {
  return String(s == null ? "" : s)
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
function detailsRows(details) {
  const out = [];
  const re = /<tr[^>]*>\s*<th>([\s\S]*?)<\/th>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
  let m;
  while ((m = re.exec(String(details || "")))) {
    const label = stripHtml(m[1]).replace(/[：:]\s*$/, "");
    out.push([label, stripHtml(m[2])]);
  }
  return out;
}
function firstRow(rows, exact, suffix) {
  for (const r of rows) if (exact.indexOf(r[0]) >= 0) return r[1];
  for (const r of rows) if (r[0].endsWith(suffix)) return r[1];
  return "";
}
function cut(s, n) {
  const t = String(s || "");
  return t.length > n ? t.slice(0, n) : t;
}

const USAGE_ZH = { "at-will": "随意", encounter: "遭遇", daily: "每日" };
const POWER_USAGE_OK = { 随意: 1, 遭遇: 1, 每日: 1 };

/* ---- 1) 威能 ---- */
const powersRaw = readJson(path.join(SRC, "out", "categories", "power.json"));
const powers = {};
let withAttack = 0;
for (const e of powersRaw) {
  const id = e && typeof e.id === "string" ? e.id : "";
  if (!id) continue;
  const rows = detailsRows(e.details);
  const attack = cut(firstRow(rows, ["攻击", "主攻击"], "攻击"), 90);
  const hit = cut(firstRow(rows, ["命中", "主命中"], "命中"), 90);
  const usage = String(e.usageZh || USAGE_ZH[e.usage] || "").trim();
  const action = String(e.actionType || "").trim();
  if (!usage && !action && !attack && !hit) continue;
  if (attack) withAttack++;
  powers[id] = [usage, action, attack, hit];
}

/* ---- 2) 专长频率：benefit / fields.special（私设再看 sourceText 的正文） ---- */
function featText(e) {
  const body = String(e.benefit || "") + " " + String((e.fields && e.fields.special) || "");
  const src = String(e.sourceText || "");
  /* 官方专长 sourceText 只是宏占位 <<feat-format>>，别把宏名当正文扫进去 */
  return body + " " + (/<<[^>]*>>/.test(src) && src.indexOf("feat-format") >= 0 ? "" : src);
}
const featsRaw = readJson(path.join(SRC, "out", "categories", "feat.json"));
const feats = {};
let daily = 0;
let encounter = 0;
for (const e of featsRaw) {
  const id = e && typeof e.id === "string" ? e.id : "";
  if (!id) continue;
  const text = featText(e);
  if (/每日|每天|一日一次/.test(text)) { feats[id] = "d"; daily++; }
  else if (/每次遭遇|每遭遇|该遭遇一次|遭遇一次/.test(text)) { feats[id] = "e"; encounter++; }
}

/* ---- 3) 输出 ---- */
const body = JSON.stringify({ powers: powers, feats: feats });
const header =
  "// 自动生成，请勿手改。重新生成：node dev/gen-card-index.mjs（可用 FOUR_E_SRC 指到 4E-NEXT-main）\n" +
  "// 来源：4E NEXT out/categories/{power,feat}.json（" + path.basename(SRC) + "）\n" +
  "// 用途：速览页「威能动作类型 / 攻击命中摘要」与「专长每日·遭遇标记」；由 assets/glance.js 按需加载。\n" +
  "// powers: [使用频率, 动作类型, 攻击行(≤90字), 命中行(≤90字)]；feats: \"d\"=每日 / \"e\"=遭遇。\n";
const text = header + "export const CARD_INDEX = " + body + ";\n\nexport default CARD_INDEX;\n";

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text, "utf8");
const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log("== gen-card-index");
console.log("  powers:", Object.keys(powers).length, "（有攻击行 " + withAttack + "）");
console.log("  feats :", Object.keys(feats).length, "（每日 " + daily + " / 遭遇 " + encounter + "）");
console.log("  wrote :", path.relative(ROOT, OUT), fs.statSync(OUT).size + " bytes（" + kb(fs.statSync(OUT).size) + "）");
