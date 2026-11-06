import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import test from "node:test";
import {
  createManagerSession,
  isSameOriginRequest,
  managerSessionCookie,
  readManagerSession,
  verifyManagerPassword,
} from "../lib/manager-auth.ts";

const email = "rafaele.nascimento93@gmail.com";
const secret = randomBytes(32).toString("base64url");

test("validates the PBKDF2 password format and derived hash", async () => {
  const password = "local-test-password";
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 600_000, 32, "sha256");
  const stored = `$pbkdf2-sha256$600000$${salt.toString("base64url")}$${hash.toString("base64url")}`;

  assert.equal(await verifyManagerPassword(password, stored), true);
  assert.equal(await verifyManagerPassword("incorrect", stored), false);
  assert.equal(await verifyManagerPassword(password, "invalid"), false);
});

test("accepts a signed manager session only for its configured account", async () => {
  const token = await createManagerSession(email, secret, 1_800_000_000_000);
  const request = new Request("https://example.test/gestor", {
    headers: { cookie: `dellas_manager_session=${token}` },
  });

  assert.equal(
    await readManagerSession(request, email, secret, 1_800_000_100_000),
    email,
  );
  assert.equal(
    await readManagerSession(request, "other@example.test", secret, 1_800_000_100_000),
    null,
  );
  assert.equal(
    await readManagerSession(request, email, "wrong secret", 1_800_000_100_000),
    null,
  );
});

test("rejects expired, malformed, and modified session cookies", async () => {
  const now = 1_800_000_000_000;
  const token = await createManagerSession(email, secret, now);
  const expiredRequest = new Request("https://example.test/gestor", {
    headers: { cookie: `dellas_manager_session=${token}` },
  });
  assert.equal(
    await readManagerSession(expiredRequest, email, secret, now + 13 * 60 * 60 * 1000),
    null,
  );

  const modifiedRequest = new Request("https://example.test/gestor", {
    headers: { cookie: `dellas_manager_session=${token}x` },
  });
  assert.equal(await readManagerSession(modifiedRequest, email, secret, now), null);
});

test("sets an HttpOnly, SameSite cookie and Secure only for HTTPS", async () => {
  const httpsCookie = await managerSessionCookie(email, secret, true);
  const localCookie = await managerSessionCookie(email, secret, false);

  assert.match(httpsCookie, /HttpOnly/);
  assert.match(httpsCookie, /SameSite=Strict/);
  assert.match(httpsCookie, /Secure/);
  assert.doesNotMatch(localCookie, /; Secure(?:;|$)/);
});

test("requires a matching origin for state-changing requests", () => {
  assert.equal(
    isSameOriginRequest(new Request("https://example.test/api/auth/login", {
      headers: { origin: "https://example.test" },
    })),
    true,
  );
  assert.equal(
    isSameOriginRequest(new Request("https://example.test/api/auth/login", {
      headers: { origin: "https://attacker.test" },
    })),
    false,
  );
  assert.equal(isSameOriginRequest(new Request("https://example.test/api/auth/login")), false);
});
