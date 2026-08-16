# Monthly Selector Diagnosis

The served `/shop` route is the `Shop.tsx` iframe wrapper around `client/src/embedded/shop.html`. Browser inspection confirmed the public storefront reaches the monthly subscription plan card, but direct top-level clicks do not enter the iframe's product state. Subsequent verification must target the iframe document itself.

Browser verification inside the storefront iframe confirmed that the served monthly product view initially shows `Your 1-month delivery starts from` and updates immediately after quantity changes. With quantity set to three, the live interface showed `Your 3-month delivery starts from`, a matching note, and the exact preview months `Aug 2026`, `Sept 2026`, and `Oct 2026`.
