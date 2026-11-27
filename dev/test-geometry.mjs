// token 血条几何的离线自测（无浏览器 / 无 OBR / 不联网）
// ---------------------------------------------------------------------------
// 加载的是 **assets/background.core.js 的真实源码**（node:vm + 假 window/document/OBR 桩，
// 不打桩任何几何函数），再从 window.__4eBar 拿 barLayout / roundedRectPoints / shieldPoints /
// circlePoints 与常数表，逐条核对 v2.4.15 的用户样板布局：
//   · 底部血条：宽 64% token 宽 / 高 10% 短边 / 底边距 4% / 圆角 = 高/2，所有点都在包围盒内；
//   · 左侧竖排三圆（强/反/意）：直径 16% 短边、左边距 6%、间距 4%，都在包围盒内；
//   · 右下 AC 盾：宽 20% 短边、高按 1.08 比例、右下内缩 4%，含描边不越界；
//   · 比例填充 points 数 / 血怒色；HP 数字在条内、装不下隐藏；玩家端无数字、不画四防；
//   · 不再有环形（L.ring 不存在）。
// 用法：node dev/test-geometry.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "assets", "background.core.js");
const EPS = 0.01;

let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/* ---- 1. 在 Node 的 vm 里跑真实源码（只给浏览器外壳的桩，不碰几何） ---- */
const win = { addEventListener() {} };
const sandbox = {
  window: win,
  document: {
    baseURI: "https://example.invalid/4e-obr/",
    getElementById: () => null,
    createElement: () => ({ style: {}, className: "", textContent: "", appendChild() {} }),
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: "https://example.invalid/4e-obr/background.html" },
  navigator: { userAgent: "node" },
  OBR: { onReady() {}, isAvailable: false },
  URL,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(CORE, "utf8"), sandbox, { filename: "assets/background.core.js" });

const B = sandbox.window && sandbox.window.__4eBar;
if (!B || typeof B.barLayout !== "function" || typeof B.roundedRectPoints !== "function") {
  console.log("  FAIL assets/background.core.js 末尾没有 window.__4eBar 调试钩子（barLayout / roundedRectPoints 取不到）");
  process.exit(1);
}
ok("从真实源码拿到 window.__4eBar（barLayout / roundedRectPoints / shieldPoints / circlePoints）");

/* ---- 2. 小工具 ---- */
const C = B.CONSTANTS;
const boundsOf = (cols, rows, dpi = 150) => {
  const w = cols * dpi, h = rows * dpi;
  return { min: { x: 0, y: 0 }, max: { x: w, y: h }, width: w, height: h, center: { x: w / 2, y: h / 2 } };
};
const hpOf = (cur, max, defenses = null, temp = 0) =>
  ({ cur, max, temp, surges: 0, surgesMax: 0, defenses, locked: true, name: "" });
const DEFS = { ac: 18, fort: 15, reflex: 13, will: 12 };

function firstBadNumber(v, p) {
  if (typeof v === "number") return Number.isFinite(v) ? null : p;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = firstBadNumber(v[i], p + "[" + i + "]");
      if (r) return r;
    }
    return null;
  }
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) {
      const r = firstBadNumber(v[k], p + "." + k);
      if (r) return r;
    }
  }
  return null;
}
const insideBox = (pts, b, pad = 0) =>
  pts.every((p) => p.x >= b.min.x + pad - EPS && p.x <= b.max.x - pad + EPS &&
    p.y >= b.min.y + pad - EPS && p.y <= b.max.y - pad + EPS);
const worldPts = (localPts, x, y) => localPts.map((p) => ({ x: x + p.x, y: y + p.y }));
const barPts = (L, W, H, R, seg) => worldPts(B.roundedRectPoints(W, H, R, seg), L.bar.cx, L.bar.cy);

