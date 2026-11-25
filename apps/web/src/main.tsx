import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { z } from "zod";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "./components/ui/index.ts";
import { ApiError } from "./lib/api.ts";
import { routeTree } from "./routeTree.gen.ts";
import "./styles.css";

z.config(z.locales.zhTW());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx 是使用者或權限問題，重試沒有用
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
