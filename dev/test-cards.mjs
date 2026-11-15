// v1.7.15：房间数据超限（room metadata 16 kB）的真 bug 修复自测。
// ---------------------------------------------------------------------------
// 真机根因：导入的 4E NEXT 角色卡 JSON **整份**塞进 room.metadata → 单张 4~50 KB，
// 整包超过 16 kB 之后**所有** room.setMetadata（加入先攻 / 改加值 / 回合推进 /
// 骰子历史 / 资源）全部被拒，而且静默无反馈。
//
// 这个文件断言的正是修复的三层：
//   ① 精简：packCard 只留速览渲染要用的字段，单张卡 ≤ 2 KB（示例卡实测打印出来）；
//   ② 体积预算：写房间数据前先算 JSON 长度，超过 14 KB **不写** + ERROR 通知；
//   ③ 降级：角色卡超限时改存本机 localStorage（4enext/cards-local），读回来照旧能渲染；
//      设置窗口里有「清理骰子历史 / 清空角色卡」两个按钮。
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

/* ---------------------------------------------------------------------------
 * 假 OBR / localStorage（common.js 只用到 room + notification）
 * ------------------------------------------------------------------------- */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
let roomMeta = {};
let roomFail = false;
const notes = [];
const OBR = {
  isAvailable: true,
  isReady: true,
  notification: { show(msg, variant) { notes.push({ msg, variant }); return Promise.resolve("id"); }, close() {} },
  room: {
    getMetadata: async () => JSON.parse(JSON.stringify(roomMeta)),
    setMetadata: async (patch) => {
      if (roomFail) throw new Error("Unable to update metadata: over size limit of 16 kB");
      for (const k of Object.keys(patch)) roomMeta[k] = JSON.parse(JSON.stringify(patch[k]));
    }
  }
};
globalThis.__OBR__ = OBR;

/* ---------------------------------------------------------------------------
 * 把真模块拷到临时目录（assets/*.js 没有 package.json，node 会当 CJS 解析）
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-cards-test");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
fs.writeFileSync(path.join(tmp, "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
fs.copyFileSync(path.join(ROOT, "data", "rules.js"), path.join(tmp, "data", "rules.js"));
for (const f of ["cards-core.js", "glance.js"]) {
  fs.copyFileSync(path.join(ROOT, "assets", f), path.join(tmp, "assets", f));
}
let commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
commonSrc = commonSrc.replace('from "../vendor/obr-sdk.js"', 'from "../obr-stub.mjs"');
fs.writeFileSync(path.join(tmp, "assets", "common.js"), commonSrc, "utf8");

const CC = await import(pathToFileURL(path.join(tmp, "assets", "cards-core.js")).href);
const G = await import(pathToFileURL(path.join(tmp, "assets", "glance.js")).href);
const C = await import(pathToFileURL(path.join(tmp, "assets", "common.js")).href);

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "samples", "sample-card.json"), "utf8"));
const CHAR = sample.pages && sample.pages.character ? sample.pages.character : sample.character;
const utf8 = (s) => Buffer.byteLength(String(s), "utf8");

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
console.log("     精简后（存房间数据）：" + wireJson.length + " 字符 / " + wireBytes + " 字节（" +
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
 * 3. 常量：14 KB 预算 / 16 KB 硬上限 / 报错文案
 * ------------------------------------------------------------------------- */
console.log("== 3 体积预算常量");
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

/* ---------------------------------------------------------------------------
 * 4. 写得进：房间数据在预算内 → 写房间 + 清本机副本
 * ------------------------------------------------------------------------- */
console.log("== 4 预算内：角色卡写进房间数据");
const CARD = (id, char) => ({ id: id, name: char.name, level: char.level, char: char, importedAt: 1, exportedAt: "" });
roomMeta = {};
store[C.LS_CARDS] = JSON.stringify({ v: 1, cards: [CARD("c-old", CHAR)] }); /* 上一版留下的本机副本 */
let res = await C.writeCards([CARD("c-1", CHAR)]);
if (res.scope === "room" && roomMeta[C.KEY_CARDS] && roomMeta[C.KEY_CARDS].cards.length === 1)
  ok("writeCards → 房间数据（scope = room）");
