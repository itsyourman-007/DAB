# Five-Ring Notification Update — Visual Check

The local preview was captured at desktop (1280×720) and phone (390×844) widths for `/`, `/shop`, and `/admin`.

The landing page displayed its responsive navigation, Buy DAB CTA, WhatsApp CTA, hero content, and cookie Accept/Reject controls. The shop displayed the product image and responsive layout without visible overflow. The protected admin entry displayed the username/email and password fields and remained contained on the phone viewport.

The five-ring behavior is implemented in the dashboard embedded page. It remains muted by default and is enabled through the dashboard Notification sound switch. New trusted online-store order states (`pending`, `utr_submitted`, and `paid`) and trusted live buyer messages flow through `notifyReceivedUpdate`, which schedules exactly five browser-native bell rings with duplicate suppression based on the order ID and payment status. Initial server-order hydration does not ring.

Automated validation: 22 test files and 92 tests passed; TypeScript validation and production build passed.
