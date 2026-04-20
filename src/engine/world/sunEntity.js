import * as THREE from "three";

function makeCircleTexture(size, color, glowColor) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const r = size * 0.3;
  const grad = ctx.createRadialGradient(c, c, r * 0.5, c, c, r * 2);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

function makeMoonTexture(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const r = size * 0.28;
  const grad = ctx.createRadialGradient(c, c, r * 0.5, c, c, r * 2);
  grad.addColorStop(0, "rgba(180,200,255,0.25)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = "#d0d8f0";
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(c - r * 0.35, c, r * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  return new THREE.CanvasTexture(canvas);
}

function makeSvgTexture(svgString, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(new THREE.CanvasTexture(canvas));
    };
    img.src = url;
  });
}

const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2"/><path d="M12 20v2"/>
  <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
  <path d="M2 12h2"/><path d="M20 12h2"/>
  <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
</svg>`;

const LOCAL_SUN_DIR = new THREE.Vector3(0, 1, 0);

export async function createSunEntity(scene, sceneManager, updateSky) {
  const light = new THREE.DirectionalLight(0xfff4e0, 1.2);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 800;
  light.shadow.camera.left = light.shadow.camera.bottom = -20;
  light.shadow.camera.right = light.shadow.camera.top = 20;
  scene.add(light);
  scene.add(light.target);

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitMesh.rotation.x = -Math.PI / 4;
  hitMesh.position.set(5, 8, 5);
  scene.add(hitMesh);

  const gizmoTex = await makeSvgTexture(SUN_SVG, 64);
  const gizmoSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: gizmoTex,
      depthTest: false,
      sizeAttenuation: true,
    }),
  );
  gizmoSprite.scale.set(1.2, 1.2, 1.2);
  hitMesh.add(gizmoSprite);

  const sunTex = makeCircleTexture(128, "#fffbe8", "rgba(255,240,120,0.35)");
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTex,
      depthTest: false,
      sizeAttenuation: false,
    }),
  );
  sunSprite.scale.set(0.09, 0.09, 0.09);
  scene.add(sunSprite);

  const moonTex = makeMoonTexture(128);
  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonTex,
      depthTest: false,
      sizeAttenuation: false,
      opacity: 0,
    }),
  );
  moonSprite.scale.set(0.065, 0.065, 0.065);
  scene.add(moonSprite);

  const entity = { id: -1, name: "Sun", type: "sun", mesh: hitMesh, light };
  sceneManager.addRaw(entity);

  const _sunDir = new THREE.Vector3();

  function update() {
    _sunDir.copy(LOCAL_SUN_DIR).applyQuaternion(hitMesh.quaternion).normalize();
    const altitude = _sunDir.y;

    sunSprite.position.copy(_sunDir).multiplyScalar(380);
    moonSprite.position.copy(_sunDir).negate().multiplyScalar(380);

    sunSprite.material.opacity = THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(altitude, -0.12, 0.08, 0, 1),
      0,
      1,
    );
    moonSprite.material.opacity = THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(altitude, 0.12, -0.05, 0, 1),
      0,
      1,
    );

    const dawnT = 1 - Math.min(Math.abs(altitude) / 0.3, 1);
    sunSprite.material.color.setRGB(
      1.0,
      THREE.MathUtils.lerp(0.98, 0.55, dawnT),
      THREE.MathUtils.lerp(0.92, 0.15, dawnT),
    );

    light.position.copy(_sunDir).multiplyScalar(50);
    if (altitude > 0) {
      light.intensity = 0.3 + altitude * 1.4;
      light.color.setHSL(
        THREE.MathUtils.lerp(0.08, 0.14, Math.min(altitude / 0.4, 1)),
        0.4,
        0.9,
      );
    } else {
      light.intensity = Math.max(0, 0.3 + altitude * 0.8);
      light.color.setHSL(0.62, 0.4, 0.35);
    }

    if (updateSky) updateSky(_sunDir);
  }

  return { entity, light, update };
}
