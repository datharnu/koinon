import "./polyfills";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PrefsProvider } from "./lib/prefs";
import "./styles.css";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 1_500 },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("root missing");

createRoot(root).render(
  <StrictMode>
    <PrefsProvider>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </PrefsProvider>
  </StrictMode>,
);
