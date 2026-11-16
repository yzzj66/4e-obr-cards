// v1.8.0：角色卡存储「房间数据 → 场景隐藏 item → 本机」三级回退自测。
// ---------------------------------------------------------------------------
// v1.7.15 的行为是「房间装不下 → 直接降级本机」，代价是**只有城主那台机器看得到卡**。
// v1.8.0 改成三级回退：
//   ① 房间数据（room metadata，全桌共享、换场景还在）—— 预算内首选；
//   ② 当前场景的**隐藏 item**（assets/cards-scene.js，全桌可见、没有 16 KB 总限额）
//      —— 房间 16 KB 装不下时走这一级，scope = "scene"，**不弹 ERROR**；
//   ③ 本机 localStorage（4enext/cards-local）—— 场景也写不进（玩家身份 / 场景未就绪）
//      时的最后兜底，scope = "local"，**弹 ERROR**（不允许静默）。
//
// 这个文件断言的就是上面三级 + 契约：
//   ① 精简：packCard 只留渲染字段（单卡 ≤ 2 KB，示例卡实测打印）；
//   ② 房间路径：预算内写房间，顺手清掉场景兜底副本与本机副本；
//   ③ 超限路径：40 条骰子历史 + 6 张大卡 → 写场景 item，房间数据一字未动、不弹 ERROR；
//      场景 item 必须 visible=false / locked=true / disableHit=true，metadata 只挂 {v:1, card}；
//      读回来 6 张，renderGlanceHTML 与原始卡逐字节一致；
//   ④ 场景也失败 → 降级到本机 + ERROR（不静默）；
//   ⑤ 清理：clearRoomCards 同时清房间 / 场景 / 本机。
//
// 另外钉死「精简化不能改数值」：pack → unpack 之后 deriveGlance / renderGlanceHTML /
// cardMeta / initiativeBonus 与原始 Character **逐字节一致**。
//
// 用法：node dev/test-cards.mjs（dev/check.mjs 会 spawn 它，所以 selftest 仍是 5 条命令）
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------------------------------------------------------------------
 * 假 localStorage / room metadata / scene items
 * ------------------------------------------------------------------------- */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

let roomMeta = {};
let roomFail = false;

/* 场景 item：深拷贝存取（模拟真实 SDK 的 item 快照）。
 * sceneFail = true 时所有 scene.items.* 都抛错 —— 模拟「玩家身份 / 场景未就绪 / 没权限」。 */
let sceneStore = [];
let sceneFail = false;
let sceneSeq = 0;
const nextSceneId = () => "scene-card-" + (++sceneSeq);
function resetScene() {
  sceneStore = [];
  sceneFail = false;
  sceneSeq = 0;
}
const sceneApi = {
  async getItems(arg) {
    if (sceneFail) throw new Error("scene items: permission denied");
    let list = sceneStore.map(clone);
    if (typeof arg === "function") list = list.filter(arg);
    else if (Array.isArray(arg)) {
      const ids = new Set(arg.map(String));
      list = list.filter((it) => ids.has(it.id));
    }
    return list;
  },
  async addItems(items) {
    if (sceneFail) throw new Error("scene items: permission denied");
    const added = [];
    for (const src of items || []) {
      const it = clone(src);
      if (!it.id) it.id = nextSceneId();
      sceneStore.push(it);
      added.push(clone(it));
    }
    return added;
  },
  async updateItems(ids, cb) {
    if (sceneFail) throw new Error("scene items: permission denied");
    const want = new Set((ids || []).map(String));
    const drafts = sceneStore.filter((it) => want.has(it.id)).map(clone);
    const ret = typeof cb === "function" ? cb(drafts) : undefined;
    for (const d of drafts) {
      const idx = sceneStore.findIndex((it) => it.id === d.id);
      if (idx >= 0) sceneStore[idx] = clone(d);
    }
    return ret;
  },
  async deleteItems(ids) {
    if (sceneFail) throw new Error("scene items: permission denied");
    const want = new Set((ids || []).map(String));
    sceneStore = sceneStore.filter((it) => !want.has(it.id));
  }
};

