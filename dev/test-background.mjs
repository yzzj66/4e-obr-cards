// 后台逻辑冒烟测试（无浏览器）：用假的 OBR 跑一遍 assets/background.core.js，
// 检查「工具栏 / 右键菜单 / 浮动按钮 / 自诊断通知 / 心跳 / token 血条」这几步真的被调用了。
// 用法：node dev/test-background.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");

let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const calls = [];
const record = (name, arg) => calls.push([name, arg]);
const last = (name) => [...calls].reverse().find((c) => c[0] === name);
const all = (name) => calls.filter((c) => c[0] === name);

const noopUnsub = () => () => {};

// --- 假场景：一枚带血量的 IMAGE token ---
const TOKEN_ID = "tok-1";
const HP_KEY = "com.4enext-owlbear/hp";
const token = {
  id: TOKEN_ID,
  type: "IMAGE",
  name: "示例勇者",
  layer: "CHARACTER",
  createdUserId: "user-gm",
  position: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  metadata: {
    "com.4enext-owlbear/cardId": "c-1",
    [HP_KEY]: { cur: 12, max: 20, temp: 0, updatedAt: 1 }
  }
};
let sceneItems = [token];
/* v1.6.1：四防改一排后要验证「窄 token 退化保留 AC」，所以每枚 token 可以有自己的包围盒。 */
const boundsFor = {
  [TOKEN_ID]: { min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 }
};
// 预置一个「上一次会话残留」的血条 item：后台启动后应该把它清掉，否则血条会叠成两层
let localItems = [{ id: "stale-bar-1", type: "CURVE", metadata: { "com.4enext-owlbear/bar": { owner: "old-token", role: "bg" } } }];
const itemsChangeCbs = [];
const roomChangeCbs = [];
const localChangeCbs = [];
const playerChangeCbs = [];
const viewportChangeCbs = [];
const broadcastCbs = {};
const lsStore = {};
/* 一张卡：让 refreshInfo 认为 token 绑定有效，才能把速览弹窗开起来。 */
const CARD = { id: "c-1", name: "示例勇者", level: 1, char: {} };
let selection = [];
/* v1.5.0：房间数据要能「写进去再读出来」，骰子落库的合并 / 去重 / 封顶断言全靠它。 */
/* 测试默认关掉「骰子记录窗口自动打开」，避免 800ms 定时器干扰其它用例；自动打开本身在下面单独测。 */
lsStore["4enext/dice-hist-autostart"] = "0";
const roomMeta = { "com.4enext-owlbear/cards": { v: 1, cards: [CARD] } };
/* v1.9.2：启动时应把房间里的旧骰子历史迁移到本机（并清空房间 KEY_ROLLS）。 */
roomMeta["com.4enext-owlbear/rolls"] = {
  v: 1, updatedAt: 1, seq: 3, rows: [
    { rollId: "mig-1", ts: 100, rollerName: "旧1", dice: [{ type: "d20", value: 5 }], total: 5 },
    { rollId: "mig-2", ts: 200, rollerName: "旧2", dice: [{ type: "d20", value: 15 }], total: 15 }
  ]
};
/* v1.5.0：角色可变（验证「玩家不写房间数据」） */
let role = "GM";

function stubBuilder(type) {
  let seq = 0;
  return function () {
    const item = {
      id: "local-" + type.toLowerCase() + "-" + (++seq) + "-" + Math.random().toString(36).slice(2, 6),
      type,
      metadata: {},
      visible: true,
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      text: type === "TEXT" ? { plainText: "", style: { fontSize: 16 }, width: 0, height: 0 } : undefined
    };
    const api = new Proxy({}, {
      get(_t, key) {
        if (key === "build") return () => JSON.parse(JSON.stringify(item));
        return (value) => {
          if (type === "TEXT" && ["plainText", "fontSize", "width", "height", "textType"].includes(key)) {
            if (key === "fontSize") item.text.style.fontSize = value;
            else item.text[key] = value;
          } else {
            item[key] = value;
          }
          return api;
        };
      }
    });
    return api;
  };
}

const OBR = {
  isAvailable: true,
  isReady: false,
  onReady(cb) { readyCb = cb; },
  notification: { show(msg, variant) { record("notification.show", { msg, variant }); return Promise.resolve("id"); }, close() {} },
  viewport: {
    getWidth: async () => 1200,
    getHeight: async () => 800,
    getScale: async () => 1,
    transformPoint: async (p) => p,
    onChange(fn) { record("viewport.onChange", true); viewportChangeCbs.push(fn); return noopUnsub(); }
  },
  player: {
    getSelection: async () => selection.slice(),
    getRole: async () => role,
    getId: async () => "user-gm",
    onChange(fn) { record("player.onChange", true); playerChangeCbs.push(fn); return noopUnsub(); }
  },
  party: {},
  scene: {
    isReady: async () => true,
    onReadyChange(fn) { record("scene.onReadyChange", true); sceneReadyCb = fn; return noopUnsub(); },
    onMetadataChange(fn) { record("scene.onMetadataChange", true); return noopUnsub(); },
    getMetadata: async () => ({}),
    grid: {
      getDpi: async () => 150,
      onChange(fn) { record("scene.grid.onChange", true); return noopUnsub(); }
    },
    items: {
      getItems: async (ids) => (Array.isArray(ids) ? sceneItems.filter((it) => ids.includes(it.id)) : sceneItems.slice()),
      getItemBounds: async (ids) => {
        const wanted = Array.isArray(ids) && ids.length ? ids : [TOKEN_ID];
        const box = boundsFor[wanted[0]];
        return box ? JSON.parse(JSON.stringify(box))
          : { min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 };
      },
      /* v1.6.0：右键菜单会写 token metadata（hp-bar/enabled），必须真的落盘再读回来。 */
      updateItems(ids, fn) {
        const drafts = sceneItems.filter((it) => ids.includes(it.id)).map((it) => JSON.parse(JSON.stringify(it)));
        fn(drafts);
        for (const d of drafts) {
          const it = sceneItems.find((x) => x.id === d.id);
          if (it) for (const k of Object.keys(d)) it[k] = d[k];
        }
        record("scene.items.updateItems", drafts);
        return Promise.resolve();
      },
      onChange(fn) { record("scene.items.onChange", true); itemsChangeCbs.push(fn); return noopUnsub(); }
    },
    local: {
      getItems: async () => localItems.slice(),
      addItems(items) { record("local.addItems", items); localItems = localItems.concat(items); return Promise.resolve(); },
      updateItems(ids, fn) {
        const drafts = localItems.filter((it) => ids.includes(it.id)).map((it) => JSON.parse(JSON.stringify(it)));
        fn(drafts);
        record("local.updateItems", drafts);
        return Promise.resolve();
      },
      deleteItems(ids) {
        record("local.deleteItems", ids);
        localItems = localItems.filter((it) => !ids.includes(it.id));
        return Promise.resolve();
      },
      onChange(fn) { record("scene.local.onChange", true); localChangeCbs.push(fn); return noopUnsub(); }
    }
  },
  contextMenu: { create(cfg) { record("contextMenu.create", cfg); return Promise.resolve(); }, remove() {} },
  tool: { create(cfg) { record("tool.create", cfg); return Promise.resolve(); }, remove() {} },
  popover: {
    open(cfg) { record("popover.open", cfg); return Promise.resolve(); },
    close(id) { record("popover.close", id); return Promise.resolve(); }
  },
  modal: {
    open(cfg) { record("modal.open", cfg); return Promise.resolve(); },
    /* v1.7.10：✕ 的后台兜底会补一次 modal.close（panel 可能退化成全屏 modal）。 */
    close(id) { record("modal.close", id); return Promise.resolve(); }
  },
  action: { open: async () => { record("action.open", true); } },
  room: {
    id: "room-1",
    getMetadata: async () => roomMeta,
    setMetadata(update) {
      record("room.setMetadata", update);
      for (const k of Object.keys(update || {})) roomMeta[k] = JSON.parse(JSON.stringify(update[k]));
      return Promise.resolve();
    },
    onMetadataChange(fn) { record("room.onMetadataChange", true); roomChangeCbs.push(fn); return noopUnsub(); }
  },
  broadcast: {
    sendMessage(channel, data, opts) { record("broadcast.sendMessage", { channel, data, opts }); return Promise.resolve(); },
    onMessage(channel, cb) {
      record("broadcast.onMessage", channel);
      (broadcastCbs[channel] = broadcastCbs[channel] || []).push(cb);
      return noopUnsub();
    }
  }
};

// --- 浏览器环境替身 ---
const fakeEl = () => ({ textContent: "", className: "", appendChild() {}, });
const documentStub = {
  title: "",
  getElementById: () => fakeEl(),
  createElement: () => fakeEl(),
  head: { appendChild() {} },
  documentElement: { appendChild() {} }
};
globalThis.location = { href: "https://yzzj66.github.io/4e-obr-cards/background.html", protocol: "https:" };
globalThis.document = documentStub;
globalThis.window = { addEventListener() {} };
globalThis.localStorage = {
  getItem: (k) => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: (k) => { delete lsStore[k]; }
};

// --- 跑起来 ---
// 注意：buildCurve/buildShape/buildText 正常由 bundle 提供（dev/build-background.mjs 从 SDK 具名导出接过来）。
// 这里传打桩版本，才能在不装 SDK 的情况下验证血条代码真的在跑。
let readyCb = null;
let sceneReadyCb = null;
const run = new Function("OBR", "buildCurve", "buildShape", "buildText", CORE + "\nreturn { boot: typeof boot === 'function' ? boot : null, hasHpBarData: typeof hasHpBarData === 'function' ? hasHpBarData : null, openGlance: typeof openGlance === 'function' ? openGlance : null, maybeAutoOpenDiceHistory: typeof maybeAutoOpenDiceHistory === 'function' ? maybeAutoOpenDiceHistory : null, openWin: typeof openWin === 'function' ? openWin : null, onWinResize: typeof onWinResize === 'function' ? onWinResize : null, readWinSize: typeof readWinSize === 'function' ? readWinSize : null, pollViewportAnchor: typeof pollViewportAnchor === 'function' ? pollViewportAnchor : null, reanchorButton: typeof reanchorButton === 'function' ? reanchorButton : null, installViewportAnchor: typeof installViewportAnchor === 'function' ? installViewportAnchor : null, stopViewportAnchor: typeof stopViewportAnchor === 'function' ? stopViewportAnchor : null, openButton: typeof openButton === 'function' ? openButton : null, closeButton: typeof closeButton === 'function' ? closeButton : null, reclampWins: typeof reclampWins === 'function' ? reclampWins : null };");
const BG = run(OBR, stubBuilder("CURVE"), stubBuilder("SHAPE"), stubBuilder("TEXT"));

