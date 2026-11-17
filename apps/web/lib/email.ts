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

export async function sendAuthEmail(input: AuthEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "Authentication email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL."
    );
  }

  const actionUrl = new URL(input.actionUrl);
  if (actionUrl.protocol !== "https:" && actionUrl.hostname !== "localhost") {
    throw new Error("Authentication links must use HTTPS outside localhost.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px;background:#f7f7f4;color:#20231f;font-family:Arial,sans-serif">
    <main style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #e6e8e1;border-radius:14px">
      <p style="margin:0 0 24px;font-weight:700;color:#526b4e">COGNIVA</p>
      <h1 style="font-size:24px;line-height:1.3">${escapeHtml(input.title)}</h1>
      <p style="font-size:15px;line-height:1.7;color:#686d65">${escapeHtml(input.message)}</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(actionUrl.toString())}" style="display:inline-block;padding:13px 19px;background:#526b4e;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a>
      </p>
      <p style="font-size:12px;line-height:1.6;color:#686d65">This link is personal to your Cogniva account. If you did not request it, you can ignore this email.</p>
    </main>
  </body>
</html>`,
      text: `${input.title}\n\n${input.message}\n\n${input.actionLabel}: ${actionUrl.toString()}\n\nIf you did not request this, you can ignore this email.`
    })
  });

  if (!response.ok) {
    // Do not log the provider response body; it may contain recipient details.
    throw new Error(`Authentication email delivery failed with status ${response.status}.`);
  }
}