const notes = [];
const OBR = {
  isAvailable: true,
  isReady: true,
  notification: { show(msg, variant) { notes.push({ msg, variant }); return Promise.resolve("id"); }, close() {} },
  room: {
    getMetadata: async () => clone(roomMeta),
    setMetadata: async (patch) => {
      if (roomFail) throw new Error("Unable to update metadata: over size limit of 16 kB");
      for (const k of Object.keys(patch)) roomMeta[k] = clone(patch[k]);
    }
  },
  scene: { items: sceneApi }
};
globalThis.__OBR__ = OBR;

/* ---------------------------------------------------------------------------
 * 把真模块拷到临时目录（assets/*.js 没有 package.json，node 会当 CJS 解析）
 *   · common.js / cards-scene.js 的**静态** import 换成 obr-stub；
 *   · cards-scene.js 里还有一句**动态** import("../vendor/obr-sdk.js") 取 buildText，
 *     所以临时目录里要放一份 vendor 桩（只实现 buildText 链式三件套用到的 7 个方法）。
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-cards-test");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.mkdirSync(path.join(tmp, "vendor"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
fs.writeFileSync(path.join(tmp, "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
fs.writeFileSync(path.join(tmp, "vendor", "obr-sdk.js"), [
  "// 自测桩：只实现 cards-scene.js 动态 import 用到的 buildText()。",
  "let seq = 0;",
  "export function buildText() {",
  '  const item = { plainText: "", position: { x: 0, y: 0 }, visible: true, locked: false, disableHit: false, name: "", metadata: {} };',
  "  const api = {",
  "    plainText(v) { item.plainText = v; return api; },",
  "    position(v) { item.position = v; return api; },",
  "    visible(v) { item.visible = v; return api; },",
  "    locked(v) { item.locked = v; return api; },",
  "    disableHit(v) { item.disableHit = v; return api; },",
  "    name(v) { item.name = v; return api; },",
  "    metadata(v) { item.metadata = v; return api; },",
  '    build() { item.id = "built-" + (++seq); return item; }',
  "  };",
  "  return api;",
  "}",
  "export default globalThis.__OBR__;",
  ""
].join("\n"), "utf8");
fs.copyFileSync(path.join(ROOT, "data", "rules.js"), path.join(tmp, "data", "rules.js"));
for (const f of ["cards-core.js", "glance.js"]) {
  fs.copyFileSync(path.join(ROOT, "assets", f), path.join(tmp, "assets", f));
}
let sceneSrc = fs.readFileSync(path.join(ROOT, "assets", "cards-scene.js"), "utf8");
sceneSrc = sceneSrc.replace('from "../vendor/obr-sdk.js"', 'from "../obr-stub.mjs"');
fs.writeFileSync(path.join(tmp, "assets", "cards-scene.js"), sceneSrc, "utf8");
let commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
commonSrc = commonSrc.replace('from "../vendor/obr-sdk.js"', 'from "../obr-stub.mjs"');
fs.writeFileSync(path.join(tmp, "assets", "common.js"), commonSrc, "utf8");

const CC = await import(pathToFileURL(path.join(tmp, "assets", "cards-core.js")).href);
const S = await import(pathToFileURL(path.join(tmp, "assets", "cards-scene.js")).href);
const G = await import(pathToFileURL(path.join(tmp, "assets", "glance.js")).href);
const C = await import(pathToFileURL(path.join(tmp, "assets", "common.js")).href);

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-card.json"), "utf8"));
const CHAR = sample.pages && sample.pages.character ? sample.pages.character : sample.character;
const utf8 = (s) => Buffer.byteLength(String(s), "utf8");
const KEY_CARD_ITEM = S.CARD_ITEM_KEY;
const CARD = (id, char, name) => ({
  id: id, name: name || char.name, level: char.level, char: char, importedAt: 1, exportedAt: ""
});

/* 场景里塞一张卡 item（模拟 v1.8.0 之前 / 其它客户端写下的兜底副本）。 */
function seedSceneCard(id, name) {
  sceneStore.push({
    id: nextSceneId(),
    name: "4E卡：" + name,
    visible: false,
    locked: true,
    disableHit: true,
    metadata: {
      [KEY_CARD_ITEM]: {
        v: 1,
        card: { id: id, name: name, level: 1, char: CC.packCard(CHAR), importedAt: 1, exportedAt: "", updatedAt: 1 }
      }
    }
  });
}

