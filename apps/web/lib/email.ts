type AuthEmailInput = {
  to: string;
  subject: string;
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEmailEndpoint(): string {
  const testEndpoint = process.env.COGNIVA_TEST_EMAIL_ENDPOINT?.trim();
  if (!testEndpoint) return "https://api.resend.com/emails";

  if (
    process.env.NODE_ENV === "production" ||
    process.env.COGNIVA_ENABLE_TEST_EMAIL_ENDPOINT !== "1"
  ) {
    throw new Error("A test email endpoint is available only in an explicitly enabled non-production test process.");
  }

  let parsed: URL;
  try {
    parsed = new URL(testEndpoint);
  } catch {
    throw new Error("The test email endpoint must be a valid URL.");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (parsed.protocol !== "http:" || !loopbackHosts.has(parsed.hostname)) {
    throw new Error("The test email endpoint must use HTTP on a loopback host.");
  }

  return parsed.toString();
}

export async function sendAuthEmail(input: AuthEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "Authentication email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
    );
  }

  const actionUrl = new URL(input.actionUrl);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (actionUrl.protocol !== "https:" && !loopbackHosts.has(actionUrl.hostname)) {
    throw new Error("Authentication links must use HTTPS outside localhost.");
  }

  const html = "<!doctype html>\n" +
    "<html lang=\"en\">\n" +
    "  <body style=\"margin:0;padding:32px;background:#f7f7f4;color:#20231f;font-family:Arial,sans-serif\">\n" +
    "    <main style=\"max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #e6e8e1;border-radius:14px\">\n" +
    "      <p style=\"margin:0 0 24px;font-weight:700;color:#526b4e\">COGNIVA</p>\n" +
    "      <h1 style=\"font-size:24px;line-height:1.3\">" + escapeHtml(input.title) + "</h1>\n" +
    "      <p style=\"font-size:15px;line-height:1.7;color:#686d65\">" + escapeHtml(input.message) + "</p>\n" +
    "      <p style=\"margin:28px 0\">\n" +
    "        <a href=\"" + escapeHtml(actionUrl.toString()) + "\" style=\"display:inline-block;padding:13px 19px;background:#526b4e;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700\">" + escapeHtml(input.actionLabel) + "</a>\n" +
    "      </p>\n" +
    "      <p style=\"font-size:12px;line-height:1.6;color:#686d65\">This link is personal to your Cogniva account. If you did not request it, you can ignore this email.</p>\n" +
    "    </main>\n" +
    "  </body>\n" +
    "</html>";

  const response = await fetch(getEmailEndpoint(), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html,
      text: input.title + "\n\n" + input.message + "\n\n" +
        input.actionLabel + ": " + actionUrl.toString() +
        "\n\nIf you did not request this, you can ignore this email."
    })
  });

  if (!response.ok) {
    // Do not log the provider response body; it may contain recipient details.
    throw new Error("Authentication email delivery failed with status " + response.status + ".");
  }
}
