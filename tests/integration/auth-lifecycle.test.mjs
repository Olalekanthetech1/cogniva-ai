import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

const databaseRequire = createRequire(new URL("../../packages/database/package.json", import.meta.url));
const postgres = databaseRequire("postgres");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function extractEmailLink(email) {
  assert.ok(email && typeof email.html === "string", "Expected the email provider to receive an HTML message.");
  const match = email.html.match(/<a\s+href="([^"]+)"/i);
  assert.ok(match, "Expected an action link in the authentication email.");
  return decodeHtml(match[1]);
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);

  return values
    .map((value) => value.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function requestJson(baseUrl, path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);

  const response = await fetch(baseUrl + path, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Keep the status available for assertions when an endpoint has no JSON body.
  }
  return { response, body };
}

async function waitForServer(baseUrl, child, getLogs) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("The Cogniva test server exited before becoming ready. " + getLogs());
    }

    try {
      const response = await fetch(baseUrl + "/api/health");
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await delay(500);
  }

  throw new Error("The Cogniva test server did not become ready. " + getLogs());
}

async function verifyAccount(baseUrl, emails, email, password, name) {
  const emailCount = emails.length;
  const signup = await requestJson(baseUrl, "/api/auth/sign-up/email", {
    method: "POST",
    body: {
      name,
      email,
      password,
      callbackURL: baseUrl + "/verify-email"
    }
  });

  assert.equal(signup.response.status, 200, "Email registration should be accepted.");
  assert.ok(emails.length > emailCount, "Registration should send an email-verification message.");

  const verificationLink = extractEmailLink(emails[emails.length - 1]);
  const verification = await fetch(verificationLink);
  assert.ok(verification.ok, "The emailed verification link should be accepted.");
  assert.equal(new URL(verification.url).pathname, "/verify-email");
  assert.equal(new URL(verification.url).searchParams.get("error"), null);
}

async function signIn(baseUrl, email, password) {
  const result = await requestJson(baseUrl, "/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password }
  });

  assert.equal(result.response.status, 200, "The verified account should sign in.");
  const cookie = cookieHeader(result.response);
  assert.ok(cookie, "Sign-in should issue a session cookie.");

  const session = await requestJson(baseUrl, "/api/auth/get-session", { cookie });
  assert.ok(session.body?.user?.id, "The new session should resolve to an authenticated user.");
  return { cookie, userId: session.body.user.id };
}

async function signOut(baseUrl, cookie) {
  const result = await requestJson(baseUrl, "/api/auth/sign-out", {
    method: "POST",
    cookie
  });
  assert.equal(result.response.status, 200, "Sign-out should be accepted.");

  const session = await requestJson(baseUrl, "/api/auth/get-session", { cookie });
  assert.equal(session.body, null, "A signed-out session cookie must no longer resolve to a session.");
}

async function requestPasswordReset(baseUrl, email) {
  return requestJson(baseUrl, "/api/auth/request-password-reset", {
    method: "POST",
    body: {
      email,
      redirectTo: baseUrl + "/reset-password"
    }
  });
}

