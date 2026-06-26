'use client';
import { useState, useEffect, useRef } from 'react';
import { useGetAccountCodesQuery, type AccountCode } from '@/services/accountCodesApi';

interface Props {
  onSelect: (code: string) => void;
  onClose:  () => void;
  /** 'up' opens upward from toolbar button; 'down' opens downward from action-bar button */
  direction?: 'up' | 'down';
}

export default function AccountCodePicker({ onSelect, onClose, direction = 'up' }: Props) {
  const [query,    setQuery]    = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useGetAccountCodesQuery(debounced || undefined);

  const posClass = direction === 'down'
    ? 'absolute top-full left-0 mt-2 w-[420px] z-50'
    : 'absolute bottom-full left-0 mb-2 w-[420px] z-50';

  return (
    <div className={`${posClass} bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[360px]`}>
      <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Account Code Lookup</p>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search by code, name or site…"
            className="w-full pl-8 pr-8 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700 placeholder:text-gray-300"
          />
          {isFetching && (
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {results.length === 0 && !isFetching ? (
          <p className="text-center text-xs text-gray-400 py-6">
            {debounced ? 'No accounts found' : 'Type to search accounts…'}
          </p>
        ) : (
          results.map((a: AccountCode) => (
            <button
              key={a.code}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(a.code); }}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
            >
              <span className="font-mono text-[12px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded shrink-0 min-w-[80px] text-center">
                {a.code}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{a.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{a.site}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
