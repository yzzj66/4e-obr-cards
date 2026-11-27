// 右下角浮动按钮（v2.4.16）：打开 4eNEXT to owlbear 设置窗口。
// 页面只负责发命令；后台已有 settings 窗口逻辑（WINS.settings / openWinOrNotify("settings")），不复制。
import OBR from "../vendor/obr-sdk.js";
import { CH_OPEN_SETTINGS } from "./common.js";

var fab = document.getElementById("fab");

fab.addEventListener("click", async function () {
  try {
    await OBR.broadcast.sendMessage(CH_OPEN_SETTINGS, { at: Date.now() }, { destination: "LOCAL" });
  } catch (e) {
    console.error("[4enext] 打开设置失败", e);
  }
});
