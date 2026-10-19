import {
  createIcons,
  CircleAlert,
  TriangleAlert,
  Info,
  AlertCircle,
  X,
} from "lucide";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { t } from "../../i18n/i18n.js";
import { Toast } from "../toasts/toastTypes.js";
import { logger } from "../../core/logger.js";

// Margen sobre la duración de la transición CSS del popup
const CLOSE_FALLBACK_MS = 500;

let overlay = null;
let currentResolve = null;
let _keybindHandler = null;
let _closing = false;
const _queue = [];

const VARIANTS = {
  error: { icon: "circle-alert", cssClass: "popup-error" },
  warning: { icon: "triangle-alert", cssClass: "popup-warning" },
  info: { icon: "info", cssClass: "popup-info" },
};

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function initPopupSystem() {
  if (overlay?.isConnected) return;
  overlay = document.createElement("div");
  overlay.id = "popup-overlay";
  overlay.innerHTML = `<div id="popup-box"></div>`;
  document.body.appendChild(overlay);
}

export function openPopup(options) {
  return new Promise((resolve) => {
    if (!overlay) {
      logger.error(
        "popup",
        "Popup requested before initPopupSystem(); ignored",
      );
      resolve(null);
      return;
    }
    _queue.push({ options, resolve });
    _showNext();
  });
}

function _showNext() {
  if (currentResolve || _queue.length === 0) return;

  const { options, resolve } = _queue.shift();
  currentResolve = resolve;
  _closing = false;

  try {
    _render(options);
  } catch (e) {
    logger.error("popup", `Failed to render popup | Error: ${e}`);
    _finish(null);
  }
}

function _render({
  type = "info",
  title,
  titleKey,
  message,
  messageHtml,
  messageKey,
  buttons = [],
  keybinds = null,
}) {
  const variant = VARIANTS[type] ?? VARIANTS.info;
  const resolvedTitle = title ?? (titleKey ? t(titleKey) : "");
  const resolvedMessage = message ?? (messageKey ? t(messageKey) : "");
  const messageMarkup =
    messageHtml ?? (resolvedMessage ? escapeHtml(resolvedMessage) : "");

  const box = overlay.querySelector("#popup-box");
  box.className = `popup-box ${variant.cssClass}`;

  const buttonsHTML = buttons
    .map((btn) => {
      const label = btn.label ?? (btn.labelKey ? t(btn.labelKey) : btn.id);
      const cls =
        btn.variant === "primary"
          ? "popup-btn popup-btn-primary"
          : btn.variant === "danger"
            ? "popup-btn popup-btn-danger"
            : "popup-btn";
      return `<button class="${cls}" data-id="${escapeHtml(btn.id)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  box.innerHTML = `
    <div class="popup-icon"><i data-lucide="${variant.icon}"></i></div>
    <div class="popup-title">${escapeHtml(resolvedTitle)}</div>
    ${messageMarkup ? `<div class="popup-message">${messageMarkup}</div>` : ""}
    <div class="popup-buttons">${buttonsHTML}</div>
  `;

  createIcons({
    icons: { CircleAlert, TriangleAlert, Info },
    attrs: { width: 28, height: 28 },
    root: box,
  });

  box.querySelectorAll(".popup-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (_closing) return;
      const id = btn.dataset.id;

      const btnDef = buttons.find((b) => b.id === id);
      if (btnDef?.copyText != null) {
        try {
          logger.info("popup", "Copying popup text to clipboard");
          await writeText(String(btnDef.copyText));
          Toast.contentCopied();
        } catch (err) {
          logger.error("popup", `Failed to copy to clipboard | Error: ${err}`);
          Toast.generalError();
        }
      }

      close(id);
    });
  });

  if (keybinds) {
    _keybindHandler = (e) => {
      const buttonId = keybinds[e.key];
      if (!buttonId) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // tecla mantenida: se traga, pero no actúa
      if (buttons.some((b) => b.id === buttonId)) {
        close(buttonId);
      }
    };
    window.addEventListener("keydown", _keybindHandler, { capture: true });
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!_closing) overlay.classList.add("popup-visible");
    });
  });
}

function close(resultId) {
  if (_closing || !currentResolve) return;
  _closing = true;

  if (_keybindHandler) {
    window.removeEventListener("keydown", _keybindHandler, { capture: true });
    _keybindHandler = null;
  }

  overlay.classList.remove("popup-visible");
  overlay.classList.add("popup-hiding");

  let done = false;
  let timer = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    overlay.removeEventListener("transitionend", finish);
    _finish(resultId);
  };

  overlay.addEventListener("transitionend", finish);
  timer = setTimeout(finish, CLOSE_FALLBACK_MS);
}

function _finish(resultId) {
  if (_keybindHandler) {
    window.removeEventListener("keydown", _keybindHandler, { capture: true });
    _keybindHandler = null;
  }

  overlay.classList.remove("popup-visible", "popup-hiding");
  overlay.querySelector("#popup-box").innerHTML = "";

  const resolve = currentResolve;
  currentResolve = null;
  _closing = false;

  resolve?.(resultId);
  _showNext();
}
