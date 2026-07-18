import { useState, useCallback, useRef, useEffect } from 'react'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import type { FileEntry, ElectronAPI } from '../types'

export type { FileEntry }

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    // 返回 undefined 让 markdown-it 自行做 HTML 转义
    return undefined as unknown as string
  }
})

// 自定义代码块渲染，支持语言标识与复制按钮
const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const info = token.info ? token.info.trim() : ''
  const langName = info.split(/\s+/)[0]
  const displayLang = langName || 'code'
  const highlighted = defaultFence ? defaultFence(tokens, idx, options, env, self) : ''

  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-block-lang">${displayLang}</span>
      <button class="code-block-copy">复制</button>
    </div>
    ${highlighted}
  </div>`
}

export function useMarkdown() {
  const [content, setContent] = useState<string>('# Hello Markdown\n\n开始编辑你的文档...')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [html, setHtml] = useState<string>('')

  // 使用 ref 保存最新的 content 和 filePath，避免回调闭包过期
  const contentRef = useRef(content)
  const filePathRef = useRef(filePath)
  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => { filePathRef.current = filePath }, [filePath])

  // 防抖解析 Markdown（150ms，DOMPurify 防止 XSS）
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      setHtml(DOMPurify.sanitize(md.render(content)))
    }, 150)
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
    }
  }, [content])

  // 防抖统计词数、字符数、行数（300ms）
  const [stats, setStats] = useState({ words: 0, chars: 0, lines: 0 })
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(() => {
      const lines = content.split('\n').length
      const chars = content.replace(/\s/g, '').length
      const cjk = (content.match(/[一-鿿㐀-䶿豈-﫿]/g) || []).length
      const nonCjk = content
        .replace(/[一-鿿㐀-䶿豈-﫿]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0).length
      setStats({ words: cjk + nonCjk, chars, lines })
    }, 300)
    return () => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    }
  }, [content])

  // 脏状态跟踪：savedContentRef 记录上次保存/打开的内容
  const savedContentRef = useRef(content)

  // 每次渲染时计算脏状态
  const isDirty = content !== savedContentRef.current

  // 保存/新建/打开后重置（更新 ref，触发重渲染使 isDirty 生效）
  const [, forceUpdate] = useState(0)
  const resetDirty = useCallback(() => {
    savedContentRef.current = contentRef.current
    forceUpdate(v => v + 1)
  }, [])

  // 启动时加载初始文件
  useEffect(() => {
    const loadInitialFile = async () => {
      if (window.electronAPI && window.electronAPI.getInitialFile) {
        const result = await window.electronAPI.getInitialFile()
        if (result) {
          savedContentRef.current = result.content
          setContent(result.content)
          setFilePath(result.filePath)
        }
      }
    }
    loadInitialFile()
  }, [])

  // 新建文件
  const handleNewFile = useCallback(() => {
    savedContentRef.current = '# 新文档\n\n'
    setContent('# 新文档\n\n')
    setFilePath(null)
  }, [])

  // 打开文件
  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile()
    if (result) {
      savedContentRef.current = result.content
      setContent(result.content)
      setFilePath(result.filePath)
    }
  }, [])

  // 打开文件夹
  const handleOpenFolder = useCallback(async () => {
    const result = await window.electronAPI.openFolder()
    if (result) {
      setFolderPath(result)
    }
  }, [])

  // 通过路径打开文件（侧边栏点击）
  const openFileByPath = useCallback(async (path: string) => {
    const result = await window.electronAPI.readFileContent(path)
    if (result) {
      savedContentRef.current = result.content
      setContent(result.content)
      setFilePath(result.filePath)
    }
  }, [])

  // 保存文件（使用 ref 确保始终读取最新值）
  const handleSaveFile = useCallback(async () => {
    const currentContent = contentRef.current
    const currentPath = filePathRef.current
    if (currentPath) {
      const savedPath = await window.electronAPI.saveFile(currentContent, currentPath)
      if (savedPath) {
        if (savedPath !== currentPath) {
          setFilePath(savedPath)
        }
        resetDirty()
        return savedPath
      }
      return null
    } else {
      const savedPath = await window.electronAPI.saveFile(currentContent)
      if (savedPath) {
        setFilePath(savedPath)
        resetDirty()
        return savedPath
      }
      return null
    }
  }, [resetDirty])

  // 另存为（使用 ref 确保始终读取最新值）
  const handleSaveAs = useCallback(async () => {
    const savedPath = await window.electronAPI.saveFile(contentRef.current)
    if (savedPath) {
      setFilePath(savedPath)
      resetDirty()
      return savedPath
    }
    return null
  }, [resetDirty])

  const handleNewFileRef = useRef(handleNewFile)
  const handleOpenFileRef = useRef(handleOpenFile)
  const handleOpenFolderRef = useRef(handleOpenFolder)
  const handleSaveFileRef = useRef(handleSaveFile)
  const handleSaveAsRef = useRef(handleSaveAs)

  useEffect(() => {
    handleNewFileRef.current = handleNewFile
    handleOpenFileRef.current = handleOpenFile
    handleOpenFolderRef.current = handleOpenFolder
    handleSaveFileRef.current = handleSaveFile
    handleSaveAsRef.current = handleSaveAs
  }, [handleNewFile, handleOpenFile, handleOpenFolder, handleSaveFile, handleSaveAs])

  // 注册菜单事件（使用返回的清理函数精确移除监听器）
  useEffect(() => {
    const disposeNewFile = window.electronAPI.onNewFile(() => handleNewFileRef.current())
    const disposeFileOpened = window.electronAPI.onFileOpened((data) => {
      savedContentRef.current = data.content
      setContent(data.content)
      setFilePath(data.filePath)
    })
    const disposeFolderOpened = window.electronAPI.onFolderOpened((folderPath) => {
      setFolderPath(folderPath)
    })
    const disposeSaveFile = window.electronAPI.onSaveFile(() => handleSaveFileRef.current())
    const disposeSaveAs = window.electronAPI.onSaveAs(() => handleSaveAsRef.current())

    return () => {
      disposeNewFile()
      disposeFileOpened()
      disposeFolderOpened()
      disposeSaveFile()
      disposeSaveAs()
    }
  }, [])

  // 同步脏状态到主进程（用 ref 避免重复发送）
  const lastDirtyRef = useRef(isDirty)
  useEffect(() => {
    if (lastDirtyRef.current !== isDirty) {
      lastDirtyRef.current = isDirty
      window.electronAPI?.setDirty?.(isDirty)
    }
  })

  // 注册 Electron 原生关闭确认（主进程通过 IPC 查询脏状态和触发保存）
  useEffect(() => {
    window.electronAPI.onCheckDirty(() => contentRef.current !== savedContentRef.current)
    window.electronAPI.onSaveFileDirect(async () => {
      await handleSaveFileRef.current()
    })
  }, [])

  // 同步窗口标题（含脏状态标记）
  useEffect(() => {
    const prefix = isDirty ? '* ' : ''
    if (filePath) {
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      document.title = prefix + fileName + ' - Markdown Editor'
    } else {
      document.title = prefix + 'Markdown Editor'
    }
  }, [filePath, isDirty])

  return {
    content,
    setContent,
    html,
    filePath,
    folderPath,
    setFolderPath,
    stats,
    isDirty,
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    openFileByPath,
    handleSaveFile,
    handleSaveAs
  }
}
