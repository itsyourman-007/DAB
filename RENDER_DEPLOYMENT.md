# Deploy 91DAB to Render

## Before you start

This archive contains a Node.js web service, not a static site. The storefront is public at `/`, while the merchant dashboard is protected at `/admin`.

> **Hosting note.** Manus provides built-in publishing and custom-domain support. You can use Render instead, but you will need to maintain the Render service, its environment variables, and redeployments yourself.

## Render setup

Create a new repository from the ZIP contents, push it to GitHub, GitLab, or Bitbucket, and then create a **Web Service** in Render. Render supports source-based Node/Express deployments with a configured build command, start command, and environment variables. [1] [2]

The Render ZIP bundles the supplied DAB product and clinic images under `client/public/assets/` so the external deployment does not depend on Manus-managed asset URLs.

| Render field | Value |
| --- | --- |
| Language / Runtime | Node |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start Command | `pnpm start` |
| Health Check Path | `/` |
| Environment Variable | `NODE_ENV=production` |
| Secret | `ADMIN_DASHBOARD_PASSWORD` — choose your private dashboard password |
| Secret | `JWT_SECRET` — generate a long random value and keep it private |
| Secret | `DATABASE_URL` — MySQL/TiDB-compatible connection string for persistent password hashes and OTPs |
| Secret | `RESEND_API_KEY` — Resend API key for password-change OTP and buyer receipt delivery |
| Environment Variable | `ADMIN_OTP_RECIPIENT_EMAIL` — the one email address permitted to receive a password-change OTP |
| Environment Variable | `ADMIN_OTP_FROM_EMAIL` — a Resend-verified sender, such as `91DAB <security@yourdomain.com>` |
| Environment Variable | `PUBLIC_SITE_URL` — your deployed public URL, such as `https://www.yourdomain.com`, used by the buyer-email Visit 91DAB button |
| Environment Variable | `EMAIL_BRAND_LOGO_URL` — optional public HTTPS URL for the 91DAB logo at the top of buyer receipts; the 91DAB wordmark is used when omitted |

The included `render.yaml` supplies these deployment settings when you deploy with a Render Blueprint. Render injects `PORT` for web services, and this project reads that value instead of using a fixed port. [2]

## Changing the dashboard password

In the protected `/admin` dashboard, select **Security settings**, request an email code, and confirm the change with the current password, a strong new password, and the six-digit OTP delivered to `ADMIN_OTP_RECIPIENT_EMAIL`. The new password is stored as a one-way hash in the database; it overrides the deployment's initial `ADMIN_DASHBOARD_PASSWORD` value after the first confirmed change.

If the dashboard security settings are unavailable, the fallback path is to update `ADMIN_DASHBOARD_PASSWORD` in Render's **Environment** settings and redeploy, provided no dashboard-managed password has been set yet. Existing administrator sessions remain valid only until their 12-hour expiration; if you need to invalidate every active session immediately, rotate `JWT_SECRET` at the same time and redeploy.

Never place either secret in source code, commit it to a repository, or upload a populated `.env` file. Enter both values directly in Render's Environment settings.

## What `JWT_SECRET` means

`JWT_SECRET` is **not** the dashboard password. It is a long random server-only value used to sign and verify the secure administrator session cookie created after a successful dashboard login. Keep it private and stable during normal operation. Rotating it invalidates all active admin sessions, which is useful after a suspected session compromise or when you need everyone to log in again.

## Set up Resend for OTP and buyer payment emails

This project uses the **Resend Email API**, so no separate SMTP server is required. The same verified sender is used for administrator OTP emails and buyer payment-confirmation emails.

1. Create or sign in to a Resend account, then open **Domains** and add a domain you own. A dedicated sending subdomain such as `mail.yourdomain.com` or `updates.yourdomain.com` is recommended for transactional mail. [3]
2. In the domain screen, copy every DNS record Resend provides into your domain provider’s DNS panel. Return to Resend and wait until the domain is marked **Verified**.
3. Open **API Keys**, create a production key restricted to the verified sending domain where possible, and copy the key immediately. Resend does not display a key value again after creation. [4]
4. In **Render → Your Web Service → Environment**, set the following values, then save and redeploy:

| Variable | Example format | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_...` | Server-only authentication for Resend API calls |
| `ADMIN_OTP_FROM_EMAIL` | `91DAB <security@mail.yourdomain.com>` | Verified sender used for OTP and buyer emails |
| `ADMIN_OTP_RECIPIENT_EMAIL` | `owner@yourdomain.com` | Only address allowed to receive admin password-change OTPs |
| `PUBLIC_SITE_URL` | `https://www.yourdomain.com` | Optional public-store link in buyer confirmation emails |
| `EMAIL_BRAND_LOGO_URL` | `https://www.yourdomain.com/assets/91dab-logo.png` | Optional public 91DAB logo image in buyer confirmation emails |

5. Sign in at `/admin`, open **Security settings**, select **Email code**, and confirm that the OTP reaches the configured recipient.

