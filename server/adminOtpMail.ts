function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

function inr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function adminOtpRecipient() {
  return required("ADMIN_OTP_RECIPIENT_EMAIL").trim().toLowerCase();
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export async function sendAdminPasswordOtp(code: string) {
  const recipient = adminOtpRecipient();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: required("ADMIN_OTP_FROM_EMAIL"),
      to: [recipient],
      subject: "91DAB administrator password-change code",
      text: `Your 91DAB administrator password-change code is ${code}. It expires in 10 minutes. If you did not request this change, do not share this code.`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[Admin OTP] Resend rejected the configured recipient delivery", { status: response.status, detail: detail.slice(0, 500) });
    throw new Error("The OTP email was rejected. Verify that RESEND_API_KEY is active and ADMIN_OTP_FROM_EMAIL is a verified Resend sender; the code is sent only to ADMIN_OTP_RECIPIENT_EMAIL.");
  }
  return recipient;
}

export async function sendAdminSupportMessage(input: { subject: string; message: string }) {
  const recipient = adminOtpRecipient();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: required("ADMIN_OTP_FROM_EMAIL"),
      to: [recipient],
      subject: `91DAB dashboard support: ${input.subject}`,
      text: [
        "A protected 91DAB merchant dashboard support request was submitted.",
        "",
        `Subject: ${input.subject}`,
        "",
        input.message,
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("[Dashboard support] Resend rejected the configured recipient delivery", { status: response.status, detail: detail.slice(0, 500) });
    throw new Error("The support message could not be sent. Verify that ADMIN_OTP_FROM_EMAIL is a verified Resend sender.");
  }
  return recipient;
}

export async function sendMonthlySubscriptionSummary(input: {
  periodKey: string;
  subscriptions: Array<{ orderId: string; buyerName: string; buyerEmail: string | null; amount: number; quantity: number; createdAt: Date }>;
}) {
  const recipient = adminOtpRecipient();
  const rows = input.subscriptions.map((subscription) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #DCE6E7;font-family:monospace;">${escapeHtml(subscription.orderId)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">${escapeHtml(subscription.buyerName)}${subscription.buyerEmail ? `<br><span style="font-size:12px;color:#557;">${escapeHtml(subscription.buyerEmail)}</span>` : ""}</td>
      <td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;">${subscription.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;">${inr(subscription.amount)}</td>
    </tr>`).join("");
  const total = input.subscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#0F2325;">
    <h2 style="color:#146B70;margin-bottom:4px;">91DAB monthly subscription summary</h2>
    <p>These verified monthly subscriptions are active for <strong>${escapeHtml(input.periodKey)}</strong>. Their recurring delivery is due on the 1st of the month.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <thead><tr><th align="left" style="padding:8px 0;border-bottom:2px solid #146B70;">Order</th><th align="left" style="padding:8px 0;border-bottom:2px solid #146B70;">Customer</th><th align="right" style="padding:8px 0;border-bottom:2px solid #146B70;">Qty</th><th align="right" style="padding:8px 0;border-bottom:2px solid #146B70;">Amount</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="padding:12px 0;">No verified monthly subscriptions are active.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="3" style="padding:12px 0;font-weight:bold;">Total recurring value</td><td style="padding:12px 0;text-align:right;font-weight:bold;">${inr(total)}</td></tr></tfoot>
    </table>
    <p style="color:#557;font-size:13px;">This message is generated once per month by the protected 91DAB merchant dashboard.</p>
  </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: required("ADMIN_OTP_FROM_EMAIL"),
      to: [recipient],
      subject: `91DAB monthly subscriptions — ${input.periodKey}`,
      html,
      text: [
        `91DAB monthly subscription summary — ${input.periodKey}`,
        "",
        ...input.subscriptions.map((subscription) => `${subscription.orderId} · ${subscription.buyerName} · Qty ${subscription.quantity} · ${inr(subscription.amount)}`),
        "",
        `Total recurring value: ${inr(total)}`,
      ].join("\n"),
    }),
  });
  if (!response.ok) throw new Error("Unable to send monthly subscription summary email");
  return recipient;
}

export async function sendBuyerPaymentConfirmation(input: {
  email: string;
  name: string;
  orderId: string;
  plan: string;
  amount: number;
  paymentMethod: string;
  utr?: string;
  deliverySchedule?: string | null;
  quantity?: number | null;
  orderDate?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
}) {
  const brandLogoUrl = process.env.EMAIL_BRAND_LOGO_URL?.trim();
  const siteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "");
  const logo = brandLogoUrl
    ? `<img src="${escapeHtml(brandLogoUrl)}" alt="91DAB" width="130" style="display:block;max-width:130px;height:auto;margin:0 0 14px;">`
    : "";
  const deliveryAddress = [input.address, [input.city, input.state, input.pincode].filter(Boolean).join(", "), input.phone]
    .filter(Boolean)
    .map((part) => escapeHtml(part))
    .join("<br>");
  const qty = input.quantity || 1;
  const optionalRows = [
    input.paymentMethod ? ["Payment method", input.paymentMethod] : null,
    input.utr ? ["UPI reference", input.utr] : null,
    input.deliverySchedule ? ["Delivery schedule", input.deliverySchedule] : null,
  ].filter((row): row is [string, string] => Boolean(row)).map(([label, value]) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0F2325;">
    ${logo}<h2 style="color:#146B70;margin-bottom:4px;">Order confirmed — 91DAB</h2>
    <p>Hi ${escapeHtml(input.name)}, thanks for your order — we've received your payment and your DAB pack is being prepared for shipping.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">Order ID</td><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;font-family:monospace;">${escapeHtml(input.orderId)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">DAB — ${escapeHtml(input.plan)} × ${qty} pack${qty === 1 ? "" : "s"}</td><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;">${inr(input.amount)}</td></tr>
      ${optionalRows}
      <tr><td style="padding:8px 0;font-weight:bold;">Total paid</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${inr(input.amount)}</td></tr>
    </table>
    ${deliveryAddress ? `<p style="margin-bottom:4px;"><strong>Shipping to</strong></p><p style="margin-top:0;color:#3A5254;">${deliveryAddress}</p>` : ""}
    <p style="color:#557;font-size:13px;">${escapeHtml(input.deliverySchedule || "Expect delivery in 3–5 business days.")} Reply to this email or write to dantaresearch@gmail.com if you have any questions.</p>
    ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}" style="color:#146B70;font-size:13px;font-weight:bold;">Visit 91DAB</a></p>` : ""}
  </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: required("ADMIN_OTP_FROM_EMAIL"),
      to: [input.email.trim().toLowerCase()],
      subject: `91DAB payment confirmed — order ${input.orderId}`,
      html,
      text: [
        `Hello ${input.name},`,
        "",
        "Your 91DAB payment has been confirmed.",
        `Order: ${input.orderId}`,
        `Plan: ${input.plan}`,
        `Amount: ${inr(input.amount)}`,
        `Payment method: ${input.paymentMethod}`,
        input.utr ? `UPI reference: ${input.utr}` : "",
        input.deliverySchedule ? `Delivery schedule: ${input.deliverySchedule}` : "",
        input.address ? `Delivery address: ${[input.address, input.city, input.state, input.pincode].filter(Boolean).join(", ")}` : "",
        "",
        "Thank you for choosing DAB.",
      ].filter(Boolean).join("\n"),
    }),
  });
  if (!response.ok) throw new Error("Unable to send buyer payment-confirmation email");
}

