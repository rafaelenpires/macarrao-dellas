import { env } from "cloudflare:workers";
import { isManagerRequest } from "../../manager-auth";

export const dynamic = "force-dynamic";
type Catalog = {
  categories?: unknown[];
  products?: unknown[];
  components?: Record<string, unknown>;
  componentAvailability?: Record<string, unknown>;
  pastaDrinkAvailability?: Record<string, unknown>;
  hours?: Array<{ day?: string; open?: boolean; from?: string; to?: string }>;
  businessOverride?: "auto" | "open" | "closed";
  eggExtraPrice?: number;
  eggExtraQuantityLimit?: number;
};

async function saveCatalog(catalog: Catalog) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES ('catalog', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
  )
    .bind(JSON.stringify(catalog))
    .run();
}

export async function GET() {
  const row = await env.DB.prepare("SELECT value, updated_at FROM settings WHERE key = 'catalog'").first<{ value: string; updated_at: string }>();
  return Response.json({ catalog: row ? JSON.parse(row.value) : null, updatedAt: row?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!(await isManagerRequest(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const catalog = (await request.json()) as Catalog;
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) return Response.json({ error: "Catálogo inválido" }, { status: 400 });
  const existingRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'catalog'").first<{ value: string }>();
  const existing = existingRow ? JSON.parse(existingRow.value) : {};
  await saveCatalog({ ...existing, ...catalog });
  return Response.json({ saved: true });
}

export async function PATCH(request: Request) {
  if (!(await isManagerRequest(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'catalog'").first<{ value: string }>();
  const current = row ? (JSON.parse(row.value) as Catalog) : {};
  const updates = (await request.json()) as Pick<Catalog, "hours" | "eggExtraPrice" | "eggExtraQuantityLimit">;
  if (
    (updates.hours !== undefined && !Array.isArray(updates.hours)) ||
    (updates.eggExtraPrice !== undefined && (!Number.isFinite(updates.eggExtraPrice) || updates.eggExtraPrice < 0)) ||
    (updates.eggExtraQuantityLimit !== undefined && (!Number.isInteger(updates.eggExtraQuantityLimit) || updates.eggExtraQuantityLimit < 0 || updates.eggExtraQuantityLimit > 99))
  ) {
    return Response.json({ error: "Configuração inválida" }, { status: 400 });
  }
  await saveCatalog({ ...current, ...updates });
  return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}
