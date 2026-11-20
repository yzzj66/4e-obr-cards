// v1.8.0：4E NEXT 导出文件解析（纯函数，无 import，Node 自测可直接测）。
// ---------------------------------------------------------------------------
// 4E NEXT 有两种「导出文件」，结构完全不同（权威说明见 notes/4enext-schema.md）：
//
//   ① 单角色「导出存档」（web/src/App.tsx 的 exportSave）：
//      { app:"4enext", format:1, exportedAt, pages:{ character, reserve, overview, background } }
//      · 只有 pages.character 是真数据；reserve/background 是 character.spellbook/backpack/creation 的副本；
//      · 一张文件 = 一张卡。
//
//   ② 全量「导出全部数据」（web/src/lib/backup.ts 的 buildBackup）：
//      { app:"4enext", kind:"backup", format:1, exportedAt, version, data:{ 键 → 原始字符串 }, bgImage }
//      · data["4enext.cards.v1"] 是 SavedCard[] 的 **JSON 字符串**，还要再 JSON.parse 一次；
//        每张卡 = { id, name, char, updatedAt }，char 是 4E NEXT 的 Character 形状；
//      · data["4enext.homebrewPools.v1"] 是私设资源包数组（JSON 字符串），
//        私设威能 / 专长 / 装备的 id 只有在这里才能解析出正文（官方词条库 data/rules.js 里没有）；
//      · activeCard / layout / glance-roll 是**裸字符串**，不是 JSON。
//
//   旧版只认 pages.character / {character} / 裸 Character，这里继续兼容（format = "raw"）。
//
// 统一输出：
//   { imports: [{ char, exportedAt, id?, name? }], format: "single"|"backup"|"raw", homebrew? }
//   · char 原样保留（未知字段如 paragonGrantedPowerIds 不报错、不丢字段）；
//   · id / name 只有全量备份里的 SavedCard 才有，mergeImports 用它给新卡定 id；
//   · homebrew 只有全量备份且带资源包时才有。
// 非法输入抛 Error，message 是中文（面板直接展示）。

export const APP_ID = "4enext";

/** 全量备份 data 里的角色卡数组键（与 4E NEXT lib/storage.ts 的 CARDS_KEY 一致）。 */
export const DATA_CARDS_KEY = "4enext.cards.v1";
/** 全量备份 data 里的私设资源包键。 */
export const DATA_HOMEBREW_KEY = "4enext.homebrewPools.v1";

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** 这个对象像不像 4E NEXT 的 Character（宽松：缺字段的旧卡也算）。 */
export function looksLikeCharacter(v) {
  return isObj(v) && (
    typeof v.name === "string" ||
    typeof v.level === "number" ||
    isObj(v.abilities) ||
    isObj(v.powerSlots)
  );
}

/**
 * 从「任意一层包裹」里取 Character：pages.character / {character} / 裸 Character。
 * SavedCard（{char: Character}）的 char 由调用方单独取，这里不认，避免和 Character 自身字段混淆。
 */
export function pickCharacter(item) {
  if (!isObj(item)) return null;
  if (isObj(item.pages) && isObj(item.pages.character) && looksLikeCharacter(item.pages.character)) return item.pages.character;
  if (isObj(item.character) && looksLikeCharacter(item.character)) return item.character;
  if (looksLikeCharacter(item)) return item;
  return null;
}

/** data 里某键的值可能是「JSON 字符串」也可能已经是对象/数组（手改备份 / 将来格式）；解析失败返回 undefined。 */
function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch (e) {
    return undefined;
  }
}

function homebrewOf(data) {
  if (!isObj(data)) return undefined;
  const pools = parseMaybeJson(data[DATA_HOMEBREW_KEY]);
  if (!Array.isArray(pools)) return undefined;
  const list = pools.filter(isObj);
  return list.length ? list : undefined;
}

function charOfSavedCard(item) {
  if (!isObj(item)) return null;
  if (!isObj(item.char) || !looksLikeCharacter(item.char)) return null;
  return {
    char: item.char,
    id: typeof item.id === "string" ? item.id : "",
    name: typeof item.name === "string" ? item.name : ""
  };
}

