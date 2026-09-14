/** Lazily create one disposable resource and share its in-flight promise.
 * Reset invalidates pending work as well as a loaded value: a late GLB load
 * must be disposed, not mounted after the user has requested another viewer.
 */
export function createSharedResource(load) {
  let generation = 0;
  let pending = null;
  let value = null;

  return {
    peek: () => value,
    get(...args) {
      if (pending) return pending;
      const requestedGeneration = generation;
      pending = Promise.resolve().then(() => load(...args)).then(resource => {
        if (requestedGeneration !== generation) {
          resource?.destroy?.();
          return null;
        }
        value = resource;
        return resource;
      }, error => {
        if (requestedGeneration !== generation) return null;
        pending = null;
        throw error;
      });
      return pending;
    },
    reset() {
      generation += 1;
      const previous = value;
      value = null;
      pending = null;
      previous?.destroy?.();
    }
  };
}