/* ---------------------------------------------------------------------------
 * 1. 精简前 vs 精简后（用 samples/sample-card.json 实测）
 * ------------------------------------------------------------------------- */
console.log("== 1 角色卡精简：完整卡 vs 精简后（samples/sample-card.json）");
const fullJson = JSON.stringify(CHAR);
const wire = CC.packCard(CHAR);
const wireJson = JSON.stringify(wire);
const fullBytes = utf8(fullJson);
const wireBytes = utf8(wireJson);
console.log("     完整 pages.character：" + fullJson.length + " 字符 / " + fullBytes + " 字节");
console.log("     精简后（存房间 / 场景 item）：" + wireJson.length + " 字符 / " + wireBytes + " 字节（" +
  (100 - Math.round((wireBytes / fullBytes) * 100)) + "% 更小）");
if (wireBytes < fullBytes / 2) ok("精简后不到完整卡的一半（" + wireBytes + " / " + fullBytes + " 字节）");
else bad("精简幅度不够：" + wireBytes + " vs " + fullBytes);
if (CC.cardBytes(CHAR) <= CC.CARD_MAX_BYTES) ok("单张卡 ≤ 2 KB（" + CC.cardBytes(CHAR) + " 字符 ≤ " + CC.CARD_MAX_BYTES + "）");
else bad("单张卡超 2 KB：" + CC.cardBytes(CHAR) + " > " + CC.CARD_MAX_BYTES);

const wireKeys = Object.keys(wire);
const forbidden = ["spellbook", "backpack", "creation", "portraitCropped", "portraitOriginal", "xp", "gender", "alignment"];
const hit = forbidden.filter((k) => wireKeys.indexOf(k) >= 0);
if (!hit.length) ok("不存非渲染字段（立绘 / spellbook / backpack / creation / xp / 性别 / 阵营都不在）");
else bad("精简格式里还有非渲染字段：" + hit.join(" / "));
if (wireKeys.indexOf("ps") >= 0 && wireKeys.indexOf("fs") >= 0 && wireKeys.indexOf("es") >= 0 &&
  wireKeys.indexOf("ab") >= 0 && wireKeys.indexOf("dm") >= 0)
  ok("保留了速览要用的：属性 / 四防 / 威能列表 / 专长 / 装备");
else bad("精简格式缺渲染字段：" + wireKeys.join(","));

/* ---------------------------------------------------------------------------
 * 2. 精简化不改数值：pack → unpack 后推导 / 渲染逐字节一致
 * ------------------------------------------------------------------------- */
console.log("== 2 pack → unpack 往返：速览数值与 HTML 必须一字不差");
const back = CC.unpackCard(wire);
if (eq(G.deriveGlance(CHAR), G.deriveGlance(back))) ok("deriveGlance（生命 / 四防 / 技能 / 命中 / 先攻…）完全一致");
else bad("deriveGlance 变了：精简格式丢了渲染要用的字段");
const htmlA = G.renderGlanceHTML(CHAR, { live: { state: null }, editable: { track: true } });
const htmlB = G.renderGlanceHTML(back, { live: { state: null }, editable: { track: true } });
if (htmlA === htmlB) ok("renderGlanceHTML 输出逐字节一致（含每个 [data-act] 按钮）");
else bad("渲染 HTML 变了（" + htmlA.length + " vs " + htmlB.length + " 字节）");
if (eq(G.cardMeta(CHAR), G.cardMeta(back))) ok("cardMeta（列表行的 Lv / 种族 / HP）一致");
else bad("cardMeta 变了");
if (G.initiativeBonus(CHAR) === G.initiativeBonus(back)) ok("initiativeBonus 一致（先攻加值不变）");
else bad("先攻加值变了");
if (eq(CC.unpackCard(CC.packCard(back)), CC.unpackCard(wire))) ok("packCard 幂等（已经是精简格式不会再压一遍）");
else bad("packCard 不幂等");

/* ---------------------------------------------------------------------------
 * 3. 常量：14 KB 预算 / 16 KB 硬上限 / 场景卡片键
 * ------------------------------------------------------------------------- */
console.log("== 3 预算常量 + 场景卡片键（KEY_CARD_ITEM）");
if (CC.ROOM_MAX_BYTES === 14 * 1024 && CC.ROOM_HARD_BYTES === 16 * 1024)
  ok("房间数据预算 = 14 KB（" + CC.ROOM_MAX_BYTES + "），硬上限 = 16 KB");
