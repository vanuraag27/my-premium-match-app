# VibeKey Phase 2F-5

## Changes

1. Removed the separate persistent Notifications system, including the notifications API, notification bell/panel, notification polling, and notification database writes.
2. Preserved message audio notification behavior and the existing unread-message indicator.
3. Increased profile photo upload limit from 200 KB to 2 MB. JPG, JPEG, and PNG remain supported.
4. Added automatic client-side photo resize/compression before storing the profile image.
5. Added a 4,000-character maximum for Bio & interests on registration and profile edit, with a live character counter.
6. Added server-side 4,000-character bio validation and 2 MB photo validation.

## Preserved

Message requests, Accept/Reject/Revoke, Block/Unblock, messaging, timestamps, delivery/read receipts, typing indicator, online/offline presence, smart auto-scroll, New Message indicator, dark/light mode, and existing project documentation remain intact.
