import { invoke } from "@tauri-apps/api/core";
import { logger } from "../core/logger.js";
import { Toast } from "../ui/toasts/toastTypes.js";
import { GenericCommand } from "../history/commands.js";
import { blobToBase64 } from "../../editor/scene/cameraGizmo/cameraRenderCapture.js";

let _renderInProgress = false;

function safeFileName(name) {
  const cleaned = String(name ?? "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  return cleaned || "render";
}

export const COMPONENTS = [
  {
    id: "model",
    appliesTo: (entity) => entity.type === "model",
    titleKey: "components.model.title",
    icon: "box",
    fields: [
      {
        id: "texture",
        type: "texture",
        labelKey: "components.model.texture",
        extensions: ["png", "jpg", "jpeg", "webp"],
        get: (entity) => entity.components?.model?.texture ?? null,
        set: (entity, value) => {
          entity.components ??= {};
          entity.components.model ??= {};
          entity.components.model.texture = value;
        },
      },
    ],
  },
  {
    id: "camera",
    appliesTo: (entity) => entity.type === "camera",
    titleKey: "components.camera.title",
    icon: "video",
    fields: [
      {
        id: "fov",
        type: "number",
        labelKey: "components.camera.fov",
        tooltipKey: "components.camera.fovTip",
        min: 1,
        max: 179,
        step: 1,
        get: (entity) => entity.components?.camera?.fov ?? 50,
        set: (entity, value) => {
          entity.components ??= {};
          entity.components.camera ??= {};
          entity.components.camera.fov = value;
        },
      },
      {
        id: "near",
        type: "number",
        labelKey: "components.camera.near",
        tooltipKey: "components.camera.nearTip",
        min: 0.01,
        step: 0.01,
        get: (entity) => entity.components?.camera?.near ?? 0.1,
        set: (entity, value) => {
          entity.components ??= {};
          entity.components.camera ??= {};
          entity.components.camera.near = value;
        },
      },
      {
        id: "far",
        type: "number",
        labelKey: "components.camera.far",
        tooltipKey: "components.camera.farTip",
        min: 1,
        step: 10,
        get: (entity) => entity.components?.camera?.far ?? 1000,
        set: (entity, value) => {
          entity.components ??= {};
          entity.components.camera ??= {};
          entity.components.camera.far = value;
        },
      },
      {
        id: "centerToCameraSeparator",
        type: "separator",
      },
      {
        id: "cameraActions",
        type: "buttonRow",
        buttons: [
          {
            id: "centerToCamera",
            labelKey: "components.camera.centerToCamera",
            tooltipKey: "components.camera.centerToCameraTip",
            icon: "triangles-centerline-dashed-horizontal",
            action: (entity, ctx) => {
              const vc = ctx.viewportCamera;
              if (!vc) return;

              const fromPos = entity.mesh.position.clone();
              const fromQuat = entity.mesh.quaternion.clone();
              const toPos = vc.position.clone();
              const toQuat = vc.quaternion.clone();

              if (toPos.equals(fromPos) && toQuat.equals(fromQuat)) return;

              const cmd = GenericCommand(
                "CenterCameraToView",
                () => {
                  entity.mesh.position.copy(toPos);
                  entity.mesh.quaternion.copy(toQuat);
                },
                () => {
                  entity.mesh.position.copy(fromPos);
                  entity.mesh.quaternion.copy(fromQuat);
                },
              );
              cmd.execute();
              ctx.history().push(cmd);
            },
          },
          {
            id: "renderCamera",
            labelKey: "components.camera.renderCamera",
            tooltipKey: "components.camera.renderCameraTip",
            icon: "scan-box",
            action: async (entity, ctx) => {
              if (_renderInProgress) {
                logger.debug(
                  "CameraRender",
                  "Render requested while another one is running; ignored",
                );
                return;
              }
              _renderInProgress = true;

              let stage = "capture";
              try {
                if (!ctx.renderCapture) {
                  throw new Error("Render capture system is not available");
                }

                const blob = await ctx.renderCapture.capture(entity);
                if (!blob) {
                  throw new Error(
                    `Capture returned no image for "${entity.name}"`,
                  );
                }

                stage = "encode";
                const base64 = await blobToBase64(blob);

                stage = "save";
                const saved = await invoke("save_render_png", {
                  defaultName: `${safeFileName(entity.name)}.png`,
                  dataBase64: base64,
                });

                if (saved) {
                  logger.info("CameraRender", `Render saved → ${saved}`);
                  Toast.renderSuccess();
                } else {
                  logger.info(
                    "CameraRender",
                    "Render discarded: save dialog cancelled",
                  );
                }
              } catch (e) {
                const errorMessage =
                  typeof e === "string" ? e : (e?.message ?? String(e));
                logger.error(
                  "CameraRender",
                  `Render failed at stage "${stage}" | Error: ${errorMessage}`,
                );
                if (errorMessage.startsWith("render_file_locked:")) {
                  Toast.renderFileLocked();
                } else {
                  Toast.failedToRenderScene();
                }
              } finally {
                _renderInProgress = false;
              }
            },
          },
        ],
      },
    ],
  },
];

export function getComponentsFor(entity) {
  return COMPONENTS.filter((c) => c.appliesTo(entity));
}
