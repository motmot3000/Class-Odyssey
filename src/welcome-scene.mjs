// Focus the current sign-in/sign-up form and release listeners on each render.
export function mountWelcomeScene(root) {
  const controller = new AbortController();
  root.querySelectorAll('[data-welcome-enter]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      root.querySelector('#gate-username, input[name="email"]')?.focus({ preventScroll: true });
      root.querySelector('.welcome-gate')?.scrollIntoView({ behavior: 'instant', block: 'center' });
    }, { signal: controller.signal });
  });
  return () => controller.abort();
}
