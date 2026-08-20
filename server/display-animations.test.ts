import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const landing = readFileSync(resolve(projectRoot, "client/src/embedded/index.html"), "utf8");
const shop = readFileSync(resolve(projectRoot, "client/src/embedded/shop.html"), "utf8");
const dashboard = readFileSync(resolve(projectRoot, "client/src/embedded/dashboard.html"), "utf8");

describe("display animation integration", () => {
  it("adds the supplied text-roll pattern to the landing, shop, and dashboard display surfaces", () => {
    expect(landing).toContain('data-text-roll tabindex="0">Aerosol Hygiene');
    expect(shop).toContain('data-text-roll tabindex="0">aerosol');
    expect(dashboard).toContain('data-text-roll tabindex="0">Dashboard');

    for (const source of [landing, shop, dashboard]) {
      expect(source).toContain(".text-roll-char");
      expect(source).toContain("prepareTextRoll");
      expect(source).toContain("prefers-reduced-motion: reduce");
    }
  });

  it("adds in-view numeric motion only to factual display values", () => {
    expect(landing).toContain('data-count-to="247"');
    expect(landing).toContain('data-count-to="4000"');
    expect(shop).toContain('data-count-to="60" data-count-suffix="%"');
    expect(shop).toContain("IntersectionObserver");

    expect(dashboard).toContain("function animateDashboardMetric");
    expect(dashboard).toContain("animateDashboardMetric('statRevenue',revenue,{prefix:'₹'});");
    expect(dashboard).toContain("animateDashboardMetric('statUsers',customers);");
    expect(dashboard).toContain("animateDashboardMetric('statOrders',commercialEntries);");
    expect(dashboard).toContain("animateDashboardMetric('statConv',commercialEntries ? (confirmedSales/commercialEntries)*100 : 0,{suffix:'%',decimals:2});");
  });

  it("does not add an unnecessary Number Flow dependency to the application", () => {
    expect(landing).not.toContain("@number-flow/react");
    expect(shop).not.toContain("@number-flow/react");
    expect(dashboard).not.toContain("@number-flow/react");
  });
});
