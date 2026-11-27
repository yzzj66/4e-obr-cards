// v1.8.0 导入解析 + 数值正确性自测：node dev/test-import.mjs
// ---------------------------------------------------------------------------
// 这是「4E NEXT 导入」这条链路的价值证明：
//   ① 真文件解析：单角色「导出存档」与全量「导出全部数据」都要认，4E NEXT 的 SavedCard 形状
//      归一成 { char, exportedAt, id?, name? }；私设资源包（homebrewPools）一起带出来；
//   ② 数值口径证明：用真实 Lv30 样例跑 assets/glance.js 的 deriveGlance，断言与 4E NEXT 完全一致
//      （HP / 重伤 / 回复值 / 回复力 / 四防 / 先攻 / 速度 / 被动感知 / 技能）；
//   ③ 非法输入抛中文 Error，不崩；
//   ④ 面板 / 设置页的三态来源标签与新导入接线有静态回归（防止以后改回去把 check.mjs 弄红）。
//
// 样例优先用 D:\deepseek\refs\samples\（研究时从本机 4E NEXT 真实数据生成）；
// 没有就退化用仓库里的 dev/fixtures/（同样内容的副本），再没有就用 samples/sample-card.json，
// 保证在别人的机器上也能跑（不能因为外链路径不存在就直接失败）。
//
// 本测试不改 dev/selftest.mjs（那是另一名队友在改）；建议把 "dev/test-import.mjs" 加进步骤表。
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const REFS = "D:\\deepseek\\4eNEXT to Owlbear\\refs\\samples";
const FIX = path.join(ROOT, "dev", "fixtures");

let fail = 0;
const ok = (m) => console.log("  ok   " + m);
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const hasChinese = (s) => /[\u4e00-\u9fff]/.test(String(s || ""));

/* ---------------------------------------------------------------------------
 * 0) 把真模块拷到临时目录再 import：
 *    assets/*.js 没有 package.json（node 会按 CJS 解析），而浏览器页面用的是 ESM。
 *    import4e.js 无 import，直接改后缀；glance.js 只把 data/rules.js 的 import 换成绝对文件 URL。
 * ------------------------------------------------------------------------- */
const tmp = path.join(os.tmpdir(), "4enext-import-test");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

fs.copyFileSync(path.join(ROOT, "assets", "import4e.js"), path.join(tmp, "import4e.mjs"));
const rulesUrl = pathToFileURL(path.join(ROOT, "data", "rules.js")).href;
let glanceSrc = fs.readFileSync(path.join(ROOT, "assets", "glance.js"), "utf8");
glanceSrc = glanceSrc.replace('from "../data/rules.js"', "from " + JSON.stringify(rulesUrl));
fs.writeFileSync(path.join(tmp, "glance.mjs"), glanceSrc, "utf8");

const I = await import(pathToFileURL(path.join(tmp, "import4e.mjs")).href);
const G = await import(pathToFileURL(path.join(tmp, "glance.mjs")).href);

console.log("== 4E NEXT 导入解析（v1.8.0）");
if (typeof I.parse4eFile === "function") ok("import4e.js 导出 parse4eFile()");
else bad("import4e.js 没有导出 parse4eFile()");
{
  const src = fs.readFileSync(path.join(ROOT, "assets", "import4e.js"), "utf8");
  if (!/^\s*import\s/m.test(src)) ok("import4e.js 是纯函数模块（没有 import，Node 可直接测）");
  else bad("import4e.js 出现了 import（纯函数模块不应该依赖别的模块）");
}

/* ---------------------------------------------------------------------------
 * 1) 找样例（外链优先，仓库夹具兜底）
 * ------------------------------------------------------------------------- */
function firstExisting(list) {
  for (const p of list) if (fs.existsSync(p)) return p;
  return "";
}
const exportPath = firstExisting([
  path.join(REFS, "sample-4enext-export.json"),
  path.join(FIX, "4enext-lv30-ranger.json"),
  path.join(ROOT, "samples", "sample-card.json")
]);
const backupPath = firstExisting([
  path.join(REFS, "sample-4enext-fullbackup.json"),
  path.join(FIX, "4enext-backup.json")
]);
if (exportPath) ok("单角色样例：" + exportPath);
else bad("找不到单角色样例（refs/samples、dev/fixtures、samples 都没有）");
if (backupPath) ok("全量备份样例：" + backupPath);
else bad("找不到全量备份样例（refs/samples 与 dev/fixtures 都没有）");

