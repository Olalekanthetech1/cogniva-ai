import { createDatabase } from "@cogniva/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return Response.json(
      {
        status: "not_ready",
        checks: { database: "not_configured" }
      },
      { status: 503 }
    );
  }

  const { client } = createDatabase(databaseUrl);

  try {
    await client`select 1 as connectivity_check`;

    return Response.json({
      status: "ready",
      checks: { database: "available" }
    });
  } catch {
    return Response.json(
      {
        status: "not_ready",
        checks: { database: "unavailable" }
      },
      { status: 503 }
    );
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}
