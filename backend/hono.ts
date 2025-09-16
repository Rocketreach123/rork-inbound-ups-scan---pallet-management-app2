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

// Helper function for API requests with better error handling
async function fetchFromACA(endpoint: string, queryParams: string = "") {
  const url = `${ACA_API_BASE}${endpoint}?service_key=${encodeURIComponent(ACA_API_KEY)}${queryParams ? `&${queryParams}` : ''}`;
  console.log(`[ACA Proxy] Fetching from: ${endpoint}`);
  console.log(`[ACA Proxy] Full URL: ${url.replace(ACA_API_KEY, '***')}`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WarehouseApp/1.0',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const responseText = await response.text();
    console.log(`[ACA Proxy] Response status: ${response.status}, Length: ${responseText.length}`);
    
    if (!response.ok) {
      console.error(`[ACA Proxy] Error response: ${responseText.substring(0, 500)}`);
      
      // Try to parse error response
      let errorMessage = `API returned ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) errorMessage = errorData.message;
        if (errorData.error) errorMessage = errorData.error;
      } catch {}
      
      return { 
        error: errorMessage,
        status: response.status,
        details: responseText.substring(0, 1000)
      };
    }
    
    // Handle empty response
    if (!responseText || responseText.trim() === '') {
      console.log('[ACA Proxy] Empty response, returning empty array');
      return { data: [], status: 200 };
    }
    
    try {
      const data = JSON.parse(responseText);
      
      // Log data structure for debugging
      console.log(`[ACA Proxy] Response structure:`, {
        isArray: Array.isArray(data),
        hasData: !!data?.data,
        dataIsArray: Array.isArray(data?.data),
        keys: Object.keys(data || {}).slice(0, 5),
        itemCount: Array.isArray(data) ? data.length : (Array.isArray(data?.data) ? data.data.length : 0)
      });
      
      // Normalize response to always return array
      let normalizedData = data;
      if (!Array.isArray(data) && Array.isArray(data?.data)) {
        normalizedData = data.data;
      } else if (!Array.isArray(data) && !data?.data) {
        // If it's a single object, wrap in array
        normalizedData = [data];
      }
      
      console.log(`[ACA Proxy] Success - returning ${Array.isArray(normalizedData) ? normalizedData.length : 0} items`);
      return { data: normalizedData, status: 200 };
    } catch (parseError: any) {
      console.error('[ACA Proxy] JSON parse error:', parseError.message);
      console.error('[ACA Proxy] Failed to parse:', responseText.substring(0, 200));
      return { 
        error: 'Invalid JSON response from API',
        status: 500,
        details: `Parse error: ${parseError.message}. Response: ${responseText.substring(0, 200)}`
      };
    }
  } catch (error: any) {
    clearTimeout(timeout);
    console.error('[ACA Proxy] Fetch error:', error.message, error.stack);
    
    if (error.name === 'AbortError') {
      return { error: 'Request timeout (15s)', status: 408 };
    }
    
    // Check for network errors
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      return {
        error: 'Cannot connect to ACA API. Please check network and API availability.',
        status: 503,
        details: error.message
      };
    }
    
    return { 
      error: error.message || 'Network error',
      status: 500,
      details: error.toString()
    };
  }
}

// Proxy for locations with better error handling
app.get("/aca/locations", async (c) => {
  const queryString = c.req.query();
  const queryParams = new URLSearchParams(queryString).toString();
  
  const result = await fetchFromACA('/locations', queryParams);
  
  if (result.error) {
    return c.json({ 
      error: result.error,
      details: result.details,
      timestamp: new Date().toISOString()
    }, result.status as any);
  }
  
  return c.json(result.data);
});

// Proxy for license plates with better error handling
app.get("/aca/license-plates", async (c) => {
  const queryString = c.req.query();
  const queryParams = new URLSearchParams(queryString).toString();
  
  const result = await fetchFromACA('/license-plates', queryParams);
  
  if (result.error) {
    return c.json({ 
      error: result.error,
      details: result.details,
      timestamp: new Date().toISOString()
    }, result.status as any);
  }
  
  return c.json(result.data);
});

// Test endpoint to verify API connectivity
app.get("/aca/test", async (c) => {
  console.log('[ACA Proxy] Running connectivity test...');
  
  const tests = {
    locations: await fetchFromACA('/locations', 'limit=1'),
    licensePlates: await fetchFromACA('/license-plates', 'limit=1'),
    timestamp: new Date().toISOString(),
    config: {
      base: ACA_API_BASE,
      keyMasked: ACA_API_KEY ? '***' + ACA_API_KEY.slice(-4) : 'NOT SET'
    }
  };
  
  const allSuccess = !tests.locations.error && !tests.licensePlates.error;
  
  return c.json({
    status: allSuccess ? 'ok' : 'error',
    tests,
    summary: {
      locationsOk: !tests.locations.error,
      licensePlatesOk: !tests.licensePlates.error,
      locationsCount: tests.locations.data ? (Array.isArray(tests.locations.data) ? tests.locations.data.length : (tests.locations.data?.data?.length || 0)) : 0,
      licensePlatesCount: tests.licensePlates.data ? (Array.isArray(tests.licensePlates.data) ? tests.licensePlates.data.length : (tests.licensePlates.data?.data?.length || 0)) : 0
    }
  }, allSuccess ? 200 : 500);
});

// Health check endpoints with more info
app.get("/", (c) => c.json({ 
  status: "ok", 
  message: "API is running", 
  aca_configured: true,
  endpoints: [
    '/api/aca/locations',
    '/api/aca/license-plates',
    '/api/aca/test',
    '/api/trpc/*'
  ],
  timestamp: new Date().toISOString()
}));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/healthz", (c) => c.json({ status: "ok" }));

export default app;