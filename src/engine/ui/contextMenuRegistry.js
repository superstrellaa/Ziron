let _activeCloser = null;

export function registerOpenMenu(closeFn) {
  if (_activeCloser && _activeCloser !== closeFn) {
    _activeCloser();
  }
  _activeCloser = closeFn;
}

export function clearActiveMenu(closeFn) {
  if (_activeCloser === closeFn) {
    _activeCloser = null;
  }
}
