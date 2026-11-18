import { eq } from "drizzle-orm";
import {
  adminAuditEvents,
  aiProviderValues,
  aiTaskKeyValues,
  aiTaskRoutes
} from "@cogniva/database";
import { getStudentDatabase } from "@/lib/student-data";

export type AiProviderId = (typeof aiProviderValues)[number];
export type AiTaskKey = (typeof aiTaskKeyValues)[number];

const providerDetails: Record<
  AiProviderId,
  { label: string; credentialVariable: string }
> = {
  gemini: {
    label: "Google Gemini",
    credentialVariable: "GEMINI_API_KEY"
  },
  groq: {
    label: "Groq",
    credentialVariable: "GROQ_API_KEY"
  },
  mistral: {
    label: "Mistral",
    credentialVariable: "MISTRAL_API_KEY"
  }
};

const taskDetails: Record<
  AiTaskKey,
  { label: string; description: string }
> = {
  learning_plan_generation: {
    label: "Learning plan generation",
    description:
      "Generate a structured, reviewable study plan from a learner's topic."
  },
  socratic_tutor_response: {
    label: "Socratic tutor response",
    description:
      "Provide the next guided, text-first tutoring response in a learner session."
  }
};

export type AiConfigurationSnapshot = {
  providers: Array<{
    id: AiProviderId;
    label: string;
    credentialVariable: string;
    credentialConfigured: boolean;
  }>;
  tasks: Array<{
    id: AiTaskKey;
    label: string;
    description: string;
    runtimeStatus: "not_integrated";
    route: {
      provider: AiProviderId;
      model: string;
      updatedAt: string;
    } | null;
  }>;
};

export async function getAdminAiConfiguration(): Promise<AiConfigurationSnapshot> {
  const db = getStudentDatabase();
  const routes = await db
    .select({
      task: aiTaskRoutes.task,
      provider: aiTaskRoutes.provider,
      model: aiTaskRoutes.model,
      updatedAt: aiTaskRoutes.updatedAt
    })
    .from(aiTaskRoutes);

  const routeByTask = new Map(routes.map((route) => [route.task, route]));

  return {
    providers: aiProviderValues.map((id) => ({
      id,
      ...providerDetails[id],
      credentialConfigured: Boolean(
        process.env[providerDetails[id].credentialVariable]?.trim()
      )
    })),
    tasks: aiTaskKeyValues.map((id) => {
      const route = routeByTask.get(id);
      return {
        id,
        ...taskDetails[id],
        runtimeStatus: "not_integrated" as const,
        route: route
          ? {
              provider: route.provider,
              model: route.model,
              updatedAt: route.updatedAt.toISOString()
            }
          : null
      };
    })
  };
}

export async function saveAdminAiTaskRoute(input: {
  task: AiTaskKey;
  provider: AiProviderId;
  model: string;
  adminUserId: string;
}): Promise<AiConfigurationSnapshot> {
  const db = getStudentDatabase();
  const now = new Date();

  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({
        provider: aiTaskRoutes.provider,
        model: aiTaskRoutes.model
      })
      .from(aiTaskRoutes)
      .where(eq(aiTaskRoutes.task, input.task))
      .limit(1);

    await tx
      .insert(aiTaskRoutes)
      .values({
        task: input.task,
        provider: input.provider,
        model: input.model,
        updatedBy: input.adminUserId,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: aiTaskRoutes.task,
        set: {
          provider: input.provider,
          model: input.model,
          updatedBy: input.adminUserId,
          updatedAt: now
        }
      });

    await tx.insert(adminAuditEvents).values({
      actorUserId: input.adminUserId,
      action: "ai.task_route.saved",
      resourceType: "ai_task_route",
      resourceId: input.task,
      metadata: {
        task: input.task,
        previousProvider: previous?.provider ?? null,
        previousModel: previous?.model ?? null,
        provider: input.provider,
        model: input.model
      },
      createdAt: now
    });
  });

  return getAdminAiConfiguration();
}
