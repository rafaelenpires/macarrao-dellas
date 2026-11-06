import { getManagerEmail, managerAuthIsConfigured } from "../manager-auth";
import managementHtml from "./gestor-content.html?raw";
import loginHtml from "./login-content.html?raw";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authenticatedEmail = await getManagerEmail(request);
  const content = authenticatedEmail
    ? managementHtml
    : managerAuthIsConfigured()
      ? loginHtml
      : loginHtml.replace(
          'id="setupWarning"',
          'id="setupWarning" style="display:block"',
        );

  return new Response(content, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": authenticatedEmail
        ? "frame-ancestors 'none'"
        : "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
