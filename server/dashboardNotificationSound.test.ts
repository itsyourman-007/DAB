import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/dashboard.html"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("dashboard notification sound", () => {
  it("starts muted and exposes an accessible user-controlled sound switch", () => {
    expect(dashboardHtml).toContain("const NOTIFICATION_SOUND_KEY = '91dab_notification_sound_enabled'");
    expect(dashboardHtml).toContain("let notificationSoundEnabled = localStorage.getItem(NOTIFICATION_SOUND_KEY) === 'true'");
    expect(dashboardHtml).toContain('id="notificationSoundSwitch"');
    expect(dashboardHtml).toContain('aria-pressed="false"');
    expect(dashboardHtml).toContain("async function toggleNotificationSound()");
  });

  it("creates a small browser-native chime only after the enabled sound context is running", () => {
    expect(dashboardHtml).toContain("async function prepareNotificationAudio()");
    expect(dashboardHtml).toContain("function playNotificationChime()");
    expect(dashboardHtml).toContain("if(!notificationSoundEnabled||!notificationAudioContext||notificationAudioContext.state!=='running') return false");
    expect(dashboardHtml).toContain("[880,1320].forEach");
  });

  it("uses a distinct rocket-style sound only for genuinely new trusted checkout orders", () => {
    expect(dashboardHtml).toContain("function playNewOrderRocketSound()");
    expect(dashboardHtml).toContain("oscillator.type='sawtooth'");
    expect(dashboardHtml).toContain("oscillator.frequency.exponentialRampToValueAtTime(980,now+.27)");
    expect(dashboardHtml).toContain("function notifyReceivedUpdate(title,text,sound='chime')");
    expect(dashboardHtml).toContain("sound==='rocket'?playNewOrderRocketSound():playNotificationChime()");
    expect(dashboardHtml).toContain("isNewCheckout?'rocket':'chime'");
  });

  it("never chimes for the initial order hydration and only tracks trusted incoming order states or live-message events", () => {
    expect(dashboardHtml).toContain("let serverOrdersInitialized = false");
    expect(dashboardHtml).toContain("const receivedAlerts=serverOrdersInitialized?nextRecords.filter");
    expect(dashboardHtml).toContain("serverOrdersInitialized=true");
    expect(dashboardHtml).toContain("function applyTrustedLiveMessage(message)");
    expect(dashboardHtml).toContain("if(data.type==='91dab-live-message'){ applyTrustedLiveMessage(data.message); }");
    expect(adminSource).toContain("if (orders.data === undefined) return;");
    expect(adminSource).toContain("if (orders.data !== undefined) event.currentTarget.contentWindow?.postMessage({ type: \"91dab-server-orders\"");
  });
});
