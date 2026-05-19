'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerRow } from '@/lib/animations';

export interface ColumnDef<T extends object = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface TableProps<T extends object> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey?: (row: T, i: number) => string;
  emptyMessage?: string;
}

type SortDir = 'asc' | 'desc' | null;

export default function Table<T extends object>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No records found.',
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  /* close filter popover on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-filter-wrap]')) {
        setActiveFilter(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir(null); }
  };

  const setFilter = (key: string, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  const clearFilter = (key: string) =>
    setFilters(prev => ({ ...prev, [key]: '' }));

  const clearAll = () => setFilters({});

  const activeFilterKeys = Object.entries(filters).filter(([, v]) => v.trim());

  const processed = useMemo(() => {
    let rows = [...data];

    // column filters
    for (const [key, val] of activeFilterKeys) {
      const v = val.toLowerCase();
      rows = rows.filter(row =>
        String((row as Record<string, unknown>)[key] ?? '').toLowerCase().includes(v)
      );
    }

    // sort
    if (sortKey && sortDir) {
      rows.sort((a, b) => {
        const av = String((a as Record<string, unknown>)[sortKey] ?? '');
        const bv = String((b as Record<string, unknown>)[sortKey] ?? '');
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filters, sortKey, sortDir]);

  return (
    <div className="w-full">
      {/* Active filter chips */}
      <AnimatePresence>
        {activeFilterKeys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-2 flex items-center gap-2 flex-wrap bg-indigo-50/70 border-b border-indigo-100 overflow-hidden"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Filters:</span>
            {activeFilterKeys.map(([key, val]) => {
              const col = columns.find(c => c.key === key);
              return (
                <motion.span
                  key={key}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-full"
                >
                  {col?.header}: <b>{val}</b>
                  <button onClick={() => clearFilter(key)} className="ml-0.5 hover:text-red-500 font-bold leading-none">×</button>
                </motion.span>
              );
            })}
            <button onClick={clearAll} className="text-[11px] text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors">
              Clear all
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70">
            {columns.map((col, colIdx) => {
              const isSorted = sortKey === col.key;
              const hasFilter = !!filters[col.key];

              return (
                <th
                  key={`${col.key}-${colIdx}`}
                  style={col.width ? { width: col.width } : undefined}
                  className="text-left px-4 py-2.5"
                >
                  <div className="flex items-center gap-1">
                    {/* Sort trigger */}
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors select-none ${
                          isSorted ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'
                        }`}
                      >
                        {col.header}
                        <span className="flex flex-col -space-y-0.5 ml-0.5">
                          <svg viewBox="0 0 10 6" className={`w-2 h-2 ${isSorted && sortDir === 'asc' ? 'text-indigo-600' : 'text-gray-300'}`} fill="currentColor">
                            <path d="M0 6l5-6 5 6z"/>
                          </svg>
                          <svg viewBox="0 0 10 6" className={`w-2 h-2 ${isSorted && sortDir === 'desc' ? 'text-indigo-600' : 'text-gray-300'}`} fill="currentColor">
                            <path d="M0 0l5 6 5-6z"/>
                          </svg>
                        </span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 select-none">
                        {col.header}
                      </span>
                    )}

                    {/* Filter trigger */}
                    {col.filterable && (
                      <div className="relative" data-filter-wrap="true">
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setActiveFilter(activeFilter === col.key ? null : col.key)}
                          className={`p-0.5 rounded transition-colors ${
                            hasFilter || activeFilter === col.key
                              ? 'text-indigo-600 bg-indigo-100'
                              : 'text-gray-300 hover:text-indigo-400 hover:bg-indigo-50'
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                          </svg>
                        </motion.button>

                        <AnimatePresence>
                          {activeFilter === col.key && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -4 }}
                              transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 min-w-44"
                              data-filter-wrap="true"
                            >
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                Filter: {col.header}
                              </p>
                              <input
                                autoFocus
                                type="text"
                                value={filters[col.key] ?? ''}
                                onChange={e => setFilter(col.key, e.target.value)}
                                placeholder={`Search ${col.header}…`}
                                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                              />
                              {filters[col.key] && (
                                <button
                                  onClick={() => { clearFilter(col.key); setActiveFilter(null); }}
                                  className="mt-2 w-full text-[11px] font-semibold text-gray-400 hover:text-red-500 text-center transition-colors"
                                >
                                  Clear filter
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          <AnimatePresence>
            {processed.map((row, i) => (
              <motion.tr
                key={rowKey ? rowKey(row, i) : i}
                variants={staggerRow}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
                custom={i}
                whileHover={{ backgroundColor: '#f9f8ff' }}
                className="transition-colors"
              >
                {columns.map((col, colIdx) => {
                  const value = (row as Record<string, unknown>)[col.key];
                  return (
                    <td key={`${col.key}-${colIdx}`} className="px-4 py-2.5 text-sm text-gray-700">
                      {col.render ? col.render(value, row) : String(value ?? '—')}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>

      {processed.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-10 text-center text-sm text-gray-400 font-medium"
        >
          {emptyMessage}
        </motion.div>
      )}
    </div>
  );
}
