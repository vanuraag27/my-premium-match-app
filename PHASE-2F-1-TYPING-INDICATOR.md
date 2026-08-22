# VibeKey Phase 2F-1: Typing Indicator + Real-Time Chat State

Built from the frozen Phase 2E baseline.

## Added
- Real-time typing state for the open conversation.
- `POST /api/typing` publishes typing/not-typing state for the authenticated user.
- `GET /api/typing` lets the recipient poll the sender's ephemeral typing state.
- Typing state expires after 4 seconds so a closed/crashed browser cannot leave a permanent indicator.
- Client sends typing state while the user types and stops it after 1.8 seconds of inactivity or when the input loses focus.
- Recipient polls typing state every second while the chat is open.
- UI shows `Name is typing` with animated dots.
- Closing the chat clears the local typing state and cannot reopen the chat.
- Existing message-request approval, revoke-rejection, block/unblock, presence, read receipts, notifications and matching behavior are unchanged.
