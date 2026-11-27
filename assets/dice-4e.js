// v1.5.0：4E 预设（攻击 / 伤害 / 技能）——**只生成表达式，不判定命中**。
//
// v1.7.0：按用户要求**去掉「豁免」与「先攻」两组预设**——
//   · 豁免：4E 里就一个 1d20，手点一下 d20 就有了，专门做一组预设反而占地方；
//   · 先攻：先攻条（v1.4.0）已经自带「投先攻」，这里再来一组是重复功能。
//   保留攻击（vs 四防，四防数值仍作为「防御参考」显示）/ 伤害 / 技能三组。
// ---------------------------------------------------------------------------
// 硬规矩（docs/spec-dice.md §3.5）：
//   · 数值**只从 assets/glance.js 的推导结果里取**（四防 / 攻击 / 伤害 / 技能 / 先攻），
//     这里绝不重算 10 + 半等级 + … 之类的公式 —— 否则会出现"速览写 28、骰子写 27"；
//   · 用户拍板：**只显示点数**。这里没有 target / hit / 成功失败，
//     预设只负责把公式填进表达式框（四防数值作为「防御参考」单独返回，供界面显示）；
//   · 攻击 vs 四防：攻击表达式用 glance 的 attacks[].total，四防数值只在参考行里展示。
//
// 这个文件只被 dice-page.js 动态 import（有绑定卡时才加载，避免每次开骰子窗口都拉 190KB 规则）。

import { deriveGlance } from "./glance.js";

/** 紧凑加值：+5 / -3 / +0（用于标签文案）。 */
export function plus(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-" : "+") + Math.abs(v);
}

/** 表达式里的加值：" + 5" / " - 3" / ""（0 不写）。 */
export function modifierTerm(n) {
  const v = Math.round(Number(n) || 0);
  if (!v) return "";
  return (v > 0 ? " + " : " - ") + Math.abs(v);
}

/** 把加值接到基表达式后面：withModifier("1d20", 22) → "1d20 + 22"。 */
export function withModifier(base, n) {
  const b = String(base || "").trim() || "1d20";
  return b + modifierTerm(n);
}

/**
 * v2.4.33：track.loadState(cardId) 返回的是 **{ state, scope }**，临时命中 / 伤害在 `.state` 里。
 * 之前 dice-page 直接读 loadState 返回值（st.atkTemp）→ 永远 undefined → 联动恒为 0。
 * 这里集中剥一层，调用方只认这个 helper（也方便单测）。
 */
export function tempsFromLoaded(loaded) {
  const st = loaded && typeof loaded === "object" && loaded.state && typeof loaded.state === "object"
    ? loaded.state : {};
  return {
    atkTemp: Number.isFinite(st.atkTemp) ? st.atkTemp : 0,
    dmgTemp: Number.isFinite(st.dmgTemp) ? st.dmgTemp : 0
  };
}

/**
 * 生成三组预设（v1.7.0：豁免 / 先攻已去掉）。
 * 返回 {
 *   ok, name,
 *   defenses: [{ key, label, value }],           // AC / 强韧 / 反射 / 意志（参考值，不判定）
 *   groups: [{ key, label, items: [{ label, expr, mode, name?, trained? }] }]
 * }
 * groups 顺序固定：攻击 / 伤害 / 技能。
 */
export function presetsFor(char, rules, opts) {
  if (!char || typeof char !== "object") return { ok: false, name: "", defenses: [], groups: [] };
  const o = opts && typeof opts === "object" ? opts : {};
  const atkTemp = Number.isFinite(o.atkTemp) ? Math.round(o.atkTemp) : 0;
  const dmgTemp = Number.isFinite(o.dmgTemp) ? Math.round(o.dmgTemp) : 0;
  const tempTag = function (v) { return v ? "（临时 " + (v > 0 ? "+" : "-") + Math.abs(v) + "）" : ""; };
  const g = deriveGlance(char, rules, null);
  const name = String(char.name || "角色").trim() || "角色";

  const defenses = (g.defenses || []).map(function (d) {
    return { key: d.key, label: d.label, value: d.value };
  });

  const attacks = (g.attacks || []).slice(0, 6).map(function (a) {
    const title = String(a.label || "攻击").trim() || "攻击";
    /* v2.4.33：临时命中先加到 total 再 withModifier，表达式格式不变；非 0 时标签标注临时值。 */
    const total = a.total + atkTemp;
    return {
      label: title + " " + plus(total) + tempTag(atkTemp),
      name: title,
      expr: withModifier("1d20", total),
      mode: "attack"
    };
  });

  const damages = (g.damages || []).slice(0, 6).map(function (d) {
    const title = String(d.label || "武器").trim() || "武器";
    const dice = String(d.dice || "1d8").trim() || "1d8";
    const total = d.total + dmgTemp;
    const expr = withModifier(dice, total);
    return { label: title + " " + expr + tempTag(dmgTemp), name: title, expr: expr, mode: "damage" };
  });

  const skills = (g.skills || []).map(function (s) {
    return {
      label: s.name + (s.trained ? "（受训）" : "") + " " + plus(s.total),
      name: s.name,
      expr: withModifier("1d20", s.total),
      mode: "skill",
      trained: !!s.trained
    };
  });

  return {
    ok: true,
    name: name,
    defenses: defenses,
    groups: [
      { key: "attack", label: "攻击", items: attacks },
      { key: "damage", label: "伤害", items: damages },
      { key: "skill", label: "技能", items: skills }
    ]
  };
}
