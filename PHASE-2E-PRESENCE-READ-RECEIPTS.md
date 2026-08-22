# Phase 2E Add-on: Live Online Indicator + Message Read Receipt

- Each profile card shows a green dot when that user has sent a heartbeat in the last 30 seconds; otherwise the dot is gray.
- Online presence is independent of profile visibility. Logging out turns off the green dot but does not remove the profile from matching.
- Deleting a profile still removes it from matching through the existing profile lifecycle logic.
- Sent messages display a single check mark while unread and a cyan check mark after the recipient opens the conversation and the server marks the message `read: true`.
- Existing chat polling updates the sender's receipt without changing the Message Request + Revoke Rejection workflow.
