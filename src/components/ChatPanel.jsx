"use client";

import { useState, useEffect, useRef } from "react";

export default function ChatPanel({
  currentUserId,
  selectedCandidate,
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] =
    useState("");
  const [loading, setLoading] =
    useState(false);

  const messagesEndRef = useRef(null);

  const candidateId =
    selectedCandidate?.userId ||
    selectedCandidate?.id ||
    selectedCandidate?._id;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  useEffect(() => {
    console.log(
      "currentUserId:",
      currentUserId
    );

    console.log(
      "candidateId:",
      candidateId
    );

    console.log(
      "selectedCandidate:",
      selectedCandidate
    );
  }, [
    currentUserId,
    candidateId,
    selectedCandidate,
  ]);

  useEffect(() => {
    if (!currentUserId || !candidateId)
      return;

    const fetchMessages = async () => {
      try {
        const url = `/api/messages?senderId=${currentUserId}&receiverId=${candidateId}`;

        console.log(url);

        const response = await fetch(url);

        const data =
          await response.json();

        console.log(
          "GET Response:",
          data
        );

        if (
          data.success &&
          Array.isArray(data.messages)
        ) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error(
          "Failed to fetch messages:",
          error
        );
      }
    };

    setLoading(true);

    fetchMessages().finally(() =>
      setLoading(false)
    );

    const interval =
      setInterval(fetchMessages, 3000);

    return () =>
      clearInterval(interval);
  }, [currentUserId, candidateId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (
    e
  ) => {
    e.preventDefault();

    const trimmedText =
      inputMessage.trim();

    if (
      !trimmedText ||
      !currentUserId ||
      !candidateId
    ) {
      return;
    }

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: String(
        currentUserId
      ),
      receiverId: String(
        candidateId
      ),
      text: trimmedText,
      createdAt:
        new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [
      ...prev,
      optimisticMessage,
    ]);

    setInputMessage("");

    try {
      console.log({
        senderId:
          currentUserId,
        receiverId:
          candidateId,
        text: trimmedText,
      });

      const response = await fetch(
        "/api/messages",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            senderId: String(
              currentUserId
            ),
            receiverId: String(
              candidateId
            ),
            text: trimmedText,
          }),
        }
      );

      const data =
        await response.json();

      console.log(
        "POST Response:",
        data
      );

      if (
        data.success &&
        data.message
      ) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempId
              ? data.message
              : msg
          )
        );
      }
    } catch (error) {
      console.error(
        "Failed to send message:",
        error
      );
    }
  };

  if (!selectedCandidate) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-full max-w-md fixed right-0 top-0 bottom-0 z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-rose-500 to-pink-600 text-white">
        <div>
          <h3 className="font-semibold">
            {selectedCandidate.name}
          </h3>

          <p className="text-xs">
            {selectedCandidate.profession ||
              "Match Profile"}
          </p>
        </div>

        {onClose && (
          <button onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading &&
        messages.length === 0 ? (
          <p>
            Loading conversation...
          </p>
        ) : messages.length === 0 ? (
          <p>
            No messages yet.
          </p>
        ) : (
          messages.map((msg) => {
            const isMe =
              String(
                msg.senderId
              ) ===
              String(
                currentUserId
              );

            return (
              <div
                key={msg._id}
                className={`flex flex-col ${
                  isMe
                    ? "items-end"
                    : "items-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMe
                      ? "bg-rose-500 text-white"
                      : "bg-white text-black"
                  }`}
                >
                  {msg.text}
                </div>

                <span className="text-xs text-gray-500">
                  {new Date(
                    msg.createdAt
                  ).toLocaleTimeString(
                    [],
                    {
                      hour:
                        "2-digit",
                      minute:
                        "2-digit",
                    }
                  )}
                </span>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={
          handleSendMessage
        }
        className="p-3 border-t flex gap-2"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) =>
            setInputMessage(
              e.target.value
            )
          }
          placeholder="Type a message..."
          className="flex-1 border rounded-full px-4 py-2"
        />

        <button
          type="submit"
          disabled={
            !inputMessage.trim()
          }
          className="bg-rose-500 text-white px-4 py-2 rounded-full"
        >
          Send
        </button>
      </form>
    </div>
  );
}