'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, Sparkles, Trash2, X, ChevronDown } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addMessage, clearMessages, setLoading, toggleChat } from '@/store/slices/aiChatSlice';

const GREETING =
  "Hi! I'm your BTS Assistant. I can look up bookings, check agent workloads, fetch dashboard stats, and help you navigate the system. What do you need?";

const SUGGESTIONS = [
  "What's today's booking summary?",
  'Show me pending bookings',
  'How many agents are active?',
  'Show urgent bookings',
];

export default function AIChatBot() {
  const dispatch = useAppDispatch();
  const { isOpen, messages, isLoading } = useAppSelector((s) => s.aiChat);
  const { accessToken, user } = useAppSelector((s) => s.auth);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show greeting when chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      dispatch(addMessage({ role: 'assistant', content: GREETING }));
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, dispatch, messages.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    dispatch(addMessage({ role: 'user', content: trimmed }));
    dispatch(setLoading(true));

    // Build message history for the API (skip the static greeting)
    const history = messages
      .filter((m) => !(m.role === 'assistant' && m.content === GREETING))
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    history.push({ role: 'user', content: trimmed });

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          accessToken,
          userContext: user ? { name: user.name, role: user.role } : undefined,
        }),
      });

      const data = await res.json();
      dispatch(
        addMessage({
          role: 'assistant',
          content: data.content ?? data.error ?? 'Something went wrong. Please try again.',
        })
      );
    } catch {
      dispatch(addMessage({ role: 'assistant', content: 'Network error. Please check your connection and try again.' }));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClear = () => {
    dispatch(clearMessages());
  };

  const showSuggestions = messages.length <= 1 && !isLoading;

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={() => dispatch(toggleChat())}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors duration-200 ${
          isOpen ? 'bg-gray-700 hover:bg-gray-800' : 'bg-indigo-600 hover:bg-indigo-700'
        } text-white`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={22} />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Bot size={22} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed bottom-24 right-6 z-50 w-[370px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 120px)', height: 520 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-none">BTS Assistant</p>
                  <p className="text-indigo-200 text-xs mt-0.5">Powered by Claude AI</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClear}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => dispatch(toggleChat())}
                  title="Close"
                  className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mb-0.5">
                      <Bot size={14} className="text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-indigo-600" />
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick suggestion chips */}
              {showSuggestions && (
                <div className="pt-1">
                  <p className="text-xs text-gray-400 mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-100"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-indigo-400 transition-colors">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about bookings, agents…"
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-300 transition-colors shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
