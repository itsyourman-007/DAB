import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { paymentConfirmationEmails } from "../drizzle/schema";
import { createAdminSession } from "./adminAuth";
import { getDb } from "./db";
import { appRouter } from "./routers";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("buyer payment-confirmation delivery", () => {
  let database: Awaited<ReturnType<typeof getDb>>;
  const orderId = `PAYMENT-EMAIL-TEST-${Date.now()}`;

  beforeAll(async () => {
    database = await getDb();
    if (!database) throw new Error("Database is required for payment email integration testing");
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await database?.delete(paymentConfirmationEmails).where(eq(paymentConfirmationEmails.orderId, orderId));
  });

  it("sends one buyer email after verification and prevents a duplicate send", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "payment-email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const token = await createAdminSession();
    const ctx = {
      user: null,
      req: { protocol: "https", headers: { cookie: `91dab_admin_session=${token}` } },
      res: { cookie: () => undefined, clearCookie: () => undefined },
    } as any;
    const caller = appRouter.createCaller(ctx);
    const input = {
      orderId,
      buyerName: "Payment Test Buyer",
      buyerEmail: "payment-buyer@example.test",
      plan: "Introductory pack",
      amount: 500,
      paymentMethod: "UPI",
      utr: "TEST-UTR-500",
      deliverySchedule: null,
    };

    await expect(caller.admin.sendPaymentConfirmation(input)).resolves.toEqual({ sent: true, duplicate: false });
    await expect(caller.admin.sendPaymentConfirmation(input)).resolves.toEqual({ sent: false, duplicate: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const delivery = await database!.select().from(paymentConfirmationEmails).where(eq(paymentConfirmationEmails.orderId, orderId)).limit(1);
    expect(delivery[0]).toMatchObject({ recipient: "payment-buyer@example.test", status: "sent" });
  });
});
