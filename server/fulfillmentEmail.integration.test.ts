import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fulfillmentNotificationEmails, merchantOrders } from "../drizzle/schema";
import { createAdminSession } from "./adminAuth";
import { createMerchantCheckoutOrder, getDb, markMerchantOrderPaid, reserveFulfillmentNotificationEmail, submitMerchantOrderUtr } from "./db";
import { appRouter } from "./routers";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("buyer fulfillment notification delivery", () => {
  let database: Awaited<ReturnType<typeof getDb>>;
  const orderId = `FULFILLMENT-EMAIL-TEST-${Date.now()}`;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for fulfillment email integration testing");
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await database?.delete(fulfillmentNotificationEmails).where(eq(fulfillmentNotificationEmails.orderId, orderId));
    await database?.delete(merchantOrders).where(eq(merchantOrders.orderId, orderId));
  });

  it("sends one buyer email for each paid-order shipment transition and prevents duplicate event sends", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "temporary test failure" }), { status: 500 }))
      .mockResolvedValue(new Response(JSON.stringify({ id: "fulfillment-email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await createMerchantCheckoutOrder({
      orderId,
      buyerName: "Fulfillment Email Test Buyer",
      buyerEmail: "fulfillment-buyer@example.test",
      phone: "9000000000",
      address: "1 Delivery Test Street",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      planKey: "introductory",
      planName: "Introductory pack",
      quantity: 1,
      amount: 500,
      paymentMethod: "UPI",
      deliverySpan: null,
      createdAt: new Date(),
    });
    await submitMerchantOrderUtr(orderId, "UTR-FULFILLMENT-EMAIL");
    await markMerchantOrderPaid(orderId);
    const token = await createAdminSession();
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: { cookie: `91dab_admin_session=${token}` } },
      res: { cookie: () => undefined, clearCookie: () => undefined },
    } as any);

    const shipped = await caller.admin.updateFulfillment({ orderId, status: "shipped" });
    expect(shipped.order).toMatchObject({ orderId, fulfillmentStatus: "shipped" });
    expect(shipped.email).toBe("failed");
    const retriedShipmentEmail = await caller.admin.resendFulfillmentEmail({ orderId, status: "shipped" });
    expect(retriedShipmentEmail.order).toMatchObject({ orderId, fulfillmentStatus: "shipped" });
    expect(retriedShipmentEmail.email).toBe("sent");
    const delivered = await caller.admin.updateFulfillment({ orderId, status: "delivered" });
    expect(delivered.order).toMatchObject({ orderId, fulfillmentStatus: "delivered" });
    expect(delivered.email).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await reserveFulfillmentNotificationEmail({ orderId, status: "shipped", recipient: "fulfillment-buyer@example.test" })).toBe(false);
    const notifications = await database!.select().from(fulfillmentNotificationEmails).where(eq(fulfillmentNotificationEmails.orderId, orderId));
    expect(notifications.map((notification) => notification.status).sort()).toEqual(["delivered", "shipped"]);
    expect(notifications.every((notification) => notification.deliveryStatus === "sent")).toBe(true);
  }, 20_000);
});
