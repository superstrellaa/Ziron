import * as THREE from "three";
import { logger } from "../../../engine/core/logger.js";

const SKY_RADIUS = 450;
const SKY_MARGIN = 50;

const CAMERA_DEFAULTS = { fov: 50, near: 0.1, far: 1000 };

const RESOLUTION = { width: 3840, height: 2160 };
const LINEAR_TO_SRGB = Uint8Array.from({ length: 256 }, (_, value) => {
  const linear = value / 255;
  const srgb =
    linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
});

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

    const gl = renderer.getContext();
    if (gl.isContextLost()) {
      throw new Error("WebGL context is lost; cannot render");
    }

    const { fov, near, far } = readCameraSettings(entity.components?.camera);

    captureCamera.fov = fov;
    captureCamera.near = near;
    captureCamera.far = far;
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
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;

    const prevVisibility = hiddenDuringRender.map((obj) => obj.visible);
    const prevTarget = renderer.getRenderTarget();
    const prevViewport = new THREE.Vector4();
    const prevScissor = new THREE.Vector4();
    renderer.getViewport(prevViewport);
    renderer.getScissor(prevScissor);
    const prevScissorTest = renderer.getScissorTest();
    const prevAutoClear = renderer.autoClear;

    try {
      hiddenDuringRender.forEach((obj) => {
        obj.visible = false;
      });

      renderer.setRenderTarget(target);
      renderer.setScissorTest(false);
      renderer.autoClear = false;
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

      if (gl.isContextLost()) {
        throw new Error("WebGL context was lost during the render");
      }
      if (isBlank(pixels)) {
        throw new Error("Render produced an empty image");
      }

      return pixelsToPngBlob(
        pixels,
        RESOLUTION.width,
        RESOLUTION.height,
        LINEAR_TO_SRGB,
      );
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setViewport(prevViewport);
      renderer.setScissor(prevScissor);
      renderer.setScissorTest(prevScissorTest);
      renderer.autoClear = prevAutoClear;
      hiddenDuringRender.forEach((obj, i) => {
        obj.visible = prevVisibility[i];
      });
      target.dispose();
    }
  }

  return { capture };
}

function pixelsToPngBlob(pixels, width, height, linearToSrgb) {
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
    for (let x = 0; x < rowBytes; x += 4) {
      imageData.data[dstStart + x] = linearToSrgb[imageData.data[dstStart + x]];
      imageData.data[dstStart + x + 1] =
        linearToSrgb[imageData.data[dstStart + x + 1]];
      imageData.data[dstStart + x + 2] =
        linearToSrgb[imageData.data[dstStart + x + 2]];
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("PNG encoding returned an empty result"));
      }
    }, "image/png");
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("PNG data could not be encoded as base64"));
        return;
      }
      const separator = reader.result.indexOf(",");
      if (separator < 0) {
        reject(new Error("PNG data URL is malformed"));
        return;
      }
      resolve(reader.result.slice(separator + 1));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read PNG data"));
    reader.onabort = () => reject(new Error("Reading PNG data was aborted"));
    reader.readAsDataURL(blob);
  });
}

function pickCameraValue(name, value, min, max) {
  if (value == null) return CAMERA_DEFAULTS[name];
  if (Number.isFinite(value) && value >= min && value <= max) return value;
  logger.warn(
    "CameraRender",
    `Invalid camera ${name} (${value}); using default ${CAMERA_DEFAULTS[name]}`,
  );
  return CAMERA_DEFAULTS[name];
}

function readCameraSettings(comp) {
  const fov = pickCameraValue("fov", comp?.fov, 1, 179);
  let near = pickCameraValue("near", comp?.near, 0.01, Infinity);
  const far = Math.max(
    pickCameraValue("far", comp?.far, 1, Infinity),
    SKY_RADIUS + SKY_MARGIN,
  );
  if (near >= far) {
    logger.warn(
      "CameraRender",
      `Camera near (${near}) is not below far (${far}); using default near`,
    );
    near = CAMERA_DEFAULTS.near;
  }
  return { fov, near, far };
}

function isBlank(pixels) {
  const words = new Uint32Array(
    pixels.buffer,
    pixels.byteOffset,
    pixels.byteLength / 4,
  );
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 0) return false;
  }
  return true;
}
