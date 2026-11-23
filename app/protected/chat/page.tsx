"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOutCompletely } from '@/lib/auth/sign-out';
import { CreateRoomModal } from '@/components/chat/CreateRoomModal';

type Room = { id: string; name: string; myRole?: 'ADMIN' | 'MEMBER' | null; _count?: { members?: number } };
type User = { id: string; email: string };

export default function ChatIndex() {
  const { data: session } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roomName, setRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  // Load rooms for selection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRoomsLoading(true); setError(null);
      try {
        const r = await fetch('/api/chat/rooms');
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load rooms');
        if (!cancelled) setRooms(Array.isArray(d.rooms) ? d.rooms : []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load rooms');
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load users when creating a room
  useEffect(() => { if (showModal) { fetch('/api/users').then(r=>r.json()).then(d=> setUsers(Array.isArray(d.users) ? d.users : [])); } }, [showModal]);

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim(), memberIds: Array.from(selectedMembers) })
      });
      const data = await res.json();
      if (!res.ok || !data.room) throw new Error(data.error || 'Failed to create room');
      setShowModal(false); setRoomName(''); setSelectedMembers(new Set());
      router.push(`/protected/chat/${data.room.id}`);
    } catch (e: any) { setError(e.message || 'Failed to create'); }
  };

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto bg-[linear-gradient(135deg,#0b1220,45%,#0e1628)] text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800/70 bg-slate-900/60 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-semibold tracking-wide uppercase text-slate-200">Chats</h1>
          <div className="flex items-center gap-2 min-w-0">
            {session?.user?.email && (
              <span className="hidden sm:block truncate max-w-[16rem] text-[0.6875rem] text-slate-400" title={session.user.email}>{session.user.email}</span>
            )}
            <button onClick={() => signOutCompletely()} className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs">Sign out</button>
            <button onClick={() => setShowModal(true)} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium shadow">Create chat</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {error && <div className="mb-4 text-rose-300 text-xs">{error}</div>}
        {roomsLoading ? (
          <div className="text-sm text-slate-300">Loading chats…</div>
        ) : (
          <>
            {!rooms.length && (
              <div className="text-xs text-slate-400 mb-4">No rooms yet. Create one to get started.</div>
            )}
            <ul className="overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/40 divide-y divide-slate-800/60">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/protected/chat/${r.id}`}
                    className="block w-full px-4 py-4 hover:bg-slate-800/50 transition flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">{r.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-slate-400">
                        {typeof r._count?.members === 'number' && <span>{r._count.members} member{r._count.members === 1 ? '' : 's'}</span>}
                        {r.myRole === 'ADMIN' && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[0.625rem]">Admin</span>}
                      </div>
                    </div>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <CreateRoomModal
        open={showModal}
        onClose={() => setShowModal(false)}
        roomName={roomName}
        setRoomName={setRoomName}
        users={users as any}
        currentUserId={session?.user?.id as any}
        selectedMembers={selectedMembers}
        toggleMember={toggleMember}
        onCreate={createRoom}
      />
    </div>
  );
}