'use client';

export default function CandidateCardSkeleton() {
  return (
    <div className="w-full max-w-xl rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-6 shadow-md overflow-hidden animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md mt-1" />
          </div>
        </div>
        <div className="w-16 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>

      <div className="mt-4 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 space-y-2">
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}