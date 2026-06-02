'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Table, { ColumnDef } from '@/components/Table';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetShiftsQuery, useCreateShiftMutation, useDeleteShiftMutation, Shift } from '@/services/shiftsApi';
import { useGetAgentsQuery, useCreateAgentMutation, useDeleteAgentMutation, useUpdateAgentMutation } from '@/services/agentsApi';
import { useGetRolesQuery, useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation } from '@/services/rolesApi';
import { useGetEmailTemplatesQuery, useCreateEmailTemplateMutation, useUpdateEmailTemplateMutation, useDeleteEmailTemplateMutation } from '@/services/emailTemplatesApi';
import {
  useGetBookingConfigQuery, useCreateBookingConfigMutation,
  useUpdateBookingConfigMutation, useDeleteBookingConfigMutation,
  AVAILABLE_COLORS, COLOR_MAP, BookingConfigItem,
} from '@/services/bookingConfigApi';

type SettingsSection = 'Shifts' | 'Users' | 'Roles' | 'Email Templates' | 'Bookings';

// ── Icons ───────────────────────────────────────────────────────────────────
const Icons: Record<string, React.ReactNode> = {
  Bookings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
    </svg>
  ),
  General: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  ),
  Users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  ),
  Shifts: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  ),
  Roles: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
    </svg>
  ),
  'Email Templates': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  ),
};

const sidebarNav: { group: string; items: { id: SettingsSection; label: string }[] }[] = [
  {
    group: 'Team',
    items: [
      { id: 'Users', label: 'Users' },
      { id: 'Shifts', label: 'Shifts' },
      { id: 'Roles', label: 'Roles' },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { id: 'Bookings', label: 'Bookings' },
    ],
  },
  {
    group: 'Integrations',
    items: [
      { id: 'Email Templates', label: 'Email Templates' },
    ],
  },
];

const sectionMeta: Record<SettingsSection, { title: string; description: string }> = {
  Shifts:            { title: 'Shifts',             description: 'Define work shifts and assign agents to them.' },
  Users:             { title: 'Users',              description: 'Manage your team members, roles and account access.' },
  Roles:             { title: 'Roles & Permissions',description: 'View role definitions and their associated permissions.' },
  'Email Templates': { title: 'Email Templates',    description: 'Customise automated email notifications sent to customers.' },
  Bookings:          { title: 'Booking Options',    description: 'Configure available tags, statuses, and priorities for bookings.' },
};

