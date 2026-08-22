# VibeKey Phase 2C Combined Update

This build is based on the approved Phase 2C Connection System and retains the complete Message Rejection + Revoke Rejection workflow from the earlier Phase 2C Message-Rejection-Revocation build.

## Message request states
Pending -> Accepted (messaging allowed)
Pending -> Rejected -> Revoke Rejection -> sender may submit a new request

Revoke Rejection does not automatically open messaging and does not remove the original audit record. Block/Unblock remains independent.

## Light Mode fixes
Improved contrast for Sign in or join VibeKey, onboarding banner, Full name, Profession or role, Gender, Age, Location, Profile photo, upload-format hint, and Bio & interests.
