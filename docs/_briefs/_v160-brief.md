# 任务 v1.6.0：血条扩展（临时生命/四防/蓝色回复力条）+ Boss 样式

## 现状

- 插件 `D:\deepseek\4E-Patch\owlbear-plugin\` **v1.5.0**（骰子 ✓ 先攻条 ✓ 五入口 ✓ 设置 ✓ 四窗口 ✓）；
- 已有血条：`assets/background.core.js` 第 7 节「token 血条」✓（Curve 底条 + 填充 + Text「cur/max +temp」✓ attachedTo + ATTACHMENT 层 ✓ 本地图形层 ✓）；
  数据：token metadata `com.4enext-owlbear/hp = {cur,max,temp,surges,updatedAt}` ✓；
- **规格（必读）**：`docs/spec-hpbar-boss.md`（1242 行 ✓ 含几何公式/4E 化定稿/两套 Boss 方案对比/P0–P5/风险/验收 ✓）；
- 工程：改 `background.core.js` → `node dev/build-background.mjs`；`node dev/selftest.mjs` 必须全绿（现 5/5 ✓）；

## 用户要求（截图 + 原话）

1. **血条要显示**：
   - HP 红条 + `cur/max` + **临时生命 `+N`**（红字在右侧 ✓ `144/144 +7` 那样）；
   - **蓝色回复力条**（`13/13` ✓ 在 HP 条下方 ✓ 细条 ✓）；
   - **四防**（4E 四种）：**AC / 强韧 / 反射 / 意志** —— 按参考图 token **四角**四个小数字（盾形/圆底 ✓ 参考图 3 的 28/25/26/25 布局 ✓）；
2. **右键菜单新增两项**（Full Suite 同款）：**「添加血条组件」**（显式开启 ✓）/ **「显示为 Boss」**（切换 Boss 样式 ✓）；
3. **Boss 样式**（参考图 1/2 ✓ 注意：规格 §7 说明参考实现的 Boss 是「全屏透明 Modal + 屏底条」✗ 不是 token 样式 ✗）：
   **按规格的方案 A（token 附带）实现** ✓：环形/加粗血条 + 名牌 + **防御盾图标** + **锁**（玩家不能改血）✓；
   方案 B（屏底全条）**先不做** ✗（规格说 P4 可选 ✓）。

## 要做的（按规格 P0→P3）

### P0 数据与开关
- `com.4enext-owlbear/hp` **新增**字段：`surgesMax`、`defenses:{ac,fort,reflex,will}`、`boss`（boolean 或对象，读取归一化 ✓）、`locked`；
- 新增独立开关键 `com.4enext-owlbear/hp-bar/enabled`（不塞进 hp ✓ 规格 §6）；
- 旧数据兼容：缺字段补默认 ✓（四防缺失就不画 ✓）。

### P1 布局（照抄规格 §5 的量化公式）
- HP 条 `20s` 在上 ✓ 回复力蓝条 `12s` 在下 ✓ 间距 `3s` ✓ 共用 left/w ✓ 贴 token 底边内侧 ✓；
- 四防四角：盾直径 `30s` ✓ 窄 token 退化不画 ✓（规格给了退化阈值）；
- 几何：`s = min(w,h)/dpi` ✓ 夹在 0.2–6 ✓（现有 ✓）；zIndex：盾 15000 / 填充 20000 / 文字 30000 ✓（现有 ✓）；
- **形状**：SDK 3.1.0 **没有 RING/盾牌** ✗ → 用 `buildCurve().points()` 手绘 ✓（环形扇区/盾形多边形公式在规格 §5/§6 ✓）。

### P2 Boss 样式（方案 A）
- 环形血条（`Ro=半短边−2s`，环厚 `10s`，48 段 ✓）、名牌（`26s`，距顶 `6s` ✓）、分段线、锁图标 ✓；
- `displayed` 时**压制普通血条**（规格 §4 的 presented 回执 + 内存集合 ✓ 不写 metadata ✓）；
- 玩家端**量化显示**（规格 §4 的 `quantiseRatio` 阈值 25 ✓ 不暴露精确血量 ✓ 可选 ✓）。

### P3 右键菜单 + 面板联动
- 「添加血条组件」→ 写 `hp-bar/enabled = true` ✓（**关闭写 false 不 delete** ✓ 规格 §3 的坑 ✓ 菜单 filter 用 `operator:"!=",value:true` ✓）；
- 「显示为 Boss」→ 写 `boss` 字段 ✓ 切换 ✓；
- 速览弹窗里的 HP 控制 + 回复力圆点 → 同步到新字段（`surges`/`surgesMax`/`defenses` ✓）；
- **血条面板**（可选 ✓ 规格 §3）：先不做 ✗（P2 优先级高于面板 ✓ 用户没提 ✓）。

## 工程与自测

- `dev/check.mjs` 增加：新字段名、`hp-bar/enabled` 独立键、几何常数（20/12/3/30）、zIndex、环形常数、右键两项、`operator:"!="`、无 delete、锁定逻辑；
- `dev/test-background.mjs` 增加：血条 items 数量/attachedTo/层/文本（含 `+temp`）、Boss 模式压制普通条、四防缺失退化、enabled=false 移除、玩家只读；
- `node dev/selftest.mjs` 全绿 ✓；
- 版本 → **1.6.0**；README 功能表加「血条扩展（临时生命/四防/蓝条）+ Boss 样式」✓ 顶部「⭐ 安装地址」保留 ✓；`docs/hpbar-boss-v16.md` 写实现 + **像素常数集中表**（便于真机微调 ✓）；
- **不要改 `docs/spec-*.md`** ✓。

## 硬性要求

- 只改 `owlbear-plugin\`；不动 data/program/tools/archive；不引入构建步骤；不改已有数据键名（可新增字段 ✓）；
- 不破坏 v1.5.0 已有功能 ✓；
- **禁止启动浏览器**（沙箱会崩溃弹窗 ✗）；像素常数集中在 `barLayout()`/常量区 ✓ 便于微调 ✓。