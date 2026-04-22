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

  function push(command) {
    stack.push(command);
    if (stack.length > MAX) stack.shift();
    redoStack.length = 0;
  }

  function undo() {
    const cmd = stack.pop();
    if (!cmd) return;
    cmd.undo();
    redoStack.push(cmd);
  }

  function redo() {
    const cmd = redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    stack.push(cmd);
  }

  return { push, undo, redo };
}