else bad("预算常量不对：" + CC.ROOM_MAX_BYTES + " / " + CC.ROOM_HARD_BYTES);
const MSG = "房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史";
if (CC.ROOM_FULL_MESSAGE === MSG) ok("超限文案逐字一致：" + MSG);
else bad("超限文案不对：" + CC.ROOM_FULL_MESSAGE);
const coreSrc = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
if (coreSrc.indexOf('"房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史"') >= 0 &&
  /var ROOM_MAX_BYTES = 14 \* 1024;/.test(coreSrc) && /var ROOM_HARD_BYTES = 16 \* 1024;/.test(coreSrc))
  ok("background.core.js 的常量 / 文案与 cards-core.js 一字不差（经典脚本不能 import）");
else bad("background.core.js 的常量或文案对不上");
if (KEY_CARD_ITEM === "com.4enext-owlbear/card")
  ok("cards-scene.js 的 KEY_CARD_ITEM = " + KEY_CARD_ITEM);
else bad("cards-scene.js 的 KEY_CARD_ITEM 不对：" + KEY_CARD_ITEM);
if (coreSrc.indexOf('var KEY_CARD_ITEM = NS + "/card";') >= 0 && coreSrc.indexOf('var NS = "com.4enext-owlbear";') >= 0)
  ok("background.core.js 的 KEY_CARD_ITEM 与 cards-scene.js 逐字一致（都是 com.4enext-owlbear/card）");
else bad("background.core.js 没有同名的 KEY_CARD_ITEM（经典脚本不能 import，必须逐字一致）");

/* ---------------------------------------------------------------------------
 * 4. 双写：房间数据 = 精简名单副本（跨场景 / 玩家可见），场景 item = 完整数据
 * ------------------------------------------------------------------------- */
console.log("== 4 双写：房间放精简名单副本，场景 item 放完整卡");
roomMeta = {};
resetScene();
store[C.LS_CARDS] = JSON.stringify({ v: 1, cards: [CARD("c-old", CHAR)] }); /* 上一版留下的本机副本 */
seedSceneCard("c-old", "旧卡"); /* 上一版留下的场景兜底副本 */
let res = await C.writeCards([CARD("c-1", CHAR)]);
await sleep(20);
if (res.scope === "room" && roomMeta[C.KEY_CARDS] && roomMeta[C.KEY_CARDS].cards.length === 1)
  ok("writeCards → 房间名单副本（scope = room）");
else bad("没有写进房间数据：" + JSON.stringify(res));
if (roomMeta[C.KEY_CARDS].cards[0].char.pz === 1 && roomMeta[C.KEY_CARDS].cards[0].char.ps)
  ok("房间数据里存的是**精简格式**（char.pz = 1，带威能列表）—— 只做名单副本，不受 16KB 限制拖累");
else bad("房间数据里存的不是精简格式");
if (store[C.LS_CARDS] == null) ok("写成功之后清掉本机副本（不会三处各留一份）");
else bad("本机副本没有清掉");
/* 场景 item 是**完整数据**层：写完应当只剩新的 c-1（旧的 c-old 被删掉），而且是完整 Character。 */
const sceneC1 = sceneStore.filter((it) => {
  const b = it.metadata && it.metadata[KEY_CARD_ITEM];
  return b && b.card && b.card.id === "c-1";
})[0];
if (sceneStore.length === 1 && sceneC1)
  ok("场景里只留下新卡 c-1 的一张 item（旧卡 c-old 被清掉）");
else bad("场景副本没有按新列表收敛：" + sceneStore.length + " 个 item");
const sceneChar = sceneC1 && sceneC1.metadata[KEY_CARD_ITEM].card.char;
if (sceneChar && sceneChar.pz !== 1 && sceneChar.abilities && sceneChar.powerSlots)
  ok("场景 item 里存的是**完整 Character**（不跑 packCard 精简，字段一个不丢）");
