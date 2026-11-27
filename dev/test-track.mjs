// 血量 / 资源追踪的语义自测（无浏览器、无 OBR）：
// 把 assets/track.js 复制成 .mjs，把两个 import 换成本文件里的桩，然后在 Node 里跑一遍，
// 逐条核对 4E NEXT 速览页的规则（先扣临时生命 / 低于 0 先归零 / 回复力 / 已用标记 / 写不进去退本机）。
// 用法：node dev/test-track.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const near = (a, b) => a === b;

const item = {
  id: "tok-1",
  type: "IMAGE",
  createdUserId: "user-player",
  metadata: {}
};
const roomMeta = {};
let roomFails = false;
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

/* ---- 假 OBR：可模拟真机的「元数据回声延迟」（v1.8.1 读-改-写竞态复现用） ----
 * echoDelay = false（默认，老断言用）：setMetadata 之后 getMetadata 立刻就能看到新值（旧假 OBR）。
 * echoDelay = true：模拟 OBR 元数据同步 —— setMetadata 提交后，**下一次** getMetadata 仍返回
 * 写之前的快照（回声延迟），再下一次才看到新值。真机连续点资源标记时正是这个时序。
 * onMetadataChange 仍然即时把「已提交的最新 meta」推给订阅者（宿主 push 事件不会等回声）。 */
const clone = (o) => JSON.parse(JSON.stringify(o || {}));
let echoDelay = false;
let visibleMeta = {};
let pendingMeta = null;
const metaCbs = [];
const OBR = {
  player: {
    getRole: async () => "GM",
    getId: async () => "user-gm"
  },
  scene: {
    items: {
      getItems: async (ids) => (Array.isArray(ids) ? [item].filter((it) => ids.includes(it.id)) : [item]),
      updateItems: async (ids, fn) => { fn([item]); }
    }
  },
  room: {
    getMetadata: async () => {
      const out = clone(visibleMeta);
      if (pendingMeta) { visibleMeta = clone(pendingMeta); pendingMeta = null; }
      return out;
    },
    setMetadata: async (update) => {
      if (roomFails) throw new Error("只有城主能写房间数据");
      for (const k of Object.keys(update)) roomMeta[k] = clone(update[k]);
      if (echoDelay) pendingMeta = clone(roomMeta);
      else visibleMeta = clone(roomMeta);
      for (const cb of metaCbs) {
        try { cb(clone(roomMeta)); } catch (e) { /* 订阅者自己报错不影响写入 */ }
      }
    },
    onMetadataChange: (cb) => { metaCbs.push(cb); return () => {}; }
  }
};

const tmp = path.join(os.tmpdir(), "4enext-track-test");
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
globalThis.__OBR__ = OBR;
/* v1.7.15：track.js 现在会从 common.js 取「房间数据体积预算」那套函数（writeRoomKey / notify /
 * ROOM_FULL_MESSAGE），所以这里改成把**真的** common.js + cards-core.js 拷过来（只换 OBR 的 import），
 * 用一行 NS 常量冒充会把 import 打断。 */
fs.copyFileSync(path.join(ROOT, "assets", "cards-core.js"), path.join(tmp, "cards-core.mjs"));
/* v1.8.0：common.js 还会 import cards-scene.js（房间装不下时的场景 item 存储）。 */
let sceneSrc = fs.readFileSync(path.join(ROOT, "assets", "cards-scene.js"), "utf8");
sceneSrc = sceneSrc.replace('from "../vendor/obr-sdk.js"', "from " + JSON.stringify(pathToFileURL(path.join(tmp, "obr-stub.mjs")).href));
sceneSrc = sceneSrc.replace('from "./cards-core.js"', 'from "./cards-core.mjs"');
fs.writeFileSync(path.join(tmp, "cards-scene.mjs"), sceneSrc, "utf8");
let commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
commonSrc = commonSrc.replace('from "../vendor/obr-sdk.js"', "from " + JSON.stringify(pathToFileURL(path.join(tmp, "obr-stub.mjs")).href));
commonSrc = commonSrc.replace('from "./cards-core.js"', 'from "./cards-core.mjs"');
commonSrc = commonSrc.replace('from "./cards-scene.js"', 'from "./cards-scene.mjs"');
fs.writeFileSync(path.join(tmp, "common.mjs"), commonSrc, "utf8");

