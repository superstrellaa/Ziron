export default {
  general: {
    title: "ZIRON",
  },
  toolbar: {
    file: "File",
    save: "Save",
    load: "Open Project",
    newProject: "New Project",
    closeProject: "Close Project",
  },
  welcome: {
    recentProjects: "Recent Projects",
    newProject: "New Project",
    openProject: "Open Project",
    noRecents: "No recent projects",
    version: "ZIRON Engine — Early Dev",
    newProjectPanel: {
      title: "New Project",
      nameLabel: "Project Name",
      namePlaceholder: "MyGame",
      folderLabel: "Projects Folder",
      folderPlaceholder: "No folder selected",
      browseBtn: "Browse",
      createBtn: "Create Project",
      preview: "Will be created at:",
    },
  },
  contextMenu: {
    add: "Add",
    delete: "Delete",
    duplicate: "Duplicate",
    rename: "Rename",
    copy: "Copy",
    paste: "Paste",
    objects3d: "3D Object",
    cube: "Cube",
    sphere: "Sphere",
    capsule: "Capsule",
    cylinder: "Cylinder",
    plane: "Plane",
    cone: "Cone",
  },
  transform: {
    translate: "Move (W)",
    rotate: "Rotate (E)",
    scale: "Scale (R)",
    handle: "Drag / Snap position",
  },
  hierarchy: {
    header: "Scene",
  },
  toasts: {
    generalError: { title: "Error", message: "Something went wrong." },
    saveSuccess: { title: "Saved", message: "Scene saved successfully." },
    saveError: { title: "Save Failed", message: "Could not save the scene." },
    loadError: { title: "Load Failed", message: "Could not load the scene." },
    createProjectError: {
      title: "Project Creation Failed",
      message: "Could not create the project.",
    },
    loadRecentsError: {
      title: "Load Failed",
      message: "Could not load recent projects.",
    },
    projectNotFound: {
      title: "Project Not Found",
      message: "The selected project could not be found.",
    },
  },
  popups: {
    unsavedScene: {
      title: "Unsaved Changes",
      message: "The scene has unsaved changes. What do you want to do?",
    },
    versionMismatch: {
      title: "Version Mismatch",
      message:
        "This project was created with ZIRON {project}, but you're running ZIRON {engine}. Opening it may cause issues.",
    },
    error: {
      title: "An error occurred",
    },
    buttons: {
      close: "Close",
      cancel: "Cancel",
      confirm: "Confirm",
      copyError: "Copy Error",
      saveAndContinue: "Save and Continue",
      discardAndClose: "Discard and Close",
      closeAndRevert: "Close",
      continueAndUpdate: "Continue and Update",
    },
  },
};
