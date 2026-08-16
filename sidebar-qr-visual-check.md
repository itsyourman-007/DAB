# Sidebar and QR Visual Check

On 2026-08-16, the standalone dashboard HTML was opened locally. The normal sidebar rendered with the collapse control. Activating that control removed the sidebar content from the main layout and exposed the fixed restore control at the upper left. The next verification step is to confirm computed sidebar dimensions and the embedded QR image on the Mobile App screen.

Computed browser state after collapse confirmed `sidebarWidth: 0`, `appCollapsed: true`, `restoreVisible: flex`, and a loaded embedded PNG QR image. Activating the restore control returned the full sidebar and its normal collapse button.

The Mobile App dashboard screen visibly rendered the self-contained black-and-white QR code and the separate **Download Android APK** link. Both target the same published GitHub release APK.