let src = fs.readFileSync(path.join(ROOT, "assets", "track.js"), "utf8");
src = src.replace('from "../vendor/obr-sdk.js"', 'from ' + JSON.stringify(pathToFileURL(path.join(tmp, "obr-stub.mjs")).href));
src = src.replace('from "./common.js"', 'from "./common.mjs"');
const modPath = path.join(tmp, "track.mjs");
fs.writeFileSync(modPath, src, "utf8");

const T = await import(pathToFileURL(modPath).href);
const C = await import(pathToFileURL(path.join(tmp, "common.mjs")).href);
/* v1.8.1：再拷一份 track.mjs 当「第二个页面实例」（info 弹窗 / panel 面板是两个独立 iframe，
 * 各有自己的模块状态与缓存），用来测两个页面交替点同一张卡会不会互相覆盖。 */
const modPathB = path.join(tmp, "track-b.mjs");
fs.writeFileSync(modPathB, src, "utf8");
const TB = await import(pathToFileURL(modPathB).href);
const ctx = () => ({ cardId: "c-1", itemId: item.id, hp: null, state: null, maxHp: 20, surgesMax: 4, surgeValue: 5, canHp: true, itemDailyMax: 2 });
const el = (data) => ({ dataset: data || {}, closest: () => null, querySelector: () => null });

/* ---- 1. 默认值 ---- */
/* v1.7.12：缺省 = 未用（不是已用）。房间数据 / 导出快照里没有的 key 不能凭空变成已用。 */
const fresh0 = T.defaultState();
const norm0 = T.normalizeState({});
if (Object.keys(fresh0.powerUsed).length === 0 && Object.keys(fresh0.equipmentUsed).length === 0 &&
  Object.keys(norm0.powerUsed).length === 0 && Object.keys(norm0.equipmentUsed).length === 0 &&
  norm0.itemDailyUsed === 0) {
  ok("默认状态：威能 / 装备一个都没标已用（缺省 = 未用）");
} else bad("默认状态不是全未用：" + JSON.stringify(norm0));
const blank = T.hpView(null, { maxHp: 20, surges: 4 });
if (blank.cur === 20 && blank.max === 20 && blank.temp === 0 && blank.surges === 4) ok("没写过血量时：满血 + 满回复力");
else bad("默认血量不对：" + JSON.stringify(blank));

/* ---- 2. 受伤：先扣临时生命 ---- */
item.metadata = { [T.KEY_HP]: { cur: 20, max: 20, temp: 3, surges: 4 } };
let res = await T.applyAction("hurt", el({ n: "5" }), ctx());
if (near(res.hp.cur, 18) && near(res.hp.temp, 0)) ok("受伤 5（带临时 3）：先扣临时，再扣 2 点生命 → 18");
else bad("受伤顺序不对：" + JSON.stringify(res.hp));

/* ---- 3. 治疗：负数先归零 ---- */
await T.writeTokenHp(item.id, () => ({ cur: -4, max: 20, temp: 0, surges: 4 }));
res = await T.applyAction("heal", el({ n: "5" }), ctx());
if (near(res.hp.cur, 5)) ok("治疗 5（当前 -4）：先归零再加 → 5");
else bad("治疗规则不对：" + JSON.stringify(res.hp));

/* ---- 4. 治疗不会超过上限 ---- */
res = await T.applyAction("heal", el({ n: "100" }), ctx());
if (near(res.hp.cur, 20)) ok("治疗封顶到上限 20");
else bad("治疗没有封顶：" + res.hp.cur);

