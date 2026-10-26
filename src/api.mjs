/* Same-origin API URLs also work when the app is served under a path prefix. */
export function apiUrl(path) {
  return new URL(`api/${path}`, document.baseURI).toString();
}

/** A bounded request cannot leave sign-in, synchronization, or sign-out stuck
 * forever. Callers still decide whether an unavailable server permits offline use.
 */
export function requestApi(path, options = {}, timeoutMs = 15_000) {
  return fetch(apiUrl(path), { signal: AbortSignal.timeout(timeoutMs), ...options });
}
