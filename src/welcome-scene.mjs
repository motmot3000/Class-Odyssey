// Keep only the sign-in anchor interaction. The entry screen has no WebGL,
// animated canvas, hero selector or animation loop.
export function mountWelcomeScene(root) {
  const controller = new AbortController();
  root.querySelectorAll('[data-welcome-enter]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      root.querySelector('#gate-username')?.focus({ preventScroll: true });
      root.querySelector('.welcome-gate')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    }, { signal: controller.signal });
  });
  return () => controller.abort();
}
