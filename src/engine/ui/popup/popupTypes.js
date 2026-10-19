import { t } from "../../i18n/i18n.js";
import { openPopup, escapeHtml } from "./popup.js";

const UNSAVED_LABELS = {
  close: {
    discard: "popups.buttons.discardAndClose",
    save: "popups.buttons.saveAndClose",
  },
  restart: {
    discard: "popups.buttons.discardAndRestart",
    save: "popups.buttons.saveAndRestart",
  },
  continue: {
    discard: "popups.buttons.discardAndContinue",
    save: "popups.buttons.saveAndContinue",
  },
};

export const Popup = {
  fatalStartupError: (summary, fullText = summary) =>
    openPopup({
      type: "error",
      titleKey: "popups.startupError.title",
      messageHtml: `${escapeHtml(t("popups.startupError.message"))}<br><br>${escapeHtml(summary)}`,
      buttons: [
        {
          id: "copy",
          labelKey: "popups.buttons.copyError",
          copyText: fullText,
          variant: "default",
        },
        { id: "quit", labelKey: "popups.buttons.closeApp", variant: "primary" },
      ],
    }),

  unsavedScene: (action = "continue") => {
    const labels = UNSAVED_LABELS[action] ?? UNSAVED_LABELS.continue;
    return openPopup({
      type: "warning",
      titleKey: "popups.unsavedScene.title",
      messageKey: "popups.unsavedScene.message",
      buttons: [
        { id: "cancel", labelKey: "popups.buttons.cancel", variant: "default" },
        { id: "discard", labelKey: labels.discard, variant: "danger" },
        { id: "save", labelKey: labels.save, variant: "primary" },
      ],
      keybinds: { Escape: "cancel", Enter: "save" },
    });
  },

  versionMismatch: (projectVersion, engineVersion) =>
    openPopup({
      type: "error",
      titleKey: "popups.versionMismatch.title",
      message: t("popups.versionMismatch.message")
        .replace("{project}", projectVersion)
        .replace("{engine}", engineVersion),
      buttons: [
        {
          id: "cancel",
          labelKey: "popups.buttons.closeAndRevert",
          variant: "danger",
        },
        {
          id: "continue",
          labelKey: "popups.buttons.continueAndUpdate",
          variant: "primary",
        },
      ],
      keybinds: { Escape: "cancel" },
    }),

  restartRequired: () =>
    openPopup({
      type: "warning",
      titleKey: "popups.restartRequired.title",
      messageKey: "popups.restartRequired.message",
      buttons: [
        { id: "later", labelKey: "popups.buttons.later", variant: "default" },
        {
          id: "restart",
          labelKey: "popups.buttons.restart",
          variant: "primary",
        },
      ],
      keybinds: { Escape: "later", Enter: "restart" },
    }),

  deleteFolderConfirm: (folderName) =>
    openPopup({
      type: "warning",
      titleKey: "popups.deleteFolder.title",
      message: t("popups.deleteFolder.message").replace("{folder}", folderName),
      buttons: [
        { id: "cancel", labelKey: "popups.buttons.cancel", variant: "default" },
        { id: "delete", labelKey: "popups.buttons.delete", variant: "danger" },
      ],
      keybinds: { Escape: "cancel", Enter: "delete" },
    }),

  deleteFileConfirm: (fileName) =>
    openPopup({
      type: "warning",
      titleKey: "popups.deleteFile.title",
      message: t("popups.deleteFile.message").replace("{file}", fileName),
      buttons: [
        { id: "cancel", labelKey: "popups.buttons.cancel", variant: "default" },
        { id: "delete", labelKey: "popups.buttons.delete", variant: "danger" },
      ],
      keybinds: { Escape: "cancel", Enter: "delete" },
    }),

  /**
   * Archivo arrastrado desde el SO con una extensión no soportada.
   * Resuelve con: "close"
   */
  unsupportedFileType: (fileName) =>
    openPopup({
      type: "error",
      titleKey: "popups.unsupportedFileType.title",
      message: t("popups.unsupportedFileType.message").replace(
        "{file}",
        fileName ?? "",
      ),
      buttons: [
        { id: "close", labelKey: "popups.buttons.close", variant: "primary" },
      ],
      keybinds: { Escape: "close", Enter: "close" },
    }),

  updateAvailable: (version) =>
    openPopup({
      type: "info",
      title: t("popups.updateAvailable.title").replaceAll("{version}", version),
      message: t("popups.updateAvailable.message").replaceAll(
        "{version}",
        version,
      ),
      buttons: [
        {
          id: "dismiss",
          labelKey: "popups.buttons.dontShowAgain",
          variant: "default",
        },
        {
          id: "later",
          labelKey: "popups.buttons.updateLater",
          variant: "default",
        },
        { id: "update", labelKey: "popups.buttons.update", variant: "primary" },
      ],
      keybinds: { Escape: "later", Enter: "update" },
    }),

  sceneLoadIssues: (count, summary, fullText = summary, backupNote = "") =>
    openPopup({
      type: "warning",
      titleKey: "popups.sceneLoadIssues.title",
      messageHtml:
        `${escapeHtml(t("popups.sceneLoadIssues.message").replace("{n}", count))}<br><br>` +
        `${escapeHtml(summary).replaceAll("\n", "<br>")}` +
        (backupNote ? `<br><br>${escapeHtml(backupNote)}` : ""),
      buttons: [
        {
          id: "copy",
          labelKey: "popups.buttons.copyError",
          copyText: fullText,
          variant: "default",
        },
        { id: "close", labelKey: "popups.buttons.close", variant: "primary" },
      ],
      keybinds: { Escape: "close" },
    }),

  /**
   * Error genérico con opción de copiar el mensaje
   * Resuelve con: "close"
   */
  error: (errorText) =>
    openPopup({
      type: "error",
      titleKey: "popups.error.title",
      message: errorText,
      buttons: [
        {
          id: "copy",
          labelKey: "popups.buttons.copyError",
          copyText: errorText,
          variant: "default",
        },
        { id: "close", labelKey: "popups.buttons.close", variant: "primary" },
      ],
      keybinds: { Escape: "close" },
    }),

  /**
   * Confirmación genérica
   * Resuelve con: "confirm" | "cancel"
   */
  confirm: (titleKey, messageKey, keybinds = { Escape: "cancel" }) =>
    openPopup({
      type: "warning",
      titleKey,
      messageKey,
      buttons: [
        { id: "cancel", labelKey: "popups.buttons.cancel", variant: "default" },
        {
          id: "confirm",
          labelKey: "popups.buttons.confirm",
          variant: "primary",
        },
      ],
      keybinds,
    }),
};
