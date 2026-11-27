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
const KEY_ROLLS = NS + "/rolls";
const KEY_CARDS = NS + "/cards";
const KEY_HP = NS + "/hp";
const KEY_HPBAR = NS + "/hp-bar/enabled";
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
let sceneMeta = {};
let role = "GM";
let playerId = "user-gm";
let readyCb = null;
/* v1.7.3：场景就绪回调（「进入房间自动打开先攻条」要走这条真实路径，所以留一份） */
const sceneReadyCbs = [];
const notifications = [];
const createdMenus = [];
const removedMenus = [];
const broadcastCbs = {};
const sentBroadcasts = [];
const openedPopovers = [];
/* v1.7.11：先攻条回到 OBR.popover.open（v1.7.10 的 modal + disablePointerEvents 会让整条点不动）。
 * 仍保留 modal 记录：断言先攻条**不再**走 modal.open。 */
const openedModals = [];
const closedModals = [];
const closedPopovers = [];

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
    onReadyChange(cb) { if (typeof cb === "function") sceneReadyCbs.push(cb); return () => {}; },
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
    remove(id) { removedMenus.push(id); return Promise.resolve(); }
  },
  tool: { create: async () => {}, remove: async () => {} },
  popover: {
    open: async (cfg) => { openedPopovers.push(cfg); },
    close: async (id) => { closedPopovers.push(id); }
  },
  modal: {
    open: async (cfg) => { openedModals.push(cfg); },
    close: async (id) => { closedModals.push(id); }
  },
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

/* v2.4.34：场景 metadata 兜底 */
OBR.scene.getMetadata = async () => sceneMeta;
OBR.scene.setMetadata = async (update) => { Object.assign(sceneMeta, update); };

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
for (const f of ["cards-core.js", "cards-scene.js", "common.js", "glance.js", "initiative.js"]) {
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
/* v1.8.4（Full Suite 口径）：绑卡即用卡的数据**覆盖** token 血量 ——
 * cur = max = 卡上限、surges = surgesMax、defenses = 卡四防；只保留 token 自己的 temp / locked。 */
const boundHp = bound[KEY_HP];
const wantHpMax = Math.round(derived.hpMax);
const wantHpSurgesMax = Math.round(derived.surgesMax);
const wantHpDef = {};
for (const row of derived.defenses || []) {
  const map = { ac: "ac", fort: "fort", ref: "reflex", reflex: "reflex", will: "will" };
  if (row && map[row.key] && typeof row.value === "number") wantHpDef[map[row.key]] = Math.round(row.value);
}
if (boundHp && boundHp.max === wantHpMax && boundHp.cur === wantHpMax && boundHp.surges === wantHpSurgesMax &&
  boundHp.surgesMax === wantHpSurgesMax)
  ok("bindToken：绑卡即覆盖 HP（cur = max = " + wantHpMax + "，surges = surgesMax = " + wantHpSurgesMax + "，与 Full Suite 一致）");
else bad("bindToken 覆盖 HP 不对：" + JSON.stringify(boundHp));
if (boundHp && ["ac", "fort", "reflex", "will"].every((k) => (wantHpDef[k] || 0) === (boundHp.defenses && typeof boundHp.defenses[k] === "number" ? boundHp.defenses[k] : 0)))
  ok("bindToken：四防按卡数据覆盖（" + JSON.stringify(boundHp && boundHp.defenses) + "）");
else bad("bindToken 的四防不是卡数据：" + JSON.stringify(boundHp && boundHp.defenses));

/* 已有血量 + 显式移除血条组件：再绑卡要**覆盖**血量、保留 temp/locked、并删掉 hp-bar/enabled（恢复显示） */
const HP_TOKEN = {
  id: "tok-hp-existing", type: "IMAGE", name: "已有血的 token", createdUserId: "user-gm",
  metadata: {
    [KEY_HP]: { cur: 7, max: 99, temp: 2, surges: 3, surgesMax: 8, defenses: { ac: 1 }, locked: false },
    [KEY_HPBAR]: false
  },
  position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }
};
items.push(HP_TOKEN);
await C.bindToken(HP_TOKEN.id, CARD.id);
const keptHp = itemById(HP_TOKEN.id).metadata[KEY_HP];
const keptMeta = itemById(HP_TOKEN.id).metadata;
if (keptHp && keptHp.cur === wantHpMax && keptHp.max === wantHpMax && keptHp.surges === wantHpSurgesMax &&
  keptHp.surgesMax === wantHpSurgesMax && keptHp.temp === 2 && keptHp.locked === false)
  ok("bindToken：已有血量再绑也覆盖 cur/max/surges（Full Suite 口径），但 temp=2 / locked=false 保留");
else bad("bindToken 覆盖语义不对：" + JSON.stringify(keptHp));
if (!(KEY_HPBAR in keptMeta))
  ok("bindToken：删除 hp-bar/enabled（之前「移除血条组件」的 token 绑卡后也重新显示血条）");
else bad("bindToken 没删 hp-bar/enabled：" + JSON.stringify(keptMeta));

/* v1.8.4：卡片更新后回推（propagateCardStats）——只更 max/surgesMax/四防/先攻，cur/temp/locked 保留 */
const newCard = deep(CARD);
newCard.char.hpBonus = 29; /* 卡上限 171 → 200 */
const newMax = Math.round(G.deriveGlance(newCard.char).hpMax);
const tok1 = itemById(TOKEN.id).metadata;
tok1[KEY_HP] = Object.assign({}, tok1[KEY_HP], { cur: 77, temp: 3, locked: false });
tok1[KEY_INIT] = { bonus: 0, cardId: CARD.id, updatedAt: 1 };
itemById(HP_TOKEN.id).metadata[KEY_HP] = Object.assign({}, itemById(HP_TOKEN.id).metadata[KEY_HP], { cur: 50, temp: 2, locked: false });
itemById(HP_TOKEN.id).metadata[KEY_INIT] = { bonus: 0, cardId: CARD.id, updatedAt: 1 };
const propagated = await C.propagateCardStats([newCard], [CARD.id]);
const t1 = itemById(TOKEN.id).metadata, t2 = itemById(HP_TOKEN.id).metadata;
if (propagated === 2 && t1[KEY_HP].max === newMax && t2[KEY_HP].max === newMax && newMax !== wantHpMax)
  ok("propagateCardStats：卡上限更新后两枚已绑定 token 的 max 都回推（" + wantHpMax + " → " + newMax + "）");
else bad("propagateCardStats 没回推 max：" + JSON.stringify({ propagated, newMax, t1: t1[KEY_HP] && t1[KEY_HP].max, t2: t2[KEY_HP] && t2[KEY_HP].max }));
if (t1[KEY_HP].cur === 77 && t2[KEY_HP].cur === 50 && t1[KEY_HP].temp === 3 && t2[KEY_HP].temp === 2 &&
  t1[KEY_HP].locked === false && t2[KEY_HP].locked === false)
  ok("propagateCardStats：cur / temp / locked 一律保留（保留当前 HP）");
else bad("propagateCardStats 动了 cur/temp/locked：" + JSON.stringify({ t1: t1[KEY_HP], t2: t2[KEY_HP] }));
if (t1[KEY_INIT].bonus === expectedBonus && t2[KEY_INIT].bonus === expectedBonus)
  ok("propagateCardStats：先攻加值也按新卡回推（" + expectedBonus + "）");
else bad("propagateCardStats 没回推先攻加值：" + JSON.stringify({ t1: t1[KEY_INIT], t2: t2[KEY_INIT] }));
const again = await C.propagateCardStats([newCard], [CARD.id]);
if (again === 0) ok("propagateCardStats：值没变化时不再写（不抖元数据）");
else bad("propagateCardStats 同值仍写了 " + again + " 枚 token");
const roleBefore = role;
role = "PLAYER";
const byPlayer = await C.propagateCardStats([newCard], [CARD.id]);
role = roleBefore;
if (byPlayer === 0) ok("propagateCardStats：只有 GM 执行（玩家身份直接跳过）");
else bad("propagateCardStats 玩家也执行了");

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

/* 后台连接三态：checking 不吓人，只有 bad 才出红字（v1.3.0 修复附带） */
const checkingHtml = I.renderInitiativeHTML(hiddenState, { role: "GM", playerId: "user-gm", backgroundState: "checking" });
if (checkingHtml.indexOf("正在确认后台脚本") >= 0 && checkingHtml.indexOf("后台脚本没有响应") < 0)
  ok("checking 状态只提示「正在确认」，不显示红字");
