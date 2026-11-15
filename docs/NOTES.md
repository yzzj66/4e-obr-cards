# 开发笔记 / NOTES

> 这个目录放维护说明。**插件运行不需要它**，删掉也不影响功能。
> 完整的分版本实现细节在 `D:\deepseek\4E-Patch\_workfiles\docs\`（不随插件上传）。

## 文件结构

```
根目录    *.html（各窗口页面）+ manifest.json + icon*.svg + README.md
assets/   所有 JS/CSS（background.core.js 是后台源码，background.bundle.js 是它的打包产物）
data/     rules.js（离线规则索引，算 HP/防御/技能用）
vendor/   obr-sdk.js（Owlbear SDK 3.1.0，已打包，离线可用）
samples/  sample-card.json（示例角色卡）
dev/      开发自测脚本（不上传也能跑，node dev/selftest.mjs）
```

## 改代码的注意事项

1. **改了 `assets/background.core.js` 必须重建 bundle**：`node dev/build-background.mjs`，否则后台不生效。
2. 改完跑 `node dev/selftest.mjs`（5 条自测：check / test-background / test-initiative / test-track / test-dice）。
3. **manifest.json 的 `description` ≤ 128 字符**（Owlbear 会校验，超了直接拒绝加载）。
4. **manifest 不要加 `action` 字段**（真机验证过：加了反而加载失败）。
5. GitHub Pages 必须在仓库根放 **`.nojekyll`**，否则 `{{...}}` 模板语法会让构建失败、线上一直是旧版本。
6. 数据键名不要改（`com.4enext-owlbear/hp`、`/state/<cardId>`、`/cardId`、`/initiative` 等），改了旧存档会丢。

## 关键常量在哪

| 要调什么 | 去哪改 |
|---|---|
| token 血条/四防的位置与尺寸 | `assets/background.core.js` 顶部 `DEF_*` / `rowCY` / `barLayout()` |
| 骰子动画手感 | `assets/dice-core.js` 的 `FX_*` + `assets/ui.css` 末尾 `@keyframes fx-*` |
| 先攻条尺寸 | `assets/background.core.js` 的 `STRIP_H_ALLOWED` / `stripSizeFor` |
| 窗口默认尺寸 | `assets/background.core.js` 的 `WINS` |
