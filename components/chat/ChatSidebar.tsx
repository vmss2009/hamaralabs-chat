import React from 'react';
import clsx from 'clsx';

export interface Room { id: string; name: string; _count?: { messages: number }; }

type Props = {
  rooms: Room[];
  roomsLoading: boolean;
  activeRoom: string | null;
  onSelectRoom: (id: string) => void;
  onCreateRoom: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

export function ChatSidebar({ rooms, roomsLoading, activeRoom, onSelectRoom, onCreateRoom, sidebarOpen, setSidebarOpen }: Props) {
  return (
    <>
      {/* Mobile overlay trigger */}
      <div className="md:hidden absolute top-2 left-2 z-40">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="px-3 py-2 rounded-md bg-slate-800/70 backdrop-blur border border-slate-700 text-xs font-medium shadow hover:bg-slate-700/70">{sidebarOpen ? 'Close' : 'Rooms'}</button>
      </div>
      {/* Sidebar */}
      <aside className={clsx('flex flex-col shrink-0 w-80 h-full border-r border-slate-800/70 backdrop-blur-xl bg-slate-900/40 transition-transform duration-300', 'md:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')}>
        <div className="p-4 flex items-center justify-between border-b border-slate-800/70">
          <h2 className="font-semibold tracking-wide text-[11px] uppercase text-slate-300">Chats</h2>
          <button className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600/70" onClick={onCreateRoom}>New</button>
        </div>
        <div className="relative flex-1 overflow-y-auto custom-scroll pb-10">
          {roomsLoading && <div className="p-4 text-xs text-slate-500 animate-pulse">Loading rooms…</div>}
          {!roomsLoading && !rooms.length && <div className="p-4 text-xs text-slate-500">No rooms yet.</div>}
          <ul className="py-2 space-y-1">
            {rooms.map(r => (
              <li key={r.id}>
                <button onClick={() => { onSelectRoom(r.id); setSidebarOpen(false); }} className={clsx('group w-full text-left px-4 py-3 flex flex-col gap-1 border-l-2 transition-all duration-200', activeRoom === r.id ? 'bg-slate-800/70 border-indigo-400 shadow-inner shadow-indigo-900/30' : 'border-transparent hover:bg-slate-800/40')}>
                  <span className="font-medium text-sm truncate group-hover:text-indigo-300/90">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
