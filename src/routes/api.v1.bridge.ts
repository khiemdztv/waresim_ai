import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const eventSchema = z.object({
  source: z.enum(["ERP", "POS", "WMS"]),
  type: z.enum(["RECEIVE", "SALE", "RESTOCK", "DAMAGE", "ADJUSTMENT"]),
  sku: z.string().regex(/^SKU-\d{4}$/),
  lotId: z.string().min(1).max(80).optional(),
  quantity: z.number().int().min(1).max(100000),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().min(8).max(120),
  location: z.string().min(1).max(120).optional(),
});

function sameSecret(value: string, expected: string) {
  if (value.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < value.length; index++)
    difference |= value.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

const securityHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export const Route = createFileRoute("/api/v1/bridge")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            name: "WareSim ERP/POS Bridge",
            mode: "stateless-contract",
            auth: "Bearer WARESIM_BRIDGE_TOKEN",
            note: "Sự kiện được xác thực và chuẩn hóa. Bản free-tier không giữ dữ liệu dùng chung giữa các instance; hãy nối projector/database khi vận hành thật.",
            eventTypes: ["RECEIVE", "SALE", "RESTOCK", "DAMAGE", "ADJUSTMENT"],
            sources: ["ERP", "POS", "WMS"],
          },
          { headers: securityHeaders },
        ),
      POST: async ({ request }) => {
        const expected = process.env["WARESIM_BRIDGE_TOKEN"];
        if (!expected)
          return Response.json(
            { ok: false, error: "BRIDGE_DISABLED", message: "Endpoint ghi đang khóa." },
            { status: 503, headers: securityHeaders },
          );
        const authorization = request.headers.get("authorization") ?? "";
        const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!sameSecret(supplied, expected))
          return Response.json(
            { ok: false, error: "UNAUTHORIZED" },
            { status: 401, headers: securityHeaders },
          );
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 16384)
          return Response.json(
            { ok: false, error: "PAYLOAD_TOO_LARGE" },
            { status: 413, headers: securityHeaders },
          );
        let body: unknown;
        try {
          const raw = await request.text();
          if (raw.length > 16384)
            return Response.json(
              { ok: false, error: "PAYLOAD_TOO_LARGE" },
              { status: 413, headers: securityHeaders },
            );
          body = JSON.parse(raw);
        } catch {
          return Response.json(
            { ok: false, error: "INVALID_JSON" },
            { status: 400, headers: securityHeaders },
          );
        }
        const parsed = eventSchema.safeParse(body);
        if (!parsed.success)
          return Response.json(
            { ok: false, error: "INVALID_EVENT", issues: parsed.error.issues },
            { status: 422, headers: securityHeaders },
          );
        return Response.json(
          {
            ok: true,
            status: "VALIDATED",
            eventId: crypto.randomUUID(),
            receivedAt: new Date().toISOString(),
            event: parsed.data,
            persistence: "not-enabled-on-stateless-demo",
          },
          { status: 202, headers: securityHeaders },
        );
      },
    },
  },
});
