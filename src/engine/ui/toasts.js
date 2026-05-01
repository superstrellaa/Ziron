import { createIcons, CircleAlert, TriangleAlert, Info, Bug, X } from "lucide";
import { t } from "../i18n/i18n.js";

const VARIANTS = {
  error: { icon: "circle-alert", cssClass: "toast-error" },
  warning: { icon: "triangle-alert", cssClass: "toast-warning" },
  info: { icon: "info", cssClass: "toast-info" },
  debug: { icon: "bug", cssClass: "toast-debug" },
};

const DURATION = 4000;

let container = null;

export function initToastSystem() {
  container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);
}

export function pushToast({
  type = "info",
  titleKey,
  messageKey,
  title,
  message,
  duration = DURATION,
}) {
  if (!container) return;

  const variant = VARIANTS[type] ?? VARIANTS.info;
  const resolvedTitle = title ?? (titleKey ? t(titleKey) : "");
  const resolvedMessage = message ?? (messageKey ? t(messageKey) : "");

  const toast = document.createElement("div");
  toast.className = `toast ${variant.cssClass}`;

  toast.innerHTML = `
    <div class="toast-icon"><i data-lucide="${variant.icon}"></i></div>
    <div class="toast-body">
      ${resolvedTitle ? `<div class="toast-title">${resolvedTitle}</div>` : ""}
      ${resolvedMessage ? `<div class="toast-message">${resolvedMessage}</div>` : ""}
    </div>
    <button class="toast-close"><i data-lucide="x"></i></button>
    <div class="toast-progress"><div class="toast-progress-bar"></div></div>
  `;

  createIcons({
    icons: { CircleAlert, TriangleAlert, Info, Bug, X },
    attrs: { width: 14, height: 14 },
    root: toast,
  });

  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
  });

  const bar = toast.querySelector(".toast-progress-bar");

  let timerStart = null;
  let remaining = duration;
  let timerId = null;

  function startBar() {
    bar.style.transition = `transform ${remaining}ms linear`;
    bar.style.transform = "scaleX(0)";
    timerStart = performance.now();
    timerId = setTimeout(() => dismiss(toast), remaining);
  }

  function pauseBar() {
    if (timerStart === null) return;
    clearTimeout(timerId);
    const elapsed = performance.now() - timerStart;
    remaining = Math.max(0, remaining - elapsed);
    timerStart = null;
    const current = 1 - (duration - remaining) / duration;
    bar.style.transition = "none";
    bar.style.transform = `scaleX(${1 - (duration - remaining) / duration})`;
    const ratio = remaining / duration;
    bar.style.transform = `scaleX(${ratio})`;
  }

  setTimeout(() => startBar(), 350);

  toast.addEventListener("mouseenter", () => pauseBar());
  toast.addEventListener("mouseleave", () => {
    if (remaining > 0 && timerStart === null) {
      bar.style.transition = `transform ${remaining}ms linear`;
      bar.style.transform = "scaleX(0)";
      timerStart = performance.now();
      timerId = setTimeout(() => dismiss(toast), remaining);
    }
  });

  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(timerId);
    dismiss(toast);
  });
}

function dismiss(toast) {
  toast.classList.remove("toast-visible");
  toast.classList.add("toast-hiding");
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}
