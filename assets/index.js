// 说明页：算出可复制的 manifest 地址、生成绝对路径版 manifest、渲染示例卡。
// 这个页面不加载 OBR SDK（普通浏览器里也能正常打开）。
import { renderGlanceHTML } from "./glance.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

const base = new URL("./", location.href);
const manifestUrl = new URL("manifest.json", base).href;

const urlInput = document.getElementById("manifest-url");
if (urlInput) urlInput.value = manifestUrl;

const absolute = {
  name: "4E NEXT 角色卡",
  version: "1.0.0",
  manifest_version: 1,
  author: "4E NEXT 玩家自制",
  description: "查看 4E NEXT 导出的角色卡速览；右键 token 绑定角色卡，选中即弹出速览。",
  icon: new URL("icon.svg", base).href,
  background_url: new URL("background.html", base).href
};
const absPre = document.getElementById("abs-manifest");
if (absPre) absPre.textContent = JSON.stringify(absolute, null, 2);

function wireCopy(btnId, inputId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", async function () {
    const value = document.getElementById(inputId).value;
    try {
      await navigator.clipboard.writeText(value);
      btn.textContent = "已复制";
    } catch (e) {
      const el = document.getElementById(inputId);
      el.focus();
      el.select();
      btn.textContent = "请按 Ctrl+C";
    }
    setTimeout(function () { btn.textContent = "复制"; }, 1600);
  });
}
wireCopy("copy-url", "manifest-url");
wireCopy("copy-abs", "abs-manifest");

(async function demo() {
  const box = document.getElementById("demo");
  if (!box) return;
  try {
    const res = await fetch(new URL("samples/sample-card.json", base).href);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const save = await res.json();
    box.innerHTML = renderGlanceHTML(save.pages.character);
  } catch (e) {
    box.innerHTML = '<p class="muted">示例卡加载失败：' + esc(e && e.message ? e.message : e) +
      "（直接用 file:// 打开本页时，浏览器的安全策略会拦截 fetch；起一个静态服务器或用托管地址访问即可）</p>";
  }
})();
