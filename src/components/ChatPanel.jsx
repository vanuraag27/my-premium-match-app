'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatPanel({ currentUserId, selectedCandidate, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const messagesEndRef = useRef(null);
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
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn('Audio play blocked by browser interaction policy:', err);
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          if (
            !isFirstLoadRef.current &&
            lastMessageIdRef.current &&
            latestMessage._id !== lastMessageIdRef.current &&
            String(latestMessage.senderId) !== String(currentUserId)
          ) {
            setShowNewMessage(true);
            playNotificationSound();

            setTimeout(() => {
              setShowNewMessage(false);
            }, 3500);
          }

          lastMessageIdRef.current = latestMessage._id;
        }

        setMessages(data.messages);

        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
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

    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUserId, candidateId]);

  useEffect(() => {
    scrollToBottom();
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
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-full max-w-md fixed right-0 top-0 bottom-0 z-50">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-rose-500 to-pink-600 text-white z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white uppercase">
            {selectedCandidate?.name ? selectedCandidate.name[0] : 'U'}
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{selectedCandidate?.name || 'User'}</h3>
            <p className="text-xs text-rose-100">{selectedCandidate?.profession || 'Match Profile'}</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer text-base flex items-center justify-center"
            title="Close Chat"
          >
            ✕
          </button>
        )}
      </div>

      {/* Auto-Expiration Notice Banner */}
      <div className="bg-rose-50 border-b border-rose-100 text-rose-600 text-[11px] py-1.5 px-3 text-center font-medium flex items-center justify-center gap-1">
        <span>⏳</span> Messages automatically expire after 24 hours.
      </div>

      {/* Message History Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 relative">
        
        {/* Floating Notification Badge */}
        {showNewMessage && (
          <div className="sticky top-2 z-50 mx-auto w-max bg-rose-600 text-white px-4 py-1.5 rounded-full shadow-lg text-xs font-semibold animate-bounce flex items-center gap-1">
            <span>🔔</span> New Message
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">Loading conversation...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">
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
                      ? 'bg-rose-500 text-white rounded-br-none'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}
                >
                  {msg.messageText}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
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
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-gray-100 text-gray-800 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="bg-rose-500 text-white rounded-full px-4 py-2.5 text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}