const roleColors: Record<string, { color: string; badge: string }> = {
  admin:      { color: 'from-violet-500 to-indigo-500', badge: 'bg-violet-50 text-violet-700 ring-violet-200' },
  agent:      { color: 'from-sky-500 to-blue-500',      badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
  supervisor: { color: 'from-emerald-500 to-teal-500',  badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  viewer:     { color: 'from-amber-500 to-orange-500',  badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
};
const defaultRoleColor = { color: 'from-gray-400 to-gray-500', badge: 'bg-gray-50 text-gray-700 ring-gray-200' };
const avatarGrads = ['from-indigo-500 to-violet-500','from-sky-500 to-blue-500','from-emerald-500 to-teal-500','from-rose-400 to-pink-400','from-amber-500 to-orange-500'];

// ── Custom Dropdown ──────────────────────────────────────────────────────────
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
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium bg-white border rounded-lg transition-all ${
          open ? 'border-indigo-400 ring-2 ring-indigo-100 text-gray-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'
        }`}>
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected?.label ?? placeholder ?? 'Select…'}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-[60]">
            {options.map(opt => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-between gap-2 first:rounded-t-xl last:rounded-b-xl ${
                  value === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <span className="flex-1">{opt.label}</span>
                {value === opt.value && (
                  <svg className="w-3.5 h-3.5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// ── Page ────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('Users');
  const [showAdd, setShowAdd] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', code: '', start_time: '', end_time: '' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', email: '', password: '', role: 'agent', shift_id: '' });
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', shift_id: '', role: 'agent' });
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', key: '', permissions: '' });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ name: '', key: '', permissions: '' });
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', body: '' });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState({ name: '', body: '' });
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const [bookingsTab, setBookingsTab] = useState<'tag' | 'status' | 'priority'>('tag');
  const [newConfigItem, setNewConfigItem] = useState({ value: '', label: '', color: 'sky' });
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editConfigForm, setEditConfigForm] = useState({ value: '', label: '', color: 'sky' });

  const { data: shifts = [], isLoading: shiftsLoading } = useGetShiftsQuery();
  const { data: agents = [], isLoading: agentsLoading, isFetching: agentsFetching } = useGetAgentsQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const { data: templates = [] } = useGetEmailTemplatesQuery();
  const { data: bookingConfig = [] } = useGetBookingConfigQuery();
  const [createConfig, { isLoading: creatingConfig }] = useCreateBookingConfigMutation();
  const [updateConfig, { isLoading: updatingConfig }] = useUpdateBookingConfigMutation();
  const [deleteConfig] = useDeleteBookingConfigMutation();
  const [createRole, { isLoading: creatingRole }] = useCreateRoleMutation();
  const [updateRole, { isLoading: updatingRole }] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();
  const [createEmailTemplate, { isLoading: creatingTemplate }] = useCreateEmailTemplateMutation();
  const [updateEmailTemplate, { isLoading: updatingTemplate }] = useUpdateEmailTemplateMutation();
  const [deleteEmailTemplate] = useDeleteEmailTemplateMutation();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [createAgent, { isLoading: creatingAgent }] = useCreateAgentMutation();
  const [deleteAgent] = useDeleteAgentMutation();
  const [updateAgent, { isLoading: updatingAgent }] = useUpdateAgentMutation();

  const startEdit = (a: { id: string; name: string; email: string; shift_id: string | null; role?: string }) => {
    setEditingAgentId(a.id);
    setEditForm({ name: a.name, email: a.email, shift_id: a.shift_id ?? '', role: a.role ?? 'agent' });
  };

  const handleSaveAgent = async () => {
    if (!editingAgentId) return;
    await updateAgent({ id: editingAgentId, body: { name: editForm.name, email: editForm.email, shift_id: editForm.shift_id || undefined, role: editForm.role } });
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
    { key: 'code',       header: 'Code',       render: v => <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-sm font-mono font-bold ring-1 ring-indigo-100">{String(v)}</span> },
    { key: 'start_time', header: 'Start Time', sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
    { key: 'end_time',   header: 'End Time',   sortable: true, render: v => <span className="font-medium text-gray-600">{String(v)}</span> },
    {
      key: 'id', header: 'Actions', width: '80px',
      render: (v) => (
        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => deleteShift(String(v))}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </motion.button>
      ),
    },
  ];

  const inputSm = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full';
  const meta = sectionMeta[activeSection];

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="h-full">
      <motion.div variants={staggerItem} className="flex flex-col md:flex-row bg-white rounded-xl shadow-sm border border-gray-100/80 min-h-[calc(100vh-7rem)]">

        {/* ── Sidebar ── */}
        <aside className="w-full md:w-56 md:shrink-0 border-b md:border-b-0 md:border-r border-gray-100 py-4 md:py-6 flex flex-col">
          {/* Brand mark */}
          <div className="px-5 mb-6 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-800">Settings</span>
          </div>

          <div className="flex flex-col gap-3 md:gap-5 px-3 overflow-x-auto md:overflow-visible">
            {sidebarNav.map(group => (
              <div key={group.group}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 px-2">{group.group}</p>
                <ul className="space-y-0.5">
                  {group.items.map(item => (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 font-medium ${
                          activeSection === item.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}>
                        <span className={activeSection === item.id ? 'text-indigo-500' : 'text-gray-400'}>
                          {Icons[item.id]}
                        </span>
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Section header */}
          <div className="px-4 md:px-8 pt-5 md:pt-7 pb-4 md:pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                {Icons[activeSection]}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{meta.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{meta.description}</p>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeSection} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1">

              {/* ── USERS ── */}
              {activeSection === 'Users' && (
                <div>
                  <div className="px-4 md:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500 font-medium">
                      {agents.length} member{agents.length !== 1 ? 's' : ''}
                    </p>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddUser(p => !p)}
                      className="text-sm font-semibold text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                      Add Employee
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {showAddUser && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        className="px-4 md:px-8 py-5 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">New Employee</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input type="text" placeholder="Full Name" value={newAgent.name}
                            onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                          <input type="email" placeholder="Email Address" value={newAgent.email}
                            onChange={e => setNewAgent(p => ({ ...p, email: e.target.value }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                          <input type="password" placeholder="Password" value={newAgent.password}
                            onChange={e => setNewAgent(p => ({ ...p, password: e.target.value }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <SettingsDropdown
                            value={newAgent.role}
                            options={roles.map(r => ({ label: r.name, value: r.key }))}
                            onChange={v => setNewAgent(p => ({ ...p, role: v }))}
                          />
                          <SettingsDropdown
                            value={newAgent.shift_id}
                            placeholder="No Shift"
                            options={[{ label: 'No Shift', value: '' }, ...shifts.map(s => ({ label: s.name, value: s.id }))]}
                            onChange={v => setNewAgent(p => ({ ...p, shift_id: v }))}
                          />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <motion.button whileHover={{ scale: 1.02 }} onClick={handleAddAgent} disabled={creatingAgent}
                            className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-lg disabled:opacity-60 flex items-center gap-1.5">
                            {creatingAgent
                              ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Adding…</>
                              : 'Add Employee'}
                          </motion.button>
                          <button onClick={() => setShowAddUser(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {(agentsLoading || agentsFetching) ? (
                    <div className="px-8 py-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
                  ) : (
                    <div className="divide-y divide-gray-50 overflow-x-auto">
                      <div className="grid grid-cols-[2.5fr_2fr_1.5fr_1fr_auto] gap-4 px-4 md:px-8 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[560px]">
                        <span>Name</span><span>Email</span><span>Shift</span><span>Status</span><span className="w-20" />
                      </div>
                      <AnimatePresence>
                        {agents.map((a, i) => (
                          <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="grid grid-cols-[2.5fr_2fr_1.5fr_1fr_auto] gap-4 items-center px-4 md:px-8 py-3.5 hover:bg-gray-50/60 transition-colors min-w-[560px]">
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
                                <SettingsDropdown
                                  value={editForm.role}
                                  options={roles.map(r => ({ label: r.name, value: r.key }))}
                                  onChange={v => setEditForm(p => ({ ...p, role: v }))}
                                />
                                <div className="flex items-center gap-2">
                                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleSaveAgent} disabled={updatingAgent}
                                    className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-60 transition-colors">
                                    {updatingAgent
                                      ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                                    }
                                    Save
                                  </motion.button>
                                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setEditingAgentId(null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                                  </motion.button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGrads[i % avatarGrads.length]} flex items-center justify-center text-white text-sm font-black shadow shrink-0`}>
                                    {a.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-800 text-sm truncate">{a.name}</p>
                                    <p className="text-xs text-gray-400 capitalize">{a.role}</p>
                                  </div>
                                </div>
                                <span className="text-sm text-gray-400 truncate">{a.email}</span>
                                <span>
                                  {a.shift
                                    ? <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold ring-1 ring-indigo-100">{a.shift.name}</span>
                                    : <span className="text-gray-300 text-sm">—</span>}
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 w-fit">Active</span>
                                <div className="flex items-center gap-1.5">
                                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => startEdit({ ...a, role: a.role })}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: deactivatingId === a.id ? 1 : 1.05 }} whileTap={{ scale: 0.95 }}
                                    disabled={deactivatingId === a.id}
                                    onClick={async () => { setDeactivatingId(a.id); await deleteAgent(a.id); setDeactivatingId(null); }}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60" title="Deactivate">
                                    {deactivatingId === a.id
                                      ? <svg className="w-5 h-5 animate-spin text-red-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                      : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    }
                                  </motion.button>
                                </div>
                              </>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {agents.length === 0 && (
                        <div className="py-16 text-center">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-300">
                            {Icons.Users}
                          </div>
                          <p className="text-sm font-medium text-gray-400">No active users</p>
                          <p className="text-xs text-gray-300 mt-1">Add your first team member above</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── SHIFTS ── */}
              {activeSection === 'Shifts' && (
                <div>
                  <div className="px-4 md:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500 font-medium">{shifts.length} shift{shifts.length !== 1 ? 's' : ''} configured</p>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(p => !p)}
                      className="text-sm font-semibold text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                      Add Shift
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {showAdd && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        className="px-4 md:px-8 py-5 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">New Shift</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { key: 'name', placeholder: 'Shift Name' },
                            { key: 'code', placeholder: 'Code (e.g. MOR)' },
                            { key: 'start_time', placeholder: 'Start Time', type: 'time' },
                            { key: 'end_time', placeholder: 'End Time', type: 'time' },
                          ].map(f => (
                            <input key={f.key} type={f.type ?? 'text'} placeholder={f.placeholder}
                              value={(newShift as Record<string, string>)[f.key]}
                              onChange={e => setNewShift(p => ({ ...p, [f.key]: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                          ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <motion.button whileHover={{ scale: 1.02 }} onClick={handleAddShift} disabled={creating}
                            className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-lg disabled:opacity-60">
                            {creating ? 'Adding...' : 'Add Shift'}
                          </motion.button>
                          <button onClick={() => setShowAdd(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {shiftsLoading
                    ? <div className="px-8 py-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
                    : <Table columns={shiftColumns} data={shifts} rowKey={r => r.id} />}
                </div>
              )}

              {/* ── ROLES ── */}
              {activeSection === 'Roles' && (
                <div>
                  {/* Header */}
                  <div className="px-4 md:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500 font-medium">{roles.length} role{roles.length !== 1 ? 's' : ''} defined</p>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setShowAddRole(p => !p); setEditingRoleId(null); }}
                      className="text-sm font-semibold text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                      Add Role
                    </motion.button>
                  </div>

                  {/* Add form */}
                  <AnimatePresence>
                    {showAddRole && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        className="px-4 md:px-8 py-5 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">New Role</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <input type="text" placeholder="Role Name (e.g. Manager)"
                              value={newRole.name}
                              onChange={e => {
                                const name = e.target.value;
                                setNewRole(p => ({ ...p, name, key: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }));
                              }}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                          </div>
                          <div>
                            <input type="text" placeholder="Key (e.g. manager)"
                              value={newRole.key}
                              onChange={e => setNewRole(p => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full font-mono" />
                          </div>
                          <div>
                            <input type="text" placeholder="Permissions description"
                              value={newRole.permissions}
                              onChange={e => setNewRole(p => ({ ...p, permissions: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={async () => {
                              if (!newRole.name || !newRole.key || !newRole.permissions) return;
                              await createRole(newRole);
                              setNewRole({ name: '', key: '', permissions: '' });
                              setShowAddRole(false);
                            }}
                            disabled={creatingRole || !newRole.name || !newRole.key || !newRole.permissions}
                            className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                            {creatingRole
                              ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Adding…</>
                              : 'Add Role'}
                          </motion.button>
                          <button onClick={() => setShowAddRole(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cards grid */}
                  <div className="px-4 md:px-8 py-6">
                    <div className="grid grid-cols-2 gap-4">
                      <AnimatePresence>
                        {roles.map(r => {
                          const { color, badge } = roleColors[r.key] ?? defaultRoleColor;

                          if (editingRoleId === r.id) {
                            return (
                              <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="border border-indigo-200 rounded-xl p-5 bg-indigo-50/30 shadow-sm">
                                <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Editing role</p>
                                <div className="space-y-2">
                                  <input type="text" placeholder="Role Name" value={editRoleForm.name}
                                    onChange={e => setEditRoleForm(p => ({ ...p, name: e.target.value }))}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                                  <input type="text" placeholder="Key" value={editRoleForm.key}
                                    onChange={e => setEditRoleForm(p => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full font-mono" />
                                  <input type="text" placeholder="Permissions description" value={editRoleForm.permissions}
                                    onChange={e => setEditRoleForm(p => ({ ...p, permissions: e.target.value }))}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={async () => {
                                      await updateRole({ id: r.id, body: editRoleForm });
                                      setEditingRoleId(null);
                                    }}
                                    disabled={updatingRole}
                                    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60 transition-colors">
                                    {updatingRole
                                      ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                                    }
                                    Save
                                  </motion.button>
                                  <button onClick={() => setEditingRoleId(null)}
                                    className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                                </div>
                              </motion.div>
                            );
                          }

                          return (
                            <motion.div key={r.id} layout whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
                              className="border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow group">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm shrink-0`}>
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-gray-800">{r.name}</p>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ring-1 ${badge}`}>
                                        {r.user_count} user{r.user_count !== 1 ? 's' : ''}
                                      </span>
                                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                        onClick={() => { setEditingRoleId(r.id); setEditRoleForm({ name: r.name, key: r.key, permissions: r.permissions }); setShowAddRole(false); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                      </motion.button>
                                      <motion.button whileHover={{ scale: deletingRoleId === r.id ? 1 : 1.1 }} whileTap={{ scale: 0.9 }}
                                        disabled={deletingRoleId === r.id}
                                        onClick={async () => { setDeletingRoleId(r.id); await deleteRole(r.id); setDeletingRoleId(null); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 opacity-0 group-hover:opacity-100">
                                        {deletingRoleId === r.id
                                          ? <svg className="w-3.5 h-3.5 animate-spin text-red-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        }
                                      </motion.button>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">{r.permissions}</p>
                                  <p className="text-[10px] font-mono text-gray-300 mt-1">{r.key}</p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}

              {/* ── EMAIL TEMPLATES ── */}
              {activeSection === 'Email Templates' && (
                <div>
                  {/* Header */}
                  <div className="px-4 md:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-500 font-medium">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setShowAddTemplate(p => !p); setEditingTemplateId(null); }}
                      className="text-sm font-semibold text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                      Add Template
                    </motion.button>
                  </div>

                  {/* Add form */}
                  <AnimatePresence>
                    {showAddTemplate && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        className="px-4 md:px-8 py-5 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">New Template</p>
                        <div className="space-y-3 max-w-2xl">
                          <input type="text" placeholder="Template name (e.g. Acknowledgement)"
                            value={newTemplate.name}
                            onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                          <textarea rows={4} placeholder="Template body…"
                            value={newTemplate.body}
                            onChange={e => setNewTemplate(p => ({ ...p, body: e.target.value }))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full resize-none" />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={async () => {
                              if (!newTemplate.name || !newTemplate.body) return;
                              await createEmailTemplate(newTemplate);
                              setNewTemplate({ name: '', body: '' });
                              setShowAddTemplate(false);
                            }}
                            disabled={creatingTemplate || !newTemplate.name || !newTemplate.body}
                            className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                            {creatingTemplate
                              ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Adding…</>
                              : 'Add Template'}
                          </motion.button>
                          <button onClick={() => setShowAddTemplate(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Template list */}
                  <div className="divide-y divide-gray-50">
                    <AnimatePresence>
                      {templates.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="px-4 md:px-8 py-4 group hover:bg-gray-50/50 transition-colors">
                          {editingTemplateId === t.id ? (
                            <div className="space-y-3 max-w-2xl">
                              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">Editing</p>
                              <input type="text" value={editTemplateForm.name}
                                onChange={e => setEditTemplateForm(p => ({ ...p, name: e.target.value }))}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                              <textarea rows={4} value={editTemplateForm.body}
                                onChange={e => setEditTemplateForm(p => ({ ...p, body: e.target.value }))}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full resize-none" />
                              <div className="flex gap-2">
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                  onClick={async () => { await updateEmailTemplate({ id: t.id, body: editTemplateForm }); setEditingTemplateId(null); }}
                                  disabled={updatingTemplate}
                                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60 transition-colors">
                                  {updatingTemplate
                                    ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                                  }
                                  Save
                                </motion.button>
                                <button onClick={() => setEditingTemplateId(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-4">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{t.body}</p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                  onClick={() => { setEditingTemplateId(t.id); setEditTemplateForm({ name: t.name, body: t.body }); setShowAddTemplate(false); }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: deletingTemplateId === t.id ? 1 : 1.1 }} whileTap={{ scale: 0.9 }}
                                  disabled={deletingTemplateId === t.id}
                                  onClick={async () => { setDeletingTemplateId(t.id); await deleteEmailTemplate(t.id); setDeletingTemplateId(null); }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60">
                                  {deletingTemplateId === t.id
                                    ? <svg className="w-4 h-4 animate-spin text-red-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                  }
                                </motion.button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {templates.length === 0 && (
                      <div className="py-16 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-300">
                          {Icons['Email Templates']}
                        </div>
                        <p className="text-sm font-medium text-gray-400">No templates yet</p>
                        <p className="text-xs text-gray-300 mt-1">Add your first reply template above</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── BOOKINGS CONFIG ── */}
              {activeSection === 'Bookings' && (() => {
                const tabItems = bookingConfig.filter(c => c.type === bookingsTab).sort((a, b) => a.order_index - b.order_index);
                const isTagTab = bookingsTab === 'tag';
                return (
                  <div>
                    {/* Sub-tabs */}
                    <div className="px-4 md:px-8 pt-4 flex items-center gap-1 border-b border-gray-100">
                      {(['tag', 'status', 'priority'] as const).map(t => (
                        <button key={t} onClick={() => { setBookingsTab(t); setEditingConfigId(null); }}
                          className={`relative px-4 py-2 text-sm font-semibold transition-colors capitalize rounded-t-lg ${bookingsTab === t ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-700'}`}>
                          {t === 'tag' ? 'Tags' : t === 'status' ? 'Statuses' : 'Priorities'}
                          {bookingsTab === t && <motion.div layoutId="cfg-tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
                        </button>
                      ))}
                    </div>

                    {/* Add form (tags only — status/priority values are fixed) */}
                    {isTagTab && (
                      <div className="px-4 md:px-8 py-4 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Add New Tag</p>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Value &amp; Label</label>
                            <input type="text" placeholder="e.g. Express"
                              value={newConfigItem.value}
                              onChange={e => setNewConfigItem(p => ({ ...p, value: e.target.value, label: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-full" />
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Color</label>
                            <div className="flex flex-wrap gap-1.5">
                              {AVAILABLE_COLORS.map(c => {
                                const cls = COLOR_MAP[c];
                                return (
                                  <button key={c} type="button" title={c}
                                    onClick={() => setNewConfigItem(p => ({ ...p, color: c }))}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${cls.dot} ${newConfigItem.color === c ? 'border-gray-800 scale-125' : 'border-transparent hover:scale-110'}`} />
                                );
                              })}
                            </div>
                          </div>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                            disabled={!newConfigItem.value || creatingConfig}
                            onClick={async () => {
                              if (!newConfigItem.value) return;
                              await createConfig({ type: 'tag', value: newConfigItem.value, label: newConfigItem.label || newConfigItem.value, color: newConfigItem.color, order_index: tabItems.length });
                              setNewConfigItem({ value: '', label: '', color: 'sky' });
                            }}
                            className="text-sm font-semibold bg-indigo-600 text-white px-5 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1.5 self-end">
                            {creatingConfig ? 'Adding…' : '+ Add Tag'}
                          </motion.button>
                        </div>
                      </div>
                    )}

                    {/* Items list */}
                    <div className="px-4 md:px-8 py-5 space-y-2">
                      {tabItems.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">No {bookingsTab}s configured yet.</p>
                      )}
                      <AnimatePresence>
                        {tabItems.map(item => {
                          const c = COLOR_MAP[item.color] ?? COLOR_MAP['gray'];
                          const isEditing = editingConfigId === item.id;
                          return (
                            <motion.div key={item.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isEditing ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                              {isEditing ? (
                                <>
                                  <input value={editConfigForm.label}
                                    onChange={e => setEditConfigForm(p => ({ ...p, label: e.target.value, value: isTagTab ? e.target.value : p.value }))}
                                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                                  <div className="flex gap-1">
                                    {AVAILABLE_COLORS.map(col => {
                                      const cc = COLOR_MAP[col];
                                      return (
                                        <button key={col} type="button" title={col}
                                          onClick={() => setEditConfigForm(p => ({ ...p, color: col }))}
                                          className={`w-5 h-5 rounded-full border-2 transition-all ${cc.dot} ${editConfigForm.color === col ? 'border-gray-700 scale-125' : 'border-transparent hover:scale-110'}`} />
                                      );
                                    })}
                                  </div>
                                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    disabled={updatingConfig}
                                    onClick={async () => {
                                      await updateConfig({ id: item.id, body: { label: editConfigForm.label, color: editConfigForm.color, ...(isTagTab ? { value: editConfigForm.label } : {}) } });
                                      setEditingConfigId(null);
                                    }}
                                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-60">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                                    Save
                                  </motion.button>
                                  <button onClick={() => setEditingConfigId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                                    {item.label}
                                  </span>
                                  {!isTagTab && <span className="text-xs text-gray-400 font-mono">{item.value}</span>}
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                      onClick={() => { setEditingConfigId(item.id); setEditConfigForm({ value: item.value, label: item.label, color: item.color }); }}
                                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    </motion.button>
                                    {isTagTab && (
                                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                        onClick={() => deleteConfig(item.id)}
                                        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                      </motion.button>
                                    )}
                                  </div>
                                </>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {!isTagTab && (
                        <p className="text-[11px] text-gray-400 mt-3 px-1">Status and priority values are fixed — only their label and color can be changed.</p>
                      )}
                    </div>
                  </div>
                );
              })()}

            </motion.div>
          </AnimatePresence>
        </div>

      </motion.div>
    </motion.div>
  );
}
