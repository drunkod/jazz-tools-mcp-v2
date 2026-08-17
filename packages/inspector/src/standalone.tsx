import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Vite aliases this module to the fail-closed app for production builds.
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
