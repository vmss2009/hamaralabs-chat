import React from 'react';

export function ChatHeader({ roomName, membersCount, loading, onManage }: { roomName: string; membersCount: number; loading: boolean; onManage: () => void; }) {
  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-slate-800/70 bg-slate-900/60 backdrop-blur-xl">
      <div className="flex flex-col">
        <h1 className="font-semibold text-sm leading-tight">{roomName}</h1>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        {loading && <span className="animate-pulse">Loading…</span>}
        <button
          className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-[11px]"
          onClick={onManage}
        >
          Members • {membersCount}
        </button>
      </div>
    </header>
  );
}
