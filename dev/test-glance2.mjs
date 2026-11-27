// v1.8.1 速览对齐 4E NEXT 自测：node dev/test-glance2.mjs
// ---------------------------------------------------------------------------
// 目标（对应用户截图里的「初版完整速览 + 威能资源监控」）：
//   ① 威能 chip 带动作类型（标准动作 / 即时反应 / 移动动作 / 自由动作 …）≥10 处；
//   ② 专长「美德士兵」带「每日」标记（频率来自 data/card-index.js）；
//   ③ 装备行出现物品等级档位「L3 8 13 18 23 28」；
//   ④ 威能区出现「可用 18/18」总计数；
//   ⑤ 受伤 / 治疗按钮 → track.js 真的改 token 血量；
//   ⑥ 「使用回复力」→ 回复力 −1、HP 加（回复值 + 临时回复值）；
//   ⑦ 短休 → 清掉遭遇威能 / 遭遇专长的已用标记与临时加值，每日威能保留；
//   ⑧ 临时命中 / 临时防御 ±1 → 重新渲染后显示值 +1。
//
// 跑的是**真模块**：把 assets/{glance,track,common,cards-core,cards-scene}.js 与
// data/{rules,card-index}.js 拷到临时目录（保留原相对 import 结构），vendor/obr-sdk.js 换桩，
// fake OBR / localStorage 只实现 track.js 读写要用的那几个方法。
// 不依赖 4E NEXT 源码：角色卡用仓库内 dev/fixtures / samples/sample-card.json。
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const count = (html, re) => (html.match(re) || []).length;
const between = (html, start, end) => {
  const a = html.indexOf(start);
  if (a < 0) return "";
  const b = html.indexOf(end, a);
  return b < 0 ? html.slice(a) : html.slice(a, b);
};

/* ---------------------------------------------------------------------------
 * 0) 找角色卡（仓库内，不依赖 4E NEXT 源码）
 * ------------------------------------------------------------------------- */
const CARD_CANDIDATES = [
  path.join(ROOT, "dev", "fixtures", "4enext-lv30-ranger.json"),
  path.join(ROOT, "samples", "sample-card.json"),
  "D:\\deepseek\\refs\\samples\\sample-4enext-export.json"
];
const cardPath = CARD_CANDIDATES.filter((p) => fs.existsSync(p))[0] || "";
if (!cardPath) {
  console.log("  FAIL 找不到测试角色卡（dev/fixtures / samples/sample-card.json）");
  process.exit(1);
}
console.log("  info 角色卡：" + cardPath);
const save = JSON.parse(fs.readFileSync(cardPath, "utf8"));
const char = (save.pages && save.pages.character) || save.character || save;

/* ---------------------------------------------------------------------------
 * 1) 临时目录：真模块 + 桩（相对 import 保持原样，vendor 换成桩文件）
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-glance2-test");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
fs.mkdirSync(path.join(tmp, "vendor"), { recursive: true });
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
fs.writeFileSync(path.join(tmp, "vendor", "obr-sdk.js"), [
  "// 自测桩：只提供 cards-scene 动态 import 用的 buildText（本测试不建场景 item）",
  "export function buildText() { throw new Error('buildText 不在本测试里使用'); }",
  "export default globalThis.__OBR__;",
  ""
].join("\n"), "utf8");
for (const f of ["cards-core.js", "cards-scene.js", "common.js", "track.js", "glance.js", "hp-edit-core.js"]) {
  fs.copyFileSync(path.join(ROOT, "assets", f), path.join(tmp, "assets", f));
}
for (const f of ["rules.js", "card-index.js"]) {
  fs.copyFileSync(path.join(ROOT, "data", f), path.join(tmp, "data", f));
}

/* ---------------------------------------------------------------------------
 * 2) 假 OBR / localStorage（只实现 track.js / common.js 用到的部分）
 * ------------------------------------------------------------------------- */
const NS = "com.4enext-owlbear";
const KEY_HP = NS + "/hp";
const token = { id: "tok-1", type: "IMAGE", createdUserId: "user-gm", metadata: {} };
const roomMeta = {};
const localStore = {};
globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(localStore, k) ? localStore[k] : null),
  setItem: (k, v) => { localStore[k] = String(v); },
  removeItem: (k) => { delete localStore[k]; }
};
const notes = [];
let roleNow = "GM";
let idNow = "user-gm";
globalThis.__OBR__ = {
  isAvailable: true,
  notification: { show(msg, variant) { notes.push({ msg: msg, variant: variant }); return Promise.resolve("n"); } },
  player: {
    getRole: async () => roleNow,
    getId: async () => idNow
  },
  scene: {
    items: {
      getItems: async (ids) => (Array.isArray(ids) ? [token].filter((it) => ids.indexOf(it.id) >= 0) : [token]),
      updateItems: async (ids, fn) => { fn([token]); }
    }
  },
  room: {
    getMetadata: async () => roomMeta,
    setMetadata: async (update) => {
      for (const k of Object.keys(update || {})) roomMeta[k] = update[k];
    }
  }
};

const G = await import(pathToFileURL(path.join(tmp, "assets", "glance.js")).href);
const H = await import(pathToFileURL(path.join(tmp, "assets", "hp-edit-core.js")).href);
const T = await import(pathToFileURL(path.join(tmp, "assets", "track.js")).href);
const C = await import(pathToFileURL(path.join(tmp, "assets", "common.js")).href);

/* ---------------------------------------------------------------------------
 * 3) 卡索引：按需加载 + 内容抽查（v1.8.6 精简结构：{v,c,p}，只有使用频率/动作类型）
 * ------------------------------------------------------------------------- */
console.log("\n== A) 卡索引（data/card-index.js，懒加载）");
const index = await G.loadCardIndex();
const idxCombo = (id) => {
  if (!index || !index.c || !index.p) return null;
  const ci = index.p[id];
  return typeof ci === "number" ? index.c[ci] : null;
};
if (index && index.v === 1 && Array.isArray(index.c) && index.p) ok("loadCardIndex() 加载成功（" + Object.keys(index.p).length + " 个威能 / " + index.c.length + " 个频率+动作组合）");
else bad("card-index.js 没有加载出来 / 结构不是 {v,c,p}");
if (idxCombo("双重攻击 Twin Strike") && idxCombo("双重攻击 Twin Strike")[1] === "标准动作")
  ok("威能索引：双重攻击 → 动作 = 标准动作");