else bad("没有写进房间数据：" + JSON.stringify(res));
if (roomMeta[C.KEY_CARDS].cards[0].char.pz === 1 && roomMeta[C.KEY_CARDS].cards[0].char.ps)
  ok("房间数据里存的是**精简格式**（char.pz = 1，带威能列表），不是完整卡");
else bad("房间数据里存的不是精简格式");
if (store[C.LS_CARDS] == null) ok("写进房间之后清掉本机副本（不会两处各留一份）");
else bad("本机副本没有清掉");
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
 * 5. 写不进：大卡把房间数据撑爆 → 不写 + ERROR + 降级本机
 * ------------------------------------------------------------------------- */
console.log("== 5 超限：大卡不写房间数据 + ERROR 通知 + 降级本机");
/* 先把骰子历史放到 8 KB 左右（40 条），再导 6 张大卡 —— 这是真机上的典型组合。 */
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
const beforeBytes = CC.roomBytes(roomMeta);
const beforeCards = JSON.stringify(roomMeta[C.KEY_CARDS]);
notes.length = 0;
res = await C.writeCards(big);
if (JSON.stringify(roomMeta[C.KEY_CARDS]) === beforeCards)
  ok("超限时**不写**房间数据（原来那份一个字节都没动）");
else bad("超限时还是写了房间数据");
if (CC.roomBytes(roomMeta) === beforeBytes && CC.roomBytes(roomMeta) <= CC.ROOM_MAX_BYTES)
  ok("导入大卡之后房间数据仍然 ≤ 14 KB（" + CC.roomBytes(roomMeta) + " ≤ " + CC.ROOM_MAX_BYTES + "）");
else bad("导入大卡之后房间数据变了 / 超了：" + CC.roomBytes(roomMeta));
const fullNote = notes.filter((n) => n.variant === "ERROR" && n.msg === MSG);
if (fullNote.length === 1) ok("弹了且只弹一条 ERROR：" + MSG);
else bad("没有弹 ROOM_FULL_MESSAGE（ERROR）：" + JSON.stringify(notes));
if (res.scope === "local" && res.saved === true) ok("writeCards 返回 scope = local 且本机存下了（saved = true）");
else bad("没有降级到本机：" + JSON.stringify(res));
let localBox = null;
try { localBox = JSON.parse(store[C.LS_CARDS] || "null"); } catch (e) { localBox = null; }
if (localBox && Array.isArray(localBox.cards) && localBox.cards.length === 6)
  ok("本机 localStorage[" + C.LS_CARDS + "] 里有 6 张卡");
else bad("本机副本不对：" + JSON.stringify(localBox && localBox.cards.length));

info = await C.getCardsInfo();
if (info.scope === "local" && info.cards.length === 6)
  ok("getCardsInfo 从本机读到 6 张（UI 上标「角色卡：本机」）");
else bad("本机降级读不回来：" + JSON.stringify({ scope: info.scope, n: info.cards.length }));

/* 房间数据被别的东西撑满（卡片键根本不存在）时，写卡片同样要拒绝 */
delete roomMeta[C.KEY_CARDS];
roomMeta[C.ROOM_NS + "/initiative"] = { v: 1, updatedAt: 1, phase: "combat", round: 1, surprise: false, activeId: "t1",
  entries: Array.from({ length: 60 }, (_, i) => ({ tokenId: "t" + i, name: "第" + i + "个单位" + "名字占位占位", bonus: 5, init: 20, d20: 15, tb: 0.5, hidden: false, ownerId: "u1", updatedAt: 1 })) };
