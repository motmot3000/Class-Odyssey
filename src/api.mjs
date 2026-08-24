export function apiUrl(path) {
  return new URL(`api/${path}`, document.baseURI).toString();
}
