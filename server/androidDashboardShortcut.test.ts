import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const activitySource = readFileSync(resolve(process.cwd(), "android-dashboard-app/app/src/main/java/com/dantaresearch/dabdashboard/MainActivity.java"), "utf8");

describe("Android dashboard shortcut", () => {
  it("opens the fixed published HTTPS administrator route without a URL-entry setup screen", () => {
    expect(activitySource).toContain('private static final String DASHBOARD_URL = "https://dab-1-cizz.onrender.com/admin"');
    expect(activitySource).toContain("showDashboard();");
    expect(activitySource).toContain("view.loadUrl(DASHBOARD_URL);");
    expect(activitySource).not.toContain("showSiteSetup");
    expect(activitySource).not.toContain("PREF_SITE_URL");
    expect(activitySource).not.toContain("normalizeDashboardUrl");
  });

  it("keeps WebView navigation on the fixed HTTPS dashboard host", () => {
    expect(activitySource).toContain('private static final String DASHBOARD_HOST = "dab-1-cizz.onrender.com"');
    expect(activitySource).toContain('"https".equals(scheme) && DASHBOARD_HOST.equalsIgnoreCase(next.getHost())');
    expect(activitySource).toContain("setAllowFileAccess(false)");
    expect(activitySource).toContain("setAllowContentAccess(false)");
    expect(activitySource).toContain("MIXED_CONTENT_NEVER_ALLOW");
    expect(activitySource).toContain("setMediaPlaybackRequiresUserGesture(false)");
    expect(activitySource).toContain("91DABDashboard/1.1");
    expect(activitySource).toContain("setWebChromeClient(new WebChromeClient())");
    expect(activitySource).toContain("createLaunchPanel()");
    expect(activitySource).toContain("Opening your private merchant console");
    expect(activitySource).toContain("setAlpha(0f)");
  });
});
