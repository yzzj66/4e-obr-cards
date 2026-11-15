// v1.8.0：角色卡的「场景 item」存储（双写里的**完整数据**层）。
// ---------------------------------------------------------------------------
// 为什么要有这个文件：
//   枭熊的**房间数据硬上限 16 KB**（room.setMetadata 超限直接报错，旧版本还会静默失败）。
//   v1.7.15 的应对是把卡压成 ~2KB 的精简格式塞房间 —— 房间是够用了，但**卡被砍掉了字段**。
//   v1.8.0 改成双写：
//     · 房间数据 ← 精简名单副本（够速览/绑定，跨场景可见，玩家可见，见 assets/common.js）；
//     · **当前场景的隐藏 item ← 完整 4E NEXT Character**（只去掉立绘，其它字段一个不丢，本文件负责）。
//
//   FullPeople/obr-suite 的做法是「卡体不落枭熊」（它有自己的服务器）。我们没有服务器，
//   所以按交接文件 §4 的结论走：**一张卡 = 一个不可见场景 item**，完整卡的 JSON 放在
//   item.metadata 里。场景 item 随场景存档走、全桌可见（玩家也能读），没有 16 KB 总额限制；
//   单个 item 的 metadata 也远没到上限（一张 4E 卡约 5KB）。
//
// 约定（与 background.core.js 的 classic 版同名常量必须一字不差，dev/check.mjs 会对比）：
//   CARD_ITEM_KEY = "com.4enext-owlbear/card"
//   item.metadata[CARD_ITEM_KEY] = { v: 1, card: { id, name, level, char, importedAt, exportedAt, updatedAt } }
//   其中 card.char 是完整的 4E NEXT Character（只去掉 portraitOriginal / portraitCropped）；
//   旧版本写进来的 pz===1 精简卡仍可读（itemToCard 会 unpackCard 还原）。
import OBR from "../vendor/obr-sdk.js";
import { unpackCard } from "./cards-core.js";

/* 建 item 用到的 buildText 是**动态** import 的：
 * 页面里只在这一刻需要它，而自测（node）里既没有 vendor/obr-sdk.js 也不需要建真 item。
 * 静态 import 会让「只想测纯函数」的自测被迫提供一份假的 builders。 */
let buildTextRef = null;
async function getBuildText() {
  if (buildTextRef) return buildTextRef;
  const mod = await import("../vendor/obr-sdk.js");
  buildTextRef = mod.buildText;
  return buildTextRef;
}


/** 场景 item 上挂卡片的 metadata 键（与 background.core.js 的 KEY_CARD_ITEM 一致）。 */
export const CARD_ITEM_KEY = "com.4enext-owlbear/card";

/** item → 卡片（恢复成页面直接用的大 Card 形状：char 是 4E NEXT Character）。 */
function itemToCard(item) {
  if (!item || !item.metadata) return null;
  const box = item.metadata[CARD_ITEM_KEY];
  if (!box || typeof box !== "object" || !box.card || typeof box.card !== "object") return null;
  const wire = box.card;
  const id = typeof wire.id === "string" ? wire.id : "";
  if (!id) return null;
  return {
    id: id,
    name: String(wire.name || "未命名角色"),
    level: typeof wire.level === "number" && isFinite(wire.level) ? wire.level : 1,
    char: wire.char && wire.char.pz === 1 ? unpackCard(wire.char) : wire.char,
    importedAt: typeof wire.importedAt === "number" ? wire.importedAt : 0,
    exportedAt: typeof wire.exportedAt === "string" ? wire.exportedAt : "",
    updatedAt: typeof wire.updatedAt === "number" ? wire.updatedAt : 0,
    itemId: item.id
  };
}

/** 卡片（大 Card）→ item.metadata 里那份 wire。
 *  v1.8.0：场景 item 里存**完整**的 4E NEXT Character（只去掉立绘 data URL），不再跑 packCard 精简。
 *  理由：房间数据只能放精简副本（16 KB），但场景 item 没有总额限制 —— 用户明确要求「别把卡砍到功能都没了」，
 *  所以完整数据（典范/传奇/主题/职业特性选择/glance 快照…）留在场景里，任何字段都不丢。 */
function cardToWire(card) {
  return {
    id: String(card && card.id ? card.id : ""),
    name: String(card && card.name ? card.name : "未命名角色"),
    level: card && typeof card.level === "number" ? card.level : 1,
    char: slimChar(card && card.char ? card.char : {}),
    importedAt: card && typeof card.importedAt === "number" ? card.importedAt : Date.now(),
    exportedAt: card && typeof card.exportedAt === "string" ? card.exportedAt : "",
    updatedAt: card && typeof card.updatedAt === "number" ? card.updatedAt : Date.now()
  };
}

