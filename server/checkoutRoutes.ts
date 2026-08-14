import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { z } from "zod";
import * as db from "./db";

const CHECKOUT_TTL_MS = 5 * 60 * 1000;

const plans = {
  introductory: { name: "Introductory pack", price: 500 },
  monthly: { name: "Monthly subscription", price: 3000 },
  yearly: { name: "Yearly subscription", price: 30000 },
} as const;

const createOrderInput = z.object({
  planKey: z.enum(["introductory", "monthly", "yearly"]),
  qty: z.number().int().min(1).max(1000),
  deliverySpan: z.enum(["monthly", "once"]).nullable().optional(),
  deliveryStartMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(),
  orderInfo: z.object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().min(6).max(64),
    address: z.string().trim().min(4).max(500),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    pincode: z.string().trim().min(3).max(32),
  }),
});

const utrInput = z.object({ utr: z.string().trim().regex(/^[A-Za-z0-9-]{6,128}$/) });
const clinicQuoteInput = z.object({
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(6).max(64).nullable().optional(),
});

function subscriptionScheduleForCheckout(input: z.infer<typeof createOrderInput>) {
  if (input.planKey === "introductory") return { deliverySpan: null, deliveryStartMonth: null };
  if (!input.deliveryStartMonth) throw new Error("Select the first delivery month for this subscription");
  if (input.planKey === "monthly") {
    if (input.deliverySpan && input.deliverySpan !== "monthly") throw new Error("Monthly subscriptions are delivered across monthly schedules");
    return { deliverySpan: "monthly", deliveryStartMonth: input.deliveryStartMonth };
  }
  if (input.deliverySpan !== "monthly" && input.deliverySpan !== "once") throw new Error("Select whether the yearly order is delivered across 12 months or all at once");
  return { deliverySpan: input.deliverySpan, deliveryStartMonth: input.deliveryStartMonth };
}

function merchantVpa() {
  const value = process.env.MERCHANT_VPA?.trim();
  if (!value) throw new Error("MERCHANT_VPA is not configured in the deployment environment");
  return value;
}

function expiresAt(order: { createdAt: Date }) {
  return order.createdAt.getTime() + CHECKOUT_TTL_MS;
}

function upiLink(input: { vpa: string; amount: number; orderId: string }) {
  const params = new URLSearchParams({
    pa: input.vpa,
    pn: process.env.MERCHANT_NAME?.trim() || "91DAB",
    am: input.amount.toFixed(2),
    cu: "INR",
    tn: `91DAB Order ${input.orderId}`,
    tr: input.orderId,
  });
  return `upi://pay?${params.toString()}`;
}

async function resolveOrderStatus(orderId: string) {
  const order = await db.getMerchantOrder(orderId);
  if (!order) return undefined;
  const expiry = expiresAt(order);
  if (order.paymentStatus === "pending" && expiry <= Date.now()) {
    return db.expireMerchantOrder(orderId);
  }
  return order;
}

export function registerCheckoutRoutes(app: Express) {
  app.post("/api/clinic-quote", async (req: Request, res: Response) => {
    try {
      const input = clinicQuoteInput.parse(req.body);
      await db.saveMerchantClinicQuoteLead({
        clientEmail: input.email.toLowerCase(),
        clientPhone: input.phone?.trim() || null,
        note: "Clinic / bulk order quote requested for 5,000+ pieces.",
      });
      return res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Clinic quote details are incomplete or invalid" });
      return res.status(500).json({ error: "Could not record the clinic quote" });
    }
  });

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const input = createOrderInput.parse(req.body);
      const plan = plans[input.planKey];
      const amount = plan.price * input.qty;
      const vpa = merchantVpa();
      const orderId = `91DAB-${nanoid(12).toUpperCase()}`;
      const schedule = subscriptionScheduleForCheckout(input);
      const order = await db.createMerchantCheckoutOrder({
        orderId,
        buyerName: input.orderInfo.name,
        buyerEmail: input.orderInfo.email.toLowerCase(),
        phone: input.orderInfo.phone,
        address: input.orderInfo.address,
        city: input.orderInfo.city,
        state: input.orderInfo.state,
        pincode: input.orderInfo.pincode,
        planKey: input.planKey,
        planName: plan.name,
        quantity: input.qty,
        amount,
        paymentMethod: "UPI",
        deliverySpan: schedule.deliverySpan,
        deliveryStartMonth: schedule.deliveryStartMonth,
        createdAt: new Date(),
      });
      if (!order) throw new Error("Checkout record could not be created");
      const intent = upiLink({ vpa, amount, orderId });
      const qrDataUrl = await QRCode.toDataURL(intent, { margin: 1, width: 320, color: { dark: "#0F2325", light: "#FFFFFF" } });
      return res.json({ orderId, amount, upiLink: intent, qrDataUrl, expiresAt: expiresAt(order) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Checkout details are incomplete or invalid" });
      if (error instanceof Error && error.message.includes("delivery")) return res.status(400).json({ error: error.message });
      if (error instanceof Error && error.message === "MERCHANT_VPA is not configured in the deployment environment") {
        return res.status(503).json({ error: "Merchant payment configuration is incomplete. Please contact 91DAB before trying again." });
      }
      return res.status(500).json({ error: error instanceof Error ? error.message : "Could not create checkout order" });
    }
  });

  app.get("/api/orders/:orderId/status", async (req: Request, res: Response) => {
    try {
      const order = await resolveOrderStatus(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      return res.json({ status: order.paymentStatus, expiresAt: expiresAt(order) });
    } catch {
      return res.status(500).json({ error: "Could not load order status" });
    }
  });

  app.post("/api/orders/:orderId/utr", async (req: Request, res: Response) => {
    try {
      const { utr } = utrInput.parse(req.body);
      const order = await resolveOrderStatus(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.paymentStatus === "expired") return res.status(410).json({ error: "This payment request has expired" });
      if (order.paymentStatus === "paid") return res.status(409).json({ error: "This payment has already been confirmed" });
      if (order.paymentStatus === "utr_submitted") return res.json({ ok: true, status: "utr_submitted" });
      const updated = await db.submitMerchantOrderUtr(order.orderId, utr);
      if (!updated || updated.paymentStatus !== "utr_submitted") return res.status(409).json({ error: "The payment reference could not be recorded" });
      return res.json({ ok: true, status: updated.paymentStatus });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Enter a valid UPI reference" });
      return res.status(500).json({ error: "Could not save reference number" });
    }
  });
}
