import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// ACA API proxy endpoints with hardcoded credentials
const ACA_API_BASE = "https://portal.allcountyapparel.com/api";
const ACA_API_KEY = "ACA_API_KEY_2025";

// Proxy for locations
app.get("/aca/locations", async (c) => {
  try {
    const url = `${ACA_API_BASE}/locations?service_key=${encodeURIComponent(ACA_API_KEY)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return c.json({ error: `API returned ${response.status}` }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error: any) {
    console.error("[ACA Proxy] Locations error:", error);
    return c.json({ error: error.message || "Failed to fetch locations" }, 500);
  }
});

// Proxy for license plates
app.get("/aca/license-plates", async (c) => {
  try {
    const url = `${ACA_API_BASE}/license-plates?service_key=${encodeURIComponent(ACA_API_KEY)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return c.json({ error: `API returned ${response.status}` }, response.status as any);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error: any) {
    console.error("[ACA Proxy] License plates error:", error);
    return c.json({ error: error.message || "Failed to fetch license plates" }, 500);
  }
});

// Simple health check endpoints
app.get("/", (c) => c.json({ status: "ok", message: "API is running", aca_configured: true }));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/healthz", (c) => c.json({ status: "ok" }));

export default app;