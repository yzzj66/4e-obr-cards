// 从本机 4E NEXT 存档生成 samples/sample-card.json（导出格式，去掉立绘以免体积过大）
// 用法：node dev/make-sample.mjs [卡片序号，默认 1]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const STORE = process.env.FOUR_E_STORAGE || path.join(os.homedir(), "AppData/Roaming/4enext-desktop/storage.json");
const idx = parseInt(process.argv[2] || "1", 10);

const raw = JSON.parse(fs.readFileSync(STORE, "utf8"));
const cards = JSON.parse(raw["4enext.cards.v1"]);
const card = cards[idx];
if (!card) throw new Error("没有第 " + idx + " 张卡");
const char = JSON.parse(JSON.stringify(card.char));
delete char.portraitOriginal;
delete char.portraitCropped;

const save = {
  app: "4enext",
  format: 1,
  exportedAt: new Date(card.updatedAt || Date.now()).toISOString(),
  pages: {
    character: char,
    reserve: { spellbook: char.spellbook || [], backpack: char.backpack || [] },
    overview: {},
    background: char.creation || {},
  },
};

const out = path.join(ROOT, "samples", "sample-card.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(save, null, 2) + "\n", "utf8");
console.log("wrote", out, (fs.statSync(out).size / 1024).toFixed(1) + " KB", "|", char.name, "Lv" + char.level, char.raceId, char.classId);