else bad("场景 item 里不是完整卡：" + JSON.stringify(sceneChar && Object.keys(sceneChar || {})));
if (CC.roomBytes(roomMeta) <= CC.ROOM_MAX_BYTES) ok("房间数据体积 " + CC.roomBytes(roomMeta) + " ≤ " + CC.ROOM_MAX_BYTES);
else bad("房间数据已超预算：" + CC.roomBytes(roomMeta));
let info = await C.getCardsInfo();
if (info.scope === "room" && info.cards.length === 1 && info.cards[0].char.name === CHAR.name &&
  info.cards[0].char.powerSlots.encounter.length === 4)
  ok("getCardsInfo 读回来是完整 Character 形状（速览能直接渲染）");
else bad("读回来的卡片形状不对：" + JSON.stringify(info.cards.map((c) => Object.keys(c.char))));
if (G.renderGlanceHTML(info.cards[0].char, { live: { state: null }, editable: { track: true } }) === htmlA)
  ok("从房间数据读出来的卡渲染结果与原始卡一致");
else bad("读回来的卡渲染结果变了");

/* ---------------------------------------------------------------------------
 * 5. 房间超限：不写房间、不弹 ERROR，改存当前场景的隐藏 item（scope = scene）
 * ------------------------------------------------------------------------- */
console.log("== 5 超限：房间装不下 → 写场景 item（scope = scene，全桌可见，不弹 ERROR）");
/* 真机组合：房间数据里已经有 40 条骰子历史、而卡片键根本塞不下（或已被清理）——
 * 这里把 §4 写进房间的那 1 张卡删掉，模拟「房间留不住卡片列表」的真实状态。 */
delete roomMeta[C.KEY_CARDS];
/* 真机典型组合：40 条骰子历史 + 越来越多的大卡。 */
const rows = [];
for (let i = 0; i < 40; i++) {
  rows.push({
    v: 1, rollId: "r-" + i, ts: 1000 + i, rollerId: "u1", rollerName: "甲", rollerColor: "#5dade2",
    label: "攻击", expression: "1d20 + 12", mode: "attack",
    dice: [{ type: "d20", value: 10 }, { type: "d8", value: 5 }], modifier: 12, total: 22, crit: false
  });
}
roomMeta[C.ROOM_NS + "/rolls"] = { v: 1, updatedAt: 1, seq: 40, rows: rows };
const big = [];
for (let i = 0; i < 6; i++) big.push(CARD("c-big-" + i, CHAR));
const beforeRoom = JSON.stringify(roomMeta);
const beforeBytes = CC.roomBytes(roomMeta);
notes.length = 0;
res = await C.writeCards(big);
if (JSON.stringify(roomMeta) === beforeRoom)
  ok("超限时**不写**房间数据（原来那份一个字节都没动）");
else bad("超限时还是写了房间数据");
if (CC.roomBytes(roomMeta) === beforeBytes && beforeBytes <= CC.ROOM_MAX_BYTES)
  ok("导入大卡之后房间数据仍然 ≤ 14 KB（" + beforeBytes + " ≤ " + CC.ROOM_MAX_BYTES + "），没有为了塞卡去动房间");
else bad("导入大卡之后房间数据变了 / 超了：" + beforeBytes + " → " + CC.roomBytes(roomMeta));
if (!notes.some((n) => n.variant === "ERROR"))
  ok("房间装不下但场景写得进 → **不弹 ERROR**（这不是用户错误，旧版会误报「房间数据已满」）");
else bad("场景兜底成功却弹了 ERROR：" + JSON.stringify(notes));
if (res.scope === "scene") ok("writeCards 返回 scope = scene（全桌共享的场景 item，不是只存城主本机）");
else bad("超限后没有走场景兜底：" + JSON.stringify(res));
if (sceneStore.length === 6) ok("场景里有 6 个卡片 item");
else bad("场景 item 数量不对：" + sceneStore.length);
if (store[C.LS_CARDS] == null) ok("场景兜底成功时不再写本机副本（本机只做最后一道兜底）");
else bad("场景兜底成功却还是写了本机副本");

const item0 = sceneStore[0];
if (item0 && item0.visible === false && item0.locked === true && item0.disableHit === true)
  ok("场景 item 是 visible=false / locked=true / disableHit=true（玩家看不见、点不中、不会被拖动）");
else bad("场景 item 的可见性 / 锁定 / 命中开关不对：" +
  JSON.stringify({ visible: item0 && item0.visible, locked: item0 && item0.locked, disableHit: item0 && item0.disableHit }));
