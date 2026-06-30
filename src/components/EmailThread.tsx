'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useGetMessagesQuery, useReplyMessageMutation, useSyncEmailsMutation } from '@/services/emailApi';
import { useGetEmailTemplatesQuery } from '@/services/emailTemplatesApi';
import type { EmailMessage, EmailAttachment } from '@/services/emailApi';
import AccountCodePicker from '@/components/AccountCodePicker';
import type { Agent } from '@/services/agentsApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const MAILBOX_EMAIL = (process.env.NEXT_PUBLIC_MAILBOX_EMAIL ?? '').toLowerCase();
const TRILOGY_API = 'https://trilogy-api.wavetrain.cloud';

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

const MAX_ATTACH_BYTES = 20 * 1024 * 1024; // 20 MB

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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowPreview(true)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowPreview(true); }}
        className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px] text-left group cursor-pointer"
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
      </div>

      <AnimatePresence>
        {showPreview && <FilePreviewModal file={file} onClose={() => setShowPreview(false)} />}
      </AnimatePresence>
    </>
  );
}

type TrilogyDetail = {
  filename?: string;
  doc_type?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  headers?: string[];
  rows?: Record<string, unknown>[];
};

function isTrilogyDetail(d: unknown): d is TrilogyDetail {
  if (!d || typeof d !== 'object') return false;
  const obj = d as Record<string, unknown>;
  return Array.isArray(obj.headers) && Array.isArray(obj.rows);
}

/* ── Windows-style shared styles ── */
const WF: React.CSSProperties = { fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif' };

const WIN_IN: React.CSSProperties = {
  ...WF, fontSize: '11px', background: '#ffffff',
  border: '1px solid', borderColor: '#808080 #ffffff #ffffff #808080',
  boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.12)',
  outline: 'none', color: '#000000', padding: '1px 4px', height: '20px',
};

const WIN_IN_SM: React.CSSProperties = { ...WIN_IN, fontSize: '10px', height: '18px', padding: '1px 3px' };

const LBL: React.CSSProperties = {
  ...WF, fontSize: '11px', color: '#000080', fontWeight: 'bold',
  whiteSpace: 'nowrap' as const, textAlign: 'right' as const,
};
const LBL_SM: React.CSSProperties = { ...LBL, fontSize: '10px' };

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#0a246a #c0c0c0 #c0c0c0 #0a246a';
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = '#808080 #ffffff #ffffff #808080';
}

function Win3DButton({
  onClick, children, bold, minW = 72, disabled,
}: {
  onClick: () => void; children: React.ReactNode; bold?: boolean; minW?: number; disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => { if (!disabled) setPressed(true); }}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        minWidth: minW, padding: '2px 10px', fontSize: '11px', ...WF,
        fontWeight: bold ? 'bold' : 'normal', background: '#ece9d8',
        border: '1px solid',
        borderColor: pressed ? '#808080 #ffffff #ffffff #808080' : '#ffffff #808080 #808080 #ffffff',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#808080' : '#000000',
        opacity: disabled ? 0.55 : 1,
        userSelect: 'none' as const, outline: 'none',
      }}
    >
      {children}
    </button>
  );
}

/* Compact input with focus highlight */
function WI({
  value, onChange, style, sm,
}: {
  value: string; onChange?: (v: string) => void; style?: React.CSSProperties; sm?: boolean;
}) {
  const base = sm ? WIN_IN_SM : WIN_IN;
  return (
    <input
      value={value}
      onChange={onChange ? e => onChange(e.target.value) : undefined}
      readOnly={!onChange}
      style={{ ...base, ...style }}
      onFocus={focusIn}
      onBlur={focusOut}
    />
  );
}

/* One labelled field row */
function FR({
  label, value, onChange, lw = 72, required, sm,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  lw?: number; required?: boolean; sm?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', minHeight: sm ? 20 : 23 }}>
      <span style={{
        ...(sm ? LBL_SM : LBL),
        width: lw, minWidth: lw,
        ...(required ? { background: '#ff8080', color: '#000', padding: '0 2px' } : {}),
      }}>
        {label}
      </span>
      <WI value={value} onChange={onChange} style={{ flex: 1 }} sm={sm} />
    </div>
  );
}

/* Two-col address panel (Pick / Drop) */
function AddrPanel({
  title, addrNo, addrType, fields, swap,
}: {
  title: string;
  addrNo: number;
  addrType: string;
  fields: { label: string; value: string; onChange?: (v: string) => void }[];
  swap?: boolean;
}) {
  return (
    <div>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        background: '#d4d0c8', padding: '2px 4px', marginBottom: '2px',
        borderBottom: '1px solid #808080',
      }}>
        <span style={LBL_SM}>Addr No.</span>
        <WI value={String(addrNo)} style={{ width: 26 }} sm />
        <span style={LBL_SM}>Drops.</span>
        <WI value="0" style={{ width: 26 }} sm />
        <span style={LBL_SM}>Addr Type</span>
        <WI value={addrType} style={{ width: 46 }} sm />
        {swap && (
          <label style={{ ...LBL_SM, display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
            <input type="checkbox" style={{ margin: 0 }} /> Swap
          </label>
        )}
      </div>
      {fields.map(f => (
        <FR key={f.label} label={f.label} value={f.value} onChange={f.onChange} lw={88} sm />
      ))}
    </div>
  );
}