/* ---- 5. 使用回复力 ---- */
await T.writeTokenHp(item.id, () => ({ cur: 10, max: 20, temp: 0, surges: 2 }));
res = await T.applyAction("surge-use", el({}), ctx());
if (near(res.hp.cur, 15) && near(res.hp.surges, 1)) ok("使用回复力：生命 +5、回复力 -1 → 15 / 1");
else bad("回复力规则不对：" + JSON.stringify(res.hp));

/* ---- 6. 回复力用完 ---- */
await T.writeTokenHp(item.id, () => ({ cur: 10, max: 20, temp: 0, surges: 0 }));
const ctx0 = ctx();
ctx0.hp = { cur: 10, max: 20, temp: 0, surges: 0 };
res = await T.applyAction("surge-use", el({}), ctx0);
if (!res.hp && /回复力/.test(res.message)) ok("回复力为 0 时拒绝使用并给出提示");
else bad("回复力为 0 时行为不对：" + JSON.stringify(res));

/* ---- 7. 威能「已用」切换（写房间数据） ---- */
res = await T.applyAction("power", el({ k: "daily-0" }), ctx());
if (res.state.powerUsed["daily-0"] === true && res.scope === "room") ok("点威能 = 标为已用（写房间数据）");
else bad("威能标记不对：" + JSON.stringify(res));
res = await T.applyAction("power", el({ k: "daily-0" }), ctx());
if (!res.state.powerUsed["daily-0"]) ok("再点一次 = 恢复");
else bad("威能恢复失败：" + JSON.stringify(res.state.powerUsed));

/* ---- 7b. v1.7.12：遭遇 / 每日 / 辅助 / 种族职业四组威能都能 toggle（与 data-act="power" 同一支） ---- */
for (const cat of ["encounter", "daily", "utility", "special"]) {
  const k = cat + "-0";
  const on = await T.applyAction("power", el({ k }), ctx());
  const off = await T.applyAction("power", el({ k }), ctx());
  if (on.state.powerUsed[k] === true && !off.state.powerUsed[k]) {
    ok("威能组 " + cat + "：点一下=已用、再点=恢复");
  } else bad("威能组 " + cat + " 不能切换：" + JSON.stringify({ on: on.state.powerUsed, off: off.state.powerUsed }));
}

/* ---- 8. 装备 / 专长 ---- */
/* v1.7.12：装备动作名改成 equipment；key 用稳定 id（前缀:物品id:序号），带空格 / 中文也要能存能取。 */
const EQUIP_KEY = "e:霜冻武器 Frost Weapon:1";
res = await T.applyAction("equipment", el({ k: EQUIP_KEY }), ctx());
if (res.state.equipmentUsed[EQUIP_KEY] === true) ok("装备可标记已用（data-act=\"equipment\" + 稳定 id key）"); else bad("装备标记失败");
res = await T.applyAction("equipment", el({ k: EQUIP_KEY }), ctx());
if (!res.state.equipmentUsed[EQUIP_KEY]) ok("装备再点一次 = 恢复"); else bad("装备恢复失败");
res = await T.applyAction("item", el({ k: "e:韵律之刃 Rhythm Blade:1" }), ctx());
if (res.state.equipmentUsed["e:韵律之刃 Rhythm Blade:1"] === true) ok("老的 item 动作名仍兼容（v1.2.0 页面缓存）");
else bad("item 动作名兼容失败");
res = await T.applyAction("feat", el({ k: "g-猛冲之力" }), ctx());
if (res.state.featUsed["g-猛冲之力"] === true) ok("专长可标记已用（职业赠送键 g-…）"); else bad("专长标记失败");

