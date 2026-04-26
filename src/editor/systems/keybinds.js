/**
 * ZIRON Keybinds
 *
 * Registro central de todos los atajos de teclado del editor.
 * Cada acción tiene un nombre semántico y una definición de tecla.
 * En el futuro, este objeto puede ser reemplazado por uno cargado desde config.
 */
export const KEYBINDS = {
  // ── Herramientas de transformación ──
  TOOL_TRANSLATE: { key: "w", ctrl: false, shift: false, alt: false },
  TOOL_ROTATE: { key: "e", ctrl: false, shift: false, alt: false },
  TOOL_SCALE: { key: "r", ctrl: false, shift: false, alt: false },

  // ── Historial ──
  UNDO: { key: "z", ctrl: true, shift: false, alt: false },
  REDO: { key: "y", ctrl: true, shift: false, alt: false },

  // ── Entidades ──
  DELETE: { key: "Delete", ctrl: false, shift: false, alt: false },
  DUPLICATE: { key: "d", ctrl: true, shift: false, alt: false },
  RENAME: { key: "F2", ctrl: false, shift: false, alt: false },

  // ── Navegador (bloqueadas) ──
  _BLOCK_FIND: { key: "f", ctrl: true, shift: false, alt: false },
  _BLOCK_PRINT: { key: "p", ctrl: true, shift: false, alt: false },
  _BLOCK_GOTO: { key: "g", ctrl: true, shift: false, alt: false },
};

/**
 * Comprueba si un KeyboardEvent coincide con un keybind definido.
 * @param {KeyboardEvent} e
 * @param {keyof KEYBINDS} action
 */
export function isAction(e, action) {
  const bind = KEYBINDS[action];
  if (!bind) return false;
  return (
    e.key.toLowerCase() === bind.key.toLowerCase() &&
    !!e.ctrlKey === bind.ctrl &&
    !!e.shiftKey === bind.shift &&
    !!e.altKey === bind.alt
  );
}

/**
 * Registra un listener de keybind para una o varias acciones.
 * Devuelve una función de cleanup para eliminar el listener.
 *
 * @param {keyof KEYBINDS | (keyof KEYBINDS)[]} actions
 * @param {(e: KeyboardEvent, action: string) => void} handler
 * @param {EventTarget} target — por defecto window
 */
export function onKeybind(actions, handler, target = window) {
  const list = Array.isArray(actions) ? actions : [actions];

  function onKeyDown(e) {
    for (const action of list) {
      if (isAction(e, action)) {
        handler(e, action);
        return;
      }
    }
  }

  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}
