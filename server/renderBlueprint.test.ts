import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const blueprint = readFileSync(resolve(process.cwd(), "render.yaml"), "utf8");
const guide = readFileSync(resolve(process.cwd(), "DEPLOY_RENDER.md"), "utf8");

describe("Render deployment configuration", () => {
  it("declares the required server-side secrets and documents MySQL, Resend, domains, and updates", () => {
    ["DATABASE_URL", "MERCHANT_VPA", "RESEND_API_KEY", "ADMIN_OTP_RECIPIENT_EMAIL", "ADMIN_OTP_FROM_EMAIL", "ADMIN_DASHBOARD_PASSWORD", "JWT_SECRET"].forEach((key) => {
      expect(blueprint).toContain(`key: ${key}`);
    });
    expect(guide).toContain("MySQL-compatible database");
    expect(guide).toContain("Resend");
    expect(guide).toContain("Custom Domains");
    expect(guide).toContain("Auto-Deploy");
  });
});
