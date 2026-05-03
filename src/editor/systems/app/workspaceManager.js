import { t } from "../../../engine/i18n/i18n.js";

let _toolbarTitle = null;
let _workspace = null;

export function initWorkspaceManager() {
  _toolbarTitle = document.querySelector("#toolbar-left span");
  _workspace = document.getElementById("workspace");
}

export function getWorkspace() {
  return _workspace;
}

export function setToolbarProject(projectName = null) {
  if (!_toolbarTitle) return;
  if (projectName) {
    _toolbarTitle.textContent = `${t("general.title")} — ${projectName.toUpperCase()}`;
  } else {
    _toolbarTitle.textContent = t("general.title");
  }
}