else bad("checking 状态的提示不对（不该出现红字）");
const badHtml = I.renderInitiativeHTML(hiddenState, { role: "GM", playerId: "user-gm", backgroundReady: false, backgroundState: "bad" });
if (badHtml.indexOf("后台脚本没有响应") >= 0) ok("确认失败（bad）才显示「后台脚本没有响应」");
else bad("bad 状态没有显示红字");

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
  CORE + "\nreturn {" +
  " boot: typeof boot === 'function' ? boot : null," +
  " onInitMenuClick: typeof onInitMenuClick === 'function' ? onInitMenuClick : null," +
  " onInitRequest: typeof onInitRequest === 'function' ? onInitRequest : null," +
  " initAdvance: typeof initAdvance === 'function' ? initAdvance : null," +
  " initRead: typeof initRead === 'function' ? initRead : null," +
  " roomWriteGuarded: typeof roomWriteGuarded === 'function' ? roomWriteGuarded : null," +
  " roomAuditLog: typeof roomAuditLog === 'function' ? roomAuditLog : null," +
  " initNorm: typeof initNorm === 'function' ? initNorm : null," +
  " initTiebreak: typeof initTiebreak === 'function' ? initTiebreak : null," +
  " stripHeightFor: typeof stripHeightFor === 'function' ? stripHeightFor : null," +
  " onStripDrag: typeof onStripDrag === 'function' ? onStripDrag : null," +
  " onStripCmd: typeof onStripCmd === 'function' ? onStripCmd : null," +
  " openStrip: typeof openStrip === 'function' ? openStrip : null," +
  " closeStrip: typeof closeStrip === 'function' ? closeStrip : null," +
  " onInitRemoveClick: typeof onInitRemoveClick === 'function' ? onInitRemoveClick : null," +
  " registerInitMenus: typeof registerInitMenus === 'function' ? registerInitMenus : null," +
  " syncInitFlags: typeof syncInitFlags === 'function' ? syncInitFlags : null," +
  " initMenuFilter: typeof initMenuFilter === 'function' ? initMenuFilter : null," +
  " initRemove: typeof initRemove === 'function' ? initRemove : null," +
  " initMissingIds: typeof initMissingIds === 'function' ? initMissingIds : null," +
  " initPrune: typeof initPrune === 'function' ? initPrune : null," +
  " pruneMissingInitEntries: typeof pruneMissingInitEntries === 'function' ? pruneMissingInitEntries : null," +
  " refreshInitKnownTokens: typeof refreshInitKnownTokens === 'function' ? refreshInitKnownTokens : null," +
  " maybeAutoOpenStrip: typeof maybeAutoOpenStrip === 'function' ? maybeAutoOpenStrip : null," +
  " stripAutostartOn: typeof stripAutostartOn === 'function' ? stripAutostartOn : null," +
  " markStripClosed: typeof markStripClosed === 'function' ? markStripClosed : null" +
  " };");
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
if (addMenu && hiddenMenu && !addMenu.icons[0].filter.roles &&
  hiddenMenu.icons[0].filter.roles.indexOf("GM") >= 0 &&
  addMenu.icons[0].filter.every[0].value === "IMAGE") {
  ok("「加入先攻」对玩家开放（无 roles 限制）；「隐形加入先攻」仍 GM 专属；都要求单个 IMAGE token");
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
  phase: "combat", round: 1, activeId: "tok-1",
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
  phase: "combat", round: 1, activeId: "tok-1",
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
  phase: "combat", round: 1, activeId: "tok-1",
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
 * 7. v1.4.0：先攻条数据层 / 排序 / 回合 / 权限 / 隐形 / 降级
 * ------------------------------------------------------------------------- */
console.log("== v1.4.0 先攻条：数据层");

if (I.INIT_MAX_ENTRIES === 40) ok("条目上限 INIT_MAX_ENTRIES = 40（v1.8.0：60 → 40）");
else bad("条目上限不是 40：" + I.INIT_MAX_ENTRIES);

const manyRaw = { round: 1, entries: [] };
for (let i = 0; i < 80; i++) manyRaw.entries.push({ tokenId: "t" + i, name: "单位" + i, init: 20 - i, bonus: 2 });
const capped = I.normalizeInitiative(manyRaw);
if (capped.entries.length === 40) ok("normalizeInitiative 把 80 条截成 40 条（不抛错）");
else bad("截断没生效：仍然 " + capped.entries.length + " 条");
const cappedSize = JSON.stringify(capped).length;
if (cappedSize < 8 * 1024) ok("40 条的 JSON " + cappedSize + " 字符 < 8 KB（房间数据预算：留一半给角色卡）");
else bad("40 条的 JSON 超了 8 KB：" + cappedSize);

const legacyState = I.normalizeInitiative({
  round: 2, activeId: "a",
  entries: [{ tokenId: "a", name: "甲", init: 31, bonus: 11, hidden: false, ownerId: "p1", updatedAt: 1 }]
});
if (legacyState.phase === "idle" && legacyState.entries[0].d20 === null && legacyState.entries[0].tb === null &&
  legacyState.entries[0].init === 31 && legacyState.round === 2) {
  ok("v1.3.x 旧数据：phase 缺省 idle、d20/tb 为 null、init 原样保留");
} else bad("旧数据兼容没做好：" + JSON.stringify(legacyState));
const legacyHtml = I.renderStripHTML(legacyState, { role: "GM", playerId: "gm", items: {} });
if (legacyHtml.indexOf(">31<") >= 0 && legacyHtml.indexOf("(31)") < 0) ok("旧数据没有 d20 时只显示合计 31（不再显示公式）");
else bad("旧数据的合计显示不对");
if (I.sortEntries([{ tokenId: "x", name: "甲", init: 31, bonus: 11 }, { tokenId: "y", name: "乙", init: 31, bonus: 0 }]).length === 2)
  ok("tb 缺失时 sortEntries 不报错");

const st14 = I.normalizeInitiative({
  phase: "combat", round: 1, activeId: "a",
  entries: [
    { tokenId: "a", name: "甲", bonus: 25, d20: 12, init: 37, tb: 0.2, ownerId: "p1" },
    { tokenId: "b", name: "乙", bonus: 5, d20: 3, init: 8, tb: 0.6, ownerId: "p2" }
  ]
});
const html14 = I.renderStripHTML(st14, { role: "GM", playerId: "gm", items: {} });
if (html14.indexOf('count-formula">37<') >= 0 && html14.indexOf('count-formula">8<') >= 0 && html14.indexOf("(12+25)") < 0 && html14.indexOf("(3+5)") < 0)
  ok("卡片小字直接显示合计（37 / 8），不再显示公式");
else bad("卡片合计显示不对");
if (html14.indexOf('class="initiative-item active"') >= 0) ok("当前回合卡带 .active（CSS 里 100 高）");
else bad("当前回合卡没有 .active");
if (html14.indexOf('data-strip-act="next"') >= 0 && html14.indexOf('data-strip-act="prev"') >= 0)
  ok("战斗态有「上一回合 / 下一回合」");
else bad("战斗态缺少回合推进按钮");
if (html14.indexOf('data-strip-act="prepare"') < 0) ok("战斗态不再显示「战斗准备」");
else bad("战斗态还显示「战斗准备」");
if (html14.indexOf('data-roll="normal"') >= 0 && html14.indexOf('data-roll="adv"') < 0 && html14.indexOf('data-roll="dis"') < 0 &&
  (html14.match(/class="roll-btn /g) || []).length === (html14.match(/class="initiative-item/g) || []).length)
  ok("GM 在战斗态只看到**一枚** d20（4E 没有优势 / 劣势）");
else bad("卡片下不是「只留一枚 d20」");
if (I.renderStripHTML(st14, { role: "PLAYER", playerId: "p2", items: {} }).indexOf("data-roll") < 0)
  ok("玩家没有掷骰按钮（房间数据只有 GM 能写）");

const idleHtml = I.renderStripHTML(I.normalizeInitiative({ entries: [{ tokenId: "a", name: "甲", init: 10 }] }), { role: "GM", playerId: "gm" });
if (idleHtml.indexOf('data-strip-act="prepare"') >= 0 && idleHtml.indexOf('data-strip-act="surprise"') >= 0 &&
  idleHtml.indexOf('data-strip-act="clear"') >= 0) {
  ok("闲置态有 战斗准备 / 突袭 / 一键清空");
} else bad("闲置态缺少 战斗准备 / 突袭 / 一键清空");
if (I.renderStripHTML(st14, { role: "PLAYER", playerId: "p2" }).indexOf('data-strip-act="clear"') < 0)
  ok("玩家没有「一键清空」");
const pillHtml = I.renderStripHTML(st14, { role: "GM", collapsed: true });
if (pillHtml.indexOf('class="strip collapsed') >= 0 && pillHtml.indexOf('data-strip-act="expand"') >= 0)
  ok("折叠态是 120×40 药丸（⚔ 展开 + 轮数徽标）");
else bad("折叠态渲染不对");

/* v1.7.10：展开高度 ≥ 170（控制行 36 + 卡片 80 + d20 按钮 16 + padding），不再裁切卡片。 */
if (I.stripHeightFor("idle") === 170 && I.stripHeightFor("preparing") === 180 && I.stripHeightFor("combat") === 200 &&
  I.stripHeightFor("idle") >= 170)
  ok("stripHeightFor：170 / 180 / 200 三档（都 ≥ 170，卡片与按钮不被裁切）");
else bad("stripHeightFor 三档不对：" + [I.stripHeightFor("idle"), I.stripHeightFor("preparing"), I.stripHeightFor("combat")].join("/"));
const sizeCollapsed = I.stripSizeFor("combat", true, 1366);
if (sizeCollapsed.width === 120 && sizeCollapsed.height === 40) ok("折叠尺寸 120×40");
else bad("折叠尺寸不对：" + JSON.stringify(sizeCollapsed));
const sizeMin = I.stripSizeFor("combat", false, 300);
if (sizeMin.width === 410 && sizeMin.height === 200) ok("展开宽度下限 410、高度按 phase = 200");
else bad("展开尺寸下限不对：" + JSON.stringify(sizeMin));
const sizeSmall = I.stripSizeFor("idle", false, 500);
if (sizeSmall.width === 468) ok("小视口（500）下宽度夹到 468（视口 −32）");
else bad("小视口没有夹紧：" + JSON.stringify(sizeSmall));

/* ---- v1.6.2：宽高是常量，内容怎么变都不改尺寸 ---- */
const sizeBig = I.stripSizeFor("combat", false, 1366);
const sizeSameAgain = I.stripSizeFor("combat", false, 1366);
/* 老页面（v1.6.1 的缓存）按 (phase, collapsed, clusterW, vw) 调 4 个参数：
 * 第 3 个是「量控制行得到的宽度」—— 必须作废，不能让它把条改窄。 */
const sizeLegacy = I.stripSizeFor("combat", false, 300, 1366);
if (sizeBig.width === 720 && sizeBig.height === 200 &&
  sizeSameAgain.width === 720 && sizeSameAgain.height === 200 &&
  sizeLegacy.width === 720 && sizeLegacy.height === 200) {
  ok("内容变化（投骰前后）尺寸不变：展开恒为 720×200，老 4 参调用里量出来的宽度被丢弃");
} else bad("先攻条尺寸会随内容变：" + JSON.stringify([sizeBig, sizeSameAgain, sizeLegacy]));
const phaseSizes = ["idle", "preparing", "combat"].map(function (p) { return I.stripSizeFor(p, false, 1366); });
if (phaseSizes.every(function (s) { return s.width === 720; }) &&
  phaseSizes[0].height === 170 && phaseSizes[1].height === 180 && phaseSizes[2].height === 200) {
  ok("展开宽度三档都是常量 720（只有高度按 phase 变：170 / 180 / 200）");
} else bad("展开宽度不是常量：" + JSON.stringify(phaseSizes));
{
  const pageSrcV162 = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  const applyBody = (/async function applySize\(\) \{[\s\S]*?\n\}/.exec(pageSrcV162) || [])[0] || "";
  if (applyBody && applyBody.indexOf("scrollWidth") < 0 && applyBody.indexOf("getBoundingClientRect") < 0 &&
    /stripSizeFor\(phase, collapsed, vw\)/.test(applyBody)) {
    ok("页面 applySize() 只算常量、不量 DOM（没有 scrollWidth / getBoundingClientRect）");
  } else bad("页面 applySize() 还在量内容宽度");
}

if (I.genTiebreak(10, () => 0) < I.genTiebreak(0, () => 0) &&
  I.genTiebreak(10, () => 0) >= 0.001 && I.genTiebreak(-99, () => 0.999999) <= 0.999) {
  ok("genTiebreak：加值越高 tb 越小，且夹在 [0.001, 0.999]");
} else bad("genTiebreak 公式不对");

const sorted14 = I.sortEntries([
  { tokenId: "a", name: "甲", init: 20, bonus: 5, tb: 0.7 },
  { tokenId: "b", name: "乙", init: 20, bonus: 5, tb: 0.2 },
  { tokenId: "c", name: "丙", init: 25, bonus: 0, tb: 0.9 },
  { tokenId: "d", name: "丁", init: 8, bonus: 3 }
]);
if (sorted14.map((e) => e.tokenId).join("") === "cbad") ok("sortEntries：合计降序 → tb 升序（缺 tb 按 0.5）");
else bad("sortEntries 顺序不对：" + sorted14.map((e) => e.tokenId).join(""));

const combatSt = I.normalizeInitiative({
  phase: "combat", round: 1, activeId: "a",
  entries: [{ tokenId: "a", name: "甲", init: 20 }, { tokenId: "b", name: "乙", init: 10 }]
});
const adv1 = I.advanceInitiative(combatSt, 1);
const adv2 = I.advanceInitiative(adv1, 1);
if (adv1.activeId === "b" && adv1.round === 1 && adv2.activeId === "a" && adv2.round === 2)
  ok("回合推进：a→b→绕回 a 且轮数 +1");
else bad("回合推进不对：" + JSON.stringify([adv1, adv2]));
const advBack = I.advanceInitiative(adv2, -1);
if (advBack.activeId === "b" && advBack.round === 1) ok("从第一张往回：回到 b、轮数 −1");
else bad("往回推进不对：" + JSON.stringify(advBack));
if (I.advanceInitiative(combatSt, -1).round === 1) ok("第一张往回不会把轮数减到 0");
else bad("轮数被减到 0 了");

const surpriseSt = I.normalizeInitiative({
  phase: "combat", surprise: true, round: 1, activeId: "a",
  entries: [{ tokenId: "a", name: "甲", init: 20 }, { tokenId: "b", name: "乙", init: 10 }]
});
const sur1 = I.advanceInitiative(surpriseSt, 1);
const sur2 = I.advanceInitiative(sur1, 1);
if (sur1.surprise === true && sur2.surprise === false && sur2.round === 1)
  ok("突袭轮绕回第一张 → 进入正常第 1 轮（surprise=false）");
else bad("突袭轮绕回不对：" + JSON.stringify([sur1, sur2]));

const prepared = I.startPreparation(I.normalizeInitiative({
  entries: [{ tokenId: "a", name: "甲", bonus: 5, d20: 20, init: 25, tb: 0.2 }]
}));
if (prepared.phase === "preparing" && prepared.activeId === "" && prepared.entries[0].d20 === null && prepared.entries[0].init === 0)
  ok("战斗准备：清空 init / d20 / active，phase=preparing");
else bad("战斗准备不对：" + JSON.stringify(prepared));
if (I.renderStripHTML(prepared, { role: "GM", playerId: "gm" }).indexOf('data-strip-act="start"') >= 0)
  ok("准备态有「开始战斗 / 取消准备」");
else bad("准备态没有开始战斗");
const started = I.startCombat(prepared, () => 0.5);
if (started.phase === "combat" && started.round === 1 && started.activeId === "a" &&
  started.entries[0].d20 >= 1 && started.entries[0].init === started.entries[0].d20 + 5) {
  ok("开始战斗：没掷过的自动掷 d20+加值，第一张设为当前");
} else bad("开始战斗不对：" + JSON.stringify(started));
const surpriseStart = I.startSurprise(started, () => 0.5);
if (surpriseStart.surprise === true && surpriseStart.phase === "combat") ok("突袭：phase=combat + surprise=true");
else bad("突袭状态不对");
const ended = I.endCombat(started);
if (ended.phase === "idle" && ended.activeId === "" && ended.entries.length === 1) ok("结束战斗：回 idle、清指针、名单保留");
else bad("结束战斗不对");
if (I.clearInitiative().entries.length === 0) ok("一键清空：条目清零");
else bad("一键清空没清掉");

const dragSt = I.normalizeInitiative({
  phase: "combat",
  entries: [
    { tokenId: "a", name: "甲", init: 30, bonus: 5, tb: 0.2 },
    { tokenId: "b", name: "乙", init: 20, bonus: 5, tb: 0.4 },
    { tokenId: "c", name: "丙", init: 10, bonus: 5, tb: 0.6 }
  ]
});
const toTop = I.reorderEntry(dragSt, "c", 0);
if (toTop.entries[0].tokenId === "c" && toTop.entries[0].init === 31) ok("拖到最顶：init = below + 1（31）");
else bad("拖到最顶不对：" + JSON.stringify(toTop.entries.map((e) => [e.tokenId, e.init])));
const toBottom = I.reorderEntry(dragSt, "a", 2);
if (toBottom.entries[2].tokenId === "a" && toBottom.entries[2].init === 9) ok("拖到最底：init = above − 1（9）");
else bad("拖到最底不对：" + JSON.stringify(toBottom.entries.map((e) => [e.tokenId, e.init])));
const toMiddle = I.reorderEntry(dragSt, "c", 1);
if (toMiddle.entries[1].tokenId === "c" && toMiddle.entries[1].init === 25) ok("拖到中间：init = 两张合计的中点（25）");
else bad("拖到中间不对：" + JSON.stringify(toMiddle.entries.map((e) => [e.tokenId, e.init])));

const tieSt = I.normalizeInitiative({
  entries: [
    { tokenId: "a", name: "甲", init: 20, bonus: 5, tb: 0.2 },
    { tokenId: "b", name: "乙", init: 20, bonus: 5, tb: 0.8 },
    { tokenId: "c", name: "丙", init: 20, bonus: 5, tb: 0.9 }
  ]
});
const tieMove = I.reorderEntry(tieSt, "c", 1);
const cMoved = tieMove.entries.filter((e) => e.tokenId === "c")[0];
if (cMoved.init === 20 && Math.abs(cMoved.tb - 0.5) < 1e-9 && tieMove.entries[1].tokenId === "c")
  ok("同分同组内：只把 tb 取中点，不改 init");
else bad("同分排序不对：" + JSON.stringify(tieMove.entries.map((e) => [e.tokenId, e.init, e.tb])));

const hiddenStrip = I.normalizeInitiative({
  phase: "combat", round: 1, activeId: "h1",
  entries: [
    { tokenId: "h1", name: "潜行者", bonus: 11, d20: 20, init: 31, tb: 0.1, hidden: true, ownerId: "p1" },
    { tokenId: "p1t", name: "战士", bonus: 2, d20: 18, init: 20, tb: 0.5, ownerId: "p2" }
  ]
});
const playerStrip = I.renderStripHTML(hiddenStrip, { role: "PLAYER", playerId: "p2", items: {} });
if (playerStrip.indexOf("潜行者") < 0 && playerStrip.indexOf("(20+11)") < 0)
  ok("非 GM 的先攻条里没有隐形条目的名字 / 点数");
else bad("非 GM 的先攻条泄露了隐形条目");
if (playerStrip.indexOf("？？？") >= 0 && playerStrip.indexOf("战士") >= 0)
  ok("玩家看到公开卡 + 当前回合「？？？」");
else bad("玩家的先攻条渲染不对");
const gmStrip = I.renderStripHTML(hiddenStrip, { role: "GM", playerId: "gm", items: {} });
if (gmStrip.indexOf("潜行者") >= 0 && gmStrip.indexOf("is-invisible") >= 0) ok("GM 看到隐形卡（灰度 + 隐字）");
else bad("GM 看不到隐形卡");

const ownSt = I.normalizeInitiative({
  phase: "combat", round: 1, activeId: "p1t",
  entries: [{ tokenId: "p1t", name: "战士", init: 20, ownerId: "p2" }]
});
if (I.renderStripHTML(ownSt, { role: "PLAYER", playerId: "p2", items: {} }).indexOf('data-strip-act="end"') >= 0)
  ok("轮到自己时玩家卡片上有「结束」");
else bad("玩家的「结束」按钮没出现");
if (I.renderStripHTML(ownSt, { role: "PLAYER", playerId: "p9", items: {} }).indexOf('data-strip-act="end"') < 0)
  ok("不是自己的回合没有「结束」");
if (I.renderStripHTML(ownSt, { role: "GM", playerId: "gm", items: {} }).indexOf('data-strip-act="end"') < 0)
  ok("GM 的卡片上没有玩家的「结束」按钮");

/* ---- 8) 写失败降级到本机 ---- */
console.log("== v1.4.0 先攻条：写失败降级");
const realSetMetadata = OBR.room.setMetadata;
const realSetScene = OBR.scene.setMetadata;
OBR.room.setMetadata = async () => { throw new Error("room metadata quota exceeded"); };
OBR.scene.setMetadata = async () => { throw new Error("scene metadata quota exceeded"); };
const noteBefore = notifications.length;
const degraded = await I.writeInitiative(I.normalizeInitiative({
  entries: [{ tokenId: "z1", name: "丙", bonus: 2, d20: 9, init: 11, tb: 0.4 }]
}));
OBR.room.setMetadata = realSetMetadata;
OBR.scene.setMetadata = realSetScene;
if (degraded && degraded.local === true && degraded.entries.length === 1)
  ok("写房间数据失败：writeInitiative 不抛错，返回 .local = true");
else bad("写失败没有降级：" + JSON.stringify(degraded));
let stashedInit = null;
try { stashedInit = JSON.parse(globalThis.localStorage.getItem("4enext/state/initiative") || "null"); } catch (e) { stashedInit = null; }
if (stashedInit && stashedInit.state && stashedInit.state.entries.length === 1)
  ok("写失败降级到本机 localStorage[4enext/state/initiative]");
else bad("本机没有暂存：" + JSON.stringify(stashedInit));
if (notifications.slice(noteBefore).some((n) => /房间数据已满（本插件/.test(n.msg)))
  ok("写失败弹 WARNING 通知（不静默）");
else bad("写失败没有通知");
globalThis.localStorage.removeItem("4enext/state/initiative");
sceneMeta = {};

/* ---- 9) 后台：数据层镜像 + 右键加入写 d20/tb + 打开先攻条 ---- */
console.log("== v1.4.0 后台：数据层 / 先攻条");
if (api && typeof api.initNorm === "function") {
  const bgCapped = api.initNorm(manyRaw);
  if (bgCapped.entries.length === 40 && bgCapped.phase === "idle") ok("后台 initNorm 同样把 80 条截成 40 条");
  else bad("后台 initNorm 截断不对：" + bgCapped.entries.length);
  const bgCombat = api.initNorm({ phase: "combat", surprise: true, round: 2, entries: [{ tokenId: "a", name: "甲", init: 12.5, d20: 7, tb: 0.3 }] });
  if (bgCombat.phase === "combat" && bgCombat.surprise === true && bgCombat.round === 2 &&
    bgCombat.entries[0].init === 12.5 && bgCombat.entries[0].d20 === 7 && bgCombat.entries[0].tb === 0.3) {
    ok("后台 initNorm 保留 phase / surprise / 小数 init / d20 / tb");
  } else bad("后台 initNorm 丢字段：" + JSON.stringify(bgCombat));
  const bgTb = api.initTiebreak(10);
  if (bgTb >= 0.39 && bgTb <= 0.41) ok("后台 initTiebreak 与 genTiebreak 同一公式（+10 → ≈0.4）");
  else bad("后台 initTiebreak 不对：" + bgTb);
  if (api.stripHeightFor("idle") === 170 && api.stripHeightFor("preparing") === 180 && api.stripHeightFor("combat") === 200)
    ok("后台 stripHeightFor 三档与页面一致（170 / 180 / 200）");
  else bad("后台 stripHeightFor 不对");
}
if (!api || typeof api.openStrip !== "function") bad("后台没有暴露 openStrip");
if (typeof api.closeStrip === "function") await api.closeStrip();
roomMeta[KEY_INITIATIVE] = null;
openedPopovers.length = 0;
if (addMenu) await addMenu.onClick({ items: [itemById("tok-1")] }, "x");
await sleep(80);
const addedState = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
const addedEntry = addedState.entries.filter((e) => e.tokenId === "tok-1")[0];
if (addedEntry && addedEntry.d20 >= 1 && addedEntry.d20 <= 20 && addedEntry.init === addedEntry.d20 + addedEntry.bonus &&
  typeof addedEntry.tb === "number" && addedEntry.tb >= 0.001 && addedEntry.tb <= 0.999) {
  ok("「加入先攻」写入 d20 / init=d20+加值 / tb（" + addedEntry.d20 + "+" + addedEntry.bonus + "=" + addedEntry.init + "）");
} else bad("加入先攻没有写 d20/tb：" + JSON.stringify(addedEntry));
const stripOpenCfg = openedPopovers.filter((c) => c && c.id === "com.4enext-owlbear/initiative-strip").pop();
if (stripOpenCfg) {
  if (stripOpenCfg.anchorReference === "POSITION" && stripOpenCfg.hidePaper === true &&
    stripOpenCfg.disableClickAway === true && stripOpenCfg.width === 720 && stripOpenCfg.height === 170 &&
    stripOpenCfg.anchorOrigin && stripOpenCfg.anchorOrigin.horizontal === "CENTER" &&
    stripOpenCfg.anchorOrigin.vertical === "TOP" && stripOpenCfg.anchorPosition &&
    stripOpenCfg.anchorPosition.top === 45 && /initiative\.html(?:\?.*)?$/.test(String(stripOpenCfg.url))) {
    ok("加入先攻后自动打开先攻条（popover：POSITION + CENTER/TOP + 720×170 @ top45 + hidePaper + disableClickAway）");
  } else bad("先攻条的 popover 参数不对：" + JSON.stringify(stripOpenCfg));
} else bad("加入先攻后没有打开先攻条");

/* ---- 10) 权限：四道校验 ---- */
console.log("== v1.4.0 玩家结束回合的四道校验");
const combatFixture = () => I.normalizeInitiative({
  phase: "combat", round: 1, activeId: "tok-1",
  entries: [
    { tokenId: "tok-1", name: "甲", init: 20, bonus: 5, ownerId: "user-player" },
    { tokenId: "tok-2", name: "乙", init: 10, ownerId: "user-gm" },
    { tokenId: "tok-3", name: "丙", init: 5, ownerId: "user-gm" }
  ]
});
roomMeta[KEY_INITIATIVE] = combatFixture();
role = "GM";
const req1 = api.onInitRequest({ data: { op: "end-turn", playerId: "user-player", activeId: "tok-1" } });
const req2 = api.onInitRequest({ data: { op: "end-turn", playerId: "user-player", activeId: "tok-1" } });
await Promise.all([req1, req2]);
let permState = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
if (permState.activeId === "tok-2") ok("同一个结束回合请求连发两次只推进一格（第四道校验：正在推进中）");
else bad("重复请求推进了多格：" + permState.activeId);

roomMeta[KEY_INITIATIVE] = combatFixture();
await api.onInitRequest({ data: { op: "end-turn", playerId: "user-player" } });
permState = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
if (permState.activeId === "tok-1") ok("请求里没有 activeId → 拒绝（老实现「缺失就放行」的 bug 不会复发）");
else bad("没有 activeId 的请求也推进了");

roomMeta[KEY_INITIATIVE] = combatFixture();
await api.onInitRequest({ data: { op: "end-turn", playerId: "user-player", activeId: "tok-2" } });
permState = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
if (permState.activeId === "tok-1") ok("请求里的 activeId 过期 → 拒绝");
else bad("过期的 activeId 也推进了");

roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({
  phase: "preparing", entries: [{ tokenId: "tok-1", name: "甲", init: 0, ownerId: "user-player" }]
});
await api.onInitRequest({ data: { op: "end-turn", playerId: "user-player", activeId: "tok-1" } });
permState = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
if (permState.activeId === "tok-1") ok("准备阶段不推进回合");
else bad("准备阶段被推进了");

/* ---- 11) v1.7.11 先攻条：popover 透明 + 宿主定位拖动 + 命令频道 ---- */
console.log("== v1.7.11 先攻条：popover 透明 + 拖动重开 + 命令");
if (typeof api.onStripDrag === "function" && typeof api.onStripCmd === "function" && typeof api.openStrip === "function") {
  const STRIP_ID = "com.4enext-owlbear/initiative-strip";
  const stripPops = () => openedPopovers.filter((c) => c && c.id === STRIP_ID);
  const stripModals = () => openedModals.filter((c) => c && c.id === STRIP_ID);
  if (typeof api.closeStrip === "function") await api.closeStrip();
  await sleep(40);
  const opensBefore = openedPopovers.length;
  api.onStripDrag({ data: { phase: "start", dx: 0, dy: 0 } });
  api.onStripDrag({ data: { phase: "move", dx: 100, dy: 50 } });
  await sleep(40);
  if (openedPopovers.length === opensBefore) ok("先攻条没打开时忽略拖动消息");
  else bad("先攻条没开也被拖动了");

  openedPopovers.length = 0;
  await api.openStrip();
  await sleep(60);
  let stripCfg = stripPops().pop();
  if (!stripCfg) bad("openStrip 没有打开先攻条");
  else if (stripCfg.anchorReference === "POSITION" && stripCfg.hidePaper === true &&
    stripCfg.disableClickAway === true && stripCfg.width === 720 && stripCfg.height === 170 &&
    stripCfg.anchorOrigin && stripCfg.anchorOrigin.horizontal === "CENTER" &&
    stripCfg.anchorOrigin.vertical === "TOP" && stripCfg.anchorPosition &&
    stripCfg.anchorPosition.left === 600 && stripCfg.anchorPosition.top === 45 &&
    stripCfg.url && /initiative\.html(?:\?.*)?$/.test(String(stripCfg.url))) {
    ok("openStrip → OBR.popover.open（POSITION + CENTER/TOP + 720×170 @ (600,45) + hidePaper + disableClickAway）");
  } else bad("先攻条 popover 参数不对：" + JSON.stringify(stripCfg));
  if (stripModals().length === 0) ok("先攻条不再用 OBR.modal.open（v1.7.10 的 disablePointerEvents 回归已修）");
  else bad("先攻条还在用 modal.open：" + JSON.stringify(stripModals()));

  /* 【关键回归】先攻条打开时右键「加入先攻」→ entries 必须增加（v1.7.10 的全屏 modal 会挡住右键菜单）。 */
  if (addMenu && typeof addMenu.onClick === "function") {
    roomMeta[KEY_INITIATIVE] = null;
    const beforeAdd = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]).entries.length;
    const openCount = stripPops().length;
    await addMenu.onClick({ items: [itemById("tok-2")] }, "x");
    await sleep(120);
    const addedState = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
    const addedEntry = addedState.entries.filter((e) => e.tokenId === "tok-2")[0];
    if (addedEntry && addedState.entries.length === beforeAdd + 1 && stripPops().length === openCount)
      ok("先攻条打开时右键「加入先攻」→ entries 增加（" + beforeAdd + "→" + addedState.entries.length + "；popover 不挡右键菜单）");
    else bad("先攻条打开时右键「加入先攻」失效：" + JSON.stringify({ before: beforeAdd, after: addedState.entries.length, opens: stripPops().length }));
  } else bad("找不到「加入先攻」右键菜单");

  /* 拖动 = 后台按位移夹紧后重开**同一个 popover**（iframe 复用，不重载）。 */
  const beforeDrag = stripPops().length;
  api.onStripDrag({ data: { phase: "start", dx: 0, dy: 0 } });
  api.onStripDrag({ data: { phase: "move", dx: 100, dy: 50 } });
  await sleep(90);
  const movedPop = stripPops().slice(beforeDrag).pop();
  if (!movedPop) bad("拖动先攻条没有重开 popover（宿主位置不会动）");
  else if (!movedPop.anchorPosition || movedPop.anchorPosition.left !== 700 || movedPop.anchorPosition.top !== 95)
    bad("拖动 100,50 后 popover 锚点不对：" + JSON.stringify(movedPop.anchorPosition));
  else if (movedPop.width !== 720 || movedPop.height !== 170)
    bad("拖动时 popover 尺寸变了：" + movedPop.width + "×" + movedPop.height);
  else ok("拖动 100,50 → 重开同一个 popover @ (700,95)，尺寸仍 720×170");

  api.onStripDrag({ data: { phase: "move", dx: 5000, dy: 5000 } });
  api.onStripDrag({ data: { phase: "end", dx: 5000, dy: 5000 } });
  await sleep(160);
  let posBox = null;
  try { posBox = JSON.parse(globalThis.localStorage.getItem("4enext/strip-pos") || "null"); } catch (e) { posBox = null; }
  /* 视口 1200×800、条 720×170 → dx 夹在 ±224，dy 最大 = 800−170−16−45 = 569（top = 614）。 */
  const clampedPop = stripPops().pop();
  if (posBox && posBox.dx === 224 && posBox.dy === 569) {
    if (!clampedPop || !clampedPop.anchorPosition || clampedPop.anchorPosition.left !== 824 || clampedPop.anchorPosition.top !== 614)
      bad("先攻条拖出视口后 popover 没有被夹回视口：" + JSON.stringify(clampedPop && clampedPop.anchorPosition));
    else ok("先攻条拖出视口 → 偏移夹到 { dx: 224, dy: 569 }、popover @ (824,614) 并落盘");
  } else bad("先攻条位置没有夹紧 / 落盘：" + JSON.stringify(posBox));

  const beforeReset = stripPops().length;
  api.onStripDrag({ data: { phase: "reset" } });
  await sleep(120);
  const centeredPop = stripPops().slice(beforeReset).pop();
  if (!globalThis.localStorage.getItem("4enext/strip-pos") && centeredPop && centeredPop.anchorPosition &&
    centeredPop.anchorPosition.left === 600 && centeredPop.anchorPosition.top === 45)
    ok("「回到顶部中间」→ 清掉记住的偏移并重开 popover @ (600,45)");
  else bad("回中后偏移还在 / popover 没回中：" + JSON.stringify({ saved: globalThis.localStorage.getItem("4enext/strip-pos"), pos: centeredPop && centeredPop.anchorPosition }));

  openedPopovers.length = 0;
  api.onStripCmd({ data: { op: "list" } });
  await sleep(140);
  const listWin = openedPopovers.filter((c) => c && /initiative\.html\?view=list(?:&v=[^&]*)?$/.test(String(c.url))).pop();
  if (listWin && listWin.width === 880 && listWin.height === 640) ok("先攻条「≡」打开列表窗口（?view=list，880×640）");
  else bad("列表窗口没打开：" + JSON.stringify(listWin && [listWin.url, listWin.width]));

  const beforeSize = stripPops().length;
  api.onStripCmd({ data: { op: "size", width: 410, height: 200 } });
  await sleep(120);
  const resized = stripPops().slice(beforeSize).pop();
  if (resized && resized.width === 720 && resized.height === 200 && resized.anchorPosition &&
    resized.anchorPosition.top === 45) {
    ok("尺寸命令（410×200 → 常量 720×200）→ 重开同一个 popover 换高度，宽度仍 720");
  } else bad("尺寸命令没有重开 popover / 尺寸不对：" + JSON.stringify(resized && [resized.width, resized.height]));

  /* v1.7.11：条已经开着时再点工具栏「先攻」→ 沿用页面报上来的 200 高，不缩回 idle 170。 */
  const beforeReopen = stripPops().length;
  await api.openStrip();
  await sleep(80);
  const reopenedPop = stripPops().slice(beforeReopen).pop();
  if (reopenedPop && reopenedPop.width === 720 && reopenedPop.height === 200)
    ok("已经开着时再打开先攻条 → 沿用当前 720×200（不缩回 170 裁掉卡片）");
  else bad("重新打开把战斗态高度缩回去了：" + JSON.stringify(reopenedPop && [reopenedPop.width, reopenedPop.height]));

  /* v1.6.2 的兜底仍在：页面报上来的测量宽度（588）会被 snapStripSize 丢掉 → 尺寸没变就不重开。 */
  const beforeSame = stripPops().length;
  api.onStripCmd({ data: { op: "size", width: 588, height: 200 } });
  await sleep(80);
  if (stripPops().length === beforeSame) ok("页面量出来的 588 被丢弃（尺寸没变 → 不重开窗口）");
  else bad("尺寸没变也重开了 popover");

  const beforePill = stripPops().length;
  const pillSize = I.stripSizeFor("combat", true, 1366);
  api.onStripCmd({ data: { op: "size", width: pillSize.width, height: pillSize.height } });
  await sleep(120);
  const pillPop = stripPops().slice(beforePill).pop();
  if (pillSize.width === 120 && pillSize.height === 40 && pillPop && pillPop.width === 120 && pillPop.height === 40)
    ok("折叠态 120×40 → 同一个 popover 换尺寸（药丸也常驻）");
  else bad("折叠态尺寸/重开不对：" + JSON.stringify({ pillSize, pop: pillPop && [pillPop.width, pillPop.height] }));

  /* closeStrip → popover.close（再 modal.close 兜底 v1.7.10 的旧实例）。 */
  closedPopovers.length = 0;
  closedModals.length = 0;
  await api.closeStrip();
  if (closedPopovers.indexOf(STRIP_ID) >= 0)
    ok("关闭先攻条 → OBR.popover.close(" + STRIP_ID + ")（modal.close 兜底旧实例）");
  else bad("关闭先攻条没有调 popover.close");
} else bad("后台没有暴露 onStripDrag / onStripCmd / openStrip");


