import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  AdminSecurity,
  InsertUser,
  MerchantDashboardProfile,
  MerchantDashboardLoginAudit,
  MerchantEmployeeAccount,
  MerchantInventory,
  MerchantClinicQuoteLead,
  MerchantOrder,
  MerchantQuoteClientCustomization,
  MerchantTeam,
  MerchantTeamMember,
  adminSecurity,
  demoOrderCleanupSettings,
  merchantDashboardProfiles,
  merchantDashboardLoginAudits,
  merchantEmployeeAccounts,
  merchantInventory,
  merchantClinicQuoteLeads,
  merchantInventoryShipmentAllocations,
  merchantOrders,
  merchantQuoteClientCustomizations,
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

export async function reserveFulfillmentNotificationEmail(input: { orderId: string; status: "shipped" | "delivered"; recipient: string; notificationSuffix?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for fulfillment email delivery");
  const notificationKey = `${input.orderId}:${input.status}${input.notificationSuffix ? `:${input.notificationSuffix}` : ""}`;
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

export async function markFulfillmentNotificationEmailSent(input: { orderId: string; status: "shipped" | "delivered"; notificationSuffix?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for fulfillment email delivery");
  const notificationKey = `${input.orderId}:${input.status}${input.notificationSuffix ? `:${input.notificationSuffix}` : ""}`;
  await db.update(fulfillmentNotificationEmails).set({ deliveryStatus: "sent", sentAt: new Date() }).where(eq(fulfillmentNotificationEmails.notificationKey, notificationKey));
}

export async function releaseFulfillmentNotificationEmail(input: { orderId: string; status: "shipped" | "delivered"; notificationSuffix?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for fulfillment email delivery");
  const notificationKey = `${input.orderId}:${input.status}${input.notificationSuffix ? `:${input.notificationSuffix}` : ""}`;
  await db.delete(fulfillmentNotificationEmails).where(eq(fulfillmentNotificationEmails.notificationKey, notificationKey));
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
  deliveryStartMonth: string | null;
  createdAt: Date;
};

export type MerchantCheckoutOrderInput = Omit<ShopPaymentSubmission, "utr" | "deliveryStartMonth"> & { utr?: string | null; deliveryStartMonth?: string | null };

export async function createMerchantCheckoutOrder(input: MerchantCheckoutOrderInput): Promise<MerchantOrder | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for checkout records");
  await db.insert(merchantOrders).values({
    ...input,
    utr: input.utr ?? null,
    deliveryStartMonth: input.deliveryStartMonth ?? null,
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
  await db.update(merchantOrders).set({ utr, paymentStatus: "utr_submitted", utrSubmittedAt: new Date() }).where(and(
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

const PERIOD_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthOffset(periodKey: string, offset: number) {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Returns the buyer-selected 12-month fulfillment horizon for new recurring orders; legacy orders remain unrestricted. */
export function subscriptionScheduleMonths(order: Pick<MerchantOrder, "planKey" | "deliverySpan" | "deliveryStartMonth">) {
  if ((order.planKey !== "monthly" && order.planKey !== "yearly") || (order.planKey === "yearly" && order.deliverySpan === "once")) return [];
  if (!order.deliveryStartMonth || !PERIOD_KEY_PATTERN.test(order.deliveryStartMonth)) return null;
  return Array.from({ length: 12 }, (_, index) => monthOffset(order.deliveryStartMonth!, index));
}

export function isScheduledSubscriptionPeriod(order: Pick<MerchantOrder, "planKey" | "deliverySpan" | "deliveryStartMonth">, periodKey: string) {
  if (!PERIOD_KEY_PATTERN.test(periodKey)) return false;
  const schedule = subscriptionScheduleMonths(order);
  return schedule === null ? true : schedule.includes(periodKey);
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
  return db.transaction(async (tx) => {
    const existing = (await tx.select().from(merchantOrders).where(eq(merchantOrders.orderId, input.orderId)).limit(1))[0];
    if (!existing) return undefined;
    if (existing.paymentStatus !== "paid") throw new Error("Only paid orders can be marked shipped or delivered");
    if (input.status === "delivered" && existing.fulfillmentStatus === "not_shipped") throw new Error("Mark the order shipped before marking it delivered");
    if (existing.fulfillmentStatus === "delivered") throw new Error("This order is already marked delivered");
    if (input.status === "shipped" && (existing.planKey === "monthly" || (existing.planKey === "yearly" && existing.deliverySpan !== "once"))) {
      throw new Error("Use Inventory & Products to record each scheduled subscription shipment");
    }
    if (input.status === "shipped") await applyShipmentAllocation(tx, existing, { allocationKind: existing.planKey === "yearly" ? "yearly-all-at-once" : "one-time" });
    const now = new Date();
    await tx.update(merchantOrders).set({
      fulfillmentStatus: input.status,
      shippedAt: input.status === "shipped" ? now : existing.shippedAt ?? now,
      deliveredAt: input.status === "delivered" ? now : existing.deliveredAt,
    }).where(eq(merchantOrders.id, existing.id));
    return (await tx.select().from(merchantOrders).where(eq(merchantOrders.id, existing.id)).limit(1))[0];
  });
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

export async function increaseMerchantInventoryUnits(units: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for inventory");
  return db.transaction(async (tx) => {
    const inventoryRows = await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1);
    const inventory = inventoryRows[0] ?? { id: 1, productKey: "dab", productName: "DAB", availableUnits: 0, configured: false, updatedAt: new Date() };
    if (!inventory.configured) throw new Error("Initialize DAB inventory before increasing stock");
    await tx.update(merchantInventory).set({
      availableUnits: sql`${merchantInventory.availableUnits} + ${units}`,
    }).where(eq(merchantInventory.id, 1));
    const updated = await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1);
    return updated[0] ?? inventory;
  });
}

function allocationForOrder(order: MerchantOrder, periodKey?: string) {
  const quantity = Math.max(1, Number(order.quantity || 1));
  if (order.planKey === "introductory") return { allocationKey: `${order.orderId}:one-time`, allocationKind: "one-time", periodKey: null, units: quantity * 12 };
  if (order.planKey === "yearly" && order.deliverySpan === "once") return { allocationKey: `${order.orderId}:yearly-all-at-once`, allocationKind: "yearly-all-at-once", periodKey: null, units: quantity * 1500 };
  if (!periodKey) throw new Error("A shipment month is required for recurring subscription inventory");
  if (order.planKey === "monthly") return { allocationKey: `${order.orderId}:monthly:${periodKey}`, allocationKind: "monthly", periodKey, units: 100 };
  if (order.planKey === "yearly") return { allocationKey: `${order.orderId}:yearly-monthly:${periodKey}`, allocationKind: "yearly-monthly", periodKey, units: quantity * 125 };
  throw new Error("This order does not have a DAB inventory fulfillment rule");
}

async function applyShipmentAllocation(tx: any, order: MerchantOrder, input: { allocationKind?: string; periodKey?: string }) {
  const allocation = allocationForOrder(order, input.periodKey);
  const existingAllocation = (await tx.select().from(merchantInventoryShipmentAllocations).where(eq(merchantInventoryShipmentAllocations.allocationKey, allocation.allocationKey)).limit(1))[0];
  const inventory = (await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0] ?? { id: 1, productKey: "dab", productName: "DAB", availableUnits: 0, configured: false, updatedAt: new Date() };
  if (existingAllocation) return { applied: false, reason: "already-shipped" as const, inventory, allocation: existingAllocation };
  if (!inventory.configured) {
    await tx.insert(merchantInventoryShipmentAllocations).values({ ...allocation, orderId: order.orderId, productKey: "dab" });
    const savedAllocation = (await tx.select().from(merchantInventoryShipmentAllocations).where(eq(merchantInventoryShipmentAllocations.allocationKey, allocation.allocationKey)).limit(1))[0];
    return { applied: true, reason: "recorded-before-inventory" as const, inventory, allocation: savedAllocation };
  }
  if (inventory.availableUnits < allocation.units) throw new Error(`Insufficient DAB stock for this shipment. ${allocation.units} units are required and ${inventory.availableUnits} are available.`);
  await tx.insert(merchantInventoryShipmentAllocations).values({ ...allocation, orderId: order.orderId, productKey: "dab" });
  await tx.update(merchantInventory).set({ availableUnits: sql`${merchantInventory.availableUnits} - ${allocation.units}` }).where(eq(merchantInventory.id, 1));
  const updatedInventory = (await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0] ?? inventory;
  const savedAllocation = (await tx.select().from(merchantInventoryShipmentAllocations).where(eq(merchantInventoryShipmentAllocations.allocationKey, allocation.allocationKey)).limit(1))[0];
  return { applied: true, reason: "deducted" as const, inventory: updatedInventory, allocation: savedAllocation };
}

export async function recordSubscriptionShipment(input: { orderId: string; periodKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for inventory");
  return db.transaction(async (tx) => {
    const order = (await tx.select().from(merchantOrders).where(and(eq(merchantOrders.orderId, input.orderId), eq(merchantOrders.source, "91dab-shop"))).limit(1))[0];
    if (!order || order.paymentStatus !== "paid" || (order.planKey !== "monthly" && order.planKey !== "yearly")) throw new Error("Only paid monthly or yearly subscriptions can be shipped on a schedule");
    if (order.planKey === "yearly" && order.deliverySpan === "once") throw new Error("This yearly subscription is fulfilled all at once and should use its shipment action");
    if (!isScheduledSubscriptionPeriod(order, input.periodKey)) throw new Error("This shipment month is outside the buyer-selected 12-month delivery schedule");
    const shipment = await applyShipmentAllocation(tx, order, { periodKey: input.periodKey });
    const deliveryKey = `${input.orderId}:${input.periodKey}`;
    try { await tx.insert(subscriptionDeliveryRecords).values({ deliveryKey, orderId: input.orderId, periodKey: input.periodKey }); }
    catch (error: any) { if (error?.code !== "ER_DUP_ENTRY" && error?.cause?.code !== "ER_DUP_ENTRY") throw error; }
    return shipment;
  });
}

export async function listMerchantInventoryShipmentAllocations() {
  const db = await getDb();
  if (!db) throw new Error("Database is required for inventory allocation history");
  return db.select().from(merchantInventoryShipmentAllocations).orderBy(desc(merchantInventoryShipmentAllocations.shippedAt));
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

export type MerchantQuoteClientCustomizationInput = {
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  unitsPurchased: number;
  revenueInr: number;
  notes: string | null;
};

export async function listMerchantQuoteClientCustomizations(): Promise<MerchantQuoteClientCustomization[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for quote client customisations");
  return db.select().from(merchantQuoteClientCustomizations).orderBy(desc(merchantQuoteClientCustomizations.createdAt));
}

export async function createMerchantQuoteClientCustomization(input: MerchantQuoteClientCustomizationInput): Promise<MerchantQuoteClientCustomization> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for quote client customisations");
  const result = await db.insert(merchantQuoteClientCustomizations).values(input);
  const id = Number(result[0].insertId);
  const saved = (await db.select().from(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, id)).limit(1))[0];
  if (!saved) throw new Error("Quote client customisation could not be saved");
  return saved;
}

export async function updateMerchantQuoteClientCustomization(input: MerchantQuoteClientCustomizationInput & { id: number }): Promise<MerchantQuoteClientCustomization> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for quote client customisations");
  const existing = (await db.select().from(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, input.id)).limit(1))[0];
  if (!existing) throw new Error("Custom client sale was not found");
  if (existing.fulfillmentStatus !== "not_shipped") throw new Error("A shipped custom client sale cannot be edited; record a correction instead");
  await db.update(merchantQuoteClientCustomizations).set({
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    unitsPurchased: input.unitsPurchased,
    revenueInr: input.revenueInr,
    notes: input.notes,
  }).where(eq(merchantQuoteClientCustomizations.id, input.id));
  const saved = (await db.select().from(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, input.id)).limit(1))[0];
  if (!saved) throw new Error("Custom client sale could not be saved");
  return saved;
}

export async function deleteMerchantQuoteClientCustomization(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for quote client customisations");
  const existing = (await db.select().from(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, id)).limit(1))[0];
  if (!existing) throw new Error("Custom client sale was not found");
  if (existing.fulfillmentStatus !== "not_shipped") throw new Error("A shipped custom client sale cannot be deleted; record a correction instead");
  await db.delete(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, id));
}

export async function updateMerchantQuoteClientCustomizationFulfillment(input: { id: number; status: "shipped" | "delivered" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for quote client customisations");
  return db.transaction(async (tx) => {
    const existing = (await tx.select().from(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, input.id)).limit(1))[0];
    if (!existing) throw new Error("Custom client sale was not found");
    if (existing.fulfillmentStatus === "delivered") throw new Error("This custom client sale is already delivered");
    if (input.status === "shipped") {
      if (existing.fulfillmentStatus !== "not_shipped") throw new Error("This custom client sale is already shipped");
      const allocationKey = `custom-client:${existing.id}:shipment`;
      const existingAllocation = (await tx.select().from(merchantInventoryShipmentAllocations).where(eq(merchantInventoryShipmentAllocations.allocationKey, allocationKey)).limit(1))[0];
      if (!existingAllocation) {
        const inventory = (await tx.select().from(merchantInventory).where(eq(merchantInventory.id, 1)).limit(1))[0] ?? { id: 1, productKey: "dab", productName: "DAB", availableUnits: 0, configured: false, updatedAt: new Date() };
        if (inventory.configured && inventory.availableUnits < existing.unitsPurchased) throw new Error(`Insufficient DAB stock for this shipment. ${existing.unitsPurchased} units are required and ${inventory.availableUnits} are available.`);
        await tx.insert(merchantInventoryShipmentAllocations).values({ allocationKey, orderId: `CUSTOM-${existing.id}`, productKey: "dab", allocationKind: "custom-client", periodKey: null, units: existing.unitsPurchased });
        if (inventory.configured) await tx.update(merchantInventory).set({ availableUnits: sql`${merchantInventory.availableUnits} - ${existing.unitsPurchased}` }).where(eq(merchantInventory.id, 1));
      }
    } else if (existing.fulfillmentStatus !== "shipped") {
      throw new Error("Ship this custom client sale before marking it delivered");
    }
    const now = new Date();
    await tx.update(merchantQuoteClientCustomizations).set({
      fulfillmentStatus: input.status,
      shippedAt: input.status === "shipped" ? now : existing.shippedAt ?? now,
      deliveredAt: input.status === "delivered" ? now : existing.deliveredAt,
    }).where(eq(merchantQuoteClientCustomizations.id, input.id));
    const saved = (await tx.select().from(merchantQuoteClientCustomizations).where(eq(merchantQuoteClientCustomizations.id, input.id)).limit(1))[0];
    if (!saved) throw new Error("Custom client fulfillment could not be saved");
    return saved;
  });
}

export async function listMerchantClinicQuoteLeads(): Promise<MerchantClinicQuoteLead[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is required for clinic quote leads");
  return db.select().from(merchantClinicQuoteLeads).orderBy(desc(merchantClinicQuoteLeads.updatedAt));
}

export async function saveMerchantClinicQuoteLead(input: { clientEmail: string; clientPhone: string | null; note: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for clinic quote leads");
  await db.insert(merchantClinicQuoteLeads).values(input).onDuplicateKeyUpdate({ set: { clientPhone: input.clientPhone, note: input.note } });
  return listMerchantClinicQuoteLeads();
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
