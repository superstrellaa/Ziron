export function connectViewportEvents({
  sceneManager,
  selection,
  hierarchy,
  history,
  viewportEl,
  triggerSave,
  onKeybind,
  setProjectOpen,
}) {
  sceneManager.on("onAdd", (entity) => {
    if (entity.type !== "sun") selection.selectEntity(entity);
  });

  selection.onChange((single, multi) => hierarchy.setSelected(single, multi));

  history.onDirtyChange((dirty) => hierarchy.setDirty(dirty));

  const markDirty = () => {
    if (!history.isDirty()) hierarchy.setDirty(true);
  };
  sceneManager.on("onAdd", markDirty);
  sceneManager.on("onAddBatch", markDirty);
  sceneManager.on("onRemove", markDirty);
  sceneManager.on("onRemoveBatch", markDirty);

  const unsubSave = onKeybind("SAVE", (e) => {
    e.preventDefault();
    triggerSave();
  });

  setProjectOpen(true, triggerSave);

  viewportEl.addEventListener("viewport:destroy", unsubSave, { once: true });

  function destroy() {
    unsubSave();
    setProjectOpen(false);
  }

  return { destroy };
}