const metaKeys = item0 && item0.metadata ? Object.keys(item0.metadata) : [];
const box0 = item0 && item0.metadata ? item0.metadata[KEY_CARD_ITEM] : null;
if (metaKeys.length === 1 && metaKeys[0] === KEY_CARD_ITEM)
  ok("场景 item 的 metadata 只挂 " + KEY_CARD_ITEM + " 一个键（不塞别的元数据）");
else bad("场景 item 的 metadata 键不对：" + metaKeys.join(","));
if (box0 && box0.v === 1 && box0.card && box0.card.id === "c-big-0" && box0.card.char &&
  box0.card.char.pz !== 1 && box0.card.char.abilities && Object.keys(box0).length === 2)
  ok("场景 item 存的是 { v:1, card:{id,name,level,char(完整),…} }（完整 Character，不精简）");
else bad("场景 item 的 metadata 结构不对：" + JSON.stringify(box0 && Object.keys(box0)));
if (item0 && String(item0.name || "").indexOf("4E卡：") === 0)
  ok("场景 item 的显示名是「4E卡：<角色名>」（城主选中时看得懂）");
else bad("场景 item 的显示名不对：" + (item0 && item0.name));

info = await C.getCardsInfo();
if (info.scope === "scene") ok("getCardsInfo 从场景 item 读回卡片（scope = scene）");
else bad("没从场景 item 读回卡片：" + JSON.stringify({ scope: info.scope, n: info.cards.length }));
if (info.cards.length === 6) ok("场景里的 6 张卡全部读回");
else bad("读回的卡片数量不对：" + info.cards.length);
if (info.cards.length === 6 &&
  info.cards.every((c) => G.renderGlanceHTML(c.char, { live: { state: null }, editable: { track: true } }) === htmlA))
  ok("从场景 item 读出来的 6 张卡渲染结果与原始卡一致");
else bad("从场景 item 读出来的卡渲染结果变了");

/* ---------------------------------------------------------------------------
 * 6. 场景 item 的更新 / 删除：同名卡就地更新、删卡要删 item（不能留孤儿）
 * ------------------------------------------------------------------------- */
console.log("== 6 场景兜底也要跟得上增删（更新 / 删除不留孤儿 item）");
/* 这一节只测场景 item 的增删语义：强制房间写失败，确保两次写都走场景路径
 * （不强制的话「卡片变少后房间又装得下」会改走房间，测不到场景删除）。 */
roomFail = true;
res = await C.writeCards(big.map((c, i) => (i === 0 ? CARD("c-big-0", CHAR, "改名卡") : c)));
let renamed = sceneStore.filter((it) => {
  const b = it.metadata && it.metadata[KEY_CARD_ITEM];
  return b && b.card && b.card.id === "c-big-0";
})[0];
if (res.scope === "scene" && sceneStore.length === 6 && renamed && renamed.name === "4E卡：改名卡")
  ok("同名卡再写一次 → 就地更新同一个场景 item（不新增第 7 个）");
else bad("场景 item 更新不对：" + JSON.stringify({ scope: res.scope, n: sceneStore.length, name: renamed && renamed.name }));
res = await C.writeCards(big.slice(0, 2));
if (res.scope === "scene" && sceneStore.length === 2)
  ok("写入更短的列表 → 多出来的场景 item 被删掉（不留孤儿）");
else bad("场景 item 删除不对：" + JSON.stringify({ scope: res.scope, n: sceneStore.length }));
roomFail = false;

/* ---------------------------------------------------------------------------
 * 7. 场景也失败（玩家身份 / 场景未就绪）→ 降级到本机 + ERROR（不静默）
 * ------------------------------------------------------------------------- */
console.log("== 7 场景也写不进：降级到本机 + ERROR（不静默）");
roomMeta = {};
roomMeta[C.ROOM_NS + "/rolls"] = { v: 1, updatedAt: 1, seq: 40, rows: rows }; /* 房间仍被骰子历史撑爆 */
resetScene();
sceneFail = true;
delete store[C.LS_CARDS];
notes.length = 0;
const realConsoleError = console.error;
console.error = function () { /* 预期内的「写场景失败」日志，别刷屏 */ };
res = await C.writeCards(big);
console.error = realConsoleError;
sceneFail = false;
if (res.scope === "local" && res.saved === true)
  ok("场景也写不进 → 降级到本机（scope = local，saved = true）");
