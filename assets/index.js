// 说明页：算出可复制的 manifest 地址、生成绝对路径版 manifest、渲染示例卡、跑插件自检。
// 这个页面不 import OBR SDK 到顶层（普通浏览器里也能正常打开），但如果环境可用会动态探测。
import { renderGlanceHTML } from "./glance.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function msg(e) {
  return e && e.message ? e.message : String(e);
}

const base = new URL("./", location.href);
const manifestUrl = new URL("manifest.json", base).href;

const urlInput = document.getElementById("manifest-url");
if (urlInput) urlInput.value = manifestUrl;

/* ---------------------------------------------------------------------------
 * 自检 #1：manifest 是否可读、里面写的地址是否就是当前这个站点
 * ------------------------------------------------------------------------- */
const els = {
  manifest: document.getElementById("diag-manifest"),
  manifestState: document.getElementById("diag-manifest-state"),
  manifestBase: document.getElementById("diag-manifest-base"),
  bg: document.getElementById("diag-bg"),
  sdk: document.getElementById("diag-sdk"),
  env: document.getElementById("diag-env")
};

function pill(el, cls, text) {
  if (!el) return;
  el.className = cls === "ok" ? "pill-ok" : cls === "bad" ? "pill-bad" : "pill-wait";
  el.textContent = text;
}

if (els.manifest) els.manifest.textContent = manifestUrl;

const FALLBACK_MANIFEST = {
  name: "4eNEXT to owlbear",
  version: "2.4.26",
  manifest_version: 1,
  author: "4E NEXT 玩家自制",
  description: "4eNEXT to owlbear：血条扩展（临时生命 / 四防一排 / 蓝色回复力条）+ Boss 样式（环形血条 / 名牌 / 锁）+ 骰子（独立记录窗口 / 投骰动画）+ 屏幕顶部先攻条 + 速览 / 角色卡导入 / 设置与关于各自独立窗口。",
  icon: "icon.svg",
  action: { title: "4eNEXT to owlbear", icon: "icon.svg", popover: "panel.html", width: 960, height: 660 },
  background_url: "background.html"
};

/** 把 manifest 里的地址换成「当前这个页面所在站点」的绝对地址。
 *  （本插件所有文件都在站点根目录，所以按文件名重拼就够了；放到子目录也能用。） */
