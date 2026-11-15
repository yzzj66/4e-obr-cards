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
for (const f of ["assets/common.js", "assets/glance.js", "assets/track.js", "assets/initiative.js", "assets/window.js", "assets/info.js", "assets/panel.js", "assets/initiative-page.js", "assets/dice-core.js", "assets/dice-4e.js", "assets/dice-page.js", "assets/settings-page.js", "assets/bind.js", "assets/button.js", "assets/index.js"]) {
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
for (const p of ["manifest.json", "manifest.relative.json", "background.html", "panel.html", "info.html", "initiative.html", "dice.html", "settings.html", "bind.html", "button.html", "index.html", "icon.svg", "icon-tool.svg", "icon-tool-initiative.svg", "icon-tool-dice.svg", "icon-tool-glance.svg", "icon-tool-settings.svg", "README.md", "assets/glance.js", "assets/glance.css", "assets/track.js", "assets/window.js", "assets/panel.js", "assets/initiative-page.js", "assets/dice-core.js", "assets/dice-4e.js", "assets/dice-page.js", "assets/settings-page.js", "assets/background.core.js", "assets/background.bundle.js", "data/rules.js", "vendor/obr-sdk.js", "samples/sample-card.json", "docs/owlbear-debug.md", "docs/hp-bar-and-tracking.md", "docs/ui-tweaks-v121.md", "docs/popover-drag.md", "docs/initiative-v13.md", "docs/separate-windows-v131.md", "docs/settings-window.md", "docs/initiative-v14.md", "docs/dice-v15.md", "docs/hpbar-boss-v16.md"]) {
  if (exists(path.join(ROOT, p))) ok(p); else bad("缺少 " + p);
}


console.log("== DOM id 引用");
const PAGES = [
  ["panel.html", "assets/panel.js"],
  ["info.html", "assets/info.js"],
  ["initiative.html", "assets/initiative-page.js"],
  ["dice.html", "assets/dice-page.js"],
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
if (exists(path.join(ROOT, "docs", "popover-drag.md"))) ok("docs/popover-drag.md");
else bad("缺少 docs/popover-drag.md");

console.log("== v1.3.1 分块：各自独立窗口（没有三 tab）");
const bgHtmlV131 = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
const manRel = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.relative.json"), "utf8"));
if (man.name === "4eNEXT to owlbear") ok("manifest.name = 4eNEXT to owlbear");
else bad("manifest.name 不是 4eNEXT to owlbear：" + man.name);
if (manRel.name === man.name) ok("manifest.relative.json 名字一致");
else bad("manifest.relative.json 名字不一致：" + manRel.name);
if (man.version === "1.6.0" && manRel.version === man.version) ok("版本 1.6.0（绝对 + 相对 manifest）");
else bad("版本不是 1.6.0：" + man.version + " / " + manRel.version);

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
else bad("manifest.action.popover 不是 panel.html：" + (man.action && man.action.popover));
if (man.action && !/\?tab=/.test(String(man.action.popover))) ok("action.popover 不再带 ?tab=...（没有 tab 概念了）");
else bad("action.popover 还带着 ?tab=...");
if (/label: "加入先攻"/.test(coreSrcV131) && /label: "隐形加入先攻"/.test(coreSrcV131)) ok("右键菜单有「加入先攻」「隐形加入先攻」两项");
else bad("右键菜单缺少「加入先攻」/「隐形加入先攻」");
if (/id: NS \+ "\/init-add"/.test(coreSrcV131) && /id: NS \+ "\/init-add-hidden"/.test(coreSrcV131)) ok("右键两项是独立注册（各自 id + filter）");
else bad("右键两项没有各自的 id");
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
if (/function openWin\(name\)/.test(coreSrcV131) && /var vp = await infoViewport\(\);/.test(coreSrcV131) &&
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
if (/function onInitMenuClick\(/.test(coreSrcV131) && /room\.setMetadata\(\{ \[KEY_INITIATIVE\]: next \}\)/.test(coreSrcV131))
  ok("右键加入先攻会写房间数据");
else bad("右键加入先攻没有写房间数据");
if (/function bindToken\(/.test(commonSrc) && /metadata\[KEY_INIT\]/.test(commonSrc) && /initiativeBonus\(/.test(commonSrc))
  ok("绑定角色卡时写入 init 元数据（先攻加值取卡里的先攻）");
else bad("bindToken 没有写入 init 元数据 / 没有复用 initiativeBonus");
if (exists(path.join(ROOT, "docs", "initiative-v13.md"))) ok("docs/initiative-v13.md");
else bad("缺少 docs/initiative-v13.md");
if (exists(path.join(ROOT, "docs", "separate-windows-v131.md"))) ok("docs/separate-windows-v131.md（为什么拆开）");
else bad("缺少 docs/separate-windows-v131.md");
if (exists(path.join(ROOT, "dev", "test-initiative.mjs"))) ok("dev/test-initiative.mjs");
else bad("缺少 dev/test-initiative.mjs");
if (/background\.bundle\.js\?v=1\.6\.0/.test(bgHtmlV131)) ok("background.html 的 ?v= 也是 1.6.0（缓存破坏参数跟着版本走）");
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

if (exists(path.join(ROOT, "docs", "settings-window.md"))) ok("docs/settings-window.md（设置窗口说明）");
else bad("缺少 docs/settings-window.md");

console.log("== v1.4.0 先攻条（P0 数据层 + P1/P2 条 UI）");

const initSrcV14 = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
const coreSrcV14 = fs.readFileSync(corePath, "utf8");
const pageSrcV14 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
const initHtmlV14 = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
const uiCssV14 = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");

/* ---- 1) P0 数据层：上限 60 / d20 / tb / phase / 写失败降级 ---- */
const maxEntries = (src) => (/(?:export const |var )INIT_MAX_ENTRIES = (\d+);/.exec(src) || [])[1] || "";
const maxA = maxEntries(initSrcV14);
const maxB = maxEntries(coreSrcV14);
if (maxA === "60" && maxB === "60") ok("先攻条目上限两边都是 60（房间数据约 16 KB 的预算，规格 §9.3）");
else bad("先攻条目上限不是 60：initiative.js=" + maxA + " background.core.js=" + maxB);

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
  STRIP_H_IDLE: "129", STRIP_H_PREPARING: "139", STRIP_H_COMBAT: "159", STRIP_TOP_OFFSET: "45",
  STRIP_CARD_W: "56", STRIP_CARD_H: "80", STRIP_CARD_ACTIVE_H: "100"
};
const wrongNum = Object.keys(WANT_NUMS).filter((n) => constOf(initSrcV14, n) !== WANT_NUMS[n]);
if (!wrongNum.length) ok("先攻条/卡片尺寸与规格一致（120×40 / 720×129|139|159 / 56×80 / 当前 100）");
else bad("尺寸与规格不一致：" + wrongNum.map((n) => n + "=" + constOf(initSrcV14, n)).join("，"));
if (/if \(p === PHASE_COMBAT\) return STRIP_H_COMBAT;/.test(initSrcV14) && /if \(p === PHASE_PREPARING\) return STRIP_H_PREPARING;/.test(initSrcV14) &&
  /function stripHeightFor\(phase\) \{[^}]*return STRIP_H_COMBAT;/.test(coreSrcV14))
  ok("高度按 phase 三档（idle 129 / preparing 139 / combat 159）");
else bad("先攻条高度不是按 phase 三档");
if (/Math\.max\(STRIP_MIN_EXPANDED_W, Math\.min\(STRIP_EXPANDED_W/.test(coreSrcV14) && /STRIP_SIDE_MARGIN \* 2/.test(coreSrcV14))
  ok("展开宽度 = max(410, 测量值+16)，并按视口 −32 夹紧（规格 §3.3 / §3.6）");
else bad("展开宽度没有自适应 / 视口夹紧");

/* ---- 3) popover 参数（规格 §3.2）与拖动频道 ---- */
const idStripCore = (/var ID_STRIP = NS \+ "([^"]+)";/.exec(coreSrcV14) || [])[1] || "";
const idStripCommon = (/export const ID_STRIP = NS \+ "([^"]+)";/.exec(commonSrc) || [])[1] || "";
if (idStripCore && idStripCore === idStripCommon) ok("先攻条 popover id 一致：" + idStripCore);
else bad("先攻条 popover id 不一致：core=" + idStripCore + " common=" + idStripCommon);
if (/anchorReference: "POSITION"/.test(coreSrcV14) &&
  /anchorOrigin: \{ horizontal: "CENTER", vertical: "TOP" \}/.test(coreSrcV14) &&
  /transformOrigin: \{ horizontal: "CENTER", vertical: "TOP" \}/.test(coreSrcV14) &&
  /disableClickAway: true/.test(coreSrcV14) && /hidePaper: true/.test(coreSrcV14))
  ok("先攻条 popover：POSITION + CENTER/TOP + disableClickAway + hidePaper");
else bad("先攻条 popover 的锚点参数不对（规格 §3.2 要 CENTER/TOP）");
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
if (initSrcV14.indexOf('data-roll="dis"') >= 0 && initSrcV14.indexOf('data-roll="normal"') >= 0 && initSrcV14.indexOf('data-roll="adv"') >= 0)
  ok("卡片下方三个掷骰按钮（劣势 / 普通 / 优势）");
else bad("卡片下方缺少三个掷骰按钮");
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
cssOk("掷骰按钮上移 8px", /\.roll-buttons \{[^}]*margin-top: -8px/s);
cssOk("掷骰按钮 22 高", /\.roll-btn \{[^}]*height: 22px/s);
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
if (exists(path.join(ROOT, "docs", "initiative-v14.md"))) ok("docs/initiative-v14.md（先攻条实现说明）");
else bad("缺少 docs/initiative-v14.md");
if (exists(path.join(ROOT, "docs", "spec-initiative.md"))) ok("docs/spec-initiative.md 原样保留（规格不改）");
else bad("docs/spec-initiative.md 不见了");

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
if (diceCoreSrc.indexOf("export const ROLL_MAX_ROWS = 40;") >= 0) ok("dice-core.js 的 ROLL_MAX_ROWS = 40");
else bad("dice-core.js 的 ROLL_MAX_ROWS 不是 40");
if (!/\btarget\s*:/.test(diceCoreSrc) && !/\bhit\s*:/.test(diceCoreSrc))
  ok("载荷里没有 target / hit（用户拍板：不做命中判定）");
else bad("dice-core.js 里还有 target / hit 判定字段");

/* ---- 2) P3 4E 预设 ---- */
if (exists(dice4ePath) && dice4eSrc.indexOf("export function presetsFor") >= 0)
  ok("assets/dice-4e.js 导出 presetsFor（攻击 / 伤害 / 豁免 / 技能 / 先攻）");
else bad("缺少 assets/dice-4e.js / 没有 presetsFor");
if (dice4eSrc.indexOf("deriveGlance") >= 0 && dice4eSrc.indexOf("initiativeBonus") >= 0)
  ok("4E 预设复用 glance.js 的推导（不重算四防 / 攻击 / 技能）");
else bad("dice-4e.js 没有复用 glance.js");
if (!/10\s*\+\s*half/.test(dice4eSrc) && !/half\s*\+\s*mods/.test(dice4eSrc))
  ok("dice-4e.js 里没有重算公式（不含 \"10 + half\"）");
else bad("dice-4e.js 里出现了自己重算的防御 / 攻击公式");

/* ---- 3) P1 两栏 UI ---- */
const DICE_IDS = ["diceRow", "exprInput", "btnModMinus", "btnModPlus", "btnRoll", "btnLast", "btnSave",
  "btnClear", "btnAdvantage", "btnCrit", "presets", "presetMeta", "defenseRef", "combos", "comboName",
  "result", "list", "share-warn", "histMeta", "head", "pin", "bg-retry"];
const missIds = DICE_IDS.filter((id) => diceHtmlSrc.indexOf('id="' + id + '"') < 0);
if (!missIds.length) ok("dice.html 带齐两栏需要的元素 id（" + DICE_IDS.length + " 个）");
else bad("dice.html 缺少：" + missIds.join(" / "));
const missingDie = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"].filter((t) => diceHtmlSrc.indexOf('data-die="' + t + '"') < 0);
if (!missingDie.length) ok("骰子按钮 d4–d100 七颗齐全（左键 +1 / 右键 −1）");
else bad("骰子按钮缺：" + missingDie.join(" / "));
if (diceHtmlSrc.indexOf('class="dice-cols"') >= 0 && diceHtmlSrc.indexOf('class="dice-left"') >= 0 &&
  diceHtmlSrc.indexOf('class="dice-right"') >= 0)
  ok("dice.html 是两栏（左 = 组公式 / 右 = 结果 + 团队历史）");
else bad("dice.html 不是两栏布局");
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
if (coreRows === "40" && commonRows === "40") ok("房间数据 rows 上限两边都是 40（容量预算，规格 §1.6）");
else bad("ROLL_MAX_ROWS 不是 40：core=" + coreRows + " common=" + commonRows);
if (coreSrcV14.indexOf("function rollNorm(") >= 0 && coreSrcV14.indexOf("function rollMerge(") >= 0 &&
  coreSrcV14.indexOf("function rollWrite(") >= 0 && coreSrcV14.indexOf("room.setMetadata({ [KEY_ROLLS]: box })") >= 0 &&
  coreSrcV14.indexOf("broadcast.onMessage(CH_ROLL,") >= 0 && coreSrcV14.indexOf("broadcast.onMessage(CH_ROLL_CLEAR,") >= 0 &&
  coreSrcV14.indexOf('if (role !== "GM") return;') >= 0)
  ok("城主落库：归一化 → 幂等合并 → 写 rolls（40 封顶）→ 广播 saved；非城主直接返回");
else bad("后台缺少骰子落库链路（rollNorm / rollMerge / rollWrite / 订阅 / GM 校验）");
if (bundleSrc2.indexOf("function rollNorm(") >= 0 && bundleSrc2.indexOf("var ROLL_MAX_ROWS = 40;") >= 0 &&
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
if (dicePageSrc.indexOf("mergeRollRows") >= 0 && dicePageSrc.indexOf("rowsFromRaw") >= 0 &&
  dicePageSrc.indexOf("LS_DICE_LOCAL") >= 0 && dicePageSrc.indexOf("share-warn") >= 0)
  ok("历史合并去重 + 城主离线时本机暂存 + 黄条提示");
else bad("历史合并 / 本机暂存 / 黄条缺失");

/* ---- 5) 窗口加宽 + CSS ---- */
const diceWin = /dice: \{ id: ID_DICE_WIN, url: URL_DICE, width: (\d+), height: (\d+) \}/.exec(coreSrcV14);
if (diceWin && +diceWin[1] === 760 && +diceWin[2] === 620)
  ok("骰子窗口 760×620（v1.4.0 是 660×560，两栏放不下；仍会被 winSize 按视口夹紧）");
else bad("骰子窗口尺寸不是 760×620：" + (diceWin ? diceWin[1] + "×" + diceWin[2] : "WINS.dice 没找到"));
if (/\.dice-cols \{[^}]*grid-template-columns: 340px minmax\(0, 1fr\)/s.test(uiCssV14))
  ok("ui.css：两栏 340px + 自适应（.dice-cols）");
else bad("ui.css 缺少 .dice-cols 两栏栅格");
if (/\.dice-row \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/s.test(uiCssV14))
  ok("ui.css：七颗骰子一排（.dice-row repeat(7)）");
else bad("ui.css 缺少 .dice-row 七列栅格");
if (/\.expr-input \{[^}]*height: 40px/s.test(uiCssV14) && uiCssV14.indexOf(".die-chip") >= 0 &&
  uiCssV14.indexOf(".hist-row") >= 0 && uiCssV14.indexOf(".btn.toggle.on") >= 0)
  ok("ui.css：表达式 40px / 骰子 chip / 历史行 / 开关按钮样式都在");
else bad("ui.css 缺少骰子窗口的新样式");

/* ---- 6) 预设 / 组合 / 文档 / 自测 / 版本 ---- */
if (dicePageSrc.indexOf('import("./dice-4e.js")') >= 0) ok("4E 预设有绑定卡时才动态 import（不拖慢开窗）");
else bad("dice-page.js 没有动态 import dice-4e.js");
if (dicePageSrc.indexOf("LS_DICE_COMBOS") >= 0 && dicePageSrc.indexOf("function saveCombos(") >= 0)
  ok("组合保存到本机 localStorage（4enext/dice/combos）");
else bad("组合保存缺失");
if (exists(path.join(ROOT, "docs", "dice-v15.md"))) ok("docs/dice-v15.md（实现说明）");
else bad("缺少 docs/dice-v15.md");
const specDiceSrc = exists(path.join(ROOT, "docs", "spec-dice.md")) ? fs.readFileSync(path.join(ROOT, "docs", "spec-dice.md"), "utf8") : "";
if (specDiceSrc.indexOf("## 用户拍板") >= 0) ok("docs/spec-dice.md 原样保留（含「## 用户拍板」，规格不改）");
else bad("docs/spec-dice.md 不见了 / 被改了");
const selfSrc = fs.readFileSync(path.join(ROOT, "dev", "selftest.mjs"), "utf8");
if (selfSrc.indexOf("dev/test-dice.mjs") >= 0) ok("dev/selftest.mjs 加了 test-dice");
else bad("dev/selftest.mjs 没有加 dev/test-dice.mjs");
if (exists(path.join(ROOT, "dev", "test-dice.mjs"))) ok("dev/test-dice.mjs");
else bad("缺少 dev/test-dice.mjs");
const indexHtmlSrc = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (indexHtmlSrc.indexOf('<span class="tag">v1.6.0</span>') >= 0) ok("index.html 的版本标签也是 1.6.0");
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
  const specHpSrc = exists(path.join(ROOT, "docs", "spec-hpbar-boss.md"))
    ? fs.readFileSync(path.join(ROOT, "docs", "spec-hpbar-boss.md"), "utf8") : "";
  const numConst = (src, name) => {
    const m = new RegExp("var " + name + " = (\\d+(?:\\.\\d+)?);").exec(src);
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
  for (const field of ["surgesMax", "defenses", "boss", "locked"]) {
    if (trackSrcV16.indexOf(field) >= 0 && coreSrc2.indexOf(field) >= 0) ok("hp 新字段两端都有：" + field);
    else bad("hp 新字段缺失：" + field);
  }
  if (/out\.locked = raw\.locked !== false/.test(trackSrcV16) && /locked: m\.locked !== false/.test(coreSrc2)) {
    ok("locked 默认 true（玩家端锁定时隐藏数字）");
  } else bad("locked 默认值不是 true");
  if (/typeof raw === "boolean"/.test(trackSrcV16) && /typeof raw === "boolean"/.test(coreSrc2)) {
    ok("boss 布尔 / 对象两种都读（readBoss 归一化）");
  } else bad("readBoss 没有兼容布尔写法");
  if (/export function defensesFromDerived\(/.test(trackSrcV16) && trackSrcV16.indexOf('ref: "reflex"') >= 0 &&
    glanceSrc.indexOf("reflex") < 0) {
    ok("四防 ref → reflex 只在 track.js 映射一处（渲染层只认 reflex）");
  } else bad("ref → reflex 映射分叉了（渲染层不能出现 reflex 名字）");

  /* ---- 2) 几何常数（像素常数集中表） ---- */
  const geom = {
    BAR_HP_H: 20, BAR_SURGE_H: 12, BAR_GAP: 3, SHIELD_DIAMETER: 30,
    BOSS_RING_THICK: 10, BOSS_RING_INSET: 2, BOSS_RING_SEGMENTS: 48,
    BOSS_PLATE_H: 26, BOSS_PLATE_GAP: 6
  };
  const geomBad = Object.keys(geom).filter((k) => numConst(coreSrc2, k) !== geom[k]);
  if (!geomBad.length) {
    ok("像素常数：HP 20 / 回复力 12 / 间距 3 / 盾 30 / 环厚 10 / 环内缩 2 / 48 段 / 名牌 26 / 距顶 6");
  } else bad("像素常数不对：" + geomBad.map((k) => k + "=" + numConst(coreSrc2, k)).join(" "));
  if (/var PLAYER_THRESHOLD_DEFAULT = 25;/.test(coreSrc2) && /function quantiseRatio\(/.test(coreSrc2)) {
    ok("玩家端 quantiseRatio + 阈值 25");
  } else bad("缺少 quantiseRatio / PLAYER_THRESHOLD_DEFAULT");
  if (/"shield": 15000/.test(coreSrc2) && /"bar-fill": 20000/.test(coreSrc2) &&
    /"bar-text": 30000/.test(coreSrc2) && /"ring-bg": 9500/.test(coreSrc2) &&
    /"lock-body": 31000/.test(coreSrc2)) {
    ok("zIndex：盾 15000 / 填充 20000 / 数值 30000 / 环 9500 / 锁 31000（固定 + disableAutoZIndex）");
  } else bad("zIndex 表不对（盾 / 填充 / 数值 / 环 / 锁）");

  /* ---- 3) 形状全部用 Curve 手绘（SDK 没有 RING / 盾牌） ---- */
  if (/function ringSectorPoints\(/.test(coreSrc2) && /function shieldPoints\(/.test(coreSrc2) &&
    /ringSectorPoints\(B\.Ro, B\.Ri/.test(coreSrc2) && /shieldPoints\(sh\.d, sh\.d\)/.test(coreSrc2)) {
    ok("环形扇区 / 盾形多边形 / 锁 / 名牌都用 buildCurve().points() 手绘");
  } else bad("环形 / 盾形没有用 Curve 手绘");
  if (coreSrc2.indexOf("buildShape(") < 0) ok("没有用 buildShape（SDK 3.1.0 只有四种形状，做不出环 / 盾）");
  else bad("血条里调用了 buildShape（做不出环 / 盾，规格 §5.4）");

  /* ---- 4) 布局：两行条 + 四角 + Boss 压制 ---- */
  if (/var surgeTop = bounds\.max\.y - pad - hSurge;/.test(coreSrc2) &&
    /var hpTop = showSurge \? surgeTop - gap - hHp : bounds\.max\.y - pad - hHp;/.test(coreSrc2)) {
    ok("布局：蓝条贴底边内侧、红条在蓝条上方 gap（没有回复力时红条仍贴底，老 token 位置不变）");
  } else bad("两行条的布局公式不对");
  if (/var spots = \[\[xL, yT\], \[xR, yT\], \[xL, yB\], \[xR, yB\]\];/.test(coreSrc2) &&
    /bounds\.width >= 2 \* d \+ 4 \* inset && yB > yT/.test(coreSrc2)) {
    ok("四防四角：AC/强韧 在上、反射/意志 在下，窄 / 矮 token 退化不画");
  } else bad("四防四角的位置或退化规则不对");
  if (/hpVisible: !bossOn/.test(coreSrc2) && /d\.visible = L\.hpVisible/.test(coreSrc2)) {
    ok("Boss 模式压制普通 HP 条（bg / fill / text 隐藏，回复力条与四防保留）");
  } else bad("Boss 模式没有压制普通 HP 条");
  if (/BAR_ROLE|"ring-bg"/.test(coreSrc2) && /"plate-phase"/.test(coreSrc2) &&
    /"lock-shackle"/.test(coreSrc2) && /"divider"/.test(coreSrc2)) {
    ok("role 表齐全：环 / 条 / 牌 / 盾 / 分段 / 锁");
  } else bad("role 表不齐（环 / 牌 / 盾 / 分段 / 锁）");

  /* ---- 5) 右键两项 + Boss 两项 ---- */
  const menuIds = ["/hpbar-add", "/hpbar-remove", "/boss-show", "/boss-hide"];
  const missingMenu = menuIds.filter((id) => coreSrc2.indexOf('id: NS + "' + id + '"') < 0);
  if (!missingMenu.length) ok("右键菜单 4 项独立注册（hpbar-add / hpbar-remove / boss-show / boss-hide）");
  else bad("右键菜单缺项：" + missingMenu.join(" / "));
  for (const label of ["添加血条组件", "移除血条组件", "显示为 Boss", "隐藏 Boss 血条"]) {
    if (coreSrc2.indexOf(label) >= 0) ok("右键文案：" + label);
    else bad("右键文案缺失：" + label);
  }
  if (/operator: "!=", value: true/.test(coreSrc2)) ok("菜单 filter 用 operator:\"!=\"（同时覆盖 undefined 与 false）");
  else bad("菜单 filter 没有用 operator:\"!=\"");
  if (/d\.metadata\[KEY_HPBAR\] = !!on;/.test(coreSrc2) && coreSrc2.indexOf("delete d.metadata[KEY_HPBAR]") < 0) {
    ok("「移除血条组件」写 false，不 delete（否则下次刷新会自动加回来）");
  } else bad("移除血条组件没有写 false / 还在 delete");
  if (/function writeBossFlag\(/.test(coreSrc2) && /order: conf\.order \|\| \(on \? Date\.now\(\) : 0\)/.test(coreSrc2)) {
    ok("「显示为 Boss」写 hp.boss 对象，首次开启用时间戳当 order");
  } else bad("Boss 开关的写法不对（order / 对象）");

  /* ---- 6) 速览联动：四防一排 / 蓝条 / 锁 / Boss ---- */
  if (glanceSrc.indexOf("gl4-def-row") >= 0 && glanceSrc.indexOf('data-act="defense"') >= 0 &&
    glanceSrc.indexOf('data-act="lock"') >= 0 && glanceSrc.indexOf('data-act="boss"') >= 0) {
    ok("速览弹窗：四防一排 + 锁 + Boss 开关（与右键写同一个 hp 字段）");
  } else bad("速览弹窗缺少四防 / 锁 / Boss 联动");
  if (glanceSrc.indexOf("gl4-surgebar") >= 0 && glanceSrc.indexOf("surgesMax") >= 0) {
    ok("速览弹窗：回复力蓝条 + 分母优先用 token 的 surgesMax");
  } else bad("速览弹窗缺少回复力蓝条 / surgesMax");
  if (/\.gl4-surgebar \{[^}]*height: 6px/s.test(cssSrc) && cssSrc.indexOf(".gl4-def-chip") >= 0 &&
    cssSrc.indexOf(".gl4-boss-row") >= 0) {
    ok("glance.css：蓝条 6px + 盾形四防 chip + 锁 / Boss 一排");
  } else bad("glance.css 缺少 v1.6.0 的样式");
  if (trackSrcV16.indexOf('act === "defense" || act === "lock" || act === "boss"') >= 0 &&
    trackSrcV16.indexOf("export async function syncTokenStats(") >= 0 &&
    infoSrcV16.indexOf("syncTokenStats(") >= 0) {
    ok("track.js 新增 defense / lock / boss 三个 act + syncTokenStats（速览刷新时补写四防 / 分母）");
  } else bad("track.js 缺少 defense / lock / boss 或 syncTokenStats");
  if (/surgesMax: derived\.surgesMax \|\| derived\.surges/.test(infoSrcV16) && /defenses: derived\.defenses/.test(infoSrcV16)) {
    ok("info.js 把 surgesMax / defenses 传进 applyAction");
  } else bad("info.js 没有把新字段传进 applyAction");

  /* ---- 7) 文档 / 规格 / 版本 / bundle ---- */
  if (exists(path.join(ROOT, "docs", "hpbar-boss-v16.md"))) {
    const docV16 = fs.readFileSync(path.join(ROOT, "docs", "hpbar-boss-v16.md"), "utf8");
    if (docV16.indexOf("像素常数集中表") >= 0 && docV16.indexOf("barLayout") >= 0 &&
      docV16.indexOf("方案 A") >= 0) ok("docs/hpbar-boss-v16.md：实现说明 + 像素常数集中表");
    else bad("docs/hpbar-boss-v16.md 缺少像素常数集中表 / 方案 A 说明");
  } else bad("缺少 docs/hpbar-boss-v16.md");
  if (specHpSrc.indexOf("### 方案 A（推荐") >= 0 && specHpSrc.indexOf("P3 交付") >= 0) {
    ok("docs/spec-hpbar-boss.md 原样保留（方案 A / P3 交付，规格不改）");
  } else bad("docs/spec-hpbar-boss.md 被改了 / 不见了");
  if (readmeSrc.indexOf("血条扩展") >= 0 && readmeSrc.indexOf("临时生命") >= 0 &&
    readmeSrc.indexOf("四防") >= 0 && readmeSrc.indexOf("Boss") >= 0) {
    ok("README 功能表写了血条扩展（临时生命 / 四防 / 蓝条）+ Boss 样式");
  } else bad("README 功能表没有 v1.6.0 的血条 / Boss");
  if (verOf(commonSrc) === "1.6.0" && verOf(coreSrc2) === "1.6.0") ok("PLUGIN_VERSION = 1.6.0");
  else bad("PLUGIN_VERSION 不是 1.6.0：" + verOf(commonSrc) + " / " + verOf(coreSrc2));
  if (bundleSrc2.indexOf("ringSectorPoints(") >= 0 && bundleSrc2.indexOf("shieldPoints(") >= 0 &&
    bundleSrc2.indexOf("KEY_HPBAR") >= 0) {
    ok("bundle 里带 v1.6.0 的环 / 盾 / 血条开关（已重新构建）");
  } else bad("bundle 落后于 core（跑 node dev/build-background.mjs）");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);