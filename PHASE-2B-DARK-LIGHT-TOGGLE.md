# VibeKey Phase 2B: Dark / Light Mode Toggle

## Feature
Added a Dark / Light mode switch to the top-right of the authenticated VibeKey dashboard header.

Visual pattern:

VibeKey                                      🌙  ━━━━━  ☀️

## Behavior
- Dark mode is the default when no preference has been saved and the device preference is dark.
- Light mode is used when the saved preference is light or the device prefers light on first use.
- The selected theme is saved in `localStorage` under `vibekey-theme`.
- Switching happens without a page refresh.
- The setting survives browser refresh and logout/login because it is stored locally.
- Existing authentication, matching, filtering, messaging, block/unblock and database/API logic are unchanged.
- The toggle is keyboard/focus accessible and uses `role="switch"` with `aria-checked`.

## Light palette
- Background: #F7F8FC
- Surface: #FFFFFF
- Elevated: #EEF0FF
- Primary text: #11152F
- Secondary text: #3E4665
- Muted text: #68708D
- Border: #DDE1F0
- Purple: #6C3CFF
- Cyan: #009FC2
- Pink: #E52E91

## Files changed
- `src/app/page.js`
- `src/app/globals.css`

## Local test
```powershell
npm install
npm run dev
```

Test both modes, refresh the browser, log out/in, and confirm all existing application functionality remains unchanged.
