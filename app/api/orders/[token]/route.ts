import { env } from "cloudflare:workers";
import { isManagerRequest } from "../../../manager-auth";
import { databaseTimestampToIso } from "../../../../lib/utc-date";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "Pendente",
  "Aceito",
  "Recusado",
  "Saiu para entrega",
  "Finalizado",
]);

type OrderContext = { params: Promise<{ token: string }> };

async function findOrder(token: string) {
  return env.DB.prepare(
    "SELECT id, order_code, status, payload, created_at, updated_at FROM orders WHERE tracking_token = ?",
  )
    .bind(token)
    .first<Record<string, unknown>>();
}

function notFound() {
  return Response.json({ error: "Pedido n?o encontrado" }, { status: 404 });
}

export async function GET(_request: Request, context: OrderContext) {
  const { token } = await context.params;
  const row = await findOrder(token);
  if (!row) return notFound();

  const payload = JSON.parse(String(row.payload ?? "{}"));
  return Response.json(
    {
      order: {
        ...payload,
        id: row.id,
        orderCode: row.order_code,
        status: row.status,
        date: databaseTimestampToIso(row.created_at),
        statusUpdatedAt: databaseTimestampToIso(row.updated_at),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request, context: OrderContext) {
  if (!(await isManagerRequest(request))) {
    return Response.json({ error: "N?o autorizado" }, { status: 401 });
  }

  const { token } = await context.params;
  const body = (await request.json()) as { status?: string };
  const status = String(body.status ?? "");
  if (!ALLOWED_STATUSES.has(status)) {
    return Response.json({ error: "Status inv?lido" }, { status: 400 });
  }

  const result = await env.DB.prepare(
    "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tracking_token = ?",
  )
    .bind(status, token)
    .run();
  if (!result.meta.changes) return notFound();

  return Response.json({ status });
}

export async function DELETE(request: Request, context: OrderContext) {
  if (!(await isManagerRequest(request))) {
    return Response.json({ error: "N?o autorizado" }, { status: 401 });
  }

  const { token } = await context.params;
  const result = await env.DB.prepare(
    "DELETE FROM orders WHERE tracking_token = ?",
  )
    .bind(token)
    .run();
  if (!result.meta.changes) return notFound();

  return Response.json({ deleted: true });
}