/* ---- 3. s=1 精确几何（1×1 token、150 dpi → 包围盒 150×150、s=1） ---- */
{
  const b = boundsOf(1, 1);
  const L = B.barLayout(b, 150, hpOf(20, 20, DEFS, 3), { exact: true, threshold: 25 });
  const short = Math.min(b.width, b.height);
  const badS = [];
  if (L.ring !== undefined) badS.push("仍有 ring 字段（应已删除环形）");
  if (!near(L.scale, 1, 1e-9)) badS.push("scale=" + L.scale + "（要 1）");
  if (!near(L.bar.width, b.width * 0.64, 1e-9)) badS.push("bar.width=" + L.bar.width);
  if (!near(L.bar.height, short * 0.10, 1e-9)) badS.push("bar.height=" + L.bar.height);
  if (!near(L.bar.radius, L.bar.height / 2, 1e-9)) badS.push("bar.radius=" + L.bar.radius);
  if (!near(L.bar.cx, b.center.x, 1e-9)) badS.push("bar.cx 不居中");
  if (!near(b.max.y - L.bar.cy - L.bar.height / 2, short * 0.04, 1e-9)) badS.push("底边距不是 4% 短边");
  if (!near(L.bar.fillW, L.bar.width * 1, 1e-6)) badS.push("满血 fillW 不是条宽");
  if (L.defs.length !== 3) badS.push("四防圆不是 3 个：" + L.defs.length);
  if (!L.shield) badS.push("没有 AC 盾");
  if (!L.textVisible || L.hpText !== "20/20 +3") badS.push("条内文字不是 20/20 +3");
  if (!badS.length) ok("s=1：条宽 64% / 高 10% 短边 / 圆角 高/2 / 底边距 4% / 3 圆 + AC 盾 / 文字 20/20 +3");
  else bad("s=1 几何不对：" + badS.join(" / "));

  const bd = L.bar.height;
  if (L.defs.every((d) => near(d.d, short * 0.16, 1e-9)) &&
    L.defs.every((d) => near(d.x, b.min.x + short * 0.06 + d.d / 2, 1e-9))) {
    ok("左侧三圆：直径 16% 短边、左边距 6%");
  } else bad("左侧三圆尺寸 / 左边距不对：" + JSON.stringify(L.defs.map((d) => [d.key, d.d, d.x])));
  const ys = L.defs.map((d) => d.y);
  if (L.defs.map((d) => d.key).join(",") === "fort,reflex,will" &&
    ys[0] < ys[1] && ys[1] < ys[2] &&
    near(ys[1] - ys[0], short * 0.16 + short * 0.04, 1e-9)) {
    ok("三圆顺序：上→下 = 强韧 / 反射 / 意志，间距 4% 短边");
  } else bad("三圆顺序 / 间距不对：" + JSON.stringify(L.defs.map((d) => [d.key, d.y])));
  if (L.shield && near(L.shield.w, short * 0.20, 1e-9) && near(L.shield.h, short * 0.20 * 1.08, 1e-9)) {
    ok("AC 盾：宽 20% 短边、高 1.08 倍盾宽");
  } else bad("AC 盾尺寸不对：" + JSON.stringify(L.shield));
  if (L.shield && near(b.max.x - (L.shield.cx + L.shield.w / 2), short * 0.04, 1e-9) &&
    near(b.max.y - (L.shield.cy + L.shield.h / 2), short * 0.04, 1e-9)) {
    ok("AC 盾贴右下角：内缩 4% 短边");
  } else bad("AC 盾右下内缩不对");
  if (!near(bd, L.bar.height, 1e-9)) bad("bar 高度引用错误");
}

/* ---- 4. 主矩阵：5 种 token 尺寸 × 3 种 HP × 有/无四防 ---- */
const SIZES = [
  ["1×1", 1, 1], ["0.5×0.5", 0.5, 0.5], ["2×2", 2, 2], ["1×2", 1, 2], ["4×4", 4, 4]
];
const HPS = [
  ["满血 60/60", 60, 60], ["半血 30/60", 30, 60], ["1/60", 1, 60]
];
let cells = 0, ringPts = 0, defPts = 0, textBoxes = 0, nan = 0, outBox = 0;

