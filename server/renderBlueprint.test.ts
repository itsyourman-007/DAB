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
    expect(blueprint).toContain("buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm build");
    expect(blueprint).not.toContain("corepack enable");
    expect(blueprint).toContain("startCommand: node server/_core/migrateOnStart.mjs && pnpm start");
    const bootstrap = readFileSync(resolve(process.cwd(), "server/_core/migrateOnStart.mjs"), "utf8");
    expect(bootstrap).toContain("Fresh database detected");
    expect(bootstrap).toContain("Applying additive schema updates");
    expect(bootstrap).toContain("merchantInventoryShipmentAllocations");
    expect(bootstrap).toContain("merchantQuoteClientCustomizations");
    expect(bootstrap).toContain("merchantClinicQuoteLeads");
    expect(bootstrap).toContain("merchantOrders.deliveryStartMonth");
    expect(bootstrap).toContain("Database schema is incomplete");
    expect(bootstrap).toContain("process.exit(0)");
    expect(guide).toContain("MySQL-compatible database");
    expect(guide).toContain("Resend");
    expect(guide).toContain("Custom Domains");
    expect(guide).toContain("Auto-Deploy");
    expect(guide).toContain("GoDaddy Node.js Hosting");
    expect(guide).toContain("Render paid Web Service");
    expect(guide).toContain("Some Render Node images make system package-manager paths read-only");
    expect(guide).toContain("Resend automatic-email setup");
    expect(guide).toContain("Create API Key");
    expect(guide).toContain("Buyer payment confirmation");
  });
});
