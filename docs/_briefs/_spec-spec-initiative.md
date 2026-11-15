# 任务：提炼规格 先攻条（复刻 Full Suite initiative）

## 背景

- 本地插件 `D:\deepseek\4E-Patch\owlbear-plugin\` 当前 v1.3.1 开发中（拆分块窗口）；
- 本任务**只读参考实现 + 写一份规格文档**，**不要改插件代码** ✓（避免与并行任务冲突）；
- 交付文件只有：`D:\deepseek\4E-Patch\owlbear-plugin\docs\spec-initiative.md`（唯一写入文件 ✓）；
- 规划总表：`_roadmap-v13.md`（先读 ✓）；设计语言：深色 #14161c + 绿 #7fe07f + 圆角卡片 ✓。

## 要提炼的内容

参考 `FullPeople/obr-suite` 的 `src/modules/initiative/`（index.ts 38KB / panel-page.tsx 35KB / components/ / hooks/ / styles/ / utils/ / types.ts）与 `FullPeople/Full_initiative_tracker`（src/hooks/useInitiative.ts 25KB）。

## 硬性要求

- **只写 docs/spec-initiative.md**，不改任何代码/其它文件 ✓；
- 结论必须**基于真实源码**（贴关键代码片段/字段名/API 调用作为证据），不要凭印象 ✗；
- 文档要能让**另一个开发者直接照着实现**（API 调用、数据结构、布局公式、分阶段步骤、风险）。