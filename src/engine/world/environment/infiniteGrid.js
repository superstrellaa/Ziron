import * as THREE from "three";

export function createInfiniteGrid() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCameraPos: { value: new THREE.Vector3() },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 uCameraPos;

      float line(float coord, float spacing, float thickness) {
        float f = abs(fract(coord / spacing + 0.5) - 0.5) * spacing;
        float df = fwidth(coord) * thickness;
        return 1.0 - smoothstep(0.0, df, f);
      }

      void main() {
        float g1  = max(line(vWorldPos.x, 1.0, 1.5), line(vWorldPos.z, 1.0, 1.5));
        float g10 = max(line(vWorldPos.x, 10.0, 2.0), line(vWorldPos.z, 10.0, 2.0));

        float dist = length(vWorldPos.xz - uCameraPos.xz);
        float fade = 1.0 - smoothstep(30.0, 80.0, dist);

        vec4 cFine   = vec4(0.165, 0.188, 0.376, 0.6);
        vec4 cCoarse = vec4(0.22,  0.25,  0.50,  0.9);

        vec4 col = mix(cFine * g1, cCoarse * g10, g10);

        col.a *= fade;
        if (col.a < 0.01) discard;
        gl_FragColor = col;
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.isInfiniteGrid = true;
  return mesh;
}
