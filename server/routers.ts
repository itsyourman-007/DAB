import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_MS,
  createAdminSession,
  createEmployeeSession,
  getDashboardSession,
  isDashboardSession,
  isAdminSession,
  passwordMatchesAdminPassword,
} from "./adminAuth";
import { OTP_MAX_ATTEMPTS, createOtp, hashPassword, otpMatches, passwordHashMatches } from "./adminSecurity";
import { adminOtpRecipient, maskEmail, sendAdminPasswordOtp, sendAdminSupportMessage, sendBuyerFulfillmentConfirmation } from "./adminOtpMail";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

type SubscriptionEmailOrder = {
  planKey: string;
  deliverySpan: string | null;
  deliveryStartMonth: string | null;
  quantity: number;
};

function formatDeliveryMonth(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function subscriptionEmailDetails(order: SubscriptionEmailOrder, periodKey?: string) {
  if (order.planKey !== "monthly" && order.planKey !== "yearly") return {};
  const selectedSchedule = db.subscriptionScheduleMonths(order);
  if (order.planKey === "monthly") {
    const selectedMonths = selectedSchedule?.slice(0, Math.max(1, Number(order.quantity || 1))) ?? (order.deliveryStartMonth ? [order.deliveryStartMonth] : []);
    return {
      deliverySchedule: selectedMonths.length ? `Selected delivery month${selectedMonths.length === 1 ? "" : "s"}: ${selectedMonths.map(formatDeliveryMonth).join(", ")}` : "Buyer-selected monthly delivery schedule",
      dabAllocation: "100 DAB pieces per selected month",
    };
  }
  if (order.deliverySpan === "once") {
    return {
      deliverySchedule: order.deliveryStartMonth ? `One yearly delivery in ${formatDeliveryMonth(order.deliveryStartMonth)}` : "One yearly delivery in the buyer-selected month",
      dabAllocation: "1,500 DAB pieces together",
    };
  }
  const selectedMonths = selectedSchedule ?? (order.deliveryStartMonth ? [order.deliveryStartMonth] : []);
  const shipmentNumber = periodKey ? selectedMonths.indexOf(periodKey) + 1 : 0;
  return {
    deliverySchedule: periodKey && shipmentNumber > 0
      ? `Selected delivery month: ${formatDeliveryMonth(periodKey)} (${shipmentNumber} of 12)`
      : `Selected delivery months: ${selectedMonths.map(formatDeliveryMonth).join(", ")}`,
    dabAllocation: "125 DAB pieces each month (1,500 total)",
    deliveryProgress: shipmentNumber > 0 ? `${shipmentNumber * 125}/1,500 DAB pieces` : "0/1,500 DAB pieces across 12 monthly deliveries",
  };
}

async function deliverBuyerFulfillmentEmail(order: {
  orderId: string;
  buyerName: string;
  buyerEmail: string | null;
  planName: string;
  amount: number;
  quantity: number;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  planKey: string;
  deliverySpan: string | null;
  deliveryStartMonth: string | null;
}, status: "shipped" | "delivered", periodKey?: string) {
  if (!order.buyerEmail) return "not-requested" as const;
  const recipient = order.buyerEmail.trim().toLowerCase();
  const reserved = await db.reserveFulfillmentNotificationEmail({ orderId: order.orderId, status, recipient, notificationSuffix: periodKey });
  if (!reserved) return "already-sent" as const;
  const subscriptionDetails = subscriptionEmailDetails(order, periodKey);
  try {
    await sendBuyerFulfillmentConfirmation({
      email: recipient,
      name: order.buyerName,
      orderId: order.orderId,
      plan: order.planName,
      amount: order.amount,
      quantity: order.quantity,
      status,
      deliverySchedule: subscriptionDetails.deliverySchedule,
      dabAllocation: subscriptionDetails.dabAllocation,
      deliveryProgress: subscriptionDetails.deliveryProgress,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    });
    await db.markFulfillmentNotificationEmailSent({ orderId: order.orderId, status, notificationSuffix: periodKey });
    return "sent" as const;
  } catch {
    await db.releaseFulfillmentNotificationEmail({ orderId: order.orderId, status, notificationSuffix: periodKey });
    console.error("[Fulfillment email] Buyer notification failed", { orderId: order.orderId, status });
    return "failed" as const;
  }
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  admin: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const session = await getDashboardSession(ctx.req.headers.cookie);
      return { authenticated: Boolean(session), role: session?.role ?? null, email: session?.email ?? null };
    }),
    listTeamMembers: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.listMerchantTeamMembers();
    }),
    listTeams: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.listMerchantTeams();
    }),
    createTeam: publicProcedure
      .input(z.object({ name: z.string().trim().min(2).max(100), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        try { await db.createMerchantTeam(input.name); }
        catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "A team with this name already exists" });
          throw error;
        }
        return db.listMerchantTeams();
      }),
    updateTeam: publicProcedure
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(100), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        try {
          const team = await db.updateMerchantTeam({ id: input.id, name: input.name });
          if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team was not found" });
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "A team with this name already exists" });
          throw error;
        }
        return { teams: await db.listMerchantTeams(), members: await db.listMerchantTeamMembers() };
      }),
    removeTeam: publicProcedure
      .input(z.object({ id: z.number().int().positive(), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        try { await db.deleteMerchantTeam(input.id); }
        catch (error: any) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Team could not be deleted" }); }
        return db.listMerchantTeams();
      }),
    profile: publicProcedure.query(async ({ ctx }) => {
      const session = await getDashboardSession(ctx.req.headers.cookie);
      if (!session) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      if (session.role === "employee") return { displayName: "Authorized employee", email: session.email ?? "" };
      return (await db.getMerchantDashboardProfile()) ?? {
        displayName: "91DAB Administrator",
        email: adminOtpRecipient(),
      };
    }),
    updateProfile: publicProcedure
      .input(z.object({
        displayName: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        return db.saveMerchantDashboardProfile({ displayName: input.displayName, email: input.email.toLowerCase() });
      }),
    createTeamMember: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
        teamId: z.number().int().positive(),
        salaryInr: z.number().int().min(0).max(10_000_000).nullable(),
        password: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        if (!(await passwordMatchesAdminPassword(input.password))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        }
        const team = (await db.listMerchantTeams()).find((item) => item.id === input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Select an existing team before adding a member" });
        try {
          await db.createMerchantTeamMember({
            name: input.name,
            email: input.email.toLowerCase(),
            department: team.name,
            teamId: team.id,
            salaryInr: input.salaryInr,
          });
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "A team member with this email already exists" });
          }
          throw error;
        }
        return db.listMerchantTeamMembers();
      }),
    updateTeamMember: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
        teamId: z.number().int().positive(),
        salaryInr: z.number().int().min(0).max(10_000_000).nullable(),
        password: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        if (!(await passwordMatchesAdminPassword(input.password))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        }
        const team = (await db.listMerchantTeams()).find((item) => item.id === input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Select an existing team before saving this member" });
        try {
          await db.updateMerchantTeamMember({ ...input, email: input.email.toLowerCase(), department: team.name, teamId: team.id });
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "A team member with this email already exists" });
          }
          throw error;
        }
        return db.listMerchantTeamMembers();
      }),
    removeTeamMember: publicProcedure
      .input(z.object({ id: z.number().int().positive(), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        if (!(await passwordMatchesAdminPassword(input.password))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        }
        await db.removeMerchantTeamMember(input.id);
        return db.listMerchantTeamMembers();
      }),
    submitSupportRequest: publicProcedure
      .input(z.object({ subject: z.string().trim().min(3).max(160), message: z.string().trim().min(10).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        try {
          await sendAdminSupportMessage(input);
          return { sent: true, recipient: maskEmail(adminOtpRecipient()) } as const;
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Support delivery was rejected. Verify the configured Resend sender domain." });
        }
      }),
    listOrders: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.listMerchantOrders();
    }),
    inventory: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.getMerchantInventory();
    }),
    setInventory: publicProcedure
      .input(z.object({ availableUnits: z.number().int().min(0).max(10_000_000), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        return db.setMerchantInventoryUnits(input.availableUnits);
      }),
    increaseInventory: publicProcedure
      .input(z.object({ units: z.number().int().min(1).max(10_000_000), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        return db.increaseMerchantInventoryUnits(input.units);
      }),
    inventoryAllocations: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      return db.listMerchantInventoryShipmentAllocations();
    }),
    subscriptionDeliveries: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.listSubscriptionDeliveryRecords();
    }),
    quoteClientCustomizations: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.listMerchantQuoteClientCustomizations();
    }),
    quoteClientLeads: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.listMerchantClinicQuoteLeads();
    }),
    createQuoteClientCustomization: publicProcedure
      .input(z.object({
        clientName: z.string().trim().min(2).max(160),
        clientEmail: z.string().trim().email().max(320).nullable(),
        clientPhone: z.string().trim().min(6).max(64).nullable(),
        unitsPurchased: z.number().int().min(1).max(10_000_000),
        revenueInr: z.number().int().min(0).max(1_000_000_000),
        notes: z.string().trim().max(1000).nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        await db.createMerchantQuoteClientCustomization({
          ...input,
          clientEmail: input.clientEmail?.toLowerCase() ?? null,
        });
        return db.listMerchantQuoteClientCustomizations();
      }),
    updateQuoteClientCustomization: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        clientName: z.string().trim().min(2).max(160),
        clientEmail: z.string().trim().email().max(320).nullable(),
        clientPhone: z.string().trim().min(6).max(64).nullable(),
        unitsPurchased: z.number().int().min(1).max(10_000_000),
        revenueInr: z.number().int().min(0).max(1_000_000_000),
        notes: z.string().trim().max(1000).nullable(),
        password: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        try {
          await db.updateMerchantQuoteClientCustomization({ ...input, clientEmail: input.clientEmail?.toLowerCase() ?? null });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Custom client sale could not be updated" });
        }
        return db.listMerchantQuoteClientCustomizations();
      }),
    deleteQuoteClientCustomization: publicProcedure
      .input(z.object({ id: z.number().int().positive(), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        try {
          await db.deleteMerchantQuoteClientCustomization(input.id);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Custom client sale could not be deleted" });
        }
        return db.listMerchantQuoteClientCustomizations();
      }),
    updateQuoteClientCustomizationFulfillment: publicProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["shipped", "delivered"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        try {
          const customization = await db.updateMerchantQuoteClientCustomizationFulfillment(input);
          return { customization, customizations: await db.listMerchantQuoteClientCustomizations(), inventory: await db.getMerchantInventory() };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Custom client fulfillment could not be updated" });
        }
      }),
    setSubscriptionDelivery: publicProcedure
      .input(z.object({ orderId: z.string().trim().min(4).max(128), periodKey: z.string().regex(/^\d{4}-\d{2}$/), delivered: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isDashboardSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
        const order = await db.getMerchantOrder(input.orderId);
        if (!order || order.paymentStatus !== "paid" || (order.planKey !== "monthly" && order.planKey !== "yearly")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only paid monthly or yearly subscriptions can be marked delivered" });
        }
        if (!input.delivered) throw new TRPCError({ code: "BAD_REQUEST", message: "A recorded shipment cannot be unchecked. Use a password-confirmed stock adjustment to correct inventory." });
        const shipment = await db.recordSubscriptionShipment(input);
        const email = await deliverBuyerFulfillmentEmail(order, "shipped", input.periodKey);
        return { deliveries: await db.listSubscriptionDeliveryRecords(), inventory: shipment.inventory, shipment, email };
      }),
    markOrderPaid: publicProcedure
      .input(z.object({ orderId: z.string().trim().min(4).max(128) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        const orders = await db.listMerchantOrders();
        const existing = orders.find((order) => order.orderId === input.orderId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "No qualifying 91DAB checkout record was found" });
        if (existing.paymentStatus === "expired") throw new TRPCError({ code: "BAD_REQUEST", message: "Expired checkout records cannot be marked paid" });
        if (existing.paymentStatus !== "utr_submitted" && existing.paymentStatus !== "paid") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A submitted UPI reference is required before payment can be marked paid" });
        }
        const order = existing.paymentStatus === "paid" ? existing : await db.markMerchantOrderPaid(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "The order was not found after verification" });
        const inventory = await db.getMerchantInventory();
        if (!order.buyerEmail) return { order, email: "not-requested" as const, inventory, inventoryResult: "awaiting-shipment" as const };
        const reserved = await db.reservePaymentConfirmationEmail({ orderId: order.orderId, recipient: order.buyerEmail.toLowerCase() });
        if (!reserved) return { order, email: "already-sent" as const };
        try {
          const { sendBuyerPaymentConfirmation } = await import("./adminOtpMail");
          const subscriptionDetails = subscriptionEmailDetails(order);
          await sendBuyerPaymentConfirmation({
            email: order.buyerEmail,
            name: order.buyerName,
            orderId: order.orderId,
            plan: order.planName,
            amount: order.amount,
            paymentMethod: order.paymentMethod,
            utr: order.utr ?? undefined,
            deliverySchedule: subscriptionDetails.deliverySchedule ?? null,
            dabAllocation: subscriptionDetails.dabAllocation ?? null,
            deliveryProgress: subscriptionDetails.deliveryProgress ?? null,
            quantity: order.quantity,
            orderDate: order.createdAt.toISOString(),
            address: order.address,
            city: order.city,
            state: order.state,
            pincode: order.pincode,
            phone: order.phone,
          });
          await db.markPaymentConfirmationEmailSent(order.orderId);
          return { order, email: "sent" as const, inventory, inventoryResult: "awaiting-shipment" as const };
        } catch {
          await db.releasePaymentConfirmationEmail(order.orderId);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment was marked paid, but the buyer confirmation email could not be sent" });
        }
      }),
    subscriptionReminderStatus: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.getSubscriptionReminderSettings();
    }),
    activateSubscriptionReminders: publicProcedure.mutation(async ({ ctx }) => {
      if (!(await isAdminSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
      }
      if (process.env.NODE_ENV !== "production") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Publish the website before activating its automatic monthly email reminders" });
      }
      const existing = await db.getSubscriptionReminderSettings();
      let taskUid = existing.scheduleCronTaskUid;
      let nextExecutionAt: string | null | undefined;
      if (taskUid) {
        ({ nextExecutionAt } = await updateHeartbeatJob(taskUid, { enable: true }, ""));
      } else {
        const job = await createHeartbeatJob({
          name: "91dab-monthly-subscription-summary",
          cron: "0 30 3 1 * *",
          path: "/api/scheduled/monthly-subscription-summary",
          description: "Send the 91DAB verified monthly-subscription summary on the first day of each month at 09:00 India time.",
        }, "");
        taskUid = job.taskUid;
        nextExecutionAt = job.nextExecutionAt;
      }
      const settings = await db.saveSubscriptionReminderSettings({ enabled: true, scheduleCronTaskUid: taskUid });
      return { ...settings, nextExecutionAt };
    }),
    demoOrderCleanupStatus: publicProcedure.query(async ({ ctx }) => {
      if (!(await isDashboardSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
      }
      return db.getDemoOrderCleanupSettings();
    }),
    activateDemoOrderCleanup: publicProcedure.mutation(async ({ ctx }) => {
      if (!(await isAdminSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
      }
      if (process.env.NODE_ENV !== "production") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Publish the website before activating automatic demo-order cleanup" });
      }
      const existing = await db.getDemoOrderCleanupSettings();
      let taskUid = existing.scheduleCronTaskUid;
      let nextExecutionAt: string | null | undefined;
      if (taskUid) {
        ({ nextExecutionAt } = await updateHeartbeatJob(taskUid, { enable: true }, ""));
      } else {
        const job = await createHeartbeatJob({
          name: "91dab-demo-order-cleanup",
          cron: "0 0 * * * *",
          path: "/api/scheduled/demo-order-cleanup",
          description: "Delete only 91DAB shop orders whose buyer name explicitly contains the standalone word demo after they are at least 24 hours old.",
        }, "");
        taskUid = job.taskUid;
        nextExecutionAt = job.nextExecutionAt;
      }
      const settings = await db.saveDemoOrderCleanupSettings({ enabled: true, scheduleCronTaskUid: taskUid });
      return { ...settings, nextExecutionAt };
    }),
    listEmployeeAccounts: publicProcedure.query(async ({ ctx }) => {
      if (!(await isAdminSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
      }
      return db.listMerchantEmployeeAccounts();
    }),
    loginAudits: publicProcedure.query(async ({ ctx }) => {
      if (!(await isAdminSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
      }
      return db.listMerchantDashboardLoginAudits();
    }),
    createEmployeeAccount: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320),
        employeePassword: z.string().min(12).max(256),
        adminPassword: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.adminPassword))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        const email = input.email.toLowerCase();
        if (email === "dantaresearch@gmail.com") throw new TRPCError({ code: "BAD_REQUEST", message: "The administrator email cannot be added as an employee account" });
        try {
          await db.createMerchantEmployeeAccount({ name: input.name, email, passwordHash: hashPassword(input.employeePassword) });
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "An employee account with this email already exists" });
          throw error;
        }
        return db.listMerchantEmployeeAccounts();
      }),
    resetEmployeePassword: publicProcedure
      .input(z.object({ id: z.number().int().positive(), employeePassword: z.string().min(12).max(256), adminPassword: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.adminPassword))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        await db.resetMerchantEmployeePassword({ id: input.id, passwordHash: hashPassword(input.employeePassword) });
        return db.listMerchantEmployeeAccounts();
      }),
    removeEmployeeAccount: publicProcedure
      .input(z.object({ id: z.number().int().positive(), adminPassword: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        if (!(await passwordMatchesAdminPassword(input.adminPassword))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        await db.removeMerchantEmployeeAccount(input.id);
        return db.listMerchantEmployeeAccounts();
      }),
    updateFulfillment: publicProcedure
      .input(z.object({ orderId: z.string().trim().min(4).max(128), status: z.enum(["shipped", "delivered"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isDashboardSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
        try {
          const order = await db.updateMerchantOrderFulfillment(input);
          if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order was not found" });
          return { order, email: await deliverBuyerFulfillmentEmail(order, input.status), inventory: await db.getMerchantInventory() };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Shipment status could not be updated" });
        }
      }),
    resendFulfillmentEmail: publicProcedure
      .input(z.object({ orderId: z.string().trim().min(4).max(128), status: z.enum(["shipped", "delivered"]) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isDashboardSession(ctx.req.headers.cookie))) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard access is required" });
        const order = await db.getMerchantOrder(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order was not found" });
        if (order.paymentStatus !== "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Only paid orders can receive delivery notifications" });
        if (input.status === "shipped" && order.fulfillmentStatus === "not_shipped") throw new TRPCError({ code: "BAD_REQUEST", message: "Mark the order shipped before sending a shipment notification" });
        if (input.status === "delivered" && order.fulfillmentStatus !== "delivered") throw new TRPCError({ code: "BAD_REQUEST", message: "Mark the order delivered before sending a delivery notification" });
        return { order, email: await deliverBuyerFulfillmentEmail(order, input.status) };
      }),
    login: publicProcedure
      .input(z.object({ username: z.string().trim().email().max(320), password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        const email = input.username.toLowerCase();
        let token: string;
        let role: "admin" | "employee";
        if (email === "dantaresearch@gmail.com") {
          if (!(await passwordMatchesAdminPassword(input.password))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
          token = await createAdminSession();
          role = "admin";
        } else {
          const employee = await db.getActiveMerchantEmployeeAccountByEmail(email);
          if (!employee || !passwordHashMatches(input.password, employee.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
          token = await createEmployeeSession({ employeeId: employee.id, email: employee.email });
          role = "employee";
        }
        ctx.res.cookie(ADMIN_SESSION_COOKIE, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: ADMIN_SESSION_MAX_AGE_MS,
        });
        await db.recordMerchantDashboardLogin({ email, role });
        return { authenticated: true, role, email } as const;
      }),
    verifySecuritySettingsPassword: publicProcedure
      .input(z.object({ password: z.string().min(1).max(256) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        if (!(await passwordMatchesAdminPassword(input.password))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator password was not accepted" });
        }
        return { verified: true } as const;
      }),
    requestPasswordChange: publicProcedure.mutation(async ({ ctx }) => {
      if (!(await isAdminSession(ctx.req.headers.cookie))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
      }
      const otp = createOtp();
      const recipient = adminOtpRecipient();
      await db.storeAdminOtp({ otpHash: otp.hash, recipient, expiresAt: otp.expiresAt });
      await sendAdminPasswordOtp(otp.code);
      return { recipient: maskEmail(recipient), expiresInMinutes: 10 } as const;
    }),
    confirmPasswordChange: publicProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(12).max(256),
        otp: z.string().regex(/^\d{6}$/),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        if (!(await passwordMatchesAdminPassword(input.currentPassword))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password was not accepted" });
        }
        if (await passwordMatchesAdminPassword(input.newPassword)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a new password that differs from the current password" });
        }
        const security = await db.getAdminSecurity();
        const recipient = adminOtpRecipient();
        const expired = !security?.otpExpiresAt || security.otpExpiresAt.getTime() <= Date.now();
        const recipientMismatch = security?.otpRecipient?.toLowerCase() !== recipient;
        if (!security?.otpHash || expired || recipientMismatch) {
          await db.clearAdminOtp();
          throw new TRPCError({ code: "BAD_REQUEST", message: "Request a new OTP before changing the password" });
        }
        if ((security.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
          await db.clearAdminOtp();
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many OTP attempts. Request a new code." });
        }
        if (!otpMatches(input.otp, security.otpHash)) {
          const attempts = (security.otpAttempts || 0) + 1;
          if (attempts >= OTP_MAX_ATTEMPTS) await db.clearAdminOtp();
          else await db.recordAdminOtpAttempt(attempts);
          throw new TRPCError({ code: "BAD_REQUEST", message: "OTP was not accepted" });
        }
        await db.storeAdminPasswordHash(hashPassword(input.newPassword));
        return { changed: true } as const;
      }),
    sendPaymentConfirmation: publicProcedure
      .input(z.object({
        orderId: z.string().min(1).max(128),
        buyerName: z.string().min(1).max(160),
        buyerEmail: z.string().email().max(320),
        plan: z.string().min(1).max(160),
        amount: z.number().positive().finite(),
        paymentMethod: z.string().min(1).max(64),
        utr: z.string().max(128).optional(),
        deliverySchedule: z.string().max(200).nullable().optional(),
        quantity: z.number().int().positive().nullable().optional(),
        orderDate: z.string().max(80).nullable().optional(),
        address: z.string().max(500).nullable().optional(),
        city: z.string().max(100).nullable().optional(),
        state: z.string().max(100).nullable().optional(),
        pincode: z.string().max(32).nullable().optional(),
        phone: z.string().max(64).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!(await isAdminSession(ctx.req.headers.cookie))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required" });
        }
        const recipient = input.buyerEmail.trim().toLowerCase();
        const reserved = await db.reservePaymentConfirmationEmail({ orderId: input.orderId, recipient });
        if (!reserved) return { sent: false, duplicate: true } as const;
        try {
          const { sendBuyerPaymentConfirmation } = await import("./adminOtpMail");
          await sendBuyerPaymentConfirmation({
            email: recipient,
            name: input.buyerName,
            orderId: input.orderId,
            plan: input.plan,
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            utr: input.utr,
            deliverySchedule: input.deliverySchedule,
            quantity: input.quantity,
            orderDate: input.orderDate,
            address: input.address,
            city: input.city,
            state: input.state,
            pincode: input.pincode,
            phone: input.phone,
          });
          await db.markPaymentConfirmationEmailSent(input.orderId);
          return { sent: true, duplicate: false } as const;
        } catch (error) {
          await db.releasePaymentConfirmationEmail(input.orderId);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment was verified, but the confirmation email could not be sent" });
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
