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
for (const f of ["assets/common.js", "assets/glance.js", "assets/track.js", "assets/initiative.js", "assets/info.js", "assets/panel.js", "assets/bind.js", "assets/button.js", "assets/index.js"]) {
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
for (const p of ["manifest.json", "manifest.relative.json", "background.html", "panel.html", "info.html", "bind.html", "button.html", "index.html", "icon.svg", "icon-tool.svg", "README.md", "assets/glance.js", "assets/glance.css", "assets/track.js", "assets/background.core.js", "assets/background.bundle.js", "data/rules.js", "vendor/obr-sdk.js", "samples/sample-card.json", "docs/owlbear-debug.md", "docs/hp-bar-and-tracking.md", "docs/ui-tweaks-v121.md", "docs/popover-drag.md", "docs/initiative-v13.md"]) {
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

console.log("== v1.3.0 改名 / 三 tab / 先攻");
const manRel = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.relative.json"), "utf8"));
if (man.name === "4eNEXT to owlbear") ok("manifest.name = 4eNEXT to owlbear");
else bad("manifest.name 不是 4eNEXT to owlbear：" + man.name);
if (manRel.name === man.name) ok("manifest.relative.json 名字一致");
else bad("manifest.relative.json 名字不一致：" + manRel.name);
if (man.version === "1.3.0" && manRel.version === man.version) ok("版本 1.3.0（绝对 + 相对 manifest）");
else bad("版本不是 1.3.0：" + man.version + " / " + manRel.version);
const panelHtmlV13 = fs.readFileSync(path.join(ROOT, "panel.html"), "utf8");
for (const [tab, label] of [["glance", "速览"], ["init", "先攻"], ["dice", "骰子"]]) {
  if (panelHtmlV13.indexOf('data-tab="' + tab + '"') >= 0 && panelHtmlV13.indexOf(">" + label + "</button>") >= 0)
    ok("面板有「" + label + "」tab（data-tab=" + tab + "）");
  else bad("面板缺少「" + label + "」tab（data-tab=" + tab + "）");
}
if (panelHtmlV13.indexOf('id="tab-glance"') >= 0 && panelHtmlV13.indexOf('id="tab-init"') >= 0 && panelHtmlV13.indexOf('id="tab-dice"') >= 0)
  ok("三个 tab-pane 都在同一个 panel.html 里");
else bad("panel.html 缺少 tab-pane（三 tab 必须单面板）");
if (panelHtmlV13.indexOf("骰子（即将推出）") >= 0) ok("骰子 tab 写明「即将推出」（v1.3.0 占位）");
else bad("骰子 tab 没有占位文案");
const panelSrcV13 = fs.readFileSync(path.join(ROOT, "assets", "panel.js"), "utf8");
if (/function setTab\(/.test(panelSrcV13) && /classList\.toggle\("on"/.test(panelSrcV13) && /style\.display/.test(panelSrcV13))
  ok("tab 切换只切 class / display（不重载页面）");
else bad("panel.js 没有只切 display 的 tab 切换");
if (/\.tab-pane\.on \{ display: flex; \}/.test(uiCss) || /\.tab-pane\.on \{ display: flex; \}/.test(cssSrc)) ok("ui.css 有 .tab-pane.on 显示规则");
else bad("ui.css 缺少 .tab-pane.on 显示规则");
if (/setTab\(initialTab\(\), false\)/.test(panelSrcV13) && /URLSearchParams\(location\.search\)\.get\("tab"\)/.test(panelSrcV13))
  ok("panel.js 支持 ?tab=init（左上角 action 直接打开先攻）");
else bad("panel.js 不支持从 URL 指定 tab");
if (man.action && /\?tab=init$/.test(String(man.action.popover))) ok("manifest.action.popover 带 ?tab=init");
else bad("manifest.action.popover 没有带 ?tab=init（左上角入口不会定位到先攻）");
if (manRel.action && /\?tab=init$/.test(String(manRel.action.popover))) ok("相对 manifest 的 action.popover 也带 ?tab=init");
else bad("manifest.relative.json 的 action.popover 没有带 ?tab=init");

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
}
const initKeys = (srcText, re) => (re.exec(srcText) || [])[1] || "";
const coreInit = initKeys(coreSrc2, /var KEY_INIT = NS \+ "([^"]+)";/);
const commonInit = initKeys(commonSrc, /export const KEY_INIT = NS \+ "([^"]+)";/);
if (coreInit && coreInit === commonInit) ok("token 先攻键一致：" + coreInit);
else bad("token 先攻键不一致：core=" + coreInit + " common=" + commonInit);
const coreInitRoom = initKeys(coreSrc2, /var KEY_INITIATIVE = NS \+ "([^"]+)";/);
const commonInitRoom = initKeys(commonSrc, /export const KEY_INITIATIVE = NS \+ "([^"]+)";/);
if (coreInitRoom && coreInitRoom === commonInitRoom) ok("房间先攻键一致：" + coreInitRoom);
else bad("房间先攻键不一致：core=" + coreInitRoom + " common=" + commonInitRoom);
const coreReq = initKeys(coreSrc2, /var CH_INIT_REQUEST = NS \+ "([^"]+)";/);
const commonReq = initKeys(commonSrc, /export const CH_INIT_REQUEST = NS \+ "([^"]+)";/);
if (coreReq && coreReq === commonReq) ok("结束回合请求频道一致：" + coreReq);
else bad("结束回合请求频道不一致：core=" + coreReq + " common=" + commonReq);
if (/label: "加入先攻"/.test(coreSrc2) && /label: "隐形加入先攻"/.test(coreSrc2)) ok("右键菜单有「加入先攻」「隐形加入先攻」两项");
else bad("右键菜单缺少「加入先攻」/「隐形加入先攻」");
if (/function onInitRequest\(/.test(coreSrc2) && /broadcast\.onMessage\(CH_INIT_REQUEST/.test(coreSrc2))
  ok("后台订阅并处理玩家「结束我的回合」请求");
else bad("后台没有处理玩家结束回合请求");
if (/function onInitMenuClick\(/.test(coreSrc2) && /room\.setMetadata\(\{ \[KEY_INITIATIVE\]: next \}\)/.test(coreSrc2))
  ok("右键加入先攻会写房间数据");
else bad("右键加入先攻没有写房间数据");
if (/function bindToken\(/.test(commonSrc) && /metadata\[KEY_INIT\]/.test(commonSrc) && /initiativeBonus\(/.test(commonSrc))
  ok("绑定角色卡时写入 init 元数据（先攻加值取卡里的先攻）");
else bad("bindToken 没有写入 init 元数据 / 没有复用 initiativeBonus");
if (/renderInitiativeHTML/.test(panelSrcV13) && /readInitiative/.test(panelSrcV13) && /writeInitiative/.test(panelSrcV13))
  ok("面板接入了先攻读写与渲染");
else bad("面板没有接入先攻模块");
if (exists(path.join(ROOT, "docs", "initiative-v13.md"))) ok("docs/initiative-v13.md");
else bad("缺少 docs/initiative-v13.md");
if (exists(path.join(ROOT, "dev", "test-initiative.mjs"))) ok("dev/test-initiative.mjs");
else bad("缺少 dev/test-initiative.mjs");

const bgHtml = fs.readFileSync(path.join(ROOT, "background.html"), "utf8");
if (/<script[^>]*type="module"/.test(bgHtml)) bad('background.html 里还有 <script type="module">');
else ok("background.html 没有 type=module，只加载一个脚本");
if (bgHtml.indexOf("background.bundle.js") >= 0) ok("background.html 引用了 background.bundle.js");
else bad("background.html 没有引用 background.bundle.js");

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);