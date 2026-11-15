// 本地 HTTPS 静态服务器：在枭熊里做**真机验证**用（不需要先部署到 GitHub Pages）。
// ---------------------------------------------------------------------------
// 为什么必须是 HTTPS：Owlbear Rodeo 本体是 https 站点，它把扩展页面放进 iframe；
// http://localhost 会被当成混合内容拦掉，所以本地也得用 https（自签证书即可）。
// 证书在 dev/certs/（localhost 自签，10 年有效，只用于本地开发）。
//
// 用法：
//   node dev/serve-https.mjs            # 默认 https://localhost:8443
//   PORT=9000 node dev/serve-https.mjs  # 换端口（PowerShell: $env:PORT=9000; node dev/serve-https.mjs）
//
// 第一次用：
//   1) 浏览器打开 https://localhost:8443/manifest.json → 接受自签证书（"高级 → 继续访问"）；
//   2) 在枭熊房间里：Extension → Add → 粘贴 https://localhost:8443/manifest.json；
//   3) 以后每次改完文件只要 Ctrl+Shift+R 强刷房间页即可（本服务器 no-cache）。
//
// manifest 的绝对地址会**按请求的 Host 动态改写**（manifest.json 里写的是线上域名），
// 所以本地和线上可以共用同一份 manifest 源文件。
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8443);
/* 不写死 0.0.0.0 / 127.0.0.1：让 Node 用双栈监听（::）。
 * 只绑 0.0.0.0 时，浏览器把 localhost 解析成 ::1 就会「无法连接」（IPv6 端口没人听）。 */
const HOST = process.env.HOST || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

const BASE_MARK = "https://yzzj66.github.io/4e-obr-cards";

function loadCert() {
  const dir = path.join(ROOT, "dev", "certs");
  const key = path.join(dir, "localhost-key.pem");
  const cert = path.join(dir, "localhost-cert.pem");
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    console.error("缺少 dev/certs/localhost-key.pem 或 localhost-cert.pem。");
    console.error("重新生成：cd tools/certgen && node gen.mjs（见 4E-Patch 工作区 tools/certgen）");
    process.exit(1);
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

function serveManifest(req, res) {
  const file = path.join(ROOT, "manifest.json");
  if (!fs.existsSync(file)) return notFound(res);
  let text = fs.readFileSync(file, "utf8");
  const host = req.headers.host || ("localhost:" + PORT);
  const origin = "https://" + host;
  /* 线上 manifest 里是绝对 URL（GitHub Pages）。本地把域名换成当前 Host，
   * 插件里的相对地址（icon / background_url / action.popover）就都指向本地服务器。 */
  text = text.split(BASE_MARK).join(origin);
  text = text.split("https://yzzj66.github.io/4e-obr-cards/").join(origin + "/");
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(text);
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end("404");
}

function handle(req, res) {
  try {
    const url = new URL(req.url, "https://" + (req.headers.host || "localhost"));
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/manifest.json") return serveManifest(req, res);
    if (pathname === "/") pathname = "/index.html";
    /* 只允许读仓库内的文件（挡住 ../ 越权） */
    const target = path.resolve(ROOT, "." + pathname);
    if (!target.startsWith(ROOT)) return notFound(res);
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return notFound(res);
    const ext = path.extname(target).toLowerCase();
    const body = fs.readFileSync(target);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": body.length,
      /* 开发期一律不缓存：改完刷新就能看到最新文件（比 ?v= 更好用） */
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(body);
  } catch (e) {
    console.error("[serve] error", e);
    try { res.writeHead(500); res.end("500"); } catch (e2) { /* ignore */ }
  }
}

const { key, cert } = loadCert();
const server = https.createServer({ key, cert }, handle);
let tried = 0;
function listen(port) {
  server.listen(port, HOST || undefined, () => {
    console.log("本地 HTTPS 已启动：");
    console.log("  manifest: https://localhost:" + port + "/manifest.json");
    console.log("  入口页:   https://localhost:" + port + "/index.html");
    console.log("");
    console.log("第一次用：先在浏览器打开上面 manifest 地址接受自签证书（高级 → 继续访问），");
    console.log("再在枭熊里 Extensions → Add Extension 粘贴该地址。");
    console.log("改完文件：房间页 Ctrl+Shift+R 强刷（服务器不缓存）。");
    console.log("");
    console.log("这个窗口要一直开着；关掉就「无法连接」。按 Ctrl+C 停止。");
  });
}
server.on("error", (e) => {
  if (e && e.code === "EADDRINUSE" && tried < 8) {
    tried++;
    const next = PORT + tried;
    console.log("端口 " + (PORT + tried - 1) + " 被占用，改用 " + next + " …");
    setTimeout(() => listen(next), 120);
    return;
  }
  console.error("启动失败：", e && e.message ? e.message : e);
  process.exit(1);
});
listen(PORT);
