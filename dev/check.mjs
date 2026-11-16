// 静态自检：JSON 合法性、HTML 引用的本地文件是否存在、JS 的 import 是否都能解析到文件。
// 用法：node dev/check.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
/* [v1.7.7] docs 已经合并成一个 docs/NOTES.md（不再按版本 / 按规格拆文件）。
 * 老断言查的是「某个 docs/*.md 里写着某段话」——那些文件已经没了，硬查只会一直红。
 * 这里统一读合并后的 NOTES.md：维护口径（重建 bundle / 不自造 action / 键名不改 / 常数在哪）
 * 仍然逐条断言，「每个版本一个 md」的断言随文件一起退休（见文件末尾的「docs 合并」小节）。 */
const NOTES_PATH = path.join(ROOT, "docs", "NOTES.md");
const NOTES = exists(NOTES_PATH) ? fs.readFileSync(NOTES_PATH, "utf8") : "";
const notesHas = (s) => NOTES.indexOf(s) >= 0;
/* 当前版本号：所有「版本全链路」断言都读它，升版本只改这一处（+ 各文件里的真实版本号）。 */
const VER = "1.8.7";

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
    /* v1.7.13：import 允许带 ?v=缓存查询串（file 解析时把 query 去掉再查文件）。 */
    const p = path.resolve(path.dirname(f), spec.split("?")[0]);
    if (exists(p)) ok(path.relative(ROOT, f) + " → " + spec);
    else bad(path.relative(ROOT, f) + " → 找不到 " + spec);
  }
}

// ESM 页面脚本的语法自检。
// 不能 spawn 一个 node --check（有些环境禁止子进程管道），所以这里把 import/export 剥掉、
// 用 vm.Script 解析一遍 —— 只能查语法，不执行，够用来兜住「引号没闭合 / 括号不配对」这类事故。
console.log("== ESM 页面脚本语法");
for (const f of ["assets/common.js", "assets/glance.js", "assets/track.js", "assets/initiative.js", "assets/window.js", "assets/info.js", "assets/panel.js", "assets/initiative-page.js", "assets/dice-core.js", "assets/dice-4e.js", "assets/dice-page.js", "assets/dice-history-page.js", "assets/effect-page.js", "assets/settings-page.js", "assets/hp-edit-core.js", "assets/hp-edit-page.js", "assets/bind.js", "assets/button.js", "assets/index.js"]) {
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
for (const p of ["manifest.json", "manifest.relative.json", "background.html", "panel.html", "info.html", "initiative.html", "dice.html", "dice-history.html", "effect.html", "hp-edit.html", "settings.html", "bind.html", "button.html", "index.html", "icon.svg", "icon-tool.svg", "icon-tool-initiative.svg", "icon-tool-dice.svg", "icon-tool-glance.svg", "icon-tool-settings.svg", "README.md", "assets/glance.js", "assets/glance.css", "assets/track.js", "assets/window.js", "assets/panel.js", "assets/initiative-page.js", "assets/dice-core.js", "assets/dice-4e.js", "assets/dice-page.js", "assets/dice-history-page.js", "assets/effect-page.js", "assets/settings-page.js", "assets/hp-edit-core.js", "assets/hp-edit-page.js", "assets/background.core.js", "assets/background.bundle.js", "data/rules.js", "vendor/obr-sdk.js", "samples/sample-card.json", "docs/NOTES.md"]) {
  if (exists(path.join(ROOT, p))) ok(p); else bad("缺少 " + p);
}


console.log("== DOM id 引用");
const PAGES = [
  ["panel.html", "assets/panel.js"],
  ["info.html", "assets/info.js"],
  ["initiative.html", "assets/initiative-page.js"],
  ["dice.html", "assets/dice-page.js"],
  ["dice-history.html", "assets/dice-history-page.js"],
  ["effect.html", "assets/effect-page.js"],
  ["hp-edit.html", "assets/hp-edit-page.js"],
  ["settings.html", "assets/settings-page.js"],
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
  ["background_url", man.background_url]
];
for (const [label, url] of manUrls) {
  if (isAbs(url)) ok(label + " → " + url);
  else bad(label + " 不是绝对地址：" + url + "（Owlbear 可能按站点根解析相对路径）");
}
if (man.action && man.action.title) ok("action.title → " + man.action.title);
  // [v1.6.1 移除] manifest 不再带 action（真机验证：无 action 也能加载；入口由工具栏 tool 提供）// else bad("manifest 缺少 action（左上角入口没了 → 后台脚本坏掉时就没有任何入口）");
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
  const lastLine = src.trim().split("\n").pop().trim();
  if (lastLine === "})();") ok("bundle 以 })(); 正常收尾（没被截断）");
  else bad("bundle 结尾不是 })();（文件可能被截断）：" + lastLine);
  if (/var OBR = [\w$]+;/.test(src)) ok("已把 SDK 的 default 导出接成 OBR"); else bad("找不到 var OBR = ...;");
  if (exists(corePath)) {
    const coreTail = fs.readFileSync(corePath, "utf8").trim().slice(-160);
    if (src.indexOf(coreTail) >= 0) ok("bundle 与 background.core.js 同步");
    else bad("bundle 落后于 background.core.js —— 跑 node dev/build-background.mjs");
  }
} else bad("缺少 assets/background.bundle.js（跑 node dev/build-background.mjs）");

console.log("== 后台心跳（ping / pong 频道）");
{
  const coreSrc = exists(corePath) ? fs.readFileSync(corePath, "utf8") : "";
  const commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const chan = (src, kw, name) => {
    const re = new RegExp(kw + " " + name + ' = NS \\+ "([^"]+)";');
    const m = re.exec(src);
    return m ? m[1] : "";
  };
  for (const name of ["CH_HELLO", "CH_PING", "CH_PONG"]) {
    const a = chan(coreSrc, "var", name);
    const b = chan(commonSrc, "export const", name);
    if (a && a === b) ok("心跳频道一致：" + name + " = " + a);
    else bad("心跳频道不一致：" + name + " core=" + a + " common=" + b);
  }
  if (/broadcast\.onMessage\(CH_PING/.test(coreSrc) && /sendHello\(CH_PONG/.test(coreSrc))
    ok("后台订阅 diag-ping 并回 diag-pong（面板能拿到 pong）");
  else bad("后台没有订阅 diag-ping / 没有回 diag-pong（面板会显示「后台脚本没有响应」）");
  if (/OBR\.onReady\(boot\)/.test(coreSrc)) ok("background.core.js 把 boot 交给 OBR.onReady（启动入口在）");
  else bad("background.core.js 没有启动入口：boot 不会跑，ping 永远等不到 pong");
  if (exists(bundlePath)) {
    const bsrc = fs.readFileSync(bundlePath, "utf8");
    if (/OBR\.onReady\(boot\)/.test(bsrc)) ok("bundle 里也带启动入口（与 core 同步）");
    else bad("bundle 里没有启动入口（没重新构建？跑 node dev/build-background.mjs）");
  }
}

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
    /* v1.8.4：common.js 的 bindToken 也要写 HP（绑卡播种），常量必须与后台 / track 逐字一致 */
    const commonHpSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
    const c = /export const KEY_HP = NS \+ "([^"]+)";/.exec(commonHpSrc);
    if (a && c && c[1] === a[1]) ok("common.js 的 KEY_HP 与 background.core.js 一致（" + c[1] + "，绑卡播种用）");
    else bad("common.js 的 KEY_HP 不一致：common=" + (c && c[1]) + " core=" + (a && a[1]));
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

console.log("== v1.2.1 UI 微调");
const coreSrc2 = fs.readFileSync(corePath, "utf8");
const infoW = /var INFO_W = (\d+);/.exec(coreSrc2);
const infoH = /var INFO_H = (\d+);/.exec(coreSrc2);
if (infoW && +infoW[1] >= 620 && +infoW[1] <= 680) ok("速览弹窗宽度 INFO_W = " + infoW[1] + "（620~680）");
else bad("INFO_W 不在 620~680：" + (infoW ? infoW[1] : "background.core.js 里找不到 INFO_W"));
if (infoH && +infoH[1] >= 640 && +infoH[1] <= 760) ok("速览弹窗高度 INFO_H = " + infoH[1] + "（640~760）");
else bad("INFO_H 不在 640~760：" + (infoH ? infoH[1] : "background.core.js 里找不到 INFO_H"));
if (/viewport\.getWidth\(\)/.test(coreSrc2) && /INFO_MIN_W/.test(coreSrc2)) ok("弹窗宽高按视口夹紧（小屏不超出）");
else bad("弹窗没有按视口夹紧（小屏可能超出视口）");
const glanceSrc = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
if (!/data-act="feat"/.test(glanceSrc)) ok("专长不再生成可点按钮（纯展示）");
else bad("glance.js 里还有 data-act=\"feat\"（专长仍可点）");
if (glanceSrc.indexOf('"已用 " + used + " / " + d.feats.length') < 0) ok("专长不再显示「已用 x / y」");
else bad("glance.js 里还有专长的「已用」计数");
if (glanceSrc.indexOf('counter("每日威能"') < 0) ok("装备栏不再有「每日威能」计数器");
else bad("glance.js 里还有 counter(\"每日威能\")");
if (/\.gl4-resline/.test(cssSrc) && /\.gl4-sep/.test(cssSrc) && /flex-wrap:\s*nowrap/.test(cssSrc))
  ok("glance.css 含行动点 / 里程碑同排样式（.gl4-resline + nowrap）");
else bad("glance.css 缺少 .gl4-resline / .gl4-sep 或 nowrap");
const commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
const verOf = (src) => (/PLUGIN_VERSION = "([^"]+)"/.exec(src) || [])[1] || "";
if (verOf(commonSrc) === man.version && verOf(coreSrc2) === man.version) ok("版本号一致：manifest / common.js / background.core.js = " + man.version);
else bad("版本号不一致：manifest=" + man.version + " common=" + verOf(commonSrc) + " core=" + verOf(coreSrc2));

