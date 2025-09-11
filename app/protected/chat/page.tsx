"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import clsx from 'clsx';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Mathematics from '@tiptap/extension-mathematics';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Color, TextStyle } from '@tiptap/extension-text-style'
import * as Popover from '@radix-ui/react-popover';
import katex from 'katex';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

// Local hook replicating the behavior expected by provided MenuBar code
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

// Provided MenuBar code inserted verbatim (with local hook)
function MenuBar({ editor }: { editor: Editor }) {
  const [latex, setLatex] = useState<string>('x^2');

  // Apply heading to the current block (or selection of blocks)
  const applyHeading = useCallback((level: 1 | 2 | 3 | 4 | 5 | 6) => {
    editor.chain().focus().toggleHeading({ level }).run();
  }, [editor]);
  const [mathOpen, setMathOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'inline' | 'block'>('inline');
  // Highlight UI state
  const [hlColor, setHlColor] = useState<string>('#fef08a');
  // Text color UI state
  const [tcColor, setTcColor] = useState<string>('#ef4444');
  const [editExisting, setEditExisting] = useState<null | 'inline' | 'block'>(null);
  const [editRange, setEditRange] = useState<null | { from: number; to: number }>(null);
  const previewHtml = useMemo(() => {
    try {
      return katex.renderToString(latex || '', { throwOnError: false, displayMode: previewMode === 'block' });
    } catch {
      return '';
    }
  }, [latex, previewMode]);

  // Listen for clicks on math nodes to open the popover in edit mode
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

  // Helper that attempts insertion or edit of math nodes
  const insertLatex = useCallback((value: string, mode: 'inline' | 'block') => {
    const anyEditor = editor as any;

    // First, if editing an existing node and we have its range, update in place using extension commands or replace
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

    // 1) Use extension commands
    try {
      if (mode === 'inline') {
        if (anyEditor?.chain().focus().insertInlineMath({ latex: value }).run()) return true;
      } else {
        if (anyEditor?.chain().focus().insertBlockMath({ latex: value }).run()) return true;
      }
    } catch {}

    // 2) JSON nodes
    try {
      if (mode === 'inline') {
        if (anyEditor.chain().focus().insertContent({ type: 'inlineMath', attrs: { latex: value } }).run()) return true;
      } else {
        if (anyEditor.chain().focus().insertContent({ type: 'blockMath', attrs: { latex: value } }).run()) return true;
      }
    } catch {}

    // 3) TeX delimiter fallback matching this extension's input rules (inline: $$, block: $$$)
    if (mode === 'inline') {
      return anyEditor.chain().focus().insertContent(`$$${value}$$`).run();
    }
    return anyEditor.chain().focus().insertContent(`\n$$$${value}$$$\n`).run();
  }, [editor, editExisting, editRange]);

  // Read the current editor's state, and re-render the component when it changes
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
        isHighlight: ctx.editor.isActive('highlight') ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        isAlignLeft: ctx.editor.isActive({ textAlign: 'left' }) ?? false,
        isAlignCenter: ctx.editor.isActive({ textAlign: 'center' }) ?? false,
        isAlignRight: ctx.editor.isActive({ textAlign: 'right' }) ?? false,
        isAlignJustify: ctx.editor.isActive({ textAlign: 'justify' }) ?? false,
        currentColor: (ctx.editor.getAttributes('textStyle')?.color || null) as string | null,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      }
    },
  })

  return (
    <div className="control-group">
      <div className="button-group flex flex-wrap gap-1 mb-2 text-xs relative z-10">
      {/* Format group */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button title="Format" aria-label="Format" className="p-2 rounded border"><IconBold className="h-4 w-4" /></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-2 shadow-xl shadow-black/50 space-x-2 flex">
            <div className="flex gap-1">
              <button title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editorState.canBold} className={clsx('p-2 rounded border', editorState.isBold && 'bg-indigo-600 text-white')}><IconBold className="h-4 w-4"/></button>
              <button title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editorState.canItalic} className={clsx('p-2 rounded border', editorState.isItalic && 'bg-indigo-600 text-white')}><IconItalic className="h-4 w-4"/></button>
              <button title="Strike" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editorState.canStrike} className={clsx('p-2 rounded border', editorState.isStrike && 'bg-indigo-600 text-white')}><IconStrikethrough className="h-4 w-4"/></button>
              <button title="Code" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editorState.canCode} className={clsx('p-2 rounded border', editorState.isCode && 'bg-indigo-600 text-white')}><IconCode className="h-4 w-4"/></button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Block group */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button title="Blocks" aria-label="Blocks" className="p-2 rounded border"><IconPilcrow className="h-4 w-4" /></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-3 shadow-xl shadow-black/50 space-y-2">
            <div className="flex gap-1">
              <button title="Paragraph" onClick={() => editor.chain().focus().setParagraph().run()} className={clsx('p-2 rounded border', editorState.isParagraph && 'bg-indigo-600 text-white')}><IconPilcrow className="h-4 w-4"/></button>
              <button title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={clsx('p-2 rounded border', editorState.isBlockquote && 'bg-indigo-600 text-white')}><IconQuote className="h-4 w-4"/></button>
              <button title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={clsx('p-2 rounded border', editorState.isCodeBlock && 'bg-indigo-600 text-white')}><IconBraces className="h-4 w-4"/></button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[1,2,3,4].map((lvl)=> (
                <button key={lvl} title={`H${lvl}`} onClick={() => applyHeading(lvl as any)} className={clsx('p-2 rounded border', editor.isActive('heading',{level:lvl}) && 'bg-indigo-600 text-white')}><span className="text-[10px] font-semibold">H{lvl}</span></button>
              ))}
            </div>
            <div className="flex gap-1">
              <button title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-2 rounded border"><IconHR className="h-4 w-4"/></button>
              <button title="Hard break" onClick={() => editor.chain().focus().setHardBreak().run()} className="p-2 rounded border"><IconReturn className="h-4 w-4"/></button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Lists group */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button title="Lists" aria-label="Lists" className="p-2 rounded border"><IconListBullet className="h-4 w-4" /></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-2 shadow-xl shadow-black/50 flex gap-1">
            <button title="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={clsx('p-2 rounded border', editorState.isBulletList && 'bg-indigo-600 text-white')}><IconListBullet className="h-4 w-4"/></button>
            <button title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={clsx('p-2 rounded border', editorState.isOrderedList && 'bg-indigo-600 text-white')}><IconListOrdered className="h-4 w-4"/></button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Align group */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button title="Align" aria-label="Align" className="p-2 rounded border"><IconAlignCenter className="h-4 w-4" /></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-2 shadow-xl shadow-black/50 flex gap-1">
            <button title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={clsx('p-2 rounded border', editorState.isAlignLeft && 'bg-indigo-600 text-white')}><IconAlignLeft className="h-4 w-4"/></button>
            <button title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={clsx('p-2 rounded border', editorState.isAlignCenter && 'bg-indigo-600 text-white')}><IconAlignCenter className="h-4 w-4"/></button>
            <button title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={clsx('p-2 rounded border', editorState.isAlignRight && 'bg-indigo-600 text-white')}><IconAlignRight className="h-4 w-4"/></button>
            <button title="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={clsx('p-2 rounded border', editorState.isAlignJustify && 'bg-indigo-600 text-white')}><IconAlignJustify className="h-4 w-4"/></button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Style group (text color + highlight) */}
      <Popover.Root open={styleOpen} onOpenChange={setStyleOpen}>
        <Popover.Trigger asChild>
          <button title="Style" aria-label="Style" onClick={(e)=>{e.preventDefault(); setStyleOpen(o=>!o);}} className="p-2 rounded border"><IconPalette className="h-4 w-4"/></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-3 shadow-xl shadow-black/50 w-[26rem] sm:w-[30rem] max-w-[95vw] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div className="rounded-md border border-slate-700/70 p-2 bg-slate-800/40">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Text</div>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['#ef4444','#22c55e','#3b82f6','#a855f7','#f59e0b','#e5e7eb','#14b8a6'].map(c => (
                    <button key={c} title={c} aria-label={`Text color ${c}`} onClick={() => { editor.chain().focus().setColor(c).run(); setTcColor(c); setStyleOpen(false); }} className="h-6 w-6 rounded border border-slate-600/60" style={{ backgroundColor: c }} />
                  ))}
                  <button title="Clear" onClick={() => { editor.chain().focus().unsetColor().run(); setStyleOpen(false); }} className="col-span-2 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70">Clear</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={tcColor || '#000000'} onChange={(e)=> setTcColor(e.target.value)} className="h-6 w-10 rounded border border-slate-600/60 bg-slate-800/60" />
                  <input value={tcColor} onChange={(e)=> setTcColor(e.target.value)} className="flex-1 rounded bg-slate-800/70 border border-slate-700/70 px-2 py-1 text-xs focus:outline-none focus:ring-0" />
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={()=> { editor.chain().focus().setColor(tcColor).run(); setStyleOpen(false); }} className="text-[11px] px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500">Apply</button>
                </div>
              </div>
              <div className="rounded-md border border-slate-700/70 p-2 bg-slate-800/40">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Highlight</div>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['#fef08a','#bbf7d0','#bfdbfe','#fbcfe8','#e9d5ff','#fed7aa','#e5e7eb'].map(c => (
                    <button key={c} title={c} aria-label={`Highlight ${c}`} onClick={() => { editor.chain().focus().setHighlight({ color: c }).run(); setHlColor(c); setStyleOpen(false); }} className="h-6 w-6 rounded border border-slate-600/60" style={{ backgroundColor: c }} />
                  ))}
                  <button title="Clear" onClick={() => { editor.chain().focus().unsetHighlight().run(); setStyleOpen(false); }} className="col-span-2 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70">Clear</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={hlColor} onChange={(e)=> setHlColor(e.target.value)} className="h-6 w-10 rounded border border-slate-600/60 bg-slate-800/60" />
                  <input value={hlColor} onChange={(e)=> setHlColor(e.target.value)} className="flex-1 rounded bg-slate-800/70 border border-slate-700/70 px-2 py-1 text-xs focus:outline-none focus:ring-0" />
                </div>
                <div className="flex justify-end mt-2">
                  <button onClick={()=> { editor.chain().focus().setHighlight({ color: hlColor }).run(); setStyleOpen(false); }} className="text-[11px] px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500">Apply</button>
                </div>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Table group */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button title="Table" aria-label="Table" className="p-2 rounded border"><IconTable className="h-4 w-4"/></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-3 shadow-xl shadow-black/50 w-[18rem] space-y-2">
            <div className="flex gap-2">
              <button className="px-2 py-1 text-xs rounded border" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insert 3x3</button>
              <button className="px-2 py-1 text-xs rounded border" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().addColumnBefore().run()}>Add column before</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column after</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().addRowBefore().run()}>Add row before</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().addRowAfter().run()}>Add row after</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>Toggle header column</button>
              <button className="px-2 py-1 rounded border" onClick={() => editor.chain().focus().toggleHeaderCell().run()}>Toggle header cell</button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* History group */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button title="History" aria-label="History" className="p-2 rounded border"><IconUndo className="h-4 w-4" /></button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="start" sideOffset={6} collisionPadding={8} onOpenAutoFocus={(e)=>e.preventDefault()} className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-2 shadow-xl shadow-black/50 flex gap-1">
            <button title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editorState.canUndo} className="p-2 rounded border disabled:opacity-50"><IconUndo className="h-4 w-4"/></button>
            <button title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editorState.canRedo} className="p-2 rounded border disabled:opacity-50"><IconRedo className="h-4 w-4"/></button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Math popover for entering LaTeX with live preview */}
      <Popover.Root open={mathOpen} onOpenChange={setMathOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setMathOpen(o => !o); }}
            className="p-2 rounded border"
            title="Math"
            aria-label="Math"
          >
            <IconMath className="h-4 w-4" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="center"
            sideOffset={6}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="z-[1000] rounded-md border border-slate-700/70 bg-slate-900/95 p-3 shadow-xl shadow-black/50 w-72 max-w-[90vw] max-h-[70vh] overflow-auto space-y-2"
          >
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
            <button
              type="button"
              onClick={() => setPreviewMode('inline')}
              className={clsx('text-[11px] px-2 py-1 rounded border', previewMode === 'inline' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800/60 border-slate-700/70')}
            >
              Preview: Inline
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('block')}
              className={clsx('text-[11px] px-2 py-1 rounded border', previewMode === 'block' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800/60 border-slate-700/70')}
            >
              Preview: Block
            </button>
          </div>
          <div className="rounded-md bg-slate-800/50 border border-slate-700/70 p-2 min-h-10 overflow-x-auto">
            <div className="text-sm katex-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { insertLatex(latex.trim(), 'inline'); setMathOpen(false); }}
              className="flex-1 text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500"
            >
              Insert Inline
            </button>
            <button
              onClick={() => { insertLatex(latex.trim(), 'block'); setMathOpen(false); }}
              className="flex-1 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            >
              Insert Block
            </button>
          </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  </div>
  )
}

function MessageBody({ html }: { html?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const root = ref.current;
    // Render inline math
    const inlineEls = root.querySelectorAll('span[data-type="inline-math"]');
    inlineEls.forEach((el) => {
      const latex = (el as HTMLElement).getAttribute('data-latex') || '';
      try { katex.render(latex, el as HTMLElement, { throwOnError: false, displayMode: false }); } catch {}
    });
    // Render block math
    const blockEls = root.querySelectorAll('div[data-type="block-math"]');
    blockEls.forEach((el) => {
      const latex = (el as HTMLElement).getAttribute('data-latex') || '';
      try { katex.render(latex, el as HTMLElement, { throwOnError: false, displayMode: true }); } catch {}
    });
  });
  if (!html) return null;
  return <div ref={ref} className="prose prose-invert max-w-none text-sm break-words" dangerouslySetInnerHTML={{ __html: html }} />;
}
interface Room { id: string; name: string; _count?: { messages: number }; }
interface Message { id: string; content?: string; createdAt: string; sender: any; attachments?: any[]; type: string; pending?: boolean; }
interface User { id: string; email: string; }

