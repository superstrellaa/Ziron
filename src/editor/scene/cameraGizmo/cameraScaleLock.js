// UTIL para no escalar las cámaras, a lo mejor es un poco ineficiente para cada tick pero hoy dia existen buenos PCs, no creo que afecte
export function createCameraScaleLock(sceneManager) {
  function tick() {
    for (const entity of sceneManager.getAll()) {
      if (entity.type !== "camera") continue;
      const s = entity.mesh.scale;
      if (s.x !== 1 || s.y !== 1 || s.z !== 1) {
        s.set(1, 1, 1);
      }
    }
  }

  return { tick };
}
