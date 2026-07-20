// my-premium-match-app/src/app/layout.js
import './globals.css';
export const metadata = { title: 'Bandhan AI - Premium Matchmaking' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 antialiased">{children}</body>
    </html>
  );
}