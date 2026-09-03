// MSW resolves relative handler paths against `location`; Node has none. A minimal one makes the
// browser handlers match `http://localhost/v1/...` exactly as they do in the app.
if (typeof globalThis.location === "undefined") {
  Object.defineProperty(globalThis, "location", { value: new URL("http://localhost/"), configurable: true, writable: true });
}
