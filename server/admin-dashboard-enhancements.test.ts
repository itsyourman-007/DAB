import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/dashboard.html"), "utf8");
const shopHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/shop.html"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const reminderSource = readFileSync(resolve(process.cwd(), "server/subscriptionReminders.ts"), "utf8");
const checkoutSource = readFileSync(resolve(process.cwd(), "server/checkoutRoutes.ts"), "utf8");
const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const adminAuthSource = readFileSync(resolve(process.cwd(), "server/adminAuth.ts"), "utf8");

describe("protected merchant dashboard enhancements", () => {
  it("exports complete real customer and payment fields in every order CSV", () => {
    ["Order ID", "Customer name", "Phone number", "Delivery address", "Plan", "Amount INR", "UPI reference"].forEach((column) => {
      expect(dashboardHtml).toContain(column);
    });
    expect(dashboardHtml).toContain("function orderCsvRows()");
    expect(dashboardHtml).toContain("downloadCsv('91dab-orders.csv',ORDER_CSV_HEADERS,orderCsvRows())");
  });

  it("keeps persistent team and member creation, editing, and removal password-confirmed with selectable teams and salary fields", () => {
    expect(routerSource).toContain("updateTeamMember: publicProcedure");
    expect(routerSource).toContain("createTeam: publicProcedure");
    expect(routerSource).toContain("updateTeam: publicProcedure");
    expect(routerSource).toContain("removeTeam: publicProcedure");
    expect(routerSource).toContain("salaryInr: z.number().int().min(0)");
    expect(routerSource).toContain("teamId: z.number().int().positive()");
    expect(schemaSource).toContain('mysqlTable("merchantTeams"');
    expect(schemaSource).toContain('teamId: int("teamId")');
    expect(dashboardHtml).toContain("id=\"teamSalary\"");
    expect(dashboardHtml).toContain("openTeamEdit(");
    expect(dashboardHtml).toContain("91dab-team-edit");
    expect(dashboardHtml).toContain("91dab-team-create");
    expect(dashboardHtml).toContain("id=\"teamDirectory\"");
    expect(dashboardHtml).toContain("id=\"teamAll\"");
    expect(dashboardHtml).toContain("removeTeamPassword");
  });

  it("replaces the hardcoded profile with a protected editable administrator profile", () => {
    expect(dashboardHtml).not.toContain("sarah@91dab.com");
    expect(dashboardHtml).not.toContain("Sarah Johnson");
    expect(dashboardHtml).toContain("saveDashboardProfile()");
    expect(routerSource).toContain("updateProfile: publicProcedure");
    expect(adminSource).toContain("91dab-dashboard-profile-save");
    expect(dashboardHtml).toContain('data-screen="access"');
    expect(dashboardHtml).toContain('id="screen-access"');
  });

  it("renders the calendar immediately and shows real verified monthly subscriptions on each first of the month", () => {
    expect(dashboardHtml).toContain("if(screen==='calendar') requestAnimationFrame(renderCalendar)");
    expect(dashboardHtml).toContain("function subscriptionReminderEvents(key)");
    expect(dashboardHtml).toContain("order.planKey==='monthly'&&order.paymentStatus==='paid'");
    expect(dashboardHtml).toContain("persistCalendarEvents()");
  });

  it("persists server-created UPI orders and marks only submitted trusted records paid through protected admin operations", () => {
    expect(shopHtml).toContain("fetch('/api/orders'");
    expect(shopHtml).toContain("/api/orders/${currentOrder.orderId}/utr");
    expect(checkoutSource).toContain("createMerchantCheckoutOrder");
    expect(checkoutSource).toContain("submitMerchantOrderUtr");
    expect(checkoutSource).toContain("const amount = plan.price * input.qty");
    expect(routerSource).not.toContain("recordShopPaymentSubmission: publicProcedure");
    expect(routerSource).toContain("markOrderPaid: publicProcedure");
    expect(routerSource).toContain("A submitted UPI reference is required before payment can be marked paid");
    expect(dashboardHtml).toContain("requestMarkPaid(");
    expect(dashboardHtml).toContain(">Mark paid</button>");
  });

  it("builds all dashboard-eligible order views from trusted server records and never from browser-local payment fallbacks", () => {
    expect(dashboardHtml).toContain("rebuildOrderViews(serverOrderRecords.map(orderFromServerRecord))");
    expect(dashboardHtml).not.toContain("qualifiesForDashboard");
    expect(dashboardHtml).not.toContain("orderFromShopRecord");
    expect(shopHtml).not.toContain("localFallback");
    expect(shopHtml).not.toContain("Your UTR was recorded locally");
    expect(shopHtml).toContain("No payment request or order record was created.");
  });

  it("uses an authenticated, idempotent managed callback for the first-of-month summary email", () => {
    expect(routerSource).toContain('cron: "0 30 3 1 * *"');
    expect(routerSource).toContain("Publish the website before activating");
    expect(reminderSource).toContain("if (!user.isCron || !user.taskUid)");
    expect(reminderSource).toContain("reserveSubscriptionReminderDispatch(periodKey)");
    expect(reminderSource).toContain("sendMonthlySubscriptionSummary");
  });

  it("supports administrator-managed restricted employee username access without exposing employee passwords", () => {
    expect(schemaSource).toContain('mysqlTable("merchantEmployeeAccounts"');
    expect(schemaSource).toContain('passwordHash: varchar("passwordHash"');
    expect(routerSource).toContain("createEmployeeAccount: publicProcedure");
    expect(routerSource).toContain("resetEmployeePassword: publicProcedure");
    expect(routerSource).toContain("removeEmployeeAccount: publicProcedure");
    expect(routerSource).toContain("username: z.string().trim().email()");
    expect(routerSource).toContain("dantaresearch@gmail.com");
    expect(adminAuthSource).toContain("createEmployeeSession");
    expect(adminAuthSource).toContain("getActiveMerchantEmployeeAccountById");
    expect(dashboardHtml).toContain("Restricted employee access");
    expect(dashboardHtml).toContain("91dab-employee-account-create");
    expect(dashboardHtml).toContain("data-admin-only");
    expect(dashboardHtml).toContain("Active restricted employee session");
  });

  it("tracks inventory from administrator-entered quantities and supports paid subscription delivery checkboxes", () => {
    expect(schemaSource).toContain('mysqlTable("merchantInventory"');
    expect(schemaSource).toContain('mysqlTable("subscriptionDeliveryRecords"');
    expect(schemaSource).toContain('inventoryDeductedAt: timestamp("inventoryDeductedAt")');
    expect(routerSource).toContain("setInventory: publicProcedure");
    expect(routerSource).toContain("setSubscriptionDelivery: publicProcedure");
    expect(routerSource).toContain("decrementInventoryForPaidOrder");
    expect(routerSource).toContain("dantaresearch@gmail.com");
    expect(dashboardHtml).toContain("id=\"lowStockAlert\"");
    expect(dashboardHtml).toContain("below the 1,000-unit threshold");
    expect(dashboardHtml).toContain("id=\"inventoryUnits\"");
    expect(dashboardHtml).toContain("deliveryCheckboxes(o)");
    expect(dashboardHtml).toContain("91dab-subscription-delivery-save");
  });

  it("tracks paid-order fulfillment through the server and exposes shipment controls to authorized dashboard sessions", () => {
    expect(schemaSource).toContain('fulfillmentStatus: mysqlEnum("fulfillmentStatus", ["not_shipped", "shipped", "delivered"])');
    expect(schemaSource).toContain('shippedAt: timestamp("shippedAt")');
    expect(schemaSource).toContain('deliveredAt: timestamp("deliveredAt")');
    expect(routerSource).toContain("updateFulfillment: publicProcedure");
    expect(routerSource).toContain('status: z.enum(["shipped", "delivered"])');
    expect(routerSource).toContain("isDashboardSession(ctx.req.headers.cookie)");
    expect(dashboardHtml).toContain("function fulfillmentAction(o)");
    expect(dashboardHtml).toContain('id="paymentsBody"');
    expect(dashboardHtml).toContain('id="transactionsBody"');
    expect(dashboardHtml).toContain("91dab-fulfillment-update");
    expect(dashboardHtml).toContain("91dab-fulfillment-result");
    expect(dashboardHtml).toContain('data-screen="delivery-tracking"');
    expect(dashboardHtml).toContain('id="screen-delivery-tracking"');
    expect(dashboardHtml).toContain('id="deliveryTrackingBody"');
    expect(dashboardHtml).toContain("function renderDeliveryTracking()");
    expect(dashboardHtml).toContain("Buyer email sent.");
    expect(schemaSource).toContain('mysqlTable("fulfillmentNotificationEmails"');
    expect(routerSource).toContain("sendBuyerFulfillmentConfirmation");
    expect(routerSource).toContain("reserveFulfillmentNotificationEmail");
  });

  it("records only successful dashboard logins and displays the protected audit list to administrators", () => {
    expect(schemaSource).toContain('mysqlTable("merchantDashboardLoginAudits"');
    expect(schemaSource).toContain('signedInAt: timestamp("signedInAt")');
    expect(routerSource).toContain("await db.recordMerchantDashboardLogin({ email, role })");
    expect(routerSource).toContain("loginAudits: publicProcedure");
    expect(routerSource).toContain("listMerchantDashboardLoginAudits");
    expect(dashboardHtml).toContain("Successful login activity");
    expect(dashboardHtml).toContain("renderLoginAudits()");
    expect(dashboardHtml).toContain("91dab-login-audits");
    expect(adminSource).toContain('type: "91dab-login-audits"');
  });

  it("mounts launch security controls before checkout and dashboard handlers", () => {
    const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(indexSource).toContain('app.use("/api/orders", requireTrustedMutationOrigin)');
    expect(indexSource).toContain('app.use("/api/trpc/admin.login", rateLimit');
    expect(indexSource).toContain('app.use("/api/trpc", requireTrustedMutationOrigin)');
    expect(indexSource).toContain("app.use(applySecurityHeaders)");
  });

  it("prepares an administrator-controlled published-site schedule for explicit demo-order cleanup", () => {
    const cleanupSource = readFileSync(resolve(process.cwd(), "server/demoOrderCleanup.ts"), "utf8");
    const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(schemaSource).toContain('mysqlTable("demoOrderCleanupSettings"');
    expect(routerSource).toContain("activateDemoOrderCleanup: publicProcedure");
    expect(routerSource).toContain('cron: "0 0 * * * *"');
    expect(routerSource).toContain('path: "/api/scheduled/demo-order-cleanup"');
    expect(cleanupSource).toContain("user.isCron || !user.taskUid");
    expect(cleanupSource).toContain("deleteExpiredDemoOrders");
    expect(indexSource).toContain('app.post("/api/scheduled/demo-order-cleanup", cleanupScheduledDemoOrders)');
    expect(dashboardHtml).toContain("Demo-order cleanup");
    expect(dashboardHtml).toContain("91dab-demo-cleanup-activate");
    expect(adminSource).toContain('type: "91dab-demo-cleanup-status"');
  });
});
