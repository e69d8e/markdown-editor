# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An Electron-based desktop Markdown editor with live preview, built with React, TypeScript, and CodeMirror 6. Supports three view modes: source code, WYSIWYG (in-place preview), and split-pane.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev mode (Vite dev server + Electron)
npm run build        # Build for production (outputs to out/)
npm run preview      # Preview production build
```

There is no test suite, linter, or formatter configured.

## Architecture

The app uses `electron-vite` which manages three separate build targets configured in `electron.vite.config.ts`:

### Electron Main Process (`electron/`)

- `electron/main.ts` — Creates BrowserWindow, application menu (Chinese labels), and IPC handlers for file open/save dialogs. Menu accelerators: Cmd/Ctrl+N (new), O (open), S (save), Shift+S (save as).
- `electron/preload.ts` — Exposes `window.electronAPI` via `contextBridge` with `openFile()`, `saveFile()`, and menu event listeners (`onNewFile`, `onFileOpened`, `onSaveFile`, `onSaveAs`). All IPC uses `invoke`/`handle` (request-response) or `send`/`on` (push from main).

### Renderer Process (`src/`)

- `src/main.tsx` — React entry point, mounts `<App />`.
- `src/components/App.tsx` — Root component. Manages view mode state (`source` | `wysiwyg` | `split`), split-pane ratio with drag resizing, and scroll sync between editor and preview.
- `src/components/Editor.tsx` — CodeMirror 6 wrapper. Rebuilds the entire editor instance when `viewMode` changes (not when content changes). Key bindings: Mod+B (bold), Mod+I (italic), Mod+` (inline code), Mod+K (link). In `wysiwyg` mode, line numbers, fold gutter, and active line gutter are disabled, and the `livePreview` plugin is injected.
- `src/components/Preview.tsx` — Renders HTML from markdown-it. Exposes `scrollToRatio()` via `forwardRef`/`useImperativeHandle` for scroll sync.
- `src/components/Toolbar.tsx` — Formatting buttons and view mode switcher. Operates directly on the CodeMirror `EditorView` instance passed via `editorRef`.
- `src/hooks/useMarkdown.ts` — Central state hook. Holds `content`, `filePath`, `html`. Configures markdown-it with `html: true`, `linkify: true`, `typographer: true`, and highlight.js for code blocks. Registers Electron menu event listeners and cleans them up on unmount.
- `src/plugins/livePreview.ts` — CodeMirror `ViewPlugin` that replaces raw Markdown syntax with styled decorations in-place. Shows the active line as raw Markdown (for editing); all other lines render with inline decorations (bold, italic, links, images, code, checkboxes, headings, lists, blockquotes, hr). Custom `WidgetType` subclasses: `HrWidget`, `BulletWidget`, `NumberWidget`, `ImageWidget`, `CheckboxWidget`.

### Key Patterns

- **Editor rebuild on mode change**: `Editor.tsx` destroys and recreates the CodeMirror instance when `viewMode` changes (the `useEffect` depends on `[viewMode]`). Content sync is a separate `useEffect` on `[content]`.
- **IPC communication**: Renderer never accesses Node.js APIs directly. All file I/O goes through the preload bridge. The `ElectronAPI` interface is declared both in `electron/preload.ts` and globally in `src/hooks/useMarkdown.ts`.
- **Scroll sync**: Uses ratio-based scrolling. A 50ms debounce flag (`isEditorScrolling`/`isPreviewScrolling`) prevents feedback loops.
- **WYSIWYG plugin**: Uses CodeMirror's `Decoration.replace()` and `Decoration.mark()` to hide Markdown syntax and apply styled classes. The active line is always shown raw so the user can edit the source.
