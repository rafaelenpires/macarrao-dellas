import { randomBytes, pbkdf2Sync } from "node:crypto";
import { access, open, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const email = "rafaele.nascimento93@gmail.com";
const path = resolve(".dev.vars");
const password = randomBytes(32).toString("base64url");
const salt = randomBytes(16).toString("base64url");
const hash = pbkdf2Sync(password, Buffer.from(salt, "base64url"), 600_000, 32, "sha256").toString("base64url");
const sessionSecret = randomBytes(32).toString("base64url");
const contents = [
  `GESTOR_EMAIL="${email}"`,
  `GESTOR_PASSWORD_HASH="$pbkdf2-sha256$600000$${salt}$${hash}"`,
  `GESTOR_SESSION_SECRET="${sessionSecret}"`,
  "",
].join("\n");

let file;
try {
  let existing = "";
  try {
    await access(path);
    existing = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (/^\s*GESTOR_(?:EMAIL|PASSWORD_HASH|SESSION_SECRET)\s*=/m.test(existing)) {
    console.error("Credenciais GESTOR_* já existem em .dev.vars; nada foi alterado.");
    process.exitCode = 1;
  } else {
    file = await open(path, existing ? "a" : "wx", 0o600);
    await file.writeFile(`${existing && !existing.endsWith("\n") ? "\n" : ""}${contents}`, "utf8");
    await file.close();
  }
} catch (error) {
  await file?.close().catch(() => {});
  throw error;
}

if (process.exitCode !== 1) {
  console.log("Autenticação local configurada em .dev.vars (arquivo ignorado pelo Git).");
  console.log(`E-mail autorizado: ${email}`);
  console.log(`Senha inicial — guarde-a agora; ela não será exibida novamente: ${password}`);
  console.log("Agora reinicie o preview local com: npm run start");
}
