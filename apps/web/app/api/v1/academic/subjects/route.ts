import { asc } from "drizzle-orm";
import { subjects } from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  serviceUnavailableResponse,
  unauthenticatedResponse
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) return unauthenticatedResponse();

    const data = await getStudentDatabase()
      .select({
        id: subjects.id,
        slug: subjects.slug,
        name: subjects.name,
        description: subjects.description
      })
      .from(subjects)
      .orderBy(asc(subjects.name))
      .limit(100);

    return Response.json({ data, meta: { limit: 100 } });
  } catch {
    return serviceUnavailableResponse();
  }
}
