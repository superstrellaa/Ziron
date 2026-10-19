# AGENTS.md

Guia de trabajo para agentes de IA en ZIRON Studio. Este archivo describe el
estado y los contratos observables del repositorio; cuando el codigo y esta
guia difieran, el codigo fuente y los scripts del proyecto son la autoridad.

## Resumen del proyecto

ZIRON Studio es un editor de prototipado de escenas 3D para escritorio.
Combina:

- Tauri 2 y Rust para la ventana nativa, dialogos, sistema de archivos,
  configuracion, cursor y comandos IPC.
- Vite y JavaScript ES modules para el editor y la interfaz.
- Three.js para la escena WebGL, entidades, camara, iluminacion y modelos.
- Lucide para iconos y fuentes Geist distribuidas en `public/fonts/`.

No es una aplicacion web generica ni un motor de juegos completo: los cambios
deben preservar el flujo de edicion visual y el funcionamiento dentro de la
ventana Tauri.

## Comandos

Requisitos: Node.js 20.19+ o 22.12+, Rust/rustup y las dependencias
nativas de Tauri para el sistema operativo de desarrollo. Instalar
dependencias frontend con:

```bash
npm install
```

Comandos disponibles en `package.json`:

```bash
npm run dev       # Vite solamente, util para trabajar en el frontend
npm run build     # Compilacion frontend a dist/
npm run preview   # Sirve el build de Vite
npm run tauri dev # Aplicacion de escritorio en desarrollo
npm run tauri build # Bundle de produccion para los targets disponibles en el SO
```

Validacion recomendada despues de cambios JavaScript/CSS:

```bash
npm run build
```

Validacion recomendada despues de cambios Rust/Tauri:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

No hay suite de tests ni lint configurados actualmente. Para cambios de UI,
la comprobacion principal es ejecutar `npm run tauri dev` y probar el flujo
afectado. Para cambios de comandos o persistencia, probar tambien crear,
cargar, guardar y cerrar un proyecto desde la aplicacion.

El target de Vite en Linux y macOS es `safari13` (`vite.config.js`; en Windows
es `chrome105`). No uses top-level `await` ni sintaxis que ese target no
soporte: envuelve el codigo asincrono de arranque en una funcion.

## Estructura y propietarios

- `index.html`: punto de entrada HTML minimo; monta `#app` y carga
  `src/main.js`.
- `src/main.js`: inicializacion global dentro de una funcion `main()`.
  Configuracion, keybinds, i18n, tooltips, asset picker, toasts, popups,
  workspace, ventana, menus y pantalla de bienvenida se inicializan aqui.
- `src/editor/systems/app/startupError.js`: manejo de errores fatales de
  arranque (log, popup copiable y cierre de la ventana).
- `src/styles.css`: estilo global del editor y sus paneles. Usa las fuentes
  Geist de `public/fonts/`.
- `src/editor/`: experiencia del editor, viewport, camara, gizmos, seleccion,
  drag and drop, paneles, toolbar, proyectos, rendering e historial.
- `src/editor/systems/app/windowManager.js`: controles de ventana y
  proteccion de cierre (`checkDirtyAndThen`).
- `src/editor/systems/app/project/projectManager.js`: apertura y cierre de
  proyectos y del viewport activo.
- `src/engine/`: capacidades reutilizables del motor: entidades, escena,
  registro, modelos, cielo, grid, persistencia de entidades, i18n, logger,
  popups, toasts, tooltips y picker de assets.
- `src/engine/world/sceneManager.js`: propietario de la coleccion de entidades
  en una escena. Centraliza altas, bajas, modelos, operaciones por lote,
  renombrado, visibilidad y eventos.
- `src/engine/world/entityRegistry.js`: ids y orden de jerarquia; garantiza
  ids unicos.
- `src/engine/world/persistence/sceneLoader.js`: carga tolerante de las
  entidades guardadas (validacion, reparacion, informe).
