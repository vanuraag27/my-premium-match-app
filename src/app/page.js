'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { speakMessage, speakMessages, stopSpeaking, isSpeechSupported } from '../utils/ttsHelper';
import { CHAT_EMOJIS } from '../utils/emojiList';
import VoiceSettingsModal from '../components/VoiceSettingsModal';

function formatMessageTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${date.toLocaleDateString([], { day: '2-digit', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function Home() {
  // Authentication & Session Core States
  const [userProfile, setUserProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const matchesRef = useRef([]);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  // True only while we're checking for a persisted session on first mount —
  // prevents a flash of the login form before we know whether to restore.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // VibeKey theme preference. It is persisted locally and switches instantly.
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTheme = window.localStorage.getItem('vibekey-theme');
    const systemTheme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : systemTheme;
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('vibekey-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  // --- Read Messages Aloud (multilingual TTS) preference ---
  // Off by default: automatic speech playback is opt-in, and mirrors the
  // existing theme pattern by persisting the choice locally per-browser.
  // This is entirely separate from the existing audio *notification*
  // sound (a "new message arrived" chime) — this instead speaks the
  // message's actual text content.
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    if (!showEmojiPicker) return undefined;
    const handleOutsideClick = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showEmojiPicker]);
  // Mirrors speechEnabled for use inside the polling effect's closures
  // below, so toggling the setting mid-chat takes effect immediately
  // without needing to restart that effect (and its unread/scroll state).
  const speechEnabledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('vibekey-tts-enabled');
    const initial = saved === 'true';
    setSpeechEnabled(initial);
    speechEnabledRef.current = initial;
  }, []);

  const toggleSpeechEnabled = () => {
    setSpeechEnabled((current) => {
      const next = !current;
      speechEnabledRef.current = next;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('vibekey-tts-enabled', String(next));
      }
      if (!next) stopSpeaking();
      return next;
    });
  };
  
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
  // Location search — always-active text field, same pattern as profession/keyword
  const [preferredLocation, setPreferredLocation] = useState('');
  // Gender/age preference filter — disabled by default, same pattern as Match % filter
  const [preferenceFilterEnabled, setPreferenceFilterEnabled] = useState(false);
  const [preferredGender, setPreferredGender] = useState('Any');
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(60);

  // Buffered Registration Form Matrix
  const [registerForm, setRegisterForm] = useState({
    name: '',
    profession: '',
    rawBio: '',
    photoUrl: '',
    gender: '',
    age: '',
    location: '',
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
    gender: '',
    age: '',
    location: '',
    audioNotificationsEnabled: true
  });
  const [editImageError, setEditImageError] = useState('');
  // Ref to the scrollable Edit Profile modal card, used for mobile keyboard handling
  const editModalCardRef = useRef(null);

  // Database-Backed Chat Engine System States
  const [activeChatMatch, setActiveChatMatch] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([]);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [showNewChatMessage, setShowNewChatMessage] = useState(false);
  const chatMessagesContainerRef = useRef(null);
  const chatNearBottomRef = useRef(true);
  const typingStopTimerRef = useRef(null);
  const typingHeartbeatRef = useRef(null);
  const isTypingLocalRef = useRef(false);
  const activeChatUserIdRef = useRef(null);
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    currentUserIdRef.current = userProfile?.userId ? String(userProfile.userId) : null;
    activeChatUserIdRef.current = activeChatMatch?.userId ? String(activeChatMatch.userId) : null;
  }, [userProfile?.userId, activeChatMatch?.userId]);

  // User Block / Unblock Messaging Feature States
  const [blockStatus, setBlockStatus] = useState({ iBlockedThem: false, theyBlockedMe: false });
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const blockMenuRef = useRef(null);

  // Message Request Approval System States
  const [messageRequests, setMessageRequests] = useState([]);
  const [messageRequestStatuses, setMessageRequestStatuses] = useState({});
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

  // --- Unread Message Indicator state (drives the green Message button) ---
  // Set of userIds whose Message button should currently render GREEN.
  const [unreadSenderIds, setUnreadSenderIds] = useState(new Set());
  // Dedupe ref so the same unread message never re-triggers the audio ping twice.
  const seenUnreadMessageIdsRef = useRef(new Set());

  // Snapshot of the last *applied* (submitted) match filters — kept separate
  // from the live searchProfession/searchKeyword/etc. state so the
  // background match-refresh poll (Problem 1) never applies a filter the
  // user has only typed but not yet clicked "Apply Filters" for. Updated
  // wherever the app already applies filters (login, register, edit,
  // Apply Filters).
  const appliedFiltersRef = useRef({
    searchProfession: '',
    searchKeyword: '',
    matchFilterEnabled: false,
    minMatchPercent: 75,
    maxMatchPercent: 100,
    preferredLocation: '',
    preferenceFilterEnabled: false,
    preferredGender: 'Any',
    minAge: 18,
    maxAge: 60,
  });

  // Snapshot the current (live) filter state into appliedFiltersRef. Called
  // wherever the app already applies filters (Apply Filters, Edit Profile
  // save) so the background match-refresh poll always reflects the last
  // filters the user actually submitted.
  const snapshotAppliedFilters = () => ({
    searchProfession,
    searchKeyword,
    matchFilterEnabled,
    minMatchPercent,
    maxMatchPercent,
    preferredLocation,
    preferenceFilterEnabled,
    preferredGender,
    minAge,
    maxAge,
  });

  // Profile photo upload: accept up to 2 MB, then automatically resize/compress
  // for efficient storage while keeping the existing data-URL workflow intact.
  const handlePhotoUpload = (e, setForm, setErrorState) => {
    const file = e.target.files?.[0];
    setErrorState('');
    if (!file) return;

    const validExtensions = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(file.type) && !['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      setErrorState('Unsupported file type. Only .jpg, .jpeg, and .png formats are allowed.');
      e.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorState(`File size exceeds limit (Max 2 MB). Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB.`);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const source = event.target?.result;
      const img = new window.Image();
      img.onload = () => {
        const maxDimension = 1000;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          setErrorState('Unable to optimize the selected image. Please try another photo.');
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const optimized = canvas.toDataURL('image/jpeg', 0.82);
        setForm((prev) => ({ ...prev, photoUrl: optimized }));
      };
      img.onerror = () => setErrorState('Failed to process image. Please try another photo.');
      img.src = source;
    };
    reader.onerror = () => setErrorState('Failed to read image file. Please try again.');
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

  // Populate userProfile/matches/messageRequestStatuses/editForm from an
  // onboarding API response. Shared by the OTP login flow and the session
  // restore-on-refresh flow below so both hydrate state identically.
  const applyProfileAndMatches = (profile, matchesList) => {
    setUserProfile(profile);
    setMatches(matchesList || []);
    const statusMap = {};
    (matchesList || []).forEach((m) => {
      if (m.messageRequestStatus) statusMap[m.userId] = m.messageRequestStatus;
    });
    setMessageRequestStatuses(statusMap);
    setEditForm({
      name: profile.name || '',
      profession: profile.profession || '',
      rawBio: profile.rawBio || '',
      photoUrl: profile.photoUrl || '',
      gender: profile.gender || '',
      age: profile.age !== null && profile.age !== undefined ? String(profile.age) : '',
      location: profile.location || '',
      audioNotificationsEnabled: profile.audioNotificationsEnabled !== undefined ? profile.audioNotificationsEnabled : true
    });
  };

  // Restore an existing session on mount (e.g. after a page refresh).
  // Validates the signed HttpOnly session cookie issued by /api/auth/verify-otp
  // via the server (client JS never reads/writes it), then reuses the exact
  // same profile+matches load the OTP flow already performs — so a refresh
  // lands on the same dashboard instead of forcing a fresh login.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (cancelled) return;

        if (!sessionData.success || !sessionData.authenticated || !sessionData.userId) {
          setIsRestoringSession(false);
          return;
        }

        const profileRes = await fetch(`/api/onboarding?userId=${encodeURIComponent(sessionData.userId)}`);
        const profileData = await profileRes.json();
        if (cancelled) return;

        if (profileData.success && profileData.exists) {
          applyProfileAndMatches(profileData.profile, profileData.matches);
        }
        // If the profile no longer exists (e.g. deleted), just fall back to
        // the login screen — nothing to restore, no error to surface.
      } catch (err) {
        // Temporary network failure: don't force a logout, just fall back
        // to showing the login screen for this load. A later refresh (or
        // reconnect) will retry the session check.
        console.error('Failed to restore session:', err);
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    })();

    return () => {
      cancelled = true;
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

  // Build filter payload including optional match percentage range and preferences
  const buildFilterPayload = (profile) => {
    const payload = {
      ...profile,
      searchProfession,
      searchKeyword,
      preferredLocation,
      // Always sent (even when off) so the backend can persist "I have no
      // stated preference" as accurately as "I do" — see the mutual
      // preference matching logic in the onboarding route.
      preferenceFilterEnabled,
    };
    if (matchFilterEnabled) {
      payload.minMatchPercent = minMatchPercent;
      payload.maxMatchPercent = maxMatchPercent;
    }
    if (preferenceFilterEnabled) {
      payload.preferredGender = preferredGender;
      payload.minAge = minAge;
      payload.maxAge = maxAge;
    }
    return payload;
  };

  // Load message requests and derive per-match message-request statuses
  const loadMessageRequests = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/message-requests?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) {
        setMessageRequests(data.requests || []);
        setMessageRequestStatuses((prev) => {
          const statusMap = { ...prev };
          (data.requests || []).forEach((req) => {
            const otherId = req.senderId === userId ? req.receiverId : req.senderId;
            if (req.requestStatus === 'Accepted') {
              statusMap[otherId] = 'accepted';
            } else if (req.requestStatus === 'Pending') {
              statusMap[otherId] = req.senderId === userId ? 'pending_sent' : 'pending_received';
            } else if (req.requestStatus === 'Rejected' && req.senderId === userId) {
              statusMap[otherId] = 'rejected';
            } else if (req.requestStatus === 'Revoked') {
              // A revoked rejection does not open messaging. It simply restores
              // the sender's ability to submit a fresh message request.
              if (statusMap[otherId] === 'rejected') delete statusMap[otherId];
            }
          });
          return statusMap;
        });
      }
    } catch (err) {
      console.error('Failed to load message requests:', err);
    }
  };

  // Poll for unread messages across all conversations. This is what allows the
  // Message button to turn GREEN and the audio notification to ring immediately
  // even when the corresponding chat window is closed — the existing per-chat
  // polling loop below only runs while a conversation is actively open.
  const pollUnreadMessages = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages/unread?userId=${encodeURIComponent(userId)}&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.unreadMessages)) return;

      // Whichever chat (if any) is currently open already has its own
      // audio-on-arrival handling further below, so it's excluded here to
      // avoid ringing the notification twice for the same incoming message.
      const openChatUserId = activeChatMatch?.userId ? String(activeChatMatch.userId) : null;

      const newlySeenIds = [];
      let shouldPlaySound = false;

      data.unreadMessages.forEach((msg) => {
        const idStr = String(msg._id);
        if (!seenUnreadMessageIdsRef.current.has(idStr)) {
          newlySeenIds.push(idStr);
          if (String(msg.senderId) !== openChatUserId) {
            shouldPlaySound = true;
          }
        }
      });

      if (newlySeenIds.length > 0) {
        newlySeenIds.forEach((id) => seenUnreadMessageIdsRef.current.add(id));
      }
      if (shouldPlaySound) {
        playNotificationSound();
      }

      // Green button applies to every sender with an unread message, except
      // the conversation that's currently open (nothing to "unread" there).
      const nextUnreadSenderIds = new Set(
        data.unreadMessages
          .map((msg) => String(msg.senderId))
          .filter((sid) => sid !== openChatUserId)
      );
      setUnreadSenderIds(nextUnreadSenderIds);
    } catch (err) {
      console.error('Failed to poll unread messages:', err);
    }
  };

  // Poll for newly-eligible matches (e.g. users who registered after this
  // dashboard session started) so they appear automatically without a
  // manual refresh or re-login. Reuses the existing GET /api/onboarding
  // matching/filtering pipeline — the exact same one a normal dashboard
  // load already uses — so a new profile appears exactly as it would after
  // a manual refresh, filtered by whatever the user last applied via
  // "Apply Filters" (not by unsubmitted, still-being-typed filter text).
  const refreshMatches = async (userId) => {
    if (!userId) return;
    try {
      const { searchProfession: appliedProfession, searchKeyword: appliedKeyword, matchFilterEnabled: appliedFilterEnabled, minMatchPercent: appliedMin, maxMatchPercent: appliedMax, preferredLocation: appliedLocation, preferenceFilterEnabled: appliedPrefEnabled, preferredGender: appliedGender, minAge: appliedMinAge, maxAge: appliedMaxAge } = appliedFiltersRef.current;

      const params = new URLSearchParams({ userId });
      if (appliedProfession.trim()) params.set('searchProfession', appliedProfession.trim());
      if (appliedKeyword.trim()) params.set('searchKeyword', appliedKeyword.trim());
      if (appliedFilterEnabled) {
        params.set('minMatchPercent', appliedMin);
        params.set('maxMatchPercent', appliedMax);
      }
      if (appliedLocation.trim()) params.set('preferredLocation', appliedLocation.trim());
      if (appliedPrefEnabled) {
        params.set('preferredGender', appliedGender);
        params.set('minAge', appliedMinAge);
        params.set('maxAge', appliedMaxAge);
      }

      const res = await fetch(`/api/onboarding?${params.toString()}`);
      const data = await res.json();
      if (!data.success || !data.exists || !Array.isArray(data.matches)) return;

      // Keep the existing list synchronized without requiring logout,
      // refresh, or a second login. Compare IDs before replacing the list so
      // a newly-created profile can be surfaced immediately to the current
      // session.
      const previousIds = new Set(matchesRef.current.map((m) => String(m.userId)));
      const newlyAvailable = data.matches.filter((m) => !previousIds.has(String(m.userId)));
      setMatches(data.matches);
      // Keep an open chat's presence/status synchronized with the latest match snapshot.
      // Opening a chat must never make the other user appear online.
      if (activeChatMatch?.userId) {
        const openChatUserId = String(activeChatMatch.userId);
        const refreshedChatMatch = data.matches.find(
          (m) => String(m.userId) === openChatUserId
        );
        if (refreshedChatMatch) {
          // Preserve an explicit close. A refresh request that started before
          // the user closed the chat must never reopen it after the fetch
          // completes. Functional state update reads the latest value.
          setActiveChatMatch((current) => {
            if (!current || String(current.userId) !== openChatUserId) return current;
            return refreshedChatMatch;
          });
        }
      }
      if (newlyAvailable.length > 0 && previousIds.size > 0) {
        showToast(newlyAvailable.length === 1
          ? 'A new profile is now available in your matches.'
          : `${newlyAvailable.length} new profiles are now available in your matches.`);
      }
      const statusMap = {};
      data.matches.forEach((m) => {
        if (m.messageRequestStatus) statusMap[m.userId] = m.messageRequestStatus;
      });
      setMessageRequestStatuses((prev) => ({ ...prev, ...statusMap }));
    } catch (err) {
      console.error('Failed to refresh matches:', err);
    }
  };

  // Poll message requests, unread messages, and newly
  // eligible matches while logged in — a single shared interval reusing the
  // app's existing polling architecture rather than introducing a second one.
  useEffect(() => {
    if (!userProfile?.userId) return;
    loadMessageRequests(userProfile.userId);
    pollUnreadMessages(userProfile.userId);
    refreshMatches(userProfile.userId);
    const runLiveSync = () => {
      loadMessageRequests(userProfile.userId);
        pollUnreadMessages(userProfile.userId);
      refreshMatches(userProfile.userId);
    };

    const timer = setInterval(runLiveSync, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runLiveSync();
    };
    const handleFocus = () => runLiveSync();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userProfile?.userId, activeChatMatch]);

  // Online presence is independent from profile visibility. Logging out only
  // turns off the green indicator; the profile remains discoverable.
  useEffect(() => {
    if (!userProfile?.userId) return;
    const userId = userProfile.userId;
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.error('Presence heartbeat failed:', err);
      }
    };
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') sendHeartbeat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userProfile?.userId]);

  // Lock background scrolling while the Edit Profile modal is open,
  // so only the popup itself scrolls (desktop + mobile, including iOS rubber-banding)
  useEffect(() => {
    if (!isEditModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isEditModalOpen]);

  // Keep the focused field visible above the mobile on-screen keyboard.
  // Re-scrolls the focused field into view whenever the visual viewport
  // shrinks/shifts (keyboard opening/closing) or resizes on rotation.
  useEffect(() => {
    if (!isEditModalOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const scrollActiveFieldIntoView = () => {
      const active = document.activeElement;
      if (active && editModalCardRef.current && editModalCardRef.current.contains(active)) {
        active.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    viewport.addEventListener('resize', scrollActiveFieldIntoView);
    viewport.addEventListener('scroll', scrollActiveFieldIntoView);
    return () => {
      viewport.removeEventListener('resize', scrollActiveFieldIntoView);
      viewport.removeEventListener('scroll', scrollActiveFieldIntoView);
    };
  }, [isEditModalOpen]);

  // Automatically scroll a focused field (input, textarea, select, etc.) into
  // full view inside the Edit Profile popup — used for mobile keyboard overlap.
  const handleEditModalFieldFocus = (e) => {
    const target = e.target;
    // Small delay lets the mobile keyboard finish animating in before we scroll,
    // otherwise the scroll position is calculated against the pre-keyboard layout.
    setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 150);
  };

  // Handle message button click based on message-request status
  const handleMessageClick = async (item) => {
    const status = messageRequestStatuses[item.userId] || 'none';
    if (status === 'accepted') {
      setActiveChatMatch(item);
      // Clear the existing GREEN Message-button unread indicator immediately.
      // The chat GET then marks the underlying messages read on the server.
      setUnreadSenderIds((prev) => {
        if (!prev.has(String(item.userId))) return prev;
        const next = new Set(prev);
        next.delete(String(item.userId));
        return next;
      });

    } else if (status === 'pending_sent') {
      showToast('Your message request is pending approval.');
    } else if (status === 'pending_received') {
      setShowRequestsPanel(true);
    } else if (status === 'rejected') {
      showToast('Your message request was declined. Messaging is not available.');
    } else {
      // Proactive block check before opening the send-request modal
      if (userProfile?.userId) {
        try {
          const res = await fetch(
            `/api/block?userId=${encodeURIComponent(userProfile.userId)}&otherUserId=${encodeURIComponent(item.userId)}`
          );
          const data = await res.json();
          if (data.success && data.theyBlockedMe) {
            showToast('You cannot send messages because this user has blocked communication.');
            return;
          }
        } catch (err) {
          console.error('Block status check failed:', err);
        }
      }
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
      if (!result.success) {
        if (result.blocked) {
          showToast('You cannot send messages because this user has blocked communication.');
          setShowSendRequestModal(false);
          setRequestMessageText('');
          return;
        }
        throw new Error(result.error || 'Failed to send message request.');
      }
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
      // Immediately transition this pair to an approved conversation in the
      // dashboard state. Do not wait for the 5-second live-sync cycle.
      // Otherwise a stale pending_received status can make a later normal
      // message look like a fresh approval request.
      setMessageRequestStatuses((prev) => ({
        ...prev,
        [request.senderId]: 'accepted',
      }));
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

  // Revoke a message-request rejection. This does not open chat; it only
  // restores the sender's ability to submit a fresh message request.
  const handleRevokeRejection = async (request) => {
    setRequestLoading(true);
    try {
      const response = await fetch('/api/message-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request._id,
          userId: userProfile.userId,
          action: 'revoke_rejection',
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to revoke rejection.');
      showToast('Rejection revoked. The user may now send a new message request.');
      await loadMessageRequests(userProfile.userId);
    } catch (err) {
      showToast(err.message || 'Error revoking rejection.');
    } finally {
      setRequestLoading(false);
    }
  };

  const incomingPendingRequests = messageRequests.filter(
    (r) => r.receiverId === userProfile?.userId && r.requestStatus === 'Pending'
  );

  const incomingRejectedRequests = messageRequests.filter(
    (r) =>
      r.receiverId === userProfile?.userId &&
      r.requestStatus === 'Rejected' &&
      String(r.rejectedBy || '') === String(userProfile?.userId)
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

  // Loop to pull live message logs and the other user's typing state.
  useEffect(() => {
    let internalTimer;
    let typingTimer;
    let cancelled = false;
    setIsOtherUserTyping(false);
    setShowNewChatMessage(false);
    chatNearBottomRef.current = true;
    stopTyping();

    if (userProfile?.userId && activeChatMatch?.userId) {
      const chatKey = `${userProfile.userId}::${activeChatMatch.userId}`;
      if (activeChatKeyRef.current !== chatKey) {
        activeChatKeyRef.current = chatKey;
        seenMessageIdsRef.current = null;
      }

      const loadTypingState = async () => {
        try {
          const res = await fetch(`/api/typing?userId=${encodeURIComponent(userProfile.userId)}&otherUserId=${encodeURIComponent(activeChatMatch.userId)}&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
          const data = await res.json();
          if (!cancelled && data.success) setIsOtherUserTyping(!!data.isTyping);
        } catch (err) {
          console.error('Failed syncing typing state:', err);
        }
      };

      const loadMessages = async () => {
        try {
          const res = await fetch(`/api/messages?senderId=${encodeURIComponent(userProfile.userId)}&receiverId=${encodeURIComponent(activeChatMatch.userId)}`);
          const data = await res.json();
          if (data.success) {
            const incomingMessages = Array.isArray(data.messages) ? data.messages : [];
            const isFirstLoadForThisChat = seenMessageIdsRef.current === null;
            const previouslySeenIds = seenMessageIdsRef.current || new Set();

            if (!isFirstLoadForThisChat) {
              const newIncomingMessages = incomingMessages.filter(
                (msg) =>
                  String(msg.senderId) !== String(userProfile.userId) &&
                  !previouslySeenIds.has(String(msg._id))
              );
              if (newIncomingMessages.length > 0) {
                playNotificationSound();

                // Read the newly-opened/arrived message aloud, if the user
                // has opted into it. Kept fully separate from the audio
                // notification chime above. Speak only the most recent of
                // any batch so multiple messages don't talk over each other.
                if (speechEnabledRef.current) {
                  const latestIncoming = newIncomingMessages[newIncomingMessages.length - 1];
                  speakMessage(latestIncoming.messageText, { gender: activeChatMatch.gender });
                }
              }
            } else if (speechEnabledRef.current && Array.isArray(data.newlyReadMessageIds) && data.newlyReadMessageIds.length > 0) {
              // Chat is being opened for the first time this session, and
              // there are messages that arrived while it was closed (the
              // server just marked them read and told us their ids). Read
              // them aloud once, in order, so nothing sent while the chat
              // was closed goes unheard — this is the one case the
              // "new incoming message" check above can't catch, since that
              // only fires for messages that arrive while the chat is
              // already open.
              const unreadMessagesToRead = incomingMessages.filter((msg) =>
                data.newlyReadMessageIds.includes(String(msg._id))
              );
              if (unreadMessagesToRead.length > 0) {
                speakMessages(unreadMessagesToRead, { gender: activeChatMatch.gender });
              }
            }

            const latestId = incomingMessages.length ? String(incomingMessages[incomingMessages.length - 1]._id) : null;
            const previousLatestId = previouslySeenIds.size ? Array.from(previouslySeenIds).at(-1) : null;
            const hasNewMessage = !isFirstLoadForThisChat && latestId && latestId !== previousLatestId;
            seenMessageIdsRef.current = new Set(incomingMessages.map((msg) => String(msg._id)));
            setChatLogs(incomingMessages);
            if (isFirstLoadForThisChat) {
              setShowNewChatMessage(false);
              requestAnimationFrame(() => {
                const el = chatMessagesContainerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                chatNearBottomRef.current = true;
              });
            } else if (hasNewMessage) {
              if (chatNearBottomRef.current) {
                setShowNewChatMessage(false);
                requestAnimationFrame(() => {
                  const el = chatMessagesContainerRef.current;
                  if (el) el.scrollTop = el.scrollHeight;
                });
              } else {
                setShowNewChatMessage(true);
              }
            }
          }
        } catch (err) {
          console.error("Failed syncing chat records:", err);
        }
      };

      loadMessages();
      loadTypingState();
      internalTimer = setInterval(loadMessages, 1500);
      typingTimer = setInterval(loadTypingState, 1000);
    } else {
      setChatLogs([]);
      setIsOtherUserTyping(false);
      setShowNewChatMessage(false);
      chatNearBottomRef.current = true;
      seenMessageIdsRef.current = null;
      activeChatKeyRef.current = null;
    }
    return () => {
      cancelled = true;
      clearInterval(internalTimer);
      clearInterval(typingTimer);
      stopTyping();
      stopSpeaking();
    };
  }, [activeChatMatch?.userId, userProfile?.userId]);

  // Fetch the block relationship (did I block them / did they block me)
  // whenever a chat is opened, and keep it refreshed on a short poll so
  // both sides see a block/unblock take effect quickly without a reload.
  useEffect(() => {
    if (!userProfile?.userId || !activeChatMatch?.userId) {
      setBlockStatus({ iBlockedThem: false, theyBlockedMe: false });
      return;
    }

    let cancelled = false;
    const loadBlockStatus = async () => {
      try {
        const res = await fetch(
          `/api/block?userId=${encodeURIComponent(userProfile.userId)}&otherUserId=${encodeURIComponent(activeChatMatch.userId)}`
        );
        const data = await res.json();
        if (!cancelled && data.success) {
          setBlockStatus({ iBlockedThem: !!data.iBlockedThem, theyBlockedMe: !!data.theyBlockedMe });
        }
      } catch (err) {
        console.error('Failed to load block status:', err);
      }
    };

    loadBlockStatus();
    const blockStatusTimer = setInterval(loadBlockStatus, 5000);
    return () => {
      cancelled = true;
      clearInterval(blockStatusTimer);
    };
  }, [activeChatMatch, userProfile?.userId]);

  // Close the chat options (Block/Unblock) menu when clicking outside it
  useEffect(() => {
    if (!showBlockMenu) return;
    const handleClickOutside = (e) => {
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target)) {
        setShowBlockMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBlockMenu]);

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
        applyProfileAndMatches(checkResult.profile, checkResult.matches);
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
        if (m.messageRequestStatus) statusMap[m.userId] = m.messageRequestStatus;
      });
      setMessageRequestStatuses(statusMap);
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
        if (m.messageRequestStatus) statusMap[m.userId] = m.messageRequestStatus;
      });
      setMessageRequestStatuses(statusMap);
      appliedFiltersRef.current = snapshotAppliedFilters();
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
      // Sync message-request statuses from enriched match data
      const statusMap = {};
      (result.matches || []).forEach((m) => {
        if (m.messageRequestStatus) statusMap[m.userId] = m.messageRequestStatus;
      });
      setMessageRequestStatuses((prev) => ({ ...prev, ...statusMap }));
      appliedFiltersRef.current = snapshotAppliedFilters();
      showToast("Vector matching array search calculation index refreshed.");
    } catch (err) {
      setError(err.message || 'Timeout tracing query segments.');
    } finally {
      setLoading(false);
    }
  };

  const handleChatMessagesScroll = () => {
    const el = chatMessagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= 80;
    chatNearBottomRef.current = nearBottom;
    if (nearBottom) setShowNewChatMessage(false);
  };

  const jumpToLatestChatMessage = () => {
    const el = chatMessagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    chatNearBottomRef.current = true;
    setShowNewChatMessage(false);
  };

  // Phase 2F-1: publish the current user's typing state. The server keeps
  // the state only for a few seconds, so a crashed/closed browser naturally
  // stops showing as typing without requiring an explicit cleanup request.
  const publishTypingState = async (isTyping) => {
    const senderId = currentUserIdRef.current;
    const recipientId = activeChatUserIdRef.current;
    if (!senderId || !recipientId) return;
    isTypingLocalRef.current = Boolean(isTyping);
    try {
      await fetch('/api/typing', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ userId: senderId, otherUserId: recipientId, isTyping: Boolean(isTyping) }),
        credentials: 'same-origin',
      });
    } catch (err) {
      console.error('Typing state update failed:', err);
    }
  };

  const startTypingHeartbeat = () => {
    if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
    typingHeartbeatRef.current = setInterval(() => {
      if (isTypingLocalRef.current) publishTypingState(true);
    }, 1000);
  };

  const stopTypingHeartbeat = () => {
    if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
    typingHeartbeatRef.current = null;
  };

  const handleChatInputChange = (e) => {
    const value = e.target.value;
    setChatMessage(value);

    if (!value.trim()) {
      publishTypingState(false);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
      return;
    }

    // Only fire the network call when typing actually STARTS — the
    // heartbeat below already resends "true" once a second while typing
    // continues, so a fresh fetch on every single keystroke is redundant.
    // For a long message typed quickly, that redundancy meant one POST
    // request per character, which could pile up behind the app's other
    // polling loops (messages, typing state, presence) and delay the
    // actual Send request enough that it looked like the button wasn't
    // responding.
    if (!isTypingLocalRef.current) {
      publishTypingState(true);
      startTypingHeartbeat();
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      publishTypingState(false);
      stopTypingHeartbeat();
      typingStopTimerRef.current = null;
    }, 2500);
  };

  // Inserts an emoji at the message input's current cursor position (or
  // appends to the end if we can't read cursor position for some reason),
  // then re-focuses the input. Routes through the same typing-indicator
  // logic as normal typing so picking an emoji behaves just like typing
  // one would to the other user's "is typing..." indicator.
  const insertEmoji = (emoji) => {
    const input = chatInputRef.current;
    const start = input?.selectionStart ?? chatMessage.length;
    const end = input?.selectionEnd ?? chatMessage.length;
    const nextValue = chatMessage.slice(0, start) + emoji + chatMessage.slice(end);

    handleChatInputChange({ target: { value: nextValue } });

    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const cursorPos = start + emoji.length;
      input.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const stopTyping = () => {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
    isTypingLocalRef.current = false;
    stopTypingHeartbeat();
    publishTypingState(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !userProfile?.userId || !activeChatMatch?.userId) return;
    if (blockStatus.theyBlockedMe) return; // Input is disabled in this state; guard defensively

    const textToSend = chatMessage.trim();
    stopTyping();
    setChatMessage('');

    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: String(userProfile.userId),
      receiverId: String(activeChatMatch.userId),
      messageText: textToSend,
      timestamp: new Date().toISOString(),
      read: false,
      deliveredAt: null,
      _optimistic: true,
    };
    setChatLogs((prev) => [...prev, optimisticMessage]);
    requestAnimationFrame(() => {
      const el = chatMessagesContainerRef.current;
      if (el && chatNearBottomRef.current) el.scrollTop = el.scrollHeight;
    });

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
        setChatLogs((prev) => prev.map((msg) => msg._id === tempId ? result.message : msg));
      } else if (result.requiresApproval) {
        setChatLogs((prev) => prev.filter((msg) => msg._id !== tempId));
        showToast('Messaging requires an accepted message request.');
      } else if (result.blocked) {
        setChatLogs((prev) => prev.filter((msg) => msg._id !== tempId));
        setBlockStatus((prev) => ({ ...prev, theyBlockedMe: true }));
        showToast('You cannot send messages because this user has blocked communication.');
      } else {
        setChatLogs((prev) => prev.filter((msg) => msg._id !== tempId));
        showToast(result.error || 'Failed to send message.');
        setChatMessage(textToSend);
      }
    } catch (err) {
      setChatLogs((prev) => prev.filter((msg) => msg._id !== tempId));
      console.error("Signal payload routing error:", err);
      setChatMessage(textToSend);
    }
  };

  // Open the block confirmation dialog for the active chat match
  const handleRequestBlockUser = () => {
    setShowBlockMenu(false);
    setShowBlockConfirm(true);
  };

  // Confirm and execute blocking the active chat match
  const handleConfirmBlockUser = async () => {
    if (!userProfile?.userId || !activeChatMatch?.userId) return;
    setBlockActionLoading(true);
    try {
      const response = await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerUserId: userProfile.userId,
          blockedUserId: activeChatMatch.userId,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to block user.');
      setBlockStatus((prev) => ({ ...prev, iBlockedThem: true }));
      showToast('User blocked successfully.');
    } catch (err) {
      showToast(err.message || 'Error blocking user.');
    } finally {
      setBlockActionLoading(false);
      setShowBlockConfirm(false);
    }
  };

  // Unblock the active chat match — messaging is restored immediately,
  // existing conversation and match remain untouched.
  const handleUnblockUser = async () => {
    if (!userProfile?.userId || !activeChatMatch?.userId) return;
    setShowBlockMenu(false);
    setBlockActionLoading(true);
    try {
      const response = await fetch('/api/block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockerUserId: userProfile.userId,
          blockedUserId: activeChatMatch.userId,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to unblock user.');
      setBlockStatus((prev) => ({ ...prev, iBlockedThem: false }));
      showToast('User unblocked successfully.');
    } catch (err) {
      showToast(err.message || 'Error unblocking user.');
    } finally {
      setBlockActionLoading(false);
    }
  };

  const handleLogOut = () => {
    stopSpeaking();
    if (userProfile?.userId) {
      fetch('/api/presence', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile.userId }),
        keepalive: true,
      }).catch((err) => console.error('Failed to clear online presence:', err));
    }
    // Clear the signed session cookie server-side. Fire-and-forget: the
    // client-side state reset below happens regardless, and this is what
    // actually ends the session so a later refresh can't silently restore it.
    fetch('/api/auth/session', { method: 'DELETE' }).catch((err) => {
      console.error('Failed to clear session cookie on logout:', err);
    });

    setUserProfile(null);
    setMatches([]);
    setInputEmail('');
    setOtpCode('');
    setRegisterForm({ name: '', profession: '', rawBio: '', photoUrl: '', gender: '', age: '', location: '', audioNotificationsEnabled: true });
    setRegisterImageError('');
    setEditImageError('');
    setSearchProfession('');
    setSearchKeyword('');
    setMatchFilterEnabled(false);
    setMinMatchPercent(75);
    setMaxMatchPercent(100);
    setPreferredLocation('');
    setPreferenceFilterEnabled(false);
    setPreferredGender('Any');
    setMinAge(18);
    setMaxAge(60);
    appliedFiltersRef.current = {
      searchProfession: '',
      searchKeyword: '',
      matchFilterEnabled: false,
      minMatchPercent: 75,
      maxMatchPercent: 100,
      preferredLocation: '',
      preferenceFilterEnabled: false,
      preferredGender: 'Any',
      minAge: 18,
      maxAge: 60,
    };
    setMessageRequests([]);
    setMessageRequestStatuses({});
    setShowRequestsPanel(false);
    setShowSendRequestModal(false);
    setActiveChatMatch(null);
    setBlockStatus({ iBlockedThem: false, theyBlockedMe: false });
    setShowBlockMenu(false);
    setShowBlockConfirm(false);
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
    <main className="relative min-h-screen overflow-x-hidden bg-vk-bg text-vk-white flex flex-col items-center justify-center p-4 md:p-8 selection:bg-vk-primary/30">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-vk-cyan/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-vk-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-vk-pink/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]" style={{backgroundImage:'radial-gradient(circle at 1px 1px, #EEF0FF 1px, transparent 0)', backgroundSize:'28px 28px'}} />
      </div>

      {/* FONT IMPORTS */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Inter', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }

        /* Edit Profile popup: cap height to the visible viewport (accounting for
           the backdrop's p-4 padding) so the whole card scrolls as one unit
           instead of overflowing off-screen. Falls back to vh for older
           browsers, then upgrades to dvh (dynamic viewport height) where
           supported so the cap shrinks correctly when the mobile keyboard opens. */
        .editProfileModalCard {
          max-height: calc(100vh - 2rem);
        }
        @supports (max-height: 100dvh) {
          .editProfileModalCard {
            max-height: calc(100dvh - 2rem);
          }
        }
      `}</style>

      {/* GEO & AI ENGINE SEARCH INDEXING METADATA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgData) }}
      />

      {/* VibeKey Global Header: logo top-left, theme toggle top-right */}
      <header className="relative z-10 w-full max-w-6xl flex items-center justify-between gap-4 mb-3 md:mb-5 px-1 sm:px-2">
        <Image
          src="/vibekey-logo.png"
          alt="VibeKey Logo"
          width={1254}
          height={1254}
          priority
          className="h-9 sm:h-10 md:h-12 w-auto object-contain select-none"
        />
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === 'light'}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="vk-theme-toggle shrink-0"
          >
            <span className={`vk-theme-icon ${theme === 'dark' ? 'active' : ''}`} aria-hidden="true">🌙</span>
            <span className="vk-theme-track" aria-hidden="true"><span className="vk-theme-thumb" /></span>
            <span className={`vk-theme-icon ${theme === 'light' ? 'active' : ''}`} aria-hidden="true">☀️</span>
          </button>
        </div>
      </header>

      {/* GLOBAL NOTIFICATION SYSTEM BANNER FLOATER */}
      {toastMessage && (
        <div className="fixed top-5 right-5 bg-vk-surface text-vk-white text-xs font-bold font-body px-5 py-3 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-[#2A3155] z-50 animate-in fade-in slide-in-from-top-3 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-vk-cyan shadow-vk-glow-cyan" />
          {toastMessage}
        </div>
      )}

      {/* Dynamic Branding Layout Grid */}
      <div className="relative z-10 text-center mb-8 md:mb-10 max-w-3xl px-2">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-vk-surface/80 border border-vk-border backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-[#6C3CFF]" />
          <span className="text-[11px] font-body font-bold tracking-wide text-vk-lavender uppercase vk-hero-label">AI-assisted discovery • human connection</span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight text-vk-white">
          Vibe<span className="bg-vk-aurora bg-clip-text text-transparent">Key</span>
        </h1>
        <h2 className="font-body text-base md:text-lg font-medium text-vk-text-secondary mt-3 max-w-xl mx-auto">
          Unlock new vibe. Discover people, opportunities, and meaningful connections.
        </h2>

        {/* GEO Definition Statement Banner */}
        <div className="w-full max-w-2xl mx-auto my-6 text-center">
          <p className="font-body text-xs text-vk-text-muted leading-relaxed bg-vk-surface/80 vk-hero-description backdrop-blur-sm p-4 rounded-vk-lg border border-vk-border shadow-vk-md">
            VibeKey is an open-ended social and professional networking platform that uses AI vector matching to connect young adults for career opportunities, friendships, and meaningful relationships.
          </p>
        </div>
      </div>

      {error && (
        <div className="w-full max-w-md bg-[#3A1722] border border-[#6A2A3A] text-[#FF7B8A] p-4 rounded-2xl text-sm font-semibold mb-6 font-body">
          ⚠️ {error}
        </div>
      )}

      {/* Brief loading state while we check for an existing session on mount —
          avoids flashing the login form before we know whether to restore it */}
      {isRestoringSession && !userProfile && (
        <div className="w-full max-w-md bg-vk-surface border border-[#2A3155] rounded-3xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] text-center">
          <p className="text-sm text-vk-text-muted font-body">Restoring your session…</p>
        </div>
      )}

      {/* STEP CONFIGURATOR ROUTING GATEWAY MODAL */}
      {!userProfile && !isRestoringSession && (
        <div className="relative z-10 w-full max-w-md bg-vk-surface/95 backdrop-blur-md border border-vk-border rounded-vk-xl p-6 md:p-8 shadow-vk-lg">
          
          {step === 'EMAIL' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <h3 className="vk-auth-title font-display text-xl font-bold text-vk-white border-b border-vk-border pb-3">Sign in or join VibeKey</h3>
              <div className="space-y-1.5">
                <label className="vk-phase2f5-white text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Email address</label>
                <input type="email" required placeholder="name@domain.com" value={inputEmail} onChange={(e) => setInputEmail(e.target.value)} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2.5 text-vk-white text-sm font-body focus:border-vk-primary focus:outline-none focus:ring-2 focus:ring-vk-primary/20 transition" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-vk-primary hover:bg-vk-primaryHover text-white font-display font-bold text-sm rounded-full transition disabled:opacity-50 shadow-vk-glow-purple">
                {loading ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
              <h3 className="vk-phase2f5-white font-display text-xl font-bold text-vk-white">Enter your code</h3>
              <p className="vk-phase2f5-white text-xs text-vk-text-muted font-body">We sent a verification code to:</p>
              <span className="text-[#6C3CFF] font-bold font-body text-xs bg-vk-primary/15 px-3 py-1 rounded-full border border-vk-primary/30 inline-block">{inputEmail}</span>
              
              <input type="text" maxLength={6} required placeholder="******" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="w-full bg-vk-bg border border-vk-border rounded-xl py-3 text-center text-2xl font-bold tracking-widest text-vk-white focus:outline-none focus:border-vk-primary font-display" />
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('EMAIL')} className="w-1/2 py-2.5 bg-vk-elevated text-vk-white rounded-full text-xs font-bold border border-[#2A3155] transition hover:bg-[#20264A] font-display">Back</button>
                <button type="submit" disabled={loading} className="w-1/2 py-2.5 bg-vk-primary hover:bg-vk-primaryHover text-white rounded-full text-xs font-bold transition shadow-vk-glow-purple font-display">
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>
              </div>
            </form>
          )}

          {step === 'REGISTER' && (
            <form onSubmit={handleRegisterProfileSubmit} className="space-y-4">
              <div className="vk-onboarding-banner bg-vk-primary/15 border border-vk-primary/30 rounded-xl p-3 text-xs text-[#D6D0FF] font-semibold text-center font-body">
                🎉 You're in — let's finish setting up your profile.
              </div>
              <h3 className="font-display text-xl font-bold text-white border-b border-vk-border pb-2">Complete your profile</h3>
              
              <div className="space-y-1">
                <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Full name</label>
                <input type="text" required placeholder="Display name" value={registerForm.name} onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary font-body" />
              </div>

              <div className="space-y-1">
                <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Profession or role</label>
                <input type="text" required placeholder="e.g. Software Engineer, Student, Founder" value={registerForm.profession} onChange={(e) => setRegisterForm(prev => ({ ...prev, profession: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary font-body" />
              </div>

              {/* Optional demographic fields — power the gender/age/location preference filters on the dashboard */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Gender <span className="normal-case font-medium text-[#7F87A8]">(optional)</span></label>
                  <select value={registerForm.gender} onChange={(e) => setRegisterForm(prev => ({ ...prev, gender: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary font-body">
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Age <span className="normal-case font-medium text-[#7F87A8]">(optional)</span></label>
                  <input type="number" min="18" max="120" placeholder="e.g. 28" value={registerForm.age} onChange={(e) => setRegisterForm(prev => ({ ...prev, age: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary font-body" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Location <span className="normal-case font-medium text-[#7F87A8]">(optional)</span></label>
                <input type="text" placeholder="e.g. Mumbai, Bangalore" value={registerForm.location} onChange={(e) => setRegisterForm(prev => ({ ...prev, location: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary font-body" />
              </div>

              {/* Profile Photo File Upload Field */}
              <div className="space-y-1">
                <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Profile photo</label>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png" 
                  onChange={(e) => handlePhotoUpload(e, setRegisterForm, setRegisterImageError)} 
                  className="w-full text-xs text-vk-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#6C3CFF] file:text-white hover:file:bg-[#8059FF] cursor-pointer bg-vk-bg border border-vk-border rounded-xl p-1 font-body" 
                />
                <p className="vk-phase2f5-white vk-format-hint text-[10px] text-[#7F87A8] font-body">Formats: .jpg, .jpeg, .png (max 2 MB)</p>
                {registerImageError && (
                  <p className="text-xs text-[#FF7B8A] font-semibold mt-1 font-body">{registerImageError}</p>
                )}
                {registerForm.photoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={registerForm.photoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#6C3CFF]" />
                    <span className="text-[10px] text-[#22C55E] font-body font-bold">Looking good!</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="vk-phase2f5-white vk-form-label text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">Bio & interests</label>
                <textarea required rows={3} maxLength={4000} placeholder="Tell us about yourself, career goals, or what brings you to VibeKey..." value={registerForm.rawBio} onChange={(e) => setRegisterForm(prev => ({ ...prev, rawBio: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white resize-none focus:outline-none focus:border-vk-primary font-body" />
                <div className="vk-phase2f5-white text-right text-[10px] text-vk-text-muted font-body">{registerForm.rawBio.length.toLocaleString()} / 4,000 characters</div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 bg-vk-primary hover:bg-vk-primaryHover text-white font-display font-bold text-sm rounded-full transition shadow-vk-glow-purple">
                {loading ? 'Creating profile…' : 'Create account & log in'}
              </button>
            </form>
          )}

        </div>
      )}

      {/* CORE GRAPHICAL DASHBOARD COMPONENT MATRIX LAYER */}
      {userProfile && (
        <>
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* User Profile Metrics Display Drawer */}
          <div className="bg-vk-surface border border-[#2A3155] rounded-3xl p-6 h-fit flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <div>
              {userProfile.photoUrl ? (
                <img 
                  src={getDirectDriveUrl(userProfile.photoUrl)} 
                  alt={userProfile.name} 
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#1B1740] mb-4 mx-auto md:mx-0 shadow-sm" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    const fallbackEl = document.createElement('div');
                    fallbackEl.className = "w-24 h-24 rounded-full bg-vk-primary/15 text-[#D6D0FF] flex items-center justify-center mb-4 mx-auto md:mx-0 border border-vk-primary/30 text-[10px] p-2 font-bold text-center font-body";
                    fallbackEl.innerText = "Verify link permissions";
                    e.target.parentNode.insertBefore(fallbackEl, e.target);
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-vk-elevated flex items-center justify-center mb-4 mx-auto md:mx-0 text-[#7F87A8] text-xs font-bold border border-[#2A3155] font-body">NO IMAGE</div>
              )}
              
              <h3 className="font-display text-xl font-bold text-vk-white truncate text-center md:text-left">{userProfile.name}</h3>
              <p className="text-xs text-[#6C3CFF] font-bold mb-1 tracking-wide font-body uppercase text-center md:text-left">{userProfile.profession || 'Professional'}</p>
              {(userProfile.age || userProfile.location) && (
                <p className="text-xs text-[#7F87A8] font-medium font-body text-center md:text-left">
                  {[userProfile.age ? `${userProfile.age}` : null, userProfile.location || null].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-xs text-[#7F87A8] mb-4 font-body truncate text-center md:text-left">{userProfile.userId}</p>
              
              <div className="space-y-3 text-left bg-[#090D24] p-4 rounded-2xl border border-[#2A3155] text-xs font-medium mb-4 font-body">
                <div>
                  <span className="text-[10px] text-[#7F87A8] block uppercase font-bold tracking-wide">Temperament</span>
                  <span className="text-[#F59E0B] text-sm font-semibold">{userProfile.aiAnalysis?.temperament || 'Adaptive Matrix'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7F87A8] block uppercase font-bold tracking-wide">Trajectory</span>
                  <span className="text-[#22C55E] text-sm font-semibold">{userProfile.aiAnalysis?.vision || 'Innovation Target'}</span>
                </div>
              </div>

              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="w-full py-2 bg-vk-primary/15 hover:bg-[#28204A] text-[#D6D0FF] border border-vk-primary/30 font-display font-bold text-xs rounded-full transition duration-150 mb-2"
              >
                📝 Edit profile
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-[#2A3155] space-y-2">
              <button onClick={handleLogOut} className="w-full py-2.5 bg-vk-elevated hover:bg-[#20264A] text-vk-white text-xs font-bold rounded-full transition font-display border border-[#2A3155]">
                Log out
              </button>
              <button onClick={handleDeleteProfile} disabled={loading} className="w-full py-2.5 bg-vk-surface hover:bg-[#3A1722] text-[#FF7B8A] text-xs font-bold rounded-full border border-[#6A2A3A] transition font-display">
                Delete profile
              </button>
            </div>
          </div>

          {/* VibeKey Phase 2B Discovery Hero */}
          <section className="col-span-1 md:col-span-2 relative overflow-hidden mb-5 rounded-[28px] border border-vk-border bg-vk-surface p-5 sm:p-6 shadow-vk-lg min-w-0">
            <div className="pointer-events-none absolute -top-28 -right-20 h-64 w-64 rounded-full bg-vk-cyan/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-vk-primary/10 blur-3xl" />
            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-vk-primary/30 bg-vk-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#D6D0FF] vk-discovery-label">
                  <span className="h-1.5 w-1.5 rounded-full bg-vk-cyan shadow-vk-glow-cyan" />
                  AI-assisted discovery
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-display font-bold tracking-tight text-vk-white">
                  Discover your next connection
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-vk-text-muted font-body vk-discovery-description">
                  Explore people aligned with your goals, interests and preferences. Your existing VibeKey matching engine remains in control of the recommendations.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:shrink-0">
                <div className="rounded-2xl border border-vk-border bg-vk-bg/70 px-4 py-3 vk-discovery-stat">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-vk-text-muted vk-stat-label">Matches</span>
                  <span className="mt-1 block text-xl font-display font-bold text-vk-white vk-stat-value">{matches?.length || 0}</span>
                </div>
                <div className="rounded-2xl border border-vk-border bg-vk-bg/70 px-4 py-3 vk-discovery-stat">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-vk-text-muted vk-stat-label">Range</span>
                  <span className="mt-1 block text-xl font-display font-bold text-vk-cyan vk-range-value">{matchFilterEnabled ? `${minMatchPercent}–${maxMatchPercent}%` : '75%+'}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-5 border-t border-vk-border">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-display font-bold text-vk-white">Search &amp; Filters</h3>
                  <p className="text-[11px] text-vk-text-muted mt-1">Refine who appears in your discovery results.</p>
                </div>
              </div>
            {/* Real-time Cluster Query Interface Box */}
            <div className="bg-vk-surface border border-vk-border rounded-[24px] p-4 sm:p-5 shadow-vk-md space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="w-full sm:w-1/3 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-vk-text-muted block tracking-wide font-body">Filter by profession</label>
                  <input type="text" placeholder="e.g. Engineer, Student, Creator" value={searchProfession} onChange={(e) => setSearchProfession(e.target.value)} className="w-full bg-vk-bg border border-vk-border rounded-xl px-3 py-2 text-xs text-vk-white focus:outline-none focus:border-vk-primary font-body" />
                </div>
                <div className="w-full sm:w-1/3 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-vk-text-muted block tracking-wide font-body">Keyword search</label>
                  <input type="text" placeholder="Search names, interests or bio details..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="w-full bg-vk-bg border border-vk-border rounded-xl px-3 py-2 text-xs text-vk-white focus:outline-none focus:border-vk-primary font-body" />
                </div>
                <div className="w-full sm:w-1/3 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-vk-text-muted block tracking-wide font-body">Filter by location</label>
                  <input type="text" placeholder="e.g. Mumbai, Bangalore" value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} className="w-full bg-vk-bg border border-vk-border rounded-xl px-3 py-2 text-xs text-vk-white focus:outline-none focus:border-vk-primary font-body" />
                </div>
                <button onClick={handleApplyFilters} disabled={loading} className="w-full sm:w-auto px-5 py-2 bg-vk-primary hover:bg-vk-primaryHover text-white font-display font-bold text-xs rounded-full shadow-vk-glow-purple transition whitespace-nowrap disabled:opacity-50">
                  {loading ? 'Filtering…' : 'Apply filters'}
                </button>
              </div>

              {/* Match Percentage Range Filter — dual range slider */}
              <div className="border-t border-[#2A3155] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-vk-text-muted tracking-wide font-body flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={matchFilterEnabled}
                      onChange={(e) => setMatchFilterEnabled(e.target.checked)}
                      className="accent-[#6C3CFF] w-3.5 h-3.5"
                    />
                    Filter by match percentage
                  </label>
                  {matchFilterEnabled && (
                    <span className="text-xs font-bold font-display text-[#6C3CFF]">
                      {minMatchPercent}% – {maxMatchPercent}%
                    </span>
                  )}
                </div>
                {matchFilterEnabled && (
                  <div className="px-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body w-8">{minMatchPercent}%</span>
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
                        className="flex-1 accent-[#6C3CFF] h-1.5"
                      />
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body">Min</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body w-8">{maxMatchPercent}%</span>
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
                        className="flex-1 accent-[#6C3CFF] h-1.5"
                      />
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body">Max</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Gender/Age Preference Filter — same toggle+detail pattern as Match % above */}
              <div className="border-t border-[#2A3155] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-vk-text-muted tracking-wide font-body flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={preferenceFilterEnabled}
                      onChange={(e) => setPreferenceFilterEnabled(e.target.checked)}
                      className="accent-[#6C3CFF] w-3.5 h-3.5"
                    />
                    Filter by preferences
                  </label>
                  {preferenceFilterEnabled && (
                    <span className="text-xs font-bold font-display text-[#6C3CFF]">
                      {preferredGender} · {minAge}–{maxAge}
                    </span>
                  )}
                </div>
                {preferenceFilterEnabled && (
                  <div className="px-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body w-8">Gender</span>
                      <select
                        value={preferredGender}
                        onChange={(e) => setPreferredGender(e.target.value)}
                        className="flex-1 bg-vk-bg border border-vk-border rounded-xl px-3 py-1.5 text-xs text-vk-white focus:outline-none focus:border-vk-primary font-body"
                      >
                        <option value="Any">Any</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body w-8">{minAge}</span>
                      <input
                        type="range"
                        min={18}
                        max={99}
                        value={minAge}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMinAge(val);
                          if (val > maxAge) setMaxAge(val);
                        }}
                        className="flex-1 accent-[#6C3CFF] h-1.5"
                      />
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body">Min age</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body w-8">{maxAge}</span>
                      <input
                        type="range"
                        min={18}
                        max={99}
                        value={maxAge}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMaxAge(val);
                          if (val < minAge) setMinAge(val);
                        }}
                        className="flex-1 accent-[#6C3CFF] h-1.5"
                      />
                      <span className="text-[10px] text-[#7F87A8] font-bold font-body">Max age</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            </div>
          </section>

          {/* Matches Workspace Core Stream */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display text-xl sm:text-2xl font-bold text-vk-white flex items-center gap-3">
                <span>Your matches</span>
                <span className="text-xs bg-vk-primary/15 text-[#D6D0FF] border border-vk-primary/30 px-3 py-1 rounded-full font-bold font-body">
                  {matches?.length || 0} found
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRequestsPanel(true)}
                  className="relative px-4 py-1.5 bg-vk-primary/15 hover:bg-[#28204A] text-[#D6D0FF] border border-vk-primary/30 font-display font-bold text-xs rounded-full transition"
                >
                  Message Requests
                  {incomingPendingRequests.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#6C3CFF] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {incomingPendingRequests.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {(!matches || matches.length === 0) ? (
              <div className="bg-vk-surface border border-dashed border-[#2A3155] text-center p-12 rounded-3xl">
                <p className="text-vk-text-muted text-sm font-body">No matches yet — try adjusting your filters or check back soon.</p>
              </div>
            ) : (
              matches.map((item) => (
                <div key={item.id} className="group relative overflow-hidden bg-vk-surface border border-vk-border rounded-[24px] p-5 sm:p-6 shadow-vk-md hover:border-vk-primary/50 hover:-translate-y-0.5 transition duration-260">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        {item.photoUrl ? (
                          <img src={getDirectDriveUrl(item.photoUrl)} alt={item.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#1B1740]" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80'; }} />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-vk-elevated border border-[#2A3155] flex items-center justify-center text-[#7F87A8] font-bold text-xs font-body">AI</div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-vk-surface ${item.isOnline ? 'bg-[#22C55E]' : 'bg-[#6B7280]'}`} title={item.isOnline ? 'Online now' : 'Offline'} aria-label={item.isOnline ? 'Online now' : 'Offline'} />
                      </div>
                      <div>
                        <h4 className="font-display text-md font-bold text-vk-white tracking-tight">{item.name}</h4>
                        <p className="text-xs text-vk-cyan font-semibold font-body">{item.profession || 'Connection'}</p>
                        {(item.gender || item.age || item.location) && (
                          <p className="text-[10px] text-[#7F87A8] font-medium font-body">
                            {[item.gender ? `Gender: ${item.gender}` : null, item.age ? `${item.age}` : null, item.location || null].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex min-w-[64px] justify-center rounded-xl border border-vk-cyan/30 bg-vk-cyan/10 px-2.5 py-1 text-xl font-bold font-display text-vk-cyan">{item.score}%</span>
                      <span className="text-[9px] block text-[#7F87A8] font-bold uppercase tracking-wide font-body">Match</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#EEF0FF] bg-[#090D24] p-3.5 rounded-2xl border border-[#2A3155] leading-relaxed font-body">{item.bio}</p>
                  
                  {/* Dynamic AI Compatibility Accordion Element */}
                  <div className="mt-4 bg-vk-bg border border-vk-border rounded-2xl overflow-hidden text-xs">
                    <details className="group">
                      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none font-bold text-vk-text-muted hover:text-[#6C3CFF] transition font-display">
                        <span>See why you match</span>
                        <span className="text-[10px] transition group-open:rotate-180">▼</span>
                      </summary>
                      <div className="px-3 pb-3 pt-1 border-t border-[#2A3155] text-[#EEF0FF] space-y-2 font-medium font-body">
                        <p className="italic text-vk-text-muted leading-relaxed bg-vk-surface p-2 rounded-xl border border-[#2A3155]">
                          {item.aiAnalysis?.breakdown}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide font-body">
                          <div className="bg-vk-surface p-2 rounded-lg border border-[#2A3155]">
                            <span className="text-[#7F87A8] block">Communication</span>
                            <span className="text-[#22C55E] block truncate font-bold">{item.aiAnalysis?.communication}</span>
                          </div>
                          <div className="bg-vk-surface p-2 rounded-lg border border-[#2A3155]">
                            <span className="text-[#7F87A8] block">Type</span>
                            <span className="text-[#F59E0B] block truncate font-bold">{item.aiAnalysis?.temperament}</span>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Messaging controls driven by message requests. */}
                  <div className="mt-4 pt-3 border-t border-[#2A3155] flex flex-wrap items-center justify-end gap-2">
                    {(() => {
                      const status = messageRequestStatuses[item.userId] || 'none';
                      const hasUnread = status === 'accepted' && unreadSenderIds.has(String(item.userId));
                      const btnLabel = status === 'accepted' ? 'Message' : status === 'pending_sent' ? 'Request Pending' : status === 'pending_received' ? 'Respond to Request' : status === 'rejected' ? 'Declined' : 'Send Message';
                      const btnClass = hasUnread ? 'bg-[#22C55E] text-white' : status === 'accepted' ? 'bg-vk-primary text-white' : status === 'pending_received' ? 'bg-[#22C55E] text-white' : status === 'pending_sent' ? 'bg-vk-primary/15 text-[#D6D0FF] border border-vk-primary/30 cursor-default' : status === 'rejected' ? 'bg-vk-elevated text-vk-text-muted border border-vk-border cursor-default' : 'bg-vk-primary text-white';
                      return <button onClick={() => handleMessageClick(item)} disabled={status === 'pending_sent' || status === 'rejected'} className={`px-4 py-1.5 font-display font-bold text-xs rounded-full transition ${btnClass}`}>{btnLabel}</button>;
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        </>
      )}

      {/* INTERACTIVE PROFILE SPECS EDITING MODAL BACKDROP CONTAINER */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#FFFFFF]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            ref={editModalCardRef}
            onFocus={handleEditModalFieldFocus}
            className="editProfileModalCard w-full max-w-md bg-vk-surface border border-[#2A3155] rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150 overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            
            <h3 className="font-display text-xl font-bold text-vk-white border-b border-vk-border pb-2 mb-4">
              Edit profile
            </h3>
            
            <form onSubmit={handleUpdateProfileSubmit} className="space-y-4 text-xs font-semibold font-body">
              <div>
                <label className="vk-phase2f5-white text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Full name</label>
                <input type="text" required value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Profession / interest</label>
                <input type="text" required value={editForm.profession} onChange={(e) => setEditForm(prev => ({ ...prev, profession: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary" />
              </div>

              {/* Optional demographic fields — power the gender/age/location preference filters on the dashboard */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="vk-phase2f5-white text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Gender <span className="normal-case font-medium text-[#7F87A8]">(optional)</span></label>
                  <select value={editForm.gender} onChange={(e) => setEditForm(prev => ({ ...prev, gender: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary">
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="vk-phase2f5-white text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Age <span className="normal-case font-medium text-[#7F87A8]">(optional)</span></label>
                  <input type="number" min="18" max="120" value={editForm.age} onChange={(e) => setEditForm(prev => ({ ...prev, age: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary" />
                </div>
              </div>

              <div>
                <label className="vk-phase2f5-white text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Location <span className="normal-case font-medium text-[#7F87A8]">(optional)</span></label>
                <input type="text" placeholder="e.g. Mumbai, Bangalore" value={editForm.location} onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white focus:outline-none focus:border-vk-primary" />
              </div>
              
              {/* Profile Photo Upload Option */}
              <div>
                <label className="vk-phase2f5-white text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Profile photo</label>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png" 
                  onChange={(e) => handlePhotoUpload(e, setEditForm, setEditImageError)} 
                  className="w-full text-xs text-vk-text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#6C3CFF] file:text-white hover:file:bg-[#8059FF] cursor-pointer bg-vk-bg border border-vk-border rounded-xl p-1" 
                />
                <p className="vk-phase2f5-white text-[10px] text-[#7F87A8] mt-1">Formats: .jpg, .jpeg, .png (max 2 MB)</p>
                {editImageError && (
                  <p className="text-xs text-[#FF7B8A] font-semibold mt-1">{editImageError}</p>
                )}
                {editForm.photoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={getDirectDriveUrl(editForm.photoUrl)} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#6C3CFF]" />
                    <span className="text-[10px] text-[#22C55E] font-body font-bold">Looking good!</span>
                  </div>
                )}
              </div>

              {/* Audio Notification Toggle Switch */}
              <div className="flex items-center justify-between p-3 bg-vk-bg border border-vk-border rounded-xl">
                <div>
                  <label className="text-xs font-bold text-vk-white block font-body">Audio notifications</label>
                  <span className="text-[10px] text-vk-text-muted font-normal block">Play a sound for incoming messages</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm(prev => ({ ...prev, audioNotificationsEnabled: !prev.audioNotificationsEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    editForm.audioNotificationsEnabled ? 'bg-[#6C3CFF]' : 'bg-[#394064]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-vk-surface transition-transform ${
                      editForm.audioNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-vk-text-muted block mb-1">Bio & goals</label>
                <textarea required rows={3} maxLength={4000} value={editForm.rawBio} onChange={(e) => setEditForm(prev => ({ ...prev, rawBio: e.target.value }))} className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white resize-none focus:outline-none focus:border-vk-primary" />
                <div className="vk-phase2f5-white text-right text-[10px] text-vk-text-muted font-body">{editForm.rawBio.length.toLocaleString()} / 4,000 characters</div>
              </div>
              
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-vk-elevated hover:bg-[#20264A] text-vk-white rounded-full font-bold transition font-display border border-[#2A3155]">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-vk-primary hover:bg-vk-primaryHover text-white font-bold rounded-full transition shadow-vk-glow-purple font-display">
                  {loading ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC DATABASE MESSAGING OVERLAY DRAWER */}
      {activeChatMatch && (
        <div className="fixed bottom-4 left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 w-auto sm:w-full max-w-sm bg-vk-surface border border-[#2A3155] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* Header with Audio Toggle Control */}
          <div className="bg-vk-primary/15 px-4 py-3 border-b border-vk-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${activeChatMatch.isOnline ? 'bg-[#22C55E]' : 'bg-[#6B7280]'}`}
                title={activeChatMatch.isOnline ? 'Online now' : 'Offline'}
                aria-label={activeChatMatch.isOnline ? 'Online now' : 'Offline'}
              />
              <div>
                <h4 className="text-xs font-display font-bold text-vk-white tracking-wide truncate max-w-[140px]">{activeChatMatch.name}</h4>
                <span className="text-[9px] font-body text-[#D6D0FF] block font-bold">Match: {activeChatMatch.score}%</span>
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
                    ? 'bg-vk-surface border-vk-primary/30 text-[#6C3CFF] hover:bg-[#28204A]' 
                    : 'bg-vk-surface border-[#2A3155] text-[#7F87A8] hover:bg-vk-elevated'
                }`}
              >
                {userProfile?.audioNotificationsEnabled ? '🔔' : '🔕'}
              </button>

              {/* Chat Options Menu — Read Aloud, Voice Settings, Block / Unblock.
                  Consolidated here (instead of separate always-visible header
                  icons) to keep the header row from overflowing on narrow
                  mobile screens. */}
              <div className="relative" ref={blockMenuRef}>
                <button
                  type="button"
                  title="Chat options"
                  onClick={() => setShowBlockMenu((prev) => !prev)}
                  className="p-1.5 rounded-full border text-xs bg-vk-surface border-[#2A3155] text-vk-text-muted hover:bg-vk-elevated flex items-center justify-center transition-colors leading-none"
                >
                  ⋮
                </button>

                {showBlockMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-vk-surface border border-[#2A3155] rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.12)] py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                    {isSpeechSupported() && (
                      <>
                        <button
                          type="button"
                          onClick={() => { toggleSpeechEnabled(); setShowBlockMenu(false); }}
                          className="w-full flex items-center justify-between gap-2 text-left px-3.5 py-2 text-xs font-body font-semibold text-vk-white hover:bg-vk-elevated transition-colors"
                        >
                          <span>🔊 Read Messages Aloud</span>
                          <span className={speechEnabled ? 'text-[#22C55E]' : 'text-vk-text-muted'}>{speechEnabled ? 'ON' : 'OFF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowVoiceSettings(true); setShowBlockMenu(false); }}
                          className="w-full text-left px-3.5 py-2 text-xs font-body font-semibold text-vk-white hover:bg-vk-elevated transition-colors"
                        >
                          ⚙️ Voice Settings
                        </button>
                        <div className="my-1 border-t border-vk-border" />
                      </>
                    )}
                    {blockStatus.iBlockedThem ? (
                      <button
                        type="button"
                        onClick={handleUnblockUser}
                        disabled={blockActionLoading}
                        className="w-full text-left px-3.5 py-2 text-xs font-body font-semibold text-[#22C55E] hover:bg-vk-elevated disabled:opacity-50 transition-colors"
                      >
                        Unblock User
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestBlockUser}
                        disabled={blockActionLoading}
                        className="w-full text-left px-3.5 py-2 text-xs font-body font-semibold text-[#6C3CFF] hover:bg-vk-primary/15 disabled:opacity-50 transition-colors"
                      >
                        Block User
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => { stopTyping(); setIsOtherUserTyping(false); setActiveChatMatch(null); }} 
                className="text-vk-text-muted hover:text-vk-white text-sm font-bold bg-vk-surface w-6 h-6 rounded-full flex items-center justify-center border border-[#2A3155] transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Message Body Logs */}
          <div className="relative">
          <div ref={chatMessagesContainerRef} onScroll={handleChatMessagesScroll} className="p-4 h-64 overflow-y-auto bg-[#090D24] space-y-2.5 flex flex-col">
            <div className="text-center p-1 mb-1">
              <span className="text-[9px] text-[#7F87A8] font-body tracking-tight bg-vk-surface border border-[#2A3155] px-3 py-0.5 rounded-full">🔒 Secure sync channel connected</span>
            </div>
            
            {isOtherUserTyping && (
              <div className="self-start flex items-center gap-2 text-xs text-[#6C3CFF] font-semibold font-body px-3 py-1.5 bg-vk-primary/10 border border-vk-primary/20 rounded-full" aria-live="polite">
                <span>{activeChatMatch.name} is typing</span>
                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7F87A8] animate-bounce [animation-delay:-0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7F87A8] animate-bounce [animation-delay:-0.1s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7F87A8] animate-bounce" />
                </span>
              </div>
            )}

            {chatLogs.map((msg, index) => {
              const isMe = msg.senderId === userProfile.userId;
              const senderGender = isMe ? userProfile?.gender : activeChatMatch?.gender;
              return (
                <div key={index} className={`max-w-[80%] p-2.5 rounded-2xl text-xs leading-relaxed border font-body ${isMe ? 'bg-[#6C3CFF] border-[#6C3CFF] text-white rounded-br-none self-end' : 'bg-vk-surface border-[#2A3155] text-vk-white rounded-tl-none self-start'}`}>
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1">{msg.messageText}</div>
                    {isSpeechSupported() && (
                      <button
                        type="button"
                        title="Listen"
                        aria-label="Listen to this message"
                        onClick={() => speakMessage(msg.messageText, { gender: senderGender })}
                        className={`shrink-0 text-[11px] leading-none opacity-70 hover:opacity-100 transition-opacity ${isMe ? 'text-white' : 'text-vk-text-muted'}`}
                      >
                        🔊
                      </button>
                    )}
                  </div>
                  <div className={`mt-1 flex items-center gap-1 text-[9px] font-medium ${isMe ? 'justify-end text-white/70' : 'justify-start text-vk-text-muted'}`}>
                    <span>{formatMessageTimestamp(msg.timestamp)}</span>
                    {isMe && (
                      <span
                        className={`font-bold ${msg.read ? 'text-[#22C55E]' : msg.deliveredAt ? 'text-white/80' : 'text-white/60'}`}
                        title={msg.read ? 'Read by recipient' : msg.deliveredAt ? 'Delivered' : 'Sent'}
                        aria-label={msg.read ? 'Read by recipient' : msg.deliveredAt ? 'Delivered' : 'Sent'}
                      >{msg.read ? '✓✓' : msg.deliveredAt ? '✓✓' : '✓'}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {showNewChatMessage && (
            <button type="button" onClick={jumpToLatestChatMessage} className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10 px-3 py-1.5 rounded-full bg-vk-primary text-white text-[11px] font-semibold shadow-lg border border-white/10">
              🔔 New Message ↓
            </button>
          )}
          </div>

          {/* Message Input Payload Form */}
          <div className="bg-vk-surface border-t border-[#2A3155]">
            {blockStatus.theyBlockedMe && (
              <p className="text-[10px] font-body text-[#6C3CFF] bg-vk-primary/15 border border-vk-primary/30 rounded-xl mx-3 mt-2.5 px-3 py-2 text-center">
                You cannot send messages because this user has blocked communication.
              </p>
            )}
            <form onSubmit={handleSendMessage} className="p-3 flex gap-1.5 sm:gap-2 relative">
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full left-3 mb-2 w-64 max-h-48 overflow-y-auto bg-vk-surface border border-[#2A3155] rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.35)] p-2 grid grid-cols-8 gap-1 z-20"
                >
                  {CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-lg leading-none p-1 rounded-lg hover:bg-vk-elevated transition-colors"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                disabled={blockStatus.theyBlockedMe}
                title="Insert emoji"
                aria-label="Insert emoji"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-vk-border bg-vk-bg text-base hover:bg-vk-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                😊
              </button>
              <input
                ref={chatInputRef}
                type="text"
                placeholder={blockStatus.theyBlockedMe ? "Messaging unavailable" : "Type a message..."}
                value={chatMessage}
                onChange={handleChatInputChange}
                onFocus={() => setShowEmojiPicker(false)}
                onBlur={stopTyping}
                disabled={blockStatus.theyBlockedMe}
                className="flex-1 min-w-0 bg-vk-bg border border-vk-border rounded-full px-3 py-2 text-xs text-vk-white focus:outline-none focus:border-vk-primary font-body disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!chatMessage.trim() || blockStatus.theyBlockedMe}
                className="shrink-0 px-3 sm:px-4 bg-vk-primary hover:bg-vk-primaryHover disabled:bg-[#394064] disabled:text-white text-white text-xs font-display font-bold rounded-full shadow-[0_6px_16px_rgba(239,62,86,0.3)] transition duration-150"
              >
                Send
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Manual Voice Picker Panel */}
      <VoiceSettingsModal open={showVoiceSettings} onClose={() => setShowVoiceSettings(false)} />

      {/* MESSAGE REQUESTS INBOX PANEL */}
      {showRequestsPanel && (
        <div className="fixed inset-0 bg-[#FFFFFF]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-vk-surface border border-[#2A3155] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-vk-border flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-vk-white">Message Requests</h3>
              <button
                onClick={() => setShowRequestsPanel(false)}
                className="text-vk-text-muted hover:text-vk-white text-sm font-bold bg-vk-elevated w-7 h-7 rounded-full flex items-center justify-center border border-[#2A3155]"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {incomingPendingRequests.length === 0 && incomingRejectedRequests.length === 0 ? (
                <p className="text-center text-sm text-vk-text-muted font-body py-8">No pending or reversible message requests.</p>
              ) : (
                <>
                {incomingPendingRequests.map((req) => (
                  <div key={req._id} className="bg-vk-bg border border-vk-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {req.senderPhotoUrl ? (
                        <img src={getDirectDriveUrl(req.senderPhotoUrl)} alt={req.senderName} className="w-10 h-10 rounded-full object-cover border-2 border-[#1B1740]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-vk-elevated border border-[#2A3155] flex items-center justify-center text-[#7F87A8] font-bold text-xs font-body">?</div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-display text-sm font-bold text-vk-white">{req.senderName}</h4>
                        <p className="text-[10px] text-[#6C3CFF] font-bold font-body">{req.matchPercentage != null ? `${req.matchPercentage}% Match` : 'Match'}</p>
                      </div>
                      <span className="text-[9px] text-[#7F87A8] font-body">
                        {req.requestCreatedAt ? new Date(req.requestCreatedAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#EEF0FF] bg-vk-surface p-3 rounded-xl border border-[#2A3155] font-body italic">
                      &ldquo;{req.firstMessage}&rdquo;
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleRejectRequest(req)}
                        disabled={requestLoading}
                        className="px-4 py-1.5 bg-vk-surface hover:bg-[#3A1722] text-[#FF7B8A] border border-[#6A2A3A] font-display font-bold text-xs rounded-full transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        disabled={requestLoading}
                        className="px-4 py-1.5 bg-[#22C55E] hover:bg-[#22C55E] text-white font-display font-bold text-xs rounded-full transition disabled:opacity-50"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}

                {incomingRejectedRequests.map((req) => (
                  <div key={`rejected-${req._id}`} className="bg-vk-bg border border-[#6A2A3A] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {req.senderPhotoUrl ? (
                        <img src={getDirectDriveUrl(req.senderPhotoUrl)} alt={req.senderName} className="w-10 h-10 rounded-full object-cover border-2 border-[#1B1740]" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-vk-elevated border border-[#2A3155] flex items-center justify-center text-[#7F87A8] font-bold text-xs font-body">?</div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-display text-sm font-bold text-vk-white">{req.senderName}</h4>
                        <p className="text-[10px] text-[#FF7B8A] font-bold font-body">Message request rejected</p>
                      </div>
                    </div>
                    <p className="text-xs text-vk-text-muted bg-vk-surface p-3 rounded-xl border border-vk-border font-body">
                      You previously rejected this request. You can revoke that rejection if you want to allow a new request.
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRevokeRejection(req)}
                        disabled={requestLoading}
                        className="px-4 py-1.5 bg-vk-primary hover:bg-vk-primaryHover text-white font-display font-bold text-xs rounded-full transition disabled:opacity-50"
                      >
                        Revoke Rejection
                      </button>
                    </div>
                  </div>
                ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SEND MESSAGE REQUEST MODAL */}
      {showSendRequestModal && requestTargetMatch && (
        <div className="fixed inset-0 bg-[#FFFFFF]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-vk-surface border border-[#2A3155] rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150">
            <h3 className="font-display text-xl font-bold text-vk-white border-b border-vk-border pb-2 mb-4">
              Send Message Request
            </h3>
            <div className="flex items-center gap-3 mb-4">
              {requestTargetMatch.photoUrl ? (
                <img src={getDirectDriveUrl(requestTargetMatch.photoUrl)} alt={requestTargetMatch.name} className="w-10 h-10 rounded-full object-cover border-2 border-[#1B1740]" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-vk-elevated border border-[#2A3155] flex items-center justify-center text-[#7F87A8] font-bold text-xs font-body">?</div>
              )}
              <div>
                <p className="font-display text-sm font-bold text-vk-white">{requestTargetMatch.name}</p>
                <p className="text-[10px] text-[#6C3CFF] font-bold font-body">{requestTargetMatch.score}% Match</p>
              </div>
            </div>
            <p className="text-xs text-vk-text-muted font-body mb-3">
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
                className="w-full bg-vk-bg border border-vk-border rounded-xl px-4 py-2 text-sm text-vk-white resize-none focus:outline-none focus:border-vk-primary font-body"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowSendRequestModal(false); setRequestMessageText(''); }}
                  className="px-4 py-2 bg-vk-elevated hover:bg-[#20264A] text-vk-white rounded-full font-bold transition font-display border border-[#2A3155] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestLoading || !requestMessageText.trim()}
                  className="px-5 py-2 bg-vk-primary hover:bg-vk-primaryHover text-white font-bold rounded-full transition shadow-vk-glow-purple font-display text-xs disabled:opacity-50"
                >
                  {requestLoading ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block User Confirmation Dialog */}
      {showBlockConfirm && activeChatMatch && (
        <div className="fixed inset-0 bg-[#FFFFFF]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-md bg-vk-surface border border-[#2A3155] rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150">
            <h3 className="font-display text-xl font-bold text-vk-white border-b border-vk-border pb-2 mb-4">
              Block User
            </h3>
            <p className="text-xs text-vk-text-muted font-body mb-5">
              Are you sure you want to block {activeChatMatch.name || 'this user'}? They will no longer be able to send you messages until you unblock them.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBlockConfirm(false)}
                className="px-4 py-2 bg-vk-elevated hover:bg-[#20264A] text-vk-white rounded-full font-bold transition font-display border border-[#2A3155] text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlockUser}
                disabled={blockActionLoading}
                className="px-5 py-2 bg-vk-primary hover:bg-vk-primaryHover text-white font-bold rounded-full transition shadow-vk-glow-purple font-display text-xs disabled:opacity-50"
              >
                {blockActionLoading ? 'Blocking…' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}