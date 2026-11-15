// v1.7.13：速览弹窗（info.html / info.js）的**假 DOM 点击冒烟**。
// 目的：真机上「威能 / 装备 chip 点不动」时，先在无浏览器环境里证明 / 证伪「页面接线」这一层：
//   · 跑的是**真的** assets/info.js + track.js + glance.js（不是复制一份逻辑）；
//   · 用假的 document / window / OBR 加载页面，等 onReady 首帧渲染完成；
//   · 从渲染出来的 HTML 里取出真实存在的 [data-act] 元素，dispatchEvent(new MouseEvent("click"))；
//   · 断言 track.js 的 applyAction 真的被调用：房间数据里出现 powerUsed / equipmentUsed 的 key，
//     并且重画后的 HTML 里 chip 变成 .used / aria-pressed="true"（再点一次恢复）。
// 另外顺手断言：四组威能 + 每行装备都是可点元素、「共享数据」也走同一套委托。
// 断言目标（静态自检会查这两串）：data-act="power" / data-act="equipment"。
//
// 用法：node dev/test-info-click.mjs            （无浏览器 / 无 OBR）
//       dev/check.mjs 会 spawn 本文件，所以 selftest 仍是 5 条命令，但点击冒烟不会漏。
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------------------
 * 1) 把页面模块拷到临时目录：assets/*.js 没有 package.json，node 会按 CJS 解析；
 *    ../vendor/obr-sdk.js 换成读 globalThis.__OBR__ 的桩（真 SDK 依赖浏览器环境）。
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-info-click-test");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.mkdirSync(path.join(tmp, "vendor"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
fs.copyFileSync(path.join(ROOT, "data", "rules.js"), path.join(tmp, "data", "rules.js"));
fs.writeFileSync(path.join(tmp, "vendor", "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
for (const name of ["common.js", "window.js", "track.js", "glance.js", "info.js"]) {
  let src = fs.readFileSync(path.join(ROOT, "assets", name), "utf8");
  src = src.replace('from "../vendor/obr-sdk.js"', 'from "../vendor/obr-stub.mjs"');
  fs.writeFileSync(path.join(tmp, "assets", name), src, "utf8");
}

/* ---------------------------------------------------------------------------
 * 2) 极简假 DOM：只实现 info.js / window.js 用到的那一小撮 API。
 *    元素上的 dispatchEvent 会按「document 捕获 → body 冒泡 → document 冒泡」调用监听器，
 *    和浏览器的 click 派发顺序一致 —— 这样连事件委托挂在哪一层都能测出来。
 * ------------------------------------------------------------------------- */
function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    toggle: (c, on) => {
      if (on === undefined) { if (set.has(c)) set.delete(c); else set.add(c); }
      else if (on) set.add(c);
      else set.delete(c);
    },
    contains: (c) => set.has(c)
  };
}

