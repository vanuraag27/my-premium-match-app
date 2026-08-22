/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hides Next.js's built-in development-mode indicator (the small
  // Route/Bundler/Preferences panel in the bottom-left corner). This is
  // framework tooling injected automatically by `next dev` — it's not part
  // of the application UI and never appears in a production build.
  // Build/runtime error overlays are unaffected and still show up normally.
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};

module.exports = nextConfig;
