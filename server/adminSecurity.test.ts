import { afterEach, describe, expect, it, vi } from "vitest";
import { createOtp, hashOtp, hashPassword, otpMatches, passwordHashMatches } from "./adminSecurity";
import { sendAdminPasswordOtp, sendAdminSupportMessage, sendBuyerPaymentConfirmation } from "./adminOtpMail";

describe("administrator password and OTP security primitives", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hashes and verifies a password without accepting a different password", () => {
    const hash = hashPassword("a-long-password-for-testing");
    expect(passwordHashMatches("a-long-password-for-testing", hash)).toBe(true);
    expect(passwordHashMatches("different-password", hash)).toBe(false);
  });

  it("creates a six-digit, expiring OTP hash that accepts only the original code", () => {
    const otp = createOtp();
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(otpMatches(otp.code, otp.hash)).toBe(true);
    expect(otpMatches("000000", otp.hash)).toBe(otp.code === "000000");
    expect(hashOtp(otp.code)).toBe(otp.hash);
  });

  it("sends the OTP only to the configured recipient through Resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAdminPasswordOtp("123456")).resolves.toBe(process.env.ADMIN_OTP_RECIPIENT_EMAIL?.trim().toLowerCase());
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentPayload.to).toEqual([process.env.ADMIN_OTP_RECIPIENT_EMAIL?.trim().toLowerCase()]);
    expect(sentPayload.text).toContain("123456");
  });

  it("reports actionable configuration guidance when Resend rejects OTP delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("Sender is not verified", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAdminPasswordOtp("123456")).rejects.toThrow("The OTP email was rejected");
  });

  it("routes protected dashboard support messages only to the configured administrator mailbox", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "support-email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAdminSupportMessage({ subject: "UPI settlement", message: "Please review the latest submitted UTR." })).resolves.toBe(process.env.ADMIN_OTP_RECIPIENT_EMAIL?.trim().toLowerCase());
    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentPayload.to).toEqual([process.env.ADMIN_OTP_RECIPIENT_EMAIL?.trim().toLowerCase()]);
    expect(sentPayload.subject).toContain("UPI settlement");
    expect(sentPayload.text).toContain("latest submitted UTR");
  });

  it("sends a payment confirmation only to the verified buyer email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "buyer-email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBuyerPaymentConfirmation({
      email: "Buyer@Example.test",
      name: "Buyer Name",
      orderId: "ORDER-101",
      plan: "Introductory pack",
      amount: 500,
      paymentMethod: "UPI",
      utr: "UTR-101",
      deliverySchedule: "Delivered in 3–5 business days",
      quantity: 2,
      orderDate: "2026-08-12T00:00:00.000Z",
      address: "42 Dental Lane",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      phone: "+91 90000 00000",
    })).resolves.toBeUndefined();

    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentPayload.to).toEqual(["buyer@example.test"]);
    expect(sentPayload.subject).toContain("ORDER-101");
    expect(sentPayload.text).toContain("₹500");
    expect(sentPayload.text).toContain("UTR-101");
    expect(sentPayload.html).toContain("Order confirmed — 91DAB");
    expect(sentPayload.html).toContain("#146B70");
    expect(sentPayload.html).toContain("42 Dental Lane");
    expect(sentPayload.html).toContain("2 packs");
  });
});