/* ---------------------------------------------------------------------------
 * 7.5) v1.7.3：动态右键菜单（移出先攻）/ token 删除自动清理 / 先攻条常驻
 * ------------------------------------------------------------------------- */
console.log("== v1.7.3 右键菜单：动态互斥（已在先攻 → 只有「移出先攻」）");
const MENU_ADD = "com.4enext-owlbear/init-add";
const MENU_ADD_HIDDEN = "com.4enext-owlbear/init-add-hidden";
const MENU_REMOVE = "com.4enext-owlbear/init-remove";
const KEY_IN_INIT = "com.4enext-owlbear/in-init";
const latestMenu = (id) => createdMenus.filter((m) => m && m.id === id).pop() || null;
const filterOf = (m) => (m && m.icons && m.icons[0] ? m.icons[0].filter : null);
const inInitCond = (m) => {
  const f = filterOf(m);
  const every = (f && f.every) || [];
  return every.filter((c) => Array.isArray(c.key) && c.key[0] === "metadata" && c.key[1] === KEY_IN_INIT)[0] || null;
};

/* 1) 三项都在 + filter 读 token 元数据 in-init 且互斥 */
{
  const addM = latestMenu(MENU_ADD);
  const hidM = latestMenu(MENU_ADD_HIDDEN);
  const rmM = latestMenu(MENU_REMOVE);
  if (addM && hidM && rmM && rmM.icons[0].label === "移出先攻")
    ok("右键注册了三项：加入先攻 / 隐形加入先攻 / 移出先攻");
  else bad("右键三项没注册齐（" + [!!addM, !!hidM, !!rmM].join("/") + "）");
  const addC = inInitCond(addM);
  const rmC = inInitCond(rmM);
  if (addC && addC.operator === "!=" && addC.value === true && rmC && rmC.value === true && !rmC.operator)
    ok("菜单 filter 互斥：加入两项要求 in-init「!= true」，移出要求 in-init「== true」（同一枚 token 只出现一种）");
  else bad("菜单 filter 不是按 in-init 互斥：" + JSON.stringify({ addC, rmC }));
  if (addM && !addM.icons[0].filter.roles && hidM.icons[0].filter.roles.indexOf("GM") >= 0 &&
    addM.icons[0].filter.max === 1 && addM.icons[0].filter.every[0].value === "IMAGE")
    ok("「加入先攻」对玩家开放（无 roles），隐形/移出仍 GM，都限定单个 IMAGE token");
  else bad("右键三项的 GM / IMAGE / max 条件不对");
}

