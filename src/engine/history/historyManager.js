export const EventType = {
  MoveObject: "MoveObject",
  RotateObject: "RotateObject",
  ScaleObject: "ScaleObject",
  CreateObject: "CreateObject",
  DeleteObject: "DeleteObject",
};

export function createHistoryManager() {
  const stack = [];
  const redoStack = [];
  const MAX = 100;
  let _dirty = false;
  let _onDirtyChange = null;

  function setDirty(val) {
    if (_dirty === val) return;
    _dirty = val;
    _onDirtyChange?.(val);
  }

  function push(command) {
    stack.push(command);
    if (stack.length > MAX) stack.shift();
    redoStack.length = 0;
    setDirty(true);
  }

  function undo() {
    const cmd = stack.pop();
    if (!cmd) return;
    cmd.undo();
    redoStack.push(cmd);
    setDirty(true);
  }

  function redo() {
    const cmd = redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    stack.push(cmd);
    setDirty(true);
  }

  function markClean() {
    setDirty(false);
  }

  function isDirty() {
    return _dirty;
  }

  function onDirtyChange(cb) {
    _onDirtyChange = cb;
  }

  return { push, undo, redo, markClean, isDirty, onDirtyChange };
}
