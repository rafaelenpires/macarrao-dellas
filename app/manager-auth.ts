import { env } from "cloudflare:workers";
import {
  isSameOriginRequest,
  readManagerSession,
} from "../lib/manager-auth";

export function managerAuthIsConfigured(): boolean {
  return Boolean(
    env.GESTOR_EMAIL &&
      env.GESTOR_PASSWORD_HASH &&
      env.GESTOR_SESSION_SECRET,
  );
}

export async function getManagerEmail(request: Request): Promise<string | null> {
  if (!managerAuthIsConfigured()) return null;
  return readManagerSession(
    request,
    env.GESTOR_EMAIL,
    env.GESTOR_SESSION_SECRET,
  );
}

export async function isManagerRequest(request: Request): Promise<boolean> {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !isSameOriginRequest(request)
  ) {
    return false;
  }
  return (await getManagerEmail(request)) !== null;
}
