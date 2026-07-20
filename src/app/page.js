'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  // Authentication & Session States
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Multiphase Navigation Step Switcher Matrix
  const [step, setStep] = useState('EMAIL'); // 'EMAIL', 'OTP', 'REGISTER'
  const [inputEmail, setInputEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Filtering Options Matrix Parameter State
  const [searchProfession, setSearchProfession] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Buffered Registration Onboarding Object Fields
  const [registerForm, setRegisterForm] = useState({
    name: '',
    profession: '',
    rawBio: '',
    photoUrl: ''
  });

  // Database-Backed Chat Engine System States
  const [activeChatMatch, setActiveChatMatch] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([]);

  // Loop to pull chat history automatically if communication channel stays open
  useEffect(() => {
    let internalTimer;
    if (userProfile?.userId && activeChatMatch?.userId) {
      const loadMessages = async () => {
        try {
          const res = await fetch(`/api/messages?senderId=${encodeURIComponent(userProfile.userId)}&receiverId=${encodeURIComponent(activeChatMatch.userId)}`);
          const data = await res.json();
          if (data.success) {
            setChatLogs(data.messages);
          }
        } catch (err) {
          console.error("Failed syncing chat matrix records:", err);
        }
      };

      loadMessages();
      internalTimer = setInterval(loadMessages, 3500); // Live poll sync updates every 3.5s
    } else {
      setChatLogs([]);
    }
    return () => clearInterval(internalTimer);
  }, [activeChatMatch, userProfile]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!inputEmail) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputEmail.trim() }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'OTP dispatch routing error.');
      setStep('OTP');
    } catch (err) {
      setError(err.message || 'Error processing system gateway token verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputEmail.trim(), otpToken: otpCode }),
      });
      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) throw new Error(verifyResult.error || 'Authentication credential failure.');

      const profileCheckResponse = await fetch(`/api/onboarding?userId=${encodeURIComponent(inputEmail.trim())}`);
      const checkResult = await profileCheckResponse.json();

      if (!checkResult.success) throw new Error(checkResult.error || 'Profile structure sync exception.');

      if (checkResult.exists) {
        setUserProfile(checkResult.profile);
        setMatches(checkResult.matches);
      } else {
        setStep('REGISTER');
      }
    } catch (err) {
      setError(err.message || 'Gateway operational breakdown.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: inputEmail.trim(),
          ...registerForm
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Registration write operation rejected.');

      setUserProfile(result.profile);
      setMatches(result.matches);
    } catch (err) {
      setError(err.message || 'Error committing user data models.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async (e) => {
    if (e) e.preventDefault();
    if (!userProfile?.userId) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userProfile,
          searchProfession,
          searchKeyword
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Query filtering structure execution failure.');
      setMatches(result.matches);
    } catch (err) {
      setError(err.message || 'Timeout tracing filtering clusters.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !userProfile?.userId || !activeChatMatch?.userId) return;

    const textToSend = chatMessage.trim();
    setChatMessage('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userProfile.userId,
          receiverId: activeChatMatch.userId,
          messageText: textToSend
        }),
      });
      const result = await response.json();
      if (result.success) {
        setChatLogs((prev) => [...prev, result.message]);
      }
    } catch (err) {
      console.error("Transmission breakdown:", err);
    }
  };

  const handleLogOut = () => {
    setUserProfile(null);
    setMatches([]);
    setInputEmail('');
    setOtpCode('');
    setRegisterForm({ name: '', profession: '', rawBio: '', photoUrl: '' });
    setSearchProfession('');
    setSearchKeyword('');
    setActiveChatMatch(null);
    setStep('EMAIL');
    setError('');
  };

  const handleDeleteProfile = async () => {
    if (!userProfile?.userId) return;
    if (!window.confirm("Permanently wipe profile records from database?")) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/onboarding?userId=${encodeURIComponent(userProfile.userId)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Server rejection.');
      handleLogOut();
      alert("Profile node elements completely cleared from cluster database.");
    } catch (err) {
      setError(err.message || 'Fault processing deletion transaction logic.');
    } finally {
      setLoading(false);
    }
  };

  const getDirectDriveUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      return url.replace('/file/d/', '/uc?export=view&id=').replace('/view?usp=sharing', '').replace('/view', '');
    }
    return url;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 selection:bg-rose-500/30">
      
      {/* Dynamic Branding Layout Grid */}
      <div className="text-center mb-8 max-w-xl">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
          Bandhan Matrix Engine
        </h1>
        <p className="text-sm text-slate-400 mt-2">Intelligent profile structural matching layer framework.</p>
      </div>

      {error && (
        <div className="w-full max-w-md bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm font-semibold mb-6">
          ⚠️ Operational Exception: {error}
        </div>
      )}

      {/* STEP CONFIGURATOR ROUTING GATEWAY MODAL */}
      {!userProfile && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          
          {step === 'EMAIL' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <h2 className="text-xl font-bold text-slate-200 border-b border-slate-800 pb-3">Sign In / Join Gateway</h2>
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-extrabold text-slate-400 block">User Email ID</label>
                <input type="email" required placeholder="name@domain.com" value={inputEmail} onChange={(e) => setInputEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm font-mono focus:border-rose-500/50 focus:outline-none" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm rounded-xl transition disabled:opacity-50">
                {loading ? 'Dispatched Access Arrays...' : 'Send Verification OTP'}
              </button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
              <h2 className="text-xl font-bold text-slate-200">Gateway Token Authentication</h2>
              <p className="text-xs text-slate-400">Input security code verification matrix pin sent to:</p>
              <span className="text-rose-400 font-bold font-mono text-xs bg-slate-950 px-3 py-1 rounded-md border border-slate-800">{inputEmail}</span>
              
              <input type="text" maxLength={6} required placeholder="******" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-center text-2xl font-black tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono" />
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('EMAIL')} className="w-1/2 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition hover:bg-slate-700">Back</button>
                <button type="submit" disabled={loading} className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition">
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 'REGISTER' && (
            <form onSubmit={handleRegisterProfileSubmit} className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 font-medium text-center">
                ✨ Account node mapping entry clean. Finish setting up profile data.
              </div>
              <h2 className="text-xl font-bold text-slate-200 border-b border-slate-800 pb-2">Complete Profile Setup</h2>
              
              <div className="space-y-1">
                <label className="text-xs uppercase font-extrabold text-slate-400 block">Full Name</label>
                <input type="text" required placeholder="Display Name String" value={registerForm.name} onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50" />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-extrabold text-slate-400 block">Core Profession</label>
                <input type="text" required placeholder="e.g. Software Engineer, Analyst" value={registerForm.profession} onChange={(e) => setRegisterForm(prev => ({ ...prev, profession: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50" />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-extrabold text-slate-400 block">Photo URL Link</label>
                <input type="url" placeholder="Paste image share address string" value={registerForm.photoUrl} onChange={(e) => setRegisterForm(prev => ({ ...prev, photoUrl: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500/50" />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-extrabold text-slate-400 block">Character Target Bio</label>
                <textarea required rows={3} placeholder="Express traits, occupation context or core vision variables..." value={registerForm.rawBio} onChange={(e) => setRegisterForm(prev => ({ ...prev, rawBio: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:border-rose-500/50" />
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm rounded-xl transition">
                {loading ? 'Instantiating Profile...' : 'Create Account & Login'}
              </button>
            </form>
          )}

        </div>
      )}

      {/* CORE GRAPHICAL DASHBOARD COMPONENT MATRIX LAYER */}
      {userProfile && (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* User Profile Metrics Display Drawer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit flex flex-col justify-between shadow-xl">
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
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4 mx-auto md:mx-0 text-slate-500 text-xs font-bold border border-slate-700">NO IMAGE</div>
              )}
              
              <h3 className="text-xl font-black text-white truncate">{userProfile.name}</h3>
              <p className="text-xs text-rose-400 font-bold mb-1 tracking-wide">{userProfile.profession || 'Developer'}</p>
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

            <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
              <button onClick={handleLogOut} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition">
                🚪 Log Off Engine Node
              </button>
              <button onClick={handleDeleteProfile} disabled={loading} className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 text-xs font-bold rounded-xl border border-rose-900/50 transition">
                🗑️ Delete Profile Matrix
              </button>
            </div>
          </div>

          {/* Matches Workspace Core Stream */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Real-time Cluster Query Interface Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row gap-3 items-end">
              <div className="w-full sm:w-1/2 space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Filter by Profession</label>
                <input type="text" placeholder="e.g. Engineer, Designer" value={searchProfession} onChange={(e) => setSearchProfession(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500/30" />
              </div>
              <div className="w-full sm:w-1/2 space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Keyword Search</label>
                <input type="text" placeholder="Search names or bio details..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500/30" />
              </div>
              <button onClick={handleApplyFilters} disabled={loading} className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow transition whitespace-nowrap disabled:opacity-50">
                {loading ? 'Filtering...' : 'Apply Filters'}
              </button>
            </div>

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
                <div key={item.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-md hover:border-slate-700 transition duration-200">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3.5">
                      {item.photoUrl ? (
                        <img src={getDirectDriveUrl(item.photoUrl)} alt={item.name} className="w-12 h-12 rounded-full object-cover border border-slate-700 bg-slate-950 shadow" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'; }} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 font-bold text-xs font-mono">AI</div>
                      )}
                      <div>
                        <h4 className="text-md font-bold text-slate-100 tracking-tight">{item.name}</h4>
                        <p className="text-xs text-amber-400 font-semibold">{item.profession || 'Partner'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">{item.score}%</span>
                      <span className="text-[9px] block text-slate-500 font-extrabold uppercase tracking-widest">Alignment</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 bg-slate-950/40 p-3.5 rounded-xl border border-slate-950/80 leading-relaxed">{item.bio}</p>
                  
                  {/* Dynamic AI Compatibility Accordion Element */}
                  <div className="mt-3 bg-slate-950/80 border border-slate-800/80 rounded-xl overflow-hidden text-xs">
                    <details className="group">
                      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none font-bold text-slate-400 hover:text-rose-400 transition">
                        <span>🤖 View AI Core Compatibility Analysis</span>
                        <span className="text-[10px] transition group-open:rotate-180">▼</span>
                      </summary>
                      <div className="px-3 pb-3 pt-1 border-t border-slate-900 text-slate-300 space-y-2 font-medium">
                        <p className="italic text-slate-400 leading-relaxed bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                          {item.aiAnalysis?.breakdown}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider font-mono">
                          <div className="bg-slate-900 p-2 rounded border border-slate-800/40">
                            <span className="text-slate-500 block">Communication</span>
                            <span className="text-emerald-400 block truncate font-bold">{item.aiAnalysis?.communication}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded border border-slate-800/40">
                            <span className="text-slate-500 block">Matrix Type</span>
                            <span className="text-amber-400 block truncate font-bold">{item.aiAnalysis?.temperament}</span>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Persistent Messaging Switcher Node Action Trigger */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-end">
                    <button
                      onClick={() => setActiveChatMatch(item)}
                      className="px-4 py-1.5 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 text-slate-300 hover:text-emerald-400 font-bold text-xs rounded-xl shadow transition duration-150"
                    >
                      💬 Open Secure Signal Route
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DYNAMIC DATABASE MESSAGING SLIDE PANEL CONTAINER */}
      {activeChatMatch && (
        <div className="fixed bottom-6 right-6 w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          <div className="bg-gradient-to-r from-slate-950 to-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <div>
                <h4 className="text-xs font-black text-slate-200 tracking-wide truncate max-w-[180px]">{activeChatMatch.name}</h4>
                <span className="text-[9px] font-mono text-emerald-400 block font-bold">Signal Match Weight: {activeChatMatch.score}%</span>
              </div>
            </div>
            <button 
              onClick={() => setActiveChatMatch(null)}
              className="text-slate-500 hover:text-slate-300 text-sm font-bold bg-slate-950 w-6 h-6 rounded-lg flex items-center justify-center border border-slate-800 transition"
            >
              ✕
            </button>
          </div>

          {/* Active Data Payload Logs Scroll Area */}
          <div className="p-4 h-64 overflow-y-auto bg-slate-950/50 space-y-2.5 flex flex-col">
            <div className="text-center p-1 mb-1">
              <span className="text-[9px] text-slate-600 font-mono tracking-tight bg-slate-950 border border-slate-900 px-3 py-0.5 rounded-full">
                🔒 Database sync channel connection secure
              </span>
            </div>
            
            {chatLogs.map((msg, index) => {
              const isMe = msg.senderId === userProfile.userId;
              return (
                <div 
                  key={index} 
                  className={`max-w-[80%] p-2.5 rounded-2xl text-xs leading-relaxed border ${
                    isMe 
                      ? 'bg-rose-600/20 border-rose-500/30 text-rose-200 rounded-br-none self-end' 
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-300 rounded-tl-none self-start'
                  }`}
                >
                  {msg.messageText}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
            <input 
              type="text"
              placeholder="Type a secure transmission payload..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500/50 font-medium"
            />
            <button 
              type="submit"
              disabled={!chatMessage.trim()}
              className="px-4 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white text-xs font-bold rounded-xl shadow transition duration-150"
            >
              Send
            </button>
          </form>

        </div>
      )}

    </main>
  );
}