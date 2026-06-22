import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<{ filePath: string; content: string } | null>
      openFolder: () => Promise<string | null>
      saveFile: (content: string, filePath?: string) => Promise<string | null>
      getInitialFile: () => Promise<{ filePath: string; content: string } | null>
      readDirectory: (dirPath: string) => Promise<FileEntry[]>
      readFileContent: (filePath: string) => Promise<{ filePath: string; content: string } | null>
      onNewFile: (callback: () => void) => () => void
      onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => () => void
      onFolderOpened: (callback: (folderPath: string) => void) => () => void
      onSaveFile: (callback: () => void) => () => void
      onSaveAs: (callback: () => void) => () => void
      removeAllListeners: (channel: string) => void
    }
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

  // 解析 Markdown
  useEffect(() => {
    setHtml(md.render(content))
  }, [content])

  // 启动时加载初始文件
  useEffect(() => {
    const loadInitialFile = async () => {
      if (window.electronAPI && window.electronAPI.getInitialFile) {
        const result = await window.electronAPI.getInitialFile()
        if (result) {
          setContent(result.content)
          setFilePath(result.filePath)
        }
      }
    }
    loadInitialFile()
  }, [])

  // 新建文件
  const handleNewFile = useCallback(() => {
    setContent('# 新文档\n\n')
    setFilePath(null)
  }, [])

  // 打开文件
  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile()
    if (result) {
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
      setContent(result.content)
      setFilePath(result.filePath)
    }
  }, [])

  // 保存文件（使用 ref 确保始终读取最新值）
  const handleSaveFile = useCallback(async () => {
    const currentContent = contentRef.current
    const currentPath = filePathRef.current
    if (currentPath) {
      await window.electronAPI.saveFile(currentContent, currentPath)
    } else {
      const savedPath = await window.electronAPI.saveFile(currentContent)
      if (savedPath) {
        setFilePath(savedPath)
      }
    }
  }, [])

  // 另存为（使用 ref 确保始终读取最新值）
  const handleSaveAs = useCallback(async () => {
    const savedPath = await window.electronAPI.saveFile(contentRef.current)
    if (savedPath) {
      setFilePath(savedPath)
    }
  }, [])

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
  })

  // 同步窗口标题
  useEffect(() => {
    if (filePath) {
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      document.title = `${fileName} - Markdown Editor`
    } else {
      document.title = 'Markdown Editor'
    }
  }, [filePath])

  // 注册菜单事件（使用返回的清理函数精确移除监听器）
  useEffect(() => {
    const disposeNewFile = window.electronAPI.onNewFile(() => handleNewFileRef.current())
    const disposeFileOpened = window.electronAPI.onFileOpened((data) => {
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

  // 统计词数、字符数、行数
  const stats = useMemo(() => {
    const lines = content.split('\n').length
    const chars = content.replace(/\s/g, '').length
    // 中文等 CJK 字符每个计为一词，英文按空格分词
    const cjk = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
    const nonCjk = content
      .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0).length
    const words = cjk + nonCjk
    return { words, chars, lines }
  }, [content])

  return {
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
  }
}
