import './globals.css';

export const metadata = {
  title: 'VibeKey - Unlock new vibe',
  description: 'AI-assisted connections for careers, community and meaningful relationships.'
};

// Without this, mobile browsers render the page at a virtual desktop-width
// canvas (typically ~980px) and shrink the whole thing to fit the screen,
// instead of laying it out at the phone's actual width. That's what was
// making the header icons and the chat input's Send button appear to run
// off-screen on mobile even though the layout itself is already
// responsive — the page just wasn't being told to use the real viewport.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-vk-bg text-white antialiased">{children}</body>
    </html>
  );
}