/** 全量备份 → 多张卡。 */
function parseBackupFile(obj) {
  const data = isObj(obj.data) ? obj.data : null;
  if (!data) throw new Error("这是 4E NEXT 的全量备份，但缺少 data（文件可能损坏）");
  let rawCards = parseMaybeJson(data[DATA_CARDS_KEY]);
  /* 容错：极少数手改备份会把 cards 包在 { cards:[…] } 里 */
  if (isObj(rawCards) && Array.isArray(rawCards.cards)) rawCards = rawCards.cards;
  if (rawCards === undefined && typeof data[DATA_CARDS_KEY] === "string") {
    throw new Error("备份里的 4enext.cards.v1 不是合法的 JSON（文件可能损坏）");
  }
  if (!Array.isArray(rawCards)) {
    throw new Error("这是 4E NEXT 的全量备份，但没有找到角色卡（4enext.cards.v1 缺失或格式不对）");
  }
  const exportedAt = typeof obj.exportedAt === "string" ? obj.exportedAt : "";
  const imports = [];
  for (const item of rawCards) {
    const hit = charOfSavedCard(item);
    if (!hit) continue;
    const out = { char: hit.char, exportedAt: exportedAt };
    if (hit.id) out.id = hit.id;
    if (hit.name) out.name = hit.name;
    imports.push(out);
  }
  if (!imports.length) throw new Error("备份里没有可用的角色卡（卡片数据为空或格式不对）");
  const result = { imports: imports, format: "backup" };
  const homebrew = homebrewOf(data);
  if (homebrew) result.homebrew = homebrew;
  return result;
}

/** 单角色「导出存档」→ 一张卡（pages.character 理论上恒为对象；数组是防手改的容错）。 */
function parseSingleFile(obj) {
  const ch = obj.pages.character;
  const exportedAt = typeof obj.exportedAt === "string" ? obj.exportedAt : "";
  const list = Array.isArray(ch) ? ch : [ch];
  const imports = [];
  for (const one of list) {
    if (looksLikeCharacter(one)) imports.push({ char: one, exportedAt: exportedAt });
  }
  if (!imports.length) throw new Error("pages.character 里没有角色数据（不是 4E NEXT 的「导出存档」文件）");
  return { imports: imports, format: "single" };
}

/** 旧行为 / 裸数据：Character、{character: Character}、或它们的数组。 */
function parseRawList(list) {
  const imports = [];
  for (const item of list) {
    const saved = charOfSavedCard(item);
    if (saved) {
      const out = { char: saved.char, exportedAt: typeof item.exportedAt === "string" ? item.exportedAt : "" };
      if (saved.id) out.id = saved.id;
      if (saved.name) out.name = saved.name;
      imports.push(out);
      continue;
    }
    const ch = pickCharacter(item);
    if (!ch) continue;
    imports.push({ char: ch, exportedAt: isObj(item) && typeof item.exportedAt === "string" ? item.exportedAt : "" });
  }
  if (!imports.length) throw new Error("没找到角色数据（需要 4E NEXT 的「导出存档」或「导出全部数据」文件）");
  return { imports: imports, format: "raw" };
}

/**
 * 解析 4E NEXT 导出文件的文本。
 * @param {string} text 文件全文
 * @returns {{imports: Array<{char: object, exportedAt: string, id?: string, name?: string}>, format: "single"|"backup"|"raw", homebrew?: object[]}}
 */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export function parse4eFile(text) {
  if (typeof text !== "string") throw new Error("没有拿到文件内容（请重新选择文件）");
  if (text.length > MAX_IMPORT_BYTES) throw new Error("导入文件太大（超过 8 MB），请拆分后再导入");
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) throw new Error("文件是空的，没有可导入的内容");

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error("不是合法的 JSON（请确认选的是 4E NEXT 导出的 .json 文件）");
  }
  if (data == null) throw new Error("文件里没有内容（JSON 是 null）");

  if (Array.isArray(data)) return parseRawList(data);
  if (!isObj(data)) throw new Error("不是 4E NEXT 的角色文件（JSON 顶层既不是对象也不是数组）");

  if (data.app === APP_ID && data.kind === "backup") return parseBackupFile(data);
  if (isObj(data.pages) && "character" in data.pages) return parseSingleFile(data);
  /* kind 缺失但结构像备份（手改 / 老版本）：data 里直接有 cards 键 */
  if (data.app === APP_ID && isObj(data.data) && (DATA_CARDS_KEY in data.data || DATA_HOMEBREW_KEY in data.data)) {
    return parseBackupFile(data);
  }
  if (data.app === APP_ID) {
    throw new Error("这是 4E NEXT 的文件，但没找到角色数据（需要「导出存档」的 pages.character 或「导出全部数据」的 data）");
  }

  const ch = pickCharacter(data);
  if (ch) return { imports: [{ char: ch, exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "" }], format: "raw" };
  throw new Error("没找到角色数据（需要 4E NEXT 的「导出存档」或「导出全部数据」文件）");
}