console.log("== v1.2.2 弹窗可拖动");
const infoSrc = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
const infoHtml = fs.readFileSync(path.join(ROOT, "info.html"), "utf8");
const uiCss = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
const coreKey = (/var INFO_POS_KEY = "([^"]+)";/.exec(coreSrc2) || [])[1] || "";
const commonKey = (/export const INFO_POS_KEY = "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (coreKey === "4enext/info-pos" && commonKey === coreKey) ok("弹窗位置键一致：" + coreKey);
else bad("弹窗位置键不一致：core=" + coreKey + " common=" + commonKey);
const coreCh = (/var CH_INFO_DRAG = NS \+ "([^"]+)";/.exec(coreSrc2) || [])[1] || "";
const commonCh = (/export const CH_INFO_DRAG = NS \+ "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (coreCh && commonCh === coreCh) ok("拖动频道一致：" + coreCh);
else bad("拖动频道不一致：core=" + coreCh + " common=" + commonCh);
if (/broadcast\.onMessage\(CH_INFO_DRAG/.test(coreSrc2) && /function onInfoDrag\(/.test(coreSrc2))
  ok("后台订阅并处理拖动频道");
else bad("后台没有订阅 / 处理拖动频道");
if (/anchorOrigin: \{ horizontal: "LEFT", vertical: "TOP" \}/.test(coreSrc2) &&
  /transformOrigin: \{ horizontal: "LEFT", vertical: "TOP" \}/.test(coreSrc2) &&
  /localStorage\.setItem\(INFO_POS_KEY/.test(coreSrc2) && /localStorage\.getItem\(INFO_POS_KEY/.test(coreSrc2))
  ok("弹窗统一按左上角定位，位置读写 localStorage");
else bad("弹窗定位原点不是 LEFT/TOP，或没有读写位置");
if (/function clampInfoPos\(/.test(coreSrc2) && /INFO_VIEW_MARGIN/.test(coreSrc2)) ok("拖动位置按视口夹取");
else bad("拖动位置没有视口夹取");
if (/headEl\.addEventListener\("pointerdown"/.test(infoSrc) && /addEventListener\("pointermove"/.test(infoSrc) &&
  /INFO_DRAG_THROTTLE_MS/.test(infoSrc) && /sendDrag\("reset"/.test(infoSrc))
  ok("弹窗页收了 pointerdown / pointermove（节流）并带「回到 token」");
else bad("弹窗页缺少拖动事件 / 节流 / 回到 token");
if (/ev\.screenX - drag\.x0/.test(infoSrc) && /ev\.screenY - drag\.y0/.test(infoSrc) && !/ev\.clientX - drag\.x0/.test(infoSrc))
  ok("拖动位移用屏幕坐标（client 坐标会被弹窗位移抵消）");
else bad("拖动位移没有用 screenX/screenY（弹窗跟着指针走时 client 坐标会被抵消，拖起来会抖）");
if (infoHtml.indexOf('id="head"') >= 0 && infoHtml.indexOf('id="pin"') >= 0) ok("速览弹窗有拖动区 #head 与 #pin");
else bad("info.html 缺少 #head / #pin");
if (/\.pop-head \{ cursor: move;/.test(uiCss) && /body\.dragging/.test(uiCss)) ok("ui.css 有拖动区光标 / 拖动中样式");
else bad("ui.css 缺少拖动光标 / 拖动中样式");
/* [v1.7.7] docs 合并：拖动说明并进 NOTES.md（见文件末尾的「docs 合并」小节） */
if (notesHas("窗口默认尺寸")) ok("docs/NOTES.md：窗口位置 / 尺寸的维护口径还在（拖动相关的入口）");
else bad("docs/NOTES.md 缺少「窗口默认尺寸」这一行");

console.log("== v1.3.1 分块：各自独立窗口（没有三 tab）");
const bgHtmlV131 = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
const manRel = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.relative.json"), "utf8"));
if (man.name === "4eNEXT to owlbear") ok("manifest.name = 4eNEXT to owlbear");
else bad("manifest.name 不是 4eNEXT to owlbear：" + man.name);
if (manRel.name === man.name) ok("manifest.relative.json 名字一致");
else bad("manifest.relative.json 名字不一致：" + manRel.name);
if (man.version === VER && manRel.version === man.version) ok("版本 1.7.8（绝对 + 相对 manifest）");
else bad("版本不是 1.7.5：" + man.version + " / " + manRel.version);

/* ---- 1) 三 tab 合并必须拆干净（用户明确不要） ---- */
const panelHtmlV131 = fs.readFileSync(path.join(ROOT, "panel.html"), "utf8");
const panelSrcV131 = fs.readFileSync(path.join(ROOT, "assets", "panel.js"), "utf8");
const coreSrcV131 = fs.readFileSync(corePath, "utf8");
if (panelHtmlV131.indexOf('data-tab=') < 0 && panelHtmlV131.indexOf('class="tabs"') < 0 &&
  panelHtmlV131.indexOf("tab-pane") < 0 && panelHtmlV131.indexOf("role=\"tab\"") < 0)
  ok("panel.html 里没有 tab / tab-pane（v1.3.0 的三 tab 合并已拆掉）");
else bad("panel.html 里还有 tab / tab-pane（三 tab 合并没拆干净）");
if (!/function setTab\(/.test(panelSrcV131) && panelSrcV131.indexOf("tab-pane") < 0 && panelSrcV131.indexOf("activeTab") < 0)
  ok("panel.js 里没有 tab 切换代码");
else bad("panel.js 里还有 tab 切换代码");
if (!/\.tab-pane/.test(uiCss) && !/\.tabs \{/.test(uiCss) && !/\.tab\.on/.test(uiCss))
  ok("ui.css 里没有 tab 样式");
else bad("ui.css 里还留着 tab 样式");

/* ---- 2) 三个（其实是四个）独立页面都在 ---- */
const INDEPENDENT = [
  { html: "info.html", js: "assets/info.js", label: "速览", title: "4eNEXT to owlbear" },
  { html: "initiative.html", js: "assets/initiative-page.js", label: "先攻", title: "4eNEXT to owlbear" },
  { html: "dice.html", js: "assets/dice-page.js", label: "骰子", title: "4eNEXT to owlbear" },
  { html: "panel.html", js: "assets/panel.js", label: "角色卡 / 导入", title: "4eNEXT to owlbear" }
];
for (const one of INDEPENDENT) {
  const hp = path.join(ROOT, one.html);
  const jp = path.join(ROOT, one.js);
  if (!exists(hp)) { bad("缺少独立页面 " + one.html + "（" + one.label + "）"); continue; }
  if (!exists(jp)) { bad("缺少 " + one.js + "（" + one.html + " 的脚本）"); continue; }
  const h = fs.readFileSync(hp, "utf8");
  const s = fs.readFileSync(jp, "utf8");
  if (h.indexOf(one.title) < 0) bad(one.html + " 的标题里没有「" + one.title + "」");
  else ok(one.label + "独立页面：" + one.html + " + " + one.js);
  if (one.html === "info.html") continue; /* 速览是 v1.2.2 的小窗，保持原样 */
  const shell = h.indexOf('class="win"') >= 0 || h.indexOf('class="panel"') >= 0;
  if (shell && h.indexOf('id="head"') >= 0 && h.indexOf('id="pin"') >= 0)
    ok(one.html + " 有窗口外壳（.win / .panel + 拖动区 #head + 回到默认位置 #pin）");
  else bad(one.html + " 缺少窗口外壳（.win / .panel / #head / #pin）");
  if (h.indexOf('id="bg-retry"') >= 0 && h.indexOf("后台未连接，点这里重试") >= 0)
    ok(one.html + " 有「后台未连接，点这里重试」按钮");
  else bad(one.html + " 缺少后台离线重试按钮");
  const extra = one.html === "initiative.html" ? fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8") : "";
  if (h.indexOf("data-bg-soft") >= 0 || h.indexOf("data-bg") >= 0 || extra.indexOf("data-bg") >= 0)
    ok(one.html + " 标了后台依赖等级（data-bg / data-bg-soft）");
  else bad(one.html + " 没有标后台依赖等级（后台离线时无法置灰）");
  if (/from "\.\/window\.js"/.test(s) && /createWindow\(/.test(s))
    ok(one.js + " 用 window.js 的 createWindow（拖动 + 后台检测共用一个外壳）");
  else bad(one.js + " 没有用 window.js 的 createWindow");
}

/* ---- 3) 每个窗口一个独立 popover id，可同时打开 ---- */
const winIds = (srcText) => ["ID_PANEL", "ID_INFO", "ID_INIT_WIN", "ID_DICE_WIN"].map(function (n) {
  const m = new RegExp("(?:var|export const) " + n + ' = NS \\+ "([^"]+)";').exec(srcText);
  return { name: n, value: m ? m[1] : "" };
});
const coreIds = winIds(coreSrcV131);
const commonIds = winIds(commonSrc);
const missingCore = coreIds.filter(function (x) { return !x.value; });
if (!missingCore.length) ok("background.core.js 有四个窗口 id：" + coreIds.map(function (x) { return x.value; }).join(" / "));
else bad("background.core.js 缺少窗口 id：" + missingCore.map(function (x) { return x.name; }).join(" / "));
for (const id of coreIds) {
  const other = commonIds.filter(function (x) { return x.name === id.name; })[0];
  if (!other || other.value !== id.value) bad("窗口 id 两边不一致：" + id.name + " core=" + id.value + " common=" + (other ? other.value : ""));
  else ok("窗口 id 一致：" + id.name + " = " + id.value);
}
const uniq = new Set(coreIds.map(function (x) { return x.value; }));
if (uniq.size === coreIds.length) ok("四个窗口 id 互不相同（可以同时打开、互不嵌套）");
else bad("窗口 id 有重复：" + coreIds.map(function (x) { return x.value; }).join(" / "));
for (const name of ["panel", "initiative", "dice"]) {
  if (new RegExp('\\b' + name + ': \\{ id: ID_').test(coreSrcV131)) ok("background.core.js 的 WINS 注册了 " + name + " 窗口");
  else bad("background.core.js 的 WINS 没有注册 " + name + " 窗口");
}
if (/ID_INIT_WIN/.test(coreSrcV131) && /initiative\.html/.test(coreSrcV131) &&
  /ID_DICE_WIN/.test(coreSrcV131) && /dice\.html/.test(coreSrcV131))
  ok("先攻 / 骰子各自打开自己的页面");
else bad("先攻 / 骰子没有指向各自的页面");

/* ---- 4) 入口按钮（工具栏 ×3 / action / 右键 / 浮动按钮） ---- */
for (const [constName, label] of [["TOOL_ID", "角色卡 / 导入面板"], ["TOOL_INIT_ID", "先攻条"], ["TOOL_DICE_ID", "骰子窗口"]]) {
  if (new RegExp("registerOneTool\\(\\{[\\s\\S]{0,200}?id: " + constName).test(coreSrcV131) &&
    new RegExp('label: "4eNEXT to owlbear：' + label + '"').test(coreSrcV131))
    ok("工具栏入口：" + label);
  else bad("工具栏缺少入口：" + label + "（" + constName + "）");
}
for (const [file, label] of [["icon-tool.svg", "角色卡"], ["icon-tool-initiative.svg", "先攻"], ["icon-tool-dice.svg", "骰子"]]) {
  if (exists(path.join(ROOT, file))) ok("工具栏图标存在：" + file + "（" + label + "）");
  else bad("缺少工具栏图标：" + file);
}
if (man.action && /\/panel\.html$/.test(String(man.action.popover))) ok("manifest.action.popover = panel.html（左上角入口打开角色卡 / 导入面板）");
  // [v1.6.1 移除] manifest 不再带 action（真机验证：无 action 也能加载；入口由工具栏 tool 提供）// else bad("manifest.action.popover 不是 panel.html：" + (man.action && man.action.popover));
if (man.action && !/\?tab=/.test(String(man.action.popover))) ok("action.popover 不再带 ?tab=...（没有 tab 概念了）");
  // [v1.6.1 移除] manifest 不再带 action（真机验证：无 action 也能加载；入口由工具栏 tool 提供）// else bad("action.popover 还带着 ?tab=...");
if (/label: "加入先攻"/.test(coreSrcV131) && /label: "隐形加入先攻"/.test(coreSrcV131)) ok("右键菜单有「加入先攻」「隐形加入先攻」两项");
else bad("右键菜单缺少「加入先攻」/「隐形加入先攻」");
if (/var INIT_MENU_ADD = NS \+ "\/init-add";/.test(coreSrcV131) &&
  /var INIT_MENU_ADD_HIDDEN = NS \+ "\/init-add-hidden";/.test(coreSrcV131) &&
  /var INIT_MENU_REMOVE = NS \+ "\/init-remove";/.test(coreSrcV131)) ok("右键先攻三项各有独立 id（加入 / 隐形加入 / 移出）");
else bad("右键先攻三项没有各自的 id（INIT_MENU_ADD / ADD_HIDDEN / REMOVE）");
if (/function openButton\(/.test(coreSrcV131) && /URL_BUTTON = pageUrl\("button\.html"\)/.test(coreSrcV131)) ok("右下角浮动按钮入口还在");
else bad("右下角浮动按钮入口没了");
if (/OBR\.tool\.create/.test(coreSrcV131) && /registerTools/.test(coreSrcV131)) ok("boot 里注册的是 registerTools（三个入口一起注册）");
else bad("boot 里没有注册 registerTools");

/* ---- 5) 打开前用 OBR.viewport 夹紧（不超出屏幕） ---- */
const marginM = /var WIN_MARGIN = (\d+);/.exec(coreSrcV131);
if (marginM && +marginM[1] >= 12 && +marginM[1] <= 24) ok("窗口留边 WIN_MARGIN = " + marginM[1] + "（12~24）");
else bad("WIN_MARGIN 不在 12~24：" + (marginM ? marginM[1] : "找不到"));
if (/function winSize\(def, vp\)/.test(coreSrcV131) && /vp\.width/.test(coreSrcV131) && /vp\.height/.test(coreSrcV131) &&
  /WIN_MARGIN \* 2/.test(coreSrcV131))
  ok("窗口尺寸取自视口且 ≤ 视口 - 2×margin（winSize）");
else bad("窗口尺寸没有按视口夹紧");
if (/function openWin\(name, urlOverride\)/.test(coreSrcV131) && /var vp = await infoViewport\(\);/.test(coreSrcV131) &&
  /var size = winSize\(def, vp\);/.test(coreSrcV131) && /clampInfoPos\(/.test(coreSrcV131))
  ok("打开窗口前先取视口 → 算尺寸 → 夹位置（openWin）");
else bad("openWin 没有在打开前夹紧视口");
if (/function reclampWins\(/.test(coreSrcV131) && /viewport\.onChange/.test(coreSrcV131))
  ok("视口变化后重新夹紧已打开的窗口（reclampWins）");
else bad("视口变化没有重新夹紧窗口");
if (/max-height: 100vh/.test(uiCss) || /max-height: calc\(100vh/.test(uiCss)) ok("ui.css 用 max-height: 100vh / calc() 限制高度（CSS clamp，不靠 JS 反复测量）");
else bad("ui.css 没有用 max-height 限制窗口高度");
if (/\.win-body \{[^}]*overflow-y: auto/.test(uiCss) && /\.panel-main \{[^}]*overflow-y: auto/.test(uiCss) &&
  /\.card-list \{[^}]*overflow-y: auto/.test(uiCss))
  ok("ui.css 有独立滚动容器（.win-body / .panel-main / .card-list 都是 overflow-y:auto）");
else bad("ui.css 缺少独立滚动容器（内容超出时会被切掉）");

/* ---- 6) 拖动 / 位置记忆（沿用 v1.2.2 的机制，按窗口名记） ---- */
const coreWinCh = (/var CH_WIN_DRAG = NS \+ "([^"]+)";/.exec(coreSrcV131) || [])[1] || "";
const commonWinCh = (/export const CH_WIN_DRAG = NS \+ "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (coreWinCh && commonWinCh === coreWinCh) ok("窗口拖动频道一致：" + coreWinCh);
else bad("窗口拖动频道不一致：core=" + coreWinCh + " common=" + commonWinCh);
const coreWinPos = (/var WIN_POS_KEY = "([^"]+)";/.exec(coreSrcV131) || [])[1] || "";
const commonWinPos = (/export const WIN_POS_KEY = "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (coreWinPos === "4enext/win-pos" && commonWinPos === coreWinPos) ok("窗口位置键一致：" + coreWinPos);
else bad("窗口位置键不一致：core=" + coreWinPos + " common=" + commonWinPos);
if (/broadcast\.onMessage\(CH_WIN_DRAG/.test(coreSrcV131) && /function onWinDrag\(/.test(coreSrcV131) &&
  /function writeWinPos\(/.test(coreSrcV131) && /function resetWin\(/.test(coreSrcV131))
  ok("后台订阅拖动频道并落盘位置（onWinDrag / writeWinPos / resetWin）");
else bad("后台没有处理窗口拖动 / 位置记忆");
const winSrc = fs.readFileSync(path.join(ROOT, "assets", "window.js"), "utf8");
if (/headEl\.addEventListener\("pointerdown"/.test(winSrc) && /WIN_DRAG_THROTTLE_MS/.test(winSrc) &&
  /send\("reset"/.test(winSrc) && /ev\.screenX - drag\.x0/.test(winSrc))
  ok("窗口页收 pointerdown / 节流 / 屏幕坐标位移 / 回到默认位置");
else bad("窗口页缺少拖动事件 / 节流 / 屏幕坐标");
if (/var INFO_POS_KEY = "4enext\/info-pos";/.test(coreSrcV131)) ok("速览的旧位置键 4enext/info-pos 没改（老数据还能读）");
else bad("速览的位置键被改掉了（老数据会丢）");

/* ---- 7) 按钮有反馈 + 后台离线置灰 ---- */
if (/function feedback\(/.test(winSrc) && /OBR\.notification\.show|notify\(/.test(winSrc) && /win-flash/.test(winSrc))
  ok("window.js 的 feedback() 同时发通知与窗口内状态行");
else bad("window.js 没有统一的反馈函数");
if (/querySelectorAll\("\[data-bg\]"\).*?/s.test(winSrc) && /el\.disabled = true/.test(winSrc))
  ok("后台离线时 [data-bg] 交互元素被真正 disabled");
else bad("后台离线时没有把交互元素置灰 / disabled");
if (winSrc.indexOf("后台未连接，点这里重试") >= 0) ok("离线时顶部显示「后台未连接，点这里重试」");
else bad("离线提示文案不对");
if (/body\.bg-off/.test(uiCss) && /\[data-bg\]\.bg-off/.test(uiCss)) ok("ui.css 有离线置灰样式（body.bg-off / [data-bg].bg-off）");
else bad("ui.css 缺少离线置灰样式");
for (const f of ["assets/panel.js", "assets/initiative-page.js", "assets/dice-page.js"]) {
  const s = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (/feedback\(/.test(s)) ok(f + " 的按钮走 feedback()（不会点了没反应）");
  else bad(f + " 没有用 feedback()（按钮可能静默失败）");
}
if (/win\.guard\("结束我的回合"/.test(fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8")))
  ok("玩家「结束我的回合」在后台离线时走 guard（先提示、不静默）");
else bad("「结束我的回合」没有走 guard");

/* ---- 8) 标题文案统一成「4eNEXT to owlbear」 ---- */
for (const f of ["panel.html", "initiative.html", "dice.html"]) {
  const h = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (/<title>[^<]*4eNEXT to owlbear/.test(h)) ok(f + " 的标题含「4eNEXT to owlbear」");
  else bad(f + " 的标题不是「4eNEXT to owlbear」");
}
if (panelHtmlV131.indexOf("4eNEXT to owlbear") >= 0 && panelHtmlV131.indexOf("4E NEXT 角色卡") >= 0)
  ok("面板标题「4eNEXT to owlbear」+ 副标题「4E NEXT 角色卡」");
else bad("面板标题 / 副标题不对");

/* ---- 9) 先攻模块仍然接在这里（只是换了页面） ---- */
const initPath = path.join(ROOT, "assets", "initiative.js");
if (!exists(initPath)) bad("缺少 assets/initiative.js");
else {
  const initSrc = fs.readFileSync(initPath, "utf8");
  for (const name of ["normalizeInitiative", "renderInitiativeHTML", "advanceInitiative", "canEndTurn", "readInitiative", "writeInitiative", "syncInitBonuses"]) {
    if (new RegExp("export (async )?function " + name + "\\(").test(initSrc)) ok("initiative.js 导出 " + name);
    else bad("initiative.js 没有导出 " + name);
  }
  if (/initiativeBonus/.test(initSrc) && /from "\.\/glance\.js"/.test(initSrc)) ok("先攻加值复用 glance.js 的 initiativeBonus");
  else bad("initiative.js 没有复用 glance.js 的 initiativeBonus");
  if (/opts\.inWindow/.test(initSrc)) ok("renderInitiativeHTML 支持窗口模式（独立窗口里不重复大标题）");
  else bad("renderInitiativeHTML 没有窗口模式");
}
const initPageSrc = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
if (/renderInitiativeHTML/.test(initPageSrc) && /readInitiative/.test(initPageSrc) && /writeInitiative/.test(initPageSrc))
  ok("先攻窗口接入了读写与渲染（initiative-page.js）");
else bad("先攻窗口没有接入先攻模块");
const initKeys = (srcText, re) => (re.exec(srcText) || [])[1] || "";
const coreInit = initKeys(coreSrcV131, /var KEY_INIT = NS \+ "([^"]+)";/);
const commonInit = initKeys(commonSrc, /export const KEY_INIT = NS \+ "([^"]+)";/);
if (coreInit && coreInit === commonInit) ok("token 先攻键一致：" + coreInit);
else bad("token 先攻键不一致：core=" + coreInit + " common=" + commonInit);
const coreInitRoom = initKeys(coreSrcV131, /var KEY_INITIATIVE = NS \+ "([^"]+)";/);
const commonInitRoom = initKeys(commonSrc, /export const KEY_INITIATIVE = NS \+ "([^"]+)";/);
if (coreInitRoom && coreInitRoom === commonInitRoom) ok("房间先攻键一致：" + coreInitRoom);
else bad("房间先攻键不一致：core=" + coreInitRoom + " common=" + commonInitRoom);
const coreReq = initKeys(coreSrcV131, /var CH_INIT_REQUEST = NS \+ "([^"]+)";/);
const commonReq = initKeys(commonSrc, /export const CH_INIT_REQUEST = NS \+ "([^"]+)";/);
if (coreReq && coreReq === commonReq) ok("结束回合请求频道一致：" + coreReq);
else bad("结束回合请求频道不一致：core=" + coreReq + " common=" + commonReq);
if (/function onInitRequest\(/.test(coreSrcV131) && /broadcast\.onMessage\(CH_INIT_REQUEST/.test(coreSrcV131))
  ok("后台订阅并处理玩家「结束我的回合」请求");
else bad("后台没有处理玩家结束回合请求");
/* v1.7.15：写入统一走带预算的 roomWriteGuarded（超 14 KB 不写 + ERROR），不再裸 setMetadata。 */
if (/function onInitMenuClick\(/.test(coreSrcV131) && /roomWriteGuarded\(KEY_INITIATIVE, next\)/.test(coreSrcV131))
  ok("右键加入先攻会写房间数据（走 roomWriteGuarded 预算）");
else bad("右键加入先攻没有写房间数据");
if (/function bindToken\(/.test(commonSrc) && /metadata\[KEY_INIT\]/.test(commonSrc) && /initiativeBonus\(/.test(commonSrc))
  ok("绑定角色卡时写入 init 元数据（先攻加值取卡里的先攻）");
else bad("bindToken 没有写入 init 元数据 / 没有复用 initiativeBonus");
/* v1.8.4（Full Suite 口径）：绑卡即用卡数据覆盖 token 血量（并删 hp-bar/enabled）；
 * 面板更新卡片后 propagateCardStats 回推上限 / 四防 / 先攻，保留当前 HP。 */
{
  const panelPropSrc = fs.readFileSync(path.join(ROOT, "assets", "panel.js"), "utf8");
  if (/export async function propagateCardStats\(/.test(commonSrc) &&
    /propagateCardStats\(/.test(panelPropSrc) &&
    /delete it\.metadata\[KEY_HPBAR\]/.test(commonSrc) &&
    /out\.cur = max;/.test(commonSrc) && /out\.max = max;/.test(commonSrc))
    ok("v1.8.4：绑卡覆盖 token 血量（cur = max = 卡上限、删 hp-bar/enabled）；面板更新卡后回推（propagateCardStats，保留 cur/temp/locked）");
  else bad("v1.8.4 绑卡覆盖 / propagateCardStats 回推没接上");
}
/* [v1.7.7] docs 合并：为什么拆窗口 / 先攻入口的说明并进 NOTES.md */
if (notesHas("窗口默认尺寸") && notesHas("先攻条尺寸")) ok("docs/NOTES.md：窗口拆分与先攻条尺寸的维护口径都在");
else bad("docs/NOTES.md 缺少窗口 / 先攻条尺寸的维护口径");
if (exists(path.join(ROOT, "dev", "test-initiative.mjs"))) ok("dev/test-initiative.mjs");
else bad("缺少 dev/test-initiative.mjs");
if (new RegExp("background\\.bundle\\.js\\?v=" + VER.replace(/\./g, "\\.")).test(bgHtmlV131)) ok("background.html 的 ?v= 也是 " + VER + "（缓存破坏参数跟着版本走）");
else bad("background.html 的 ?v= 没跟着升（会继续吃到旧缓存）");

const bgHtml = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
if (/<script[^>]*type="module"/.test(bgHtml)) bad('background.html 里还有 <script type="module">');
else ok("background.html 没有 type=module，只加载一个脚本");
if (bgHtml.indexOf("background.bundle.js") >= 0) ok("background.html 引用了 background.bundle.js");
else bad("background.html 没有引用 background.bundle.js");


console.log("== v1.3.2 入口补齐（速览 / 设置）+ 设置 / 关于窗口");

/* ---- 1) 工具栏补的两个入口：注册 + 图标文件 ---- */
const TOOLS132 = [
  ["TOOL_GLANCE_ID", "TOOL_GLANCE_ICON_URL", "icon-tool-glance.svg", "4eNEXT to owlbear：速览"],
  ["TOOL_SETTINGS_ID", "TOOL_SETTINGS_ICON_URL", "icon-tool-settings.svg", "4eNEXT to owlbear：设置"]
];
for (const [idName, urlName, iconFile, label] of TOOLS132) {
  if (new RegExp("var " + idName + ' = NS \\+ "/[^"]+";').test(coreSrcV131)) ok("background.core.js 定义了工具栏 id " + idName);
  else bad("background.core.js 没有定义 " + idName);
  if (new RegExp("registerOneTool\\(\\{[\\s\\S]{0,240}?id: " + idName).test(coreSrcV131) &&
    coreSrcV131.indexOf('label: "' + label) >= 0)
    ok("工具栏入口：" + label);
  else bad("工具栏缺少入口：" + label + "（" + idName + "）");
  if (new RegExp("var " + urlName + ' = pageUrl\\("' + iconFile.replace(/\./g, "\\.") + '"\\);').test(coreSrcV131))
    ok("图标地址：" + urlName + " → " + iconFile);
  else bad("background.core.js 没有把 " + iconFile + " 接进 " + urlName);
  if (exists(path.join(ROOT, iconFile))) ok("工具栏图标存在：" + iconFile + "（" + label + "）");
  else bad("缺少工具栏图标：" + iconFile);
}
const TOOL_IDS = ["TOOL_ID", "TOOL_GLANCE_ID", "TOOL_INIT_ID", "TOOL_DICE_ID", "TOOL_SETTINGS_ID"];
const missingTool = TOOL_IDS.filter((n) => !new RegExp("id: " + n + "\\b").test(coreSrcV131));
if (!missingTool.length) ok("工具栏一共五个入口（速览 / 角色卡 / 先攻 / 骰子 / 设置），旧三个没丢");
else bad("工具栏入口不是五个，缺：" + missingTool.join(" / "));

/* ---- 2) 设置窗口：id 两端一致、注册进 WINS、页面存在 ---- */
const idOfWin = (srcText, n) => {
  const m = new RegExp("(?:var|export const) " + n + ' = NS \\+ "([^"]+)";').exec(srcText);
  return m ? m[1] : "";
};
const coreSetId = idOfWin(coreSrcV131, "ID_SETTINGS_WIN");
const commonSetId = idOfWin(commonSrc, "ID_SETTINGS_WIN");
if (coreSetId && coreSetId === commonSetId) ok("设置窗口 id 一致：" + coreSetId);
else bad("设置窗口 id 不一致：core=" + coreSetId + " common=" + commonSetId);
const fiveIds = ["ID_PANEL", "ID_INFO", "ID_INIT_WIN", "ID_DICE_WIN", "ID_SETTINGS_WIN"].map((n) => idOfWin(coreSrcV131, n));
if (fiveIds.every((x) => x) && new Set(fiveIds).size === 5)
  ok("五个窗口 id 互不相同（设置窗口可以和其它窗口同时开着）：" + fiveIds.join(" / "));
else bad("窗口 id 有重复或缺失：" + fiveIds.join(" / "));
if (/var URL_SETTINGS = pageUrl\("settings\.html"\);/.test(coreSrcV131)) ok("URL_SETTINGS → settings.html");
else bad("background.core.js 里没有 URL_SETTINGS = pageUrl(\"settings.html\")");
if (/settings: \{ id: ID_SETTINGS_WIN, url: URL_SETTINGS, width: \d+, height: \d+ \}/.test(coreSrcV131))
  ok("background.core.js 的 WINS 注册了 settings 窗口（id + 页面 + 尺寸）");
else bad("background.core.js 的 WINS 没有注册 settings 窗口");
if (/registerOneTool\(\{[\s\S]{0,240}?id: TOOL_SETTINGS_ID[\s\S]{0,240}?openWinOrNotify\("settings"/.test(coreSrcV131))
  ok("工具栏「设置」走 openWin（可拖动 / 视口夹紧 / 记位置）");
else bad("工具栏「设置」没有打开 settings 窗口");
if (/function openGlance\(/.test(coreSrcV131) && /openInfo\(bind\.itemId, bind\.cardId\)/.test(coreSrcV131))
  ok("工具栏「速览」复用 /info 小窗（openGlance → openInfo，与「选中即弹」同一个 popover）");
else bad("工具栏「速览」没有复用 /info 小窗");
if (/function selectedBinding\(/.test(coreSrcV131) && /notify\("速览：/.test(coreSrcV131))
  ok("没选中 / 没绑定 token 时给 WARNING 提示（不会点了没反应）");
else bad("工具栏「速览」没有「先选 token」的提示");

const setHtmlPath = path.join(ROOT, "settings.html");
const setJsPath = path.join(ROOT, "assets", "settings-page.js");
if (!exists(setHtmlPath)) bad("缺少 settings.html（设置 / 关于窗口）");
else if (!exists(setJsPath)) bad("缺少 assets/settings-page.js（settings.html 的脚本）");
else {
  const h = fs.readFileSync(setHtmlPath, "utf8");
  const s = fs.readFileSync(setJsPath, "utf8");
  if (/<title>[^<]*4eNEXT to owlbear/.test(h)) ok("settings.html 的标题含「4eNEXT to owlbear」");
  else bad("settings.html 的标题不含「4eNEXT to owlbear」");
  if (h.indexOf('class="win"') >= 0 && h.indexOf('id="head"') >= 0 && h.indexOf('id="pin"') >= 0)
    ok("settings.html 有窗口外壳（.win + 拖动区 #head + 回到默认位置 #pin）");
  else bad("settings.html 缺少窗口外壳（.win / #head / #pin）");
  if (h.indexOf('id="bg-retry"') >= 0 && h.indexOf("后台未连接，点这里重试") >= 0)
    ok("settings.html 有「后台未连接，点这里重试」");
  else bad("settings.html 缺少后台离线重试按钮");
  const PANES132 = ["about", "guide", "data", "limits", "reset", "thanks"];
  const missPane = PANES132.filter((x) => h.indexOf('data-pane="' + x + '"') < 0 || h.indexOf('id="pane-' + x + '"') < 0);
  if (!missPane.length) ok("左侧分栏六项齐全（关于 / 使用说明 / 数据与权限 / 已知限制 / 重置本机设置 / 致谢）");
  else bad("左侧分栏缺项：" + missPane.join(" / "));
  if (h.indexOf('class="set-nav"') >= 0 && h.indexOf('class="set-main"') >= 0)
    ok("左分栏 + 右内容（.set-nav / .set-main）");
  else bad("settings.html 不是「左侧分栏 + 右侧内容」布局");
  for (const idn of ["set-head-sub", "set-version", "set-build", "set-local-state", "reset-btn", "reset-out"]) {
    if (h.indexOf('id="' + idn + '"') >= 0) ok("settings.html 有 #" + idn);
    else bad("settings.html 缺少 #" + idn);
  }
  if (/from "\.\/common\.js"/.test(s) && /PLUGIN_VERSION/.test(s) && /createWindow\(/.test(s))
    ok("settings-page.js 用 window.js 的 createWindow + common.js 的 PLUGIN_VERSION");
  else bad("settings-page.js 没有用 createWindow / PLUGIN_VERSION");
  if (!/\b1\.\d+\.\d+\b/.test(s)) ok("settings-page.js 里没有写死版本号（一律取自 PLUGIN_VERSION）");
  else bad("settings-page.js 里写死了版本号（版本号应该只来自 common.js 的 PLUGIN_VERSION）");
  if (/classList\.toggle\("on"/.test(s) && /\.set-tab\.on/.test(uiCss))
    ok("左分栏用 .set-tab.on 标当前栏（settings-page.js 负责切换）");
  else bad("左分栏没有选中态（.set-tab.on / classList.toggle）");
}

/* ---- 3) 「重置本机设置」只清约定的本机键（不碰房间数据 / token 数据） ---- */
{
  const s = exists(setJsPath) ? fs.readFileSync(setJsPath, "utf8") : "";
  if (!/setMetadata|updateItems|\.setItem\(/.test(s))
    ok("重置只清本机：代码里没有 setMetadata / updateItems / localStorage.setItem");
  else bad("设置页里出现了写房间数据 / 写 token 元数据的调用（重置不该碰这些）");
  if (!/localStorage\.clear\(/.test(s)) ok("没有 localStorage.clear()（只按白名单逐条删键）");
  else bad("用了 localStorage.clear()（会误删白名单以外的本机数据）");
  const lits = new Set();
  const lre = /"(4enext\/[^"]*)"/g;
  let lm;
  while ((lm = lre.exec(s))) lits.add(lm[1]);
  const ALLOWED = new Set(["4enext/win-pos", "4enext/info-pos", "4enext/state/"]);
  const extra = [...lits].filter((x) => !ALLOWED.has(x));
  if (extra.length) bad("设置页里出现了白名单外的本机键：" + extra.join(" / "));
  else ok("设置页只提约定的本机键：" + [...lits].join(" / "));
  if (/RESET_KEYS = \["4enext\/win-pos", "4enext\/info-pos"\]/.test(s) && /RESET_PREFIX = "4enext\/state\/"/.test(s))
    ok("重置白名单 = 窗口位置 + 速览位置 + 追踪降级数据（4enext/state/*）");
  else bad("重置白名单不是约定的那三组键");
  if (/"reset-btn"/.test(s) && /armed/.test(s) && /CONFIRM_MS/.test(s) && /再点一次确认重置/.test(s))
    ok("「重置本机设置」有二次确认（第一次只预备，超时自动取消）");
  else bad("「重置本机设置」没有二次确认");
  if (/\.removeItem\(/.test(s)) ok("重置用的是 removeItem（不会写入任何新数据）");
  else bad("重置没有真正删除任何本机键");
}

/* [v1.7.7] docs 合并：设置窗口说明并进 NOTES.md 的「窗口默认尺寸」一行 */
if (notesHas("窗口默认尺寸")) ok("docs/NOTES.md：设置窗口也走 WINS 的「窗口默认尺寸」口径");
else bad("docs/NOTES.md 缺少「窗口默认尺寸」");

console.log("== v1.4.0 先攻条（P0 数据层 + P1/P2 条 UI）");

const initSrcV14 = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
const coreSrcV14 = fs.readFileSync(corePath, "utf8");
const pageSrcV14 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
const initHtmlV14 = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
const uiCssV14 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");

/* ---- 1) P0 数据层：上限 40（v1.8.0：60 → 40，给角色卡 + 骰子记录留余量）/ d20 / tb / phase / 写失败降级 ---- */
const maxEntries = (src) => (/(?:export const |var )INIT_MAX_ENTRIES = (\d+);/.exec(src) || [])[1] || "";
const maxA = maxEntries(initSrcV14);
const maxB = maxEntries(coreSrcV14);
if (maxA === "40" && maxB === "40") ok("先攻条目上限两边都是 40（v1.8.0 瘦身：房间数据 16 KB 预算，规格 §9.3）");
else bad("先攻条目上限不是 40：initiative.js=" + maxA + " background.core.js=" + maxB);

for (const name of ["genTiebreak", "startPreparation", "startCombat", "startSurprise", "endCombat", "reorderEntry", "stripSizeFor", "stripHeightFor", "renderStripHTML", "phaseLabel", "tokenInfoMap", "normalizePhase"]) {
  if (new RegExp("export function " + name + "\\(").test(initSrcV14)) ok("initiative.js 导出 " + name);
  else bad("initiative.js 没有导出 " + name);
}
if (/d20: d20raw === null \? null :/.test(initSrcV14) && /tb: tbraw === null \? null :/.test(initSrcV14) && /phase: PHASE_IDLE/.test(initSrcV14))
  ok("条目结构含 d20 / tb，状态含 phase（缺字段按默认值，旧数据不报错）");
else bad("条目结构缺少 d20 / tb / phase");
if (/export async function writeInitiative/.test(initSrcV14) && /LS_INIT_FALLBACK/.test(initSrcV14) && /export function stashInitiative/.test(initSrcV14))
  ok("房间数据写不进去时降级本机（LS_INIT_FALLBACK + stashInitiative + WARNING）");
else bad("写先攻没有降级路径（写失败会静默）");
if (/sortEntries\(out\.entries\)/.test(initSrcV14) && /tbOf\(a\) - tbOf\(b\)/.test(initSrcV14))
  ok("排序是两级：合计 DESC → tiebreak ASC（tb 缺失按 0.5）");
else bad("排序不是「合计 DESC → tiebreak ASC」两级");
if (/function reorderEntry\(/.test(initSrcV14) && /\(num\(above\.init, 0\) \+ num\(below\.init, 0\)\) \/ 2/.test(initSrcV14) &&
  /num\(above\.init, 0\) - 1/.test(initSrcV14) && /num\(below\.init, 0\) \+ 1/.test(initSrcV14))
  ok("拖拽落位用中点法（同分只改 tb / 不同分取中点 / 最顶最底 ±1）");
else bad("拖拽落位公式不完整（规格 §7.3）");

/* ---- 2) 先攻条常量：core 与 initiative.js 必须一字不差 ---- */
const constOf = (src, name) => {
  const m = new RegExp("(?:export const |var )" + name + " = (\\d+);").exec(src);
  return m ? m[1] : "";
};
const STRIP_CORE = ["STRIP_COLLAPSED_W", "STRIP_COLLAPSED_H", "STRIP_EXPANDED_W", "STRIP_MIN_EXPANDED_W", "STRIP_H_IDLE", "STRIP_H_PREPARING", "STRIP_H_COMBAT", "STRIP_TOP_OFFSET", "STRIP_SIDE_MARGIN"];
const mismatch = STRIP_CORE.filter((n) => !constOf(initSrcV14, n) || constOf(initSrcV14, n) !== constOf(coreSrcV14, n));
if (!mismatch.length) ok("先攻条尺寸常量两边一致：" + STRIP_CORE.map((n) => constOf(coreSrcV14, n)).join(" / "));
else bad("先攻条尺寸常量不一致：" + mismatch.map((n) => n + " core=" + constOf(coreSrcV14, n) + " init=" + constOf(initSrcV14, n)).join("，"));
const WANT_NUMS = {
  STRIP_COLLAPSED_W: "120", STRIP_COLLAPSED_H: "40", STRIP_EXPANDED_W: "720", STRIP_MIN_EXPANDED_W: "410",
  /* v1.7.10：展开高度加高到 ≥170（控制行 36 + 卡片 80 + d20 按钮 16 + padding） */
  STRIP_H_IDLE: "170", STRIP_H_PREPARING: "180", STRIP_H_COMBAT: "200", STRIP_TOP_OFFSET: "45",
  STRIP_CARD_W: "56", STRIP_CARD_H: "80", STRIP_CARD_ACTIVE_H: "100"
};
const wrongNum = Object.keys(WANT_NUMS).filter((n) => constOf(initSrcV14, n) !== WANT_NUMS[n]);
if (!wrongNum.length) ok("先攻条/卡片尺寸与规格一致（120×40 / 720×170|180|200 / 56×80 / 当前 100）");
else bad("尺寸与规格不一致：" + wrongNum.map((n) => n + "=" + constOf(initSrcV14, n)).join("，"));
if (/if \(p === PHASE_COMBAT\) return STRIP_H_COMBAT;/.test(initSrcV14) && /if \(p === PHASE_PREPARING\) return STRIP_H_PREPARING;/.test(initSrcV14) &&
  /function stripHeightFor\(phase\) \{[^}]*return STRIP_H_COMBAT;/.test(coreSrcV14))
  ok("高度按 phase 三档（v1.7.10：idle 170 / preparing 180 / combat 200，卡片不再被裁切）");
else bad("先攻条高度不是按 phase 三档");
if (/Math\.max\(STRIP_MIN_EXPANDED_W, Math\.min\(STRIP_EXPANDED_W/.test(coreSrcV14) && /STRIP_SIDE_MARGIN \* 2/.test(coreSrcV14))
  ok("展开宽度 = max(410, 测量值+16)，并按视口 −32 夹紧（规格 §3.3 / §3.6）");
else bad("展开宽度没有自适应 / 视口夹紧");

/* ---- 3) popover 参数（规格 §3.2）与拖动频道 ---- */
const idStripCore = (/var ID_STRIP = NS \+ "([^"]+)";/.exec(coreSrcV14) || [])[1] || "";
const idStripCommon = (/export const ID_STRIP = NS \+ "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (idStripCore && idStripCore === idStripCommon) ok("先攻条 popover id 一致：" + idStripCore);
else bad("先攻条 popover id 不一致：core=" + idStripCore + " common=" + idStripCommon);
/* [v1.7.11 改] v1.7.10 的 modal + disablePointerEvents 会让整条点不动 → 回退 popover。 */
if (/function stripPopoverOptions\(size, pos\)/.test(coreSrcV14) && /anchorReference: "POSITION"/.test(coreSrcV14) &&
  /anchorOrigin: \{ horizontal: "CENTER", vertical: "TOP" \}/.test(coreSrcV14) &&
  /hidePaper: true/.test(coreSrcV14) && /disableClickAway: true/.test(coreSrcV14) &&
  /await OBR\.popover\.open\(stripPopoverOptions\(size, pos\)\)/.test(coreSrcV14) &&
  !/function stripModalOptions/.test(coreSrcV14))
  ok("先攻条回退 OBR.popover.open（POSITION + CENTER/TOP + hidePaper:true + disableClickAway:true），不再用 modal");
else bad("先攻条没有回退 popover / 少了 hidePaper / disableClickAway / 还在用 stripModalOptions");
const stripPosCore = (/var STRIP_POS_KEY = "([^"]+)";/.exec(coreSrcV14) || [])[1] || "";
const stripPosCommon = (/export const STRIP_POS_KEY = "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (stripPosCore === "4enext/strip-pos" && stripPosCommon === stripPosCore) ok("先攻条位置键一致：" + stripPosCore + "（只记相对中线的偏移）");
else bad("先攻条位置键不一致：core=" + stripPosCore + " common=" + stripPosCommon);
for (const name of ["CH_STRIP_DRAG", "CH_STRIP_CMD"]) {
  const a = (new RegExp("var " + name + ' = NS \\+ "([^"]+)";').exec(coreSrcV14) || [])[1] || "";
  const b = (new RegExp("export const " + name + ' = NS \\+ "([^"]+)";').exec(commonSrc) || [])[1] || "";
  if (a && a === b) ok("先攻条频道一致：" + name + " = " + a);
  else bad("先攻条频道不一致：" + name + " core=" + a + " common=" + b);
}
if (/function openStrip\(/.test(coreSrcV14) && /function onStripDrag\(/.test(coreSrcV14) && /function onStripCmd\(/.test(coreSrcV14) &&
  /broadcast\.onMessage\(CH_STRIP_DRAG/.test(coreSrcV14) && /broadcast\.onMessage\(CH_STRIP_CMD/.test(coreSrcV14) &&
  /void reclampStrip\(\)/.test(coreSrcV14))
  ok("后台：openStrip / onStripDrag / onStripCmd / 视口变化重新夹紧都在");
else bad("后台缺少先攻条的打开 / 拖动 / 命令 / 重新夹紧");
if (/registerOneTool\(\{[\s\S]{0,240}?id: TOOL_INIT_ID[\s\S]{0,240}?openStripOrNotify/.test(coreSrcV14))
  ok("工具栏「先攻」打开的是先攻条（不是大窗口）");
else bad("工具栏「先攻」没有打开先攻条");

/* ---- 4) 按钮 / 卡片内容 / 权限 ---- */
const ACTS = ["prepare", "surprise", "start", "cancel", "prev", "next", "end-combat", "clear"];
const missAct = ACTS.filter((x) => initSrcV14.indexOf('a("' + x + '"') < 0);
if (!missAct.length) ok("先攻条控制行有：战斗准备 / 突袭 / 开始战斗 / 取消准备 / 上一回合 / 下一回合 / 结束战斗 / 一键清空");
else bad("先攻条缺少按钮：" + missAct.join(" / "));
for (const act of ["expand", "collapse", "list", "end"]) {
  if (initSrcV14.indexOf('data-strip-act="' + act + '"') >= 0) ok("先攻条有 data-strip-act=\"" + act + "\" 的按钮");
  else bad("先攻条缺少 data-strip-act=\"" + act + "\"");
}
/* [v1.7.10 改] 4E 没有优势 / 劣势：卡片下方只留**一枚**居中 d20。 */
if (initSrcV14.indexOf('data-roll="normal"') >= 0 && initSrcV14.indexOf('data-roll="adv"') < 0 &&
  initSrcV14.indexOf('data-roll="dis"') < 0 && (initSrcV14.match(/class="roll-btn/g) || []).length === 1)
  ok("卡片下方只有 1 枚 d20 掷骰按钮（没有优势 / 劣势的 − / ＋）");
else bad("卡片下方不是「只留一枚 d20」（还有 adv / dis / 多枚按钮）");
if (/count-formula/.test(initSrcV14) && /Math\.round\(e\.d20\) \+ signed\(e\.bonus\)/.test(initSrcV14) && /item-hp-track/.test(initSrcV14))
  ok("卡片底部有公式行 (d20+加值) 与 HP 条槽位");
else bad("卡片缺少公式行 / HP 条槽位");
if (/confirmClear/.test(initSrcV14) && /再点一次清空/.test(initSrcV14)) ok("「一键清空」是二次确认（第一次只预备）");
else bad("「一键清空」没有二次确认");
if (/canEndTurn\(/.test(initSrcV14) && /data-strip-act="end"/.test(initSrcV14) && /phase === PHASE_COMBAT/.test(initSrcV14))
  ok("玩家只在「自己的当前回合」看到「结束」按钮");
else bad("玩家的结束回合按钮条件不对");
if (/if \(initBusy\)/.test(coreSrcV14) && /data\.activeId !== state\.activeId/.test(coreSrcV14) &&
  /只能结束自己的回合/.test(coreSrcV14) && /if \(role !== "GM"\) return;/.test(coreSrcV14))
  ok("玩家结束回合的四道校验都在（activeId / owner / GM / 正在推进中）");
else bad("玩家结束回合的四道校验不齐（规格 §5）");
if (/\(!isGM && active && active\.hidden\)/.test(initSrcV14) && /？？？/.test(initSrcV14))
  ok("隐形条目对玩家不渲染，当前是隐形单位时显示「？？？」");
else bad("隐形条目的玩家视图不对");

/* ---- 5) CSS（规格 §3.5 的尺寸表） ---- */
const cssOk = (label, re) => { if (re.test(uiCssV14)) ok("ui.css：" + label); else bad("ui.css 缺少 " + label); };
cssOk("先攻条容器 .strip（overflow:hidden + flex 竖排）", /\.strip \{[^}]*display: flex; flex-direction: column/s);
cssOk("折叠药丸 .strip.collapsed", /\.strip\.collapsed \{[^}]*flex-direction: row/s);
cssOk("卡片 56×80", /\.initiative-item \{[^}]*width: 56px; height: 80px/s);
cssOk("当前回合卡 100 高", /\.initiative-item\.active \{[^}]*height: 100px/s);
cssOk("头像占 80%（上下各裁 10%）", /\.item-img \{[^}]*height: 80%/s);
cssOk("合计条 bottom:0 / height:24%", /\.item-count \{[^}]*bottom: 0; height: 24%/s);
cssOk("HP 条 bottom:24% / height:4px", /\.item-hp-track \{[^}]*bottom: 24%; height: 4px/s);
cssOk("掷骰按钮在卡片正下方（margin-top: 1px，不再压卡片）", /\.roll-buttons \{[^}]*margin-top: 1px/s);
cssOk("d20 按钮是整宽长方形（100% × 16 高 / 4px 圆角）", /\.roll-btn\.normal \{[^}]*width: 100%; height: 16px[^}]*border-radius: 4px/s);
cssOk("卡片区 min-height 104（卡片 80 + 下方 d20 17）", /\.strip-items \{[^}]*min-height: 104px/s);
cssOk("结束回合按钮 18 高", /\.end-turn-btn \{[^}]*height: 18px/s);
cssOk("拖拽落位指示线", /\.drop-mark \{/);

/* ---- 6) 页面与文档 ---- */
if (initHtmlV14.indexOf('id="strip-root"') >= 0 && initHtmlV14.indexOf('id="win-shell"') >= 0 && initHtmlV14.indexOf('id="init-body"') >= 0)
  ok("initiative.html 同时有先攻条容器与列表窗口外壳（?view=list 用后者）");
else bad("initiative.html 缺少先攻条容器 / 列表窗口外壳");
if (/const VIEW = params\.get\("view"\) === "list"/.test(pageSrcV14) && /renderStripHTML/.test(pageSrcV14) && /setWidth/.test(pageSrcV14) &&
  /onStripDrag|sendDrag/.test(pageSrcV14) && /reorderEntry/.test(pageSrcV14))
  ok("先攻条页面：两种视图 / 渲染 / 改尺寸 / 拖动 / 拖拽排序都接上了");
else bad("先攻条页面没有接全（视图 / 渲染 / 尺寸 / 拖动 / 排序）");
/* [v1.7.7] docs 合并：先攻条实现说明 + 规格都并进 NOTES.md */
if (notesHas("先攻条尺寸")) ok("docs/NOTES.md：先攻条尺寸（STRIP_H_ALLOWED / stripSizeFor）在哪还写着");
else bad("docs/NOTES.md 缺少「先攻条尺寸」");

console.log("== v1.5.0 骰子（表达式 / 战斗优势+2 / 重击取满 / 团队共享）");

const diceCorePath = path.join(ROOT, "assets", "dice-core.js");
const dice4ePath = path.join(ROOT, "assets", "dice-4e.js");
const dicePagePath = path.join(ROOT, "assets", "dice-page.js");
const diceHtmlPath = path.join(ROOT, "dice.html");
const diceCoreSrc = exists(diceCorePath) ? fs.readFileSync(diceCorePath, "utf8") : "";
const dice4eSrc = exists(dice4ePath) ? fs.readFileSync(dice4ePath, "utf8") : "";
const dicePageSrc = fs.readFileSync(dicePagePath, "utf8");
const diceHtmlSrc = fs.readFileSync(diceHtmlPath, "utf8");
const diceSrcAll = diceHtmlSrc + "\n" + dicePageSrc;
/* 只扫「真正会渲染 / 执行」的部分：注释里写「没有优势劣势 / 无暗骰」不该被自己判成违规。
 * 去掉 HTML 注释、块注释、行注释（行注释用 [^:] 排除 "https://" 里的 //）。 */
const stripComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const diceCode = stripComments(diceSrcAll);

/* ---- 1) P0 纯函数核心 ---- */
if (exists(diceCorePath)) ok("assets/dice-core.js（纯函数：解析 / 掷骰 / 归一化 / 合并）");
else bad("缺少 assets/dice-core.js");
if (diceCoreSrc.indexOf("obr-sdk") < 0 && diceCoreSrc.indexOf("./common.js") < 0)
  ok("dice-core.js 不 import OBR / common（node 可以直接测）");
else bad("dice-core.js 依赖了 OBR / common，node 就测不了");
const CORE_EXPORTS = ["DICE_TYPES", "DIE_SIDES", "DIE_SIZE_FACTOR", "sidesOf", "normalizeExpr", "parseExpr",
  "formatExpr", "parsePlain", "readWrapperHead", "applyValueClamp", "rollParsed", "rollSegment", "computeTotal",
  "rowTotals", "makeRollId", "normalizeRoll", "rollToPayload", "mergeRollRows", "adjustExprForType",
  "adjustExprModifier", "countDiceByType"];
const missCore = CORE_EXPORTS.filter((n) => !new RegExp("export (function|const) " + n + "\\b").test(diceCoreSrc));
if (!missCore.length) ok("dice-core.js 导出全部纯函数（" + CORE_EXPORTS.length + " 个）");
else bad("dice-core.js 缺少导出：" + missCore.join(" / "));
if (diceCoreSrc.indexOf("adv|dis|resetmin|resetmax|reset|max|min|same|burst|repeat") >= 0)
  ok("表达式 wrapper 语法齐全（adv / dis / max / min / reset* / same / burst / repeat）");
else bad("wrapper 语法不全（规格 §2.1）");
if (diceCoreSrc.indexOf("maximize") >= 0 && diceCoreSrc.indexOf("critDegraded") >= 0 &&
  diceCoreSrc.indexOf("ROLL_CRIT_NOTE") >= 0)
  ok("重击 = 4E 版：所有伤害骰取满（maximize），包裹表达式退化并提示（critDegraded）");
else bad("重击没有实现「伤害骰取满 / 包裹退化提示」");
if (diceCoreSrc.indexOf("export const ROLL_MAX_ROWS = 20;") >= 0) ok("dice-core.js 的 ROLL_MAX_ROWS = 20（v1.8.0：40 → 20）");
else bad("dice-core.js 的 ROLL_MAX_ROWS 不是 20");
if (!/\btarget\s*:/.test(diceCoreSrc) && !/\bhit\s*:/.test(diceCoreSrc))
  ok("载荷里没有 target / hit（用户拍板：不做命中判定）");
else bad("dice-core.js 里还有 target / hit 判定字段");

/* ---- 2) P3 4E 预设 ---- */
if (exists(dice4ePath) && dice4eSrc.indexOf("export function presetsFor") >= 0)
  ok("assets/dice-4e.js 导出 presetsFor（攻击 / 伤害 / 豁免 / 技能 / 先攻）");
else bad("缺少 assets/dice-4e.js / 没有 presetsFor");
/* v1.7.0：先攻预设已删（先攻条自带投先攻），所以这里只要求复用 deriveGlance。 */
if (dice4eSrc.indexOf("deriveGlance") >= 0 && dice4eSrc.indexOf("export function presetsFor") >= 0)
  ok("4E 预设复用 glance.js 的推导（不重算四防 / 攻击 / 技能）");
else bad("dice-4e.js 没有复用 glance.js");
if (!/10\s*\+\s*half/.test(dice4eSrc) && !/half\s*\+\s*mods/.test(dice4eSrc))
  ok("dice-4e.js 里没有重算公式（不含 \"10 + half\"）");
else bad("dice-4e.js 里出现了自己重算的防御 / 攻击公式");

/* ---- 3) P1 骰子窗口 UI（v1.7.0 起单列） ---- */
/* v1.7.0：记录列表（list / share-warn / histMeta）已搬到 dice-history.html，这里只查骰子窗口自己的元素。 */
/* [v1.7.6 改] 删掉三处说明小字后，#presetMeta（预设区右上）/ #defenseRef（防御参考整行）/
 * #animMeta（「投骰动画：开」）三个元素一起删了 —— 用户要求「只留功能本身」。 */
const DICE_IDS = ["diceRow", "exprInput", "btnModMinus", "btnModPlus", "btnRoll", "btnLast", "btnSave",
  "btnClear", "btnAdvantage", "btnCrit", "btnHist", "presets", "combos", "comboName",
  "result", "head", "pin", "bg-retry"];
const missIds = DICE_IDS.filter((id) => diceHtmlSrc.indexOf('id="' + id + '"') < 0);
if (!missIds.length) ok("dice.html 带齐骰子窗口需要的元素 id（" + DICE_IDS.length + " 个）");
else bad("dice.html 缺少：" + missIds.join(" / "));
const missingDie = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"].filter((t) => diceHtmlSrc.indexOf('data-die="' + t + '"') < 0);
if (!missingDie.length) ok("骰子按钮 d4–d100 七颗齐全（左键 +1 / 右键 −1）");
else bad("骰子按钮缺：" + missingDie.join(" / "));
/* v1.7.0：记录搬走 → 单列（骰子 / 表达式 / 本次结果 / 预设 / 组合），右栏与 .dice-right 不该再出现。 */
if (diceHtmlSrc.indexOf('class="dice-cols"') >= 0 && diceHtmlSrc.indexOf('class="dice-left"') >= 0 &&
  diceHtmlSrc.indexOf('class="dice-right"') < 0)
  ok("dice.html 是单列（v1.7.0：记录搬去独立窗口，右栏已删）");
else bad("dice.html 布局不对（v1.7.0 起是单列，不该再有 .dice-right）");
if (dicePageSrc.indexOf('diceRow.addEventListener("click"') >= 0 && dicePageSrc.indexOf('diceRow.addEventListener("contextmenu"') >= 0)
  ok("骰子按钮左键 +1 / 右键 −1（右键阻止默认菜单）");
else bad("骰子按钮没有左键 / 右键两种交互");

/* 用户拍板：去掉优势 / 劣势 / 暗骰 / 示例框 / 5etools / 固定结果 */
const BANNED = [
  ["劣势", "优势 / 劣势按钮"], ["暗骰", "暗骰"], ["示例框", "示例框"], ["5etools", "5etools 菜单"],
  ['data-roll="adv"', "优势按钮"], ['data-roll="dis"', "劣势按钮"], ["fixed-roll", "DM 固定结果"]
];
const hitBanned = BANNED.filter((one) => diceCode.toLowerCase().indexOf(String(one[0]).toLowerCase()) >= 0);
if (!hitBanned.length) ok("骰子窗口里没有优势 / 劣势 / 暗骰 / 示例框 / 5etools / 固定结果");
else bad("骰子窗口里还留着：" + hitBanned.map((one) => one[1]).join(" / "));
if (diceSrcAll.indexOf("战斗优势") >= 0 && dicePageSrc.indexOf("advOn ? 2 : -2") >= 0 &&
  dicePageSrc.indexOf("adjustExprModifier") >= 0)
  ok("「战斗优势 +2」按钮：点一下公式 +2，再点撤回（改 modifier）");
else bad("缺少「战斗优势 +2」按钮 / 没有改 modifier");
if (diceSrcAll.indexOf("重击") >= 0 && dicePageSrc.indexOf("rollParsed(parsed, { crit: critOn })") >= 0 &&
  diceHtmlSrc.indexOf("重击 · 伤害取满") >= 0)
  ok("「重击 · 伤害取满」按钮：投掷时 crit=true，结果标注「重击 · 已取满」");
else bad("重击按钮 / crit 投掷 / 结果标注不齐");
if (diceHtmlSrc.indexOf('id="tnInput"') < 0 && diceCode.indexOf("未命中") < 0 && diceCode.indexOf("成功 / 失败") < 0 && diceCode.indexOf("命中") < 0)
  ok("只显示点数：没有 TN 输入框，也没有「未命中」「成功 / 失败」");
else bad("骰子窗口里还有 TN / 命中 / 豁免判定");

/* ---- 4) P2 团队共享 + 城主落库 ---- */
for (const name of ["CH_ROLL", "CH_ROLL_CLEAR", "CH_ROLL_SAVED", "KEY_ROLLS"]) {
  const a = (new RegExp("var " + name + ' = NS \\+ "([^"]+)";').exec(coreSrcV14) || [])[1] || "";
  const b = (new RegExp("export const " + name + ' = NS \\+ "([^"]+)";').exec(commonSrc) || [])[1] || "";
  if (a && a === b) ok("骰子频道一致：" + name + " = " + a);
  else bad("骰子频道不一致：" + name + " core=" + a + " common=" + b);
}
const coreRows = (/(?:var|export const) ROLL_MAX_ROWS = (\d+);/.exec(coreSrcV14) || [])[1] || "";
const commonRows = (/(?:var|export const) ROLL_MAX_ROWS = (\d+);/.exec(commonSrc) || [])[1] || "";
if (coreRows === "20" && commonRows === "20") ok("房间数据 rows 上限两边都是 20（v1.8.0 瘦身；容量预算规格 §1.6）");
else bad("ROLL_MAX_ROWS 不是 20：core=" + coreRows + " common=" + commonRows);
if (coreSrcV14.indexOf("function rollNorm(") >= 0 && coreSrcV14.indexOf("function rollMerge(") >= 0 &&
  coreSrcV14.indexOf("function rollWrite(") >= 0 && coreSrcV14.indexOf("roomWriteGuarded(KEY_ROLLS, box)") >= 0 &&
  coreSrcV14.indexOf("broadcast.onMessage(CH_ROLL,") >= 0 && coreSrcV14.indexOf("broadcast.onMessage(CH_ROLL_CLEAR,") >= 0 &&
  coreSrcV14.indexOf('if (role !== "GM") return;') >= 0)
  ok("城主落库：归一化 → 幂等合并 → 写 rolls（20 封顶）→ 广播 saved；非城主直接返回");
else bad("后台缺少骰子落库链路（rollNorm / rollMerge / rollWrite / 订阅 / GM 校验）");
if (bundleSrc2.indexOf("function rollNorm(") >= 0 && bundleSrc2.indexOf("var ROLL_MAX_ROWS = 20;") >= 0 &&
  bundleSrc2.indexOf("broadcast.onMessage(CH_ROLL,") >= 0)
  ok("background.bundle.js 已带上骰子落库（与 core 同步）");
else bad("bundle 里没有骰子落库代码（跑 node dev/build-background.mjs）");
if (dicePageSrc.indexOf("broadcast(CH_ROLL, payload)") >= 0 && dicePageSrc.indexOf('destination: "LOCAL"') >= 0 &&
  dicePageSrc.indexOf('destination: "REMOTE"') >= 0)
  ok("页面广播 CH_ROLL 同时发 LOCAL + REMOTE（投掷者自己也听得到）");
else bad("页面没有同时广播 LOCAL + REMOTE");
if (dicePageSrc.indexOf("OBR.broadcast.onMessage(CH_ROLL_SAVED") >= 0 && dicePageSrc.indexOf("meta[KEY_ROLLS]") >= 0)
  ok("页面订阅 CH_ROLL_SAVED，并从房间数据 com.4enext-owlbear/rolls 读历史");
else bad("页面没有订阅 CH_ROLL_SAVED / 没读房间数据");
/* v1.7.0：列表与黄条搬到记录窗口；骰子窗口这边只留「本机暂存 + 落库回执」。 */
const diceHistSrcV150 = fs.readFileSync(path.join(ROOT, "dice-history.html"), "utf8");
if (dicePageSrc.indexOf("rowsFromRaw") >= 0 && dicePageSrc.indexOf("LS_DICE_LOCAL") >= 0 &&
  diceHistSrcV150.indexOf("share-warn") >= 0 && diceHistSrcV150.indexOf('id="dh-warn"') >= 0)
  ok("落库回执 + 城主离线时本机暂存仍在；黄条与列表在记录窗口里");
else bad("本机暂存 / 记录窗口的黄条缺失");

/* ---- 5) 窗口加宽 + CSS ---- */
/* [v1.7.4 改] 520×620 → 320×620（用户要「窄而高」的竖条；仍会被 winSize 按视口夹紧） */
const diceWin = /dice: \{ id: ID_DICE_WIN, url: URL_DICE, width: (\d+), height: (\d+) \}/.exec(coreSrcV14);
if (diceWin && +diceWin[1] === 320 && +diceWin[2] === 620)
  ok("骰子窗口 320×620（v1.7.4 收窄：窄竖条；仍会被 winSize 按视口夹紧）");
else bad("骰子窗口尺寸不是 320×620：" + (diceWin ? diceWin[1] + "×" + diceWin[2] : "WINS.dice 没找到"));
/* [v1.7.4 改] 单列从「一格栅格」改成「flex 竖排」：上部 .dice-left 滚、底部 .dice-result 固定 */
if (/\.dice-cols \{[^}]*display: flex;[^}]*flex-direction: column/s.test(uiCssV14))
  ok("ui.css：单列（.dice-cols 是 flex 竖排，v1.7.4）");
else bad("ui.css 的 .dice-cols 不是 flex 竖排 / 找不到");
if (/\.dice-row \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s.test(uiCssV14))
  ok("ui.css：七颗骰子 4 + 3 两排（.dice-row repeat(4)）");
else bad("ui.css 缺少 .dice-row 四列栅格（320 宽下 7 颗排不下一排）");
if (/\.expr-input \{[^}]*height: 34px/s.test(uiCssV14) && uiCssV14.indexOf(".die-chip") >= 0 &&
  uiCssV14.indexOf(".hist-row") >= 0 && uiCssV14.indexOf(".btn.toggle.on") >= 0)
  ok("ui.css：表达式 34px / 骰子 chip / 历史行 / 开关按钮样式都在");
else bad("ui.css 缺少骰子窗口的新样式");

/* ---- 6) 预设 / 组合 / 文档 / 自测 / 版本 ---- */
if (dicePageSrc.indexOf('import("./dice-4e.js")') >= 0) ok("4E 预设有绑定卡时才动态 import（不拖慢开窗）");
else bad("dice-page.js 没有动态 import dice-4e.js");
if (dicePageSrc.indexOf("LS_DICE_COMBOS") >= 0 && dicePageSrc.indexOf("function saveCombos(") >= 0)
  ok("组合保存到本机 localStorage（4enext/dice/combos）");
else bad("组合保存缺失");
/* [v1.7.7] docs 合并：骰子实现说明 + 规格并进 NOTES.md */
if (notesHas("骰子动画手感")) ok("docs/NOTES.md：骰子动画 / 手感常数（FX_*）在哪还写着");
else bad("docs/NOTES.md 缺少「骰子动画手感」");
const selfSrc = fs.readFileSync(path.join(ROOT, "dev", "selftest.mjs"), "utf8");
if (selfSrc.indexOf("dev/test-dice.mjs") >= 0) ok("dev/selftest.mjs 加了 test-dice");
else bad("dev/selftest.mjs 没有加 dev/test-dice.mjs");
if (exists(path.join(ROOT, "dev", "test-dice.mjs"))) ok("dev/test-dice.mjs");
else bad("缺少 dev/test-dice.mjs");
const indexHtmlSrc = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0) ok("index.html 的版本标签也是 1.7.8");
else bad("index.html 的版本标签没升");
const readmeSrc = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
if (readmeSrc.indexOf("## ⭐ 安装地址") >= 0) ok("README 顶部「⭐ 安装地址」保留");
else bad("README 顶部的安装地址没了");
if (readmeSrc.indexOf("战斗优势") >= 0 && readmeSrc.indexOf("重击") >= 0 && readmeSrc.indexOf("团队共享") >= 0)
  ok("README 功能表写了骰子（战斗优势 / 重击 / 团队共享）");
else bad("README 功能表没有骰子");

console.log("== v1.6.0 血条扩展（临时生命 / 四防 / 蓝条）+ Boss 样式（方案 A）");
{
  const trackSrcV16 = fs.readFileSync(path.join(ROOT, "assets", "track.js"), "utf8");
  const infoSrcV16 = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
  const numConst = (src, name) => {
    const m = new RegExp("(?:export const |var )" + name + " = (\\d+(?:\\.\\d+)?);").exec(src);
    return m ? +m[1] : NaN;
  };

  /* ---- 1) 数据键：hp 新增字段 + 独立开关键（两端一字不差） ---- */
  const coreHpbar = (/var KEY_HPBAR = NS \+ "([^"]+)";/.exec(coreSrc2) || [])[1] || "";
  const trackHpbar = (/export const KEY_HPBAR = NS \+ "([^"]+)";/.exec(trackSrcV16) || [])[1] || "";
  if (coreHpbar === "/hp-bar/enabled" && trackHpbar === coreHpbar) {
    ok("血条开关是独立键 " + coreHpbar + "（不塞进 hp，两端一致）");
  } else bad("血条开关键不一致：core=" + coreHpbar + " track=" + trackHpbar);
  const coreTh = (/var KEY_PLAYER_THRESHOLD = NS \+ "([^"]+)";/.exec(coreSrc2) || [])[1] || "";
  const trackTh = (/export const KEY_PLAYER_THRESHOLD = NS \+ "([^"]+)";/.exec(trackSrcV16) || [])[1] || "";
  if (coreTh === "/settings.playerThreshold" && trackTh === coreTh) ok("玩家端量化阈值键一致：" + coreTh + "（缺省 25）");
  else bad("量化阈值键不一致：core=" + coreTh + " track=" + trackTh);
  for (const field of ["surgesMax", "defenses", "locked"]) {
    if (trackSrcV16.indexOf(field) >= 0 && coreSrc2.indexOf(field) >= 0) ok("hp 新字段两端都有：" + field);
    else bad("hp 新字段缺失：" + field);
  }
  /* [v1.8.0 删除] Boss 模式整组删除：hp.boss 只在 track.js 里**原样带过**（旧数据不丢），
   *   core 不再出现 boss（不读 / 不画 / 不参与任何分支）。 */
  if (trackSrcV16.indexOf("out.boss = raw.boss == null ? null : raw.boss;") >= 0 && coreSrc2.indexOf("boss") < 0) {
    ok("hp.boss：track.js 原样带过（旧数据不丢）、core 里已无 boss 分支");
  } else bad("hp.boss 处理不对（track 应原样带过、core 不应再出现 boss）");
  if (/out\.locked = raw\.locked !== false/.test(trackSrcV16) && /locked: m\.locked !== false/.test(coreSrc2)) {
    ok("locked 默认 true（玩家端锁定时隐藏数字）");
  } else bad("locked 默认值不是 true");
  /* [v1.7.9 改] Boss 模式整组删除：后台**不再读** hp.boss（readBoss 已删），只为旧数据保留字段。 */
  if (coreSrc2.indexOf("function readBoss(") < 0 && coreSrc2.indexOf("boss: readBoss(") < 0 &&
    coreSrc2.indexOf("M.boss") < 0) {
    ok("后台不再读 hp.boss（readBoss 已删；hp.boss 只为旧数据兼容而保留）");
  } else bad("后台还在读 hp.boss（v1.7.9 应该只保留字段、不再读取 / 绘制）");
  if (/export function defensesFromDerived\(/.test(trackSrcV16) && trackSrcV16.indexOf('ref: "reflex"') >= 0 &&
    glanceSrc.indexOf("reflex") < 0) {
    ok("四防 ref → reflex 只在 track.js 映射一处（渲染层只认 reflex）");
  } else bad("ref → reflex 映射分叉了（渲染层不能出现 reflex 名字）");

  /* ---- 2) 几何常数（像素常数集中表） ----
   * [v1.7.9 改] 直条 / 蓝条 / 名牌 / 锁的常数全删；环形血条的常数改名 HP_RING_*。 */
  const geom = {
    SHIELD_DIAMETER: 22, DEF_CIRCLE_DIAMETER: 22, DEF_CIRCLE_SEGMENTS: 24,
    SHIELD_INSET: 8, DEF_GAP: 6,
    HP_RING_THICK: 7, HP_RING_INSET: 2, HP_RING_SEGMENTS: 48, HP_RING_BG_OPACITY: 0.35
  };
  const geomBad = Object.keys(geom).filter((k) => numConst(coreSrc2, k) !== geom[k]);
  const goneConst = ["BAR_HP_H", "BAR_SURGE_H", "BAR_GAP", "BOSS_RING_THICK", "BOSS_RING_INSET",
    "BOSS_RING_SEGMENTS", "BOSS_PLATE_H", "BOSS_PLATE_GAP"].filter((k) => coreSrc2.indexOf("var " + k + " =") >= 0);
  if (!geomBad.length && !goneConst.length) {
    ok("像素常数（v1.8.0）：四防直径 22 / 24 段圆 / 四角内缩 8 / 环厚 7 / Ro 内缩 2 / 48 段 / 底环不透明度 0.35；" +
      "直条 / 蓝条 / 名牌 / 锁的常数已全删");
  } else bad("像素常数不对：" + geomBad.map((k) => k + "=" + numConst(coreSrc2, k)).concat(
    goneConst.map((k) => k + " 不该还在")).join(" "));
  if (/var COLOR_HP_BLOODIED = "#7f1416";/.test(coreSrc2) && /var COLOR_HP_FILL = "#a52424";/.test(coreSrc2)) {
    ok("血怒色 COLOR_HP_BLOODIED = #7f1416（v1.8.0：cur ≤ max/2 时环换深红，正常色仍是 #a52424）");
  } else bad("缺少血怒色 COLOR_HP_BLOODIED=#7f1416（或正常血条色 #a52424 被改了）");
  if (/var PLAYER_THRESHOLD_DEFAULT = 25;/.test(coreSrc2) && /function quantiseRatio\(/.test(coreSrc2)) {
    ok("玩家端 quantiseRatio + 阈值 25");
  } else bad("缺少 quantiseRatio / PLAYER_THRESHOLD_DEFAULT");
  if (/"shield": 15000/.test(coreSrc2) && /"shield-text": 16000/.test(coreSrc2) &&
    /"bar-text": 30000/.test(coreSrc2) && /"ring-bg": 9500/.test(coreSrc2) &&
    /"ring-fill": 9800/.test(coreSrc2) && coreSrc2.indexOf('"lock-body"') < 0 &&
    coreSrc2.indexOf('"bar-fill"') < 0) {
    ok("zIndex：环底 9500 / 环填充 9800 / 盾 15000 / 盾数字 16000 / HP 数字 30000（固定 + disableAutoZIndex）；" +
      "直条 / 锁的 role 已删");
  } else bad("zIndex 表不对（环底 / 环填充 / 盾 / 盾数字 / HP 数字）");

  /* ---- 3) 形状全部用 Curve 手绘（SDK 没有 RING / 盾牌） ---- */
  if (/function ringSectorPoints\(/.test(coreSrc2) && /function shieldPoints\(/.test(coreSrc2) &&
    /function circlePoints\(/.test(coreSrc2) &&
    /ringSectorPoints\(R\.Ro, R\.Ri/.test(coreSrc2) && /shieldPoints\(sh\.d, sh\.d\)/.test(coreSrc2) &&
    /circlePoints\(sh\.d, DEF_CIRCLE_SEGMENTS\)/.test(coreSrc2)) {
    ok("环形扇区 / 盾形多边形 / 圆形都用 buildCurve().points() 手绘（环在所有 token 上复用）");
  } else bad("环形 / 盾形 / 圆形没有用 Curve 手绘");
  if (coreSrc2.indexOf("buildShape(") < 0) ok("没有用 buildShape（SDK 3.1.0 只有四种形状，做不出环 / 盾）");
  else bad("血条里调用了 buildShape（做不出环 / 盾，规格 §5.4）");

  /* ---- 4) 布局：**环形血条**（所有 token）+ **四角四防**；直条 / 蓝条 / Boss 全删 ---- */
  /* [v1.7.9 改] 这里原来断言「两行直条 + Boss 压制」与「四防一排」，现在整段换成环形 + 四角。 */
  if (/var ringRo = Math\.max\(0, halfShort - RING_INSET \* s\);/.test(coreSrc2) &&
    /var ringT = Math\.min\(RING_THICK \* s, ringRo \* 0\.9\);/.test(coreSrc2) &&
    /var ringRi = Math\.max\(0, ringRo - ringT\);/.test(coreSrc2) &&
    /var RING_SEGMENTS = HP_RING_SEGMENTS;/.test(coreSrc2) &&
    /var availR = Math\.max\(0, ringRi - 1\.5 \* s\);/.test(coreSrc2) &&
    /if \(!hpTextFits\) \{ hpText = ""/.test(coreSrc2) &&
    /var hpText = exact \? \(String\(cur\) \+ "\/" \+ max/.test(coreSrc2)) {
    ok("环形血条几何（v1.8.0）：Ro = max(0, 半短边 − 2s)、环厚 = min(7s, 0.9·Ro)、Ri = Ro − 环厚、48 段；" +
      "HP 数字仍按 cur/max 生成，并在内圆拟合（装不下自动降字号，绝不裁切）");
  } else bad("环形血条的几何公式不对（Ro / 环厚 / Ri / 段数 / HP 数字内圆拟合）");
  if (/var DEF_CORNER = \{/.test(coreSrc2) &&
    /fort: "left-top"/.test(coreSrc2) && /reflex: "right-top"/.test(coreSrc2) &&
    /will: "left-bottom"/.test(coreSrc2) && /ac: "right-bottom"/.test(coreSrc2) &&
    /var needTwo = 2 \* dRow \+ inset \* 2;/.test(coreSrc2) &&
    /rowKeys\.splice\(at, 1\)/.test(coreSrc2) &&
    /var DEF_DROP = \["will", "reflex", "fort"\];/.test(coreSrc2)) {
    ok("四防四角（v1.7.9）：左上强韧 / 右上反射 / 左下意志 / 右下 AC；" +
      "窄 token 按 DEF_DROP 先丢意志 / 反射 / 强韧（AC 最后才丢）");
  } else bad("四防四角的坐标 / 退化规则不对（DEF_CORNER / needTwo / DEF_DROP）");
  if (coreSrc2.indexOf("hpVisible") < 0 && coreSrc2.indexOf("showSurge") < 0 &&
    coreSrc2.indexOf("surgeTop") < 0 && coreSrc2.indexOf("ringRatio") < 0) {
    ok("直条 / 蓝条 / Boss 压制的代码都已删除（没有 hpVisible / showSurge / surgeTop / ringRatio）");
  } else bad("还留着直条 / 蓝条 / Boss 压制的代码");
  if (/"ring-bg"/.test(coreSrc2) && /"ring-fill"/.test(coreSrc2) && /"shield"/.test(coreSrc2) &&
    /"shield-text"/.test(coreSrc2) && /"bar-text"/.test(coreSrc2) &&
    coreSrc2.indexOf('"plate-phase"') < 0 && coreSrc2.indexOf('"lock-shackle"') < 0 &&
    coreSrc2.indexOf('"divider"') < 0) {
    ok("role 表只剩 5 种：环底 / 环填充 / 盾 / 盾数字 / HP 数字（牌 / 分段 / 锁的 role 已删）");
  } else bad("role 表不对（应只有环 / 盾 / 数字；牌 / 分段 / 锁必须删掉）");

  /* ---- 5) 右键：血条两项 + 编辑血条（Boss 两项已删） ---- */
  const menuIds = ["/hpbar-add", "/hpbar-remove", "/hpbar-edit"];
  const missingMenu = menuIds.filter((id) => coreSrc2.indexOf('id: NS + "' + id + '"') < 0);
  if (!missingMenu.length) ok("右键菜单独立注册（hpbar-add / hpbar-remove / hpbar-edit）");
  else bad("右键菜单缺项：" + missingMenu.join(" / "));
  const bossMenuLeft = ["/boss-show", "/boss-hide"].filter((id) => coreSrc2.indexOf('id: NS + "' + id + '"') >= 0);
  if (bossMenuLeft.length) bad("右键还注册了 Boss 菜单：" + bossMenuLeft.join(" / "));
  else ok("右键**没有**「显示为 Boss / 隐藏 Boss」两项（v1.7.9 删除）");
  for (const label of ["添加血条组件", "移除血条组件", "编辑血条"]) {
    if (coreSrc2.indexOf(label) >= 0) ok("右键文案：" + label);
    else bad("右键文案缺失：" + label);
  }
  if (coreSrc2.indexOf('label: "显示为 Boss"') < 0 && coreSrc2.indexOf('label: "隐藏 Boss 血条"') < 0) {
    ok("Boss 两项的菜单文案也不在了");
  } else bad("还能找到「显示为 Boss / 隐藏 Boss 血条」的菜单文案");
  if (/operator: "!=", value: true/.test(coreSrc2)) ok("菜单 filter 用 operator:\"!=\"（同时覆盖 undefined 与 false）");
  else bad("菜单 filter 没有用 operator:\"!=\"");
  if (/d\.metadata\[KEY_HPBAR\] = !!on;/.test(coreSrc2) && coreSrc2.indexOf("delete d.metadata[KEY_HPBAR]") < 0) {
    ok("「移除血条组件」写 false，不 delete（否则下次刷新会自动加回来）");
  } else bad("移除血条组件没有写 false / 还在 delete");
  if (coreSrc2.indexOf("function writeBossFlag(") < 0 && coreSrc2.indexOf("order: conf.order") < 0) {
    ok("writeBossFlag 已删（不会再往 hp.boss 写开关）");
  } else bad("还留着 writeBossFlag / 往 hp.boss 写开关的代码");

  /* ---- 6) 速览联动：蓝条 / 锁 / Boss ----
   * [v1.6.2 移除] 速览里那条「彩色四防箭头条」按用户要求删掉了（gl4-def-row / data-act="defense"），
   * 这里只保留锁 / Boss 的联动断言；「彩条已删、数值卡还在」由 v1.6.2 那一节单独断言。 */
  if (glanceSrc.indexOf('data-act="lock"') >= 0 && glanceSrc.indexOf('data-act="boss"') < 0 &&
    glanceSrc.indexOf("共享数据") >= 0 && glanceSrc.indexOf("gl4-share") >= 0) {
    ok("速览弹窗：只剩「共享数据」开关（Boss 开关已删；开 = 共享）");
  } else bad("速览弹窗的共享数据 / Boss 开关不对（应有 lock + 共享数据、不该有 boss）");
  if (glanceSrc.indexOf("gl4-surgebar") >= 0 && glanceSrc.indexOf("surgesMax") >= 0) {
    ok("速览弹窗：回复力蓝条 + 分母优先用 token 的 surgesMax");
  } else bad("速览弹窗缺少回复力蓝条 / surgesMax");
  /* [v1.6.2 移除] 盾形四防 chip 的样式随彩条一起删了（.gl4-def-row / .gl4-def-chip），
   * 这里改断言「蓝条 6px + 四防数值卡 + 锁 / Boss 一排」。 */
  if (/\.gl4-surgebar \{[^}]*height: 6px/s.test(cssSrc) && /\.gl4-defs \{/.test(cssSrc) &&
    cssSrc.indexOf(".gl4-share") >= 0 && cssSrc.indexOf(".gl4-lock-row") < 0 && cssSrc.indexOf(".gl4-boss-row") < 0) {
    ok("glance.css：回复力蓝条 6px + 四防数值卡（.gl4-defs）+ 共享数据 chip（.gl4-share；锁 / Boss 那排已删）");
  } else bad("glance.css 缺少速览的蓝条 / 四防数值卡 / 共享数据样式");
  if (trackSrcV16.indexOf('act === "defense" || act === "lock"') >= 0 &&
    trackSrcV16.indexOf("export async function syncTokenStats(") >= 0 &&
    infoSrcV16.indexOf("syncTokenStats(") >= 0) {
    ok("track.js 的 defense / lock 两个 act + syncTokenStats（速览刷新时补写四防 / 分母；boss 分支 v1.8.0 已删）");
  } else bad("track.js 缺少 defense / lock 或 syncTokenStats");
  if (/surgesMax: derived\.surgesMax \|\| derived\.surges/.test(infoSrcV16) && /defenses: derived\.defenses/.test(infoSrcV16)) {
    ok("info.js 把 surgesMax / defenses 传进 applyAction");
  } else bad("info.js 没有把新字段传进 applyAction");

  /* ---- 7) 文档 / 规格 / 版本 / bundle ----
   * [v1.7.7] docs 合并：hpbar-boss-v16.md 与 spec-hpbar-boss.md 都并进 docs/NOTES.md，
   * 这里改查「血条 / 四防的量在哪调」这一行还在不在。 */
  if (notesHas("token 血条/四防的位置与尺寸") && notesHas("barLayout")) {
    ok("docs/NOTES.md：血条 / 四防常数在哪（DEF_* / rowCY / barLayout）写着");
  } else bad("docs/NOTES.md 缺少血条 / 四防常数的维护口径");
  if (readmeSrc.indexOf("血条扩展") >= 0 && readmeSrc.indexOf("临时生命") >= 0 &&
    readmeSrc.indexOf("四防") >= 0 && readmeSrc.indexOf("环形") >= 0) {
    ok("README 功能表写了血条扩展（临时生命 / 四防 / 环形血条）；Boss 那一行已删");
  } else bad("README 功能表没有血条扩展 / 环形血条");
  if (verOf(commonSrc) === VER && verOf(coreSrc2) === VER) ok("PLUGIN_VERSION = 1.7.8");
  else bad("PLUGIN_VERSION 不是 1.7.8：" + verOf(commonSrc) + " / " + verOf(coreSrc2));
  if (bundleSrc2.indexOf("ringSectorPoints(") >= 0 && bundleSrc2.indexOf("shieldPoints(") >= 0 &&
    bundleSrc2.indexOf("KEY_HPBAR") >= 0) {
    ok("bundle 里带 v1.6.0 的环 / 盾 / 血条开关（已重新构建）");
  } else bad("bundle 落后于 core（跑 node dev/build-background.mjs）");
}

console.log("== v1.6.2 速览删彩条 + 先攻条宽高改常量");
{
  const glanceV162 = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
  const cssV162 = fs.readFileSync(path.join(ROOT, "assets", "glance.css"), "utf8");
  const initV162 = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
  const pageV162 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const coreV162 = fs.readFileSync(corePath, "utf8");
  const uiV162 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");

  /* ---- 1) 速览：彩色四防箭头条删干净，四防数值卡留着 ----
   * 用 stripComments 去掉注释再查：glance.js / glance.css 里会留一句「v1.6.2 删掉了 …」的说明。 */
  const glanceCode = stripComments(glanceV162);
  const cssCode = stripComments(cssV162);
  if (glanceCode.indexOf("gl4-def-row") < 0 && glanceCode.indexOf("gl4-def-chip") < 0 &&
    glanceCode.indexOf('data-act="defense"') < 0) {
    ok("速览里没有彩色四防条（gl4-def-row / gl4-def-chip / data-act=\"defense\" 都已删）");
  } else bad("速览里还有 HP 绿条下面那条彩色四防条（用户明确不要）");
  if (glanceV162.indexOf('class="gl4-card gl4-defs"') >= 0 && /d\.defenses\.map/.test(glanceV162) &&
    glanceV162.indexOf('class="gl4-def-val"') >= 0) {
    ok("四防数值卡还在（.gl4-defs：AC / 强韧 / 反射 / 意志 —— 用户要改的就是这四个数）");
  } else bad("四防数值卡被一起删掉了（用户要的是留着数值、删掉彩条）");
  if (cssCode.indexOf(".gl4-def-chip") < 0 && cssCode.indexOf(".gl4-def-row") < 0) {
    ok("glance.css 里没有四防彩条的死样式（跟着删干净）");
  } else bad("glance.css 里还留着 .gl4-def-row / .gl4-def-chip 的死样式");
  if (glanceV162.indexOf("gl4-hpbar") >= 0 && glanceV162.indexOf("gl4-surgebar") >= 0 &&
    glanceV162.indexOf("gl4-share") >= 0 && glanceV162.indexOf("gl4-hp-pad") >= 0) {
    ok("速览其它块没被误删（HP 绿条 / 回复力蓝条 / 血量按钮 / 共享数据）");
  } else bad("速览的 HP 绿条 / 蓝条 / 血量按钮 / 共享数据被误删了");

  /* ---- 2) 先攻条：宽高是常量，没有「按内容测量」 ---- */
  const stripFnV162 = (/export function stripSizeFor\([^)]*\) \{[\s\S]*?\n\}/.exec(initV162) || [])[0] || "";
  if (stripFnV162 && /STRIP_EXPANDED_W/.test(stripFnV162) && !/\+\s*16\b/.test(stripFnV162) &&
    !/cluster/i.test(stripFnV162) && /STRIP_MIN_EXPANDED_W/.test(stripFnV162)) {
    ok("stripSizeFor 返回常量宽度（720，仅视口太窄时缩到 410 下限；不再 max(410, 测量值+16)）");
  } else bad("stripSizeFor 还在按测量值算宽度（v1.6.1 的「随投骰变窄」会复发）");
  const applyFnV162 = (/async function applySize\(\) \{[\s\S]*?\n\}/.exec(pageV162) || [])[0] || "";
  if (applyFnV162 && applyFnV162.indexOf("scrollWidth") < 0 && applyFnV162.indexOf("getBoundingClientRect") < 0 &&
    applyFnV162.indexOf("querySelector") < 0 && /stripSizeFor\(phase, collapsed, vw\)/.test(applyFnV162)) {
    ok("页面 applySize() 不再量 DOM（没有 scrollWidth / getBoundingClientRect / querySelector 参与尺寸）");
  } else bad("页面 applySize() 还在量内容宽度（尺寸会随内容变）");
  if (!/measureWidth/.test(glanceV162 + initV162 + coreV162 + pageV162)) {
    ok("全仓没有 measureWidth 之类的内容测量调用");
  } else bad("还留着 measureWidth（按内容测量尺寸）");
  if (/function snapStripSize\(/.test(coreV162) && /var STRIP_H_ALLOWED = \[STRIP_H_IDLE, STRIP_H_PREPARING, STRIP_H_COMBAT\];/.test(coreV162) &&
    /var snapped = snapStripSize\(w, h\);/.test(coreV162)) {
    ok("后台 snapStripSize()：页面报上来的宽高必须落回常量（按内容测量的数字一律丢弃）");
  } else bad("后台没有 snapStripSize 兜底（旧缓存页面仍可能把测量宽度带回来）");
  if (/\.strip-items \{[^}]*overflow-x: auto/s.test(uiV162)) {
    ok("ui.css：卡片区内部横向滚动（overflow-x:auto）");
  } else bad("ui.css 的 .strip-items 缺少横向滚动");
  /* [v1.7.3 改] 深色底已按用户要求去掉（右侧空列表区域要透出地图），见文件末尾的 v1.7.3 一节。 */
  if (/var STRIP_H_IDLE = 170;/.test(coreV162) && /var STRIP_H_PREPARING = 180;/.test(coreV162) &&
    /var STRIP_H_COMBAT = 200;/.test(coreV162) && /var STRIP_COLLAPSED_W = 120;/.test(coreV162) &&
    /var STRIP_COLLAPSED_H = 40;/.test(coreV162) && /var STRIP_EXPANDED_W = 720;/.test(coreV162)) {
    ok("宽高常量：折叠 120×40 / 展开 720×(170|180|200)（v1.7.10 加高，不裁切）");
  } else bad("先攻条的宽高常量被动过了");

  /* ---- 3) 版本 / manifest / 文档 ---- */
  if (man.version === VER && manRel.version === VER) ok("两个 manifest 的版本都是 1.7.8");
  else bad("manifest 版本不是 1.7.8：" + man.version + " / " + manRel.version);
  if (!man.action) ok("manifest 仍然没有 action 字段（真机验证过无 action 能加载，别再加回来）");
  else bad("manifest 又加回了 action 字段（v1.6.1 已确认不需要）");
  if (verOf(commonSrc) === VER && verOf(coreV162) === VER) ok("PLUGIN_VERSION = 1.7.8");
  else bad("PLUGIN_VERSION 不是 1.7.8：" + verOf(commonSrc) + " / " + verOf(coreV162));
  /* [v1.7.7] docs 合并：v1.6.2 的说明并进 docs/NOTES.md（先攻条尺寸那一行） */
  if (notesHas("先攻条尺寸") && notesHas("STRIP_H_ALLOWED")) {
    ok("docs/NOTES.md：先攻条宽高常量改哪（STRIP_H_ALLOWED / stripSizeFor）写着");
  } else bad("docs/NOTES.md 缺少先攻条宽高常量的维护口径");
  if (readmeSrc.indexOf("v1.7.0") >= 0 && readmeSrc.indexOf("## ⭐ 安装地址") >= 0) {
    ok("README 功能表同步了 v1.7.0，且顶部「⭐ 安装地址」还在");
  } else bad("README 没有同步 v1.7.0 / 安装地址被动了");
}

console.log("== v1.7.0 骰子记录窗口 + 投骰动画 + 去豁免 / 先攻预设");
{
  const coreV17 = fs.readFileSync(corePath, "utf8");
  const commonV17 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const diceCoreV17 = fs.readFileSync(path.join(ROOT, "assets", "dice-core.js"), "utf8");
  const dicePageV17 = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const dice4eV17 = fs.readFileSync(path.join(ROOT, "assets", "dice-4e.js"), "utf8");
  const histHtmlV17 = fs.readFileSync(path.join(ROOT, "dice-history.html"), "utf8");
  const histJsV17 = fs.readFileSync(path.join(ROOT, "assets", "dice-history-page.js"), "utf8");
  const effectHtmlV17 = fs.readFileSync(path.join(ROOT, "effect.html"), "utf8");
  const effectJsV17 = fs.readFileSync(path.join(ROOT, "assets", "effect-page.js"), "utf8");
  const setHtmlV17 = fs.readFileSync(path.join(ROOT, "settings.html"), "utf8");
  const setJsV17 = fs.readFileSync(path.join(ROOT, "assets", "settings-page.js"), "utf8");
  const uiV17 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const testDiceV17 = fs.readFileSync(path.join(ROOT, "dev", "test-dice.mjs"), "utf8");
  /* 动画页 / 记录页的「代码」：去掉注释再查（注释里写「不引用外部库」不该被自己判成违规）。 */
  const fxCode = stripComments(effectHtmlV17 + "\n" + effectJsV17 + "\n" + histHtmlV17 + "\n" + histJsV17);

  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  /* ---- 1) 记录窗口：独立 id、注册进 WINS、可拖动（复用 window.js） ---- */
  const grab = (src, head, tail) => {
    const i = src.indexOf(head);
    if (i < 0) return "";
    const j = src.indexOf(tail, i + head.length);
    return j < 0 ? "" : src.slice(i + head.length, j);
  };
  const coreHistId = grab(coreV17, "var ID_DICE_HIST = NS + \"", "\";");
  const commonHistId = grab(commonV17, "export const ID_DICE_HIST = NS + \"", "\";");
  if (coreHistId && coreHistId === commonHistId) ok("记录窗口 popover id 两端一致：" + coreHistId);
  else bad("记录窗口 id 不一致：core=" + coreHistId + " common=" + commonHistId);
  const diceWinIdV17 = grab(coreV17, "var ID_DICE_WIN = NS + \"", "\";");
  if (coreHistId && diceWinIdV17 && coreHistId !== diceWinIdV17)
    ok("记录窗口 id 与骰子窗口不同（两个窗口可以同时开着）：" + diceWinIdV17 + " ≠ " + coreHistId);
  else bad("记录窗口 id 与骰子窗口重了（同时开会被顶掉）");
  if (has(coreV17, 'var URL_DICE_HIST = pageUrl("dice-history.html");') &&
    has(commonV17, 'export const URL_EFFECT = new URL("effect.html", URL_BASE).href;'))
    ok("URL_DICE_HIST → dice-history.html（后台开记录窗口）；URL_EFFECT → effect.html（骰子窗口开动画）");
  else bad("background.core.js 没有把 dice-history.html / effect.html 接进地址表");
  if (has(coreV17, "diceHistory: { id: ID_DICE_HIST, url: URL_DICE_HIST, width: "))
    ok("background.core.js 的 WINS 注册了 diceHistory（id + 页面 + 尺寸：可拖动 / 记位置 / 视口夹紧）");
  else bad("background.core.js 的 WINS 没有注册 diceHistory");
  if (has(coreV17, "function diceHistoryIsOpen(") && has(coreV17, "async function openDiceHistory(") &&
    has(coreV17, "async function closeDiceHistory(") && has(coreV17, "async function onDiceHistCmd(") &&
    has(coreV17, "broadcast.onMessage(CH_DICE_HIST_CMD"))
    ok("后台：开 / 关记录窗口 + 订阅 CH_DICE_HIST_CMD（onDiceHistCmd）");
  else bad("后台缺少记录窗口的开关链路（openDiceHistory / closeDiceHistory / onDiceHistCmd / 订阅）");
  for (const name of ["CH_DICE_HIST_CMD", "CH_DICE_HIST_STATE"]) {
    const a = grab(coreV17, "var " + name + " = NS + \"", "\";");
    const b = grab(commonV17, "export const " + name + " = NS + \"", "\";");
    if (a && a === b) ok("记录窗口频道一致：" + name + " = " + a);
    else bad("记录窗口频道不一致：" + name + " core=" + a + " common=" + b);
  }
  if (has(coreV17, "broadcastDiceHistState()") && has(dicePageV17, "CH_DICE_HIST_STATE") &&
    has(dicePageV17, "setHistButton"))
    ok("开 / 关状态会广播回页面，骰子窗口的按钮据此显示「记录窗口 · 开 / 关」");
  else bad("记录窗口的开 / 关状态没有回传（按钮不会变）");
  if (has(histJsV17, 'createWindow({ name: "diceHistory" })') && has(histHtmlV17, 'id="head"') &&
    has(histHtmlV17, 'id="pin"'))
    ok("记录窗口用 window.js 的 createWindow（拖动 / 位置记忆 / 后台检测与其它窗口同一套）");
  else bad("记录窗口没有用 window.js 的 createWindow（另造了一套拖动？）");
  if (has(histHtmlV17, 'id="dh-list"') && has(histHtmlV17, "dh-list compact") &&
    has(uiV17, ".dh-list.compact .dh-row:nth-child(n + 5)"))
    ok("记录窗口默认只显示最近 4 条（.dh-list.compact 隐藏第 5 条起）");
  else bad("记录窗口没有「最近 4 条」的实现（compact 规则 / CSS 缺）");
  if (has(histJsV17, "展开全部") && has(histJsV17, "compact"))
    ok("「展开全部」把 compact 去掉 → 看全部（最多 20 条，列表内滚动）");
  else bad("记录窗口没有展开 / 收起切换");
  if (has(histHtmlV17, 'id="dh-toggle"') && has(histHtmlV17, 'id="dh-meta"') && has(histHtmlV17, "共 0 / 20 条"))
    ok("记录窗口有「共 N / 20 条」与展开按钮");
  else bad("记录窗口缺少计数 / 展开按钮");

  /* ---- 2) 20 条封顶 = 删最旧（v1.8.0：40 → 20） ---- */
  if (has(diceCoreV17, "return list.slice(0, limit);") &&
    has(diceCoreV17, "list.sort(function (a, b) { return numOr(b.ts, 0) - numOr(a.ts, 0); });") &&
    (has(coreV17, "超过 20 条时删掉最旧") || has(diceCoreV17, "超过 20 条时删掉最旧")))
    ok("20 条封顶是「倒序后 slice(0,20)」= 删最旧（core 里也写明了）");
  else bad("封顶逻辑不是「倒序后砍尾巴」（可能只截断显示）");
  if (has(testDiceV17, "最旧") && has(testDiceV17, "mergeRollRows") && has(testDiceV17, "21 条"))
    ok("dev/test-dice.mjs 有「21 条 → 20 且最旧的被删」的断言");
  else bad("dev/test-dice.mjs 没有钉住「超过 20 删最旧」");

  /* ---- 3) 去豁免 / 先攻预设 ---- */
  const code4e = stripComments(dice4eV17);
  if (has(code4e, 'key: "attack"') && has(code4e, 'key: "damage"') && has(code4e, 'key: "skill"') &&
    !has(code4e, 'key: "save"') && !has(code4e, 'key: "init"'))
    ok("4E 预设只剩 攻击 / 伤害 / 技能（豁免、先攻已删）");
  else bad("4E 预设分组不对（该只剩 attack / damage / skill）");
  if (!has(code4e, "豁免") && !has(code4e, "先攻"))
    ok("dice-4e.js 的代码里不再出现「豁免」「先攻」");
  else bad("dice-4e.js 里还有豁免 / 先攻预设");
  /* [v1.7.6 改] 预设区右上角的「… · 只填公式，不判定」说明小字被删了（用户：只留功能本身），
   * 这里改成断言「不再出现五组预设的说法」，也不再要求那句说明。 */
  /* 注释里还会写「只填公式」这类历史说明，所以先剥注释再查（真正渲染的代码里不该再有）。 */
  if (!has(stripComments(dicePageV17), "initiativeBonus") && !has(stripComments(dicePageV17), "只填公式") &&
    !has(stripComments(dicePageV17), "五组预设"))
    ok("骰子窗口不再写「只填公式 / 五组预设」这类说明（预设只剩攻击 / 伤害 / 技能的功能本身）");
  else bad("骰子窗口还留着五组预设 / 只填公式的说明");

  /* ---- 4) 动画常量（dice-core.js）与 CSS 关键帧一一对应 ---- */
  const WANT_FX = {
    FX_MAX_DICE: "20", FX_BASE_MAX: "128", FX_BASE_MIN: "72", FX_BASE_DECAY: "0.86", FX_GAP_RATIO: "0.16",
    FX_PER_ROW: "4", FX_FLIGHT_MS: "1200", FX_HOLD_MS: "500", FX_PUNCH_MS: "360", FX_HOLD2_MS: "220",
    FX_EXIT_MS: "320", FX_SLOT_MS: "55", FX_N_ARCS: "4", FX_ARC_RATIO: "0.55", FX_ARC_H0: "240",
    FX_SQUASH: "0.18", FX_STRETCH: "0.08", FX_ROT_BASE: "720", FX_PUNCH_SCALE: "1.18"
  };
  const fxVal = (k) => grab(diceCoreV17, "export const " + k + " = ", ";");
  const fxBad = Object.keys(WANT_FX).filter((k) => fxVal(k) !== WANT_FX[k]);
  if (!fxBad.length) ok("动画常量与规格一致（128 / 0.86 / 72 / 1200 / 500 / 360 / 220 / 320 / 55 / 4 段 / 0.55 / 240 / 0.18 / 0.08 / 720 / 1.18）");
  else bad("动画常量不对：" + fxBad.map((k) => k + "=" + (fxVal(k) || "缺")).join(" "));
  const coreExports = ["fxBaseSize", "fxDieSize", "fxArcProfile", "fxBeat", "fxLayout", "fxQuery"];
  const missFxFn = coreExports.filter((n) => !has(diceCoreV17, "export function " + n + "("));
  if (!missFxFn.length) ok("dice-core.js 导出 fxBaseSize / fxDieSize / fxArcProfile / fxBeat / fxLayout / fxQuery（纯函数，node 可测）");
  else bad("dice-core.js 缺少动画纯函数：" + missFxFn.join(" / "));
  if (has(diceCoreV17, "FX_BASE_MAX * Math.pow(FX_BASE_DECAY, count - 1)") &&
    has(diceCoreV17, "Math.max(FX_BASE_MIN, Math.round(") &&
    has(diceCoreV17, "totalTop: Math.round(-baseSize / 2 - 64)") &&
    has(diceCoreV17, "modTop: Math.round(lastRowOy + baseSize / 2 + 28)"))
    ok("尺寸公式 BASE=128*0.86^(N-1) 最小 72；附属元素 top = -BASE/2-64 / lastRowOy+BASE/2+28（规格 §4.2）");
  else bad("基准尺寸 / 附属元素定位公式不对");
  const CSS_FX = [
    ["飞行关键帧", "@keyframes fx-flight"], ["挤压关键帧", "@keyframes fx-squash"],
    ["赢家放大", "@keyframes fx-punch"], ["淡出", "@keyframes fx-exit"],
    ["数字老虎机", "@keyframes fx-slot"], ["暴击光圈", "@keyframes fx-burst"]
  ];
  const cssMiss = CSS_FX.filter((one) => !has(uiV17, one[1]));
  if (!cssMiss.length) ok("ui.css 有全部动画关键帧（飞行 / 挤压 / 放大 / 淡出 / 老虎机 / 光圈）");
  else bad("ui.css 缺少关键帧：" + cssMiss.map((one) => one[0]).join(" / "));
  const arcPct = ["49.53%", "76.77%", "91.76%", "100%"];
  const arcH = ["-240px", "-72.6px", "-21.96px", "-6.64px"];
  if (!arcPct.filter((x) => !has(uiV17, x)).length && !arcH.filter((x) => !has(uiV17, x)).length)
    ok("四段抛物线写进了 CSS（累计 49.53% / 76.77% / 91.76% / 100%，弧高 240 / 72.6 / 21.96 / 6.64）");
  else bad("CSS 关键帧的抛物线百分比 / 弧高与公式不一致");
  if (has(uiV17, "scale(1.18, 0.82)") && has(uiV17, "scale(1, 1.08)") && has(uiV17, "fx-punch 360ms") &&
    has(uiV17, "fx-exit 320ms") && has(uiV17, "fx-slot 55ms"))
    ok("挤压 0.18 / 拉伸 0.08 / PUNCH 360ms / EXIT 320ms / 老虎机 55ms 都写在 CSS 里");
  else bad("CSS 里的挤压 / 拉伸 / 时长与常量不一致");
  if (has(uiV17, "fx-flight var(--fx-flight, 1200ms)") && has(effectJsV17, "--fx-flight"))
    ok("每颗骰子的飞行时长由 fxBeat 写到 --fx-flight（CSS 默认 1200ms）");
  else bad("飞行时长没有从 fxBeat 传到 CSS");

  /* ---- 5) 动画页 + modal 参数 + 无外部库 ---- */
  if (has(effectHtmlV17, 'class="fx-stage"') && has(effectHtmlV17, 'body class="fx-page"') &&
    has(effectHtmlV17, 'id="fx-wrap"') && has(effectHtmlV17, 'id="fx-total"') && has(effectHtmlV17, 'id="fx-mod"'))
    ok("effect.html：透明舞台 + 骰子组 + 当前总和 + 加值盒");
  else bad("effect.html 缺元素（fx-stage / fx-wrap / fx-total / fx-mod）");
  if (has(uiV17, ".fx-stage * { pointer-events: none") && has(uiV17, ".fx-stage { position: fixed; inset: 0") &&
    has(uiV17, "background: transparent !important"))
    ok("动画层全屏透明且 pointer-events:none（不挡鼠标，动画期间仍可平移 / 选中）");
  else bad("动画层不是「全屏 + 透明 + 不挡鼠标」");
  for (const one of [["fullScreen", "fullScreen: true"], ["hideBackdrop", "hideBackdrop: true"],
    ["hidePaper", "hidePaper: true"], ["disablePointerEvents", "disablePointerEvents: true"]]) {
    if (has(dicePageV17, one[1])) ok("modal 参数：" + one[0] + "（规格 §4.1 逐字）");
    else bad("modal 参数缺少 " + one[0]);
  }
  if (has(dicePageV17, "OBR.modal.open(") && has(dicePageV17, 'URL_EFFECT + "?" + fxQuery(row, origin)'))
    ok("骰子窗口用 OBR.modal.open 打开 effect.html（参数由 fxQuery 组装）");
  else bad("骰子窗口没有打开动画页 / 参数不是 fxQuery 组装的");
  if (has(dicePageV17, "async function playEffect(") && has(dicePageV17, "投骰动画打不开（不影响结果）"))
    ok("playEffect 有降级：动画打不开只提示一句，投掷 / 结果不受影响");
  else bad("动画没有降级路径（打不开会静默或抛错）");
  if (has(dicePageV17, "if (effectModalId)") && has(dicePageV17, "OBR.modal.close(effectModalId)"))
    ok("连续投掷会先关掉上一个动画 modal（不会叠层）");
  else bad("连续投掷没有关掉上一个 modal");
  if (has(effectJsV17, "fxLayout(") && has(effectJsV17, "fxBeat(") &&
    has(effectJsV17, "requestAnimationFrame") && has(effectJsV17, "--tx") && has(effectJsV17, "--ty"))
    ok("动画页用 fxLayout / fxBeat 摆位与排时间轴，rAF 只做世界→屏幕投影（--tx / --ty）");
  else bad("动画页没有用纯函数的布局 / 时间轴，或没有投影");
  if (has(effectJsV17, "state.world.x * state.scale + state.vp.x") &&
    has(effectJsV17, "state.world.y * state.scale + state.vp.y"))
    ok("屏幕投影公式 sx = worldX*scale + vp.x / sy = worldY*scale + vp.y（规格 §4.3）");
  else bad("投影公式不是 sx = worldX*scale + vp.x");
  const EXT = /(?:src|href)="https?:|<script[^>]+https?:|cdn\.|unpkg|jsdelivr|jquery|gsap|three\.min/i;
  if (!EXT.test(fxCode)) ok("动画页 / 记录页没有引用任何外部库或 CDN（纯 CSS + 原生 JS）");
  else bad("动画页 / 记录页引用了外部资源（不允许）");
  if (has(effectJsV17, "later(function () { void finish(); }, b.total)") && has(effectJsV17, "function finish(") &&
    has(effectJsV17, "clearInterval(state.slotTimer)") && has(effectJsV17, "cancelAnimationFrame(state.raf)"))
    ok("播完（FX_TOTAL_MS）自己关闭并清理定时器 / rAF（DOM 不累积）");
  else bad("动画播完没有自动关闭 / 没有清理");

  /* ---- 6) 设置里的开关 ---- */
  if (has(setHtmlV17, 'id="anim-toggle"') && has(setHtmlV17, 'id="anim-state"') && has(setHtmlV17, "投骰动画"))
    ok("设置窗口有「投骰动画 开 / 关」开关（#anim-toggle / #anim-state）");
  else bad("设置窗口缺少投骰动画开关");
  if (has(commonV17, 'export const LS_DICE_ANIM = "4enext/dice/anim";') &&
    has(commonV17, "export function readDiceAnim(") && has(commonV17, "export function writeDiceAnim("))
    ok("common.js：LS_DICE_ANIM + readDiceAnim / writeDiceAnim（默认开，缺省按开）");
  else bad("common.js 缺少动画开关的读写");
  if (has(setJsV17, "readDiceAnim") && has(setJsV17, "writeDiceAnim") &&
    !has(setJsV17, ".setItem("))
    ok("设置页读写动画开关走 common.js（自己仍不直接写 localStorage）");
  else bad("设置页直接写了 localStorage（check 的「重置只清白名单」前提被破坏）");
  if (has(dicePageV17, "readDiceAnim()") && has(dicePageV17, "if (!readDiceAnim()) return false;"))
    ok("动画关掉时骰子窗口**不打开** modal（readDiceAnim 在 playEffect 第一行）");
  else bad("动画开关没有挡住 OBR.modal.open");

  /* ---- 7) 文档 / 自测 ----
   * [v1.7.7] docs 合并：dice-v17.md / dice-v15.md 都并进 docs/NOTES.md，改查动画常数的维护口径。 */
  if (notesHas("骰子动画手感") && notesHas("FX_*") && notesHas("@keyframes fx-*"))
    ok("docs/NOTES.md：投骰动画的常数（FX_*）与关键帧（@keyframes fx-*）在哪调，写着");
  else bad("docs/NOTES.md 缺少骰子动画的维护口径");
  if (has(testDiceV17, "fxBaseSize") && has(testDiceV17, "fxBeat") && has(testDiceV17, "fxLayout") &&
    has(testDiceV17, "OBR.modal.open"))
    ok("dev/test-dice.mjs 扩了动画常量 / 布局 / 「关掉动画时不调用 modal.open」的断言");
  else bad("dev/test-dice.mjs 没有扩动画相关断言");
  if (has(readmeSrc, "独立") && has(readmeSrc, "动画") && has(readmeSrc, "v1.7.0"))
    ok("README 写了「独立记录窗口 + 投骰动画」");
  else bad("README 没有写 v1.7.0 的两件事");
  if (has(indexHtmlSrc, "独立") && has(indexHtmlSrc, "投骰动画"))
    ok("index.html 的说明也同步了记录窗口 / 动画");
  else bad("index.html 没有同步 v1.7.0 的说明");
}

console.log("== v1.7.1 投骰动画：完全透明背景 + 3000 ms 兜底关闭");
{
  const effectHtmlV171 = fs.readFileSync(path.join(ROOT, "effect.html"), "utf8");
  const effectJsV171 = fs.readFileSync(path.join(ROOT, "assets", "effect-page.js"), "utf8");
  const uiV171 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const coreV171 = fs.readFileSync(corePath, "utf8");
  const inlineCss = (/<style>([\s\S]*?)<\/style>/.exec(effectHtmlV171) || [])[1] || "";
  const fxStart = uiV171.indexOf("v1.7.0：投骰动画");
  const fxEnd = uiV171.indexOf("v1.7.0：骰子记录窗口");
  const fxSection = fxStart >= 0 && fxEnd > fxStart ? uiV171.slice(fxStart, fxEnd) : "";
  /* 「深色纯色 background」：只抓 background: #000 / #0b0f14 / black / rgb(0,0,0) 这种
   * —— 骰面 .fx-box 的 radial-gradient 是骰子自己的皮肤，不算页面底。 */
  const DARK_SOLID_BG = /background(?:-color)?\s*:\s*(?:#(?:000|000000|0b0f14|0d1117|10161d|121821|14161c|1a222c)\b|black\b|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i;

  /* ---- 1) 透明背景：html 也必须是 transparent ---- */
  if (/html[^{]*\{[^}]*background:\s*transparent\s*!important/.test(inlineCss) &&
    inlineCss.indexOf("body.fx-page") >= 0 && inlineCss.indexOf(".fx-stage") >= 0)
    ok("effect.html 的内联样式把 html + body.fx-page + .fx-stage 一起设成 background: transparent !important（黑底来自 ui.css 的 html{background:var(--bg)}）");
  else bad("effect.html 没有把 html 一起设成 transparent（body 透明后 html 的深色会整块露出来 = 黑屏）");
  if (!DARK_SOLID_BG.test(inlineCss))
    ok("effect.html 里没有任何深色纯色 background（#000 / #0b0f14 / #14161c … 一个都没有）");
  else bad("effect.html 的内联样式里还有深色纯色 background");
  if (fxSection && !DARK_SOLID_BG.test(fxSection))
    ok("ui.css 的 .fx-* 段没有深色纯色 background（深色只出现在骰面 .fx-box 的径向渐变里）");
  else bad("ui.css 的 .fx-* 段里还有深色纯色 background（全屏 modal 会变黑）");
  if (/html:has\(body\.fx-page\)\s*\{[^}]*background:\s*transparent\s*!important/.test(uiV171) &&
    /body\.fx-page\s*\{[^}]*background:\s*transparent\s*!important/.test(uiV171))
    ok("ui.css 也给 html 补了 transparent（html:has(body.fx-page)），body.fx-page 仍是 transparent !important");
  else bad("ui.css 没有把 html 设成 transparent（只透明 body 就是 v1.7.0 的黑屏）");
  if (fxSection.indexOf("pointer-events: none") >= 0 && fxSection.indexOf(".fx-stage * { pointer-events: none") >= 0)
    ok("pointer-events:none 全保留（骰子不挡鼠标，动画期间照样能平移 / 选中地图）");
  else bad("动画层的 pointer-events:none 丢了（会挡住地图）");

  /* ---- 2) 关闭：播完 2600 + 兜底 3000 + ESC / 点击 ---- */
  if (/var FX_CLOSE_FALLBACK_MS = 3000;/.test(effectJsV171) &&
    effectJsV171.indexOf("later(function () { void finish(); }, FX_CLOSE_FALLBACK_MS)") >= 0)
    ok("3000 ms 兜底：FX_CLOSE_FALLBACK_MS = 3000，到点强制 finish()（与 2600 ms 并列，finish 幂等）");
  else bad("effect-page.js 没有 3000 ms 兜底 close（动画被打断会卡在屏幕上）");
  if (/function finish\(/.test(effectJsV171) && effectJsV171.indexOf("OBR.modal.close(id)") >= 0 &&
    effectJsV171.indexOf("later(function () { void finish(); }, b.total)") >= 0)
    ok("播完 2600 ms 仍然 OBR.modal.close(id)（兜底不取代正常关闭）；finish 里清定时器 / rAF");
  else bad("播完没有 OBR.modal.close / 没有清理");
  if (effectJsV171.indexOf('window.addEventListener("keydown", onKeyDown, true)') >= 0 &&
    effectJsV171.indexOf('window.addEventListener("click", onClick, true)') >= 0 &&
    effectJsV171.indexOf('e.key === "Escape"') >= 0 && /function onClick\(\)/.test(effectJsV171))
    ok("ESC / 点击任意处立即关：keydown(Escape / keyCode 27) 与 click 都走 finish()");
  else bad("动画页没有 ESC / 点击立即关（只能等 2600 / 3000 ms）");

  /* ---- 3) 版本 1.7.3 全链路（v1.7.1 的断言跟着版本走，改版本号不会被这一节挡住） ---- */
  const indexJsV171 = fs.readFileSync(path.join(ROOT, "assets", "index.js"), "utf8");
  if (man.version === VER && manRel.version === VER && verOf(commonSrc) === VER &&
    verOf(coreV171) === VER && bgHtml.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0 && indexJsV171.indexOf('version: "' + VER + '"') >= 0)
    ok("版本 1.7.5：manifest×2 / common.js / background.core.js / background.html ?v= / index.html / index.js 全部到位");
  else bad("版本没有全部升到 1.7.5（manifest / common / core / ?v= / index.html / index.js）");
  if (bundleSrc2.indexOf("(v" + VER + ")") >= 0 && bundleSrc2.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0)
    ok("background.bundle.js 已重建（头部 v1.7.5 + PLUGIN_VERSION 1.7.5）");
  else bad("bundle 没跟上 1.7.5（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（保持无 action）");
  else bad("manifest 又加回了 action");

  /* ---- 4) 文档 / 自测 ----
   * [v1.7.7] docs 合并：透明背景 / 关闭三级只在代码与 CHANGELOG 里，NOTES.md 只保留常数在哪。 */
  if (notesHas("骰子动画手感")) ok("docs/NOTES.md：动画常数仍在维护表里（透明 / 关闭三级的细节看 CHANGELOG）");
  else bad("docs/NOTES.md 缺少骰子动画的维护口径");
  const testDiceV171 = fs.readFileSync(path.join(ROOT, "dev", "test-dice.mjs"), "utf8");
  if (testDiceV171.indexOf("FX_CLOSE_FALLBACK_MS") >= 0 && testDiceV171.indexOf("Escape") >= 0 &&
    testDiceV171.indexOf("closedModals") >= 0)
    ok("dev/test-dice.mjs 断言了「兜底 close 存在」「动画结束后调用 modal.close」「ESC 立即关」");
  else bad("dev/test-dice.mjs 没有扩「兜底 close / 播完关闭 / ESC」的断言");
  // v1.7.6：更新记录搬到 CHANGELOG.md（README 顶部只留安装地址与简介）→ 断言改查 CHANGELOG
  const changelogSrc = fs.existsSync(path.join(ROOT, "CHANGELOG.md")) ? fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8") : "";
  if (changelogSrc.indexOf("v1.7.1") >= 0 && changelogSrc.indexOf("透明") >= 0)
    ok("CHANGELOG.md 写了 v1.7.1 的「完全透明背景 + 兜底关闭」");
  else bad("CHANGELOG.md 没有同步 v1.7.1 的黑屏修复");
  if (readmeSrc.indexOf("## ⭐ 安装地址") >= 0 && readmeSrc.indexOf("CHANGELOG.md") >= 0)
    ok("README 顶部保留安装地址 + 指向 CHANGELOG.md");
  else bad("README 顶部缺少安装地址或 CHANGELOG 链接");
  /* [v1.7.7] docs 合并：spec-dice.md 已并入 docs/NOTES.md，「键名不改」这条纪律仍在 */
  if (notesHas("数据键名不要改")) ok("docs/NOTES.md：数据键名纪律仍在（原 spec-dice 的口径）");
  else bad("docs/NOTES.md 缺少「数据键名不要改」");
}

console.log("== v1.7.2 血条组件编辑小窗（HP / 四防 / 回复力）");
{
  const coreV172 = fs.readFileSync(corePath, "utf8");
  const commonV172 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const editHtmlV172 = fs.readFileSync(path.join(ROOT, "hp-edit.html"), "utf8");
  const editJsV172 = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
  const editCoreV172 = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-core.js"), "utf8");
  const uiV172 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const testBgV172 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  const grabOf = (src, head, tail) => {
    const i = src.indexOf(head);
    if (i < 0) return "";
    const j = src.indexOf(tail, i + head.length);
    return j < 0 ? "" : src.slice(i + head.length, j);
  };

  /* ---- 1) 页面 / 脚本 / 样式 ---- */
  if (exists(path.join(ROOT, "hp-edit.html")) && exists(path.join(ROOT, "assets", "hp-edit-page.js")) &&
    exists(path.join(ROOT, "assets", "hp-edit-core.js")))
    ok("hp-edit.html + assets/hp-edit-page.js + assets/hp-edit-core.js 都在");
  else bad("缺少血条编辑窗的页面 / 脚本（hp-edit.html / hp-edit-page.js / hp-edit-core.js）");
  if (has(editHtmlV172, 'class="win') && has(editHtmlV172, 'id="head"') && has(editHtmlV172, 'id="pin"'))
    ok("编辑窗用 .win 外壳 + #head 拖动区 + #pin（复用 window.js 的拖动 / 记位置）");
  else bad("编辑窗缺少窗口外壳 / 拖动区 #head / 回到默认位置 #pin");
  const assetRef = (src, name) =>
    new RegExp('(?:href|src)="assets/' + name.replace(/\./g, "\\.") + '(?:\\?v=[^"]*)?"').test(src);
  if (assetRef(editHtmlV172, "ui.css") && assetRef(editHtmlV172, "hp-edit-page.js") &&
    has(editHtmlV172, "<title>4eNEXT to owlbear"))
    ok("hp-edit.html 引 ui.css + hp-edit-page.js（允许 ?v= 缓存参数），标题带「4eNEXT to owlbear」");
  else bad("hp-edit.html 的样式 / 脚本引用或标题不对");
  if (has(editJsV172, 'createWindow({ name: "hpEdit" })') && has(editJsV172, 'closeSelf(ID_HP_EDIT, "hpEdit")'))
    ok("hp-edit-page.js 用 window.js 的 createWindow（窗口名 hpEdit）+ closeSelf 关自己");
  else bad("编辑窗没有用 window.js 的 createWindow / 关不掉自己");

  /* ---- 2) 四防四个字段 + 语法解析函数（spec §3 / 参考 statEdit） ---- */
  const DEF_IDS = ["ac", "fort", "reflex", "will"];
  const missingDef = DEF_IDS.filter((k) => !has(editHtmlV172, 'id="hpe-def-' + k + '"'));
  if (!missingDef.length) ok("编辑窗有四个四防输入框：AC / 强韧 / 反射 / 意志（hpe-def-ac/fort/reflex/will）");
  else bad("编辑窗缺少四防输入框：" + missingDef.join(" / "));
  if (has(editHtmlV172, "hpe-hp") && has(editHtmlV172, "hpe-surge") &&
    !has(editHtmlV172, "hpe-save") && !has(editHtmlV172, "hpe-foot") && !has(editHtmlV172, "hpe-cancel"))
    ok("编辑窗底部没有保存按钮 / 取消 / 底栏（v1.8.5「即改即生效」，✕ / Esc 仍可关窗）");
  else bad("编辑窗底栏应只保留生命 / 回复力输入（没有保存 / 取消 / 底栏）");
  /* v1.8.5：自动保存接线（input 防抖 + change/blur/Enter 立即提交 + 同值不写 + 广播） */
  if (has(editJsV172, 'el.addEventListener("input"') && has(editJsV172, 'el.addEventListener("change"') &&
    has(editJsV172, 'el.addEventListener("blur"') && has(editJsV172, 'commit("enter", el)') &&
    has(editJsV172, "function scheduleSave()") && has(editJsV172, "hpPatchEqualsView(built.patch") &&
    has(editJsV172, "CH_HP_EDIT_SAVED") && !has(editJsV172, "els.save"))
    ok("v1.8.5：编辑窗自动保存接线（input 防抖 500ms + change/blur/Enter + 同值不写 + CH_HP_EDIT_SAVED）");
  else bad("v1.8.5：编辑窗自动保存接线不完整");
  if (has(editHtmlV172, "20 / 20/20 / +5 / -3"))
    ok("生命输入的提示里写清了 20 / 20/20 / +5 / -3");
  else bad("生命输入没有语法提示（用户不知道能填什么）");
  for (const fn of ["parseHpInput", "parseSurgeInput", "parseDefenseInput", "buildHpEditPatch", "applyHpEdit", "mayEditToken", "writeHpEdit", "hpEditView", "createHpEditLease"]) {
    if (new RegExp("export (async )?function " + fn + "\\(").test(editCoreV172)) ok("hp-edit-core.js 导出 " + fn);
    else bad("hp-edit-core.js 没有导出 " + fn);
  }
  if (has(editCoreV172, "/^([+-])(\\d+)$/") && has(editCoreV172, "/^(\\d+)\\/(\\d+)$/") &&
    has(editCoreV172, "/^(\\d+)([+-])(\\d+)$/"))
    ok("语法：+5 / -3、20/20、15+5 三种写法都解析（看不懂 → ok:false + 提示，保留原值）");
  else bad("parseHpInput 没有覆盖 20 / 20/20 / +5 / -3 / 15+5");
  if (has(editCoreV172, "if (!raw) return { ok: true, value: null };"))
    ok("四防留空 = null = 不写这个字段（那枚盾不画）");
  else bad("四防留空没有被当成「不画」");

  /* ---- 3) 保存写 hp / 夹取 / 两次校验 ---- */
  if (has(editCoreV172, 'export const HPE_KEY_HP = "com.4enext-owlbear/hp";') &&
    has(editCoreV172, "it.metadata[HPE_KEY_HP] = next;") && has(editCoreV172, "it.metadata[HPE_KEY_BAR] = true;"))
    ok("保存写 token metadata com.4enext-owlbear/hp（并确保 hp-bar/enabled = true → 血条立刻能画）");
  else bad("保存没有写 hp / 没有确保血条开关");
  if (has(editCoreV172, "delete out.defenses;") && has(editCoreV172, "patch.defenses = defAny ? defs : null;"))
    ok("四防四个框全空 → 删掉 defenses 键（一枚盾都不画，而不是写 null / 0）");
  else bad("空四防没有删键（会画出一排 0）");
  if (has(editCoreV172, "Math.max(-out.max, Math.min(out.cur, out.max))") &&
    has(editCoreV172, "Math.max(0, Math.min(out.surges, out.surgesMax))"))
    ok("写盘夹取：−max ≤ cur ≤ max、0 ≤ surges ≤ surgesMax（每次写都做）");
  else bad("写盘没有跨字段夹取（cur 会超过上限）");
  if (has(editCoreV172, "if (!mayEditToken(it, role, playerId))") && has(editCoreV172, "这枚 token 已经不能改了"))
    ok("两次校验：updateItems 的 draft 回调里再查一次权限（照参考实现 edit.ts）");
  else bad("只在写之前校验了一次（draft 延迟执行时会写坏别人的 token）");
  if (has(editCoreV172, "role === \"GM\"") && has(editCoreV172, "item.createdUserId === playerId"))
    ok("权限口径：城主 or 这枚 token 的创建者");
  else bad("权限口径不是「城主 or token 创建者」");

  /* ---- 4) 后台接线：popover id / URL / WINS / 菜单 / 频道 ---- */
  if (has(coreV172, 'var ID_HP_EDIT = NS + "/hp-edit";') && has(commonV172, 'export const ID_HP_EDIT = NS + "/hp-edit";'))
    ok("编辑窗 popover id 两端一致：/hp-edit");
  else bad("hp-edit 的 popover id 两端不一致 / 缺失");
  if (has(coreV172, 'var URL_HP_EDIT = pageUrl("hp-edit.html");') && has(commonV172, 'export const URL_HP_EDIT = new URL("hp-edit.html", URL_BASE).href;'))
    ok("URL_HP_EDIT → hp-edit.html（后台开窗 / 页面侧同一个地址）");
  else bad("URL_HP_EDIT 没接上 hp-edit.html");
  if (has(coreV172, "hpEdit: { id: ID_HP_EDIT, url: URL_HP_EDIT, width: HPE_W, height: HPE_H }") &&
    has(coreV172, "var HPE_W = 340;") && has(coreV172, "var HPE_H = 122;"))
    ok("WINS.hpEdit 注册（340×122，可拖动 / 记位置 / 视口夹紧）");
  else bad("WINS 没有注册 hpEdit（或尺寸不是 340×122）");
  if (has(coreV172, "async function openWin(name, urlOverride)") && has(coreV172, "async function openHpEdit(itemId)") &&
    has(coreV172, 'URL_HP_EDIT + "?item=" + encodeURIComponent(itemId)') && has(coreV172, 'await openWin("hpEdit", url)'))
    ok("openWin(name, urlOverride) + openHpEdit：开窗带 ?item=<tokenId>&session=<uuid>");
  else bad("openHpEdit 没有把 tokenId 带进窗口 URL（窗里不知道该编辑谁）");
  if (has(coreV172, "async function onHpBarAdd(context)") && has(coreV172, "onClick: function (context) { return onHpBarAdd(context); }") &&
    has(coreV172, "var ids = await writeHpBarFlag(context, true);"))
    ok("右键「添加血条组件」= 先写 hp-bar/enabled = true、紧接着开编辑窗（onHpBarAdd）");
  else bad("右键「添加血条组件」还是只写开关、不打开编辑窗");
  if (has(coreV172, "d.metadata[KEY_HPBAR] = !!on;") && !has(coreV172, "delete d.metadata[KEY_HPBAR]") &&
    has(coreV172, "onClick: function (context) { return writeHpBarFlag(context, false); }"))
    ok("「移除血条组件」照旧写 false、不 delete（hp 数据保留，下次「添加」能恢复）");
  else bad("移除血条组件的行为被改了（写 false / 不删 hp 必须保持）");
  for (const ch of ["CH_HP_EDIT_TARGET", "CH_HP_EDIT_READY", "CH_HP_EDIT_SAVED"]) {
    const a = grabOf(coreV172, "var " + ch + ' = NS + "', '";');
    const b = grabOf(commonV172, "export const " + ch + ' = NS + "', '";');
    if (a && a === b) ok("血条编辑窗频道一致：" + ch + " = " + a);
    else bad("血条编辑窗频道不一致：" + ch + " core=" + a + " common=" + b);
  }
  if (has(coreV172, "broadcast.onMessage(CH_HP_EDIT_READY") && has(coreV172, "broadcast.onMessage(CH_HP_EDIT_SAVED") &&
    has(coreV172, "function onHpEditReady(") && has(coreV172, "function onHpEditSaved("))
    ok("后台订阅 ready（补发 target）/ saved（立刻 scheduleBars 重画）");
  else bad("后台没有订阅血条编辑窗的 ready / saved");
  if (has(coreV172, "session: hpEditSession") && has(coreV172, "version: hpEditTarget.version + 1") &&
    has(coreV172, "hpEditTarget.itemId === id && hpEditTarget.pending === pend"))
    ok("target 广播带 session + 单调递增 version，内容没变不重复发（规格 §2.2 的幂等）");
  else bad("target 广播没有版本号 / 不幂等");
  if (has(editJsV172, "createHpEditLease(session)") && has(editJsV172, "CH_HP_EDIT_READY") &&
    has(editJsV172, "CH_HP_EDIT_SAVED") && has(editCoreV172, "value.version <= state.version"))
    ok("页面侧用版本租约拒绝乱序（同 session + version 严格递增），保存后广播 CH_HP_EDIT_SAVED");
  else bad("页面侧没有用租约 / 没有保存回执");

  /* ---- 5) 样式 / 只读 / 版本 / 文档 / 测试 ---- */
  if (has(uiV172, ".hpe-body") && has(uiV172, ".hpe-def") && has(uiV172, ".hpe-note") && has(uiV172, ".hpe-btn"))
    ok("ui.css 末尾追加了 .hpe-*（深色 + 绿，沿用 :root 变量）");
  else bad("ui.css 缺少 .hpe-* 样式");
  if (has(editJsV172, "readOnly = !on") && has(editJsV172, "只有城主或这枚 token 的创建者能改血量与四防") &&
    has(editJsV172, 'feedback(res.message, "ERROR")'))
    ok("只读分支（非城主 / 非创建者）+ 写失败 ERROR 通知（不静默）");
  else bad("编辑窗没有只读分支 / 写失败静默");
  if (has(editCoreV172, "data-bg-soft") || has(editHtmlV172, "data-bg-soft"))
    ok("编辑窗标了 data-bg-soft（后台离线只弱化外观；保存是页面直写 token，不靠后台）");
  else bad("编辑窗没有标后台依赖等级");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.2 没动它）");
  else bad("manifest 又加回了 action");
  if (man.version === VER && manRel.version === VER && verOf(commonV172) === VER &&
    verOf(coreV172) === VER && bgHtml.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlSrc.indexOf("v" + VER) >= 0)
    ok("版本 1.7.5 全链路（manifest×2 / common / core / background.html ?v= / index.html）");
  else bad("版本没升到 1.7.5（manifest / common / core / ?v= / index.html）");
  if (bundleSrc2.indexOf("HPE_W") >= 0 && bundleSrc2.indexOf("openHpEdit") >= 0 && bundleSrc2.indexOf("hp-edit") >= 0)
    ok("bundle 里带 v1.7.2 的编辑窗接线（openHpEdit / hp-edit / HPE_W）");
  else bad("bundle 落后于 core（跑 node dev/build-background.mjs）");
  /* [v1.7.7] docs 合并：编辑窗的实现说明在 docs/NOTES.md 的「文件结构 / 常数在哪」里 */
  if (notesHas("hp-edit") || notesHas("血条")) ok("docs/NOTES.md 仍指向血条 / 编辑窗的维护入口");
  else bad("docs/NOTES.md 没有血条相关的维护口径");
  if (has(readmeSrc, "血条组件编辑窗") && has(readmeSrc, "v1.7.2") && has(readmeSrc, "## ⭐ 安装地址"))
    ok("README 功能表加了「血条组件编辑窗（HP/四防/回复力）」，顶部「⭐ 安装地址」保留");
  else bad("README 没有这个功能行 / 安装地址被动了");
  if (has(testBgV172, "v1.7.2") && has(testBgV172, "parseHpInput") && has(testBgV172, "空四防"))
    ok("dev/test-background.mjs 扩了 v1.7.2 的断言（语法 / 空四防 / 权限 / 租约）");
  else bad("dev/test-background.mjs 没有扩 v1.7.2 的断言");
  /* [v1.7.7] docs 合并：spec-hpbar-boss.md 已并入 docs/NOTES.md，键名纪律仍在 */
  if (notesHas("数据键名不要改")) ok("docs/NOTES.md：命中血条数据键的纪律（原 spec 的口径）");
  else bad("docs/NOTES.md 缺少「数据键名不要改」");
}


console.log("== v1.7.3 先攻：移出 / token 删除自动清理 / 外壳透明 / 常驻");
{
  const coreV173 = fs.readFileSync(corePath, "utf8");
  const commonV173 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const initV173 = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
  const pageV173 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const initHtmlV173 = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
  const uiV173 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const setHtmlV173 = fs.readFileSync(path.join(ROOT, "settings.html"), "utf8");
  const setJsV173 = fs.readFileSync(path.join(ROOT, "assets", "settings-page.js"), "utf8");
  const testInitV173 = fs.readFileSync(path.join(ROOT, "dev", "test-initiative.mjs"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  const grab = (src, head, tail) => {
    const i = src.indexOf(head);
    if (i < 0) return "";
    const j = src.indexOf(tail, i + head.length);
    return j < 0 ? "" : src.slice(i + head.length, j);
  };

  /* ---- 1) 右键菜单动态：已在先攻里 → 只显示「移出先攻」 ---- */
  if (has(coreV173, 'label: "移出先攻"') && has(coreV173, "function onInitRemoveClick(") &&
    has(coreV173, "async function registerInitMenus(") && has(coreV173, "function initMenuFilter(") &&
    has(coreV173, 'var INIT_MENU_REMOVE = NS + "/init-remove";'))
    ok("右键新增「移出先攻」（onInitRemoveClick + registerInitMenus，id = /init-remove）");
  else bad("右键没有「移出先攻」/ 没有注册（registerInitMenus / INIT_MENU_REMOVE）");
  if (has(coreV173, 'var KEY_IN_INIT = NS + "/in-init";') &&
    /if \(mode === "in"\) filter\.every\.push\(\{ key: \["metadata", KEY_IN_INIT\], value: true \}\)/.test(coreV173) &&
    /else filter\.every\.push\(\{ key: \["metadata", KEY_IN_INIT\], operator: "!=", value: true \}\)/.test(coreV173))
    ok("菜单 filter 互斥（ContextMenuIconFilter 没有 none）：移出要求 in-init == true，加入两项要求 in-init != true");
  else bad("菜单 filter 不是按 in-init 元数据互斥（metadata / operator \"!=\" 缺失）");
  if (has(coreV173, "async function syncInitFlags(") && has(coreV173, "d.metadata[KEY_IN_INIT] = !!want[String(d.id)];") &&
    has(coreV173, "function scheduleInitFlagSync(") && has(coreV173, "scheduleInitFlagSync();"))
    ok("token 元数据 in-init 由 syncInitFlags 维护（加入 / 移出 / 清理 / 别人改名单 / 进房间各对齐一次，写 false 不 delete）");
  else bad("没有维护 in-init 镜像（右键菜单不会随名单变）");
  if (has(coreV173, "function initRemove(") && has(coreV173, "out.entries.splice(idx, 1);"))
    ok("「移出先攻」= 从 entries 删掉该 tokenId（列表窗口 / 卡片 ✕ 用同一套；v1.7.8 起成功不弹通知）");
  else bad("「移出先攻」没有删 entries");

  /* ---- 2) token 被删除 → 自动清理 + 游标顺移 ---- */
  if (has(coreV173, "async function pruneMissingInitEntries(") && has(coreV173, "scheduleInitPrune()") &&
    has(coreV173, "initKnownTokens"))
    ok("订阅 items.onChange（400ms 合并）→ pruneMissingInitEntries 清掉「已删除 token」的条目");
  else bad("token 被删除后不会自动清理（缺 pruneMissingInitEntries / scheduleInitPrune）");
  if (has(coreV173, "initPruneMuteUntil") && has(coreV173, "async function refreshInitKnownTokens("))
    ok("切场景保护：场景 ready / 换场景只刷新「见过哪些 token」，不按「不在 items 里」整条清空");
  else bad("没有切场景保护（换场景会把整条先攻清空）");
  if (has(initV173, "export function pruneMissingEntries(") && has(initV173, "export function missingEntryIds("))
    ok("initiative.js 也导出了 missingEntryIds / pruneMissingEntries（页面侧同一套规则，自测共用）");
  else bad("initiative.js 缺少 missingEntryIds / pruneMissingEntries");
  if (has(initV173, 'class="item-del"') && has(initV173, 'data-strip-act="remove"') &&
    has(pageV173, 'act === "remove"') && has(pageV173, "removeEntry(initiative, tokenId)"))
    ok("先攻条卡片右上角有 ✕（GM 直接移出：data-strip-act=\"remove\" → removeEntry）");
  else bad("先攻条卡片上没有 ✕ / 没有接 removeEntry");

  /* ---- 3) 外壳透明（卡片仍不透明） ---- */
  if (/\.strip \{[^}]*background: transparent/s.test(uiV173) && !/\.strip \{[^}]*background: #10161d/s.test(uiV173))
    ok("ui.css：先攻条根容器 .strip 背景透明（不再铺 #10161d）");
  else bad("ui.css 的 .strip 还是有深色底");
  if (/\.strip-items \{[^}]*background: transparent/s.test(uiV173) && !/\.strip-items \{[^}]*background: #10161d/s.test(uiV173))
    ok("ui.css：.strip-items 无深色纯色底（右侧空列表区域透出地图）");
  else bad("ui.css 的 .strip-items 还在铺深色底");
  if (/\.initiative-item \{[^}]*background: #141b23/s.test(uiV173))
    ok("ui.css：卡片 .initiative-item 仍是**不透明**深色底（透明就看不清了）");
  else bad("卡片背景被改成透明 / 丢了");
  if (/\.strip\.collapsed \{[^}]*background: transparent/s.test(uiV173) && /\.strip\.collapsed \{[^}]*box-shadow/s.test(uiV173))
    ok("ui.css：折叠态药丸也透明（只留一圈轻微阴影）");
  else bad("折叠态药丸还是深色块 / 没有阴影");
  if (/\.strip-ctl \{[^}]*background: rgba\(11, 15, 20, \.72\)/s.test(uiV173))
    ok("ui.css：控制行保留半透明底 rgba(11,15,20,.72)（透明外壳上按钮 / 状态字看得清）");
  else bad("控制行没有半透明底（压在透明外壳上会看不清）");
  if (/html\.strip-html/.test(uiV173) && /html:has\(body\.strip-page\)[^{]*\{[^}]*background: transparent !important/s.test(uiV173) &&
    /html\.strip-html/.test(initHtmlV173) && /background: transparent !important/.test(initHtmlV173))
    ok("先攻条的 html 也是透明（ui.css 的 html{background:var(--bg)} 会整块盖住地图；initiative.html 另有内联兜底）");
  else bad("只透明了 body、html 还是深色（会盖住地图）");
  if (has(pageV173, 'document.documentElement.classList.add("strip-html")'))
    ok("initiative-page.js 只在先攻条视图给 html 挂 .strip-html（列表窗口仍是不透明窗）");
  else bad("页面没有给先攻条视图挂 .strip-html");

  /* ---- 4) 常驻：disableClickAway + 进入房间自动开 + 本机开关 ---- */
  if (has(coreV173, "function maybeAutoOpenStrip(") && has(coreV173, "function stripAutostartOn(") &&
    has(coreV173, 'var STRIP_AUTOSTART_KEY = "4enext/strip-autostart";') &&
    has(coreV173, 'var STRIP_CLOSED_KEY = "4enext/strip-closed-this-session";'))
    ok("后台：maybeAutoOpenStrip / stripAutostartOn + 两个本机键（默认开、会话级关闭标记）");
  else bad("后台缺少自动显示先攻条的设置（STRIP_AUTOSTART_KEY / maybeAutoOpenStrip）");
  if (has(coreV173, "void maybeAutoOpenStrip();") &&
    has(coreV173, "void maybeAutoOpenStrip(\"进入房间自动显示先攻条\")"))
    ok("进入房间（boot + scene.onReadyChange）都会按设置自动打开先攻条");
  else bad("进入房间没有自动打开先攻条");
  if (has(coreV173, "if (data.op === \"close\") { markStripClosed(true); void closeStrip(); return; }"))
    ok("条上的「✕」（CH_STRIP_CMD {op:\"close\"}）= 真关闭 + 记「本次会话已关」");
  else bad("「✕」没有记会话级关闭标记（关掉后还会自动弹）");
  const commonAuto = grab(commonV173, 'export const LS_STRIP_AUTOSTART = "', '";');
  const coreAuto = grab(coreV173, 'var STRIP_AUTOSTART_KEY = "', '";');
  const commonClosed = grab(commonV173, 'export const LS_STRIP_CLOSED = "', '";');
  const coreClosed = grab(coreV173, 'var STRIP_CLOSED_KEY = "', '";');
  if (commonAuto && commonAuto === coreAuto && commonClosed && commonClosed === coreClosed)
    ok("本机键名两端一致：" + commonAuto + " / " + commonClosed);
  else bad("本机键名不一致：core=" + coreAuto + " common=" + commonAuto + " / closed core=" + coreClosed + " common=" + commonClosed);
  const coreCollapsed = grab(coreV173, 'var STRIP_COLLAPSED_KEY = "', '";');
  const initCollapsed = grab(initV173, 'export const LS_STRIP_COLLAPSED = "', '";');
  if (coreCollapsed && coreCollapsed === initCollapsed && has(coreV173, "function stripCollapsedPref("))
    ok("折叠状态键两端一致：" + coreCollapsed + "（常驻打开时直接按 120×40 药丸开，不闪一下整条）");
  else bad("折叠状态键不一致：core=" + coreCollapsed + " initiative.js=" + initCollapsed);
  if (has(commonV173, "export function readStripAutostart(") && has(commonV173, "export function writeStripAutostart("))
    ok("common.js：readStripAutostart / writeStripAutostart（默认开，缺省按开）");
  else bad("common.js 缺少先攻条自动显示的读写");
  if (has(setHtmlV173, 'data-pane="initiative"') && has(setHtmlV173, 'id="pane-initiative"') &&
    has(setHtmlV173, 'id="strip-auto-toggle"') && has(setHtmlV173, 'id="strip-auto-state"'))
    ok("设置窗口新增「先攻」分栏 + 「进入房间自动显示先攻条」开关（#strip-auto-toggle / #strip-auto-state）");
  else bad("设置窗口没有「先攻」分栏 / 自动显示开关");
  if (has(setJsV173, "readStripAutostart") && has(setJsV173, "writeStripAutostart") &&
    !has(setJsV173, ".setItem(") && !has(setJsV173, "strip-autostart"))
    ok("设置页读写自动显示开关走 common.js（自己仍不直接写 localStorage / 不出现本机键字面量）");
  else bad("设置页直接写了 localStorage / 出现了本机键字面量");
  /* [v1.7.11 改] 条回到 popover：hidePaper + disableClickAway，按钮 / 输入框 / 右键都能用。 */
  if (/function stripPopoverOptions\(size, pos\)[\s\S]{0,600}?hidePaper: true/.test(coreV173) &&
    /disableClickAway: true/.test(coreV173) && !/function stripModalOptions/.test(coreV173))
    ok("先攻条 popover 带 hidePaper:true + disableClickAway:true（可交互；modal 已回退）");
  else bad("先攻条 popover 参数不齐 / 还在用 modal（会挡住右键与输入框）");

  /* ---- 5) 文档 / README / 自测 ---- */
  /* [v1.7.7] docs 合并：先攻条说明并进 docs/NOTES.md（尺寸那一行） */
  if (notesHas("先攻条尺寸")) ok("docs/NOTES.md：先攻条尺寸的维护口径仍在");
  else bad("docs/NOTES.md 缺少「先攻条尺寸」");
  if (has(readmeSrc, "v1.7.3") && has(readmeSrc, "移出先攻") && has(readmeSrc, "常驻") &&
    has(readmeSrc, "## ⭐ 安装地址"))
    ok("README 功能表加了「移出先攻 / 自动清理 / 透明 / 常驻」，顶部「⭐ 安装地址」保留");
  else bad("README 没有这个功能行 / 安装地址被动了");
  if (has(testInitV173, "移出先攻") && has(testInitV173, "pruneMissingInitEntries") &&
    has(testInitV173, "maybeAutoOpenStrip") && has(testInitV173, "disablePointerEvents"))
    ok("dev/test-initiative.mjs 扩了 v1.7.3 的断言（动态菜单 / 移出 / 自动清理 / 自动显示）");
  else bad("dev/test-initiative.mjs 没有扩 v1.7.3 的断言");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.3 没动它）");
  else bad("manifest 又加回了 action");
}

console.log("== v1.7.4 骰子窗口收窄（≈320×620）+ 本次结果固定底部 + 记录窗口修复");
{
  const coreV174 = fs.readFileSync(corePath, "utf8");
  const commonV174 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const diceHtmlV174 = fs.readFileSync(path.join(ROOT, "dice.html"), "utf8");
  const dicePageV174 = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const uiV174 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const histHtmlV174 = fs.readFileSync(path.join(ROOT, "dice-history.html"), "utf8");
  const histJsV174 = fs.readFileSync(path.join(ROOT, "assets", "dice-history-page.js"), "utf8");
  const testDiceV174 = fs.readFileSync(path.join(ROOT, "dev", "test-dice.mjs"), "utf8");
  const testBgV174 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const indexJsV174 = fs.readFileSync(path.join(ROOT, "assets", "index.js"), "utf8");
  const bundleV174 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;

  /* ---- 1) 窗口尺寸：320×620（窄而高） ---- */
  const diceWinV174 = /dice: \{ id: ID_DICE_WIN, url: URL_DICE, width: (\d+), height: (\d+) \}/.exec(coreV174);
  if (diceWinV174 && +diceWinV174[1] === 320 && +diceWinV174[2] === 620)
    ok("WINS.dice = 320×620（窄竖条；winSize() 仍按视口夹紧）");
  else bad("WINS.dice 不是 320×620：" + (diceWinV174 ? diceWinV174[1] + "×" + diceWinV174[2] : "没找到"));
  if (/Math\.min\(def\.width, Math\.max\(240, availW\)\)/.test(coreV174) &&
    /Math\.min\(def\.height, Math\.max\(220, availH\)\)/.test(coreV174))
    ok("winSize 的视口夹紧保留（宽仍取 min(320, 视口 − 2×16)，下限 240）");
  else bad("winSize 的视口夹紧被改掉了");

  /* ---- 2) 骰子 4 + 3 两排 / 按钮 2×2 换行 ---- */
  if (/\.dice-row \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s.test(uiV174))
    ok("ui.css：.dice-row 四列栅格 → 七颗骰子自动排成 4 + 3 两排");
  else bad("ui.css 的 .dice-row 不是四列（320 宽下 7 颗会挤成一排 / 溢出）");
  const actsBlocks = [];
  let from = 0;
  for (;;) {
    const i = diceHtmlV174.indexOf('<div class="dice-acts">', from);
    if (i < 0) break;
    const j = diceHtmlV174.indexOf("</div>", i);
    actsBlocks.push(diceHtmlV174.slice(i, j));
    from = j + 6;
  }
  const idsOf = (block) => (block.match(/id="(btn[A-Za-z]+)"/g) || []).map((s) => s.slice(4, -1));
  const firstActs = actsBlocks[0] ? idsOf(actsBlocks[0]) : [];
  const secondActs = actsBlocks[1] ? idsOf(actsBlocks[1]) : [];
  if (actsBlocks.length === 2 && firstActs.join(",") === "btnRoll,btnLast,btnSave,btnHist")
    ok("「投掷 / 上一次 / 保存组合 / 记录窗口」= 第一组 4 个按钮（2×2 换行）");
  else bad("第一组按钮不是那 4 个：" + JSON.stringify(firstActs));
  if (secondActs.join(",") === "btnAdvantage,btnCrit,btnClear")
    ok("「战斗优势 +2 / 重击·伤害取满 / 清空记录」= 第二组（2 + 1）");
  else bad("第二组按钮不对：" + JSON.stringify(secondActs));
  if (/\.dice-acts \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s.test(uiV174) &&
    /\.dice-acts \.btn\.wide \{[^}]*grid-column: 1 \/ -1/s.test(uiV174) &&
    has(diceHtmlV174, 'class="btn ghost wide"'))
    ok("ui.css：.dice-acts 两列栅格 + 清空记录 .wide 独占一行");
  else bad("按钮没有 2×2 换行 / 清空记录没有独占一行");

  /* ---- 3) 字号整体小一号 ---- */
  const fontChecks = [
    [".expr-input", /font: 700 13px\/1/, "表达式输入 13px"],
    [".sec-hint", /font-size: 10px/, "分区说明 10px"],
    [".dice-acts .btn", /font-size: 12px/, "按钮 12px"],
    [".res-total", /font: 800 26px\/1/, "总点数 26px"],
    [".dice-btn .face", /font: 800 10\.5px\/1/, "骰面 10.5px"]
  ];
  for (const [label, re, desc] of fontChecks) {
    if (re.test(uiV174)) ok("字号小一号：" + desc);
    else bad("字号没缩小：" + label + "（" + desc + "）");
  }

  /* ---- 4) 「本次结果」固定底部（DOM 末尾 + flex:none + 上边框；上部独立滚动） ---- */
  const leftIdx = diceHtmlV174.indexOf('class="dice-left"');
  const resIdx = diceHtmlV174.indexOf('class="dice-result"');
  const tail = resIdx >= 0 ? diceHtmlV174.slice(resIdx) : "";
  if (leftIdx >= 0 && resIdx > leftIdx)
    ok("dice.html：.dice-result 在 .dice-left **之后**（DOM 末尾 = 窗口底部）");
  else bad("dice.html 的「本次结果」不在 DOM 末尾（还在上部内容里）");
  /* [v1.7.6 改] #animMeta（「投骰动画：开」小字）已删，这里只查结果块本身。 */
  if (tail && has(tail, 'id="result"') && !has(tail, 'id="animMeta"') && !has(tail, 'class="dice-sec"') &&
    !has(tail, 'class="preset-box"') && !has(tail, 'class="combo-box"'))
    ok("「本次结果」自己一块（#result），上部骰子 / 预设 / 组合都不在里面");
  else bad("「本次结果」底部块的结构不对（结果 / 动画提示缺，或混进了上部内容）");
  if (/\.dice-result \{[^}]*flex: 0 0 auto/s.test(uiV174) && /\.dice-result \{[^}]*border-top: 1px solid var\(--line\)/s.test(uiV174))
    ok("ui.css：.dice-result 是 flex:none 的固定底栏 + 上边框（分隔线）");
  else bad("ui.css 的 .dice-result 不是 flex:none / 没有上边框");
  if (/\.dice-left \{[^}]*flex: 1 1 auto/s.test(uiV174) && /\.dice-left \{[^}]*overflow-y: auto/s.test(uiV174))
    ok("ui.css：.dice-left 是 flex:1 + overflow-y:auto（上部内容独立滚动，结果不随滚动消失）");
  else bad("ui.css 的 .dice-left 没有独立滚动 / 不占剩余高度");
  if (/\.dice-cols \{[^}]*display: flex;[^}]*flex-direction: column/s.test(uiV174) &&
    has(diceHtmlV174, '<div class="dice-cols">'))
    ok("dice.html/.css：.dice-cols 是 flex 竖排（上部滚动区 + 底部结果）");
  else bad(".dice-cols 不是 flex 竖排（底部固定会失效）");

  /* ---- 5) 「记录窗口」打不开：两端都加固 ---- */
  /* [v1.7.6 改] v1.7.4 是「发命令 → 等 900 ms 回执 → 本页兜底」；v1.7.6 改成**按钮直接开**，
   * 900 ms 那条只剩「直开失败后等后台补开」用（HIST_ACK_MS 还在，onHistTimeout 还在）。 */
  if (has(dicePageV174, "var HIST_ACK_MS = 900;") && has(dicePageV174, "function onHistTimeout(") &&
    has(dicePageV174, "async function openHistoryDirect(") && has(dicePageV174, "await openHistoryDirect();"))
    ok("骰子窗口：按钮直接 openHistoryDirect 打开记录窗口（不再等回执）；HIST_ACK_MS=900 只用于「直开失败后等后台补开」");
  else bad("骰子窗口没有「按钮直接打开记录窗口」的逻辑（点了可能还是没反应）");
  if (has(dicePageV174, "ID_DICE_HIST") && has(dicePageV174, "URL_DICE_HIST") &&
    has(dicePageV174, "id: ID_DICE_HIST,") && has(dicePageV174, "url: URL_DICE_HIST,"))
    ok("本页兜底用的是**同一个** popover id / 页面（不会开出两个记录窗口）");
  else bad("本页兜底的 popover id / url 不对（ID_DICE_HIST / URL_DICE_HIST 没接上）");
  /* [v1.7.6 改] 命令从「toggle 一个」变成三种用途：adopt（接管几何）/ close（清状态）/ force-open（失败兜底）。 */
  /* [v1.7.10 改] 关窗统一走 closeSelf（popover.close + close-win 双保险），adopt / force-open 仍走频道。 */
  if (has(dicePageV174, "function sendHistCmd(op, extra)") && has(dicePageV174, 'sendHistCmd("adopt"') &&
    has(dicePageV174, 'sendHistCmd("force-open")') && has(dicePageV174, 'closeSelf(ID_DICE_HIST, "diceHistory")'))
    ok("记录窗口：adopt / force-open 仍走 CH_DICE_HIST_CMD，关闭走 closeSelf（popover.close + 后台 close-win）");
  else bad("记录窗口的开关链路没有接上（adopt / force-open / closeSelf）");
  if (has(dicePageV174, "记录窗口打开失败：") && has(dicePageV174, '"ERROR"'))
    ok("直开 / 兜底都失败 → ERROR 通知「记录窗口打开失败：…」（不静默）");
  else bad("兜底失败没有 ERROR 通知");
  if (has(coreV174, "for (var tries = 0; tries < 2; tries++)") && has(coreV174, "await winWait(160);") &&
    has(coreV174, "打开骰子记录窗口（可以先关掉骰子窗口，再点一次「记录窗口」）"))
    ok("后台：openDiceHistory 失败**重试一次**，仍失败 stepFail（ERROR 通知 + 提示先关骰子窗口）");
  else bad("后台 openDiceHistory 没有重试 / 失败通知");
  if (has(coreV174, "async function diceHistoryAlive(") && has(coreV174, "OBR.popover.getWidth(ID_DICE_HIST)") &&
    has(coreV174, 'delete winOpen["diceHistory"];'))
    ok("后台：toggle 前先用 popover.getWidth 确认窗口真的还在（状态跟丢 → 直接重开，不再「点了没反应」）");
  else bad("后台没有校验记录窗口是否真的开着（状态跟丢时会点成「关闭」）");
  if (has(coreV174, 'if (op === "ready")') && has(coreV174, "function markDiceHistoryAlive(") &&
    has(histJsV174, "function sayReady(") && has(histJsV174, 'op: "ready"'))
    ok('记录窗口页面加载完发 { op: "ready" } 握手，后台把「开着」补上（下次点才是关闭）');
  else bad("记录窗口没有 ready 握手（本页兜底开的窗口，按钮状态会对不上）");
  if (has(coreV174, "function winDefaultPos(name, size, vp)") && has(coreV174, 'var st = winOpen["dice"];') &&
    has(coreV174, "g.left + g.width + gap"))
    ok("记录窗口默认**贴着骰子窗口**开（右 → 左 → 下 → 上），不再叠在骰子窗口里（看起来像没打开）");
  else bad("记录窗口的默认位置没有避让骰子窗口（380×380 会被 320×620 盖住）");
  if (has(coreV174, "function diceHistoryIsOpen(") && has(coreV174, "function broadcastDiceHistState(") &&
    has(dicePageV174, "CH_DICE_HIST_STATE") && has(dicePageV174, "endHistPending();") &&
    has(dicePageV174, "setHistButton(!!(data && data.open))"))
    ok("开 / 关状态仍然广播回页面（按钮显示「记录窗口 · 开 / 关」，回执一到就清计时器）");
  else bad("记录窗口开关状态没有回传 / 回执不清计时器");
  if (has(histHtmlV174, 'id="dh-list"') && has(histHtmlV174, 'id="dh-toggle"') &&
    has(histJsV174, 'createWindow({ name: "diceHistory" })'))
    ok("记录窗口页面仍是独立可拖动窗口（v1.7.10 缩到 300×240，只放最近 4 条）");
  else bad("记录窗口页面被动了（不该跟着骰子窗口一起缩）");
  if (/diceHistory: \{ id: ID_DICE_HIST, url: URL_DICE_HIST, width: 300, height: 240 \}/.test(coreV174))
    ok("WINS.diceHistory = 300×240（v1.7.10 缩小，默认只显示 4 条）");
  else bad("记录窗口尺寸不是 300×240");

  /* ---- 6) 版本 / 自测 / 文档 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonV174) === VER &&
    verOf(coreV174) === VER && bgHtml.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0 && indexJsV174.indexOf('version: "' + VER + '"') >= 0)
    ok("版本 1.7.5 全链路（manifest×2 / common / core / background.html ?v= / index.html / index.js）");
  else bad("版本没升到 1.7.5（manifest / common / core / ?v= / index.html / index.js）");
  if (bundleV174.indexOf("(v" + VER + ")") >= 0 && !has(bundleV174, "openHistoryDirect") &&
    !has(bundleV174, "HIST_ACK_MS") && has(bundleV174, "async function diceHistoryAlive(") &&
    has(bundleV174, "width: 320, height: 620"))
    ok("background.bundle.js 已重建（320×620 + diceHistoryAlive / 重试；页面侧的兜底不进 bundle）");
  else bad("bundle 没跟上 v1.7.5（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.5 没动它）");
  else bad("manifest 又加回了 action");
  /* [v1.7.6 改] 断言换成新链路：按钮直开 → 按钮变「关闭记录窗口」→ 再点 close → open 抛错时 ERROR。 */
  if (has(testDiceV174, "关闭记录窗口") && has(testDiceV174, "force-open") &&
    has(testDiceV174, "记录窗口打开失败：") && has(testDiceV174, "CH_DICE_HIST_STATE"))
    ok("dev/test-dice.mjs 扩了断言：点一下真的 popover.open → 按钮变「关闭记录窗口」→ 再点 close → 抛错时 ERROR + force-open");
  else bad("dev/test-dice.mjs 没有扩「记录窗口真的打开」的断言");
  if (has(testBgV174, "dice-history.html") && has(testBgV174, "CH_DICE_HIST_CMD") &&
    has(testBgV174, "CH_DICE_HIST_STATE"))
    ok("dev/test-background.mjs 断言了后台这条链路（toggle → popover.open dice-history.html → STATE）");
  else bad("dev/test-background.mjs 没有断言记录窗口的开关链路");
  /* [v1.7.7] docs 合并：v1.7.4 的说明并进 docs/NOTES.md（窗口尺寸那一行） */
  if (notesHas("窗口默认尺寸")) ok("docs/NOTES.md：窗口默认尺寸（WINS）的维护口径仍在");
  else bad("docs/NOTES.md 缺少「窗口默认尺寸」");
  if (has(readmeSrc, "v" + VER) && has(readmeSrc, "320×620") && has(readmeSrc, "## ⭐ 安装地址"))
    ok("README 顶部同步了 v1.7.8（320×620 的功能行仍在），且「⭐ 安装地址」保留");
  else bad("README 没有同步 v1.7.8 / 安装地址被动了");
  /* [v1.7.7] docs 合并：spec-dice.md 已并入 docs/NOTES.md */
  if (notesHas("数据键名不要改")) ok("docs/NOTES.md：数据键名纪律仍在（原 spec-dice 的口径）");
  else bad("docs/NOTES.md 缺少「数据键名不要改」");
}

console.log("== v1.7.5 四防一排改样式（3 个圆 + 1 个 AC 盾；只改样式）");
{
  const coreV175 = fs.readFileSync(corePath, "utf8");
  const commonV175 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const bgHtmlV175 = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
  const indexHtmlV175 = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const indexJsV175 = fs.readFileSync(path.join(ROOT, "assets", "index.js"), "utf8");
  const bundleV175 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const testBgV175 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const readmeV175 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  const numV175 = (name) => {
    const m = new RegExp("(?:export const |var )" + name + " = (\\d+(?:\\.\\d+)?);").exec(coreV175);
    return m ? +m[1] : NaN;
  };

  /* ---- 1) [v1.8.0 改] 直径：四枚**都是 22s**（v1.8.0 按真机反馈 30 → 22，四角更不容易越界） ---- */
  if (numV175("DEF_CIRCLE_DIAMETER") === 22 && numV175("SHIELD_DIAMETER") === 22)
    ok("直径：强韧 / 反射 / 意志 的圆 = 22s（v1.8.0：30 → 22），AC 的盾也是 22s —— 四枚同直径");
  else bad("直径不对：DEF_CIRCLE_DIAMETER=" + numV175("DEF_CIRCLE_DIAMETER") + " SHIELD_DIAMETER=" + numV175("SHIELD_DIAMETER"));

  /* ---- 2) 外形：圆用 circlePoints（24 段），AC 用 shieldPoints，构建与增量刷新共用 defShapePoints ---- */
  if (/function circlePoints\(D, segments\)/.test(coreV175) && numV175("DEF_CIRCLE_SEGMENTS") === 24 &&
    /return sh\.circle \? circlePoints\(sh\.d, DEF_CIRCLE_SEGMENTS\) : shieldPoints\(sh\.d, sh\.d\);/.test(coreV175)) {
    ok("外形：defShapePoints → 三防 circlePoints（24 段折线）/ AC shieldPoints（盾形）");
  } else bad("没有「圆 / 盾」共用的外形函数（circlePoints / defShapePoints）");
  const shapeUses = (coreV175.match(/defShapePoints\(shx?\)/g) || []).length;
  if (shapeUses >= 2) ok("buildBarItems 与 patchBar 都用 defShapePoints（换形状只改一处，用到 " + shapeUses + " 处）");
  else bad("defShapePoints 没有同时被构建与增量刷新使用（用到 " + shapeUses + " 处）");
  if (coreV175.indexOf("buildShape(") < 0) ok("圆仍然用 Curve 手绘（没有改用 buildShape）");
  else bad("v1.7.5 引入了 buildShape（与既有画法不一致）");

  /* ---- 3) [v1.7.9 改] 四防回到**四角**（原来 v1.7.6 的「铺满均分一排」已删） ---- */
  if (/var DEF_ROW = \["fort", "reflex", "will", "ac"\];/.test(coreV175) &&
    /var DEF_DROP = \["will", "reflex", "fort"\];/.test(coreV175) &&
    /var dRow = Math\.max\(dAc, dDef\);/.test(coreV175) &&
    /var DEF_CORNER = \{/.test(coreV175) &&
    /fort: "left-top"/.test(coreV175) && /ac: "right-bottom"/.test(coreV175) &&
    /x: onLeft \? bounds\.min\.x \+ inset \+ dk \/ 2 : bounds\.max\.x - inset - dk \/ 2,/.test(coreV175) &&
    /y: onTop \? bounds\.min\.y \+ inset \+ dk \/ 2 : bounds\.max\.y - inset - dk \/ 2,/.test(coreV175) &&
    coreV175.indexOf("defRowGap") < 0 && coreV175.indexOf("var rowCY") < 0) {
    ok("四角几何（v1.7.9）：左上强韧 / 右上反射 / 左下意志 / 右下 AC —— " +
      "x = 左缘+4s+d/2 或 右缘−4s−d/2，y = 上缘+4s+d/2 或 下缘−4s−d/2；「一排均分」的代码已删");
  } else bad("四防四角的坐标公式不对（DEF_CORNER / onLeft / onTop）");

  /* ---- 4) AC 仍是半透明白盾（fill 0.18 + 描边 0.85），三防仍是实色 0.9 ---- */
  if (/var DEF_AC_FILL_OPACITY = 0\.18;/.test(coreV175) && /var DEF_AC_STROKE_OPACITY = 0\.85;/.test(coreV175) &&
    /var DEF_FILL_OPACITY = 0\.9;/.test(coreV175) &&
    /var DEF_COLORS = \{ ac: "#ffffff", fort: "#e3b341", reflex: "#56d364", will: "#a371f7" \};/.test(coreV175)) {
    ok("配色：AC 半透明白盾（fill @0.18 + 白描边 @0.85）不变；三防仍是橙 / 绿 / 紫 @0.9");
  } else bad("AC 的半透明白 / 三防配色被改了");
  /* [v1.7.6 改] 四枚同直径 → 同一个字号公式：两位 ≈15s、三位 ≈14s（参考图 15 里四个数字一样大）。 */
  if (/fontSize: Math\.max\(8 \* s, dk \* \(txt\.length > 2 \? 0\.46 : 0\.5\)\)/.test(coreV175)) {
    ok("字号：四枚统一用 d×0.5 / d×0.46（d=30 → 15 / 13.8 ≈ 14，与参考图 15 一致）");
  } else bad("四防数字的字号公式不对（v1.7.6 四枚同直径应共用 d×0.5 / d×0.46）");

  /* ---- 5) 版本 / bundle / 文档 / 自测 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonV175) === VER &&
    verOf(coreV175) === VER && bgHtmlV175.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlV175.indexOf('<span class="tag">v' + VER + '</span>') >= 0 && indexJsV175.indexOf('version: "' + VER + '"') >= 0) {
    ok("版本 1.7.5 全链路（manifest×2 / common / core / background.html ?v= / index.html / index.js）");
  } else bad("版本没升到 1.7.5（manifest / common / core / ?v= / index.html / index.js）");
  if (bundleV175.indexOf("(v" + VER + ")") >= 0 && bundleV175.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0 &&
    bundleV175.indexOf("function circlePoints(") >= 0 && bundleV175.indexOf("defShapePoints(") >= 0)
    ok("background.bundle.js 已重建（头部 v1.7.5 + circlePoints / defShapePoints 都在）");
  else bad("bundle 没跟上 v1.7.5（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.5 没动它）");
  else bad("manifest 又加回了 action");
  /* [v1.7.7] docs 合并：hpbar-boss-v16.md（含 §0.6 / §0.7 的常数表）并进 docs/NOTES.md，
   * 这里改查「四防常数去哪调」的那一行（DEF_* / barLayout），常数本身由上面的 numV175 断言。 */
  if (notesHas("token 血条/四防的位置与尺寸") && notesHas("DEF_*") && notesHas("barLayout"))
    ok("docs/NOTES.md：四防常数（DEF_* / barLayout）的维护口径仍在");
  else bad("docs/NOTES.md 缺少四防常数的维护口径");
  /* [v1.7.6 改] 断言更新：四枚 30s、字号 15、整排左缘 4 / 右缘 146 铺满且均分。 */
  /* [v1.7.9 改] 自测断言换成「四角圆心坐标 + 四枚都 30s + 字号 15」。 */
  if (has(testBgV175, "circleOk") && has(testBgV175, "13×40") &&
    has(testBgV175, "左上强韧(19,19)") && has(testBgV175, "右下 AC(131,131)"))
    ok("dev/test-background.mjs 断言了四防：四枚都 30s、字号 15、四角圆心 (19,19)/(131,19)/(19,131)/(131,131)、AC 半透明白、退化不变");
  else bad("dev/test-background.mjs 没有补四角四防的断言");
  if (has(readmeV175, "v" + VER) && has(readmeV175, "## ⭐ 安装地址"))
    ok("README 顶部写了 v1.7.8，且「⭐ 安装地址」保留");
  else bad("README 没写 v1.7.8 / 安装地址被动了");
}

console.log("== v1.7.6 删提示小字 + 记录窗直开 + 先攻条真透明 + 四防重排");
{
  const coreV176 = fs.readFileSync(corePath, "utf8");
  const commonV176 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const diceHtmlV176 = fs.readFileSync(path.join(ROOT, "dice.html"), "utf8");
  const dicePageV176 = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const histPageV176 = fs.readFileSync(path.join(ROOT, "assets", "dice-history-page.js"), "utf8");
  const glanceV176 = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
  const infoHtmlV176 = fs.readFileSync(path.join(ROOT, "info.html"), "utf8");
  const infoJsV176 = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
  const winSrcV176 = fs.readFileSync(path.join(ROOT, "assets", "window.js"), "utf8");
  const uiV176 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const bundleV176 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const initHtmlV176 = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
  const testDiceV176 = fs.readFileSync(path.join(ROOT, "dev", "test-dice.mjs"), "utf8");
  const testBgV176 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const changelogV176 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  /* 文案断言一律**先剥注释**：注释里写「删掉了 xxx」不该被自己判成违规。
   * README / docs 不看（brief 明确说 readme 除外，docs 里必然要写这些词来解释改动）。 */
  const codePieces = {
    "dice.html": stripComments(diceHtmlV176),
    "dice-page.js": stripComments(dicePageV176),
    "glance.js": stripComments(glanceV176),
    "info.html": stripComments(infoHtmlV176),
    "info.js": stripComments(infoJsV176),
    "window.js": stripComments(winSrcV176)
  };

  /* ---- 1) 12 处提示 / 状态小字：运行代码里一个都不剩 ---- */
  const GONE = [
    ["防御参考", "骰子窗口 4E 预设区的「防御参考 AC …」整行"],
    ["只填公式", "「… · 只填公式，不判定」"],
    ["只存本机", "组合区右上的「只存本机」"],
    ["2d6+5 · adv(1d20)", "表达式区右上的示例小字"],
    ["投骰动画：", "本次结果右上的「投骰动画：开」"],
    ["记录独立", "骰子窗口标题下的副标题"],
    ["后台已连接", "状态条里的「后台已连接 v… · 工具栏✓ · 右键菜单✓」"],
    ["工具栏", "状态条里的「工具栏✓」"],
    ["token：", "速览窗口标题下的「token：Cleric」"],
    ["检定已含半等级", "速览技能区右上的说明"],
    ["点一下 = 已用", "速览威能区右上的说明"],
    ["纯展示，不追踪使用", "速览专长区右上的说明"]
  ];
  const stillThere = GONE.filter((one) => Object.keys(codePieces).some((k) => has(codePieces[k], one[0])));
  if (!stillThere.length) ok("12 条提示 / 状态小字在运行代码里都不存在了（" + GONE.length + " 条全删；错误提示保留）");
  else bad("这些说明小字还留在运行代码里：" + stillThere.map((one) => one[0] + "（" + one[1] + "）").join(" / "));

  /* 对应的 DOM 元素也一起删干净（不是只清空文字，避免留一个空壳又被人填回去） */
  if (!has(diceHtmlV176, 'id="presetMeta"') && !has(diceHtmlV176, 'id="defenseRef"') &&
    !has(diceHtmlV176, 'id="animMeta"') && !has(infoHtmlV176, 'id="sub"'))
    ok("清空文字的元素也删了：#presetMeta / #defenseRef / #animMeta / 速览的 #sub 都不在 HTML 里");
  else bad("还留着空的说明元素（#presetMeta / #defenseRef / #animMeta / #sub）");

  /* ---- 2) 错误提示必须保留 + 状态条只在异常时出现 ---- */
  for (const [file, kw] of [["window.js", "后台未连接：右键「加入先攻」"], ["dice-page.js", "记录窗口打开失败："],
    ["dice-page.js", "投骰动画打不开（不影响结果）"]]) {
    if (has(codePieces[file], kw)) ok("错误 / 失败提示保留（" + file + " → 「" + kw + "」）");
    else bad("错误提示被误删了：" + file + " 里找不到「" + kw + "」");
  }
  if (/stripEl\.hidden = !bad/.test(winSrcV176) && has(winSrcV176, 'document.getElementById("bg-strip")'))
    ok("状态条 #bg-strip 默认整条隐藏，只有后台未连接（bad）时才由 window.js 放出来");
  else bad("状态条没有「无异常就整条隐藏」的逻辑（window.js 的 stripEl.hidden = !bad）");
  for (const f of ["dice.html", "dice-history.html", "initiative.html", "panel.html", "settings.html"]) {
    if (/id="bg-strip" hidden/.test(fs.readFileSync(path.join(ROOT, f), "utf8")))
      ok(f + " 的状态条默认 hidden（页面一打开不会闪一行状态字）");
    else bad(f + " 的状态条没有默认 hidden");
  }

  /* ---- 3) 记录窗口：按钮**直接** popover.open + 可见反馈 + 失败 ERROR ---- */
  /* [v1.7.10 改] 外壳透明（hidePaper:true）+ 尺寸缩到 300×240。 */
  if (has(dicePageV176, "await OBR.popover.open({") && has(dicePageV176, "id: ID_DICE_HIST") &&
    has(dicePageV176, "url: URL_DICE_HIST") && has(dicePageV176, 'anchorReference: "POSITION"') &&
    has(dicePageV176, "hidePaper: true") && has(dicePageV176, "disableClickAway: false") &&
    has(dicePageV176, "var HIST_W = 300;") && has(dicePageV176, "var HIST_H = 240;"))
    ok("记录窗口：本页直接 popover.open（POSITION + 300×240 + hidePaper:true 透明外壳 + disableClickAway:false）");
  else bad("记录窗口没有「本页直开」的参数（id / url / POSITION / 300×240 / hidePaper:true）");
  if (has(dicePageV176, "OBR.popover.getWidth(ID_DICE_HIST)") && has(histPageV176, "OBR.popover.getWidth(ID_DICE_HIST)"))
    ok("打开后两端都用 OBR.popover.getWidth(ID_DICE_HIST) 确认窗口真的活着（骰子窗口 + 记录窗口页面各一次）");
  else bad("没有用 popover.getWidth 确认记录窗口存活");
  if (has(dicePageV176, '"关闭记录窗口"') && has(dicePageV176, "记录窗口已打开"))
    ok("打开后按钮文字变「关闭记录窗口」+ 提示「记录窗口已打开」（看得见的反馈）");
  else bad("打开后没有可见反馈（按钮文字 / 提示）");
  if (has(dicePageV176, '"记录窗口打开失败："') && has(dicePageV176, '"ERROR"') &&
    has(dicePageV176, 'sendHistCmd("force-open")'))
    ok("open 抛错 → ERROR 通知「记录窗口打开失败：…」+ 请后台 force-open（先关掉骰子窗口再补开）");
  else bad("open 抛错没有 ERROR 通知 / 没有让后台补开");
  if (has(coreV176, 'op === "force-open"') && has(coreV176, "async function forceOpenDiceHistory(") &&
    has(coreV176, 'await closeWin("dice");') && has(coreV176, "async function adoptDiceHistory("))
    ok("后台：force-open 先 closeWin(\"dice\") 再开记录窗口；adopt 接管页面直开的几何（拖动 / 记位置照旧）");
  else bad("后台没有 force-open / adopt 两个 op（记录窗口直开后就拖不动了）");
  if (has(bundleV176, "forceOpenDiceHistory") && has(bundleV176, "adoptDiceHistory"))
    ok("bundle 里带两个新 op（force-open / adopt）");
  else bad("bundle 落后于 core（跑 node dev/build-background.mjs）");

  /* ---- 4) 先攻条：hidePaper:true + #app / .win / .win-body 透明 ---- */
  /* [v1.7.11 改] 先攻条回退 popover（POSITION + CENTER/TOP + hidePaper + disableClickAway）。 */
  if (/function stripPopoverOptions\(size, pos\)[\s\S]{0,600}?hidePaper: true/.test(coreV176) &&
    /anchorReference: "POSITION"/.test(coreV176) && /disableClickAway: true/.test(coreV176) &&
    !/function stripModalOptions/.test(coreV176))
    ok("先攻条 popover 参数齐全（POSITION + CENTER/TOP + hidePaper + disableClickAway）");
  else bad("先攻条 popover 少了透明 / 交互参数 / 还在用 modal");
  const STRIP_LAYERS = ["#app", ".win", ".win-body", ".strip-root", ".strip", ".strip-items"];
  const missLayer = STRIP_LAYERS.filter((sel) => !has(uiV176, "body.strip-page " + sel));
  if (!missLayer.length)
    ok("ui.css 的 v1.7.6 段把 #app / .win / .win-body / .strip-root / .strip / .strip-items 全列进透明规则");
  else bad("透明规则缺层：" + missLayer.join(" / "));
  if (/html\.strip-html body\.strip-page #app \{[^}]*background: transparent !important/s.test(uiV176.replace(/,\n/g, " ")) ||
    /background: transparent !important;[\s\S]{0,80}?html\.strip-html body\.strip-page #app/.test(uiV176) ||
    (has(uiV176, "html.strip-html body.strip-page #app,") && has(uiV176, "background: transparent !important")))
    ok("透明规则用的是 background: transparent !important（能盖掉 ui.css 顶部的 html{background:var(--bg)}）");
  else bad("透明规则没有用 !important");
  if (has(initHtmlV176, "html.strip-html body.strip-page #app") && has(initHtmlV176, "background: transparent !important"))
    ok("initiative.html 的内联样式也给 #app / .win / .win-body 兜了一层透明");
  else bad("initiative.html 没有内联兜底透明");
  if (/\.strip-ctl \{[\s\S]*?rgba\(11, 15, 20, \.72\)/.test(uiV176))
    ok("控制行 .strip-ctl 仍是半透明 rgba(11, 15, 20, .72)（透明外壳上要读得清）");
  else bad("控制行丢了半透明底");
  if (/\.initiative-item \{[^}]*#141b23/.test(uiV176))
    ok("卡片 .initiative-item 仍是不透明 #141b23（整条只有卡片与控制行有底色）");
  else bad("卡片底色被改了（透明就看不清了）");

  /* ---- 5) 四防：四枚 30s + 铺满均分 ---- */
  const numV176 = (name) => {
    const m = new RegExp("var " + name + " = (\\d+(?:\\.\\d+)?);").exec(coreV176);
    return m ? +m[1] : NaN;
  };
  if (numV176("DEF_CIRCLE_DIAMETER") === 22 && numV176("SHIELD_DIAMETER") === 22)
    ok("四防直径（v1.8.0）：圆和 AC 盾统一 22s（真机反馈 30 → 22，四角贴边更稳）");
  else bad("四防直径不对：圆=" + numV176("DEF_CIRCLE_DIAMETER") + " 盾=" + numV176("SHIELD_DIAMETER"));
  /* [v1.7.9 改] 「一排铺满均分」换成四角：断言坐标公式 + 退化判据，并确认旧 helper 已删。 */
  if (/var DEF_CORNER = \{/.test(coreV176) &&
    /x: onLeft \? bounds\.min\.x \+ inset \+ dk \/ 2 : bounds\.max\.x - inset - dk \/ 2,/.test(coreV176) &&
    /var needTwo = 2 \* dRow \+ inset \* 2;/.test(coreV176) &&
    coreV176.indexOf("defRowGap") < 0 && coreV176.indexOf("var rowLeft") < 0) {
    ok("四防四角公式：贴 token 四角内侧 8s；两枚并排 / 两行叠放放不下就按 DEF_DROP 丢（AC 最后）；「一排均分」的 helper 已删");
  } else bad("四防四角的坐标 / 退化公式不对（defRowGap / rowLeft 应该已经删掉）");
  if (/fontSize: Math\.max\(8 \* s, dk \* \(txt\.length > 2 \? 0\.46 : 0\.5\)\)/.test(coreV176))
    ok("四防数字字号统一放大：d×0.5 / d×0.46（22s → 11 / 10.12 ≈ 10）");
  else bad("四防数字字号没有统一放大");
  if (/var DEF_ROW = \["fort", "reflex", "will", "ac"\];/.test(coreV176) &&
    /DEF_AC_FILL_OPACITY = 0\.18/.test(coreV176) && /DEF_AC_STROKE_OPACITY = 0\.85/.test(coreV176))
    ok("顺序与配色没变：强韧 → 反射 → 意志 → **AC 最右**，AC 仍是半透明白盾（0.18 + 0.85）");
  else bad("四防的顺序 / AC 半透明白被改了");

  /* ---- 6) 版本 / 文档 / 自测 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonV176) === VER &&
    verOf(coreV176) === VER && bgHtml.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0) {
    ok("版本 1.7.8 全链路（manifest×2 / common / core / background.html ?v= / index.html）");
  } else bad("版本没升到 1.7.8（manifest / common / core / ?v= / index.html）");
  if (bundleV176.indexOf("(v" + VER + ")") >= 0 && bundleV176.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0 &&
    bundleV176.indexOf("function barLayout(") >= 0 && bundleV176.indexOf("HP_RING_THICK") >= 0)
    ok("background.bundle.js 已重建（头部版本 + 环形血条常数 HP_RING_THICK 都在）");
  else bad("bundle 没跟上（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.6 没动它）");
  else bad("manifest 又加回了 action");
  /* [v1.7.7] docs 合并：v1.7.6 的三处实现说明都并进 docs/NOTES.md（按「改哪」组织，不按版本）。 */
  if (notesHas("先攻条尺寸") && notesHas("骰子动画手感") && notesHas("token 血条/四防的位置与尺寸"))
    ok("docs/NOTES.md 仍有先攻条 / 动画 / 四防三处常数的维护口径（v1.7.6 说明的去处）");
  else bad("docs/NOTES.md 缺少 v1.7.6 涉及的三处常数说明");
  if (has(changelogV176, "v1.7.6") && has(changelogV176, "记录窗口") && has(changelogV176, "30s"))
    ok("CHANGELOG.md 补了 v1.7.6 一条（四件事都写了）");
  else bad("CHANGELOG.md 没有补 v1.7.6");
  if (has(testDiceV176, "关闭记录窗口") && has(testBgV176, "四角") && has(testBgV176, "环形血条"))
    ok("dev/test-dice.mjs 与 dev/test-background.mjs 都有 v1.7.6 的对应断言");
  else bad("自测里没有补 v1.7.6 的断言（记录窗直开 / 四防铺满均分）");
  if (exists(path.join(ROOT, "dev", "check-render.mjs")) &&
    has(fs.readFileSync(path.join(ROOT, "dev", "check-render.mjs"), "utf8"), "先攻条外壳"))
    ok("dev/check-render.mjs 也加了「先攻条外壳透明」的静态核对");
  else bad("dev/check-render.mjs 没有透明核对");
}


console.log("== v1.7.7 选中 token 就弹血条编辑窗（三分支 / 不重复弹 / 右键「编辑血条」/ 锁只读）");
{
  const coreV177 = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const commonV177 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const editCoreV177 = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-core.js"), "utf8");
  const editJsV177 = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
  const testBgV177 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const bundleV177 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const changelogV177 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;

  /* ---- 1) 判据：有血条数据 / 开关 ---- */
  if (has(coreV177, "function hasHpBarData(") &&
    /if \(item\.metadata\[KEY_HPBAR\] === true\) return true;/.test(coreV177) &&
    /var m = item\.metadata\[KEY_HP\];/.test(coreV177) &&
    has(coreV177, "readIntOrNull(m.cur) !== null") && has(coreV177, "m.defenses && typeof m.defenses === \"object\"")) {
    ok("hasHpBarData：hp 里有值（cur / max / temp / surges / defenses / boss）或 hp-bar/enabled = true 就算「有血条」");
  } else bad("缺少 hasHpBarData（或判据不是「hp 有值 / 开关 true」）");
  if (has(coreV177, "if (!hpBarEnabled(item)) return false;"))
    ok("hasHpBarData 先看组件开关：显式「移除血条组件」（enabled=false）后不再算「有血条」（v1.8.4 真机 bug）");
  else bad("hasHpBarData 没检查 hp-bar/enabled=false（移除组件后选中仍会弹编辑窗）");
  /* v1.8.5：手动 ✕ 关掉速览后不再被 onChange 自动弹回（infoAutoPopped，与 hpAutoPopped 对称） */
  if (has(coreV177, "var infoAutoPopped = {};") &&
    /if \(infoAutoPopped\[item\.id\]\) \{[\s\S]{0,160}?return; \}/.test(coreV177) &&
    /infoAutoPopped\[item\.id\] = true;/.test(coreV177) &&
    /if \(infoItemId\) infoAutoPopped\[infoItemId\] = true;/.test(coreV177) &&
    /infoAutoPopped = \{\};/.test(coreV177))
    ok("v1.8.5：用户手动 ✕ 关速览后记住该 token（infoAutoPopped；选中变化清空、手动 openGlance 不受影响）");
  else bad("v1.8.5「关掉速览后不再自动弹回」的 infoAutoPopped 记忆没接上");

  /* ---- 2) 选中即弹的三分支（refreshInfo） ---- */
  if (/async function selectedItem\(/.test(coreV177) && /async function boundCardId\(/.test(coreV177)) {
    ok("selectedItem / boundCardId 拆出来（速览与血条编辑窗共用同一份 selection 判定）");
  } else bad("没有 selectedItem / boundCardId（两边会各读一遍 selection）");
  if (/hpAutoSel = selId;/.test(coreV177) && /hpAutoPopped = \{\};/.test(coreV177) &&
    /if \(hpAutoPopped\[item\.id\]\) return;/.test(coreV177) && /hpAutoPopped\[itemId\] = true;/.test(coreV177)) {
    ok("「只弹一次」：hpAutoSel 换 token / 取消选中就清空，hpAutoPopped 记住弹过的 token（开窗时也置位）");
  } else bad("缺「只弹一次」的记忆（关掉后会被下一次 selection 事件弹回来）");
  if (/var cardId = await boundCardId\(item\);[\s\S]{0,120}?if \(cardId\) \{[\s\S]{0,1600}?await openInfo\(item\.id, cardId\)/.test(coreV177)) {
    ok("分支①：已绑定角色卡 → openInfo（v1.2 的老行为）");
  } else bad("分支①（已绑定卡 → openInfo）不见了");
  if (/await closeInfo\(\);\s*\n\s*if \(!hasHpBarData\(item\)\) return;\s*\n\s*if \(hpAutoPopped\[item\.id\]\) return;\s*\n\s*try \{\s*\n\s*await openHpEdit\(item\.id\);/.test(coreV177)) {
    ok("分支②：没绑定卡 + 有血条 → openHpEdit（用户要的「选中就弹编辑窗」）");
  } else bad("分支②（没卡 + 有血条 → openHpEdit）没有接上");
  if (/if \(!sel \|\| sel\.length !== 1\) return null;/.test(coreV177)) {
    ok("分支③：多选 / 没选中 → 什么都不弹（selectedItem 直接返回 null）");
  } else bad("多选没有被排除（多选时也会弹窗）");

  /* ---- 3) 右键「编辑血条」 ---- */
  if (has(coreV177, 'id: NS + "/hpbar-edit"') && has(coreV177, 'label: "编辑血条"') &&
    has(coreV177, "async function onHpBarEdit(") &&
    /onClick: function \(context\) \{ return onHpBarEdit\(context\); \}/.test(coreV177)) {
    ok("右键新增「编辑血条」（/hpbar-edit → onHpBarEdit，只看 token 不看选中）");
  } else bad("右键没有「编辑血条」/ 没有接上 onHpBarEdit");
  if (/id: NS \+ "\/hpbar-edit"[\s\S]{0,420}?some: \[\{ key: \["metadata", KEY_HPBAR\], value: true \}\]/.test(coreV177)) {
    ok("「编辑血条」的 filter：只在 hp-bar/enabled === true（确实有血条）的 token 上出现");
  } else bad("「编辑血条」的 filter 不对（应该只在开关为 true 时出现）");

  /* ---- 4) Boss 锁 → 只读（非城主） ---- */
  if (has(editCoreV177, "export function hpEditReadOnly(") &&
    /if \(role === "GM"\) return false;/.test(editCoreV177) &&
    /return meta\.locked === true;/.test(editCoreV177)) {
    ok("hpEditReadOnly：hp.locked === true 时非城主只读；城主不受限（locked 默认 true，锁是给玩家看的）");
  } else bad("hp-edit-core 没有 hpEditReadOnly / 判定不是「locked + 非城主」");
  /* [v1.7.8 改] 提示行抽成 refreshNote()（成功类提示不再写），锁定分支变成 if (state.locked)。 */
  if (has(editJsV177, "hpEditReadOnly(hpMetaOf(item), role)") && has(editJsV177, "setEditable(editable)") &&
    has(editJsV177, "已锁定") && has(editJsV177, "function refreshNote()") && has(editJsV177, "if (state.locked) {") &&
    has(editJsV177, "el.readOnly = !on")) {
    ok("编辑窗：锁定时 setEditable(false)（输入框只读）+ 提示「已锁定」+ 自动保存不再写（v1.8.5：无保存按钮）");
  } else bad("编辑窗没有接「锁定 → 输入框只读 / 提示已锁定 / 不写」");

  /* ---- 5) 版本 / bundle / 文档 / 自测 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonV177) === VER &&
    verOf(coreV177) === VER && bgHtml.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0) {
    ok("版本 1.7.8 全链路（manifest×2 / common / core / background.html ?v= / index.html）");
  } else bad("版本没升到 1.7.8（manifest / common / core / ?v= / index.html）");
  if (bundleV177.indexOf("(v" + VER + ")") >= 0 && bundleV177.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0 &&
    bundleV177.indexOf("function hasHpBarData(") >= 0 && bundleV177.indexOf("onHpBarEdit(") >= 0 &&
    bundleV177.indexOf("hpAutoPopped") >= 0) {
    ok("background.bundle.js 已重建（头部 v1.7.8 + hasHpBarData / onHpBarEdit / hpAutoPopped 都在）");
  } else bad("bundle 没跟上 v1.7.8（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.8 没动它）");
  else bad("manifest 又加回了 action");
  if (has(changelogV177, "v1.7.7") && has(changelogV177, "选中 token 直接弹血条编辑窗"))
    ok("CHANGELOG.md 补了 v1.7.7 一条（选中即弹 / 只弹一次 / 右键编辑血条 / 锁只读）");
  else bad("CHANGELOG.md 没有补 v1.7.7");
  if (has(readmeSrc, "v" + VER) && has(readmeSrc, "选中即弹血条编辑窗") && has(readmeSrc, "## ⭐ 安装地址"))
    ok("README 功能表加了「选中即弹血条编辑窗（v1.7.7）」，顶部「⭐ 安装地址」保留");
  else bad("README 没有 v1.7.7 的功能行 / 安装地址被动了");
  if (has(testBgV177, "v1.7.7 分支①") && has(testBgV177, "v1.7.7 分支②") && has(testBgV177, "v1.7.7 分支③") &&
    has(testBgV177, "只自动弹一次") && has(testBgV177, "hpEditReadOnly"))
    ok("dev/test-background.mjs 跑通了三分支（绑定卡→速览 / 有血条→编辑窗 / 都没有→不弹）+ 只弹一次 + 锁只读");
  else bad("dev/test-background.mjs 没有补 v1.7.7 的三分支断言");
}

console.log("== v1.7.8 减少打扰：成功类通知 = 0，只保留 ERROR / WARNING");
{
  const has = (s2, sub) => String(s2).indexOf(sub) >= 0;
  const commonV178 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const coreV178 = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const winV178 = fs.readFileSync(path.join(ROOT, "assets", "window.js"), "utf8");
  const editJsV178 = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
  const initPageV178 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const dicePageV178 = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const settingsV178 = fs.readFileSync(path.join(ROOT, "assets", "settings-page.js"), "utf8");
  const bundleV178 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const testBgV178 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const testDiceV178 = fs.readFileSync(path.join(ROOT, "dev", "test-dice.mjs"), "utf8");
  const testInitV178 = fs.readFileSync(path.join(ROOT, "dev", "test-initiative.mjs"), "utf8");
  const changelogV178 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");

  /* ---- 1) 核心断言：全仓库「成功类通知」调用数 = 0 ----
   * 做法：把 feedback(...) / notify(...) / OBR.notification.show(...) 的调用文本整段抠出来，
   * 每一个都必须带 ERROR / WARNING 字面量；带 SUCCESS / INFO / DEFAULT（或不带 tone）都算违规。
   * 三个帮助函数内部那次「转发」单独放行（那里 tone 已在同一个函数里被限定过）。 */
  const callTexts = (s2, withStatus) => {
    const out = [];
    /* withStatus：连窗口内的状态行（note / flash）一起扫（断言 3 用），否则只看通知调用（断言 1 用）。 */
    const re = withStatus
      ? /\b(?:feedback|notify|note|flash)\s*\(|OBR\.notification\.show\s*\(/g
      : /\b(?:feedback|notify)\s*\(|OBR\.notification\.show\s*\(/g;
    let m;
    while ((m = re.exec(s2))) {
      if (/function\s+$/.test(s2.slice(Math.max(0, m.index - 12), m.index))) continue; /* 跳过函数定义 */
      let i = re.lastIndex;
      let depth = 1;
      let q = null;
      const start = i;
      while (i < s2.length && depth > 0) {
        const c = s2[i];
        if (q) { if (c === "\\") i++; else if (c === q) q = null; }
        else if (c === "\"" || c === "'" || c === "`") q = c;
        else if (c === "(") depth++;
        else if (c === ")") depth--;
        i++;
      }
      out.push(s2.slice(start, i - 1).replace(/\s+/g, " ").trim());
    }
    return out;
  };
  /* 帮助函数内部的转发（文件:调用文本），除此之外任何调用都必须带 ERROR / WARNING */
  const FORWARD = ["window.js:msg, tone", "common.js:msg, variant", "background.core.js:msg, variant"];
  const ASSET_JS = ["common.js", "window.js", "background.core.js", "bind.js", "panel.js", "info.js",
    "initiative.js", "initiative-page.js", "dice-core.js", "dice-page.js", "dice-history-page.js",
    "effect-page.js", "settings-page.js", "hp-edit-core.js", "hp-edit-page.js", "index.js", "button.js"];
  const successCalls = [];
  let callCount = 0;
  for (const f of ASSET_JS) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"));
    for (const call of callTexts(code)) {
      if (FORWARD.indexOf(f + ":" + call) >= 0) continue;
      callCount++;
      const softVariant = /"(SUCCESS|INFO|DEFAULT)"/.test(call);
      const okVariant = /"(ERROR|WARNING)"/.test(call);
      if (softVariant || !okVariant) successCalls.push(f + " → " + call.slice(0, 110));
    }
  }
  if (!successCalls.length)
    ok("全仓库成功类通知调用数 = 0（" + callCount + " 处 feedback / notify 调用全部只带 ERROR / WARNING）");
  else bad("还有 " + successCalls.length + " 处成功 / 普通类通知：\n      " + successCalls.join("\n      "));

  /* ---- 2) 三个帮助函数兜底：传别的 variant 一律不弹 ---- */
  for (const [f, needle] of [
    ["common.js", 'if (variant !== "ERROR" && variant !== "WARNING") {'],
    ["background.core.js", 'if (variant !== "ERROR" && variant !== "WARNING") {'],
    ["window.js", 'if (tone !== "ERROR" && tone !== "WARNING") return;']
  ]) {
    if (has(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"), needle))
      ok(f + " 兜底：只有 ERROR / WARNING 才真的弹（别的 variant 只写控制台 / 页面日志）");
    else bad(f + " 没有「只放行 ERROR / WARNING」的兜底");
  }

  /* ---- 3) 用户点名的那些成功提示在运行代码里一条都不剩（注释先剥掉） ---- */
  /* 只在「通知 / 窗口状态行」的调用文本里找这些词 —— 页面日志（pageLog / stepOk）、菜单文案、
   * 右击项标题里出现「已保存」这类字不该算违规（那不是弹给用户看的提示）。 */
  const GONE_TOASTS = ["已保存：", "已加入先攻", "已隐形加入先攻", "已移出先攻", "已被删除", "记录窗口已打开",
    "记录窗口已关闭", "后台已恢复", "投骰已发送", "已保存组合", "组合已删除", "投骰动画已打开",
    "已重置本机设置", "已更新资源标记", "已同步先攻加值", "已请求结束回合", "已请求清空全桌记录",
    "窗口已回到默认位置", "先攻条已关闭", "先攻条已回到顶部中间", "先攻加值已是最新", "已填入", "已取消："];
  const stillToasts = [];
  for (const f of ASSET_JS.concat(["background.bundle.js"])) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"));
    for (const call of callTexts(code, true)) {
      for (const t of GONE_TOASTS) {
        if (call.indexOf(t) >= 0) stillToasts.push(f + " 里还有「" + t + "」→ " + call.slice(0, 90));
      }
    }
  }
  if (!stillToasts.length) ok("用户点名的成功类提示（已保存 / 已加入先攻 / 已移出先攻 / 记录窗口已打开 / 后台已恢复 / 投骰已发送 …）在运行代码里一条都不剩");
  else bad("这些成功类提示还在运行代码里：" + stillToasts.join(" / "));

  /* ---- 4) 该留的 ERROR / WARNING 一条都不能少 ---- */
  const KEEP_NOTES = [
    ["window.js", "后台未连接：先点顶部的「后台未连接，点这里重试」"],
    ["window.js", "后台还是没有响应"],
    ["dice-page.js", "记录窗口打开失败："],
    ["hp-edit-page.js", "只读：只有城主或这枚 token 的创建者能改血量与四防"],
    ["hp-edit-page.js", "已锁定：这枚 token 的血量对玩家隐藏"],
    ["bind.js", "绑定失败：可能没有这个 token 的修改权限"],
    ["background.core.js", "4E插件出错："],
    ["background.core.js", "先攻已经有 "],
    ["initiative-page.js", "写不进房间数据：先攻通常只有城主能改"]
  ];
  for (const [f, kw] of KEEP_NOTES) {
    const code = stripComments(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"));
    if (code.indexOf(kw) >= 0) ok("失败 / 警告提示保留：" + f + " → 「" + kw + "」");
    else bad("失败 / 警告提示被误删了：" + f + " 里找不到「" + kw + "」");
  }

  /* ---- 5) 具体接线（几处容易被顺手改回来的地方） ---- */
  if (has(coreV178, 'if (diagNotifyEnabled() && !allOk) notify(okLine, "WARNING");'))
    ok("启动汇总：成功不弹「已加载 …」，只有某个入口没注册上才 WARNING");
  else bad("启动汇总还是会弹成功通知（应是 diagNotifyEnabled() && !allOk 才 WARNING）");
  if (has(editJsV178, "function showSaved(") && has(editJsV178, 'note("已保存"') &&
    has(editJsV178, "broadcast(CH_HP_EDIT_SAVED") && !has(editJsV178, 'feedback("已保存'))
    ok("v1.8.5：血条编辑窗写成功只在状态行短暂提示「已保存 …」（不弹通知中心），随后广播重画");
  else bad("血条编辑窗自动保存的成功反馈不对（应只写状态行、不弹通知）");
  if (!has(stripComments(initPageV178), 'feedback(message, "SUCCESS")') &&
    has(initPageV178, 'feedback("先攻没能写进房间数据：已暂存在本机'))
    ok("先攻页：写成功不弹、写失败降级仍 WARNING（不静默）");
  else bad("先攻页的成功 / 失败反馈没有按 v1.7.8 处理");
  if (!has(stripComments(dicePageV178), "已填入") && has(stripComments(dicePageV178), 'flash("再点一次「清空记录」确认'))
    ok("骰子页：不再写「已填入 …」这类成功回音，但「再点一次确认」这类提醒还在");
  else bad("骰子页的状态行没有按 v1.7.8 处理");
  if (!has(stripComments(settingsV178), 'feedback(next ? "投骰动画已打开"') &&
    has(settingsV178, "这台机器存不下这个设置"))
    ok("设置页：开关成功不弹，存不下时仍 WARNING");
  else bad("设置页的开关反馈没有按 v1.7.8 处理");
  if (has(stripComments(winV178), "flashText(msg, tone);") && has(winV178, "win-flash"))
    ok("窗口内状态行（.win-flash）仍只在 ERROR / WARNING 时写");
  else bad("window.js 的 feedback 没有先滤掉成功 / 普通提示");

  /* ---- 6) 版本 / bundle / 文档 / 三条行为自测 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonSrc) === VER &&
    verOf(coreV178) === VER && bgHtml.indexOf("background.bundle.js?v=" + VER + "") >= 0 &&
    indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0) {
    ok("版本 1.7.8 全链路（manifest×2 / common / core / background.html ?v= / index.html）");
  } else bad("版本没升到 1.7.8（manifest / common / core / ?v= / index.html）");
  if (bundleV178.indexOf("(v" + VER + ")") >= 0 && bundleV178.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0)
    ok("background.bundle.js 已按 1.7.8 重建（头部版本 + PLUGIN_VERSION 都在）");
  else bad("bundle 没跟上 1.7.8（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.8 没动它）");
  else bad("manifest 又加回了 action");
  if (has(changelogV178, "v1.7.8") && has(changelogV178, "减少打扰") && has(changelogV178, "只保留错误提示"))
    ok("CHANGELOG.md 补了 v1.7.8 一条（减少打扰：只保留错误提示）");
  else bad("CHANGELOG.md 没有补 v1.7.8");
  if (has(readmeSrc, "v" + VER) && has(readmeSrc, "减少打扰：只保留错误提示（v1.7.8）") &&
    has(readmeSrc, "## ⭐ 安装地址"))
    ok("README 顶部写了 v1.7.8、功能表加了「减少打扰：只保留错误提示（v1.7.8）」，安装地址保留");
  else bad("README 没有 v1.7.8 的功能行 / 安装地址被动了");
  if (has(testBgV178, "成功类通知为 0") && has(testDiceV178, "成功类通知为 0") &&
    has(testInitV178, "成功类通知为 0"))
    ok("dev/test-background.mjs / test-dice.mjs / test-initiative.mjs 里「有通知」的断言都反向改成「成功类通知为 0」");
  else bad("三条行为自测里还有「保存 / 开窗后有通知」的旧断言");
}

console.log("== v1.7.9 血条改环形 + 去掉 Boss 模式 / 蓝条 + 四防回四角");
{
  const coreV179 = fs.readFileSync(corePath, "utf8");
  const commonV179 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const bundleV179 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const glanceV179 = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
  const infoV179 = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
  const cssV179 = fs.readFileSync(path.join(ROOT, "assets", "glance.css"), "utf8");
  const readmeV179 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelogV179 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const testBgV179 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const dragHtmlV179 = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
  const indexHtmlV179 = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const indexJsV179 = fs.readFileSync(path.join(ROOT, "assets", "index.js"), "utf8");
  const has = (s, sub) => String(s).indexOf(sub) >= 0;
  const numV179 = (name) => {
    const m = new RegExp("var " + name + " = (\\d+(?:\\.\\d+)?);").exec(coreV179);
    return m ? +m[1] : NaN;
  };

  /* ---- 1) 环形血条的常数（v1.8.0：环厚 7s / Ro 内缩 2s / 48 段） + barLayout 顶部常量区 ---- */
  if (numV179("HP_RING_THICK") === 7 && numV179("HP_RING_INSET") === 2 && numV179("HP_RING_SEGMENTS") === 48) {
    ok("环形血条常数（v1.8.0）：环厚 7s / Ro = 半短边 − 2s / 48 段");
  } else bad("环形血条常数不对：THICK=" + numV179("HP_RING_THICK") + " INSET=" + numV179("HP_RING_INSET") +
    " SEG=" + numV179("HP_RING_SEGMENTS"));
  if (/var RING_THICK = HP_RING_THICK;/.test(coreV179) && /var RING_INSET = HP_RING_INSET;/.test(coreV179) &&
    /var RING_SEGMENTS = HP_RING_SEGMENTS;/.test(coreV179) &&
    /\/\* ---- v1\.7\.9 环形血条的像素常数/.test(coreV179)) {
    ok("barLayout() 顶部有「环形血条像素常数」常量区（真机微调只改那里）");
  } else bad("barLayout() 顶部没有环形血条的常量区");

  /* ---- 2) 环画在所有 token 上（构建 + 增量刷新都走 ringSectorPoints） ---- */
  if (/ringSectorPoints\(R\.Ro, R\.Ri, 1, R\.segments\)/.test(coreV179) &&
    /ringSectorPoints\(R\.Ro, R\.Ri, R\.ratio, R\.segments\)/.test(coreV179) &&
    (coreV179.match(/ringSectorPoints\(R\.Ro, R\.Ri/g) || []).length >= 4) {
    ok("环形血条：构建与增量刷新都调用 ringSectorPoints（底环 ratio=1 + 血量环 ratio=R.ratio）");
  } else bad("环形血条没有同时接进 buildBarItems 与 patchBar");
  if (/var hpTextX = bounds\.center\.x - hpTextW \/ 2;/.test(coreV179) &&
    /var hpTextY = bounds\.center\.y \+ ringRi \* 0\.52 - hpTextH \/ 2;/.test(coreV179)) {
    ok("HP 数字放在**环内底部**（横向居中、纵向 = 环心 + Ri×0.52，不压 token 脸）");
  } else bad("HP 数字没有放在环内底部");

  /* ---- 3) 没有直条 / 蓝条 / Boss 名牌 / 分段 / 锁 ---- */
  const goneRoles = ["bar-bg", "bar-fill", "surge-bg", "surge-fill", "surge-text",
    "plate", "plate-text", "plate-phase", "divider", "lock-body", "lock-shackle"];
  const roleLeft = goneRoles.filter((r) => coreV179.indexOf('"' + r + '"') >= 0);
  if (!roleLeft.length) ok("直条 / 蓝条 / 名牌 / 分段 / 锁的 role 全删");
  else bad("还留着这些 role：" + roleLeft.join(" / "));
  if (coreV179.indexOf("roundRectPoints") < 0 && coreV179.indexOf("arcPoints") < 0 &&
    coreV179.indexOf("BAR_HP_H") < 0 && coreV179.indexOf("BAR_SURGE_H") < 0 &&
    coreV179.indexOf("COLOR_SURGE_") < 0) {
    ok("直条 / 蓝条 / 锁用到的 helper 与常数（roundRectPoints / arcPoints / BAR_HP_H / BAR_SURGE_H / COLOR_SURGE_*）都删了");
  } else bad("还留着直条 / 蓝条 / 锁用的 helper 或常数");

  /* ---- 4) 四防回四角：左上强韧 / 右上反射 / 左下意志 / 右下 AC 盾，直径 22s、inset 8s（v1.8.0 真机微调） ---- */
  if (/fort: "left-top"/.test(coreV179) && /reflex: "right-top"/.test(coreV179) &&
    /will: "left-bottom"/.test(coreV179) && /ac: "right-bottom"/.test(coreV179)) {
    ok("四角映射：fort=left-top / reflex=right-top / will=left-bottom / ac=right-bottom");
  } else bad("四角映射不对（DEF_CORNER）");
  if (numV179("SHIELD_DIAMETER") === 22 && numV179("DEF_CIRCLE_DIAMETER") === 22 && numV179("SHIELD_INSET") === 8) {
    ok("四防直径 22s、贴角内侧 8s（v1.8.0 按真机反馈重调：30/4 → 22/8）");
  } else bad("四防直径 / inset 不对：" + numV179("SHIELD_DIAMETER") + " / " + numV179("SHIELD_INSET"));
  if (/var DEF_COLORS = \{ ac: "#ffffff", fort: "#e3b341", reflex: "#56d364", will: "#a371f7" \};/.test(coreV179)) {
    ok("配色：左上黄 #e3b341 / 右上绿 #56d364 / 左下紫 #a371f7 / AC 半透明白");
  } else bad("四角配色不对");

  /* ---- 5) 速览 / 编辑窗：Boss 开关删掉，锁开关与回复力仍保留 ---- */
  const glanceCodeV179 = stripComments(glanceV179);
  if (has(glanceV179, 'data-act="lock"') && !has(glanceCodeV179, 'data-act="boss"') &&
    !has(glanceCodeV179, "显示为 Boss") && has(glanceV179, "共享数据") && has(glanceV179, "gl4-share")) {
    ok("速览：开关改名「共享数据」并放到顶部标题区（Boss 开关与 .gl4-boss-row 都删了）");
  } else bad("速览里还有 Boss 开关 / 少了共享数据开关");
  if (!has(stripComments(infoV179), "hp.boss")) ok("info.js 的渲染签名不再看 hp.boss");
  else bad("info.js 还在读 hp.boss");
  if (has(cssV179, ".gl4-share") && !has(cssV179, ".gl4-lock-row") && !has(cssV179, ".gl4-boss-row")) {
    ok("glance.css 同步换成 .gl4-share（.gl4-lock-row / .gl4-boss-row 都没有）");
  } else bad("glance.css 里的 .gl4-lock-row / .gl4-boss-row 没删 / .gl4-share 没加");
  if (has(coreV179, 'label: "编辑血条"') && has(coreV179, "onHpBarEdit")) ok("编辑血条入口保留（改 HP / 四防 / 回复力仍可用）");
  else bad("编辑血条入口被误删了");

  /* ---- 6) 版本 / bundle / 文档 / 自测 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonV179) === VER && verOf(coreV179) === VER &&
    dragHtmlV179.indexOf("background.bundle.js?v=" + VER) >= 0 &&
    indexHtmlV179.indexOf('<span class="tag">v' + VER + '</span>') >= 0 &&
    indexJsV179.indexOf('version: "' + VER + '"') >= 0) {
    ok("版本 " + VER + " 全链路（manifest×2 / common / core / background.html ?v= / index.html / index.js）");
  } else bad("版本没升到 " + VER + "（manifest / common / core / ?v= / index.html / index.js）");
  if (bundleV179.indexOf("(v" + VER + ")") >= 0 && bundleV179.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0 &&
    bundleV179.indexOf("HP_RING_THICK") >= 0 && bundleV179.indexOf('"lock-shackle"') < 0) {
    ok("background.bundle.js 已重建（头部 " + VER + " + 环形常数在、锁的 role 不在）");
  } else bad("bundle 没跟上 " + VER + "（跑 node dev/build-background.mjs）");
  if (!man.action) ok("manifest 仍然没有 action 字段（v1.7.9 没动它）");
  else bad("manifest 又加回了 action");
  if (has(changelogV179, "v1.7.9") && has(changelogV179, "环形") && has(changelogV179, "去掉 Boss 模式") &&
    has(changelogV179, "四角")) {
    ok("CHANGELOG.md 补了 v1.7.9 一条（环形 / 去 Boss / 四角 / 去蓝条）");
  } else bad("CHANGELOG.md 没有补 v1.7.9");
  if (has(readmeV179, "v" + VER) && has(readmeV179, "环形血条") && has(readmeV179, "## ⭐ 安装地址")) {
    ok("README 顶部写了 v" + VER + "、功能表写了环形血条，「⭐ 安装地址」保留");
  } else bad("README 没有 v1.7.9 的功能行 / 安装地址被动了");
  if (notesHas("HP_RING_*") && notesHas("四角内缩")) ok("docs/NOTES.md 的常量表写了 HP_RING_* 与四角内缩");
  else bad("docs/NOTES.md 常量表没有更新（HP_RING_* / 四角内缩）");
  if (has(testBgV179, "环形血条") && has(testBgV179, "48 段") && has(testBgV179, "四角") &&
    has(testBgV179, "没有直条") && has(testBgV179, "hp.boss")) {
    ok("dev/test-background.mjs 断言了环形（48 段）/ 四角坐标 / 无直条 / hp.boss 被忽略");
  } else bad("dev/test-background.mjs 没有补 v1.7.9 的断言");
}

console.log("== v1.7.10 / v1.7.11 先攻条（popover 回退）+ Full Suite 卡片 + 加值可编辑 + 记录窗 300×240 + ✕ 双保险");
{
  const coreV1710 = fs.readFileSync(corePath, "utf8");
  const commonV1710 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const initV1710 = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
  const pageV1710 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const cssV1710 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const diceV1710 = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
  const histPageV1710 = fs.readFileSync(path.join(ROOT, "assets", "dice-history-page.js"), "utf8");
  const histHtmlV1710 = fs.readFileSync(path.join(ROOT, "dice-history.html"), "utf8");
  const winV1710 = fs.readFileSync(path.join(ROOT, "assets", "window.js"), "utf8");
  const bundleV1710 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const readmeV1710 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelogV1710 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const testBgV1710 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const testInitV1710 = fs.readFileSync(path.join(ROOT, "dev", "test-initiative.mjs"), "utf8");
  const testDiceV1710 = fs.readFileSync(path.join(ROOT, "dev", "test-dice.mjs"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  const numOf = (src, name) => {
    const m = new RegExp("(?:export const |var )" + name + " = (\\d+(?:\\.\\d+)?);").exec(src);
    return m ? +m[1] : NaN;
  };

  /* ---- ① 先攻条 = popover（v1.7.11 紧急回退；modal + disablePointerEvents 会让整条点不动） ---- */
  if (has(coreV1710, "function stripPopoverOptions(size, pos)") && has(coreV1710, 'anchorReference: "POSITION"') &&
    has(coreV1710, 'anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }') &&
    has(coreV1710, "hidePaper: true") && has(coreV1710, "disableClickAway: true") &&
    has(coreV1710, "await OBR.popover.open(stripPopoverOptions(size, pos))") &&
    has(coreV1710, "OBR.popover.close(ID_STRIP)") && !has(coreV1710, "function stripModalOptions")) {
    ok("① 先攻条：OBR.popover.open(POSITION + CENTER/TOP + hidePaper + disableClickAway)，关闭走 popover.close；不再用 modal");
  } else bad("① 先攻条没有回退 popover / 参数不齐 / 还在用 stripModalOptions");
  if (!has(cssV1710, "html.strip-html, html.strip-html body.strip-page { pointer-events: none; }") &&
    !has(cssV1710, "pointer-events: auto;   /* 只有条本身接收鼠标") &&
    has(cssV1710, "html.strip-html body.strip-page .strip-root") &&
    has(cssV1710, "background: transparent !important") &&
    has(cssV1710, "rgba(15, 20, 28, .86)") &&
    has(histHtmlV1710, "background: transparent !important")) {
    ok("① 页面全透明（html/body/#app/.win/.win-body/.strip*）+ 半透明卡片兜底；不再靠 pointer-events 穿透（popover 本身可交互）");
  } else bad("① 页面透明 / 半透明卡片兜底的 CSS 不完整（别再靠 pointer-events 穿透）");

  /* ---- ② 加高不裁切：三档 ≥170，且 ≥ 控制行 36 + 卡片 80 + d20 行 24 + padding 16 ---- */
  const hIdle = numOf(initV1710, "STRIP_H_IDLE");
  const hPrep = numOf(initV1710, "STRIP_H_PREPARING");
  const hCom = numOf(initV1710, "STRIP_H_COMBAT");
  if (hIdle === 170 && hPrep === 180 && hCom === 200 && hIdle >= 80 + 36 + 24 + 16) {
    ok("② 展开高度 170 / 180 / 200（≥ 卡片 80 + 控制行 36 + d20 行 24 + padding 16 = 156，也 ≥ 170）");
  } else bad("② 展开高度不足：" + [hIdle, hPrep, hCom].join(" / "));

  /* ---- ③ 无绑定卡的 token 也能加入先攻（不读 init.bonus、默认 0） ---- */
  if (has(coreV1710, "function initBonusOf(") && has(coreV1710, "function initAdd(") &&
    has(testInitV1710, "无绑定卡的 token 也能加入先攻")) {
    ok("③ 无绑定卡的 token 也能加入先攻：initBonusOf 缺元数据返回 0、加入流程不检查 init.bonus");
  } else bad("③ 加入流程仍在检查 init.bonus 是否存在 / 自测没断言");

  /* ---- ④ 照抄 Full Suite 的六个关键数值 + 卡片下只留一枚 d20 ---- */
  const FS = [
    [/\.initiative-item \{[^}]*width: 56px; height: 80px/s, "卡片 56×80"],
    [/\.initiative-item\.active \{[^}]*height: 100px/s, ".active 高 100"],
    [/\.item-img \{[^}]*height: 80%/s, ".item-img 80%"],
    [/\.item-count \{[^}]*height: 24%/s, ".item-count 24%"],
    [/\.item-hp-track \{[^}]*bottom: 24%; height: 4px/s, "血条 4px bottom 24%"],
    [/\.roll-buttons \{[^}]*top: 100%[^}]*margin-top: 1px/s, "掷骰按钮 top:100% / 1px（卡片下方）"],
    [/\.roll-btn\.normal \{[^}]*width: 100%; height: 16px[^}]*border-radius: 4px/s, "d20 整宽长方形 16 高"]
  ];
  const missFS = FS.filter(([re]) => !re.test(cssV1710)).map(([, why]) => why);
  if (!missFS.length) ok("④ Full Suite 几何全对上：56×80 / active 100 / img 80% / count 24% / hp 4px bottom 24% / 按钮在卡片下方长方形");
  else bad("④ 少了 Full Suite 的几何：" + missFS.join(" / "));
  if (has(initV1710, 'data-roll="normal"') && !has(initV1710, 'data-roll="adv"') &&
    !has(initV1710, 'data-roll="dis"') && (initV1710.match(/class="roll-btn /g) || []).length === 1) {
    ok("④ 卡片下方只留 1 枚居中 d20（4E 没有优势 / 劣势）");
  } else bad("④ 卡片下方不是只留一枚 d20");

  /* ---- ⑤⑥ 加值可编辑：卡片左上角 + 状态行，同一份写逻辑 ---- */
  if (has(initV1710, "export function setEntryBonus(") && has(initV1710, "export function canEditBonus(") &&
    has(initV1710, "data-bonus-input=") && has(initV1710, "data-bonus-row=") &&
    has(pageV1710, "async function commitBonus(") &&
    has(pageV1710, 'el.matches("[data-bonus-input], [data-bonus-row]")') &&
    has(pageV1710, "setEntryBonus(initiative, tokenId, bonus)") &&
    has(pageV1710, "data-init-bonus")) {
    ok("⑤⑥ 卡片左上角 + 状态行都可编辑，共用 commitBonus → setEntryBonus（回车 / 失焦保存并重排）");
  } else bad("⑤⑥ 加值可编辑的输入框 / 写逻辑没有接齐");
  if (has(initV1710, "canEditBonus(active, opts)") && has(initV1710, "canEditBonus(e, opts)")) {
    ok("⑤ 权限：GM 任意、玩家只自己的 token（canEditBonus 在卡片与状态行都生效）");
  } else bad("⑤ canEditBonus 没有同时用在卡片与状态行");

  /* ---- ⑦ 记录窗口 300×240 + 半透明卡片 + 紧凑行 ---- */
  if (has(diceV1710, "var HIST_W = 300;") && has(diceV1710, "var HIST_H = 240;") &&
    /diceHistory: \{ id: ID_DICE_HIST, url: URL_DICE_HIST, width: 300, height: 240 \}/.test(coreV1710) &&
    has(diceV1710, "hidePaper: true") && has(histPageV1710, "var EXPANDED_H = 520;") &&
    /body\.dh-page \.win \{[\s\S]{0,260}?rgba\(15, 20, 28, \.86\)/.test(cssV1710) &&
    /body\.dh-page \.dh-row[^{]*\{[^}]*height: 26px/s.test(cssV1710) &&
    /body\.dh-page \.hist-top \{[^}]*font-size: 11px/s.test(cssV1710)) {
    ok("⑦ 记录窗 300×240 + hidePaper:true + 半透明卡片（.86 + 8px 模糊）+ 行高 26 / 字号 11 + 展开才变高");
  } else bad("⑦ 记录窗的尺寸 / 透明外壳 / 紧凑行没有接齐");

  /* ---- ⑧ 所有窗口的 ✕：popover.close + modal.close + 后台 close-win ---- */
  const CLOSE_PAGES = [
    ["panel.js", 'closeSelf(ID_PANEL, "panel")'],
    ["initiative-page.js", 'closeSelf(ID_INIT_WIN, "initiative")'],
    ["dice-page.js", 'closeSelf(ID_DICE_WIN, "dice")'],
    ["dice-page.js", 'closeSelf(ID_DICE_HIST, "diceHistory")'],
    ["settings-page.js", 'closeSelf(ID_SETTINGS_WIN, "settings")'],
    ["hp-edit-page.js", 'closeSelf(ID_HP_EDIT, "hpEdit")'],
    ["info.js", 'closeSelf(ID_INFO, "info")'],
    ["dice-history-page.js", 'closeSelf(ID_DICE_HIST, "diceHistory")']
  ];
  const missClose = CLOSE_PAGES.filter(([f, needle]) => !has(fs.readFileSync(path.join(ROOT, "assets", f), "utf8"), needle));
  if (has(commonV1710, 'export const CH_WIN_CLOSE = NS + "/win-close";') &&
    has(winV1710, "export function closeSelf(popoverId, winName)") &&
    has(winV1710, 'op: "close-win"') && has(coreV1710, "function onWinClose(") &&
    has(coreV1710, "async function closeWinById(") &&
    has(coreV1710, "OBR.broadcast.onMessage(CH_WIN_CLOSE, onWinClose)") && !missClose.length) {
    ok("⑧ 所有窗口 ✕：OBR.popover.close(正确 id) + OBR.modal.close + 后台 {op:\"close-win\"}（含角色卡面板）");
  } else bad("⑧ ✕ 的双保险没接齐：" + (missClose.map((x) => x.join(" → ")).join(" / ") || "缺少频道 / 后台处理器"));

  /* ---- 版本 / bundle / 文档 / 三条行为自测 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonV1710) === VER && verOf(coreV1710) === VER &&
    bgHtml.indexOf("background.bundle.js?v=" + VER) >= 0 && indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0) {
    ok("版本 " + VER + " 全链路（manifest×2 / common / core / background.html ?v= / index.html）");
  } else bad("版本没升到 " + VER);
  if (bundleV1710.indexOf("(v" + VER + ")") >= 0 && bundleV1710.indexOf('var PLUGIN_VERSION = "' + VER + '";') >= 0 &&
    bundleV1710.indexOf("stripPopoverOptions") >= 0 && bundleV1710.indexOf("CH_WIN_CLOSE") >= 0) {
    ok("background.bundle.js 已重建（stripPopoverOptions / CH_WIN_CLOSE 都在）");
  } else bad("bundle 没跟上 " + VER + "（跑 node dev/build-background.mjs）");
  if (has(readmeV1710, "v" + VER) && has(changelogV1710, "v" + VER) && has(changelogV1710, "真透明") &&
    has(readmeV1710, "## ⭐ 安装地址")) {
    ok("README / CHANGELOG 补了 v" + VER + "（真透明先攻条 / Full Suite / 加值可编辑 / 记录窗 300×240 / ✕）");
  } else bad("README / CHANGELOG 没有补 v" + VER);
  if (has(testInitV1710, "setEntryBonus") && has(testInitV1710, "canEditBonus") && has(testInitV1710, "data-bonus-row") &&
    has(testInitV1710, "先攻条打开时右键「加入先攻」→ entries 增加") &&
    has(testBgV1710, "先攻条不再用 modal.open") && has(testBgV1710, "popover 720×170") &&
    has(testDiceV1710, 'c.name === "diceHistory"') && has(testDiceV1710, "300×240")) {
    ok("三条行为自测同步：加值可编辑 / popover 可交互 + 先攻条打开时右键加入先攻 / 记录窗 300×240 + close-win");
  } else bad("行为自测没有同步 v1.7.11 的断言");
}

console.log("== v1.7.11 紧急回归：先攻条回退 popover（可交互 > 透明）");
{
  const coreV1711 = fs.readFileSync(corePath, "utf8");
  const pageV1711 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const cssV1711 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const readmeV1711 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const testBgV1711 = fs.readFileSync(path.join(ROOT, "dev", "test-background.mjs"), "utf8");
  const testInitV1711 = fs.readFileSync(path.join(ROOT, "dev", "test-initiative.mjs"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;

  if (has(coreV1711, "function stripPopoverOptions(size, pos)") && has(coreV1711, "hidePaper: true") &&
    has(coreV1711, "disableClickAway: true") && !has(coreV1711, "function stripModalOptions") &&
    !/function stripPopoverOptions[\s\S]{0,600}?disablePointerEvents/.test(coreV1711)) {
    ok("先攻条只用 popover（hidePaper + disableClickAway）；stripPopoverOptions 里没有 disablePointerEvents");
  } else bad("先攻条还在用 modal / disablePointerEvents（会让整条不可交互）");
  if (has(pageV1711, 'stripRoot.addEventListener("click", onStripClick)') &&
    has(pageV1711, 't.closest("[data-roll]")') &&
    has(pageV1711, 'el.matches("[data-bonus-input], [data-bonus-row]")') &&
    !has(pageV1711, "pointer-events")) {
    ok("页面交互接线仍在：卡片点击 / d20 / 加值输入回车 + 失焦；页面不再依赖 pointer-events");
  } else bad("页面交互接线断了 / 又把 pointer-events 当成穿透方案");
  if (!has(cssV1711, "html.strip-html, html.strip-html body.strip-page { pointer-events: none; }") &&
    has(cssV1711, "html.strip-html body.strip-page .strip-root") &&
    has(cssV1711, "background: transparent !important") &&
    has(cssV1711, ".strip.shell-card") && has(cssV1711, "rgba(15, 20, 28, .86)")) {
    ok("CSS：html/body/#app/.win/.win-body/.strip* 全透明 + 半透明卡片兜底（不再靠 pointer-events 挡 / 穿透）");
  } else bad("CSS 透明层 / 半透明卡片兜底不完整");
  if (has(readmeV1711, "受 OBR 限制，外壳为半透明卡片") &&
    has(NOTES, "modal + disablePointerEvents 不能用于需要交互的浮层")) {
    ok("README 写了真机兜底口径（受 OBR 限制，外壳为半透明卡片）、NOTES 写了教训");
  } else bad("README / NOTES 没有写真机兜底与教训");
  if (has(testInitV1711, "先攻条打开时右键「加入先攻」→ entries 增加") &&
    has(testInitV1711, "先攻条不再用 OBR.modal.open") &&
    has(testBgV1711, "先攻条不再用 modal.open") &&
    has(testBgV1711, "先攻条「✕」→ OBR.popover.close")) {
    ok("自测回归断言齐全：先攻条打开时右键加入先攻 / 不再 modal / ✕ 走 popover.close");
  } else bad("自测没有同步 v1.7.11 的回归断言");
}

console.log("== v1.7.12 速览资源追踪补全（威能 / 装备全部可点）+ 共享数据挪到顶部");
{
  const glanceV1712 = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
  const cssV1712 = fs.readFileSync(path.join(ROOT, "assets", "glance.css"), "utf8");
  const trackV1712 = fs.readFileSync(path.join(ROOT, "assets", "track.js"), "utf8");
  const infoV1712 = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
  const testGlanceV1712 = fs.readFileSync(path.join(ROOT, "dev", "test-glance.mjs"), "utf8");
  const testTrackV1712 = fs.readFileSync(path.join(ROOT, "dev", "test-track.mjs"), "utf8");
  const bundleV1712 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const readmeV1712 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelogV1712 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;

  /* ---- ① 威能：四组可点、随意纯展示 ---- */
  const gAt = glanceV1712.indexOf("const POWER_GROUPS");
  const gEnd = gAt < 0 ? -1 : glanceV1712.indexOf("];", gAt);
  const groupLines = gAt >= 0 && gEnd > gAt ? glanceV1712.slice(gAt, gEnd) : "";
  const tracked = (groupLines.match(/track: true/g) || []).length;
  const untracked = (groupLines.match(/track: false/g) || []).length;
  const pAt = glanceV1712.indexOf("function renderPowerGroup(");
  const pEnd = pAt < 0 ? -1 : glanceV1712.indexOf("\n}", pAt);
  const powerFn = pAt >= 0 && pEnd > pAt ? glanceV1712.slice(pAt, pEnd) : "";
  if (tracked === 4 && untracked === 1 && has(powerFn, 'data-act="power"') &&
    has(powerFn, "ed.track && d.track") && has(powerFn, "aria-pressed")) {
    ok("① 四组威能（遭遇 / 每日 / 辅助 / 种族职业）都渲染 data-act=power 按钮；随意威能 track:false 保持纯展示");
  } else bad("① 威能组的 track 开关 / data-act=power 不对（tracked=" + tracked + " untracked=" + untracked + "）");
  if (!has(powerFn, "usage") && !has(powerFn, '=== "encounter"') && !has(powerFn, '=== "utility"')) {
    ok("① 四组走同一支 renderPowerGroup（没有按 usage / 单个分类早退）");
  } else bad("① 威能渲染里还有按 usage / 单个分类的早退");

  /* ---- ② 装备：每行 data-act=equipment + 稳定 key ---- */
  if (has(glanceV1712, 'data-act="equipment"') && has(glanceV1712, 'prefix + ":" + id + ":" + n') &&
    has(glanceV1712, "equipmentUsedRaw[r.key]")) {
    ok("② 装备每行 data-act=equipment，key 用稳定 id（前缀:物品id:序号），未知 key 直接忽略");
  } else bad("② 装备没改成 equipment / key 仍按下标 / 没有过滤未知 key");
  if (has(trackV1712, 'case "equipment":') && has(trackV1712, 'case "item":') &&
    has(trackV1712, "delete out.equipmentUsed[key]")) {
    ok("② track.js：equipment / item 都能切换（老页面缓存兼容）");
  } else bad("② track.js 缺少 equipment 动作 / item 兼容 / 切换逻辑");

  /* ---- ③ 共享数据在顶部、HP 区没有、语义正确 ---- */
  const hAt = glanceV1712.indexOf("function renderHpBlock(");
  const hEnd = hAt < 0 ? -1 : glanceV1712.indexOf("\n}", hAt);
  const hpFn = stripComments(hAt >= 0 && hEnd > hAt ? glanceV1712.slice(hAt, hEnd) : "");
  if (has(glanceV1712, "共享数据") && has(glanceV1712, "gl4-share") && has(glanceV1712, "gl4-head-right") &&
    has(glanceV1712, "quick + share") && !has(hpFn, 'data-act="lock"') && !has(hpFn, "共享数据") &&
    !has(glanceV1712, "gl4-lock-row")) {
    ok("③ 共享数据只在顶部标题区（.gl4-head-right + quick + share），HP 区不再有 data-act=lock / 老按钮");
  } else bad("③ 共享数据 chip 的位置不对（顶部 / HP 区 / 旧 class 还有残留）");
  if (has(glanceV1712, "共享数据：开") && has(glanceV1712, "共享数据：关") &&
    has(glanceV1712, '(d.locked ? "" : " on")') && has(glanceV1712, 'd.locked ? "false" : "true"')) {
    ok("③ 开关方向：hp.locked=false = 共享 = 显示精确数字；true = 量化（默认），aria-pressed 跟着反");
  } else bad("③ 共享数据的开 / 关语义、class 或 aria-pressed 不对");
  if (has(cssV1712, ".gl4-head-right") && has(cssV1712, ".gl4-share") && has(cssV1712, ".gl4-share.on") &&
    !has(cssV1712, ".gl4-lock-row")) {
    ok("③ glance.css：顶部一组（.gl4-head-right）+ 共享数据 chip（.gl4-share / .on 绿色高亮）");
  } else bad("③ glance.css 缺少 .gl4-head-right / .gl4-share");

  /* ---- ④ 专长区块（v1.8.6 用户确认整块不显示） + info.js 接线 ---- */
  if (!has(glanceV1712, 'data-act="feat"') && !has(glanceV1712, "gl4-feats")) {
    ok("④ 专长区块整块不渲染（v1.8.6：名称 / 每日 / 赠送都不出现，也不可点）");
  } else bad("④ 专长区块又被渲染了");
  if (has(infoV1712, "deriveGlance(card.char, undefined, { hp: hp, state: state })") &&
    has(infoV1712, 'closest("[data-act]")')) {
    ok("④ info.js：同一个 [data-act] 事件委托覆盖威能 / 装备 / 共享数据；推导带实时 hp / state");
  } else bad("④ info.js 的点击委托 / 实时推导没接好");

  /* ---- ⑤ 自测同步（test-glance / test-track） ---- */
  const needGlance = ['data-act="power"', 'data-act="equipment"', "共享数据", "已用 0 /", "gl4-vitals", "hp.locked"];
  const missGlance = needGlance.filter((s) => !has(testGlanceV1712, s));
  if (!missGlance.length) ok("⑤ dev/test-glance.mjs：断言四组每个 chip / 每行装备 / 默认 0 / N / 共享数据在顶部");
  else bad("⑤ dev/test-glance.mjs 少了断言：" + missGlance.join(" / "));
  const needTrack = ["encounter", "daily", "utility", "special", "默认状态", "equipment"];
  const missTrack = needTrack.filter((s) => !has(testTrackV1712, s));
  if (!missTrack.length) ok("⑤ dev/test-track.mjs：断言四组威能 toggle / 默认全未用 / equipment 动作名");
  else bad("⑤ dev/test-track.mjs 少了断言：" + missTrack.join(" / "));

  /* ---- ⑥ 版本 / bundle / 文档 ---- */
  if (man.version === VER && manRel.version === VER && verOf(commonSrc) === VER && verOf(coreSrc2) === VER &&
    bgHtml.indexOf("background.bundle.js?v=" + VER) >= 0 &&
    indexHtmlSrc.indexOf('<span class="tag">v' + VER + '</span>') >= 0) {
    ok("⑥ 版本 " + VER + " 全链路（manifest×2 / common / core / background.html ?v= / index.html）");
  } else bad("⑥ 版本没升到 " + VER);
  if (has(bundleV1712, "(v" + VER + ")") && has(bundleV1712, 'var PLUGIN_VERSION = "' + VER + '";')) {
    ok("⑥ background.bundle.js 已重建（头部 " + VER + " + PLUGIN_VERSION）");
  } else bad("⑥ bundle 没跟上 " + VER + "（跑 node dev/build-background.mjs）");
  if (!man.action) ok("⑥ manifest 仍然没有 action");
  else bad("⑥ manifest 又加回了 action");
  if (has(readmeV1712, "v1.7.12") && has(readmeV1712, "共享数据") &&
    has(changelogV1712, "v1.7.12") && has(changelogV1712, "共享数据") && has(changelogV1712, "装备")) {
    ok("⑥ README / CHANGELOG 补了 v1.7.12（四组威能 / 装备 / 共享数据）");
  } else bad("⑥ README / CHANGELOG 没有补 v1.7.12");
}

console.log("== v1.7.13 速览窗点击回归：pointer-events / 事件委托 / 缓存穿透");
{
  const infoHtmlV1713 = fs.readFileSync(path.join(ROOT, "info.html"), "utf8");
  const infoJsV1713 = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
  const glanceCssV1713 = fs.readFileSync(path.join(ROOT, "assets", "glance.css"), "utf8");
  const uiCssV1713 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const initHtmlV1713 = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
  const coreV1713 = fs.readFileSync(corePath, "utf8");
  const testClickV1713 = fs.readFileSync(path.join(ROOT, "dev", "test-info-click.mjs"), "utf8");
  const readmeV1713 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelogV1713 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;

  /* ---- ① 速览页链路里不能有 pointer-events:none（注释不算；v1.7.10 的透明方案遗留）
   *      ui.css 允许且只允许两处**装饰层**的 none：.drop-mark（先攻拖拽指示线，3px）
   *      与 .fx-stage*（投骰动画，故意点穿地图）。先把这两条规则抠掉，剩下的必须干净。 ---- */
  const uiDecorNone = stripComments(uiCssV1713)
    .replace(/\.drop-mark\s*\{[^}]*\}/g, " ")
    .replace(/\.fx-stage\s*\{[^}]*\}/g, " ")
    .replace(/\.fx-stage \*\s*\{[^}]*\}/g, " ");
  const scanNone = [
    ["info.html", stripComments(infoHtmlV1713)],
    ["assets/info.js", stripComments(infoJsV1713)],
    ["assets/glance.css", stripComments(glanceCssV1713)],
    ["initiative.html", stripComments(initHtmlV1713)],
    ["assets/ui.css（去掉两处装饰层后）", uiDecorNone]
  ].filter(([, src]) => /pointer-events\s*:\s*none/.test(src));
  if (!scanNone.length) {
    ok("① 全仓审计：除 .fx-stage（投骰动画）与 .drop-mark（先攻拖拽线）两处装饰层外，速览页 / 先攻页链路没有任何 pointer-events:none");
  } else bad("① 这些文件里还有 pointer-events:none：" + scanNone.map((x) => x[0]).join(" / "));

  /* ---- ② 两处装饰层的 none 必须保留（纯展示、故意点穿地图；不是速览页） ---- */
  if (has(uiCssV1713, ".fx-stage { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }") &&
    has(uiCssV1713, ".fx-stage * { pointer-events: none !important;") &&
    /\.drop-mark\s*\{[^}]*pointer-events:\s*none/.test(uiCssV1713)) {
    ok("② 装饰层的 pointer-events:none 原样保留（.fx-stage 投骰动画 / .drop-mark 拖拽线；速览正文不引用）");
  } else bad("② 装饰层的 pointer-events:none 被误删 / 被改到正文上了");

  /* ---- ③ 速览页把 auto 显式写回来（祖先 none 时后代仍能成为命中目标） ---- */
  if (has(glanceCssV1713, "body.info-body") && has(glanceCssV1713, "pointer-events: auto !important") &&
    has(glanceCssV1713, "body.info-body .pop-body") && has(glanceCssV1713, "body.info-body .gl4 [data-act]") &&
    has(glanceCssV1713, "body.info-body button")) {
    ok("③ glance.css：速览页容器链 + 所有 [data-act] / button / input 显式 pointer-events:auto（兜住祖先 none）");
  } else bad("③ 速览页缺少 pointer-events:auto 兜底（宿主 / 旧样式给祖先留 none 时会整窗点不动）");

  /* ---- ④ 事件委托：document + 捕获阶段 + 仍只认 [data-act]，且没有退回 #body ---- */
  if (has(infoJsV1713, 'document.addEventListener("click", onActClick, true)') &&
    has(infoJsV1713, 'document.addEventListener("change", onActChange, true)') &&
    has(infoJsV1713, 'closest("[data-act]")') &&
    !has(infoJsV1713, 'bodyEl.addEventListener("click"')) {
    ok("④ info.js：事件委托挂在 document **捕获阶段**（不再只挂 #body），仍只认 [data-act]");
  } else bad("④ info.js 的事件委托没有挂到 document 捕获阶段（重画 / stopPropagation 会丢点击）");

  /* ---- ⑤ 缓存穿透：info 入口 + glance/track 模块 + popover URL 全都带版本 ---- */
  if (has(infoHtmlV1713, "assets/info.js?v=" + VER) && has(infoHtmlV1713, "assets/glance.css?v=" + VER) &&
    has(infoHtmlV1713, "assets/ui.css?v=" + VER) && has(infoJsV1713, "./glance.js?v=" + VER) &&
    has(infoJsV1713, "./track.js?v=" + VER)) {
    ok("⑤ 速览入口与 glance.js / track.js 都带 ?v=" + VER + "（旧缓存不会再让 chip 变成不可点的旧渲染）");
  } else bad("⑤ 速览页入口 / 模块没有带 ?v=" + VER);
  if (has(coreV1713, 'URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION)') &&
    has(bundleSrc2, 'URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION)')) {
    ok("⑤ info popover 的 URL 也带 ?v=<版本>（连 HTML 一起换 URL，不靠宿主清缓存）");
  } else bad("⑤ info popover 的 URL 没有版本查询串（旧 info.html 会被继续缓存）");

  /* ---- ⑥ 假 DOM 点击冒烟必须存在，且真的 dispatchEvent + 断言 track.js 写入 ---- */
  const needClick = ['dispatchEvent(new MouseEvent("click"', 'data-act="power"', 'data-act="equipment"',
    "powerUsed", "equipmentUsed", "applyAction", "info.js"];
  const missClick = needClick.filter((s) => !has(testClickV1713, s));
  if (!missClick.length) ok("⑥ dev/test-info-click.mjs：用真 info.js + dispatchEvent(MouseEvent) 断言 track.js 写入");
  else bad("⑥ 速览点击冒烟缺少：" + missClick.join(" / "));

  /* ---- ⑦ 文档：把「为什么」写清楚，避免下个版本又把 none 加回来 ---- */
  if (has(changelogV1713, "v1.7.13") && has(changelogV1713, "pointer-events") &&
    has(readmeV1713, "v1.7.13") && notesHas("速览窗点击回归（v1.7.13）")) {
    ok("⑦ CHANGELOG / README / docs/NOTES.md 补了 v1.7.13 的点击回归说明");
  } else bad("⑦ 文档没有补 v1.7.13 的点击回归说明");
}

console.log("== v1.7.14 先攻条背景真透明：逐行照抄 FullPeople（inline !important + darkreader-lock + :root）");
{
  const initHtmlV1714 = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
  const uiV1714 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const coreV1714 = fs.readFileSync(corePath, "utf8");
  const bundleV1714 = fs.readFileSync(bundlePath, "utf8");
  const readmeV1714 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelogV1714 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const testInitV1714 = fs.readFileSync(path.join(ROOT, "dev", "test-initiative.mjs"), "utf8");
  const has = (src, sub) => String(src).indexOf(sub) >= 0;

  /* ---- ① 三件套（照抄 initiative-panel-v131.html） ---- */
  if (has(initHtmlV1714, 'name="darkreader-lock"'))
    ok("① initiative.html 有 <meta name=\"darkreader-lock\">（Dark Reader 之类的扩展整页不处理 —— 这是 FullPeople 的做法）");
  else bad("① initiative.html 缺 darkreader-lock（暗色扩展会继续往这个 iframe 注入深色底）");
  if (has(initHtmlV1714, 'setProperty("color-scheme", "normal", "important")') &&
    has(initHtmlV1714, 'setProperty("background", "transparent", "important")') &&
    has(initHtmlV1714, 'setProperty("background-color", "transparent", "important")'))
    ok("① 首帧之前把 color-scheme:normal / background:transparent **!important 写进 html·body 的 style 属性**（inline !important 高于任何选择器 !important）");
  else bad("① 没有 inline 的 background:transparent!important —— 前三版失败就失败在这一层");
  if (has(initHtmlV1714, "color-scheme: normal !important"))
    ok("① <style data-overlay-canvas> 里有 color-scheme: normal !important（Chromium 不给这个 iframe 画深色画布底）");
  else bad("① 缺 color-scheme: normal !important");
  if (has(initHtmlV1714, "html.strip-html body.strip-page #app") &&
    /html\.strip-html body\.strip-page #app[\s\S]{0,400}?background: transparent !important/.test(initHtmlV1714))
    ok("① 页面内把 FullPeople 的 body,#root,.app-hbar,.hbar-cluster 映射成 #app / .win / .win-body / .strip-root / .strip / .strip-items，全 transparent !important");
  else bad("① 页面内的透明规则没有覆盖容器链");
  if (has(initHtmlV1714, 'view === "list"'))
    ok("① 透明只挂先攻条（?view=list 直接 return）→ 列表窗口仍是不透明窗口");
  else bad("① 没按 ?view= 区分：列表窗口会被一起弄成透明");

  /* ---- ② ui.css 的同名规则（样式表版兜底）+ 仍只有两处底色 ---- */
  const v1714Start = uiV1714.indexOf("v1.7.14：先攻条真透明");
  const v1714End = uiV1714.indexOf("/* v1.6.2：卡片区", v1714Start);
  const v1714Block = v1714Start >= 0 ? uiV1714.slice(v1714Start, v1714End > v1714Start ? v1714End : undefined) : "";
  const needLayers = [".win-head", ".win-foot", ".strip-root", ".strip-items"];
  const missLayerV1714 = needLayers.filter((sel) => v1714Block.indexOf(sel) < 0);
  if (!missLayerV1714.length && v1714Block.indexOf("background: transparent !important") >= 0)
    ok("② ui.css 的 v1.7.14 段：.win-head / .win-foot / .strip-root / .strip-items 都是 transparent !important");
  else bad("② ui.css 的 v1.7.14 段缺层：" + missLayerV1714.join(" / "));
  if (/html\.strip-html[^{]*\{[^}]*color-scheme: normal !important/s.test(uiV1714))
    ok("② ui.css 也给 html.strip-html 写了 color-scheme: normal !important");
  else bad("② ui.css 缺 color-scheme: normal !important");
  const v1714Rules = v1714Block.split("\n").filter((line) => !/^\s*(\/\*|\*)/.test(line)).join("\n");
  if (v1714Rules.indexOf(".strip-ctl") < 0 && v1714Rules.indexOf(".initiative-item") < 0)
    ok("② 透明名单没有误伤控制行 .strip-ctl 与卡片 .initiative-item（整条只有这两处有底色）");
  else bad("② 透明名单把控制行 / 卡片也弄透明了（会看不清）");

  /* ---- ③ popover 参数与 FullPeople 的 openPanel() 同序同值 ---- */
  const fnAt = coreV1714.indexOf("function stripPopoverOptions(size, pos) {");
  const fnBody = fnAt >= 0 ? coreV1714.slice(fnAt) : "";
  const endAt = fnBody.indexOf("\n}");
  const optsBody = endAt > 0 ? fnBody.slice(0, endAt) : fnBody.slice(0, 900);
  const order = ['anchorReference: "POSITION"', "anchorPosition:", "anchorOrigin:", "transformOrigin:",
    "disableClickAway: true", "hidePaper: true"];
  let lastAt = -1;
  let ordered = true;
  for (const tok of order) {
    const at = optsBody.indexOf(tok);
    if (at <= lastAt) ordered = false;
    lastAt = at;
  }
  if (ordered && optsBody.length > 0)
    ok("③ stripPopoverOptions 的书写顺序照抄 openPanel()：POSITION → anchorPosition → anchorOrigin → transformOrigin → disableClickAway → hidePaper");
  else bad("③ stripPopoverOptions 的参数顺序与 FullPeople 的 openPanel() 不一致");
  if ((optsBody.split('{ horizontal: "CENTER", vertical: "TOP" }').length - 1) === 2 && !/stripModalOptions/.test(coreV1714))
    ok("③ anchorOrigin / transformOrigin 都是 CENTER+TOP，且先攻条没有 modal 那条路（modal 会把整条交互打穿）");
  else bad("③ 角度 / 位置不对，或先攻条又回到 modal");
  if (!/disablePointerEvents/.test(optsBody))
    ok("③ stripPopoverOptions 里没有 disablePointerEvents（v1.7.10 的事故点）");
  else bad("③ stripPopoverOptions 里又出现 disablePointerEvents");

  /* ---- ④ 交互断言还在 + bundle 已重建 + 文档写清根因 ---- */
  const keep = ["stripOpenCfg.hidePaper === true", "onStripDrag", "onStripCmd", "bonus", "d20"];
  const keepMiss = keep.filter((s) => !has(testInitV1714, s));
  if (!keepMiss.length) ok("④ dev/test-initiative.mjs 的交互断言仍在（popover 参数 / 拖动重开 / 命令频道 / 加值输入 / d20）");
  else bad("④ 交互断言丢了：" + keepMiss.join(" / "));
  if (has(bundleV1714, "(v" + VER + ")") && has(bundleV1714, 'var PLUGIN_VERSION = "' + VER + '";') &&
    has(bundleV1714, "function stripPopoverOptions(size, pos)"))
    ok("④ bundle 已重建（头部 v" + VER + " + 新的 stripPopoverOptions 都在）");
  else bad("④ bundle 没跟上（跑 node dev/build-background.mjs）");
  if (has(readmeV1714, "v1.7.14") && has(readmeV1714, "darkreader-lock") &&
    has(changelogV1714, "v1.7.14") && has(changelogV1714, "darkreader-lock") &&
    notesHas("先攻条背景为什么这么写（v1.7.14")) {
    ok("④ README / CHANGELOG / docs/NOTES.md 都写清了「inline !important + darkreader-lock 才是根因」");
  } else bad("④ 文档没有补 v1.7.14 的透明说明");
}

console.log("== docs 合并（docs/NOTES.md；不再按版本 / 规格拆文件）");
{
  if (exists(NOTES_PATH)) ok("docs/NOTES.md 存在（唯一的维护文档）");
  else bad("缺少 docs/NOTES.md");
  const wants = [
    ["必须重建 bundle", "改 core 要重建 bundle"],
    ["7 条自测", "自测命令"],
    ["manifest 不要加 `action`", "manifest 不加 action"],
    ["数据键名不要改", "数据键名不改（旧存档不丢）"],
    ["token 血条/四防的位置与尺寸", "血条 / 四防常数在哪"],
    ["先攻条尺寸", "先攻条尺寸在哪"],
    ["窗口默认尺寸", "窗口尺寸在哪"],
    ["骰子动画手感", "骰子动画在哪调"]
  ];
  for (const [needle, why] of wants) {
    if (notesHas(needle)) ok("docs/NOTES.md 维护口径：" + why);
    else bad("docs/NOTES.md 缺少维护口径：" + needle);
  }
  const orphanDocs = ["popover-drag.md", "initiative-v13.md", "separate-windows-v131.md", "settings-window.md",
    "initiative-v14.md", "dice-v15.md", "hpbar-boss-v16.md", "dice-v17.md", "ui-v162.md",
    "spec-initiative.md", "spec-dice.md", "spec-hpbar-boss.md"];
  const stillThere = orphanDocs.filter((n) => exists(path.join(ROOT, "docs", n)));
  if (!stillThere.length) ok("docs/ 下没有残留的按版本 / 规格拆出来的 md（合并之后别再拆回来）");
  else bad("docs/ 下又出现了拆分文档：" + stillThere.join(" / "));
}

/* =======================================================================
 * v1.7.15：房间数据超限（16 kB）真修复
 * =======================================================================
 * 真机：Uncaught (in promise) Error: Unable to update metadata: over size limit of 16 kB
 *   → 之后所有 room.setMetadata（加入先攻 / 改加值 / 回合推进 / 骰子历史 / 资源）全被拒，且静默。
 * 这一版四层：卡片精简 / 写前预算 / 本机降级 / 设置里的清理入口。
 * 行为断言在 dev/test-cards.mjs（下面 spawn），这里只查静态接线与常量一致性。 */
console.log("== v1.7.15 房间数据超限（16 kB）真修复：卡片精简 / 写前预算 / 本机降级 / 清理入口");
{
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  const cardsCoreV1715 = fs.readFileSync(path.join(ROOT, "assets", "cards-core.js"), "utf8");
  const commonV1715 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const trackV1715 = fs.readFileSync(path.join(ROOT, "assets", "track.js"), "utf8");
  const initV1715 = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
  const panelV1715 = fs.readFileSync(path.join(ROOT, "assets", "panel.js"), "utf8");
  const coreV1715 = fs.readFileSync(corePath, "utf8");
  const setHtmlV1715 = fs.readFileSync(path.join(ROOT, "settings.html"), "utf8");
  const setJsV1715 = fs.readFileSync(path.join(ROOT, "assets", "settings-page.js"), "utf8");
  const readmeV1715 = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelogV1715 = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const testCardsV1715 = fs.readFileSync(path.join(ROOT, "dev", "test-cards.mjs"), "utf8");
  const bundleV1715 = fs.readFileSync(path.join(ROOT, "assets", "background.bundle.js"), "utf8");
  const MSG1715 = "房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史";

  /* ---- ① 卡片精简（assets/cards-core.js） ---- */
  for (const name of ["packCard", "unpackCard", "cardBytes", "cardsBytes", "roomBytes", "mergeRoom", "roomBudget"]) {
    if (new RegExp("export function " + name + "\\(").test(cardsCoreV1715)) ok("① cards-core.js 导出 " + name);
    else bad("cards-core.js 没有导出 " + name);
  }
  if (/export const ROOM_MAX_BYTES = 14 \* 1024;/.test(cardsCoreV1715) &&
    /export const ROOM_HARD_BYTES = 16 \* 1024;/.test(cardsCoreV1715) &&
    /export const CARD_MAX_BYTES = 2048;/.test(cardsCoreV1715)) {
    ok("① 预算常量：房间 14 KB（" + 14 * 1024 + "）/ 硬上限 16 KB / 单卡 2 KB");
  } else bad("cards-core.js 的预算常量不对（要 14*1024 / 16*1024 / 2048）");
  if (has(cardsCoreV1715, 'ROOM_FULL_MESSAGE = "' + MSG1715 + '";')) ok("① 超限文案逐字：" + MSG1715);
  else bad("cards-core.js 的超限文案不是约定的那句");
  if (has(cardsCoreV1715, 'LS_CARDS = "4enext/cards-local";')) ok("① 本机兜底键 4enext/cards-local");
  else bad("cards-core.js 没有 LS_CARDS");
  const coreForbidden = ["spellbook", "backpack", "portraitCropped", "portraitOriginal", "creation"];
  const coreLeak = coreForbidden.filter((k) => new RegExp('out\\.' + k + '\\s*=').test(cardsCoreV1715));
  if (!coreLeak.length) ok("① 精简格式里没有立绘 / spellbook / backpack / creation 这些非渲染字段");
  else bad("cards-core.js 还在存非渲染字段：" + coreLeak.join(" / "));
  if (has(cardsCoreV1715, "pz: 1") && has(cardsCoreV1715, "unpackCard") && has(cardsCoreV1715, "backList")) {
    ok("① 精简格式带 pz 标记（旧数据原样返回）+ unpackCard 还原 Character 形状");
  } else bad("cards-core.js 缺少 pz 标记 / 还原逻辑");

  /* ---- ② 写前预算（页面：common.js 的 writeRoomKey） ---- */
  if (/export async function writeRoomKey\(key, value\)/.test(commonV1715) &&
    /const budget = roomBudget\(meta, patch\);/.test(commonV1715) &&
    /if \(!budget\.ok\) return \{ ok: false, reason: "full"/.test(commonV1715)) {
    ok("② common.js 的 writeRoomKey：写之前算体积，超预算返回 reason=full（不写）");
  } else bad("common.js 没有「写前预算」的 writeRoomKey");
  if (/writeRoomKey\(KEY_CARDS, payload\)/.test(commonV1715) && /char: packCard\(c && c\.char\)/.test(commonV1715)) {
    ok("② writeCards 先把卡片 packCard 精简、再过 writeRoomKey");
  } else bad("writeCards 没有精简 / 没有走预算");
  if (/notify\(ROOM_FULL_MESSAGE, "ERROR"\)/.test(commonV1715) &&
    /notify\("角色卡没能写进房间数据/.test(commonV1715)) {
    ok("② 角色卡超限 / 拒写都弹 ERROR 通知（不静默）");
  } else bad("common.js 的超限 / 拒写没有 ERROR 通知");
  if (/export async function getCardsInfo\(\)/.test(commonV1715) &&
    /local\.updatedAt > roomAt/.test(commonV1715) &&
    /scope: "local"/.test(commonV1715)) {
    ok("② getCardsInfo：房间 / 本机「谁更新用谁」，带 scope = room|local");
  } else bad("common.js 的 getCardsInfo 没有本机降级");
  if (/export async function getRoomUsage\(\)/.test(commonV1715) &&
    /export async function clearRoomRolls\(\)/.test(commonV1715) &&
    /export async function clearRoomCards\(\)/.test(commonV1715)) {
    ok("② 清理入口在 common.js：getRoomUsage / clearRoomRolls / clearRoomCards");
  } else bad("common.js 缺少清理房间数据的三个函数");
  if (/export \{\s*ROOM_NS, ROOM_MAX_BYTES/.test(commonV1715)) ok("② common.js 把预算常量 / 纯函数透出给页面");
  else bad("common.js 没有透出预算常量");

  /* ---- ③ 四条写路径都接上预算 ---- */
  if (/writeRoomKey\(KEY_INITIATIVE, next\)/.test(initV1715) &&
    /res\.reason === "full"[\s\S]{0,80}?ROOM_FULL_MESSAGE/.test(initV1715)) {
    ok("③ 先攻（页面 initiative.js）：writeInitiative 走 writeRoomKey，超限弹 ROOM_FULL_MESSAGE");
  } else bad("initiative.js 的 writeInitiative 没有接预算");
  if (/writeRoomKey\(key, next\)/.test(trackV1715) &&
    /res\.reason === "full"[\s\S]{0,40}ROOM_FULL_MESSAGE, "ERROR"/.test(trackV1715)) {
    ok("③ 资源（track.js）：commitState 走 writeRoomKey，超限弹 ERROR");
  } else bad("track.js 的 commitState 没有接预算");
  if (/roomWriteGuarded\(KEY_INITIATIVE, next\)/.test(coreV1715) &&
    /roomWriteGuarded\(KEY_ROLLS, box\)/.test(coreV1715)) {
    ok("③ 后台（background.core.js）：先攻 / 骰子落库都走 roomWriteGuarded");
  } else bad("background.core.js 的先攻 / 骰子写入没有接预算");
  if (/var ROOM_MAX_BYTES = 14 \* 1024;/.test(coreV1715) && /var ROOM_HARD_BYTES = 16 \* 1024;/.test(coreV1715) &&
    has(coreV1715, 'var ROOM_FULL_MESSAGE = "' + MSG1715 + '";') && /var LS_CARDS = "4enext\/cards-local";/.test(coreV1715)) {
    ok("③ 后台的常量 / 文案 / 本机键与 cards-core.js 一字不差（经典脚本不能 import）");
  } else bad("background.core.js 的常量 / 文案 / 本机键与 cards-core.js 不一致");
  if (!/await OBR\.room\.setMetadata\(\{ \[(KEY_INITIATIVE|KEY_ROLLS)\]/.test(coreV1715)) {
    ok("③ 后台没有绕过预算的裸 setMetadata（先攻 / 骰子都改走 guard）");
  } else bad("background.core.js 里还有裸 setMetadata 写先攻 / 骰子");
  if (/localCardsFallback\(\)/.test(coreV1715) && /sceneCardsFallback\(\)/.test(coreV1715)) {
    ok("③ 后台 getCards 依次读 房间 → 场景 item → 本机副本（绑定关系不会因为降级而失效）");
  } else bad("background.core.js 的 getCards 没读场景兜底 / 本机副本");
  if (has(bundleV1715, "function roomWriteGuarded(") && has(bundleV1715, "var ROOM_MAX_BYTES = 14 * 1024;")) {
    ok("③ bundle 已重建（roomWriteGuarded / 预算常量都在产物里）");
  } else bad("bundle 没重建：roomWriteGuarded 不在 background.bundle.js 里");

  /* ---- ④ UI：面板标「角色卡：本机」+ 设置里的清理入口 ---- */
  if (/角色卡：' \+ \(cardsScope === "local" \? "本机" : "全桌"\)/.test(panelV1715)) {
    ok("④ 角色卡面板工具栏明写「角色卡：本机 / 全桌」");
  } else bad("panel.js 没有「角色卡：本机 / 全桌」的状态标记");
  if (/cardsScope = info\.scope/.test(panelV1715) && /cardsScope = res\.scope/.test(panelV1715)) {
    ok("④ 面板读 / 写都把 scope 带回界面");
  } else bad("panel.js 没有把 scope 带回界面");
  for (const idn of ["room-usage", "room-refresh", "room-clean-rolls", "room-clean-cards", "room-clean-out"]) {
    if (has(setHtmlV1715, 'id="' + idn + '"')) ok("④ settings.html 有 #" + idn);
    else bad("settings.html 缺少 #" + idn);
  }
  if (has(setHtmlV1715, "清理骰子历史") && has(setHtmlV1715, "清空角色卡") && has(setHtmlV1715, "清理房间数据")) {
    ok("④ 设置窗口「清理房间数据」：清理骰子历史 / 清空角色卡 两个按钮都在");
  } else bad("settings.html 的清理房间数据按钮不全");
  if (/getRoomUsage/.test(setJsV1715) && /clearRoomRolls/.test(setJsV1715) && /clearRoomCards/.test(setJsV1715)) {
    ok("④ settings-page.js 调 common.js 的用量 / 清理函数（自己不碰房间数据）");
  } else bad("settings-page.js 没有接上清理入口");

  /* ---- ⑤ 自测文件 + 文档 ---- */
  for (const needle of ["导入大卡之后房间数据仍然 ≤ 14 KB", "超限时**不写**房间数据", "降级到本机", "清理房间数据"]) {
    if (has(testCardsV1715, needle)) ok("⑤ dev/test-cards.mjs 断言：" + needle);
    else bad("dev/test-cards.mjs 缺少断言：" + needle);
  }
  if (has(readmeV1715, "v1.7.15") && has(readmeV1715, "房间数据超限真修复") &&
    has(readmeV1715, "1906") && has(readmeV1715, "14 KB")) {
    ok("⑤ README 补了 v1.7.15（含精简前后实测数字与 14 KB 预算）");
  } else bad("README 没有补 v1.7.15 的说明 / 实测数字");
  if (has(changelogV1715, "v1.7.15") && has(changelogV1715, "over size limit of 16 kB") &&
    has(changelogV1715, "cards-core.js") && has(changelogV1715, "14 * 1024")) {
    ok("⑤ CHANGELOG 补了 v1.7.15（根因 + 四层修复 + 预算常量）");
  } else bad("CHANGELOG 没有补 v1.7.15");
  if (notesHas("房间数据为什么必须精简（v1.7.15") && notesHas("packCard") && notesHas("writeRoomKey")) {
    ok("⑤ docs/NOTES.md 补了「房间数据为什么必须精简」的维护口径");
  } else bad("docs/NOTES.md 缺少 v1.7.15 的维护口径");
}

/* v1.7.13：假 DOM 点击冒烟（独立进程，stdio 直接继承 —— 不走管道）。
 * 证明「渲染出的 [data-act] → 一次真的 dispatchEvent → track.js applyAction 写房间数据」这条链路没断。 */
console.log("== v1.7.13 速览点击冒烟（dev/test-info-click.mjs）");
{
  const r = spawnSync(process.execPath, [path.join(ROOT, "dev", "test-info-click.mjs")], { cwd: ROOT, stdio: "inherit" });
  const code = typeof r.status === "number" ? r.status : 1;
  if (code === 0) ok("速览点击冒烟通过（dispatchEvent(MouseEvent) → track.js applyAction 写入 powerUsed / equipmentUsed）");
  else bad("速览点击冒烟失败（exit " + code + "）：手动跑 node dev/test-info-click.mjs 看细节");
}

/* v1.7.15：房间数据超限的**行为**自测（独立进程，同样 stdio 直接继承）。
 * 断言「单卡 ≤ 2 KB」「导入大卡后房间数据仍 ≤ 14 KB」「超限不写 + ERROR」「降级本机读得回来」
 * 「OBR 拒写也降级 + ERROR」「设置里的清理按钮真的能腾出空间」。 */
console.log("== v1.7.15 房间数据超限行为自测（dev/test-cards.mjs）");
{
  const r = spawnSync(process.execPath, [path.join(ROOT, "dev", "test-cards.mjs")], { cwd: ROOT, stdio: "inherit" });
  const code = typeof r.status === "number" ? r.status : 1;
  if (code === 0) ok("房间数据超限自测通过（精简 / 预算 / 降级 / 清理）");
  else bad("房间数据超限自测失败（exit " + code + "）：手动跑 node dev/test-cards.mjs 看细节");
}

/* v1.8.0：effect.html / dice-history.html 的透明补强（交接文件 §3.3 的老坑）。
 * 样式表 !important 压不住宿主 / Dark Reader 后注入的 !important → 必须「内联 style + darkreader-lock +
 * data-overlay-canvas」三件套（照抄 initiative.html 的做法），同时只透明外壳、内容卡片保留底色。 */
console.log("== v1.8.0 透明三件套补强（effect.html / dice-history.html）");
{
  const effectHtmlV18 = fs.readFileSync(path.join(ROOT, "effect.html"), "utf8");
  const histHtmlV18 = fs.readFileSync(path.join(ROOT, "dice-history.html"), "utf8");
  const uiV18 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  for (const [label, src] of [["effect.html", effectHtmlV18], ["dice-history.html", histHtmlV18]]) {
    if (/<html[^>]*style="[^"]*color-scheme:normal!important[^"]*background:transparent!important[^"]*"/.test(src))
      ok(label + "：<html> 的 style 属性带 color-scheme:normal!important + background:transparent!important（inline !important 压过宿主注入）");
    else bad(label + "：<html> 缺少 inline style 的 transparent !important（样式表压不住注入的 !important）");
    if (/<body[^>]*style="[^"]*background:transparent!important[^"]*"/.test(src))
      ok(label + "：<body> 的 style 属性带 background:transparent!important");
    else bad(label + "：<body> 缺少 inline style 的 transparent !important");
    if (/<meta name="darkreader-lock">/.test(src)) ok(label + "：有 <meta name=\"darkreader-lock\">");
    else bad(label + "：缺 darkreader-lock（暗色扩展会把透明层染深）");
    if (/<style data-overlay-canvas>/.test(src) && /:root\s*\{[^}]*color-scheme:\s*normal\s*!important/.test(src) &&
      /:root\s*\{[^}]*background:\s*transparent\s*!important/.test(src))
      ok(label + "：有 <style data-overlay-canvas>（:root color-scheme normal + 各层 transparent !important）");
    else bad(label + "：缺 data-overlay-canvas 三件套");
  }
  if (/body\.dh-page \.win \{[\s\S]{0,200}?rgba\(15, 20, 28, \.86\)/.test(uiV18))
    ok("dice-history：卡片内容仍有底色（body.dh-page .win 的 rgba(15,20,28,.86) 没被透明规则抹掉）");
  else bad("dice-history：卡片底色规则丢了（透明补强不能把内容也透明掉）");
  if (histHtmlV18.indexOf('class="win"') >= 0 && histHtmlV18.indexOf('id="dh-list"') >= 0 &&
    effectHtmlV18.indexOf('class="fx-stage"') >= 0)
    ok("两个页面的 DOM 结构未被改动（effect .fx-stage / history .win + #dh-list 都在）");
  else bad("透明补强把页面结构改坏了");
}

/* v1.8.2：先攻条点卡片不再弹速览 —— 页面先广播抑制频道，后台 1.5s 内 refreshInfo 早退。
 * 频道常量必须 common.js / background.core.js 逐字一致；后台要真的订阅。 */
console.log("== v1.8.2 先攻条：点卡片不弹速览（CH_GLANCE_SUPPRESS）");
{
  const commonSrcV182 = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const coreSrcV182 = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const pageSrcV182 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const chCommon = (/export const CH_GLANCE_SUPPRESS = NS \+ "([^"]+)";/.exec(commonSrcV182) || [])[1] || "";
  const chCore = (/var CH_GLANCE_SUPPRESS = NS \+ "([^"]+)";/.exec(coreSrcV182) || [])[1] || "";
  if (chCommon && chCommon === chCore) ok("抑制速览频道一致：CH_GLANCE_SUPPRESS = " + chCommon);
  else bad("CH_GLANCE_SUPPRESS 不一致：common=" + chCommon + " core=" + chCore);
  if (chCore === "/glance-suppress" && /onMessage\(CH_GLANCE_SUPPRESS/.test(coreSrcV182) &&
    /suppressGlanceUntil = Date\.now\(\) \+ 1500;/.test(coreSrcV182) &&
    /if \(Date\.now\(\) < suppressGlanceUntil\) return;/.test(coreSrcV182))
    ok("后台：订阅 CH_GLANCE_SUPPRESS → suppressGlanceUntil = now+1500、refreshInfo 里早退");
  else bad("后台没有接抑制速览（频道订阅 / 1.5s 窗口 / refreshInfo 早退 缺一）");
  const sendIdx = pageSrcV182.indexOf("sendMessage(CH_GLANCE_SUPPRESS");
  const selIdx = pageSrcV182.indexOf("OBR.player.select");
  if (sendIdx >= 0 && selIdx >= 0 && sendIdx < selIdx)
    ok("先攻条页面：先发 CH_GLANCE_SUPPRESS 再 select（避免速览抢在抑制之前弹）");
  else bad("先攻条页面没有「先发抑制再 select」");
}

/* ===========================================================================
 * v1.8.6：速览首屏提速 —— 索引瘦身 / 首帧不阻塞 / 后台预热
 * ======================================================================== */
console.log("== v1.8.6 速览首屏提速：索引瘦身 / 首帧不阻塞 / 后台预热");
{
  const has = (src, sub) => String(src).indexOf(sub) >= 0;
  const infoV186 = fs.readFileSync(path.join(ROOT, "assets", "info.js"), "utf8");
  const glanceV186 = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
  const coreV186 = fs.readFileSync(corePath, "utf8");
  const glanceCodeV186 = stripComments(glanceV186);
  const idxPath = path.join(ROOT, "data", "card-index.js");
  const detailsPath = path.join(ROOT, "data", "card-index-details.js");

  /* ---- ① 首帧不阻塞：先 refresh(true)，再 loadCardIndex().then 二次刷新 ---- */
  const firstRefresh = infoV186.indexOf("void refresh(true)");
  const firstLoad = infoV186.indexOf("loadCardIndex().then");
  if (firstRefresh >= 0 && firstLoad > firstRefresh) {
    ok("① info.js 首帧不阻塞：先 refresh(true) 立即渲染，索引加载完再二次刷新补标签");
  } else bad("① info.js 仍在首帧 await 索引（refresh 必须早于 loadCardIndex）");
  if (has(infoV186, "refreshWithIndex(")) ok("① info.js 有「索引到位后补渲染」逻辑（busy 时重试，避免二次刷新被吞）");
  else bad("① info.js 没有索引到位后的补渲染逻辑");
  const panelV186 = fs.readFileSync(path.join(ROOT, "assets", "panel.js"), "utf8");
  const pFirstRefresh = panelV186.indexOf("void refresh().then");
  const pFirstLoad = panelV186.indexOf("loadCardIndex().then");
  if (pFirstRefresh >= 0 && pFirstLoad > pFirstRefresh) ok("① panel.js 预览同样先绘制、索引到位后再重绘");
  else bad("① panel.js 仍在 await 索引后首绘");

  /* ---- ② 索引只留使用频率+动作类型，glance 不再引用 feats / 攻击命中 / 装备等级 ---- */
  if (!has(glanceCodeV186, "CARD_INDEX.feats") && !has(glanceCodeV186, "loadCardDetails") &&
    !has(glanceCodeV186, "card-index-details")) {
    ok("② glance.js 只加载一份精简索引（没有 feats / details 分支）");
  } else bad("② glance.js 还在引用 feats / card-index-details");
  if (!has(glanceCodeV186, "攻击：") && !has(glanceCodeV186, "命中：") && !has(glanceCodeV186, '"攻击："') &&
    !has(glanceCodeV186, "equipLevelText") && !has(glanceCodeV186, "gl4-lv") && !has(glanceCodeV186, "gl4-feats")) {
    ok("② glance.js 不再拼攻击/命中 tooltip、不再渲染专长区块 / 装备等级档位");
  } else bad("② glance.js 还残留攻击命中 tooltip / 专长 / 装备等级代码");
  if (has(glanceV186, "gl4-act")) ok("② 威能动作类型标签保留（gl4-act）");
  else bad("② 威能动作类型标签被误删");

  /* ---- ③ 索引文件：存在、唯一、文件头、体积 ≤350KB ---- */
  if (exists(idxPath)) {
    const text = fs.readFileSync(idxPath, "utf8");
    const bytes = fs.statSync(idxPath).size;
    if (has(text, "自动生成") && has(text, "重新生成：node dev/gen-card-index.mjs") && bytes <= 350 * 1024) {
      ok("③ data/card-index.js：" + (bytes / 1024).toFixed(0) + " KB（≤350KB）、有自动生成 / 重生成文件头");
    } else bad("③ card-index.js 文件头或体积不对：" + (bytes / 1024).toFixed(0) + " KB");
  } else bad("③ 缺少 data/card-index.js");
  if (!exists(detailsPath)) ok("③ 没有 card-index-details.js（v1.8.6 不再生成第二个索引）");
  else bad("③ data/card-index-details.js 还在（v1.8.6 应删除）");
  const genV186 = fs.readFileSync(path.join(ROOT, "dev", "gen-card-index.mjs"), "utf8");
  if (has(genV186, "data/card-index.js") && !has(genV186, "card-index-details.js") && has(genV186, 'v: 1')) {
    ok("③ gen-card-index.mjs 只生成单文件精简索引（v/c/p 结构）");
  } else bad("③ gen-card-index.mjs 仍生成旧结构 / details 文件");

  /* ---- ④ 后台预热索引（延迟、失败静默、不影响启动） ---- */
  if (has(coreV186, "data/card-index.js") && has(coreV186, 'cache: "force-cache"') &&
    has(coreV186, "pageUrl(\"data/card-index.js\")") && has(coreV186, "}, 2000);")) {
    ok("④ background.core.js：启动后延迟 2s 用 fetch(force-cache) 预热 data/card-index.js");
  } else bad("④ background.core.js 没有后台预热索引（缺 fetch / force-cache / 2s 延迟）");
  if (!/await\s+fetch\(prewarm/.test(coreV186)) ok("④ 预热不 await、不影响启动");
  else bad("④ 预热被 await 了（会拖慢启动）");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
