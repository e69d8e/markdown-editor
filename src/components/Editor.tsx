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
import { insertMarkdown as insertMarkdownUtil } from '../utils/markdown'
import { ViewMode } from './App'
import '../styles/Editor.css'

interface EditorProps {
  content: string
  onChange: (value: string) => void
  editorRef?: React.MutableRefObject<EditorView | null>
  viewMode: ViewMode
  onScroll?: (ratio: number) => void
}

// Markdown 语法高亮主题（使用 CSS 变量适配暗色模式）
const markdownHighlighting = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: 'bold', color: 'var(--text-heading)' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: 'bold', color: 'var(--text-heading)' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: 'bold', color: 'var(--text-heading)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-tertiary)' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--accent)' },
  { tag: tags.monospace, fontFamily: 'monospace', background: 'var(--bg-active)', color: 'var(--accent)' },
  { tag: tags.quote, color: 'var(--text-secondary)', borderLeft: '4px solid var(--accent)', paddingLeft: '12px' },
  { tag: tags.list, color: 'var(--text-primary)' },
  { tag: tags.processingInstruction, color: 'var(--accent)' },
  { tag: tags.contentSeparator, color: 'var(--border-light)' }
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
        { key: 'Mod-b', run: (v) => insertMarkdownUtil(v, '**', '**') },
        { key: 'Mod-i', run: (v) => insertMarkdownUtil(v, '*', '*') },
        { key: 'Mod-`', run: (v) => insertMarkdownUtil(v, '`', '`') },
        { key: 'Mod-k', run: (v) => insertMarkdownUtil(v, '[', '](url)') }
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
          backgroundColor: 'var(--bg-primary)'
        },
        '.cm-content': {
          fontFamily: isWysiwyg
            ? "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            : "'Fira Code', 'Cascadia Code', Consolas, monospace",
          padding: '10px 0',
          color: 'var(--text-primary)',
          caretColor: 'var(--accent)'
        },
        '.cm-line': {
          padding: '0 10px'
        },
        '.cm-gutters': {
          backgroundColor: 'var(--bg-active)',
          color: 'var(--text-tertiary)',
          borderRight: '1px solid var(--border-main)'
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-primary)'
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: 'var(--accent)',
          borderLeftWidth: '2px'
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: 'var(--accent)'
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: 'rgba(204, 120, 92, 0.15)'
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

  return <div ref={containerRef} className={`editor-container ${viewMode === 'wysiwyg' ? 'wysiwyg-mode' : ''}`} />
}
