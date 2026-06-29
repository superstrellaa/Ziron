import { convertFileSrc } from "@tauri-apps/api/core";

let _container = null;

const W = 200;
const H = 180;

export function initTexturePreview() {
  _container = document.createElement("div");
  _container.id = "texture-preview-tooltip";
  document.body.appendChild(_container);

  const imgWrap = document.createElement("div");
  imgWrap.id = "texture-preview-imgwrap";
  const img = document.createElement("img");
  img.id = "texture-preview-img";
  imgWrap.appendChild(img);
  _container.appendChild(imgWrap);

  const label = document.createElement("div");
  label.id = "texture-preview-label";
  _container.appendChild(label);
}

export function showTexturePreview(absolutePath, name, x, y) {
  if (!_container) return;
  _container.querySelector("#texture-preview-img").src =
    convertFileSrc(absolutePath);
  _container.querySelector("#texture-preview-label").textContent = name;
  _setPosition(x, y);
  _container.classList.add("visible");
}

export function hideTexturePreview() {
  if (!_container) return;
  _container.classList.remove("visible");
}

export function moveTexturePreview(x, y) {
  if (!_container) return;
  _setPosition(x, y);
}

function _setPosition(x, y) {
  const offset = 14;
  let px = x + offset;
  let py = y + offset;
  const totalH = H + 28;
  if (px + W > window.innerWidth) px = x - W - offset;
  if (py + totalH > window.innerHeight) py = y - totalH - offset;
  _container.style.left = px + "px";
  _container.style.top = py + "px";
}
