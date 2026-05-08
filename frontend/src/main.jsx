import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initAppearancePreferences } from "./utils/appearancePreferences.js";
import "./index.css";

initAppearancePreferences();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
