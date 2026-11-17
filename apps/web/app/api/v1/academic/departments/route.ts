import { asc, eq } from "drizzle-orm";
import { departments } from "@cogniva/database";
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

    const facultyId = new URL(request.url).searchParams.get("facultyId");
    if (!facultyId || !isUuid(facultyId)) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "A valid facultyId is required."
          }
        },
        { status: 400 }
      );
    }

    const data = await getStudentDatabase()
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(eq(departments.facultyId, facultyId))
      .orderBy(asc(departments.name))
      .limit(100);

    return Response.json({ data, meta: { limit: 100 } });
  } catch {
    return serviceUnavailableResponse();
  }
}