/* ---- 9. 行动点 / 里程碑 / 每日威能 ---- */
res = await T.applyAction("ap", el({ d: "1" }), ctx());
if (res.state.actionPoints === 2) ok("行动点 +1 → 2"); else bad("行动点不对：" + res.state.actionPoints);
res = await T.applyAction("ap", el({ d: "1" }), ctx());
res = await T.applyAction("ap", el({ d: "1" }), ctx());
res = await T.applyAction("ap", el({ d: "1" }), ctx());
res = await T.applyAction("ap", el({ d: "1" }), ctx());
if (res.state.actionPoints === 5) ok("行动点封顶 5"); else bad("行动点没有封顶：" + res.state.actionPoints);
res = await T.applyAction("item-daily", el({ d: "1" }), ctx());
res = await T.applyAction("item-daily", el({ d: "1" }), ctx());
res = await T.applyAction("item-daily", el({ d: "1" }), ctx());
if (res.state.itemDailyUsed === 2) ok("魔法物品每日威能封顶到上限 2"); else bad("每日威能没有封顶：" + res.state.itemDailyUsed);

/* ---- 10. 长休 ---- */
item.metadata = {};
res = await T.applyAction("rest-long", el({}), ctx());
if (res.state.actionPoints === 1 && res.state.milestones === 0 &&
  Object.keys(res.state.powerUsed).length === 0 && Object.keys(res.state.equipmentUsed).length === 0 &&
  res.hp.cur === 20 && res.hp.temp === 0 && res.hp.surges === 4) ok("长休：资源清空 + 生命/回复力回满");
else bad("长休结果不对：" + JSON.stringify(res));

/* ---- 11. 短休只清遭遇威能 ---- */
await T.commitState("c-1", (s) => {
  s.powerUsed = { "encounter-0": true, "daily-0": true };
  return s;
});
res = await T.applyAction("rest-short", el({}), ctx());
if (!res.state.powerUsed["encounter-0"] && res.state.powerUsed["daily-0"]) ok("短休只清遭遇威能，每日威能保留");
else bad("短休清错：" + JSON.stringify(res.state.powerUsed));

/* ---- 12. 房间数据写不进去 → 退本机 ---- */
roomFails = true;
res = await T.applyAction("power", el({ k: "encounter-1" }), ctx());
const stored = JSON.parse(store["4enext/state/c-1"] || "{}");
if (res.scope === "local" && res.tone === "WARNING" && stored.powerUsed && stored.powerUsed["encounter-1"]) {
  ok("房间数据写不进去时退回本机，并给出 WARNING 提示");
} else bad("本机兜底不对：" + JSON.stringify({ scope: res.scope, stored }));

const loaded = await T.loadState("c-1");
if (loaded.scope === "local" && loaded.state.powerUsed["encounter-1"]) ok("之后读状态时继续用本机那份");
else bad("本机状态读取不对：" + JSON.stringify(loaded));

/* ---------------------------------------------------------------------------
 * 13. v1.8.1：资源标记「读-改-写」竞态（真机 bug：点 A 把已用过的 B 改回未使用）
 * ---------------------------------------------------------------------------
 * 真机根因：OBR 的 room.getMetadata() 有同步延迟（回声延迟）——刚 setMetadata 写完，
 * 下一次 getMetadata 仍可能返回写之前的旧快照。commitState 若拿旧快照做 base，
 * 上一次写入的 powerUsed 键就被整份覆盖掉。这里用假 OBR 的 echoDelay 复现，
 * 并要求 17 个威能 / 专长 / 装备 / 两个页面交替点击都不丢标记。 */
echoDelay = true;

const raceCtx = (cardId) => ({
  cardId: cardId, itemId: null, hp: null, state: null,
  maxHp: 20, surgesMax: 4, surgeValue: 5, canHp: false, itemDailyMax: 2
});
function resetRace() {
  for (const k of Object.keys(roomMeta)) delete roomMeta[k];
  for (const k of Object.keys(visibleMeta)) delete visibleMeta[k];
  pendingMeta = null;
  for (const k of Object.keys(store)) delete store[k];
  roomFails = false;
}

