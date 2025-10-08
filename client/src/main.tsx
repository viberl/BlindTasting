import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./hooks/use-auth";

if (import.meta.env.DEV && typeof window !== "undefined") {
  const isResizeObserverLoopError = (message?: string | null) =>
    typeof message === "string" && message.includes("ResizeObserver loop completed with undelivered notifications");

  window.addEventListener("error", (event) => {
    if (isResizeObserverLoopError(event.message)) {
      event.preventDefault();
      return;
    }
    console.error("[GlobalError]", event.error ?? event.message, event);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.message ?? String(event.reason ?? "");
    if (isResizeObserverLoopError(message)) {
      event.preventDefault();
      return;
    }
    console.error("[UnhandledRejection]", event.reason, event);
  });
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);