/* ---------------------------------------------------------------------------
 * 2) 单角色「导出存档」
 * ------------------------------------------------------------------------- */
let ranger = null;
let single = null;
if (exportPath) {
  const text = fs.readFileSync(exportPath, "utf8");
  try {
    single = I.parse4eFile(text);
    ranger = single.imports[0].char;
  } catch (e) {
    bad("单角色导出解析失败：" + (e && e.message));
  }
}
if (single) {
  if (single.format === "single") ok('format = "single"（单角色导出）');
  else bad('format 应为 "single"，实际 ' + single.format);
  if (single.imports.length === 1) ok("imports 长度 1");
  else bad("imports 长度应为 1，实际 " + single.imports.length);
  if (single.imports[0].exportedAt) ok("exportedAt = " + single.imports[0].exportedAt);
  else bad("没有带出 exportedAt");
  if (!("id" in single.imports[0])) ok("单角色导出没有 SavedCard id（由 mergeImports 生成插件卡 id）");
  else bad("单角色导出不该有 id：" + single.imports[0].id);
  if (ranger && ranger.name === "申比软软" && ranger.level === 30) ok("角色：" + ranger.name + " Lv" + ranger.level);
  else bad("角色名 / 等级不对：" + (ranger && ranger.name) + " Lv" + (ranger && ranger.level));
  /* 未知字段不能被丢掉：真实导出带 paragonGrantedPowerIds 等当前 4E NEXT 源码类型里没有的字段 */
  const keys = ranger ? Object.keys(ranger).length : 0;
  if (keys >= 70) ok("Character 字段完整：" + keys + " 个键（未知字段原样保留）");
  else bad("Character 字段疑似被裁：" + keys + " 个键");
}

/* ---------------------------------------------------------------------------
 * 3) 数值口径：真实 Lv30 游侠必须与 4E NEXT / 研究笔记 §8 完全一致
 *    期望：HP 171 / 重伤 85 / 回复值 42 / 回复力 8 / AC 51 / 强 42 / 反 47 / 意 47
 *          先攻 25 / 速度 8 / 被动侦查 38 / 被动洞察 33
 * ------------------------------------------------------------------------- */
function defMap(d) {
  const out = {};
  (d.defenses || []).forEach((x) => { out[x.key] = x.value; });
  return out;
}
function skillMap(d) {
  const out = {};
  (d.skills || []).forEach((s) => { out[s.name] = s; });
  return out;
}
function assertDerived(d, label, want) {
  const def = defMap(d);
  const skills = skillMap(d);
  const checks = [
    ["HP 上限", d.maxHp, want.hpMax],
    ["当前 HP", d.hpCur, want.hpCur],
    ["重伤", d.bloodied, want.bloodied],
    ["回复值", d.surgeValue, want.surgeValue],
    ["回复力次数", d.surges, want.surges],
    ["AC", def.ac, want.ac],
    ["强韧", def.fort, want.fort],
    ["反射", def.ref, want.ref],
    ["意志", def.will, want.will],
    ["先攻", d.initiative, want.initiative],
    ["速度", d.speed, want.speed],
    ["被动侦查", d.passivePerception, want.passivePerception],
    ["被动洞察", d.passiveInsight, want.passiveInsight]
  ];
  for (const [name, got, exp] of checks) {
    if (got === exp) ok(label + " " + name + " = " + got);
    else bad(label + " " + name + " = " + got + "（应为 " + exp + "）");
  }
  for (const [name, exp] of Object.entries(want.skills || {})) {
    const hit = skills[name];
    if (hit && hit.total === exp) ok(label + " 技能 " + name + " = " + exp);
    else bad(label + " 技能 " + name + " = " + (hit ? hit.total : "缺失") + "（应为 " + exp + "）");
  }
  for (const name of want.trained || []) {
    const hit = skills[name];
    if (hit && hit.trained) ok(label + " 受训：" + name);
    else bad(label + " 应受训但没标：" + name);
  }
}

