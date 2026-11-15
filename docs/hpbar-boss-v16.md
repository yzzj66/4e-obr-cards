# v1.6.0 血条扩展（临时生命 / 四防 / 蓝条）+ Boss 样式（方案 A）

> 实现说明。规格见 [`spec-hpbar-boss.md`](spec-hpbar-boss.md)（**本任务不改规格文件**）。
> 代码落点：`assets/background.core.js` 第 7 节（画布层）、`assets/track.js`（读写与动作语义）、
> `assets/glance.js` + `assets/glance.css`（速览面板）、`assets/info.js`（速览刷新时补写）。
> 版本 `1.6.1`（v1.6.0 的真机已验证血条能画；v1.6.1 **只**把四防从四角改成一排）；
> `node dev/selftest.mjs` 全绿（check / test-background / test-initiative / test-track / test-dice）。
>
> **v1.6.1 一句话**：四防从「token 四角」改成「**一排**」——强韧 / 反射 / 意志 从左到右 + **AC 最右（半透明白色图标）**，
> 整排贴在 HP 红条上方（参考 Full Suite 图 2）。HP 文本 / 蓝条 / 环 / Boss / 锁的数值与位置**一个字没动**。
> 详见 §0.5；常数见 §3；几何见 §4。

---

## 0. 一句话

v1.5.0 只有「HP 胶囊条 + cur/max +temp」。v1.6.0 在同一枚 token 上补齐：

- **HP 红条**（20s）+ 临时生命 `+N`（红字在右侧，`144/144 +7` 那样）；
- **蓝色回复力条**（12s）在 HP 条下方，间距 3s，共用 left / w（`13/13`）；
- **四防一排**（强韧 / 反射 / 意志 从左到右 + AC 最右，直径 30s 的盾 + 数字；v1.6.1 从四角改成一排）；
- 右键 **「添加血条组件 / 移除血条组件」**、**「显示为 Boss / 隐藏 Boss 血条」**；
- **Boss 样式（方案 A：token 附带）**：48 段环形血条 + 名牌 + 分段线 + 锁，并压制普通 HP 条。

方案 B（全屏透明 modal + 屏底条）**没做**（规格 §7 定为 P4 可选；本版只交付方案 A）。

---

## 0.5 v1.6.1：四防改一排（本版唯一改动）

真机 v1.6.0 已跑通（用户截图：四角 51/42/47/47 + HP 红条 171/171 + 蓝条 8/8）。v1.6.1 只改**四防的摆位与样式**：

| 项目 | v1.6.0（旧） | v1.6.1（新） |
| --- | --- | --- |
| 位置 | token **四角**（AC 左上 / 强韧 右上 / 反射 左下 / 意志 右下） | **一排**，整排在 **HP 红条上方** gap（3s）处 |
| 顺序 | 按 `DEF_KEYS` 的读取顺序占四角 | **固定 强韧 → 反射 → 意志 → AC**（不按数值排），**AC 永远最右** |
| 间距 | 四角靠 token 内边（inset 4s） | 圆心间距 = 盾直径 + `DEF_GAP`(6s)；整排以 token 中线居中，右缘不越出条的右缘 |
| AC 样式 | 蓝色实心盾（`#3498db` @0.9） | **半透明白色图标**：fill `#ffffff` @0.18 + 白色描边 @0.85（数字白字黑描边 @0.85） |
| 三防样式 | 橙 / 绿 / 紫实心盾 @0.9 | 不变（`#e3b341` / `#56d364` / `#a371f7` @0.9，描边白 @0.45） |
| 窄 token 退化 | 宽度 < 2d + 4·inset 或 yB ≤ yT → **四枚全不画** | **优先保留 AC**，再依次丢意志 / 反射 / 强韧（见 §3 退化规则） |

**没动的**：HP 条（`BAR_HP_H` / `BAR_SURGE_H` / `BAR_GAP` / `BAR_PAD` 与 `hpTop` / `surgeTop` 公式）、
HP 文本内容与位置、蓝色回复力条、Boss 环 / 名牌 / 分段 / 锁的全部数值与位置、zIndex 表、玩家端 `locked` 口径。
Boss 环形态下这一排照旧在 HP 条（此时被压制隐藏）的上方、按 zIndex 15000 画在环（9800）之上。

---

## 1. 数据模型

### 1.1 token 元数据 `com.4enext-owlbear/hp`（只加字段，不改旧键）

