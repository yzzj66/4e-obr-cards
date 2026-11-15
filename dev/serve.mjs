// 本地预览用静态服务器（仅开发/自测；插件本身是纯静态文件，不需要它）。
// 用法：node dev/serve.mjs [端口]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = parseInt(process.argv[2] || "8123", 10);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

http.createServer(function (req, res) {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!path.resolve(file).startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const st = fs.statSync(file);
    if (st.isDirectory()) file = path.join(file, "index.html");
  } catch (e) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 " + url);
    return;
  }
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store", "access-control-allow-origin": "*" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", function () {
  console.log("serving " + ROOT + " at http://127.0.0.1:" + PORT + "/");
});
