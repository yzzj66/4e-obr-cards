// 结构自检：渲染结果标签配平、CSS 大括号配平（无浏览器时的兜底检查）
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(os.tmpdir(), "p4e-render-check");
fs.mkdirSync(tmp, { recursive: true });
let src = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
src = src.replace('from "../data/rules.js"', "from " + JSON.stringify(pathToFileURL(path.join(ROOT, "data", "rules.js")).href));
const modPath = path.join(tmp, "glance.mjs");
fs.writeFileSync(modPath, src, "utf8");
const g = await import(pathToFileURL(modPath).href);

const save = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-card.json"), "utf8"));
// v1.2.0：除了原来的只读形态，还要检查「带实时状态 + 可交互」的形态 —— 血量加减与资源追踪的
// 按钮都是这里渲染出来的，标签没闭合会直接把弹窗画崩。
const LIVE = {
  hp: { cur: 120, max: 171, temp: 6, surges: 5 },
  state: {
    powerUsed: { "encounter-0": true, "daily-1": true },
    featUsed: { "0": true },
    equipmentUsed: { "e-5": true },
    itemDailyUsed: 1, actionPoints: 2, milestones: 1
  }
};
const VARIANTS = [
  { label: "full", opts: { mode: "full" } },
  { label: "compact", opts: { mode: "compact" } },
  { label: "full+live", opts: { mode: "full", live: LIVE, editable: { hp: true, track: true, rest: true } } },
  { label: "compact+live", opts: { mode: "compact", live: LIVE, editable: { hp: true, track: true, rest: true } } }
];
for (const { label: mode, opts } of VARIANTS) {
  const html = g.renderGlanceHTML(save.pages.character, opts);
  const stack = [];
  const re = /<(\/?)([a-z0-9]+)([^>]*?)(\/?)>/gi;
  let m;
  const errs = [];
  while ((m = re.exec(html))) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const self = m[4] === "/";
    if (["br", "img", "input", "meta", "link", "hr"].includes(tag) || self) continue;
    if (!closing) stack.push(tag);
    else {
      const top = stack.pop();
      if (top !== tag) errs.push("mismatch: expected </" + top + "> got </" + tag + ">");
    }
  }
  console.log(mode, "| len", html.length, "| unclosed", JSON.stringify(stack), "| errors", errs.slice(0, 5).join("; ") || "none");
  fs.writeFileSync(path.join(tmp, mode + ".html"), html, "utf8");
}

for (const f of ["assets/glance.css", "assets/ui.css"]) {
  const css = fs.readFileSync(path.join(ROOT, f), "utf8");
  let open = 0, close = 0;
  for (const ch of css) { if (ch === "{") open++; if (ch === "}") close++; }
  console.log(f, "braces", open, close, open === close ? "ok" : "MISMATCH");
}

const html = g.renderGlanceHTML(save.pages.character);
console.log("\n--- 片段 ---\n" + html.slice(0, 1200));
/* v1.7.6：先攻条**外壳透明**的静态核对（用户第二次报「背景还是深色」）。
 * 这里不启动浏览器，只核对「该透明的六层都写了 transparent !important」以及
 * 「该留底色的两处（控制行 / 卡片）还有底色」—— 人工验证方法见 docs/initiative-v14.md §14.1。
 * 失败时 exit 1，方便直接串进自测。 */
let stripFail = 0;
const stripBad = (m) => { stripFail++; console.log("  FAIL " + m); };
const uiSrc = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
const blockStart = uiSrc.indexOf("v1.7.6：先攻条外壳");
const blockEnd = uiSrc.indexOf("body.dragging, body.dragging .strip-grip");
const stripBlock = blockStart >= 0 && blockEnd > blockStart ? uiSrc.slice(blockStart, blockEnd) : "";
if (!stripBlock) stripBad("ui.css 里找不到 v1.7.6 的先攻条透明段");
else {
  const layers = ["#app", ".win", ".win-body", ".strip-root", ".strip", ".strip-items"];
  const miss = layers.filter((sel) => stripBlock.indexOf("body.strip-page " + sel) < 0);
  if (miss.length) stripBad("先攻条外壳这几层没有声明透明：" + miss.join(" / "));
  else console.log("  ok   先攻条外壳六层（#app / .win / .win-body / .strip-root / .strip / .strip-items）都在透明规则里");
  if (stripBlock.indexOf("background: transparent !important") < 0) stripBad("透明规则里没有 transparent !important");
  else console.log("  ok   透明规则用的是 background: transparent !important（能盖掉 ui.css 顶部的 html{background:var(--bg)}）");
}
if (!/\.strip-ctl \{[\s\S]*?rgba\(11, 15, 20, \.72\)/.test(uiSrc)) stripBad("控制行 .strip-ctl 的半透明底丢了");
else console.log("  ok   控制行 .strip-ctl 仍是半透明 rgba(11, 15, 20, .72)");
if (!/\.initiative-item \{[^}]*#141b23/.test(uiSrc)) stripBad("卡片 .initiative-item 的深色底丢了");
else console.log("  ok   卡片 .initiative-item 仍是不透明 #141b23");
if (stripFail) process.exitCode = 1;
