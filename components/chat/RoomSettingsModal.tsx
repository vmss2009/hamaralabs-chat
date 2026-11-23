import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

export type RoomRole = 'ADMIN' | 'MEMBER';
export interface RoomMember { id: string; email: string; role: RoomRole; }
export interface User { id: string; email: string; }

type Props = {
  open: boolean;
  onClose: () => void;
  roomName: string;
  members: RoomMember[];
  users: User[];
  currentUserId?: string | null;
  // Each action rejects with an Error whose message is shown in the dialog.
  onRename: (name: string) => Promise<void>;
  onAdd: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onSetRole: (userId: string, role: RoomRole) => Promise<void>;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
};

const btn = 'px-2 py-1 rounded text-[0.6875rem] border transition disabled:opacity-40 disabled:cursor-not-allowed';

export function RoomSettingsModal({
  open, onClose, roomName, members, users, currentUserId,
  onRename, onAdd, onRemove, onSetRole, onLeave, onDelete,
}: Props) {
  const [nameDraft, setNameDraft] = useState(roomName);
  const [addQuery, setAddQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setNameDraft(roomName); setAddQuery(''); setError(null); }
  }, [open, roomName]);

  if (!open) return null;

  const me = members.find(m => m.id === currentUserId);
  const isAdmin = me?.role === 'ADMIN';
  const adminCount = members.filter(m => m.role === 'ADMIN').length;
  const iAmOnlyMember = members.length === 1 && !!me;
  const iAmLastAdmin = isAdmin && adminCount === 1 && !iAmOnlyMember;

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(null); }
  };

  const trimmedName = nameDraft.trim();
  const canRename = isAdmin && !!trimmedName && trimmedName !== roomName && trimmedName.length <= 100;

  const q = addQuery.trim().toLowerCase();
  const candidates = users
    .filter(u => !members.some(m => m.id === u.id))
    .filter(u => !q || (u.email || u.id).toLowerCase().includes(q));

  const confirmLeave = () => {
    const msg = iAmOnlyMember
      ? 'You are the only member. Leaving will permanently delete this room and all its messages and files. Continue?'
      : iAmLastAdmin
        ? 'You are the only admin. The longest-standing member will become admin when you leave. Leave this room?'
        : 'Leave this room?';
    if (window.confirm(msg)) run('leave', onLeave);
  };
  const confirmDelete = () => {
    if (window.confirm(`Delete "${roomName}" for everyone? All messages and files will be permanently removed.`)) run('delete', onDelete);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scroll rounded-2xl bg-slate-900/90 border border-slate-700/70 p-6 space-y-5 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Room settings</h3>
          {isAdmin && <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">You are an admin</span>}
        </div>

        {error && <div className="text-[0.6875rem] text-rose-300 bg-rose-950/40 border border-rose-800/50 px-3 py-1.5 rounded">{error}</div>}

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[0.6875rem] uppercase tracking-wider text-slate-400">Room name</label>
          {isAdmin ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (canRename) run('rename', () => onRename(trimmedName)); }}>
              <input
                value={nameDraft}
                maxLength={100}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 min-w-0 rounded-md bg-slate-800/70 border border-slate-700/70 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              />
              <button type="submit" disabled={!canRename || !!busy} className={clsx(btn, 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white')}>
                {busy === 'rename' ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : (
            <div className="text-sm text-slate-200">{roomName}</div>
          )}
        </div>

        {/* Members */}
        <div className="space-y-2">
          <div className="text-[0.6875rem] uppercase tracking-wider text-slate-400">Members • {members.length}</div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scroll pr-1">
            {members.map(m => {
              const isMe = m.id === currentUserId;
              const memberIsAdmin = m.role === 'ADMIN';
              return (
                <div key={m.id} className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs border border-slate-700/70 bg-slate-800/50">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{m.email || m.id}</span>
                    {isMe && <span className="shrink-0 text-slate-400">(you)</span>}
                    {memberIsAdmin && <span className="shrink-0 text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">Admin</span>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isMe ? (
                        adminCount > 1 && (
                          <button disabled={!!busy} onClick={() => run(`role:${m.id}`, () => onSetRole(m.id, 'MEMBER'))} className={clsx(btn, 'bg-slate-700 hover:bg-slate-600 border-slate-600')} title="Give up your admin rights">
                            Step down
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            disabled={!!busy}
                            onClick={() => run(`role:${m.id}`, () => onSetRole(m.id, memberIsAdmin ? 'MEMBER' : 'ADMIN'))}
                            className={clsx(btn, 'bg-slate-700 hover:bg-slate-600 border-slate-600')}
                          >
                            {memberIsAdmin ? 'Remove admin' : 'Make admin'}
                          </button>
                          <button
                            disabled={!!busy}
                            onClick={() => { if (window.confirm(`Remove ${m.email || 'this member'} from the room?`)) run(`remove:${m.id}`, () => onRemove(m.id)); }}
                            className={clsx(btn, 'bg-rose-700/80 hover:bg-rose-600 border-rose-600/60 text-white')}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!isAdmin && <div className="text-[0.6875rem] text-slate-500">Only room admins can add or remove members.</div>}
        </div>

        {/* Add members (admins) */}
        {isAdmin && (
          <div className="space-y-2">
            <div className="text-[0.6875rem] uppercase tracking-wider text-slate-400">Add members</div>
            <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} placeholder="Search users…" className="w-full rounded bg-slate-800/70 border border-slate-700/70 px-2 py-1 text-sm focus:outline-none focus:ring-0" />
            <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scroll pr-1">
              {candidates.map(u => (
                <div key={u.id} className="w-full flex items-center justify-between rounded-md px-3 py-2 text-xs border border-slate-700/70 bg-slate-800/50">
                  <span className="truncate mr-2">{u.email || u.id}</span>
                  <button disabled={!!busy} onClick={() => run(`add:${u.id}`, () => onAdd(u.id))} className={clsx(btn, 'bg-emerald-700/80 hover:bg-emerald-600 border-emerald-600/60 text-white')}>
                    {busy === `add:${u.id}` ? 'Adding…' : 'Add'}
                  </button>
                </div>
              ))}
              {!users.length && <div className="text-[0.6875rem] text-slate-500">Loading users…</div>}
              {!!users.length && !candidates.length && (
                <div className="text-[0.6875rem] text-slate-500">{q ? 'No matching users.' : 'Everyone is already in this room.'} People appear here after they sign in once.</div>
              )}
            </div>
          </div>
        )}

        {/* Leave / delete */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button disabled={!!busy} onClick={confirmLeave} className={clsx(btn, 'bg-slate-800 hover:bg-slate-700 border-slate-700/70 text-rose-200')}>
              {busy === 'leave' ? 'Leaving…' : 'Leave room'}
            </button>
            {isAdmin && (
              <button disabled={!!busy} onClick={confirmDelete} className={clsx(btn, 'bg-rose-800/80 hover:bg-rose-700 border-rose-700/70 text-white')}>
                {busy === 'delete' ? 'Deleting…' : 'Delete room'}
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/70">Close</button>
        </div>
      </div>
    </div>
  );
}