else bad("最后一道兜底没有落到本机：" + JSON.stringify(res));
if (roomMeta[C.KEY_CARDS] === undefined)
  ok("降级到本机时房间数据仍然没被写脏（卡片键不存在）");
else bad("降级到本机时房间数据被写了");
const errNotes = notes.filter((n) => n.variant === "ERROR" && n.msg === MSG);
if (errNotes.length === 1) ok("降级到本机时弹了且只弹一条 ERROR：" + MSG);
else bad("降级到本机没有弹 ERROR（静默失败）：" + JSON.stringify(notes));
let localBox = null;
try { localBox = JSON.parse(store[C.LS_CARDS] || "null"); } catch (e) { localBox = null; }
if (localBox && Array.isArray(localBox.cards) && localBox.cards.length === 6)
  ok("本机 localStorage[" + C.LS_CARDS + "] 里有 6 张卡");
else bad("本机副本不对：" + JSON.stringify(localBox && localBox.cards.length));
info = await C.getCardsInfo();
if (info.scope === "local" && info.cards.length === 6)
  ok("getCardsInfo 在三级都退化后从本机读到 6 张（UI 上标「角色卡：本机」）");
else bad("本机降级读不回来：" + JSON.stringify({ scope: info.scope, n: info.cards.length }));

/* ---------------------------------------------------------------------------
 * 8. OBR 自己拒写房间（权限 / 令牌）→ 仍然先试场景；场景也拒才落本机 + ERROR
 * ------------------------------------------------------------------------- */
console.log("== 8 OBR 拒写房间：先落场景；场景也拒才降级到本机 + ERROR");
roomMeta = {};
resetScene();
delete store[C.LS_CARDS];
roomFail = true;
notes.length = 0;
res = await C.writeCards([CARD("c-1", CHAR)]);
roomFail = false;
if (res.scope === "scene" && sceneStore.length === 1)
  ok("房间 setMetadata 抛错 → 自动改存场景 item（不再直接掉本机）");
else bad("房间拒写时没有先试场景：" + JSON.stringify({ scope: res.scope, n: sceneStore.length }));
if (!notes.some((n) => n.variant === "ERROR")) ok("房间拒写但场景成功 → 不弹 ERROR");
else bad("房间拒写 + 场景成功却弹了 ERROR：" + JSON.stringify(notes));

roomMeta = {};
resetScene();
delete store[C.LS_CARDS];
roomFail = true;
sceneFail = true;
notes.length = 0;
const realConsoleError2 = console.error;
console.error = function () { /* 预期内的「写场景失败」日志 */ };
res = await C.writeCards([CARD("c-1", CHAR)]);
console.error = realConsoleError2;
roomFail = false;
sceneFail = false;
if (res.scope === "local" && res.saved === true)
  ok("房间 + 场景都拒写 → 降级到本机（saved = true）");
else bad("房间 + 场景都拒写时没落本机：" + JSON.stringify(res));
if (notes.some((n) => n.variant === "ERROR" && /角色卡没能写进房间数据/.test(n.msg)))
  ok("房间 + 场景都拒写时弹 ERROR（不再静默）：" + notes.filter((n) => n.variant === "ERROR")[0].msg);
else bad("房间 + 场景都拒写时没有 ERROR 通知：" + JSON.stringify(notes));

/* ---------------------------------------------------------------------------
 * 9. 清理入口：设置窗口「清理房间数据」+ clearRoomCards 同时清三级
 * ------------------------------------------------------------------------- */
console.log("== 9 设置窗口：清理房间数据（清骰子历史 / 清角色卡；角色卡要清房间 / 场景 / 本机）");
const settingsHtml = fs.readFileSync(path.join(ROOT, "settings.html"), "utf8");
const settingsJs = fs.readFileSync(path.join(ROOT, "assets", "settings-page.js"), "utf8");
for (const id of ["room-usage", "room-refresh", "room-clean-rolls", "room-clean-cards", "room-clean-out"]) {
  if (settingsHtml.indexOf('id="' + id + '"') >= 0) ok("settings.html 有 #" + id);
  else bad("settings.html 缺少 #" + id);
}
if (/getRoomUsage/.test(settingsJs) && /clearRoomRolls/.test(settingsJs) && /clearRoomCards/.test(settingsJs))
  ok("settings-page.js 通过 common.js 的 getRoomUsage / clearRoomRolls / clearRoomCards 干活");
