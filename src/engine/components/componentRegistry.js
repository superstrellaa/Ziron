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
        min: 1,
        step: 10,
        get: (entity) => entity.components?.camera?.far ?? 1000,
        set: (entity, value) => {
          entity.components ??= {};
          entity.components.camera ??= {};
          entity.components.camera.far = value;
        },
      },
    ],
  },
];

export function getComponentsFor(entity) {
  return COMPONENTS.filter((c) => c.appliesTo(entity));
}
