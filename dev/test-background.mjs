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
const localChangeCbs = [];
const playerChangeCbs = [];
const viewportChangeCbs = [];
const broadcastCbs = {};
const lsStore = {};
/* 一张卡：让 refreshInfo 认为 token 绑定有效，才能把速览弹窗开起来。 */
const CARD = { id: "c-1", name: "示例勇者", level: 1, char: {} };
let selection = [];
/* v1.5.0：房间数据要能「写进去再读出来」，骰子落库的合并 / 去重 / 封顶断言全靠它。 */
const roomMeta = { "com.4enext-owlbear/cards": { v: 1, cards: [CARD] } };
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
      /* v1.6.0：右键菜单会写 token metadata（hp-bar/enabled / hp.boss），必须真的落盘再读回来。 */
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
  modal: { open(cfg) { record("modal.open", cfg); return Promise.resolve(); }, close() {} },
  action: { open: async () => { record("action.open", true); } },
  room: {
    id: "room-1",
    getMetadata: async () => roomMeta,
    setMetadata(update) {
      record("room.setMetadata", update);
      for (const k of Object.keys(update || {})) roomMeta[k] = JSON.parse(JSON.stringify(update[k]));
      return Promise.resolve();
    },
    onMetadataChange(fn) { record("room.onMetadataChange", true); return noopUnsub(); }
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
const run = new Function("OBR", "buildCurve", "buildShape", "buildText", CORE + "\nreturn { boot: typeof boot === 'function' ? boot : null };");
run(OBR, stubBuilder("CURVE"), stubBuilder("SHAPE"), stubBuilder("TEXT"));

(async () => {
  if (typeof readyCb !== "function") { bad("没有注册 OBR.onReady"); return finish(); }
  ok("注册了 OBR.onReady");
  await readyCb();
  await sleep(240);

  /* v1.3.1：工具栏上三个并列入口（角色卡 / 先攻 / 骰子），各开各的窗口 */
  const tools = all("tool.create").map((c) => c[1]);
  const toolById = (re) => tools.filter((t) => re.test(t.id))[0] || null;
  const toolPanel = toolById(/\/panel-tool$/);
  const toolInit = toolById(/\/initiative-tool$/);
  const toolDice = toolById(/\/dice-tool$/);
  if (!tools.length) bad("没有调用 OBR.tool.create（工具栏入口）");
  else if (!toolPanel || !toolInit || !toolDice) bad("工具栏入口不齐：panel=" + !!toolPanel + " initiative=" + !!toolInit + " dice=" + !!toolDice);
  else if (!/^https:\/\/.+icon-tool(-initiative)?\.svg$/.test(toolPanel.icons[0].icon) ||
    !/^https:\/\/.+icon-tool-initiative\.svg$/.test(toolInit.icons[0].icon) ||
    !/^https:\/\/.+icon-tool-dice\.svg$/.test(toolDice.icons[0].icon)) bad("tool.create 的图标不是绝对地址 / 不是各自的小徽标");
  else ok("OBR.tool.create ×3（角色卡 / 先攻 / 骰子 三个并列入口）已注册");

  /* v1.3.2：工具栏补齐成一排（速览 / 角色卡 / 先攻 / 骰子 / 设置） */
  const toolGlance = toolById(/\/glance-tool$/);
  const toolSettings = toolById(/\/settings-tool$/);
  if (!toolGlance || !toolSettings) bad("工具栏没有补齐「速览 / 设置」入口：glance=" + !!toolGlance + " settings=" + !!toolSettings);
  else if (!/^https:\/\/.+icon-tool-glance\.svg$/.test(toolGlance.icons[0].icon) ||
    !/^https:\/\/.+icon-tool-settings\.svg$/.test(toolSettings.icons[0].icon)) bad("速览 / 设置的图标不是各自的绝对地址");
  else if (tools.length !== 5) bad("工具栏入口不是五个，而是 " + tools.length + " 个");
  else ok("OBR.tool.create ×5（速览 / 角色卡 / 先攻 / 骰子 / 设置 一排入口）已注册");

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
  else if (!/\/button\.html$/.test(pop.url)) bad("浮动按钮的 url 不对：" + pop.url);
  else if (pop.hidePaper !== true) bad("浮动按钮没有 hidePaper");
  else ok("OBR.popover.open 的锚点参数与参考实现一致");

  const notes = calls.filter((c) => c[0] === "notification.show").map((c) => c[1]);
  if (!notes.some((n) => /已加载/.test(n.msg))) bad("没有发「已加载」自诊断通知");
  else ok("发了汇总自诊断通知：" + notes.map((n) => n.variant + " " + n.msg).join(" | "));

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

  const added = all("local.addItems").map((c) => c[1]).flat();
  if (!added.length) bad("没有给带血量的 token 画血条（scene.local.addItems 没被调用）");
  else {
    const bg = added.find((it) => it.metadata["com.4enext-owlbear/bar"] && it.metadata["com.4enext-owlbear/bar"].role === "bar-bg");
    const fill = added.find((it) => it.metadata["com.4enext-owlbear/bar"] && it.metadata["com.4enext-owlbear/bar"].role === "bar-fill");
    const text = added.find((it) => it.metadata["com.4enext-owlbear/bar"] && it.metadata["com.4enext-owlbear/bar"].role === "bar-text");
    if (!bg || !fill || !text) bad("血条三件套不齐：bar-bg=" + !!bg + " bar-fill=" + !!fill + " bar-text=" + !!text);
    else if (bg.attachedTo !== TOKEN_ID) bad("血条没有 attachedTo 到 token：" + bg.attachedTo);
    else if (bg.layer !== "ATTACHMENT") bad("血条不在 ATTACHMENT 层：" + bg.layer);
    else if (!Array.isArray(bg.disableAttachmentBehavior) || bg.disableAttachmentBehavior.indexOf("SCALE") < 0) bad("血条没有禁用 SCALE 继承（token 缩放会画错）");
    else if (!(text.text && text.text.plainText === "12/20")) bad("血条数字不对：" + JSON.stringify(text.text));
    else if (!(bg.zIndex < fill.zIndex && fill.zIndex < text.zIndex)) bad("血条 zIndex 顺序不对：" + bg.zIndex + "/" + fill.zIndex + "/" + text.zIndex);
    else ok("血条三件套已画在 token 上（12/20，ATTACHMENT + 禁用 SCALE 继承）");
  }

  // 血量变了 → 走 updateItems 刷新（不是重建）
  token.metadata[HP_KEY] = { cur: 5, max: 20, temp: 3, updatedAt: 2 };
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(240);
  const patched = all("local.updateItems").map((c) => c[1]).flat();
  const patchedText = patched.find((it) => it.metadata["com.4enext-owlbear/bar"] && it.metadata["com.4enext-owlbear/bar"].role === "bar-text");
  if (!patched.length) bad("血量变化后没有刷新血条（scene.local.updateItems 没被调用）");
  else if (!patchedText || patchedText.text.plainText !== "5/20 +3") bad("刷新后的血条数字不对：" + JSON.stringify(patchedText && patchedText.text));
  else ok("血量变化后血条就地刷新：" + patchedText.text.plainText);

  // 血条被外部删掉 → 自愈重建
  const before = all("local.addItems").length;
  localItems = [];
  for (const cb of localChangeCbs) cb([]);
  await sleep(300);
  if (all("local.addItems").length <= before) bad("血条 item 被删掉后没有自动重建");
  else ok("血条 item 被外部删掉后自动重建");

  // 血条数据没了（解绑 / 手删）→ 清掉本地图形
  delete token.metadata[HP_KEY];
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(240);
  if (!all("local.deleteItems").length) bad("血量数据被删掉后没有清理本地血条 item");
  else ok("血量数据被删掉后清理了本地血条 item");

  /* =======================================================================
   * v1.6.0：血条扩展（临时生命 / 四防 / 蓝色回复力条）+ Boss 样式（方案 A）
   * ===================================================================== */
  const BAR_KEY = "com.4enext-owlbear/bar";
  const HPBAR_KEY = "com.4enext-owlbear/hp-bar/enabled";
  const TOKEN2 = "tok-2";
  const token2 = {
    id: TOKEN2,
    type: "IMAGE",
    name: "Boss 巨魔",
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
  const liveOf = (id) => localItems.filter((it) => it.attachedTo === id);
  const t2role = (role) => liveOf(TOKEN2).filter((it) => barRoleOf(it) === role);
  const t2one = (role) => t2role(role)[0] || null;

  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  let t2 = liveOf(TOKEN2);
  if (t2.length !== 14) {
    bad("带四防 + 回复力的 token 应画 14 件，实际 " + t2.length + "（" + t2.map(barRoleOf).join(",") + "）");
  } else if (t2role("shield").length !== 4 || t2role("shield-text").length !== 4) {
    bad("四防盾不是 4 盾 + 4 数字：" + t2.map(barRoleOf).join(","));
  } else if (t2.some((it) => it.layer !== "ATTACHMENT" || it.attachedTo !== TOKEN2)) {
    bad("血条不在 ATTACHMENT 层 / 没 attachedTo");
  } else if (t2.some((it) => !Array.isArray(it.disableAttachmentBehavior) || it.disableAttachmentBehavior.indexOf("SCALE") < 0)) {
    bad("血条没有禁用 SCALE 继承");
  } else if (!t2.some((it) => barRoleOf(it) === "surge-bg") || !t2.some((it) => barRoleOf(it) === "surge-fill")) {
    bad("蓝色回复力条不齐");
  } else {
    ok("带四防 + 回复力：14 件（HP 3 + 蓝条 3 + 四防 4 盾 + 4 数字），全 ATTACHMENT + 禁用 SCALE");
  }

  const hpTextItem = t2one("bar-text");
  const surgeTextItem = t2one("surge-text");
  if (!hpTextItem || !hpTextItem.text || hpTextItem.text.plainText !== "12/20 +3") {
    bad("HP 文本不对（应含临时生命 +3）：" + JSON.stringify(hpTextItem && hpTextItem.text));
  } else if (!surgeTextItem || !surgeTextItem.text || surgeTextItem.text.plainText !== "5/6") {
    bad("回复力文本不对（应为 5/6）：" + JSON.stringify(surgeTextItem && surgeTextItem.text));
  } else {
    ok("文本：HP「12/20 +3」（临时生命在右侧）+ 回复力「5/6」");
  }
  /* ---- v1.6.1：四防从「四角」改「一排」（强韧 / 反射 / 意志 从左到右 + AC 最右半透明白）
   *      v1.7.5：三防改成**圆**；v1.7.6：四枚**统一直径 30**、整排**铺满 token 并均分** ----
   *      token2 的包围盒是 150×150、dpi 150 → s=1：可用宽 = 150 − 2×4 = 142，四枚 4×30 = 120，
   *      均分间距 = (142 − 120) / 3 ≈ 7.33 → 第一枚左缘 = 4（= token 左缘 + 4s）、最后一枚右缘 = 146。 ---- */
  const shieldKeyOf = (it) => (it.metadata && it.metadata[BAR_KEY] ? it.metadata[BAR_KEY].key : "");
  const shieldByKey = (key) => t2role("shield").filter((it) => shieldKeyOf(it) === key)[0] || null;
  /* 一枚四防的外接盒高度 = 折线里最大的 y（圆和盾都从 0 画到直径 D）→ 圆心 / 盾心 y = position.y + D/2。
   * v1.7.5 起两枚直径不同（22 / 30），「同一行」必须比**中心**，不能直接比 position.y。 */
  const shapeH = (it) => Math.max.apply(null, (it.points || [{ y: 0 }]).map((pt) => pt.y));
  const centerYOf = (it) => it.position.y + shapeH(it) / 2;
  const shieldTextByKey = (key, list) => list.filter((it) => shieldKeyOf(it) === key)[0] || null;
  {
    const shields = t2role("shield");
    const ordered = shields.slice().sort((a, b) => a.position.x - b.position.x);
    const keys = ordered.map(shieldKeyOf).join(",");
    const ys = ordered.map(centerYOf);
    const sameY = ys.every((y) => Math.abs(y - ys[0]) < 0.01);
    const incX = ordered.every((it, i) => i === 0 || it.position.x > ordered[i - 1].position.x);
    const ac = shieldByKey("ac");
    const COLORS_3 = { fort: "#e3b341", reflex: "#56d364", will: "#a371f7" };
    const CIRCLE_SEG = 24;
    /* 圆：外接盒 30、24 段折线、每个点都在半径 15 上（到中心 (15,15) 的距离） */
    const circleOk = (it) => {
      if (!it || Math.abs(shapeH(it) - 30) > 0.01) return false;
      if (!Array.isArray(it.points) || it.points.length !== CIRCLE_SEG) return false;
      const r = shapeH(it) / 2;
      return it.points.every((pt) => Math.abs(Math.hypot(pt.x - r, pt.y - r) - r) < 0.01);
    };
    /* 盾：外接盒 30、点数远多于圆、底部中间有盾尖 (W/2, H) */
    const shieldShapeOk = (it) => {
      if (!it || Math.abs(shapeH(it) - 30) > 0.01) return false;
      if (!Array.isArray(it.points) || it.points.length <= CIRCLE_SEG) return false;
      return it.points.some((pt) => Math.abs(pt.x - 15) < 0.01 && Math.abs(pt.y - 30) < 0.01);
    };
    const acText = shieldTextByKey("ac", t2role("shield-text"));
    const fortText = shieldTextByKey("fort", t2role("shield-text"));
    if (shields.length !== 4) bad("四防盾不是 4 枚：" + shields.length + "（" + shields.map(shieldKeyOf).join(",") + "）");
    else if (keys !== "fort,reflex,will,ac") bad("四防顺序不对（应 强韧→反射→意志→AC，AC 最右）：" + keys);
    else if (!sameY) bad("四防不在同一行（圆心 / 盾心 y 不一致）：" + ys.map((y) => Math.round(y * 100) / 100).join("/"));
    else if (!incX) bad("四防的 x 不是从左到右递增：" + ordered.map((it) => Math.round(it.position.x * 100) / 100).join("/"));
    else if (!ac) bad("AC 那枚盾没画出来");
    else if (["fort", "reflex", "will"].some((k) => !circleOk(shieldByKey(k)))) {
      bad("三防不是直径 30 的圆（24 段折线、点在半径 15 上）：" +
        ["fort", "reflex", "will"].map((k) => k + "=" + (shieldByKey(k) ? shieldKeyOf(shieldByKey(k)) + "/d" + shapeH(shieldByKey(k)) + "/" + (shieldByKey(k).points || []).length + "点" : "无")).join(" "));
    } else if (!shieldShapeOk(ac)) {
      bad("AC 不是直径 30 的盾形（外接盒 " + shapeH(ac) + "、" + (ac.points || []).length + " 点）");
    } else if (ac.fillColor !== "#ffffff" || !(ac.fillOpacity > 0 && ac.fillOpacity <= 0.3) ||
      ac.strokeColor !== "#ffffff" || !(ac.strokeOpacity >= 0.8)) {
      bad("AC 不是半透明白色图标：fill=" + ac.fillColor + "@" + ac.fillOpacity + " stroke=" + ac.strokeColor + "@" + ac.strokeOpacity);
    } else if (Object.keys(COLORS_3).some((k) => !shieldByKey(k) || shieldByKey(k).fillColor !== COLORS_3[k])) {
      bad("三防不是橙 / 绿 / 紫：" + Object.keys(COLORS_3).map((k) => k + "=" + (shieldByKey(k) ? shieldByKey(k).fillColor : "无")).join(" "));
    } else if (!acText || !acText.text || acText.text.plainText !== "28") {
      bad("AC 的数字不是 28：" + JSON.stringify(acText && acText.text));
    } else if (!acText.text.style || Math.abs(acText.text.style.fontSize - 15) > 0.01) {
      bad("AC 的字号不是 15（d×0.5，d=30）：" + JSON.stringify(acText.text && acText.text.style));
    } else if (!fortText || !fortText.text || !fortText.text.style || Math.abs(fortText.text.style.fontSize - 15) > 0.01) {
      bad("圆的字号没有放大到 ≈15s：" + JSON.stringify(fortText && fortText.text && fortText.text.style));
    } else {
      /* v1.7.6：整排**铺满 token 并均分** —— 左缘 = token 左缘 + 4s、右缘 = token 右缘 − 4s、间距相等。 */
      const leftEdge = ordered[0].position.x;
      const lastIt = ordered[ordered.length - 1];
      const rightEdge = lastIt.position.x + shapeH(lastIt);
      const gaps = ordered.slice(1).map((it, i) => it.position.x - (ordered[i].position.x + shapeH(ordered[i])));
      const evenGaps = gaps.every((g) => Math.abs(g - gaps[0]) < 0.01);
      if (Math.abs(leftEdge - 4) > 0.01) bad("整排没有左对齐到 token 左缘 + 4s（左缘 " + leftEdge + "）");
      else if (Math.abs(rightEdge - 146) > 0.01) bad("整排没有右对齐到 token 右缘 − 4s（右缘 " + rightEdge + "）");
      else if (!evenGaps) bad("四防之间的间距不均分：" + gaps.map((g) => Math.round(g * 100) / 100).join("/"));
      else {
        ok("四防一排（v1.7.6）：3 个圆（直径 30、24 段）+ 1 个盾（AC，直径 30）；字号都是 15（四枚一样大）；" +
          "圆心 / 盾心同一 y=" + (Math.round(ys[0] * 100) / 100) + "、**左缘 4 / 右缘 146 铺满 token**、" +
          "均分间距 " + (Math.round(gaps[0] * 100) / 100) + "、AC 最右且半透明白色（fill #ffffff@" +
          ac.fillOpacity + " + 白描边@" + ac.strokeOpacity + "）");
      }
    }
  }
  /* 这一排必须在 HP 红条上方（同一份几何：盾的下缘 < 条的上缘） */
  {
    const shields = t2role("shield");
    const barBg = t2one("bar-bg");
    /* 盾的下缘 = 位置 + 多边形里最大的 y（盾尖）；条的上缘 = 位置 y */
    const bottomOf = (it) => it.position.y +
      Math.max.apply(null, (it.points || [{ y: 0 }]).map((pt) => pt.y));
    const lowest = shields.length ? Math.max.apply(null, shields.map(bottomOf)) : 0;
    if (!shields.length || !barBg) bad("四防 / HP 条缺件，无法比较上下关系");
    else if (!(lowest <= barBg.position.y + 0.5)) bad("四防这一排没有在 HP 红条上方：" + lowest + " vs " + barBg.position.y);
    else ok("四防这一排贴在 HP 红条上方（盾下缘 " + lowest + " ≤ 条上缘 " + barBg.position.y + "）");
  }
  if (t2one("shield").zIndex < t2one("bar-fill").zIndex && t2one("bar-fill").zIndex < t2one("bar-text").zIndex) {
    ok("zIndex：盾 " + t2one("shield").zIndex + " < 填充 " + t2one("bar-fill").zIndex + " < 数值 " + t2one("bar-text").zIndex);
  } else bad("zIndex 顺序不对");

  /* ---- Boss：布尔 / 对象都能读；环形 + 名牌 + 锁；压制普通 HP 条 ---- */
  token2.metadata[HP_KEY].boss = true;
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  t2 = liveOf(TOKEN2);
  if (t2.length !== 20) bad("Boss 模式应再加 2 环 + 2 牌 + 2 锁（共 20 件），实际 " + t2.length + "：" + t2.map(barRoleOf).join(","));
  else if (!t2one("ring-bg") || !t2one("ring-fill")) bad("Boss 环形血条没画");
  else if (!t2one("plate") || !t2one("plate-text") || t2one("plate-text").text.plainText !== "Boss 巨魔") bad("Boss 名牌 / 名字不对");
  else if (!t2one("lock-body") || !t2one("lock-shackle")) bad("Boss 锁图标不齐");
  else if (t2one("bar-bg").visible !== false || t2one("bar-fill").visible !== false || t2one("bar-text").visible !== false) {
    bad("Boss 模式没有压制普通 HP 条");
  } else if (t2one("surge-bg").visible !== true) bad("Boss 模式把回复力条也压掉了（应保留）");
  else ok("Boss 模式（boss:true）：环形血条 + 名牌「Boss 巨魔」+ 锁，普通 HP 条被压制、蓝条保留");

  /* v1.6.1：Boss 环形态下四防也要是一排（同 y、AC 最右）；v1.7.5：3 圆 + 1 盾 */
  {
    const shields = t2role("shield");
    const ys = shields.map(centerYOf);
    const keys = shields.slice().sort((a, b) => a.position.x - b.position.x).map(shieldKeyOf).join(",");
    const ds = shields.map((it) => Math.round(shapeH(it) * 100) / 100).sort((a, b) => a - b);
    if (shields.length !== 4) bad("Boss 形态四防不齐：" + shields.length + "（" + keys + "）");
    else if (!ys.every((y) => Math.abs(y - ys[0]) < 0.01)) bad("Boss 形态四防不在同一行：" + ys.join("/"));
    else if (keys !== "fort,reflex,will,ac") bad("Boss 形态四防顺序不对：" + keys);
    else if (ds.join(",") !== "30,30,30,30") bad("Boss 形态四防的直径不对（应 30/30/30/30）：" + ds.join(","));
    else ok("Boss 环形态下四防仍是一排（4 枚、圆心 / 盾心同一 y=" + (Math.round(ys[0] * 100) / 100) +
      "、四枚都 30、AC 最右）");
  }

  token2.metadata[HP_KEY].boss = { enabled: true, segments: 3, phase: "阶段二" };
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  t2 = liveOf(TOKEN2);
  if (t2role("divider").length !== 2) bad("segments=3 应有 2 条分段线，实际 " + t2role("divider").length);
  else if (!t2one("plate-phase") || t2one("plate-phase").text.plainText !== "阶段二") bad("Boss 阶段文案没显示");
  else ok("Boss 分段（3 段 → 2 条线）+ 阶段文案「阶段二」");

  /* ---- v1.6.1：窄 token 退化——四枚放不下时优先保留 AC（最右那枚）
   *      v1.7.6：判据 = 「枚数 × 30s ≤ 可用宽（token 宽 − 8s）」；退化**顺序**没变
   *      （先丢意志 → 反射 → 强韧，AC 最后才丢），只是阈值按 30s 重算。 ---- */
  {
    const TOKEN3 = "tok-3";
    const token3 = {
      id: TOKEN3,
      type: "IMAGE",
      name: "窄 token",
      layer: "CHARACTER",
      createdUserId: "user-owner",
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      metadata: {
        [HP_KEY]: {
          cur: 9, max: 10, surges: 2, surgesMax: 3,
          defenses: { ac: 21, fort: 15, reflex: 17, will: 19 },
          locked: true, updatedAt: 4
        }
      }
    };
    sceneItems.push(token3);
    const t3keysNow = () => liveOf(TOKEN3).filter((it) => barRoleOf(it) === "shield").map(shieldKeyOf).join(",");

    /* ① 20×20：s 夹到 0.2 → 四枚要 4×6 = 24，可用只有 18.4
     *    → 按 DEF_DROP **先丢意志**（只丢一枚就够：18 ≤ 18.4）→ 剩「强韧 + 反射 + AC」 */
    boundsFor[TOKEN3] = { min: { x: 0, y: 0 }, max: { x: 20, y: 20 }, center: { x: 10, y: 10 }, width: 20, height: 20 };
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(340);
    if (t3keysNow() !== "fort,reflex,ac") bad("窄 token 退化顺序不对（应先丢意志，剩 fort,reflex,ac）：" + t3keysNow());
    else ok("窄 token 退化（20×20，s=0.2）：按 DEF_DROP 先丢意志 → 剩「强韧 + 反射 + AC」");

    /* ② 13×40：只放得下一枚 → AC 优先保留（最后才丢），数字跟着在 */
    boundsFor[TOKEN3] = { min: { x: 0, y: 0 }, max: { x: 13, y: 40 }, center: { x: 6.5, y: 20 }, width: 13, height: 40 };
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(340);
    const t3keys = t3keysNow();
    if (t3keys !== "ac") bad("窄 token 退化到 1 枚时应只剩 AC，实际：" + t3keys);
    else if (liveOf(TOKEN3).filter((it) => barRoleOf(it) === "shield-text").length !== 1) bad("窄 token 退化后 AC 的数字也没了");
    else ok("窄 token 退化（13×40）：只放得下 1 枚时 AC 优先保留（半透明白），数字仍在");
    /* 收尾：把这枚临时 token 移出场景（后面的断言只看 tok-2） */
    sceneItems = sceneItems.filter((it) => it.id !== TOKEN3);
    delete boundsFor[TOKEN3];
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(340);
  }

  /* ---- 锁：只改颜色，不重建 ---- */
  token2.metadata[HP_KEY].locked = false;
  const addsBeforeLock = all("local.addItems").length;
  const updatesBeforeLock = all("local.updateItems").length;
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  const lockDrafts = all("local.updateItems").slice(updatesBeforeLock).map((c) => c[1]).flat();
  const lockPatched = lockDrafts.filter((it) => barRoleOf(it) === "lock-body").pop();
  const shieldTextDrafts = lockDrafts.filter((it) => barRoleOf(it) === "shield-text");
  if (all("local.addItems").length !== addsBeforeLock) bad("切「解锁」不应该重建 item");
  else if (!shieldTextDrafts.length || shieldTextDrafts.some((it) => it.visible !== true)) {
    bad("增量刷新把四防数字误隐藏了（shield-text 的 tag 没带 key）");
  } else if (!lockPatched || lockPatched.fillColor !== "#93a1b0") bad("解锁后锁的颜色没变（应 #93a1b0）：" + (lockPatched && lockPatched.fillColor));
  else ok("解锁只改锁的颜色（#f85149 → #93a1b0）、四防数字仍显示，不重建 item");

  /* ---- 玩家端：其他玩家 + locked → 阶梯比例、不画数字与四防 ---- */
  token2.metadata[HP_KEY].locked = true;
  role = "PLAYER";
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  t2 = liveOf(TOKEN2);
  if (t2.some((it) => barRoleOf(it) === "shield")) {
    bad("玩家端仍画了四防盾（locked 时应隐藏）");
  } else if (!t2one("bar-text") || t2one("bar-text").visible !== false || !t2one("surge-text") || t2one("surge-text").visible !== false) {
    bad("玩家端仍显示精确数字");
  } else {
    const fillP = t2one("bar-fill");
    const maxX = fillP ? Math.max.apply(null, fillP.points.map((pt) => pt.x)) : 0;
    if (Math.abs(maxX - 109.5) > 0.6) bad("玩家端比例没按 25% 阶梯向上取整（12/20 → 0.75，maxX=" + maxX + "）");
    else ok("玩家端（其他玩家 + locked）：0.6 → 0.75 阶梯比例，不画数字与四防（" + t2.length + " 件）");
  }
  role = "GM";

  /* ---- 显式关掉：hp-bar/enabled = false → 一件都不留 ---- */
  token2.metadata[HPBAR_KEY] = false;
  for (const cb of itemsChangeCbs) cb(sceneItems);
  await sleep(300);
  if (liveOf(TOKEN2).length) bad("hp-bar/enabled=false 后血条没有被移除：" + liveOf(TOKEN2).length + " 件");
  else ok("hp-bar/enabled=false → 本地血条被移除（一件不留）");

  /* ---- 右键 4 项：独立 id / filter 用 != / 关闭写 false ---- */
  const menusV16 = all("contextMenu.create").map((c) => c[1]);
  const menuById = (id) => menusV16.filter((m) => m.id === id)[0] || null;
  const addMenu = menuById("com.4enext-owlbear/hpbar-add");
  const removeMenu = menuById("com.4enext-owlbear/hpbar-remove");
  const bossShowMenu = menuById("com.4enext-owlbear/boss-show");
  const bossHideMenu = menuById("com.4enext-owlbear/boss-hide");
  if (!addMenu || !removeMenu || !bossShowMenu || !bossHideMenu) {
    bad("右键菜单没补齐 4 项：add=" + !!addMenu + " remove=" + !!removeMenu + " show=" + !!bossShowMenu + " hide=" + !!bossHideMenu);
  } else if (!addMenu.icons[0].filter.some || addMenu.icons[0].filter.some[0].operator !== "!=" ||
    !removeMenu.icons[0].filter.some || removeMenu.icons[0].filter.some[0].value !== true) {
    bad("血条菜单的 filter 不对（添加要 != true、移除要 == true）");
  } else if (menusV16.length !== 8) {
    bad("右键菜单总数不是 8（绑定 + 加入 / 隐形加入 + v1.7.3 移出先攻 + 4 项血条 / Boss）：" + menusV16.length);
  } else {
    ok("右键 4 项独立注册：添加 / 移除血条组件、显示为 Boss / 隐藏 Boss（filter 用 !=；v1.7.3 只多了「移出先攻」一项）");
  }

  if (addMenu) {
    const addsBefore = all("local.addItems").length;
    await addMenu.onClick({ items: [token2] });
    await sleep(200);
    if (token2.metadata[HPBAR_KEY] !== true) bad("「添加血条组件」没有写 hp-bar/enabled = true");
    else if (all("local.addItems").length <= addsBefore) bad("「添加血条组件」后没有重画血条");
    else ok("「添加血条组件」→ hp-bar/enabled = true 且立刻重画");
  }
  if (removeMenu) {
    await removeMenu.onClick({ items: [token2] });
    await sleep(200);
    if (token2.metadata[HPBAR_KEY] !== false) bad("「移除血条组件」没有写 false（delete 会让血条下次自动回来）");
    else ok("「移除血条组件」→ hp-bar/enabled = false（写 false，不 delete）");
  }
  if (bossShowMenu) {
    const noteCount = all("notification.show").length;
    await bossShowMenu.onClick({ items: [token] });
    await sleep(60);
    const warn = all("notification.show").slice(noteCount).map((c) => c[1])
      .filter((n) => n.variant === "WARNING" && /生命上限/.test(n.msg))[0];
    if (!warn) bad("没有血量的 token 点「显示为 Boss」没有 WARNING");
    else ok("没有血量的 token 点「显示为 Boss」→ WARNING（不写坏数据）");

    await bossShowMenu.onClick({ items: [token2] });
    await sleep(120);
    const bossNow = token2.metadata[HP_KEY] && token2.metadata[HP_KEY].boss;
    if (!bossNow || bossNow.enabled !== true || !(bossNow.order > 0)) {
      bad("「显示为 Boss」没有写 boss.enabled + order：" + JSON.stringify(bossNow));
    } else ok("「显示为 Boss」→ hp.boss = { enabled:true, order:" + bossNow.order + " }");
  }
  if (bossHideMenu) {
    await bossHideMenu.onClick({ items: [token2] });
    await sleep(120);
    const bossOff = token2.metadata[HP_KEY] && token2.metadata[HP_KEY].boss;
    if (!bossOff || bossOff.enabled !== false) bad("「隐藏 Boss 血条」没有把 enabled 写 false");
    else ok("「隐藏 Boss 血条」→ boss.enabled = false（数据保留，不再画环 / 牌 / 锁）");
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
  else if (!/\/info\.html\?item=tok-1&card=c-1$/.test(info.url)) bad("速览弹窗 url 不对：" + info.url);
  else ok("速览弹窗按左上角定位（初始 16,16，url 带 item/card）");

  const infoUrl = info ? info.url : "";
  const infoSize = info ? { w: info.width, h: info.height } : { w: 660, h: 700 };

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

    // 拖出视口 → 夹在边界内（1200 - 660 - 16 = 524，800 - 700 - 16 = 84）
    dragCb({ phase: "move", dx: 5000, dy: 5000 });
    dragCb({ phase: "end", dx: 5000, dy: 5000 });
    await sleep(90);
    moved = lastInfoOpen();
    if (!moved || moved.anchorPosition.left !== 524 || moved.anchorPosition.top !== 84)
      bad("拖动超出视口时没有夹到 (524,84)：" + JSON.stringify(moved && moved.anchorPosition));
    else ok("拖出视口时夹在边界内 → (524,84)");

    const saved = JSON.parse(lsStore[POS_KEY] || "{}");
    const one = saved && saved.pos ? saved.pos[TOKEN_ID] : null;
    if (!one || one.left !== 524 || one.top !== 84) bad("拖动结束后没有记住位置：" + JSON.stringify(saved));
    else ok("拖动结束后位置写进 localStorage（按 token id）");

    // 关掉再选中同一枚 token → 回到上次拖到的位置
    selection = [];
    for (const cb of playerChangeCbs) cb();
    await sleep(200);
    selection = [TOKEN_ID];
    for (const cb of playerChangeCbs) cb();
    await sleep(280);
    moved = lastInfoOpen();
    if (!moved || moved.anchorPosition.left !== 524 || moved.anchorPosition.top !== 84)
      bad("重新选中同一枚 token 时没有回到记住的位置：" + JSON.stringify(moved && moved.anchorPosition));
    else ok("重新选中同一枚 token → 回到上次位置 (524,84)");

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

  /* v1.4.0：工具栏「先攻」打开的是**先攻条**（top-center 的条），不是 880×640 的大窗口 */
  const stripCfg = await openByTool(toolInit, /\/initiative\.html$/, "先攻条");
  const diceWin = await openByTool(toolDice, /\/dice\.html$/, "骰子");
  const panelWin = await openByTool(toolPanel, /\/panel\.html$/, "角色卡");

  if (!stripCfg || !diceWin || !panelWin) {
    bad("三个工具栏入口没有各自打开窗口");
  } else if (stripCfg.id !== "com.4enext-owlbear/initiative-strip") {
    bad("先攻条的 popover id 不对：" + stripCfg.id);
  } else if (openedIds.size !== 3) {
    bad("三个窗口的 popover id 有重复（不能同时打开）：" + [...openedIds].join(" / "));
  } else {
    ok("先攻条 + 骰子 + 角色卡各自独立打开，id 互不相同（可同时开）：" +
      [stripCfg.id, diceWin.id, panelWin.id].map((x) => x.split("/").pop()).join(" / "));
  }

  if (stripCfg) {
    const vw = 1200;
    if (stripCfg.anchorReference !== "POSITION") bad("先攻条没有用 anchorReference: POSITION");
    else if (stripCfg.anchorOrigin.horizontal !== "CENTER" || stripCfg.anchorOrigin.vertical !== "TOP" ||
      stripCfg.transformOrigin.horizontal !== "CENTER" || stripCfg.transformOrigin.vertical !== "TOP")
      bad("先攻条的锚点 / 变换原点不是 CENTER/TOP：" + JSON.stringify([stripCfg.anchorOrigin, stripCfg.transformOrigin]));
    else if (stripCfg.width !== 720 || stripCfg.height !== 129)
      bad("先攻条展开尺寸不是 720×129：" + stripCfg.width + "×" + stripCfg.height);
    else if (stripCfg.anchorPosition.top !== 45 || stripCfg.anchorPosition.left !== vw / 2)
      bad("先攻条没有贴顶居中（top 45 / 中线 " + (vw / 2) + "）：" + JSON.stringify(stripCfg.anchorPosition));
    else if (stripCfg.disableClickAway !== true || stripCfg.hidePaper !== true)
      bad("先攻条没有 disableClickAway / hidePaper");
    else ok("先攻条：720×129 @ top 45，CENTER/TOP，disableClickAway + hidePaper");
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

  /* =======================================================================
   * v1.3.2：设置窗口自己一个 popover；速览入口给当前选中的 token 重开 /info
   * ===================================================================== */
  const settingsWin = await openByTool(toolSettings, /\/settings\.html$/, "设置");
  if (!settingsWin) bad("点工具栏「设置」没有打开设置窗口");
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

  /* 当前选中的 tok-1 绑定着 c-1 → 点「速览」应该重新开 /info（与「选中即弹」同一个 popover） */
  selection = [TOKEN_ID];
  const glanceWin = await openByTool(toolGlance, /\/info\.html\?item=tok-1&card=c-1$/, "速览");
  if (!glanceWin) bad("点工具栏「速览」没有打开当前选中 token 的速览");
  else ok("点工具栏「速览」打开 /info（复用「选中即弹」同一个 popover，url 带 item/card）");

  /* v1.4.0：先攻条的拖动（CH_STRIP_DRAG，只发位移；后台按中线偏移换算 + 夹紧 + 落盘） */
  const STRIP_CH = "com.4enext-owlbear/strip-drag";
  const STRIP_POS = "4enext/strip-pos";
  const stripDragCb = (broadcastCbs[STRIP_CH] || [])[0];
  if (!stripDragCb) bad("没有订阅先攻条拖动频道 " + STRIP_CH);
  else ok("订阅了先攻条拖动频道 " + STRIP_CH);
  if (stripDragCb && stripCfg) {
    const base = stripCfg.anchorPosition;
    stripDragCb({ phase: "start", dx: 0, dy: 0 });
    stripDragCb({ phase: "move", dx: 100, dy: 50 });
    await sleep(90);
    let movedStrip = opened(/\/initiative\.html$/);
    if (!movedStrip || movedStrip.anchorPosition.left !== base.left + 100 || movedStrip.anchorPosition.top !== base.top + 50) {
      bad("拖动先攻条没有跟手：" + JSON.stringify(movedStrip && movedStrip.anchorPosition) + "（起点 " + JSON.stringify(base) + "）");
    } else if (movedStrip.width !== stripCfg.width || movedStrip.height !== stripCfg.height) {
      bad("拖动先攻条时尺寸变了：" + movedStrip.width + "×" + movedStrip.height);
    } else {
      ok("拖动先攻条 100/50 → 中线 " + movedStrip.anchorPosition.left + " / top " + movedStrip.anchorPosition.top + "（尺寸不变）");
    }

    stripDragCb({ phase: "move", dx: 5000, dy: 5000 });
    stripDragCb({ phase: "end", dx: 5000, dy: 5000 });
    await sleep(160);
    movedStrip = opened(/\/initiative\.html$/);
    const maxCx = 1200 - 16 - stripCfg.width / 2;
    const maxTop = 800 - stripCfg.height - 16;
    if (!movedStrip || movedStrip.anchorPosition.left !== maxCx || movedStrip.anchorPosition.top !== maxTop) {
      bad("先攻条拖出视口没有夹住（应为 " + maxCx + "," + maxTop + "）：" + JSON.stringify(movedStrip && movedStrip.anchorPosition));
    } else {
      ok("先攻条拖出视口 → 夹在 (" + maxCx + ", " + maxTop + ")");
    }
    let savedStrip = null;
    try { savedStrip = JSON.parse(lsStore[STRIP_POS] || "null"); } catch (e) { savedStrip = null; }
    if (!savedStrip || savedStrip.dx !== maxCx - 600 || savedStrip.dy !== maxTop - 45) {
      bad("先攻条位置没有按偏移落盘：" + JSON.stringify(savedStrip));
    } else {
      ok("先攻条位置只记相对中线的偏移（dx " + savedStrip.dx + " / dy " + savedStrip.dy + "）");
    }

    stripDragCb({ phase: "reset" });
    await sleep(140);
    movedStrip = opened(/\/initiative\.html$/);
    if (!movedStrip || movedStrip.anchorPosition.left !== base.left || movedStrip.anchorPosition.top !== base.top) {
      bad("先攻条没有回到顶部中间：" + JSON.stringify(movedStrip && movedStrip.anchorPosition));
    } else if (lsStore[STRIP_POS]) {
      bad("回中后没有清掉记住的偏移：" + lsStore[STRIP_POS]);
    } else {
      ok("先攻条「回到顶部中间」→ (" + base.left + ", " + base.top + ") 且清掉偏移");
    }
  }

  /* 先攻条「≡」→ 列表窗口（?view=list，880×640，仍可拖 / 记位置，id 与条不同） */
  const stripCmdCb = (broadcastCbs["com.4enext-owlbear/strip-cmd"] || [])[0];
  if (!stripCmdCb) bad("没有订阅先攻条命令频道（列表 / 尺寸）");
  else ok("订阅了先攻条命令频道（列表 / 尺寸）");
  let listWin = null;
  if (stripCmdCb) {
    stripCmdCb({ data: { op: "list" } });
    await sleep(180);
    listWin = opened(/\/initiative\.html\?view=list$/);
    if (!listWin || listWin.width !== 880 || listWin.height !== 640) {
      bad("先攻条「≡」没有打开列表窗口：" + JSON.stringify(listWin && [listWin.url, listWin.width, listWin.height]));
    } else if (listWin.id !== "com.4enext-owlbear/initiative-window") {
      bad("列表窗口的 popover id 不是 /initiative-window：" + listWin.id);
    } else {
      ok("先攻条「≡」打开列表窗口（?view=list，880×640，id 与先攻条不同）");
    }
  }

  /* 拖动列表窗口：起点 160,56（1200×800 居中偏上）→ 位移 100,50 → 夹取 → 落盘 → ⌖ 回默认 */
  if (winDragCb && listWin) {
    const base = listWin.anchorPosition;
    winDragCb({ win: "initiative", phase: "start", dx: 0, dy: 0 });
    winDragCb({ win: "initiative", phase: "move", dx: 100, dy: 50 });
    await sleep(90);
    let movedWin = opened(/\/initiative\.html\?view=list$/);
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
    movedWin = opened(/\/initiative\.html\?view=list$/);
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
    movedWin = opened(/\/initiative\.html\?view=list$/);
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
  const smallPanel = await openByTool(toolPanel, /\/panel\.html$/, "角色卡（小屏）");
  if (!smallPanel) bad("小屏下打不开角色卡窗口");
  else if (smallPanel.width > 800 - 32 || smallPanel.height > 600 - 32)
    bad("小屏（800×600）下窗口还是超出视口：" + smallPanel.width + "×" + smallPanel.height);
  else ok("小屏 800×600 下窗口夹到 " + smallPanel.width + "×" + smallPanel.height + "（≤ 视口 − 2×margin）");

  /* 视口变回来 → reclampWins 把开着的窗口放大回默认尺寸 */
  OBR.viewport.getWidth = async () => 1200;
  OBR.viewport.getHeight = async () => 800;
  if (!viewportChangeCbs.length) bad("没有订阅 viewport.onChange（视口变化后不会重新夹紧窗口）");
  else {
    for (const fn of viewportChangeCbs) fn();
    await sleep(420);
    const backPanel = opened(/\/panel\.html$/);
    if (!backPanel || backPanel.width !== 960) bad("视口变大后窗口没有重新夹紧/恢复：" + JSON.stringify(backPanel && [backPanel.width, backPanel.height]));
    else ok("视口变化后 reclampWins 重新夹紧窗口（" + backPanel.width + "×" + backPanel.height + "）");
  }

  /* ---------------------------------------------------------------------------
   * v1.5.0：骰子落库（只有城主客户端写房间数据 com.4enext-owlbear/rolls）
   * ------------------------------------------------------------------------- */
  const CH_ROLL = "com.4enext-owlbear/roll";
  const CH_ROLL_CLEAR = "com.4enext-owlbear/roll-clear";
  const CH_ROLL_SAVED = "com.4enext-owlbear/roll-saved";
  const KEY_ROLLS = "com.4enext-owlbear/rolls";
  const rollCbs = broadcastCbs[CH_ROLL] || [];
  const clearCbs = broadcastCbs[CH_ROLL_CLEAR] || [];
  if (!rollCbs.length || !clearCbs.length) bad("没有订阅骰子频道（CH_ROLL / CH_ROLL_CLEAR）");
  else ok("订阅了骰子频道（" + CH_ROLL + " / " + CH_ROLL_CLEAR + "）");

  const sendRoll = async (payload) => {
    for (const cb of rollCbs) await cb({ data: payload });
    await sleep(30);
  };

  if (rollCbs.length) {
    await sendRoll({ rollId: "r-1", ts: 1000, rollerId: "u1", rollerName: "甲", expression: "1d20 + 12", label: "攻击", mode: "attack", dice: [{ type: "d20", value: 14 }], modifier: 12, total: 26 });
    await sendRoll({ rollId: "r-1", ts: 1000, rollerName: "甲", dice: [{ type: "d20", value: 14 }], modifier: 12, total: 26 }); /* 重复：必须幂等 */
    await sendRoll({ rollId: "r-2", ts: 2000, rollerName: "乙", dice: [{ type: "d600", value: 601 }], modifier: 0, total: 601 });
    await sendRoll({ dice: [{ type: "d20", value: 5 }], total: 5 }); /* 没 rollId：丢弃 */
    const box = roomMeta[KEY_ROLLS];
    if (!box || !Array.isArray(box.rows)) bad("骰子没有写进房间数据：" + JSON.stringify(box));
    else if (box.rows.length !== 2) bad("骰子合并结果不是 2 条（去重 / 丢弃坏行）：" + JSON.stringify(box.rows.map((r) => r.rollId)));
    else if (box.rows[0].rollId !== "r-2" || box.rows[1].rollId !== "r-1") bad("骰子没有按 ts 倒序：" + box.rows.map((r) => r.rollId).join(","));
    else if (box.rows[0].dice[0].value !== 600) bad("d600 没有被夹到 600：" + box.rows[0].dice[0].value);
    else if (box.rows[1].total !== 26 || box.rows[1].modifier !== 12) bad("骰子 total 重算不对：" + box.rows[1].total);
    else ok("城主落库：幂等去重 + ts 倒序 + 数值夹取 + total 重算（2 条）");

    const savedMsgs = calls.filter((c) => c[0] === "broadcast.sendMessage" && c[1].channel === CH_ROLL_SAVED);
    if (!savedMsgs.length) bad("落库后没有广播 CH_ROLL_SAVED");
    else ok("落库后广播 CH_ROLL_SAVED（" + savedMsgs.length + " 次）");

    /* 40 条封顶 */
    for (let i = 0; i < 45; i++) {
      await sendRoll({ rollId: "cap-" + i, ts: 3000 + i, rollerName: "甲", dice: [{ type: "d20", value: 10 }], modifier: 0, total: 10 });
    }
    await sleep(200);
    const capped = roomMeta[KEY_ROLLS];
    if (!capped || capped.rows.length !== 40) bad("骰子历史没有封顶到 40：" + (capped && capped.rows.length));
    else if (capped.rows[0].rollId !== "cap-44") bad("封顶后最新的没有排最前：" + capped.rows[0].rollId);
    else ok("骰子历史封顶 40 条（最新在前）");

    /* 玩家客户端只广播、不写 */
    const beforePlayer = JSON.stringify(roomMeta[KEY_ROLLS]);
    role = "PLAYER";
    await sendRoll({ rollId: "player-1", ts: 9000, rollerName: "玩家", dice: [{ type: "d20", value: 3 }], modifier: 0, total: 3 });
    role = "GM";
    if (JSON.stringify(roomMeta[KEY_ROLLS]) !== beforePlayer) bad("玩家客户端也写了房间数据（不该）");
    else ok("玩家客户端只广播、不写房间数据");

    /* 城主清空 */
    for (const cb of clearCbs) await cb({ data: { by: "user-gm" } });
    await sleep(120);
    const cleared = roomMeta[KEY_ROLLS];
    if (!cleared || !Array.isArray(cleared.rows) || cleared.rows.length !== 0) bad("城主清空没有写空 rows：" + JSON.stringify(cleared && cleared.rows.length));
    else ok("城主清空 → rows = []（并再次广播 CH_ROLL_SAVED）");
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

  /* ---- 1) 语法：20 / 20/20 / +5 / -3 / 15+5 / 乱填保留原值 ---- */
  {
    const a = HPE.parseHpInput("20", { cur: null, max: null });
    const b = HPE.parseHpInput("20/20", { cur: null, max: null });
    const c = HPE.parseHpInput("+5", { cur: 12, max: 20 });
    const d = HPE.parseHpInput("-3", { cur: 12, max: 20 });
    const noMax = HPE.parseHpInput("+5", { cur: null, max: null });
    const calc = HPE.parseHpInput("15+5", { cur: null, max: null });
    const raise = HPE.parseHpInput("30", { cur: 12, max: 20 });
    const junk = HPE.parseHpInput("二十", { cur: 12, max: 20 });
    if (!a.ok || a.patch.max !== 20 || a.patch.cur !== 20) bad("「20」不是设上限 20（20/20）：" + JSON.stringify(a));
    else if (!b.ok || b.patch.cur !== 20 || b.patch.max !== 20) bad("「20/20」没有同时设当前/上限：" + JSON.stringify(b));
    else if (!c.ok || c.patch.cur !== 17) bad("「+5」没有在当前 12 上加到 17：" + JSON.stringify(c));
    else if (!d.ok || d.patch.cur !== 9) bad("「-3」没有在当前 12 上减到 9：" + JSON.stringify(d));
    else if (noMax.ok) bad("没有上限时「+5」应该拒绝（先给上限），实际：" + JSON.stringify(noMax));
    else if (!calc.ok || calc.patch.cur !== 20) bad("「15+5」算式结果不是 20：" + JSON.stringify(calc));
    else if (!raise.ok || raise.patch.max !== 30 || raise.patch.cur !== 12) bad("「30」应把上限改到 30、当前 12 保留：" + JSON.stringify(raise));
    else if (junk.ok) bad("看不懂的输入应该 ok:false（保留原值），实际：" + JSON.stringify(junk));
    else ok("HP 语法：20（上限）/ 20/20 / +5 / -3 / 15+5 都对；没上限时 +5 拒绝、乱填保留原值");
  }
  {
    const pair = HPE.parseSurgeInput("3/3", { surges: null, surgesMax: null });
    const one = HPE.parseSurgeInput("2", { surges: 3, surgesMax: 3 });
    const plus = HPE.parseSurgeInput("+1", { surges: 2, surgesMax: 3 });
    const empty = HPE.parseDefenseInput("");
    const num = HPE.parseDefenseInput("18");
    const badDef = HPE.parseDefenseInput("十八");
    if (!pair.ok || pair.patch.surges !== 3 || pair.patch.surgesMax !== 3) bad("回复力 3/3 解析不对：" + JSON.stringify(pair));
    else if (!one.ok || one.patch.surges !== 2) bad("回复力「2」解析不对：" + JSON.stringify(one));
    else if (!plus.ok || plus.patch.surges !== 3) bad("回复力「+1」解析不对：" + JSON.stringify(plus));
    else if (!empty.ok || empty.value !== null) bad("四防留空不是 null（应该「不画那枚盾」）：" + JSON.stringify(empty));
    else if (!num.ok || num.value !== 18) bad("四防「18」解析不对：" + JSON.stringify(num));
    else if (badDef.ok) bad("四防填非数字应该拒绝：" + JSON.stringify(badDef));
    else ok("回复力 3/3、2、+1 与四防「留空 = null / 18 / 非数字拒绝」都对");
  }
  {
    const built = HPE.buildHpEditPatch({ hp: "20/20", surge: "3/3", defs: { ac: "18", fort: "", reflex: "", will: "" } }, { cur: null, max: null });
    const none = HPE.buildHpEditPatch({ hp: "", surge: "", defs: { ac: "", fort: "", reflex: "", will: "" } }, { cur: null, max: null });
    const emptyDefs = HPE.buildHpEditPatch({ hp: "20/20", surge: "", defs: { ac: "", fort: "", reflex: "", will: "" } }, { cur: 20, max: 20 });
    if (!built.ok || !built.patch.defenses || built.patch.defenses.ac !== 18 || "fort" in built.patch.defenses) {
      bad("buildHpEditPatch 没有只写填了的那枚盾：" + JSON.stringify(built));
    } else if (none.ok) bad("表单全空时应该拒绝保存（提示先填生命）：" + JSON.stringify(none));
    else if (!emptyDefs.ok || emptyDefs.patch.defenses !== null) bad("四防全空应给 defenses = null（删键）：" + JSON.stringify(emptyDefs));
    else {
      const next = HPE.applyHpEdit({ cur: 20, max: 20, defenses: { ac: 18 }, boss: { enabled: true }, locked: false }, emptyDefs.patch, 999);
      if ("defenses" in next) bad("空四防写盘后 metadata 里还留着 defenses：" + JSON.stringify(next));
      else if (!next.boss || next.boss.enabled !== true || next.locked !== false) bad("写盘把 boss / locked 洗掉了：" + JSON.stringify(next));
      else if (next.updatedAt !== 999) bad("写盘没有更新 updatedAt：" + JSON.stringify(next));
      else ok("空四防 → 删掉 defenses 键；boss / locked 原样保留、updatedAt 更新");
    }
    const clamped = HPE.applyHpEdit({ cur: 12, max: 20, surges: 3, surgesMax: 3 }, { cur: 99, surges: 9 }, 1);
    if (clamped.cur > clamped.max || clamped.surges > clamped.surgesMax) bad("写盘没有跨字段夹取：" + JSON.stringify(clamped));
    else ok("写盘夹取：cur 99 → 20、surges 9 → 3");
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
      { cur: 20, max: 20, surges: 2, surgesMax: 3, defenses: { ac: 18, fort: 15, reflex: 17, will: 16 } });
    const hp = target.metadata[HP_E_KEY];
    if (!writeOk.ok) bad("GM 保存失败：" + JSON.stringify(writeOk));
    else if (!hp || hp.cur !== 20 || hp.max !== 20 || !hp.defenses || hp.defenses.ac !== 18) bad("保存没有写进 hp：" + JSON.stringify(hp));
    else if (hp.updatedAt !== 4242) bad("保存没有用 deps.now() 的时间戳：" + hp.updatedAt);
    else if (target.metadata["com.4enext-owlbear/hp-bar/enabled"] !== true) bad("保存没有顺手把血条组件打开");
    else ok("保存写 token metadata：20/20 + 回复力 2/3 + 四防 4 项 + 开关 true（updatedAt 来自 now()）");

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
      } else if (win.width !== 340 || win.height !== 150) {
        bad("编辑窗尺寸不是 340×150：" + win.width + "×" + win.height);
      } else if (!new RegExp("hp-edit\\.html\\?item=" + HPE_MONSTER + "&session=").test(win.url)) {
        bad("编辑窗 url 没带 item / session：" + win.url);
      } else if (win.hidePaper !== true || win.disableClickAway !== true) {
        bad("编辑窗 popover 参数不对（hidePaper / disableClickAway）");
      } else {
        ok("右键「添加血条组件」→ 写 true + 打开 /hp-edit（340×150，url 带 item + session）");
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
      { cur: 20, max: 20, surges: 3, surgesMax: 3, defenses: { ac: 18, fort: 15, reflex: 17, will: 16 } });
    if (!saved.ok) bad("GM 给杂兵保存失败：" + JSON.stringify(saved));
    const savedCbs = broadcastCbs["com.4enext-owlbear/hp-edit-saved"] || [];
    if (!savedCbs.length) bad("没有订阅 hp-edit-saved（保存后不会立刻重画）");
    else {
      for (const cb of savedCbs) cb({ data: { itemId: HPE_MONSTER, hp: saved.hp } });
      await sleep(260);
      const items = liveOf(HPE_MONSTER);
      const roles = items.map(barRoleOf);
      if (!items.length) bad("保存后血条没有画出来（hp-edit-saved 没触发重画）");
      else if (items.length !== 14) bad("杂兵保存后应画 14 件（HP 3 + 蓝条 3 + 四盾 + 4 数字），实际 " + items.length + "：" + roles.join(","));
      else if (!items.some((it) => barRoleOf(it) === "shield" && it.metadata["com.4enext-owlbear/bar"].key === "ac")) {
        bad("四防盾没有按 key=ac 画出来");
      } else ok("没绑角色卡的杂兵：保存 20/20 + 回复力 3/3 + 四防 → 血条立刻画出 14 件（含 AC 盾）");
    }
  }
  {
    /* 四防四个框全空 → 删键 → 一枚盾都不画（HP 条照旧） */
    const cleared = await HPE.writeHpEdit(sceneDeps, HPE_MONSTER, { defenses: null });
    const meta = hpeMonster.metadata[HP_E_KEY];
    for (const cb of itemsChangeCbs) cb(sceneItems);
    await sleep(300);
    const items = liveOf(HPE_MONSTER);
    const shields = items.filter((it) => barRoleOf(it) === "shield");
    const shieldTexts = items.filter((it) => barRoleOf(it) === "shield-text");
    if (!cleared.ok) bad("清空四防保存失败：" + JSON.stringify(cleared));
    else if (meta && "defenses" in meta) bad("清空四防后 metadata 里还留着 defenses 键：" + JSON.stringify(meta));
    else if (shields.length || shieldTexts.length) bad("空四防仍然画了 " + shields.length + " 枚盾（应该一枚都不画）");
    else if (!items.some((it) => barRoleOf(it) === "bar-text")) bad("清空四防把 HP 条也弄没了（只该不画盾）");
    else ok("空四防：metadata 删掉 defenses、一枚盾都不画，HP 条照旧");
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
      } else if (moved.width !== 340 || moved.height !== 150) {
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
    const diceNow = await openByTool(toolDice, /\/dice\.html$/, "骰子（v1.7.4 尺寸）");
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
      else if (first.width !== 380 || first.height !== 380) bad("记录窗口尺寸不是 380×380：" + first.width + "×" + first.height);
      else if (first.anchorReference !== "POSITION" || first.hidePaper !== true || first.disableClickAway !== true)
        bad("记录窗口没有 POSITION / hidePaper / disableClickAway：" + JSON.stringify([first.anchorReference, first.hidePaper, first.disableClickAway]));
      else if (!first.url.endsWith("/dice-history.html")) bad("记录窗口的 url 不对：" + first.url);
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

      /* ② 再 toggle 一次 → 关掉（同一个 id）+ 广播 open:false */
      const closedBefore = lastHistClose();
      histCmdCb({ data: { op: "toggle" } });
      await sleep(160);
      if (lastHistClose() === closedBefore) bad("第二次 toggle 没有 OBR.popover.close 记录窗口");
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

  finish();
})();

function finish() {
  console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
  process.exit(fail ? 1 : 0);
}