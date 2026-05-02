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

let overlay = null;
let currentResolve = null;

const VARIANTS = {
  error: { icon: "circle-alert", cssClass: "popup-error" },
  warning: { icon: "triangle-alert", cssClass: "popup-warning" },
  info: { icon: "info", cssClass: "popup-info" },
};

export function initPopupSystem() {
  overlay = document.createElement("div");
  overlay.id = "popup-overlay";
  overlay.innerHTML = `<div id="popup-box"></div>`;
  document.body.appendChild(overlay);
}

export function openPopup({
  type = "info",
  title,
  titleKey,
  message,
  messageKey,
  buttons = [],
}) {
  return new Promise((resolve) => {
    if (currentResolve) {
      return;
    }
    currentResolve = resolve;

    const variant = VARIANTS[type] ?? VARIANTS.info;
    const resolvedTitle = title ?? (titleKey ? t(titleKey) : "");
    const resolvedMessage = message ?? (messageKey ? t(messageKey) : "");

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
        return `<button class="${cls}" data-id="${btn.id}">${label}</button>`;
      })
      .join("");

    box.innerHTML = `
      <div class="popup-icon"><i data-lucide="${variant.icon}"></i></div>
      <div class="popup-title">${resolvedTitle}</div>
      ${resolvedMessage ? `<div class="popup-message">${resolvedMessage}</div>` : ""}
      <div class="popup-buttons">${buttonsHTML}</div>
    `;

    createIcons({
      icons: { CircleAlert, TriangleAlert, Info },
      attrs: { width: 28, height: 28 },
      root: box,
    });

    box.querySelectorAll(".popup-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;

        const btnDef = buttons.find((b) => b.id === id);
        if (btnDef?.copyText) {
          await writeText(btnDef.copyText).catch(() => {});
          Toast.contentCopied();
        }

        close(id);
      });
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add("popup-visible"));
    });
  });
}

function close(resultId) {
  overlay.classList.remove("popup-visible");
  overlay.classList.add("popup-hiding");

  overlay.addEventListener(
    "transitionend",
    () => {
      overlay.classList.remove("popup-hiding");
      overlay.querySelector("#popup-box").innerHTML = "";
      const resolve = currentResolve;
      currentResolve = null;
      resolve?.(resultId);
    },
    { once: true },
  );
}
