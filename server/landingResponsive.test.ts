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

  it("keeps top navigation and journal article controls as reliable in-page links", () => {
    ["verticals", "dream", "recognition", "journal", "contact", "article-importance", "article-dental-aerosol"].forEach((id) => {
      expect(landingHtml).toContain(`id="${id}"`);
    });
    expect(landingHtml).toContain('id="sectionNav"');
    expect(landingHtml).toContain('id="navToggle"');
    expect(landingHtml).toContain('href="#article-importance">Dentist</a>');
    expect(landingHtml).toContain('class="post-card" href="#article-importance"');
    expect(landingHtml).toContain('class="post-card" href="#article-dental-aerosol"');
    expect(landingHtml).toContain("document.querySelectorAll('a[href^=\"#\"]')");
    expect(landingHtml).toContain("target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })");
    expect(landingHtml).toContain("history.replaceState(null, '', link.getAttribute('href'))");
  });

  it("provides an accessible phone menu instead of hiding the section links without a replacement", () => {
    expect(landingHtml).toContain('.nav-toggle{display:none;');
    expect(landingHtml).toContain('.nav-links.is-open{display:grid;gap:0;}');
    expect(landingHtml).toContain("navToggle.setAttribute('aria-expanded', String(open))");
    expect(landingHtml).toContain('aria-controls="sectionNav"');
  });

  it("does not leave unresolved in-page links or native landing-page buttons without behavior", () => {
    const fragmentTargets = [...landingHtml.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    expect(fragmentTargets.length).toBeGreaterThan(0);
    fragmentTargets.forEach((target) => expect(landingHtml).toContain(`id="${target}"`));
    expect(landingHtml).not.toContain('href="#"');
    expect(landingHtml).toContain("navToggle.addEventListener('click'");
    expect(landingHtml).toContain("cookieAccept.addEventListener('click'");
    expect(landingHtml).toContain("cookieReject.addEventListener('click'");
  });
});
