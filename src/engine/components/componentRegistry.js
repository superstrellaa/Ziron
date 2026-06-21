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
];

export function getComponentsFor(entity) {
  return COMPONENTS.filter((c) => c.appliesTo(entity));
}
