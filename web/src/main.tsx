import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./app.css";
import "./efectos.css";
import "./adaptable.css";
import App from "./App.tsx";
import { iniciarTema } from "./lib/estado";

iniciarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
