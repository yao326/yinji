import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import App from "./App";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) registration.unregister();
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.includes("workbox")) caches.delete(key);
      }
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
