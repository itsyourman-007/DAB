import type { Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

/** Heartbeat-only callback. It safely deletes only orders explicitly labelled “demo” and older than 24 hours. */
export async function cleanupScheduledDemoOrders(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const settings = await db.getDemoOrderCleanupSettings();
    if (!settings.enabled || !settings.scheduleCronTaskUid) return res.json({ ok: true, skipped: "disabled" });
    if (settings.scheduleCronTaskUid !== user.taskUid) return res.json({ ok: true, skipped: "unknown-task" });

    const result = await db.deleteExpiredDemoOrders();
    return res.json({ ok: true, deleted: result.deletedOrderIds.length, deletedOrderIds: result.deletedOrderIds });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context: { path: req.path },
    });
  }
}
