// 静态自检：JSON 合法性、HTML 引用的本地文件是否存在、JS 的 import 是否都能解析到文件。
// 用法：node dev/check.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (name !== ".git") walk(p, out); }
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
console.log("== JSON");
for (const f of files.filter((f) => f.endsWith(".json"))) {
  try { JSON.parse(fs.readFileSync(f, "utf8")); ok(path.relative(ROOT, f)); }
  catch (e) { bad(path.relative(ROOT, f) + " → " + e.message); }
}

console.log("== HTML 引用");
for (const f of files.filter((f) => f.endsWith(".html"))) {
  const src = fs.readFileSync(f, "utf8");
  const dir = path.dirname(f);
  const refs = [];
  const re = /(?:src|href)="([^"#]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    const u = m[1];
    if (/^(https?:|data:|mailto:|javascript:)/.test(u)) continue;
    refs.push(u);
  }
  for (const u of refs) {
    const p = path.resolve(dir, u.split("?")[0]);
    if (exists(p)) ok(path.relative(ROOT, f) + " → " + u);
    else bad(path.relative(ROOT, f) + " → 找不到 " + u);
  }
}

console.log("== JS import");
for (const f of files.filter((f) => f.endsWith(".js") && !f.includes("vendor"))) {
  const src = fs.readFileSync(f, "utf8");
  const re = /(?:^|\n)\s*import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const p = path.resolve(path.dirname(f), spec);
    if (exists(p)) ok(path.relative(ROOT, f) + " → " + spec);
    else bad(path.relative(ROOT, f) + " → 找不到 " + spec);
  }
}

console.log("== 目录内容");
for (const p of ["manifest.json", "background.html", "panel.html", "info.html", "bind.html", "button.html", "index.html", "icon.svg", "README.md", "assets/glance.js", "data/rules.js", "vendor/obr-sdk.js", "samples/sample-card.json"]) {
  if (exists(path.join(ROOT, p))) ok(p); else bad("缺少 " + p);
}


console.log("== DOM id 引用");
const PAGES = [
  ["panel.html", "assets/panel.js"],
  ["info.html", "assets/info.js"],
  ["bind.html", "assets/bind.js"],
  ["button.html", "assets/button.js"],
  ["index.html", "assets/index.js"]
];
for (const [html, js] of PAGES) {
  const h = fs.readFileSync(path.join(ROOT, html), "utf8");
  const s = fs.readFileSync(path.join(ROOT, js), "utf8");
  const ids = new Set();
  const re = /getElementById\("([^"]+)"\)/g;
  let m;
  while ((m = re.exec(s))) ids.add(m[1]);
  for (const id of ids) {
    // 有些元素是脚本里用 innerHTML 动态建出来的，脚本里同样写着 id="..."
    if (h.indexOf('id="' + id + '"') >= 0 || s.indexOf('id="' + id + '"') >= 0) ok(html + " 有 #" + id);
    else bad(html + " 缺少脚本引用的 #" + id + "（" + js + "）");
  }
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