(async () => {
  if (typeof readyCb !== "function") { bad("没有注册 OBR.onReady"); return finish(); }
  ok("注册了 OBR.onReady");
  await readyCb();
  await sleep(240);
  /* v1.9.2：骰子不再有工具栏按钮；窗口几何仍由 WINS.dice 管（action popover 由 OBR 直接开 dice.html）。 */
  async function openDiceWindow() {
    const before = all("popover.open").length;
    if (BG.openWin) await BG.openWin("dice");
    await sleep(140);
    return all("popover.open").map((c) => c[1]).slice(before)
      .filter((c) => /\/dice\.html(?:\?.*)?$/.test(String(c.url))).pop() || null;
  }

  /* v1.3.1：工具栏上三个并列入口（角色卡 / 先攻 / 骰子），各开各的窗口 */
  const tools = all("tool.create").map((c) => c[1]);
  const toolById = (re) => tools.filter((t) => re.test(t.id))[0] || null;
  const toolPanel = toolById(/\/panel-tool$/);
  const toolInit = toolById(/\/initiative-tool$/);
  if (!tools.length) bad("没有调用 OBR.tool.create（工具栏入口）");
  else if (!toolPanel || !toolInit) bad("工具栏入口不齐：panel=" + !!toolPanel + " initiative=" + !!toolInit);
  else if (!toolById(/\/dice-tool$/)) bad("骰子工具入口缺失");
  else if (!/^https:\/\/.+icon-tool(-initiative)?\.svg$/.test(toolPanel.icons[0].icon) ||
    !/^https:\/\/.+icon-tool-initiative\.svg$/.test(toolInit.icons[0].icon)) bad("tool.create 的图标不是绝对地址 / 不是各自的小徽标");
  else ok("OBR.tool.create（角色卡 / 先攻 / 传送门 / 骰子）已注册");

  /* v1.3.2：工具栏补齐成一排（速览 / 角色卡 / 先攻 / 骰子 / 设置） */
  const toolGlanceRemoved = toolById(/\/glance-tool$/);
  const toolSettingsRemoved = toolById(/\/settings-tool$/);
  if (toolGlanceRemoved || toolSettingsRemoved) bad("v2.4.13：速览 / 设置仍注册成工具");
  else ok("v2.4.13：工具栏已移除速览 / 设置（只剩角色卡 / 先攻 / 传送门）");
  if (tools.length !== 4) bad("工具栏入口不是四个，而是 " + tools.length + " 个");
  else ok("OBR.tool.create ×4（角色卡 / 先攻 / 传送门 / 骰子）；设置走右下浮动按钮");

  const menu = last("contextMenu.create");
  if (!menu) bad("没有调用 OBR.contextMenu.create（右键菜单）");
  else {
    const icon = menu[1].icons[0];
    if (!icon.filter || !icon.filter.roles || icon.filter.roles.indexOf("GM") < 0) bad("右键菜单 filter.roles 不是 [\"GM\"]");
    else if (!/^https:\/\//.test(icon.icon)) bad("右键菜单图标不是绝对地址");
    else if (icon.filter.every[0].key !== "type" || icon.filter.every[0].value !== "IMAGE") bad("右键菜单 every 过滤不对");
    else ok("OBR.contextMenu.create（GM + IMAGE）已注册");
  }

  const pop = all("popover.open").map((c) => c[1]).filter((cfg) => cfg.id === "com.4enext-owlbear/button").pop();
  if (!pop) bad("没有调用 OBR.popover.open（右下角浮动按钮）");
  else if (pop.anchorReference !== "POSITION") bad("popover.open 没有用 anchorReference: POSITION");
  else if (!/\/button\.html(?:\?.*)?$/.test(pop.url)) bad("浮动按钮的 url 不对：" + pop.url);
  else if (pop.hidePaper !== true) bad("浮动按钮没有 hidePaper");
  else ok("OBR.popover.open 的锚点参数与参考实现一致");

  /* [v1.7.8] 反向断言：启动成功**不再**弹「已加载 …」汇总通知（用户嫌提示太多）；
   * 只有某个入口没注册上才会 WARNING。这里断言「启动后一条通知都没有」。 */
  const notes = calls.filter((c) => c[0] === "notification.show").map((c) => c[1]);
  if (notes.length) bad("启动成功却弹了通知（v1.7.8 起成功类通知必须为 0）：" + notes.map((n) => n.variant + " " + n.msg).join(" | "));
  else ok("启动成功一条通知都没弹（v1.7.8：成功类通知为 0，失败才提示）");

  const hello = calls.find((c) => c[0] === "broadcast.sendMessage" && /diag-hello$/.test(c[1].channel));
  if (!hello) bad("没有发后台心跳（diag-hello）"); else ok("发了后台心跳（面板会显示「后台已连接」）");

  if (!calls.some((c) => c[0] === "broadcast.onMessage")) bad("没有订阅 diag-ping"); else ok("订阅了面板的 ping");

  /* 面板 ping → 后台 pong：频道名必须两端对得上，否则面板永远显示「后台脚本没有响应」 */
  {
    const pingCbs = broadcastCbs["com.4enext-owlbear/diag-ping"] || [];
    if (!pingCbs.length) bad("没有监听 diag-ping（面板的 ping 没人接）");
    else {
      const before = calls.filter((c) => c[0] === "broadcast.sendMessage").length;
      pingCbs[0]({ data: { at: Date.now() } });
      await sleep(30);
      const pongs = calls.filter((c) => c[0] === "broadcast.sendMessage").slice(before)
        .map((c) => c[1]).filter((m) => /diag-pong$/.test(m.channel));
      if (!pongs.length) bad("收到 diag-ping 没有回 diag-pong（面板会一直显示「后台脚本没有响应」）");
      else if (pongs[0].channel !== "com.4enext-owlbear/diag-pong") bad("pong 的频道名不对：" + pongs[0].channel);
      else if (pongs[0].opts && pongs[0].opts.destination !== "LOCAL") bad("pong 不是发到 LOCAL：" + JSON.stringify(pongs[0].opts));
      else ok("面板 ping → 后台 pong（" + pongs[0].channel + "，LOCAL）");
    }
  }

  /* ---- v1.2.0：token 血条 ---- */
  const swept = all("local.deleteItems").map((c) => c[1]).flat();
  if (swept.indexOf("stale-bar-1") >= 0) ok("启动时清掉了上一次会话残留的血条 item");
  else bad("没有清理残留的血条 item（会导致血条叠两层）");

  /* v2.4.13：血条 = 用户样板布局（底部比例横条 + 左侧三圆 + 右下盾），不再用环形。
   * tok-1 包围盒 150×150、dpi 150 → s=1：条 96×15 @ (75,136.5)，圆角 7.5。 */
  const BAR_KEY = "com.4enext-owlbear/bar";
  const HPBAR_KEY = "com.4enext-owlbear/hp-bar/enabled";
  const roleOf1 = (it) => (it.metadata && it.metadata[BAR_KEY] ? it.metadata[BAR_KEY].role : "");
  const spanOf = (it, k) => {
    const vals = (it.points || [{ [k]: 0 }]).map((pt) => pt[k]);
    return Math.max.apply(null, vals) - Math.min.apply(null, vals);
  };
  const shapeH = (it) => spanOf(it, "y");
  const shapeW = (it) => spanOf(it, "x");
  const liveOf = (id) => localItems.filter((it) => it.attachedTo === id);
  const added = all("local.addItems").map((c) => c[1]).flat();
  if (!added.length) bad("没有给带血量的 token 画血条（scene.local.addItems 没被调用）");
  else {
    const bg = added.find((it) => roleOf1(it) === "bar-bg");
    const fill = added.find((it) => roleOf1(it) === "bar-fill");
    const text = added.find((it) => roleOf1(it) === "bar-text");
    if (!bg || !fill || !text) bad("底部血条不齐：bar-bg=" + !!bg + " bar-fill=" + !!fill + " bar-text=" + !!text);
    else if (added.some((it) => ["ring-bg", "ring-fill", "surge-bg", "surge-fill", "surge-text"].indexOf(roleOf1(it)) >= 0)) {
      bad("v2.4.13 不该再画环形 / 直条 / 蓝条：" + added.map(roleOf1).join(","));
    } else if (bg.points.length !== 28) bad("圆角条不是 24 段近似（应 28 点）：" + bg.points.length);
    else if (Math.abs(shapeW(bg) - 96) > 0.01 || Math.abs(shapeH(bg) - 15) > 0.01) {
      bad("底部条尺寸不对（应 96×15）：" + shapeW(bg) + "×" + shapeH(bg));
    } else if (Math.abs(bg.position.x - 75) > 0.01 || Math.abs(bg.position.y - 136.5) > 0.01) {
      bad("底部条位置不对（应 75,136.5）：" + JSON.stringify(bg.position));
    } else if (bg.attachedTo !== TOKEN_ID || bg.layer !== "ATTACHMENT") bad("血条没有 attachedTo / ATTACHMENT");
    else if (!(bg.zIndex < fill.zIndex && fill.zIndex < text.zIndex)) bad("血条 zIndex 顺序不对：" + bg.zIndex + "/" + fill.zIndex + "/" + text.zIndex);
    else if (!text.text || text.text.plainText !== "12/20") bad("条内数字不对：" + JSON.stringify(text.text));
    else ok("v2.4.13：底部圆角血条已画（96×15 @75,136.5、28 点、填充 12/20、ATTACHMENT），没有环形 / 直条 / 蓝条");
  }

  /* 血量变了 → 走 updateItems 刷新（不是重建） */
  token.metadata[HP_KEY] = { cur: 5, max: 20, temp: 3, updatedAt: 2 };
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(240);
  const patched = all("local.updateItems").map((c) => c[1]).flat();
  const patchedText = patched.find((it) => roleOf1(it) === "bar-text");
  const patchedFill = patched.find((it) => roleOf1(it) === "bar-fill");
  const patchedFillColor = patchedFill && patchedFill.style ? patchedFill.style.fillColor : "";
  if (!patched.length) bad("血量变化后没有刷新血条（scene.local.updateItems 没被调用）");
  else if (!patchedText || patchedText.text.plainText !== "5/20 +3") bad("刷新后的血条数字不对：" + JSON.stringify(patchedText && patchedText.text));
  else if (!patchedFill) bad("血量变化后填充条没有参与刷新");
  else ok("血量变化后血条就地刷新：" + patchedText.text.plainText + "（填充条参与 updateItems）");

  /* 血条被外部删掉 → 自愈重建 */
  const before = all("local.addItems").length;
  localItems = [];
  for (const cb of localChangeCbs) cb([]);
  await sleep(300);
  if (all("local.addItems").length <= before) bad("血条 item 被删掉后没有自动重建");
  else ok("血条 item 被外部删掉后自动重建");

  /* 血条数据没了（解绑 / 手删）→ 清掉本地图形 */
  delete token.metadata[HP_KEY];
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(240);
  if (!all("local.deleteItems").length) bad("血量数据被删掉后没有清理本地血条 item");
  else ok("血量数据被删掉后清理了本地血条 item");

  /* =======================================================================
   * token2 包围盒 150×150、dpi 150 → s=1：
   *   条：96×15 @ (75,136.5)；左侧三圆：直径 24、x=21、y=51/81/111（上→下 强/反/意）；
   *   AC 盾：30×32.4 @ (129,127.8)。
   * ===================================================================== */
  const TOKEN2 = "tok-2";
  const token2 = {
    id: TOKEN2,
    type: "IMAGE",
    name: "巨魔",
    layer: "CHARACTER",
    createdUserId: "user-owner",
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    metadata: {
      [HP_KEY]: {
        cur: 12, max: 20, temp: 3, surges: 5, surgesMax: 6,
        defenses: { ac: 28, fort: 23, reflex: 25, will: 25 },
        locked: true, updatedAt: 3
      }
    }
  };
  sceneItems.push(token2);
  const barRoleOf = (it) => (it.metadata && it.metadata[BAR_KEY] ? it.metadata[BAR_KEY].role : "");
  const t2role = (role) => liveOf(TOKEN2).filter((it) => barRoleOf(it) === role);
  const t2one = (role) => t2role(role)[0] || null;
  const keyOf = (it) => (it.metadata && it.metadata[BAR_KEY] ? it.metadata[BAR_KEY].key : "");
  const defByKey = (key) => t2role("def").filter((it) => keyOf(it) === key)[0] || null;
  const defTextByKey = (key) => t2role("def-text").filter((it) => keyOf(it) === key)[0] || null;
  const centerOf = (it) => ({ x: it.position.x + shapeH(it) / 2, y: it.position.y + shapeH(it) / 2 });

  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  let t2 = liveOf(TOKEN2);
  const t2roles = t2.map(barRoleOf);
  {
    const gone = t2roles.filter((r) => ["ring-bg", "ring-fill", "surge-bg", "surge-fill", "surge-text",
      "plate", "plate-text", "plate-phase", "divider", "lock-body", "lock-shackle"].indexOf(r) >= 0);
    if (gone.length) bad("v2.4.13 不该再画环形 / 蓝条 / Boss 名牌 / 分段 / 锁：" + gone.join(","));
    else if (t2.length !== 11) bad("带四防的 token 应画 11 件（条 2 + 数字 1 + 3 圆 + 3 数字 + AC 盾 + AC 数字），实际 " + t2.length + "（" + t2roles.join(",") + "）");
    else if (t2role("def").length !== 3 || t2role("def-text").length !== 3 || t2role("ac-shield").length !== 1 || t2role("ac-text").length !== 1) {
      bad("四防图形不是 3 圆 + 3 数字 + AC 盾 + AC 数字：" + t2roles.join(","));
    } else if (t2.some((it) => it.layer !== "ATTACHMENT" || it.attachedTo !== TOKEN2)) {
      bad("血条不在 ATTACHMENT 层 / 没 attachedTo");
    } else if (t2.some((it) => !Array.isArray(it.disableAttachmentBehavior) || it.disableAttachmentBehavior.indexOf("SCALE") < 0)) {
      bad("血条没有禁用 SCALE 继承");
    } else {
      ok("v2.4.13：带四防的 token 画 11 件（底部条 2 + 数字 1 + 左侧 3 圆 + 3 数字 + 右下 AC 盾 + AC 数字）");
    }
  }

  /* ---- 底部条：96×15 @ (75,136.5)、比例填充 0.6、文字在条内 ---- */
  {
    const bg = t2one("bar-bg");
    const fill = t2one("bar-fill");
    const textItem = t2one("bar-text");
    const textCenter = textItem && textItem.text
      ? { x: textItem.position.x + textItem.text.width / 2, y: textItem.position.y + textItem.text.height / 2 }
      : null;
    if (!bg || !fill) bad("底部血条没画（bar-bg / bar-fill 缺）");
    else if (Math.abs(shapeW(bg) - 96) > 0.01 || Math.abs(shapeH(bg) - 15) > 0.01) {
      bad("底部条不是 96×15：" + shapeW(bg) + "×" + shapeH(bg));
    } else if (Math.abs(bg.position.x - 75) > 0.01 || Math.abs(bg.position.y - 136.5) > 0.01) {
      bad("底部条不在底部居中：" + JSON.stringify(bg.position));
    } else if (bg.fillColor !== "#3a1414") bad("轨道底色不是 #3a1414：" + bg.fillColor);
    else if (fill.fillColor !== "#b00000" || fill.visible !== true) {
      bad("填充色 / 可见性不对：" + fill.fillColor + " visible=" + fill.visible);
    } else if (Math.abs(shapeW(fill) - 96 * 0.6) > 0.02) bad("填充宽度不是 96×0.6：" + shapeW(fill));
    else if (!textItem || !textItem.text || textItem.text.plainText !== "12/20 +3") bad("条内数字不对：" + JSON.stringify(textItem && textItem.text));
    else if (!textCenter || Math.abs(textCenter.x - 75) > 0.6 || Math.abs(textCenter.y - 136.5) > 0.6) {
      bad("条内数字没有居中在血条里：" + JSON.stringify(textCenter));
    } else ok("底部条：96×15 @ (75,136.5)、轨道 #3a1414、填充 60%（#b00000）、数字「12/20 +3」居中在条内");
  }

  /* ---- 左侧三圆：上→下 强韧 / 反射 / 意志，直径 24、x=21、y=51/81/111 ---- */
  {
    const WANT = {
      fort: { y: 51, color: "#f0a5ab", text: "23" },
      reflex: { y: 81, color: "#f5e884", text: "25" },
      will: { y: 111, color: "#8e9dd6", text: "25" }
    };
    const wrong = [];
    for (const k of Object.keys(WANT)) {
      const it = defByKey(k);
      if (!it) { wrong.push(k + " 没画"); continue; }
      const c = centerOf(it);
      if (Math.abs(c.x - 21) > 0.01 || Math.abs(c.y - WANT[k].y) > 0.01) {
        wrong.push(k + " 位置不对（" + Math.round(c.x * 100) / 100 + "," + Math.round(c.y * 100) / 100 + "）");
      } else if (it.fillColor !== WANT[k].color) wrong.push(k + " 颜色不对（" + it.fillColor + "）");
      else if (Math.abs(shapeH(it) - 24) > 0.01 || it.points.length !== 24) wrong.push(k + " 不是 24 段圆（" + shapeH(it) + "/" + it.points.length + "）");
      else if (it.strokeColor !== "#1c2330") wrong.push(k + " 描边不是 #1c2330");
    }
    const texts = t2role("def-text");
    for (const k of Object.keys(WANT)) {
      if (!defTextByKey(k) || defTextByKey(k).text.plainText !== WANT[k].text) wrong.push(k + " 数字不对");
    }
    if (t2role("def").length !== 3) bad("三防圆不是 3 个：" + t2role("def").length);
    else if (wrong.length) bad("左侧三圆不对：" + wrong.join(" / "));
    else ok("左侧三圆：上→下 强韧(21,51) 粉 / 反射(21,81) 黄 / 意志(21,111) 蓝，直径 24、深色描边，数字 23/25/25");
  }

  /* ---- 右下 AC 盾：30×32.4 @ (129,127.8)，深灰蓝底 + 白描边 + AC 数字 ---- */
  {
    const sh = t2one("ac-shield");
    const acText = t2one("ac-text");
    if (!sh) bad("右下 AC 盾没画");
    else if (Math.abs(shapeW(sh) - 30) > 0.01 || Math.abs(shapeH(sh) - 32.4) > 0.05) bad("AC 盾不是 30×32.4：" + shapeW(sh) + "×" + shapeH(sh));
    else if (Math.abs(sh.position.x + shapeW(sh) / 2 - 129) > 0.01 || Math.abs(sh.position.y + shapeH(sh) / 2 - 127.8) > 0.05) {
      bad("AC 盾不在右下角：" + JSON.stringify(sh.position));
    } else if (sh.fillColor !== "#393e50" || sh.strokeColor !== "#ffffff") bad("AC 盾颜色不对：" + sh.fillColor + " / " + sh.strokeColor);
    else if (!acText || !acText.text || acText.text.plainText !== "28") bad("AC 数字不是 28：" + JSON.stringify(acText && acText.text));
    else ok("右下 AC 盾：30×32.4 @ (129,127.8)，#393e50 底 + 白描边，AC 数字 28");
  }

  /* ---- hp.boss 旧数据不再画任何 Boss 元素 ---- */
  token2.metadata[HP_KEY].boss = { enabled: true, segments: 3, phase: "阶段二" };
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  t2 = liveOf(TOKEN2);
  {
    const roles = t2.map(barRoleOf);
    const bossBits = roles.filter((r) => ["plate", "plate-text", "plate-phase", "divider", "lock-body", "lock-shackle"].indexOf(r) >= 0);
    if (bossBits.length) bad("hp.boss 还在画名牌 / 分段 / 锁：" + bossBits.join(","));
    else if (t2.length !== 11) bad("hp.boss 不该改变画多少件（仍 11 件），实际 " + t2.length + "：" + roles.join(","));
    else ok("hp.boss（旧数据）被忽略：不画名牌 / 分段 / 锁，仍是样板血条 11 件");
    delete token2.metadata[HP_KEY].boss;
  }

  /* ---- 窄 token：三圆 + AC 盾仍按比例画，不出现 NaN ---- */
  {
    const TOKEN3 = "tok-3";
    const token3 = {
      id: TOKEN3, type: "IMAGE", name: "窄 token", layer: "CHARACTER", createdUserId: "user-owner",
      position: { x: 0, y: 0 }, scale: { x: 1, y: 1 },
      metadata: { [HP_KEY]: { cur: 9, max: 10, surges: 2, surgesMax: 3,
        defenses: { ac: 21, fort: 15, reflex: 17, will: 19 }, locked: true, updatedAt: 4 } }
    };
    sceneItems.push(token3);
    for (const [w, h] of [[20, 20], [6, 40]]) {
      boundsFor[TOKEN3] = { min: { x: 0, y: 0 }, max: { x: w, y: h }, center: { x: w / 2, y: h / 2 }, width: w, height: h };
      for (const cb of itemsChangeCbs) cb(sceneItems);
      await sleep(340);
      const items = liveOf(TOKEN3);
      const roles3 = items.map(barRoleOf);
      if (items.some((it) => (it.points || []).some((pt) => !isFinite(pt.x) || !isFinite(pt.y)))) bad(w + "×" + h + "：血条点出现 NaN");
      else if (roles3.filter((r) => r === "def").length !== 3 || !roles3.includes("ac-shield")) bad(w + "×" + h + "：四防图形不齐：" + roles3.join(","));
    }
    ok("窄 token（20×20 / 6×40）：三圆 + AC 盾按比例绘制，没有 NaN");
    sceneItems = sceneItems.filter((it) => it.id !== TOKEN3);
    delete boundsFor[TOKEN3];
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(340);
  }

  /* ---- 不再画锁 —— 切 locked 只改精确度，不重建 item ---- */
  token2.metadata[HP_KEY].locked = false;
  const addsBeforeLock = all("local.addItems").length;
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  if (all("local.addItems").length !== addsBeforeLock) bad("切「解锁」不应该重建 item");
  else if (t2role("lock-body").length || t2role("lock-shackle").length) bad("v2.4.13 还在画锁（应该全删）");
  else if (!t2one("bar-text") || t2one("bar-text").visible !== true) bad("城主端 HP 数字不见了");
  else ok("锁图标已删（切 locked 只改精确度、不重建 item；城主端数字照常显示）");

  /* ---- 玩家端：阶梯比例、不画数字与四防（只剩底部条 3 件） ---- */
  token2.metadata[HP_KEY].locked = true;
  role = "PLAYER";
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  t2 = liveOf(TOKEN2);
  {
    const fill = t2one("bar-fill");
    /* 12/20 = 0.6 → 25% 阶梯向上取整 = 0.75 → 填充宽度 96×0.75 = 72。 */
    if (t2.some((it) => barRoleOf(it) === "def" || barRoleOf(it) === "def-text" || barRoleOf(it) === "ac-shield" || barRoleOf(it) === "ac-text")) {
      bad("玩家端仍画了四防图形（locked 时应隐藏）");
    } else if (!t2one("bar-text") || t2one("bar-text").visible !== false) {
      bad("玩家端仍显示精确数字");
    } else if (!fill || Math.abs(shapeW(fill) - 96 * 0.75) > 0.02) {
      bad("玩家端比例没按 25% 阶梯向上取整（0.6 → 0.75，填充应 72 宽）：" + (fill ? shapeW(fill) : "无"));
    } else {
      ok("玩家端（其他玩家 + locked）：0.6 → 0.75 阶梯比例（填充 72 宽），不画数字与四防（" + t2.length + " 件）");
    }
  }
  role = "GM";

  /* ---- 显式关掉：hp-bar/enabled = false → 一件都不留 ---- */
  token2.metadata[HPBAR_KEY] = false;
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  if (liveOf(TOKEN2).length) bad("hp-bar/enabled=false 后血条没有被移除：" + liveOf(TOKEN2).length + " 件");
  else ok("hp-bar/enabled=false → 本地血条被移除（一件不留）");

  /* ---- 右键：血条两项 + 编辑血条（Boss 两项已删） ---- */
  const menusV16 = all("contextMenu.create").map((c) => c[1]);
  const menuById = (id) => menusV16.filter((m) => m.id === id)[0] || null;
  const addMenu = menuById("com.4enext-owlbear/hpbar-add");
  const removeMenu = menuById("com.4enext-owlbear/hpbar-remove");
  const bossMenus = menusV16.filter((m) => /\/boss-(show|hide)$/.test(String(m.id)));
  if (!addMenu || !removeMenu) {
    bad("右键菜单没补齐血条两项：add=" + !!addMenu + " remove=" + !!removeMenu);
  } else if (bossMenus.length) {
    bad("右键还注册了 Boss 菜单（v1.7.9 应该删掉）：" + bossMenus.map((m) => m.id).join(","));
  } else if (!addMenu.icons[0].filter.some || addMenu.icons[0].filter.some[0].operator !== "!=" ||
    !removeMenu.icons[0].filter.some || removeMenu.icons[0].filter.some[0].value !== true) {
    bad("血条菜单的 filter 不对（添加要 != true、移除要 == true）");
  } else if (menusV16.length !== 9) {
    bad("右键菜单总数不是 9（绑定 + 加入 / 隐形加入 + 移出先攻 + 添加 / 移除血条 + 编辑血条 + 编辑传送门 + 速览）：" + menusV16.length);
  } else {
    ok("右键 9 项：绑定 / 加入先攻 ×2 / 移出先攻 / 添加 · 移除血条 / 编辑血条 / 编辑传送门 / 速览；" +
      "**没有**「显示为 Boss」「隐藏 Boss」（v1.7.9 已删），filter 用 != 覆盖 undefined 与 false");
  }

  if (addMenu) {
    const addsBefore = all("local.addItems").length;
    await addMenu.onClick({ items: [token2] });
    await sleep(200);
    if (token2.metadata[HPBAR_KEY] !== true) bad("「添加血条组件」没有写 hp-bar/enabled = true");
    else if (all("local.addItems").length <= addsBefore) bad("「添加血条组件」后没有重画血条");
    else ok("「添加血条组件」→ hp-bar/enabled = true 且立刻重画（环形）");
  }
  if (removeMenu) {
    await removeMenu.onClick({ items: [token2] });
    await sleep(200);
    if (token2.metadata[HPBAR_KEY] !== false) bad("「移除血条组件」没有写 false（delete 会让血条下次自动回来）");
    else ok("「移除血条组件」→ hp-bar/enabled = false（写 false，不 delete）");
  }

  /* ---- v1.2.2：速览弹窗可拖动（左上角定位 / 视口夹取 / 位置记忆 / 回到 token） ---- */
  const INFO_ID = "com.4enext-owlbear/info";
  const INFO_CH = "com.4enext-owlbear/info-drag";
  const POS_KEY = "4enext/info-pos";
  const lastInfoOpen = () => all("popover.open").map((c) => c[1]).filter((cfg) => cfg.id === INFO_ID).pop();
  const dragCb = (broadcastCbs[INFO_CH] || [])[0];
  if (!dragCb) bad("没有订阅速览弹窗拖动频道 " + INFO_CH);
  else ok("订阅了速览弹窗拖动频道 " + INFO_CH);

  // 选中绑定的 token → 弹窗按「左上角」定位（token 在视口上沿，所以先被夹到 16,16）
  selection = [TOKEN_ID];
  for (const cb of playerChangeCbs) cb();
  await sleep(240);
  let info = lastInfoOpen();
  if (!info) bad("选中绑定的 token 后没有打开速览弹窗");
  else if (info.anchorReference !== "POSITION") bad("速览弹窗没有用 anchorReference: POSITION（拖动无法定位）");
  else if (info.anchorOrigin.horizontal !== "LEFT" || info.anchorOrigin.vertical !== "TOP" ||
    info.transformOrigin.horizontal !== "LEFT" || info.transformOrigin.vertical !== "TOP")
    bad("速览弹窗的锚点 / 变换原点不是 LEFT/TOP：" + JSON.stringify([info.anchorOrigin, info.transformOrigin]));
  else if (info.anchorPosition.left !== 16 || info.anchorPosition.top !== 16)
    bad("速览弹窗初始位置不对（应夹到 16,16）：" + JSON.stringify(info.anchorPosition));
  /* v1.7.13：info 入口 URL 带 ?v=<版本>（缓存穿透），item / card 参数照旧。 */
  else if (!/\/info\.html\?v=[\d.]+&item=tok-1&card=c-1(&session=[^&]+)?(&mode=[a-z]+)?$/.test(info.url)) bad("速览弹窗 url 不对：" + info.url);
  else ok("速览弹窗按左上角定位（初始 16,16，url 带 item/card）");

  const infoUrl = info ? info.url : "";
  const infoSize = info ? { w: info.width, h: info.height } : { w: 460, h: 700 };

  if (dragCb && info) {
    // 只点一下标题栏、没有位移 → 不能白白重开一次弹窗
    const opensBefore = all("popover.open").filter((c) => c[1].id === INFO_ID).length;
    dragCb({ phase: "start", dx: 0, dy: 0 });
    dragCb({ phase: "end", dx: 0, dy: 0 });
    await sleep(70);
    const opensAfter = all("popover.open").filter((c) => c[1].id === INFO_ID).length;
    if (opensAfter !== opensBefore) bad("只点标题栏（没有位移）却重开了弹窗：" + opensBefore + " → " + opensAfter);
    else ok("没有位移时不重开弹窗");

    dragCb({ phase: "start", dx: 0, dy: 0 });
    dragCb({ phase: "move", dx: 100, dy: 50 });
    await sleep(90);
    let moved = lastInfoOpen();
    if (!moved || moved.anchorPosition.left !== 116 || moved.anchorPosition.top !== 66)
      bad("拖动没有把弹窗移到 (116,66)：" + JSON.stringify(moved && moved.anchorPosition));
    else if (moved.url !== infoUrl) bad("拖动时 url 变了（会导致弹窗重载）：" + moved.url);
    else if (moved.width !== infoSize.w || moved.height !== infoSize.h) bad("拖动时弹窗尺寸变了：" +
      moved.width + "x" + moved.height + " vs " + infoSize.w + "x" + infoSize.h);
    else ok("拖动 100/50 → 弹窗移到 (116,66)，url / 尺寸不变");

    // 拖出视口 → 夹在边界内（1200 - 460 - 16 = 724，800 - 700 - 16 = 84）
    dragCb({ phase: "move", dx: 5000, dy: 5000 });
    dragCb({ phase: "end", dx: 5000, dy: 5000 });
    await sleep(90);
    moved = lastInfoOpen();
    if (!moved || moved.anchorPosition.left !== 724 || moved.anchorPosition.top !== 84)
      bad("拖动超出视口时没有夹到 (724,84)：" + JSON.stringify(moved && moved.anchorPosition));
    else ok("拖出视口时夹在边界内 → (724,84)");

    const saved = JSON.parse(lsStore[POS_KEY] || "{}");
    const one = saved && saved.pos ? saved.pos[TOKEN_ID] : null;
    if (!one || one.left !== 724 || one.top !== 84) bad("拖动结束后没有记住位置：" + JSON.stringify(saved));
    else ok("拖动结束后位置写进 localStorage（按 token id）");

    // 关掉再选中同一枚 token → 回到上次拖到的位置
    selection = [];
    for (const cb of playerChangeCbs) cb();
    await sleep(200);
    selection = [TOKEN_ID];
    for (const cb of playerChangeCbs) cb();
    await sleep(280);
    moved = lastInfoOpen();
    if (!moved || moved.anchorPosition.left !== 724 || moved.anchorPosition.top !== 84)
      bad("重新选中同一枚 token 时没有回到记住的位置：" + JSON.stringify(moved && moved.anchorPosition));
    else ok("重新选中同一枚 token → 回到上次位置 (724,84)");

    // 「回到 token」：清掉位置，重新按 token 上方摆
    dragCb({ phase: "reset" });
    await sleep(160);
    moved = lastInfoOpen();
    if (!moved || moved.anchorPosition.left !== 16 || moved.anchorPosition.top !== 16)
      bad("「回到 token」没有重新按 token 定位：" + JSON.stringify(moved && moved.anchorPosition));
    else if (lsStore[POS_KEY]) bad("「回到 token」没有清掉记住的位置：" + lsStore[POS_KEY]);
    else ok("「回到 token」清掉位置并回到 (16,16)");
  }


  /* =======================================================================
   * v1.3.1：三个独立窗口（先攻 / 骰子 / 角色卡）—— 各自 popover、各自入口、同时可开
   * ===================================================================== */
  const WIN_CH = "com.4enext-owlbear/win-drag";
  const WIN_POS = "4enext/win-pos";
  const opened = (re) => all("popover.open").map((c) => c[1]).filter((cfg) => re.test(String(cfg.url))).pop();
  const winDragCb = (broadcastCbs[WIN_CH] || [])[0];
  if (!winDragCb) bad("没有订阅独立窗口拖动频道 " + WIN_CH);
  else ok("订阅了独立窗口拖动频道 " + WIN_CH);

  const openedIds = new Set();
  const openByTool = async (tool, re, label) => {
    if (!tool || typeof tool.onClick !== "function") { bad(label + "：工具栏入口不存在"); return null; }
    const n = all("popover.open").length;
    const ret = tool.onClick();
    await sleep(140);
    const cfg = all("popover.open").map((c) => c[1]).slice(n).filter((c) => re.test(String(c.url))).pop();
    if (ret !== false) bad(label + " 的 onClick 没有返回 false（会把工具切成激活态）");
    if (!cfg) bad("点工具栏「" + label + "」没有打开 " + re + " 窗口");
    else openedIds.add(cfg.id);
    return cfg;
  };

  /* v1.4.0 / v1.7.11：工具栏「先攻」打开的是**先攻条**（回退 popover，不再是 modal） */
  const stripOpenBefore = all("popover.open").length;
  const stripRet = toolInit && typeof toolInit.onClick === "function" ? toolInit.onClick() : null;
  await sleep(140);
  const stripCfg = all("popover.open").map((c) => c[1]).slice(stripOpenBefore)
    .filter((c) => /\/initiative\.html(?:\?.*)?$/.test(String(c.url))).pop() || null;
  if (stripRet !== false) bad("工具栏「先攻条」的 onClick 没有返回 false（会把工具切成激活态）");
  if (!stripCfg) bad("点工具栏「先攻条」没有打开 /\/initiative\.html(?:\?.*)?$/ popover");
  const diceWin = await openDiceWindow();
  const panelWin = await openByTool(toolPanel, /\/panel\.html(?:\?.*)?$/, "角色卡");

  if (!stripCfg || !diceWin || !panelWin) {
    bad("三个工具栏入口没有各自打开窗口");
  } else if (stripCfg.id !== "com.4enext-owlbear/initiative-strip") {
    bad("先攻条的 popover id 不对：" + stripCfg.id);
  } else if (new Set([stripCfg.id, diceWin.id, panelWin.id]).size !== 3) {
    bad("三个窗口的 id 有重复（不能同时打开）：" + [stripCfg.id, diceWin.id, panelWin.id].join(" / "));
  } else {
    ok("先攻条 + 骰子 + 角色卡各自独立打开，id 互不相同（可同时开）：" +
      [stripCfg.id, diceWin.id, panelWin.id].map((x) => x.split("/").pop()).join(" / "));
  }

  if (stripCfg) {
    const badStrip = stripCfg.anchorReference !== "POSITION" || stripCfg.width !== 720 || stripCfg.height !== 170 ||
      stripCfg.hidePaper !== true || stripCfg.disableClickAway !== true ||
      !stripCfg.anchorOrigin || stripCfg.anchorOrigin.horizontal !== "CENTER" || stripCfg.anchorOrigin.vertical !== "TOP" ||
      !stripCfg.anchorPosition || stripCfg.anchorPosition.left !== 600 || stripCfg.anchorPosition.top !== 45;
    if (badStrip) bad("先攻条 popover 参数不对：" + JSON.stringify(stripCfg));
    else ok("先攻条：popover 720×170 @ 中线 600 / top 45（POSITION + CENTER/TOP + hidePaper:true + disableClickAway:true）");
    if (all("modal.open").some((c) => c[1] && c[1].id === stripCfg.id))
      bad("先攻条又用 modal.open 开了（disablePointerEvents 会把右键 / 输入框 / d20 全挡住）");
    else ok("先攻条不再用 modal.open（v1.7.10 的 disablePointerEvents 回归已修）");
  }

  if (diceWin && panelWin) {
    const vw = 1200, vh = 800, margin = 16;
    const badSize = [diceWin, panelWin].filter((c) => c.width > vw - margin * 2 || c.height > vh - margin * 2);
    if (badSize.length) bad("窗口尺寸超出视口 − 2×margin：" + JSON.stringify(badSize.map((c) => [c.url, c.width, c.height])));
    else ok("骰子 / 角色卡窗口的尺寸都 ≤ 视口 − 2×margin（" + vw + "×" + vh + "）");

    const posBad = [diceWin, panelWin].filter((c) =>
      c.anchorPosition.left < margin || c.anchorPosition.top < margin ||
      c.anchorPosition.left + c.width > vw - margin || c.anchorPosition.top + c.height > vh - margin);
    if (posBad.length) bad("窗口位置超出视口：" + JSON.stringify(posBad.map((c) => [c.url, c.anchorPosition])));
    else ok("骰子 / 角色卡窗口打开时都被夹进视口内（打开前用 OBR.viewport 夹紧）");

    for (const [cfg, label] of [[diceWin, "骰子"], [panelWin, "角色卡"]]) {
      if (cfg.anchorReference !== "POSITION" || cfg.anchorOrigin.horizontal !== "LEFT" ||
        cfg.anchorOrigin.vertical !== "TOP" || cfg.transformOrigin.horizontal !== "LEFT" ||
        cfg.transformOrigin.vertical !== "TOP") {
        bad(label + "窗口没有按左上角定位：" + JSON.stringify([cfg.anchorReference, cfg.anchorOrigin, cfg.transformOrigin]));
      } else if (cfg.width <= 0 || cfg.height <= 0) {
        bad(label + "窗口尺寸不合法：" + cfg.width + "×" + cfg.height);
      }
    }
    ok("骰子 / 角色卡窗口统一按左上角定位（拖动只换 anchorPosition）");
  }

  /* v1.7.10：窗口 ✕ 的后台兜底 —— 页面先 popover.close，再发 {op:"close-win", name}；
   * 这里模拟后台收到消息，断言它会再关一次（popover + modal 双保险）。 */
  {
    const WIN_CLOSE = "com.4enext-owlbear/win-close";
    const winCloseCb = (broadcastCbs[WIN_CLOSE] || [])[0];
    if (!winCloseCb) bad("没有订阅 " + WIN_CLOSE + "（✕ 的后台兜底没接上）");
    else {
      await sleep(1600); /* v2.4.13：刚开窗 1.5s 内忽略 close 广播，测试等过窗口 */
      const beforePc = all("popover.close").length;
      const beforeMc = all("modal.close").length;
      winCloseCb({ data: { op: "close-win", name: "panel" } });
      await sleep(60);
      const pc = all("popover.close").slice(beforePc).map((c) => c[1]);
      const mc = all("modal.close").slice(beforeMc).map((c) => c[1]);
      if (pc.indexOf("com.4enext-owlbear/panel") >= 0 && mc.indexOf("com.4enext-owlbear/panel") >= 0)
        ok("✕ 后台兜底：{op:\"close-win\", name:\"panel\"} → OBR.popover.close(ID_PANEL) + OBR.modal.close(ID_PANEL)");
      else bad("✕ 后台兜底没有关掉 panel：" + JSON.stringify({ pc, mc }));
    }
  }

  /* =======================================================================
   * v1.3.2：设置窗口自己一个 popover；速览入口给当前选中的 token 重开 /info
   * ===================================================================== */
  const CH_OPEN_SETTINGS = "com.4enext-owlbear/open-settings";
  const settingsCb = (broadcastCbs[CH_OPEN_SETTINGS] || [])[0];
  if (!settingsCb) bad("没有订阅 CH_OPEN_SETTINGS（右下浮动按钮打不开设置）");
  else settingsCb({ data: { at: Date.now() } });
  await sleep(180);
  const settingsWin = opened(/\/settings\.html(?:\?.*)?$/);
  if (!settingsWin) bad("浮动按钮命令没有打开设置窗口");
  else if ([stripCfg, diceWin, panelWin].some((c) => c && c.id === settingsWin.id)) {
    bad("设置窗口的 popover id 与别的窗口重复：" + settingsWin.id);
  } else {
    ok("设置窗口独立打开（" + settingsWin.id.split("/").pop() + "），与其它窗口 id 不同");
  }
  if (settingsWin) {
    const vw = 1200, vh = 800, m = 16;
    if (settingsWin.width > vw - m * 2 || settingsWin.height > vh - m * 2 ||
      settingsWin.anchorPosition.left < m || settingsWin.anchorPosition.top < m ||
      settingsWin.anchorPosition.left + settingsWin.width > vw - m ||
      settingsWin.anchorPosition.top + settingsWin.height > vh - m) {
      bad("设置窗口没有被视口夹紧：" + JSON.stringify([settingsWin.width, settingsWin.height, settingsWin.anchorPosition]));
    } else {
      ok("设置窗口被夹进视口（" + settingsWin.width + "×" + settingsWin.height + " @ " + JSON.stringify(settingsWin.anchorPosition) + "）");
    }
  }

  /* 当前选中的 tok-1 绑定着 c-1 → 点「速览」应该重新开 /info（与「选中即弹」同一个 popover）。
   * v1.8.9：信息窗已开时手动入口只换目标不重开；这里先关掉，验证「关闭后手动入口能重新开」。 */
  const winCloseCbGlance = (broadcastCbs["com.4enext-owlbear/win-close"] || [])[0];
  if (winCloseCbGlance) { winCloseCbGlance({ data: { op: "close-win", name: "info" } }); await sleep(80); }
  selection = [TOKEN_ID];
  void BG.openGlance("右键「速览」");
  await sleep(200);
  const glanceWin = opened(/\/info\.html\?v=[\d.]+&item=tok-1&card=c-1(&session=[^&]+)?(&mode=[a-z]+)?$/);
  if (!glanceWin) bad("右键「速览」没有打开当前选中 token 的速览");
  else ok("右键「速览」打开 /info（复用「选中即弹」同一个 popover，url 带 item/card）");

  /* v1.4.0：先攻条的拖动（CH_STRIP_DRAG，只发位移；后台按中线偏移换算 + 夹紧 + 落盘） */
  const STRIP_CH = "com.4enext-owlbear/strip-drag";
  const STRIP_POS = "4enext/strip-pos";
  const stripDragCb = (broadcastCbs[STRIP_CH] || [])[0];
  if (!stripDragCb) bad("没有订阅先攻条拖动频道 " + STRIP_CH);
  else ok("订阅了先攻条拖动频道 " + STRIP_CH);
  if (stripDragCb && stripCfg) {
    /* v1.7.11：popover 由宿主定位 —— 拖动 = 后台按位移夹紧后**重开同一个 popover**（iframe 复用）。
     * 视口 1200×800、条 720×170 → dx 夹在 ±224，dy 最大 = 800−170−16−45 = 569（top = 614）。 */
    const dragOpens = () => all("popover.open").map((c) => c[1])
      .filter((c) => c.id === "com.4enext-owlbear/initiative-strip");
    const beforeDrag = dragOpens().length;
    stripDragCb({ phase: "start", dx: 0, dy: 0 });
    stripDragCb({ phase: "move", dx: 100, dy: 50 });
    await sleep(90);
    const moved = dragOpens().slice(beforeDrag).pop();
    if (!moved) bad("拖动先攻条没有重开 popover（宿主位置不会动）");
    else if (!moved.anchorPosition || moved.anchorPosition.left !== 700 || moved.anchorPosition.top !== 95)
      bad("拖动 100,50 后 popover 锚点不对：" + JSON.stringify(moved.anchorPosition));
    else if (moved.width !== 720 || moved.height !== 170)
      bad("拖动时 popover 尺寸变了：" + moved.width + "×" + moved.height);
    else ok("拖动 100,50 → 重开同一个 popover @ (700,95)，尺寸仍 720×170");

    stripDragCb({ phase: "move", dx: 5000, dy: 5000 });
    stripDragCb({ phase: "end", dx: 5000, dy: 5000 });
    await sleep(160);
    let savedStrip = null;
    try { savedStrip = JSON.parse(lsStore[STRIP_POS] || "null"); } catch (e) { savedStrip = null; }
    const clamped = dragOpens().pop();
    if (!savedStrip || savedStrip.dx !== 224 || savedStrip.dy !== 569) {
      bad("先攻条拖出视口没有夹紧 / 落盘：" + JSON.stringify(savedStrip));
    } else if (!clamped || !clamped.anchorPosition || clamped.anchorPosition.left !== 824 || clamped.anchorPosition.top !== 614) {
      bad("先攻条拖出视口后 popover 没有被夹回视口：" + JSON.stringify(clamped && clamped.anchorPosition));
    } else {
      ok("先攻条拖出视口 → 偏移夹到 { dx: 224, dy: 569 }、popover @ (824,614) 并落盘（条 720×170）");
    }
    const beforeReset = dragOpens().length;
    stripDragCb({ phase: "reset" });
    await sleep(140);
    const centered = dragOpens().slice(beforeReset).pop();
    if (lsStore[STRIP_POS]) bad("回中后没有清掉记住的偏移：" + lsStore[STRIP_POS]);
    else if (!centered || !centered.anchorPosition || centered.anchorPosition.left !== 600 || centered.anchorPosition.top !== 45)
      bad("「回到顶部中间」没有重开 popover 到 (600,45)：" + JSON.stringify(centered && centered.anchorPosition));
    else ok("先攻条「回到顶部中间」→ 清偏移并重开 popover @ (600,45)");
  }

  /* 先攻条「≡」→ 列表窗口（?view=list，880×640，仍可拖 / 记位置，id 与条不同） */
  const stripCmdCb = (broadcastCbs["com.4enext-owlbear/strip-cmd"] || [])[0];
  if (!stripCmdCb) bad("没有订阅先攻条命令频道（列表 / 尺寸）");
  else ok("订阅了先攻条命令频道（列表 / 尺寸）");
  let listWin = null;
  if (stripCmdCb) {
    stripCmdCb({ data: { op: "list" } });
    await sleep(180);
    listWin = opened(/\/initiative\.html\?view=list(?:&v=[^&]*)?$/);
    if (!listWin || listWin.width !== 880 || listWin.height !== 640) {
      bad("先攻条「≡」没有打开列表窗口：" + JSON.stringify(listWin && [listWin.url, listWin.width, listWin.height]));
    } else if (listWin.id !== "com.4enext-owlbear/initiative-window") {
      bad("列表窗口的 popover id 不是 /initiative-window：" + listWin.id);
    } else {
      ok("先攻条「≡」打开列表窗口（?view=list，880×640，id 与先攻条不同）");
    }
  }

  /* v1.7.11：条上的「✕」→ popover.close(条 id)（再 modal.close 兜底 v1.7.10 的旧实例）。 */
  if (stripCmdCb) {
    const closeBefore = all("popover.close").length;
    stripCmdCb({ data: { op: "close" } });
    await sleep(120);
    const closedIds = all("popover.close").slice(closeBefore).map((c) => c[1]);
    if (closedIds.indexOf("com.4enext-owlbear/initiative-strip") >= 0)
      ok("先攻条「✕」→ OBR.popover.close(条 id)（modal.close 兜底旧实例）");
    else bad("先攻条「✕」没有关掉 popover：" + JSON.stringify(closedIds));
  }

  /* 拖动列表窗口：起点 160,56（1200×800 居中偏上）→ 位移 100,50 → 夹取 → 落盘 → ⌖ 回默认 */
  if (winDragCb && listWin) {
    const base = listWin.anchorPosition;
    winDragCb({ win: "initiative", phase: "start", dx: 0, dy: 0 });
    winDragCb({ win: "initiative", phase: "move", dx: 100, dy: 50 });
    await sleep(90);
    let movedWin = opened(/\/initiative\.html\?view=list(?:&v=[^&]*)?$/);
    if (!movedWin || movedWin.anchorPosition.left !== base.left + 100 || movedWin.anchorPosition.top !== base.top + 50) {
      bad("拖动先攻窗口没有跟手：" + JSON.stringify(movedWin && movedWin.anchorPosition) + "（起点 " + JSON.stringify(base) + "）");
    } else if (movedWin.width !== listWin.width || movedWin.height !== listWin.height) {
      bad("拖动时窗口尺寸变了：" + movedWin.width + "×" + movedWin.height);
    } else {
      ok("拖动先攻窗口 100/50 → " + JSON.stringify(movedWin.anchorPosition) + "（尺寸不变）");
    }

    winDragCb({ win: "initiative", phase: "move", dx: 5000, dy: 5000 });
    winDragCb({ win: "initiative", phase: "end", dx: 5000, dy: 5000 });
    await sleep(90);
    movedWin = opened(/\/initiative\.html\?view=list(?:&v=[^&]*)?$/);
    const maxLeft = 1200 - listWin.width - 16;
    const maxTop = 800 - listWin.height - 16;
    if (!movedWin || movedWin.anchorPosition.left !== maxLeft || movedWin.anchorPosition.top !== maxTop) {
      bad("拖出视口没有夹到 (" + maxLeft + "," + maxTop + ")：" + JSON.stringify(movedWin && movedWin.anchorPosition));
    } else {
      ok("拖出视口时先攻窗口被夹在边界内 → (" + maxLeft + "," + maxTop + ")");
    }

    const savedWin = JSON.parse(lsStore[WIN_POS] || "{}");
    const savedInit = savedWin && savedWin.pos ? savedWin.pos.initiative : null;
    if (!savedInit || savedInit.left !== maxLeft || savedInit.top !== maxTop) bad("拖动结束后没有记住窗口位置：" + JSON.stringify(savedWin));
    else ok("拖动结束后位置写进 localStorage（" + WIN_POS + "，按窗口名）");

    winDragCb({ win: "initiative", phase: "reset" });
    await sleep(160);
    movedWin = opened(/\/initiative\.html\?view=list(?:&v=[^&]*)?$/);
    if (!movedWin || movedWin.anchorPosition.left !== base.left || movedWin.anchorPosition.top !== base.top) {
      bad("⌖ 没有把先攻窗口移回默认位置：" + JSON.stringify(movedWin && movedWin.anchorPosition));
    } else {
      const after = JSON.parse(lsStore[WIN_POS] || "{}");
      const still = after && after.pos ? after.pos.initiative : null;
      if (still) bad("⌖ 没有清掉记住的窗口位置：" + JSON.stringify(after));
      else ok("⌖ 清掉位置并回到默认点 " + JSON.stringify(movedWin.anchorPosition));
    }

    /* 没开着的窗口收到拖动消息 → 不许动（避免 action 弹窗里拖一下把别的 popover 挪走） */
    const beforeAlien = all("popover.open").length;
    winDragCb({ win: "not-open", phase: "start", dx: 0, dy: 0 });
    winDragCb({ win: "not-open", phase: "move", dx: 300, dy: 300 });
    await sleep(70);
    if (all("popover.open").length !== beforeAlien) bad("没开着的窗口也被拖动消息挪动了");
    else ok("没开着的窗口忽略拖动消息");
  }

  /* 小屏：800×600 下窗口必须夹到视口内（1920×1080 / 1366×768 更不在话下） */
  OBR.viewport.getWidth = async () => 800;
  OBR.viewport.getHeight = async () => 600;
  const smallPanel = await openByTool(toolPanel, /\/panel\.html(?:\?.*)?$/, "角色卡（小屏）");
  if (!smallPanel) bad("小屏下打不开角色卡窗口");
  else if (smallPanel.width > 800 - 32 || smallPanel.height > 600 - 32)
    bad("小屏（800×600）下窗口还是超出视口：" + smallPanel.width + "×" + smallPanel.height);
  else ok("小屏 800×600 下窗口夹到 " + smallPanel.width + "×" + smallPanel.height + "（≤ 视口 − 2×margin）");

  /* v2.4.13：视口轮询重锚（OBR SDK 没有 viewport.onChange） */
  OBR.viewport.getWidth = async () => 800;
  OBR.viewport.getHeight = async () => 600;
  if (!BG.pollViewportAnchor) bad("v2.4.13：没有暴露 pollViewportAnchor（轮询缺失）");
  else {
    await BG.pollViewportAnchor();
    await sleep(300);
    OBR.viewport.getWidth = async () => 1200;
    OBR.viewport.getHeight = async () => 800;
    await BG.pollViewportAnchor();
    await sleep(420);
    const backPanel = opened(/\/panel\.html(?:\?.*)?$/);
    if (!backPanel || backPanel.width !== 960) bad("视口变大后窗口没有重新夹紧/恢复：" + JSON.stringify(backPanel && [backPanel.width, backPanel.height]));
    else ok("v2.4.13：视口轮询 → reclampWins 重新夹紧窗口（" + backPanel.width + "×" + backPanel.height + "）");
    const btnOpen = all("popover.open").map((c) => c[1]).filter((c) => String(c.url).indexOf("button.html") >= 0).pop();
    if (!btnOpen || !btnOpen.anchorPosition) bad("v2.4.13：视口变化后浮动按钮没有重新 open");
    else if (btnOpen.anchorPosition.left === 1200 - 12 && btnOpen.anchorPosition.top === 800 - 92)
      ok("v2.4.13：视口变化 → 浮动按钮重新 open 到新右下角 anchorPosition（" + JSON.stringify(btnOpen.anchorPosition) + "）");
    else bad("v2.4.13：浮动按钮 anchorPosition 不是新视口右下角：" + JSON.stringify(btnOpen.anchorPosition));
  }

  /* v2.4.13：拖动 start 用最新视口 clamp（旧代码用打开时的 vp 快照，会卡在旧下限） */
  if (BG.stopViewportAnchor) BG.stopViewportAnchor();
  OBR.viewport.getWidth = async () => 1200;
  OBR.viewport.getHeight = async () => 900;
  const dragPanel = await openByTool(toolPanel, /\/panel\.html(?:\?.*)?$/, "角色卡（拖动视口测试）");
  if (!dragPanel) bad("v2.4.13：拖动测试的窗口打不开");
  else {
    const hNow = dragPanel.height;
    OBR.viewport.getWidth = async () => 1200;
    OBR.viewport.getHeight = async () => 1100;
    winDragCb({ win: "panel", phase: "start", dx: 0, dy: 0 });
    winDragCb({ win: "panel", phase: "move", dx: 0, dy: 700 });
    winDragCb({ win: "panel", phase: "end", dx: 0, dy: 700 });
    await sleep(300);
    const moved = opened(/\/panel\.html(?:\?.*)?$/);
    const expectedTop = 1100 - hNow - 16;
    const oldTop = 900 - hNow - 16;
    if (!moved) bad("v2.4.13：拖动后窗口没有重新 open");
    else if (moved.anchorPosition.top === expectedTop && expectedTop > oldTop)
      ok("v2.4.13：拖动 start 取最新视口 → 向下 700 能到新下限 top=" + expectedTop + "（旧 vp 下限 " + oldTop + "）");
    else bad("v2.4.13：拖动仍被旧视口卡住：top=" + (moved && moved.anchorPosition && moved.anchorPosition.top) +
      "（新下限 " + expectedTop + " / 旧下限 " + oldTop + "）");
  }
  if (BG.installViewportAnchor) BG.installViewportAnchor();

  /* ---------------------------------------------------------------------------
   * v1.9.2：骰子历史改为「本机 + 广播」，后台不再写房间 rolls（只做迁移与清残留）
   * ------------------------------------------------------------------------- */
  const CH_ROLL = "com.4enext-owlbear/roll";
  const CH_ROLL_CLEAR = "com.4enext-owlbear/roll-clear";
  const KEY_ROLLS = "com.4enext-owlbear/rolls";
  const rollCbs = broadcastCbs[CH_ROLL] || [];
  const clearCbs = broadcastCbs[CH_ROLL_CLEAR] || [];
  if (rollCbs.length) bad("后台还在订阅 CH_ROLL（骰子历史应只由各端本机累积）");
  else ok("后台不再订阅 CH_ROLL（历史改为本机 localStorage + 广播，房间数据不写 rolls）");
  if (!clearCbs.length) bad("后台没有订阅 CH_ROLL_CLEAR（清房间残留下不去）");
  else ok("订阅了清空频道 CH_ROLL_CLEAR（GM 清房间残留）");
  await sleep(140);
  const histKey = "4enext/dice-history/" + ((OBR.room && OBR.room.id) || "default");
  let localRows = [];
  try { localRows = (JSON.parse(lsStore[histKey] || "{}") || {}).rows || []; } catch (e) { localRows = []; }
  if (localRows.length === 2 && localRows[0].rollId === "mig-2" && localRows[1].rollId === "mig-1")
    ok("启动迁移：房间旧 rolls 2 条已按 ts 倒序迁进本机（" + histKey + "）");
  else bad("房间骰子历史没有迁进本机：" + JSON.stringify(localRows.map((r) => r.rollId)));
  const roomAfterMig = roomMeta[KEY_ROLLS];
  if (!roomAfterMig || !Array.isArray(roomAfterMig.rows) || roomAfterMig.rows.length)
    bad("迁移后房间 KEY_ROLLS 没有清空：" + JSON.stringify(roomAfterMig && roomAfterMig.rows.length));
  else ok("迁移后房间 KEY_ROLLS 已清空（只减不增，不再占 16KB 预算）");
  /* 清空请求：GM 顺带清房间残留 */
  roomMeta[KEY_ROLLS] = { v: 1, updatedAt: Date.now(), seq: 9, rows: [{ rollId: "old-1", ts: 1, dice: [{ type: "d20", value: 1 }], total: 1 }] };
  for (const cb of clearCbs) await cb({ data: { by: "user-gm" } });
  await sleep(120);
  const roomAfterClear = roomMeta[KEY_ROLLS];
  if (roomAfterClear && Array.isArray(roomAfterClear.rows) && roomAfterClear.rows.length === 0)
    ok("清空记录：GM 后台把房间残留 rolls 清成 []");
  else bad("清空记录没有清房间残留：" + JSON.stringify(roomAfterClear && roomAfterClear.rows.length));

  /* v1.9.2：骰子记录窗口「进入房间自动打开」（默认开 / 设置关 / 本次会话 ✕ 过就不再开） */
  {
    const winCloseCb4 = (broadcastCbs["com.4enext-owlbear/win-close"] || [])[0];
    const histOpens = () => all("popover.open").map((c) => c[1]).filter((c) => String(c.url).indexOf("dice-history.html") >= 0).length;
    if (winCloseCb4) { winCloseCb4({ data: { op: "close-win", name: "diceHistory" } }); await sleep(100); }
    lsStore["4enext/dice-hist-closed"] = "1"; /* 先记成「关过」，避免影响下面默认开的前置 */
    /* 默认开：清掉偏好键 + 会话标记 → 调一次应打开 */
    delete lsStore["4enext/dice-hist-autostart"];
    delete lsStore["4enext/dice-hist-closed"];
    let before = histOpens();
    let opened = BG.maybeAutoOpenDiceHistory ? await BG.maybeAutoOpenDiceHistory() : false;
    await sleep(160);
    if (opened && histOpens() === before + 1) ok("v1.9.2：骰子记录窗口默认开 —— 启动自动打开一次");
    else bad("v1.9.2：默认没有自动打开骰子记录窗口：" + JSON.stringify({ opened, before, after: histOpens() }));
    /* 本次会话 ✕ 过 → 不再自动开 */
    await sleep(1600);
    const closesBefore = all("popover.close").length;
    if (winCloseCb4) winCloseCb4({ data: { op: "close-win", name: "diceHistory" } });
    await sleep(140);
    if (lsStore["4enext/dice-hist-closed"] !== "1") bad("✕ 关掉记录窗口没有写会话标记");
    before = histOpens();
    opened = BG.maybeAutoOpenDiceHistory ? await BG.maybeAutoOpenDiceHistory() : false;
    await sleep(120);
    if (!opened && histOpens() === before) ok("v1.9.2：本次会话 ✕ 过关过 → 不再自动打开");
    else bad("v1.9.2：本次会话关过后仍然自动打开了");
    /* 设置里关掉偏好 → 不开 */
    delete lsStore["4enext/dice-hist-closed"];
    lsStore["4enext/dice-hist-autostart"] = "0";
    before = histOpens();
    opened = BG.maybeAutoOpenDiceHistory ? await BG.maybeAutoOpenDiceHistory() : false;
    await sleep(120);
    if (!opened && histOpens() === before) ok("v1.9.2：设置里关掉「自动打开」偏好 → 不自动开");
    else bad("v1.9.2：偏好关闭后仍然自动打开");
    lsStore["4enext/dice-hist-autostart"] = "0"; /* 后续用例保持关闭 */
    if (winCloseCb4) { winCloseCb4({ data: { op: "close-win", name: "diceHistory" } }); await sleep(80); }
    delete lsStore["4enext/dice-hist-closed"];
  }

  /* =======================================================================
   * v1.7.2：血条组件编辑小窗（hp-edit）—— 语法 / 夹取 / 权限 / 租约 / 开窗 / 空四防不画盾
   * ===================================================================== */
  const HP_E_KEY = "com.4enext-owlbear/hp";
  const hpeTmp = path.join(os.tmpdir(), "4enext-hpedit-test");
  fs.mkdirSync(hpeTmp, { recursive: true });
  const hpeModPath = path.join(hpeTmp, "hp-edit-core.mjs");
  fs.copyFileSync(path.join(ROOT, "assets", "hp-edit-core.js"), hpeModPath);
  const HPE = await import(pathToFileURL(hpeModPath).href);

  /* ---- 1) v2.4.13 字段：当前 / 上限 / 临时生命 / 四防（独立输入框、clamp、留空 = null） ---- */
  {
    const max = HPE.parseMaxInput("20");
    const curHigh = HPE.parseCurInput("25", { max: 20 });
    const curNeg = HPE.parseCurInput("-3", { max: 20 });
    const temp = HPE.parseTempInput("999");
    const tempJunk = HPE.parseTempInput("10a");
    const emptyDef = HPE.parseDefenseInput("");
    const def = HPE.parseDefenseInput("18");
    const badDef = HPE.parseDefenseInput("十八");
    if (!max.ok || max.value !== 20) bad("生命上限「20」解析不对：" + JSON.stringify(max));
    else if (!curHigh.ok || curHigh.value !== 20) bad("当前生命 25 没有夹到上限 20：" + JSON.stringify(curHigh));
    else if (!curNeg.ok || curNeg.value !== 0) bad("当前生命 -3 没有夹到 0：" + JSON.stringify(curNeg));
    else if (!temp.ok || temp.value !== 999) bad("临时生命 999 解析不对：" + JSON.stringify(temp));
    else if (tempJunk.ok) bad("临时生命非数字应该拒绝：" + JSON.stringify(tempJunk));
    else if (!emptyDef.ok || emptyDef.value !== null) bad("四防留空不是 null（应该「不画那枚盾」）：" + JSON.stringify(emptyDef));
    else if (!def.ok || def.value !== 18) bad("四防「18」解析不对：" + JSON.stringify(def));
    else if (badDef.ok) bad("四防填非数字应该拒绝：" + JSON.stringify(badDef));
    else ok("v2.4.13 字段：当前 0~上限 / 上限 ≥1 / 临时 0~999 / 四防留空 = null，非法输入拒绝");
  }
  {
    const view = { cur: 12, max: 20, temp: 0, defenses: { ac: 18 } };
    const built = HPE.buildHpEditPatch({ cur: "20", max: "20", temp: "5", defs: { ac: "18", fort: "", reflex: "", will: "" } }, view);
    const emptyDefs = HPE.buildHpEditPatch({ cur: "20", max: "20", temp: "0", defs: { ac: "", fort: "", reflex: "", will: "" } }, view);
    const noMax = HPE.buildHpEditPatch({ cur: "20", max: "", temp: "0", defs: {} }, view);
    if (!built.ok || built.patch.cur !== 20 || built.patch.max !== 20 || built.patch.temp !== 5 ||
      !built.patch.defenses || built.patch.defenses.ac !== 18 || "fort" in built.patch.defenses) {
      bad("buildHpEditPatch 没有只写填了的那枚盾 / temp：" + JSON.stringify(built));
    } else if (noMax.ok) bad("没填上限时应该拒绝保存：" + JSON.stringify(noMax));
    else if (!emptyDefs.ok || emptyDefs.patch.defenses !== null) bad("四防全空应给 defenses = null（删键）：" + JSON.stringify(emptyDefs));
    else {
      const next = HPE.applyHpEdit({ cur: 20, max: 20, temp: 3, surges: 2, surgesMax: 3, defenses: { ac: 18 }, boss: { enabled: true }, locked: false }, emptyDefs.patch, 999);
      if ("defenses" in next) bad("空四防写盘后 metadata 里还留着 defenses：" + JSON.stringify(next));
      else if (!next.boss || next.boss.enabled !== true || next.locked !== false) bad("写盘把 boss / locked 洗掉了：" + JSON.stringify(next));
      else if (next.surges !== 2 || next.surgesMax !== 3) bad("写盘把 surges 数据洗掉了（应只读不写）：" + JSON.stringify(next));
      else if (next.temp !== 0) bad("临时生命没有按 patch 写 0：" + JSON.stringify(next));
      else if (next.updatedAt !== 999) bad("写盘没有更新 updatedAt：" + JSON.stringify(next));
      else ok("写盘：空四防删键；surges 数据原样保留（只读不写）；temp 写入；boss / locked 保留");
    }
    const clamped = HPE.applyHpEdit({ cur: 12, max: 20, temp: 500 }, { cur: 99, max: 20, temp: 5000 }, 1);
    if (clamped.cur > clamped.max || clamped.temp > 999) bad("写盘没有夹取：" + JSON.stringify(clamped));
    else ok("写盘夹取：cur 99 → 20、temp 5000 → 999");
  }
  /* ---- 2) 权限 / 两次校验 / 租约 ---- */
  {
    const gm = HPE.mayEditToken({ id: "t", createdUserId: "u-owner" }, "GM", "u-other");
    const owner = HPE.mayEditToken({ id: "t", createdUserId: "u-owner" }, "PLAYER", "u-owner");
    const other = HPE.mayEditToken({ id: "t", createdUserId: "u-owner" }, "PLAYER", "u-other");
    if (!gm || !owner || other) bad("权限判定不对（城主 true / 创建者 true / 其他玩家 false）");
    else ok("权限：城主 ✓ / token 创建者 ✓ / 其他玩家 ✗");
  }
  {
    const target = { id: "tok-hpe", type: "IMAGE", createdUserId: "u-gm", metadata: {} };
    const deps = (opt) => ({
      getItems: async (ids) => (ids.includes(target.id) ? [JSON.parse(JSON.stringify(target))] : []),
      updateItems: async (ids, fn) => {
        const drafts = ids.includes(target.id) ? [JSON.parse(JSON.stringify(target))] : [];
        fn(drafts); /* 抛错就不落盘（OBR 整次写入失败的行为） */
        for (const d of drafts) if (d.id === target.id) target.metadata = d.metadata;
      },
      getRole: async () => opt.role,
      getId: async () => opt.pid,
      now: () => 4242
    });
    const writeOk = await HPE.writeHpEdit(deps({ role: "GM", pid: "u-gm" }), "tok-hpe",
      { cur: 20, max: 20, temp: 2, defenses: { ac: 18, fort: 15, reflex: 17, will: 16 } });
    const hp = target.metadata[HP_E_KEY];
    if (!writeOk.ok) bad("GM 保存失败：" + JSON.stringify(writeOk));
    else if (!hp || hp.cur !== 20 || hp.max !== 20 || hp.temp !== 2 || !hp.defenses || hp.defenses.ac !== 18) bad("保存没有写进 hp / temp：" + JSON.stringify(hp));
    else if (hp.updatedAt !== 4242) bad("保存没有用 deps.now() 的时间戳：" + hp.updatedAt);
    else if (target.metadata["com.4enext-owlbear/hp-bar/enabled"] !== true) bad("保存没有顺手把血条组件打开");
    else if ("surges" in hp) bad("保存把没有表单字段的 surges 写出来了（应只读不写）：" + JSON.stringify(hp));
    else ok("保存写 token metadata：20/20 + 临时 2 + 四防 4 项 + 开关 true（surges 不动）");

    const before = JSON.stringify(target.metadata);
    const denied = await HPE.writeHpEdit(deps({ role: "PLAYER", pid: "u-other" }), "tok-hpe", { cur: 1, max: 1 });
    if (denied.ok) bad("其他玩家居然能改别人的 token");
    else if (!/只有城主或这枚 token 的创建者/.test(denied.message)) bad("拒绝文案不对：" + denied.message);
    else if (JSON.stringify(target.metadata) !== before) bad("被拒绝时仍然写了盘（数据被改了）");
    else ok("权限分支：其他玩家改别人的 token → 拒绝 + 一个字节都没写（文案给原因）");
  }
  {
    /* draft 回调里创建者变了 → 第二次校验必须拦住（参考实现 edit.ts 的核心） */
    const swapped = { id: "tok-hpe2", type: "IMAGE", createdUserId: "u-owner", metadata: {} };
    const swapDeps = {
      getItems: async () => [JSON.parse(JSON.stringify(swapped))],
      updateItems: async (ids, fn) => {
        const draft = Object.assign(JSON.parse(JSON.stringify(swapped)), { createdUserId: "u-other" });
        fn([draft]);
        swapped.metadata = draft.metadata;
      },
      getRole: async () => "PLAYER",
      getId: async () => "u-owner",
      now: () => 1
    };
    const res = await HPE.writeHpEdit(swapDeps, "tok-hpe2", { cur: 5, max: 5 });
    if (res.ok) bad("draft 换了创建者仍然写进去了（缺第二次校验）");
    else if (!swapped.metadata[HP_E_KEY]) ok("两次校验：updateItems 的 draft 里创建者变了 → 拒绝，且没落盘");
    else bad("第二次校验没有拦住（metadata 已被写）");
  }
  {
    const lease = HPE.createHpEditLease("s-1");
    const a = lease.accept({ session: "s-1", version: 2, itemId: "tok-a", pending: false });
    const capA = lease.capture();
    const capAtFirst = !!(capA && capA.current());   /* 后面的 accept 会推进 epoch，这里先取一次 */
    const stale = lease.accept({ session: "s-1", version: 2, itemId: "tok-b", pending: false });
    const wrongSession = lease.accept({ session: "s-2", version: 3, itemId: "tok-c", pending: false });
    const b = lease.accept({ session: "s-1", version: 3, itemId: "tok-b", pending: false });
    const back = lease.accept({ session: "s-1", version: 4, itemId: "tok-a", pending: false });
    if (!a || !capA || capA.itemId !== "tok-a" || !capAtFirst) bad("租约没有接受第一个合法 target");
    else if (stale) bad("旧 version 被接受了（乱序包会刷错 token）");
    else if (wrongSession) bad("换 session 的包被接受了（上一轮后台的残包）");
    else if (!b || !back) bad("递增 version 没有接受（A→B→A 拒不了）");
    else if (capA.current()) bad("A→B→A 之后旧 capture 还认为自己是当前的");
    else if (!lease.accept({ session: "s-1", version: 5, itemId: "tok-a", pending: true }) ||
      lease.capture() !== null) bad("pending=true 时不该能 capture（面板正在读）");
    else ok("版本租约：旧 version / 换 session 拒绝、A→B→A 让旧 capture 失效、pending 时不能 capture");
  }

  /* ---- 3) 右键「添加血条组件」→ 写开关 + 打开编辑窗 ---- */
  const HPE_MONSTER = "tok-hpe-monster";
  const hpeMonster = {
    id: HPE_MONSTER, type: "IMAGE", name: "杂兵", layer: "CHARACTER",
    createdUserId: "user-gm", position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, metadata: {}
  };
  sceneItems.push(hpeMonster);
  boundsFor[HPE_MONSTER] = { min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 };
  {
    const hpeMenu = all("contextMenu.create").map((c) => c[1]).filter((m) => m.id === "com.4enext-owlbear/hpbar-add")[0];
    if (!hpeMenu) bad("找不到「添加血条组件」菜单");
    else {
      const before = all("popover.open").length;
      await hpeMenu.onClick({ items: [hpeMonster] });
      await sleep(160);
      const win = all("popover.open").map((c) => c[1]).slice(before).filter((c) => /hp-edit\.html/.test(String(c.url))).pop();
      if (hpeMonster.metadata["com.4enext-owlbear/hp-bar/enabled"] !== true) {
        bad("「添加血条组件」没有写 hp-bar/enabled = true");
      } else if (!win) {
        bad("「添加血条组件」没有打开血条编辑窗（用户要的就是这个入口）");
      } else if (win.id !== "com.4enext-owlbear/hp-edit") {
        bad("编辑窗的 popover id 不对：" + win.id);
      } else if (win.width !== 420 || win.height !== 126) {
        bad("编辑窗尺寸不是 420×126：" + win.width + "×" + win.height);
      } else if (!new RegExp("hp-edit\\.html\\?item=" + HPE_MONSTER + "&session=").test(win.url)) {
        bad("编辑窗 url 没带 item / session：" + win.url);
      } else if (win.hidePaper !== true || win.disableClickAway !== true) {
        bad("编辑窗 popover 参数不对（hidePaper / disableClickAway）");
      } else {
        ok("右键「添加血条组件」→ 写 true + 打开 /hp-edit（420×126，url 带 item + session）");
      }
    }
    const targets = all("broadcast.sendMessage").map((c) => c[1]).filter((m) => /\/hp-edit-target$/.test(m.channel));
    const lastTarget = targets[targets.length - 1];
    if (!lastTarget) bad("开窗时没有广播 hp-edit-target（窗里不知道编辑谁）");
    else if (lastTarget.opts && lastTarget.opts.destination !== "LOCAL") bad("hp-edit-target 不是 LOCAL：" + JSON.stringify(lastTarget.opts));
    else if (!lastTarget.data || typeof lastTarget.data.session !== "string" || !lastTarget.data.session) bad("hp-edit-target 没有 session：" + JSON.stringify(lastTarget.data));
    else if (!(lastTarget.data.version > 0) || lastTarget.data.itemId !== HPE_MONSTER || lastTarget.data.pending !== false) {
      bad("hp-edit-target 内容不对：" + JSON.stringify(lastTarget.data));
    } else {
      ok("广播 hp-edit-target { session, version:" + lastTarget.data.version + ", itemId, pending:false }（LOCAL）");
    }

    /* ready 握手：同 session → 补发；换 session → 不补发 */
    const readyCbs = broadcastCbs["com.4enext-owlbear/hp-edit-ready"] || [];
    if (!readyCbs.length) bad("没有订阅 hp-edit-ready（页面加载完要一次 target）");
    else {
      const n0 = all("broadcast.sendMessage").filter((c) => /\/hp-edit-target$/.test(c[1].channel)).length;
      readyCbs[0]({ data: { session: lastTarget.data.session } });
      await sleep(50);
      const n1 = all("broadcast.sendMessage").filter((c) => /\/hp-edit-target$/.test(c[1].channel)).length;
      readyCbs[0]({ data: { session: "上一轮的旧 session" } });
      await sleep(50);
      const n2 = all("broadcast.sendMessage").filter((c) => /\/hp-edit-target$/.test(c[1].channel)).length;
      if (n1 <= n0) bad("ready 握手没有补发 target（页面会拿不到「当前编辑谁」）");
      else if (n2 !== n1) bad("session 不对的 ready 也补发了 target（残包会打到新窗口）");
      else ok("ready 握手：同 session 补发 target、换 session 不补发");
    }
  }

  /* ---- 4) 页面保存（用同一份 hp-edit-core 写盘）→ 血条立刻重画 ---- */
  const sceneDeps = {
    getItems: async (ids) => sceneItems.filter((it) => ids.includes(it.id)).map((it) => JSON.parse(JSON.stringify(it))),
    updateItems: async (ids, fn) => { await OBR.scene.items.updateItems(ids, fn); },
    getRole: async () => "GM",
    getId: async () => "user-gm",
    now: () => 5555
  };
  {
    const saved = await HPE.writeHpEdit(sceneDeps, HPE_MONSTER,
      { cur: 20, max: 20, temp: 3, defenses: { ac: 18, fort: 15, reflex: 17, will: 16 } });
    if (!saved.ok) bad("GM 给杂兵保存失败：" + JSON.stringify(saved));
    const savedCbs = broadcastCbs["com.4enext-owlbear/hp-edit-saved"] || [];
    if (!savedCbs.length) bad("没有订阅 hp-edit-saved（保存后不会立刻重画）");
    else {
      for (const cb of savedCbs) cb({ data: { itemId: HPE_MONSTER, hp: saved.hp } });
      await sleep(260);
      const items = liveOf(HPE_MONSTER);
      const roles = items.map(barRoleOf);
      if (!items.length) bad("保存后血条没有画出来（hp-edit-saved 没触发重画）");
      else if (items.length !== 11) bad("杂兵保存后应画 11 件（环 2 + HP 数字 1 + 四盾 + 4 数字），实际 " + items.length + "：" + roles.join(","));
      else if (!items.some((it) => barRoleOf(it) === "ac-shield" && it.metadata["com.4enext-owlbear/bar"].key === "ac")) {
        bad("四防盾没有按 key=ac 画出来");
      } else ok("没绑角色卡的杂兵：保存 20/20 + 临时 3 + 四防 → 血条立刻画出 11 件（环形 + 四角四防，含 AC 盾）");
    }
  }
  {
    /* 四防四个框全空 → 删键 → 一枚盾都不画（HP 条照旧） */
    const cleared = await HPE.writeHpEdit(sceneDeps, HPE_MONSTER, { defenses: null });
    const meta = hpeMonster.metadata[HP_E_KEY];
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(300);
    const items = liveOf(HPE_MONSTER);
    const shields = items.filter((it) => ["def", "ac-shield"].indexOf(barRoleOf(it)) >= 0);
    const shieldTexts = items.filter((it) => ["def-text", "ac-text"].indexOf(barRoleOf(it)) >= 0);
    if (!cleared.ok) bad("清空四防保存失败：" + JSON.stringify(cleared));
    else if (meta && "defenses" in meta) bad("清空四防后 metadata 里还留着 defenses 键：" + JSON.stringify(meta));
    else if (shields.length || shieldTexts.length) bad("空四防仍然画了 " + shields.length + " 枚盾（应该一枚都不画）");
    else if (!items.some((it) => barRoleOf(it) === "bar-text")) bad("清空四防把 HP 条也弄没了（只该不画盾）");
    else ok("空四防：metadata 删掉 defenses、一枚盾都不画，HP 条照旧");
  }
  /* ---- 4b) v1.8.5：血条编辑窗改「即改即生效」——没有保存按钮 / 底栏，输入自动保存 ---- */
  {
    const editHtml = fs.readFileSync(path.join(ROOT, "hp-edit.html"), "utf8");
    const editPage = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
    if (editHtml.indexOf("hpe-save") < 0 && editHtml.indexOf("hpe-foot") < 0 && editHtml.indexOf("win-foot") < 0)
      ok("v1.8.5：血条编辑窗没有保存按钮、没有底栏（即改即生效）");
    else bad("v1.8.5：编辑窗还留着保存按钮 / 底栏");
    const wired = editPage.indexOf('el.addEventListener("input"') >= 0 &&
      editPage.indexOf('el.addEventListener("change"') >= 0 &&
      editPage.indexOf('el.addEventListener("blur"') >= 0 &&
      editPage.indexOf('commit("enter", el)') >= 0 &&
      editPage.indexOf("function scheduleSave()") >= 0 &&
      /SAVE_DEBOUNCE_MS = 500/.test(editPage) &&
      editPage.indexOf("hpPatchEqualsView(built.patch") >= 0 &&
      editPage.indexOf("CH_HP_EDIT_SAVED") >= 0 &&
      editPage.indexOf("els.save") < 0;
    if (wired) ok("v2.4.13：自动保存接线齐全（input 防抖 500ms + change/blur/Enter 立即提交 + 同值不写 + 广播 CH_HP_EDIT_SAVED）");
    else bad("v2.4.13：自动保存接线缺项（input/change/blur/Enter/去抖/去重/广播）");
    if (editHtml.indexOf("hpe-temp") >= 0 && editHtml.indexOf("hpe-pin") >= 0 &&
      editHtml.indexOf("hpe-lock") >= 0 && editHtml.indexOf("hpe-repaint") >= 0 &&
      editHtml.indexOf("hpe-hp-pill") >= 0 && editHtml.indexOf("hpe-surge") < 0)
      ok("v2.4.13：布局有生命药丸 / 临时生命 / 钉住 / 锁定 / 重绘，回复力输入已去掉");
    else bad("v2.4.13：编辑窗布局字段不全 / 还留着回复力");
    if (editPage.indexOf("--hp-ratio") >= 0 && editPage.indexOf("PIN_KEY") >= 0 &&
      editPage.indexOf("CH_HP_REPAINT") >= 0 && editPage.indexOf("el.select()") >= 0 &&
      editPage.indexOf("setBusy(") >= 0 && editPage.indexOf("disabled = dis") >= 0 &&
      editPage.indexOf("toggleLock") >= 0 && editPage.indexOf("repaintBars") >= 0)
      ok("v2.4.13：页面接药丸比例 / 钉住 / 锁定 / 重绘 / 聚焦全选 / saving 禁用输入");
    else bad("v2.4.13：页面交互接线缺项（比例/钉住/锁定/重绘/聚焦/saving）");
    const view = { cur: 20, max: 20, temp: 2, defenses: { ac: 18, fort: 15, reflex: 17, will: 16 } };
    const samePatch = { cur: 20, max: 20, temp: 2, defenses: { ac: 18, fort: 15, reflex: 17, will: 16 } };
    if (typeof HPE.hpPatchEqualsView === "function" && HPE.hpPatchEqualsView(samePatch, view) === true &&
      HPE.hpPatchEqualsView({ cur: 19 }, view) === false &&
      HPE.hpPatchEqualsView({ defenses: null }, view) === false &&
      HPE.hpPatchEqualsView({ defenses: null }, { defenses: null }) === true)
      ok("v2.4.13：hpPatchEqualsView 同值判重（cur/max/temp/四防逐字段比较，相同不写）");
    else bad("v2.4.13：hpPatchEqualsView 判重不对");
    const badHp = HPE.buildHpEditPatch({ cur: "20/", max: "20", temp: "0", defs: {} }, view);
    if (!badHp.ok) ok("v2.4.13：非法 / 半截输入（20/）不生成 patch → 不会写 token");
    else bad("v2.4.13：半截输入也能生成 patch（会写坏数据）");
    const lockOn = await HPE.writeHpEdit(sceneDeps, HPE_MONSTER, { locked: true });
    const lockMeta = hpeMonster.metadata[HP_E_KEY];
    const lockOff = await HPE.writeHpEdit(sceneDeps, HPE_MONSTER, { locked: false });
    if (lockOn.ok && lockMeta && lockMeta.locked === true && lockOff.ok && hpeMonster.metadata[HP_E_KEY].locked === false)
      ok("v2.4.13：锁定切换写 hp.locked（true → false）");
    else bad("v2.4.13：锁定切换没有写 hp.locked");
    const ro = await HPE.writeHpEdit({
      getItems: async (ids) => sceneItems.filter((it) => ids.includes(it.id)).map((it) => JSON.parse(JSON.stringify(it))),
      updateItems: async (ids, fn) => { await OBR.scene.items.updateItems(ids, fn); },
      getRole: async () => "PLAYER",
      getId: async () => "u-other"
    }, HPE_MONSTER, { cur: 1, max: 1 });
    if (!ro.ok) ok("v1.8.5：只读（无权限 / locked）不写 token");
    else bad("v1.8.5：只读还写 token");
  }
  /* v2.4.13：钉住（选中变化 / 取消选中不关窗）与「重绘血条」频道 */
  {
    const HPE_ID = "com.4enext-owlbear/hp-edit";
    const wcCb = (broadcastCbs["com.4enext-owlbear/win-close"] || [])[0];
    const closeCount = () => all("popover.close").filter((c) => c[1] === HPE_ID).length;
    const select = async (ids, opts) => {
      const ackInfo = !opts || opts.ackInfo !== false;
      const ackHp = !opts || opts.ackHp !== false;
      selection = ids.slice();
      for (const cb of playerChangeCbs) cb();
      await sleep(300);
    };
    if (wcCb) { wcCb({ data: { op: "close-win", name: "hpEdit" } }); await sleep(120); }
    lsStore["4enext/hp-edit/pinned"] = "1";
    await select([]);
    await select([HPE_MONSTER]);
    const c0 = closeCount();
    await select([]);
    if (closeCount() !== c0) bad("v2.4.13：钉住后取消选中仍然自动关窗");
    else ok("v2.4.13：钉住 → 取消选中不自动关窗");
    lsStore["4enext/hp-edit/pinned"] = "0";
    await select([HPE_MONSTER]);
    const c1 = closeCount();
    await select([]);
    if (closeCount() === c1) bad("v2.4.13：未钉住时取消选中没有自动关窗");
    else ok("v2.4.13：未钉住 → 取消选中自动关窗（跟随选中）");
    const repaintCbs = broadcastCbs["com.4enext-owlbear/hp-repaint"] || [];
    if (!repaintCbs.length) bad("v2.4.13：没有订阅 CH_HP_REPAINT（重绘按钮没用）");
    else {
      const before = liveOf(HPE_MONSTER).length;
      for (const cb of repaintCbs) cb({ data: { itemId: HPE_MONSTER } });
      await sleep(320);
      const after = liveOf(HPE_MONSTER).length;
      if (before > 0 && after > 0) ok("v2.4.13：CH_HP_REPAINT 触发强制重算（血条件数 " + before + " → " + after + "，环 / 盾 / 徽记重建）");
      else bad("v2.4.13：重绘后血条件数变了 / 没画出来：" + before + " → " + after);
    }
    await select([HPE_MONSTER]); /* 给后面的拖动用例留一个开着的编辑窗 */
  }

  {
    /* 拖动编辑窗：位置跟手、尺寸不变、url 里的 ?item= 不能丢（丢了就编错 token） */
    const cfgBefore = all("popover.open").map((c) => c[1]).filter((c) => /hp-edit\.html/.test(String(c.url))).pop();
    if (!winDragCb || !cfgBefore) bad("没有可拖动的血条编辑窗（WINS.hpEdit 没注册？）");
    else {
      const basePos = cfgBefore.anchorPosition;
      winDragCb({ win: "hpEdit", phase: "start", dx: 0, dy: 0 });
      winDragCb({ win: "hpEdit", phase: "move", dx: 60, dy: 40 });
      winDragCb({ win: "hpEdit", phase: "end", dx: 60, dy: 40 });
      await sleep(140);
      const moved = all("popover.open").map((c) => c[1]).filter((c) => /hp-edit\.html/.test(String(c.url))).pop();
      if (!moved || moved.anchorPosition.left !== basePos.left + 60 || moved.anchorPosition.top !== basePos.top + 40) {
        bad("拖动血条编辑窗没有跟手：" + JSON.stringify(moved && moved.anchorPosition));
      } else if (!new RegExp("\\?item=" + HPE_MONSTER + "&session=").test(moved.url)) {
        bad("拖动重开编辑窗时把 ?item= 丢了：" + moved.url);
      } else if (moved.width !== 420 || moved.height !== 126) {
        bad("拖动时编辑窗尺寸变了：" + moved.width + "×" + moved.height);
      } else {
        ok("拖动血条编辑窗：位置跟手、尺寸不变、url 里的 ?item= 没丢");
      }
      const savedPos = JSON.parse(lsStore["4enext/win-pos"] || "{}");
      const one = savedPos && savedPos.pos ? savedPos.pos.hpEdit : null;
      if (!one) bad("拖动结束后没有记住编辑窗位置（下次开窗会跳回默认点）");
      else ok("编辑窗位置按窗口名 hpEdit 记在 localStorage（" + one.left + "," + one.top + "）");
    }
  }
  {
    /* 「移除血条组件」：只写 false、hp 数据保留、血条消失 */
    const hpeRemove = all("contextMenu.create").map((c) => c[1]).filter((m) => m.id === "com.4enext-owlbear/hpbar-remove")[0];
    await hpeRemove.onClick({ items: [hpeMonster] });
    await sleep(200);
    const meta = hpeMonster.metadata[HP_E_KEY];
    if (hpeMonster.metadata["com.4enext-owlbear/hp-bar/enabled"] !== false) bad("「移除血条组件」没有写 false");
    else if (!meta || meta.max !== 20) bad("「移除血条组件」把 hp 数据删了（下次「添加」恢复不了）");
    else if (liveOf(HPE_MONSTER).length) bad("移除后血条还在：" + liveOf(HPE_MONSTER).length + " 件");
    else ok("「移除血条组件」→ 写 false、hp 数据保留（20/20）、血条消失");
  }

  /* =======================================================================
   * v1.7.4：骰子窗口 320×620 + 「记录窗口」开关链路（用户：点了打不开）
   * 频道：CH_DICE_HIST_CMD（骰子窗口 → 后台）/ CH_DICE_HIST_STATE（后台 → 所有页面）
   * ===================================================================== */
  {
    const HIST_ID = "com.4enext-owlbear/dice-history-window";
    const HIST_CMD = "com.4enext-owlbear/dice-hist-cmd";
    const HIST_STATE = "com.4enext-owlbear/dice-hist-state";
    const histCmdCb = (broadcastCbs[HIST_CMD] || [])[0];
    const stateOf = () => {
      const msg = all("broadcast.sendMessage").map((c) => c[1]).filter((m) => m.channel === HIST_STATE).pop();
      return msg ? msg.data : null;
    };
    const lastHistOpen = () => all("popover.open").map((c) => c[1]).filter((c) => String(c.url).indexOf("dice-history.html") >= 0).pop();
    const lastHistClose = () => all("popover.close").map((c) => c[1]).filter((x) => x === HIST_ID).pop();

    /* 先把骰子窗口按 v1.7.4 的尺寸开一遍（320×620），记录窗口要贴着它摆 */
    const diceNow = await openDiceWindow();
    if (!diceNow) bad("v1.7.4：骰子窗口打不开");
    else if (diceNow.width !== 320 || diceNow.height !== 620)
      bad("v1.7.4：骰子窗口不是 320×620：" + diceNow.width + "×" + diceNow.height);
    else ok("v1.7.4：点工具栏「骰子」→ 320×620 的窄竖条窗口");

    if (!histCmdCb) bad("没有订阅 " + HIST_CMD + "（记录窗口永远开不出来）");
    else if (!diceNow) bad("骰子窗口没开，记录窗口的位置断言跳过");
    else {
      ok("订阅了记录窗口开关频道 " + HIST_CMD);

      /* ① toggle → popover.open(dice-history.html)，而且**贴着骰子窗口**摆（不叠在它里面） */
      const opensBefore = all("popover.open").length;
      histCmdCb({ data: { op: "toggle" } });
      await sleep(160);
      const first = lastHistOpen();
      if (!first) bad("点「记录窗口」（toggle）没有 OBR.popover.open 出 dice-history.html");
      else if (first.id !== HIST_ID) bad("记录窗口的 popover id 不对：" + first.id);
      else if (first.width !== 300 || first.height !== 240) bad("记录窗口尺寸不是 300×240：" + first.width + "×" + first.height);
      else if (first.anchorReference !== "POSITION" || first.hidePaper !== true || first.disableClickAway !== true)
        bad("记录窗口没有 POSITION / hidePaper / disableClickAway：" + JSON.stringify([first.anchorReference, first.hidePaper, first.disableClickAway]));
      else if (!/\/dice-history\.html(?:\?.*)?$/.test(first.url)) bad("记录窗口的 url 不对：" + first.url);
      else {
        const dx = first.anchorPosition.left - diceNow.anchorPosition.left;
        const dy = first.anchorPosition.top - diceNow.anchorPosition.top;
        const overlapX = dx < diceNow.width && dx + first.width > 0;
        const overlapY = dy < diceNow.height && dy + first.height > 0;
        if (overlapX && overlapY) bad("记录窗口叠在骰子窗口里（看起来就像没打开）：" + JSON.stringify(first.anchorPosition));
        else if (dx !== diceNow.width + 12 || dy !== 0)
          bad("记录窗口没有贴在骰子窗口右边（期望 +" + (diceNow.width + 12) + ",0）：" + JSON.stringify([dx, dy]));
        else ok("记录窗口开在骰子窗口**右边**（" + JSON.stringify(first.anchorPosition) + "，不重叠）");
      }
      if (all("popover.open").length !== opensBefore + 1) bad("一次 toggle 开了 " + (all("popover.open").length - opensBefore) + " 个窗口");
      const st1 = stateOf();
      if (!st1 || st1.open !== true) bad("打开后没有广播 CH_DICE_HIST_STATE { open:true }：" + JSON.stringify(st1));
      else ok("打开后广播 CH_DICE_HIST_STATE { open:true }（骰子窗口的按钮据此显示「记录窗口 · 开」）");

      /* ①b v1.9.2：页面直开位置若和骰子窗口重叠 >30%，后台 adopt 时应挪到骰子窗口左侧 */
      const diceRect = { left: diceNow.anchorPosition.left, top: diceNow.anchorPosition.top, width: diceNow.width, height: diceNow.height };
      const overlapRatio = (a) => {
        const iw = Math.max(0, Math.min(a.left + a.width, diceRect.left + diceRect.width) - Math.max(a.left, diceRect.left));
        const ih = Math.max(0, Math.min(a.top + a.height, diceRect.top + diceRect.height) - Math.max(a.top, diceRect.top));
        return (iw * ih) / Math.max(1, a.width * a.height);
      };
      histCmdCb({ data: { op: "adopt", left: diceRect.left + 8, top: diceRect.top + 8, width: 300, height: 240 } });
      await sleep(160);
      const adopted = lastHistOpen();
      if (!adopted) bad("adopt 没有重开记录窗口");
      else if (overlapRatio({ left: adopted.anchorPosition.left, top: adopted.anchorPosition.top, width: adopted.width, height: adopted.height }) > 0.3) bad("adopt 后记录窗口仍与骰子窗口重叠 >30%：" + JSON.stringify(adopted.anchorPosition));
      else ok("adopt：直开位置与骰子窗口重叠 >30% → 后台挪到旁边重开（重叠 " +
        Math.round(overlapRatio({ left: adopted.anchorPosition.left, top: adopted.anchorPosition.top, width: adopted.width, height: adopted.height }) * 100) + "%）");

      /* ② 再 toggle 一次 → 关掉（同一个 id）+ 广播 open:false */
      const closeCountBefore = all("popover.close").filter((c) => c[1] === HIST_ID).length;
      histCmdCb({ data: { op: "toggle" } });
      await sleep(160);
      if (all("popover.close").filter((c) => c[1] === HIST_ID).length === closeCountBefore) bad("第二次 toggle 没有 OBR.popover.close 记录窗口");
      else if (lastHistClose() !== HIST_ID) bad("关掉的 popover id 不对：" + lastHistClose());
      else {
        const st2 = stateOf();
        if (!st2 || st2.open !== false) bad("关闭后没有广播 open:false：" + JSON.stringify(st2));
        else ok("再 toggle → OBR.popover.close(" + HIST_ID + ") + 广播 { open:false }");
      }

      /* ③ 记录窗口页面加载完的握手（op: "ready"）：后台把「开着」补上（下次点才是关闭） */
      histCmdCb({ data: { op: "ready" } });
      await sleep(80);
      const st3 = stateOf();
      if (!st3 || st3.open !== true) bad("ready 握手没有把「记录窗口开着」补上：" + JSON.stringify(st3));
      else ok('ready 握手（窗口是骰子页自己兜底开的）→ 状态补成 open:true');
      histCmdCb({ data: { op: "close" } });
      await sleep(120);

      /* ④ 开窗失败：重试一次，仍失败就 ERROR 通知（绝不静默） */
      const realOpen = OBR.popover.open;
      let attempts = 0;
      OBR.popover.open = async (cfg) => {
        if (String(cfg.url).indexOf("dice-history.html") >= 0) {
          attempts++;
          throw new Error("宿主拒绝了 popover.open（测试）");
        }
        return realOpen(cfg);
      };
      const notesBefore = calls.filter((c) => c[0] === "notification.show").length;
      histCmdCb({ data: { op: "open" } });
      await sleep(420);
      OBR.popover.open = realOpen;
      const errNotes = calls.filter((c) => c[0] === "notification.show").slice(notesBefore).map((c) => c[1]);
      if (attempts !== 2) bad("开窗失败没有重试一次（实际尝试 " + attempts + " 次）");
      else ok("开窗失败会重试一次（共 2 次 popover.open）");
      const histErr = errNotes.filter((n) => n.variant === "ERROR" && /记录窗口/.test(String(n.msg)));
      if (!histErr.length) bad("开窗失败没有 ERROR 通知：" + JSON.stringify(errNotes));
      else ok("重试仍失败 → ERROR 通知：" + String(histErr[0].msg).slice(0, 46) + "…");
      const st4 = stateOf();
      if (!st4 || st4.open !== false) bad("开窗失败后没有把状态广播成 open:false：" + JSON.stringify(st4));
      else ok("开窗失败后状态回到 open:false（按钮不会假装开着）");
    }
  }

  /* =======================================================================
   * v1.7.7：选中即弹 —— 未绑定卡但有血条 → 血条编辑窗（三分支 / 不重复弹 / 右键「编辑血条」/ 锁只读）
   * ---------------------------------------------------------------------
   * 用户原话：「血条插件你没做点击跳出修改栏么」—— 以前只有右键「添加血条组件」能开编辑窗。
   * ===================================================================== */
  {
    const HP_A = "com.4enext-owlbear/hp";
    const HP_BAR_A = "com.4enext-owlbear/hp-bar/enabled";
    const AUTO_ID = "tok-auto-hp";
    const FLAG_ID = "tok-auto-flag";
    const PLAIN_ID = "tok-auto-plain";
    const mk = (id, name, metadata) => ({
      id, type: "IMAGE", name, layer: "CHARACTER", createdUserId: "user-gm",
      position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, metadata: metadata || {}
    });
    const autoTok = mk(AUTO_ID, "有血条的杂兵", {
      [HP_A]: { cur: 50, max: 100, defenses: { ac: 20, fort: 20, reflex: 20, will: 20 }, updatedAt: 7 }
    });
    const flagTok = mk(FLAG_ID, "只开了开关的杂兵", { [HP_BAR_A]: true });
    const plainTok = mk(PLAIN_ID, "没血条的杂兵");
    for (const t of [autoTok, flagTok, plainTok]) {
      sceneItems.push(t);
      boundsFor[t.id] = { min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 };
    }
    const hpOpens = () => all("popover.open").map((c) => c[1]).filter((c) => /hp-edit\.html/.test(String(c.url)));
    const hpTargets = () => all("broadcast.sendMessage").map((c) => c[1]).filter((m) => /\/hp-edit-target$/.test(m.channel));
    const lastHpTarget = () => (hpTargets().pop() || {}).data || null;
    const infoOpens = () => all("popover.open").map((c) => c[1]).filter((c) => /\/info\.html/.test(String(c.url)));
    const hpAckCbs = broadcastCbs["com.4enext-owlbear/hp-edit-ack"] || [];
    const select = async (ids, opts) => {
      const ackInfo = !opts || opts.ackInfo !== false;
      const ackHp = !opts || opts.ackHp !== false;
      selection = ids.slice();
      for (const cb of playerChangeCbs) cb();
      /* v2.4.13：等 target 真的切到目标 token 再 ack（否则 600ms 后后台兜底重开会多一次 popover.open）。
       * 同时顺手 ack info-target，避免本 helper 的等待拖到 info 的 700ms 兜底。 */
      const want = ids[0] || "";
      const infoAckCbs = broadcastCbs["com.4enext-owlbear/info-ack"] || [];
      for (let i = 0; i < 6; i++) {
        await sleep(50);
        const it = (all("broadcast.sendMessage").map((c) => c[1]).filter((m) => /\/info-target$/.test(m.channel)).pop() || {}).data;
        if (ackInfo && it && it.session && infoAckCbs[0]) {
          infoAckCbs[0]({ data: { session: it.session, version: it.version, itemId: it.itemId } });
        }
        const t = lastHpTarget();
        if (ackHp && want && t && t.itemId === want && hpAckCbs[0]) {
          hpAckCbs[0]({ data: { session: t.session, version: t.version, itemId: t.itemId } });
          break;
        }
        if (!want) break;
      }
      await sleep(220);
    };

    /* ① 没绑定卡、也没有血条 → 什么都不弹（老行为） */
    let h0 = hpOpens().length;
    let i0 = infoOpens().length;
    await select([PLAIN_ID]);
    if (hpOpens().length !== h0) bad("选中「没卡也没血条」的 token 居然弹了血条编辑窗");
    else if (infoOpens().length !== i0) bad("选中「没卡也没血条」的 token 居然弹了速览");
    else ok("v1.7.7 分支③：没绑定卡、也没血条 → 什么都不弹（老行为）");

    /* ② 没绑定卡 + 有 hp 数据 → 弹血条编辑窗 */
    h0 = hpOpens().length;
    await select([AUTO_ID]);
    let win = hpOpens()[hpOpens().length - 1];
    if (hpOpens().length === h0) bad("选中「没绑定卡但有血条数据」的 token 没有弹血条编辑窗（用户要的就是这个入口）");
    else if (!win || win.id !== "com.4enext-owlbear/hp-edit") bad("自动弹出的 popover id 不是 /hp-edit：" + (win && win.id));
    else if (!new RegExp("hp-edit\\.html\\?item=" + AUTO_ID + "&session=").test(win.url)) bad("自动弹的编辑窗 url 没带这枚 token：" + win.url);
    else if (win.width !== 420 || win.height !== 126) bad("自动弹的编辑窗不是 420×126：" + win.width + "×" + win.height);
    else ok("v1.7.7 分支②：没绑定卡 + 有血条数据 → 选中即弹 /hp-edit（420×126，url 带 item + session）");

    /* ③ 只有开关（hp-bar/enabled = true）、没有 hp 数值 → 也算有血条 */
    h0 = hpOpens().length;
    await select([FLAG_ID]);
    if (lastHpTarget() && lastHpTarget().itemId === FLAG_ID) ok("v1.7.7 分支②（开关）：hp-bar/enabled = true 也算「有血条」→ 自动切到编辑窗目标");
    else bad("选中「只开了血条组件开关」的 token 没有切编辑窗目标：" + JSON.stringify(lastHpTarget()));

    /* ④ 同一个 token 只自动弹一次：player / scene 事件不再弹（否则关掉又被弹回来） */
    const t0Item = lastHpTarget() && lastHpTarget().itemId;
    const o0 = hpOpens().length;
    for (const cb of playerChangeCbs) cb();
    await sleep(240);
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(320);
    if (hpOpens().length !== o0 || (lastHpTarget() && lastHpTarget().itemId) !== t0Item)
      bad("同一个 token 反复触发事件时又切了目标 / 重开了窗（关不掉） [opens " + o0 + "→" + hpOpens().length + " item " + t0Item + "→" + (lastHpTarget() && lastHpTarget().itemId) + "]");
    else ok("v1.7.7：同一个 token 只自动弹一次（player / scene 事件 / 保存后重画都不会再弹）");

    /* ⑤ 已绑定卡 → 只弹速览（三分支的第一支不能被破坏） */
    h0 = hpOpens().length;
    i0 = infoOpens().length;
    await select([TOKEN_ID]);
    const infoWin = infoOpens()[infoOpens().length - 1];
    /* v2.4.13：窗口已开时选另一枚绑卡 token 只切 target（不重开）；接受 target 广播。 */
    const switched = all("broadcast.sendMessage").some((c) => /info-target$/.test(String(c[1] && c[1].channel)) &&
      c[1] && c[1].data && c[1].data.itemId === "tok-1");
    if (infoOpens().length === i0 && !switched) bad("选中已绑定卡的 token 没有弹速览（v1.2 的老行为被破坏了）");
    else if (infoOpens().length === i0 && switched) ok("v2.4.13：速览已开时选另一枚绑卡 token → 只切 target（不重开窗）");
    else if (!infoWin || !/\/info\.html\?v=[\d.]+&item=tok-1&card=c-1(&session=[^&]+)?(&mode=[a-z]+)?$/.test(infoWin.url)) bad("速览的 url 不对：" + (infoWin && infoWin.url));
    else if (hpOpens().length !== h0) bad("已绑定卡的 token 同时也弹了血条编辑窗（应该只弹速览）");
    else ok("v1.7.7 分支①：已绑定卡 → 只弹速览 /info，不弹 /hp-edit（老行为不变）");

    /* ⑥ 多选 → 什么都不弹（不变） */
    h0 = hpOpens().length;
    i0 = infoOpens().length;
    await select([AUTO_ID, TOKEN_ID]);
    if (hpOpens().length !== h0 || infoOpens().length !== i0) bad("多选 token 时弹窗了（应该什么都不弹）");
    else ok("v1.7.7：多选 → 什么都不弹（不变）");

    /* ⑦ 取消选中会清掉「弹过」的记忆 → 重新选中会再弹一次 */
    await select([]);
    h0 = hpOpens().length;
    await select([AUTO_ID]);
    if (hpOpens().length === h0) bad("取消选中再重新选中同一枚 token 时没有重新弹编辑窗（记忆应该清掉）");
    else ok("v1.7.7：取消选中后记忆清空 → 重新选中同一枚 token 会再弹一次");

    /* ⑧ 右键「编辑血条」：不看选中，直接开这枚 token 的编辑窗，且**不改开关** */
    const editMenu = all("contextMenu.create").map((c) => c[1]).filter((m) => m.id === "com.4enext-owlbear/hpbar-edit")[0];
    if (!editMenu) bad("右键菜单没有「编辑血条」（关掉自动弹的窗之后就没入口再改了）");
    else if (!editMenu.icons[0] || editMenu.icons[0].label !== "编辑血条") bad("「编辑血条」文案不对：" + JSON.stringify(editMenu.icons[0] && editMenu.icons[0].label));
    else if (!editMenu.icons[0].filter.some || editMenu.icons[0].filter.some[0].value !== true) {
      bad("「编辑血条」的 filter 不对（应该只在 hp-bar/enabled === true 时出现）");
    } else {
      selection = [];
      h0 = hpOpens().length;
      const beforeMeta = JSON.stringify(flagTok.metadata);
      await editMenu.onClick({ items: [flagTok] });
      await sleep(180);
      const mWin = hpOpens()[hpOpens().length - 1];
      if (hpOpens().length === h0) bad("右键「编辑血条」没有打开编辑窗");
      else if (!mWin || !new RegExp("\\?item=" + FLAG_ID + "&session=").test(mWin.url)) bad("「编辑血条」开错 token 了：" + (mWin && mWin.url));
      else if (JSON.stringify(flagTok.metadata) !== beforeMeta) bad("「编辑血条」偷偷改了 token 元数据（它只该开窗）");
      else ok("右键「编辑血条」→ 不看选中直接打开这枚 token 的编辑窗，且不改开关");
    }

    /* ⑨ v1.8.4：「移除血条组件」写 enabled=false 后，即使 hp 数据还在也不再自动弹窗（真机 bug） */
    const REMOVED_ID = "tok-auto-removed";
    const LEGACY_ID = "tok-auto-legacy";
    const EXPLICIT_TRUE_ID = "tok-auto-explicit-true";
    const removedTok = mk(REMOVED_ID, "移除血条的杂兵", {
      [HP_A]: { cur: 30, max: 60, updatedAt: 8 },
      [HP_BAR_A]: false
    });
    const legacyTok = mk(LEGACY_ID, "老 token（没写过开关）", {
      [HP_A]: { cur: 40, max: 80, updatedAt: 9 }
    });
    const explicitTrueTok = mk(EXPLICIT_TRUE_ID, "显式开血条的杂兵", {
      [HP_A]: { cur: 45, max: 90, updatedAt: 10 },
      [HP_BAR_A]: true
    });
    for (const t of [removedTok, legacyTok, explicitTrueTok]) {
      sceneItems.push(t);
      boundsFor[t.id] = { min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 };
    }
    if (!BG.hasHpBarData) bad("测试没法直接调 hasHpBarData（run 没暴露）");
    else if (BG.hasHpBarData(removedTok) !== false) bad("hasHpBarData 对 hp-bar/enabled=false 仍返回 true（移除后还会弹）");
    else if (BG.hasHpBarData(legacyTok) !== true) bad("hasHpBarData 对没写过开关的老 token 返回 false（默认行为被改了）");
    else if (BG.hasHpBarData(explicitTrueTok) !== true) bad("hasHpBarData 对 enabled=true 返回 false");
    else ok("v1.8.4 hasHpBarData：enabled=false → false；undefined / true → true");

    /* 选中「已移除血条组件」的 token：即使有 hp 数据也不能自动弹编辑窗 */
    await select([]);
    h0 = hpOpens().length;
    await select([REMOVED_ID]);
    if (hpOpens().length !== h0) bad("选中「已移除血条组件」的 token 仍自动弹了血条编辑窗（真机 bug 没修）");
    else ok("v1.8.4：选中「已移除血条组件」（enabled=false、hp 数据还在）→ 不再自动弹编辑窗");

    /* 老 token（从未写过开关）行为不变：仍然自动弹 */
    h0 = hpOpens().length;
    await select([LEGACY_ID]);
    if (hpOpens().length === h0) bad("老 token（hp-bar/enabled 未写过、默认开）不再自动弹编辑窗（默认行为被改了）");
    else ok("v1.8.4：enabled 未写过的老 token 仍按默认开 → 自动弹编辑窗（行为不变）");

    /* 显式 enabled=true 行为不变 */
    h0 = hpOpens().length;
    await select([EXPLICIT_TRUE_ID]);
    if (lastHpTarget() && lastHpTarget().itemId === EXPLICIT_TRUE_ID) ok("v1.8.4：enabled=true 仍自动切编辑窗目标（行为不变）");
    else bad("enabled=true 的 token 没有自动切编辑窗目标");

    /* 取消选中 → 再选回「已移除」的 token，仍然不弹（记忆清空也不该弹） */
    await select([]);
    const tBefore = hpTargets().length;
    await select([REMOVED_ID]);
    for (const cb of playerChangeCbs) cb();
    await sleep(240);
    if (hpTargets().length !== tBefore) bad("取消选中再选回「已移除血条组件」的 token 又切了编辑窗目标");
    else ok("v1.8.4：取消选中后再选回「已移除血条组件」的 token 仍不弹（反复触发也不弹）");

    /* ⑩ v1.8.5：用户手动 ✕ 关掉速览后，选中不变之前不再自动弹回（修「莫名其妙跳出来」） */
    const WIN_CLOSE_CH = "com.4enext-owlbear/win-close";
    const winCloseCb2 = (broadcastCbs[WIN_CLOSE_CH] || [])[0];
    await select([]);
    await select([TOKEN_ID]);
    const infoWinNow = infoOpens().slice(-1)[0];
    if (!infoWinNow || !winCloseCb2) bad("v1.8.5 前置失败：选中绑卡 token 没弹速览 / 没有 win-close 订阅");
    else {
      winCloseCb2({ data: { op: "close-win", name: "info" } });
      await sleep(80);
      const afterClose = infoOpens().length;
      for (const cb of itemsChangeCbs) cb(sceneItems);
      for (const cb of roomChangeCbs) cb(roomMeta);
      await sleep(320);
      if (infoOpens().length !== afterClose) bad("手动 ✕ 关掉速览后，items / room metadata 变动又把速览弹回来了（真机 bug）");
      else ok("v1.8.5：手动 ✕ 关掉速览后，items / room metadata 变动不再自动弹回");
      const beforeRepeat = infoOpens().length;
      for (const cb of playerChangeCbs) cb();
      await sleep(300);
      if (infoOpens().length !== beforeRepeat) bad("同一选中下 player.onChange 又把速览弹回来了");
      else ok("v1.8.5：同一选中下反复 player.onChange 不再弹速览");
      await select([PLAIN_ID]);
      await select([TOKEN_ID]);
      if (infoOpens().length > beforeRepeat) ok("v1.8.5：选中换到别的 token 再换回来 → 允许重新自动弹一次");
      else bad("选中换了再回来也不弹速览（选中变化没清掉「手动关过」记忆）");
      winCloseCb2({ data: { op: "close-win", name: "info" } });
      await sleep(80);
      const beforeManual = infoOpens().length;
      const opened = BG.openGlance ? await BG.openGlance("测试手动速览") : false;
      await sleep(120);
      if (opened && infoOpens().length > beforeManual)
        ok("v1.8.5：工具栏 openGlance() 手动路径仍能打开速览（不受自动弹记忆影响）");
      else bad("openGlance 手动打开速览被挡住了");
    }

    /* ⑪ v1.8.9：信息窗单窗挂载 —— 连着切两枚绑卡 token 只 open 一次，第二次走 target 广播换内容 */
    const BOUND2_ID = "tok-bound-2";
    sceneItems.push(mk(BOUND2_ID, "第二张绑卡单位", { "com.4enext-owlbear/cardId": "c-1" }));
    boundsFor[BOUND2_ID] = { min: { x: 0, y: 0 }, max: { x: 150, y: 150 }, center: { x: 75, y: 75 }, width: 150, height: 150 };
    const winCloseCb3 = (broadcastCbs["com.4enext-owlbear/win-close"] || [])[0];
    if (winCloseCb3) { winCloseCb3({ data: { op: "close-win", name: "info" } }); await sleep(80); }
    const targetCalls = () => all("broadcast.sendMessage").map((c) => c[1]).filter((m) => /\/info-target$/.test(m.channel));
    await select([]);
    const infoBefore9 = infoOpens().length;
    const targetsBefore9 = targetCalls().length;
    await select([TOKEN_ID]);
    const infoAfterFirst9 = infoOpens().length;
    await select([BOUND2_ID]);
    const infoAfterSecond9 = infoOpens().length;
    if (infoAfterFirst9 === infoBefore9 + 1 && infoAfterSecond9 === infoAfterFirst9)
      ok("v1.8.9：连续选中两枚绑卡 token —— 只 popover.open 一次（第二次换目标不重建 iframe）");
    else bad("v1.8.9：换 token 又重开了速览窗（" + infoBefore9 + "→" + infoAfterFirst9 + "→" + infoAfterSecond9 + "）");
    const targetMsgs = targetCalls().slice(targetsBefore9).map((m) => m.data || {});
    const versions = targetMsgs.map((x) => x.version).filter((v) => typeof v === "number");
    const sessions = new Set(targetMsgs.map((x) => x.session).filter(Boolean));
    if (versions.length >= 2 && versions[versions.length - 1] > versions[0] && sessions.size === 1)
      ok("v1.8.9：target 广播 version 严格递增（" + versions.join("→") + "），session 一致");
    else bad("v1.8.9：target version / session 不对：" + JSON.stringify({ versions, sessions: Array.from(sessions) }));
    /* 页面 ACK 及时回 → 取消 700ms 兜底计时器（避免本组测试被兜底重开打断） */
    const ackCb9 = (broadcastCbs["com.4enext-owlbear/info-ack"] || [])[0];
    const lastTarget9 = targetMsgs[targetMsgs.length - 1] || {};
    if (ackCb9 && lastTarget9.session) {
      ackCb9({ data: { session: lastTarget9.session, version: lastTarget9.version, itemId: lastTarget9.itemId } });
      await sleep(50);
    }
    /* 页面 READY → 后台重发当前 target（防第一条广播早于 iframe 加载） */
    const readyCb9 = (broadcastCbs["com.4enext-owlbear/info-ready"] || [])[0];
    const session9 = Array.from(sessions)[0] || "";
    const beforeReady9 = targetCalls().length;
    const lastVer9 = versions.length ? versions[versions.length - 1] : 0;
    if (readyCb9) { readyCb9({ data: { session: session9 } }); await sleep(80); }
    const readyMsgs9 = targetCalls().slice(beforeReady9).map((m) => m.data || {});
    if (readyMsgs9.length === 1 && readyMsgs9[0].version === lastVer9 && readyMsgs9[0].session === session9)
      ok("v1.8.9：页面 READY → 后台重发当前 target（同 version 同 session，不递增）");
    else bad("v1.8.9：READY 没有重发 target：" + JSON.stringify(readyMsgs9));
    /* 关闭后下次打开重新 popover.open */
    if (winCloseCb3) { winCloseCb3({ data: { op: "close-win", name: "info" } }); await sleep(80); }
    const infoBeforeReopen = infoOpens().length;
    await select([]);
    await select([TOKEN_ID]);
    if (infoOpens().length === infoBeforeReopen + 1)
      ok("v1.8.9：关闭速览后再打开会重新 popover.open（session 重新分配）");
    else bad("v1.8.9：关闭后重新打开没有新建 popover");

    /* v1.9.0：reuse target 后 700ms 无 ack → 兜底关闭重开一次 */
    const openBeforeNoAck = infoOpens().length;
    await select([BOUND2_ID], { ackInfo: false }); /* 换 target（复用 popover），故意不回 ack */
    const openAfterArm = infoOpens().length;
    await sleep(950);
    if (infoOpens().length === openAfterArm + 1)
      ok("v1.9.0：target 广播后 700ms 无 ack → 兜底关闭重开一次（内容也能换过去）");
    else bad("v1.9.0：无 ack 没有触发兜底重开（" + openBeforeNoAck + "→" + openAfterArm + "→" + infoOpens().length + "）");
    /* ack 及时 → 不重开 */
    const openBeforeAckOk = infoOpens().length;
    await select([TOKEN_ID]); /* 再换一次 target，这次马上 ack */
    const lastTargetNow = (all("broadcast.sendMessage").map((c) => c[1]).filter((m) => /\/info-target$/.test(m.channel)).pop() || {}).data || {};
    const ackCbNow = (broadcastCbs["com.4enext-owlbear/info-ack"] || [])[0];
    if (ackCbNow && lastTargetNow.session) ackCbNow({ data: { session: lastTargetNow.session, version: lastTargetNow.version, itemId: lastTargetNow.itemId } });
    await sleep(950);
    if (infoOpens().length === openBeforeAckOk)
      ok("v1.9.0：ack 及时到达 → 不触发兜底重开（正常路径不抖动）");
    else bad("v1.9.0：ack 及时仍重开了 popover（多开了 " + (infoOpens().length - openBeforeAckOk) + " 次）");

    /* v2.4.13 bugfix：7 个输入框 focus 时 select() 必须选中自己（抓 var 闭包让焦点全跑到意志） */
    {
      const src = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
      const start = src.indexOf("inputs.forEach(function (el) {");
      const end = src.indexOf('document.addEventListener("keydown"', start);
      if (start < 0 || end < 0) {
        bad("v2.4.13 bugfix：找不到输入框绑定循环（应该用 inputs.forEach 捕获每个 el）");
      } else {
        const snippet = src.slice(start, end);
        const ids = ["hpe-cur", "hpe-max", "hpe-temp", "hpe-def-ac", "hpe-def-fort", "hpe-def-reflex", "hpe-def-will"];
        const selected = [];
        const inputs = ids.map((id) => ({
          id,
          listeners: {},
          addEventListener(type, cb) { (this.listeners[type] = this.listeners[type] || []).push(cb); },
          select() { selected.push(this.id); }
        }));
        let saveCalls = 0, commitCalls = 0;
        const fn = new Function("inputs", "scheduleSave", "commit", "clearSaveTimer", "closeWindow", "hlog",
          snippet + "\nreturn inputs;");
        fn(inputs, function () { saveCalls++; }, function () { commitCalls++; }, function () {}, function () {}, function () {});
        for (const one of inputs) for (const cb of (one.listeners.focus || [])) cb();
        const okAll = ids.every((id, i) => selected[i] === id);
        if (okAll) ok("v2.4.13 bugfix：7 个输入框各自 focus → select() 选中的就是自己（意志不会再抢焦点）");
        else bad("v2.4.13 bugfix：focus 时 select 选错了框（var 闭包 bug）：" + JSON.stringify(selected));
      }
    }

    /* v2.4.13：页面在 lease.accept 之前先 commit 当前输入（假 DOM 级静态顺序锁） */
    {
      const hpPageSrc = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
      const iCommit = hpPageSrc.indexOf('commit("switch", document.activeElement)');
      const iAccept = hpPageSrc.indexOf("lease.accept(data)");
      if (iCommit >= 0 && iAccept >= 0 && iCommit < iAccept)
        ok("v2.4.13：页面 target 切换先 commit 当前输入，再 lease.accept / load（不会丢未保存输入）");
      else bad("v2.4.13：页面没有「先 commit 再 accept」的顺序");
    }

    /* v2.4.13：血条编辑窗单窗常驻（换 token 只广播 target，不重建 iframe；无 ack 600ms 兜底重开一次；钉住不换目标） */
    {
      const mkHp = (id) => ({
        id, type: "IMAGE", name: "常驻测试 " + id, layer: "CHARACTER", createdUserId: "user-gm",
        position: { x: 0, y: 0 }, scale: { x: 1, y: 1 },
        metadata: { "com.4enext-owlbear/hp": { cur: 10, max: 20, defenses: { ac: 15 }, updatedAt: 1 } }
      });
      const HP2 = "tok-reuse-hp2";
      const HP3 = "tok-reuse-hp3";
      for (const id of [HP2, HP3]) {
        if (!sceneItems.some((it) => it.id === id)) {
          sceneItems.push(mkHp(id));
          boundsFor[id] = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 }, center: { x: 50, y: 50 }, width: 100, height: 100 };
        }
      }
      await select([HP2]);
      const opensBeforeReuse = hpOpens().length;
      const targetsBeforeReuse = hpTargets().length;
      await select([HP3]);
      if (hpOpens().length === opensBeforeReuse && lastHpTarget() && lastHpTarget().itemId === HP3 &&
        hpTargets().length > targetsBeforeReuse)
        ok("v2.4.13：换 token 只广播 target 换目标（iframe 不重建、popover.open 不增加）");
      else bad("v2.4.13：换 token 又重开了编辑窗：opens " + opensBeforeReuse + "→" + hpOpens().length +
        " target " + (lastHpTarget() && lastHpTarget().itemId));
      /* 故意不回 ack → 600ms 后兜底重开一次 */
      const opensBeforeNoAck = hpOpens().length;
      await select([HP2], { ackHp: false });
      await sleep(750);
      if (hpOpens().length === opensBeforeNoAck + 1 && lastHpTarget() && lastHpTarget().itemId === HP2)
        ok("v2.4.13：换目标 600ms 无 ack → 兜底关闭重开一次（内容也能换过去）");
      else bad("v2.4.13：无 ack 没有兜底重开一次：" + opensBeforeNoAck + "→" + hpOpens().length);
      /* 钉住：选中别的 token 不换 target、不关窗 */
      lsStore["4enext/hp-edit/pinned"] = "1";
      const pinnedItem = lastHpTarget() && lastHpTarget().itemId;
      const opensPinned = hpOpens().length;
      await select([HP3], { ackInfo: false });
      if (lastHpTarget() && lastHpTarget().itemId === pinnedItem && hpOpens().length === opensPinned)
        ok("v2.4.13：钉住时选中别的 token 不换 target、不关窗（保持当前 token）");
      else bad("v2.4.13：钉住时 target 被换了：" + pinnedItem + "→" + (lastHpTarget() && lastHpTarget().itemId));
      lsStore["4enext/hp-edit/pinned"] = "0";
    }

    /* ⑨ Boss 锁（hp.locked）→ 非城主的编辑窗只读（藏保存 + 提示「已锁定」） */
    const coreSrcSplit = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-core.js"), "utf8");
    const pageSrcSplit = fs.readFileSync(path.join(ROOT, "assets", "hp-edit-page.js"), "utf8");
    if (coreSrcSplit.indexOf("export function hpEditReadOnly(") < 0 || typeof HPE.hpEditReadOnly !== "function") {
      bad("hp-edit-core 没有 hpEditReadOnly（Boss 锁定时做不了只读）");
    } else if (!HPE.hpEditReadOnly({ locked: true }, "PLAYER")) bad("locked 时玩家的编辑窗没有只读");
    else if (HPE.hpEditReadOnly({ locked: false }, "PLAYER")) bad("没锁（locked:false）时玩家也被锁成只读（锁就没意义了）");
    else if (HPE.hpEditReadOnly({ locked: true }, "GM")) bad("城主被 locked 挡成只读（用户点开编辑窗就改不了）");
    else if (pageSrcSplit.indexOf("hpEditReadOnly(") < 0 || pageSrcSplit.indexOf("已锁定") < 0 ||
      pageSrcSplit.indexOf("setEditable(state.editable)") < 0) {
      bad("编辑窗页面没有接 hpEditReadOnly / 没有「已锁定」提示（只读不会生效）");
    } else ok("Boss 锁：locked → 非城主只读（藏保存 + 提示「已锁定」）、城主照常能改；页面真的接了这条判定");
  }

  finish();
})();