```ts
interface HpMetaV2 {
  cur: number | null;          // 旧
  max: number | null;          // 旧
  temp: number;                // 旧
  surges: number | null;       // 旧：剩余回复力
  updatedAt: number;           // 旧

  surgesMax?: number;          // 新：回复力上限（画 "5/6" 的分母）
  defenses?: {                 // 新：四防（token 上一律用 reflex，卡里的 ref 在 track.js 换算）
    ac?: number; fort?: number; reflex?: number; will?: number;
  };
  boss?: boolean | {           // 新：Boss 开关（布尔与对象都接受，读取时统一归一化）
    enabled: boolean; segments?: number; phase?: string; exact?: boolean; order?: number;
  };
  locked?: boolean;            // 新：玩家端隐藏精确数值（默认 true）
}
```

**读写规则**

| 字段 | 规则 |
| --- | --- |
| `surgesMax` | 写盘时取 `max(1, round)`；缺省时画布层把分母回落 `max(surges,1)` 并把蓝条画满、只显示一个数字 |
| `defenses.*` | 只收数字；缺哪一项就不画那一枚盾；卡里的 `ref` → token 上的 `reflex` **只在 `track.js#defensesFromDerived` 换算一处** |
| `boss` | `true` / `false` / `{enabled,segments,phase,exact,order}` 都读；写回一律对象（以后加字段不用二次迁移） |
| `locked` | `raw.locked !== false` → 默认 `true`；只有 GM / token 创建者能改 |

### 1.2 独立开关 `com.4enext-owlbear/hp-bar/enabled`

**不塞进 `hp`**（`hp` 是数值容器，写开关会误触发 `readHpMeta()` 的判空，也不利于「有数据但不想显示」）。

| 值 | 行为 |
| --- | --- |
| `undefined`（老 token） | **照旧画**（升级不消失） |
| `true` | 画 |
| `false` | 不画；右键「移除血条组件」写的就是 `false`，**绝不 delete** |

> 为什么不能 delete：画布层的兼容判断用「=== undefined → 老 token」。delete 之后下次刷新又会被当成老 token 画回来。
> 菜单 filter 也必须用 `operator:"!=", value:true` 才能同时覆盖 `undefined` 与 `false`。

### 1.3 玩家端阈值

场景元数据 `com.4enext-owlbear/settings.playerThreshold`（缺省 **25**，按 25% 阶梯**向上**取整）。
这块只影响「这台机器画什么」，**不是加密**：token metadata 对全桌可读，锁上只是不画精确数字（规格 §6.8 的提醒）。

---

## 2. 渲染解剖（画布层，`OBR.scene.local`）

每枚 token 挂若干本地子 item：`ATTACHMENT` 层、`attachedTo`、`locked`、`disableHit`、
`disableAutoZIndex`、`disableAttachmentBehavior(["SCALE","ROTATION","LOCKED","COPY"])`。
**SDK 3.1.0 没有 RING / 盾牌 / 多边形图元**（`ShapeType` 只有 RECTANGLE / CIRCLE / TRIANGLE / HEXAGON），
所以环、盾、锁梁、名牌全部用 `buildCurve().points()` 手绘，**没有用 buildShape**。

### 2.1 role 表（`metadata["com.4enext-owlbear/bar"] = { owner, role, key?, index? }`）

| role | zIndex | 内容 | 何时存在 |
| --- | --- | --- | --- |
| `ring-bg` | 9500 | 环形底（#0b0f14 @0.55） | Boss |
| `ring-fill` | 9800 | 环血量弧（#a52424 @0.9） | Boss |
| `bar-bg` | 10000 | HP 胶囊底（#A4A4A4 @0.6） | 有 hp |
| `surge-bg` | 10500 | 回复力蓝条底（#1a222c @0.85） | 有 surges |
| `plate` | 12000 | Boss 名牌底 | Boss |
| `plate-text` | 12400 | Boss 名字（14s） | Boss |
| `plate-phase` | 12450 | 阶段（10s，#e3b341；牌太窄时省略） | Boss 且 phase 非空 |
| `shield` | 15000 | 四防盾（最多 4 枚，**v1.6.1 起是一排**：fort/reflex/will 实色 + AC 半透明白） | 有 defenses 且这一排放得下 |
| `shield-text` | 16000 | 四防数字（最多 4 个，与盾一一对应，`key` 同上） | 同上 |
| `bar-fill` | 20000 | HP 填充（#a52424 @0.85） | 有 hp |
| `surge-fill` | 20500 | 回复力填充（#58a6ff @0.9） | 有 surges |
| `divider` | 22000 | 分段线（≤4，画在环上） | Boss 且 segments>1 |
| `bar-text` | 30000 | `cur/max +temp` | 有 hp |
| `surge-text` | 30500 | `s/max`（缺分母只写 s） | 有 surges |
| `lock-body` / `lock-shackle` | 31000 / 31050 | 锁（锁体 + 锁梁） | Boss |