else bad("威能索引里没有双重攻击 / 动作类型不对");
if (idxCombo("迅雷箭 Lightning Shot") && idxCombo("迅雷箭 Lightning Shot")[1] === "即时反应")
  ok("威能索引：迅雷箭 → 动作 = 即时反应");
else bad("威能索引里迅雷箭的动作类型不对");
if (!Object.prototype.hasOwnProperty.call(index, "feats") && !Object.prototype.hasOwnProperty.call(index, "powers"))
  ok("索引只有 v/c/p（没有 powers 正文列、没有 feats 频率表）");
else bad("索引里还残留 powers 正文 / feats 字段");
if (!index.c.some((c) => /vs\.|\[W\]|伤害/.test(String(c[0]) + String(c[1]))))
  ok("组合表里没有攻击 / 命中正文（只剩使用频率与动作类型）");
else bad("索引里混进了攻击 / 命中正文");

/* ---------------------------------------------------------------------------
 * 4) 渲染：动作类型 / 可用总数 / 专长频率 / 装备等级 / 新控件
 * ------------------------------------------------------------------------- */
console.log("\n== B) 速览渲染（对齐 4E NEXT 截图）");
const baseHp = { cur: 171, max: 171, temp: 0, surges: 8, surgesMax: 8, locked: false, updatedAt: 1 };
token.metadata[KEY_HP] = Object.assign({}, baseHp);
const d0 = G.deriveGlance(char);
const baseState = Object.assign(T.defaultState(), { updatedAt: 1 });
/* v1.8.1：track.js 修了「读-改-写竞态」，本页会缓存刚写过的乐观状态并按 updatedAt 取新。
 * 测试里直接改 roomMeta 模拟「外部（别的窗口 / GM）刚写入」时，必须给一个更新的 updatedAt，
 * 否则缓存里更晚的状态会赢 —— 这是模拟真实外部写入的必要条件，不是放宽断言。 */
const seedState = (obj) => T.normalizeState(Object.assign({}, obj, { updatedAt: Date.now() + 1000 }));
const liveOf = (hp, state) => ({ hp: hp, state: state });
let state = T.normalizeState(baseState);
const render = (editable) => G.renderGlanceHTML(char, {
  mode: "compact",
  live: liveOf(token.metadata[KEY_HP], state),
  editable: editable || { hp: true, track: true, rest: true }
});
let html = render();

const actCount = count(html, /class="gl4-act"/g);
if (actCount >= 10) ok("威能动作类型标签 ≥10 处（实际 " + actCount + "）");
else bad("威能动作类型标签只有 " + actCount + " 处（应 ≥10）");
for (const act of ["标准动作", "即时反应", "移动动作", "自由动作"]) {
  if (html.indexOf(act) >= 0) ok("动作类型出现：" + act);
  else bad("渲染里没有动作类型：" + act);
}
if (html.indexOf("可用 18/18") >= 0) ok("威能区「可用 18/18」");
else bad("没有「可用 18/18」（实际：" + (/可用 [0-9]+\/[0-9]+/.exec(html) || ["无"])[0] + "）");
if (/4 \/ 4/.test(between(html, '<section class="gl4-card gl4-powers">', "</section>")))
  ok("威能组头保留「4 / 4」（遭遇 / 每日组各自计数）");
else bad("威能组头没有 4 / 4 计数");
if (html.indexOf('data-act="hurt"') < 0 && html.indexOf('data-act="heal"') < 0 &&
  html.indexOf('data-role="amount"') >= 0 && html.indexOf('data-act="hurt-amount"') >= 0)
  ok("紧凑模式：去掉 ±1/±5/±10 快捷按钮，保留「数值 + 受伤/治疗」");
else bad("紧凑模式的 HP 快捷区不对（应只有数值 + 受伤/治疗）");
if (html.indexOf('class="gl4-hp-temp"') >= 0 && html.indexOf('data-role="temp"') >= 0 &&
  html.indexOf('data-act="temp"') < 0)
  ok("临时生命已并入 HP 行（inline 输入，无独立 −/+ 行）");
else bad("临时生命没有并入 HP 行 / 还有重复的 −/+ 行");
const idxBytes = fs.statSync(path.join(ROOT, "data", "card-index.js")).size;
if (idxBytes <= 350 * 1024) ok("card-index.js 体积 " + (idxBytes / 1024).toFixed(0) + " KB（≤350KB）");
else bad("card-index.js 体积过大：" + (idxBytes / 1024).toFixed(0) + " KB（应 ≤350KB）");

/* v1.8.6：专长区块整块不渲染；装备行不再有物品等级档位；tooltip 不再拼攻击/命中 */
if (html.indexOf("gl4-feats") < 0 && html.indexOf('class="gl4-chip feat"') < 0)
  ok("专长区块整块不渲染（无 gl4-feats / feat chip）");
else bad("专长区块还在渲染");
if (html.indexOf('class="gl4-tag"') < 0 && html.indexOf("赠送") < 0) ok("专长「每日 / 赠送」标记都不再出现");
else bad("专长标记还在渲染");
const itemsHtml = between(html, '<section class="gl4-card gl4-items">', "</section>");
if (itemsHtml.indexOf("gl4-lv") < 0 && !/L\d/.test(itemsHtml)) ok("装备行没有物品等级档位（L2 7 12…）");
else bad("装备行还有物品等级档位");
if (itemsHtml.indexOf("增强 +6") >= 0) ok("装备行「增强 +N」保留（增强 +6）");
else bad("装备行没有「增强 +N」");
if (html.indexOf("攻击：") < 0 && html.indexOf("命中：") < 0) ok("title 不再拼「攻击：… / 命中：…」");
else bad("tooltip 里还有攻击 / 命中文本");

