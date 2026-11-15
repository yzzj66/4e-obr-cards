// token 血条几何的离线自测（无浏览器 / 无 OBR / 不联网）
// ---------------------------------------------------------------------------
// 加载的是 **assets/background.core.js 的真实源码**（node:vm + 假 window/document/OBR 桩，
// 不打桩任何几何函数），再从 window.__4eBar 拿 barLayout / ringSectorPoints / shieldPoints /
// circlePoints / defShapePoints 与常数表，逐条核对 v1.8.0 的真机几何要求：
//   · 环形 HP（Ro = 半短边 − 2s、厚 7s、底环 0.35）所有点都在 token 包围盒内；
//   · 四角四防（直径 22s、贴角 8s）整枚（含 strokeWidth）都在包围盒内；
//   · HP 数字放在环内、自动降字号、长文本不裁切（装不下就整块隐藏而不是裁）；
//   · 0.5 格 / 1×2 / 4×4 与极小 token 的降级：无负半径、无 NaN；
//   · 血怒（bloodied：cur ≤ max/2）两段色。
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
if (!B || typeof B.barLayout !== "function") {
  console.log("  FAIL assets/background.core.js 末尾没有 window.__4eBar 调试钩子（barLayout 取不到）");
  process.exit(1);
}
ok("从真实源码拿到 window.__4eBar（barLayout / barSig / ringSectorPoints / CONSTANTS ...）");

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
const distToCenter = (p, b) => Math.hypot(p.x - b.center.x, p.y - b.center.y);

