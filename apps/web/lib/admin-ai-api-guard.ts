import { getAdminAccess } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function hasTrustedAiAdminOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return false;
  let normalizedOrigin: string;
  try { normalizedOrigin = new URL(requestOrigin).origin; } catch { return false; }
  const allowed = [
    process.env.BETTER_AUTH_URL,
    ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",")
  ].filter((item): item is string => Boolean(item?.trim()));
  return allowed.some((item) => {
    try { return new URL(item).origin === normalizedOrigin; } catch { return false; }
  });
}

export async function requireAiAdministrator(): Promise<
  | { ok: true; id: string }
  | { ok: false; response: Response }
> {
  let access: Awaited<ReturnType<typeof getAdminAccess>>;
  try {
    access = await getAdminAccess();
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "ADMIN_AUTH_UNAVAILABLE", message: "Administrator authorization could not be verified." } },
        { status: 503 }
      )
    };
  }
  if (access.kind === "unauthenticated") {
    return { ok: false, response: Response.json({ error: { code: "UNAUTHENTICATED", message: "Sign in to access Cogniva administration." } }, { status: 401 }) };
  }
  if (access.kind === "forbidden") {
    return { ok: false, response: Response.json({ error: { code: "FORBIDDEN", message: "Administrator access is required." } }, { status: 403 }) };
  }
  return { ok: true, id: access.admin.id };
}