const skillsHtml = between(html, '<section class="gl4-card gl4-skills">', "</section>");
const skillRows = count(skillsHtml, /class="gl4-skill(?: trained)?"/g);
if (skillRows === 17) ok("17 技能行");
else bad("技能行数 " + skillRows + "（应 17）");

for (const act of ["hurt-amount", "heal-amount", "surge-use", "surge-temp", "def-temp", "atk-temp", "dmg-temp"]) {
  if (html.indexOf('data-act="' + act + '"') >= 0) ok("控件在：data-act=" + act + '"');
  else bad('缺少控件 data-act="' + act + '"');
}
if (count(html, /data-act="def-temp"/g) >= 8) ok("四防临时加值 ± 控件齐（8 个按钮）");
else bad("四防临时加值控件不足：" + count(html, /data-act="def-temp"/g));

/* 没索引时优雅降级：动作标签消失，但其余照常 */
G.setCardIndex(null);
const noIdx = render();
if (noIdx.indexOf('class="gl4-act"') < 0 && noIdx.indexOf("可用 18/18") >= 0 && noIdx.indexOf('data-role="amount"') >= 0)
  ok("card-index 未加载时优雅降级（只少动作标签，数值 / 控件照常）");
else bad("card-index 缺失时渲染没有正确降级");
G.setCardIndex(index);

/* ---------------------------------------------------------------------------
 * 5) 交互：真实 track.js applyAction（与 info.js 的 [data-act] 点击同一入口）
 * ------------------------------------------------------------------------- */
console.log("\n== C) 交互（真实 applyAction）");
/** 造假元素：dataset 照抄渲染层写的数据属性；amount 给带数值输入的行用。 */
function elOf(dataset, amount) {
  const box = { querySelector: () => (amount == null ? null : { value: String(amount) }) };
  const el = {
    dataset: dataset || {},
    querySelector: () => null,
    getAttribute: (k) => (dataset && dataset[k]) || null
  };
  el.closest = (sel) => (sel === "[data-act]" ? el : (sel && sel.indexOf("gl4-hp-pad") >= 0 ? box : null));
  return el;
}
async function ctxNow() {
  const hp = T.hpView(token.metadata[KEY_HP], { maxHp: d0.hpMax, surges: d0.surges });
  const loaded = await T.loadState("c-test");
  state = loaded.state;
  const derived = G.deriveGlance(char, undefined, { hp: hp, state: state });
  return {
    cardId: "c-test",
    itemId: "tok-1",
    hp: hp,
    state: state,
    maxHp: derived.hpMax,
    surgesMax: derived.surgesMax || derived.surges,
    defenses: derived.defenses,
    surgeValue: derived.surgeValue + (state.surgeTemp || 0),
    canHp: true,
    itemDailyMax: 2
  };
}

/* ⑤ 受伤 / 治疗 */
token.metadata[KEY_HP] = Object.assign({}, baseHp);
let res = await T.applyAction("hurt", elOf({ n: "10" }), await ctxNow());
let hpNow = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
if (hpNow.cur === 161) ok("受伤 10 → 当前 HP 171 → 161");
else bad("受伤 10 后 HP = " + hpNow.cur + "（应为 161）");
res = await T.applyAction("heal", elOf({ n: "5" }), await ctxNow());
hpNow = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
if (hpNow.cur === 166) ok("治疗 5 → 当前 HP 161 → 166");
else bad("治疗 5 后 HP = " + hpNow.cur + "（应为 166）");
await T.applyAction("temp", elOf({ d: "5" }), await ctxNow());
hpNow = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
if (hpNow.temp === 5) ok("临时生命 +5");
else bad("临时生命 = " + hpNow.temp + "（应为 5）");
await T.applyAction("hurt-amount", elOf({}, 8), await ctxNow());
hpNow = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
if (hpNow.temp === 0 && hpNow.cur === 163) ok("数值受伤 8：先扣临时 5，再扣血 3（HP 166 → 163）");
else bad("数值受伤结算不对：HP " + hpNow.cur + " / 临时 " + hpNow.temp);
  /* v2.4.26：紧凑速览的临时生命输入在 HP 行（不在 .gl4-hp-pad），必须能写入 */
  {
    const inlineEl = { dataset: {}, value: "7", closest: () => null, querySelector: () => null, getAttribute: () => null };
    await T.applyAction("temp-set", inlineEl, await ctxNow());
    const now = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
    if (now.temp === 7) ok("v2.4.26：inline 临时生命输入（不在 hp-pad）能写入 7");
    else bad("v2.4.26：inline 临时生命没有写入（temp=" + now.temp + "）");
    token.metadata[KEY_HP] = Object.assign({}, token.metadata[KEY_HP], { temp: 0 });
  }

/* ⑥ 使用回复力（先加临时回复值 +3） */
token.metadata[KEY_HP] = Object.assign({}, baseHp, { cur: 100, surges: 8 });
state = T.normalizeState(Object.assign({}, baseState, { surgeTemp: 3 }));
roomMeta[NS + "/state/c-test"] = seedState(state);
res = await T.applyAction("surge-use", elOf({}), await ctxNow());
hpNow = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
if (hpNow.surges === 7 && hpNow.cur === 100 + d0.surgeValue + 3)
  ok("使用回复力：回复力 8 → 7，HP 100 → " + hpNow.cur + "（回复值 " + d0.surgeValue + " + 临时 3）");
else bad("使用回复力结果不对：HP " + hpNow.cur + " / 回复力 " + hpNow.surges);

