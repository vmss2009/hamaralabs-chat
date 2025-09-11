"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import * as Popover from '@radix-ui/react-popover';
import katex from 'katex';
import clsx from 'clsx';
import { IconBold, IconBraces, IconCode, IconHR, IconItalic, IconListBullet, IconListOrdered, IconMath, IconPilcrow, IconQuote, IconRedo, IconReturn, IconStrikethrough, IconUndo } from './Icons';

function useEditorState<T>({ editor, selector }: { editor: Editor; selector: (ctx: { editor: Editor }) => T }): T {
  const compute = useCallback(() => selector({ editor }), [editor, selector]);
  const [state, setState] = useState<T>(() => compute());
  useEffect(() => {
    if (!editor) return;
    const update = () => setState(compute());
    editor.on('update', update);
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('update', update);
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor, compute]);
  return state;
}

export function MenuBar({ editor }: { editor: Editor }) {
  const [latex, setLatex] = useState<string>('x^2');
  const applyHeading = useCallback((level: 1 | 2 | 3 | 4 | 5 | 6) => {
    editor.chain().focus().toggleHeading({ level }).run();
  }, [editor]);
  const [mathOpen, setMathOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'inline' | 'block'>('inline');
  const [editExisting, setEditExisting] = useState<null | 'inline' | 'block'>(null);
  const [editRange, setEditRange] = useState<null | { from: number; to: number }>(null);
  const previewHtml = useMemo(() => {
    try {
      return katex.renderToString(latex || '', { throwOnError: false, displayMode: previewMode === 'block' });
    } catch {
      return '';
    }
  }, [latex, previewMode]);

  useEffect(() => {
    const onOpen = (e: any) => {
      const d = e?.detail || {};
      if (typeof d.latex === 'string') setLatex(d.latex);
      const m = d.mode === 'block' ? 'block' : 'inline';
      setPreviewMode(m);
      setEditExisting(m);
      if (typeof d.fromPos === 'number' && typeof d.toPos === 'number') {
        setEditRange({ from: d.fromPos, to: d.toPos });
      } else {
        setEditRange(null);
      }
      setMathOpen(true);
    };
    window.addEventListener('tiptap:open-math-popover', onOpen as EventListener);
    return () => window.removeEventListener('tiptap:open-math-popover', onOpen as EventListener);
  }, []);

  const insertLatex = useCallback((value: string, mode: 'inline' | 'block') => {
    const anyEditor = editor as any;
    if (editExisting && editRange) {
      try {
        const ok = mode === 'inline'
          ? anyEditor?.chain().focus().updateInlineMath({ latex: value, pos: editRange.from }).run()
          : anyEditor?.chain().focus().updateBlockMath({ latex: value, pos: editRange.from }).run();
        if (ok) { setEditExisting(null); setEditRange(null); return true; }
      } catch {}
      try {
        const success = anyEditor?.chain?.().focus().command(({ tr, state, dispatch }: any) => {
          const { from, to } = editRange;
          const nodeAtFrom = state.doc.nodeAt(from);
          if (!nodeAtFrom) return false;
          const newTypeName = mode === 'block' ? 'blockMath' : 'inlineMath';
          const nodeType = state.schema.nodes[newTypeName];
          const newNode = nodeType.create({ ...(nodeAtFrom.attrs || {}), latex: value });
          if (!newNode) return false;
          tr.replaceWith(from, to, newNode);
          dispatch?.(tr);
          return true;
        }).run();
        if (success) { setEditExisting(null); setEditRange(null); return true; }
      } catch {}
      setEditExisting(null); setEditRange(null);
    }

    try {
      if (mode === 'inline') {
        if (anyEditor?.chain().focus().insertInlineMath({ latex: value }).run()) return true;
      } else {
        if (anyEditor?.chain().focus().insertBlockMath({ latex: value }).run()) return true;
      }
    } catch {}

    try {
      if (mode === 'inline') {
        if (anyEditor.chain().focus().insertContent({ type: 'inlineMath', attrs: { latex: value } }).run()) return true;
      } else {
        if (anyEditor.chain().focus().insertContent({ type: 'blockMath', attrs: { latex: value } }).run()) return true;
      }
    } catch {}

    if (mode === 'inline') {
      return anyEditor.chain().focus().insertContent(`$$${value}$$`).run();
    }
    return anyEditor.chain().focus().insertContent(`\n$$$${value}$$$\n`).run();
  }, [editor, editExisting, editRange]);

  const editorState = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      }
    },
  });

  return (
    <div className="control-group">
      <div className="button-group flex flex-wrap gap-1 mb-2 text-xs relative z-10">
        <button title="Bold" aria-label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editorState.canBold} className={clsx('p-2 rounded border', editorState.isBold && 'bg-indigo-600 text-white')}>
          <IconBold className="h-4 w-4" />
        </button>
        <button title="Italic" aria-label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editorState.canItalic} className={clsx('p-2 rounded border', editorState.isItalic && 'bg-indigo-600 text-white')}>
          <IconItalic className="h-4 w-4" />
        </button>
        <button title="Strike" aria-label="Strike" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editorState.canStrike} className={clsx('p-2 rounded border', editorState.isStrike && 'bg-indigo-600 text-white')}>
          <IconStrikethrough className="h-4 w-4" />
        </button>
        <button title="Code" aria-label="Code" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editorState.canCode} className={clsx('p-2 rounded border', editorState.isCode && 'bg-indigo-600 text-white')}>
          <IconCode className="h-4 w-4" />
        </button>
        <button title="Paragraph" aria-label="Paragraph" onClick={() => editor.chain().focus().setParagraph().run()} className={clsx('p-2 rounded border', editorState.isParagraph && 'bg-indigo-600 text-white')}>
          <IconPilcrow className="h-4 w-4" />
        </button>
        <button title="H1" aria-label="Heading 1" onClick={() => applyHeading(1)} className={clsx('p-2 rounded border', editorState.isHeading1 && 'bg-indigo-600 text-white')}>
          <span className="text-[10px] font-semibold">H1</span>
        </button>
        <button title="H2" aria-label="Heading 2" onClick={() => applyHeading(2)} className={clsx('p-2 rounded border', editorState.isHeading2 && 'bg-indigo-600 text-white')}>
          <span className="text-[10px] font-semibold">H2</span>
        </button>
        <button title="H3" aria-label="Heading 3" onClick={() => applyHeading(3)} className={clsx('p-2 rounded border', editorState.isHeading3 && 'bg-indigo-600 text-white')}>
          <span className="text-[10px] font-semibold">H3</span>
        </button>
        <button title="H4" aria-label="Heading 4" onClick={() => applyHeading(4)} className={clsx('p-2 rounded border', editorState.isHeading4 && 'bg-indigo-600 text-white')}>
          <span className="text-[10px] font-semibold">H4</span>
        </button>
        <button title="Bulleted list" aria-label="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={clsx('p-2 rounded border', editorState.isBulletList && 'bg-indigo-600 text-white')}>
          <IconListBullet className="h-4 w-4" />
        </button>
        <button title="Ordered list" aria-label="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={clsx('p-2 rounded border', editorState.isOrderedList && 'bg-indigo-600 text-white')}>
          <IconListOrdered className="h-4 w-4" />
        </button>
        <button title="Code block" aria-label="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={clsx('p-2 rounded border', editorState.isCodeBlock && 'bg-indigo-600 text-white')}>
          <IconBraces className="h-4 w-4" />
        </button>
        <button title="Quote" aria-label="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={clsx('p-2 rounded border', editorState.isBlockquote && 'bg-indigo-600 text-white')}>
          <IconQuote className="h-4 w-4" />
        </button>
        <button title="Horizontal rule" aria-label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-2 rounded border"><IconHR className="h-4 w-4" /></button>
        <button title="Hard break" aria-label="Hard break" onClick={() => editor.chain().focus().setHardBreak().run()} className="p-2 rounded border"><IconReturn className="h-4 w-4" /></button>
        <button title="Undo" aria-label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editorState.canUndo} className="p-2 rounded border disabled:opacity-50"><IconUndo className="h-4 w-4" /></button>
        <button title="Redo" aria-label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editorState.canRedo} className="p-2 rounded border disabled:opacity-50"><IconRedo className="h-4 w-4" /></button>
        <Popover.Root open={mathOpen} onOpenChange={setMathOpen}>
          <Popover.Trigger asChild>
            <button type="button" className="p-2 rounded border" title="Math" aria-label="Math"><IconMath className="h-4 w-4" /></button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" align="start" sideOffset={6} onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()} className="z-50 rounded-md border border-slate-700/70 bg-slate-900/95 p-3 shadow-xl shadow-black/50 w-72 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Insert LaTeX</div>
              <input
                autoFocus
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    insertLatex(latex.trim(), 'inline');
                    setMathOpen(false);
                  } else if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    insertLatex(latex.trim(), 'block');
                    setMathOpen(false);
                  }
                }}
                placeholder="e.g. x^2 + y^2 = z^2"
                className="w-full rounded bg-slate-800/70 border border-slate-700/70 px-2 py-1 text-sm focus:outline-none focus:ring-0"
              />
              <div className="text-[10px] text-slate-500">Cmd/Ctrl+Enter inserts inline, Shift+Enter inserts block</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewMode('inline')} className={clsx('text-[11px] px-2 py-1 rounded border', previewMode === 'inline' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800/60 border-slate-700/70')}>Preview: Inline</button>
                <button type="button" onClick={() => setPreviewMode('block')} className={clsx('text-[11px] px-2 py-1 rounded border', previewMode === 'block' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800/60 border-slate-700/70')}>Preview: Block</button>
              </div>
              <div className="rounded-md bg-slate-800/50 border border-slate-700/70 p-2 min-h-10 overflow-x-auto">
                <div className="text-sm katex-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { insertLatex(latex.trim(), 'inline'); setMathOpen(false); }} className="flex-1 text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500">Insert Inline</button>
                <button onClick={() => { insertLatex(latex.trim(), 'block'); setMathOpen(false); }} className="flex-1 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Insert Block</button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}

