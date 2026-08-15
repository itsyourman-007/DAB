import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardHtml = readFileSync(resolve(process.cwd(), "client/src/embedded/dashboard.html"), "utf8");
const adminSource = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("dashboard notification sound", () => {
  it("starts muted and exposes accessible live-bell, volume, and test controls", () => {
    expect(dashboardHtml).toContain("const NOTIFICATION_SOUND_KEY = '91dab_notification_sound_enabled'");
    expect(dashboardHtml).toContain("let notificationSoundEnabled = localStorage.getItem(NOTIFICATION_SOUND_KEY) === 'true'");
    expect(dashboardHtml).toContain('id="notificationSoundSwitch"');
    expect(dashboardHtml).toContain('aria-pressed="false"');
    expect(dashboardHtml).toContain("async function toggleNotificationSound()");
    expect(dashboardHtml).toContain("const NOTIFICATION_SOUND_VOLUME_KEY = '91dab_notification_sound_volume'");
    expect(dashboardHtml).toContain('id="notificationSoundVolume"');
    expect(dashboardHtml).toContain("function setNotificationSoundVolume(value)");
    expect(dashboardHtml).toContain("async function testNotificationBell()");
    expect(dashboardHtml).toContain("async function enableNativeAppNotificationAudio()");
    expect(dashboardHtml).toContain("91dab-native-app-audio");
    expect(adminSource).toContain("91DABDashboard\\/\\d");
    expect(adminSource).toContain('type: "91dab-native-app-audio"');
  });

  it("creates an audible browser-native two-ring bell only after the enabled sound context is running", () => {
    expect(dashboardHtml).toContain("async function prepareNotificationAudio()");
    expect(dashboardHtml).toContain("function playNotificationChime()");
    expect(dashboardHtml).toContain("if(!notificationSoundEnabled||!notificationAudioContext||notificationAudioContext.state!=='running') return false");
    expect(dashboardHtml).toContain("[0,.42].forEach");
    expect(dashboardHtml).toContain("[659.25,1318.51,1975.53].forEach");
    expect(dashboardHtml).toContain(".11*notificationSoundVolume");
  });

  it("uses a distinct rocket-style sound only when a genuinely new trusted checkout reaches the payment QR stage", () => {
    expect(dashboardHtml).toContain("function playNewOrderRocketSound()");
    expect(dashboardHtml).toContain("oscillator.type='sawtooth'");
    expect(dashboardHtml).toContain("oscillator.frequency.exponentialRampToValueAtTime(980,now+.27)");
    expect(dashboardHtml).toContain("function notifyReceivedUpdate(title,text,sound='chime')");
    expect(dashboardHtml).toContain("sound==='rocket'?playNewOrderRocketSound():playNotificationChime()");
    expect(dashboardHtml).toContain("const reachedPaymentQr=record.paymentStatus==='pending'");
    expect(dashboardHtml).toContain("Buyer reached payment QR");
    expect(dashboardHtml).toContain("reachedPaymentQr?'rocket':'chime'");
    expect(dashboardHtml).toContain("const previousStates=new Set(serverOrderRecords.map(record=>`${record.orderId}:${record.paymentStatus}`))");
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

  it("opens the live notification bell reliably and keeps the control accessible", () => {
    expect(dashboardHtml).toContain('id="notificationBellButton"');
    expect(dashboardHtml).toContain('aria-controls="notifDd"');
    expect(dashboardHtml).toContain('role="region" aria-label="Live notifications"');
    expect(dashboardHtml).toContain("function toggleNotifDd(){");
    expect(dashboardHtml).toContain("bell.setAttribute('aria-expanded',String(opening))");
  });
});
