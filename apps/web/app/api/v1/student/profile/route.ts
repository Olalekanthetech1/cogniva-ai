import { eq } from "drizzle-orm";
import {
  departments,
  faculties,
  institutions,
  studentProfiles
} from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  isUuid,
  serviceUnavailableResponse,
  unauthenticatedResponse
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readStudentProfile(userId: string) {
  const db = getStudentDatabase();
  const [profile] = await db
    .select({
      id: studentProfiles.id,
      institutionId: studentProfiles.institutionId,
      institutionName: institutions.name,
      countryCode: institutions.countryCode,
      selfReportedInstitution: studentProfiles.selfReportedInstitution,
      onboardingCompletedAt: studentProfiles.onboardingCompletedAt,
      facultyId: studentProfiles.facultyId,
      facultyName: faculties.name,
      departmentId: studentProfiles.departmentId,
      departmentName: departments.name,
      programme: studentProfiles.programme,
      yearOfStudy: studentProfiles.yearOfStudy,
      locale: studentProfiles.locale,
      timeZone: studentProfiles.timeZone,
      createdAt: studentProfiles.createdAt,
      updatedAt: studentProfiles.updatedAt
    })
    .from(studentProfiles)
    .leftJoin(
      institutions,
      eq(studentProfiles.institutionId, institutions.id)
    )
    .leftJoin(faculties, eq(studentProfiles.facultyId, faculties.id))
    .leftJoin(departments, eq(studentProfiles.departmentId, departments.id))
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function GET(): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) return unauthenticatedResponse();

    const data = await readStudentProfile(student.id);
    return Response.json({ data });
  } catch {
    return serviceUnavailableResponse();
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) return unauthenticatedResponse();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The request body must be valid JSON."
          }
        },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The request body must be a JSON object."
          }
        },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const allowedKeys = new Set([
      "institutionId",
      "facultyId",
      "departmentId",
      "programme",
      "yearOfStudy"
    ]);

    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The request contains unsupported profile fields."
          }
        },
        { status: 400 }
      );
    }

    function readOptionalId(value: unknown): string | null | undefined {
      if (value === undefined || value === null || value === "") return null;
      if (typeof value !== "string" || !isUuid(value)) return undefined;
      return value;
    }

    const institutionId = readOptionalId(input.institutionId);
    const facultyId = readOptionalId(input.facultyId);
    const departmentId = readOptionalId(input.departmentId);

    if (
      institutionId === undefined ||
      facultyId === undefined ||
      departmentId === undefined
    ) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Select a valid institution, faculty, and department."
          }
        },
        { status: 400 }
      );
    }

    let programme: string | null = null;
    if (input.programme !== undefined && input.programme !== null) {
      if (
        typeof input.programme !== "string" ||
        input.programme.trim().length > 160
      ) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Programme must be 160 characters or fewer."
            }
          },
          { status: 400 }
        );
      }
      programme = input.programme.trim() || null;
    }

    let yearOfStudy: number | null = null;
    if (input.yearOfStudy !== undefined && input.yearOfStudy !== null && input.yearOfStudy !== "") {
      const parsedYear =
        typeof input.yearOfStudy === "number"
          ? input.yearOfStudy
          : Number(input.yearOfStudy);

      if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 12) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Year of study must be a whole number from 1 to 12."
            }
          },
          { status: 400 }
        );
      }

      yearOfStudy = parsedYear;
    }

    if (!institutionId && !programme && !yearOfStudy) {
      return Response.json(
        {
          error: {
            code: "PROFILE_EMPTY",
            message: "Add at least one academic detail before saving."
          }
        },
        { status: 422 }
      );
    }

    if ((facultyId || departmentId) && !institutionId) {
      return Response.json(
        {
          error: {
            code: "ACADEMIC_HIERARCHY_INVALID",
            message: "Choose an institution before selecting its faculty or department."
          }
        },
        { status: 422 }
      );
    }

    if (departmentId && !facultyId) {
      return Response.json(
        {
          error: {
            code: "ACADEMIC_HIERARCHY_INVALID",
            message: "Choose a faculty before selecting a department."
          }
        },
        { status: 422 }
      );
    }

    const db = getStudentDatabase();

    if (institutionId) {
      const [institution] = await db
        .select({ id: institutions.id })
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .limit(1);

      if (!institution) {
        return Response.json(
          {
            error: {
              code: "ACADEMIC_RECORD_NOT_FOUND",
              message: "The selected institution is no longer available."
            }
          },
          { status: 422 }
        );
      }
    }

    if (facultyId) {
      const [faculty] = await db
        .select({
          id: faculties.id,
          institutionId: faculties.institutionId
        })
        .from(faculties)
        .where(eq(faculties.id, facultyId))
        .limit(1);

      if (!faculty || faculty.institutionId !== institutionId) {
        return Response.json(
          {
            error: {
              code: "ACADEMIC_HIERARCHY_INVALID",
              message: "The selected faculty does not belong to that institution."
            }
          },
          { status: 422 }
        );
      }
    }

    if (departmentId) {
      const [department] = await db
        .select({
          id: departments.id,
          facultyId: departments.facultyId
        })
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1);

      if (!department || department.facultyId !== facultyId) {
        return Response.json(
          {
            error: {
              code: "ACADEMIC_HIERARCHY_INVALID",
              message: "The selected department does not belong to that faculty."
            }
          },
          { status: 422 }
        );
      }
    }

    await db
      .insert(studentProfiles)
      .values({
        userId: student.id,
        institutionId,
        facultyId,
        departmentId,
        programme,
        yearOfStudy
      })
      .onConflictDoUpdate({
        target: studentProfiles.userId,
        set: {
          institutionId,
          facultyId,
          departmentId,
          programme,
          yearOfStudy,
          updatedAt: new Date()
        }
      });

    const data = await readStudentProfile(student.id);
    return Response.json({ data });
  } catch {
    return serviceUnavailableResponse();
  }
}
