// 后台页：注册右键菜单、右下角浮动按钮、以及「选中绑定的 token 就弹速览」的逻辑。
// 数据全部走房间数据（OBR.room.metadata），没有自己的服务器。
import OBR from "../vendor/obr-sdk.js";
import {
  NS, KEY_BIND, ID_BUTTON, ID_INFO, URL_BASE, URL_BUTTON, URL_INFO, URL_BIND,
  getCards, findCard
} from "./common.js";

const ICON_URL = new URL("icon.svg", URL_BASE).href;
const INFO_W = 380;
const INFO_H = 470;
const RIGHT_OFFSET = 12;
const BOTTOM_OFFSET = 92;
const BUTTON_SIZE = 64;

let infoOpen = false;
let infoItemId = null;
let infoCardId = null;
let pendingRefresh = null;

/** 拖 token / 改选择会连续触发事件，合并成一次刷新。 */
function scheduleRefresh() {
  if (pendingRefresh) return;
  pendingRefresh = setTimeout(function () {
    pendingRefresh = null;
    void refreshInfo();
  }, 120);
}

async function sceneReady() {
  try {
    return await OBR.scene.isReady();
  } catch (e) {
    return false;
  }
}

async function openButton() {
  try {
    const vw = await OBR.viewport.getWidth();
    const vh = await OBR.viewport.getHeight();
    await OBR.popover.open({
      id: ID_BUTTON,
      url: URL_BUTTON,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      anchorReference: "POSITION",
      anchorPosition: { left: vw - RIGHT_OFFSET, top: vh - BOTTOM_OFFSET },
      anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
      hidePaper: true,
      disableClickAway: true
    });
  } catch (e) {
    console.error("[4enext] 浮动按钮打开失败", e);
  }
}

async function closeButton() {
  try {
    await OBR.popover.close(ID_BUTTON);
  } catch (e) {
    /* 未打开时忽略 */
  }
}

/** 把速览弹窗锚在 token 上方（打开时定位一次；面板不会跟着地图漂移）。 */
async function anchorOf(itemId) {
  try {
    const bounds = await OBR.scene.items.getItemBounds([itemId]);
    const scale = await OBR.viewport.getScale();
    const p = await OBR.viewport.transformPoint(bounds.center);
    return { left: p.x, top: Math.max(8, p.y - (bounds.height * scale) / 2 - 8) };
  } catch (e) {
    return null;
  }
}

async function openInfo(itemId, cardId) {
  const params = "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId);
  try {
    const anchor = await anchorOf(itemId);
    const vh = await OBR.viewport.getHeight();
    await OBR.popover.open({
      id: ID_INFO,
      url: URL_INFO + params,
      width: INFO_W,
      height: Math.min(INFO_H, Math.max(260, (vh || INFO_H + 40) - 40)),
      anchorReference: anchor ? "POSITION" : "ELEMENT",
      anchorElementId: anchor ? undefined : itemId,
      anchorPosition: anchor || undefined,
      anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
      hidePaper: true,
      disableClickAway: true
    });
    infoOpen = true;
    infoItemId = itemId;
    infoCardId = cardId;
  } catch (e) {
    console.error("[4enext] 速览弹窗打开失败", e);
  }
}

async function closeInfo() {
  if (!infoOpen) return;
  try {
    await OBR.popover.close(ID_INFO);
  } catch (e) {
    /* 已关闭 */
  }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
}

/** 根据当前选中项决定弹窗的去留。 */
async function refreshInfo() {
  let sel = null;
  try {
    sel = await OBR.player.getSelection();
  } catch (e) {
    return;
  }
  if (!sel || sel.length !== 1) return closeInfo();
  let item = null;
  try {
    const items = await OBR.scene.items.getItems([sel[0]]);
    item = items[0] || null;
  } catch (e) {
    return closeInfo();
  }
  if (!item || !item.metadata) return closeInfo();
  const cardId = item.metadata[KEY_BIND];
  if (typeof cardId !== "string" || !cardId) return closeInfo();
  const cards = await getCards();
  if (!findCard(cards, cardId)) return closeInfo();
  if (infoOpen && infoItemId === item.id && infoCardId === cardId) return;
  if (infoOpen) await closeInfo();
  await openInfo(item.id, cardId);
}

async function openBindModal(itemId) {
  try {
    await OBR.modal.open({
      id: NS + "/bind",
      url: URL_BIND + "?item=" + encodeURIComponent(itemId),
      width: 440,
      height: 600
    });
  } catch (e) {
    console.error("[4enext] 绑定弹窗打开失败", e);
    try {
      await OBR.modal.close(NS + "/bind");
    } catch (e2) { /* ignore */ }
  }
}

OBR.onReady(async function () {
  // 右键菜单：对 IMAGE token 提供绑定（仅 GM；写法与 OBR 官方示例一致）
  try {
    await OBR.contextMenu.create({
      id: NS + "/bind-menu",
      icons: [{
        icon: ICON_URL,
        label: "绑定 4E NEXT 角色卡",
        filter: {
          roles: ["GM"],
          every: [{ key: "type", value: "IMAGE" }],
          max: 1
        }
      }],
      onClick: async function (context) {
        const id = context.items[0] && context.items[0].id;
        if (id) await openBindModal(id);
      }
    });
  } catch (e) {
    console.error("[4enext] 右键菜单注册失败", e);
  }

  const syncScene = async function () {
    if (await sceneReady()) {
      await openButton();
    } else {
      await closeButton();
      await closeInfo();
    }
  };
  await syncScene();
  OBR.scene.onReadyChange(function () {
    void syncScene();
  });

  OBR.player.onChange(scheduleRefresh);

  // token 被移动 / 解绑 / 删除后重新判断
  try {
    OBR.scene.items.onChange(scheduleRefresh);
  } catch (e) {
    console.error("[4enext] items.onChange 订阅失败", e);
  }

  // 房间数据变了（导入 / 删除卡片）→ 当前快照失效就刷新
  OBR.room.onMetadataChange(scheduleRefresh);

  // 视图尺寸变化时把按钮重新贴到右下角
  try {
    OBR.viewport.onChange && OBR.viewport.onChange(function () {
      void openButton();
    });
  } catch (e) {
    /* 旧版 SDK 没有 viewport.onChange，忽略 */
  }

  try {
    await refreshInfo();
  } catch (e) {
    console.error(e);
  }
});
