import "@fontsource-variable/schibsted-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectPage } from "./connect/ConnectPage.js";
import { routeOf } from "./lib/format.js";
import { ChannelPage } from "./pages/ChannelPage.js";
import { HomePage } from "./pages/HomePage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import "./styles/tokens.css";
import "./styles/global.css";

const route = routeOf(window.location.pathname);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {route.name === "connect" ? <ConnectPage /> : route.name === "home" ? <HomePage /> : route.name === "channel" ? <ChannelPage slug={route.slug} /> : <NotFoundPage />}
  </StrictMode>,
);