class MouseEvent {
  constructor(type, init) {
    this.type = type;
    this.bubbles = !!(init && init.bubbles);
    this.cancelable = !!(init && init.cancelable);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
  stopImmediatePropagation() {}
}
globalThis.MouseEvent = MouseEvent;

const docListeners = [];   // { type, fn, capture }
function addDoc(type, fn, capture) {
  if (typeof fn !== "function") return;
  docListeners.push({ type: type, fn: fn, capture: !!capture });
}
function fire(target, ev) {
  ev.target = target;
  const pick = (type, capture) => docListeners.filter((l) => l.type === type && l.capture === capture).map((l) => l.fn);
  /* 捕获阶段（document → 目标） */
  for (const fn of pick(ev.type, true)) { ev.currentTarget = document; fn(ev); }
  /* 目标 + 冒泡：从最近的容器往上（这里只模拟 body → document） */
  let t = target;
  while (t) {
    const ls = ((t.__listeners || {})[ev.type] || []);
    for (const fn of ls) { ev.currentTarget = t; fn(ev); }
    if (t === document.body) break;
    t.__parent = t.__parent || null;
    t = t.__parent;
  }
  for (const fn of pick(ev.type, false)) { ev.currentTarget = document; fn(ev); }
}

function makeEl(id, tagName) {
  const el = {
    id: id || "",
    tagName: (tagName || "DIV").toUpperCase(),
    className: "",
    textContent: "",
    title: "",
    hidden: false,
    disabled: false,
    value: "",
    dataset: {},
    classList: makeClassList(),
    __listeners: {},
    __attrs: {},
    __html: "",
    __parent: null,
    addEventListener(type, fn) {
      (el.__listeners[type] = el.__listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    setAttribute(k, v) { el.__attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.__attrs, k) ? el.__attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(el.__attrs, k); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    insertAdjacentHTML() {},
    appendChild() {},
    closest() { return null; },
    dispatchEvent(ev) { fire(el, ev); return !ev.defaultPrevented; },
    hasPointerCapture() { return false; },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return el.__html; },
    set(v) { el.__html = String(v); }
  });
  return el;
}

const bodyEl = makeEl("body", "DIV");
const ids = ["head", "pin", "panel", "close", "title-text", "scope"];
const domMap = { body: bodyEl };
for (const id of ids) domMap[id] = makeEl(id, id === "close" || id === "panel" || id === "pin" ? "BUTTON" : "DIV");

const document = {
  body: bodyEl,
  getElementById: (id) => domMap[id] || makeEl(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => makeEl("", tag),
  addEventListener: addDoc
};
globalThis.document = document;
const winListeners = {};
globalThis.window = {
  addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
  removeEventListener() {}
};
globalThis.location = { href: "https://example.test/info.html?item=tok-1&card=c-test", search: "?item=tok-1&card=c-test" };
const lsStore = {};
globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; }
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

/* ---------------------------------------------------------------------------
 * 3) 假 OBR：房间里有 1 张示例卡；token 已绑定这张卡；城主身份（写得进房间数据）。
 * ------------------------------------------------------------------------- */
const save = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-card.json"), "utf8"));
const char = save.pages.character;
const CARD_ID = "c-test";
const TOKEN_ID = "tok-1";
const NS = "com.4enext-owlbear";
const roomMeta = {
  [NS + "/cards"]: { v: 1, updatedAt: 1, cards: [{ id: CARD_ID, name: char.name, level: char.level, char: char }] }
};
const token = {
  id: TOKEN_ID,
  type: "IMAGE",
  name: char.name,
  createdUserId: "user-gm",
  metadata: {
    [NS + "/cardId"]: CARD_ID,
    [NS + "/hp"]: { cur: 171, max: 171, temp: 0, surges: 8, surgesMax: 8, locked: true, updatedAt: 1 }
  }
};
const readyCbs = [];
const metaChangeCbs = [];
const notes = [];
let setMetadataCalls = 0;
const fakeOBR = {
  isAvailable: true,
  isReady: true,
  onReady(cb) { readyCbs.push(cb); },
  notification: { show(msg, variant) { notes.push({ msg, variant }); return Promise.resolve("n"); }, close() {} },
  player: {
    getId: async () => "user-gm",
    getName: async () => "城主",
    getColor: async () => "#fff",
    getRole: async () => "GM",
    getSelection: async () => [TOKEN_ID],
    onChange() { return () => {}; }
  },
  party: {},
  scene: {
    isReady: async () => true,
    onReadyChange() { return () => {}; },
    items: {
      getItems: async (ids) => (ids && ids.indexOf(TOKEN_ID) >= 0 ? [token] : []),
      updateItems: async (ids, fn) => {
        if (typeof fn === "function") fn([token]);
      },
      onChange() { return () => {}; }
    },
    grid: { getDpi: async () => 150, onChange() { return () => {}; } },
    local: { addItems: async () => {}, updateItems: async () => {}, deleteItems: async () => {}, onChange() { return () => {}; } }
  },
  room: {
    getMetadata: async () => roomMeta,
    setMetadata: async (patch) => {
      setMetadataCalls++;
      for (const k of Object.keys(patch || {})) roomMeta[k] = patch[k];
      /* 和真 OBR 一样：写完立刻通知本页（info.js 会节流 120ms 再 refresh 一次）。 */
      for (const cb of metaChangeCbs.slice()) { try { cb(); } catch (e) { /* 忽略 */ } }
    },
    onMetadataChange(cb) { metaChangeCbs.push(cb); return () => {}; }
  },
  broadcast: {
    sendMessage: async () => {},
    onMessage() { return () => {}; }
  },
  popover: { open: async () => {}, close: async () => {}, getWidth: async () => 660, getHeight: async () => 700 },
  modal: { open: async () => {}, close: async () => {}, getId: () => "m" },
  viewport: { getWidth: async () => 1200, getHeight: async () => 800, onChange() { return () => {}; } },
  tool: { create: async () => {}, remove: async () => {} },
  action: { open: async () => {}, close: async () => {} }
};
globalThis.__OBR__ = fakeOBR;

/* ---------------------------------------------------------------------------
 * 4) 加载真 info.js，触发 onReady → 首帧刷新（异步）。
 * ------------------------------------------------------------------------- */
let loadErr = null;
try {
  await import(pathToFileURL(path.join(tmp, "assets", "info.js")).href);
} catch (e) {
  loadErr = e;
}
if (loadErr) bad("info.js 在假 DOM 下加载失败：" + (loadErr && loadErr.message ? loadErr.message : loadErr));
else ok("info.js 能在假 DOM + 假 OBR 下加载（事件委托至少已经绑上）");

for (const cb of readyCbs.slice()) {
  try { cb(); } catch (e) { bad("onReady 回调抛错：" + (e && e.message ? e.message : e)); }
}
await sleep(260);   // refresh 里有一串 await；等它把首帧 body.innerHTML 写完

const html = () => bodyEl.innerHTML;
if (!html() || html().indexOf('class="gl4 ') < 0) bad("首帧没有渲染出速览内容（body.innerHTML 为空 / 没有 .gl4）");
else ok("首帧渲染完成（" + html().length + " 字符，角色：" + char.name + "）");

/* ---------------------------------------------------------------------------
 * 5) 从渲染出的 HTML 里造出「真的会被点到的元素」：属性照抄，closest 能命中 [data-act]。
 * ------------------------------------------------------------------------- */
function attrsOf(tagText) {
  const out = {};
  const re = /([a-zA-Z0-9-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tagText))) out[m[1]] = m[2];
  return out;
}
function actElements(sourceHtml, act) {
  const out = [];
  const re = /<button\b[^>]*>/g;
  let m;
  while ((m = re.exec(sourceHtml))) {
    const tag = m[0];
    const a = attrsOf(tag);
    if (a["data-act"] !== act) continue;
    const el = makeEl("", "BUTTON");
    el.__attrs = a;
    el.dataset = {};
    for (const k of Object.keys(a)) {
      if (k.indexOf("data-") === 0) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        el.dataset[camel] = a[k];
      }
    }
    el.classList = makeClassList();
    for (const c of String(a["class"] || "").split(/\s+/).filter(Boolean)) el.classList.add(c);
    el.__parent = bodyEl;
    el.closest = (sel) => (sel === "[data-act]" ? el : (sel && sel.indexOf("button") >= 0 ? el : null));
    out.push(el);
  }
  return out;
}
function firstAct(act) {
  const list = actElements(html(), act);
  return list.length ? list[0] : null;
}
function click(el) {
  return el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

/* ---- 5a) 四组威能 + 装备 + 共享数据都在渲染结果里 ---- */
const powerChips = actElements(html(), "power");
if (powerChips.length >= 4) ok("渲染出的威能 chip 全部是 [data-act=power] 按钮：" + powerChips.length + " 个（遭遇 / 每日 / 辅助 / 种族职业）");
else bad("威能 chip 不是可点按钮：只有 " + powerChips.length + " 个 data-act=power");

const itemChips = actElements(html(), "equipment");
if (itemChips.length >= 8) ok("渲染出的装备行全部是 [data-act=equipment] 按钮：" + itemChips.length + " 行（含「已用 0 / N」计数）");
else bad("装备行不是可点按钮：只有 " + itemChips.length + " 个 data-act=equipment");
if (html().indexOf("共享数据") >= 0 && actElements(html(), "lock").length === 1) ok("「共享数据」chip 也在同一套 [data-act] 委托里");
else bad("「共享数据」chip 没渲染成 data-act=lock");

/* ---- 5b) 点威能：track.js 真的写房间数据 + 重画成 .used ---- */
const chip = firstAct("power");
const powerKey = chip && (chip.dataset.k || chip.getAttribute("data-k"));
if (!chip || !powerKey) bad("拿不到第一个威能 chip 的 data-k");
else {
  const before = setMetadataCalls;
  click(chip);
  await sleep(40);
  const st = roomMeta[NS + "/state/" + CARD_ID];
  if (setMetadataCalls === before) bad("点威能 chip 没有调用 OBR.room.setMetadata（track.js 没被调用）");
  else if (!st || !st.powerUsed || !st.powerUsed[powerKey]) bad("点威能 chip 没有把 " + powerKey + " 写进 powerUsed：" + JSON.stringify(st && st.powerUsed));
  else ok("dispatchEvent(click) → track.js applyAction 真的写入 powerUsed[" + powerKey + "]（房间数据）");
  await sleep(60);
  const usedEls = actElements(html(), "power").filter((x) => x.classList.contains("used"));
  if (usedEls.length === 1 && usedEls[0].getAttribute("data-k") === powerKey &&
    usedEls[0].getAttribute("aria-pressed") === "true") ok("重画后该 chip 变成 .used + aria-pressed=true（用户看得到反馈）");
  else bad("重画后 chip 没有变成已用（used=" + usedEls.length + "）");
}

/* ---- 5c) 再点一次：恢复 ---- */
const usedChip = actElements(html(), "power").filter((x) => x.classList.contains("used"))[0];
if (usedChip) {
  click(usedChip);
  await sleep(80);
  const st = roomMeta[NS + "/state/" + CARD_ID];
  if (st && st.powerUsed && st.powerUsed[powerKey]) bad("再点一次没有恢复 powerUsed[" + powerKey + "]");
  else ok("再点一次 → powerUsed 里的 key 被删掉（已用 / 恢复可逆）");
} else bad("找不到「已用」状态的 chip，无法测恢复");

/* ---- 5d) 装备行同样可点 ---- */
const itemChip = firstAct("equipment");
const itemKey = itemChip && (itemChip.dataset.k || itemChip.getAttribute("data-k"));
if (!itemChip || !itemKey) bad("拿不到第一行装备的 data-k");
else {
  click(itemChip);
  await sleep(80);
  const st = roomMeta[NS + "/state/" + CARD_ID];
  if (!st || !st.equipmentUsed || !st.equipmentUsed[itemKey]) bad("点装备行没有写入 equipmentUsed[" + itemKey + "]");
  else ok("dispatchEvent(click) → equipmentUsed[" + itemKey + "] 写入（装备行也能点）");
  await sleep(40);
  const usedItems = actElements(html(), "equipment").filter((x) => x.classList.contains("used"));
  if (usedItems.length === 1) ok("装备行重画成 .used，标题计数变成「已用 1 / " + actElements(html(), "equipment").length + "」");
  else bad("装备行重画后 used 数量不对：" + usedItems.length);
}

/* ---- 5e) 错误路径不能静默 ---- */
const errNotes = notes.filter((n) => n.variant === "ERROR" || n.variant === "WARNING");
if (!errNotes.length) ok("正常点击全程没有 ERROR / WARNING（v1.7.8：成功类提示不打扰）");
else bad("正常点击弹出了错误提示：" + JSON.stringify(errNotes));

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
