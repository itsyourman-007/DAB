import type { Request, Response } from "express";
import { sendMonthlySubscriptionSummary } from "./adminOtpMail";
import * as db from "./db";
import { sdk } from "./_core/sdk";

function utcPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function sendScheduledMonthlySubscriptionSummary(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const settings = await db.getSubscriptionReminderSettings();
    if (!settings.enabled || !settings.scheduleCronTaskUid) return res.json({ ok: true, skipped: "disabled" });
    if (settings.scheduleCronTaskUid !== user.taskUid) return res.json({ ok: true, skipped: "unknown-task" });

    const periodKey = utcPeriodKey();
    const reserved = await db.reserveSubscriptionReminderDispatch(periodKey);
    if (!reserved) return res.json({ ok: true, skipped: "already-sent", periodKey });

    try {
      const subscriptions = (await db.listMerchantOrders())
        .filter((order) => {
          if (order.planKey !== "monthly" || order.paymentStatus !== "paid") return false;
          const schedule = db.subscriptionScheduleMonths(order);
          return schedule === null || schedule.includes(periodKey);
        })
        .map((order) => ({
          orderId: order.orderId,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          amount: order.amount,
          quantity: order.quantity,
          createdAt: order.createdAt,
        }));
      const recipient = await sendMonthlySubscriptionSummary({ periodKey, subscriptions });
      return res.json({ ok: true, periodKey, subscriptions: subscriptions.length, recipient });
    } catch (error) {
      await db.releaseSubscriptionReminderDispatch(periodKey);
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { path: req.path },
    });
  }
}
