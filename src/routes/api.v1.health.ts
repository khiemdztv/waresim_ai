import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            ok: true,
            service: "waresim-api",
            version: "1.0.0",
            runtime: "edge-compatible",
            capabilities: [
              "hybrid-rag",
              "food-rescue",
              "what-if-simulator",
              "rbac",
              "audit-chain",
              "erp-pos-event-contract",
            ],
            timestamp: new Date().toISOString(),
          },
          {
            headers: {
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          },
        ),
    },
  },
});
