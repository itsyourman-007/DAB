import { afterEach, describe, expect, it, vi } from "vitest";
import { sendBuyerFulfillmentConfirmation, sendBuyerPaymentConfirmation } from "./adminOtpMail";
import { subscriptionEmailDetails } from "./routers";

const monthlyOrder = { planKey: "monthly", deliverySpan: "monthly", deliveryStartMonth: "2026-08", quantity: 4 } as const;
const yearlyMonthlyOrder = { planKey: "yearly", deliverySpan: "monthly", deliveryStartMonth: "2026-08", quantity: 1 } as const;
const yearlyTogetherOrder = { planKey: "yearly", deliverySpan: "once", deliveryStartMonth: "2026-11", quantity: 1 } as const;

describe("subscription buyer email content", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses buyer-selected monthly names and 100 DAB pieces per monthly delivery", () => {
    expect(subscriptionEmailDetails(monthlyOrder)).toEqual({
      deliverySchedule: "Selected delivery months: August 2026, September 2026, October 2026, November 2026",
      dabAllocation: "100 DAB pieces per selected month",
    });
  });

  it("uses the selected yearly all-at-once month and 1,500 DAB pieces", () => {
    expect(subscriptionEmailDetails(yearlyTogetherOrder)).toEqual({
      deliverySchedule: "One yearly delivery in November 2026",
      dabAllocation: "1,500 DAB pieces together",
    });
  });

  it("reports the selected yearly delivery month and cumulative 125/1,500 progress", () => {
    expect(subscriptionEmailDetails(yearlyMonthlyOrder, "2026-08")).toMatchObject({
      deliverySchedule: "Selected delivery month: August 2026 (1 of 12)",
      dabAllocation: "125 DAB pieces each month (1,500 total)",
      deliveryProgress: "125/1,500 DAB pieces",
    });
    expect(subscriptionEmailDetails(yearlyMonthlyOrder, "2026-09")).toMatchObject({
      deliverySchedule: "Selected delivery month: September 2026 (2 of 12)",
      deliveryProgress: "250/1,500 DAB pieces",
    });
  });

  it("renders schedule, allocation, and progress details in payment and shipment email payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const monthlyDetails = subscriptionEmailDetails(monthlyOrder);
    await sendBuyerPaymentConfirmation({
      email: "buyer@example.test", name: "Buyer", orderId: "EMAIL-MONTHLY", plan: "Monthly subscription", amount: 3000, paymentMethod: "UPI",
      deliverySchedule: monthlyDetails.deliverySchedule, dabAllocation: monthlyDetails.dabAllocation,
    });
    const yearlyDetails = subscriptionEmailDetails(yearlyMonthlyOrder, "2026-09");
    await sendBuyerFulfillmentConfirmation({
      email: "buyer@example.test", name: "Buyer", orderId: "EMAIL-YEARLY", plan: "Yearly subscription", amount: 36000, quantity: 1, status: "shipped",
      deliverySchedule: yearlyDetails.deliverySchedule, dabAllocation: yearlyDetails.dabAllocation, deliveryProgress: yearlyDetails.deliveryProgress,
    });
    const paymentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const shipmentPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(paymentPayload.html).toContain("100 DAB pieces per selected month");
    expect(paymentPayload.html).toContain("August 2026, September 2026, October 2026, November 2026");
    expect(shipmentPayload.html).toContain("Selected delivery month: September 2026 (2 of 12)");
    expect(shipmentPayload.html).toContain("250/1,500 DAB pieces");
  });
});
