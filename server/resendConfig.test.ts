import { describe, expect, it } from "vitest";

describe("Resend OTP delivery configuration", () => {
  it("accepts the configured Resend API key without sending any email", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.ADMIN_OTP_RECIPIENT_EMAIL;
    const from = process.env.ADMIN_OTP_FROM_EMAIL;

    expect(apiKey).toBeTruthy();
    expect(recipient).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(from).toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});
