# Phase 2F-1 Typing Indicator Fix

Fixes the real-time typing indicator so the recipient reliably sees “User is typing” while the sender is actively typing.

Changes:
- Added no-cache headers to typing API reads/writes.
- Added a 1.5-second typing heartbeat while the sender is typing so the 4-second server TTL cannot expire during continuous typing.
- Typing state is cleared when input is emptied, blurred, chat closes, or the timeout expires.
- Improved the typing indicator visual treatment.
- Existing chat, approval, presence, read-receipt and close-chat behavior is preserved.
