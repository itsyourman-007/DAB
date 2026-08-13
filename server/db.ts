import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  AdminSecurity,
  InsertUser,
  MerchantDashboardProfile,
  MerchantDashboardLoginAudit,
  MerchantEmployeeAccount,
  MerchantInventory,
  MerchantOrder,
  MerchantTeam,
  MerchantTeamMember,
  adminSecurity,
  demoOrderCleanupSettings,
  merchantDashboardProfiles,
  merchantDashboardLoginAudits,
  merchantEmployeeAccounts,
  merchantInventory,
  merchantOrders,
  merchantTeamMembers,
  merchantTeams,
  paymentConfirmationEmails,
  fulfillmentNotificationEmails,
  subscriptionReminderDispatches,
  subscriptionDeliveryRecords,
  subscriptionReminderSettings,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAdminSecurity(): Promise<AdminSecurity | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(adminSecurity).where(eq(adminSecurity.id, 1)).limit(1);
  return result[0];
}

export async function storeAdminOtp(input: { otpHash: string; recipient: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for password-change OTPs");
  await db.insert(adminSecurity).values({
    id: 1,
    otpHash: input.otpHash,
    otpRecipient: input.recipient,
    otpExpiresAt: input.expiresAt,
    otpAttempts: 0,
  }).onDuplicateKeyUpdate({
    set: {
      otpHash: input.otpHash,
      otpRecipient: input.recipient,
      otpExpiresAt: input.expiresAt,
      otpAttempts: 0,
    },
  });
}

export async function recordAdminOtpAttempt(attempts: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for password-change OTPs");
  await db.update(adminSecurity).set({ otpAttempts: attempts }).where(eq(adminSecurity.id, 1));
}

export async function clearAdminOtp() {
  const db = await getDb();
  if (!db) throw new Error("Database is required for password-change OTPs");
  await db.update(adminSecurity).set({ otpHash: null, otpRecipient: null, otpExpiresAt: null, otpAttempts: 0 }).where(eq(adminSecurity.id, 1));
}

export async function storeAdminPasswordHash(passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for dashboard password changes");
  await db.insert(adminSecurity).values({ id: 1, passwordHash, otpAttempts: 0 }).onDuplicateKeyUpdate({
    set: { passwordHash, otpHash: null, otpRecipient: null, otpExpiresAt: null, otpAttempts: 0 },
  });
}

export async function reservePaymentConfirmationEmail(input: { orderId: string; recipient: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for payment confirmation email delivery");
  try {
    await db.insert(paymentConfirmationEmails).values({ orderId: input.orderId, recipient: input.recipient, status: "reserved" });
    return true;
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function markPaymentConfirmationEmailSent(orderId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for payment confirmation email delivery");
  await db.update(paymentConfirmationEmails).set({ status: "sent", sentAt: new Date() }).where(eq(paymentConfirmationEmails.orderId, orderId));
}

export async function releasePaymentConfirmationEmail(orderId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for payment confirmation email delivery");
  await db.delete(paymentConfirmationEmails).where(eq(paymentConfirmationEmails.orderId, orderId));
}

export async function reserveFulfillmentNotificationEmail(input: { orderId: string; status: "shipped" | "delivered"; recipient: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for fulfillment email delivery");
  const notificationKey = `${input.orderId}:${input.status}`;
  try {
    await db.insert(fulfillmentNotificationEmails).values({
      notificationKey,
      orderId: input.orderId,
      status: input.status,
      recipient: input.recipient,
      deliveryStatus: "reserved",
    });
    return true;
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function markFulfillmentNotificationEmailSent(input: { orderId: string; status: "shipped" | "delivered" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for fulfillment email delivery");
  await db.update(fulfillmentNotificationEmails).set({ deliveryStatus: "sent", sentAt: new Date() }).where(eq(fulfillmentNotificationEmails.notificationKey, `${input.orderId}:${input.status}`));
}

export async function releaseFulfillmentNotificationEmail(input: { orderId: string; status: "shipped" | "delivered" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for fulfillment email delivery");
  await db.delete(fulfillmentNotificationEmails).where(eq(fulfillmentNotificationEmails.notificationKey, `${input.orderId}:${input.status}`));
}

export async function listMerchantTeamMembers(): Promise<MerchantTeamMember[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  return db.select().from(merchantTeamMembers).orderBy(desc(merchantTeamMembers.createdAt));
}

export async function listMerchantTeams(): Promise<MerchantTeam[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  return db.select().from(merchantTeams).orderBy(merchantTeams.name);
}

export async function createMerchantTeam(name: string): Promise<MerchantTeam | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  await db.insert(merchantTeams).values({ name });
  const result = await db.select().from(merchantTeams).where(eq(merchantTeams.name, name)).limit(1);
  return result[0];
}

export async function updateMerchantTeam(input: { id: number; name: string }): Promise<MerchantTeam | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  const current = (await db.select().from(merchantTeams).where(eq(merchantTeams.id, input.id)).limit(1))[0];
  if (!current) return undefined;
  await db.update(merchantTeams).set({ name: input.name }).where(eq(merchantTeams.id, input.id));
  await db.update(merchantTeamMembers).set({ department: input.name }).where(eq(merchantTeamMembers.teamId, input.id));
  const result = await db.select().from(merchantTeams).where(eq(merchantTeams.id, input.id)).limit(1);
  return result[0];
}

export async function deleteMerchantTeam(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  const members = await db.select().from(merchantTeamMembers).where(eq(merchantTeamMembers.teamId, id)).limit(1);
  if (members.length) throw new Error("Remove or move this team’s members before deleting the team");
  await db.delete(merchantTeams).where(eq(merchantTeams.id, id));
}

export async function createMerchantTeamMember(input: { name: string; email: string; department: string; teamId: number; salaryInr: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  await db.insert(merchantTeamMembers).values(input);
  const result = await db.select().from(merchantTeamMembers).where(eq(merchantTeamMembers.email, input.email)).limit(1);
  return result[0];
}

export async function removeMerchantTeamMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  await db.delete(merchantTeamMembers).where(eq(merchantTeamMembers.id, id));
}

export async function updateMerchantTeamMember(input: { id: number; name: string; email: string; department: string; teamId: number; salaryInr: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant team management");
  await db.update(merchantTeamMembers).set({
    name: input.name,
    email: input.email,
    department: input.department,
    teamId: input.teamId,
    salaryInr: input.salaryInr,
  }).where(eq(merchantTeamMembers.id, input.id));
  const result = await db.select().from(merchantTeamMembers).where(eq(merchantTeamMembers.id, input.id)).limit(1);
  return result[0];
}

export async function getMerchantDashboardProfile(): Promise<MerchantDashboardProfile | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for dashboard profile settings");
  const result = await db.select().from(merchantDashboardProfiles).where(eq(merchantDashboardProfiles.id, 1)).limit(1);
  return result[0];
}

export async function saveMerchantDashboardProfile(input: { displayName: string; email: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for dashboard profile settings");
  await db.insert(merchantDashboardProfiles).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: input });
  return getMerchantDashboardProfile();
}

export async function getActiveMerchantEmployeeAccountByEmail(email: string): Promise<MerchantEmployeeAccount | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for employee access");
  const result = await db.select().from(merchantEmployeeAccounts).where(and(
    eq(merchantEmployeeAccounts.email, email),
    eq(merchantEmployeeAccounts.active, true),
  )).limit(1);
  return result[0];
}

export async function getActiveMerchantEmployeeAccountById(id: number): Promise<MerchantEmployeeAccount | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for employee access");
  const result = await db.select().from(merchantEmployeeAccounts).where(and(
    eq(merchantEmployeeAccounts.id, id),
    eq(merchantEmployeeAccounts.active, true),
  )).limit(1);
  return result[0];
}

export async function listMerchantEmployeeAccounts() {
  const db = await getDb();
  if (!db) throw new Error("Database is required for employee access");
  const rows = await db.select().from(merchantEmployeeAccounts).orderBy(desc(merchantEmployeeAccounts.createdAt));
  return rows.map(({ passwordHash: _passwordHash, ...account }) => account);
}

export async function createMerchantEmployeeAccount(input: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for employee access");
  await db.insert(merchantEmployeeAccounts).values({ ...input, active: true });
  const result = await db.select().from(merchantEmployeeAccounts).where(eq(merchantEmployeeAccounts.email, input.email)).limit(1);
  return result[0];
}

export async function resetMerchantEmployeePassword(input: { id: number; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for employee access");
  await db.update(merchantEmployeeAccounts).set({ passwordHash: input.passwordHash }).where(eq(merchantEmployeeAccounts.id, input.id));
}

export async function removeMerchantEmployeeAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for employee access");
  await db.delete(merchantEmployeeAccounts).where(eq(merchantEmployeeAccounts.id, id));
}

export async function recordMerchantDashboardLogin(input: { email: string; role: "admin" | "employee" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for dashboard login auditing");
  await db.insert(merchantDashboardLoginAudits).values(input);
}

export async function listMerchantDashboardLoginAudits(): Promise<MerchantDashboardLoginAudit[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for dashboard login auditing");
  return db.select().from(merchantDashboardLoginAudits).orderBy(desc(merchantDashboardLoginAudits.signedInAt)).limit(100);
}

export type ShopPaymentSubmission = {
  orderId: string;
  buyerName: string;
  buyerEmail: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  planKey: string;
  planName: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
  utr: string;
  deliverySpan: string | null;
  createdAt: Date;
};

export type MerchantCheckoutOrderInput = Omit<ShopPaymentSubmission, "utr"> & { utr?: string | null };

export async function createMerchantCheckoutOrder(input: MerchantCheckoutOrderInput): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for checkout records");
  await db.insert(merchantOrders).values({
    ...input,
    utr: input.utr ?? null,
    paymentStatus: "pending",
    source: "91dab-shop",
  });
  const result = await db.select().from(merchantOrders).where(eq(merchantOrders.orderId, input.orderId)).limit(1);
  return result[0];
}

export async function getMerchantOrder(orderId: string): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for checkout records");
  const result = await db.select().from(merchantOrders).where(and(
    eq(merchantOrders.orderId, orderId),
    eq(merchantOrders.source, "91dab-shop"),
  )).limit(1);
  return result[0];
}

export async function submitMerchantOrderUtr(orderId: string, utr: string): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for checkout records");
  await db.update(merchantOrders).set({ utr, paymentStatus: "utr_submitted" }).where(and(
    eq(merchantOrders.orderId, orderId),
    eq(merchantOrders.source, "91dab-shop"),
    eq(merchantOrders.paymentStatus, "pending"),
  ));
  return getMerchantOrder(orderId);
}

export async function expireMerchantOrder(orderId: string): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for checkout records");
  await db.update(merchantOrders).set({ paymentStatus: "expired" }).where(and(
    eq(merchantOrders.orderId, orderId),
    eq(merchantOrders.source, "91dab-shop"),
    eq(merchantOrders.paymentStatus, "pending"),
  ));
  return getMerchantOrder(orderId);
}

export async function listMerchantOrders(): Promise<MerchantOrder[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant order records");
  return db.select().from(merchantOrders).where(eq(merchantOrders.source, "91dab-shop")).orderBy(desc(merchantOrders.createdAt));
}

const EXPLICIT_DEMO_ORDER_NAME = /\bdemo\b/i;

/** A real buyer is never considered a test unless their entered name contains the explicit standalone word “demo”. */
export function isExplicitDemoOrderName(name: string) {
  return EXPLICIT_DEMO_ORDER_NAME.test(name.trim());
}

/** Removes only explicitly marked demo orders that have passed the 24-hour retention period. */
export async function deleteExpiredDemoOrders(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for demo-order cleanup");
  const expiresBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const candidates = await db.select({ orderId: merchantOrders.orderId, buyerName: merchantOrders.buyerName })
    .from(merchantOrders)
    .where(and(eq(merchantOrders.source, "91dab-shop"), lt(merchantOrders.createdAt, expiresBefore)));
  const orderIds = candidates.filter((order) => isExplicitDemoOrderName(order.buyerName)).map((order) => order.orderId);
  if (orderIds.length) await db.delete(merchantOrders).where(inArray(merchantOrders.orderId, orderIds));
  return { deletedOrderIds: orderIds, expiresBefore };
}

export async function markMerchantOrderPaid(orderId: string): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant order records");
  await db.update(merchantOrders).set({ paymentStatus: "paid", verifiedAt: new Date() }).where(and(
    eq(merchantOrders.orderId, orderId),
    eq(merchantOrders.source, "91dab-shop"),
  ));
  const result = await db.select().from(merchantOrders).where(eq(merchantOrders.orderId, orderId)).limit(1);
  return result[0];
}

