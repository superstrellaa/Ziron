import * as THREE from "three";
import { createFlyCamera } from "./flyCamera.js";
import { createScene } from "./scene.js";
import { createGizmo } from "./gizmo.js";

export function createViewport(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, 0, 0);

  const { scene, cube } = createScene();

  const flyControls = createFlyCamera(camera, container);

  const info = document.createElement("div");
  info.id = "info";
  info.innerHTML = "Click derecho + arrastrar → orbitar";
  container.appendChild(info);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  const gizmo = createGizmo(
    camera,
    renderer.domElement,
    scene,
    cube,
    flyControls,
  );

  function animate() {
    requestAnimationFrame(animate);
    flyControls.update();
    renderer.render(scene, camera);
  }
  animate();
}