单 token 件数：HP 3 → +蓝条 3 = 6 → +四防 8 = 14 → Boss 再 +2 环 +2/3 牌 +2 锁 + (segments−1) 分段 ≈ 20~23。
**只在有数据时创建**；`sig` 没变一次写都不发；角色集合变了（开关 Boss / 改分段 / 有无盾）才整体重建。

### 2.2 状态签名（`barSig`）与增量更新

```js
sig = [cur, max, temp, surges, surgesMax, defenses.join(","),
       boss.enabled, boss.segments, boss.phase, locked, exact,
       round(w), round(left), round(hpTop), round(surgeTop),
       round(plateY), round(plateW), round(scale*1000), round(shield.d)].join("|")
```

**不放 bounds 的 position / rotation**：拖 token 每帧都会变，放进来会导致每条血条每帧重写。
`sig` 不变 → 直接 continue；变 → `patchBar` 按 role 分发就地改（不重建、不闪）。

---

## 3. 像素常数集中表（`s = 1`；真机微调只改这里）

> `s = min(token 渲染宽, 高) / 网格 dpi`，夹在 **0.2 ~ 6**（上界防止 4×4 巨图把条画到屏外）。
> 常量在 `assets/background.core.js` 顶部「v1.6.0 / v1.6.1 像素常数集中区」；几何在 `barLayout()`。
> 改完跑 `node dev/build-background.mjs` + `node dev/selftest.mjs`。

| 物件 | 常量 / 公式 | s=1 的值 | 颜色 / 备注 |
| --- | --- | --- | --- |
| HP 条高 | `BAR_HP_H` | 20 | 圆角 = 高/2（胶囊） |
| 回复力条高 | `BAR_SURGE_H` | 12 | 在 HP 条**下方** |
| 两行间距 | `BAR_GAP` | 3 | 蓝条贴底边内侧，红条在其上方 |
| 左右内缩 | `BAR_PAD` | 2 | 宽 `max(2×hHp, token 宽 − 2×pad)` |
| HP 底 / 填充 | — | — | `#A4A4A4 @0.6` / `#a52424 @0.85` |
| 回复力底 / 填充 | — | — | `#1a222c @0.85` / `#58a6ff @0.9` |
| 四防盾直径 | `SHIELD_DIAMETER` | 30 | fort `#e3b341` / reflex `#56d364` / will `#a371f7`（fill @0.9）；**AC `#ffffff` 半透明（fill @0.18 + 白描边 @0.85）** |
| 四防盾间距 | `DEF_GAP` | 6 | v1.6.1：一排四枚，圆心间距 = `d + 6s`（四枚连排 = 4d + 3×6s = 138s） |
| 四防一排位置 | `rowCY = hpTop − gap − d/2` | — | 整排在 **HP 红条上方** gap（3s）处；从左到右 **强韧 / 反射 / 意志 / AC**，同一行 y 相同、x 递增 |
| 四防盾离边 | `SHIELD_INSET` | 4 | 可用宽度 = 条宽 `w − 2×4s`；整排以 token 中线居中，右缘不越出条的右缘 |
| 盾数字字号 | `≤2 位 = d−8s；3 位 = d−15s` | 22 / 15 | 白字 + 黑描边（AC @0.85，三防 @0.7） |
| Boss 环内缩 | `BOSS_RING_INSET` | 2 | `Ro = min(宽,高)/2 − 2s` |
| Boss 环厚 | `BOSS_RING_THICK` | 10 | `T = clamp(10s, 6s, Ro×0.30)`，`Ri = Ro − T` |
| Boss 环段数 | `BOSS_RING_SEGMENTS` | 48 | 每环 96 点；**不要 128**（脏矩形重绘翻倍） |
| 环底 / 环填充 | — | — | `#0b0f14 @0.55` / `#a52424 @0.9`（与 HP 同红） |
| 名牌高 | `BOSS_PLATE_H` | 26 | 底 `#0b0f14 @0.78`，描边 `#253040 @0.9` |
| 名牌距 token 顶 | `BOSS_PLATE_GAP` | 6 | `plateY = tokenTop − 6s − plateH` |
| 名牌宽 | `min(w, max(140s, 0.62×14s×len(name)))` | 140+ | 名字 14s 粗体 `#e6edf3`，描边 `0.9s` |
| 阶段字号 | `10s` | 10 | `#e3b341`；牌宽 < 120s 时省略 |
| 分段线 | `2s` 视觉宽 | — | 画在**环上**（径向小四边形），色 `#281719 @0.85` |
| 锁体 / 锁梁 | `10s × 8s`（圆角 2s）/ 半径 3.2s 半圆 | 10 / 8 | locked `#f85149`，unlocked `#93a1b0 @0.8` |
| 锁位置 | 牌右缘内 13s，垂直居中 | — | 锁体 + 锁梁两件 |
| zIndex | 见 §2.1 | 9500~31050 | 固定 + `disableAutoZIndex` |
| 玩家端阶梯 | `PLAYER_THRESHOLD_DEFAULT` | 25（%） | 向上取整：60% → 75% |

