import { toNextJsHandler } from "better-auth/next-js";
import { AuthConfigurationError, getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleAuthRequest(request: Request): Promise<Response> {
  try {
    const handlers = toNextJsHandler(getAuth());

    if (request.method === "GET") {
      return handlers.GET(request);
    }

    return handlers.POST(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json(
        {
          error: {
            code: "AUTH_NOT_CONFIGURED",
            message: error.message
          }
        },
        { status: 503 }
      );
    }

    throw error;
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleAuthRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleAuthRequest(request);
}