/* ⑦ 短休：清遭遇威能 / 临时加值，每日威能保留；没有 feats 索引 → 专长标记按降级保留（只清威能） */
token.metadata[KEY_HP] = Object.assign({}, baseHp);
roomMeta[NS + "/state/c-test"] = seedState(Object.assign({}, baseState, {
  powerUsed: { "encounter-0": true, "daily-0": true },
  featUsed: { "g-test-encounter": true },
  atkTemp: 2,
  dmgTemp: 2,
  surgeTemp: 2,
  defTemp: { ac: 2, fort: 0, ref: 0, will: 0 }
}));
res = await T.applyAction("rest-short", elOf({}), await ctxNow());
const sShort = T.normalizeState(roomMeta[NS + "/state/c-test"]);
if (!sShort.powerUsed["encounter-0"] && sShort.powerUsed["daily-0"]) ok("短休：遭遇威能恢复、每日威能保留");
else bad("短休清错：powerUsed = " + JSON.stringify(sShort.powerUsed));
if (sShort.atkTemp === 0 && sShort.dmgTemp === 0 && sShort.surgeTemp === 0 && sShort.defTemp.ac === 0 && sShort.defTemp.will === 0)
  ok("短休：临时命中 / 伤害 / 回复值 / 四防全部清零");
else bad("短休没清临时加值：" + JSON.stringify({ atk: sShort.atkTemp, dmg: sShort.dmgTemp, surge: sShort.surgeTemp, def: sShort.defTemp }));
if (sShort.featUsed["g-test-encounter"]) ok("短休降级：没有 feats 索引时专长已用标记保留（只清遭遇威能）");
else bad("短休降级不对：没传 encounterFeatKeys 却清了专长标记");

/* ⑧ 临时命中 / 临时防御：显示值 +1 */
roomMeta[NS + "/state/c-test"] = seedState(baseState);
await T.applyAction("def-temp", elOf({ k: "ac", d: "1" }), await ctxNow());
await T.applyAction("atk-temp", elOf({ d: "1" }), await ctxNow());
state = T.normalizeState(roomMeta[NS + "/state/c-test"]);
if (state.defTemp.ac === 1 && state.atkTemp === 1) ok("临时四防 AC +1 / 临时命中 +1 写进 state");
else bad("临时加值没有写进 state：" + JSON.stringify({ def: state.defTemp, atk: state.atkTemp }));
html = render();
const defVals = Array.from(html.matchAll(/class="gl4-def-val">(-?\d+)/g)).map((m) => parseInt(m[1], 10));
if (defVals[0] === d0.defenses[0].value + 1) ok("重新渲染后 AC = " + defVals[0] + "（基础 " + d0.defenses[0].value + " + 临时 1）");
else bad("AC 临时加值没显示：" + JSON.stringify(defVals));
const atkHit = (html.match(/class="gl4-atk-hit"><i>命中<\/i><b>([+-]?\d+)/) || [])[1];
if (atkHit === "+" + (d0.attacks[0].total + 1)) ok("重新渲染后命中 = " + atkHit + "（基础 " + d0.attacks[0].total + " + 临时 1）");
else bad("命中临时加值没显示：" + atkHit);
/* 四防 / 命中 / 伤害 / 回复值同时打开时的状态体积（每卡新增 < 200 字节） */
const bigState = T.normalizeState(Object.assign({}, baseState, {
  atkTemp: 5, dmgTemp: -5, surgeTemp: 10, defTemp: { ac: 3, fort: 2, ref: 1, will: 4 }
}));
/* 与 v1.8.0 的旧状态结构（没有临时值字段）比，看每卡新增多少字节 */
const oldShape = { v: 1, updatedAt: 0, powerUsed: {}, featUsed: {}, equipmentUsed: {}, itemDailyUsed: 0, actionPoints: 1, milestones: 0 };
const sizeDelta = JSON.stringify(bigState).length - JSON.stringify(oldShape).length;
if (sizeDelta < 200) ok("每卡临时值体积 +" + sizeDelta + " 字节（< 200）");
else bad("每卡临时值体积过大：+" + sizeDelta + " 字节");

/* 玩家端只读：控件不出现、数字照常显示 */
const ro = render({ hp: false, track: true, rest: false });
for (const act of ["hurt", "heal", "def-temp", "atk-temp", "dmg-temp", "surge-temp", "surge-use"]) {
  if (ro.indexOf('data-act="' + act + '"') < 0) ok("只读形态没有 " + act + " 控件");
  else bad("只读形态还显示 " + act + " 控件");
}
if (ro.indexOf("使用回复力") < 0) ok("只读形态没有「使用回复力」按钮");
else bad("只读形态还显示「使用回复力」");
if (ro.indexOf("gl4-def-val") >= 0 && ro.indexOf("gl4-skill") >= 0) ok("只读形态数值照常渲染（四防 / 技能）");
else bad("只读形态数值没渲染");
/* 只读时临时值仍然显示（别人 / GM 加的临时值玩家端看得到数值） */
G.setCardIndex(index);
state = T.normalizeState(Object.assign({}, baseState, { defTemp: { ac: 1, fort: 0, ref: 0, will: 0 } }));
const roTemp = render({ hp: false, track: true, rest: false });
const roDef = Array.from(roTemp.matchAll(/class="gl4-def-val">(-?\d+)/g)).map((m) => parseInt(m[1], 10));
if (roDef[0] === d0.defenses[0].value + 1) ok("只读形态也把临时加值算进显示值（AC " + roDef[0] + "）");
else bad("只读形态没显示临时加值：" + JSON.stringify(roDef));

/* 旧状态兼容：没有新字段也能读（缺字段 = 0） */
const oldState = T.normalizeState({ powerUsed: { "daily-0": true }, equipmentUsed: {}, featUsed: {}, actionPoints: 2, milestones: 1 });
if (oldState.atkTemp === 0 && oldState.dmgTemp === 0 && oldState.surgeTemp === 0 &&
  oldState.defTemp && oldState.defTemp.ac === 0 && oldState.defTemp.will === 0) {
  ok("旧状态兼容：缺临时字段 = 0（向后兼容）");
} else bad("旧状态兼容失败：" + JSON.stringify(oldState));

