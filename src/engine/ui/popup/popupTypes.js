import { t } from "../../i18n/i18n.js";
import { openPopup } from "./popup.js";

export const Popup = {
  unsavedScene: () =>
    openPopup({
      type: "warning",
      titleKey: "popups.unsavedScene.title",
      messageKey: "popups.unsavedScene.message",
      buttons: [
        { id: "cancel", labelKey: "popups.buttons.cancel", variant: "default" },
        {
          id: "discard",
          labelKey: "popups.buttons.discardAndClose",
          variant: "danger",
        },
        {
          id: "save",
          labelKey: "popups.buttons.saveAndContinue",
          variant: "primary",
        },
      ],
    }),

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
    }),

  deleteFolderConfirm: (folderName) =>
    openPopup({
      type: "warning",
      titleKey: "popups.deleteFolder.title",
      message: t("popups.deleteFolder.message").replace("{folder}", folderName),
      buttons: [
        { id: "cancel", labelKey: "popups.buttons.cancel", variant: "default" },
        {
          id: "delete",
          labelKey: "popups.buttons.delete",
          variant: "danger",
        },
      ],
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
    }),

  /**
   * Confirmación genérica
   * Resuelve con: "confirm" | "cancel"
   */
  confirm: (titleKey, messageKey) =>
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
    }),
};
