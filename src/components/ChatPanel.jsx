'use client';

import { useState, useEffect } from 'react';

export default function ChatPanel({ currentUserId, partnerCandidate }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [hasNewArrival, setHasNewArrival] = useState(false);

  // Fetch messages and check for updates
  const fetchMessages = async () => {
    if (!currentUserId || !partnerCandidate?._id) return;

    try {
      const res = await fetch(`/api/messages?userId=${currentUserId}&partnerId=${partnerCandidate._id}`);
      const data = await res.json();
      
      if (data.success) {
        if (data.messages.length > messages.length && messages.length > 0) {
          setHasNewArrival(true);
        }
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    }
  };

  // Poll for new messages every 4 seconds
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [currentUserId, partnerCandidate?._id]);

  // Handle message sending
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const payload = {
      senderId: currentUserId,
      receiverId: partnerCandidate._id,
      text: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Handle message deletion from user panel
  const handleDelete = async (messageId) => {
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, userId: currentUserId })
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col h-[500px]">
      
      {/* Header with New Arrival Indicator */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            Chat with {partnerCandidate?.name || 'Candidate'}
          </h3>
          {hasNewArrival && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-bounce">
              🔴 New Message
            </span>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div 
        className="flex-1 p-4 overflow-y-auto space-y-3"
        onScroll={() => setHasNewArrival(false)}
      >
        {messages.map((msg) => {
          const isSender = msg.senderId === currentUserId;
          return (
            <div
              key={msg._id}
              className={`group relative flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed relative ${
                  isSender
                    ? 'bg-rose-500 text-white rounded-br-none'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                }`}
              >
                {msg.text}

                {/* Delete Button on Hover */}
                <button
                  onClick={() => handleDelete(msg._id)}
                  title="Delete message"
                  className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1 text-[9px] hover:bg-rose-600 transition-opacity"
                >
                  ✕
                </button>
              </div>

              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}