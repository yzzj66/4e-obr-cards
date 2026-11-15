// 右下角浮动按钮：点一下打开全屏角色卡面板。
import OBR from "../vendor/obr-sdk.js";
import { ID_PANEL, URL_PANEL } from "./common.js";

const fab = document.getElementById("fab");

fab.addEventListener("click", async function () {
  try {
    await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
  } catch (e) {
    console.error("[4enext] 打开面板失败", e);
    try {
      await OBR.modal.close(ID_PANEL);
      await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
    } catch (e2) {
      console.error(e2);
    }
  }
});
