// v2.4.15：自绘骰子 SVG（不依赖任何外部资源）。返回内联 SVG 字符串，号码由调用方叠加。
const SHAPES = {
  d4: '<polygon points="50,6 94,88 6,88" />',
  d6: '<rect x="10" y="10" width="80" height="80" rx="10" />',
  d8: '<polygon points="50,4 94,50 50,96 6,50" />',
  d10: '<polygon points="50,4 88,42 68,94 32,94 12,42" />',
  d12: '<polygon points="50,4 92,28 92,72 50,96 8,72 8,28" />',
  d20: '<polygon points="50,3 94,27 94,73 50,97 6,73 6,27" /><polygon points="50,22 78,38 78,62 50,78 22,62 22,38" class="inner" />',
  d100: '<circle cx="50" cy="50" r="45" /><circle cx="50" cy="50" r="30" class="inner" />'
};
export function diceSvg(type, value) {
  const t = String(type || "d20").toLowerCase();
  const key = SHAPES[t] ? t : "d20";
  var pips = "";
  if (key === "d6") {
    var v = Math.max(1, Math.min(6, Math.round(Number(value) || 1)));
    var P = {
      1: [[50,50]], 2: [[30,30],[70,70]], 3: [[30,30],[50,50],[70,70]],
      4: [[30,30],[70,30],[30,70],[70,70]],
      5: [[30,30],[70,30],[50,50],[30,70],[70,70]],
      6: [[30,28],[70,28],[30,50],[70,50],[30,72],[70,72]]
    };
    pips = (P[v] || P[1]).map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="6.2" class="pip" />'; }).join("");
  }
  return '<svg class="fx-shape-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    '<g class="fx-shape-g">' + SHAPES[key] + pips + "</g></svg>";
}
export function diceSvgSizes() {
  return { d4: 0.72, d6: 0.9, d8: 0.86, d10: 0.9, d12: 0.94, d20: 1, d100: 1.08 };
}
export const DICE_TYPES = Object.keys(SHAPES);

/** v2.4.15：骰子外观改用用户提供的 PNG 素材（assets/dice/d4..d100.png，透明底）。
 *  返回内联 <img>，号码仍由 .fx-num 叠加在正中；未知类型回退 d20。 */
export function diceImage(type) {
  const t = String(type || "d20").toLowerCase();
  const key = SHAPES[t] ? t : "d20";
  return '<img class="fx-shape-img" src="assets/dice/' + key + '.png" alt="" decoding="async" draggable="false">';
}
/** v2.4.15：PNG 素材路径（测试/兜底用；effect 页相对根目录）。 */
export function diceImageSrc(type) {
  const t = String(type || "d20").toLowerCase();
  const key = SHAPES[t] ? t : "d20";
  return "assets/dice/" + key + ".png";
}

/** v2.4.15：多骰自适应布局（在 dice-core.fxLayout 的基础上按视口夹取，10+ 自动缩/换行）。 */
export function diceLayout(dice, vw, vh, opts) {
  const list = Array.isArray(dice) ? dice : [];
  const n = list.length;
  const width = Math.max(320, Math.round(vw || 1280));
  const height = Math.max(240, Math.round(vh || 720));
  const maxW = width * 0.84;
  const maxH = height * 0.62;
  /* 列数随数量与宽度变化：1~4 单行，5~8 两行，9~12 三行，13+ 四行。 */
  const cols = n <= 4 ? n : n <= 8 ? 4 : n <= 12 ? 4 : 4;
  const rows = Math.max(1, Math.ceil(n / cols));
  let base = n <= 1 ? 128 : Math.max(56, Math.round(128 * Math.pow(0.9, n - 1)));
  let gap = Math.round(base * 0.22);
  let rowH = base + gap;
  const needW = cols * base + (cols - 1) * gap;
  const needH = rows * rowH;
  const scale = Math.min(1, maxW / Math.max(1, needW), maxH / Math.max(1, needH));
  base = Math.max(40, Math.round(base * scale));
  gap = Math.round(base * 0.22);
  rowH = base + gap;
  const slots = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowW = inRow * base + (inRow - 1) * gap;
    const ox = -rowW / 2 + base / 2 + c * (base + gap);
    const oy = (r - (rows - 1) / 2) * rowH;
    slots.push({ index: i, ox: Math.round(ox), oy: Math.round(oy), size: base });
  }
  return { baseSize: base, gap, rowH, rowCount: rows, cols, slots, hidden: 0 };
}

/** v2.4.15：按骰子数/速度算动画总时长（900 + 180n，clamp 1200~3200；快速×0.6，关闭=500）。 */
export function diceFxDuration(n, speed) {
  const count = Math.max(1, Math.round(Number(n) || 1));
  const standard = Math.max(1200, Math.min(3200, 900 + 180 * count));
  if (speed === "off") return 500;
  if (speed === "fast") return Math.max(700, Math.round(standard * 0.6));
  return standard;
}
export function diceSpeed() {
  try {
    const v = localStorage.getItem("4enext/dice-speed");
    return v === "fast" || v === "off" ? v : "standard";
  } catch (e) { return "standard"; }
}
