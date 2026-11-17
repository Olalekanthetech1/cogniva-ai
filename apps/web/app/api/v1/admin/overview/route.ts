import {
  adminErrorResponse,
  getAdminAccess,
  getAdminDashboardMetrics
} from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const access = await getAdminAccess();

    if (access.kind === "unauthenticated") {
      return adminErrorResponse(
        "UNAUTHENTICATED",
        "Sign in to access Cogniva administration.",
        401
      );
    }

    if (access.kind === "forbidden") {
      return adminErrorResponse(
        "FORBIDDEN",
        "Administrator access is required.",
        403
      );
    }

    const data = await getAdminDashboardMetrics();
    return Response.json({ data });
  } catch {
    return adminErrorResponse(
      "ADMIN_OVERVIEW_UNAVAILABLE",
      "The administration overview is temporarily unavailable.",
      503
    );
  }
}
