const SESSION_COOKIE = "dellas_manager_session";
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const PASSWORD_ITERATIONS = 600_000;

type SessionPayload = {
  email: string;
  expiresAt: number;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function verifyManagerPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, name, iterationsText, saltText, hashText] = storedHash.split("$");
  const iterations = Number(iterationsText);
  const salt = decodeBase64Url(saltText ?? "");
  const expected = decodeBase64Url(hashText ?? "");
  if (
    algorithm !== "" ||
    name !== "pbkdf2-sha256" ||
    iterations !== PASSWORD_ITERATIONS ||
    !salt ||
    salt.length < 16 ||
    !expected ||
    expected.length !== 32
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      expected.length * 8,
    ),
  );
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= derived[index] ^ expected[index];
  }
  return difference === 0;
}

export async function createManagerSession(
  email: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const payload: SessionPayload = {
    email,
    expiresAt: Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS,
  };
  const encodedPayload = encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(encodedPayload),
  );
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function readManagerSession(
  request: Request,
  expectedEmail: string,
  secret: string,
  now = Date.now(),
): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;

  const [encodedPayload, signatureText, ...extra] = token.split(".");
  const signature = decodeBase64Url(signatureText ?? "");
  const payloadBytes = decodeBase64Url(encodedPayload ?? "");
  if (!encodedPayload || !signature || !payloadBytes || extra.length) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.email !== "string" ||
    payload.email.toLowerCase() !== expectedEmail.toLowerCase() ||
    !Number.isInteger(payload.expiresAt) ||
    payload.expiresAt <= Math.floor(now / 1000)
  ) {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    signature,
    new TextEncoder().encode(encodedPayload),
  );
  return valid ? payload.email : null;
}

export async function managerSessionCookie(
  email: string,
  secret: string,
  secure: boolean,
): Promise<string> {
  const token = await createManagerSession(email, secret);
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_LIFETIME_SECONDS}`,
    "SameSite=Strict",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearedManagerSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "SameSite=Strict",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
