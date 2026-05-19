'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem, staggerContainer } from '@/lib/animations';
import { useGetShiftsQuery, useCreateShiftMutation, useDeleteShiftMutation, Shift } from '@/services/shiftsApi';
import { useGetAgentsQuery } from '@/services/agentsApi';

type SettingsTab = 'General' | 'Shifts' | 'Users' | 'Roles' | 'Transport API' | 'Email Templates';
const settingsTabs: SettingsTab[] = ['General', 'Shifts', 'Users', 'Roles', 'Transport API', 'Email Templates'];

const roles = [
  { name: 'Admin',  permissions: 'Full access',                   users: 1, icon: '👑' },
  { name: 'Agent',  permissions: 'Bookings, Attendance, Reports', users: 4, icon: '🧑‍💼' },
  { name: 'Viewer', permissions: 'Reports only',                  users: 0, icon: '👁️' },
];
const avatarGrads = ['from-indigo-500 to-violet-500','from-sky-500 to-blue-500','from-emerald-500 to-teal-500','from-rose-400 to-pink-400','from-amber-500 to-orange-500'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('Shifts');
  const [showAdd, setShowAdd] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', code: '', start_time: '', end_time: '' });
  const [apiUrl, setApiUrl] = useState('https://api.transport.example.com/v2');
  const [savedGeneral, setSavedGeneral] = useState(false);

  const { data: shifts = [], isLoading: shiftsLoading } = useGetShiftsQuery();
  const { data: agents = [], isLoading: agentsLoading } = useGetAgentsQuery();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();

  const handleAddShift = async () => {
    if (!newShift.name || !newShift.code) return;
    await createShift(newShift);
    setNewShift({ name: '', code: '', start_time: '', end_time: '' });
    setShowAdd(false);
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

  interface AgentRow { id: string; name: string; email: string; shift: string; status: string; gradIdx: number }
  const agentRows: AgentRow[] = agents.map((a, i) => ({
    id: a.id, name: a.name, email: a.email, shift: a.shift?.name ?? '—', status: 'Active', gradIdx: i,
  }));
  const userColumns: ColumnDef<AgentRow>[] = [
    {
      key: 'name', header: 'Name', sortable: true, filterable: true,
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.1 }} className={`w-6 h-6 rounded-lg bg-gradient-to-br ${avatarGrads[(row as AgentRow).gradIdx % avatarGrads.length]} flex items-center justify-center text-white text-[10px] font-black shadow`}>
            {String(v).charAt(0)}
          </motion.div>
          <span className="font-semibold text-gray-800">{String(v)}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email',  sortable: true, filterable: true, render: v => <span className="text-gray-400">{String(v)}</span> },
    { key: 'shift', header: 'Shift',  sortable: true, filterable: true, render: v => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold ring-1 ring-indigo-100">{String(v)}</span> },
    { key: 'status', header: 'Status', sortable: true, render: v => <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{String(v)}</span> },
  ];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3">
      <motion.h1 variants={staggerItem} className="text-lg font-bold text-gray-900">Settings</motion.h1>

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
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="px-4 py-3 border-b border-gray-100 overflow-hidden">
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
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-700">User Management</p>
                </div>
                {agentsLoading
                  ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
                  : <Table columns={userColumns} data={agentRows} rowKey={r => r.id} />}
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