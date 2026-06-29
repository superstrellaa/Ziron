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
  createProjectSuccess: (extra) =>
    pushToast({
      type: "info",
      titleKey: "toasts.createProjectSuccess.title",
      messageKey: "toasts.createProjectSuccess.message",
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
  settingsSaved: (extra) =>
    pushToast({
      type: "info",
      titleKey: "toasts.settingsSaved.title",
      messageKey: "toasts.settingsSaved.message",
      ...extra,
    }),
  autoSaveProject: (extra) =>
    pushToast({
      type: "info",
      titleKey: "toasts.autoSaveProject.title",
      messageKey: "toasts.autoSaveProject.message",
      ...extra,
    }),
  updateProjectVersionError: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.updateProjectVersionError.title",
      messageKey: "toasts.updateProjectVersionError.message",
      ...extra,
    }),
  failedToLoadConfig: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToLoadConfig.title",
      messageKey: "toasts.failedToLoadConfig.message",
      ...extra,
    }),
  failedToSaveConfig: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToSaveConfig.title",
      messageKey: "toasts.failedToSaveConfig.message",
      ...extra,
    }),
  failedToLoadAssetTree: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToLoadAssetTree.title",
      messageKey: "toasts.failedToLoadAssetTree.message",
      ...extra,
    }),
  failedToCreateFolder: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToCreateFolder.title",
      messageKey: "toasts.failedToCreateFolder.message",
      ...extra,
    }),
  failedToDeleteFolder: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToDeleteFolder.title",
      messageKey: "toasts.failedToDeleteFolder.message",
      ...extra,
    }),
  failedToDuplicateFolder: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToDuplicateFolder.title",
      messageKey: "toasts.failedToDuplicateFolder.message",
      ...extra,
    }),
  failedToRenameFolder: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToRenameFolder.title",
      messageKey: "toasts.failedToRenameFolder.message",
      ...extra,
    }),
  failedToImportTexture: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToImportTexture.title",
      messageKey: "toasts.failedToImportTexture.message",
      ...extra,
    }),
  failedToImportModel: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToImportModel.title",
      messageKey: "toasts.failedToImportModel.message",
      ...extra,
    }),
  failedToDeleteModel: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToDeleteModel.title",
      messageKey: "toasts.failedToDeleteModel.message",
      ...extra,
    }),
  failedToDuplicateModel: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToDuplicateModel.title",
      messageKey: "toasts.failedToDuplicateModel.message",
      ...extra,
    }),
  failedToRenameModel: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToRenameModel.title",
      messageKey: "toasts.failedToRenameModel.message",
      ...extra,
    }),
  failedToOpenProject: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToOpenProject.title",
      messageKey: "toasts.failedToOpenProject.message",
      ...extra,
    }),
  unknownEntityType: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.unknownEntityType.title",
      messageKey: "toasts.unknownEntityType.message",
      ...extra,
    }),
  failedToLoadTexture: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToLoadTexture.title",
      messageKey: "toasts.failedToLoadTexture.message",
      ...extra,
    }),
  failedToLoadModel: (extra) =>
    pushToast({
      type: "error",
      titleKey: "toasts.failedToLoadModel.title",
      messageKey: "toasts.failedToLoadModel.message",
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
