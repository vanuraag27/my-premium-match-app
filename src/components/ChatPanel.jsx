'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatPanel({ currentUserId, selectedCandidate, audioNotificationsEnabled = true, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingHeartbeatRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const inputMessageRef = useRef('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const audioRef = useRef(null);

  const candidateId =
    selectedCandidate?.email ||
    selectedCandidate?.userId ||
    selectedCandidate?.id ||
    selectedCandidate?._id;

  // Initialize Audio
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification.mp3');
      audioRef.current.load();
    }
  }, []);

  const playNotificationSound = () => {
    if (!audioNotificationsEnabled) return; // Respect audio notification setting
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn('Audio play blocked by browser interaction policy:', err);
      });
    }
  };

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const updateNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= 120;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessage(false);
    return nearBottom;
  };

  const typingLastInputAtRef = useRef(0);

  const updateTypingState = async (typing) => {
    if (!currentUserId || !candidateId) return;
    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
        keepalive: !typing,
        body: JSON.stringify({
          userId: String(currentUserId),
          otherUserId: String(candidateId),
          isTyping: Boolean(typing),
        }),
      });
    } catch (err) {
      console.warn('Typing state update failed:', err);
    }
  };

  const stopTyping = () => {
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    typingLastInputAtRef.current = 0;
    updateTypingState(false);
  };

  const startTyping = () => {
    if (!currentUserId || !candidateId || !inputMessageRef.current.trim()) {
      stopTyping();
      return;
    }

    typingLastInputAtRef.current = Date.now();
    updateTypingState(true);

    if (!typingHeartbeatRef.current) {
      typingHeartbeatRef.current = setInterval(() => {
        const hasText = Boolean(inputMessageRef.current.trim());
        const recentInput = Date.now() - typingLastInputAtRef.current < 2500;

        if (hasText && recentInput) {
          updateTypingState(true);
        } else {
          stopTyping();
        }
      }, 1000);
    }

    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      if (Date.now() - typingLastInputAtRef.current >= 2500) stopTyping();
    }, 2600);
  };

  const fetchTypingState = async () => {
    if (!currentUserId || !candidateId) return;
    try {
      const url = `/api/typing?userId=${encodeURIComponent(String(currentUserId))}&otherUserId=${encodeURIComponent(String(candidateId))}&t=${Date.now()}`;
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      if (!res.ok) {
        setIsOtherUserTyping(false);
        return;
      }
      const data = await res.json();
      setIsOtherUserTyping(Boolean(data?.success && data?.isTyping));
    } catch (err) {
      console.warn('Failed to load typing state:', err);
      setIsOtherUserTyping(false);
    }
  };

  const fetchMessages = async () => {
    if (!currentUserId || !candidateId) return;

    try {
      const res = await fetch(
        `/api/messages?senderId=${encodeURIComponent(currentUserId)}&receiverId=${encodeURIComponent(candidateId)}`
      );
      const data = await res.json();

      if (data.success && Array.isArray(data.messages)) {
        const latestMessage = data.messages[data.messages.length - 1];

        if (latestMessage) {
          const isIncomingNewMessage =
            !isFirstLoadRef.current &&
            lastMessageIdRef.current &&
            latestMessage._id !== lastMessageIdRef.current &&
            String(latestMessage.senderId) !== String(currentUserId);

          if (isIncomingNewMessage) {
            if (isNearBottomRef.current) {
              setShowNewMessage(false);
              playNotificationSound();
            } else {
              setShowNewMessage(true);
              playNotificationSound();
            }
          }

          lastMessageIdRef.current = latestMessage._id;
        }

        setMessages(data.messages);

        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
          requestAnimationFrame(() => scrollToBottom('auto'));
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  useEffect(() => {
    if (!currentUserId || !candidateId) return;

    isFirstLoadRef.current = true;
    lastMessageIdRef.current = null;
    setLoading(true);

    fetchMessages().finally(() => setLoading(false));
    fetchTypingState();

    const interval = setInterval(fetchMessages, 3000);
    const typingInterval = setInterval(fetchTypingState, 700);
    return () => {
      clearInterval(interval);
      clearInterval(typingInterval);
      stopTyping();
      setIsOtherUserTyping(false);
    };
  }, [currentUserId, candidateId]);

  useEffect(() => {
    if (isFirstLoadRef.current) return;
    if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmedText = inputMessage.trim();

    if (!trimmedText || !currentUserId || !candidateId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      senderId: String(currentUserId),
      receiverId: String(candidateId),
      messageText: trimmedText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputMessage('');
    inputMessageRef.current = '';
    stopTyping();

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          receiverId: candidateId,
          messageText: trimmedText,
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        setMessages((prev) =>
          prev.map((msg) => (msg._id === tempId ? data.message : msg))
        );
        lastMessageIdRef.current = data.message._id;
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  if (!selectedCandidate) return null;

  return (
    <div className="flex flex-col h-full bg-[#11152F] border-l border-[#2A3155] shadow-[0_16px_48px_rgba(0,0,0,.35)] w-full max-w-md fixed right-0 top-0 bottom-0 z-50">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2A3155] bg-gradient-to-r from-[#6C3CFF] via-[#6C3CFF] to-[#00D4FF] text-white z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#11152F]/20 flex items-center justify-center font-bold text-white uppercase">
            {selectedCandidate?.name ? selectedCandidate.name[0] : 'U'}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{selectedCandidate?.name || 'User'}</h3>
            <p className="text-xs text-[#EEF0FF]">{selectedCandidate?.profession || 'Match Profile'}</p>
            <p className={`text-xs min-h-[18px] mt-0.5 font-semibold transition-opacity duration-150 ${isOtherUserTyping ? 'text-white opacity-100' : 'opacity-0'}`} aria-live="polite">
              {selectedCandidate?.name || 'User'} is typing...
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#11152F]/20 text-white transition-colors cursor-pointer text-base flex items-center justify-center"
            title="Close Chat"
          >
            ✕
          </button>
        )}
      </div>

      {/* Auto-Expiration Notice Banner */}
      <div className="bg-[#1B1740] border-b border-[#3D3568] text-[#FF3CAC] text-[11px] py-1.5 px-3 text-center font-medium flex items-center justify-center gap-1">
        <span>⏳</span> Messages automatically expire after 24 hours.
      </div>

      {/* Message History Window */}
      <div
        ref={messagesContainerRef}
        onScroll={updateNearBottom}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#090D24] relative"
      >
        {/* Floating Notification Badge */}
        {showNewMessage && (
          <button
            type="button"
            onClick={() => {
              isNearBottomRef.current = true;
              setShowNewMessage(false);
              scrollToBottom('smooth');
            }}
            className="sticky top-2 z-50 mx-auto block bg-[#6C3CFF] text-white px-4 py-1.5 rounded-full shadow-lg text-xs font-semibold animate-bounce flex items-center gap-1"
            aria-label="Jump to new message"
          >
            <span>🔔</span> New Message ↓
          </button>
        )}

        {loading && messages.length === 0 ? (
          <div className="text-center text-xs text-[#7F87A8] py-8">Loading conversation...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-[#7F87A8] py-8">
            No active messages. Say hello to {selectedCandidate?.name || 'them'}!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = String(msg.senderId) === String(currentUserId);
            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMe
                      ? 'bg-[#1B1740]0 text-white rounded-br-none'
                      : 'bg-[#11152F] text-white border border-[#2A3155] rounded-bl-none'
                  }`}
                >
                  {msg.messageText}
                </div>
                <span className="text-[10px] text-[#7F87A8] mt-1 px-1">
                  {msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#11152F] border-t border-[#2A3155] flex items-center gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            inputMessageRef.current = e.target.value;
            typingLastInputAtRef.current = e.target.value.trim() ? Date.now() : 0;
            if (e.target.value.trim()) startTyping();
            else stopTyping();
          }}
          onFocus={() => {
            if (inputMessageRef.current.trim()) startTyping();
          }}
          onBlur={() => {
            if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
            typingStopTimerRef.current = setTimeout(stopTyping, 1800);
          }}
          placeholder="Type your message..."
          className="flex-1 bg-[#171C3B] text-white rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00D4FF]/30"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="bg-[#1B1740]0 text-white rounded-full px-4 py-2.5 text-sm font-medium hover:bg-[#6C3CFF] disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}