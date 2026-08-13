import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantDashboardLoginAudits, merchantOrders } from "../drizzle/schema";
import {
  createMerchantCheckoutOrder,
  getDb,
  listMerchantDashboardLoginAudits,
  markMerchantOrderPaid,
  recordMerchantDashboardLogin,
  submitMerchantOrderUtr,
  updateMerchantOrderFulfillment,
} from "./db";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("fulfillment and successful-login audit lifecycle", () => {
  const suffix = Date.now();
  const orderId = `91DAB-FULFILLMENT-TEST-${suffix}`;
  const auditEmail = `fulfillment-audit-${suffix}@example.invalid`;
  let database: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for fulfillment integration testing");
  });

  afterAll(async () => {
    if (!database) return;
    await database.delete(merchantOrders).where(eq(merchantOrders.orderId, orderId));
    await database.delete(merchantDashboardLoginAudits).where(eq(merchantDashboardLoginAudits.email, auditEmail));
  });

  it("persists the real paid-order shipment sequence and successful audit records", async () => {
    await createMerchantCheckoutOrder({
      orderId,
      buyerName: "Fulfillment Test Buyer",
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
      createdAt: new Date(),
    });
    await submitMerchantOrderUtr(orderId, "UTR-FULFILLMENT-TEST");
    await expect(updateMerchantOrderFulfillment({ orderId, status: "shipped" })).rejects.toThrow("Only paid orders");

    await markMerchantOrderPaid(orderId);
    await expect(updateMerchantOrderFulfillment({ orderId, status: "delivered" })).rejects.toThrow("Mark the order shipped");
    const shipped = await updateMerchantOrderFulfillment({ orderId, status: "shipped" });
    expect(shipped).toMatchObject({ paymentStatus: "paid", fulfillmentStatus: "shipped" });
    expect(shipped?.shippedAt).toBeInstanceOf(Date);

    const delivered = await updateMerchantOrderFulfillment({ orderId, status: "delivered" });
    expect(delivered).toMatchObject({ fulfillmentStatus: "delivered" });
    expect(delivered?.shippedAt).toBeInstanceOf(Date);
    expect(delivered?.deliveredAt).toBeInstanceOf(Date);
    await expect(updateMerchantOrderFulfillment({ orderId, status: "delivered" })).rejects.toThrow("already marked delivered");

    await recordMerchantDashboardLogin({ email: auditEmail, role: "employee" });
    const audit = (await listMerchantDashboardLoginAudits()).find((entry) => entry.email === auditEmail);
    expect(audit).toMatchObject({ email: auditEmail, role: "employee" });
    expect(audit?.signedInAt).toBeInstanceOf(Date);
  }, 15_000);
});
