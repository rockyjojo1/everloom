import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isNativePlatform } from "./native/platform";
import { applyServiceWorkerPlatformPolicy } from "./native/serviceWorkerGuard";
import "./styles.css";

// Must run before the `window.load` event -- see serviceWorkerGuard.ts for
// why that ordering is what makes this reliable against the PWA plugin's
// injected registerSW.js script.
applyServiceWorkerPlatformPolicy({
  isNative: isNativePlatform(),
  serviceWorkerContainer: typeof navigator !== "undefined" ? navigator.serviceWorker : undefined,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