export async function sendBuyerFulfillmentConfirmation(input: {
  email: string;
  name: string;
  orderId: string;
  plan: string;
  amount: number;
  quantity: number;
  status: "shipped" | "delivered";
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}) {
  const isDelivered = input.status === "delivered";
  const title = isDelivered ? "Delivered" : "Shipped";
  const message = isDelivered
    ? "Your 91DAB order has been marked as delivered. We hope it reaches you safely and supports your clinical practice."
    : "Your 91DAB order has been shipped and is now on its way to you.";
  const destination = [input.address, [input.city, input.state, input.pincode].filter(Boolean).join(", ")]
    .filter(Boolean)
    .map((part) => escapeHtml(part))
    .join("<br>");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0F2325;">
    <h2 style="color:#146B70;margin-bottom:4px;">Order ${title.toLowerCase()} — 91DAB</h2>
    <p>Hi ${escapeHtml(input.name)}, ${escapeHtml(message)}</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">Order ID</td><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;font-family:monospace;">${escapeHtml(input.orderId)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">Order</td><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;">${escapeHtml(input.plan)} × ${input.quantity} pack${input.quantity === 1 ? "" : "s"}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;">Status</td><td style="padding:8px 0;border-bottom:1px solid #DCE6E7;text-align:right;font-weight:bold;color:#146B70;">${title}</td></tr>
      <tr><td style="padding:8px 0;">Amount paid</td><td style="padding:8px 0;text-align:right;">${inr(input.amount)}</td></tr>
    </table>
    ${destination ? `<p style="margin-bottom:4px;"><strong>Delivery address</strong></p><p style="margin-top:0;color:#3A5254;">${destination}</p>` : ""}
    <p style="color:#557;font-size:13px;">Reply to this email or write to dantaresearch@gmail.com if you need help with this order.</p>
  </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${required("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: required("ADMIN_OTP_FROM_EMAIL"),
      to: [input.email.trim().toLowerCase()],
      subject: `91DAB order ${input.status} — ${input.orderId}`,
      html,
      text: [`Hello ${input.name},`, "", message, `Order: ${input.orderId}`, `Plan: ${input.plan}`, `Quantity: ${input.quantity}`, `Amount paid: ${inr(input.amount)}`, `Status: ${title}`, "", "Thank you for choosing DAB."].join("\n"),
    }),
  });
  if (!response.ok) throw new Error(`Unable to send buyer ${input.status} confirmation email`);
}
