# VibeKey Phase 2F-3: Message Timestamps + Delivery/Read Status

Built from Phase 2F-2.

- Keeps existing unread/green Message button behavior.
- Keeps single check for sent, double check for delivered, green double check for read.
- Adds `deliveredAt` to messages without changing `read` semantics.
- The unread polling endpoint marks a message delivered when the recipient app receives it, but does not mark it read.
- Opening the conversation marks incoming messages read and also records delivery time.
- Adds Today/Yesterday/date-aware timestamps to the chat UI.
- Message request, rejection/revocation, block/unblock, presence, typing, and notification synchronization remain unchanged.
