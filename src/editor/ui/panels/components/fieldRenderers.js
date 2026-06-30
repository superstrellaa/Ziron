import { t } from "../../../../engine/i18n/i18n.js";
import { createIcons, Image } from "lucide";
import { openAssetPicker } from "../../../../engine/ui/assetPicker/assetPicker.js";
import { GenericCommand } from "../../../../engine/history/commands.js";
import { applyModelTexture } from "../../../../engine/world/model/modelTexture.js";

export const FIELD_RENDERERS = {
  texture: renderTextureField,
};

function renderTextureField(field, entity, container, ctx) {
  const wrapper = document.createElement("div");
  wrapper.className = "comp-field comp-field-texture";

  const value = field.get(entity);

  wrapper.innerHTML = `
    <label class="comp-field-label">${t(field.labelKey)}</label>
    <div class="comp-texture-slot" data-tooltip="${t("components.texture.pickTip")}">
      <i data-lucide="image" class="comp-texture-icon"></i>
      <span class="comp-texture-name">${value ?? t("components.texture.empty")}</span>
    </div>
  `;

  createIcons({
    icons: { Image },
    attrs: { width: 14, height: 14 },
    root: wrapper,
  });

  wrapper
    .querySelector(".comp-texture-slot")
    .addEventListener("click", async () => {
      const selected = await openAssetPicker({
        projectData: ctx.projectData,
        extensions: field.extensions ?? ["png", "jpg", "jpeg"],
      });
      if (selected === null) return;

      const from = field.get(entity);
      if (from === selected) return;

      const cmd = GenericCommand(
        "SetTexture",
        () => {
          field.set(entity, selected);
          applyModelTexture(entity, ctx.projectData, selected);
          ctx.onChange?.();
        },
        () => {
          field.set(entity, from);
          applyModelTexture(entity, ctx.projectData, from);
          ctx.onChange?.();
        },
      );
      cmd.execute();
      ctx.history().push(cmd);
    });

  container.appendChild(wrapper);
}
