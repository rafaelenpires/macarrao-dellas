import { env } from "cloudflare:workers";
import {
  isSameOriginRequest,
  managerSessionCookie,
  verifyManagerPassword,
} from "../../../../lib/manager-auth";

export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function response(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ error: "Requisição não permitida." }, 403);
  }
  if (
    !env.GESTOR_EMAIL ||
    !env.GESTOR_PASSWORD_HASH ||
    !env.GESTOR_SESSION_SECRET
  ) {
    return response(
      { error: "A autenticação do gestor ainda não foi configurada." },
      503,
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json() as { email?: unknown; password?: unknown };
  } catch {
    return response({ error: "Informe o e-mail e a senha." }, 400);
  }
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    body.password.length > 256
  ) {
    return response({ error: "Informe o e-mail e a senha." }, 400);
  }

  const now = Date.now();
  const clientAddress = request.headers.get("cf-connecting-ip") ?? "local";
  const attempt = loginAttempts.get(clientAddress);
  if (attempt && attempt.resetAt > now && attempt.count >= MAX_ATTEMPTS) {
    return response(
      { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
      429,
    );
  }
  if (!attempt || attempt.resetAt <= now) loginAttempts.delete(clientAddress);

  const email = body.email.trim().toLowerCase();
  const passwordMatches = await verifyManagerPassword(
    body.password,
    env.GESTOR_PASSWORD_HASH,
  );
  if (email !== env.GESTOR_EMAIL.toLowerCase() || !passwordMatches) {
    const current = loginAttempts.get(clientAddress);
    loginAttempts.set(clientAddress, {
      count: (current?.count ?? 0) + 1,
      resetAt: current?.resetAt && current.resetAt > now
        ? current.resetAt
        : now + WINDOW_MS,
    });
    if (loginAttempts.size > 10_000) {
      for (const [address, value] of loginAttempts) {
        if (value.resetAt <= now) loginAttempts.delete(address);
      }
    }
    return response({ error: "E-mail ou senha incorretos." }, 401);
  }

  loginAttempts.delete(clientAddress);
  const cookie = await managerSessionCookie(
    env.GESTOR_EMAIL,
    env.GESTOR_SESSION_SECRET,
    new URL(request.url).protocol === "https:",
  );
  return Response.json(
    { authenticated: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": cookie,
      },
    },
  );
}
