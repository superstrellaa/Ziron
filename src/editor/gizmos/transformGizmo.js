import { TransformControls } from "three/addons/controls/TransformControls.js";

export function createGizmo(camera, domElement, scene, flyControls) {
  const gizmo = new TransformControls(camera, domElement);
  gizmo.setMode("translate");

  const helper = gizmo.getHelper();
  scene.add(helper);

  let isDragging = false;

  gizmo.addEventListener("dragging-changed", (e) => {
    isDragging = e.value;
    flyControls.enabled = !e.value;
  });

  function attach(mesh) {
    gizmo.attach(mesh);
    gizmo.getHelper().visible = true;
  }

  function detach() {
    gizmo.detach();
    gizmo.getHelper().visible = false;
  }

  detach();

  return { attach, detach, gizmo, isDragging: () => isDragging };
}