function finish() {
  /* ---- v2.4.13 骰子独立窗口 / 面板关闭不连带 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (bg.indexOf("TOOL_DICE_ID") >= 0 && bg.indexOf('openWinOrNotify("dice"') >= 0 &&
    fs.existsSync(path.join(ROOT, "dice-entry.html")) === false && fs.existsSync(path.join(ROOT, "assets", "dice-entry.js")) === false)
    ok("v2.4.13：骰子改工具栏 TOOL_DICE_ID → openWin(\"dice\")，launcher 文件已删除");
  else bad("v2.4.13：骰子工具/普通窗口路径缺失");
  if (bg.indexOf("closeWinById(data.name)") >= 0 || bg.indexOf("closeWinById") >= 0)
    ok("v2.4.13：CH_WIN_CLOSE 按 name 只关对应窗口（panel 不会连关 dice）");
  else bad("v2.4.13：窗口关闭按 name 的逻辑缺失");
}

/* ---- v2.4.13 窗口健壮性 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  if (bg.indexOf("OBR.popover.getWidth(def.id)") >= 0 &&
    bg.indexOf("win close ignore（刚打开）") >= 0)
    ok("v2.4.13：boot 清 launcher / openWin 探测 / 1s 内旧 close 忽略");
  else bad("v2.4.13：窗口健壮性缺失");
}

/* ---- v2.4.13 窗口 resize ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const win = fs.readFileSync(path.join(ROOT, "assets", "window.js"), "utf8");
  if (bg.indexOf("CH_WIN_RESIZE") >= 0 && win.indexOf("CH_WIN_RESIZE") >= 0 &&
    win.indexOf("win-resize") >= 0 && bg.indexOf("win resize name=") >= 0)
    ok("v2.4.13：CH_WIN_RESIZE 两端一致 + .win-resize 手柄 + 日志");
  else bad("v2.4.13：resize 频道/手柄缺失");
}

/* ---- v2.4.13：审计修复 ---- */
{
  const bg = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");
  const win = fs.readFileSync(path.join(ROOT, "assets", "window.js"), "utf8");
  if (bg.indexOf("portal teleport denied") >= 0 && bg.indexOf("tokens.every") >= 0)
    ok("v2.4.13：传送仅 GM / 目标 token 创建者可执行");
  else bad("v2.4.13：传送授权缺失");
  if (bg.indexOf("function safeLocalSet") >= 0 && bg.indexOf("本机存储已满") >= 0 && win.indexOf("export function safeInit") >= 0)
    ok("v2.4.13：localStorage quota 提示 + safeInit 隔离");
  else bad("v2.4.13：quota/safeInit 缺失");
  if (bg.indexOf("document.hidden") >= 0) ok("v2.4.13：隐藏页面跳过 viewport 轮询"); else bad("v2.4.13：hidden 跳过缺失");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
  process.exit(fail ? 1 : 0);
}