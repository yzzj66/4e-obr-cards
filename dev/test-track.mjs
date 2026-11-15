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
    getMetadata: async () => roomMeta,
    setMetadata: async (update) => {
      if (roomFails) throw new Error("只有城主能写房间数据");
      for (const k of Object.keys(update)) roomMeta[k] = update[k];
    }
  }
};

const tmp = path.join(os.tmpdir(), "4enext-track-test");
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "obr-stub.mjs"), "const OBR = " + JSON.stringify({}) + ";\nexport default globalThis.__OBR__;\n", "utf8");
globalThis.__OBR__ = OBR;
fs.writeFileSync(path.join(tmp, "common-stub.mjs"), 'export const NS = "com.4enext-owlbear";\n', "utf8");

let src = fs.readFileSync(path.join(ROOT, "assets", "track.js"), "utf8");
src = src.replace('from "../vendor/obr-sdk.js"', 'from ' + JSON.stringify(pathToFileURL(path.join(tmp, "obr-stub.mjs")).href));
src = src.replace('from "./common.js"', 'from ' + JSON.stringify(pathToFileURL(path.join(tmp, "common-stub.mjs")).href));
const modPath = path.join(tmp, "track.mjs");
fs.writeFileSync(modPath, src, "utf8");

const T = await import(pathToFileURL(modPath).href);
const ctx = () => ({ cardId: "c-1", itemId: item.id, hp: null, state: null, maxHp: 20, surgesMax: 4, surgeValue: 5, canHp: true, itemDailyMax: 2 });
const el = (data) => ({ dataset: data || {}, closest: () => null, querySelector: () => null });

/* ---- 1. 默认值 ---- */
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

/* ---- 8. 装备 / 专长 ---- */
res = await T.applyAction("item", el({ k: "e-2" }), ctx());
if (res.state.equipmentUsed["e-2"] === true) ok("装备可标记已用"); else bad("装备标记失败");
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

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
