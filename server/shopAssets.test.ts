import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shopHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/shop.html"), "utf8");
const productCdn = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/eYtSqtmuUYwDdBql.png";
const clinicCdn = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/sDZPaVcErKqcgYRO.png";

describe("shop image delivery", () => {
  it("uses public CDN assets instead of the Manus runtime storage proxy", () => {
    expect(shopHtml).not.toContain("/manus-storage/");
    expect(shopHtml).toContain(productCdn);
    expect(shopHtml).toContain(clinicCdn);
    expect((shopHtml.match(new RegExp(productCdn, "g")) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps an accessible visible fallback for a future external image failure", () => {
    expect(shopHtml).toContain(".shop-image-frame.image-fallback");
    expect(shopHtml).toContain("91DAB image temporarily unavailable");
    expect(shopHtml).toContain("classList.add('image-fallback')");
  });
});
