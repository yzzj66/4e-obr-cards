// 先攻 v1.3.0 自测（无浏览器）：用假 OBR 跑真实模块。
// 覆盖：绑定写 init 元数据 / 右键两项注册 / 加入先攻写房间数据 /
//       GM 推进与玩家结束回合权限分支 / 隐形条目对非 GM 不可见。
// 用法：node dev/test-initiative.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deep = (v) => JSON.parse(JSON.stringify(v));

/* ---------------------------------------------------------------------------
 * 假 OBR
 * ------------------------------------------------------------------------- */
const NS = "com.4enext-owlbear";
const KEY_BIND = NS + "/cardId";
const KEY_INIT = NS + "/init";
const KEY_INITIATIVE = NS + "/initiative";
const CH_INIT_REQUEST = NS + "/init-request";

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-card.json"), "utf8"));
const CHAR = sample.pages && sample.pages.character ? sample.pages.character : sample.character;
const CARD = { id: "c-1", name: CHAR.name || "示例角色", level: CHAR.level || 1, char: CHAR };
const TOKEN = {
  id: "tok-1", type: "IMAGE", name: CHAR.name || "示例角色",
  createdUserId: "user-player", metadata: {}, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }
};
const TOKEN2 = {
  id: "tok-2", type: "IMAGE", name: "地精",
  createdUserId: "user-gm", metadata: {}, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }
};
let items = [TOKEN, TOKEN2];
let roomMeta = { [NS + "/cards"]: { v: 1, cards: [deep(CARD)] } };
let role = "GM";
let playerId = "user-gm";
let readyCb = null;
const notifications = [];
const createdMenus = [];
const broadcastCbs = {};
const sentBroadcasts = [];

function itemById(id) { return items.filter((it) => it.id === id)[0] || null; }
function mergeRoom(update) {
  for (const k of Object.keys(update)) roomMeta[k] = deep(update[k]);
}

const OBR = {
  isAvailable: true,
  isReady: true,
  onReady(cb) { readyCb = cb; },
  notification: {
    show(msg, variant) { notifications.push({ msg, variant }); return Promise.resolve("id"); },
    close() {}
  },
  viewport: {
    getWidth: async () => 1200,
    getHeight: async () => 800,
    getScale: async () => 1,
    transformPoint: async (p) => p,
    onChange() { return () => {}; }
  },
  player: {
    getSelection: async () => [],
    getRole: async () => role,
    getId: async () => playerId,
    onChange() { return () => {}; }
  },
  party: {},
  scene: {
    isReady: async () => true,
    onReadyChange() { return () => {}; },
    onMetadataChange() { return () => {}; },
    getMetadata: async () => ({}),
    grid: { getDpi: async () => 150, onChange() { return () => {}; } },
    items: {
      getItems: async (ids) => (Array.isArray(ids) ? ids.map(itemById).filter(Boolean) : items.slice()),
      getItemBounds: async () => ({ min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 }),
      updateItems: async (ids, fn) => {
        const drafts = ids.map(itemById).filter(Boolean).map(deep);
        fn(drafts);
        for (const d of drafts) {
          const idx = items.findIndex((it) => it.id === d.id);
          if (idx >= 0) items[idx] = d;
        }
        return Promise.resolve();
      },
      onChange() { return () => {}; }
    },
    local: {
      getItems: async () => [],
      addItems: async () => {},
      updateItems: async () => {},
      deleteItems: async () => {},
      onChange() { return () => {}; }
    }
  },
  contextMenu: {
    create(cfg) { createdMenus.push(cfg); return Promise.resolve(); },
    remove() { return Promise.resolve(); }
  },
  tool: { create: async () => {}, remove: async () => {} },
  popover: { open: async () => {}, close: async () => {} },
  modal: { open: async () => {}, close: async () => {} },
  action: { open: async () => {}, close: async () => {} },
  room: {
    id: "room-1",
    getMetadata: async () => roomMeta,
    setMetadata: async (update) => { mergeRoom(update); return Promise.resolve(); },
    onMetadataChange() { return () => {}; }
  },
  broadcast: {
    sendMessage(channel, data, opts) { sentBroadcasts.push({ channel, data, opts }); return Promise.resolve(); },
    onMessage(channel, cb) {
      (broadcastCbs[channel] = broadcastCbs[channel] || []).push(cb);
      return () => {};
    }
  }
};