console.log("== 13 回声延迟：资源标记读-改-写竞态（v1.8.1）");
const POWERS17 = [];
for (let i = 0; i < 5; i++) POWERS17.push("encounter-" + i);
for (let i = 0; i < 5; i++) POWERS17.push("daily-" + i);
for (let i = 0; i < 4; i++) POWERS17.push("utility-" + i);
for (let i = 0; i < 3; i++) POWERS17.push("special-" + i);
resetRace();
for (const k of POWERS17) await T.applyAction("power", el({ k }), raceCtx("c-race-17"));
let race = await T.loadState("c-race-17");
const lost17 = POWERS17.filter((k) => !race.state.powerUsed[k]);
if (!lost17.length) ok("回声延迟下连点 17 个威能（遭遇/每日/辅助/种族职业）全部保留");
else bad("回声延迟下丢了 " + lost17.length + " 个威能标记：" + lost17.join(","));
await T.applyAction("power", el({ k: POWERS17[0] }), raceCtx("c-race-17"));
race = await T.loadState("c-race-17");
const lost16 = POWERS17.slice(1).filter((k) => !race.state.powerUsed[k]);
if (!race.state.powerUsed[POWERS17[0]] && !lost16.length)
  ok("再点一次 A 只把 A 恢复为未用，其它 16 个标记还在（不互相覆盖）");
else bad("再点 A 把其它标记也动了：" + JSON.stringify({ a: !!race.state.powerUsed[POWERS17[0]], lost: lost16 }));

resetRace();
for (const k of ["daily-0", "daily-1", "daily-2"]) await T.applyAction("power", el({ k }), raceCtx("c-race-3"));
race = await T.loadState("c-race-3");
if (["daily-0", "daily-1", "daily-2"].every((k) => race.state.powerUsed[k]))
  ok("回声延迟下连续点 3 次（同一张卡）不丢标记");
else bad("回声延迟下连点 3 次丢标记：" + JSON.stringify(race.state.powerUsed));

resetRace();
for (let i = 0; i < 5; i++) await T.applyAction("feat", el({ k: "g-race-" + i }), raceCtx("c-race-feat"));
for (let i = 0; i < 5; i++) await T.applyAction("equipment", el({ k: "e:race-" + i + ":1" }), raceCtx("c-race-eq"));
const featState = (await T.loadState("c-race-feat")).state;
const eqState = (await T.loadState("c-race-eq")).state;
const lostFeat = Array.from({ length: 5 }, (_, i) => "g-race-" + i).filter((k) => !featState.featUsed[k]);
const lostEq = Array.from({ length: 5 }, (_, i) => "e:race-" + i + ":1").filter((k) => !eqState.equipmentUsed[k]);
if (!lostFeat.length && !lostEq.length) ok("回声延迟下专长连续点 5 个 / 装备连续点 5 个都不丢");
else bad("专长或装备丢标记：" + JSON.stringify({ lostFeat, lostEq }));

resetRace();
const PAIR_CARD = "c-race-pair";
await T.loadState(PAIR_CARD);
await TB.loadState(PAIR_CARD);
const PAIR_KEYS = Array.from({ length: 6 }, (_, i) => "e:pair-" + i + ":1");
for (let i = 0; i < PAIR_KEYS.length; i++) {
  const M = i % 2 === 1 ? TB : T;
  await M.applyAction("equipment", el({ k: PAIR_KEYS[i] }), raceCtx(PAIR_CARD));
}
const seenA = (await T.loadState(PAIR_CARD)).state;
const seenB = (await TB.loadState(PAIR_CARD)).state;
const lostA = PAIR_KEYS.filter((k) => !seenA.equipmentUsed[k]);
const lostB = PAIR_KEYS.filter((k) => !seenB.equipmentUsed[k]);
if (!lostA.length && !lostB.length) ok("两个页面实例交替点同一张卡的装备：最终状态是两者并集（不互相覆盖）");
else bad("两个页面互相覆盖：" + JSON.stringify({ lostA, lostB }));

