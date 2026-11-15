// 组装 assets/background.bundle.js：vendor/obr-sdk.js（去掉 export）+ assets/background.core.js
// ---------------------------------------------------------------------------------
// 为什么要有这个脚本：
//   参考实现 character-cards 的后台是 vite 打包出的「单个普通 module」。我们不想引入
//   npm / 构建流程，但也不想在手写文件里内联 200KB 的 SDK —— 于是用这个开发期脚本
//   拼一次，把结果（assets/background.bundle.js）提交进仓库。
//   跑插件 / 部署网站上**不需要**它，产物是纯静态文件。
//
// 用法：node dev/build-background.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SDK = path.join(ROOT, "vendor", "obr-sdk.js");
const CORE = path.join(ROOT, "assets", "background.core.js");
const OUT = path.join(ROOT, "assets", "background.bundle.js");

function die(msg) {
  console.error("构建失败：" + msg);
  process.exit(1);
}

// ---- 1. SDK：去掉 ESM 的 export 语句，找出 default 的变量名 ----
let sdk = fs.readFileSync(SDK, "utf8");
sdk = sdk.replace(/\/\/#\s*sourceMappingURL=.*\s*$/m, "");

if (/^\s*import\s/m.test(sdk) || /[^.\w]import\s*\(/.test(sdk) || /\bimport\.meta\b/.test(sdk)) {
  die("vendor/obr-sdk.js 里还有 import / import.meta，不能当经典脚本用");
}

const exportIdx = sdk.lastIndexOf("export{");
if (exportIdx < 0) die("vendor/obr-sdk.js 里找不到 export{...}，SDK 结构变了？");

const exportBlock = sdk.slice(exportIdx);
const closeIdx = exportBlock.indexOf("}");
if (closeIdx < 0) die("export{...} 没有闭合");

const pairs = exportBlock.slice("export{".length, closeIdx).split(",");
const named = {}; // 导出名 → SDK 里的（压缩过的）变量名
for (const pair of pairs) {
  const m = /^\s*([\w$]+)\s+as\s+([\w$]+)\s*$/.exec(pair);
  if (m) named[m[2]] = m[1];
}
const defaultName = named.default;
if (!defaultName) die("export{...} 里没有 X as default");

// 血条要用 SDK 的具名导出（默认导出只有 OBR 命名空间，没有构建器）。
// 这里把它们接到同一个作用域，background.core.js 才能写 buildCurve() 这种调用。
const BUILDERS = ["buildCurve", "buildShape", "buildText"];
const missing = BUILDERS.filter((n) => !named[n]);
if (missing.length) die("vendor/obr-sdk.js 里缺少具名导出 " + missing.join(" / ") + "（画 token 血条要用），SDK 版本变了？");

const sdkBody = sdk.slice(0, exportIdx).replace(/\s+$/, "");
const declRe = new RegExp("(?:var|let|const)\\s+" + defaultName.replace(/\$/g, "\\$") + "\\s*=");
if (!declRe.test(sdkBody)) die("SDK 里找不到默认导出的声明变量 " + defaultName);

// ---- 2. 插件逻辑：必须是经典脚本 ----
let core = fs.readFileSync(CORE, "utf8");
if (/^\s*(import|export)\s/m.test(core)) die("assets/background.core.js 里不能写 import / export");

// ---- 3. 拼装 ----
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const note = "esm.sh 用 export{ " + defaultName + " as default } 导出 SDK 本体；上面已剥掉 export 语句，\n * 这里把同一个变量接成 OBR。换 SDK 后若变量名变了，dev/build-background.mjs 会直接报错。";
const header = [
  "/*! 4eNEXT to owlbear · background.bundle.js  (v" + pkg.version + ")",
  " * ---------------------------------------------------------------------------",
  " * 这是后台页唯一加载的脚本：纯「经典脚本」，没有 type=\"module\"，没有 import/export，",
  " * 不依赖任何 CDN。内容是：",
  " *   1) vendor/obr-sdk.js —— @owlbear-rodeo/sdk 3.1.0（esm.sh 打包），去掉末尾的 export{}",
  " *   2) assets/background.core.js —— 右键菜单 / 工具栏 / 浮动按钮 / token 血条 / 自诊断",
  " *",
  " * 不要手改本文件。改逻辑请改 assets/background.core.js，然后：",
  " *     node dev/build-background.mjs",
  " * 生成时间：" + new Date().toISOString(),
  " * --------------------------------------------------------------------------- */",
  "(function () {",
  "\"use strict\";",
  "",
  "/* ==================== 1/2  SDK（vendor/obr-sdk.js） ==================== */",
  sdkBody,
  "",
  "/* " + note + " */",
  "var OBR = " + defaultName + ";",
  "",
  "/* 具名导出：图形构建器（dev/build-background.mjs 从 SDK 的 export{} 里接过来） */",
  BUILDERS.map((n) => "var " + n + " = " + named[n] + ";").join("\n"),
  "",
  "if (!OBR || typeof OBR.onReady !== \"function\") {",
  "  try {",
  "    document.title = \"4E 后台：SDK 未初始化\";",
  "    var st = document.getElementById(\"diag-state\");",
  "    if (st) { st.className = \"bad\"; st.textContent = \"SDK 未初始化：没有拿到 OBR 对象\"; }",
  "  } catch (e) { /* 忽略 */ }",
  "  return;",
  "}",
  "",
  "/* ==================== 2/2  插件逻辑（assets/background.core.js） ==================== */",
  core.trim(),
  "",
  "})();",
  ""
].join("\n");

fs.writeFileSync(OUT, header, "utf8");
console.log("已生成 " + path.relative(ROOT, OUT));
console.log("  SDK 默认导出变量：" + defaultName);
console.log("  文件大小：" + (Buffer.byteLength(header) / 1024).toFixed(1) + " KB");
console.log("  行数：" + header.split("\n").length);