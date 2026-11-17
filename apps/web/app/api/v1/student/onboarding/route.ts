import { eq } from "drizzle-orm";
import { institutions, studentProfiles } from "@cogniva/database";
import {
  getSignedInStudent,
  getStudentDatabase,
  isUuid,
  serviceUnavailableResponse,
  unauthenticatedResponse
} from "@/lib/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Choice = "catalogue" | "not_listed" | "skip";

function validationError(message: string): Response {
  return Response.json(
    { error: { code: "VALIDATION_ERROR", message } },
    { status: 400 }
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const student = await getSignedInStudent();
    if (!student) return unauthenticatedResponse();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationError("The request body must be valid JSON.");
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return validationError("The request body must be a JSON object.");
    }

    const input = body as Record<string, unknown>;
    const allowedKeys = new Set(["choice", "institutionId", "institutionName"]);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      return validationError("The request contains unsupported fields.");
    }

    const choice = input.choice as Choice;
    if (!["catalogue", "not_listed", "skip"].includes(choice)) {
      return validationError("Choose an institution, report one not listed, or skip.");
    }

    const db = getStudentDatabase();
    const [existing] = await db
      .select({
        institutionId: studentProfiles.institutionId,
        facultyId: studentProfiles.facultyId,
        departmentId: studentProfiles.departmentId
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, student.id))
      .limit(1);

    const now = new Date();
    let update: Partial<typeof studentProfiles.$inferInsert>;

    if (choice === "catalogue") {
      if (
        typeof input.institutionId !== "string" ||
        !isUuid(input.institutionId) ||
        input.institutionName !== undefined
      ) {
        return validationError("Select an institution from the available results.");
      }

      const [institution] = await db
        .select({ id: institutions.id })
        .from(institutions)
        .where(eq(institutions.id, input.institutionId))
        .limit(1);

      if (!institution) {
        return Response.json(
          { error: { code: "INSTITUTION_NOT_FOUND", message: "That institution is no longer available. Search again." } },
          { status: 422 }
        );
      }

      const sameInstitution = existing?.institutionId === institution.id;
      update = {
        institutionId: institution.id,
        selfReportedInstitution: null,
        facultyId: sameInstitution ? existing?.facultyId ?? null : null,
        departmentId: sameInstitution ? existing?.departmentId ?? null : null,
        onboardingCompletedAt: now
      };
    } else if (choice === "not_listed") {
      if (
        typeof input.institutionName !== "string" ||
        input.institutionId !== undefined
      ) {
        return validationError("Enter the institution name so it can be recorded as self-reported.");
      }

      const institutionName = input.institutionName.trim();
      if (institutionName.length < 2 || institutionName.length > 200) {
        return validationError("Institution name must be between 2 and 200 characters.");
      }

      update = {
        institutionId: null,
        facultyId: null,
        departmentId: null,
        selfReportedInstitution: institutionName,
        onboardingCompletedAt: now
      };
    } else {
      if (input.institutionId !== undefined || input.institutionName !== undefined) {
        return validationError("Skip does not accept institution details.");
      }

      update = {
        institutionId: null,
        facultyId: null,
        departmentId: null,
        selfReportedInstitution: null,
        onboardingCompletedAt: now
      };
    }

    await db
      .insert(studentProfiles)
      .values({ userId: student.id, ...update })
      .onConflictDoUpdate({
        target: studentProfiles.userId,
        set: { ...update, updatedAt: now }
      });

    const [saved] = await db
      .select({
        institutionId: studentProfiles.institutionId,
        institutionName: institutions.name,
        countryCode: institutions.countryCode,
        selfReportedInstitution: studentProfiles.selfReportedInstitution,
        onboardingCompletedAt: studentProfiles.onboardingCompletedAt
      })
      .from(studentProfiles)
      .leftJoin(institutions, eq(studentProfiles.institutionId, institutions.id))
      .where(eq(studentProfiles.userId, student.id))
      .limit(1);

    return Response.json({ data: saved ?? null });
  } catch {
    return serviceUnavailableResponse();
  }
}