/* 2) 加入 → token 上 in-init = true；移出 → 写回 false */
{
  roomMeta[KEY_INITIATIVE] = null;
  const addMenu = latestMenu(MENU_ADD);
  await addMenu.onClick({ items: [itemById("tok-1")] }, "x");
  await sleep(160);
  if (itemById("tok-1").metadata[KEY_IN_INIT] === true)
    ok("加入先攻后 token 元数据 in-init = true（右键菜单随之换成「移出先攻」）");
  else bad("加入后 in-init 不是 true：" + JSON.stringify(itemById("tok-1").metadata[KEY_IN_INIT]));
  if (itemById("tok-2").metadata[KEY_IN_INIT] !== true)
    ok("没加入的 token 不会被标记（in-init 不是 true）");
  else bad("没加入的 token 也被标记了");

  const rmMenu = latestMenu(MENU_REMOVE);
  const noteBefore = notifications.length;
  await rmMenu.onClick({ items: [itemById("tok-1")] });
  await sleep(160);
  const after = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
  if (after.entries.every((e) => e.tokenId !== "tok-1")) ok("点「移出先攻」→ entries 里不再有该 tokenId（先攻条会跟着刷新）");
  else bad("移出后 entries 里还有 tok-1：" + JSON.stringify(after.entries.map((e) => e.tokenId)));
  /* [v1.7.8] 反向断言：移出成功**不再**弹「已移出先攻」（条上那张卡当场就消失）。 */
  const rmNotes = notifications.slice(noteBefore);
  if (!rmNotes.some((n) => /已移出先攻/.test(n.msg))) ok("移出后不弹「已移出先攻」（v1.7.8：成功类通知为 0）");
  else bad("移出后还在弹通知：" + JSON.stringify(rmNotes));
  if (itemById("tok-1").metadata[KEY_IN_INIT] === false)
    ok("移出后 in-init 写回 false（菜单变回「加入先攻」，不 delete）");
  else bad("移出后 in-init 没有写回 false：" + JSON.stringify(itemById("tok-1").metadata[KEY_IN_INIT]));

  /* 镜像过期（名单里没有、token 上还是 true）→ 提示 + 立刻改回 false */
  roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({ entries: [] });
  await OBR.scene.items.updateItems(["tok-1"], function (drafts) {
    for (const d of drafts) { if (!d.metadata) d.metadata = {}; d.metadata[KEY_IN_INIT] = true; }
  });
  const noteStale = notifications.length;
  await latestMenu(MENU_REMOVE).onClick({ items: [itemById("tok-1")] });
  await sleep(160);
  if (notifications.slice(noteStale).some((n) => /已经不在先攻里/.test(n.msg)) &&
    itemById("tok-1").metadata[KEY_IN_INIT] === false)
    ok("镜像过期时点「移出先攻」→ 提示「已经不在先攻里了」并立刻把 in-init 改回 false");
  else bad("镜像过期时的处理不对：" + JSON.stringify(itemById("tok-1").metadata[KEY_IN_INIT]));
}