if (ranger) {
  const d = G.deriveGlance(ranger);
  assertDerived(d, "游侠", {
    hpMax: 171, hpCur: 171, bloodied: 85, surgeValue: 42, surges: 8,
    ac: 51, fort: 42, ref: 47, will: 47,
    initiative: 25, speed: 8, passivePerception: 38, passiveInsight: 33,
    skills: { "运动": 15, "坚韧": 16, "杂技": 29, "隐秘": 31, "盗术": 24, "医疗": 28, "侦查": 28, "自然": 25 },
    trained: ["杂技", "隐秘", "医疗", "侦查"]
  });
  if (d.hpTemp === 0) ok("游侠 临时 HP = 0");
  else bad("游侠 临时 HP 应为 0，实际 " + d.hpTemp);
  if (d.surgesCur === 8) ok("游侠 当前回复力 = 8");
  else bad("游侠 当前回复力应为 8，实际 " + d.surgesCur);
  const groups = d.powers.map((g) => [g.key, g.list.length]);
  const expectGroups = JSON.stringify([["atWill", 2], ["encounter", 4], ["daily", 4], ["utility", 7], ["special", 3]]);
  if (JSON.stringify(groups) === expectGroups) ok("威能 5 组共 20 个（随意2 / 遭遇4 / 每日4 / 辅助7 / 种族职业3）");
  else bad("威能分组不对：" + JSON.stringify(groups));
  if (d.feats.length === 19) ok("专长 19 条（18 个槽位 + 职业赠送「即时备战」）");
  else bad("专长条数应为 19，实际 " + d.feats.length);
  if (d.equipRows.length === 12) ok("装备 12 行（11 个固定槽 + 1 件奇物）");
  else bad("装备行数应为 12，实际 " + d.equipRows.length);
  if (d.attacks.length === 1 && d.attacks[0].total === 37) ok("攻击行 = 37");
  else bad("攻击行不对：" + JSON.stringify(d.attacks));
  if (d.damages.length === 1 && d.damages[0].dice === "1d4" && d.damages[0].total === 34) ok("伤害行 = 1d4+34");
  else bad("伤害行不对：" + JSON.stringify(d.damages));
  const known = d.known || {};
  if (known.cls && known.race && known.armor && known.shield) ok("职业 / 种族 / 护甲 / 盾牌词条全部命中（known 全 true）");
  else bad("有词条没命中：" + JSON.stringify(known));
  if (d.size === "中型" && d.vision === "昏暗视觉") ok("体型 / 视觉 = 中型 / 昏暗视觉");
  else bad("体型 / 视觉不对：" + d.size + " / " + d.vision);
  if (d.languages === "通用语、精灵语") ok("语言 = " + d.languages);
  else bad("语言不对：" + d.languages);
}

/* ---------------------------------------------------------------------------
 * 4) 全量「导出全部数据」：2 张真实卡 + 私设资源包
 *    yzzj（Lv30 龙裔 混职战士/圣武士）：HP 205 / 重伤 102 / 回复值 51 / 回复力 12
 *                                        AC 48 / 强 46 / 反 43 / 意 46 / 先攻 19 / 速度 5
 * ------------------------------------------------------------------------- */