**退化规则（v1.6.1 重写；选「丢盾」，不选「整体缩小」）**：

- 这一排最多放得下 `fit = floor((w − 2×inset + 6s) / (30s + 6s))` 枚盾；
- 放不下时按 `DEF_DROP = ["will","reflex","fort"]` 丢 → **先丢意志，再丢反射，再丢强韧**，
  **AC 永远优先保留**（不在 `DEF_DROP` 里 = 最后才丢）；剩下的枚数重新居中，不留空档；
- `fit < 1`（连一枚都放不下）或这一排会顶出 token 上沿（`rowCY − d/2 < token 顶 + inset`）→ **整排不画**，
  四防仍可在速览面板里看；
- s=1 的方 token 上四枚正好排得下（4×30 + 3×6 = 138 ≤ w = 146），只有**很小 / 很低 dpi** 的 token 才会退化
  （s 有 0.2 的下界，所以 14×40 这种小 token 上只剩 1 枚 AC）。

---

## 4. 几何公式（与规格 §6.4 逐项对应）

```
s      = clamp(min(bounds.width, bounds.height) / dpi, 0.2, 6)
pad    = 2s
hHp    = 20s ; hSurge = 12s ; gap = 3s
w      = max(2·hHp, bounds.width − 2·pad) ; left = center.x − w/2
surgeTop = bounds.max.y − pad − hSurge          // 蓝条贴底边内侧
hpTop    = showSurge ? surgeTop − gap − hHp
                     : bounds.max.y − pad − hHp // 没有回复力数据 → 与 v1.5.0 完全一致

d = 30s ; inset = 4s ; g = DEF_GAP·s = 6s
rowCY = hpTop − gap − d/2                          // v1.6.1：整排在 HP 红条上方（不再占四角）
fit   = floor((w − 2·inset + g) / (d + g))         // 这一排最多放几枚（<1 就整排不画）
keys  = 先按 DEF_ROW 收下所有存在的四防，再按 DEF_DROP（will→reflex→fort）删到 ≤ fit
        // → AC 永远保留；删完重新居中，AC 仍是最右那枚
n     = keys.length ; rowW = n·d + (n−1)·g ; xFirst = center.x − rowW/2 + d/2
shield[i] = { x: xFirst + i·(d + g), y: rowCY }     // i = 0..n−1：y 相同、x 从左到右递增

Ro = min(w,h)/2 − 2s ; T = clamp(10s, 6s, Ro·0.30) ; Ri = Ro − T
环：a0 = −90°，sweep = ratio×360°，外弧 0→1 + 内弧 1→0，closed=true，tension=0
plateY = min.y − 6s − plateH ; plateX = center.x − plateW/2
```

---

## 5. 右键菜单（4 项，旧 3 项没动）

| id | 文案 | filter | 写入 |
| --- | --- | --- | --- |
| `/hpbar-add` | 添加血条组件 | GM + IMAGE + max:1 + `some` flag `!=` true | `hp-bar/enabled = true` |
| `/hpbar-remove` | 移除血条组件 | 同上，flag `==` true | `hp-bar/enabled = false`（**不 delete**） |
| `/boss-show` | 显示为 Boss | GM + IMAGE + CHARACTER + boss / boss.enabled `!=` true | `hp.boss = { enabled:true, …, order: Date.now() }` |
| `/boss-hide` | 隐藏 Boss 血条 | 同上，条件反过来（`some` 覆盖布尔和对象两种老写法） | `hp.boss = { …, enabled:false }` |