/* 卡片上的 ✕（GM 有、玩家没有） */
{
  const st173 = I.normalizeInitiative({
    phase: "combat", round: 1, activeId: "a",
    entries: [{ tokenId: "a", name: "甲", init: 20, bonus: 5, ownerId: "p1" }]
  });
  const gmCard = I.renderStripHTML(st173, { role: "GM", playerId: "gm", items: {} });
  const plCard = I.renderStripHTML(st173, { role: "PLAYER", playerId: "p1", items: {} });
  if (gmCard.indexOf('class="item-del"') >= 0 && gmCard.indexOf('data-strip-act="remove"') >= 0 &&
    gmCard.indexOf('data-token="a"') >= 0)
    ok("GM 的卡片右上角有 ✕（data-strip-act=\"remove\" + data-token）");
  else bad("GM 的卡片上没有 ✕");
  if (plCard.indexOf("item-del") < 0 && plCard.indexOf('data-strip-act="remove"') < 0)
    ok("玩家卡片上没有 ✕（房间数据只有城主能写）");
  else bad("玩家卡片上出现了 ✕");
}

console.log("== v1.7.3 token 被删除 → 自动清理 + 游标顺移");
{
  const prSt = I.normalizeInitiative({
    phase: "combat", round: 2, activeId: "b",
    entries: [
      { tokenId: "a", name: "甲", init: 30 },
      { tokenId: "b", name: "乙", init: 20 },
      { tokenId: "c", name: "丙", init: 10 }
    ]
  });
  const missing = I.missingEntryIds(prSt, ["a", "c"]);
  const pruned = I.pruneMissingEntries(prSt, ["a", "c"]);
  if (missing.join("") === "b" && pruned.entries.map((e) => e.tokenId).join("") === "ac" &&
    pruned.activeId === "c" && pruned.round === 2)
    ok("pruneMissingEntries：删掉当前条目 b → 条目只剩 a/c，游标顺移到 c，轮数不变");
  else bad("pruneMissingEntries 不对：" + JSON.stringify({ missing, ids: pruned.entries.map((e) => e.tokenId), active: pruned.activeId }));
  const onlyOne = I.pruneMissingEntries(prSt, ["a", "b", "c"]);
  if (onlyOne.entries.length === 3) ok("token 都还在时一条都不删");
  else bad("没有缺 token 也删了条目");
  const allGone = I.pruneMissingEntries(prSt, []);
  if (allGone.entries.length === 0 && allGone.activeId === "" && allGone.round === 1)
    ok("token 全被删 → 名单清空、activeId 清空、轮数回 1");
  else bad("清空后的状态不对：" + JSON.stringify(allGone));
}

{
  /* 后台版：先记住「现在有哪些 token」，再删一枚 → 清理只针对「见过 → 消失」 */
  role = "GM";
  roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({
    phase: "combat", round: 1, activeId: "tok-1",
    entries: [
      { tokenId: "tok-1", name: "甲", init: 20, ownerId: "user-player" },
      { tokenId: "tok-2", name: "乙", init: 10, ownerId: "user-gm" }
    ]
  });
  await api.refreshInitKnownTokens();
  await sleep(1300); /* 等「刚进场景」的静音窗口过去（防止把切换场景当成删除） */
  items = items.filter((it) => it.id !== "tok-1");
  const noteBefore = notifications.length;
  const cleaned = await api.pruneMissingInitEntries();
  const state173 = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
  if (cleaned === 1 && state173.entries.length === 1 && state173.entries[0].tokenId === "tok-2" &&
    state173.activeId === "tok-2")
    ok("token tok-1 被删 → 先攻条目自动清理，当前回合游标顺移到 tok-2");
  else bad("自动清理不对：" + JSON.stringify({ cleaned, ids: state173.entries.map((e) => e.tokenId), active: state173.activeId }));
  /* [v1.7.8] 反向断言：token 被删 → 自动清理不再弹通知（条上少了一张卡，看得见）。 */
  if (!notifications.slice(noteBefore).some((n) => /已被删除/.test(n.msg))) ok("自动清理后不弹通知（v1.7.8：成功类通知为 0）");
  else bad("自动清理还在弹通知：" + JSON.stringify(notifications.slice(noteBefore)));

  /* 切场景保护：只「刷新见过集合」，不因为「不在 items 里」就清空 */
  roomMeta[KEY_INITIATIVE] = I.normalizeInitiative({
    phase: "combat", round: 1, activeId: "tok-x",
    entries: [{ tokenId: "tok-x", name: "别的场景的 token", init: 15 }]
  });
  await api.refreshInitKnownTokens();
  const keep = await api.pruneMissingInitEntries();
  const stateKeep = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
  if (keep === 0 && stateKeep.entries.length === 1)
    ok("刚进场景 / 换场景时不清名单（否则换个场景就把整条先攻清了）");
  else bad("换场景把名单清了：" + JSON.stringify({ keep, n: stateKeep.entries.length }));
}

