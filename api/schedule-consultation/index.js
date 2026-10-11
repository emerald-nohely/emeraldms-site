const RECIPIENT_EMAIL = "info@emeraldmanagementsolutions.org";
const SENDER_EMAIL = "site-submission@emeraldmanagementsolutions.org";
const SENDER_NAME = "Emerald Management Solutions";
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

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

// Shared branded wrapper for both emails. Every argument is HTML and must
// already be escaped by the caller.
function emailShell(title, subtitle, innerHtml, footerHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f2f2ee; padding: 24px 0; font-family: Arial, Helvetica, sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width: 640px; width: 100%; background: #ffffff; border-radius: 10px; overflow: hidden;">
            <tr>
              <td style="background: #1e5c3a; padding: 22px 24px;">
                <h1 style="margin: 0; color: #ffffff; font-size: 20px;">${title}</h1>
                <p style="margin: 4px 0 0; color: #cfe0d4; font-size: 13px;">${subtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; background: #f7f7f4; border-top: 1px solid #eceee8;">
                <p style="margin: 0; font-size: 12px; color: #888;">${footerHtml}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

async function sendEmail(apiKey, payload) {
  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo responded ${response.status}: ${errorText}`);
  }
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

  // The confirmation email goes to whatever address was typed, so reject
  // anything that isn't plausibly a single mailbox, and cap the contact name
  // since it is echoed back to that address.
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || email.length > 254 || contactName.length > 100) {
    context.res = {
      status: 400,
      jsonBody: { error: "Please enter a valid contact name and email address." },
    };
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    context.log.error("BREVO_API_KEY is not configured on this Function app.");
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

  const sectionsHtml = [
    section("Business Information", businessInfoRows),
    section("Business Overview", overviewRows),
    section("Current Challenges", challengesRows),
    section("Services of Interest", servicesRows),
    section("Current Support", currentSupportRows),
    section("Goals &amp; Priorities", goalsRows),
    section("Growth Plans", growthRows),
    section("Consultation Preferences", preferencesRows),
  ].join("");

  const notification = {
    sender: { email: SENDER_EMAIL, name: `${SENDER_NAME} Website` },
    to: [{ email: RECIPIENT_EMAIL }],
    replyTo: { email, name: contactName },
    subject: `Consultation Request from ${businessName}`,
    htmlContent: emailShell(
      "New Consultation Request",
      "Submitted from the website's Schedule a Consultation form",
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sectionsHtml}</table>`,
      `Reply directly to this email to respond to ${escapeHtml(contactName)}.`
    ),
    tags: ["consultation-request"],
  };

  // Deliberately does not echo anything from the form beyond the contact
  // name: this goes to an address anyone can type into the form, so including
  // free text would let the form be used to send arbitrary content from our
  // domain.
  const confirmation = {
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
    to: [{ email, name: contactName }],
    replyTo: { email: RECIPIENT_EMAIL, name: SENDER_NAME },
    subject: "We received your consultation request — Emerald Management Solutions",
    htmlContent: emailShell(
      "Thank you for reaching out",
      "Emerald Management Solutions",
      `<p style="margin: 0 0 14px; font-size: 15px; color: #2c2c2c;">Hi ${escapeHtml(contactName)},</p>
       <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.55; color: #2c2c2c;">Thank you for contacting Emerald Management Solutions. Your consultation request has been received, and we'll get back to you as soon as possible to schedule your consultation.</p>
       <p style="margin: 0; font-size: 15px; line-height: 1.55; color: #2c2c2c;">If you have anything to add in the meantime, just reply to this email.</p>`,
      "You're receiving this because this address was entered in the consultation form at emeraldmanagementsolutions.org."
    ),
    tags: ["consultation-request-confirmation"],
  };

  try {
    await sendEmail(apiKey, notification);
  } catch (err) {
    context.log.error("Failed to send consultation notification:", err);
    context.res = {
      status: 502,
      jsonBody: { error: "The email service rejected the request." },
    };
    return;
  }

  // The request has reached us at this point, so a failed confirmation is
  // logged but doesn't fail the submission — otherwise the visitor would be
  // told to retry and we'd get the request twice.
  try {
    await sendEmail(apiKey, confirmation);
  } catch (err) {
    context.log.error("Consultation request delivered, but the confirmation email failed:", err);
  }

  context.res = { status: 200, jsonBody: { success: true } };
};
