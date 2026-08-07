'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

export default function Home() {
  // Authentication & Session Core States
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  // Multiphase Navigation State Matrix
  const [step, setStep] = useState('EMAIL'); // 'EMAIL', 'OTP', 'REGISTER'
  const [inputEmail, setInputEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Filtering Options State Triggers
  const [searchProfession, setSearchProfession] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  // Match percentage range filter — disabled by default to preserve existing behaviour
  const [matchFilterEnabled, setMatchFilterEnabled] = useState(false);
  const [minMatchPercent, setMinMatchPercent] = useState(75);
  const [maxMatchPercent, setMaxMatchPercent] = useState(100);

  // Buffered Registration Form Matrix
  const [registerForm, setRegisterForm] = useState({
    name: '',
    profession: '',
    rawBio: '',
    photoUrl: '',
    audioNotificationsEnabled: true
  });
  const [registerImageError, setRegisterImageError] = useState('');

  // Dynamic Profile Modification Drawer State Controls
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    profession: '',
    rawBio: '',
    photoUrl: '',
    audioNotificationsEnabled: true
  });
  const [editImageError, setEditImageError] = useState('');

  // Database-Backed Chat Engine System States
  const [activeChatMatch, setActiveChatMatch] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([]);

  // Message Request Approval System States
  const [messageRequests, setMessageRequests] = useState([]);
  const [connectionStatuses, setConnectionStatuses] = useState({});
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [showSendRequestModal, setShowSendRequestModal] = useState(false);
  const [requestTargetMatch, setRequestTargetMatch] = useState(null);
  const [requestMessageText, setRequestMessageText] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);

  // --- New Message Audio Notification refs ---
  const notificationAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const seenMessageIdsRef = useRef(null);
  const activeChatKeyRef = useRef(null);
  const seenNotificationIdsRef = useRef(new Set());

  // Reusable helper for handling local image uploads
  const handlePhotoUpload = (e, setForm, setErrorState) => {
    const file = e.target.files?.[0];
    setErrorState('');

    if (!file) return;

    // Check File Extension & MIME Type (.jpg, .jpeg, .png)
    const validExtensions = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(file.type) && !['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      setErrorState('Unsupported file type. Only .jpg, .jpeg, and .png formats are allowed.');
      e.target.value = '';
      return;
    }

    // Restrict size to maximum 200 KB
    if (file.size > 200 * 1024) {
      setErrorState(`File size exceeds limit (Max 200 KB). Current size: ${(file.size / 1024).toFixed(1)} KB.`);
      e.target.value = '';
      return;
    }

    // Read and encode base64 preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm((prev) => ({ ...prev, photoUrl: event.target.result }));
    };
    reader.onerror = () => {
      setErrorState('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  // Create the single Audio instance once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio('/notification.mp3');
    audio.preload = 'auto';
    audio.volume = 1.0;
    audio.addEventListener('error', () => {
      console.error('Notification sound failed to load: /notification.mp3 is missing or inaccessible.');
    });
    notificationAudioRef.current = audio;

    return () => {
      audio.pause();
      notificationAudioRef.current = null;
    };
  }, []);

  // Unlock playback on initial user gesture
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      if (audioUnlockedRef.current || !notificationAudioRef.current) return;
      const audio = notificationAudioRef.current;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audioUnlockedRef.current = true;
          })
          .catch(() => {});
      } else {
        audioUnlockedRef.current = true;
      }
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((evt) => window.addEventListener(evt, unlockAudio, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, unlockAudio));
    };
  }, []);

  const playNotificationSound = () => {
    // Audio Notification Toggle evaluation
    if (userProfile?.audioNotificationsEnabled === false) return;

    const audio = notificationAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch((err) => {
          console.warn('Notification sound could not play:', err);
        });
      }
    } catch (err) {
      console.warn('Notification sound playback error:', err);
    }
  };

  // Toast System Handler Utility Function
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Build filter payload including optional match percentage range
  const buildFilterPayload = (profile) => {
    const payload = {
      ...profile,
      searchProfession,
      searchKeyword,
    };
    if (matchFilterEnabled) {
      payload.minMatchPercent = minMatchPercent;
      payload.maxMatchPercent = maxMatchPercent;
    }
    return payload;
  };

  // Load message requests and derive per-match connection statuses
  const loadMessageRequests = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/message-requests?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) {
        setMessageRequests(data.requests || []);
        setConnectionStatuses((prev) => {
          const statusMap = { ...prev };
          (data.requests || []).forEach((req) => {
            const otherId = req.senderId === userId ? req.receiverId : req.senderId;
            if (req.requestStatus === 'Accepted') {
              statusMap[otherId] = 'accepted';
            } else if (req.requestStatus === 'Pending') {
              statusMap[otherId] = req.senderId === userId ? 'pending_sent' : 'pending_received';
            } else if (req.requestStatus === 'Rejected' && req.senderId === userId) {
              statusMap[otherId] = 'rejected';
            }
          });
          return statusMap;
        });
      }
    } catch (err) {
      console.error('Failed to load message requests:', err);
    }
  };

  // Poll notifications and surface via existing toast + audio system
  const pollNotifications = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        const newNotifications = data.notifications.filter(
          (n) => !seenNotificationIdsRef.current.has(String(n._id))
        );
        if (newNotifications.length > 0) {
          newNotifications.forEach((n) => {
            seenNotificationIdsRef.current.add(String(n._id));
            showToast(n.body || n.title);
          });
          playNotificationSound();
          await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              notificationIds: newNotifications.map((n) => n._id),
            }),
          });
          await loadMessageRequests(userId);
        }
      }
    } catch (err) {
      console.error('Failed to poll notifications:', err);
    }
  };

  // Poll message requests and notifications while logged in
  useEffect(() => {
    if (!userProfile?.userId) return;
    loadMessageRequests(userProfile.userId);
    pollNotifications(userProfile.userId);
    const timer = setInterval(() => {
      loadMessageRequests(userProfile.userId);
      pollNotifications(userProfile.userId);
    }, 5000);
    return () => clearInterval(timer);
  }, [userProfile?.userId]);

  // Handle message button click based on connection status
  const handleMessageClick = (item) => {
    const status = connectionStatuses[item.userId] || 'none';
    if (status === 'accepted') {
      setActiveChatMatch(item);
    } else if (status === 'pending_sent') {
      showToast('Your message request is pending approval.');
    } else if (status === 'pending_received') {
      setShowRequestsPanel(true);
    } else if (status === 'rejected') {
      showToast('Your message request was declined. Messaging is not available.');
    } else {
      setRequestTargetMatch(item);
      setRequestMessageText('');
      setShowSendRequestModal(true);
    }
  };

  // Send first message as a message request
  const handleSendMessageRequest = async (e) => {
    e.preventDefault();
    if (!requestMessageText.trim() || !userProfile?.userId || !requestTargetMatch?.userId) return;
    setRequestLoading(true);
    try {
      const response = await fetch('/api/message-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userProfile.userId,
          receiverId: requestTargetMatch.userId,
          firstMessage: requestMessageText.trim(),
          matchPercentage: requestTargetMatch.score,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to send message request.');
      showToast('Message request sent! Waiting for approval.');
      setShowSendRequestModal(false);
      setRequestMessageText('');
      await loadMessageRequests(userProfile.userId);
    } catch (err) {
      showToast(err.message || 'Error sending message request.');
    } finally {
      setRequestLoading(false);
    }
  };

  // Accept an incoming message request
  const handleAcceptRequest = async (request) => {
    setRequestLoading(true);
    try {
      const response = await fetch('/api/message-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request._id,
          userId: userProfile.userId,
          action: 'accept',
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to accept request.');
      showToast('Message request accepted! Chat is now open.');
      await loadMessageRequests(userProfile.userId);
      const matchItem = matches.find((m) => m.userId === request.senderId) || {
        userId: request.senderId,
        name: request.senderName,
        photoUrl: request.senderPhotoUrl,
        score: request.matchPercentage || 0,
        profession: request.senderProfession,
      };
      setActiveChatMatch(matchItem);
      setShowRequestsPanel(false);
    } catch (err) {
      showToast(err.message || 'Error accepting request.');
    } finally {
      setRequestLoading(false);
    }
  };

  // Reject an incoming message request
  const handleRejectRequest = async (request) => {
    setRequestLoading(true);
    try {
      const response = await fetch('/api/message-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request._id,
          userId: userProfile.userId,
          action: 'reject',
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to reject request.');
      showToast('Message request declined.');
      await loadMessageRequests(userProfile.userId);
    } catch (err) {
      showToast(err.message || 'Error rejecting request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const incomingPendingRequests = messageRequests.filter(
    (r) => r.receiverId === userProfile?.userId && r.requestStatus === 'Pending'
  );

  // Toggle Audio Notifications directly and sync to DB
  const handleToggleAudioNotifications = async () => {
    if (!userProfile) return;
    const updatedState = !userProfile.audioNotificationsEnabled;
    
    // Optimistic UI updates
    setUserProfile((prev) => ({ ...prev, audioNotificationsEnabled: updatedState }));
    setEditForm((prev) => ({ ...prev, audioNotificationsEnabled: updatedState }));

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userProfile,
          audioNotificationsEnabled: updatedState
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update preferences.');
      showToast(updatedState ? "Audio alerts enabled" : "Audio alerts muted");
    } catch (err) {
      console.error("Failed to update notification setting:", err);
      // Rollback on error
      setUserProfile((prev) => ({ ...prev, audioNotificationsEnabled: !updatedState }));
      setEditForm((prev) => ({ ...prev, audioNotificationsEnabled: !updatedState }));
      showToast("Error updating notification settings");
    }
  };

  // Loop to pull live message logs
  useEffect(() => {
    let internalTimer;
    if (userProfile?.userId && activeChatMatch?.userId) {
      const chatKey = `${userProfile.userId}::${activeChatMatch.userId}`;
      if (activeChatKeyRef.current !== chatKey) {
        activeChatKeyRef.current = chatKey;
        seenMessageIdsRef.current = null;
      }

      const loadMessages = async () => {
        try {
          const res = await fetch(`/api/messages?senderId=${encodeURIComponent(userProfile.userId)}&receiverId=${encodeURIComponent(activeChatMatch.userId)}`);
          const data = await res.json();
          if (data.success) {
            const incomingMessages = Array.isArray(data.messages) ? data.messages : [];
            const isFirstLoadForThisChat = seenMessageIdsRef.current === null;
            const previouslySeenIds = seenMessageIdsRef.current || new Set();

            if (!isFirstLoadForThisChat) {
              const hasNewIncomingMessage = incomingMessages.some(
                (msg) =>
                  String(msg.senderId) !== String(userProfile.userId) &&
                  !previouslySeenIds.has(String(msg._id))
              );
              if (hasNewIncomingMessage) {
                playNotificationSound();
              }
            }

            seenMessageIdsRef.current = new Set(incomingMessages.map((msg) => String(msg._id)));
            setChatLogs(incomingMessages);
          }
        } catch (err) {
          console.error("Failed syncing chat records:", err);
        }
      };

      loadMessages();
      internalTimer = setInterval(loadMessages, 3500);
    } else {
      setChatLogs([]);
      seenMessageIdsRef.current = null;
      activeChatKeyRef.current = null;
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
      if (!result.success) throw new Error(result.error || 'OTP routing error.');
      setStep('OTP');
      showToast("Security code token dispatched to secure address registry.");
    } catch (err) {
      setError(err.message || 'Error processing authentication verification.');
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

      if (!checkResult.success) throw new Error(checkResult.error || 'Profile matrix trace exception.');

      if (checkResult.exists) {
        setUserProfile(checkResult.profile);
        setMatches(checkResult.matches);
        const statusMap = {};
        (checkResult.matches || []).forEach((m) => {
          if (m.connectionStatus) statusMap[m.userId] = m.connectionStatus;
        });
        setConnectionStatuses(statusMap);
        setEditForm({
          name: checkResult.profile.name || '',
          profession: checkResult.profile.profession || '',
          rawBio: checkResult.profile.rawBio || '',
          photoUrl: checkResult.profile.photoUrl || '',
          audioNotificationsEnabled: checkResult.profile.audioNotificationsEnabled !== undefined ? checkResult.profile.audioNotificationsEnabled : true
        });
        showToast("Gateway connection verification authenticated.");
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
    if (registerImageError) return;
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
      if (!result.success) throw new Error(result.error || 'Registration cluster node rejected.');

      setUserProfile(result.profile);
      setMatches(result.matches);
      const statusMap = {};
      (result.matches || []).forEach((m) => {
        if (m.connectionStatus) statusMap[m.userId] = m.connectionStatus;
      });
      setConnectionStatuses(statusMap);
      setEditForm({
        name: result.profile.name || '',
        profession: result.profile.profession || '',
        rawBio: result.profile.rawBio || '',
        photoUrl: result.profile.photoUrl || '',
        audioNotificationsEnabled: result.profile.audioNotificationsEnabled !== undefined ? result.profile.audioNotificationsEnabled : true
      });
      showToast("Profile node successfully committed to cluster database.");
    } catch (err) {
      setError(err.message || 'Error processing onboarding models.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfileSubmit = async (e) => {
    e.preventDefault();
    if (editImageError) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.userId,
          ...editForm,
          searchProfession,
          searchKeyword,
          ...(matchFilterEnabled ? { minMatchPercent, maxMatchPercent } : {}),
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Profile modify mutation rejected.');

      setUserProfile(result.profile);
      setMatches(result.matches);
      const statusMap = {};
      (result.matches || []).forEach((m) => {
        if (m.connectionStatus) statusMap[m.userId] = m.connectionStatus;
      });
      setConnectionStatuses(statusMap);
      setIsEditModalOpen(false);
      showToast("Profile schema changes safely written down to cluster indexing shards.");
    } catch (err) {
      setError(err.message || 'Fault processing configuration update logic.');
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
        body: JSON.stringify(buildFilterPayload(userProfile)),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Filtering array failure.');
      setMatches(result.matches);
      // Sync connection statuses from enriched match data
      const statusMap = {};
      (result.matches || []).forEach((m) => {
        if (m.connectionStatus) statusMap[m.userId] = m.connectionStatus;
      });
      setConnectionStatuses((prev) => ({ ...prev, ...statusMap }));
      showToast("Vector matching array search calculation index refreshed.");
    } catch (err) {
      setError(err.message || 'Timeout tracing query segments.');
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
      } else if (result.requiresApproval) {
        showToast('Messaging requires an accepted message request.');
      }
    } catch (err) {
      console.error("Signal payload routing error:", err);
    }
  };

  const handleLogOut = () => {
    setUserProfile(null);
    setMatches([]);
    setInputEmail('');
    setOtpCode('');
    setRegisterForm({ name: '', profession: '', rawBio: '', photoUrl: '', audioNotificationsEnabled: true });
    setRegisterImageError('');
    setEditImageError('');
    setSearchProfession('');
    setSearchKeyword('');
    setMatchFilterEnabled(false);
    setMinMatchPercent(75);
    setMaxMatchPercent(100);
    setMessageRequests([]);
    setConnectionStatuses({});
    setShowRequestsPanel(false);
    setShowSendRequestModal(false);
    setActiveChatMatch(null);
    setStep('EMAIL');
    setError('');
    showToast("Session connection terminated successfully.");
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

  // Structured JSON-LD Schema for Generative Engine Optimization (GEO)
  const schemaOrgData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "VibeKey",
    "alternateName": "VibeKey - AI Network for Careers, Community & Connections",
    "applicationCategory": "SocialNetworkingApplication",
    "operatingSystem": "Web",
    "description": "VibeKey is an open-ended social and professional networking platform that uses AI vector matching to connect young adults for career opportunities, friendships, and meaningful relationships.",
    "keywords": "AI social network, professional networking for young adults, friendship and networking app, smart matchmaking platform"
  };

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#1B1B1D] flex flex-col items-center justify-center p-4 md:p-8 selection:bg-[#EF3E56]/20">

      {/* FONT IMPORTS */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Poppins', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* GEO & AI ENGINE SEARCH INDEXING METADATA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgData) }}
      />

      {/* VibeKey Brand Logo — Header (top-left corner) */}
      <div className="w-full flex items-center justify-start mb-2 md:mb-4">
        <Image
          src="/vibekey-logo.png"
          alt="VibeKey Logo"
          width={1254}
          height={1254}
          priority
          className="h-8 sm:h-9 md:h-12 w-auto object-contain select-none"
        />
      </div>

      {/* GLOBAL NOTIFICATION SYSTEM BANNER FLOATER */}
      {toastMessage && (
        <div className="fixed top-5 right-5 bg-white text-[#1B1B1D] text-xs font-bold font-body px-5 py-3 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-[#ECE9E4] z-50 animate-in fade-in slide-in-from-top-3 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#EF3E56]" />
          {toastMessage}
        </div>
      )}

      {/* Dynamic Branding Layout Grid */}
      <div className="text-center mb-10 max-w-3xl px-2">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-[#FFF1E9] border border-[#FFD9C2]">
          <span className="w-2 h-2 rounded-full bg-[#EF3E56]" />
          <span className="text-[11px] font-body font-bold tracking-wide text-[#B23349] uppercase">Made for real connections</span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight text-[#1B1B1D]">
          Vibe<span className="text-[#EF3E56]">Key</span>
        </h1>
        <h2 className="font-body text-base md:text-lg font-medium text-[#6E6D72] mt-3 max-w-xl mx-auto">
          Where careers, community, and real connections come together.
        </h2>

        {/* GEO Definition Statement Banner */}
        <div className="w-full max-w-2xl mx-auto my-6 text-center">
          <p className="font-body text-xs text-[#6E6D72] leading-relaxed bg-white p-4 rounded-2xl border border-[#ECE9E4] shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            VibeKey is an open-ended social and professional networking platform that uses AI vector matching to connect young adults for career opportunities, friendships, and meaningful relationships.
          </p>
        </div>
      </div>

      {error && (
        <div className="w-full max-w-md bg-[#FDECEC] border border-[#F6C4C9] text-[#C4283F] p-4 rounded-2xl text-sm font-semibold mb-6 font-body">
          ⚠️ {error}
        </div>
      )}

      {/* STEP CONFIGURATOR ROUTING GATEWAY MODAL */}
      {!userProfile && (
        <div className="w-full max-w-md bg-white border border-[#ECE9E4] rounded-3xl p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          
          {step === 'EMAIL' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <h3 className="font-display text-xl font-bold text-[#1B1B1D] border-b border-[#ECE9E4] pb-3">Sign in or join VibeKey</h3>
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Email address</label>
                <input type="email" required placeholder="name@domain.com" value={inputEmail} onChange={(e) => setInputEmail(e.target.value)} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2.5 text-[#1B1B1D] text-sm font-body focus:border-[#EF3E56] focus:outline-none focus:ring-2 focus:ring-[#EF3E56]/15 transition" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-[#EF3E56] hover:bg-[#D42E44] text-white font-display font-bold text-sm rounded-full transition disabled:opacity-50 shadow-[0_8px_20px_rgba(239,62,86,0.3)]">
                {loading ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
              <h3 className="font-display text-xl font-bold text-[#1B1B1D]">Enter your code</h3>
              <p className="text-xs text-[#6E6D72] font-body">We sent a verification code to:</p>
              <span className="text-[#EF3E56] font-bold font-body text-xs bg-[#FFF1E9] px-3 py-1 rounded-full border border-[#FFD9C2] inline-block">{inputEmail}</span>
              
              <input type="text" maxLength={6} required placeholder="******" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl py-3 text-center text-2xl font-bold tracking-widest text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56] font-display" />
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('EMAIL')} className="w-1/2 py-2.5 bg-[#F1EFEB] text-[#1B1B1D] rounded-full text-xs font-bold border border-[#ECE9E4] transition hover:bg-[#E9E6E1] font-display">Back</button>
                <button type="submit" disabled={loading} className="w-1/2 py-2.5 bg-[#EF3E56] hover:bg-[#D42E44] text-white rounded-full text-xs font-bold transition shadow-[0_8px_20px_rgba(239,62,86,0.3)] font-display">
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>
              </div>
            </form>
          )}

          {step === 'REGISTER' && (
            <form onSubmit={handleRegisterProfileSubmit} className="space-y-4">
              <div className="bg-[#FFF1E9] border border-[#FFD9C2] rounded-xl p-3 text-xs text-[#B23349] font-semibold text-center font-body">
                🎉 You're in — let's finish setting up your profile.
              </div>
              <h3 className="font-display text-xl font-bold text-[#1B1B1D] border-b border-[#ECE9E4] pb-2">Complete your profile</h3>
              
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Full name</label>
                <input type="text" required placeholder="Display name" value={registerForm.name} onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56] font-body" />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Profession or role</label>
                <input type="text" required placeholder="e.g. Software Engineer, Student, Founder" value={registerForm.profession} onChange={(e) => setRegisterForm(prev => ({ ...prev, profession: e.target.value }))} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56] font-body" />
              </div>

              {/* Profile Photo File Upload Field */}
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Profile photo</label>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png" 
                  onChange={(e) => handlePhotoUpload(e, setRegisterForm, setRegisterImageError)} 
                  className="w-full text-xs text-[#6E6D72] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#EF3E56] file:text-white hover:file:bg-[#D42E44] cursor-pointer bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl p-1 font-body" 
                />
                <p className="text-[10px] text-[#9B9A9D] font-body">Formats: .jpg, .jpeg, .png (max 200 KB)</p>
                {registerImageError && (
                  <p className="text-xs text-[#C4283F] font-semibold mt-1 font-body">{registerImageError}</p>
                )}
                {registerForm.photoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={registerForm.photoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#EF3E56]" />
                    <span className="text-[10px] text-[#1E9E6B] font-body font-bold">Looking good!</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Bio & interests</label>
                <textarea required rows={3} placeholder="Tell us about yourself, career goals, or what brings you to VibeKey..." value={registerForm.rawBio} onChange={(e) => setRegisterForm(prev => ({ ...prev, rawBio: e.target.value }))} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] resize-none focus:outline-none focus:border-[#EF3E56] font-body" />
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 bg-[#EF3E56] hover:bg-[#D42E44] text-white font-display font-bold text-sm rounded-full transition shadow-[0_8px_20px_rgba(239,62,86,0.3)]">
                {loading ? 'Creating profile…' : 'Create account & log in'}
              </button>
            </form>
          )}

        </div>
      )}

      {/* CORE GRAPHICAL DASHBOARD COMPONENT MATRIX LAYER */}
      {userProfile && (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* User Profile Metrics Display Drawer */}
          <div className="bg-white border border-[#ECE9E4] rounded-3xl p-6 h-fit flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <div>
              {userProfile.photoUrl ? (
                <img 
                  src={getDirectDriveUrl(userProfile.photoUrl)} 
                  alt={userProfile.name} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#FFF1E9] mb-4 mx-auto md:mx-0 shadow-sm" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    const fallbackEl = document.createElement('div');
                    fallbackEl.className = "w-24 h-24 rounded-full bg-[#FFF1E9] text-[#B23349] flex items-center justify-center mb-4 mx-auto md:mx-0 border border-[#FFD9C2] text-[10px] p-2 font-bold text-center font-body";
                    fallbackEl.innerText = "Verify link permissions";
                    e.target.parentNode.insertBefore(fallbackEl, e.target);
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#F1EFEB] flex items-center justify-center mb-4 mx-auto md:mx-0 text-[#9B9A9D] text-xs font-bold border border-[#ECE9E4] font-body">NO IMAGE</div>
              )}
              
              <h3 className="font-display text-xl font-bold text-[#1B1B1D] truncate text-center md:text-left">{userProfile.name}</h3>
              <p className="text-xs text-[#EF3E56] font-bold mb-1 tracking-wide font-body uppercase text-center md:text-left">{userProfile.profession || 'Professional'}</p>
              <p className="text-xs text-[#9B9A9D] mb-4 font-body truncate text-center md:text-left">{userProfile.userId}</p>
              
              <div className="space-y-3 text-left bg-[#FAF8F5] p-4 rounded-2xl border border-[#ECE9E4] text-xs font-medium mb-4 font-body">
                <div>
                  <span className="text-[10px] text-[#9B9A9D] block uppercase font-bold tracking-wide">Temperament</span>
                  <span className="text-[#B26A00] text-sm font-semibold">{userProfile.aiAnalysis?.temperament || 'Adaptive Matrix'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#9B9A9D] block uppercase font-bold tracking-wide">Trajectory</span>
                  <span className="text-[#1E9E6B] text-sm font-semibold">{userProfile.aiAnalysis?.vision || 'Innovation Target'}</span>
                </div>
              </div>

              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="w-full py-2 bg-[#FFF1E9] hover:bg-[#FFE4D3] text-[#B23349] border border-[#FFD9C2] font-display font-bold text-xs rounded-full transition duration-150 mb-2"
              >
                📝 Edit profile
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-[#ECE9E4] space-y-2">
              <button onClick={handleLogOut} className="w-full py-2.5 bg-[#F1EFEB] hover:bg-[#E9E6E1] text-[#1B1B1D] text-xs font-bold rounded-full transition font-display border border-[#ECE9E4]">
                Log out
              </button>
              <button onClick={handleDeleteProfile} disabled={loading} className="w-full py-2.5 bg-white hover:bg-[#FDECEC] text-[#C4283F] text-xs font-bold rounded-full border border-[#F6C4C9] transition font-display">
                Delete profile
              </button>
            </div>
          </div>

          {/* Matches Workspace Core Stream */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Real-time Cluster Query Interface Box */}
            <div className="bg-white border border-[#ECE9E4] rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="w-full sm:w-1/2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Filter by profession</label>
                  <input type="text" placeholder="e.g. Engineer, Student, Creator" value={searchProfession} onChange={(e) => setSearchProfession(e.target.value)} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-3 py-2 text-xs text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56] font-body" />
                </div>
                <div className="w-full sm:w-1/2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#6E6D72] block tracking-wide font-body">Keyword search</label>
                  <input type="text" placeholder="Search names, interests or bio details..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-3 py-2 text-xs text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56] font-body" />
                </div>
                <button onClick={handleApplyFilters} disabled={loading} className="w-full sm:w-auto px-5 py-2 bg-[#EF3E56] hover:bg-[#D42E44] text-white font-display font-bold text-xs rounded-full shadow-[0_8px_20px_rgba(239,62,86,0.3)] transition whitespace-nowrap disabled:opacity-50">
                  {loading ? 'Filtering…' : 'Apply filters'}
                </button>
              </div>

              {/* Match Percentage Range Filter — dual range slider */}
              <div className="border-t border-[#ECE9E4] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-[#6E6D72] tracking-wide font-body flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={matchFilterEnabled}
                      onChange={(e) => setMatchFilterEnabled(e.target.checked)}
                      className="accent-[#EF3E56] w-3.5 h-3.5"
                    />
                    Filter by match percentage
                  </label>
                  {matchFilterEnabled && (
                    <span className="text-xs font-bold font-display text-[#EF3E56]">
                      {minMatchPercent}% – {maxMatchPercent}%
                    </span>
                  )}
                </div>
                {matchFilterEnabled && (
                  <div className="px-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#9B9A9D] font-bold font-body w-8">{minMatchPercent}%</span>
                      <input
                        type="range"
                        min={75}
                        max={100}
                        value={minMatchPercent}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMinMatchPercent(val);
                          if (val > maxMatchPercent) setMaxMatchPercent(val);
                        }}
                        className="flex-1 accent-[#EF3E56] h-1.5"
                      />
                      <span className="text-[10px] text-[#9B9A9D] font-bold font-body">Min</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#9B9A9D] font-bold font-body w-8">{maxMatchPercent}%</span>
                      <input
                        type="range"
                        min={75}
                        max={100}
                        value={maxMatchPercent}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMaxMatchPercent(val);
                          if (val < minMatchPercent) setMinMatchPercent(val);
                        }}
                        className="flex-1 accent-[#EF3E56] h-1.5"
                      />
                      <span className="text-[10px] text-[#9B9A9D] font-bold font-body">Max</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-2xl font-bold text-[#1B1B1D] flex items-center gap-3">
                <span>Your matches</span>
                <span className="text-xs bg-[#FFF1E9] text-[#B23349] border border-[#FFD9C2] px-3 py-1 rounded-full font-bold font-body">
                  {matches?.length || 0} found
                </span>
              </h3>
              {/* Message Requests Inbox Button */}
              <button
                onClick={() => setShowRequestsPanel(true)}
                className="relative px-4 py-1.5 bg-[#FFF1E9] hover:bg-[#FFE4D3] text-[#B23349] border border-[#FFD9C2] font-display font-bold text-xs rounded-full transition"
              >
                Message Requests
                {incomingPendingRequests.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#EF3E56] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {incomingPendingRequests.length}
                  </span>
                )}
              </button>
            </div>

            {(!matches || matches.length === 0) ? (
              <div className="bg-white border border-dashed border-[#ECE9E4] text-center p-12 rounded-3xl">
                <p className="text-[#6E6D72] text-sm font-body">No matches yet — try adjusting your filters or check back soon.</p>
              </div>
            ) : (
              matches.map((item) => (
                <div key={item.id} className="bg-white border border-[#ECE9E4] rounded-3xl p-5 shadow-[0_4px_18px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition duration-200">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3.5">
                      {item.photoUrl ? (
                        <img src={getDirectDriveUrl(item.photoUrl)} alt={item.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#FFF1E9]" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'; }} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#F1EFEB] border border-[#ECE9E4] flex items-center justify-center text-[#9B9A9D] font-bold text-xs font-body">AI</div>
                      )}
                      <div>
                        <h4 className="font-display text-md font-bold text-[#1B1B1D] tracking-tight">{item.name}</h4>
                        <p className="text-xs text-[#B26A00] font-semibold font-body">{item.profession || 'Connection'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold font-display text-[#EF3E56]">{item.score}%</span>
                      <span className="text-[9px] block text-[#9B9A9D] font-bold uppercase tracking-wide font-body">Match</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#4A4A4D] bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#ECE9E4] leading-relaxed font-body">{item.bio}</p>
                  
                  {/* Dynamic AI Compatibility Accordion Element */}
                  <div className="mt-3 bg-[#FAF8F5] border border-[#ECE9E4] rounded-2xl overflow-hidden text-xs">
                    <details className="group">
                      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none font-bold text-[#6E6D72] hover:text-[#EF3E56] transition font-display">
                        <span>See why you match</span>
                        <span className="text-[10px] transition group-open:rotate-180">▼</span>
                      </summary>
                      <div className="px-3 pb-3 pt-1 border-t border-[#ECE9E4] text-[#4A4A4D] space-y-2 font-medium font-body">
                        <p className="italic text-[#6E6D72] leading-relaxed bg-white p-2 rounded-xl border border-[#ECE9E4]">
                          {item.aiAnalysis?.breakdown}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide font-body">
                          <div className="bg-white p-2 rounded-lg border border-[#ECE9E4]">
                            <span className="text-[#9B9A9D] block">Communication</span>
                            <span className="text-[#1E9E6B] block truncate font-bold">{item.aiAnalysis?.communication}</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-[#ECE9E4]">
                            <span className="text-[#9B9A9D] block">Type</span>
                            <span className="text-[#B26A00] block truncate font-bold">{item.aiAnalysis?.temperament}</span>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Persistent Messaging Action Trigger */}
                  <div className="mt-4 pt-3 border-t border-[#ECE9E4] flex justify-end">
                    {(() => {
                      const status = connectionStatuses[item.userId] || 'none';
                      const btnLabel = status === 'accepted' ? 'Message'
                        : status === 'pending_sent' ? 'Request Pending'
                        : status === 'pending_received' ? 'Respond to Request'
                        : status === 'rejected' ? 'Declined'
                        : 'Send Request';
                      const btnClass = status === 'accepted'
                        ? 'bg-[#EF3E56] hover:bg-[#D42E44] text-white'
                        : status === 'pending_sent'
                        ? 'bg-[#FFF1E9] text-[#B23349] border border-[#FFD9C2] cursor-default'
                        : status === 'pending_received'
                        ? 'bg-[#1E9E6B] hover:bg-[#178A5E] text-white'
                        : status === 'rejected'
                        ? 'bg-[#F1EFEB] text-[#9B9A9D] border border-[#ECE9E4] cursor-default'
                        : 'bg-[#EF3E56] hover:bg-[#D42E44] text-white';
                      return (
                        <button
                          onClick={() => handleMessageClick(item)}
                          disabled={status === 'pending_sent' || status === 'rejected'}
                          className={`px-4 py-1.5 font-display font-bold text-xs rounded-full shadow-[0_6px_16px_rgba(239,62,86,0.3)] transition duration-150 ${btnClass}`}
                        >
                          {btnLabel}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE PROFILE SPECS EDITING MODAL BACKDROP CONTAINER */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#1B1B1D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white border border-[#ECE9E4] rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150">
            
            <h3 className="font-display text-xl font-bold text-[#1B1B1D] border-b border-[#ECE9E4] pb-2 mb-4">
              Edit profile
            </h3>
            
            <form onSubmit={handleUpdateProfileSubmit} className="space-y-4 text-xs font-semibold font-body">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6E6D72] block mb-1">Full name</label>
                <input type="text" required value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56]" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6E6D72] block mb-1">Profession / interest</label>
                <input type="text" required value={editForm.profession} onChange={(e) => setEditForm(prev => ({ ...prev, profession: e.target.value }))} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56]" />
              </div>
              
              {/* Profile Photo Upload Option */}
              <div>
                <label className="text-[10px] uppercase font-bold text-[#6E6D72] block mb-1">Profile photo</label>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png" 
                  onChange={(e) => handlePhotoUpload(e, setEditForm, setEditImageError)} 
                  className="w-full text-xs text-[#6E6D72] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#EF3E56] file:text-white hover:file:bg-[#D42E44] cursor-pointer bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl p-1" 
                />
                <p className="text-[10px] text-[#9B9A9D] mt-1">Formats: .jpg, .jpeg, .png (max 200 KB)</p>
                {editImageError && (
                  <p className="text-xs text-[#C4283F] font-semibold mt-1">{editImageError}</p>
                )}
                {editForm.photoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={getDirectDriveUrl(editForm.photoUrl)} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#EF3E56]" />
                    <span className="text-[10px] text-[#1E9E6B] font-body font-bold">Looking good!</span>
                  </div>
                )}
              </div>

              {/* Audio Notification Toggle Switch */}
              <div className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl">
                <div>
                  <label className="text-xs font-bold text-[#1B1B1D] block font-body">Audio notifications</label>
                  <span className="text-[10px] text-[#6E6D72] font-normal block">Play a sound for incoming messages</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm(prev => ({ ...prev, audioNotificationsEnabled: !prev.audioNotificationsEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    editForm.audioNotificationsEnabled ? 'bg-[#EF3E56]' : 'bg-[#DAD7D2]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editForm.audioNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#6E6D72] block mb-1">Bio & goals</label>
                <textarea required rows={3} value={editForm.rawBio} onChange={(e) => setEditForm(prev => ({ ...prev, rawBio: e.target.value }))} className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] resize-none focus:outline-none focus:border-[#EF3E56]" />
              </div>
              
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-[#F1EFEB] hover:bg-[#E9E6E1] text-[#1B1B1D] rounded-full font-bold transition font-display border border-[#ECE9E4]">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-[#EF3E56] hover:bg-[#D42E44] text-white font-bold rounded-full transition shadow-[0_8px_20px_rgba(239,62,86,0.3)] font-display">
                  {loading ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC DATABASE MESSAGING OVERLAY DRAWER */}
      {activeChatMatch && (
        <div className="fixed bottom-6 right-6 w-full max-w-sm bg-white border border-[#ECE9E4] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* Header with Audio Toggle Control */}
          <div className="bg-[#FFF1E9] px-4 py-3 border-b border-[#ECE9E4] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 bg-[#1E9E6B] rounded-full" />
              <div>
                <h4 className="text-xs font-display font-bold text-[#1B1B1D] tracking-wide truncate max-w-[140px]">{activeChatMatch.name}</h4>
                <span className="text-[9px] font-body text-[#B23349] block font-bold">Match: {activeChatMatch.score}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Message Box Audio Notification Toggle */}
              <button
                type="button"
                title={userProfile?.audioNotificationsEnabled ? "Mute Audio Notifications" : "Enable Audio Notifications"}
                onClick={handleToggleAudioNotifications}
                className={`p-1.5 rounded-full border text-xs flex items-center justify-center transition-colors ${
                  userProfile?.audioNotificationsEnabled 
                    ? 'bg-white border-[#FFD9C2] text-[#EF3E56] hover:bg-[#FFE4D3]' 
                    : 'bg-white border-[#ECE9E4] text-[#9B9A9D] hover:bg-[#F1EFEB]'
                }`}
              >
                {userProfile?.audioNotificationsEnabled ? '🔔' : '🔕'}
              </button>

              <button 
                onClick={() => setActiveChatMatch(null)} 
                className="text-[#6E6D72] hover:text-[#1B1B1D] text-sm font-bold bg-white w-6 h-6 rounded-full flex items-center justify-center border border-[#ECE9E4] transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Message Body Logs */}
          <div className="p-4 h-64 overflow-y-auto bg-[#FAF8F5] space-y-2.5 flex flex-col">
            <div className="text-center p-1 mb-1">
              <span className="text-[9px] text-[#9B9A9D] font-body tracking-tight bg-white border border-[#ECE9E4] px-3 py-0.5 rounded-full">🔒 Secure sync channel connected</span>
            </div>
            
            {chatLogs.map((msg, index) => {
              const isMe = msg.senderId === userProfile.userId;
              return (
                <div key={index} className={`max-w-[80%] p-2.5 rounded-2xl text-xs leading-relaxed border font-body ${isMe ? 'bg-[#EF3E56] border-[#EF3E56] text-white rounded-br-none self-end' : 'bg-white border-[#ECE9E4] text-[#1B1B1D] rounded-tl-none self-start'}`}>{msg.messageText}</div>
              );
            })}
          </div>

          {/* Message Input Payload Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#ECE9E4] flex gap-2">
            <input type="text" placeholder="Type a message..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} className="flex-1 bg-[#FAF8F5] border border-[#ECE9E4] rounded-full px-3 py-2 text-xs text-[#1B1B1D] focus:outline-none focus:border-[#EF3E56] font-body" />
            <button type="submit" disabled={!chatMessage.trim()} className="px-4 bg-[#EF3E56] hover:bg-[#D42E44] disabled:bg-[#DAD7D2] disabled:text-white text-white text-xs font-display font-bold rounded-full shadow-[0_6px_16px_rgba(239,62,86,0.3)] transition duration-150">Send</button>
          </form>

        </div>
      )}

      {/* MESSAGE REQUESTS INBOX PANEL */}
      {showRequestsPanel && (
        <div className="fixed inset-0 bg-[#1B1B1D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white border border-[#ECE9E4] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#ECE9E4] flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#1B1B1D]">Message Requests</h3>
              <button
                onClick={() => setShowRequestsPanel(false)}
                className="text-[#6E6D72] hover:text-[#1B1B1D] text-sm font-bold bg-[#F1EFEB] w-7 h-7 rounded-full flex items-center justify-center border border-[#ECE9E4]"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {incomingPendingRequests.length === 0 ? (
                <p className="text-center text-sm text-[#6E6D72] font-body py-8">No pending message requests.</p>
              ) : (
                incomingPendingRequests.map((req) => (
                  <div key={req._id} className="bg-[#FAF8F5] border border-[#ECE9E4] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {req.senderPhotoUrl ? (
                        <img src={getDirectDriveUrl(req.senderPhotoUrl)} alt={req.senderName} className="w-10 h-10 rounded-full object-cover border-2 border-[#FFF1E9]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#F1EFEB] border border-[#ECE9E4] flex items-center justify-center text-[#9B9A9D] font-bold text-xs font-body">?</div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-display text-sm font-bold text-[#1B1B1D]">{req.senderName}</h4>
                        <p className="text-[10px] text-[#EF3E56] font-bold font-body">{req.matchPercentage != null ? `${req.matchPercentage}% Match` : 'Match'}</p>
                      </div>
                      <span className="text-[9px] text-[#9B9A9D] font-body">
                        {req.requestCreatedAt ? new Date(req.requestCreatedAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A4A4D] bg-white p-3 rounded-xl border border-[#ECE9E4] font-body italic">
                      &ldquo;{req.firstMessage}&rdquo;
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleRejectRequest(req)}
                        disabled={requestLoading}
                        className="px-4 py-1.5 bg-white hover:bg-[#FDECEC] text-[#C4283F] border border-[#F6C4C9] font-display font-bold text-xs rounded-full transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        disabled={requestLoading}
                        className="px-4 py-1.5 bg-[#1E9E6B] hover:bg-[#178A5E] text-white font-display font-bold text-xs rounded-full transition disabled:opacity-50"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SEND MESSAGE REQUEST MODAL */}
      {showSendRequestModal && requestTargetMatch && (
        <div className="fixed inset-0 bg-[#1B1B1D]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white border border-[#ECE9E4] rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150">
            <h3 className="font-display text-xl font-bold text-[#1B1B1D] border-b border-[#ECE9E4] pb-2 mb-4">
              Send Message Request
            </h3>
            <div className="flex items-center gap-3 mb-4">
              {requestTargetMatch.photoUrl ? (
                <img src={getDirectDriveUrl(requestTargetMatch.photoUrl)} alt={requestTargetMatch.name} className="w-10 h-10 rounded-full object-cover border-2 border-[#FFF1E9]" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#F1EFEB] border border-[#ECE9E4] flex items-center justify-center text-[#9B9A9D] font-bold text-xs font-body">?</div>
              )}
              <div>
                <p className="font-display text-sm font-bold text-[#1B1B1D]">{requestTargetMatch.name}</p>
                <p className="text-[10px] text-[#EF3E56] font-bold font-body">{requestTargetMatch.score}% Match</p>
              </div>
            </div>
            <p className="text-xs text-[#6E6D72] font-body mb-3">
              Your first message will be sent as a request. They must accept before you can chat.
            </p>
            <form onSubmit={handleSendMessageRequest} className="space-y-4">
              <textarea
                required
                rows={3}
                placeholder="Write your first message..."
                value={requestMessageText}
                onChange={(e) => setRequestMessageText(e.target.value)}
                maxLength={1000}
                className="w-full bg-[#FAF8F5] border border-[#ECE9E4] rounded-xl px-4 py-2 text-sm text-[#1B1B1D] resize-none focus:outline-none focus:border-[#EF3E56] font-body"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowSendRequestModal(false); setRequestMessageText(''); }}
                  className="px-4 py-2 bg-[#F1EFEB] hover:bg-[#E9E6E1] text-[#1B1B1D] rounded-full font-bold transition font-display border border-[#ECE9E4] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestLoading || !requestMessageText.trim()}
                  className="px-5 py-2 bg-[#EF3E56] hover:bg-[#D42E44] text-white font-bold rounded-full transition shadow-[0_8px_20px_rgba(239,62,86,0.3)] font-display text-xs disabled:opacity-50"
                >
                  {requestLoading ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}