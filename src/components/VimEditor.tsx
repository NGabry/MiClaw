"use client";

import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, placeholder as phPlugin } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { vim } from "@replit/codemirror-vim";

// Dark theme matching MiClaw
const miclawTheme = EditorView.theme({
  "&": {
    backgroundColor: "#353430",
    color: "#faf9f5",
    fontSize: "13px",
    fontFamily: "var(--font-geist-mono), monospace",
    borderRadius: "2px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "#d97757",
  },
  ".cm-content": {
    padding: "8px 12px",
    caretColor: "#d97757",
    minHeight: "100px",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-cursor": {
    borderLeftColor: "#d97757",
    borderLeftWidth: "2px",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(217,119,87,0.2) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(217,119,87,0.3) !important",
  },
  ".cm-gutters": {
    backgroundColor: "#2b2a27",
    color: "#7a776e",
    border: "none",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#353430",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  // Vim status bar
  ".cm-vim-panel": {
    backgroundColor: "#2b2a27",
    color: "#b0aea5",
    fontSize: "11px",
    fontFamily: "var(--font-geist-mono), monospace",
    padding: "2px 8px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  ".cm-panels-bottom": {
    borderTop: "none",
  },
  // Placeholder
  ".cm-placeholder": {
    color: "#7a776e",
  },
});

interface VimEditorProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: (el: HTMLElement | null) => void;
}

export function VimEditor({ onSubmit, placeholder = "", disabled = false, inputRef }: VimEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const submitAndClear = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const text = view.state.doc.toString().trim();
    if (!text) return;
    onSubmitRef.current(text);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const submitKeymap = keymap.of([{
      key: "Ctrl-Enter",
      run: () => { submitAndClear(); return true; },
    }]);

    const state = EditorState.create({
      doc: "",
      extensions: [
        vim(),
        submitKeymap,
        markdown(),
        miclawTheme,
        EditorView.lineWrapping,
        phPlugin(placeholder),
        EditorState.readOnly.of(disabled),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (inputRef) {
      inputRef(view.contentDOM);
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <div className="relative">
      <div ref={containerRef} />
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] font-mono text-text-dim">
          vim enabled -- ctrl+enter to send
        </span>
        <button
          onClick={submitAndClear}
          disabled={disabled}
          className="px-3 py-1 bg-accent/15 text-accent border border-accent/30 rounded-sm
            hover:bg-accent/25 transition-colors disabled:opacity-30
            font-mono text-xs"
        >
          Send
        </button>
      </div>
    </div>
  );
}
