const RECIPIENT_EMAIL = "info@emeraldmanagementsolutions.org";
const SENDER_EMAIL = "site-submission@emeraldmanagementsolutions.org";

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

// Checkbox groups arrive as a single string when only one box is checked,
// an array when multiple are checked, or undefined when none are.
function toArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function row(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding: 10px 14px; background: #f4f5f1; font-weight: 600; color: #1e5c3a; width: 200px; border-bottom: 1px solid #e6e7e1; font-size: 13px; vertical-align: top;">${label}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e6e7e1; font-size: 14px; color: #2c2c2c;">${value}</td>
    </tr>`;
}

function section(title, rowsHtml) {
  if (!rowsHtml) return "";
  return `
    <tr>
      <td style="padding: 0 0 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e2dc; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #1e5c3a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">${title}</td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return escapeHtml(value);
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return escapeHtml(parsed.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
}

function formatTime(value) {
  if (!value) return "";
  const [hourStr, minuteStr] = value.split(":");
  const hour24 = Number(hourStr);
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minuteStr} ${period}`;
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const businessName = (body.businessName || "").trim();
  const contactName = (body.contactName || "").trim();
  const email = (body.email || "").trim();

  if (!businessName || !contactName || !email) {
    context.res = {
      status: 400,
      jsonBody: { error: "Business name, contact name, and email are required." },
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

  const addressParts = [body.addressLine1, body.addressLine2, [body.addressCity, body.addressState, body.addressZip].filter(Boolean).join(", ")]
    .filter(Boolean)
    .map(escapeHtml);

  const businessInfoRows = [
    row("Business Name", escapeHtml(businessName)),
    row("Owner / Primary Contact", escapeHtml(contactName)),
    row("Title", escapeHtml(body.title)),
    row("Industry", escapeHtml(body.industry)),
    row("Phone", escapeHtml(body.phone)),
    row("Email", escapeHtml(email)),
    row("Website", escapeHtml(body.website)),
    row("Address", addressParts.join("<br>")),
  ].join("");

  const overviewRows = [
    row("Years in Business", escapeHtml(body.years)),
    row("Number of Employees", escapeHtml(body.employees)),
    row("Number of Locations", escapeHtml(body.locations)),
  ].join("");

  const challengesRows = row("Current Challenges", toArray(body.challenges).map(escapeHtml).join(", "));
  const servicesRows = row("Services of Interest", toArray(body.services).map(escapeHtml).join(", "));
  const currentSupportRows = row("Current Support", toArray(body.currentSupport).map(escapeHtml).join(", "));
  const growthRows = row("Growth Plans", toArray(body.growth).map(escapeHtml).join(", "));

  const goalsRows = [
    row("Top 3 Goals (Next 12 Months)", escapeHtml(body.goals || "").replace(/\n/g, "<br>")),
    row("What Success Looks Like", escapeHtml(body.success || "").replace(/\n/g, "<br>")),
  ].join("");

  const preferencesRows = [
    row("How They Heard About Emerald", escapeHtml(body.referral)),
    row("Preferred Consultation Method", escapeHtml(body.method)),
    row("Preferred Date", formatDate(body.date)),
    row("Preferred Time", formatTime(body.time)),
    row("Additional Comments", escapeHtml(body.comments || "").replace(/\n/g, "<br>")),
    row("Consent Given", body.consent ? "Yes" : "No"),
  ].join("");

  const htmlBody = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f2f2ee; padding: 24px 0; font-family: Arial, Helvetica, sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width: 640px; width: 100%; background: #ffffff; border-radius: 10px; overflow: hidden;">
            <tr>
              <td style="background: #1e5c3a; padding: 22px 24px;">
                <h1 style="margin: 0; color: #ffffff; font-size: 20px;">New Consultation Request</h1>
                <p style="margin: 4px 0 0; color: #cfe0d4; font-size: 13px;">Submitted from the website's Schedule a Consultation form</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${section("Business Information", businessInfoRows)}
                  ${section("Business Overview", overviewRows)}
                  ${section("Current Challenges", challengesRows)}
                  ${section("Services of Interest", servicesRows)}
                  ${section("Current Support", currentSupportRows)}
                  ${section("Goals &amp; Priorities", goalsRows)}
                  ${section("Growth Plans", growthRows)}
                  ${section("Consultation Preferences", preferencesRows)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; background: #f7f7f4; border-top: 1px solid #eceee8;">
                <p style="margin: 0; font-size: 12px; color: #888;">Reply directly to this email to respond to ${escapeHtml(contactName)}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const payload = {
    personalizations: [{ to: [{ email: RECIPIENT_EMAIL }] }],
    from: { email: SENDER_EMAIL, name: "Emerald Management Solutions Website" },
    reply_to: { email, name: contactName },
    subject: `Consultation Request from ${businessName}`,
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
