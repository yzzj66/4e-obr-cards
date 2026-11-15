// 后台逻辑冒烟测试（无浏览器）：用假的 OBR 跑一遍 assets/background.core.js，
// 检查「工具栏 / 右键菜单 / 浮动按钮 / 自诊断通知 / 心跳」这几步真的被调用了。
// 用法：node dev/test-background.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = fs.readFileSync(path.join(ROOT, "assets", "background.core.js"), "utf8");

let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };

const calls = [];
const record = (name, arg) => calls.push([name, arg]);
const last = (name) => [...calls].reverse().find((c) => c[0] === name);

let readyCb = null;
const noopUnsub = () => () => {};

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
    onChange(fn) { record("viewport.onChange", true); return noopUnsub(); }
  },
  player: {
    getSelection: async () => [],
    onChange(fn) { record("player.onChange", true); return noopUnsub(); }
  },
  party: {},
  scene: {
    isReady: async () => true,
    onReadyChange(fn) { record("scene.onReadyChange", true); return noopUnsub(); },
    onMetadataChange(fn) { record("scene.onMetadataChange", true); return noopUnsub(); },
    getMetadata: async () => ({}),
    items: {
      getItems: async () => [],
      getItemBounds: async () => ({ center: { x: 10, y: 10 }, height: 100, width: 100 }),
      onChange(fn) { record("scene.items.onChange", true); return noopUnsub(); }
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
    getMetadata: async () => ({}),
    onMetadataChange(fn) { record("room.onMetadataChange", true); return noopUnsub(); }
  },
  broadcast: {
    sendMessage(channel, data, opts) { record("broadcast.sendMessage", { channel, data, opts }); return Promise.resolve(); },
    onMessage(channel, cb) { record("broadcast.onMessage", channel); return noopUnsub(); }
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
globalThis.localStorage = { getItem: () => null, setItem() {} };

// --- 跑起来 ---
const run = new Function("OBR", CORE + "\nreturn { boot: typeof boot === 'function' ? boot : null };");
run(OBR);

(async () => {
  if (typeof readyCb !== "function") { bad("没有注册 OBR.onReady"); return finish(); }
  ok("注册了 OBR.onReady");
  await readyCb();
  await new Promise((r) => setTimeout(r, 60));

  const tool = last("tool.create");
  if (!tool) bad("没有调用 OBR.tool.create（工具栏入口）");
  else if (!/\/panel-tool$/.test(tool[1].id)) bad("tool.create 的 id 不对：" + tool[1].id);
  else if (!/^https:\/\/.+icon-tool\.svg$/.test(tool[1].icons[0].icon)) bad("tool.create 的图标不是绝对地址");
  else ok("OBR.tool.create（工具栏入口）已注册");

  const menu = last("contextMenu.create");
  if (!menu) bad("没有调用 OBR.contextMenu.create（右键菜单）");
  else {
    const icon = menu[1].icons[0];
    if (!icon.filter || !icon.filter.roles || icon.filter.roles.indexOf("GM") < 0) bad("右键菜单 filter.roles 不是 [\"GM\"]");
    else if (!/^https:\/\//.test(icon.icon)) bad("右键菜单图标不是绝对地址");
    else if (icon.filter.every[0].key !== "type" || icon.filter.every[0].value !== "IMAGE") bad("右键菜单 every 过滤不对");
    else ok("OBR.contextMenu.create（GM + IMAGE）已注册");
  }

  const pop = last("popover.open");
  if (!pop) bad("没有调用 OBR.popover.open（右下角浮动按钮）");
  else if (pop[1].anchorReference !== "POSITION") bad("popover.open 没有用 anchorReference: POSITION");
  else if (!/\/button\.html$/.test(pop[1].url)) bad("浮动按钮的 url 不对：" + pop[1].url);
  else if (pop[1].hidePaper !== true) bad("浮动按钮没有 hidePaper");
  else ok("OBR.popover.open 的锚点参数与参考实现一致");

  const notes = calls.filter((c) => c[0] === "notification.show").map((c) => c[1]);
  if (!notes.some((n) => /已加载/.test(n.msg))) bad("没有发「已加载」自诊断通知");
  else ok("发了汇总自诊断通知：" + notes.map((n) => n.variant + " " + n.msg).join(" | "));

  const hello = calls.find((c) => c[0] === "broadcast.sendMessage" && /diag-hello$/.test(c[1].channel));
  if (!hello) bad("没有发后台心跳（diag-hello）"); else ok("发了后台心跳（面板会显示「后台已连接」）");

  if (!calls.some((c) => c[0] === "broadcast.onMessage")) bad("没有订阅 diag-ping"); else ok("订阅了面板的 ping");

  finish();
})();

function finish() {
  console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
  process.exit(fail ? 1 : 0);
}
