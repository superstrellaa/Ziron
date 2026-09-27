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

Requisitos: Node.js 18+, Rust/rustup y las dependencias de Tauri. Instalar
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
npm run tauri build # Bundle de produccion, actualmente NSIS en Windows
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

## Estructura y propietarios

- `index.html`: punto de entrada HTML minimo; monta `#app` y carga
  `src/main.js`.
- `src/main.js`: inicializacion global. Configuracion, keybinds, i18n,
  tooltips, asset picker, toasts, popups, workspace, ventana, menus y
  pantalla de bienvenida se inicializan aqui.
- `src/styles.css`: estilo global del editor y sus paneles. Usa las fuentes
  Geist de `public/fonts/`.
- `src/editor/`: experiencia del editor, viewport, camara, gizmos, seleccion,
  drag and drop, paneles, toolbar, proyectos, rendering e historial.
- `src/engine/`: capacidades reutilizables del motor: entidades, escena,
  registro, modelos, cielo, grid, persistencia de entidades, i18n, logger,
  popups, toasts, tooltips y picker de assets.
- `src/engine/world/sceneManager.js`: propietario de la coleccion de entidades
  en una escena. Centraliza altas, bajas, modelos, operaciones por lote,
  renombrado, visibilidad y eventos.
- `src/engine/core/scene.js`: crea la escena Three.js, entorno, grid, sol y
  carga las entidades persistidas.
- `src/editor/systems/persistence/scenePersistence.js`: convierte entidades
  del editor a JSON y delega lectura/escritura al backend Tauri.
- `src-tauri/src/lib.rs`: arranque Tauri, plugins, estado de proyecto abierto,
  estado de ventana y registro de todos los comandos invocables.
- `src-tauri/src/project.rs`: proyectos, escenas, proyectos recientes,
  dialogos nativos y operaciones de assets.
- `src-tauri/src/config.rs`: configuracion persistente y valores por defecto.
- `src-tauri/src/cursor.rs`: captura, visibilidad y recentrado del cursor para
  la fly camera.
- `src-tauri/tauri.conf.json`: URL de desarrollo, build frontend, ventana,
  permisos de assets, bundle y asociacion de archivos.
- `docs/notes-spanish.md`: notas funcionales que complementan el README.

## Flujo de arranque

1. `src/main.js` inicializa logger, configuracion, keybinds, idioma y sistemas
   de UI.
2. Construye la toolbar y `#workspace`, y registra los sistemas del editor.
3. Invoca `get_launch_project`; si recibe un archivo `.ziron.project` o
   `.ziron.scene`, carga el proyecto mediante `load_project`.
4. Si no hay proyecto de lanzamiento, muestra la pantalla de bienvenida.
5. La carga de un proyecto crea el viewport y la escena; `scene.js` carga la
   escena inicial indicada por `startup_scene`.

Al cambiar el arranque, conserva la inicializacion de todos los sistemas antes
de mostrar la bienvenida o el viewport. Los errores de IPC deben continuar
pasando por `logger`, `Toast` o `Popup` segun el contexto, en lugar de fallar
silenciosamente.

## Contrato JavaScript <-> Tauri

El frontend usa `invoke` de `@tauri-apps/api/core`. Todo comando invocado debe
estar registrado en `tauri::generate_handler!` dentro de `src-tauri/src/lib.rs`.
Los nombres de los argumentos JSON deben coincidir con los nombres Rust en
camelCase al invocar desde JavaScript, por ejemplo:

```js
await invoke("save_scene", { scenePath, sceneData });
```

Los comandos Rust devuelven `Result<..., String>` y el frontend debe tratar el
rechazo como error de usuario o de operacion. Si se añade un comando nuevo,
actualizar ambos lados: implementacion Rust, registro en `lib.rs` y consumidor
JavaScript.

Los comandos principales son:

- Ventana: `save_window_state`.
- Configuracion: `load_config`, `save_config`.
- Cursor: `start_fly`, `stop_fly`, `recenter_cursor`.
- Proyectos: `create_project`, `load_project`, `get_launch_project`,
  `update_project_version`, `get_recent_projects`, `remove_recent_project`,
  `pick_folder`, `pick_project_file`.
- Escenas: `save_scene`, `load_scene`.
- Assets: listar, crear, eliminar, renombrar, copiar, importar y elegir
  archivos, todos definidos en `project.rs`.

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
compatibilidad de versiones. `saveScene` reindexa los IDs antes de guardar.
La carga de modelos admite los formatos documentados actualmente: FBX, OBJ y
GLB. Las texturas pueden importarse desde el selector o mediante drag and
drop.

La configuracion de usuario se guarda fuera del repositorio, en el directorio
de datos de la aplicacion Tauri, como `config/config.ziron.json`; los proyectos
recientes se guardan como `config/recent_projects.json`. No añadas archivos de
usuario al repositorio.

## Reglas de implementacion

- Usa los patrones y APIs existentes antes de crear otra capa de estado o
  persistencia.
- Cambios de escena deben pasar por `sceneManager`; no manipules directamente
  el registro de entidades desde paneles o herramientas.
- Libera geometria, materiales y texturas Three.js cuando elimines objetos o
  reemplaces recursos.
- Mantén las operaciones pesadas por lotes y el reporting de progreso donde ya
  existe `addBatch`, `removeBatch` o la carga de entidades.
- Respeta el sistema de historial para mutaciones editables y marca limpia al
  guardar. No cambies una entidad desde la UI sin conectar la actualizacion y
  el historial correspondientes.
- Usa `t()` y los locales de `src/engine/i18n/locales/` para texto visible.
  Si agregas una clave, añade las traducciones de `en.js` y `es.js`.
- Usa el logger estructurado (`src/engine/core/logger.js`) para diagnostico.
  Evita introducir `console.log` permanente.
- Conserva los keybinds configurables: no asumas que los valores por defecto
  son los valores actuales del usuario.
- Sigue el estilo existente: ES modules, comillas dobles en JavaScript,
  semicolons y Rust formateado de forma idiomatica.
- Mantén la interfaz compacta de editor: no introduzcas dependencias de
  frameworks frontend ni reestructures el layout global para un cambio local.

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
3. Comprueba que no se hayan añadido archivos generados, secretos o datos de
   usuario.
4. No hagas commit, reset ni cambies de rama salvo que el usuario lo pida.

## Alcance de cambios

Prefiere cambios pequeños y localizados. No mezcles una refactorizacion global
con una correccion funcional. Si un cambio de formato o de comando rompe
compatibilidad, documenta la migracion y actualiza `docs/notes-spanish.md` o
`README.md` junto con el codigo.