let backup = null;
if (backupPath) {
  const text = fs.readFileSync(backupPath, "utf8");
  try {
    backup = I.parse4eFile(text);
  } catch (e) {
    bad("全量备份解析失败：" + (e && e.message));
  }
}
let yzzj = null;
if (backup) {
  if (backup.format === "backup") ok('format = "backup"（全量备份）');
  else bad('format 应为 "backup"，实际 ' + backup.format);
  if (backup.imports.length === 2) ok("一次解析出 2 张卡（多卡导入）");
  else bad("备份应解析出 2 张卡，实际 " + backup.imports.length);
  const names = backup.imports.map((x) => String(x.char.name || "").trim()).sort();
  if (JSON.stringify(names) === JSON.stringify(["yzzj", "申比软软"])) ok("卡片：" + names.join(" / "));
  else bad("卡片名字不对：" + JSON.stringify(names));
  const byName = {};
  backup.imports.forEach((x) => { byName[String(x.char.name || "").trim()] = x; });
  yzzj = byName.yzzj ? byName.yzzj.char : null;
  const sb = byName["申比软软"];
  if (byName.yzzj && byName.yzzj.id === "mvbu6dw86hhc8o") ok("yzzj 沿用 SavedCard id = " + byName.yzzj.id);
  else bad("yzzj 的 SavedCard id 没带出来：" + (byName.yzzj && byName.yzzj.id));
  if (sb && sb.id === "mwdm9gmf7r4cia") ok("申比软软 沿用 SavedCard id = " + sb.id);
  else bad("申比软软的 SavedCard id 没带出来：" + (sb && sb.id));
  if (byName.yzzj && byName.yzzj.exportedAt === backupPathExportAt(backupPath)) ok("导入项带出备份的 exportedAt");
  else if (byName.yzzj && byName.yzzj.exportedAt) ok("导入项带出 exportedAt = " + byName.yzzj.exportedAt);
  else bad("全量备份的导入项没有 exportedAt");
  /* 私设资源包：yzzj 用了「北风烈怒」「白金天兆」两个官方词条库里没有的 id，只能从这里解析 */
  if (Array.isArray(backup.homebrew) && backup.homebrew.length >= 1) ok("带出私设资源包 " + backup.homebrew.length + " 个");
  else bad("没有带出 homebrewPools（私设威能会解析不到）");
  const hbIds = new Set();
  (backup.homebrew || []).forEach((pool) => (pool.entries || []).forEach((e) => { if (e && e.id) hbIds.add(e.id); }));
  if (hbIds.has("北风烈怒") && hbIds.has("白金天兆")) ok("私设条目命中：北风烈怒 / 白金天兆");
  else bad("私设条目没带全：" + JSON.stringify([...hbIds].slice(0, 10)));
  if (yzzj && yzzj.hybrid === true && yzzj.classId2) ok("混职字段保留：hybrid=true / classId2=" + yzzj.classId2);
  else bad("混职字段丢了");
  /* 同一份备份里的第二张卡应与单角色样例数值一致 */
  if (sb && ranger) {
    const dsb = G.deriveGlance(sb.char);
    const dr = G.deriveGlance(ranger);
    if (dsb.maxHp === dr.maxHp && defMap(dsb).ac === defMap(dr).ac && dsb.initiative === dr.initiative)
      ok("备份里的申比软软与单角色样例推导一致（HP " + dsb.maxHp + " / AC " + defMap(dsb).ac + " / 先攻 " + dsb.initiative + "）");
    else bad("同一张卡两种入口推导不一致");
  }
}
function backupPathExportAt(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")).exportedAt || ""; } catch (e) { return ""; }
}
if (yzzj) {
  const d = G.deriveGlance(yzzj);
  assertDerived(d, "yzzj", {
    hpMax: 205, hpCur: 205, bloodied: 102, surgeValue: 51, surges: 12,
    ac: 48, fort: 46, ref: 43, will: 46,
    initiative: 19, speed: 5, passivePerception: 25, passiveInsight: 25,
    skills: { "运动": 29, "坚韧": 23, "市井": 26, "历史": 17, "威吓": 23 },
    trained: ["运动", "坚韧", "市井"]
  });
  if (d.attacks.length === 1 && d.attacks[0].total === 37) ok("yzzj 攻击行 = 37");
  else bad("yzzj 攻击行不对：" + JSON.stringify(d.attacks));
  if (d.damages.length === 1 && d.damages[0].dice === "1d10" && d.damages[0].total === 36) ok("yzzj 伤害行 = 1d10+36");
  else bad("yzzj 伤害行不对：" + JSON.stringify(d.damages));
}

/* ---------------------------------------------------------------------------
 * 5) 旧行为兼容：裸 Character / {character} / 数组 / SavedCard
 * ------------------------------------------------------------------------- */
if (ranger) {
  const cases = [
    ["裸 Character", ranger],
    ["{character: Character}", { character: ranger }],
    ["Character 数组", [ranger, ranger]]
  ];
  for (const [label, value] of cases) {
    try {
      const r = I.parse4eFile(JSON.stringify(value));
      const want = label === "Character 数组" ? 2 : 1;
      if (r.format === "raw" && r.imports.length === want) ok("兼容 " + label + "（format=raw，imports=" + want + "）");
      else bad("兼容 " + label + " 失败：" + r.format + " / " + r.imports.length);
    } catch (e) {
      bad("兼容 " + label + " 抛错：" + (e && e.message));
    }
  }
  /* SavedCard（旧面板/全量备份里的单卡形状）也要认 */
  try {
    const r = I.parse4eFile(JSON.stringify([{ id: "saved-1", name: "备份名", char: ranger, updatedAt: 1 }]));
    if (r.imports.length === 1 && r.imports[0].id === "saved-1" && r.imports[0].name === "备份名") ok("兼容 SavedCard 数组（id / name 带出）");
    else bad("SavedCard 兼容失败：" + JSON.stringify(r.imports[0] && Object.keys(r.imports[0])));
  } catch (e) {
    bad("SavedCard 兼容抛错：" + (e && e.message));
  }
}