function absolutize(m, baseUrl) {
  const out = JSON.parse(JSON.stringify(m || {}));
  const fix = function (u) {
    if (!u) return u;
    /* action.popover 可能带查询串 / 锚点（v1.3.0 曾用 ?tab=init），重拼绝对地址时必须保留。 */
    const m = /^([^?#]*)([?#].*)?$/.exec(String(u));
    const name = (m ? m[1] : String(u)).split("/").pop();
    return new URL(name + (m && m[2] ? m[2] : ""), baseUrl).href;
  };
  out.icon = fix(out.icon);
  out.background_url = fix(out.background_url);
  if (out.action) {
    out.action.icon = fix(out.action.icon);
    out.action.popover = fix(out.action.popover);
  }
  return out;
}

function setAbsolutePreview(m) {
  const absPre = document.getElementById("abs-manifest");
  if (absPre) absPre.textContent = JSON.stringify(absolutize(m, base), null, 2);
}

setAbsolutePreview(FALLBACK_MANIFEST);

function originOf(u) {
  try { return new URL(u, base).href; } catch (e) { return ""; }
}

async function getJson(url) {
  const res = await fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "ts=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

async function getOk(url) {
  // 用 GET 而不是 HEAD：个别静态托管对 HEAD 支持不好，会给出假的失败结论
  const res = await fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "ts=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return true;
}

async function auditManifest() {
  let manifest = null;
  try {
    manifest = await getJson(manifestUrl);
    pill(els.manifestState, "ok", "✓ 读到了（v" + (manifest.version || "?") + "，manifest_version " + manifest.manifest_version + "）");
  } catch (e) {
    pill(els.manifestState, "bad", "✗ 读不到：" + msg(e));
    pill(els.manifestBase, "bad", "✗ 先修 manifest.json 再来");
    return null;
  }
  setAbsolutePreview(manifest);

  const bg = originOf(manifest.background_url);
  const act = manifest.action && manifest.action.popover ? originOf(manifest.action.popover) : "";
  const here = base.href;
  const sameSite = bg.indexOf(here) === 0;
  if (!bg) {
    pill(els.manifestBase, "bad", "✗ manifest 里没有 background_url");
  } else if (!sameSite) {
    pill(els.manifestBase, "warn", "⚠ manifest 指向别的站点：" + bg + "（本页是 " + here + "）——如果换了托管地址，按下面生成的绝对 manifest 覆盖");
  } else {
    pill(els.manifestBase, "ok", "✓ 指向本页所在站点" + (act ? "，action 弹窗 " + act : "（⚠ 没有 action：左上角入口不会出现）"));
  }
  return manifest;
}

/* ---------------------------------------------------------------------------
 * 自检 #2：后台脚本、SDK、Owlbear 环境
 * ------------------------------------------------------------------------- */
async function auditRuntime(manifest) {
  // 后台页 + 后台脚本是否真的部署上去了
  try {
    const bgPage = manifest && manifest.background_url ? originOf(manifest.background_url) : new URL("background.html", base).href;
    await getOk(bgPage);
    await getOk(new URL("assets/background.bundle.js", base).href);
    pill(els.bg, "ok", "✓ background.html 与 assets/background.bundle.js 都能取到");
  } catch (e) {
    pill(els.bg, "bad", "✗ 取不到：" + msg(e) + "（后台脚本没部署上，右键菜单和浮动按钮都不会出现）");
  }

  // SDK 能不能加载、是不是在枭熊里
  try {
    const mod = await import(new URL("vendor/obr-sdk.js", base).href);
    const OBR = mod && mod.default ? mod.default : mod;
    if (!OBR || typeof OBR.onReady !== "function") throw new Error("没有拿到 OBR 对象");
    const available = OBR.isAvailable === true;
    pill(els.sdk, "ok", "✓ 加载成功（OBR.isAvailable=" + String(OBR.isAvailable) + "）");
    if (available) {
      pill(els.env, "ok", OBR.isReady ? "✓ 已在枭熊房间里，已就绪" : "✓ 在枭熊房间里，等父窗口握手…");
    } else {
      pill(els.env, "wait", "• 不在枭熊房间里（普通浏览器打开本页时正常；请回房间看按钮）");
    }
  } catch (e) {
    pill(els.sdk, "bad", "✗ 加载失败：" + msg(e));
    pill(els.env, "bad", "✗ SDK 都没加载，插件在房间里一定不工作");
  }
}

// 先画一版，再异步补全，避免某些浏览器里 await 之前白屏
(async function runAudit() {
  const manifest = await auditManifest();
  await auditRuntime(manifest);
})();

/* ---------------------------------------------------------------------------
 * 复制按钮
 * ------------------------------------------------------------------------- */
function wireCopy(btnId, inputId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const label = btn.textContent;
  btn.addEventListener("click", async function () {
    const el = document.getElementById(inputId);
    const value = el && "value" in el ? el.value : el ? el.textContent : "";
    try {
      await navigator.clipboard.writeText(value);
      btn.textContent = "已复制";
    } catch (e) {
      if (el && el.select) el.select();
      btn.textContent = "请按 Ctrl+C";
    }
    setTimeout(function () { btn.textContent = label; }, 1600);
  });
}
wireCopy("copy-url", "manifest-url");
wireCopy("copy-abs", "abs-manifest");

/* ---------------------------------------------------------------------------
 * 示例卡渲染
 * ------------------------------------------------------------------------- */
(async function demo() {
  const box = document.getElementById("demo");
  if (!box) return;
  try {
    const res = await fetch(new URL("samples/sample-card.json", base).href);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const save = await res.json();
    box.innerHTML = renderGlanceHTML(save.pages.character);
  } catch (e) {
    box.innerHTML = '<p class="muted">示例卡加载失败：' + esc(msg(e)) +
      "（直接用 file:// 打开本页时，浏览器的安全策略会拦截 fetch；起一个静态服务器或用托管地址访问即可）</p>";
  }
})();