/* 浏览器替身（background.core.js 要用） */
const fakeEl = () => ({ className: "", textContent: "", innerHTML: "", appendChild() {}, addEventListener() {} });
globalThis.location = { href: "https://example.test/background.html", protocol: "https:" };
globalThis.document = {
  title: "",
  getElementById: () => fakeEl(),
  createElement: () => fakeEl(),
  head: { appendChild() {} },
  documentElement: { appendChild() {} }
};
globalThis.window = { addEventListener() {} };
const lsStore = {};
globalThis.localStorage = {
  getItem: (k) => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; }
};
globalThis.__OBR__ = OBR;

/* ---------------------------------------------------------------------------
 * 把 ESM 模块复制到临时目录，换成 .mjs 可加载的桩
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-initiative-test");
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.mkdirSync(path.join(tmp, "vendor"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
fs.writeFileSync(path.join(tmp, "vendor", "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
fs.copyFileSync(path.join(ROOT, "data", "rules.js"), path.join(tmp, "data", "rules.js"));
for (const f of ["common.js", "glance.js", "initiative.js"]) {
  let src = fs.readFileSync(path.join(ROOT, "assets", f), "utf8");
  src = src.replace('from "../vendor/obr-sdk.js"', 'from "../vendor/obr-stub.mjs"');
  fs.writeFileSync(path.join(tmp, "assets", f), src, "utf8");
}

const C = await import(pathToFileURL(path.join(tmp, "assets", "common.js")).href);
const G = await import(pathToFileURL(path.join(tmp, "assets", "glance.js")).href);
const I = await import(pathToFileURL(path.join(tmp, "assets", "initiative.js")).href);

/* ---------------------------------------------------------------------------
 * 1. 绑定 → 写 init 元数据
 * ------------------------------------------------------------------------- */
console.log("== 绑定角色卡写 init 元数据");
const expectedBonus = G.initiativeBonus(CHAR);
const derived = G.deriveGlance(CHAR);
if (expectedBonus === derived.initiative) ok("initiativeBonus 与速览推导的先攻一致：" + expectedBonus);
else bad("initiativeBonus(" + expectedBonus + ") 与 deriveGlance.initiative(" + derived.initiative + ") 不一致");
if (expectedBonus === 25) ok("示例卡先攻加值 = +25");
else console.log("  info 示例卡先攻加值 = " + expectedBonus + "（示例卡改了也行，下面按实际值断言）");

await C.bindToken(TOKEN.id, CARD.id);
const bound = itemById(TOKEN.id).metadata;
if (bound[KEY_BIND] === CARD.id) ok("bindToken 写入 cardId（旧键名不变）");
else bad("bindToken 没写 cardId：" + JSON.stringify(bound));
if (bound[KEY_INIT] && bound[KEY_INIT].bonus === expectedBonus && bound[KEY_INIT].cardId === CARD.id &&
  typeof bound[KEY_INIT].updatedAt === "number") {
  ok("bindToken 写入 init = { bonus: " + expectedBonus + ", cardId, updatedAt }");
} else bad("init 元数据不对：" + JSON.stringify(bound[KEY_INIT]));

await C.bindToken(TOKEN.id, null);
const unbound = itemById(TOKEN.id).metadata;
if (!(KEY_BIND in unbound) && !(KEY_INIT in unbound)) ok("解绑同时删掉 cardId 与 init");
else bad("解绑后元数据没清干净：" + JSON.stringify(unbound));
await C.bindToken(TOKEN.id, CARD.id);

/* ---------------------------------------------------------------------------
 * 2. 数据模型 / 掷骰 / 回合推进
 * ------------------------------------------------------------------------- */
console.log("== 先攻数据模型");
if (I.rollD20(() => 0) === 1 && I.rollD20(() => 0.99999) === 20) ok("rollD20 边界：1 / 20");
else bad("rollD20 边界不对：" + I.rollD20(() => 0) + " / " + I.rollD20(() => 0.99999));
if (I.rollInitiative(25, () => 0) === 26 && I.rollInitiative(-3, () => 0.99999) === 17)
  ok("先攻合计 = d20 + 加值（+25 → 26，-3 → 17）");
else bad("先攻合计不对");