echoDelay = false;

/* ---------------------------------------------------------------------------
 * 14. v1.8.4：syncTokenStats 在 token 没有 HP 上限时用卡里的 maxHp 播种血条
 * ------------------------------------------------------------------------- */
console.log("== 14 syncTokenStats：补 HP 上限（绑卡 / 首次打开速览后要长出血条）");
item.metadata = {};
const hpCtx = { maxHp: 40, surgesMax: 4, defenses: [{ key: "ac", value: 18 }, { key: "fort", value: 17 }] };
const seeded = await T.syncTokenStats(item.id, T.hpView(null, { maxHp: 40, surges: 4 }), hpCtx);
const hSeeded = item.metadata[T.KEY_HP];
if (seeded === true && hSeeded && hSeeded.max === 40 && hSeeded.cur === 40 &&
  hSeeded.surgesMax === 4 && hSeeded.defenses && hSeeded.defenses.ac === 18 && hSeeded.defenses.reflex === undefined &&
  hSeeded.defenses.will === undefined)
  ok("没 HP 上限的 token：syncTokenStats 写 cur = max = 40 + 回复力上限 4 + 四防（只补缺）");
else bad("syncTokenStats 没有播种 HP 上限：" + JSON.stringify({ seeded, hp: hSeeded }));

/* 已有 max：一律不动（只可能补回复力 / 四防） */
item.metadata[T.KEY_HP] = { cur: 10, max: 50, temp: 1, surges: 2, surgesMax: 4, locked: false };
const hpCtx2 = { maxHp: 40, surgesMax: 4, defenses: null };
const seeded2 = await T.syncTokenStats(item.id, T.hpView(item.metadata[T.KEY_HP], { maxHp: 40, surges: 4 }), hpCtx2);
const hKept = item.metadata[T.KEY_HP];
if (seeded2 === false && hKept.cur === 10 && hKept.max === 50 && hKept.temp === 1 && hKept.locked === false)
  ok("已有 max 的 token：syncTokenStats 不动 cur / max / temp / locked（没有重复写）");
else bad("syncTokenStats 覆盖了已有血量：" + JSON.stringify({ seeded2, hp: hKept }));

/* 显式移除血条组件：不播种、不画 */
item.metadata = { [T.KEY_HPBAR]: false };
const seeded3 = await T.syncTokenStats(item.id, T.hpView(null, { maxHp: 40, surges: 4 }), hpCtx);
if (seeded3 === false && !item.metadata[T.KEY_HP])
  ok("显式「移除血条组件」（enabled=false）的 token：syncTokenStats 不播种 HP");
else bad("syncTokenStats 给移除血条组件的 token 又写了 HP：" + JSON.stringify(item.metadata));

/* ---------------------------------------------------------------------------
 * 15. v2.4.16：四防临时值不被 syncTokenStats 回写（combineDefenses + ctx.defTemp）
 * ------------------------------------------------------------------------- */
