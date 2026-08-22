# VibeKey Phase 2E - Real-Time User Discovery & Profile Lifecycle

## Approved behavior

A VibeKey profile is independent of the user's current login/session state.

- Logged in: profile remains visible to eligible matching users.
- Logged out: profile remains visible to eligible matching users.
- Browser closed/offline: profile remains visible to eligible matching users.
- Profile edited: changes become available through the live matching refresh.
- Profile deleted: the profile is removed from the `users` collection and disappears from other users' matching results on the next automatic refresh.

## Real-time synchronization

The dashboard polls the existing onboarding matching endpoint every 5 seconds and also refreshes when the browser tab becomes visible again. This is used only to synchronize profile/match data. It is **not** used as an online-presence system.

## Session behavior

Logging out only clears the authentication session cookie and local dashboard state. It does not delete or hide the user's profile. Refreshing while authenticated restores the signed session and loads the same profile.

## Profile deletion behavior

The delete-profile action permanently removes the user's matching profile record from the `users` collection. Matching queries explicitly exclude records marked `profileStatus: 'deleted'` as an additional safety guard.
