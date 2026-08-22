export default function VibeKeyLogo({ className = 'w-12 h-12', showTagline = false }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="shrink-0 rounded-[24%] overflow-hidden bg-[#090D24] ring-1 ring-[#2A3155] shadow-[0_0_24px_rgba(108,60,255,.18)]">
        <img src="/vibekey-logo.png" alt="VibeKey" className="w-full h-full object-contain" />
      </div>
      {showTagline && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight text-white">VibeKey</div>
          <div className="text-[10px] text-[#B8BED8]">Unlock new vibe</div>
        </div>
      )}
    </div>
  );
}