/* ---- v2.4.26：四防临时加值单向写回绑定 token（地图血条联动） ---- */
{
  const dBase = G.deriveGlance(char);
  const base = {};
  for (const d of (dBase.defenses || [])) base[d.key === "ref" ? "reflex" : d.key] = d.value;
  const CARD_ID = "c-sync";
  roomMeta[NS + "/cards"] = { v: 1, updatedAt: 1, cards: [{ id: CARD_ID, name: "同步测试", char: char }] };
  const baseHp = { cur: 5, max: 20, temp: 2, surges: 3, locked: false, defenses: { ac: 1, fort: 1, reflex: 1, will: 1 } };
  token.createdUserId = "user-gm";
  token.metadata = { [NS + "/cardId"]: CARD_ID, [KEY_HP]: JSON.parse(JSON.stringify(baseHp)) };
  roleNow = "GM"; idNow = "user-gm";
  let n = await C.syncDefTempToTokens(CARD_ID, { ac: 0, fort: 2, ref: 1, will: 0 });
  let hpNow = token.metadata[KEY_HP];
  if (n === 1 && hpNow.defenses.ac === base.ac && hpNow.defenses.fort === base.fort + 2 &&
    hpNow.defenses.reflex === base.reflex + 1 && hpNow.defenses.will === base.will &&
    hpNow.cur === 5 && hpNow.max === 20 && hpNow.temp === 2 && hpNow.surges === 3 && hpNow.locked === false) {
    ok("v2.4.26：def-temp fort+2 / reflex+1 → token hp.defenses = 卡片基础+临时，cur/max/temp/surges/locked 全保留");
  } else bad("v2.4.26：临时四防没有正确写回 token：" + JSON.stringify(hpNow));
  const sameAgain = await C.syncDefTempToTokens(CARD_ID, { ac: 0, fort: 2, ref: 1, will: 0 });
  if (sameAgain === 0) ok("v2.4.26：同一组临时值再次同步 → 值没变不写（返回 0）");
  else bad("v2.4.26：同值仍然写盘（返回 " + sameAgain + "）");
  const restored = await C.syncDefTempToTokens(CARD_ID, { ac: 0, fort: 0, ref: 0, will: 0 });
  hpNow = token.metadata[KEY_HP];
  if (restored === 1 && hpNow.defenses.ac === base.ac && hpNow.defenses.fort === base.fort &&
    hpNow.defenses.reflex === base.reflex && hpNow.defenses.will === base.will) {
    ok("v2.4.26：临时值清零（短/长休）→ 四防写回卡片基础值，地图圆/盾还原");
  } else bad("v2.4.26：清零后四防没有还原：" + JSON.stringify(hpNow.defenses));
  /* 无权限：非 GM 且非创建者 → 跳过、一个字节都不写 */
  token.createdUserId = "someone-else";
  token.metadata[KEY_HP] = JSON.parse(JSON.stringify(baseHp));
  roleNow = "PLAYER"; idNow = "user-me";
  const denied = await C.syncDefTempToTokens(CARD_ID, { ac: 0, fort: 2, ref: 0, will: 0 });
  if (denied === 0 && token.metadata[KEY_HP].defenses.fort === 1) ok("v2.4.26：无权限 token 跳过（不写别人的 token）");
  else bad("v2.4.26：无权限 token 仍然被写：" + JSON.stringify(token.metadata[KEY_HP].defenses));
  roleNow = "GM"; idNow = "user-gm";
  token.createdUserId = "user-gm";
}

/* ---- v2.4.26：端到端顺序 —— 临时四防写 token 后，紧随的 syncTokenStats 不能回写 base ---- */
{
  const dBase = G.deriveGlance(char);
  const base = {};
  for (const d of (dBase.defenses || [])) base[d.key === "ref" ? "reflex" : d.key] = d.value;
  roomMeta[NS + "/cards"] = { v: 1, updatedAt: 1, cards: [{ id: "c-test", name: "同步端到端", char: char }] };
  token.createdUserId = "user-gm";
  token.metadata = {
    [NS + "/cardId"]: "c-test",
    [KEY_HP]: { cur: 10, max: 20, temp: 0, surges: 3, surgesMax: 4, locked: false,
      defenses: { ac: base.ac, fort: base.fort, reflex: base.reflex, will: base.will } }
  };
  const st = T.normalizeState(Object.assign({}, baseState, { defTemp: { ac: 0, fort: 2, ref: 1, will: 0 } }));
  roomMeta[NS + "/state/c-test"] = seedState(st);
  await C.syncDefTempToTokens("c-test", st.defTemp);
  let hpNow = token.metadata[KEY_HP];
  if (hpNow.defenses.fort === base.fort + 2 && hpNow.defenses.reflex === base.reflex + 1)
    ok("v2.4.26：def-temp 后 token 四防 = 卡片基础 + 临时（fort+" + 2 + " / reflex+" + 1 + "）");
  else bad("v2.4.26：def-temp 后 token 四防不对：" + JSON.stringify(hpNow.defenses));
  const wrote = await T.syncTokenStats(token.id, T.hpView(hpNow, { maxHp: 20, surges: 4 }), {
    maxHp: 20, surgesMax: 4, defenses: dBase.defenses, defTemp: st.defTemp
  });
  hpNow = token.metadata[KEY_HP];
  if (wrote === false && hpNow.defenses.fort === base.fort + 2 && hpNow.defenses.reflex === base.reflex + 1)
    ok("v2.4.26：紧随的 syncTokenStats 带 ctx.defTemp → 返回 false、不回写基础值（修复「变一下又变回去」）");
  else bad("v2.4.26：syncTokenStats 又把临时四防写回去了：" + JSON.stringify({ wrote, def: hpNow.defenses }));
  await C.syncDefTempToTokens("c-test", { ac: 0, fort: 0, ref: 0, will: 0 });
  hpNow = token.metadata[KEY_HP];
  if (hpNow.defenses.fort === base.fort && hpNow.defenses.reflex === base.reflex)
    ok("v2.4.26：临时四防清零 → token 写回卡片基础值（短/长休还原）");
  else bad("v2.4.26：清零后没有写回基础值：" + JSON.stringify(hpNow.defenses));
}