/* ---------------------------------------------------------------------------
 * 6) 非法输入：抛中文 Error、不崩
 * ------------------------------------------------------------------------- */
const BAD_INPUTS = [
  ["空字符串", "", /空/],
  ["只有空白", "   \n\t ", /空/],
  ["不是 JSON", "hello 4E NEXT", /JSON/],
  ["JSON null", "null", /没有内容/],
  ["JSON 数字", "42", /不是 4E NEXT/],
  ["JSON 字符串", '"x"', /不是 4E NEXT/],
  ["空对象 {}", "{}", /没找到角色数据/],
  ["空数组 []", "[]", /没找到角色数据/],
  ["只有 app 标记", '{"app":"4enext"}', /没找到角色数据/],
  ["备份缺少 data", '{"app":"4enext","kind":"backup"}', /缺少 data/],
  ["备份 data 为空", '{"app":"4enext","kind":"backup","data":{}}', /没有找到角色卡/],
  ["备份 cards 不是合法 JSON", '{"app":"4enext","kind":"backup","data":{"4enext.cards.v1":"{"}}', /不是合法的 JSON/],
  ["备份 cards 为空数组", '{"app":"4enext","kind":"backup","data":{"4enext.cards.v1":"[]"}}', /没有可用的角色卡/],
  ["pages.character 不是角色", '{"app":"4enext","format":1,"pages":{"character":{}}}', /没有角色数据/]
];
let badInputPass = 0;
for (const [label, text, re] of BAD_INPUTS) {
  try {
    I.parse4eFile(text);
    bad("非法输入没有抛错：" + label);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (!(e instanceof Error)) bad("非法输入抛的不是 Error：" + label);
    else if (!hasChinese(msg)) bad("非法输入的报错不是中文：" + label + " → " + msg);
    else if (!re.test(msg)) bad("非法输入报错不匹配：" + label + " → " + msg);
    else badInputPass++;
  }
}
if (badInputPass === BAD_INPUTS.length) ok("非法输入全部抛中文 Error（" + badInputPass + "/" + BAD_INPUTS.length + "）");
else bad("非法输入用例通过 " + badInputPass + "/" + BAD_INPUTS.length);