/** 完整 Character 的浅瘦身：只去掉立绘（data URL，动辄几百 KB），其它字段原样保留。 */
function slimChar(char) {
  const copy = JSON.parse(JSON.stringify(char || {}));
  delete copy.portraitOriginal;
  delete copy.portraitCropped;
  return copy;
}

/** 场景里全部卡片 item（没卡片时返回 []，场景未就绪 / 权限不足也不抛）。 */
export async function listCardItems() {
  try {
    const items = await OBR.scene.items.getItems(function (i) {
      return !!(i && i.metadata && i.metadata[CARD_ITEM_KEY]);
    });
    return Array.isArray(items) ? items : [];
  } catch (e) {
    return [];
  }
}

/**
 * 读场景里的全部角色卡（按导入时间排）。
 * 读不到（场景未就绪、不是城主、被限制）时返回 []，由调用方决定降级。
 */
export async function readSceneCards() {
  const items = await listCardItems();
  const cards = [];
  for (const it of items) {
    const card = itemToCard(it);
    if (card) cards.push(card);
  }
  cards.sort(function (a, b) { return (a.importedAt || 0) - (b.importedAt || 0); });
  return cards;
}

/** 卡片 item 的显示名（城主在场景里选中时看得懂；玩家看不到这层）。 */
function cardItemName(card) {
  const nm = String((card && card.name) || "未命名角色").slice(0, 60);
  return "4E卡：" + nm;
}

/**
 * 把整份卡片列表写进当前场景（新增 / 更新 / 删除都覆盖）。
 * 返回 { ok, reason }：ok=false 时调用方必须继续降级（本机）并通知。
 */
export async function writeSceneCards(cards) {
  const list = Array.isArray(cards) ? cards : [];
  let existing = [];
  try {
    existing = await listCardItems();
  } catch (e) {
    return { ok: false, reason: "scene" };
  }
  const byCardId = new Map();
  for (const it of existing) {
    const box = it.metadata && it.metadata[CARD_ITEM_KEY];
    const id = box && box.card && typeof box.card.id === "string" ? box.card.id : "";
    if (id) byCardId.set(id, it.id);
  }
  const wanted = new Set();
  const toAdd = [];
  const toUpdate = [];
  for (const card of list) {
    if (!card || !card.id) continue;
    wanted.add(card.id);
    const wire = cardToWire(card);
    if (byCardId.has(card.id)) toUpdate.push({ itemId: byCardId.get(card.id), wire: wire });
    else toAdd.push(wire);
  }
  const toDelete = [];
  for (const [cardId, itemId] of byCardId) if (!wanted.has(cardId)) toDelete.push(itemId);

  try {
    if (toAdd.length) {
      const buildText = await getBuildText();
      const items = toAdd.map(function (wire) {
        return buildText()
          .plainText("")
          .position({ x: 0, y: 0 })
          .visible(false)
          .locked(true)
          .disableHit(true)
          .name(cardItemName(wire))
          .metadata({ [CARD_ITEM_KEY]: { v: 1, card: wire } })
          .build();
      });
      await OBR.scene.items.addItems(items);
    }
    if (toUpdate.length) {
      await OBR.scene.items.updateItems(toUpdate.map(function (x) { return x.itemId; }), function (items) {
        for (const it of items) {
          const hit = toUpdate.filter(function (x) { return x.itemId === it.id; })[0];
          if (!hit) continue;
          if (!it.metadata || typeof it.metadata !== "object") it.metadata = {};
          it.metadata[CARD_ITEM_KEY] = { v: 1, card: hit.wire };
          it.name = cardItemName(hit.wire);
        }
      });
    }
    if (toDelete.length) await OBR.scene.items.deleteItems(toDelete);
    return { ok: true, reason: "", added: toAdd.length, updated: toUpdate.length, removed: toDelete.length };
  } catch (e) {
    console.error("[4enext] 写场景角色卡失败", e);
    return { ok: false, reason: "scene", error: e };
  }
}

/** 清空当前场景里的卡片 item（设置窗口「清理角色卡」用）。 */
export async function clearSceneCards() {
  try {
    const items = await listCardItems();
    if (!items.length) return { ok: true, removed: 0 };
    await OBR.scene.items.deleteItems(items.map(function (i) { return i.id; }));
    return { ok: true, removed: items.length };
  } catch (e) {
    return { ok: false, error: e };
  }
}
