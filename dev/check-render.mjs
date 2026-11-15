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