else bad("settings-page.js 没有接上清理入口");
if (!/setMetadata|updateItems|\.setItem\(/.test(settingsJs))
  ok("设置页本身仍然不直接写房间数据 / token 元数据 / localStorage（全走 common.js）");
else bad("设置页里出现了直接写房间数据 / token 元数据 / 本机存储的调用");

/* 9a. 用量：房间没有卡时，getRoomUsage 要能报出场景里的张数（本机残留副本不算重复） */
roomMeta = {};
roomMeta[C.ROOM_NS + "/rolls"] = { v: 1, updatedAt: 1, seq: 40, rows: rows };
/* v1.9.2：骰子历史改本机；用量里的 rows 读本机历史（房间 rolls 只算迁移残留）。 */
store[C.LS_DICE_HISTORY_PREFIX + "default"] = JSON.stringify({ v: 1, rows: rows });
roomMeta[C.ROOM_NS + "/initiative"] = { v: 1, updatedAt: 1, phase: "idle", round: 1, activeId: "",
  entries: [{ tokenId: "t1", name: "甲", bonus: 5, init: 20, d20: 15, tb: 0.5, hidden: false, ownerId: "u1", updatedAt: 1 }] };
resetScene();
delete store[C.LS_CARDS];
seedSceneCard("c-s1", "场景一");
seedSceneCard("c-s2", "场景二");
let usage0 = await C.getRoomUsage();
if (usage0.roomCards === 0 && usage0.sceneCards === 2 && usage0.cards === 2 && usage0.cardScope === "scene")
  ok("getRoomUsage 报出场景兜底：2 张（来源 = scene）");
else bad("getRoomUsage 没报场景兜底：" + JSON.stringify(usage0));
if (usage0.rows === 20 && usage0.entries === 1)
  ok("getRoomUsage 同时报出「" + usage0.rows + " 条骰子 / " + usage0.entries + " 条先攻」");
else bad("getRoomUsage 的骰子 / 先攻数字不对：" + JSON.stringify(usage0));

/* 9b. clearRoomCards：房间 + 场景 + 本机三处一起清 */
roomMeta[C.KEY_CARDS] = { v: 1, updatedAt: 2, cards: [CARD("c-room", CHAR)] };
store[C.LS_CARDS] = JSON.stringify({ v: 1, cards: [CARD("c-local", CHAR)] });
const sceneBefore = sceneStore.length;
let clean = await C.clearRoomCards();
let usage1 = await C.getRoomUsage();
if (clean.ok && roomMeta[C.KEY_CARDS].cards.length === 0)
  ok("清空角色卡：房间数据 1 → 0 张");
else bad("清空角色卡没清房间：" + JSON.stringify({ clean, roomCards: roomMeta[C.KEY_CARDS].cards.length }));
if (sceneBefore === 2 && sceneStore.length === 0) ok("清空角色卡同时清掉场景里的 2 个卡片 item");
else bad("清空角色卡没清场景：" + sceneBefore + " → " + sceneStore.length);
if (store[C.LS_CARDS] == null) ok("清空角色卡同时清掉本机副本");
else bad("清空角色卡没清本机副本");
if (usage1.cards === 0) ok("清理后 getRoomUsage 报 0 张卡");
else bad("清理后 getRoomUsage 还有卡：" + JSON.stringify(usage1));

/* 9c. clearRoomRolls：只减不增，体积必须掉下来 */
let usageBefore = await C.getRoomUsage();
clean = await C.clearRoomRolls();
let usageAfter = await C.getRoomUsage();
if (clean.ok && usageAfter.rows === 0 && usageAfter.bytes < usageBefore.bytes)
  ok("清骰子历史：本机 20 → 0 条，房间数据 " + usageBefore.bytes + " → " + usageAfter.bytes + " 字符");
else bad("清骰子历史没生效：" + JSON.stringify({ clean, rows: usageAfter.rows }));
if (usageAfter.bytes <= CC.ROOM_MAX_BYTES) ok("清理后房间数据 " + usageAfter.bytes + " 字符（≤ 14 KB）");
else bad("清理后仍然超预算：" + usageAfter.bytes);

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