When an administrator uses the dashboard’s **Verify & email** payment action for an eligible UPI-submitted payment, the dashboard immediately shows a sending indicator and the server sends one branded HTML confirmation email to the buyer email captured at checkout. The receipt includes the order identifier, plan, quantity when available, amount paid, UPI reference, delivery schedule, and checkout delivery address when supplied. The delivery table prevents a duplicate email if Verify is clicked again for the same order. The Resend send API requires a sender, recipient, and subject; this project supplies these server-side. [5]

The bundled `RESEND_DOMAIN_VERIFICATION.md` provides the same verification sequence and is ready to use when your domain is added. Until Resend marks the sender domain as verified, keep `ADMIN_OTP_FROM_EMAIL` set to a sender that Resend accepts; OTP, support, and buyer-email delivery will otherwise be rejected by Resend.

## Team members, support, and transaction history

The protected dashboard includes **Transaction history**, which derives its records only from qualifying purchases recorded by the live shop. It does not seed or display sample transactions.

Team members are stored in the `merchantTeamMembers` database table. Add or remove a member from the Engineering, Marketing, or Sales dashboard screens by entering the **current administrator password** in the confirmation dialog. The dashboard never displays placeholder team members.

The Support form sends its message only to `ADMIN_OTP_RECIPIENT_EMAIL`, using the same server-side Resend sender configuration as the OTP flow. Verify the Resend domain before relying on the Support button for operational messages.

## Android dashboard APK

The delivery includes `91dab-dashboard-debug.apk`, an installable signed debug APK, and the `android-dashboard-app/` source directory. On first launch, the app requests the final **HTTPS** Render or custom-domain address and opens `/admin`; it does not embed an administrator password, payment credential, database URL, JWT secret, or Resend API key.

For a Play Store or long-term production release, replace the generated debug signing key with your own release keystore, increment the Android version code for updates, and retain the final HTTPS domain. A domain change requires updating the app’s configured URL.

## URL structure after deployment

| Address | Purpose |
| --- | --- |
| `https://your-service.onrender.com/` | Public 91DAB landing page |
| `https://your-service.onrender.com/shop` | Public DAB storefront opened by Buy DAB links |
| `https://your-service.onrender.com/admin` | Password-protected merchant dashboard |

## Important data-storage limitation

The supplied storefront and dashboard exchange qualifying buyer records through same-origin browser storage. This means each browser profile has its own local view of shop and dashboard activity. The new administrator password hash and OTP records use `DATABASE_URL`; for a production dashboard shared across devices or administrators, the next step is also to move order, payment, and quote records to a real server-side database/payment-provider integration.

## What remains after an external Render deployment

| Data or component | Current location | If removed | What to keep for Render |
| --- | --- | --- | --- |
| Buyer checkout, UTR, and clinic-quote records | The buyer's browser storage | That browser loses its own local records | A database-backed order system is needed for a shared production dashboard |
| Admin password hash and OTP state | `DATABASE_URL` database | Dashboard-managed password changes and OTP confirmation stop working | Keep the database and `DATABASE_URL` |
| Admin session signatures | `JWT_SECRET` environment variable | Existing sessions are invalidated; logins fail if it is absent | Keep the secret in Render Environment |
| OTP and buyer-email delivery | Resend environment variables | Password-change codes and buyer receipts cannot be sent | Keep `RESEND_API_KEY`, `ADMIN_OTP_RECIPIENT_EMAIL`, and `ADMIN_OTP_FROM_EMAIL`; optionally keep `PUBLIC_SITE_URL` and `EMAIL_BRAND_LOGO_URL` |
| Product and clinic images in the Render ZIP | `client/public/assets/` | The pages lose those images only if the deployed asset files are removed | The ZIP already contains them |

If you deploy the ZIP to Render and point your domain there, the website is served by Render rather than Manus. Removing the Manus project later does not remove the already-deployed Render service, but the service continues to work only while its Render configuration, database, environment variables, and deployed files remain in place. This guide describes this project’s architecture only; consult Manus’s current privacy documentation or support for authoritative platform-level data-retention information.

## Adding another HTML file later

Send the HTML file here and identify where it should appear: for example, a new public route, a section inside the storefront, or a protected dashboard page. It will be reviewed for scripts, styles, images, and data interactions, then converted or embedded into the existing route structure (`/` for the landing page, `/shop` for the storefront, and `/admin` for the protected dashboard) without overwriting the existing files. The source is kept as normal named project files, and the Render ZIP is regenerated with the same directory structure so you can commit and deploy it from a Git repository in a predictable order.

## References

[1]: https://render.com/docs/deploy-node-express-app "Render: Deploy a Node Express App"
[2]: https://render.com/docs/web-services "Render: Web Services"
[3]: https://resend.com/docs/dashboard/domains/introduction "Resend: Verified Domains"
[4]: https://resend.com/docs/dashboard/api-keys/introduction "Resend: Manage API Keys"
[5]: https://resend.com/docs/api-reference/emails/send-email "Resend: Send Email API"
