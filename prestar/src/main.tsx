import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LibraryProvider } from "./context/LibraryProvider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <LibraryProvider>
      <App />
    </LibraryProvider>
  </BrowserRouter>,
);