/* ── Module-level helper so TrilogyEditModal & TrilogyTable share the same logic ── */
function buildFormFields(row: Record<string, unknown>, headers: string[]) {
  function p(...keys: string[]): string {
    for (const key of keys) {
      const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const h = headers.find(hh => hh.toLowerCase().replace(/[^a-z0-9]/g, '') === k);
      if (h) {
        const v = String(row[h] ?? '').trim();
        if (v && v.toLowerCase() !== 'not stated') return v;
      }
    }
    return '';
  }
  return {
    jobRef:       p('JOB REF', 'job ref', 'job reference', 'jobref'),
    jobNo:        p('JOB NO', 'job no', 'docket', 'job number', 'jobno'),
    custRef:      p('CUSTOMER REFERENCE', 'cust ref', 'customer ref', 'custref', 'reference'),
    mawb:         p('MAWB'),
    hawb:         p('HAWB'),
    agentFwd:     p('AGENT / FORWARDER', 'agent forwarder', 'agent', 'forwarder'),
    jobType:      p('JOB TYPE', 'job type', 'type'),
    priority:     p('PRIORITY') || 'High',
    podAddr:      p('POD ADDR', 'pod address'),
    pickCo:       p('SHIPPER / COLLECTION NAME', 'shipper', 'collection name', 'shipper collection name'),
    pickBldg:     '',
    pickStreet:   p('COLLECTION ADDRESS', 'collection address', 'pickup address', 'collectionaddress'),
    pickLocality: '',
    pickTown:     '',
    pickCounty:   '',
    pickPostcode: p('COLLECTION POSTCODE', 'collection postcode', 'pickup postcode'),
    pickCountry:  'Great Britain',
    pickContact:  '',
    pickPhone:    '',
    pickEmail:    '',
    pickReady:    p('FROM TIME', 'from time', 'ready at', 'ready'),
    pickNoLater:  p('TO TIME', 'to time', 'no later than'),
    pickDate:     p('DATE', 'collection date'),
    pickNotes:    '',
    dropCo:       '',
    dropBldg:     '',
    dropStreet:   p('DELIVERY ADDRESS', 'delivery address', 'drop address'),
    dropLocality: '',
    dropTown:     '',
    dropCounty:   '',
    dropPostcode: p('DELIVERY POSTCODE', 'delivery postcode', 'drop postcode'),
    dropCountry:  'Great Britain',
    dropContact:  '',
    dropPhone:    '',
    dropEmail:    '',
    dropReady:    '',
    dropNoLater:  '',
    dropDate:     '',
    dropNotes:    '',
  };
}

