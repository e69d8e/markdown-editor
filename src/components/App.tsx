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
  const [isDragOver, setIsDragOver] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const editorRef = useRef<EditorView | null>(null)
  const previewRef = useRef<PreviewRef | null>(null)
  const activePane = useRef<'editor' | 'preview' | null>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const scrollDebounceRef = useRef(false)

  // 主题切换：设置 data-theme 属性并持久化
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

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

  // 文件拖放到窗口
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // Electron 中 file.path 包含完整路径
      const filePath = (file as any).path as string
      if (filePath) {
        openFileByPath(filePath)
      }
    }
  }, [openFileByPath])

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
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(splitRatio * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault()
              setSplitRatio(r => Math.max(0.2, r - 0.05))
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault()
              setSplitRatio(r => Math.min(0.8, r + 0.05))
            }
          }}
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
    <div
      className={`app ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <span>释放以打开文件</span>
        </div>
      )}
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
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