test("Better Auth lifecycle and student profile access are enforced end to end", { timeout: 180_000 }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL must point to an isolated PostgreSQL test database.");

  const sql = postgres(databaseUrl, { max: 2, connect_timeout: 10 });
  const emails = [];
  const emailServer = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    try {
      emails.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: "cogniva-integration-email" }));
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid test message" }));
    }
  });

  const emailPort = await listen(emailServer);
  const port = Number(process.env.COGNIVA_AUTH_TEST_PORT ?? 3187);
  const baseUrl = "http://127.0.0.1:" + port;
  const rootDirectory = fileURLToPath(new URL("../..", import.meta.url));
  const child = spawn(
    "pnpm",
    ["--filter", "@cogniva/web", "exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: rootDirectory,
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: baseUrl,
        BETTER_AUTH_SECRET: "cogniva-phase-one-integration-secret-0123456789abcdef",
        AUTH_TRUSTED_ORIGINS: baseUrl,
        RESEND_API_KEY: "re_test_cogniva_local_only",
        RESEND_FROM_EMAIL: "Cogniva Tests <no-reply@example.test>",
        COGNIVA_TEST_EMAIL_ENDPOINT: "http://127.0.0.1:" + emailPort + "/emails",
        COGNIVA_ENABLE_TEST_EMAIL_ENDPOINT: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let logs = "";
  child.stdout.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-5000); });
  child.stderr.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-5000); });

  try {
    await waitForServer(baseUrl, child, () => logs);

    const institutionA = randomUUID();
    const institutionB = randomUUID();
    const facultyA = randomUUID();
    const facultyB = randomUUID();
    const departmentA = randomUUID();
    const departmentB = randomUUID();
    const suffix = randomUUID().slice(0, 8);

    await sql.unsafe(
      "INSERT INTO institutions (id, slug, name, country_code) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)",
      [
        institutionA, "phase-one-a-" + suffix, "Phase One Institution A", "NG",
        institutionB, "phase-one-b-" + suffix, "Phase One Institution B", "NG"
      ]
    );
    await sql.unsafe(
      "INSERT INTO faculties (id, institution_id, slug, name) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)",
      [
        facultyA, institutionA, "faculty-a-" + suffix, "Faculty A",
        facultyB, institutionB, "faculty-b-" + suffix, "Faculty B"
      ]
    );
    await sql.unsafe(
      "INSERT INTO departments (id, faculty_id, slug, name) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)",
      [
        departmentA, facultyA, "department-a-" + suffix, "Department A",
        departmentB, facultyB, "department-b-" + suffix, "Department B"
      ]
    );

    const protectedPaths = [
      "/api/v1/student/profile",
      "/api/v1/academic/institutions",
      "/api/v1/academic/faculties?institutionId=" + institutionA,
      "/api/v1/academic/departments?facultyId=" + facultyA,
      "/api/v1/academic/subjects"
    ];

    for (const path of protectedPaths) {
      const unauthenticated = await requestJson(baseUrl, path);
      assert.equal(unauthenticated.response.status, 401, path + " must require authentication.");
    }

    const firstEmail = "cogniva-phase-one-" + randomUUID() + "@example.test";
    const secondEmail = "cogniva-phase-one-" + randomUUID() + "@example.test";
    const originalPassword = "Cogniva-Initial-Pass-2026!";
    const secondPassword = "Cogniva-Second-Pass-2026!";

    await verifyAccount(baseUrl, emails, firstEmail, originalPassword, "First Test Learner");
    const firstSession = await signIn(baseUrl, firstEmail, originalPassword);

    const initialProfile = await requestJson(baseUrl, "/api/v1/student/profile", {
      cookie: firstSession.cookie
    });
    assert.equal(initialProfile.response.status, 200);
    assert.equal(initialProfile.body.data, null);

    const catalogue = await requestJson(
      baseUrl,
      "/api/v1/academic/institutions?q=" + encodeURIComponent("Phase One Institution A"),
      { cookie: firstSession.cookie }
    );
    assert.equal(catalogue.response.status, 200);
    assert.ok(catalogue.body.data.some((record) => record.id === institutionA));

    const faculties = await requestJson(
      baseUrl,
      "/api/v1/academic/faculties?institutionId=" + institutionA,
      { cookie: firstSession.cookie }
    );
    assert.equal(faculties.response.status, 200);
    assert.ok(faculties.body.data.some((record) => record.id === facultyA));

    const departments = await requestJson(
      baseUrl,
      "/api/v1/academic/departments?facultyId=" + facultyA,
      { cookie: firstSession.cookie }
    );
    assert.equal(departments.response.status, 200);
    assert.ok(departments.body.data.some((record) => record.id === departmentA));

    const subjects = await requestJson(baseUrl, "/api/v1/academic/subjects", {
      cookie: firstSession.cookie
    });
    assert.equal(subjects.response.status, 200);
    assert.ok(Array.isArray(subjects.body.data));

    const invalidHierarchyCases = [
      {
        label: "faculty without institution",
        body: { facultyId: facultyA, programme: "Invalid selection" }
      },
      {
        label: "department without faculty",
        body: { institutionId: institutionA, departmentId: departmentA, programme: "Invalid selection" }
      },
      {
        label: "faculty from another institution",
        body: { institutionId: institutionA, facultyId: facultyB, programme: "Invalid selection" }
      },
      {
        label: "department from another faculty",
        body: { institutionId: institutionA, facultyId: facultyA, departmentId: departmentB, programme: "Invalid selection" }
      }
    ];

    for (const item of invalidHierarchyCases) {
      const result = await requestJson(baseUrl, "/api/v1/student/profile", {
        method: "PUT",
        cookie: firstSession.cookie,
        body: item.body
      });
      assert.equal(result.response.status, 422, "Reject invalid hierarchy: " + item.label);
      assert.equal(result.body.error.code, "ACADEMIC_HIERARCHY_INVALID");
    }

    const validProfile = {
      institutionId: institutionA,
      facultyId: facultyA,
      departmentId: departmentA,
      programme: "Integration Test Programme",
      yearOfStudy: 2
    };
    const savedProfile = await requestJson(baseUrl, "/api/v1/student/profile", {
      method: "PUT",
      cookie: firstSession.cookie,
      body: validProfile
    });
    assert.equal(savedProfile.response.status, 200);
    assert.equal(savedProfile.body.data.programme, validProfile.programme);
    assert.equal(savedProfile.body.data.institutionId, institutionA);
    assert.equal(savedProfile.body.data.facultyId, facultyA);
    assert.equal(savedProfile.body.data.departmentId, departmentA);

    const forgedOwner = await requestJson(baseUrl, "/api/v1/student/profile", {
      method: "PUT",
      cookie: firstSession.cookie,
      body: { ...validProfile, userId: "another-user" }
    });
    assert.equal(forgedOwner.response.status, 400, "Clients must not choose the profile owner.");
    assert.equal(forgedOwner.body.error.code, "VALIDATION_ERROR");

    await signOut(baseUrl, firstSession.cookie);
    const signedOutProfile = await requestJson(baseUrl, "/api/v1/student/profile", {
      cookie: firstSession.cookie
    });
    assert.equal(signedOutProfile.response.status, 401);

    await verifyAccount(baseUrl, emails, secondEmail, secondPassword, "Second Test Learner");
    const secondSession = await signIn(baseUrl, secondEmail, secondPassword);
    const secondProfile = await requestJson(baseUrl, "/api/v1/student/profile", {
      method: "PUT",
      cookie: secondSession.cookie,
      body: { programme: "Second Account Private Programme", yearOfStudy: 1 }
    });
    assert.equal(secondProfile.response.status, 200);
    assert.equal(secondProfile.body.data.programme, "Second Account Private Programme");
    await signOut(baseUrl, secondSession.cookie);

    const firstSessionAgain = await signIn(baseUrl, firstEmail, originalPassword);
    const ownerBoundRead = await requestJson(
      baseUrl,
      "/api/v1/student/profile?userId=" + encodeURIComponent(secondSession.userId),
      { cookie: firstSessionAgain.cookie }
    );
    assert.equal(ownerBoundRead.response.status, 200);
    assert.equal(ownerBoundRead.body.data.programme, "Integration Test Programme");
    assert.notEqual(ownerBoundRead.body.data.programme, "Second Account Private Programme");

    const resetEmailCount = emails.length;
    const resetRequested = await requestPasswordReset(baseUrl, firstEmail);
    assert.equal(resetRequested.response.status, 200, "Password reset request should be accepted.");
    assert.ok(emails.length > resetEmailCount, "Password reset should send a reset email.");

    const resetLink = extractEmailLink(emails[emails.length - 1]);
    const resetPage = await fetch(resetLink);
    assert.ok(resetPage.ok, "The emailed password-reset link should resolve.");
    const finalResetUrl = new URL(resetPage.url);
    const linkedResetUrl = new URL(resetLink);
    const resetToken =
      finalResetUrl.searchParams.get("token") ??
      linkedResetUrl.searchParams.get("token") ??
      finalResetUrl.pathname.split("/").filter(Boolean).at(-1);
    assert.ok(resetToken, "The reset link should deliver a one-time token to the reset page.");

    const newPassword = "Cogniva-Recovered-Pass-2026!";
    const reset = await requestJson(baseUrl, "/api/auth/reset-password", {
      method: "POST",
      body: { token: resetToken, newPassword }
    });
    assert.equal(reset.response.status, 200, "A valid password-reset token should update the password.");

    const revokedSession = await requestJson(baseUrl, "/api/auth/get-session", {
      cookie: firstSessionAgain.cookie
    });
    assert.equal(revokedSession.body, null, "Password reset should revoke pre-existing sessions.");

    const oldPasswordAttempt = await requestJson(baseUrl, "/api/auth/sign-in/email", {
      method: "POST",
      body: { email: firstEmail, password: originalPassword }
    });
    assert.ok(oldPasswordAttempt.response.status >= 400, "The previous password must stop working.");

    const recoveredSession = await signIn(baseUrl, firstEmail, newPassword);
    await signOut(baseUrl, recoveredSession.cookie);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 5000).unref();
    });
    await new Promise((resolve) => emailServer.close(resolve));
    await sql.end({ timeout: 5 });
  }
});
