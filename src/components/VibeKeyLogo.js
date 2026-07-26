export default function VibeKeyLogo({ className = "w-12 h-12" }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 512 512" width="100%" height="100%" style={{ background: '#020617', borderRadius: '24%' }}>
        <defs>
          <linearGradient id="roseToAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="amberToEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        <rect x="32" y="32" width="448" height="448" rx="80" fill="#0F172A" stroke="#1E293B" strokeWidth="4" />
        <path d="M 160 256 A 96 96 0 1 1 352 256 A 96 96 0 1 1 160 256" fill="none" stroke="url(#roseToAmber)" strokeWidth="6" strokeDasharray="8 8" opacity="0.6" />
        <circle cx="160" cy="256" r="10" fill="#F43F5E" />
        <circle cx="352" cy="256" r="10" fill="#10B981" />
        <circle cx="256" cy="120" r="12" fill="#F59E0B" />
        
        <circle cx="256" cy="220" r="48" fill="url(#roseToAmber)" />
        <circle cx="256" cy="220" r="24" fill="#020617" />
        <path d="M 236 250 L 276 250 L 288 360 L 256 384 L 224 360 Z" fill="url(#amberToEmerald)" />
        <circle cx="256" cy="290" r="6" fill="#020617" />
        <circle cx="256" cy="330" r="6" fill="#020617" />
      </svg>
    </div>
  );
}