const badRaw = I.normalizeInitiative({
  round: 0, activeId: "missing",
  entries: [
    { tokenId: "a", name: "甲", init: 9, bonus: 4, hidden: false, ownerId: "p1" },
    { tokenId: "a", name: "重复", init: 99, bonus: 0 },
    { tokenId: "", name: "空" },
    null
  ]
});
if (badRaw.entries.length === 1 && badRaw.entries[0].tokenId === "a" && badRaw.round === 1 && badRaw.activeId === "a")
  ok("normalizeInitiative：去重 / 丢弃空 id / 失效 active 回到第一条 / 轮数至少 1");
else bad("normalizeInitiative 结果不对：" + JSON.stringify(badRaw));

let st = I.normalizeInitiative({
  round: 1, activeId: "a",
  entries: [
    { tokenId: "a", name: "甲", init: 9, bonus: 4, ownerId: "p1" },
    { tokenId: "b", name: "乙", init: 14, bonus: 7, ownerId: "p2" },
    { tokenId: "c", name: "丙", init: 4, bonus: 1, ownerId: "p1" }
  ]
});
if (I.canEndTurn(st, "p1") && !I.canEndTurn(st, "p2") && st.activeId === "a") ok("activeId 失效时回到第一条；canEndTurn 只认当前条目的 ownerId");
else bad("activeId / canEndTurn 不对：" + JSON.stringify(st));
let adv = I.advanceInitiative(st, 1);
if (adv.activeId === "b" && adv.round === 1) ok("下一回合：a → b，轮数不变");
else bad("下一回合不对：" + JSON.stringify(adv));
adv = I.advanceInitiative(adv, 1);
adv = I.advanceInitiative(adv, 1);
if (adv.activeId === "a" && adv.round === 2) ok("越过末尾：回到 a，轮数 +1 = 2");
else bad("越过末尾不对：" + JSON.stringify(adv));
adv = I.advanceInitiative(adv, -1);
if (adv.activeId === "c" && adv.round === 1) ok("上一回合越过开头：回到 c，轮数 -1 = 1");
else bad("上一回合越过开头不对：" + JSON.stringify(adv));
const moved = I.moveEntry(st, "c", -1);
if (moved.entries[1].tokenId === "c" && moved.activeId === "a") ok("GM 上下移动只换数组位置，activeId 不变");
else bad("moveEntry 不对：" + JSON.stringify(moved.entries.map((x) => x.tokenId)));
const removed = I.removeEntry(st, "a");
if (removed.entries.length === 2 && removed.activeId === "b") ok("删除当前条目后自动指向下一条");
else bad("removeEntry 不对：" + JSON.stringify(removed));

/* ---------------------------------------------------------------------------
 * 3. 渲染：隐形对非 GM 不可见
 * ------------------------------------------------------------------------- */
console.log("== 先攻渲染 / 隐形");
const hiddenState = I.normalizeInitiative({
  round: 2, activeId: "h1",
  entries: [
    { tokenId: "h1", name: "潜行者", init: 31, bonus: 11, hidden: true, ownerId: "p1" },
    { tokenId: "p1t", name: "战士", init: 22, bonus: 2, hidden: false, ownerId: "p2" }
  ]
});
const playerHtml = I.renderInitiativeHTML(hiddenState, { role: "PLAYER", playerId: "p2", backgroundReady: true });
const gmHtml = I.renderInitiativeHTML(hiddenState, { role: "GM", playerId: "user-gm", backgroundReady: true });
if (playerHtml.indexOf("潜行者") < 0) ok("非 GM 的 HTML 里没有隐形条目的名字");
else bad("非 GM 的 HTML 泄露了隐形条目名字");
if (playerHtml.indexOf("？？？") >= 0 && playerHtml.indexOf("战士") >= 0) ok("非 GM 看到公开条目 + 当前回合「？？？」");
else bad("非 GM 的当前回合 / 公开条目渲染不对");
if (gmHtml.indexOf("潜行者") >= 0 && gmHtml.indexOf("隐形") >= 0) ok("GM 能看到隐形条目的名字与徽章");
else bad("GM 看不到隐形条目");
if (gmHtml.indexOf('data-init-act="next"') >= 0 && playerHtml.indexOf('data-init-act="next"') < 0)
  ok("GM 有「下一回合」，玩家没有（只看到结束回合）");
