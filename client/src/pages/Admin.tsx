import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import dashboardHtml from "../embedded/dashboard.html?raw";

export default function Admin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityGateOpen, setSecurityGateOpen] = useState(false);
  const [securityGatePassword, setSecurityGatePassword] = useState("");
  const [securityGateError, setSecurityGateError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRecipient, setOtpRecipient] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const status = trpc.admin.status.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const teamMembers = trpc.admin.listTeamMembers.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const teams = trpc.admin.listTeams.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const profile = trpc.admin.profile.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const orders = trpc.admin.listOrders.useQuery(undefined, {
    enabled: Boolean(status.data?.authenticated),
    retry: false,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const inventory = trpc.admin.inventory.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const inventoryAllocations = trpc.admin.inventoryAllocations.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const subscriptionDeliveries = trpc.admin.subscriptionDeliveries.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const quoteClientCustomizations = trpc.admin.quoteClientCustomizations.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const quoteClientLeads = trpc.admin.quoteClientLeads.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false, refetchInterval: 10_000, refetchIntervalInBackground: false });
  const reminderStatus = trpc.admin.subscriptionReminderStatus.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const demoCleanupStatus = trpc.admin.demoOrderCleanupStatus.useQuery(undefined, { enabled: Boolean(status.data?.authenticated), retry: false });
  const employeeAccounts = trpc.admin.listEmployeeAccounts.useQuery(undefined, { enabled: status.data?.role === "admin", retry: false });
  const loginAudits = trpc.admin.loginAudits.useQuery(undefined, { enabled: status.data?.role === "admin", retry: false });
  const login = trpc.admin.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      await utils.admin.status.invalidate();
    },
  });
  const logout = trpc.admin.logout.useMutation({
    onSuccess: async () => {
      setUsername("");
      setPassword("");
      setSettingsOpen(false);
      setSecurityGateOpen(false);
      setSecurityGatePassword("");
      await utils.admin.status.invalidate();
    },
  });
  const verifySecuritySettingsPassword = trpc.admin.verifySecuritySettingsPassword.useMutation({
    onSuccess: () => {
      setSecurityGatePassword("");
      setSecurityGateError(null);
      setSecurityGateOpen(false);
      setSettingsOpen(true);
    },
    onError: (error) => setSecurityGateError(error.message || "The administrator password was not accepted."),
  });
  const requestPasswordChange = trpc.admin.requestPasswordChange.useMutation({
    onSuccess: ({ recipient }) => {
      setOtpRecipient(recipient);
      setSettingsError(null);
    },
    onError: (error) => setSettingsError(error.message || "The security code could not be sent. Verify the configured recipient and email sender, then try again."),
  });
  const confirmPasswordChange = trpc.admin.confirmPasswordChange.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setOtpRecipient(null);
      setSettingsError(null);
      setSettingsOpen(false);
    },
    onError: (error) => setSettingsError(error.message || "The password could not be changed."),
  });
  const paymentConfirmation = trpc.admin.sendPaymentConfirmation.useMutation({
    onSuccess: ({ sent, duplicate }) => {
      if (sent) toast.success("Payment verified — buyer confirmation email sent.", { id: "buyer-confirmation-email" });
      else if (duplicate) toast.info("Payment was verified earlier; the buyer email was already sent.", { id: "buyer-confirmation-email" });
    },
    onError: () => toast.error("Payment was verified, but the buyer confirmation email could not be sent. Use Verify again to retry.", { id: "buyer-confirmation-email" }),
  });
  const createTeamMember = trpc.admin.createTeamMember.useMutation();
  const updateTeamMember = trpc.admin.updateTeamMember.useMutation();
  const removeTeamMember = trpc.admin.removeTeamMember.useMutation();
  const createTeam = trpc.admin.createTeam.useMutation();
  const updateTeam = trpc.admin.updateTeam.useMutation();
  const removeTeam = trpc.admin.removeTeam.useMutation();
  const createEmployeeAccount = trpc.admin.createEmployeeAccount.useMutation();
  const resetEmployeePassword = trpc.admin.resetEmployeePassword.useMutation();
  const removeEmployeeAccount = trpc.admin.removeEmployeeAccount.useMutation();
  const updateProfile = trpc.admin.updateProfile.useMutation();
  const markOrderPaid = trpc.admin.markOrderPaid.useMutation();
  const updateFulfillment = trpc.admin.updateFulfillment.useMutation();
  const resendFulfillmentEmail = trpc.admin.resendFulfillmentEmail.useMutation();
  const setInventory = trpc.admin.setInventory.useMutation();
  const increaseInventory = trpc.admin.increaseInventory.useMutation();
  const setSubscriptionDelivery = trpc.admin.setSubscriptionDelivery.useMutation();
  const createQuoteClientCustomization = trpc.admin.createQuoteClientCustomization.useMutation();
  const updateQuoteClientCustomization = trpc.admin.updateQuoteClientCustomization.useMutation();
  const deleteQuoteClientCustomization = trpc.admin.deleteQuoteClientCustomization.useMutation();
  const updateQuoteClientCustomizationFulfillment = trpc.admin.updateQuoteClientCustomizationFulfillment.useMutation();
  const activateSubscriptionReminders = trpc.admin.activateSubscriptionReminders.useMutation();
  const activateDemoOrderCleanup = trpc.admin.activateDemoOrderCleanup.useMutation();
  const submitSupportRequest = trpc.admin.submitSupportRequest.useMutation();

  useEffect(() => {
    const handleVerifiedPayment = (event: MessageEvent) => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
      if (event.origin !== window.location.origin || event.source !== iframe?.contentWindow || event.data?.type !== "91dab-payment-verified") return;
      toast.loading("Verifying payment and sending the buyer confirmation email…", { id: "buyer-confirmation-email" });
      paymentConfirmation.mutate(event.data.order, {
        onSuccess: ({ sent, duplicate }) => {
          iframe?.contentWindow?.postMessage({
            type: "91dab-email-result",
            orderId: event.data.order.orderId,
            success: sent,
            duplicate,
          }, window.location.origin);
        },
        onError: () => {
          iframe?.contentWindow?.postMessage({
            type: "91dab-email-result",
            orderId: event.data.order.orderId,
            success: false,
            duplicate: false,
          }, window.location.origin);
        },
      });
    };
    window.addEventListener("message", handleVerifiedPayment);
    return () => window.removeEventListener("message", handleVerifiedPayment);
  }, [paymentConfirmation]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-team-members", members: teamMembers.data ?? [] }, window.location.origin);
  }, [teamMembers.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-teams", teams: teams.data ?? [] }, window.location.origin);
  }, [teams.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-dashboard-profile", profile: profile.data ?? null }, window.location.origin);
  }, [profile.data]);

  useEffect(() => {
    if (orders.data === undefined) return;
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-server-orders", orders: orders.data }, window.location.origin);
  }, [orders.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    const status = orders.isError ? "offline" : orders.data !== undefined ? "online" : "connecting";
    iframe?.contentWindow?.postMessage({
      type: "91dab-live-store-monitor",
      monitor: { status, lastSyncedAt: orders.dataUpdatedAt || null },
    }, window.location.origin);
  }, [orders.data, orders.dataUpdatedAt, orders.isError]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-inventory", inventory: inventory.data ?? null }, window.location.origin);
  }, [inventory.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-inventory-allocations", allocations: inventoryAllocations.data ?? [] }, window.location.origin);
  }, [inventoryAllocations.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-subscription-deliveries", deliveries: subscriptionDeliveries.data ?? [] }, window.location.origin);
  }, [subscriptionDeliveries.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-quote-client-customizations", customizations: quoteClientCustomizations.data ?? [] }, window.location.origin);
  }, [quoteClientCustomizations.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-quote-client-leads", leads: quoteClientLeads.data ?? [] }, window.location.origin);
  }, [quoteClientLeads.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-reminder-status", reminder: reminderStatus.data ?? null }, window.location.origin);
  }, [reminderStatus.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-demo-cleanup-status", cleanup: demoCleanupStatus.data ?? null }, window.location.origin);
  }, [demoCleanupStatus.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-employee-accounts", accounts: employeeAccounts.data ?? [] }, window.location.origin);
  }, [employeeAccounts.data]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-dashboard-role", role: status.data?.role ?? null }, window.location.origin);
  }, [status.data?.role]);

  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
    iframe?.contentWindow?.postMessage({ type: "91dab-login-audits", audits: loginAudits.data ?? [] }, window.location.origin);
  }, [loginAudits.data]);

  useEffect(() => {
    const handleEmbeddedDashboardAction = (event: MessageEvent) => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="91DAB merchant dashboard"]');
      if (event.origin !== window.location.origin || event.source !== iframe?.contentWindow || !event.data?.type) return;
      const respond = (payload: Record<string, unknown>) => iframe?.contentWindow?.postMessage(payload, window.location.origin);
      if (event.data.type === "91dab-team-add") {
        createTeamMember.mutate(event.data.member, {
          onSuccess: (members) => respond({ type: "91dab-team-result", action: "add", success: true, members }),
          onError: (error) => respond({ type: "91dab-team-result", action: "add", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-team-remove") {
        removeTeamMember.mutate(event.data.member, {
          onSuccess: (members) => respond({ type: "91dab-team-result", action: "remove", success: true, members }),
          onError: (error) => respond({ type: "91dab-team-result", action: "remove", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-team-edit") {
        updateTeamMember.mutate(event.data.member, {
          onSuccess: (members) => respond({ type: "91dab-team-result", action: "edit", success: true, members }),
          onError: (error) => respond({ type: "91dab-team-result", action: "edit", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-team-create") {
        createTeam.mutate(event.data.team, {
          onSuccess: (nextTeams) => respond({ type: "91dab-team-directory-result", action: "create", success: true, teams: nextTeams }),
          onError: (error) => respond({ type: "91dab-team-directory-result", action: "create", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-team-rename") {
        updateTeam.mutate(event.data.team, {
          onSuccess: ({ teams: nextTeams, members }) => respond({ type: "91dab-team-directory-result", action: "rename", success: true, teams: nextTeams, members }),
          onError: (error) => respond({ type: "91dab-team-directory-result", action: "rename", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-team-delete") {
        removeTeam.mutate(event.data.team, {
          onSuccess: (nextTeams) => respond({ type: "91dab-team-directory-result", action: "delete", success: true, teams: nextTeams }),
          onError: (error) => respond({ type: "91dab-team-directory-result", action: "delete", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-employee-account-create") {
        createEmployeeAccount.mutate(event.data.account, {
          onSuccess: (accounts) => respond({ type: "91dab-employee-account-result", action: "create", success: true, accounts }),
          onError: (error) => respond({ type: "91dab-employee-account-result", action: "create", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-employee-account-reset") {
        resetEmployeePassword.mutate(event.data.account, {
          onSuccess: (accounts) => respond({ type: "91dab-employee-account-result", action: "reset", success: true, accounts }),
          onError: (error) => respond({ type: "91dab-employee-account-result", action: "reset", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-employee-account-remove") {
        removeEmployeeAccount.mutate(event.data.account, {
          onSuccess: (accounts) => respond({ type: "91dab-employee-account-result", action: "remove", success: true, accounts }),
          onError: (error) => respond({ type: "91dab-employee-account-result", action: "remove", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-dashboard-profile-save") {
        updateProfile.mutate(event.data.profile, {
          onSuccess: (savedProfile) => respond({ type: "91dab-dashboard-profile-result", success: true, profile: savedProfile }),
          onError: (error) => respond({ type: "91dab-dashboard-profile-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-mark-paid") {
        markOrderPaid.mutate({ orderId: event.data.orderId }, {
          onSuccess: async ({ order, email, inventory: nextInventory }) => {
            await utils.admin.listOrders.invalidate();
            await utils.admin.inventory.invalidate();
            respond({ type: "91dab-mark-paid-result", success: true, order, email, inventory: nextInventory });
          },
          onError: (error) => respond({ type: "91dab-mark-paid-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-fulfillment-update") {
        updateFulfillment.mutate(event.data.fulfillment, {
          onSuccess: async ({ order, email, inventory: nextInventory }) => {
            await utils.admin.listOrders.invalidate();
            await utils.admin.inventory.invalidate();
            await utils.admin.inventoryAllocations.invalidate();
            respond({ type: "91dab-fulfillment-result", success: true, order, email, inventory: nextInventory });
          },
          onError: (error) => respond({ type: "91dab-fulfillment-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-fulfillment-email-retry") {
        resendFulfillmentEmail.mutate(event.data.fulfillment, {
          onSuccess: ({ order, email }) => respond({ type: "91dab-fulfillment-email-result", success: true, order, email }),
          onError: (error) => respond({ type: "91dab-fulfillment-email-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-inventory-save") {
        setInventory.mutate(event.data.inventory, {
          onSuccess: (nextInventory) => respond({ type: "91dab-inventory-result", success: true, inventory: nextInventory }),
          onError: (error) => respond({ type: "91dab-inventory-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-inventory-increase") {
        increaseInventory.mutate(event.data.inventory, {
          onSuccess: async (nextInventory) => {
            await utils.admin.inventory.invalidate();
            respond({ type: "91dab-inventory-increase-result", success: true, inventory: nextInventory });
          },
          onError: (error) => respond({ type: "91dab-inventory-increase-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-subscription-delivery-save") {
        setSubscriptionDelivery.mutate(event.data.delivery, {
          onSuccess: async (result) => {
            await utils.admin.subscriptionDeliveries.invalidate();
            await utils.admin.inventory.invalidate();
            await utils.admin.inventoryAllocations.invalidate();
            respond({ type: "91dab-subscription-delivery-result", success: true, deliveries: result.deliveries, inventory: result.inventory, shipment: result.shipment });
          },
          onError: (error) => respond({ type: "91dab-subscription-delivery-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-quote-client-customization-create") {
        createQuoteClientCustomization.mutate(event.data.customization, {
          onSuccess: async (customizations) => {
            await utils.admin.quoteClientCustomizations.invalidate();
            respond({ type: "91dab-quote-client-customization-result", success: true, customizations });
          },
          onError: (error) => respond({ type: "91dab-quote-client-customization-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-quote-client-customization-update") {
        updateQuoteClientCustomization.mutate(event.data.customization, {
          onSuccess: async (customizations) => {
            await utils.admin.quoteClientCustomizations.invalidate();
            respond({ type: "91dab-quote-client-customization-result", success: true, action: "update", customizations });
          },
          onError: (error) => respond({ type: "91dab-quote-client-customization-result", success: false, action: "update", message: error.message }),
        });
      }
      if (event.data.type === "91dab-quote-client-customization-delete") {
        deleteQuoteClientCustomization.mutate(event.data.customization, {
          onSuccess: async (customizations) => {
            await utils.admin.quoteClientCustomizations.invalidate();
            respond({ type: "91dab-quote-client-customization-result", success: true, action: "delete", customizations });
          },
          onError: (error) => respond({ type: "91dab-quote-client-customization-result", success: false, action: "delete", message: error.message }),
        });
      }
      if (event.data.type === "91dab-quote-client-customization-fulfillment") {
        updateQuoteClientCustomizationFulfillment.mutate(event.data.customization, {
          onSuccess: async ({ customization, customizations, inventory }) => {
            await Promise.all([utils.admin.quoteClientCustomizations.invalidate(), utils.admin.inventory.invalidate(), utils.admin.inventoryAllocations.invalidate()]);
            respond({ type: "91dab-quote-client-customization-fulfillment-result", success: true, customization, customizations, inventory });
          },
          onError: (error) => respond({ type: "91dab-quote-client-customization-fulfillment-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-reminder-activate") {
        activateSubscriptionReminders.mutate(undefined, {
          onSuccess: async (reminder) => {
            await utils.admin.subscriptionReminderStatus.invalidate();
            respond({ type: "91dab-reminder-activation-result", success: true, reminder });
          },
          onError: (error) => respond({ type: "91dab-reminder-activation-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-demo-cleanup-activate") {
        activateDemoOrderCleanup.mutate(undefined, {
          onSuccess: async (cleanup) => {
            await utils.admin.demoOrderCleanupStatus.invalidate();
            respond({ type: "91dab-demo-cleanup-activation-result", success: true, cleanup });
          },
          onError: (error) => respond({ type: "91dab-demo-cleanup-activation-result", success: false, message: error.message }),
        });
      }
      if (event.data.type === "91dab-support-request") {
        submitSupportRequest.mutate(event.data.request, {
          onSuccess: () => respond({ type: "91dab-support-result", success: true }),
          onError: (error) => respond({ type: "91dab-support-result", success: false, message: error.message }),
        });
      }
    };
    window.addEventListener("message", handleEmbeddedDashboardAction);
    return () => window.removeEventListener("message", handleEmbeddedDashboardAction);
  }, [createTeamMember, updateTeamMember, removeTeamMember, createTeam, updateTeam, removeTeam, createEmployeeAccount, resetEmployeePassword, removeEmployeeAccount, updateProfile, markOrderPaid, updateFulfillment, resendFulfillmentEmail, setInventory, increaseInventory, setSubscriptionDelivery, createQuoteClientCustomization, updateQuoteClientCustomization, deleteQuoteClientCustomization, updateQuoteClientCustomizationFulfillment, activateSubscriptionReminders, activateDemoOrderCleanup, submitSupportRequest, utils]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username, password });
  };
  const openSecurityGate = () => {
    setSecurityGatePassword("");
    setSecurityGateError(null);
    setSecurityGateOpen(true);
  };
  const confirmSecuritySettingsAccess = (event: FormEvent) => {
    event.preventDefault();
    setSecurityGateError(null);
    verifySecuritySettingsPassword.mutate({ password: securityGatePassword });
  };
  const requestOtp = () => requestPasswordChange.mutate();
  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setSettingsError("The new-password entries do not match.");
      return;
    }
    setSettingsError(null);
    confirmPasswordChange.mutate({ currentPassword, newPassword, otp });
  };

  if (status.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-300">Checking administrator access…</div>;
  }

  if (!status.data?.authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,_#7c3aed_0%,_#111827_44%,_#020617_100%)] px-4 py-10 text-white">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-7 shadow-2xl backdrop-blur sm:p-9">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-300">Private access</p>
          <h1 className="text-3xl font-semibold tracking-tight">91DAB merchant dashboard</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Enter your authorized username or email and password to view live customer, subscription, quote, and payment records.</p>
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-slate-200">Username / email</Label>
              <Input id="admin-username" type="email" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} required className="border-white/15 bg-white/5 text-white placeholder:text-slate-500" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-100">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                className="h-11 border-white/15 bg-white/5 text-white placeholder:text-slate-500"
                required
              />
            </div>
            {login.error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">The password was not accepted. Please try again.</p> : null}
            <Button className="h-11 w-full bg-violet-500 text-white hover:bg-violet-400" disabled={login.isPending} type="submit">
              {login.isPending ? "Checking access…" : "Open dashboard"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-400">Protected server-side. The password is not included in browser code.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm">91</span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-slate-950">91DAB</span>
            <span className="block text-xs text-slate-500">Private merchant console</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status.data?.role === "admin" ? (
            <Button variant="outline" size="sm" onClick={openSecurityGate}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Security settings
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="h-[calc(100vh-64px)]">
        <iframe
          title="91DAB merchant dashboard"
          srcDoc={dashboardHtml}
          onLoad={(event) => {
            try {
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-team-members", members: teamMembers.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-teams", teams: teams.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-dashboard-profile", profile: profile.data ?? null }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-employee-accounts", accounts: employeeAccounts.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-login-audits", audits: loginAudits.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-dashboard-role", role: status.data?.role ?? null }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-live-store-monitor", monitor: { status: orders.isError ? "offline" : orders.data !== undefined ? "online" : "connecting", lastSyncedAt: orders.dataUpdatedAt || null } }, window.location.origin);
              if (orders.data !== undefined) event.currentTarget.contentWindow?.postMessage({ type: "91dab-server-orders", orders: orders.data }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-inventory", inventory: inventory.data ?? null }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-subscription-deliveries", deliveries: subscriptionDeliveries.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-quote-client-customizations", customizations: quoteClientCustomizations.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-quote-client-leads", leads: quoteClientLeads.data ?? [] }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-reminder-status", reminder: reminderStatus.data ?? null }, window.location.origin);
              event.currentTarget.contentWindow?.postMessage({ type: "91dab-demo-cleanup-status", cleanup: demoCleanupStatus.data ?? null }, window.location.origin);
            } catch {
              // The embedded dashboard's own initial hydration remains available.
            }
          }}
          className="h-full w-full border-0 bg-white"
        />
      </main>
      {securityGateOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="security-confirm-title">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Protected action</p>
                <h2 id="security-confirm-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Confirm administrator password</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Re-enter the administrator password before opening Security Settings.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSecurityGateOpen(false)} disabled={verifySecuritySettingsPassword.isPending}>Close</Button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={confirmSecuritySettingsAccess}>
              <div className="space-y-2">
                <Label htmlFor="security-gate-password">Administrator password</Label>
                <Input id="security-gate-password" type="password" autoComplete="current-password" value={securityGatePassword} onChange={(event) => setSecurityGatePassword(event.target.value)} placeholder="Enter password" required />
              </div>
              {securityGateError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{securityGateError}</p> : null}
              <Button className="w-full bg-violet-600 text-white hover:bg-violet-700" type="submit" disabled={verifySecuritySettingsPassword.isPending}>
                {verifySecuritySettingsPassword.isPending ? "Confirming…" : "Open Security Settings"}
              </Button>
            </form>
          </section>
        </div>
      ) : null}
      {settingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="security-settings-title">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Administrator security</p>
                <h2 id="security-settings-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Change dashboard password</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">A six-digit confirmation code is sent only to the email address configured for administrator security. Codes expire after 10 minutes.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)}>Close</Button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={changePassword}>
              <div className="space-y-2">
                <Label htmlFor="current-admin-password">Current password</Label>
                <Input id="current-admin-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-admin-password">New password</Label>
                  <Input id="new-admin-password" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-admin-password">Confirm new password</Label>
                  <Input id="confirm-admin-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Email confirmation code</p>
                    <p className="mt-0.5 text-xs text-slate-500">{otpRecipient ? `Code sent to ${otpRecipient}` : "Request a code before confirming the password change."}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={requestOtp} disabled={requestPasswordChange.isPending}>
                    {requestPasswordChange.isPending ? "Sending…" : otpRecipient ? "Send new code" : "Email code"}
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  <Label htmlFor="admin-otp">Six-digit code</Label>
                  <Input id="admin-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} required />
                </div>
              </div>
              {settingsError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{settingsError}</p> : null}
              <Button className="w-full bg-violet-600 text-white hover:bg-violet-700" type="submit" disabled={confirmPasswordChange.isPending || !otpRecipient}>
                {confirmPasswordChange.isPending ? "Updating password…" : "Confirm and change password"}
              </Button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