for (const [sizeName, cols, rows] of SIZES) {
  for (const [hpName, cur, max] of HPS) {
    for (const withDef of [false, true]) {
      cells++;
      const b = boundsOf(cols, rows);
      const L = B.barLayout(b, 150, hpOf(cur, max, withDef ? DEFS : null), { exact: true, threshold: 25 });
      const badNum = firstBadNumber(L, "L");
      if (badNum) { nan++; bad(sizeName + " " + hpName + (withDef ? " 有四防" : " 无四防") + "：出现非有限数 " + badNum); }
      const short = Math.min(b.width, b.height);
      const s = L.scale;

      /* 4.1 底部血条（轨道 + 比例填充）所有点都在包围盒内 */
      const barAll = [
        ...barPts(L, L.bar.width, L.bar.height, L.bar.radius, 24),
        ...barPts(L, L.bar.fillW, L.bar.height, Math.min(L.bar.radius, L.bar.fillW / 2), 16)
      ];
      ringPts += barAll.length;
      if (!insideBox(barAll, b)) {
        outBox++;
        bad(sizeName + " " + hpName + "：底部血条有点越出包围盒");
      }
      if (!near(L.bar.fillW, L.bar.width * L.ratio, 1e-6)) {
        outBox++; bad(sizeName + " " + hpName + "：填充宽度不是 barW×ratio");
      }
      if (!near(L.bar.radius, L.bar.height / 2, 1e-9)) {
        outBox++; bad(sizeName + " " + hpName + "：圆角不是条高/2");
      }

      /* 4.2 四防圆 + AC 盾：含描边一半都在包围盒内 */
      if (withDef) {
        if (!L.showDefenses || L.defs.length !== 3 || !L.shield) {
          outBox++; bad(sizeName + " " + hpName + "：四防应 3 圆 + 1 盾，实际 " + L.defs.length + " / " + !!L.shield);
        }
        for (const cd of L.defs) {
          const strokeHalf = Math.max(0.8, cd.d * 0.035) / 2;
          const pts = worldPts(B.circlePoints(cd.d, 32), cd.x - cd.d / 2, cd.y - cd.d / 2);
          defPts += pts.length;
          if (!insideBox(pts, b, strokeHalf)) { outBox++; bad(sizeName + " " + hpName + " " + cd.key + " 圆越界"); }
        }
        if (L.shield) {
          const sh = L.shield;
          const strokeHalf = sh.strokeWidth / 2;
          const pts = worldPts(B.shieldPoints(sh.w, sh.h, 14), sh.cx - sh.w / 2, sh.cy - sh.h / 2);
          defPts += pts.length;
          if (!insideBox(pts, b, strokeHalf)) { outBox++; bad(sizeName + " " + hpName + " AC 盾越界"); }
        }
      } else if (L.defs.length || L.showDefenses || L.shield) {
        outBox++; bad(sizeName + " " + hpName + "：没有四防数据却画了四防");
      }

      /* 4.3 HP 文字：在条内、字号 ≥ 3s；装不下必须隐藏 */
      if (L.textVisible) {
        textBoxes++;
        if (!(L.hpFont > 0 && L.hpTextW > 0 && L.hpTextH > 0)) outBox++, bad(sizeName + " " + hpName + "：文字可见但尺寸为 0");
        if (L.hpFont < 3 * s - 1e-9) outBox++, bad(sizeName + " " + hpName + "：字号 < 3s");
        const corners = [
          { x: L.hpTextX, y: L.hpTextY },
          { x: L.hpTextX + L.hpTextW, y: L.hpTextY },
          { x: L.hpTextX, y: L.hpTextY + L.hpTextH },
          { x: L.hpTextX + L.hpTextW, y: L.hpTextY + L.hpTextH }
        ];
        if (!insideBox(corners, {
          min: { x: L.bar.left, y: L.bar.top }, max: { x: L.bar.left + L.bar.width, y: L.bar.top + L.bar.height },
          width: L.bar.width, height: L.bar.height
        })) {
          outBox++; bad(sizeName + " " + hpName + "：HP 文字框越出底部血条");
        }
      } else if (L.hpText !== "") {
        outBox++; bad(sizeName + " " + hpName + "：文字不可见但 hpText 非空");
      }

      /* 4.4 血怒颜色 */
      const wantBloodied = cur <= max / 2;
      if (L.bloodied !== wantBloodied) outBox++, bad(sizeName + " " + hpName + "：bloodied 不对");
      const wantFill = wantBloodied ? C.COLOR_HP_BLOODIED : "#b00000";
      if (L.colorFill !== wantFill) outBox++, bad(sizeName + " " + hpName + "：填充色 " + L.colorFill + "，应为 " + wantFill);
    }
  }
}
if (!nan) ok("主矩阵 " + cells + " 组：全字段无 NaN / Infinity");
if (!outBox) {
  ok("主矩阵 " + cells + " 组：底部血条 " + ringPts + " 点 / 四防 " + defPts + " 点 / 文字 " + textBoxes +
    " 个都在包围盒内（四防含描边），文字全在条内");
}

