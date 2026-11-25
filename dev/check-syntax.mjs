// 模块语法检查：对 assets/*.js 逐个按 ESM 解析（vm.SourceTextModule）。
// 目的：抓「import 名与本地 function 重名」这类重复声明 / 语法错误（v2.4.8 编辑窗白屏事故）。
// 用法：node dev/check-syntax.mjs（内部需要 --experimental-vm-modules，会自己 re-exec）
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (typeof vm.SourceTextModule !== "function") {
  const r = spawnSync(process.execPath, ["--experimental-vm-modules", fileURLToPath(import.meta.url)], { stdio: "inherit" });
  process.exit(r.status == null ? 1 : r.status);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");
const files = fs.readdirSync(ASSETS).filter((f) => f.endsWith(".js")).sort();
let fail = 0;
for (const name of files) {
  const src = fs.readFileSync(path.join(ASSETS, name), "utf8");
  try {
    /* 只解析、不链接/不执行：重复声明、非法 import/export 会在构造时抛 SyntaxError。 */
    new vm.SourceTextModule(src, { identifier: "assets/" + name });
    console.log("  ok   assets/" + name);
  } catch (e) {
    fail++;
    console.log("  FAIL assets/" + name + "：" + (e && e.message ? e.message : e));
  }
}
console.log(fail ? "\n" + fail + " 个模块语法错误" : "\n全部通过（assets/*.js 均按 ESM 解析通过，exit 0）");
process.exit(fail ? 1 : 0);
