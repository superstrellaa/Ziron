import { pushToast } from "./toasts.js";

export const Toast = {
  generalError: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.generalError.title",
      messageKey: "toasts.generalError.message",
      ...extra,
    }),
  saveSuccess: (extra) =>
    pushToast({
      type: "info",
      titleKey: "toasts.saveSuccess.title",
      messageKey: "toasts.saveSuccess.message",
      duration: 2500,
      ...extra,
    }),
  saveError: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.saveError.title",
      messageKey: "toasts.saveError.message",
      ...extra,
    }),
  loadError: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.loadError.title",
      messageKey: "toasts.loadError.message",
      ...extra,
    }),
  createProjectError: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.createProjectError.title",
      messageKey: "toasts.createProjectError.message",
      ...extra,
    }),
  loadRecentsError: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.loadRecentsError.title",
      messageKey: "toasts.loadRecentsError.message",
      ...extra,
    }),
  projectNotFound: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.projectNotFound.title",
      messageKey: "toasts.projectNotFound.message",
      ...extra,
    }),
  contentCopied: (extra) =>
    pushToast({
      type: "info",
      titleKey: "toasts.contentCopied.title",
      messageKey: "toasts.contentCopied.message",
      ...extra,
    }),
  projectRemovedRecents: (extra) =>
    pushToast({
      type: "info",
      titleKey: "toasts.projectRemovedRecents.title",
      messageKey: "toasts.projectRemovedRecents.message",
      ...extra,
    }),
  info: (title, message, duration) =>
    pushToast({ type: "info", title, message, duration }),
  warning: (title, message, duration) =>
    pushToast({ type: "warning", title, message, duration }),
  error: (title, message, duration) =>
    pushToast({ type: "error", title, message, duration }),
  debug: (title, message, duration) =>
    pushToast({ type: "debug", title, message, duration }),
};
