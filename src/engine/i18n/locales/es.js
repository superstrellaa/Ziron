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
    settings: "Ajustes",
  },
  dropOverlay: {
    title: "Soltar archivo",
    subtitle:
      "Suéltalo aquí para importarlo en la carpeta de assets actualmente abierta",
  },
  welcome: {
    recentProjects: "Proyectos Recientes",
    newProject: "Nuevo Proyecto",
    openProject: "Abrir Proyecto",
    noRecents: "No hay proyectos recientes",
    lastOpened: "Último acceso",
    justNow: "Ahora mismo",
    minutesAgo: "Hace {n} minutos",
    hoursAgo: "Hace {n} horas",
    daysAgo: "Hace {n} días",
    version: "ZIRON Studio — Desarrollo Temprano",
    newProjectPanel: {
      title: "Nuevo Proyecto",
      nameLabel: "Nombre del Proyecto",
      namePlaceholder: "Mi Escene Épica",
      folderLabel: "Carpeta de Proyectos",
      folderPlaceholder: "No se ha seleccionado carpeta",
      browseBtn: "Examinar",
      createBtn: "Crear Proyecto",
      preview: "Se creará en:",
      closeBtnTooltip: "Cerrar",
    },
  },
  settings: {
    title: "Ajustes",
    categoryEditor: "Editor",
    general: "General",
    keybinds: "Atajos de Teclado",
    updater: "Actualizador",
    cancel: "Cancelar",
    save: "Guardar cambios",
    groupInterface: "Interfaz",
    groupProjects: "Proyectos",
    groupKeybinds: "Atajos de Teclado",
    language: "Idioma",
    languageDesc: "Idioma de la interfaz del editor",
    discordRpc: "Discord Rich Presence",
    discordRpcDesc: "Mostrar actividad en Discord",
    defaultFolder: "Carpeta predeterminada de proyectos",
    defaultFolderNone: "No se ha seleccionado carpeta",
    autosave: "Guardado automático",
    autosaveDesc: "Guardar automáticamente cada N minutos",
    autosaveInterval: "Intervalo de guardado automático",
    autosaveIntervalDesc:
      "Con qué frecuencia guardar la escena automáticamente",
    browse: "Examinar",
    keybindGroups: {
      general: "General",
      history: "Historial",
      entities: "Entidades",
      tools: "Herramientas",
      selection: "Selección",
    },
  },
  updater: {
    installed: "Instalada",
    check: "Buscar nueva versión",
    checkTip:
      "Se busca sola al abrir esta pestaña; úsalo para forzar otra consulta",
    history: "Ver notas anteriores",
    historyTip: "Consulta qué cambió en versiones anteriores",
    status: {
      checking: "Buscando actualizaciones...",
      upToDate: "Estás al día",
      available: "Hay una actualización disponible",
      error: "No se pudo comprobar si hay actualizaciones",
    },
    bannerTitle: "Nueva versión disponible",
    download: "Descargar",
    downloadTip: "Solo descarga; instalas cuando tú quieras",
    downloading: "Descargando...",
    install: "Instalar y reiniciar",
    installTip:
      "Cierra el editor, instala y lo reabre. Avisa si hay cambios sin guardar",
    installing: "Instalando...",
    currentNotes: "Notas de esta versión",
    previousNotes: "Versiones anteriores",
    notesLoading: "Cargando notas...",
    notesUnavailable: "No se pudieron cargar las notas. ¿Sin conexión?",
    noNotes: "Sin notas para esta versión.",
  },
  keybind: {
    save: "Guardar",
    undo: "Deshacer",
    redo: "Rehacer",
    duplicate: "Duplicar",
    delete: "Eliminar",
    copy: "Copiar",
    paste: "Pegar",
    rename: "Renombrar",
    settings: "Abrir Ajustes",
    translate: "Mover",
    rotate: "Rotar",
    scale: "Escalar",
    selectAdd: "Añadir a la selección",
  },
  contextMenu: {
    add: "Añadir",
    delete: "Eliminar",
    duplicate: "Duplicar",
    rename: "Renombrar",
    copy: "Copiar",
    paste: "Pegar",
    import: "Importar",
    objects3d: "Objeto 3D",
    cube: "Cubo",
    sphere: "Esfera",
    capsule: "Cápsula",
    cylinder: "Cilindro",
    plane: "Plano",
    cone: "Cono",
    technicalObject: "Objetos Técnicos",
    camera: "Cámara",
  },
  transform: {
    translate: "Mover (W)",
    rotate: "Rotar (E)",
    scale: "Escalar (R)",
    handle: "Arrastrar / Ajustar posición",
  },
  viewport: {
    cameraPreview: "Vista Previa",
  },
  hierarchy: {
    header: "Escena",
    modelNotFound: "Archivo de modelo no encontrado",
  },
  properties: {
    header: "Propiedades",
    empty: "No hay entidad seleccionada",
    name: "Nombre",
    nameTip: "Nombre de la entidad",
    active: "Activo",
    activeTip: "Alternar visibilidad de la entidad",
    position: "Posición",
    rotation: "Rotación (grados)",
    scale: "Escala",
  },
  assetPicker: {
    title: "Seleccionar Asset",
    loading: "Cargando assets...",
    empty: "No se encontraron assets",
  },
  components: {
    model: { title: "Modelo", texture: "Textura" },
    camera: {
      title: "Cámara",
      fov: "FOV",
      fovTip: "Campo de visión vertical de la cámara, en grados",
      near: "Cercano",
      nearTip:
        "Distancia mínima desde la cámara a partir de la cual se renderiza",
      far: "Lejano",
      farTip: "Distancia máxima desde la cámara hasta la que se renderiza",
      centerToCamera: "Alinear a Vista",
      centerToCameraTip:
        "Mueve esta cámara a la posición y rotación exactas de la vista actual del editor",
      renderCamera: "Renderizar",
      renderCameraTip:
        "Captura una foto en alta resolución desde esta cámara y la guarda como PNG",
    },
    texture: {
      empty: "Sin textura asignada",
      pickTip: "Click para seleccionar una textura",
    },
  },
  assets: {
    header: "Assets",
    project: "Proyecto",
    scenes: "Escenas",
    empty: "Sin assets",
    addFolder: "Añadir Carpeta",
    newFolderName: "Nombre de carpeta",
    importModel: "Importar Modelo",
    importTexture: "Importar Textura",
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
    createProjectSuccess: {
      title: "Proyecto Creado",
      message: "El proyecto ha sido creado exitosamente.",
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
    projectRemovedRecents: {
      title: "Proyecto Eliminado",
      message: "El proyecto ha sido eliminado de los proyectos recientes.",
    },
    settingsSaved: {
      title: "Ajustes Guardados",
      message: "Tus ajustes han sido guardados.",
    },
    autoSaveProject: {
      title: "Proyecto Guardado Automáticamente",
      message: "Tu proyecto ha sido guardado automáticamente.",
    },
    updateProjectVersionError: {
      title: "Error al Actualizar Proyecto",
      message:
        "El proyecto no se pudo actualizar a la última versión de ZIRON Studio.",
    },
    failedToLoadConfig: {
      title: "Error al Cargar Configuración",
      message: "No se pudo cargar el archivo de configuración principal.",
    },
    failedToSaveConfig: {
      title: "Error al Guardar Configuración",
      message: "No se pudo guardar el archivo de configuración principal.",
    },
    failedToLoadAssetTree: {
      title: "Error al Cargar Árbol de Assets",
      message: "No se pudo cargar el árbol de assets del proyecto.",
    },
    failedToCreateFolder: {
      title: "Error al Crear Carpeta",
      message: "No se pudo crear la carpeta.",
    },
    failedToDeleteFolder: {
      title: "Error al Eliminar Carpeta",
      message: "No se pudo eliminar la carpeta.",
    },
    failedToDuplicateFolder: {
      title: "Error al Duplicar Carpeta",
      message: "No se pudo duplicar la carpeta.",
    },
    failedToRenameFolder: {
      title: "Error al Renombrar Carpeta",
      message: "No se pudo renombrar la carpeta.",
    },
    failedToImportTexture: {
      title: "Error al Importar Textura",
      message: "No se pudo importar la textura.",
    },
    failedToImportModel: {
      title: "Error al Importar Modelo",
      message: "No se pudo importar el modelo.",
    },
    failedToDeleteModel: {
      title: "Error al Eliminar Modelo",
      message: "No se pudo eliminar el modelo.",
    },
    failedToDuplicateModel: {
      title: "Error al Duplicar Modelo",
      message: "No se pudo duplicar el modelo.",
    },
    failedToRenameModel: {
      title: "Error al Renombrar Modelo",
      message: "No se pudo renombrar el modelo.",
    },
    failedToOpenProject: {
      title: "Error al Abrir Proyecto",
      message: "No se pudo abrir el proyecto.",
    },
    unknownEntityType: {
      title: "Tipo de Entidad Desconocido",
      message: "El tipo de entidad no es reconocido.",
    },
    failedToLoadTexture: {
      title: "Error al Cargar Textura",
      message: "No se pudo cargar la textura.",
    },
    failedToLoadModel: {
      title: "Error al Cargar Modelo",
      message: "No se pudo cargar el modelo.",
    },
    failedToRenderScene: {
      title: "Error al Renderizar Escena",
      message: "No se pudo renderizar la escena.",
    },
    renderSuccess: {
      title: "Renderizado Exitoso",
      message: "La imagen ha sido renderizada y guardada exitosamente.",
    },
    updateAvailable: {
      title: "Actualización Disponible",
      message: "Hay una nueva versión de ZIRON Studio lista para descargar.",
    },
    updateUpToDate: {
      title: "Estás al Día",
      message: "Ya tienes la última versión de ZIRON Studio.",
    },
    updateDownloaded: {
      title: "Descarga Completa",
      message: "La actualización está lista para instalarse.",
    },
    updateCheckFailed: {
      title: "Error al Buscar Actualizaciones",
      message: "No se pudo comprobar si hay una nueva versión.",
    },
    updateDownloadFailed: {
      title: "Error al Descargar",
      message: "No se pudo descargar la actualización.",
    },
    updateInstallFailed: {
      title: "Error al Instalar",
      message: "No se pudo instalar la actualización.",
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
        "Este proyecto fue creado con ZIRON {project}, pero estás usando ZIRON {engine}. Abrirlo puede causar problemas.",
    },
    restartRequired: {
      title: "Reinicio Requerido",
      message:
        "Algunos cambios requieren reiniciar ZIRON Studio para que surtan efecto.",
    },
    deleteFolder: {
      title: "Eliminar Carpeta",
      message:
        '¿Seguro que quieres eliminar "{folder}"? Esta acción es permanente y no se puede deshacer.',
    },
    deleteFile: {
      title: "Eliminar Archivo",
      message:
        '¿Seguro que quieres eliminar "{file}"? Esta acción es permanente y no se puede deshacer.',
    },
    unsupportedFileType: {
      title: "Archivo No Soportado",
      message:
        "Este tipo de archivo no es soportado. Puedes importar modelos 3D (.glb, .gltf, .obj, .fbx) o imágenes (.png, .jpg, .jpeg, .webp).",
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
      later: "Más tarde",
      restart: "Reiniciar",
      delete: "Eliminar",
    },
  },
};
