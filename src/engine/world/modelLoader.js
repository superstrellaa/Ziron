import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { convertFileSrc } from "@tauri-apps/api/core";

export async function loadModelFromPath(absolutePath) {
  const url = convertFileSrc(absolutePath);
  const ext = absolutePath.split(".").pop().toLowerCase();

  if (ext === "glb" || ext === "gltf") {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) =>
      loader.load(url, resolve, undefined, reject),
    );
    return gltf.scene;
  } else if (ext === "obj") {
    const loader = new OBJLoader();
    return new Promise((resolve, reject) =>
      loader.load(url, resolve, undefined, reject),
    );
  } else if (ext === "fbx") {
    const loader = new FBXLoader();
    return new Promise((resolve, reject) =>
      loader.load(url, resolve, undefined, reject),
    );
  }
  throw new Error(`Unsupported format: ${ext}`);
}
