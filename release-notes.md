# ZIRON Studio — Early Access v0.1.0

The first Early Access release of ZIRON Studio is here. ZIRON Studio is a
lightweight desktop editor for building and iterating on 3D scenes and visual
prototypes. This initial release brings together the core scene-editing,
project, and asset workflows in one focused application.

## What’s included

### Build and explore 3D scenes

- A real-time 3D viewport with an infinite grid, procedural sky, and
  directional sunlight.
- Fly-camera navigation for moving around and inspecting a scene.
- Built-in cube, sphere, cylinder, capsule, plane, and cone primitives, plus
  camera entities.
- A scene hierarchy for selecting, arranging, renaming, and managing entities.
- Single selection, multi-selection, and box selection.
- Translate, rotate, and scale gizmos, with support for transforming multiple
  selected entities together.
- A properties inspector for editing names, active state, position, rotation,
  and scale; compatible edits can be applied to multiple selected entities.
- Undo and redo for supported scene-editing actions, along with copy, paste,
  duplicate, and delete workflows.

### Work with projects and assets

- Create and open ZIRON projects, save and load scenes, and revisit recent
  projects from the welcome screen.
- Open a project from the command line or by opening its `.ziron.project` file.
- Scene serialization in `.ziron.scene` files, with project version
  compatibility checks.
- Optional automatic scene saving with a configurable interval, plus a
  warning and confirmation flow for unsaved changes when closing.
- An asset browser for organizing project folders and managing imported files.
- Import FBX, OBJ, glTF, and GLB models, and PNG, JPG, JPEG, and WebP textures.
- Drag supported files into the editor, preview assets in the browser, and drag
  models into the viewport to add them to a scene.
- Choose project textures through the asset picker and apply them to models.

### Capture and personalize

- Camera entities with adjustable field of view and clipping distances, a live
  camera preview, and PNG render capture at 3840 × 2160.
- English and Spanish interface languages.
- Configurable keyboard shortcuts and editor settings.
- Toast notifications, dialogs, tooltips, and structured application logs.
- An in-app update checker and installer workflow.

## First Early Access release

Version 0.1.0 is the first Early Access release of ZIRON Studio, not a final
release. It provides the foundation for creating and saving scenes, while the
editor and its workflows continue to evolve. Features, usability, and project
compatibility may change as development progresses.

ZIRON Studio is focused on 3D scene prototyping; it is not a complete game
engine. As with any early version, keep backup copies of important projects and
report issues or share feedback through the project’s GitHub repository.