/* ---- 3. 常数：v1.8.0 目标值（s = 1 时精确） ---- */
{
  const L = B.barLayout(boundsOf(1, 1), 150, hpOf(20, 20, DEFS), { exact: true, threshold: 25 });
  const checks = [
    ["环厚 HP_RING_THICK", C.HP_RING_THICK, 7],
    ["底环不透明度 HP_RING_BG_OPACITY", C.HP_RING_BG_OPACITY, 0.35],
    ["四防圆直径 DEF_CIRCLE_DIAMETER", C.DEF_CIRCLE_DIAMETER, 22],
    ["AC 盾直径 SHIELD_DIAMETER", C.SHIELD_DIAMETER, 22],
    ["四防贴角 SHIELD_INSET", C.SHIELD_INSET, 8],
    ["环内缩 HP_RING_INSET", C.HP_RING_INSET, 2],
    ["环段数 HP_RING_SEGMENTS", C.HP_RING_SEGMENTS, 48]
  ];
  const wrong = checks.filter(([, got, want]) => got !== want);
  if (!wrong.length) ok("常数：环厚 7s / 底环 0.35 / 四防 22s / 贴角 8s / 环内缩 2s / 48 段");
  else bad("常数不对：" + wrong.map(([n, g, w]) => n + "=" + g + "（要 " + w + "）").join(" / "));

  const s1 = [
    ["scale", L.scale, 1], ["Ro", L.ring.Ro, 73], ["Ri", L.ring.Ri, 66], ["T", L.ring.T, 7],
    ["cornerInset", L.cornerInset, 8], ["d", L.d, 22], ["dAc", L.dAc, 22], ["dDef", L.dDef, 22]
  ];
  const badS1 = s1.filter(([, got, want]) => !near(got, want, 1e-9));
  if (!badS1.length) ok("s=1 精确几何：Ro=73（半短边 75 − 2）/ Ri=66 / T=7 / 四防 22 / 贴角 8");
  else bad("s=1 几何不对：" + badS1.map(([n, g, w]) => n + "=" + g + "（要 " + w + "）").join(" / "));
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
      const s = L.scale;

      /* 4.1 环：所有点（底环 + 血量环）都在包围盒内，半径非负 */
      const ringAll = [
        ...B.ringSectorPoints(L.ring.Ro, L.ring.Ri, 1, L.ring.segments),
        ...B.ringSectorPoints(L.ring.Ro, L.ring.Ri, L.ring.ratio, L.ring.segments)
      ].map((p) => ({ x: L.ring.cx + p.x, y: L.ring.cy + p.y }));
      ringPts += ringAll.length;
      if (!(L.ring.Ro >= 0 && L.ring.Ri >= 0 && L.ring.T >= 0)) {
        outBox++; bad(sizeName + " " + hpName + "：环半径/厚度为负（Ro=" + L.ring.Ro + " Ri=" + L.ring.Ri + "）");
      }
      if (!insideBox(ringAll, b)) {
        outBox++; bad(sizeName + " " + hpName + "：环有点越出包围盒（Ro=" + L.ring.Ro + " 半短边=" + Math.min(b.width, b.height) / 2 + "）");
      }
      if (!near(L.ring.T, 7 * s, 1e-9) && L.ring.Ro * 0.9 > 7 * s) {
        outBox++; bad(sizeName + " " + hpName + "：环厚 " + L.ring.T + " ≠ 7s=" + 7 * s);
      }

      /* 4.2 四防：整枚（含描边一半）都在包围盒内 */
      if (withDef) {
        if (!L.showDefenses || L.shields.length !== 4) {
          outBox++; bad(sizeName + " " + hpName + "：四防应显示 4 枚，实际 show=" + L.showDefenses + " 数=" + L.shields.length);
        }
        for (const sh of L.shields) {
          if (!near(sh.d, 22 * s, 1e-9)) {
            outBox++; bad(sizeName + " " + hpName + " " + sh.key + "：直径 " + sh.d + " ≠ 22s=" + 22 * s);
          }
          const strokeHalf = Math.max(0.6, sh.d * 0.04) / 2;
          const pts = B.defShapePoints(sh).map((p) => ({ x: sh.x - sh.d / 2 + p.x, y: sh.y - sh.d / 2 + p.y }));
          defPts += pts.length;
          if (!insideBox(pts, b, strokeHalf)) {
            outBox++;
            bad(sizeName + " " + hpName + " " + sh.key + "：四防（含描边）越出包围盒");
          }
        }
      } else if (L.shields.length || L.showDefenses) {
        outBox++; bad(sizeName + " " + hpName + "：没有四防数据却画了四防");
      }

      /* 4.3 HP 文字：在环内、不越包围盒、字号 ≥ 下限；装不下必须是隐藏而不是裁切 */
      if (L.textVisible) {
        textBoxes++;
        if (!(L.hpFont > 0 && L.hpTextW > 0 && L.hpTextH > 0)) {
          outBox++; bad(sizeName + " " + hpName + "：文字可见但宽高/字号为 0");
        }
        if (L.hpFont < 3 * s - 1e-9) outBox++, bad(sizeName + " " + hpName + "：字号 " + L.hpFont + " < 3s=" + 3 * s);
        const corners = [
          { x: L.hpTextX, y: L.hpTextY },
          { x: L.hpTextX + L.hpTextW, y: L.hpTextY },
          { x: L.hpTextX, y: L.hpTextY + L.hpTextH },
          { x: L.hpTextX + L.hpTextW, y: L.hpTextY + L.hpTextH }
        ];
        if (!insideBox(corners, b)) {
          outBox++; bad(sizeName + " " + hpName + "：HP 文字框越出包围盒");
        }
        const far = Math.max(...corners.map((p) => distToCenter(p, b)));
        if (far > L.ring.Ri + EPS) {
          outBox++; bad(sizeName + " " + hpName + "：HP 文字角距环心 " + far.toFixed(2) + " > Ri=" + L.ring.Ri.toFixed(2) + "（跑到环外）");
        }
      } else if (L.hpText !== "") {
        outBox++; bad(sizeName + " " + hpName + "：文字不可见但 hpText 非空（会被裁切）");
      }

      /* 4.4 血怒两段色 */
      const wantBloodied = cur <= max / 2;
      if (L.bloodied !== wantBloodied) {
        outBox++; bad(sizeName + " " + hpName + "：bloodied=" + L.bloodied + "，应为 " + wantBloodied);
      }
      const wantFill = wantBloodied ? C.COLOR_HP_BLOODIED : C.COLOR_HP_FILL;
      if (L.colorFill !== wantFill) {
        outBox++; bad(sizeName + " " + hpName + "：填充色 " + L.colorFill + "，应为 " + wantFill);
      }
      if (cur === max && !near(L.ratio, 1, 1e-9)) {
        outBox++; bad(sizeName + " " + hpName + "：满血 ratio=" + L.ratio + " ≠ 1");
      }
    }
  }
}
if (!nan) ok("主矩阵 " + cells + " 组：全字段无 NaN / Infinity");
if (!outBox) {
  ok("主矩阵 " + cells + " 组：环 " + ringPts + " 点 / 四防 " + defPts + " 点 / 文字框 " + textBoxes +
    " 个都在包围盒内（四防含描边），文字全部落在环内");
}

