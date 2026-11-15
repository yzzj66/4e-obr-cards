// 一条命令跑完 v1.6.0 的五条自测：node dev/selftest.mjs
// ---------------------------------------------------------------------------
// 顺序固定：静态自检 → 后台冒烟 → 先攻 → 资源追踪 → 骰子。
// v1.3.1 的断言分别落在 check（无三 tab / 三个独立页面 / 入口按钮 / 视口夹紧 / 滚动容器 /
// 离线置灰）与 test-background（三个工具栏入口各开自己的窗口、拖动 / 位置记忆 / 视口夹紧）。
// v1.3.2 再补：工具栏五个入口（速览 / 设置 + 两个新图标）、设置窗口注册进 WINS、
// 设置页六栏与版本来源、「重置本机设置」的边界（只清白名单内的本机键，不碰房间 / token 数据）。
// v1.4.0 再补：先攻条（尺寸 / 三档高度 / 卡片 CSS / 五个控制按钮 / popover CENTER/TOP + top 45）、
// 先攻数据层（d20 / tb / phase / 上限 60 / 降级 / 旧数据兼容 / 拖拽中点法 / 四道权限校验）。
// v1.5.0 再补：骰子（表达式解析 / 掷骰 / 重击=伤害骰取满 / 战斗优势+2 / 载荷归一化 / 合并去重 40 条 /
// 4E 预设只读 glance / 频道与上限两端一致 / 760×620 窗口）。
// v1.6.0 再补：血条扩展（临时生命 +N / 蓝色回复力条 / 四防四角盾）+ Boss 方案 A（环形 / 名牌 / 分段 / 锁，
// 压制普通 HP 条）+ 独立开关键 hp-bar/enabled（关闭写 false 不 delete）+ 右键 4 项 + 玩家端量化。
// 每条都是独立进程（stdio 直接继承，不经管道，避免某些环境禁止子进程管道）。
// 任何一条非 0 就整体返回 1，并在最后打印汇总表。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STEPS = [
  "dev/check.mjs",
  "dev/test-background.mjs",
  "dev/test-initiative.mjs",
  "dev/test-track.mjs",
  "dev/test-dice.mjs"
];

const results = [];
let failed = 0;

for (const step of STEPS) {
  console.log("\n=== node " + step + " ===");
  const r = spawnSync(process.execPath, [path.join(ROOT, step)], { cwd: ROOT, stdio: "inherit" });
  const code = typeof r.status === "number" ? r.status : 1;
  results.push([step, code]);
  if (code !== 0) failed++;
}

console.log("\n=== 自测汇总 ===");
for (const [step, code] of results) {
  console.log((code === 0 ? "  ok   " : "  FAIL ") + step + "（exit " + code + "）");
}
console.log(failed ? failed + " 条自测失败" : "全部通过（" + STEPS.length + "/" + STEPS.length + "，exit 0）");
process.exit(failed ? 1 : 0);