export async function updateMerchantOrderFulfillment(input: { orderId: string; status: "shipped" | "delivered" }): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for merchant order records");
  const existing = await getMerchantOrder(input.orderId);
  if (!existing) return undefined;
  if (existing.paymentStatus !== "paid") throw new Error("Only paid orders can be marked shipped or delivered");
  if (input.status === "delivered" && existing.fulfillmentStatus === "not_shipped") throw new Error("Mark the order shipped before marking it delivered");
  if (existing.fulfillmentStatus === "delivered") throw new Error("This order is already marked delivered");
  const now = new Date();
  await db.update(merchantOrders).set({
    fulfillmentStatus: input.status,
    shippedAt: input.status === "shipped" ? now : existing.shippedAt ?? now,
    deliveredAt: input.status === "delivered" ? now : existing.deliveredAt,
  }).where(eq(merchantOrders.orderId, input.orderId));
  return getMerchantOrder(input.orderId);
}

export async function getMerchantInventory(): Promise<MerchantInventory> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for inventory");
  const result = await db.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1);
  return result[0] ?? { id: 1, productKey: "dab", productName: "DAB", availableUnits: 0, configured: false, updatedAt: new Date() };
}

export async function setMerchantInventoryUnits(availableUnits: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for inventory");
  const values = { id: 1, productKey: "dab", productName: "DAB", availableUnits, configured: true };
  await db.insert(merchantInventory).values(values).onDuplicateKeyUpdate({ set: { availableUnits, configured: true } });
  return getMerchantInventory();
}

