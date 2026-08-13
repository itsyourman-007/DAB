import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const dashboardHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/dashboard.html"), "utf8");
const shopHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/shop.html"), "utf8");
const landingHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/index.html"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
const scriptMatch = dashboardHtml.match(/<script>([\s\S]*)<\/script>/);

if (!scriptMatch) throw new Error("Dashboard script could not be found");

const dashboardScript = scriptMatch[1].replace(/\/\* ============================================================\n   INIT[\s\S]*$/, "");

type StoredRecord = Record<string, unknown>;

function createDashboardHarness(storage: Record<string, StoredRecord[]>) {
  const element = {
    addEventListener: () => undefined,
    classList: { add: () => undefined, remove: () => undefined, toggle: () => undefined, contains: () => false },
    style: {},
    textContent: "",
    innerHTML: "",
    value: "",
  };
  const localStorage = {
    getItem: (key: string) => JSON.stringify(storage[key] ?? []),
    setItem: (key: string, value: string) => {
      storage[key] = JSON.parse(value) as StoredRecord[];
    },
  };
  const sandbox = {
    console,
    localStorage,
    window: { addEventListener: () => undefined },
    document: {
      getElementById: () => element,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => undefined,
      documentElement: element,
    },
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
    URL: { createObjectURL: () => "", revokeObjectURL: () => undefined },
    Blob,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(
    `${dashboardScript}\nglobalThis.__dashboardTest = { hydrateShopData, applyServerOrders, deliveryPeriods, state: () => ({ orders, quoteRequests }) };`,
    context
  );
  return context as typeof context & {
    __dashboardTest: {
      hydrateShopData: () => void;
      applyServerOrders: (records: Array<Record<string, unknown>>) => void;
      deliveryPeriods: (order: { planKey: string; created: number }) => string[];
      state: () => { orders: Array<{ id: string; paymentStatus: string }>; quoteRequests: Array<{ email: string }> };
    };
  };
}

const buyer = {
  name: "Real Buyer",
  email: "buyer@example.test",
  phone: "9000000000",
  address: "1 Buyer Street",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

function order(orderId: string, paymentStatus: string, source = "91dab-shop") {
  return {
    source,
    orderId,
    planKey: "introductory",
    qty: 1,
    amount: 500,
    paymentStatus,
    status: paymentStatus,
    paymentMethod: "UPI",
    utr: paymentStatus === "utr_submitted" ? "UTR-1001" : "",
    createdAt: "2026-08-12T10:00:00.000Z",
    orderInfo: buyer,
  };
}

function serverOrder(orderId: string, paymentStatus: string) {
  return {
    orderId,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    phone: buyer.phone,
    address: buyer.address,
    city: buyer.city,
    state: buyer.state,
    pincode: buyer.pincode,
    planKey: "introductory",
    planName: "Introductory DAB",
    quantity: 1,
    amount: 500,
    paymentStatus,
    paymentMethod: "UPI",
    utr: paymentStatus === "utr_submitted" ? "UTR-1001" : null,
    createdAt: "2026-08-12T10:00:00.000Z",
  };
}

describe("real-data-only dashboard integration", () => {
  it("starts with no orders or quote leads when shared storage is empty", () => {
    const harness = createDashboardHarness({
      "91dab_shop_orders": [],
      "91dab_clinic_quotes": [],
    });

    harness.__dashboardTest.hydrateShopData();

    expect(harness.__dashboardTest.state()).toEqual({ orders: [], quoteRequests: [] });
  });

  it("hydrates only trusted server-created checkout records, including a pending payment request", () => {
    const harness = createDashboardHarness({
      "91dab_shop_orders": [
        order("PENDING-1", "pending"),
        order("UTR-1", "utr_submitted"),
        order("PAID-1", "paid"),
        order("UNTRUSTED-1", "paid", "other-source"),
      ],
      "91dab_clinic_quotes": [],
    });

    harness.__dashboardTest.applyServerOrders([
      serverOrder("PENDING-1", "pending"),
      serverOrder("UTR-1", "utr_submitted"),
      serverOrder("PAID-1", "paid"),
    ]);

    expect(harness.__dashboardTest.state().orders.map((record) => record.id).sort()).toEqual(["PAID-1", "PENDING-1", "UTR-1"]);
    expect(harness.__dashboardTest.state().orders.map((record) => record.paymentStatus).sort()).toEqual(["paid", "pending", "utr_submitted"]);
  });

  it("hydrates only trusted clinic quote submissions", () => {
    const harness = createDashboardHarness({
      "91dab_shop_orders": [],
      "91dab_clinic_quotes": [
        { source: "91dab-shop", email: "clinic@example.test", phone: "9000000000", createdAt: "2026-08-12T10:00:00.000Z" },
        { source: "other-source", email: "ignore@example.test", createdAt: "2026-08-12T10:00:00.000Z" },
      ],
    });

    harness.__dashboardTest.hydrateShopData();

    expect(harness.__dashboardTest.state().quoteRequests.map((quote) => quote.email)).toEqual(["clinic@example.test"]);
  });

  it("retains no demo names or automatic buyer simulation and marks records as shop-generated", () => {
    ["John Doe", "Jane Smith", "Bob Johnson", "Alice Williams", "Rahul Kapoor", "liveOrderTick", "liveQuoteTick", "DEMO"].forEach((forbiddenValue) => {
      expect(dashboardHtml).not.toContain(forbiddenValue);
    });
    expect(shopHtml).toContain("source:'91dab-shop'");
    expect(shopHtml).toContain("upsertShopOrder");
    expect(shopHtml).toContain("submitClinicQuote");
  });

  it("uses the supplied landing page at root and sends every Buy DAB route to the top-level shop page", () => {
    expect(homeSource).toContain("srcDoc={landingHtml}");
    expect(appSource).toContain('path={"/shop"}');
    expect(landingHtml).toContain('href="/shop" target="_top"');
  });

  it("keeps the dashboard sidebar recoverable and routes shop branding and story links to the landing page", () => {
    expect(dashboardHtml).toContain('id="collapseBtn" title="Collapse sidebar" aria-label="Collapse sidebar"');
    expect(dashboardHtml).toContain("this.title=collapsed?'Expand sidebar':'Collapse sidebar'");
    expect(dashboardHtml).toContain('.app.mobile-open .sidebar{transform:translateX(0);}');
    expect(dashboardHtml).toContain('.sidebar{width:min(82vw,300px);}');
    expect(shopHtml).toContain('class="brand" href="/" target="_top"');
    expect(shopHtml).toContain('href="/#about" target="_top" class="btn outline lg">Read the story');
  });

  it("offers both cookie consent choices and stores the visitor’s decision", () => {
    expect(landingHtml).toContain('id="cookieAccept"');
    expect(landingHtml).toContain('id="cookieReject"');
    expect(landingHtml).toContain("91dab_cookie_consent");
    expect(landingHtml).toContain("decideCookies('accepted')");
    expect(landingHtml).toContain("decideCookies('rejected')");
  });

  it("uses the corrected MeitY TIDE grant and Women’s Hackathon recognition titles", () => {
    expect(landingHtml).toContain("Selected for MeitY TIDE 2.0 EIR Grant");
    expect(landingHtml).toContain("Women's Hackathon 3.0");
    expect(landingHtml).toContain("selected for the MeitY TIDE 2.0 EIR Grant from the Ministry of Electronics and Information Technology");
    expect(landingHtml).not.toContain("Winners of Tide 2.0 MeiTy Grant");
    expect(landingHtml).not.toContain("won Tide 2.0 MeiTY grant");
    expect(landingHtml).not.toContain("Women's Hackthon 2.0");
  });

  it("forwards verified checkout details and reports buyer-email sending status", () => {
    expect(dashboardHtml).toContain(">Mark paid</button>");
    expect(dashboardHtml).toContain("91dab-mark-paid");
    expect(dashboardHtml).toContain("quantity:Number(o.quantity||o.qty||o.pieces||1)");
    expect(dashboardHtml).toContain("address:info.address||null");
    expect(dashboardHtml).toContain("paymentEmailStates");
    expect(dashboardHtml).toContain("91dab-email-result");
    expect(dashboardHtml).toContain("Sending…");
    expect(adminSource).toContain("toast.loading(\"Verifying payment and sending the buyer confirmation email…\"");
    expect(adminSource).toContain('id: "buyer-confirmation-email"');
    expect(adminSource).toContain('type: "91dab-email-result"');
  });

  it("derives protected transaction history solely from qualifying recorded shop purchases", () => {
    expect(dashboardHtml).toContain('data-screen="transactions"');
    expect(dashboardHtml).toContain('id="screen-transactions"');
    expect(dashboardHtml).toContain('id="transactionsBody"');
    expect(dashboardHtml).toContain('function renderTransactions()');
    expect(dashboardHtml).toContain("renderTransactions(); renderDeliveryTracking(); updateShopBadges(); refreshHomeStats();");
    expect(dashboardHtml).toContain('Only purchases recorded by the live 91DAB shop appear here.');
  });

  it("keeps the public landing and every purchase screen within the compact phone layout", () => {
    expect(landingHtml).toContain('.nav-inner{display:grid;grid-template-columns:minmax(0,1fr) auto;');
    expect(landingHtml).toContain('.hero-actions.reveal,.hero-actions .reveal{opacity:1;transform:none;}');
    expect(landingHtml).toContain('.hero-actions .btn{width:100%;max-width:100%;min-width:0;justify-content:center;white-space:normal;min-height:48px;line-height:1.25;}');
    expect(shopHtml).toContain('.hero-grid,.product-grid,.pay-grid{grid-template-columns:1fr;}');
    expect(shopHtml).toContain('.cart-item .remove-btn{grid-column:2;justify-self:start;}');
    expect(shopHtml).toContain('.utr-row{flex-direction:column;gap:.65rem;}');
    expect(shopHtml).toContain('.confirm-card{padding:1.1rem;}');
  });

  it("uses the supplied recognition photographs in responsive portrait and exhibition frames", () => {
    expect(landingHtml).toContain('/assets/women-startup-program-valedictory.webp');
    expect(landingHtml).toContain('/assets/91dab-exhibition-meity-tide.webp');
    expect(landingHtml).toContain('.dream-figure img{width:100%;display:block;aspect-ratio:9/16;object-fit:contain;object-position:center;');
    expect(landingHtml).toContain('.recognition-photo img{width:100%;display:block;aspect-ratio:2/1;object-fit:contain;object-position:center;');
    expect(landingHtml).toContain('91DAB at the MeitY TIDE 2.0 EIR Grant exhibition stand');
  });

  it("retains password-confirmed team controls and configured-recipient support routing in the protected dashboard", () => {
    expect(dashboardHtml).toContain("openTeamDialog('engineering')");
    expect(dashboardHtml).toContain('The current dashboard password is required before this record is saved.');
    expect(dashboardHtml).toContain("type:'91dab-team-add'");
    expect(dashboardHtml).toContain("type:'91dab-team-remove'");
    expect(dashboardHtml).toContain("type:'91dab-support-request'");
    expect(adminSource).toContain("trpc.admin.createTeamMember.useMutation()");
    expect(adminSource).toContain("trpc.admin.removeTeamMember.useMutation()");
    expect(adminSource).toContain("trpc.admin.submitSupportRequest.useMutation()");
  });

  it("retains every elapsed delivery month for a long-running monthly subscription", () => {
    const harness = createDashboardHarness({ "91dab_shop_orders": [], "91dab_clinic_quotes": [] });
    const now = new Date();
    const started = new Date(now.getFullYear() - 3, now.getMonth(), 1);
    const periods = harness.__dashboardTest.deliveryPeriods({ planKey: "monthly", created: started.getTime() });

    expect(periods.length).toBeGreaterThan(24);
    expect(periods[0]).toBe(`${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, "0")}`);
    expect(periods.at(-1)).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  });
});
