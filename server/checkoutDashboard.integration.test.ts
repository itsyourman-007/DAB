import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantOrders } from "../drizzle/schema";
import { getDb, getMerchantOrder, listMerchantOrders } from "./db";
import { registerCheckoutRoutes } from "./checkoutRoutes";

const describeWithCheckoutDependencies = process.env.DATABASE_URL && process.env.MERCHANT_VPA ? describe : describe.skip;

describeWithCheckoutDependencies("checkout to dashboard record lifecycle", () => {
  let server: Server;
  let baseUrl = "";
  let database: Awaited<ReturnType<typeof getDb>>;
  let orderId: string | undefined;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for checkout lifecycle validation");
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
    if (orderId && database) await database.delete(merchantOrders).where(eq(merchantOrders.orderId, orderId));
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("persists the QR-payment checkout as a trusted pending dashboard order", async () => {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planKey: "introductory",
        qty: 1,
        orderInfo: {
          name: `Checkout Visibility Test ${Date.now()}`,
          email: "checkout-visibility@example.test",
          phone: "9000000000",
          address: "1 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
        },
      }),
    });
    const payload = await response.json() as { orderId: string; qrDataUrl: string };
    orderId = payload.orderId;

    expect(response.status).toBe(200);
    expect(payload.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect((await getMerchantOrder(orderId))?.paymentStatus).toBe("pending");
    expect((await listMerchantOrders()).some((order) => order.orderId === orderId && order.paymentStatus === "pending")).toBe(true);
  }, 15_000);
});
