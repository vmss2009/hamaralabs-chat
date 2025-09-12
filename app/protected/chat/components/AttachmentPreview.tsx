import React from 'react';
import { useEffect, useState } from 'react';

export function AttachmentPreview({ a, onImageClick }: { a: any; onImageClick?: (src: string) => void }) {
  if(a.type?.startsWith('image/')) return (
    <div className="relative group">
      <img src={a.url} alt={a.filename} onClick={() => onImageClick?.(a.url)} className="h-24 w-24 rounded-lg object-cover border border-slate-700/70 shadow-md shadow-black/40 cursor-zoom-in" />
      <span className="absolute bottom-1 right-2 text-[10px] px-2 py-0.5 rounded bg-black/50 backdrop-blur text-slate-200 opacity-0 group-hover:opacity-100 transition">{a.filename}</span>
    </div>
  );
  if(a.type?.startsWith('audio/')) return (
    <div className="w-full">
      <audio controls preload="metadata" crossOrigin="anonymous" className="w-full">
        <source src={a.url} type={(a.type || '').split(';')[0] || undefined} />
        Your browser does not support the audio element.
      </audio>
      <div className="text-[10px] mt-1 text-slate-400 break-all">{a.filename}</div>
    </div>
  );
  return <a href={a.url} target="_blank" rel="noopener" className="text-xs underline break-all text-indigo-200 hover:text-indigo-100">{a.filename || a.url}</a>;
}

export function SelectedAttachmentPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => { URL.revokeObjectURL(u); };
  }, [file]);

  const sizeKB = Math.round(file.size / 1024);
  const isImage = file.type?.startsWith('image/');
  const isAudio = file.type?.startsWith('audio/');

  // Images are shown as simple chips (no preview)
  if (isImage) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-600/60 bg-slate-800/60 text-[11px]">
        <span className="max-w-[14rem] truncate" title={`${file.name} • ${sizeKB} KB`}>{file.name}</span>
        <span className="opacity-60">({sizeKB} KB)</span>
        <button type="button" onClick={onRemove} className="ml-1 px-1 rounded bg-slate-700 hover:bg-slate-600" aria-label={`Remove ${file.name}`} title="Remove file">×</button>
      </div>
    );
  }

  // Audio keeps a small player for usability
  if (isAudio) {
    return (
      <div className="w-full p-2 border border-slate-600/60 bg-slate-800/60 rounded-md">
        {url ? (
          <audio controls preload="metadata" crossOrigin="anonymous" className="w-full">
            <source src={url} type={file.type?.split(';')[0] || 'audio/mpeg'} />
            Your browser does not support the audio element.
          </audio>
        ) : (
          <div className="text-[10px] text-slate-400">Preparing audio…</div>
        )}
        <div className="mt-1 flex items-center justify-between text-[10px]">
          <span className="truncate" title={`${file.name} • ${sizeKB} KB`}>{file.name}</span>
          <button type="button" onClick={onRemove} className="px-1 rounded bg-slate-700 hover:bg-slate-600" aria-label={`Remove ${file.name}`}>×</button>
        </div>
      </div>
    );
  }

  // Generic file chip
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-600/60 bg-slate-800/60 text-[11px]">
      <span className="max-w-[14rem] truncate" title={`${file.name} • ${sizeKB} KB`}>{file.name}</span>
      <span className="opacity-60">({sizeKB} KB)</span>
      <button type="button" onClick={onRemove} className="ml-1 px-1 rounded bg-slate-700 hover:bg-slate-600" aria-label={`Remove ${file.name}`} title="Remove file">×</button>
    </div>
  );
}