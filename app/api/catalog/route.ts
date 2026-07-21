import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const OWNER_EMAIL = "rafaele.nascimento93@gmail.com";

export async function GET() {
  const row = await env.DB.prepare("SELECT value, updated_at FROM settings WHERE key = 'catalog'").first<{ value: string; updated_at: string }>();
  return Response.json({ catalog: row ? JSON.parse(row.value) : null, updatedAt: row?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const catalog = await request.json() as { categories?: unknown[]; products?: unknown[]; components?: Record<string, unknown> };
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) return Response.json({ error: "Catálogo inválido" }, { status: 400 });
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('catalog', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(JSON.stringify(catalog)).run();
  return Response.json({ saved: true });
}
