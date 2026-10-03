import * as THREE from "three";

const SKY_RADIUS = 450;
const SKY_MARGIN = 50;

const RESOLUTION = { width: 3840, height: 2160 };

export function createCameraRenderCapture(
  renderer,
  scene,
  hiddenDuringRender = [],
) {
  const captureCamera = new THREE.PerspectiveCamera(
    50,
    RESOLUTION.width / RESOLUTION.height,
    0.1,
    1000,
  );

  async function capture(entity) {
    if (!entity || entity.type !== "camera") return null;

    const comp = entity.components?.camera;
    const userFar = comp?.far ?? 1000;

    captureCamera.fov = comp?.fov ?? 50;
    captureCamera.near = comp?.near ?? 0.1;
    captureCamera.far = Math.max(userFar, SKY_RADIUS + SKY_MARGIN);
    captureCamera.aspect = RESOLUTION.width / RESOLUTION.height;
    captureCamera.updateProjectionMatrix();

    captureCamera.position.copy(entity.mesh.position);
    captureCamera.quaternion.copy(entity.mesh.quaternion);

    const target = new THREE.WebGLRenderTarget(
      RESOLUTION.width,
      RESOLUTION.height,
      {
        samples: renderer.capabilities.isWebGL2 ? 4 : 0,
        type: THREE.UnsignedByteType,
      },
    );
    target.texture.colorSpace = renderer.outputColorSpace;

    const prevVisibility = hiddenDuringRender.map((obj) => obj.visible);
    hiddenDuringRender.forEach((obj) => {
      obj.visible = false;
    });

    const prevTarget = renderer.getRenderTarget();
    const prevViewport = new THREE.Vector4();
    renderer.getViewport(prevViewport);

    try {
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, RESOLUTION.width, RESOLUTION.height);
      renderer.clear(true, true, true);
      renderer.render(scene, captureCamera);

      const pixels = new Uint8Array(RESOLUTION.width * RESOLUTION.height * 4);
      renderer.readRenderTargetPixels(
        target,
        0,
        0,
        RESOLUTION.width,
        RESOLUTION.height,
        pixels,
      );

      return pixelsToPngBlob(pixels, RESOLUTION.width, RESOLUTION.height);
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setViewport(prevViewport);
      hiddenDuringRender.forEach((obj, i) => {
        obj.visible = prevVisibility[i];
      });
      target.dispose();
    }
  }

  return { capture };
}

function pixelsToPngBlob(pixels, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);

  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const srcStart = (height - 1 - y) * rowBytes;
    const dstStart = y * rowBytes;
    imageData.data.set(
      pixels.subarray(srcStart, srcStart + rowBytes),
      dstStart,
    );
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
