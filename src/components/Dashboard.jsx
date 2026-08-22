// File path: C:\Users\HP\Downloads\my-premium-match-app\src\components\Dashboard.jsx
'use client';
import React from 'react';

export default function Dashboard({ userState, topMatches, onUpgrade }) {
  const isPremium = userState.tier === 'premium';

  return (
    <div className="min-h-screen bg-vk-bg text-white p-6">
      <header className="max-w-5xl mx-auto flex justify-between items-center border-b border-vk-border pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Discover your next connection, {userState.name}</h1>
          <p className="text-sm text-[#B8BED8]">AI-assisted discovery</p>
        </div>
        <button onClick={onUpgrade} className={`px-4 py-2 rounded-lg text-sm font-medium ${isPremium ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#6C3CFF] text-white'}`}>
          {isPremium ? 'Premium Active' : 'Unlock Matches'}
        </button>
      </header>
      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-vk-surface p-6 rounded-xl border border-vk-border">
          <h3 className="font-semibold mb-2">Your Personality Bio Focus</h3>
          <div className="flex flex-wrap gap-1">
            {userState.aiAnalysis?.core_values?.map((v, i) => (
              <span key={i} className="bg-vk-elevated text-xs px-2 py-1 rounded">{v}</span>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 space-y-4">
          {topMatches.map((m, idx) => (
            <div key={m.candidateId} className="bg-vk-surface p-6 rounded-xl border border-vk-border relative">
              {!isPremium && idx > 0 && (
                <div className="absolute inset-0 bg-[#090D24]/80 backdrop-blur-sm flex items-center justify-center text-sm font-medium">
                  Premium Access Required
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>{m.name}</span>
                <span className="text-[#00D4FF]">{m.matchScore}% Score</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}