/* ---------------------------------------------------------------------------
 * 7) 接线回归：面板 / 设置页 / common.js 的新行为（防止以后改回去）
 * ------------------------------------------------------------------------- */
{
  const commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  const panelSrc = fs.readFileSync(path.join(ROOT, "assets", "panel.js"), "utf8");
  const panelHtml = fs.readFileSync(path.join(ROOT, "panel.html"), "utf8");
  const setSrc = fs.readFileSync(path.join(ROOT, "assets", "settings-page.js"), "utf8");
  if (/import\("\.\/import4e\.js\?v=" \+ encodeURIComponent\(PLUGIN_VERSION\)\)/.test(commonSrc)) ok("common.js 的 parseExport 走 import4e.js（动态 import + ?v= 缓存破坏）");
  else bad("common.js 没有接上 import4e.js");
  if (/export async function parseExportFile\(text\)/.test(commonSrc)) ok("common.js 透出 parseExportFile（format / homebrew 给 UI 用）");
  else bad("common.js 缺少 parseExportFile");
  if (/imp\.id/.test(commonSrc) && /given && !next\.some/.test(commonSrc)) ok("mergeImports 沿用全量备份的 SavedCard id（不撞车时）");
  else bad("mergeImports 没有用 SavedCard id");
  /* check.mjs v1.7.15 静态断言要求这句逐字存在，三态用外层的 scene / room 分支实现 */
  if (/角色卡：' \+ \(cardsScope === "local" \? "本机" : "全桌"\)/.test(panelSrc)) ok("panel.js 保留 check.mjs 断言的那句「本机 / 全桌」表达式");
  else bad("panel.js 把 check.mjs 断言的表达式改掉了（check 会红）");
  for (const label of ["本场景", "（房间）", "全桌"]) {
    if (panelSrc.indexOf(label) >= 0) ok("panel.js 三态标签包含「" + label + "」");
    else bad("panel.js 三态标签缺少「" + label + "」");
  }
  if (panelSrc.indexOf('id="v-export"') >= 0 && /function exportCard\(/.test(panelSrc)) ok("panel.js 有「导出 JSON」按钮 + exportCard()");
  else bad("panel.js 没有导出卡片 JSON 的按钮/函数");
  if (/await parseExport\(/.test(panelSrc)) ok("panel.js 按异步方式调用 parseExport");
  else bad("panel.js 没有 await parseExport（解析现在是异步的）");
  if (panelHtml.indexOf("导出全部数据") >= 0) ok("panel.html 文案写了「导出全部数据」");
  else bad("panel.html 文案没提全量备份");
  if (setSrc.indexOf("本场景") >= 0 && setSrc.indexOf("全桌（房间）") >= 0) ok("settings-page.js 来源标签三态同步");
  else bad("settings-page.js 来源标签没同步三态");
}

/* ---------------------------------------------------------------------------
 * 8) 真实页面路径回归：common.js 的异步 parseExport（动态 import + ?v=）+ mergeImports
 *    做法同 test-track / test-cards：把真 common.js / cards-core.js / cards-scene.js 拷到临时目录，
 *    只把 vendor 的 OBR import 换成桩；调用的是**真代码**，不是复制一份逻辑。
 * ------------------------------------------------------------------------- */
if (exportPath && backupPath) {
  const ctmp = path.join(os.tmpdir(), "4enext-import-common-test");
  fs.rmSync(ctmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(ctmp, "assets"), { recursive: true });
  fs.writeFileSync(path.join(ctmp, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  fs.writeFileSync(path.join(ctmp, "obr-stub.mjs"), "export default globalThis.__OBR__;\n", "utf8");
  globalThis.__OBR__ = { room: {}, scene: { items: {} } };
  for (const f of ["cards-core.js", "import4e.js"]) {
    fs.copyFileSync(path.join(ROOT, "assets", f), path.join(ctmp, "assets", f));
  }
  let sceneSrc = fs.readFileSync(path.join(ROOT, "assets", "cards-scene.js"), "utf8");
  sceneSrc = sceneSrc.replace('from "../vendor/obr-sdk.js"', 'from "../obr-stub.mjs"');
  fs.writeFileSync(path.join(ctmp, "assets", "cards-scene.js"), sceneSrc, "utf8");
  let commonSrc = fs.readFileSync(path.join(ROOT, "assets", "common.js"), "utf8");
  commonSrc = commonSrc.replace('from "../vendor/obr-sdk.js"', 'from "../obr-stub.mjs"');
  fs.writeFileSync(path.join(ctmp, "assets", "common.js"), commonSrc, "utf8");

  try {
    const C = await import(pathToFileURL(path.join(ctmp, "assets", "common.js")).href);
    const exportText = fs.readFileSync(exportPath, "utf8");
    const backupText = fs.readFileSync(backupPath, "utf8");
    const imps = await C.parseExport(exportText);
    if (imps.length === 1 && imps[0].char.name === "申比软软") ok("common.js parseExport（异步）能解析单角色导出");
    else bad("common.js parseExport 解析单角色导出失败");
    const parsed = await C.parseExportFile(backupText);
    if (parsed.format === "backup" && parsed.imports.length === 2 && Array.isArray(parsed.homebrew)) ok("common.js parseExportFile 能解析全量备份（2 张卡 + 私设包）");
    else bad("common.js parseExportFile 解析全量备份失败");
    const merged = C.mergeImports([], parsed.imports);
    const wantIds = parsed.imports.map((x) => x.id).sort().join(",");
    const gotIds = merged.cards.map((c) => c.id).sort().join(",");
    if (merged.added === 2 && merged.updated === 0 && gotIds === wantIds) ok("mergeImports：新卡沿用全量备份里的 SavedCard id（" + gotIds + "）");
    else bad("mergeImports 新卡 id 不对：" + gotIds + "（应为 " + wantIds + "）");
    const again = C.mergeImports(merged.cards, parsed.imports);
    const idsStable = JSON.stringify(again.cards.map((c) => c.id)) === JSON.stringify(merged.cards.map((c) => c.id));
    if (again.added === 0 && again.updated === 2 && idsStable) ok("mergeImports：同一份备份再导入 = 同名更新、不重复、旧 id 保留");
    else bad("mergeImports 同名更新不对：added=" + again.added + " updated=" + again.updated + " idsStable=" + idsStable);
    const old = [{ id: "old-plugin-id", name: "申比软软", level: 30, char: merged.cards.find((c) => c.name === "申比软软").char, importedAt: 1, exportedAt: "" }];
    const kept = C.mergeImports(old, parsed.imports);
    const keepCard = kept.cards.filter((c) => c.name === "申比软软")[0];
    if (keepCard && keepCard.id === "old-plugin-id") ok("mergeImports：同名卡合并时保留旧插件卡 id（绑定关系不丢）");
    else bad("mergeImports 同名合并把旧 id 换掉了：" + (keepCard && keepCard.id));
    try {
      await C.parseExport("{}");
      bad("common.js parseExport 对非法输入没有抛错");
    } catch (e) {
      if (hasChinese(e.message)) ok("common.js parseExport 对非法输入抛中文错误：" + e.message);
      else bad("common.js parseExport 的报错不是中文");
    }
  } catch (e) {
    bad("common.js 集成回归失败：" + (e && e.message));
  }
}

/* ---------------------------------------------------------------------------
 * 9) 仓库夹具（dev/fixtures）必须能解析（别人机器上不依赖 D:\deepseek\refs）
 * ------------------------------------------------------------------------- */
{
  const fx1 = path.join(FIX, "4enext-lv30-ranger.json");
  const fx2 = path.join(FIX, "4enext-backup.json");
  if (!fs.existsSync(fx1) || !fs.existsSync(fx2)) bad("缺少 dev/fixtures 测试夹具（4enext-lv30-ranger.json / 4enext-backup.json）");
  else {
    const a = I.parse4eFile(fs.readFileSync(fx1, "utf8"));
    const b = I.parse4eFile(fs.readFileSync(fx2, "utf8"));
    if (a.format === "single" && a.imports.length === 1) ok("夹具 4enext-lv30-ranger.json 解析正常");
    else bad("夹具 4enext-lv30-ranger.json 解析不对");
    if (b.format === "backup" && b.imports.length === 2) ok("夹具 4enext-backup.json 解析正常（2 张卡）");
    else bad("夹具 4enext-backup.json 解析不对");
    const d = G.deriveGlance(a.imports[0].char);
    if (d.maxHp === 171 && defMap(d).ac === 51) ok("夹具推导数值与 4E NEXT 一致（HP 171 / AC 51）");
    else bad("夹具推导数值不一致：" + d.maxHp + " / " + defMap(d).ac);
  }
}

/* v2.4.15：真实新版导出（含 combatMods.damages[].dieUp）—— 能导入且第一项伤害骰 = 1d6 */
{
  const newFx = path.join(FIX, "申比软软-new.json");
  if (!fs.existsSync(newFx)) {
    ok("v2.4.15：真实新版导出文件不存在 → 跳过（不依赖用户文件）");
  } else {
    try {
      const r = I.parse4eFile(fs.readFileSync(newFx, "utf8"));
      const charNew = r.imports[0] && r.imports[0].char;
      const dNew = charNew ? G.deriveGlance(charNew) : null;
      const firstDie = dNew && dNew.damages[0] ? dNew.damages[0].dice : "";
      if (r.format === "single" && r.imports.length === 1 && firstDie === "1d6")
        ok("v2.4.15：真实新版导出可导入，第一项伤害骰 = 1d6（dieUp=1）");
      else bad("v2.4.15：真实新版导出导入 / 伤害骰不对：" + JSON.stringify({ format: r.format, n: r.imports.length, firstDie }));
    } catch (e) {
      bad("v2.4.15：真实新版导出解析抛错：" + (e && e.message ? e.message : e));
    }
  }
}

/* ---- v2.4.15：野蛮人「蛮族机敏」AC/反射 +1/+2/+3 ---- */
{
  const mk = (level, classId, armor) => ({
    level, classId, raceId: "", hybrid: false,
    abilities: { str: 10, con: 10, dex: 10, int: 10, wis: 10, cha: 10 },
    baseItems: armor ? { 5: armor } : {}, customBonuses: {}, defenseMods: {}, classFeatureChoices: ""
  });
  const defOf = (ch) => { const d = G.deriveGlance(ch); const o = {}; d.defenses.forEach(x => o[x.key] = x.value); return o; };
  const b3 = defOf(mk(3, "野蛮人 Barbarian"));
  const f3 = defOf(mk(3, "战士 Fighter"));
  if (b3.ac === f3.ac + 1 && b3.ref === f3.ref + 1)
    ok("v2.4.15：3 级野蛮人（轻甲/无甲）AC/反射各 +1（蛮族机敏）");
  else bad("v2.4.15：3 级蛮族机敏不对：" + JSON.stringify({ b3, f3 }));
  const b11 = defOf(mk(11, "野蛮人 Barbarian"));
  const f11 = defOf(mk(11, "战士 Fighter"));
  const b21 = defOf(mk(21, "野蛮人 Barbarian"));
  const f21 = defOf(mk(21, "战士 Fighter"));
  if (b11.ac === f11.ac + 2 && b11.ref === f11.ref + 2 && b21.ac === f21.ac + 3 && b21.ref === f21.ref + 3)
    ok("v2.4.15：11 级 +2、21 级 +3（AC/反射）");
  else bad("v2.4.15：11/21 级加值不对");
  const plate = defOf(mk(3, "野蛮人 Barbarian", "a:链甲 Chainmail"));
  const plateF = defOf(mk(3, "战士 Fighter", "a:链甲 Chainmail"));
  if (plate.ac === plateF.ac && plate.ref === plateF.ref)
    ok("v2.4.15：穿重甲（链甲）不享受蛮族机敏");
  else bad("v2.4.15：重甲仍加蛮族机敏");
  const bers = defOf(mk(3, "野蛮人（狂战士） Barbarian (Berserker)"));
  if (bers.ac === f3.ac && bers.ref === f3.ref)
    ok("v2.4.15：狂战士不享有蛮族机敏");
  else bad("v2.4.15：狂战士错误获得蛮族机敏");
  const hybridNo = defOf(mk(3, "混职野蛮人 Hybrid Barbarian"));
  if (hybridNo.ac === f3.ac && hybridNo.ref === f3.ref)
    ok("v2.4.15：混职野蛮人未选天赋时不加");
  else bad("v2.4.15：混职野蛮人无条件加值");
}

/* ---- v2.4.15：种族/职业固定防御加值（脱敏 fixture 回归） ---- */
{
  const fixDir = path.join(ROOT, "dev", "fixtures");
  const barb = JSON.parse(fs.readFileSync(path.join(fixDir, "character-barbarian-lv3.json"), "utf8"));
  const warlord = JSON.parse(fs.readFileSync(path.join(fixDir, "character-warlord-lv3.json"), "utf8"));
  const def = (ch) => { const d = G.deriveGlance(ch); const o = {}; d.defenses.forEach(x => o[x.key] = x.value); return o; };
  const b = def(barb), w = def(warlord);
  if (b.ac === 16 && b.fort === 19 && b.ref === 13 && b.will === 12)
    ok("v2.4.15：不死人 fixture AC16 / 强韧19 / 反射13 / 意志12（穆尔人不吃人类 +1）");
  else bad("v2.4.15：不死人回归失败：" + JSON.stringify(b));
  if (w.ac === 21 && w.fort === 18 && w.ref === 22 && w.will === 15)
    ok("v2.4.15：费兹 fixture AC21 / 强韧18 / 反射22 / 意志15（人类三防 +1，选择型职业防御默认不加）");
  else bad("v2.4.15：费兹回归失败：" + JSON.stringify(w));
  const rulesText = fs.readFileSync(path.join(ROOT, "data", "rules.js"), "utf8");
  if (/"人类 Human":\[[^\]]*?,1,1,1,/.test(rulesText) &&
    /"混职游荡者（恶棍） Hybrid Rogue \(Scoundrel\)":\[[^\]]*?,0,1,0,/.test(rulesText) &&
    /"混职督军（元帅） Hybrid Warlord \(Marshal\)":\[[^\]]*?,0,0,0,0,/.test(rulesText))
    ok("v2.4.15：rules 数据 人类 1/1/1、混职游荡者反射+1、混职督军选择型默认 0");
  else bad("v2.4.15：rules 防御列不对");
}

/* ---- v2.4.15：导入大小上限 ---- */
{
  try {
    I.parse4eFile("x".repeat(8 * 1024 * 1024 + 1));
    bad("v2.4.15：8MB 以上导入未拒绝");
  } catch (e) {
    if (/8 MB|太大/.test(String(e && e.message))) ok("v2.4.15：导入文本 >8MB 抛中文错误");
    else bad("v2.4.15：大小错误文案不对：" + (e && e.message));
  }
}

console.log(fail ? "\n" + fail + " 条断言失败" : "\n全部通过（4E NEXT 导入解析 + 真实样例数值口径，exit 0）");
process.exit(fail ? 1 : 0);
