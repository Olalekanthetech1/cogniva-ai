import { asc, ilike } from "drizzle-orm";
import { institutions } from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  serviceUnavailableResponse,
  unauthenticatedResponse
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) return unauthenticatedResponse();

    const search = new URL(request.url).searchParams.get("q")?.trim();
    if (search && search.length > 80) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Search text must be 80 characters or fewer."
          }
        },
        { status: 400 }
      );
    }

    const db = getStudentDatabase();
    const selection = {
      id: institutions.id,
      name: institutions.name,
      countryCode: institutions.countryCode,
      websiteUrl: institutions.websiteUrl
    };

    const data = search
      ? await db
          .select(selection)
          .from(institutions)
          .where(ilike(institutions.name, `%${search}%`))
          .orderBy(asc(institutions.name))
          .limit(100)
      : await db
          .select(selection)
          .from(institutions)
          .orderBy(asc(institutions.name))
          .limit(100);

    return Response.json({ data, meta: { limit: 100 } });
  } catch {
    return serviceUnavailableResponse();
  }
}
