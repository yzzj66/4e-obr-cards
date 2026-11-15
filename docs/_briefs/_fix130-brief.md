# 任务：修复 v1.3.0 的「后台脚本没有响应」（构建/自测双失败）

## 症状（用户真机 + 本地自测）

1. 用户在 Owlbear 里打开面板：「4eNEXT to owlbear」+ 三 tab 显示正常 ✓，但**先攻 tab 顶部红字**：
   「**后台脚本没有响应：右键加入先攻、玩家结束回合都会靠它。请把扩展关掉再打开一次。**」✗
   （说明 panel 发的 ping 收不到 background 的 pong ✗ = background 没跑起来或没注册 handler ✗）
2. 本地自测（`D:\deepseek\4E-Patch\owlbear-plugin`）：
   · `node dev/check.mjs` → **FAIL 经典脚本解析失败：Unexpected token ')'**（exit 1）✗
   · `node dev/test-initiative.mjs` → **SyntaxError: Missing catch or finally after try**（exit 1）✗
   · `node dev/test-background.mjs` → 同上 ✗
   · 但 `node --check` 逐个文件（core/bundle/panel/info/common/tests）**全部 OK** ✗（说明错误在 check/test 自己的解析或 eval 路径，或 bundle 拼接后有不可按经典脚本解析的语法）

## 现状文件

- `assets/background.core.js` 51 KB（v1.3.0 新增先攻逻辑 ✓）、`assets/background.bundle.js` 138 KB（09:40 生成 ✓ 之后 core 又改过 ✗ **可能不同步**）、
- `assets/panel.js` 20.9 KB（三 tab + 先攻列表 ✓）、`assets/common.js`、`assets/track.js`、`assets/glance.js`、`assets/info.js`、
- `dev/build-background.mjs`（拼接脚本 ✓）、`dev/check.mjs`、`dev/test-background.mjs`、`dev/test-initiative.mjs`、`dev/test-track.mjs`、`dev/check-render.mjs`、
- 规划/说明：`_roadmap-v13.md`、`docs/initiative-v13.md`、`docs/popover-drag.md`、`docs/owlbear-debug.md`。

## 要做的

1. **先让自测全绿**：逐个修 `dev/check.mjs`、`dev/test-initiative.mjs`、`dev/test-background.mjs` 的失败（它们是发现问题的手段）；
   注意 `node --check` 过但 `check.mjs` 判「经典脚本解析失败」→ 很可能 `check.mjs` 用 `new Function(...)`/`vm.Script` 解析 bundle，
   bundle 里有**顶层 return / ESM 残留 / import.meta** 或拼接顺序导致的语法问题 → 逐一定位并修 ✓；
   「Missing catch or finally after try」同理，多半在 test 里用字符串拼 JS 再 eval ✗ → 修测试或修被测代码 ✓；
2. **确保 bundle 与 core 同步**：改完 core 必须 `node dev/build-background.mjs`（并确认 build 脚本本身没被破坏 ✓）；
3. **修「后台没响应」**：确认 `background.bundle.js` 在**经典脚本**语义下可执行（`<script src>` 无 type=module ✓），
   并确认 ping/pong 频道名两边一致（panel.js ↔ background ✓）；在 background 的 `OBR.onReady` 里对 `diag-hello` 做 pong 回复 ✓；
4. **加一条自检命令**（用户可让我跑）：`node dev/check.mjs && node dev/test-background.mjs && node dev/test-initiative.mjs && node dev/test-track.mjs` 全 0 ✓；
5. 版本号保持 **1.3.0**（修 bug 不跳版本 ✓ 或 → 1.3.1，按你判断 ✓），README 顶部「⭐ 安装地址」保留 ✓；
6. 更新 `docs/initiative-v13.md`：记录这次修复（根因 + 修法）。

## 硬性要求

- 只改 `D:\deepseek\4E-Patch\owlbear-plugin\`；不动 data/program/tools/archive；
- 不破坏 v1.2.2 已有功能（速览/血条/资源追踪/拖动/右键绑定/导入）✓；
- 最终交付前**自己跑一遍**上述 4 条自测命令并给出输出 ✓。