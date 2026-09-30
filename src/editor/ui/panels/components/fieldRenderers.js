import { t } from "../../../../engine/i18n/i18n.js";
import {
  createIcons,
  Image,
  TrianglesCenterlineDashedHorizontal,
} from "lucide";
import { openAssetPicker } from "../../../../engine/ui/assetPicker/assetPicker.js";
import { GenericCommand } from "../../../../engine/history/commands.js";
import { applyModelTexture } from "../../../../engine/world/model/modelTexture.js";

export const FIELD_RENDERERS = {
  texture: renderTextureField,
  number: renderNumberField,
  button: renderButtonField,
  separator: renderSeparatorField,
};

function tooltipAttr(field) {
  return field.tooltipKey ? `data-tooltip="${t(field.tooltipKey)}"` : "";
}

function renderTextureField(field, entity, container, ctx) {
  const wrapper = document.createElement("div");
  wrapper.className = "comp-field comp-field-texture";

  const value = field.get(entity);
  const tip = field.tooltipKey
    ? t(field.tooltipKey)
    : t("components.texture.pickTip");

  wrapper.innerHTML = `
    <label class="comp-field-label">${t(field.labelKey)}</label>
    <div class="comp-texture-slot" data-tooltip="${tip}">
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

function renderNumberField(field, entity, container, ctx) {
  const wrapper = document.createElement("div");
  wrapper.className = "comp-field comp-field-number";

  const value = field.get(entity);

  wrapper.innerHTML = `
    <label class="comp-field-label" ${tooltipAttr(field)}>${t(field.labelKey)}</label>
    <input
      class="prop-input comp-number-input"
      type="number"
      value="${value}"
      ${field.min != null ? `min="${field.min}"` : ""}
      ${field.max != null ? `max="${field.max}"` : ""}
      step="${field.step ?? 1}"
      autocomplete="off"
      spellcheck="false"
    />
  `;

  const input = wrapper.querySelector("input");

  input.addEventListener("focus", () => input.select());

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      input.value = field.get(entity);
      input.blur();
    }
  });

  input.addEventListener("blur", () => {
    let next = parseFloat(input.value);
    if (isNaN(next)) {
      input.value = field.get(entity);
      return;
    }
    if (field.min != null) next = Math.max(field.min, next);
    if (field.max != null) next = Math.min(field.max, next);

    const from = field.get(entity);
    if (next === from) {
      input.value = next;
      return;
    }

    const cmd = GenericCommand(
      `Set${field.id}`,
      () => {
        field.set(entity, next);
        ctx.onChange?.();
      },
      () => {
        field.set(entity, from);
        ctx.onChange?.();
      },
    );
    cmd.execute();
    ctx.history().push(cmd);
  });

  container.appendChild(wrapper);
}

function renderButtonField(field, entity, container, ctx) {
  const wrapper = document.createElement("div");
  wrapper.className = "comp-field comp-field-button";

  const iconAttr = field.icon
    ? `<i data-lucide="${field.icon}" class="comp-action-btn-icon"></i>`
    : "";

  wrapper.innerHTML = `
    <button type="button" class="comp-action-btn" ${tooltipAttr(field)}>
      ${iconAttr}<span>${t(field.labelKey)}</span>
    </button>
  `;

  if (field.icon) {
    createIcons({
      icons: { TrianglesCenterlineDashedHorizontal },
      attrs: { width: 13, height: 13 },
      root: wrapper,
    });
  }

  wrapper
    .querySelector(".comp-action-btn")
    .addEventListener("click", () => field.action(entity, ctx));

  container.appendChild(wrapper);
}

function renderSeparatorField(field, entity, container, ctx) {
  const hr = document.createElement("div");
  hr.className = "comp-separator";
  container.appendChild(hr);
}
