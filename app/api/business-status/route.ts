import { env } from "cloudflare:workers";
import { isManagerRequest } from "../../manager-auth";
import {
  getBusinessStatus,
  type BusinessOverride,
  type OpeningHour,
} from "../../../lib/business-hours";

export const dynamic = "force-dynamic";
type CatalogSettings = {
  hours?: OpeningHour[];
  businessOverride?: BusinessOverride;
};

async function readCatalog() {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'catalog'",
  ).first<{ value: string }>();
  return row ? JSON.parse(row.value) as CatalogSettings : {};
}

export async function GET() {
  const catalog = await readCatalog();
  return Response.json(
    {
      ...getBusinessStatus(
        Array.isArray(catalog.hours) ? catalog.hours : [],
        catalog.businessOverride ?? "auto",
      ),
      hours: Array.isArray(catalog.hours) ? catalog.hours : [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  if (!(await isManagerRequest(request))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { manualOverride?: unknown };
  try {
    body = await request.json() as { manualOverride?: unknown };
  } catch {
    return Response.json({ error: "Requisição inválida" }, { status: 400 });
  }
  if (!["auto", "open", "closed"].includes(String(body.manualOverride))) {
    return Response.json({ error: "Modo de funcionamento inválido" }, { status: 400 });
  }

  const current = await readCatalog();
  const manualOverride = body.manualOverride as BusinessOverride;
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES ('catalog', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
  )
    .bind(JSON.stringify({ ...current, businessOverride: manualOverride }))
    .run();

  return Response.json(
    {
      ...getBusinessStatus(
        Array.isArray(current.hours) ? current.hours : [],
        manualOverride,
      ),
      hours: Array.isArray(current.hours) ? current.hours : [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
