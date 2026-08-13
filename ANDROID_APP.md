# 91DAB Android App Delivery Path

The current 91DAB storefront and protected merchant dashboard are responsive web experiences. A reliable downloadable Android APK should wrap the **published HTTPS website**, rather than a development-preview address, so the app always loads the same live orders, OTP security, and administrator session flow as the browser version.

## Recommended Build

Use an Android WebView wrapper with a single configured production URL. The wrapper should open the public landing page by default and allow the administrator to sign in at `/admin`. Android back navigation should return through the website history before exiting the app. No password, Resend key, UPI VPA, database credential, or JWT secret belongs in the APK.

| Required input | Purpose |
|---|---|
| Final HTTPS Render or custom-domain URL | The only website address loaded by the APK. |
| Android package ID, for example `com.91dab.merchant` | Identifies the app for installation and future updates. |
| Android signing key or chosen app-signing service | Required to create an installable release APK. |
| App name and icon approval | Used for the launcher label and application icon. |

## Important Deployment Order

First deploy the current website to Render or the intended custom domain and test the public store, `/shop`, and protected `/admin` routes over HTTPS. Then configure the Android wrapper with that final URL and produce the signed APK. Changing the website later does not require a new APK unless the domain changes.

> The development-preview URL is intentionally temporary and must not be embedded in an APK.
