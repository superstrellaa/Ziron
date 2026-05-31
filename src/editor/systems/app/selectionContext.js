let _context = null;
const _clearScene = [];
const _clearAssets = [];

export function activateScene() {
  if (_context === "assets") _clearAssets.forEach((cb) => cb());
  _context = "scene";
}

export function activateAssets() {
  if (_context === "scene") _clearScene.forEach((cb) => cb());
  _context = "assets";
}

export function getContext() {
  return _context;
}
export function onClearScene(cb) {
  _clearScene.push(cb);
}
export function onClearAssets(cb) {
  _clearAssets.push(cb);
}
