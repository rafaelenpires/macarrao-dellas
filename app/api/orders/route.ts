import { env } from "cloudflare:workers";
import { isManagerRequest } from "../../manager-auth";
import { normalizeBrazilianPhone } from "../../../lib/brazilian-phone";
import { getBusinessStatus, type OpeningHour } from "../../../lib/business-hours";
import { databaseTimestampToIso } from "../../../lib/utc-date";

export const dynamic = "force-dynamic";
function jsonOrder(row: Record<string, unknown>) {
  const payload = JSON.parse(String(row.payload ?? "{}"));
  return {
    ...payload,
    id: row.id,
    trackingToken: row.tracking_token,
    orderCode: row.order_code,
    status: row.status,
    date: databaseTimestampToIso(row.created_at),
    statusUpdatedAt: databaseTimestampToIso(row.updated_at),
  };
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Pedido inválido" }, { status: 400 });
    }
    payload = body as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const customerPhone = normalizeBrazilianPhone(payload.customerPhone);
  if (
    !Array.isArray(payload.items) ||
    payload.items.length === 0 ||
    !String(payload.customer ?? "").trim()
  ) {
    return Response.json({ error: "Pedido incompleto" }, { status: 400 });
  }
  if (!customerPhone) {
    return Response.json(
      { error: "Informe um número de WhatsApp válido com DDD para continuar." },
      { status: 400 },
    );
  }

  const catalogRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'catalog'").first<{ value: string }>();
  const catalog = catalogRow
    ? JSON.parse(catalogRow.value) as {
        hours?: OpeningHour[];
        businessOverride?: "auto" | "open" | "closed";
        categories?: Array<{ id: string; active?: boolean; deleted?: boolean }>;
        products?: Array<{ id: string; category: string; name: string; active?: boolean; deleted?: boolean }>;
      }
    : {};
  const businessStatus = getBusinessStatus(
    Array.isArray(catalog.hours) ? catalog.hours : [],
    catalog.businessOverride ?? "auto",
  );
  if (!businessStatus.isOpen) {
    return Response.json(
      { error: `A loja está fechada. ${businessStatus.message}`, businessStatus },
      { status: 409 },
    );
  }

  if (catalogRow) {
    const categoryMap = new Map((catalog.categories || []).map(category => [category.id, category]));
    const productMap = new Map((catalog.products || []).map(product => [product.id, product]));
    for (const item of payload.items as Array<{ productId?: string; category?: string; name?: string }>) {
      if (item.category && categoryMap.get(item.category)?.active === false) {
        return Response.json(
          { error: "Essa categoria não está disponível." },
          { status: 409 },
        );
      }
      const product = productMap.get(String(item.productId ?? ""));
      if (product) {
        const category = categoryMap.get(product.category);
        if (
          !product.active ||
          product.deleted ||
          category?.active === false ||
          category?.deleted
        ) {
          return Response.json(
            { error: "Um item do pedido está indisponível." },
            { status: 409 },
          );
        }
      }
    }
  }
  payload.customerPhone = customerPhone;
  const id = crypto.randomUUID();
  const trackingToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
    "-",
    "",
  );
  const codeRow = await env.DB.prepare(
    "SELECT COALESCE(MAX(order_code), 0) + 1 AS next_code FROM orders",
  ).first<{ next_code: number }>();
  const orderCode = Number(codeRow?.next_code ?? 1);
  await env.DB.prepare(
    "INSERT INTO orders (id, tracking_token, order_code, status, payload) VALUES (?, ?, ?, 'Pendente', ?)",
  )
    .bind(id, trackingToken, orderCode, JSON.stringify(payload))
    .run();
  const created = await env.DB.prepare(
    "SELECT created_at FROM orders WHERE id = ?",
  ).bind(id).first<{ created_at: string }>();
  return Response.json({
    id,
    trackingToken,
    orderCode,
    status: "Pendente",
    date: databaseTimestampToIso(created?.created_at),
  }, { status: 201 });
}

export async function GET(request: Request) {
  if (!(await isManagerRequest(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 200));
  const offset = Math.min(100000, Math.max(0, Number(url.searchParams.get("offset")) || 0));
  const since = url.searchParams.get("since");
  if (since) {
    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) {
      return Response.json({ error: "Data de consulta inválida" }, { status: 400 });
    }
    const sqliteDate = sinceDate.toISOString().slice(0, 19).replace("T", " ");
    const result = await env.DB.prepare(
      "SELECT * FROM orders WHERE created_at >= ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
    ).bind(sqliteDate, limit, offset).all<Record<string, unknown>>();
    return Response.json(
      { orders: result.results.map(jsonOrder) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const result = await env.DB.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
  ).bind(limit, offset).all<Record<string, unknown>>();
  return Response.json({ orders: result.results.map(jsonOrder) }, { headers: { "Cache-Control": "private, no-store" } });
}