else bad("回合推进按钮的权限分支不对");
if (playerHtml.indexOf('data-init-act="end"') >= 0) ok("玩家看到「结束我的回合」按钮");
else bad("玩家没有「结束我的回合」按钮");

/* ---------------------------------------------------------------------------
 * 4. 后台：右键两项注册 + 加入先攻写房间数据
 * ------------------------------------------------------------------------- */
console.log("== 后台右键菜单 / 加入先攻");
const CORE = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
function stubBuilder(type) {
  let seq = 0;
  return function () {
    const item = { id: "local-" + type + "-" + (++seq), type, metadata: {}, visible: true, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } };
    const api = new Proxy({}, {
      get(_t, key) {
        if (key === "build") return () => deep(item);
        return (value) => { item[key] = value; return api; };
      }
    });
    return api;
  };
}
const run = new Function("OBR", "buildCurve", "buildShape", "buildText",
  CORE + "\nreturn { boot: typeof boot === 'function' ? boot : null, onInitMenuClick: typeof onInitMenuClick === 'function' ? onInitMenuClick : null, onInitRequest: typeof onInitRequest === 'function' ? onInitRequest : null, initAdvance: typeof initAdvance === 'function' ? initAdvance : null };");
const api = run(OBR, stubBuilder("CURVE"), stubBuilder("SHAPE"), stubBuilder("TEXT"));
if (!api || typeof api.boot !== "function" || typeof readyCb !== "function") {
  bad("background.core.js 没有注册 OBR.onReady / 找不到 boot");
} else {
  await readyCb();
  await sleep(240);
}
const labels = createdMenus.map((m) => (m.icons && m.icons[0] ? m.icons[0].label : "")).filter(Boolean);
for (const label of ["绑定 4E NEXT 角色卡", "加入先攻", "隐形加入先攻"]) {
  if (labels.indexOf(label) >= 0) ok("右键注册了「" + label + "」");
  else bad("右键没有注册「" + label + "」（现有：" + labels.join(" / ") + "）");
}
const addMenu = createdMenus.filter((m) => m.icons && m.icons[0] && m.icons[0].label === "加入先攻")[0];
const hiddenMenu = createdMenus.filter((m) => m.icons && m.icons[0] && m.icons[0].label === "隐形加入先攻")[0];
if (addMenu && hiddenMenu && addMenu.icons[0].filter.roles.indexOf("GM") >= 0 &&
  hiddenMenu.icons[0].filter.roles.indexOf("GM") >= 0 &&
  addMenu.icons[0].filter.every[0].value === "IMAGE") {
  ok("两项都只对单个 IMAGE token + GM 出现");
} else bad("两项右键的 filter 不对");

roomMeta[KEY_INITIATIVE] = null;
if (addMenu) await addMenu.onClick({ items: [itemById("tok-1")] }, "x");
let state = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
let e1 = state.entries.filter((e) => e.tokenId === "tok-1")[0];
if (e1 && e1.bonus === expectedBonus && e1.init >= expectedBonus + 1 && e1.init <= expectedBonus + 20 &&
  e1.hidden === false && e1.ownerId === "user-player" && state.activeId === "tok-1") {
  ok("「加入先攻」写入房间数据：bonus " + e1.bonus + " / init " + e1.init + " / 公开 / owner 正确");
} else bad("加入先攻写入不对：" + JSON.stringify(state));

if (hiddenMenu) await hiddenMenu.onClick({ items: [itemById("tok-2")] }, "x");
state = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
const e2 = state.entries.filter((e) => e.tokenId === "tok-2")[0];
if (e2 && e2.hidden === true) ok("「隐形加入先攻」写入 hidden = true");
else bad("隐形加入不对：" + JSON.stringify(state));

/* ---------------------------------------------------------------------------
 * 5. GM 推进 / 玩家结束回合权限分支
 * ------------------------------------------------------------------------- */