/* ---- 5. 四角分布：fort 左上 / reflex 右上 / will 左下 / ac 右下 ---- */
{
  const b = boundsOf(2, 2);
  const L = B.barLayout(b, 150, hpOf(60, 60, DEFS), { exact: true, threshold: 25 });
  const at = (k) => L.shields.find((s) => s.key === k);
  const cx = b.center.x, cy = b.center.y;
  const want = { fort: ["lt", true, true], reflex: ["rt", false, true], will: ["lb", true, false], ac: ["rb", false, false] };
  const wrong = [];
  for (const k of ["fort", "reflex", "will", "ac"]) {
    const sh = at(k);
    if (!sh) { wrong.push(k + " 缺失"); continue; }
    const [label, left, top] = want[k];
    if ((sh.x < cx) !== left || (sh.y < cy) !== top) wrong.push(k + "→(" + sh.x.toFixed(1) + "," + sh.y.toFixed(1) + ") 要 " + label);
  }
  if (!wrong.length) ok("四角分布：fort 左上 / reflex 右上 / will 左下 / ac 右下");
  else bad("四角分布不对：" + wrong.join(" / "));
  const keys = L.shields.map((s) => s.key).join(",");
  if (keys === "fort,reflex,will,ac") ok("四防绘制顺序 = DEF_ROW（fort,reflex,will,ac）");
  else bad("四防顺序不对：" + keys);
}

/* ---- 6. HP 文字：越长字号越小，且两者都在环内 ---- */
{
  const b = boundsOf(2, 2);
  const longL = B.barLayout(b, 150, hpOf(999, 999, null, 99), { exact: true, threshold: 25 });
  const shortL = B.barLayout(b, 150, hpOf(12, 20), { exact: true, threshold: 25 });
  if (longL.textVisible && shortL.textVisible && longL.hpFont < shortL.hpFont) {
    ok("HP 文字自动降字号：\"999/999 +99\" 字号 " + longL.hpFont.toFixed(2) + " < \"12/20\" 字号 " + shortL.hpFont.toFixed(2));
  } else {
    bad("HP 文字没有按长度降字号（long=" + longL.hpFont + " short=" + shortL.hpFont +
      " visible=" + longL.textVisible + "/" + shortL.textVisible + "）");
  }
  const b1 = boundsOf(1, 1);
  const long1 = B.barLayout(b1, 150, hpOf(999, 999, null, 99), { exact: true, threshold: 25 });
  const short1 = B.barLayout(b1, 150, hpOf(12, 20), { exact: true, threshold: 25 });
  if (long1.textVisible && short1.textVisible && long1.hpFont < short1.hpFont) {
    ok("1×1 同样：长文本字号 " + long1.hpFont.toFixed(2) + " < 短文本 " + short1.hpFont.toFixed(2) + "（都放得下）");
  } else {
    bad("1×1 长/短文本字号关系不对（long=" + long1.hpFont + " short=" + short1.hpFont + "）");
  }
}