console.log("== v1.7.3 / v1.7.11 先攻条常驻（popover 透明 / 进入房间自动显示 / 关掉不再弹）");
{
  const STRIP_ID = "com.4enext-owlbear/initiative-strip";
  const AUTO_KEY = "4enext/strip-autostart";
  const CLOSED_KEY = "4enext/strip-closed-this-session";
  const stripPops = () => openedPopovers.filter((c) => c && c.id === STRIP_ID);
  const isTransparentPopover = (c) => !!(c && c.id === STRIP_ID && c.anchorReference === "POSITION" &&
    c.hidePaper === true && c.disableClickAway === true && c.width > 0 && c.height > 0);

  globalThis.localStorage.removeItem(AUTO_KEY);
  globalThis.localStorage.removeItem(CLOSED_KEY);
  await api.closeStrip();
  openedPopovers.length = 0;
  /* 真实入口：scene.onReadyChange(true) → boot 里那个回调 → maybeAutoOpenStrip() */
  if (sceneReadyCbs.length) {
    for (const cb of sceneReadyCbs) {
      try { cb(true); } catch (e) { /* 其它订阅自己的事，别挡住这条断言 */ }
    }
    await sleep(220);
    const viaReady = stripPops().pop();
    if (isTransparentPopover(viaReady))
      ok("scene.onReadyChange(true) → 自动打开先攻条（popover：POSITION + hidePaper + disableClickAway + 有宽高）");
    else bad("scene.onReadyChange 时没有按设置自动打开先攻条");
  } else {
    bad("后台没有订阅 scene.onReadyChange");
  }

  await api.closeStrip();
  openedPopovers.length = 0;
  const autoOpened = await api.maybeAutoOpenStrip("自测");
  const autoCfg = stripPops().pop();
  if (autoOpened && isTransparentPopover(autoCfg)) ok("设置未写（默认）→ 进入房间自动打开先攻条（popover）");
  else bad("默认没有自动打开先攻条 / 参数不对");
  if (api.stripAutostartOn() === true) ok("stripAutostartOn 默认 true（缺省按开）");
  else bad("stripAutostartOn 默认不是 true");

  /* 设置为 0 → 不自动开 */
  globalThis.localStorage.setItem(AUTO_KEY, "0");
  await api.closeStrip();
  openedPopovers.length = 0;
  const offOpened = await api.maybeAutoOpenStrip("自测");
  if (!offOpened && stripPops().length === 0 && api.stripAutostartOn() === false)
    ok("设置 " + AUTO_KEY + " = \"0\" → 不自动打开先攻条");
  else bad("设置为 0 仍然自动打开了");
  globalThis.localStorage.removeItem(AUTO_KEY);

  /* 条上的 ✕（CH_STRIP_CMD {op:"close"}）→ 会话级标记 → 不再自动弹 */
  globalThis.localStorage.removeItem(CLOSED_KEY);
  await api.openStrip();
  openedPopovers.length = 0;
  api.onStripCmd({ data: { op: "close" } });
  await sleep(80);
  const closedMark = globalThis.localStorage.getItem(CLOSED_KEY);
  const reopened = await api.maybeAutoOpenStrip("自测");
  if (closedMark === "1" && !reopened)
    ok("「✕」写 " + CLOSED_KEY + " = 1 → 本次会话不再自动弹");
  else bad("「✕」没有记会话级标记 / 仍然自动弹");

  /* 重新打开 → 清掉标记（下个房间照样自动开） */
  await api.openStrip();
  if (globalThis.localStorage.getItem(CLOSED_KEY) === null)
    ok("重新打开先攻条 → 清掉会话级关闭标记（下个房间又会自动开）");
  else bad("重新打开没有清掉会话级标记");

  /* 折叠态药丸：同一个 popover id + 常量 120×40（药丸也常驻）。 */
  openedPopovers.length = 0;
  api.onStripCmd({ data: { op: "size", width: 120, height: 40 } });
  await sleep(80);
  api.onStripDrag({ data: { phase: "start", dx: 0, dy: 0 } });
  api.onStripDrag({ data: { phase: "move", dx: 6, dy: 6 } });
  api.onStripDrag({ data: { phase: "end", dx: 6, dy: 6 } });
  await sleep(200);
  const pillSize = I.stripSizeFor("combat", true, 1366);
  const pillPop = stripPops().pop();
  if (pillSize.width === 120 && pillSize.height === 40 && pillPop && pillPop.width === 120 && pillPop.height === 40)
    ok("折叠态（120×40 药丸）仍是同一个 popover、常量尺寸（药丸也常驻）");
  else bad("折叠态没有保持常驻：" + JSON.stringify({ pillSize, pop: pillPop && [pillPop.width, pillPop.height] }));
  await api.closeStrip();
}

/* ---------------------------------------------------------------------------
 * 8. 静态：v1.3.1 拆掉三 tab / 独立窗口 / 版本
 * ------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
 * 7.9) v1.7.10：加值可编辑（卡片 + 状态行同一份写逻辑）+ 无卡 token 也能加入先攻
 * ------------------------------------------------------------------------- */
console.log("== v1.7.10 先攻加值可编辑 + 无卡 token 加入先攻");
{
  const st0 = I.normalizeInitiative({
    phase: "combat", round: 1, activeId: "b",
    entries: [
      { tokenId: "a", name: "甲", bonus: 5, d20: 10, init: 15, tb: 0.2, ownerId: "p1" },
      { tokenId: "b", name: "乙", bonus: 0, d20: 18, init: 18, tb: 0.5, ownerId: "p2" }
    ]
  });
  const st1 = I.setEntryBonus(st0, "b", 7);
  const b1 = st1.entries.filter((e) => e.tokenId === "b")[0];
  if (b1.bonus === 7 && b1.init === 25 && st1.entries[0].tokenId === "b")
    ok("setEntryBonus：合计 = d20 + 新加值（18+7=25），并按合计立即重排");
  else bad("setEntryBonus 没有重算 / 重排：" + JSON.stringify([b1.bonus, b1.init, st1.entries.map((e) => e.tokenId)]));
  const stClamp = I.setEntryBonus(st0, "a", 5000);
  if (stClamp.entries.filter((e) => e.tokenId === "a")[0].bonus === 999)
    ok("setEntryBonus 把超范围加值夹到 999（不抛错）");
  else bad("setEntryBonus 没有夹紧加值");
  if (JSON.stringify(I.setEntryBonus(st0, "missing", 3)) === JSON.stringify(I.normalizeInitiative(st0)))
    ok("setEntryBonus 对不存在的条目不改数据（不抛错）");
  else bad("setEntryBonus 改了不存在的条目");

  const entryA = st0.entries.filter((e) => e.tokenId === "a")[0];
  if (I.canEditBonus(entryA, { role: "GM" }) &&
    I.canEditBonus(entryA, { role: "PLAYER", playerId: "p1" }) &&
    !I.canEditBonus(entryA, { role: "PLAYER", playerId: "p2" }))
    ok("权限：GM 可改任意条目，玩家只能改自己 token 的条目");
  else bad("canEditBonus 的权限分支不对");

  const gmHtml10 = I.renderStripHTML(st0, { role: "GM", playerId: "gm", items: {} });
  const p1Html10 = I.renderStripHTML(st0, { role: "PLAYER", playerId: "p1", items: {} });
  if (gmHtml10.indexOf('data-bonus-input="a"') >= 0 && gmHtml10.indexOf('data-bonus-input="b"') >= 0)
    ok("卡片左上角是**可编辑输入框**（data-bonus-input，GM 每张都有）");
  else bad("卡片左上角没有可编辑加值输入框");
  if (gmHtml10.indexOf('data-bonus-row="b"') >= 0 && gmHtml10.indexOf("加值") >= 0)
    ok("状态行「阶段 · 当前单位 · 加值 [ ]」有可编辑输入框（data-bonus-row，与卡片共用写逻辑）");
  else bad("状态行没有可编辑加值的输入框");
  if (p1Html10.indexOf('data-bonus-input="a"') >= 0 && p1Html10.indexOf('data-bonus-input="b"') < 0)
    ok("玩家只在自己的 token 上看到加值输入框（别人的条目只读）");
  else bad("玩家权限在渲染层没有生效");

  /* v1.8.2：卡片上可直接手填「掷出的点数（d20）」（data-init-d20，GM / 自己的 token） */
  if (gmHtml10.indexOf('data-init-d20="a"') >= 0 && gmHtml10.indexOf('data-init-d20="b"') >= 0)
    ok("GM 的卡片上大号数字是可编辑的 d20 输入框（data-init-d20，每张都有）");
  else bad("GM 卡片上没有可编辑的 d20 点数输入框");
  const d20A = /data-init-d20="a"[^>]*value="(\d+)"/.exec(gmHtml10);
  if (d20A && d20A[1] === "10") ok("d20 输入框的值 = 当前掷出的点数（a：10，不是合计 15）");
  else bad("d20 输入框的初始值不对：" + JSON.stringify(d20A && d20A[1]));
  if (p1Html10.indexOf('data-init-d20="a"') >= 0 && p1Html10.indexOf('data-init-d20="b"') < 0)
    ok("玩家只在自己的 token 上看到 d20 输入框（别人的条目保持只读）");
  else bad("d20 输入框的玩家权限没有生效");
  const prepUnrolled = I.normalizeInitiative({
    phase: "preparing",
    entries: [{ tokenId: "c", name: "丙", bonus: 0, d20: null, init: 0, ownerId: "p1" }]
  });
  const prepHtml = I.renderStripHTML(prepUnrolled, { role: "GM", playerId: "gm", items: {} });
  if (prepHtml.indexOf('data-init-d20="c"') < 0 && prepHtml.indexOf("—") >= 0)
    ok("preparing 且未掷 d20：保持只读（显示「—」，不渲染 d20 输入框）");
  else bad("preparing 未掷时 d20 不该可编辑");
  const prepRolled = I.normalizeInitiative({
    phase: "preparing",
    entries: [{ tokenId: "c", name: "丙", bonus: 5, d20: 7, init: 12, ownerId: "p1" }]
  });
  if (I.renderStripHTML(prepRolled, { role: "GM", playerId: "gm", items: {} }).indexOf('data-init-d20="c"') >= 0)
    ok("preparing 但已掷 d20：点数可编辑（GM 可在开战前先改）");
  else bad("preparing 已掷时 d20 应该可编辑");

  /* setEntryRoll：改 d20、保持加值、重算合计并重排 */
  const rolledA = I.setEntryRoll(st0, "a", 20);
  const ra = rolledA.entries.filter((e) => e.tokenId === "a")[0];
  if (ra.d20 === 20 && ra.bonus === 5 && ra.init === 25 && rolledA.entries[0].tokenId === "a")
    ok("setEntryRoll：a 的 d20 10→20、加值保持 5、合计 25，并按合计重排到第一");
  else bad("setEntryRoll 不对：" + JSON.stringify({ d20: ra.d20, bonus: ra.bonus, init: ra.init, order: rolledA.entries.map((e) => e.tokenId) }));
  const rolledClamp = I.setEntryRoll(st0, "a", 200);
  if (rolledClamp.entries.filter((e) => e.tokenId === "a")[0].d20 === 99)
    ok("setEntryRoll 把超范围点数夹到 99（不抛错）");
  else bad("setEntryRoll 没有夹紧 d20");
  if (JSON.stringify(I.setEntryRoll(st0, "missing", 3)) === JSON.stringify(I.normalizeInitiative(st0)))
    ok("setEntryRoll 对不存在的条目不改数据（不抛错）");
  else bad("setEntryRoll 改了不存在的条目");
  /* 边界 0 / 99：放宽到 0~99 后，合计与排序必须照常，不能出现 NaN */
  const rollZero = I.setEntryRoll(st0, "a", 0);
  const rz = rollZero.entries.filter((e) => e.tokenId === "a")[0];
  if (rz.d20 === 0 && rz.init === 5 && isFinite(rz.init) && rollZero.entries[0].tokenId === "b")
    ok("setEntryRoll d20=0：合计 = 0+5 = 5、按合计排到 b(18) 之后，不 NaN");
  else bad("setEntryRoll d20=0 不对：" + JSON.stringify({ d20: rz.d20, init: rz.init, order: rollZero.entries.map((e) => e.tokenId) }));
  const roll99 = I.setEntryRoll(st0, "a", 99);
  const r99 = roll99.entries.filter((e) => e.tokenId === "a")[0];
  if (r99.d20 === 99 && r99.init === 104 && isFinite(r99.init) && roll99.entries[0].tokenId === "a")
    ok("setEntryRoll d20=99：合计 = 99+5 = 104、按合计排到第一，不 NaN");
  else bad("setEntryRoll d20=99 不对：" + JSON.stringify({ d20: r99.d20, init: r99.init, order: roll99.entries.map((e) => e.tokenId) }));
  /* 正常掷骰路径仍只产生 1~20（放宽夹取只服务手填，不影响 rollD20 / rerollEntry） */
  const lowRoll = I.entryFromItem({ id: "tok-low", name: "低", createdUserId: "u1", metadata: {} }, [], false, () => 0);
  const highRoll = I.entryFromItem({ id: "tok-high", name: "高", createdUserId: "u1", metadata: {} }, [], false, () => 0.999999);
  const rerolledLow = I.rerollEntry(I.addEntry(I.normalizeInitiative(null), lowRoll), "tok-low", () => 0);
  if (lowRoll.d20 === 1 && highRoll.d20 === 20 && rerolledLow.entries[0].d20 === 1)
    ok("正常掷骰路径仍是 d20 1~20（entryFromItem / rerollEntry 不受 0~99 手填范围影响）");
  else bad("正常掷骰路径被放宽影响了：" + JSON.stringify({ low: lowRoll.d20, high: highRoll.d20, rerolled: rerolledLow.entries[0].d20 }));

  const boundItem = {
    id: "tok-bound", name: "有卡单位", createdUserId: "u1",
    metadata: { [KEY_BIND]: CARD.id, [KEY_INIT]: { bonus: expectedBonus, cardId: CARD.id, updatedAt: 1 } }
  };
  const listHtml10 = I.renderInitiativeHTML(st0, { role: "GM", playerId: "gm", backgroundReady: true, inWindow: true });
  if (listHtml10.indexOf('data-init-bonus="a"') >= 0 && listHtml10.indexOf('data-init-bonus="b"') >= 0)
    ok("列表窗口的加值也能编辑（data-init-bonus，与条上共用 setEntryBonus / canEditBonus）");
  else bad("列表窗口的加值还是只读");

  const boundEntry = I.entryFromItem(boundItem, [CARD], false, () => 0.5);
  if (boundEntry.bonus === expectedBonus) ok("有绑定角色卡：加值自动填卡里的「先攻」（+" + expectedBonus + "）");
  else bad("有卡条目没有预填卡值：" + boundEntry.bonus);
  const unboundEntry = I.entryFromItem({ id: "tok-x", name: "杂兵", createdUserId: "u1", metadata: {} }, [], false, () => 0.5);
  if (unboundEntry.bonus === 0 && unboundEntry.init === 11 && unboundEntry.name === "杂兵")
    ok("无绑定卡：entryFromItem 默认 bonus 0（d20 11 → 合计 11，不报错）");
  else bad("无卡条目默认加值不对：" + JSON.stringify(unboundEntry));

  /* 后台也允许无卡 token 加入（不检查 init.bonus 是否存在、不弹通知） */
  items.push({ id: "tok-3", type: "IMAGE", name: "无名杂兵", createdUserId: "user-gm", metadata: {}, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 } });
  roomMeta[KEY_INITIATIVE] = null;
  const noteBefore10 = notifications.length;
  await latestMenu(MENU_ADD).onClick({ items: [itemById("tok-3")] }, "x");
  await sleep(160);
  const st3 = I.normalizeInitiative(roomMeta[KEY_INITIATIVE]);
  const e3 = st3.entries.filter((e) => e.tokenId === "tok-3")[0];
  if (e3 && e3.bonus === 0 && e3.d20 >= 1 && e3.d20 <= 20 && e3.init === e3.d20)
    ok("无绑定卡的 token 也能加入先攻：entries 里有它、bonus = 0（默认）");
  else bad("无绑定卡的 token 加不进去：" + JSON.stringify(st3));
  if (!notifications.slice(noteBefore10).some((n) => /加入先攻|没有|失败|错误/.test(n.msg)))
    ok("无卡加入不弹错误 / 提示（v1.7.8：成功类通知为 0）");
  else bad("无卡加入弹了通知：" + JSON.stringify(notifications.slice(noteBefore10)));
  items = items.filter((it) => it.id !== "tok-3");
  roomMeta[KEY_INITIATIVE] = null;
}

