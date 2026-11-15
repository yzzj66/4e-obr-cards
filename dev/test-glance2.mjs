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
for (const f of ["cards-core.js", "cards-scene.js", "common.js", "track.js", "glance.js"]) {
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
globalThis.__OBR__ = {
  isAvailable: true,
  notification: { show(msg, variant) { notes.push({ msg: msg, variant: variant }); return Promise.resolve("n"); } },
  player: {
    getRole: async () => "GM",
    getId: async () => "user-gm"
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
const T = await import(pathToFileURL(path.join(tmp, "assets", "track.js")).href);

/* ---------------------------------------------------------------------------
 * 3) 卡索引：按需加载 + 内容抽查
 * ------------------------------------------------------------------------- */
console.log("\n== A) 卡索引（data/card-index.js，懒加载）");
const index = await G.loadCardIndex();
if (index && index.powers && index.feats) ok("loadCardIndex() 加载成功（" + Object.keys(index.powers).length + " 个威能 / " + Object.keys(index.feats).length + " 个专长）");
else bad("card-index.js 没有加载出来");
if (index && index.powers["双重攻击 Twin Strike"] && index.powers["双重攻击 Twin Strike"][1] === "标准动作")
  ok("威能索引：双重攻击 → 动作 = 标准动作");
else bad("威能索引里没有双重攻击 / 动作类型不对");
if (index && index.feats["美德士兵 <兼职圣武士> Soldier of Virtue <Multiclass Paladin>"] === "d")
  ok("专长索引：美德士兵 → 每日（d）");
else bad("专长索引里没有美德士兵 / 频率不对");
if (index && index.powers["迅雷箭 Lightning Shot"] && /vs\.\s*AC/.test(index.powers["迅雷箭 Lightning Shot"][2] || ""))
  ok("威能索引带攻击行（迅雷箭 → " + JSON.stringify(index.powers["迅雷箭 Lightning Shot"].slice(0, 3)) + "）");
else bad("威能索引的攻击行提取失败");

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
for (const n of ["1", "5", "10"]) {
  if (html.indexOf('data-act="hurt" data-n="' + n + '"') >= 0 && html.indexOf('data-act="heal" data-n="' + n + '"') >= 0)
    ok("HP 快捷按钮 ±" + n + " 在（受伤 / 治疗）");
  else bad("HP 快捷按钮 ±" + n + " 缺失");
}
const idxBytes = fs.statSync(path.join(ROOT, "data", "card-index.js")).size;
if (idxBytes > 500 * 1024 && idxBytes < 2 * 1024 * 1024) ok("card-index.js 体积 " + (idxBytes / 1024).toFixed(0) + " KB（500KB~2MB，可接受）");
else bad("card-index.js 体积异常：" + idxBytes + " bytes");

const featsHtml = between(html, '<section class="gl4-card gl4-feats">', "</section>");
if (featsHtml.indexOf("美德士兵") >= 0 && featsHtml.indexOf("每日") >= 0)
  ok("专长「美德士兵」带「每日」标记");
else bad("专长区里美德士兵没有每日标记");
if (featsHtml.indexOf("赠送") >= 0) ok("专长「赠送」标记保留（职业赠送专长）");
else bad("专长区没有「赠送」标记");

const itemsHtml = between(html, '<section class="gl4-card gl4-items">', "</section>");
if (itemsHtml.indexOf("L3 8 13 18 23 28") >= 0) ok("装备行带物品等级「L3 8 13 18 23 28」");
else bad("装备行没有物品等级档位");
if (itemsHtml.indexOf("增强 +6") >= 0) ok("装备行「增强 +N」保留（增强 +6）");
else bad("装备行没有「增强 +N」");

const skillsHtml = between(html, '<section class="gl4-card gl4-skills">', "</section>");
const skillRows = count(skillsHtml, /class="gl4-skill(?: trained)?"/g);
if (skillRows === 17) ok("17 技能行");
else bad("技能行数 " + skillRows + "（应 17）");

for (const act of ["hurt", "heal", "hurt-amount", "heal-amount", "temp", "surge-use", "surge-temp", "def-temp", "atk-temp", "dmg-temp", "rest-short", "rest-long"]) {
  if (html.indexOf('data-act="' + act + '"') >= 0) ok("控件在：data-act=" + act + '"');
  else bad('缺少控件 data-act="' + act + '"');
}
if (count(html, /data-act="def-temp"/g) >= 8) ok("四防临时加值 ± 控件齐（8 个按钮）");
else bad("四防临时加值控件不足：" + count(html, /data-act="def-temp"/g));

/* 没索引时优雅降级：动作标签消失，但其余照常 */
G.setCardIndex(null);
const noIdx = render();
if (noIdx.indexOf('class="gl4-act"') < 0 && noIdx.indexOf("可用 18/18") >= 0 && noIdx.indexOf('data-act="hurt"') >= 0)
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
  const idx = G.cardIndex();
  const encounterFeatKeys = (derived.feats || []).filter((f) => idx && idx.feats && idx.feats[f.id] === "e").map((f) => f.key);
  return {
    cardId: "c-test",
    itemId: "tok-1",
    hp: hp,
    state: state,
    maxHp: derived.hpMax,
    surgesMax: derived.surgesMax || derived.surges,
    defenses: derived.defenses,
    surgeValue: derived.surgeValue + (state.surgeTemp || 0),
    encounterFeatKeys: encounterFeatKeys,
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

/* ⑥ 使用回复力（先加临时回复值 +3） */
token.metadata[KEY_HP] = Object.assign({}, baseHp, { cur: 100, surges: 8 });
state = T.normalizeState(Object.assign({}, baseState, { surgeTemp: 3 }));
roomMeta[NS + "/state/c-test"] = seedState(state);
res = await T.applyAction("surge-use", elOf({}), await ctxNow());
hpNow = T.hpView(token.metadata[KEY_HP], { maxHp: 171, surges: 8 });
if (hpNow.surges === 7 && hpNow.cur === 100 + d0.surgeValue + 3)
  ok("使用回复力：回复力 8 → 7，HP 100 → " + hpNow.cur + "（回复值 " + d0.surgeValue + " + 临时 3）");
else bad("使用回复力结果不对：HP " + hpNow.cur + " / 回复力 " + hpNow.surges);

/* ⑦ 短休：清遭遇威能 / 遭遇专长 / 临时加值，每日威能保留 */
token.metadata[KEY_HP] = Object.assign({}, baseHp);
roomMeta[NS + "/state/c-test"] = seedState(Object.assign({}, baseState, {
  powerUsed: { "encounter-0": true, "daily-0": true },
  atkTemp: 2,
  dmgTemp: 2,
  surgeTemp: 2,
  defTemp: { ac: 2, fort: 0, ref: 0, will: 0 }
}));
let ctx = await ctxNow();
const encKey = ctx.encounterFeatKeys[0] || "";
if (encKey) {
  await T.applyAction("feat", elOf({ k: encKey }), await ctxNow());
  ctx = await ctxNow();
}
res = await T.applyAction("rest-short", elOf({}), await ctxNow());
const sShort = T.normalizeState(roomMeta[NS + "/state/c-test"]);
if (!sShort.powerUsed["encounter-0"] && sShort.powerUsed["daily-0"]) ok("短休：遭遇威能恢复、每日威能保留");
else bad("短休清错：powerUsed = " + JSON.stringify(sShort.powerUsed));
if (sShort.atkTemp === 0 && sShort.dmgTemp === 0 && sShort.surgeTemp === 0 && sShort.defTemp.ac === 0 && sShort.defTemp.will === 0)
  ok("短休：临时命中 / 伤害 / 回复值 / 四防全部清零");
else bad("短休没清临时加值：" + JSON.stringify({ atk: sShort.atkTemp, dmg: sShort.dmgTemp, surge: sShort.surgeTemp, def: sShort.defTemp }));
if (!encKey || !sShort.featUsed[encKey]) ok("短休：遭遇类专长已用标记清掉" + (encKey ? "（" + encKey + "）" : "（本卡无遭遇专长，跳过）"));
else bad("短休没清遭遇专长：" + encKey);
/* 用合成 key 验证「遭遇专长清标记」分支（真实卡可能没有遭遇类专长） */
roomMeta[NS + "/state/c-test"] = seedState(Object.assign({}, baseState, { featUsed: { "g-test-encounter": true } }));
ctx = await ctxNow();
ctx.encounterFeatKeys = ["g-test-encounter"];
await T.applyAction("rest-short", elOf({}), ctx);
const sShort2 = T.normalizeState(roomMeta[NS + "/state/c-test"]);
if (!sShort2.featUsed["g-test-encounter"]) ok("短休：按 encounterFeatKeys 清遭遇专长标记（合成 key 验证）");
else bad("短休没有清 encounterFeatKeys 里的专长");

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
const atkHit = (html.match(/class="gl4-atk-hit">([+-]?\d+)/) || [])[1];
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

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过（速览对齐 4E NEXT：动作 / 专长频率 / 装备等级 / 可用总数 / HP·回复力·临时加值 / 短休）");
process.exit(fail ? 1 : 0);