- `src/engine/history/commands.js`: comandos de historial (deshacer/rehacer).
- `src/engine/ui/popup/`: sistema de popups (`popup.js` cola y render,
  `popupTypes.js` popups concretos).
- `src/engine/core/scene.js`: crea la escena Three.js, entorno, grid, sol y
  carga las entidades persistidas.
- `src/editor/systems/persistence/scenePersistence.js`: convierte entidades
  del editor a JSON y delega lectura/escritura al backend Tauri.
- `src-tauri/src/lib.rs`: arranque Tauri, plugins, estado de proyecto abierto,
  estado de ventana y registro de todos los comandos invocables.
- `src-tauri/src/project.rs`: proyectos, escenas, copias de seguridad de
  escenas, proyectos recientes, dialogos nativos y operaciones de assets.
- `src-tauri/src/config.rs`: configuracion persistente y valores por defecto.
- `src-tauri/src/render.rs`: guardado de renders PNG.
- `src-tauri/src/logger.rs`: logger del backend y archivo de log.
- `src-tauri/src/util.rs`: utilidades compartidas (`write_atomic`,
  `run_blocking`).
- `src-tauri/src/cursor.rs`: captura, visibilidad y recentrado del cursor para
  la fly camera.
- `src-tauri/tauri.conf.json`: URL de desarrollo, build frontend, ventana,
  permisos de assets, bundle y asociacion de archivos.
- `docs/notes-spanish.md`: notas funcionales que complementan el README.

## Flujo de arranque

1. `src/main.js` llama a `main()`, que inicializa logger, configuracion,
   keybinds, idioma, popups (y avisa con `markPopupReady()`), tooltips, asset
   picker y toasts. Si la configuracion cayo a los valores por defecto
   (`usedFallbackConfig()`), muestra un toast tras inicializar los toasts.
2. Construye la toolbar y `#workspace`, y registra los sistemas del editor
   (workspace, ventana con proteccion de cierre, menus, drag and drop) y la
   comprobacion de actualizaciones en segundo plano.
3. Invoca `get_launch_project`; si recibe un archivo `.ziron.project` o
   `.ziron.scene`, carga el proyecto mediante `load_project`.
4. Si no hay proyecto de lanzamiento, muestra la pantalla de bienvenida.
5. La carga de un proyecto crea el viewport y la escena; `scene.js` carga la
   escena inicial indicada por `startup_scene`. Si la apertura falla,
   `onProjectReady` vuelve a la bienvenida y avisa con `Toast` y `Popup`.
6. `main().catch(handleFatalStartupError)`: un fallo no recuperable durante el
   arranque se registra, se muestra en un popup con el error copiable y se
   cierra la ventana (no tiene decoraciones, el usuario no podria cerrarla).

Al cambiar el arranque, conserva la inicializacion de todos los sistemas antes
de mostrar la bienvenida o el viewport. Los errores de IPC deben continuar
pasando por `logger`, `Toast` o `Popup` segun el contexto, en lugar de fallar
silenciosamente. La configuracion se carga antes que los popups y toasts: no
muestres UI desde `loadConfig`, expon el estado y avisa desde `main.js`.

## Contrato JavaScript <-> Tauri

El frontend usa `invoke` de `@tauri-apps/api/core`. Todo comando invocado debe
estar registrado en `tauri::generate_handler!` dentro de `src-tauri/src/lib.rs`.
Los nombres de los argumentos JSON deben coincidir con los nombres Rust en
camelCase al invocar desde JavaScript, por ejemplo:

```js
await invoke("save_scene", { scenePath, sceneData });
```

Los comandos Rust devuelven normalmente `Result<..., String>` y el frontend
debe tratar el rechazo como error de usuario o de operacion. Si se añade un
comando nuevo, actualizar ambos lados: implementacion Rust, registro en
`lib.rs` y consumidor JavaScript, y añadirlo a esta lista.

Los comandos principales son:

- Ventana: `save_window_state`.
- Logger: `init_logger`, `log`.
- Configuracion: `load_config`, `save_config`, `get_default_config`.
- Cursor: `start_fly`, `stop_fly`, `recenter_cursor`.
- Proyectos: `create_project`, `load_project`, `get_launch_project`,
  `update_project_version`, `get_recent_projects`, `remove_recent_project`,
  `pick_folder`, `pick_project_file`.
- Escenas: `save_scene`, `load_scene`, `backup_scene`.
- Assets: `list_asset_tree`, `list_assets_by_extension`,
  `create_asset_folder`, `delete_asset_folder`, `rename_asset_folder`,
  `copy_asset_folder`, `import_asset_file`, `delete_asset_file`,
  `rename_asset_file`, `copy_asset_file`, `pick_model_file`,
  `pick_texture_files`, todos definidos en `project.rs`.
- Render: `save_render_png`.

Algunos errores Rust llevan un prefijo estable (`codigo: detalle`) que el
frontend usa para distinguir casos. No lo cambies sin actualizar al consumidor:

- `scene_not_found:` la escena no existe (el frontend crea una nueva).
- `scene_corrupt:` la escena existe pero no se puede interpretar (el proyecto
  no se abre y el archivo no se toca).
- `asset_exists:` el destino de una copia o renombrado ya existe.
- `render_file_locked:` el PNG de destino esta abierto en otra aplicacion.
- `recent_projects_corrupt:` la lista de recientes era invalida (se aparto).

## Formatos y persistencia

Un proyecto creado por `create_project` contiene:

```text
<carpeta>/
  <nombre>.ziron.project
  scenes/main.ziron.scene
  assets/
```

El archivo `.ziron.project` contiene al menos `name`, `version`,
`ziron_version`, `created_at`, `last_opened` y `startup_scene`. La escena es
JSON con `name` y `entities`. Las entidades serializadas incluyen `id`,
`name`, `type`, `position`, `rotation`, `scale` y `active`; los modelos pueden
añadir `modelPath` y `components`, y las entidades con color pueden añadir
`color`.

No cambies estos nombres o rutas sin considerar proyectos existentes y la
compatibilidad de versiones. `saveScene` reindexa los IDs antes de guardar:
nada que sobreviva a un guardado (comandos de historial, selecciones) debe
conservar un ID por valor; guarda la referencia a la entidad. La carga de
modelos admite los formatos documentados actualmente: FBX, OBJ y GLB. Las
texturas pueden importarse desde el selector o mediante drag and drop.

Los proyectos publicados deben seguir abriendose al actualizar el editor.
Trata los archivos existentes como datos de usuario que hay que preservar:

- Los cambios en el esquema de proyectos, escenas, entidades o componentes
  deben aceptar los datos antiguos y migrarlos de forma incremental e
  idempotente. Al cargar una escena, completa los campos nuevos que falten en
  las entidades aplicables (por ejemplo, añadir la configuracion por defecto
  de un componente nuevo a cada entidad `sun` antigua), sin reemplazar valores
  existentes ni eliminar campos desconocidos.
- Define los valores por defecto en el esquema o en una migracion versionada;
  aplica solo defaults conocidos y semanticamente validos. Conserva el resto
  de los datos y guarda el resultado migrado usando el flujo de persistencia
  existente, sin exigir que el usuario recree su proyecto.
- Comprueba la migracion con fixtures de proyectos/escenas antiguos, datos
  parciales, datos actuales y una segunda ejecucion; verifica que carga,
  guardado y recarga preservan tanto los valores existentes como los campos
  nuevos. Si no se puede migrar de forma segura, no sobrescribas el original:
  informa el problema y conserva una alternativa recuperable.
- No presupongas que una version antigua del editor puede leer campos nuevos
  escritos por una version posterior. Evita incompatibilidades innecesarias y,
  si una escritura rompe compatibilidad, usa una version de formato/migracion
  explicita y protege los datos existentes antes de modificar el proyecto.

Carga de escenas (`scene.js`, `sceneLoader.js`):

