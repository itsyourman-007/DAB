import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantOrders } from "../drizzle/schema";
import { createMerchantCheckoutOrder, deleteExpiredDemoOrders, getDb, getMerchantOrder, isExplicitDemoOrderName } from "./db";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("demo order retention cleanup", () => {
  const suffix = Date.now();
  const demoOrderId = `91DAB-DEMO-ORDER-${suffix}`;
  const genuineOrderId = `91DAB-GENUINE-ORDER-${suffix}`;
  const similarOrderId = `91DAB-SIMILAR-ORDER-${suffix}`;
  let database: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for demo-cleanup integration testing");
  });

  afterAll(async () => {
    if (!database) return;
    await database.delete(merchantOrders).where(eq(merchantOrders.orderId, demoOrderId));
    await database.delete(merchantOrders).where(eq(merchantOrders.orderId, genuineOrderId));
    await database.delete(merchantOrders).where(eq(merchantOrders.orderId, similarOrderId));
  });

  it("deletes only explicit demo orders older than 24 hours", async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    for (const [orderId, buyerName] of [
      [demoOrderId, "Demo Dentist"],
      [genuineOrderId, "Genuine Customer"],
      [similarOrderId, "Demonstration Clinic"],
    ] as const) {
      await createMerchantCheckoutOrder({
        orderId,
        buyerName,
        buyerEmail: null,
        phone: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        planKey: "introductory",
        planName: "Introductory DAB",
        quantity: 1,
        amount: 500,
        paymentMethod: "UPI",
        deliverySpan: null,
        createdAt: oldDate,
      });
    }

    expect(isExplicitDemoOrderName("Demo Dentist")).toBe(true);
    expect(isExplicitDemoOrderName("Demonstration Clinic")).toBe(false);
    const result = await deleteExpiredDemoOrders(new Date());
    expect(result.deletedOrderIds).toContain(demoOrderId);
    expect(await getMerchantOrder(demoOrderId)).toBeUndefined();
    expect(await getMerchantOrder(genuineOrderId)).toBeDefined();
    expect(await getMerchantOrder(similarOrderId)).toBeDefined();
  }, 15_000);
});
