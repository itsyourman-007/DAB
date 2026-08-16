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

  it("creates a browser-native bell only after the enabled sound context is running", () => {
    expect(dashboardHtml).toContain("async function prepareNotificationAudio()");
    expect(dashboardHtml).toContain("function playNotificationBell()");
    expect(dashboardHtml).toContain("if(!notificationSoundEnabled||!notificationAudioContext||notificationAudioContext.state!=='running') return false");
    expect(dashboardHtml).toContain("[740,1110].forEach");
  });

  it("rings the bell exactly five times for each genuinely new online-store notification", () => {
    expect(dashboardHtml).toContain("const NOTIFICATION_BELL_COUNT = 5");
    expect(dashboardHtml).toContain("const NOTIFICATION_BELL_INTERVAL_MS = 420");
    expect(dashboardHtml).toContain("function playNotificationBellFiveTimes()");
    expect(dashboardHtml).toContain("for(let ring=0;ring<NOTIFICATION_BELL_COUNT;ring++) setTimeout(()=>playNotificationBell(),ring*NOTIFICATION_BELL_INTERVAL_MS)");
    expect(dashboardHtml).toContain("function notifyReceivedUpdate(title,text)");
    expect(dashboardHtml).toContain("renderNotifications(); playNotificationBellFiveTimes()");
    expect(dashboardHtml).toContain("['pending','utr_submitted','paid'].includes(record?.paymentStatus)");
    expect(dashboardHtml).toContain("record.paymentStatus==='paid'?'Payment confirmed'");
  });

  it("centers the notification dropdown on phone widths without changing the desktop placement", () => {
    expect(dashboardHtml).toContain('.topbar > .top-actions > div:has(> #notifDd){position:static!important;}');
    expect(dashboardHtml).toContain('left:50%;right:auto;transform:translateX(-50%)');
    expect(dashboardHtml).toContain('width:min(360px,calc(100vw - 2rem))');
  });

  it("never chimes for the initial order hydration and only tracks trusted incoming order states or live-message events", () => {
    expect(dashboardHtml).toContain("let serverOrdersInitialized = false");
    expect(dashboardHtml).toContain("const receivedAlerts=serverOrdersInitialized?nextRecords.filter(record=>!previousStates.has(`${record.orderId}:${record.paymentStatus}`))");
    expect(dashboardHtml).toContain("serverOrdersInitialized=true");
    expect(dashboardHtml).toContain("function applyTrustedLiveMessage(message)");
    expect(dashboardHtml).toContain("if(data.type==='91dab-live-message'){ applyTrustedLiveMessage(data.message); }");
    expect(adminSource).toContain("if (orders.data === undefined) return;");
    expect(adminSource).toContain("if (orders.data !== undefined) event.currentTarget.contentWindow?.postMessage({ type: \"91dab-server-orders\"");
  });
});
