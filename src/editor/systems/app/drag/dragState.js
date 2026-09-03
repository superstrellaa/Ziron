let _draggingModel = null;

export function setDraggingModel(payload) {
  _draggingModel = payload;
}

export function getDraggingModel() {
  return _draggingModel;
}

export function clearDraggingModel() {
  _draggingModel = null;
}
