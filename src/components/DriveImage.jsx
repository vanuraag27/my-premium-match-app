'use client';

import { useState } from 'react';

function getDirectDriveUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const match = url.match(/(?:file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DriveImage({
  src,
  alt = 'User profile photo',
  name = 'User',
  size = 'w-20 h-20',
  className = '',
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const directUrl = getDirectDriveUrl(src);
  const initials = getInitials(name);

  if (!src) {
    return (
      <div
        className={`${size} rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-bold flex items-center justify-center shadow-md select-none shrink-0 ${className}`}
      >
        <span>{initials}</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block shrink-0 ${size} ${className}`}>
      {loading && !error && (
        <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse border border-slate-200/60 dark:border-slate-800" />
      )}

      {!error ? (
        <img
          src={directUrl}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className={`${size} rounded-full object-cover shadow-sm transition-opacity duration-300 ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      ) : (
        <div className={`${size} rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-2 shadow-inner group relative`}>
          <span className="font-bold text-slate-700 dark:text-slate-200 select-none text-sm">
            {initials}
          </span>
          <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 hidden group-hover:flex whitespace-nowrap bg-slate-900/90 backdrop-blur-sm text-white text-[11px] px-2.5 py-1 rounded-md shadow-lg z-20 items-center gap-1.5 border border-slate-700">
            <span className="text-slate-300">Image restricted</span>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-400 font-medium hover:underline"
            >
              Open Drive 🔗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}