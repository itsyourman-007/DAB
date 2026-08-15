import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const activitySource = readFileSync(resolve(process.cwd(), "android-dashboard-app/app/src/main/java/com/dantaresearch/dabdashboard/MainActivity.java"), "utf8");
const manifestSource = readFileSync(resolve(process.cwd(), "android-dashboard-app/app/src/main/AndroidManifest.xml"), "utf8");
const buildScript = readFileSync(resolve(process.cwd(), "android-dashboard-app/build-apk.sh"), "utf8");

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

  it("uses the supplied 91 DANTA artwork unchanged for the launcher and launch screen", () => {
    expect(existsSync(resolve(process.cwd(), "android-dashboard-app/app/src/main/res/drawable-nodpi/danta_logo.png"))).toBe(true);
    expect(manifestSource).toContain('android:icon="@drawable/danta_logo"');
    expect(manifestSource).toContain('android:roundIcon="@drawable/danta_logo"');
    expect(activitySource).toContain("R.drawable.danta_logo");
    expect(activitySource).toContain('logo.setContentDescription("91 DANTA logo")');
    expect(activitySource).not.toContain('mark.setText("91\\nDAB")');
    expect(buildScript).toContain('--java "$OUT/gen"');
    expect(buildScript).toContain('"$OUT/gen/com/dantaresearch/dabdashboard/R.java"');
  });
});
