# Deploying 91DAB on Render

This project is ready to deploy from the GitHub repository at [itsyourman-007/DAB](https://github.com/itsyourman-007/DAB). It is a **full-stack Node.js web service**, not a static site: the website serves the shop, protected dashboard, checkout QR generation, order persistence, and email actions from one running service.

> **Important:** The application uses Drizzle with `mysql2`, so `DATABASE_URL` must point to a reachable **MySQL-compatible database**. Do **not** connect a Render Postgres database to this version of the app. A managed MySQL-compatible provider such as TiDB Cloud is appropriate.

## 1. Create the Render service

1. Sign in to [Render](https://dashboard.render.com/), select **New → Blueprint**, and connect GitHub if Render asks you to do so.
2. Select `itsyourman-007/DAB` and the `main` branch. Render detects `render.yaml` and preconfigures the service as `91dab-store`.
3. Confirm the generated commands without changing them:

| Setting | Value |
|---|---|
| Service type | Web Service |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start` |
| Health-check path | `/` |
| Runtime | Node |
| Auto-deploy | **On Commit** on the `main` branch |

Render automatically deploys a linked Git branch when changes are pushed, and a failed build leaves the most recent successful version running. [1]

## 2. Add environment variables

Open the Render service, choose **Environment**, add the entries below, and select **Save, rebuild, and deploy**. Never put these values in GitHub files, `shop.html`, or browser JavaScript. Render’s environment-variable panel is designed to keep credentials out of source control. [2]

| Variable | Required | What to enter |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | A new random string of at least 32 characters. Render can generate this through the Blueprint. Keep it private; changing it signs out active dashboard sessions. |
| `ADMIN_DASHBOARD_PASSWORD` | Yes | Your private administrator dashboard password. |
| `DATABASE_URL` | Yes | The full **MySQL-compatible** connection URL from your database provider, with TLS enabled where the provider requires it. |
| `MERCHANT_VPA` | Yes | The receiving UPI ID, for example `business@bank`. It is used only on the server to make payment QR codes. |
| `MERCHANT_NAME` | Recommended | `91DAB` or your preferred UPI recipient name. |
| `RESEND_API_KEY` | Yes for OTP and buyer emails | A Resend API key created in the Resend dashboard. |
| `ADMIN_OTP_RECIPIENT_EMAIL` | Yes | `dantaresearch@gmail.com` or the exact email that must receive administrator password-change codes. |
| `ADMIN_OTP_FROM_EMAIL` | Yes | A sender at a Resend-verified domain, for example `91DAB <orders@yourdomain.com>`. |
| `PUBLIC_SITE_URL` | Recommended | Your final canonical URL, for example `https://yourdomain.com`. It adds the website link to buyer emails. |
| `EMAIL_BRAND_LOGO_URL` | Optional | A public HTTPS URL for the 91DAB logo used in payment-confirmation emails. |

The `MERCHANT_VPA` can be changed later in **Render → service → Environment → `MERCHANT_VPA` → Save, rebuild, and deploy**. The next deployed checkout uses the new QR recipient; no code change is needed.

## 3. Configure Resend before accepting real orders

Resend powers administrator password-change OTPs, payment confirmations, and the new Shipped/Delivered buyer emails. In [Resend Domains](https://resend.com/domains), add a domain or subdomain you control, then place the exact DNS records Resend shows in your domain provider. Wait until the domain displays **Verified** before using it as `ADMIN_OTP_FROM_EMAIL`.

Use a sender such as `91DAB <orders@yourdomain.com>`. The same verified sender supports all site emails. A buyer receives an email after payment verification and again after a staff member marks an order **Shipped** or **Delivered**. The app stores a per-order, per-status dispatch record so a status email is not duplicated; if Resend has a temporary error, the Delivery Tracking screen exposes a retry action.

## 4. Use your own domain

After the Render service is live on its temporary `onrender.com` address, open **Render → service → Settings → Custom Domains → Add Custom Domain**. Add either your root domain (`yourdomain.com`) or `www.yourdomain.com`; Render automatically creates the paired redirect. Then add the DNS records Render displays at your domain registrar/DNS provider and click **Verify** in Render. Render provides managed TLS and redirects HTTP to HTTPS after verification. [3]

Before verification, remove conflicting `AAAA` records. If you use Cloudflare, start with the DNS record in **DNS-only** mode rather than a proxied record until Render verification and TLS issuance complete. Save the final HTTPS address as `PUBLIC_SITE_URL` in Render and redeploy.

## 5. Is Render slow?

The application itself is a normal Node web service. On a paid Render instance, visitors should not experience an idle cold start. On Render’s **Free** web-service tier, Render spins the service down after 15 minutes with no inbound traffic; the next request can take about one minute while Render starts it again. Render explicitly advises against using Free instances for production applications. [4]

For real customers and a password-protected merchant dashboard, choose a paid web-service instance before launch. Also keep all orders and settings in the external database; Render’s service filesystem is ephemeral and files written there are lost on restarts or redeploys. [1] [4]

## 6. Updating the site after your domain is live

Your custom domain does **not** change when you update code. Use this routine:

1. Make the change in GitHub (or ask me to update the project and export it again).
2. Commit and push it to the `main` branch.
3. Render automatically rebuilds and deploys the new commit when Auto-Deploy is **On Commit**. [1]
4. Check **Render → Events**. If a deploy fails, the last successful version continues serving.
5. Test `/`, `/shop`, and `/admin` on the final domain. Do not test checkout with a real payment until the merchant VPA and Resend sender are confirmed.

For a configuration-only change, use **Environment → Save, rebuild, and deploy**. Never change secrets in GitHub. Render supports one-off manual deployment from the service’s **Events** page if Auto-Deploy is off. [1] [2]

## 7. First post-deploy checks

| Check | Expected result |
|---|---|
| `https://yourdomain.com/` | Landing page loads over HTTPS. |
| `https://yourdomain.com/shop` | Shop opens and its **Buy DAB** flow reaches checkout. |
| `/admin` | Dashboard requires the administrator or employee credentials. |
| Test checkout | QR contains the configured `MERCHANT_VPA`; a pending record appears in the dashboard after payment opens. |
| Test payment verification | Buyer receives one payment-confirmation email. |
| Delivery Tracking | Marking a paid test order Shipped then Delivered sends one email for each state. |
| Settings | Activate the first-of-month subscription reminder and hourly demo-order cleanup only after the final published URL is working. |

After the final HTTPS domain is available, send it to me to create the fixed Android dashboard shortcut that opens `/admin` directly.

## References

[1] [Render: Deploying on Render](https://render.com/docs/deploys)

[2] [Render: Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)

[3] [Render: Custom Domains](https://render.com/docs/custom-domains)

[4] [Render: Deploy for Free](https://render.com/docs/free)
