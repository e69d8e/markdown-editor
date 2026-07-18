import React, { useState, useEffect, useCallback } from 'react'
import { FileEntry } from '../types'
import { ChevronIcon, FolderIcon, FileTextIcon, FileIcon, CloseIcon } from './Icons'
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

const Sidebar = React.memo(function Sidebar({ rootPath, onFileOpen, currentFilePath, onClose }: SidebarProps) {
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

    // 使用函数式更新避免 stale closure
    let shouldLoad = false
    setTree(prev => {
      const findNode = (nodes: TreeNode[]): boolean => {
        for (const node of nodes) {
          if (node.path === path) {
            return node.isDirectory && !node.loaded
          }
          if (node.children && findNode(node.children)) return true
        }
        return false
      }
      shouldLoad = findNode(prev)
      return prev // 不修改，仅检查
    })

    if (shouldLoad) {
      const entries = await loadDirectory(path)
      setTree(prev => updateTree(prev, path, entries))
    }
  }, [loadDirectory])

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
        <div key={node.path} className="tree-directory" role="group">
          <div
            className="tree-item tree-folder"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => toggleExpand(node.path)}
            role="treeitem"
            aria-expanded={isExpanded}
          >
            <span className={`tree-arrow ${isExpanded ? 'expanded' : ''}`}>
              <ChevronIcon size={12} />
            </span>
            <span className="tree-icon folder-icon">
              <FolderIcon />
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
        role="treeitem"
        aria-selected={isActive}
      >
        <span className="tree-icon file-icon">
          {isMd ? <FileTextIcon /> : <FileIcon />}
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
        <button className="sidebar-close" onClick={onClose} title="关闭侧边栏" aria-label="关闭侧边栏">
          <CloseIcon size={14} />
        </button>
      </div>
      <div className="sidebar-tree" role="tree">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  )
})

export default Sidebar