const overBytes = CC.roomBytes(roomMeta);
notes.length = 0;
res = await C.writeCards([CARD("c-1", CHAR)]);
if (overBytes > CC.ROOM_MAX_BYTES && res.scope === "local" && roomMeta[C.KEY_CARDS] === undefined)
  ok("房间已被先攻名单撑到 " + overBytes + " 字符：再写卡片仍然不写 + 降级本机");
else bad("房间已满时的分支不对：" + JSON.stringify({ overBytes, scope: res.scope, wrote: roomMeta[C.KEY_CARDS] !== undefined }));
if (notes.some((n) => n.variant === "ERROR" && n.msg === MSG)) ok("同样弹 ERROR 文案");
else bad("房间已满时没有弹 ERROR");

/* ---------------------------------------------------------------------------
 * 6. OBR 自己拒写（权限 / 16 kB）→ 也降级本机 + ERROR（不静默）
 * ------------------------------------------------------------------------- */
console.log("== 6 OBR 拒写：令牌 / 权限错误 → 降级本机 + ERROR");
roomMeta = {};
delete store[C.LS_CARDS];
roomFail = true;
notes.length = 0;
res = await C.writeCards([CARD("c-1", CHAR)]);
roomFail = false;
if (res.scope === "local" && res.saved === true) ok("写房间抛错 → 改存本机");
else bad("写房间抛错时没降级：" + JSON.stringify(res));
if (notes.some((n) => n.variant === "ERROR" && /角色卡没能写进房间数据/.test(n.msg)))
  ok("抛错时也弹 ERROR（不再静默）：" + notes.filter((n) => n.variant === "ERROR")[0].msg);
else bad("抛错时没有 ERROR 通知：" + JSON.stringify(notes));

/* ---------------------------------------------------------------------------
 * 7. 清理入口：设置窗口的「清理房间数据」
 * ------------------------------------------------------------------------- */
console.log("== 7 设置窗口：清理房间数据（清骰子历史 / 清角色卡）");
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

/* 真的要能清：60 条先攻 + 40 条骰子 + 卡片，清完体积必须掉下来 */
roomMeta = {};
roomMeta[C.ROOM_NS + "/rolls"] = { v: 1, updatedAt: 1, seq: 40, rows: rows };
roomMeta[C.KEY_CARDS] = { v: 1, updatedAt: 1, cards: [CARD("c-1", CHAR)] };
roomMeta[C.ROOM_NS + "/initiative"] = { v: 1, updatedAt: 1, phase: "idle", round: 1, activeId: "",
  entries: [{ tokenId: "t1", name: "甲", bonus: 5, init: 20, d20: 15, tb: 0.5, hidden: false, ownerId: "u1", updatedAt: 1 }] };
const usage0 = await C.getRoomUsage();
if (usage0.rows === 40 && usage0.cards === 1 && usage0.entries === 1)
  ok("getRoomUsage 报出「" + usage0.bytes + " 字符 / " + usage0.rows + " 条骰子 / " + usage0.cards + " 张卡 / " + usage0.entries + " 条先攻」");
else bad("getRoomUsage 数字不对：" + JSON.stringify(usage0));
let clean = await C.clearRoomRolls();
let usage1 = await C.getRoomUsage();
if (clean.ok && usage1.rows === 0 && usage1.bytes < usage0.bytes)
  ok("清骰子历史：40 → 0 条，房间数据 " + usage0.bytes + " → " + usage1.bytes + " 字符");
else bad("清骰子历史没生效：" + JSON.stringify({ clean, rows: usage1.rows }));
clean = await C.clearRoomCards();
let usage2 = await C.getRoomUsage();
if (clean.ok && usage2.cards === 0 && store[C.LS_CARDS] == null)
  ok("清角色卡：1 → 0 张，本机副本也一起清掉");
else bad("清角色卡没生效：" + JSON.stringify({ clean, cards: usage2.cards }));
if (usage2.bytes <= CC.ROOM_MAX_BYTES) ok("清理后房间数据 " + usage2.bytes + " 字符（≤ 14 KB）");
else bad("清理后仍然超预算：" + usage2.bytes);

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
