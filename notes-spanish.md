# Notas de ZIRON Studio:

- Puedes iniciar proyectos directamente pasándolo como argumentos (ziron-studio.exe --project C://project/project.ziron.project) o con doble click sobre un .ziron.project
- Al renombrar en multiselección en las propiedades la palabra clave "{id}" es sustituida por el id de arriba a abajo de los múltiples seleccionados. ("Cube {id}" : "Cube 1", "Cube 2"...)
- El sistema de proyectos detecta automáticamente diferencias de versión del motor y muestra advertencia de compatibilidad.
- El editor detecta cambios sin guardar antes de cerrar la ventana y bloquea el cierre mostrando popup de confirmación.
- Los logs del motor usan un sistema custom con categorías y formato visual propio.
- La entidad del sol puede hacer que cambie el skybox en base a su rotación en X
- Puedes importar modelos custom solo FBX, OBJ y GLB