/* ---- v2.4.26：combatMods.damages[].dieUp（武器伤害骰提升 1d4→…→2d12） ---- */
{
  const synth = {
    name: "dieUp 合成",
    level: 1,
    abilities: { str: 10, con: 10, dex: 10, int: 10, wis: 10, cha: 10 },
    baseItems: { 0: "w:匕首 Dagger" },
    combatMods: {
      attacks: [{ label: "匕首", ability: "str", enhanceSlot: 0, profSlot: 0 }],
      damages: [{ label: "匕首", ability: "str", enhanceSlot: 0 }]
    },
    customBonuses: {}
  };
  const dieOf = (n) => {
    const c = JSON.parse(JSON.stringify(synth));
    if (n !== undefined) c.combatMods.damages[0].dieUp = n;
    return G.deriveGlance(c).damages[0].dice;
  };
  const cases = [[1, "1d6"], [2, "1d8"], [3, "1d10"], [4, "1d12"], [5, "2d6"], [8, "2d12"], [9, "2d12"], [-1, "1d4"]];
  const wrong = cases.filter(([n, want]) => dieOf(n) !== want);
  if (!wrong.length) ok("v2.4.26：匕首 dieUp 1/2/3/4/5/8/9/-1 → 1d6/1d8/1d10/1d12/2d6/2d12/2d12/1d4（端点 clamp）");
  else bad("v2.4.26：dieUp 提升序列不对：" + wrong.map(([n, want]) => n + "→" + dieOf(n) + "（要 " + want + "）").join(" / "));
  if (dieOf(undefined) === "1d4" && dieOf(0) === "1d4")
    ok("v2.4.26：dieUp 缺失 / 0 时伤害骰保持武器原始 1d4（旧导出逐字节不变）");
  else bad("v2.4.26：dieUp 缺失/0 改变了旧伤害骰");
  /* 旧 fixture（无 dieUp）→ 每个伤害骰仍等于规则里的武器原始 d（逐项核对） */
  const oldChar = char;
  const hasDieUp = JSON.stringify((oldChar.combatMods || {}).damages || []).indexOf("dieUp") >= 0;
  const rulesMod = await import(pathToFileURL(path.join(tmp, "data", "rules.js")).href);
  const RR = rulesMod.RULES;
  const oldDmg = G.deriveGlance(oldChar).damages;
  const expectedOld = (oldChar.combatMods && oldChar.combatMods.damages || []).map(function (r) {
    const slot = Math.max(0, Number(r.enhanceSlot) || 0);
    const id = (oldChar.baseItems || {})[slot];
    if (!id || typeof id !== "string" || id[1] !== ":" || id[0] !== "w") return "";
    const w = RR.weapons.filter((x) => x.n === id.slice(2))[0];
    return w ? w.d : "";
  });
  const sameOld = oldDmg.length === expectedOld.length &&
    oldDmg.every((d, i) => d.dice === expectedOld[i]);
  if (!hasDieUp && sameOld)
    ok("v2.4.26：旧 fixture（无 dieUp）伤害骰逐项仍等于规则武器原始 d（零变化）");
  else bad("v2.4.26：旧 fixture 的伤害骰被 dieUp 逻辑改了 / 旧 fixture 意外含 dieUp：" + JSON.stringify({ hasDieUp, got: oldDmg.map((d) => d.dice), want: expectedOld }));
  /* 武器原始骰本身在阶梯里（2d6 / 2d8）→ 按阶梯继续升；非常规骰原样 */
  const weapons2d = RR.weapons.filter((w) => w.d === "2d6")[0];
  if (!weapons2d) {
    ok("v2.4.26：rules 没有 2d6 武器 → 跳过 2d6 提升断言");
  } else {
    const synth2 = JSON.parse(JSON.stringify(synth));
    synth2.baseItems = { 0: "w:" + weapons2d.n };
    synth2.combatMods.damages[0].dieUp = 1;
    const d1 = G.deriveGlance(synth2).damages[0].dice;
    synth2.combatMods.damages[0].dieUp = 3;
    const d3 = G.deriveGlance(synth2).damages[0].dice;
    synth2.combatMods.damages[0].dieUp = 4;
    const d4 = G.deriveGlance(synth2).damages[0].dice;
    if (d1 === "2d8" && d3 === "2d12" && d4 === "2d12")
      ok("v2.4.26：原始 2d6 武器 dieUp 1/3/4 → 2d8/2d12/2d12（2dX 也按阶梯继续升）");
    else bad("v2.4.26：2d6 原始骰提升不对：" + JSON.stringify({ d1, d3, d4 }));
  }

  /* 真实新 fixture（存在时）：应能 derive，且第一项伤害骰为 1d6（匕首 dieUp=1） */
  const newFixture = path.join(ROOT, "dev", "fixtures", "申比软软-new.json");
  if (!fs.existsSync(newFixture)) {
    ok("v2.4.26：真实新 fixture 不存在 → 跳过（不依赖用户文件）");
  } else {
    try {
      const saveNew = JSON.parse(fs.readFileSync(newFixture, "utf8"));
      const charNew = (saveNew.pages && saveNew.pages.character) || saveNew.character || saveNew;
      const dNew = G.deriveGlance(charNew);
      const firstDie = dNew.damages[0] ? dNew.damages[0].dice : "";
      if (firstDie === "1d6") ok("v2.4.26：真实新 fixture 可 derive，第一项伤害骰 = 1d6（dieUp=1 生效）");
      else bad("v2.4.26：真实新 fixture 第一项伤害骰 = " + firstDie + "（应为 1d6）");
    } catch (eNew) {
      bad("v2.4.26：真实新 fixture 无法 derive：" + (eNew && eNew.message ? eNew.message : eNew));
    }
  }
}

