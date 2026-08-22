'use client';

import DriveImage from './DriveImage';

export default function CandidateCard({ candidate = {}, onSave }) {
  const {
    name = 'Anonymous Node', profession = 'Professional', bio = 'No bio provided.',
    photoUrl = '', score = 85, aiAnalysis = {}
  } = candidate;

  const scoreTone = score >= 90 ? 'text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10' :
    score >= 80 ? 'text-[#FF3CAC] border-[#FF3CAC]/30 bg-[#FF3CAC]/10' :
    'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10';

  return (
    <article className="group relative w-full max-w-xl overflow-hidden rounded-3xl bg-[#11152F] border border-[#2A3155] p-5 sm:p-6 shadow-[0_16px_48px_rgba(0,0,0,.22)] hover:-translate-y-1 hover:border-[#6C3CFF]/50 transition-all duration-[260ms]">
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-[#00D4FF]/15 via-[#6C3CFF]/15 to-[#FF3CAC]/15 blur-3xl group-hover:scale-125 transition-transform duration-500" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <DriveImage src={photoUrl} name={name} size="w-16 h-16 sm:w-20 sm:h-20" className="ring-2 ring-[#6C3CFF]/30 shadow-lg" />
            <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-[#22C55E] ring-2 ring-[#11152F]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate group-hover:text-[#EEF0FF]">{name}</h3>
            <p className="text-sm font-medium text-[#B8BED8] truncate">{profession}</p>
            {aiAnalysis?.temperament && (
              <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#171C3B] text-[#EEF0FF] border border-[#2A3155]">
                ✦ {aiAnalysis.temperament}
              </span>
            )}
          </div>
        </div>
        <div className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-bold ${scoreTone}`}>
          <span className="text-[10px] uppercase tracking-wider opacity-80">Synergy</span>
          <span className="text-lg font-black">{score}%</span>
        </div>
      </div>

      {bio && <p className="relative mt-4 text-sm text-[#B8BED8] line-clamp-2 leading-relaxed">{bio}</p>}

      {aiAnalysis?.breakdown && (
        <div className="relative mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-[#6C3CFF]/10 via-[#00D4FF]/5 to-[#FF3CAC]/10 border border-[#6C3CFF]/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00D4FF] mb-1">
            <span>✦</span><span className="uppercase tracking-wider">AI compatibility insight</span>
          </div>
          <p className="text-xs text-[#EEF0FF] leading-relaxed italic">"{aiAnalysis.breakdown}"</p>
        </div>
      )}

      <div className="relative mt-5 pt-4 border-t border-[#2A3155] flex items-center justify-between gap-3">
        <button onClick={() => onSave?.(candidate)} className="px-4 py-2 text-xs font-semibold text-[#B8BED8] hover:text-white hover:bg-[#171C3B] rounded-xl transition-all">Bookmark</button>
      </div>
    </article>
  );
}
