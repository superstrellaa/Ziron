import { TransformControls } from "three/addons/controls/TransformControls.js";

export function createGizmo(camera, domElement, scene, object, orbitControls) {
  const gizmo = new TransformControls(camera, domElement);
  gizmo.attach(object);
  gizmo.setMode("translate");

  scene.add(gizmo.getHelper());

  gizmo.addEventListener("dragging-changed", (e) => {
    orbitControls.enabled = !e.value;
  });

  return gizmo;
}
