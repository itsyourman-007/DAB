import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { merchantClinicQuoteLeads, merchantQuoteClientCustomizations } from "../drizzle/schema";
import {
  createMerchantQuoteClientCustomization,
  getDb,
  listMerchantClinicQuoteLeads,
  listMerchantQuoteClientCustomizations,
  saveMerchantClinicQuoteLead,
} from "./db";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("durable quote-client customisation records", () => {
  const suffix = Date.now();
  const email = `quote-client-${suffix}@example.test`;
  let database: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for quote-client customisation testing");
  });

  afterAll(async () => {
    if (!database) return;
    await database.delete(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.clientEmail, email));
    await database.delete(merchantClinicQuoteLeads).where(eq(merchantClinicQuoteLeads.clientEmail, email));
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
      unitsPurchased: 5000,
      revenueInr: 125000,
      notes: "Confirmed custom clinic order.",
    });
    expect(saved).toMatchObject({ clientEmail: email, unitsPurchased: 5000, revenueInr: 125000 });

    const customisations = await listMerchantQuoteClientCustomizations();
    expect(customisations.some((item) => item.id === saved.id && item.clientEmail === email)).toBe(true);
  });
});
