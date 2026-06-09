'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useGetMessagesQuery, useReplyMessageMutation, useSyncEmailsMutation } from '@/services/emailApi';
import { useGetEmailTemplatesQuery } from '@/services/emailTemplatesApi';
import type { EmailMessage, EmailAttachment } from '@/services/emailApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const MAILBOX_EMAIL = (process.env.NEXT_PUBLIC_MAILBOX_EMAIL ?? '').toLowerCase();

const PREDEFINED_CONTACTS: { name: string; email: string }[] = [
  { name: 'bookingslhr',        email: 'bookingslhr@trilogylogistics.com' },
  { name: 'GLA OPS',            email: 'glaops@trilogylogistics.com' },
  { name: 'Rachel Medina',      email: 'rachel.m@trilogylogistics.com' },
  { name: 'Steve Doohan',       email: 's.doohan@trilogylogistics.com' },
  { name: 'Syrus Sharma',       email: 'syrus.sharma@trilogylogistics.com' },
  { name: 'Shay Braham',        email: 'shay.braham@trilogylogistics.com' },
  { name: 'Joe Berry',          email: 'joe.berry@trilogylogistics.com' },
  { name: 'Farai Gonah',        email: 'farai.gonah@trilogylogistics.com' },
  { name: 'Findlay Fyfe',       email: 'findlay.fyfe@trilogylogistics.com' },
  { name: 'Andrew Whitington',  email: 'andrew.whitington@trilogylogistics.com' },
  { name: 'Arran Finn',         email: 'arran.finn@trilogylogistics.com' },
  { name: 'Georgie Fishpool',   email: 'georgie.fishpool@trilogylogistics.com' },
  { name: 'LHR OPS',            email: 'lhrops@trilogylogistics.com' },
  { name: 'Accounts',           email: 'accounts@trilogylogistics.com' },
  { name: 'Customer Liaison LHR', email: 'customerliaisonlhr@trilogylogistics.com' },
  { name: 'Annamalai AK',       email: 'ak@thelinkworks.com' },
  { name: 'Trilogy User1',      email: 'Trilogy1@linkworks.in' },
];

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

function extractForwardedSender(bodyText: string): string | null {
  if (!bodyText) return null;
  const lines = bodyText.split('\n');
  // Walk the first few lines — if the body starts with Outlook "From: ..." it's a forward
  for (const line of lines.slice(0, 8)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^From:\s/i.test(trimmed)) {
      const angleMatch = trimmed.match(/<([^>@\s]+@[^>@\s]+)>/);
      if (angleMatch) return angleMatch[1].trim();
      const bareMatch = trimmed.match(/From:\s+(\S+@\S+)/i);
      if (bareMatch) return bareMatch[1].replace(/[;,>]$/, '').trim();
    }
    // Stop if we hit content that isn't a forwarded-header line
    if (!/^(From:|Sent:|To:|Subject:|Date:|Cc:)/i.test(trimmed)) break;
  }
  return null;
}

