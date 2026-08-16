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
| Build command | `pnpm install --frozen-lockfile --prod=false && pnpm build` |
| Start command | `node server/_core/migrateOnStart.mjs && pnpm start` |
| Health-check path | `/` |
| Runtime | Node |
| Auto-deploy | **On Commit** on the `main` branch |

Render automatically deploys a linked Git branch when changes are pushed, and a failed build leaves the most recent successful version running. [1]

> **Render command note:** use the direct `pnpm` command above. Some Render Node images make system package-manager paths read-only, so `corepack enable` can fail before the build begins.

At application start, 91DAB now checks the database before the web server starts. An **empty database** receives the checked-in Drizzle migrations once; a **complete existing 91DAB database** is left unchanged; and a **partially migrated database** stops with a clear error rather than risking records by applying only some migrations. Do not replace the Blueprint commands with `drizzle-kit migrate && pnpm start`.

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

## 3. Create and connect TiDB Cloud

91DAB requires a **MySQL-compatible** database. TiDB Cloud Starter or Essential supports standard MySQL/ORM connections, but public connections require TLS. [7] [8]

1. Create or sign in to [TiDB Cloud](https://tidbcloud.com/), open **My TiDB**, and create a **Starter** instance in your preferred region. Do not create a PostgreSQL/Supabase database for this project.
2. Open the new instance, select **Connect**, keep the connection type set to **Public**, generate a password if prompted, and save it securely. TiDB Cloud shows the database user, host, port, and a driver-specific connection string in this dialog. Copy the full connection string it supplies; do not guess or rewrite the username because TiDB Cloud can use an instance/account prefix. [8] [9]
3. Open **Settings → Networking**. Ensure **Public Endpoint** is enabled. If you restrict the firewall, add the required deployment network before deploying. For an AWS-hosted TiDB Cloud Starter or Essential instance, TiDB Cloud provides **Add AWS Access**, which permits current AWS ranges; otherwise begin with the default rule only long enough to test and then replace it with the narrowest reliable deployment-network rule. [10]
4. In **Render → 91dab-store → Environment**, create `DATABASE_URL` and paste the exact TiDB connection string from step 2. Keep TLS enabled exactly as shown by TiDB. Do not put this value in GitHub, the browser, or an HTML file.
5. Click **Save, rebuild, and deploy**. On the first successful deploy, the safe startup bootstrap creates all 91DAB tables. On later deploys it detects the existing complete schema and starts normally without reapplying migrations.

> If the Render log says **“Could not reach the configured database,”** recheck the TiDB URL, public endpoint, firewall rule, and TLS options. If it says **“Database schema is incomplete,”** use a new empty TiDB database for the first setup or complete the schema deliberately before retrying; do not delete customer records to bypass the message.

## 4. Configure Resend before accepting real orders

Resend powers administrator password-change OTPs, payment confirmations, and the new Shipped/Delivered buyer emails. In [Resend Domains](https://resend.com/domains), add a domain or subdomain you control, then place the exact DNS records Resend shows in your domain provider. Wait until the domain displays **Verified** before using it as `ADMIN_OTP_FROM_EMAIL`.

Use a sender such as `91DAB <orders@yourdomain.com>`. The same verified sender supports all site emails. A buyer receives an email after payment verification and again after a staff member marks an order **Shipped** or **Delivered**. The app stores a per-order, per-status dispatch record so a status email is not duplicated; if Resend has a temporary error, the Delivery Tracking screen exposes a retry action.

### Resend automatic-email setup

1. In [Resend Domains](https://resend.com/domains), select **Add Domain** and add a subdomain you control, such as `mail.yourdomain.com` or `updates.yourdomain.com`. Resend recommends using a sending subdomain to separate transactional-mail reputation from the root domain. [11] [13]
2. Open the domain’s **Records** tab. Copy every Resend-provided DNS record exactly into the DNS provider that manages your domain, including the DKIM and SPF records. Wait until the domain is shown as **Verified**; Resend states this is often about 15 minutes, though DNS propagation can take longer. [11]
3. In [Resend API Keys](https://resend.com/api-keys), select **Create API Key**. Name it `91DAB Render`, give it **Sending access** only, and restrict it to the verified 91DAB sending domain where that option is available. Copy the value once and store it immediately in Render; Resend does not show an existing API key value again. [12]
4. In **Render → 91dab-store → Environment**, add `RESEND_API_KEY` with that secret and set `ADMIN_OTP_FROM_EMAIL` to a real mailbox on the verified sending domain, for example `91DAB <orders@mail.yourdomain.com>`. Set `ADMIN_OTP_RECIPIENT_EMAIL` to `dantaresearch@gmail.com`.
5. Save, rebuild, and deploy. Then request a password-change OTP from **Dashboard → Settings** to test the administrator email. Use a test buyer email during a real test checkout to verify buyer emails.

| 91DAB automatic email | When it is sent |
|---|---|
| Administrator password OTP | The administrator requests a password change in Dashboard Settings. |
| Buyer payment confirmation | An administrator verifies a submitted UPI reference and marks the trusted order paid. |
| Buyer shipping confirmation | Staff marks a paid order **Shipped**. |
| Buyer delivery confirmation | Staff marks the same order **Delivered**. |

The website does **not** send a buyer “payment confirmed” email merely when a QR code opens or a UPI reference is submitted: a real payment must first be verified by an authorized administrator. This prevents false confirmations.

## 5. Use your own domain

After the Render service is live on its temporary `onrender.com` address, open **Render → service → Settings → Custom Domains → Add Custom Domain**. Add either your root domain (`yourdomain.com`) or `www.yourdomain.com`; Render automatically creates the paired redirect. Then add the DNS records Render displays at your domain registrar/DNS provider and click **Verify** in Render. Render provides managed TLS and redirects HTTP to HTTPS after verification. [3]

Before verification, remove conflicting `AAAA` records. If you use Cloudflare, start with the DNS record in **DNS-only** mode rather than a proxied record until Render verification and TLS issuance complete. Save the final HTTPS address as `PUBLIC_SITE_URL` in Render and redeploy.

## 6. Is Render slow?

The application itself is a normal Node web service. On a paid Render instance, visitors should not experience an idle cold start. On Render’s **Free** web-service tier, Render spins the service down after 15 minutes with no inbound traffic; the next request can take about one minute while Render starts it again. Render explicitly advises against using Free instances for production applications. [4]

For real customers and a password-protected merchant dashboard, choose a paid web-service instance before launch. Also keep all orders and settings in the external database; Render’s service filesystem is ephemeral and files written there are lost on restarts or redeploys. [1] [4]

## 7. Hosting without free-tier wake-ups

| Option | Suitable for 91DAB? | Wake-up risk | Operational responsibility |
|---|---|---|---|
| **Render paid Web Service** | **Recommended** | No Render Free-tier idle spin-down | Low. Keep the existing Blueprint, external MySQL-compatible database, and environment variables. |
| **GoDaddy Node.js Hosting** | Possible, but not my first production choice | GoDaddy documents Node/Express support but its Node.js product is currently beta and does not publish a no-cold-start commitment. Confirm the production runtime behavior with GoDaddy before relying on it. | Low to medium. Their hosted Node flow supports zipped or Git-based deployment and custom domains. [5] |
| **GoDaddy VPS / Managed VPS** | Yes | A continuously managed Node process can remain running, so there is no free-tier sleep model. | Medium to high. You or a managed-service provider must configure Node, a process manager such as systemd/PM2, HTTPS/reverse proxy, firewall, operating-system updates, backups, monitoring, and deploys. GoDaddy positions VPS for root-level control and larger workloads. [6] |

**Recommendation:** choose a **paid Render Web Service** if you want the least change to this repository and a straightforward custom-domain setup. Choose a **GoDaddy VPS** only if you already want GoDaddy server administration or purchase its managed VPS support. Do not choose GoDaddy Node.js Hosting solely on the assumption of “zero wake-up time”; its official documentation confirms Node/Express and custom-domain compatibility, but not that specific uptime behavior. [5]

## 8. Updating the site after your domain is live

Your custom domain does **not** change when you update code. Use this routine:

1. Make the change in GitHub (or ask me to update the project and export it again).
2. Commit and push it to the `main` branch.
3. Render automatically rebuilds and deploys the new commit when Auto-Deploy is **On Commit**. [1]
4. Check **Render → Events**. If a deploy fails, the last successful version continues serving.
5. Test `/`, `/shop`, and `/admin` on the final domain. Do not test checkout with a real payment until the merchant VPA and Resend sender are confirmed.

For a configuration-only change, use **Environment → Save, rebuild, and deploy**. Never change secrets in GitHub. Render supports one-off manual deployment from the service’s **Events** page if Auto-Deploy is off. [1] [2]

## 9. First post-deploy checks

| Check | Expected result |
|---|---|
| `https://yourdomain.com/` | Landing page loads over HTTPS. |
| `https://yourdomain.com/shop` | Shop opens and its **Buy DAB** flow reaches checkout. |
| `/admin` | Dashboard requires the administrator or employee credentials. |
| Test checkout | QR contains the configured `MERCHANT_VPA`; a pending record appears in the dashboard after payment opens. |
| Test payment verification | Buyer receives one payment-confirmation email. |
| Delivery Tracking | Marking a paid test order Shipped then Delivered sends one email for each state. |
| Settings | Activate the first-of-month subscription reminder and hourly demo-order cleanup only after the final published URL is working. |

The dashboard’s **Connect app** screen provides the current fixed Android dashboard shortcut. If the public dashboard domain changes, rebuild the Android shortcut with the new `/admin` address, replace the GitHub release APK, and keep the QR target unchanged.

## References

[1] [Render: Deploying on Render](https://render.com/docs/deploys)

[2] [Render: Environment Variables and Secrets](https://render.com/docs/configure-environment-variables)

[3] [Render: Custom Domains](https://render.com/docs/custom-domains)

[4] [Render: Deploy for Free](https://render.com/docs/free)

[5] [GoDaddy Node.js Hosting FAQ](https://www.godaddy.com/help/godaddy-nodejs-hosting-faq-42915)

[6] [GoDaddy VPS Hosting](https://www.godaddy.com/hosting/vps-hosting)

[7] [TiDB Cloud: Connect to a Starter or Essential instance](https://docs.pingcap.com/tidbcloud/connect-to-tidb-cluster-serverless/)

[8] [TiDB Cloud: TLS connections for Starter or Essential](https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-clusters/)

[9] [TiDB Cloud: Connect via public endpoint](https://docs.pingcap.com/tidbcloud/connect-via-standard-connection-serverless/)

[10] [TiDB Cloud: Configure public-endpoint firewall rules](https://docs.pingcap.com/tidbcloud/configure-serverless-firewall-rules-for-public-endpoints/)

[11] [Resend: Add and verify a domain](https://resend.com/docs/add-a-domain)

[12] [Resend: Manage API keys](https://resend.com/docs/dashboard/api-keys/introduction)

[13] [Resend: Verified domains](https://resend.com/docs/dashboard/domains/introduction)
