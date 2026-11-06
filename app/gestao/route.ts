export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.redirect(new URL("/gestor", request.url), 308);
}
