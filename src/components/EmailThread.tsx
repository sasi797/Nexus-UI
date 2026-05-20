'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useGetMessagesQuery, useReplyMessageMutation } from '@/services/emailApi';
import type { EmailMessage, EmailAttachment } from '@/services/emailApi';
import { staggerContainer, popIn } from '@/lib/animations';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ att, token }: { att: EmailAttachment; token: string | null }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/email-attachments/${att.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: att.filename });
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  const isImage = att.content_type.startsWith('image/');
  const isPdf = att.content_type === 'application/pdf';

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-all disabled:opacity-60 group"
    >
      <span className="text-base leading-none">
        {loading ? '⏳' : isImage ? '🖼️' : isPdf ? '📄' : '📎'}
      </span>
      <span className="truncate max-w-[140px]">{att.filename}</span>
      {att.size_bytes ? <span className="text-gray-400 text-[10px]">{formatBytes(att.size_bytes)}</span> : null}
      <svg className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </button>
  );
}

function MessageBubble({ msg, token }: { msg: EmailMessage; token: string | null }) {
  const isInbound = msg.direction === 'inbound';
  const [expanded, setExpanded] = useState(true);

  return (
    <motion.div
      variants={popIn}
      initial="hidden"
      animate="visible"
      className={`flex gap-3 ${isInbound ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
        isInbound
          ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white'
          : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
      }`}>
        {isInbound
          ? msg.from_email.charAt(0).toUpperCase()
          : 'BTS'}
      </div>

      <div className={`flex-1 max-w-[85%] ${isInbound ? '' : 'items-end flex flex-col'}`}>
        {/* Header */}
        <div className={`flex items-start gap-2 mb-1 ${isInbound ? '' : 'flex-row-reverse'}`}>
          <div className={`flex flex-col gap-0.5 ${isInbound ? '' : 'items-end'}`}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-700">
                {isInbound ? msg.from_email : 'BTS Support'}
              </span>
              <span className="text-[10px] text-gray-400">
                {new Date(msg.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
              >
                {expanded ? '▲' : '▼'}
              </button>
            </div>
            {/* To / CC row for inbound messages */}
            {isInbound && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {msg.to_email && (
                  <span className="text-[10px] text-gray-400">
                    <span className="font-semibold text-gray-500">To:</span> {msg.to_email}
                  </span>
                )}
                {msg.cc_emails && (
                  <span className="text-[10px] text-gray-400">
                    <span className="font-semibold text-gray-500">CC:</span> {msg.cc_emails}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bubble */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed border shadow-sm ${
                isInbound
                  ? 'bg-white border-gray-100 text-gray-700 rounded-tl-sm'
                  : 'bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-500/30 text-white rounded-tr-sm'
              }`}
            >
              {msg.body_text
                ? <pre className="whitespace-pre-wrap font-sans text-[13px]">{msg.body_text.trim()}</pre>
                : <span className={`text-[12px] italic ${isInbound ? 'text-gray-400' : 'text-white/60'}`}>(No text content)</span>
              }

              {/* Attachments */}
              {msg.attachments.length > 0 && (
                <div className={`mt-3 pt-3 border-t ${isInbound ? 'border-gray-100' : 'border-white/20'} flex flex-wrap gap-2`}>
                  {msg.attachments.map(att => (
                    <AttachmentChip key={att.id} att={att} token={token} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface Props {
  bookingId: string;
  senderEmail: string;
}

export default function EmailThread({ bookingId, senderEmail }: Props) {
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const { data: messages = [], isLoading } = useGetMessagesQuery(bookingId);
  const [replyMessage, { isLoading: sending }] = useReplyMessageMutation();

  const [replyText, setReplyText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sent, setSent] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build reply-all recipient list from the first inbound message
  const replyToEmails = (() => {
    const firstInbound = messages.find(m => m.direction === 'inbound');
    if (!firstInbound) return [senderEmail];
    const all = new Set<string>();
    all.add(firstInbound.from_email);
    firstInbound.to_email?.split(',').map(e => e.trim()).filter(Boolean).forEach(e => all.add(e));
    firstInbound.cc_emails?.split(',').map(e => e.trim()).filter(Boolean).forEach(e => all.add(e));
    return [...all];
  })();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!replyText.trim()) return;
    const fd = new FormData();
    fd.append('body_text', replyText.trim());
    selectedFiles.forEach(f => fd.append('files', f));
    await replyMessage({ bookingId, formData: fd });
    setReplyText('');
    setSelectedFiles([]);
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2].map(i => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Thread header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Email Thread · {messages.length} message{messages.length !== 1 ? 's' : ''}
        </p>
        <span className="text-[11px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
          {senderEmail}
        </span>
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-3xl mb-2">✉️</div>
          <p className="text-sm font-semibold text-gray-400">No messages yet</p>
          <p className="text-xs text-gray-300 mt-1">The original email will appear here once polling picks it up</p>
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} token={accessToken} />
          ))}
        </motion.div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Reply composer */}
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Reply</p>
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500 mt-0.5 shrink-0">To:</span>
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {(showAllRecipients ? replyToEmails : replyToEmails.slice(0, 2)).map((email, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-medium">
                  <svg className="w-2.5 h-2.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {email}
                </span>
              ))}
              {replyToEmails.length > 2 && (
                <button
                  onClick={() => setShowAllRecipients(v => !v)}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 px-2 py-0.5 rounded-full hover:bg-indigo-50 transition-colors"
                >
                  {showAllRecipients ? '▲ less' : `+${replyToEmails.length - 2} more`}
                </button>
              )}
            </div>
          </div>
        </div>

        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Type your reply…"
          rows={4}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none transition-all placeholder:text-gray-300"
        />

        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 font-medium">
                <span>📎</span>
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-indigo-400 hover:text-indigo-600 transition-colors leading-none">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Attach files */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Attach
          </button>

          <div className="flex-1" />

          <AnimatePresence>
            {sent && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-emerald-600"
              >
                ✓ Sent
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSend}
            disabled={(!replyText.trim() && selectedFiles.length === 0) || sending}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg shadow-sm disabled:opacity-50 transition-all"
          >
            {sending ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Sending…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Reply
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
