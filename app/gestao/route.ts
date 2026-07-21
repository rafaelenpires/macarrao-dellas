import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import managementHtml from "./gestao-content.html?raw";

export const dynamic = "force-dynamic";

const AUTHORIZED_EMAILS = new Set(["rafaele.nascimento93@gmail.com"]);

export async function GET(request: Request) {
  const user = await getChatGPTUser();

  if (!user) {
    const signInUrl = new URL(chatGPTSignInPath("/gestao"), request.url);
    return Response.redirect(signInUrl, 302);
  }

  if (!AUTHORIZED_EMAILS.has(user.email.toLowerCase())) {
    return new Response(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso negado</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff7e8;color:#3b0710;font-family:Arial,sans-serif}.box{width:min(440px,calc(100% - 32px));padding:32px;border:1px solid #dfbd76;border-radius:18px;background:#fffaf0;box-shadow:0 18px 45px #3b07101a}.box h1{margin:0 0 12px}.box p{line-height:1.55}.box a{color:#8e2017;font-weight:700}</style></head><body><main class="box"><h1>Acesso não autorizado</h1><p>Esta conta não tem permissão para abrir a gestão do Macarrão Dellas.</p><a href="/signout-with-chatgpt?return_to=/gestao">Entrar com outra conta</a></main></body></html>`,
      {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  return new Response(managementHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
