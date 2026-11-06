import {
  clearedManagerSessionCookie,
  isSameOriginRequest,
} from "../../../../lib/manager-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "Requisição não permitida." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { authenticated: false },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearedManagerSessionCookie(
          new URL(request.url).protocol === "https:",
        ),
      },
    },
  );
}
