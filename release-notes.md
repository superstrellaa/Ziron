# ZIRON Studio — Early Access v0.1.1

This update focuses on reliability when opening projects, editing scenes,
managing assets, and capturing renders.

## Improvements

- Scene loading now validates saved entity data, keeps usable defaults for
  invalid optional values, preserves custom and unknown component data, and
  reports entities that could not be loaded. A recovery backup is created when
  loading detects data that could otherwise be lost.
- Project and scene workflows handle failures more clearly. Opening another
  project checks for unsaved changes, simultaneous project openings are
  prevented, and failed project loads return to the welcome screen with an
  error message.
- User data writes are safer: configuration, project files, and scenes use
  atomic writes to protect existing files from incomplete saves.
- Asset operations validate paths, avoid silently overwriting existing files,
  and give imported files a new name when the destination already contains the
  same name. Import failures are reported with more useful details.
- Render capture validates camera settings and image output, detects lost
  WebGL contexts, and saves PNG files atomically. Errors such as a destination
  file being locked are reported instead of silently failing.
- Configuration load and save failures are surfaced, with default settings
  used when the saved configuration cannot be loaded.
- Fatal startup errors now show a dialog with an option to copy error details
  before closing the application.

## Fixes

- Duplicating, copying, pasting, or restoring entities now preserves custom
  components and reapplies model texture overrides.
- Changing the interface language and postponing the requested restart no
  longer leaves the saved language out of sync with the language currently in
  use.
- Model previews show a clear placeholder when a model cannot be loaded.
- Window state and project-opening flows handle failures more safely and
  report them to the user.

## Maintenance

- Updated the Rust `rand` dependency and GitHub Actions workflow dependencies.
