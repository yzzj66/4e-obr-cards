// 生成 data/card-index.js：速览页威能 chip 的「使用频率 / 动作类型」轻量索引（v1.8.6）。
// ---------------------------------------------------------------------------
// 为什么单独建索引：
//   速览页的威能 chip 会显示动作类型（标准动作 / 即时反应 / 移动动作 / 自由动作 …）。
//   这个字段在 4E NEXT 导出的角色卡里**没有**（卡里只有词条 id），必须查词条库；
//   完整 power.json 约 19MB 太大，这里只裁出「使用频率 + 动作类型」两列。
//
// v1.8.6 瘦身（用户确认）：
//   · 不再收录攻击 / 命中正文（tooltip 已去掉，省 ~560KB）；
//   · 不再生成专长频率（专长区块整块不显示）；
//   · 用「组合表 + 下标」压到 ~300KB：powers 的值只是 c 数组的下标。
//
// 输入：<4E-NEXT>/out/categories/power.json
// 用法：node dev/gen-card-index.mjs
//       FOUR_E_SRC=<4E-NEXT-main 目录> node dev/gen-card-index.mjs
// 产物：data/card-index.js（ESM，`export const CARD_INDEX`；已提交进仓库，运行时不依赖 4E NEXT 源码）
//
// 结构：
//   { v: 1,
//     c: [[使用频率, 动作类型], …],          // 去重后的组合表（如 ["随意","标准动作"]）
//     p: { 威能id: c 的下标 } }              // 速览按 id 查下标，再取 c[下标]
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

/** 去掉标签 / HTML 实体，压成一行纯文本（动作类型字段偶有 `<br>` 脏数据）。 */
function cleanText(s) {
  return String(s == null ? "" : s)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const USAGE_ZH = { "at-will": "随意", encounter: "遭遇", daily: "每日" };

/* ---- 组合表 + 下标：powers 的值只占 1~3 个字符，能压到 ~300KB ---- */
const combos = [];
const comboIndex = new Map();
const powers = {};
let skipped = 0;

for (const e of readJson(path.join(SRC, "out", "categories", "power.json"))) {
  const id = e && typeof e.id === "string" ? e.id : "";
  if (!id) continue;
  const usage = cleanText(e.usageZh || USAGE_ZH[e.usage] || "").slice(0, 8);
  const action = cleanText(e.actionType || "").slice(0, 24);
  if (!usage && !action) { skipped++; continue; }
  const key = usage + "\u0001" + action;
  let ci = comboIndex.get(key);
  if (ci === undefined) {
    ci = combos.length;
    comboIndex.set(key, ci);
    combos.push([usage, action]);
  }
  powers[id] = ci;
}

/* ---- 输出（文件头写清自动生成 / 来源 / 重生成命令 / 结构） ---- */
const header =
  "// 自动生成，请勿手改。重新生成：node dev/gen-card-index.mjs（可用 FOUR_E_SRC 指到 4E-NEXT-main）\n" +
  "// 来源：4E NEXT out/categories/power.json（" + path.basename(SRC) + "）\n" +
  "// 用途：速览页威能 chip 的「使用频率 / 动作类型」标签；由 assets/glance.js 按需加载。\n" +
  "// 结构：{ v:1, c:[[使用频率, 动作类型], …], p:{ 威能id: c 的下标 } }。\n" +
  "// 不含攻击 / 命中正文与专长频率（v1.8.6 用户确认去掉）。\n";
const body = JSON.stringify({ v: 1, c: combos, p: powers });
const text = header + "export const CARD_INDEX = " + body + ";\n\nexport default CARD_INDEX;\n";

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text, "utf8");
const bytes = fs.statSync(OUT).size;
const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log("== gen-card-index");
console.log("  powers :", Object.keys(powers).length, "（跳过无频率/动作 " + skipped + "）");
console.log("  combos :", combos.length);
console.log("  wrote  :", path.relative(ROOT, OUT), bytes + " bytes（" + kb(bytes) + "）");
if (bytes > 350 * 1024) {
  console.error("  [warn] 产物超过 350KB 目标（" + kb(bytes) + "），请检查是否混入了正文列");
  process.exitCode = 1;
}
