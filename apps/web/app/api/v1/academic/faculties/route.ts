import { asc, eq } from "drizzle-orm";
import { faculties } from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  isUuid,
  serviceUnavailableResponse,
  unauthenticatedResponse
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) return unauthenticatedResponse();

    const institutionId = new URL(request.url).searchParams.get("institutionId");
    if (!institutionId || !isUuid(institutionId)) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "A valid institutionId is required."
          }
        },
        { status: 400 }
      );
    }

    const data = await getStudentDatabase()
      .select({ id: faculties.id, name: faculties.name })
      .from(faculties)
      .where(eq(faculties.institutionId, institutionId))
      .orderBy(asc(faculties.name))
      .limit(100);

    return Response.json({ data, meta: { limit: 100 } });
  } catch {
    return serviceUnavailableResponse();
  }
}