function splitHtmlQuotedContent(html: string): { main: string; quoted: string | null } {
  // Outlook wraps the quoted thread in <div id="divRplyFwdMsg"> or <div id="divRplyFwdMsg_...">
  const outlookIdx = html.search(/<div[^>]+id=["']divRplyFwdMsg/i);
  if (outlookIdx > 30) return { main: html.slice(0, outlookIdx), quoted: html.slice(outlookIdx) };

  // Some clients use <blockquote> for the quoted section
  const bqIdx = html.search(/<blockquote/i);
  if (bqIdx > 30) return { main: html.slice(0, bqIdx), quoted: html.slice(bqIdx) };

  // Outlook <hr> separator before "From: / Sent: / To:" quote header
  const hrIdx = html.search(/<hr[\s/>]/i);
  if (hrIdx > 30 && /(From:|Sent:|Subject:)/i.test(html.slice(hrIdx, hrIdx + 600))) {
    return { main: html.slice(0, hrIdx), quoted: html.slice(hrIdx) };
  }

  return { main: html, quoted: null };
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

type ContactSuggestion = { name: string; email: string };

function SuggestionPortal({
  suggestions,
  anchorRef,
  onSelect,
}: {
  suggestions: ContactSuggestion[];
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (email: string) => void;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (suggestions.length === 0) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        bottom: window.innerHeight - r.top + 2,
        left: r.left,
        width: Math.max(300, r.width),
        zIndex: 9999,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [suggestions, anchorRef]);

  if (suggestions.length === 0) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
      {suggestions.map(c => (
        <button
          key={c.email}
          type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(c.email); }}
          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-center gap-2.5"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-indigo-500 leading-none">
              {c.name ? c.name.charAt(0).toUpperCase() : c.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {c.name && <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{c.name}</p>}
            <p className="text-[11px] text-gray-400 truncate">{c.email}</p>
          </div>
        </button>
      ))}
    </div>,
    document.body
  );
}

function FilePreviewModal({ file, onClose }: { file: File; onClose: () => void }) {
  const isImage = file.type.startsWith('image/');
  const isPdf   = file.type === 'application/pdf';
  const isWord  = file.type.includes('word') || /\.docx?$/i.test(file.name);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!isWord) return;
    setDocxLoading(true);
    setDocxError(null);
    import('mammoth').then(async ({ default: mammoth }) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(result.value);
      } catch {
        setDocxError('Could not render this document.');
      } finally {
        setDocxLoading(false);
      }
    });
  }, [file, isWord]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{file.name}</p>
          <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-auto min-h-0 bg-gray-50">
          {isImage && objectUrl ? (
            <div className="flex items-center justify-center p-4 h-full">
              <img src={objectUrl} alt={file.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : isPdf && objectUrl ? (
            <iframe
              src={objectUrl}
              title={file.name}
              className="w-full min-h-[65vh]"
              style={{ border: 'none' }}
            />
          ) : isWord ? (
            docxLoading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
                <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Rendering document…
              </div>
            ) : docxError ? (
              <div className="flex items-center justify-center py-20 text-sm text-red-400">{docxError}</div>
            ) : (
              <div
                className="prose prose-sm max-w-none p-8 bg-white mx-auto my-4 rounded-xl shadow-sm border border-gray-100 [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1"
                dangerouslySetInnerHTML={{ __html: docxHtml ?? '' }}
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 px-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">Preview not available for this file type</p>
              {objectUrl && (
                <a
                  href={objectUrl}
                  download={file.name}
                  className="mt-2 text-xs font-semibold px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Download
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function SelectedFileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [showPreview, setShowPreview] = useState(false);

  const isImage = file.type.startsWith('image/');
  const isPdf   = file.type === 'application/pdf';
  const isWord  = file.type.includes('word') || /\.docx?$/i.test(file.name);
  const isExcel = file.type.includes('sheet') || file.type.includes('excel') || /\.xlsx?$/i.test(file.name);

  const iconBg  = isImage ? 'bg-emerald-50' : isPdf ? 'bg-red-50' : isWord ? 'bg-blue-50' : isExcel ? 'bg-green-50' : 'bg-gray-100';
  const iconClr = isImage ? 'text-emerald-500' : isPdf ? 'text-red-500' : isWord ? 'text-blue-500' : isExcel ? 'text-green-600' : 'text-gray-400';

  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px] text-left group"
      >
        <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconClr} flex items-center justify-center shrink-0 overflow-hidden`}>
          {isImage && thumbUrl ? (
            <img src={thumbUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : isPdf ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          ) : isWord ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          ) : isExcel ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-gray-800 truncate leading-tight">{file.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="w-5 h-5 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shrink-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </button>

      <AnimatePresence>
        {showPreview && <FilePreviewModal file={file} onClose={() => setShowPreview(false)} />}
      </AnimatePresence>
    </>
  );
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
      className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 group w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px]"
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

  const senderName = isInbound ? extractName(msg.from_email) : 'GCC Support';
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
            <div className="px-3 sm:px-5 pb-4 border-t border-gray-50">
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

              {/* Attachments — shown above body (inline signature images filtered out) */}
              {msg.attachments.filter(a => !/^image\d+\.(png|jpe?g|gif|webp)$/i.test(a.filename)).length > 0 && (
                <div className="pt-3 pb-3 border-b border-gray-50 flex flex-wrap gap-2">
                  {msg.attachments
                    .filter(a => !/^image\d+\.(png|jpe?g|gif|webp)$/i.test(a.filename))
                    .map(att => (
                      <AttachmentChip key={att.id} att={att} token={token} />
                    ))}
                </div>
              )}

              {/* Body */}
              <div className="pt-3 text-[13px] text-gray-700 leading-relaxed">
                {!isInbound && msg.body_html ? (
                  // Outbound with HTML — render formatted reply (user may have used B/I/U)
                  <div
                    className="prose prose-sm max-w-none text-gray-700 [&_*]:max-w-full [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: splitHtmlQuotedContent(msg.body_html).main }}
                  />
                ) : msg.body_text ? (
                  isInbound ? (
                    <pre className="whitespace-pre-wrap font-sans">{msg.body_text}</pre>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">
                      {splitQuotedContent(msg.body_text).main}
                    </pre>
                  )
                ) : msg.body_html ? (
                  isInbound ? (
                    <div
                      className="prose prose-sm max-w-none text-gray-700 [&_*]:max-w-full [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: msg.body_html }}
                    />
                  ) : (
                    <div
                      className="prose prose-sm max-w-none text-gray-700 [&_*]:max-w-full [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: splitHtmlQuotedContent(msg.body_html).main }}
                    />
                  )
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
  replyRef?: React.RefObject<HTMLElement | null>;
  composeTab?: ComposeTab;
  onComposeTabChange?: (tab: ComposeTab) => void;
  readOnly?: boolean;
}

export default function EmailThread({ bookingId, senderEmail, replyRef, composeTab: controlledTab, onComposeTabChange, readOnly = false }: Props) {
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const currentUser  = useSelector((s: RootState) => s.auth.user);
  const { data: messages = [], isLoading } = useGetMessagesQuery(bookingId, { pollingInterval: 20000 });
  const [replyMessage, { isLoading: sending }] = useReplyMessageMutation();
  const [syncEmails, { isLoading: syncing }] = useSyncEmailsMutation();
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [internalTab, setInternalTab] = useState<ComposeTab>('Reply');
  const composeTab = controlledTab ?? internalTab;
  const setComposeTab = (t: ComposeTab) => { setInternalTab(t); onComposeTabChange?.(t); };

  // Rich-text editor (replaces plain textarea)
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const setEditorElement = useCallback((el: HTMLDivElement | null) => {
    (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (replyRef) (replyRef as React.MutableRefObject<HTMLElement | null>).current = el;
  }, [replyRef]);

  // Drag-and-drop
  const composeContainerRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if ([...e.dataTransfer.types].includes('Files')) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!composeContainerRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setSelectedFiles(prev => [...prev, ...files]);
  };

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [forwardTo, setForwardTo] = useState('');
  const [toInput, setToInput] = useState('');
  const [extraToChips, setExtraToChips] = useState<string[]>([]);
  const [removedBaseEmails, setRemovedBaseEmails] = useState<Set<string>>(new Set());
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const templatePickerRef = useRef<HTMLDivElement>(null);
  const toInputWrapperRef = useRef<HTMLDivElement>(null);
  const ccInputWrapperRef = useRef<HTMLDivElement>(null);
  const fwdInputWrapperRef = useRef<HTMLDivElement>(null);
  const { data: emailTemplates = [] } = useGetEmailTemplatesQuery();

  useEffect(() => {
    if (!showTemplatePicker) return;
    const handler = (e: MouseEvent) => {
      if (templatePickerRef.current && !templatePickerRef.current.contains(e.target as Node))
        setShowTemplatePicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplatePicker]);

  const firstInbound = messages.find(m => m.direction === 'inbound');
  const isMailbox = (e: string) => e.toLowerCase() === MAILBOX_EMAIL;

  // For forwarded emails the body starts with "From: Name <email>" — extract the real customer
  const forwardedOriginalSender = firstInbound?.body_text
    ? extractForwardedSender(firstInbound.body_text)
    : null;
  const effectiveInboundSender = forwardedOriginalSender ?? firstInbound?.from_email ?? senderEmail;

  // Reply: real customer (or forwarder if not a forward)
  const replyToEmails = [effectiveInboundSender];

  // Reply All: real customer + original To addresses (excluding our mailbox)
  const replyAllToEmails = (() => {
    if (!firstInbound) return [senderEmail];
    const all = new Set<string>();
    all.add(effectiveInboundSender);
    firstInbound.to_email?.split(',').map(e => e.trim()).filter(e => e && !isMailbox(e)).forEach(e => all.add(e));
    return [...all];
  })();

  const baseToEmails = composeTab === 'Reply All' ? replyAllToEmails : replyToEmails;

  // Collect all contacts seen in this thread + predefined list for autocomplete
  const knownContacts = useMemo((): ContactSuggestion[] => {
    const byEmail = new Map<string, ContactSuggestion>();

    // Predefined contacts take priority (they have names)
    for (const c of PREDEFINED_CONTACTS) byEmail.set(c.email.toLowerCase(), c);

    // Thread-extracted emails (no display name)
    const addEmail = (raw: string) => {
      const angle = raw.match(/<([^>@\s]+@[^>@\s]+)>/);
      const email = (angle ? angle[1] : raw).trim().toLowerCase();
      if (email.includes('@') && !byEmail.has(email)) byEmail.set(email, { name: '', email });
    };
    for (const msg of messages) {
      addEmail(msg.from_email ?? '');
      for (const field of [msg.to_email, msg.cc_emails])
        field?.split(/[,;]/).forEach(addEmail);
      const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const body = msg.body_text ?? (msg.body_html ?? '').replace(/<[^>]+>/g, ' ');
      let m;
      while ((m = emailRe.exec(body)) !== null) addEmail(m[0]);
    }
    byEmail.delete(MAILBOX_EMAIL);
    return [...byEmail.values()];
  }, [messages]);

  const toSuggestions = useMemo(() => {
    if (!toInput.trim()) return [];
    const q = toInput.toLowerCase();
    const added = new Set([...baseToEmails.filter(e => !removedBaseEmails.has(e)), ...extraToChips].map(e => e.toLowerCase()));
    return knownContacts
      .filter(c => (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) && !added.has(c.email.toLowerCase()))
      .slice(0, 6);
  }, [toInput, knownContacts, baseToEmails, extraToChips, removedBaseEmails]);

  const ccSuggestions = useMemo(() => {
    if (!ccInput.trim()) return [];
    const q = ccInput.toLowerCase();
    const added = new Set(ccChips.map(e => e.toLowerCase()));
    return knownContacts
      .filter(c => (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) && !added.has(c.email.toLowerCase()))
      .slice(0, 6);
  }, [ccInput, knownContacts, ccChips]);

  const forwardToSuggestions = useMemo(() => {
    if (composeTab !== 'Forward' || !forwardTo.trim()) return [];
    const lastToken = forwardTo.split(',').pop()?.trim() ?? '';
    if (!lastToken) return [];
    const q = lastToken.toLowerCase();
    return knownContacts
      .filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [forwardTo, knownContacts, composeTab]);

  // Reset chip state and pre-fill CC on tab switch
  useEffect(() => {
    setToInput('');
    setExtraToChips([]);
    setRemovedBaseEmails(new Set());
    setCcInput('');
    if (composeTab === 'Reply All') {
      const fi = messages.find(m => m.direction === 'inbound');
      const initialCc = fi?.cc_emails?.split(',').map(e => e.trim()).filter(Boolean) ?? [];
      setCcChips(initialCc);
    } else {
      setCcChips([]);
    }
  }, [composeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scan raw text for all valid email addresses — handles "Name <email>", semicolons, newlines
  const parseEmails = (raw: string): string[] =>
    [...new Set(raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [])];

  const activeBaseEmails = () =>
    new Set(baseToEmails.filter(e => !removedBaseEmails.has(e)).map(e => e.toLowerCase()));

  const commitToInput = () => {
    if (!toInput.trim()) return;
    const taken = new Set([...activeBaseEmails(), ...extraToChips.map(e => e.toLowerCase())]);
    const emails = parseEmails(toInput).filter(e => !taken.has(e.toLowerCase()));
    if (emails.length > 0) setExtraToChips(prev => [...prev, ...emails]);
    setToInput('');
  };

  const commitCcInput = () => {
    if (!ccInput.trim()) return;
    const taken = new Set(ccChips.map(e => e.toLowerCase()));
    const emails = parseEmails(ccInput).filter(e => !taken.has(e.toLowerCase()));
    if (emails.length > 0) setCcChips(prev => [...prev, ...emails]);
    setCcInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (idx: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  const formatText = (cmd: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    // execCommand is deprecated but still the only cross-browser way to toggle
    // inline formatting in a contentEditable. Wrap in try/catch so a CSP block
    // or browser removal doesn't crash the whole compose area.
    try {
      document.execCommand(cmd, false);
    } catch {
      // silently ignore — formatting unavailable in this environment
    }
    // Keep editorEmpty in sync after command
    setEditorEmpty(!el.innerText.trim());
  };

  const handleSend = async () => {
    const html = editorRef.current?.innerHTML ?? '';
    const text = editorRef.current?.innerText?.trim() ?? '';
    if (!text && selectedFiles.length === 0) return;
    if (composeTab === 'Forward' && !forwardTo.trim()) return;
    setSendError(null);
    const fd = new FormData();
    fd.append('body_text', text || ' ');
    fd.append('body_html', html);
    selectedFiles.forEach(f => fd.append('files', f));

    if (composeTab === 'Forward') {
      fd.append('to_emails', forwardTo.trim());
    } else {
      // Commit any half-typed email, then combine all To recipients
      const pending = toInput.trim() ? toInput.split(',').map(s => s.trim()).filter(Boolean) : [];
      const filteredBase = baseToEmails.filter(e => !removedBaseEmails.has(e));
      fd.append('to_emails', [...filteredBase, ...extraToChips, ...pending].join(', '));
    }
    const pendingCc = ccInput.trim() ? ccInput.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allCc = [...ccChips, ...pendingCc];
    if (allCc.length > 0) fd.append('cc_emails', allCc.join(', '));

    const result = await replyMessage({ bookingId, formData: fd });
    if ('error' in result) {
      const raw = (result.error as { data?: { detail?: string } })?.data?.detail ?? '';
      let errMsg = 'Failed to send. Please try again.';
      if (raw) {
        if (/InvalidRecipients?/i.test(raw) || /recipient.*not.*resolved/i.test(raw))
          errMsg = 'One or more email addresses are invalid or could not be resolved. Please check the recipients.';
        else if (/Unauthorized|401/i.test(raw))
          errMsg = 'Session expired. Please refresh and try again.';
        else if (raw.length < 120 && !raw.startsWith('{'))
          errMsg = raw;
      }
      setSendError(errMsg);
      return;
    }
    if (editorRef.current) editorRef.current.innerHTML = '';
    setEditorEmpty(true);
    setSelectedFiles([]);
    setToInput('');
    setExtraToChips([]);
    setRemovedBaseEmails(new Set());
    setCcChips([]);
    setCcInput('');
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

  const handleSync = async () => {
    setSyncResult(null);
    try {
      const res = await syncEmails(bookingId).unwrap();
      setSyncResult(res.synced > 0 ? `${res.synced} new email${res.synced !== 1 ? 's' : ''} synced` : 'Already up to date');
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setSyncResult(detail ?? 'Sync failed — try again');
    }
    setTimeout(() => setSyncResult(null), 6000);
  };

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
      {!readOnly && <div
        ref={composeContainerRef}
        className="border border-gray-200 rounded-xl mt-2 bg-white shadow-sm relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag-and-drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-indigo-50/80 border-2 border-dashed border-indigo-400 rounded-xl flex items-center justify-center z-20 pointer-events-none">
            <div className="text-center">
              <svg className="w-9 h-9 text-indigo-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              <p className="text-sm font-semibold text-indigo-600 mt-2">Drop files to attach</p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-gray-50/60 rounded-t-xl overflow-hidden">
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
          <div className="flex items-start gap-1.5 flex-wrap border-b border-gray-50 pb-2 min-h-[28px]">
            <span className="text-[11px] font-semibold text-gray-400 shrink-0 mt-[3px]">To:</span>
            {composeTab === 'Forward' ? (
              <div ref={fwdInputWrapperRef} className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={forwardTo}
                  onChange={e => setForwardTo(e.target.value)}
                  placeholder="recipient@example.com, another@example.com"
                  className="w-full text-[12px] text-gray-700 bg-transparent focus:outline-none placeholder:text-gray-300"
                />
                <SuggestionPortal
                  suggestions={forwardToSuggestions}
                  anchorRef={fwdInputWrapperRef}
                  onSelect={email => {
                    const parts = forwardTo.split(',');
                    parts[parts.length - 1] = ' ' + email;
                    setForwardTo(parts.join(',').replace(/^,\s*/, ''));
                  }}
                />
              </div>
            ) : (
              <>
                {baseToEmails.filter(e => !removedBaseEmails.has(e)).map((email, i) => (
                  <span key={`base-${i}`} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-medium shrink-0">
                    {email}
                    <button
                      type="button"
                      onClick={() => setRemovedBaseEmails(prev => new Set([...prev, email]))}
                      className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-indigo-200 text-indigo-400 hover:text-indigo-700 transition-colors leading-none text-[10px]"
                    >✕</button>
                  </span>
                ))}
                {extraToChips.map((email, i) => (
                  <span key={`extra-${i}`} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-medium shrink-0">
                    {email}
                    <button
                      type="button"
                      onClick={() => setExtraToChips(prev => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-indigo-200 text-indigo-400 hover:text-indigo-700 transition-colors leading-none text-[10px]"
                    >✕</button>
                  </span>
                ))}
                <div ref={toInputWrapperRef} className="relative flex-1 min-w-[100px]">
                  <input
                    type="text"
                    value={toInput}
                    onChange={e => setToInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && toInput.trim()) {
                        e.preventDefault();
                        commitToInput();
                      }
                      if (e.key === 'Backspace' && !toInput && extraToChips.length > 0) {
                        setExtraToChips(prev => prev.slice(0, -1));
                      }
                    }}
                    onBlur={commitToInput}
                    onPaste={e => {
                      const pasted = e.clipboardData.getData('text');
                      const emails = parseEmails(pasted);
                      if (emails.length > 1) {
                        e.preventDefault();
                        const taken = new Set([...activeBaseEmails(), ...extraToChips.map(e => e.toLowerCase())]);
                        const fresh = emails.filter(e => !taken.has(e.toLowerCase()));
                        if (fresh.length > 0) setExtraToChips(prev => [...prev, ...fresh]);
                      }
                    }}
                    placeholder={baseToEmails.filter(e => !removedBaseEmails.has(e)).length === 0 && extraToChips.length === 0 ? 'Add recipient...' : 'Add more...'}
                    className="w-full text-[12px] text-gray-700 bg-transparent focus:outline-none placeholder:text-gray-300"
                  />
                  <SuggestionPortal
                    suggestions={toSuggestions}
                    anchorRef={toInputWrapperRef}
                    onSelect={email => { setExtraToChips(prev => [...prev, email]); setToInput(''); }}
                  />
                </div>
              </>
            )}
          </div>

          {/* CC: row — always visible, chip input */}
          <div className="flex items-start gap-1.5 flex-wrap border-b border-gray-50 pb-2 min-h-[28px]">
            <span className="text-[11px] font-semibold text-gray-400 shrink-0 mt-[3px]">CC:</span>
            {ccChips.map((email, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 font-medium shrink-0">
                {email}
                <button
                  type="button"
                  onClick={() => setCcChips(prev => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-gray-300 text-gray-400 hover:text-gray-700 transition-colors leading-none text-[10px]"
                >✕</button>
              </span>
            ))}
            <div ref={ccInputWrapperRef} className="relative flex-1 min-w-[120px]">
              <input
                type="text"
                value={ccInput}
                onChange={e => setCcInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && ccInput.trim()) {
                    e.preventDefault();
                    commitCcInput();
                  }
                  if (e.key === 'Backspace' && !ccInput && ccChips.length > 0) {
                    setCcChips(prev => prev.slice(0, -1));
                  }
                }}
                onBlur={commitCcInput}
                onPaste={e => {
                  const pasted = e.clipboardData.getData('text');
                  const emails = parseEmails(pasted);
                  if (emails.length > 1) {
                    e.preventDefault();
                    const taken = new Set(ccChips.map(e => e.toLowerCase()));
                    const fresh = emails.filter(e => !taken.has(e.toLowerCase()));
                    if (fresh.length > 0) setCcChips(prev => [...prev, ...fresh]);
                  }
                }}
                placeholder={ccChips.length === 0 ? 'cc@example.com, another@example.com' : 'Add more...'}
                className="w-full text-[12px] text-gray-700 bg-transparent focus:outline-none placeholder:text-gray-300"
              />
              <SuggestionPortal
                suggestions={ccSuggestions}
                anchorRef={ccInputWrapperRef}
                onSelect={email => { setCcChips(prev => [...prev, email]); setCcInput(''); }}
              />
            </div>
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-1.5 pb-2 border-b border-gray-100">
            {/* B / I / U / S group */}
            <div className="flex items-center rounded-lg border border-gray-200 divide-x divide-gray-200 overflow-hidden">
              {([
                { cmd: 'bold',         title: 'Bold',          node: <span className="font-extrabold text-[13px] leading-none">B</span> },
                { cmd: 'italic',       title: 'Italic',        node: <span className="font-serif italic font-medium text-[14px] leading-none">I</span> },
                { cmd: 'underline',    title: 'Underline',     node: <span className="underline text-[13px] leading-none" style={{ textDecorationThickness: '1.5px' }}>U</span> },
                { cmd: 'strikeThrough',title: 'Strikethrough', node: <span className="line-through text-[13px] leading-none">S</span> },
              ] as { cmd: string; title: string; node: React.ReactNode }[]).map(({ cmd, title, node }) => (
                <button
                  key={cmd}
                  type="button"
                  title={title}
                  onMouseDown={e => { e.preventDefault(); formatText(cmd); }}
                  className="w-8 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >{node}</button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-gray-200" />

            {/* List group */}
            <div className="flex items-center rounded-lg border border-gray-200 divide-x divide-gray-200 overflow-hidden">
              <button
                type="button"
                title="Bullet list"
                onMouseDown={e => { e.preventDefault(); formatText('insertUnorderedList'); }}
                className="w-8 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h.01M4 12h.01M4 18h.01"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h12M8 12h12M8 18h12"/>
                </svg>
              </button>
              <button
                type="button"
                title="Numbered list"
                onMouseDown={e => { e.preventDefault(); formatText('insertOrderedList'); }}
                className="w-8 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h11M10 12h11M10 18h11"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h1v3M4 9h2M4 12.5c0-.8.7-1.5 1.5-1.5S7 12 7 12.5c0 .5-.4 1-1 1.5L4 15.5h3"/>
                </svg>
              </button>
            </div>

            {/* Indent group */}
            <div className="flex items-center rounded-lg border border-gray-200 divide-x divide-gray-200 overflow-hidden">
              <button
                type="button"
                title="Indent"
                onMouseDown={e => { e.preventDefault(); formatText('indent'); }}
                className="w-8 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h12M3 18h12M17 10l3 2-3 2"/>
                </svg>
              </button>
              <button
                type="button"
                title="Remove formatting"
                onMouseDown={e => { e.preventDefault(); formatText('removeFormat'); }}
                className="w-8 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M9 3h11l-5 6M3 21l5-6"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Rich-text editor */}
          <div className="relative min-h-[80px]">
            <div
              ref={setEditorElement}
              contentEditable
              suppressContentEditableWarning
              onInput={e => setEditorEmpty(!(e.currentTarget as HTMLDivElement).innerText.trim())}
              onPaste={e => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }}
              className="w-full py-1 text-sm text-gray-700 bg-transparent focus:outline-none min-h-[80px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
            />
            {editorEmpty && (
              <span className="absolute top-1 left-0 text-sm text-gray-300 pointer-events-none select-none">
                {composePlaceholder}
              </span>
            )}
          </div>

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
              {selectedFiles.map((f, i) => (
                <SelectedFileChip key={i} file={f} onRemove={() => removeFile(i)} />
              ))}
            </div>
          )}

          {/* Send error */}
          {sendError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.293 4.707a1 1 0 011.414 0L21 13.414A2 2 0 0119.586 15H4.414A2 2 0 013 13.414l9.293-8.707z"/>
              </svg>
              {sendError}
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

            {/* Template picker */}
            {emailTemplates.length > 0 && (
              <div className="relative" ref={templatePickerRef}>
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(p => !p)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border rounded-lg transition-all ${
                    showTemplatePicker
                      ? 'border-indigo-300 text-indigo-600 bg-indigo-50/40'
                      : 'border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
                  </svg>
                  Template
                  <svg className={`w-3 h-3 transition-transform ${showTemplatePicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showTemplatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Choose a template</p>
                      {emailTemplates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (editorRef.current) {
                              const filled = t.body.replace(/(Thanks and Best Regards,?\s*\n)<_+>/gi, `$1${currentUser?.name ?? ''}`);
                              editorRef.current.innerHTML = filled.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
                              setEditorEmpty(false);
                            }
                            setShowTemplatePicker(false);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors group/item last:rounded-b-xl"
                        >
                          <p className="text-sm font-semibold text-gray-800 group-hover/item:text-indigo-700">{t.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{t.body}</p>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

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
                (composeTab === 'Forward' ? !forwardTo.trim() : (editorEmpty && selectedFiles.length === 0)) ||
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