- Solo `scene_not_found` equivale a una escena nueva. Cualquier otro fallo de
  lectura o parseo aborta la apertura sin tocar el archivo, para que ni la
  creacion de un cubo por defecto ni el autoguardado lo sobrescriban.
- La carga valida cada entidad por separado. Un campo ausente o invalido con
  default valido conserva el default de la entidad; una entidad sin dato
  obligatorio (tipo desconocido, modelo sin `modelPath`) se omite. Los
  componentes guardados se fusionan con los defaults de la entidad y se
  conservan los componentes y campos desconocidos. Ids duplicados o invalidos
  se reasignan en `entityRegistry`.
- Si se omite o repara algo, se informa al usuario (`Popup.sceneLoadIssues`
  con la lista copiable) y se crea una copia del archivo original con
  `backup_scene`.

Archivos de recuperacion (solo se crean cuando hay un problema, nunca en el
uso normal):

- `<escena>.bak-<fecha>`: copia de la escena creada por `backup_scene` cuando
  la carga detecta datos que se perderian al guardar. Se reutiliza la ultima
  si es identica y se conservan las 3 mas recientes.
- `config.ziron.json.corrupt-<fecha>` y `recent_projects.json.corrupt-<fecha>`:
  el archivo invalido apartado antes de que se sobrescriba.
- `*.ziron-tmp`: temporal de una escritura atomica; se elimina si la
  escritura falla.

Los archivos de usuario (escenas, proyecto, configuracion, recientes) se
escriben con `write_atomic` (temporal y renombrado) para que un fallo a mitad
nunca deje un archivo truncado ni destruya la version anterior. La
configuracion de usuario se guarda fuera del repositorio, en el directorio
de datos de la aplicacion Tauri, como `config/config.ziron.json`; los proyectos
recientes se guardan como `config/recent_projects.json`. No añadas archivos de
usuario al repositorio.

## Reglas de implementacion

### Robustez y errores

- Prioriza una robustez de nivel de producto: anticipa fallos previsibles en
  operaciones asincronas, IPC, archivos, red y rendering; valida precondiciones
  y resultados, y ofrece una recuperacion o alternativa segura cuando conserve
  el significado de la accion y los datos del usuario. No añadas redundancia
  cosmetica ni cambies silenciosamente a un resultado distinto.
- Cada validacion debe proteger una condicion o invariante real y tener una
  respuesta definida; no añadas comprobaciones o ramas `if` especulativas sin
  una estrategia de recuperacion. Si falta un dato, usa el default definido
  por el esquema cuando exista y sea valido. Si el dato es obligatorio y no
  tiene default seguro, informa claramente que falta o que fallo la operacion
  y no inventes valores aleatorios, datos de ejemplo ni resultados de exito.
- Reintenta solo fallos transitorios y operaciones repetibles sin efectos
  secundarios duplicados; limita los intentos y usa esperas progresivas cuando
  corresponda. No repitas operaciones destructivas o no idempotentes sin un
  mecanismo que evite duplicarlas.
- Si no existe una recuperacion segura o esta falla, conserva el error y su
  contexto en el logger y comunica el fallo con `Toast`, `Popup` u otro canal
  adecuado y localizado. No ocultes errores con `catch` vacios, valores de
  exito inventados ni retornos silenciosos; el usuario debe saber si la accion
  no se completo y que alternativa tiene.
- Restaura el estado temporal y libera recursos aunque falle una operacion
  (por ejemplo, con `finally`); comprueba tanto la ruta de exito como la de
  fallo al validar cambios de recuperacion.
- No muestres un exito si la operacion fallo: comprueba el resultado de
  `saveConfig` y `triggerSave` (devuelven un booleano) antes de mostrar
  "guardado" o de continuar con una accion que depende de ello (cerrar,
  reiniciar, abrir otro proyecto).
- Las acciones lentas o que abren dialogos (renders, instalaciones) deben
  protegerse contra una segunda ejecucion simultanea con un indicador que se
  libere en `finally`.

### Archivos del usuario, rutas y assets

