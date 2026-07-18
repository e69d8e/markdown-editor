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

# Package installers (outputs to dist/)
npm run build:mac    # macOS .dmg + .zip
npm run build:win    # Windows .exe (NSIS installer)
npm run build:linux  # Linux .AppImage + .deb
npm run build:all    # All platforms
```

There is no test suite, linter, or formatter configured.

## Architecture

The app uses `electron-vite` which manages three separate build targets configured in `electron.vite.config.ts`:

- **main** — Entry: `electron/main.ts`, uses `externalizeDepsPlugin()` to keep Node dependencies external
- **preload** — Entry: `electron/preload.ts`, same externalize plugin
- **renderer** — Root: `src/`, entry: `src/index.html`, uses `@vitejs/plugin-react`

### Electron Main Process (`electron/`)

- `electron/main.ts` — Creates BrowserWindow (1200×800, min 800×600), native application menu with Chinese labels (文件/编辑/视图/窗口), and IPC handlers for file/folder dialogs. Enforces single-instance lock; handles macOS `open-file` event and command-line file arguments (`.md`/`.markdown`/`.txt`).
- `electron/preload.ts` — Exposes `window.electronAPI` via `contextBridge`. Defines the `ElectronAPI` and `FileEntry` interfaces used by both main and renderer. Event listeners return cleanup functions for proper removal.

### IPC Communication

Two patterns:

**Request-Response** (`ipcRenderer.invoke` / `ipcMain.handle`):
`dialog-open-file`, `dialog-open-folder`, `dialog-save-file`, `read-directory`, `read-file-content`, `get-initial-file`

**Push from Main** (`mainWindow.webContents.send` / `ipcRenderer.on`):
`menu-new-file`, `menu-save-file`, `menu-save-as`, `file-opened`, `folder-opened`

The `ElectronAPI` interface is declared in `electron/preload.ts` and re-declared globally in `src/hooks/useMarkdown.ts` for type access in the renderer.

### Renderer Process (`src/`)

- `src/main.tsx` — React entry point, mounts `<App />`.
- `src/index.html` — Loads Google Fonts: Outfit (UI body), Lora (serif headings), Fira Code (monospace code).
- `src/components/App.tsx` — Root component. Manages view mode state (`source` | `wysiwyg` | `split`), split-pane ratio with drag resizing, sidebar open state, and scroll sync between editor and preview using ratio-based scrolling with a 50ms debounce flag.
- `src/components/Editor.tsx` — CodeMirror 6 wrapper. **Rebuilds the entire editor instance when `viewMode` changes** (the `useEffect` depends on `[viewMode]`). Content sync is a separate `useEffect` on `[content]`. Key bindings: Mod+B (bold), Mod+I (italic), Mod+` (inline code), Mod+K (link). In `wysiwyg` mode, disables line numbers/fold gutter/active line gutter and injects the `livePreview` plugin. Includes `createSearchCountPlugin()` for "X / Y" match counts in the search panel.
- `src/components/Preview.tsx` — Renders HTML from markdown-it via `dangerouslySetInnerHTML`. Exposes `scrollToRatio()` via `forwardRef`/`useImperativeHandle`. Handles copy-to-clipboard on code blocks via click delegate.
- `src/components/Toolbar.tsx` — Formatting buttons and view mode switcher. Operates directly on the CodeMirror `EditorView` instance passed via `editorRef`. `insertMarkdown(before, after)` wraps selection; `insertLinePrefix(prefix)` replaces heading/list/quote prefixes on the current line. Displays file path, word/character/line stats, and view mode toggles.
- `src/components/Sidebar.tsx` — Lazy-loading folder tree. Directories load on expand via `electronAPI.readDirectory()`. Only `.md`/`.markdown` files are clickable; other files are visually disabled. Recursive `renderNode()` with depth-based indentation.
- `src/hooks/useMarkdown.ts` — Central state hook. Holds `content`, `filePath`, `html`. Configures markdown-it with `html: true`, `linkify: true`, `typographer: true`, and highlight.js for code blocks. Custom fence renderer wraps code blocks in `div.code-block-wrapper` with language header and copy button. Word counting supports CJK characters (each CJK char counts as one word). Registers Electron menu event listeners and cleans up on unmount.
- `src/plugins/livePreview.ts` — CodeMirror `ViewPlugin` that replaces raw Markdown syntax with styled decorations in-place. The **active line** always shows raw Markdown for editing; all other lines get visual decorations.

### WYSIWYG Plugin Details (`livePreview.ts`)

Decoration types:
- `Decoration.replace()` with custom `WidgetType` subclasses: `HrWidget`, `BulletWidget`, `NumberWidget`, `ImageWidget`, `CheckboxWidget`, `CodeBlockHeaderWidget`
- `Decoration.mark()` for inline styles: `cm-bold`, `cm-italic`, `cm-strikethrough`, `cm-inline-code`, `cm-link`, `cm-heading-1`–`cm-heading-6`, `cm-blockquote`, `cm-list-item`, `cm-hidden-marker`
- `Decoration.line()` for line-level styling (code blocks, blockquotes)

Processing order per line: code blocks (tracked via `inCodeBlock` flag) → blockquotes (with lazy continuation) → headings → horizontal rules → unordered lists → ordered lists → inline elements. An `occupied` ranges array prevents double-decoration of overlapping syntax.

### Key Patterns

- **Editor rebuild on mode change**: `Editor.tsx` destroys and recreates the CodeMirror instance when `viewMode` changes. Content sync is a separate effect.
- **IPC communication**: Renderer never accesses Node.js APIs directly. All file I/O goes through the preload bridge.
- **Scroll sync**: Ratio-based scrolling. A 50ms debounce flag (`isEditorScrolling`/`isPreviewScrolling`) prevents feedback loops.
- **WYSIWYG active line**: The line with the cursor always shows raw Markdown; all other lines are decorated.

## Design System

See `DESIGN.md` for the full design token specification (colors, typography, spacing, component tokens). The app uses a warm cream/coral/navy palette:
- Primary: coral `#cc785c`, Canvas: cream `#faf9f5`, Ink: dark `#141413`
- Fonts: Outfit (UI), Lora (serif headings), Fira Code (code)

## CI/CD

GitHub Actions (`.github/workflows/build.yml`) runs a matrix build on macOS/Windows/Ubuntu with Node 24. On tag pushes (`v*`), creates a GitHub Release with all installer artifacts.

## Packaging

`electron-builder` config is embedded in `package.json` (appId: `com.li.markdown-editor`). Registers `.md` file association. macOS builds require macOS; Windows/Linux builds on macOS require Wine (`brew install wine`). Build outputs go to `dist/`.
