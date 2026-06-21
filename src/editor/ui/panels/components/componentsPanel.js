import { t } from "../../../../engine/i18n/i18n.js";
import { getComponentsFor } from "../../../../engine/components/componentRegistry.js";
import { FIELD_RENDERERS } from "./fieldRenderers.js";
import { createIcons, Box } from "lucide";

export function renderComponents(entity, container, ctx) {
  container.innerHTML = "";
  const components = getComponentsFor(entity);
  if (components.length === 0) return;

  const rerender = () => renderComponents(entity, container, ctx);

  for (const comp of components) {
    const section = document.createElement("div");
    section.className = "comp-section";

    const header = document.createElement("div");
    header.className = "comp-header";
    header.innerHTML = `
      <i data-lucide="${comp.icon}" class="comp-header-icon"></i>
      <span class="comp-header-title">${t(comp.titleKey)}</span>
    `;
    section.appendChild(header);

    const body = document.createElement("div");
    body.className = "comp-body";
    section.appendChild(body);

    for (const field of comp.fields) {
      const renderer = FIELD_RENDERERS[field.type];
      if (!renderer) continue;
      renderer(field, entity, body, { ...ctx, onChange: rerender });
    }

    container.appendChild(section);
  }

  createIcons({
    icons: { Box },
    attrs: { width: 13, height: 13 },
    root: container,
  });
}
