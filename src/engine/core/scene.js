import * as THREE from "three";

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const grid = new THREE.GridHelper(20, 20, 0x2a2a4e, 0x22223a);
  scene.add(grid);

  const axes = new THREE.AxesHelper(2);
  scene.add(axes);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(8, 10, 6);
  sun.castShadow = true;
  scene.add(sun);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xa78bfa });
  const cube = new THREE.Mesh(geo, mat);
  cube.castShadow = true;
  cube.receiveShadow = true;
  cube.position.y = 0.5;
  scene.add(cube);

  return { scene, cube };
}
