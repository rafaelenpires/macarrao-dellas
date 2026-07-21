import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "rafaele.nascimento93@gmail.com";
const ALLOWED_STATUSES = new Set(["Pendente", "Aceito", "Recusado", "Saiu para entrega", "Finalizado"]);

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const row = await env.DB.prepare("SELECT id, order_code, status, payload, created_at, updated_at FROM orders WHERE tracking_token = ?").bind(token).first<Record<string, unknown>>();
  if (!row) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  const payload = JSON.parse(String(row.payload ?? "{}"));
  return Response.json({ order: { ...payload, id: row.id, orderCode: row.order_code, status: row.status, date: row.created_at, statusUpdatedAt: row.updated_at } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { token } = await context.params, body = await request.json() as { status?: string }, status = String(body.status ?? "");
  if (!ALLOWED_STATUSES.has(status)) return Response.json({ error: "Status inválido" }, { status: 400 });
  const result = await env.DB.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tracking_token = ?").bind(status, token).run();
  if (!result.meta.changes) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  return Response.json({ status });
}