/* ---- 5. 四防留空：不画对应图形（AC 缺则无盾、缺圆则不画） ---- */
{
  const b = boundsOf(2, 2);
  const onlyAc = B.barLayout(b, 150, hpOf(60, 60, { ac: 18 }), { exact: true, threshold: 25 });
  if (onlyAc.defs.length === 0 && onlyAc.shield) ok("四防只有 AC：只画右下盾，不画左侧圆");
  else bad("四防只有 AC 时图形不对：" + JSON.stringify({ defs: onlyAc.defs.length, shield: !!onlyAc.shield }));
  const none = B.barLayout(b, 150, hpOf(60, 60, null), { exact: true, threshold: 25 });
  if (!none.defs.length && !none.shield) ok("四防留空 / null：不画任何四防图形");
  else bad("四防为空仍画了图形");
  const noAc = B.barLayout(b, 150, hpOf(60, 60, { fort: 15, reflex: 13, will: 12 }), { exact: true, threshold: 25 });
  if (noAc.defs.length === 3 && !noAc.shield) ok("缺 AC：画 3 圆、不画盾");
  else bad("缺 AC 时图形不对");
}

/* ---- 6. 玩家（非精确）：只显示比例、无数字、不画四防 ---- */
{
  const b = boundsOf(2, 2);
  const L = B.barLayout(b, 150, hpOf(30, 60, DEFS), { exact: false, threshold: 25 });
  if (!L.exact && !L.textVisible && L.hpText === "" && L.bar.ratio > 0 && L.bar.ratio <= 1 &&
    L.defs.length === 0 && !L.shield && L.showDefenses === false) {
    ok("玩家端：不显示数字 / 不画四防，仍按量化比例画填充条");
  } else bad("玩家端仍然显示了数字 / 四防：" + JSON.stringify({ text: L.hpText, textVisible: L.textVisible, defs: L.defs.length, shield: !!L.shield }));
}

/* ---- 7. 极小 token 降级：无 NaN、圆点不越界、文字装不下则隐藏 ---- */
{
  for (const [w, h] of [[1, 1], [4, 4], [10, 10]]) {
    const b = { min: { x: 0, y: 0 }, max: { x: w, y: h }, width: w, height: h, center: { x: w / 2, y: h / 2 } };
    const L = B.barLayout(b, 150, hpOf(1, 60, DEFS, 99), { exact: true, threshold: 25 });
    const badNum = firstBadNumber(L, "L");
    if (badNum) bad("极小 token " + w + "×" + h + "：非有限数 " + badNum);
    else if (L.textVisible && !insideBox([
      { x: L.hpTextX, y: L.hpTextY },
      { x: L.hpTextX + L.hpTextW, y: L.hpTextY + L.hpTextH }
    ], b)) bad("极小 token " + w + "×" + h + "：文字越界");
  }
  ok("极小 token（1×1 / 4×4 / 10×10，150 dpi 下 < 1s）：无 NaN，文字装不下会隐藏");
}

console.log(fail ? "\n" + fail + " 个问题" : "\n全部通过");
process.exit(fail ? 1 : 0);