/* ---- 7. 降级：窄 / 极小 token 丢四防、不出现负半径 / NaN ---- */
{
  const narrow = B.barLayout(boundsOf(1, 1, 50), 50, hpOf(20, 20, DEFS), { exact: true, threshold: 25 });
  if (narrow.showDefenses && narrow.shields.length === 1 && narrow.shields[0].key === "ac") {
    ok("窄 token（宽 < 2 枚四防）降级为只画右下 AC 盾（DEF_DROP 顺序 will→reflex→fort）");
  } else {
    bad("窄 token 降级不对：show=" + narrow.showDefenses + " shields=" + narrow.shields.map((s) => s.key).join(","));
  }
  const tiny = B.barLayout(boundsOf(1, 1, 20), 20, hpOf(20, 20, DEFS), { exact: true, threshold: 25 });
  if (!tiny.showDefenses && tiny.shields.length === 0 && !firstBadNumber(tiny, "tiny")) {
    ok("极小 token（1 枚都放不下）整组四防不画，且无 NaN / 负半径");
  } else {
    bad("极小 token 降级不对：show=" + tiny.showDefenses + " shields=" + tiny.shields.length);
  }
  const zero = B.barLayout({ min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0, center: { x: 0, y: 0 } },
    150, hpOf(10, 10, DEFS), { exact: true, threshold: 25 });
  if (!firstBadNumber(zero, "zero") && zero.ring.Ro >= 0 && zero.ring.Ri >= 0 && zero.hpTextW >= 0) {
    ok("0 尺寸 bounds：不抛异常、半径不为负、无 NaN（文字自动隐藏）");
  } else {
    bad("0 尺寸 bounds 出现 NaN / 负半径");
  }
  const tinyDef = B.barLayout(boundsOf(0.5, 0.5), 150, hpOf(5, 10, DEFS), { exact: true, threshold: 25 });
  if (tinyDef.showDefenses && tinyDef.shields.length === 4 &&
    tinyDef.shields.every((sh) => insideBox(
      B.defShapePoints(sh).map((p) => ({ x: sh.x - sh.d / 2 + p.x, y: sh.y - sh.d / 2 + p.y })),
      boundsOf(0.5, 0.5), Math.max(0.6, sh.d * 0.04) / 2))) {
    ok("0.5 格 token：四防仍完整落在包围盒内（inset 8s + 22s 也放得下）");
  } else {
    bad("0.5 格 token 四防越界或数量不对");
  }
}

/* ---- 8. 玩家端（exact=false）：不画数字、不画四防、比例量化 ---- */
{
  const L = B.barLayout(boundsOf(1, 1), 150, hpOf(37, 100, DEFS), { exact: false, threshold: 25 });
  if (!L.textVisible && !L.showDefenses && near(L.ratio, 0.5, 1e-9) && L.bloodied) {
    ok("玩家端（exact=false）：按 25% 量化到 50%、无数字 / 无四防、bloodied 仍为 true");
  } else {
    bad("玩家端量化/隐藏不对：ratio=" + L.ratio + " text=" + L.textVisible + " def=" + L.showDefenses + " bloodied=" + L.bloodied);
  }
}

/* ---- 9. barSig / barRolesKey 不会因血怒换色而失效 ---- */
{
  const b = boundsOf(1, 1);
  const a = B.barLayout(b, 150, hpOf(60, 60, DEFS), { exact: true, threshold: 25 });
  const c = B.barLayout(b, 150, hpOf(29, 60, DEFS), { exact: true, threshold: 25 });
  if (B.barSig(hpOf(60, 60, DEFS), a) !== B.barSig(hpOf(29, 60, DEFS), c)) {
    ok("barSig 会随 HP 变化（血怒换色因此能触发 patchBar 的增量刷新）");
  } else {
    bad("barSig 没有随 HP 变化（血怒换色不会被刷新）");
  }
  if (B.barRolesKey(a) === B.barRolesKey(c)) ok("barRolesKey 稳定（血怒只改颜色，不重建 item）");
  else bad("barRolesKey 因血怒而变化（会重建 item）");
}

console.log(fail ? "\n" + fail + " 条几何断言失败" : "\n全部通过（血条几何 / 血怒 / 降级；exit 0）");
process.exit(fail ? 1 : 0);
