// my-premium-match-app/src/components/IntakeForm.jsx
'use client';
import React, { useState } from 'react';
export default function IntakeForm({ onFormSubmit, isLoading }) {
  const [name, setName] = useState('');
  const [rawBio, setRawBio] = useState('');
  return (
    <div className="max-w-md w-full bg-slate-800/80 border border-slate-700 p-8 rounded-2xl shadow-2xl">
      <h2 className="text-2xl font-bold text-white text-center mb-2">Find True Compatibility</h2>
      <p className="text-slate-400 text-sm text-center mb-6">Our AI maps your core human values directly from your story description bio.</p>
      <form onSubmit={(e) => { e.preventDefault(); onFormSubmit({ name, rawBio }); }} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">YOUR NAME</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">DESCRIBE YOUR LIFE VISION & GOALS</label>
          <textarea rows="4" value={rawBio} onChange={(e) => setRawBio(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm" required />
        </div>
        <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 py-3 rounded-lg font-medium text-sm text-white">
          {isLoading ? 'Mapping Personality Matrix...' : 'Find Matches Engine'}
        </button>
      </form>
    </div>
  );
}