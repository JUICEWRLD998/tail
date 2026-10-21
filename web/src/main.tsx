import "@fontsource-variable/schibsted-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectPage } from "./connect/ConnectPage.js";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ConnectPage />
  </StrictMode>,
);
