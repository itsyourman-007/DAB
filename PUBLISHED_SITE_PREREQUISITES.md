# Published-Site Prerequisites

The current preview successfully serves the public landing page (`/`), shop (`/shop`), and protected dashboard login gate (`/admin`). The following items cannot be truthfully activated or smoke-tested until the Render production service is deployed with its real environment configuration.

| Remaining task | Required published-site input | How to complete it |
| --- | --- | --- |
| Administrator login on Render | A deployed service with `ADMIN_DASHBOARD_PASSWORD`, `JWT_SECRET`, and a reachable `DATABASE_URL` | Set the values in Render Environment, redeploy, then sign in at `/admin` with the configured administrator account. |
| Production orders and UPI QR | A reachable MySQL/TiDB `DATABASE_URL` and `MERCHANT_VPA` | Set both values in Render Environment, redeploy, then create one controlled test checkout and confirm the pending record appears in the dashboard. |
| First-of-month subscription reminder | A working published URL, dashboard access, database, and verified Resend sender | In Settings, enable the reminder only after the dashboard and email configuration have been validated. |
| Hourly demo-order cleanup | A working published URL, dashboard access, and database | In Settings, enable it only after confirming that a clearly named test order can be safely removed after the required retention period. |
| User-device preview reachability | The user’s browser/network access to the deployed Render or custom-domain URL | Test `/`, `/shop`, and `/admin` on the final public URL after Render reports a successful deployment. |

The dashboard QR and Android APK are already published in the GitHub release. The QR will remain valid while the release asset URL is retained.
