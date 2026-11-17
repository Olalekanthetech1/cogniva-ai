export const runtime = "nodejs";

export function GET() {
  return Response.json({
    status: "ok",
    service: "cogniva-web",
    timestamp: new Date().toISOString()
  });
}