- Escribe archivos de usuario con `write_atomic` (`util.rs`). La excepcion es
  `save_render_png`, que tiene su propia escritura atomica para detectar el
  PNG bloqueado por otra aplicacion (`render_file_locked`).
- Las rutas que llegan del frontend dentro de `assets/` se resuelven siempre
  con `resolve_in_assets`; no hagas `join` directo con texto del usuario. Debe
  rechazar rutas vacias, absolutas o con `..`.
- No sobrescribas en silencio archivos o carpetas del usuario: copiar y
  renombrar devuelven `asset_exists` si el destino existe, e importar un asset con un nombre ocupado lo renombra a `nombre (n).ext` y
  devuelve el nombre final, sin comparar el contenido. El consumidor debe usar
  el nombre devuelto, no el original.
- Los archivos apartados o de recuperacion solo se crean ante un error (ver
  "Formatos y persistencia"). No generes copias en el uso normal.
- Los dialogos nativos se abren con `run_blocking` y las variantes
  `blocking_*` del plugin; no esperes con `rx.recv()` dentro de comandos
  `async`.
- Los comandos Rust no deben hacer `unwrap` sobre datos externos (ventana,
  rutas, JSON): devuelve un error con contexto o registra y continua.

### Escena, entidades e historial

- Usa los patrones y APIs existentes antes de crear otra capa de estado o
  persistencia.
- Cambios de escena deben pasar por `sceneManager`; no manipules directamente
  el registro de entidades desde paneles o herramientas.
- Libera geometria, materiales y texturas Three.js cuando elimines objetos o
  reemplaces recursos.
- Mantén las operaciones pesadas por lotes y el reporting de progreso donde ya
  existe `addBatch`, `removeBatch` o la carga de entidades. `addBatch` salta
  y registra los elementos que fallan en vez de abortar el lote.
- Respeta el sistema de historial para mutaciones editables y marca limpia al
  guardar. No cambies una entidad desde la UI sin conectar la actualizacion y
  el historial correspondientes.
- Los comandos de historial guardan la entidad viva, no su id, y los comandos
  de borrado y duplicado capturan los componentes (`structuredClone`) y
  reaplican la textura de los modelos, por lo que reciben `projectData`. Los
  constructores pueden lanzar: si lanzan, no hagas `history.push`. Tras
  duplicar o pegar, reselecciona la entidad nueva para que el panel de
  propiedades lea el estado final.
- El sol (`type === "sun"`) no se borra: el propio comando debe rechazarlo.
- Todo sistema del viewport que registre listeners globales (`window`,
  `document`, `onKeybind`) devuelve una funcion de limpieza y
  `viewport.destroy()` la llama; un paso que falle no debe impedir los demas.
- Abrir un proyecto con un viewport activo pasa por `openProjectFromFile`
  (`projectManager.js`), que pregunta por los cambios sin guardar antes de
  `load_project` y no destruye el viewport hasta que el nuevo proyecto abre.
- Los comandos de historial se ejecutan con el ejecutor de
  `createCommandRunner` (`engine/history/commandRunner.js`), que construye y
  ejecuta el comando y solo lo añade al historial si salio bien. No llames
  `cmd.execute(); history.push(cmd);` a mano.
- El renderer WebGL se libera en `destroy()` del viewport con
  `renderer.dispose()` y `forceContextLoss()` (via `createRenderer().dispose`), y
  es el ultimo paso. El portapapeles de entidades se vacia al destruir el
  viewport porque mantiene viva la escena anterior.

### Interfaz, popups y textos

- Usa `t()` y los locales de `src/engine/i18n/locales/` para texto visible.
  Si agregas una clave, añade las traducciones de `en.js` y `es.js`.
- Los popups se encolan en `openPopup`, que resuelve con `null` si el sistema
  no esta inicializado. `title` y `message` se escapan como texto; usa
  `messageHtml` solo con marcado propio y escapando los datos con `escapeHtml`.