console.log("== 15 四防临时值联动不被 syncTokenStats 回写");
{
  const comb = C.combineDefenses({ ac: 18, fort: 17, reflex: 16 }, { ac: 0, fort: 2, ref: 1, will: 0 });
  if (comb && comb.ac === 18 && comb.fort === 19 && comb.reflex === 17 && !("will" in comb))
    ok("v2.4.16：combineDefenses ← ref→reflex、卡片基础 + 临时值、卡片没有的项不返回（保留 token 原值）");
  else bad("v2.4.16：combineDefenses 合并不对：" + JSON.stringify(comb));
  const comb2 = C.combineDefenses({ ac: 10, fort: 5 }, { fort: -3.6, ac: 2.4 });
  if (comb2 && comb2.ac === 12 && comb2.fort === 1)
    ok("v2.4.16：combineDefenses 先 round 再加、结果 clamp 到 ≥0（10+2.4→12、5-3.6→1）");
  else bad("v2.4.16：combineDefenses round / clamp 不对：" + JSON.stringify(comb2));

  const baseDef = { ac: 18, fort: 17, reflex: 16 };
  item.metadata = { [T.KEY_HP]: { cur: 10, max: 20, surges: 4, surgesMax: 4, defenses: { ac: 18, fort: 19, reflex: 17 } } };
  const hpPlus = T.hpView(item.metadata[T.KEY_HP], { maxHp: 20, surges: 4 });
  const noisy = await T.syncTokenStats(item.id, hpPlus, {
    maxHp: 20, surgesMax: 4, defenses: [{ key: "ac", value: 18 }, { key: "fort", value: 17 }, { key: "ref", value: 16 }],
    defTemp: { ac: 0, fort: 2, ref: 1, will: 0 }
  });
  if (noisy === false && item.metadata[T.KEY_HP].defenses.fort === 19)
    ok("v2.4.16：token 已是 base+temp、defTemp 也带同样临时值 → syncTokenStats 返回 false 且不写（旧逻辑会回写 base）");
  else bad("v2.4.16：token=base+temp 仍被回写：" + JSON.stringify({ noisy, def: item.metadata[T.KEY_HP].defenses }));
  const zeroed = await T.syncTokenStats(item.id, T.hpView(item.metadata[T.KEY_HP], { maxHp: 20, surges: 4 }), {
    maxHp: 20, surgesMax: 4, defenses: [{ key: "ac", value: 18 }, { key: "fort", value: 17 }, { key: "ref", value: 16 }],
    defTemp: { ac: 0, fort: 0, ref: 0, will: 0 }
  });
  if (zeroed === true && item.metadata[T.KEY_HP].defenses.fort === 17 && item.metadata[T.KEY_HP].defenses.reflex === 16)
    ok("v2.4.16：临时值清零后 token 仍是 base+temp → syncTokenStats 正确写回 base（短/长休还原路径）");
  else bad("v2.4.16：清零后没有写回 base：" + JSON.stringify({ zeroed, def: item.metadata[T.KEY_HP].defenses }));
}

/* ---- v2.4.16：血条显示策略 / 量化 ---- */
{
  const modes = [
    T.computeViewMode({ role: "GM", locked: true, hide: false, phase: "idle" }),
    T.computeViewMode({ role: "PLAYER", isOwner: true, locked: true, hide: false, phase: "idle" }),
    T.computeViewMode({ role: "PLAYER", locked: true, hide: false, phase: "combat" }),
    T.computeViewMode({ role: "PLAYER", locked: true, hide: false, phase: "idle" }),
    T.computeViewMode({ role: "PLAYER", locked: false, hide: false, phase: "idle" }),
    T.computeViewMode({ role: "PLAYER", locked: true, hide: true, phase: "combat" })
  ];
  if (modes.join(",") === "full,full,silhouette,hidden,full,hidden")
    ok("v2.4.16：computeViewMode GM/owner→full，locked+战斗→silhouette，locked+空闲→hidden，unlocked→full，hide→hidden");
  else bad("v2.4.16：computeViewMode 不对：" + modes.join(","));
  if (T.quantiseRatio(0.32) === 0.5 && T.quantiseRatio(0.1) === 0.25 && T.quantiseRatio(0) === 0 && T.quantiseRatio(1) === 1)
    ok("v2.4.16：quantiseRatio 25% 步进（0.32→0.5 / 0.1→0.25 / 0→0）");
  else bad("v2.4.16：quantiseRatio 不对");
  const core = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (core.indexOf("it.visible === false") >= 0 && core.indexOf("hide: m.hide === true") >= 0 &&
    core.indexOf("quantiseBarRatio") >= 0)
    ok("v2.4.16：地图血条跳过不可见 token / 支持 hide / silhouette 量化");
  else bad("v2.4.16：地图血条可见性/hide/量化缺失");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