console.log("== 回合推进权限");
if (api && typeof api.initAdvance === "function") {
  const s0 = I.normalizeInitiative({
    round: 1, activeId: "a",
    entries: [{ tokenId: "a", name: "甲", init: 10, ownerId: "p1" }, { tokenId: "b", name: "乙", init: 9, ownerId: "p2" }]
  });
  const s1 = api.initAdvance(s0, 1);
  const s2 = api.initAdvance(s1, 1);
  if (s1.activeId === "b" && s1.round === 1 && s2.activeId === "a" && s2.round === 2)
    ok("GM 推进：a → b → 回到 a 且轮数 +1");
  else bad("GM 推进不对：" + JSON.stringify([s1, s2]));
}

roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({
  round: 1, activeId: "tok-1",
  entries: [
    { tokenId: "tok-1", name: "甲的 token", init: 20, bonus: 5, hidden: false, ownerId: "user-player" },
    { tokenId: "tok-2", name: "乙的 token", init: 10, bonus: 0, hidden: false, ownerId: "user-gm" }
  ]
});
role = "GM";
await api.onInitRequest({ data: { op: "end-turn", playerId: "user-player", activeId: "tok-1" } });
state = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
if (state.activeId === "tok-2") ok("玩家结束自己的回合：GM 客户端校验 owner 后推进");
else bad("玩家结束自己的回合没有推进：" + JSON.stringify(state));

roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({
  round: 1, activeId: "tok-1",
  entries: [
    { tokenId: "tok-1", name: "甲的 token", init: 20, bonus: 5, hidden: false, ownerId: "user-player" },
    { tokenId: "tok-2", name: "乙的 token", init: 10, bonus: 0, hidden: false, ownerId: "user-gm" }
  ]
});
const warnBefore = notifications.length;
await api.onInitRequest({ data: { op: "end-turn", playerId: "someone-else", activeId: "tok-1" } });
state = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
if (state.activeId === "tok-1" && notifications.slice(warnBefore).some((n) => /只能结束自己的回合/.test(n.msg)))
  ok("不是自己的回合：不推进并提示「只能结束自己的回合」");
else bad("别人的回合被推进了 / 没有提示");

roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({
  round: 1, activeId: "tok-1",
  entries: [{ tokenId: "tok-1", name: "甲的 token", init: 20, bonus: 5, hidden: false, ownerId: "user-player" }]
});
role = "PLAYER";
const writesBefore = JSON.stringify(roomMeta[KEY_INITIATIVE]);
await api.onInitRequest({ data: { op: "end-turn", playerId: "user-player", activeId: "tok-1" } });
if (JSON.stringify(roomMeta[KEY_INITIATIVE]) === writesBefore) ok("非 GM 的后台不写房间数据（请求只由 GM 客户端处理）");
else bad("非 GM 的后台也写了房间数据");
role = "GM";

/* ---------------------------------------------------------------------------
 * 6. 旧 token 同步加值
 * ------------------------------------------------------------------------- */
console.log("== 旧 token 同步先攻加值");
const oldToken = { id: "tok-old", type: "IMAGE", name: "旧 token", createdUserId: "user-gm", metadata: { [KEY_BIND]: "c-1" } };
items.push(oldToken);
const synced = await I.syncInitBonuses([CARD]);
const oldInit = itemById("tok-old").metadata[KEY_INIT];
if (synced >= 1 && oldInit && oldInit.bonus === expectedBonus && oldInit.cardId === "c-1")
  ok("syncInitBonuses 给旧绑定补写 init 元数据（+" + oldInit.bonus + "）");
else bad("syncInitBonuses 没补写：" + JSON.stringify({ synced, init: oldInit }));

/* ---------------------------------------------------------------------------
 * 7. 静态：三 tab / 骰子占位 / 版本
 * ------------------------------------------------------------------------- */
console.log("== 静态检查");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
if (man.name === "4eNEXT to owlbear" && man.version === "1.3.0") ok("manifest 名称 / 版本 = 4eNEXT to owlbear 1.3.0");
else bad("manifest 名称 / 版本不对：" + man.name + " " + man.version);
const panelHtml = fs.readFileSync(path.join(ROOT, "panel.html"), "utf8");
if (panelHtml.indexOf('data-tab="glance"') >= 0 && panelHtml.indexOf('data-tab="init"') >= 0 &&
  panelHtml.indexOf('data-tab="dice"') >= 0 && panelHtml.indexOf("即将推出") >= 0)
  ok("面板有速览 / 先攻 / 骰子三个 tab，骰子写明「即将推出」");
else bad("面板三 tab / 骰子占位缺失");

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);