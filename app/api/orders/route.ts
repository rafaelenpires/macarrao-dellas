import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "rafaele.nascimento93@gmail.com";

function jsonOrder(row: Record<string, unknown>) {
  const payload = JSON.parse(String(row.payload ?? "{}"));
  return { ...payload, id: row.id, trackingToken: row.tracking_token, orderCode: row.order_code, status: row.status, date: row.created_at, statusUpdatedAt: row.updated_at };
}

export async function POST(request: Request) {
  const payload = await request.json() as Record<string, unknown>;
  if (!Array.isArray(payload.items) || !String(payload.customer ?? "").trim()) return Response.json({ error: "Pedido incompleto" }, { status: 400 });
  const id = crypto.randomUUID(), trackingToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const codeRow = await env.DB.prepare("SELECT COALESCE(MAX(order_code), 0) + 1 AS next_code FROM orders").first<{ next_code: number }>();
  const orderCode = Number(codeRow?.next_code ?? 1);
  await env.DB.prepare("INSERT INTO orders (id, tracking_token, order_code, status, payload) VALUES (?, ?, ?, 'Pendente', ?)").bind(id, trackingToken, orderCode, JSON.stringify(payload)).run();
  return Response.json({ id, trackingToken, orderCode, status: "Pendente" }, { status: 201 });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const result = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all<Record<string, unknown>>();
  return Response.json({ orders: result.results.map(jsonOrder) }, { headers: { "Cache-Control": "private, no-store" } });
}
