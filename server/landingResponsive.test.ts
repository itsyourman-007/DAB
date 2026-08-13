import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const landingHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/index.html"), "utf8");

describe("landing page phone layout", () => {
  it("contains mobile overflow protection and a contained two-row navigation", () => {
    expect(landingHtml).toContain("html,body{width:100%;max-width:100%;overflow-x:clip;}");
    expect(landingHtml).toContain("grid-template-columns:minmax(0,1fr) auto");
    expect(landingHtml).toContain("overflow-wrap:anywhere");
  });

  it("keeps hero actions readable, one per row, and within the phone viewport", () => {
    expect(landingHtml).toContain(".hero-inner,.hero-inner>*{min-width:0;}");
    expect(landingHtml).toContain(".hero-actions{display:grid;grid-template-columns:1fr");
    expect(landingHtml).toContain(".hero-actions .btn{width:100%;max-width:100%;min-width:0");
    expect(landingHtml).toContain(".hero-actions .btn.gold{color:#1c1305;}");
    expect(landingHtml).toContain(".hero-actions .btn.solid{color:var(--cream);}");
  });

  it("keeps ticker, long content, and cookie controls contained on phone screens", () => {
    expect(landingHtml).toContain(".ticker{width:100%;min-width:0;margin:1.25rem 0;mask-image:none;-webkit-mask-image:none;}");
    expect(landingHtml).toContain(".article figure.inline-fig{float:none;max-width:100%");
    expect(landingHtml).toContain("max-height:calc(100svh - 1.5rem);overflow-y:auto");
  });
});
