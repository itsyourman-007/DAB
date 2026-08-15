import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantClinicQuoteLeads, merchantInventory, merchantInventoryShipmentAllocations, merchantQuoteClientCustomizations } from "../drizzle/schema";
import {
  createMerchantQuoteClientCustomization,
  getDb,
  listMerchantClinicQuoteLeads,
  listMerchantQuoteClientCustomizations,
  saveMerchantClinicQuoteLead,
  setMerchantInventoryUnits,
  updateMerchantQuoteClientCustomization,
  updateMerchantQuoteClientCustomizationFulfillment,
  deleteMerchantQuoteClientCustomization,
} from "./db";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("durable quote-client customisation records", () => {
  const suffix = Date.now();
  const email = `quote-client-${suffix}@example.test`;
  let database: Awaited<ReturnType<typeof getDb>>;
  let originalInventory: typeof merchantInventory.$inferSelect | undefined;
  let shippedCustomizationId: number | undefined;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for quote-client customisation testing");
    originalInventory = (await database.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0];
  });

  afterAll(async () => {
    if (!database) return;
    if (shippedCustomizationId) await database.delete(merchantInventoryShipmentAllocations).where(eq(merchantInventoryShipmentAllocations.orderId, `CUSTOM-${shippedCustomizationId}`));
    await database.delete(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.clientEmail, email));
    await database.delete(merchantClinicQuoteLeads).where(eq(merchantClinicQuoteLeads.clientEmail, email));
    if (originalInventory) {
      await database.insert(merchantInventory).values(originalInventory).onDuplicateKeyUpdate({ set: { productKey: originalInventory.productKey, productName: originalInventory.productName, availableUnits: originalInventory.availableUnits, configured: originalInventory.configured } });
    } else {
      await database.delete(merchantInventory).where(eq(merchantInventory.id, 1));
    }
  });

  it("persists a real clinic quote lead and its administrator-recorded units and revenue", async () => {
    await saveMerchantClinicQuoteLead({
      clientEmail: email,
      clientPhone: "9000000000",
      note: "Clinic / bulk order quote requested for 5,000+ pieces.",
    });
    const leads = await listMerchantClinicQuoteLeads();
    expect(leads.some((lead) => lead.clientEmail === email && lead.clientPhone === "9000000000")).toBe(true);

    const saved = await createMerchantQuoteClientCustomization({
      clientName: "Quote Client Test",
      clientEmail: email,
      clientPhone: "9000000000",
      deliveryAddress: "12 Clinic Lane, Bengaluru, Karnataka 560001",
      paymentMode: "upi",
      unitsPurchased: 5000,
      revenueInr: 125000,
      notes: "Confirmed custom clinic order.",
    });
    expect(saved).toMatchObject({ clientEmail: email, deliveryAddress: "12 Clinic Lane, Bengaluru, Karnataka 560001", paymentMode: "upi", unitsPurchased: 5000, revenueInr: 125000 });

    const customisations = await listMerchantQuoteClientCustomizations();
    expect(customisations.some((item) => item.id === saved.id && item.clientEmail === email)).toBe(true);

    const edited = await updateMerchantQuoteClientCustomization({ ...saved, deliveryAddress: "45 Updated Clinic Road, Bengaluru, Karnataka 560002", paymentMode: "bank_transfer", clientName: "Edited Quote Client", unitsPurchased: 4500, revenueInr: 130000 });
    expect(edited).toMatchObject({ id: saved.id, clientName: "Edited Quote Client", deliveryAddress: "45 Updated Clinic Road, Bengaluru, Karnataka 560002", paymentMode: "bank_transfer", unitsPurchased: 4500, revenueInr: 130000 });

    await deleteMerchantQuoteClientCustomization(saved.id);
    expect((await listMerchantQuoteClientCustomizations()).some((item) => item.id === saved.id)).toBe(false);
  });

  it("deducts configured stock when a custom sale ships and locks the sale after shipment", async () => {
    await setMerchantInventoryUnits(1000);
    const saved = await createMerchantQuoteClientCustomization({ clientName: "Shipment Quote Client", clientEmail: email, clientPhone: null, deliveryAddress: "1 Shipment Street, Bengaluru, Karnataka 560003", paymentMode: "cash", unitsPurchased: 125, revenueInr: 5000, notes: null });
    shippedCustomizationId = saved.id;

    const shipped = await updateMerchantQuoteClientCustomizationFulfillment({ id: saved.id, status: "shipped" });
    expect(shipped.fulfillmentStatus).toBe("shipped");
    expect((await database.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0]?.availableUnits).toBe(875);

    const delivered = await updateMerchantQuoteClientCustomizationFulfillment({ id: saved.id, status: "delivered" });
    expect(delivered.fulfillmentStatus).toBe("delivered");
    await expect(updateMerchantQuoteClientCustomization({ ...saved, deliveryAddress: "1 Shipment Street, Bengaluru, Karnataka 560003", paymentMode: "cash", clientName: "Changed after shipment" })).rejects.toThrow("cannot be edited");
    await expect(deleteMerchantQuoteClientCustomization(saved.id)).rejects.toThrow("cannot be deleted");
  });
});