/* ---- v2.4.26：血条编辑窗权限兜底（GM / createdUserId 缺失） ---- */
{
  const tokOther = { id: "t1", createdUserId: "other" };
  const tokMissing = { id: "t2" };
  const tokMissingEmpty = { id: "t3", createdUserId: "" };
  const tokMine = { id: "t4", createdUserId: "me" };
  if (H.mayEditToken(tokOther, "GM", "me") === true &&
    H.mayEditToken(tokOther, "PLAYER", "me") === false &&
    H.mayEditToken(tokMissing, "PLAYER", "me") === true &&
    H.mayEditToken(tokMissingEmpty, "PLAYER", "me") === true &&
    H.mayEditToken(tokMine, "PLAYER", "me") === true)
    ok("v2.4.26：GM 始终可编辑；非 GM 在 createdUserId 缺失/空时可编辑；不匹配只读；自己的可编辑");
  else bad("v2.4.26：hp 编辑权限兜底不对");
  const lockedMeta = { locked: true };
  if (H.hpEditReadOnly(lockedMeta, "GM") === false && H.hpEditReadOnly(lockedMeta, "PLAYER") === true &&
    H.hpEditReadOnly({ locked: false }, "PLAYER") === false)
    ok("v2.4.26：lockedForPlayer 只对非 GM 生效（GM 永远不被 lock 卡住）");
  else bad("v2.4.26：lockedForPlayer 判定不对");
  const pageSrc = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
  if (pageSrc.indexOf("focus id=") >= 0 &&
    pageSrc.indexOf("key=") >= 0 &&
    pageSrc.indexOf("key(capture)") >= 0 && pageSrc.indexOf("beforeinput id=") >= 0 &&
    pageSrc.indexOf("input id=") >= 0 && pageSrc.indexOf("commit trigger=") >= 0 &&
    pageSrc.indexOf("fillForm value-cur=") >= 0 && pageSrc.indexOf("page ready, inputs=") >= 0 &&
    pageSrc.indexOf("document.activeElement === el") >= 0 &&
    pageSrc.indexOf("state.dirty = true") >= 0 && pageSrc.indexOf("load skip fillForm (dirty)") >= 0 &&
    pageSrc.indexOf("paintDiag") < 0 && pageSrc.indexOf("hpe-diag") < 0 && pageSrc.indexOf("loaded v=") >= 0 &&
    pageSrc.indexOf("url=") >= 0 && pageSrc.indexOf("CH_HPEDIT_LOG") >= 0 &&
    pageSrc.indexOf('sendMessage(CH_HPEDIT_LOG') >= 0 &&
    pageSrc.indexOf('if (max === "" && cur !== "") max = cur;') >= 0 &&
    pageSrc.indexOf('if (cur === "" && max !== "") cur = max;') >= 0 &&
    pageSrc.indexOf("commit result trigger=") >= 0 &&
    pageSrc.indexOf("ok=") >= 0 && pageSrc.indexOf("patch=") >= 0 &&
    pageSrc.indexOf("document.activeElement") >= 0 &&
    !/if \(!built\.ok\)[\s\S]{0,240}?fillOne\(/.test(pageSrc))
    ok("v2.4.26/2.4.26：hpEdit 输入诊断 + fillForm 跳过焦点 / dirty 保护 / 可见诊断 / loaded 版本 URL 齐全");
  else bad("v2.4.26：hpEdit 输入诊断日志不完整");
  if (pageSrc.indexOf("[4enext][hpEdit] role=") >= 0 &&
    pageSrc.indexOf("applyDisabled dis=") >= 0 &&
    pageSrc.indexOf("state.role === \"GM\"") >= 0)
    ok("v2.4.26：hpEdit 诊断日志（role/pid/createdUserId/editable/locked + applyDisabled）与 GM 优先兜底存在");
  else bad("v2.4.26：hpEdit 诊断日志 / GM 兜底缺失");
}

/* ---- v2.4.26：编辑窗预览 ↔ 速览卡 HP 显示（共享颜色/阈值；无徽章；地图条不动） ---- */
{
  const healthy = C.hpBarVisual({ cur: 100, max: 100 });
  const wounded = C.hpBarVisual({ cur: 40, max: 100 });
  const critical = C.hpBarVisual({ cur: 0, max: 100 });
  const temp = C.hpBarVisual({ cur: 40, max: 100, temp: 5 });
  const full = C.hpBarVisual({ max: 100 });
  if (healthy.status.key === "healthy" && healthy.color === "#56d364" && healthy.display === "100/100" &&
    wounded.status.key === "wounded" && wounded.color === "#e3b341" && wounded.label === "重伤" &&
    critical.status.key === "critical" && critical.color === "#f85149" &&
    temp.tempText === "+5" && full.display === "100/100")
    ok("v2.4.26：hpBarVisual 与速览卡同色（100% 绿 / ≤50% 重伤黄 / 0 濒死红）、临时 +5、cur 缺省满血");
  else bad("v2.4.26：hpBarVisual 阈值/配色不对：" + JSON.stringify({ healthy, wounded, critical, temp, full }));
  const commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const uiSrc = fs.readFileSync(path.join(ROOT, "assets", "ui.css"), "utf8");
  const hpSrc = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
  const hpHtml = fs.readFileSync(path.join(ROOT, "hp-edit.html"), "utf8");
  const bgSrc = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const glanceCss = fs.readFileSync(path.join(ROOT, "assets", "glance.css"), "utf8");
  if (commonSrc.indexOf("function hpBarVisual(") >= 0 && commonSrc.indexOf("function hpStatusOf(") >= 0 &&
    uiSrc.indexOf("--hp-ok: #56d364") >= 0 && uiSrc.indexOf("--hp-warn") >= 0 && uiSrc.indexOf("--hp-danger") >= 0 &&
    hpSrc.indexOf("hpBarVisual") >= 0 && hpSrc.indexOf("--hp-color") >= 0 &&
    hpHtml.indexOf("hpe-hp-badge") < 0 &&
    glanceCss.indexOf("#56d364") >= 0 && glanceCss.indexOf("#e3b341") >= 0 && glanceCss.indexOf("#f85149") >= 0)
    ok("v2.4.26：编辑窗预览引用共享 hpBarVisual / ui 变量；速览卡保留原徽章与同色；编辑窗无徽章");
  else bad("v2.4.26：编辑窗与速览卡视觉没有统一 / 徽章未移除");
  if (bgSrc.indexOf('color: bloodied ? COLOR_HP_BLOODIED : "#b00000"') >= 0 &&
    bgSrc.indexOf("hpStatusOf(cur, max).color") < 0)
    ok("v2.4.26：地图 token 血条保持原设计（本轮未改地图条）");
  else bad("v2.4.26：地图血条被误改");
  if (hpHtml.indexOf("hpe-status") < 0 && hpHtml.indexOf("hpe-note") < 0 &&
    hpHtml.indexOf('id="win-flash"') < hpHtml.indexOf('class="hpe-body"') &&
    (hpHtml.match(/id="win-flash"/g) || []).length === 1)
    ok("v2.4.26：底部区域完全干净（无 hpe-status/hpe-note）；flash 只在标题栏");
  else bad("v2.4.26：底部仍有文本/提示，或 flash 不在标题栏");
  if (hpHtml.indexOf("hpe-note") < 0 && hpSrc.indexOf("留空的四防") < 0 &&
    hpSrc.indexOf("els.flash.textContent") >= 0 && hpSrc.indexOf("1500") >= 0)
    ok("v2.4.26：底部固定提示行已移除；保存/校验反馈走标题栏 #win-flash（1.5s）");
  else bad("v2.4.26：底部提示行仍存在 / flash 反馈未接");
  if (uiSrc.indexOf(".hpe-hp-bar-row") >= 0 && /height: 12px/.test(uiSrc) &&
    hpHtml.indexOf("width: 420px; height: 126px") >= 0 &&
    hpHtml.indexOf("hpe-pills") < hpHtml.indexOf("hpe-hp-bar-row") &&
    hpHtml.indexOf("hpe-hp-bar-row") < hpHtml.indexOf("hpe-defs") &&
    uiSrc.indexOf("repeating-linear-gradient") < 0)
    ok("v2.4.26：编辑窗 420×126 三行（数字行 → 整行 12px 进度条 → 四防行），无分割线");
  else bad("v2.4.26：编辑窗三行布局 / 窗口尺寸不对");
  if (uiSrc.indexOf(".hpe-bar-fill") >= 0 && uiSrc.indexOf(".hpe-hp-pill::before") < 0 &&
    uiSrc.indexOf(".hpe-hp-track") >= 0 && uiSrc.indexOf("repeating-linear-gradient") < 0 &&
    hpHtml.indexOf("hpe-hp-fill") >= 0 && hpHtml.indexOf("hpe-hp-track") >= 0 &&
    hpSrc.indexOf("els.hpFill.style.width") >= 0 &&
    /#hpe-cur \{[^}]*background: #0b0f14/.test(uiSrc) && /#hpe-max \{[^}]*background: #0b0f14/.test(uiSrc))
    ok("v2.4.26：HP 行=数字 + 临时 + 右侧深色轨道，填充一整条实色（无分割线/条纹），数字有独立深色底");
  else bad("v2.4.26：HP 轨道/填充结构仍不对");
}

/* ---- v2.4.26：速览常驻 / 隐藏血条 UI ---- */
{
  const coreK = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const hpHtml = fs.readFileSync(path.join(ROOT, "hp-edit.html"), "utf8");
  const hpCore = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-core.js"), "utf8");
  if (coreK.indexOf("info keep（取消选中）") >= 0 && coreK.indexOf("info switch target=") >= 0)
    ok("v2.4.26：取消选中 / 非绑卡不关速览，切绑卡 token 只切 target");
  else bad("v2.4.26：速览常驻日志缺失");
  if (hpHtml.indexOf('id="hpe-hide"') >= 0 && hpHtml.indexOf("对玩家隐藏血条（GM 仍可见）") >= 0 &&
    hpCore.indexOf("hide: m.hide === true") >= 0)
    ok("v2.4.26：编辑窗有「隐藏」勾选，默认 false，接 hp.hide");
  else bad("v2.4.26：隐藏勾选缺失");
}

/* ---- v2.4.26 非 GM 锁定隐藏 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const g = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
  if (bg.indexOf("hpEdit skip（非GM/锁定/隐藏）") >= 0 && bg.indexOf("hpEdit skip（非GM/非owner）") >= 0)
    ok("v2.4.26：非 GM / 非 owner / locked / hide 不自动弹编辑窗");
  else bad("v2.4.26：编辑窗弹窗守卫缺失");
  if (g.indexOf("value: \"?\"") >= 0 && g.indexOf("locked/hide → HP 与四防（含 AC）全部掩码") >= 0)
    ok("v2.4.26：速览非 GM locked/hide 时 HP+四防（含 AC）全掩码");
  else bad("v2.4.26：速览全掩码缺失");
}

/* ---- v2.4.26：非 GM locked/hide 速览四防+AC 掩码 ---- */
{
  const hpMask = Object.assign({}, token.metadata[KEY_HP], { locked: true, hide: false });
  const maskedHtml = G.renderGlanceHTML(char, { mode: "compact", live: liveOf(hpMask, state), maskHp: true });
  const shownHtml = G.renderGlanceHTML(char, { mode: "compact", live: liveOf(hpMask, state), maskHp: false });
  const qCount = (maskedHtml.match(/class="gl4-def-val">\?</g) || []).length;
  if (qCount >= 4 && maskedHtml.indexOf("已隐藏") >= 0)
    ok("v2.4.26：非 GM + locked/hide → AC/强韧/反射/意志全部渲染为 ?（" + qCount + " 个）");
  else bad("v2.4.26：四防掩码不完整：" + qCount);
  if (shownHtml.indexOf("class=\"gl4-def-val\">?") < 0 && /class="gl4-def-val">\d+/.test(shownHtml))
    ok("v2.4.26：GM / 未掩码时四防显示正常数字");
  else bad("v2.4.26：未掩码时数字异常");
  const hpPage = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
  if (hpPage.indexOf("closeSelf(ID_HP_EDIT, \"hpEdit\")") >= 0 && hpPage.indexOf("state.role !== \"GM\" && (lockedForPlayer || viewForGuard.hide") >= 0)
    ok("v2.4.26：血条编辑窗非 GM + locked/hide → 自动关闭（不是只读显示数字）");
  else bad("v2.4.26：编辑窗非 GM 自动关闭缺失");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过（v1.8.6 速览：动作标签 / 可用总数 / 无专长区块 / 无装备等级 / HP·回复力·临时加值 / 短休 / 索引 ≤350KB）");
process.exit(fail ? 1 : 0);
