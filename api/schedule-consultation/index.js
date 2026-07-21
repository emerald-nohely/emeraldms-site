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
  return `<tr><td style="font-weight: bold; vertical-align: top; padding-right: 12px; white-space: nowrap;">${label}</td><td>${value}</td></tr>`;
}

function section(title, rowsHtml) {
  if (!rowsHtml) return "";
  return `
    <h3 style="color: #09301f; margin: 22px 0 6px; font-size: 16px;">${title}</h3>
    <table cellpadding="4" cellspacing="0" style="border-collapse: collapse; width: 100%;">${rowsHtml}</table>
  `;
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
  ].join("");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222; max-width: 640px;">
      <h2 style="color: #09301f; margin-bottom: 4px;">New Consultation Request</h2>
      <p style="margin: 0 0 8px; color: #555;">Submitted from the website's Schedule a Consultation form.</p>
      ${section("Business Information", businessInfoRows)}
      ${section("Business Overview", overviewRows)}
      ${section("Current Challenges", challengesRows)}
      ${section("Services of Interest", servicesRows)}
      ${section("Current Support", currentSupportRows)}
      ${section("Goals &amp; Priorities", goalsRows)}
      ${section("Growth Plans", growthRows)}
      ${section("Consultation Preferences", preferencesRows)}
    </div>
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
