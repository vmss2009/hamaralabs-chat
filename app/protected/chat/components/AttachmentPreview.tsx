import React from 'react';

export function AttachmentPreview({ a }: { a: any }) {
  if (a.type?.startsWith('image/')) return (
    <div className="relative group">
      <img src={a.url} alt={a.filename} className="h-24 w-24 rounded-lg object-cover border border-slate-700/70 shadow-md shadow-black/40" />
      <span className="absolute bottom-1 right-2 text-[10px] px-2 py-0.5 rounded bg-black/50 backdrop-blur text-slate-200 opacity-0 group-hover:opacity-100 transition">{a.filename}</span>
    </div>
  );
  if (a.type?.startsWith('audio/')) return (
    <div className="w-full">
      <audio controls src={a.url} className="w-full" />
      <div className="text-[10px] mt-1 text-slate-400 break-all">{a.filename}</div>
    </div>
  );
  return <a href={a.url} target="_blank" rel="noopener" className="text-xs underline break-all text-indigo-200 hover:text-indigo-100">{a.filename || a.url}</a>;
}

