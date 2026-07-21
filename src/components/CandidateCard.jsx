'use client';

import DriveImage from './DriveImage';

export default function CandidateCard({ candidate = {}, onConnect, onSave }) {
  const {
    name = 'Anonymous Node',
    profession = 'Professional',
    bio = 'No bio provided.',
    photoUrl = '',
    score = 85,
    aiAnalysis = {}
  } = candidate;

  const getScoreColor = (val) => {
    if (val >= 90) return 'from-emerald-500 to-teal-500 text-emerald-600 bg-emerald-50 border-emerald-200';
    if (val >= 80) return 'from-rose-500 to-pink-500 text-rose-600 bg-rose-50 border-rose-200';
    return 'from-amber-500 to-orange-500 text-amber-600 bg-amber-50 border-amber-200';
  };

  const scoreBadgeStyle = getScoreColor(score);

  return (
    <div className="group relative w-full max-w-xl rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ease-out overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-rose-400/20 to-pink-600/20 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <DriveImage 
              src={photoUrl} 
              name={name} 
              size="w-20 h-20" 
              className="ring-4 ring-rose-500/10 shadow-md"
            />
            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              {name}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {profession}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {aiAnalysis?.temperament && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  ⚡ {aiAnalysis.temperament}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-bold ${scoreBadgeStyle}`}>
          <span className="text-xs uppercase tracking-wider opacity-80">Synergy</span>
          <span className="text-lg font-black">{score}%</span>
        </div>
      </div>

      {bio && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
          {bio}
        </p>
      )}

      {aiAnalysis?.breakdown && (
        <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-rose-50/80 via-pink-50/40 to-purple-50/50 dark:from-rose-950/20 dark:via-purple-950/10 dark:to-slate-900 border border-rose-100 dark:border-rose-900/30">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            <span>✨</span>
            <span className="uppercase tracking-wider">Gemini Compatibility Insight</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
            "{aiAnalysis.breakdown}"
          </p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <button
          onClick={() => onSave?.(candidate)}
          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
        >
          Bookmark
        </button>

        <button
          onClick={() => onConnect?.(candidate)}
          className="flex-1 max-w-[200px] px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 rounded-xl shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95 transition-all text-center"
        >
          Connect Profile
        </button>
      </div>
    </div>
  );
}