# Validation Record

## Published dashboard shortcut endpoint

On 15 August 2026, `https://dab-1-cizz.onrender.com/admin` was opened over HTTPS and completed its access check to show the existing protected 91DAB merchant dashboard login. The page presents the authorized username/email field, password field, and **Open dashboard** control; no password was entered or stored during this verification. This is the fixed URL to embed in the Android shortcut APK.

The integrated site was opened in a browser under one origin. On first-load Dashboard view, the sidebar counters were zero, the Overview metrics showed ₹0 revenue, 0 active customers, 0 qualifying orders, and a 0% paid-order ratio. The sales, products, recent orders, and activity panels each displayed empty states rather than seeded records.

The updated HTML scripts also passed syntax validation, while the project test suite passed with four tests, including the real-data-only regression coverage.

The storefront also loaded inside the integrated site and opened its plan selector successfully, with the four configured plan types visible and no stored buyer records present before checkout.

A controlled checkout reached the delivery-details screen and accepted the complete name, email, mobile, address, city, state, and PIN fields required for shop-to-dashboard buyer records. The controlled record will be removed after the payment-reference verification check.

The controlled checkout reached the UPI stage through the local fallback, accepted a UTR reference, and displayed the submitted-reference state. This proves a completed buyer checkout with a UPI reference can be persisted even without an optional external order API.

The dashboard imported the qualifying UPI-submitted order into Recent Orders and buyer activity. A follow-up synchronization hook was added to guarantee that overview counters and badges refresh after the embedded dashboard is loaded from shared browser storage.

The Payments screen showed the controlled UTR-submitted record with a masked reference and its Verify action. Selecting Verify changed the record to Paid, moved ₹500 into paid revenue, cleared the UTR-submitted count, and retained the buyer record. The controlled record is removed after this verification check.

After the controlled buyer record was removed from `91dab_shop_orders`, the dashboard was remounted. Overview returned to ₹0 revenue, 0 customers, 0 qualifying orders, and 0% conversion. Recent Orders and Recent Activity displayed their empty states, confirming that the published-development browser session was left clean.

The public root route now renders only the 91DAB storefront and exposes no dashboard selector. Direct navigation to `/admin` renders the private password screen instead of the merchant dashboard.

An invalid password submitted at `/admin` remained on the protected login screen and returned the expected rejection message. The server test suite separately verified that the configured private secret creates a valid signed administrator session and that the session-status check accepts it.

The production build completed successfully, and a Render-style production smoke test started the server with only `NODE_ENV`, `JWT_SECRET`, `ADMIN_DASHBOARD_PASSWORD`, and `PORT`, then served the root route successfully.

The managed DAB product image now loads in the storefront hero and product areas. The clinics-and-group-practices section references the supplied clinic image and the browser confirmed a successfully loaded 1080 × 1920 image at the managed asset URL.

The administrator password-change flow was validated end to end against an isolated database row: an active signed admin session requested the OTP, the email payload was restricted to the configured recipient, a valid OTP replaced the stored password hash, the new password authenticated successfully, and the old password was rejected. The test removed its temporary security row after completion.

The clinic image crop was shifted to `object-position: 50% 12%`. Browser inspection and visual verification confirm that the in-image “A New Standard of Patient Care” heading is now fully visible.

Verified-payment email delivery was tested through an authenticated, isolated database-backed flow. A verified order reserved its one-time delivery record, sent a confirmation payload only to the buyer email, recorded the delivery as sent, and suppressed a second confirmation attempt for the same order. The test record was cleaned up afterward.
