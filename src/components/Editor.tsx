import { useEffect, useRef } from 'react'
import { EditorView, ViewPlugin, ViewUpdate, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap, highlightSelectionMatches, getSearchQuery } from '@codemirror/search'
import { syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { createLivePreviewPlugin } from '../plugins/livePreview'
import { ViewMode } from './App'
import '../styles/Editor.css'

interface EditorProps {
  content: string
  onChange: (value: string) => void
  editorRef?: React.MutableRefObject<EditorView | null>
  viewMode: ViewMode
  onScroll?: (ratio: number) => void
}

// Markdown 语法高亮主题
const markdownHighlighting = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: 'bold', color: '#0f172a' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: 'bold', color: '#0f172a' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: 'bold', color: '#0f172a' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#94a3b8' },
  { tag: tags.link, color: '#3b82f6', textDecoration: 'underline' },
  { tag: tags.url, color: '#3b82f6' },
  { tag: tags.monospace, fontFamily: 'monospace', background: '#f1f5f9', color: '#3b82f6' },
  { tag: tags.quote, color: '#475569', borderLeft: '4px solid #3b82f6', paddingLeft: '12px' },
  { tag: tags.list, color: '#0f172a' },
  { tag: tags.processingInstruction, color: '#3b82f6' },
  { tag: tags.contentSeparator, color: '#e2e8f0' }
])

// 搜索匹配计数插件：显示「当前第几个 / 共几个」
function createSearchCountPlugin() {
  return ViewPlugin.fromClass(class {
    counterEl: HTMLElement | null = null

    constructor(view: EditorView) {
      this.refresh(view)
    }

    update(_update: ViewUpdate) {
      this.refresh(_update.view)
    }

    refresh(view: EditorView) {
      requestAnimationFrame(() => {
        const panel = view.dom.querySelector('.cm-search')
        if (!panel) { this.counterEl = null; return }

        if (!this.counterEl || !panel.contains(this.counterEl)) {
          this.counterEl = document.createElement('span')
          this.counterEl.className = 'cm-search-count'
          const input = panel.querySelector('.cm-textfield')
          if (input) input.after(this.counterEl)
          else return
        }

        const query = getSearchQuery(view.state)
        if (!query.search) { this.counterEl.textContent = ''; return }

        const doc = view.state.doc.toString()
        if (doc.length > 500000) { this.counterEl.textContent = ''; return }

        const selFrom = view.state.selection.main.from
        let total = 0, current = 0

        if (query.regexp) {
          try {
            const flags = query.caseSensitive ? 'gm' : 'gim'
            const re = new RegExp(query.search, flags)
            let m
            while ((m = re.exec(doc)) !== null) {
              total++
              if (current === 0 && m.index >= selFrom) current = total
              if (m[0].length === 0) { re.lastIndex++; if (re.lastIndex > doc.length) break }
            }
          } catch (_) {
            this.counterEl.textContent = ''
            return
          }
        } else {
          const needle = query.caseSensitive ? query.search : query.search.toLowerCase()
          const haystack = query.caseSensitive ? doc : doc.toLowerCase()
          let idx = 0
          while ((idx = haystack.indexOf(needle, idx)) !== -1) {
            total++
            if (current === 0 && idx >= selFrom) current = total
            idx += needle.length || 1
          }
        }

        if (current === 0 && total > 0) current = 1
        this.counterEl.textContent = total === 0 ? '无结果' : `${current} / ${total}`
      })
    }
  })
}

export default function Editor({ content, onChange, editorRef, viewMode, onScroll }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onScrollRef = useRef(onScroll)
  const contentRef = useRef(content)

  // 同步 onScroll 和 content 引用，避免重建编辑器
  useEffect(() => {
    onScrollRef.current = onScroll
    contentRef.current = content
  }, [onScroll, content])

  // 当 viewMode 变化时重建编辑器
  useEffect(() => {
    if (!containerRef.current) return

    // 保存当前的 selection 和滚动位置
    let savedSelection: any = null
    let savedScrollTop = 0
    if (viewRef.current) {
      savedSelection = viewRef.current.state.selection
      savedScrollTop = viewRef.current.scrollDOM.scrollTop
      viewRef.current.destroy()
    }

    const isWysiwyg = viewMode === 'wysiwyg'

    const extensions = [
      // 源码模式显示行号，原地预览模式隐藏
      ...(isWysiwyg ? [] : [lineNumbers()]),
      highlightActiveLine(),
      ...(isWysiwyg ? [] : [highlightActiveLineGutter()]),
      history(),
      indentOnInput(),
      bracketMatching(),
      ...(isWysiwyg ? [] : [foldGutter()]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      ...(isWysiwyg ? [] : [syntaxHighlighting(markdownHighlighting)]),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
        { key: 'Mod-b', run: () => insertMarkdown('**', '**') },
        { key: 'Mod-i', run: () => insertMarkdown('*', '*') },
        { key: 'Mod-`', run: () => insertMarkdown('`', '`') },
        { key: 'Mod-k', run: () => insertMarkdown('[', '](url)') }
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': {
          fontSize: '14px',
          height: '100%',
          backgroundColor: '#ffffff'
        },
        '.cm-content': {
          fontFamily: isWysiwyg
            ? "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            : "'Fira Code', 'Cascadia Code', Consolas, monospace",
          padding: '10px 0',
          color: 'var(--text-primary)'
        },
        '.cm-line': {
          padding: '0 10px'
        }
      }),
      search({ top: true }),
      highlightSelectionMatches(),
      createSearchCountPlugin()
    ]

    // 原地预览模式添加插件
    if (isWysiwyg) {
      extensions.push(createLivePreviewPlugin())
    }

    // 使用 ref 获取最新内容，避免闭包捕获过期值
    const currentContent = contentRef.current
    // 验证 selection 是否在文档范围内，防止越界崩溃
    let validSelection = undefined
    if (savedSelection) {
      const docLen = currentContent.length
      const mainRange = savedSelection.main
      if (mainRange.anchor <= docLen && mainRange.head <= docLen) {
        validSelection = savedSelection
      }
    }

    const state = EditorState.create({
      doc: currentContent,
      selection: validSelection,
      extensions
    })

    const view = new EditorView({
      state,
      parent: containerRef.current
    })

    const handleScroll = () => {
      if (!onScrollRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = view.scrollDOM
      const maxScroll = scrollHeight - clientHeight
      const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0
      onScrollRef.current(ratio)
    }

    view.scrollDOM.addEventListener('scroll', handleScroll)

    viewRef.current = view
    if (editorRef) {
      editorRef.current = view
    }

    // 恢复滚动位置
    if (savedScrollTop) {
      requestAnimationFrame(() => {
        try {
          if (view.scrollDOM) {
            view.scrollDOM.scrollTop = savedScrollTop
          }
        } catch (_) {}
      })
    }

    // 聚焦编辑器，确保光标跳转到编辑位置
    view.focus()

    return () => {
      view.scrollDOM.removeEventListener('scroll', handleScroll)
      view.destroy()
    }
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 同步外部内容变化
  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content
        }
      })
      // 外部内容变更后聚焦编辑器，如打开或新建文件
      view.focus()
    }
  }, [content])

  function insertMarkdown(before: string, after: string): boolean {
    const view = viewRef.current
    if (!view) return false

    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const replacement = before + selected + after

    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + before.length, head: from + before.length + selected.length }
    })
    return true
  }

  return <div ref={containerRef} className={`editor-container ${viewMode === 'wysiwyg' ? 'wysiwyg-mode' : ''}`} />
}
