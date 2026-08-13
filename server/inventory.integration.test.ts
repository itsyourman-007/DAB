import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantInventory, merchantOrders } from "../drizzle/schema";
import {
  createMerchantCheckoutOrder,
  decrementInventoryForPaidOrder,
  getDb,
  getMerchantInventory,
  markMerchantOrderPaid,
  setMerchantInventoryUnits,
  submitMerchantOrderUtr,
} from "./db";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("trusted inventory deduction", () => {
  const orderId = `91DAB-INVENTORY-TEST-${Date.now()}`;
  let database: Awaited<ReturnType<typeof getDb>>;
  let originalInventory: typeof merchantInventory.$inferSelect | undefined;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for inventory integration testing");
    originalInventory = (await database.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0];
  });

  afterAll(async () => {
    if (!database) return;
    await database.delete(merchantOrders).where(eq(merchantOrders.orderId, orderId));
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

  it("deducts a paid order only once and reports stock below the 1,000-unit threshold", async () => {
    await setMerchantInventoryUnits(1001);
    await createMerchantCheckoutOrder({
      orderId,
      buyerName: "Inventory Test Buyer",
      buyerEmail: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      pincode: null,
      planKey: "introductory",
      planName: "Introductory DAB",
      quantity: 3,
      amount: 1500,
      paymentMethod: "UPI",
      deliverySpan: null,
      createdAt: new Date(),
    });
    await submitMerchantOrderUtr(orderId, "UTR-INVENTORY-TEST");
    await markMerchantOrderPaid(orderId);

    const first = await decrementInventoryForPaidOrder(orderId);
    const second = await decrementInventoryForPaidOrder(orderId);
    const inventory = await getMerchantInventory();

    expect(first).toMatchObject({ applied: true, reason: "deducted" });
    expect(second).toMatchObject({ applied: false, reason: "already-deducted" });
    expect(inventory).toMatchObject({ configured: true, availableUnits: 998 });
    expect(inventory.availableUnits).toBeLessThan(1000);
  });
});
