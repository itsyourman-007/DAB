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
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const adminAuthSource = readFileSync(resolve(process.cwd(), "server/adminAuth.ts"), "utf8");

describe("protected merchant dashboard enhancements", () => {
  it("exports complete real customer and payment fields in every order CSV", () => {
    ["Order ID", "Customer name", "Phone number", "Delivery address", "Plan", "Amount INR", "UPI UTR / reference (full)"].forEach((column) => {
      expect(dashboardHtml).toContain(column);
    });
    expect(dashboardHtml).toContain("function orderCsvRows()");
    expect(dashboardHtml).toContain("String(o.utr??'')");
    expect(dashboardHtml).toContain("function excelTextCsvCell(value)");
    expect(dashboardHtml).toContain("'UPI UTR / reference (full)'?excelTextCsvCell(value):csvCell(value)");
    expect(dashboardHtml).toContain("'\\uFEFF'+[headers, ...rows]");
    expect(dashboardHtml).toContain("downloadCsv('91dab-orders.csv',ORDER_CSV_HEADERS,orderCsvRows())");
  });

  it("shows full safely escaped UTR values in Payments instead of masking the merchant reference", () => {
    expect(dashboardHtml).toContain("Complete UTR/reference numbers are visible to authorized dashboard users and exported in full.");
    expect(dashboardHtml).toContain("const fullUtr=String(o.utr??'').trim()||'Not submitted'");
    expect(dashboardHtml).toContain('class="utr-code" title="${escapeText(fullUtr)}">${escapeText(fullUtr)}</td>');
    expect(dashboardHtml).toContain('overflow-wrap:anywhere;min-width:13ch;');
    expect(dashboardHtml).not.toContain("maskedUtr(o.utr)");
  });

  it("requires a numeric buyer UTR/reference and shows the durable trusted submission time in protected payment records", () => {
    expect(schemaSource).toContain('utrSubmittedAt: timestamp("utrSubmittedAt")');
    expect(checkoutSource).toContain("regex(/^\\d{6,128}$/)");
    expect(checkoutSource).toContain('utrSubmittedAt: updated.utrSubmittedAt');
    expect(dbSource).toContain('utrSubmittedAt: new Date()');
    expect(shopHtml).toContain('Mandatorily enter the payment UTR/reference ID after the payment <span class="required-mark" aria-hidden="true">*</span>');
    expect(shopHtml).toContain('inputmode="numeric"');
    expect(shopHtml).toContain('pattern="[0-9]{6,128}"');
    expect(shopHtml).not.toContain('placeholder="Enter numbers only"');
    expect(shopHtml).toContain("const digitsOnly=this.value.replace(/\\D/g,'');");
    expect(shopHtml).toContain("if(!/^\\d{6,128}$/.test(val))");
    expect(dashboardHtml).toContain("utrSubmittedAt: raw.utrSubmittedAt || null");
    expect(dashboardHtml).toContain("function formatDateTime(value)");
    expect(dashboardHtml).toContain("<th>UTR submitted</th>");
    expect(dashboardHtml).toContain("formatDateTime(o.utrSubmittedAt)");
    expect(dashboardHtml).toContain("'UTR submitted at'");
  });

  it("shows a clickable Live Store Data monitor that distinguishes connected protected polling from an offline feed", () => {
    expect(dashboardHtml).toContain('id="liveStoreMonitor"');
    expect(dashboardHtml).toContain('onclick="showLiveStoreStatus()"');
    expect(dashboardHtml).toContain('.live-store-monitor.online .live-dot');
    expect(dashboardHtml).toContain('@keyframes liveStoreShine');
    expect(dashboardHtml).toContain('.live-store-monitor.offline');
    expect(dashboardHtml).toContain("function showLiveStoreStatus()");
    expect(dashboardHtml).toContain("Live Store Data is live and continuously monitored");
    expect(dashboardHtml).toContain("if(data.type==='91dab-live-store-monitor'){ setLiveStoreMonitor(data.monitor); }");
    expect(adminSource).toContain('type: "91dab-live-store-monitor"');
    expect(adminSource).toContain('orders.isError ? "offline" : orders.data !== undefined ? "online" : "connecting"');
  });

  it("provides a responsive Connect app QR and direct signed APK download with accurate update guidance", () => {
    expect(dashboardHtml).toContain('class="card app-download-panel"');
    expect(dashboardHtml).toContain('src="data:image/svg+xml;base64,');
    expect(dashboardHtml).toContain('https://github.com/itsyourman-007/DAB/releases/download/91dab-dashboard-shortcut-v1.0.0/91dab-dashboard-shortcut.apk');
    expect(dashboardHtml).toContain('Download dashboard APK');
    expect(dashboardHtml).toContain('changes to the live website and dashboard appear automatically when the app opens after deployment');
    expect(dashboardHtml).toContain('@media(max-width:620px){.app-download-panel{grid-template-columns:1fr;text-align:center;');
  });

  it("shows saved Calendar events in the Events view without inventing event records", () => {
    expect(dashboardHtml).toContain('id="storeEventsList"');
    expect(dashboardHtml).toContain('function calendarEventRecords()');
    expect(dashboardHtml).toContain('Object.entries(calEvents)');
    expect(dashboardHtml).toContain('function renderStoreEvents()');
    expect(dashboardHtml).toContain("if(screen==='events') renderStoreEvents();");
    expect(dashboardHtml).toContain('No Calendar events have been saved yet.');
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
	    expect(dashboardHtml).toContain('id="dashboardProfileImageInput"');
	    expect(dashboardHtml).toContain("function uploadDashboardProfileImage(input)");
	    expect(dashboardHtml).toContain("91dab-dashboard-profile-image-upload");
	    expect(adminSource).toContain('event.data.type === "91dab-dashboard-profile-image-upload"');
	    expect(routerSource).toContain('profileImageUrl: null');
	  });

  it("keeps Security Settings behind a password re-confirmation gate and leaves the administrator email blank at /admin", () => {
    expect(routerSource).toContain("verifySecuritySettingsPassword: publicProcedure");
    expect(routerSource).toContain("Administrator password was not accepted");
    expect(adminSource).toContain('const [username, setUsername] = useState("")');
    expect(adminSource).toContain('autoComplete="off"');
    expect(adminSource).toContain("onClick={openSecurityGate}");
    expect(adminSource).toContain('id="security-gate-password"');
    expect(adminSource).toContain("verifySecuritySettingsPassword.mutate({ password: securityGatePassword })");
    expect(adminSource).toContain("setSettingsOpen(true)");
  });

  it("renders the calendar immediately and shows real verified monthly subscriptions on each first of the month", () => {
    expect(dashboardHtml).toContain("if(screen==='calendar') requestAnimationFrame(renderCalendar)");
    expect(dashboardHtml).toContain("function subscriptionReminderEvents(key)");
    expect(dashboardHtml).toContain("order.planKey==='monthly'&&order.paymentStatus==='paid'");
    expect(dashboardHtml).toContain("persistCalendarEvents()");
  });

  it("uses Monday-to-Sunday and January-to-December ordering with sales amounts shown only on a black chart tooltip", () => {
    expect(dashboardHtml).toContain("const WEEKDAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']");
    expect(dashboardHtml).toContain("WEEKDAY_LABELS.map((label,index)=>({key:String(index),d:label,v:0}))");
    expect(dashboardHtml).toContain("const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']");
    expect(dashboardHtml).toContain("MONTH_LABELS.map((label,index)=>({key:String(index),d:label,v:0}))");
    expect(dashboardHtml).toContain("String((date.getDay()+6)%7)");
    expect(dashboardHtml).toContain("String(date.getMonth())");
    expect(dashboardHtml).toContain("const first = (new Date(y,m,1).getDay()+6)%7");
    expect(dashboardHtml).toContain("['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach");
    expect(dashboardHtml).toContain("background:#111318;color:#fff");
    expect(dashboardHtml).toContain(".bar-col:hover .bar-tip, .bar-col:focus-within .bar-tip{opacity:1;}");
    expect(dashboardHtml).not.toContain(".bar-col.hi .bar-tip{opacity:1;}");
    expect(dashboardHtml).toContain("Confirmed revenue by weekday");
    expect(dashboardHtml).toContain("Confirmed revenue by month");
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

  it("renders Mark paid, Shipped, and Delivered as clear action buttons while retaining their protected message handlers", () => {
    expect(dashboardHtml).toContain(".action-btn-paid{background:#7c3aed;color:#fff;}");
    expect(dashboardHtml).toContain(".action-btn-shipped{background:#7c3aed;color:#fff;}");
    expect(dashboardHtml).toContain(".action-btn-delivered{background:#7c3aed;color:#fff;}");
    expect(dashboardHtml).toContain('<button class="action-btn action-btn-paid" onclick="event.stopPropagation();requestMarkPaid');
    expect(dashboardHtml).toContain("action-btn-shipped':'action-btn-delivered");
    expect(dashboardHtml).toContain("requestFulfillment(");
    expect(dashboardHtml).toContain("91dab-mark-paid");
    expect(dashboardHtml).toContain("91dab-fulfillment-update");
  });

  it("uses matching compact purple buttons for Customer shortcuts without changing their existing detail action", () => {
    expect(dashboardHtml).toContain(".action-btn-customer{min-height:28px;padding:.34rem .5rem;background:#7c3aed;color:#fff;}");
    expect(dashboardHtml).toContain('<button class="action-btn action-btn-customer" onclick="event.stopPropagation();openCustomer');
    expect(dashboardHtml).not.toContain('>Buyer</button>');
  });

  it("keeps Customer and shipment actions spaced in their existing table cell and marks a quote Replied after its response is submitted", () => {
    expect(dashboardHtml).toContain('.table-action-group{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem;min-width:132px;}');
    expect(dashboardHtml).toContain('<div class="table-action-group">${fulfillmentAction(o)} ${paymentEmailAction(o)}</div>');
    expect(dashboardHtml).toContain('<div class="table-action-group">${fulfillmentAction(o)} <button class="action-btn action-btn-customer"');
    expect(dashboardHtml).toContain("replyStatus:raw.replyStatus==='replied'||replies.length?'replied':'awaiting_reply'");
    expect(dashboardHtml).toContain("q.replyStatus==='replied'?'<span class=\"badge completed\">Replied</span>'");
    expect(dashboardHtml).toContain("activeQuote.replyStatus='replied'");
    expect(dashboardHtml).toContain("raw.replyStatus='replied'");
    expect(dashboardHtml).toContain("writeShopStorage(SHOP_QUOTE_KEY,shopQuoteRecords)");
  });

  it("requires an explicit confirmation and shows in-button loading plus server-confirmed success feedback for status updates", () => {
    expect(dashboardHtml).toContain('id="statusConfirmModal"');
    expect(dashboardHtml).toContain("function openStatusConfirmation(update)");
    expect(dashboardHtml).toContain("function confirmStatusUpdate()");
    expect(dashboardHtml).toContain("openStatusConfirmation({kind:'payment',orderId:id})");
    expect(dashboardHtml).toContain("openStatusConfirmation({kind:'fulfillment',orderId,status})");
    expect(dashboardHtml).toContain("class=\"action-spinner\"");
    expect(dashboardHtml).toContain("Marking paid…");
    expect(dashboardHtml).toContain("Marking ${next}…");
    expect(dashboardHtml).toContain("statusActionPending=null;");
    expect(dashboardHtml).toContain("Payment marked paid successfully");
    expect(dashboardHtml).toContain("Order marked ${status} successfully.");
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

	  it("tracks inventory from administrator-entered quantities and shipment-driven subscription allocations", () => {
    expect(schemaSource).toContain('mysqlTable("merchantInventory"');
    expect(schemaSource).toContain('mysqlTable("merchantInventoryShipmentAllocations"');
    expect(schemaSource).toContain('mysqlTable("subscriptionDeliveryRecords"');
    expect(routerSource).toContain("setInventory: publicProcedure");
    expect(routerSource).toContain("increaseInventory: publicProcedure");
    expect(routerSource).toContain("inventoryAllocations: publicProcedure");
    expect(routerSource).toContain("setSubscriptionDelivery: publicProcedure");
    expect(routerSource).toContain("recordSubscriptionShipment");
    expect(routerSource).toContain("dantaresearch@gmail.com");
    expect(dashboardHtml).toContain("id=\"lowStockAlert\"");
    expect(dashboardHtml).toContain("below the 1,000-unit threshold");
    expect(dashboardHtml).toContain("id=\"inventoryUnits\"");
    expect(dashboardHtml).toContain("Inventory &amp; Products");
    expect(dashboardHtml).toContain("id=\"screen-inventory-products\"");
    expect(dashboardHtml).toContain("function renderInventoryProducts()");
	    expect(dashboardHtml).toContain("91dab-subscription-delivery-save");
	    expect(dashboardHtml).toContain('class="inventory-shipment-region"');
	    expect(dashboardHtml).toContain('Fulfillment queue');
	    expect(dashboardHtml).toContain('Record scheduled allocations below');
	    expect(dashboardHtml).toContain('class="card table-card inventory-shipment-card"');
	    expect(dashboardHtml).toContain('class="card table-card inventory-movement-card"');
	    expect(dashboardHtml).toContain('.inventory-shipment-region{margin-top:1.45rem;padding-top:1.15rem;border-top:1px solid var(--border);}');
	    expect(dashboardHtml).toContain('@media(max-width:620px){.inventory-shipment-region{margin-top:1.1rem;padding-top:1rem;}');
	  });

  it("records buyer-selected monthly and yearly delivery schedules and displays their full twelve-month horizon", () => {
    expect(schemaSource).toContain('deliveryStartMonth: varchar("deliveryStartMonth", { length: 7 })');
    expect(checkoutSource).toContain("function subscriptionScheduleForCheckout(input");
    expect(checkoutSource).toContain("deliveryStartMonth: schedule.deliveryStartMonth");
    expect(shopHtml).toContain('id="deliveryStartMonthSelect"');
    expect(shopHtml).toContain("Yearly delivery preference");
    expect(shopHtml).toContain('id="deliveryYearPreview"');
    expect(shopHtml).toContain("deliveryStartMonth: cart.deliveryStartMonth || null");
    expect(dashboardHtml).toContain("deliveryStartMonth: /^\\d{4}-(0[1-9]|1[0-2])$/.test(raw.deliveryStartMonth||'')");
    expect(dashboardHtml).toContain("Buyer delivery selection");
    expect(dashboardHtml).toContain("const selectedStart=/^\\d{4}-(0[1-9]|1[0-2])$/.test(order.deliveryStartMonth||'')");
    expect(dbSource).toContain("function isScheduledSubscriptionPeriod");
    expect(dbSource).toContain("outside the buyer-selected 12-month delivery schedule");
  });

  it("provides a durable administrator-only Customisation workflow for quote clients and includes recorded units and revenue in Home metrics", () => {
    expect(schemaSource).toContain('mysqlTable("merchantQuoteClientCustomizations"');
    expect(schemaSource).toContain('mysqlTable("merchantClinicQuoteLeads"');
    expect(routerSource).toContain("quoteClientCustomizations: publicProcedure");
    expect(routerSource).toContain("quoteClientLeads: publicProcedure");
    expect(routerSource).toContain("createQuoteClientCustomization: publicProcedure");
    expect(checkoutSource).toContain('app.post("/api/clinic-quote"');
    expect(readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8")).toContain('app.use("/api/clinic-quote", requireTrustedMutationOrigin)');
    expect(adminSource).toContain("trpc.admin.quoteClientCustomizations.useQuery");
    expect(adminSource).toContain("trpc.admin.quoteClientLeads.useQuery");
    expect(adminSource).toContain("91dab-quote-client-customization-create");
    expect(dashboardHtml).toContain('data-screen="customisation"');
    expect(dashboardHtml).toContain('id="screen-customisation"');
    expect(dashboardHtml).toContain('id="customisationQuoteClient"');
    expect(dashboardHtml).toContain("Add new client");
    expect(dashboardHtml).toContain("function startNewCustomisationClient()");
    expect(dashboardHtml).toContain("function saveQuoteClientCustomization(event)");
    expect(dashboardHtml).toContain("customRevenue=quoteClientCustomizations.reduce");
    expect(dashboardHtml).toContain("customUnits=quoteClientCustomizations.reduce");
    expect(dashboardHtml).toContain("Custom client sale saved and Home metrics updated");
    expect(schemaSource).toContain('deliveryAddress: varchar("deliveryAddress", { length: 1000 })');
    expect(schemaSource).toContain('paymentMode: varchar("paymentMode", { length: 32 })');
    expect(routerSource).toContain('deliveryAddress: z.string().trim().min(5).max(1000)');
    expect(routerSource).toContain('paymentMode: z.enum(["upi", "bank_transfer", "cash", "card", "other"])');
    expect(routerSource).toContain('revenueInr: z.number().finite().int().min(0).max(1_000_000_000)');
    expect(dashboardHtml).toContain('id="customisationDeliveryAddress"');
    expect(dashboardHtml).toContain('id="customisationPaymentMode"');
    expect(dashboardHtml).toContain('function customisationWholeInr(fieldId)');
    expect(dashboardHtml).toContain("function customPaymentModeLabel(mode)");
  });

  it("uses one authoritative confirmed-revenue dataset for purple weekly and monthly sales bars and the headline revenue metric", () => {
    expect(dashboardHtml).toContain("function confirmedRevenueRecords()");
    expect(dashboardHtml).toContain("const confirmedCustomSales=quoteClientCustomizations.map");
    expect(dashboardHtml).toContain("function confirmedRevenueTotal()");
    expect(dashboardHtml).toContain("const confirmedSales=confirmedRevenueRecords()");
    expect(dashboardHtml).toContain("const periodRevenue=data.reduce");
    expect(dashboardHtml).toContain("const totalRevenue=confirmedRevenueTotal()");
    expect(dashboardHtml).toContain("WEEKDAY_LABELS.map((label,index)=>({key:String(index),d:label,v:0}))");
    expect(dashboardHtml).toContain("MONTH_LABELS.map((label,index)=>({key:String(index),d:label,v:0}))");
    expect(dashboardHtml).toContain("String((date.getDay()+6)%7)");
    expect(dashboardHtml).toContain("String(date.getMonth())");
    expect(dashboardHtml).toContain("const revenue=confirmedRevenueTotal()");
    expect(dashboardHtml).toContain("background:linear-gradient(180deg,#8b5cf6,#6d28d9)");
    expect(dashboardHtml).toContain("function fmtINR(n){ return '\\u20B9'");
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

  it("carries confirmed custom-client sales into Payments, Transaction History, and Delivery Tracking with locked shipment lifecycle controls", () => {
    expect(schemaSource).toContain('fulfillmentStatus: varchar("fulfillmentStatus", { length: 32 })');
    expect(routerSource).toContain("updateQuoteClientCustomization: publicProcedure");
    expect(routerSource).toContain("deleteQuoteClientCustomization: publicProcedure");
    expect(routerSource).toContain("updateQuoteClientCustomizationFulfillment: publicProcedure");
    expect(dbSource).toContain("A shipped custom client sale cannot be edited; record a correction instead");
    expect(dbSource).toContain("A shipped custom client sale cannot be deleted; record a correction instead");
    expect(dbSource).toContain("custom-client:${existing.id}:shipment");
    expect(adminSource).toContain("91dab-quote-client-customization-update");
    expect(adminSource).toContain("91dab-quote-client-customization-delete");
    expect(adminSource).toContain("91dab-quote-client-customization-fulfillment");
    expect(dashboardHtml).toContain("function customSaleFulfillmentAction(item)");
    expect(dashboardHtml).toContain("function customSaleMatches(item,search)");
    expect(dashboardHtml).toContain("CUSTOM-${item.id}");
    expect(dashboardHtml).toContain("customPaymentModeLabel(item.paymentMode)");
    expect(dashboardHtml).toContain("customSalePlan(item)");
    expect(dashboardHtml).toContain("quoteClientCustomizations.filter(item=>item.fulfillmentStatus!=='delivered')");
    expect(dashboardHtml).toContain("if(data.type==='91dab-quote-client-customizations'){ quoteClientCustomizations=Array.isArray(data.customizations)?data.customizations:[]; syncDashboardViews(); }");
  });

  it("records only successful dashboard logins and displays the protected audit list to administrators", () => {
    expect(schemaSource).toContain('mysqlTable("merchantDashboardLoginAudits"');
    expect(schemaSource).toContain('signedInAt: timestamp("signedInAt")');
    expect(routerSource).toContain("await db.recordMerchantDashboardLogin({ email, role })");
    expect(routerSource).toContain("loginAudits: publicProcedure");
    expect(routerSource).toContain("listMerchantDashboardLoginAudits");
	    expect(dashboardHtml).toContain("Successful login activity");
	    expect(dashboardHtml).toContain("renderLoginAudits()");
	    expect(dashboardHtml).toContain('id="dashboardLastSignIn"');
	    expect(dashboardHtml).toContain('id="accessLastSignIn"');
	    expect(dashboardHtml).toContain("function getLatestLoginAudit()");
	    expect(dashboardHtml).toContain("function renderLatestLoginAudit()");
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
