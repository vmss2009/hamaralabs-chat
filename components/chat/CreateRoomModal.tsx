import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

export interface User { id: string; email: string; }

export function CreateRoomModal({
  open,
  onClose,
  roomName,
  setRoomName,
  users,
  currentUserId,
  selectedMembers,
  toggleMember,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  roomName: string;
  setRoomName: (v: string) => void;
  users: User[];
  currentUserId?: string | null;
  selectedMembers: Set<string>;
  toggleMember: (id: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);
  if (!open) return null;

  const others = users.filter(u => u.id !== currentUserId);
  const q = query.trim().toLowerCase();
  const shown = others.filter(u => !q || (u.email || u.id).toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scroll rounded-2xl bg-slate-900/90 border border-slate-700/70 p-5 sm:p-6 space-y-5 shadow-2xl shadow-black/60">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Create Room</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[0.6875rem] uppercase tracking-wider text-slate-400">Room Name</label>
            <input value={roomName} maxLength={100} onChange={e=> setRoomName(e.target.value)} placeholder="Team Sync" className="w-full rounded-md bg-slate-800/70 border border-slate-700/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.6875rem] uppercase tracking-wider text-slate-400">
              Members{selectedMembers.size ? ` • ${selectedMembers.size} selected` : ''}
            </label>
            {others.length > 5 && (
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search users…" className="w-full rounded bg-slate-800/70 border border-slate-700/70 px-2 py-1 text-sm focus:outline-none focus:ring-0" />
            )}
            <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scroll pr-1">
              {shown.map(u=> {
                const active = selectedMembers.has(u.id);
                return (
                  <button key={u.id} type="button" onClick={()=> toggleMember(u.id)} className={clsx('w-full flex items-center justify-between rounded-md px-3 py-2 text-xs border transition shadow-sm', active ? 'bg-indigo-600/70 border-indigo-400 text-white shadow-indigo-900/40' : 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800/80')}>{u.email}<span className="opacity-70">{active ? 'Added' : 'Add'}</span></button>
                );
              })}
              {!users.length && <div className="text-[0.6875rem] text-slate-500">Loading users...</div>}
              {!!users.length && !others.length && <div className="text-[0.6875rem] text-slate-500">No one else has signed in yet. People appear here after they sign in once.</div>}
              {!!others.length && !shown.length && <div className="text-[0.6875rem] text-slate-500">No matching users.</div>}
            </div>
          </div>
          <div className="text-[0.6875rem] text-slate-500">You&apos;ll be the room&apos;s admin and can add or remove people later.</div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/70">Cancel</button>
          <button onClick={onCreate} disabled={!roomName.trim()} className="text-xs px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed shadow shadow-indigo-900/40">Create</button>
        </div>
      </div>
    </div>
  );
}
