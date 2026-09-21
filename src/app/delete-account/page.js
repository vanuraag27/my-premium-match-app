// my-premium-match-app/src/app/delete-account/page.js
// Public policy page required by Google Play's "User Data - Account Deletion
// Requirement". Linked from the Data Safety form's Account Deletion URL and
// Data Deletion URL fields. Intentionally a plain server-rendered page (no
// 'use client', no hooks) so it always returns real HTML content to Google's
// crawler with no client-side JS dependency.

export const metadata = {
  title: 'Account & Data Deletion Policy — VibeKey',
  description: 'How to delete your VibeKey account and all associated personal data.',
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#1B1B1D] flex flex-col items-center px-4 py-12 md:py-16">
      <div className="w-full max-w-2xl">

        <img
          src="/vibekey-logo.png"
          alt="VibeKey Logo"
          width={1254}
          height={1254}
          className="h-10 w-auto object-contain mb-6"
        />

        <div className="bg-white border border-[#ECE9E4] rounded-3xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">

          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#1B1B1D] mb-2">
            VibeKey Account &amp; Data Deletion Policy
          </h1>
          <p className="text-xs font-body text-[#6E6D72] mb-6">
            Last updated: September 2026
          </p>

          <p className="font-body text-sm text-[#1B1B1D] leading-relaxed mb-4">
            Users can delete their account and all associated personal data at any time:
          </p>

          <ol className="font-body text-sm text-[#1B1B1D] leading-relaxed space-y-3 mb-8 list-decimal list-inside">
            <li>Log in to your profile on the VibeKey app or website dashboard.</li>
            <li>Click <span className="font-semibold">Delete Profile</span>.</li>
            <li>
              Upon confirmation, your account, personal details, messages, and match data
              are permanently and completely purged from our MongoDB database.
            </li>
          </ol>

          <div className="border-t border-[#ECE9E4] pt-6 mb-6">
            <h2 className="font-display text-sm font-bold text-[#1B1B1D] mb-2">
              What gets deleted
            </h2>
            <p className="font-body text-sm text-[#6E6D72] leading-relaxed">
              Deleting your profile permanently removes your account record, your chat
              messages (sent and received), your message requests, your notifications,
              and any block records associated with your account. This action cannot be
              undone.
            </p>
          </div>

          <div className="border-t border-[#ECE9E4] pt-6">
            <h2 className="font-display text-sm font-bold text-[#1B1B1D] mb-2">
              Can&apos;t log in?
            </h2>
            <p className="font-body text-sm text-[#6E6D72] leading-relaxed">
              If you&apos;re unable to access your account, you can request deletion
              directly by emailing{' '}
              <a
                href="mailto:support@vibekey.app"
                className="text-[#EF3E56] font-semibold hover:underline"
              >
                support@vibekey.app
              </a>{' '}
              from the email address associated with your account. We&apos;ll confirm and
              complete the deletion within 7 business days.
            </p>
          </div>

        </div>

        <p className="font-body text-[11px] text-[#9B9A9D] text-center mt-6">
          VibeKey — Unlock New Vibe
        </p>
      </div>
    </main>
  );
}
