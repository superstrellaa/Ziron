import * as THREE from "three";
import { Timer } from "three";
import { loadModelFromPath } from "../../../engine/world/model/modelLoader";
import { convertFileSrc } from "@tauri-apps/api/core";

let _container = null;
let _renderer = null;
let _scene = null;
let _camera = null;
let _rafId = null;
let _currentModel = null;
let _loadToken = 0;

const W = 200;
const H = 180;

export function initModelPreview() {
  _container = document.createElement("div");
  _container.id = "model-preview-tooltip";
  document.body.appendChild(_container);

  const canvas = document.createElement("canvas");
  _container.appendChild(canvas);

  const label = document.createElement("div");
  label.id = "model-preview-label";
  _container.appendChild(label);

  _renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  _renderer.setSize(W, H);
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setClearColor(0x0e0e1a, 1);

  _camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000);
  _camera.position.set(0, 1, 3.5);
  _camera.lookAt(0, 0, 0);

  _scene = new THREE.Scene();
  _scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(4, 6, 4);
  _scene.add(dir);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
  fill.position.set(-4, 2, -4);
  _scene.add(fill);
}

export function showModelPreview(absolutePath, name, x, y) {
  if (!_container) return;
  _container.querySelector("#model-preview-label").textContent = name;
  _setPosition(x, y);
  _container.classList.add("visible");
  _loadModel(absolutePath);
}

export function hideModelPreview() {
  if (!_container) return;
  _container.classList.remove("visible");
  _stopLoop();
  _clearModel();
}

export function moveModelPreview(x, y) {
  if (!_container) return;
  _setPosition(x, y);
}

function _setPosition(x, y) {
  const offset = 14;
  let px = x + offset;
  let py = y + offset;
  const totalH = H + 28; // canvas + label
  if (px + W > window.innerWidth) px = x - W - offset;
  if (py + totalH > window.innerHeight) py = y - totalH - offset;
  _container.style.left = px + "px";
  _container.style.top = py + "px";
}

function _clearModel() {
  if (!_currentModel) return;
  _scene.remove(_currentModel);
  _currentModel.traverse((obj) => {
    obj.geometry?.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
  _currentModel = null;
}

function _stopLoop() {
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
}

async function _loadModel(absolutePath) {
  _clearModel();
  _stopLoop();

  const token = ++_loadToken;

  try {
    const model = await loadModelFromPath(absolutePath);

    if (token !== _loadToken) {
      model.traverse((obj) => {
        obj.geometry?.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      return;
    }

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2 / maxDim;

    model.scale.setScalar(scale);
    model.position.copy(center.multiplyScalar(-scale));

    _scene.add(model);
    _currentModel = model;

    const timer = new Timer();
    let t = 0;
    function loop() {
      _rafId = requestAnimationFrame(loop);
      timer.update();
      t += timer.getDelta();
      model.rotation.y = t * 0.9;
      _renderer.render(_scene, _camera);
    }
    loop();
  } catch (e) {
    // silencioso
  }
}