export default function ChatPage() {
  const { data: session } = useSession();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [composerHeight, setComposerHeight] = useState<number>(56);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roomMembers, setRoomMembers] = useState<User[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [roomName, setRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [olderIOEnabled, setOlderIOEnabled] = useState(false);
  // Attachments state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  // Image viewer
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState<number>(1);
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

  // (Original inline MenuBar removed; using provided MenuBar above)

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

  // Fetch rooms
  useEffect(() => {
    const load = async () => {
      setRoomsLoading(true); setError(null);
      try {
        const r = await fetch('/api/chat/rooms');
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load rooms');
        const list: Room[] = Array.isArray(d.rooms) ? d.rooms.filter(Boolean) : [];
        setRooms(list);
        if (list.length && !activeRoom) setActiveRoom(list[0].id);
      } catch (e: any) { setError(e.message); }
      finally { setRoomsLoading(false); }
    };
    load();
  }, []);

  // Fetch users when modal opens
  useEffect(() => { if(showModal) { fetch('/api/users').then(r=>r.json()).then(d=> setUsers(Array.isArray(d.users)? d.users: [])); } }, [showModal]);
  // Also fetch users when manage members modal opens
  useEffect(() => { if(manageOpen) { fetch('/api/users').then(r=>r.json()).then(d=> setUsers(Array.isArray(d.users)? d.users: [])); } }, [manageOpen]);

  // Load paginated messages (latest 10 first) + SSE subscription
  useEffect(() => {
    if(!activeRoom) { setMessages([]); setRoomMembers([]); setNextCursor(null); return; }
    setMessagesLoading(true); setError(null);
    let cancelled = false;
    const load = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/chat/messages?roomId=${encodeURIComponent(activeRoom)}&take=20`),
          fetch(`/api/chat/room?roomId=${encodeURIComponent(activeRoom)}`),
        ]);
        const d1 = await r1.json();
        const d2 = await r2.json();
        if(!r1.ok) throw new Error(d1.error || 'Failed to load messages');
        if(!r2.ok) throw new Error(d2.error || 'Failed to load room');
        if (!cancelled) {
          setMessages(Array.isArray(d1.messages) ? d1.messages : []);
          setNextCursor(d1.nextCursor || null);
          setRoomMembers(Array.isArray(d2.room?.members) ? d2.room.members : []);
          setShouldAutoScroll(true);
        }
      } catch (e: any) { if(!cancelled) setError(e.message); }
      finally { if(!cancelled) setMessagesLoading(false); }
    };
    load();

    // Tear down previous SSE
    if (esRef.current) { esRef.current.close(); }
    const es = new EventSource(`/api/chat/events?roomId=${encodeURIComponent(activeRoom)}`);
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
          // If user is near bottom, auto-scroll
          const el = listRef.current;
          if (el) {
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (nearBottom) setShouldAutoScroll(true);
          }
        }
      } catch { /* ignore */ }
    });
    es.onerror = () => { /* silent reconnect by browser */ };

    return () => { cancelled = true; es.close(); };
  }, [activeRoom]);

  useEffect(() => {
    if (shouldAutoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShouldAutoScroll(false);
      setOlderIOEnabled(true);
    }
  }, [messages, shouldAutoScroll]);

  // Pause/resume "load older" observer: after one load we pause it; re-enable only after user scrolls away from top and returns
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const THRESH = 80; // px from top considered "at top"
    const onScroll = () => {
      if (root.scrollTop > THRESH) {
        // User moved away from the top; mark ready for next re-enable
        leftTopSinceLastLoadRef.current = true;
        // Make sure the observer is paused while away from top
        if (olderObserverRef.current) {
          olderObserverRef.current.disconnect();
          olderObserverRef.current = null;
        }
        if (olderIOEnabled) setOlderIOEnabled(false);
      } else if (root.scrollTop <= THRESH && leftTopSinceLastLoadRef.current) {
        // User came back to the top; re-enable observing if there are more pages
        if (!olderObserverRef.current && nextCursor) {
          setOlderIOEnabled(true);
        }
      }
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

  const toggleMember = (id: string) => { setSelectedMembers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const createRoom = async () => {
    if(!roomName.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/chat/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: roomName.trim(), memberIds: Array.from(selectedMembers) }) });
      const data = await res.json();
      if(!res.ok || !data.room) throw new Error(data.error || 'Failed to create room');
      setRooms(r => [data.room, ...r]);
      setActiveRoom(data.room.id);
      setShowModal(false); setRoomName(''); setSelectedMembers(new Set());
      if (data.missingMembers?.length) {
        setError(`Skipped ${data.missingMembers.length} unknown member(s).`);
      }
    } catch (e: any) { setError(e.message); }
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

  const activeRoomObj = rooms.find(r => r.id === activeRoom) || null;

  const withinWindow = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) <= 10 * 60 * 1000;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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

function SelectedAttachmentPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
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

  return (
    <div ref={dropRef} className="relative flex h-screen w-screen overflow-hidden bg-[linear-gradient(135deg,#0b1220,45%,#0e1628)] text-slate-100">
      {/* Drag & Drop overlay */}
      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-[200]">
          <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-indigo-400/70 bg-slate-900/70 backdrop-blur-sm grid place-items-center">
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-indigo-200">Drop files to attach</div>
              <div className="text-[11px] text-slate-400">You can add up to {MAX_FILES - selectedFiles.length} more file(s)</div>
            </div>
          </div>
        </div>
      )}
      {/* Mobile overlay trigger */}
      <div className="md:hidden absolute top-2 left-2 z-40">
        <button onClick={()=> setSidebarOpen(o=>!o)} className="px-3 py-2 rounded-md bg-slate-800/70 backdrop-blur border border-slate-700 text-xs font-medium shadow hover:bg-slate-700/70">{sidebarOpen ? 'Close' : 'Rooms'}</button>
    </div>
      {/* Sidebar */}
      <aside className={clsx('flex flex-col shrink-0 w-80 h-full border-r border-slate-800/70 backdrop-blur-xl bg-slate-900/40 transition-transform duration-300', 'md:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')}>
        <div className="p-4 flex items-center justify-between border-b border-slate-800/70">
          <h2 className="font-semibold tracking-wide text-[11px] uppercase text-slate-300">Chats</h2>
          <button className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600/70" onClick={()=> setShowModal(true)}>New</button>
        </div>
        <div className="relative flex-1 overflow-y-auto custom-scroll pb-10">
          {roomsLoading && <div className="p-4 text-xs text-slate-500 animate-pulse">Loading rooms…</div>}
          {!roomsLoading && !rooms.length && <div className="p-4 text-xs text-slate-500">No rooms yet.</div>}
          <ul className="py-2 space-y-1">
            {rooms.map(r => (
              <li key={r.id}>
                <button onClick={()=> { setActiveRoom(r.id); setSidebarOpen(false); }} className={clsx('group w-full text-left px-4 py-3 flex flex-col gap-1 border-l-2 transition-all duration-200', activeRoom===r.id ? 'bg-slate-800/70 border-indigo-400 shadow-inner shadow-indigo-900/30' : 'border-transparent hover:bg-slate-800/40')}> 
                  <span className="font-medium text-sm truncate group-hover:text-indigo-300/90">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Chat Area */}
  <section className="flex-1 flex flex-col h-full min-w-0">
        {!activeRoomObj && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
            <p className="text-sm">Select or create a room to start chatting.</p>
            <button onClick={()=> setShowModal(true)} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium shadow">Create Room</button>
          </div>
        )}
        {activeRoomObj && (
          <>
            <header className="h-14 flex items-center justify-between px-5 border-b border-slate-800/70 bg-slate-900/60 backdrop-blur-xl">
              <div className="flex flex-col">
                <h1 className="font-semibold text-sm leading-tight">{activeRoomObj.name}</h1>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                {messagesLoading && <span className="animate-pulse">Loading…</span>}
                <button
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-[11px]"
                  onClick={() => { setManageOpen(true); }}
                >
                  Members • {roomMembers.length}
                </button>
              </div>
            </header>
            <div ref={listRef} className="relative flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 space-y-3 md:space-y-4 custom-scroll" onClick={()=> setOpenMenuId(null)}>
              {olderLoading && (
                <div className="absolute top-2 left-0 right-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-800/90 border border-slate-700/70 text-[11px]">
                    <IconSpinner className="h-3.5 w-3.5" /> Loading older…
                  </div>
                </div>
              )}
              <div ref={topSentinelRef} className="h-1" />
              {messages.map(m => {
                const mine = m.sender?.id ? (m.sender.id === meId) : (m.sender?.email && m.sender.email === session?.user?.email);
                const showActions = mine && withinWindow(m.createdAt);
                const menuOpen = openMenuId === m.id;
                return (
                  <div key={m.id} className={clsx('flex w-full overflow-visible', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'group relative max-w-[82%] md:max-w-[68%] rounded-2xl px-4 py-2 text-sm shadow/20 shadow-black/40 flex flex-col gap-2 ring-1 ring-transparent transition-all z-0',
                        menuOpen ? 'z-50' : 'z-0',
                        mine ? 'bg-gradient-to-br from-indigo-600/90 to-indigo-500/80 text-white backdrop-blur ring-indigo-400/0 group-hover:ring-indigo-300/40' : 'bg-slate-800/70 backdrop-blur ring-slate-700/80 group-hover:ring-slate-500/50'
                      )}
                      title={new Date(m.createdAt).toLocaleString()}
                    >
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
                            {m.attachments.map(a => (<AttachmentPreview key={a.id || a.url} a={a} onImageClick={(src: string) => { setViewerSrc(src); setViewerZoom(1); }} />))}
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
                        {m.pending && <span className="text-[10px] text-yellow-200/90">sending…</span>}
                        <span className={clsx('text-[10px] tracking-wide uppercase opacity-0 group-hover:opacity-100 transition', mine ? 'text-indigo-100/80' : 'text-slate-400/80')}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!messagesLoading && !messages.length && <div className="text-xs text-slate-500">No messages yet. Start the conversation.</div>}
              <div ref={bottomRef} />
            </div>
            <footer className="p-4 border-t border-slate-800/70 bg-slate-900/60 backdrop-blur-xl flex flex-col gap-3 relative">
              {(error || recordError) && <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/50 px-3 py-1 rounded">{error || recordError}</div>}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 w-10 grid place-items-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/70"
                    disabled={isUploading}
                    title="Attach files"
                    aria-label="Attach files"
                  >
                    <IconPaperclip className="h-4 w-4 text-slate-200" />
                  </button>
                  <button
                    type="button"
                    onClick={() => isRecording ? stopRecording() : startRecording()}
                    className={clsx('h-10 w-10 grid place-items-center rounded-lg border', isRecording ? 'bg-rose-700 border-rose-600 hover:bg-rose-600' : 'bg-slate-800 border-slate-700/70 hover:bg-slate-700')}
                    title={isRecording ? 'Stop recording' : 'Record audio'}
                    aria-label={isRecording ? 'Stop recording' : 'Record audio'}
                    disabled={isUploading}
                  >
                    {isRecording ? <IconStop className="h-4 w-4 text-white" /> : <IconMic className="h-4 w-4 text-slate-200" />}
                  </button>
                  {selectedFiles.length > 0 && (
                    <span className="text-[11px] text-slate-400">{selectedFiles.length}/{MAX_FILES}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="flex flex-col flex-1 min-w-0 gap-2">
                    <div ref={composerRef} className="rounded-lg bg-slate-800/70 border border-slate-700/70 px-3 py-2 shadow-inner shadow-black/30">
                      {editor && <MenuBar editor={editor} />}
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
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const startY = e.clientY;
                            const startH = composerHeight;
                            const onMove = (ev: MouseEvent) => {
                              const delta = ev.clientY - startY;
                              // Top-right handle semantics: drag down reduces height, drag up increases height
                              const nh = Math.max(56, Math.min(startH - delta, Math.floor(window.innerHeight * 0.6)));
                              setComposerHeight(nh);
                            };
                            const onUp = () => {
                              document.removeEventListener('mousemove', onMove);
                              document.removeEventListener('mouseup', onUp);
                            };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 grid place-items-center rounded-md border border-slate-600/70 bg-slate-700/50 hover:bg-slate-600/70 cursor-ns-resize"
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
                <div className="flex items-center gap-2">
                  {editingId ? (
                    <>
                      <button aria-label="Save edit" onClick={saveEdit} className="h-10 px-4 grid place-items-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium shadow-lg shadow-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed" disabled={editorEmpty}>
                        <IconCheck className="h-5 w-5 text-white" />
                      </button>
                      <button aria-label="Cancel edit" onClick={cancelEdit} className="h-10 px-4 grid place-items-center rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                        <IconX className="h-5 w-5 text-white" />
                      </button>
                    </>
                  ) : (
                    <button aria-label="Send" onClick={send} className="h-10 px-4 grid place-items-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium shadow-lg shadow-indigo-950/40 disabled:opacity-40 disabled:cursor-not-allowed" disabled={!canSend}>
                      <IconSend className="h-5 w-5 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </footer>
          </>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900/90 border border-slate-700/70 p-6 space-y-5 shadow-2xl shadow-black/60">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Create Room</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-slate-400">Room Name</label>
                <input value={roomName} onChange={e=> setRoomName(e.target.value)} placeholder="Team Sync" className="w-full rounded-md bg-slate-800/70 border border-slate-700/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scroll pr-1">
                <label className="text-[11px] uppercase tracking-wider text-slate-400">Members</label>
                {users.filter(u=> u.id !== session?.user?.id).map(u=> {
                  const active = selectedMembers.has(u.id);
                  return (
                    <button key={u.id} type="button" onClick={()=> toggleMember(u.id)} className={clsx('w-full flex items-center justify-between rounded-md px-3 py-2 text-xs border transition shadow-sm', active ? 'bg-indigo-600/70 border-indigo-400 text-white shadow-indigo-900/40' : 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800/80')}>{u.email}<span className="opacity-70">{active ? 'Added' : 'Add'}</span></button>
                  );
                })}
                {!users.length && <div className="text-[11px] text-slate-500">Loading users...</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={()=> setShowModal(false)} className="text-xs px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/70">Cancel</button>
              <button onClick={createRoom} disabled={!roomName.trim()} className="text-xs px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed shadow shadow-indigo-900/40">Create</button>
            </div>
          </div>
        </div>
      )}

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
            <button
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs"
              onClick={() => setViewerSrc(null)}
              aria-label="Close"
              title="Close"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="min-h-full w-full flex items-center justify-center">
              <img src={viewerSrc} alt="preview" style={{ transform: `scale(${viewerZoom})` }} className="max-w-none select-none" />
            </div>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900/90 border border-slate-700/70 p-6 space-y-5 shadow-2xl shadow-black/60">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Manage Members</h3>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Current Members</div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scroll pr-1">
                {roomMembers.map(m => (
                  <div key={m.id} className="w-full flex items-center justify-between rounded-md px-3 py-2 text-xs border border-slate-700/70 bg-slate-800/50">
                    <span className="truncate mr-2">{m.email || m.id}</span>
                    <button className="px-2 py-1 rounded bg-rose-700/80 hover:bg-rose-600 text-white"
                      onClick={async ()=>{
                        try {
                          const r = await fetch('/api/chat/room', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: activeRoom, addIds: [], removeIds: [m.id] })});
                          const d = await r.json();
                          if(!r.ok) throw new Error(d.error || 'Failed to remove');
                          setRoomMembers(Array.isArray(d.room?.members) ? d.room.members : []);
                        } catch(e:any) { setError(e.message); }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!roomMembers.length && <div className="text-[11px] text-slate-500">No members</div>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Add New Member</div>
              <input value={addQuery} onChange={(e)=> setAddQuery(e.target.value)} placeholder="Search users…" className="w-full rounded bg-slate-800/70 border border-slate-700/70 px-2 py-1 text-sm focus:outline-none focus:ring-0" />
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scroll pr-1">
                {users
                  .filter(u => u.id !== session?.user?.id)
                  .filter(u => !roomMembers.some(m => m.id === u.id))
                  .filter(u => {
                    const q = addQuery.trim().toLowerCase();
                    if (!q) return true;
                    const t = (u.email || u.id).toLowerCase();
                    return t.includes(q);
                  })
                  .map(u => (
                    <div key={u.id} className="w-full flex items-center justify-between rounded-md px-3 py-2 text-xs border border-slate-700/70 bg-slate-800/50">
                      <span className="truncate mr-2">{u.email || u.id}</span>
                      <button className="px-2 py-1 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white"
                        onClick={async ()=>{
                          try {
                            const r = await fetch('/api/chat/room', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: activeRoom, addIds: [u.id], removeIds: [] })});
                            const d = await r.json();
                            if(!r.ok) throw new Error(d.error || 'Failed to add');
                            setRoomMembers(Array.isArray(d.room?.members) ? d.room.members : []);
                          } catch(e:any) { setError(e.message); }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                {!users.length && <div className="text-[11px] text-slate-500">Loading users...</div>}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={()=> setManageOpen(false)} className="text-xs px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/70">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentPreview({ a, onImageClick }: { a: any; onImageClick?: (src: string) => void }) {
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

function IconSend({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconBold({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M7 4h6.5a3.5 3.5 0 0 1 0 7H7V4zm0 9h7a3.5 3.5 0 1 1 0 7H7v-7z"/></svg>
  );
}
function IconItalic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M10 4h8v2h-3.8l-4.4 12H16v2H8v-2h3.8l4.4-12H10V4z"/></svg>
  );
}
function IconStrikethrough({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M4 11h16v2H4v-2zm6.5 6c0 1 .8 2 2.5 2s2.5-1 2.5-2-.7-1.6-2.4-2.2l-1.1-.4c-2.5-.8-3.9-2-3.9-4.2h2.3c0 1.2.7 1.9 2.6 2.5l1 .3c2.8.9 4 2.1 4 4.1 0 2.2-1.8 4-4.8 4S8.5 19.9 8.5 18h2z"/></svg>
  );
}
function IconCode({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 16 4 12l4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="m16 8 4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
}
function IconPilcrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M10 4h2v16h-2V4zm6 0h2v16h-2V4zM8 10a4 4 0 1 0 0 8h2v-8H8z"/></svg>
  );
}
function IconListBullet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/><path d="M10 6h10v2H10zM10 12h10v2H10zM10 18h10v2H10z"/></svg>
  );
}
function IconListOrdered({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M4 6h2V4H3v2h1zM3 12h3v-2H3v2zm0 6h3v-2H3v2z"/><path d="M10 6h10v2H10zM10 12h10v2H10zM10 18h10v2H10z"/></svg>
  );
}
function IconBraces({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3c-2 0-3 1-3 3v3c0 1-1 2-2 2 1 0 2 1 2 2v3c0 2 1 3 3 3"/><path d="M15 3c2 0 3 1 3 3v3c0 1 1 2 2 2-1 0-2 1-2 2v3c0 2-1 3-3 3"/></svg>
  );
}
function IconQuote({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M5 7h7v6H8v4H5V7zm9 0h7v6h-4v4h-3V7z"/></svg>
  );
}
function IconHR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><rect x="4" y="11" width="16" height="2"/></svg>
  );
}
function IconReturn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 7v6a3 3 0 0 1-3 3H6" strokeLinecap="round"/><path d="M9 10 6 13l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
}
function IconUndo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 7 5 11l4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 11h9a5 5 0 1 1 0 10h-3" strokeLinecap="round"/></svg>
  );
}
function IconRedo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 7 19 11l-4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 11H10a5 5 0 1 0 0 10h3" strokeLinecap="round"/></svg>
  );
}
function IconPalette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 18h14" strokeLinecap="round"/>
      <path d="M12 5l5 12H7L12 5z" fill="currentColor"/>
    </svg>
  );
}
function IconMath({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7h16M8 7l8 10M8 17l8-10"/></svg>
  );
}
function IconResizeNS({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3v8" strokeLinecap="round"/>
      <path d="M9 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 21v-8" strokeLinecap="round"/>
      <path d="M9 18l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
}
function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l12 12M6 18L18 6" strokeLinecap="round"/></svg>
  );
}
function IconPaperclip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 12.5 15.5 5a3.5 3.5 0 1 1 5 5l-8.5 8.5a5 5 0 0 1-7.1-7.1L12 4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconMic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="9" y="3" width="6" height="10" rx="3"/>
      <path d="M5 10v1a7 7 0 0 0 14 0v-1"/>
      <path d="M12 21v-3"/>
    </svg>
  );
}
function IconStop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
  );
}
function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
  );
}
function IconMinus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14" strokeLinecap="round"/></svg>
  );
}
function IconAlignLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16" strokeLinecap="round"/>
      <rect x="4" y="9" width="12" height="3" rx="1" />
      <rect x="4" y="14" width="16" height="3" rx="1" />
    </svg>
  );
}
function IconAlignCenter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16" strokeLinecap="round"/>
      <rect x="6" y="9" width="12" height="3" rx="1" />
      <rect x="4" y="14" width="16" height="3" rx="1" />
    </svg>
  );
}
function IconAlignRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16" strokeLinecap="round"/>
      <rect x="8" y="9" width="12" height="3" rx="1" />
      <rect x="4" y="14" width="16" height="3" rx="1" />
    </svg>
  );
}
function IconAlignJustify({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16" strokeLinecap="round"/>
      <rect x="4" y="9" width="16" height="3" rx="1" />
      <rect x="4" y="14" width="16" height="3" rx="1" />
    </svg>
  );
}
function IconTable({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M3 9h18M8 5v14M16 5v14"/>
    </svg>
  );
}
function IconSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('animate-spin', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8" className="opacity-75" />
    </svg>
  );
}
