// 静态自检：JSON 合法性、HTML 引用的本地文件是否存在、JS 的 import 是否都能解析到文件。
// 用法：node dev/check.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
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

// ESM 页面脚本的语法自检。
// 不能 spawn 一个 node --check（有些环境禁止子进程管道），所以这里把 import/export 剥掉、
// 用 vm.Script 解析一遍 —— 只能查语法，不执行，够用来兜住「引号没闭合 / 括号不配对」这类事故。
console.log("== ESM 页面脚本语法");
for (const f of ["assets/common.js", "assets/glance.js", "assets/track.js", "assets/info.js", "assets/panel.js", "assets/bind.js", "assets/button.js", "assets/index.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  let body = src.replace(/^\s*import\s+[^;]*?from\s+["'][^"']+["'];?\s*$/gm, "");
  body = body.replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, "");
  body = body.replace(/\bexport\s+default\s+/g, "var __default__ = ");
  // import.meta 在 vm.Script 里不合法（模块专用），换成一个普通对象顶上去
  body = body.replace(/\bimport\.meta\b/g, "({ url: \"about:blank\" })");
  body = body.replace(/\bexport\s+(async\s+function|function|const|let|var|class)\b/g, "$1");
  try {
    new vm.Script(body, { filename: f });
    ok(f + " 语法通过");
  } catch (e) {
    bad(f + " 语法错误：" + e.message);
  }
}

console.log("== 目录内容");
for (const p of ["manifest.json", "manifest.relative.json", "background.html", "panel.html", "info.html", "bind.html", "button.html", "index.html", "icon.svg", "icon-tool.svg", "README.md", "assets/glance.js", "assets/glance.css", "assets/track.js", "assets/background.core.js", "assets/background.bundle.js", "data/rules.js", "vendor/obr-sdk.js", "samples/sample-card.json", "docs/owlbear-debug.md", "docs/hp-bar-and-tracking.md"]) {
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

console.log("== manifest（绝对地址 + action）");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const isAbs = (u) => typeof u === "string" && /^https:\/\//.test(u);
const manUrls = [
  ["icon", man.icon],
  ["background_url", man.background_url],
  ["action.icon", man.action && man.action.icon],
  ["action.popover", man.action && man.action.popover]
];
for (const [label, url] of manUrls) {
  if (isAbs(url)) ok(label + " → " + url);
  else bad(label + " 不是绝对地址：" + url + "（Owlbear 可能按站点根解析相对路径）");
}
if (man.action && man.action.title) ok("action.title → " + man.action.title);
else bad("manifest 缺少 action（左上角入口没了 → 后台脚本坏掉时就没有任何入口）");
if (man.manifest_version === 1) ok("manifest_version = 1"); else bad("manifest_version 不是 1");
ok("version = " + man.version);

console.log("== background 单文件 bundle（经典脚本）");
const bundlePath = path.join(ROOT, "assets", "background.bundle.js");
const corePath = path.join(ROOT, "assets", "background.core.js");
if (exists(bundlePath)) {
  const src = fs.readFileSync(bundlePath, "utf8");
  if (/(^|\n)\s*export\s/.test(src)) bad("background.bundle.js 里还有 export"); else ok("没有 export 语句");
  if (/(^|\n)\s*import\s/.test(src)) bad("background.bundle.js 里还有 import"); else ok("没有 import 语句");
  try { new vm.Script(src, { filename: "background.bundle.js" }); ok("能按「经典脚本」解析"); }
  catch (e) { bad("经典脚本解析失败：" + e.message); }
  if (/var OBR = [\w$]+;/.test(src)) ok("已把 SDK 的 default 导出接成 OBR"); else bad("找不到 var OBR = ...;");
  if (exists(corePath)) {
    const coreTail = fs.readFileSync(corePath, "utf8").trim().slice(-160);
    if (src.indexOf(coreTail) >= 0) ok("bundle 与 background.core.js 同步");
    else bad("bundle 落后于 background.core.js —— 跑 node dev/build-background.mjs");
  }
} else bad("缺少 assets/background.bundle.js（跑 node dev/build-background.mjs）");

console.log("== v1.2.0 血量 / 资源追踪");
const trackPath = path.join(ROOT, "assets", "track.js");
if (exists(trackPath)) {
  const trackSrc = fs.readFileSync(trackPath, "utf8");
  if (/export const KEY_HP = NS \+ "\/hp";/.test(trackSrc)) ok("track.js 定义了 KEY_HP");
  else bad("track.js 里找不到 KEY_HP 定义");
  if (/export async function applyAction\(/.test(trackSrc)) ok("track.js 导出 applyAction（点击处理的唯一入口）");
  else bad("track.js 没有导出 applyAction");
  if (/export async function commitState\(/.test(trackSrc)) ok("track.js 导出 commitState（房间数据写不进去时退回本机）");
  else bad("track.js 没有导出 commitState");
  // 后台是经典脚本、不能 import，常量只能各写一份 —— 这里保证两边不会写歪
  if (exists(corePath)) {
    const coreSrc = fs.readFileSync(corePath, "utf8");
    const a = /var KEY_HP = NS \+ "([^"]+)";/.exec(coreSrc);
    if (!a) bad("background.core.js 里找不到 KEY_HP");
    else if (trackSrc.indexOf('NS + "' + a[1] + '"') < 0) bad("背景页的 KEY_HP 与 track.js 不一致：" + a[1]);
    else ok("背景页与 track.js 的 KEY_HP 一致（" + a[1] + "）");
  }
}
const bundleSrc2 = exists(bundlePath) ? fs.readFileSync(bundlePath, "utf8") : "";
for (const name of ["buildCurve", "buildShape", "buildText"]) {
  if (new RegExp("var " + name + " = [\\w$]+;").test(bundleSrc2)) ok("bundle 里接入了 SDK 具名导出 " + name);
  else bad("bundle 里没有 var " + name + " = ...;（血条画不出来，跑 node dev/build-background.mjs）");
}
if (/BAR_TAG/.test(bundleSrc2) && /scene\.local/.test(bundleSrc2)) ok("bundle 内含 token 血条（scene.local 本地图形层）");
else bad("bundle 里没有 token 血条代码（可能没重新构建）");
const cssSrc = exists(path.join(ROOT, "assets", "glance.css")) ? fs.readFileSync(path.join(ROOT, "assets", "glance.css"), "utf8") : "";
if (/\.gl4-hp-pad/.test(cssSrc) && /\.gl4-counter/.test(cssSrc) && /\.gl4-pips/.test(cssSrc)) ok("glance.css 含血量加减 / 计数器 / 回复力圆点样式");
else bad("glance.css 缺少 v1.2.0 的交互样式");

const bgHtml = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
if (/<script[^>]*type="module"/.test(bgHtml)) bad('background.html 里还有 <script type="module">');
else ok("background.html 没有 type=module，只加载一个脚本");
if (bgHtml.indexOf("background.bundle.js") >= 0) ok("background.html 引用了 background.bundle.js");
else bad("background.html 没有引用 background.bundle.js");

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
