
// A preloaded chunk 404ing means a deploy replaced the hashed files under
// this tab. Vite fires this instead of letting the import reject deep inside
// React; one reload picks up the new manifest. Without it: route changes to a
// blank page until a hard refresh — the exact bug this replaced.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'


createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
