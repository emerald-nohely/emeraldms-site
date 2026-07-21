const RECIPIENT_EMAIL = "info@emeraldmanagementsolutions.org";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]
  ));
}

module.exports = async function (context, req) {
  const { name, email, phone, message } = req.body || {};

  if (!name || !email || !message) {
    context.res = {
      status: 400,
      jsonBody: { error: "Name, email, and message are required." },
    };
    return;
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    context.log.error("SENDGRID_API_KEY is not configured on this Function app.");
    context.res = {
      status: 500,
      jsonBody: { error: "Email service is not configured." },
    };
    return;
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || "Not provided");
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222;">
      <h2 style="color: #0e2216; margin-bottom: 4px;">New Consultation Request</h2>
      <p style="margin: 0 0 16px; color: #555;">Submitted from the website's Schedule a Consultation form.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
        <tr><td style="font-weight: bold; vertical-align: top;">Name</td><td>${safeName}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Email</td><td>${safeEmail}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Phone</td><td>${safePhone}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Message</td><td>${safeMessage}</td></tr>
      </table>
    </div>
  `;

  const payload = {
    personalizations: [{ to: [{ email: RECIPIENT_EMAIL }] }],
    from: { email: RECIPIENT_EMAIL, name: "Emerald Management Solutions Website" },
    reply_to: { email, name },
    subject: `Consultation Request from ${name}`,
    content: [{ type: "text/html", value: htmlBody }],
  };

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      context.log.error("SendGrid rejected the request:", response.status, errorText);
      context.res = {
        status: 502,
        jsonBody: { error: "The email service rejected the request." },
      };
      return;
    }

    context.res = { status: 200, jsonBody: { success: true } };
  } catch (err) {
    context.log.error("Unexpected error sending consultation email:", err);
    context.res = {
      status: 500,
      jsonBody: { error: "Unexpected error while sending the email." },
    };
  }
};
