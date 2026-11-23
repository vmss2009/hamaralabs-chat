"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import clsx from 'clsx';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mathematics from '@tiptap/extension-mathematics';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { useParams, useRouter } from 'next/navigation';
// Local component extraction – use components from /components/chat
import { ChatHeader } from '@/components/chat/ChatHeader';
import { DragOverlay } from '@/components/chat/DragOverlay';
import { RoomSettingsModal, type RoomMember, type RoomRole } from '@/components/chat/RoomSettingsModal';
// Keep existing chat UI atoms from the local folder (note the path difference)
import { MenuBar } from '../components/MenuBar';
import { IconSpinner, IconX, IconResizeNS, IconPlus, IconMinus } from '../components/Icons';
import { MessageBody } from '../components/MessageBody';
import { AttachmentPreview, SelectedAttachmentPreview } from '../components/AttachmentPreview';

interface Message { id: string; content?: string; createdAt: string; sender: any; attachments?: any[]; type: string; pending?: boolean; }
interface User { id: string; email: string; }

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const activeRoom = (params?.roomId as string) || null;
  const [composerHeight, setComposerHeight] = useState<number>(56);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [activeRoomName, setActiveRoomName] = useState<string>('');
  const [manageOpen, setManageOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [olderIOEnabled, setOlderIOEnabled] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  // Attachments state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  // Media viewer (image or video)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState<number>(1);
  const [viewerType, setViewerType] = useState<'image' | 'video'>('image');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const meId = useMemo(() => session?.user?.id ?? null, [session?.user?.id]);
  // Drag-and-drop across the whole chat area
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const olderObserverRef = useRef<IntersectionObserver | null>(null);
  const olderInFlightRef = useRef(false);
  const leftTopSinceLastLoadRef = useRef(false);
  // Track one-time initial scroll-to-bottom after first render per room
  const initialScrolledRef = useRef(false);
  // Audio + emoji removed
  const [recordError, setRecordError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Mathematics.configure({
        inlineOptions: {
          onClick: (node: any, pos: number) => {
            const latex = (node?.attrs?.latex ?? '').toString();
            window.dispatchEvent(new CustomEvent('tiptap:open-math-popover', { detail: { latex, mode: 'inline', fromPos: pos, toPos: pos + node.nodeSize } }));
          },
        },
        blockOptions: {
          onClick: (node: any, pos: number) => {
            const latex = (node?.attrs?.latex ?? '').toString();
            window.dispatchEvent(new CustomEvent('tiptap:open-math-popover', { detail: { latex, mode: 'block', fromPos: pos, toPos: pos + node.nodeSize } }));
          },
        },
      }),
    ],
    content: '',
    immediatelyRender: false,
  });

  // Helper: does the editor contain any meaningful content (text or math nodes)?
  const editorHasContent = useCallback(() => {
    try {
      if (!editor) return false;
      const json: any = editor.getJSON();
      let found = false;
      const walk = (node: any) => {
        if (!node || found) return;
        if (node.type === 'inlineMath' || node.type === 'blockMath') { found = true; return; }
        if (node.type === 'text' && typeof node.text === 'string' && node.text.trim().length > 0) { found = true; return; }
        if (Array.isArray(node.content)) node.content.forEach(walk);
      };
      walk(json);
      return found;
    } catch { return false; }
  }, [editor]);

  // Keep send button state in sync with editor content
  useEffect(() => {
    if (!editor) return;
    const updateEmpty = () => { setEditorEmpty(!editorHasContent()); };
    updateEmpty();
    editor.on('update', updateEmpty);
    editor.on('selectionUpdate', updateEmpty);
    return () => {
      editor.off('update', updateEmpty);
      editor.off('selectionUpdate', updateEmpty);
    };
  }, [editor, editorHasContent]);

  const loadOlder = useCallback(async () => {
    if (!activeRoom || !nextCursor || olderInFlightRef.current) return;
    olderInFlightRef.current = true;
    setOlderLoading(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const r = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom)}&cursor=${encodeURIComponent(nextCursor)}&take=20`);
      const d = await r.json();
      if (Array.isArray(d.messages)) {
        setMessages(curr => {
          const byId = new Map<string, any>(curr.map(m => [m.id, m]));
          for (const m of d.messages) byId.set(m.id, m);
          const arr = Array.from(byId.values());
          arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return arr;
        });
        setNextCursor(d.nextCursor || null);
        if (el) {
          setTimeout(() => {
            const newHeight = el.scrollHeight;
            el.scrollTop = newHeight - prevHeight + prevTop;
          }, 0);
        }
      }
    } catch { /* ignore */ }
    finally {
      setOlderLoading(false);
      olderInFlightRef.current = false;
    }
  }, [activeRoom, nextCursor]);

  useEffect(() => {
    if (!olderIOEnabled) return;
    const root = listRef.current;
    const target = topSentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        // Pause observing until the user scrolls away and back to the top
        io.disconnect();
        olderObserverRef.current = null;
        setOlderIOEnabled(false);
        leftTopSinceLastLoadRef.current = false;
        loadOlder();
      }
    }, { root, rootMargin: '0px', threshold: 0.1 });
    olderObserverRef.current = io;
    io.observe(target);
    return () => { io.disconnect(); olderObserverRef.current = null; };
  }, [olderIOEnabled, loadOlder]);

  // Fetch users when the room settings dialog opens (for "Add members")
  useEffect(() => { if(manageOpen) { fetch('/api/users').then(r=>r.json()).then(d=> setUsers(Array.isArray(d.users)? d.users: [])); } }, [manageOpen]);

  const applyRoom = useCallback((room: any) => {
    setRoomMembers(Array.isArray(room?.members) ? room.members : []);
    setActiveRoomName(room?.name || '');
  }, []);

  // Called when we learn we can no longer see this room (removed, room deleted).
  const loseAccess = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setManageOpen(false);
    setHasAccess(false); setRoomMembers([]); setActiveRoomName(''); setMessages([]); setNextCursor(null);
  }, []);

  // Returns false if the current user is not (or no longer) a member.
  const refreshRoom = useCallback(async (roomId: string) => {
    const r = await fetch(`/api/chat/room?roomId=${encodeURIComponent(roomId)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.room) return false;
    applyRoom(d.room);
    return true;
  }, [applyRoom]);

  // Load room and check access; if allowed, load messages and subscribe to SSE
  useEffect(() => {
    if (!activeRoom) { setMessages([]); setRoomMembers([]); setNextCursor(null); setHasAccess(null); return; }
    if (!meId) { setHasAccess(null); return; }
    setMessagesLoading(true); setError(null); setHasAccess(null);
    let cancelled = false;
    let es: EventSource | null = null;
    const load = async () => {
      try {
        // 1) Fetch room details to verify access (the API answers 403 for non-members)
        const r2 = await fetch(`/api/chat/room?roomId=${encodeURIComponent(activeRoom)}`);
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok || !d2?.room) {
          if (!cancelled) { setHasAccess(false); setRoomMembers([]); setActiveRoomName(''); setMessages([]); setNextCursor(null); }
          return;
        }
        if (cancelled) return;
        setHasAccess(true);
        applyRoom(d2.room);

        // 2) Load latest messages now that access is confirmed
        const r1 = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom)}&take=20`);
        const d1 = await r1.json().catch(() => ({}));
        if (!cancelled) {
          if (r1.ok && Array.isArray(d1.messages)) {
            setMessages(d1.messages);
            setNextCursor(d1.nextCursor || null);
          } else {
            setMessages([]); setNextCursor(null);
          }
        }

        if (cancelled) return;
        // 3) Subscribe to SSE only when allowed
        if (esRef.current) { esRef.current.close(); }
        es = new EventSource(`/api/chat/events?roomId=${encodeURIComponent(activeRoom)}`);
        esRef.current = es;
        es.addEventListener('message', async () => {
          try {
            const r = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom)}&take=20`);
            const d = await r.json();
            if (Array.isArray(d.messages)) {
              setMessages(curr => {
                const byId = new Map<string, any>(curr.map(m => [m.id, m]));
                for (const m of d.messages) byId.set(m.id, m);
                const arr = Array.from(byId.values());
                arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                return arr;
              });
              const el = listRef.current;
              if (el) {
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                if (nearBottom) setShouldAutoScroll(true);
              }
            }
          } catch { /* ignore */ }
        });
        // Room renamed, members/roles changed, or room deleted
        es.addEventListener('room', async (ev) => {
          let kind = 'updated';
          try { kind = JSON.parse((ev as MessageEvent).data)?.kind || kind; } catch { /* ignore */ }
          if (cancelled) return;
          if (kind === 'deleted') { loseAccess(); return; }
          const stillMember = await refreshRoom(activeRoom).catch(() => true);
          if (!stillMember && !cancelled) loseAccess();
        });
        // We were removed from the room by an admin
        es.addEventListener('removed', () => { if (!cancelled) loseAccess(); });
        es.onerror = () => { /* silent reconnect by browser */ };
      } catch (e: any) {
        if (!cancelled) { setError(e.message || 'Failed to load room'); setHasAccess(false); }
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; if (es) es.close(); };
  }, [activeRoom, meId, applyRoom, refreshRoom, loseAccess]);

  // Reset the initial scroll flag whenever the room changes
  useEffect(() => {
    initialScrolledRef.current = false;
  }, [activeRoom]);

  // When switching rooms, ensure we jump to the latest message after messages load
  useEffect(() => {
    if (activeRoom) {
      setShouldAutoScroll(true);
    }
  }, [activeRoom]);

  // After the initial 20 messages render (oldest -> newest), scroll to bottom exactly once
  useEffect(() => {
    if (!messagesLoading && messages.length > 0 && !initialScrolledRef.current) {
      // Wait for DOM paint to ensure the bottom marker is present
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
        // Fallback: force scroll container to bottom in case scrollIntoView doesn't target the right scroller
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      initialScrolledRef.current = true;
    }
  }, [messagesLoading, messages, activeRoom]);

  useEffect(() => {
    if (shouldAutoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShouldAutoScroll(false);
      // Do not auto-enable older IO here; enable only after user scrolls away and returns to top
    }
  }, [messages, shouldAutoScroll]);

  // Pause/resume "load older" observer: after one load we pause it; re-enable only after user scrolls away from top and returns
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const THRESH = 80; // px from top considered "at top"
    const BOTTOM_THRESH = 200; // px from bottom to consider "away from bottom"
    const onScroll = () => {
      if (root.scrollTop > THRESH) {
        leftTopSinceLastLoadRef.current = true;
        if (olderObserverRef.current) {
          olderObserverRef.current.disconnect();
          olderObserverRef.current = null;
        }
        if (olderIOEnabled) setOlderIOEnabled(false);
      } else if (root.scrollTop <= THRESH && leftTopSinceLastLoadRef.current) {
        if (!olderObserverRef.current && nextCursor) {
          setOlderIOEnabled(true);
        }
      }
      const distFromBottom = root.scrollHeight - root.scrollTop - root.clientHeight;
      setShowJumpToLatest(distFromBottom > BOTTOM_THRESH);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [nextCursor, olderIOEnabled]);
  
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    setSelectedFiles(prev => {
      const existing = new Map(prev.map(f => [f.name + ':' + f.size + ':' + f.lastModified, true]));
      const next: File[] = [...prev];
      for (const f of arr) {
        const k = f.name + ':' + f.size + ':' + f.lastModified;
        if (existing.has(k)) continue;
        if (next.length >= MAX_FILES) {
          setError(`Maximum ${MAX_FILES} files per message.`);
          break;
        }
        next.push(f);
        existing.set(k, true);
      }
      return next;
    });
  };
  // Set up full-area drag & drop for files on the chat container
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingFiles(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (hasFiles(e)) {
        e.preventDefault();
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDraggingFiles(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setIsDraggingFiles(false);
      dragCounterRef.current = 0;
      const files = e.dataTransfer?.files;
      if (files && files.length) addFiles(files);
    };

    el.addEventListener('dragenter', onDragEnter as any);
    el.addEventListener('dragover', onDragOver as any);
    el.addEventListener('dragleave', onDragLeave as any);
    el.addEventListener('drop', onDrop as any);
    return () => {
      el.removeEventListener('dragenter', onDragEnter as any);
      el.removeEventListener('dragover', onDragOver as any);
      el.removeEventListener('dragleave', onDragLeave as any);
      el.removeEventListener('drop', onDrop as any);
    };
  }, [addFiles]);

  // ---- Room management (permissions are enforced by the API) ----
  const patchRoom = async (changes: { name?: string; addIds?: string[]; removeIds?: string[]; roles?: Record<string, RoomRole> }) => {
    if (!activeRoom) return;
    const r = await fetch('/api/chat/room', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: activeRoom, ...changes }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Failed to update room');
    applyRoom(d.room);
    if (d.missingMembers?.length) throw new Error(`Skipped ${d.missingMembers.length} unknown user(s).`);
  };
  const leaveCurrentRoom = async () => {
    if (!activeRoom) return;
    const r = await fetch('/api/chat/room/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: activeRoom }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Failed to leave room');
    esRef.current?.close();
    router.push('/protected/chat');
  };
  const deleteCurrentRoom = async () => {
    if (!activeRoom) return;
    const r = await fetch(`/api/chat/room?roomId=${encodeURIComponent(activeRoom)}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Failed to delete room');
    esRef.current?.close();
    router.push('/protected/chat');
  };

  const MAX_FILES = 5;


  const removeFileAt = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadSelectedFiles = async (): Promise<{ url: string; type: string; filename: string; size: number }[]> => {
    if (!activeRoom || selectedFiles.length === 0) return [];
    setIsUploading(true);
    try {
      const results: { url: string; type: string; filename: string; size: number }[] = [];
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append('roomId', activeRoom);
        fd.append('file', file);
        const res = await fetch('/api/storage/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
        results.push({ url: data.url, type: file.type || 'application/octet-stream', filename: file.name, size: file.size });
      }
      return results;
    } finally {
      setIsUploading(false);
    }
  };

  const canSend = !isUploading && !isRecording && (editorHasContent() || selectedFiles.length > 0);

  // Determine a supported audio mime type and extension
  const pickRecorderMime = (): { mime: string; ext: string } | null => {
    const candidates = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
      { mime: 'audio/mp4', ext: 'm4a' },
      { mime: 'audio/mpeg', ext: 'mp3' },
    ];
    for (const c of candidates) {
      // @ts-ignore (isTypeSupported may not exist in some TS DOM libs)
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c.mime)) return c;
    }
    return null;
  };

  const startRecording = async () => {
    setRecordError(null);
    try {
      if (isRecording) return;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setRecordError('Audio recording is not supported in this browser.');
        return;
      }
      const support = pickRecorderMime();
      if (!support) {
        setRecordError('No supported audio recording format found in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: support.mime } as any);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(recordedChunksRef.current, { type: support.mime });
          const now = new Date();
          const ts = now.toISOString().replaceAll(':', '-');
          const file = new File([blob], `recording-${ts}.${support.ext}`, { type: support.mime, lastModified: Date.now() });
          addFiles([file] as any);
        } catch (e:any) {
          setRecordError(e.message || 'Failed to capture recording');
        } finally {
          // Cleanup stream tracks
          try { recordingStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
          recordingStreamRef.current = null;
          mediaRecorderRef.current = null;
          setIsRecording(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (e:any) {
      setRecordError(e.message || 'Failed to start recording');
      try { recordingStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
  };

  const send = async () => {
    if(!editor || !activeRoom) return;
    if(!canSend) return;

    const html = editorHasContent() ? editor.getHTML() : '';

    try {
      // Upload attachments first (if any)
      const attachments = await uploadSelectedFiles();

      // Optimistic UI: append a pending message
      const optimistic: Message = {
        id: 'temp-' + Date.now(),
        content: html || undefined,
        createdAt: new Date().toISOString(),
        sender: { email: session?.user?.email },
        type: attachments.length && !html ? 'FILE' : 'TEXT',
        pending: true,
        attachments,
      } as any;
      setMessages(m => [...m, optimistic]);

      // Clear composer before sending
      if (html) editor.commands.clearContent();
      setSelectedFiles([]);
      setShouldAutoScroll(true);

      const r = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoom, content: html || undefined, attachments: attachments.length ? attachments : undefined }),
      });
      const resp = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(resp?.error || 'Send failed');

      if (resp?.message) {
        // Replace the optimistic message with the server-confirmed one to clear pending state immediately
        setMessages(curr => curr.map(m => m.id === optimistic.id ? resp.message : m));
      } else {
        // Fallback: refresh the list
        const rr = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom)}`);
        const dd = await rr.json();
        if (Array.isArray(dd.messages)) setMessages(dd.messages);
      }
    } catch (e:any) {
      setError(e.message || 'Failed to send');
    }
  };


  const withinWindow = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) <= 10 * 60 * 1000;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Day divider helpers
  const getDateKey = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
    };
  const formatDateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const a = startOf(today).getTime();
    const b = startOf(d).getTime();
    const diffDays = Math.round((a - b) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${mon}, ${yyyy}`;
  };

  const startEdit = (m: Message) => {
    setEditingId(m.id);
    setEditValue(m.content || '');
    try {
      editor?.commands.setContent(m.content || '');
      setTimeout(() => editor?.commands.focus('end'), 0);
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {}
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    try { editor?.commands.clearContent(); } catch {}
  };
  const saveEdit = async () => {
    if (!editingId || !editor) return;
    try {
      const newHtml = editor.getHTML();
      const r = await fetch('/api/chat/message', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, content: newHtml })});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to edit');
      setEditingId(null); setEditValue('');
      editor.commands.clearContent();
      // Refresh messages
      const rr = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom!)}`);
      const dd = await rr.json();
      if (Array.isArray(dd.messages)) setMessages(dd.messages);
    } catch (e:any) { setError(e.message); }
  };
  const removeMessage = async (id: string) => {
    try {
      const r = await fetch(`/api/chat/message?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to delete');
      // Refresh
      const rr = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom!)}`);
      const dd = await rr.json();
      if (Array.isArray(dd.messages)) setMessages(dd.messages);
    } catch (e:any) { setError(e.message); }
  };

  return (
    <div ref={dropRef} className="relative flex h-dvh w-full overflow-hidden bg-[linear-gradient(135deg,#0b1220,45%,#0e1628)] text-slate-100">
      {/* Drag & Drop overlay */}
      <DragOverlay show={isDraggingFiles} remaining={MAX_FILES - selectedFiles.length} />
      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col h-full min-w-0">
        {hasAccess === null && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <IconSpinner className="h-4 w-4 animate-spin" /> Loading chat…
            </div>
          </div>
        )}
        {hasAccess === false && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="text-slate-400 text-sm">This chat doesn&apos;t exist or you&apos;re no longer a member.</div>
            <button onClick={() => router.push('/protected/chat')} className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs">Back to chats</button>
          </div>
        )}
        {hasAccess === true && (
          <>
            <ChatHeader
              roomName={activeRoomName || String(activeRoom || '')}
              membersCount={roomMembers.length}
              loading={messagesLoading}
              onManage={() => setManageOpen(true)}
              onBack={() => router.push('/protected/chat')}
            />
            <div ref={listRef} className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-4 sm:py-6 space-y-3 md:space-y-4 custom-scroll" onClick={()=> setOpenMenuId(null)}>
              {olderLoading && (
                <div className="absolute top-2 left-0 right-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-800/90 border border-slate-700/70 text-[0.6875rem]">
                    <IconSpinner className="h-3.5 w-3.5" /> Loading older…
                  </div>
                </div>
              )}
              <div ref={topSentinelRef} className="h-1" />
              {(() => {
                let lastDateKey: string | null = null;
                return messages.map((m, idx) => {
                  const mine = m.sender?.id ? (m.sender.id === meId) : (m.sender?.email && m.sender.email === session?.user?.email);
                  const showActions = mine && withinWindow(m.createdAt);
                  const menuOpen = openMenuId === m.id;
                  const thisKey = getDateKey(m.createdAt);
                  const showDivider = thisKey !== lastDateKey;
                  if (showDivider) lastDateKey = thisKey;
                  return (
                    <div key={m.id + '-' + idx} className="w-full">
                      {showDivider && (
                        <div className="w-full py-2 flex items-center justify-center">
                          <div className="px-3 py-1 rounded-full text-[0.6875rem] font-medium bg-slate-800/80 border border-slate-700/70 text-slate-300 shadow/20 shadow-black/30">
                            {formatDateLabel(m.createdAt)}
                          </div>
                        </div>
                      )}
                      <div className={clsx('flex w-full overflow-visible', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'group relative max-w-[82%] md:max-w-[68%] rounded-2xl px-4 py-2 text-sm shadow/20 shadow-black/40 flex flex-col gap-2 ring-1 ring-transparent transition-all z-0',
                        menuOpen ? 'z-50' : 'z-0',
                        mine ? 'bg-gradient-to-br from-indigo-600/90 to-indigo-500/80 text-white backdrop-blur ring-indigo-400/0 group-hover:ring-indigo-300/40' : 'bg-slate-800/70 backdrop-blur ring-slate-700/80 group-hover:ring-slate-500/50'
                      )}
                      title={new Date(m.createdAt).toLocaleString()}
                    >
                      {/* Sender email label (WhatsApp-style) */}
                      <div className={clsx('text-[0.6875rem] font-semibold leading-none truncate', mine ? 'text-indigo-100/90' : 'text-emerald-300')}>
                        {m.sender?.email || 'Unknown'}
                      </div>
                      {showActions && (
                        <div className={clsx('absolute top-1', mine ? 'right-2' : 'left-2')}>
                          <button
                            aria-label="Message options"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(id => id === m.id ? null : m.id); }}
                            className="h-6 w-6 grid place-items-center rounded-full bg-black/20 hover:bg-black/30 text-slate-200 opacity-0 group-hover:opacity-100 transition"
                          >
                            ⋯
                          </button>
                          {openMenuId === m.id && (
                            <div
                              className={clsx(
                                'absolute mt-1 w-28 rounded-md border border-slate-700/70 bg-slate-900/95 shadow-xl shadow-black/50 overflow-hidden z-[60]',
                                mine ? 'right-0' : 'left-0'
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="w-full text-left text-xs px-3 py-2 hover:bg-slate-800"
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); startEdit(m); }}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full text-left text-xs px-3 py-2 hover:bg-slate-800 text-rose-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  const ok = typeof window !== 'undefined' ? window.confirm('Delete this message? This cannot be undone.') : true;
                                  if (ok) removeMessage(m.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {m.attachments?.length ? (
                        <div className="relative">
                          <div className="grid grid-cols-2 gap-2">
                            {m.attachments.map(a => (
                              <AttachmentPreview
                                key={a.id || a.url}
                                a={a}
                                onImageClick={(src: string) => { setViewerSrc(src); setViewerZoom(1); setViewerType('image'); }}
                                onVideoClick={(src: string) => { setViewerSrc(src); setViewerZoom(1); setViewerType('video'); }}
                              />
                            ))}
                          </div>
                          {m.pending && (
                            <div className="absolute inset-0 rounded-md bg-black/40 grid place-items-center">
                              <IconSpinner className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </div>
                      ) : null}
                      {m.content && <MessageBody html={m.content} />}
                      <div className={clsx('flex gap-2 items-center', mine ? 'justify-end' : 'justify-start')}>
                        {m.pending && <span className="text-[0.625rem] text-yellow-200/90">sending…</span>}
                        <span className={clsx('text-[0.625rem] tracking-wide uppercase opacity-0 group-hover:opacity-100 transition', mine ? 'text-indigo-100/80' : 'text-slate-400/80')}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                      </div>
                    </div>
                  );
                });
              })()}
              {!messagesLoading && !messages.length && <div className="text-xs text-slate-500">No messages yet. Start the conversation.</div>}
              <div ref={bottomRef} />
            </div>
            <footer className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-800/70 bg-slate-900/60 backdrop-blur-xl flex flex-col gap-3 relative">
              {(error || recordError) && <div className="text-[0.6875rem] text-rose-300 bg-rose-950/40 border border-rose-800/50 px-3 py-1 rounded">{error || recordError}</div>}
              <div className="flex items-center gap-3">
                {/* Hidden file input used by MenuBar onAttach */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.currentTarget.files) addFiles(e.currentTarget.files);
                    // Reset input so selecting the same file again still triggers change
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="hidden"
                />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="flex flex-col flex-1 min-w-0 gap-2">
                    <div ref={composerRef} className="rounded-lg bg-slate-800/70 border border-slate-700/70 px-3 py-2 shadow-inner shadow-black/30">
                      <div className="relative">
                        {editor && (
                          <MenuBar
                            editor={editor}
                            onAttach={() => fileInputRef.current?.click()}
                            isUploading={isUploading}
                            onToggleRecording={() => (isRecording ? stopRecording() : startRecording())}
                            isRecording={isRecording}
                            attachmentsCount={selectedFiles.length}
                            maxFiles={MAX_FILES}
                            showJumpToLatest={showJumpToLatest}
                            onJumpToLatest={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowJumpToLatest(false); }}
                            onSend={send}
                            canSend={canSend}
                            showSend={true}
                            isEditing={!!editingId}
                            canSaveEdit={!editorEmpty}
                            onSaveEdit={saveEdit}
                            onCancelEdit={cancelEdit}
                          />
                        )}
                      </div>
                      <div
                        className="relative rounded-xl border border-slate-600/60 bg-slate-900/40"
                        style={{ height: composerHeight }}
                      >
                        <EditorContent
                          editor={editor}
                          className="tiptap resizable-editor h-full px-3 py-2 focus:outline-none focus:ring-0"
                        />
                        <button
                          type="button"
                          title="Resize editor"
                          aria-label="Resize editor"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            const startY = e.clientY;
                            const startH = composerHeight;
                            const pid = e.pointerId;
                            try { (e.currentTarget as any).setPointerCapture?.(pid); } catch {}
                            const onMove = (ev: PointerEvent) => {
                              const delta = ev.clientY - startY;
                              // Top-right handle semantics: drag down reduces height, drag up increases height
                              const nh = Math.max(56, Math.min(startH - delta, Math.floor(window.innerHeight * 0.6)));
                              setComposerHeight(nh);
                            };
                            const onUp = () => {
                              document.removeEventListener('pointermove', onMove);
                              document.removeEventListener('pointerup', onUp);
                              document.removeEventListener('pointercancel', onUp);
                              try { (e.currentTarget as any).releasePointerCapture?.(pid); } catch {}
                            };
                            document.addEventListener('pointermove', onMove, { passive: true } as any);
                            document.addEventListener('pointerup', onUp);
                            document.addEventListener('pointercancel', onUp);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 grid place-items-center rounded-md border border-slate-600/70 bg-slate-700/50 hover:bg-slate-600/70 cursor-ns-resize touch-none select-none"
                        >
                          <IconResizeNS className="h-3.5 w-3.5 text-slate-300" />
                        </button>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 relative">
                          <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((f, i) => (
                              <SelectedAttachmentPreview key={i} file={f} onRemove={() => removeFileAt(i)} />
                            ))}
                          </div>
                          {isUploading && (
                            <div className="absolute inset-0 rounded-md bg-black/50 grid place-items-center">
                              <IconSpinner className="h-8 w-8 text-white" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Save/Cancel moved into MenuBar while editing */}
              </div>
            </footer>
          </>
        )}
      </section>

      {viewerSrc && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between p-3 text-slate-200">
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs"
                onClick={() => setViewerZoom(z => Math.min(5, z + 0.25))}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <IconPlus className="h-4 w-4" />
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs"
                onClick={() => setViewerZoom(z => Math.max(0.25, z - 0.25))}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <IconMinus className="h-4 w-4" />
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs"
                onClick={() => setViewerZoom(1)}
                aria-label="Reset zoom"
                title="Reset zoom"
              >
                100%
              </button>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={viewerSrc || undefined}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs"
                aria-label="Download media"
                title="Download media"
              >
                Download
              </a>
              <button
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs"
                onClick={() => setViewerSrc(null)}
                aria-label="Close"
                title="Close"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="min-h-full w-full flex items-center justify-center">
              {viewerType === 'image' ? (
                <img
                  src={viewerSrc}
                  alt="preview"
                  className="select-none"
                  style={{
                    transform: `scale(${viewerZoom})`,
                    transformOrigin: 'center center',
                    maxWidth: 'min(90vw, 1600px)',
                    maxHeight: 'min(85vh, 1200px)'
                  }}
                  draggable={false}
                />
              ) : (
                <video
                  controls
                  autoPlay
                  playsInline
                  style={{
                    transform: `scale(${viewerZoom})`,
                    transformOrigin: 'center center',
                    maxWidth: 'min(90vw, 1600px)',
                    maxHeight: 'min(85vh, 1200px)'
                  }}
                >
                  <source src={viewerSrc} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </div>
      )}

      <RoomSettingsModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        roomName={activeRoomName}
        members={roomMembers}
        users={users}
        currentUserId={meId}
        onRename={(name) => patchRoom({ name })}
        onAdd={(userId) => patchRoom({ addIds: [userId] })}
        onRemove={(userId) => patchRoom({ removeIds: [userId] })}
        onSetRole={(userId, role) => patchRoom({ roles: { [userId]: role } })}
        onLeave={leaveCurrentRoom}
        onDelete={deleteCurrentRoom}
      />
    </div>
  );
}
