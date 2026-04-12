import * as THREE from "three";
import { createSceneManager } from "../world/sceneManager.js";

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  scene.add(new THREE.GridHelper(20, 20, 0x2a2a4e, 0x22223a));
  scene.add(new THREE.AxesHelper(2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(8, 10, 6);
  sun.castShadow = true;
  scene.add(sun);

  const sceneManager = createSceneManager(scene);

  const defaultCube = sceneManager.add("cube", { name: "Cube" });

  return { scene, sceneManager, defaultCube };
}
