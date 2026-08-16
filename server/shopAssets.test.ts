import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shopHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/shop.html"), "utf8");
const productCdn = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/eYtSqtmuUYwDdBql.png";
const clinicCdn = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/sDZPaVcErKqcgYRO.png";

describe("shop asset delivery", () => {
  it("uses public CDN images, videos, and posters for the DAB at work section", () => {
    expect(shopHtml).toContain(productCdn);
    expect(shopHtml).toContain(clinicCdn);
    expect((shopHtml.match(new RegExp(productCdn, "g")) || []).length).toBeGreaterThanOrEqual(3);
    expect(shopHtml).toContain("https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/YqsaTQLevFFcHTsR.mp4");
    expect(shopHtml).toContain("https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/FMgjVJLPTATTBCiN.mp4");
    expect(shopHtml).toContain("https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/iChqTMKySBBHxBsM.jpg");
    expect(shopHtml).toContain("https://files.manuscdn.com/user_upload_by_module/session_file/310519663882842143/ByVatdvcELbuwUnR.jpg");
    expect(shopHtml).not.toContain("/manus-storage/dab-aerosol");
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
    expect(shopHtml).toContain("autoplay playsinline loop preload=\"auto\"");
    expect(shopHtml).toContain("dab-work-grid{display:grid;grid-template-columns:repeat(2");
    expect(shopHtml).toContain("IntersectionObserver");
    expect(shopHtml).toContain("armDabWorkAudio()");
    expect(shopHtml).not.toContain("dabWorkSoundButton");
    expect(shopHtml).not.toContain("Enable video sound");
    expect(shopHtml).toContain("video.play().catch");
  });
});
