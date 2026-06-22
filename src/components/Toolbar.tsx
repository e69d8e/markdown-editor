import { EditorView } from '@codemirror/view'
import { ViewMode } from './App'
import '../styles/Toolbar.css'

interface ToolbarProps {
  filePath: string | null
  stats: { words: number; chars: number; lines: number }
  editorRef: React.MutableRefObject<EditorView | null>
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export default function Toolbar({
  filePath,
  stats,
  editorRef,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  viewMode,
  onViewModeChange
}: ToolbarProps) {
  const insertMarkdown = (before: string, after: string) => {
    const view = editorRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to) || '文本'
    const replacement = before + selected + after

    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: {
        anchor: from + before.length,
        head: from + before.length + selected.length
      }
    })
    view.focus()
  }

  const insertLinePrefix = (prefix: string) => {
    const view = editorRef.current
    if (!view) return

    const { from, to } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    // 去除已有的标题/列表/引用前缀再添加新前缀
    const stripped = line.text.replace(/^(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)/, '')
    const replacement = prefix + stripped

    const lengthDiff = replacement.length - line.text.length
    const newAnchor = Math.max(line.from, from + lengthDiff)
    const newHead = Math.max(line.from, to + lengthDiff)

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: replacement },
      selection: { anchor: newAnchor, head: newHead }
    })
    view.focus()
  }

  // 根据平台显示快捷键修饰符
  const modKey = navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={onNew} onMouseDown={(e) => e.preventDefault()} title={`新建 (${modKey}+N)`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </button>
        <button onClick={onOpen} onMouseDown={(e) => e.preventDefault()} title={`打开 (${modKey}+O)`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button onClick={onSave} onMouseDown={(e) => e.preventDefault()} title={`保存 (${modKey}+S)`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </button>
        <button onClick={onSaveAs} onMouseDown={(e) => e.preventDefault()} title={`另存为 (${modKey}+Shift+S)`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={() => insertMarkdown('**', '**')} onMouseDown={(e) => e.preventDefault()} title={`加粗 (${modKey}+B)`}>
          <strong>B</strong>
        </button>
        <button onClick={() => insertMarkdown('*', '*')} onMouseDown={(e) => e.preventDefault()} title={`斜体 (${modKey}+I)`}>
          <em>I</em>
        </button>
        <button onClick={() => insertMarkdown('~~', '~~')} onMouseDown={(e) => e.preventDefault()} title="删除线">
          <s>S</s>
        </button>
        <button onClick={() => insertMarkdown('`', '`')} onMouseDown={(e) => e.preventDefault()} title={`行内代码 (${modKey}+\`)`}>
          <code>{'</>'}</code>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={() => insertLinePrefix('# ')} onMouseDown={(e) => e.preventDefault()} title="标题1">
          H1
        </button>
        <button onClick={() => insertLinePrefix('## ')} onMouseDown={(e) => e.preventDefault()} title="标题2">
          H2
        </button>
        <button onClick={() => insertLinePrefix('### ')} onMouseDown={(e) => e.preventDefault()} title="标题3">
          H3
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={() => insertLinePrefix('- ')} onMouseDown={(e) => e.preventDefault()} title="无序列表">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button onClick={() => insertLinePrefix('1. ')} onMouseDown={(e) => e.preventDefault()} title="有序列表">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10h2" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </svg>
        </button>
        <button onClick={() => insertLinePrefix('> ')} onMouseDown={(e) => e.preventDefault()} title="引用">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
          </svg>
        </button>
        <button onClick={() => insertMarkdown('\n```\n', '\n```\n')} onMouseDown={(e) => e.preventDefault()} title="代码块">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* 视图模式切换 */}
      <div className="toolbar-group view-mode-group">
        <button
          className={`view-mode-btn ${viewMode === 'source' ? 'active' : ''}`}
          onClick={() => onViewModeChange('source')}
          onMouseDown={(e) => e.preventDefault()}
          title="源码模式"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'wysiwyg' ? 'active' : ''}`}
          onClick={() => onViewModeChange('wysiwyg')}
          onMouseDown={(e) => e.preventDefault()}
          title="原地预览模式"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => onViewModeChange('split')}
          onMouseDown={(e) => e.preventDefault()}
          title="分栏模式"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
        </button>
      </div>

      <div className="toolbar-right">
        <div className="toolbar-stats">
          <span>{stats.words} 词</span>
          <span className="toolbar-stats-sep">·</span>
          <span>{stats.chars} 字符</span>
          <span className="toolbar-stats-sep">·</span>
          <span>{stats.lines} 行</span>
        </div>
        <div className="toolbar-filepath">
          {filePath || '未保存'}
        </div>
      </div>
    </div>
  )
}