function TrilogyEditModal({
  rows, headers, initialRowIndex = 0, onClose,
}: {
  rows: Record<string, unknown>[];
  headers: string[];
  initialRowIndex?: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(initialRowIndex);
  const total = rows.length;

  const [f, setF] = useState(() => buildFormFields(rows[initialRowIndex] ?? {}, headers));

  /* Reset fields whenever user navigates to a different row */
  useEffect(() => {
    setF(buildFormFields(rows[currentIdx] ?? {}, headers));
  }, [currentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  function upd(key: keyof typeof f) {
    return (v: string) => setF(prev => ({ ...prev, [key]: v }));
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = () => {
    console.log(`[Trilogy] Row ${currentIdx + 1} of ${total} saved:`, f);
  };

  if (typeof document === 'undefined') return null;

  const TABS = ['Overnight', 'International', 'Chauffeur', 'Stock'];

  const customerInfo = [
    f.jobRef  && `Job Ref: ${f.jobRef}`,
    f.jobNo   && `Job No: ${f.jobNo}`,
    f.agentFwd && `Agent: ${f.agentFwd}`,
  ].filter(Boolean).join('\n');

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', padding: '8px' }}
      onClick={onClose}
    >
      <div
        style={{
          ...WF, background: '#ece9d8', width: '100%', maxWidth: 920,
          maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '2px solid', borderColor: '#ffffff #404040 #404040 #ffffff',
          boxShadow: '4px 4px 12px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Title bar ── */}
        <div style={{
          background: 'linear-gradient(to right, #0a246a 0%, #3a6ea5 50%, #a6caf0 100%)',
          minHeight: 28, padding: '3px 4px 3px 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none' as const, flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', textShadow: '1px 1px 1px rgba(0,0,0,0.5)', ...WF }}>
            Booking Form : Live Dockets.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(f.jobNo || total > 1) && (
              <span style={{ color: '#00ffff', fontSize: 11, fontWeight: 'bold', ...WF }}>
                {total > 1 && `Row ${currentIdx + 1} / ${total}`}{total > 1 && f.jobNo ? '  ·  ' : ''}{f.jobNo ? `Docket: ${f.jobNo}` : ''}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                width: 21, height: 21, fontSize: 10, fontWeight: 'bold', cursor: 'pointer',
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(to bottom, #e8a000, #c06000)',
                border: '1px solid', borderColor: '#ffcc66 #804000 #804000 #ffcc66',
                ...WF,
              }}
            >✕</button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div style={{
          background: '#ece9d8', borderBottom: '1px solid #808080',
          padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 4,
          minHeight: 26, flexShrink: 0,
        }}>
          <Win3DButton onClick={() => {}} minW={60}>Actions ▾</Win3DButton>
          <span style={{ display: 'inline-block', width: 1, height: 18, background: '#808080', margin: '0 2px' }} />
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, background: '#ece9d8', padding: '5px 8px' }}>

          {/* ── Top section: 3 columns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: '3px 8px', marginBottom: 4 }}>

            {/* Col 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ ...LBL, width: 68, minWidth: 68 }}>Acc Code:</span>
                <WI value="" style={{ width: 58 }} />
                <Win3DButton onClick={() => {}} minW={58}>Change...</Win3DButton>
              </div>
              <FR label="Contact:" value="" lw={68} />
              <FR label="CUST REF" value={f.custRef} onChange={upd('custRef')} lw={68} required />
              <FR label="JOB TYPE" value={f.jobType} onChange={upd('jobType')} lw={68} required />
              <FR label="Owner:" value="" lw={68} />
            </div>

            {/* Col 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FR label="Acc Name:" value={f.agentFwd} onChange={upd('agentFwd')} lw={72} />
              <FR label="MAWB:" value={f.mawb} onChange={upd('mawb')} lw={72} />
              <FR label="Telephone:" value="" lw={72} />
              <FR label="Priority:" value={f.priority} onChange={upd('priority')} lw={72} />
              <FR label="Template:" value="" lw={72} />
            </div>

            {/* Col 3: Customer info box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ ...LBL, textAlign: 'left', color: '#000080' }}>Customer Information:</span>
              <textarea
                value={customerInfo}
                readOnly
                style={{
                  flex: 1, minHeight: 70, ...WF, fontSize: 10,
                  background: '#ffffff', border: '1px solid',
                  borderColor: '#808080 #ffffff #ffffff #808080',
                  boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.12)',
                  padding: '2px 3px', resize: 'none', outline: 'none', color: '#000',
                }}
              />
            </div>
          </div>

          {/* ── Job Status divider ── */}
          <div style={{ borderBottom: '1px solid #808080', marginBottom: 3, paddingBottom: 1 }}>
            <span style={{ ...WF, fontSize: 11, fontWeight: 'bold' }}>Job Status:</span>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #808080', gap: 0, marginBottom: 0 }}>
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                style={{
                  ...WF, fontSize: 11, padding: '2px 10px', cursor: 'pointer',
                  color: '#000', fontWeight: tab === i ? 'bold' : 'normal',
                  background: tab === i ? '#ece9d8' : '#c8c4bc',
                  border: '1px solid #808080',
                  borderBottom: tab === i ? '1px solid #ece9d8' : '1px solid #808080',
                  marginBottom: tab === i ? -1 : 0,
                  position: 'relative' as const, zIndex: tab === i ? 1 : 0,
                }}
              >{t}</button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div style={{ border: '1px solid #808080', borderTop: 'none', background: '#ece9d8', padding: '5px 8px' }}>

            {/* Row: Tariff / POD */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px', marginBottom: 3 }}>
              <span style={LBL}>Tariff</span>
              <WI value="DELIVERY" style={{ width: 88 }} />
              <label style={{ ...LBL, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
                <input type="checkbox" style={{ margin: 0 }} /> Addressee Only
              </label>
              <span style={{ ...LBL, marginLeft: 6 }}>POD Type</span>
              <WI value="Email" style={{ width: 68 }} />
              <span style={LBL}>POD Addr</span>
              <WI value={f.podAddr} onChange={upd('podAddr')} style={{ flex: 1, minWidth: 160 }} />
              <span style={LBL}>Units</span>
              <WI value="0" style={{ width: 34 }} />
            </div>

            {/* Row: HAWB / Job Ref */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px 8px', flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={LBL}>HAWB</span>
              <WI value={f.hawb} onChange={upd('hawb')} style={{ width: 180 }} />
              <span style={{ ...LBL, marginLeft: 10 }}>Job Ref</span>
              <WI value={f.jobRef} onChange={upd('jobRef')} style={{ flex: 1, minWidth: 140 }} />
              <span style={{ ...LBL, marginLeft: 10 }}>HAZ</span>
              <WI value="" style={{ width: 56 }} />
              <span style={LBL}>SPX</span>
              <WI value="" style={{ width: 56 }} />
            </div>

            {/* ── Divider ── */}
            <div style={{ background: '#808080', height: 1, margin: '5px 0' }} />

            {/* ── Two-column address ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>

              <AddrPanel
                title="Pick"
                addrNo={0}
                addrType="Pick"
                fields={[
                  { label: 'Company',    value: f.pickCo,       onChange: upd('pickCo') },
                  { label: 'Building',   value: f.pickBldg,     onChange: upd('pickBldg') },
                  { label: 'Street',     value: f.pickStreet,   onChange: upd('pickStreet') },
                  { label: 'Locality',   value: f.pickLocality, onChange: upd('pickLocality') },
                  { label: 'Town',       value: f.pickTown,     onChange: upd('pickTown') },
                  { label: 'County',     value: f.pickCounty,   onChange: upd('pickCounty') },
                  { label: 'PostCode',   value: f.pickPostcode, onChange: upd('pickPostcode') },
                  { label: 'Country',    value: f.pickCountry,  onChange: upd('pickCountry') },
                  { label: 'Contact',    value: f.pickContact,  onChange: upd('pickContact') },
                  { label: 'Telephone',  value: f.pickPhone,    onChange: upd('pickPhone') },
                  { label: 'Email',      value: f.pickEmail,    onChange: upd('pickEmail') },
                  { label: 'Ready @',    value: f.pickReady,    onChange: upd('pickReady') },
                  { label: 'No later',   value: f.pickNoLater,  onChange: upd('pickNoLater') },
                  { label: 'Date',       value: f.pickDate,     onChange: upd('pickDate') },
                ]}
              />

              <AddrPanel
                title="Drop"
                addrNo={1}
                addrType="Drop"
                swap
                fields={[
                  { label: 'Company',    value: f.dropCo,       onChange: upd('dropCo') },
                  { label: 'Building',   value: f.dropBldg,     onChange: upd('dropBldg') },
                  { label: 'Street',     value: f.dropStreet,   onChange: upd('dropStreet') },
                  { label: 'Locality',   value: f.dropLocality, onChange: upd('dropLocality') },
                  { label: 'Town',       value: f.dropTown,     onChange: upd('dropTown') },
                  { label: 'County',     value: f.dropCounty,   onChange: upd('dropCounty') },
                  { label: 'PostCode',   value: f.dropPostcode, onChange: upd('dropPostcode') },
                  { label: 'Country',    value: f.dropCountry,  onChange: upd('dropCountry') },
                  { label: 'Contact',    value: f.dropContact,  onChange: upd('dropContact') },
                  { label: 'Telephone',  value: f.dropPhone,    onChange: upd('dropPhone') },
                  { label: 'Email',      value: f.dropEmail,    onChange: upd('dropEmail') },
                  { label: 'Ready @',    value: f.dropReady,    onChange: upd('dropReady') },
                  { label: 'No later',   value: f.dropNoLater,  onChange: upd('dropNoLater') },
                  { label: 'Date',       value: f.dropDate,     onChange: upd('dropDate') },
                ]}
              />
            </div>

            {/* Notes row */}
            <div style={{ background: '#808080', height: 1, margin: '4px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
              {(['pickNotes', 'dropNotes'] as const).map((key, i) => (
                <div key={key}>
                  <span style={LBL_SM}>{i === 0 ? 'Collection Notes:' : 'Delivery Notes:'}</span>
                  <textarea
                    value={f[key]}
                    onChange={e => upd(key)(e.target.value)}
                    style={{
                      width: '100%', height: 38, marginTop: 2, ...WF, fontSize: 10,
                      background: '#fff', border: '1px solid',
                      borderColor: '#808080 #fff #fff #808080',
                      padding: '2px 3px', resize: 'none', outline: 'none', color: '#000',
                    }}
                    onFocus={focusIn}
                    onBlur={focusOut}
                  />
                </div>
              ))}
            </div>

          </div>{/* end tab content */}
        </div>{/* end body */}

        {/* ── Footer buttons ── */}
        <div style={{
          background: '#ece9d8', borderTop: '1px solid #808080',
          padding: '5px 8px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 6, flexShrink: 0,
        }}>
          {/* Row navigation — only shown when multiple rows */}
          {total > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Win3DButton onClick={() => setCurrentIdx(i => i - 1)} disabled={currentIdx === 0} minW={60}>&#9664; Prev</Win3DButton>
              <span style={{ ...WF, fontSize: 11, padding: '0 8px', color: '#000080', fontWeight: 'bold' }}>
                Row {currentIdx + 1} of {total}
              </span>
              <Win3DButton onClick={() => setCurrentIdx(i => i + 1)} disabled={currentIdx >= total - 1} minW={60}>Next &#9654;</Win3DButton>
            </div>
          ) : <div />}
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Win3DButton onClick={onClose}>Cancel</Win3DButton>
            <Win3DButton onClick={handleSave} bold>&#10003;&nbsp;Save Row</Win3DButton>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

function TrilogyTable({ headers, rows }: { headers: string[]; rows: Record<string, unknown>[] }) {
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);

  if (rows.length === 0)
    return <p className="text-gray-400 text-sm text-center py-10">No rows extracted from this document.</p>;

  return (
    <>
      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm" style={{ maxHeight: 'calc(88vh - 160px)' }}>
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b border-gray-200">
              {headers.map(h => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-100"
                >
                  {h}
                </th>
              ))}
              <th className="px-3 py-2 bg-gray-100 sticky right-0 z-20 w-14" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} onClick={() => setEditingRowIdx(i)} className={`group cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} hover:bg-indigo-50/40 transition-colors`}>
                {headers.map(h => (
                  <td
                    key={h}
                    className="px-3 py-1.5 text-[12px] text-gray-700 border-b border-gray-100 align-middle whitespace-nowrap"
                    title={String(row[h] ?? '')}
                  >
                    {String(row[h] ?? '—')}
                  </td>
                ))}
                {/* Edit action — sticky on right */}
                <td className={`px-2 py-1.5 border-b border-gray-100 align-middle sticky right-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} group-hover:bg-indigo-50/30`}>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingRowIdx(i); }}
                    title="Edit row"
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {editingRowIdx !== null && (
          <TrilogyEditModal
            rows={rows}
            headers={headers}
            initialRowIndex={editingRowIdx}
            onClose={() => setEditingRowIdx(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function renderHistoryData(d: unknown): React.ReactNode {
  if (d === null || d === undefined)
    return <p className="text-gray-400 text-sm italic text-center py-10">No data available</p>;

  // {headers, rows} — the main extraction result
  if (isTrilogyDetail(d)) {
    return <TrilogyTable headers={d.headers ?? []} rows={d.rows ?? []} />;
  }

  if (Array.isArray(d)) {
    if (d.length === 0)
      return <p className="text-gray-400 text-sm text-center py-10">No records found</p>;
    if (typeof d[0] === 'object' && d[0] !== null) {
      const keys = [...new Set(d.flatMap(item => Object.keys(item as Record<string, unknown>)))];
      return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {keys.map(k => (
                  <th key={k} className="px-3.5 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {k.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d as Record<string, unknown>[]).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  {keys.map(k => (
                    <td key={k} className="px-3.5 py-2.5 text-gray-700 border-b border-gray-100 align-top whitespace-nowrap">
                      {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul className="space-y-1.5">
        {(d as unknown[]).map((item, i) => (
          <li key={i} className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof d === 'object' && d !== null) {
    return (
      <div className="space-y-2">
        {Object.entries(d as Record<string, unknown>).map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider min-w-[130px] shrink-0 mt-0.5">{key.replace(/_/g, ' ')}</span>
            <span className="text-sm text-gray-800 flex-1 font-medium">
              {typeof value === 'object' && value !== null
                ? <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{JSON.stringify(value)}</code>
                : String(value ?? '—')}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm text-gray-700 px-4 py-6">{String(d)}</p>;
}

function TrilogyPdfModal({
  filename, loading, data, error, onClose,
}: {
  filename: string; loading: boolean; data: unknown; error: string | null; onClose: () => void;
}) {
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
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-[95vw] max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50/60 to-orange-50/40 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{filename}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Document Extraction</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shrink-0 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Metadata strip — shown when structured detail is available */}
        {!loading && !error && isTrilogyDetail(data) && (
          <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 shrink-0 flex-wrap">
            {data.doc_type && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-700 capitalize">{data.doc_type}</span>
              </span>
            )}
            {data.uploaded_at && (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Uploaded</span>
                {new Date(data.uploaded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {data.uploaded_by && (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">By</span>
                {data.uploaded_by}
              </span>
            )}
            {data.rows && (
              <span className="ml-auto text-[11px] font-semibold text-gray-400">
                {data.rows.length} row{data.rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-5 py-20">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-red-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" />
                <div className="absolute inset-1.5 rounded-full border-4 border-transparent border-t-orange-400 animate-spin [animation-direction:reverse] [animation-duration:700ms]" />
                <div className="absolute inset-3.5 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-800">Processing PDF…</p>
                <p className="text-xs text-gray-400 mt-1">Uploading and extracting document data</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Extraction Failed</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm leading-relaxed">{error}</p>
              </div>
            </div>
          ) : (
            renderHistoryData(data)
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function AttachmentChip({ att, token }: { att: EmailAttachment; token: string | null }) {
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [extractedHeaders, setExtractedHeaders] = useState<string[]>([]);
  const [extractedRows, setExtractedRows] = useState<Record<string, unknown>[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);

  /* Auto-dismiss error after 5 s */
  useEffect(() => {
    if (!pdfError) return;
    const t = setTimeout(() => setPdfError(null), 5000);
    return () => clearTimeout(t);
  }, [pdfError]);

  const handleViewPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    setExtractedRows([]);
    setExtractedHeaders([]);
    try {
      const res = await fetch('/api/pdf-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentId: att.id,
          token,
          filename: att.filename,
          contentType: att.content_type,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Failed to process PDF');
      if (isTrilogyDetail(json)) {
        setExtractedHeaders(json.headers ?? []);
        setExtractedRows(json.rows ?? []);
        setShowEditModal(true);
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPdfLoading(false);
    }
  };

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
  const isPdf   = att.content_type === 'application/pdf' || /\.pdf$/i.test(att.filename);
  const isWord  = att.content_type.includes('word') || att.filename.match(/\.docx?$/i);
  const isExcel = att.content_type.includes('sheet') || att.content_type.includes('excel') || att.filename.match(/\.xlsx?$/i);

  const iconBg  = isImage ? 'bg-emerald-50' : isPdf ? 'bg-red-50' : isWord ? 'bg-blue-50' : isExcel ? 'bg-green-50' : 'bg-gray-100';
  const iconClr = isImage ? 'text-emerald-500' : isPdf ? 'text-red-500' : isWord ? 'text-blue-500' : isExcel ? 'text-green-600' : 'text-gray-400';

  if (isPdf) {
    return (
      <>
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {/* Main chip — downloads the file */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-red-300 hover:shadow-md transition-all disabled:opacity-60 group flex-1 sm:min-w-[200px] sm:max-w-[260px]"
          >
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              {loading ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12.5px] font-semibold text-gray-800 truncate leading-tight">{att.filename}</p>
              {att.size_bytes ? <p className="text-[11px] text-gray-400 mt-0.5">{formatBytes(att.size_bytes)}</p> : null}
            </div>
            {/* Download icon */}
            <svg className="w-4 h-4 text-gray-300 group-hover:text-red-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>

          {/* Extract button */}
          <div className="relative group/ext shrink-0">
            <button
              onClick={handleViewPdf}
              disabled={pdfLoading}
              className={`flex items-center justify-center w-9 h-9 rounded-xl border shadow-sm transition-all ${
                pdfLoading
                  ? 'border-red-300 bg-red-50 text-red-500 cursor-not-allowed'
                  : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50 text-gray-400 hover:text-red-500'
              }`}
            >
              {pdfLoading ? (
                /* Pulsing rings when loading */
                <span className="relative flex w-4 h-4 items-center justify-center">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-30 animate-ping" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-500" />
                </span>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              )}
            </button>
            {/* Tooltip — hidden while loading */}
            {!pdfLoading && (
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/ext:opacity-100 translate-y-1 group-hover/ext:translate-y-0 transition-all duration-150 z-50">
                <div className="bg-gray-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                  Extract data
                </div>
                <div className="w-2 h-2 bg-gray-900 rotate-45 rounded-sm mx-auto -mt-1" />
              </div>
            )}
          </div>
        </div>

        {/* ── Loading card portal ── */}
        {pdfLoading && typeof document !== 'undefined' && createPortal(
          <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3.5 px-4 py-3.5 bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xs w-full">
            {/* Animated rings */}
            <div className="relative w-10 h-10 shrink-0">
              <div className="absolute inset-0 rounded-full border-[3px] border-red-100" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-red-500 animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-[3px] border-transparent border-t-orange-400 animate-spin [animation-direction:reverse] [animation-duration:700ms]" />
              <div className="absolute inset-[7px] rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-800 leading-snug">Extracting data…</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{att.filename}</p>
              {/* Progress shimmer */}
              <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-400 to-orange-400 rounded-full animate-pulse" style={{ width: '65%' }} />
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Error toast portal ── */}
        <AnimatePresence>
          {pdfError && typeof document !== 'undefined' && createPortal(
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-start gap-3 px-4 py-3.5 bg-red-600 text-white rounded-2xl shadow-2xl max-w-sm w-full mx-4"
            >
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold leading-snug">Extraction Failed</p>
                <p className="text-[11px] text-red-100 mt-0.5 leading-relaxed">{pdfError}</p>
              </div>
              <button
                onClick={() => setPdfError(null)}
                className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center shrink-0 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </motion.div>,
            document.body
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEditModal && extractedRows.length > 0 && (
            <TrilogyEditModal
              rows={extractedRows}
              headers={extractedHeaders}
              initialRowIndex={0}
              onClose={() => setShowEditModal(false)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all disabled:opacity-60 group w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px]"
    >
      <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconClr} flex items-center justify-center shrink-0`}>
        {loading ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
        ) : isImage ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <p className="text-[12.5px] font-semibold text-gray-800 truncate leading-tight">{att.filename}</p>
        {att.size_bytes ? <p className="text-[11px] text-gray-400 mt-0.5">{formatBytes(att.size_bytes)}</p> : null}
      </div>

      <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
    </button>
  );
}

function MessageCard({ msg, token, defaultOpen, onCreateBooking, bookingAlreadyCreated }: { msg: EmailMessage; token: string | null; defaultOpen: boolean; onCreateBooking?: () => void; bookingAlreadyCreated?: boolean }) {
  const isInbound = msg.direction === 'inbound';
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const [resolvedHtml, setResolvedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (collapsed || !msg.body_html || !/cid:/i.test(msg.body_html)) return;
    if (resolvedHtml !== null) return;
    let cancelled = false;
    (async () => {
      let html = msg.body_html!;
      const seen = new Set<string>();
      const cidRe = /cid:([^"'\s>]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = cidRe.exec(html)) !== null) seen.add(m[1]);
      for (const cid of seen) {
        const filename = cid.split('@')[0];
        const att = msg.attachments.find(a => a.filename.toLowerCase() === filename.toLowerCase());
        if (!att) continue;
        try {
          const res = await fetch(`${API_BASE}/email-attachments/${att.id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) continue;
          const { url } = await res.json();
          const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          html = html.replace(new RegExp(`cid:${escaped}`, 'gi'), url);
        } catch { /* leave cid: in place */ }
      }
      if (!cancelled) setResolvedHtml(html);
    })();
    return () => { cancelled = true; };
  }, [collapsed, msg.body_html, msg.attachments, token, resolvedHtml]);

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
          {isInbound && bookingAlreadyCreated && (
            <span
              title="A booking has already been created from this email"
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed select-none"
            >
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Booking Created
            </span>
          )}
          {isInbound && !bookingAlreadyCreated && onCreateBooking && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onCreateBooking(); }}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
            >
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Booking
            </button>
          )}
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
                    dangerouslySetInnerHTML={{ __html: splitHtmlQuotedContent(resolvedHtml ?? msg.body_html).main }}
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
                      dangerouslySetInnerHTML={{ __html: resolvedHtml ?? msg.body_html }}
                    />
                  ) : (
                    <div
                      className="prose prose-sm max-w-none text-gray-700 [&_*]:max-w-full [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: splitHtmlQuotedContent(resolvedHtml ?? msg.body_html).main }}
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
  onSendSuccess?: (daNumber: string, description: string) => void;
  onCreateBookingFromReply?: (msg: EmailMessage) => void;
  bookedMessageIds?: Set<string>;
  newestFirst?: boolean;
  readOnly?: boolean;
  onAccountCodeSelected?: (code: string | null) => void;
  hasAgent?: boolean;
  agents?: Agent[];
  onAssignAgent?: (agentId: string) => Promise<void>;
}

function extractDaDetails(text: string): { daNumber: string; description: string } {
  const jobMatch   = text.match(/job\s*number\s*:\s*([^\n\r]+)/i);
  const refMatch   = text.match(/customer\s+reference\s*:\s*([^\n\r]+)/i);
  const codeMatch  = text.match(/account\s+code\s*:\s*([^\n\r]+)/i);

  const daNumber = jobMatch  ? jobMatch[1].trim()  : '';
  const ref      = refMatch  ? refMatch[1].trim()  : '';
  const code     = codeMatch ? codeMatch[1].trim() : '';

  let description = '';
  if (ref && code)   description = `Customer reference is ${ref} and account code is ${code}.`;
  else if (ref)      description = `Customer reference is ${ref}.`;
  else if (code)     description = `Account code is ${code}.`;

  return { daNumber, description };
}

export default function EmailThread({ bookingId, senderEmail, replyRef, composeTab: controlledTab, onComposeTabChange, onSendSuccess, onCreateBookingFromReply, bookedMessageIds, newestFirst = true, readOnly = false, onAccountCodeSelected, hasAgent = true, agents = [], onAssignAgent }: Props) {
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const currentUser  = useSelector((s: RootState) => s.auth.user);
  const { data: messages = [], isLoading } = useGetMessagesQuery(bookingId, { pollingInterval: 20000 });
  const [replyMessage, { isLoading: sending }] = useReplyMessageMutation();
  const [syncEmails, { isLoading: syncing }] = useSyncEmailsMutation();
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [internalTab, setInternalTab] = useState<ComposeTab>('Reply');
  const composeTab = controlledTab ?? internalTab;
  const setComposeTab = (t: ComposeTab) => { setInternalTab(t); onComposeTabChange?.(t); };

  const sortedMessages = [...messages].sort((a, b) => {
    const diff = new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime();
    return newestFirst ? diff : -diff;
  });

  const firstInboundId = useMemo(() => {
    const byTime = [...messages].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
    return byTime.find(m => m.direction === 'inbound')?.id ?? null;
  }, [messages]);

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
    const tooBig = files.filter(f => f.size > MAX_ATTACH_BYTES);
    if (tooBig.length > 0) {
      setSendError(`File too large: ${tooBig.map(f => f.name).join(', ')}. Maximum attachment size is 20 MB.`);
      return;
    }
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
  const [showAccountPickerToolbar, setShowAccountPickerToolbar] = useState(false);
  const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);

  // Agent-required gate
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [pendingFd, setPendingFd] = useState<FormData | null>(null);
  const [pickedAgentId, setPickedAgentId] = useState('');
  const [assigningSend, setAssigningSend] = useState(false);
  const [agentDropOpen, setAgentDropOpen] = useState(false);
  const accountPickerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!showAccountPickerToolbar) return;
    const handler = (e: MouseEvent) => {
      if (!accountPickerRef.current?.contains(e.target as Node))
        setShowAccountPickerToolbar(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAccountPickerToolbar]);

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
    const tooBig = files.filter(f => f.size > MAX_ATTACH_BYTES);
    if (tooBig.length > 0) {
      setSendError(`File too large: ${tooBig.map(f => f.name).join(', ')}. Maximum attachment size is 20 MB.`);
      return;
    }
    if (files.length > 0) setSelectedFiles(prev => [...prev, ...files]);
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

  const executeSend = async (fd: FormData, bodyText: string) => {
    try {
      const result = await replyMessage({ bookingId, formData: fd });
      if (!result) { setSendError('No response from server. Please try again.'); return; }
      if ('error' in result) {
        const raw = (result.error as { data?: { detail?: string } })?.data?.detail ?? '';
        let errMsg = 'Failed to send. Please try again.';
        if (raw) {
          if (/InvalidRecipients?/i.test(raw) || /recipient.*not.*resolved/i.test(raw))
            errMsg = 'One or more email addresses are invalid or could not be resolved. Please check the recipients.';
          else if (/Unauthorized|401/i.test(raw))
            errMsg = 'Session expired. Please refresh and try again.';
          else if (!raw.startsWith('{'))
            errMsg = raw.length <= 300 ? raw : raw.slice(0, 297) + '…';
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
      if (onSendSuccess) {
        const { daNumber, description } = extractDaDetails(bodyText);
        if (daNumber) onSendSuccess(daNumber, description);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error. Please try again.';
      setSendError(msg);
    }
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
      const pending = toInput.trim() ? toInput.split(',').map(s => s.trim()).filter(Boolean) : [];
      const filteredBase = baseToEmails.filter(e => !removedBaseEmails.has(e));
      const allTo = [...filteredBase, ...extraToChips, ...pending];
      if (allTo.length === 0) { setSendError('Please add at least one recipient in the To field.'); return; }
      fd.append('to_emails', allTo.join(', '));
    }
    const pendingCc = ccInput.trim() ? ccInput.split(',').map(s => s.trim()).filter(Boolean) : [];
    const allCc = [...ccChips, ...pendingCc];
    if (allCc.length > 0) fd.append('cc_emails', allCc.join(', '));

    if (!hasAgent && onAssignAgent && agents.length > 0) {
      setPendingFd(fd);
      setPickedAgentId(agents[0]?.id ?? '');
      setShowAgentModal(true);
      return;
    }

    await executeSend(fd, text);
  };

  const handleAgentModalConfirm = async () => {
    if (!pendingFd || !pickedAgentId || !onAssignAgent) return;
    setAssigningSend(true);
    try {
      await onAssignAgent(pickedAgentId);
      const text = pendingFd.get('body_text') as string ?? '';
      await executeSend(pendingFd, text);
      setShowAgentModal(false);
      setPendingFd(null);
    } finally {
      setAssigningSend(false);
    }
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

  const handleAccountCodeSelect = (code: string) => {
    const el = editorRef.current;
    if (el) {
      const original = el.innerHTML;
      let replaced = original.replace(
        /(Your Account Code:[^<]{0,30})&lt;_+&gt;/i,
        `$1${code}`
      );
      if (replaced === original) {
        replaced = original.replace(
          /(Your Account Code:\s*)[^<\r\n]*/i,
          `$1${code}`
        );
      }
      if (replaced !== original) {
        el.innerHTML = replaced;
      } else {
        el.focus();
        try { document.execCommand('insertText', false, code); } catch { }
      }
      setEditorEmpty(!el.innerText.trim());
    }
    setSelectedAccountCode(code);
    onAccountCodeSelected?.(code);
    setShowAccountPickerToolbar(false);
  };


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
    <>
    <div className="space-y-3">
      {/* Full-screen sending overlay — blocks all interaction during API call */}
      {sending && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-white rounded-2xl shadow-2xl px-10 py-8">
            {/* Orbital spinner */}
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-4 border-transparent border-t-violet-400 animate-spin [animation-direction:reverse] [animation-duration:600ms]" />
              <div className="absolute inset-3 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 tracking-wide">Sending…</p>
              <p className="text-xs text-gray-400 mt-0.5">Please wait while your message is being sent</p>
            </div>
          </div>
        </div>
      )}

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
          {sortedMessages.map((msg, i) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              token={accessToken}
              defaultOpen={i === 0}
              bookingAlreadyCreated={msg.direction === 'inbound' && msg.id !== firstInboundId && !!bookedMessageIds?.has(msg.id)}
              onCreateBooking={
                msg.direction === 'inbound' && msg.id !== firstInboundId && onCreateBookingFromReply && !bookedMessageIds?.has(msg.id)
                  ? () => onCreateBookingFromReply(msg)
                  : undefined
              }
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
                              const filled = t.body.replace(/(Thanks and Best Regards,?\s*\n)(<_+>)?/gi, `$1${currentUser?.name ?? ''}`);
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

            {/* Account code picker — toolbar button (floats upward) */}
            <div className="relative" ref={accountPickerRef}>
              <button
                type="button"
                onClick={() => { setShowAccountPickerToolbar(p => !p); setShowTemplatePicker(false); }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border rounded-lg transition-all ${
                  selectedAccountCode
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                    : showAccountPickerToolbar
                      ? 'border-emerald-300 text-emerald-700 bg-emerald-50/60'
                      : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/40'
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                </svg>
                {selectedAccountCode
                  ? <><span className="opacity-70 font-normal">Account Code:</span><span className="font-mono font-bold ml-1">{selectedAccountCode}</span><span className="ml-0.5 text-emerald-400">✓</span></>
                  : 'Account Codes'
                }
              </button>
              <AnimatePresence>
                {showAccountPickerToolbar && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                  >
                    <AccountCodePicker
                      onSelect={code => handleAccountCodeSelect(code)}
                      onClose={() => setShowAccountPickerToolbar(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                sending || assigningSend
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

    {/* ── Assign-agent gate modal ────────────────────────────── */}
    {typeof window !== 'undefined' && createPortal(
      <AnimatePresence>
        {showAgentModal && (
        <motion.div
          key="agent-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ background: 'rgba(15,15,25,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAgentModal(false); }}
        >
          <motion.div
            key="agent-modal-card"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm mx-4 overflow-hidden"
          >
            {/* Top accent */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />

            <div className="px-5 pt-4 pb-5">
              {/* Icon + title */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-amber-500 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900 leading-tight">No agent assigned</h3>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
                    Assign an agent before sending. The booking will be updated automatically.
                  </p>
                </div>
              </div>

              {/* Agent inline list */}
              {(() => {
                const activeAgents = agents.filter(a => a.is_active);
                const AGENT_COLORS = ['bg-violet-500','bg-indigo-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-pink-500'];
                const agentColor = (id: string) => AGENT_COLORS[Math.abs(id.split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % AGENT_COLORS.length];
                return (
                  <div className="mb-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Select Agent</p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-[220px] overflow-y-auto">
                      {activeAgents.map(a => {
                        const isSelected = a.id === pickedAgentId;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setPickedAgentId(a.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                          >
                            <span className={`w-7 h-7 rounded-lg ${agentColor(a.id)} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                              {a.name.charAt(0).toUpperCase()}
                            </span>
                            <span className={`flex-1 text-[13px] font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>{a.name}</span>
                            {a.shift && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                                {a.shift.name}
                              </span>
                            )}
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAgentModal(false)}
                  disabled={assigningSend}
                  className="flex-1 py-2 text-[12px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={handleAgentModalConfirm}
                  disabled={!pickedAgentId || assigningSend}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2 text-[12px] font-bold text-white rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                >
                  {assigningSend ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Assigning…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Assign & Send
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}
