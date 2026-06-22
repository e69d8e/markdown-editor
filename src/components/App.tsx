import { useRef, useCallback, useState, useEffect } from 'react'
import { EditorView } from '@codemirror/view'
import Editor from './Editor'
import Preview, { PreviewRef } from './Preview'
import Toolbar from './Toolbar'
import Sidebar from './Sidebar'
import { useMarkdown } from '../hooks/useMarkdown'
import '../styles/App.css'

export type ViewMode = 'source' | 'wysiwyg' | 'split'

export default function App() {
  const {
    content,
    setContent,
    html,
    filePath,
    folderPath,
    setFolderPath,
    stats,
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    openFileByPath,
    handleSaveFile,
    handleSaveAs
  } = useMarkdown()

  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const editorRef = useRef<EditorView | null>(null)
  const previewRef = useRef<PreviewRef | null>(null)
  const activePane = useRef<'editor' | 'preview' | null>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const scrollDebounceRef = useRef(false)

  // 当打开文件夹时自动显示侧边栏
  useEffect(() => {
    if (folderPath) {
      setSidebarOpen(true)
    }
  }, [folderPath])

  // 切换侧边栏
  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  // 关闭侧边栏
  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
    setFolderPath(null)
  }, [setFolderPath])

  // 编辑器滚动同步到预览（带防抖避免反馈环路）
  const handleEditorScroll = useCallback((scrollRatio: number) => {
    const isEditorFocused = editorRef.current?.hasFocus
    if (activePane.current !== 'editor' && !isEditorFocused) return
    if (scrollDebounceRef.current) return
    scrollDebounceRef.current = true
    previewRef.current?.scrollToRatio(scrollRatio)
    setTimeout(() => { scrollDebounceRef.current = false }, 50)
  }, [])

  // 预览滚动同步到编辑器（带防抖避免反馈环路）
  const handlePreviewScroll = useCallback((scrollRatio: number) => {
    if (activePane.current !== 'preview') return
    if (scrollDebounceRef.current) return
    scrollDebounceRef.current = true
    const view = editorRef.current
    if (view) {
      const { scrollHeight, clientHeight } = view.scrollDOM
      const maxScroll = scrollHeight - clientHeight
      if (maxScroll > 0) {
        view.scrollDOM.scrollTop = scrollRatio * maxScroll
      }
    }
    setTimeout(() => { scrollDebounceRef.current = false }, 50)
  }, [])

  // 拖动开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  // 拖动中
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!layoutRef.current) return
      const rect = layoutRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = Math.min(Math.max(x / rect.width, 0.2), 0.8)
      setSplitRatio(ratio)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // 渲染编辑器内容
  const renderEditor = () => (
    <div
      className={viewMode === 'split' ? 'editor-pane' : 'editor-pane-full'}
      style={viewMode === 'split' ? { width: `${splitRatio * 100}%` } : undefined}
      onMouseEnter={() => { activePane.current = 'editor' }}
    >
      <Editor
        content={content}
        onChange={setContent}
        editorRef={editorRef}
        viewMode={viewMode}
        onScroll={handleEditorScroll}
      />
    </div>
  )

  // 渲染预览内容
  const renderPreview = () => {
    if (viewMode !== 'split') return null

    return (
      <>
        <div
          className={`divider ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleDragStart}
        >
          <div className="divider-handle" />
        </div>
        <div
          className="preview-pane"
          style={{ width: `${(1 - splitRatio) * 100}%` }}
          onMouseEnter={() => { activePane.current = 'preview' }}
        >
          <Preview
            ref={previewRef}
            html={html}
            onScroll={handlePreviewScroll}
          />
        </div>
      </>
    )
  }

  return (
    <div className="app">
      <Toolbar
        filePath={filePath}
        stats={stats}
        editorRef={editorRef}
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onSave={handleSaveFile}
        onSaveAs={handleSaveAs}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />
      <div className={`editor-layout ${isDragging ? 'resizing' : ''}`} ref={layoutRef}>
        {sidebarOpen && (
          <>
            <Sidebar
              rootPath={folderPath}
              onFileOpen={openFileByPath}
              currentFilePath={filePath}
              onClose={handleCloseSidebar}
            />
            <div className="sidebar-divider" />
          </>
        )}
        {renderEditor()}
        {renderPreview()}
      </div>
    </div>
  )
}
