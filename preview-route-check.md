# Preview Route Check

On 2026-08-16, the current preview served both public routes successfully:

- `/` rendered the 91DAB landing page with navigation, purchase calls to action, contact links, and cookie controls.
- `/shop` rendered the storefront, including purchase controls and monthly/yearly subscription entry points.
- `/admin` rendered the protected 91DAB merchant-dashboard login gate and did not expose dashboard records without credentials.

The protected `/admin` route remains intentionally gated by the administrator login and needs published-site credentials to complete a full external smoke test.
