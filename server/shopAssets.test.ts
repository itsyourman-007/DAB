import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shopHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/shop.html"), "utf8");
const productCdn = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/eYtSqtmuUYwDdBql.png";
const clinicCdn = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/sDZPaVcErKqcgYRO.png";

describe("shop asset delivery", () => {
  it("uses public CDN images and managed storage only for the supplied DAB at work videos", () => {
    expect(shopHtml).toContain(productCdn);
    expect(shopHtml).toContain(clinicCdn);
    expect((shopHtml.match(new RegExp(productCdn, "g")) || []).length).toBeGreaterThanOrEqual(3);
    expect(shopHtml).toContain("/manus-storage/dab-aerosol-without-dab_f581ebad.mp4");
    expect(shopHtml).toContain("/manus-storage/dab-aerosol-with-dab_59b7da34.mp4");
  });

  it("keeps an accessible visible fallback for a future external image failure", () => {
    expect(shopHtml).toContain(".shop-image-frame.image-fallback");
    expect(shopHtml).toContain("91DAB image temporarily unavailable");
    expect(shopHtml).toContain("classList.add('image-fallback')");
  });

  it("replaces the Inside DAB diagram with the requested responsive DAB at work video comparison", () => {
    expect(shopHtml).not.toContain("Three layers. Zero escape.");
    expect(shopHtml).toContain("DAB at work");
    expect(shopHtml).toContain("Aerosol spread without DAB");
    expect(shopHtml).toContain("Aerosol spread with DAB");
    expect(shopHtml).toContain("Blocks 60%");
    expect(shopHtml).toContain("data-dab-work-video");
    expect(shopHtml).toContain("muted playsinline loop preload=\"metadata\"");
    expect(shopHtml).toContain("aspect-ratio:4/3;object-fit:contain");
    expect(shopHtml).toContain("IntersectionObserver");
    expect(shopHtml).toContain("enableDabWorkSound()");
    expect(shopHtml).toContain("video.play().catch");
  });
});