- 每个菜单**一个 icon、单独 create**（不把多个 icon 塞进一个 create，避免 elementId 错位）。
- 「显示为 Boss」没有生命上限时只弹 WARNING、不写坏数据。
- 方案 A **不限制 Boss 数量**（规格 §7：每枚 token 自己一套，比参考实现的 3 个上限更自由）。

---

## 6. Boss 压制普通血条（方案 A 的「压制」口径）

- `boss.enabled === true` → `hpVisible = false`：`bar-bg / bar-fill / bar-text` **保留但隐藏**（切回普通样式不用重建）；
- **回复力蓝条与四防保留**（环只表示 HP，压掉蓝条会丢信息）；
- `boss.enabled = false` → 环 / 牌 / 分段 / 锁由 role 集合变化整体删除，件数回到 14（有盾）/ 6 / 3；
- 「谁在显示 Boss」是**纯渲染状态**，不写 metadata、不广播（规格 §4.7 的纪律；方案 A 没有 presenter 回执，因为不涉及别的客户端）。

**分段线画在环上**（径向小四边形）。规格 §6.4 D 给的是「在胶囊条上按 `left + w·i/segments` 竖线」的公式，
但本版 Boss 模式会把胶囊条压掉，画在条上就看不见 —— 所以分段跟随环，数量与 `segments` 一致（只做视觉，不改血量）。

---

## 7. 速览面板联动（`glance.js` / `info.js`）

- **四防一排** `.gl4-def-row`：四个盾形 chip（`clip-path`，与 token 四角同一套语言）。
  可编辑时点一下 = `applyAction("defense")` 把这四项写进 token；只读时退化成展示（不生成点不动的按钮）。
- **回复力蓝条** `.gl4-surgebar`（高 6px）+ 圆点行保留；分母优先 token 的 `surgesMax`。
- **锁**（`data-act="lock"`）与 **显示为 Boss**（`data-act="boss"`）：与右键写**同一个 `hp` 字段**，两个入口一套逻辑。
- `info.js` 刷新时调用 `track.js#syncTokenStats`：老 token 没有 `surgesMax` / 四防 → **只在真不一样时写一次**，
  于是第一次打开速览就能看到蓝条与四防（v1.6.1 起是 HP 条上方的一排）；写不进去（玩家 / 只读）静默跳过。

```
ref → reflex 的换算只在 track.js#defensesFromDerived（一处）
```

---

## 8. 玩家可见性（`locked`）

| 角色 | 看到什么 |
| --- | --- |
| GM | 精确数字 + 四防 + 环 + 名牌 + 锁 |
| token 创建者 | 同上 |
| 其他玩家 + `locked`（默认） | HP **25% 阶梯向上取整**的条；**不画** `cur/max`、`s/max`；**不画**四防盾；Boss 环仍按阶梯画 |
| 其他玩家 + 未 locked | 完整数字与四防 |

> 再强调一次：metadata 全桌可读，**锁 = 不画，不是加密**。UI 文案写的是「玩家端隐藏数字」，不说「隐藏数据」。

---

## 9. 自测与断言

`node dev/selftest.mjs` 五条全绿。v1.6.0 新增：

`dev/check.mjs`（静态）：
- 独立开关键 `hp-bar/enabled`、阈值键两端一致；hp 新字段四个都在；`locked` 默认 true；`boss` 布尔/对象都读；
- `ref → reflex` 只在 track.js 映射一处（渲染层不出现 reflex 名字）；
- 像素常数：20 / 12 / 3 / 30 / 10 / 2 / 48 / 26 / 6；zIndex 9500 / 15000 / 20000 / 30000 / 31000；
- 环 / 盾用 Curve 手绘、没有 buildShape；两行条与**四防一排（v1.6.1）**的退化规则；Boss 压制；
- 右键 4 项 + `operator:"!="` + 关闭写 false（不 delete）；
- 速览四防 / 蓝条 / 锁 / Boss、`syncTokenStats`、docs 与 README、bundle 已重建。

