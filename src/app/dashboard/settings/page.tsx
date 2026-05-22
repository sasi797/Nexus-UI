'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetShiftsQuery, useCreateShiftMutation, useDeleteShiftMutation, Shift } from '@/services/shiftsApi';
import { useGetAgentsQuery, useCreateAgentMutation, useDeleteAgentMutation, useUpdateAgentMutation } from '@/services/agentsApi';

type SettingsTab = 'General' | 'Shifts' | 'Users' | 'Roles' | 'Transport API' | 'Email Templates';
const settingsTabs: SettingsTab[] = ['General', 'Shifts', 'Users', 'Roles', 'Transport API', 'Email Templates'];

const roles = [
  { name: 'Admin',  permissions: 'Full access',                   users: 1, icon: '👑' },
  { name: 'Agent',  permissions: 'Bookings, Attendance, Reports', users: 4, icon: '🧑‍💼' },
  { name: 'Viewer', permissions: 'Reports only',                  users: 0, icon: '👁️' },
];
const avatarGrads = ['from-indigo-500 to-violet-500','from-sky-500 to-blue-500','from-emerald-500 to-teal-500','from-rose-400 to-pink-400','from-amber-500 to-orange-500'];

function SettingsDropdown({ value, options, onChange, placeholder }: {
  value: string; options: { label: string; value: string }[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-medium bg-white border rounded-lg transition-all ${
          open ? 'border-indigo-400 ring-2 ring-indigo-100 text-gray-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'
        }`}>
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected?.label ?? placeholder ?? 'Select…'}</span>
        <svg className={`w-3 h-3 text-gray-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-[60] overflow-hidden">
            {options.map(opt => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                  value === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <span className="flex-1">{opt.label}</span>
                {value === opt.value && (
                  <svg className="w-3 h-3 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('Shifts');
  const [showAdd, setShowAdd] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', code: '', start_time: '', end_time: '' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', email: '', password: '', role: 'agent', shift_id: '' });
  const [apiUrl, setApiUrl] = useState('https://api.transport.example.com/v2');
  const [savedGeneral, setSavedGeneral] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', shift_id: '' });
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const { data: shifts = [], isLoading: shiftsLoading } = useGetShiftsQuery();
  const { data: agents = [], isLoading: agentsLoading, isFetching: agentsFetching } = useGetAgentsQuery();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [createAgent, { isLoading: creatingAgent }] = useCreateAgentMutation();
  const [deleteAgent] = useDeleteAgentMutation();
  const [updateAgent, { isLoading: updatingAgent }] = useUpdateAgentMutation();

  const startEdit = (a: { id: string; name: string; email: string; shift_id: string | null }) => {
    setEditingAgentId(a.id);
    setEditForm({ name: a.name, email: a.email, shift_id: a.shift_id ?? '' });
  };

  const handleSaveAgent = async () => {
    if (!editingAgentId) return;
    await updateAgent({ id: editingAgentId, body: { name: editForm.name, email: editForm.email, shift_id: editForm.shift_id || undefined } });
    setEditingAgentId(null);
  };

  const handleAddShift = async () => {
    if (!newShift.name || !newShift.code) return;
    await createShift(newShift);
    setNewShift({ name: '', code: '', start_time: '', end_time: '' });
    setShowAdd(false);
  };

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.email || !newAgent.password) return;
    await createAgent({ name: newAgent.name, email: newAgent.email, password: newAgent.password, role: newAgent.role, shift_id: newAgent.shift_id || undefined });
    setNewAgent({ name: '', email: '', password: '', role: 'agent', shift_id: '' });
    setShowAddUser(false);
  };

  const shiftColumns: ColumnDef<Shift>[] = [
    { key: 'name',       header: 'Shift Name', sortable: true, filterable: true, render: v => <span className="font-bold text-gray-800">{String(v)}</span> },
    { key: 'code',       header: 'Code',       render: v => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-mono font-bold ring-1 ring-indigo-100">{String(v)}</span> },
    { key: 'start_time', header: 'Start Time', sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
    { key: 'end_time',   header: 'End Time',   sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
    {
      key: 'id', header: 'Actions', width: '80px',
      render: (v) => (
        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => deleteShift(String(v))}
          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </motion.button>
      ),
    },
  ];

  const inputSm = 'px-2 py-1 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full';

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3">
      {/* <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Settings</motion.h1> */}

      <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        {/* Tabs */}
        <div className="px-4 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
          {settingsTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative whitespace-nowrap px-3 py-2.5 text-xs font-bold transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-700'}`}>
              {tab}
              {activeTab === tab && <motion.div layoutId="settings-tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

            {activeTab === 'Shifts' && (
              <div>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700">Shift Configuration</p>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(p => !p)}
                    className="text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                    + Add Shift
                  </motion.button>
                </div>
                <AnimatePresence>
                  {showAdd && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                      className="px-4 py-3 border-b border-gray-100">
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { key: 'name', placeholder: 'Shift Name' },
                          { key: 'code', placeholder: 'Code (e.g. MOR)' },
                          { key: 'start_time', placeholder: 'Start (HH:MM)', type: 'time' },
                          { key: 'end_time', placeholder: 'End (HH:MM)', type: 'time' },
                        ].map(f => (
                          <input key={f.key} type={f.type ?? 'text'} placeholder={f.placeholder}
                            value={(newShift as Record<string, string>)[f.key]}
                            onChange={e => setNewShift(p => ({ ...p, [f.key]: e.target.value }))}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <motion.button whileHover={{ scale: 1.02 }} onClick={handleAddShift} disabled={creating}
                          className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                          {creating ? 'Adding...' : 'Add'}
                        </motion.button>
                        <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {shiftsLoading
                  ? <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
                  : <Table columns={shiftColumns} data={shifts} rowKey={r => r.id} />}
              </div>
            )}

            {activeTab === 'Users' && (
              <div>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700">User Management</p>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddUser(p => !p)}
                    className="text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                    + Add Employee
                  </motion.button>
                </div>
                <AnimatePresence>
                  {showAddUser && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                      className="px-4 py-3 border-b border-gray-100">
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" placeholder="Full Name" value={newAgent.name}
                          onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                        <input type="email" placeholder="Email Address" value={newAgent.email}
                          onChange={e => setNewAgent(p => ({ ...p, email: e.target.value }))}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                        <input type="password" placeholder="Password" value={newAgent.password}
                          onChange={e => setNewAgent(p => ({ ...p, password: e.target.value }))}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <SettingsDropdown
                          value={newAgent.role}
                          options={[{ label: 'Agent', value: 'agent' }, { label: 'Supervisor', value: 'supervisor' }, { label: 'Admin', value: 'admin' }]}
                          onChange={v => setNewAgent(p => ({ ...p, role: v }))}
                        />
                        <SettingsDropdown
                          value={newAgent.shift_id}
                          placeholder="No Shift"
                          options={[{ label: 'No Shift', value: '' }, ...shifts.map(s => ({ label: s.name, value: s.id }))]}
                          onChange={v => setNewAgent(p => ({ ...p, shift_id: v }))}
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <motion.button whileHover={{ scale: 1.02 }} onClick={handleAddAgent} disabled={creatingAgent}
                          className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-60">
                          {creatingAgent ? 'Adding...' : 'Add Employee'}
                        </motion.button>
                        <button onClick={() => setShowAddUser(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {(agentsLoading || agentsFetching) ? (
                  <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_auto] gap-3 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>Name</span><span>Email</span><span>Shift</span><span>Status</span><span className="w-16" />
                    </div>
                    <AnimatePresence>
                      {agents.map((a, i) => (
                        <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="grid grid-cols-[2fr_2fr_1.5fr_1fr_auto] gap-3 items-center px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                          {editingAgentId === a.id ? (
                            <>
                              <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputSm} placeholder="Full Name" />
                              <input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={inputSm} placeholder="Email" type="email" />
                              <SettingsDropdown
                                value={editForm.shift_id}
                                placeholder="No Shift"
                                options={[{ label: 'No Shift', value: '' }, ...shifts.map(s => ({ label: s.name, value: s.id }))]}
                                onChange={v => setEditForm(p => ({ ...p, shift_id: v }))}
                              />
                              <span />
                              <div className="flex items-center gap-1 w-16">
                                <motion.button whileTap={{ scale: 0.93 }} onClick={handleSaveAgent} disabled={updatingAgent}
                                  className="text-[10px] font-bold px-2 py-1 bg-indigo-600 text-white rounded-md disabled:opacity-60">
                                  {updatingAgent ? '…' : 'Save'}
                                </motion.button>
                                <button onClick={() => setEditingAgentId(null)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${avatarGrads[i % avatarGrads.length]} flex items-center justify-center text-white text-[10px] font-black shadow shrink-0`}>
                                  {a.name.charAt(0)}
                                </div>
                                <span className="font-semibold text-gray-800 text-xs truncate">{a.name}</span>
                              </div>
                              <span className="text-xs text-gray-400 truncate">{a.email}</span>
                              <span className="text-xs">
                                {a.shift ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold ring-1 ring-indigo-100">{a.shift.name}</span> : <span className="text-gray-300">—</span>}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 w-fit">Active</span>
                              <div className="flex items-center gap-1 w-16">
                                <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(a)}
                                  className="p-1 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-colors" title="Edit">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                  </svg>
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: deactivatingId === a.id ? 1 : 1.15 }} whileTap={{ scale: 0.9 }}
                                  disabled={deactivatingId === a.id}
                                  onClick={async () => { setDeactivatingId(a.id); await deleteAgent(a.id); setDeactivatingId(null); }}
                                  className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-60" title="Deactivate">
                                  {deactivatingId === a.id
                                    ? <svg className="w-3.5 h-3.5 animate-spin text-red-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                                  }
                                </motion.button>
                              </div>
                            </>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {agents.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No active users</p>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'General' && (
              <div className="p-5 space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">System Name</label>
                  <input defaultValue="Bookings to Ticket System" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Timezone</label>
                  <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option>Asia/Kolkata (IST)</option><option>UTC</option><option>America/New_York</option>
                  </select>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} onClick={() => { setSavedGeneral(true); setTimeout(() => setSavedGeneral(false), 2000); }}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-md">
                  {savedGeneral ? '✓ Saved!' : 'Save Settings'}
                </motion.button>
              </div>
            )}

            {activeTab === 'Transport API' && (
              <div className="p-5 space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">API Endpoint</label>
                  <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">API Key</label>
                  <input type="password" defaultValue="sk-••••••••••••••••" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <motion.button whileHover={{ scale: 1.02 }} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-md">
                  Save API Config
                </motion.button>
              </div>
            )}

            {activeTab === 'Roles' && (
              <div className="p-4 grid grid-cols-3 gap-3">
                {roles.map(r => (
                  <motion.div key={r.name} whileHover={{ scale: 1.02 }} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                    <div className="text-xl mb-2">{r.icon}</div>
                    <p className="text-sm font-bold text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.permissions}</p>
                    <p className="text-[11px] text-indigo-600 font-bold mt-2">{r.users} user{r.users !== 1 ? 's' : ''}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === 'Email Templates' && (
              <div className="p-5 text-center py-10">
                <div className="text-3xl mb-2">📧</div>
                <p className="text-sm font-semibold text-gray-400">Email templates coming soon</p>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}