export async function decrementInventoryForPaidOrder(orderId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for inventory");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(merchantOrders).where(and(eq(merchantOrders.orderId, orderId), eq(merchantOrders.source, "91dab-shop"))).limit(1);
    const order = rows[0];
    if (!order || order.paymentStatus !== "paid") return { applied: false, reason: "not-paid" as const, inventory: await getMerchantInventory() };
    const inventoryRows = await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1);
    const inventory = inventoryRows[0] ?? { id: 1, productKey: "dab", productName: "DAB", availableUnits: 0, configured: false, updatedAt: new Date() };
    if (!inventory.configured) return { applied: false, reason: "not-configured" as const, inventory };
    if (order.inventoryDeductedAt) return { applied: false, reason: "already-deducted" as const, inventory };
    await tx.update(merchantOrders).set({ inventoryDeductedAt: new Date() }).where(and(
      eq(merchantOrders.id, order.id),
      isNull(merchantOrders.inventoryDeductedAt),
    ));
    const claimedOrder = (await tx.select().from(merchantOrders).where(eq(merchantOrders.id, order.id)).limit(1))[0];
    if (!claimedOrder?.inventoryDeductedAt) throw new Error("Inventory deduction marker could not be recorded");
    await tx.update(merchantInventory).set({
      availableUnits: sql`GREATEST(0, ${merchantInventory.availableUnits} - ${order.quantity})`,
    }).where(eq(merchantInventory.id, 1));
    const updated = await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1);
    return { applied: true, reason: "deducted" as const, inventory: updated[0] ?? inventory };
  });
}