`dev/test-background.mjs`（假 OBR）：
- 带四防 + 回复力的 token 画 **14 件**（HP 3 + 蓝条 3 + 4 盾 + 4 数字），全 ATTACHMENT + 禁用 SCALE；
- 文本 `12/20 +3` / `5/6`；zIndex 盾 < 填充 < 数值；
- **v1.6.1 四防一排**：fort/reflex/will/ac **同一行 y 相同**、**x 从左到右递增**、**AC 最右**、
  AC **半透明白**（fill `#ffffff` @0.18 + 白描边 @0.85）、三防橙 / 绿 / 紫、AC 数字 28；
  这一排**贴在 HP 红条上方**（盾下缘 ≤ 条上缘）；
- **窄 token 退化按 DEF_DROP 丢**：20×20（s 夹到 0.2，放得下 2 枚）→ 先丢意志、再丢反射，剩 **fort + ac**；
  14×40（只放得下 1 枚）→ **只剩 AC**（盾 + 数字都在）；
- `boss:true` → 20 件（环 + 牌 + 锁），HP 条隐藏、蓝条保留，**四防仍是一排（4 枚同 y、AC 最右）**；
  `segments:3` → 2 条分段 + 阶段文案；
- 解锁只改锁颜色（#f85149 → #93a1b0）不重建；
- 玩家端（其他玩家 + locked）：`12/20 → 0.75` 阶梯、不画数字与四防；
- `hp-bar/enabled=false` → 一件不留；右键 4 项写盘正确（添加 true / 移除 false / Boss 开关 / 无血 WARNING）。

---

## 10. 已知限制 / 真机待确认

1. **没在真实 Owlbear 房间验证过**（开发环境禁止启动浏览器）：像素常数按规格与参考实现推的，真机偏了只改 §3 的常量。
2. 环 / 名牌在**旋转 token** 上按 AABB 重算位置（子 item 关了 ROTATION 继承），不会跟转；极限角度可能略微偏心。
3. 名牌宽度用「字符数 × 0.62em」估算（SDK 没有文本测量 API）；超长名字靠 `slice(0,120)` 截断。
4. Boss 模式**不限制数量**（方案 A）；如果以后要做「最多 3 个」的屏底条（方案 B），另起 popover / modal。
5. 本地图形层不进场景导出、没装插件的玩家看不到血条；数值在 token metadata 里，全桌可读。
6. 玩家端「锁」只影响本机画法：改了 `locked` 后需要等下一次 `scene.items.onChange`（本地 90ms 合并窗）才生效。

---

## 11. 改动文件

| 文件 | 改动 |
| --- | --- |
| `assets/background.core.js` | 常量区 / 读取器 / 几何 / role 构建 / patch switch / 菜单 4 项 / 玩家量化；版本 1.6.1（**v1.6.1 只改四防摆位与 AC 样式**：`DEF_ROW` / `DEF_GAP` / `rowCY` / 退化规则 / `barRolesKey` 带 key） |
| `assets/background.bundle.js` | `node dev/build-background.mjs` 重新生成 |
| `assets/track.js` | `KEY_HPBAR` / `KEY_PLAYER_THRESHOLD`、`readBoss` / `readDefenses` / `defensesFromDerived`、`normalizeHp` / `hpView` 扩字段、`defense`/`lock`/`boss` 三个 act、`syncTokenStats` |
| `assets/glance.js` | `surgesMax` / `locked` / `boss` 派生；四防一排、回复力蓝条、锁 + Boss 按钮 |
| `assets/glance.css` | `.gl4-def-row` / `.gl4-def-chip` / `.gl4-surgebar` / `.gl4-boss-row` |
| `assets/info.js` | 传 `surgesMax` / `defenses`，刷新时 `syncTokenStats`，签名扩字段 |
| `assets/common.js` / `manifest*.json` / `background.html` / `index.html` / `assets/index.js` | 版本 1.6.1（顺带补回 manifest 的 `action` 块：左上角 4E 入口，见 `docs/owlbear-debug.md` §三-1） |
| `dev/check.mjs` / `dev/test-background.mjs` / `dev/selftest.mjs` | v1.6.0 断言 / 注释；v1.6.1 起 check 校「四防一排」常量与摆位、test-background 校「同排 y / x 递增 / AC 最右半透明白 / 窄 token 只留 AC」 |
| `README.md` | 顶部安装地址保留；功能表加「血条扩展 + Boss 样式」 |
| `docs/hpbar-boss-v16.md` | 本文件 |
| `docs/spec-*.md` | **未改**（规格是只读输入） |
