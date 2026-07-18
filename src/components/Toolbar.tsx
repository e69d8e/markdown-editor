import React from 'react'
import { EditorView } from '@codemirror/view'
import { ViewMode } from './App'
import { insertMarkdown, insertLinePrefix } from '../utils/markdown'
import {
  NewFileIcon,
  OpenFileIcon,
  OpenFolderIcon,
  SaveIcon,
  SaveAsIcon,
  ListIcon,
  OrderedListIcon,
  QuoteIcon,
  CodeBlockIcon,
  SidebarIcon,
  SourceModeIcon,
  WysiwygModeIcon,
  SplitModeIcon,
  SunIcon,
  MoonIcon
} from './Icons'
import '../styles/Toolbar.css'

interface ToolbarProps {
  filePath: string | null
  stats: { words: number; chars: number; lines: number }
  editorRef: React.MutableRefObject<EditorView | null>
  onNew: () => void
  onOpen: () => void
  onOpenFolder: () => void
  onSave: () => void
  onSaveAs: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const Toolbar = React.memo(function Toolbar({
  filePath,
  stats,
  editorRef,
  onNew,
  onOpen,
  onOpenFolder,
  onSave,
  onSaveAs,
  viewMode,
  onViewModeChange,
  sidebarOpen,
  onToggleSidebar,
  theme,
  onToggleTheme
}: ToolbarProps) {
  const handleInsertMarkdown = (before: string, after: string) => {
    const view = editorRef.current
    if (view) insertMarkdown(view, before, after)
  }

  const handleInsertLinePrefix = (prefix: string) => {
    const view = editorRef.current
    if (view) insertLinePrefix(view, prefix)
  }

  // 根据平台显示快捷键修饰符
  const modKey = navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={onNew} onMouseDown={(e) => e.preventDefault()} title={`新建 (${modKey}+N)`} aria-label="新建文件">
          <NewFileIcon />
        </button>
        <button onClick={onOpen} onMouseDown={(e) => e.preventDefault()} title={`打开 (${modKey}+O)`} aria-label="打开文件">
          <OpenFileIcon />
        </button>
        <button onClick={onOpenFolder} onMouseDown={(e) => e.preventDefault()} title={`打开文件夹 (${modKey}+Shift+O)`} aria-label="打开文件夹">
          <OpenFolderIcon />
        </button>
        <button onClick={onSave} onMouseDown={(e) => e.preventDefault()} title={`保存 (${modKey}+S)`} aria-label="保存文件">
          <SaveIcon />
        </button>
        <button onClick={onSaveAs} onMouseDown={(e) => e.preventDefault()} title={`另存为 (${modKey}+Shift+S)`} aria-label="另存为">
          <SaveAsIcon />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={() => handleInsertMarkdown('**', '**')} onMouseDown={(e) => e.preventDefault()} title={`加粗 (${modKey}+B)`} aria-label="加粗">
          <strong>B</strong>
        </button>
        <button onClick={() => handleInsertMarkdown('*', '*')} onMouseDown={(e) => e.preventDefault()} title={`斜体 (${modKey}+I)`} aria-label="斜体">
          <em>I</em>
        </button>
        <button onClick={() => handleInsertMarkdown('~~', '~~')} onMouseDown={(e) => e.preventDefault()} title="删除线" aria-label="删除线">
          <s>S</s>
        </button>
        <button onClick={() => handleInsertMarkdown('`', '`')} onMouseDown={(e) => e.preventDefault()} title={`行内代码 (${modKey}+\`)`} aria-label="行内代码">
          <code>{'</>'}</code>
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={() => handleInsertLinePrefix('# ')} onMouseDown={(e) => e.preventDefault()} title="标题1" aria-label="标题1">
          H1
        </button>
        <button onClick={() => handleInsertLinePrefix('## ')} onMouseDown={(e) => e.preventDefault()} title="标题2" aria-label="标题2">
          H2
        </button>
        <button onClick={() => handleInsertLinePrefix('### ')} onMouseDown={(e) => e.preventDefault()} title="标题3" aria-label="标题3">
          H3
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button onClick={() => handleInsertLinePrefix('- ')} onMouseDown={(e) => e.preventDefault()} title="无序列表" aria-label="无序列表">
          <ListIcon />
        </button>
        <button onClick={() => handleInsertLinePrefix('1. ')} onMouseDown={(e) => e.preventDefault()} title="有序列表" aria-label="有序列表">
          <OrderedListIcon />
        </button>
        <button onClick={() => handleInsertLinePrefix('> ')} onMouseDown={(e) => e.preventDefault()} title="引用" aria-label="引用">
          <QuoteIcon />
        </button>
        <button onClick={() => handleInsertMarkdown('\n```\n', '\n```\n')} onMouseDown={(e) => e.preventDefault()} title="代码块" aria-label="代码块">
          <CodeBlockIcon />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* 侧边栏切换 */}
      <div className="toolbar-group">
        <button
          className={`view-mode-btn ${sidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          onMouseDown={(e) => e.preventDefault()}
          title="切换侧边栏"
          aria-label="切换侧边栏"
        >
          <SidebarIcon />
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* 主题切换 */}
      <div className="toolbar-group">
        <button
          className="view-mode-btn"
          onClick={onToggleTheme}
          onMouseDown={(e) => e.preventDefault()}
          title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
          aria-label={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
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
          aria-label="源码模式"
        >
          <SourceModeIcon />
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'wysiwyg' ? 'active' : ''}`}
          onClick={() => onViewModeChange('wysiwyg')}
          onMouseDown={(e) => e.preventDefault()}
          title="原地预览模式"
          aria-label="原地预览模式"
        >
          <WysiwygModeIcon />
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => onViewModeChange('split')}
          onMouseDown={(e) => e.preventDefault()}
          title="分栏模式"
          aria-label="分栏模式"
        >
          <SplitModeIcon />
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
})

export default Toolbar
