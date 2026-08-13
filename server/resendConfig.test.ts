import { describe, expect, it } from "vitest";

describe("Resend OTP delivery configuration", () => {
  it("has the values required to send an OTP without contacting the external provider", () => {
    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.ADMIN_OTP_RECIPIENT_EMAIL;
    const from = process.env.ADMIN_OTP_FROM_EMAIL;

    expect(apiKey).toBeTruthy();
    expect(recipient).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(from).toBeTruthy();
  });
});
