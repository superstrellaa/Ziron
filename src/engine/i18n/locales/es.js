export default {
  general: {
    title: "ZIRON",
  },
  toolbar: {
    file: "Archivo",
    save: "Guardar",
    load: "Cargar",
    newProject: "Nuevo Proyecto",
    closeProject: "Cerrar Proyecto",
  },
  welcome: {
    recentProjects: "Proyectos Recientes",
    newProject: "Nuevo Proyecto",
    openProject: "Abrir Proyecto",
    noRecents: "No hay proyectos recientes",
    version: "ZIRON Engine — Desarrollo Temprano",
    newProjectPanel: {
      title: "Nuevo Proyecto",
      nameLabel: "Nombre del Proyecto",
      namePlaceholder: "MiJuego",
      folderLabel: "Carpeta de Proyectos",
      folderPlaceholder: "No se ha seleccionado carpeta",
      browseBtn: "Examinar",
      createBtn: "Crear Proyecto",
      preview: "Se creará en:",
    },
  },
  contextMenu: {
    add: "Añadir",
    delete: "Eliminar",
    duplicate: "Duplicar",
    rename: "Renombrar",
    copy: "Copiar",
    paste: "Pegar",
    objects3d: "Objeto 3D",
    cube: "Cubo",
    sphere: "Esfera",
    capsule: "Cápsula",
    cylinder: "Cilindro",
    plane: "Plano",
    cone: "Cono",
  },
  transform: {
    translate: "Mover (W)",
    rotate: "Rotar (E)",
    scale: "Escalar (R)",
    handle: "Arrastrar / Ajustar posición",
  },
  hierarchy: {
    header: "Escena",
  },
  toasts: {
    generalError: { title: "Error", message: "Algo salió mal." },
    saveSuccess: {
      title: "Guardado",
      message: "Escena guardada exitosamente.",
    },
    saveError: {
      title: "Error al Guardar",
      message: "No se pudo guardar la escena.",
    },
    loadError: {
      title: "Error al Cargar",
      message: "No se pudo cargar la escena.",
    },
    createProjectError: {
      title: "Error al Crear Proyecto",
      message: "No se pudo crear el proyecto.",
    },
    loadRecentsError: {
      title: "Error al Cargar",
      message: "No se pudieron cargar los proyectos recientes.",
    },
    projectNotFound: {
      title: "Proyecto No Encontrado",
      message: "No se pudo encontrar el proyecto.",
    },
    contentCopied: {
      title: "Contenido Copiado",
      message: "El contenido ha sido copiado al portapapeles.",
    },
  },
  popups: {
    unsavedScene: {
      title: "Cambios No Guardados",
      message: "La escena tiene cambios no guardados. ¿Qué quieres hacer?",
    },
    versionMismatch: {
      title: "Incompatibilidad de Versiones",
      message:
        "La versión del proyecto no coincide con la versión del motor. Esto puede causar problemas. ¿Qué quieres hacer?",
    },
    error: {
      title: "Ocurrió un error",
    },
    buttons: {
      close: "Cerrar",
      cancel: "Cancelar",
      confirm: "Confirmar",
      copyError: "Copiar Error",
      saveAndContinue: "Guardar y Continuar",
      discardAndClose: "Descartar y Cerrar",
      closeAndRevert: "Cerrar",
      continueAndUpdate: "Continuar y Actualizar",
    },
  },
};
