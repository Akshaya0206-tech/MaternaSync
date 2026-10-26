/** Lets the app open without a signal (see public/sw.js). Only in the built app: while developing, files change too often to keep. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // The files this page loaded before the worker took charge of it were not seen by the worker, so it is told about them.
  const keepWhatIsLoaded = (worker: ServiceWorker | null) => {
    const urls = performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => new URL(name).pathname.startsWith('/assets/'));
    worker?.postMessage({ type: 'keep-loaded', urls });
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        keepWhatIsLoaded(registration.active);
        window.setTimeout(() => keepWhatIsLoaded(registration.active), 6000); // and again once the check-in pages have been fetched in the background
      })
      .catch(() => {
        // No offline start on this browser; everything else works as before.
      });
  });
}
