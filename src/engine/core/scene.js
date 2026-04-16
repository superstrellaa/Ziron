import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createSceneManager } from "../world/sceneManager.js";
import { createSunEntity } from "../world/sunEntity.js";

const vertexShader = `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vWorldDir;
  uniform vec3 uSunDir;
  uniform float uSunAltitude; 

  vec3 nightZenith   = vec3(0.02, 0.02, 0.08);
  vec3 nightHorizon  = vec3(0.04, 0.05, 0.14);
  vec3 dawnZenith    = vec3(0.10, 0.10, 0.28);
  vec3 dawnHorizon   = vec3(0.72, 0.36, 0.22);
  vec3 dayZenith     = vec3(0.20, 0.38, 0.72);
  vec3 dayHorizon    = vec3(0.58, 0.72, 0.95);

  vec3 skyColorAt(float alt, vec3 dir) {
    float y = normalize(dir).y;

    float dawn = smoothstep(-0.15, 0.20, alt);  
    float day  = smoothstep(0.05, 0.35, alt); 

    vec3 zenith  = mix(mix(nightZenith,  dawnZenith,  dawn), dayZenith,  day);
    vec3 horizon = mix(mix(nightHorizon, dawnHorizon, dawn), dayHorizon, day);

    float t = clamp(y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sky = mix(horizon, zenith, pow(t, 0.7));

    float dawnT = smoothstep(-0.15, 0.3, alt) * (1.0 - smoothstep(0.3, 0.6, alt));
    float sunDot = max(0.0, dot(normalize(dir), normalize(uSunDir)));
    float halo = pow(sunDot, 8.0) * dawnT * 0.6;
    sky += vec3(0.9, 0.45, 0.15) * halo;

    float fog = exp(-abs(y) * 5.0) * (0.4 + dawn * 0.3);
    sky = mix(sky, mix(nightHorizon, dawnHorizon * 1.1, dawn), fog * (1.0 - day * 0.5));

    sky = mix(sky, sky + vec3(0.04, 0.02, 0.12), 0.35 * (1.0 - day * 0.6));

    return sky;
  }

  void main() {
    vec3 col = skyColorAt(uSunAltitude, vWorldDir);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createProceduralSky() {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(1, 0.5, 0) },
    uSunAltitude: { value: 0.5 },
  };

  const skyMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 32), skyMat);

  function updateSky(sunWorldPos) {
    const dir = sunWorldPos.clone().normalize();
    uniforms.uSunDir.value.copy(dir);
    uniforms.uSunAltitude.value = dir.y;
  }

  return { skyMesh, updateSky };
}

export async function createScene(renderer) {
  const scene = new THREE.Scene();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const { skyMesh, updateSky } = createProceduralSky();
  scene.add(skyMesh);

  scene.add(new THREE.GridHelper(20, 20, 0x2a3060, 0x1e2448));
  scene.add(new THREE.AxesHelper(2));
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const sceneManager = createSceneManager(scene);
  const defaultCube = sceneManager.add("cube", { name: "Cube" });
  const sun = await createSunEntity(scene, sceneManager, updateSky);

  return { scene, sceneManager, defaultCube, sun };
}