- Escapa con `escapeHtml` cualquier dato del usuario (nombres de entidades,
  carpetas, archivos, errores) que se interpole en `innerHTML` o en atributos.
  La CSP esta desactivada y `withGlobalTauri` esta activo: una inyeccion de
  HTML llegaria a los comandos IPC.
- No uses `await` sobre `logger.*` en rutas de error: la promesa solo se
  resuelve cuando el log se escribe y, si el backend de logs falla, no lo hara.
- Conserva los keybinds configurables: no asumas que los valores por defecto
  son los valores actuales del usuario.
- Sigue el estilo existente: ES modules, comillas dobles en JavaScript,
  semicolons y Rust formateado de forma idiomatica.
- Mantén la interfaz compacta de editor: no introduzcas dependencias de
  frameworks frontend ni reestructures el layout global para un cambio local.

### Logging

- Usa el logger estructurado (`src/engine/core/logger.js`) para la mayoría de situaciones y/o casos.
  Evita usar `console.log` a toda costa, siempre intenta usar sí o sí el logger y loggearlo todo.
- La firma es `logger.<nivel>(modulo, mensaje)`. Una llamada con un solo
  argumento escribe el mensaje como modulo. Incluye la causa en el mensaje
  (`| Error: ${e}`) y usa `error` para fallos reales, `warn` para
  recuperaciones.
- En Rust usa `logger::log(nivel, modulo, mensaje, None, None)`.

## Tauri y archivos generados

No edites manualmente artefactos generados o de compilacion:

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- `src-tauri/gen/` salvo que una regeneracion oficial del CLI lo requiera

Los cambios de capacidades, permisos, plugins o bundle deben revisarse junto
con `src-tauri/capabilities/default.json` y `src-tauri/tauri.conf.json`. La
ventana usa decoraciones desactivadas, region de drag personalizada y soporte
de drag and drop; cambios en toolbar o ventana pueden romper esas interacciones.

El cierre de la ventana pasa por `onCloseRequested` (`windowManager.js`), que
comprueba los cambios sin guardar y luego llama a `destroy()`; los permisos de
ventana deben incluir `core:window:allow-destroy`. Si el guardado falla, la
ventana no se cierra.

Bundle: `tauri.conf.json` lista los targets de forma explicita (no `"all"`):
solo NSIS en Windows (sin MSI). No quites `appimage` ni `app`, el updater los
necesita (`createUpdaterArtifacts`).

Dependencias: las actualizaciones de Dependabot con cambios de API deben pasar
`cargo check` antes de fusionarse. Con `rand` 0.10 se usa `rand::rng()`,
`RngExt` y `random_range`.

## Procedimiento para agentes

Antes de editar:

1. Identifica el modulo propietario del comportamiento y lee su consumidor
   inmediato.
2. Comprueba si el cambio afecta el contrato de escena, proyecto, historial,
   i18n o IPC.
3. Revisa `git status --short` y conserva cambios preexistentes del usuario.

Despues de editar:

1. Ejecuta la validacion mas estrecha disponible (`npm run build` para frontend
   o `cargo check --manifest-path src-tauri/Cargo.toml` para Rust).
2. Para cambios de flujo visual o IPC, ejecuta tambien `npm run tauri dev` y
   prueba la ruta afectada.
3. Para cambios de persistencia, prueba la ruta de fallo ademas de la de
   exito, sobre una copia del proyecto: escena corrupta o con una entidad
   invalida, archivo de solo lectura, archivo bloqueado, y comprueba que el
   uso normal no crea archivos de recuperacion.
4. Comprueba que no se hayan añadido archivos generados, secretos o datos de
   usuario.
5. No hagas commit, reset ni cambies de rama salvo que el usuario lo pida.

## Alcance de cambios

Prefiere cambios pequeños y localizados. No mezcles una refactorizacion global
con una correccion funcional. Si un cambio de formato o de comando rompe
compatibilidad, documenta la migracion y actualiza `docs/notes-spanish.md` o
`README.md` junto con el codigo.
