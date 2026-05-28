'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useGetMessagesQuery, useReplyMessageMutation } from '@/services/emailApi';
import type { EmailMessage, EmailAttachment } from '@/services/emailApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type ComposeTab = 'Reply' | 'Reply All' | 'Forward';

const AVATAR_COLORS = [
  'from-sky-400 to-blue-500',
  'from-violet-400 to-purple-600',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-600',
  'from-indigo-400 to-violet-500',
];
function avatarColor(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function extractName(email: string) {
  const local = email.split('@')[0];
  return local.split(/[._+]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function splitQuotedContent(text: string): { main: string; quoted: string | null } {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Gmail "On [date], [name] wrote:" — may wrap across a few lines
    if (/^On .+/i.test(line)) {
      const chunk = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
      if (/wrote:\s*$/i.test(chunk)) {
        const main = lines.slice(0, i).join('\n').trim();
        return { main: main || text.trim(), quoted: lines.slice(i).join('\n').trim() };
      }
    }
    // Lines starting with > (quoted text)
    if (/^>/.test(line)) {
      const main = lines.slice(0, i).join('\n').trim();
      return { main: main || text.trim(), quoted: lines.slice(i).join('\n').trim() };
    }
    // Outlook-style dividers or *From:* / From:
    if (/^[-_]{10,}/.test(line) || /^\*From:\*/i.test(line) || /^From:\s/i.test(line)) {
      const main = lines.slice(0, i).join('\n').trim();
      return { main: main || text.trim(), quoted: lines.slice(i).join('\n').trim() };
    }
  }
  return { main: text.trim(), quoted: null };
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
      // Backend returns a presigned S3 URL — open it directly so the browser
      // downloads from S3 without forwarding the Authorization header.
      const { url } = await res.json();
      const a = Object.assign(document.createElement('a'), { href: url, download: att.filename, target: '_blank', rel: 'noreferrer' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setLoading(false);
    }
  };

  const isImage = att.content_type.startsWith('image/');
  const isPdf   = att.content_type === 'application/pdf';
  const isWord  = att.content_type.includes('word') || att.filename.match(/\.docx?$/i);
  const isExcel = att.content_type.includes('sheet') || att.content_type.includes('excel') || att.filename.match(/\.xlsx?$/i);

  const iconBg  = isImage ? 'bg-emerald-50' : isPdf ? 'bg-red-50' : isWord ? 'bg-blue-50' : isExcel ? 'bg-green-50' : 'bg-gray-100';
  const iconClr = isImage ? 'text-emerald-500' : isPdf ? 'text-red-500' : isWord ? 'text-blue-500' : isExcel ? 'text-green-600' : 'text-gray-400';

  const FileIcon = () => {
    if (loading) return <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>;
    if (isImage) return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    );
    if (isPdf) return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
      </svg>
    );
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    );
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 group min-w-[200px] max-w-[260px]"
    >
      {/* File type icon */}
      <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconClr} flex items-center justify-center shrink-0`}>
        <FileIcon />
      </div>

      {/* Name + size */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[12.5px] font-semibold text-gray-800 truncate leading-tight">{att.filename}</p>
        {att.size_bytes ? <p className="text-[11px] text-gray-400 mt-0.5">{formatBytes(att.size_bytes)}</p> : null}
      </div>

      {/* Download arrow */}
      <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
    </button>
  );
}

function MessageCard({ msg, token, defaultOpen }: { msg: EmailMessage; token: string | null; defaultOpen: boolean }) {
  const isInbound = msg.direction === 'inbound';
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const [showQuoted, setShowQuoted] = useState(false);

  const senderName = isInbound ? extractName(msg.from_email) : 'Nexus Support';
  const senderEmail = isInbound ? msg.from_email : '';
  const initials = isInbound ? msg.from_email.charAt(0).toUpperCase() : 'B';
  const gradientClass = isInbound
    ? avatarColor(msg.from_email)
    : 'from-indigo-500 to-violet-600';

  const formattedTime = new Date(msg.sent_at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header — always visible, click to collapse */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/70 transition-colors select-none"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-gray-900">{senderName}</span>
            {senderEmail && (
              <span className="text-[11px] text-gray-400 truncate">&lt;{senderEmail}&gt;</span>
            )}
            {!isInbound && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 leading-none">replied</span>
            )}
          </div>
          {collapsed && (msg.body_text || msg.body_html) && (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">
              {msg.body_text
                ? splitQuotedContent(msg.body_text).main.slice(0, 80)
                : (msg.body_html ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 80)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-400">{formattedTime}</span>
          <svg
            className={`w-3.5 h-3.5 text-gray-300 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-gray-50">
              {/* To / CC rows */}
              {(msg.to_email || msg.cc_emails) && (
                <div className="pt-3 pb-2 space-y-1">
                  {msg.to_email && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-400 w-5 shrink-0">To</span>
                      <span>{msg.to_email}</span>
                    </div>
                  )}
                  {msg.cc_emails && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-400 w-5 shrink-0">CC</span>
                      <span>{msg.cc_emails}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments — shown above body */}
              {msg.attachments.length > 0 && (
                <div className="pt-3 pb-3 border-b border-gray-50 flex flex-wrap gap-2">
                  {msg.attachments.map(att => (
                    <AttachmentChip key={att.id} att={att} token={token} />
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="pt-3 text-[13px] text-gray-700 leading-relaxed">
                {msg.body_text ? (() => {
                  const { main, quoted } = splitQuotedContent(msg.body_text);
                  return (
                    <>
                      <pre className="whitespace-pre-wrap font-sans">{main}</pre>
                      {quoted && (
                        <div className="mt-2">
                          <button
                            onClick={() => setShowQuoted(v => !v)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-indigo-500 transition-colors px-2 py-1 rounded hover:bg-indigo-50/50"
                          >
                            <span className="text-base leading-none tracking-tighter">···</span>
                            <span className="ml-1">{showQuoted ? 'Hide quoted text' : 'Show quoted text'}</span>
                          </button>
                          {showQuoted && (
                            <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] text-gray-400 border-l-2 border-gray-200 pl-3">
                              {quoted}
                            </pre>
                          )}
                        </div>
                      )}
                    </>
                  );
                })() : msg.body_html ? (
                  <div
                    className="prose prose-sm max-w-none text-gray-700 [&_*]:max-w-full [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: msg.body_html }}
                  />
                ) : <span className="text-[12px] italic text-gray-400">(No text content)</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  bookingId: string;
  senderEmail: string;
  replyRef?: React.RefObject<HTMLTextAreaElement | null>;
  composeTab?: ComposeTab;
  onComposeTabChange?: (tab: ComposeTab) => void;
  readOnly?: boolean;
}

export default function EmailThread({ bookingId, senderEmail, replyRef, composeTab: controlledTab, onComposeTabChange, readOnly = false }: Props) {
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const { data: messages = [], isLoading } = useGetMessagesQuery(bookingId, { pollingInterval: 20000 });
  const [replyMessage, { isLoading: sending }] = useReplyMessageMutation();

  const [internalTab, setInternalTab] = useState<ComposeTab>('Reply');
  const composeTab = controlledTab ?? internalTab;
  const setComposeTab = (t: ComposeTab) => { setInternalTab(t); onComposeTabChange?.(t); };
  const [replyText, setReplyText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sent, setSent] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [forwardTo, setForwardTo] = useState('');

  const replyOnlyEmails = (() => {
    const firstInbound = messages.find(m => m.direction === 'inbound');
    return [firstInbound ? firstInbound.from_email : senderEmail];
  })();

  const replyAllEmails = (() => {
    const firstInbound = messages.find(m => m.direction === 'inbound');
    if (!firstInbound) return [senderEmail];
    const all = new Set<string>();
    all.add(firstInbound.from_email);
    firstInbound.to_email?.split(',').map(e => e.trim()).filter(Boolean).forEach(e => all.add(e));
    firstInbound.cc_emails?.split(',').map(e => e.trim()).filter(Boolean).forEach(e => all.add(e));
    return [...all];
  })();

  const currentRecipients = composeTab === 'Reply All' ? replyAllEmails : replyOnlyEmails;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (idx: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!replyText.trim() && selectedFiles.length === 0) return;
    if (composeTab === 'Forward' && !forwardTo.trim()) return;
    const fd = new FormData();
    fd.append('body_text', replyText.trim() || ' ');
    selectedFiles.forEach(f => fd.append('files', f));
    if (composeTab === 'Reply') {
      fd.append('to_emails', replyOnlyEmails.join(', '));
    } else if (composeTab === 'Reply All') {
      fd.append('to_emails', replyAllEmails.join(', '));
    } else {
      fd.append('to_emails', forwardTo.trim());
    }
    await replyMessage({ bookingId, formData: fd });
    setReplyText('');
    setSelectedFiles([]);
    if (composeTab === 'Forward') setForwardTo('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  const composeTabs: { id: ComposeTab; icon: React.ReactNode; label: string }[] = [
    {
      id: 'Reply',
      label: 'Reply',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
    },
    {
      id: 'Reply All',
      label: 'Reply All',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6M8 10h5" />
        </svg>
      ),
    },
    {
      id: 'Forward',
      label: 'Forward',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
        </svg>
      ),
    },
  ];

  const composePlaceholder = composeTab === 'Forward' ? 'Write your forwarded message…' : 'Write your reply…';

  return (
    <div className="space-y-3">
      {/* Message cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                  <div className="h-2.5 w-48 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-gray-200 rounded-xl">
          <div className="text-3xl mb-2">✉️</div>
          <p className="text-sm font-semibold text-gray-400">No messages yet</p>
          <p className="text-xs text-gray-300 mt-1">The original email will appear here once polling picks it up</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              token={accessToken}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      {/* Closed notice — replaces compose when booking is completed */}
      {readOnly && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-2">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-[12px] text-gray-500 font-medium">
            This ticket is closed. Reopen it to send replies.
          </p>
        </div>
      )}

      {/* Compose area */}
      {!readOnly && <div className="border border-gray-200 rounded-xl overflow-hidden mt-2 bg-white shadow-sm">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-gray-50/60">
          {composeTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setComposeTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                composeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 bg-white'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-white/60'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {/* To: row */}
          <div className="flex items-center gap-1.5 flex-wrap border-b border-gray-50 pb-2">
            <span className="text-[11px] font-semibold text-gray-400 shrink-0">To:</span>
            {composeTab === 'Forward' ? (
              <input
                type="text"
                value={forwardTo}
                onChange={e => setForwardTo(e.target.value)}
                placeholder="recipient@example.com, another@example.com"
                className="flex-1 min-w-0 text-[12px] text-gray-700 bg-transparent focus:outline-none placeholder:text-gray-300"
              />
            ) : (
              <>
                {(showAllRecipients ? currentRecipients : currentRecipients.slice(0, 3)).map((email, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-medium">
                    <svg className="w-2.5 h-2.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {email}
                  </span>
                ))}
                {currentRecipients.length > 3 && (
                  <button
                    onClick={() => setShowAllRecipients(v => !v)}
                    className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 px-2 py-0.5 rounded-full hover:bg-indigo-50 transition-colors"
                  >
                    {showAllRecipients ? '▲ less' : `+${currentRecipients.length - 3} more`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Textarea — transparent, no border */}
          <textarea
            ref={replyRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={composePlaceholder}
            rows={4}
            className="w-full px-0 py-1 text-sm text-gray-700 bg-transparent focus:outline-none resize-none placeholder:text-gray-300 leading-relaxed"
          />

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-gray-600 font-medium">
                  <span className="text-base leading-none">📎</span>
                  <span className="truncate max-w-[160px]">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-gray-600 transition-colors leading-none ml-0.5 text-sm">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-all cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attach
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

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
              disabled={
                (composeTab === 'Forward' ? !forwardTo.trim() : (!replyText.trim() && selectedFiles.length === 0)) ||
                sending
              }
              className="flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50 transition-all text-white bg-indigo-600 hover:bg-indigo-700"
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
                  {composeTab === 'Forward' ? 'Forward' : 'Send'}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>}

    </div>
  );
}
