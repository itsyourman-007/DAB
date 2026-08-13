import type { Server } from "node:http";
import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createMerchantCheckoutOrder: vi.fn(async (input: Record<string, unknown>) => ({ ...input, paymentStatus: "pending", source: "91dab-shop" })),
  getMerchantOrder: vi.fn(),
  expireMerchantOrder: vi.fn(),
  submitMerchantOrderUtr: vi.fn(),
}));

import { registerCheckoutRoutes } from "./checkoutRoutes";
import * as db from "./db";

describe("trusted checkout QR endpoint", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    expect(process.env.MERCHANT_VPA?.trim()).toBeTruthy();
    const app = express();
    app.use(express.json());
    registerCheckoutRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Test server address was not available");
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.mocked(db.createMerchantCheckoutOrder).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a checkout QR from the configured merchant VPA", async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planKey: "introductory",
        qty: 1,
        orderInfo: {
          name: "QR Configuration Test",
          email: "qr-config@example.test",
          phone: "9000000000",
          address: "1 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      }),
    });
    const body = await response.json() as { upiLink: string; qrDataUrl: string; amount: number };
    expect(response.status).toBe(200);
    expect(body.amount).toBe(500);
    expect(body.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(body.upiLink).toContain(`pa=${encodeURIComponent(process.env.MERCHANT_VPA!.trim())}`);
  });

  it("refuses an unconfigured merchant VPA before creating a partial dashboard order", async () => {
    vi.stubEnv("MERCHANT_VPA", "");
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planKey: "introductory",
        qty: 1,
        orderInfo: {
          name: "Configuration Safety Test",
          email: "configuration@example.test",
          phone: "9000000000",
          address: "1 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      }),
    });
    const body = await response.json() as { error: string };
    expect(response.status).toBe(503);
    expect(body.error).toContain("Merchant payment configuration is incomplete");
    expect(db.createMerchantCheckoutOrder).not.toHaveBeenCalled();
  });
});
