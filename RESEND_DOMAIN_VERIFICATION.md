# Resend Domain Verification for 91DAB OTP Emails

## Current Check

The configured Resend API credential is active, but the Resend Domains API currently returns **no custom domains**. This means `ADMIN_OTP_FROM_EMAIL` must not use a custom 91DAB address until the matching domain or sender subdomain is added and verified in the Resend account.

## Required Verification Steps

Open [Resend Domains](https://resend.com/domains), select **Add Domain**, and add a dedicated sending subdomain such as `mail.yourdomain.com` or `notifications.yourdomain.com`. Resend recommends a purpose-specific subdomain instead of the root domain. Select the sender region, then copy the exact DKIM TXT, SPF TXT, and SPF MX records from Resend’s Records panel to the DNS provider that actually controls the domain.

Do not substitute guessed DNS values. Copy the hostnames and values directly from Resend. A correctly configured domain often verifies within about 15 minutes, although DNS propagation can take up to 72 hours. Use [dns.email](https://dns.email/) to check that the published records match the Resend values. If the domain remains unverified after propagation, use **Restart verification** in Resend and check the provider-specific errors in the domain record list. [1] [2]

After Resend marks the domain as verified, set the project sender to a matching address, for example `91DAB <security@notifications.yourdomain.com>`, in `ADMIN_OTP_FROM_EMAIL`. Keep `ADMIN_OTP_RECIPIENT_EMAIL` as the single mailbox allowed to receive administrator password-change codes. Then request one OTP from `/admin` and confirm delivery.

## Common DNS Problems

If the MX destination is incorrectly appended with the domain name by the DNS provider, add a trailing dot to the Resend-provided MX target. Ensure that DKIM values are complete and unchanged, all Resend MX records use the selected region, and the records are entered at the correct subdomain rather than an unrelated DNS zone. [2]

## References

[1] [Resend — Add and verify a domain](https://resend.com/docs/add-a-domain)

[2] [Resend — What if my domain is not verifying?](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying)
