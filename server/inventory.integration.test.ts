import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantInventory, merchantInventoryShipmentAllocations, merchantOrders, subscriptionDeliveryRecords } from "../drizzle/schema";
import {
  createMerchantCheckoutOrder,
  getDb,
  getMerchantInventory,
  listMerchantInventoryShipmentAllocations,
  markMerchantOrderPaid,
  recordSubscriptionShipment,
  setMerchantInventoryUnits,
  submitMerchantOrderUtr,
  updateMerchantOrderFulfillment,
} from "./db";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("shipment-driven DAB inventory", () => {
  const suffix = Date.now();
  const orderIds = {
    introductory: `91DAB-INVENTORY-INTRO-${suffix}`,
    monthly: `91DAB-INVENTORY-MONTHLY-${suffix}`,
    yearlyMonthly: `91DAB-INVENTORY-YEARLY-MONTHLY-${suffix}`,
    yearlyOnce: `91DAB-INVENTORY-YEARLY-ONCE-${suffix}`,
  };
  let database: Awaited<ReturnType<typeof getDb>>;
  let originalInventory: typeof merchantInventory.$inferSelect | undefined;

  async function createPaidOrder(input: { orderId: string; planKey: "introductory" | "monthly" | "yearly"; quantity: number; deliverySpan: string | null; deliveryStartMonth?: string | null }) {
    await createMerchantCheckoutOrder({
      orderId: input.orderId,
      buyerName: "Inventory Test Buyer",
      buyerEmail: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      pincode: null,
      planKey: input.planKey,
      planName: `DAB ${input.planKey}`,
      quantity: input.quantity,
      amount: 100,
      paymentMethod: "UPI",
      deliverySpan: input.deliverySpan,
      deliveryStartMonth: input.deliveryStartMonth ?? null,
      createdAt: new Date(),
    });
    await submitMerchantOrderUtr(input.orderId, `UTR-${input.orderId.slice(-12)}`);
    await markMerchantOrderPaid(input.orderId);
  }

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for inventory integration testing");
    originalInventory = (await database.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0];
  });

  afterAll(async () => {
    if (!database) return;
    for (const orderId of Object.values(orderIds)) {
      await database.delete(subscriptionDeliveryRecords).where(eq(subscriptionDeliveryRecords.orderId, orderId));
      await database.delete(merchantInventoryShipmentAllocations).where(eq(merchantInventoryShipmentAllocations.orderId, orderId));
      await database.delete(merchantOrders).where(eq(merchantOrders.orderId, orderId));
    }
    if (originalInventory) {
      await database.insert(merchantInventory).values(originalInventory).onDuplicateKeyUpdate({
        set: {
          productKey: originalInventory.productKey,
          productName: originalInventory.productName,
          availableUnits: originalInventory.availableUnits,
          configured: originalInventory.configured,
        },
      });
    } else {
      await database.delete(merchantInventory).where(eq(merchantInventory.id, 1));
    }
  });

  it("keeps paid orders in stock until shipment and deducts each one-time, monthly, and yearly allocation exactly once", async () => {
    await setMerchantInventoryUnits(5_000);
    await createPaidOrder({ orderId: orderIds.introductory, planKey: "introductory", quantity: 3, deliverySpan: null });
    await createPaidOrder({ orderId: orderIds.monthly, planKey: "monthly", quantity: 4, deliverySpan: "monthly", deliveryStartMonth: "2026-08" });
    await createPaidOrder({ orderId: orderIds.yearlyMonthly, planKey: "yearly", quantity: 1, deliverySpan: "monthly", deliveryStartMonth: "2026-08" });
    await createPaidOrder({ orderId: orderIds.yearlyOnce, planKey: "yearly", quantity: 1, deliverySpan: "once" });

    expect((await getMerchantInventory()).availableUnits).toBe(5_000);

    await updateMerchantOrderFulfillment({ orderId: orderIds.introductory, status: "shipped" });
    expect((await getMerchantInventory()).availableUnits).toBe(4_964);

    const monthlyFirst = await recordSubscriptionShipment({ orderId: orderIds.monthly, periodKey: "2026-08" });
    const monthlyDuplicate = await recordSubscriptionShipment({ orderId: orderIds.monthly, periodKey: "2026-08" });
    expect(monthlyFirst).toMatchObject({ applied: true, reason: "deducted", allocation: { units: 100, periodKey: "2026-08" } });
    expect(monthlyDuplicate).toMatchObject({ applied: false, reason: "already-shipped", allocation: { units: 100, periodKey: "2026-08" } });
    await recordSubscriptionShipment({ orderId: orderIds.monthly, periodKey: "2026-09" });
    await recordSubscriptionShipment({ orderId: orderIds.monthly, periodKey: "2026-10" });
    await recordSubscriptionShipment({ orderId: orderIds.monthly, periodKey: "2026-11" });
    expect((await getMerchantInventory()).availableUnits).toBe(4_564);

    await recordSubscriptionShipment({ orderId: orderIds.yearlyMonthly, periodKey: "2026-08" });
    expect((await getMerchantInventory()).availableUnits).toBe(4_439);

    await expect(recordSubscriptionShipment({ orderId: orderIds.monthly, periodKey: "2027-08" })).rejects.toThrow("outside the buyer-selected 12-month delivery schedule");
    expect((await getMerchantInventory()).availableUnits).toBe(4_439);

    await updateMerchantOrderFulfillment({ orderId: orderIds.yearlyOnce, status: "shipped" });
    expect((await getMerchantInventory()).availableUnits).toBe(2_939);

    const allocations = await listMerchantInventoryShipmentAllocations();
    const orderAllocations = allocations.filter((allocation) => Object.values(orderIds).includes(allocation.orderId));
    expect(orderAllocations).toHaveLength(7);
    expect(orderAllocations.filter((allocation) => allocation.orderId === orderIds.monthly).map((allocation) => allocation.units)).toEqual([100, 100, 100, 100]);
  }, 60_000);
});