export async function listSubscriptionDeliveryRecords() {
  const db = await getDb();
  if (!db) throw new Error("Database is required for subscription delivery tracking");
  return db.select().from(subscriptionDeliveryRecords).orderBy(desc(subscriptionDeliveryRecords.deliveredAt));
}

export async function setSubscriptionDelivery(input: { orderId: string; periodKey: string; delivered: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for subscription delivery tracking");
  const deliveryKey = `${input.orderId}:${input.periodKey}`;
  if (input.delivered) {
    try { await db.insert(subscriptionDeliveryRecords).values({ deliveryKey, orderId: input.orderId, periodKey: input.periodKey }); }
    catch (error: any) { if (error?.code !== "ER_DUP_ENTRY" && error?.cause?.code !== "ER_DUP_ENTRY") throw error; }
  } else {
    await db.delete(subscriptionDeliveryRecords).where(eq(subscriptionDeliveryRecords.deliveryKey, deliveryKey));
  }
  return listSubscriptionDeliveryRecords();
}

export async function getSubscriptionReminderSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database is required for subscription reminders");
  const result = await db.select().from(subscriptionReminderSettings).where(eq(subscriptionReminderSettings.id, 1)).limit(1);
  return result[0] ?? { id: 1, enabled: false, scheduleCronTaskUid: null, updatedAt: new Date() };
}

export async function saveSubscriptionReminderSettings(input: { enabled: boolean; scheduleCronTaskUid: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for subscription reminders");
  await db.insert(subscriptionReminderSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: input });
  return getSubscriptionReminderSettings();
}

export async function getDemoOrderCleanupSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database is required for demo-order cleanup");
  const result = await db.select().from(demoOrderCleanupSettings).where(eq(demoOrderCleanupSettings.id, 1)).limit(1);
  return result[0] ?? { id: 1, enabled: false, scheduleCronTaskUid: null, updatedAt: new Date() };
}

export async function saveDemoOrderCleanupSettings(input: { enabled: boolean; scheduleCronTaskUid: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for demo-order cleanup");
  await db.insert(demoOrderCleanupSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: input });
  return getDemoOrderCleanupSettings();
}

export async function reserveSubscriptionReminderDispatch(periodKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for subscription reminders");
  try {
    await db.insert(subscriptionReminderDispatches).values({ periodKey });
    return true;
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function releaseSubscriptionReminderDispatch(periodKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for subscription reminders");
  await db.delete(subscriptionReminderDispatches).where(eq(subscriptionReminderDispatches.periodKey, periodKey));
}
