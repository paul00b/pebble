import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { wireSocket } from "./lib/store";
import "./index.css";

wireSocket();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
