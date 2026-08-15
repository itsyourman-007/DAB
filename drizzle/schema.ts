import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** One protected row containing the active dashboard password hash and password-change OTP state. */
export const adminSecurity = mysqlTable("adminSecurity", {
  id: int("id").primaryKey(),
  passwordHash: text("passwordHash"),
  otpHash: text("otpHash"),
  otpRecipient: varchar("otpRecipient", { length: 320 }),
  otpExpiresAt: timestamp("otpExpiresAt"),
  otpAttempts: int("otpAttempts").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminSecurity = typeof adminSecurity.$inferSelect;

/** Deduplicates buyer confirmation emails so a verified payment is acknowledged only once. */
export const paymentConfirmationEmails = mysqlTable("paymentConfirmationEmails", {
  id: int("id").autoincrement().primaryKey(),
  orderId: varchar("orderId", { length: 128 }).notNull().unique(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  status: mysqlEnum("status", ["reserved", "sent"]).default("reserved").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Deduplicates buyer emails for each durable order-fulfillment transition. */
export const fulfillmentNotificationEmails = mysqlTable("fulfillmentNotificationEmails", {
  id: int("id").autoincrement().primaryKey(),
  notificationKey: varchar("notificationKey", { length: 192 }).notNull().unique(),
  orderId: varchar("orderId", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["shipped", "delivered"]).notNull(),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  deliveryStatus: mysqlEnum("deliveryStatus", ["reserved", "sent"]).default("reserved").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Administrator-created merchant teams; no teams are seeded. */
export const merchantTeams = mysqlTable("merchantTeams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantTeam = typeof merchantTeams.$inferSelect;

/** Restricted merchant-dashboard accounts created and revoked by the administrator. */
export const merchantEmployeeAccounts = mysqlTable("merchantEmployeeAccounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 512 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantEmployeeAccount = typeof merchantEmployeeAccounts.$inferSelect;

/** Merchant dashboard teammates entered by the administrator; no seeded members are stored. */
export const merchantTeamMembers = mysqlTable("merchantTeamMembers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  department: varchar("department", { length: 100 }).notNull(),
  teamId: int("teamId"),
  salaryInr: int("salaryInr"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantTeamMember = typeof merchantTeamMembers.$inferSelect;

/** Editable identity shown in the protected dashboard; the administrator decides the displayed name and email. */
export const merchantDashboardProfiles = mysqlTable("merchantDashboardProfiles", {
  id: int("id").primaryKey(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantDashboardProfile = typeof merchantDashboardProfiles.$inferSelect;

/** A server-backed copy of a real shop checkout record for protected operations and scheduled subscription reminders. */
export const merchantOrders = mysqlTable("merchantOrders", {
  id: int("id").autoincrement().primaryKey(),
  orderId: varchar("orderId", { length: 128 }).notNull().unique(),
  buyerName: varchar("buyerName", { length: 160 }).notNull(),
  buyerEmail: varchar("buyerEmail", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  pincode: varchar("pincode", { length: 32 }),
  planKey: varchar("planKey", { length: 64 }).notNull(),
  planName: varchar("planName", { length: 160 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  amount: int("amount").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }).default("UPI").notNull(),
  utr: varchar("utr", { length: 128 }),
  deliverySpan: varchar("deliverySpan", { length: 64 }),
  /** Buyer-selected first delivery month for recurring monthly or yearly schedules, formatted YYYY-MM. */
  deliveryStartMonth: varchar("deliveryStartMonth", { length: 7 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "utr_submitted", "paid", "expired"]).default("pending").notNull(),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", ["not_shipped", "shipped", "delivered"]).default("not_shipped").notNull(),
  source: varchar("source", { length: 32 }).default("91dab-shop").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** Server-recorded instant at which the buyer submitted a numeric UPI UTR/reference ID. */
  utrSubmittedAt: timestamp("utrSubmittedAt"),
  verifiedAt: timestamp("verifiedAt"),
  inventoryDeductedAt: timestamp("inventoryDeductedAt"),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
});

export type MerchantOrder = typeof merchantOrders.$inferSelect;

/** Successful dashboard sign-ins, visible only to the administrator. No failed-attempt or password data is stored. */
export const merchantDashboardLoginAudits = mysqlTable("merchantDashboardLoginAudits", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "employee"]).notNull(),
  signedInAt: timestamp("signedInAt").defaultNow().notNull(),
});

export type MerchantDashboardLoginAudit = typeof merchantDashboardLoginAudits.$inferSelect;

/** Administrator-initialized stock state; no product quantity is seeded. */
export const merchantInventory = mysqlTable("merchantInventory", {
  id: int("id").primaryKey(),
  productKey: varchar("productKey", { length: 64 }).notNull().unique(),
  productName: varchar("productName", { length: 160 }).notNull(),
  availableUnits: int("availableUnits").notNull().default(0),
  configured: boolean("configured").notNull().default(false),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantInventory = typeof merchantInventory.$inferSelect;

/** One immutable DAB inventory deduction per actual shipment allocation; the unique key prevents duplicate stock decrements. */
export const merchantInventoryShipmentAllocations = mysqlTable("merchantInventoryShipmentAllocations", {
  id: int("id").autoincrement().primaryKey(),
  allocationKey: varchar("allocationKey", { length: 192 }).notNull().unique(),
  orderId: varchar("orderId", { length: 128 }).notNull(),
  productKey: varchar("productKey", { length: 64 }).notNull().default("dab"),
  periodKey: varchar("periodKey", { length: 7 }),
  allocationKind: varchar("allocationKind", { length: 32 }).notNull(),
  units: int("units").notNull(),
  shippedAt: timestamp("shippedAt").defaultNow().notNull(),
});

export type MerchantInventoryShipmentAllocation = typeof merchantInventoryShipmentAllocations.$inferSelect;

/** One record per paid subscription order and delivery month; the unique key makes checkbox delivery updates idempotent. */
export const subscriptionDeliveryRecords = mysqlTable("subscriptionDeliveryRecords", {
  id: int("id").autoincrement().primaryKey(),
  deliveryKey: varchar("deliveryKey", { length: 192 }).notNull().unique(),
  orderId: varchar("orderId", { length: 128 }).notNull(),
  periodKey: varchar("periodKey", { length: 7 }).notNull(),
  deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
});

export type SubscriptionDeliveryRecord = typeof subscriptionDeliveryRecords.$inferSelect;

/** Administrator-recorded commercial details for a clinic or bulk quote client; these records contribute to protected Home metrics. */
export const merchantQuoteClientCustomizations = mysqlTable("merchantQuoteClientCustomizations", {
  id: int("id").autoincrement().primaryKey(),
  clientName: varchar("clientName", { length: 160 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  clientPhone: varchar("clientPhone", { length: 64 }),
  deliveryAddress: varchar("deliveryAddress", { length: 1000 }),
  paymentMode: varchar("paymentMode", { length: 32 }).notNull().default("other"),
  unitsPurchased: int("unitsPurchased").notNull(),
  revenueInr: int("revenueInr").notNull(),
  notes: varchar("notes", { length: 1000 }),
  fulfillmentStatus: varchar("fulfillmentStatus", { length: 32 }).notNull().default("not_shipped"),
  shippedAt: timestamp("shippedAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantQuoteClientCustomization = typeof merchantQuoteClientCustomizations.$inferSelect;

/** Public clinic quote requests stored server-side so administrators can select a real quote lead for a later custom commercial record. */
export const merchantClinicQuoteLeads = mysqlTable("merchantClinicQuoteLeads", {
  id: int("id").autoincrement().primaryKey(),
  clientEmail: varchar("clientEmail", { length: 320 }).notNull().unique(),
  clientPhone: varchar("clientPhone", { length: 64 }),
  note: varchar("note", { length: 1000 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantClinicQuoteLead = typeof merchantClinicQuoteLeads.$inferSelect;

/** Project-level controls for the single automatic monthly subscription-summary job. */
export const subscriptionReminderSettings = mysqlTable("subscriptionReminderSettings", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionReminderSettings = typeof subscriptionReminderSettings.$inferSelect;

/** Controls the optional published-site task that removes clearly labelled demo orders after the retention period. */
export const demoOrderCleanupSettings = mysqlTable("demoOrderCleanupSettings", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DemoOrderCleanupSettings = typeof demoOrderCleanupSettings.$inferSelect;

/** Deduplicates scheduled monthly summaries across automatic retry attempts. */
export const subscriptionReminderDispatches = mysqlTable("subscriptionReminderDispatches", {
  id: int("id").autoincrement().primaryKey(),
  periodKey: varchar("periodKey", { length: 7 }).notNull().unique(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});
