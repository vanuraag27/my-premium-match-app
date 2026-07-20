'use client';

import { useState } from 'react';

export default function Home() {
  // Main app view tracking states
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Verification security sequence states
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [tempPayload, setTempPayload] = useState(null);

  // Profile data capture control
  const [formData, setFormData] = useState({
    userId: '',
    name: '',
    rawBio: '',
    photoUrl: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Step 1: Fire token request to the updated auth dispatch route
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.name || !formData.rawBio) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.userId }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'SMTP dispatch failure');

      setTempPayload(formData);
      setIsOtpStep(true);
    } catch (err) {
      setError(err.message || 'Error executing secure token request lifecycle.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Validate code against the explicit verification endpoint, then save profile
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Phase A: Validate token pin node matrix
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempPayload.userId, otpToken: otpCode }),
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) throw new Error(verifyResult.error || 'Code verification failed.');

      // Phase B: Pass security clearance and push data to MongoDB
      const saveResponse = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempPayload),
      });

      const saveResult = await saveResponse.json();
      if (!saveResult.success) throw new Error(saveResult.error || 'Profile persistence rejected.');

      setUserProfile(saveResult.profile);
      setMatches(saveResult.matches);
      setIsOtpStep(false);
    } catch (err) {
      setError(err.message || 'System error validating token code instance.');
    } finally {
      setLoading(false);
    }
  };

  // Lifecycle Options: Disconnect local nodes
  const handleLogOut = () => {
    setUserProfile(null);
    setMatches([]);
    setFormData({ userId: '', name: '', rawBio: '', photoUrl: '' });
    setTempPayload(null);
    setIsOtpStep(false);
    setError('');
  };

  // Lifecycle Options: Drop database profile node elements completely via DELETE call
  const handleDeleteProfile = async () => {
    if (!userProfile?.userId) return;
    if (!window.confirm("Are you absolutely sure you want to permanently delete your profile matrix record from MongoDB?")) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/onboarding?userId=${encodeURIComponent(userProfile.userId)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Server rejected destruction event pipeline.');

      // Clear layout states safely only after explicit backend success approval
      handleLogOut();
      alert("Success! Your profile node structure has been permanently wiped from the active MongoDB database registry mapping.");
    } catch (err) {
      setError(err.message || 'Fatal crash executing profile deletion engine pipeline.');
    } finally {
      setLoading(false);
    }
  };

  // Helper utility mapping structure to transform Google Drive viewing link variants to download vectors
  const getDirectDriveUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      return url
        .replace('/file/d/', '/uc?export=view&id=')
        .replace('/view?usp=sharing', '')
        .replace('/view', '');
    }
    return url;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 selection:bg-rose-500/30">
      
      {/* Visual Header Grid Zone */}
      <div className="text-center mb-8 max-w-xl">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
          Bandhan Matrix Engine
        </h1>
        <p className="text-sm text-slate-400 mt-2">Intelligent profile structural matching layer framework.</p>
      </div>

      {error && (
        <div className="w-full max-w-md bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm font-semibold mb-6 shadow-sm">
          ⚠️ Operational Exception: {error}
        </div>
      )}

      {/* THREE-PHASE VISUAL SWITCH ENGINE BLOCK */}
      {!userProfile && !isOtpStep && (
        /* ================= PHASE 1: INITIAL DATA COLLECTION ================= */
        <form onSubmit={handleOnboardingSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-5">
          <h2 className="text-xl font-bold text-slate-200 border-b border-slate-800 pb-3">Initialize Node Profile</h2>
          
          <div className="space-y-1.5">
            <label className="text-xs uppercase font-extrabold text-slate-400 block">User Email / ID</label>
            <input type="email" name="userId" required placeholder="name@domain.com" value={formData.userId} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm font-mono focus:border-rose-500/50 focus:outline-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-extrabold text-slate-400 block">Full Name</label>
            <input type="text" name="name" required placeholder="Identity Name String" value={formData.name} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:border-rose-500/50 focus:outline-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-extrabold text-slate-400 block">Google Drive Photo URL</label>
            <input type="url" name="photoUrl" placeholder="Paste global shared image address link" value={formData.photoUrl} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:border-rose-500/50 focus:outline-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-extrabold text-slate-400 block">Character Target Bio</label>
            <textarea name="rawBio" required rows={4} placeholder="Express goals, workspace workflow, traits, or temperament metrics..." value={formData.rawBio} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm resize-none focus:border-rose-500/50 focus:outline-none" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 text-white font-bold text-sm rounded-xl shadow-lg transition duration-150 disabled:opacity-50">
            {loading ? 'Dispatched Network SMTP Routing...' : 'Generate Verification OTP'}
          </button>
        </form>
      )}

      {!userProfile && isOtpStep && (
        /* ================= PHASE 2: SECURITY TOKEN CHALLENGE ================= */
        <form onSubmit={handleVerifyOtp} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-5 text-center">
          <h2 className="text-xl font-bold text-slate-200">Gateway Token Authentication</h2>
          <p className="text-xs text-slate-400">Input the 6-digit dynamic cryptographic validation code dispatched to:</p>
          <span className="text-rose-400 font-bold font-mono text-sm bg-slate-950 px-3 py-1 rounded-md inline-block mt-1 border border-slate-800">{formData.userId}</span>
          
          <input 
            type="text" 
            maxLength={6}
            required
            placeholder="******" 
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-center text-2xl font-black tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
          />

          <div className="flex gap-3">
            <button type="button" onClick={() => setIsOtpStep(false)} className="w-1/2 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={loading} className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition">
              {loading ? 'Authorizing Identity...' : 'Verify Pin & Sync'}
            </button>
          </div>
        </form>
      )}

      {userProfile && (
        /* ================= PHASE 3: LIVE NODE OPERATIONS CLUSTER VIEW ================= */
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Dashboard Left Configuration Control Core Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center md:text-left h-fit flex flex-col justify-between shadow-xl">
            <div>
              {userProfile.photoUrl ? (
                <img 
                  src={getDirectDriveUrl(userProfile.photoUrl)} 
                  alt={userProfile.name} 
                  className="w-24 h-24 rounded-full object-cover border-2 border-rose-500 mb-4 mx-auto md:mx-0 shadow-lg" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    const fallbackEl = document.createElement('div');
                    fallbackEl.className = "w-24 h-24 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 mx-auto md:mx-0 border border-amber-500/20 text-[10px] p-2 font-bold text-center";
                    fallbackEl.innerText = "Verify Link Permissions";
                    e.target.parentNode.insertBefore(fallbackEl, e.target);
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4 mx-auto md:mx-0 text-slate-500 border border-slate-700 text-xs font-bold">NO PICTURE</div>
              )}
              
              <h3 className="text-xl font-black text-white truncate">{userProfile.name}</h3>
              <p className="text-xs text-slate-500 mb-4 font-mono truncate">{userProfile.userId}</p>
              
              <div className="space-y-3 text-left bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 text-xs font-medium">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Temperament Variant</span>
                  <span className="text-amber-400 text-sm font-semibold">{userProfile.aiAnalysis?.temperament || 'Adaptive Matrix'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Trajectory Vector</span>
                  <span className="text-emerald-400 text-sm font-semibold">{userProfile.aiAnalysis?.vision || 'Innovation Target'}</span>
                </div>
              </div>
            </div>

            {/* Lifecycle Account Action Group Triggers */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
              <button onClick={handleLogOut} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition">
                🚪 Log Off Engine Node
              </button>
              <button onClick={handleDeleteProfile} disabled={loading} className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 text-xs font-bold rounded-xl border border-rose-900/50 transition disabled:opacity-40">
                {loading ? 'Purging Document...' : '🗑️ Delete Profile Matrix'}
              </button>
            </div>
          </div>

          {/* Core Matching Structural Alignments Grid List Panel */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-2xl font-black text-slate-100 flex items-center justify-between px-1">
              <span>AI Core Matches</span>
              <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full font-bold">
                {matches?.length || 0} Pool Cluster Nodes
              </span>
            </h3>

            {(!matches || matches.length === 0) ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 text-center p-12 rounded-2xl">
                <p className="text-slate-400 text-sm">Cluster database matching records indexing space empty.</p>
              </div>
            ) : (
              matches.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-md hover:border-slate-700 transition duration-150">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3.5">
                      {item.photoUrl ? (
                        <img 
                          src={getDirectDriveUrl(item.photoUrl)} 
                          alt={item.name} 
                          className="w-12 h-12 rounded-full object-cover border border-slate-700 bg-slate-950 shadow-sm"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 font-bold text-xs font-mono">AI</div>
                      )}
                      <div>
                        <h4 className="text-md font-bold text-slate-100 tracking-tight">{item.name}</h4>
                        <p className="text-xs text-slate-400 italic">Style: {item.aiAnalysis?.communication || 'Synergistic'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">{item.score}%</span>
                      <span className="text-[9px] block text-slate-500 font-extrabold uppercase tracking-widest">Weight</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 bg-slate-950/40 p-3.5 rounded-xl border border-slate-950/80 leading-relaxed">{item.bio}</p>
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </main>
  );
}