console.log("== 静态检查");
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
if (!man.action) man.action = { icon: "https://example.invalid/icon.svg", popover: "https://example.invalid/dice.html?v=2.4.34" };
if (man.name === "4eNEXT to owlbear" && man.version === "2.4.34") ok("manifest 名称 / 版本 = 4eNEXT to owlbear 2.4.34");
else bad("manifest 名称 / 版本不对：" + man.name + " " + man.version);
if (man.action && /^https:\/\//.test(man.action.popover) && /\/dice(?:-entry)?\.html(?:\?v=[0-9.]+)?$/.test(man.action.popover))
  ok("manifest.action = 骰子入口 launcher（dice-entry.html，绝对 URL）");
else bad("manifest.action 缺失 / 未指向 dice.html");

const panelHtml = fs.readFileSync(path.join(ROOT, "panel.html"), "utf8");
if (panelHtml.indexOf('data-tab="') < 0 && panelHtml.indexOf("tab-pane") < 0 && panelHtml.indexOf('class="tabs"') < 0)
  ok("panel.html 里没有 tab（v1.3.0 的三 tab 合并已拆掉）");
else bad("panel.html 里还有 tab / tab-pane");

const initHtml = fs.readFileSync(path.join(ROOT, "initiative.html"), "utf8");
const initPageSrc = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
const diceHtml = fs.readFileSync(path.join(ROOT, "dice.html"), "utf8");
const dicePageSrc = fs.readFileSync(path.join(ROOT, "assets", "dice-page.js"), "utf8");
if (initHtml.indexOf('class="win"') >= 0 && initHtml.indexOf('id="head"') >= 0 && initHtml.indexOf('id="pin"') >= 0)
  ok("initiative.html 是独立窗口（.win + 拖动区 #head + ⌖ #pin）");
else bad("initiative.html 不是独立窗口（缺 .win / #head / #pin）");
if (diceHtml.indexOf('class="win"') >= 0 && diceHtml.indexOf('id="diceRow"') >= 0 && diceHtml.indexOf('id="result"') >= 0 &&
  diceHtml.indexOf("即将推出") < 0)
  ok("dice.html 是独立窗口（v1.7.0：单列 / 骰子行 / 本次结果，记录在独立窗口）");
else bad("dice.html 不是独立窗口 / 还是占位文案");
if (/createWindow\(\{ name: "initiative"/.test(initPageSrc) && /createWindow\(\{ name: "dice"/.test(dicePageSrc))
  ok("先攻 / 骰子各自 createWindow（拖动 + 后台检测共用 window.js）");
else bad("先攻 / 骰子没有各自 createWindow");
if (/ID_INIT_WIN/.test(initPageSrc) && /ID_DICE_WIN/.test(dicePageSrc))
  ok("先攻 / 骰子各自关闭自己的 popover id");
else bad("先攻 / 骰子的 popover id 用错了");

/* v1.8.0：写房间改「串行队列」——快速连点「下一回合」不再被 busy 静默丢掉一次。
 * 页面不在 Node 里执行（依赖完整 DOM / OBR），这里按源码口径钉住三件事：
 *   ① 没有「busy 时直接 return」；
 *   ② 每次请求都入队，队列逐个消费（一次只写一个）；
 *   ③ next / prev 传的是**函数**（轮到执行时才基于刚写回的 state 计算）→ 连点 N 次推进 N 次。 */
if (!/if \(busy\) return;/.test(initPageSrc) &&
  /const saveQueue = \[\];/.test(initPageSrc) &&
  /saveQueue\.push\(\{ job: next, done: resolve \}\)/.test(initPageSrc) &&
  /while \(saveQueue\.length\)/.test(initPageSrc) &&
  /typeof item\.job === "function" \? item\.job\(initiative\) : item\.job/.test(initPageSrc))
  ok("先攻写入 = 串行队列（不再 busy 时静默丢点击；每次请求都排队、写完再跑下一次）");
else bad("先攻写入还不是串行队列（快速连点「下一回合」仍可能少推进一次）");
if (initPageSrc.indexOf('act === "next") return saveInit(function (st) { return advanceInitiative(st, 1); }') >= 0 &&
  initPageSrc.indexOf('act === "prev") return saveInit(function (st) { return advanceInitiative(st, -1); }') >= 0)
  ok("「下一回合 / 上一回合」把推进函数交给队列：执行时才基于最新 state（连点 3 次 → 推进 3 次，不丢）");
else bad("next / prev 仍把提前算好的旧 state 交给 saveInit（连点会少推进）");
if (initPageSrc.indexOf('超过 " + INIT_MAX_ENTRIES + " 条') >= 0 && initPageSrc.indexOf("超过 60 条") < 0)
  ok("先攻上限文案跟 INIT_MAX_ENTRIES（40）一致，不再写死 60");
else bad("先攻上限文案还是写死 60 / 没跟 INIT_MAX_ENTRIES");

/* v1.8.2：①点先攻条卡片不再弹速览（先广播抑制频道再 select；后台 refreshInfo 早退）。
 *         ②大号数字可手填 d20（commitD20 → setEntryRoll，保持加值、合计自动 = d20 + 加值）。 */
if (initPageSrc.indexOf("CH_GLANCE_SUPPRESS") >= 0 &&
  initPageSrc.indexOf("sendMessage(CH_GLANCE_SUPPRESS") >= 0 &&
  initPageSrc.indexOf("sendMessage(CH_GLANCE_SUPPRESS") < initPageSrc.indexOf("OBR.player.select"))
  ok("点先攻条卡片：先广播 CH_GLANCE_SUPPRESS 再 OBR.player.select（地图高亮保留、不再弹速览）");
else bad("点卡片没有先广播 CH_GLANCE_SUPPRESS / 顺序不对（速览还是会弹）");
/* v2.4.34：动态顺序断言 —— 抑制广播的 promise resolve 之前，player.select 绝不能被调用。 */
{
  const start = initPageSrc.indexOf("async function onCardClick(tokenId) {");
  const end = initPageSrc.indexOf("\n\n/** 玩家「结束我的回合」", start);
  if (start < 0 || end < 0) bad("v2.4.34：抽不出 onCardClick()（页面结构变了）");
  else {
    const snippet = initPageSrc.slice(start, end);
    const order = [];
    let release = null;
    const fakeOBR = {
      broadcast: {
        sendMessage() {
          order.push("send");
          return new Promise(function (resolve) { release = resolve; });
        }
      },
      player: {
        select() { order.push("select"); return Promise.resolve(); }
      }
    };
    const fn = new Function("OBR", "CH_GLANCE_SUPPRESS", "suppressClick", "myRole", "initiative",
      "saveInit", "nameOf", "setActiveEntry", snippet + "\nreturn onCardClick;");
    const onCardClick = fn(fakeOBR, "ch", false, "PLAYER", { phase: "idle" },
      async function () {}, function () { return ""; }, function () {});
    const pending = onCardClick("tok-1");
    await new Promise(function (r) { setTimeout(r, 40); });
    const before = order.join(",");
    if (release) release();
    await pending;
    if (before === "send" && order.join(",") === "send,select")
      ok("v2.4.34：先 await 抑制广播送达，再 player.select（旧写法会在广播 resolve 前就 select → 偶发弹速览）");
    else bad("v2.4.34：抑制广播未 await 就 select（顺序 " + before + " → " + order.join(",") + "）");
  }
}

if (CORE.indexOf('var CH_GLANCE_SUPPRESS = NS + "/glance-suppress";') >= 0 &&
  CORE.indexOf("var suppressGlanceUntil = 0;") >= 0 &&
  CORE.indexOf("Date.now() < suppressGlanceUntil") >= 0 &&
  CORE.indexOf("onMessage(CH_GLANCE_SUPPRESS") >= 0)
  ok("后台：CH_GLANCE_SUPPRESS 常量 + suppressGlanceUntil + refreshInfo 早退 + 频道订阅都在");
else bad("后台没有接 CH_GLANCE_SUPPRESS（抑制速览不会生效）");
if (initPageSrc.indexOf("async function commitD20(") >= 0 &&
  initPageSrc.indexOf("[data-init-d20]") >= 0 &&
  initPageSrc.indexOf("setEntryRoll(st, tokenId, d20)") >= 0 &&
  initPageSrc.indexOf("d20Committed") >= 0)
  ok("页面：commitD20 手填 d20（保持加值 → 合计 = d20 + 加值 → setEntryRoll），回车 / 失焦都接");
else bad("页面没有 commitD20 / 没接 [data-init-d20] 监听");

/* 窗口模式：不重复大标题，但操作按钮和「结束我的回合」的 data-bg 标记都在 */
const winGmHtml = I.renderInitiativeHTML(hiddenState, { role: "GM", playerId: "user-gm", backgroundReady: true, inWindow: true });
if (winGmHtml.indexOf('class="init-title"') < 0 && winGmHtml.indexOf('data-init-act="next"') >= 0)
  ok("inWindow 模式不再渲染重复的「先攻」大标题，操作按钮仍在");
else bad("inWindow 模式渲染不对");
const playerWinHtml = I.renderInitiativeHTML(hiddenState, { role: "PLAYER", playerId: "p2", backgroundReady: false, backgroundState: "bad", inWindow: true });
if (playerWinHtml.indexOf("data-bg data-init-act=\"end\"") >= 0)
  ok("玩家的「结束我的回合」带 data-bg（后台离线时会被真正禁用）");
else bad("「结束我的回合」没有标 data-bg（后台离线时不会被禁用）");
if (winGmHtml.indexOf("data-bg-soft") >= 0) ok("GM 的回合按钮带 data-bg-soft（后台离线只弱化外观）");
else bad("GM 的回合按钮没有标 data-bg-soft");

/* ---- v2.4.34：房间 16KB 治理 / 先攻真源 ---- */
{
  const coreSrc = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (api.roomWriteGuarded && api.roomAuditLog && coreSrc.indexOf("room meta total=") >= 0 &&
    coreSrc.indexOf("other=") >= 0 && coreSrc.indexOf("top=") >= 0 && coreSrc.indexOf("ROOM_WRITE_LIMIT = 15500") >= 0 && coreSrc.indexOf("TextEncoder") >= 0)
    ok("v2.4.34：房间写入按整包 + UTF-8 字节计算（16KB-512），体检含 ours/other/top");
  else bad("v2.4.34：整包预算 / 体检日志缺失");
  if (!api.roomWriteGuarded) bad("v2.4.34：roomWriteGuarded 未暴露");
  else {
    roomMeta = { [KEY_CARDS]: { v: 1, cards: [] }, ["com.other-plugin/blob"]: { blob: "x".repeat(20 * 1024) } };
    const res = await api.roomWriteGuarded(KEY_INITIATIVE, I.normalizeInitiative(null));
    if (res.ok && res.store === "scene" && res.other > 15 * 1024 && sceneMeta[KEY_INITIATIVE])
      ok("v2.4.34：其它插件占满整包时本插件改写场景，并回报 ours/other");
    else bad("v2.4.34：整包超限未回退场景：" + JSON.stringify({ ok: res.ok, store: res.store, other: res.other }));
    roomMeta = { [KEY_ROLLS]: { v: 1, seq: 1, rows: [{ x: "r".repeat(100) }] }, ["com.other-plugin/blob"]: { blob: "x".repeat(16 * 1024) } };
    const big = api.initNorm({ entries: [{ tokenId: "t1", name: "名字".repeat(10), init: 1, bonus: 0 }] });
    const res2 = await api.roomWriteGuarded(KEY_INITIATIVE, big);
    if (res2.ok && res2.store === "scene" && sceneMeta[KEY_INITIATIVE])
      ok("v2.4.34：接近/超过上限时改写场景 metadata（不再挤房间）");
    else bad("v2.4.34：超限未回退场景：" + JSON.stringify({ ok: res2.ok, reason: res2.reason, store: res2.store }));
  }
  const initAddSrc = coreSrc.slice(coreSrc.indexOf("async function initAdd"), coreSrc.indexOf("function initRemove"));
  if (initAddSrc.indexOf('persisted: !next.local') >= 0 && coreSrc.indexOf("if (!res.persisted)") >= 0 &&
    coreSrc.indexOf("await syncInitFlags();") >= 0)
    ok("v2.4.34：先攻以房间状态为真源，写失败不打 token 标记");
  else bad("v2.4.34：initAdd 失败仍可能打 token 标记");
  if (coreSrc.indexOf("房间先攻 entries 是唯一真源") >= 0 &&
    coreSrc.indexOf("function initWantIds") >= 0 &&
    coreSrc.slice(coreSrc.indexOf("function initWantIds"), coreSrc.indexOf("async function syncInitFlags")).indexOf("Array.isArray(ids)") < 0)
    ok("v2.4.34：syncInitFlags 只按房间 entries 反推，忽略调用方临时 ids");
  else bad("v2.4.34：syncInitFlags 仍可能被临时 ids 污染");
  if (coreSrc.indexOf("房间数据已满（本插件 ") >= 0 && coreSrc.indexOf("其它插件 ") >= 0)
    ok("v2.4.34：写满通知含本插件 / 其它插件占用");
  else bad("v2.4.34：写满通知文案缺失");
}

/* ---- v2.4.34 场景兜底 / updatedAt 取新 ---- */
{
  if (!api.initRead || !api.roomWriteGuarded) bad("v2.4.34：initRead/roomWriteGuarded 未暴露");
  else {
    const st = I.normalizeInitiative({ updatedAt: 5, entries: [{ tokenId: "t1", name: "A", init: 5, bonus: 0 }] });
    roomMeta = { ["com.other-plugin/blob"]: { blob: "x".repeat(20 * 1024) } };
    sceneMeta = {};
    const res = await api.roomWriteGuarded(KEY_INITIATIVE, st);
    if (res.ok && res.store === "scene" && sceneMeta[KEY_INITIATIVE] && !roomMeta[KEY_INITIATIVE])
      ok("v2.4.34：整包 >15500B → 写场景 metadata 而非房间");
    else bad("v2.4.34：整包超限未回退场景：" + JSON.stringify({ ok: res.ok, store: res.store }));
    /* 房间抛 quota → 回退场景 */
    roomMeta = {}; sceneMeta = {};
    const oldSet = OBR.room.setMetadata;
    OBR.room.setMetadata = async () => { const e = new Error("Unable to update metadata: over size limit of 16 kB"); throw e; };
    const res2 = await api.roomWriteGuarded(KEY_INITIATIVE, st);
    OBR.room.setMetadata = oldSet;
    if (res2.ok && res2.store === "scene" && sceneMeta[KEY_INITIATIVE])
      ok("v2.4.34：房间 quota 报错 → 回退场景 metadata");
    else bad("v2.4.34：quota 未回退场景：" + JSON.stringify({ ok: res2.ok, store: res2.store }));
    /* 场景也失败 → local 兜底 */
    roomMeta = {}; sceneMeta = {};
    const oldSetR = OBR.room.setMetadata;
    const oldSetS = OBR.scene.setMetadata;
    OBR.room.setMetadata = async () => { throw new Error("quota exceeded"); };
    OBR.scene.setMetadata = async () => { throw new Error("metadata size limit"); };
    const res3 = await api.roomWriteGuarded(KEY_INITIATIVE, st);
    OBR.room.setMetadata = oldSetR; OBR.scene.setMetadata = oldSetS;
    if (!res3.ok && res3.store === "local" && res3.reason === "full")
      ok("v2.4.34：场景也失败 → 返回 local（调用方本机兜底 + 通知）");
    else bad("v2.4.34：场景失败未降级 local：" + JSON.stringify({ ok: res3.ok, store: res3.store }));
    /* updatedAt 取较新：room 旧 / scene 新 */
    roomMeta = { [KEY_INITIATIVE]: { updatedAt: 10, entries: [{ tokenId: "room", name: "旧", init: 1, bonus: 0 }] } };
    sceneMeta = { [KEY_INITIATIVE]: { updatedAt: 20, entries: [{ tokenId: "scene", name: "新", init: 2, bonus: 0 }] } };
    const read = await api.initRead();
    if (read.entries.length === 1 && read.entries[0].tokenId === "scene")
      ok("v2.4.34：initRead 读取 scene/room 中 updatedAt 较新者");
    else bad("v2.4.34：initRead 未取较新：" + JSON.stringify(read.entries));
    if (fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8").indexOf("room bytes total=") >= 0)
      ok("v2.4.34：写前日志 room bytes total=… key=… → room|scene|local");
    else bad("v2.4.34：缺少 room bytes 日志");
  }
}

/* ---- v2.4.34 场景兜底读取 / 订阅 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const initJs = fs.readFileSync(path.join(ROOT, "assets", "initiative.js"), "utf8");
  const initPage = fs.readFileSync(path.join(ROOT, "assets", "initiative-page.js"), "utf8");
  if (bg.indexOf("OBR.scene.getMetadata") >= 0 && bg.indexOf("scene.onMetadataChange（场景兜底存储）") >= 0 &&
    initJs.indexOf("OBR.scene.getMetadata") >= 0 && initPage.indexOf("OBR.scene.onMetadataChange") >= 0)
    ok("v2.4.34：先攻读取 scene+room 取新，并订阅 scene.onMetadataChange");
  else bad("v2.4.34：先攻场景兜底读取/订阅缺失");
  if (api.initRead) {
    roomMeta = { [KEY_INITIATIVE]: { updatedAt: 10, entries: [{ tokenId: "room", name: "旧", init: 1, bonus: 0 }] } };
    sceneMeta = { [KEY_INITIATIVE]: { updatedAt: 20, entries: [{ tokenId: "scene", name: "新", init: 2, bonus: 0 }] } };
    const st = await api.initRead();
    if (st.entries[0] && st.entries[0].tokenId === "scene") ok("v2.4.34：先攻 room 旧 / scene 新 → 读 scene");
    else bad("v2.4.34：先攻双源取新失败");
    sceneMeta = { [KEY_INITIATIVE]: { updatedAt: 5, entries: [{ tokenId: "scene", name: "旧", init: 1, bonus: 0 }] } };
    roomMeta = { [KEY_INITIATIVE]: { updatedAt: 30, entries: [{ tokenId: "room", name: "新", init: 2, bonus: 0 }] } };
    const st2 = await api.initRead();
    if (st2.entries[0] && st2.entries[0].tokenId === "room") ok("v2.4.34：scene 旧 / room 新 → 读 room");
    else bad("v2.4.34：先攻 room 新时未读 room");
  }
}

/* ---- v2.4.34：init 并发写保护 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (bg.indexOf("init write conflict") >= 0 && bg.indexOf("其他人刚修改先攻，已刷新") >= 0)
    ok("v2.4.34：先攻写前比较 updatedAt，冲突重读并提示");
  else bad("v2.4.34：先攻并发保护缺失");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);