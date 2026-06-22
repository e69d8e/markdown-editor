import { useState, useEffect, useCallback } from 'react'
import { FileEntry } from '../hooks/useMarkdown'
import '../styles/Sidebar.css'

interface SidebarProps {
  rootPath: string | null
  onFileOpen: (filePath: string) => void
  currentFilePath: string | null
  onClose: () => void
}

interface TreeNode extends FileEntry {
  children?: TreeNode[]
  loaded?: boolean
}

export default function Sidebar({ rootPath, onFileOpen, currentFilePath, onClose }: SidebarProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 加载目录内容
  const loadDirectory = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const entries = await window.electronAPI.readDirectory(dirPath)
    return entries.map(e => ({ ...e, loaded: false }))
  }, [])

  // 初始化时加载根目录
  useEffect(() => {
    if (!rootPath) return
    loadDirectory(rootPath).then(entries => {
      setTree(entries)
      setExpanded(new Set([rootPath]))
    })
  }, [rootPath, loadDirectory])

  // 切换文件夹展开/折叠
  const toggleExpand = useCallback(async (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })

    // 如果尚未加载子目录，加载之
    const needLoad = (nodes: TreeNode[]): boolean => {
      for (const node of nodes) {
        if (node.path === path) {
          return node.isDirectory && !node.loaded
        }
        if (node.children && needLoad(node.children)) return true
      }
      return false
    }

    if (needLoad(tree)) {
      const entries = await loadDirectory(path)
      setTree(prev => updateTree(prev, path, entries))
    }
  }, [tree, loadDirectory])

  // 递归更新树节点的子节点
  const updateTree = (nodes: TreeNode[], targetPath: string, children: TreeNode[]): TreeNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return { ...node, children, loaded: true }
      }
      if (node.children) {
        return { ...node, children: updateTree(node.children, targetPath, children) }
      }
      return node
    })
  }

  // 判断文件是否为 Markdown
  const isMarkdown = (name: string) => /\.(md|markdown)$/i.test(name)

  // 渲染树节点
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.path)
    const isActive = currentFilePath === node.path
    const isMd = isMarkdown(node.name)

    if (node.isDirectory) {
      return (
        <div key={node.path} className="tree-directory">
          <div
            className="tree-item tree-folder"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => toggleExpand(node.path)}
          >
            <span className={`tree-arrow ${isExpanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M8 5l8 7-8 7z" />
              </svg>
            </span>
            <span className="tree-icon folder-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                {isExpanded ? (
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                ) : (
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                )}
              </svg>
            </span>
            <span className="tree-name">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="tree-children">
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    // 文件节点
    return (
      <div
        key={node.path}
        className={`tree-item tree-file ${isActive ? 'active' : ''} ${isMd ? 'clickable' : 'disabled'}`}
        style={{ paddingLeft: `${depth * 16 + 28}px` }}
        onClick={() => isMd && onFileOpen(node.path)}
      >
        <span className="tree-icon file-icon">
          {isMd ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
        </span>
        <span className="tree-name">{node.name}</span>
      </div>
    )
  }

  if (!rootPath) return null

  const folderName = rootPath.split(/[/\\]/).pop() || rootPath

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title" title={rootPath}>{folderName}</span>
        <button className="sidebar-close" onClick={onClose} title="关闭侧边栏">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="sidebar-tree">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  )
}
